// REGENLANE-1C acceptance battery — prompt + verifier fixes from Arc F's
// live proof (findings 27-31, Run 1 STOP).
//
// Run 1 on REDUX: the lane's prompt dropped every finding's reason, so the
// model saw `DEFECT (template-family): "The stars were bright, cold, and
// indifferent."` with no idea WHICH word was the problem (finding 27); the
// rescan verifier check missed a template hit that survived because a
// single candidate paragraph is never "over budget" on its own, so
// "Zin looked at him, really looked at him..." shipped after the model only
// swapped Rodge -> Roderick and kept "really looked" (finding 28); accepted
// candidates introduced a straight quote the original lacked and a space
// inside a smart quote (finding 29); the closed-world check allowed the
// model to swap one cast member's name for another's since both were in
// `cast` (finding 30); and the flat 0.6-1.6x length ratio rejected every
// short template-phrase paragraph outright (finding 31). Generic fixture
// names only (Mara, Dov, Ilse).
import {
  collectRegenTargets,
  verifyRegeneratedParagraph,
  regenerateFlaggedParagraphs,
} from '../src/lib/regenerateLane.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };
const CAST = ['Mara', 'Dov', 'Ilse'];

// A generic extraDetector reproducing the live shape: a template-family hit
// naming the exact phrase that must not survive.
const reallyLookedDetector = (text) => {
  const m = String(text || '').match(/[^.]*really looked[^.]*\./i);
  if (!m) return [];
  return [{
    kind: 'template-family',
    sentence: m[0].trim(),
    reason: 'template "really looked" (chapter budget 1; book spend 2/3) — replace the template phrase with a concrete, specific detail',
    mustNotContain: ['really looked'],
  }];
};

// ── 27. the lane prompt carries a numbered DEFECTS list with every finding's reason ──
{
  const text = 'Dov looked at him, really looked at him, and said nothing at all that mattered.';
  const targets = collectRegenTargets(text, { cast: CAST, extraDetectors: [reallyLookedDetector] });
  check('27a. collectRegenTargets attaches the paragraph\'s defects (kind + reason)',
    targets.length === 1 && Array.isArray(targets[0].defects) && targets[0].defects.some((d) => d.reason.includes('really looked')),
    JSON.stringify(targets));

  let capturedPrompt = '';
  const captureMock = async (userPrompt) => { capturedPrompt = userPrompt; return 'Dov studied him with sudden, unguarded attention, and said nothing that mattered at all.'; };
  await regenerateFlaggedParagraphs(text, { cast: CAST, callLLM: captureMock, project: { book_type: 'fiction' }, extraDetectors: [reallyLookedDetector] });
  check('27b. the prompt carries a numbered DEFECTS list naming the reason',
    /DEFECTS:\n1\. .*really looked/i.test(capturedPrompt), capturedPrompt);
}

// ── 28. targets carry mustNotContain; the verifier rejects defect-remains ──
{
  const original = 'Dov looked at him, really looked at him, and said nothing at all that mattered.';
  const targets = collectRegenTargets(original, { cast: CAST, extraDetectors: [reallyLookedDetector] });
  check('28a. the target carries mustNotContain with the specific phrase, not the whole sentence',
    targets[0]?.mustNotContain?.includes('really looked'), JSON.stringify(targets[0]));

  // The live Ch.4 bug: the model only swaps a name and keeps the defect phrase.
  const stillBroken = 'Ilse looked at him, really looked at him, and said nothing at all that mattered.';
  const verdictBad = verifyRegeneratedParagraph(original, stillBroken, { mustNotContain: ['really looked'] });
  check('28b. a candidate that keeps the defect phrase verbatim is rejected (defect-remains)',
    verdictBad.reason === 'defect-remains', JSON.stringify(verdictBad));

  const fixed = 'Dov studied him with sudden, unguarded attention, and said nothing that mattered at all.';
  const verdictGood = verifyRegeneratedParagraph(original, fixed, { mustNotContain: ['really looked'] });
  check('28c. a candidate that actually removes the defect phrase passes this check', verdictGood.ok, JSON.stringify(verdictGood));

  // End-to-end: the lane itself rejects the still-broken candidate and ships nothing.
  const badMock = async () => stillBroken;
  const result = await regenerateFlaggedParagraphs(original, { cast: CAST, callLLM: badMock, project: { book_type: 'fiction' }, extraDetectors: [reallyLookedDetector] });
  check('28d. end-to-end: the lane rejects the still-broken candidate and ships the original untouched',
    result.regenerated === 0 && result.text === original && result.skipped.some((s) => s.reason === 'defect-remains'), JSON.stringify(result));
}

// ── 29. typography guard ──
{
  const orig1 = 'Dov said the plan was solid enough to bet on.';
  const cand1 = "Dov said the plan was 'solid' enough to bet on."; // introduces a straight quote the original lacked
  check('29a. a candidate that introduces a new straight quote is rejected (typography)',
    verifyRegeneratedParagraph(orig1, cand1, {}).reason === 'typography');

  const orig2 = '“Wait,” Dov said, and no one moved.';
  const cand2 = '“ Wait,” Dov said, and no one moved.'; // space inside the opening smart quote
  check('29b. a candidate with a space inside a smart quote is rejected (typography)',
    verifyRegeneratedParagraph(orig2, cand2, {}).reason === 'typography');

  const orig3 = '“Wait,” Dov said, and no one moved at all.';
  const cand3 = '“Hold on,” Dov said, and no one moved at all.'; // clean rewrite, no typography damage
  check('29c. a clean quoted rewrite with no new straight quotes and no space-in-quote passes this check',
    verifyRegeneratedParagraph(orig3, cand3, {}).ok, JSON.stringify(verifyRegeneratedParagraph(orig3, cand3, {})));
}

// ── 30. closed world: candidate proper nouns must be a subset of the ORIGINAL paragraph's, not original + cast ──
{
  // "Ilse" must land MID-sentence — a sentence-initial capitalized word is
  // exempt from this check (any word can open a sentence), so the swap has
  // to be somewhere the exemption doesn't cover to prove the rejection.
  const original = 'He turned back toward Dov and said nothing at all that mattered to anyone.';
  const swapped = 'He turned back toward Ilse and said nothing at all that mattered to anyone.'; // Ilse is in CAST but not in this paragraph
  check('30a. a different cast member\'s name is rejected even though it IS in the known cast list',
    verifyRegeneratedParagraph(original, swapped, {}).reason === 'new-proper-noun:Ilse', JSON.stringify(verifyRegeneratedParagraph(original, swapped, {})));

  const sameNameRephrased = 'He turned back toward Dov, saying nothing at all that mattered to anyone.';
  check('30b. a rewrite using only the original paragraph\'s own proper nouns still passes',
    verifyRegeneratedParagraph(original, sameNameRephrased, {}).ok, JSON.stringify(verifyRegeneratedParagraph(original, sameNameRephrased, {})));
}

// ── 31. length envelope: short originals get a wider window ──
{
  const shortOriginal = 'Indifferent.';
  const expanded = 'The stars gave nothing back, cold and unmoved by anything happening below them.';
  check('31a. a short original (< 120 chars) can expand well past 3x via the +100-char absolute allowance',
    verifyRegeneratedParagraph(shortOriginal, expanded, {}).ok, JSON.stringify(verifyRegeneratedParagraph(shortOriginal, expanded, {})));

  const longerShort = 'Mara walked slowly across the wide, echoing room toward the heavy door at the far end.';
  const gutted = 'Mara left.';
  check('31b. the floor still applies even for short originals — a paragraph cannot be gutted to almost nothing',
    verifyRegeneratedParagraph(longerShort, gutted, {}).reason === 'length-ratio');

  const longOriginal = 'The corridor stretched long and dim, its walls lined with rusted pipes that hissed faintly in the dark, carrying the failing breath of the engine toward the bridge somewhere above them.';
  check('31c. sanity: this long-original fixture is actually >= 120 chars', longOriginal.length >= 120, `len=${longOriginal.length}`);
  const doubled = longOriginal + ' ' + longOriginal;
  check('31d. a long original (>= 120 chars) still uses the tight 0.6-1.6x ratio — not loosened by this fix',
    verifyRegeneratedParagraph(longOriginal, doubled, {}).reason === 'length-ratio');
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
