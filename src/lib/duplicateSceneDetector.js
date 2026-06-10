/**
 * Duplicate Scene Detector
 *
 * Catches two types of cross-chapter duplication:
 *
 * 1. PASSAGE DUPLICATES — near-identical text blocks (15+ words) appearing
 *    in multiple chapters. These are copy-paste artifacts or LLM regeneration
 *    that produced the same text twice.
 *
 * 2. SCENE ECHOES — the same plot beat or event described in different words
 *    across chapters. Detected by extracting per-chapter event fingerprints
 *    and comparing them. Example: "character enters the arena and fights"
 *    happening in both Ch.4 and Ch.7 with different prose but same action.
 *
 * All findings are detect-only — surfaced in the Review Queue with ✨ Rewrite
 * buttons so the author can fix them.
 */

/**
 * Extract overlapping n-gram fingerprints from text.
 * Used to find near-identical passages across chapters.
 */
function extractNgrams(text, n) {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const ngrams = new Map();
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n).join(' ');
    if (!ngrams.has(gram)) ngrams.set(gram, []);
    ngrams.get(gram).push(i);
  }
  return ngrams;
}

/**
 * Find the original text span in the chapter that corresponds to an n-gram match.
 */
function findOriginalSpan(content, ngramWords, startWordIdx) {
  const words = content.split(/\s+/);
  // Map word index back to character position
  let charPos = 0;
  for (let i = 0; i < words.length && i < startWordIdx; i++) {
    charPos = content.indexOf(words[i], charPos) + words[i].length;
  }
  // Extract the actual text span (with original punctuation/casing)
  const startChar = content.indexOf(words[startWordIdx] || '', charPos > 0 ? charPos - 20 : 0);
  if (startChar < 0) return null;
  const endWord = Math.min(startWordIdx + ngramWords, words.length - 1);
  let endChar = startChar;
  for (let i = startWordIdx; i <= endWord && i < words.length; i++) {
    const pos = content.indexOf(words[i], endChar);
    if (pos >= 0) endChar = pos + words[i].length;
  }
  return content.substring(startChar, endChar + 1).trim();
}

/**
 * Detect duplicate passages across chapters.
 *
 * @param {Array<{chapter: object, content: string}>} loaded
 * @returns {Array<{type, chapterA, chapterB, textA, textB, description, severity}>}
 */
export function detectDuplicateScenes(loaded) {
  if (!loaded || loaded.length < 2) return [];
  const findings = [];
  const seen = new Set();

  // ── PASS 1: Exact passage duplicates (15-word n-grams) ──
  // Build n-gram index per chapter
  const NGRAM_SIZE = 12;
  const chapterNgrams = [];

  for (let i = 0; i < loaded.length; i++) {
    const content = loaded[i].content || '';
    if (content.length < 200) { chapterNgrams.push(new Map()); continue; }
    chapterNgrams.push(extractNgrams(content, NGRAM_SIZE));
  }

  // Compare every chapter pair
  for (let a = 0; a < loaded.length; a++) {
    for (let b = a + 1; b < loaded.length; b++) {
      const gramsA = chapterNgrams[a];
      const gramsB = chapterNgrams[b];
      if (!gramsA.size || !gramsB.size) continue;

      // Find shared n-grams
      const shared = [];
      for (const [gram, positionsA] of gramsA) {
        if (gramsB.has(gram)) {
          // Skip very common phrases (dialogue tags, generic transitions)
          if (/^(he said|she said|he looked|she looked|he turned|she turned|it was the|there was a|he could see|she could see|he didn.t know|she didn.t know)/.test(gram)) continue;
          shared.push({ gram, posA: positionsA[0], posB: gramsB.get(gram)[0] });
        }
      }

      if (shared.length === 0) continue;

      // Cluster adjacent shared n-grams into passage matches
      shared.sort((x, y) => x.posA - y.posA);

      let clusterStart = 0;
      for (let i = 1; i <= shared.length; i++) {
        const isEnd = i === shared.length || (shared[i].posA - shared[i - 1].posA > 3);
        if (isEnd) {
          const clusterLen = i - clusterStart;
          if (clusterLen >= 2) {
            // This is a passage match — 2+ adjacent n-grams = 13+ word exact match
            const contentA = loaded[a].content || '';
            const contentB = loaded[b].content || '';
            const spanA = findOriginalSpan(contentA, NGRAM_SIZE + clusterLen, shared[clusterStart].posA);
            const spanB = findOriginalSpan(contentB, NGRAM_SIZE + clusterLen, shared[clusterStart].posB);

            if (spanA && spanB && spanA.length > 30) {
              const key = spanA.substring(0, 40).toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                const chA = loaded[a].chapter?.chapter_number || (a + 1);
                const chB = loaded[b].chapter?.chapter_number || (b + 1);
                findings.push({
                  type: 'passage_duplicate',
                  chapterA: chA,
                  chapterB: chB,
                  textA: spanA.substring(0, 150),
                  textB: spanB.substring(0, 150),
                  description: `Near-identical passage (~${NGRAM_SIZE + clusterLen} words) appears in both Ch.${chA} and Ch.${chB}. One instance should be rewritten or removed.`,
                  severity: 'major',
                  wordCount: NGRAM_SIZE + clusterLen,
                });
              }
            }
          }
          clusterStart = i;
        }
      }
    }
  }

  // ── PASS 2: Scene echoes (same events, different words) ──
  // Extract action fingerprints per chapter — [subject] [verb] [object] patterns
  const chapterActions = [];
  for (const entry of loaded) {
    const content = entry.content || '';
    const actions = [];

    // Extract subject-verb patterns from narration (skip dialogue)
    const sentences = content.split(/(?<=[.!?])\s+/).filter(s => {
      if (s.length < 20 || s.length > 200) return false;
      // Skip dialogue-heavy sentences
      if ((s.match(/[\u201c"]/g) || []).length > 0) return false;
      return true;
    });

    for (const sent of sentences) {
      // Extract key action words (verbs in past tense)
      const words = sent.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
      const actionWords = words.filter(w =>
        w.length > 3 &&
        (w.endsWith('ed') || w.endsWith('ght') || w.endsWith('oke') || w.endsWith('ew') || w.endsWith('an') || w.endsWith('ell')) &&
        !['the', 'and', 'but', 'that', 'this', 'then', 'when', 'with', 'from', 'into', 'them', 'their', 'been', 'over', 'after', 'under', 'other', 'between', 'around'].includes(w)
      ).slice(0, 4);

      if (actionWords.length >= 2) {
        actions.push({
          fingerprint: actionWords.sort().join('|'),
          text: sent.substring(0, 100),
        });
      }
    }
    chapterActions.push(actions);
  }

  // Compare action fingerprints across chapters
  for (let a = 0; a < loaded.length; a++) {
    for (let b = a + 1; b < loaded.length; b++) {
      // Skip adjacent chapters (some overlap is expected at boundaries)
      if (b - a === 1) continue;

      const actionsA = chapterActions[a];
      const actionsB = chapterActions[b];
      if (!actionsA.length || !actionsB.length) continue;

      // Count shared action fingerprints
      const fpSetB = new Set(actionsB.map(a => a.fingerprint));
      const matches = actionsA.filter(a => fpSetB.has(a.fingerprint));

      // If 5+ action fingerprints match between non-adjacent chapters, flag it
      if (matches.length >= 5) {
        const chA = loaded[a].chapter?.chapter_number || (a + 1);
        const chB = loaded[b].chapter?.chapter_number || (b + 1);
        const key = `echo|${chA}|${chB}`;
        if (!seen.has(key)) {
          seen.add(key);

          // Find the matching actions from B for context
          const fpMap = {};
          for (const act of actionsB) fpMap[act.fingerprint] = act.text;

          findings.push({
            type: 'scene_echo',
            chapterA: chA,
            chapterB: chB,
            textA: matches.slice(0, 3).map(m => m.text).join(' | '),
            textB: matches.slice(0, 3).map(m => fpMap[m.fingerprint] || '').join(' | '),
            description: `Ch.${chA} and Ch.${chB} share ${matches.length} similar action beats — possible scene duplication or repeated plot event. Review both chapters to ensure the same scene wasn't written twice.`,
            severity: matches.length >= 8 ? 'critical' : 'major',
            matchCount: matches.length,
          });
        }
      }
    }
  }

  // Sort: critical first, then passage dupes before echoes
  findings.sort((a, b) => {
    const sevOrder = { critical: 0, major: 1, minor: 2 };
    if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity];
    if (a.type !== b.type) return a.type === 'passage_duplicate' ? -1 : 1;
    return a.chapterA - b.chapterA;
  });

  return findings;
}

/**
 * Convert duplicate scene findings to Review Queue items.
 */
export function duplicateSceneFindingsToQueueItems(findings) {
  return findings.map((f, idx) => ({
    id: 'dupe|' + f.type + '|' + f.chapterA + '|' + f.chapterB + '|' + idx,
    chapterNumber: 'Ch.' + f.chapterA + ' ↔ Ch.' + f.chapterB,
    pattern: f.type === 'passage_duplicate'
      ? f.textA.substring(0, 80)
      : 'Scene echo: ' + f.matchCount + ' shared action beats',
    context: f.type === 'passage_duplicate'
      ? 'Ch.' + f.chapterA + ': "' + f.textA.substring(0, 60) + '…"\nCh.' + f.chapterB + ': "' + f.textB.substring(0, 60) + '…"'
      : 'Ch.' + f.chapterA + ': ' + f.textA.substring(0, 80) + '\nCh.' + f.chapterB + ': ' + f.textB.substring(0, 80),
    suggestion: f.description,
    detectorType: 'duplicateScene',
    subType: f.type,
    severity: f.severity,
    dismissed: false,
    addedAt: Date.now(),
  }));
}