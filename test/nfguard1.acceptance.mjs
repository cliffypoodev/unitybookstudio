import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nfPolishNormalize, nfContentEquivalent } from '../src/lib/nfContentGuard.js';

let failures = 0;
const check = (label, ok) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label);
  if (!ok) failures += 1;
};

// Equivalence must HOLD
check('1. Identical texts', nfContentEquivalent('Same text.', 'Same text.'));
check('2. Straight->curly quote conversion', nfContentEquivalent('He said "hello".', 'He said “hello”.'));
check('2b. Single quotes', nfContentEquivalent("It's true.", "It’s true."));
check('3. Punctuation collapse (,, to ,)', nfContentEquivalent('Hello,, world.', 'Hello, world.'));
check('3. Punctuation collapse ( , to ,)', nfContentEquivalent('Hello , world.', 'Hello, world.'));
check('3. Whitespace-only changes', nfContentEquivalent('Hello   world', 'Hello world'));

// Equivalence must FAIL
check('4. Deleted appositive comma', !nfContentEquivalent(
  'The firm, the parent of the yard, stood fast.',
  'The firm, the parent of the yard stood fast.'
));
check('5. Word swap', !nfContentEquivalent(
  'The inquiry was no longer just a formality, but a reckoning.',
  'The inquiry changed just a formality, but a reckoning.'
));
check('6. Phrase deletion', !nfContentEquivalent(
  'the weight of evidence began to shift',
  'evidence began to shift'
));

// Source assertions
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

const runnerSrc = fs.readFileSync(path.join(ROOT, 'src/lib/manuscriptPolishRunner.js'), 'utf8');
const guardSrc = fs.readFileSync(path.join(ROOT, 'src/lib/nfContentGuard.js'), 'utf8');

check('7. runner contains nfGuardSnapshots', runnerSrc.includes('nfGuardSnapshots'));
check('7. runner contains [NFGUARD-1]', runnerSrc.includes('[NFGUARD-1]'));

const guardIndex = runnerSrc.indexOf('[NFGUARD-1]');
const phaseHIndex = runnerSrc.indexOf('PHASE H: Typography normalization');
check('7. guard block appears BEFORE PHASE H', guardIndex !== -1 && phaseHIndex !== -1 && guardIndex < phaseHIndex);

const cleanGuardSrc = guardSrc.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
check('8. nfContentGuard.js has no import statements', !/import\s/.test(cleanGuardSrc));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
