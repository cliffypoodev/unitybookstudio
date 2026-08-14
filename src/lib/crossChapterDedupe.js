// src/lib/crossChapterDedupe.js — CROSSDEDUPE-1
//
// Cross-chapter verbatim duplicate sentences: detection (shared with the
// export gate's BOOKGATE-3 hard block) and repair (polish-lane heal).
//
// The failure mode (measured on a live 80k-word draft): the writer emits the
// same 12+-word sentence in two chapters ("She thought of the quiet of the
// desert, the way the stars looked from the mesa." verbatim in ch.16 and
// ch.17). Nothing in the pipeline fixed them — the export gate detected and
// hard-blocked, and the author was left to hand-edit. This module closes the
// loop: the polish pipeline recasts the LATER occurrence through one
// deterministically-verified LLM call per duplicate, sequential (one LLM call
// at a time — HARD RULE), and fails open to a loud report when the recast
// cannot be verified. The gate and the healer share ONE detector, so what the
// gate blocks is exactly what the healer hunts.
//
// No book specifics live here. Everything is derived from the manuscript.

import { stripModelControlTokens } from './modelLeakGuard.js';

// BOOKGATE-3's rule, single-sourced: exact 12+-word sentences repeated across
// chapters are duplicated text a reader will catch.
export const CROSS_DUPE_MIN_WORDS = 12;

// Lazy import of the local-LLM caller, same pattern as llmProsePolisher —
// keeps this module importable in Node tests without Vite's @/ alias.
let _callAgent = null;
async function getCallAgent() {
  if (!_callAgent) {
    const mod = await import(/* @vite-ignore */ '@/lib/localLLM');
    _callAgent = mod.callAgent;
  }
  return _callAgent;
}

export function splitSentencesForDedupe(text) {
  return String(text || '').split(/(?<=[.!?…”])\s+/);
}

export function normalizeSentenceForDedupe(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * Find verbatim 12+-word sentences appearing in more than one chapter.
 *
 * @param {Array<{chapterNumber: number|string, text: string}>} chapters
 * @returns {Array<{a, b, sentence, norm}>} one entry per (first, later) pair;
 *   `b` is always the LATER chapter (the one the healer edits), `sentence` is
 *   the raw sentence as it appears (norm is the whitespace-normalized form).
 */
export function findCrossChapterDuplicateSentences(chapters = []) {
  const seen = new Map(); // norm -> chapterNumber of first sighting
  const dupes = [];
  for (const ch of chapters) {
    const num = ch?.chapterNumber;
    for (const s of splitSentencesForDedupe(ch?.text || '')) {
      const norm = normalizeSentenceForDedupe(s);
      if (norm.split(' ').length < CROSS_DUPE_MIN_WORDS) continue;
      const first = seen.get(norm);
      if (first === undefined) seen.set(norm, num);
      else if (first !== num) dupes.push({ a: first, b: num, sentence: s.trim(), norm });
    }
  }
  return dupes;
}

/**
 * Deterministic verification of a recast sentence. The recast ships ONLY if
 * every check passes — otherwise the duplicate stays and is reported.
 *
 * Closed-world discipline: the recast may not introduce a capitalized token
 * that does not already appear somewhere in the chapter it lands in (no new
 * characters, places, or objects smuggled in by the model).
 */
export function verifyRecastSentence(originalSentence, recast, { chapterText = '', bookNorms = null } = {}) {
  const orig = String(originalSentence || '').trim();
  const cand = String(recast || '').trim();
  if (!cand) return { ok: false, reason: 'empty' };
  if (/\n/.test(cand)) return { ok: false, reason: 'multiline' };

  const candNorm = normalizeSentenceForDedupe(cand);
  const origNorm = normalizeSentenceForDedupe(orig);
  if (candNorm === origNorm) return { ok: false, reason: 'unchanged' };

  // Single sentence with terminal punctuation (a trailing ” is legal when the
  // original ended inside dialogue).
  if (!/[.!?…](?:”)?$/.test(cand)) return { ok: false, reason: 'no-terminal-punctuation' };
  const innerTerminals = (cand.slice(0, -2).match(/[.!?]\s+[A-Z“]/g) || []).length;
  if (innerTerminals > 0) return { ok: false, reason: 'multiple-sentences' };

  // Quote framing must match the original: dialogue stays dialogue, narration
  // stays narration.
  if (/^[“"]/.test(orig) !== /^[“"]/.test(cand)) return { ok: false, reason: 'quote-framing-start' };
  if (/[”"]$/.test(orig) !== /[”"]$/.test(cand)) return { ok: false, reason: 'quote-framing-end' };

  // Length envelope: same order of magnitude as the original.
  const origWords = origNorm.split(' ').length;
  const candWords = candNorm.split(' ').length;
  if (candWords < Math.max(4, Math.floor(origWords * 0.4))) return { ok: false, reason: 'too-short' };
  if (candWords > Math.ceil(origWords * 2)) return { ok: false, reason: 'too-long' };

  // The recast must not itself be (or become) a 12+-word verbatim duplicate of
  // anything already in the book.
  if (bookNorms && candWords >= CROSS_DUPE_MIN_WORDS && bookNorms.has(candNorm)) {
    return { ok: false, reason: 'recast-is-also-a-duplicate' };
  }

  // Closed world: no NEW capitalized tokens. Sentence-initial words are
  // exempt (any word can open a sentence).
  const capTokens = (s) => (s.match(/\b[A-Z][a-z]+(?:’s)?\b/g) || []).map((w) => w.replace(/’s$/, ''));
  const chapterCaps = new Set(capTokens(chapterText));
  const candBody = cand.replace(/^[“"]?\s*\S+\s*/, ''); // drop first word
  for (const tok of capTokens(candBody)) {
    if (!chapterCaps.has(tok)) return { ok: false, reason: `new-proper-noun:${tok}` };
  }

  return { ok: true, reason: '' };
}

function cleanLLMSentence(raw) {
  let s = typeof raw === 'string' ? raw : raw?.text || raw?.content || String(raw || '');
  s = stripModelControlTokens(s).text;
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip prompt-echo prefixes and wrapping backticks/quotes the model may add.
  s = s.replace(/^(?:here(?:'s| is)[^:]*:|rewritten sentence:|recast:|new sentence:)\s*/i, '');
  s = s.replace(/^```[a-z]*\n?|\n?```$/g, '').trim();
  // First line only — a compliant answer is one sentence.
  s = s.split('\n')[0].trim();
  return s;
}

/**
 * Heal cross-chapter verbatim duplicates by recasting the LATER occurrence.
 *
 * @param {Array<{chapterNumber, text}>} chapters - mutated in place (text)
 * @param {object} opts
 * @param {Function} [opts.callLLM] - TEST/DI override: async (userPrompt, systemPrompt, maxTokens) => string
 * @param {object}  [opts.project]  - passed to the local-LLM caller for routing
 * @param {Function} [opts.onProgress]
 * @param {number}  [opts.maxRecasts=25] - safety budget per run
 * @param {number}  [opts.timeoutMs=120000]
 * @returns {{recast: number, skipped: Array, changes: string[], dupesFound: number}}
 */
export async function healCrossChapterDuplicates(chapters = [], opts = {}) {
  const { callLLM = null, project = null, onProgress = () => {}, maxRecasts = 25, timeoutMs = 120000 } = opts;
  const changes = [];
  const skipped = [];
  let recastCount = 0;

  const dupes = findCrossChapterDuplicateSentences(chapters);
  if (!dupes.length) return { recast: 0, skipped, changes, dupesFound: 0 };

  // All current 12+-word sentence norms in the book — a recast may not collide
  // with any of them.
  const bookNorms = new Set();
  for (const ch of chapters) {
    for (const s of splitSentencesForDedupe(ch?.text || '')) {
      const norm = normalizeSentenceForDedupe(s);
      if (norm.split(' ').length >= CROSS_DUPE_MIN_WORDS) bookNorms.add(norm);
    }
  }

  const callOne = callLLM || (async (userPrompt, systemPrompt, maxTokens) => {
    const agent = await getCallAgent();
    return agent({ prompt: userPrompt, taskType: 'polish', project, temperature: 0.6, maxTokens, systemPromptOverride: systemPrompt });
  });

  const SYSTEM = [
    'You are a line editor. You rewrite exactly one sentence so it keeps the same meaning, point of view, tense, and tone but uses different wording.',
    'Rules:',
    '- Return ONLY the rewritten sentence. No preamble, no quotes around it, no explanation.',
    '- Keep every character name and object exactly as in the original. Never add a new name, place, or object.',
    '- If the original is dialogue (wrapped in quotation marks), the rewrite must be dialogue in the same quotation marks.',
    '- Keep roughly the same length.',
  ].join('\n');

  // SEQUENTIAL — one LLM call at a time, always.
  for (const d of dupes) {
    if (recastCount >= maxRecasts) {
      skipped.push({ ...d, reason: 'recast-budget-exhausted' });
      continue;
    }
    const target = chapters.find((c) => c?.chapterNumber === d.b);
    if (!target || !target.text.includes(d.sentence)) {
      skipped.push({ ...d, reason: 'sentence-not-found-verbatim' });
      continue;
    }
    onProgress(`Polish: recasting duplicated sentence (ch.${d.a} = ch.${d.b})…`);

    let raw = null;
    try {
      const userPrompt = `Rewrite this sentence with different wording but identical meaning:\n\n${d.sentence}`;
      let timer = null;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); });
      raw = await Promise.race([callOne(userPrompt, SYSTEM, 220), timeout]).finally(() => timer && clearTimeout(timer));
    } catch (err) {
      skipped.push({ ...d, reason: `llm-error:${err?.message || 'unknown'}` });
      continue;
    }

    const candidate = cleanLLMSentence(raw);
    const verdict = verifyRecastSentence(d.sentence, candidate, { chapterText: target.text, bookNorms });
    if (!verdict.ok) {
      console.warn(`[CROSSDEDUPE] recast rejected (${verdict.reason}) for ch.${d.a}=ch.${d.b}: "${d.norm.slice(0, 70)}"`);
      skipped.push({ ...d, reason: `verify-failed:${verdict.reason}` });
      continue;
    }

    target.text = target.text.replace(d.sentence, candidate);
    bookNorms.add(normalizeSentenceForDedupe(candidate));
    recastCount += 1;
    changes.push(`Ch.${d.b}: recast sentence duplicated from ch.${d.a} ("${d.norm.slice(0, 60)}…")`);
    console.log(`[CROSSDEDUPE] Ch.${d.b}: recast duplicate of ch.${d.a}: "${d.norm.slice(0, 70)}"`);
  }

  return { recast: recastCount, skipped, changes, dupesFound: dupes.length };
}
