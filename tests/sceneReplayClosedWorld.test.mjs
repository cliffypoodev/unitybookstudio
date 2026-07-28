// REPLAYFIX-1 proof: scene-replay rejection must be driven by a prior scene's
// ACCEPTED CONTRACT events, not by generic English words shared between two
// structurally distinct scenes.
//
// The false-positive fixture below reproduces the exact shape that rejected a
// real Chapter 2 draft on 2026-07-28: two different scenes, same recurring cast,
// both containing ordinary words like "lock", "reach", "drop" and "break".
import { validateGeneratedSceneReplay } from '@/lib/sceneBeatNormalizer';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}

const priorScene = {
  sceneId: 'ch02-s01',
  sceneNumber: 1,
  spec: {
    scene_id: 'ch02-s01',
    required_events: [
      'Lena hands the brass key to Marcus.',
      'Marcus examines the key and discovers a hidden compartment containing a report.',
      'The report suggests foul play in the accident.',
    ],
  },
  acceptedProse: 'Lena rubbed the brass until it warmed. Marcus stood three paces back. She extended her hand and the metal clicked into his palm.',
};

// A genuinely different scene that happens to share the cast and a handful of
// very common verbs. This MUST draft.
const distinctScene = `The monitor's glow washed over Dr. Vale's face. He sat alone in the monitoring room, the air thick with ozone.

A spike in temperature. Level 3. Two hours before the accident. Vale reached for the panel and felt the housing lock under his hand.

He let the pen drop. Something would break soon, and Marcus would have to answer for it. Lena could not be told yet.`;

// A literal re-staging of the prior scene's documented events. This MUST fail.
const restagedScene = `The corridor was quiet again.

Lena hands the brass key to Marcus once more, her fingers cold against his palm. Marcus examines the key and discovers a hidden compartment containing a report, exactly as before.

Nothing else moved.`;

const t1 = validateGeneratedSceneReplay(distinctScene, [priorScene]);
check('distinct scene sharing cast + common words is NOT a replay', t1.ok === true);
check('distinct scene reports zero replays', t1.replays.length === 0);

const t2 = validateGeneratedSceneReplay(restagedScene, [priorScene]);
check('literal re-staging of a prior required_event IS rejected', t2.ok === false);
check('rejection names the specific prior event', t2.replays.some((r) => r.includes('Lena hands the brass key to Marcus')));
check('rejection uses the closed-world rule', t2.detailedMatches.every((m) => m.rule === 'closed_world_prior_required_event_reenacted'));
check('rejection records which prior scene owns the event', t2.detailedMatches.every((m) => m.priorSceneNumber === 1));

// The old detector fired on these stems alone. None of them may reject a scene now.
const stemDecoy = 'Vale reached the far door and felt it lock. The seal held. He let the folder drop and heard something break. A trapped man, he thought, watching the dead line collapse across the screen. Marcus and Lena would never know.';
const t3 = validateGeneratedSceneReplay(stemDecoy, [priorScene]);
check('lock/reach/drop/break/seal/dead/collapse alone cannot reject a scene', t3.ok === true);

// Robustness: absent or malformed prior contracts must not crash or reject.
check('prior scene without a spec is ignored', validateGeneratedSceneReplay(distinctScene, [{ sceneNumber: 1, acceptedProse: 'x' }]).ok === true);
check('empty prior list is safe', validateGeneratedSceneReplay(distinctScene, []).ok === true);
check('null prior list is safe', validateGeneratedSceneReplay(distinctScene, null).ok === true);
check('non-string required_events are ignored', validateGeneratedSceneReplay(distinctScene, [{ sceneNumber: 1, spec: { required_events: [null, 42, ''] } }]).ok === true);

// A required_event too short to be distinctive must be skipped rather than guessed at.
const vagueEvent = [{ sceneNumber: 1, spec: { required_events: ['She leaves.'] } }];
check('an event with too few content words is skipped, not guessed', validateGeneratedSceneReplay('She leaves the room and the door shuts behind her.', vagueEvent).ok === true);

// Negation remnants ("didn't" -> "didn") must never be the substantive evidence
// that turns a shared trigger word into a rejection.
const negA = { sceneNumber: 1, acceptedProse: "She didn't reach the door in time. The corridor stayed dark." };
const negB = "He didn't reach for the console. The room stayed quiet.";
check('contraction remnants alone cannot reject a scene', validateGeneratedSceneReplay(negB, [negA]).ok === true);

check('signature block is still returned for diagnostics', Array.isArray(t1.currentSignatures?.functions));

console.log('\nSCENE REPLAY CLOSED-WORLD: ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
