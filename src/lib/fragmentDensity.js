// src/lib/fragmentDensity.js — FRAGBUDGET-1
//
// "Fragment syndrome" — short, verbless noun-phrase sentences stacked for
// effect ("Dov, stoic and dusty. A long corridor of rust and silence.") — is
// one of the AI-slop shapes STYLEBUDGET-1's ledger doesn't touch: it isn't a
// banned word or a simile, it's a sentence SHAPE. This module detects it
// deterministically and hands over-budget paragraphs to REGENLANE-1; it
// never edits prose itself.
//
// There is no POS tagger in this codebase (retext-english only). Precision
// over recall throughout: a real fragment that slips past undetected is
// fine, a real complete sentence wrongly flagged is not — so "finite-verb
// evidence" is deliberately generous (an -ed word, a clitic, even a bare
// possessive-looking 's all count as evidence a sentence has a verb).

import { stripDialogue } from './povTense.js';

export const FRAGMENT_DENSITY_VERSION = 'fragment-density-v1';
export const FRAGMENT_DENSITY_BUDGET_PER_1K = 20;

// Sentence splitter — same abbreviation-aware shape used across this
// codebase (malformedSentence.js's splitSentences); copied rather than
// imported so this module has no dependency on a detector file that is not
// its concern (the plan is explicit: reuse the regex, don't invent a third
// splitter, and don't couple two independent detector modules together).
function splitSentences(text) {
  return String(text || '')
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St)\./g, '$1<ABBR>')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((p) => p.replace(/<ABBR>/g, '.').trim())
    .filter(Boolean);
}

const FINITE_VERB_AUX_MODAL = [
  'was', 'were', 'is', 'are', 'am', 'be', 'been', 'being', 'had', 'has', 'have',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall',
];

// ~120 common irregular past-tense forms — the copula/aux list above and the
// -ed suffix rule miss these entirely ("She stood there." has a finite verb
// with no "-ed" and no auxiliary).
const IRREGULAR_PAST = [
  'went', 'came', 'said', 'took', 'saw', 'stood', 'sat', 'looked', 'felt', 'knew', 'thought',
  'made', 'got', 'gave', 'ran', 'held', 'left', 'kept', 'put', 'told', 'found', 'heard',
  'began', 'brought', 'fell', 'turned', 'let', 'met', 'meant', 'led', 'lost', 'paid', 'read',
  'set', 'shook', 'spoke', 'struck', 'swung', 'threw', 'understood', 'woke', 'wore', 'won',
  'wrote', 'drew', 'drove', 'ate', 'bit', 'blew', 'broke', 'built', 'caught', 'chose', 'cut',
  'dealt', 'dug', 'drank', 'flew', 'forgot', 'froze', 'grew', 'hung', 'hid', 'hit', 'hurt',
  'lay', 'rose', 'sent', 'sang', 'sank', 'slid', 'slept', 'sold', 'spent', 'split', 'spun',
  'stole', 'stuck', 'swept', 'taught', 'tore', 'bought', 'became', 'bent', 'bound', 'bled',
  'fed', 'fought', 'fled', 'flung', 'clung', 'crept', 'slung', 'strode', 'shot', 'shut',
  'sought', 'sped', 'spat', 'stung', 'swore', 'leapt', 'lit', 'knelt', 'dreamt', 'ground',
  'wound', 'rang', 'sprang', 'stank', 'swam',
];

const FINITE_VERB_WORD_RX = new RegExp('\\b(?:' + [...FINITE_VERB_AUX_MODAL, ...IRREGULAR_PAST].join('|') + ')\\b', 'i');

// Finite-verb evidence, in one exported regex: the closed word list above, OR
// an n't contraction (didn't, wasn't, couldn't …), OR an 's/'d/'ll/'re/'ve
// clitic, OR any word ending in "-ed" of >= 4 letters total.
export const FINITE_VERB_EVIDENCE_RX = new RegExp(
  FINITE_VERB_WORD_RX.source
  + "|\\w+n['’]t\\b"
  + "|\\w+['’](?:s|d|ll|re|ve)\\b"
  + '|\\b[A-Za-z]{2,}ed\\b',
  'i'
);

// A paragraph that is only a scene-break marker or a markdown heading — not
// narration, never scanned.
const SCENE_BREAK_OR_HEADING_RX = /^(?:#{1,6}\s|[\s*—–-]+)$/;

// "Mara." / "Ilse" / "3:47 a.m." — a line that carries no prose content at
// all, not a real sentence to judge either way.
const NAME_OR_TIMESTAMP_RX = /^[A-Z][a-z’']+\.?$|^\d{1,2}:\d{2}\s*(?:[AaPp]\.?[Mm]\.?)?\.?$/;

function wordCountOf(text) {
  const t = String(text || '').trim();
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
}

/**
 * Fragments in `text`: narration-only (dialogue stripped) sentences of 3–25
 * words with no finite-verb evidence. Returns [{ sentence, paragraphIndex }]
 * in document order; `paragraphIndex` is the `\n{2,}`-delimited paragraph
 * the sentence came from.
 */
export function findFragments(text) {
  const fragments = [];
  const paragraphs = String(text || '').split(/\n{2,}/);
  paragraphs.forEach((rawPara, paragraphIndex) => {
    const para = rawPara.trim();
    if (!para || SCENE_BREAK_OR_HEADING_RX.test(para)) return;
    const narration = stripDialogue(para);
    for (const raw of splitSentences(narration)) {
      const s = raw.trim();
      if (!s || NAME_OR_TIMESTAMP_RX.test(s)) continue;
      const words = s.split(/\s+/).filter(Boolean);
      if (words.length < 3 || words.length > 25) continue;
      if (FINITE_VERB_EVIDENCE_RX.test(s)) continue;
      fragments.push({ sentence: s, paragraphIndex });
    }
  });
  return fragments;
}

/** `{ fragments, wordCount, per1k }` — density per 1000 words of the WHOLE text (narration + dialogue). */
export function measureFragmentDensity(text) {
  const wordCount = wordCountOf(text);
  const fragments = findFragments(text).length;
  const per1k = wordCount > 0 ? Math.round((fragments / wordCount) * 1000 * 10) / 10 : 0;
  return { fragments, wordCount, per1k };
}

/**
 * A lane extraDetectors entry: `(text) => targets`. Only produces targets
 * when the WHOLE text is over budget; targets are the densest paragraphs
 * (>= 2 fragments each), capped at `maxTargets`. Called with a single
 * candidate paragraph (the lane's rescan), the same rule applies to that
 * paragraph alone — flagged again only if it is itself over budget and
 * still carries >= 2 fragments.
 */
export function makeFragmentDensityDetector({ budgetPer1k = FRAGMENT_DENSITY_BUDGET_PER_1K, maxTargets = 6 } = {}) {
  return (text) => {
    const density = measureFragmentDensity(text);
    if (density.per1k <= budgetPer1k) return [];
    const byParagraph = new Map();
    for (const f of findFragments(text)) {
      if (!byParagraph.has(f.paragraphIndex)) byParagraph.set(f.paragraphIndex, []);
      byParagraph.get(f.paragraphIndex).push(f);
    }
    const densest = [...byParagraph.values()]
      .filter((list) => list.length >= 2)
      .sort((a, b) => b.length - a.length)
      .slice(0, maxTargets);
    return densest.map((list) => ({
      kind: 'fragment-density',
      sentence: list[0].sentence,
      reason: `fragment density ${density.per1k}/1k over budget ${budgetPer1k} — rewrite the fragments in this paragraph as complete sentences, keep the rhythm`,
    }));
  };
}
