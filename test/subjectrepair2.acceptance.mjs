// SUBJECTGUARD-1 acceptance battery — the subject-repair verifier must reject a
// repair that DID prepend a subject but is grammatically or referentially wrong.
//
// Root-cause trace (2026-08-15): the pipeline's subject-repair pass shipped
//   "Were ridiculous."  → "Ottie were ridiculous."          (singular + were)
//   "Was wearing … his hat" → "Ottilie was wearing … his hat" (wrong name: it's Idris)
//   "Looked at Ludo."  → "Thompson looked at Ludo." ×N   (mechanical run)
// because the old verifier only checked that *a* subject was glued to the front.
// This battery locks in: agreement guard, gender-clash guard (reusing the
// closed-world PRONOUNVAR-2 attribution so object pronouns don't false-trip it),
// and the consecutive-same-named-subject repeat guard — while every legitimate
// repair still passes.
import {
  verifySubjectRepair,
  repairDroppedSubjects,
} from '../src/lib/subjectRepair.js';
import { subjectBoundGender } from '../src/lib/pronounLock.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };
const CAST = ['Ottie', 'Ottilie', 'Idris', 'JB', 'Ludo', 'Solveig', 'Yusra', 'Perpetua', 'Thompson'];
const GEN = { Ottie: 'she', Ottilie: 'she', Idris: 'he', Yusra: 'she', Perpetua: 'she', JB: 'he', Ludo: 'he', Thompson: 'he' };
const v = (o, c, kind = 'opener') => verifySubjectRepair(o, c, { castNames: CAST, subjectGender: GEN, kind });

// ── agreement guard ──
check('1. singular "Ottie were ridiculous" is REJECTED (agreement)', (() => { const r = v('Were ridiculous.', 'Ottie were ridiculous.'); return !r.ok && r.reason === 'agreement'; })());
check('2. "Idris were empty" is REJECTED (agreement)', (() => { const r = v('Were empty, but his fingers twitched.', 'Idris were empty, but his fingers twitched.'); return !r.ok && r.reason === 'agreement'; })());
check('3. plural "They were a ragtag collection" is ACCEPTED', v('Were a ragtag collection of scavengers, each more covered in grime than the last.', 'They were a ragtag collection of scavengers, each more covered in grime than the last.').ok);
check('4. "It were" is REJECTED (agreement)', !v('Were quiet.', 'It were quiet.').ok);

// ── gender-clash guard ──
check('5. wrong-name "Ottilie was wearing … his hat" is REJECTED (gender-clash)', (() => { const r = v('Was wearing a duster coat that had seen better centuries, and his hat was pulled low.', 'Ottilie was wearing a duster coat that had seen better centuries, and his hat was pulled low.'); return !r.ok && r.reason === 'gender-clash'; })());
check('6. right-name "Idris was wearing … his hat" is ACCEPTED', v('Was wearing a duster coat that had seen better centuries, and his hat was pulled low.', 'Idris was wearing a duster coat that had seen better centuries, and his hat was pulled low.').ok);
check('7. same-gender possessive "Ottie wiped her brow" is ACCEPTED', v('Wiped her brow.', 'Ottie wiped her brow.').ok);
check('8. pronoun subject is EXEMPT: "She grabbed his arm" ACCEPTED (his = object)', v('Grabbed his arm.', 'She grabbed his arm.').ok);
check('9. object-pronoun cutoff: "Ottie grabbed him by his collar" ACCEPTED', v('Grabbed him by his collar.', 'Ottie grabbed him by his collar.').ok);
check('10. a NAMED subject with a same-gender bound pronoun still ACCEPTED (Idris … his hold)', v('Tightened his hold on the wrench.', 'Idris tightened his hold on the wrench.').ok);

// ── the bare-verb "felt" restore still works ──
check('11. bare-verb "She felt a strange sense of relief wash over her" ACCEPTED', v('A strange sense of relief wash over her.', 'She felt a strange sense of relief wash over her.', 'bare-verb').ok);

// ── still rejects a non-prefix (unchanged contract) ──
check('12. a rewrite that is NOT just a prepended subject is REJECTED', !v('Were ridiculous.', 'The whole thing was ridiculous.').ok);

// ── subjectBoundGender export (used by the guard) ──
check('13. subjectBoundGender counts the subject-bound possessive', (() => { const g = subjectBoundGender('Ottilie was wearing a coat, and his hat was low.', 'Ottilie', CAST); return g.he === 1 && g.she === 0; })());
check('14. subjectBoundGender ignores an OBJECT pronoun after the subject', (() => { const g = subjectBoundGender('Ottie grabbed him by his collar.', 'Ottie', CAST); return g.he === 0; })());

// ── repeat guard (integration through repairDroppedSubjects with a stub LLM) ──
const stub = async (userPrompt) => {
  const m = userPrompt.match(/Sentence missing its subject:\n([\s\S]+?)\n\nReturn/);
  const sent = m ? m[1].trim() : '';
  return 'Thompson ' + sent.charAt(0).toLowerCase() + sent.slice(1);
};
const runRepeat = await repairDroppedSubjects(
  'Looked at Ludo. Looked at the door. Looked back at the wrench.',
  { castNames: CAST, callLLM: stub, label: 'test' },
);
check('15. repeat guard: a run of dropped subjects gets ONE named subject, not a "Thompson … Thompson … Thompson" chain',
  (runRepeat.text.match(/Thompson/g) || []).length === 1,
  `got: ${JSON.stringify(runRepeat.text)}`);

// ── pronoun runs are NOT throttled by the repeat guard ──
const stubShe = async (userPrompt) => {
  const m = userPrompt.match(/Sentence missing its subject:\n([\s\S]+?)\n\nReturn/);
  const sent = m ? m[1].trim() : '';
  return 'She ' + sent.charAt(0).toLowerCase() + sent.slice(1);
};
const runShe = await repairDroppedSubjects(
  'Wiped her brow. Looked at the sky. Reached for the crystal.',
  { castNames: CAST, callLLM: stubShe, label: 'test' },
);
check('16. pronoun subjects are NOT throttled: multiple "She …" repairs all apply',
  (runShe.text.match(/\bShe\b/g) || []).length >= 2,
  `got: ${JSON.stringify(runShe.text)}`);

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
