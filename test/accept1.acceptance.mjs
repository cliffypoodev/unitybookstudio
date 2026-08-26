// ACCEPT-1 acceptance battery — scripts/ubs-accept.mjs, the plan §12 bar as
// a machine-checked report.
//
// buildAcceptanceReport({project, chapters, runState}) is pure: it takes
// already-fetched data and returns a §12 PASS/FAIL/N/A report by calling the
// real detector functions those criteria are defined against
// (runPreExportSafetyGate, scanMalformedSentences, characterStateLedger,
// aiSlopReduction, templateFamilies, crossChapterDedupe, closedWorldText,
// bibliographyGenerator, nameGate, storyEntityOwnership). It performs no
// network I/O and never calls a store write method — fetchProjectMaterial is
// the only place this script talks to the store, and it only ever calls
// NovelProject.get / Chapter.filter (read-only), matching the plan's "never
// writes to the store" requirement.
//
// Both functions have transitive "@/" imports (the detector modules
// buildAcceptanceReport lazily imports), so — matching
// test/runner1.acceptance.mjs's established precedent for this exact
// architecture — this file self-registers the alias loader via
// node:module's register().
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
register('../tests/helpers/aliasLoader.mjs', import.meta.url);
const { buildAcceptanceReport, fetchProjectMaterial, UBS_ACCEPT_VERSION } = await import('../scripts/ubs-accept.mjs');
const { createStoreClient } = await import('../scripts/ubs-run.mjs');
const { harvestCastNames: harvestCastNamesForTest } = await import('../src/lib/pronounLock.js');

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const withCapturedConsole = async (fn) => {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  let result;
  try {
    result = await fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
  return result;
};

function findCriterion(report, key) {
  return report.criteria.find((c) => c.key === key);
}

// ── fixture builders ──
// harvestCastNames only recognizes heading/numbered/bold ENTRY lines (a
// dash-bulleted list, or an all-caps initialism like "JB", both fall through
// its sheet-header regex) — this bible is shaped the way the real gate
// expects a character sheet to look.
const CHAR_BIBLE = '## Ottie\nEngineer aboard the ship.\n\n## Ludo\nPilot.\n\n## Yusra\nNavigator.';
function makeChapter(num, title, contentMd, extra = {}) {
  return { id: `ch-${num}`, chapter_number: num, title, content_md: contentMd, ...extra };
}
const SCENES = [
  ['Ottie tightened the last bolt on the manifold and wiped grease from her hands.', 'The engine hummed back to life as Ludo watched from the doorway, arms crossed.'],
  ['Yusra checked the manifest twice before nodding at the crew assembled near the hatch.', 'The corridor lights flickered once, then steadied, and everyone kept walking.'],
  ['A cold wind cut across the landing pad as the ship settled onto its struts.', 'Ludo counted the crates twice, satisfied, and signaled the all-clear to the tower.'],
  ['The reactor core glowed a dull amber, steady and quiet under its casing.', 'Ottie logged the readings in the battered notebook she always carried.'],
  ['Static crackled over the comm before Yusra finally got a clean signal through.', 'The distant voice on the other end sounded relieved, almost cheerful.'],
  ['Rain streaked the viewport as the shuttle descended through the low clouds.', 'Nobody spoke until the wheels touched the runway with a soft thud.'],
  ['The market square buzzed with vendors calling out prices in three languages.', 'Ludo haggled over a crate of dried fruit while Ottie watched the crowd.'],
  ['A thin trail of smoke rose from the old workshop at the edge of the yard.', 'Yusra frowned and quickened her pace toward the source of it.'],
  ['The stars wheeled slowly overhead as the night watch rotated at the console.', 'Ottie poured two mugs of the bitter recycled coffee and handed one over.'],
  ['Dust settled over the abandoned outpost, undisturbed for what looked like years.', 'Ludo ran a gloved hand along the dead control panel, thoughtful.'],
  ['The old radio crackled to life with a burst of unfamiliar chatter.', 'Yusra leaned closer, straining to make out the words beneath the static.'],
  ['A quiet settled over the bridge as the ship slipped into the long dark.', 'Ottie watched the last light of the home system fade behind them.'],
];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
function buildCleanFictionChapters() {
  const chapters = [makeChapter(0, 'Copyright', 'Copyright (c) 2026. All rights reserved. This is a work of fiction.')];
  for (let i = 1; i <= 12; i++) {
    const [a, b] = SCENES[i - 1];
    chapters.push(makeChapter(i, `Chapter ${i}`,
      `${a} It was the ${ORDINALS[i - 1]} stop of a long journey neither of them had planned to take together this way.\n\n${b} Nobody spoke of it again, and the quiet held for a good while after that ${ORDINALS[i - 1]} particular stretch of road.`));
  }
  return chapters;
}
const CLEAN_FICTION_PROJECT = { book_type: 'fiction', characters_md: CHAR_BIBLE, title: 'Test Fiction Book' };

// ── 1. a clean fiction fixture → all PASS, effectively exit 0 ──
{
  const chapters = buildCleanFictionChapters();
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: CLEAN_FICTION_PROJECT, chapters }));
  check('1. clean fiction fixture: every scored criterion PASSes', report.allPass, JSON.stringify(report.criteria.filter((c) => c.status === 'FAIL')));
  check('1b. the summary line matches the scored/passed counts', report.summary === `ACCEPTANCE: ${report.passedCount}/${report.scoredCount} criteria PASS`);
  check('1c. N/A criteria are present (this fixture has several) but excluded from scoring', report.criteria.some((c) => c.status === 'N/A') && report.scoredCount < report.criteria.length);
}

// ── 2. one injected departed-character action → that criterion FAILs (others still run) ──
{
  const chapters = [
    // buildCharacterState only folds in a chapter whose text exceeds 200
    // chars — both chapters below are deliberately padded past that floor.
    makeChapter(1, 'Chapter 1', 'Yusra pressed the wrench into Ludo’s hands. “You need someone else.” They watched Yusra go, a small figure against the wheat.\n\nThe road took him past the silo, and Yusra was gone. The yard felt larger and quieter than it had any right to feel that particular afternoon, long after the dust had settled behind him.'),
    makeChapter(2, 'Chapter 2', 'The store smelled of feed and coffee that morning, the same as it always did on a slow weekday. Yusra fidgeted near the counter, his eyes darting toward the exit every few seconds.\n\nOttie rang up the order without a word, still thinking about the wrench Yusra had left behind on the workbench.'),
  ];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: CLEAN_FICTION_PROJECT, chapters }));
  const c = findCriterion(report, 'departed-character');
  check('2. an injected departed-character action makes DEPARTED_CHARACTER_ACTIVE FAIL', c.status === 'FAIL', JSON.stringify(c));
  check('2b. the report as a whole is not all-pass', !report.allPass);
}

// ── 3. simile density over budget → FAILs with the number shown ──
{
  const hot = ('It moved like a snake. It hissed as if alive. It shone like a coin. It struck like a whip. '
    + 'It circled like a shadow. It waited as if patient. It slid like oil. It coiled like rope. '.repeat(3));
  const chapters = [makeChapter(1, 'Chapter 1', hot.repeat(2))];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: CLEAN_FICTION_PROJECT, chapters }));
  const c = findCriterion(report, 'simile-density');
  check('3. simile density over budget FAILs', c.status === 'FAIL', JSON.stringify(c));
  check('3b. the FAIL detail names the measured book-wide number', /book-wide \d+(\.\d+)?\/1k/.test(c.detail), c.detail);
}

// ── 4. NF fixture without a Sources chapter → FAILs ──
{
  const nfProject = { book_type: 'nonfiction', characters_md: '', title: 'Test NF Book' };
  const chapters = [
    makeChapter(1, 'Introduction', 'The excavation began quietly, without any of the fanfare later accounts would claim it deserved by the crew.'.repeat(3)),
    makeChapter(2, 'The Discovery', 'Weeks into the dig, the first real find emerged from the packed earth near the northern wall of the site.'.repeat(3)),
  ];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: nfProject, chapters }));
  const c = findCriterion(report, 'sources-present');
  check('4. NF fixture with no Sources chapter FAILs', c.status === 'FAIL', JSON.stringify(c));
  check('4b. fiction-only criteria correctly report N/A for this NF fixture', findCriterion(report, 'namegate').status === 'N/A');
}

// ── 4c. NF fixture WITH a proper Sources chapter → PASSes ──
{
  const nfProject = { book_type: 'nonfiction', characters_md: '', title: 'Test NF Book' };
  const sourcesBody = [
    '- Hale, M. "Excavation Records of Port Ellis." Coastal Archive, 1971.',
    '- Reyes, T. "Harbor District Findings." University Press, 1974.',
    '- Nkemelu, D. https://example.org/harbor-artifacts-1972',
    '1. State Archive Bulletin No. 42, "Recovered Artifacts," 1975.',
  ].join('\n');
  const chapters = [
    makeChapter(1, 'Introduction', 'The excavation began quietly, without any of the fanfare later accounts would claim it deserved by the crew.'.repeat(3)),
    makeChapter(2, 'Sources', sourcesBody),
  ];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: nfProject, chapters }));
  const c = findCriterion(report, 'sources-present');
  check('4c. NF fixture with a real 4-entry Sources chapter PASSes', c.status === 'PASS', JSON.stringify(c));
}

// ── 5. anthology fixture with a fenced foreign atom → FAILs ──
{
  const anthologyProject = {
    book_type: 'nonfiction', project_type: 'anthology', anthology_theme: 'lost expeditions', characters_md: '',
    // research_md is the field the live app (and this script) actually
    // resolves prose from — resolveResearchContent treats anything under
    // 600 chars as a stub, so this is deliberately padded well past that.
    research_md: 'Dr. Alaric Voss led the harbor excavation in Port Ellis during the summer months of that year, cataloguing dozens of artifacts recovered from the silted harbor floor and the surrounding warehouses that once served the old shipping trade in that stretch of coastline, work that would later be cited in three separate regional histories of the port.\n\nProfessor Ines Calloway surveyed the ridge near Blackwater Pass, mapping the old mining tunnels in careful detail over several weeks, noting the collapsed sections and the equipment left behind by crews who had abandoned the site decades earlier without any formal record of why, a mystery the survey team could only partially resolve from surviving company ledgers.',
  };
  const chapters = [
    makeChapter(1, 'Case A: The Harbor Excavation', 'x'.repeat(150), { beat_summary: 'Dr. Alaric Voss led the harbor excavation in Port Ellis.' }),
    makeChapter(2, 'Case B: The Mountain Survey', 'x'.repeat(150), { beat_summary: 'Professor Ines Calloway surveyed the ridge near Blackwater Pass.' }),
  ];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: anthologyProject, chapters }));
  const c = findCriterion(report, 'cross-case-atoms');
  check('5. an anthology fixture with cross-referencing cases FAILs cross-case-atoms', c.status === 'FAIL', JSON.stringify(c));
  check('5b. the FAIL detail names which chapters had foreign paragraphs fenced', /Ch\.1:.*Ch\.2:|Ch\.2:.*Ch\.1:/.test(c.detail), c.detail);
}

// ── 5c. a single-case anthology-shaped project (no cross-references) does not FAIL cross-case-atoms ──
{
  const anthologyProject = {
    book_type: 'nonfiction', project_type: 'anthology', anthology_theme: 'lost expeditions', characters_md: '',
    research_md: 'Dr. Alaric Voss led the harbor excavation in Port Ellis during the summer months of that year, cataloguing dozens of artifacts found near the old pier and logging each one in a leather-bound notebook that later became part of the state archive, alongside photographs and hand-drawn site maps recording exactly where every item had been recovered from the silted harbor floor, a record that archivists still consult today when questions arise about the site chronology, since so much of the original excavation paperwork was lost when the regional office relocated twice in the decades that followed the original dig, leaving the notebook as one of the few surviving primary sources historians can still cite directly.',
  };
  const chapters = [makeChapter(1, 'Case A: The Harbor Excavation', 'x'.repeat(150), { beat_summary: 'Dr. Alaric Voss led the harbor excavation in Port Ellis.' })];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: anthologyProject, chapters }));
  const c = findCriterion(report, 'cross-case-atoms');
  check('5c. a single-case anthology fixture (nothing foreign to fence) PASSes cross-case-atoms', c.status === 'PASS', JSON.stringify(c));
}

// ── 6. N/A lines never affect the exit code / allPass ──
{
  const chapters = buildCleanFictionChapters();
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: CLEAN_FICTION_PROJECT, chapters }));
  const naCount = report.criteria.filter((c) => c.status === 'N/A').length;
  check('6. this fixture has N/A criteria', naCount > 0, String(naCount));
  check('6b. allPass is computed only from scored (non-N/A) criteria, matching passedCount/scoredCount', report.allPass === (report.passedCount === report.scoredCount) && report.scoredCount === report.criteria.length - naCount);
}

// ── 7. --json output round-trips the full report object (main's own two-line write, exercised directly) ──
{
  const chapters = buildCleanFictionChapters();
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: CLEAN_FICTION_PROJECT, chapters }));
  const tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ubs-accept1-')), 'out.json');
  fs.writeFileSync(tmpFile, JSON.stringify(report, null, 2));
  const roundTripped = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
  check('7. the written --json file round-trips criteria/allPass/summary intact',
    Array.isArray(roundTripped.criteria) && roundTripped.criteria.length === report.criteria.length
    && roundTripped.allPass === report.allPass && roundTripped.summary === report.summary);
}

// ── 8. the report never calls the store's write methods ──
{
  // 8a. client-level spy: fetchProjectMaterial only ever calls get/filter/loadRunState.
  const writeCalls = [];
  const fakeStore = {
    NovelProject: { get: async (id) => ({ id, book_type: 'fiction', characters_md: CHAR_BIBLE }), update: async (...args) => { writeCalls.push(['NovelProject.update', ...args]); } },
    Chapter: { filter: async () => buildCleanFictionChapters(), update: async (...args) => { writeCalls.push(['Chapter.update', ...args]); } },
  };
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ubs-accept1-data-'));
  const material = await fetchProjectMaterial({ store: fakeStore, projectId: 'proj-1', dataDir });
  check('8a. fetchProjectMaterial never calls a store update method (client-level spy)', writeCalls.length === 0, JSON.stringify(writeCalls));
  check('8b. fetchProjectMaterial returns the fetched project/chapters', material.project.book_type === 'fiction' && Array.isArray(material.chapters) && material.chapters.length > 0);

  // 8c. wire-level capture: createStoreClient with a fake fetchImpl, proving the actual HTTP calls issued never target /update/.
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options?.method });
    if (url.includes('/get/')) return { ok: true, json: async () => ({ id: 'proj-1', book_type: 'fiction', characters_md: CHAR_BIBLE }) };
    return { ok: true, json: async () => buildCleanFictionChapters() };
  };
  const wireStore = createStoreClient({ baseUrl: 'http://127.0.0.1:5180', token: 'test-token', fetchImpl });
  await fetchProjectMaterial({ store: wireStore, projectId: 'proj-1', dataDir });
  check('8c. the real wire-level calls fetchProjectMaterial issues never target an /update/ URL', calls.length > 0 && calls.every((c) => !c.url.includes('/update/')), JSON.stringify(calls));
}

// ── 9. version constant present ──
check('9. UBS_ACCEPT_VERSION is exported', typeof UBS_ACCEPT_VERSION === 'string' && UBS_ACCEPT_VERSION.length > 0);

// ── 10. ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS: a plain-paragraph
// character bio (no headings/lists/bold — harvestCastNames' sheet-only
// regex yields nothing for this shape) must NOT silently disable departed-
// character detection — the cast has to fall back to prose discovery. ──
{
  const plainBioProject = { book_type: 'fiction', characters_md: 'Priya is the dive coordinator. Marcus is the boat captain.', title: 'Plain Bio Book' };
  // harvestCastNames' prose-prominence fallback (Source 2) only admits a
  // name once it appears at least 12 times across the supplied bodies — a
  // real threshold this fixture has to actually clear, not merely gesture
  // at, for the fix to be exercised rather than accidentally short-circuited
  // by a different code path.
  const priyaIntro = 'Priya had run this boat longer than anyone else aboard. Priya knew every reef by name, and Priya never once forgot a diver underwater. Everyone on the crew trusted Priya completely, and Priya had earned every bit of it over the years. Priya kept a logbook of every dive, and Priya read it over most evenings before sleep, the way Priya always had since her very first season on the water.';
  const chapters = [
    makeChapter(1, 'Chapter 1', `${priyaIntro}\n\nPriya pressed the regulator into Marcus’s hands. “You need someone else.” They watched Priya go, a small figure against the pier.\n\nThe dock swallowed her outline, and Priya was gone. The boat felt larger and quieter than it had any right to feel that particular morning, long after the wake had settled.`),
    makeChapter(2, 'Chapter 2', 'The shop smelled of salt and diesel that morning, the same as it always did on a slow weekday. Priya fidgeted near the counter, her eyes darting toward the exit every few seconds.\n\nMarcus rang up the order without a word, still thinking about the regulator Priya had left behind on the bench.'),
  ];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: plainBioProject, chapters }));
  const c = findCriterion(report, 'departed-character');
  check('10. a plain-paragraph character bio still catches a departed-character violation (cast falls back to prose discovery)', c.status === 'FAIL', JSON.stringify(c));
}

// ── 11. ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS: quote-balance must not let
// a scanned front-matter chapter's .structural entry mask a BODY chapter
// that hard-failed earlier in the gate's own pipeline (before it ever
// reached the structural-integrity check) and so was never actually
// assessed for quote balance. ──
{
  const longEnoughFrontMatter = 'This book is the product of years of careful, patient work by everyone involved in its making. '.repeat(3);
  const severelyUnbalanced = '“'.repeat(40) + 'Something happened here without any closing quotes at all in this entire chapter of text that goes on for a while.';
  const project = { book_type: 'fiction', characters_md: CHAR_BIBLE, title: 'Quote Balance Edge Case', target_chapter_words: 100000 };
  const chapters = [
    makeChapter(0, 'Foreword', longEnoughFrontMatter),
    makeChapter(1, 'Chapter 1', severelyUnbalanced),
  ];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project, chapters }));
  const c = findCriterion(report, 'quote-balance');
  check('11. a body chapter that hard-fails before the structural check is never silently counted as balanced', c.status === 'FAIL', JSON.stringify(c));
}

// ── 12. ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS: an NF chapter that trips a
// critical process-leak hard failure (nothing to do with time/date claims)
// must not be misattributed as a TEMPORAL-1 violation just because it shares
// the same {chapterNumber, recommendedAction: 'REJECT_REGENERATE'} shape. ──
{
  const nfProject = { book_type: 'nonfiction', characters_md: '', title: 'Process Leak NF Book' };
  const leakedChapter = 'Here is the revised opening section as you requested, incorporating the changes discussed above. '.repeat(3);
  const chapters = [makeChapter(1, 'Introduction', leakedChapter)];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: nfProject, chapters }));
  const gateCriterion = findCriterion(report, 'gate');
  const temporalCriterion = findCriterion(report, 'temporal');
  check('12. the process-leak fixture actually fails the export gate (sanity check on the fixture itself)', gateCriterion.status === 'FAIL', JSON.stringify(gateCriterion));
  check('12b. a process-leak hard failure is not misattributed as a TEMPORAL-1 violation', temporalCriterion.status === 'PASS', JSON.stringify(temporalCriterion));
}

// ── 13. ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS: EVENT_CLASS_REPLAY is no
// longer a blanket N/A — a chapter that re-stages (with fresh wording) an
// event a PRIOR chapter's own persisted beat contract already completed
// must FAIL, reconstructed from chapter.scene_beats_json (which the store
// actually has), using the live app's own detection functions. ──
{
  const arrivalEvent = 'A rival salvage team arrives, led by a ruthless collector who knows the crew’s true identities.';
  const project = { book_type: 'fiction', characters_md: CHAR_BIBLE, title: 'Event Replay Book' };
  const chapters = [
    makeChapter(1, 'Chapter 1', 'Ottie tightened the last bolt on the manifold and wiped grease from her hands. The engine hummed back to life as Ludo watched from the doorway, arms crossed, saying nothing at all for a long moment.', {
      scene_beats_json: JSON.stringify([{ scene_id: 's1', required_events: [arrivalEvent] }]),
    }),
    makeChapter(2, 'Chapter 2', 'Ottie looked at the chip in her hand.\n\nThe rival team did not so much arrive as they did unfold, like a complex origami crane made of rusted steel and bad intentions. Three vehicles crunched over the dry scrub outside.'),
  ];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project, chapters }));
  const c = findCriterion(report, 'event-class-replay');
  check('13. a cross-chapter event re-stage (from a persisted beat contract) FAILs event-class-replay', c.status === 'FAIL', JSON.stringify(c));
}

// ── 13b. a book with no persisted beat contracts at all reports
// event-class-replay PASS (nothing to detect), not a false FAIL ──
{
  const chapters = buildCleanFictionChapters();
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: CLEAN_FICTION_PROJECT, chapters }));
  const c = findCriterion(report, 'event-class-replay');
  check('13b. a book with no scene_beats_json anywhere PASSes event-class-replay (no ledger to violate)', c.status === 'PASS', JSON.stringify(c));
}

// ── 14. ACCEPT-1B (finding 68): the malformedsent criterion must report the
// GATE's own [MALFORMEDSENT] number, not an independent re-scan. The gate
// only scans chapters over 200 chars (exportSafetyGate.js's msBodies
// filter), so a short chapter holding a malformed sentence is exactly the
// fixture where an unfiltered re-scan (the removed old ubs-accept.mjs
// formula) would disagree with the gate's own count. ──
{
  const shortMalformed = 'Were a ragtag collection of misfits who refused to quit.'; // 56 chars — under the gate's 200-char floor
  const longClean = 'Ottie tightened the last bolt on the manifold and wiped grease from her hands, the engine humming back to life as Ludo watched from the doorway with his arms crossed, saying absolutely nothing for a long moment while the crew went about their business around them both in the quiet morning light.';
  const project = { book_type: 'fiction', characters_md: CHAR_BIBLE, title: 'Malformed Gate Number Test' };
  const chapters = [
    makeChapter(1, 'Chapter 1', shortMalformed),
    makeChapter(2, 'Chapter 2', longClean),
  ];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project, chapters }));
  const c = findCriterion(report, 'malformedsent');
  check('14. malformedsent PASSes on a fixture where the gate\'s own 200-char floor excludes the only malformed sentence', c.status === 'PASS', JSON.stringify(c));

  // Sanity check on the fixture itself: an unfiltered re-scan (the removed
  // old formula) WOULD have found it — proving this fixture actually
  // exercises the divergence finding 68 described, not a vacuous case.
  const { scanMalformedSentences } = await import('../src/lib/malformedSentence.js');
  const naiveCast = harvestCastNamesForTest(project.characters_md, chapters.map((ch) => ch.content_md));
  const naiveTotal = chapters.reduce((sum, ch) => sum + scanMalformedSentences(ch.content_md, naiveCast).length, 0);
  check('14b. sanity: an unfiltered re-scan of this fixture WOULD disagree with the gate (proves the fixture is not vacuous)', naiveTotal > 0, `naive total ${naiveTotal}`);
}

// ── 15. ACCEPT-1B (finding 67/68): scene-dupes measures the LIVE library
// (moved into src/lib/sceneDuplicateSweep.js by SCENEDUP-3), not the dead
// stamp it used to import. This fixture repeats an action scene almost
// verbatim inside a chapter long enough (diverse, mutually-unrelated filler
// paragraphs) that the match lands as a medium-confidence "reported"
// duplicate rather than being capped by the sweep's own 10%-of-chapter
// removal-safety limit — proving the criterion sees genuine duplicates the
// live algorithm finds, not just near-exact removable ones. ──
const SCENE_DUPE_FIXTURE_PARAGRAPHS = [
  "Mara stood at the edge of the rooftop that morning, watching the city wake up slowly below her in the grey light, thinking about everything that had happened since they arrived.",
  "Mara sprinted down the narrow alley, breath ragged, boots slapping against wet stone as the guards' shouts echoed behind her in the dark rain-soaked night air. She could hear their pursuit gaining fast, boots pounding the same street she had just crossed only moments before, and she knew the window of escape was closing quickly now.",
  "Dov waited by the fire escape at the back of the crumbling building, waving her toward the rusted stairs bolted loosely to the brick wall above the alley. Two guards rounded the corner behind them, batons drawn, shouting for them to stop running immediately or face the harsh consequences of resisting arrest tonight in the district.",
  "Ilse had already climbed halfway up when Mara finally reached the stairs, her hands slick with cold sweat against the rusted metal railing beneath her trembling fingers. The alley behind them filled with the sound of running boots, and somewhere above a window slammed shut hard against the noise of the chase outside the walls.",
  "They reached the flat rooftop just as the first guard emerged into the alley below them, and Dov pulled the heavy fire door shut behind them tight. He wedged a broken length of pipe through the door handle to slow the guards down, and every single one of them knew it would not hold for long.",
  "The barometer had been falling steadily since Tuesday, and by Thursday evening the clouds over the valley had turned the color of old pewter, heavy and low enough that the ridge line disappeared entirely behind a curtain of mist that would not lift until well past the following weekend.",
  "The long division problem on the chalkboard had stumped nearly half the class, until the teacher walked through each remainder step by step, showing how the seven carried forward changed everything about the final quotient in ways nobody had anticipated from the first two lines of working.",
  "The chess match had gone eleven moves past where either player expected an opening advantage to matter, both clocks ticking down toward the increment as the knight maneuvered quietly toward a square nobody at the table had bothered to defend against three moves earlier.",
  "The tomato vines had finally outgrown their stakes, sprawling sideways across the raised bed until the whole corner of the garden looked more like a green tangle than any deliberate planting scheme the gardener had originally sketched out back in early spring.",
  "The mechanic found the leak almost by accident, tracing a thin trail of coolant back along the hose clamp to a hairline crack that had probably been widening for months before anyone noticed the temperature gauge creeping upward on longer drives.",
  "The evening train was running nine minutes late out of the junction, according to the board, though the platform announcer blamed a signal fault two stations back rather than anything to do with the usual weekday congestion at that particular crossing.",
  "The scarf pattern called for a cable twist every sixth row, and by the time the knitter reached the halfway point she had developed a rhythm that let her follow the chart almost without looking, needles clicking steadily through the quiet evening.",
  "The chemistry demonstration involved slowly heating a beaker of pale blue solution until it turned a deep amber, a color change the students dutifully recorded in their lab notebooks without fully grasping the reaction taking place beneath the surface.",
  "The football match had been scoreless through the first half, both defenses holding firm against increasingly desperate attacks, until a corner kick in the sixty-third minute finally found a head that nobody in the box had accounted for.",
  "The museum's new wing devoted an entire gallery to pottery shards recovered from a single excavation site, arranged chronologically so visitors could trace how the glazing technique had shifted gradually across nearly four centuries of continuous use.",
  "The courtroom fell quiet as the clerk read the exhibit list aloud, each item numbered and cross-referenced against a binder thick enough that the junior associate had spent the entire previous night just indexing its pages correctly.",
  "The spelling bee came down to a word neither finalist had encountered before, and the younger of the two asked for it to be used in a sentence twice before finally attempting a spelling that turned out to be correct.",
  "The marathon route wound through four different neighborhoods before looping back along the river, and organizers had stationed water tables every two miles after last year's unusually warm race left several runners struggling near the eighteenth mile marker.",
  "The farmers market set up early that Saturday, stalls of late-season squash and jars of honey arranged before the first customers arrived, while a small crowd already gathered around the stand selling fresh bread straight from a portable oven.",
  "The jazz trio played past closing time, the bassist and drummer trading a loose, unhurried rhythm while the pianist wandered through a melody nobody in the room quite recognized but everybody seemed content to simply follow anyway.",
  "The science fair judges lingered longest at a project measuring how different soil compositions affected seedling growth, impressed less by the results than by the sheer number of carefully labeled control groups the student had maintained.",
  "The library renovation uncovered a bricked-over window nobody had documented in any of the building's surviving plans, prompting a brief pause in construction while the historical society was consulted about whether it should be reopened.",
  "The bicycle race split into two distinct packs by the second climb, the smaller group setting a pace the rest simply could not match on a gradient that steepened unexpectedly just past the halfway feed station.",
  "The puppet show ran twenty minutes longer than scheduled after one string tangled badly backstage, though most of the younger children in the audience seemed not to notice the delay at all, absorbed entirely in the story.",
  "The astronomy club set up three telescopes on the hill behind the school, waiting for a break in the thin cloud cover that finally came just after ten, giving everyone a clear enough view of the rings to gasp audibly.",
  "The glacier had retreated nearly forty meters since the last survey, a fact the research team confirmed by matching their GPS readings against stakes driven into the ice a full decade earlier by a different expedition entirely.",
  "The volcano had been dormant long enough that a thin layer of soil had formed on its lower slopes, supporting scrub grass and a handful of stubborn shrubs that somehow survived each mild tremor without much visible damage.",
  "The coral reef survey took four dives to complete, each pass mapping a different quadrant of bleached and healthy coral so the marine biologists could compare this year's damage against three previous seasons of recorded data.",
  "The radio tower technician spent most of the afternoon replacing a corroded connector near the base, grumbling about the salt air the whole time even though he had done this exact repair a dozen times before.",
  "The lighthouse keeper logged the weather every four hours without fail, a habit so ingrained after eleven years that she sometimes caught herself reciting cloud cover and wind direction aloud to an empty room.",
  "The greenhouse thermostat had been misbehaving for a week, swinging the interior temperature by nearly fifteen degrees overnight until someone finally traced the fault back to a loose wire behind the control panel.",
  "The vineyard workers began the harvest earlier than usual that year, racing an incoming storm that threatened to split the ripening grapes if it arrived even a single day before the crew finished the eastern rows.",
  "The dairy farm's new milking parlor cut the morning routine by nearly an hour, though the herd took almost two full weeks to adjust to the unfamiliar layout without balking at the gate each time.",
  "The wind turbine technicians rappelled down from the nacelle just before the storm front arrived, having finished the blade inspection with barely enough daylight left to pack their gear before the first heavy gusts hit.",
  "The subway tunnel excavation hit an unexpected pocket of groundwater, forcing the crew to bring in extra pumps overnight so the boring machine could resume its slow crawl toward the next station by morning.",
  "The opera rehearsal ran long after the conductor stopped the orchestra three times in the second act, each time isolating a different section until the brass finally landed the transition cleanly on the fourth attempt.",
  "The ballet class spent the entire hour on a single combination, the instructor calling out corrections about arm placement until even the most advanced students in the front row started second-guessing their own timing.",
  "The pottery kiln took nearly eighteen hours to cool completely, and the apprentice who opened it too early last month still had not lived down the resulting crack that ran clean through a client's commissioned vase.",
  "The watch repair shop smelled faintly of machine oil, and the old clockmaker worked under a single bright lamp, tweezers steady despite his age as he set a hairspring back into place with practiced patience.",
  "The bookbinder trimmed the signature edges by hand, a slow and exacting process she preferred over the shop's mechanical cutter, insisting that the slight variation gave each finished volume its own particular character.",
  "The soap maker measured the lye solution twice before adding it to the oils, a habit born from one memorable batch years earlier that had turned out far too caustic to sell at the weekend market.",
  "The cheese aging room stayed at a constant twelve degrees year-round, rows of wheels turned by hand every few days so the rind developed evenly instead of drying unevenly on whichever side faced the door.",
  "The herb garden behind the kitchen supplied most of the restaurant's rosemary and thyme, though the head cook still complained every winter about having to buy basil from the market once the frost set in.",
  "The kite festival drew a bigger crowd than organizers expected, the field crowded with color by midafternoon as competing teams tried to out-maneuver each other in a series of increasingly elaborate aerial routines.",
  "The ice skating rink resurfaced the ice twice daily during the tournament, the Zamboni driver timing each pass carefully so the surface stayed smooth through back-to-back matches without ever fully refreezing between sessions.",
  "The tailoring shop kept a drawer of mismatched buttons sorted loosely by size, and customers occasionally spent longer picking a replacement button than the tailor spent actually sewing it back onto the garment.",
  "The falconry demonstration ran twice a day during the county fair, the trainer explaining each bird's history to a crowd that grew noticeably quieter whenever the hawk banked low over their heads before returning to the glove.",
  "The cartography students spent the whole semester digitizing a set of nineteenth-century survey maps, correcting for projection distortion that had crept in wherever the original surveyors misjudged the curvature of a particularly hilly county.",
  "The calligraphy workshop began with basic strokes before anyone touched real ink, the instructor insisting that steady pressure mattered far more than speed for students who kept rushing ahead of her demonstration.",
  "The beekeeper checked the hives every ten days through the summer, noting brood pattern and honey stores in a battered notebook that had outlasted three different smokers over the years.",
  "The surfing lesson started in water barely past the knees, the instructor walking each student through popping up on a stationary board before anyone was allowed near an actual incoming wave that morning.",
  "The origami club met every Wednesday in the back corner of the library, folding increasingly complex cranes and boxes from squares of paper donated by a local print shop that no longer needed the offcuts.",
  "The quilting circle had been meeting in the same church basement for eleven years, trading fabric scraps and half-finished blocks while the coffee pot in the corner ran continuously from nine until noon.",
  "The brewery's new batch needed another two weeks in the tank before anyone would know whether the adjusted hop schedule had actually fixed the bitterness problem customers kept mentioning about the previous release.",
  "The taxidermist worked slowly on the fox, more concerned with getting the ears right than finishing quickly, since a poorly shaped ear was the first thing any experienced hunter would notice on the wall mount.",
  "The dance hall floor had been resurfaced twice in a decade, the caretaker still complaining that the new finish scuffed differently under the band's heavier instrument cases than the old varnish ever had.",
  "Mara sprinted down the narrow alley, breath ragged, boots slapping against wet stone as the guards' shouts echoed behind her in the dark rain-soaked night air. She could hear their pursuit gaining fast, boots pounding the same street she had just crossed only moments before, and she knew the window of escape was closing quickly now.",
  "Dov waited by the fire escape at the back of the crumbling building, waving her toward the rusted stairs bolted loosely to the brick wall above the alley. Two guards rounded the corner behind them, batons drawn, shouting for them to stop running immediately or face the harsh consequences of resisting arrest tonight in the district.",
  "Ilse had already climbed halfway up when Mara finally reached the stairs, her hands slick with cold sweat against the rusted metal railing beneath her trembling fingers. The alley behind them filled with the sound of running boots, and somewhere above a window slammed shut hard against the noise of the chase outside the walls.",
  "They reached the flat rooftop just as the first guard emerged into the alley below them, and Dov pulled the heavy fire door shut behind them tight. He wedged a broken length of pipe through the door handle to slow the guards down, and every single one of them knew it would not hold for long."
];
{
  const project = { book_type: 'fiction', characters_md: '## Mara\nA dockworker.\n\n## Dov\nHer brother.\n\n## Ilse\nThe harbor-master.', title: 'Scene Dupe Test' };
  const content = SCENE_DUPE_FIXTURE_PARAGRAPHS.join('\n\n');
  const chapters = [makeChapter(1, 'Rooftop', content)];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project, chapters }));
  const c = findCriterion(report, 'scene-dupes');
  check('15. scene-dupes FAILs on a same-chapter near-duplicate scene, using the live library', c.status === 'FAIL', JSON.stringify(c));
  check('15b. the FAIL detail no longer carries the old dead-code disclaimer', !/dead-code|WAVE5|opposite verdicts/i.test(c.detail), c.detail);
}

// ── 16. ACCEPT-1B: template-budget lists EVERY over-budget family, not only
// the first — two distinct families (each bookBudget 3) pushed to 5
// occurrences apiece must both appear in the FAIL detail. ──
{
  const overBudgetBody = 'The air smelled of ozone. ozone again. Another ozone moment entirely. Then more ozone drifting past. And ozone once more before it faded. '
    + 'She tasted burnt sugar. burnt sugar lingered on her tongue. Still burnt sugar somehow. Always burnt sugar in that kitchen. One more burnt sugar note at the end. '
    + 'It was the first stop of a long journey neither of them had planned to take together this way, and nobody spoke of it again for a good while after that.';
  const project = { book_type: 'fiction', characters_md: CHAR_BIBLE, title: 'Budget Test' };
  const chapters = [makeChapter(1, 'Chapter 1', overBudgetBody)];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project, chapters }));
  const c = findCriterion(report, 'template-budget');
  check('16. template-budget FAILs when two families are both over budget', c.status === 'FAIL', JSON.stringify(c));
  check('16b. both over-budget families are named in the detail, not only the first', c.detail.includes('ozone') && c.detail.includes('burnt sugar'), c.detail);
}

// ── 17. ACCEPT-1C (finding 70): scene-dupes is N/A for nonfiction projects
// (the polish pipeline's own mode !== 'nonfiction' gate never runs the sweep
// on NF), and that N/A never drags down allPass/scoredCount — the same
// generic N/A-exclusion mechanism check 6b already locks for the report as
// a whole, exercised here specifically for this criterion. ──
{
  const nfProject = { book_type: 'nonfiction', characters_md: '', title: 'NF Scene Dupes Test' };
  const chapters = [
    makeChapter(1, 'Introduction', 'The excavation began quietly, without any of the fanfare later accounts would claim it deserved by the crew.'.repeat(3)),
    makeChapter(2, 'The Discovery', 'Weeks into the dig, the first real find emerged from the packed earth near the northern wall of the site.'.repeat(3)),
  ];
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: nfProject, chapters }));
  const c = findCriterion(report, 'scene-dupes');
  check('17. scene-dupes reports N/A for a nonfiction project', c.status === 'N/A', JSON.stringify(c));
  check('17b. the N/A detail matches the ticket\'s exact wording',
    c.detail === 'nonfiction — the polish pipeline does not run the scene-duplicate sweep on NF projects', c.detail);
  check('17c. scene-dupes is excluded from scoring (an N/A criterion can never affect allPass)',
    !report.criteria.filter((x) => x.status !== 'N/A').some((x) => x.key === 'scene-dupes'));
}

// ── 18. ACCEPT-1C: fiction projects are unchanged — scene-dupes is still a
// real, scored measurement (never N/A) using the live library. ──
{
  const chapters = buildCleanFictionChapters();
  const report = await withCapturedConsole(() => buildAcceptanceReport({ project: CLEAN_FICTION_PROJECT, chapters }));
  const c = findCriterion(report, 'scene-dupes');
  check('18. scene-dupes is still measured (not N/A) for a fiction project', c.status === 'PASS' || c.status === 'FAIL', JSON.stringify(c));
  check('18b. a clean fiction fixture with no duplicated scenes PASSes scene-dupes', c.status === 'PASS', JSON.stringify(c));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
