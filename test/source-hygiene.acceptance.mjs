// SOURCE-HYGIENE acceptance — no fix may be fitted to one manuscript.
//
// The standing architectural rule for this app is that nothing may hardcode a
// specific book: book specifics belong in data (corpus manifest, project records),
// never in code. That rule was asserted in prose and enforced nowhere, which is why
// gates debugged on Brass Meridian kept passing there and failing everywhere else —
// and why a four-chapter gothic mystery, opened for the first time on 2026-08-04,
// produced six book-agnostic defects in ninety minutes that a year on one thriller
// had never surfaced.
//
// This battery makes the rule a test failure instead of an intention. It checks
// CODE, never comments: every fix in this codebase documents itself by citing the
// measured evidence that produced it, and that evidence names real books. A comment
// saying "measured on The Gilded Hour" is the desired behaviour. A string literal
// saying 'the brass key' is not.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib');

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

// Names and props from books in this library. A NEW occurrence of any of these in
// code is a fix being fitted to one manuscript.
const BOOK_TOKENS = [
  'Lena', 'Ortiz', 'Marcus Reed', 'Nolan Vale', 'Brass Meridian',
  'Nell Carrow', 'Wexcombe', 'Gilded Hour', 'Silas Bram',
  'Juneteenth', 'Hollywood Unhinged',
  'the brass key', 'the winding key', 'clockwork songbird',
  // Fabricated-character scrubbers hardcoded for one nonfiction book.
  'Marcus al-Rashid', 'Lillian Choi', 'Franklin Driscoll', 'Eleanor Vance',
];

// Known, pre-existing occurrences, each with the reason it is tolerated. Nothing is
// silently exempt: every entry is printed, so the list can be burned down and so a
// new leak can never hide behind an old one.
const KNOWN = {
  'nameHygieneRules.js': 'CORRECT — these names ARE the banned-name data; listing them is this file\'s entire job.',
  'autonovel.js': 'TOLERATED — illustrative names inside prompt examples teaching a grammar rule; no logic keys on them.',
  'pipelineValidator.js': 'TOLERATED — LITERAL_OBJECTS is a debug-only export on window.__UBS_VALIDATOR. '
    + 'The gate itself takes projectTerms defaulting to empty (BOOKGATE-3). Move it to data when convenient.',
  'legacyBookScrubRules.data.js': 'CORRECT — this file IS one book\'s scrub data, isolated behind a name that says so. '
    + 'manuscriptFixer.js is now the mechanism only (BOOKSCRUB-1). Shrink this to nothing by moving the rules '
    + 'onto that project\'s scrub_rules_json.',
};

const codeOf = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const files = fs.readdirSync(LIB).filter((f) => f.endsWith('.js'));
check('src/lib was found and is not empty', files.length > 20, `${files.length} files`);

const offenders = new Map();
for (const f of files) {
  const code = codeOf(fs.readFileSync(path.join(LIB, f), 'utf8'));
  const hits = BOOK_TOKENS.filter((t) => code.includes(t));
  if (hits.length) offenders.set(f, hits);
}
for (const [f, hits] of offenders) {
  const known = KNOWN[f];
  check(`${f}: book vocabulary in code is accounted for`, Boolean(known), `tokens: ${hits.join(', ')}`);
  if (known) console.log(`      ${hits.join(', ')} — ${known}`);
}
check('no NEW file has introduced book vocabulary into code',
  [...offenders.keys()].every((f) => KNOWN[f]),
  [...offenders.keys()].filter((f) => !KNOWN[f]).join(', '));
for (const f of Object.keys(KNOWN)) {
  if (!offenders.has(f)) console.log(`NOTE  ${f} is now clean — remove it from KNOWN.`);
}

// ── the gates must take a book's vocabulary as INPUT, never bake it ──
const validator = fs.readFileSync(path.join(LIB, 'pipelineValidator.js'), 'utf8');
check('the chapter validator defaults to NO book terms',
  /const NO_TERMS = \{ contamination: \[\], literals: \[\] \}/.test(validator));
check('the chapter validator takes project terms as a parameter',
  /validateChapterOutput\(text, chapterNum = '\?', projectTerms = NO_TERMS\)/.test(validator));
check('the all-chapters validator does too',
  /validateAllChapters\(chapters, projectTerms = NO_TERMS\)/.test(validator));

// ── today's fixes must be parameterised, not fitted ──
const read = (f) => fs.readFileSync(path.join(LIB, f), 'utf8');
{
  const setup = read('setupConstraints.js');
  check('CHAPCOUNT-1 resolves from FIELDS, not from any book\'s number',
    /CHAPTER_COUNT_FIELDS/.test(setup) && !/=== ?['"`]?(4|5|20|22)\b/.test(codeOf(setup).replace(/fallback = null/, '')));
  const op = read('objectPossession.js');
  check('PHRASE_END_WORDS is a word class, not a prop list',
    /export const PHRASE_END_WORDS/.test(op) && !BOOK_TOKENS.some((t) => codeOf(op).includes(t)));
  const rr = read('referentResolver.js');
  check('HONORIFICS is a title class, not a cast list',
    /export const HONORIFICS/.test(rr) && !BOOK_TOKENS.some((t) => codeOf(rr).includes(t)));
  const fsg = read('foundationStorage.js');
  check('STOREDEDUPE-1 hashes content and names no book',
    /export function foundationContentHash/.test(fsg) && !BOOK_TOKENS.some((t) => codeOf(fsg).includes(t)));
  const nr = read('nameRegistry.js');
  check('NAMEHYGIENE-1 takes the author text as a parameter, with no book in code',
    /buildNameExclusionBlock\(bannedNames, authorText = ''\)/.test(nr)
    && !BOOK_TOKENS.some((t) => codeOf(nr).includes(t)));
  const sw = read('sceneWriter.js');
  check('REPEAT-1 thresholds are numbers, not phrases from one book',
    /export const REPEAT_RULES/.test(sw) && !/REPEAT_RULES[\s\S]{0,400}(brass|winding key|songbird)/i.test(sw));
}

// ── a fix must not key on a genre or a project id either ──
{
  const idish = [];
  for (const f of files) {
    const code = codeOf(fs.readFileSync(path.join(LIB, f), 'utf8'));
    // Live project ids in this app look like ms63q026-3tx6cfuo — two 8-char
    // segments, BOTH containing a digit. Requiring the digits is what separates an
    // id from a kebab-case identifier like 'thriller-contrast', which the first
    // version of this check flagged.
    const rx = /['"]([a-z0-9]{8})-([a-z0-9]{8})['"]/g;
    let m;
    while ((m = rx.exec(code)) !== null) {
      if (/[0-9]/.test(m[1]) && /[0-9]/.test(m[2])) { idish.push(`${f} (${m[0]})`); break; }
    }
  }
  check('no library file hardcodes a live project id', idish.length === 0, idish.join(', '));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
