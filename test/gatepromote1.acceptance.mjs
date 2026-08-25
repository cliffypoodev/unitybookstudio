// GATEPROMOTE-1 acceptance battery — continuity breaks that used to be
// export-gate WARNINGS become hard blocks in fiction: a departed character
// acting with no written return (DEPARTED_CHARACTER_ACTIVE) and a duplicate
// cross-chapter self-introduction (DUPLICATE_INTRODUCTION), both surfaced by
// CHARSTATE-1's auditProseAgainstCharacterState. Role drift and MALFORMEDSENT-1
// stay warnings (the latter behind MALFORMEDSENT_HARD_BLOCK, which stays
// false until two consecutive clean exports). Fixtures use invented generic
// names (Mara, Dov, Ilse), never a real book's cast.
import { readFileSync } from 'fs';
import vm from 'node:vm';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── real (relative-import) modules the CHARSTATE-1 / MALFORMEDSENT-1 blocks
// actually need to behave correctly under test — everything else in
// exportSafetyGate.js is independently try/catch-wrapped and fails open. ──
const { parseCanonCast, scanRoleReferenceDrift } = await import('../src/lib/canonRoles.js');
const { harvestCastNames } = await import('../src/lib/pronounLock.js');
const {
  buildCharacterState,
  auditProseAgainstCharacterState,
  extractBeatDeclaredStateUpdates,
  collectChapterBeatEvents,
} = await import('../src/lib/characterStateLedger.js');
const { isFictionProject } = await import('../src/lib/projectType.js');
const { scanMalformedSentences } = await import('../src/lib/malformedSentence.js');

const sgPath = new URL('../src/lib/exportSafetyGate.js', import.meta.url).pathname;
const sgCodeRaw = readFileSync(sgPath, 'utf-8');

// Load the gate in a VM sandbox (same technique as lengthgate1.acceptance.mjs)
// to dodge the @/-aliased transitive import in researchStorage.js. Real
// implementations go in for the modules under test; everything unrelated is
// stubbed to a clean pass so it cannot contaminate `blocked`.
function buildGate({ malformedHardBlock = false, logs = [] } = {}) {
  const ctx = {
    console: {
      log: (...a) => logs.push(a.join(' ')),
      warn: (...a) => logs.push(a.join(' ')),
      error: (...a) => logs.push(a.join(' ')),
    },
    runManuscriptSafetyGate: () => ({
      ok: true,
      blocked: false,
      hardFailures: [],
      warnings: [],
      reasons: [],
      recommendedAction: '',
      processLeaks: { matches: [] },
      contamination: { matches: [] },
      malformed: { matches: [] },
    }),
    runReferenceIntegrityGate: () => ({ blocked: false, blockingIssues: [], advisoryIssues: [], warnings: [], summary: '' }),
    ensureResearchEvidence: async (p) => p,
    checkStructuralIntegrity: () => ({
      pass: true,
      quoteBalance: { pass: true, open: 0, close: 0, unbalancedParagraphs: 0, details: [] },
      gluedWords: { pass: true, count: 0, details: [] },
      unterminatedParagraphs: { pass: true, count: 0 },
      typography: { pass: true, straightQuotes: 0, curlyOpen: 0 },
    }),
    checkBookIntegrity: () => ({ shortChapters: { details: [], floor: 0 }, crossChapterEchoes: { count: 0 }, openingEchoes: { count: 0, details: [] }, medianWords: 0, pass: true }),
    parseCanonCast,
    scanRoleReferenceDrift,
    harvestCastNames,
    buildCharacterState,
    auditProseAgainstCharacterState,
    extractBeatDeclaredStateUpdates,
    collectChapterBeatEvents,
    isFictionProject,
    scanMalformedSentences,
    MALFORMEDSENT_HARD_BLOCK: malformedHardBlock,
    __e: {},
  };
  vm.createContext(ctx);
  const vmSrc = sgCodeRaw
    .replace(/^import .*$/gm, '')
    .replace(/^export (async )?function/gm, '$1function')
    .replace(/^export (const|class|let)/gm, '$1')
    + '\n__e = { runPreExportSafetyGate };';
  vm.runInContext(vmSrc, ctx);
  return { runPreExportSafetyGate: ctx.__e.runPreExportSafetyGate, logs };
}

const CHAR_BIBLE = "### Major Characters\n\n**1. Mara**\n\n- **Pronouns:** she/her\n\n**2. Dov**\n\n- **Pronouns:** he/him\n\n**3. Ilse**\n\n- **Pronouns:** she/her";
const ROLE_BIBLE = "### Major Characters\n\n**1. Protagonist: Mara Devlin**\n\n- **Role:** Navigator and heart of the crew.\n\n**2. Antagonist: Dov Rask**\n\n- **Role:** The gruff, no-nonsense leader of the crew.\n\n**3. Ilse**\n\n- **Pronouns:** she/her";

// ── 1. a departed character acting with no return → blocked, DEPARTED_CHARACTER_ACTIVE ──
{
  const ch1 = {
    chapter_number: 1,
    title: 'The Parting',
    content_md: 'Dov pressed the wrench into Ilse’s hands, working through the evening light with quiet, deliberate focus. "You need someone else for this," he said at last, setting the tool down on the bench. They watched Dov go, a small figure against the wheat, the road taking him past the silo and out of sight for good. Dov was gone. The yard felt larger and quieter than it had any right to feel that night.',
  };
  const ch2 = {
    chapter_number: 2,
    title: 'The Counter',
    content_md: 'The store smelled of feed and coffee, the morning crowd thinning slowly toward noon. Dov fidgeted near the counter, his eyes darting toward the exit every few seconds as though he expected to be turned away. Ilse rang up the order without a word, the till clattering in the otherwise quiet room.',
  };
  const project = { book_type: 'fiction', characters_md: CHAR_BIBLE };
  const { runPreExportSafetyGate } = buildGate();
  const report = await runPreExportSafetyGate([ch1, ch2], { project });
  const hit = report.hardFailures.find((f) => f.code === 'DEPARTED_CHARACTER_ACTIVE');
  check('1. fiction: departed character acting with no return blocks export', report.blocked === true && !!hit && hit.recommendedAction === 'REJECT_REGENERATE', JSON.stringify(report.hardFailures));
}

// ── 2. a duplicate self-introduction across chapters → blocked, DUPLICATE_INTRODUCTION ──
{
  const ch1 = {
    chapter_number: 1,
    title: 'By the Fire',
    content_md: 'Mara walked into the firelight, dust still clinging to her boots from the long day’s ride across the flats. "I am Mara. Mara Devlin," she said, offering a hand to the stranger by the fire, the words carrying easily over the crackle of the flames and the low murmur of the camp settling in for the night.',
  };
  const ch2 = {
    chapter_number: 2,
    title: 'At the Wagon',
    content_md: 'The dust-streaked stranger stepped from the shade of the wagon, wiping her palms on her trousers before she spoke. "I am Mara. Mara Devlin," she said again, as if for the first time, and Ilse only frowned at the odd repetition, saying nothing about it at all.',
  };
  const project = { book_type: 'fiction', characters_md: CHAR_BIBLE };
  const { runPreExportSafetyGate } = buildGate();
  const report = await runPreExportSafetyGate([ch1, ch2], { project });
  const hit = report.hardFailures.find((f) => f.code === 'DUPLICATE_INTRODUCTION');
  check('2. fiction: duplicate cross-chapter self-introduction blocks export', report.blocked === true && !!hit && hit.recommendedAction === 'REJECT_REGENERATE', JSON.stringify(report.hardFailures));
}

// ── 3. malformed-only fixture → NOT blocked while MALFORMEDSENT_HARD_BLOCK is false ──
const MALFORMED_CH = {
  chapter_number: 1,
  title: 'Malformed Only',
  content_md: 'Were a ragtag collection of scavengers, each one covered in grime from the tunnels below the old refinery. '.repeat(3) + 'Looked at Ilse, then said nothing at all for a long while.',
};
{
  const project = { book_type: 'fiction', characters_md: CHAR_BIBLE };
  const { runPreExportSafetyGate } = buildGate({ malformedHardBlock: false });
  const report = await runPreExportSafetyGate([MALFORMED_CH], { project });
  check('3. fiction: malformed-only fixture is NOT blocked while the constant is false', report.blocked === false, JSON.stringify(report.hardFailures));
}

// ── 4. same fixture, MALFORMEDSENT_HARD_BLOCK branch mocked true → blocked ──
// (tests the branch by injecting the constant into the sandbox, never by
// editing the real export in malformedSentence.js)
{
  const project = { book_type: 'fiction', characters_md: CHAR_BIBLE };
  const { runPreExportSafetyGate } = buildGate({ malformedHardBlock: true });
  const report = await runPreExportSafetyGate([MALFORMED_CH], { project });
  const hit = report.hardFailures.find((f) => (f.reasons || []).some((r) => r.includes('MALFORMEDSENT-1')));
  check('4. fiction: MALFORMEDSENT_HARD_BLOCK=true branch blocks export', report.blocked === true && !!hit, JSON.stringify(report.hardFailures));
}

// ── 5. NF project, same departed-character prose → not blocked, stays a warning ──
{
  const ch1 = {
    chapter_number: 1,
    title: 'The Parting',
    content_md: 'Dov pressed the wrench into Ilse’s hands, working through the evening light with quiet, deliberate focus. "You need someone else for this," he said at last, setting the tool down on the bench. They watched Dov go, a small figure against the wheat, the road taking him past the silo and out of sight for good. Dov was gone. The yard felt larger and quieter than it had any right to feel that night.',
  };
  const ch2 = {
    chapter_number: 2,
    title: 'The Counter',
    content_md: 'The store smelled of feed and coffee, the morning crowd thinning slowly toward noon. Dov fidgeted near the counter, his eyes darting toward the exit every few seconds as though he expected to be turned away. Ilse rang up the order without a word, the till clattering in the otherwise quiet room.',
  };
  const project = { book_type: 'nonfiction', characters_md: CHAR_BIBLE };
  const { runPreExportSafetyGate } = buildGate();
  const report = await runPreExportSafetyGate([ch1, ch2], { project });
  const warned = report.warnings.some((w) => (w.reasons || []).some((r) => r.includes('DEPARTED_CHARACTER_ACTIVE') || r.includes('departed the crew')));
  check('5. nonfiction: the same finding is never promoted, stays a warning', report.blocked === false && warned, JSON.stringify({ blocked: report.blocked, warnings: report.warnings }));
}

// ── 6. role-drift-only fixture → warning, not blocked ──
{
  const ch1 = {
    chapter_number: 1,
    title: 'Course Plotted',
    content_md: '“Course plotted,” Ilse chirped, and the console lit up beneath her fingers. The navigator was perched on the console, her legs swinging idly as the ship groaned and settled into its new heading. '.repeat(2),
  };
  const project = { book_type: 'fiction', characters_md: ROLE_BIBLE };
  const { runPreExportSafetyGate } = buildGate();
  const report = await runPreExportSafetyGate([ch1], { project });
  const warned = report.warnings.some((w) => (w.reasons || []).some((r) => r.includes('CHARSTATE-1') && r.includes('canon assigns that role')));
  check('6. role drift stays a warning, never a hard block', report.blocked === false && warned, JSON.stringify({ blocked: report.blocked, warnings: report.warnings }));
}

// ── 7. telemetry: a promotion logs [GATEPROMOTE] ──
{
  const ch1 = {
    chapter_number: 1,
    title: 'The Parting',
    content_md: 'Dov pressed the wrench into Ilse’s hands, working through the evening light with quiet, deliberate focus. "You need someone else for this," he said at last, setting the tool down on the bench. They watched Dov go, a small figure against the wheat, the road taking him past the silo and out of sight for good. Dov was gone. The yard felt larger and quieter than it had any right to feel that night.',
  };
  const ch2 = {
    chapter_number: 2,
    title: 'The Counter',
    content_md: 'The store smelled of feed and coffee, the morning crowd thinning slowly toward noon. Dov fidgeted near the counter, his eyes darting toward the exit every few seconds as though he expected to be turned away. Ilse rang up the order without a word, the till clattering in the otherwise quiet room.',
  };
  const project = { book_type: 'fiction', characters_md: CHAR_BIBLE };
  const logs = [];
  const { runPreExportSafetyGate } = buildGate({ logs });
  await runPreExportSafetyGate([ch1, ch2], { project });
  check('7. a promotion logs [GATEPROMOTE] Ch.N: CODE promoted to hard block', logs.some((l) => l.includes('[GATEPROMOTE]') && l.includes('DEPARTED_CHARACTER_ACTIVE') && l.includes('promoted to hard block')), JSON.stringify(logs.filter((l) => l.includes('GATEPROMOTE'))));
}

// ── 8. source-shape: the gate imports isFictionProject and gates on it, not a new book_type check ──
{
  const GATE = sgCodeRaw;
  // NFEXPORT-BIB-1 (Arc G) added isNonfictionProject to the same import line —
  // isFictionProject is still imported from the one authority either way.
  check('8. export gate imports isFictionProject from projectType.js', /import \{[^}]*\bisFictionProject\b[^}]*\} from '\.\/projectType\.js'/.test(GATE));
  check('9. both promotions gate on isFictionProject(project)', (GATE.match(/isFictionProject\(project\)/g) || []).length >= 2);
  check('10. no new book_type literal comparison was introduced', !/book_type\s*===\s*['"]fiction['"]/.test(GATE) && !/book_type\s*!==\s*['"]fiction['"]/.test(GATE));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
