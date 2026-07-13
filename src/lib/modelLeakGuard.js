// =============================================================
// modelLeakGuard.js — LEAKFIX-1: deterministic model-leak scrubber.
//
// Two leak classes observed in shipped manuscripts:
//   1. Control tokens: Qwen-style '/nothink' / '/think' soft switches and
//      <think>...</think> blocks echoed into prose (68 instances in one book).
//   2. Language drift: the model slides into CJK mid-sentence, leaving a
//      beheaded English lead-in ("His mouth hung open, a" + Chinese).
//
// Closed-world design: both classes are recognized by codepoint/shape, never
// by guessing content. A clean manuscript is a byte-for-byte no-op.
// =============================================================

const CONTROL_TOKEN_RX = /(?:\s*\/no_?think\b)|(?:\s*\/think\b)|(?:<think>[\s\S]*?<\/think>)|(?:<\/?think>)|(?:<\|[^|<>]{1,48}\|>)/gi;

// CJK unified + extension A, kana, katakana phonetic ext, Hangul,
// CJK symbols/punctuation, fullwidth/halfwidth forms.
const NON_LATIN_RUN_RX = /[㐀-䶿一-鿿-ヿㇰ-ㇿ가-　-〿-]+/g;

const TERMINALS = new Set(['.', '!', '?', '…', '"', '”', '’', ')', ']']);

export function stripModelControlTokens(text = '') {
  let removed = 0;
  const out = String(text || '').replace(CONTROL_TOKEN_RX, () => { removed += 1; return ' '; });
  return { text: collapse(out), removed };
}

/**
 * Remove non-Latin drift runs. When a run interrupts an English sentence,
 * also remove the incomplete lead-in fragment back to the previous sentence
 * terminal, so no beheaded stump ("His mouth hung open, a") survives.
 */
export function stripNonLatinDrift(text = '') {
  const src = String(text || '');
  NON_LATIN_RUN_RX.lastIndex = 0;
  const runs = [];
  let m;
  while ((m = NON_LATIN_RUN_RX.exec(src)) !== null) {
    runs.push({ start: m.index, end: m.index + m[0].length, sample: m[0].slice(0, 24) });
  }
  if (!runs.length) return { text: src, removedRuns: 0, droppedLeadIns: 0, samples: [] };

  // Merge runs separated only by whitespace.
  const merged = [];
  for (const r of runs) {
    const prev = merged[merged.length - 1];
    if (prev && /^\s*$/.test(src.slice(prev.end, r.start))) prev.end = r.end;
    else merged.push({ ...r });
  }

  let droppedLeadIns = 0;
  const samples = [];
  // Expand each run backward over an incomplete English lead-in.
  for (const r of merged) {
    samples.push(r.sample);
    let i = r.start - 1;
    while (i >= 0 && /[ \t]/.test(src[i])) i -= 1;
    if (i >= 0 && src[i] !== '\n' && !TERMINALS.has(src[i])) {
      // Mid-sentence interruption: walk back to just after the previous
      // terminal or paragraph/line start.
      let j = i;
      while (j >= 0 && src[j] !== '\n' && !TERMINALS.has(src[j])) j -= 1;
      r.start = j + 1;
      droppedLeadIns += 1;
    }
  }

  // Rebuild, skipping expanded runs.
  let out = '';
  let pos = 0;
  for (const r of merged) {
    if (r.start > pos) out += src.slice(pos, r.start);
    pos = Math.max(pos, r.end);
  }
  out += src.slice(pos);

  return { text: collapse(out), removedRuns: merged.length, droppedLeadIns, samples };
}

export function scrubModelLeaks(text = '', label = '') {
  const tokens = stripModelControlTokens(text);
  const drift = stripNonLatinDrift(tokens.text);
  const changes = [];
  if (tokens.removed) changes.push(`removed ${tokens.removed} model control token(s)`);
  if (drift.removedRuns) changes.push(`removed ${drift.removedRuns} non-Latin drift run(s)` + (drift.droppedLeadIns ? ` + ${drift.droppedLeadIns} beheaded lead-in(s)` : ''));
  if (changes.length) {
    console.log(`[LEAK-GUARD] ${label || 'text'}: ${changes.join('; ')}` + (drift.samples.length ? ` | e.g. ${drift.samples[0]}` : ''));
  }
  return { text: drift.text, changes };
}

function collapse(t) {
  return String(t || '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

console.log('[LEAK-GUARD] LEAKFIX-1 loaded: control-token + non-Latin drift scrubber');
