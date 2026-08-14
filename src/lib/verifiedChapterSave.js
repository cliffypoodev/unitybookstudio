/**
 * verifiedChapterSave.js
 *
 * Verify-and-retry wrapper around Chapter.update for draft saves.
 * After writing, reads the chapter back via resolveChapterContent and
 * confirms the persisted content length is within 5 % of what was written.
 * On mismatch or throw, retries up to 3 times with exponential backoff
 * (250 ms → 750 ms → 1500 ms).
 *
 * Mirrors the exact verification pattern in surgicalFix.js's production
 * save path (lines 320-338).
 *
 * @module verifiedChapterSave
 */

import { base44 } from '@/api/base44Client.js';
import { resolveChapterContent, prepareChapterContent } from '@/lib/chapterStorage.js';
import { runWithNetworkRetry } from '@/lib/requestRetry.js';
import { refreshProjectWordCount } from '@/lib/projectWordCount.js';

const RETRY_DELAYS = [250, 750, 1500];
// DRAFTSAVE-1: was 5 % — loose enough that a chapter pointing at its PRE-SAVE
// blob (26,456 written vs 23,674 read back = 10.5 %) was only three retries
// from passing, and length alone can never catch wrong-content-of-similar-size.
// 2 % length window PLUS head/tail anchors (below).
const TOLERANCE = 0.02; // 2 %

// The persisted text must actually BE the written text, not merely a similar
// length: the first and last 80 characters must survive the round trip.
// (Normalization may touch interior whitespace; the anchors are trimmed.)
function contentAnchorsMatch(written, readBack) {
  const w = String(written || '').trim();
  const r = String(readBack || '').trim();
  if (w.length < 200) return r.includes(w.slice(0, Math.min(40, w.length)));
  return r.startsWith(w.slice(0, 80)) && r.endsWith(w.slice(-80));
}

/**
 * Save a chapter with read-back verification and automatic retry.
 *
 * @param {object}  params
 * @param {string}  params.chapterId       The chapter entity id
 * @param {object}  params.savePayload     Fields to pass to Chapter.update
 * @param {string}  params.writtenContent  The content string we expect to persist
 * @param {number}  [params.chapterNumber] For logging only
 * @returns {Promise<{ ok: boolean, attempts: number, reason?: string }>}
 */
export async function verifiedChapterSave({ chapterId, savePayload, writtenContent, chapterNumber }) {
  const cn = chapterNumber ?? '?';
  const expectedLen = writtenContent?.length || 0;
  let payload = savePayload;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      // DRAFTSAVE-1: a retry that re-sends the SAME payload cannot heal a
      // failed content upload — the payload's content fields already point at
      // the stale blob. From attempt 2 on, re-prepare the content (fresh
      // upload) so the retry actually retries the thing that failed.
      if (attempt > 0 && writtenContent && payload) {
        try {
          const existing = (await base44.entities.Chapter.filter({ id: chapterId }))?.[0] || null;
          const freshFields = await prepareChapterContent(writtenContent, existing?.project_id, chapterId, existing);
          payload = { ...payload, ...freshFields };
          console.warn(`[VERIFIED-SAVE] Ch.${cn}: attempt ${attempt + 1} re-prepared content fields (fresh upload).`);
        } catch (prepErr) {
          console.warn(`[VERIFIED-SAVE] Ch.${cn}: re-prepare failed (${prepErr?.message}); retrying with previous payload.`);
        }
      }

      // ── 1. Write ──────────────────────────────────────────────────────
      await runWithNetworkRetry(() => base44.entities.Chapter.update(chapterId, payload));

      // ── 2. Read-back verify ───────────────────────────────────────────
      const verifyRecord = (await base44.entities.Chapter.filter({ id: chapterId }))?.[0];
      if (!verifyRecord) {
        const reason = `Ch.${cn}: record not found after save (attempt ${attempt + 1})`;
        console.warn('[VERIFIED-SAVE]', reason);
        if (attempt < RETRY_DELAYS.length) {
          await delay(RETRY_DELAYS[attempt]);
          continue;
        }
        return { ok: false, attempts: attempt + 1, reason };
      }

      const verifyContent = await resolveChapterContent(verifyRecord);
      const verifyLen = verifyContent?.length || 0;
      const diffPct = Math.abs(verifyLen - expectedLen) / Math.max(expectedLen, 1);
      const anchorsOk = contentAnchorsMatch(writtenContent, verifyContent);

      if (diffPct > TOLERANCE || !anchorsOk) {
        const reason = `Ch.${cn}: save mismatch — expected ${expectedLen} chars, got ${verifyLen} (diff ${(diffPct * 100).toFixed(1)}%, anchors ${anchorsOk ? 'ok' : 'FAILED'}, attempt ${attempt + 1})`;
        console.error('[VERIFIED-SAVE]', reason);
        if (attempt < RETRY_DELAYS.length) {
          await delay(RETRY_DELAYS[attempt]);
          continue;
        }
        return { ok: false, attempts: attempt + 1, reason };
      }

      // ── 3. Success ────────────────────────────────────────────────────
      if (attempt > 0) {
        console.log(`[VERIFIED-SAVE] Ch.${cn} verified OK after ${attempt + 1} attempt(s) (${verifyLen} chars)`);
      }
      // WAVE2-WORDCOUNT: every verified draft save rolls the project word
      // count up. Fire-and-forget — the helper is non-fatal by design.
      if (verifyRecord.project_id) refreshProjectWordCount(verifyRecord.project_id);
      return { ok: true, attempts: attempt + 1 };

    } catch (err) {
      const reason = `Ch.${cn}: save threw — ${err?.message || err} (attempt ${attempt + 1})`;
      console.warn('[VERIFIED-SAVE]', reason);
      if (attempt < RETRY_DELAYS.length) {
        await delay(RETRY_DELAYS[attempt]);
        continue;
      }
      return { ok: false, attempts: attempt + 1, reason };
    }
  }

  // Should not reach here, but just in case
  return { ok: false, attempts: RETRY_DELAYS.length + 1, reason: 'exhausted retries' };
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

console.log('[VERIFIED-CHAPTER-SAVE] v1 loaded — verify+retry active');
