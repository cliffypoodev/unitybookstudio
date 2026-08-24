// SUBJECTGUARD-2 acceptance battery — actor-continuity guard on subject
// repair, from live-proof finding 1 (claude_UBS-LIVEPROOF-ARC-B-C-2026-08-24.md):
// SUBJECTREPAIR-1's verifier accepted ANY cast name as the restored subject
// as long as it didn't clash with a bound pronoun in the repaired sentence
// itself; a paragraph naming exactly one actor across several sentences
// could still get a DIFFERENT cast member's name prepended. Fixtures use
// invented generic names (Mara, Dov, Ilse), never a real book's cast.
import { verifySubjectRepair, SUBJECT_REPAIR_VERSION } from '../src/lib/subjectRepair.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const CAST = ['Mara', 'Dov', 'Ilse'];

// 1. version
check('1. version', SUBJECT_REPAIR_VERSION === 'subject-repair-v2');

// 2. the live-proof Ch.10 shape (generic names) rejects the wrong name
{
  const paragraph = 'Mara stopped wiping. Her gaze fell on the notebook. Her eyes met Ilse’s. Looked back at the notebook.';
  const sentence = 'Looked back at the notebook.';
  const verdict = verifySubjectRepair(sentence, 'Ilse looked back at the notebook.', { castNames: CAST, kind: 'opener', paragraph });
  check('2. rejects the wrong name (actor-mismatch)', verdict.ok === false && verdict.reason === 'actor-mismatch', JSON.stringify(verdict));
}

// 3. accepts the right name
{
  const paragraph = 'Mara stopped wiping. Her gaze fell on the notebook. Her eyes met Ilse’s. Looked back at the notebook.';
  const sentence = 'Looked back at the notebook.';
  const verdict = verifySubjectRepair(sentence, 'Mara looked back at the notebook.', { castNames: CAST, kind: 'opener', paragraph });
  check('3. accepts the right name', verdict.ok === true && verdict.subject === 'Mara', JSON.stringify(verdict));
}

// 4. accepts a pronoun subject regardless of the established actor
{
  const paragraph = 'Mara stopped wiping. Her gaze fell on the notebook. Her eyes met Ilse’s. Looked back at the notebook.';
  const sentence = 'Looked back at the notebook.';
  const verdict = verifySubjectRepair(sentence, 'She looked back at the notebook.', { castNames: CAST, kind: 'opener', paragraph });
  check('4. accepts "She" (pronoun subject, exempt)', verdict.ok === true && verdict.subject === 'She', JSON.stringify(verdict));
}

// 5. a paragraph with two actors does not fire (ambiguous -> either name accepted)
{
  const paragraph = 'Mara looked at Dov. Dov nodded slowly. Wanted to say something.';
  const sentence = 'Wanted to say something.';
  const v1 = verifySubjectRepair(sentence, 'Mara wanted to say something.', { castNames: CAST, kind: 'opener', paragraph });
  const v2 = verifySubjectRepair(sentence, 'Dov wanted to say something.', { castNames: CAST, kind: 'opener', paragraph });
  check('5. two-actor paragraph: both names accepted (guard does not fire)', v1.ok === true && v2.ok === true, JSON.stringify({ v1, v2 }));
}

// 6. no preceding text (target is the paragraph's first sentence) -> guard never fires
{
  const paragraph = 'Looked back at the notebook. Mara sighed.';
  const sentence = 'Looked back at the notebook.';
  const verdict = verifySubjectRepair(sentence, 'Ilse looked back at the notebook.', { castNames: CAST, kind: 'opener', paragraph });
  check('6. no preceding sentences -> guard never fires', verdict.ok === true, JSON.stringify(verdict));
}

// 7. possessive chain continues across a sentence that also names another
//    cast member as an OBJECT, not just a bare lead-name case
{
  const paragraph = 'Dov crossed the room. His hand brushed Ilse’s shoulder as he passed. His jaw tightened. Turned away without a word.';
  const sentence = 'Turned away without a word.';
  const wrong = verifySubjectRepair(sentence, 'Ilse turned away without a word.', { castNames: CAST, kind: 'opener', paragraph });
  const right = verifySubjectRepair(sentence, 'Dov turned away without a word.', { castNames: CAST, kind: 'opener', paragraph });
  check('7a. possessive chain survives an object-position name mention (wrong name rejected)', wrong.ok === false && wrong.reason === 'actor-mismatch', JSON.stringify(wrong));
  check('7b. possessive chain survives an object-position name mention (right name accepted)', right.ok === true, JSON.stringify(right));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
