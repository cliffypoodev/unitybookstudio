/**
 * anthologyRenamePass.js
 *
 * RENAMEPASS-1 — deterministic cross-story name de-collision for anthologies.
 *
 * USEDNAMES-1 bans every other story's character names in the prompt, but the prose model can
 * defy the ban on its strongest associations (measured live: a Latino janitor's wife -> "Maria",
 * even with "Maria" explicitly banned in that story's prompt). This runs on the FINISHED prose:
 * any name that belongs to a DIFFERENT story in the collection — never this story's own — is
 * renamed to a fresh name used by no story, consistently across every occurrence, with the
 * replacement's gender preserved from the pronouns around the original. Pure and deterministic:
 * same inputs -> same output, no randomness, no LLM call. Node-safe (no bundler-only imports).
 */

// AI-favorite default names (mirrors the BANNED list in autonovel.js) — never use as replacements.
const AI_DEFAULTS = new Set([
  'Elara', 'Kaelen', 'Kael', 'Lyra', 'Arden', 'Sienna', 'Seraphina', 'Thorne', 'Astra', 'Zara',
  'Rowan', 'Caelum', 'Isolde', 'Orion', 'Vesper', 'Elowen', 'Caspian', 'Liora', 'Alaric', 'Sable',
]);

// Names that are also common English words — too risky to whole-word-rename, so we skip them as
// collision targets (renaming "Grace"/"Dawn"/"Hope" could corrupt ordinary prose).
const COMMON_WORD_NAMES = new Set([
  'May', 'June', 'April', 'Dawn', 'Hope', 'Grace', 'Rose', 'Faith', 'Joy', 'Summer', 'Autumn',
  'Sunny', 'Art', 'Mark', 'Will', 'Rich', 'Bill', 'Guy', 'Sue', 'Norm', 'Amber', 'Crystal',
]);

// Replacement pools — distinctive, not AI-defaults, not common-word names.
const FEMALE_POOL = [
  'Delphine', 'Rosalind', 'Imelda', 'Corinne', 'Yolanda', 'Priya', 'Fatima', 'Ingrid',
  'Bernadette', 'Odette', 'Marisol', 'Constance', 'Leona', 'Vivienne', 'Harriet', 'Cordelia',
];
const MALE_POOL = [
  'Ezekiel', 'Desmond', 'Ignacio', 'Bartholomew', 'Reginald', 'Amir', 'Tobias', 'Cornelius',
  'Emmanuel', 'Horace', 'Rodrigo', 'Percival', 'Lionel', 'Everett', 'Mordecai', 'Ambrose',
];
const NEUTRAL_POOL = [
  'Emerson', 'Quillon', 'Sterling', 'Ellery', 'Sutton', 'Lennox', 'Sidney', 'Kingsley',
  'Quincy', 'Adair', 'Wynn', 'Blair',
];

function nameTokens(value) {
  return String(value || '').match(/[A-Z][a-z]{2,}/g) || [];
}

// NAMEREG-1: names a chapter's PROSE actually used, persisted on the record at save time
// (prose_names). Concept names (beat_summary) miss two measured leak classes — proven live
// 2026-08-13 on an erotica anthology: (a) a side character the prose model invented in two
// different stories ("Julian" heavy in ch1 AND ch3 — never in any plan), and (b) a rename
// TARGET this pass itself introduced in one story reappearing organically in a later story
// ("Sidney": ch1's replacement for a collided name, then ch4's prose used Sidney fresh).
function chapterProseNames(ch) {
  const raw = ch?.prose_names;
  if (Array.isArray(raw)) return raw.flatMap(nameTokens);
  if (typeof raw === 'string' && raw.trim()) {
    try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr.flatMap(nameTokens) : []; } catch { return []; }
  }
  return [];
}

// NAMEREG-2: a capitalized token that only ever OPENS a sentence ("Better.",
// "Nothing.", "Maybe") never appears lowercase either, so it used to survive
// the lowercase-elimination check below and register as a "name" (live: the
// "Better"-style extractor false positive). Require at least one occurrence
// that is NOT sentence-initial — a real name appears as a mid-sentence
// subject/object constantly; a sentence adverb or interjection never does.
function isSentenceInitialOccurrence(text, index) {
  if (index <= 0) return true;
  const before = text.slice(Math.max(0, index - 6), index);
  if (/[.!?…]\s*$/.test(before)) return true; // after terminal punctuation
  if (/\n\s*$/.test(before)) return true; // paragraph/line start
  if (/["'‘“]\s*$/.test(before)) return true; // after an opening quote
  return false;
}

function hasMidSentenceOccurrence(text, token) {
  const rx = new RegExp(`\\b${token}\\b`, 'g');
  let m;
  while ((m = rx.exec(text))) {
    if (!isSentenceInitialOccurrence(text, m.index)) return true;
  }
  return false;
}

// NAMEREG-1: deterministic prominent-name extraction from finished prose. A capitalized
// token counts as a prose name when it appears at least `minCount` times (side characters
// mentioned once don't register; recurring cast does). COMMON_WORD_NAMES filtered.
export function extractProminentProseNames(prose, { minCount = 3, maxNames = 16 } = {}) {
  const text = String(prose || '');
  if (!text) return [];
  const counts = new Map();
  for (const tok of text.match(/[A-Z][a-z]{2,}/g) || []) {
    if (COMMON_WORD_NAMES.has(tok)) continue;
    counts.set(tok, (counts.get(tok) || 0) + 1);
  }
  // A capitalized token that also appears lowercase in the same prose is a common word
  // caught at sentence starts ("The", "She", "Storm raged" vs "the storm"), not a name.
  for (const tok of [...counts.keys()]) {
    if (new RegExp(`\\b${tok.toLowerCase()}\\b`).test(text)) counts.delete(tok);
  }
  // NAMEREG-2: a token that only ever opens a sentence is not a name either.
  for (const tok of [...counts.keys()]) {
    if (!hasMidSentenceOccurrence(text, tok)) counts.delete(tok);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, maxNames)
    .map(([name]) => name);
}

function chapterNames(ch) {
  let sd = null;
  try { sd = JSON.parse(ch?.beat_summary || ''); } catch { sd = null; }
  const out = [];
  if (sd && typeof sd === 'object') {
    const p = sd.protagonist;
    out.push(typeof p === 'string' ? p : (p && p.name) || '');
    if (Array.isArray(sd.characters)) sd.characters.forEach((c) => out.push(typeof c === 'string' ? c : (c && c.name) || ''));
    if (Array.isArray(sd.cast)) sd.cast.forEach((c) => out.push(typeof c === 'string' ? c : (c && c.name) || ''));
  }
  return [...out.flatMap(nameTokens), ...chapterProseNames(ch)]; // NAMEREG-1
}

/**
 * Split the collection's names into this story's OWN names and every OTHER story's names.
 * Own names are never candidates for renaming.
 */
export function collectAnthologyNames(chapter, chapters) {
  const curN = Number(chapter?.chapter_number || chapter?.number || 0);
  const own = new Set(chapterNames(chapter));
  const others = new Set();
  (Array.isArray(chapters) ? chapters : []).forEach((ch) => {
    const n = Number(ch?.chapter_number || ch?.number || 0);
    if (!n || n === curN) return;
    chapterNames(ch).forEach((t) => others.add(t));
  });
  own.forEach((o) => others.delete(o));
  return { own, others };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Conservative gender inference: pick a gendered replacement pool ONLY when the pronouns around
// the name are unambiguous (one gender present, the other absent). Mixed/absent -> neutral pool,
// so we never misgender when a male protagonist's pronouns sit near "his wife <Name>".
function guessGender(text, name) {
  let f = 0; let m = 0;
  const re = new RegExp(`\\b${name}\\b`, 'g');
  let mch;
  while ((mch = re.exec(text)) !== null) {
    const w = text.slice(Math.max(0, mch.index - 50), mch.index + name.length + 50);
    f += (w.match(/\b(she|her|hers|herself)\b/gi) || []).length;
    m += (w.match(/\b(he|his|him|himself)\b/gi) || []).length;
    if (mch.index === re.lastIndex) re.lastIndex += 1;
  }
  if (f > 0 && m === 0) return 'f';
  if (m > 0 && f === 0) return 'm';
  return 'n';
}

function pickReplacement(pool, seed, name, used, working) {
  const h = hashStr(`${seed}:${name}`);
  for (let i = 0; i < pool.length; i += 1) {
    const cand = pool[(h + i) % pool.length];
    if (used.has(cand)) continue;
    if (new RegExp(`\\b${cand}\\b`).test(working)) continue; // don't introduce a name already in this prose
    return cand;
  }
  return null;
}

/**
 * Rename every other-story name that appears in this story's finished prose. Returns the rewritten
 * prose plus the list of {from, to, count} renames applied. No-op for non-collisions.
 */
export function applyAnthologyNameRenames(prose, chapter, chapters) {
  const text = String(prose || '');
  if (!text) return { prose: text, renames: [] };

  const { own, others } = collectAnthologyNames(chapter, chapters);
  const seed = Number(chapter?.chapter_number || chapter?.number || 1) || 1;

  const present = [...others]
    .filter((nm) => nm.length >= 3 && !own.has(nm) && !COMMON_WORD_NAMES.has(nm) && new RegExp(`\\b${nm}\\b`).test(text))
    .sort(); // deterministic processing order

  if (!present.length) return { prose: text, renames: [] };

  const used = new Set([...own, ...others, ...AI_DEFAULTS]);
  const renames = [];
  let working = text;

  for (const nm of present) {
    const gender = guessGender(working, nm);
    const primary = gender === 'm' ? MALE_POOL : gender === 'f' ? FEMALE_POOL : NEUTRAL_POOL;
    const repl =
      pickReplacement(primary, seed, nm, used, working) ||
      pickReplacement([...FEMALE_POOL, ...MALE_POOL, ...NEUTRAL_POOL], seed, nm, used, working);
    if (!repl) continue;
    used.add(repl);
    const re = new RegExp(`\\b${nm}\\b`, 'g');
    const count = (working.match(re) || []).length;
    working = working.replace(re, repl);
    renames.push({ from: nm, to: repl, count });
  }

  return { prose: working, renames };
}
