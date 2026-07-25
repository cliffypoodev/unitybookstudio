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
  isSceneContextComposerEnabled,
  generateDeterministicEventId,
  generatePacketFingerprint,
  validateSceneExecutionPacket,
  SCENE_EXECUTION_PACKET_VERSION,
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
  assert.match(studio, /shouldBlockEmergencySave\(draftError\)/);
  assert.match(studio, /SCENE_CONTRACT_OVERLAP_UNRESOLVED/);
  assert.match(studio, /revisionFeedback:\s*retryFeedback/);
  assert.match(studio, /NARRATIVE_CONTRACT_UNRESOLVED/);
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

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 1 — SCENE EXECUTION PACKET SCHEMA AND DETERMINISTIC VALIDATOR TESTS
// ═══════════════════════════════════════════════════════════════════════════

// --- Shared test contract and packet builder ---

const BEAT_DATA = {
  scene_number: 1, scene_id: 'ch04-s01', pov_character: 'Lena',
  scene_goal: 'Vale makes the sacrifice.',
  entry_state: 'Vale, Lena, and Marcus are alive in the reactor chamber. Marcus holds the key.',
  required_events: ['Marcus gives the key to Vale.', 'Vale seals himself inside the chamber.'],
  forbidden_events: ['Vale must not die twice.', 'The archive must not reopen.'],
  exit_state: 'Vale is sealed inside. Lena and Marcus are outside. Vale holds the key.'
};

function makeContract(beatOverrides) {
  return createImmutableSceneContract({
    beats: [{ ...BEAT_DATA, ...(beatOverrides || {}) }]
  }, { chapterNumber: 4 });
}

function makeValidPacket(contract) {
  const evtId1 = generateDeterministicEventId('p1', 'c1', 'ch04-s01', 'required', 1, 'Marcus gives the key to Vale.');
  const evtId2 = generateDeterministicEventId('p1', 'c1', 'ch04-s01', 'required', 2, 'Vale seals himself inside the chamber.');
  const packet = {
    packet_version: SCENE_EXECUTION_PACKET_VERSION,
    snapshot_id: 'snap1',
    source_contract_fingerprint: contract.fingerprint,
    project_id: 'p1',
    chapter_id: 'c1',
    chapter_number: 4,
    scene_id: 'ch04-s01',
    scene_number: 1,
    scene_goal: 'Vale makes the sacrifice.',
    entry_state: 'Vale, Lena, and Marcus are alive in the reactor chamber. Marcus holds the key.',
    exit_state: 'Vale is sealed inside. Lena and Marcus are outside. Vale holds the key.',
    required_events: [
      { event_id: evtId1, text: 'Marcus gives the key to Vale.' },
      { event_id: evtId2, text: 'Vale seals himself inside the chamber.' }
    ],
    current_scene_forbidden_events: [
      'Vale must not die twice.',
      'The archive must not reopen.'
    ],
    future_reserved_events: [],
    continuity_dependencies: ['Prior scene exit state'],
    pov_identity: 'Lena',
    pov_known_facts: ['Lena knows Marcus has the key.'],
    scene_authorized_facts: [{
      fact_id: 'fact-001',
      summary: 'Marcus was entrusted with the key.',
      provenance: 'ch03-s02',
      knowledge_scope: 'lena-pov'
    }],
    current_locations: ['reactor chamber'],
    current_possessions: ['Marcus: brass key'],
    current_injuries: ['Lena: bruised ribs'],
    confirmed_deaths: ['Dr. Vasquez'],
    current_separations: ['Eli is trapped in the archive'],
    unavailable_objects: ['broken radio'],
    canonically_unique_objects: ['brass key'],
    completed_events: ['evt_prior_1'],
    voice_rules: ['First-person Lena POV', 'Present tense'],
    immediate_continuity: 'Marcus held out the key, his hand trembling.'
  };
  packet.packet_id = generatePacketFingerprint(packet);
  return packet;
}

// --- Feature flag tests ---

await test('Feature flag is disabled by default', () => {
  assert.equal(isSceneContextComposerEnabled(), false);
  assert.equal(isSceneContextComposerEnabled({}), false);
  assert.equal(isSceneContextComposerEnabled(null), false);
  assert.equal(isSceneContextComposerEnabled(undefined), false);
});

await test('Only explicit Boolean true enables feature flag', () => {
  assert.equal(isSceneContextComposerEnabled({ scene_context_composer_v1: 'true' }), false);
  assert.equal(isSceneContextComposerEnabled({ scene_context_composer_v1: 1 }), false);
  assert.equal(isSceneContextComposerEnabled({ scene_context_composer_v1: true }), true);
});

// --- Deterministic event ID tests ---

await test('Deterministic event IDs are stable for identical inputs', () => {
  const id1 = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'Event text');
  const id2 = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'Event text');
  assert.equal(id1, id2);
  assert.match(id1, /^evt_[0-9a-f]{8}$/);
});

await test('Event IDs are sensitive to project ID', () => {
  const a = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'E');
  const b = generateDeterministicEventId('p2', 'c1', 's1', 'required', 1, 'E');
  assert.notEqual(a, b);
});

await test('Event IDs are sensitive to chapter ID', () => {
  const a = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'E');
  const b = generateDeterministicEventId('p1', 'c2', 's1', 'required', 1, 'E');
  assert.notEqual(a, b);
});

await test('Event IDs are sensitive to scene ID', () => {
  const a = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'E');
  const b = generateDeterministicEventId('p1', 'c1', 's2', 'required', 1, 'E');
  assert.notEqual(a, b);
});

await test('Event IDs are sensitive to category', () => {
  const a = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'E');
  const b = generateDeterministicEventId('p1', 'c1', 's1', 'future', 1, 'E');
  assert.notEqual(a, b);
});

await test('Event IDs are sensitive to ordinal', () => {
  const a = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'E');
  const b = generateDeterministicEventId('p1', 'c1', 's1', 'required', 2, 'E');
  assert.notEqual(a, b);
});

await test('Event IDs are sensitive to normalized event text', () => {
  const a = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'Text A');
  const b = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'Text B');
  assert.notEqual(a, b);
});

// --- Populated valid packet passes ---

await test('Valid populated packet passes all validation', () => {
  const contract = makeContract();
  const packet = makeValidPacket(contract);
  const result = validateSceneExecutionPacket(packet, contract);
  assert.ok(result);
  assert.equal(result.packet_version, SCENE_EXECUTION_PACKET_VERSION);
  assert.equal(result.scene_authorized_facts.length, 1);
  assert.equal(result.current_locations.length, 1);
  assert.equal(result.current_possessions.length, 1);
  assert.equal(result.current_injuries.length, 1);
  assert.equal(result.confirmed_deaths.length, 1);
  assert.equal(result.current_separations.length, 1);
  assert.equal(result.unavailable_objects.length, 1);
  assert.equal(result.canonically_unique_objects.length, 1);
  assert.equal(result.completed_events.length, 1);
  assert.equal(result.voice_rules.length, 2);
  assert.equal(result.continuity_dependencies.length, 1);
  assert.equal(result.pov_known_facts.length, 1);
});

// --- Deep freeze tests ---

await test('Valid packet is returned deeply frozen', () => {
  const contract = makeContract();
  const packet = makeValidPacket(contract);
  const result = validateSceneExecutionPacket(packet, contract);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.required_events));
  assert.ok(Object.isFrozen(result.required_events[0]));
  assert.ok(Object.isFrozen(result.current_scene_forbidden_events));
  assert.ok(Object.isFrozen(result.future_reserved_events));
  assert.ok(Object.isFrozen(result.scene_authorized_facts));
  assert.ok(Object.isFrozen(result.scene_authorized_facts[0]));
  assert.ok(Object.isFrozen(result.current_locations));
  assert.ok(Object.isFrozen(result.current_possessions));
  assert.ok(Object.isFrozen(result.current_injuries));
  assert.ok(Object.isFrozen(result.confirmed_deaths));
  assert.ok(Object.isFrozen(result.current_separations));
  assert.ok(Object.isFrozen(result.unavailable_objects));
  assert.ok(Object.isFrozen(result.canonically_unique_objects));
  assert.ok(Object.isFrozen(result.completed_events));
  assert.ok(Object.isFrozen(result.voice_rules));
  assert.ok(Object.isFrozen(result.continuity_dependencies));
  assert.ok(Object.isFrozen(result.pov_known_facts));
});

await test('Validation does not mutate the original packet', () => {
  const contract = makeContract();
  const packet = makeValidPacket(contract);
  const origGoal = packet.scene_goal;
  const result = validateSceneExecutionPacket(packet, contract);
  assert.notEqual(packet, result);
  assert.equal(Object.isFrozen(packet), false);
  assert.equal(packet.scene_goal, origGoal);
});

// --- Fingerprint tests ---

await test('Packet fingerprints are stable for identical packets', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  assert.equal(p1.packet_id, p2.packet_id);
  assert.match(p1.packet_id, /^sep_[0-9a-f]{8}$/);
});

await test('Reordered object properties produce identical fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  // Build a packet with reversed property insertion order
  const keys = Object.keys(p1).filter(k => k !== 'packet_id');
  const reversed = {};
  for (const k of keys.reverse()) reversed[k] = p1[k];
  reversed.packet_id = generatePacketFingerprint(reversed);
  assert.equal(p1.packet_id, reversed.packet_id);
});

await test('Changing scene_goal changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  p2.scene_goal = 'Changed goal';
  assert.notEqual(p1.packet_id, generatePacketFingerprint(p2));
});

await test('Changing entry_state changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  p2.entry_state = 'Changed';
  assert.notEqual(p1.packet_id, generatePacketFingerprint(p2));
});

await test('Changing exit_state changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  p2.exit_state = 'Changed';
  assert.notEqual(p1.packet_id, generatePacketFingerprint(p2));
});

await test('Changing pov_identity changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  p2.pov_identity = 'Marcus';
  assert.notEqual(p1.packet_id, generatePacketFingerprint(p2));
});

await test('Changing voice_rules changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  p2.voice_rules = ['Third-person'];
  assert.notEqual(p1.packet_id, generatePacketFingerprint(p2));
});

await test('Changing immediate_continuity changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  p2.immediate_continuity = 'Changed text';
  assert.notEqual(p1.packet_id, generatePacketFingerprint(p2));
});

await test('Changing source_contract_fingerprint changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  p2.source_contract_fingerprint = 'different';
  assert.notEqual(p1.packet_id, generatePacketFingerprint(p2));
});

await test('Changing snapshot_id changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  p2.snapshot_id = 'snap2';
  assert.notEqual(p1.packet_id, generatePacketFingerprint(p2));
});

await test('Changing scene_authorized_facts changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  p2.scene_authorized_facts = [];
  assert.notEqual(p1.packet_id, generatePacketFingerprint(p2));
});

await test('Changing confirmed_deaths changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  p2.confirmed_deaths = [];
  assert.notEqual(p1.packet_id, generatePacketFingerprint(p2));
});

// --- All errors carry issues array ---

await test('All validation errors include a non-empty frozen issues array', () => {
  const contract = makeContract();
  const packet = makeValidPacket(contract);
  packet.packet_version = 'wrong';
  packet.packet_id = generatePacketFingerprint(packet);
  try {
    validateSceneExecutionPacket(packet, contract);
    assert.fail('Expected error');
  } catch (e) {
    assert.ok(Array.isArray(e.issues), 'issues must be an array');
    assert.ok(e.issues.length > 0, 'issues must be non-empty');
    assert.ok(Object.isFrozen(e.issues), 'issues must be frozen');
    assert.ok(typeof e.code === 'string', 'code must be a string');
  }
});

// --- Missing identity fields ---

await test('Missing project_id fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.project_id = '';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'MISSING_IDENTITY');
});

await test('Missing snapshot_id fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.snapshot_id = '';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'MISSING_SNAPSHOT_ID');
});

// --- Wrong packet version ---

await test('Wrong packet version fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.packet_version = 'wrong';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'WRONG_PACKET_VERSION');
});

// --- Contract fingerprint mismatch ---

await test('Wrong contract fingerprint fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.source_contract_fingerprint = 'wrong';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'CONTRACT_FINGERPRINT_MISMATCH');
});

// --- Scene identity and number mismatch ---

await test('Scene identity mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_id = 'ch04-s99';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'SCENE_IDENTITY_MISMATCH');
});

await test('Scene number mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_number = 99;
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'SCENE_NUMBER_MISMATCH');
});

// --- Scene goal mismatch ---

await test('Scene goal mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_goal = 'Wrong goal';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'SCENE_GOAL_MISMATCH');
});

// --- Entry-state and exit-state mismatch ---

await test('Entry-state mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.entry_state = 'Wrong entry';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'ENTRY_STATE_MISMATCH');
});

await test('Exit-state mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.exit_state = 'Wrong exit';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'EXIT_STATE_MISMATCH');
});

// --- Required event: modification, reordering, omission, addition ---

await test('Required event text modification fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0].text = 'Modified text.';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'REQUIRED_EVENTS_MISMATCH');
});

await test('Required event reordering fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events = [p.required_events[1], p.required_events[0]];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'REQUIRED_EVENTS_MISMATCH');
});

await test('Required event omission fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events = [p.required_events[0]];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'REQUIRED_EVENTS_MISMATCH');
});

await test('Required event addition fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const extra = { event_id: 'evt_fake1234', text: 'Extra event.' };
  p.required_events.push(extra);
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'REQUIRED_EVENTS_MISMATCH');
});

await test('Required event deterministic ID mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0].event_id = 'evt_invented';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'EVENT_ID_MISMATCH');
});

// --- Forbidden event: modification, reordering, omission, addition ---

await test('Forbidden event modification fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.current_scene_forbidden_events[0] = 'Modified forbidden.';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'FORBIDDEN_EVENTS_MISMATCH');
});

await test('Forbidden event reordering fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.current_scene_forbidden_events = [p.current_scene_forbidden_events[1], p.current_scene_forbidden_events[0]];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'FORBIDDEN_EVENTS_MISMATCH');
});

await test('Forbidden event omission fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.current_scene_forbidden_events = [p.current_scene_forbidden_events[0]];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'FORBIDDEN_EVENTS_MISMATCH');
});

await test('Forbidden event addition fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.current_scene_forbidden_events.push('Extra forbidden.');
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'FORBIDDEN_EVENTS_MISMATCH');
});

// --- Duplicate ID tests ---

await test('Duplicate future-reserved event IDs fail closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events = [{ event_id: 'evt_dup' }, { event_id: 'evt_dup' }];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'DUPLICATE_EVENT_ID');
});

await test('Duplicate completed event IDs fail closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.completed_events = ['evt_done', 'evt_done'];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'DUPLICATE_EVENT_ID');
});

await test('Duplicate fact IDs fail closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts = [
    { fact_id: 'f1', summary: 'A', provenance: 'ch01', knowledge_scope: 'lena' },
    { fact_id: 'f1', summary: 'B', provenance: 'ch02', knowledge_scope: 'lena' }
  ];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'DUPLICATE_FACT_ID');
});

// --- Required/future event overlap ---

await test('Event appearing as both required and future-reserved fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events = [{ event_id: p.required_events[0].event_id }];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'REQUIRED_AND_FUTURE_EVENT');
});

// --- Prohibited raw foundation keys (table-driven) ---

const PROHIBITED_RAW_KEYS = [
  'world_md', 'characters_md', 'outline_md', 'canon_md', 'mystery_md', 'twists_md', 'research_md',
  'voice_md', 'story_bible', 'book_outline', 'chapter_collection', 'later_scene_contracts',
  'twist_truth', 'mystery_truth', 'reveal_truth', 'future_truth',
  'withheld_facts', 'private_knowledge',
  'project_records', 'chapter_records', 'prior_chapter_prose', 'accumulated_manuscript', 'prompt_text'
];

for (const key of PROHIBITED_RAW_KEYS) {
  await test(`Prohibited key "${key}" is rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[key] = 'injected';
    p.packet_id = generatePacketFingerprint(p);
    assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'PROHIBITED_KEY');
  });
}

// --- Unknown top-level key ---

await test('Unknown top-level key fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.arbitrary_field = 'bad';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'UNKNOWN_KEY');
});

// --- Unknown nested keys in future_reserved_events ---

for (const key of ['description', 'outcome', 'participants', 'object_truth', 'reveal_text', 'explanation', 'payload', 'text', 'prose']) {
  await test(`Future-reserved event with unknown key "${key}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.future_reserved_events = [{ event_id: 'evt_f1', [key]: 'injected' }];
    p.packet_id = generatePacketFingerprint(p);
    assert.throws(() => validateSceneExecutionPacket(p, contract),
      e => e.code === 'UNKNOWN_NESTED_KEY' || e.code === 'PROHIBITED_SECRET_TRUTH');
  });
}

// --- Secret/truth/withheld payloads in future events ---

for (const key of ['secret', 'truth', 'secret_payload', 'withheld_facts', 'private_knowledge']) {
  await test(`Future-reserved event with secret field "${key}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.future_reserved_events = [{ event_id: 'evt_f1', [key]: 'injected' }];
    p.packet_id = generatePacketFingerprint(p);
    assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'PROHIBITED_SECRET_TRUTH');
  });
}

// --- Unknown nested keys in scene_authorized_facts ---

await test('Authorized fact with unknown nested key fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts = [{ fact_id: 'f1', summary: 'A', provenance: 'ch01', knowledge_scope: 'lena', extra: 'bad' }];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'UNKNOWN_NESTED_KEY');
});

await test('Authorized fact with withheld field fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts = [{ fact_id: 'f1', summary: 'A', provenance: 'ch01', knowledge_scope: 'lena', withheld_from: 'Marcus' }];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'PROHIBITED_SECRET_TRUTH');
});

await test('Authorized fact with private field fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts = [{ fact_id: 'f1', summary: 'A', provenance: 'ch01', knowledge_scope: 'lena', private_note: 'hidden' }];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'PROHIBITED_SECRET_TRUTH');
});

// --- Unknown nested keys in required_events ---

await test('Required event with unknown nested key fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0].extra = 'bad';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'UNKNOWN_NESTED_KEY');
});

// --- Oversized immediate continuity ---

await test('Oversized immediate-continuity text fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.immediate_continuity = 'A'.repeat(2001);
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'CONTINUITY_TOO_LARGE');
});

// --- Packet fingerprint mismatch ---

await test('Tampered packet_id fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.packet_id = 'sep_tampered';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'PACKET_FINGERPRINT_MISMATCH');
});

// --- Immutable contract mutation detection ---

await test('Existing immutable-contract mutation detection remains intact', () => {
  const contract = createImmutableSceneContract({
    beats: [{ ...BEAT_DATA }]
  }, { chapterNumber: 4 });
  // The contract itself is frozen
  assert.ok(Object.isFrozen(contract));
  assert.ok(Object.isFrozen(contract.beats));
  assert.ok(Object.isFrozen(contract.beats[0]));
  // assertSceneContractUnchanged with valid data succeeds
  assert.doesNotThrow(() => assertSceneContractUnchanged(contract, contract.beats, { chapterNumber: 4 }));
});

// --- Existing contract and provenance behavior unchanged ---

await test('Existing createImmutableSceneContract and assertSceneContractUnchanged behavior unchanged', () => {
  const contract = createImmutableSceneContract({
    beats: [{ ...BEAT_DATA }]
  }, { chapterNumber: 4 });
  assert.equal(contract.version, 'fiction-scene-contract-v2');
  assert.ok(contract.fingerprint);
  assert.equal(contract.chapterNumber, 4);
  assert.equal(contract.beats.length, 1);
  assert.equal(contract.beats[0].scene_id, 'ch04-s01');

  const result = assertSceneContractUnchanged(contract, contract.beats, { chapterNumber: 4 });
  assert.ok(result.ok);
  assert.equal(result.fingerprint, contract.fingerprint);
});

console.log(`\nSTAGE 1 TESTS COMPLETE: ${passed - 8} SEP tests passed (${passed} total including baseline)\n`);
