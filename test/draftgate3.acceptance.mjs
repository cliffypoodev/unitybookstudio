import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// 1. Load nfContentGuard and extract fixIndefiniteArticles
const nfSrc = fs.readFileSync(path.join(ROOT, 'src/lib/nfContentGuard.js'), 'utf8');
const match = nfSrc.match(/(?:const A[N]?_BEFORE.*?\n)*export function fixIndefiniteArticles[\s\S]*?\n\}/);
if (!match) {
  console.error("Could not find fixIndefiniteArticles in nfContentGuard.js");
  process.exit(1);
}
const fixIndefiniteArticlesCode = match[0].replace('export ', '');
import vm from 'vm';
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fixIndefiniteArticlesCode + '; this.fixIndefiniteArticles = fixIndefiniteArticles;', sandbox);
const fixIndefiniteArticles = sandbox.fixIndefiniteArticles;

// DRAFTGATE-3C Tests
check('3C: "a effort" -> "an effort"', fixIndefiniteArticles("a effort").text === "an effort");
check('3C: "a enduring" -> "an enduring"', fixIndefiniteArticles("a enduring").text === "an enduring");
check('3C: "an tank" -> "a tank"', fixIndefiniteArticles("an tank").text === "a tank");
check('3C: "a university" UNCHANGED', fixIndefiniteArticles("a university").text === "a university");
check('3C: "an hour" UNCHANGED', fixIndefiniteArticles("an hour").text === "an hour");
check('3C: "a one-time" UNCHANGED', fixIndefiniteArticles("a one-time").text === "a one-time");
check('3C: "a European" UNCHANGED', fixIndefiniteArticles("a European").text === "a European");
check('3C: "A effort" -> "An effort"', fixIndefiniteArticles("A effort").text === "An effort");

// DRAFTGATE-3D logic in sceneWriter.js
const swSrc = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
const swMatch = swSrc.match(/export function splitSentencesSafe[\s\S]*?\n\}/);
if (!swMatch) {
  console.error("Could not find splitSentencesSafe in sceneWriter.js");
  process.exit(1);
}
const splitSentencesSafeCode = swMatch[0].replace('export ', '');
vm.runInContext(splitSentencesSafeCode + '; this.splitSentencesSafe = splitSentencesSafe;', sandbox);
const splitSentencesSafe = sandbox.splitSentencesSafe;

function simulateDraftgate3D(prose) {
  const paras = prose.split(/\n{2,}/);
  let rebroke = 0;
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    const words = p.split(/\s+/).filter(Boolean).length;
    if (words > 250) {
      const sents = splitSentencesSafe(p);
      if (sents.length > 1) {
        const newParas = [];
        let curr = [];
        let currWords = 0;
        for (const s of sents) {
          const w = s.split(/\s+/).filter(Boolean).length;
          curr.push(s);
          currWords += w;
          if (currWords >= 120) {
            newParas.push(curr.join(' '));
            curr = [];
            currWords = 0;
          }
        }
        if (curr.length > 0) {
          if (newParas.length > 0) {
            newParas[newParas.length - 1] += ' ' + curr.join(' ');
          } else {
            newParas.push(curr.join(' '));
          }
        }
        paras[i] = newParas.join('\n\n');
        rebroke++;
      }
    }
  }
  return { prose: paras.join('\n\n'), rebroke };
}

// Generate fixtures
const p200 = "Sentence one. ".repeat(100); // 200 words
const p300 = "Sentence one. ".repeat(150); // 300 words

const res200 = simulateDraftgate3D(p200);
check('3D: 200-word paragraph untouched', res200.rebroke === 0 && res200.prose.split('\n\n').length === 1);

const res300 = simulateDraftgate3D(p300);
check('3D: 300-word paragraph rebroken (>= 2 paras)', res300.rebroke === 1 && res300.prose.split('\n\n').length >= 2);
check('3D: rebroken text identical after whitespace normalization', res300.prose.replace(/\s+/g, ' ') === p300.replace(/\s+/g, ' '));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
