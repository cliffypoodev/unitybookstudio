/**
 * Cleanup for manuscripts damaged by detectAndFixParallelSentences
 * in antiDetectionPolish.js.
 *
 * TWO bugs existed:
 *
 * Bug 1 (fixed earlier): The function inserted FICTION-narrative openers
 * ("For a moment,", "Without thinking,", "At last,") into NONFICTION books.
 * Result: grammatically broken fragments ("For a moment, every ATM fee.").
 *
 * Bug 2 (fixed now): Even the "nonfiction-safe" pool of 12 openers
 * ("In practice,", "Notice that", "Consider:", etc.) was getting sprayed
 * 30-50x EACH across 70K+ word manuscripts, creating a different but
 * equally fatal AI-detection fingerprint. Gemini flagged The Radical
 * Steward as "Extremely Likely AI-Generated" citing these exact phrases.
 *
 * This module strips ALL damaged openers — both fiction AND nonfiction
 * pools — so the raw sentence content shows through. It runs automatically
 * as Step 0 of the polish pipeline, BEFORE any other polish steps.
 *
 * Safe to run on any manuscript. The stripping only catches sentence-starter
 * positions (after [.!?] or paragraph break) followed by a lowercase letter,
 * which is the exact pattern the bug produced. Legitimate uses of these
 * phrases (e.g. authored "In fact, the data shows...") typically follow
 * a period with the next word already capitalized, so they're preserved.
 */

// The 13 fiction-narrative openers from the original buggy pool.
const FICTION_DAMAGED_OPENERS = [
  'Instead, ',
  'By then, ',
  'Still, ',
  'And yet ',
  'Even so, ',
  'Meanwhile, ',
  'Before long, ',
  'Without thinking, ',
  'At last, ',
  'In truth, ',
  'For a moment, ',
  'This time, ',
  'Not that it mattered — ',
];

// The 12 nonfiction openers that replaced the fiction pool but caused
// the same problem at scale: 30-50x each across a 70K+ word manuscript.
const NONFICTION_DAMAGED_OPENERS = [
  'In practice, ',
  'Notice that ',
  'The key is, ',
  'That said, ',
  'Put simply, ',
  'In short, ',
  'More importantly, ',
  'Consider: ',
  'Of course, ',
  'In fact, ',
  'The result is, ',
  'By contrast, ',
];

// Combined list — strip ALL of them regardless of project type.
// A manuscript may have been polished multiple times with different
// versions of the tool, accumulating both fiction AND nonfiction openers.
const ALL_DAMAGED_OPENERS = [...FICTION_DAMAGED_OPENERS, ...NONFICTION_DAMAGED_OPENERS];

/**
 * Strip damaged openers from the given loaded[] array in-place.
 * Each opener is only removed when it appears at sentence-start position
 * (after [.!?] + optional closing quote + whitespace, or after paragraph
 * break). Mid-sentence uses are preserved.
 *
 * After stripping, the next word is uppercased so the sentence is
 * grammatically complete again.
 *
 * Returns:
 *   {
 *     totalStripped: number,
 *     perChapter: [{ chapterNumber, stripped, perOpener }],
 *     changes: string[],  // human-readable summary lines
 *   }
 */
export function runTransitionCleanup(loaded, onProgress) {
  onProgress?.('Cleanup: Stripping damaged transition openers…');
  let totalStripped = 0;
  const perChapter = [];
  const changes = [];

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    let chapterStripped = 0;
    const perOpener = {};

    for (const opener of ALL_DAMAGED_OPENERS) {
      // Escape regex special characters in the opener
      const escaped = opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match only at sentence-start: (start of string|after sentence-ender|paragraph break) + opener + lowercase letter
      // The lowercase letter confirms this is actually the opener-prepended-to-lowered-subject pattern the bug produced.
      const rx = new RegExp('(^|[.!?]["\\u201d]?\\s+|\\n\\n)' + escaped + '([a-z])', 'g');
      let matchCount = 0;

      f.content = f.content.replace(rx, (match, prefix, firstLetter) => {
        matchCount++;
        chapterStripped++;
        totalStripped++;
        return prefix + firstLetter.toUpperCase();
      });

      if (matchCount > 0) {
        perOpener[opener.trim()] = matchCount;
      }
    }

    // Bookkeeping
    if (chapterStripped > 0) {
      perChapter.push({ chapterNumber: chNum, stripped: chapterStripped, perOpener });
      const perOpenerSummary = Object.entries(perOpener)
        .map(([op, n]) => `"${op}" x${n}`)
        .join(', ');
      changes.push(`Ch.${chNum}: stripped ${chapterStripped} damaged openers (${perOpenerSummary})`);
      console.log(`[TRANSITION-CLEANUP] Ch.${chNum}: ${chapterStripped} stripped`);
    }
  }

  onProgress?.(`Cleanup: Stripped ${totalStripped} damaged transitions across ${perChapter.length} chapters.`);
  console.log(`[TRANSITION-CLEANUP] COMPLETE: ${totalStripped} openers stripped from ${perChapter.length} chapters`);

  return {
    totalStripped,
    perChapter,
    changes,
  };
}

/**
 * Dry-run audit: report what WOULD be stripped, but don't modify anything.
 * Useful for previewing the cleanup impact before running it.
 */
export function auditTransitionDamage(loaded) {
  let totalWouldStrip = 0;
  const perChapter = [];
  const perOpenerGlobal = {};

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    let chapterWouldStrip = 0;
    const perOpener = {};

    for (const opener of ALL_DAMAGED_OPENERS) {
      const escaped = opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp('(^|[.!?]["\\u201d]?\\s+|\\n\\n)' + escaped + '([a-z])', 'g');
      const matches = f.content.match(rx) || [];
      if (matches.length > 0) {
        perOpener[opener.trim()] = matches.length;
        perOpenerGlobal[opener.trim()] = (perOpenerGlobal[opener.trim()] || 0) + matches.length;
        chapterWouldStrip += matches.length;
        totalWouldStrip += matches.length;
      }
    }

    if (chapterWouldStrip > 0) {
      perChapter.push({ chapterNumber: chNum, wouldStrip: chapterWouldStrip, perOpener });
    }
  }

  return {
    totalWouldStrip,
    perChapter,
    perOpenerGlobal,
    recommendation: totalWouldStrip > 50
      ? 'Heavy damage — run cleanup, then re-polish with the fixed tool.'
      : totalWouldStrip > 10
        ? 'Light damage — run cleanup to be safe.'
        : 'Minimal or no damage detected.',
  };
}