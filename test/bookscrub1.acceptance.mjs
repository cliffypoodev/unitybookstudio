// BOOKSCRUB-1 acceptance — a general repair engine must not know one book's cast.
//
// manuscriptFixer.js carried 29 lines of ONE nonfiction manuscript's data across five
// regions in three functions: regex/replacement pairs naming that book's invented
// personas (Marcus al-Rashid, Lillian Choi, Franklin Driscoll, Roberta Hawkins,
// Eleanor Vance, Tomás Gutierrez, Jenny Switzer, Bill Green), its canned credibility
// paragraphs, and the artefacts left when those names became role labels.
//
// The rules were moved VERBATIM into legacyBookScrubRules.data.js — a file whose name
// says it is data — and the engine now asks resolveScrubRules(project) for them. A
// project carries its own on its record; the legacy set is used only as an announced
// fallback so an already-published manuscript is unaffected.
//
// The point of this battery is EQUIVALENCE: the rules must still do exactly what they
// did when they were hardcoded, and a project with its own rules must never see
// another book's names.
import fs from 'fs';
import { LEGACY_BOOK_SCRUB_RULES } from '../src/lib/legacyBookScrubRules.data.js';
import { resolveScrubRules, parseProjectScrubRules, EMPTY_SCRUB_RULES } from '../src/lib/bookScrubRules.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};
const quiet = (fn) => {
  const w = console.warn; const l = console.log;
  console.warn = () => {}; console.log = () => {};
  try { return fn(); } finally { console.warn = w; console.log = l; }
};
const apply = (text, pairs) => pairs.reduce((out, [rx, rep]) => out.replace(rx, rep), text);

// ── the data moved intact ──
{
  const R = LEGACY_BOOK_SCRUB_RULES;
  check('the legacy set is frozen', Object.isFrozen(R));
  check('canned paragraphs survived the move', R.cannedParagraphs.length === 2, String(R.cannedParagraphs.length));
  check('persona repairs survived the move', R.personaRepairs.length === 21, String(R.personaRepairs.length));
  check('surname repairs survived the move', R.surnameRepairs.length === 13, String(R.surnameRepairs.length));
  check('attribution repairs survived the move', R.attributionRepairs.length === 3, String(R.attributionRepairs.length));
  check('every persona repair is [RegExp, string, label]',
    R.personaRepairs.every((p) => p[0] instanceof RegExp && typeof p[1] === 'string' && typeof p[2] === 'string'));
  check('every surname repair is [RegExp, string, label]',
    R.surnameRepairs.every((p) => p[0] instanceof RegExp && typeof p[1] === 'string' && typeof p[2] === 'string'));
}

// ── EQUIVALENCE: the rules still repair what they used to repair ──
{
  const R = LEGACY_BOOK_SCRUB_RULES;
  const cases = [
    ['Paranormal investigator Marcus al-Rashid and his team arrived.', 'A paranormal investigation team'],
    ['Marcus al-Rashid took notes.', 'the investigator took notes.'],
    ['Dr. Lillian Choi examined the wall.', 'the site investigator examined the wall.'],
    ['Franklin Driscoll remembered the fire.', 'a retired guard'],
    ['Roberta Hawkins spoke first.', "a victim’s descendant spoke first."],
    ['Tomás Gutierrez signed the order.', 'the demolition foreman signed the order.'],
    ['Jenny Switzer and Bill Green led the tour.', 'tour guides led the tour.'],
  ];
  for (const [input, expected] of cases) {
    const out = apply(input, R.personaRepairs);
    check(`persona repair still fires: "${input.slice(0, 38)}…"`, out.includes(expected), `got: ${out}`);
  }
  check('the bare surname is still cleaned up on a second pass',
    apply('Driscoll said it was quiet.', R.surnameRepairs).startsWith('the retired guard'),
    apply('Driscoll said it was quiet.', R.surnameRepairs));
  check('attribution repairs still fire',
    apply('Driscoll recalled the night.', R.attributionRepairs) === 'the retired guard recalled the night.',
    apply('Driscoll recalled the night.', R.attributionRepairs));
  check('the canned credibility paragraph is still matched',
    R.cannedParagraphs.some((rx) => { rx.lastIndex = 0; return rx.test('\nThe casualty record should be treated as an evidence problem rather than a conclusion. The available accounts do not cleanly reconcile the count, location, and sequence of the reported deaths. A credible reconstruction cannot solve that arithmetic by assertion; it has to compare the underlying casualty lists, newspaper accounts, institutional reports, and any surviving records that place specific men in specific locations during the riot.\n'); }));
  check('the persona warning still fires on a leftover name',
    R.personaWarningNames.test('and then Hawkins left the room'));
  check('the persona warning does not fire on clean text',
    !R.personaWarningNames.test('Nell Carrow repaired the songbird.'));
}

// ── a project with its own rules never sees another book's names ──
{
  const own = quiet(() => resolveScrubRules({
    id: 'proj-1',
    scrub_rules_json: JSON.stringify({
      personaRepairs: [['\\bJane Roe\\b', 'the witness', 'replaced invented witness']],
      personaWarningNames: '\\bJane Roe\\b',
    }),
  }));
  check('the project\'s own rules are used', own.personaRepairs.length === 1);
  check('the legacy personas are NOT present', !own.personaWarningNames.test('Franklin Driscoll'));
  check('its own persona IS matched', own.personaWarningNames.test('Jane Roe'));
  check('unspecified categories come back empty, not legacy',
    own.surnameRepairs.length === 0 && own.cannedParagraphs.length === 0);
  check('applying its rules repairs its own text',
    apply('Jane Roe testified.', own.personaRepairs) === 'the witness testified.');
}

// ── the fallback is announced, never silent ──
{
  const warns = [];
  const w = console.warn; const l = console.log;
  console.warn = (...a) => warns.push(a.join(' ')); console.log = () => {};
  const legacy = resolveScrubRules({ id: 'no-rules' });
  console.warn = w; console.log = l;
  check('falling back to the legacy set warns', warns.some((x) => /BOOKSCRUB-1.*LEGACY/.test(x)), JSON.stringify(warns));
  check('the fallback really is the legacy set', legacy.personaRepairs.length === 21);
  check('allowLegacy:false yields nothing, so a project can be proven clean',
    quiet(() => resolveScrubRules({ id: 'x' }, { allowLegacy: false })).personaRepairs.length === 0);
  check('EMPTY_SCRUB_RULES is exported and empty',
    EMPTY_SCRUB_RULES.personaRepairs.length === 0 && EMPTY_SCRUB_RULES.personaWarningNames === null);
}

// ── malformed project rules must never kill a repair run ──
{
  check('invalid JSON is ignored, not thrown', quiet(() => parseProjectScrubRules({ id: 'p', scrub_rules_json: '{not json' })) === null);
  check('a missing field is null, not a crash', quiet(() => parseProjectScrubRules({ id: 'p' })) === null);
  const bad = quiet(() => parseProjectScrubRules({ id: 'p', scrub_rules_json: JSON.stringify({ personaRepairs: [['[unclosed', 'x', 'y'], ['\\bOk\\b', 'fine', 'z']] }) }));
  check('an uncompilable pattern is dropped and the rest survive', bad.personaRepairs.length === 1);
  check('a non-object payload is ignored', quiet(() => parseProjectScrubRules({ id: 'p', scrub_rules_json: '"a string"' })) === null);
}

// ── the engine no longer contains the book ──
{
  const engine = fs.readFileSync(new URL('../src/lib/manuscriptFixer.js', import.meta.url), 'utf8');
  const code = engine.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const name of ['al-Rashid', 'Lillian', 'Choi', 'Driscoll', 'Hawkins', 'Gutierrez', 'Switzer', 'Eleanor Vance']) {
    check(`manuscriptFixer code no longer names "${name}"`, !code.includes(name));
  }
  check('manuscriptFixer no longer carries the canned paragraph text',
    !code.includes('casualty record should be treated'));
  check('manuscriptFixer asks for the rules instead', /resolveScrubRules\(project\)/.test(code));
  check('manuscriptFixer does not import the legacy data directly',
    !/legacyBookScrubRules/.test(code));
  check('the repair functions take rules and default to EMPTY, never to another book',
    /removeCannedNonfictionCredibilityParagraphs\(text, rules = EMPTY_SCRUB_RULES\)/.test(code)
    && /replaceSyntheticNonfictionPersonas\(text, rules = EMPTY_SCRUB_RULES\)/.test(code));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
