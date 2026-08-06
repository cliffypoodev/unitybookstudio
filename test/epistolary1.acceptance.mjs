// EPISTOLARY-1 acceptance — letter salutation/sign-off are not "unterminated" prose.
import assert from 'node:assert';
import { checkStructuralIntegrity } from '../src/lib/pipelineValidator.js';
let failures = 0;
const ok = (name, cond) => { assert.ok(cond, 'FAIL  ' + name); if (cond) { console.log('PASS  ' + name); } else { failures++; console.log('FAIL  ' + name); } };

ok('salutation exempted',
  checkStructuralIntegrity('The room was cold.\n\nMy dearest Elise,\n\nShe folded the page.').unterminatedParagraphs.count === 0);
ok('sign-off (valediction + name) exempted',
  checkStructuralIntegrity('He read the last line.\n\nYours, always,\nWexcombe\n\nThe candle guttered.').unterminatedParagraphs.count === 0);
ok('titled salutation exempted',
  checkStructuralIntegrity('A knock at the door.\n\nDear Mr. Bram,\n\nShe sealed it.').unterminatedParagraphs.count === 0);
ok('genuine truncation STILL flagged',
  checkStructuralIntegrity('She turned the key and\n\nThe lock held.').unterminatedParagraphs.count === 1);
ok('normal terminal prose passes',
  checkStructuralIntegrity('Dear reader, we were all fools that winter.').unterminatedParagraphs.count === 0);

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
