import { isNonfictionProject as isNonfictionProjectAuthority } from '@/lib/projectType'; // NFCLASS-1
/**
 * Pure mechanical manuscript analysis — no LLM involved.
 * Used by the Review tab dashboard and chapter issue popups.
 */

const BANNED_WORDS = [
  'shimmering','luminous','tapestry','intricate','meticulously',
  'insatiable','palpable','unmistakable','undeniable','relentless',
  'sprawling','labyrinthine','opulent','resplendent','ethereal',
  'visceral','cacophony','crescendo','juxtaposition','myriad',
  'plethora','testament','harbinger','paradigm','dichotomy',
  'multifaceted','aforementioned','nonetheless','furthermore',
  'henceforth','commence','utilize','endeavor','pertaining',
];

const COMMON_SKIP = [
  'of the','in the','to the','on the','at the','and the','for the',
  'was the','from the','with the','into the','that the','but the',
  'had been','would be','could be','did not','was not','had not',
  'she had','he had','she was','he was','her eyes','his eyes',
  'she said','he said','they had','it was','there was','back to',
  'out of','up to','one of','down the','through the','over the',
  'around the','about the','under the','after the','before the',
  'between the','across the','along the','toward the','against the',
  'looked at','turned to','moved to','went to','came to','not the',
  'all the','like the','than the','just the','even the','only the',
  'the floor','the door','the wall','the room','the air','the light',
  'the dark','the ground','the table','the chair','the bed','the window',
  'the screen','the glass','the metal','the stone','the water','the fire',
  'the sky','the sun','the rain','the wind','the night','the day',
  'the street','the road','the car','the building','the house','the city',
  'the man','the woman','the girl','the boy','the child','the old',
  'the other','the first','the last','the next','the same','the new',
  'the only','the whole','the entire','the rest','the end','the top',
  'the bottom','the side','the back','the front','the edge','the center',
  'the hand','the head','the face','the body','the eyes','the mouth',
  'the voice','the sound','the noise','the word','the words','the name',
  'they were','they had','she could','he could','she would','he would',
  'they could','they would','she did','he did','she went','he went',
  'could not','would not','did not','had not','was not','were not',
  'might be','must be','should be','will be','can be',
  'the left','the right','the north','the south','the east','the west',
  'the corner','the hall','the corridor','the stairs','the ceiling',
  'the passage','the entrance','the exit',
];

/**
 * Count ACTUAL capitalization errors — lowercase letters following a full
 * sentence-ending punctuation mark, EXCLUDING:
 *   - ellipses (`...`) used as a stylistic pause/trailing in dialogue
 *   - abbreviations (`Dr. smith`, `Mr. brown`, etc.)
 *
 * The naive regex `/[.!?]\s+[a-z]/g` counts every ellipsis-followed-by-
 * lowercase as a capitalization error. An 86K-word manuscript with 60
 * dialogue ellipses was taking a -58 hit on Clean Score (dropping the
 * manuscript from ~95% to 37%) purely from stylistic ellipses. This
 * matches the guard that the Polish capitalization-fix pass already
 * applies — scoring should not be stricter than cleanup.
 */
function countCapErrors(text) {
  let count = 0;
  const rx = /[.!?]\s+[a-z]/g;
  let m;
  while ((m = rx.exec(text)) !== null) {
    const offset = m.index;
    // Skip ellipses: preceding char is also a period
    if (offset >= 1 && text[offset - 1] === '.') continue;
    // Skip abbreviations: "Dr. smith" — capital-then-lowercase before the period
    if (offset >= 2 && /[A-Z][a-z]/.test(text.substring(offset - 2, offset))) continue;
    count++;
  }
  return count;
}

/**
 * Count assistant-scaffolding leaks. Matches only AT paragraph start, line
 * start, or immediately after a sentence-ending punctuation mark — not
 * mid-sentence. Prevents false positives like dialogue containing the
 * string "around here is the chili" from flagging the whole manuscript.
 *
 * Real scaffolds ("Here is the chapter...", "Let me know if...", "This
 * chapter will explore...") always appear at the START of an assistant's
 * response, not buried inside prose. So we anchor to sentence/paragraph
 * boundaries and accept nothing less.
 */
function countScaffolds(text) {
  const rx = /(?:^|\n\n|\n|[.!?]\s+)(This chapter will|Here is the|I've written|Let me know if|Here's the|Below is)\b/gi;
  return (text.match(rx) || []).length;
}

/**
 * Count hanging quotation marks (smart + straight) in a text block.
 */
function countHangingQuotes(text) {
  const smartOpen = (text.match(/\u201c/g) || []).length;
  const smartClose = (text.match(/\u201d/g) || []).length;
  const hangingSmart = Math.abs(smartOpen - smartClose);
  let straightHanging = 0;
  const paras = text.split(/\n\n+/);
  for (const p of paras) {
    const sq = (p.match(/"/g) || []).length;
    if (sq % 2 !== 0) straightHanging++;
  }
  return hangingSmart + straightHanging;
}

const AI_FAVORITE_WORDS = [
  'etched', 'resonance', 'profound', 'cascade', 'tangible',
  'symphony', 'geometry', 'crystalline', 'ephemeral', 'liminal', 'fractured',
  'calibrated', 'orchestrated', 'tableau', 'cacophony', 'crescendo',
  'tapestry', 'juxtaposition', 'dichotomy', 'paradigm', 'plethora',
  'harbinger', 'myriad', 'nuance', 'testament',
];

function countAiFavorites(text, wordCount) {
  let total = 0;
  for (const word of AI_FAVORITE_WORDS) {
    const rx = new RegExp('\\b' + word + '\\b', 'gi');
    const m = text.match(rx);
    if (m) total += m.length;
  }
  const per10k = wordCount > 0 ? Math.round(total / wordCount * 10000 * 10) / 10 : 0;
  return { count: total, per10k };
}

/**
 * Count predictable AI-fingerprint phrases in text.
 */
const PREDICTABLE_PATTERNS = [
  /\bIt is important to note that\b/gi,
  /\bIt is worth mentioning that\b/gi,
  /\bIn order to\b/gi,
  /\bDue to the fact that\b/gi,
  /\bAt the end of the day\b/gi,
  /\bA wide range of\b/gi,
  /\bPlays a crucial role\b/gi,
  /\bIn today'?s world\b/gi,
  /\bIt should be noted\b/gi,
  /\bFurthermore,/gi,
  /\bMoreover,/gi,
  /\bAdditionally,/gi,
  /\bConsequently,/gi,
  /\bNevertheless,/gi,
  /\bthe fact that\b/gi,
  /\bfor the purpose of\b/gi,
  /\bin the process of\b/gi,
  /\bas a result of\b/gi,
];

function countPredictablePhrases(text) {
  let count = 0;
  for (const rx of PREDICTABLE_PATTERNS) {
    rx.lastIndex = 0;
    const m = text.match(rx);
    if (m) count += m.length;
  }
  return count;
}

/**
 * Calculate burstiness (sentence length std dev) for a block of text.
 */
function computeBurstiness(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  if (lengths.length < 5) return { burstiness: 99, avg: 0, rating: 'N/A' };
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const rating = stdDev > 10 ? 'Excellent' : stdDev > 8 ? 'Good' : stdDev > 6 ? 'Fair' : 'Flat';
  return { burstiness: stdDev, avg, rating };
}

/**
 * Calculate stats for a block of text (whole manuscript or single chapter).
 */
export function calculateManuscriptStats(text, options) {
  if (!text || text.length < 50) {
    return { bannedWords: 0, voiceWas: 0, shuddered: 0, theSilence: 0, suddenly: 0, somehow: 0, repetitionTotal: 0, cleanScore: 0, capErrors: 0, scaffolds: 0, hangingQuotes: 0, burstiness: 0, burstinessRating: 'N/A', avgSentenceLength: 0 };
  }

  let bannedCount = 0;
  const bannedFound = [];
  for (const word of BANNED_WORDS) {
    const rx = new RegExp('\\b' + word + '\\b', 'gi');
    const m = text.match(rx) || [];
    if (m.length > 0) {
      bannedCount += m.length;
      bannedFound.push({ word, count: m.length });
    }
  }

  const voiceWas = (text.match(/\b(his|her) voice was\b/gi) || []).length;
  const shuddered = (text.match(/\bshuddered\b/gi) || []).length;
  const theSilence = (text.match(/\bthe silence\b/gi) || []).length;
  const suddenly = (text.match(/\bsuddenly\b/gi) || []).length;
  const somehow = (text.match(/\bsomehow\b/gi) || []).length;
  const whispered = (text.match(/\bwhispered\b/gi) || []).length;
  const clenched = (text.match(/\bclenched\b/gi) || []).length;

  const repetitionTotal = shuddered + theSilence + suddenly + somehow;
  const capErrors = countCapErrors(text);
  const scaffolds = countScaffolds(text);
  const hangingQuotes = countHangingQuotes(text);

  const wordCount = text.split(/\s+/).length;
  const scaleFactor = wordCount / 50000;
  const isComedyText = options?.isComedy || false;
  const isAnthology = options?.isAnthology || false;
  const chapterCount = options?.chapterCount || 1;

  // Anthology multiplier: each chapter is a standalone story with unique characters.
  // Words like "whispered", "suddenly", "the silence" appearing once per story
  // are NOT overuse — they're independent voices. Scale thresholds by chapter count.
  const anthologyScale = isAnthology ? Math.max(1, chapterCount * 0.6) : 1;

  // ── SCORING THRESHOLDS ──
  // Aligned with Polish fix thresholds: if Polish considers a metric "clean"
  // (doesn't try to fix it), the score should NOT penalize for it.
  // Deductions only apply when metrics EXCEED these thresholds.

  let cleanScore = 100;

  // Banned words: -2 per word (threshold: 0 — Polish removes all)
  // For anthologies: allow ~1 per 2 stories (some words are legitimate in context)
  const bannedThreshold = isAnthology ? Math.round(chapterCount * 0.5) : 0;
  cleanScore -= Math.max(0, bannedCount - bannedThreshold) * 2;

  // Voice patterns: threshold 10 per 50K — Polish doesn't fix under this
  const voiceThreshold = Math.max(10, Math.round(10 * scaleFactor * anthologyScale));
  cleanScore -= Math.max(0, voiceWas - voiceThreshold) * 1;

  // Repetition words: scale-aware thresholds
  const shudderThreshold = Math.max(8, Math.round(8 * scaleFactor * anthologyScale));
  cleanScore -= Math.max(0, shuddered - shudderThreshold) * 1;
  const silenceThreshold = Math.max(10, Math.round(10 * scaleFactor * anthologyScale));
  cleanScore -= Math.max(0, theSilence - silenceThreshold) * 1;
  const suddenlyThreshold = Math.max(isComedyText ? 10 : 5, Math.round((isComedyText ? 10 : 5) * scaleFactor * anthologyScale));
  cleanScore -= Math.max(0, suddenly - suddenlyThreshold) * 1;

  // Cap errors: -1 per error, but only beyond 3 (minor tolerance)
  cleanScore -= Math.min(Math.max(0, capErrors - 3), 15);

  // Scaffolds: -5 per instance (no tolerance — these should never exist)
  cleanScore -= scaffolds * 5;

  // Hanging quotes: -2 per quote (threshold: 0 — Polish fixes all)
  cleanScore -= Math.min(hangingQuotes * 2, 10);

  // Burstiness deduction — only penalize truly flat prose (< 5)
  const { burstiness, avg: sentAvg, rating: burstinessRating } = computeBurstiness(text);
  if (burstiness < 5) cleanScore -= 3;

  // Predictable phrase deduction — more generous threshold
  const predictablePhrases = countPredictablePhrases(text);
  const predictableThreshold = Math.round(Math.max(wordCount / 50000, 1) * 8);
  if (predictablePhrases > predictableThreshold) {
    cleanScore -= Math.min(Math.round((predictablePhrases - predictableThreshold) * 0.5), 8);
  }

  // AI vocabulary density deduction — threshold aligned with Polish (clean under 3.0/10K)
  const aiFav = countAiFavorites(text, wordCount);
  if (aiFav.per10k > 10) cleanScore -= 5;
  else if (aiFav.per10k > 7) cleanScore -= 3;
  else if (aiFav.per10k > 5) cleanScore -= 1;
  // Under 5.0/10K: no penalty (Polish considers under 3.0 clean, 3-5 marginal)

  cleanScore = Math.max(0, Math.min(100, cleanScore));
  const estimatedPages = Math.ceil(wordCount / 250);

  return {
    bannedWords: bannedCount, bannedFound, voiceWas, shuddered, theSilence,
    suddenly, somehow, whispered, clenched, repetitionTotal,
    cleanScore, capErrors, scaffolds, hangingQuotes,
    burstiness: Math.round(burstiness * 10) / 10,
    burstinessRating,
    avgSentenceLength: Math.round(sentAvg * 10) / 10,
    predictablePhrases,
    aiFavoriteCount: aiFav.count, aiFavoritePer10k: aiFav.per10k,
    wordCount, estimatedPages,
    thresholds: { voiceWas: voiceThreshold, shuddered: shudderThreshold, theSilence: silenceThreshold, suddenly: suddenlyThreshold },
  };
}

/**
 * Get specific issues for a single chapter (for the popup).
 */
export function getChapterIssues(text, options) {
  if (!text || text.length < 50) return [{ type: 'No Content', detail: 'Chapter has no draft content', severity: 'error' }];
  const isComedy = options?.isComedy || false;
  const issues = [];
  for (const word of BANNED_WORDS) {
    const rx = new RegExp('\\b' + word + '\\b', 'gi');
    const m = text.match(rx) || [];
    if (m.length > 0) issues.push({ type: 'Banned Word', detail: `"${word}" × ${m.length}`, severity: 'warning' });
  }
  const voiceWas = (text.match(/\b(his|her) voice was\b/gi) || []).length;
  if (voiceWas > 2) issues.push({ type: 'Voice Pattern', detail: `"his/her voice was" × ${voiceWas} (max 2)`, severity: 'warning' });
  const shuddered = (text.match(/\bshuddered\b/gi) || []).length;
  if (shuddered > 2) issues.push({ type: 'Repetition', detail: `"shuddered" × ${shuddered} (max 2)`, severity: 'warning' });
  const suddenly = (text.match(/\bsuddenly\b/gi) || []).length;
  const suddenlyMax = isComedy ? 3 : 1;
  if (suddenly > suddenlyMax) issues.push({ type: 'Lazy Word', detail: `"suddenly" × ${suddenly} (max ${suddenlyMax})`, severity: 'warning' });
  const theSilence = (text.match(/\bthe silence\b/gi) || []).length;
  if (theSilence > 2) issues.push({ type: 'Repetition', detail: `"the silence" × ${theSilence} (max 2)`, severity: 'warning' });
  const somehow = (text.match(/\bsomehow\b/gi) || []).length;
  if (!isComedy && somehow > 1) issues.push({ type: 'Lazy Word', detail: `"somehow" × ${somehow} (max 1)`, severity: 'warning' });
  const whispered = (text.match(/\bwhispered\b/gi) || []).length;
  if (whispered > 4) issues.push({ type: 'Repetition', detail: `"whispered" × ${whispered} (max 4)`, severity: 'info' });
  const capErrors = countCapErrors(text);
  if (capErrors > 0) issues.push({ type: 'Capitalization', detail: `${capErrors} sentences start lowercase`, severity: 'warning' });
  const scaffoldCount = countScaffolds(text);
  if (scaffoldCount > 0) issues.push({ type: 'AI Leak', detail: `${scaffoldCount} assistant scaffolding phrases found`, severity: 'error' });
  const chHanging = countHangingQuotes(text);
  if (chHanging > 0) issues.push({ type: 'Grammar', detail: `${chHanging} unclosed quotation mark${chHanging > 1 ? 's' : ''} (smart + straight)`, severity: 'warning' });
  const bannedPhrases = [/in that moment/gi, /waves of (pleasure|sensation|emotion|feeling|heat|relief|desire|pain)/gi, /washed over (him|her|them|me|us)/gi, /threatened to overwhelm/gi, /couldn't help but/gi, /heart pounded in (his|her|their) chest/gi, /a knowing smile/gi];
  for (const rx of bannedPhrases) {
    rx.lastIndex = 0;
    const m = text.match(rx) || [];
    if (m.length > 0) issues.push({ type: 'Cliché', detail: `"${m[0]}" × ${m.length}`, severity: 'info' });
  }
  return issues;
}

export function isComedyProject(project) {
  const genre = (project?.genre || '').toLowerCase();
  const beat = (project?.beat_style || project?.scene_beat_style || '').toLowerCase();
  return genre.includes('comedy') || genre.includes('satir') || genre.includes('humor') || genre.includes('absurd') || genre.includes('parody') || genre.includes('caper') || beat.includes('comedy') || beat.includes('screwball') || beat.includes('deadpan') || beat.includes('dry wit') || beat.includes('absurdist') || beat.includes('caper');
}

// NFCLASS-1: one authority. See src/lib/projectType.js.
export function isNonfictionProject(project) {
  return isNonfictionProjectAuthority(project);
}

export function isEroticaProject(project) {
  if (project?.project_type === 'erotica') return true;
  const genre = (project?.genre || '').toLowerCase();
  return genre.includes('erotica') || (project?.spice_level && project.spice_level >= 3);
}

const NF_BANNED_WORDS = [
  'shimmering','luminous','tapestry','opulent','resplendent','ethereal',
  'cacophony','crescendo','harbinger','labyrinthine','sprawling','insatiable',
  'multifaceted','aforementioned','henceforth','pertaining','endeavor',
  'arguably','interestingly','remarkably','notably','undoubtedly','unquestionably',
];

/**
 * Nonfiction-aware manuscript stats — more lenient on analytical vocabulary.
 */
export function calculateManuscriptStatsNonfiction(text) {
  if (!text || text.length < 50) {
    return { bannedWords: 0, voiceWas: 0, shuddered: 0, suddenly: 0, somehow: 0, repetitionTotal: 0, cleanScore: 0, capErrors: 0, scaffolds: 0, hangingQuotes: 0, burstiness: 0, burstinessRating: 'N/A', avgSentenceLength: 0, isNonfiction: true };
  }

  const wordCount = text.split(/\s+/).length;
  const scaleFactor = wordCount / 50000;

  let bannedCount = 0;
  const bannedFound = [];
  for (const word of NF_BANNED_WORDS) {
    const rx = new RegExp('\\b' + word + '\\b', 'gi');
    const m = text.match(rx) || [];
    if (m.length > 0) { bannedCount += m.length; bannedFound.push({ word, count: m.length }); }
  }

  const voiceWas = (text.match(/\b(his|her) voice was\b/gi) || []).length;
  const shuddered = (text.match(/\bshuddered\b/gi) || []).length;
  const suddenly = (text.match(/\bsuddenly\b/gi) || []).length;
  const somehow = (text.match(/\bsomehow\b/gi) || []).length;
  const repetitionTotal = shuddered + suddenly + somehow;
  const capErrors = countCapErrors(text);
  const scaffolds = countScaffolds(text);
  const hangingQuotes = countHangingQuotes(text);

  let cleanScore = 100;
  cleanScore -= bannedCount * 2;
  cleanScore -= Math.max(0, shuddered - Math.max(8, Math.round(8 * scaleFactor))) * 1;
  cleanScore -= Math.max(0, suddenly - Math.max(5, Math.round(5 * scaleFactor))) * 1;
  cleanScore -= Math.max(0, somehow - Math.max(3, Math.round(3 * scaleFactor))) * 1;
  cleanScore -= Math.min(Math.max(0, capErrors - 3), 15);
  cleanScore -= scaffolds * 5;
  cleanScore -= Math.min(hangingQuotes * 2, 10);

  const { burstiness: nfBurst, avg: nfSentAvg, rating: nfBurstRating } = computeBurstiness(text);
  if (nfBurst < 5) cleanScore -= 3;

  const nfPredictable = countPredictablePhrases(text);
  const nfPredThreshold = Math.round(Math.max(wordCount / 50000, 1) * 8);
  if (nfPredictable > nfPredThreshold) {
    cleanScore -= Math.min(Math.round((nfPredictable - nfPredThreshold) * 0.5), 8);
  }

  const nfAiFav = countAiFavorites(text, wordCount);
  if (nfAiFav.per10k > 10) cleanScore -= 5;
  else if (nfAiFav.per10k > 7) cleanScore -= 3;
  else if (nfAiFav.per10k > 5) cleanScore -= 1;

  cleanScore = Math.max(0, Math.min(100, cleanScore));
  const estimatedPages = Math.ceil(wordCount / 250);

  return {
    bannedWords: bannedCount, bannedFound, voiceWas, shuddered, suddenly, somehow,
    whispered: 0, clenched: 0, theSilence: 0, repetitionTotal,
    cleanScore, capErrors, scaffolds, hangingQuotes,
    burstiness: Math.round(nfBurst * 10) / 10,
    burstinessRating: nfBurstRating,
    avgSentenceLength: Math.round(nfSentAvg * 10) / 10,
    predictablePhrases: nfPredictable,
    aiFavoriteCount: nfAiFav.count, aiFavoritePer10k: nfAiFav.per10k,
    wordCount, estimatedPages, isNonfiction: true,
  };
}

/**
 * Detect high-frequency bigram phrases across the full manuscript.
 */
export function detectHighFreqPhrases(text, chapterCount) {
  const phraseCounts = {};
  const words = text.toLowerCase().split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i].replace(/[^a-z]/g, '');
    const w2 = words[i + 1].replace(/[^a-z]/g, '');
    if (w1.length < 3 || w2.length < 3) continue;
    const p = w1 + ' ' + w2;
    if (COMMON_SKIP.includes(p)) continue;
    phraseCounts[p] = (phraseCounts[p] || 0) + 1;
  }
  const threshold = Math.max(chapterCount * 6, 80);
  return Object.entries(phraseCounts).filter(([, c]) => c > threshold).sort((a, b) => b[1] - a[1]).slice(0, 15);
}