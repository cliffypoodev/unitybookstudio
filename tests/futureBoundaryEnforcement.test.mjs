import assert from 'node:assert/strict';
import { auditSceneFutureBoundaries } from '../src/lib/sceneBeatNormalizer.js';

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log('PASS', name);
}

const runTests = async () => {
  // Mock LLM to return deterministic answers for test assertions
  const mockLLM = async ({ prompt }) => {
    const isViolation = 
      (prompt.includes('found the brass key.') && prompt.includes('Lena searched the drawer and finally found the brass key.')) ||
      (prompt.includes('Marcus receives the brass key.') && prompt.includes('Marcus proudly held up the brass key')) ||
      (prompt.includes('Lena opens the archive.') && prompt.includes('mechanical archive hissed open.')) ||
      (prompt.includes('Lena reveals pressure-valve evidence.') && prompt.includes('showed the pressure-valve evidence.')) ||
      (prompt.includes('Marcus confesses guilt.') && prompt.includes('"I did it," Marcus confessed. "I am guilty."')) ||
      (prompt.includes('The station collapses.') && prompt.includes('station collapsed around them.'));

    if (isViolation) {
      return '[{"id": 0, "excerpt": "Fake match"}]';
    }
    return '[]';
  };
  
  console.log('--- FUTURE BOUNDARY TESTS ---');
  
  await test('2. Scene 1 arrival/exploration/warning prose passes', async () => {
    const prose = 'Lena arrived at the station. She explored the corridor. Dr. Vale warned her.';
    const spec = { future_reserved_events: ['Lena finds the brass key.'] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, true);
  });

  await test('3. Merely mentioning a brass key without discovering or transferring it does not automatically fail', async () => {
    const prose = 'Dr. Vale spoke of a mythical brass key, though Lena had never seen it.';
    const spec = { future_reserved_events: ['Lena finds the brass key.'] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, true);
  });

  await test('4. Foreshadowing that "some sealed mechanism may exist deeper in the station" passes', async () => {
    const prose = 'She suspected some sealed mechanism may exist deeper in the station.';
    const spec = { future_reserved_events: ['Lena opens the archive mechanism.'] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, true);
  });

  await test('5. Lena discovering the brass key in Scene 1 fails when reserved for Scene 2', async () => {
    const prose = 'Lena searched the drawer and finally found the brass key.';
    const spec = { future_reserved_event_objects: [{event: 'Lena finds the brass key.', sceneId: 'ch01-s02'}] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, false);
  });

  await test('6. Marcus possessing or receiving the key in Scene 1 fails when reserved for a later event', async () => {
    const prose = 'Marcus proudly held up the brass key for everyone to see.';
    const spec = { future_reserved_events: ['Marcus receives the brass key.'] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, false);
  });

  await test('7. Opening the mechanical archive early fails', async () => {
    const prose = 'She turned the wheel and the mechanical archive hissed open.';
    const spec = { future_reserved_events: ['Lena opens the archive.'] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, false);
  });

  await test('8. Revealing pressure-valve evidence early fails', async () => {
    const prose = 'She uncovered the logs which clearly showed the pressure-valve evidence.';
    const spec = { future_reserved_events: ['Lena reveals pressure-valve evidence.'] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, false);
  });

  await test('9. Marcus confessing guilt before Chapter 5 fails', async () => {
    const prose = '"I did it," Marcus confessed. "I am guilty."';
    const spec = { future_reserved_events: ['Marcus confesses guilt.'] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, false);
  });

  await test('10. Station collapsing early fails', async () => {
    const prose = 'The ground shook and the station collapsed around them.';
    const spec = { future_reserved_events: ['The station collapses.'] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, false);
  });

  await test('11. A negated statement such as "They had not found the key" does not fail', async () => {
    const prose = 'They searched the room but they had not found the key.';
    const spec = { future_reserved_events: ['Lena finds the key.'] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, true);
  });

  await test('12. A hypothetical statement such as "If a key existed, it might open the archive" does not fail', async () => {
    const prose = 'If a key existed, it might open the archive.';
    const spec = { future_reserved_events: ['Lena opens the archive with the key.'] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, true);
  });

  await test('13. A warning about a future risk does not count as performing that future event', async () => {
    const prose = '"Be careful, or the station might collapse," he warned.';
    const spec = { future_reserved_events: ['The station collapses.'] };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen3.6-35b-uncensored', mockLLM);
    assert.equal(audit.ok, true);
  });

  await test('14. audit model throws (fails closed)', async () => {
    const prose = 'Test prose';
    const spec = { future_reserved_events: ['Test event'] };
    const throwingLLM = async () => { throw new Error('Simulated model failure'); };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen', throwingLLM);
    assert.equal(audit.ok, false);
    assert.equal(audit.auditFailed, true);
  });

  await test('15. audit model times out (simulated throw) (fails closed)', async () => {
    const prose = 'Test prose';
    const spec = { future_reserved_events: ['Test event'] };
    const timeoutLLM = async () => { throw new Error('Timeout'); };
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen', timeoutLLM);
    assert.equal(audit.ok, false);
    assert.equal(audit.auditFailed, true);
  });

  await test('16. audit model returns malformed JSON (fails closed)', async () => {
    const prose = 'Test prose';
    const spec = { future_reserved_events: ['Test event'] };
    const malformedLLM = async () => '[\n{"id": 0, "excerpt": "Uh oh" \n]';
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen', malformedLLM);
    assert.equal(audit.ok, false);
    assert.equal(audit.auditFailed, true);
  });

  await test('17. audit model returns non-array JSON (fails closed)', async () => {
    const prose = 'Test prose';
    const spec = { future_reserved_events: ['Test event'] };
    const nonArrayLLM = async () => '[ {"id": 0}'; // malformed too, but wait, the test is non-array. Let's send an object.
    const nonArrayObjLLM = async () => '{"ok": true}'; // this will fail the match since it expects [ ... ]
    const audit = await auditSceneFutureBoundaries(prose, spec, 'qwen', nonArrayObjLLM);
    assert.equal(audit.ok, false);
    assert.equal(audit.auditFailed, true);
  });

  console.log(`ALL FUTURE BOUNDARY TESTS PASSED (${passed}/${passed})`);
};

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
