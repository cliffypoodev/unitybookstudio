import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

function runTests() {
  console.log('--- SCENE EXECUTION ACCEPTANCE LIVE WIRING TESTS ---');

  const studioPath = new URL('../src/pages/ProjectStudio.jsx', import.meta.url);
  const studioCode = readFileSync(studioPath, 'utf-8');

  // ORCH-1 moved draftChapter's body — including both generateChapterByScenes
  // call sites (primary and retry) — out of ProjectStudio.jsx into
  // src/lib/chapterOrchestrator.js's runChapterDraft.
  const orchPath = new URL('../src/lib/chapterOrchestrator.js', import.meta.url);
  const orchCode = readFileSync(orchPath, 'utf-8');

  const runnersPath = new URL('../src/lib/sceneExecutionAcceptanceRunners.js', import.meta.url);
  const runnersCode = readFileSync(runnersPath, 'utf-8');

  test('1. chapterOrchestrator.js imports createSceneExecutionAcceptanceRunners from the dedicated module', () => {
    // ORCH-1 moved draftChapter's body (and this import) out of ProjectStudio.jsx
    // into src/lib/chapterOrchestrator.js, which uses a relative import since it
    // has no @/ aliases of its own.
    assert.ok(
      /import\s+\{\s*createSceneExecutionAcceptanceRunners\s*\}\s+from\s+['"]\.\/sceneExecutionAcceptanceRunners\.js['"];/.test(orchCode),
      'Missing or incorrect import in chapterOrchestrator.js'
    );
  });

  test('2 & 3. Factory is constructed once in chapter-drafting scope and receives project: draftingProject', () => {
    const factoryCallRegex = /const\s+sceneExecutionAcceptanceRunners\s*=\s*createSceneExecutionAcceptanceRunners\s*\(\s*\{\s*project:\s*draftingProject,?\s*\}\s*\)/g;
    const matches = orchCode.match(factoryCallRegex);
    assert.ok(matches, 'Could not find the factory call with { project: draftingProject }');
    assert.strictEqual(matches.length, 1, 'Factory should be constructed exactly once per chapter-drafting attempt');
  });

  test('4. Both generateChapterByScenes() call blocks pass sceneExecutionAcceptanceRunners', () => {
    const genCallBlockRegex = /await\s+generateChapterByScenes\s*\(\s*\{([^}]+)\}/g;
    let match;
    let passCount = 0;
    while ((match = genCallBlockRegex.exec(orchCode)) !== null) {
      const block = match[1];
      if (block.includes('sceneExecutionAcceptanceRunners')) {
        passCount++;
      }
    }
    assert.strictEqual(passCount, 2, 'Should pass sceneExecutionAcceptanceRunners to exactly 2 generateChapterByScenes calls (primary and retry)');
  });

  test('5. ProjectStudio.jsx does not contain scene_execution_acceptance_gate_v1', () => {
    assert.strictEqual(
      studioCode.includes('scene_execution_acceptance_gate_v1'),
      false,
      'ProjectStudio.jsx must not contain scene_execution_acceptance_gate_v1'
    );
  });

  test('6. Does not add sceneExecutionShadow argument', () => {
    assert.strictEqual(
      studioCode.includes('sceneExecutionShadow'),
      false,
      'ProjectStudio.jsx must not contain sceneExecutionShadow, which enforces the default-off state'
    );
  });

  test('7. Runner factory source contains zero direct model/network calls', () => {
    assert.strictEqual(runnersCode.includes('fetch('), false, 'Should not contain fetch()');
    assert.strictEqual(runnersCode.includes('callLlama('), false, 'Should not contain callLlama()');
    assert.strictEqual(runnersCode.includes('callAgent('), false, 'Should not contain callAgent()');
  });

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
