// NFCLASS-2 acceptance — formats are not types.
//
// PROVEN at 2cfa197: { book_type: '', project_type: 'anthology', genre: 'true crime' } classified
// as FICTION (isNonfictionProject === false, basis 'declared', detail naming "anthology") because
// isNonfictionProject/explainProjectType treated ANY non-empty book_type/project_type string as an
// authoritative declaration — including a FORMAT value like 'anthology' that was never a type.
// A nonfiction anthology series volume therefore bypassed every nonfiction gate.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isNonfictionProject, explainProjectType, declaredType, TYPE_DECLARATIONS, PROJECT_TYPE_VERSION,
} from '../src/lib/projectType.js';
import { buildAnthologyChapterVarietyBlock } from '../src/lib/anthologyVarietyGuard.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

// ── the four scenarios from the master fix plan's PROOF ──
const S1 = { book_type: 'fiction', project_type: 'anthology', genre: 'True Crime' };
const S2 = { book_type: '', project_type: 'anthology', genre: 'true crime' };
const S3 = { book_type: 'nonfiction', project_type: 'anthology', genre: 'True Crime' };
const S4 = { book_type: 'fiction', genre: 'Historical Fiction' };

check('S1. a record that DECLARES fiction stays fiction even inside an anthology format',
  isNonfictionProject(S1) === false, JSON.stringify(explainProjectType(S1)));
check('S1b. …asserted the same way SeriesManager\'s declaredTypeOf will use it: declaredType(S1) === "fiction"',
  declaredType(S1) === 'fiction');

check('S2. THE BUG THIS COMMIT FIXES: an anthology-format volume with nothing declared classifies by genre',
  isNonfictionProject(S2) === true, JSON.stringify(explainProjectType(S2)));
check('S2b. …basis is genre-inference, not declared',
  explainProjectType(S2).basis === 'genre-inference');
check('S2c. …the detail names the ignored format value "anthology"',
  /ignored format "anthology"/.test(explainProjectType(S2).detail), explainProjectType(S2).detail);
check('S2d. …declaredType(S2) is empty — "anthology" is never a type declaration',
  declaredType(S2) === '');

check('S3. a record that declares nonfiction is nonfiction, format aside',
  isNonfictionProject(S3) === true, JSON.stringify(explainProjectType(S3)));
check('S3b. …basis is declared',
  explainProjectType(S3).basis === 'declared');

check('S4. a declared-fiction historical novel stays fiction',
  isNonfictionProject(S4) === false, JSON.stringify(explainProjectType(S4)));

// ── NFCLASS-1 regression: declared fiction + a fiction-qualified genre stays fiction ──
for (const title of ['The Scribe of Galilee', 'The Field of Blood', 'Songbird']) {
  const p = { book_type: 'fiction', project_type: 'fiction', genre: 'Historical Fiction', title };
  check(`NFCLASS-1 regression: "${title}" (declared fiction, Historical Fiction genre) stays fiction`,
    isNonfictionProject(p) === false);
}

// ── erotica / romance genres stay fiction when nothing overrides them ──
check('erotica genre with nothing declared stays fiction',
  isNonfictionProject({ project_type: 'erotica', genre: 'Dark Romance' }) === false);
check('romance genre with nothing declared stays fiction',
  isNonfictionProject({ genre: 'Romance' }) === false);

// ── TYPE_DECLARATIONS is the closed set, frozen ──
check('TYPE_DECLARATIONS is exported and frozen',
  Array.isArray(TYPE_DECLARATIONS) && Object.isFrozen(TYPE_DECLARATIONS));
check('TYPE_DECLARATIONS is exactly [fiction, nonfiction]',
  TYPE_DECLARATIONS.length === 2 && TYPE_DECLARATIONS.includes('fiction') && TYPE_DECLARATIONS.includes('nonfiction'));
check('a format value is never in TYPE_DECLARATIONS',
  !TYPE_DECLARATIONS.includes('anthology'));

// ── version string ──
check('PROJECT_TYPE_VERSION is exported', PROJECT_TYPE_VERSION === 'project-type-v2');

// ── downstream: the anthology variety guard already delegates to the one authority ──
check('buildAnthologyChapterVarietyBlock returns \'\' for S2 (nonfiction anthology, fiction devices must not run)',
  buildAnthologyChapterVarietyBlock(S2, { chapter_number: 3 }, []) === '');

// ── downstream: the RENAMEPASS gate in sceneWriter.js is untouched by this arc ──
{
  const src = read('src/lib/sceneWriter.js');
  check('sceneWriter.js RENAMEPASS gate still reads "isAnthology && !isNF"',
    /if \(isAnthology && !isNF\) \{/.test(src));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
