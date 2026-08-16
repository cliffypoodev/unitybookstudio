// POLISHSAFE-3 acceptance battery — finish retiring the destructive vocab caps.
//
// Root-cause trace (2026-08-15): two prose-MUTATING passes still fired in
// runVocabCaps and produced fragments the same way the already-retired telling-
// tag and pronoun-opener caps did:
//   Phase 2 "It was" cap:   "It was quiet." -> "Quiet."  /  "It was a cold morning." -> "A cold morning."
//   Phase 4 streak breaker: "The wind howled." -> "Wind howled."  (article dropped)
// Both are now flag-only. Detection stays; the mutation is gone. (The word-
// substitution passes — PHASE 0 banned-words + vocab caps — are a separate voice
// decision and are intentionally left as-is here.)
import fs from 'node:fs';
import { runSentenceStarterVariation } from '../src/lib/vocabCaps.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };
// The "It was" cap and the streak breaker live in runSentenceStarterVariation.
const run = (content) => { const loaded = [{ chapter: { chapter_number: 1 }, content }]; runSentenceStarterVariation(loaded, () => {}); return loaded[0].content; };

// ── behavioral: the "It was" cap no longer fragments ──
const itwas = 'It was quiet.\nIt was a cold morning.\nIt was empty.\nIt was strange.\nIt was late.';
const inCount = (itwas.match(/(?<=^|\n)It was\b/g) || []).length;
const itwasOut = run(itwas);
check('1. input has >3 "It was" openers (the cap has work to do)', inCount > 3, `count=${inCount}`);
check('2. "It was quiet." is NOT fragmented to "Quiet."', itwasOut.includes('It was quiet.') && !/(^|\n)Quiet\./.test(itwasOut));
check('3. "It was a cold morning." is NOT fragmented to "A cold morning."', itwasOut.includes('It was a cold morning.') && !/(^|\n)A cold morning\./.test(itwasOut));
check('4. the whole "It was" block is byte-unchanged', itwasOut === itwas, `out=${JSON.stringify(itwasOut)}`);

// ── behavioral: the streak breaker no longer drops "The" ──
const streak = 'The wind howled across the empty plain.\nThe wind howled once again over the dust.\nThe wind howled a third time near the ridge.';
const streakOut = run(streak);
check('5. the middle "The wind howled…" paragraph keeps its "The"', streakOut.includes('The wind howled once again over the dust.') && !streakOut.includes('Wind howled once again'));
check('6. the streak block is byte-unchanged', streakOut === streak);

// ── source: the mutating code is gone, the retirement marker is present ──
const SRC = fs.readFileSync(new URL('../src/lib/vocabCaps.js', import.meta.url), 'utf8');
check('7. POLISHSAFE-3 retirement marker present', SRC.includes('POLISHSAFE-3'));
check('8. the "It was" mutating counter (itWasFixed++) is gone', !SRC.includes('itWasFixed++'));
check('9. the streak-breaker mutation (bWords.shift) is gone', !SRC.includes('bWords.shift'));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
