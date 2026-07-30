/**
 * Surgical Fix Engine — apply selected critique findings to the manuscript.
 *
 * Rules (learned the hard way):
 * - LLM find-and-replace NEVER works. Extract the paragraph verbatim,
 *   have the LLM rewrite the WHOLE paragraph, splice back by exact match.
 * - Every save goes through prepareChapterContent → Chapter.update → verify.
 * - Content-loss guard: finalWords >= 85% of preFixWords, else revert.
 * - 800ms delay between chapter saves.
 *
 * @module surgicalFix
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry.js';
import { countAISlopPatterns } from '@/lib/aiSlopReduction.js';
import { prepareChapterContent, resolveChapterContent } from '@/lib/chapterStorage.js';
import { base44 } from '@/api/base44Client.js';
import { runWithNetworkRetry } from '@/lib/requestRetry.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * HELPERS
 * ═════════════════════════════════════════════════════════════════════════ */

function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Normalize text for matching (collapse whitespace, normalize quotes).
 */
function normalizeForMatch(text) {
  return text
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the full paragraph containing a quote in the chapter text.
 * Paragraphs are separated by double newlines.
 * Returns { paragraph, index } or null if not found.
 */
function findContainingParagraph(chapterText, quote) {
  if (!chapterText || !quote) return null;

  const normalizedQuote = normalizeForMatch(quote);
  const paragraphs = chapterText.split(/\n\s*\n/);

  let charOffset = 0;
  for (const para of paragraphs) {
    const normalizedPara = normalizeForMatch(para);
    if (normalizedPara.includes(normalizedQuote)) {
      // Find the exact start of this paragraph in the original text
      const paraIndex = chapterText.indexOf(para, charOffset);
      return { paragraph: para, index: paraIndex >= 0 ? paraIndex : charOffset };
    }
    charOffset += para.length + 2; // +2 for the \n\n separator
  }
  return null;
}

/**
 * Build context: the paragraph before, target paragraph, and paragraph after.
 */
function extractParagraphWithContext(chapterText, paragraph) {
  const paragraphs = chapterText.split(/\n\s*\n/);
  const idx = paragraphs.findIndex(p => p.trim() === paragraph.trim());
  if (idx < 0) return { before: '', target: paragraph, after: '' };

  return {
    before: idx > 0 ? paragraphs[idx - 1] : '',
    target: paragraphs[idx],
    after: idx < paragraphs.length - 1 ? paragraphs[idx + 1] : '',
  };
}

/**
 * Splice a revised paragraph back into chapter text by exact match of the original.
 */
function spliceParagraph(chapterText, originalParagraph, revisedParagraph) {
  const idx = chapterText.indexOf(originalParagraph);
  if (idx < 0) return null; // exact match failed
  return chapterText.slice(0, idx) + revisedParagraph + chapterText.slice(idx + originalParagraph.length);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * LLM CALLER
 * ═════════════════════════════════════════════════════════════════════════ */

async function callPolishLLM(prompt, _llmOverride) {
  if (_llmOverride) {
    const result = await _llmOverride(prompt);
    return typeof result === 'string' ? result : String(result);
  }
  const response = await invokeLLMWithRetry({
    prompt,
    task_type: 'polish',
    temperature: 0.3,
    max_tokens: 4096,
  });
  return typeof response === 'string' ? response : String(response);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PROSE FIX — LLM paragraph rewrite with verification
 * ═════════════════════════════════════════════════════════════════════════ */

async function applyProseFix(chapterText, issue, _llmOverride) {
  // 1. Locate the quote in the chapter
  const location = findContainingParagraph(chapterText, issue.quote);
  if (!location) {
    return { status: 'stale', chapterText, detail: 'Quote not found in chapter text' };
  }

  // 2. Extract context
  const { before, target, after } = extractParagraphWithContext(chapterText, location.paragraph);

  // 3. Build LLM prompt
  const prompt = [
    'You are a prose polisher. Rewrite ONLY the TARGET PARAGRAPH below to address this specific issue:',
    '',
    `ISSUE: ${issue.description}`,
    `PROBLEMATIC QUOTE: "${issue.quote}"`,
    '',
    before ? `PRECEDING PARAGRAPH (for context, do NOT rewrite this):\n${before}\n` : '',
    `TARGET PARAGRAPH (rewrite this ENTIRE paragraph):\n${target}\n`,
    after ? `FOLLOWING PARAGRAPH (for context, do NOT rewrite this):\n${after}\n` : '',
    '',
    'RULES:',
    '- Rewrite the entire target paragraph, not just the problematic quote.',
    '- Preserve all events, facts, character names, and dialogue.',
    '- Keep the revised paragraph within ±10% of the original length.',
    '- Do NOT introduce any of these words: palpable, meticulously, luminous, relentless, tapestry, visceral.',
    '- Return ONLY the revised paragraph text. No explanations, no markdown fences.',
  ].filter(Boolean).join('\n');

  // 4. Call LLM
  let revised;
  try {
    revised = await callPolishLLM(prompt, _llmOverride);
    // Strip any markdown fences the LLM might add
    revised = revised.replace(/^```[\w]*\n?/gm, '').replace(/```\s*$/gm, '').trim();
  } catch (err) {
    return { status: 'failed', chapterText, detail: 'LLM call failed: ' + (err?.message || err) };
  }

  // 5. Verify the revision
  const originalWords = countWords(target);
  const revisedWords = countWords(revised);

  // Length check: 0.88–1.25 (12% cut floor consistent with pipeline-wide LLM cut limit;
  // 25% expansion ceiling gives headroom for tell→show rewrites).
  if (originalWords > 0 && (revisedWords < originalWords * 0.88 || revisedWords > originalWords * 1.25)) {
    return { status: 'failed', chapterText, detail: `Length mismatch: ${originalWords} → ${revisedWords} words (ratio ${(revisedWords / originalWords).toFixed(2)}, allowed 0.88–1.25)` };
  }

  // Slop check: don't introduce more slop
  const beforeSlop = countAISlopPatterns(target).total;
  const afterSlop = countAISlopPatterns(revised).total;
  if (afterSlop > beforeSlop) {
    return { status: 'failed', chapterText, detail: `Slop increased: ${beforeSlop} → ${afterSlop}` };
  }

  // 6. FIXGUARD-1: dialogue mechanics. The polish model demonstrably drops opening
  // quotes - on 2026-07-30 the draft path healed 27 missing openers and the polisher
  // then produced 27 MORE in text that was already clean. The draft path survives that
  // because PARABREAK and the orphan healer run after the model. THIS path had neither,
  // so a fix could silently unbalance dialogue and still report "applied".
  //
  // Proven against the live code with a real Chapter 4 paragraph: an 88-word revision
  // with one opening quote removed passed the length guard, passed the slop guard, was
  // marked applied, and was saved. Chapter imbalance went 0 -> 1. The export gate only
  // hard-blocks above 5 dialogue issues, so damage of this size ships.
  //
  // Repair first, reject second. Splitting is deliberately OFF: this operates on a
  // single paragraph that must splice back as a single paragraph.
  let repaired = revised;
  try {
    const dm = await import('./dialogueMechanicsRepair.js');
    const pass = dm.runDialogueMechanicsPass(revised, {
      stage: 'surgical-fix',
      splitCollapsedParagraphs: false,
    });
    if (pass && typeof pass.text === 'string' && pass.text.trim()) repaired = pass.text;
  } catch (err) {
    // A repair module failure must not silently pass damaged text through.
    console.warn('[FIXGUARD-1] dialogue repair unavailable, falling back to balance check only: ' + (err?.message || err));
  }

  const openCount = (repaired.match(/\u201c/g) || []).length;
  const closeCount = (repaired.match(/\u201d/g) || []).length;
  const originalOpen = (target.match(/\u201c/g) || []).length;
  const originalClose = (target.match(/\u201d/g) || []).length;
  if (openCount !== closeCount && (originalOpen === originalClose)) {
    return {
      status: 'failed',
      chapterText,
      detail: `Dialogue damage: revision has ${openCount} opening and ${closeCount} closing quotes (original was balanced at ${originalOpen}). Original paragraph kept.`,
    };
  }
  revised = repaired;

  // 7. Splice
  const spliced = spliceParagraph(chapterText, location.paragraph, revised);
  if (spliced === null) {
    return { status: 'failed', chapterText, detail: 'Exact paragraph match failed during splice' };
  }

  return {
    status: 'applied',
    chapterText: spliced,
    before: target,
    after: revised,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * MAIN EXPORT
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Apply surgical fixes from critique findings.
 *
 * @param {object}   params
 * @param {Array}    params.loaded       Array of { chapter, content, original }
 * @param {Array}    params.issues       Array of { severity, chapterNumber, quote, description, fixType }
 * @param {object}   params.project      Project record
 * @param {Function} [params.onProgress] Progress callback
 * @param {boolean}  [params.allowLLM=true]  Whether to allow LLM calls
 * @param {Function} [params._llmOverride]   Test injection for LLM
 * @param {Function} [params._saveOverride]  Test injection for save (replaces prepareChapterContent + Chapter.update)
 * @returns {Promise<{ results: Array, chapterSaves: Array }>}
 */
export async function applySurgicalFixes({ loaded, issues, project, onProgress, allowLLM = true, _llmOverride, _saveOverride }) {
  const results = [];
  const chapterSaves = [];

  // Group issues by chapter number
  const byChapter = {};
  for (const issue of issues) {
    const cn = issue.chapterNumber;
    if (!byChapter[cn]) byChapter[cn] = [];
    byChapter[cn].push(issue);
  }

  // Process each chapter
  for (const chapterNum of Object.keys(byChapter).map(Number).sort((a, b) => a - b)) {
    const chapterIssues = byChapter[chapterNum];
    const entry = loaded.find(e => (e.chapter?.chapter_number ?? e.chapter?.chapterNumber) === chapterNum);

    if (!entry) {
      for (const issue of chapterIssues) {
        results.push({ id: `${chapterNum}-${results.length}`, status: 'stale', detail: 'Chapter not found in loaded' });
      }
      continue;
    }

    const preFixWords = countWords(entry.content);
    let currentContent = entry.content;
    let chapterReverted = false;

    // Apply fixes sequentially within this chapter
    for (const issue of chapterIssues) {
      const issueId = `ch${chapterNum}-${results.length}`;

      if (issue.fixType === 'prose' && allowLLM) {
        const fixResult = await applyProseFix(currentContent, issue, _llmOverride);
        results.push({ id: issueId, ...fixResult, chapterNumber: chapterNum });

        if (fixResult.status === 'applied') {
          currentContent = fixResult.chapterText;
        }
      } else if (issue.fixType === 'deterministic') {
        // Deterministic fixes would route through existing engines
        // (reduceAISlopDeterministic, recastBannedVocabulary, healLegacyArtifacts)
        // For now, mark as requiring implementation
        results.push({ id: issueId, status: 'skipped', detail: 'Deterministic fix routing not yet wired', chapterNumber: chapterNum });
      } else {
        results.push({ id: issueId, status: 'skipped', detail: `Fix type "${issue.fixType}" requires manual intervention`, chapterNumber: chapterNum });
      }
    }

    // Content-loss guard: finalWords >= 85% of preFixWords
    const finalWords = countWords(currentContent);
    if (preFixWords > 0 && finalWords < preFixWords * 0.85) {
      // Revert entire chapter
      currentContent = entry.content;
      chapterReverted = true;
      // Mark all applied fixes for this chapter as reverted
      for (const r of results) {
        if (r.chapterNumber === chapterNum && r.status === 'applied') {
          r.status = 'reverted';
          r.detail = `Content-loss guard: ${finalWords} words < 85% of ${preFixWords}`;
        }
      }
    }

    // Save if content changed and not reverted
    if (currentContent !== entry.content && !chapterReverted) {
      const stamp = `[CRITIC-FIX ${new Date().toISOString()} issues=${chapterIssues.length}]`;

      if (_saveOverride) {
        const saveResult = await _saveOverride(chapterNum, currentContent, stamp);
        chapterSaves.push({ chapterNumber: chapterNum, ...saveResult });
      } else {
        // ── PRODUCTION SAVE PATH ─────────────────────────────────────
        // Replicates the exact sequence from ProjectStudio polish save loop:
        // prepareChapterContent → Chapter.update → read-back verification.
        try {
          const chapter = entry.chapter;
          const projectId = project?.id || '';

          // 1. Prepare content (handles large-content GitHub upload)
          let contentFields;
          let uploadAttempts = 0;
          const MAX_UPLOAD_ATTEMPTS = 3;
          while (true) {
            uploadAttempts++;
            try {
              contentFields = await prepareChapterContent(currentContent, projectId, chapter.id, chapter);
              break;
            } catch (upErr) {
              console.warn('[CRITIC-FIX] Ch.' + chapterNum + ' upload attempt ' + uploadAttempts + ' failed:', upErr.message);
              if (uploadAttempts >= MAX_UPLOAD_ATTEMPTS) throw upErr;
              await new Promise(r => setTimeout(r, 1000 * uploadAttempts));
            }
          }

          // 2. Build revision_notes with stamp (same pattern as polish)
          const revisionNotes = [chapter.revision_notes || '', stamp]
            .filter(Boolean)
            .join('\n')
            .slice(-8000);

          // 3. Clear stale content fields (same list as polish save loop)
          const staleClear = {};
          for (const staleField of [
            'content', 'draft', 'body', 'prose', 'finalText', 'cleanedText',
            'chapter_text', 'markdown', 'content_html', 'content_html_url',
            'content_delta', 'content_delta_url', '__polishedContent',
            '__polishSavedContent', '__polishExportContent',
          ]) { staleClear[staleField] = ''; }

          // 4. Build save payload and persist
          const savePayload = {
            ...staleClear,
            ...contentFields,
            word_count: finalWords,
            revision_notes: revisionNotes,
          };

          await runWithNetworkRetry(() => base44.entities.Chapter.update(chapter.id, savePayload));

          // 5. Update in-memory chapter record so immediate export uses fresh content
          entry.chapter = { ...chapter, ...savePayload };

          // 6. Read-back verification: confirm DB has our content
          let verifyPassed = false;
          try {
            const verifyRecord = (await base44.entities.Chapter.filter({ id: chapter.id }))?.[0];
            if (verifyRecord) {
              const verifyContent = await resolveChapterContent(verifyRecord);
              const verifyLen = verifyContent?.length || 0;
              const expectedLen = currentContent.length;
              const diffPct = Math.abs(verifyLen - expectedLen) / Math.max(expectedLen, 1);
              if (diffPct > 0.05) {
                console.warn('[CRITIC-FIX-VERIFY] Ch.' + chapterNum + ' SAVE MISMATCH: expected ' + expectedLen + ' chars, got ' + verifyLen);
              } else {
                verifyPassed = true;
                console.log('[CRITIC-FIX-VERIFY] Ch.' + chapterNum + ' verified OK (' + verifyLen + ' chars)');
              }
            }
          } catch (verifyErr) {
            console.warn('[CRITIC-FIX-VERIFY] Ch.' + chapterNum + ' verify failed:', verifyErr.message);
          }

          if (verifyPassed) {
            chapterSaves.push({ chapterNumber: chapterNum, status: 'saved', words: finalWords, stamp });
          } else {
            chapterSaves.push({ chapterNumber: chapterNum, status: 'save-failed', words: finalWords, stamp, detail: 'Read-back verification failed' });
          }
        } catch (saveErr) {
          console.error('[CRITIC-FIX] Ch.' + chapterNum + ' SAVE THREW:', saveErr.message);
          chapterSaves.push({ chapterNumber: chapterNum, status: 'save-failed', words: finalWords, stamp, detail: saveErr.message });
        }
      }

      // Update the in-memory entry
      entry.content = currentContent;

      // 800ms delay between chapter saves
      onProgress?.(`Saved Ch.${chapterNum} fixes…`);
      await new Promise(r => setTimeout(r, 800));
    }
  }

  return { results, chapterSaves };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TEST EXPORTS
 * ═════════════════════════════════════════════════════════════════════════ */

export {
  findContainingParagraph,
  spliceParagraph,
  normalizeForMatch,
  countWords,
};

console.log('[SURGICAL-FIX] v2 loaded — real save path active');
