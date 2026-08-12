import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeProse } from '../src/lib/proseGrammarGate.js';

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
  const t1 = await analyzeProse("The rescue meant the extraction of the living from the sinking streets.");
  check('1. "the living"', t1.hard.length === 0);

  const t2 = await analyzeProse("The quiet of the morning settled over the harbor.");
  check('2. "the quiet"', t2.hard.length === 0);

  const t3 = await analyzeProse("He earned a living from the sea.");
  check('3. "a living"', t3.hard.length === 0);

  const t4 = await analyzeProse("A brief from the court arrived that morning.");
  check('4. "A brief"', t4.hard.length === 0);

  const t5 = await analyzeProse("The closure stood as a silent to this corporate calculus.");
  check('5. "a silent" (hard: dropped-noun)', t5.hard.length === 1 && t5.hard.some(m => m.rule.includes('dropped-noun')));

  const t6 = await analyzeProse("It was less a to its quality than a habit.");
  check('6. "a to" (hard: no-word)', t6.hard.length === 1 && t6.hard.some(m => m.rule.includes('dropped-noun')));

  const t7 = await analyzeProse("They pushed the to the side before dawn.");
  check('7. "the to" (hard: no-word)', t7.hard.length === 1 && t7.hard.some(m => m.rule.includes('dropped-noun')));

  const t8 = await analyzeProse("They took a trip to the store before the hearing began.");
  check('8. "a trip" (valid)', t8.hard.length === 0);

  // COMMIT 2: vm-extract formatExportSafetyFailure from src/lib/exportSafetyGate.js
  import('vm').then(vm => {
    const esSrc = fs.readFileSync(path.join(ROOT, 'src/lib/exportSafetyGate.js'), 'utf8');
    const esMatch = esSrc.match(/(?:export\s+)?function\s+formatExportSafetyFailure[\s\S]*?\n\}/);
    if (!esMatch) {
      console.error("Could not find formatExportSafetyFailure in exportSafetyGate.js");
      process.exit(1);
    }
    const formatExportSafetyFailureCode = esMatch[0].replace(/export\s+/, '');
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(formatExportSafetyFailureCode + '; this.formatExportSafetyFailure = formatExportSafetyFailure;', sandbox);
    
    const output = sandbox.formatExportSafetyFailure({
      blocked: true,
      hardFailures: [{
        chapterNumber: 2,
        title: 'T',
        reasons: ['Grammar (dropped-noun) paragraph 3: "a silent to this"']
      }]
    });
    
    check('9. export-block dialog names the reason and defaults Action',
      output.includes('FIX_OR_REDRAFT') &&
      output.includes('→ Grammar (dropped-noun) paragraph 3: "a silent to this"') &&
      !output.includes('undefined')
    );

    if (failures === 0) {
      console.log('ACCEPTANCE: ALL CHECKS MATCHED');
    }
    process.exit(failures === 0 ? 0 : 1);
  });
}

runTest();
