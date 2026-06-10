/**
 * Dialogue tag / action beat frequency caps + breath-stem cap.
 * Shared between fiction and nonfiction polish pipelines.
 *
 * @param {Array<{chapter: object, content: string}>} loaded
 * @param {Function} onProgress
 * @returns {{ dialogueTagsFixed: number, breathFixed: number, changes: string[] }}
 */
export function runDialogueTagCaps(loaded, onProgress) {
  onProgress?.('Polish: Capping dialogue tags…');
  const changes = [];
  let dialogueTagsFixed = 0;

  const allChapterText = loaded.map(f => f.content).join(' ');
  const totalWordCount = allChapterText.split(/\s+/).filter(Boolean).length;

  console.log('[POLISH][DTAG] Step starting. Chapters: ' + loaded.length + ', totalWords: ' + totalWordCount);

  // Hard caps: breathed max 3/manuscript, murmured max 5/manuscript
  // Other tags use per-10K-word proportional caps
  const tagCaps = [
    { word: 'breathed', maxFixed: 3, replacements: ['said quietly', 'said softly', 'whispered', 'murmured', 'said'] },
    { word: 'murmured', maxFixed: 5, replacements: ['said quietly', 'said', 'replied softly'] },
    { word: 'whispered', max: 1.5, replacements: ['said quietly', 'said, low', 'said', 'murmured'] },
    { word: 'hissed', max: 0.5, replacements: ['said', 'snapped', 'said through clenched teeth', 'bit out'] },
    { word: 'growled', max: 0.5, replacements: ['said', 'snapped', 'said, rough', 'grated'] },
    { word: 'snarled', max: 0.3, replacements: ['snapped', 'said', 'bit out', 'shot back'] },
  ];

  const actionCaps = [
    { word: 'swallowed', max: 1.0, replacements: ['paused', 'hesitated', 'stopped', 'went still', 'held the thought'] },
    { word: 'exhaled', max: 0.8, replacements: ['let out a breath', 'breathed out', 'steadied', 'released the tension'] },
    { word: 'inhaled', max: 0.8, replacements: ['drew a breath', 'breathed in', 'steadied', 'filled her lungs'] },
    { word: 'shuddered', max: 0.5, replacements: ['flinched', 'went rigid', 'stiffened', 'felt it move through her'] },
    { word: 'trembled', max: 0.5, replacements: ['shook', 'wavered', 'unsteadied', 'went unsteady'] },
  ];

  const allCaps = [...tagCaps, ...actionCaps];

  for (const entry of allCaps) {
    const regex = new RegExp('\\b' + entry.word + '\\b', 'gi');
    const globalText = loaded.map(f => f.content).join('\n\n');
    const matches = globalText.match(regex);
    if (!matches) continue;

    const count = matches.length;
    // Use fixed cap if defined, otherwise proportional
    const maxAllowed = entry.maxFixed
      ? entry.maxFixed
      : Math.max(2, Math.round(entry.max * totalWordCount / 10000));
    if (count <= maxAllowed) continue;

    const excess = count - maxAllowed;
    let instanceCount = 0;
    let removed = 0;

    console.log('[POLISH][DTAG] "' + entry.word + '": found=' + count + ', maxAllowed=' + maxAllowed + ', excess=' + excess);

    for (const f of loaded) {
      if (removed >= excess) break;
      const chRegex = new RegExp('\\b' + entry.word + '\\b', 'gi');
      f.content = f.content.replace(chRegex, (match) => {
        instanceCount++;
        if (instanceCount <= maxAllowed) return match;
        if (removed >= excess) return match;
        removed++;
        dialogueTagsFixed++;
        const alt = entry.replacements[removed % entry.replacements.length];
        if (match.charAt(0) === match.charAt(0).toUpperCase()) {
          return alt.charAt(0).toUpperCase() + alt.slice(1);
        }
        return alt;
      });
    }

    if (removed > 0) {
      changes.push('"' + entry.word + '": ' + count + ' → ' + maxAllowed + ' (' + removed + ' replaced)');
    }
  }

  if (dialogueTagsFixed > 0) {
    changes.push('Dialogue tags/actions capped: ' + dialogueTagsFixed + ' replacements');
    console.log('[POLISH][DTAG] Total capped:', dialogueTagsFixed);
  } else {
    console.log('[POLISH][DTAG] No dialogue tags exceeded caps');
  }

  // ── Breath-stem frequency cap ──
  onProgress?.('Polish: Capping breath-stem repetition…');
  let breathFixed = 0;

  console.log('[POLISH][BREATH] Step starting');
  const breathRegex = /\b(breath|breathe|breathing|breathed|breathless)\b/gi;
  const breathAllText = loaded.map(f => f.content).join('\n\n');
  const breathMatches = breathAllText.match(breathRegex);
  const breathCount = breathMatches ? breathMatches.length : 0;
  // Target: 7/10K words max (down from 12/10K)
  const breathMax = Math.max(5, Math.round(7 * totalWordCount / 10000));

  if (breathCount > breathMax) {
    const breathExcess = breathCount - breathMax;
    let breathGlobal = 0;
    let breathRemoved = 0;

    console.log('[POLISH][BREATH] found=' + breathCount + ', max=' + breathMax + ', removing=' + breathExcess);

    const breathReplacements = {
      'breath': ['air', 'pause', 'beat', 'moment', 'silence'],
      'breathe': ['steady', 'settle', 'focus', 'pause', 'hold still'],
      'breathing': ['rhythm', 'chest rising', 'stillness', 'silence between them', 'quiet'],
      'breathed': ['said', 'whispered', 'let the words out', 'spoke', 'managed'],
      'breathless': ['spent', 'winded', 'shaking', 'raw', 'undone'],
    };

    for (const f of loaded) {
      if (breathRemoved >= breathExcess) break;
      const chBreathRegex = /\b(breath|breathe|breathing|breathed|breathless)\b/gi;
      f.content = f.content.replace(chBreathRegex, (match) => {
        breathGlobal++;
        if (breathGlobal <= breathMax) return match;
        if (breathRemoved >= breathExcess) return match;
        breathRemoved++;
        breathFixed++;

        const key = match.toLowerCase();
        const pool = breathReplacements[key] || breathReplacements['breath'];
        const alt = pool[breathRemoved % pool.length];

        if (match.charAt(0) === match.charAt(0).toUpperCase()) {
          return alt.charAt(0).toUpperCase() + alt.slice(1);
        }
        return alt;
      });
    }

    if (breathRemoved > 0) {
      changes.push('Breath-stem: ' + breathCount + ' → ' + breathMax + ' (' + breathRemoved + ' replaced)');
      console.log('[POLISH] Breath stem capped:', breathRemoved);
    }
  }

  return { dialogueTagsFixed, breathFixed, changes };
}