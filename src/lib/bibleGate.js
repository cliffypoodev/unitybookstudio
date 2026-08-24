// src/lib/bibleGate.js — BIBLEGATE-1
//
// The bible must be complete and parseable before drafting. Two closed-world
// defects, both measured live:
//   1. A name mentioned repeatedly in the outline/beats with no matching
//      character-sheet entry — the writer improvises a character the bible
//      never described.
//   2. A malformed entry header — "**6. Crew: Lark**" — where a role word
//      landed in the name field. parseCanonCast silently recovers "Lark" as
//      the name (colon-split workaround), so the character still drafts,
//      but the role ("Crew") is lost from the header and the header itself
//      reads as broken to anyone editing the sheet by hand.
//
// Detection only — never mutates the bible. Fiction only (nonfiction casts
// are sources, not characters, and have no pronoun-declaration convention).

import { harvestCastNames } from './pronounLock.js';
import { parseCanonCast } from './canonRoles.js';

export const BIBLE_GATE_VERSION = 'bible-gate-v2'; // BIBLEGATE-1B

// Role words that belong in a Role: line, never in the name field itself.
const ROLE_WORDS = new Set(['Crew', 'Rival', 'Protagonist', 'Antagonist', 'Mentor', 'Sidekick', 'Villain', 'Narrator']);

const PRONOUN_DECLARATION_RX = /\b(?:he\s*\/\s*him|she\s*\/\s*her|they\s*\/\s*them)\b/i;
const PRONOUN_VARIABLE_RX = /\bpronoun[s]?[\s:=*_-]*(?:context-?variable|variable|fluid|varies|vary)\b|\bcontext-?variable\b|\bgender[\s-]?fluid\b/i;

function escapeRx(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Walk character-sheet entry headers and flag malformed ones. BIBLEGATE-1B
 * (live proof on REDUX, 2026-08-24): the app's own foundation generator
 * writes entries as "**N. Role: Name**" ("**1. Protagonist: Zinnia 'Zin'
 * Quark**") — parseCanonCast's colon-split already recovers "Zinnia" as the
 * name there, so that shape is legitimate, not the "**6. Crew: Lark**" bug.
 * The real bug is when parseCanonCast has NO name to recover at all and
 * falls back to the role word itself (a header with no colon, just the role
 * label — "**6. Crew**"). Malformed-header detection now asks parseCanonCast
 * what it actually extracted, instead of pattern-matching the raw header
 * text, which flagged every correctly-formed "Role: Name" entry as broken.
 * Only headers parseCanonCast recognizes as entries are audited for a
 * pronoun declaration — a markdown section heading ("### Major Characters")
 * is never mistaken for a cast entry.
 * Returns [{ header, reason }].
 */
function auditHeaders(charactersMd) {
  const text = String(charactersMd || '');
  const headerRx = /^\s{0,3}(?:#{1,4}\s+|(?:\*\*)?\d+\.\s+)(.+)$/gm;
  const headers = [];
  let match;
  while ((match = headerRx.exec(text)) !== null) {
    headers.push({ index: match.index, raw: match[1].replace(/\*\*/g, '').trim() });
  }

  const entries = parseCanonCast(text);
  const findings = [];
  for (let i = 0; i < headers.length; i += 1) {
    const { raw, index } = headers[i];
    const entry = entries.find((e) => raw.includes(e.name) || [...(e.aliases || [])].some((a) => raw.includes(a)));
    if (!entry) continue; // parseCanonCast doesn't see this as a cast entry either — a section heading, not a bug

    if (ROLE_WORDS.has(entry.name)) {
      findings.push({ header: raw, reason: `role word "${entry.name}" used in place of the name` });
    }

    const blockEnd = i + 1 < headers.length ? headers[i + 1].index : text.length;
    const block = text.slice(index, blockEnd);
    if (!PRONOUN_DECLARATION_RX.test(block) && !PRONOUN_VARIABLE_RX.test(block)) {
      findings.push({ header: raw, reason: 'missing pronoun declaration (he/him, she/her, or they/them)' });
    }
  }
  return findings;
}

// BIBLEGATE-1B: three non-person filters for the "missing" candidate list,
// each measured against a real live-proof false positive.

// "Gaudy Galactie" (a ship name), "Elm Fork" (a town) — a token that is
// ALWAYS immediately adjacent to another capitalized token is one half of a
// compound proper noun, not a standalone person.
function isCompoundProperNoun(corpus, name) {
  const rx = new RegExp(`\\b${escapeRx(name)}\\b`, 'g');
  let m;
  let total = 0;
  let adjacent = 0;
  while ((m = rx.exec(corpus)) !== null) {
    total += 1;
    const before = corpus.slice(Math.max(0, m.index - 20), m.index);
    const after = corpus.slice(m.index + name.length, m.index + name.length + 20);
    if (/[A-Z][a-z'’-]{1,}\s*$/.test(before) || /^\s*[A-Z][a-z'’-]{1,}/.test(after)) adjacent += 1;
  }
  return total > 0 && adjacent === total;
}

// "Shakespeare" from a chapter title "## Chapter 10: Sadie's Shakespeare
// Moment" — a token whose every mention sits on a chapter/section title line
// is a title word, not a person the outline actually put on the page.
function isTitleOnlyMention(lines, name) {
  const rx = new RegExp(`\\b${escapeRx(name)}\\b`);
  const titleRx = /^\s{0,3}#{1,4}\s|\bChapter\s+\d+\b/i;
  const matchingLines = lines.filter((l) => rx.test(l));
  return matchingLines.length > 0 && matchingLines.every((l) => titleRx.test(l));
}

// A token preceded by "the" in most of its mentions reads as a common or
// place noun ("the Fork", "the harbor"), not a name.
function isPrecededByThe(corpus, name) {
  const rx = new RegExp(`\\b${escapeRx(name)}\\b`, 'g');
  let m;
  let total = 0;
  let precededByThe = 0;
  while ((m = rx.exec(corpus)) !== null) {
    total += 1;
    if (/\bthe\s+$/i.test(corpus.slice(Math.max(0, m.index - 5), m.index))) precededByThe += 1;
  }
  return total > 0 && precededByThe / total >= 0.5;
}

/**
 * A name mentioned >= 3 times across the outline + beat summaries with no
 * matching character-sheet entry (via the same alias resolution
 * parseCanonCast uses, so a nickname-only header still counts as present).
 * Returns [{ name, mentions }].
 */
function auditMissingNames(charactersMd, proseTexts) {
  const texts = (Array.isArray(proseTexts) ? proseTexts : []).map((t) => String(t || '')).filter(Boolean);
  if (!texts.length) return [];
  const corpus = texts.join('\n');
  const lines = corpus.split('\n');

  // Low proseMin so a name mentioned only 3-11 times still surfaces as a
  // candidate — harvestCastNames' default (12) is tuned for prompt cast
  // rosters, not a completeness audit.
  const candidates = harvestCastNames(charactersMd, texts, { proseMin: 3 });

  const entries = parseCanonCast(charactersMd);
  const hasEntry = (name) => entries.some((e) => e.name === name || e.aliases?.has(name));

  const missing = [];
  for (const name of candidates) {
    if (hasEntry(name)) continue;
    const mentions = (corpus.match(new RegExp(`\\b${escapeRx(name)}\\b`, 'g')) || []).length;
    if (mentions < 3) continue;
    // BIBLEGATE-1B: skip compound proper nouns, title-only words, and
    // "the X" common/place nouns — none of these are a person the bible is
    // missing an entry for.
    if (isCompoundProperNoun(corpus, name)) continue;
    if (isTitleOnlyMention(lines, name)) continue;
    if (isPrecededByThe(corpus, name)) continue;
    missing.push({ name, mentions });
  }
  return missing.sort((a, b) => b.mentions - a.mentions);
}

/**
 * Audit a project's character bible for completeness before drafting.
 *
 * @param {object} opts
 * @param {object} opts.project - reads characters_md, outline_md
 * @param {Array} [opts.chapters] - reads each chapter's beat_summary
 * @returns {{ ok: boolean, missing: Array<{name, mentions}>, malformedHeaders: Array<{header, reason}> }}
 */
export function auditBibleCompleteness({ project = null, chapters = [] } = {}) {
  const charactersMd = project?.characters_md || '';
  const proseTexts = [
    project?.outline_md || '',
    ...(Array.isArray(chapters) ? chapters : []).map((c) => String(c?.beat_summary || '')),
  ];

  const missing = auditMissingNames(charactersMd, proseTexts);
  const malformedHeaders = auditHeaders(charactersMd);
  const ok = missing.length === 0 && malformedHeaders.length === 0;

  console.log(`[BIBLEGATE] missing=${missing.length}, malformedHeaders=${malformedHeaders.length}, ok=${ok}`);
  return { ok, missing, malformedHeaders };
}
