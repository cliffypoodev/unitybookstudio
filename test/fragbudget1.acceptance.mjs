// FRAGBUDGET-1 acceptance battery — fragment-density detection through the
// block-and-regenerate lane.
//
// "Fragment syndrome" (short, verbless noun-phrase sentences stacked for
// effect — "Dov, stoic and dusty. A long corridor of rust and silence.")
// isn't a banned word or a simile; it's a sentence SHAPE, so nothing else in
// this codebase catches it. Precision over recall throughout: finite-verb
// evidence is deliberately generous, so a real fragment slipping past is
// fine but a real sentence flagged as a fragment is not. Generic fixture
// names only (Mara, Dov, Ilse).
import fs from 'node:fs';
import {
  FRAGMENT_DENSITY_VERSION,
  FRAGMENT_DENSITY_BUDGET_PER_1K,
  FINITE_VERB_EVIDENCE_RX,
  findFragments,
  measureFragmentDensity,
  makeFragmentDensityDetector,
} from '../src/lib/fragmentDensity.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

check('0. version', FRAGMENT_DENSITY_VERSION === 'fragment-density-v1');
check('0b. default budget is 20/1k', FRAGMENT_DENSITY_BUDGET_PER_1K === 20);

// ── 1. finite-verb evidence accepts real sentences ──
for (const s of ['He didn’t move.', 'She’d gone.', 'Mara stood.', 'The engine coughed.']) {
  check(`1. accepts (has finite-verb evidence): "${s}"`, FINITE_VERB_EVIDENCE_RX.test(s));
}

// ── 2. rejects (flags as fragment) verbless noun phrases ──
for (const s of ['Dov, stoic and dusty.', 'A long corridor of rust and silence.']) {
  check(`2. rejects/flags (no finite-verb evidence): "${s}"`, !FINITE_VERB_EVIDENCE_RX.test(s));
}

// ── 3. dialogue is ignored ──
{
  const text = 'Dov, stoic and dusty. "A quiet room." Mara stood.';
  const found = findFragments(text);
  check('3. dialogue ("A quiet room.") is never a fragment target', !found.some((f) => f.sentence.includes('quiet room')));
  check('3b. the narration fragment is still found', found.some((f) => f.sentence.includes('stoic and dusty')));
}

// ── 4. scene breaks / headings are ignored ──
{
  const text = 'Dov, stoic and dusty. A long corridor of rust and silence.\n\n* * *\n\nA rusted hatch. A cold engine room.';
  const found = findFragments(text);
  check('4. a "* * *" scene-break paragraph contributes no fragments of its own', found.every((f) => f.paragraphIndex !== 1));
}

// ── 5. density <= budget → zero targets ──
{
  const clean = 'Mara crossed the deck and checked the gauge before she spoke to Dov near the console. '.repeat(30);
  const det = makeFragmentDensityDetector();
  check('5. clean narration under budget produces zero targets', det(clean).length === 0, JSON.stringify(measureFragmentDensity(clean)));
}

// ── 6. > budget → targets sorted densest-first, capped at 6 ──
{
  const filler = 'Mara crossed the deck and checked the gauge before she spoke quietly to Dov near the console. '.repeat(20);
  // 8 dense paragraphs, each with 3 fragments; 1 paragraph with only 2.
  const densePara = (n) => Array.from({ length: n }, (_, i) => `Fragment ${i}, stoic and dusty.`).join(' ');
  const paragraphs = Array.from({ length: 8 }, () => densePara(3));
  const text = filler + '\n\n' + paragraphs.join('\n\n');
  const det = makeFragmentDensityDetector();
  const targets = det(text);
  check('6a. over-budget text produces targets, capped at 6', targets.length > 0 && targets.length <= 6, JSON.stringify({ count: targets.length, density: measureFragmentDensity(text) }));
  check('6b. every target is a fragment-density kind with a reason naming the density and budget', targets.every((t) => t.kind === 'fragment-density' && t.reason.includes('/1k over budget')));
}

// ── 7. rescan of a candidate with only 1 fragment passes (not flagged) ──
{
  const det = makeFragmentDensityDetector();
  const oneFragmentParagraph = 'Mara crossed the deck and checked the gauge carefully before she spoke. A quiet moment.';
  check('7. a single-paragraph candidate with only 1 fragment is not flagged on rescan', det(oneFragmentParagraph).length === 0, JSON.stringify(measureFragmentDensity(oneFragmentParagraph)));

  const twoFragmentDenseParagraph = 'A cold, empty room. A long corridor of dust and silence.';
  check('7b. a dense single-paragraph candidate that is itself over budget and still has >= 2 fragments IS flagged on rescan', det(twoFragmentDenseParagraph).length > 0, JSON.stringify(measureFragmentDensity(twoFragmentDenseParagraph)));
}

// ── 8. [FRAGBUDGET-1] logs at zero (wiring source-shape) ──
{
  const SW = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url).pathname, 'utf8');
  const RUNNER = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url).pathname, 'utf8');
  check('8a. sceneWriter.js logs [FRAGBUDGET-1] unconditionally',
    /console\.log\(`\[FRAGBUDGET-1\] writer-final: fragments/.test(SW));
  check('8b. manuscriptPolishRunner.js logs [FRAGBUDGET-1] unconditionally, before the LLM-on/off branch',
    /console\.log\(`\[FRAGBUDGET-1\] Ch\.\$\{chNum\}: fragments[\s\S]{0,300}`\);\s*\n\s*if \(allowLLM/.test(RUNNER));
  check('8c. both lane call sites wire fragmentDensityDetector into extraDetectors',
    SW.includes('fragmentDensityDetector]') &&
    (RUNNER.match(/extraDetectors: \[detectBannedVocabulary, templateFamilyDetector, openingEchoDetector, fragmentDensityDetector\]/g) || []).length === 2);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
