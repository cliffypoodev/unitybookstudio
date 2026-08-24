// NFCLASS-6 acceptance — one authority everywhere.
//
// PROVEN at 2cfa197: 39 call sites across 11 files still classified fiction/nonfiction with a
// local `book_type === 'nonfiction'`-shaped comparison instead of going through the one authority
// (isNonfictionProject / isFictionProject / explainProjectType in projectType.js). This battery
// re-runs the exact DISCOVERY grep from the master fix plan and asserts the count collapses to
// the UI allowlist only.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const PATTERN = /book_type === 'nonfiction'|book_type !== 'nonfiction'|project_type === 'nonfiction'/;

function walk(dir, exts) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

function findMatches(rootDirs) {
  const hits = [];
  for (const d of rootDirs) {
    for (const file of walk(path.join(ROOT, d), ['.js', '.jsx'])) {
      const rel = path.relative(ROOT, file);
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (PATTERN.test(line)) hits.push({ file: rel, line: i + 1 });
      });
    }
  }
  return hits;
}

// ── src/lib, outside projectType.js itself, must be zero ──
const libHits = findMatches(['src/lib']).filter((h) => !h.file.endsWith('projectType.js'));
check('1. src/lib (outside projectType.js) has zero remaining local classification comparisons',
  libHits.length === 0, JSON.stringify(libHits));

// ── src/pages + src/components: remaining hits must equal the UI allowlist exactly ──
const allowlist = JSON.parse(read('test/fixtures/nfclass6-ui-allowlist.json'));
const pageComponentHits = findMatches(['src/pages', 'src/components']);
const hitKey = (h) => `${h.file}:${h.line}`;
const allowKey = (a) => `${a.file}:${a.line}`;
const hitSet = new Set(pageComponentHits.map(hitKey));
const allowSet = new Set(allowlist.map(allowKey));
const sameSize = hitSet.size === allowSet.size;
const setEqual = sameSize && [...hitSet].every((k) => allowSet.has(k));
check('2. src/pages + src/components remaining hits equal the allowlist exactly (set equality)',
  setEqual, `hits=${JSON.stringify([...hitSet])} allow=${JSON.stringify([...allowSet])}`);
check('2b. the allowlist has at least one entry and every entry names a reason',
  allowlist.length >= 1 && allowlist.every((a) => typeof a.reason === 'string' && a.reason.length > 0));

// ── vocabCaps.js must import the authority relatively (it is bare-node-imported by batteries) ──
check('3. vocabCaps.js imports ./projectType.js',
  /import \{ isNonfictionProject \} from '\.\/projectType\.js';/.test(read('src/lib/vocabCaps.js')));

// ── povTense.js is also bare-node-imported (wave2.acceptance.mjs) and must use the same relative form ──
check('4. povTense.js imports ./projectType.js',
  /import \{ isNonfictionProject \} from '\.\/projectType\.js';/.test(read('src/lib/povTense.js')));

// ── app-code files use the alias-path import to the one authority (directly or aliased) ──
for (const [file, rx] of [
  ['src/lib/autonovel.js', /import \{ isNonfictionProject as isNonfictionProjectAuthority \} from '@\/lib\/projectType';/],
  ['src/lib/genreTaxonomy.js', /import \{ isNonfictionProject \} from '@\/lib\/projectType';/],
  ['src/lib/postClean.js', /import \{ isNonfictionProject \} from '@\/lib\/projectType';/],
  ['src/lib/qualityScan.js', /import \{ isNonfictionProject \} from '@\/lib\/projectType';/],
  ['src/pages/ProjectStudio.jsx', /import \{ isNonfictionProject as isNonfictionProjectAuthority \} from '@\/lib\/projectType'; \/\/ NFCLASS-1/],
  ['src/components/notebook/FoundationTab.jsx', /import \{ isNonfictionProject as isNonfictionProjectAuthority \} from '@\/lib\/projectType';/],
]) {
  check(`5. ${file} imports the one authority`, rx.test(read(file)));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
