// SCENEDELTA-1 acceptance battery (UBS_plan.md Phase 1B) — the scene delta:
// what each planned scene is FOR. Flag + derivation + entity registration
// (src/lib/sceneDelta.js), the planner prompt field (src/lib/autonovel.js,
// exercised for real via the alias loader — same technique proselab1's
// PROSELAB-1B checks use for sceneWriter.js), the compactor passthrough
// (ProjectStudio.jsx — source-shape only: it has real JSX and cannot be
// imported under bare Node, alias loader or not), and the backfill script
// (scripts/deltas-backfill.mjs). Generic fixture names only (Mara, Dov).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { register } from 'node:module';
import {
  SCENE_DELTA_VERSION,
  SCENE_DELTA_FEATURE,
  isSceneDeltaEnabled,
  buildSceneDeltaFieldBlock,
  deriveSceneDelta,
  recordSceneDelta,
} from '../src/lib/sceneDelta.js';
import {
  DELTAS_BACKFILL_VERSION,
  parseArgs,
  parsePlannedScenes,
  runDeltasBackfillCommand,
} from '../scripts/deltas-backfill.mjs';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── version + flag shape ──
check('1. SCENE_DELTA_VERSION', SCENE_DELTA_VERSION === 'scene-delta-v1');
check('2. SCENE_DELTA_FEATURE shape', SCENE_DELTA_FEATURE.key === 'scene_delta_v1' && SCENE_DELTA_FEATURE.defaultEnabled === false);
check('3. SCENE_DELTA_FEATURE is frozen', Object.isFrozen(SCENE_DELTA_FEATURE));
check('4. isSceneDeltaEnabled defaults false (no project)', isSceneDeltaEnabled(undefined) === false);
check('5. isSceneDeltaEnabled true only via project.scene_delta_flags', isSceneDeltaEnabled({ scene_delta_flags: { scene_delta_v1: true } }) === true);
check('6. an unrelated scene_execution_flags.scene_delta_v1=true does NOT enable it (separate field, DEADGATE-1 isolation)', isSceneDeltaEnabled({ scene_execution_flags: { scene_delta_v1: true } }) === false);

// ── entity registration (source scan) ──
const LOCALDB_SRC = fs.readFileSync(new URL('../src/lib/localDB.js', import.meta.url), 'utf8');
check('7. localDB.js ENTITY_STORES includes SceneDelta', /ENTITY_STORES = \[[\s\S]*?'SceneDelta'[\s\S]*?\]/.test(LOCALDB_SRC));
check('8. localDB.js entities proxy exposes SceneDelta', /SceneDelta:\s*createEntityProxy\('SceneDelta'\)/.test(LOCALDB_SRC));
const SERVER_STORE_SRC = fs.readFileSync(new URL('../vite-server-store-plugin.js', import.meta.url), 'utf8');
check('9. vite-server-store-plugin.js ENTITY_STORES includes SceneDelta', /ENTITY_STORES = \[[\s\S]*?'SceneDelta'[\s\S]*?\]/.test(SERVER_STORE_SRC));

// ── planner prompt: byte-identical with flag off, contains the field with flag on ──
register(new URL('../tests/helpers/aliasLoader.mjs', import.meta.url));
const { buildSceneBeatPrompt } = await import('../src/lib/autonovel.js');
const FIXTURE_PROJECT = { id: 'proj-fixture', title: 'Fixture', genre: 'thriller', chapter_target: 20, pov_mode: 'third-close' };
const FIXTURE_CHAPTER = { chapter_number: 1, title: 'Arrival', beat_summary: 'Mara arrives at the dock.' };
{
  const promptOff = await buildSceneBeatPrompt(FIXTURE_PROJECT, FIXTURE_CHAPTER, null, [FIXTURE_CHAPTER], '');
  const hash = crypto.createHash('sha256').update(promptOff).digest('hex');
  check(
    '10. planner prompt is byte-identical to the pre-SCENEDELTA-1 baseline with the flag off (pinned hash, cross-checked by hand against pre-change HEAD via git stash)',
    hash === '6477bce79337bebbc77a080f363993e239c5dfb37a44291db9ff7d99479e6a02',
    `got ${hash}, length ${promptOff.length}`
  );
  check('11. planner prompt does NOT contain the delta request with the flag off', !promptOff.includes('- delta:'));
}
{
  const projectOn = { ...FIXTURE_PROJECT, scene_delta_flags: { scene_delta_v1: true } };
  const promptOn = await buildSceneBeatPrompt(projectOn, FIXTURE_CHAPTER, null, [FIXTURE_CHAPTER], '');
  check('12. planner prompt contains the delta request with the flag on', promptOn.includes(buildSceneDeltaFieldBlock()));
  check('13. the delta request names all four schema fields', ['newInformation', 'stateChange', 'conflictType', 'participants'].every((f) => promptOn.includes(f)));
}

// ── compactor passthrough (ProjectStudio.jsx — source-shape; it has real
// JSX and cannot be imported under bare Node, alias loader or not) ──
const PROJECT_STUDIO_SRC = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');
check('14. compactFictionBeat rides delta along when present', /delta: \(unit\.delta && typeof unit\.delta === 'object'/.test(PROJECT_STUDIO_SRC));
check('15. a non-object/array delta is tolerated as absent (never crashes the compactor)', /delta: \(unit\.delta[\s\S]{0,600}\}\s*:\s*undefined,/.test(PROJECT_STUDIO_SRC));
check('16. compactFictionBeat never touches Chapter.scene_beats_json directly (it only builds the entity payload compactSceneBeatsForEntity returns)', !/compactFictionBeat[\s\S]{0,50}Chapter\.update/.test(PROJECT_STUDIO_SRC));

// ── deriveSceneDelta: RAISES on failure, never a silently-empty delta ──
{
  const delta = await deriveSceneDelta({
    project: {}, chapterNumber: 1, sceneIndex: 0,
    sceneBeat: { scene_goal: 'Mara confronts Dov about the ledger.' },
    callLLM: async () => ({ text: JSON.stringify({ newInformation: 'Dov knows about the ledger', stateChange: 'Mara no longer trusts Dov', conflictType: 'interpersonal_confrontation', participants: ['Mara', 'Dov'] }), finishReason: 'stop' }),
  });
  check('17. deriveSceneDelta parses a well-formed delta', delta.newInformation === 'Dov knows about the ledger' && delta.participants.join(',') === 'Mara,Dov');
}
{
  let threw = false;
  try {
    await deriveSceneDelta({ project: {}, chapterNumber: 1, sceneIndex: 0, sceneBeat: {}, callLLM: async () => ({ text: '', finishReason: null }) });
  } catch (err) { threw = /derivation FAILED/.test(err.message); }
  check('18. deriveSceneDelta RAISES on an empty completion', threw);
}
{
  let threw = false;
  try {
    await deriveSceneDelta({ project: {}, chapterNumber: 1, sceneIndex: 0, sceneBeat: {}, callLLM: async () => ({ text: 'not json', finishReason: 'stop' }) });
  } catch (err) { threw = /derivation FAILED/.test(err.message) && /malformed JSON/.test(err.message); }
  check('19. deriveSceneDelta RAISES on malformed JSON', threw);
}
{
  let threw = false;
  try {
    await deriveSceneDelta({ project: {}, chapterNumber: 1, sceneIndex: 0, sceneBeat: {}, callLLM: async () => ({ text: '{"newInformation":"x"', finishReason: 'length' }) });
  } catch (err) { threw = /derivation FAILED/.test(err.message) && /truncated/.test(err.message); }
  check('20. deriveSceneDelta RAISES on a truncation signal (finish_reason=length)', threw);
}

// ── recordSceneDelta: never touches Chapter, only SceneDelta ──
{
  const created = [];
  const doc = await recordSceneDelta({
    project: { id: 'proj-1' }, chapterId: 'ch1', chapterNumber: 1, sceneIndex: 2,
    delta: { newInformation: 'x', stateChange: 'y', conflictType: 'z', participants: ['Mara'] },
    source: 'backfill', create: async (d) => { created.push(d); },
  });
  check('21. recordSceneDelta persists through the injected create', created.length === 1 && created[0].scene_index === 2);
  check('22. recordSceneDelta output carries source: \'backfill\'', doc.source === 'backfill');
}

// ── backfill script ──
check('23. DELTAS_BACKFILL_VERSION', DELTAS_BACKFILL_VERSION === 'deltas-backfill-v1');
check('24. parseArgs parses --project', parseArgs(['--project', 'p1']).project === 'p1');
check('25. parsePlannedScenes reads the fiction {beats:[...]} shape', parsePlannedScenes({ scene_beats_json: JSON.stringify({ beats: [{ scene_id: 's1' }, { scene_id: 's2' }] }) }).length === 2);
check('26. parsePlannedScenes reads a raw array', parsePlannedScenes({ scene_beats_json: JSON.stringify([{ a: 1 }]) }).length === 1);
check('27. parsePlannedScenes tolerates a missing scene_beats_json', parsePlannedScenes({}).length === 0);
check('28. parsePlannedScenes tolerates malformed JSON (never throws)', parsePlannedScenes({ scene_beats_json: 'not json' }).length === 0);
check('29. deltas-backfill.mjs writes only SceneDelta (source scan: never Chapter.update/NovelProject.update)', !/store\.Chapter\.update|store\.NovelProject\.update/.test(fs.readFileSync(new URL('../scripts/deltas-backfill.mjs', import.meta.url), 'utf8')));

{
  const sceneDeltaEntries = [];
  const chapters = [
    { id: 'ch1', chapter_number: 1, scene_beats_json: JSON.stringify({ beats: [{ scene_id: 's1' }, { scene_id: 's2' }] }) },
    { id: 'ch2', chapter_number: 2, scene_beats_json: JSON.stringify({ beats: [{ scene_id: 's1' }] }) },
  ];
  const store = {
    NovelProject: { get: async () => ({ id: 'proj-9' }) },
    Chapter: { filter: async () => chapters },
    SceneDelta: {
      filter: async (q) => sceneDeltaEntries.filter((e) => e.chapter_id === q.chapter_id && e.source === q.source),
      create: async (doc) => { sceneDeltaEntries.push(doc); return doc; },
    },
  };
  const callOrder = [];
  const mockDerive = async ({ chapterNumber, sceneIndex }) => {
    callOrder.push(`${chapterNumber}.${sceneIndex}`);
    if (chapterNumber === 2) throw new Error('mock derive failure');
    return { newInformation: 'x', stateChange: 'y', conflictType: 'z', participants: ['Mara'] };
  };
  const report = await runDeltasBackfillCommand({
    projectId: 'proj-9', store,
    deriveSceneDelta: mockDerive, recordSceneDelta,
    pickModel: () => 'mock-model', callAgentWithMeta: async () => ({ text: '{}', finishReason: 'stop' }),
    log: () => {},
  });
  check('30. runDeltasBackfillCommand derives sequentially, scene by scene within a chapter (never Promise.all)', callOrder.join(',') === '1.0,1.1,2.0');
  check('31. a scene derivation failure is reported distinctly (chapter 2 has zero derived, chapter 1 has 2)', report.failed.length === 1 && report.failed[0].chapterNumber === 2 && report.derived.some((d) => d.chapterNumber === 1 && d.count === 2));
  check('32. backfill entries persisted carry source: \'backfill\'', sceneDeltaEntries.length === 2 && sceneDeltaEntries.every((e) => e.source === 'backfill'));

  const report2 = await runDeltasBackfillCommand({
    projectId: 'proj-9', store,
    deriveSceneDelta: mockDerive, recordSceneDelta,
    pickModel: () => 'mock-model', callAgentWithMeta: async () => ({ text: '{}', finishReason: 'stop' }),
    log: () => {},
  });
  check('33. backfill is idempotent — a chapter with existing entries is skipped on re-run', report2.skipped.includes(1) && sceneDeltaEntries.length === 2);
}

// ── BEATLEDGER-1B (same fix, same shape): runDeltasBackfillCommand's callLLM
// wrapper MUST forward model: extractorModel to callAgentWithMeta. Uses the
// REAL deriveSceneDelta (not mocked) so the wrapper is actually exercised.
{
  const store = {
    NovelProject: { get: async () => ({ id: 'proj-model-check' }) },
    Chapter: { filter: async () => ([{ id: 'ch1', chapter_number: 1, scene_beats_json: JSON.stringify({ beats: [{ scene_id: 's1' }] }) }]) },
    SceneDelta: { filter: async () => [], create: async () => {} },
  };
  let capturedModel = null;
  await runDeltasBackfillCommand({
    projectId: 'proj-model-check',
    store,
    deriveSceneDelta,
    recordSceneDelta,
    pickModel: () => 'the-writer-model',
    callAgentWithMeta: async ({ model }) => { capturedModel = model; return { text: '{"newInformation":"x","stateChange":"y","conflictType":"z","participants":[]}', finishReason: 'stop' }; },
    log: () => {},
  });
  check('34. runDeltasBackfillCommand\'s callLLM wrapper forwards model: extractorModel to callAgentWithMeta (never resolveAgent\'s default)', capturedModel === 'the-writer-model');
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
