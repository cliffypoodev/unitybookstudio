/**
 * Post-generation quality scanning for chapters.
 * Produces warnings (not auto-fixes) for the Review tab.
 */

import { stripDialogue } from '@/lib/povTense';

// Common stop words to exclude from repetition scanning
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','was','are','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','can',
  'could','not','no','so','if','then','than','that','this','it','he',
  'she','they','we','you','me','him','her','them','us','my','his','her',
  'its','our','your','their','who','what','which','when','where','how',
  'all','each','every','both','few','more','most','other','some','such',
  'into','up','out','over','down','back','just','about','only','very',
  'also','still','even','now','here','there','again','once','never',
  'said','says','like','as','been','about','after','before','between',
  'through','during','without','again','further','then','once','upon',
  'much','well','way','long','too','own','same','made','come','make',
  'know','take','see','look','come','think','tell','give','find','want',
  'seem','feel','leave','call','keep','turn','hand','eyes','head','face',
  'time','door','room','voice','body','back','away','around','something',
  'nothing','went','came','going','looked','asked','knew','thought','took',
  'didn','don','didn','wasn','couldn','wouldn','hadn','isn','aren','doesn',
]);

/**
 * Scan chapter text for word repetition (>8 occurrences of any non-stop word).
 * Returns array of warning strings.
 */
export function scanWordRepetition(text, chapterNumber, characterNames = [], cap = 8) {
  const warnings = [];
  if (!text) return warnings;

  // Normalize character names for exclusion
  const nameSet = new Set(
    characterNames.flatMap(n => n.toLowerCase().split(/\s+/))
  );

  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  const freq = {};
  for (const w of words) {
    if (w.length <= 3) continue;
    if (STOP_WORDS.has(w)) continue;
    if (nameSet.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }

  const overused = Object.entries(freq)
    .filter(([, count]) => count > cap)
    .sort((a, b) => b[1] - a[1]);

  for (const [word, count] of overused) {
    warnings.push(`Word frequency: '${word}' appears ${count}x in Ch ${chapterNumber} (cap: ${cap})`);
  }

  return warnings;
}

/**
 * Scan for POV drift: first-person "I" in third-person spec (outside dialogue).
 * Only flags if >5 instances found.
 */
export function scanPovDrift(text, project, chapterNumber) {
  const warnings = [];
  if (!text || !project?.pov_mode) return warnings;

  const pov = project.pov_mode;
  // Only check third-person modes
  if (pov !== 'third-close' && pov !== 'third-omni' && pov !== 'third-multi') {
    return warnings;
  }

  const withoutDialogue = stripDialogue(text);

  // Count standalone "I" as subject pronoun (word boundary + uppercase I + word boundary)
  // Match "I" followed by a verb-like word or common patterns
  const matches = withoutDialogue.match(/\bI\s+(?:[a-z])/g) || [];
  const count = matches.length;

  if (count > 5) {
    warnings.push(
      `POV drift: ${count} first-person "I" instances found outside dialogue in Ch ${chapterNumber} (project POV: ${pov}). Review for accidental first-person narration.`
    );
  }

  return warnings;
}

/**
 * Scan nonfiction chapter text for integrity markers inserted by the post-generation cleanup:
 * - Composite character labels
 * - FOIA anachronism fixes (already applied)
 * - Unverified statistic flags [VERIFY: ...]
 */
export function scanNonfictionIntegrity(text, project, chapterNumber) {
  const warnings = [];
  if (!text || project?.book_type !== 'nonfiction') return warnings;

  // Count composite labels
  const compositeMatches = text.match(/\[The following account is a composite[^\]]*\]/g) || [];
  if (compositeMatches.length > 0) {
    warnings.push(`Unlabeled Composites: ${compositeMatches.length} composite character label(s) inserted in Ch ${chapterNumber}. Review for accuracy.`);
  }

  // Count unverified statistic flags
  const verifyMatches = text.match(/\[VERIFY: [^\]]*\]/g) || [];
  if (verifyMatches.length > 0) {
    warnings.push(`Unverified Statistics: ${verifyMatches.length} statistical claim(s) in Ch ${chapterNumber} need source confirmation. Search for [VERIFY] in the text.`);
  }

  return warnings;
}

/**
 * Run all quality scans and return a combined warning string for the quality_scan field.
 */
export function runQualityScan(text, project, chapterNumber, characterNames = []) {
  const warnings = [
    ...scanWordRepetition(text, chapterNumber, characterNames),
    ...scanPovDrift(text, project, chapterNumber),
    ...scanNonfictionIntegrity(text, project, chapterNumber),
  ];

  return warnings.length ? warnings.join('\n') : '';
}