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

import { harvestCastNames, leadingCastName } from './pronounLock.js';
import { parseCanonCast } from './canonRoles.js';
import { splitSentencesForDedupe, normalizeSentenceForDedupe } from './crossChapterDedupe.js';

export const BIBLE_GATE_VERSION = 'bible-gate-v3'; // BIBLEGATE-1C

// Role words that belong in a Role: line, never in the name field itself.
const ROLE_WORDS = new Set(['Crew', 'Rival', 'Protagonist', 'Antagonist', 'Mentor', 'Sidekick', 'Villain', 'Narrator']);

// BIBLEGATE-1C (live proof Run 2, 2026-08-24): a ship AI, a robot, an animal,
// a haunted object — any non-human cast member — declares it/its. The header
// rule must accept it, same as any other pronoun set.
const PRONOUN_DECLARATION_RX = /\b(?:he\s*\/\s*him|she\s*\/\s*her|they\s*\/\s*them|it\s*\/\s*its)\b/i;
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
      findings.push({ header: raw, reason: 'missing pronoun declaration (he/him, she/her, they/them, or it/its)' });
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

// Dialogue/action verbs that put the PRECEDING token in an actor position
// ("Ilse said", "Mara insisted", "Dov turned"). Deliberately curated and
// narrow rather than a suffix heuristic: an infinitive purpose clause
// ("Sadie quotes Shakespeare to negotiate…") must NOT count — "to negotiate"
// sits within 2 tokens of "Shakespeare" but describes Sadie's action, not
// Shakespeare's, so a loose -ed/-s suffix match would wrongly save it.
const ACTOR_VERBS = new Set([
  'said', 'says', 'saying', 'asked', 'asks', 'ask', 'replied', 'replies', 'reply',
  'answered', 'answers', 'answer', 'shouted', 'shouts', 'shout', 'whispered', 'whispers', 'whisper',
  'murmured', 'murmurs', 'murmur', 'muttered', 'mutters', 'mutter', 'called', 'calls', 'call',
  'cried', 'cries', 'cry', 'declared', 'declares', 'declare', 'stated', 'states', 'state',
  'remarked', 'remarks', 'remark', 'insisted', 'insists', 'insist', 'warned', 'warns', 'warn',
  'explained', 'explains', 'explain', 'argued', 'argues', 'argue', 'spoke', 'speaks', 'speak',
  'nodded', 'nods', 'nod', 'sighed', 'sighs', 'sigh', 'laughed', 'laughs', 'laugh',
  'smiled', 'smiles', 'smile', 'frowned', 'frowns', 'frown', 'shrugged', 'shrugs', 'shrug',
  'turned', 'turns', 'turn', 'looked', 'looks', 'look', 'glanced', 'glances', 'glance',
  'stared', 'stares', 'stare', 'reached', 'reaches', 'reach', 'grabbed', 'grabs', 'grab',
  'walked', 'walks', 'walk', 'ran', 'runs', 'run', 'stood', 'stands', 'stand',
  'paused', 'pauses', 'pause', 'hesitated', 'hesitates', 'hesitate', 'repeated', 'repeats', 'repeat',
  'continued', 'continues', 'continue', 'added', 'adds', 'add', 'crackled', 'crackles', 'crackle',
]);

// BIBLEGATE-1C (live proof Run 2, 2026-08-24): "Shakespeare" (a chapter
// title's quoted author — "Sadie's Shakespeare Moment", "Sadie quotes
// Shakespeare to negotiate…") survived BIBLEGATE-1B's title-only filter
// because two of its three mentions are body lines. A person the bible must
// know about ACTS at least once on the page: sentence-initial (reusing
// leadingCastName — the same closed-world sentence-lead rule SUBJECTGUARD-2's
// establishedActor() is built on, here run with a candidate pool of one
// name), or followed within 2 tokens by a verb-like word/"said", or set off
// by commas as a direct address ("Wait, Ilse, look out"). A candidate that
// never acts is quoted, cited, or named in passing — an author, a brand, a
// place — not a person on the page.
function isNeverActor(dedupedSentences, name) {
  const mentionRx = new RegExp(`\\b${escapeRx(name)}\\b`);
  const afterRx = new RegExp(`\\b${escapeRx(name)}\\b([\\s\\S]{0,40})`);
  const vocativeRx = new RegExp(`,\\s*${escapeRx(name)}\\s*,`);
  for (const sentence of dedupedSentences) {
    if (!mentionRx.test(sentence)) continue;
    if (leadingCastName(sentence, [name]) === name) return false;
    if (vocativeRx.test(sentence)) return false;
    const m = sentence.match(afterRx);
    if (m) {
      const tokens = m[1].trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (tokens.some((t) => ACTOR_VERBS.has(t.replace(/[^a-zA-Z]/g, '').toLowerCase()))) return false;
    }
  }
  return true;
}

// BIBLEGATE-1C: Ch.10's beat_summary duplicated its outline line verbatim,
// double-counting one sentence's mentions. Dedupe identical sentences across
// ALL prose sources before counting — a weaker fix than the actor filter
// above (a name split across genuinely distinct non-actor sentences still
// needs it), but a real defect in its own right.
function dedupeSentences(texts) {
  const seen = new Set();
  const out = [];
  for (const text of texts) {
    for (const raw of splitSentencesForDedupe(text)) {
      const norm = normalizeSentenceForDedupe(raw).toLowerCase();
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      out.push(raw);
    }
  }
  return out;
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
  const dedupedSentences = dedupeSentences(texts);
  const dedupedCorpus = dedupedSentences.join('\n');

  // Low proseMin so a name mentioned only 3-11 times still surfaces as a
  // candidate — harvestCastNames' default (12) is tuned for prompt cast
  // rosters, not a completeness audit.
  const candidates = harvestCastNames(charactersMd, texts, { proseMin: 3 });

  const entries = parseCanonCast(charactersMd);
  const hasEntry = (name) => entries.some((e) => e.name === name || e.aliases?.has(name));

  const missing = [];
  for (const name of candidates) {
    if (hasEntry(name)) continue;
    const mentions = (dedupedCorpus.match(new RegExp(`\\b${escapeRx(name)}\\b`, 'g')) || []).length;
    if (mentions < 3) continue;
    // BIBLEGATE-1B: skip compound proper nouns, title-only words, and
    // "the X" common/place nouns — none of these are a person the bible is
    // missing an entry for.
    if (isCompoundProperNoun(corpus, name)) continue;
    if (isTitleOnlyMention(lines, name)) continue;
    if (isPrecededByThe(corpus, name)) continue;
    // BIBLEGATE-1C: skip a candidate that never acts — quoted, cited, or
    // possessive mentions only.
    if (isNeverActor(dedupedSentences, name)) continue;
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
