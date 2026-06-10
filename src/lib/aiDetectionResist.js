/**
 * AI Detection Resistance — deterministic post-processing.
 * Run AFTER all existing Polish steps, before the final save.
 * No AI models used — pure regex/string operations.
 *
 * RETIRED FUNCTIONS (still exported for backward compat, now no-ops):
 *   - enforceBurstiness: split long sentences / merged short ones. This is
 *     a creative writing decision that regex cannot safely make. Splitting
 *     "She opened the door, and the hallway was dark" into two sentences
 *     changes rhythm and emphasis. Merging "She stopped. She listened." into
 *     "She stopped — she listened." changes pacing. These choices belong to
 *     the author or the AI proofreader as flags.
 *
 *   - reducePredictability: replaced "However," with "But ", "Nevertheless,"
 *     with "Even so,", etc. Each replacement introduced a new transition that
 *     could itself become an AI detection fingerprint. On long manuscripts
 *     the replacements accumulated to detectable frequencies. The transition
 *     word CAPS in chatgptPatternPolish.js handle excess transitions by
 *     DELETE-ONLY — which is the right approach (remove, don't replace).
 *
 * ACTIVE FUNCTIONS:
 *   - varyParagraphs: splits paragraphs over 80 words at sentence midpoint.
 *     This is safe because it only adds a line break — it doesn't change any
 *     words, sentence structure, or meaning.
 */

/**
 * Calculate sentence length standard deviation for a block of text.
 * Kept as a utility — used by forensic analytics and critic panel.
 */
export function calculateBurstiness(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length < 5) return { stdDev: 99, avg: 0 };
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
  return { stdDev: Math.sqrt(variance), avg };
}

/**
 * Paragraph length variation — split very long paragraphs (80+ words)
 * at the sentence midpoint. Only adds a line break; changes no words.
 */
function varyParagraphs(loaded) {
  let fixed = 0;
  for (const f of loaded) {
    const paragraphs = f.content.split(/\n\n+/);
    if (paragraphs.length < 5) continue;
    const paraLengths = paragraphs.map(p => p.trim().split(/\s+/).length);
    const paraAvg = paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length;
    const paraStdDev = Math.sqrt(paraLengths.reduce((sum, l) => sum + Math.pow(l - paraAvg, 2), 0) / paraLengths.length);
    if (paraStdDev >= 12 || paraAvg <= 40) continue;
    for (let i = 0; i < paragraphs.length; i++) {
      const words = paragraphs[i].trim().split(/\s+/).length;
      if (words > 80) {
        const sentences = paragraphs[i].match(/[^.!?]+[.!?]+/g);
        if (sentences && sentences.length >= 4) {
          const midpoint = Math.floor(sentences.length / 2);
          const firstHalf = sentences.slice(0, midpoint).join(' ').trim();
          const secondHalf = sentences.slice(midpoint).join(' ').trim();
          f.content = f.content.replace(paragraphs[i].trim(), firstHalf + '\n\n' + secondHalf);
          fixed++;
        }
      }
    }
  }
  return fixed;
}

/**
 * Run AI detection resistance on loaded chapter data.
 * Now only runs the safe paragraph splitter.
 * Burstiness and predictability are retired — their jobs are handled by
 * the AI proofreader (flag-only) and transition word caps (delete-only).
 */
export function runAiDetectionResistance(loaded, onProgress) {
  const changes = [];

  // Paragraph length variation (safe — only adds line breaks)
  onProgress?.('Polish: Checking paragraph variation…');
  const paragraphsFixed = varyParagraphs(loaded);
  if (paragraphsFixed > 0) {
    changes.push('Paragraph variation: ' + paragraphsFixed + ' long blocks split');
    console.log('[POLISH] Paragraph variation fixes:', paragraphsFixed);
  }

  return { burstinessFixed: 0, predictabilityFixed: 0, paragraphsFixed, changes };
}