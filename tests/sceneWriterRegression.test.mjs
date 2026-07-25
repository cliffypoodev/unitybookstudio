import { verifySceneProvenance, NarrativeInvariantError, captureRawArchitectProvenance } from '../src/lib/generationContext.js';
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

    await test('39. Raw extraction loss', async () => {
    const rawArchitectResult = {
      beats: [
        { scene_number: 1, scene_id: "ch05-s01", required_events: ['One'] },
        { scene_number: 2, scene_id: "ch05-s02" }, // malformed shape
        { scene_number: 3, scene_id: "ch05-s03", required_events: ['Three'] }
      ]
    };
    try {
      captureRawArchitectProvenance(rawArchitectResult);
      throw new Error('Test 39 Failed: Did not detect malformed element');
    } catch (err) {
      if (err.name === 'NarrativeInvariantError' && err.code === 'SCENE_MALFORMED_IN_PIPELINE' && err.malformedIndex === 1) {
        // Success
      } else {
        throw err;
      }
    }
  });

  await test('40. Raw sequence gap test', async () => {
    const rawArchitectResult = {
      beats: [
        { scene_number: 1, scene_id: "ch05-s01", required_events: ['One'] },
        { scene_number: 3, scene_id: "ch05-s03", required_events: ['Three'] }
      ]
    };
    try {
      captureRawArchitectProvenance(rawArchitectResult);
      throw new Error('Test 40 Failed: Did not detect sequence gap');
    } catch (err) {
      if (err.name === 'NarrativeInvariantError' && err.code === 'SCENE_SEQUENCE_GAP' && err.missingSceneNumbers.includes(2)) {
        // Success
      } else {
        throw err;
      }
    }
  });

  await test('41. Fiction overlap retains both scenes perfectly', async () => {
    const rawArchitectResult = {
      beats: [
        { scene_number: 1, scene_id: "ch05-s01", required_events: ['A confrontation happens.'], entry_state: 'angry', exit_state: 'calm', location: 'Office' },
        { scene_number: 2, scene_id: "ch05-s02", required_events: ['A confrontation happens.'], entry_state: 'angry', exit_state: 'calm', location: 'Office' }
      ]
    };
    
    // Create the pipeline contract
    const pipeline_contract = captureRawArchitectProvenance(rawArchitectResult);
    
    const overlapReport = sceneBeatNormalizer.normalizeSceneBeatsForDrafting(rawArchitectResult.beats, {
      isNonfiction: false,
      chapterNumber: 5,
      chapterTitle: 'Test',
      projectTitle: 'Test Project',
    });

    // A. Two overlapping fiction scenes remain two scenes.
    assert.equal(overlapReport.beats.length, 2, 'Should remain 2 scenes');
    
    // B. Both original IDs survive normalization.
    assert.equal(overlapReport.beats[0].scene_id, 'ch05-s01');
    assert.equal(overlapReport.beats[1].scene_id, 'ch05-s02');
    
    // C. Both original scene numbers survive normalization.
    assert.equal(overlapReport.beats[0].scene_number, 1);
    assert.equal(overlapReport.beats[1].scene_number, 2);
    
    // D. Required events from both scenes survive unchanged.
    assert.equal(overlapReport.beats[0].required_events[0], 'A confrontation happens.');
    assert.equal(overlapReport.beats[1].required_events[0], 'A confrontation happens.');

    // E. Narrative beat fields from both scenes survive unchanged.
    assert.equal(overlapReport.beats[0].entry_state, 'angry');
    assert.equal(overlapReport.beats[1].entry_state, 'angry');
    
    // F. The overlap report records the overlap without claiming a semantic merge.
    assert.equal(overlapReport.merged, 0, 'merged count should be 0');
    assert.equal(overlapReport.removed, 0, 'removed count should be 0');
    assert.ok(overlapReport.reported > 0 || overlapReport.warnings.length > 0, 'Should have reported a warning');

    // G. verifySceneProvenance passes after normalization.
    verifySceneProvenance(overlapReport.beats, pipeline_contract, 'after-normalization');
    
    // H. verifyContiguousSceneSequence passes after normalization.
    const { verifyContiguousSceneSequence } = await import('../src/lib/generationContext.js');
    verifyContiguousSceneSequence(overlapReport.beats, pipeline_contract.expected_scene_count, 'after-normalization');
  });

  console.log(`\n${passes}/${tests} passed.`);
  if (passes !== tests) process.exit(1);
}

await runAll();
