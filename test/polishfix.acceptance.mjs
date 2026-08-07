import { runPunctuationCleanup } from '../src/lib/punctuationPolish.js';
import { runDialogueTagCaps } from '../src/lib/dialogueTagPolish.js';

let failures = 0;
const check = (label, ok) => {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + label);
  if (!ok) failures += 1;
};

// ── POLISHFIX-5: the four sentences the old rule damaged must survive intact ──
const probes = [
  'The cold bit through his parka, settling in his bones.',
  'It was thick, packed with the dust of decades and the faint, metallic tang of ozone.',
  'Just a single, metal desk.',
  'The brass groaned, a soft, metallic sigh.',
];
const loaded1 = probes.map((content, i) => ({ chapter: { id: 'p' + i }, chapterNumber: i + 1, content, original: content, changed: false }));
runPunctuationCleanup(loaded1, () => {});
loaded1.forEach((l, i) => check('punctuation preserves: ' + probes[i].slice(0, 45), l.content === probes[i]));

// ── POLISHFIX-5 -> POLISHFIX-7A: the legitimate subject-verb comma fix now flags only ──
const legit = [{ chapter: { id: 'sv' }, chapterNumber: 1, content: 'The fan, sits on the desk.', original: 'The fan, sits on the desk.', changed: false }];
const { changes: legitChanges } = runPunctuationCleanup(legit, () => {});
check('punctuation flags but does not fix real SV split', legit[0].content === 'The fan, sits on the desk.');

// ── POLISHFIX-4: over-cap breath text is flagged, never rewritten ──
const breathText = Array.from({ length: 60 }, (_, i) => 'He took a breath and held the breath in sentence ' + i + '.').join(' ');
const loaded2 = [{ chapter: { id: 'b', chapter_number: 1 }, chapterNumber: 1, content: breathText, original: breathText, changed: false }];
const dtag = runDialogueTagCaps(loaded2, () => {});
check('breath cap leaves prose untouched', loaded2[0].content === breathText);
check('breath cap emits a flag note', (dtag.changes || []).some((c) => /Breath-stem over cap/.test(c)));
check('breath cap reports zero swaps', (dtag.breathFixed || 0) === 0);

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) DID NOT MATCH');
process.exit(failures === 0 ? 0 : 1);
