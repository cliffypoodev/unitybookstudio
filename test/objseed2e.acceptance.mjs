// OBJSEED-2e acceptance — ONE list of phrase-ending words, shared by every consumer.
//
// The live Brass Meridian ch.2 opening contract reads "Lena holds the activated
// brass decoder key in her pocket". Before this fix that seeded the tracked object
// "activated brass decoder key in her" — a phantom no sentence of prose can match,
// which then demands a written handover that can never be satisfied. There were TWO
// FN-word lists in objectPossession.js, they had drifted apart, and neither one
// contained "in".
//
// Runs the REAL exported functions. Fixtures are drawn from three unrelated books.
import {
  PHRASE_END_WORDS,
  holdersFromSpecState,
  seedTrackedObjectsFromSpecStates,
  trackedObjectsFromSpecs,
} from '../src/lib/objectPossession.js';

let failures = 0;
const check = (label, ok) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label);
  if (!ok) failures += 1;
};
const H = (text, cast) =>
  JSON.stringify(Object.fromEntries(holdersFromSpecState({ entry_state: text }, cast)));
const eq = (label, text, want, cast) => check(label, H(text, cast) === JSON.stringify(want));

const BM = ['Lena Ortiz', 'Marcus Reed', 'Dr. Nolan Vale'];
const WEX = ['Ilka Thornbury', 'Halvard Oriel'];
const LEG = ['Ana Okonkwo', 'Peter Halloway'];

// ── the defect, from the live saved contract ──
eq('live ch.2 contract no longer seeds a phantom',
  "Inside the station's main corridor, standing in shallow, cold water. Lena holds the activated brass decoder key in her pocket.",
  { 'activated brass decoder key': 'Lena Ortiz' }, BM);

// ── every locative preposition ends the object and begins a place ──
eq('locative: in', 'Ilka holds the steel winding key in her apron.', { 'steel winding key': 'Ilka Thornbury' }, WEX);
eq('locative: against', 'Halvard holds the lantern against the wall.', { lantern: 'Halvard Oriel' }, WEX);
eq('locative: over', 'Ana holds the coat over her arm.', { coat: 'Ana Okonkwo' }, LEG);
eq('locative: under', 'Peter holds the folder under his coat.', { folder: 'Peter Halloway' }, LEG);
eq('locative: inside', 'Lena holds the flare gun inside her parka.', { 'flare gun': 'Lena Ortiz' }, BM);
eq('locative: beneath', 'Marcus holds the map beneath the lamp.', { map: 'Marcus Reed' }, BM);
eq('locative: between', 'Ilka holds the songbird between her hands.', { songbird: 'Ilka Thornbury' }, WEX);
eq('particle: up', 'Ilka holds the songbird up to the light.', { songbird: 'Ilka Thornbury' }, WEX);
eq('particle: out', 'Lena holds the flare gun out in front of her.', { 'flare gun': 'Lena Ortiz' }, BM);
eq('adverb: tightly', 'Peter holds the burner phone tightly in one hand.', { 'burner phone': 'Peter Halloway' }, LEG);

// ── compound objects must SURVIVE: "of" is deliberately not a cut point ──
eq('compound survives: sheaf of documents', 'Ana holds the sheaf of documents.', { 'sheaf of documents': 'Ana Okonkwo' }, LEG);
eq('compound survives: set of winding keys', 'Ilka holds the set of winding keys.', { 'set of winding keys': 'Ilka Thornbury' }, WEX);
eq('compound survives: multi-word prop', 'Marcus holds the broken brass key handle.', { 'broken brass key handle': 'Marcus Reed' }, BM);

// ── the SEEDING path now obeys the identical rule (it is the same Set) ──
check('seeding: locative cut',
  JSON.stringify(seedTrackedObjectsFromSpecStates([{
    entry_state: 'Lena holds the activated brass decoder key in her pocket.', characters_present: BM,
  }])) === JSON.stringify(['activated brass decoder key']));
check('seeding: conjunction cut still works',
  JSON.stringify(seedTrackedObjectsFromSpecStates([{
    entry_state: 'Lena holds the key together with Marcus.', characters_present: BM,
  }])) === JSON.stringify(['key']));
check('seeding: purpose cut still works (SEPARATION-1c)',
  JSON.stringify(seedTrackedObjectsFromSpecStates([{
    entry_state: 'Lena takes the key to explore another section.', characters_present: BM,
  }])) === JSON.stringify(['key']));
check('trackedObjectsFromSpecs: declared props and seeded objects agree',
  JSON.stringify(trackedObjectsFromSpecs([{
    props_present: ['Broken brass key handle'],
    entry_state: 'Lena holds the lantern against the wall.',
    characters_present: BM,
  }])) === JSON.stringify(['Broken brass key handle', 'lantern']));

// ── one list, not two ──
check('PHRASE_END_WORDS is exported and shared', PHRASE_END_WORDS instanceof Set && PHRASE_END_WORDS.size > 40);
check('the word that was missing from BOTH lists is present', PHRASE_END_WORDS.has('in'));
check('"of" is deliberately absent', !PHRASE_END_WORDS.has('of'));
for (const w of ['and', 'to', 'into', 'with', 'from', 'at', 'on', 'onto', 'toward', 'towards', 'through', 'under', 'behind', 'or', 'but', 'while', 'as', 'so', 'together', 'still', 'tightly', 'loosely']) {
  check(`legacy cut word retained: "${w}"`, PHRASE_END_WORDS.has(w));
}

// ── book-agnostic: same structure, three books, identical verdicts ──
const BOOKS = [
  { cast: BM, who: 'Lena', obj: 'flare gun', place: 'her parka' },
  { cast: WEX, who: 'Ilka', obj: 'winding key', place: 'her apron' },
  { cast: LEG, who: 'Ana', obj: 'deposition folder', place: 'her briefcase' },
];
for (const prep of ['in', 'inside', 'under', 'against', 'beside', 'behind']) {
  const verdicts = BOOKS.map((b) =>
    H(`${b.who} holds the ${b.obj} ${prep} ${b.place}.`, b.cast) === JSON.stringify({ [b.obj]: b.cast[0] }));
  check(`book-agnostic: "${prep}" cuts identically in all three books`, verdicts.every(Boolean));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
