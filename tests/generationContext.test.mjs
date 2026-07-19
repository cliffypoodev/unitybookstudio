import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  GenerationContextError,
  hydrateProjectForGeneration,
  buildGenerationSnapshot,
  createImmutableSceneContract,
  assertSceneContractUnchanged,
  assertNarrativeTextClean,
  findNarrativeMetaLeaks,
  loadGenerationSnapshot,
  validateSceneBeatContracts,
} from '../src/lib/generationContext.js';

let passed = 0;
const skipWiring = process.env.UBS_SKIP_WIRING === '1';
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log('PASS', name);
    });
}

await test('URL-backed foundation fields are hydrated before generation', async () => {
  const project = {
    id: 'p1',
    book_type: 'fiction',
    project_type: 'fiction',
    world_md: '',
    world_md_url: 'local://world',
    characters_md: '',
    characters_md_url: 'local://characters',
    outline_md: '',
    outline_md_url: 'local://outline',
    canon_md: '',
    canon_md_url: 'local://canon',
  };
  const hydrated = await hydrateProjectForGeneration(project, {
    resolveAllFoundationFields: async () => ({
      world_md: 'FULL WORLD CONTRACT',
      characters_md: 'FULL CHARACTER CONTRACT',
      outline_md: 'FULL ORDERED OUTLINE',
      canon_md: 'FULL CANON',
    }),
  });
  assert.equal(hydrated.world_md, 'FULL WORLD CONTRACT');
  assert.equal(hydrated.characters_md, 'FULL CHARACTER CONTRACT');
  assert.equal(hydrated.outline_md, 'FULL ORDERED OUTLINE');
  assert.equal(hydrated.canon_md, 'FULL CANON');
  assert.equal(project.world_md, '');
  assert.equal(hydrated.__generationContext.version, 'narrative-connect-v2');
});

await test('unresolved required fiction foundation hard-blocks generation', async () => {
  await assert.rejects(
    hydrateProjectForGeneration({
      id: 'p2',
      book_type: 'fiction',
      project_type: 'fiction',
      world_md_url: 'local://world',
      characters_md: 'characters',
      outline_md: 'outline',
      canon_md: 'canon',
    }, {
      resolveAllFoundationFields: async () => ({
        characters_md: 'characters',
        outline_md: 'outline',
        canon_md: 'canon',
      }),
    }),
    (error) => error instanceof GenerationContextError &&
      error.code === 'FOUNDATION_URL_RESOLUTION_FAILED' &&
      error.details.missingFields.includes('world_md')
  );
});

await test('snapshot uses the freshly loaded ordered chapter sequence', async () => {
  const snapshot = await loadGenerationSnapshot({
    project: {
      id: 'p3',
      book_type: 'fiction',
      project_type: 'fiction',
      world_md: 'world',
      characters_md: 'characters',
      outline_md: 'outline',
      canon_md: 'canon',
    },
    chapter: { id: 'c3', chapter_number: 3, title: 'stale title' },
    fetchChapters: async () => [
      { id: 'c3', chapter_number: 3, title: 'fresh title', updated_date: '2026-01-03' },
      { id: 'c1', chapter_number: 1, title: 'one', updated_date: '2026-01-01' },
      { id: 'c2', chapter_number: 2, title: 'two', updated_date: '2026-01-02', content_md: 'fresh prior prose' },
    ],
    resolveAllFoundationFields: async (project) => project,
  });
  assert.deepEqual(snapshot.chapters.map((chapter) => chapter.id), ['c1', 'c2', 'c3']);
  assert.equal(snapshot.chapter.title, 'fresh title');
  assert.equal(snapshot.previousChapter.id, 'c2');
  assert.equal(snapshot.previousChapter.content_md, 'fresh prior prose');
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.chapters));
});

await test('valid stateful scene contracts are accepted', () => {
  const result = validateSceneBeatContracts({
    beats: [
      {
        scene_number: 1,
        scene_id: 'ch03-s01',
        scene_goal: 'Force the irreversible choice.',
        entry_state: 'Mara is alive at the station and holds the key.',
        required_events: ['Mara gives the key to Jo.'],
        forbidden_events: ['Do not repeat the Chapter 2 confrontation.'],
        exit_state: 'Jo holds the key; Mara leaves the station.',
      },
      {
        scene_number: 2,
        scene_id: 'ch03-s02',
        scene_goal: 'Make Jo pay the cost of the choice.',
        entry_state: 'Jo holds the key; Mara has left.',
        required_events: ['Jo opens the locked archive.'],
        forbidden_events: ['Mara cannot re-enter this chapter.'],
        exit_state: 'The archive is open and the secret is known.',
      },
    ],
  }, { chapterNumber: 3 });
  assert.equal(result.sceneCount, 2);
  assert.deepEqual(result.sceneIds, ['ch03-s01', 'ch03-s02']);
});

await test('duplicate or incomplete scene identities hard-block beat saving', () => {
  assert.throws(
    () => validateSceneBeatContracts({
      beats: [
        {
          scene_id: 'ch03-s01',
          scene_goal: 'First take',
          entry_state: 'Before',
          required_events: ['Event'],
          exit_state: 'After',
        },
        {
          scene_id: 'ch03-s01',
          scene_goal: 'Alternate take',
          entry_state: 'Before',
          required_events: ['Same event again'],
          exit_state: 'Alternate after',
        },
      ],
    }, { chapterNumber: 3 }),
    (error) => error.code === 'SCENE_CONTRACT_INVALID' &&
      error.details.issues.some((issue) => issue.includes('duplicate scene_id'))
  );
});

await test('accepted fiction scene contracts are immutable', () => {
  const contract = createImmutableSceneContract({
    beats: [
      {
        scene_number: 1,
        scene_id: 'ch04-s01',
        pov_character: 'Lena',
        setting: 'Reactor chamber',
        conflict: 'Marcus must surrender the key before the seal fails.',
        scene_goal: 'Vale makes the sacrifice.',
        entry_state: 'Vale, Lena, and Marcus are alive in the reactor chamber. Marcus holds the key.',
        required_events: ['Marcus gives the key to Vale.', 'Vale seals himself inside the chamber.'],
        forbidden_events: ['Vale must not die twice.', 'The archive must not reopen.'],
        exit_state: 'Vale is sealed inside. Lena and Marcus are outside. Vale holds the key.',
      },
      {
        scene_number: 2,
        scene_id: 'ch04-s02',
        scene_goal: 'Lena and Marcus reach the exit route.',
        entry_state: 'Vale is sealed inside. Lena and Marcus are outside. Vale holds the key.',
        required_events: ['Lena and Marcus leave the reactor sector.'],
        forbidden_events: ['Do not recover Vale or the key.', 'Do not reopen the archive.'],
        exit_state: 'Lena and Marcus are on the exit route; Vale remains sealed inside.',
      },
    ],
  }, { chapterNumber: 4 });

  assert.ok(Object.isFrozen(contract));
  assert.ok(Object.isFrozen(contract.beats));
  assert.equal(contract.beats[0].pov_character, 'Lena');
  assert.equal(contract.beats[0].setting, 'Reactor chamber');
  assert.equal(contract.beats[0].conflict, 'Marcus must surrender the key before the seal fails.');
  assert.doesNotThrow(() => assertSceneContractUnchanged(contract, contract.beats, { chapterNumber: 4 }));
  assert.throws(
    () => assertSceneContractUnchanged(contract, [contract.beats[1]], { chapterNumber: 4 }),
    (error) => error.code === 'SCENE_CONTRACT_INVALID' || error.code === 'SCENE_CONTRACT_MUTATED'
  );
});

await test('Brass Meridian planning-language leaks are rejected from prose', () => {
  const contaminated = [
    'He raised the prosthetic hook he had been using since the accident in Chapter 2.',
    'She carried the printed log from the previous chapter.',
    'She remembered the accident in Chapter 3.',
  ].join(' ');
  const matches = findNarrativeMetaLeaks(contaminated);
  assert.ok(matches.length >= 3);
  assert.throws(
    () => assertNarrativeTextClean(contaminated, { chapterNumber: 5 }),
    (error) => error.code === 'NARRATIVE_META_LEAK' && error.details.narrativeContract === true
  );
  assert.doesNotThrow(() => assertNarrativeTextClean('She remembered the door crushing his hand beneath the failing station.'));
});

if (!skipWiring) await test('production wiring is fail-closed across planning, beats, and scenes', () => {
  const studio = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');
  const writer = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
  const bible = fs.readFileSync(new URL('../src/lib/parallelBibleGenerator.js', import.meta.url), 'utf8');
  const auto = fs.readFileSync(new URL('../src/lib/autonovel.js', import.meta.url), 'utf8');

  assert.match(studio, /loadGenerationSnapshot\s*\(/);
  assert.match(studio, /validateSceneBeatContracts\s*\(/);
  assert.match(studio, /SCENE_CONTRACT_OVERLAP_UNRESOLVED/);
  assert.match(studio, /revisionFeedback:\s*retryFeedback/);
  assert.match(studio, /NARRATIVE_CONTRACT_UNRESOLVED/);
  assert.match(studio, /draftError\?\.narrativeContract/);
  assert.match(studio, /fiction-scene-contract-v1/);
  assert.match(writer, /SCENE_DUPLICATE_UNRESOLVED/);
  assert.doesNotMatch(writer, /duplicate repair still looked unsafe; keeping original but flagging/);
  assert.match(writer, /NARRATIVE STATE CONTRACT — MANDATORY/);
  assert.match(writer, /SCENE_CONTRACT_NORMALIZER_CONFLICT/);
  assert.match(bible, /OUTLINE_CONTRACT_UNRESOLVED/);
  assert.doesNotMatch(bible, /Accepting best-effort outline with remaining issues/);
  assert.match(auto, /FULL ORDERED CHAPTER CONTRACT/);
  assert.match(auto, /entry_state/);
  assert.match(auto, /exit_state/);
});

console.log(`\nNARRATIVE CONNECT REGRESSION: ${passed} passed, 0 failed\n`);
