/**
 * Step L: Disclaimer Stripper — NONFICTION ONLY
 * 
 * Removes all composite/methodology disclaimer boilerplate from body chapter text.
 * Skips front matter (chapter_number 0 or titles containing "Author's Note") so the
 * single legitimate disclaimer in the Author's Note is preserved.
 *
 * Runs FIRST in the nonfiction polish pipeline, before banned words or repetition
 * thresholds are evaluated, so counts drop before other steps assess the manuscript.
 */

import { safeUppercaseReplace } from './safeUppercase.js';

// ── BRACKETED PATTERNS — delete the entire bracket block ────────────────────

const BRACKETED_PATTERNS = [
  /\[[^\]]*\bcomposite\b[^\]]*\]/gi,
  /\[[^\]]*\bfollowing account\b[^\]]*\]/gi,
  /\[[^\]]*\bdrawn from multiple\b[^\]]*\]/gi,
  /\[[^\]]*\bdocumented experiences\b[^\]]*\]/gi,
  /\[Author'?s?\s*note[^\]]*\]/gi,
  /\[Editor'?s?\s*note[^\]]*\]/gi,
  /\[VERIFY[^\]]*\]/gi,
  /\[FACT-CHECK[^\]]*\]/gi,
  /\[SOURCE NEEDED[^\]]*\]/gi,
  /\[CITATION NEEDED[^\]]*\]/gi,
  /\[end composite\]/gi,
];

// ── SENTENCE-LEVEL KEYWORD COMBINATION TESTS ────────────────────────────────
// A sentence is deleted if it matches ANY of these keyword-combination tests.

function sentenceMatchesDisclaimerPattern(sentence) {
  const lower = sentence.toLowerCase();

  // Combination 1: "composite" + "drawn from" + "documented" + "period"
  if (lower.includes('composite') && lower.includes('drawn from') && lower.includes('documented') && lower.includes('period')) return true;

  // Combination 2: "following account" + "composite"
  if (lower.includes('following account') && lower.includes('composite')) return true;

  // Combination 3: "composite" + "multiple documented experiences"
  if (lower.includes('composite') && lower.includes('multiple documented experiences')) return true;

  // Combination 4: "composite" + "drawn from" + "documented"
  if (lower.includes('composite') && lower.includes('drawn from') && lower.includes('documented')) return true;

  // Combination 5: "composite" + "drawn from" + "multiple"
  if (lower.includes('composite') && lower.includes('drawn from') && lower.includes('multiple')) return true;

  // Combination 6: "composite" + "drawn from" + "experiences"
  if (lower.includes('composite') && lower.includes('drawn from') && lower.includes('experiences')) return true;

  // Combination 7: "composite" + "drawn from" + "accounts"
  if (lower.includes('composite') && lower.includes('drawn from') && lower.includes('accounts')) return true;

  // Combination 8: "following account is a composite" (exact-ish)
  if (/following account is a composite/i.test(sentence)) return true;

  // Combination 9: "composite figure drawn from" or "composite account drawn from"
  if (/composite\s+(?:figure|account|character|portrait|narrative|story)\s+drawn\s+from/i.test(sentence)) return true;

  // Combination 10: "drawn from multiple documented experiences of the period"
  if (/drawn from (?:multiple|several|various) documented (?:experiences|accounts|records|sources) of the period/i.test(sentence)) return true;

  // Combination 11: standalone methodology sentences
  if (/^a composite (?:figure|character|portrait|narrative|account)/i.test(sentence.trim())) return true;
  if (/^the following (?:account|narrative|story|section) is (?:a )?composite/i.test(sentence.trim())) return true;
  if (/^this (?:account|narrative|story|section) is (?:a )?composite/i.test(sentence.trim())) return true;

  return false;
}

// ── MAIN FUNCTION ───────────────────────────────────────────────────────────

/**
 * Strip all disclaimer/composite boilerplate from body chapters.
 * Skips front matter (chapter 0, Author's Note) to preserve the legitimate disclaimer.
 *
 * @param {Array<{chapter: object, content: string, original: string}>} loaded
 * @param {function} [onProgress]
 * @returns {{ totalRemoved: number, changes: string[] }}
 */
export function runDisclaimerStripper(loaded, onProgress) {
  onProgress?.('Polish (NF): Step L — Stripping disclaimers…');
  let totalRemoved = 0;
  const changes = [];

  for (const f of loaded) {
    const chNum = f.chapter.chapter_number;
    const chTitle = (f.chapter.title || '').toLowerCase();

    // Skip front matter: chapter 0, Author's Note, Copyright, Dedication, etc.
    if (chNum === 0 || chNum === '0') continue;
    if (chTitle.includes("author's note") || chTitle.includes('author note') || chTitle.includes('copyright') || chTitle.includes('front matter') || chTitle.includes('title page') || chTitle.includes('dedication') || chTitle.includes('epigraph') || chTitle.includes('foreword') || chTitle.includes('preface')) continue;

    let chapterRemoved = 0;
    const before = f.content;

    // Pass 1: Strip all bracketed disclaimer patterns
    for (const rx of BRACKETED_PATTERNS) {
      const matches = f.content.match(rx);
      if (matches) {
        chapterRemoved += matches.length;
        f.content = f.content.replace(rx, '');
      }
    }

    // Pass 2: Sentence-level deletion using keyword combinations
    // Split into paragraphs, then sentences within each paragraph
    const paragraphs = f.content.split(/\n\n+/);
    const cleanedParagraphs = [];

    for (const para of paragraphs) {
      if (!para.trim()) { cleanedParagraphs.push(para); continue; }

      // Split paragraph into sentences (preserving delimiters)
      const sentences = para.split(/(?<=[.!?])\s+/);
      const kept = [];

      for (const sentence of sentences) {
        if (sentenceMatchesDisclaimerPattern(sentence)) {
          chapterRemoved++;
          // Don't keep this sentence
        } else {
          kept.push(sentence);
        }
      }

      // If all sentences in the paragraph were removed, skip the paragraph entirely
      if (kept.length > 0) {
        cleanedParagraphs.push(kept.join(' '));
      }
    }

    f.content = cleanedParagraphs.join('\n\n');

    // Pass 3: Clean up artifacts left by deletion
    f.content = f.content.replace(/\n\s*\n\s*\n+/g, '\n\n');  // collapse triple+ newlines
    f.content = f.content.replace(/  +/g, ' ');                 // collapse double spaces
    f.content = f.content.replace(/^\s+/gm, (m) => m.replace(/ +/, '')); // leading spaces on lines
    f.content = f.content.replace(/(?<!\.)\.(\s*)\.\s(?!\.)/g, '. ');  // double periods (skip ellipsis)
    // Fix orphaned lowercase after deletion left a sentence starting mid-thought
    // Uses shared guard: protects abbreviations, ellipsis, proper nouns, sentence-start abbreviations
    f.content = safeUppercaseReplace(f.content);

    if (chapterRemoved > 0) {
      totalRemoved += chapterRemoved;
      changes.push('Ch.' + (chNum || '?') + ': stripped ' + chapterRemoved + ' disclaimer(s)');
      console.log('[STEP-L] Ch.' + (chNum || '?') + ': removed ' + chapterRemoved + ' disclaimers (' + before.length + ' → ' + f.content.length + ' chars)');
    }
  }

  if (totalRemoved > 0) {
    changes.unshift('Step L: Removed ' + totalRemoved + ' total disclaimer/composite boilerplate instances');
    console.log('[STEP-L] TOTAL disclaimers removed across manuscript:', totalRemoved);
  }

  return { totalRemoved, changes };
}