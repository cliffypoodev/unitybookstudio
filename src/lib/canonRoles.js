// src/lib/canonRoles.js — CANON-2
//
// Character canon: names, aliases, and roles — one source of truth, checked
// everywhere it can drift.
//
// The failures this closes (all measured on the REDUX draft):
// 1. FOUNDATION CONTRADICTION: the story bible itself disagreed — characters_md
//    made Zin the navigator while world_md AND canon_md both called Sadie "the
//    ship's navigator". The writer faithfully reproduced the contradiction on
//    page 3. No draft-time canon enforcement can work when the canon disagrees
//    with itself, so contradictions are detected at the FOUNDATION level.
// 2. NAME-VARIANT DRIFT: "Rodger" appeared 3× in a book whose canon is
//    Roderick/Rodge. Near-miss variants of canonical names are detected and
//    (in polish) healed deterministically.
//
// Nothing book-specific: everything derives from the project's own foundation
// fields at runtime.

const ROLE_LINE_PATTERNS = [
  // "**Role:** Navigator and heart of the crew" inside a character entry
  /\*\*\s*Role\s*:?\s*\*\*\s*:?\s*([^\n]+)/gi,
];

// "<Name>, the [ship's] <role phrase>," appositives in prose-like foundation
// fields (world_md, canon_md) and in chapter prose.
const APPOSITIVE_ROLE = /\b([A-Z][a-z'’-]+)\*{0,2},\s+the\s+(?:ship(?:’|')s\s+)?([a-z][a-z\s-]{2,30}?)(?=[,.;])/g;

// Roles that a crew/cast can hold only once. Multi-holder roles (engineer,
// mechanic, member…) are deliberately excluded — flagging those would drown
// the signal (the REDUX bible legitimately debatably has several engineers,
// and that is a craft note, not a hard contradiction).
const UNIQUE_ROLES = ['navigator', 'captain', 'leader', 'pilot', 'cook', 'medic', 'doctor', 'quartermaster', 'first mate'];

function normalizeRole(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function uniqueRoleIn(roleText) {
  const norm = normalizeRole(roleText);
  for (const role of UNIQUE_ROLES) {
    if (new RegExp(`(?:^|\\s)${role}(?:$|[\\s,.;])`).test(`${norm} `)) return role;
  }
  return null;
}

/**
 * Parse the character sheet into canon entries:
 * [{ name, aliases: Set, role, uniqueRole }].
 * Aliases come from quoted nicknames in entry headers
 * ("Zinnia 'Zin' Quark" → Zinnia, Zin, Quark).
 */
export function parseCanonCast(charactersMd) {
  const text = String(charactersMd || '');
  const entries = [];
  const headerRx = /^\s{0,3}(?:#{1,4}\s+|(?:\*\*)?\d+\.\s+)(.+)$/gm;
  let match;
  const headers = [];
  while ((match = headerRx.exec(text)) !== null) {
    headers.push({ index: match.index, line: match[1] });
  }
  const LABEL_WORDS = new Set(['Characters', 'Character', 'Major', 'Minor', 'Supporting', 'Cast', 'Overview', 'The', 'Key']);
  const cleanToken = (t) => t.replace(/^['‘"“]+|['’"”]+$/g, '').replace(/’s$/, '');
  for (let i = 0; i < headers.length; i += 1) {
    const line = headers[i].line.replace(/\*\*/g, '');
    const namePart = line.split(':').pop().trim();
    const aliases = new Set();
    for (const t of namePart.matchAll(/['‘"“]?[A-Z][A-Za-z'’-]*['’"”]?/g)) {
      const clean = cleanToken(t[0]);
      if (clean.length >= 2 && !LABEL_WORDS.has(clean)) aliases.add(clean);
    }
    if (!aliases.size) continue;
    const block = text.slice(headers[i].index, headers[i + 1] ? headers[i + 1].index : text.length);
    let role = '';
    for (const rx of ROLE_LINE_PATTERNS) {
      rx.lastIndex = 0;
      const r = rx.exec(block);
      if (r) { role = r[1].trim(); break; }
    }
    // Primary = the first name token as written ("Missy 'The Spanner' Marlowe"
    // → Missy), never the longest alias.
    const primary = [...aliases][0];
    entries.push({ name: primary, aliases, role, uniqueRole: uniqueRoleIn(role) });
  }
  return entries;
}

/**
 * Every (name, uniqueRole, field) claim across the project's foundation
 * fields: characters_md Role lines plus "<Name>, the <role>" appositives in
 * world_md / canon_md / outline_md.
 */
export function collectRoleClaims(project) {
  const claims = [];
  for (const entry of parseCanonCast(project?.characters_md)) {
    if (entry.uniqueRole) claims.push({ name: entry.name, aliases: entry.aliases, role: entry.uniqueRole, field: 'characters_md' });
  }
  for (const field of ['world_md', 'canon_md', 'outline_md']) {
    const text = String(project?.[field] || '');
    APPOSITIVE_ROLE.lastIndex = 0;
    for (const m of text.matchAll(APPOSITIVE_ROLE)) {
      const role = uniqueRoleIn(m[2]);
      if (role) claims.push({ name: m[1], aliases: new Set([m[1]]), role, field, snippet: m[0].slice(0, 80) });
    }
  }
  return claims;
}

/**
 * Cross-field role contradictions: the same unique role claimed for two
 * different characters anywhere in the foundation.
 * Returns [{ role, holders: [{name, field, snippet?}] }] — empty when clean.
 */
export function checkFoundationRoleConsistency(project) {
  const claims = collectRoleClaims(project);
  const canon = parseCanonCast(project?.characters_md);
  const sameCharacter = (a, b) => {
    if (a === b) return true;
    for (const entry of canon) {
      if ((entry.aliases.has(a) || entry.name === a) && (entry.aliases.has(b) || entry.name === b)) return true;
    }
    return false;
  };
  const byRole = new Map();
  for (const claim of claims) {
    if (!byRole.has(claim.role)) byRole.set(claim.role, []);
    byRole.get(claim.role).push(claim);
  }
  const contradictions = [];
  for (const [role, holders] of byRole) {
    const distinct = [];
    for (const holder of holders) {
      if (!distinct.some((d) => sameCharacter(d.name, holder.name))) distinct.push(holder);
    }
    if (distinct.length > 1) {
      contradictions.push({
        role,
        holders: holders.map((h) => ({ name: h.name, field: h.field, snippet: h.snippet || '' })),
        distinctNames: distinct.map((d) => d.name),
      });
    }
  }
  return contradictions;
}

// ── Name-variant drift ──

const COMMON_CAP_WORDS = new Set([
  'The', 'A', 'An', 'And', 'But', 'Or', 'It', 'He', 'She', 'They', 'We', 'You', 'I',
  'His', 'Her', 'Their', 'Its', 'That', 'This', 'When', 'Then', 'Now', 'Here', 'There',
  'What', 'Why', 'How', 'Who', 'Not', 'No', 'Yes', 'So', 'If', 'On', 'In', 'At', 'By',
  'For', 'From', 'With', 'Was', 'Were', 'Had', 'Has', 'Did', 'Do', 'Does', 'Chapter',
  'God', 'Lord', 'Earth', 'Texas', 'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday', 'January', 'February', 'March', 'April', 'May',
  'June', 'July', 'August', 'September', 'October', 'November', 'December',
]);

function editDistanceAtMostOne(a, b) {
  if (a === b) return false;
  const la = a.length; const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0; let j = 0; let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (la === lb) { i += 1; j += 1; }
    else if (la > lb) { i += 1; }
    else { j += 1; }
  }
  edits += (la - i) + (lb - j);
  return edits === 1;
}

/**
 * Capitalized tokens in `text` that are a one-edit near-miss of exactly ONE
 * canonical name/alias. Constraints that keep this safe on real prose:
 * token length >= 5 (protects Zin/JB-class short names from ordinary words),
 * same first letter as the canonical it matches, token itself not canon and
 * not a common capitalized word. Returns [{ variant, canonical, count }].
 */
export function findNameVariants(text, canonEntries) {
  const allCanon = new Set();
  for (const entry of canonEntries || []) {
    allCanon.add(entry.name);
    for (const alias of entry.aliases) allCanon.add(alias);
  }
  const source = String(text || '');
  const counts = new Map();
  for (const m of source.matchAll(/\b([A-Z][a-z'’-]{4,})\b/g)) {
    const token = m[1];
    if (allCanon.has(token) || COMMON_CAP_WORDS.has(token)) continue;
    // An ordinary English word capitalized at sentence start ("Messy tools
    // everywhere.") is not a name variant: if the lowercase form appears
    // anywhere in the text, the token is a real word. (Same discipline as
    // PRONOUNLOCK-1's harvestCastNames.)
    if (source.includes(` ${token.toLowerCase()}`)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  const findings = [];
  for (const [token, count] of counts) {
    const matches = [...allCanon].filter((canonName) => canonName[0] === token[0] && canonName.length >= 4 && editDistanceAtMostOne(token.toLowerCase(), canonName.toLowerCase()));
    if (matches.length === 1) findings.push({ variant: token, canonical: matches[0], count });
  }
  return findings;
}

/**
 * Deterministic polish heal: replace each unambiguous name variant with its
 * canonical form. Only fires when the canonical name is well-established in
 * the text (canonical count >= 5x variant count), so a legitimately distinct
 * minor character named similarly is never clobbered.
 * Returns { text, repairs: [{variant, canonical, count}] }.
 */
export function healNameVariants(text, canonEntries) {
  let out = String(text || '');
  const repairs = [];
  for (const finding of findNameVariants(out, canonEntries)) {
    const canonCount = (out.match(new RegExp(`\\b${finding.canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length;
    if (canonCount < finding.count * 5) continue;
    out = out.replace(new RegExp(`\\b${finding.variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), finding.canonical);
    repairs.push(finding);
  }
  return { text: out, repairs };
}

/**
 * Prompt-ready canonical role line for the writer contract, from the single
 * source of truth (characters_md). Empty string when no roles are declared.
 */
export function buildRoleCanonLine(charactersMd) {
  const entries = parseCanonCast(charactersMd).filter((entry) => entry.role);
  if (!entries.length) return '';
  return entries.map((entry) => `${entry.name}: ${entry.role.replace(/\.$/, '')}`).join('; ');
}

export const CANON_ROLES_VERSION = 'canon-roles-v1';
