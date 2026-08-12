import { measureRhythm, isSeverelyFlat, pickBetterRhythm, buildRhythmRegenInstruction } from '../src/lib/proseRhythm.js';
import { seedTrackedObjectsFromSpecStates, trackedObjectsFromSpecs } from '../src/lib/objectPossession.js';

let failures = 0;
const check = (l, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + l); if (!ok) failures += 1; };

// ── RHYTHM-2: severity gating on the measured ch.1 raw-scene numbers ──
const s1 = { sentenceCount: 265, meanLen: 5.8, pctShort: 64, pctLong: 2, maxShortRun: 11 };
const s2 = { sentenceCount: 245, meanLen: 4.9, pctShort: 74, pctLong: 0, maxShortRun: 16 };
const s3 = { sentenceCount: 207, meanLen: 7.6, pctShort: 45, pctLong: 2, maxShortRun: 6 };
check('measured scene 1 (5.8w/64%/run11) triggers regen', isSeverelyFlat(s1) === true);
check('measured scene 2 (4.9w/74%/run16) triggers regen', isSeverelyFlat(s2) === true);
check('measured scene 3 (7.6w/45%/run6) does NOT trigger', isSeverelyFlat(s3) === false);
check('tiny samples never trigger', isSeverelyFlat({ sentenceCount: 10, meanLen: 3, pctShort: 90, maxShortRun: 9 }) === false);

const flat = measureRhythm('He ran. She fell. It broke. They hid. He looked. She turned. It fell. He rose. She spoke. They ran. '.repeat(5));
const varied = measureRhythm('The station had been dead for eleven years, but the generators still remembered how to breathe, coughing twice before the floodlights stuttered on. Lena stood at the rail. Below her, black water moved through the machinery like something alive, patient and cold, carrying rust in slow circles. She counted ten. When the lights steadied she saw what the water had been hiding, and her hand found the key without her deciding anything at all. '.repeat(3));
check('measurably better regen wins', pickBetterRhythm(flat, varied) === 'candidate');
check('equal regen loses (tie goes to original)', pickBetterRhythm(flat, flat) === 'original');
check('worse regen loses', pickBetterRhythm(varied, flat) === 'original');
const instr = buildRhythmRegenInstruction(s2);
check('regen instruction quotes measured numbers', instr.includes('4.9') && instr.includes('74%') && instr.includes('16'));
check('regen instruction defers to AUTHOR VOICE', instr.includes('AUTHOR VOICE wins'));

// ── KEYLEDGER-3: seeding from the ACTUAL ch.1 beat-state shapes ──
const ch1 = [
  { exit_state: 'Lena holds the brass key, intrigued by its engraving. The group begins their exploration of the station interior.',
    required_events: ['Lena notices the brass key in the snow near the entrance.', 'Lena retrieves the key, examining its intricate design.'] },
  { entry_state: 'The group is inside the station, exploring the first section. Lena is examining the brass key.' },
];
check('ch1 beat states seed ["brass key"]', JSON.stringify(trackedObjectsFromSpecs(ch1)) === '["brass key"]');
const ch4 = [{ entry_state: 'The key is in Lena Ortiz\u2019s possession. Water is rising.', exit_state: 'The key remains in Lena\u2019s possession.' }];
check('possessive shape seeds ["key"]', JSON.stringify(seedTrackedObjectsFromSpecStates(ch4)) === '["key"]');
const noise = [{ entry_state: 'The group takes the stairs down. Lena holds the lead. She takes a deep breath. Marcus takes charge. He holds his ground. She takes a step back. Vale keeps the silence.' }];
check('idiom/motion/body noise seeds nothing', JSON.stringify(seedTrackedObjectsFromSpecStates(noise)) === '[]');
const multi = [{ exit_state: 'Marcus carries the folder of documents. Vale keeps the revolver.' }];
check('multi-word and plain props both seed', JSON.stringify(seedTrackedObjectsFromSpecStates(multi)) === '["folder of documents","revolver"]');
check('props_present still wins and dedupes', JSON.stringify(trackedObjectsFromSpecs([{ props_present: ['Brass Key'], exit_state: 'Lena holds the key.' }])) === '["Brass Key"]');

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
