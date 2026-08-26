// STYLEBUDGET-3 acceptance battery — template-family and opening-echo
// detection through the block-and-regenerate lane.
//
// STYLEBUDGET-1 put a per-book style ledger in the writer's PROMPT and
// STYLEBUDGET-2 hard-caps similes with a verified recast, but neither one
// touches a fixed phrase (ozone, "for now", a small smile) repeated past
// budget, or two chapters that open on the same image — both measured live
// on REDUX (small-smile family 20/3, "for now" 24/8, indifferent 23/5, all
// exhausted; opening echoes when checked precisely fall from BOOKGATE-2's
// loose 30 pairs to 7 real ones). This module detects both classes and hands
// them to REGENLANE-1 as lane targets; it never edits prose itself. Generic
// fixture names only (Mara, Dov, Ilse).
import fs from 'node:fs';
import {
  TEMPLATE_FAMILIES,
  TEMPLATE_FAMILIES_VERSION,
  findTemplateFamilyHits,
  computeFamilyBookSpend,
  makeTemplateFamilyDetector,
  findBookBudgetMismatches,
  findOpeningEchoes,
  makeOpeningEchoDetector,
} from '../src/lib/templateFamilies.js';
import { regenerateFlaggedParagraphs } from '../src/lib/regenerateLane.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

check('0. version', TEMPLATE_FAMILIES_VERSION === 'template-families-v1');

// ── 1. a family hit over chapter budget → target ──
{
  const text = 'The air smelled of ozone near the vents. Later, the scent of ozone returned as Mara crossed the deck.';
  const det = makeTemplateFamilyDetector({ priorProse: [] });
  const targets = det(text);
  check('1. a second same-chapter occurrence over the chapter budget is a target',
    targets.length === 1 && targets[0].kind === 'template-family' && targets[0].sentence.includes('scent of ozone'), JSON.stringify(targets));
}

// ── 2. under budget → none ──
{
  const text = 'The air smelled of ozone near the vents, and Mara said nothing at all about it.';
  const det = makeTemplateFamilyDetector({ priorProse: [] });
  check('2. a single occurrence under the chapter budget is not a target', det(text).length === 0);
}

// ── 3. exhausted book spend → every occurrence a target ──
{
  const priorProse = [
    'The air smelled of ozone near the console.',
    'Dov caught the scent of ozone again by the airlock.',
    'Ilse noted the smell of ozone once more near the reactor.',
  ]; // 3 prior "ozone" mentions == bookBudget
  const spend = computeFamilyBookSpend(priorProse);
  check('3a. computeFamilyBookSpend counts 3 prior ozone mentions', spend.ozone === 3, JSON.stringify(spend));
  const det = makeTemplateFamilyDetector({ priorProse });
  const text = 'Mara crossed the deck, and the air smelled of ozone one more time.';
  const targets = det(text);
  check('3b. a single occurrence is a target once the book budget is already spent', targets.length === 1, JSON.stringify(targets));
}

// ── 4. rescan of a single paragraph still-flagged when exhausted ──
{
  const priorProse = ['ozone. '.repeat(1) + 'The scent of ozone drifted through the corridor once.', 'The air smelled of ozone by the hatch.', 'Ilse caught the scent of ozone near the console.'];
  const det = makeTemplateFamilyDetector({ priorProse });
  const candidate = 'Ilse paused, and the scent of ozone lingered in the narrow corridor.';
  check('4. a rescanned candidate paragraph is still flagged when the book budget is exhausted (rejects as still-flagged)', det(candidate).length > 0, JSON.stringify(det(candidate)));
}

// ── 5. SLOP_BUDGETS/TEMPLATE_FAMILIES numbers agree ──
check('5. every key shared with SLOP_BUDGETS has the same book budget in both lists', findBookBudgetMismatches().length === 0, JSON.stringify(findBookBudgetMismatches()));

// ── 6. precise opening echo: a real contiguous 4-gram with >= 2 content words ──
{
  const chA = { chapterNumber: 1, text: 'The heat pressed down on the hull as Mara climbed the ladder toward the bridge slowly.' };
  const chB = { chapterNumber: 3, text: 'By dusk the heat pressed down on the hull again, and Dov climbed the ladder toward the bridge without a word.' };
  const echoes = findOpeningEchoes([chA, chB]);
  check('6a. a real contiguous 4-gram opening echo is found', echoes.length === 1 && echoes[0].earlier === 1 && echoes[0].later === 3, JSON.stringify(echoes));

  // the loose "of the <ship name>" case: words shared but never contiguous —
  // this is exactly what BOOKGATE-2's set-membership check over-reports.
  const chC = { chapterNumber: 1, text: 'Mara leaned against the gaudy hull of the Galactie, watching the stars wheel overhead in silence.' };
  const chD = { chapterNumber: 2, text: 'Dov walked the corridor of the ship, thinking how gaudy the old Galactie looked under morning light.' };
  check('6b. the loose non-contiguous case finds no echo', findOpeningEchoes([chC, chD]).length === 0);
}

// ── 6c-6e. STYLEBUDGET-3B: apostrophe-spacing artifacts don't manufacture
// content words out of a cast member's own name ──
{
  // A bible nickname rendered inline as a spacing artifact ("Mara ' Mar’
  // Voss") — live on REDUX: "Zinnia ' Zin' Quark" falsely echoed Ch.4 and
  // Ch.14 against Ch.1 with gram "zinnia ' zin' quark" because the old
  // tokenizer split the bare apostrophe into its own "word" and left a
  // trailing one glued to "zin'", so neither matched the cast set.
  const artifactA = { chapterNumber: 1, text: "Mara ' Mar’ Voss stared out the viewport at the drifting debris field for a long while." };
  const artifactB = { chapterNumber: 4, text: "Mara ' Mar’ Voss walked into the cargo bay and checked the manifest twice before signing." };
  check('6c. a spaced-apostrophe name artifact never manufactures a false echo', findOpeningEchoes([artifactA, artifactB], { castNames: ['Mara', 'Voss'] }).length === 0,
    JSON.stringify(findOpeningEchoes([artifactA, artifactB], { castNames: ['Mara', 'Voss'] })));

  // A cast member's possessive, repeated — still just the cast member, not
  // a new content word (name's / name’s both count as the cast name).
  const possA = { chapterNumber: 1, text: "Mara’s quarters were dark and quiet, the console glowing faint blue in the corner." };
  const possB = { chapterNumber: 2, text: "Mara’s quarters smelled of oil and dust, untouched since the crew left weeks ago." };
  check('6d. a cast member’s possessive never manufactures a false echo', findOpeningEchoes([possA, possB], { castNames: ['Mara'] }).length === 0,
    JSON.stringify(findOpeningEchoes([possA, possB], { castNames: ['Mara'] })));

  // A genuine repeated image survives the fix even when apostrophes and a
  // cast possessive are present elsewhere in the same openings.
  const realA = { chapterNumber: 1, text: "Mara’s hands shook as the engine room filled with the smell of ozone and rusted metal, and she couldn’t look away." };
  const realB = { chapterNumber: 5, text: "Dov’s hands shook as the engine room filled with the smell of ozone again, and he couldn’t look away either." };
  check('6e. a real repeated image still echoes with apostrophes/possessives present nearby', findOpeningEchoes([realA, realB], { castNames: ['Mara', 'Dov'] }).length === 1,
    JSON.stringify(findOpeningEchoes([realA, realB], { castNames: ['Mara', 'Dov'] })));
}

// ── 7. the later chapter is the target, the earlier never ──
{
  const priorOpenings = [{ chapterNumber: 1, text: 'The heat pressed down on the hull as Mara climbed the ladder toward the bridge slowly.' }];
  const det = makeOpeningEchoDetector({ priorOpenings });
  const laterText = 'By dusk the heat pressed down on the hull again, and Dov climbed the ladder toward the bridge without a word.';
  const laterTargets = det(laterText);
  check('7a. the later chapter is flagged', laterTargets.length === 1 && laterTargets[0].kind === 'opening-echo' && laterTargets[0].reason.includes('Ch.1'), JSON.stringify(laterTargets));

  const detNoPriors = makeOpeningEchoDetector({ priorOpenings: [] });
  check('7b. the earlier chapter itself is never a target (no priors to compare against)', detNoPriors(priorOpenings[0].text).length === 0);
}

// ── 8. regenerateFlaggedParagraphs regenerates a template-family paragraph, one verified call ──
{
  const CAST = ['Mara', 'Dov', 'Ilse'];
  const text = 'Mara crossed the deck quietly.\n\nThe air smelled of ozone near the vents. The scent of ozone returned as Mara paused by the console to listen.';
  const det = makeTemplateFamilyDetector({ priorProse: [] });
  let calls = 0;
  const mockLLM = async () => {
    calls += 1;
    return 'The air smelled sharp and metallic near the vents. The same acrid tang returned as Mara paused by the console to listen.';
  };
  const result = await regenerateFlaggedParagraphs(text, { cast: CAST, callLLM: mockLLM, project: { book_type: 'fiction' }, extraDetectors: [det] });
  check('8. a template-family paragraph is regenerated and accepted with exactly one LLM call',
    result.regenerated === 1 && calls === 1 && !result.text.includes('ozone'), JSON.stringify({ regenerated: result.regenerated, calls, skipped: result.skipped }));
}

// ── 9. [STYLEBUDGET-3] logs even at zero (wiring source-shape) ──
{
  const SW = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url).pathname, 'utf8');
  const RUNNER = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url).pathname, 'utf8');
  check('9a. sceneWriter.js logs [STYLEBUDGET-3] unconditionally (not inside an if that skips zero)',
    /console\.log\(`\[STYLEBUDGET-3\] writer-final: family targets \$\{templateFamilyDetector\(finalProse\)\.length\}, opening-echo targets \$\{openingEchoDetector\(finalProse\)\.length\}`\);/.test(SW));
  // NAMEGATE-1 (a later step in this same arc) adds a fifth detector, plus
  // its own zero-telemetry log lines, between here and the LLM-on/off
  // branch — widened from {0,400} to tolerate that gap growing rather than
  // pin it to a fixed size.
  check('9b. manuscriptPolishRunner.js logs [STYLEBUDGET-3] unconditionally, before the LLM-on/off branch',
    /console\.log\(`\[STYLEBUDGET-3\] Ch\.\$\{chNum\}: family targets[\s\S]{0,300}opening-echo targets[\s\S]{0,300}`\);[\s\S]{0,900}?if \(allowLLM/.test(RUNNER));
  // FRAGBUDGET-1 (a later step in this same arc) adds a fourth detector to
  // the same extraDetectors arrays — this only needs to confirm templateFamilyDetector
  // and openingEchoDetector are both present, not that the array has exactly these two.
  check('9c. both lane call sites wire the new detectors into extraDetectors',
    SW.includes('templateFamilyDetector, openingEchoDetector') &&
    (RUNNER.match(/extraDetectors: \[detectBannedVocabulary, templateFamilyDetector, openingEchoDetector/g) || []).length === 2);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
