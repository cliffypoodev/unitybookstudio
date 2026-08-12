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
import { resolveChapterContent } from '@/lib/chapterStorage.js';
import { runWithNetworkRetry } from '@/lib/requestRetry.js';
import { refreshProjectWordCount } from '@/lib/projectWordCount.js';

const RETRY_DELAYS = [250, 750, 1500];
const TOLERANCE = 0.05; // 5 %

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

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      // ── 1. Write ──────────────────────────────────────────────────────
      await runWithNetworkRetry(() => base44.entities.Chapter.update(chapterId, savePayload));

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

      if (diffPct > TOLERANCE) {
        const reason = `Ch.${cn}: save mismatch — expected ${expectedLen} chars, got ${verifyLen} (diff ${(diffPct * 100).toFixed(1)}%, attempt ${attempt + 1})`;
        console.warn('[VERIFIED-SAVE]', reason);
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
