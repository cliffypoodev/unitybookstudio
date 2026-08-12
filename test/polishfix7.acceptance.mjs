// POLISHFIX-7 acceptance — SV comma rule -> flag-only; S1 temporal fronting removed
import { readFileSync } from 'fs';
import { join } from 'path';
import { runPunctuationCleanup } from '../src/lib/punctuationPolish.js';
import { runSentenceStarterVariationNF } from '../src/lib/vocabCaps.js';

let pass = 0, failures = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { failures++; console.log('FAIL ' + name); }
}

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf-8');

// ==== runPunctuationCleanup Tests ====
const f1 = { chapter: { chapter_number: 1 }, content: "The council, the parent body of the harbor trust, stood against the motion." };
const { changes: changes1 } = runPunctuationCleanup([f1], () => {});
check('1. Appositive commas survive (council/trust)', f1.content.includes('council,') && f1.content.includes('trust, stood'));

const f2 = { chapter: { chapter_number: 1 }, content: "The auditor, the man appointed to dissect the filings, began his review." };
const { changes: changes2 } = runPunctuationCleanup([f2], () => {});
check('2. Appositive commas survive (auditor/filings)', f2.content.includes('auditor,') && f2.content.includes('filings, began'));

const f3 = { chapter: { chapter_number: 1 }, content: "Here ,, is a typo . And a space , before comma. Plus a double the the issue.,." };
const { changes: changes3 } = runPunctuationCleanup([f3], () => {});
check('3. Legit cleanups still work', !f3.content.includes(',,') && !f3.content.includes(' ,') && !f3.content.includes(',.') && !f3.content.includes('the the'));

check('4. The flag path is audible', changes1.some(c => c.includes('FLAGGED, not auto-fixed')));

const punctCode = read('src/lib/punctuationPolish.js');
check('5. Source assertion: return subject + verb gone, POLISHFIX-7A present', !punctCode.includes("return subject + ' ' + verb;") && punctCode.includes('POLISHFIX-7A'));

// ==== runSentenceStarterVariationNF Tests ====
const s1Sent = "The pier had rotted steadily since its construction in 1901.";
// Build a fixture paragraph of 20+ sentences where >16% start with "The "
let nfContent = "The engine failed. The engine seized again. ";
for (let i = 0; i < 18; i++) {
  nfContent += "The test sentence number " + i + " goes here. ";
}
nfContent += s1Sent;

const fNF = { chapter: { chapter_number: 1 }, content: nfContent };
const { changes: changesNF } = runSentenceStarterVariationNF([fNF], () => {}, { targetPct: 14, triggerPct: 16 });

check('6. Temporal fronting removed (sentence unchanged)', fNF.content.includes(s1Sent) && !fNF.content.includes('In 1901,'));
check('7. The pass still functions (S2/S3 trigger)', changesNF.length > 0);

const vocabCode = read('src/lib/vocabCaps.js');
check('8. Source assertion: S1 regex shape gone, POLISHFIX-7B present', !vocabCode.includes('/^The\\s+(.{8,120}?)\\s+(in|on|by|during|after|before)\\s+/') && vocabCode.includes('POLISHFIX-7B'));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
