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
  PACKET_LIMITS,
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

// ═══════════════════════════════════════════════════════════════════════
// Stage 1D Tests
// ═══════════════════════════════════════════════════════════════════════

passed = 0;

// ─── Descriptor-safe snapshot/comparison helper ────────────────────────
// Uses Reflect.ownKeys and property descriptors. Never executes getters.
// Records symbol-key identity, non-enumerable, accessor descriptors.
// Handles cycles. Proves structural identity preservation.

function snapshotDescriptorSafe(value, seen) {
  if (value === null) return { type: 'null', value: null };
  if (typeof value !== 'object' && typeof value !== 'function') {
    return { type: typeof value, value };
  }
  if (typeof value === 'function') return { type: 'function', identity: value };
  if (!seen) seen = new Map();
  if (seen.has(value)) return { type: 'cycle', id: seen.get(value) };
  const id = seen.size;
  seen.set(value, id);

  const snap = {
    type: Array.isArray(value) ? 'array' : 'object',
    proto: Object.getPrototypeOf(value),
    frozen: Object.isFrozen(value),
    keys: [],
  };
  const allKeys = Reflect.ownKeys(value);
  for (const k of allKeys) {
    const desc = Object.getOwnPropertyDescriptor(value, k);
    const entry = {
      key: k, // preserves symbol identity
      enumerable: desc.enumerable,
      configurable: desc.configurable,
      writable: desc.writable,
      getterFn: desc.get || null,   // getter function identity
      setterFn: desc.set || null,   // setter function identity
    };
    if (!desc.get && !desc.set) {
      entry.valueSnap = snapshotDescriptorSafe(desc.value, seen);
    }
    snap.keys.push(entry);
  }
  return snap;
}

function assertSnapshotsEqual(a, b, path) {
  if (!path) path = 'root';
  assert.equal(a.type, b.type, `${path}: type mismatch`);
  if (a.type === 'null' || a.type === 'boolean' || a.type === 'string' || a.type === 'number' || a.type === 'undefined' || a.type === 'symbol' || a.type === 'bigint') {
    assert.equal(a.value, b.value, `${path}: value mismatch`);
    return;
  }
  if (a.type === 'function') {
    assert.strictEqual(a.identity, b.identity, `${path}: function identity mismatch`);
    return;
  }
  if (a.type === 'cycle') {
    assert.equal(a.id, b.id, `${path}: cycle id mismatch`);
    return;
  }
  // object or array
  assert.equal(a.proto, b.proto, `${path}: prototype mismatch`);
  assert.equal(a.frozen, b.frozen, `${path}: frozen mismatch`);
  assert.equal(a.keys.length, b.keys.length, `${path}: key count mismatch`);
  for (let i = 0; i < a.keys.length; i++) {
    const ak = a.keys[i], bk = b.keys[i];
    assert.equal(ak.key, bk.key, `${path}: key identity mismatch at index ${i}`);
    assert.equal(ak.enumerable, bk.enumerable, `${path}.${String(ak.key)}: enumerable mismatch`);
    assert.equal(ak.configurable, bk.configurable, `${path}.${String(ak.key)}: configurable mismatch`);
    assert.equal(ak.writable, bk.writable, `${path}.${String(ak.key)}: writable mismatch`);
    assert.strictEqual(ak.getterFn, bk.getterFn, `${path}.${String(ak.key)}: getter identity mismatch`);
    assert.strictEqual(ak.setterFn, bk.setterFn, `${path}.${String(ak.key)}: setter identity mismatch`);
    if (ak.valueSnap && bk.valueSnap) {
      assertSnapshotsEqual(ak.valueSnap, bk.valueSnap, `${path}.${String(ak.key)}`);
    }
  }
}

// ─── makeContract / makeValidPacket ────────────────────────────────────

function makeContract() {
  return createImmutableSceneContract(
    [
      {
        scene_number: 1,
        scene_id: 'ch01-s01',
        scene_goal: 'Introduce the protagonist',
        entry_state: 'Morning in the village',
        required_events: ['The bell rings', 'Hero wakes up'],
        forbidden_events: ['Dragon appears'],
        exit_state: 'Hero leaves the house',
        continuity_dependencies: ['Sword is on the mantle'],
      },
    ],
    { chapterNumber: 1 }
  );
}

function makeValidPacket(contract) {
  const beat = contract.beats[0];
  const p = {
    packet_version: SCENE_EXECUTION_PACKET_VERSION,
    snapshot_id: 'snap-001',
    source_contract_fingerprint: contract.fingerprint,
    project_id: 'proj-001',
    chapter_id: 'ch-001',
    chapter_number: contract.chapterNumber,
    scene_id: beat.scene_id,
    scene_number: Number(beat.scene_number),
    scene_goal: beat.scene_goal,
    entry_state: beat.entry_state,
    exit_state: beat.exit_state,
    pov_identity: 'Hero',
    immediate_continuity: '',
    required_events: beat.required_events.map((txt, i) => ({
      event_id: generateDeterministicEventId('proj-001', 'ch-001', beat.scene_id, 'required', i + 1, txt),
      text: txt,
    })),
    future_reserved_events: [{ event_id: 'future_evt_001' }],
    scene_authorized_facts: [
      {
        fact_id: 'fact-001',
        summary: 'The hero has a sword',
        provenance: 'Chapter 1',
        knowledge_scope: { pov_identity: 'Hero', basis: 'witnessed' },
      },
    ],
    completed_events: ['evt_done'],
    voice_rules: ['Third person past tense'],
    current_locations: ['Village'],
    current_possessions: ['Sword'],
    current_injuries: [],
    confirmed_deaths: [],
    current_separations: [],
    unavailable_objects: [],
    canonically_unique_objects: ['The Ancient Sword'],
    pov_known_facts: ['fact-001'],
    current_scene_forbidden_events: beat.forbidden_events.slice(),
    continuity_dependencies: beat.continuity_dependencies.slice(),
  };
  p.packet_id = generatePacketFingerprint(p);
  return p;
}

// ─── assertFailsClosed (descriptor-safe, full error-contract) ──────────
// For every validator failure:
// 1. Assert exact expected error code
// 2. Assert issues is an array
// 3. Assert issues is nonempty
// 4. Assert issues is frozen
// 5. Assert packet is unchanged (descriptor-safe)
// 6. Assert contract is unchanged (descriptor-safe)

function assertFailsClosed(label, packet, contract, expectedCode) {
  const packetSnap = snapshotDescriptorSafe(packet);
  const contractSnap = snapshotDescriptorSafe(contract);
  let caught;
  try {
    validateSceneExecutionPacket(packet, contract);
    assert.fail(`${label}: Expected validation to throw`);
  } catch (e) {
    caught = e;
  }
  assert.equal(caught.code, expectedCode, `${label}: Expected code ${expectedCode}, got ${caught.code}: ${caught.message}`);
  assert.ok(Array.isArray(caught.issues), `${label}: issues must be an array`);
  assert.ok(caught.issues.length > 0, `${label}: issues must be nonempty`);
  assert.ok(Object.isFrozen(caught.issues), `${label}: issues must be frozen`);
  assertSnapshotsEqual(packetSnap, snapshotDescriptorSafe(packet), `${label}: packet`);
  assertSnapshotsEqual(contractSnap, snapshotDescriptorSafe(contract), `${label}: contract`);
}

// ═══════════════════════════════════════════════════════════════════════
// §1. Event-ID input type strictness
// ═══════════════════════════════════════════════════════════════════════

const EVENT_ID_STRING_ARGS = ['projectId', 'chapterId', 'sceneId', 'category', 'eventText'];
const EVENT_ID_MALFORMED_VALUES = [
  { v: 42, label: 'number' },
  { v: NaN, label: 'NaN' },
  { v: Infinity, label: 'Infinity' },
  { v: true, label: 'boolean true' },
  { v: false, label: 'boolean false' },
  { v: null, label: 'null' },
  { v: undefined, label: 'undefined' },
  { v: {}, label: 'object' },
  { v: [], label: 'array' },
  { v: new Date(), label: 'Date' },
  { v: () => {}, label: 'function' },
];

for (const argName of EVENT_ID_STRING_ARGS) {
  for (const { v, label } of EVENT_ID_MALFORMED_VALUES) {
    await test(`Event ID: ${argName}=${label} fails with INVALID_EVENT_ID_INPUT`, () => {
      const args = ['proj', 'ch', 'sc', 'cat', 1, 'text'];
      const argIndex = { projectId: 0, chapterId: 1, sceneId: 2, category: 3, eventText: 5 }[argName];
      args[argIndex] = v;
      let caught;
      try {
        generateDeterministicEventId(...args);
        assert.fail('Expected to throw');
      } catch (e) { caught = e; }
      assert.equal(caught.code, 'INVALID_EVENT_ID_INPUT');
      assert.ok(Array.isArray(caught.issues) && caught.issues.length > 0);
      assert.ok(Object.isFrozen(caught.issues));
    });
  }
}

// Ordinal malformed values
for (const { v, label } of [
  { v: NaN, label: 'NaN' }, { v: Infinity, label: 'Infinity' },
  { v: -Infinity, label: '-Infinity' }, { v: 0, label: 'zero' },
  { v: -1, label: 'negative' }, { v: 1.5, label: 'fractional' },
  { v: '1', label: 'string' }, { v: null, label: 'null' },
  { v: undefined, label: 'undefined' },
]) {
  await test(`Event ID: ordinal=${label} fails with INVALID_EVENT_ID_INPUT`, () => {
    let caught;
    try {
      generateDeterministicEventId('proj', 'ch', 'sc', 'cat', v, 'text');
      assert.fail('Expected to throw');
    } catch (e) { caught = e; }
    assert.equal(caught.code, 'INVALID_EVENT_ID_INPUT');
    assert.ok(Array.isArray(caught.issues) && caught.issues.length > 0);
    assert.ok(Object.isFrozen(caught.issues));
  });
}

// Whitespace stability
await test('Event ID: whitespace normalization is stable', () => {
  const a = generateDeterministicEventId('proj', 'ch', 'sc', 'cat', 1, 'hello world');
  const b = generateDeterministicEventId('  proj  ', '  ch  ', '  sc  ', '  cat  ', 1, '  hello world  ');
  assert.equal(a, b);
});

// Internal change sensitivity
await test('Event ID: different text produces different ID', () => {
  const a = generateDeterministicEventId('proj', 'ch', 'sc', 'cat', 1, 'hello');
  const b = generateDeterministicEventId('proj', 'ch', 'sc', 'cat', 1, 'world');
  assert.notEqual(a, b);
});

// ═══════════════════════════════════════════════════════════════════════
// §2. Descriptor-safe packet inspection (before reading nested values)
// ═══════════════════════════════════════════════════════════════════════

await test('Valid populated packet passes all validation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const result = validateSceneExecutionPacket(p, contract);
  assert.ok(result);
  assert.ok(Object.isFrozen(result));
});

await test('Nested getter is rejected WITHOUT being invoked', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  let getterCallCount = 0;
  Object.defineProperty(p.required_events[0], 'malicious', {
    get() { getterCallCount++; return 'gotcha'; },
    enumerable: true,
    configurable: false,
  });
  assertFailsClosed('nested getter', p, contract, 'INVALID_PACKET_PROPERTY');
  assert.equal(getterCallCount, 0, 'Getter must not be invoked');
});

await test('Nested getter attempting to mutate scene_goal cannot mutate it', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const originalGoal = p.scene_goal;
  Object.defineProperty(p.scene_authorized_facts[0], 'trap', {
    get() { p.scene_goal = 'MUTATED'; return 'trap'; },
    enumerable: true,
    configurable: false,
  });
  assertFailsClosed('getter mutation attempt', p, contract, 'INVALID_PACKET_PROPERTY');
  assert.equal(p.scene_goal, originalGoal, 'scene_goal must not be mutated');
});

await test('Nested getter throwing Error("boom") cannot leak that raw error', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const packetSnap = snapshotDescriptorSafe(p);
  const contractSnap = snapshotDescriptorSafe(contract);
  Object.defineProperty(p.future_reserved_events[0], 'bomb', {
    get() { throw new Error('boom'); },
    enumerable: true,
    configurable: false,
  });
  let caught;
  try {
    validateSceneExecutionPacket(p, contract);
    assert.fail('Expected to throw');
  } catch (e) { caught = e; }
  assert.notEqual(caught.message, 'boom', 'Raw getter error must not leak');
  assert.equal(caught.code, 'INVALID_PACKET_PROPERTY', 'Must produce INVALID_PACKET_PROPERTY code');
  assert.ok(Array.isArray(caught.issues), 'issues must be an array');
  assert.ok(caught.issues.length > 0, 'issues must be nonempty');
  assert.ok(Object.isFrozen(caught.issues), 'issues must be frozen');
  // Packet snapshot was taken BEFORE defineProperty, so we compare the original
  // to verify the pre-modification structure was correct. The defineProperty
  // added a new key, so we only verify contract is unchanged.
  assertSnapshotsEqual(contractSnap, snapshotDescriptorSafe(contract), 'contract unchanged after boom test');
});

await test('Nested symbol-keyed property returns INVALID_PACKET_PROPERTY', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const sym = Symbol('nested');
  p.scene_authorized_facts[0].knowledge_scope[sym] = 'secret';
  assertFailsClosed('nested symbol', p, contract, 'INVALID_PACKET_PROPERTY');
});

await test('Nested non-enumerable property returns INVALID_PACKET_PROPERTY', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  Object.defineProperty(p.required_events[0], '_hidden', {
    value: 'secret',
    enumerable: false,
    writable: true,
    configurable: true,
  });
  assertFailsClosed('nested non-enumerable', p, contract, 'INVALID_PACKET_PROPERTY');
});

await test('Nested accessor property returns INVALID_PACKET_PROPERTY', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  let invoked = 0;
  Object.defineProperty(p.scene_authorized_facts[0], 'sneaky', {
    get() { invoked++; return 42; },
    enumerable: true,
    configurable: false,
  });
  assertFailsClosed('nested accessor', p, contract, 'INVALID_PACKET_PROPERTY');
  assert.equal(invoked, 0, 'Accessor getter must not be invoked');
});

// Root-level inspection tests
await test('null root rejected with full error contract', () => {
  const contract = makeContract();
  assertFailsClosed('null root', null, contract, 'INVALID_PACKET');
});

await test('Array root rejected with full error contract', () => {
  const contract = makeContract();
  assertFailsClosed('array root', [1], contract, 'INVALID_PACKET');
});

await test('Date root rejected with full error contract', () => {
  const contract = makeContract();
  assertFailsClosed('date root', new Date(), contract, 'INVALID_PACKET');
});

await test('Class-instance root rejected with full error contract', () => {
  const contract = makeContract();
  assertFailsClosed('class root', new (class Foo {})(), contract, 'INVALID_PACKET');
});

await test('Symbol-keyed packet property rejected with full error contract', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p[Symbol('bad')] = 'x';
  assertFailsClosed('symbol root key', p, contract, 'INVALID_PACKET_PROPERTY');
});

await test('Non-enumerable packet property rejected with full error contract', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  Object.defineProperty(p, '_hidden', { value: 'x', enumerable: false, writable: true, configurable: true });
  assertFailsClosed('non-enum root', p, contract, 'INVALID_PACKET_PROPERTY');
});

await test('Accessor property on packet rejected with full error contract', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  Object.defineProperty(p, '_acc', { get() { return 'x'; }, enumerable: true, configurable: true });
  assertFailsClosed('accessor root', p, contract, 'INVALID_PACKET_PROPERTY');
});

// ═══════════════════════════════════════════════════════════════════════
// §3. Contract inspection (descriptor-safe)
// ═══════════════════════════════════════════════════════════════════════

await test('Class-instance contract root rejected', () => {
  const p = makeValidPacket(makeContract());
  const badContract = new (class MyContract {})();
  assertFailsClosed('class contract', p, badContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Class-instance beat rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  // Create a new contract with a class-instance beat
  class BeatClass {}
  const badBeat = new BeatClass();
  Object.assign(badBeat, contract.beats[0]);
  const fakeContract = { version: 'fiction-scene-contract-v2', fingerprint: contract.fingerprint, chapterNumber: 1, beats: [badBeat] };
  Object.freeze(badBeat);
  Object.freeze(fakeContract.beats);
  Object.freeze(fakeContract);
  assertFailsClosed('class beat', p, fakeContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Getter on contract rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  let invoked = 0;
  const fakeContract = {};
  Object.defineProperty(fakeContract, 'version', { get() { invoked++; return 'fiction-scene-contract-v2'; }, enumerable: true, configurable: false });
  Object.defineProperty(fakeContract, 'fingerprint', { value: contract.fingerprint, enumerable: true, configurable: false, writable: false });
  Object.defineProperty(fakeContract, 'chapterNumber', { value: 1, enumerable: true, configurable: false, writable: false });
  Object.defineProperty(fakeContract, 'beats', { value: contract.beats, enumerable: true, configurable: false, writable: false });
  Object.freeze(fakeContract);
  assertFailsClosed('getter contract', p, fakeContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
  assert.equal(invoked, 0, 'Contract getter must not be invoked');
});

await test('Getter on beat authority rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  let invoked = 0;
  const beatCopy = Object.create(Object.prototype);
  for (const [k, v] of Object.entries(contract.beats[0])) {
    if (k === 'scene_goal') {
      Object.defineProperty(beatCopy, k, { get() { invoked++; return v; }, enumerable: true, configurable: false });
    } else {
      Object.defineProperty(beatCopy, k, { value: v, enumerable: true, configurable: false, writable: false });
    }
  }
  Object.freeze(beatCopy);
  const fakeContract = { version: 'fiction-scene-contract-v2', fingerprint: contract.fingerprint, chapterNumber: 1, beats: Object.freeze([beatCopy]) };
  Object.freeze(fakeContract);
  assertFailsClosed('getter beat', p, fakeContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
  assert.equal(invoked, 0, 'Beat getter must not be invoked');
});

await test('Symbol-keyed contract property rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const sym = Symbol('hidden');
  const fakeContract = { version: 'fiction-scene-contract-v2', fingerprint: contract.fingerprint, chapterNumber: 1, beats: contract.beats, [sym]: 'secret' };
  Object.freeze(fakeContract);
  assertFailsClosed('symbol contract', p, fakeContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Non-enumerable contract property rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fakeContract = { version: 'fiction-scene-contract-v2', fingerprint: contract.fingerprint, chapterNumber: 1, beats: contract.beats };
  Object.defineProperty(fakeContract, '_hidden', { value: 'x', enumerable: false, writable: false, configurable: false });
  Object.freeze(fakeContract);
  assertFailsClosed('non-enum contract', p, fakeContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Malformed deeply frozen continuity dependencies rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const beatCopy = { ...contract.beats[0], continuity_dependencies: [42] };
  Object.freeze(beatCopy.continuity_dependencies);
  Object.freeze(beatCopy);
  const fakeContract = { version: 'fiction-scene-contract-v2', fingerprint: contract.fingerprint, chapterNumber: 1, beats: Object.freeze([beatCopy]) };
  Object.freeze(fakeContract);
  assertFailsClosed('malformed cont deps', p, fakeContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Malformed deeply frozen required_events rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const beatCopy = { ...contract.beats[0], required_events: [42, null] };
  Object.freeze(beatCopy.required_events);
  Object.freeze(beatCopy);
  const fakeContract = { version: 'fiction-scene-contract-v2', fingerprint: contract.fingerprint, chapterNumber: 1, beats: Object.freeze([beatCopy]) };
  Object.freeze(fakeContract);
  assertFailsClosed('malformed req events', p, fakeContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Malformed deeply frozen forbidden_events rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const beatCopy = { ...contract.beats[0], forbidden_events: [true] };
  Object.freeze(beatCopy.forbidden_events);
  Object.freeze(beatCopy);
  const fakeContract = { version: 'fiction-scene-contract-v2', fingerprint: contract.fingerprint, chapterNumber: 1, beats: Object.freeze([beatCopy]) };
  Object.freeze(fakeContract);
  assertFailsClosed('malformed forb events', p, fakeContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Malformed scene number in frozen beat rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const beatCopy = { ...contract.beats[0], scene_number: 'abc' };
  Object.freeze(beatCopy);
  const fakeContract = { version: 'fiction-scene-contract-v2', fingerprint: contract.fingerprint, chapterNumber: 1, beats: Object.freeze([beatCopy]) };
  Object.freeze(fakeContract);
  assertFailsClosed('malformed scene_number', p, fakeContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Empty scene_goal in frozen beat rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const beatCopy = { ...contract.beats[0], scene_goal: '' };
  Object.freeze(beatCopy);
  const fakeContract = { version: 'fiction-scene-contract-v2', fingerprint: contract.fingerprint, chapterNumber: 1, beats: Object.freeze([beatCopy]) };
  Object.freeze(fakeContract);
  assertFailsClosed('empty scene_goal', p, fakeContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Empty entry_state in frozen beat rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const beatCopy = { ...contract.beats[0], entry_state: '  ' };
  Object.freeze(beatCopy);
  const fakeContract = { version: 'fiction-scene-contract-v2', fingerprint: contract.fingerprint, chapterNumber: 1, beats: Object.freeze([beatCopy]) };
  Object.freeze(fakeContract);
  assertFailsClosed('empty entry_state', p, fakeContract, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Side-effecting getter invocation count remains zero', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const contractSnap = snapshotDescriptorSafe(contract);
  let invocations = 0;
  // Getter on packet
  Object.defineProperty(p, 'trap_field', {
    get() { invocations++; return 'gotcha'; },
    enumerable: true,
    configurable: false,
  });
  let caught;
  try { validateSceneExecutionPacket(p, contract); } catch (e) { caught = e; }
  assert.equal(invocations, 0, 'No getter on packet should be invoked');
  assert.equal(caught.code, 'INVALID_PACKET_PROPERTY', 'Packet getter must produce INVALID_PACKET_PROPERTY');
  assert.ok(Array.isArray(caught.issues) && caught.issues.length > 0, 'issues array nonempty');
  assert.ok(Object.isFrozen(caught.issues), 'issues frozen');
  assertSnapshotsEqual(contractSnap, snapshotDescriptorSafe(contract), 'contract unchanged');
  // Getter on contract
  const fakeContract = {};
  Object.defineProperty(fakeContract, 'version', { get() { invocations++; return 'fiction-scene-contract-v2'; }, enumerable: true, configurable: false });
  Object.freeze(fakeContract);
  let caught2;
  try { validateSceneExecutionPacket(makeValidPacket(makeContract()), fakeContract); } catch (e) { caught2 = e; }
  assert.equal(invocations, 0, 'No getter on contract should be invoked');
  assert.equal(caught2.code, 'SCENE_CONTRACT_NOT_IMMUTABLE', 'Contract getter must produce SCENE_CONTRACT_NOT_IMMUTABLE');
  assert.ok(Array.isArray(caught2.issues) && caught2.issues.length > 0, 'contract issues nonempty');
  assert.ok(Object.isFrozen(caught2.issues), 'contract issues frozen');
});

// ═══════════════════════════════════════════════════════════════════════
// §4. Complete error-contract assertions for all validator failures
// ═══════════════════════════════════════════════════════════════════════

// ── Feature flag ──
await test('SCENE_CONTEXT_COMPOSER_FEATURE is immutable', () => {
  assert.ok(Object.isFrozen(SCENE_CONTEXT_COMPOSER_FEATURE));
  assert.equal(SCENE_CONTEXT_COMPOSER_FEATURE.defaultEnabled, false);
});

// ── Fingerprint tests ──
await test('Fingerprint: null fails with INVALID_PACKET', () => {
  let caught;
  try { generatePacketFingerprint(null); } catch (e) { caught = e; }
  assert.equal(caught.code, 'INVALID_PACKET');
  assert.ok(Array.isArray(caught.issues) && caught.issues.length > 0);
  assert.ok(Object.isFrozen(caught.issues));
});

await test('Fingerprint: array fails with INVALID_PACKET', () => {
  let caught;
  try { generatePacketFingerprint([1, 2]); } catch (e) { caught = e; }
  assert.equal(caught.code, 'INVALID_PACKET');
});

await test('Fingerprint: Date fails with INVALID_PACKET', () => {
  let caught;
  try { generatePacketFingerprint(new Date()); } catch (e) { caught = e; }
  assert.equal(caught.code, 'INVALID_PACKET');
});

await test('Fingerprint: string fails with INVALID_PACKET', () => {
  let caught;
  try { generatePacketFingerprint('str'); } catch (e) { caught = e; }
  assert.equal(caught.code, 'INVALID_PACKET');
});

// ── Fingerprint sensitivity ──
await test('FP: stable for identical packets', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  assert.equal(generatePacketFingerprint(p), generatePacketFingerprint(p));
});

await test('FP: changing chapter_id changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  p2.chapter_id = 'ch-002';
  assert.notEqual(generatePacketFingerprint(p1), generatePacketFingerprint(p2));
});

await test('FP: changing scene_id changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  p2.scene_id = 'scene-999';
  assert.notEqual(generatePacketFingerprint(p1), generatePacketFingerprint(p2));
});

await test('FP: changing voice_rules changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  p2.voice_rules = ['First person'];
  assert.notEqual(generatePacketFingerprint(p1), generatePacketFingerprint(p2));
});

await test('FP: array order is significant', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = makeValidPacket(contract);
  p1.current_locations = ['A', 'B'];
  p2.current_locations = ['B', 'A'];
  assert.notEqual(generatePacketFingerprint(p1), generatePacketFingerprint(p2));
});

await test('FP: packet_id is excluded', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  const p2 = { ...p1, packet_id: 'different_id' };
  assert.equal(generatePacketFingerprint(p1), generatePacketFingerprint(p2));
});

// ── Missing required fields (full error contract) ──
const REQUIRED_STRING_TEST_FIELDS = [
  'packet_version', 'snapshot_id', 'source_contract_fingerprint',
  'project_id', 'chapter_id', 'scene_id',
  'scene_goal', 'entry_state', 'exit_state', 'pov_identity', 'immediate_continuity', 'packet_id'
];
for (const field of REQUIRED_STRING_TEST_FIELDS) {
  await test(`Missing field "${field}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    delete p[field];
    assertFailsClosed(`missing ${field}`, p, contract, 'MISSING_REQUIRED_FIELD');
  });
}

await test('Missing chapter_number fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.chapter_number;
  assertFailsClosed('missing chapter_number', p, contract, 'MISSING_REQUIRED_FIELD');
});

await test('Missing scene_number fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.scene_number;
  assertFailsClosed('missing scene_number', p, contract, 'MISSING_REQUIRED_FIELD');
});

// ── Missing array fields ──
const ARRAY_FIELDS_TO_TEST = [
  'future_reserved_events', 'scene_authorized_facts', 'completed_events',
  'voice_rules', 'current_locations', 'current_possessions', 'current_injuries',
  'confirmed_deaths', 'current_separations', 'unavailable_objects',
  'canonically_unique_objects', 'continuity_dependencies', 'pov_known_facts',
  'required_events', 'current_scene_forbidden_events'
];
for (const field of ARRAY_FIELDS_TO_TEST) {
  await test(`Missing array "${field}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    delete p[field];
    assertFailsClosed(`missing ${field}`, p, contract, 'MISSING_REQUIRED_FIELD');
  });
}

// ── String-valued where array expected ──
const STRING_ARRAY_TEST_FIELDS = [
  'future_reserved_events', 'scene_authorized_facts', 'completed_events',
  'voice_rules', 'current_locations', 'current_possessions', 'current_injuries',
  'confirmed_deaths', 'current_separations', 'unavailable_objects',
  'canonically_unique_objects', 'continuity_dependencies', 'pov_known_facts'
];
for (const field of STRING_ARRAY_TEST_FIELDS) {
  await test(`String-valued "${field}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[field] = 'not-an-array';
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`string ${field}`, p, contract, 'INVALID_FIELD_TYPE');
  });
}

// ── Non-string where string expected ──
const NON_STRING_FIELDS = [
  'packet_version', 'snapshot_id', 'source_contract_fingerprint',
  'project_id', 'chapter_id', 'scene_id',
  'scene_goal', 'entry_state', 'exit_state', 'pov_identity', 'immediate_continuity'
];
for (const field of NON_STRING_FIELDS) {
  await test(`Non-string "${field}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[field] = 42;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`non-string ${field}`, p, contract, 'INVALID_FIELD_TYPE');
  });
}

// ── Non-number chapter/scene ──
for (const field of ['chapter_number', 'scene_number']) {
  await test(`Non-number ${field} fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[field] = 'abc';
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`non-number ${field}`, p, contract, 'INVALID_FIELD_TYPE');
  });
}

// ── Non-string packet_id ──
await test('Non-string packet_id fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.packet_id = 42;
  assertFailsClosed('non-string packet_id', p, contract, 'INVALID_FIELD_TYPE');
});

// ── Numeric malformed ──
for (const field of ['chapter_number', 'scene_number']) {
  // NaN and Infinity are caught by descriptor-safe inspection BEFORE schema checks
  for (const { v, label } of [
    { v: NaN, label: 'NaN' },
    { v: Infinity, label: 'Infinity' },
  ]) {
    await test(`${field} = ${label} fails closed`, () => {
      const contract = makeContract();
      const p = makeValidPacket(contract);
      p[field] = v;
      // NaN/Infinity can't be fingerprinted (also caught by descriptorSafeInspect)
      // Don't regenerate fingerprint since it would fail too
      assertFailsClosed(`${field} ${label}`, p, contract, 'NON_JSON_SAFE_VALUE');
    });
  }
  // Fractional, zero, negative are valid JSON numbers, caught by requirePositiveInteger
  for (const { v, label } of [
    { v: 1.5, label: 'fractional' },
    { v: 0, label: 'zero' },
    { v: -1, label: 'negative' },
  ]) {
    await test(`${field} = ${label} fails closed`, () => {
      const contract = makeContract();
      const p = makeValidPacket(contract);
      p[field] = v;
      p.packet_id = generatePacketFingerprint(p);
      assertFailsClosed(`${field} ${label}`, p, contract, field === 'chapter_number' ? 'INVALID_CHAPTER_NUMBER' : 'INVALID_SCENE_NUMBER');
    });
  }
}

// ── Non-array record/id fields ──
const NON_ARRAY_TEST_FIELDS = [
  'required_events', 'future_reserved_events', 'scene_authorized_facts',
  'completed_events', 'pov_known_facts',
  'current_scene_forbidden_events'
];
for (const field of NON_ARRAY_TEST_FIELDS) {
  await test(`Non-array "${field}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[field] = 'not-array';
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`non-array ${field}`, p, contract, 'INVALID_FIELD_TYPE');
  });
}

// ── String array element tests ──
await test('Non-string element in string array fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules = [42];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('non-string element', p, contract, 'INVALID_FIELD_TYPE');
});

await test('Null element in string array fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules = [null];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('null element', p, contract, 'INVALID_FIELD_TYPE');
});

await test('Empty string element in string array fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules = [''];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('empty element', p, contract, 'INVALID_FIELD_VALUE');
});

// ── Required event nested validation ──
await test('Null required event rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0] = null;
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('null req event', p, contract, 'INVALID_RECORD');
});

await test('Primitive required event rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0] = 'string';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('primitive req event', p, contract, 'INVALID_RECORD');
});

await test('Required event missing event_id rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.required_events[0].event_id;
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('missing req event_id', p, contract, 'MISSING_REQUIRED_FIELD');
});

await test('Required event missing text rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.required_events[0].text;
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('missing req text', p, contract, 'MISSING_REQUIRED_FIELD');
});

await test('Required event empty event_id rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0].event_id = '';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('empty req event_id', p, contract, 'MISSING_REQUIRED_FIELD');
});

await test('Required event empty text rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0].text = '';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('empty req text', p, contract, 'MISSING_REQUIRED_FIELD');
});

await test('Required event with unknown nested key fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0].description = 'extra';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('unknown req key', p, contract, 'UNKNOWN_NESTED_KEY');
});

// ── Future-reserved event nested validation ──
await test('Null future event rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events[0] = null;
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('null future event', p, contract, 'INVALID_RECORD');
});

await test('Primitive future event rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events[0] = 'string';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('primitive future event', p, contract, 'INVALID_RECORD');
});

await test('Future event missing event_id rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events[0] = {};
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('missing future event_id', p, contract, 'MISSING_REQUIRED_FIELD');
});

await test('Future event empty event_id rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events[0].event_id = '';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('empty future event_id', p, contract, 'MISSING_REQUIRED_FIELD');
});

// Future-reserved prohibited keys (no prohibited substring)
for (const key of ['description', 'outcome', 'participants', 'reveal_text', 'explanation', 'payload', 'text', 'prose']) {
  await test(`Future-reserved event with key "${key}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.future_reserved_events[0][key] = 'x';
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`future ${key}`, p, contract, 'UNKNOWN_NESTED_KEY');
  });
}
// Keys containing prohibited substrings (truth, secret, withheld, private)
for (const key of ['object_truth', 'secret', 'truth', 'secret_payload', 'withheld_facts', 'private_knowledge']) {
  await test(`Future-reserved event with secret field "${key}" fails closed`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.future_reserved_events[0][key] = 'x';
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`future secret ${key}`, p, contract, 'PROHIBITED_SECRET_TRUTH');
  });
}

// ── Fact validation ──
await test('Null fact rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0] = null;
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('null fact', p, contract, 'INVALID_RECORD');
});

await test('Primitive fact rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0] = 'string';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('primitive fact', p, contract, 'INVALID_RECORD');
});

for (const field of ['fact_id', 'summary', 'provenance', 'knowledge_scope']) {
  await test(`Fact missing ${field} rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    delete p.scene_authorized_facts[0][field];
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`missing ${field}`, p, contract, 'MISSING_REQUIRED_FIELD');
  });
}

for (const field of ['fact_id', 'summary', 'provenance']) {
  await test(`Fact empty ${field} rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.scene_authorized_facts[0][field] = '';
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`empty ${field}`, p, contract, 'MISSING_REQUIRED_FIELD');
  });
}

// Knowledge scope
await test('Missing knowledge scope pov_identity rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.scene_authorized_facts[0].knowledge_scope.pov_identity;
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('missing ks pov', p, contract, 'MISSING_REQUIRED_FIELD');
});

await test('Missing knowledge scope basis rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.scene_authorized_facts[0].knowledge_scope.basis;
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('missing ks basis', p, contract, 'MISSING_REQUIRED_FIELD');
});

await test('Wrong-POV knowledge scope rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].knowledge_scope.pov_identity = 'Villain';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('wrong pov', p, contract, 'KNOWLEDGE_SCOPE_POV_MISMATCH');
});

await test('Malformed knowledge scope (string) rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].knowledge_scope = 'bad';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('string ks', p, contract, 'INVALID_RECORD');
});

await test('Unknown knowledge scope key rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].knowledge_scope.extra = 'x';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('unknown ks key', p, contract, 'UNKNOWN_NESTED_KEY');
});

// Prohibited fact fields
for (const field of ['withheld_data', 'private_info', 'secret_payload', 'hidden_truth']) {
  await test(`Fact with prohibited nested field "${field}" rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.scene_authorized_facts[0][field] = 'x';
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`fact ${field}`, p, contract, 'PROHIBITED_SECRET_TRUTH');
  });
}

await test('Authorized fact with unknown nested key fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].extra_field = 'x';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('unknown fact key', p, contract, 'UNKNOWN_NESTED_KEY');
});

// ── pov_known_facts ──
await test('pov_known_facts ID not found rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.pov_known_facts = ['nonexistent-id'];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('pov not found', p, contract, 'UNRESOLVED_POV_FACT');
});

await test('Duplicate pov_known_facts ID rejected (exact)', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.pov_known_facts = ['fact-001', 'fact-001'];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('dup pov exact', p, contract, 'DUPLICATE_SET_ENTRY');
});

await test('Duplicate pov_known_facts ID rejected (whitespace-normalized)', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.pov_known_facts = ['fact-001', ' fact-001 '];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('dup pov ws', p, contract, 'DUPLICATE_SET_ENTRY');
});

// ── completed_events ──
await test('Non-string completed event ID rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.completed_events = [42];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('non-string completed', p, contract, 'INVALID_FIELD_TYPE');
});

await test('Empty completed event ID rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.completed_events = [''];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('empty completed', p, contract, 'INVALID_FIELD_VALUE');
});

await test('Duplicate completed_events ID rejected (exact)', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.completed_events = ['evt_a', 'evt_a'];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('dup completed exact', p, contract, 'DUPLICATE_SET_ENTRY');
});

await test('Duplicate completed_events ID rejected (whitespace-normalized)', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.completed_events = ['evt_a', ' evt_a '];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('dup completed ws', p, contract, 'DUPLICATE_SET_ENTRY');
});

// ── Contract validation ──
await test('Wrong packet version fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.packet_version = 'wrong-version';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('wrong version', p, contract, 'WRONG_PACKET_VERSION');
});

await test('Wrong contract fingerprint fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.source_contract_fingerprint = 'wrong-fp';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('wrong fp', p, contract, 'CONTRACT_FINGERPRINT_MISMATCH');
});

await test('Non-frozen contract fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const unfrozen = { version: 'fiction-scene-contract-v2', fingerprint: contract.fingerprint, chapterNumber: 1, beats: contract.beats };
  assertFailsClosed('unfrozen contract', p, unfrozen, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Null contract fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  assertFailsClosed('null contract', p, null, 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

await test('Array contract fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  assertFailsClosed('array contract', p, Object.freeze([1]), 'SCENE_CONTRACT_NOT_IMMUTABLE');
});

// ── Scene identity ──
await test('Scene identity mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_id = 'nonexistent-scene';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('scene id mismatch', p, contract, 'SCENE_IDENTITY_MISMATCH');
});

await test('Scene number mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_number = 99;
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('scene number mismatch', p, contract, 'SCENE_NUMBER_MISMATCH');
});

await test('Scene goal mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_goal = 'Wrong goal';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('scene goal mismatch', p, contract, 'SCENE_GOAL_MISMATCH');
});

await test('Entry-state mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.entry_state = 'Wrong state';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('entry state mismatch', p, contract, 'ENTRY_STATE_MISMATCH');
});

await test('Exit-state mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.exit_state = 'Wrong exit';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('exit state mismatch', p, contract, 'EXIT_STATE_MISMATCH');
});

// ── Required events contract matching ──
await test('Required event text modification fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0].text = 'Modified text';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('req text mod', p, contract, 'REQUIRED_EVENTS_MISMATCH');
});

await test('Required event omission fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events = [p.required_events[0]];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('req omission', p, contract, 'REQUIRED_EVENTS_MISMATCH');
});

await test('Required event addition fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events.push({ event_id: 'extra', text: 'Extra event' });
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('req addition', p, contract, 'REQUIRED_EVENTS_MISMATCH');
});

await test('Required event reordering fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events.reverse();
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('req reorder', p, contract, 'REQUIRED_EVENTS_MISMATCH');
});

await test('Required event deterministic ID mismatch fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0].event_id = 'evt_wrong';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('req id mismatch', p, contract, 'EVENT_ID_MISMATCH');
});

await test('Duplicate required event IDs fail closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  // Two events with same ID: duplicate ID detection now runs BEFORE text comparison
  p.required_events[1] = { ...p.required_events[0] };
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('dup req ids', p, contract, 'DUPLICATE_EVENT_ID');
});

// ── Forbidden events contract matching ──
await test('Forbidden event modification fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.current_scene_forbidden_events = ['Wrong event'];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('forb mod', p, contract, 'FORBIDDEN_EVENTS_MISMATCH');
});

await test('Forbidden event omission fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.current_scene_forbidden_events = [];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('forb omission', p, contract, 'FORBIDDEN_EVENTS_MISMATCH');
});

await test('Forbidden event addition fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.current_scene_forbidden_events.push('Extra');
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('forb addition', p, contract, 'FORBIDDEN_EVENTS_MISMATCH');
});

// ── Continuity dependency contract matching ──
await test('Continuity dependency modification fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.continuity_dependencies = ['Wrong dep'];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('cont mod', p, contract, 'CONTINUITY_DEPENDENCIES_MISMATCH');
});

await test('Continuity dependency omission fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.continuity_dependencies = [];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('cont omission', p, contract, 'CONTINUITY_DEPENDENCIES_MISMATCH');
});

await test('Continuity dependency addition fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.continuity_dependencies.push('Extra dep');
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('cont addition', p, contract, 'CONTINUITY_DEPENDENCIES_MISMATCH');
});

// ── Future-reserved event uniqueness and overlap ──
await test('Duplicate future-reserved event IDs fail closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events = [{ event_id: 'dup' }, { event_id: 'dup' }];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('dup future ids', p, contract, 'DUPLICATE_EVENT_ID');
});

await test('Event appearing as both required and future-reserved fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events = [{ event_id: p.required_events[0].event_id }];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('req+future overlap', p, contract, 'REQUIRED_AND_FUTURE_EVENT');
});

// ── Duplicate fact IDs ──
await test('Duplicate fact IDs fail closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts.push({ ...p.scene_authorized_facts[0] });
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('dup fact ids', p, contract, 'DUPLICATE_FACT_ID');
});

// ── Set uniqueness ──
const SET_TEST_FIELDS = [
  'current_locations', 'current_possessions', 'current_injuries',
  'confirmed_deaths', 'current_separations', 'unavailable_objects',
  'canonically_unique_objects'
];
for (const field of SET_TEST_FIELDS) {
  await test(`Set uniqueness: exact duplicate in ${field} rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[field] = ['alpha', 'alpha'];
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`dup ${field}`, p, contract, 'DUPLICATE_SET_ENTRY');
  });
  await test(`Set uniqueness: whitespace-normalized duplicate in ${field} rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[field] = ['alpha', ' alpha '];
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`ws dup ${field}`, p, contract, 'DUPLICATE_SET_ENTRY');
  });
}

// ── Prohibited top-level keys ──
const PROHIBITED_KEYS_LIST = [
  'world_md', 'characters_md', 'outline_md', 'canon_md', 'mystery_md',
  'twists_md', 'research_md', 'voice_md', 'story_bible', 'book_outline',
  'chapter_collection', 'later_scene_contracts', 'twist_truth', 'mystery_truth',
  'reveal_truth', 'future_truth', 'withheld_facts', 'private_knowledge',
  'project_records', 'chapter_records', 'prior_chapter_prose',
  'accumulated_manuscript', 'prompt_text'
];
for (const key of PROHIBITED_KEYS_LIST) {
  await test(`Prohibited key "${key}" is rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[key] = 'x';
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed(`prohibited ${key}`, p, contract, 'PROHIBITED_KEY');
  });
}

await test('Unknown top-level key fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.completely_unknown = 'x';
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('unknown key', p, contract, 'UNKNOWN_KEY');
});

// ── Bounds ──
await test('Exactly-at-limit immediate_continuity passes', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.immediate_continuity = 'x'.repeat(PACKET_LIMITS.MAX_CONTINUITY_LENGTH);
  p.packet_id = generatePacketFingerprint(p);
  const result = validateSceneExecutionPacket(p, contract);
  assert.ok(result);
});

await test('One-over-limit immediate_continuity fails', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.immediate_continuity = 'x'.repeat(PACKET_LIMITS.MAX_CONTINUITY_LENGTH + 1);
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('over-limit continuity', p, contract, 'FIELD_TOO_LARGE');
});

await test('Oversized fact summary fails', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_authorized_facts[0].summary = 'x'.repeat(PACKET_LIMITS.MAX_FACT_SUMMARY_LENGTH + 1);
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('oversized summary', p, contract, 'FIELD_TOO_LARGE');
});

await test('Oversized state entry fails', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.current_locations = ['x'.repeat(PACKET_LIMITS.MAX_STATE_ENTRY_LENGTH + 1)];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('oversized state entry', p, contract, 'FIELD_TOO_LARGE');
});

await test('Excessive array count fails', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules = Array.from({ length: PACKET_LIMITS.MAX_ARRAY_LENGTH + 1 }, (_, i) => `rule_${i}`);
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('excessive array', p, contract, 'ARRAY_TOO_LARGE');
});

await test('Oversized scene_goal fails', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.scene_goal = 'x'.repeat(PACKET_LIMITS.MAX_GOAL_LENGTH + 1);
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('oversized goal', p, contract, 'FIELD_TOO_LARGE');
});

await test('Oversized ID field fails', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.project_id = 'x'.repeat(PACKET_LIMITS.MAX_ID_LENGTH + 1);
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('oversized id', p, contract, 'FIELD_TOO_LARGE');
});

// ── Fingerprint tampering ──
await test('Tampered packet_id fails closed', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.packet_id = 'sep_tampered';
  assertFailsClosed('tampered id', p, contract, 'PACKET_FINGERPRINT_MISMATCH');
});

// ── Malformed contract forbidden_events ──
await test('Malformed contract forbidden_events does NOT mutate contract', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const packetSnap = snapshotDescriptorSafe(p);
  const contractSnap = snapshotDescriptorSafe(contract);
  p.current_scene_forbidden_events = ['not; a, comma-separated string but a valid entry'];
  p.packet_id = generatePacketFingerprint(p);
  let caught;
  try { validateSceneExecutionPacket(p, contract); } catch (e) { caught = e; }
  assert.ok(caught, 'Must throw for mismatched forbidden events');
  assert.equal(caught.code, 'FORBIDDEN_EVENTS_MISMATCH', 'Expected FORBIDDEN_EVENTS_MISMATCH');
  assert.ok(Array.isArray(caught.issues) && caught.issues.length > 0, 'issues nonempty');
  assert.ok(Object.isFrozen(caught.issues), 'issues frozen');
  assertSnapshotsEqual(contractSnap, snapshotDescriptorSafe(contract), 'contract unchanged');
});

// ── Existing behavior ──
await test('Existing createImmutableSceneContract behavior unchanged', () => {
  const contract = makeContract();
  assert.ok(Object.isFrozen(contract));
  assert.ok(contract.beats.length > 0);
  assert.equal(contract.version, 'fiction-scene-contract-v2');
  assert.equal(typeof contract.fingerprint, 'string');
});

await test('PACKET_LIMITS is frozen and exported', () => {
  assert.ok(Object.isFrozen(PACKET_LIMITS));
  assert.equal(typeof PACKET_LIMITS.MAX_ARRAY_LENGTH, 'number');
});

// ═══════════════════════════════════════════════════════════════════════
// Stage 1E Tests
// ═══════════════════════════════════════════════════════════════════════

function clonePacket(packet) {
  return JSON.parse(JSON.stringify(packet));
}

// ─── §1E-1. Restored recursive fingerprint tests ─────────────────────

await test('FP1: Changing required-event event_id changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  p2.required_events[0].event_id = 'evt_changed1';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP2: Changing required-event text changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  p2.required_events[0].text = 'Changed text.';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP3: Changing future-reserved event_id changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.future_reserved_events = [{ event_id: 'evt_future_1' }];
  p.packet_id = generatePacketFingerprint(p);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  p2.future_reserved_events[0].event_id = 'evt_future_2';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP4: Changing authorized-fact fact_id changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  p2.scene_authorized_facts[0].fact_id = 'fact-changed';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP5: Changing authorized-fact summary changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  p2.scene_authorized_facts[0].summary = 'Changed summary.';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP6: Changing authorized-fact provenance changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  p2.scene_authorized_facts[0].provenance = 'ch99-s99';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP7: Changing knowledge-scope pov_identity changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  p2.scene_authorized_facts[0].knowledge_scope.pov_identity = 'Marcus';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP8: Changing knowledge-scope basis changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  p2.scene_authorized_facts[0].knowledge_scope.basis = 'Different basis.';
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP9: Reordering keys inside a required-event record does not change fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  const e = p2.required_events[0];
  p2.required_events[0] = { text: e.text, event_id: e.event_id };
  assert.equal(fp1, generatePacketFingerprint(p2));
});

await test('FP10: Reordering keys inside a fact does not change fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  const f = p2.scene_authorized_facts[0];
  p2.scene_authorized_facts[0] = {
    summary: f.summary, fact_id: f.fact_id, knowledge_scope: f.knowledge_scope, provenance: f.provenance
  };
  assert.equal(fp1, generatePacketFingerprint(p2));
});

await test('FP11: Reordering keys inside knowledge-scope does not change fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  const ks = p2.scene_authorized_facts[0].knowledge_scope;
  p2.scene_authorized_facts[0].knowledge_scope = { basis: ks.basis, pov_identity: ks.pov_identity };
  assert.equal(fp1, generatePacketFingerprint(p2));
});

await test('FP12: Reordering top-level properties does not change fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const keys = Object.keys(p).filter(k => k !== 'packet_id');
  const reversed = {};
  for (const k of keys.reverse()) reversed[k] = p[k];
  reversed.packet_id = generatePacketFingerprint(reversed);
  assert.equal(p.packet_id, reversed.packet_id);
});

// FP13: Every authority-bearing top-level field changes fingerprint (comprehensive)
{
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const stringFields = ['scene_goal', 'entry_state', 'exit_state', 'pov_identity',
    'snapshot_id', 'source_contract_fingerprint', 'project_id', 'chapter_id', 'scene_id',
    'packet_version', 'immediate_continuity'];
  for (const field of stringFields) {
    await test(`FP13: Changing ${field} changes fingerprint`, () => {
      const p2 = clonePacket(p); delete p2.packet_id;
      p2[field] = 'changed_value_unique_xyz';
      assert.notEqual(fp1, generatePacketFingerprint(p2), `Changing ${field} must change fingerprint`);
    });
  }
}

// FP14: Every authority-bearing array field changes fingerprint
for (const field of ['current_locations', 'current_possessions', 'current_injuries',
  'confirmed_deaths', 'current_separations', 'unavailable_objects',
  'canonically_unique_objects', 'voice_rules', 'completed_events',
  'pov_known_facts', 'current_scene_forbidden_events', 'continuity_dependencies']) {
  await test(`FP14: Changing ${field} changes fingerprint`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    const fp1 = p.packet_id;
    const p2 = clonePacket(p); delete p2.packet_id;
    p2[field] = [...p2[field], 'extra_item_for_fp_test'];
    assert.notEqual(fp1, generatePacketFingerprint(p2));
  });
}

// FP15: Numeric fields change fingerprint
await test('FP15: Changing chapter_number changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  p2.chapter_number = 99;
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP15: Changing scene_number changes fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  p2.scene_number = 99;
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP16: Array order is fingerprint-significant', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules = ['Rule A', 'Rule B'];
  p.packet_id = generatePacketFingerprint(p);
  const fp1 = p.packet_id;
  const p2 = clonePacket(p); delete p2.packet_id;
  p2.voice_rules = ['Rule B', 'Rule A'];
  assert.notEqual(fp1, generatePacketFingerprint(p2));
});

await test('FP17: packet_id itself is excluded from fingerprint', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const p2 = clonePacket(p);
  p2.packet_id = 'completely_different_id';
  assert.equal(generatePacketFingerprint(p), generatePacketFingerprint(p2));
});

// ─── §1E-2. Fingerprint descriptor-safe preinspection ─────────────────

function assertFpFails(label, packet, expectedCode) {
  const snap = snapshotDescriptorSafe(packet);
  let caught;
  try { generatePacketFingerprint(packet); } catch (e) { caught = e; }
  assert.ok(caught, `${label}: Expected generatePacketFingerprint to throw`);
  assert.equal(caught.code, expectedCode, `${label}: Expected code ${expectedCode}, got ${caught.code}`);
  assert.ok(Array.isArray(caught.issues), `${label}: issues must be array`);
  assert.ok(caught.issues.length > 0, `${label}: issues must be nonempty`);
  assert.ok(Object.isFrozen(caught.issues), `${label}: issues must be frozen`);
}

await test('FP-pre: root getter rejected without invocation', () => {
  const p = {};
  let invoked = 0;
  Object.defineProperty(p, 'scene_goal', { get() { invoked++; return 'x'; }, enumerable: true, configurable: false });
  assertFpFails('root getter', p, 'INVALID_PACKET_PROPERTY');
  assert.equal(invoked, 0, 'Root getter must not be invoked');
});

await test('FP-pre: nested getter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  let invoked = 0;
  Object.defineProperty(p.required_events[0], 'trap', { get() { invoked++; return 'x'; }, enumerable: true, configurable: false });
  assertFpFails('nested getter', p, 'INVALID_PACKET_PROPERTY');
  assert.equal(invoked, 0, 'Nested getter must not be invoked');
});

await test('FP-pre: getter attempting mutation cannot mutate packet', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const original = p.scene_goal;
  let invoked = 0;
  Object.defineProperty(p.required_events[0], 'mutator', {
    get() { invoked++; p.scene_goal = 'MUTATED'; return 'x'; },
    enumerable: true, configurable: false
  });
  assertFpFails('mutator getter', p, 'INVALID_PACKET_PROPERTY');
  assert.equal(invoked, 0, 'Mutator getter must not be invoked');
  assert.equal(p.scene_goal, original, 'scene_goal unchanged');
});

await test('FP-pre: symbol-keyed root property fails', () => {
  const p = { a: 1 };
  p[Symbol('bad')] = 'x';
  assertFpFails('symbol root', p, 'INVALID_PACKET_PROPERTY');
});

await test('FP-pre: symbol-keyed nested property fails', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.required_events[0][Symbol('nested')] = 'x';
  assertFpFails('symbol nested', p, 'INVALID_PACKET_PROPERTY');
});

await test('FP-pre: non-enumerable root property fails', () => {
  const p = { a: 1 };
  Object.defineProperty(p, 'hidden', { value: 'x', enumerable: false, configurable: true });
  assertFpFails('non-enum root', p, 'INVALID_PACKET_PROPERTY');
});

await test('FP-pre: non-enumerable nested property fails', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  Object.defineProperty(p.required_events[0], '_hidden', { value: 'x', enumerable: false, configurable: true });
  assertFpFails('non-enum nested', p, 'INVALID_PACKET_PROPERTY');
});

await test('FP-pre: packet-array custom property fails', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules.custom = 'extra';
  assertFpFails('array custom prop', p, 'INVALID_PACKET_PROPERTY');
});

await test('FP-pre: packet-array named accessor fails without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  let invoked = 0;
  Object.defineProperty(p.voice_rules, 'trap', { get() { invoked++; return 'x'; }, enumerable: true, configurable: true });
  assertFpFails('array named accessor', p, 'INVALID_PACKET_PROPERTY');
  assert.equal(invoked, 0, 'Array named accessor must not be invoked');
});

await test('FP-pre: packet-array non-enumerable property fails', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  Object.defineProperty(p.voice_rules, '_h', { value: 'x', enumerable: false, configurable: true });
  assertFpFails('array non-enum', p, 'INVALID_PACKET_PROPERTY');
});

await test('FP-pre: sparse array fails', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const sparse = new Array(3);
  sparse[0] = 'a'; sparse[2] = 'c';
  p.voice_rules = sparse;
  assertFpFails('sparse array', p, 'NON_JSON_SAFE_VALUE');
});

await test('FP-pre: cyclic object fails', () => {
  const p = { a: {} };
  p.a.self = p;
  assertFpFails('cycle', p, 'NON_JSON_SAFE_VALUE');
});

// ─── §1E-3. Array-property hole (validator) ───────────────────────────

for (const field of ['required_events', 'future_reserved_events', 'scene_authorized_facts', 'voice_rules', 'pov_known_facts']) {
  await test(`Array custom property on ${field} rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[field].custom_prop = 'injected';
    p.packet_id = 'sep_dummy';
    assertFailsClosed(`custom prop ${field}`, p, contract, 'INVALID_PACKET_PROPERTY');
  });

  await test(`Array named accessor on ${field} rejected without invocation`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    let invoked = 0;
    Object.defineProperty(p[field], 'trap', { get() { invoked++; return 'x'; }, enumerable: true, configurable: true });
    p.packet_id = 'sep_dummy';
    assertFailsClosed(`named accessor ${field}`, p, contract, 'INVALID_PACKET_PROPERTY');
    assert.equal(invoked, 0, `${field} named accessor must not be invoked`);
  });

  await test(`Array non-enumerable property on ${field} rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    Object.defineProperty(p[field], '_hidden', { value: 'x', enumerable: false, configurable: true });
    p.packet_id = 'sep_dummy';
    assertFailsClosed(`non-enum ${field}`, p, contract, 'INVALID_PACKET_PROPERTY');
  });

  await test(`Array symbol property on ${field} rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p[field][Symbol('bad')] = 'x';
    p.packet_id = 'sep_dummy';
    assertFailsClosed(`symbol ${field}`, p, contract, 'INVALID_PACKET_PROPERTY');
  });
}

// ─── §1E-4. Contract recursive inspection ─────────────────────────────

function makeRawBeat() {
  return {
    scene_number: 1,
    scene_id: 'ch01-s01',
    scene_goal: 'Goal',
    entry_state: 'Entry',
    required_events: ['Event A'],
    forbidden_events: ['Forbidden A'],
    exit_state: 'Exit',
    continuity_dependencies: ['Dep A'],
  };
}

function makeFrozenContract(overrides) {
  const beat = makeRawBeat();
  const base = {
    version: 'fiction-scene-contract-v2',
    fingerprint: 'test-fp',
    chapterNumber: 1,
    beats: [beat],
    ...overrides,
  };
  return JSON.parse(JSON.stringify(base));
}

function deepFreezeAll(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  const keys = Reflect.ownKeys(obj);
  for (const k of keys) {
    const desc = Object.getOwnPropertyDescriptor(obj, k);
    if (desc && !desc.get && !desc.set && desc.value && typeof desc.value === 'object') {
      deepFreezeAll(desc.value);
    }
  }
  return obj;
}

function assertContractFails(label, contract, packet) {
  const packetSnap = packet ? snapshotDescriptorSafe(packet) : null;
  let caught;
  try {
    validateSceneExecutionPacket(packet || makeValidPacket(makeContract()), contract);
  } catch (e) { caught = e; }
  assert.ok(caught, `${label}: Expected to throw`);
  assert.equal(caught.code, 'SCENE_CONTRACT_NOT_IMMUTABLE', `${label}: Expected SCENE_CONTRACT_NOT_IMMUTABLE, got ${caught.code}`);
  assert.ok(Array.isArray(caught.issues), `${label}: issues array`);
  assert.ok(caught.issues.length > 0, `${label}: issues nonempty`);
  assert.ok(Object.isFrozen(caught.issues), `${label}: issues frozen`);
  if (packet && packetSnap) {
    assertSnapshotsEqual(packetSnap, snapshotDescriptorSafe(packet), `${label}: packet unchanged`);
  }
}

await test('Contract: getter at required_events[0] rejected without invocation', () => {
  const c = makeFrozenContract();
  let invoked = 0;
  Object.defineProperty(c.beats[0].required_events, 0, { get() { invoked++; return 'Event A'; }, enumerable: true, configurable: true });
  deepFreezeAll(c);
  assertContractFails('re getter', c);
  assert.equal(invoked, 0, 'required_events[0] getter must not be invoked');
});

await test('Contract: getter at forbidden_events[0] rejected without invocation', () => {
  const c = makeFrozenContract();
  let invoked = 0;
  Object.defineProperty(c.beats[0].forbidden_events, 0, { get() { invoked++; return 'Forbidden A'; }, enumerable: true, configurable: true });
  deepFreezeAll(c);
  assertContractFails('fe getter', c);
  assert.equal(invoked, 0, 'forbidden_events[0] getter must not be invoked');
});

await test('Contract: getter at continuity_dependencies[0] rejected without invocation', () => {
  const c = makeFrozenContract();
  let invoked = 0;
  Object.defineProperty(c.beats[0].continuity_dependencies, 0, { get() { invoked++; return 'Dep A'; }, enumerable: true, configurable: true });
  deepFreezeAll(c);
  assertContractFails('cd getter', c);
  assert.equal(invoked, 0, 'continuity_dependencies[0] getter must not be invoked');
});

await test('Contract: getter attempting to mutate packet rejected', () => {
  const c = makeFrozenContract();
  const p = makeValidPacket(makeContract());
  const originalGoal = p.scene_goal;
  let invoked = 0;
  Object.defineProperty(c.beats[0].required_events, 0, {
    get() { invoked++; p.scene_goal = 'MUTATED'; return 'Event A'; },
    enumerable: true, configurable: true
  });
  deepFreezeAll(c);
  assertContractFails('mutate packet via contract', c, p);
  assert.equal(invoked, 0, 'Getter must not be invoked');
  assert.equal(p.scene_goal, originalGoal, 'Packet scene_goal unchanged');
});

await test('Contract: named accessor on a contract array rejected', () => {
  const c = makeFrozenContract();
  let invoked = 0;
  Object.defineProperty(c.beats[0].required_events, 'trap', { get() { invoked++; return 'x'; }, enumerable: true, configurable: true });
  deepFreezeAll(c);
  assertContractFails('named accessor', c);
  assert.equal(invoked, 0, 'Named accessor must not be invoked');
});

await test('Contract: non-enumerable property on a beat rejected', () => {
  const c = makeFrozenContract();
  Object.defineProperty(c.beats[0], '_hidden', { value: 'x', enumerable: false, writable: false, configurable: false });
  deepFreezeAll(c);
  assertContractFails('non-enum beat', c);
});

await test('Contract: non-enumerable array property rejected', () => {
  const c = makeFrozenContract();
  Object.defineProperty(c.beats[0].required_events, '_h', { value: 'x', enumerable: false, configurable: true });
  deepFreezeAll(c);
  assertContractFails('non-enum array', c);
});

await test('Contract: symbol-keyed contract array property rejected', () => {
  const c = makeFrozenContract();
  c.beats[0].required_events[Symbol('bad')] = 'x';
  deepFreezeAll(c);
  assertContractFails('symbol array', c);
});

await test('Contract: cyclic deeply frozen contract data rejected', () => {
  const c = makeFrozenContract();
  c.beats[0].cyclic = c.beats[0];
  // Can't deepFreeze a cycle with Object.freeze, so freeze manually
  try { deepFreezeAll(c); } catch (_) {}
  // Even if freeze fails, the contract inspection should reject cycles
  assertContractFails('cyclic contract', c);
});

await test('Contract: chapterNumber: null rejected', () => {
  const c = makeFrozenContract({ chapterNumber: null });
  deepFreezeAll(c);
  assertContractFails('null chapterNumber', c);
});

await test('Contract: missing scene_number rejected', () => {
  const c = makeFrozenContract();
  delete c.beats[0].scene_number;
  deepFreezeAll(c);
  assertContractFails('missing scene_number', c);
});

await test('Contract: string-valued scene_number rejected', () => {
  const c = makeFrozenContract();
  c.beats[0].scene_number = '1';
  deepFreezeAll(c);
  assertContractFails('string scene_number', c);
});

await test('Contract: missing continuity_dependencies rejected', () => {
  const c = makeFrozenContract();
  delete c.beats[0].continuity_dependencies;
  deepFreezeAll(c);
  assertContractFails('missing continuity_deps', c);
});

await test('Contract: empty required_events entry rejected', () => {
  const c = makeFrozenContract();
  c.beats[0].required_events = [''];
  deepFreezeAll(c);
  assertContractFails('empty req event', c);
});

await test('Contract: empty forbidden_events entry rejected', () => {
  const c = makeFrozenContract();
  c.beats[0].forbidden_events = [''];
  deepFreezeAll(c);
  assertContractFails('empty forb event', c);
});

await test('Contract: empty continuity_dependencies entry rejected', () => {
  const c = makeFrozenContract();
  c.beats[0].continuity_dependencies = [''];
  deepFreezeAll(c);
  assertContractFails('empty cont dep', c);
});

console.log(`\nSTAGE 1E TESTS COMPLETE: ${passed} total passed\n`);

