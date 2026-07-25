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
  SCENE_CONTEXT_COMPOSER_FEATURE,
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
// STAGE 1B — HARDENED SCENE EXECUTION PACKET VALIDATION TESTS
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
    pov_known_facts: ['fact-001'],
    scene_authorized_facts: [{
      fact_id: 'fact-001',
      summary: 'Marcus was entrusted with the key.',
      provenance: 'ch03-s02',
      knowledge_scope: {
        pov_identity: 'Lena',
        basis: 'Lena witnessed the transfer in ch03-s02.'
      }
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

function clonePacket(packet) {
  return JSON.parse(JSON.stringify(packet));
}

// Deep equality check that does NOT use JSON (preserves reference identity check)
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!bKeys.includes(k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

// ─── Feature definition tests ──────────────────────────────────────────

await test('SCENE_CONTEXT_COMPOSER_FEATURE is an immutable exported definition', () => {
  assert.ok(SCENE_CONTEXT_COMPOSER_FEATURE);
  assert.equal(SCENE_CONTEXT_COMPOSER_FEATURE.key, 'scene_context_composer_v1');
  assert.equal(SCENE_CONTEXT_COMPOSER_FEATURE.defaultEnabled, false);
  assert.ok(Object.isFrozen(SCENE_CONTEXT_COMPOSER_FEATURE));
});

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

// ─── Deterministic event ID tests ──────────────────────────────────────

await test('Deterministic event IDs are stable for identical inputs', () => {
  const id1 = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'Event text');
  const id2 = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'Event text');
  assert.equal(id1, id2);
  assert.match(id1, /^evt_[0-9a-f]{8}$/);
});

for (const [label, args] of [
  ['project ID', ['p2', 'c1', 's1', 'required', 1, 'E']],
  ['chapter ID', ['p1', 'c2', 's1', 'required', 1, 'E']],
  ['scene ID', ['p1', 'c1', 's2', 'required', 1, 'E']],
  ['category', ['p1', 'c1', 's1', 'future', 1, 'E']],
  ['ordinal', ['p1', 'c1', 's1', 'required', 2, 'E']],
  ['event text', ['p1', 'c1', 's1', 'required', 1, 'F']],
]) {
  await test(`Event IDs are sensitive to ${label}`, () => {
    const base = generateDeterministicEventId('p1', 'c1', 's1', 'required', 1, 'E');
    assert.notEqual(base, generateDeterministicEventId(...args));
  });
}

// ─── Populated valid packet passes ─────────────────────────────────────

await test('Valid populated packet passes all validation', () => {
  const contract = makeContract();
  const packet = makeValidPacket(contract);
  const result = validateSceneExecutionPacket(packet, contract);
  assert.ok(result);
  assert.equal(result.packet_version, SCENE_EXECUTION_PACKET_VERSION);
  assert.equal(result.scene_authorized_facts.length, 1);
  assert.equal(result.scene_authorized_facts[0].knowledge_scope.pov_identity, 'Lena');
  assert.equal(result.pov_known_facts[0], 'fact-001');
  assert.equal(result.current_locations.length, 1);
  assert.equal(result.completed_events.length, 1);
  assert.equal(result.voice_rules.length, 2);
});

// ─── Deep freeze tests ─────────────────────────────────────────────────

await test('Valid packet is returned deeply frozen including knowledge_scope', () => {
  const contract = makeContract();
  const result = validateSceneExecutionPacket(makeValidPacket(contract), contract);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.required_events));
  assert.ok(Object.isFrozen(result.required_events[0]));
  assert.ok(Object.isFrozen(result.scene_authorized_facts));
  assert.ok(Object.isFrozen(result.scene_authorized_facts[0]));
  assert.ok(Object.isFrozen(result.scene_authorized_facts[0].knowledge_scope));
  assert.ok(Object.isFrozen(result.current_locations));
  assert.ok(Object.isFrozen(result.voice_rules));
  assert.ok(Object.isFrozen(result.completed_events));
  assert.ok(Object.isFrozen(result.pov_known_facts));
});

await test('Validation does not mutate the original packet', () => {
  const contract = makeContract();
  const packet = makeValidPacket(contract);
  const before = clonePacket(packet);
  const result = validateSceneExecutionPacket(packet, contract);
  assert.notEqual(packet, result);
  assert.equal(Object.isFrozen(packet), false);
  assert.ok(deepEqual(packet, before));
});

await test('Validation does not mutate the supplied contract', () => {
  const contract = makeContract();
  const beforeFp = contract.fingerprint;
  const beforeBeats = JSON.stringify(contract.beats);
  validateSceneExecutionPacket(makeValidPacket(contract), contract);
  assert.equal(contract.fingerprint, beforeFp);
  assert.equal(JSON.stringify(contract.beats), beforeBeats);
});

// ─── Recursive fingerprint integrity ───────────────────────────────────

await test('FP1: Changing required-event event_id changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p);
  delete p2.packet_id;
  p2.required_events[0].event_id = 'evt_changed1';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP2: Changing required-event text changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p);
  delete p2.packet_id;
  p2.required_events[0].text = 'Changed text.';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP3: Changing future-reserved event_id changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events = [{ event_id: 'evt_future_1' }];
  p.packet_id = generatePacketFingerprint(p);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p);
  delete p2.packet_id;
  p2.future_reserved_events[0].event_id = 'evt_future_2';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP4: Changing authorized-fact fact_id changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p);
  delete p2.packet_id;
  p2.scene_authorized_facts[0].fact_id = 'fact-changed';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP5: Changing authorized-fact summary changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p);
  delete p2.packet_id;
  p2.scene_authorized_facts[0].summary = 'Changed summary.';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP6: Changing authorized-fact provenance changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p);
  delete p2.packet_id;
  p2.scene_authorized_facts[0].provenance = 'ch99-s99';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP7: Changing knowledge-scope pov_identity changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p);
  delete p2.packet_id;
  p2.scene_authorized_facts[0].knowledge_scope.pov_identity = 'Marcus';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP8: Changing knowledge-scope basis changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p);
  delete p2.packet_id;
  p2.scene_authorized_facts[0].knowledge_scope.basis = 'Different basis.';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP9: Reordering keys inside a required-event record does not change fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p);
  delete p2.packet_id;
  // Rebuild event with reversed key order
  const e = p2.required_events[0];
  p2.required_events[0] = { text: e.text, event_id: e.event_id };
  assert.equal(fp1, generatePacketFingerprint(p2));
});

await test('FP10: Reordering keys inside knowledge-scope does not change fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p);
  delete p2.packet_id;
  const ks = p2.scene_authorized_facts[0].knowledge_scope;
  p2.scene_authorized_facts[0].knowledge_scope = { basis: ks.basis, pov_identity: ks.pov_identity };
  assert.equal(fp1, generatePacketFingerprint(p2));
});

await test('FP11: Reordering top-level properties does not change fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const keys = Object.keys(p).filter(k => k !== 'packet_id');
  const reversed = {};
  for (const k of keys.reverse()) reversed[k] = p[k];
  reversed.packet_id = generatePacketFingerprint(reversed);
  assert.equal(p.packet_id, reversed.packet_id);
});

await test('FP12: Each authority-bearing top-level field changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  for (const field of ['scene_goal', 'entry_state', 'exit_state', 'pov_identity',
    'snapshot_id', 'source_contract_fingerprint', 'project_id', 'chapter_id', 'scene_id']) {
    const p2 = clonePacket(p);
    delete p2.packet_id;
    p2[field] = 'changed_value_unique';
    assert.notEqual(fp1, generatePacketFingerprint(p2), `Changing ${field} must change fingerprint`);
  }
});

await test('FP13: Array order is fingerprint-significant', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules = ['Rule A', 'Rule B'];
  p.packet_id = generatePacketFingerprint(p);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p);
  delete p2.packet_id;
  p2.voice_rules = ['Rule B', 'Rule A'];
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP14: packet_id itself is excluded from fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const p2 = clonePacket(p);
  p2.packet_id = 'completely_different_id';
  // generatePacketFingerprint excludes packet_id
  assert.equal(generatePacketFingerprint(p), generatePacketFingerprint(p2));
});

// ─── JSON/model safety (table-driven) ──────────────────────────────────

const JSON_UNSAFE_VALUES = [
  ['undefined', undefined],
  ['NaN', NaN],
  ['positive Infinity', Infinity],
  ['negative Infinity', -Infinity],
  ['function', () => {}],
  ['symbol', Symbol('bad')],
  ['BigInt', BigInt(42)],
  ['Date object', new Date()],
  ['class instance', new (class Foo {})()],
];

for (const [label, badValue] of JSON_UNSAFE_VALUES) {
  await test(`JSON safety: ${label} in voice_rules rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.voice_rules = [badValue];
    p.packet_id = 'sep_dummy';
    assert.throws(() => validateSceneExecutionPacket(p, contract));
  });
}

await test('JSON safety: cyclic object rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const cyclic = { event_id: 'evt_cyc' };
  cyclic.self = cyclic;
  p.future_reserved_events = [cyclic];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract));
});

await test('JSON safety: sparse array rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const sparse = new Array(3);
  sparse[0] = 'a';
  sparse[2] = 'c';
  p.voice_rules = sparse;
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract));
});

await test('JSON safety: nested non-JSON-safe value rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].knowledge_scope.basis = undefined;
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract));
});

// ─── Required fields and exact types ───────────────────────────────────

// Missing string fields
for (const field of ['packet_version', 'snapshot_id', 'source_contract_fingerprint',
  'project_id', 'chapter_id', 'scene_id', 'scene_goal', 'entry_state', 'exit_state',
  'pov_identity', 'immediate_continuity', 'packet_id']) {
  await test(`Missing field "${field}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    delete p[field];
    assert.throws(() => validateSceneExecutionPacket(p, contract));
  });
}

// Missing array fields
for (const field of ['future_reserved_events', 'scene_authorized_facts', 'completed_events',
  'voice_rules', 'current_locations', 'current_possessions', 'current_injuries',
  'confirmed_deaths', 'current_separations', 'unavailable_objects',
  'canonically_unique_objects', 'continuity_dependencies', 'pov_known_facts',
  'required_events', 'current_scene_forbidden_events']) {
  await test(`Missing array "${field}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    delete p[field];
    assert.throws(() => validateSceneExecutionPacket(p, contract));
  });
}

// String-valued arrays fail (not silently treated as empty array)
for (const field of ['future_reserved_events', 'scene_authorized_facts', 'completed_events',
  'voice_rules', 'current_locations', 'current_possessions', 'current_injuries',
  'confirmed_deaths', 'current_separations', 'unavailable_objects',
  'canonically_unique_objects', 'continuity_dependencies', 'pov_known_facts']) {
  await test(`String-valued "${field}" fails closed (not treated as empty array)`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[field] = 'not-an-array';
    p.packet_id = 'sep_dummy';
    assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_FIELD_TYPE');
  });
}

// Wrong-type string fields
for (const field of ['packet_version', 'snapshot_id', 'source_contract_fingerprint',
  'project_id', 'chapter_id', 'scene_id', 'scene_goal', 'entry_state', 'exit_state',
  'pov_identity']) {
  await test(`Non-string "${field}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[field] = 42;
    p.packet_id = 'sep_dummy';
    assert.throws(() => validateSceneExecutionPacket(p, contract));
  });
}

// Numeric field tests
for (const [label, value] of [
  ['NaN', NaN], ['Infinity', Infinity], ['fractional', 3.5],
  ['zero', 0], ['negative', -1], ['string', '4']
]) {
  await test(`chapter_number = ${label} fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.chapter_number = value;
    p.packet_id = 'sep_dummy';
    assert.throws(() => validateSceneExecutionPacket(p, contract));
  });
  await test(`scene_number = ${label} fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.scene_number = value;
    p.packet_id = 'sep_dummy';
    assert.throws(() => validateSceneExecutionPacket(p, contract));
  });
}

// String array element type enforcement
await test('Non-string element in string array fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules = [42];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_FIELD_TYPE');
});

await test('Null element in string array fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules = [null];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_FIELD_TYPE');
});

await test('Empty string element in string array fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules = [''];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_FIELD_VALUE');
});

await test('Array element in string array fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules = [['nested']];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_FIELD_TYPE');
});

// ─── Nested validation: required events ────────────────────────────────

await test('Null required event rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0] = null;
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_RECORD');
});

await test('Primitive required event rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0] = 'just a string';
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_RECORD');
});

await test('Required event missing event_id rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.required_events[0].event_id;
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'UNKNOWN_NESTED_KEY' || e.code === 'MISSING_REQUIRED_FIELD');
});

await test('Required event missing text rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.required_events[0].text;
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'MISSING_REQUIRED_FIELD');
});

await test('Required event empty event_id rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0].event_id = '';
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract));
});

await test('Required event empty text rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0].text = '';
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract));
});

// ─── Nested validation: future-reserved events ─────────────────────────

await test('Null future event rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events = [null];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_RECORD');
});

await test('Primitive future event rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events = [42];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_RECORD');
});

await test('Future event missing event_id rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events = [{}];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'MISSING_REQUIRED_FIELD');
});

await test('Future event empty event_id rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events = [{ event_id: '' }];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract));
});

// ─── Nested validation: scene-authorized facts ─────────────────────────

await test('Null fact rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts = [null];
  p.pov_known_facts = [];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_RECORD');
});

await test('Primitive fact rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts = ['string-fact'];
  p.pov_known_facts = [];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_RECORD');
});

for (const missingField of ['fact_id', 'summary', 'provenance', 'knowledge_scope']) {
  await test(`Fact missing ${missingField} rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    const fact = clonePacket(p.scene_authorized_facts[0]);
    delete fact[missingField];
    p.scene_authorized_facts = [fact];
    p.pov_known_facts = missingField === 'fact_id' ? [] : [fact.fact_id];
    p.packet_id = 'sep_dummy';
    assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'MISSING_REQUIRED_FIELD');
  });
}

await test('Fact empty fact_id rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].fact_id = '';
  p.pov_known_facts = [];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract));
});

await test('Fact empty summary rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].summary = '';
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract));
});

await test('Fact empty provenance rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].provenance = '';
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract));
});

// ─── Knowledge scope validation ────────────────────────────────────────

await test('Missing knowledge scope pov_identity rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].knowledge_scope = { basis: 'Some basis.' };
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'MISSING_REQUIRED_FIELD');
});

await test('Missing knowledge scope basis rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].knowledge_scope = { pov_identity: 'Lena' };
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'MISSING_REQUIRED_FIELD');
});

await test('Wrong-POV knowledge scope rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].knowledge_scope = {
    pov_identity: 'Marcus',
    basis: 'Marcus saw the key.'
  };
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'KNOWLEDGE_SCOPE_POV_MISMATCH');
});

await test('Malformed knowledge scope (string) rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].knowledge_scope = 'lena-pov';
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_RECORD');
});

await test('Unknown knowledge scope key rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].knowledge_scope = {
    pov_identity: 'Lena',
    basis: 'Lena saw it.',
    secret_note: 'hidden'
  };
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'UNKNOWN_NESTED_KEY');
});

// ─── pov_known_facts resolution ────────────────────────────────────────

await test('pov_known_facts ID not found in scene_authorized_facts rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.pov_known_facts = ['nonexistent-fact-id'];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'UNRESOLVED_POV_FACT');
});

await test('Duplicate pov_known_facts ID rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.pov_known_facts = ['fact-001', 'fact-001'];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'DUPLICATE_POV_FACT_ID');
});

// ─── Completed events ──────────────────────────────────────────────────

await test('Non-string completed event ID rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.completed_events = [42];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_FIELD_TYPE');
});

await test('Empty completed event ID rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.completed_events = [''];
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'INVALID_FIELD_VALUE');
});

// ─── All existing Stage 1 invariants preserved ─────────────────────────

await test('Wrong packet version fails with WRONG_PACKET_VERSION', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.packet_version = 'wrong';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'WRONG_PACKET_VERSION');
});

await test('Wrong contract fingerprint fails with CONTRACT_FINGERPRINT_MISMATCH', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.source_contract_fingerprint = 'wrong';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'CONTRACT_FINGERPRINT_MISMATCH');
});

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

await test('Scene goal mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_goal = 'Wrong goal';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'SCENE_GOAL_MISMATCH');
});

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
  p.required_events.push({ event_id: 'evt_fake1234', text: 'Extra event.' });
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
    { ...clonePacket(p.scene_authorized_facts[0]), fact_id: 'f1' },
    { ...clonePacket(p.scene_authorized_facts[0]), fact_id: 'f1' }
  ];
  p.pov_known_facts = ['f1'];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'DUPLICATE_FACT_ID');
});

await test('Event appearing as both required and future-reserved fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events = [{ event_id: p.required_events[0].event_id }];
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'REQUIRED_AND_FUTURE_EVENT');
});

// ─── Prohibited keys (table-driven) ───────────────────────────────────

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

await test('Unknown top-level key fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.arbitrary_field = 'bad';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'UNKNOWN_KEY');
});

// ─── Nested key enforcement ────────────────────────────────────────────

for (const key of ['description', 'outcome', 'participants', 'object_truth', 'reveal_text', 'explanation', 'payload', 'text', 'prose']) {
  await test(`Future-reserved event with key "${key}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.future_reserved_events = [{ event_id: 'evt_f1', [key]: 'injected' }];
    p.packet_id = generatePacketFingerprint(p);
    assert.throws(() => validateSceneExecutionPacket(p, contract),
      e => e.code === 'UNKNOWN_NESTED_KEY' || e.code === 'PROHIBITED_SECRET_TRUTH');
  });
}

for (const key of ['secret', 'truth', 'secret_payload', 'withheld_facts', 'private_knowledge']) {
  await test(`Future-reserved event with secret field "${key}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.future_reserved_events = [{ event_id: 'evt_f1', [key]: 'injected' }];
    p.packet_id = generatePacketFingerprint(p);
    assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'PROHIBITED_SECRET_TRUTH');
  });
}

await test('Required event with unknown nested key fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0].extra = 'bad';
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'UNKNOWN_NESTED_KEY');
});

await test('Authorized fact with unknown nested key fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].extra = 'bad';
  p.packet_id = 'sep_dummy';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'UNKNOWN_NESTED_KEY');
});

// ─── Oversized continuity ──────────────────────────────────────────────

await test('Oversized immediate-continuity text fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.immediate_continuity = 'A'.repeat(2001);
  p.packet_id = generatePacketFingerprint(p);
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'CONTINUITY_TOO_LARGE');
});

// ─── Tampered fingerprint ──────────────────────────────────────────────

await test('Tampered packet_id fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.packet_id = 'sep_tampered';
  assert.throws(() => validateSceneExecutionPacket(p, contract), e => e.code === 'PACKET_FINGERPRINT_MISMATCH');
});

// ─── Error contract (table-driven across codes) ────────────────────────

await test('All validation errors include stable code and frozen nonempty issues', () => {
  const contract = makeContract();
  // Test a representative set of error codes
  const cases = [
    { setup: p => { p.packet_version = 'wrong'; p.packet_id = generatePacketFingerprint(p); }, code: 'WRONG_PACKET_VERSION' },
    { setup: p => { p.source_contract_fingerprint = 'wrong'; p.packet_id = generatePacketFingerprint(p); }, code: 'CONTRACT_FINGERPRINT_MISMATCH' },
    { setup: p => { p.scene_id = 'ch04-s99'; p.packet_id = generatePacketFingerprint(p); }, code: 'SCENE_IDENTITY_MISMATCH' },
    { setup: p => { p.unknown_key = 'x'; p.packet_id = generatePacketFingerprint(p); }, code: 'UNKNOWN_KEY' },
    { setup: p => { p.world_md = 'x'; p.packet_id = generatePacketFingerprint(p); }, code: 'PROHIBITED_KEY' },
    { setup: p => { p.scene_goal = 'Wrong'; p.packet_id = generatePacketFingerprint(p); }, code: 'SCENE_GOAL_MISMATCH' },
    { setup: p => { p.immediate_continuity = 'A'.repeat(2001); p.packet_id = generatePacketFingerprint(p); }, code: 'CONTINUITY_TOO_LARGE' },
    { setup: p => { p.packet_id = 'sep_tampered'; }, code: 'PACKET_FINGERPRINT_MISMATCH' },
  ];
  for (const { setup, code } of cases) {
    const p = makeValidPacket(contract);
    const packetBefore = clonePacket(p);
    setup(p);
    try {
      validateSceneExecutionPacket(p, contract);
      assert.fail(`Expected error with code ${code}`);
    } catch (e) {
      assert.equal(e.code, code, `Expected code ${code}, got ${e.code}`);
      assert.ok(Array.isArray(e.issues), `issues must be array for ${code}`);
      assert.ok(e.issues.length > 0, `issues must be non-empty for ${code}`);
      assert.ok(Object.isFrozen(e.issues), `issues must be frozen for ${code}`);
    }
    // Contract is not mutated
    assert.equal(contract.fingerprint, contract.fingerprint);
    assert.ok(Object.isFrozen(contract));
  }
});

// ─── Immutable contract detection preserved ────────────────────────────

await test('Existing immutable-contract mutation detection remains intact', () => {
  const contract = createImmutableSceneContract({
    beats: [{ ...BEAT_DATA }]
  }, { chapterNumber: 4 });
  assert.ok(Object.isFrozen(contract));
  assert.ok(Object.isFrozen(contract.beats));
  assert.ok(Object.isFrozen(contract.beats[0]));
  assert.doesNotThrow(() => assertSceneContractUnchanged(contract, contract.beats, { chapterNumber: 4 }));
});

await test('Existing createImmutableSceneContract behavior unchanged', () => {
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

console.log(`\nSTAGE 1B TESTS COMPLETE: ${passed} total passed\n`);
