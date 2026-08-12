import { measureRhythm, isSeverelyFlat, isSeverelyGestural, pickBetterTake, buildGestureRegenInstruction, GESTURE_SEVERE } from '../src/lib/proseRhythm.js';
import { inferCastGenders, resolveReferent, normalizeCast } from '../src/lib/referentResolver.js';

let failures = 0;
const check = (l, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + l); if (!ok) failures += 1; };

// ── GESTURE-2: severity gating on measured export-13 per-scene densities ──
const mk = (gest, words = 1400, extra = {}) => ({
  wordCount: words, sentenceCount: 150, meanLen: 8, pctShort: 45, pctLong: 3, maxShortRun: 5,
  gesturesPer1000: { combined: gest, looked: gest * 0.6, turned: gest * 0.3, nodded: gest * 0.1 },
  ...extra,
});
check('threshold is 10/1kw with 400-word floor', GESTURE_SEVERE.minPer1000 === 10 && GESTURE_SEVERE.minWords === 400);
check('measured ch5 s1 (18.2/1kw) triggers', isSeverelyGestural(mk(18.2)) === true);
check('measured ch2 s1 (11.7/1kw) triggers', isSeverelyGestural(mk(11.7)) === true);
check('boundary 10.0/1kw triggers', isSeverelyGestural(mk(10)) === true);
check('measured ch3 s3 (8.4/1kw) does NOT trigger', isSeverelyGestural(mk(8.4)) === false);
check('small samples never trigger', isSeverelyGestural(mk(25, 300)) === false);

// pickBetterTake decision table
const gestBase = mk(15.8);                                        // gestural, not flat
check('gest-only: density improved wins', pickBetterTake(gestBase, mk(8), { flat: false, gestural: true }) === 'candidate');
check('gest-only: density worse loses', pickBetterTake(gestBase, mk(20), { flat: false, gestural: true }) === 'original');
check('gest-only: tie goes to original', pickBetterTake(gestBase, mk(15.8), { flat: false, gestural: true }) === 'original');
check('gest-only: regen that goes severely flat is rejected',
  pickBetterTake(gestBase, mk(4, 1400, { meanLen: 5.5, pctShort: 70, maxShortRun: 12, sentenceCount: 150 }), { flat: false, gestural: true }) === 'original');
const flatBase = mk(5, 1400, { meanLen: 6, pctShort: 65, maxShortRun: 11 }); // flat, not gestural
check('flat-only: rhythm improved wins', pickBetterTake(flatBase, mk(5, 1400, { meanLen: 9, pctShort: 35, maxShortRun: 4, pctLong: 6 }), { flat: true, gestural: false }) === 'candidate');
check('flat-only: regen that goes severely gestural is rejected',
  pickBetterTake(flatBase, mk(14, 1400, { meanLen: 9, pctShort: 35, maxShortRun: 4, pctLong: 6 }), { flat: true, gestural: false }) === 'original');
const bothBase = mk(18.2, 1400, { meanLen: 5.2, pctShort: 68, maxShortRun: 12 });
check('both triggers: both improved wins', pickBetterTake(bothBase, mk(7, 1400, { meanLen: 9, pctShort: 35, maxShortRun: 4, pctLong: 6 }), { flat: true, gestural: true }) === 'candidate');

const gi = buildGestureRegenInstruction(mk(18.2));
check('gesture instruction quotes measured density', gi.includes('18.2'));
check('gesture instruction bans synonym swaps', gi.includes('glanced'));
check('gesture instruction defers to AUTHOR VOICE', gi.includes('AUTHOR VOICE wins'));

// measureRhythm still counts gestures (wiring sanity)
const gm = measureRhythm('Marcus looked at the door. He turned away. Lena nodded once. '.repeat(20));
check('measureRhythm reports gesture density', gm.gesturesPer1000.combined > 100);

// ── KEYLEDGER-4a: the exact false-evidence shapes from the live ch.2 run ──
// Vocative + object pronoun + cross-referent possessive voted Marcus FEMALE.
const poison =
  '“Marcus,” she said quietly. Marcus had looked at her before answering. ' +
  'Lena watched his hands move across the panel. ' +
  '“Marcus,” she repeated. Marcus had looked at her again. Lena watched his shoulders. '.repeat(3);
const poisoned = inferCastGenders(poison, ['Lena Ortiz', 'Marcus Reed']);
check('vocative/object-pronoun poison yields NO false verdict for Marcus',
  (poisoned.find((c) => c.name === 'Marcus Reed').gender || null) !== 'f');
check('cross-referent possessive does not vote Lena male',
  (poisoned.find((c) => c.name === 'Lena Ortiz').gender || null) !== 'm');

// True evidence: subject chain + participial absolute.
const clean =
  'Marcus stopped at the rail. He listened. Marcus said nothing, his jaw tight. ' +
  'He waited. Marcus checked the gauge again. He frowned. Marcus stepped back, his boots loud on the grating. ' +
  'Lena crossed the room. She knelt. Lena worked fast, her fingers steady. She counted. ' +
  'Lena paused at the hatch. She breathed. Lena straightened, her face unreadable.';
const verdicts = inferCastGenders(clean, ['Lena Ortiz', 'Marcus Reed']);
check('subject-chain + absolute evidence confirms Marcus male',
  verdicts.find((c) => c.name === 'Marcus Reed').gender === 'm');
check('subject-chain + absolute evidence confirms Lena female',
  verdicts.find((c) => c.name === 'Lena Ortiz').gender === 'f');

// Two votes stay below threshold.
const sparse = inferCastGenders('Marcus stopped. He waited. Marcus turned back, his face pale.',
  ['Lena Ortiz', 'Marcus Reed']);
check('fewer than 3 votes yields no verdict', !sparse.find((c) => c.name === 'Marcus Reed').gender);

// Quoted speech contributes nothing.
const quoted = inferCastGenders('“Marcus did it. He lied. He ran. He hid,” she said. '.repeat(4),
  ['Lena Ortiz', 'Marcus Reed']);
check('evidence inside quotes is ignored', !quoted.find((c) => c.name === 'Marcus Reed').gender);

// ── KEYLEDGER-4b: closed-world gender uniqueness in resolveReferent ──
const half = normalizeCast(['Lena Ortiz', 'Marcus Reed', 'Dr. Nolan Vale'])
  .map((c) => ({ ...c, gender: c.name === 'Dr. Nolan Vale' ? 'm' : (c.name === 'Lena Ortiz' ? 'f' : null) }));
check('unknown-gender castmate blocks he->Vale uniqueness (the live-run fabrication)',
  resolveReferent('he', half) === null || resolveReferent('he', half).confidence !== 'high');
const full = normalizeCast(['Lena Ortiz', 'Marcus Reed', 'Dr. Nolan Vale'])
  .map((c) => ({ ...c, gender: c.name === 'Lena Ortiz' ? 'f' : 'm' }));
const she = resolveReferent('she', full);
check('she resolves high when every other member is confirmed male',
  she && she.name === 'Lena Ortiz' && she.confidence === 'high');
const he2 = resolveReferent('he', full);
check('he stays unresolved with two confirmed males', he2 === null || he2.confidence !== 'high');
check('named token still resolves high regardless of genders',
  resolveReferent('Marcus', half).confidence === 'high');

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
