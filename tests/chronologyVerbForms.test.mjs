// CHRONOVERB-1 proof: a revelation is a revelation in any tense.
//
// Live failure, 2026-07-29, Chapter 2:
//   FAILING EVIDENCE_CONFRONTATION {
//     reqText: 'lena confronts dr. vale about the report.',
//     sigs: ['confrontation','evidence_confrontation'],
//     historyEvents: ['unlock_or_access','confrontation'] }
//   Draft failed: Chronology Error: Evidence revelation must precede
//     evidence-based confrontation.
//
// The plan's order was CORRECT — scene 1 revealed the report, scene 2 confronted
// about it. But scene 1's beat read "Marcus unlocks a hidden report REVEALING
// evidence of foul play", and the revelation matcher accepted only
// discovers|uncovers|reveals|learns. "revealing" matched nothing, so the beat
// produced only an `unlock_or_access` signature and the revelation was invisible.
// This rule has no repair pass — it kills the chapter outright.
import { validateRawBeatChronology } from '@/lib/sceneBeatNormalizer';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}
function accepts(beats) {
  try { validateRawBeatChronology(beats); return true; } catch { return false; }
}
function rejectsWith(beats, fragment) {
  try { validateRawBeatChronology(beats); return false; }
  catch (e) { return String(e.message).includes(fragment); }
}
const scene = (n, ...events) => ({ scene_number: n, scene_id: `ch02-s0${n}`, required_events: events });

// ── The exact plan that died ────────────────────────────────────────────────
check('the real Chapter 2 plan is accepted', accepts([
  scene(1, 'Lena hands the brass key to Marcus.',
           'Marcus unlocks a hidden report revealing evidence of foul play in the accident.'),
  scene(2, 'Lena confronts Dr. Vale about the report.',
           "Dr. Vale tries to dismiss the findings, claiming it's old data.",
           'Marcus intervenes, suggesting they need to go deeper into the station.'),
  scene(3, 'The group encounters a mechanical failure in the stairwell.'),
]));

// ── Every inflection of a revelation satisfies the prerequisite ─────────────
for (const form of [
  'Marcus reveals the report implicating Dr. Vale.',
  'Marcus revealed the report implicating Dr. Vale.',
  'Marcus revealing the report implicating Dr. Vale.',
  'Marcus discovers the report implicating Dr. Vale.',
  'Marcus discovered the report implicating Dr. Vale.',
  'Marcus discovering the report implicating Dr. Vale.',
  'Marcus uncovers the report implicating Dr. Vale.',
  'Marcus uncovered the report implicating Dr. Vale.',
  'Marcus uncovering the report implicating Dr. Vale.',
  'Marcus learns the report implicating Dr. Vale.',
  'Marcus learned the report implicating Dr. Vale.',
]) {
  check(`"${form.split(' ')[1]}" counts as a revelation`, accepts([
    scene(1, form),
    scene(2, 'Lena confronts Dr. Vale about the report.'),
  ]));
}

// ── THE RULE MUST STILL BITE ────────────────────────────────────────────────
check('confronting about evidence with NO prior revelation still throws', rejectsWith([
  scene(1, 'Lena walks the length of the corridor and finds nothing at all.'),
  scene(2, 'Lena confronts Dr. Vale about the report.'),
], 'Evidence revelation must precede'));

check('a revelation AFTER the confrontation still throws', rejectsWith([
  scene(1, 'Lena confronts Dr. Vale about the report.'),
  scene(2, 'Marcus reveals the report implicating Dr. Vale.'),
], 'Evidence revelation must precede'));

check('a plain confrontation with no evidence language is unaffected', accepts([
  scene(1, 'Lena waits in the corridor while the lights cycle.'),
  scene(2, 'Lena confronts Marcus.'),
]));

// ── Ordinary plans keep working ─────────────────────────────────────────────
check('revelation then confrontation, same scene order, is accepted', accepts([
  scene(1, 'Marcus discovers the maintenance log implicating Dr. Vale in the accident.'),
  scene(2, 'Lena confronts Dr. Vale about the accident.'),
]));
check('a single scene with no chronology hazards is accepted', accepts([
  scene(1, 'Lena stands in the dark and listens to the station settle.'),
]));
check('an empty plan is accepted', accepts([]));

console.log('\nCHRONOLOGY VERB FORMS (CHRONOVERB-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
