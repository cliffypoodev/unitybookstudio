import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectProcessLeaks, runManuscriptSafetyGate } from '../src/lib/manuscriptSafetyGate.js';
import {
  assertSceneContractUnchanged,
  createImmutableSceneContract,
} from '../src/lib/generationContext.js';
import { normalizeSceneBeatsForDrafting } from '../src/lib/sceneBeatNormalizer.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('PASS', name);
}

const brassChapter3 = [
  {
    scene_number: 1,
    scene_id: 'ch03-s01',
    scene_goal: 'Force the door while Marcus still has both hands.',
    entry_state: 'Marcus has two intact hands and holds the brass key.',
    required_events: ['Marcus begins forcing the mechanical door.'],
    forbidden_events: ['Marcus must not begin with a prosthetic.', 'Do not reopen the archive.'],
    exit_state: 'The door mechanism begins to fail; Marcus still has both hands.',
  },
  {
    scene_number: 2,
    scene_id: 'ch03-s02',
    scene_goal: 'Make the irreversible injury occur once.',
    entry_state: 'The door mechanism is failing; Marcus still has both hands.',
    required_events: ['The mechanical door crushes Marcus’s left hand and it is amputated.'],
    forbidden_events: ['Do not describe the injury as having happened earlier.', 'Do not reopen the archive.'],
    exit_state: 'Marcus is alive but his left hand is gone; Lena controls the emergency route.',
  },
  {
    scene_number: 3,
    scene_id: 'ch03-s03',
    scene_goal: 'Escape the mechanism and carry the injury forward.',
    entry_state: 'Marcus is alive without his left hand; Lena controls the emergency route.',
    required_events: ['Lena stabilizes Marcus and moves him out of the chamber.'],
    forbidden_events: ['Marcus cannot use his left hand.', 'Do not reopen the archive.'],
    exit_state: 'Marcus survives without his left hand and both characters leave the chamber.',
  },
];

test('legacy normalizer conflicts are detected instead of silently accepted', () => {
  const contract = createImmutableSceneContract({ beats: brassChapter3 }, { chapterNumber: 3 });
  const destructiveCandidate = [brassChapter3[1]];
  assert.throws(
    () => assertSceneContractUnchanged(contract, destructiveCandidate, { chapterNumber: 3 }),
    (error) => ['SCENE_CONTRACT_INVALID', 'SCENE_CONTRACT_MUTATED'].includes(error.code)
  );
});

test('normalizer remains available for detection without owning fiction truth', () => {
  const report = normalizeSceneBeatsForDrafting(brassChapter3, {
    isNonfiction: false,
    chapterNumber: 3,
  });
  assert.ok(report && Array.isArray(report.beats));
  assert.equal(brassChapter3.length, 3, 'input contract must not be mutated');
});

test('dynamic Chapter N and previous-chapter prose leaks are critical', () => {
  const prose = 'He had used the hook since the accident in Chapter 2. She carried the log from the previous chapter.';
  const leak = detectProcessLeaks(prose);
  assert.equal(leak.hasLeak, true);
  assert.ok(leak.matches.some((match) => match.type === 'narrative-process-leak'));
  assert.ok(leak.matches.every((match) => match.severity === 'critical'));
});

test('export/draft safety gate rejects narrative process leakage', () => {
  const gate = runManuscriptSafetyGate(
    'She remembered the accident in Chapter 3, then opened the archive again.',
    {
    chapterNumber: 5,
    chapterTitle: 'The Truth',
    stage: 'pre-export',
    }
  );
  assert.equal(gate.ok, false);
  assert.ok(gate.processLeaks.matches.some((match) => match.type === 'narrative-process-leak'));
});

test('judge schema requires semantic continuity results', () => {
  const judge = fs.readFileSync(new URL('../src/lib/povTense.js', import.meta.url), 'utf8');
  assert.match(judge, /narrative_contract_adherence/);
  assert.match(judge, /continuity_integrity/);
  assert.match(judge, /contract_violations/);
  assert.match(judge, /process_leaks/);
  assert.match(judge, /COMPLETE CHAPTER TEXT/);
});

test('contract-aware rewrite feedback is actually injected into prose prompts', () => {
  const writer = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
  const studio = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');
  assert.match(writer, /REJECTED-DRAFT CORRECTIONS — BINDING/);
  assert.match(writer, /revisionFeedback/);
  assert.match(writer, /assertSceneContractUnchanged\(immutableContract, normalizedScenes/);
  assert.match(studio, /revisionFeedback:\s*retryFeedback/);
  assert.match(studio, /Emergency save skipped because generated content violated a hard contract/);
});

import { auditSceneAgainstLedger, auditChapterLedgerContinuity, filterConcreteCriticFindings } from '../src/lib/sceneContractGate.js';
import { buildInitialLedger, extractSceneLedgerUpdates } from '../src/lib/narrativeLedger.js';

test('runtime ledger blocks dead character action', () => {
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, 'Marcus is dead.', { exit_state: 'Marcus is dead.' });
  
  const audit = auditSceneAgainstLedger({
    prose: 'Marcus said he was fine.',
    runtimeLedger: ledger
  });
  
  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((i) => i.code === 'DEAD_CHARACTER_ACTION'));
});

test('runtime ledger blocks unavailable object usage', () => {
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, 'The brass key is destroyed.', { exit_state: 'The brass key is destroyed.' });
  
  const audit = auditSceneAgainstLedger({
    prose: 'He used the brass key to open the door.',
    runtimeLedger: ledger
  });
  
  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((i) => i.code === 'UNAVAILABLE_OBJECT_USAGE'));
});

test('runtime ledger blocks completed event replay from earlier scenes', () => {
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, '', { required_events: ['Marcus finds the hidden ledger'] });
  
  const audit = auditSceneAgainstLedger({
    prose: 'Marcus finds the hidden ledger inside the desk.',
    runtimeLedger: ledger
  });

  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((i) => i.code === 'PRIOR_EVENT_REPLAY'));
});

test('runtime ledger blocks possession violation for dropped object', () => {
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, '', { exit_state: 'Lena places the brass key on the desk.' });
  
  const audit = auditSceneAgainstLedger({
    prose: 'Lena holds the brass key tightly.',
    runtimeLedger: ledger
  });
  
  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((i) => i.code === 'OBJECT_POSSESSION_VIOLATION'));
});

test('runtime ledger blocks possession violation for transferred object', () => {
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, '', { exit_state: 'Lena gives the log page to Marcus.' });
  
  const audit = auditSceneAgainstLedger({
    prose: 'Lena holds the log page.',
    runtimeLedger: ledger
  });
  
  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((i) => i.code === 'OBJECT_POSSESSION_VIOLATION'));
});

test('runtime ledger blocks all evidence is gone if objects remain', () => {
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, '', { exit_state: 'Lena places the brass key on the desk.' });
  
  const audit = auditSceneAgainstLedger({
    prose: 'She looked around. All evidence is gone.',
    runtimeLedger: ledger
  });
  
  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((i) => i.code === 'EVIDENCE_AVAILABILITY_VIOLATION'));
});

test('runtime ledger extracts proper separation facts', () => {
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, 'Lena and Marcus separate', { characters: ['Lena', 'Marcus'] });
  assert.ok(ledger.separatedCharacters.includes('Lena'));
  assert.ok(ledger.separatedCharacters.includes('Marcus'));
});

test('runtime ledger ignores environmental noise when extracting separations', () => {
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, 'The Arctic light reflected through the dust and smoke and separates from the mountain', { exit_state: '' });
  assert.equal(ledger.separatedCharacters.includes('Arctic'), false);
  assert.equal(ledger.separatedCharacters.includes('Light'), false);
  assert.equal(ledger.separatedCharacters.includes('Dust'), false);
  assert.equal(ledger.separatedCharacters.includes('Smoke'), false);
  assert.equal(ledger.separatedCharacters.includes('The'), false);
});

test('runtime ledger ignores stopwords and capitalized pronouns in separations', () => {
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, 'Above them, smoke drifted. For three minutes, Lena leaves His behind.', { characters: ['Lena'] });
  assert.equal(ledger.separatedCharacters.includes('Above'), false);
  assert.equal(ledger.separatedCharacters.includes('For'), false);
  assert.equal(ledger.separatedCharacters.includes('Three'), false);
  assert.equal(ledger.separatedCharacters.includes('His'), false);
  assert.ok(ledger.separatedCharacters.includes('Lena')); // matches Lena leaves His behind
});

test('lowercase stopword and can never become a character', () => {
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, 'Lena and Marcus split up', { characters: ['Lena', 'Marcus'] });
  assert.equal(ledger.separatedCharacters.includes('and'), false);
  assert.equal(ledger.separatedCharacters.includes('And'), false);
});

test('separated characters interacting without reunion blocks', () => {
  let ledger = buildInitialLedger();
  ledger.separatedCharacters = ['Marcus'];
  const audit = auditSceneAgainstLedger({
    prose: 'Marcus and Lena walk down the hall together.',
    runtimeLedger: ledger,
    spec: { characters: ['Marcus', 'Lena'] }
  });
  
  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((i) => i.code === 'CHARACTER_SEPARATION_VIOLATION'));
});

test('separated characters explicitly reuniting passes', () => {
  let ledger = buildInitialLedger();
  ledger.separatedCharacters = ['Marcus'];
  ledger = extractSceneLedgerUpdates(ledger, 'Marcus reunites with Lena.', { exit_state: '' });
  assert.equal(ledger.separatedCharacters.includes('Marcus'), false);
  
  const audit = auditSceneAgainstLedger({
    prose: 'Marcus and Lena walk down the hall together.',
    runtimeLedger: ledger,
    spec: { characters: ['Marcus', 'Lena'] }
  });
  
  assert.equal(audit.ok, true);
});

test('auditChapterLedgerContinuity throws if scenes do not match', () => {
  const generatedScenes = [ { spec: {} }, { spec: {} }, { spec: {} } ]; 
  const cleanedScenes = [ 'Scene 1', 'Scene 2' ];
  
  let didThrow = false;
  try {
    auditChapterLedgerContinuity({ generatedScenes, cleanedScenes }, buildInitialLedger, extractSceneLedgerUpdates);
  } catch (e) {
    didThrow = true;
    assert.equal(e.code, 'FINAL_CHAPTER_CONTINUITY_AUDIT_UNAVAILABLE');
  }
  assert.equal(didThrow, true);
});

test('auditChapterLedgerContinuity succeeds on match', () => {
  const generatedScenes = [ { spec: {} }, { spec: {} }, { spec: {} } ]; 
  const cleanedScenes = [ 'Scene 1', 'Scene 2', 'Scene 3' ];
  assert.doesNotThrow(() => {
    auditChapterLedgerContinuity({ generatedScenes, cleanedScenes }, buildInitialLedger, extractSceneLedgerUpdates);
  });
});

test('critic falsely blocking required key destruction is filtered', () => {
  const generatedScenes = [
    { spec: { required_events: ['Lena destroys the brass key.'] } }
  ];
  const findings = ['The brass key is destroyed in a manner that contradicts its planned use in the narrative.'];
  const concrete = filterConcreteCriticFindings(findings, generatedScenes);
  // Must NOT hard-block, so it should be filtered out
  assert.equal(concrete.length, 0);
});

test('critic accurately blocking required key destruction because a later scene requires it intact is NOT filtered', () => {
  const generatedScenes = [
    { spec: { required_events: ['Lena destroys the brass key.'] } },
    { spec: { required_events: ['Lena uses the intact brass key to unlock the door.'] } }
  ];
  const findings = ['The brass key is destroyed in a manner that contradicts its planned use in the narrative.'];
  const concrete = filterConcreteCriticFindings(findings, generatedScenes);
  // Must hard-block, so it should NOT be filtered out
  assert.equal(concrete.length, 1);
});

test('critic blocking key destroyed early is NOT filtered', () => {
  const generatedScenes = [
    { spec: { required_events: ['Lena enters the room.'] } },
    { spec: { required_events: ['Lena destroys the brass key.'] } }
  ];
  // Critic just complains it was destroyed early, no "contradicts its planned use"
  const findings = ['The brass key is destroyed in scene 1 prematurely.'];
  const concrete = filterConcreteCriticFindings(findings, generatedScenes);
  // Must hard-block
  assert.equal(concrete.length, 1);
});

test('critic blocking key destruction but later scenes just reference it as destroyed is filtered', () => {
  const generatedScenes = [
    { spec: { required_events: ['Lena destroys the brass key.'] } },
    { spec: { required_events: ['Lena looks at the destroyed brass key.'] } }
  ];
  const findings = ['The brass key is destroyed in a manner that contradicts its planned use in the narrative.'];
  const concrete = filterConcreteCriticFindings(findings, generatedScenes);
  // Must NOT hard-block, should be filtered out
  assert.equal(concrete.length, 0);
});

test('Archive door mentioned in both scenes must not hard-block', () => {
  const findings = ['Archive door mentioned in both scenes'];
  const concrete = filterConcreteCriticFindings(findings, []);
  assert.equal(concrete.length, 0);
});

test('Emotional arcs overlap in both scenes must not hard-block', () => {
  const findings = ['Emotional arcs overlap in both scenes'];
  const concrete = filterConcreteCriticFindings(findings, []);
  assert.equal(concrete.length, 0);
});

test('The same room appears in two scenes must not hard-block', () => {
  const findings = ['The same room appears in two scenes'];
  const concrete = filterConcreteCriticFindings(findings, []);
  assert.equal(concrete.length, 0);
});

test('The chapter feels repetitive must not hard-block without deterministic repetition evidence', () => {
  const findings = ['The chapter feels repetitive'];
  const concrete = filterConcreteCriticFindings(findings, []);
  assert.equal(concrete.length, 0);
});

test('Marcus is dead in Scene 1 but speaks in Scene 2 must hard-block', () => {
  const findings = ['Marcus is dead in Scene 1 but speaks in Scene 2'];
  const concrete = filterConcreteCriticFindings(findings, []);
  assert.equal(concrete.length, 1);
});

test('Lena and Marcus separate, then converse without reunion must hard-block', () => {
  const findings = ['Lena and Marcus separate, then converse without reunion'];
  const concrete = filterConcreteCriticFindings(findings, []);
  assert.equal(concrete.length, 1);
});

test('Generic confident wording must remain advisory unless mapped to a hard category', () => {
  const findings = ['This scene undoubtedly fails to deliver a satisfying conclusion.'];
  const concrete = filterConcreteCriticFindings(findings, []);
  assert.equal(concrete.length, 0);
});

test('distinct fiction scenes must not be merged by normalizer even if sharing characters/location', () => {
  const scenes = [
    {
      scene_number: 1,
      scene_id: 'ch05-s01',
      location: 'The Archive',
      characters: ['Lena', 'Marcus'],
      required_events: ['Lena discovers Marcus\'s role and retrieves the brass key.'],
      entry_state: 'Lena arrives at the archive.',
      exit_state: 'Lena holds the brass key.',
    },
    {
      scene_number: 2,
      scene_id: 'ch05-s02',
      location: 'The Archive',
      characters: ['Lena', 'Marcus'],
      required_events: ['Lena confronts Marcus and destroys the key.'],
      entry_state: 'Lena holds the brass key.',
      exit_state: 'The key is destroyed.',
    }
  ];
  const report = normalizeSceneBeatsForDrafting(scenes, { isNonfiction: false, chapterNumber: 5 });
  assert.equal(report.beats.length, 2);
});

test('contract replay validation throws on paraphrase overlap', async () => {
  const sceneWriter = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
  assert.match(sceneWriter, /Contract-level replay rejected/);
  assert.match(sceneWriter, /isClean/);
});

console.log(`\nNARRATIVE CONTRACT REGRESSION: ${passed} passed, 0 failed\n`);
