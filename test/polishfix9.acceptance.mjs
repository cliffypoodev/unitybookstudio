import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

// 1. Functional - validate the predicate
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const src = fs.readFileSync(path.join(ROOT, 'src/lib/manuscriptSafetyGate.js'), 'utf8');

// Strip out imports to make it run in VM
let code = src.replace(/import\s+.*?;/g, '');
code = code.replace(/export\s+/g, '');

const sandbox = {
  detectModelControlTokens: () => [],
  findNarrativeMetaLeaks: (text) => text.includes('outline:') ? [{ phrase: 'outline:', index: 0, snippet: 'outline:' }] : [],
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const runManuscriptSafetyGate = sandbox.runManuscriptSafetyGate;

const predicate = (gate) => {
  return !gate.ok
    && Array.isArray(gate.reasons) && gate.reasons.length > 0
    && gate.reasons.every((r) => {
      const s = String(r);
      if (!s.startsWith('Malformed grammar')) return false;
      const phrases = s.match(/"[^"]+"/g) || [];
      return phrases.length > 0 && phrases.every((p) => p.includes('dropped word'));
    });
};

// Fixture A: 3 dropped words to ensure gate rejects it (strictMatches >= 3)
const textA = "The survey was a to the quality of the piles. It was a to the worst. This was a to the end.";
const gateA = runManuscriptSafetyGate(textA);
check('Fixture A: gate not ok', !gateA.ok);
check('Fixture A: EVERY reason startsWith Malformed grammar & contains dropped word', predicate(gateA));

// Fixture B: dropped word + process leak
const textB = "The survey was a to the quality of the piles. Chapter 12 outline: something.";
// A single dropped word won't reject, but the process leak will.
const gateB = runManuscriptSafetyGate(textB);
check('Fixture B: gate not ok', !gateB.ok);
check('Fixture B: predicate is FALSE for mixed/leak failures', !predicate(gateB));

// 2. Source assertions on ProjectStudio.jsx
const psSrc = fs.readFileSync(path.join(ROOT, 'src/pages/ProjectStudio.jsx'), 'utf8');
const psClean = psSrc.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');

check('ProjectStudio: onlyDroppedWordFailures present', psClean.includes('const onlyDroppedWordFailures'));
check('ProjectStudio: ADMITTED console.warn present', psClean.includes("console.warn('[POLISH-NF-SAFETY-GATE] ADMITTED Ch.'"));
check('ProjectStudio: REJECTED console.error branch still present', psClean.includes("console.error('[POLISH-NF-SAFETY-GATE] REJECTED Ch.'"));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
