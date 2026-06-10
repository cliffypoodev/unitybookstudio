/**
 * Per-Volume Bible & Boundary Contracts
 *
 * Each volume in a series gets its own bible snapshot capturing:
 *   - State of the world at the END of that volume
 *   - Entry contract (what the previous volume handed off)
 *   - Exit contract (what the next volume must receive)
 *
 * When rewriting a volume, the generation prompts receive both contracts
 * so the prose stays cohesive with adjacent volumes.
 *
 * Data is stored on the NovelProject entity using these fields (auto-created):
 *   - volume_bible_json: the full per-volume bible
 *   - entry_contract_json: what this volume expects to receive
 *   - exit_contract_json: what this volume delivers to the next
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { resolveChapterContent } from '@/lib/chapterStorage';
import { base44 } from '@/api/base44Client';

/**
 * Extract a per-volume bible from a project's chapter content.
 * Analyzes the manuscript to capture the world state at the end of this volume.
 *
 * @param {object} project - NovelProject record
 * @param {Array} chapters - Chapter records for this project
 * @param {function} onProgress - progress callback
 * @returns {Promise<{volumeBible: object, entryContract: object, exitContract: object}>}
 */
export async function extractVolumeBible(project, chapters, onProgress) {
  onProgress?.('Loading chapter content…');

  // Load first 3 chapters + last 3 chapters (captures opening state and closing state)
  const sorted = [...chapters].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  const openingChapters = sorted.slice(0, 3);
  const closingChapters = sorted.slice(-3);
  const midChapter = sorted[Math.floor(sorted.length / 2)];

  let openingText = '';
  for (const ch of openingChapters) {
    const content = await resolveChapterContent(ch);
    if (content) {
      const words = content.split(/\s+/);
      openingText += `\n=== Ch.${ch.chapter_number}: ${ch.title || ''} ===\n${words.slice(0, 400).join(' ')}\n`;
    }
  }

  let closingText = '';
  for (const ch of closingChapters) {
    const content = await resolveChapterContent(ch);
    if (content) {
      const words = content.split(/\s+/);
      closingText += `\n=== Ch.${ch.chapter_number}: ${ch.title || ''} ===\n${words.slice(-500).join(' ')}\n`;
    }
  }

  let midText = '';
  if (midChapter) {
    const content = await resolveChapterContent(midChapter);
    if (content) {
      const words = content.split(/\s+/);
      midText = `\n=== Ch.${midChapter.chapter_number}: ${midChapter.title || ''} (midpoint) ===\n${words.slice(0, 300).join(' ')}\n[...]\n${words.slice(-300).join(' ')}\n`;
    }
  }

  if (!openingText && !closingText) {
    throw new Error('No chapter content found');
  }

  onProgress?.('Extracting volume bible…');

  const prompt = `You are a series continuity editor analyzing a single volume in a book series. Extract a precise state snapshot.

BOOK: "${project.title || 'Untitled'}" (Book ${project.series_number || '?'} in "${project.series_name || 'series'}")
GENRE: ${project.genre || 'fiction'}

OPENING CHAPTERS (how this book starts):
${openingText}

MIDPOINT:
${midText}

CLOSING CHAPTERS (how this book ends):
${closingText}

Extract THREE things. Return JSON only, no markdown wrapping.

{
  "volume_bible": {
    "characters_at_end": [
      {"name": "", "status": "alive|dead|unknown|transformed", "physical_state": "injuries, changes", "emotional_state": "where they are emotionally at the end", "key_relationships": "with whom, status of relationship", "arc_position": "what they learned or how they changed"}
    ],
    "threads_opened": ["thread descriptions — plots, mysteries, questions introduced in THIS volume"],
    "threads_closed": ["thread descriptions — plots resolved in THIS volume"],
    "threads_ongoing": ["threads that were open before this volume and remain open"],
    "world_state_at_end": "state of the world/setting at the end of this volume",
    "key_events": ["major events that happened in this volume, in order"],
    "items_and_artifacts": ["objects, weapons, tech, artifacts introduced or consumed"],
    "locations_introduced": ["new locations that appear in this volume"],
    "tone_and_style": "brief description of this volume's tone",
    "last_scene_summary": "detailed summary of the final scene — what happens, who is there, what state they're in"
  },
  "entry_contract": {
    "description": "What state the world must be in at the START of this volume",
    "characters_required_alive": ["names"],
    "characters_required_dead": ["names"],
    "threads_that_must_be_open": ["threads this book picks up from previous"],
    "world_facts_assumed": ["facts this book assumes are true from previous volumes"],
    "emotional_state_of_protagonist": "where the protagonist is emotionally at the start"
  },
  "exit_contract": {
    "description": "What state the world is in at the END of this volume — the next volume must honor all of this",
    "characters_alive": ["names"],
    "characters_dead": ["names"],
    "threads_open_for_next": ["unresolved threads the next volume should pick up"],
    "threads_closed": ["threads resolved — next volume must NOT reopen these"],
    "world_state_facts": ["facts about the world that are now true"],
    "cliffhangers": ["promises made to the reader that the next volume must address"],
    "emotional_state_of_protagonist": "where the protagonist is emotionally at the end"
  }
}`;

  const result = await invokeLLMWithRetry({
    task_type: 'foundation',
    prompt,
    model: 'gemini_3_flash',
    fallback_model: 'deepseek/deepseek-chat-v3-0324',
    temperature: 0.15,
    max_tokens: 3000,
  });

  let parsed = {};
  try {
    const raw = typeof result === 'string' ? result : (result?.text || JSON.stringify(result));
    parsed = JSON.parse(raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
  } catch (e) {
    throw new Error('Failed to parse volume bible extraction: ' + e.message);
  }

  return {
    volumeBible: parsed.volume_bible || {},
    entryContract: parsed.entry_contract || {},
    exitContract: parsed.exit_contract || {},
  };
}

/**
 * Save extracted volume bible to the project entity.
 */
export async function saveVolumeBible(projectId, volumeBible, entryContract, exitContract) {
  await base44.entities.NovelProject.update(projectId, {
    volume_bible_json: JSON.stringify(volumeBible),
    entry_contract_json: JSON.stringify(entryContract),
    exit_contract_json: JSON.stringify(exitContract),
  });
}

/**
 * Load volume bible from a project entity.
 * Returns null if no volume bible has been extracted yet.
 */
export function loadVolumeBible(project) {
  if (!project.volume_bible_json) return null;
  try {
    return {
      volumeBible: JSON.parse(project.volume_bible_json),
      entryContract: project.entry_contract_json ? JSON.parse(project.entry_contract_json) : {},
      exitContract: project.exit_contract_json ? JSON.parse(project.exit_contract_json) : {},
    };
  } catch (e) {
    return null;
  }
}

/**
 * Build a rewrite constraint block for the prose writer.
 * Injects both the entry contract (from previous volume) and exit contract
 * (for next volume) so the rewritten prose stays cohesive with the series.
 *
 * @param {object} entryContract - what the previous volume handed off
 * @param {object} exitContract - what the next volume expects to receive
 * @param {number} chapterNumber - current chapter being written
 * @param {number} totalChapters - total chapters in this volume
 * @returns {string} - prompt block to inject into the prose writer
 */
export function buildVolumeContractBlock(entryContract, exitContract, chapterNumber, totalChapters) {
  if (!entryContract && !exitContract) return '';

  const progress = chapterNumber / totalChapters;
  let block = '\n=== SERIES CONTINUITY CONTRACTS (MANDATORY) ===\n';
  block += 'This volume is being rewritten to fit seamlessly between adjacent volumes in the series.\n';
  block += 'You MUST honor both contracts below. Violating either contract breaks series continuity.\n\n';

  if (entryContract && Object.keys(entryContract).length > 0) {
    block += 'ENTRY CONTRACT (what the previous volume delivered — your starting state):\n';
    if (entryContract.description) block += entryContract.description + '\n';
    if (entryContract.characters_required_alive?.length) block += 'Characters who MUST be alive: ' + entryContract.characters_required_alive.join(', ') + '\n';
    if (entryContract.characters_required_dead?.length) block += 'Characters who MUST be dead: ' + entryContract.characters_required_dead.join(', ') + '\n';
    if (entryContract.threads_that_must_be_open?.length) block += 'Open threads to pick up: ' + entryContract.threads_that_must_be_open.join('; ') + '\n';
    if (entryContract.world_facts_assumed?.length) block += 'World facts assumed true: ' + entryContract.world_facts_assumed.join('; ') + '\n';
    if (entryContract.emotional_state_of_protagonist) block += 'Protagonist emotional state at start: ' + entryContract.emotional_state_of_protagonist + '\n';
    block += '\n';
  }

  if (exitContract && Object.keys(exitContract).length > 0) {
    block += 'EXIT CONTRACT (what the next volume expects — your ending state):\n';
    if (exitContract.description) block += exitContract.description + '\n';
    if (exitContract.characters_alive?.length) block += 'Characters who MUST be alive at end: ' + exitContract.characters_alive.join(', ') + '\n';
    if (exitContract.characters_dead?.length) block += 'Characters who MUST be dead at end: ' + exitContract.characters_dead.join(', ') + '\n';
    if (exitContract.threads_open_for_next?.length) block += 'Threads that must be OPEN at end: ' + exitContract.threads_open_for_next.join('; ') + '\n';
    if (exitContract.threads_closed?.length) block += 'Threads that must be CLOSED at end: ' + exitContract.threads_closed.join('; ') + '\n';
    if (exitContract.cliffhangers?.length) block += 'Cliffhangers/promises to deliver: ' + exitContract.cliffhangers.join('; ') + '\n';
    if (exitContract.emotional_state_of_protagonist) block += 'Protagonist emotional state at end: ' + exitContract.emotional_state_of_protagonist + '\n';
    block += '\n';
  }

  // Position-aware guidance
  if (progress <= 0.15) {
    block += 'POSITION: Opening chapters. Establish the entry contract state. Show the protagonist in the emotional state specified above. Pick up open threads naturally.\n';
  } else if (progress >= 0.85) {
    block += 'POSITION: Final chapters. Deliver the exit contract. Close the threads that must be closed. Leave open what must stay open. Land the protagonist in the specified emotional state.\n';
  } else {
    block += 'POSITION: Mid-volume. Drive the story forward. Do not resolve exit-contract threads yet — build toward them.\n';
  }

  block += '=== END CONTRACTS ===\n';
  return block;
}

/**
 * Extract volume bibles for ALL volumes in a series.
 * Returns a map of volume_number → { volumeBible, entryContract, exitContract }
 *
 * @param {Array} projects - all NovelProject records in this series, sorted by series_number
 * @param {function} onProgress - progress callback
 * @returns {Promise<Map<number, object>>}
 */
export async function extractAllVolumeBibles(projects, onProgress) {
  const result = new Map();

  for (let i = 0; i < projects.length; i++) {
    const proj = projects[i];
    const volNum = proj.series_number || (i + 1);
    onProgress?.(`Extracting bible for Book ${volNum}: "${proj.title || 'Untitled'}"…`);

    try {
      let chapters = [];
      try {
        chapters = (await base44.entities.Chapter.filter({ project_id: proj.id }))
          .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
      } catch (e) {
        // Fallback
        try {
          chapters = (await base44.entities.Chapter.list())
            .filter(c => c.project_id === proj.id)
            .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
        } catch (e2) { /* no chapters */ }
      }

      if (chapters.length === 0) {
        result.set(volNum, { volumeBible: { note: 'No chapters found' }, entryContract: {}, exitContract: {} });
        continue;
      }

      const extraction = await extractVolumeBible(proj, chapters, (msg) => {
        onProgress?.(`Book ${volNum}: ${msg}`);
      });

      result.set(volNum, extraction);

      // Save to the project entity
      await saveVolumeBible(proj.id, extraction.volumeBible, extraction.entryContract, extraction.exitContract);

    } catch (err) {
      console.warn('[VOL-BIBLE] Failed for Book ' + volNum + ':', err.message);
      result.set(volNum, { volumeBible: { error: err.message }, entryContract: {}, exitContract: {} });
    }
  }

  return result;
}

/**
 * Get the entry contract for a volume by loading the EXIT contract
 * of the previous volume.
 *
 * @param {Array} projects - sorted series projects
 * @param {number} volumeNumber - the volume being rewritten
 * @returns {object|null} - the entry contract (previous volume's exit)
 */
export function getEntryContractForVolume(projects, volumeNumber) {
  const prevVol = projects.find(p => (p.series_number || 0) === volumeNumber - 1);
  if (!prevVol) return null; // First volume — no entry contract
  const bible = loadVolumeBible(prevVol);
  return bible?.exitContract || null;
}

/**
 * Get the exit contract for a volume by loading the ENTRY contract
 * of the next volume.
 *
 * @param {Array} projects - sorted series projects
 * @param {number} volumeNumber - the volume being rewritten
 * @returns {object|null} - the exit contract (next volume's entry)
 */
export function getExitContractForVolume(projects, volumeNumber) {
  const nextVol = projects.find(p => (p.series_number || 0) === volumeNumber + 1);
  if (!nextVol) return null; // Last volume — no exit contract
  const bible = loadVolumeBible(nextVol);
  return bible?.entryContract || null;
}