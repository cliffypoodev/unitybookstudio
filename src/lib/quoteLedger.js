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

console.log('[QUOTE-LEDGER] ARCH2-4a loaded: one home chapter per verbatim quote');
