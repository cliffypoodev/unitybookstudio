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
  let voiceFixed = 0;
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

  // Count ALL voice constructions globally
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

  if (totalVoice <= voicePatternCap) {
    return { voiceFixed: 0, changes };
  }

  const excess = totalVoice - voicePatternCap;
  let globalCount = 0;
  let removed = 0;

  const replacementPools = {
    voice_was: [
      (p) => p + ' spoke \u2014',
      (p) => 'The words came out',
      (p) => p + ' said it,',
      (p) => p + ' spoke, the sound',
      (p) => 'The way ' + p.toLowerCase() + ' said it was',
    ],
    voice_verb: [
      (p) => p + ' lowered the words to',
      (p) => p + ' spoke, quieter now,',
      (p) => 'The words shifted,',
      (p) => p + ' pulled the words back,',
    ],
    tone_was: [
      (p) => p + ' said it',
      (p) => p + ' spoke, all',
      (p) => 'The delivery was',
    ],
    words_verb: [
      (p) => p + ' spoke, and the words',
      (p) => 'What ' + p.toLowerCase() + ' said',
      (p) => p + ' said it, and it',
    ],
    voice_dramatic: [
      (p) => p + ' spoke, the sound',
      (p) => 'The words',
    ],
    quality_voice: [
      (p) => 'something in the way ' + p.toLowerCase() + ' spoke',
      (p) => 'the way ' + p.toLowerCase() + ' said it',
    ],
  };

  const typeCounters = {};

  for (const vp of voicePatterns) {
    if (removed >= excess) break;
    if (!typeCounters[vp.type]) typeCounters[vp.type] = 0;
    const pool = replacementPools[vp.type] || replacementPools.voice_was;

    for (const f of loaded) {
      if (removed >= excess) break;

      f.content = f.content.replace(vp.regex, (match) => {
        globalCount++;
        if (globalCount <= voicePatternCap) return match;
        if (removed >= excess) return match;

        removed++;
        voiceFixed++;

        // Determine pronoun
        let pronoun = 'She';
        if (/\bhis\b/i.test(match)) pronoun = 'He';
        if (/\bher\b/i.test(match)) pronoun = 'She';
        const nameMatch = match.match(/([A-Z][a-z]+'s)/);
        if (nameMatch) pronoun = nameMatch[1].replace("'s", '');

        const startsCap = match.charAt(0) === match.charAt(0).toUpperCase();

        const fn = pool[typeCounters[vp.type] % pool.length];
        typeCounters[vp.type]++;

        let replacement = fn(pronoun);
        if (startsCap && replacement.charAt(0) !== replacement.charAt(0).toUpperCase()) {
          replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });
    }
  }

  if (voiceFixed > 0) {
    const typeBreakdown = Object.entries(countsByType).filter(([,c]) => c > 0).map(([t,c]) => t + ':' + c).join(', ');
    changes.push('Voice patterns: ' + totalVoice + ' \u2192 ' + (totalVoice - voiceFixed) + ' (6 types, ' + voiceFixed + ' replaced) [' + typeBreakdown + ']');
    console.log('[POLISH] Voice patterns: ' + voiceFixed + ' replaced across ' + voicePatterns.length + ' pattern types');
  }

  return { voiceFixed, changes };
}