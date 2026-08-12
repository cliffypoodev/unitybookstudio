// WAVE7 acceptance battery — Tools tab review findings.
//
//   WAVE7-ANTHAWAIT    anthology detectors are awaited; property names match reality
//   WAVE7-ATMOGATE     the atmospheric cap honours its literary-only contract
//   WAVE7-ANTHREPORT   the Manual Review section can actually render
//   WAVE7-ANTHRESAVE   chapters are not saved twice per run
//   WAVE7-FIXID        critic fix ids cannot collide across the two lists
//   WAVE7-CONCURRENCY  Compare + Transform respect the one-slot local server
//   WAVE7-CHNUM        transform saves real chapter numbers after a failure
//   WAVE7-TOPFIXES     reviewer revision instructions are carried out and rendered
//   WAVE7-BEATS        the outline-delivery report is rendered
//   WAVE7-CITATIONS    research sources + unverified claims reach the brief
//   WAVE7-REPORTEXPORT the four display-only reports can be exported
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

// ── WAVE7-ANTHAWAIT ──────────────────────────────────────────────────────────
const apv = read('src/components/tools/AnthologyPolishView.jsx');
const checks = read('src/lib/anthologyPolishChecks.js');
const ASYNC_DETECTORS = ['runContaminationDetector', 'runNarrativeClusterDetector', 'runCrossChapterBodyLanguageDedup',
  'runAnthologyVocabBans', 'runLiteraryAtmosphericCap', 'runChapterOpenerFrequencyDetector', 'runAnthologyHardErrorDetector'];
check('1. every async anthology detector is declared async in the lib',
  ASYNC_DETECTORS.every((f) => new RegExp(`export async function ${f}\\b`).test(checks)));
check('1b. every one of them is awaited at the call site',
  ASYNC_DETECTORS.every((f) => new RegExp(`await ${f}\\(`).test(apv)));
check('1c. no detector is called without await',
  !ASYNC_DETECTORS.some((f) => new RegExp(`(?<!await )\\b${f}\\(loaded`).test(apv)));
check('2. the tally reads the property names the functions actually return',
  /contamFixResult\.contaminationRemoved/.test(apv) && /bodyLangResult\.totalRemoved/.test(apv) &&
  /anthVocabResult\.totalReplaced/.test(apv) && /atmosphericResult\.totalAdjusted/.test(apv));
check('2b. the old invented property names are gone',
  !/bodyLangFixed|anthVocabFixed|atmosphericFixed|openerFlags|hardErrorFlags|narrativeContaminationFlags/.test(apv));
check('3. flags are counted from `warnings`, which is what the detectors return',
  /openerResult\.warnings\?\.length/.test(apv) && /hardErrorResult\.warnings\?\.length/.test(apv));

// ── WAVE7-ATMOGATE ───────────────────────────────────────────────────────────
check('4. the atmospheric cap gates on project genre and reports skipping',
  /export function isLiteraryProject/.test(checks) &&
  /if \(!isLiteraryProject\(project\)\)/.test(checks) &&
  /skipped: true/.test(checks) && /skipped: false/.test(checks));
check('4b. a sci-fi anthology would be skipped, a literary one would run',
  (() => {
    const rx = checks.match(/const LITERARY_GENRE_RX = (\/.*\/i);/);
    if (!rx) return false;
    const re = new RegExp(rx[1].slice(1, -2), 'i');
    return re.test('Literary Fiction') && !re.test('Science Fiction') && !re.test('Thriller');
  })());

// ── WAVE7-ANTHREPORT ─────────────────────────────────────────────────────────
const apr = read('src/components/tools/AnthologyPolishReport.jsx');
check('5. Manual Review renders from `warnings` (string arrays), so it can appear',
  /hardErrors\?\.warnings\?\.length > 0/.test(apr) && /openers\?\.warnings\?\.length > 0/.test(apr) &&
  /narrative\?\.warnings\?\.length > 0/.test(apr));
check('5b. the three manuscript-modifying steps are destructured for reporting',
  /contamFix, bodyLang, anthVocab/.test(apr));
check('5c. the atmospheric section reports substitutions, not "sentences removed"',
  /totalAdjusted/.test(apr) && !/atmosphericFixed/.test(apr) && /substitution\(s\)/.test(apr));
check('5d. a skipped atmospheric pass explains itself', /skipReason/.test(apr));

// ── WAVE7-ANTHRESAVE ─────────────────────────────────────────────────────────
check('6. `original` is re-baselined after the first save loop',
  /for \(const f of loaded\) f\.original = f\.content;/.test(apv));

// ── WAVE7-FIXID ──────────────────────────────────────────────────────────────
const critic = read('src/components/tools/CriticSubPage.jsx');
check('7. critic fix ids are namespaced per list',
  /`ch:\$\{critique\.chapterNumber\}:w\$\{i\}`/.test(critic) &&
  /`pri:\$\{fix\.chapterNumber\}:\$\{i\}`/.test(critic));
check('7b. the collision-prone bare `${n}-${i}` ids are gone',
  !/`\$\{critique\.chapterNumber\}-\$\{i\}`/.test(critic) &&
  !/`\$\{fix\.chapterNumber\}-\$\{i\}`/.test(critic) &&
  !/`\$\{cc\.chapterNumber\}-\$\{i\}`/.test(critic));
check('7c. collection uses the same namespaced ids as the render',
  (critic.match(/ch:\$\{cc\.chapterNumber\}:w\$\{i\}/g) || []).length >= 1 &&
  (critic.match(/pri:\$\{fix\.chapterNumber\}:\$\{i\}/g) || []).length >= 2);

// ── WAVE7-CONCURRENCY ────────────────────────────────────────────────────────
const compare = read('src/components/tools/CompareSubPage.jsx');
const transform = read('src/components/tools/TransformSubPage.jsx');
check('8. Compare no longer fires the reviewer panel with Promise.all',
  !/Promise\.all\(panel\.map/.test(compare) && /runReviewerPanelSequential\(/.test(compare));
check('8b. Transform runs one lane, matching parallelDraftPool',
  !/limit: 4/.test(transform) && /limit: 1/.test(transform));
check('8c. the "4-lane pool" label is gone', !/4-lane pool/.test(transform));

// ── WAVE7-CHNUM ──────────────────────────────────────────────────────────────
check('9. transform saves use the real chapter number, not a post-filter index',
  !/\.map\(\(r, i\) => `## Chapter \$\{i \+ 1\}/.test(transform) &&
  /r\.value\.chapterNumber/.test(transform));
check('9b. chapter identity is carried out of the pool',
  /chapterNumber: chapter\?\.chapter_number/.test(transform));

// ── WAVE7-TOPFIXES ───────────────────────────────────────────────────────────
check('10. topFixes are copied out of the reviewer response (both runners)',
  /topFixes: Array\.isArray\(data\.topFixes\)/.test(critic) &&
  /topFixes: Array\.isArray\(data\.topFixes\)/.test(compare));
check('10b. failed reviewers still carry an empty array (never undefined)',
  /topFixes: \[\], _failed: true/.test(critic) && /topFixes: \[\],\n            _failed: true/.test(compare));
const card = read('src/components/tools/CriticReviewCard.jsx');
check('10c. the review card renders them',
  /review\.topFixes\?\.length > 0/.test(card) && /review\.topFixes\.map/.test(card));

// ── WAVE7-BEATS ──────────────────────────────────────────────────────────────
check('11. the outline-delivery panel exists and is rendered',
  /function PlanDeliveryPanel/.test(critic) && /<PlanDeliveryPanel planReport=\{critiqueResults\.planReport\} \/>/.test(critic));
check('11b. it surfaces missing/altered/delivered beats and undrafted chapters',
  /beatsMissing/.test(critic) && /beatsAltered/.test(critic) && /beatsDelivered/.test(critic) &&
  /Planned but not drafted/.test(critic));
check('11c. character coverage is surfaced too', /characterCoverage/.test(critic));

// ── WAVE7-CITATIONS ──────────────────────────────────────────────────────────
const research = read('src/lib/fictionResearch.js');
check('12. the research schema can carry sources and unverified claims',
  /sources: \{/.test(research) && /unverified: \{/.test(research));
check('12b. the prompt asks for exact URLs from the supplied results',
  /an EXACT url from the supplied search results/.test(research));
check('12c. the compiled brief emits a Sources section (and says so when empty)',
  /### Sources/.test(research) && /treat the section above as unverified/.test(research));
check('12d. unconfirmed claims get their own visible section',
  /Unverified — Could Not Confirm From Sources/.test(research));

// ── WAVE7-REPORTEXPORT ───────────────────────────────────────────────────────
const rex = read('src/lib/reportExport.js');
check('13. a shared markdown export helper exists',
  ['downloadMarkdown', 'buildCritiqueMarkdown', 'buildCompareMarkdown', 'buildAnalyticsMarkdown', 'buildAnthologyMarkdown']
    .every((f) => new RegExp(`export function ${f}`).test(rex)));
const analytics = read('src/components/tools/AnalyticsSubPage.jsx');
check('13b. all four previously display-only reports have an export control',
  /buildCritiqueMarkdown\(/.test(critic) && /buildCompareMarkdown\(/.test(compare) &&
  /buildAnalyticsMarkdown\(/.test(analytics) && /buildAnthologyMarkdown\(/.test(apv));
check('13c. the critique export includes the panel reviews and their topFixes',
  /panelResults\?\.reviews/.test(critic) && /Would fix:/.test(rex));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
