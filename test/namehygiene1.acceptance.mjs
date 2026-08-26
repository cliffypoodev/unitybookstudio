// NAMEHYGIENE-1 acceptance — the app must not rename a character the author named.
//
// MEASURED on The Gilded Hour, 2026-08-04. The premise names the house steward
// **Halvard Oriel** — he hands Ilka the key in front of witnesses and is found dead in
// chapter 3. The generated outline instead starred **Idris Oriel**:
//
//   nameHygieneRules.js:53    "Halvard"  is on the Tier-1 blocked AI-default list
//   nameHygieneRules.js:334   Halvard: ["Idris", "Fenwick", "Russell", ...]
//   buildNameExclusionBlock   "...If ANY match the banned list, replace them immediately."
//
// So the architect obeyed and renamed a character the author had specified — and the
// replacement it reached for, "Idris", is the first name of a character in an
// entirely different book in the same library.
//
// The hygiene system is right in general: "Halvard" IS an AI-slop name and banning it
// for INVENTED characters is the whole point. But a name in the premise is not the
// model's invention, it is a specification.
//
// nameRegistry.js uses Vite aliases node cannot resolve, so the real functions are
// extracted by anchor and run in a vm. No logic is re-implemented here.
import fs from 'fs';
import vm from 'vm';

const SRC = fs.readFileSync(new URL('../src/lib/nameRegistry.js', import.meta.url), 'utf8');
const i = SRC.indexOf('export function extractAuthorChosenNames');
const j = SRC.indexOf('═══ END CHARACTER NAMING RULES ═══');
if (i < 0 || j < 0) throw new Error('anchors not found');
const end = SRC.indexOf('}', SRC.indexOf('`;', j));
const ctx = { console: { warn: () => {}, log: () => {} }, String, Set, Array, Object };
vm.createContext(ctx);
vm.runInContext(
  SRC.slice(i, end + 1).replace(/^export /gm, '')
  + '\nthis.buildNameExclusionBlock = buildNameExclusionBlock;'
  + '\nthis.extractAuthorChosenNames = extractAuthorChosenNames;',
  ctx,
);
const { buildNameExclusionBlock, extractAuthorChosenNames } = ctx;

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const PREMISE = "Ilka Thornbury, a repairer of automata, is summoned to Ashby House. "
  + "Halvard Oriel, the house steward, insists he handed her the brass winding key in front of witnesses. "
  + "Her employer is Edmund Ashby. Housekeeper Mrs. Aldous speaks to Ilka in French.";
const BANNED = ['Halvard', 'Elias', 'Kaelen', 'Idris', 'Aria', 'Thorne'];

// ── the defect ──
{
  const b = buildNameExclusionBlock(BANNED, PREMISE);
  check('a banned name the author used is NOT in the ban list',
    !/BANNED NAMES:[^\n]*\bHalvard\b/.test(b), (b.match(/BANNED NAMES:.*/) || [''])[0]);
  check('it is stated positively as required instead',
    /AUTHOR-SPECIFIED NAMES[^\n]*\bHalvard\b/.test(b), (b.match(/AUTHOR-SPECIFIED NAMES.*/) || [''])[0]);
  check('the model is told not to substitute it', /Do not substitute/.test(b));
  check('banned names the author did NOT use are still banned',
    ['Elias', 'Kaelen', 'Aria', 'Thorne'].every((n) => new RegExp(`BANNED NAMES:[^\\n]*\\b${n}\\b`).test(b)),
    (b.match(/BANNED NAMES:.*/) || [''])[0]);
  check('the replacement the model actually reached for stays banned',
    /BANNED NAMES:[^\n]*\bIdris\b/.test(b));
}

// ── unchanged behaviour when no premise is supplied ──
{
  const before = buildNameExclusionBlock(BANNED);
  check('with no author text every name is still banned',
    BANNED.every((n) => new RegExp(`BANNED NAMES:[^\\n]*\\b${n}\\b`).test(before)));
  check('with no author text no protection section is emitted',
    !/AUTHOR-SPECIFIED NAMES/.test(before));
  check('an empty ban list still returns nothing', buildNameExclusionBlock([]) === '');
  check('a null ban list still returns nothing', buildNameExclusionBlock(null, PREMISE) === '');
}

// ── extraction is literal: exact capitalised tokens only, no guessing ──
{
  const names = extractAuthorChosenNames(PREMISE);
  check('a capitalised name in the premise is found', names.has('Halvard') && names.has('Ilka'));
  check('a lowercase word is not a name', !names.has('steward') && !names.has('witnesses'));
  check('a name the premise does not contain is not found', !names.has('Idris'));
  check('empty text yields nothing', extractAuthorChosenNames('').size === 0);
  check('null text does not throw', extractAuthorChosenNames(null).size === 0);
  check('a lowercase mention does NOT protect a banned name',
    /BANNED NAMES:[^\n]*\bHalvard\b/.test(buildNameExclusionBlock(['Halvard'], 'the halvard mechanism was old')));
}

// ── book-agnostic: three unrelated premises, same behaviour ──
const BOOKS = [
  { id: 'gothic mystery', premise: 'Halvard Oriel, the house steward, kept the key.', used: 'Halvard' },
  { id: 'arctic thriller', premise: 'Kaelen Ortiz sealed the reactor door behind her.', used: 'Kaelen' },
  { id: 'legal thriller', premise: 'Thorne filed the deposition on a Friday.', used: 'Thorne' },
];
for (const b of BOOKS) {
  const block = buildNameExclusionBlock(BANNED, b.premise);
  check(`${b.id}: the author's "${b.used}" is protected`,
    new RegExp(`AUTHOR-SPECIFIED NAMES[^\\n]*\\b${b.used}\\b`).test(block));
  check(`${b.id}: the other banned names stay banned`,
    BANNED.filter((n) => n !== b.used).every((n) => new RegExp(`BANNED NAMES:[^\\n]*\\b${n}\\b`).test(block)));
}

// ── the surrounding rules survive ──
{
  const b = buildNameExclusionBlock(BANNED, PREMISE);
  check('the mandatory-rules header is intact', /CHARACTER NAMING RULES \(MANDATORY\)/.test(b));
  check('the verify-before-finalizing instruction is intact', /VERIFY before finalizing/.test(b));
  check('the block still closes', /END CHARACTER NAMING RULES/.test(b));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
