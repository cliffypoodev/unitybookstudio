import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';
import { resolveChapterContent } from '@/lib/chapterStorage';

const CHAPTER_METADATA_REPAIR_VERSION = 'chapterMetadataRepair-v2-title-hygiene-no-structure-spoilers';

console.log('[CHAPTER-METADATA-REPAIR] Loaded', CHAPTER_METADATA_REPAIR_VERSION);

const TITLE_REPAIR_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    beat_summary: { type: 'string' },
  },
  required: ['title', 'beat_summary'],
};

const STRUCTURE_TITLE_PATTERNS = [
  /\bmidpoint\b/i,
  /\btwist\s*\d*\b/i,
  /\bbad\s+guys\s+close\s+in\b/i,
  /\ball\s+is\s+lost\b/i,
  /\bdark\s+night\s+of\s+the\s+soul\b/i,
  /\bbreak\s+into\s+(?:two|three|2|3)\b/i,
  /\bopening\s+image\b/i,
  /\btheme\s+stated\b/i,
  /\bset\s*up\b/i,
  /\bcatalyst\b/i,
  /\bdebate\b/i,
  /\bb\s*story\b/i,
  /\bfun\s+and\s+games\b/i,
  /\bfinale\b/i,
  /\bfinal\s+image\b/i,
  /\bclimax\b/i,
  /\bresolution\b/i,
  /\bdenouement\b/i,
  /\bact\s+(?:i|ii|iii|iv|one|two|three|four|1|2|3|4)\b/i,
  /\bplot\s+point\s+\d*\b/i,
  /\bpinch\s+point\s+\d*\b/i,
  /\bturning\s+point\s+\d*\b/i,
  /\binciting\s+incident\b/i,
  /\bexecuting\s+the\s+plan\b/i,
  /\bgathering\s+the\s+team\b/i,
  /\bdig\s+deep\s+down\b/i,
];

const STRUCTURE_PREFIX_RX = /^(?:twist\s*\d*|midpoint|bad\s+guys\s+close\s+in(?:\s*,?\s*part\s*\d+)?|all\s+is\s+lost|dark\s+night\s+of\s+the\s+soul|break\s+into\s+(?:two|three|2|3)|opening\s+image|theme\s+stated|set\s*up|catalyst|debate|b\s*story|fun\s+and\s+games|finale|final\s+image|climax|resolution|denouement|act\s+(?:i|ii|iii|iv|one|two|three|four|1|2|3|4)|plot\s+point\s*\d*|pinch\s+point\s*\d*|turning\s+point\s*\d*|inciting\s+incident|executing\s+the\s+plan(?:\s*\(?part\s*\d+\)?)?|gathering\s+the\s+team|dig\s+deep\s+down)\s*[:\-—]\s*/i;

const PART_LABEL_RX = /\s*[\/\-—:]?\s*\(?\bpart\s*(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b\)?\s*$/i;

function safeText(value) {
  return String(value || '').trim();
}

function normalizeForTitleTest(value) {
  return safeText(value).toLowerCase().replace(/[\s._\-—:(),/]+/g, ' ').trim();
}

export function hasStructureSpoilerTitle(title) {
  const raw = safeText(title);
  if (!raw) return false;
  const normalized = normalizeForTitleTest(raw);

  if (STRUCTURE_TITLE_PATTERNS.some((rx) => rx.test(normalized))) return true;
  if (PART_LABEL_RX.test(raw)) return true;
  if (/^\s*(?:part|act)\s*(?:one|two|three|four|five|\d+)\s*$/i.test(raw)) return true;
  if (/^\s*(?:twist|midpoint|climax|finale|resolution)\b/i.test(raw)) return true;

  return false;
}

export function isGenericChapterTitle(title, chapterNumber) {
  const raw = safeText(title);
  const compact = raw.toLowerCase().replace(/[\s._\-—:]+/g, '');

  if (!raw) return true;
  if (compact === 'untitled') return true;
  if (compact === 'chapter') return true;
  if (compact === 'chapter_') return true;
  if (compact === 'chapter' + String(chapterNumber || '')) return true;
  if (/^chapter[_\s.\-—:]*\d*$/i.test(raw)) return true;
  if (/^ch(?:apter)?[_\s.\-—:]*\d*$/i.test(raw)) return true;
  if (/^section[_\s.\-—:]*\d*$/i.test(raw)) return true;
  if (hasStructureSpoilerTitle(raw)) return true;

  return false;
}

function cleanTitle(title, chapterNumber) {
  let out = safeText(title)
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/^chapter\s+\d+\s*[:\-—]\s*/i, '')
    .replace(/^ch\.?\s*\d+\s*[:\-—]\s*/i, '')
    .replace(STRUCTURE_PREFIX_RX, '')
    .replace(PART_LABEL_RX, '')
    .replace(/\s+/g, ' ')
    .trim();

  out = out.replace(/[.!?]+$/g, '').trim();

  // If stripping a structure prefix produced a real title, allow it.
  // Example: "Twist 1: The Producer's Patron" -> "The Producer's Patron".
  if (!out || isGenericChapterTitle(out, chapterNumber)) return '';

  if (out.length > 72) {
    out = out.slice(0, 72).replace(/\s+\S*$/, '').trim();
  }

  return out;
}

function cleanSummary(summary) {
  let out = safeText(summary)
    .replace(/^summary\s*[:\-—]\s*/i, '')
    .replace(/^beat\s+summary\s*[:\-—]\s*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (out.length > 1200) {
    out = out.slice(0, 1200).replace(/\s+\S*$/, '').trim() + '…';
  }

  return out;
}

function getChapterNumber(chapter, fallbackIndex = 0) {
  return Number(chapter?.chapter_number || chapter?.number || fallbackIndex + 1) || fallbackIndex + 1;
}

function isBodyLikeChapter(chapter) {
  const n = Number(chapter?.chapter_number);
  if (!Number.isFinite(n)) return true;
  return n > 0 && n < 9000;
}

function needsMetadataRepair(chapter, index = 0) {
  const n = getChapterNumber(chapter, index);
  const rawTitle = safeText(chapter?.title);
  const titleBad = isGenericChapterTitle(rawTitle, n) || hasStructureSpoilerTitle(rawTitle);
  const summaryBad = safeText(chapter?.beat_summary).length < 40;
  return titleBad || summaryBad;
}

function titleLooksPublishable(title, chapterNumber) {
  const cleaned = cleanTitle(title, chapterNumber);
  if (!cleaned) return false;
  if (hasStructureSpoilerTitle(title)) return false;
  if (/\b(?:part\s*\d+|part\s+one|part\s+two|part\s+three)\b/i.test(title)) return false;
  if (/^\s*(?:the\s+)?(?:plan|favor|audience|surprise)\s*$/i.test(cleaned) && cleaned.length < 12) return false;
  return true;
}

function tryParseJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;

  let text = String(raw)
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) text = text.slice(first, last + 1);

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function parseOutlineMetadata(outlineMd = '') {
  const outline = safeText(outlineMd);
  if (!outline) return new Map();

  const map = new Map();

  const blocks = outline.split(/(?=^(?:#{1,4}\s*)?(?:chapter|ch\.?)\s+\d+[\s:.\-—])/gim);

  for (const block of blocks) {
    const header = block.match(/^(?:#{1,4}\s*)?(?:chapter|ch\.?)\s+(\d+)[\s:.\-—]*(.*)$/im);
    if (!header) continue;

    const chapterNumber = Number(header[1]);
    const rawHeaderTitle = safeText(header[2] || '');
    const headerTitle = cleanTitle(rawHeaderTitle, chapterNumber);
    const summary = cleanSummary(
      block
        .replace(/^(?:#{1,4}\s*)?(?:chapter|ch\.?)\s+\d+[\s:.\-—]*.*$/im, '')
        .replace(/^[-*]\s*/gm, '')
    );

    if (chapterNumber) {
      map.set(chapterNumber, {
        title: headerTitle,
        raw_title: rawHeaderTitle,
        beat_summary: summary,
      });
    }
  }

  if (map.size) return map;

  const lines = outline.split('\n').map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(\d+)[.)\s:—-]+(.+)$/);
    if (!m) continue;

    const chapterNumber = Number(m[1]);
    const rest = m[2].trim();
    const parts = rest.split(/\s+[-—:]\s+/);
    const rawTitle = parts[0] || '';
    const title = cleanTitle(rawTitle, chapterNumber);
    const summary = cleanSummary(parts.slice(1).join(' — '));

    if (chapterNumber) {
      map.set(chapterNumber, {
        title,
        raw_title: rawTitle,
        beat_summary: summary,
      });
    }
  }

  return map;
}

function deterministicSummaryFromContent(content) {
  const text = safeText(content)
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  const sentences = text.match(/[^.!?…]+[.!?…]+/g) || [];
  const firstSentences = sentences.slice(0, 3).join(' ').trim();

  if (firstSentences.length >= 90) {
    return firstSentences.slice(0, 450).replace(/\s+\S*$/, '').trim();
  }

  return text.slice(0, 450).replace(/\s+\S*$/, '').trim();
}

function deterministicTitleFromContent(content, chapterNumber) {
  const summary = deterministicSummaryFromContent(content);
  if (!summary) return `Chapter ${chapterNumber}`;

  const cleaned = summary
    .replace(/^["'“”]+/, '')
    .replace(/\b(?:she|he|they|it|we|i)\b\s+/i, '')
    .replace(/\b(?:was|were|is|are|had|has|have)\b\s+/i, '')
    .replace(/[,.;:!?].*$/, '')
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 5);
  if (!words.length) return `Chapter ${chapterNumber}`;

  return words
    .join(' ')
    .replace(/^[a-z]/, (c) => c.toUpperCase())
    .replace(/[.!?]+$/g, '');
}

function buildMetadataPrompt({ project, chapter, content, outlineEntry, previousChapter, nextChapter }) {
  const chapterNumber = getChapterNumber(chapter);
  const projectTitle = project?.title || project?.name || 'Untitled Project';
  const genre = project?.genre || project?.book_type || project?.project_type || 'fiction';

  return `You are repairing chapter metadata for a book-writing app.

MISSION:
Create a publishable chapter title and a useful chapter-card description for the chapter below.

PROJECT:
Title: ${projectTitle}
Genre/type: ${genre}
Chapter number: ${chapterNumber}
Existing weak/spoiler title: ${chapter?.title || ''}
Existing weak summary: ${chapter?.beat_summary || ''}

OUTLINE HINT, IF ANY:
Title hint: ${outlineEntry?.raw_title || outlineEntry?.title || ''}
Summary hint: ${outlineEntry?.beat_summary || ''}

NEIGHBORING CHAPTERS:
Previous: ${previousChapter ? `Ch. ${previousChapter.chapter_number}: ${previousChapter.title || ''} — ${previousChapter.beat_summary || ''}` : 'None'}
Next: ${nextChapter ? `Ch. ${nextChapter.chapter_number}: ${nextChapter.title || ''} — ${nextChapter.beat_summary || ''}` : 'None'}

TITLE RULES:
- Return JSON only.
- The title must sound like a real chapter title in a finished novel.
- The title must be specific, artistic, short, and story-facing.
- Do NOT include the word "Chapter".
- Do NOT include screenplay/story-structure labels.
- Do NOT include labels such as: Twist, Midpoint, Bad Guys Close In, All Is Lost, Dark Night of the Soul, Break into Two, Break into Three, Finale, Act, Plot Point, Pinch Point, Part 1, Part 2.
- Do NOT reveal that a twist, midpoint, climax, betrayal, or structural beat is happening.
- Do NOT use mechanical outline titles like "Executing the Plan," "Gathering the Team," or "Dig Deep Down." Make them literary and in-world instead.
- Do NOT invent a different plot.
- If the existing title has a useful story phrase after a bad prefix, you may keep only the story phrase. Example: "Twist 1: The Producer's Patron" can become "The Producer's Patron".

SUMMARY RULES:
- The beat_summary should be 2-4 sentences.
- The beat_summary should describe what this chapter DOES: visible events, emotional turn, character pressure, reveal, consequence, and forward pull.
- The summary may mention plot function, but it must not use Save-the-Cat/outline labels.
- Do not spoil beyond this chapter.
- Keep the style commercially usable, not academic.

CHAPTER TEXT SAMPLE:
${safeText(content).slice(0, 7000)}

Return this exact JSON shape:
{
  "title": "Publishable Chapter Title",
  "beat_summary": "2-4 sentence chapter-card description."
}`;
}

async function repairOneChapter({ project, chapter, chapters, index, outlineMap }) {
  const chapterNumber = getChapterNumber(chapter, index);
  const outlineEntry = outlineMap.get(chapterNumber) || null;

  const outlineTitle = cleanTitle(outlineEntry?.title || outlineEntry?.raw_title || '', chapterNumber);
  const outlineSummary = cleanSummary(outlineEntry?.beat_summary || '');

  // Trust outline metadata only when the title is already publishable.
  // Do not preserve structure/spoiler labels like "Midpoint," "Twist," "Part 1," etc.
  if (outlineTitle && outlineSummary.length >= 40 && titleLooksPublishable(outlineTitle, chapterNumber)) {
    return {
      title: outlineTitle,
      beat_summary: outlineSummary,
      source: 'outline',
    };
  }

  const content = await resolveChapterContent(chapter);
  const previousChapter = chapters.find((ch) => getChapterNumber(ch) === chapterNumber - 1);
  const nextChapter = chapters.find((ch) => getChapterNumber(ch) === chapterNumber + 1);

  try {
    const response = await invokeLLMWithRetry({
    task_type: 'foundation',
      prompt: buildMetadataPrompt({
        project,
        chapter,
        content,
        outlineEntry,
        previousChapter,
        nextChapter,
      }),
      response_json_schema: TITLE_REPAIR_SCHEMA,
      model: pickModel('chapter_plan', project),
      spec: project,
      fallback_model: pickFallbackModel('chapter_plan', project),
      temperature: 0.35,
      max_tokens: 1200,
    });

    const parsed = tryParseJson(response?.data || response?.text || response?.content || response);

    const title = cleanTitle(parsed?.title || '', chapterNumber);
    const beatSummary = cleanSummary(parsed?.beat_summary || '');

    if (title && titleLooksPublishable(title, chapterNumber) && beatSummary.length >= 40) {
      return {
        title,
        beat_summary: beatSummary,
        source: 'llm',
      };
    }
  } catch (error) {
    console.warn('[CHAPTER-METADATA-REPAIR] LLM repair failed for chapter', chapterNumber, error?.message || error);
  }

  const fallbackSummary = cleanSummary(outlineSummary || deterministicSummaryFromContent(content));
  const rawFallback = cleanTitle(deterministicTitleFromContent(content, chapterNumber), chapterNumber);
  const fallbackTitle = titleLooksPublishable(rawFallback, chapterNumber)
    ? rawFallback
    : (outlineTitle && titleLooksPublishable(outlineTitle, chapterNumber) ? outlineTitle : `Chapter ${chapterNumber}`);

  return {
    title: fallbackTitle,
    beat_summary: fallbackSummary || `Chapter ${chapterNumber} needs a manual description.`,
    source: 'fallback',
  };
}

export async function repairChapterMetadata({ project, chapters, onProgress, force = false } = {}) {
  if (!project?.id) throw new Error('Project is required.');
  if (!Array.isArray(chapters) || !chapters.length) {
    return {
      inspected: 0,
      changed: 0,
      skipped: 0,
      failed: 0,
      repaired: [],
    };
  }

  const outlineMap = parseOutlineMetadata(project?.outline_md || '');
  const ordered = [...chapters]
    .filter(isBodyLikeChapter)
    .sort((a, b) => getChapterNumber(a) - getChapterNumber(b));

  const targets = force ? ordered : ordered.filter(needsMetadataRepair);

  if (!targets.length) {
    return {
      inspected: ordered.length,
      changed: 0,
      skipped: ordered.length,
      failed: 0,
      repaired: [],
    };
  }

  let changed = 0;
  let failed = 0;
  const repaired = [];

  for (let i = 0; i < targets.length; i += 1) {
    const chapter = targets[i];
    const chapterNumber = getChapterNumber(chapter, i);

    onProgress?.(`Repairing chapter metadata ${i + 1}/${targets.length} — Ch. ${chapterNumber}…`);

    try {
      const nextMeta = await repairOneChapter({
        project,
        chapter,
        chapters: ordered,
        index: i,
        outlineMap,
      });

      const title = cleanTitle(nextMeta.title, chapterNumber);
      const beatSummary = cleanSummary(nextMeta.beat_summary);

      if (!title || !beatSummary) {
        failed += 1;
        continue;
      }

      const existingTitle = safeText(chapter.title);
      const existingSummary = safeText(chapter.beat_summary);
      const titleChanged = title !== existingTitle;
      const summaryChanged = beatSummary !== existingSummary;

      if (!titleChanged && !summaryChanged) {
        continue;
      }

      const patch = {
        title,
        beat_summary: beatSummary,
        revision_notes: [
          `[metadata repair] ${new Date().toISOString()} — title/description repaired via ${nextMeta.source}; structure-spoiler title hygiene active.`,
          chapter.revision_notes || '',
        ].filter(Boolean).join('\n'),
      };

      await base44.entities.Chapter.update(chapter.id, patch);

      changed += 1;
      repaired.push({
        chapter_number: chapterNumber,
        old_title: chapter.title || '',
        new_title: title,
        source: nextMeta.source,
      });
    } catch (error) {
      failed += 1;
      console.error('[CHAPTER-METADATA-REPAIR] Failed chapter', chapterNumber, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (changed > 0) {
    toast.success(`Repaired ${changed} chapter title/description set(s).`);
  }

  if (failed > 0) {
    toast.warning(`${failed} chapter metadata repair(s) failed.`);
  }

  return {
    inspected: ordered.length,
    changed,
    skipped: ordered.length - targets.length,
    failed,
    repaired,
  };
}

export default repairChapterMetadata;
