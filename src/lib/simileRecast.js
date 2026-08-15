// src/lib/simileRecast.js — STYLEBUDGET-2
//
// STYLEBUDGET-1 gives the WRITER a simile budget in its prompt. That shapes new
// drafts and nothing else: the 80k-word REDUX manuscript still measured
// 3.4–4.7 "like a / as if" per 1000 words after every chapter had shipped,
// because nothing ever touched a simile once it was on the page. External
// reviews called it "simile addiction" three audits in a row.
//
// This module is the enforcement side: a HARD CAP with a bounded, verified
// recast pass. It picks the sentences that push a chapter over budget, asks the
// local model to restate each one as a plain concrete statement (no
// comparison), and accepts the rewrite ONLY when the deterministic verifier
// agrees: one sentence, same quote framing, sane length, no NEW proper nouns
// (closed world against the chapter), and — the point — no simile left in it.
// A rejected recast leaves the original untouched. Sequential LLM calls,
// fail-open, no LLM → report only.
//
// Used by: finalizeChapterProse (writer, on the shipping artifact) and the
// Fix Manuscript runner (legacy chapters). Nothing book-specific.
import {
  splitSentencesForDedupe,
  normalizeSentenceForDedupe,
  verifyRecastSentence,
} from './crossChapterDedupe.js';
import { SIMILE_DENSITY_BUDGET_PER_1K, measureSimileDensity } from './aiSlopReduction.js';

export const SIMILE_RECAST_VERSION = 'simile-recast-v1';
export const SIMILE_RX = /\b(?:like\s+an?|as\s+if|as\s+though)\b/gi;

// "I like a good fight" / "she'd like an answer" — verb, not comparison.
const VERB_LIKE_RX = /\b(?:I|you|we|they|he|she|it|who|would|d|don['’]t|doesn['’]t|didn['’]t|wouldn['’]t|not|to|really|just|might|may|could|do|does|did)\s+like\s+an?\b/i;

let _callAgent = null;
async function getCallAgent() {
  if (!_callAgent) {
    const mod = await import(/* @vite-ignore */ '@/lib/localLLM');
    _callAgent = mod.callAgent;
  }
  return _callAgent;
}

function cleanLLMSentence(raw) {
  let s = typeof raw === 'string' ? raw : raw?.text || raw?.content || String(raw || '');
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  s = s.replace(/^(?:here(?:'s| is)[^:]*:|rewritten sentence:|recast:|new sentence:|plain version:)\s*/i, '');
  s = s.replace(/^```[a-z]*\n?|\n?```$/g, '').trim();
  s = s.split('\n')[0].trim();
  return s;
}

/**
 * Sentences that carry a comparison and are legal recast targets: narration
 * only (dialogue similes are character voice), verb-"like" excluded.
 * Returns [{ sentence, norm, similes }] in document order.
 */
export function findSimileSentences(text) {
  const out = [];
  for (const raw of splitSentencesForDedupe(text)) {
    const s = String(raw || '').trim();
    if (!s) continue;
    if (/[“”"]/.test(s)) continue; // any dialogue in the sentence → leave it
    SIMILE_RX.lastIndex = 0;
    const hits = s.match(SIMILE_RX) || [];
    if (!hits.length) continue;
    if (VERB_LIKE_RX.test(s) && hits.length === 1) continue;
    out.push({ sentence: s, norm: normalizeSentenceForDedupe(s), similes: hits.length });
  }
  return out;
}

/**
 * Decide how many similes a text must shed to reach the budget, and which
 * sentences to recast (densest sentences first, later occurrences first
 * within a tie so the chapter's opening imagery is the last to go).
 * Returns { over: boolean, per1k, budgetPer1k, needed, targets: [...] }.
 */
export function selectSimileRecastTargets(text, { budgetPer1k = SIMILE_DENSITY_BUDGET_PER_1K, maxTargets = 12, minWords = 400 } = {}) {
  const density = measureSimileDensity(text);
  if (!density.wordCount || density.wordCount < minWords) {
    return { over: false, per1k: density.per1k, budgetPer1k, needed: 0, targets: [], density };
  }
  const allowed = Math.floor((budgetPer1k * density.wordCount) / 1000);
  const needed = Math.max(0, density.total - allowed);
  if (needed <= 0) return { over: false, per1k: density.per1k, budgetPer1k, needed: 0, targets: [], density };
  const candidates = findSimileSentences(text)
    .map((c, idx) => ({ ...c, idx }))
    .sort((a, b) => (b.similes - a.similes) || (b.idx - a.idx));
  const targets = [];
  let shed = 0;
  for (const c of candidates) {
    if (shed >= needed || targets.length >= maxTargets) break;
    targets.push(c);
    shed += c.similes;
  }
  return { over: true, per1k: density.per1k, budgetPer1k, needed, targets, density };
}

/**
 * Deterministic verdict on a simile recast: everything verifyRecastSentence
 * demands, plus the recast must actually drop the comparison.
 */
export function verifySimileRecast(originalSentence, recast, ctx = {}) {
  const base = verifyRecastSentence(originalSentence, recast, ctx);
  if (!base.ok) return base;
  const cand = String(recast || '');
  SIMILE_RX.lastIndex = 0;
  if (SIMILE_RX.test(cand)) return { ok: false, reason: 'simile-remains' };
  // Stricter than the finder on purpose: a recast may not smuggle the
  // comparison back without the article ("like broken toys", "like fence
  // posts"). Only verb-"like" ("would like an answer") is tolerated.
  if (/\blike\b/i.test(cand) && !VERB_LIKE_RX.test(cand)) return { ok: false, reason: 'simile-remains' };
  return { ok: true, reason: '' };
}

const SYSTEM = [
  'You are a line editor removing an overused simile. You rewrite exactly one sentence so it keeps the same meaning, point of view, tense, and tone, but states the thing DIRECTLY instead of comparing it to something else.',
  'Rules:',
  '- Return ONLY the rewritten sentence. No preamble, no quotes around it, no explanation.',
  '- Do NOT use "like a", "like an", "as if", or "as though". Do not swap in a metaphor. Say what is literally there or what literally happens.',
  '- Keep every character name and object exactly as in the original. Never add a new name, place, or object.',
  '- Keep roughly the same length. One sentence.',
].join('\n');

/**
 * Bring one text under the simile budget with verified recasts.
 *
 * @param {string} text
 * @param {object} opts
 * @param {Function} [opts.callLLM]  TEST/DI override: async (userPrompt, systemPrompt, maxTokens) => string
 * @param {object}  [opts.project]
 * @param {number}  [opts.budgetPer1k]
 * @param {number}  [opts.maxTargets=12]
 * @param {number}  [opts.timeoutMs=90000]
 * @param {string}  [opts.label]     for logs ("Ch.12")
 * @returns {{ text, recast, skipped, before, after, over }}
 */
export async function healSimileDensity(text, opts = {}) {
  const { callLLM = null, project = null, budgetPer1k = SIMILE_DENSITY_BUDGET_PER_1K, maxTargets = 12, timeoutMs = 90000, label = 'text', onProgress = () => {} } = opts;
  let out = String(text || '');
  const plan = selectSimileRecastTargets(out, { budgetPer1k, maxTargets });
  const skipped = [];
  if (!plan.over) return { text: out, recast: 0, skipped, before: plan.per1k, after: plan.per1k, over: false };

  const callOne = callLLM || (async (userPrompt, systemPrompt, maxTokens) => {
    const agent = await getCallAgent();
    return agent({ prompt: userPrompt, taskType: 'polish', project, temperature: 0.5, maxTokens, systemPromptOverride: systemPrompt });
  });

  let recast = 0;
  // SEQUENTIAL — one LLM call at a time, always.
  for (const t of plan.targets) {
    if (!out.includes(t.sentence)) { skipped.push({ sentence: t.norm.slice(0, 80), reason: 'sentence-not-found-verbatim' }); continue; }
    onProgress(`Style: recasting a simile (${label})…`);
    let raw = null;
    try {
      let timer = null;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); });
      raw = await Promise.race([callOne(`Rewrite this sentence without the comparison, stating it directly:\n\n${t.sentence}`, SYSTEM, 220), timeout]).finally(() => timer && clearTimeout(timer));
    } catch (err) {
      skipped.push({ sentence: t.norm.slice(0, 80), reason: `llm-error:${err?.message || 'unknown'}` });
      continue;
    }
    const candidate = cleanLLMSentence(raw);
    const verdict = verifySimileRecast(t.sentence, candidate, { chapterText: out });
    if (!verdict.ok) {
      console.warn(`[STYLEBUDGET-2] ${label}: recast rejected (${verdict.reason}): "${t.norm.slice(0, 70)}"`);
      skipped.push({ sentence: t.norm.slice(0, 80), reason: `verify-failed:${verdict.reason}` });
      continue;
    }
    out = out.replace(t.sentence, candidate);
    recast += 1;
  }
  const after = measureSimileDensity(out).per1k;
  console.log(`[STYLEBUDGET-2] ${label}: simile density ${plan.per1k} → ${after} per 1k (budget ${budgetPer1k}); recast ${recast}/${plan.targets.length}, skipped ${skipped.length}`);
  return { text: out, recast, skipped, before: plan.per1k, after, over: true };
}
