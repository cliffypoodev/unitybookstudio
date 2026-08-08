import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stripCrossChapterDuplicates } from '../src/lib/nfContentGuard.js';

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
  const s14 = "This is a fourteen word sentence that must be perfectly duplicated to trigger the rule.";
  const ch1_1 = `This is chapter one. ${s14} End of chapter one.`;
  const ch2_1 = `This is chapter two. ${s14} End of chapter two.`;
  const res1 = stripCrossChapterDuplicates([ch1_1, ch2_1]);
  check('1. 14-word shared sentence: removed from ch2', !res1.texts[1].includes(s14) && res1.removedPerChapter[1].length === 1);
  check('1. 14-word shared sentence: intact in ch1', res1.texts[0] === ch1_1 && res1.removedPerChapter[0].length === 0);

  // 2
  const s11 = "This is an eleven word sentence that is almost long enough.";
  const ch1_2 = `This is chapter one. ${s11} End of chapter one.`;
  const ch2_2 = `This is chapter two. ${s11} End of chapter two.`;
  const res2 = stripCrossChapterDuplicates([ch1_2, ch2_2]);
  check('2. 11-word shared sentence: untouched in both', res2.texts[0] === ch1_2 && res2.texts[1] === ch2_2);

  // 3
  const ch1_3 = `This is chapter one. ${s14} And then it happens again. ${s14} End of chapter one.`;
  const res3 = stripCrossChapterDuplicates([ch1_3]);
  check('3. 14-word sentence twice in one chapter: untouched', res3.texts[0] === ch1_3 && res3.removedPerChapter[0].length === 0);

  // 4
  const s14_double = "This is a fourteen word sentence that must be   perfectly duplicated to trigger the rule.";
  const ch1_4 = `Chapter one. ${s14} End.`;
  const ch2_4 = `Chapter two. ${s14_double} End.`;
  const res4 = stripCrossChapterDuplicates([ch1_4, ch2_4]);
  check('4. Whitespace variants match', !res4.texts[1].includes("duplicated to trigger") && res4.removedPerChapter[1].length === 1);

  // 5
  const esSrc = fs.readFileSync(path.join(ROOT, 'src/lib/exportSafetyGate.js'), 'utf8');
  const mprSrc = fs.readFileSync(path.join(ROOT, 'src/lib/manuscriptPolishRunner.js'), 'utf8');
  
  const bg3Index = esSrc.indexOf('[BOOKGATE-3] BLOCKED');
  const bg2Index = esSrc.indexOf('BOOKGATE-2: cross-chapter integrity');
  check('5. exportSafetyGate has BOOKGATE-3 before BOOKGATE-2', bg3Index !== -1 && bg2Index !== -1 && bg3Index < bg2Index);
  
  check('6. manuscriptPolishRunner contains [BOOKGATE-3]', mprSrc.includes('[BOOKGATE-3]'));

  if (failures === 0) {
    console.log('ACCEPTANCE: ALL CHECKS MATCHED');
  }
  process.exit(failures === 0 ? 0 : 1);
}

runTest();
