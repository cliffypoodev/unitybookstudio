// STYLEBUDGET-1 (+ ARTICLEFP-1C) acceptance battery.
//
// The fingerprint (live 82k draft): constructions that pass every chapter and
// accumulate into a tell across the book (11 "small smile", 15 "but it was
// real", 24 "for now") plus simile density (~5.0 "like a / as if" per 1k
// words). Design under test: deterministic book-level ledger; exhausted
// families banned in the writer's prompt; simile budget stated when prior
// chapters run hot; export gate reports spend as WARNINGS only. ARTICLEFP-1C:
// the a/an guard's allowlists are properly bounded.
import fs from 'node:fs';
import {
  countAISlopPatterns,
  measureSimileDensity,
  buildBookStyleLedger,
  buildStyleBudgetPromptBlock,
  SIMILE_DENSITY_BUDGET_PER_1K,
  SLOP_BUDGETS,
} from '../src/lib/aiSlopReduction.js';
import { analyzeProse } from '../src/lib/proseGrammarGate.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── 1. fingerprint constructions are counted ──
const sample = 'It was a small smile, but it was real. For now, the universe stayed indifferent. A short, sharp sound.';
const counts = countAISlopPatterns(sample).counts;
check('1. fingerprint families are countable', counts['small smile'] === 1 && counts['but it was real'] === 1 && counts['for now'] === 1 && counts['indifferent'] === 1 && counts['short, sharp'] === 1);
check('2. fingerprint families carry book-level budgets', SLOP_BUDGETS.filter((family) => Number.isFinite(family.bookBudget)).length >= 5);

// ── 2. simile density ──
const filler = 'The crew worked the yard and hauled the parts inside without complaint. '.repeat(30);
const hot = `${filler}It moved like a snake. It hissed as if alive. It shone like a coin. ${filler}`;
const density = measureSimileDensity(hot);
check('3. simile density counts like-a and as-if per 1k words', density.likeA === 2 && density.asIf === 1 && density.per1k > 0);

// ── 3. the book ledger ──
const priorChapters = [
  `${filler}It was a small smile, but it was real.${filler}`,
  `${filler}A small smile crossed the yard. It was a small smile, but it was real.${filler}`,
];
const ledger = buildBookStyleLedger(priorChapters);
const smallSmile = ledger.families.find((family) => family.name === 'small smile family');
check('4. book ledger sums spend across chapters', smallSmile.spent === 5 && smallSmile.exhausted === true);
const block = buildStyleBudgetPromptBlock(ledger);
check('5. exhausted family is banned in the prompt block with its spend', /EXHAUSTED CONSTRUCTIONS/.test(block) && /"small smile"/.test(block) && /used 5x already/.test(block));
check('6. a young clean book produces an EMPTY block (no noise)', buildStyleBudgetPromptBlock(buildBookStyleLedger([filler])) === '');
const hotBook = Array.from({ length: 4 }, () => hot).join('\n\n');
const hotLedger = buildBookStyleLedger([hotBook]);
check('7. hot simile average produces the simile budget instruction', hotLedger.simile.wordCount > 2000 && /SIMILE BUDGET/.test(buildStyleBudgetPromptBlock(hotLedger)) === (hotLedger.simile.per1k > SIMILE_DENSITY_BUDGET_PER_1K));

// ── 4. wiring (source-level, live files) ──
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('8. writer builds the book ledger per chapter and injects the block into the scene contract', WRITER.includes('buildBookStyleLedger(styleTexts)') && WRITER.includes('style_budget: styleBudgetBlock'));
check('9. anthologies are excluded from the cross-story ledger', /STYLEBUDGET[\s\S]{0,400}isAnthologyProject\(project\)/.test(WRITER));
const GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
check('10. gate reports book spend and hot chapters as WARNINGS', GATE.includes('STYLEBUDGET-1: book-level allowance exceeded') && GATE.includes('similes per 1k words'));
check('11. gate never hard-blocks on style', !/hardFailures\.push\([^)]*STYLEBUDGET/s.test(GATE));

// ── 5. ARTICLEFP-1C: bounded allowlists ──
const fp = async (text) => (await analyzeProse(text)).hard.length;
check('12. correct usage still passes (a unicorn, an hour, a useful tool)', (await fp('He found a unicorn. They waited an hour. A useful tool.')) === 0);
check('13. bounded: "a onerous" is a real error again', (await fp('She led a onerous expedition.')) === 1);
check('14. bounded: "an ledge" is a real error again', (await fp('He saw an ledge above.')) === 1);

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
