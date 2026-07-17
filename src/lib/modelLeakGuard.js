// =============================================================
// modelLeakGuard.js - LEAKFIX-1: deterministic model-leak scrubber.
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
// ASCII-only escapes on purpose: raw exotic literals get stripped by paste
// channels (LEAKFIX-1B post-mortem). Never replace these with literal chars.
const NON_LATIN_RUN_RX = /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\u31F0-\u31FF\uAC00-\uD7AF\u3000-\u303F\uFF00-\uFFEF]+/g;

const TERMINALS = new Set(['.', '!', '?', '\u2026', '"', '\u201D', '\u2019', ')', ']']);

export function detectModelControlTokens(text) {
  if (!text) return [];
  const src = String(text);
  CONTROL_TOKEN_RX.lastIndex = 0;
  const matches = [];
  let m;
  while ((m = CONTROL_TOKEN_RX.exec(src)) !== null) {
    const snippetStart = Math.max(0, m.index - 30);
    const snippetEnd = Math.min(src.length, m.index + m[0].length + 30);
    matches.push({
      token: m[0],
      index: m.index,
      snippet: src.substring(snippetStart, snippetEnd),
    });
  }
  return matches;
}

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
  const originalParas = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  let paragraphsRemoved = 0;

  for (const para of originalParas) {
    if (!para.trim()) continue;
    const stripped = para.replace(CONTROL_TOKEN_RX, ' ').trim();
    if (stripped.length === 0 && para.trim().length > 0) {
      paragraphsRemoved++;
    }
  }

  const tokens = stripModelControlTokens(text);
  const drift = stripNonLatinDrift(tokens.text);
  const changes = [];
  if (tokens.removed) changes.push(`removed ${tokens.removed} model control token(s)`);
  if (paragraphsRemoved > 0) changes.push(`removed ${paragraphsRemoved} token-only paragraph(s)`);
  if (drift.removedRuns) changes.push(`removed ${drift.removedRuns} non-Latin drift run(s)` + (drift.droppedLeadIns ? ` + ${drift.droppedLeadIns} beheaded lead-in(s)` : ''));
  if (changes.length) {
    console.log(`[LEAK-GUARD] ${label || 'text'}: ${changes.join('; ')}` + (drift.samples.length ? ` | e.g. ${drift.samples[0]}` : ''));
  }
  return { text: drift.text, changes, paragraphsRemoved, tokensRemoved: tokens.removed };
}

function collapse(t) {
  return String(t || '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * LEAKFIX-2: scrub outline chapters (titles + beat summaries). A drift run in
 * a short title usually guts it ("The<CJK>" becomes "The" or ""), so chapters
 * whose title or summary no longer carries content are reported as gutted -
 * the outline repair loop replaces them with fresh material.
 */
export function scrubOutlineChapters(chapters = []) {
  const out = [];
  const gutted = [];
  let changed = false;
  for (const ch of (chapters || [])) {
    const n = Number(ch?.chapter_number) || out.length + 1;
    const title = scrubModelLeaks(String(ch?.title || ''), 'outline-title Ch.' + n).text.trim();
    const summary = scrubModelLeaks(String(ch?.beat_summary || ch?.summary || ''), 'outline-summary Ch.' + n).text.trim();
    if (title !== String(ch?.title || '').trim() || summary !== String(ch?.beat_summary || ch?.summary || '').trim()) changed = true;
    if (title.replace(/[^A-Za-z0-9]/g, '').length < 3 || summary.length < 30) gutted.push(n);
    out.push({ ...ch, chapter_number: n, title, beat_summary: summary });
  }
  if (gutted.length) console.warn('[LEAK-GUARD] outline chapters gutted by leak scrub (will be replaced): ' + gutted.join(', '));
  return { chapters: out, gutted, changed };
}

console.log('[LEAK-GUARD] LEAKFIX-2 loaded: control-token + non-Latin drift scrubber');
