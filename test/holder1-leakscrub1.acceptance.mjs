// HOLDER-1 + LEAKSCRUB-1 + EXITSTATE-2 acceptance.
//
// Runs the REAL exported functions. Every fixture is taken from the live Brass
// Meridian TEST ch.4/ch.5 runs of 2026-08-04 — including the exact ledger fold
// that hard-blocked ch.5 and the exact beat-contract leak that reached the gates.
import {
  buildInitialLedger,
  setHolderOfRecord,
  foldChapterLedgers,
  mergeLedgers,
  canonicalizeHolderNames,
  groupObjectSpellings,
  normalizePossessions,
  extractSceneLedgerUpdates,
} from '../src/lib/narrativeLedger.js';
import { isPortablePropPhrase, trackedObjectsFromSpecs } from '../src/lib/objectPossession.js';
import { stripModelControlTokens, stripNonLatinDrift } from '../src/lib/modelLeakGuard.js';
import fs from 'fs';
import vm from 'vm';

// sceneBeatNormalizer.js transitively imports the Vite alias "@/lib", which node
// cannot resolve, so scrubBeatContract is extracted from the REAL source by
// anchor and run in a vm with its two dependencies supplied — the same technique
// the EXITSTATE-1 battery uses. No logic is re-implemented here.
const NORMALIZER_SRC = fs.readFileSync(
  new URL('../src/lib/sceneBeatNormalizer.js', import.meta.url), 'utf8'
);
const scrubStart = NORMALIZER_SRC.indexOf('export function scrubBeatContract(');
const scrubEnd = NORMALIZER_SRC.indexOf('export function normalizeSceneBeatsForDrafting');
if (scrubStart < 0 || scrubEnd < 0) throw new Error('scrubBeatContract anchors not found');
const scrubCtx = { console, Object, Array, String, JSON, stripModelControlTokens, stripNonLatinDrift };
vm.createContext(scrubCtx);
vm.runInContext(
  NORMALIZER_SRC.slice(scrubStart, scrubEnd).replace(/^export /gm, '')
  + '\nthis.scrubBeatContract = scrubBeatContract;',
  scrubCtx
);
const { scrubBeatContract } = scrubCtx;

let failures = 0;
const check = (label, ok) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label);
  if (!ok) failures += 1;
};

const mk = (pairs, extra = {}) => {
  const l = buildInitialLedger();
  for (const [obj, holder] of pairs) setHolderOfRecord(l, obj, holder);
  return Object.assign(l, extra);
};

// The exact ledger state behind the live ch.5 holder line:
//   Lena Ortiz:key/Broken brass key handle/Hidden console/severely injured left
//   Marcus:key   Marcus Reed:broken brass key
const CH4 = mk([
  ['key', 'Lena Ortiz'],
  ['Broken brass key handle', 'Lena Ortiz'],
  ['Hidden console', 'Lena Ortiz'],
  ['severely injured left', 'Lena Ortiz'],
  ["Dr. Vale's cane", 'Dr. Nolan Vale'],
]);
const CH5 = mk([['key', 'Marcus'], ['broken brass key', 'Marcus Reed']], {
  deadCharacters: ['Dr. Vale'],
});

const folded = foldChapterLedgers([CH4, CH5]);
const holdersOf = (led, rx) =>
  Object.entries(led.possessions).filter(([, objs]) => objs.some((o) => rx.test(o))).map(([c]) => c);

// ── HOLDER-1: one object, one holder ──
check('the key has exactly ONE holder after a cross-chapter fold',
  holdersOf(folded, /key/i).length === 1);
check('the later chapter wins the object',
  holdersOf(folded, /key/i)[0] === 'Marcus Reed');
check('a single ledger already enforced one holder (unchanged behaviour)',
  Object.keys(CH4.possessions).length === 2);

// ── HOLDER-1a: one person, one name ──
check('"Marcus" and "Marcus Reed" collapse to one holder',
  !Object.keys(folded.possessions).includes('Marcus'));
check('"Dr. Vale" and "Dr. Nolan Vale" collapse in the dead list',
  folded.deadCharacters.length === 1 && folded.deadCharacters[0] === 'Dr. Nolan Vale');
{
  const m = canonicalizeHolderNames(['Marcus', 'Marcus Reed', 'Lena', 'Lena Ortiz', 'Dr. Vale', 'Dr. Nolan Vale']);
  check('canonicalizeHolderNames maps short forms to the full spelling',
    m.get('Marcus') === 'Marcus Reed' && m.get('Lena') === 'Lena Ortiz' && m.get('Dr. Vale') === 'Dr. Nolan Vale');
  const d = canonicalizeHolderNames(['Marcus Reed', 'Marcus Aurelius']);
  check('two different people sharing a first name are NOT collapsed',
    d.get('Marcus Reed') === 'Marcus Reed' && d.get('Marcus Aurelius') === 'Marcus Aurelius');
}
{
  // A name that only appears in an early chapter must still win later folds.
  const CH6 = mk([['brass key', 'Lena']]);
  const f3 = foldChapterLedgers([CH4, CH5, CH6]);
  check('a full name from an EARLIER chapter still canonicalises a later short form',
    Object.keys(f3.possessions).includes('Lena Ortiz') && !Object.keys(f3.possessions).includes('Lena'));
  check('the handover back to Lena leaves Marcus holding nothing',
    holdersOf(f3, /key/i).length === 1 && holdersOf(f3, /key/i)[0] === 'Lena Ortiz');
}

// ── HOLDER-1b: one object, one name ──
check('the four key spellings collapse to a single tracked entity',
  Object.values(folded.possessions).flat().filter((o) => /key/i.test(o)).length === 1);
{
  const g = groupObjectSpellings(['key', 'brass key', 'broken brass key', 'Broken brass key handle', "Dr. Vale's cane", 'broken cane']);
  check('key ⊂ brass key ⊂ broken brass key ⊂ broken brass key handle is ONE group',
    new Set(['key', 'brass key', 'broken brass key', 'Broken brass key handle'].map((s) => g.get(s))).size === 1);
  check('the group keeps the most specific spelling',
    g.get('key') === 'Broken brass key handle');
  const d = groupObjectSpellings(['brass key', 'iron key']);
  check('"brass key" and "iron key" are NOT merged',
    d.get('brass key') !== d.get('iron key'));
}

// ── HOLDER-1c: phantoms already written into saved ledgers are retired ──
check('"severely injured left" is dropped on read from a saved ledger',
  !Object.values(folded.possessions).flat().some((o) => /injured/i.test(o)));
check('"Hidden console" is dropped on read from a saved ledger',
  !Object.values(folded.possessions).flat().some((o) => /console/i.test(o)));
check('a real prop with a possessive owner survives the fold',
  Object.values(folded.possessions).flat().some((o) => /cane/i.test(o)));
check('isPortablePropPhrase rejects a phrase ending on a modifier',
  !isPortablePropPhrase('severely injured left') && !isPortablePropPhrase('the broken')
  && isPortablePropPhrase('left boot') && isPortablePropPhrase('broken brass key handle'));

// ── mergeLedgers directly: the character-keyed loop was the bug ──
{
  const m = mergeLedgers(mk([['key', 'Lena Ortiz']]), mk([['key', 'Marcus Reed']]));
  check('mergeLedgers no longer leaves an object under two characters',
    Object.keys(m.possessions).length === 1 && m.possessions['Marcus Reed']?.length === 1);
}
check('normalizePossessions is order-sensitive: the LAST map wins',
  normalizePossessions({ A: ['lamp'] }, { B: ['lamp'] }).B?.length === 1
  && !normalizePossessions({ A: ['lamp'] }, { B: ['lamp'] }).A);
check('an empty or malformed input does not throw',
  JSON.stringify(normalizePossessions(null, undefined, { X: null })) === '{}');

// ── LEAKSCRUB-1 ──
{
  // Verbatim from the live ch.5 beat contract.
  const beats = [{
    scene_id: 'ch05-s01',
    exit_state: 'Lena is愤怒 and confronts Marcus, while they prepare to leave the reactor chamber.',
    entry_state: 'Lena and Marcus are in the reactor chamber.',
    required_events: ['Marcus admits his role in the cover-up.', 'Lena is愤怒 about the betrayal.'],
    characters: ['Lena Ortiz', 'Marcus Reed'],
    sceneNumber: 1,
  }];
  const out = scrubBeatContract(beats);
  check('non-Latin drift is removed from the beat contract exit_state',
    !/[一-鿿]/.test(out[0].exit_state));
  check('non-Latin drift is removed from required_events strings',
    !out[0].required_events.some((e) => /[一-鿿]/.test(e)));
  check('a clean field is left byte-identical',
    out[0].entry_state === beats[0].entry_state);
  check('non-string fields are preserved',
    Array.isArray(out[0].characters) && out[0].characters.length === 2 && out[0].sceneNumber === 1);
  check('the input beats are not mutated',
    /[一-鿿]/.test(beats[0].exit_state));
  check('a contract with no drift is passed through unchanged',
    scrubBeatContract([{ exit_state: 'They reach the hatch.' }])[0].exit_state === 'They reach the hatch.');
  check('malformed beats do not throw',
    Array.isArray(scrubBeatContract([null, 'x', undefined])) );
}

// ── HOLDER-2: inherited holder names resolved against the SCENE CAST ──
{
  const CAST = ['Lena Ortiz', 'Marcus Reed'];
  // Exactly the live ch.5 inherited state: chapters 1-4 recorded the holder as
  // bare "Marcus", so the fold had no full spelling to promote it to.
  const prior = buildInitialLedger();
  setHolderOfRecord(prior, 'Broken brass key handle', 'Marcus');
  const spec = {
    characters: CAST,
    entry_state: 'Lena holds the broken key handle. Marcus limps from his earlier injury.',
    exit_state: 'Lena carries the weight of her decision.',
    required_events: [],
    props_present: ['Broken brass key handle', 'broken key handle'],
  };
  const tracked = trackedObjectsFromSpecs([spec]);
  check('HOLDER-2b: "broken key handle" and "Broken brass key handle" are ONE tracked object',
    tracked.length === 1 && /brass/i.test(tracked[0]));
  check('HOLDER-2c: "weight of her decision" is never seeded as a prop',
    !tracked.some((o) => /weight|decision/i.test(o)));

  const out = extractSceneLedgerUpdates(
    prior,
    'Marcus held the broken brass key handle. He turned it over. Lena watched him.',
    spec,
    { sceneCast: CAST, trackedObjects: tracked }
  );
  check('HOLDER-2: an inherited bare "Marcus" is resolved to the cast name "Marcus Reed"',
    Object.keys(out.possessions).includes('Marcus Reed')
    && !Object.keys(out.possessions).includes('Marcus'));
  check('HOLDER-2: the object is not held by two spellings of the same person',
    Object.keys(out.possessions).length === 1);

  // A name that is NOT in the cast must be left alone rather than force-matched.
  const p2 = buildInitialLedger();
  setHolderOfRecord(p2, 'Broken brass key handle', 'Dr. Nolan Vale');
  const out2 = extractSceneLedgerUpdates(p2, 'The chamber was quiet.', spec, {
    sceneCast: CAST, trackedObjects: tracked,
  });
  check('HOLDER-2: an off-cast holder is preserved, not force-matched to the cast',
    Object.keys(out2.possessions).includes('Dr. Nolan Vale'));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
