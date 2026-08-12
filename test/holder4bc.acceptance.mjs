// HOLDER-4b + HOLDER-4c acceptance — the opening contract in the PASSIVE voice,
// and identity resolution that is not fitted to one book's cast.
//
// The passive fixtures are the shape the architect actually emitted on the live
// Brass Meridian TEST ch.5 run at 88b13fdb, where [HOLDER-4] never fired. The
// identity fixtures are the cast of a DIFFERENT book (The Gilded Hour) plus the
// name shapes any future project will contain. Runs the REAL exported functions.
import {
  holdersFromSpecState,
  castMembersIn,
  seedTrackedObjectsFromSpecStates,
  trackedObjectsFromSpecs,
} from '../src/lib/objectPossession.js';
import { normalizeCast } from '../src/lib/referentResolver.js';

let failures = 0;
const check = (label, ok) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label);
  if (!ok) failures += 1;
};
const H = (text, cast) =>
  JSON.stringify(Object.fromEntries(holdersFromSpecState({ entry_state: text }, cast)));
const eq = (label, text, want, cast) => check(label, H(text, cast) === JSON.stringify(want));

const BM = ['Lena Ortiz', 'Marcus Reed'];
const WEX = ['Nell Carrow', 'Silas Bram', 'Edmund Wexcombe', 'Edmund Wexcombe the younger', 'Mrs. Aldous'];
const PUN = ["O'Brien", 'Marie-Claire Dupont', 'José Ramírez', 'van Dijk', 'Mary Anne Fitch'];

// ── the ACTIVE voice must be byte-for-byte unchanged ──
eq('active: single holder still resolves',
  'Lena holds the broken brass key handle, while Marcus has a bandaged left hand.',
  { 'broken brass key handle': 'Lena Ortiz' }, BM);
eq('active: body part still rejected', 'Marcus has a bandaged left hand.', {}, BM);
eq('active: fixture still rejected', 'Lena holds the console.', {}, BM);
eq('active: conjoined subject still ambiguous', 'Lena and Marcus hold the key together.', {}, BM);
eq('active: two names one clause still skipped', 'Lena holds the key and Marcus has a bandage', {}, BM);

// ── HOLDER-4b: the PASSIVE voice ──
eq('passive: live ch.5 form, curly apostrophe',
  'The broken brass key handle is in Lena’s possession.',
  { 'broken brass key handle': 'Lena Ortiz' }, BM);
eq('passive: straight apostrophe',
  "The broken brass key handle is in Lena's possession.",
  { 'broken brass key handle': 'Lena Ortiz' }, BM);
eq('passive: full name possessor',
  "The broken brass key handle is in Lena Ortiz's possession.",
  { 'broken brass key handle': 'Lena Ortiz' }, BM);
eq('passive: "remains in"',
  "The falsified reports document remains in Marcus's possession.",
  { 'falsified reports document': 'Marcus Reed' }, BM);
eq('passive: "stays in"',
  "The flare gun stays in Marcus's possession.",
  { 'flare gun': 'Marcus Reed' }, BM);
eq('passive + active in one entry_state: BOTH harvested',
  "The key handle is in Lena's possession, while Marcus holds the flare gun.",
  { 'key handle': 'Lena Ortiz', 'flare gun': 'Marcus Reed' }, BM);
eq('passive: body part rejected', "The bandaged left hand is in Marcus's possession.", {}, BM);
eq('passive: fixture rejected', "The console is in Lena's possession.", {}, BM);
eq('passive: abstraction rejected', "The weight is in Lena's possession.", {}, BM);
eq('passive: possessor outside the cast is ignored', "The key handle is in Vale's possession.", {}, BM);
eq('passive: pronoun possessor never guessed', 'The key handle is in her possession.', {}, BM);
eq('no entry_state', '', {}, BM);
eq('empty cast', "The key handle is in Lena's possession.", {}, []);

// ── HOLDER-4c: identity on a DIFFERENT book's cast ──
eq('identity: plain cast member',
  "The brass winding key is in Nell's possession.",
  { 'brass winding key': 'Nell Carrow' }, WEX);
eq('identity: a bare shared first name stays ambiguous',
  "The brass winding key is in Edmund's possession.", {}, WEX);
eq('identity: the elder brother by full name',
  "The brass winding key is in Edmund Wexcombe's possession.",
  { 'brass winding key': 'Edmund Wexcombe' }, WEX);
eq('identity: the longer name wins over the name it contains',
  "The brass winding key is in Edmund Wexcombe the younger's possession.",
  { 'brass winding key': 'Edmund Wexcombe the younger' }, WEX);
eq('identity: honorific possessor', // the period is not a clause boundary
  "The brass winding key is in Mrs. Aldous's possession.",
  { 'brass winding key': 'Mrs. Aldous' }, WEX);
eq('identity: honorific character by surname alone',
  "The brass winding key is in Aldous's possession.",
  { 'brass winding key': 'Mrs. Aldous' }, WEX);
eq('identity: two objects sharing a noun stay separate',
  "The steel winding key is in Nell's possession, while Silas holds the brass winding key.",
  { 'steel winding key': 'Nell Carrow', 'brass winding key': 'Silas Bram' }, WEX);
eq('identity: active voice, full colliding name',
  'Edmund Wexcombe the younger holds the brass winding key.',
  { 'brass winding key': 'Edmund Wexcombe the younger' }, WEX);
eq('identity: active voice, bare colliding name is ambiguous',
  'Edmund holds the brass winding key.', {}, WEX);

// ── HOLDER-4c: name shapes any future project will contain ──
eq('name shape: apostrophe', "The ledger is in O'Brien's possession.", { ledger: "O'Brien" }, PUN);
eq('name shape: hyphenated', "The ledger is in Marie-Claire's possession.", { ledger: 'Marie-Claire Dupont' }, PUN);
eq('name shape: accented', "The ledger is in José's possession.", { ledger: 'José Ramírez' }, PUN);
eq('name shape: accented, full name', "The ledger is in José Ramírez's possession.", { ledger: 'José Ramírez' }, PUN);
eq('name shape: lowercase particle', "The ledger is in van Dijk's possession.", { ledger: 'van Dijk' }, PUN);
eq('name shape: three parts', "The ledger is in Mary Anne Fitch's possession.", { ledger: 'Mary Anne Fitch' }, PUN);
eq('name shape: mononym', "The ledger is in Sable's possession.", { ledger: 'Sable' }, ['Sable', 'Cray']);
eq('name shape: name ending in s, bare apostrophe', "The ledger is in Silas' possession.", { ledger: 'Silas Bram' }, WEX);
eq('object noun with an accent', "The déjeuner tray is in José's possession.", { 'déjeuner tray': 'José Ramírez' }, PUN);

// ── castMembersIn is the shared resolver, and it never invents anybody ──
check('castMembersIn: a definite article resolves nobody',
  JSON.stringify(castMembersIn('The door was open.', normalizeCast(WEX))) === '[]');
check('castMembersIn: an unknown name resolves nobody',
  JSON.stringify(castMembersIn('Vale crossed the hall.', normalizeCast(WEX))) === '[]');
check('castMembersIn: two distinct members are both reported',
  JSON.stringify(castMembersIn('Nell watched Silas.', normalizeCast(WEX))) === JSON.stringify(['Nell Carrow', 'Silas Bram']));

// ── BOOK-AGNOSTIC: the same structure, three unrelated books, identical verdicts ──
const BOOKS = [
  { cast: ['Lena Ortiz', 'Marcus Reed'], obj: 'broken brass key handle', a: 'Lena', b: 'Marcus', obj2: 'flare gun', fixture: 'console', part: 'bandaged left hand' },
  { cast: ['Nell Carrow', 'Silas Bram'], obj: 'brass winding key', a: 'Nell', b: 'Silas', obj2: 'clockwork songbird', fixture: 'window', part: 'bandaged left hand' },
  { cast: ['Ana Okonkwo', 'Peter Halloway'], obj: 'sealed deposition folder', a: 'Ana', b: 'Peter', obj2: 'burner phone', fixture: 'window', part: 'bandaged left hand' },
];
const SHAPES = [
  ['passive positive', (b) => [`The ${b.obj} is in ${b.a}'s possession.`, { [b.obj]: b.cast[0] }]],
  ['passive curly apostrophe', (b) => [`The ${b.obj} is in ${b.a}’s possession.`, { [b.obj]: b.cast[0] }]],
  ['passive "remains in"', (b) => [`The ${b.obj} remains in ${b.b}'s possession.`, { [b.obj]: b.cast[1] }]],
  ['active voice', (b) => [`${b.a} holds the ${b.obj}.`, { [b.obj]: b.cast[0] }]],
  ['mixed, both harvested', (b) => [`The ${b.obj} is in ${b.a}'s possession, while ${b.b} holds the ${b.obj2}.`, { [b.obj]: b.cast[0], [b.obj2]: b.cast[1] }]],
  ['fixture rejected', (b) => [`The ${b.fixture} is in ${b.a}'s possession.`, {}]],
  ['body part rejected', (b) => [`The ${b.part} is in ${b.b}'s possession.`, {}]],
  ['pronoun not guessed', (b) => [`The ${b.obj} is in her possession.`, {}]],
  ['possessor outside cast', (b) => [`The ${b.obj} is in Vale's possession.`, {}]],
];
for (const [label, mk] of SHAPES) {
  const verdicts = BOOKS.map((b) => { const [text, want] = mk(b); return H(text, b.cast) === JSON.stringify(want); });
  check(`book-agnostic: ${label} — identical verdict in all three books`, verdicts.every(Boolean));
}

// ── regression: group 1 still feeds the two existing consumers ──
check('seedTrackedObjectsFromSpecStates still reads m[1]',
  JSON.stringify(seedTrackedObjectsFromSpecStates([{
    entry_state: "The broken brass key handle is in Lena's possession.",
    characters_present: BM,
  }])) === JSON.stringify(['broken brass key handle']));
check('seeding now also works for a non-ASCII possessor',
  JSON.stringify(seedTrackedObjectsFromSpecStates([{
    entry_state: "The ledger is in José's possession.",
    characters_present: PUN,
  }])) === JSON.stringify(['ledger']));
check('trackedObjectsFromSpecs unaffected by the new capture group',
  JSON.stringify(trackedObjectsFromSpecs([{
    props_present: ['Broken brass key handle', 'Hidden console'],
    entry_state: "The flare gun is in Marcus's possession.",
    characters_present: BM,
  }])) === JSON.stringify(['Broken brass key handle', 'flare gun']));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
