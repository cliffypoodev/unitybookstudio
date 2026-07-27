import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { runFinalHardSurvivorRepairs, postDraftCleanup } from '../src/lib/postDraftCleanup.js';
import { runManuscriptPolishPipeline } from '../src/lib/manuscriptPolishRunner.js';

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

async function runTests() {
  console.log('--- POST-DRAFT SURVIVOR INTEGRATION TESTS ---');

  // 1. Prove the public repair fixes representative existing patterns
  await test('1. Fixes representative malformed patterns', () => {
    const inputs = [
      'He moved back in took a breath.',
      'The door swung shut cutting off the light.',
      'His pause hitched before he spoke.',
      'She capped it set it aside.'
    ];
    
    const results = inputs.map(t => runFinalHardSurvivorRepairs(t).text);
    
    assert.strictEqual(results[0], 'He moved back in and took a breath.');
    assert.strictEqual(results[1], 'The door swung shut, cutting off the light.');
    assert.strictEqual(results[2], 'His breath hitched before he spoke.');
    assert.strictEqual(results[3], 'She capped it and set it aside.');
  });

  // 2. Leaves legitimate prose unchanged
  await test('2. Leaves legitimate prose unchanged', () => {
    const legit = [
      'Was he ready?',
      'Was this what she wanted?',
      'He paused before answering.',
      'His pause lengthened while he considered the question.'
    ];
    
    for (const text of legit) {
      assert.strictEqual(runFinalHardSurvivorRepairs(text).text, text);
    }
  });

  // 3. Idempotent
  await test('3. Idempotent', () => {
    const input = 'She capped it set it aside. The door swung shut cutting off the light.';
    const pass1 = runFinalHardSurvivorRepairs(input).text;
    const pass2 = runFinalHardSurvivorRepairs(pass1).text;
    assert.strictEqual(pass1, pass2);
    assert.strictEqual(pass1, 'She capped it and set it aside. The door swung shut, cutting off the light.');
  });

  // 4. Paragraph count unchanged
  await test('4. Paragraph count unchanged', () => {
    const input = 'She capped it set it aside.\n\nThe door swung shut cutting off the light.';
    const result = runFinalHardSurvivorRepairs(input);
    const inParas = input.split('\n\n').length;
    const outParas = result.text.split('\n\n').length;
    assert.strictEqual(inParas, outParas);
  });

  // 5. postDraftCleanup still executes existing behavior
  await test('5. postDraftCleanup executes hard survivor behavior', async () => {
    // Need to pass a mocked project, chapter, report
    const input = 'This is some padding text so the length is at least one hundred characters. It needs to be long enough. He moved back in took a breath.';
    const result = await postDraftCleanup(input, {}, '1', () => {});
    assert.strictEqual(result.text, 'This is some padding text so the length is at least one hundred characters. It needs to be long enough. He moved back in and took a breath.');
  });

  // Setup mock chapters for pipeline tests
  const makeLoaded = (content, chapterId = 'ch1', chNum = 1) => [{
    chapter: { id: chapterId, chapter_number: chNum, title: `Chapter ${chNum}` },
    content,
    original: content
  }];

  // 6. Pipeline executes the new stage (fiction)
  await test('6. runManuscriptPolishPipeline executes stage for fiction', async () => {
    const loaded = makeLoaded('She capped it set it aside.');
    const result = await runManuscriptPolishPipeline({
      loaded,
      project: { genre: 'thriller' },
      mode: 'fiction',
      allowLLM: false
    });
    
    assert.strictEqual(loaded[0].content, 'She capped it and set it aside.');
    assert.ok(result.changes.some(c => c.includes('Hard survivor repair')));
  });

  // 7. Anthology executes stage via fiction path
  await test('7. Anthology projects receive stage', async () => {
    const loaded = makeLoaded('The door swung shut cutting off the light.');
    const result = await runManuscriptPolishPipeline({
      loaded,
      project: { genre: 'anthology' },
      mode: 'fiction',
      allowLLM: false
    });
    
    assert.strictEqual(loaded[0].content, 'The door swung shut, cutting off the light.');
    assert.ok(result.changes.some(c => c.includes('Hard survivor repair')));
  });

  // 8. Nonfiction skips the stage
  await test('8. Nonfiction skips the stage', async () => {
    const loaded = makeLoaded('She capped it set it aside.');
    await runManuscriptPolishPipeline({
      loaded,
      project: { genre: 'biography' },
      mode: 'nonfiction',
      allowLLM: false
    });
    
    assert.strictEqual(loaded[0].content, 'She capped it set it aside.');
  });

  // 9. Throwing repair restores exact original chapter, continues processing
  await test('9. Throwing repair restores original, continues pipeline', async () => {
    const loaded = [
      { chapter: { id: 'ch1', chapter_number: 1 }, content: 'She capped it set it aside.', original: 'She capped it set it aside.' },
      { chapter: { id: 'ch2', chapter_number: 2 }, content: 'He moved back in took a breath.', original: 'He moved back in took a breath.' }
    ];
    
    // Inject a throw only for chapter 1
    const injectThrow = (text) => {
      if (text.includes('capped')) {
        throw new Error('Simulated failure');
      }
      return runFinalHardSurvivorRepairs(text);
    };

    const result = await runManuscriptPolishPipeline({
      loaded,
      project: { genre: 'thriller' },
      mode: 'fiction',
      allowLLM: false,
      _testInjectSurvivorRepair: injectThrow
    });
    
    // Ch 1 should be restored
    assert.strictEqual(loaded[0].content, 'She capped it set it aside.');
    // Ch 2 should be processed
    assert.strictEqual(loaded[1].content, 'He moved back in and took a breath.');
    
    assert.ok(result.changes.some(c => c.includes('Hard survivor repair skipped/error: Simulated failure')));
  });

  // 10. Runner does not import forbidden methods
  await test('10. Runner does not import forbidden methods', () => {
    const runnerPath = new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url);
    const runnerCode = readFileSync(runnerPath, 'utf-8');
    
    assert.ok(!runnerCode.includes('runTargetedMalformedSentenceRepair'), 'Should not import runTargetedMalformedSentenceRepair');
    assert.ok(!runnerCode.includes('runSurgicalArtifactRepair'), 'Should not import runSurgicalArtifactRepair');
    // Ensure we only imported runFinalHardSurvivorRepairs, not the entire postDraftCleanup as default
    assert.ok(!runnerCode.includes('import postDraftCleanup'), 'Should not import postDraftCleanup wholesale');
    assert.ok(!runnerCode.includes('fixEntireManuscript'), 'Should not call fixEntireManuscript');
  });

  // 11. Zero model/network calls in survivor logic
  await test('11. Zero model/network calls in survivor repair', () => {
    const pdPath = new URL('../src/lib/postDraftCleanup.js', import.meta.url);
    const pdCode = readFileSync(pdPath, 'utf-8');
    const funcMatch = pdCode.match(/export function runFinalHardSurvivorRepairs[\s\S]*?return result;\n\}/);
    assert.ok(funcMatch, 'Could not extract function code for static check');
    const code = funcMatch[0];
    
    assert.ok(!code.includes('fetch('));
    assert.ok(!code.includes('callOllama('));
    assert.ok(!code.includes('callAgent('));
  });

  // 12. ProjectStudio untouched - verified by git status during shell verification

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
