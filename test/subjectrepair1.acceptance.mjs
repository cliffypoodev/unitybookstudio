// SUBJECTREPAIR-1 + POLISHSAFE-2 acceptance battery.
//
// The external audit of the shipped manuscript quoted "Was wearing…", "Were
// ready…", "Looked at…", "a strange sense of relief wash over her" and "The
// weight in her chest lighten" as generation corruption. Root cause found in
// the app's OWN polish: vocabCaps' pronoun-opener cap deleted the subject
// ("He looked at" → "Looked at", 40 per pass) and antiDetectionPolish's
// telling-tag cap dropped "felt/thought" ("She felt X wash over her" → "X
// wash over her"). 290 dropped-subject openers measured in one 81k-word book.
//
// POLISHSAFE-2 retires both deletions (flag-only). SUBJECTREPAIR-1 repairs
// what shipped and guards new drafts: deterministic finder; the MODEL picks
// only the missing subject from a closed set; the VERIFIER accepts a repair
// only when candidate === "<Subject> " + [felt ] + original (first letter
// lowercased). Anything else is rejected and the original stays.
import fs from 'node:fs';
import { findDroppedSubjectSentences, verifySubjectRepair, repairDroppedSubjects, SUBJECT_REPAIR_VERSION } from '../src/lib/subjectRepair.js';
import { runSentenceStarterVariation } from '../src/lib/vocabCaps.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };
const CAST = ['Zin', 'Rodge', 'JB', 'Sadie', 'Lark'];

const TEXT = [
  'Rodge climbed out of the wreck first. Was wearing his signature leather jacket, though it was now covered in dust. Looked at the horizon and said nothing.',
  'Zin took the wrench from Sadie. A strange sense of relief wash over her. The weight in her chest lighten.',
  '“Was it always this loud?” JB asked. “Looked fine to me.”',
  'Had Rodge known, he would have stopped. Stop. Wait.',
  '* * *',
  'They were a mess. Were a beautiful, chaotic mess.',
].join('\n\n');

// ── 1. finder ──
const found = findDroppedSubjectSentences(TEXT);
const sents = found.map((f) => f.sentence);
check('1. sentence-initial dropped subjects are found ("Was wearing…", "Looked at…", "Were a…")', sents.includes('Was wearing his signature leather jacket, though it was now covered in dust.') && sents.includes('Looked at the horizon and said nothing.') && sents.includes('Were a beautiful, chaotic mess.'));
check('2. bare-verb felt-drops are found ("A strange sense of relief wash over her.", "The weight in her chest lighten.")', found.some((f) => f.kind === 'bare-verb' && f.sentence === 'A strange sense of relief wash over her.') && found.some((f) => f.kind === 'bare-verb' && f.sentence.startsWith('The weight in her chest lighten')));
check('3. dialogue is never a target ("Was it always this loud?" / "Looked fine to me.")', !sents.some((s) => /always this loud|fine to me/.test(s)));
check('4. a real inversion ("Had Rodge known…") and one-word imperatives are not targets', !sents.some((s) => s.startsWith('Had Rodge')) && !sents.includes('Stop.') && !sents.includes('Wait.'));
check('5. the scene-break paragraph is skipped', !sents.some((s) => s.includes('* * *')));

// ── 2. verifier (closed world) ──
const o1 = 'Was wearing his signature leather jacket, though it was now covered in dust.';
check('6. "<Subject> " + original passes and reports the subject', verifySubjectRepair(o1, 'He was wearing his signature leather jacket, though it was now covered in dust.', { castNames: CAST }).subject === 'He');
check('7. a cast name is a legal subject', verifySubjectRepair(o1, 'Rodge was wearing his signature leather jacket, though it was now covered in dust.', { castNames: CAST }).ok);
check('8. any other change is rejected (rewrite / added word / different sentence)', !verifySubjectRepair(o1, 'He was wearing his old leather jacket, though it was now covered in dust.', { castNames: CAST }).ok && !verifySubjectRepair(o1, 'He wore his signature leather jacket.', { castNames: CAST }).ok);
check('9. an unknown subject is rejected (closed set)', !verifySubjectRepair(o1, 'Nolan was wearing his signature leather jacket, though it was now covered in dust.', { castNames: CAST }).ok);
const o2 = 'A strange sense of relief wash over her.';
check('10. bare-verb shape accepts "<Subject> felt " + original', verifySubjectRepair(o2, 'She felt a strange sense of relief wash over her.', { castNames: CAST, kind: 'bare-verb' }).ok);
check('11. bare-verb shape does NOT accept a conjugation rewrite ("A strange sense of relief washed over her.")', !verifySubjectRepair(o2, 'A strange sense of relief washed over her.', { castNames: CAST, kind: 'bare-verb' }).ok);
check('12. the opener shape does NOT accept "felt" (only the bare-verb shape may restore a tag)', !verifySubjectRepair(o1, 'He felt was wearing his signature leather jacket, though it was now covered in dust.', { castNames: CAST, kind: 'opener' }).ok);

// ── 3. the healer with a DI model ──
const stub = async (userPrompt) => {
  const s = userPrompt.split('Sentence missing its subject:\n')[1].split('\n\nReturn')[0];
  if (s.startsWith('Was wearing')) return 'He was wearing his signature leather jacket, though it was now covered in dust.';
  if (s.startsWith('Looked at the horizon')) return 'Rodge looked at the horizon and said nothing.';
  if (s.startsWith('A strange sense')) return 'She felt a strange sense of relief wash over her.';
  if (s.startsWith('The weight')) return 'The weight in her chest lightened.'; // a rewrite → must be rejected
  if (s.startsWith('Were a beautiful')) return 'They were a beautiful, chaotic mess.';
  return 'Something else entirely.';
};
const healed = await repairDroppedSubjects(TEXT, { callLLM: stub, castNames: CAST, label: 'test' });
check('13. verified repairs are applied in place', healed.text.includes('Rodge climbed out of the wreck first. He was wearing his signature leather jacket') && healed.text.includes('Rodge looked at the horizon and said nothing.') && healed.text.includes('She felt a strange sense of relief wash over her.') && healed.text.includes('They were a beautiful, chaotic mess.'));
check('14. a rejected candidate leaves the original untouched', healed.text.includes('The weight in her chest lighten.') && healed.skipped.some((k) => /verify-failed/.test(k.reason)));
check('15. dialogue and the rest of the text are byte-identical', healed.text.includes('“Was it always this loud?” JB asked. “Looked fine to me.”') && healed.text.includes('Had Rodge known, he would have stopped. Stop. Wait.') && healed.text.includes('\n\n* * *\n\n'));
check('16. paragraph count is preserved', healed.text.split(/\n{2,}/).length === TEXT.split(/\n{2,}/).length);
const errRun = await repairDroppedSubjects(TEXT, { callLLM: async () => { throw new Error('boom'); }, castNames: CAST, label: 'err' });
check('17. LLM error fails open (original returned, skips reported)', errRun.text === TEXT && errRun.repaired === 0 && errRun.skipped.length === errRun.found);
check('18. version tag', SUBJECT_REPAIR_VERSION === 'subject-repair-v2');

// ── 3b. SUBJECTREPAIR-1B (live findings from the first pass) ──
check('18b. a curly/straight apostrophe difference is not a content change (live: 40+ good repairs were rejected)', verifySubjectRepair('Looked at the wrench in Sadie’s hand.', "Zin looked at the wrench in Sadie's hand.", { castNames: CAST }).ok);
check('18c. the applied text keeps the book’s typography', verifySubjectRepair('Looked at the wrench in Sadie’s hand.', "Zin looked at the wrench in Sadie's hand.", { castNames: CAST }).applied === 'Zin looked at the wrench in Sadie’s hand.');
check('18d. "Mr. <cast surname>" is a legal subject', verifySubjectRepair('Was reading a newspaper.', 'Mr. Thompson was reading a newspaper.', { castNames: ['Thompson'] }).ok);
check('18e. adjective homographs are no longer targets ("The metal was cool against her palm.", "The night was cool.", "The paper was warm from her hand.")', findDroppedSubjectSentences('The metal was cool against her palm. The night was cool. The paper was warm from her hand. A low hum in the walls.').length === 0);
check('18f. the real felt-drop shape is still found', findDroppedSubjectSentences('A strange sense of peace settle over her, fragile and fleeting.').length === 1);

// ── 4. POLISHSAFE-2: the manufacturing caps are retired ──
const polishText = 'He looked at the door. He looked at the window. He looked at the floor. He looked at the ceiling. He looked at his hands.\n\nShe was tired. She was cold. She was done. She was ready. She was here.';
const loaded = [{ chapter: { chapter_number: 4 }, content: polishText }];
runSentenceStarterVariation(loaded, () => {});
check('19. the pronoun-opener cap no longer deletes subjects (text byte-identical)', loaded[0].content === polishText);
const VOCAB = fs.readFileSync(new URL('../src/lib/vocabCaps.js', import.meta.url), 'utf8');
check('20. the deletion code path is gone from vocabCaps', !VOCAB.includes('"He looked at" → "Looked at" — not perfect but breaks monotony') && VOCAB.includes('POLISHSAFE-2'));
const ANTI = fs.readFileSync(new URL('../src/lib/antiDetectionPolish.js', import.meta.url), 'utf8');
check('21. the telling-tag deletion is retired (flag-only)', !ANTI.includes('// Drop the tag: "He felt the cold" → "The cold"') && ANTI.includes('deletion retired (POLISHSAFE-2)'));

// ── 5. wiring ──
const RUNNER = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url), 'utf8');
check('22. Fix Manuscript runs the repair with its own switch and structure guard', RUNNER.includes('allowSubjectRepairLLM = true') && RUNNER.includes("verifyInvariant('Subject Repair')") && RUNNER.includes('subjectRepaired: subjectStats.repaired'));
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
const finStart = WRITER.indexOf('export async function finalizeChapterProse');
const FIN = WRITER.slice(finStart, WRITER.indexOf('\n}\n', finStart));
check('23. the writer runs the repair on the shipping artifact (after the simile cap, before the article heal)', FIN.includes("repairDroppedSubjects(finalProse, { project, label: 'writer-final', maxRepairs: 20 })") && FIN.indexOf('repairDroppedSubjects') > FIN.indexOf('healSimileDensity') && FIN.indexOf('repairDroppedSubjects') < FIN.indexOf('fixIndefiniteArticles'));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
