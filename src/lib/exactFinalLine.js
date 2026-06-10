/**
 * Exact Final Line Enforcement
 *
 * Deterministic post-polish validation that ensures chapters end
 * with the exact required final line from prompt/guidance.
 *
 * This is NOT an LLM call. It is a regex-based extraction + string patch.
 *
 * Usage:
 *   const line = extractRequiredFinalLine(promptText);
 *   const { text, patched } = enforceExactFinalLine(chapterText, line, 'Ch.1');
 */

// ─── Trigger patterns for exact final line instructions ────────
// Each pattern matches the INSTRUCTION PREFIX up to and including the colon.
// The actual required line is extracted separately (same line or next line).
const FINAL_LINE_TRIGGERS = [
  /(?:the\s+)?final\s+(?:line|sentence)\s+must\s+be(?:\s+exactly)?\s*:/i,
  /(?:the\s+)?final\s+(?:line|sentence)\s+(?:is|should\s+be)(?:\s+exactly)?\s*:/i,
  /end\s+with\s+(?:this\s+)?exact\s+(?:line|sentence)\s*:/i,
  /end\s+with\s+(?:the\s+)?exact\s+(?:sentence|line)\s*:/i,
  /end\s+with\s*:/i,
];

// Patterns that look similar but should NOT trigger exact enforcement
const FALSE_POSITIVE_GUARDS = [
  /final\s+image\s+must\s+be\s+concrete/i,
  /final\s+image\s+must\s+be\s+sensory/i,
  /final\s+(?:image|moment|beat)\s+(?:should|must)\s+be/i,
  /end\s+with\s+(?:a\s+)?(?:gut[- ]?punch|powerful|strong|emotional|concrete|sensory)/i,
];

/**
 * Extract the required exact final line from prompt/guidance text.
 *
 * Supports:
 *   - Instruction + line on the same line after the colon
 *   - Instruction on one line, required line on the next line
 *   - Backtick-wrapped lines
 *   - Dialogue lines with quotation marks
 *
 * @param {string} promptText - The full prompt or guidance text
 * @returns {string|null} The required final line, or null if none found
 */
export function extractRequiredFinalLine(promptText) {
  if (!promptText || typeof promptText !== 'string') return null;

  const lines = promptText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check false positive guards first — skip lines that match
    if (FALSE_POSITIVE_GUARDS.some(rx => rx.test(trimmed))) continue;

    for (const trigger of FINAL_LINE_TRIGGERS) {
      const match = trimmed.match(trigger);
      if (!match) continue;

      // Get everything after the colon on this line
      const colonIdx = trimmed.indexOf(':', match.index + match[0].length - 1);
      if (colonIdx === -1) continue;

      const afterColon = trimmed.substring(colonIdx + 1).trim();

      let candidate = null;

      if (afterColon.length > 0) {
        // Same-line case: "The final line must be exactly: The ledger was dated May 12th."
        candidate = afterColon;
      } else {
        // Next-line case: look for the first non-empty line after this one
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine.length > 0) {
            candidate = nextLine;
            break;
          }
        }
      }

      if (!candidate || candidate.length < 3) continue;

      // Strip outer backticks only (preserve all quote characters)
      candidate = candidate.replace(/^`(.+)`$/, '$1').trim();

      // Do NOT strip quote characters — they may be part of dialogue.
      // Users who want to wrap for clarity should use backticks.

      return candidate;
    }
  }

  // Check if there's a final-line-like instruction we couldn't parse
  const hasUnparsedInstruction = lines.some(l => {
    const t = l.trim().toLowerCase();
    return (
      (t.includes('final line') || t.includes('final sentence')) &&
      (t.includes('exactly') || t.includes('must be'))
    );
  });

  if (hasUnparsedInstruction) {
    // Return a special sentinel so callers can log a warning
    return undefined; // distinguished from null (no instruction at all)
  }

  return null;
}

/**
 * Enforce the exact final line in chapter text.
 *
 * If the text already ends with the required line, returns unchanged.
 * Otherwise, replaces the final paragraph with the required line.
 *
 * @param {string} text - The chapter prose
 * @param {string|null|undefined} requiredFinalLine - The exact required ending
 * @param {string} [label='Chapter'] - Label for logging (e.g., 'Ch.1')
 * @returns {{ text: string, patched: boolean, message: string }}
 */
export function enforceExactFinalLine(text, requiredFinalLine, label = 'Chapter') {
  // No enforcement needed
  if (requiredFinalLine === null) {
    return { text, patched: false, message: '' };
  }

  // Extraction found an instruction but couldn't parse the line
  if (requiredFinalLine === undefined) {
    const msg = `[FINAL-LINE WARNING] ${label}: exact final line instruction detected but extraction failed.`;
    console.warn(msg);
    return { text, patched: false, message: msg };
  }

  if (!text || typeof text !== 'string') {
    return { text: text || '', patched: false, message: '' };
  }

  // Normalize for comparison — only trim outer whitespace
  const trimmedText = text.trimEnd();
  const normalizedRequired = requiredFinalLine.trim();

  // Check if the text already ends with the required line
  if (trimmedText.endsWith(normalizedRequired)) {
    const msg = `[FINAL-LINE OK] ${label}`;
    console.log(msg);
    return { text, patched: false, message: msg };
  }

  // Text does NOT end with the required line — patch it.
  // Strategy: replace the final paragraph (block of text after the last
  // double newline) with the required final line.

  // Split into paragraphs
  const paragraphs = trimmedText.split(/\n\n+/);

  if (paragraphs.length <= 1) {
    // Only one paragraph — append the required line
    const patched = trimmedText + '\n\n' + normalizedRequired;
    const msg = `[FINAL-LINE PATCH] ${label}: appended requiredFinalLine (single paragraph chapter).`;
    console.warn(msg);
    return { text: patched, patched: true, message: msg };
  }

  // Get the last paragraph
  const lastPara = paragraphs[paragraphs.length - 1].trim();

  // Heuristic: if the last paragraph is short (likely a closing line),
  // replace it entirely. If it's long (a full paragraph ending with the
  // wrong sentence), replace just the last sentence.
  const lastParaWords = lastPara.split(/\s+/).filter(Boolean).length;

  if (lastParaWords <= 40) {
    // Short final paragraph — replace entirely
    paragraphs[paragraphs.length - 1] = normalizedRequired;
  } else {
    // Long final paragraph — replace the last sentence
    // Find the last sentence boundary (. ! ? followed by end or space)
    const sentenceEndRx = /[.!?][""\u201d]?\s*$/;
    const lastSentenceStart = findLastSentenceStart(lastPara);

    if (lastSentenceStart > 0) {
      const beforeLastSentence = lastPara.substring(0, lastSentenceStart).trimEnd();
      paragraphs[paragraphs.length - 1] = beforeLastSentence + ' ' + normalizedRequired;
    } else {
      // Can't find sentence boundary — replace the whole paragraph
      paragraphs[paragraphs.length - 1] = normalizedRequired;
    }
  }

  const patched = paragraphs.join('\n\n');
  const msg = `[FINAL-LINE PATCH] ${label}: replaced model ending with requiredFinalLine.`;
  console.warn(msg);
  return { text: patched, patched: true, message: msg };
}

/**
 * Find the start index of the last sentence in a paragraph.
 * Returns 0 if no sentence boundary is found.
 */
function findLastSentenceStart(para) {
  // Look for sentence-ending punctuation followed by a space and a capital letter
  // Work backwards from the end to find the SECOND-TO-LAST sentence end
  const sentenceEnds = [];
  const rx = /[.!?][""\u201d]?\s+(?=[A-Z"\u201c])/g;
  let m;
  while ((m = rx.exec(para)) !== null) {
    sentenceEnds.push(m.index + m[0].length);
  }

  if (sentenceEnds.length === 0) return 0;

  // Return the start of the last sentence
  return sentenceEnds[sentenceEnds.length - 1];
}

/**
 * Convenience: extract + enforce in one call.
 * @param {string} chapterText - The chapter prose
 * @param {string} promptText - The prompt/guidance that generated this chapter
 * @param {string} [label='Chapter'] - Label for logging
 * @returns {{ text: string, patched: boolean, requiredFinalLine: string|null, message: string }}
 */
export function extractAndEnforce(chapterText, promptText, label = 'Chapter') {
  const requiredFinalLine = extractRequiredFinalLine(promptText);
  const result = enforceExactFinalLine(chapterText, requiredFinalLine, label);
  return { ...result, requiredFinalLine: requiredFinalLine || null };
}

console.log('[EXACT-FINAL-LINE] Loaded exactFinalLine.js');
