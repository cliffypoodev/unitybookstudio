// =============================================================
// safeChapterReplace.js — Safe rejected-chapter replacement
//
// Provides a safe mechanism for replacing hard-failed chapter
// content. Runs the safety gate on the replacement text, clears
// all stale content fields, saves through the canonical path,
// and verifies the save via read-back.
//
// This module is used by the UI to repair rejected chapters
// without a full manuscript rewrite.
//
// Usage (in ProjectStudio.jsx or any component with base44 access):
//   import { safeReplaceChapterContent, verifySafeReplacement } from '@/lib/safeChapterReplace';
//
//   const result = await safeReplaceChapterContent(chapter, repairedText, {
//     projectId: project.id,
//     projectType: project.project_type || 'fiction',
//     saveFn: (id, payload) => base44.entities.Chapter.update(id, payload),
//   });
//
//   if (result.ok) {
//     // Chapter saved with clean content
//     // Invalidate queries, refresh UI
//   } else {
//     // result.reason explains why replacement was rejected
//   }
// =============================================================

import { runManuscriptSafetyGate } from './manuscriptSafetyGate.js';
import { prepareChapterContent } from './chapterStorage.js';

const VERSION = 'safeChapterReplace-v1';

console.log(`[SAFE-CHAPTER-REPLACE] ${VERSION} loaded: safety-gated chapter replacement with stale field clearing`);

/**
 * All content fields that could contain stale/contaminated text.
 * These are cleared during safe replacement to prevent stale content
 * from being resolved by the export path.
 */
function buildStaleFieldClearPayload() {
  return {
    // Primary content fields — will be overwritten by prepareChapterContent
    // content_md: '',        // set by prepareChapterContent
    // content_md_url: '',    // set by prepareChapterContent

    // Rich content fields (HTML/Delta editor state)
    content_html: '',
    content_html_url: '',
    content_delta: '',
    content_delta_url: '',
    content_format: 'markdown_v1',
    content_md_fallback_present: false,

    // Legacy/transient fields that could contain stale text
    content: '',
    draft: '',
    body: '',
    prose: '',
    finalText: '',
    cleanedText: '',
    chapter_text: '',
    markdown: '',

    // Polished content transient markers
    // (these are in-memory only, but clear them on the DB record too)
    __polishedContent: '',
    __polishSavedContent: '',
    __polishExportContent: '',

    // Upload failure markers
    content_md_upload_failed: false,
    content_md_preview_only: false,
    content_md_preserved_existing_url: false,
  };
}

/**
 * Safely replace the content of a rejected chapter.
 *
 * Workflow:
 * 1. Run safety gate on replacement text
 * 2. If gate fails, abort — do not save contaminated replacement
 * 3. If gate passes:
 *    a. Prepare content via prepareChapterContent (handles inline vs URL upload)
 *    b. Clear ALL stale content fields
 *    c. Save through the provided save function
 *    d. Return structured result with gate details
 *
 * @param {object} chapter - The chapter entity to replace
 * @param {string} repairedText - The replacement text
 * @param {object} options
 * @param {string} options.projectId - Project ID for upload filename
 * @param {string} options.projectType - 'fiction' or 'nonfiction'
 * @param {Function} options.saveFn - async (id, payload) => void — saves to DB
 * @param {string} [options.stage] - Safety gate stage label (default: 'manual-replacement')
 * @returns {Promise<object>} Result with ok, gate, savedPayload, etc.
 */
export async function safeReplaceChapterContent(chapter, repairedText, options = {}) {
  const {
    projectId,
    projectType = 'fiction',
    saveFn,
    stage = 'manual-replacement',
  } = options;

  const chapterNum = chapter?.chapter_number || '?';
  const chapterTitle = chapter?.title || '';
  const chapterId = chapter?.id;

  console.log(`[SAFE-REPLACE] Ch.${chapterNum} "${chapterTitle}" — starting safe replacement (${repairedText.length} chars)`);

  if (!chapterId) {
    console.error('[SAFE-REPLACE] No chapter ID provided');
    return { ok: false, reason: 'No chapter ID', gate: null };
  }

  if (!repairedText || repairedText.trim().length < 100) {
    console.error('[SAFE-REPLACE] Replacement text is too short or empty');
    return { ok: false, reason: 'Replacement text too short (< 100 chars)', gate: null };
  }

  if (!saveFn || typeof saveFn !== 'function') {
    console.error('[SAFE-REPLACE] No save function provided');
    return { ok: false, reason: 'No save function provided', gate: null };
  }

  // ── STEP 1: Run safety gate on replacement text ──
  console.log(`[SAFE-REPLACE] Ch.${chapterNum} — running safety gate on replacement text`);

  const gate = runManuscriptSafetyGate(repairedText, {
    project: { project_type: projectType },
    chapter,
    stage,
  });

  console.log(
    `[SAFE-REPLACE] Ch.${chapterNum} gate result: ok=${gate.ok} action=${gate.recommendedAction} ` +
    `processLeaks=${gate.processLeaks.matches.length} contamination=${gate.contamination.matches.length} ` +
    `malformed=${gate.malformed.matches.length}`
  );

  if (!gate.ok) {
    console.error(`[SAFE-REPLACE] Ch.${chapterNum} REJECTED — replacement text failed safety gate`);
    console.error(`[SAFE-REPLACE] Reasons: ${gate.reasons.join('; ')}`);

    return {
      ok: false,
      reason: `Replacement text failed safety gate: ${gate.reasons.join('; ')}`,
      gate: {
        ok: gate.ok,
        action: gate.recommendedAction,
        processLeaks: gate.processLeaks.matches.length,
        contamination: gate.contamination.matches.length,
        malformed: gate.malformed.matches.length,
        reasons: gate.reasons,
        snippets: [
          ...gate.processLeaks.matches.slice(0, 3).map(m => ({ type: 'process-leak', phrase: m.phrase })),
          ...gate.contamination.matches.slice(0, 3).map(m => ({ type: 'contamination', phrase: m.phrase })),
          ...gate.malformed.matches.slice(0, 2).map(m => ({ type: 'malformed', phrase: m.phrase })),
        ],
      },
    };
  }

  // ── STEP 2: Prepare content fields (handles inline vs URL upload) ──
  console.log(`[SAFE-REPLACE] Ch.${chapterNum} — preparing content fields`);

  const contentFields = await prepareChapterContent(
    repairedText,
    projectId,
    chapterId,
    chapter
  );

  console.log(`[SAFE-REPLACE] Ch.${chapterNum} — content prepared:`, {
    inlineChars: (contentFields.content_md || '').length,
    hasUrl: !!contentFields.content_md_url,
    uploadFailed: contentFields.content_md_upload_failed || false,
    wordCount: contentFields.content_md_word_count,
  });

  // ── STEP 3: Build the full replacement payload ──
  const staleClear = buildStaleFieldClearPayload();

  const wordCount = repairedText.trim().split(/\s+/).filter(Boolean).length;

  const payload = {
    // Clear all stale fields first
    ...staleClear,

    // Then set the new content (overwrites content_md/content_md_url from staleClear)
    ...contentFields,

    // Update metadata
    word_count: wordCount,
    status: 'drafted',
    content_md_fallback_present: true,

    // Clear polish-saved metadata that references old content
    polish_saved_word_count: wordCount,
    polish_saved_char_count: repairedText.length,
    polish_saved_preview_start: repairedText.trim().substring(0, 200),
    polish_saved_preview_end: repairedText.trim().slice(-200),

    // Metadata about the replacement
    safe_replacement_version: VERSION,
    safe_replacement_at: new Date().toISOString(),
    safe_replacement_gate_ok: true,
    revision_notes: `Safe replacement via ${VERSION}: chapter content replaced after safety gate verification. Previous content was contaminated.`,
  };

  // ── STEP 4: Save ──
  console.log(`[SAFE-REPLACE] Ch.${chapterNum} — saving replacement to database`);

  try {
    await saveFn(chapterId, payload);
    console.log(`[SAFE-REPLACE] Ch.${chapterNum} — ✅ saved successfully`);
  } catch (err) {
    console.error(`[SAFE-REPLACE] Ch.${chapterNum} — save failed:`, err?.message || err);
    return {
      ok: false,
      reason: `Save failed: ${err?.message || 'unknown error'}`,
      gate: { ok: true, action: gate.recommendedAction },
    };
  }

  // ── STEP 4b: Set transient content on chapter object ──
  // This ensures resolveChapterContent() uses the clean replacement text
  // even if the URL upload is stale or the proxy fetch fails.
  // The resolver checks __safeReplacedContent as priority #1.
  if (chapter && typeof chapter === 'object') {
    chapter.__safeReplacedContent = repairedText;
    // Clear any stale-resolution flags from prior resolves
    chapter.__staleContentResolution = false;
    chapter.__staleContentWarning = '';
    // Also set content_md for immediate in-session use (may exceed DB limit
    // but the in-memory object can hold it)
    chapter.content_md = repairedText;
    console.log(`[SAFE-REPLACE] Ch.${chapterNum} — set __safeReplacedContent on chapter object (${repairedText.length} chars)`);
  }

  // ── STEP 5: Return structured result ──
  const result = {
    ok: true,
    chapterId,
    chapterNumber: chapterNum,
    title: chapterTitle,
    wordCount,
    charCount: repairedText.length,
    contentInline: !!contentFields.content_md,
    contentUrl: contentFields.content_md_url || '',
    gate: {
      ok: gate.ok,
      action: gate.recommendedAction,
      processLeaks: gate.processLeaks.matches.length,
      contamination: gate.contamination.matches.length,
      malformed: gate.malformed.matches.length,
    },
    staledFieldsCleared: Object.keys(staleClear),
    version: VERSION,
    timestamp: new Date().toISOString(),
  };

  console.log(`[SAFE-REPLACE] Ch.${chapterNum} — replacement complete:`, result);

  // Store result globally for inspection
  if (typeof window !== 'undefined') {
    window.__UBS_LAST_SAFE_REPLACE = result;
    // Also store the clean text globally for manual verification
    window.__UBS_SAFE_REPLACE_CONTENT = { [chapterNum]: repairedText };
    console.log('[SAFE-REPLACE] Result stored at window.__UBS_LAST_SAFE_REPLACE');
  }

  return result;
}

/**
 * Verify that a safe replacement took effect by running the safety gate
 * on the resolved content.
 *
 * This is a read-back check: after save, resolve the chapter content
 * from whatever source the export path would use, and verify it passes.
 *
 * @param {string} resolvedContent - The content as resolved by resolveChapterContent()
 * @param {object} chapter - The chapter entity
 * @param {object} options - { projectType }
 * @returns {object} Verification result
 */
export function verifySafeReplacement(resolvedContent, chapter, options = {}) {
  const { projectType = 'fiction' } = options;
  const chapterNum = chapter?.chapter_number || '?';

  console.log(`[SAFE-REPLACE-VERIFY] Ch.${chapterNum} — verifying resolved content (${(resolvedContent || '').length} chars)`);

  if (!resolvedContent || resolvedContent.trim().length < 100) {
    return {
      ok: false,
      reason: 'Resolved content is empty or too short',
      gate: null,
    };
  }

  const gate = runManuscriptSafetyGate(resolvedContent, {
    project: { project_type: projectType },
    chapter,
    stage: 'post-replacement-verify',
  });

  const result = {
    ok: gate.ok,
    action: gate.recommendedAction,
    processLeaks: gate.processLeaks.matches.length,
    contamination: gate.contamination.matches.length,
    malformed: gate.malformed.matches.length,
    resolvedLength: resolvedContent.length,
    resolvedWords: resolvedContent.trim().split(/\s+/).filter(Boolean).length,
  };

  if (gate.ok) {
    console.log(`[SAFE-REPLACE-VERIFY] Ch.${chapterNum} — ✅ resolved content passes safety gate`);
  } else {
    console.error(`[SAFE-REPLACE-VERIFY] Ch.${chapterNum} — ❌ resolved content STILL FAILS safety gate`);
    console.error(`[SAFE-REPLACE-VERIFY] Reasons: ${gate.reasons.join('; ')}`);
    result.reasons = gate.reasons;
  }

  return result;
}

/**
 * List of all stale content fields that get cleared during safe replacement.
 * Useful for diagnostics and reports.
 */
export function getStaleFieldList() {
  return Object.keys(buildStaleFieldClearPayload());
}
