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

/**
 * Detects repetition patterns:
 * (A) Repeated paragraph openings (first 4 words)
 * (B) Cadence tics (escalating fragments with 'was', 3+ '. And' fragments, or 'X was real. And Y was real')
 *
 * @param {string} chapterText - The chapter text to analyze
 * @returns {Object} flags
 */
export function detectRepetition(chapterText) {
  const flags = { openings: [], cadence: [], hasFlags: false };
  if (!chapterText || typeof chapterText !== 'string') return flags;

  const paragraphs = chapterText.split(/(?:\r?\n\s*){2,}/).filter(p => p.trim().length > 0);
  const openingMap = new Map();

  for (let i = 0; i < paragraphs.length; i++) {
    const pText = paragraphs[i].trim();
    if (!pText) continue;
    
    // (A) REPEATED PARAGRAPH OPENINGS
    const words = pText.split(/\s+/).slice(0, 4);
    if (words.length >= 4) {
      const opening = words.join(' ').toLowerCase().replace(/[.,!?;:"'()[\]{}]/g, '');
      if (!openingMap.has(opening)) {
        openingMap.set(opening, i);
      } else {
        flags.openings.push({ paragraphIndex: i, opening, paragraphText: pText });
        flags.hasFlags = true;
      }
    }

    // (B) CADENCE TIC
    let hasCadence = false;

    // Pattern 1: Escalating fragment pattern
    // / (\b\w+\b)[^.]{0,40}\bwas\b[^.]{0,40}\1\b /i
    // We restrict to words >= 4 chars and exclude common stopwords to be conservative.
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

/**
 * Rewrites flagged repetition spots using the LLM.
 */
export async function rewriteFlaggedSpots({ chapterText, chapter, project, callLLM = null }) {
  // 1. Run detection
  const detection = detectRepetition(chapterText);
  if (!detection.hasFlags) {
    return { ok: true, changed: false, text: chapterText, flags: detection };
  }

  // 3. Build prompt
  let flaggedTextList = '';
  detection.openings.forEach((o, i) => {
    flaggedTextList += `[Opening Repetition ${i + 1}]:\n${o.paragraphText}\n\n`;
  });
  detection.cadence.forEach((c, i) => {
    flaggedTextList += `[Cadence Repetition ${i + 1}]:\n${c.sentence}\n\n`;
  });

  const prompt = `CHAPTER TEXT:\n${chapterText}\n\n---\nFLAGGED SENTENCES TO REWRITE:\n${flaggedTextList.trim()}`;

  const systemPrompt = `You are a line editor fixing repetition in investigative nonfiction. You will be given specific sentences that repeat openings or rhythms. Rewrite ONLY those sentences to vary their opening words and break repetitive cadence. CRITICAL RULES: Change ZERO facts. Preserve every name, date, place, document title, and number EXACTLY as written. Do not add information. Do not remove information. Do not merge or split paragraphs. Return the full chapter text with only the flagged sentences rewritten, nothing else — no preamble, no labels, no commentary.`;

  // 4. Call LLM
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

  // 6. Strip leading commentary lines
  raw = raw.split('\n').filter(line => {
    const lower = line.trim().toLowerCase();
    if (lower.startsWith('here is') || lower.startsWith('here are') || lower.startsWith('rewritten:') || lower.startsWith('sure,') || lower.startsWith('certainly')) {
      return false;
    }
    return true;
  }).join('\n').trim();

  // 5. Fact-preservation check
  function extractTokens(text) {
    // Extract capitalized multi-word proper nouns
    const properNouns = text.match(/\b[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)+\b/g) || [];
    // Extract 4-digit years
    const years = text.match(/\b[12]\d{3}\b/g) || [];
    return { properNouns: new Set(properNouns), years: new Set(years) };
  }

  const originalTokens = extractTokens(chapterText);
  const rewrittenTokens = extractTokens(raw);

  const missingNouns = [...originalTokens.properNouns].filter(n => !rewrittenTokens.properNouns.has(n));
  const missingYears = [...originalTokens.years].filter(y => !rewrittenTokens.years.has(y));

  if (missingNouns.length > 0 || missingYears.length > 0) {
    const missing = [...missingNouns, ...missingYears].join(', ');
    return { 
      ok: false, 
      changed: false, 
      text: chapterText, 
      reason: `fact-preservation check failed: ${missing}`, 
      flags: detection 
    };
  }

  // 7. On success
  return { ok: true, changed: true, text: raw, flags: detection };
}
