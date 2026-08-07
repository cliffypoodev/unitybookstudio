import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSentencesSafe } from '../src/lib/sceneWriter.js';

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

function runLosslessCheck(name, input, extraChecks = (p) => true) {
  const originalError = console.error;
  let errored = false;
  console.error = (...args) => {
    if (args.join(' ').includes('[DRAFTGATE-3A]')) errored = true;
    originalError(...args);
  };
  
  const parts = splitSentencesSafe(input);
  const lossless = parts.join('') === input;
  
  console.error = originalError;
  
  check(name, lossless && !errored && extraChecks(parts));
}

function run() {
  // 1
  const c1 = "He watched the harbor. The tank gleamed dull brown in the sun and nothing looked wrong.**\n\nThe next day the weather turned.";
  runLosslessCheck('1. Emphasis after period (the live breaker)', c1, p => p.length >= 3);

  // 2
  const c2 = "The waterfront went quiet.*\n\nMen returned to work.";
  runLosslessCheck('2. Single star at paragraph end', c2);

  // 3
  const c3 = "The report cited testimony.Another witness disagreed with it.";
  runLosslessCheck('3. Mid-word period', c3);

  // 4
  const c4 = "It ended.—or seemed to end. More followed.";
  runLosslessCheck('4. Em-dash after period', c4);

  // 5
  const c5 = "He said.“Go now.” Then he left.";
  runLosslessCheck('5. Open-quote after period', c5);

  // 6
  const c6 = "It held 2.3 million gallons of molasses. It stood there.";
  runLosslessCheck('6. Decimal protection still works', c6, p => p.length === 2 && p[0].includes("2.3 million"));

  // 7
  const c7 = "First sentence. And a tail without ending";
  runLosslessCheck('7. Terminatorless tail', c7, p => p.length === 2 && p[1] === "And a tail without ending");

  // 8
  const c8 = "First here. Second there. Third one ends.";
  runLosslessCheck('8. Clean prose regression', c8, p => p.length === 3 && p.every(s => !s.includes('\u0001')));

  // 9. 3D integration
  const baseSentence = "This is a generic repeating sentence that adds words to the paragraph length."; // 13 words
  const sentences = [];
  for (let i = 0; i < 10; i++) sentences.push(baseSentence);
  sentences.push("The tank gleamed and nothing looked wrong.**"); // 7 words
  for (let i = 0; i < 10; i++) sentences.push(baseSentence);
  const c9 = sentences.join(" ");
  
  // Apply 3D logic
  const sents = splitSentencesSafe(c9);
  const targetSentences = Math.max(1, Math.floor((120 / 250) * sents.length));
  const newParas = [];
  for (let i = 0; i < sents.length; i += targetSentences) {
    newParas.push(sents.slice(i, i + targetSentences).join(''));
  }
  
  const originalNorm = c9.replace(/\s+/g, ' ').trim();
  const newNorm = newParas.join(' ').replace(/\s+/g, ' ').trim();
  check('9. 3D integration mega-paragraph re-break', newParas.length >= 2 && originalNorm === newNorm);

  // 10. Source assertions
  const sw = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
  check('10. Source assertions (DRAFTGATE-3E present, old regex gone)', sw.includes('DRAFTGATE-3E') && !sw.includes('|[^.!?]+$/g'));

  console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
  process.exit(failures === 0 ? 0 : 1);
}

run();
