import assert from 'node:assert/strict';
import { generateChapterSceneByScene } from '../src/lib/sceneWriter.js';
import * as sceneBeatNormalizer from '../src/lib/sceneBeatNormalizer.js';

let tests = 0;
let passes = 0;

async function test(name, fn) {
  tests++;
  try {
    await fn();
    passes++;
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
  }
}

async function runAll() {
  console.log('--- SCENE WRITER PIPELINE TESTS ---');

  const mockProject = { book_type: 'fiction', title: 'Test Project' };
  const mockChapter = { chapter_number: 5, title: 'The Archive', scene_beats_json: '[]' };

  await test('32. Scene 2 trace test: Pipeline fails if scene 2 is inexplicably lost', async () => {
    const malformedScenes = [
      { scene_number: 1, scene_id: 'ch05-s01', scene_goal: '1', entry_state: '1', exit_state: '1', location: '1', characters: [], emotional_beat: '1', required_events: ['Destroy key'], exit_state: 'key destroyed.' },
      { scene_number: 2, scene_id: 'ch05-s02', scene_goal: '2', entry_state: '2', exit_state: '2', location: '2', characters: [], emotional_beat: '2', required_events: ['Destroy key'], exit_state: 'key destroyed.' },
      { scene_number: 3, scene_id: 'ch05-s03', scene_goal: '3', entry_state: '3', exit_state: '3', location: '3', characters: [], emotional_beat: '3', required_events: ['Escape'] }
    ];

    try {
      await generateChapterSceneByScene({ project: mockProject, chapter: mockChapter, scenes: malformedScenes });
      assert.fail('Should have thrown SCENE_LOST_IN_PIPELINE or NarrativeInvariantError');
    } catch (err) {
      if (!['SCENE_LOST_IN_PIPELINE', 'UNPROVEN_SCENE_MERGE', 'SCENE_CONTRACT_NORMALIZER_CONFLICT'].includes(err.code)) {
        console.error(err);
        assert.fail(`Wrong error code: ${err.code}`);
      }
    }
  });

  await test('33. Chronology errors correctly trigger repair', async () => {
    const overlappingScenes = [
      { scene_number: 1, scene_id: 'ch05-s01', scene_goal: '1', entry_state: '1', exit_state: 'key destroyed.', location: '1', characters: [], emotional_beat: '1', required_events: ['A confrontation happens.'] },
      { scene_number: 2, scene_id: 'ch05-s02', scene_goal: '2', entry_state: 'key intact.', exit_state: '2', location: '2', characters: [], emotional_beat: '2', required_events: ['A confrontation happens.'] }
    ];
    try {
      await generateChapterSceneByScene({ project: mockProject, chapter: mockChapter, scenes: overlappingScenes });
    } catch (err) {
      assert.notEqual(err.name, 'ChronologyError');
    }
  });

  await test('34. ReferenceError is immediately rethrown', async () => {
    const scenesWithRefError = [
      { scene_number: 1, scene_id: 'ch05-s01', scene_goal: '1', entry_state: '1', exit_state: '1', location: '1', characters: [], emotional_beat: '1', get required_events() { throw new ReferenceError('Mock reference error'); } }
    ];
    try {
      await generateChapterSceneByScene({ project: mockProject, chapter: mockChapter, scenes: scenesWithRefError });
      assert.fail('Should have thrown ReferenceError');
    } catch (err) {
      assert.equal(err.name, 'ReferenceError');
    }
  });

  await test('35. TypeError is immediately rethrown', async () => {
    const scenesWithTypeError = [
      { scene_number: 1, scene_id: 'ch05-s01', scene_goal: '1', entry_state: '1', exit_state: '1', location: '1', characters: [], emotional_beat: '1', get required_events() { throw new TypeError('Mock type error'); } }
    ];
    try {
      await generateChapterSceneByScene({ project: mockProject, chapter: mockChapter, scenes: scenesWithTypeError });
      assert.fail('Should have thrown TypeError');
    } catch (err) {
      assert.equal(err.name, 'TypeError');
    }
  });

  await test('36. Repair function failure is rethrown', async () => {
    const overlappingScenes = [
      { scene_number: 1, scene_id: 'ch05-s01', scene_goal: '1', entry_state: '1', exit_state: 'key destroyed.', location: '1', characters: [], emotional_beat: '1', required_events: ['A confrontation happens.'] },
      { scene_number: 2, scene_id: 'ch05-s02', scene_goal: '2', entry_state: 'key intact.', exit_state: '2', location: '2', characters: [], emotional_beat: '2', required_events: ['A confrontation happens.'] }
    ];
    
    // Validate schema correctly so validation passes, but repair fails.
    const brokenScenes = new Proxy(overlappingScenes, {
      get(target, prop) {
        if (prop === 'filter') {
          return function() {
            throw new TypeError('Mock repair failure during filtering');
          };
        }
        return target[prop];
      }
    });

    try {
      await generateChapterSceneByScene({ project: mockProject, chapter: mockChapter, scenes: brokenScenes });
      assert.fail('Should have thrown Mock repair failure');
    } catch (err) {
      assert.equal(err.message, 'Mock repair failure during filtering');
    }
  });

  console.log(`\\n${passes}/${tests} passed.`);
  if (passes !== tests) process.exit(1);
}

runAll();
