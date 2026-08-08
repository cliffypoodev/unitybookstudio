import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MANDATORY_ENFORCEMENT_BLOCK } from '../src/lib/enforcementBlock.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
function check(name, pass) {
  if (pass) {
    console.log(`PASS ${name}`);
  } else {
    console.log(`FAIL ${name}`);
    failures++;
  }
}

function runTest() {
  // 1
  const hasTestament = MANDATORY_ENFORCEMENT_BLOCK.includes(' testament,');
  const hasHarbinger = MANDATORY_ENFORCEMENT_BLOCK.includes(' harbinger,');
  const hasCrescendo = MANDATORY_ENFORCEMENT_BLOCK.includes(' crescendo,');
  check("1. MANDATORY_ENFORCEMENT_BLOCK does NOT contain testament, harbinger, or crescendo", !hasTestament && !hasHarbinger && !hasCrescendo);

  // 2
  const has2b = MANDATORY_ENFORCEMENT_BLOCK.includes('2b. BANNED PHRASES');
  const hasProofOf = MANDATORY_ENFORCEMENT_BLOCK.includes('"proof of"');
  const hasNeverSkip = MANDATORY_ENFORCEMENT_BLOCK.includes('never skip a word');
  check("2. Contains 2b. BANNED PHRASES, 'proof of', 'never skip a word'", has2b && hasProofOf && hasNeverSkip);

  // 3
  const hasTapestry = MANDATORY_ENFORCEMENT_BLOCK.includes('tapestry');
  const hasUtilize = MANDATORY_ENFORCEMENT_BLOCK.includes('utilize');
  check("3. Tier-1 still bans tapestry, utilize", hasTapestry && hasUtilize);

  if (failures === 0) {
    console.log('ACCEPTANCE: ALL CHECKS MATCHED');
  }
  process.exit(failures === 0 ? 0 : 1);
}

runTest();
