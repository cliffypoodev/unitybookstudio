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

const mockRequest = {
  contract_fingerprint: 'fp-123',
  scene_id: 'scene-456',
  scene_number: 1,
  packet: { packet_id: 'packet-789', content: 'mock-packet' },
  prose: 'This is the mock prose.',
  private_future_authority: { auth: 'mock-auth' },
};

const mockIssue = {
  code: 'FUTURE_EVENT_EARLY_PERFORMED',
  excerpt: 'mock prose',
  offset: 12,
  classification: 'repair_eligible'
};

async function runTests() {
  console.log('--- SCENE EXECUTION ACCEPTANCE RUNNERS TESTS ---');

  await test('1. Runner construction', () => {
    let invokeCalls = 0;
    const fakeInvoke = async () => { invokeCalls++; return {}; };
    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });

    assert.strictEqual(typeof runners.auditRunner, 'function');
    assert.strictEqual(typeof runners.repairRunner, 'function');
    assert.strictEqual(Object.isFrozen(runners), true);
    assert.strictEqual(invokeCalls, 0);
  });

  await test('2. Clean audit', async () => {
    let capturedPayload = null;
    const fakeInvoke = async (payload) => {
      capturedPayload = payload;
      return { status: 'clean' }; // invoke returns the parsed object
    };

    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });
    const originalRequest = JSON.stringify(mockRequest);
    const result = await runners.auditRunner(mockRequest);

    assert.strictEqual(JSON.stringify(mockRequest), originalRequest, 'Request was mutated');
    assert.deepStrictEqual(result, { status: 'clean' }, 'Returned parsed response changed');
    
    assert.strictEqual(capturedPayload.task_type, 'evaluate');
    assert.strictEqual(capturedPayload.temperature, 0.1);
    
    // Check prompt
    assert.ok(capturedPayload.prompt.includes('mock-packet'));
    assert.ok(capturedPayload.prompt.includes('mock-auth'));
    assert.ok(capturedPayload.prompt.includes('This is the mock prose.'));

    // Check schema
    const schema = capturedPayload.response_json_schema;
    assert.ok(schema);
    assert.strictEqual(schema.properties.version.const, 'scene-execution-acceptance-gate-v1');
    assert.strictEqual(schema.properties.contract_fingerprint.const, 'fp-123');
    assert.strictEqual(schema.properties.scene_id.const, 'scene-456');
    assert.strictEqual(schema.properties.scene_number.const, 1);
    assert.strictEqual(schema.properties.packet_id.const, 'packet-789');
  });

  await test('3. Issue audit schema and prompt', async () => {
    let capturedPayload = null;
    const fakeInvoke = async (payload) => {
      capturedPayload = payload;
      return {};
    };

    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });
    await runners.auditRunner(mockRequest);

    const schema = capturedPayload.response_json_schema;
    const issueCodeEnum = schema.properties.issues.items.properties.code.enum;
    assert.ok(issueCodeEnum.includes('FUTURE_EVENT_EARLY_PERFORMED'));
    assert.ok(issueCodeEnum.includes('VOICE_RULE_VIOLATION'));
    assert.strictEqual(issueCodeEnum.length, 15);
    
    const classificationEnum = schema.properties.issues.items.properties.classification.enum;
    assert.ok(classificationEnum.includes('omission'));
    assert.ok(classificationEnum.includes('repair_eligible'));
    assert.ok(classificationEnum.includes('non_repairable'));
    assert.strictEqual(classificationEnum.length, 3);
  });

  await test('4. Surgical repair', async () => {
    let capturedPayload = null;
    const fakeInvoke = async (payload) => {
      capturedPayload = payload;
      return { status: 'repaired' };
    };

    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });
    
    const repairRequest = { ...mockRequest, issue: mockIssue };
    const originalRequest = JSON.stringify(repairRequest);

    const result = await runners.repairRunner(repairRequest);

    assert.strictEqual(JSON.stringify(repairRequest), originalRequest, 'Request was mutated');
    assert.deepStrictEqual(result, { status: 'repaired' }, 'Returned parsed response changed');
    
    assert.strictEqual(capturedPayload.task_type, 'fix');
    assert.strictEqual(capturedPayload.temperature, 0.1);

    assert.ok(capturedPayload.prompt.includes('Do not rewrite the whole scene.'));
    assert.ok(capturedPayload.prompt.includes(mockIssue.code));
    assert.ok(capturedPayload.prompt.includes(mockIssue.excerpt));
    
    const schema = capturedPayload.response_json_schema;
    assert.ok(schema);
    assert.strictEqual(schema.properties.status.const, 'repaired');
    
    const replacements = schema.properties.replacements;
    assert.strictEqual(replacements.minItems, 1);
    assert.strictEqual(replacements.maxItems, 1);
    
    const itemsProps = replacements.items.properties;
    assert.strictEqual(itemsProps.issue_code.const, 'FUTURE_EVENT_EARLY_PERFORMED');
    assert.strictEqual(itemsProps.start.const, 12);
    assert.strictEqual(itemsProps.end.const, 22);
    assert.strictEqual(itemsProps.original_excerpt.const, 'mock prose');
    assert.ok(itemsProps.replacement_text);
  });

  await test('5. Failure propagation', async () => {
    const error = new Error('Simulated invoke error');
    const fakeInvoke = async () => { throw error; };

    const runners = createSceneExecutionAcceptanceRunners({ invoke: fakeInvoke });

    await assert.rejects(async () => {
      await runners.auditRunner(mockRequest);
    }, (err) => {
      assert.strictEqual(err, error);
      return true;
    });

    await assert.rejects(async () => {
      await runners.repairRunner({ ...mockRequest, issue: mockIssue });
    }, (err) => {
      assert.strictEqual(err, error);
      return true;
    });
  });

  await test('6. Source isolation', async () => {
    const sourcePath = new URL('../src/lib/sceneExecutionAcceptanceRunners.js', import.meta.url);
    const sourceCode = readFileSync(sourcePath, 'utf-8');

    assert.strictEqual(sourceCode.includes('sceneWriter.js'), false, 'Should not mention sceneWriter');
    assert.strictEqual(sourceCode.includes('ProjectStudio'), false, 'Should not mention ProjectStudio');
    assert.strictEqual(sourceCode.includes('fetch('), false, 'Should not directly call fetch');
    assert.strictEqual(sourceCode.includes('callOllama('), false, 'Should not directly call callOllama');
    assert.strictEqual(sourceCode.includes('callAgent('), false, 'Should not directly call callAgent');
  });

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
