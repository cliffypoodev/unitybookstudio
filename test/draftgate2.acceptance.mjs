import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stripDroppedWordSentences, DROPPED_WORD_RX } from '../src/lib/nfContentGuard.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

// 1. Paragraph
const p1 = "The dock held firm. The survey was a to the quality of the piles. Workers cheered.";
const res1 = stripDroppedWordSentences(p1);
check('1. middle sentence removed, first and last intact', res1.text.trim() === "The dock held firm. Workers cheered.");
check('1. removed length 1', res1.removed.length === 1);

// 2. Multi-paragraph text
const p2 = "Para one is clean.\n\nPara two is a to the mess. It continues here.\n\nPara three is clean.";
const res2 = stripDroppedWordSentences(p2);
const expectedP2 = "Para one is clean.\n\nIt continues here.\n\nPara three is clean.";
check('2. paragraph breaks preserved, holed sentences leave', res2.text === expectedP2);

// 3. Clean text
const p3 = "This is a completely clean text. It has no dropped words.";
const res3 = stripDroppedWordSentences(p3);
check('3. returned text IDENTICAL', res3.text === p3);
check('3. removed empty', res3.removed.length === 0);

// 4. Hyphenated vs "an of the"
const res4a = stripDroppedWordSentences("This is a to-the-point reply.");
check('4. hyphenated does NOT strip', res4a.removed.length === 0 && res4a.text === "This is a to-the-point reply.");

const res4b = stripDroppedWordSentences("It was an of the biggest problems.");
check('4. "an of the" DOES strip', res4b.removed.length === 1);

// 5. Source assertions
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const sceneWriterSrc = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
const polishRunnerSrc = fs.readFileSync(path.join(ROOT, 'src/lib/manuscriptPolishRunner.js'), 'utf8');

const swClean = sceneWriterSrc.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
check('5. sceneWriter calls stripDroppedWordSentences in backstop', swClean.includes('const dw = stripDroppedWordSentences('));
check('5. sceneWriter imports from nfContentGuard', swClean.includes("import { stripDroppedWordSentences } from './nfContentGuard.js'"));

const prClean = polishRunnerSrc.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
const callIndex = prClean.indexOf('stripDroppedWordSentences');
const snapshotIndex = prClean.indexOf('const nfGuardSnapshots');
check('5. polishRunner calls BEFORE nfGuardSnapshots', callIndex !== -1 && snapshotIndex !== -1 && callIndex < snapshotIndex);
check('5. polishRunner imports from nfContentGuard', prClean.includes("import { nfContentEquivalent, stripDroppedWordSentences } from './nfContentGuard.js'"));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
