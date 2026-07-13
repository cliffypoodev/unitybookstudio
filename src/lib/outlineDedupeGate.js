// =============================================================
// outlineDedupeGate.js — OUTLINEFIX-1: cross-chapter outline distinctness gate.
//
// Failure mode: asked for N chapters, the architect produces the real story
// in ~half of them, then pads the rest by re-running the same events with
// recycled titles (Final X, X Continues, X Revisited, X — Aftermath). The
// scene-beat normalizer only dedupes WITHIN a chapter; nothing checked the
// outline ACROSS chapters. This gate does, deterministically. Fiction only —
// nonfiction fallback templates repeat by design.
// =============================================================

// Words that signal a re-run rather than a new event when they appear in
// titles. 'aftermath'/'revisited'/'continues' are recap markers even once.
const RECAP_MARKERS = ['aftermath', 'revisited', 'continues', 'continued', 'redux', 'reprise'];
const RECYCLE_WORDS = ['final', 'last', 'first', 'begins', 'ends', 'closes', 'again', 'return', 'returns', ...RECAP_MARKERS];
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'to', 'at', 'for', 'with', 'from', 'into', 'part', 'chapter']);

function titleWords(title = '') {
  return String(title || '')
    .toLowerCase()
    .replace(/^chapter\s+\d+\s*[:.—-]?\s*/i, '')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOPWORDS.has(w));
}

function contentWords(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
}

function jaccard(a, b) {
  const A = new Set(a); const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

function shingles(words, k = 6) {
  const out = new Set();
  for (let i = 0; i + k <= words.length; i += 1) out.add(words.slice(i, i + k).join(' '));
  return out;
}

/**
 * Deterministic outline distinctness analysis.
 * Returns { ok, issues[], pairs[] } — pairs are flagged chapter couples.
 */
export function analyzeOutlineDuplication(chapters = []) {
  const issues = [];
  const pairs = [];
  const chs = (chapters || []).map((c, i) => ({
    n: Number(c.chapter_number) || i + 1,
    title: String(c.title || ''),
    tw: titleWords(c.title),
    core: titleWords(c.title).filter(w => !RECYCLE_WORDS.includes(w)),
    sw: contentWords(c.beat_summary || c.summary || ''),
  }));

  let hardIssues = 0;

  // 1) Recap markers in any title — critical even once.
  for (const c of chs) {
    const hit = c.tw.find(w => RECAP_MARKERS.includes(w));
    if (hit) { issues.push(`Ch.${c.n} title "${c.title}" uses recap marker "${hit}"`); hardIssues += 1; }
  }

  // 2) A recycle word in 2+ titles is critical; an ordinary word in 3+ titles
  //    is a soft warning (could be a legitimate motif).
  const wordUse = new Map();
  for (const c of chs) for (const w of new Set(c.tw)) {
    if (!wordUse.has(w)) wordUse.set(w, []);
    wordUse.get(w).push(c.n);
  }
  for (const [w, where] of wordUse.entries()) {
    if (RECYCLE_WORDS.includes(w) && where.length >= 2) { issues.push(`title word "${w}" recycled across chapters ${where.join(', ')}`); hardIssues += 1; }
    else if (where.length >= 3) issues.push(`title word "${w}" recycled across chapters ${where.join(', ')}`);
  }

  // Document-frequency filter: words that appear in half the summaries
  // (protagonist names, setting nouns) are not evidence of duplication.
  const df = new Map();
  for (const c of chs) for (const w of new Set(c.sw)) df.set(w, (df.get(w) || 0) + 1);
  const dfCap = Math.max(2, Math.ceil(chs.length * 0.5));
  for (const c of chs) c.swRare = c.sw.filter(w => (df.get(w) || 0) < dfCap);

  // 3) Pairwise: identical title cores, or high title/summary overlap.
  for (let i = 0; i < chs.length; i += 1) {
    for (let j = i + 1; j < chs.length; j += 1) {
      const a = chs[i]; const b = chs[j];
      const reasons = [];
      if (a.core.length && b.core.length && jaccard(a.core, b.core) >= 0.5) reasons.push('near-duplicate titles');
      if (a.swRare.length >= 10 && b.swRare.length >= 10) {
        if (jaccard(a.swRare, b.swRare) >= 0.5) reasons.push('summaries describe the same event');
        else {
          const shared = [...shingles(a.sw)].filter(s => shingles(b.sw).has(s)).length;
          if (shared >= 3) reasons.push(`summaries share ${shared} verbatim 6-word runs`);
          else {
            // Paraphrased re-runs: the same rare-word ADJACENCIES survive
            // rewording ("avalanche buries", "pushes splitting").
            const bg = (w) => { const o = new Set(); for (let x = 0; x + 1 < w.length; x += 1) o.add(w[x] + ' ' + w[x + 1]); return o; };
            const sharedBg = [...bg(a.swRare)].filter(x => bg(b.swRare).has(x)).length;
            if (sharedBg >= 2) reasons.push(`summaries share ${sharedBg} rare-word pairings (same event reworded)`);
          }
        }
      }
      if (reasons.length) {
        pairs.push({ a: a.n, b: b.n, reasons });
        issues.push(`Ch.${a.n} "${a.title}" vs Ch.${b.n} "${b.title}": ${reasons.join(' + ')}`);
      }
    }
  }

  return {
    ok: pairs.length === 0 && issues.length === 0,
    critical: pairs.length > 0 || hardIssues > 0,
    issues,
    pairs,
  };
}

/**
 * Hard rules appended to every fiction outline/repair prompt so the first
 * attempt is already constrained. Generic — nothing book-specific.
 */
export function buildOutlineDistinctnessRules(chapterCount) {
  return `
=== CHAPTER DISTINCTNESS ENFORCEMENT ===
- Every chapter must contain a NEW event that permanently changes the situation. NEVER re-run an event type already used in an earlier chapter (no second identical disaster, no second return to a location already used as its own chapter, no re-fought confrontation).
- The story ends EXACTLY ONCE, in chapter ${chapterCount}. Do not resolve the story in an earlier chapter and then continue. No epilogue-style chapters before ${chapterCount}.
- If the premise cannot fill ${chapterCount} distinct chapters, ADD new complications, subplots, and reversals mid-story. Do not pad by repeating.
- TITLE RULES: never use "Final", "Last", "Aftermath", "Revisited", "Continues", or "Part" in a title. No meaningful word may appear in more than two titles. Vary constructions — do not make every title "The X" or "The X of Y". Titles should be evocative and oblique, not literal event labels.
=== END CHAPTER DISTINCTNESS ENFORCEMENT ===`;
}

/**
 * Retry appendix listing exactly what was wrong with the rejected outline.
 */
export function buildOutlineDedupeRetryAppendix(analysis, chapterCount) {
  const lines = (analysis?.issues || []).slice(0, 12).map(s => `- ${s}`).join('\n');
  return `
=== PREVIOUS OUTLINE REJECTED: REPEATED EVENTS ===
Your previous outline repeated the same events and recycled titles. Specific failures:
${lines}
Produce a COMPLETELY revised set of ${chapterCount} chapters that fixes every failure above. Each chapter must be a distinct, escalating event. The story ends once, in chapter ${chapterCount}.
=== END REJECTION NOTICE ===`;
}

console.log('[OUTLINE-DEDUPE] OUTLINEFIX-1 loaded: cross-chapter outline distinctness gate');
