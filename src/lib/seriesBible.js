/**
 * Series Bible extraction and formatting utilities.
 * Used by the series continuation feature across Polish, Setup, and New Project flows.
 */
import { invokeLLMWithRetry } from '@/lib/integrationRetry';

/** Force any value to a string — handles arrays, objects, nulls from LLM output. */
function stringifyField(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Parse a value that might be a JSON string or already an array. */
function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return value ? [value] : []; }
  }
  return [];
}

/**
 * Sanitize a SeriesBible payload before create/update.
 * Forces all fields to their correct types — strings for text fields, number for books_analyzed.
 */
export function sanitizeSeriesBible(data) {
  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === 'books_analyzed') {
      clean[key] = typeof value === 'number' ? value : parseInt(value) || 0;
    } else {
      clean[key] = stringifyField(value);
    }
  }
  return clean;
}

/**
 * Extract a series bible from a manuscript text using AI analysis.
 */
export async function extractSeriesBible(manuscriptText, bookTitle, existingSeriesBible, onProgress) {
  onProgress?.('Series: Analyzing manuscript…');

  const maxChunkSize = 55000;
  const hasSecondChunk = manuscriptText.length > maxChunkSize;

  const extractionPrompt = `You are a professional series editor analyzing a completed novel to prepare the foundation for its sequel.

Read the following manuscript carefully and extract ALL of the following information. Be exhaustive — anything you miss will create a continuity error in Book 2.

MANUSCRIPT:
${manuscriptText.substring(0, maxChunkSize)}

${hasSecondChunk ? '\n[MANUSCRIPT CONTINUES — additional text was truncated. Extract from what you can see.]\n' : ''}

EXTRACT THE FOLLOWING (respond in JSON format):

{
  "characters": [
    {
      "name": "Full Name",
      "aliases": ["nicknames", "titles"],
      "role": "protagonist / antagonist / supporting / minor",
      "age": "age or approximate",
      "physical_description": "appearance details",
      "personality": "core personality traits",
      "arc_start": "where this character began",
      "arc_end": "where this character ended up",
      "abilities": "skills, powers, expertise",
      "relationships": {"character_name": "relationship type and current status"},
      "status_at_end": "alive / dead / missing / transformed / unknown",
      "unresolved_issues": "anything left hanging",
      "wounds_and_growth": "emotional wounds and changes",
      "voice_notes": "how they speak"
    }
  ],
  "world_state": "Description of the world at end of book",
  "resolved_threads": ["Plot threads CONCLUSIVELY resolved"],
  "unresolved_threads": ["Plot threads left OPEN"],
  "timeline": "Chronological list of major events",
  "rules_and_systems": "Rules about magic, technology, physics, organizations",
  "key_locations": [
    {"name": "Place", "description": "what it looks like", "significance": "what happened", "current_state": "destroyed / intact / changed"}
  ],
  "deaths_and_losses": ["Characters who died or were permanently lost, and how"],
  "secrets_revealed": ["Information revealed to the reader"],
  "secrets_remaining": ["Information NOT yet revealed"],
  "power_levels": "Where each major character stands at book's end",
  "tone_and_themes": "Recurring themes, motifs, imagery patterns",
  "last_scene_summary": "Summary of the final chapter/scene",
  "voice_profile": "Analysis of the prose style"
}

Respond with ONLY the JSON object. No commentary, no markdown formatting, no backticks.`;

  let extractionResult;
  try {
    onProgress?.('Series: Extracting characters, world, and plot…');
    const response = await invokeLLMWithRetry({
    task_type: 'foundation',
      prompt: extractionPrompt,
      model: 'gemini_3_flash',
      fallback_model: 'gpt_5_mini',
    });

    let text = typeof response === 'string' ? response : response?.text || response?.content || String(response || '');
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    extractionResult = JSON.parse(text);
  } catch (err) {
    console.error('[SERIES] Extraction failed:', err.message);
    throw new Error('Series extraction failed: ' + err.message);
  }

  // Second chunk supplementary pass
  if (hasSecondChunk) {
    onProgress?.('Series: Analyzing remaining chapters…');
    try {
      const supResponse = await invokeLLMWithRetry({
    task_type: 'foundation',
        prompt: `You previously analyzed the first half of a manuscript. Here is the second half. Extract any ADDITIONAL characters, plot threads, revelations, or world details not found in the first half. Respond in the same JSON format. Only include NEW information.\n\nMANUSCRIPT (continued):\n${manuscriptText.substring(maxChunkSize, maxChunkSize * 2)}\n\nRespond with ONLY a JSON object containing any new characters, threads, or details.`,
        model: 'gemini_3_flash',
      });
      let supText = typeof supResponse === 'string' ? supResponse : supResponse?.text || supResponse?.content || '';
      supText = supText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const supplement = JSON.parse(supText);

      if (supplement.characters) {
        const existingNames = extractionResult.characters.map(c => c.name.toLowerCase());
        for (const char of supplement.characters) {
          if (!existingNames.includes(char.name.toLowerCase())) {
            extractionResult.characters.push(char);
          }
        }
      }
      ['unresolved_threads', 'secrets_remaining', 'deaths_and_losses', 'secrets_revealed'].forEach(key => {
        if (supplement[key]) {
          extractionResult[key] = [...(extractionResult[key] || []), ...supplement[key]];
        }
      });
    } catch (e) {
      console.warn('[SERIES] Supplementary pass failed, continuing with first pass data');
    }
  }

  onProgress?.('Series: Building series bible…');

  const characters = ensureArray(extractionResult.characters);
  const seriesBible = sanitizeSeriesBible({
    series_name: existingSeriesBible?.series_name || '',
    characters_json: characters,
    world_state: extractionResult.world_state || '',
    resolved_threads: extractionResult.resolved_threads || [],
    unresolved_threads: extractionResult.unresolved_threads || [],
    timeline: extractionResult.timeline || '',
    relationships: characters.reduce((map, c) => {
      if (c && c.relationships) map[c.name] = c.relationships;
      return map;
    }, {}),
    rules_and_systems: extractionResult.rules_and_systems || '',
    voice_profile: extractionResult.voice_profile || '',
    tone_and_themes: extractionResult.tone_and_themes || '',
    key_locations: extractionResult.key_locations || [],
    deaths_and_losses: extractionResult.deaths_and_losses || [],
    secrets_revealed: extractionResult.secrets_revealed || [],
    secrets_remaining: extractionResult.secrets_remaining || [],
    power_levels: extractionResult.power_levels || '',
    books_analyzed: (existingSeriesBible?.books_analyzed || 0) + 1,
    last_book_title: bookTitle || 'Untitled',
    last_book_ending: extractionResult.last_scene_summary || '',
  });

  return { seriesBible, extractionResult };
}

/**
 * Format characters array into story bible markdown.
 */
export function formatCharactersForStoryBible(characters) {
  const arr = ensureArray(characters);
  if (!arr.length) return typeof characters === 'string' ? characters : '';
  return arr.map(c => {
    if (typeof c === 'string') return c;
    let entry = `**${c.name || 'Unknown'}**`;
    if (c.role) entry += ` (${c.role})`;
    entry += ':\n';
    if (c.arc_end) entry += `- Current state: ${c.arc_end}\n`;
    if (c.abilities) entry += `- Abilities: ${c.abilities}\n`;
    if (c.wounds_and_growth) entry += `- Wounds/Growth: ${c.wounds_and_growth}\n`;
    if (c.voice_notes) entry += `- Voice: ${c.voice_notes}\n`;
    if (c.unresolved_issues) entry += `- Unresolved: ${c.unresolved_issues}\n`;
    if (c.status_at_end) entry += `- Status: ${c.status_at_end}\n`;
    return entry;
  }).join('\n');
}

/**
 * Build canon document from extraction results.
 */
export function buildCanonFromSeriesBible(extraction) {
  const parts = [];
  if (extraction.rules_and_systems) {
    parts.push('## Established Rules\n' + stringifyField(extraction.rules_and_systems));
  }
  const deaths = ensureArray(extraction.deaths_and_losses);
  if (deaths.length) parts.push('## Permanent Deaths/Losses\n' + deaths.map(d => typeof d === 'string' ? d : JSON.stringify(d)).join('\n'));
  const revealed = ensureArray(extraction.secrets_revealed);
  if (revealed.length) parts.push('## Known Secrets (reader knows)\n' + revealed.map(s => typeof s === 'string' ? s : JSON.stringify(s)).join('\n'));
  const resolved = ensureArray(extraction.resolved_threads);
  if (resolved.length) parts.push('## Closed Threads (do not reopen)\n' + resolved.map(t => typeof t === 'string' ? t : JSON.stringify(t)).join('\n'));
  return parts.join('\n\n');
}

/**
 * Format unresolved threads as mystery/plot document.
 */
export function formatUnresolvedThreads(threads) {
  const arr = ensureArray(threads);
  if (!arr.length) return typeof threads === 'string' ? threads : '';
  return '## Open Threads from Previous Book\n' + arr.map((t, i) => `${i + 1}. ${typeof t === 'string' ? t : JSON.stringify(t)}`).join('\n');
}

/**
 * Build the series continuity block for prose generation prompts.
 */
export function buildSeriesContinuityBlock(seriesBible, seriesNumber) {
  if (!seriesBible) return '';
  const parts = [];
  parts.push(`=== SERIES CONTINUITY (from Book ${(seriesNumber || 2) - 1}) ===`);

  const deaths = safeParseJson(seriesBible.deaths_and_losses);
  if (deaths?.length) parts.push(`DEATHS (DEAD — do NOT resurrect): ${deaths.join('; ')}`);

  const resolved = safeParseJson(seriesBible.resolved_threads);
  if (resolved?.length) parts.push(`RESOLVED THREADS (CLOSED — do not reopen): ${resolved.join('; ')}`);

  const revealed = safeParseJson(seriesBible.secrets_revealed);
  if (revealed?.length) parts.push(`SECRETS THE READER KNOWS: ${revealed.join('; ')}`);

  if (seriesBible.world_state) parts.push(`WORLD STATE: ${seriesBible.world_state.substring(0, 400)}`);
  if (seriesBible.last_book_ending) parts.push(`PREVIOUS BOOK ENDED: ${seriesBible.last_book_ending.substring(0, 300)}`);

  parts.push('=== END SERIES CONTINUITY ===');
  return parts.join('\n');
}

function safeParseJson(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}