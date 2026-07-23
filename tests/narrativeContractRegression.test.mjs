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

import { auditSceneAgainstLedger } from '../src/lib/sceneContractGate.js';
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

console.log(`\nNARRATIVE CONTRACT REGRESSION: ${passed} passed, 0 failed\n`);
