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
check('4b. "an of the" DOES strip', res4b.removed.length === 1);

const res4c = stripDroppedWordSentences("It was less a to its quality.");
check('4c. "a to its" DOES strip', res4c.removed.length === 1);

const res4d = stripDroppedWordSentences("We took a trip to the market.");
check('4d. "a trip to the" does NOT strip', res4d.removed.length === 0);

// 5. Source assertions
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const sceneWriterSrc = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
const polishRunnerSrc = fs.readFileSync(path.join(ROOT, 'src/lib/manuscriptPolishRunner.js'), 'utf8');

const swClean = sceneWriterSrc.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
check('5. sceneWriter calls stripDroppedWordSentences in backstop', swClean.includes('const dw = stripDroppedWordSentences('));
check('5. sceneWriter imports from nfContentGuard', swClean.includes("stripDroppedWordSentences") && swClean.includes("'./nfContentGuard.js'"));

const prClean = polishRunnerSrc.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
const callIndex = prClean.indexOf('const dw = stripDroppedWordSentences');
const snapshotIndex = prClean.indexOf('const nfGuardSnapshots');
check('5. polishRunner calls BEFORE nfGuardSnapshots', callIndex !== -1 && snapshotIndex !== -1 && callIndex < snapshotIndex);
check('5. polishRunner imports from nfContentGuard', prClean.includes("stripDroppedWordSentences") && prClean.includes("'./nfContentGuard.js'"));

// POLISHFIX-10 Tests
const pfx10Index = prClean.indexOf('[POLISHFIX-10]');
const emphStripIndex = prClean.indexOf("afterEmph = beforeEmph.replace");
check('6. runner contains [POLISHFIX-10]', pfx10Index !== -1);
check('6. emphasis strip appears BEFORE stripDroppedWordSentences', emphStripIndex !== -1 && callIndex !== -1 && emphStripIndex < callIndex);

const stripRe10 = /([.!?…”])[ \t]*[*_]+[ \t]*(?=\n|$)/g;
const strip10 = (s) => s.replace(stripRe10, '$1');
check('7. trailing strip: "It broke. *\\n"', strip10("It broke. *\n") === "It broke.\n");
check('7. trailing strip: end of string', strip10("It broke. *") === "It broke.");
check('7. trailing strip: mid-sentence untouched', strip10("It was rated 5* on the form.") === "It was rated 5* on the form.");
check('7. trailing strip: own line untouched', strip10("* * *") === "* * *");

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
