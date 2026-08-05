// NFCLASS-3 + PROVENANCE-1 acceptance — the drafting core asks the authority,
// and the scene verifier fails closed.
//
// NFCLASS-1 rewired six named nonfiction detectors to projectType.js. It did not reach
// the drafting core, which held three more, each normalizing differently:
//
//   sceneWriter.js       `project?.book_type === 'nonfiction'`   (raw, case-sensitive)
//   generationContext.js `isStandaloneFiction`                    (defaults to fiction)
//   modelRouting.js      `String(settings.book_type).toLowerCase()`
//
// Proven divergences against a project declared { project_type: 'nonfiction' } — a shape
// this app produces:
//   - the authority says nonfiction, so the chapter drafts as nonfiction;
//   - sceneWriter's gates say fiction, so labelCompositeCharacters,
//     crossCheckResearchFabrication, the SOURCE FIDELITY prompt block, the closed-world
//     strip backstop, semanticSourceCheck, deterministicSourceCheck and the final
//     chapter source strip are ALL skipped — a nonfiction book drafts with zero
//     anti-fabrication protection;
//   - generationContext demands the FICTION foundation and throws
//     FOUNDATION_FIELDS_MISSING, so the book cannot be drafted at all;
//   - modelRouting hands the whole book to the creative model its own comment says
//     "fabricates evidence to dramatize".
//
// And verifySceneProvenance — called eight times across the drafting path — returned
// clean for a contract with a renamed key, and never rejected a duplicated or
// fabricated scene id.
import fs from 'fs';
import vm from 'node:vm';
import { isNonfictionProject, isFictionProject } from '../src/lib/projectType.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};
const quiet = (fn) => {
  const w = console.warn; const l = console.log; const e = console.error;
  console.warn = () => {}; console.log = () => {}; console.error = () => {};
  try { return fn(); } finally { console.warn = w; console.log = l; console.error = e; }
};
const threw = (fn) => { try { quiet(fn); return null; } catch (err) { return err; } };

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url).pathname, 'utf8');
const executable = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');

// generationContext.js now imports '@/lib/projectType', a Vite alias node cannot
// resolve, so it is loaded in a vm with that one import stubbed with the REAL authority.
// This keeps the behavioural checks below honest — they exercise the shipped code.
const GC_SRC = read('src/lib/generationContext.js');
const gcCtx = {
  console: { log() {}, warn() {}, error() {} },
  isNonfictionProjectAuthority: isNonfictionProject,
  __exports: {},
};
vm.createContext(gcCtx);
vm.runInContext(
  GC_SRC.replace(/^import .*$/gm, '')
    .replace(/^export (async )?function/gm, '$1function')
    .replace(/^export (const|class)/gm, '$1')
  + '\n__exports = { verifySceneProvenance, FOUNDATION_FIELDS, findNarrativeMetaLeaks, NarrativeInvariantError };',
  gcCtx,
);
const { verifySceneProvenance, FOUNDATION_FIELDS, findNarrativeMetaLeaks } = gcCtx.__exports;

const SW = executable(read('src/lib/sceneWriter.js'));
const GC = read('src/lib/generationContext.js');
const XGC = executable(GC);
const MR = executable(read('src/lib/modelRouting.js'));

// ── no file in the drafting core carries its own type test ──
{
  for (const [name, src] of [['sceneWriter.js', SW], ['generationContext.js', XGC], ['modelRouting.js', MR]]) {
    const raw = src.match(/book_type\s*[!=]==\s*['"]nonfiction['"]/g) || [];
    check(`${name}: no raw book_type === 'nonfiction' equality survives`,
      raw.length === 0, raw.join(' | '));
    const lowered = src.match(/String\([^)]*book_type[^)]*\)\s*\.toLowerCase\(\)\s*===\s*['"]nonfiction['"]/g) || [];
    check(`${name}: no private lowercased book_type test survives`,
      lowered.length === 0, lowered.join(' | '));
  }
  check('sceneWriter imports the authority',
    /import \{ isNonfictionProject as isNonfictionProjectAuthority \} from '@\/lib\/projectType'/.test(read('src/lib/sceneWriter.js')));
  check('generationContext imports the authority',
    /import \{ isNonfictionProject as isNonfictionProjectAuthority \} from '@\/lib\/projectType'/.test(GC));
  check('modelRouting imports the authority',
    /import \{ isNonfictionProject as isNonfictionProjectAuthority \} from '@\/lib\/projectType'/.test(read('src/lib/modelRouting.js')));

  // The six anti-fabrication gates must all be behind the authority.
  const gateCount = (SW.match(/isNonfictionProjectAuthority\(project\)/g) || []).length;
  check('every nonfiction gate in sceneWriter routes through the authority',
    gateCount >= 6, `only ${gateCount} call(s) found`);
}

// ── the shapes that used to diverge ──
{
  const shapes = [
    ['declared via project_type only', { id: 'p1', project_type: 'nonfiction', genre: 'History' }, true],
    ['declared with a capital N', { id: 'p2', book_type: 'Nonfiction' }, true],
    ['declared with a trailing space', { id: 'p3', book_type: 'nonfiction ' }, true],
    ['inferred from genre alone', { id: 'p4', genre: 'True Crime' }, true],
    ['a declared novel in a historical genre', { id: 'p5', book_type: 'fiction', genre: 'Historical Fiction' }, false],
  ];
  for (const [label, project, wantNonfiction] of shapes) {
    check(`the authority is consistent for: ${label}`,
      isNonfictionProject(project) === wantNonfiction && isFictionProject(project) === !wantNonfiction,
      `isNonfictionProject → ${isNonfictionProject(project)}`);
  }

  // isStandaloneFiction gates requiredFieldsFor -> assertGenerationFoundationReady.
  // It is module-private, so assert the property through the source: it must not
  // default an undeclared book_type to fiction, and it must consult the authority.
  const fn = GC.slice(GC.indexOf('function isStandaloneFiction'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  check('isStandaloneFiction no longer defaults an undeclared type to fiction',
    !body.includes("book_type || 'fiction'"), body.replace(/\s+/g, ' ').slice(0, 160));
  check('isStandaloneFiction consults the authority',
    body.includes('isNonfictionProjectAuthority(project)'));
  check('…and still treats an anthology as not-standalone-fiction',
    body.includes("projectType === 'anthology'"));
}

// ── FOUNDATION_FIELDS has one owner ──
{
  check('generationContext exports a frozen foundation-field list',
    Array.isArray(FOUNDATION_FIELDS) && Object.isFrozen(FOUNDATION_FIELDS));
  check('modelRouting derives its list from the shared one instead of redeclaring it',
    /SHARED_FOUNDATION_FIELDS/.test(MR) && !/const FOUNDATION_FIELDS = \['world_md'/.test(MR));
  check('…and writes its extra protected fields down as an explicit delta',
    /EXTRA_PROTECTED_FOUNDATION_FIELDS = \['research_data'\]/.test(MR));
}

// ── PROVENANCE-1: the verifier fails closed ──
{
  const ids = (...n) => n.map((x) => ({ scene_id: x }));

  check('a genuinely missing contract returns (and says so) rather than throwing',
    threw(() => verifySceneProvenance(ids('a', 'b'), null, 'stage-x')) === null);

  const renamed = threw(() => verifySceneProvenance(ids('a', 'b'), { expectedSceneIds: ['a', 'b'] }, 'stage-x'));
  check('a contract with a RENAMED key now throws instead of reading as verified',
    renamed !== null && renamed.code === 'SCENE_CONTRACT_MALFORMED',
    renamed ? `${renamed.code}: ${renamed.message}` : 'did not throw');

  const dupe = threw(() => verifySceneProvenance(ids('a', 'a'), { expected_scene_ids: ['a'] }, 'stage-x'));
  check('a duplicated scene id now throws',
    dupe !== null && dupe.code === 'SCENE_PROVENANCE_VIOLATION',
    dupe ? dupe.message : 'did not throw');

  const extra = threw(() => verifySceneProvenance(ids('a', 'zzz'), { expected_scene_ids: ['a'] }, 'stage-x'));
  check('a fabricated scene id now throws',
    extra !== null && extra.code === 'SCENE_PROVENANCE_VIOLATION',
    extra ? extra.message : 'did not throw');

  const lost = threw(() => verifySceneProvenance(ids('a'), { expected_scene_ids: ['a', 'b'] }, 'stage-x'));
  check('scene loss still throws (the behaviour that already worked)',
    lost !== null && lost.code === 'SCENE_LOST_IN_PIPELINE', lost ? lost.code : 'did not throw');

  check('an exactly-matching set still passes',
    threw(() => verifySceneProvenance(ids('a', 'b', 'c'), { expected_scene_ids: ['a', 'b', 'c'] }, 'stage-x')) === null);
  check('order does not matter',
    threw(() => verifySceneProvenance(ids('c', 'a', 'b'), { expected_scene_ids: ['a', 'b', 'c'] }, 'stage-x')) === null);
}

// ── the meta-leak bank sees lowercase and spelled-out chapter references ──
{
  const shouldCatch = [
    'She thought back to what happened in chapter 3.',
    'Everything since chapter 12 had led here.',
    'As established in Chapter Four, the door was sealed.',
    'In Chapter 7 he had promised her otherwise.',
  ];
  for (const leak of shouldCatch) {
    check(`meta-leak caught: ${JSON.stringify(leak.slice(0, 44))}`,
      findNarrativeMetaLeaks(leak).length > 0);
  }

  const shouldPass = [
    'She read the first chapter and closed the book.',
    'The chapter house stood at the end of the lane.',
  ];
  for (const clean of shouldPass) {
    check(`ordinary prose not flagged: ${JSON.stringify(clean.slice(0, 44))}`,
      findNarrativeMetaLeaks(clean).length === 0,
      JSON.stringify(findNarrativeMetaLeaks(clean)));
  }
}

// ── the closed-world backstop can no longer be silent when it finds nothing ──
{
  const raw = read('src/lib/sceneWriter.js');
  check('a thrown closed-world check is logged, not swallowed',
    !/\} catch \(e\) \{ return \[\]; \}/.test(raw)
    && /\[CLOSED-WORLD\] check threw and found nothing as a result/.test(raw));
  check('a too-thin evidence corpus is announced instead of returning a silent pass',
    /evidence corpus is \$\{EV\.trim\(\)\.length\} chars \(<200\)/.test(raw));
}

// ── BEATFIELD-2: next_location reads the key the schema actually emits ──
{
  const raw = read('src/lib/sceneWriter.js');
  check('next_location reads `setting` (the schema key), not only `location`',
    /next_location: String\(normalizedScenes\[i \+ 1\]\?\.setting/.test(raw));
  const schema = read('src/lib/autonovel.js');
  check('…and the beat schema really does declare `setting`, not `location`',
    /setting/.test(schema) && !/^\s*location:/m.test(schema));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
