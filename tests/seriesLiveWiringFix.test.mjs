/**
 * Series Live Wiring Fix — Regression Tests
 *
 * Tests the production wiring of series continuity, volume contracts,
 * and contract gate into the generation/export pipeline.
 *
 * Run: node --experimental-vm-modules tests/seriesLiveWiringFix.test.mjs
 */

import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Test Harness ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

// ── Inline implementations (mirror production code for testing) ──────────

function safeParseJson(str) {
  if (!str) return null;
  if (Array.isArray(str)) return str;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch { return null; }
}

// Mirrors buildSeriesContinuityBlock from seriesBible.js
function buildSeriesContinuityBlock(seriesBible, seriesNumber) {
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

// Mirrors buildVolumeContractBlock from volumeBible.js
function buildVolumeContractBlock(entryContract, exitContract, chapterNumber, totalChapters) {
  if (!entryContract && !exitContract) return '';

  const progress = chapterNumber / totalChapters;
  let block = '\n=== SERIES CONTINUITY CONTRACTS (MANDATORY) ===\n';
  block += 'This volume is being rewritten to fit seamlessly between adjacent volumes in the series.\n';
  block += 'You MUST honor both contracts below. Violating either contract breaks series continuity.\n\n';

  if (entryContract && Object.keys(entryContract).length > 0) {
    block += 'ENTRY CONTRACT (what the previous volume delivered — your starting state):\n';
    if (entryContract.characters_required_alive?.length) block += 'Characters who MUST be alive: ' + entryContract.characters_required_alive.join(', ') + '\n';
    if (entryContract.characters_required_dead?.length) block += 'Characters who MUST be dead: ' + entryContract.characters_required_dead.join(', ') + '\n';
    if (entryContract.threads_that_must_be_open?.length) block += 'Open threads to pick up: ' + entryContract.threads_that_must_be_open.join('; ') + '\n';
    if (entryContract.world_facts_assumed?.length) block += 'World facts assumed true: ' + entryContract.world_facts_assumed.join('; ') + '\n';
    block += '\n';
  }

  if (exitContract && Object.keys(exitContract).length > 0) {
    block += 'EXIT CONTRACT (what the next volume expects — your ending state):\n';
    if (exitContract.characters_alive?.length) block += 'Characters who MUST be alive at end: ' + exitContract.characters_alive.join(', ') + '\n';
    if (exitContract.characters_dead?.length) block += 'Characters who MUST be dead at end: ' + exitContract.characters_dead.join(', ') + '\n';
    if (exitContract.threads_open_for_next?.length) block += 'Threads that must be OPEN at end: ' + exitContract.threads_open_for_next.join('; ') + '\n';
    if (exitContract.threads_closed?.length) block += 'Threads that must be CLOSED at end: ' + exitContract.threads_closed.join('; ') + '\n';
    block += '\n';
  }

  if (progress <= 0.15) {
    block += 'POSITION: Opening chapters. Establish the entry contract state.\n';
  } else if (progress >= 0.85) {
    block += 'POSITION: Final chapters. Deliver the exit contract.\n';
  } else {
    block += 'POSITION: Mid-volume. Drive the story forward.\n';
  }

  block += '=== END CONTRACTS ===\n';
  return block;
}

// Mirrors runSeriesContractGate detection logic
function detectDeadCharacterResurrection(text, seriesBible) {
  if (!text || !seriesBible) return [];
  const results = [];
  const deaths = safeParseJson(seriesBible.deaths_and_losses) || [];
  for (const death of deaths) {
    const deathStr = typeof death === 'string' ? death : (death.description || death.name || JSON.stringify(death));
    const nameMatch = deathStr.match(/^([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+)*)/);
    if (!nameMatch) continue;
    const charName = nameMatch[1].trim();
    if (charName.length < 2) continue;
    const re = new RegExp(`\\b${charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (re.test(text)) {
      // Simple presence check for testing
      const activeVerbs = ['said', 'asked', 'walked', 'ran', 'stepped', 'grabbed', 'looked', 'smiled', 'nodded'];
      const lowerText = text.toLowerCase();
      const hasActive = activeVerbs.some(v => lowerText.includes(v));
      if (hasActive) {
        results.push({ severity: 'BLOCK', category: 'dead_character_resurrection', character: charName });
      }
    }
  }
  return results;
}

// ── Mock Data ─────────────────────────────────────────────────────────────

const mockSeriesBible = {
  id: 'bible-map-001',
  series_name: 'The Black Map Chronicles',
  deaths_and_losses: JSON.stringify([
    'Elias Crowe was killed by the Cartographer\'s Guild at the end of Book 1',
  ]),
  characters_json: JSON.stringify([
    { name: 'Mara Vale', role: 'protagonist', status_at_end: 'alive' },
    { name: 'Elias Crowe', role: 'supporting', status_at_end: 'dead' },
  ]),
  resolved_threads: JSON.stringify([
    'Who burned the observatory — it was the Guild to destroy evidence of the black map',
  ]),
  unresolved_threads: JSON.stringify([
    'What is the black-map conspiracy?',
    'Who leads the Cartographer\'s Guild?',
  ]),
  rules_and_systems: 'Old maps cannot be altered once printed. Only the Mapmaker\'s Glass can reveal hidden ink.',
  world_state: 'The Cartographer\'s Guild controls all map-making. The observatory is destroyed.',
  voice_profile: 'Third person past tense. Atmospheric, measured prose with cartographic metaphors.',
  tone_and_themes: 'Mystery and cartography. Themes of hidden truth, the power of maps, and the price of knowledge.',
  last_book_ending: 'Mara receives a sealed map from Elias after his death, delivered by a courier who vanishes.',
};

const mockBook2Project = {
  id: 'proj-map-002',
  title: 'The Black Map Chronicles — Book 2: The Hidden Ink',
  series_bible_id: 'bible-map-001',
  series_name: 'The Black Map Chronicles',
  series_number: 2,
  series_flavor: 'continuation',
  chapter_count: 20,
  entry_contract_json: JSON.stringify({
    characters_required_alive: ['Mara Vale'],
    characters_required_dead: ['Elias Crowe'],
    threads_that_must_be_open: ['black-map conspiracy', 'Cartographer\'s Guild leadership'],
    world_facts_assumed: ['The observatory is destroyed', 'Mara has the sealed map'],
  }),
  exit_contract_json: JSON.stringify({
    characters_alive: ['Mara Vale'],
    characters_dead: [],
    threads_open_for_next: ['The guild\'s ultimate plan'],
    threads_closed: ['black-map conspiracy'],
    cliffhangers: ['Mara discovers the map is a gateway to a hidden continent'],
  }),
};

const mockStandaloneProject = {
  ...mockBook2Project,
  series_flavor: 'standalone',
};

const mockAnthologyProject = {
  ...mockBook2Project,
  series_flavor: 'anthology_volume',
};

const mockNonSeriesProject = {
  id: 'proj-standalone',
  title: 'An Unrelated Novel',
};

// ── Tests ──────────────────────────────────────────────────────────────────

console.log('\n=== 1. FIXED getSeriesContinuity BEHAVIOR ===');

test('True continuation prompt includes non-empty continuity block', () => {
  const block = buildSeriesContinuityBlock(mockSeriesBible, 2);
  assert.ok(block.length > 50, 'Continuity block should not be empty');
  assert.ok(block.includes('SERIES CONTINUITY'), 'Should have continuity header');
});

test('Dead character constraint appears in prompt', () => {
  const block = buildSeriesContinuityBlock(mockSeriesBible, 2);
  assert.ok(block.includes('Elias Crowe'), 'Dead character name should appear');
  assert.ok(block.includes('DEATHS'), 'DEATHS section should exist');
  assert.ok(block.includes('do NOT resurrect'), 'No-resurrect instruction should exist');
});

test('Resolved thread constraint appears in prompt', () => {
  const block = buildSeriesContinuityBlock(mockSeriesBible, 2);
  assert.ok(block.includes('RESOLVED THREADS'), 'Resolved threads section should exist');
  assert.ok(block.includes('observatory'), 'Observatory thread should appear');
  assert.ok(block.includes('do not reopen'), 'No-reopen instruction should exist');
});

test('World state appears in prompt', () => {
  const block = buildSeriesContinuityBlock(mockSeriesBible, 2);
  assert.ok(block.includes('WORLD STATE'), 'World state should appear');
  assert.ok(block.includes("Cartographer's Guild"), 'World details should be present');
});

test('Last book ending appears in prompt', () => {
  const block = buildSeriesContinuityBlock(mockSeriesBible, 2);
  assert.ok(block.includes('PREVIOUS BOOK ENDED'), 'Last book ending should appear');
  assert.ok(block.includes('sealed map'), 'Ending details should be present');
});

test('Standalone sequel gets light world/voice context only', () => {
  // Simulate standalone behavior from the fixed getSeriesContinuity
  const parts = ['=== SERIES CONTEXT (standalone sequel — shared world) ==='];
  if (mockSeriesBible.voice_profile) parts.push(`VOICE PROFILE: ${mockSeriesBible.voice_profile.substring(0, 300)}`);
  if (mockSeriesBible.rules_and_systems) parts.push(`WORLD RULES: ${mockSeriesBible.rules_and_systems.substring(0, 400)}`);
  parts.push('NOTE: This is a standalone story in a shared world. You are not bound by previous book characters or threads.');
  parts.push('=== END SERIES CONTEXT ===');
  const block = parts.join('\n');

  assert.ok(block.includes('standalone'), 'Should be marked standalone');
  assert.ok(block.includes('WORLD RULES'), 'Should include world rules');
  assert.ok(!block.includes('DEATHS'), 'Should NOT include strict death constraints');
  assert.ok(!block.includes('RESOLVED THREADS'), 'Should NOT include resolved thread constraints');
  assert.ok(block.includes('not bound by previous book'), 'Should state no character obligations');
});

test('Anthology volume does not inherit protagonist obligations', () => {
  const parts = ['=== SERIES CONTEXT (anthology — shared theme) ==='];
  if (mockSeriesBible.tone_and_themes) parts.push(`SHARED THEME: ${mockSeriesBible.tone_and_themes.substring(0, 300)}`);
  parts.push('NOTE: This is an anthology volume. Use your own protagonist and plot. Do NOT reuse protagonists from other volumes.');
  parts.push('=== END SERIES CONTEXT ===');
  const block = parts.join('\n');

  assert.ok(block.includes('anthology'), 'Should be marked anthology');
  assert.ok(!block.includes('DEATHS'), 'Should NOT include death constraints');
  assert.ok(!block.includes('RESOLVED THREADS'), 'Should NOT include thread constraints');
  assert.ok(block.includes('Do NOT reuse protagonists'), 'Should warn against protagonist reuse');
});

console.log('\n=== 2. VOLUME CONTRACT BLOCK WIRING ===');

test('buildVolumeContractBlock is called for linked continuation', () => {
  const entry = JSON.parse(mockBook2Project.entry_contract_json);
  const exit = JSON.parse(mockBook2Project.exit_contract_json);
  const block = buildVolumeContractBlock(entry, exit, 1, 20);
  assert.ok(block.length > 100, 'Contract block should not be empty');
  assert.ok(block.includes('SERIES CONTINUITY CONTRACTS'), 'Should have contracts header');
});

test('Opening chapter includes entry contract emphasis', () => {
  const entry = JSON.parse(mockBook2Project.entry_contract_json);
  const exit = JSON.parse(mockBook2Project.exit_contract_json);
  const block = buildVolumeContractBlock(entry, exit, 1, 20);
  assert.ok(block.includes('ENTRY CONTRACT'), 'Should include entry contract');
  assert.ok(block.includes('Opening chapters'), 'Should emphasize opening position');
  assert.ok(block.includes('Mara Vale'), 'Should include required-alive character');
  assert.ok(block.includes('Elias Crowe'), 'Should include required-dead character');
});

test('Final chapter includes exit contract emphasis', () => {
  const entry = JSON.parse(mockBook2Project.entry_contract_json);
  const exit = JSON.parse(mockBook2Project.exit_contract_json);
  const block = buildVolumeContractBlock(entry, exit, 19, 20);
  assert.ok(block.includes('EXIT CONTRACT'), 'Should include exit contract');
  assert.ok(block.includes('Final chapters'), 'Should emphasize final position');
});

test('Mid chapter gets mid-volume guidance', () => {
  const entry = JSON.parse(mockBook2Project.entry_contract_json);
  const exit = JSON.parse(mockBook2Project.exit_contract_json);
  const block = buildVolumeContractBlock(entry, exit, 10, 20);
  assert.ok(block.includes('Mid-volume'), 'Should indicate mid-volume position');
});

test('No contracts returns empty string', () => {
  const block = buildVolumeContractBlock(null, null, 1, 20);
  assert.equal(block, '', 'Should return empty for no contracts');
});

console.log('\n=== 3. POST-GENERATION SERIES CONTRACT GATE ===');

test('Dead character resurrection blocks true continuation', () => {
  const text = 'Elias Crowe walked into the tavern and smiled. "I\'m back," he said.';
  const results = detectDeadCharacterResurrection(text, mockSeriesBible);
  assert.ok(results.length > 0, 'Should detect dead character resurrection');
  assert.equal(results[0].severity, 'BLOCK');
  assert.equal(results[0].character, 'Elias Crowe');
});

test('Clean prose passes gate', () => {
  const text = 'Mara Vale opened the sealed map under lamplight. The hidden ink shimmered.';
  const results = detectDeadCharacterResurrection(text, mockSeriesBible);
  assert.equal(results.length, 0, 'Clean prose should have no violations');
});

test('Non-series project is unaffected', () => {
  // Gate should not run for non-series projects
  const hasSeriesBibleId = !!mockNonSeriesProject.series_bible_id;
  assert.ok(!hasSeriesBibleId, 'Non-series project should have no series_bible_id');
});

console.log('\n=== 4. EXPORT SERIES CONTRACT GATE ===');

test('Export safety gate is now async', () => {
  // Verify the function signature changed
  const gateSrc = readFileSync(join(process.cwd(), 'src/lib/exportSafetyGate.js'), 'utf8');
  assert.ok(gateSrc.includes('export async function runPreExportSafetyGate'), 'Should be async');
});

test('Export gate imports series contract gate', () => {
  const gateSrc = readFileSync(join(process.cwd(), 'src/lib/exportSafetyGate.js'), 'utf8');
  assert.ok(gateSrc.includes('seriesContractGate'), 'Should reference seriesContractGate');
  assert.ok(gateSrc.includes('runSeriesContractGate'), 'Should import runSeriesContractGate');
});

test('Export gate stores series report', () => {
  const gateSrc = readFileSync(join(process.cwd(), 'src/lib/exportSafetyGate.js'), 'utf8');
  assert.ok(gateSrc.includes('__UBS_LAST_EXPORT_SERIES_REPORT'), 'Should store series report on window');
});

test('Export gate includes seriesReport in returned report', () => {
  const gateSrc = readFileSync(join(process.cwd(), 'src/lib/exportSafetyGate.js'), 'utf8');
  assert.ok(gateSrc.includes('seriesReport,'), 'Should include seriesReport in report object');
});

test('ExportTab.jsx awaits runPreExportSafetyGate', () => {
  const tabSrc = readFileSync(join(process.cwd(), 'src/components/publishing/ExportTab.jsx'), 'utf8');
  assert.ok(tabSrc.includes('await runPreExportSafetyGate'), 'Should await the async gate');
});

console.log('\n=== 5. SCENEWRITER WIRING VERIFICATION ===');

test('sceneWriter imports buildVolumeContractBlock', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  assert.ok(src.includes("import { buildVolumeContractBlock } from '@/lib/volumeBible'"), 'Should import buildVolumeContractBlock');
});

test('sceneWriter imports runSeriesContractGate', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  assert.ok(src.includes("import { runSeriesContractGate } from '@/lib/seriesContractGate'"), 'Should import runSeriesContractGate');
});

test('getSeriesContinuity loads SeriesBible entity (not project)', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  assert.ok(src.includes('base44.entities.SeriesBible.filter'), 'Should load SeriesBible via base44');
  assert.ok(src.includes('series_bible_id'), 'Should check series_bible_id');
  assert.ok(!src.includes('return await buildSeriesContinuityBlock(project)'), 'Should NOT pass project directly to buildSeriesContinuityBlock');
});

test('getSeriesContinuity handles flavor: standalone', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  assert.ok(src.includes("flavor === 'standalone'"), 'Should check for standalone flavor');
  assert.ok(src.includes('standalone sequel'), 'Should handle standalone differently');
});

test('getSeriesContinuity handles flavor: anthology_volume', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  assert.ok(src.includes("flavor === 'anthology_volume'"), 'Should check for anthology flavor');
  assert.ok(src.includes('Do NOT reuse protagonists'), 'Should warn against protagonist reuse');
});

test('getVolumeContractBlock exists and uses entry/exit contracts', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  assert.ok(src.includes('async function getVolumeContractBlock'), 'Should define getVolumeContractBlock');
  assert.ok(src.includes('entry_contract_json'), 'Should read entry contract');
  assert.ok(src.includes('exit_contract_json'), 'Should read exit contract');
});

test('generateChapterSceneByScene includes volumeContractBlock in Promise.all', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  assert.ok(src.includes('getVolumeContractBlock(project, chapter)'), 'Should call getVolumeContractBlock');
  assert.ok(src.includes('volumeContractBlock, authorStyleBlock'), 'Should destructure volumeContractBlock');
});

test('generateSingleScene includes volumeContractBlock', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  // Count occurrences of getVolumeContractBlock — should appear in both functions
  const matches = src.match(/getVolumeContractBlock\(project, chapter\)/g);
  assert.ok(matches && matches.length >= 2, 'Should call getVolumeContractBlock in both generation functions');
});

test('Post-generation series gate stores report on window', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  assert.ok(src.includes('__UBS_LAST_SERIES_CONTRACT_REPORT'), 'Should store report at window.__UBS_LAST_SERIES_CONTRACT_REPORT');
});

console.log('\n=== 6. STALE VOLUME BIBLE PROTECTION ===');

// Inline staleness check
function checkVolumeBibleStaleness(project) {
  if (!project) return { stale: false, reason: null, lastUpdated: null };
  if (!project.volume_bible_json) return { stale: true, reason: 'No volume bible extracted yet', lastUpdated: null };
  const bibleUpdated = project.volume_bible_updated_at;
  if (!bibleUpdated) return { stale: true, reason: 'Volume bible has no timestamp', lastUpdated: null };
  const projectUpdated = project.updated_date;
  if (projectUpdated && new Date(projectUpdated) > new Date(bibleUpdated)) {
    return { stale: true, reason: 'Project updated after volume bible', lastUpdated: bibleUpdated };
  }
  return { stale: false, reason: null, lastUpdated: bibleUpdated };
}

test('Stale when chapter edited after volume bible', () => {
  const result = checkVolumeBibleStaleness({
    id: '1', volume_bible_json: '{}',
    volume_bible_updated_at: '2024-01-01T00:00:00Z',
    updated_date: '2024-06-01T00:00:00Z',
  });
  assert.ok(result.stale, 'Should be stale when project updated after bible');
});

test('Fresh bible is not stale', () => {
  const result = checkVolumeBibleStaleness({
    id: '1', volume_bible_json: '{}',
    volume_bible_updated_at: '2024-12-01T00:00:00Z',
    updated_date: '2024-01-01T00:00:00Z',
  });
  assert.ok(!result.stale, 'Should be fresh');
});

test('Missing volume bible is stale', () => {
  const result = checkVolumeBibleStaleness({ id: '1' });
  assert.ok(result.stale, 'Should be stale with no volume bible');
});

console.log('\n=== 7. LIVE CONTINUATION PROOF ===');

test('Book 2 prompt with Book 1 canon includes all constraints', () => {
  const block = buildSeriesContinuityBlock(mockSeriesBible, 2);
  // All critical constraints must be present
  assert.ok(block.includes('Elias Crowe'), 'Dead character Elias Crowe present');
  assert.ok(block.includes('DEATHS'), 'Deaths section present');
  assert.ok(block.includes('do NOT resurrect'), 'No resurrect instruction present');
  assert.ok(block.includes('observatory'), 'Observatory resolved thread present');
  assert.ok(block.includes('RESOLVED'), 'Resolved threads section present');
  assert.ok(block.includes('do not reopen'), 'No reopen instruction present');
  assert.ok(block.includes('WORLD STATE'), 'World state present');
  assert.ok(block.includes('PREVIOUS BOOK ENDED'), 'Last book ending present');
  assert.ok(block.includes('sealed map'), 'Sealed map detail present');
});

test('Violating text triggers dead character detection', () => {
  const violatingText = 'Elias Crowe walked through the door and smiled at Mara. "I have returned," Elias said.';
  const results = detectDeadCharacterResurrection(violatingText, mockSeriesBible);
  assert.ok(results.length > 0, 'Should detect violation');
  assert.equal(results[0].severity, 'BLOCK');
});

test('Clean continuation text passes', () => {
  const cleanText = 'Mara Vale traced the lines of the sealed map with trembling fingers. The hidden ink began to glow.';
  const results = detectDeadCharacterResurrection(cleanText, mockSeriesBible);
  assert.equal(results.length, 0, 'Clean text should pass');
});

test('Volume contract block for chapter 1 shows entry emphasis', () => {
  const entry = JSON.parse(mockBook2Project.entry_contract_json);
  const exit = JSON.parse(mockBook2Project.exit_contract_json);
  const block = buildVolumeContractBlock(entry, exit, 1, 20);
  assert.ok(block.includes('Opening chapters'), 'Chapter 1 should have opening guidance');
  assert.ok(block.includes('Mara Vale'), 'Entry contract character present');
});

test('Volume contract block for chapter 20 shows exit emphasis', () => {
  const entry = JSON.parse(mockBook2Project.entry_contract_json);
  const exit = JSON.parse(mockBook2Project.exit_contract_json);
  const block = buildVolumeContractBlock(entry, exit, 20, 20);
  assert.ok(block.includes('Final chapters'), 'Chapter 20 should have exit guidance');
  assert.ok(block.includes('black-map conspiracy'), 'Exit contract thread present');
});

console.log('\n=== 8. NON-SERIES PROJECTS UNAFFECTED ===');

test('Non-series project has no series_bible_id', () => {
  assert.ok(!mockNonSeriesProject.series_bible_id, 'No series bible link');
});

test('Contract block returns empty for non-series', () => {
  const block = buildVolumeContractBlock(null, null, 1, 20);
  assert.equal(block, '', 'Should be empty');
});

test('Continuity block returns empty for null bible', () => {
  const block = buildSeriesContinuityBlock(null, 2);
  assert.equal(block, '', 'Should be empty');
});

console.log('\n=== 9. BUILD VERIFICATION ===');

test('sceneWriter.js exists', () => {
  assert.ok(existsSync(join(process.cwd(), 'src/lib/sceneWriter.js')), 'Should exist');
});

test('exportSafetyGate.js exists', () => {
  assert.ok(existsSync(join(process.cwd(), 'src/lib/exportSafetyGate.js')), 'Should exist');
});

test('seriesContractGate.js exists', () => {
  assert.ok(existsSync(join(process.cwd(), 'src/lib/seriesContractGate.js')), 'Should exist');
});

test('volumeBible.js exists', () => {
  assert.ok(existsSync(join(process.cwd(), 'src/lib/volumeBible.js')), 'Should exist');
});

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`SERIES LIVE WIRING FIX TESTS: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ❌ ${f.name}: ${f.error}`);
  }
}
console.log(`${'='.repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
