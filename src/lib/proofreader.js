/**
 * AI Proofreader — scans manuscript chapter-by-chapter for semantic issues
 * that regex-based Polish can't catch: repeated ideas, continuity errors,
 * weak prose, structural problems.
 *
 * Uses parallel batch processing (5 chapters at a time) for speed.
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel } from '@/lib/modelRouting';
import { isAnthologyProject } from '@/lib/anthologyEngine';

/**
 * Fuzzy match helper — finds closest match in fullText for a possibly
 * slightly misquoted searchText from the AI.
 */
export function findFuzzyMatch(fullText, searchText) {
  if (!searchText || searchText.length < 20) return null;
  const words = searchText.split(/\s+/);
  for (let pct = 1.0; pct >= 0.5; pct -= 0.1) {
    const numWords = Math.floor(words.length * pct);
    const partial = words.slice(0, numWords).join(' ');
    const idx = fullText.indexOf(partial);
    if (idx >= 0) {
      const sentenceEnd = fullText.indexOf('.', idx + partial.length);
      const end = sentenceEnd >= 0 ? sentenceEnd + 1 : idx + searchText.length;
      return fullText.substring(idx, end).trim();
    }
  }
  return null;
}

/**
 * Builds a trimmed proofread prompt for a single chapter.
 * Caps chapter content at 15K chars and overview at 2K chars to reduce token usage.
 */
function buildProofreadPrompt(chapterNum, content, prevContent, nextContent, overview, project, isAnthology = false) {
  const trimmedContent = content.length > 15000
    ? content.substring(0, 7000) + '\n\n[...MIDDLE TRIMMED...]\n\n' + content.substring(content.length - 7000)
    : content;

  const shortOverview = overview.length > 2000 ? overview.substring(0, 2000) : overview;

  // Anthology mode: each chapter is a standalone story
  if (isAnthology) {
    return `You are a ruthless professional editor reviewing a standalone short story titled "Chapter ${chapterNum}" in an anthology collection. This story is INDEPENDENT — it has its own characters, plot, and setting. Do NOT check for continuity with other stories.

Genre: ${project?.genre || 'Fiction'}
POV: ${project?.pov_mode || 'Third person'}
Tense: ${project?.tense || 'Past'}

STORY:
${trimmedContent}

Find 3-8 SPECIFIC issues WITHIN THIS STORY ONLY. For EACH issue provide the EXACT original text (verbatim from the story) and a drop-in rewrite.

Respond ONLY in JSON. No markdown, no backticks.

{"chapter":${chapterNum},"issues":[{"category":"critical|prose|structure|minor","type":"Brief label","description":"Why this is a problem","original_text":"EXACT text from story","suggested_rewrite":"Fixed version","severity":1}]}

RULES:
1. original_text must be EXACTLY FINDABLE in the story via string match.
2. suggested_rewrite must be a drop-in replacement — same context, same characters, better prose.
3. DO flag grammar and punctuation errors: missing subjects, commas between subject and verb ("The fan, sits"), sentence fragments, mid-sentence capitalization, broken dashes, duplicate phrases. Do NOT flag banned-word or voice-pattern issues (those are handled by a separate tool).
4. Do NOT check for consistency with other stories — this is a standalone work.
5. Do NOT flag tone, style, or convention differences from other stories — anthology stories can vary.
6. 3-8 issues max. Quality over quantity.
7. Severity: 1=nitpick, 2=worth fixing, 3=should fix, 4=editor would flag, 5=deal-breaker.
8. Rewrite must match the story's POV (${project?.pov_mode || 'third-close'}) and tense (${project?.tense || 'past'}).`;
  }

  return `You are a ruthless professional editor reviewing Chapter ${chapterNum} of a ${project?.genre || 'fiction'} manuscript. Find SPECIFIC, ACTIONABLE issues — not vague praise.

MANUSCRIPT STRUCTURE:
${shortOverview}

${prevContent ? 'PREVIOUS CHAPTER ENDING (for continuity):\n' + prevContent + '\n\n' : ''}CHAPTER ${chapterNum}:
${trimmedContent}

${nextContent ? '\nNEXT CHAPTER OPENING (for transition):\n' + nextContent + '\n' : ''}
STORY CONTEXT:
Genre: ${project?.genre || 'Fiction'}
POV: ${project?.pov_mode || 'Third person'}
Tense: ${project?.tense || 'Past'}

Find 3-8 SPECIFIC issues. For EACH issue provide the EXACT original text (verbatim from the chapter) and a drop-in rewrite.

Respond ONLY in JSON. No markdown, no backticks.

{"chapter":${chapterNum},"issues":[{"category":"critical|prose|structure|minor","type":"Brief label","description":"Why this is a problem","original_text":"EXACT text from chapter","suggested_rewrite":"Fixed version","severity":1}]}

RULES:
1. original_text must be EXACTLY FINDABLE in the chapter via string match.
2. suggested_rewrite must be a drop-in replacement — same context, same characters, better prose.
3. DO flag grammar and punctuation errors: missing subjects, commas between subject and verb ("The fan, sits"), sentence fragments, mid-sentence capitalization, broken dashes, duplicate phrases, stacked transition openers. Do NOT flag banned-word or voice-pattern issues (those are handled by a separate tool).
4. 3-8 issues max. Quality over quantity.
5. Severity: 1=nitpick, 2=worth fixing, 3=should fix, 4=editor would flag, 5=deal-breaker.
6. Rewrite must match the manuscript's POV (${project?.pov_mode || 'third-close'}) and tense (${project?.tense || 'past'}).`;
}

/**
 * Runs the AI proofreader across all loaded chapters in parallel batches of 5.
 * @param {Array<{content: string, chapter?: object}>} loaded - chapters with content
 * @param {object} project - NovelProject record
 * @param {function} onProgress - progress callback (string)
 * @returns {Promise<Array>} findings array
 */
export async function runProofreader(loaded, project, onProgress) {
  const BATCH_SIZE = 5;
  const allFindings = [];
  const isAnthology = isAnthologyProject(project);

  // Build condensed overview — chapter titles/word counts only (skip for anthology — no cross-chapter context)
  const overviewBlock = isAnthology ? '' : loaded.map((f, i) => {
    const words = (f.content || '').split(/\s+/).length;
    const title = f.chapter?.title || f.chapterTitle || `Chapter ${i + 1}`;
    return `Ch.${i + 1}: "${title}" (${words}w)`;
  }).join('\n');

  const totalBatches = Math.ceil(loaded.length / BATCH_SIZE);

  for (let batchStart = 0; batchStart < loaded.length; batchStart += BATCH_SIZE) {
    const batch = loaded.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;

    onProgress?.(`Proofreading: Batch ${batchNum}/${totalBatches} (Ch. ${batchStart + 1}–${Math.min(batchStart + BATCH_SIZE, loaded.length)}) — ${allFindings.length} issues found…`);

    const batchPromises = batch.map((entry, localIdx) => {
      const globalIdx = batchStart + localIdx;
      const chapterNum = globalIdx + 1;
      const currentContent = entry.content || '';
      if (!currentContent || currentContent.length < 100) return Promise.resolve([]);

      // Anthology: no cross-chapter context (each story is standalone)
      const prevContent = isAnthology ? '' : (globalIdx > 0 ? (loaded[globalIdx - 1].content || '').slice(-500) : '');
      const nextContent = isAnthology ? '' : (globalIdx < loaded.length - 1 ? (loaded[globalIdx + 1].content || '').substring(0, 300) : '');

      const proofPrompt = buildProofreadPrompt(
        chapterNum, currentContent, prevContent, nextContent, overviewBlock, project, isAnthology
      );

      return invokeLLMWithRetry({
      task_type: 'polish',
        prompt: proofPrompt,
        model: pickModel('critique'),
        fallback_model: 'deepseek/deepseek-v3.2-20251201',
        temperature: 0.2,
      }).then(result => {
        let text = typeof result === 'string' ? result : (result?.text || result?.content || String(result || ''));
        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        let parsed;
        try { parsed = JSON.parse(text); } catch { return []; }

        if (!parsed.issues || !Array.isArray(parsed.issues)) return [];

        return parsed.issues
          .filter(issue => {
            if (!issue.original_text) return false;
            if (currentContent.includes(issue.original_text)) return true;
            const fuzzy = findFuzzyMatch(currentContent, issue.original_text);
            if (fuzzy) { issue.original_text = fuzzy; return true; }
            return false;
          })
          .map(issue => ({
            ...issue,
            chapter: chapterNum,
            chapterIndex: globalIdx,
            scanned_content: currentContent, // exact text the AI analyzed
            status: 'pending',
          }));
      }).catch(e => {
        console.error('[PROOFREAD] Failed on Ch.' + chapterNum + ':', e.message);
        return [];
      });
    });

    const batchResults = await Promise.all(batchPromises);
    for (const results of batchResults) {
      allFindings.push(...results);
    }
  }

  allFindings.sort((a, b) => (b.severity || 3) - (a.severity || 3) || a.chapter - b.chapter);
  return allFindings;
}

/**
 * Marks a finding as accepted. No text mutation happens here —
 * text replacement is done at save time using scanned_content.
 */
export function acceptRewrite(finding) {
  // Verify the original_text exists in the scanned_content (guaranteed match)
  if (!finding.scanned_content || !finding.scanned_content.includes(finding.original_text)) {
    console.warn('[PROOFREAD-ACCEPT] original_text not found in scanned_content — AI hallucinated or fuzzy match drifted. chapterIndex:', finding.chapterIndex, '| first 60:', finding.original_text?.substring(0, 60));
    return false;
  }
  finding.status = 'accepted';
  return true;
}

/**
 * Applies all accepted findings for a given chapter to its scanned_content,
 * producing the final modified text ready to save.
 * @param {Array} chapterFindings - accepted findings for one chapter (same chapterIndex)
 * @returns {string|null} modified text, or null if nothing changed
 */
/**
 * Normalize text for fuzzy comparison — collapses whitespace, normalizes quotes.
 */
function normalizeForMatch(s) {
  if (!s) return '';
  return s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")   // smart single quotes → straight
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')   // smart double quotes → straight
    .replace(/[\u2013\u2014]/g, '-')                // en-dash / em-dash → hyphen
    .replace(/\u2026/g, '...')                       // ellipsis → three dots
    .replace(/\s+/g, ' ')                            // collapse whitespace
    .trim();
}

/**
 * Try to find `needle` in `haystack` using progressively looser matching.
 * Returns the actual substring from haystack that matched, or null.
 */
function fuzzyFind(haystack, needle) {
  if (!needle || needle.length < 5) return null;

  // 1. Exact match
  if (haystack.includes(needle)) return needle;

  // 2. Normalized match (quotes + whitespace)
  const normHay = normalizeForMatch(haystack);
  const normNeedle = normalizeForMatch(needle);
  if (normHay.includes(normNeedle)) {
    // Find the actual position in original haystack
    // Use first N words from normalized needle to locate in original
    const words = normNeedle.split(' ').slice(0, 5).join(' ');
    // Search in normalized haystack to get position
    const normIdx = normHay.indexOf(normNeedle);
    if (normIdx >= 0) {
      // Map back to original: count characters in original up to same position
      // This is approximate but works for most cases
      let origIdx = 0;
      let normCount = 0;
      while (origIdx < haystack.length && normCount < normIdx) {
        if (/\s/.test(haystack[origIdx])) {
          // Skip extra whitespace in original
          while (origIdx < haystack.length - 1 && /\s/.test(haystack[origIdx + 1])) origIdx++;
        }
        origIdx++;
        normCount++;
      }
      // Extract same-length chunk from original
      const endIdx = Math.min(origIdx + needle.length + 20, haystack.length);
      // Find the actual end — look for the last few words of the needle
      const lastWords = normNeedle.split(' ').slice(-3).join(' ');
      const chunk = normalizeForMatch(haystack.substring(origIdx, endIdx + 50));
      const lastIdx = chunk.indexOf(lastWords);
      if (lastIdx >= 0) {
        const actualEnd = origIdx + lastIdx + lastWords.length + 5;
        const candidate = haystack.substring(origIdx, Math.min(actualEnd, haystack.length)).trim();
        if (candidate.length > 0 && candidate.length < needle.length * 2) {
          return candidate;
        }
      }
    }
  }

  // 3. First-words anchor: use the first 6 words to find location, then grab the full span
  const needleWords = needle.split(/\s+/);
  if (needleWords.length >= 4) {
    for (let tryLen = Math.min(6, needleWords.length); tryLen >= 3; tryLen--) {
      const anchor = needleWords.slice(0, tryLen).join(' ');
      const normAnchor = normalizeForMatch(anchor);
      const idx = normHay.indexOf(normAnchor);
      if (idx >= 0) {
        // Find this position in original text
        const origChunk = haystack.substring(
          Math.max(0, idx - 20),
          Math.min(haystack.length, idx + needle.length + 40)
        );
        // Look for the anchor in original chunk
        const anchorIdx = origChunk.indexOf(anchor) >= 0
          ? origChunk.indexOf(anchor)
          : origChunk.indexOf(needleWords[0]);
        if (anchorIdx >= 0) {
          // Grab from anchor to approximately the right length
          const result = origChunk.substring(anchorIdx, anchorIdx + needle.length + 10);
          // Trim to sentence boundary if possible
          const periodIdx = result.indexOf('.', needle.length - 10);
          if (periodIdx >= 0 && periodIdx < result.length) {
            return result.substring(0, periodIdx + 1).trim();
          }
          return result.trim();
        }
      }
    }
  }

  return null;
}

/**
 * Applies accepted findings as PATCHES to the given currentText (fresh from DB).
 * Uses fuzzy matching to handle quote/whitespace differences between LLM output
 * and actual chapter text.
 *
 * @param {Array} chapterFindings - accepted findings for one chapter
 * @param {string} currentText - the CURRENT chapter text fresh from the database
 * @returns {{ text: string, applied: number, skipped: number } | null}
 */
export function applyAcceptedFindings(chapterFindings, currentText) {
  if (!chapterFindings.length || !currentText) return null;

  const chIdx = chapterFindings[0]?.chapterIndex;
  const acceptedFindings = chapterFindings.filter(f => f.status === 'accepted');
  console.warn('[APPLY] Chapter', chIdx, '| total findings:', chapterFindings.length, '| accepted:', acceptedFindings.length, '| currentText length:', currentText.length);

  let text = currentText;
  let applied = 0;
  let skipped = 0;

  for (const f of acceptedFindings) {
    // Try exact match first
    if (text.includes(f.original_text)) {
      text = text.replace(f.original_text, f.suggested_rewrite);
      applied++;
      console.warn('[APPLY] ✅ Exact match applied:', f.original_text?.substring(0, 50));
      continue;
    }

    // Try fuzzy match
    const actualText = fuzzyFind(text, f.original_text);
    if (actualText && text.includes(actualText)) {
      text = text.replace(actualText, f.suggested_rewrite);
      applied++;
      console.warn('[APPLY] ✅ Fuzzy match applied:', f.original_text?.substring(0, 50), '→ matched:', actualText?.substring(0, 50));
      continue;
    }

    // Also try matching against scanned_content's version if available
    if (f.scanned_content && f.scanned_content.includes(f.original_text)) {
      // The original text exists in the scanned version but not current — 
      // maybe polish already changed it. Try normalized match.
      const normCurrent = normalizeForMatch(text);
      const normOriginal = normalizeForMatch(f.original_text);
      if (normCurrent.includes(normOriginal)) {
        // It's there but with different quotes/dashes — do normalized replace
        const normRewrite = normalizeForMatch(f.suggested_rewrite);
        const newNorm = normCurrent.replace(normOriginal, f.suggested_rewrite);
        if (newNorm !== normCurrent) {
          // We can't easily map normalized back to original, so try a simpler approach:
          // Replace smart quotes in original_text to match what's in current text
          let adaptedOriginal = f.original_text;
          // Try swapping quote styles
          const variants = [
            adaptedOriginal,
            adaptedOriginal.replace(/"/g, '\u201C').replace(/"/g, '\u201D'),
            adaptedOriginal.replace(/'/g, '\u2018').replace(/'/g, '\u2019'),
            adaptedOriginal.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'"),
            adaptedOriginal.replace(/—/g, '\u2014').replace(/-/g, '\u2013'),
          ];
          let matched = false;
          for (const variant of variants) {
            if (text.includes(variant)) {
              text = text.replace(variant, f.suggested_rewrite);
              applied++;
              matched = true;
              console.warn('[APPLY] ✅ Quote-variant match applied:', variant?.substring(0, 50));
              break;
            }
          }
          if (matched) continue;
        }
      }
    }

    console.warn('[APPLY] ⚠️ Skipped (not found in current text). ch:', chIdx, '| text:', f.original_text?.substring(0, 60));
    skipped++;
  }

  console.warn('[APPLY] Chapter', chIdx, '| applied:', applied, '| skipped:', skipped, '| text changed:', text !== currentText, '| length:', currentText.length, '→', text.length);

  if (applied === 0) return null;
  return { text, applied, skipped };
}