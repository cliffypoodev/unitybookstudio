// NAMEGATE-1 acceptance battery (carried finding 35b) — a person the story
// bible never established is a regeneration target, then a gate entry. A
// naive "every proper noun must be in the bible" test flags common
// capitalized nouns constantly (a ship name, "Nebula", "Hyperspace"); the
// precision this needs is PERSON-SIGNAL, not proper-noun. src/lib/nameGate.js
// and src/lib/regenerateLane.js have no @/-aliased imports (verified: fully
// bare-Node importable) so both are exercised directly. exportSafetyGate.js
// has @/-aliased transitive dependencies (bibliographyGenerator.js) and is
// verified via source-shape reads, the way nfexportbib1 checks it. All
// fixtures are invented — Mara/Dov/Ilse, Port Ellis/Dr. Hale/Dr. Vance
// (master-plan fixture set) plus an invented generic surname (Henderson,
// no relation to any real book) for the unknown-person cases.
import fs from 'node:fs';
import {
  NAME_GATE_VERSION, NAMEGATE_HARD_BLOCK, PERSON_VERBS, PERSON_PARTS,
  buildFictionEvidence, findUnknownPersons, makeUnknownPersonDetector,
} from '../src/lib/nameGate.js';
import { verifyRegeneratedParagraph, collectRegenTargets } from '../src/lib/regenerateLane.js';
import { harvestCastNames } from '../src/lib/pronounLock.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── fixture bible ──
const CAST = ['Mara', 'Dov', 'Ilse'];
const fictionProject = {
  title: 'Invented Fixture Novel',
  book_type: 'fiction',
  characters_md: 'Mara is calm and resourceful, the group\'s de facto leader. Dov is her younger brother. Ilse is the ship\'s engineer.',
  world_md: 'Port Ellis is a coastal trading post. Dr. Vance runs the town\'s only clinic and treats everyone who arrives by ferry.',
  canon_md: 'Dr. Hale is mentioned once in the ship\'s log as the previous captain.',
};
const nonfictionProject = { title: 'Invented Fixture Guide', book_type: 'nonfiction' };

check('0. NAME_GATE_VERSION / NAMEGATE_HARD_BLOCK', NAME_GATE_VERSION === 'name-gate-v1' && NAMEGATE_HARD_BLOCK === false);

const evidence = buildFictionEvidence(fictionProject, { chapters: [] });

// ── 1. an established cast member with every signal → nothing ──
{
  const prose = '"Wait," said Mara. Mara\'s hand trembled on the rail. Mara looked at the horizon.';
  const unknowns = findUnknownPersons(prose, { evidence, cast: CAST });
  check('1. established cast member (every signal type) is not flagged', unknowns.length === 0, JSON.stringify(unknowns));
}

// ── 2. "Dr. Vance" established via a _md field only (not cast) → nothing ──
{
  const prose = 'Dr. Vance frowned at the readings. "I need more time," said Dr. Vance, setting down the instrument.';
  const unknowns = findUnknownPersons(prose, { evidence, cast: CAST });
  check('2. a person named only in a bible _md field (Dr. Vance) is not flagged', unknowns.length === 0, JSON.stringify(unknowns));
}

// ── 3. unknown person with a dialogue tag → flagged, count right ──
{
  const prose = '"Wait," said Henderson. Henderson called out again, but nobody answered.';
  const unknowns = findUnknownPersons(prose, { evidence, cast: CAST });
  check('3. an unknown person with a dialogue tag is flagged', unknowns.length === 1 && unknowns[0].name === 'Henderson', JSON.stringify(unknowns));
  check('3b. mention count is correct (2 signal hits)', unknowns[0]?.count === 2, JSON.stringify(unknowns));
  check('3c. signal kind recorded is verb-name/name-verb', unknowns[0]?.signals?.some((s) => s === 'verb-name' || s === 'name-verb'), JSON.stringify(unknowns));
}

// ── 4. honorific form ("Mr. <Name>") → flagged ──
{
  const prose = 'Mr. Henderson watched them from the doorway, his jaw tight.';
  const unknowns = findUnknownPersons(prose, { evidence, cast: CAST });
  check('4. an honorific form (Mr. Henderson) is flagged', unknowns.length === 1 && unknowns[0].name === 'Henderson', JSON.stringify(unknowns));
  check('4b. honorific signal recorded', unknowns[0]?.signals?.includes('honorific'), JSON.stringify(unknowns));
}

// ── 5. unknown name appearing ONLY sentence-initially with one signal → NOT flagged ──
{
  const prose = 'The dock creaked underfoot. Really looked at him for a long moment before turning away.';
  const unknowns = findUnknownPersons(prose, { evidence, cast: CAST });
  check('5. a sentence-initial single-signal token ("Really looked") is NOT flagged', unknowns.length === 0, JSON.stringify(unknowns));
}

// ── 6. sci-fi/common capitalised nouns with no person signal → nothing ──
{
  const prose = 'The Nebula drifted past Hyperspace relay stations. Her vest was reinforced Kevlar. The freighter Meridian docked at dawn.';
  const unknowns = findUnknownPersons(prose, { evidence, cast: CAST });
  check('6. capitalised nouns with zero person signal (Nebula/Hyperspace/Kevlar/Meridian) are never candidates', unknowns.length === 0, JSON.stringify(unknowns));
}

// ── 7. place name with a verb-like follow — document the boundary ──
{
  // Sentence-initial, single signal (name-verb) — same shape as check 5. Not
  // in the bible, but not flagged: one verb-like follow alone is exactly
  // the ambiguous case the precision rule exists for.
  const soleMention = 'Abilene came into view as the fog lifted.';
  const notInBible = findUnknownPersons(soleMention, { evidence, cast: CAST });
  check('7a. a place with one verb-like follow, sentence-initial, not in the bible: NOT flagged (ambiguous)', notInBible.length === 0, JSON.stringify(notInBible));

  // The same name gets a SECOND, non-sentence-initial signal elsewhere
  // (a body-part possessive — a place does not have a shoulder) — now two
  // signal kinds and not all-sentence-initial, so it IS flagged.
  const withPossessive = 'Abilene came into view as the fog lifted. Later, Abilene\'s shoulder tensed at the sound.';
  const flaggedNow = findUnknownPersons(withPossessive, { evidence, cast: CAST });
  check('7b. the same name with an added body-part possessive elsewhere: flagged', flaggedNow.length === 1 && flaggedNow[0].name === 'Abilene', JSON.stringify(flaggedNow));

  // When the name IS in the bible, neither shape is flagged, regardless of
  // signal count.
  const abileneProject = { ...fictionProject, world_md: fictionProject.world_md + ' Abilene is a small inland town shown on the map.' };
  const abileneEvidence = buildFictionEvidence(abileneProject, { chapters: [] });
  const inBible = findUnknownPersons(withPossessive, { evidence: abileneEvidence, cast: CAST });
  check('7c. once Abilene is in the bible, neither occurrence is flagged', inBible.length === 0, JSON.stringify(inBible));
}

// ── 8. cast-name possessive stripped ──
{
  const prose = "Mara's hand trembled on the rail as the ship pitched.";
  const unknowns = findUnknownPersons(prose, { evidence, cast: CAST });
  check('8. a cast member\'s possessive form (Mara\'s) is recognized as the cast member, not flagged', unknowns.length === 0, JSON.stringify(unknowns));
}

// ── 9. detector returns one target per name, at the first signal paragraph ──
{
  const detector = makeUnknownPersonDetector({ project: fictionProject, cast: CAST, chapters: [] });
  const prose = [
    'By the door, Henderson stood watching the harbor lights.',
    'Nothing happened for a long while in the quiet room.',
    'Near the window, Henderson called out again, but the hall stayed silent.',
  ].join('\n\n');
  const targets = detector(prose);
  check('9. exactly one target for a name mentioned across multiple paragraphs', targets.length === 1, JSON.stringify(targets));
  check('9b. the target sentence is the FIRST paragraph carrying the signal', targets[0]?.sentence?.startsWith('By the door, Henderson stood'), targets[0]?.sentence);
  check('9c. reason and mustNotContain name the person', targets[0]?.reason === 'unknown-person:Henderson' && targets[0]?.mustNotContain?.[0] === 'Henderson', JSON.stringify(targets[0]));
}

// ── 10. defect-remains rejects a candidate still containing the name; accepts a role replacement ──
{
  const original = 'In the doorway, Henderson looked at the others and said nothing. His jaw was tight, and nobody spoke for a long moment inside the quiet hall.';
  const stillHasName = 'In the doorway, Henderson stared at the others and said nothing. His jaw was tight, and nobody moved for a long moment inside the quiet hall.';
  const replacedWithRole = 'In the doorway, the stranger stared at the others and said nothing. His jaw was tight, and nobody moved for a long moment inside the quiet hall.';

  const rejected = verifyRegeneratedParagraph(original, stillHasName, { mustNotContain: ['Henderson'] });
  check('10a. a candidate that still contains the unknown name is rejected (defect-remains)', rejected.ok === false && rejected.reason === 'defect-remains', JSON.stringify(rejected));

  const accepted = verifyRegeneratedParagraph(original, replacedWithRole, { mustNotContain: ['Henderson'] });
  check('10b. a candidate that replaces the name with a role is accepted', accepted.ok === true, JSON.stringify(accepted));

  // And the detector's own output feeds collectRegenTargets with that exact
  // mustNotContain — the rescan path (regenerateFlaggedParagraphs) reuses
  // the same extraDetectors list, so this is not a special case.
  const detector = makeUnknownPersonDetector({ project: fictionProject, cast: CAST, chapters: [] });
  const targets = collectRegenTargets(original, { cast: CAST, extraDetectors: [detector] });
  check('10c. collectRegenTargets claims the paragraph via the detector, with mustNotContain set', targets.length === 1 && targets[0].mustNotContain.includes('Henderson'), JSON.stringify(targets));
}

// ── 11. export gate wiring (source-shape — exportSafetyGate.js is @/-aliased) ──
{
  const GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
  check('11a. imports findUnknownPersons + buildFictionEvidence + NAMEGATE_HARD_BLOCK from nameGate.js',
    GATE.includes("from './nameGate.js'") && GATE.includes('findUnknownPersons') && GATE.includes('buildFictionEvidence') && GATE.includes('NAMEGATE_HARD_BLOCK'));
  check('11b. zero-telemetry-included per-chapter scan line present',
    GATE.includes('[NAMEGATE-1] Gate scan: Ch.${ch?.chapter_number} ${unknowns.length} unknown person(s)'));
  check('11c. warning entry text is exact: NAMEGATE-1: "<Name>" (<mentions> mention(s), <signals> signal(s)) is not in the bible or cast',
    GATE.includes('NAMEGATE-1: "${u.name}" (${u.mentions} mention(s), ${u.count} signal(s)) is not in the bible or cast'));
  const blockStart = GATE.indexOf("// NAMEGATE-1 (finding 35b)");
  const blockEnd = GATE.indexOf('// STYLEBUDGET-1', blockStart);
  const block = blockStart >= 0 && blockEnd > blockStart ? GATE.slice(blockStart, blockEnd) : '';
  check('11d. the whole block is gated on isFictionProject(project) — nonfiction untouched', block.includes('if (isFictionProject(project))'), block.slice(0, 200));
  check('11e. hardFailures only populated when NAMEGATE_HARD_BLOCK is true, with REJECT_REGENERATE',
    block.includes('if (NAMEGATE_HARD_BLOCK)') && block.includes("recommendedAction: 'REJECT_REGENERATE'") &&
    /hardFailures\.push\(/.test(block) && /warnings\.push\(/.test(block));
  check('11f. NAMEGATE-1B: the gate cast is sheet-only (harvestCastNames with no prose bodies)',
    /harvestCastNames\(options\?\.project\?\.characters_md,\s*\[\]\)/.test(block));
  check('11g. NAMEGATE-1B: the gate evidence is bible-only (chapters: [])',
    /buildFictionEvidence\(project,\s*\{\s*chapters:\s*\[\]\s*\}\)/.test(block));
}

// ── 12. nonfiction project → no NAMEGATE line at all (runtime, via makeUnknownPersonDetector) ──
{
  const nfDetector = makeUnknownPersonDetector({ project: nonfictionProject, cast: [], chapters: [] });
  const targets = nfDetector('Henderson said something nobody in the bible ever established.');
  check('12. a nonfiction project gets a no-op detector (never flags, never scans)', targets.length === 0, JSON.stringify(targets));
}

// ── 13. zero-telemetry: a clean chapter with no unknown persons still reports U=0 ──
{
  const detector = makeUnknownPersonDetector({ project: fictionProject, cast: CAST, chapters: [] });
  const targets = detector('Mara and Dov walked to the harbor. Ilse was already waiting by the boat.');
  check('13. a clean chapter (only cast members) produces zero targets', targets.length === 0, JSON.stringify(targets));
}

// ── PERSON_VERBS / PERSON_PARTS sanity (exported closed lists) ──
check('14. PERSON_VERBS and PERSON_PARTS are non-empty exported closed lists', Array.isArray(PERSON_VERBS) && PERSON_VERBS.length > 10 && Array.isArray(PERSON_PARTS) && PERSON_PARTS.length > 5);

// ── 15. NAMEGATE-1B (finding 54a): sheet-only cast still catches a name the prose-augmented harvest would have hidden ──
{
  const heavyMentionProse = [
    'The fence line ran for miles behind the old barn.',
    ...Array.from({ length: 13 }, (_, i) => `Henderson walked past the fence post again near marker ${i + 1}, saying nothing.`),
    'Everyone in the valley knew that Henderson walked that same line every single morning without fail.',
  ].join(' ');

  const proseAugmentedCast = harvestCastNames(fictionProject.characters_md, [heavyMentionProse]);
  check('15a. the OLD prose-augmented harvest WOULD have hidden Henderson as cast (>= 12 mentions, no lowercase twin)',
    proseAugmentedCast.includes('Henderson'), JSON.stringify(proseAugmentedCast));

  const sheetOnlyCast = harvestCastNames(fictionProject.characters_md, []);
  check('15b. the sheet-only harvest (NAMEGATE-1B) does NOT include Henderson',
    !sheetOnlyCast.includes('Henderson'), JSON.stringify(sheetOnlyCast));

  const withProseAugmentedCast = findUnknownPersons(heavyMentionProse, { evidence, cast: proseAugmentedCast });
  check('15c. with the OLD prose-augmented cast, Henderson is NOT flagged — this is the bug finding 54 describes',
    withProseAugmentedCast.length === 0, JSON.stringify(withProseAugmentedCast));

  const withSheetOnlyCast = findUnknownPersons(heavyMentionProse, { evidence, cast: sheetOnlyCast });
  check('15d. with the sheet-only cast (NAMEGATE-1B fix), Henderson IS flagged, mentions >= 14',
    withSheetOnlyCast.length === 1 && withSheetOnlyCast[0].name === 'Henderson' && withSheetOnlyCast[0].mentions >= 14,
    JSON.stringify(withSheetOnlyCast));
}

// ── 16. NAMEGATE-1B (finding 54b): evidence is bible-only — a name in a chapter's own beats does not protect it ──
{
  const chapterWithBeatsOnly = {
    chapter_number: 3,
    title: 'A Quiet Morning',
    beat_summary: 'Henderson confronts the group about the missing key.',
    summary: 'Henderson demands answers.',
    scene_beats_json: JSON.stringify({ scenes: [{ description: 'Henderson enters and accuses everyone in the room.' }] }),
  };
  const evidenceIgnoringChapterBeats = buildFictionEvidence(fictionProject, { chapters: [chapterWithBeatsOnly] });
  check('16a. buildFictionEvidence does not fold a name sitting only in a chapter\'s title/beat_summary/summary/scene_beats_json into evidence',
    !evidenceIgnoringChapterBeats.includes('henderson'), evidenceIgnoringChapterBeats.slice(0, 200));

  const prose16 = [
    'The fence line ran for miles behind the old barn.',
    ...Array.from({ length: 3 }, (_, i) => `Henderson looked at the group and said nothing at post ${i + 1}.`),
    'Everyone remembered that Henderson looked away first, every single time.',
  ].join(' ');
  const sheetOnlyCast16 = harvestCastNames(fictionProject.characters_md, []);
  const flagged16 = findUnknownPersons(prose16, { evidence: evidenceIgnoringChapterBeats, cast: sheetOnlyCast16 });
  check('16b. a name that exists only in a chapter\'s own beats (never in the bible) is still flagged when it appears in prose',
    flagged16.length === 1 && flagged16[0].name === 'Henderson', JSON.stringify(flagged16));
}

// ── 17. NAMEGATE-1B (finding 55): mentions and signal count are tracked independently, and both surface in the reason ──
{
  const mixedProse = [
    '"Wait," said Henderson. Henderson looked at the door.',
    'Henderson\'s coat hung by the door, forgotten in the rush.',
    'No one else touched Henderson\'s coat all winter.',
  ].join(' ');
  const sheetOnlyCast17 = harvestCastNames(fictionProject.characters_md, []);
  const found17 = findUnknownPersons(mixedProse, { evidence, cast: sheetOnlyCast17 });
  check('17a. mentions (whole-word occurrences) exceed count (signal hits) when some mentions carry no person signal',
    found17.length === 1 && found17[0].mentions === 4 && found17[0].count === 2, JSON.stringify(found17));

  const GATE17 = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
  check('17b. the export-gate reason string interpolates both u.mentions and u.count',
    GATE17.includes('${u.mentions} mention(s), ${u.count} signal(s)'));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
