/**
 * Batched anthology story outline generation.
 *
 * The single-prompt approach can truncate or hang when generating large fanfiction,
 * anthology, or nonfiction collections. This version uses smaller batches, hard
 * per-batch timeouts, fallback placeholders, and safer model fallback routing.
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';
import { unwrapIntegrationResult } from '@/lib/autonovel';
import { ANTHOLOGY_STORY_LENGTHS, isNonfictionAnthology } from '@/lib/anthologyEngine';
import { buildAnthologyVarietyOutlinePromptBlock, normalizeVarietyFields, summarizeTemplateSignature } from '@/lib/anthologyVarietyGuard';

const BATCH_SIZE = 5;
const BATCH_TIMEOUT_MS = 300000; // 5 minutes — local Ollama models are much slower than cloud APIs

const batchStorySchema = {
  type: 'object',
  properties: {
    stories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          story_number: { type: 'number' },
          title: { type: 'string' },
          premise: { type: 'string' },
          protagonist: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'string' },
              occupation_or_role: { type: 'string' },
              wound: { type: 'string' },
              want: { type: 'string' },
              defining_trait: { type: 'string' },
            },
          },
          setting: {
            type: 'object',
            properties: {
              location: { type: 'string' },
              time_period: { type: 'string' },
              sensory_anchor: { type: 'string' },
            },
          },
          conflict: { type: 'string' },
          twist_or_turn: { type: 'string' },
          ending_type: { type: 'string' },
          setting_type: { type: 'string' },
          conflict_engine: { type: 'string' },
          power_dynamic: { type: 'string' },
          escalation_shape: { type: 'string' },
          emotional_arc: { type: 'string' },
          ending_shape: { type: 'string' },
          thematic_angle: { type: 'string' },
          pov: { type: 'string' },
          tense: { type: 'string' },
          tone: { type: 'string' },
          estimated_words: { type: 'number' },
        },
        required: ['story_number', 'title', 'premise', 'conflict', 'thematic_angle'],
      },
    },
  },
  required: ['stories'],
};

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label || 'Operation'} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function sanitizeOneLine(value, fallback = '') {
  return String(value || fallback)
    .replace(/\s+/g, ' ')
    .replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, '')
    .trim();
}


function looksLikeInstructionDump(value) {
  const text = String(value || '');
  if (!text.trim()) return false;
  if (text.length > 500) return true;
  return /(?:formula for generation|core tenets|story bible|revised core tenet|key for erotic focus|to generate a new story|replace this placeholder|protagonist \d+|central conflict for story)/i.test(text);
}

function deriveCleanAnthologyTheme(project) {
  const candidates = [
    project.anthology_theme,
    project.title,
    project.tagline,
    project.subgenre,
    project.genre,
    project.fandom_name,
    project.source_universe,
  ];
  for (const candidate of candidates) {
    const cleaned = sanitizeOneLine(candidate);
    if (cleaned && !looksLikeInstructionDump(cleaned)) return cleaned.slice(0, 140);
  }
  const seed = sanitizeOneLine(project.seed_concept || '');
  if (seed && !looksLikeInstructionDump(seed)) return seed.slice(0, 140);
  return 'Themed Anthology';
}

function buildProjectBrief(project) {
  const rawSeed = String(project.seed_concept || '').trim();
  const theme = deriveCleanAnthologyTheme(project);
  const brief = [];
  brief.push(`Collection title: ${project.title || theme}`);
  brief.push(`Clean collection theme: ${theme}`);
  if (project.genre) brief.push(`Primary genre/mode: ${project.genre}`);
  if (project.subgenre) brief.push(`Subgenre/lane: ${project.subgenre}`);
  if (project.content_lane === 'fanfiction' || project.rights_mode === 'fanfiction_noncommercial') {
    brief.push(`Fanfiction source/fandom: ${project.fandom_name || project.source_universe || 'user-defined fandom'}`);
    brief.push(`Canon mode: ${project.canon_mode || 'user-defined'}`);
    if (project.canon_boundary) brief.push(`Canon boundary: ${String(project.canon_boundary).slice(0, 600)}`);
    if (project.canon_characters) brief.push(`Canon characters: ${String(project.canon_characters).slice(0, 600)}`);
  }
  if (rawSeed) {
    if (looksLikeInstructionDump(rawSeed)) {
      brief.push(`User seed/concept contains long instructions. Treat them as background constraints only; do NOT paste them into story titles, premises, thematic angles, or chapter outline fields.`);
      brief.push(`User seed/concept excerpt: ${sanitizeOneLine(rawSeed).slice(0, 900)}`);
    } else {
      brief.push(`User seed/concept: ${sanitizeOneLine(rawSeed).slice(0, 900)}`);
    }
  }
  return brief.join('\n');
}

function isPlaceholderishStory(story) {
  const title = sanitizeOneLine(story?.title || '');
  const premise = sanitizeOneLine(story?.premise || '');
  const protagonist = sanitizeOneLine(story?.protagonist?.name || '');
  const conflict = sanitizeOneLine(story?.conflict || '');
  const angle = sanitizeOneLine(story?.thematic_angle || '');
  const combined = `${title} ${premise} ${protagonist} ${conflict} ${angle}`;
  if (!combined.trim()) return true;
  if (/replace this placeholder|protagonist \d+|private wound \d+|clear desire \d+|central conflict for story|sensory opening image for story|meaningful reversal for story|unique angle \d+/i.test(combined)) return true;
  if (/^story\s*\d+\s*:\s*story\s*\d+/i.test(title)) return true;
  if (looksLikeInstructionDump(title) || looksLikeInstructionDump(premise) || looksLikeInstructionDump(angle)) return true;
  return false;
}

function compactStory(story, fallback) {
  const next = normalizeVarietyFields({
    ...fallback,
    ...story,
    protagonist: { ...fallback.protagonist, ...(story?.protagonist || {}) },
    setting: { ...fallback.setting, ...(story?.setting || {}) },
  }, story?.story_number || fallback?.story_number || 1);
  next.title = sanitizeOneLine(next.title, fallback.title).slice(0, 90);
  next.premise = sanitizeOneLine(next.premise, fallback.premise).slice(0, 700);
  next.conflict = sanitizeOneLine(next.conflict, fallback.conflict).slice(0, 500);
  next.twist_or_turn = sanitizeOneLine(next.twist_or_turn, fallback.twist_or_turn).slice(0, 450);
  next.ending_type = sanitizeOneLine(next.ending_type, fallback.ending_type).slice(0, 140);
  next.thematic_angle = sanitizeOneLine(next.thematic_angle, fallback.thematic_angle).slice(0, 350);
  next.tone = sanitizeOneLine(next.tone, fallback.tone).slice(0, 180);
  next.setting_type = sanitizeOneLine(next.setting_type, fallback.setting_type).slice(0, 120);
  next.conflict_engine = sanitizeOneLine(next.conflict_engine, fallback.conflict_engine).slice(0, 120);
  next.power_dynamic = sanitizeOneLine(next.power_dynamic, fallback.power_dynamic).slice(0, 120);
  next.escalation_shape = sanitizeOneLine(next.escalation_shape, fallback.escalation_shape).slice(0, 160);
  next.emotional_arc = sanitizeOneLine(next.emotional_arc, fallback.emotional_arc).slice(0, 160);
  next.ending_shape = sanitizeOneLine(next.ending_shape, fallback.ending_shape || fallback.ending_type).slice(0, 160);
  next.protagonist.name = sanitizeOneLine(next.protagonist.name, fallback.protagonist.name).slice(0, 80);
  next.protagonist.age = sanitizeOneLine(next.protagonist.age, fallback.protagonist.age).slice(0, 80);
  next.protagonist.occupation_or_role = sanitizeOneLine(next.protagonist.occupation_or_role, fallback.protagonist.occupation_or_role).slice(0, 160);
  next.protagonist.wound = sanitizeOneLine(next.protagonist.wound, fallback.protagonist.wound).slice(0, 260);
  next.protagonist.want = sanitizeOneLine(next.protagonist.want, fallback.protagonist.want).slice(0, 260);
  next.protagonist.defining_trait = sanitizeOneLine(next.protagonist.defining_trait, fallback.protagonist.defining_trait).slice(0, 220);
  next.setting.location = sanitizeOneLine(next.setting.location, fallback.setting.location).slice(0, 180);
  next.setting.time_period = sanitizeOneLine(next.setting.time_period, fallback.setting.time_period).slice(0, 120);
  next.setting.sensory_anchor = sanitizeOneLine(next.setting.sensory_anchor, fallback.setting.sensory_anchor).slice(0, 260);
  return next;
}

function makeFallbackStory(project, storyNumber) {
  const isNF = isNonfictionAnthology(project);
  const theme = deriveCleanAnthologyTheme(project);
  const noun = isNF ? 'Chapter' : 'Story';
  const fandom = sanitizeOneLine(project.fandom_name || project.source_universe || project.genre || 'the collection world');
  const words = Number(project.chapter_length_target) || Number(project.target_chapter_words) || 3500;
  const variety = normalizeVarietyFields({}, storyNumber);

  return {
    story_number: storyNumber,
    title: `${noun} ${storyNumber}: ${theme}`,
    premise: isNF
      ? `A standalone chapter exploring a distinct angle of ${theme}.`
      : `A standalone story exploring ${theme} through a distinct protagonist, conflict, setting, and ending.`,
    protagonist: {
      name: isNF ? `Subject ${storyNumber}` : `Protagonist ${storyNumber}`,
      age: isNF ? 'research-dependent' : 'adult',
      occupation_or_role: isNF ? 'case_study | concept | event | person' : 'role TBD',
      wound: isNF ? `Central question ${storyNumber}` : `private wound ${storyNumber}`,
      want: isNF ? `distinct angle ${storyNumber}` : `clear desire ${storyNumber}`,
      defining_trait: isNF ? `key insight ${storyNumber}` : `defining trait ${storyNumber}`,
    },
    setting: {
      location: fandom,
      time_period: project.canon_mode || 'project-defined',
      sensory_anchor: isNF ? `Opening fact or scene for chapter ${storyNumber}` : `Sensory opening image for story ${storyNumber}`,
    },
    conflict: isNF ? `Evidence tension or debate for chapter ${storyNumber}` : `Central conflict for story ${storyNumber}`,
    twist_or_turn: isNF ? `Counterintuitive insight for chapter ${storyNumber}` : `Meaningful reversal for story ${storyNumber}`,
    ending_type: isNF ? 'synthesis' : variety.ending_shape,
    setting_type: variety.setting_type,
    conflict_engine: variety.conflict_engine,
    power_dynamic: variety.power_dynamic,
    escalation_shape: variety.escalation_shape,
    emotional_arc: variety.emotional_arc,
    ending_shape: variety.ending_shape,
    thematic_angle: `Unique angle ${storyNumber} on ${theme}`, 
    pov: isNF ? 'editorial' : (project.pov_mode || 'third-close'),
    tense: isNF ? 'mixed' : (project.tense || 'past'),
    tone: project.author_voice || project.genre || '',
    estimated_words: words,
  };
}

function normalizeGeneratedStories(project, rawStories, startNum, expectedCount, usedKeys) {
  const normalized = [];
  const source = Array.isArray(rawStories) ? rawStories : [];

  for (const raw of source) {
    if (!raw || typeof raw !== 'object') continue;
    const nextNum = startNum + normalized.length;
    const fallback = makeFallbackStory(project, nextNum);
    const story = compactStory({ ...raw, story_number: nextNum }, fallback);

    if (isPlaceholderishStory(story)) {
      console.warn('[ANTHOLOGY-BATCH] Rejected placeholder/instruction-dump story:', nextNum, story.title);
      continue;
    }

    const key = `${story.title.toLowerCase()}|${story.premise.toLowerCase().slice(0, 180)}|${story.thematic_angle.toLowerCase().slice(0, 120)}`;
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);

    normalized.push(story);
    if (normalized.length >= expectedCount) break;
  }

  return normalized;
}

async function generateSingleStory(project, storyNumber, usedNames, usedAngles, usedTitles) {
  const prompt = buildBatchPrompt(project, storyNumber, storyNumber, usedNames, usedAngles, usedTitles, [])
    + `\n\nIMPORTANT: This is a single-entry repair generation. Return exactly ONE valid story in the stories array. Do not return placeholders. Do not paste the user seed instructions into any field.`;

  const response = await withTimeout(invokeLLMWithRetry({
    prompt,
    response_json_schema: batchStorySchema,
    model: pickModel('foundation', project),
    spec: project,
    fallback_model: pickFallbackModel('foundation', project),
    max_tokens: 4096,
    task_type: 'foundation',
  }, 2), Math.min(BATCH_TIMEOUT_MS, 90000), `Anthology story ${storyNumber}`);

  const result = unwrapIntegrationResult(response);
  return Array.isArray(result?.stories) ? result.stories : [];
}

export function hasInvalidAnthologyStories(stories) {
  return !Array.isArray(stories) || stories.length === 0 || stories.some(isPlaceholderishStory);
}

function buildBatchPrompt(project, startNum, endNum, usedNames, usedAngles, usedTitles, usedTemplates = []) {
  const theme = deriveCleanAnthologyTheme(project);
  const themeType = project.anthology_theme_type || 'topic';
  const variety = project.anthology_variety || 'high';
  const genre = project.genre || 'Fiction';
  const storyLength = project.anthology_story_length || 'short';
  const lengthInfo = ANTHOLOGY_STORY_LENGTHS[storyLength] || ANTHOLOGY_STORY_LENGTHS.short;
  const spiceLevel = Number(project.spice_level || 0);
  const violenceLevel = Number(project.violence_level || 0);
  const languageIntensity = Number(project.language_intensity || 2);
  const totalStories = Number(project.chapter_target) || 12;
  const isNF = isNonfictionAnthology(project);
  const numTwists = Number(project.num_twists ?? project.twist_count ?? 1);
  const twistIntensity = project.twist_intensity || 'moderate';
  const isFanfic = project.content_lane === 'fanfiction' || project.rights_mode === 'fanfiction_noncommercial';

  const varietyGuide = {
    consistent: 'Same POV type, tense, tone, and narrative approach.',
    moderate: 'Same genre and overall tone but varied POVs, tense, and intensity.',
    high: 'Each story should feel like a different facet of the theme. Vary POV, tense, tone, structure.',
  };

  const nameBlock = usedNames.length > 0
    ? `\nPROTAGONIST NAMES ALREADY USED (do NOT reuse any of these — choose completely different, phonetically distinct names):\n${usedNames.join(', ')}\n`
    : '';

  const angleBlock = usedAngles.length > 0
    ? `\nTHEMATIC ANGLES ALREADY USED (each new entry MUST have a UNIQUE angle different from all of these):\n${usedAngles.map((a, i) => `Entry ${i + 1}: ${a}`).join('\n')}\n`
    : '';

  const titleBlock = usedTitles && usedTitles.length > 0
    ? `\nTITLES ALREADY GENERATED (do NOT duplicate these premises or concepts):\n${usedTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`
    : '';

  const fanficBlock = isFanfic ? `\nFANFICTION / SHARED-UNIVERSE CONTEXT:\n- Source/Fandom: ${project.fandom_name || project.source_universe || 'user-defined fandom'}\n- Canon mode: ${project.canon_mode || 'user-defined'}\n- Posting target: ${project.fanfic_posting_target || 'unspecified'}\n- Rights mode: noncommercial fanfiction unless the user changed Setup.\n- Respect canon boundaries. Do NOT use public-domain/original-market assumptions.\n- Each anthology entry still needs a standalone arc.\n` : '';

  const varietyBlock = buildAnthologyVarietyOutlinePromptBlock({ startNum, endNum, usedTemplates });

  const batchCount = endNum - startNum + 1;

  if (isNF) {
    return `You are generating chapter outlines for a NONFICTION ANTHOLOGY.

PROJECT BRIEF:
${buildProjectBrief(project)}

PROJECT BRIEF:
${buildProjectBrief(project)}

COLLECTION: "${theme}" — ${genre}
Theme Type: ${themeType}
Variety: ${variety} — ${varietyGuide[variety] || varietyGuide.high}
Chapter Length: ${storyLength} (${lengthInfo.nfInstruction || lengthInfo.instruction})
Language Intensity: ${languageIntensity}
Total collection: ${totalStories} chapters. Generate chapters ${startNum} through ${endNum} (${batchCount} chapters).
${nameBlock}${angleBlock}${titleBlock}
${varietyBlock}
Generate EXACTLY ${batchCount} chapter outlines numbered ${startNum} to ${endNum}.

Each chapter must be a STANDALONE essay/investigation with a unique subject and angle.

RULES:
1. No duplicate angles.
2. Vary subjects, evidence types, opening hooks, and conclusions.
3. protagonist.name = the specific subject: person, event, concept, place, or organization.
4. setting.sensory_anchor must be a scene/fact/question, not a thesis label.
5. Keep each outline concise enough to avoid truncation.

Return JSON only. No markdown, no backticks. The stories array must have exactly ${batchCount} entries.`;
  }

  return `You are generating story outlines for a FICTION ANTHOLOGY — standalone short stories unified by one theme.

PROJECT BRIEF:
${buildProjectBrief(project)}

COLLECTION: "${theme}" — ${genre}
Theme Type: ${themeType}
Variety: ${variety} — ${varietyGuide[variety] || varietyGuide.high}
Story Length: ${storyLength} (${lengthInfo.instruction})
Language Intensity: ${languageIntensity} | Spice Level: ${spiceLevel} | Violence Level: ${violenceLevel}
Beat Style: ${project.beat_style || 'Auto-select per story'}
Twists per story: ${numTwists} at ${twistIntensity} intensity
Total collection: ${totalStories} stories. Generate stories ${startNum} through ${endNum} (${batchCount} stories).
${fanficBlock}${nameBlock}${angleBlock}${titleBlock}
${varietyBlock}
Generate EXACTLY ${batchCount} story outlines numbered ${startNum} to ${endNum}.

Each story must have:
- Unique protagonist, want, wound, and defining trait
- Unique setting and sensory anchor
- Complete standalone arc: setup → conflict → turn → ending
- Unique thematic angle connected to the collection theme
- Unique variety fields: setting_type, conflict_engine, power_dynamic, escalation_shape, emotional_arc, ending_shape

CRITICAL RULES:
0. Do NOT paste, summarize, or reprint the raw seed/prompt instructions into title, premise, conflict, thematic_angle, or protagonist fields. Convert instructions into a specific story concept.
1. Do NOT reuse the same protagonist, scenario, premise, conflict, or ending shape.
2. No two protagonists should feel like palette swaps.
3. Settings must vary${themeType === 'setting' ? ' within the shared location constraint' : ''}.
4. The premise must describe a story arc, not a topic.
5. Keep outlines concise enough to avoid provider truncation.
${themeType === 'connected' ? '6. Connected-universe mode: minor cameos are allowed, but each story still stands alone.' : ''}
${spiceLevel >= 1 ? `7. Include romantic/sexual tension integral to the conflict. Spice ${spiceLevel}/4.` : ''}
${violenceLevel >= 1 ? `8. Include violence/action appropriate to the conflict. Violence ${violenceLevel}/5.` : ''}

Return JSON only. No markdown, no backticks. The stories array must have exactly ${batchCount} entries.`;
}

/**
 * Rebuild outline_md from a full array of story objects.
 */
export function rebuildAnthologyOutlineMd(stories) {
  let md = '# Story Concepts\n\n';
  for (const story of stories || []) {
    md += '---\n\n';
    md += '## Story ' + story.story_number + ': ' + (story.title || 'Untitled') + '\n\n';
    md += '**Premise:** ' + (story.premise || '') + '\n\n';
    md += '**Protagonist:** ' + (story.protagonist?.name || '?') + ' — ' + (story.protagonist?.age || '?') + ', ' + (story.protagonist?.occupation_or_role || '?') + '\n';
    md += '- Wound: ' + (story.protagonist?.wound || '') + '\n';
    md += '- Want: ' + (story.protagonist?.want || '') + '\n';
    md += '- Defining trait: ' + (story.protagonist?.defining_trait || '') + '\n\n';
    md += '**Setting:** ' + (story.setting?.location || '?') + ', ' + (story.setting?.time_period || '?') + '\n';
    md += '- Sensory anchor: ' + (story.setting?.sensory_anchor || '') + '\n\n';
    md += '**Conflict:** ' + (story.conflict || '') + '\n\n';
    md += '**Twist/Turn:** ' + (story.twist_or_turn || '') + '\n\n';
    md += '**Ending:** ' + (story.ending_type || story.ending_shape || '') + '\n\n';
    md += '**Variety Template:** ' + summarizeTemplateSignature(story) + '\n';
    md += '- Setting type: ' + (story.setting_type || '') + '\n';
    md += '- Conflict engine: ' + (story.conflict_engine || '') + '\n';
    md += '- Power dynamic: ' + (story.power_dynamic || '') + '\n';
    md += '- Escalation shape: ' + (story.escalation_shape || '') + '\n';
    md += '- Emotional arc: ' + (story.emotional_arc || '') + '\n';
    md += '- Ending shape: ' + (story.ending_shape || story.ending_type || '') + '\n\n';
    md += '**Thematic Angle:** ' + (story.thematic_angle || '') + '\n\n';
    md += '**POV:** ' + (story.pov || 'third-close') + ' | **Tense:** ' + (story.tense || 'past') + ' | **Tone:** ' + (story.tone || '') + '\n\n';
    md += '**Target Words:** ~' + (story.estimated_words || 3500) + '\n\n';
  }
  return md;
}

/**
 * Generate anthology story outlines in batches to avoid truncation/hangs.
 * Returns a full array. Failed/short batches are padded with recoverable placeholders
 * so Build Story Bible never sits forever with no saved result.
 */
export async function generateAnthologyOutlinesBatched(project, { onProgress } = {}) {
  const totalStories = Number(project.chapter_target) || 12;
  const batches = [];
  for (let start = 1; start <= totalStories; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, totalStories);
    batches.push({ start, end });
  }

  console.log(`[ANTHOLOGY-BATCH] Generating ${totalStories} stories in ${batches.length} batches of up to ${BATCH_SIZE}`);

  const allStories = [];
  const usedNames = [];
  const usedAngles = [];
  const usedTitles = [];
  const usedTemplates = [];
  const usedKeys = new Set();

  for (let i = 0; i < batches.length; i++) {
    const { start, end } = batches[i];
    const batchCount = end - start + 1;
    if (onProgress) onProgress(`Generating story outlines ${start}–${end} of ${totalStories}…`);
    console.log(`[ANTHOLOGY-BATCH] Batch ${i + 1}/${batches.length}: stories ${start}–${end}`);

    let rawStories = [];
    try {
      const prompt = buildBatchPrompt(project, start, end, usedNames, usedAngles, usedTitles, usedTemplates);
      const response = await withTimeout(invokeLLMWithRetry({
        prompt,
        response_json_schema: batchStorySchema,
        model: pickModel('foundation', project),
        spec: project,
        fallback_model: pickFallbackModel('foundation', project),
        max_tokens: 6144,
        task_type: 'foundation',
      }, 2), BATCH_TIMEOUT_MS, `Anthology batch ${start}-${end}`);

      const result = unwrapIntegrationResult(response);
      rawStories = Array.isArray(result?.stories) ? result.stories : [];
      console.log(`[ANTHOLOGY-BATCH] Batch ${i + 1} returned ${rawStories.length} stories (expected ${batchCount})`);
    } catch (error) {
      console.error(`[ANTHOLOGY-BATCH] Batch ${i + 1} failed/timed out. Using placeholders for ${start}-${end}.`, error?.message || error);
      rawStories = [];
    }

    let normalized = normalizeGeneratedStories(project, rawStories, start, batchCount, usedKeys);

    // If a provider returns instruction dumps or no usable items, repair one story at a time
    // instead of saving placeholder garbage to the Foundation outline.
    while (normalized.length < batchCount) {
      const storyNumber = start + normalized.length;
      try {
        if (onProgress) onProgress(`Repairing anthology outline ${storyNumber} of ${totalStories}…`);
        const singleRaw = await generateSingleStory(project, storyNumber, usedNames, usedAngles, usedTitles);
        const repaired = normalizeGeneratedStories(project, singleRaw, storyNumber, 1, usedKeys);
        if (repaired.length) {
          normalized.push(repaired[0]);
        } else {
          throw new Error(`Story ${storyNumber} repair returned no valid story`);
        }
      } catch (repairErr) {
        console.error(`[ANTHOLOGY-BATCH] Story ${storyNumber} repair failed.`, repairErr?.message || repairErr);
        throw new Error(`Anthology outline generation failed at story ${storyNumber}. The model returned placeholders/instruction dumps instead of a usable story concept. Nothing was saved; try Build Story Bible again or shorten the seed concept.`);
      }
    }

    for (const story of normalized) {
      allStories.push(story);
      if (story.protagonist?.name) usedNames.push(story.protagonist.name);
      if (story.thematic_angle) usedAngles.push(story.thematic_angle);
      if (story.title) usedTitles.push(story.title);
      const template = summarizeTemplateSignature(story);
      if (template) usedTemplates.push(template);
    }
  }

  const finalStories = allStories.slice(0, totalStories);
  if (hasInvalidAnthologyStories(finalStories) || finalStories.length < totalStories) {
    throw new Error('Anthology outline generation produced invalid or incomplete story concepts. Nothing was saved.');
  }
  console.log(`[ANTHOLOGY-BATCH] Total valid stories generated: ${finalStories.length}/${totalStories}`);
  return finalStories;
}
