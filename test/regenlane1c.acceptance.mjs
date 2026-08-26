// REGENLANE-1C acceptance battery — prompt + verifier fixes from Arc F's
// live proof (findings 27-31, Run 1 STOP).
//
// Run 1 on REDUX: the lane's prompt dropped every finding's reason, so the
// model saw `DEFECT (template-family): "The stars were bright, cold, and
// indifferent."` with no idea WHICH word was the problem (finding 27); the
// rescan verifier check missed a template hit that survived because a
// single candidate paragraph is never "over budget" on its own, so
// "Ottie looked at him, really looked at him..." shipped after the model only
// swapped Ludo -> Ludovic and kept "really looked" (finding 28); accepted
// candidates introduced a straight quote the original lacked and a space
// inside a smart quote (finding 29); the closed-world check allowed the
// model to swap one cast member's name for another's since both were in
// `cast` (finding 30); and the flat 0.6-1.6x length ratio rejected every
// short template-phrase paragraph outright (finding 31). Generic fixture
// names only (Mara, Dov, Ilse).
import fs from 'node:fs';
import {
  collectRegenTargets,
  verifyRegeneratedParagraph,
  regenerateFlaggedParagraphs,
} from '../src/lib/regenerateLane.js';
import { normalizeModelTypography } from '../src/lib/crossChapterDedupe.js';

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

  // End-to-end: the lane itself rejects the still-broken candidate and ships
  // nothing. REGENLANE-1D (finding 37): keeps the ORIGINAL's own cast name
  // (Dov, unchanged) rather than swapping to a different cast member — this
  // isolates defect-remains from the now-fixed sentence-initial proper-noun
  // check, which would otherwise catch a name swap first.
  const stillBrokenSameName = 'Dov studied him, really looked at him, and said nothing at all that mattered.';
  const badMock = async () => stillBrokenSameName;
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

// ── 36. REGENLANE-1D: defects/mustNotContain come from the CHAPTER-level
// scan, grouped by paragraphIndex — never from a re-scan of the isolated
// paragraph. A budget-based detector (like a real template-family hit) only
// fires once the CHAPTER carries 2+ occurrences; a single paragraph in
// isolation is never "over budget" on its own — reproducing the live Ch.2
// bug where defects/mustNotContain shipped empty. ──
{
  const para1 = 'Mara stared blankly at the readout, unwilling to speak first.';
  const para2 = 'Ilse stared blankly at the door, waiting for someone else to move.';
  const chapterText = `${para1}\n\n${para2}`;

  const chapterBudgetDetector = (text) => {
    const body = String(text || '');
    const matches = body.match(/[^.\n]*stared blankly[^.\n]*\./gi) || [];
    if (matches.length < 2) return [];
    const last = matches[matches.length - 1].trim();
    return [{
      kind: 'template-family',
      sentence: last,
      reason: `template "stared blankly" (chapter budget 1; book spend ${matches.length}/${matches.length}) — replace the template phrase`,
      mustNotContain: ['stared blankly'],
    }];
  };

  check('36a. sanity: the detector finds nothing scanning paragraph 2 alone — an isolated re-scan would miss the chapter-budget defect',
    chapterBudgetDetector(para2).length === 0);

  const targets = collectRegenTargets(chapterText, { cast: CAST, extraDetectors: [chapterBudgetDetector] });
  const target2 = targets.find((t) => t.paragraph === para2);
  check('36b. collectRegenTargets still claims a target in paragraph 2 for the chapter-budget hit',
    !!target2, JSON.stringify(targets));
  check('36c. that target\'s defects carry the chapter-level finding, not an empty list',
    !!target2 && Array.isArray(target2.defects) && target2.defects.some((d) => d.reason.includes('stared blankly')),
    JSON.stringify(target2));
  check('36d. that target\'s mustNotContain carries the template phrase',
    !!target2 && target2.mustNotContain.includes('stared blankly'), JSON.stringify(target2));
}

// ── 37. REGENLANE-1D: a cast-name token counts as a proper noun wherever it
// sits, including sentence-initial — the general exemption exists so an
// ordinary sentence-opening word isn't mistaken for a proper noun, but a
// cast member's own canonical name is never ambiguous. Live: "Ottie looked at
// him…" -> "Ottilie looked at him…" was ACCEPTED because "Ottilie" opened its
// sentence and got stripped from scrutiny. ──
{
  const CAST_OTTILIE = ['Ottilie', 'Dov', 'Ilse'];
  const original = 'Ottie looked at him, and said nothing at all that mattered.';
  const swappedInitial = 'Ottilie looked at him, and said nothing at all that mattered.';

  const verdictWithCast = verifyRegeneratedParagraph(original, swappedInitial, { cast: CAST_OTTILIE });
  // REGENLANE-2C (finding 47b): check (4b)'s reason is now new-cast-name:<tok>
  // (was new-proper-noun:<tok>) so a live run can attribute which check fired.
  check('37a. a sentence-initial cast-name swap ("Ottie" -> "Ottilie") is rejected once cast is checked wherever it sits',
    verdictWithCast.reason === 'new-cast-name:Ottilie', JSON.stringify(verdictWithCast));

  const verdictNoCast = verifyRegeneratedParagraph(original, swappedInitial, {});
  check('37b. without cast passed, the general sentence-initial exemption still lets it through — confirms 37a is the new cast-aware check, not a change to the general rule',
    verdictNoCast.ok, JSON.stringify(verdictNoCast));

  const keepsNickname = 'Ottie studied him closely, and said nothing that mattered at all.';
  check('37c. a rewrite that keeps the original\'s own name/nickname untouched still passes',
    verifyRegeneratedParagraph(original, keepsNickname, { cast: CAST_OTTILIE }).ok,
    JSON.stringify(verifyRegeneratedParagraph(original, keepsNickname, { cast: CAST_OTTILIE })));
}

// ── 38. REGENLANE-1D: typography normalization runs before the guard, the
// SYSTEM prompt demands the complete paragraph and forbids new facts, and a
// new digit/number-word the original lacked is rejected. ──
{
  check('38a. normalizeModelTypography converts paired straight double quotes, word-internal apostrophes, and a leading opening quote to the manuscript convention',
    normalizeModelTypography(`"Hold on," Dov didn't move. 'Tis strange, he thought.`) === '“Hold on,” Dov didn’t move. ‘Tis strange, he thought.',
    normalizeModelTypography(`"Hold on," Dov didn't move. 'Tis strange, he thought.`));

  const orig = '“Wait,” Dov said, and no one moved at all, not even a fraction.';
  const asciiCandidate = `"Hold on," Dov said, and didn't move at all, not even a fraction.`;
  const waitDetector = (text) => {
    const m = String(text || '').match(/[^.]*\bWait\b[^.]*\./i);
    if (!m) return [];
    return [{ kind: 'template-family', sentence: m[0].trim(), reason: 'template "Wait" — replace with a concrete beat', mustNotContain: ['Wait'] }];
  };
  const asciiMock = async () => asciiCandidate;
  const asciiResult = await regenerateFlaggedParagraphs(orig, { cast: CAST, callLLM: asciiMock, project: { book_type: 'fiction' }, extraDetectors: [waitDetector] });
  check('38b. a candidate answered in ASCII quotes/apostrophes with no other typography change is ACCEPTED after normalisation, and ships smart-quoted',
    asciiResult.regenerated === 1 && asciiResult.text.includes('“Hold on,” Dov said, and didn’t move at all, not even a fraction.'),
    JSON.stringify(asciiResult));

  const noNumOrig = 'Her heartbeat felt urgent and irregular as she waited in the dark hallway.';
  const newNumberCandidate = 'Her heartbeat raced at thirty-seven beats per minute as she waited in the dark hallway.';
  const numVerdict = verifyRegeneratedParagraph(noNumOrig, newNumberCandidate, {});
  check('38c. a candidate that introduces a number the original lacked is rejected (new-number)',
    numVerdict.reason === 'new-number:thirty-seven', JSON.stringify(numVerdict));

  const ratioOrig = 'This is a plain original sentence of moderate length for testing the ratio log.';
  const ratioVerdict = verifyRegeneratedParagraph(ratioOrig, 'Nope.', {});
  check('38d. a length-ratio rejection carries the numeric ratio for logging',
    ratioVerdict.reason === 'length-ratio' && typeof ratioVerdict.ratio === 'number', JSON.stringify(ratioVerdict));

  const SRC = fs.readFileSync(new URL('../src/lib/regenerateLane.js', import.meta.url).pathname, 'utf8');
  check('38e. the lane SYSTEM prompt demands the COMPLETE paragraph', /COMPLETE paragraph/.test(SRC));
  check('38f. the lane SYSTEM prompt forbids new facts, numbers, backstory, or events', /do not add any fact, number/i.test(SRC));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
