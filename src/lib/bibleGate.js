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

export const BIBLE_GATE_VERSION = 'bible-gate-v1';

// Role words that belong in a Role: line, never in the name field itself.
const ROLE_WORDS = new Set(['Crew', 'Rival', 'Protagonist', 'Antagonist', 'Mentor', 'Sidekick', 'Villain', 'Narrator']);

const PRONOUN_DECLARATION_RX = /\b(?:he\s*\/\s*him|she\s*\/\s*her|they\s*\/\s*them)\b/i;
const PRONOUN_VARIABLE_RX = /\bpronoun[s]?[\s:=*_-]*(?:context-?variable|variable|fluid|varies|vary)\b|\bcontext-?variable\b|\bgender[\s-]?fluid\b/i;

function escapeRx(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Walk character-sheet entry headers (same shape parseCanonCast recognizes)
 * and flag malformed ones: a role word used in place of (or alongside) the
 * name, or an entry missing a pronoun declaration.
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

  const findings = [];
  for (let i = 0; i < headers.length; i += 1) {
    const { raw, index } = headers[i];
    // Only real entries — mirrors parseCanonCast's own validity filter, so a
    // section header ("## World Building") is never mistaken for a cast entry.
    const looksLikeEntry = /[A-Z][a-z'’-]{2,}/.test(raw);
    if (!looksLikeEntry) continue;

    let malformedShape = false;
    if (raw.includes(':')) {
      const before = raw.split(':')[0].trim();
      if (ROLE_WORDS.has(before)) {
        findings.push({ header: raw, reason: `role word "${before}" used in place of the name` });
        malformedShape = true;
      }
    } else if (ROLE_WORDS.has(raw)) {
      findings.push({ header: raw, reason: `entry name is just the role word "${raw}"` });
      malformedShape = true;
    }

    const blockEnd = i + 1 < headers.length ? headers[i + 1].index : text.length;
    const block = text.slice(index, blockEnd);
    if (!PRONOUN_DECLARATION_RX.test(block) && !PRONOUN_VARIABLE_RX.test(block)) {
      findings.push({ header: raw, reason: 'missing pronoun declaration (he/him, she/her, or they/them)' });
    }
    void malformedShape; // both findings for one header are legal and independent
  }
  return findings;
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
    if (mentions >= 3) missing.push({ name, mentions });
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
