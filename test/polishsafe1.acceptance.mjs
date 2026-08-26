// POLISHSAFE-1 (+ CROSSDEDUPE-1, GATEREPORT-1, GRAMMARFP-2) acceptance battery.
//
// The defect (measured live, REDUX draft): the polish pipeline's quote
// "stabilizer" straightened and re-guessed every smart quote, turning a
// balanced 133/133 chapter into 114/133 mid-pipeline (final: 127/133) and
// merging paragraphs — every re-polish resurrected the exact same corruption
// and the export gate then blocked the book on damage the polish itself made.
// Separately: cross-chapter verbatim sentences had detection but no repair,
// the gate reported them 3 at a time (whack-a-mole), and two grammar-gate
// false positives ("point A to point B" as dropped-noun, "told you you" as
// repeated-word) hard-blocked legal English.
//
// Design under test: do-no-harm quote rescue (healthy input untouched;
// rescue output ships only if strictly not worse), an unconditional final
// dialogue-balance pass plus QUOTE-GUARD in the runner, a shared cross-chapter
// dupe detector with a verified LLM recast healer, full gate enumeration, and
// bounded letter-label/speech-ellipsis grammar guards.
import fs from 'node:fs';
import { repairChapterQuotes, analyzeQuoteIntegrity } from '../src/lib/quoteFixPolish.js';
import {
  findCrossChapterDuplicateSentences,
  verifyRecastSentence,
  healCrossChapterDuplicates,
  CROSS_DUPE_MIN_WORDS,
} from '../src/lib/crossChapterDedupe.js';
import { analyzeProse } from '../src/lib/proseGrammarGate.js';
import vm from 'node:vm';

// exportSafetyGate.js transitively imports the Vite "@/" alias, which plain
// node cannot resolve, so formatExportSafetyFailure (a pure function) is
// extracted from the REAL source by anchor and executed in a vm — the same
// technique the EXITSTATE-1 battery uses. No logic is re-implemented.
const GATE_SRC = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
const fmtStart = GATE_SRC.indexOf('export function formatExportSafetyFailure');
const fmtEnd = GATE_SRC.indexOf('\n// Inline lightweight dialogue detection', fmtStart);
if (fmtStart < 0 || fmtEnd < 0) throw new Error('formatExportSafetyFailure anchors not found');
const fmtCtx = { console, JSON, Array, String, Boolean };
vm.createContext(fmtCtx);
vm.runInContext(GATE_SRC.slice(fmtStart, fmtEnd).replace(/^export /gm, ''), fmtCtx);
const formatExportSafetyFailure = fmtCtx.formatExportSafetyFailure;

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };
const q = (t) => { let o = 0, c = 0; for (const ch of t) { if (ch === '“') o++; else if (ch === '”') c++; } return `${o}/${c}`; };

// ── 1. POLISHSAFE-1A: do-no-harm quote rescue ──
const healthy = '“Blueberries are good,” Ottie said. “Then we eat,” Ludo said.\n\nThe yard was quiet. He looked at the sky. “Fine.” “Deal.”\n\n“Last word,” she said.';
const rHealthy = repairChapterQuotes(healthy);
check('1. healthy chapter is returned byte-for-byte untouched', rHealthy.changed === false && rHealthy.text === healthy);
check('2. healthy adjacent close-open pairs survive (no quote deletion)', q(rHealthy.text) === q(healthy));

const v5damaged = '"You want the truth He said it without blinking."I doubt that." The room stayed still.';
const rDamaged = repairChapterQuotes(v5damaged);
check('3. v5-corruption rescue still fires on damaged text', rDamaged.changed === true && rDamaged.text.includes('“You want the truth.” He said it without blinking. “I doubt that.”'));

const multiPara = '“You want the truth He said it without blinking."I doubt that."\n\nShe waited.';
const rMulti = repairChapterQuotes(multiPara);
check('4. rescue output that would merge paragraphs is rejected (original kept)', rMulti.changed === false && rMulti.text === multiPara && rMulti.unresolved >= 1);

// ── 2. POLISHSAFE-1B: final balance pass + QUOTE-GUARD ──
// (The runner module transitively imports the Vite "@/" alias, which plain
// node cannot resolve, so the runner is verified at source level here. The
// full-pipeline behavior — a real 20-chapter book leaving the pipeline with
// zero worse-balance chapters, ch12 healed 80/83 -> 83/83, ch13/ch20 held at
// 133/133 and 70/70 — was proven on real manuscript data in the sandbox run
// recorded in the arc doc.)
const RUNNER = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url), 'utf8');
const { runDialogueMechanicsPass } = await import('../src/lib/dialogueMechanicsRepair.js');
const closeHeavyCh = 'The hatch stuck again. Someone will fix it tomorrow, she thought.\n\nNot my circus,” Petra said. The wrench slipped and rang off the deck.\n\n“Enough,” Marlow said.';
const dmHealed = runDialogueMechanicsPass(closeHeavyCh, {});
check('5. the balance healer the final pass runs actually balances a close-heavy chapter', q(dmHealed.text) === '2/2' && dmHealed.text.includes('“Not my circus,”'));
check('6. final balance pass runs UNGATED on every fiction chapter (no shouldRunDialogueRepair)', /final unconditional dialogue-balance heal[\s\S]{0,1600}const dmFinal = runDialogueMechanicsPass\(f\.content \|\| '', \{\}\)/.test(RUNNER) && !/final unconditional dialogue-balance heal[\s\S]{0,1600}shouldRunDialogueRepair\(/.test(RUNNER));
check('7. final pass keeps all healer families (DIALOGREPAIR-2 keep-fix shape)', /dmFinal\.repairs\.length \+ \(dmFinal\.orphanRepaired \|\| 0\) \+ \(dmFinal\.unclosedRepaired \|\| 0\) \+ \(dmFinal\.closeHeavyRepaired \|\| 0\)/.test(RUNNER));
check('8. QUOTE-GUARD reverts any chapter whose balance got worse (wired, loud)', RUNNER.includes('[QUOTE-GUARD]') && RUNNER.includes('REVERTED to input text') && /finalImbalance > initial\.imbalance/.test(RUNNER));

// ── 3. CROSSDEDUPE-1: detection ──
const long = 'The crew hauled the last of the salvage across the dry riverbed before sundown came.';
const short8 = 'It was a small smile, but it was real.';
const dupChapters = [
  { chapterNumber: 1, text: `${long} Something else happened here. ${short8}` },
  { chapterNumber: 2, text: `A new day started badly. ${long} ${short8}` },
  { chapterNumber: 3, text: `${long}` },
];
const found = findCrossChapterDuplicateSentences(dupChapters);
check('9. 12+-word verbatim sentences are found across chapters (pairwise)', found.length === 2 && found.every((d) => d.a === 1) && found.map((d) => d.b).join(',') === '2,3');
check('10. sub-12-word repeats are NOT gate-class duplicates', !found.some((d) => d.norm === short8));

// ── 4. CROSSDEDUPE-1: recast verification ──
const chapterCtx = 'Petra and Marlow worked the riverbed. The salvage was heavy.';
check('11. verification rejects an unchanged recast', verifyRecastSentence(long, long, { chapterText: chapterCtx }).ok === false);
check('12. verification rejects a recast that smuggles in a new proper noun', verifyRecastSentence(long, 'The crew followed Dietrich across the dry riverbed before sundown came that night.', { chapterText: chapterCtx }).ok === false);
check('13. verification rejects dialogue/narration frame changes', verifyRecastSentence('“Reroute the auxiliary power to the dampeners before the harmonics drift any further tonight.”', 'Reroute the auxiliary power to the dampeners before the harmonics drift any further tonight.', { chapterText: chapterCtx }).ok === false);
check('14. verification rejects runaway length', verifyRecastSentence(short8, short8.repeat(4) + ' And the smile was real.', { chapterText: chapterCtx }).ok === false);
check('15. a faithful same-cast recast passes', verifyRecastSentence(long, 'Before sundown came, the crew dragged the last of the salvage over the dry riverbed.', { chapterText: chapterCtx + ' ' + long }).ok === true);

// ── 5. CROSSDEDUPE-1: healing with an injected LLM ──
const healSet = [
  { chapterNumber: 1, text: `${long} Filler text follows here.` },
  { chapterNumber: 2, text: `Opening line. ${long} Closing line.` },
];
const goodLLM = async () => 'Before sundown came, the crew dragged the last of the salvage over the dry riverbed.';
const healed = await healCrossChapterDuplicates(healSet, { callLLM: goodLLM });
check('16. healer recasts the LATER occurrence only', healed.recast === 1 && healSet[0].text.includes(long) && !healSet[1].text.includes(long) && healSet[1].text.includes('dragged the last of the salvage'));
const healSet2 = [
  { chapterNumber: 1, text: `${long} Filler.` },
  { chapterNumber: 2, text: `Opening. ${long} Closing.` },
];
const badLLM = async () => 'Meanwhile Dietrich smiled at the new stranger arriving from the eastern road that evening.';
const healed2 = await healCrossChapterDuplicates(healSet2, { callLLM: badLLM });
check('17. unverifiable recast is skipped, never forced (fail-open, duplicate kept)', healed2.recast === 0 && healed2.skipped.length === 1 && healSet2[1].text.includes(long));

// ── 6. Pipeline wiring for dedupe ──
check('18. runner heals dupes through the injected LLM and reports the sweep', RUNNER.includes('healCrossChapterDuplicates(') && RUNNER.includes('_crossDedupeLLMOverride') && RUNNER.includes('CrossDedupe:'));
check('19. LLM-off mode reports duplicates instead of silently passing', RUNNER.includes('LLM disabled') && RUNNER.includes('findCrossChapterDuplicateSentences(dedupeChapters)'));

// ── 7. GATEREPORT-1: full enumeration ──
const GATE = GATE_SRC;
check('20. gate uses the shared dupe detector (one rule for block and heal)', GATE.includes("from './crossChapterDedupe.js'") && GATE.includes('findCrossChapterDuplicateSentences('));
const manyReasons = Array.from({ length: 7 }, (_, i) => `Verbatim sentence in ch.1 and ch.2: "dupe number ${i + 1}"`);
const formatted = formatExportSafetyFailure({ blocked: true, hardFailures: [{ chapterNumber: 2, title: 'Cross-chapter duplication', reportAllReasons: true, reasons: manyReasons }] });
check('21. ALL duplicate reasons appear in one report (no 3-cap whack-a-mole)', manyReasons.every((r) => formatted.includes(r)));
const cappedOther = formatExportSafetyFailure({ blocked: true, hardFailures: [{ chapterNumber: 3, title: 'Grammar', reasons: ['r1', 'r2', 'r3', 'r4-hidden'] }] });
check('22. per-chapter failures keep the 3-reason cap (report stays readable)', cappedOther.includes('r3') && !cappedOther.includes('r4-hidden'));

// ── 8. GRAMMARFP-2: bounded grammar-gate guards ──
const hard = async (t) => (await analyzeProse(t)).hard.length;
check('23. "point A to point B" is legal (letter label, not dropped noun)', (await hard('It is simply moving from point A to point B without hitting anything.')) === 0);
check('24. "A to B" bare letter hop is legal', (await hard('The route from A to B was blocked by the storm.')) === 0);
check('25. lowercase "a to industrial might" is still a hard error', (await hard('She sold a to industrial might for nothing.')) >= 1);
check('26. "told you you" speech ellipsis is legal', (await hard('The voice told you you weren’t good enough for the crew.')) === 0);
check('27. "you you" without a speech verb stays a hard error', (await hard('He saw you you at the fence line.')) >= 1);
check('28. plain repeated words are still hard errors ("the the")', (await hard('She walked into the the barn.')) >= 1);

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
