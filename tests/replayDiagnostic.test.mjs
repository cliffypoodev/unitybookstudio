import assert from 'node:assert/strict';
import { validateGeneratedSceneReplay } from '../src/lib/sceneBeatNormalizer.js';
import { captureReplayDiagnostic } from '../src/lib/pipelineDiag.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log('--- REPLAY DIAGNOSTIC TESTS ---');

  // 1. Test validateGeneratedSceneReplay structure
  const priorScenes = [{
    scene_id: 's1',
    acceptedProse: 'John discovers the magical sword in the cave.'
  }];
  const sceneProse = 'John discovers the magical shield in the cavern.';
  
  const result = validateGeneratedSceneReplay(sceneProse, priorScenes);
  assert.equal(result.ok, false);
  assert.equal(result.replays.length > 0, true);
  assert.ok(result.detailedMatches);
  assert.equal(result.detailedMatches.length, 1);
  assert.equal(result.detailedMatches[0].priorSceneId, 's1');
  assert.equal(result.detailedMatches[0].matchedFunction, 'revelation');
  assert.equal(result.detailedMatches[0].matchedName, 'john');
  console.log('✓ detailedMatches correctly structured');

  // 2. Test diagnostics disabled outside DEV mode
  const initialNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  if (typeof import.meta !== 'undefined') {
    if (!import.meta.env) import.meta.env = {};
    import.meta.env.DEV = false; // Disable DEV mode
  }
  
  const diagDir = path.join(process.cwd(), 'diagnostics', 'replay');
  if (fs.existsSync(diagDir)) {
    fs.rmSync(diagDir, { recursive: true, force: true });
  }

  captureReplayDiagnostic({ test: 'should_not_write' });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(fs.existsSync(diagDir), false, 'Should not create directory outside DEV mode');
  console.log('✓ diagnostics are disabled outside development mode');

  // Enable DEV mode for remaining tests
  process.env.NODE_ENV = 'development';
  if (typeof import.meta !== 'undefined') {
    import.meta.env.DEV = true;
  }

  // 3. Test capture in DEV mode
  captureReplayDiagnostic({ 
    test: 'should_write',
    matchedFunction: 'revelation'
  });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(fs.existsSync(diagDir), true);
  const files = fs.readdirSync(diagDir);
  assert.equal(files.length > 0, true);
  const content = JSON.parse(fs.readFileSync(path.join(diagDir, files[0]), 'utf8'));
  assert.equal(content.test, 'should_write');
  assert.equal(content.matchedFunction, 'revelation');
  assert.ok(content.runId);
  assert.ok(content.timestamp);
  console.log('✓ diagnostic records contain expected fields');

  // Clean up
  fs.rmSync(diagDir, { recursive: true, force: true });
  process.env.NODE_ENV = initialNodeEnv;

  console.log('ALL DIAGNOSTIC TESTS PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
