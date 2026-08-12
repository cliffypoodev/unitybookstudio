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

  // 4a
  const swSrc = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
  const atLeastMatches = swSrc.match(/AT LEAST \$\{targetWords\}/g) || [];
  check("4a. sceneWriter.js contains AT LEAST ${targetWords} at least 4 times", atLeastMatches.length >= 4);

  // 4b
  const approxRx = /approximately \$\{targetWords\} words/g;
  const approxMatches = [...swSrc.matchAll(approxRx)];
  const hasExactApprox = approxMatches.length === 2;

  let hasFictionContext = false;
  let hasRepairContext = false;
  
  if (hasExactApprox) {
    const idx1 = approxMatches[0].index;
    const idx2 = approxMatches[1].index;
    const ctx1 = swSrc.substring(Math.max(0, idx1 - 400), idx1 + 400);
    const ctx2 = swSrc.substring(Math.max(0, idx2 - 400), idx2 + 400);
    
    // Check which context has which strings
    if (ctx1.includes('finished fictional prose')) hasFictionContext = true;
    if (ctx2.includes('finished fictional prose')) hasFictionContext = true;
    if (ctx1.includes('Do NOT expand, pad')) hasRepairContext = true;
    if (ctx2.includes('Do NOT expand, pad')) hasRepairContext = true;
  }

  check("4b. sceneWriter.js contains EXACTLY 2 remaining occurrences of 'approximately ${targetWords} words', in fiction and repair contexts", hasExactApprox && hasFictionContext && hasRepairContext);

  if (failures === 0) {
    console.log('ACCEPTANCE: ALL CHECKS MATCHED');
  }
  process.exit(failures === 0 ? 0 : 1);
}

runTest();
