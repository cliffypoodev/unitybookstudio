import { base44 } from '@/api/base44Client';
import { chapterHasContent } from '@/lib/chapterStorage';
import { toast } from 'sonner';
import { isGenericChapterTitle } from '@/lib/chapterMetadataRepair';

const CHAPTER_CREATOR_VERSION = 'chapterCreator-anthology-story-sync-v3';

console.log('[CHAPTER-CREATOR] Loaded', CHAPTER_CREATOR_VERSION);

function safeText(value) {
  return String(value || '').trim();
}

function cleanTitle(title, chapterNumber) {
  let out = safeText(title)
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/^(?:chapter|story)\s+\d+\s*[:\-—]\s*/i, '')
    .replace(/^ch\.?\s*\d+\s*[:\-—]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!out || isGenericChapterTitle(out, chapterNumber)) return '';
  if (out.length > 90) out = out.slice(0, 90).replace(/\s+\S*$/, '').trim();
  return out.replace(/[.!?]+$/g, '').trim();
}

function cleanSummary(value) {
  let out = safeText(value)
    .replace(/^summary\s*[:\-—]\s*/i, '')
    .replace(/^beat\s+summary\s*[:\-—]\s*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // ANTHOLOGYJSON-1: anthology stories store their full structured data as a JSON object
  // in beat_summary; truncating it to 1400 chars produces UNTERMINATED JSON that
  // parseStoryData cannot read, so the story then drafts with no premise/protagonist/
  // setting/pov/tense. Never truncate a JSON object — the 1400-char cap is for
  // human-readable summaries only.
  const _looksJson = /^\s*\{[\s\S]*\}\s*$/.test(out);
  if (!_looksJson && out.length > 1400) out = out.slice(0, 1400).replace(/\s+\S*$/, '').trim() + '…';
  return out;
}

function getSummary(entry) {
  return cleanSummary(
    entry?.beat_summary ||
    entry?.summary ||
    entry?.premise ||
    entry?.description ||
    entry?.chapter_summary ||
    entry?.synopsis ||
    entry?.beats ||
    entry?.outline ||
    ''
  );
}

function titleFromSummary(summary, chapterNumber) {
  const cleaned = safeText(summary)
    .replace(/^In this chapter,?\s*/i, '')
    .replace(/^Chapter\s+\d+\s*(?:opens|begins|follows|centers|focuses)\s+(?:with|on)?\s*/i, '')
    .replace(/[,.;:!?].*$/s, '')
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 6);
  if (!words.length) return `Chapter ${chapterNumber}`;

  const title = words.join(' ')
    .replace(/^the\s+/i, 'The ')
    .replace(/^[a-z]/, (c) => c.toUpperCase());

  return title || `Chapter ${chapterNumber}`;
}

function normalizePlanEntry(entry, chapterNumber, projectId) {
  const summary = getSummary(entry);

  const title =
    cleanTitle(entry?.title, chapterNumber) ||
    cleanTitle(entry?.chapter_title, chapterNumber) ||
    cleanTitle(entry?.story_title, chapterNumber) ||
    cleanTitle(entry?.name, chapterNumber) ||
    cleanTitle(titleFromSummary(summary, chapterNumber), chapterNumber) ||
    `Chapter ${chapterNumber}`;

  return {
    project_id: projectId,
    chapter_number: chapterNumber,
    title,
    beat_summary: summary,
    status: 'planned',
  };
}

/**
 * Parse outline_md markdown into chapter entries as a fallback
 * when the LLM doesn't return a structured chapters array.
 */
export function parseOutlineToChapters(outlineMd, targetCount) {
  if (!outlineMd) return [];
  const entries = [];

  const pushEntry = (num, title, body) => {
    if (!num || num < 1) return;
    const existingIdx = entries.findIndex((entry) => Number(entry.chapter_number) === Number(num));
    const entry = {
      chapter_number: num,
      title: cleanTitle(title, num) || `Chapter ${num}`,
      beat_summary: cleanSummary(body || ''),
    };
    if (existingIdx >= 0) entries[existingIdx] = entry;
    else entries.push(entry);
  };

  // Anthology format: "## Story N: Title" blocks.
  const storyBlocks = outlineMd.split(/(?=^#{1,4}\s*Story\s+\d+)/gim);
  for (const block of storyBlocks) {
    const m = block.match(/^#{1,4}\s*Story\s+(\d+)[:\s\-—]*(.*)/i);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    const title = (m[2] || '').trim().split('\n')[0].trim();
    const body = block.replace(/^#{1,4}\s*Story\s+\d+[:\s\-—]*.*\n?/i, '').trim();
    pushEntry(num, title, body);
  }

  // Standard chapter format: "Chapter N: Title" blocks.
  if (!entries.length) {
    const blocks = outlineMd.split(/(?=^(?:#{1,4}\s*)?(?:chapter|ch\.?)\s+\d+)/gim);
    for (const block of blocks) {
      const m = block.match(/^(?:#{1,4}\s*)?(?:chapter|ch\.?)\s+(\d+)[:\s\-—]*(.*)/i);
      if (m) {
        const num = parseInt(m[1], 10);
        const title = (m[2] || '').trim().split('\n')[0].trim();
        const summary = block.replace(/^(?:#{1,4}\s*)?(?:chapter|ch\.?)\s+\d+[:\s\-—]*.*/i, '');
        pushEntry(num, title, summary);
      }
    }
  }

  // Numbered list "1. Title - Summary" or "1) Title: Summary".
  if (!entries.length) {
    const lines = outlineMd.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      const m = line.match(/^(\d+)[.):\s]+(.+)/);
      if (m) {
        const num = parseInt(m[1], 10);
        const rest = m[2].trim();
        const parts = rest.split(/\s+[:\-—]\s+/);
        pushEntry(num, parts[0], parts.slice(1).join(' — '));
      }
    }
  }

  // Generic markdown headers "## 1. Title".
  if (!entries.length) {
    const headerBlocks = outlineMd.split(/(?=^#{1,4}\s+)/gm);
    let chNum = 0;
    for (const block of headerBlocks) {
      const hm = block.match(/^#{1,4}\s+(?:(?:chapter|story)\s+)?(\d+)?[.:\-—\s]*(.*)/i);
      if (hm) {
        chNum = hm[1] ? parseInt(hm[1], 10) : chNum + 1;
        const title = (hm[2] || '').trim().split('\n')[0].trim();
        const summary = block.replace(/^#{1,4}\s+.*/m, '');
        pushEntry(chNum, title, summary);
      }
    }
  }

  const limited = entries
    .filter((entry) => entry.chapter_number > 0)
    .sort((a, b) => a.chapter_number - b.chapter_number)
    .slice(0, targetCount || entries.length);

  console.log('[CHAPTERS] Parsed', limited.length, 'chapters/stories from outline_md');
  return limited;
}

/**
 * Normalize LLM-generated chapter arrays to match the user's exact chapter_target.
 */
export function normalizeChapterList(plannedChapters, targetCount, projectId) {
  const source = Array.isArray(plannedChapters) ? plannedChapters : [];
  const normalized = [];

  for (let i = 1; i <= targetCount; i += 1) {
    const llmEntry =
      source.find((ch) => Number(ch?.chapter_number || ch?.number) === i) ||
      source[i - 1] ||
      {};

    normalized.push(normalizePlanEntry(llmEntry, i, projectId));
  }

  console.log('[CHAPTERS] Normalized to exactly', targetCount, 'chapters. LLM provided:', source.length);
  return normalized;
}

/**
 * Clear old chapters (if safe) and create exactly `targetCount` new ones.
 *
 * Safety: if any chapters have drafted/reviewed content, preserve them all
 * and only add missing chapter numbers.
 * If no chapters have content, wipe and recreate cleanly.
 */
export async function clearAndCreateChapters(plannedChapters, targetCount, projectId, outlineMd) {
  if ((!plannedChapters || plannedChapters.length === 0) && outlineMd) {
    console.log('[CHAPTERS] No chapters from LLM response — parsing outline_md as fallback');
    plannedChapters = parseOutlineToChapters(outlineMd, targetCount);
  }

  if (!Array.isArray(plannedChapters)) plannedChapters = [];

  const existing = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 200);

  const withContent = existing.filter((ch) => chapterHasContent(ch) || ch.status === 'drafted' || ch.status === 'reviewed');
  const withoutContent = existing.filter((ch) => !chapterHasContent(ch) && ch.status !== 'drafted' && ch.status !== 'reviewed');

  if (withContent.length > 0) {
    const shouldReplace = window.confirm(
      `New outline generated. You have ${withContent.length} chapter(s) with drafted content.\n\n` +
      `• "Update chapters" → Replaces ALL chapters (drafted content will be lost).\n` +
      `• "Cancel" → Keeps existing chapters (only adds missing chapter numbers).\n\n` +
      `Update chapter list from new outline?`
    );

    if (shouldReplace) {
      for (const ch of existing) {
        await base44.entities.Chapter.delete(ch.id);
      }

      console.log('[CHAPTERS] User confirmed replacement. Deleted', existing.length, 'chapters (', withContent.length, 'had content)');

      const newChapters = normalizeChapterList(plannedChapters, targetCount, projectId);
      await base44.entities.Chapter.bulkCreate(newChapters);

      console.log('[CHAPTERS] Created', targetCount, 'fresh chapters from new outline');
      toast.success(`Replaced ${existing.length} chapters with ${targetCount} new chapters from updated outline.`);
    } else {
      for (const ch of withoutContent) {
        const llmEntry =
          plannedChapters.find((p) => Number(p?.chapter_number || p?.number) === Number(ch.chapter_number)) ||
          plannedChapters[ch.chapter_number - 1];

        if (llmEntry) {
          const normalized = normalizePlanEntry(llmEntry, ch.chapter_number, projectId);

          await base44.entities.Chapter.update(ch.id, {
            title: normalized.title || ch.title,
            beat_summary: normalized.beat_summary || ch.beat_summary,
          });
        }
      }

      const existingNumbers = new Set(existing.map((ch) => Number(ch.chapter_number)));
      const missing = [];

      for (let i = 1; i <= targetCount; i += 1) {
        if (!existingNumbers.has(i)) {
          const llmEntry =
            plannedChapters.find((ch) => Number(ch?.chapter_number || ch?.number) === i) ||
            plannedChapters[i - 1] ||
            {};

          missing.push(normalizePlanEntry(llmEntry, i, projectId));
        }
      }

      if (missing.length > 0) {
        await base44.entities.Chapter.bulkCreate(missing);
      }

      console.log('[CHAPTERS] Preserved', withContent.length, 'drafted chapters. Updated', withoutContent.length, 'undrafted. Added', missing.length, 'missing.');
      toast.info(`Kept ${withContent.length} drafted chapter(s). Updated ${withoutContent.length} undrafted and added ${missing.length} new.`);
    }
  } else {
    if (withoutContent.length > 0) {
      for (const ch of withoutContent) {
        await base44.entities.Chapter.delete(ch.id);
      }
      console.log('[CHAPTERS] Cleared', withoutContent.length, 'planned chapters');
    }

    const newChapters = normalizeChapterList(plannedChapters, targetCount, projectId);
    await base44.entities.Chapter.bulkCreate(newChapters);

    console.log('[CHAPTERS] Created', targetCount, 'fresh chapters');
  }
}

export default clearAndCreateChapters;
