/**
 * Cross-book contamination detector.
 *
 * Scans a manuscript for character names that appear suspiciously concentrated
 * in a small number of chapters, which often indicates text from a DIFFERENT
 * book/project got pasted in during generation (Base44 context leak, wrong
 * Series Bible injected, or a regen drifted into another project's cast).
 *
 * The detector is DETECT-ONLY — it does not modify the manuscript. Findings
 * are surfaced in the Polish Review Queue so the author can use their editor's
 * find-replace to clean up.
 *
 * Method:
 *   1. Extract all multi-mention Capitalized tokens (potential names).
 *   2. For each candidate, compute: total mentions, chapters appearing in,
 *      first chapter appearance, concentration ratio.
 *   3. Flag names that appear 10+ times but concentrated in ≤20% of chapters
 *      AND first appear after 40% mark — matches the profile of "pasted in
 *      from another project" rather than "introduced mid-book as cast
 *      expansion" (which shows gradual adoption, not sudden concentration).
 *   4. Cross-reference against the project's deny_characters list (if set)
 *      for an instant flag regardless of pattern.
 *   5. Exclude names on the project's characters list (canonical cast).
 */

// Common English capitalized words to never flag as character names
const NEVER_FLAG = new Set([
  'The', 'And', 'But', 'Then', 'Now', 'That', 'This', 'When', 'Where', 'What',
  'Why', 'How', 'Her', 'His', 'She', 'They', 'Their', 'Them', 'Not', 'Yes',
  'Before', 'After', 'Even', 'Still', 'Yet', 'Instead', 'Meanwhile', 'Finally',
  'Suddenly', 'Really', 'Actually', 'Literally', 'Completely', 'Somehow',
  'Everywhere', 'Nobody', 'Somebody', 'Anybody', 'Everyone', 'Someone',
  'Earth', 'Texas', 'Earthman', 'Sheriff', 'Chapter', 'Something', 'Nothing',
  'Perhaps', 'Either', 'Neither', 'Maybe', 'Unless', 'Because', 'Rather',
  'During', 'Besides', 'Throughout', 'However', 'Across', 'Around', 'Between',
  'Through', 'Among', 'Against', 'Toward', 'Towards', 'Above', 'Below',
  'Beyond', 'Within', 'Without', 'Along', 'Behind', 'Beside', 'Beneath',
  'Inside', 'Outside', 'Right', 'Left', 'North', 'South', 'East', 'West',
  'Jesus', 'Christ', 'God', 'Lord', // often exclamations not names
]);

/**
 * Extract chapter-segmented text from a flat manuscript string.
 * Splits on "Chapter N" headers.
 */
function splitIntoChapters(fullText) {
  const chapterRx = /(?:^|\n)\s*Chapter\s+(\d+)(?:\s*[:—\-]|\s*\n)/gi;
  const matches = [...fullText.matchAll(chapterRx)];
  if (matches.length === 0) {
    // No chapter markers found — treat as single chapter
    return [{ num: 1, text: fullText }];
  }
  const chapters = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : fullText.length;
    chapters.push({
      num: parseInt(matches[i][1]),
      text: fullText.substring(start, end),
    });
  }
  return chapters;
}

/**
 * Parse a list of canonical names from a project's characters_md string.
 * Heuristic: find all Capitalized word tokens that appear at least twice
 * in the bible and look like proper names.
 */
function extractCanonicalNames(charactersMd) {
  if (!charactersMd) return new Set();
  const tokens = charactersMd.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/g) || [];
  const counts = {};
  tokens.forEach(t => {
    const first = t.split(/\s+/)[0];
    if (!NEVER_FLAG.has(first)) {
      counts[first] = (counts[first] || 0) + 1;
    }
  });
  return new Set(Object.keys(counts));
}

/**
 * Main detector. Runs against the full manuscript (joined chapters).
 *
 * @param {Array<{chapter: object, content: string}>} loaded
 * @param {object} project - needs characters_md, deny_characters, allow_characters
 * @returns {Array<{name, totalCount, chaptersAppearing, firstChapter, confidence, reason}>}
 */
export function detectCrossBookContamination(loaded, project) {
  if (!loaded || loaded.length < 3) return []; // too short to detect

  // Parse project configuration
  const canonNames = extractCanonicalNames(project?.characters_md);

  // Optional deny/allow overrides (stored on project entity or ephemeral)
  const explicitDeny = (project?.deny_characters || '').split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  const explicitAllow = (project?.allow_characters || '').split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  const allowSet = new Set([...canonNames, ...explicitAllow]);
  const denySet = new Set(explicitDeny);

  // Build full-text and chapter-indexed maps
  const chapterTexts = loaded
    .map(f => ({ num: f.chapter?.chapter_number || '?', text: f.content }))
    .sort((a, b) => (parseInt(a.num) || 0) - (parseInt(b.num) || 0));

  const totalChapters = chapterTexts.length;
  const fullText = chapterTexts.map(c => c.text).join('\n\n');

  // Extract candidate names
  const tokens = fullText.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  const totalCounts = {};
  tokens.forEach(t => {
    if (NEVER_FLAG.has(t)) return;
    totalCounts[t] = (totalCounts[t] || 0) + 1;
  });

  const findings = [];

  for (const [name, total] of Object.entries(totalCounts)) {
    // Always flag explicit deny hits
    if (denySet.has(name)) {
      const chaptersAppearing = chapterTexts.filter(c =>
        new RegExp('\\b' + name + '\\b').test(c.text)
      ).map(c => c.num);
      findings.push({
        name,
        totalCount: total,
        chaptersAppearing,
        firstChapter: chaptersAppearing[0] || '?',
        confidence: 'high',
        reason: 'Explicitly listed in your "deny" list — known contamination.',
      });
      continue;
    }

    // Skip canonical characters
    if (allowSet.has(name)) continue;

    // Skip low-frequency tokens (probably just one-off mentions)
    if (total < 10) continue;

    // Compute chapter distribution
    const chaptersAppearing = [];
    chapterTexts.forEach(c => {
      if (new RegExp('\\b' + name + '\\b').test(c.text)) {
        chaptersAppearing.push(c.num);
      }
    });

    const concentrationRatio = chaptersAppearing.length / totalChapters;
    const firstChapterIdx = chapterTexts.findIndex(c =>
      new RegExp('\\b' + name + '\\b').test(c.text)
    );
    const lateArrival = firstChapterIdx / totalChapters;

    // Flag if concentrated (≤ 20% of chapters) AND arrives late (> 40% mark)
    // OR if very high total mentions in very few chapters (≤ 3 chapters)
    const suspicious =
      (concentrationRatio <= 0.20 && lateArrival > 0.40) ||
      (chaptersAppearing.length <= 3 && total >= 20);

    if (suspicious) {
      findings.push({
        name,
        totalCount: total,
        chaptersAppearing,
        firstChapter: chaptersAppearing[0] || '?',
        confidence: chaptersAppearing.length <= 2 ? 'high' : 'medium',
        reason: chaptersAppearing.length <= 2
          ? `Appears ${total} times but only in ${chaptersAppearing.length} chapter(s) — likely contamination or scene from another project.`
          : `${total} mentions concentrated in ${chaptersAppearing.length}/${totalChapters} chapters, first appearing at ch. ${chaptersAppearing[0]}. Could be late cast addition or contamination — review.`,
      });
    }
  }

  // Sort by severity: high-confidence first, then by total count descending
  findings.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1;
    return b.totalCount - a.totalCount;
  });

  return findings;
}

/**
 * Format contamination findings as Review Queue items compatible with the
 * existing missing-noun warning structure.
 */
export function contaminationFindingsToQueueItems(findings) {
  return findings.map(f => ({
    id: 'contam|' + f.name,
    chapterNumber: String(f.firstChapter) + ' (+' + (f.chaptersAppearing.length - 1) + ' more)',
    pattern: f.name,
    context: `Appears ${f.totalCount}x in chapters: ${f.chaptersAppearing.join(', ')}`,
    suggestion: f.reason,
    contaminationType: true,
    dismissed: false,
    addedAt: Date.now(),
  }));
}
/* ═════════════════════════════════════════════════════════════════════════
 * NAME VARIANT DETECTOR
 *
 * Catches the Kael/Kaelen problem: two spellings of the same character name
 * used across different chapters. The contamination detector misses this
 * because both variants appear in many chapters (not concentrated).
 *
 * Method:
 *   1. Extract all Capitalized tokens with 3+ occurrences across the manuscript.
 *   2. For each pair, compute Levenshtein edit distance.
 *   3. Flag pairs with distance ≤ 2 AND both appearing in 2+ chapters
 *      AND at least one variant appearing 5+ times.
 *   4. Check if one is a substring of the other (Kael → Kaelen).
 *   5. Exclude known safe pairs (plural/possessive forms, common words).
 * ═══════════════════════════════════════════════════════════════════════ */

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Pairs that look similar but are different words — never flag
const SAFE_PAIRS = new Set([
  'arena|arenas', 'enforcer|enforcers', 'someone|something', 'someone|somewhere',
  'something|sometimes', 'something|somewhere', 'look|looked', 'take|taken',
  'come|comes', 'came|came', 'make|makes', 'made|made', 'time|times',
  'place|places', 'place|placed', 'think|thinks', 'thought|thoughts',
  'world|worlds', 'hand|hands', 'head|heads', 'door|doors', 'room|rooms',
  'fire|fired', 'fire|fires', 'turn|turns', 'turn|turned', 'move|moved',
  'move|moves', 'side|sides', 'light|lights', 'light|lighted',
  'earth|earthly', 'fine|finish', 'stardust|status',
  'containment|contamination',
]);

function isSafePair(a, b) {
  const key1 = a.toLowerCase() + '|' + b.toLowerCase();
  const key2 = b.toLowerCase() + '|' + a.toLowerCase();
  if (SAFE_PAIRS.has(key1) || SAFE_PAIRS.has(key2)) return true;

  const al = a.toLowerCase(), bl = b.toLowerCase();

  // Plural/possessive: "Arena" vs "Arenas", "Enforcer" vs "Enforcers"
  if (al + 's' === bl || bl + 's' === al) return true;
  if (al + 'es' === bl || bl + 'es' === al) return true;
  if (al + "'s" === bl || bl + "'s" === al) return true;

  // Past tense: "Look" vs "Looked"
  if (al + 'ed' === bl || bl + 'ed' === al) return true;
  if (al + 'd' === bl || bl + 'd' === al) return true;

  // -ing form
  if (al + 'ing' === bl || bl + 'ing' === al) return true;

  // -ly form
  if (al + 'ly' === bl || bl + 'ly' === al) return true;

  return false;
}

/**
 * Detect name variants — two similar spellings of what's likely the same character.
 *
 * @param {Array<{chapter: object, content: string}>} loaded
 * @returns {Array<{nameA, nameB, countA, countB, chaptersA, chaptersB, editDistance, suggestion}>}
 */
export function detectNameVariants(loaded) {
  if (!loaded || loaded.length < 2) return [];

  // Count names per chapter
  const namesByChapter = {};
  const globalCounts = {};
  const chapterSets = {};

  for (const entry of loaded) {
    const chNum = entry.chapter?.chapter_number || '?';
    const text = entry.content || '';
    const names = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
    const counts = {};
    for (const n of names) {
      if (NEVER_FLAG.has(n)) continue;
      counts[n] = (counts[n] || 0) + 1;
    }
    namesByChapter[chNum] = counts;
    for (const [n, c] of Object.entries(counts)) {
      globalCounts[n] = (globalCounts[n] || 0) + c;
      if (!chapterSets[n]) chapterSets[n] = new Set();
      chapterSets[n].add(chNum);
    }
  }

  // Filter to names with 3+ occurrences across the manuscript
  const candidates = Object.entries(globalCounts)
    .filter(([n, c]) => c >= 3 && (chapterSets[n]?.size || 0) >= 1)
    .map(([n]) => n)
    .sort();

  const findings = [];
  const seen = new Set();

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i], b = candidates[j];

      // Quick length check — skip if lengths differ by more than 3
      if (Math.abs(a.length - b.length) > 3) continue;

      // Quick prefix check — must share first 3 chars
      if (a.substring(0, 3).toLowerCase() !== b.substring(0, 3).toLowerCase()) continue;

      if (isSafePair(a, b)) continue;

      const dist = levenshtein(a.toLowerCase(), b.toLowerCase());
      if (dist > 2) continue;

      // At least one must have 5+ occurrences
      if (globalCounts[a] < 5 && globalCounts[b] < 5) continue;

      // Both must appear in at least 1 chapter
      const chA = [...(chapterSets[a] || [])];
      const chB = [...(chapterSets[b] || [])];

      const pairKey = [a, b].sort().join('|');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      // Check if they appear in the SAME chapters (both used interchangeably)
      // or DIFFERENT chapters (author switched spelling partway through)
      const overlap = chA.filter(c => chB.includes(c));
      const isSubstring = a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());

      let suggestion = '';
      if (overlap.length > 0) {
        suggestion = `"${a}" and "${b}" appear in the same chapter(s) ${overlap.join(', ')} — likely the same character with inconsistent spelling. Pick one and find/replace the other.`;
      } else {
        suggestion = `"${a}" (${globalCounts[a]}x in ch.${chA.join(',')}) and "${b}" (${globalCounts[b]}x in ch.${chB.join(',')}) — ${isSubstring ? 'one is a substring of the other' : 'very similar spelling'}. If same character, pick one and find/replace.`;
      }

      findings.push({
        nameA: a,
        nameB: b,
        countA: globalCounts[a],
        countB: globalCounts[b],
        chaptersA: chA,
        chaptersB: chB,
        editDistance: dist,
        overlap: overlap.length,
        suggestion,
      });
    }
  }

  // Sort by total combined count (most impactful first)
  findings.sort((a, b) => (b.countA + b.countB) - (a.countA + a.countB));

  return findings;
}

/**
 * Convert name variant findings to Review Queue items.
 */
export function nameVariantFindingsToQueueItems(findings) {
  return findings.map(f => ({
    id: 'namevar|' + f.nameA + '|' + f.nameB,
    chapterNumber: 'All',
    pattern: f.nameA + ' / ' + f.nameB,
    context: `"${f.nameA}" ${f.countA}x (ch.${f.chaptersA.join(',')}) vs "${f.nameB}" ${f.countB}x (ch.${f.chaptersB.join(',')})`,
    suggestion: f.suggestion,
    detectorType: 'nameVariant',
    dismissed: false,
    addedAt: Date.now(),
  }));
}