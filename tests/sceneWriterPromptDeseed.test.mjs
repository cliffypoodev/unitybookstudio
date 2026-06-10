/**
 * sceneWriterPromptDeseed.test.mjs
 * Verifies that forensic phrase seeding has been removed from sceneWriter.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const src = readFileSync(resolve(__dirname, '../src/lib/sceneWriter.js'), 'utf-8');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed++;
    console.log(`✅ ${name}`);
  } else {
    failed++;
    console.error(`❌ ${name}`);
  }
}

// 1. sceneWriter.js does NOT contain the old seeded evidence verb preference
assert(
  !src.includes('Prefer "the available accounts indicate'),
  'Does NOT contain old seeded evidence verb preference (straight quotes)'
);
assert(
  !src.includes('Prefer \u201cthe available accounts indicate'),
  'Does NOT contain old seeded evidence verb preference (smart quotes)'
);

// 2. sceneWriter.js does NOT contain "What remains unclear is" as a preferred example
assert(
  !src.includes('What remains unclear is...'),
  'Does NOT contain "What remains unclear is..." as a preferred voice example'
);

// 3. sceneWriter.js DOES contain 'BANNED phrases'
assert(
  src.includes('BANNED phrases'),
  'Contains BANNED phrases directive'
);

// 4. sceneWriter.js has includeFullCraft = true
assert(
  src.includes('includeFullCraft = true'),
  'Has includeFullCraft = true'
);

// 5. sceneWriter.js still contains 'Forbidden voice' (prohibitions kept)
assert(
  src.includes('Forbidden voice'),
  'Still contains Forbidden voice prohibitions'
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
