// =============================================================
// safeChapterResave.js — Safe stale-chapter re-save utility
//
// Repairs chapters whose URL content is valid but whose metadata
// (word count, char count, preview start/end) is stale, causing
// the resolver to incorrectly flag the URL content as outdated.
//
// This is a STORAGE REPAIR, not a prose rewrite.
//
// Usage:
//   import { safeResaveChapterFromUrl } from '@/lib/safeChapterResave';
//
//   const result = await safeResaveChapterFromUrl(chapter, {
//     projectId: project.id,
//     projectType: 'fiction',
//     saveFn: (id, payload) => base44.entities.Chapter.update(id, payload),
//     fetchFn: async (url) => { /* fetch URL content */ },
//   });
//
//   if (result.ok) {
//     // Chapter metadata repaired + transient content set
//   }
// =============================================================

import { runManuscriptSafetyGate } from './manuscriptSafetyGate.js';
import { prepareChapterContent } from './chapterStorage.js';

const VERSION = 'safeChapterResave-v1';

console.log(`[SAFE-CHAPTER-RESAVE] ${VERSION} loaded: metadata repair for stale URL chapters`);

/**
 * All content fields that could contain stale/contaminated text.
 * Cleared during re-save to prevent stale content from being resolved.
 */
function buildStaleFieldClearPayload() {
  return {
    content_html: '',
    content_html_url: '',
    content_delta: '',
    content_delta_url: '',
    content_format: 'markdown_v1',
    content_md_fallback_present: false,
    content: '',
    draft: '',
    body: '',
    prose: '',
    finalText: '',
    cleanedText: '',
    chapter_text: '',
    markdown: '',
    __polishedContent: '',
    __polishSavedContent: '',
    __polishExportContent: '',
    content_md_upload_failed: false,
    content_md_preview_only: false,
    content_md_preserved_existing_url: false,
  };
}

function normalizeText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function countWords(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

/**
 * Re-save a chapter whose URL content is valid but metadata is stale.
 *
 * This fetches the URL content, validates it, and re-saves with
 * updated metadata so the staleness checker passes on next resolve.
 *
 * @param {object} chapter - The chapter entity
 * @param {object} options
 * @param {string} options.projectId - Project ID
 * @param {string} options.projectType - 'fiction' or 'nonfiction'
 * @param {Function} options.saveFn - async (id, payload) => void
 * @param {string} [options.resolvedContent] - If already fetched, pass the resolved text
 * @returns {Promise<object>} Result with ok, gate, metadata, etc.
 */
export async function safeResaveChapterFromUrl(chapter, options = {}) {
  const {
    projectId,
    projectType = 'fiction',
    saveFn,
    resolvedContent,
  } = options;

  const chapterNum = chapter?.chapter_number || '?';
  const chapterTitle = chapter?.title || '';
  const chapterId = chapter?.id;

  console.log(`[SAFE-RESAVE] Ch.${chapterNum} "${chapterTitle}" — starting stale metadata repair`);

  if (!chapterId) {
    return { ok: false, reason: 'No chapter ID', gate: null };
  }

  if (!saveFn || typeof saveFn !== 'function') {
    return { ok: false, reason: 'No save function provided', gate: null };
  }

  // ── STEP 1: Obtain current content ──
  let currentText = '';

  if (resolvedContent && normalizeText(resolvedContent).length > 100) {
    currentText = normalizeText(resolvedContent);
    console.log(`[SAFE-RESAVE] Ch.${chapterNum} — using provided resolved content (${currentText.length} chars)`);
  } else {
    // Try to get content from the chapter object directly
    const candidates = [
      chapter.__safeReplacedContent,
      chapter.__polishedContent,
      chapter.__polishSavedContent,
      chapter.content_md,
      chapter.content,
      chapter.draft,
      chapter.body,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeText(candidate);
      if (normalized.length > 100) {
        currentText = normalized;
        break;
      }
    }

    if (!currentText) {
      console.error(`[SAFE-RESAVE] Ch.${chapterNum} — no usable content found`);
      return { ok: false, reason: 'No usable content found on chapter object', gate: null };
    }

    console.log(`[SAFE-RESAVE] Ch.${chapterNum} — obtained content from chapter fields (${currentText.length} chars)`);
  }

  // ── STEP 2: Run safety gate ──
  console.log(`[SAFE-RESAVE] Ch.${chapterNum} — running safety gate`);

  const gate = runManuscriptSafetyGate(currentText, {
    project: { project_type: projectType },
    chapter,
    stage: 'safe-resave',
  });

  console.log(
    `[SAFE-RESAVE] Ch.${chapterNum} gate: ok=${gate.ok} action=${gate.recommendedAction} ` +
    `processLeaks=${gate.processLeaks.matches.length} contamination=${gate.contamination.matches.length} ` +
    `malformed=${gate.malformed.matches.length}`
  );

  if (!gate.ok && (gate.recommendedAction === 'REJECT_REGENERATE' || gate.recommendedAction === 'REJECT_MANUAL_REVIEW')) {
    console.error(`[SAFE-RESAVE] Ch.${chapterNum} REJECTED — content fails safety gate`);
    return {
      ok: false,
      reason: `Content fails safety gate: ${gate.reasons.join('; ')}`,
      gate: {
        ok: gate.ok,
        action: gate.recommendedAction,
        processLeaks: gate.processLeaks.matches.length,
        contamination: gate.contamination.matches.length,
        malformed: gate.malformed.matches.length,
        reasons: gate.reasons,
      },
    };
  }

  // ── STEP 3: Prepare content fields ──
  console.log(`[SAFE-RESAVE] Ch.${chapterNum} — preparing content fields`);

  const contentFields = await prepareChapterContent(
    currentText,
    projectId,
    chapterId,
    chapter
  );

  // ── STEP 4: Build save payload with refreshed metadata ──
  const staleClear = buildStaleFieldClearPayload();
  const wordCount = countWords(currentText);
  const charCount = currentText.length;

  const payload = {
    ...staleClear,
    ...contentFields,

    // Refresh metadata to match actual content
    word_count: wordCount,
    polish_saved_word_count: wordCount,
    polish_saved_char_count: charCount,
    polish_saved_preview_start: currentText.substring(0, 420),
    polish_saved_preview_end: currentText.slice(-420),
    content_md_word_count: wordCount,
    content_md_char_count: charCount,

    // Clear stale markers
    content_md_upload_failed: false,
    content_md_preview_only: false,
    content_md_preserved_existing_url: false,

    // Metadata about the resave
    safe_resave_version: VERSION,
    safe_resave_at: new Date().toISOString(),
    safe_resave_reason: 'stale-metadata-repair',
    revision_notes: `Safe re-save via ${VERSION}: metadata refreshed to match current URL content. Previous metadata was stale.`,
  };

  // ── STEP 5: Save ──
  console.log(`[SAFE-RESAVE] Ch.${chapterNum} — saving repaired metadata to database`);

  try {
    await saveFn(chapterId, payload);
    console.log(`[SAFE-RESAVE] Ch.${chapterNum} — ✅ saved successfully`);
  } catch (err) {
    console.error(`[SAFE-RESAVE] Ch.${chapterNum} — save failed:`, err?.message || err);
    return {
      ok: false,
      reason: `Save failed: ${err?.message || 'unknown error'}`,
      gate: { ok: gate.ok, action: gate.recommendedAction },
    };
  }

  // ── STEP 6: Set transient content on chapter object ──
  if (chapter && typeof chapter === 'object') {
    chapter.__safeReplacedContent = currentText;
    chapter.__staleContentResolution = false;
    chapter.__staleContentWarning = '';
    chapter.content_md = currentText;
    console.log(`[SAFE-RESAVE] Ch.${chapterNum} — set transient content (${currentText.length} chars)`);
  }

  // ── STEP 7: Return result ──
  const result = {
    ok: true,
    chapterId,
    chapterNumber: chapterNum,
    title: chapterTitle,
    wordCount,
    charCount,
    contentInline: !!contentFields.content_md,
    contentUrl: contentFields.content_md_url || '',
    gate: {
      ok: gate.ok,
      action: gate.recommendedAction,
      processLeaks: gate.processLeaks.matches.length,
      contamination: gate.contamination.matches.length,
      malformed: gate.malformed.matches.length,
    },
    metadataRefreshed: true,
    version: VERSION,
    timestamp: new Date().toISOString(),
  };

  console.log(`[SAFE-RESAVE] Ch.${chapterNum} — re-save complete:`, result);

  if (typeof window !== 'undefined') {
    window.__UBS_LAST_SAFE_RESAVE = result;
    window.__UBS_SAFE_RESAVE_CONTENT = window.__UBS_SAFE_RESAVE_CONTENT || {};
    window.__UBS_SAFE_RESAVE_CONTENT[chapterNum] = currentText;
  }

  return result;
}

/**
 * Verify that a re-saved chapter resolves correctly.
 */
export function verifySafeResave(resolvedContent, chapter, options = {}) {
  const { projectType = 'fiction' } = options;
  const chapterNum = chapter?.chapter_number || '?';

  if (!resolvedContent || resolvedContent.trim().length < 100) {
    return { ok: false, reason: 'Resolved content is empty or too short' };
  }

  const gate = runManuscriptSafetyGate(resolvedContent, {
    project: { project_type: projectType },
    chapter,
    stage: 'post-resave-verify',
  });

  // Check metadata alignment
  const normalized = normalizeText(resolvedContent);
  const actualWords = countWords(normalized);
  const actualChars = normalized.length;
  const expectedWords = Number(chapter.polish_saved_word_count || 0);
  const expectedChars = Number(chapter.polish_saved_char_count || 0);

  let metadataAligned = true;
  if (expectedChars > 0) {
    const ratio = Math.abs(actualChars - expectedChars) / expectedChars;
    if (ratio > 0.03) metadataAligned = false;
  }
  if (expectedWords > 0) {
    const ratio = Math.abs(actualWords - expectedWords) / expectedWords;
    if (ratio > 0.03) metadataAligned = false;
  }

  return {
    ok: gate.ok && metadataAligned,
    gateOk: gate.ok,
    metadataAligned,
    action: gate.recommendedAction,
    processLeaks: gate.processLeaks.matches.length,
    contamination: gate.contamination.matches.length,
    malformed: gate.malformed.matches.length,
    actualWords,
    actualChars,
    expectedWords,
    expectedChars,
  };
}

export function getStaleFieldList() {
  return Object.keys(buildStaleFieldClearPayload());
}
