// HYGIENE-1 acceptance battery — generic fixture names, behavior byte-identical.
//
// Two real casts ran through the batteries and the source: the fiction
// flagship's cast (Zinnia/Zin, Roderick/Rodge, Lark, Sadie, Nolan-as-a-
// character, Quark, Krye, Missy, Spanner, Marlowe) and a second book's cast
// (Silas, Nell, Carrow, Bram, Wexcombe), plus Dean (finding 35a's invented
// name). All 18 were renamed to generic substitutes, comments and fixture
// strings only — never a rule, a dictionary key, or a regex that runs on
// prose. Full retirement/replacement table below is DATA the battery checks
// against, not re-implemented logic.
//
// One documented exception: "Dr. Nolan Vale" (paired with "Lena Ortiz" /
// "Marcus Reed" across ~9 wave-era battery files, e.g. keyledger2's
// {a:'Lena Ortiz', b:'Marcus Reed', c:'Dr. Nolan Vale'}) is a THIRD,
// independent pre-plan fixture identity — unrelated to either the fiction
// flagship or the second book's incident — and rides along with Marcus/Lena
// under the master plan's own "pre-plan fixture names... leave them"
// carve-out. It is excluded from checks 1/2 by name-plus-surname match, not
// by file, so a stray bare "Nolan" anywhere else still fails the check.
//
// HYGIENE-1B (finding 53): the original mechanical pass also renamed two
// names sitting inside RULE DATA, not fixture text — anthologyRenamePass.js's
// NEUTRAL_POOL (a real rename-candidate pool for real books) and
// canonNameLock.js's inferAliasPairs (a real alias-drift check pair). Both
// restored; both files are exempt here for the same reason nameHygieneRules.js
// is — they are data a real book's processing reads, not a fixture string —
// filed as an Arc J LEGACYREPAIR-1 item to properly generalize that data
// later instead of leaving invented-sounding names as rule content.
import fs from 'node:fs';
import path from 'node:path';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const RETIRED = [
  'Zinnia', 'Zin', 'Roderick', 'Rodge', 'Lark', 'Sadie', 'Nolan',
  'Quark', 'Krye', 'Missy', 'Spanner', 'Marlowe',
  'Silas', 'Nell', 'Carrow', 'Bram', 'Wexcombe', 'Dean',
];
const REPLACEMENTS = [
  'Ottilie', 'Ottie', 'Ludovic', 'Ludo', 'Solveig', 'Yusra', 'Idris',
  'Brisa', 'Vashti', 'Perpetua', 'Tamsin', 'Quillon',
  'Halvard', 'Ilka', 'Thornbury', 'Oriel', 'Ashby', 'Fenwick',
];
const EXEMPT_REASONS = new Map([
  ['nameHygieneRules.js', 'rule data — the retirement dictionary itself'],
  ['legacyProseRepairs.data.js', 'rule data — regexes that run on prose'],
  ['manuscriptFixer.js', 'rule data — regexes that run on prose'],
  ['anthologyRenamePass.js', 'rule data — Arc J LEGACYREPAIR-1'],
  ['canonNameLock.js', 'rule data — Arc J LEGACYREPAIR-1'],
]);
const EXEMPT_FILES = new Set(EXEMPT_REASONS.keys());

const TEST_DIR = new URL('.', import.meta.url);
const SRC_LIB_DIR = new URL('../src/lib/', import.meta.url);
const SELF = path.basename(new URL(import.meta.url).pathname);
// This battery itself necessarily names every retired name (the DATA it
// checks against) and is not a fixture file, so it is excluded from the
// scan the same way suite-hygiene.acceptance.mjs excludes itself.
const testFiles = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.acceptance.mjs') && f !== SELF);
const srcLibFiles = fs.readdirSync(SRC_LIB_DIR).filter((f) => f.endsWith('.js'));

function stripNolanValeExemption(text) {
  // Blank out every "Dr. Nolan Vale" / "Nolan Vale" occurrence before
  // scanning — the one documented, pre-plan fixture exception (see header).
  return text.replace(/(?:Dr\.\s+)?Nolan Vale/g, '');
}

function wholeWordCount(text, name) {
  const rx = new RegExp(`\\b${name}\\b`, 'g');
  return (text.match(rx) || []).length;
}

// ── 1. none of the retired names occurs as a whole word in any test/*.acceptance.mjs ──
{
  const offenders = [];
  for (const file of testFiles) {
    const text = stripNolanValeExemption(fs.readFileSync(new URL(file, TEST_DIR), 'utf8'));
    for (const name of RETIRED) {
      if (wholeWordCount(text, name) > 0) offenders.push(`${file}:${name}`);
    }
  }
  check('1. none of the 18 retired names occurs as a whole word in any test/*.acceptance.mjs (Dr. Nolan Vale exempted)',
    offenders.length === 0, offenders.slice(0, 10).join(', '));
}

// ── 1b. HYGIENE-1B: the two restored rule-data lines are back to their real values ──
{
  const anthology = fs.readFileSync(new URL('anthologyRenamePass.js', SRC_LIB_DIR), 'utf8');
  const canonLock = fs.readFileSync(new URL('canonNameLock.js', SRC_LIB_DIR), 'utf8');
  check('1b. anthologyRenamePass.js NEUTRAL_POOL has "Marlowe" back, not "Quillon"',
    /NEUTRAL_POOL = \[[^\]]*'Marlowe'/.test(anthology) && !/NEUTRAL_POOL = \[[^\]]*'Quillon'/.test(anthology));
  check('1c. canonNameLock.js inferAliasPairs has { a: \'Nikolai\', b: \'Silas\' } back, not \'Halvard\'',
    /\{ a: 'Nikolai', b: 'Silas' \}/.test(canonLock) && !/\{ a: 'Nikolai', b: 'Halvard' \}/.test(canonLock));
}

// ── 2. none occurs in any src/lib/*.js outside the three exempt files ──
{
  const offenders = [];
  for (const file of srcLibFiles) {
    if (EXEMPT_FILES.has(file)) continue;
    const text = stripNolanValeExemption(fs.readFileSync(new URL(file, SRC_LIB_DIR), 'utf8'));
    for (const name of RETIRED) {
      if (wholeWordCount(text, name) > 0) offenders.push(`${file}:${name}`);
    }
  }
  check('2. none of the 18 retired names occurs as a whole word in any src/lib/*.js outside the five exempt files',
    offenders.length === 0, offenders.slice(0, 10).join(', '));
}

// ── 3. the 18 replacement names each occur in at least one battery ──
{
  const allTestText = testFiles.map((f) => fs.readFileSync(new URL(f, TEST_DIR), 'utf8')).join('\n');
  const missing = REPLACEMENTS.filter((name) => wholeWordCount(allTestText, name) === 0);
  check('3. every replacement name occurs in at least one test/*.acceptance.mjs battery',
    missing.length === 0, `missing: ${missing.join(', ')}`);
}

// ── 4. the exempt list is exactly the five files named here, each with a reason ──
check('4. the exempt list is exactly five files: nameHygieneRules.js, legacyProseRepairs.data.js, manuscriptFixer.js, anthologyRenamePass.js, canonNameLock.js',
  EXEMPT_FILES.size === 5
  && ['nameHygieneRules.js', 'legacyProseRepairs.data.js', 'manuscriptFixer.js', 'anthologyRenamePass.js', 'canonNameLock.js'].every((f) => EXEMPT_FILES.has(f)));
check('4b. every exempt file carries a non-empty reason',
  [...EXEMPT_FILES].every((f) => typeof EXEMPT_REASONS.get(f) === 'string' && EXEMPT_REASONS.get(f).length > 0));
check('4c. the two HYGIENE-1B files are exempted specifically as Arc J LEGACYREPAIR-1 rule data',
  EXEMPT_REASONS.get('anthologyRenamePass.js') === 'rule data — Arc J LEGACYREPAIR-1'
  && EXEMPT_REASONS.get('canonNameLock.js') === 'rule data — Arc J LEGACYREPAIR-1');

// ── 5. the five exempt files still exist and still contain the retired names as DATA (untouched) ──
{
  const untouched = [...EXEMPT_FILES].every((file) => {
    const p = new URL(file, SRC_LIB_DIR);
    return fs.existsSync(p) && RETIRED.some((name) => wholeWordCount(fs.readFileSync(p, 'utf8'), name) > 0);
  });
  check('5. the exempt files exist and still carry the retired names as untouched data', untouched);
}

// ── 6. the Nolan-Vale exemption is real and load-bearing (not a no-op regex) ──
{
  const sample = "const CAST = ['Lena Ortiz', 'Marcus Reed', 'Dr. Nolan Vale'];";
  check('6. the Nolan-Vale carve-out actually strips the fixture before scanning',
    wholeWordCount(stripNolanValeExemption(sample), 'Nolan') === 0 && wholeWordCount(sample, 'Nolan') === 1);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
