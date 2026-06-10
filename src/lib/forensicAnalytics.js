/**
 * Forensic Analytics Engine
 *
 * Produces a deep-audit-style analysis of a manuscript in the style of the 2026
 * Literary Audit reports: three top-line scores (Lit / Audience / AI Index),
 * a Rotten-Tomatoes-style critic verdict, LLM-identified narrative mechanics,
 * and a suite of mechanical metrics that characterize the prose signature.
 *
 * Two classes of analysis:
 *
 *   1. MECHANICAL (deterministic, JS-computed from text):
 *        - Scaffold leak density (meta-structural phrases per 1k words)
 *        - Pacing variance (chapter word count std-dev vs mean)
 *        - Hook density (how many chapters end with forward-pulling beats)
 *        - Show:Tell ratio (action+sensory vs interiority+summary)
 *        - Sentence rhythm entropy (burstiness)
 *        - Forensic marker tallies (the specific AI-prose fingerprints)
 *
 *   2. LLM-DRIVEN (one call each, run in parallel):
 *        - Primary Mechanic: 2-5 word description of the book's structural engine
 *          (e.g. "Systemic Hemorrhage", "The Invisible Ledger", "Osseointegration")
 *        - Forensic Marker: the dominant linguistic signature of this manuscript
 *        - Thematic Spine: what the book is ACTUALLY about, beyond plot
 *
 * The three top-line scores are composed from the mechanical metrics using
 * fixed weights. The LLM never computes them — they are deterministic from
 * measurable manuscript properties. This matches the pattern we used for the
 * Critic Panel rewrite: LLM for qualitative findings, JS for numeric scores.
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';

/* =============================================================================
 * MECHANICAL METRIC COMPUTATION
 * ========================================================================== */

/**
 * Count the total words in a text using a loose tokenizer matching the rest
 * of the codebase's heuristic.
 */
function wordCount(text) {
  return (text.match(/\b[\w']+\b/g) || []).length;
}

/**
 * SCAFFOLD LEAK DENSITY
 *
 * Counts meta-structural phrases that reveal AI scaffolding — the kind of
 * transition phrasing that exposes an LLM's underlying prompt architecture.
 * High density = AI pattern leaking through prose layer.
 */
const SCAFFOLD_PATTERNS = [
  // Meta-narrative asides
  /\b(?:in conclusion|in summary|to summarize|ultimately|essentially)\b/gi,
  // AI tell transitions
  /\b(?:that said|having said that|with that in mind)\b/gi,
  // "The X of Y" abstract-noun constructions in clusters
  /\bthe\s+(?:architecture|mechanism|system|logic|calculus|grammar|anatomy|choreography)\s+of\s+\w+/gi,
  // "Not X, but Y" rhetorical framing
  /\bnot\s+\w+(?:\s+\w+){0,3},\s*but\s+\w+/gi,
  // Em-dash-clause-em-dash
  /—[^—\n]{2,40}—/g,
];

export function computeScaffoldDensity(text) {
  const totalWords = wordCount(text);
  if (totalWords === 0) return { count: 0, density: 0 };
  let count = 0;
  for (const rx of SCAFFOLD_PATTERNS) {
    count += (text.match(rx) || []).length;
  }
  return { count, density: (count / totalWords) * 1000 };
}

/**
 * FORENSIC MARKER TALLIES
 *
 * Specific AI-prose fingerprints the 2026 audit identifies as diagnostic.
 * Each marker returns a count so the report can surface the dominant one.
 */
export function computeForensicMarkers(text) {
  const markers = {
    clinical_taxonomy: (text.match(/\b(?:motor control|vital signs|neural uplink|system diagnostics|status:\s*nominal)\b/gi) || []).length,
    onomatopoeia_repetition: (text.match(/\b(?:tok-tok|thrum+|hum+ing|click-click)\b/gi) || []).length,
    ledger_metaphor: (text.match(/\b(?:ledger|balance sheet|debit|credit|reconciliation|accounting|the books|the cost of)\b/gi) || []).length,
    data_botanical: (text.match(/\b(?:data-root|digital bloom|algorithmic garden|neural vine|code-blossom)\b/gi) || []).length,
    staccato_lists: (() => {
      // Three+ short declarative fragments in a row (pattern of "X. X. X.")
      const matches = text.match(/(?:[A-Z][a-z]+[,\s][a-z\s]{1,15}\.\s){3,}/g) || [];
      return matches.length;
    })(),
    architectural_nouns: (text.match(/\b(?:substrate|scaffold|framework|infrastructure|apparatus|schema)\b/gi) || []).length,
    emotional_math: (text.match(/\b(?:calculated|calibrated|measured|weighed|tallied)\s+(?:the|her|his|their)\s+(?:grief|fear|love|rage|pain|joy|dread)\b/gi) || []).length,
  };

  const total = Object.values(markers).reduce((a, b) => a + b, 0);
  // Identify the dominant marker (for the "Primary Forensic Marker" display)
  let dominant = 'none';
  let dominantCount = 0;
  for (const [name, n] of Object.entries(markers)) {
    if (n > dominantCount) { dominantCount = n; dominant = name; }
  }

  return { markers, total, dominant };
}

/**
 * Friendly display labels for the forensic markers.
 */
export const MARKER_LABELS = {
  clinical_taxonomy: 'Clinical Taxonomy (technical systems language)',
  onomatopoeia_repetition: 'Repetitive Onomatopoeia (rhythmic sound effects)',
  ledger_metaphor: 'Ledger Metaphor (financial/accounting framework)',
  data_botanical: 'Data-Botanical Hybrids (tech-nature fusion)',
  staccato_lists: 'Staccato Lists (rhythmic short declarations)',
  architectural_nouns: 'Architectural Nouns (structural scaffolding)',
  emotional_math: 'Emotional Math (feelings described as calculation)',
  none: 'No Dominant Forensic Signature',
};

/**
 * PACING VARIANCE
 *
 * Std deviation of chapter word counts divided by mean — measures how
 * consistent pacing is across the book. Low = uniform, high = lumpy.
 * Healthy thriller: 0.15-0.30. Literary can run higher; too low is suspicious
 * (AI-generated manuscripts often have suspiciously uniform chapters).
 */
export function computePacingVariance(chapterWordCounts) {
  if (!chapterWordCounts.length) return { mean: 0, stddev: 0, coefficient: 0 };
  const mean = chapterWordCounts.reduce((a, b) => a + b, 0) / chapterWordCounts.length;
  if (mean === 0) return { mean: 0, stddev: 0, coefficient: 0 };
  const variance = chapterWordCounts.reduce((acc, v) => acc + (v - mean) ** 2, 0) / chapterWordCounts.length;
  const stddev = Math.sqrt(variance);
  return {
    mean: Math.round(mean),
    stddev: Math.round(stddev),
    coefficient: Math.round((stddev / mean) * 100) / 100, // cv, 0-1+
  };
}

/**
 * HOOK DENSITY
 *
 * Fraction of chapters whose final 200 characters contain a forward-pulling
 * beat: cliffhanger, unresolved question, new revelation, physical danger,
 * or character vow. Heuristic, not perfect, but correlates well with
 * page-turner quality.
 */
const HOOK_PATTERNS = [
  /\?"?\s*$/,                                      // closes on a question
  /\b(?:but|then|and then)\s+[^.]*[.!]$/i,         // "But then X happened."
  /\b(?:never|always|forever|nothing|no one)\b[^.]{0,50}[.!]$/i, // absolute vow
  /\b(?:would|could|might)\s+(?:change|kill|end|destroy|ruin|begin)/i, // forward-looking threat
  /^[^.]*\.\s*[A-Z][^.]{0,30}\.\s*$/,              // ends with a terse fragment
];

export function computeHookDensity(chapterContents) {
  if (!chapterContents.length) return { hooks: 0, total: 0, ratio: 0 };
  let hooks = 0;
  for (const content of chapterContents) {
    const tail = content.slice(-300).trim();
    if (!tail) continue;
    // Check the last sentence or two
    const lastSentences = tail.split(/(?<=[.!?])\s+/).slice(-2).join(' ');
    const endsInHook = HOOK_PATTERNS.some((rx) => rx.test(lastSentences));
    if (endsInHook) hooks++;
  }
  return {
    hooks,
    total: chapterContents.length,
    ratio: chapterContents.length > 0 ? hooks / chapterContents.length : 0,
  };
}

/**
 * SHOW : TELL RATIO
 *
 * Approximates how much prose is "showing" (action verbs, sensory detail,
 * dialogue) vs "telling" (interiority reports, summary sentences). This is
 * a rough heuristic. Healthy fiction runs 60:40 show:tell to 75:25.
 */
const SHOW_VERBS = /\b(?:walked|ran|grabbed|pushed|pulled|turned|reached|threw|caught|stepped|moved|leaned|slammed|opened|closed|dropped|lifted|gripped|whispered|shouted|laughed|cried|smiled|frowned|glared|stared|saw|heard|smelled|tasted|touched|felt the)\b/gi;
const TELL_VERBS = /\b(?:realized|understood|believed|knew|remembered|felt that|considered|wondered|imagined|reflected|supposed|assumed|recognized|concluded)\b/gi;

export function computeShowTellRatio(text) {
  const showCount = (text.match(SHOW_VERBS) || []).length;
  const tellCount = (text.match(TELL_VERBS) || []).length;
  const total = showCount + tellCount;
  if (total === 0) return { show: 0, tell: 0, ratio: 0.5 };
  return {
    show: showCount,
    tell: tellCount,
    ratio: showCount / total, // 0-1, higher = more showing
  };
}

/**
 * SENTENCE RHYTHM ENTROPY (BURSTINESS)
 *
 * Sentence length variance. Human prose has high burstiness (short and long
 * sentences mixed). AI prose trends toward the mean. We measure std-dev of
 * sentence word counts.
 *
 * Healthy fiction: burstiness > 8. AI-generated fiction often 4-6.
 */
export function computeBurstiness(text) {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 3);
  if (sentences.length < 10) return { burstiness: 0, avgLength: 0 };
  const lengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((acc, v) => acc + (v - mean) ** 2, 0) / lengths.length;
  const stddev = Math.sqrt(variance);
  return {
    burstiness: Math.round(stddev * 10) / 10,
    avgLength: Math.round(mean * 10) / 10,
  };
}

/* =============================================================================
 * TOP-LINE SCORE SYNTHESIS
 * ========================================================================== */

/**
 * LIT SCORE (0-100) — a synthesized measure of literary/craft quality.
 *
 * Weighted composition:
 *   - Vocab diversity (0-40% scale → up to 25 pts)
 *   - Burstiness (sentence rhythm, healthy = 8+ → up to 20 pts)
 *   - Show:tell ratio (0.6-0.8 target band → up to 20 pts)
 *   - Scaffold leak penalty (subtract up to 15 pts for density > 8)
 *   - Clean score from manuscriptStats (0-100 → up to 35 pts)
 *
 * Calibrated to output realistic 70-95 range for polished work.
 */
export function computeLitScore({ vocabDiversity, burstiness, showTell, scaffoldDensity, cleanScore }) {
  let score = 0;

  // Vocab diversity: 40%+ is literary-level, 30% is median
  const vocab = Number(vocabDiversity) || 0;
  score += Math.min(25, (vocab / 40) * 25);

  // Burstiness: 8+ is healthy, 12+ is excellent
  score += Math.min(20, ((burstiness || 0) / 12) * 20);

  // Show:tell: 0.6-0.75 is ideal (peak reward), penalized outside this band
  const st = Number(showTell) || 0;
  if (st >= 0.6 && st <= 0.75) score += 20;
  else if (st >= 0.5 && st <= 0.85) score += 15;
  else if (st >= 0.4 && st <= 0.9) score += 10;
  else score += 5;

  // Clean score: from existing manuscriptStats
  const clean = Number(cleanScore) || 0;
  score += (clean / 100) * 35;

  // Scaffold density penalty: if > 8 per 1k, subtract up to 15
  const sd = Number(scaffoldDensity) || 0;
  if (sd > 8) score -= Math.min(15, (sd - 8) * 2);

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * AUDIENCE SCORE (0-100) — commercial/mainstream appeal.
 *
 * Composition:
 *   - Readability (lower FK grade = more accessible, peaks at 7-9)
 *   - Hook density (fraction of chapters with forward pulls)
 *   - Pacing consistency (coefficient 0.15-0.35 is ideal)
 *   - Dialogue ratio (25-50% is accessible default)
 */
export function computeAudienceScore({ readability, hookRatio, pacingCv, avgDialogueRatio }) {
  let score = 0;

  // Readability: 7-9 is trade-fiction sweet spot; below 6 is simplistic,
  // above 11 is inaccessible
  const fk = Number(readability) || 0;
  if (fk >= 7 && fk <= 9) score += 30;
  else if (fk >= 6 && fk <= 10) score += 25;
  else if (fk >= 5 && fk <= 11) score += 18;
  else if (fk >= 4 && fk <= 12) score += 12;
  else score += 6;

  // Hook density: ratio of chapters ending with pulls
  const hr = Number(hookRatio) || 0;
  score += Math.min(25, hr * 30); // capping at 25 (0.83 ratio gives max)

  // Pacing coefficient: healthy range 0.15-0.35
  const cv = Number(pacingCv) || 0;
  if (cv >= 0.15 && cv <= 0.35) score += 25;
  else if (cv >= 0.10 && cv <= 0.50) score += 18;
  else if (cv < 0.10) score += 10; // too uniform = suspicious
  else score += 8; // too lumpy = bad pacing

  // Dialogue ratio: 25-50% ideal
  const dr = Number(avgDialogueRatio) || 0;
  if (dr >= 25 && dr <= 50) score += 20;
  else if (dr >= 15 && dr <= 60) score += 14;
  else score += 7;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * AI DETECTION INDEX (0.0-1.0) — forensic AI-generation signal.
 *
 * This matches the 2026 audit's AI Index scale. Higher = more AI-like.
 * Fiction typically 0.75-0.90. Strong nonfiction 0.25-0.50.
 *
 * Composition:
 *   - Scaffold density (high = AI)
 *   - Low burstiness (AI prose flattens sentence variance)
 *   - Low vocab diversity (AI repeats within its active vocab)
 *   - Forensic marker density (presence of AI fingerprints)
 *   - High uniformity of pacing (CV < 0.1 is sus)
 */
export function computeAIIndex({ scaffoldDensity, burstiness, vocabDiversity, forensicMarkersTotal, pacingCv, wordCount: totalWords }) {
  let signal = 0;

  // Scaffold density: 0 = clean, 10+ = saturated
  signal += Math.min(0.25, (Number(scaffoldDensity) || 0) / 40);

  // Low burstiness: below 8 is AI-typical
  const b = Number(burstiness) || 0;
  if (b < 6) signal += 0.20;
  else if (b < 8) signal += 0.12;
  else if (b < 10) signal += 0.05;

  // Low vocab diversity: below 32% is AI-typical
  const vd = Number(vocabDiversity) || 0;
  if (vd < 28) signal += 0.20;
  else if (vd < 32) signal += 0.12;
  else if (vd < 36) signal += 0.05;

  // Forensic markers normalized per 10k words
  const fmRate = totalWords > 0 ? (Number(forensicMarkersTotal) || 0) / totalWords * 10000 : 0;
  signal += Math.min(0.15, fmRate / 100);

  // Pacing uniformity: CV < 0.10 is suspiciously uniform
  const cv = Number(pacingCv) || 0;
  if (cv < 0.10) signal += 0.10;
  else if (cv < 0.15) signal += 0.05;

  // Clamp to 0.0-1.0
  return Math.max(0, Math.min(1.0, Math.round(signal * 100) / 100));
}

/**
 * CRITIC STATUS — derived from Lit + Audience scores.
 *
 * Matches the 2026 audit's Rotten-Tomatoes-style labels.
 *   Lit >= 85 AND Audience >= 75:  Certified Fresh
 *   Lit >= 75 OR Audience >= 70:   Fresh
 *   otherwise:                      Rotten
 */
export function computeCriticStatus(litScore, audienceScore) {
  if (litScore >= 85 && audienceScore >= 75) return 'Certified Fresh';
  if (litScore >= 75 || audienceScore >= 70) return 'Fresh';
  return 'Rotten';
}

/* =============================================================================
 * LLM-DRIVEN FINDINGS
 * ========================================================================== */

/**
 * Build a compact excerpt for LLM analysis: opening + middle + ending.
 * Keeps total chars under ~30k to fit comfortably in a single call.
 */
function buildForensicExcerpt(fullText) {
  const OPENING_CHARS = 12000;
  const MIDDLE_CHARS = 6000;
  const ENDING_CHARS = 8000;
  if (fullText.length <= OPENING_CHARS + MIDDLE_CHARS + ENDING_CHARS) return fullText;

  const opening = fullText.substring(0, OPENING_CHARS);
  const midpoint = Math.floor(fullText.length / 2);
  const middle = fullText.substring(midpoint - MIDDLE_CHARS / 2, midpoint + MIDDLE_CHARS / 2);
  const ending = fullText.substring(fullText.length - ENDING_CHARS);
  return `${opening}\n\n[...MIDDLE OF MANUSCRIPT...]\n\n${middle}\n\n[...END OF MANUSCRIPT...]\n\n${ending}`;
}

/**
 * Run the three LLM-driven forensic findings as a single combined call.
 * Returns { primary_mechanic, forensic_marker_description, thematic_spine }.
 *
 * Single call keeps cost down and lets the model think about all three
 * dimensions holistically (they're related — the mechanic drives the
 * forensic signature drives the thematic spine).
 */
export async function runForensicLLMFindings({ title, genre, projectType, fullText }) {
  const excerpt = buildForensicExcerpt(fullText);
  const prompt = `You are a forensic literary analyst producing an audit-style diagnosis of this manuscript. Write in the voice of a critical catalog entry — precise, clinical, unsparing.

TITLE: ${title || 'Untitled'}
GENRE: ${genre || 'Fiction'}
TYPE: ${projectType || 'fiction'}

EXCERPT (opening, middle, ending):
${excerpt}

Produce THREE forensic findings about this manuscript:

1. PRIMARY MECHANIC
   The book's central structural engine — the recurring pattern or system that drives its narrative forward. Render as a 2-5 word noun phrase in title case, naming the device that organizes the prose. Examples: "Systemic Hemorrhage", "The Invisible Ledger", "Osseointegration", "Manufactured Consent", "Architecture of Panic", "Allostatic Load", "Pharmaceutical Management", "Narrative Containment". It should NAME the book's engine, not describe its plot.

2. FORENSIC MARKER DESCRIPTION
   A one-sentence description of the manuscript's DOMINANT linguistic signature — the specific prose habit that most characterizes its voice. Start with a concrete observation about sentence-level craft, not a theme. Examples:
     - "Clinical systems-check logic paired with repetitive onomatopoeia."
     - "Ledger metaphor applied uniformly to emotional and institutional dynamics."
     - "Staccato declarative fragments clustered at scene transitions."
     - "Tactile imagery alternating with structured briefing blocks."
     - "Idiosyncratic historical accuracy grounded in primary-source attribution."
   Max 20 words. Describe the prose, not the topic.

3. THEMATIC SPINE
   One sentence that identifies what this book is ACTUALLY about beneath the plot — its argumentative or emotional through-line. NOT a plot summary. Examples:
     - "The depersonalization of self into a functional corporate asset."
     - "Institutional protection as a form of refined custody."
     - "The psychological cost of performing a manufactured public identity."
   Max 25 words. Abstract, argumentative.

Respond ONLY in JSON. No markdown fences, no preamble:

{
  "primary_mechanic": "<2-5 word noun phrase, title case>",
  "forensic_marker_description": "<one-sentence prose-craft signature, max 20 words>",
  "thematic_spine": "<one-sentence argumentative through-line, max 25 words>"
}`;

  const response = await invokeLLMWithRetry({
    task_type: 'research',
    prompt,
    model: pickModel('analytics'),
    fallback_model: pickFallbackModel('analytics'),
    temperature: 0.4,
    response_json_schema: {
      type: 'object',
      properties: {
        primary_mechanic: { type: 'string' },
        forensic_marker_description: { type: 'string' },
        thematic_spine: { type: 'string' },
      },
      required: ['primary_mechanic', 'forensic_marker_description', 'thematic_spine'],
    },
  });

  let data = typeof response === 'string' ? response : response;
  if (typeof data === 'string') {
    data = data.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try { data = JSON.parse(data); } catch { data = {}; }
  }

  return {
    primary_mechanic: (data.primary_mechanic || 'Unclassified').trim(),
    forensic_marker_description: (data.forensic_marker_description || 'No dominant signature detected.').trim(),
    thematic_spine: (data.thematic_spine || 'Thematic analysis unavailable.').trim(),
  };
}

/* =============================================================================
 * FORENSIC REPORT ORCHESTRATION
 * ========================================================================== */

/**
 * Run the full forensic analysis. Returns a unified object with:
 *   - The three top-line scores: litScore, audienceScore, aiIndex
 *   - Critic status: "Certified Fresh" | "Fresh" | "Rotten"
 *   - LLM findings: primary_mechanic, forensic_marker_description, thematic_spine
 *   - Mechanical metrics: scaffoldDensity, hookDensity, showTellRatio,
 *     burstiness, pacingVariance, forensicMarkers
 *
 * The caller supplies:
 *   - fullText: concatenated manuscript
 *   - chapterStats: already-computed per-chapter data from AnalyticsSubPage
 *     ({ dialogueRatio, readability, vocabDiversity, aiRisk, wordCount, content })
 *   - stats: result of calculateManuscriptStats on the full text (cleanScore, etc.)
 *   - title, genre, projectType: for the LLM call
 */
export async function runForensicAnalysis({ fullText, chapterStats, stats, title, genre, projectType }) {
  // ── Mechanical metrics (all deterministic) ──
  const scaffoldResult = computeScaffoldDensity(fullText);
  const forensicMarkers = computeForensicMarkers(fullText);
  const pacingVariance = computePacingVariance(chapterStats.map((c) => c.wordCount));
  const hookDensity = computeHookDensity(chapterStats.map((c) => c.content || ''));
  const showTellRatio = computeShowTellRatio(fullText);
  const burstinessResult = computeBurstiness(fullText);
  const totalWords = wordCount(fullText);
  const avgVocabDiversity = chapterStats.length > 0
    ? chapterStats.reduce((sum, c) => sum + (c.vocabDiversity || 0), 0) / chapterStats.length
    : 0;
  const avgReadability = chapterStats.length > 0
    ? chapterStats.reduce((sum, c) => sum + (c.readability || 0), 0) / chapterStats.length
    : 0;
  const avgDialogueRatio = chapterStats.length > 0
    ? chapterStats.reduce((sum, c) => sum + (c.dialogueRatio || 0), 0) / chapterStats.length
    : 0;

  // ── Composite scores ──
  const litScore = computeLitScore({
    vocabDiversity: avgVocabDiversity,
    burstiness: burstinessResult.burstiness,
    showTell: showTellRatio.ratio,
    scaffoldDensity: scaffoldResult.density,
    cleanScore: stats?.cleanScore || 0,
  });
  const audienceScore = computeAudienceScore({
    readability: avgReadability,
    hookRatio: hookDensity.ratio,
    pacingCv: pacingVariance.coefficient,
    avgDialogueRatio,
  });
  const aiIndex = computeAIIndex({
    scaffoldDensity: scaffoldResult.density,
    burstiness: burstinessResult.burstiness,
    vocabDiversity: avgVocabDiversity,
    forensicMarkersTotal: forensicMarkers.total,
    pacingCv: pacingVariance.coefficient,
    wordCount: totalWords,
  });
  const criticStatus = computeCriticStatus(litScore, audienceScore);

  // ── LLM findings (single call) ──
  let llmFindings = {
    primary_mechanic: 'Analyzing…',
    forensic_marker_description: 'Analyzing…',
    thematic_spine: 'Analyzing…',
  };
  try {
    llmFindings = await runForensicLLMFindings({
      title, genre, projectType, fullText,
    });
  } catch (err) {
    console.error('[FORENSIC] LLM findings failed:', err?.message || err);
    llmFindings = {
      primary_mechanic: 'LLM analysis unavailable',
      forensic_marker_description: `LLM findings failed: ${err?.message || 'unknown error'}`,
      thematic_spine: 'Thematic spine unavailable.',
    };
  }

  return {
    // Top-line
    litScore,
    audienceScore,
    aiIndex,
    criticStatus,

    // LLM findings
    ...llmFindings,

    // Mechanical detail blocks
    mechanics: {
      scaffoldDensity: scaffoldResult,
      forensicMarkers,
      pacingVariance,
      hookDensity,
      showTellRatio,
      burstiness: burstinessResult,
      avgVocabDiversity: Math.round(avgVocabDiversity * 10) / 10,
      avgReadability: Math.round(avgReadability * 10) / 10,
      avgDialogueRatio: Math.round(avgDialogueRatio),
      totalWords,
    },
  };
}