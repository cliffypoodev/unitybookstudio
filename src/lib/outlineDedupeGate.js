// =============================================================
// outlineDedupeGate.js - OUTLINEFIX-1/2: cross-chapter outline distinctness.
//
// Failure mode: asked for N chapters, the architect produces the real story
// in about half of them, then pads the rest by re-running the same events
// with recycled titles (Final X, X Continues, X Revisited, X - Aftermath).
// The scene-beat normalizer only dedupes WITHIN a chapter; this gate checks
// ACROSS chapters. Fiction only - nonfiction templates repeat by design.
//
// OUTLINEFIX-2 contract: the user's chapter count is honored, period. When
// duplicates are found we do NOT re-roll the whole outline (that wastes the
// good chapters) and we NEVER hard-fail. We deterministically identify the
// offending chapters, ask the model to replace ONLY those with new escalating
// material, splice, and re-check - up to 3 rounds, then accept best effort
// with a loud warning.
//
// ASCII-only source on purpose: instruction channels strip exotic codepoints.
// =============================================================

const RECAP_MARKERS = ['aftermath', 'revisited', 'continues', 'continued', 'redux', 'reprise'];
const RECYCLE_WORDS = ['final', 'last', 'first', 'begins', 'ends', 'closes', 'again', 'return', 'returns', ...RECAP_MARKERS];
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'to', 'at', 'for', 'with', 'from', 'into', 'part', 'chapter']);

// OUTLINEFIX-3: wrap-up language that belongs ONLY in the final chapter.
// A summary matching any of these before the finale means the story ended
// early (the "double ending" disease).
const ENDING_SHAPES = [
  /\bopen road\b/, /\bleav\w+ civilization\b/, /\bleav\w+ the mountains?\b/,
  /\bemerg\w+ from the mountains?\b/, /\breach\w* the (?:lowlands|valley)\b/,
  /\bforever changed\b/, /\bembrac\w+ the (?:uncertainty|future|unknown)\b/,
  /\bbreak from the past\b/, /\bnew beginning\b/, /\bepilogue\b/, /\baftermath\b/,
  /\bwalk\w* away\b/, /\bstory ends\b/, /\bfinal farewell\b/, /\bpart ways\b/,
];

function titleWords(title = '') {
  return String(title || '')
    .toLowerCase()
    .replace(/^chapter\s+\d+\s*[:.\u2014-]?\s*/i, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function contentWords(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
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
 * Returns { ok, critical, issues[], pairs[] }.
 */
export function analyzeOutlineDuplication(chapters = []) {
  const issues = [];
  const soft = [];
  const pairs = [];
  const chs = (chapters || []).map((c, i) => ({
    n: Number(c.chapter_number) || i + 1,
    title: String(c.title || ''),
    tw: titleWords(c.title),
    core: titleWords(c.title).filter(w => !RECYCLE_WORDS.includes(w)),
    sw: contentWords(c.beat_summary || c.summary || ''),
    raw: String(c.beat_summary || c.summary || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(Boolean),
  }));

  let hardIssues = 0;
  const offenderNums = new Set();

  // 1) Recap markers in any title - critical even once.
  for (const c of chs) {
    const hit = c.tw.find(w => RECAP_MARKERS.includes(w));
    if (hit) { issues.push(`Ch.${c.n} title "${c.title}" uses recap marker "${hit}"`); hardIssues += 1; offenderNums.add(c.n); }
  }

  // 1b) OUTLINEFIX-3: ending shapes before the finale are critical - the
  //     story must end exactly once, in the last chapter.
  const lastN = chs.length ? Math.max(...chs.map(c => c.n)) : 0;
  const endingOffenders = new Set();
  for (const c of chs) {
    if (c.n >= lastN) continue;
    const summaryLower = c.raw.join(' ');
    const hit = ENDING_SHAPES.find(rx => rx.test(summaryLower));
    if (hit) { issues.push(`Ch.${c.n} "${c.title}" ends the story early (wrap-up language: ${String(hit).slice(1, 40)}...)`); hardIssues += 1; offenderNums.add(c.n); endingOffenders.add(c.n); }
  }

  // 2) A recycle word in 2+ titles is critical (every use after the first is
  //    an offender); an ordinary word in 3+ titles is a soft warning.
  const wordUse = new Map();
  for (const c of chs) for (const w of new Set(c.tw)) {
    if (!wordUse.has(w)) wordUse.set(w, []);
    wordUse.get(w).push(c.n);
  }
  for (const [w, where] of wordUse.entries()) {
    if (RECYCLE_WORDS.includes(w) && where.length >= 2) {
      issues.push(`title word "${w}" recycled across chapters ${where.join(', ')}`);
      hardIssues += 1;
      for (const n of where.slice(1)) offenderNums.add(n);
    } else if (where.length >= 3) {
      issues.push(`title word "${w}" recycled across chapters ${where.join(', ')}`);
    }
  }

  // Document-frequency filter: words in half the summaries (protagonist
  // names, setting nouns) are not evidence of duplication.
  const df = new Map();
  for (const c of chs) for (const w of new Set(c.sw)) df.set(w, (df.get(w) || 0) + 1);
  // Floor of 3: in very small outlines a word shared by the two duplicated
  // summaries would otherwise look 'common' and erase its own evidence.
  const dfCap = Math.max(3, Math.ceil(chs.length * 0.5));
  for (const c of chs) c.swRare = c.sw.filter(w => (df.get(w) || 0) < dfCap);

  // 3) Pairwise: identical title cores, or high title/summary overlap.
  for (let i = 0; i < chs.length; i += 1) {
    for (let j = i + 1; j < chs.length; j += 1) {
      const a = chs[i]; const b = chs[j];
      const reasons = [];
      if (a.core.length && b.core.length && jaccard(a.core, b.core) >= 0.5) reasons.push('near-duplicate titles');
      // OUTLINEFIX-3: a verbatim 5-word run shared by two summaries is the
      // same event regardless of summary length ("symbolizing their break
      // from the past" appearing twice).
      {
        const raw5 = (w) => { const o = new Set(); for (let x = 0; x + 5 <= w.length; x += 1) o.add(w.slice(x, x + 5).join(' ')); return o; };
        const sharedRaw = [...raw5(a.raw)].filter(x => raw5(b.raw).has(x)).length;
        if (sharedRaw >= 1) reasons.push('summaries share a verbatim 5-word phrase');
      }
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
      if (!reasons.length && a.swRare.length >= 4 && b.swRare.length >= 4) {
        // OUTLINEFIX-3: short summaries evade the main checks; a shared rare
        // word pairing there is an advisory for the repair prompt, not a block.
        const bg = (w) => { const o = new Set(); for (let x = 0; x + 1 < w.length; x += 1) o.add(w[x] + ' ' + w[x + 1]); return o; };
        const sharedBg = [...bg(a.swRare)].filter(x => bg(b.swRare).has(x));
        if (sharedBg.length >= 1) soft.push(`Ch.${a.n} and Ch.${b.n} both mention "${sharedBg[0]}" - make sure this event happens only once`);
      }
      if (reasons.length) {
        pairs.push({ a: a.n, b: b.n, reasons });
        issues.push(`Ch.${a.n} "${a.title}" vs Ch.${b.n} "${b.title}": ${reasons.join(' + ')}`);
        // The later chapter is the re-run - unless the later chapter is the
        // finale AND its partner is an early-ending offender: the finale owns
        // the wrap-up, so the early ending is the one replaced.
        offenderNums.add(b.n === lastN && endingOffenders.has(a.n) ? a.n : b.n);
      }
    }
  }

  return {
    ok: pairs.length === 0 && issues.length === 0,
    critical: pairs.length > 0 || hardIssues > 0,
    issues,
    soft,
    pairs,
    offenderNums: [...offenderNums].sort((x, y) => x - y),
  };
}

/**
 * OUTLINEFIX-2: deterministic offender list - the chapters to replace.
 * For every duplicate pair the LATER chapter is the re-run; recap-marker
 * titles and second-plus uses of a recycle word are offenders directly.
 */
export function findOutlineOffenders(analysis) {
  return [...(analysis?.offenderNums || [])];
}

/**
 * OUTLINEFIX-2: targeted repair prompt - replace ONLY the offending chapters
 * with new escalating material. Generic; nothing book-specific.
 */
export function buildOutlineChapterRepairPrompt(chapters, offenderNums, chapterCount, context = {}) {
  const keepList = chapters
    .map(c => `Ch.${c.chapter_number}${offenderNums.includes(Number(c.chapter_number)) ? ' [REPLACE]' : ''}: ${c.title} - ${String(c.beat_summary || '').slice(0, 220)}`)
    .join('\n');
  const clip = (t, n) => String(t || '').slice(0, n);
  const canonBlock = (context.charactersMd || context.canonMd)
    ? `\nSTORY BIBLE (established canon - replacements must NEVER contradict this):\n${clip(context.charactersMd, 1600)}\n${clip(context.canonMd, 1600)}\n`
    : '';
  const advisories = (context.soft && context.soft.length)
    ? `\nADVISORY - also resolve these while replacing (events that appear more than once):\n${context.soft.slice(0, 8).map(x => '- ' + x).join('\n')}\n`
    : '';
  return `You are a world-class story architect. The chapter outline below contains chapters that RE-RUN events already covered by other chapters, end the story before the final chapter, or lost their content. You must REPLACE ONLY the chapters marked [REPLACE], keeping every other chapter exactly as it is.
${canonBlock}
CURRENT OUTLINE (${chapterCount} chapters):
${keepList}
${advisories}
REPLACEMENT REQUIREMENTS - for EACH chapter marked [REPLACE]:
- Invent a NEW development that appears nowhere else in the outline: a new complication, a new antagonist move, a new revelation, a new cost, a subplot escalation, or a hard reversal.
- CHRONOLOGY: the replacement must fit its exact position in the timeline. Respect where the characters ARE at that point (do not return them to a location the story has already left, do not use characters who are dead or gone by then).
- NO RETCONS: never contradict the story bible above. Never invent secret pasts, hidden allegiances, conspiracies, rival teams, ambushes, or communications channels that the bible does not establish. Deepen what exists instead of bolting on new machinery.
- The story ends EXACTLY ONCE, in chapter ${chapterCount}. No wrap-up language (open road, forever changed, embracing the future, breaking from the past) in any chapter before ${chapterCount}. No aftermath, epilogue, or wind-down chapters anywhere else.
- TITLE RULES: never use "Final", "Last", "Aftermath", "Revisited", "Continues", or "Part" in a title. Do not reuse a meaningful word from any other chapter title. Vary constructions - titles should be evocative and oblique, not literal event labels. English only.
- beat_summary must state the chapter's new development in concrete, specific terms (who, what changes, what it costs). English only.

Return JSON only: { "chapters": [ ... ] } containing EXACTLY ${offenderNums.length} items, one for each replaced chapter number: ${offenderNums.join(', ')}. Each item: {chapter_number, title, beat_summary}.`;
}

/**
 * OUTLINEFIX-2: splice replacements into the outline. Only offender numbers
 * are replaceable; replacements must have a real title and summary. Returns
 * { chapters, replaced } - replaced lists the chapter numbers actually used.
 */
export function spliceOutlineChapters(chapters, replacements, offenderNums) {
  const byNum = new Map();
  for (const r of (replacements || [])) {
    const n = Number(r?.chapter_number);
    if (!offenderNums.includes(n)) continue;
    if (!String(r?.title || '').trim() || String(r?.beat_summary || '').trim().length < 30) continue;
    byNum.set(n, { chapter_number: n, title: String(r.title).trim(), beat_summary: String(r.beat_summary).trim() });
  }
  const out = chapters.map(c => byNum.get(Number(c.chapter_number)) || c);
  return { chapters: out, replaced: [...byNum.keys()].sort((a, b) => a - b) };
}

/** OUTLINEFIX-2: regenerate outline_md from chapters after any splice. */
export function rebuildOutlineMd(chapters) {
  return (chapters || [])
    .map(c => `## Chapter ${c.chapter_number}: ${c.title}\n${c.beat_summary || ''}`)
    .join('\n\n');
}

/**
 * Hard rules appended to every fiction outline/repair prompt so the first
 * attempt is already constrained. Generic - nothing book-specific.
 */
export function buildOutlineDistinctnessRules(chapterCount) {
  return `
=== CHAPTER DISTINCTNESS ENFORCEMENT ===
- Every chapter must contain a NEW event that permanently changes the situation. NEVER re-run an event type already used in an earlier chapter (no second identical disaster, no second return to a location already used as its own chapter, no re-fought confrontation).
- The story ends EXACTLY ONCE, in chapter ${chapterCount}. Do not resolve the story in an earlier chapter and then continue. No epilogue-style chapters before ${chapterCount}.
- STRETCH RULE: the premise MUST fill all ${chapterCount} chapters with distinct material. Plan at least two subplot threads (for example: a relationship under strain, a rival agenda, a secret with a timer, a resource crisis) and braid them between main-plot chapters. Deepen the middle with complications, reversals, betrayals, discoveries, and costs. Every chapter's beat_summary must state its new development. Padding by repetition is forbidden; stretching by invention is required.
- TITLE RULES: never use "Final", "Last", "Aftermath", "Revisited", "Continues", or "Part" in a title. No meaningful word may appear in more than two chapter titles. Vary constructions - do not make every title "The X" or "The X of Y". Titles should be evocative and oblique, not literal event labels.
- WRAP-UP LANGUAGE (the open road, forever changed, embracing the future, breaking from the past, aftermath, epilogue) may appear ONLY in the final chapter's summary. English only in every title and summary.
=== END CHAPTER DISTINCTNESS ENFORCEMENT ===`;
}

/**
 * Retry appendix listing exactly what was wrong with the rejected outline.
 * (Kept for compatibility; OUTLINEFIX-2 prefers targeted chapter repair.)
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

console.log('[OUTLINE-DEDUPE] OUTLINEFIX-2 loaded: distinctness gate + targeted chapter repair loop');
