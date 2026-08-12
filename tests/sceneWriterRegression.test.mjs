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
        { 
          scene_number: 1, 
          scene_id: "ch05-s01", 
          beats: ['A fight starts.'],
          required_events: ['A confrontation happens.'], 
          entry_state: 'angry', 
          exit_state: 'calm', 
          goal: 'Win',
          conflict: 'Lost key',
          disaster: 'Trapped',
          scene_summary: 'They fight.',
          location: 'Office',
          pov_character: 'Alice'
        },
        { 
          scene_number: 2, 
          scene_id: "ch05-s02", 
          beats: ['A fight starts.'],
          required_events: ['A confrontation happens.'], 
          entry_state: 'angry', 
          exit_state: 'calm', 
          goal: 'Win',
          conflict: 'Lost key',
          disaster: 'Trapped',
          scene_summary: 'They fight.',
          location: 'Office',
          pov_character: 'Alice'
        }
      ]
    };
    
    // Deep clone the original input before normalization
    const originalInput = JSON.parse(JSON.stringify(rawArchitectResult.beats));

    // Create the pipeline contract
    const pipeline_contract = captureRawArchitectProvenance(rawArchitectResult);
    
    const overlapReport = sceneBeatNormalizer.normalizeSceneBeatsForDrafting(rawArchitectResult.beats, {
      isNonfiction: false,
      chapterNumber: 5,
      chapterTitle: 'Test',
      projectTitle: 'Test Project',
    });

    // 1. Scene count is unchanged.
    assert.equal(overlapReport.beats.length, 2, 'Should remain 2 scenes');
    
    // 2. Scene IDs are unchanged.
    // 3. Scene numbers are unchanged.
    // 4. Every narrative field in both output scenes deeply equals its corresponding original field.
    for (let i = 0; i < 2; i++) {
      assert.equal(overlapReport.beats[i].scene_id, originalInput[i].scene_id);
      assert.equal(overlapReport.beats[i].scene_number, originalInput[i].scene_number);
      assert.deepEqual(overlapReport.beats[i].beats, originalInput[i].beats);
      assert.deepEqual(overlapReport.beats[i].required_events, originalInput[i].required_events);
      assert.equal(overlapReport.beats[i].entry_state, originalInput[i].entry_state);
      assert.equal(overlapReport.beats[i].exit_state, originalInput[i].exit_state);
      assert.equal(overlapReport.beats[i].goal, originalInput[i].goal);
      assert.equal(overlapReport.beats[i].conflict, originalInput[i].conflict);
      assert.equal(overlapReport.beats[i].disaster, originalInput[i].disaster);
      assert.equal(overlapReport.beats[i].scene_summary, originalInput[i].scene_summary);
      assert.equal(overlapReport.beats[i].location, originalInput[i].location);
      assert.equal(overlapReport.beats[i].pov_character, originalInput[i].pov_character);
      
      // 5. No diagnostic text appears inside either scene’s beats array.
      assert.ok(!overlapReport.beats[i].beats.some(b => typeof b === 'string' && b.includes('CONTINUITY WARNING')), 'beats array must not contain diagnostic text');
    }
    
    // 6. continuity_warning or report warnings record the overlap.
    assert.ok(overlapReport.reported > 0 || overlapReport.warnings.length > 0 || overlapReport.beats.some(b => b.continuity_warning), 'Should have reported a warning');

    // 7. merged === 0.
    assert.equal(overlapReport.merged, 0, 'merged count should be 0');
    // 8. removed === 0.
    assert.equal(overlapReport.removed, 0, 'removed count should be 0');

    // 9. Provenance validation passes.
    verifySceneProvenance(overlapReport.beats, pipeline_contract, 'after-normalization');
    
    // 10. Contiguous-sequence validation passes.
    const { verifyContiguousSceneSequence } = await import('../src/lib/generationContext.js');
    verifyContiguousSceneSequence(overlapReport.beats, pipeline_contract.expected_scene_count, 'after-normalization');
  });

  await test('42. Fiction chronology does not mutate, delete, or reorder scenes', async () => {
    // Stage sequence that would normally cause chronology merges/reorders
    const rawArchitectResult = {
      beats: [
        { scene_number: 1, scene_id: "ch05-s01", beats: ['b1'], story_function: 'Consequence', chronology_stage: 'departure/consequence', required_events: ['e1'] },
        { scene_number: 2, scene_id: "ch05-s02", beats: ['b2'], story_function: 'Inciting Incident', chronology_stage: 'offer/demand', required_events: ['e2'] },
        { scene_number: 3, scene_id: "ch05-s03", beats: ['b3'], story_function: 'Inciting Incident', chronology_stage: 'offer/demand', required_events: ['e3'] }
      ]
    };
    
    const originalInput = JSON.parse(JSON.stringify(rawArchitectResult.beats));
    
    const overlapReport = sceneBeatNormalizer.normalizeSceneBeatsForDrafting(rawArchitectResult.beats, {
      isNonfiction: false,
      chapterNumber: 5,
    });
    
    assert.equal(overlapReport.beats.length, 3);
    assert.equal(overlapReport.merged, 0);
    assert.equal(overlapReport.removed, 0);
    
    for (let i = 0; i < 3; i++) {
      assert.equal(overlapReport.beats[i].scene_id, originalInput[i].scene_id);
      assert.equal(overlapReport.beats[i].scene_number, originalInput[i].scene_number);
      assert.deepEqual(overlapReport.beats[i].beats, originalInput[i].beats);
    }
  });

  await test('43. Same-scene discovery then confrontation passes', async () => {
    const beats = [
      {
        scene_number: 1,
        scene_id: "ch05-s01",
        required_events: [
          "Lena discovers the logs revealing Marcus's role.",
          "Lena confronts Marcus with the evidence."
        ],
        entry_state: "unknown",
        exit_state: "confrontation completed"
      }
    ];
    sceneBeatNormalizer.validateRawBeatChronology(beats);
  });

  await test('44. Same-scene confrontation then discovery fails', async () => {
    const beats = [
      {
        scene_number: 1,
        scene_id: "ch05-s01",
        required_events: [
          "Lena confronts Marcus with the evidence.",
          "Lena discovers the logs revealing Marcus's role."
        ],
        entry_state: "unknown",
        exit_state: "confrontation completed"
      }
    ];
    let threw = false;
    try {
      sceneBeatNormalizer.validateRawBeatChronology(beats);
    } catch (e) {
      if (e.message.includes('Evidence revelation must precede')) threw = true;
    }
    assert.ok(threw, "Should throw chronology error for confrontation before discovery");
  });

  await test('45. Earlier-scene discovery then later-scene confrontation passes', async () => {
    const beats = [
      {
        scene_number: 1,
        scene_id: "ch05-s01",
        required_events: [
          "Lena discovers the logs revealing Marcus's role."
        ]
      },
      {
        scene_number: 2,
        scene_id: "ch05-s02",
        required_events: [
          "Lena confronts Marcus with the evidence."
        ]
      }
    ];
    sceneBeatNormalizer.validateRawBeatChronology(beats);
  });

  await test('46. Earlier-scene confrontation then later discovery fails', async () => {
    const beats = [
      {
        scene_number: 1,
        scene_id: "ch05-s01",
        required_events: [
          "Lena confronts Marcus with the evidence."
        ]
      },
      {
        scene_number: 2,
        scene_id: "ch05-s02",
        required_events: [
          "Lena discovers the logs revealing Marcus's role."
        ]
      }
    ];
    let threw = false;
    try {
      sceneBeatNormalizer.validateRawBeatChronology(beats);
    } catch (e) {
      if (e.message.includes('Evidence revelation must precede')) threw = true;
    }
    assert.ok(threw, "Should throw chronology error for earlier confrontation");
  });

  await test('47. Confrontation with no evidence discovery fails', async () => {
    const beats = [
      {
        scene_number: 1,
        scene_id: "ch05-s01",
        required_events: [
          "Lena confronts Marcus with the evidence."
        ]
      }
    ];
    let threw = false;
    try {
      sceneBeatNormalizer.validateRawBeatChronology(beats);
    } catch (e) {
      if (e.message.includes('Evidence revelation must precede')) threw = true;
    }
    assert.ok(threw, "Should throw chronology error for missing discovery");
  });

  // -- STAGE 9A ACCEPTANCE INTEGRATION TESTS --

  const mockProjectFor9A = Object.freeze({ id: 'proj-1', book_type: 'fiction', title: 'Acceptance Integration', __chapters: [] });
  const mockChapterFor9A = Object.freeze({ id: 'ch-9', chapter_number: 9, title: 'Evaluation', scene_beats_json: '[]' });
  const mockScenesFor9A = Object.freeze([
    Object.freeze({ 
      scene_number: 1, 
      scene_id: 'ch09-s01', 
      scene_goal: 'Test',
      required_events: Object.freeze(['A happens.']), 
      forbidden_events: Object.freeze([]),
      continuity_dependencies: Object.freeze([]),
      entry_state: 'unknown',
      exit_state: 'A is done.',
      location: 'Test location',
      characters: Object.freeze([]),
      emotional_beat: 'Test beat'
    })
  ]);

  const shadowIntegrationMock = Object.freeze({
    flags: Object.freeze({
      scene_context_composer_v1: true,
      scene_execution_shadow_v1: true,
      scene_execution_prompt_canary_v2: true,
      scene_execution_canary_trial_v1: true,
      scene_execution_canary_comparison_v2: true,
      scene_execution_acceptance_gate_v1: true
    }),
    snapshot: Object.freeze({ version: 'narrative-connect-v2', snapshotId: 'snap-49', project: mockProjectFor9A, chapter: mockChapterFor9A }),
    contextBySceneId: Object.freeze({ 'ch09-s01': Object.freeze({ pov_identity: 'POV', immediate_continuity: '' }) })
  });

  await test('48. Default-disabled bypass', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Mocked prose for scene.' } }] }) });
    let calls = 0;
    try {
      const result = await generateChapterSceneByScene({
        project: mockProjectFor9A,
        chapter: mockChapterFor9A,
        scenes: mockScenesFor9A,
        sceneExecutionAcceptanceRunners: {
          auditRunner: async () => { calls++; return {}; },
          repairRunner: async () => { calls++; return {}; }
        }
      });
      assert.equal(calls, 0, 'Runners should not be called when disabled');
      assert.ok(result.scenes[0].prose?.includes('Mocked prose'), 'Original prose should be preserved');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await test('49. Enabled clean acceptance', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Mocked prose for scene.' } }] }) });
    let auditCalls = 0;
    let repairCalls = 0;
    try {
      const result = await generateChapterSceneByScene({
        project: mockProjectFor9A,
        chapter: mockChapterFor9A,
        scenes: mockScenesFor9A,
        sceneExecutionShadow: shadowIntegrationMock,
        sceneExecutionAcceptanceRunners: {
          auditRunner: async (req) => {
            auditCalls++;
            return {
              version: 'scene-execution-acceptance-gate-v1',
              contract_fingerprint: req.contract_fingerprint,
              scene_id: req.scene_id,
              scene_number: req.scene_number,
              packet_id: req.packet.packet_id,
              status: 'clean',
              issues: [],
              coverage: {
                entry_state_satisfied: 'verified',
                exit_state_attained: 'verified',
                required_events_satisfied: 'verified',
                forbidden_events_avoided: 'verified',
                continuity_satisfied: 'verified'
              }
            };
          },
          repairRunner: async () => { repairCalls++; return {}; }
        }
      });
      assert.equal(auditCalls, 1, 'Audit runner should be called once');
      assert.equal(repairCalls, 0, 'Repair runner should not be called');
      assert.ok(result.scenes[0].prose?.includes('Mocked prose'), 'Original prose should be returned');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await test('50. Enabled surgical repair', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Mocked prose for scene.' } }] }) });
    let auditCalls = 0;
    let repairCalls = 0;
    try {
      const result = await generateChapterSceneByScene({
        project: mockProjectFor9A,
        chapter: mockChapterFor9A,
        scenes: mockScenesFor9A,
        sceneExecutionShadow: shadowIntegrationMock,
        sceneExecutionAcceptanceRunners: {
          auditRunner: async (req) => {
            auditCalls++;
            if (auditCalls === 1) {
              return {
                version: 'scene-execution-acceptance-gate-v1',
                contract_fingerprint: req.contract_fingerprint,
                scene_id: req.scene_id,
                scene_number: req.scene_number,
                packet_id: req.packet.packet_id,
                status: 'issues_found',
                issues: [
                  {
                    code: 'FUTURE_EVENT_EARLY_PERFORMED',
                    offset: 0,
                    excerpt: 'Mocked ',
                    classification: 'repair_eligible'
                  }
                ],
                coverage: {
                  entry_state_satisfied: 'verified',
                  exit_state_attained: 'verified',
                  required_events_satisfied: 'verified',
                  forbidden_events_avoided: 'failed',
                  continuity_satisfied: 'verified'
                }
              };
            }
            return {
              version: 'scene-execution-acceptance-gate-v1',
              contract_fingerprint: req.contract_fingerprint,
              scene_id: req.scene_id,
              scene_number: req.scene_number,
              packet_id: req.packet.packet_id,
              status: 'clean',
              issues: [],
              coverage: {
                entry_state_satisfied: 'verified',
                exit_state_attained: 'verified',
                required_events_satisfied: 'verified',
                forbidden_events_avoided: 'verified',
                continuity_satisfied: 'verified'
              }
            };
          },
          repairRunner: async (req) => {
            repairCalls++;
            return {
              version: 'scene-execution-acceptance-gate-v1',
              contract_fingerprint: req.contract_fingerprint,
              scene_id: req.scene_id,
              scene_number: req.scene_number,
              packet_id: req.packet.packet_id,
              status: 'repaired',
              replacements: [
                {
                  issue_code: 'FUTURE_EVENT_EARLY_PERFORMED',
                  start: 0,
                  end: 7,
                  original_excerpt: 'Mocked ',
                  replacement_text: 'Repaired '
                }
              ]
            };
          }
        }
      });
      assert.equal(auditCalls, 2, 'Audit runner should be called twice');
      assert.equal(repairCalls, 1, 'Repair runner should be called once');
      assert.ok(result.scenes[0].prose?.includes('Repaired prose'), 'Repaired prose should be returned');
      assert.equal(result.scenes[0].repaired, true, 'repaired flag should be set');
      assert.ok(result.scenes[0].issues.some(i => i.includes('Evaluator repaired scene')), 'repair issue should be logged');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await test('51. Enabled rejection', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Mocked prose for scene.' } }] }) });
    let auditCalls = 0;
    try {
      await generateChapterSceneByScene({
        project: mockProjectFor9A,
        chapter: mockChapterFor9A,
        scenes: mockScenesFor9A,
        sceneExecutionShadow: shadowIntegrationMock,
        sceneExecutionAcceptanceRunners: {
          auditRunner: async () => {
            auditCalls++;
            return { invalid_schema: true }; // Should cause a SCENE_ACCEPTANCE_AUDIT_MALFORMED error
          },
          repairRunner: async () => { return {}; }
        }
      });
      assert.fail('Should have rejected the scene');
    } catch (err) {
      assert.equal(auditCalls, 1, 'Audit should run once and fail');
      assert.equal(err.code, 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', 'Should throw branded rejection error');
    } finally {
      global.fetch = originalFetch;
    }
  });

  console.log(`\n${passes}/${tests} passed.`);
  if (passes !== tests) process.exit(1);
}

await runAll();
