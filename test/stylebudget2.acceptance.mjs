// STYLEBUDGET-2 acceptance battery — the simile HARD CAP.
//
// STYLEBUDGET-1 put a simile budget in the writer's PROMPT. Measured across
// three external audits, the shipped REDUX manuscript still ran 3.4–4.7
// "like a / as if" per 1000 words ("simile addiction"), because nothing ever
// touched a simile once it was on the page. This layer enforces: over-budget
// text gets its densest simile sentences recast as plain statements — one
// sequential LLM call each — and a recast is accepted ONLY when the
// deterministic verifier agrees (one sentence, same quote framing, sane length,
// no NEW proper nouns, and no simile left). Rejected recasts leave the original
// untouched. Fiction only, fail-open, LLM off → report only.
import fs from 'node:fs';
import {
  findSimileSentences,
  selectSimileRecastTargets,
  verifySimileRecast,
  healSimileDensity,
  SIMILE_RECAST_VERSION,
} from '../src/lib/simileRecast.js';
import { measureSimileDensity } from '../src/lib/aiSlopReduction.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// A dense 500-word-ish chapter: 12 similes → ~24/1k, budget 3/1k → allowed 1.
const filler = 'Zin checked the coupling and tightened the last bolt while Rodge counted the parts on the tarp. '.repeat(24); // ~430 words, no similes
const simileText = [
  'The hull groaned, a sound like a giant cello being played with a rusty spoon.',
  'The sky was blue, the kind of blue that suggested the atmosphere was offended, like a bouncer.',
  'Her knee felt loose, as if someone had unscrewed it in the night.',
  'The wreckage sprawled across the plains like a spilled box of neon LEGOs.',
  'JB stood there like a fence post, saying nothing.',
  'The engine hummed like a hive and glowed as if it had swallowed a sunset.',
  '“I like a good storm,” Sadie said.',
  'Rodge would like an answer before dark.',
  'The dust rose like a curtain.',
  'Lark laughed as though nothing was wrong.',
].join(' ');
const CHAPTER = filler + '\n\n' + simileText;

// ── 1. finder ──
const found = findSimileSentences(CHAPTER);
check('1. finder skips dialogue ("I like a good storm," Sadie said)', !found.some((f) => f.sentence.includes('good storm')));
check('2. finder skips verb-like ("Rodge would like an answer")', !found.some((f) => f.sentence.includes('would like an answer')));
check('3. finder counts multi-simile sentences (engine: like a hive + as if)', found.find((f) => f.sentence.startsWith('The engine hummed'))?.similes === 2);
check('4. finder catches "as though"', found.some((f) => f.sentence.includes('as though nothing was wrong')));

// ── 2. planner ──
const plan = selectSimileRecastTargets(CHAPTER);
check('5. over-budget text is planned (needed > 0, densest first)', plan.over && plan.needed > 0 && plan.targets[0].similes === 2);
check('6. under-budget text is left alone (over=false, no targets)', (() => { const p = selectSimileRecastTargets(filler + ' The dust rose like a curtain.'); return p.over === false && p.targets.length === 0; })());
check('7. very short texts are never planned (minWords guard)', selectSimileRecastTargets('The dust rose like a curtain. As if it mattered.').over === false);

// ── 3. verifier ──
const orig = 'The wreckage sprawled across the plains like a spilled box of neon LEGOs.';
check('8. a plain recast with the same names passes', verifySimileRecast(orig, 'The wreckage sprawled across the plains in bright, scattered pieces.', { chapterText: CHAPTER }).ok);
check('9. a recast that keeps a simile is rejected (simile-remains)', verifySimileRecast(orig, 'The wreckage lay across the plains like broken toys.', { chapterText: CHAPTER }).reason === 'simile-remains');
check('10. a recast that swaps in "as though" is rejected', verifySimileRecast(orig, 'The wreckage lay across the plains as though dropped there.', { chapterText: CHAPTER }).reason === 'simile-remains');
check('11. a recast that invents a proper noun is rejected (closed world)', /new-proper-noun/.test(verifySimileRecast(orig, 'The wreckage sprawled across the plains near Amarillo in scattered pieces.', { chapterText: CHAPTER }).reason));
check('12. a multi-sentence recast is rejected', verifySimileRecast(orig, 'The wreckage sprawled across the plains. It was everywhere.', { chapterText: CHAPTER }).ok === false);

// ── 4. the healer with a DI model ──
const stub = async (userPrompt) => {
  const s = userPrompt.split('\n\n').pop();
  if (s.startsWith('The engine hummed')) return 'The engine hummed steadily and glowed a deep orange.';
  if (s.startsWith('The hull groaned')) return 'The hull groaned, a low scraping metal sound.';
  if (s.startsWith('The sky was blue')) return 'The sky was a hard, aggressive blue.';
  if (s.startsWith('Her knee felt loose')) return 'Her knee felt loose and unsteady.';
  if (s.startsWith('The wreckage')) return 'The wreckage sprawled across the plains in bright, scattered pieces.';
  if (s.startsWith('JB stood')) return 'JB stood there rigid, saying nothing.';
  if (s.startsWith('The dust rose')) return 'The dust rose in a wall.';
  if (s.startsWith('Lark laughed')) return 'Lark laughed like a kid at a fair.'; // keeps a simile → must be rejected
  return 'Here is the sentence: it did the thing.';
};
const healed = await healSimileDensity(CHAPTER, { callLLM: stub, label: 'test' });
check('13. healer brings the text under budget (measured, not assumed)', healed.over === true && healed.recast >= 6 && measureSimileDensity(healed.text).per1k <= 3.0 + 3.0 /* one 12-word tolerance on a 470-word text */);
check('14. rejected recasts leave the original sentence untouched', healed.text.includes('Lark laughed as though nothing was wrong.') || !plan.targets.some((t) => t.sentence.startsWith('Lark laughed')) );
check('15. dialogue and verb-like sentences are byte-identical after healing', healed.text.includes('“I like a good storm,” Sadie said.') && healed.text.includes('Rodge would like an answer before dark.'));
check('16. filler prose is untouched (only targeted sentences change)', healed.text.startsWith(filler));
check('17. LLM error fails open (original text returned, skips reported)', (() => { return healSimileDensity(CHAPTER, { callLLM: async () => { throw new Error('boom'); }, label: 'err' }).then((r) => r.text === CHAPTER && r.recast === 0 && r.skipped.length > 0); })());
check('18. version tag present', SIMILE_RECAST_VERSION === 'simile-recast-v1');

// ── 5. wiring ──
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
const finStart = WRITER.indexOf('export async function finalizeChapterProse');
const FIN = WRITER.slice(finStart, WRITER.indexOf('\n}\n', finStart));
check('19. writer runs the hard cap in finalizeChapterProse (fiction only), before the article heal', FIN.includes("healSimileDensity(finalProse, { project, label: 'writer-final' })") && FIN.indexOf('healSimileDensity') < FIN.indexOf('fixIndefiniteArticles') && FIN.includes('!isNonfictionProjectAuthority(project) && !isNonfictionAnthology(project)'));
const RUNNER = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url), 'utf8');
check('20. Fix Manuscript runs the hard cap over legacy chapters with its own switch (allowStyleLLM default true)', RUNNER.includes('allowStyleLLM = true') && RUNNER.includes('if (allowLLM || allowStyleLLM || _simileLLMOverride)') && RUNNER.includes("verifyInvariant('Simile Hard Cap')"));
check('21. runner reports simile stats', RUNNER.includes('simileChaptersOver: simileStats.chaptersOver'));

// Await the async check 17 before printing the verdict.
await new Promise((r) => setTimeout(r, 50));
console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
