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

async function run() {
  const t1 = await analyzeProse("The survey was a effort to map the harbor.");
  check('1. "a effort" -> HARD (indefinite-article)', t1.hard.some(h => h.rule.includes('indefinite-article') || h.rule.includes('retext-indefinite-article')));

  const t2 = await analyzeProse("The the committee met at noon.");
  check('2. "The the" -> HARD (repeated-words)', t2.hard.some(h => h.rule.includes('repeated-words') || h.rule.includes('retext-repeated-words')));

  const t3 = await analyzeProse("The closure stood as a silent to this corporate calculus.");
  check('3. "a silent to this" -> HARD (dropped-noun)', t3.hard.some(h => h.rule.includes('dropped-noun')));

  const t4 = await analyzeProse("It was less a to its quality than a habit.");
  check('4. "a to its" -> HARD (dropped-noun, no-word variant)', t4.hard.some(h => h.rule.includes('dropped-noun')));

  const t5 = await analyzeProse("They took a trip to the store before the hearing began.");
  check('5. "a trip to the" -> ZERO hard findings', t5.hard.length === 0);

  const t6 = await analyzeProse("She earned a university degree in an hour of glory.");
  check('6. "a university / an hour" -> ZERO hard findings', t6.hard.length === 0);

  const longSentence = "Word ".repeat(70);
  const t7 = await analyzeProse(longSentence);
  check('7. 70-word sentence -> advisory present, hard empty', t7.advisory.length > 0 && t7.hard.length === 0);

  const t8 = await analyzeProse("The the committee met at noon.\n\nThe closure stood as a silent to this corporate calculus.");
  check('8. Hard finding carries a 1-based paragraph number', t8.hard.some(h => h.rule.includes('repeated-words') && h.paragraph === 1) && t8.hard.some(h => h.rule.includes('dropped-noun') && h.paragraph === 2));

  const exportGate = fs.readFileSync(path.join(ROOT, 'src/lib/exportSafetyGate.js'), 'utf8');
  check('9. Source assertions: exportSafetyGate contains [PROSEGATE-1]', exportGate.includes('[PROSEGATE-1]'));
  const pgIndex = exportGate.indexOf('PROSEGATE-1B');
  const lgIndex = exportGate.indexOf('LENGTHGATE-1B');
  check('9. Source assertions: insert precedes LENGTHGATE-1B', pgIndex !== -1 && lgIndex !== -1 && pgIndex < lgIndex);

  console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch(console.error);
