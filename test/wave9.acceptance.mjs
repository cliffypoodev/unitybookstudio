// WAVE9 acceptance battery — reachability, silent failures, dead parameters.
//
//   WAVE9-KDPVALIDATE   Amazon's own keyword rules are checked before you submit
//   WAVE9-SILENTSERIES  a live page stops swallowing 21 errors
//   WAVE9-REACHABILITY  one feature mounted, ten stamped, one test rescued
//   WAVE9-DEADPROPS     two features restored, six parameters removed
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateKeyword, validateKeywordSet, KDP_KEYWORD_CHAR_LIMIT } from '../src/lib/kdpKeywordValidator.js';
import { parseSeriesField, describeFieldFailures } from '../src/lib/seriesBibleFields.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

/* ── WAVE9-KDPVALIDATE ─────────────────────────────────────────────────── */
// Executed, not asserted against: these are the rules Amazon rejects over.
check('1. the character limit is the documented 50', KDP_KEYWORD_CHAR_LIMIT === 50);
check('1b. an over-length keyword is caught',
  validateKeyword('x'.repeat(60)).valid === false);
check('1c. banned promotional terms are caught',
  ['bestseller thriller', 'free cozy mystery', 'award-winning saga']
    .every((k) => validateKeyword(k).warnings.some((w) => /banned term/i.test(w))));
check('1d. trademarked author names are caught',
  validateKeyword('books like stephen king').warnings.some((w) => /trademarked author name/i.test(w)));
check('1e. a keyword wholly duplicated from the title is caught',
  validateKeyword('marmalade conspiracy', { title: 'The Marmalade Conspiracy' })
    .warnings.some((w) => /already in title/i.test(w)));
check('1f. a legitimate keyword passes clean',
  validateKeyword('cozy village mystery', { title: 'The Marmalade Conspiracy' }).valid === true);
check('1g. the set summary counts what it flagged',
  (() => {
    const r = validateKeywordSet(
      [{ keyword: 'cozy village mystery' }, { keyword: 'bestseller' }, { keyword: 'x'.repeat(60) }],
      { title: 'The Marmalade Conspiracy' }
    );
    return r.results.length === 3 && r.validCount === 1 && r.invalidCount === 2 && r.totalWarnings >= 2;
  })());

const pub = read('src/components/tools/PublishingSubPage.jsx');
check('2. the validator is wired into the Keywords editor',
  /from '@\/lib\/kdpKeywordValidator'/.test(pub) && /validateKeywordSet\(keywords/.test(pub));
check('2b. the hand-rolled 50 is gone in favour of the shared constant',
  !/\(k\.keyword \|\| ''\)\.length > 50/.test(pub) && /KDP_KEYWORD_CHAR_LIMIT/.test(pub));
check('2c. project is threaded down so the title rule has a title',
  /<KeywordsEditor value=\{value\} onUpdate=\{onUpdate\} project=\{project\} \/>/.test(pub));

/* ── WAVE9-SILENTSERIES ────────────────────────────────────────────────── */
const sm = read('src/pages/SeriesManager.jsx');
check('3. no empty catch blocks remain on the live /series page',
  !/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(sm));
check('3b. the merge refuses to overwrite a field it could not read',
  /refusing to overwrite unreadable characters_json/.test(sm) &&
  /refusing to overwrite unreadable \$\{field\}/.test(sm));
check('3c. find-and-replace skips rather than rewriting from a stale copy',
  /skippedChapters \+= 1;/.test(sm) && /rather than rewritten from a stale copy/.test(sm));
check('3d. a volume whose chapters could not be read is reported, not silently missed',
  /unreadableVolumes/.test(sm) && /still contain the old name/.test(sm));
check('3e. the sequel seed reports continuity it had to leave out',
  /buildSeriesSeedConcept\(selectedFlavor, bible, lastVolume, nextNumber, unreadable\)/.test(sm) &&
  /The new volume was created without it\./.test(sm));
check('3f. the continuity tracker says when it is incomplete',
  /This tracker is incomplete/.test(sm) &&
  /An empty list below does not mean nothing is/.test(sm));
check('3g. the four remaining catches log instead of vanishing',
  (sm.match(/console\.warn\('\[SERIES/g) || []).length >= 4);

// Behavioural: the helper degrades but records.
const sink = [];
check('4. good JSON parses', JSON.stringify(parseSeriesField('[1,2]', null, 'threads', sink)) === '[1,2]');
check('4b. corrupt JSON returns the fallback AND records the field name',
  parseSeriesField('[{oops', null, 'characters', sink) === null && sink.includes('characters'));
check('4c. an already-parsed value passes through untouched',
  JSON.stringify(parseSeriesField([3], null, 'x', sink)) === '[3]');
check('4d. absent fields are not treated as failures',
  parseSeriesField('', 'FB', 'secrets', sink) === 'FB' && !sink.includes('secrets'));
check('4e. the message names the fields and stays empty when nothing failed',
  /characters/.test(describeFieldFailures(sink)) && describeFieldFailures([]) === '');

/* ── WAVE9-REACHABILITY ────────────────────────────────────────────────── */
const chat = read('src/components/notebook/IdeasChatbot.jsx');
const msg = read('src/components/notebook/ChatMessage.jsx');
check('5. CreateProjectFromIdeaDialog finally has an importer',
  /import CreateProjectFromIdeaDialog from '@\/components\/notebook\/CreateProjectFromIdeaDialog'/.test(chat) &&
  /<CreateProjectFromIdeaDialog/.test(chat));
check('5b. an idea can start a NEW book instead of overwriting the open one',
  /Start a New Book/.test(msg) && /Use in This Book/.test(msg) && /onStartNewProject/.test(msg));
check('5c. confirming actually creates the project and navigates to it',
  /NovelProject\.create\(\{/.test(chat) && /navigate\(`\/projects\/\$\{created\.id\}`\)/.test(chat));

const STAMPED = [
  'src/components/tools/SeriesBibleView.jsx',
  'src/components/tools/ProofreadFinding.jsx',
  'src/components/tools/KdpCategoriesSection.jsx',
  'src/lib/safeChapterResave.js',
  'src/lib/sceneExecutionLiveCanary.js',
  'src/lib/uiWiringAudit.js',
  'src/lib/app-params.js',
  'src/components/ProtectedRoute.jsx',
  'src/tools/importBackup.js',
  'src/tools/importFullExport.js',
];
check('6. every remaining orphan carries the dead-code warning',
  STAMPED.every((f) => /DEAD CODE — DO NOT EDIT/.test(read(f))));
check('6b. each stamp names its live replacement where one exists',
  /extractSeriesBible\(\) driven from pages\/SeriesManager/.test(read('src/components/tools/SeriesBibleView.jsx')) &&
  /verifiedChapterSave/.test(read('src/lib/safeChapterResave.js')) &&
  /sceneExecutionAcceptanceRunners/.test(read('src/lib/sceneExecutionLiveCanary.js')));

check('7. the rescued battery lives in test/ and not in src/',
  fs.existsSync(path.join(ROOT, 'test/dialoguemechanics1.acceptance.mjs')) &&
  !fs.existsSync(path.join(ROOT, 'src/lib/dialogueMechanicsRepair.test.js')));
check('7b. it imports the live module it guards',
  /from '\.\.\/src\/lib\/dialogueMechanicsRepair\.js'/.test(read('test/dialoguemechanics1.acceptance.mjs')));

/* ── WAVE9-DEADPROPS ───────────────────────────────────────────────────── */
check('8. Publishing claims the shared one-lane busy label, and releases it',
  /setBusyLabel\?\.\(`Generating \$\{item\.label\}…`\)/.test(pub) &&
  /setBusyLabel\?\.\(''\)/.test(pub));
const cmp = read('src/components/tools/CompareSubPage.jsx');
check('8b. a finished-but-empty critic comparison no longer looks unstarted',
  /done \? 'Run Again'/.test(cmp) && /neither version came back with panel data/.test(cmp));
check('9. the six dead parameters are gone from their signatures',
  /export default function ReviewChapterList\(\{ chapters \}\)/.test(read('src/components/review/ReviewChapterList.jsx')) &&
  /export default function AuthorStyleManager\(\{ authorStyleId, onStyleChange \}\)/.test(read('src/components/notebook/AuthorStyleManager.jsx')) &&
  /function SpinoffView\(\{ bible, volume, projects, onBack, onCreated \}\)/.test(sm) &&
  /function RewriteVolumeView\(\{ bible, volume, projects, onBack, navigate \}\)/.test(sm));
// Scoped to the two call sites in question — other components in this file
// legitimately receive allProjects and refreshAll and must keep them.
const callSite = (marker) => (sm.split('\n').find((l) => l.includes(marker)) || '');
check('9b. and from the call sites, so nothing passes what nothing accepts',
  !/allProjects=/.test(callSite('<SpinoffView')) &&
  !/refreshAll=/.test(callSite('<RewriteVolumeView')) &&
  callSite('<SpinoffView').includes('<SpinoffView') &&
  callSite('<RewriteVolumeView').includes('<RewriteVolumeView') &&
  /<ReviewChapterList chapters=\{chapters\} \/>/.test(read('src/pages/ProjectStudio.jsx')));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
