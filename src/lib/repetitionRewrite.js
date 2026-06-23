// src/lib/repetitionRewrite.js

// Lazy import for LLM
let _callAgent = null;
async function getCallAgent() {
  if (!_callAgent) {
    const mod = await import(/* @vite-ignore */ '@/lib/localLLM');
    _callAgent = mod.callAgent;
  }
  return _callAgent;
}

// Capitalized words that are almost always sentence-opening filler, not facts.
const LEADING_STOPWORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'by', 'at', 'for', 'from', 'when', 'while',
  'and', 'but', 'as', 'of', 'to', 'with', 'after', 'before', 'during',
  'through', 'across', 'over', 'under', 'since', 'until', 'because',
  'this', 'that', 'these', 'those', 'his', 'her', 'its', 'our',
  'your', 'my', 'they', 'it', 'he', 'she', 'we', 'i', 'if', 'so', 'yet',
  'then', 'there', 'here', 'what', 'which', 'who', 'whom', 'whose',
  'where', 'how', 'why', 'no', 'not', 'nor', 'though', 'although', 'even'
]);

// Shared opening-normalizer so the detector and global stats agree exactly.
function normalizeOpening(words) {
  return words.join(' ').toLowerCase().replace(/[.,!?;:"'()[\]{}]/g, '');
}

// Extract proper-noun "cores" for the fact guard.
// IMPORTANT: a capitalized word is [A-Z][a-z]... and the run does NOT include
// periods. The previous version allowed '.' inside words, which merged sentence
// boundaries like "Civil War. The" into a fake proper noun that no rewrite could
// preserve — causing the fact guard to reject every rewrite. This version stops
// each run at sentence punctuation.
function coreProperNouns(text) {
  const raw = text.match(/\b[A-Z][a-z][A-Za-z'\u2019-]*(?:\s+[A-Z][a-z][A-Za-z'\u2019-]*)+\b/g) || [];
  const out = new Set();
  for (const phrase of raw) {
    let parts = phrase.split(/\s+/);
    while (parts.length > 1 && LEADING_STOPWORDS.has(parts[0].toLowerCase())) parts.shift();
    if (parts.some(w => !LEADING_STOPWORDS.has(w.toLowerCase()))) {
      out.add(parts.join(' ').toLowerCase());
    }
  }
  return out;
}

// Boundary-safe fact check for ONE paragraph: every multi-word proper-noun core
// and every 4-digit year present in the original must still appear (as a
// substring, so "1970"->"the 1970s" is fine) in the rewrite.
function factsPreserved(original, rewrite) {
  const rl = rewrite.toLowerCase();
  for (const n of coreProperNouns(original)) {
    if (!rl.includes(n)) return false;
  }
  const years = [...new Set(original.match(/\b[12]\d{3}\b/g) || [])];
  for (const y of years) {
    if (!rl.includes(y)) return false;
  }
  return true;
}

// Cadence tic detector for one paragraph.
function hasCadenceTic(pText) {
  const escalatingMatch = pText.match(/(\b[a-zA-Z]{4,}\b)[^.]{0,40}\bwas\b[^.]{0,40}\1\b/i);
  if (escalatingMatch) {
    const word = escalatingMatch[1].toLowerCase();
    const skipList = ['that', 'this', 'there', 'what', 'when', 'they', 'with', 'from', 'were', 'have', 'been', 'which', 'their', 'about', 'would', 'could', 'should', 'some', 'many', 'much', 'more', 'most'];
    if (!skipList.includes(word)) return true;
  }
  if (((pText.match(/(?:^|[.?!]\s+)And\b/g) || []).length) >= 3) return true;
  if (/\bwas\b[^.?!]{0,20}\b(real|true|fake|wrong|right)[.?!]\s*(?:And\s+)?[^.?!]{0,20}\bwas\b[^.?!]{0,20}\1\b/i.test(pText)) return true;
  return false;
}

/**
 * Manuscript-wide table of paragraph openings. Any opening used >= threshold
 * times across the whole book is "overused" so cross-chapter repetition is caught.
 */
export function buildGlobalOpeningStats(chapterTexts, threshold = 3) {
  const counts = new Map();
  for (const text of (chapterTexts || [])) {
    if (!text || typeof text !== 'string') continue;
    const paragraphs = text.split(/(?:\r?\n\s*){2,}/).filter(p => p.trim().length > 0);
    for (const p of paragraphs) {
      const words = p.trim().split(/\s+/).slice(0, 4);
      if (words.length < 4) continue;
      counts.set(normalizeOpening(words), (counts.get(normalizeOpening(words)) || 0) + 1);
    }
  }
  const overused = new Set();
  for (const [opening, c] of counts) {
    if (c >= threshold) overused.add(opening);
  }
  return { counts, overused };
}

/**
 * Detects repeated openings (within chapter + manuscript-wide) and cadence tics.
 * Returns flag lists; used for reporting/logging.
 */
export function detectRepetition(chapterText, globalOverused = null) {
  const flags = { openings: [], cadence: [], hasFlags: false };
  if (!chapterText || typeof chapterText !== 'string') return flags;

  const hasGlobal = globalOverused && typeof globalOverused.has === 'function';
  const paragraphs = chapterText.split(/(?:\r?\n\s*){2,}/).filter(p => p.trim().length > 0);
  const openingMap = new Map();

  for (let i = 0; i < paragraphs.length; i++) {
    const pText = paragraphs[i].trim();
    if (!pText) continue;

    const words = pText.split(/\s+/).slice(0, 4);
    if (words.length >= 4) {
      const opening = normalizeOpening(words);
      const seenInChapter = openingMap.has(opening);
      const overusedGlobally = hasGlobal && globalOverused.has(opening);
      if (!seenInChapter) {
        openingMap.set(opening, i);
        if (overusedGlobally) {
          flags.openings.push({ paragraphIndex: i, opening, paragraphText: pText, scope: 'manuscript' });
          flags.hasFlags = true;
        }
      } else {
        flags.openings.push({ paragraphIndex: i, opening, paragraphText: pText, scope: 'chapter' });
        flags.hasFlags = true;
      }
    }

    if (hasCadenceTic(pText)) {
      flags.cadence.push({ sentence: pText });
      flags.hasFlags = true;
    }
  }

  return flags;
}

/**
 * Rewrites repeated spots ONE PARAGRAPH AT A TIME.
 *
 * The model only ever sees a single repeated paragraph and returns a single
 * rewritten paragraph. The chapter is reassembled in code by swapping that exact
 * paragraph in place. This eliminates the previous failure mode where the model
 * was asked to echo back a whole 4,000-word chapter and returned a truncated one
 * (which the length guard then correctly rejected, producing zero changes).
 *
 * @param {Object} args
 * @param {string} args.chapterText
 * @param {Object} args.chapter
 * @param {Object} args.project
 * @param {Function|null} args.callLLM   - optional (p, systemPrompt) => string
 * @param {Set<string>|null} args.globalOverused
 * @param {number} args.maxRewrites      - cap per chapter (runtime guard)
 */
export async function rewriteFlaggedSpots({ chapterText, chapter, project, callLLM = null, globalOverused = null, maxRewrites = 14 }) {
  if (!chapterText || typeof chapterText !== 'string') {
    return { ok: true, changed: false, text: chapterText, flags: { openings: [], cadence: [], hasFlags: false }, stats: { rewritten: 0, attempted: 0, skipped: 0 } };
  }

  const detection = detectRepetition(chapterText, globalOverused);
  if (!detection.hasFlags) {
    return { ok: true, changed: false, text: chapterText, flags: detection, stats: { rewritten: 0, attempted: 0, skipped: 0 } };
  }

  // Split into paragraphs AND separators so we can rejoin with exact whitespace.
  const segments = chapterText.split(/(\n{2,})/);
  const hasGlobal = globalOverused && typeof globalOverused.has === 'function';
  const seenOpenings = new Set();

  // Resolve the LLM caller (small, focused, single-paragraph call).
  let _callFn = callLLM;
  if (!_callFn) {
    const agent = await getCallAgent();
    _callFn = (p, sp) => agent({
      prompt: p,
      taskType: 'polish',
      project,
      temperature: 0.4,
      maxTokens: 1200,
      systemPromptOverride: sp
    });
  }

  const systemPrompt = `You are a line editor reducing repetition in investigative nonfiction. You will receive ONE paragraph. Rewrite it so it does NOT begin with the same opening words it currently has, and so any repetitive sentence rhythm is broken. Keep the same length, meaning, and tone. CRITICAL: change ZERO facts — preserve every name, date, place, number, and document title EXACTLY as written. Do not add or remove information. Return ONLY the rewritten paragraph — no preamble, no labels, no commentary.`;

  let rewritten = 0;
  let attempted = 0;
  let skipped = 0;

  for (let i = 0; i < segments.length; i += 2) {
    if (attempted >= maxRewrites) break;
    const seg = segments[i];
    if (!seg || !seg.trim()) continue;
    const trimmed = seg.trim();

    // Flag status for this paragraph.
    const words = trimmed.split(/\s+/).slice(0, 4);
    let flaggedOpening = false;
    let opening = null;
    if (words.length >= 4) {
      opening = normalizeOpening(words);
      const seen = seenOpenings.has(opening);
      const overused = hasGlobal && globalOverused.has(opening);
      if (seen || overused) flaggedOpening = true;
      seenOpenings.add(opening);
    }
    const flaggedCadence = hasCadenceTic(trimmed);
    if (!flaggedOpening && !flaggedCadence) continue;

    attempted++;

    let rw = '';
    try {
      rw = await _callFn(`PARAGRAPH:\n${trimmed}\n\n/no_think`, systemPrompt);
    } catch (err) {
      skipped++;
      continue;
    }
    if (typeof rw !== 'string') rw = rw?.text || rw?.content || String(rw || '');
    rw = rw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    rw = rw.split('\n').filter(line => {
      const l = line.trim().toLowerCase();
      return !(l.startsWith('here is') || l.startsWith('here are') || l.startsWith('rewritten') || l.startsWith('sure,') || l.startsWith('certainly') || l.startsWith('paragraph:'));
    }).join('\n').trim();

    if (!rw) { skipped++; continue; }

    // Per-paragraph length sanity (catch truncation/runaway).
    if (rw.length < trimmed.length * 0.5 || rw.length > trimmed.length * 2.2) { skipped++; continue; }

    // Boundary-safe fact guard on just this paragraph.
    if (!factsPreserved(trimmed, rw)) { skipped++; continue; }

    // If the opening was the problem and the model didn't actually change it, skip.
    const newWords = rw.split(/\s+/).slice(0, 4);
    const newOpening = newWords.length >= 4 ? normalizeOpening(newWords) : null;
    if (flaggedOpening && !flaggedCadence && newOpening === opening) { skipped++; continue; }

    // Accept: swap the paragraph back in, preserving its surrounding whitespace.
    const lead = seg.match(/^\s*/)[0];
    const trail = seg.match(/\s*$/)[0];
    segments[i] = lead + rw + trail;
    if (newOpening) seenOpenings.add(newOpening);
    rewritten++;
  }

  return {
    ok: true,
    changed: rewritten > 0,
    text: segments.join(''),
    flags: detection,
    stats: { rewritten, attempted, skipped }
  };
}
