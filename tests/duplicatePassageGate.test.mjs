// DUPEVENTFIX-1 proof: CURRENT_EVENT_DUPLICATED must fire on a DUPLICATED PASSAGE,
// not on an event that legitimately spans its scene.
//
// Reproduces the failure that killed a real Chapter 2 draft on 2026-07-28:
//   Scene 2 failed deterministic contract audit; repairing: Repeated this scene's
//   required event in multiple separated passages: Lena confronts Marcus and Dr. Vale.
// The scene contained no repetition. `coverage()` scored the event text against each
// paragraph by bag-of-words at ratio >= 0.62, so an event naming three characters was
// "matched" by any paragraph merely naming them — the verb never had to appear. No
// rewrite can satisfy it: a three-hander confrontation must name its three people.
import { auditSceneAgainstLedger } from '@/lib/sceneContractGate';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}
const codes = (prose, events) =>
  (auditSceneAgainstLedger({ prose, accumulatedProse: '', spec: { required_events: events }, runtimeLedger: null }).issues || [])
    .map((i) => i.code);
const dup = (prose, events) => codes(prose, events).includes('CURRENT_EVENT_DUPLICATED');

// ── The real false positive: one continuous confrontation ───────────────────
const confrontation = `Lena found them in the control room. Marcus stood at the console with his back to the door, and Dr. Vale sat hunched over a terminal that threw green light across his face. Neither of them turned when she came in.

"You knew," she said.

Marcus turned around slowly. Dr. Vale did not turn around at all. The silence stretched long enough that Lena understood neither man intended to answer her first question, so she asked a harder one instead.

Marcus looked at Vale. Vale looked at the terminal. Lena watched both of them do it and felt something cold settle behind her ribs, because two men who will not look at each other have already had this conversation without her.

"It is not that simple," Marcus said finally. Dr. Vale said nothing at all, which Lena found more damning than anything Marcus could have offered her.`;
check('a continuous confrontation naming its cast is not a duplicate',
  !dup(confrontation, ['Lena confronts Marcus and Dr. Vale.']));

// ── A durative action that spans the scene ──────────────────────────────────
const search = `Lena started with the lower racks, pulling each drawer out to its stop and running her light across the labels. Nothing in the first bank. Nothing in the second.

The air down here was colder than the corridor and smelled of dust and old adhesive, and she worked without hurrying because hurrying was how you missed things.

By the third bank her fingers had gone numb enough that she had to breathe on them. She kept going. The labels blurred and resolved and blurred again under the beam.

She found it in the last drawer of the fourth bank, filed under a year that had nothing to do with anything, exactly where a person would put something they wanted lost.`;
check('a search that spans the scene is not a duplicate',
  !dup(search, ['Lena searches the archive racks for the file.']));

// ── The defect the gate exists for ──────────────────────────────────────────
const writtenTwice = `Marcus reached into his jacket and drew out the folded report. He held it a moment, then placed it in Lena's hand. The paper was warm from his body. "Read it," he said. "All of it."

She stood there without opening it, listening to the compressor cycle somewhere below the deck plating, aware that Vale had not moved from the terminal since she walked in.

The corridor light stuttered once and steadied. Somewhere aft, a bulkhead settled with a sound like a held breath being let go, and nobody in the room acknowledged it.

Marcus reached into his jacket and drew out the folded report. He held it a moment, then placed it in Lena's hand. The paper was warm from his body. "Read it," he said. "Every page."`;
check('the same passage written twice IS flagged',
  dup(writtenTwice, ['Marcus hands Lena the hidden report.']));

// The old check MISSED this one: "hidden" never appears in the prose, so coverage
// scored the real duplicate at 3/5 = 0.60, under the 0.62 bar.
check('it is caught even when the event wording is absent from the prose',
  dup(writtenTwice, ['Marcus hands Lena the hidden report.']));
check('it is caught with no required_events at all',
  dup(writtenTwice, []));

const issue = auditSceneAgainstLedger({ prose: writtenTwice, accumulatedProse: '', spec: { required_events: ['Marcus hands Lena the hidden report.'] }, runtimeLedger: null })
  .issues.find((i) => i.code === 'CURRENT_EVENT_DUPLICATED');
check('the message names both passages so the repair has a target',
  /Passages 1 and 4/.test(issue.message) && /Keep one and cut the other/.test(issue.message));
check('the similarity is reported', typeof issue.similarity === 'number' && issue.similarity > 0.5);
check('adjacent paragraphs are never compared', issue.paragraphHits[1] - issue.paragraphHits[0] >= 2);

// ── Robustness ──────────────────────────────────────────────────────────────
check('empty prose is safe', !dup('', ['Something happens.']));
check('a single paragraph is safe', !dup('Lena opened the door and went through it without looking back at either of them.', ['Lena leaves.']));
check('short fragments are ignored', !dup('Yes.\n\nNo.\n\nYes.\n\nNo.', ['Someone answers.']));

// ── KNOWN GAP — characterization, not approval ──────────────────────────────
// A fully paraphrased second telling scores 0.238 against the original, inside the
// noise range of legitimately distinct paragraphs (0.085-0.100). No threshold
// separates them; closing this needs the persisted ledger, not a lower bar.
const paraphrasedRepeat = `Marcus reached into his jacket and drew out the folded report. He held it a moment, then placed it in Lena's hand. The paper was warm from his body. "Read it," he said.

She stood there without opening it, listening to the compressor cycle somewhere below the deck plating, aware that Vale had not moved since she walked in.

The corridor light stuttered once and steadied. Somewhere aft, a bulkhead settled with a sound like a held breath being let go, and nobody acknowledged it.

He took the document from his coat a second time and pressed it on her, telling her again that she needed to look at every page of the thing before she said another word.`;
check('KNOWN GAP: a fully paraphrased retelling is not detected',
  !dup(paraphrasedRepeat, ['Marcus hands Lena the hidden report.']));

console.log('\nDUPLICATE PASSAGE GATE (DUPEVENTFIX-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
