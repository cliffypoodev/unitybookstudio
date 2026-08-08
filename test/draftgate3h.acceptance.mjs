import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeProse } from '../src/lib/proseGrammarGate.js';
import { MANGLE_RX, CITATION_STUMP_RX, stripMangledSentences } from '../src/lib/nfContentGuard.js';

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

async function runTest() {
  // 1
  const c1 = "The record served as a grim to the proximity of homes.";
  check('1. "a grim to": MANGLE_RX matches', MANGLE_RX.test(c1));
  const t1 = await analyzeProse(c1);
  check('1. "a grim to": PROSEGATE hard (dropped-noun)', t1.hard.length > 0 && t1.hard.some(m => m.rule.includes('dropped-noun')));

  // 2
  const c2 = "The bodies were remained embedded in the sludge.";
  check('2. "were remained": MANGLE_RX matches', MANGLE_RX.test(c2));
  const res2 = stripMangledSentences(c2);
  check('2. "were remained": stripped by stripMangledSentences', res2.removed.length === 1 && res2.text.trim() === "");

  // 3
  const c3 = "The case of Dorr v. The next sentence stands.";
  const res3 = stripMangledSentences(c3);
  check('3. "Dorr v.": CITATION_STUMP_RX strips stump, following sentence survives', res3.removed.length === 1 && res3.text.trim() === "The next sentence stands.");

  // 4
  const c4 = "The case of Dorr, trustee, v. United States Industrial Alcohol Company set precedent.";
  check('4. "v." mid-sentence: NOT stripped', !CITATION_STUMP_RX.test(c4));

  // 5
  const c5 = "A grim reminder of the day remained with them.";
  check('5. "grim reminder ... remained": ZERO matches', !MANGLE_RX.test(c5) && !CITATION_STUMP_RX.test(c5));

  // 6
  const c6 = "The stain was permanent on the record.";
  check('6. "was permanent": ZERO matches', !MANGLE_RX.test(c6) && !CITATION_STUMP_RX.test(c6));

  // 7
  const c7 = "It was a silent to this corporate calculus.";
  check('7. "a silent to": MANGLE_RX matches', MANGLE_RX.test(c7));

  // 8
  const swSrc = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
  const mprSrc = fs.readFileSync(path.join(ROOT, 'src/lib/manuscriptPolishRunner.js'), 'utf8');
  const msgSrc = fs.readFileSync(path.join(ROOT, 'src/lib/manuscriptSafetyGate.js'), 'utf8');
  
  check('8. sceneWriter contains [DRAFTGATE-3H]', swSrc.includes('[DRAFTGATE-3H]'));
  check('8. manuscriptPolishRunner contains [DRAFTGATE-3H]', mprSrc.includes('[DRAFTGATE-3H]'));
  check('8. manuscriptSafetyGate contains aux-verb mashup', msgSrc.includes('aux-verb mashup: was/were + intransitive past'));

  if (failures === 0) {
    console.log('ACCEPTANCE: ALL CHECKS MATCHED');
  }
  process.exit(failures === 0 ? 0 : 1);
}

runTest();
