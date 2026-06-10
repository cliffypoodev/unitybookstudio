/**
 * Auto-Proofread Chain
 *
 * Shared helper that runs the AI Proofreader, auto-accepts safe-category
 * findings (critical + minor), and saves them back to the DB. Designed to
 * be called at the end of ANY Polish pipeline so Polish → AI Proofread →
 * Save runs as a single click regardless of which Polish button the user
 * pressed (dashboard, review queue, or Tools tab).
 *
 * Why separate from Polish:
 *   - Polish is deterministic regex/string work (no LLM)
 *   - Proofread is LLM-backed and stateful (has findings to accept/save)
 *   - They run cleanly sequentially: Polish saves to DB → Proofread reads
 *     fresh from DB, rewrites safe issues, saves again.
 *
 * Category policy:
 *   - 'critical'  → auto-accepted  (continuity/factual errors: high confidence)
 *   - 'minor'     → auto-accepted  (spelling, grammar, punctuation)
 *   - 'prose'     → skipped         (stylistic taste — human judgment needed)
 *   - 'structure' → skipped         (composition — human judgment needed)
 *
 * Returns a summary the caller can fold into its toast output. Toast is
 * NOT shown by this helper — that's the caller's responsibility so Polish's
 * own summary and Auto-Proofread's summary can be presented together.
 */

import { base44 } from '@/api/base44Client';
import { resolveChapterContent, chapterHasContent, prepareChapterContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { countWords } from '@/lib/autonovel';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import { runProofreader, acceptRewrite, applyAcceptedFindings } from '@/lib/proofreader';
import { runSubjectRestoration, formatSubjectRestorationSummary } from '@/lib/subjectRestoration';

/**
 * @param {Object} project - NovelProject entity (LLM needs for context)
 * @param {Array} chapters - Chapter entities (will be re-fetched fresh from DB)
 * @param {Function} setBusyLabel - Progress reporter (may be no-op)
 * @returns {Promise<{
 *   ran: boolean,                  // true if chain executed; false if no chapters
 *   totalApplied: number,          // patches saved to DB
 *   totalSkipped: number,          // findings that no longer match live text (already fixed by Polish)
 *   chaptersSaved: number,         // chapters with at least one applied patch
 *   chaptersFailed: number,        // chapters that threw during save
 *   reviewCount: number,           // prose/structure findings deferred to human review
 *   totalFindings: number,         // total findings returned by the LLM
 *   error?: string,                // set if proofreader itself failed
 * }>}
 */
export async function runAutoProofreadChain(project, chapters, setBusyLabel) {
  const noop = (label) => typeof setBusyLabel === 'function' && setBusyLabel(label);

  console.warn('[AUTO-PROOFREAD] ========== STARTING CHAIN ==========');

  // ── Phase 1: Load fresh chapters from DB ──
  // Polish just saved new content. We MUST re-fetch to avoid running
  // proofread against stale prop-level snapshots.
  noop('Auto-Proofread: Loading fresh chapters from DB…');
  const bodyChapters = [...chapters]
    .filter((ch) => chapterHasContent(ch) && isBodyChapter(ch))
    .sort((a, b) => a.chapter_number - b.chapter_number);

  const loaded = [];
  for (let i = 0; i < bodyChapters.length; i++) {
    const ch = bodyChapters[i];
    const chNum = ch.chapter_number || i + 1;
    try {
      const freshCh = (await base44.entities.Chapter.filter({ id: ch.id }))?.[0];
      if (!freshCh) continue;
      const content = await resolveChapterContent(freshCh);
      if (content && content.length > 50) {
        loaded.push({ chapter: freshCh, content });
      }
    } catch (err) {
      console.warn('[AUTO-PROOFREAD] Failed to load Ch.' + chNum + ':', err.message);
    }
  }

  if (!loaded.length) {
    console.warn('[AUTO-PROOFREAD] No chapters loaded from DB — skipping proofread phase');
    noop('');
    return {
      ran: false,
      totalApplied: 0,
      totalSkipped: 0,
      chaptersSaved: 0,
      chaptersFailed: 0,
      reviewCount: 0,
      totalFindings: 0,
    };
  }
  console.warn('[AUTO-PROOFREAD] Loaded ' + loaded.length + ' fresh chapters for Proofread');

  // ── Phase 2: Run the AI Proofreader ──
  let findings;
  try {
    findings = await runProofreader(loaded, project, setBusyLabel);
    console.warn('[AUTO-PROOFREAD] Proofreader returned ' + findings.length + ' total findings');
  } catch (err) {
    console.error('[AUTO-PROOFREAD] Proofreader failed:', err.message);
    noop('');
    return {
      ran: true,
      totalApplied: 0,
      totalSkipped: 0,
      chaptersSaved: 0,
      chaptersFailed: loaded.length,
      reviewCount: 0,
      totalFindings: 0,
      error: err.message || 'Unknown error',
    };
  }

  // ── Phase 3: Auto-accept SAFE category findings only ──
  const SAFE_CATEGORIES = new Set(['critical', 'minor']);
  const safeFindings = findings.filter((f) => SAFE_CATEGORIES.has(f.category));
  const reviewFindings = findings.filter((f) => !SAFE_CATEGORIES.has(f.category));
  console.warn(
    '[AUTO-PROOFREAD] Safe (auto-accept): ' + safeFindings.length +
    ' | For human review: ' + reviewFindings.length
  );

  // acceptRewrite verifies original_text exists in scanned_content; returns
  // false if the LLM hallucinated and the snippet can't be located. Those
  // are silently skipped — the chapter stays untouched.
  for (const f of safeFindings) {
    acceptRewrite(f);
  }
  const acceptedFindings = safeFindings.filter((f) => f.status === 'accepted');

  // ── Phase 4: Group accepted findings by chapter, apply against fresh DB text, save ──
  const byChapter = {};
  for (const f of acceptedFindings) {
    const key = f.chapterIndex;
    if (!byChapter[key]) byChapter[key] = [];
    byChapter[key].push(f);
  }

  let totalApplied = 0;
  let totalSkipped = 0;
  let chaptersSaved = 0;
  let chaptersFailed = 0;

  const chapterKeys = Object.keys(byChapter);
  for (let k = 0; k < chapterKeys.length; k++) {
    const key = chapterKeys[k];
    const chFindings = byChapter[key];
    const chId = loaded[key]?.chapter?.id;
    const chNum = loaded[key]?.chapter?.chapter_number || '?';
    if (!chId) {
      chaptersFailed++;
      continue;
    }

    noop('Auto-Proofread: Saving Ch.' + chNum + ' (' + (k + 1) + '/' + chapterKeys.length + ')…');
    try {
      // Re-fetch FRESH before every save — matches ProofreadSubPage._saveChapters
      // pattern; guards against concurrent edits and ensures applyAcceptedFindings
      // patches against live text, not the snapshot from the earlier load.
      const freshRecord = (await base44.entities.Chapter.filter({ id: chId }))?.[0];
      const currentText = await resolveChapterContent(freshRecord);
      if (!currentText || currentText.length < 50) {
        console.warn('[AUTO-PROOFREAD] Ch.' + chNum + ' empty in DB on re-fetch');
        chaptersFailed++;
        continue;
      }

      const result = applyAcceptedFindings(chFindings, currentText);
      if (!result) {
        // Nothing applied — either all patches were already in text (polish
        // did them first) or the text diverged. Either way, not a save error.
        totalSkipped += chFindings.length;
        continue;
      }
      totalApplied += result.applied;
      totalSkipped += result.skipped;

      const contentFields = await prepareChapterContent(result.text);
      await runWithNetworkRetry(() =>
        base44.entities.Chapter.update(chId, {
          ...contentFields,
          word_count: countWords(result.text),
        })
      );
      chaptersSaved++;
      console.warn('[AUTO-PROOFREAD] Saved Ch.' + chNum + ': ' + result.applied + ' patches');
    } catch (err) {
      console.error('[AUTO-PROOFREAD] Save failed Ch.' + chNum + ':', err.message);
      chaptersFailed++;
    }
  }

  noop('');
  console.log(
    '[AUTO-PROOFREAD] COMPLETE: applied=' + totalApplied +
    ' saved=' + chaptersSaved + ' failed=' + chaptersFailed +
    ' review=' + reviewFindings.length + ' totalFindings=' + findings.length
  );

  // ── Phase 5: Subject Restoration ─────────────────────────────────────────
  // Legacy polish damage: subject-stripped transition openers. Runs ONLY if
  // damage is detected; skips cleanly otherwise. Self-healing — once a
  // manuscript's damage is repaired, future polish runs take near-zero time
  // in this phase because the detector finds nothing.
  let restoreResult = { ran: false, totalDetected: 0, totalRepaired: 0, totalUnsafe: 0, chaptersSaved: 0, chaptersFailed: 0 };
  try {
    restoreResult = await runSubjectRestoration(project, chapters, setBusyLabel);
  } catch (err) {
    console.error('[AUTO-PROOFREAD] Subject restoration phase failed:', err.message);
    // Don't surface as fatal — previous phases already saved their work.
  }

  return {
    ran: true,
    totalApplied,
    totalSkipped,
    chaptersSaved: chaptersSaved + (restoreResult.chaptersSaved || 0),
    chaptersFailed: chaptersFailed + (restoreResult.chaptersFailed || 0),
    reviewCount: reviewFindings.length,
    totalFindings: findings.length,
    subjectRestoration: restoreResult,
  };
}

/**
 * Builds a one-line summary suitable for appending to a Polish toast.
 * Caller can concatenate this onto its existing report string.
 */
export function formatAutoProofreadSummary(result) {
  if (!result || !result.ran) return '';
  if (result.error) return '\n⚠️ Auto-Proofread failed: ' + result.error;

  // Main proofread summary
  let summary;
  if (result.totalApplied === 0 && result.reviewCount === 0) {
    summary = '\nAuto-Proofread: no findings (manuscript clean).';
  } else {
    const parts = ['\nAuto-Proofread: ' + result.totalApplied + ' safe fixes saved.'];
    if (result.reviewCount > 0) {
      parts.push(' ' + result.reviewCount + ' prose/structure findings — review in Proofread tab.');
    }
    summary = parts.join('');
  }

  // Append subject-restoration summary if that phase ran
  summary += formatSubjectRestorationSummary(result.subjectRestoration);

  return summary;
}