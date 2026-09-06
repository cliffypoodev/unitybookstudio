// src/lib/readerPass.js
// READERPASS-1 (UBS_plan.md Phase 2B) — the reader pass: a frontier model,
// a DIFFERENT model family than the local writer, reads the resolved
// manuscript in large sequential windows and flags anything that feels like
// a rerun. Report only: nothing here gates, blocks, cuts, or modifies
// prose, and nothing writes to Chapter/NovelProject.
//
// Scope boundary (same as beatLedger.js/repetitionSweep.js): this module
// never resolves or calls a model itself. `runReaderPass` requires an
// injected `callLLM` — the real caller (scripts/readerpass.mjs) is
// responsible for the Anthropic Messages API call, the API key, and never
// printing/logging/committing that key. This file has no knowledge of API
// keys at all.
//
// Relative imports only, no React — this module is imported directly by
// test/readerpass1.acceptance.mjs under bare Node.

export const READER_PASS_VERSION = 'reader-pass-v1';

// The plan's stated window sizes (~15-20k words, ~2k overlap) — the middle
// of that range.
export const READER_PASS_WINDOW_WORDS = 17000;
export const READER_PASS_OVERLAP_WORDS = 2000;

// "max_tokens >= 4096" per the kickoff's standing rule. Enforced here, not
// just documented, so a caller can't silently under-provision and turn
// every long window into a truncation failure.
export const READER_PASS_MIN_MAX_TOKENS = 4096;

/**
 * Splits `fullText` into overlapping word windows. A window narrower than
 * the text (the common case) advances by (windowWords - overlapWords) each
 * step; the final window is clipped to the text's end rather than padded.
 */
export function buildReaderWindows(fullText, { windowWords = READER_PASS_WINDOW_WORDS, overlapWords = READER_PASS_OVERLAP_WORDS } = {}) {
  const words = String(fullText || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const step = Math.max(1, windowWords - overlapWords);
  const windows = [];
  for (let start = 0; start < words.length; start += step) {
    const end = Math.min(words.length, start + windowWords);
    windows.push({ index: windows.length, startWord: start, endWord: end, text: words.slice(start, end).join(' ') });
    if (end >= words.length) break;
  }
  return windows;
}

function stripCodeFence(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

// UBS_plan.md Phase 2B prompt, adapted into one strictly-parseable JSON
// object (the plan's draft asks for a JSON array of flags AND a separately
// "also output" running list — two independent blobs in one completion is
// fragile to parse reliably; this keeps both plan-specified pieces, in one
// shape).
const READER_PASS_INSTRUCTIONS = `You are reading this novel as an attentive reader. Your single task: flag any scene, confrontation, revelation, or emotional beat that feels like a RERUN of something earlier in the book — the "wait, didn't this already happen?" feeling. Do not comment on prose quality, style, pacing, or anything else.

Output ONLY a JSON object of this exact shape:
{
  "flags": [{ "location": "chapter/approx paragraph", "echoOf": "earlier location", "what": "one sentence", "confidence": "high|medium|low" }],
  "runningList": "an updated compact running list of major beats seen so far, for the next window"
}`;

function buildWindowPrompt(windowText, runningListSoFar) {
  const context = runningListSoFar
    ? `ALREADY SEEN SO FAR (major beats from earlier windows):\n${runningListSoFar}\n\n`
    : '';
  return `${READER_PASS_INSTRUCTIONS}\n\n${context}TEXT WINDOW:\n${windowText}`;
}

// Two flags dedupe to one when they name the same location echoing the same
// earlier location — the same repeat, seen from two overlapping windows.
function flagKey(flag) {
  return `${String(flag?.location || '').toLowerCase().trim()}|${String(flag?.echoOf || '').toLowerCase().trim()}`;
}

function dedupeFlags(flags) {
  const seen = new Map();
  for (const f of flags) {
    const key = flagKey(f);
    if (key !== '|' && !seen.has(key)) seen.set(key, f);
  }
  return [...seen.values()];
}

/**
 * Runs the windowed reader pass over `fullText`. NEVER counts a truncated
 * window's flags as "zero" — a window whose completion stopped at
 * max_tokens is tracked as FAILED (incomplete), distinct from a window that
 * genuinely returned no flags. Parse failures and API errors (thrown by
 * callLLM) are tracked the same way, per window — one window's failure
 * never stops the rest.
 *
 * @param {object} args
 * @param {string} args.fullText
 * @param {(prompt: string, meta: {maxTokens:number}) => Promise<{text:string, stopReason:string|null}>} args.callLLM
 *   Required — this module never resolves or calls a model itself.
 * @param {number} [args.maxTokens]
 */
export async function runReaderPass({ fullText, callLLM, maxTokens = READER_PASS_MIN_MAX_TOKENS, windowWords, overlapWords } = {}) {
  if (typeof callLLM !== 'function') {
    throw new Error('[READERPASS-1] runReaderPass requires an injected callLLM (caller bug, not a runtime failure)');
  }
  if (Number(maxTokens) < READER_PASS_MIN_MAX_TOKENS) {
    throw new Error(`[READERPASS-1] max_tokens must be >= ${READER_PASS_MIN_MAX_TOKENS} (got ${maxTokens})`);
  }

  const windows = buildReaderWindows(fullText, { windowWords, overlapWords });
  const windowResults = [];
  let runningList = '';

  for (const win of windows) {
    const tag = `[READERPASS-1] window ${win.index + 1}/${windows.length}`;
    try {
      const result = await callLLM(buildWindowPrompt(win.text, runningList), { maxTokens });
      const text = typeof result?.text === 'string' ? result.text : '';
      const stopReason = result?.stopReason ?? null;

      if (stopReason === 'max_tokens') {
        console.warn(`${tag}: FAILED — truncated (stop_reason=max_tokens), incomplete, not zero flags`);
        windowResults.push({ index: win.index, status: 'failed', reason: 'truncated (stop_reason=max_tokens)', flags: [] });
        continue;
      }
      if (!text.trim()) {
        console.warn(`${tag}: FAILED — empty completion`);
        windowResults.push({ index: win.index, status: 'failed', reason: 'empty completion', flags: [] });
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(stripCodeFence(text));
      } catch (err) {
        console.warn(`${tag}: FAILED — malformed JSON (${err?.message || err})`);
        windowResults.push({ index: win.index, status: 'failed', reason: `malformed JSON (${err?.message || err})`, flags: [] });
        continue;
      }

      const flags = Array.isArray(parsed?.flags) ? parsed.flags : [];
      if (typeof parsed?.runningList === 'string' && parsed.runningList.trim()) {
        runningList = parsed.runningList.trim();
      }
      console.log(`${tag}: ${flags.length} flag(s).`);
      windowResults.push({ index: win.index, status: 'ok', flags });
    } catch (err) {
      console.warn(`${tag}: FAILED — API error (${err?.message || err})`);
      windowResults.push({ index: win.index, status: 'failed', reason: `API error (${err?.message || err})`, flags: [] });
    }
  }

  const failedCount = windowResults.filter((w) => w.status === 'failed').length;
  const flags = dedupeFlags(windowResults.flatMap((w) => w.flags));

  return {
    windowCount: windows.length,
    windowResults,
    failedCount,
    flags,
    runningList,
  };
}

export function formatReaderPassReport(result, { projectTitle = '' } = {}) {
  const lines = [];
  lines.push(`READER PASS${projectTitle ? ` — "${projectTitle}"` : ''}`);
  lines.push(`Windows: ${result.windowCount}`);
  if (result.windowCount > 0 && result.failedCount === result.windowCount) {
    lines.push('ALL WINDOWS FAILED — this is not a clean result');
  } else if (result.failedCount > 0) {
    lines.push(`PARTIAL FAILURE ${result.failedCount}/${result.windowCount}`);
  }
  lines.push(`Flags (deduped across overlapping windows): ${result.flags.length}`);
  result.flags.forEach((f, i) => {
    lines.push(`${i + 1}. ${f.location} echoes ${f.echoOf} [${f.confidence}] — ${f.what}`);
  });
  for (const w of result.windowResults) {
    if (w.status === 'failed') lines.push(`  window ${w.index + 1}/${result.windowCount}: FAILED — ${w.reason}`);
  }
  return lines.join('\n');
}
