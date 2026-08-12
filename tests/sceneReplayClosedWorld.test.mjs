// REPLAYFIX-2 proof for validateGeneratedSceneReplay.
//
// Every fixture below is drawn from real UBS Chapter 2 drafts (2026-07-28) via
// __UBS_PIPELINE.exportReplayDiagnostics(), except the two clearly marked
// KNOWN LIMITATION cases.
//
// The gate reports a replay on two paths:
//   Path 1  closed world  — the prose re-enacts a specific required_event that a
//                           prior scene's accepted contract owns.
//   Path 2  near duplicate — a sentence here and a sentence in a prior scene
//                           share the same irreversible-action stem AND either
//                           >= 3 substantive non-trigger tokens or >= 0.75
//                           sentence jaccard.
//
// Path 2's bar was set by measurement. Eight labelled sentence pairs were scored
// and no threshold on (substantive-count, jaccard) separates real replays from
// noise: "the station collapses" twice scores (1, 0.167) while a homonym
// collision on the word "key" scores (1, 0.154). Per ARCH-1 that is where a
// lexical gate stops converging, so Path 2 only claims the failure mode it can
// prove — the drafter copying text forward.
import { validateGeneratedSceneReplay } from '@/lib/sceneBeatNormalizer';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}
const priorProse = (prose) => [{ sceneNumber: 1, acceptedProse: prose }];
const flagged = (cur, prior) => validateGeneratedSceneReplay(cur, prior).ok === false;

// ── Path 1: closed world against the prior scene's accepted contract ─────────

const contractScene = {
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
  acceptedProse: 'Lena rubbed the brass until it warmed. She extended her hand and the metal clicked into his palm.',
};

const restaged = `The corridor was quiet again.

Lena hands the brass key to Marcus once more, her fingers cold against his palm. Marcus examines the key and discovers a hidden compartment containing a report, exactly as before.

Nothing else moved.`;

const t1 = validateGeneratedSceneReplay(restaged, [contractScene]);
check('re-staging a prior required_event is rejected', t1.ok === false);
check('rejection names the specific prior event', t1.replays.some((r) => r.includes('Lena hands the brass key to Marcus')));
check('closed-world rule is recorded', t1.detailedMatches.some((m) => m.rule === 'closed_world_prior_required_event_reenacted'));
check('owning prior scene is recorded', t1.detailedMatches.every((m) => m.priorSceneNumber === 1));

// ── Path 2: real near-duplicates that actually blocked Chapter 2 ─────────────

// Ch.2 scene 2 vs scene 1 — Marcus produces the same key from his pocket twice.
check('near-duplicate clause is rejected (real Ch.2 failure)', flagged(
  'He reached into his pocket and pulled out the brass key.',
  priorProse('He reached into his pocket and pulled out the key.')));

// Ch.2 scene 3 vs scene 1 — a byte-identical sentence copied forward.
check('copied sentence is rejected (real Ch.3 failure)', flagged(
  'Behind her, the Sealed archive door stood dark and indifferent.',
  priorProse('Behind her, the Sealed archive door stood dark and indifferent.')));

// ── The false positives that wasted repair cycles on the real draft ─────────

check('homonym collision on "key" does not reject', !flagged(
  '"The pressure seals on the lower bulkheads." Marcus tapped a final key.',
  priorProse('"Why seal it with a key that only works for one person?" Lena asked.')));

check('a single shared noun ("pocket") does not reject', !flagged(
  'He reached into his pocket.',
  priorProse('He reached into the breast pocket of his parka.')));

check('two incidental shared words ("door", "behind") do not reject', !flagged(
  'The door seals behind you.',
  priorProse('Behind her, the Sealed archive door stood dark and indifferent.')));

check('shared trigger word alone does not reject', !flagged(
  "He didn't lock the door.",
  priorProse('"You overrode the lock.')));

check('lock/reach/drop/break/seal/dead/collapse stuffing does not reject', !flagged(
  'Vale reached the far door and felt it lock. The seal held. He let the folder drop and heard something break. A trapped man, he thought, watching the dead line collapse across the screen.',
  priorProse('Lena rubbed the brass until it warmed. Marcus stood three paces back and did not reach for it.')));

check('contraction remnants ("didn\'t" -> "didn") are not substantive evidence', !flagged(
  "He didn't reach for the console. The room stayed quiet.",
  priorProse("She didn't reach the door in time. The corridor stayed dark.")));

// ── Every echo must be reported, not just the first ─────────────────────────

const twoEchoes = validateGeneratedSceneReplay(
  'Behind her, the Sealed archive door stood dark and indifferent. She waited a while. He reached into his pocket and pulled out the brass key.',
  priorProse('Behind her, the Sealed archive door stood dark and indifferent. Later he reached into his pocket and pulled out the key.'));
check('all echoes are reported so one repair pass can fix them together', twoEchoes.replays.length === 2);
check('each echo quotes both sentences for the repair prompt',
  twoEchoes.replays.every((r) => r.includes('this scene says') && r.includes('already said')));

// ── Robustness ──────────────────────────────────────────────────────────────

check('prior scene without a contract or prose is safe', validateGeneratedSceneReplay('Anything at all.', [{ sceneNumber: 1 }]).ok === true);
check('empty prior list is safe', validateGeneratedSceneReplay('Anything at all.', []).ok === true);
check('null prior list is safe', validateGeneratedSceneReplay('Anything at all.', null).ok === true);
check('non-string required_events are ignored', validateGeneratedSceneReplay('Anything at all.', [{ sceneNumber: 1, spec: { required_events: [null, 42, ''] } }]).ok === true);
check('an event with too few content words is skipped, not guessed',
  validateGeneratedSceneReplay('She leaves the room and the door shuts behind her.', [{ sceneNumber: 1, spec: { required_events: ['She leaves.'] } }]).ok === true);
check('signature block is still returned for diagnostics', Array.isArray(t1.currentSignatures?.functions));

// ── KNOWN LIMITATION — characterization, not approval ───────────────────────
//
// Paraphrased event replay is NOT detected. These two assert the current gap so
// that closing it is a deliberate, visible change rather than an accident.
// Measured: the paraphrases below score (2 substantive, 0.250) and (1, 0.167).
// The false positives above score (2, 0.429) and (1, 0.154). The ranges overlap,
// so no lexical threshold separates them. Closing this needs the persisted
// narrative ledger, not another threshold. If either of these starts returning
// \`false\`, a real semantic layer landed — update this block on purpose.
check('KNOWN GAP: paraphrased abandonment is not detected', !flagged(
  'Once again, Lena abandons Marcus behind, leaving him alone.',
  priorProse('Lena abandons Marcus in the dark corridor, refusing his pleas.')));
check('KNOWN GAP: paraphrased station collapse is not detected', !flagged(
  'The metal groans as the entire station collapses, burying everything.',
  priorProse('The station finally collapses completely around them, crumbling into dust.')));

console.log('\\nSCENE REPLAY (REPLAYFIX-2): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
