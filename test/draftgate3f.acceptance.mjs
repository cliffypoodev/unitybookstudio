import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

const swSrc = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
const swMatch = swSrc.match(/export function splitSentencesSafe[\s\S]*?\n\}/);
if (!swMatch) {
  console.error("Could not find splitSentencesSafe in sceneWriter.js");
  process.exit(1);
}
const splitSentencesSafeCode = swMatch[0].replace('export ', '');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(splitSentencesSafeCode + '; this.splitSentencesSafe = splitSentencesSafe;', sandbox);
const splitSentencesSafe = sandbox.splitSentencesSafe;

let failures = 0;
function check(name, pass) {
  if (pass) {
    console.log(`PASS ${name}`);
  } else {
    console.log(`FAIL ${name}`);
    failures++;
  }
}

let errorTriggered = false;
const originalError = console.error;
console.error = (...args) => {
  if (args.join(' ').includes('[DRAFTGATE-3A]')) {
    errorTriggered = true;
  }
  originalError(...args);
};

function runTest() {
  // 1
  const c1 = "The company cited unrest. A bomb had exploded in the basement of the J.P. Morgan building on Wall Street. The narrative spread.";
  const p1 = splitSentencesSafe(c1);
  check('1. Multi-initials: exactly 3 parts', p1.length === 3);
  check('1. Multi-initials: part contains "J.P. Morgan building"', p1.some(p => p.includes('J.P. Morgan building')));
  check('1. Multi-initials: lossless', p1.join('') === c1);

  // 2
  const filteredParts = p1.filter(p => !(/Morgan|Wall Street/.test(p)));
  check('2. Strip-granularity: surviving parts include correct text', filteredParts.some(p => p.includes('The company cited unrest.')));
  check('2. Strip-granularity: no stump survives', !filteredParts.some(p => /\bthe J\.\s*$/.test(p)));

  // 3
  const c3 = "The case of Dorr, trustee, v. United States Industrial Alcohol Company served as a cautionary tale. Its lesson endured.";
  const p3 = splitSentencesSafe(c3);
  check('3. Legal v.: exactly 2 parts', p3.length === 2);
  check('3. Legal v.: first part contains "v. United States"', p3[0].includes('v. United States'));
  check('3. Legal v.: lossless', p3.join('') === c3);

  // 4
  const c4 = "William S. Pease signed the order. It held 2.3 million gallons. See archives.gov for records.";
  const p4 = splitSentencesSafe(c4);
  check('4. Prior protections: exactly 3 parts', p4.length === 3);
  check('4. Prior protections: S. Pease intact', p4[0].includes('S. Pease'));
  check('4. Prior protections: 2.3 million intact', p4[1].includes('2.3 million'));
  check('4. Prior protections: lossless', p4.join('') === c4);

  // 5
  const c5 = "The U.S.A. entered the war. Production surged.";
  const p5 = splitSentencesSafe(c5);
  check('5. U.S.A. entered the war: lossless', p5.join('') === c5);

  // 6
  const c6 = "First here. Second there. Third one ends.";
  const p6 = splitSentencesSafe(c6);
  check('6. Clean prose: 3 parts', p6.length === 3);
  check('6. Clean prose: lossless', p6.join('') === c6);
  check('6. Clean prose: no U+0001 (PROT)', !p6.some(p => p.includes('\u0001')));

  // Ensure DRAFTGATE-3A refusal did not fire
  check('7. DRAFTGATE-3A refusal never fires', !errorTriggered);

  console.error = originalError;

  if (failures === 0) {
    console.log('ACCEPTANCE: ALL CHECKS MATCHED');
  }
  process.exit(failures === 0 ? 0 : 1);
}

runTest();
