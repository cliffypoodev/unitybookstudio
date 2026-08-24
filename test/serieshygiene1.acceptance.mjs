// SERIESHYGIENE-1 acceptance — an anthology volume carries the series' real type.
//
// PROVEN at 2cfa197: src/pages/SeriesManager.jsx hardcoded
// `projectPayload.book_type = 'fiction'` for every "Anthology Volume", so a nonfiction
// anthology series (e.g. true crime) spun up new volumes that classified fiction and
// bypassed every nonfiction gate (NFCLASS-2 fixes the classifier; this fixes the writer).
// SeriesManager.jsx is JSX — bare Node cannot import it, so this battery is source-shape
// (read the file, assert the wiring) plus a behavioral re-derivation of declaredTypeOf's
// underlying logic against fixtures shaped like `lastVolume`.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { declaredType } from '../src/lib/projectType.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const sm = read('src/pages/SeriesManager.jsx');

check('1. SeriesManager no longer hardcodes book_type to \'fiction\' for anthology volumes',
  !/projectPayload\.book_type = 'fiction';/.test(sm));
check('2. SeriesManager no longer writes the format string \'anthology\' into book_type either',
  !/projectPayload\.book_type = 'anthology';/.test(sm));
check('3. SeriesManager calls declaredTypeOf(lastVolume) to inherit the series\' real type',
  /const inheritedType = declaredTypeOf\(lastVolume\);/.test(sm));
check('4. SeriesManager imports the one authority\'s declaredType (aliased) from projectType.js',
  /import \{ declaredType as declaredTypeOf, TYPE_DECLARATIONS \} from '@\/lib\/projectType';/.test(sm));
check('5. project_type is still stamped \'anthology\' regardless of inherited book_type',
  /projectPayload\.project_type = 'anthology';/.test(sm));
check('6. no inherited type falls through to an unset book_type (so A1 genre-inference can apply)',
  /else delete projectPayload\.book_type;/.test(sm));

// ── behavioral: the exact function SeriesManager aliases as declaredTypeOf ──
check('7. fixture: nonfiction previous volume -> inherited type is \'nonfiction\'',
  declaredType({ book_type: 'nonfiction', project_type: 'anthology' }) === 'nonfiction');
check('8. fixture: fiction previous volume -> inherited type is \'fiction\'',
  declaredType({ book_type: 'fiction', project_type: 'anthology' }) === 'fiction');
check('9. fixture: no previous volume (undefined) -> inherited type is empty, leaves book_type unset',
  declaredType(undefined) === '');
check('10. fixture: previous volume only declares a format (\'anthology\') -> inherited type is empty',
  declaredType({ project_type: 'anthology' }) === '');

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
