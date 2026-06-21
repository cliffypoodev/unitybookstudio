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

// Capitalized words that are almost always sentence-opening artifacts, not facts.
// Used to (a) normalize proper-noun phrases before the fact check, and
// (b) strip leading filler so "The National Archives" and "National Archives"
// are treated as the same fact.
const LEADING_STOPWORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'by', 'at', 'for', 'from', 'when', 'while',
  'and', 'but', 'as', 'of', 'to', 'with', 'after', 'before', 'during',
  'through', 'across', 'over', 'under', 'since', 'until', 'because',
  'this', 'that', 'these', 'those', 'his', 'her', 'their', 'its', 'our',
  'your', 'my', 'they', 'it', 'he', 'she', 'we', 'i', 'if', 'so', 'yet',
  'then', 'there', 'here', 'what', 'which', 'who', 'whom', 'whose',
  'where', 'how', 'why', 'no', 'not', 'nor', 'though', 'although', 'even'
]);

// Shared opening-normalizer so the detector and the global stats agree exactly.
function normalizeOpening(words) {
  return words.join(' ').toLowerCase().replace(/[.,!?;:"'()[\]{}]/g, '');
}

/**
 * Builds a manuscript-wide table of paragraph openings.
 * Pass ALL chapter texts; any opening used >= threshold times across the whole
 * book is marked "overused" so it can be flagged even when it appears only once
 * inside a given chapter (the cross-chapter repetition the per-chapter detector
 * is blind to).
 *
 * @param {string[]} chapterTexts
 * @param {number} threshold
 * @returns {{counts: Map<string, number>, overused: Set<string>}}
 */
export function buildGlobalOpeningStats(chapterTexts, threshold = 3) {
  const counts = new Map();
  for (const text of (chapterTexts || [])) {
    if (!text || typeof text !== 'string') continue;
    const paragraphs = text.split(/(?:\r?\n\s*){2,}/).filter(p => p.trim().length > 0);
    for (const p of paragraphs) {
      const words = p.trim().split(/\s+/).slice(0, 4);
      if (words.length < 4) continue;
      const opening = normalizeOpening(words);
      counts.set(opening, (counts.get(opening) || 0) + 1);
    }
  }
  const overused = new Set();
  for (const [opening, c] of counts) {
    if (c >= threshold) overused.add(opening);
  }
  return { counts, overused };
}

/**
 * Detects repetition patterns:
 * (A) Repeated paragraph openings (first 4 words)
 *     - within this chapter (any opening seen 2+ times), AND
 *     - across the whole manuscript (if globalOverused is supplied, the FIRST
 *       occurrence in this chapter is also flagged when the opening is overused
 *       book-wide).
 * (B) Cadence tics (escalating fragments with 'was', 3+ '. And' fragments, or
 *     'X was real. And Y was real')
 *
 * @param {string} chapterText - The chapter text to analyze
 * @param {Set<string>|null} globalOverused - optional manuscript-wide overused openings
 * @returns {Object} flags
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

    // (A) REPEATED PARAGRAPH OPENINGS
    const words = pText.split(/\s+/).slice(0, 4);
    if (words.length >= 4) {
      const opening = normalizeOpening(words);
      const seenInChapter = openingMap.has(opening);
      const overusedGlobally = hasGlobal && globalOverused.has(opening);

      if (!seenInChapter) {
        openingMap.set(opening, i);
        // First time in THIS chapter, but if it's a book-wide offender, flag it
        // so cross-chapter repetition gets varied too.
        if (overusedGlobally) {
          flags.openings.push({ paragraphIndex: i, opening, paragraphText: pText, scope: 'manuscript' });
          flags.hasFlags = true;
        }
      } else {
        flags.openings.push({ paragraphIndex: i, opening, paragraphText: pText, scope: 'chapter' });
        flags.hasFlags = true;
      }
    }

    // (B) CADENCE TIC
    let hasCadence = false;

    // Pattern 1: Escalating fragment pattern (word ... was ... same word)
    const escalatingMatch = pText.match(/(\b[a-zA-Z]{4,}\b)[^.]{0,40}\bwas\b[^.]{0,40}\1\b/i);
    if (escalatingMatch) {
      const word = escalatingMatch[1].toLowerCase();
      const skipList = ['that', 'this', 'there', 'what', 'when', 'they', 'with', 'from', 'were', 'have', 'been', 'which', 'their', 'about', 'would', 'could', 'should', 'some', 'many', 'much', 'more', 'most'];
      if (!skipList.includes(word)) {
        hasCadence = true;
      }
    }

    // Pattern 2: 3+ occurrences of ". And " starting fragments
    const andCount = (pText.match(/(?:^|[.?!]\s+)And\b/g) || []).length;
    if (andCount >= 3) {
      hasCadence = true;
    }

    // Pattern 3: "X was real. And Y was real." (repeated "real"/"was" fragments)
    if (/\bwas\b[^.?!]{0,20}\b(real|true|fake|wrong|right)[.?!]\s*(?:And\s+)?[^.?!]{0,20}\bwas\b[^.?!]{0,20}\1\b/i.test(pText)) {
      hasCadence = true;
    }

    if (hasCadence) {
      flags.cadence.push({ sentence: pText });
      flags.hasFlags = true;
    }
  }

  return flags;
}

// Extract proper-noun "cores" robust to opening variation:
// strips leading capitalized filler so "The National Archives" -> "national archives".
function coreProperNouns(text) {
  const raw = text.match(/\b[A-Z][A-Za-z.&'’-]*(?:\s+[A-Z][A-Za-z.&'’-]*)+\b/g) || [];
  const out = new Set();
  for (const phrase of raw) {
    let parts = phrase.split(/\s+/);
    while (parts.length > 1 && LEADING_STOPWORDS.has(parts[0].toLowerCase())) {
      parts.shift();
    }
    // Keep only if something meaningful remains (not all filler).
    if (parts.some(w => !LEADING_STOPWORDS.has(w.toLowerCase()))) {
      out.add(parts.join(' ').toLowerCase());
    }
  }
  return out;
}

/**
 * Rewrites flagged repetition spots using the LLM.
 *
 * @param {Object} args
 * @param {string} args.chapterText
 * @param {Object} args.chapter
 * @param {Object} args.project
 * @param {Function|null} args.callLLM
 * @param {Set<string>|null} args.globalOverused - manuscript-wide overused openings
 */
export async function rewriteFlaggedSpots({ chapterText, chapter, project, callLLM = null, globalOverused = null }) {
  // 1. Run detection (manuscript-aware if globalOverused supplied)
  const detection = detectRepetition(chapterText, globalOverused);
  if (!detection.hasFlags) {
    return { ok: true, changed: false, text: chapterText, flags: detection };
  }

  // 2. Build prompt
  let flaggedTextList = '';
  detection.openings.forEach((o, i) => {
    flaggedTextList += `[Opening Repetition ${i + 1}]:\n${o.paragraphText}\n\n`;
  });
  detection.cadence.forEach((c, i) => {
    flaggedTextList += `[Cadence Repetition ${i + 1}]:\n${c.sentence}\n\n`;
  });

  const prompt = `CHAPTER TEXT:\n${chapterText}\n\n---\nFLAGGED SENTENCES TO REWRITE:\n${flaggedTextList.trim()}\n\n/no_think`;

  const systemPrompt = `You are a line editor fixing repetition in investigative nonfiction. You will be given specific sentences that repeat openings or rhythms. Rewrite ONLY those sentences to vary their opening words and break repetitive cadence. CRITICAL RULES: Change ZERO facts. Preserve every name, date, place, document title, and number EXACTLY as written. Do not add information. Do not remove information. Do not merge or split paragraphs. Return the full chapter text with only the flagged sentences rewritten, nothing else — no preamble, no labels, no commentary.`;

  // 3. Call LLM
  let _callFn = callLLM;
  if (!_callFn) {
    const agent = await getCallAgent();
    _callFn = (p, sp) => agent({
      prompt: p,
      taskType: 'polish',
      project,
      temperature: 0.3,
      maxTokens: Math.max(8192, Math.ceil(chapterText.length / 3)),
      systemPromptOverride: sp
    });
  }

  let raw = '';
  try {
    raw = await _callFn(prompt, systemPrompt);
  } catch (err) {
    return { ok: false, changed: false, text: chapterText, reason: err.message, flags: detection };
  }

  if (typeof raw !== 'string') {
    raw = raw?.text || raw?.content || String(raw || '');
  }

  // Strip any Qwen think block that slipped through, then leading commentary lines.
  raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  raw = raw.split('\n').filter(line => {
    const lower = line.trim().toLowerCase();
    if (lower.startsWith('here is') || lower.startsWith('here are') || lower.startsWith('rewritten:') || lower.startsWith('sure,') || lower.startsWith('certainly')) {
      return false;
    }
    return true;
  }).join('\n').trim();

  // 4. Fact-preservation check — TOLERANT of opening variation, still catches real drops.
  //    Nouns: compare proper-noun "cores" by substring containment so dropping a
  //    leading "The"/"In"/"By" (the rewriter's whole job) is NOT a false alarm,
  //    but actually deleting "Granger" or "Galveston" still is.
  const rewriteLower = raw.toLowerCase();
  const originalNouns = coreProperNouns(chapterText);
  const missingNouns = [...originalNouns].filter(core => !rewriteLower.includes(core));

  //    Years: substring match so "1970" survives inside "1970s" (the harmonization
  //    that previously tripped a false alarm), while a genuinely dropped year fails.
  const originalYears = [...new Set(chapterText.match(/\b[12]\d{3}\b/g) || [])];
  const missingYears = originalYears.filter(y => !rewriteLower.includes(y));

  //    Length sanity: reject suspicious truncation (silent loss of half a chapter).
  const tooShort = raw.trim().length < chapterText.trim().length * 0.7;

  if (missingNouns.length > 0 || missingYears.length > 0 || tooShort) {
    const reasonParts = [];
    if (missingNouns.length) reasonParts.push(`nouns: ${missingNouns.join(', ')}`);
    if (missingYears.length) reasonParts.push(`years: ${missingYears.join(', ')}`);
    if (tooShort) reasonParts.push('output too short (possible truncation)');
    return {
      ok: false,
      changed: false,
      text: chapterText,
      reason: `fact/length check failed — ${reasonParts.join('; ')}`,
      flags: detection
    };
  }

  // 5. On success
  return { ok: true, changed: true, text: raw, flags: detection };
}
