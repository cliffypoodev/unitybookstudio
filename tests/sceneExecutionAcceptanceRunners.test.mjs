import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createSceneExecutionAcceptanceRunners } from '../src/lib/sceneExecutionAcceptanceRunners.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

const mockRequest = Object.freeze({
  contract_fingerprint: 'fp-123',
  scene_id: 'scene-456',
  scene_number: 1,
  packet: Object.freeze({ packet_id: 'packet-789', content: 'mock-packet' }),
  prose: 'This is the mock prose.',
  private_future_authority: Object.freeze({ auth: 'mock-auth' }),
});

const mockIssue = Object.freeze({
  code: 'FUTURE_EVENT_EARLY_PERFORMED',
  excerpt: 'mock prose',
  offset: 12,
  classification: 'repair_eligible'
});

async function runTests() {
  console.log('--- SCENE EXECUTION ACCEPTANCE RUNNERS TESTS ---');

  await test('1. Construction returns exactly two keys and is frozen', () => {
    let invokeCalls = 0;
    const fakeInvoke = async () => { invokeCalls++; return {}; };
    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });

    const keys = Object.keys(runners);
    assert.deepStrictEqual(keys.sort(), ['auditRunner', 'repairRunner']);
    assert.strictEqual(typeof runners.auditRunner, 'function');
    assert.strictEqual(typeof runners.repairRunner, 'function');
    assert.strictEqual(Object.isFrozen(runners), true);
    assert.strictEqual(invokeCalls, 0); // 2. Zero network calls during construction
  });

  await test('3. Frozen audit and repair requests are not mutated', async () => {
    const fakeInvoke = async () => ({ status: 'clean' });
    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });

    // audit
    await runners.auditRunner(mockRequest);
    // JS Object.freeze throws if mutated in strict mode (node assert strict is on, but function itself might not throw unless it writes. So let's just make sure it passes).

    // repair
    const repairReq = Object.freeze({ ...mockRequest, issue: mockIssue });
    await runners.repairRunner(repairReq);
  });

  await test('4 & 5 & 6. Schema contains clean and issues-found constraints', async () => {
    let capturedPayload = null;
    const fakeInvoke = async (payload) => {
      capturedPayload = payload;
      return { status: 'clean' };
    };

    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });
    await runners.auditRunner(mockRequest);

    const schema = capturedPayload.response_json_schema;
    assert.ok(schema.if);
    assert.ok(schema.then);
    assert.ok(schema.else);

    assert.strictEqual(schema.if.properties.status.const, 'clean');

    // Clean branch
    assert.strictEqual(schema.then.properties.issues.maxItems, 0);
    const cov = schema.then.properties.coverage.properties;
    assert.strictEqual(cov.entry_state_satisfied.const, 'verified');
    assert.strictEqual(cov.exit_state_attained.const, 'verified');
    assert.strictEqual(cov.required_events_satisfied.const, 'verified');
    assert.strictEqual(cov.forbidden_events_avoided.const, 'verified');
    assert.strictEqual(cov.continuity_satisfied.const, 'verified');

    // Issues-found branch
    assert.strictEqual(schema.else.properties.issues.minItems, 1);
    assert.strictEqual(schema.else.properties.issues.maxItems, 1);
  });

  await test('7. Schema contains all 15 exact code/classification pairs', async () => {
    let capturedPayload = null;
    const fakeInvoke = async (payload) => { capturedPayload = payload; return {}; };
    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });
    await runners.auditRunner(mockRequest);

    const anyOf = capturedPayload.response_json_schema.properties.issues.items.anyOf;
    assert.strictEqual(anyOf.length, 15);

    const pairs = anyOf.map(x => `${x.properties.code.const}:${x.properties.classification.const}`);
    const expected = [
      'REQUIRED_EVENT_MISSING:omission',
      'EXIT_STATE_MISSING:omission',
      'POV_IDENTITY_MISSING:omission',
      'REQUIRED_CONTINUITY_MISSING:omission',
      'SCENE_GOAL_MISSING:omission',
      'FUTURE_EVENT_EARLY_PERFORMED:repair_eligible',
      'FUTURE_EVENT_VIOLATION:repair_eligible',
      'UNSUPPORTED_EVENT_MECHANISM:repair_eligible',
      'UNSUPPORTED_EVENT_OPERATION:repair_eligible',
      'FORBIDDEN_EVENT_VIOLATION:repair_eligible',
      'UNSUPPORTED_HISTORY_OR_KNOWLEDGE:repair_eligible',
      'UNSUPPORTED_SETTING_DETAIL:repair_eligible',
      'EXIT_BOUNDARY_OVERRUN:repair_eligible',
      'POV_IDENTITY_DRIFT:repair_eligible',
      'VOICE_RULE_VIOLATION:non_repairable'
    ];

    for (const p of expected) {
      assert.ok(pairs.includes(p), `Missing pair: ${p}`);
    }
  });

  await test('8. Audit prompt explicitly requires constraints', async () => {
    let capturedPayload = null;
    const fakeInvoke = async (payload) => { capturedPayload = payload; return {}; };
    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });
    await runners.auditRunner(mockRequest);

    const prompt = capturedPayload.prompt;
    assert.ok(prompt.includes('exact zero-based start position'));
    assert.ok(prompt.includes('exact'));
    assert.ok(prompt.includes('highest-priority issue'));
    assert.ok(prompt.includes('issues: []'));
    assert.ok(prompt.includes('"verified"'));
  });

  await test('9. Repair prompt explicitly requires constraints', async () => {
    let capturedPayload = null;
    const fakeInvoke = async (payload) => { capturedPayload = payload; return {}; };
    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });
    await runners.repairRunner({ ...mockRequest, issue: mockIssue });

    const prompt = capturedPayload.prompt;
    assert.ok(prompt.includes('mock-packet'));
    assert.ok(prompt.includes('mock-auth'));
    assert.ok(prompt.includes('rewrite the scene'));
    assert.ok(prompt.includes('the reserved future event'));
  });

  await test('10. Constructor project sentinel is passed but not serialized', async () => {
    const sentinelProject = { id: 'sentinel-123', name: 'Test Project' };
    let capturedPayload = null;
    const fakeInvoke = async (payload) => { capturedPayload = payload; return {}; };

    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke, project: sentinelProject });
    await runners.auditRunner(mockRequest);

    assert.strictEqual(capturedPayload.project, sentinelProject);
    assert.strictEqual(capturedPayload.prompt.includes('sentinel-123'), false);

    await runners.repairRunner({ ...mockRequest, issue: mockIssue });
    assert.strictEqual(capturedPayload.project, sentinelProject);
    assert.strictEqual(capturedPayload.prompt.includes('sentinel-123'), false);
  });

  await test('11. Injected invocation errors escape unchanged', async () => {
    const error = new Error('Simulated invoke error');
    const fakeInvoke = async () => { throw error; };

    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });

    await assert.rejects(async () => {
      await runners.auditRunner(mockRequest);
    }, (err) => {
      assert.strictEqual(err, error);
      return true;
    });
  });

  await test('12. Source isolation', async () => {
    const sourcePath = new URL('../src/lib/sceneExecutionAcceptanceRunners.js', import.meta.url);
    const sourceCode = readFileSync(sourcePath, 'utf-8');

    assert.strictEqual(sourceCode.includes('sceneWriter.js'), false, 'Should not mention sceneWriter');
    assert.strictEqual(sourceCode.includes('ProjectStudio'), false, 'Should not mention ProjectStudio');
    assert.strictEqual(sourceCode.includes('fetch('), false, 'Should not directly call fetch');
    assert.strictEqual(sourceCode.includes('callOllama('), false, 'Should not directly call callOllama');
    assert.strictEqual(sourceCode.includes('callAgent('), false, 'Should not directly call callAgent');
    assert.strictEqual(sourceCode.includes('featureFlags'), false, 'Should not mention featureFlags');
  });

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
