// TESTSWEEP-1 acceptance battery — every file under tests/ is either wired
// into package.json's test:narrative-connect / test:polish-pipeline scripts,
// or accounted for in tests/run-legacy.mjs's CLASSIFICATION map with a
// specific class and (for anything but 'run') a reason. No file is silently
// dead. tests/run-legacy.mjs has no @/-aliased imports (only node builtins),
// so it is exercised directly here, the way test/run-all.mjs is exercised by
// suite-hygiene.acceptance.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSIFICATION, wiredFiles } from '../tests/run-legacy.mjs';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const TESTS_DIR = new URL('../tests/', import.meta.url);
const TESTS_PATH = fileURLToPath(TESTS_DIR);
const RUNNER_SELF = 'run-legacy.mjs';
const onDisk = fs.readdirSync(TESTS_PATH).filter((f) => (f.endsWith('.mjs') || f.endsWith('.js')) && f !== RUNNER_SELF);
const wired = wiredFiles();
const unwired = onDisk.filter((f) => !wired.has(f));

// ── 1. every unwired tests/ file is in CLASSIFICATION exactly once — zero orphans ──
{
  const missing = unwired.filter((f) => !(f in CLASSIFICATION));
  check('1. every unwired tests/*.mjs|*.js file appears in CLASSIFICATION', missing.length === 0,
    `missing: ${missing.join(', ')}`);
}

// ── 2. no CLASSIFICATION key is also wired (no file double-covered) ──
{
  const doubleCovered = Object.keys(CLASSIFICATION).filter((f) => wired.has(f));
  check('2. no CLASSIFICATION entry is also a wired package.json test file', doubleCovered.length === 0,
    `double-covered: ${doubleCovered.join(', ')}`);
}

// ── 3. no CLASSIFICATION key points at a file missing from both disk and the deleted set ──
{
  const onDiskSet = new Set(onDisk);
  const bogus = Object.entries(CLASSIFICATION).filter(([f, entry]) => entry.class !== 'deleted' && !onDiskSet.has(f));
  check('3. no CLASSIFICATION key (other than deleted) points at a missing file', bogus.length === 0,
    `missing from disk: ${bogus.map(([f]) => f).join(', ')}`);
}

// ── 4. every non-run entry carries a non-empty reason ──
{
  const noReason = Object.entries(CLASSIFICATION).filter(([, e]) => e.class !== 'run' && !(typeof e.reason === 'string' && e.reason.trim().length > 0));
  check('4. every non-run CLASSIFICATION entry carries a non-empty reason', noReason.length === 0,
    `missing reason: ${noReason.map(([f]) => f).join(', ')}`);
}

// ── 5. the runner's summary line format on a fixture map ──
{
  const src = fs.readFileSync(fileURLToPath(new URL('../tests/run-legacy.mjs', import.meta.url)), 'utf8');
  check('5. the runner prints the "legacy: G green, R red, S skipped | C checks" summary format',
    /legacy: \$\{green\} green, \$\{red\} red, \$\{skipped\} skipped\s+\|\s+\$\{checks\} checks/.test(src));
}

// ── 6. deleted entries are absent from disk ──
{
  const deletedStillPresent = Object.entries(CLASSIFICATION)
    .filter(([, e]) => e.class === 'deleted')
    .filter(([f]) => fs.existsSync(path.join(TESTS_PATH, f)));
  check('6. every "deleted" CLASSIFICATION entry is actually absent from disk', deletedStillPresent.length === 0,
    `still present: ${deletedStillPresent.map(([f]) => f).join(', ')}`);
}

// ── 7. no "run" entry names a file that references smoke-test-output ──
{
  const runFiles = Object.entries(CLASSIFICATION).filter(([, e]) => e.class === 'run').map(([f]) => f);
  const offenders = runFiles.filter((f) => {
    const p = path.join(TESTS_PATH, f);
    if (!fs.existsSync(p)) return false;
    return fs.readFileSync(p, 'utf8').includes('smoke-test-output');
  });
  check('7. no "run" entry references smoke-test-output (artifact-writer territory)', offenders.length === 0,
    `offenders: ${offenders.join(', ')}`);
}

// ── 8. package.json wires test:legacy and test:all includes it ──
{
  const pkg = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  check('8. package.json has a test:legacy script running tests/run-legacy.mjs',
    /node tests\/run-legacy\.mjs/.test(pkg.scripts['test:legacy'] || ''));
  check('9. test:all includes test:legacy', /test:legacy/.test(pkg.scripts['test:all'] || ''));
}

// ── 10. classification counts sum to the unwired total (no silent gaps in either direction) ──
{
  const classified = unwired.filter((f) => f in CLASSIFICATION).length;
  check('10. classified-unwired count equals the unwired file count', classified === unwired.length,
    `classified=${classified} unwired=${unwired.length}`);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
