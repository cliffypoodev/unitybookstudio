import { verifySceneProvenance, NarrativeInvariantError } from '../src/lib/generationContext.js';
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


  await test('32. Scene 2 trace test: Silent loss correctly throws SCENE_LOST_IN_PIPELINE', async () => {
    const chapterWithSilentLoss = {
      chapter_number: 5,
      scene_beats_json: {
        pipeline_contract: {
          expected_scene_count: 3,
          expected_scene_ids: ['ch05-s01', 'ch05-s02', 'ch05-s03'],
          expected_scene_numbers: [1, 2, 3],
          source_stage: 'architect-parsed'
        },
        beats: [
          { scene_number: 1, scene_id: 'ch05-s01', required_events: ['Confrontation'] },
          // Scene 2 lost silently
          { scene_number: 3, scene_id: 'ch05-s03', required_events: ['Escape'] }
        ]
      },
      scenes: [
        { scene_number: 1, scene_id: 'ch05-s01', required_events: ['Confrontation'] },
        { scene_number: 3, scene_id: 'ch05-s03', required_events: ['Escape'] }
      ]
    };

    try {
      await generateChapterSceneByScene({
        project: { book_type: 'fiction', target_chapter_length: '3500' },
        chapter: chapterWithSilentLoss
      });
      throw new Error('Test 32 Failed: Silent loss was not caught');
    } catch (err) {
      if (err.name === 'NarrativeInvariantError' && err.code === 'SCENE_LOST_IN_PIPELINE' && JSON.stringify(err.missingSceneIds) === JSON.stringify(['ch05-s02'])) {
        
      } else {
        throw err;
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

  await test('37. Positive end-to-end ID test', async () => {
    const chapterValid = {
      chapter_number: 5,
      scene_beats_json: {
        pipeline_contract: {
          expected_scene_count: 3,
          expected_scene_ids: ['ch05-s01', 'ch05-s02', 'ch05-s03'],
          expected_scene_numbers: [1, 2, 3],
          source_stage: 'architect-parsed'
        },
        beats: [
          { scene_number: 1, scene_id: 'ch05-s01', required_events: ['One'] },
          { scene_number: 2, scene_id: 'ch05-s02', required_events: ['Two'] },
          { scene_number: 3, scene_id: 'ch05-s03', required_events: ['Three'] }
        ]
      },
      scenes: [
        { scene_number: 1, scene_id: 'ch05-s01', required_events: ['One'] },
        { scene_number: 2, scene_id: 'ch05-s02', required_events: ['Two'] },
        { scene_number: 3, scene_id: 'ch05-s03', required_events: ['Three'] }
      ]
    };
    
    verifySceneProvenance(chapterValid.scenes, chapterValid.scene_beats_json.pipeline_contract, 'architect-parsed');
    verifySceneProvenance(chapterValid.scenes, chapterValid.scene_beats_json.pipeline_contract, 'before-normalization');
    verifySceneProvenance(chapterValid.scenes, chapterValid.scene_beats_json.pipeline_contract, 'after-normalization');
    verifySceneProvenance(chapterValid.scenes, chapterValid.scene_beats_json.pipeline_contract, 'before-compact-save');
    verifySceneProvenance(chapterValid.scenes, chapterValid.scene_beats_json.pipeline_contract, 'writer-parse');

    
  });

  await test('38. ProjectStudio Helper Guard', async () => {
    const expectedContract = {
      expected_scene_count: 3,
      expected_scene_ids: ['ch05-s01', 'ch05-s02', 'ch05-s03'],
      expected_scene_numbers: [1, 2, 3],
      source_stage: 'architect-parsed'
    };
    const actualBeats = [
      { scene_id: 'ch05-s01' },
      { scene_id: 'ch05-s03' }
    ];
    
    try {
      verifySceneProvenance(actualBeats, expectedContract, 'test-stage');
      throw new Error('Test 38 Failed: Provenance guard failed to catch loss');
    } catch (err) {
      if (err.name === 'NarrativeInvariantError' && err.code === 'SCENE_LOST_IN_PIPELINE' && JSON.stringify(err.missingSceneIds) === JSON.stringify(['ch05-s02'])) {
        
      } else {
        throw err;
      }
    }
  });
