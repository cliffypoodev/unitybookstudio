// =============================================================
// quoteLedger.js — ARCH2-4a: one home chapter per verbatim quote
//
// A witness quote may be printed verbatim in exactly one chapter. The home
// is derived deterministically from the outline: the lowest-numbered chapter
// whose beat text contains a 5-word shingle of the quote. Foreign-homed
// quotes are excised from other chapters' injected research so the writer
// references the testimony in narration instead of re-quoting it.
// Book-agnostic: homes are derived from project data at call time.
// =============================================================

const normQ = (s) => String(s || '')
  .toLowerCase()
  .replace(/[‘’']/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function chapterBeatText(ch) {
  let sb = '';
  try {
    const j = JSON.parse(ch?.scene_beats_json || '[]');
    sb = JSON.stringify(j);
  } catch { sb = String(ch?.scene_beats_json || ''); }
  return normQ([ch?.title, ch?.beat_summary, ch?.scene_beats, ch?.beats, ch?.summary, ch?.description, sb]
    .map((v) => (typeof v === 'string' ? v : ''))
    .filter(Boolean)
    .join(' '));
}

function shingles(normQuote, size) {
  const w = normQuote.split(' ').filter(Boolean);
  if (w.length < size) return w.length >= 4 ? [w.join(' ')] : [];
  const out = [];
  for (let i = 0; i + size <= w.length; i++) out.push(w.slice(i, i + size).join(' '));
  return out;
}

/**
 * Build the quote ledger from project research + chapter outline beats.
 * @returns Array<{ name, raw, norm, home }> — home is a chapter_number or null.
 */
export function buildQuoteLedger(project, chapters) {
  try {
    const rd = typeof project?.research_data === 'string'
      ? JSON.parse(project.research_data)
      : (project?.research_data || {});
    const figures = Array.isArray(rd.key_figures) ? rd.key_figures : [];
    const beats = (chapters || [])
      .filter((c) => c && Number.isFinite(Number(c.chapter_number)))
      .map((c) => ({ n: Number(c.chapter_number), text: chapterBeatText(c) }))
      .sort((a, b) => a.n - b.n);

    const ledger = [];
    for (const f of figures) {
      const raw = (f?.quote || '').trim();
      const norm = normQ(raw);
      if (!norm || norm.split(' ').length < 4) continue;
      let home = null;
      const shs = shingles(norm, 5);
      outer: for (const b of beats) {
        for (const sh of shs) {
          if (b.text.includes(sh)) { home = b.n; break outer; }
        }
      }
      ledger.push({ name: f?.name || '', raw, norm, home });
    }
    return ledger;
  } catch (e) {
    return [];
  }
}

/**
 * Excise quotes homed to OTHER chapters from a research text block.
 * Replaces the quote text with a reference marker. Fail-open: a quote whose
 * raw text cannot be located in the block is left alone.
 * @returns { text, excluded: string[] }
 */
export function excludeForeignQuotes(researchText, project, chapters, chapterNumber) {
  const excluded = [];
  let text = String(researchText || '');
  if (!text) return { text, excluded };
  const n = Number(chapterNumber);
  const ledger = buildQuoteLedger(project, chapters);
  for (const entry of ledger) {
    if (entry.home === null || entry.home === n) continue;
    const marker = '[testimony quoted in Chapter ' + entry.home + ' — reference it in narration; do NOT re-quote verbatim]';
    const variants = [entry.raw, entry.raw.replace(/'/g, '’')];
    let hit = false;
    for (const v of variants) {
      if (v && text.includes(v)) { text = text.split(v).join(marker); hit = true; }
    }
    if (hit) excluded.push((entry.name || 'unnamed') + ' -> Ch. ' + entry.home);
  }
  return { text, excluded };
}

// Normalize text while keeping a map from every norm char back to its
// original index, so a norm-space match can be located in the original.
function normWithMap(s) {
  const src = String(s || '');
  let out = '';
  const map = [];
  let prevSpace = true;
  for (let i = 0; i < src.length; i++) {
    let ch = src[i].toLowerCase();
    if (ch === '‘' || ch === '’' || ch === "'") continue;
    if (!/[a-z0-9]/.test(ch)) ch = ' ';
    if (ch === ' ') {
      if (prevSpace) continue;
      out += ' '; map.push(i); prevSpace = true;
    } else {
      out += ch; map.push(i); prevSpace = false;
    }
  }
  if (out.endsWith(' ')) { out = out.slice(0, -1); map.pop(); }
  return { norm: out, map };
}

function quoteShingles(norm, size) {
  const w = norm.split(' ').filter(Boolean);
  if (w.length < size) return w.length >= 6 ? [w.join(' ')] : [];
  const out = [];
  for (let i = 0; i + size <= w.length; i++) out.push(w.slice(i, i + size).join(' '));
  return out;
}

function collectResearchQuotes(project, minWords) {
  try {
    const rd = typeof project?.research_data === 'string'
      ? JSON.parse(project.research_data)
      : (project?.research_data || {});
    const figures = Array.isArray(rd.key_figures) ? rd.key_figures : [];
    const out = [];
    for (const f of figures) {
      const raw = (f?.quote || '').trim();
      const norm = normQ(raw);
      if (!norm || norm.split(' ').length < minWords) continue;
      out.push({ name: f?.name || '', raw, norm });
    }
    return out;
  } catch { return []; }
}

const CLOSE_Q = /[”"]/;

// Locate the quotation marks enclosing [mStart,mEnd], or null when the
// occurrence is not inside a quote. Curly quotes are directional; straight
// quotes are disambiguated by parity within the paragraph.
function findEnclosingQuote(text, mStart, mEnd) {
  let qStart = -1;
  for (let i = mStart - 1; i >= 0 && i >= mStart - 700; i--) {
    const ch = text[i];
    if (ch === '\n') return null;              // quotes do not cross paragraphs
    if (ch === '”') return null;               // a closer first → not inside
    if (ch === '“') { qStart = i; break; }
    if (ch === '"') {
      let pStart = text.lastIndexOf('\n', i);
      pStart = pStart === -1 ? 0 : pStart + 1;
      const cnt = (text.slice(pStart, i + 1).match(/"/g) || []).length;
      if (cnt % 2 === 1) { qStart = i; break; }
      return null;                             // even count → that mark closed a quote
    }
  }
  if (qStart === -1) return null;
  for (let i = mEnd; i < text.length && i <= mEnd + 900; i++) {
    const ch = text[i];
    if (ch === '\n') return null;
    if (ch === '“') return null;               // another opener → unbalanced, bail
    if (ch === '”' || ch === '"') return { qStart, qEnd: i + 1 };
  }
  return null;
}

// Given a shingle match [mStart,mEnd] in original text, expand to the span
// that should be removed: enclosing quoted span, then full sentence(s).
// Returns null when the occurrence is not inside quotation marks (narrated
// references are allowed) or when the span would be dangerously large.
function expandRemovalSpan(text, mStart, mEnd) {
  const q = findEnclosingQuote(text, mStart, mEnd);
  if (!q) return null;
  const { qStart, qEnd } = q;

  // 2) expand backward past the attribution lead-in to the previous sentence end
  let sStart = 0;
  for (let i = qStart - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '\n') { sStart = i + 1; break; }
    if (/[.!?]/.test(ch)) {
      // sentence end only if followed by whitespace (skip closing quotes)
      let j = i + 1;
      while (j < qStart && CLOSE_Q.test(text[j])) j++;
      if (j >= qStart || /\s/.test(text[j])) { sStart = j; break; }
    }
    if (i === 0) sStart = 0;
  }
  // 3) expand forward to the end of the sentence containing the close quote.
  // When the quote itself ends with terminal punctuation ("…every day.”") and
  // a NEW sentence follows (capital/open-quote), the sentence is already over
  // at the closing mark — scanning further would swallow the next sentence.
  let sEnd = text.length;
  const punctInsideClose = /[.!?]/.test(text[qEnd - 2] || '');
  let nextIdx = qEnd;
  while (nextIdx < text.length && /\s/.test(text[nextIdx])) nextIdx++;
  const nextCh = text[nextIdx] || '';
  if (punctInsideClose && (nextCh === '' || /[A-Z0-9“"]/.test(nextCh))) {
    sEnd = qEnd;
  } else {
    for (let i = qEnd; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\n') { sEnd = i; break; }
      if (/[.!?]/.test(ch)) {
        let j = i + 1;
        while (j < text.length && CLOSE_Q.test(text[j])) j++;
        sEnd = j; break;
      }
    }
  }
  // trim leading whitespace into the span
  while (sStart < qStart && /\s/.test(text[sStart])) sStart++;
  if (sEnd - sStart > 1200) return { tooLarge: true, sStart, sEnd };
  return { sStart, sEnd };
}

/**
 * ARCH2-4b-a: one-time manuscript quote consolidation.
 * Every research quote (>=7 normalized words) may appear inside quotation
 * marks in exactly ONE chapter (its home), exactly once. Home = the ARCH2-4a
 * beat-derived home when it exists, else the lowest-numbered chapter whose
 * prose already quotes it (manuscript first-use). All other quoted
 * occurrences are removed at sentence granularity. Narrated (unquoted)
 * references are never touched. Fail-safe: oversized spans are flagged, not cut.
 */
export function consolidateForeignQuotes(loaded, project, beatHomes = new Map()) {
  const changes = [];
  const flagged = [];
  let removed = 0;
  const quotes = collectResearchQuotes(project, 7);
  if (!quotes.length || !Array.isArray(loaded) || !loaded.length) {
    return { changes, flagged, removed };
  }
  const items = loaded
    .map((f) => ({ f, n: Number(f?.chapter?.chapter_number) }))
    .filter((x) => Number.isFinite(x.n))
    .sort((a, b) => a.n - b.n);

  for (const q of quotes) {
    const shs = quoteShingles(q.norm, 6);
    if (!shs.length) continue;
    // Pass 1: find every quoted occurrence (chapter, span) in ascending order
    const occ = [];
    for (const { f, n } of items) {
      const { norm, map } = normWithMap(f.content || '');
      const seenSpans = [];
      for (const sh of shs) {
        let idx = norm.indexOf(sh);
        while (idx !== -1) {
          const mStart = map[idx];
          const mEnd = map[idx + sh.length - 1] + 1;
          const covered = seenSpans.some((s) => mStart < s.end && mEnd > s.start);
          if (!covered) {
            const span = expandRemovalSpan(f.content, mStart, mEnd);
            if (span && !span.tooLarge) {
              seenSpans.push({ start: span.sStart, end: span.sEnd });
            } else if (span && span.tooLarge) {
              flagged.push('Ch.' + n + ': quote span too large to auto-remove (' + (q.name || 'unnamed') + ')');
              seenSpans.push({ start: span.sStart, end: span.sEnd, keep: true });
            }
          }
          idx = norm.indexOf(sh, idx + 1);
        }
      }
      seenSpans.sort((a, b) => a.start - b.start);
      for (const s of seenSpans) occ.push({ n, f, ...s });
    }
    if (!occ.length) continue;
    const home = Number.isFinite(beatHomes.get(q.norm)) ? beatHomes.get(q.norm) : occ[0].n;
    // Pass 2: keep the FIRST occurrence in the home chapter; remove the rest
    let kept = false;
    const byChapter = new Map();
    for (const o of occ) {
      const keepThis = !kept && o.n === home && !o.keep;
      if (keepThis) { kept = true; continue; }
      if (o.keep) continue; // flagged oversized span — left alone
      if (!byChapter.has(o.n)) byChapter.set(o.n, []);
      byChapter.get(o.n).push(o);
    }
    for (const [n, spans] of byChapter) {
      const f = spans[0].f;
      spans.sort((a, b) => b.start - a.start); // remove back-to-front
      for (const s of spans) {
        f.content = (f.content.slice(0, s.start) + f.content.slice(s.end))
          .replace(/[ \t]{2,}/g, ' ')
          .replace(/\n{3,}/g, '\n\n');
        removed++;
      }
      changes.push('Ch.' + n + ': removed ' + spans.length + ' foreign-homed quote occurrence(s) of ' + (q.name || 'unnamed') + ' (home Ch.' + home + ')');
    }
  }
  return { changes, flagged, removed };
}

console.log('[QUOTE-LEDGER] ARCH2-4b-a loaded: quote consolidation + prompt-level excision');
