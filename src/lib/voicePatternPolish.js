/**
 * Expanded voice pattern replacement — catches ALL 6 variant families.
 * Shared by both fiction and nonfiction Polish pipelines.
 *
 * Pattern families:
 *  1. "His/Her voice was [X]"
 *  2. "His/Her voice [action verb]"
 *  3. "His/Her tone was [X]"
 *  4. "His/Her words were/came [X]"
 *  5. "voice [dramatic verb]" (including possessive names)
 *  6. "[quality] in/of his/her voice"
 *
 * @param {Array<{chapter: object, content: string}>} loaded
 * @param {number} chapterCount
 * @returns {{ voiceFixed: number, changes: string[] }}
 */
export function fixVoicePatterns(loaded, chapterCount) {
  // POLISHSAFE-4: the replacement-pool phrase rotation is retired \u2014 outside
  // rule 0.2/2's whitelist. Flag-only now; loaded[].content is never mutated.
  const voiceFixed = 0;
  const changes = [];

  // Global cap: ~0.1 per chapter, minimum 2
  const voicePatternCap = Math.max(2, Math.round(chapterCount * 0.1));

  const voicePatterns = [
    { regex: /\b(His|Her|his|her) voice was\b/gi, type: 'voice_was' },
    { regex: /\b(His|Her|his|her) voice (dropped|rose|fell|cracked|broke|caught|went|turned|sounded|held|carried|cut|shifted|changed|wavered|trembled|shook|came|softened|hardened|tightened|steadied|roughened|thickened)\b/gi, type: 'voice_verb' },
    { regex: /\b(His|Her|his|her) tone was\b/gi, type: 'tone_was' },
    { regex: /\b(His|Her|his|her) words (were|came|fell|cut|hung|landed|hit|struck)\b/gi, type: 'words_verb' },
    { regex: /\b(His|Her|his|her|[A-Z][a-z]+'s) voice (echoed|filled|rang|dripped|oozed|boomed|thundered)\b/gi, type: 'voice_dramatic' },
    { regex: /\b(?:a|the) (edge|hint|note|trace|thread|rasp|crack|tremor|growl|hitch) (?:in|of) (his|her) voice\b/gi, type: 'quality_voice' },
  ];

  const fullText = loaded.map(f => f.content).join('\n\n');
  let totalVoice = 0;
  const countsByType = {};
  for (const vp of voicePatterns) {
    const matches = fullText.match(vp.regex);
    const c = matches ? matches.length : 0;
    totalVoice += c;
    countsByType[vp.type] = c;
  }

  console.log('[POLISH] Voice constructions found: ' + totalVoice + ' (cap: ' + voicePatternCap + ')', JSON.stringify(countsByType));

  if (totalVoice > voicePatternCap) {
    const typeBreakdown = Object.entries(countsByType).filter(([, c]) => c > 0).map(([t, c]) => t + ':' + c).join(', ');
    changes.push('Voice patterns: ' + totalVoice + ' found, ' + voicePatternCap + ' allowed, ' + (totalVoice - voicePatternCap) + ' flagged - substitution retired (POLISHSAFE-4) [' + typeBreakdown + ']');
  }

  return { voiceFixed, changes };
}