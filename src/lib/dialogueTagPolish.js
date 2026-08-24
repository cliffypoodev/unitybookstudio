/**
 * Dialogue tag / action beat frequency caps + breath-stem cap.
 * Shared between fiction and nonfiction polish pipelines.
 *
 * @param {Array<{chapter: object, content: string}>} loaded
 * @param {Function} onProgress
 * @returns {{ dialogueTagsFixed: number, breathFixed: number, changes: string[] }}
 */
export function runDialogueTagCaps(loaded, onProgress) {
  onProgress?.('Polish: Scanning dialogue tags…');
  const changes = [];
  // POLISHSAFE-4: word-substitution retired — outside rule 0.2/2's
  // whitelist. Flag-only now; loaded[].content is never mutated here.
  const dialogueTagsFixed = 0;

  const allChapterText = loaded.map(f => f.content).join(' ');
  const totalWordCount = allChapterText.split(/\s+/).filter(Boolean).length;

  console.log('[POLISH][DTAG] Step starting. Chapters: ' + loaded.length + ', totalWords: ' + totalWordCount);

  // Hard caps: breathed max 3/manuscript, murmured max 5/manuscript
  // Other tags use per-10K-word proportional caps
  const tagCaps = [
    { word: 'breathed', maxFixed: 3 },
    { word: 'murmured', maxFixed: 5 },
    { word: 'whispered', max: 1.5 },
    { word: 'hissed', max: 0.5 },
    { word: 'growled', max: 0.5 },
    { word: 'snarled', max: 0.3 },
  ];

  const actionCaps = [
    { word: 'swallowed', max: 1.0 },
    { word: 'exhaled', max: 0.8 },
    { word: 'inhaled', max: 0.8 },
    { word: 'shuddered', max: 0.5 },
    { word: 'trembled', max: 0.5 },
  ];

  const allCaps = [...tagCaps, ...actionCaps];
  const globalText = loaded.map(f => f.content).join('\n\n');

  for (const entry of allCaps) {
    const regex = new RegExp('\\b' + entry.word + '\\b', 'gi');
    const matches = globalText.match(regex);
    if (!matches) continue;

    const count = matches.length;
    const maxAllowed = entry.maxFixed
      ? entry.maxFixed
      : Math.max(2, Math.round(entry.max * totalWordCount / 10000));
    if (count <= maxAllowed) continue;

    const excess = count - maxAllowed;
    console.log('[POLISH][DTAG] "' + entry.word + '": found=' + count + ', maxAllowed=' + maxAllowed + ', excess=' + excess);
    changes.push('"' + entry.word + '": ' + count + ' found, ' + maxAllowed + ' allowed, ' + excess + ' flagged - substitution retired (POLISHSAFE-4)');
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
    // POLISHFIX-4: flag, never swap. The synonym pools here replaced the WORD
    // "breath" anywhere in narration - measured on the live Brass Meridian saves
    // this produced "the station was holding its own pause", "chest rising" for
    // "breathing", and 35 total context-free swaps in one run. The scar lists in
    // manuscriptFixer/manuscriptArtifactRepair ("own pause raw", "pause hitched"
    // -> "breath hitched") exist because of this exact block. Over-cap counts are
    // now reported for a human or an LLM pass with context; deterministic
    // word-swaps on narration prose do not converge.
    changes.push(
      'Breath-stem over cap: ' + breathCount + ' instance(s), cap ' + breathMax +
      ' - flagged for review; mechanical synonym swap disabled.'
    );
    console.log('[POLISH][BREATH] over cap - flagged only (swap disabled): found=' + breathCount + ', max=' + breathMax);
  }

  return { dialogueTagsFixed, breathFixed, changes };
}