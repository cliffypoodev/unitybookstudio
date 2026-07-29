// TRANSFERFIX-1 proof: handing an object to someone is how they come to have it.
//
// Live failure, 2026-07-29, Chapter 2:
//   Draft failed: Chronology Error: Acquire object must precede use object.
//     at validateRawBeatChronology (sceneBeatNormalizer.js:1628)
//
// The plan's order was correct:
//   Scene 1 — "Lena decides to give the key to Marcus, trusting him with it."
//   Scene 2 — "Marcus unlocks the archive with the key, revealing a hidden report."
//
// No matcher understood transfers. The acquisition matcher accepted only
// acquires|obtains|retrieves|takes|grabs|has|holding|carries|possesses, so the
// handover recorded nothing and the next scene's use of the key had no provenance.
// This rule has no repair pass — it throws and the chapter is gone.
import { validateRawBeatChronology } from '@/lib/sceneBeatNormalizer';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}
const accepts = (beats) => { try { validateRawBeatChronology(beats); return true; } catch { return false; } };
const rejectsWith = (beats, frag) => {
  try { validateRawBeatChronology(beats); return false; }
  catch (e) { return String(e.message).includes(frag); }
};
const scene = (n, ...events) => ({ scene_number: n, scene_id: `ch02-s0${n}`, required_events: events });
const handoverThenUse = (giveText) => [
  scene(1, giveText),
  scene(2, 'Marcus unlocks the archive with the key, revealing a hidden report.'),
];

// ── The exact plan that died ────────────────────────────────────────────────
check('the real Chapter 2 plan is accepted', accepts([
  scene(1, "Lena feels paranoid and betrayed after realizing she's trapped outside the archive.",
           "Marcus shows nervousness and avoids Lena's gaze.",
           'Dr. Vale tries to downplay the situation, but Lena is skeptical.',
           'Lena decides to give the key to Marcus, trusting him with it.'),
  scene(2, 'Marcus unlocks the archive with the key, revealing a hidden report.',
           "The report suggests foul play in the accident that killed Lena's father.",
           'Lena confronts Marcus about his hidden agenda.'),
  scene(3, "The station's infrastructure begins to collapse, with shifting ice and mechanical failures."),
]));

// ── Transfer phrasings the architect actually produces ──────────────────────
for (const [label, text] of [
  ['decides to give',  'Lena decides to give the key to Marcus, trusting him with it.'],
  ['gives',            'Lena gives the key to Marcus.'],
  ['gave',             'Lena gave the key to Marcus.'],
  ['hands',            'Lena hands the key to Marcus.'],
  ['handed',           'Lena handed the key to Marcus.'],
  ['passes',           'Lena passes the key to Marcus.'],
  ['offers',           'Lena offers the key to Marcus.'],
  ['entrusts',         'Lena entrusts the key to Marcus.'],
  ['hands over to',    'Lena hands the key over to Marcus.'],
]) {
  check(`"${label}" gives the recipient the object`, accepts(handoverThenUse(text)));
}

// ── The recipient acquires it, not the giver ────────────────────────────────
check('the GIVER does not gain the object', rejectsWith([
  scene(1, 'Marcus gives the key to Dr. Vale.'),
  scene(2, 'Marcus unlocks the archive with the key.'),
], 'Acquire object must precede use object'));

check('a title on the recipient is handled', accepts([
  scene(1, 'Lena hands the key to Dr. Vale.'),
  scene(2, 'Vale unlocks the archive with the key.'),
]));

// ── THE RULE MUST STILL BITE ────────────────────────────────────────────────
check('using an object never acquired still throws', rejectsWith([
  scene(1, 'Lena walks the corridor and listens to the station settle.'),
  scene(2, 'Marcus unlocks the archive with the key.'),
], 'Acquire object must precede use object'));

check('a transfer of a DIFFERENT object does not unlock the rule', rejectsWith([
  scene(1, "Lena gives the folder to Marcus."),
  scene(2, 'Marcus unlocks the archive with the key.'),
], 'Acquire object must precede use object'));

check('a transfer AFTER the use still throws', rejectsWith([
  scene(1, 'Marcus unlocks the archive with the key.'),
  scene(2, 'Lena gives the key to Marcus.'),
], 'Acquire object must precede use object'));

// ── Existing acquisition wording keeps working ─────────────────────────────
check('"takes" still records an acquisition', accepts([
  scene(1, 'Marcus takes the key from the console.'),
  scene(2, 'Marcus unlocks the archive with the key.'),
]));

// ── Scope guard: no new blocking conditions ────────────────────────────────
// acquire_object is only ever read to SATISFY a prerequisite, so a transfer can
// unblock a legitimate plan but must never manufacture a fresh violation.
check('a chapter full of handovers raises nothing on its own', accepts([
  scene(1, 'Lena gives the key to Marcus.'),
  scene(2, 'Marcus gives the key to Dr. Vale.'),
  scene(3, 'Dr. Vale gives the key back to Lena.'),
]));

console.log('\nOBJECT TRANSFER CHRONOLOGY (TRANSFERFIX-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
