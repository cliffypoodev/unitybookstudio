// src/lib/templateFamilies.js — STYLEBUDGET-3
//
// STYLEBUDGET-1 gave the writer a per-book style ledger in the prompt.
// STYLEBUDGET-2 hard-caps similes with a verified recast. Neither one touches
// the OTHER shape the same "template family" problem produces: a fixed phrase
// (ozone, burnt sugar, a small smile, "for now") repeated across the book past
// any budget, and two chapters that open on the same image. This module is the
// enforcement side for both — closed lexical lists, deterministic detection,
// lane targets for REGENLANE-1 to regenerate-and-verify. Nothing here edits
// prose; it only detects and hands the defect to the lane.
//
// SLOP_BUDGETS in aiSlopReduction.js already tracks five of these families at
// book level for export-gate telemetry (advisory, not enforcement). Where a
// family exists in both lists, the book budgets are kept identical on purpose
// — see the acceptance battery's consistency check.

import { SLOP_BUDGETS } from './aiSlopReduction.js';

export const TEMPLATE_FAMILIES_VERSION = 'template-families-v1';

// Regex-safe literal phrases only — no wildcards, no book-specific content.
// Chapter budgets are 1 everywhere except "for now" (2), matching the per-text
// budget SLOP_BUDGETS already assigns that family. Book budgets that also
// exist in SLOP_BUDGETS are copied verbatim (checked by the battery); families
// with no SLOP_BUDGETS entry get their own book budget here.
export const TEMPLATE_FAMILIES = Object.freeze([
  { name: 'ozone', keys: ['ozone'], chapterBudget: 1, bookBudget: 3 },
  { name: 'burnt sugar', keys: ['burnt sugar'], chapterBudget: 1, bookBudget: 3 },
  {
    name: 'regret as a smell',
    keys: ['smell of regret', 'smelled of regret', 'smelt of regret', 'scent of regret', 'smells of regret', 'smelling of regret'],
    chapterBudget: 1,
    bookBudget: 3,
  },
  { name: 'small smile', keys: ['small smile'], chapterBudget: 1, bookBudget: 3 },
  { name: 'but it was real', keys: ['but it was real'], chapterBudget: 1, bookBudget: 3 },
  { name: 'for now', keys: ['for now'], chapterBudget: 2, bookBudget: 8 },
  { name: 'indifferent', keys: ['indifferent'], chapterBudget: 1, bookBudget: 5 },
  { name: 'heavy silence', keys: ['heavy silence'], chapterBudget: 1, bookBudget: 3 },
  { name: 'chest tightened', keys: ['chest tightened', 'chest tightness'], chapterBudget: 1, bookBudget: 3 },
  { name: 'heartbeat', keys: ['heartbeat'], chapterBudget: 1, bookBudget: 3 },
  { name: 'really looked', keys: ['really looked'], chapterBudget: 1, bookBudget: 3 },
  { name: 'short sharp', keys: ['short, sharp'], chapterBudget: 1, bookBudget: 3 },
  { name: 'the weight of', keys: ['the weight of', 'the sheer weight'], chapterBudget: 1, bookBudget: 3 },
]);

// Cross-check helper for the battery: every key shared with a SLOP_BUDGETS
// family (one that itself declares a bookBudget) must carry the same number.
export function findBookBudgetMismatches(families = TEMPLATE_FAMILIES, slopBudgets = SLOP_BUDGETS) {
  const slopBookBudgetByKey = new Map();
  for (const entry of (Array.isArray(slopBudgets) ? slopBudgets : [])) {
    if (typeof entry?.bookBudget !== 'number') continue;
    for (const key of (entry.keys || [])) slopBookBudgetByKey.set(key, entry.bookBudget);
  }
  const mismatches = [];
  for (const family of families) {
    for (const key of family.keys) {
      const slopBudget = slopBookBudgetByKey.get(key);
      if (typeof slopBudget === 'number' && slopBudget !== family.bookBudget) {
        mismatches.push({ key, family: family.name, templateBookBudget: family.bookBudget, slopBookBudget: slopBudget });
      }
    }
  }
  return mismatches;
}

// Sentence splitter — same abbreviation-aware shape used across this codebase
// (malformedSentence.js's splitSentences); copied rather than imported so this
// module has no dependency on a detector file that is not its concern.
function splitSentences(text) {
  return String(text || '')
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St)\./g, '$1<ABBR>')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((p) => p.replace(/<ABBR>/g, '.').trim())
    .filter(Boolean);
}

function escapeRx(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchFamilyKey(family, sentence) {
  for (const key of family.keys) {
    const rx = new RegExp('\\b' + escapeRx(key).replace(/\s+/g, '\\s+') + '\\b', 'i');
    if (rx.test(sentence)) return key;
  }
  return null;
}

/**
 * Every template-family hit in `text`, in document order — one hit per
 * (family, sentence) pair (dedupe like scanMalformedSentences does).
 * `spentByFamily[name]` is the family's occurrence count in PRIOR chapters
 * (see computeFamilyBookSpend); a family already at/over its book budget
 * flags EVERY occurrence, not just the ones past the chapter budget.
 *
 * @returns {Array<{family, key, sentence, indexInText, overChapter, overBook}>}
 */
export function findTemplateFamilyHits(text, { budgets = TEMPLATE_FAMILIES, spentByFamily = {} } = {}) {
  const t = String(text || '');
  const hits = [];
  const seen = new Set();
  const countSoFar = new Map();
  let cursor = 0;
  for (const raw of splitSentences(t)) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const indexInText = t.indexOf(s, cursor);
    cursor = indexInText >= 0 ? indexInText + s.length : cursor;
    for (const family of budgets) {
      const key = matchFamilyKey(family, s);
      if (!key) continue;
      const dedupeKey = family.name + '::' + s.slice(0, 160);
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const n = (countSoFar.get(family.name) || 0) + 1;
      countSoFar.set(family.name, n);
      const spent = Number(spentByFamily?.[family.name]) || 0;
      const overChapter = n > family.chapterBudget;
      const overBook = typeof family.bookBudget === 'number' && spent >= family.bookBudget;
      hits.push({ family: family.name, key, sentence: s, indexInText, overChapter, overBook });
    }
  }
  return hits;
}

/**
 * A family's total occurrence count across PRIOR chapters — the book-level
 * spend `findTemplateFamilyHits` compares `bookBudget` against.
 */
export function computeFamilyBookSpend(priorProse = [], budgets = TEMPLATE_FAMILIES) {
  const spent = {};
  for (const family of budgets) spent[family.name] = 0;
  for (const text of (Array.isArray(priorProse) ? priorProse : [])) {
    for (const hit of findTemplateFamilyHits(text, { budgets })) {
      spent[hit.family] = (spent[hit.family] || 0) + 1;
    }
  }
  return spent;
}

/**
 * A lane extraDetectors entry: `(text) => targets`. Book spend is computed
 * once from `priorProse` when the detector is built.
 */
export function makeTemplateFamilyDetector({ priorProse = [], budgets = TEMPLATE_FAMILIES } = {}) {
  const spentByFamily = computeFamilyBookSpend(priorProse, budgets);
  return (text) => findTemplateFamilyHits(text, { budgets, spentByFamily })
    .filter((hit) => hit.overChapter || hit.overBook)
    .map((hit) => ({
      kind: 'template-family',
      sentence: hit.sentence,
      reason: `template "${hit.key}" (chapter budget ${budgets.find((f) => f.name === hit.family)?.chapterBudget}; book spend ${spentByFamily[hit.family]}/${budgets.find((f) => f.name === hit.family)?.bookBudget ?? '—'}) — replace the template phrase with a concrete, specific detail`,
      mustNotContain: [hit.key], // REGENLANE-1C: the specific phrase, not the whole (rewritable) sentence
    }));
}

// ── F1c: precise opening-echo detection ──
//
// checkBookIntegrity (pipelineValidator.js) calls two chapter openings an
// echo when a 4-gram of chapter A's first 40 words has all four words
// ANYWHERE in chapter B's first 40 (set membership, not contiguous — a ship
// or town name mentioned in both openings' first paragraphs registers as an
// echo even when the actual phrasing never repeats). That stays as advisory
// telemetry; this is the precise rule for feeding the lane: a CONTIGUOUS
// 4-gram, with at least 2 content words (not a stopword, not a cast name),
// present verbatim in both openings.
const OPENING_STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'and', 'or', 'but', 'nor',
  'for', 'so', 'yet', 'with', 'from', 'by', 'as', 'it', 'its', 'he', 'she',
  'they', 'his', 'her', 'their', 'this', 'that', 'these', 'those', 'there',
  'was', 'were', 'is', 'are', 'be', 'been', 'being', 'had', 'has', 'have',
  'not', 'no', 'into', 'onto', 'over', 'under', 'up', 'down', 'out', 'off',
]);

const HEADING_OR_BREAK_RX = /^(?:#{1,6}\s|\*\s*\*\s*\*\s*$|-{3,}\s*$|—{3,}\s*$)/;

function firstProseParagraph(text) {
  const paras = String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of paras) {
    if (HEADING_OR_BREAK_RX.test(p)) continue;
    return p;
  }
  return '';
}

// STYLEBUDGET-3B: words with only INTERNAL apostrophes ("don't", "ottie's").
// The old /[a-z’']+/g class matched a bare apostrophe as its own token and
// swallowed a trailing/leading one into the word — a stored spacing artifact
// like a bible nickname rendered inline ("Ottilie ' Ottie' Brisa") tokenized to
// ["ottilie", "'", "ottie'", "brisa"], and neither "'" nor "ottie'" is a stopword
// or (as an exact string) a cast name, so they counted as content words and
// a cast member's own name falsely registered as a repeated "image" between
// chapters that both open on that character. Requiring a letter on both
// sides of an internal apostrophe means a bare "'" never starts a token and
// a dangling "ottie'" resolves to "ottie" — the clean, cast-recognized name.
const WORD_RX = /[a-z]+(?:[’'][a-z]+)*/g;

function tokenizeWords(text) {
  return String(text || '').toLowerCase().match(WORD_RX) || [];
}

function openingWords(text) {
  return tokenizeWords(firstProseParagraph(text)).slice(0, 40);
}

// Cast names normalized through the SAME tokenizer, plus each name's
// possessive ("ottie's" / "ottie’s") — a possessive is still the cast member,
// not a new content word, and prose may use either apostrophe character.
function normalizeCastNames(castNames) {
  const set = new Set();
  for (const raw of (Array.isArray(castNames) ? castNames : [])) {
    for (const tok of tokenizeWords(raw)) {
      set.add(tok);
      set.add(`${tok}'s`);
      set.add(`${tok}’s`);
    }
  }
  return set;
}

function contentWordCount(gram, castLower) {
  return gram.filter((w) => !OPENING_STOPWORDS.has(w) && !castLower.has(w)).length;
}

function firstSharedContiguousGram(wordsA, wordsB, castLower) {
  const bJoined = ` ${wordsB.join(' ')} `;
  for (let k = 0; k + 4 <= wordsA.length; k += 1) {
    const gram = wordsA.slice(k, k + 4);
    if (contentWordCount(gram, castLower) < 2) continue;
    if (bJoined.includes(` ${gram.join(' ')} `)) return gram.join(' ');
  }
  return null;
}

/**
 * Every opening-echo pair across a set of chapters.
 * `chapterTexts`: [{ chapterNumber, text }]. Returns [{ earlier, later, gram }].
 */
export function findOpeningEchoes(chapterTexts, { castNames = [] } = {}) {
  const castLower = normalizeCastNames(castNames);
  const chapters = (Array.isArray(chapterTexts) ? chapterTexts : [])
    .map((c) => ({ chapterNumber: c?.chapterNumber, words: openingWords(c?.text) }))
    .filter((c) => c.words.length >= 4);
  const echoes = [];
  for (let i = 0; i < chapters.length; i += 1) {
    for (let j = i + 1; j < chapters.length; j += 1) {
      const gram = firstSharedContiguousGram(chapters[i].words, chapters[j].words, castLower);
      if (gram) echoes.push({ earlier: chapters[i].chapterNumber, later: chapters[j].chapterNumber, gram });
    }
  }
  return echoes;
}

/**
 * A lane extraDetectors entry for opening echoes: targets the CURRENT text's
 * first paragraph only, against every prior chapter's opening. The earlier
 * chapter is never a target — only the later one repeats an image that was
 * already used.
 */
export function makeOpeningEchoDetector({ priorOpenings = [], castNames = [] } = {}) {
  const castLower = normalizeCastNames(castNames);
  const priors = (Array.isArray(priorOpenings) ? priorOpenings : [])
    .map((c) => ({ chapterNumber: c?.chapterNumber, words: Array.isArray(c?.words) ? c.words : openingWords(c?.text) }))
    .filter((c) => c.words.length >= 4);
  return (text) => {
    const para = firstProseParagraph(text);
    const words = openingWords(text);
    if (!para || words.length < 4) return [];
    for (const prior of priors) {
      const gram = firstSharedContiguousGram(words, prior.words, castLower);
      if (gram) {
        return [{
          kind: 'opening-echo',
          sentence: para,
          reason: `opening echoes Ch.${prior.chapterNumber}'s opening ("${gram}") — open on a different image or action`,
          mustNotContain: [gram], // REGENLANE-1C: the shared gram, not the whole (rewritable) paragraph
        }];
      }
    }
    return [];
  };
}
