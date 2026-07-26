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
  applySceneExecutionPromptCanary,
  composeSceneExecutionPacket,
  prepareSceneExecutionPromptCanary,
  prepareSceneExecutionShadowIntegration,
  renderSceneExecutionPromptProjection,
  validateSceneExecutionPacket,
  SCENE_EXECUTION_PACKET_VERSION,
  SCENE_EXECUTION_PROMPT_PROJECTION_VERSION,
  SCENE_EXECUTION_PROMPT_CANARY_VERSION,
  SCENE_EXECUTION_SHADOW_INTEGRATION_VERSION,
  SCENE_CONTEXT_COMPOSER_FEATURE,
  SCENE_EXECUTION_PROMPT_CANARY_FEATURE,
  SCENE_EXECUTION_SHADOW_FEATURE,
  isSceneExecutionPromptCanaryEnabled,
  isSceneExecutionShadowEnabled,
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
  let invoked = 0;
  Object.defineProperty(p.future_reserved_events[0], 'bomb', {
    get() { invoked++; throw new Error('boom'); },
    enumerable: true,
    configurable: false,
  });
  assertFailsClosed('nested getter boom', p, contract, 'INVALID_PACKET_PROPERTY');
  assert.equal(invoked, 0, 'Getter must not be invoked');
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
  p.current_scene_forbidden_events = ['not; a, comma-separated string but a valid entry'];
  p.packet_id = generatePacketFingerprint(p);
  assertFailsClosed('forbidden events modified', p, contract, 'FORBIDDEN_EVENTS_MISMATCH');
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
  assertSnapshotsEqual(snap, snapshotDescriptorSafe(packet), `${label}: packet unchanged`);
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
  // Always create the exact packet used for validation before snapshotting.
  const actualPacket = packet || makeValidPacket(makeContract());
  const packetSnap = snapshotDescriptorSafe(actualPacket);
  const contractSnap = snapshotDescriptorSafe(contract);
  let caught;
  try {
    validateSceneExecutionPacket(actualPacket, contract);
  } catch (e) { caught = e; }
  assert.ok(caught, `${label}: Expected to throw`);
  assert.equal(caught.code, 'SCENE_CONTRACT_NOT_IMMUTABLE', `${label}: Expected SCENE_CONTRACT_NOT_IMMUTABLE, got ${caught.code}`);
  assert.ok(Array.isArray(caught.issues), `${label}: issues array`);
  assert.ok(caught.issues.length > 0, `${label}: issues nonempty`);
  assert.ok(Object.isFrozen(caught.issues), `${label}: issues frozen`);
  assertSnapshotsEqual(packetSnap, snapshotDescriptorSafe(actualPacket), `${label}: packet unchanged`);
  assertSnapshotsEqual(contractSnap, snapshotDescriptorSafe(contract), `${label}: contract unchanged`);
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

// ═══════════════════════════════════════════════════════════════════════
// Stage 1F Tests
// ═══════════════════════════════════════════════════════════════════════

// ─── §1F-1. packet_id validation in generatePacketFingerprint ─────────

const PID_MALFORMED_VALUES = [
  ['number 0',         0,                      'INVALID_PACKET_PROPERTY'],
  ['number 1',         1,                      'INVALID_PACKET_PROPERTY'],
  ['number -1',        -1,                     'INVALID_PACKET_PROPERTY'],
  ['NaN',              NaN,                    'INVALID_PACKET_PROPERTY'],
  ['Infinity',         Infinity,               'INVALID_PACKET_PROPERTY'],
  ['boolean true',     true,                   'INVALID_PACKET_PROPERTY'],
  ['boolean false',    false,                  'INVALID_PACKET_PROPERTY'],
  ['null',             null,                   'INVALID_PACKET_PROPERTY'],
  ['undefined',        undefined,              'INVALID_PACKET_PROPERTY'],
  ['empty string',     '',                     'INVALID_PACKET_PROPERTY'],
  ['whitespace',       '   ',                  'INVALID_PACKET_PROPERTY'],
  ['tab',              '\t',                   'INVALID_PACKET_PROPERTY'],
  ['object',           {},                     'INVALID_PACKET_PROPERTY'],
  ['array',            [],                     'INVALID_PACKET_PROPERTY'],
  ['Date',             new Date(),             'INVALID_PACKET_PROPERTY'],
  ['function',         () => {},               'INVALID_PACKET_PROPERTY'],
  ['symbol',           Symbol('pid'),          'INVALID_PACKET_PROPERTY'],
];

for (const [label, value, expectedCode] of PID_MALFORMED_VALUES) {
  await test(`FP packet_id: ${label} rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    p.packet_id = value;
    assertFpFails(`pid ${label}`, p, expectedCode);
  });
}

await test('FP packet_id: accessor rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  let invoked = 0;
  delete p.packet_id;
  Object.defineProperty(p, 'packet_id', {
    get() { invoked++; return 'sep_fake'; },
    enumerable: true, configurable: true,
  });
  assertFpFails('pid accessor', p, 'INVALID_PACKET_PROPERTY');
  assert.equal(invoked, 0, 'packet_id getter must not be invoked');
});

await test('FP packet_id: non-enumerable rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const val = p.packet_id;
  delete p.packet_id;
  Object.defineProperty(p, 'packet_id', {
    value: val, enumerable: false, writable: true, configurable: true,
  });
  assertFpFails('pid non-enum', p, 'INVALID_PACKET_PROPERTY');
});

await test('FP packet_id: absent is valid', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.packet_id;
  // Should not throw — absence is valid when generating the id
  const fp = generatePacketFingerprint(p);
  assert.equal(typeof fp, 'string');
  assert.ok(fp.startsWith('sep_'));
});

await test('FP packet_id: valid string accepted', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  // p.packet_id is already a valid string; should succeed
  const fp = generatePacketFingerprint(p);
  assert.equal(typeof fp, 'string');
});

// ─── §1F-2. __proto__ canonicalization ────────────────────────────────

await test('FP __proto__: root __proto__ data property is not silently omitted', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.packet_id;
  // Use Object.defineProperty to set __proto__ as a normal data property
  Object.defineProperty(p, '__proto__', {
    value: 'proto_value_root',
    enumerable: true, writable: true, configurable: true,
  });
  const fp1 = generatePacketFingerprint(p);

  const p2 = clonePacket(p);
  delete p2.packet_id;
  // p2 via JSON parse should also have __proto__ as data if cloned correctly.
  // But JSON.parse assigns to a {} which makes __proto__ disappear.
  // So we set it explicitly.
  Object.defineProperty(p2, '__proto__', {
    value: 'proto_value_root',
    enumerable: true, writable: true, configurable: true,
  });
  const fp2 = generatePacketFingerprint(p2);
  assert.equal(fp1, fp2, 'Same __proto__ value produces same fingerprint');
});

await test('FP __proto__: changing root __proto__ changes fingerprint', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  delete p1.packet_id;
  Object.defineProperty(p1, '__proto__', {
    value: 'proto_A',
    enumerable: true, writable: true, configurable: true,
  });
  const fp1 = generatePacketFingerprint(p1);

  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  Object.defineProperty(p2, '__proto__', {
    value: 'proto_B',
    enumerable: true, writable: true, configurable: true,
  });
  const fp2 = generatePacketFingerprint(p2);
  assert.notEqual(fp1, fp2, 'Different __proto__ values must produce different fingerprints');
});

await test('FP __proto__: nested __proto__ data property is not silently omitted', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.packet_id;
  const inner = {};
  Object.defineProperty(inner, '__proto__', {
    value: 'nested_proto_val',
    enumerable: true, writable: true, configurable: true,
  });
  Object.defineProperty(inner, 'event_id', {
    value: 'evt_proto_test',
    enumerable: true, writable: true, configurable: true,
  });
  p.future_reserved_events = [inner];
  const fp1 = generatePacketFingerprint(p);

  // Now change the nested __proto__ value
  const p2 = makeValidPacket(contract);
  delete p2.packet_id;
  const inner2 = {};
  Object.defineProperty(inner2, '__proto__', {
    value: 'different_nested_proto',
    enumerable: true, writable: true, configurable: true,
  });
  Object.defineProperty(inner2, 'event_id', {
    value: 'evt_proto_test',
    enumerable: true, writable: true, configurable: true,
  });
  p2.future_reserved_events = [inner2];
  const fp2 = generatePacketFingerprint(p2);
  assert.notEqual(fp1, fp2, 'Different nested __proto__ values must change fingerprint');
});

await test('FP __proto__: key reordering with __proto__ remains neutral', () => {
  const contract = makeContract();
  const p1 = makeValidPacket(contract);
  delete p1.packet_id;
  Object.defineProperty(p1, '__proto__', {
    value: 'proto_val',
    enumerable: true, writable: true, configurable: true,
  });
  const fp1 = generatePacketFingerprint(p1);

  // Rebuild with keys in different order
  const p2 = {};
  Object.defineProperty(p2, '__proto__', {
    value: 'proto_val',
    enumerable: true, writable: true, configurable: true,
  });
  const origKeys = Object.keys(p1).filter(k => k !== '__proto__');
  for (const k of origKeys.reverse()) {
    p2[k] = p1[k];
  }
  const fp2 = generatePacketFingerprint(p2);
  assert.equal(fp1, fp2, 'Key reorder with __proto__ must remain neutral');
});

await test('FP __proto__: original packet descriptor-unchanged after fingerprinting', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.packet_id;
  Object.defineProperty(p, '__proto__', {
    value: 'proto_val',
    enumerable: true, writable: true, configurable: true,
  });
  const snap = snapshotDescriptorSafe(p);
  generatePacketFingerprint(p);
  assertSnapshotsEqual(snap, snapshotDescriptorSafe(p), '__proto__ packet unchanged');
});

// ─── §1F-3. Canonical array-index boundary tests ─────────────────────

// 4294967295 (2^32-1) is NOT a valid array index. It looks like an integer
// but exceeds the maximum array index (2^32-2).
await test('FP: array property "4294967295" rejected (exceeds max index)', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules['4294967295'] = 'injected';
  assertFpFails('idx 2^32-1', p, 'INVALID_PACKET_PROPERTY');
});

await test('FP: array property "4294967296" rejected (> 2^32-1)', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules['4294967296'] = 'injected';
  assertFpFails('idx 2^32', p, 'INVALID_PACKET_PROPERTY');
});

await test('FP: array property "99999999999" rejected (far beyond bounds)', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules['99999999999'] = 'injected';
  assertFpFails('idx huge', p, 'INVALID_PACKET_PROPERTY');
});

await test('FP: out-of-bounds index on dense array creates sparse (rejected)', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  // Setting arr[len+5] auto-extends length, creating sparse entries
  const len = p.voice_rules.length;
  p.voice_rules[String(len + 5)] = 'beyond';
  assertFpFails('idx beyond len sparse', p, 'NON_JSON_SAFE_VALUE');
});

await test('FP: accessor at numeric array index rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  let invoked = 0;
  Object.defineProperty(p.voice_rules, '0', {
    get() { invoked++; return 'x'; },
    enumerable: true, configurable: true,
  });
  assertFpFails('idx accessor', p, 'INVALID_PACKET_PROPERTY');
  assert.equal(invoked, 0, 'Accessor at index must not be invoked');
});

await test('FP: non-enumerable index rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  Object.defineProperty(p.voice_rules, '0', {
    value: 'hidden', enumerable: false, writable: true, configurable: true,
  });
  assertFpFails('idx non-enum', p, 'INVALID_PACKET_PROPERTY');
});

// ─── §1F-4. Contract array-index boundary tests ──────────────────────

await test('Contract: array "4294967295" on required_events rejected', () => {
  const c = makeFrozenContract();
  c.beats[0].required_events['4294967295'] = 'injected';
  deepFreezeAll(c);
  assertContractFails('contract idx 2^32-1', c);
});

await test('Contract: array "4294967296" on forbidden_events rejected', () => {
  const c = makeFrozenContract();
  c.beats[0].forbidden_events['4294967296'] = 'injected';
  deepFreezeAll(c);
  assertContractFails('contract idx 2^32', c);
});

await test('Contract: out-of-bounds index on continuity_dependencies creates sparse (rejected)', () => {
  const c = makeFrozenContract();
  // Setting arr[len+5] auto-extends length, creating sparse entries
  const len = c.beats[0].continuity_dependencies.length;
  c.beats[0].continuity_dependencies[String(len + 5)] = 'beyond';
  deepFreezeAll(c);
  assertContractFails('contract idx beyond len sparse', c);
});

await test('Contract: accessor at numeric index on array rejected without invocation', () => {
  const c = makeFrozenContract();
  let invoked = 0;
  Object.defineProperty(c.beats[0].required_events, '0', {
    get() { invoked++; return 'Event A'; },
    enumerable: true, configurable: true,
  });
  deepFreezeAll(c);
  assertContractFails('contract idx accessor', c);
  assert.equal(invoked, 0, 'Contract index accessor must not be invoked');
});

await test('Contract: non-enumerable numeric index on array rejected', () => {
  const c = makeFrozenContract();
  Object.defineProperty(c.beats[0].required_events, '0', {
    value: 'Event A', enumerable: false, writable: false, configurable: false,
  });
  // Freeze won't iterate to the value since we freeze manually
  try { Object.freeze(c.beats[0].required_events); } catch (_) {}
  deepFreezeAll(c);
  assertContractFails('contract idx non-enum', c);
});

// ═══════════════════════════════════════════════════════════════════════
// Stage 1G Tests: Own-Property Authority & Inheritance Boundaries
// ═══════════════════════════════════════════════════════════════════════

function restoreAndAssertObjectPrototypeDescriptor(field, savedDescriptor) {
  if (savedDescriptor === undefined) {
    delete Object.prototype[field];
    assert.equal(
      Object.getOwnPropertyDescriptor(Object.prototype, field),
      undefined,
      `Object.prototype.${field} must be absent after restoration`
    );
    return;
  }

  Object.defineProperty(Object.prototype, field, savedDescriptor);
  const restoredDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, field);
  assert.ok(restoredDescriptor, `Object.prototype.${field} descriptor must be restored`);
  assert.equal(restoredDescriptor.enumerable, savedDescriptor.enumerable, `${field}: enumerable flag`);
  assert.equal(restoredDescriptor.configurable, savedDescriptor.configurable, `${field}: configurable flag`);
  assert.equal(restoredDescriptor.writable, savedDescriptor.writable, `${field}: writable flag`);
  assert.strictEqual(restoredDescriptor.value, savedDescriptor.value, `${field}: value identity`);
  assert.strictEqual(restoredDescriptor.get, savedDescriptor.get, `${field}: getter identity`);
  assert.strictEqual(restoredDescriptor.set, savedDescriptor.set, `${field}: setter identity`);
}

// ─── §1G-1. Inherited packet_id rejection ────────────────────────────

await test('FP inherited packet_id: inherited string rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'packet_id');
  try {
    Object.defineProperty(Object.prototype, 'packet_id', {
      value: 'sep_inherited_value',
      enumerable: false, writable: true, configurable: true,
    });
    delete p.packet_id;
    assertFpFails('inherited string pid', p, 'INVALID_PACKET_PROPERTY');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('packet_id', saved);
  }
});

await test('FP inherited packet_id: inherited getter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'packet_id');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'packet_id', {
      get() { invoked++; return 'sep_from_proto'; },
      enumerable: false, configurable: true,
    });
    delete p.packet_id;
    assertFpFails('inherited getter pid', p, 'INVALID_PACKET_PROPERTY');
    assert.equal(invoked, 0, 'Inherited getter must not be invoked');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('packet_id', saved);
  }
});

await test('FP inherited packet_id: inherited setter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'packet_id');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'packet_id', {
      set(_v) { invoked++; },
      enumerable: false, configurable: true,
    });
    delete p.packet_id;
    assertFpFails('inherited setter pid', p, 'INVALID_PACKET_PROPERTY');
    assert.equal(invoked, 0, 'Inherited setter must not be invoked');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('packet_id', saved);
  }
});

await test('FP inherited packet_id: inherited property getter invocation count remains 0', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.packet_id;
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'packet_id');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'packet_id', {
      get() { invoked++; return 'sep_from_proto'; },
      enumerable: false, configurable: true,
    });
    assertFailsClosed('inherited getter pid validator', p, contract, 'INVALID_PACKET_PROPERTY');
    assert.equal(invoked, 0, 'Getter invocation count must be exactly 0');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('packet_id', saved);
  }
});

await test('FP inherited packet_id: ordinary absence still valid', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  delete p.packet_id;
  const fp = generatePacketFingerprint(p);
  assert.equal(typeof fp, 'string');
  assert.ok(fp.startsWith('sep_'));
});

await test('FP inherited packet_id: own valid string still accepted', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const fp = generatePacketFingerprint(p);
  assert.equal(typeof fp, 'string');
});

await test('Valid null-prototype packet and nested objects remain accepted', () => {
  const contract = makeContract();
  const ordinaryPacket = makeValidPacket(contract);
  const toNullPrototypeRecord = (record) => Object.assign(Object.create(null), record);
  const packet = toNullPrototypeRecord(ordinaryPacket);

  packet.required_events = ordinaryPacket.required_events.map(toNullPrototypeRecord);
  packet.future_reserved_events = ordinaryPacket.future_reserved_events.map(toNullPrototypeRecord);
  packet.scene_authorized_facts = ordinaryPacket.scene_authorized_facts.map((fact) => {
    const convertedFact = toNullPrototypeRecord(fact);
    convertedFact.knowledge_scope = toNullPrototypeRecord(fact.knowledge_scope);
    return convertedFact;
  });
  delete packet.packet_id;
  packet.packet_id = generatePacketFingerprint(packet);

  assert.equal(Object.getPrototypeOf(packet), null);
  assert.equal(Object.getPrototypeOf(packet.required_events), Array.prototype);
  assert.equal(Object.getPrototypeOf(packet.future_reserved_events), Array.prototype);
  assert.equal(Object.getPrototypeOf(packet.scene_authorized_facts), Array.prototype);
  for (const event of packet.required_events) assert.equal(Object.getPrototypeOf(event), null);
  for (const event of packet.future_reserved_events) assert.equal(Object.getPrototypeOf(event), null);
  for (const fact of packet.scene_authorized_facts) {
    assert.equal(Object.getPrototypeOf(fact), null);
    assert.equal(Object.getPrototypeOf(fact.knowledge_scope), null);
  }

  const packetSnap = snapshotDescriptorSafe(packet);
  const contractSnap = snapshotDescriptorSafe(contract);
  const validated = validateSceneExecutionPacket(packet, contract);

  assert.ok(Object.isFrozen(validated));
  assert.equal(validated.packet_id, packet.packet_id);
  assert.equal(validated.scene_id, packet.scene_id);
  assert.deepEqual(validated.required_events, JSON.parse(JSON.stringify(packet.required_events)));
  assert.deepEqual(validated.future_reserved_events, JSON.parse(JSON.stringify(packet.future_reserved_events)));
  assert.deepEqual(validated.scene_authorized_facts, JSON.parse(JSON.stringify(packet.scene_authorized_facts)));
  assert.equal(validated.scene_authorized_facts[0].knowledge_scope.pov_identity, packet.pov_identity);
  assert.equal(validated.scene_authorized_facts[0].knowledge_scope.basis, 'witnessed');
  assertSnapshotsEqual(packetSnap, snapshotDescriptorSafe(packet), 'null-prototype packet unchanged');
  assertSnapshotsEqual(contractSnap, snapshotDescriptorSafe(contract), 'null-prototype contract unchanged');
});

// ─── §1G-2. Top-level required fields own-property validation ────────

const TOP_LEVEL_REQUIRED_FIELDS = [
  'packet_version',
  'snapshot_id',
  'source_contract_fingerprint',
  'project_id',
  'chapter_id',
  'scene_id',
  'scene_goal',
  'entry_state',
  'exit_state',
  'pov_identity',
  'immediate_continuity',
  'current_scene_forbidden_events',
  'continuity_dependencies',
  'current_locations',
  'current_possessions',
  'current_injuries',
  'confirmed_deaths',
  'current_separations',
  'unavailable_objects',
  'canonically_unique_objects',
  'voice_rules',
  'required_events',
  'future_reserved_events',
  'scene_authorized_facts',
  'completed_events',
  'pov_known_facts',
  'chapter_number',
  'scene_number'
];

for (const field of TOP_LEVEL_REQUIRED_FIELDS) {
  await test(`Inherited top-level field "${field}": getter rejected without invocation`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    const originalVal = p[field];
    const saved = Object.getOwnPropertyDescriptor(Object.prototype, field);
    try {
      let invoked = 0;
      Object.defineProperty(Object.prototype, field, {
        get() { invoked++; return originalVal; },
        enumerable: false, configurable: true,
      });
      delete p[field];
      p.packet_id = generatePacketFingerprint(p);
      assertFailsClosed(`inherited top-level getter ${field}`, p, contract, 'MISSING_REQUIRED_FIELD');
      assert.equal(invoked, 0, `Inherited getter for ${field} must not be invoked`);
    } finally {
      restoreAndAssertObjectPrototypeDescriptor(field, saved);
    }
  });

  await test(`Inherited top-level field "${field}": data property rejected`, () => {
    const contract = makeContract();
    const p = makeValidPacket(contract);
    const originalVal = p[field];
    const saved = Object.getOwnPropertyDescriptor(Object.prototype, field);
    try {
      Object.defineProperty(Object.prototype, field, {
        value: originalVal,
        enumerable: false, writable: true, configurable: true,
      });
      delete p[field];
      p.packet_id = generatePacketFingerprint(p);
      assertFailsClosed(`inherited top-level data prop ${field}`, p, contract, 'MISSING_REQUIRED_FIELD');
    } finally {
      restoreAndAssertObjectPrototypeDescriptor(field, saved);
    }
  });
}

// ─── §1G-3. Nested required fields own-property validation ───────────

await test('Inherited required_events[0].event_id: getter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'event_id');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'event_id', {
      get() { invoked++; return 'evt_inherited'; },
      enumerable: false, configurable: true,
    });
    delete p.required_events[0].event_id;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited req_events.event_id getter', p, contract, 'MISSING_REQUIRED_FIELD');
    assert.equal(invoked, 0, 'Getter must not be invoked');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('event_id', saved);
  }
});

await test('Inherited required_events[0].event_id: data property rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'event_id');
  try {
    Object.defineProperty(Object.prototype, 'event_id', {
      value: 'evt_inherited',
      enumerable: false, writable: true, configurable: true,
    });
    delete p.required_events[0].event_id;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited req_events.event_id data prop', p, contract, 'MISSING_REQUIRED_FIELD');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('event_id', saved);
  }
});

await test('Inherited required_events[0].text: getter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'text');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'text', {
      get() { invoked++; return 'inherited text'; },
      enumerable: false, configurable: true,
    });
    delete p.required_events[0].text;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited req_events.text getter', p, contract, 'MISSING_REQUIRED_FIELD');
    assert.equal(invoked, 0, 'Getter must not be invoked');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('text', saved);
  }
});

await test('Inherited required_events[0].text: data property rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'text');
  try {
    Object.defineProperty(Object.prototype, 'text', {
      value: 'inherited text',
      enumerable: false, writable: true, configurable: true,
    });
    delete p.required_events[0].text;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited req_events.text data prop', p, contract, 'MISSING_REQUIRED_FIELD');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('text', saved);
  }
});

await test('Inherited future_reserved_events[0].event_id: getter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'event_id');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'event_id', {
      get() { invoked++; return 'evt_fut_inherited'; },
      enumerable: false, configurable: true,
    });
    delete p.future_reserved_events[0].event_id;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited fut_events.event_id getter', p, contract, 'MISSING_REQUIRED_FIELD');
    assert.equal(invoked, 0, 'Getter must not be invoked');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('event_id', saved);
  }
});

await test('Inherited future_reserved_events[0].event_id: data property rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'event_id');
  try {
    Object.defineProperty(Object.prototype, 'event_id', {
      value: 'evt_fut_inherited',
      enumerable: false, writable: true, configurable: true,
    });
    delete p.future_reserved_events[0].event_id;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited fut_events.event_id data prop', p, contract, 'MISSING_REQUIRED_FIELD');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('event_id', saved);
  }
});

await test('Inherited scene_authorized_facts[0].fact_id: getter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'fact_id');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'fact_id', {
      get() { invoked++; return 'fact_inherited'; },
      enumerable: false, configurable: true,
    });
    delete p.scene_authorized_facts[0].fact_id;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited fact_id getter', p, contract, 'MISSING_REQUIRED_FIELD');
    assert.equal(invoked, 0, 'Getter must not be invoked');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('fact_id', saved);
  }
});

await test('Inherited scene_authorized_facts[0].fact_id: data property rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'fact_id');
  try {
    Object.defineProperty(Object.prototype, 'fact_id', {
      value: 'fact_inherited',
      enumerable: false, writable: true, configurable: true,
    });
    delete p.scene_authorized_facts[0].fact_id;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited fact_id data prop', p, contract, 'MISSING_REQUIRED_FIELD');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('fact_id', saved);
  }
});

await test('Inherited scene_authorized_facts[0].summary: getter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'summary');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'summary', {
      get() { invoked++; return 'inherited summary'; },
      enumerable: false, configurable: true,
    });
    delete p.scene_authorized_facts[0].summary;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited summary getter', p, contract, 'MISSING_REQUIRED_FIELD');
    assert.equal(invoked, 0, 'Getter must not be invoked');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('summary', saved);
  }
});

await test('Inherited scene_authorized_facts[0].summary: data property rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'summary');
  try {
    Object.defineProperty(Object.prototype, 'summary', {
      value: 'inherited summary',
      enumerable: false, writable: true, configurable: true,
    });
    delete p.scene_authorized_facts[0].summary;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited summary data prop', p, contract, 'MISSING_REQUIRED_FIELD');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('summary', saved);
  }
});

await test('Inherited scene_authorized_facts[0].provenance: getter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'provenance');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'provenance', {
      get() { invoked++; return 'inherited provenance'; },
      enumerable: false, configurable: true,
    });
    delete p.scene_authorized_facts[0].provenance;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited provenance getter', p, contract, 'MISSING_REQUIRED_FIELD');
    assert.equal(invoked, 0, 'Getter must not be invoked');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('provenance', saved);
  }
});

await test('Inherited scene_authorized_facts[0].provenance: data property rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'provenance');
  try {
    Object.defineProperty(Object.prototype, 'provenance', {
      value: 'inherited provenance',
      enumerable: false, writable: true, configurable: true,
    });
    delete p.scene_authorized_facts[0].provenance;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited provenance data prop', p, contract, 'MISSING_REQUIRED_FIELD');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('provenance', saved);
  }
});

await test('Inherited scene_authorized_facts[0].knowledge_scope: getter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'knowledge_scope');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'knowledge_scope', {
      get() { invoked++; return { pov_identity: 'p1', basis: 'b1' }; },
      enumerable: false, configurable: true,
    });
    delete p.scene_authorized_facts[0].knowledge_scope;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited knowledge_scope getter', p, contract, 'MISSING_REQUIRED_FIELD');
    assert.equal(invoked, 0, 'Getter must not be invoked');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('knowledge_scope', saved);
  }
});

await test('Inherited scene_authorized_facts[0].knowledge_scope: data property rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'knowledge_scope');
  try {
    Object.defineProperty(Object.prototype, 'knowledge_scope', {
      value: { pov_identity: 'p1', basis: 'b1' },
      enumerable: false, writable: true, configurable: true,
    });
    delete p.scene_authorized_facts[0].knowledge_scope;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited knowledge_scope data prop', p, contract, 'MISSING_REQUIRED_FIELD');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('knowledge_scope', saved);
  }
});

await test('Inherited knowledge_scope.pov_identity: getter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'pov_identity');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'pov_identity', {
      get() { invoked++; return 'inherited POV'; },
      enumerable: false, configurable: true,
    });
    delete p.scene_authorized_facts[0].knowledge_scope.pov_identity;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited pov_identity getter', p, contract, 'MISSING_REQUIRED_FIELD');
    assert.equal(invoked, 0, 'Getter must not be invoked');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('pov_identity', saved);
  }
});

await test('Inherited knowledge_scope.pov_identity: data property rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'pov_identity');
  try {
    Object.defineProperty(Object.prototype, 'pov_identity', {
      value: 'inherited POV',
      enumerable: false, writable: true, configurable: true,
    });
    delete p.scene_authorized_facts[0].knowledge_scope.pov_identity;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited pov_identity data prop', p, contract, 'MISSING_REQUIRED_FIELD');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('pov_identity', saved);
  }
});

await test('Inherited knowledge_scope.basis: getter rejected without invocation', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'basis');
  try {
    let invoked = 0;
    Object.defineProperty(Object.prototype, 'basis', {
      get() { invoked++; return 'inherited basis'; },
      enumerable: false, configurable: true,
    });
    delete p.scene_authorized_facts[0].knowledge_scope.basis;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited basis getter', p, contract, 'MISSING_REQUIRED_FIELD');
    assert.equal(invoked, 0, 'Getter must not be invoked');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('basis', saved);
  }
});

await test('Inherited knowledge_scope.basis: data property rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'basis');
  try {
    Object.defineProperty(Object.prototype, 'basis', {
      value: 'inherited basis',
      enumerable: false, writable: true, configurable: true,
    });
    delete p.scene_authorized_facts[0].knowledge_scope.basis;
    p.packet_id = generatePacketFingerprint(p);
    assertFailsClosed('inherited basis data prop', p, contract, 'MISSING_REQUIRED_FIELD');
  } finally {
    restoreAndAssertObjectPrototypeDescriptor('basis', saved);
  }
});

// ─── §1G-3. BigInt packet_id (omitted from 1F) ──────────────────────

await test('FP packet_id: BigInt rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.packet_id = 1n;
  assertFpFails('pid BigInt', p, 'INVALID_PACKET_PROPERTY');
});

// ─── §1G-4. Validator-level array boundary tests ─────────────────────

await test('Validator: array "4294967295" on voice_rules rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules['4294967295'] = 'injected';
  assertFailsClosed('val idx 2^32-1', p, contract, 'INVALID_PACKET_PROPERTY');
});

await test('Validator: array "4294967296" on voice_rules rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules['4294967296'] = 'injected';
  assertFailsClosed('val idx 2^32', p, contract, 'INVALID_PACKET_PROPERTY');
});

await test('Validator: array "99999999999999" on voice_rules rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  p.voice_rules['99999999999999'] = 'injected';
  assertFailsClosed('val idx huge', p, contract, 'INVALID_PACKET_PROPERTY');
});

await test('Validator: sparse array on voice_rules rejected', () => {
  const contract = makeContract();
  const p = makeValidPacket(contract);
  const len = p.voice_rules.length;
  p.voice_rules[String(len + 5)] = 'beyond';
  assertFailsClosed('val sparse', p, contract, 'NON_JSON_SAFE_VALUE');
});

// ═══════════════════════════════════════════════════════════════════════
// Stage 2 — Pure Scene Execution Packet composer (default-off, unwired)
// ═══════════════════════════════════════════════════════════════════════

function makeComposerSnapshot(contract) {
  const chapter = {
    id: 'ch-001',
    chapter_number: contract.chapterNumber,
    updated_date: '2026-07-25',
  };
  return buildGenerationSnapshot({
    project: {
      id: 'proj-001',
      updated_date: '2026-07-25',
    },
    chapters: [chapter],
    chapter,
  });
}

function makeComposerContext() {
  return {
    pov_identity: 'Hero',
    immediate_continuity: 'The bell rope is still moving.',
    future_reserved_event_ids: ['future_evt_001'],
    scene_authorized_facts: [
      {
        fact_id: 'fact-001',
        summary: 'The hero has a sword',
        provenance: 'Chapter 1',
        knowledge_scope: {
          pov_identity: 'Hero',
          basis: 'witnessed',
        },
      },
    ],
    completed_event_ids: ['evt_done'],
    voice_rules: ['Third person past tense'],
    current_locations: ['Village'],
    current_possessions: ['Sword'],
    current_injuries: [],
    confirmed_deaths: [],
    current_separations: [],
    unavailable_objects: [],
    canonically_unique_objects: ['The Ancient Sword'],
    pov_known_fact_ids: ['fact-001'],
  };
}

function makeThreeSceneComposerContract() {
  return createImmutableSceneContract(
    [
      {
        scene_number: 1,
        scene_id: 'ch01-s01',
        scene_goal: 'Establish the locked room.',
        entry_state: 'Hero stands outside the room.',
        required_events: ['Hero finds the brass latch.'],
        forbidden_events: ['Do not open the room yet.'],
        exit_state: 'Hero holds the brass latch.',
        continuity_dependencies: [],
      },
      {
        scene_number: 2,
        scene_id: 'ch01-s02',
        scene_goal: 'Open the locked room.',
        entry_state: 'Hero holds the brass latch.',
        required_events: ['Hero opens the locked room.'],
        forbidden_events: ['Do not reveal what is inside the chest.'],
        exit_state: 'Hero stands inside the room.',
        continuity_dependencies: ['Hero holds the brass latch.'],
      },
      {
        scene_number: 3,
        scene_id: 'ch01-s03',
        scene_goal: 'Reveal the chest contents.',
        entry_state: 'Hero stands inside the room.',
        required_events: [
          'Hero opens the chest.',
          'Hero discovers the sealed letter.',
        ],
        forbidden_events: [],
        exit_state: 'Hero holds the sealed letter.',
        continuity_dependencies: ['Hero stands inside the room.'],
      },
    ],
    { chapterNumber: 1 }
  );
}

function makeComposerInput(overrides = {}) {
  const contract = overrides.immutableSceneContract || makeContract();
  return {
    flags: { [SCENE_CONTEXT_COMPOSER_FEATURE.key]: true },
    snapshot: makeComposerSnapshot(contract),
    immutableSceneContract: contract,
    sceneId: contract.beats[0].scene_id,
    context: makeComposerContext(),
    ...overrides,
  };
}

function assertComposerFailsClosed(label, input, expectedCode) {
  const before = snapshotDescriptorSafe(input);
  let caught;
  try {
    composeSceneExecutionPacket(input);
    assert.fail(`${label}: Expected composer to throw`);
  } catch (error) {
    caught = error;
  }
  assert.equal(caught.code, expectedCode, `${label}: wrong error code`);
  assert.ok(Array.isArray(caught.issues), `${label}: issues must be an array`);
  assert.ok(caught.issues.length > 0, `${label}: issues must be nonempty`);
  assert.ok(Object.isFrozen(caught.issues), `${label}: issues must be frozen`);
  assertSnapshotsEqual(before, snapshotDescriptorSafe(input), `${label}: input`);
}

await test('Stage 2 composer feature flag is own-data-only and accessor-safe', () => {
  const inherited = Object.create({ [SCENE_CONTEXT_COMPOSER_FEATURE.key]: true });
  assert.equal(isSceneContextComposerEnabled(inherited), false);

  let invoked = 0;
  const accessorFlags = {};
  Object.defineProperty(accessorFlags, SCENE_CONTEXT_COMPOSER_FEATURE.key, {
    get() {
      invoked += 1;
      return true;
    },
    enumerable: true,
    configurable: true,
  });
  assert.equal(isSceneContextComposerEnabled(accessorFlags), false);
  assert.equal(invoked, 0, 'feature-flag getter must not execute');

  const nullPrototypeFlags = Object.create(null);
  nullPrototypeFlags[SCENE_CONTEXT_COMPOSER_FEATURE.key] = true;
  assert.equal(isSceneContextComposerEnabled(nullPrototypeFlags), true);
});

await test('Stage 2 composer remains disabled without explicit opt-in', () => {
  const input = makeComposerInput({ flags: {} });
  assertComposerFailsClosed('composer disabled', input, 'SCENE_CONTEXT_COMPOSER_DISABLED');
});

await test('Stage 2 composer deterministically maps snapshot, contract, and scene-safe context', () => {
  const input = makeComposerInput();
  const before = snapshotDescriptorSafe(input);
  const packet = composeSceneExecutionPacket(input);

  assert.equal(packet.packet_version, SCENE_EXECUTION_PACKET_VERSION);
  assert.equal(packet.snapshot_id, input.snapshot.snapshotId);
  assert.equal(packet.source_contract_fingerprint, input.immutableSceneContract.fingerprint);
  assert.equal(packet.project_id, 'proj-001');
  assert.equal(packet.chapter_id, 'ch-001');
  assert.equal(packet.chapter_number, 1);
  assert.equal(packet.scene_id, 'ch01-s01');
  assert.equal(packet.scene_number, 1);
  assert.equal(packet.scene_goal, input.immutableSceneContract.beats[0].scene_goal);
  assert.equal(packet.entry_state, input.immutableSceneContract.beats[0].entry_state);
  assert.equal(packet.exit_state, input.immutableSceneContract.beats[0].exit_state);
  assert.equal(packet.pov_identity, 'Hero');
  assert.equal(packet.immediate_continuity, 'The bell rope is still moving.');
  assert.deepEqual(packet.current_scene_forbidden_events, ['Dragon appears']);
  assert.deepEqual(packet.continuity_dependencies, ['Sword is on the mantle']);
  assert.deepEqual(packet.future_reserved_events, [{ event_id: 'future_evt_001' }]);
  assert.deepEqual(packet.completed_events, ['evt_done']);
  assert.deepEqual(packet.pov_known_facts, ['fact-001']);
  assert.equal(
    packet.required_events[0].event_id,
    generateDeterministicEventId('proj-001', 'ch-001', 'ch01-s01', 'required', 1, 'The bell rings')
  );
  assert.equal(packet.packet_id, generatePacketFingerprint(packet));
  assert.ok(Object.isFrozen(packet));
  assert.ok(Object.isFrozen(packet.required_events));
  assert.ok(Object.isFrozen(packet.required_events[0]));
  assert.ok(Object.isFrozen(packet.scene_authorized_facts[0].knowledge_scope));
  assertSnapshotsEqual(before, snapshotDescriptorSafe(input), 'valid composer input');
});

await test('Stage 2 composer output is deterministic and detached from mutable context', () => {
  const input = makeComposerInput();
  const first = composeSceneExecutionPacket(input);
  const second = composeSceneExecutionPacket(input);
  assert.deepEqual(first, second);
  assert.equal(first.packet_id, second.packet_id);
  assert.notStrictEqual(first.current_locations, input.context.current_locations);
  assert.notStrictEqual(first.scene_authorized_facts, input.context.scene_authorized_facts);

  input.context.current_locations[0] = 'Changed after composition';
  input.context.scene_authorized_facts[0].summary = 'Changed after composition';
  assert.deepEqual(first.current_locations, ['Village']);
  assert.equal(first.scene_authorized_facts[0].summary, 'The hero has a sword');
});

await test('Stage 2 composer future authority contains IDs only, never event prose', () => {
  const packet = composeSceneExecutionPacket(makeComposerInput());
  assert.deepEqual(Object.keys(packet.future_reserved_events[0]), ['event_id']);
  assert.equal(JSON.stringify(packet).includes('future event prose'), false);
});

await test('Stage 2 composer derives prior and future event authority from contract order', () => {
  const contract = makeThreeSceneComposerContract();
  const context = makeComposerContext();
  context.future_reserved_event_ids = [];
  context.completed_event_ids = ['historical_evt_001'];
  const packet = composeSceneExecutionPacket(makeComposerInput({
    immutableSceneContract: contract,
    snapshot: makeComposerSnapshot(contract),
    sceneId: 'ch01-s02',
    context,
  }));

  const priorId = generateDeterministicEventId(
    'proj-001',
    'ch-001',
    'ch01-s01',
    'required',
    1,
    'Hero finds the brass latch.'
  );
  const futureIds = [
    generateDeterministicEventId(
      'proj-001',
      'ch-001',
      'ch01-s03',
      'required',
      1,
      'Hero opens the chest.'
    ),
    generateDeterministicEventId(
      'proj-001',
      'ch-001',
      'ch01-s03',
      'required',
      2,
      'Hero discovers the sealed letter.'
    ),
  ];

  assert.deepEqual(packet.completed_events, ['historical_evt_001', priorId]);
  assert.deepEqual(
    packet.future_reserved_events,
    futureIds.map((event_id) => ({ event_id }))
  );
  assert.deepEqual(
    packet.required_events.map((event) => event.text),
    ['Hero opens the locked room.']
  );
  const serialized = JSON.stringify(packet);
  assert.equal(serialized.includes('Hero finds the brass latch.'), false);
  assert.equal(serialized.includes('Hero opens the chest.'), false);
  assert.equal(serialized.includes('Hero discovers the sealed letter.'), false);
});

await test('Stage 2 composer rejects raw future event records instead of copying truth payloads', () => {
  const input = makeComposerInput();
  input.context.future_reserved_events = [
    {
      event_id: 'future_evt_001',
      text: 'future event prose',
      hidden_truth: 'secret outcome',
    },
  ];
  assertComposerFailsClosed('raw future records', input, 'INVALID_COMPOSER_INPUT');
});

await test('Stage 2 composer rejects raw foundation authority', () => {
  const input = makeComposerInput();
  input.context.world_md = 'raw story bible content';
  assertComposerFailsClosed('raw foundation', input, 'PROHIBITED_KEY');
});

await test('Stage 2 composer rejects unknown context fields', () => {
  const input = makeComposerInput();
  input.context.unapproved_notes = ['not packet authority'];
  assertComposerFailsClosed('unknown context', input, 'INVALID_COMPOSER_INPUT');
});

await test('Stage 2 composer rejects context accessors without invocation', () => {
  const input = makeComposerInput();
  let invoked = 0;
  Object.defineProperty(input.context, 'voice_rules', {
    get() {
      invoked += 1;
      return ['hostile'];
    },
    enumerable: true,
    configurable: true,
  });
  assertComposerFailsClosed('context accessor', input, 'INVALID_COMPOSER_INPUT');
  assert.equal(invoked, 0, 'context getter must not execute');
});

await test('Stage 2 composer rejects root accessors without invocation', () => {
  const input = makeComposerInput();
  let invoked = 0;
  Object.defineProperty(input, 'sceneId', {
    get() {
      invoked += 1;
      return 'ch01-s01';
    },
    enumerable: true,
    configurable: true,
  });
  assertComposerFailsClosed('root accessor', input, 'INVALID_COMPOSER_INPUT');
  assert.equal(invoked, 0, 'root getter must not execute');
});

await test('Stage 2 composer rejects snapshot accessors without invocation', () => {
  const input = makeComposerInput();
  let invoked = 0;
  const hostileSnapshot = {
    project: input.snapshot.project,
    chapter: input.snapshot.chapter,
  };
  Object.defineProperty(hostileSnapshot, 'snapshotId', {
    get() {
      invoked += 1;
      return input.snapshot.snapshotId;
    },
    enumerable: true,
    configurable: false,
  });
  Object.freeze(hostileSnapshot);
  input.snapshot = hostileSnapshot;
  assertComposerFailsClosed('snapshot accessor', input, 'INVALID_COMPOSER_INPUT');
  assert.equal(invoked, 0, 'snapshot getter must not execute');
});

await test('Stage 2 composer rejects snapshot and contract chapter mismatch', () => {
  const input = makeComposerInput();
  input.snapshot = buildGenerationSnapshot({
    project: { id: 'proj-001' },
    chapters: [{ id: 'ch-002', chapter_number: 2 }],
    chapter: { id: 'ch-002', chapter_number: 2 },
  });
  assertComposerFailsClosed('chapter mismatch', input, 'COMPOSER_SNAPSHOT_MISMATCH');
});

await test('Stage 2 composer rejects a scene outside the immutable contract', () => {
  const input = makeComposerInput({ sceneId: 'ch01-s99' });
  assertComposerFailsClosed('missing scene', input, 'COMPOSER_SCENE_NOT_FOUND');
});

await test('Stage 2 composer delegates malformed authorized facts to the hardened validator', () => {
  const input = makeComposerInput();
  input.context.scene_authorized_facts[0].knowledge_scope.pov_identity = 'Someone Else';
  assertComposerFailsClosed('wrong fact POV', input, 'KNOWLEDGE_SCOPE_POV_MISMATCH');
});

await test('Stage 2 composer accepts null-prototype scene-safe context', () => {
  const input = makeComposerInput();
  const nullContext = Object.create(null);
  for (const [key, value] of Object.entries(input.context)) {
    nullContext[key] = value;
  }
  input.context = nullContext;
  const packet = composeSceneExecutionPacket(input);
  assert.equal(packet.pov_identity, 'Hero');
  assert.equal(packet.packet_id, generatePacketFingerprint(packet));
});

await test('Stage 2 composer accepts buildGenerationSnapshot chapter number alias', () => {
  const contract = makeContract();
  const chapter = { id: 'ch-001', number: 1 };
  const snapshot = buildGenerationSnapshot({
    project: { id: 'proj-001' },
    chapters: [chapter],
    chapter,
  });
  const packet = composeSceneExecutionPacket(makeComposerInput({
    immutableSceneContract: contract,
    snapshot,
  }));
  assert.equal(packet.chapter_number, 1);
});

await test('Stage 2 composer defaults optional scene-safe arrays and continuity to empty', () => {
  const input = makeComposerInput({ context: { pov_identity: 'Hero' } });
  const packet = composeSceneExecutionPacket(input);
  assert.equal(packet.immediate_continuity, '');
  assert.deepEqual(packet.future_reserved_events, []);
  assert.deepEqual(packet.scene_authorized_facts, []);
  assert.deepEqual(packet.completed_events, []);
  assert.deepEqual(packet.voice_rules, []);
  assert.deepEqual(packet.pov_known_facts, []);
});

await test('Stage 2 composer remains disconnected from live generation paths', () => {
  const runtimeFiles = [];
  const collectRuntimeFiles = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) collectRuntimeFiles(file);
      else if (/\.(?:js|jsx|mjs)$/.test(entry.name)) runtimeFiles.push(file);
    }
  };
  collectRuntimeFiles('src');
  for (const file of runtimeFiles) {
    if (file === 'src/lib/generationContext.js') continue;
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(
      source.includes('composeSceneExecutionPacket'),
      false,
      `${file} must not import or invoke the Stage 2 composer`
    );
  }
  assert.equal(SCENE_CONTEXT_COMPOSER_FEATURE.defaultEnabled, false);
});

// ═══════════════════════════════════════════════════════════════════════
// Stage 3 — Pure Scene Execution Prompt Projection (default-off, unwired)
// ═══════════════════════════════════════════════════════════════════════

function makePromptProjectionInput(overrides = {}) {
  const immutableSceneContract =
    overrides.immutableSceneContract || makeContract();
  const composerInput = makeComposerInput({
    immutableSceneContract,
    snapshot: makeComposerSnapshot(immutableSceneContract),
    ...(overrides.composer || {}),
  });
  const packet =
    overrides.packet || composeSceneExecutionPacket(composerInput);
  return {
    flags: { [SCENE_CONTEXT_COMPOSER_FEATURE.key]: true },
    packet,
    immutableSceneContract,
    ...overrides.input,
  };
}

function clonePromptPacket(packet) {
  return JSON.parse(JSON.stringify(packet));
}

function parsePromptProjection(rendered) {
  const lines = rendered.split('\n');
  assert.equal(
    lines[0],
    '<<< BEGIN VALIDATED SCENE EXECUTION AUTHORITY >>>'
  );
  assert.equal(
    lines[1],
    'Current-scene authority only. Future-reserved event IDs are opaque boundaries; do not infer or expand them.'
  );
  assert.equal(
    lines.at(-1),
    '<<< END VALIDATED SCENE EXECUTION AUTHORITY >>>'
  );
  return JSON.parse(lines.slice(2, -1).join('\n'));
}

function assertPromptProjectionFailsClosed(label, input, expectedCode) {
  const before = snapshotDescriptorSafe(input);
  let caught;
  try {
    renderSceneExecutionPromptProjection(input);
    assert.fail(`${label}: Expected prompt projection to throw`);
  } catch (error) {
    caught = error;
  }
  assert.equal(caught.code, expectedCode, `${label}: wrong error code`);
  assert.ok(Array.isArray(caught.issues), `${label}: issues must be an array`);
  assert.ok(caught.issues.length > 0, `${label}: issues must be nonempty`);
  assert.ok(Object.isFrozen(caught.issues), `${label}: issues must be frozen`);
  assertSnapshotsEqual(
    before,
    snapshotDescriptorSafe(input),
    `${label}: input`
  );
}

await test('Stage 3 prompt projection remains disabled without explicit opt-in', () => {
  const inheritedFlags = Object.create({
    [SCENE_CONTEXT_COMPOSER_FEATURE.key]: true,
  });
  const inheritedInput = makePromptProjectionInput({
    input: { flags: inheritedFlags },
  });
  assertPromptProjectionFailsClosed(
    'inherited projection flag',
    inheritedInput,
    'SCENE_CONTEXT_COMPOSER_DISABLED'
  );

  let invoked = 0;
  const accessorFlags = {};
  Object.defineProperty(accessorFlags, SCENE_CONTEXT_COMPOSER_FEATURE.key, {
    get() {
      invoked += 1;
      return true;
    },
    enumerable: true,
    configurable: true,
  });
  const accessorInput = makePromptProjectionInput({
    input: { flags: accessorFlags },
  });
  assertPromptProjectionFailsClosed(
    'accessor projection flag',
    accessorInput,
    'SCENE_CONTEXT_COMPOSER_DISABLED'
  );
  assert.equal(invoked, 0, 'projection feature-flag getter must not execute');
});

await test('Stage 3 prompt projection deterministically renders current-scene authority', () => {
  const input = makePromptProjectionInput();
  const before = snapshotDescriptorSafe(input);
  const first = renderSceneExecutionPromptProjection(input);
  const second = renderSceneExecutionPromptProjection(input);
  const projection = parsePromptProjection(first);

  assert.equal(first, second);
  assert.equal(
    projection.projection_version,
    SCENE_EXECUTION_PROMPT_PROJECTION_VERSION
  );
  assert.equal(projection.packet_id, input.packet.packet_id);
  assert.deepEqual(projection.scene_identity, {
    project_id: 'proj-001',
    chapter_id: 'ch-001',
    chapter_number: 1,
    scene_id: 'ch01-s01',
    scene_number: 1,
    pov_identity: 'Hero',
  });
  assert.equal(
    projection.current_scene_authority.scene_goal,
    'Introduce the protagonist'
  );
  assert.equal(
    projection.current_scene_authority.entry_state,
    'Morning in the village'
  );
  assert.deepEqual(
    projection.current_scene_authority.required_events.map(
      (event) => event.text
    ),
    ['The bell rings', 'Hero wakes up']
  );
  assert.deepEqual(
    projection.current_scene_authority.forbidden_events,
    ['Dragon appears']
  );
  assert.equal(
    projection.current_scene_authority.exit_state,
    'Hero leaves the house'
  );
  assert.deepEqual(projection.continuity.current_locations, ['Village']);
  assert.deepEqual(projection.continuity.current_possessions, ['Sword']);
  assert.deepEqual(projection.voice_rules, ['Third person past tense']);
  assertSnapshotsEqual(
    before,
    snapshotDescriptorSafe(input),
    'valid prompt projection input'
  );
});

await test('Stage 3 prompt projection exposes future authority as opaque IDs only', () => {
  const input = makePromptProjectionInput();
  const rendered = renderSceneExecutionPromptProjection(input);
  const projection = parsePromptProjection(rendered);

  assert.deepEqual(
    Object.keys(projection.future_boundaries),
    ['reserved_event_ids']
  );
  assert.deepEqual(
    projection.future_boundaries.reserved_event_ids,
    ['future_evt_001']
  );
  assert.equal(rendered.includes('future event prose'), false);
  assert.equal(rendered.includes('hidden_truth'), false);
  assert.equal(rendered.includes('secret outcome'), false);
});

await test('Stage 3 prompt projection excludes future contract prose', () => {
  const immutableSceneContract = makeThreeSceneComposerContract();
  const context = makeComposerContext();
  context.future_reserved_event_ids = [];
  context.completed_event_ids = [];
  const composer = makeComposerInput({
    immutableSceneContract,
    snapshot: makeComposerSnapshot(immutableSceneContract),
    sceneId: 'ch01-s02',
    context,
  });
  const input = makePromptProjectionInput({
    immutableSceneContract,
    packet: composeSceneExecutionPacket(composer),
  });
  const rendered = renderSceneExecutionPromptProjection(input);
  const projection = parsePromptProjection(rendered);

  assert.equal(rendered.includes('Hero opens the chest.'), false);
  assert.equal(
    rendered.includes('Hero discovers the sealed letter.'),
    false
  );
  assert.equal(
    projection.future_boundaries.reserved_event_ids.length,
    2
  );
  assert.ok(
    projection.future_boundaries.reserved_event_ids.every((eventId) =>
      /^evt_[a-f0-9]{8}$/.test(eventId)
    )
  );
});

await test('Stage 3 prompt projection rejects raw foundation and manuscript authority', () => {
  for (const [key, value] of [
    ['world_md', 'raw story bible'],
    ['accumulated_manuscript', 'raw manuscript prose'],
  ]) {
    const input = makePromptProjectionInput();
    input[key] = value;
    assertPromptProjectionFailsClosed(
      `projection prohibited ${key}`,
      input,
      'PROHIBITED_KEY'
    );
  }
});

await test('Stage 3 prompt projection revalidates packet fingerprint authority', () => {
  const input = makePromptProjectionInput();
  input.packet = clonePromptPacket(input.packet);
  input.packet.packet_id = 'sep_tampered';
  assertPromptProjectionFailsClosed(
    'projection tampered packet',
    input,
    'PACKET_FINGERPRINT_MISMATCH'
  );
});

await test('Stage 3 prompt projection revalidates the immutable source contract', () => {
  const input = makePromptProjectionInput();
  input.immutableSceneContract = JSON.parse(
    JSON.stringify(input.immutableSceneContract)
  );
  assertPromptProjectionFailsClosed(
    'projection mutable contract',
    input,
    'SCENE_CONTRACT_NOT_IMMUTABLE'
  );
});

await test('Stage 3 prompt projection rejects root accessors without invocation', () => {
  const input = makePromptProjectionInput();
  let invoked = 0;
  Object.defineProperty(input, 'packet', {
    get() {
      invoked += 1;
      return null;
    },
    enumerable: true,
    configurable: true,
  });
  assertPromptProjectionFailsClosed(
    'projection root accessor',
    input,
    'INVALID_COMPOSER_INPUT'
  );
  assert.equal(invoked, 0, 'projection root getter must not execute');
});

await test('Stage 3 prompt projection rejects packet accessors without invocation', () => {
  const input = makePromptProjectionInput();
  const packet = clonePromptPacket(input.packet);
  let invoked = 0;
  Object.defineProperty(packet, 'scene_goal', {
    get() {
      invoked += 1;
      return 'Hostile replacement';
    },
    enumerable: true,
    configurable: true,
  });
  input.packet = packet;
  assertPromptProjectionFailsClosed(
    'projection packet accessor',
    input,
    'INVALID_PACKET_PROPERTY'
  );
  assert.equal(invoked, 0, 'projection packet getter must not execute');
});

await test('Stage 3 prompt projection rejects contract accessors without invocation', () => {
  const input = makePromptProjectionInput();
  let invoked = 0;
  const hostileContract = {};
  Object.defineProperty(hostileContract, 'chapterNumber', {
    value: input.immutableSceneContract.chapterNumber,
    enumerable: true,
    configurable: false,
    writable: false,
  });
  Object.defineProperty(hostileContract, 'fingerprint', {
    value: input.immutableSceneContract.fingerprint,
    enumerable: true,
    configurable: false,
    writable: false,
  });
  Object.defineProperty(hostileContract, 'beats', {
    get() {
      invoked += 1;
      return input.immutableSceneContract.beats;
    },
    enumerable: true,
    configurable: false,
  });
  Object.freeze(hostileContract);
  input.immutableSceneContract = hostileContract;
  assertPromptProjectionFailsClosed(
    'projection contract accessor',
    input,
    'SCENE_CONTRACT_NOT_IMMUTABLE'
  );
  assert.equal(invoked, 0, 'projection contract getter must not execute');
});

await test('Stage 3 prompt projection rejects prose-shaped future event IDs', () => {
  const input = makePromptProjectionInput();
  input.packet = clonePromptPacket(input.packet);
  input.packet.future_reserved_events[0].event_id =
    'future event prose disguised as an id';
  input.packet.packet_id = generatePacketFingerprint(input.packet);
  assertPromptProjectionFailsClosed(
    'projection prose future ID',
    input,
    'INVALID_PROMPT_PROJECTION_ID'
  );
});

await test('Stage 3 prompt projection requires opaque event and fact references', () => {
  const cases = [
    {
      label: 'completed event reference',
      mutate(packet) {
        packet.completed_events[0] = 'completed event prose';
      },
    },
    {
      label: 'authorized fact reference',
      mutate(packet) {
        packet.scene_authorized_facts[0].fact_id = 'fact prose';
        packet.pov_known_facts[0] = 'fact prose';
      },
    },
  ];

  for (const item of cases) {
    const input = makePromptProjectionInput();
    input.packet = clonePromptPacket(input.packet);
    item.mutate(input.packet);
    input.packet.packet_id = generatePacketFingerprint(input.packet);
    assertPromptProjectionFailsClosed(
      `projection ${item.label}`,
      input,
      'INVALID_PROMPT_PROJECTION_ID'
    );
  }

  const validProjection = parsePromptProjection(
    renderSceneExecutionPromptProjection(makePromptProjectionInput())
  );
  assert.ok(
    validProjection.current_scene_authority.required_events.every((event) =>
      /^evt_[a-f0-9]{8}$/.test(event.event_id)
    )
  );
});

await test('Stage 3 prompt projection accepts null-prototype packet records', () => {
  const ordinaryInput = makePromptProjectionInput();
  const ordinaryPacket = ordinaryInput.packet;
  const toNullPrototypeRecord = (record) =>
    Object.assign(Object.create(null), record);
  const packet = toNullPrototypeRecord(ordinaryPacket);
  packet.required_events =
    ordinaryPacket.required_events.map(toNullPrototypeRecord);
  packet.future_reserved_events =
    ordinaryPacket.future_reserved_events.map(toNullPrototypeRecord);
  packet.scene_authorized_facts =
    ordinaryPacket.scene_authorized_facts.map((fact) => {
      const convertedFact = toNullPrototypeRecord(fact);
      convertedFact.knowledge_scope =
        toNullPrototypeRecord(fact.knowledge_scope);
      return convertedFact;
    });
  delete packet.packet_id;
  packet.packet_id = generatePacketFingerprint(packet);

  const flags = Object.create(null);
  flags[SCENE_CONTEXT_COMPOSER_FEATURE.key] = true;
  const input = Object.assign(Object.create(null), {
    flags,
    packet,
    immutableSceneContract: ordinaryInput.immutableSceneContract,
  });
  const before = snapshotDescriptorSafe(input);
  const projection = parsePromptProjection(
    renderSceneExecutionPromptProjection(input)
  );

  assert.equal(projection.packet_id, packet.packet_id);
  assert.equal(
    projection.knowledge_authority.authorized_facts[0].fact_id,
    'fact-001'
  );
  assertSnapshotsEqual(
    before,
    snapshotDescriptorSafe(input),
    'null-prototype projection input'
  );
});

await test('Stage 3 prompt projection remains disconnected from live generation paths', () => {
  const runtimeFiles = [];
  const collectRuntimeFiles = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) collectRuntimeFiles(file);
      else if (/\.(?:js|jsx|mjs)$/.test(entry.name)) runtimeFiles.push(file);
    }
  };
  collectRuntimeFiles('src');
  for (const file of runtimeFiles) {
    if (file === 'src/lib/generationContext.js') continue;
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(
      source.includes('renderSceneExecutionPromptProjection'),
      false,
      `${file} must not import or invoke the Stage 3 prompt projection`
    );
  }
  assert.equal(SCENE_CONTEXT_COMPOSER_FEATURE.defaultEnabled, false);
});

// ═══════════════════════════════════════════════════════════════════════
// Stage 4 — Scene Writer shadow integration (default-off, prompt-neutral)
// ═══════════════════════════════════════════════════════════════════════

function makeShadowIntegrationInput(overrides = {}) {
  const immutableSceneContract =
    overrides.immutableSceneContract || makeContract();
  const contextBySceneId =
    overrides.contextBySceneId || {
      'ch01-s01': makeComposerContext(),
    };
  return {
    integration: {
      flags: {
        [SCENE_CONTEXT_COMPOSER_FEATURE.key]: true,
        [SCENE_EXECUTION_SHADOW_FEATURE.key]: true,
      },
      snapshot: makeComposerSnapshot(immutableSceneContract),
      contextBySceneId,
      ...(overrides.integration || {}),
    },
    immutableSceneContract,
    ...(overrides.input || {}),
  };
}

function assertShadowIntegrationFailsClosed(label, input, expectedCode) {
  const before = snapshotDescriptorSafe(input);
  let caught;
  try {
    prepareSceneExecutionShadowIntegration(input);
    assert.fail(`${label}: Expected shadow integration to throw`);
  } catch (error) {
    caught = error;
  }
  assert.equal(caught.code, expectedCode, `${label}: wrong error code`);
  assert.ok(Array.isArray(caught.issues), `${label}: issues must be an array`);
  assert.ok(caught.issues.length > 0, `${label}: issues must be nonempty`);
  assert.ok(Object.isFrozen(caught.issues), `${label}: issues must be frozen`);
  assertSnapshotsEqual(
    before,
    snapshotDescriptorSafe(input),
    `${label}: input`
  );
}

await test('Stage 4 shadow feature metadata is immutable and default-disabled', () => {
  assert.equal(SCENE_EXECUTION_SHADOW_FEATURE.key, 'scene_execution_shadow_v1');
  assert.equal(SCENE_EXECUTION_SHADOW_FEATURE.defaultEnabled, false);
  assert.ok(Object.isFrozen(SCENE_EXECUTION_SHADOW_FEATURE));
  assert.equal(isSceneExecutionShadowEnabled(), false);
  assert.equal(isSceneExecutionShadowEnabled({}), false);
  assert.equal(
    isSceneExecutionShadowEnabled({
      [SCENE_EXECUTION_SHADOW_FEATURE.key]: true,
    }),
    true
  );
});

await test('Stage 4 shadow integration is a frozen no-op without explicit own opt-in', () => {
  const absent = {
    integration: null,
    immutableSceneContract: null,
  };
  const absentBefore = snapshotDescriptorSafe(absent);
  const absentResult = prepareSceneExecutionShadowIntegration(absent);
  assert.deepEqual(absentResult, {
    integration_version: SCENE_EXECUTION_SHADOW_INTEGRATION_VERSION,
    enabled: false,
    mode: 'disabled',
    scene_reports: [],
  });
  assert.ok(Object.isFrozen(absentResult));
  assert.ok(Object.isFrozen(absentResult.scene_reports));
  assertSnapshotsEqual(
    absentBefore,
    snapshotDescriptorSafe(absent),
    'absent shadow integration'
  );

  const inheritedFlags = Object.create({
    [SCENE_EXECUTION_SHADOW_FEATURE.key]: true,
  });
  const inherited = makeShadowIntegrationInput({
    integration: { flags: inheritedFlags },
  });
  assert.equal(
    prepareSceneExecutionShadowIntegration(inherited).enabled,
    false
  );

  let invoked = 0;
  const accessorFlags = {
    [SCENE_CONTEXT_COMPOSER_FEATURE.key]: true,
  };
  Object.defineProperty(accessorFlags, SCENE_EXECUTION_SHADOW_FEATURE.key, {
    get() {
      invoked += 1;
      return true;
    },
    enumerable: true,
    configurable: true,
  });
  const accessor = makeShadowIntegrationInput({
    integration: { flags: accessorFlags },
  });
  assert.equal(
    prepareSceneExecutionShadowIntegration(accessor).enabled,
    false
  );
  assert.equal(invoked, 0, 'shadow feature getter must not execute');
});

await test('Stage 4 shadow integration deterministically prepares every scene projection', () => {
  const input = makeShadowIntegrationInput();
  const before = snapshotDescriptorSafe(input);
  const first = prepareSceneExecutionShadowIntegration(input);
  const second = prepareSceneExecutionShadowIntegration(input);
  assert.deepEqual(first, second);
  assert.equal(
    first.integration_version,
    SCENE_EXECUTION_SHADOW_INTEGRATION_VERSION
  );
  assert.equal(first.enabled, true);
  assert.equal(first.mode, 'shadow');
  assert.equal(first.scene_reports.length, 1);
  assert.equal(first.scene_reports[0].scene_id, 'ch01-s01');
  assert.equal(first.scene_reports[0].scene_number, 1);
  assert.match(first.scene_reports[0].packet_id, /^sep_[a-f0-9]{8}$/);
  const projection = parsePromptProjection(
    first.scene_reports[0].projection
  );
  assert.equal(projection.packet_id, first.scene_reports[0].packet_id);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.scene_reports));
  assert.ok(Object.isFrozen(first.scene_reports[0]));
  assertSnapshotsEqual(
    before,
    snapshotDescriptorSafe(input),
    'valid shadow integration'
  );
});

await test('Stage 4 shadow integration requires the independent composer gate', () => {
  const input = makeShadowIntegrationInput();
  input.integration.flags = {
    [SCENE_EXECUTION_SHADOW_FEATURE.key]: true,
  };
  assertShadowIntegrationFailsClosed(
    'shadow without composer gate',
    input,
    'SCENE_EXECUTION_SHADOW_CORE_DISABLED'
  );
});

await test('Stage 4 shadow integration requires exact immutable-contract context coverage', () => {
  const missing = makeShadowIntegrationInput({ contextBySceneId: {} });
  assertShadowIntegrationFailsClosed(
    'missing shadow scene context',
    missing,
    'SCENE_EXECUTION_SHADOW_CONTEXT_MISSING'
  );

  const extra = makeShadowIntegrationInput();
  extra.integration.contextBySceneId['ch01-s99'] = makeComposerContext();
  assertShadowIntegrationFailsClosed(
    'extra shadow scene context',
    extra,
    'INVALID_SCENE_EXECUTION_SHADOW'
  );
});

await test('Stage 4 shadow integration rejects context-map accessors without invocation', () => {
  const input = makeShadowIntegrationInput();
  let invoked = 0;
  Object.defineProperty(input.integration.contextBySceneId, 'ch01-s01', {
    get() {
      invoked += 1;
      return makeComposerContext();
    },
    enumerable: true,
    configurable: true,
  });
  assertShadowIntegrationFailsClosed(
    'shadow context-map accessor',
    input,
    'INVALID_SCENE_EXECUTION_SHADOW'
  );
  assert.equal(invoked, 0, 'shadow context-map getter must not execute');
});

await test('Stage 4 shadow integration rejects raw foundation authority', () => {
  const input = makeShadowIntegrationInput();
  input.integration.contextBySceneId['ch01-s01'].world_md =
    'raw story bible';
  assertShadowIntegrationFailsClosed(
    'shadow raw foundation',
    input,
    'PROHIBITED_KEY'
  );
});

await test('Stage 4 shadow integration accepts null-prototype configuration records', () => {
  const ordinary = makeShadowIntegrationInput();
  const flags = Object.assign(Object.create(null), ordinary.integration.flags);
  const context = Object.assign(
    Object.create(null),
    ordinary.integration.contextBySceneId['ch01-s01']
  );
  const contextBySceneId = Object.create(null);
  contextBySceneId['ch01-s01'] = context;
  const integration = Object.assign(Object.create(null), {
    flags,
    snapshot: ordinary.integration.snapshot,
    contextBySceneId,
  });
  const input = Object.assign(Object.create(null), {
    integration,
    immutableSceneContract: ordinary.immutableSceneContract,
  });
  const result = prepareSceneExecutionShadowIntegration(input);
  assert.equal(result.enabled, true);
  assert.equal(result.scene_reports[0].scene_id, 'ch01-s01');
});

await test('Stage 4 shadow integration never exposes later-scene prose', () => {
  const immutableSceneContract = makeThreeSceneComposerContract();
  const contextBySceneId = Object.fromEntries(
    immutableSceneContract.beats.map((beat) => [
      beat.scene_id,
      {
        pov_identity: 'Hero',
        immediate_continuity: '',
      },
    ])
  );
  const input = makeShadowIntegrationInput({
    immutableSceneContract,
    contextBySceneId,
  });
  const result = prepareSceneExecutionShadowIntegration(input);
  assert.equal(result.scene_reports.length, 3);
  const firstProjection = result.scene_reports[0].projection;
  assert.equal(firstProjection.includes('Hero opens the locked room.'), false);
  assert.equal(firstProjection.includes('Hero opens the chest.'), false);
  assert.equal(
    firstProjection.includes('Hero discovers the sealed letter.'),
    false
  );
  const parsed = parsePromptProjection(firstProjection);
  assert.ok(
    parsed.future_boundaries.reserved_event_ids.every((eventId) =>
      /^evt_[a-f0-9]{8}$/.test(eventId)
    )
  );
});

await test('Stage 4 writer seam is shadow-only and has no UI activation', () => {
  const writer = fs.readFileSync('src/lib/sceneWriter.js', 'utf8');
  const projectStudio = fs.readFileSync('src/pages/ProjectStudio.jsx', 'utf8');
  const promptBuilderStart = writer.indexOf('function buildScenePrompt(args)');
  const promptBuilderEnd = writer.indexOf(
    'async function generateSceneWithRepair',
    promptBuilderStart
  );
  const promptBuilder = writer.slice(promptBuilderStart, promptBuilderEnd);

  assert.ok(
    writer.includes('prepareSceneExecutionShadowIntegration'),
    'sceneWriter must import and invoke the Stage 4 shadow adapter'
  );
  assert.equal(
    writer.includes('composeSceneExecutionPacket'),
    false,
    'sceneWriter must not directly compose packets'
  );
  assert.equal(
    writer.includes('renderSceneExecutionPromptProjection'),
    false,
    'sceneWriter must not directly render packet projections'
  );
  assert.equal(
    promptBuilder.includes('sceneExecutionShadow'),
    false,
    'buildScenePrompt must remain independent of shadow authority'
  );
  assert.equal(
    projectStudio.includes('sceneExecutionShadow'),
    false,
    'ProjectStudio must not activate Stage 4'
  );
  assert.match(
    writer,
    /const basePrompt = buildScenePrompt\(\{[\s\S]*?const promptCanaryResult = applySceneExecutionPromptCanary\(\{[\s\S]*?prompt: basePrompt,[\s\S]*?const prompt = promptCanaryResult\.prompt;/,
    'the existing prompt must pass through the prompt-neutral canary adapter'
  );
  assert.equal(SCENE_CONTEXT_COMPOSER_FEATURE.defaultEnabled, false);
  assert.equal(SCENE_EXECUTION_SHADOW_FEATURE.defaultEnabled, false);
});

// ═══════════════════════════════════════════════════════════════════════
// Stage 5 — Single-scene prompt canary (triple-gated, default-off)
// ═══════════════════════════════════════════════════════════════════════

function makePromptCanaryInput(overrides = {}) {
  const immutableSceneContract =
    overrides.immutableSceneContract || makeThreeSceneComposerContract();
  const contextBySceneId =
    overrides.contextBySceneId ||
    Object.fromEntries(
      immutableSceneContract.beats.map((beat) => [
        beat.scene_id,
        {
          pov_identity: 'Hero',
          immediate_continuity: '',
        },
      ])
    );
  const shadowState =
    overrides.shadowState ||
    prepareSceneExecutionShadowIntegration(
      makeShadowIntegrationInput({
        immutableSceneContract,
        contextBySceneId,
      })
    );
  return {
    integration: {
      flags: {
        [SCENE_CONTEXT_COMPOSER_FEATURE.key]: true,
        [SCENE_EXECUTION_SHADOW_FEATURE.key]: true,
        [SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key]: true,
      },
      targetSceneId: overrides.targetSceneId || 'ch01-s02',
      ...(overrides.integration || {}),
    },
    shadowState,
    immutableSceneContract,
    ...(overrides.input || {}),
  };
}

function assertPromptCanaryFailsClosed(label, input, expectedCode) {
  const before = snapshotDescriptorSafe(input);
  let caught;
  try {
    prepareSceneExecutionPromptCanary(input);
    assert.fail(`${label}: Expected prompt canary preparation to throw`);
  } catch (error) {
    caught = error;
  }
  assert.equal(caught.code, expectedCode, `${label}: wrong error code`);
  assert.ok(Array.isArray(caught.issues), `${label}: issues must be an array`);
  assert.ok(caught.issues.length > 0, `${label}: issues must be nonempty`);
  assert.ok(Object.isFrozen(caught.issues), `${label}: issues must be frozen`);
  assertSnapshotsEqual(
    before,
    snapshotDescriptorSafe(input),
    `${label}: input`
  );
}

await test('Stage 5 prompt canary feature metadata is immutable and default-disabled', () => {
  assert.equal(
    SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key,
    'scene_execution_prompt_canary_v1'
  );
  assert.equal(SCENE_EXECUTION_PROMPT_CANARY_FEATURE.defaultEnabled, false);
  assert.ok(Object.isFrozen(SCENE_EXECUTION_PROMPT_CANARY_FEATURE));
  assert.equal(isSceneExecutionPromptCanaryEnabled(), false);
  assert.equal(isSceneExecutionPromptCanaryEnabled({}), false);
  assert.equal(
    isSceneExecutionPromptCanaryEnabled({
      [SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key]: true,
    }),
    true
  );

  let invoked = 0;
  const flags = {};
  Object.defineProperty(flags, SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key, {
    get() {
      invoked += 1;
      return true;
    },
    enumerable: true,
    configurable: true,
  });
  assert.equal(isSceneExecutionPromptCanaryEnabled(flags), false);
  assert.equal(invoked, 0, 'prompt canary feature getter must not execute');
});

await test('Stage 5 absent or disabled prompt canary is an exact frozen no-op', () => {
  const disabledState = prepareSceneExecutionPromptCanary({
    integration: null,
    shadowState: null,
    immutableSceneContract: null,
  });
  assert.deepEqual(disabledState, {
    integration_version: SCENE_EXECUTION_PROMPT_CANARY_VERSION,
    enabled: false,
    mode: 'disabled',
    target_scene_id: null,
    packet_id: null,
    projection: null,
  });
  assert.ok(Object.isFrozen(disabledState));

  const prompt = 'LEGACY PROMPT\nWITH EXACT BYTES';
  const result = applySceneExecutionPromptCanary({
    state: disabledState,
    prompt,
    sceneId: 'ch01-s01',
  });
  assert.equal(result.prompt, prompt);
  assert.equal(result.applied, false);
  assert.equal(result.enabled, false);
  assert.ok(Object.isFrozen(result));

  const nonfictionNoIdResult = applySceneExecutionPromptCanary({
    state: disabledState,
    prompt,
    sceneId: undefined,
  });
  assert.equal(nonfictionNoIdResult.prompt, prompt);
  assert.equal(nonfictionNoIdResult.applied, false);
  assert.equal(nonfictionNoIdResult.scene_id, null);

  const ownButFalse = makePromptCanaryInput({
    integration: {
      flags: {
        [SCENE_CONTEXT_COMPOSER_FEATURE.key]: true,
        [SCENE_EXECUTION_SHADOW_FEATURE.key]: true,
        [SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key]: false,
      },
    },
  });
  assert.equal(
    prepareSceneExecutionPromptCanary(ownButFalse).enabled,
    false
  );
});

await test('Stage 5 prompt canary requires all three independent own gates', () => {
  const missingShadow = makePromptCanaryInput();
  missingShadow.integration.flags = {
    [SCENE_CONTEXT_COMPOSER_FEATURE.key]: true,
    [SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key]: true,
  };
  assertPromptCanaryFailsClosed(
    'canary without shadow gate',
    missingShadow,
    'SCENE_EXECUTION_PROMPT_CANARY_SHADOW_DISABLED'
  );

  const missingComposer = makePromptCanaryInput();
  missingComposer.integration.flags = {
    [SCENE_EXECUTION_SHADOW_FEATURE.key]: true,
    [SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key]: true,
  };
  assertPromptCanaryFailsClosed(
    'canary without composer gate',
    missingComposer,
    'SCENE_EXECUTION_PROMPT_CANARY_CORE_DISABLED'
  );

  const inheritedFlags = Object.create({
    [SCENE_CONTEXT_COMPOSER_FEATURE.key]: true,
    [SCENE_EXECUTION_SHADOW_FEATURE.key]: true,
    [SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key]: true,
  });
  const inherited = makePromptCanaryInput({
    integration: { flags: inheritedFlags },
  });
  assert.equal(prepareSceneExecutionPromptCanary(inherited).enabled, false);
});

await test('Stage 5 prompt canary accepts only branded enabled Stage 4 shadow state', () => {
  const input = makePromptCanaryInput({
    shadowState: Object.freeze({
      integration_version: SCENE_EXECUTION_SHADOW_INTEGRATION_VERSION,
      enabled: true,
      mode: 'shadow',
      source_contract_fingerprint: makeThreeSceneComposerContract().fingerprint,
      scene_reports: Object.freeze([]),
    }),
  });
  assertPromptCanaryFailsClosed(
    'synthetic shadow state',
    input,
    'SCENE_EXECUTION_PROMPT_CANARY_SHADOW_INVALID'
  );
});

await test('Stage 5 prompt canary binds one verified target scene deterministically', () => {
  const input = makePromptCanaryInput();
  const before = snapshotDescriptorSafe(input);
  const first = prepareSceneExecutionPromptCanary(input);
  const second = prepareSceneExecutionPromptCanary(input);
  assert.deepEqual(first, second);
  assert.equal(first.enabled, true);
  assert.equal(first.mode, 'single-scene-canary');
  assert.equal(first.target_scene_id, 'ch01-s02');
  assert.match(first.packet_id, /^sep_[a-f0-9]{8}$/);
  assert.match(
    first.projection,
    /<<< BEGIN VALIDATED SCENE EXECUTION AUTHORITY >>>/
  );
  assert.ok(Object.isFrozen(first));
  assertSnapshotsEqual(
    before,
    snapshotDescriptorSafe(input),
    'valid prompt canary preparation'
  );
});

await test('Stage 5 prompt canary rejects unknown or prose-shaped target IDs', () => {
  const unknown = makePromptCanaryInput({ targetSceneId: 'ch01-s99' });
  assertPromptCanaryFailsClosed(
    'unknown target scene',
    unknown,
    'SCENE_EXECUTION_PROMPT_CANARY_TARGET_MISMATCH'
  );

  const proseShaped = makePromptCanaryInput({
    targetSceneId: 'open the locked room now',
  });
  assertPromptCanaryFailsClosed(
    'prose-shaped target scene',
    proseShaped,
    'INVALID_SCENE_EXECUTION_PROMPT_CANARY_TARGET'
  );
});

await test('Stage 5 prompt canary rejects a shadow state from another contract', () => {
  const oneSceneContract = makeContract();
  const oneSceneShadow = prepareSceneExecutionShadowIntegration(
    makeShadowIntegrationInput({
      immutableSceneContract: oneSceneContract,
      contextBySceneId: {
        'ch01-s01': makeComposerContext(),
      },
    })
  );
  const input = makePromptCanaryInput({
    shadowState: oneSceneShadow,
  });
  assertPromptCanaryFailsClosed(
    'mismatched canary contract',
    input,
    'SCENE_EXECUTION_PROMPT_CANARY_CONTRACT_MISMATCH'
  );
});

await test('Stage 5 prompt canary bypasses every non-target scene byte-for-byte', () => {
  const state = prepareSceneExecutionPromptCanary(makePromptCanaryInput());
  const prompt = 'ORIGINAL SCENE ONE PROMPT';
  const result = applySceneExecutionPromptCanary({
    state,
    prompt,
    sceneId: 'ch01-s01',
  });
  assert.equal(result.enabled, true);
  assert.equal(result.applied, false);
  assert.equal(result.mode, 'single-scene-canary-bypass');
  assert.equal(result.prompt, prompt);
  assert.equal(result.packet_id, null);
});

await test('Stage 5 prompt canary appends one validated projection without rewriting the base prompt', () => {
  const state = prepareSceneExecutionPromptCanary(makePromptCanaryInput());
  const prompt = 'ORIGINAL TARGET PROMPT\nDO NOT REWRITE';
  const input = {
    state,
    prompt,
    sceneId: 'ch01-s02',
  };
  const before = snapshotDescriptorSafe(input);
  const result = applySceneExecutionPromptCanary(input);
  assert.equal(result.enabled, true);
  assert.equal(result.applied, true);
  assert.equal(result.mode, 'single-scene-canary');
  assert.equal(result.scene_id, 'ch01-s02');
  assert.equal(result.packet_id, state.packet_id);
  assert.equal(result.prompt.startsWith(`${prompt}\n\n`), true);
  assert.equal(result.prompt.slice(prompt.length + 2), state.projection);
  assert.equal(
    result.prompt.match(
      /<<< BEGIN VALIDATED SCENE EXECUTION AUTHORITY >>>/g
    )?.length,
    1
  );
  assert.ok(Object.isFrozen(result));
  assertSnapshotsEqual(
    before,
    snapshotDescriptorSafe(input),
    'prompt canary apply input'
  );
});

await test('Stage 5 prompt canary refuses duplicate authority injection', () => {
  const state = prepareSceneExecutionPromptCanary(makePromptCanaryInput());
  const input = {
    state,
    prompt:
      'BASE\n<<< BEGIN VALIDATED SCENE EXECUTION AUTHORITY >>>\nalready present',
    sceneId: 'ch01-s02',
  };
  let caught;
  try {
    applySceneExecutionPromptCanary(input);
    assert.fail('Expected duplicate canary injection to throw');
  } catch (error) {
    caught = error;
  }
  assert.equal(caught.code, 'SCENE_EXECUTION_PROMPT_CANARY_DUPLICATE');
});

await test('Stage 5 prompt canary never injects later-scene prose', () => {
  const state = prepareSceneExecutionPromptCanary(
    makePromptCanaryInput({ targetSceneId: 'ch01-s01' })
  );
  const result = applySceneExecutionPromptCanary({
    state,
    prompt: 'BASE PROMPT',
    sceneId: 'ch01-s01',
  });
  assert.equal(result.applied, true);
  assert.equal(result.prompt.includes('Hero opens the locked room.'), false);
  assert.equal(result.prompt.includes('Hero opens the chest.'), false);
  assert.equal(
    result.prompt.includes('Hero discovers the sealed letter.'),
    false
  );
  const projection = parsePromptProjection(state.projection);
  assert.ok(
    projection.future_boundaries.reserved_event_ids.every((eventId) =>
      /^evt_[a-f0-9]{8}$/.test(eventId)
    )
  );
});

await test('Stage 5 prompt canary rejects accessors without invocation and accepts null prototypes', () => {
  const accessorInput = makePromptCanaryInput();
  let invoked = 0;
  Object.defineProperty(accessorInput.integration, 'targetSceneId', {
    get() {
      invoked += 1;
      return 'ch01-s02';
    },
    enumerable: true,
    configurable: true,
  });
  assertPromptCanaryFailsClosed(
    'canary target accessor',
    accessorInput,
    'INVALID_COMPOSER_INPUT'
  );
  assert.equal(invoked, 0, 'prompt canary target getter must not execute');

  const ordinary = makePromptCanaryInput();
  const flags = Object.assign(
    Object.create(null),
    ordinary.integration.flags
  );
  const integration = Object.assign(Object.create(null), {
    flags,
    targetSceneId: ordinary.integration.targetSceneId,
  });
  const input = Object.assign(Object.create(null), {
    integration,
    shadowState: ordinary.shadowState,
    immutableSceneContract: ordinary.immutableSceneContract,
  });
  const state = prepareSceneExecutionPromptCanary(input);
  const applyInput = Object.assign(Object.create(null), {
    state,
    prompt: 'NULL PROTOTYPE BASE PROMPT',
    sceneId: 'ch01-s02',
  });
  assert.equal(
    applySceneExecutionPromptCanary(applyInput).applied,
    true
  );
});

await test('Stage 5 writer canary remains single-scene, default-off, and absent from UI activation', () => {
  const writer = fs.readFileSync('src/lib/sceneWriter.js', 'utf8');
  const projectStudio = fs.readFileSync('src/pages/ProjectStudio.jsx', 'utf8');
  const promptBuilderStart = writer.indexOf('function buildScenePrompt(args)');
  const promptBuilderEnd = writer.indexOf(
    'async function generateSceneWithRepair',
    promptBuilderStart
  );
  const promptBuilder = writer.slice(promptBuilderStart, promptBuilderEnd);

  assert.ok(writer.includes('prepareSceneExecutionPromptCanary'));
  assert.ok(writer.includes('applySceneExecutionPromptCanary'));
  assert.match(
    writer,
    /sceneExecutionPromptCanary = null,/
  );
  assert.equal(
    promptBuilder.includes('sceneExecutionPromptCanary'),
    false,
    'legacy prompt construction must remain independent of canary authority'
  );
  assert.equal(
    projectStudio.includes('sceneExecutionPromptCanary'),
    false,
    'ProjectStudio must not activate Stage 5'
  );
  assert.match(
    writer,
    /const basePrompt = buildScenePrompt\(\{[\s\S]*?const promptCanaryResult = applySceneExecutionPromptCanary\(\{[\s\S]*?prompt: basePrompt,[\s\S]*?const prompt = promptCanaryResult\.prompt;[\s\S]*?generateSceneWithRepair\(\{[\s\S]*?prompt,\n\s+model,/,
    'only the canary adapter result may cross the model-call prompt boundary'
  );
  assert.equal(SCENE_CONTEXT_COMPOSER_FEATURE.defaultEnabled, false);
  assert.equal(SCENE_EXECUTION_SHADOW_FEATURE.defaultEnabled, false);
  assert.equal(SCENE_EXECUTION_PROMPT_CANARY_FEATURE.defaultEnabled, false);
});
