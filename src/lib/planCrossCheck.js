/**
 * Plan Cross-Check — compare the manuscript against outline & character sheet.
 *
 * Produces a structured report covering:
 *   - Chapter coverage (planned vs drafted)
 *   - Character mentions across chapters
 *   - Beat delivery analysis (LLM-assisted when outline is available)
 *
 * @module planCrossCheck
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * CONSTANTS
 * ═════════════════════════════════════════════════════════════════════════ */

const CHAPTER_HEADING_RX = /^(?:#{1,3}\s+)?(?:\*{0,2})(?:Chapter|Ch\.?)\s+(\d+)\s*[:—–\-.]?\s*(.*)$/gim;

const SECTION_HEADING_FILTER = new Set([
  'characters', 'main characters', 'supporting characters', 'cast',
]);

const BEAT_DELIVERY_SCHEMA = {
  type: 'object',
  properties: {
    beatsDelivered: { type: 'array', items: { type: 'string' } },
    beatsMissing:   { type: 'array', items: { type: 'string' } },
    beatsAltered:   { type: 'array', items: { type: 'string' } },
  },
  required: ['beatsDelivered', 'beatsMissing', 'beatsAltered'],
};

/* ═══════════════════════════════════════════════════════════════════════════
 * INTERNAL HELPERS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Parse outline markdown into structured chapter entries.
 * Very forgiving — tries multiple heading conventions.
 *
 * @param {string} outlineMd
 * @returns {Array<{chapterNumber: number, title: string, beats: string[]}>}
 */
function parseOutlineChapters(outlineMd) {
  if (!outlineMd || typeof outlineMd !== 'string') return [];

  const matches = [];
  let m;
  // Reset lastIndex since we use 'g' flag
  CHAPTER_HEADING_RX.lastIndex = 0;
  while ((m = CHAPTER_HEADING_RX.exec(outlineMd)) !== null) {
    matches.push({
      chapterNumber: parseInt(m[1], 10),
      title: (m[2] || '').replace(/\*+$/g, '').trim(),
      index: m.index,
      length: m[0].length,
    });
  }

  if (matches.length === 0) return [];

  const chapters = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : outlineMd.length;
    const body = outlineMd.slice(start, end);

    const beats = body
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    chapters.push({
      chapterNumber: matches[i].chapterNumber,
      title: matches[i].title,
      beats,
    });
  }

  return chapters;
}

/**
 * Extract character names from the characters_md field.
 *
 * Looks for lines starting with `## Name`, `### Name`, `**Name**`,
 * `Name:`, or `- Name —`. Filters out generic section headings.
 *
 * @param {string} charactersMd
 * @returns {string[]}
 */
function extractCharacterNames(charactersMd) {
  if (!charactersMd || typeof charactersMd !== 'string') return [];

  const names = [];
  const lines = charactersMd.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    let name = null;

    // ## Name  or  ### Name
    const headingMatch = trimmed.match(/^#{2,3}\s+(.+)$/);
    if (headingMatch) {
      name = headingMatch[1].trim();
    }
    // **Name**
    else if (/^\*\*(.+?)\*\*/.test(trimmed)) {
      name = trimmed.match(/^\*\*(.+?)\*\*/)[1].trim();
    }
    // - Name — description  (em-dash separator)
    else if (/^-\s+(.+?)\s*[—–]/.test(trimmed)) {
      name = trimmed.match(/^-\s+(.+?)\s*[—–]/)[1].trim();
    }
    // Name: description
    else if (/^([A-Z][A-Za-z\s'.]+):/.test(trimmed)) {
      name = trimmed.match(/^([A-Z][A-Za-z\s'.]+):/)[1].trim();
    }

    if (name && !SECTION_HEADING_FILTER.has(name.toLowerCase())) {
      names.push(name);
    }
  }

  return names;
}

/**
 * Count occurrences of a character name in chapter text.
 * Checks both the full name and the first name using word boundaries.
 *
 * @param {string} name    Full character name
 * @param {string} content Chapter text
 * @returns {number}
 */
function countCharacterMentions(name, content) {
  if (!name || !content) return 0;

  const escapedFull = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fullRx = new RegExp(`\\b${escapedFull}\\b`, 'gi');
  const fullMatches = content.match(fullRx) || [];

  const firstName = name.split(/\s+/)[0];
  let firstNameCount = 0;
  if (firstName !== name) {
    const escapedFirst = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const firstRx = new RegExp(`\\b${escapedFirst}\\b`, 'gi');
    const firstMatches = content.match(firstRx) || [];
    firstNameCount = firstMatches.length;
  }

  // Full-name matches already include first-name overlaps, so take max
  return Math.max(fullMatches.length, firstNameCount);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * MAIN EXPORT
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Cross-check the manuscript against its planned outline and character sheet.
 *
 * @param {object}   params
 * @param {object}   params.project        Project record (outline_md, characters_md, etc.)
 * @param {Array}    params.chapters       Array of { chapter, content } objects
 * @param {object}   [params.evidence]     Output from buildManuscriptEvidenceReport (optional)
 * @param {Function} [params.onProgress]   Optional (label: string) => void callback
 * @param {Function} [params._llmOverride] Optional async (prompt) => string for test injection
 * @returns {Promise<object>} Structured plan delivery report
 */
export async function buildPlanDeliveryReport({ project, chapters, evidence, onProgress, _llmOverride }) {
  const outlineMd = project?.outline_md || '';
  const planAvailable = outlineMd.length > 50;

  // ── 1. Parse outline chapters ──────────────────────────────────────────
  const parsedOutline = planAvailable ? parseOutlineChapters(outlineMd) : [];

  // ── 2. Build word-count lookup from evidence (if provided) ─────────────
  const evidenceWordMap = {};
  if (evidence?.chapters) {
    for (const ec of evidence.chapters) {
      evidenceWordMap[ec.chapterNumber] = ec.words;
    }
  }

  // ── 3. Build chapter lookup from actual chapters ───────────────────────
  const chapterMap = {};
  for (const entry of (chapters || [])) {
    const ch = entry.chapter || {};
    const num = ch.chapter_number ?? ch.chapterNumber ?? null;
    if (num != null) {
      chapterMap[num] = {
        title: ch.title || `Chapter ${num}`,
        content: entry.content || '',
        words: evidenceWordMap[num] ?? (entry.content ? entry.content.trim().split(/\s+/).filter(Boolean).length : 0),
      };
    }
  }

  // ── 4. Coverage table ──────────────────────────────────────────────────
  const coverageTable = parsedOutline.map(po => {
    const drafted = chapterMap[po.chapterNumber] || null;
    return {
      chapterNumber: po.chapterNumber,
      plannedTitle: po.title,
      draftedTitle: drafted ? drafted.title : null,
      drafted: !!drafted,
      words: drafted ? drafted.words : null,
    };
  });

  // ── 5. Character coverage ──────────────────────────────────────────────
  const characterNames = extractCharacterNames(project?.characters_md || '');
  const characterCoverage = characterNames.map(name => {
    const chaptersPresent = [];
    let totalMentions = 0;

    for (const entry of (chapters || [])) {
      const ch = entry.chapter || {};
      const num = ch.chapter_number ?? ch.chapterNumber ?? null;
      if (num == null) continue;

      const mentions = countCharacterMentions(name, entry.content || '');
      if (mentions > 0) {
        chaptersPresent.push(num);
        totalMentions += mentions;
      }
    }

    return { name, chaptersPresent, totalMentions };
  });

  // ── 6. Beat delivery (LLM-assisted) ───────────────────────────────────
  let beatDelivery = null;

  if (planAvailable) {
    beatDelivery = [];

    for (const po of parsedOutline) {
      const drafted = chapterMap[po.chapterNumber];
      if (!drafted || po.beats.length === 0) continue;

      const beatsText = po.beats.map((b, i) => `${i + 1}. ${b}`).join('\n');
      const chapterSnippet = drafted.content.slice(0, 8000);

      const prompt = [
        'You are evaluating whether a chapter delivered its planned beats.',
        `Here are the PLANNED BEATS for Chapter ${po.chapterNumber}:`,
        beatsText,
        '',
        `Here is the CHAPTER TEXT (first 8000 chars):`,
        chapterSnippet,
        '',
        'Respond in JSON only:',
        '{"beatsDelivered": ["beat description"], "beatsMissing": ["beat description"], "beatsAltered": ["original → actual"]}',
      ].join('\n');

      try {
        let result;

        if (_llmOverride) {
          const raw = await _llmOverride(prompt);
          result = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } else {
          result = await invokeLLMWithRetry({
            prompt,
            task_type: 'critique',
            temperature: 0.2,
            model: 'gemini_3_flash',
            response_json_schema: BEAT_DELIVERY_SCHEMA,
          });
        }

        beatDelivery.push({
          chapterNumber: po.chapterNumber,
          beatsDelivered: result.beatsDelivered || [],
          beatsMissing: result.beatsMissing || [],
          beatsAltered: result.beatsAltered || [],
          source: 'llm',
        });
      } catch (err) {
        console.warn(`[PLAN-CROSS-CHECK] LLM beat analysis failed for Ch.${po.chapterNumber}:`, err?.message || err);
        beatDelivery.push({
          chapterNumber: po.chapterNumber,
          beatsDelivered: [],
          beatsMissing: ['[LLM analysis failed]'],
          beatsAltered: [],
          source: 'llm',
        });
      }

      onProgress?.(`Plan check: Ch.${po.chapterNumber}…`);
    }
  }

  // ── 7. Assemble and return ─────────────────────────────────────────────
  return {
    planAvailable,
    coverageTable,
    characterCoverage,
    beatDelivery,
  };
}

console.log('[PLAN-CROSS-CHECK] v1 loaded');
