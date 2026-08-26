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

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
