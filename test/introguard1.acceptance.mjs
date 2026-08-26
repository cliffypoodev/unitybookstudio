// INTRODUP-1 acceptance battery — in-chapter duplicate self-introduction guard,
// built from the real Ch3 defect (external audit of REDUX v3): Idris announces
// "I am Idris." then, fourteen sentences later, "I'm Idris." in the same scene.
//
// The guard is deterministic, closed-world, and WARNING-only: it fires only
// when a KNOWN cast name is spoken as a FIRST-PERSON self-reference two or more
// times in one chapter. Third-person naming, possessives ("I am Idris's
// associate"), other characters saying the name, and non-cast names are never
// counted.
import fs from 'node:fs';
import { scanDuplicateIntroductions, INTRO_GUARD_VERSION } from '../src/lib/introGuard.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };
const CAST = ['Idris', 'Ottie', 'Solveig', 'JB'];
const scan = (t) => scanDuplicateIntroductions(t, CAST);

// 1. the real REDUX Ch3 double self-introduction (verbatim shape)
const REAL_DUP = 'The smell of old leather and motor oil rolled off him. “I am Idris. And these,” he gestured, “are my associates.” The man moved nearer. “I’m Idris. I collect things. Parts. Memories. Secrets.”';
const d1 = scan(REAL_DUP);
check('1. real Ch3 double self-intro is flagged for Idris (count 2)', d1.length === 1 && d1[0].name === 'Idris' && d1[0].count === 2);

// 2. the FIXED version (single self-intro) is clean
const FIXED = 'The smell of old leather and motor oil rolled off him. “I am Idris. And these,” he gestured, “are my associates.” The man moved nearer. “I collect things. Parts. Memories. Secrets.”';
check('2. the fixed single-introduction version is clean', scan(FIXED).length === 0);

// 3. two DIFFERENT self-intro shapes for the same character count as duplicate
check('3. "My name is Ottie" + "Call me Ottie" flags Ottie', (() => { const r = scan('“My name is Ottie,” she said. Later: “Call me Ottie, everyone does.”'); return r.length === 1 && r[0].name === 'Ottie' && r[0].count === 2; })());

// 4. "I'm NAME" + "NAME's the name" shapes
check('4. "I’m Idris" + "Idris’s the name" flags Idris', (() => { const r = scan('“I’m Idris.” … Much later he grinned. “Idris’s the name.”'); return r.length === 1 && r[0].name === 'Idris' && r[0].count === 2; })());

// 5. a single self-introduction is never flagged
check('5. a single self-introduction is clean', scan('“I am Idris,” he said, and said nothing more about it.').length === 0);

// 6. possessive is not a self-introduction ("I am Idris’s associate")
check('6. "I am Idris." once + "I am Idris’s associate." → not a duplicate', scan('“I am Idris.” The other man shrugged. “I am Idris’s associate, nothing more.”').length === 0);

// 7. third-person naming is never counted
check('7. third-person "He was Idris. Idris grinned." is clean', scan('He was Idris. Idris grinned. Idris was the boss and everyone knew it, because Idris said so.').length === 0);

// 8. another character saying the name is not a self-introduction
check('8. "You’re Idris," + one real self-intro → count 1, clean', scan('“You’re Idris,” Ottie said. “I am Idris,” he agreed, tipping his hat.').length === 0);

// 9. two different characters each introducing once → not flagged
check('9. two characters each self-intro once → clean', scan('“I am Idris,” the man said. Across the lot, someone else called, “I’m Ottie!”').length === 0);

// 10. a non-cast name is never flagged
check('10. duplicate self-intro of a NON-cast name is ignored', scan('“I am Dave.” … “I’m Dave, remember?”').length === 0);

// 11. version
check('11. version is intro-guard-v1', INTRO_GUARD_VERSION === 'intro-guard-v1');

// 12–13. export-gate wiring: imported, called per chapter, WARNING (never a hard block)
const GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
check('12. export gate imports the detector', GATE.includes("from './introGuard.js'") && GATE.includes('scanDuplicateIntroductions'));
check('13. export gate calls it and pushes an INTRODUP-1 WARNING, not a hard block',
  GATE.includes('scanDuplicateIntroductions(body, introCast)') &&
  GATE.includes('INTRODUP-1:') &&
  !/createExportHardBlockError\([^)]*INTRODUP/s.test(GATE) &&
  !/hardFailures\.push\([^)]*INTRODUP/s.test(GATE));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
