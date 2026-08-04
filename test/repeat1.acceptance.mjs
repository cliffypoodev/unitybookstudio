// REPEAT-1 acceptance — in-chapter near-duplicate sentences.
//
// The dedupers this joins were blind where the model actually repeats itself.
// Measured across all five saved Brass Meridian chapters (2026-08-04, dialogue
// excluded): the existing 8-word exact floor caught ZERO in-chapter repeats;
// at 4 words there are 20. Every fixture below either came off that measurement
// or is a control drawn from a different book.
import fs from 'fs';
import vm from 'vm';

// sceneWriter.js imports the Vite alias "@/lib", which node cannot resolve, so
// the detector is extracted from the REAL source by anchor and run in a vm with
// its one dependency (splitSentencesSafe, also taken from the real source). No
// logic is re-implemented here.
const SRC = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
const slice = (a, b) => {
  const i = SRC.indexOf(a); const j = SRC.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error(`anchor not found: ${i < 0 ? a : b}`);
  return SRC.slice(i, j);
};
const ctx = { console, Object, Array, String, Number, Set, Map, JSON, RegExp };
vm.createContext(ctx);
vm.runInContext(
  slice('function splitSentencesSafe(', '// Removes exact duplicate sentences').replace(/^export /gm, '')
  + slice('export const REPEAT_RULES', '// BOOKECHO-2:').replace(/^export /gm, '')
  + '\nthis.findInChapterRepeats = findInChapterRepeats;'
  + '\nthis.stillRepeats = stillRepeats;'
  + '\nthis.REPEAT_RULES = REPEAT_RULES;',
  ctx,
);
const { findInChapterRepeats, stillRepeats, REPEAT_RULES } = ctx;

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};
const FILLER = 'The corridor was cold. Somewhere below, a pump started. Nobody spoke for a while.';
const between = (a, b) => `${a} ${FILLER} ${b}`;
const pairsOf = (t) => findInChapterRepeats(t);

// ── the thresholds are the measurement, so they are part of the contract ──
check('exact-repeat floor is 4 words', REPEAT_RULES.exactMinWords === 4);
check('near-repeat floor is 5 words', REPEAT_RULES.nearMinWords === 5);
check('near-repeat similarity floor is 0.75', REPEAT_RULES.nearMinJaccard === 0.75);
check('repeats must be at least 3 sentences apart', REPEAT_RULES.minSentenceGap === 3);

// ── EXACT repeats: the register the old 8-word floor could not see ──
check('an exact 4-word repeat is caught',
  pairsOf(between('Marcus did not move.', 'Marcus did not move.')).length === 1);
check('it is reported as an exact repeat',
  pairsOf(between('Marcus did not move.', 'Marcus did not move.'))[0]?.kind === 'exact');
check('the LATER sentence is the one nominated for rewrite',
  pairsOf(between('He looked at Lena.', 'He looked at Lena.'))[0]?.laterIdx > 0);
check('a 3-word repeat is ordinary prose, not a defect',
  pairsOf(between('She looked up.', 'She looked up.')).length === 0);
check('a 2-word repeat is ignored',
  pairsOf(between('He nodded.', 'He nodded.')).length === 0);
check('back-to-back repetition is a craft device and is left alone',
  pairsOf('Marcus did not move. Marcus did not move.').length === 0);
// (distinct filler between each copy, or the filler is itself a repeat — which the
// detector correctly flags, and which is how this fixture was caught being wrong.)
const FILLER2 = 'Rain moved on the window. A light flickered once. Neither of them spoke.';
check('three copies of one tic produce TWO repairs, not three',
  pairsOf(`Marcus did not move. ${FILLER} Marcus did not move. ${FILLER2} Marcus did not move.`)
    .filter((p) => p.first === 'Marcus did not move.').length === 2);
check('the old 8-word exact rule still fires under the new one',
  pairsOf(between(
    'Her fingers hovered over the switches without touching them.',
    'Her fingers hovered over the switches without touching them.')).length === 1);

// ── NEAR repeats: the shapes no exact matcher can ever see ──
// All three are verbatim from the live book.
const LIVE_NEAR = [
  ['blast door, one verb swapped',
    "The blast door groaned, a heavy metallic shriek that vibrated through the soles of Lena's boots.",
    "The blast door shuddered, a heavy metallic groan that vibrated through the soles of Lena's boots."],
  ['cane, one preposition swapped',
    'The cane slipped from his grasp, clattering against the concrete.',
    'The cane slipped from his grasp, clattering onto the concrete.'],
  ['same action, subject renamed',
    'She slipped the key back into her pocket.',
    'Lena slipped the key back into her pocket.'],
  ['same sentence with a tail added',
    'She closed her fingers around it.',
    'She closed her fingers around it, holding it tight.'],
];
for (const [label, a, b] of LIVE_NEAR) {
  const p = pairsOf(between(a, b));
  check(`near repeat caught — ${label}`, p.length === 1 && p[0].kind === 'near',
    JSON.stringify(p));
  check(`   ${label}: nominates the later sentence`, p[0]?.later === b);
}

// ── controls: things that must NOT be flagged ──
const CONTROLS = [
  ['two different actions sharing a subject',
    'Marcus crossed the room and put his hand on the rail.',
    'Marcus opened the hatch and looked down into the dark.'],
  ['same verb, different object and outcome',
    'She pushed the door and it gave an inch.',
    'He pulled the lever and nothing happened at all.'],
  ['a long sentence and a short one about the same thing',
    'The generator coughed twice before the floodlights came up across the hall.',
    'The lights steadied.'],
];
for (const [label, a, b] of CONTROLS) {
  check(`control not flagged — ${label}`, pairsOf(between(a, b)).length === 0,
    JSON.stringify(pairsOf(between(a, b))));
}

// ── dialogue is out of scope: characters repeat themselves on purpose ──
check('a repeated line of dialogue is not a defect',
  pairsOf(between('“I told you not to touch it,” she said.', '“I told you not to touch it,” she said.')).length === 0);
check('a repeated narration line beside dialogue is still caught',
  pairsOf(`“Stop,” she said. Marcus did not move. ${FILLER} “Please,” she said. Marcus did not move.`).length === 1);

// ── stillRepeats guards the repair: a rewrite is only accepted if it worked ──
const A = 'The cane slipped from his grasp, clattering against the concrete.';
check('stillRepeats: a cosmetic rewrite is REJECTED',
  stillRepeats('The cane slipped from his grasp, clattering onto the concrete.', A) === true);
check('stillRepeats: a real rewrite is ACCEPTED',
  stillRepeats('The cane went out of his hand and rang on the floor.', A) === false);
check('stillRepeats: an identical string is REJECTED', stillRepeats(A, A) === true);

// ── book-agnostic: the same structure, three unrelated books, same verdicts ──
const BOOKS = [
  { id: 'arctic thriller', who: 'Marcus', thing: 'the brass key', place: 'the corridor' },
  { id: 'gothic mystery', who: 'Silas', thing: 'the winding key', place: 'the stair' },
  { id: 'legal thriller', who: 'Peter', thing: 'the deposition folder', place: 'the lobby' },
];
const SHAPES = [
  ['exact 4-word repeat', (b) => [`${b.who} did not move.`, `${b.who} did not move.`], 1],
  ['near repeat, verb swapped',
    (b) => [`${b.who} set ${b.thing} down on the table without looking at it.`,
      `${b.who} placed ${b.thing} down on the table without looking at it.`], 1],
  ['two genuinely different sentences',
    (b) => [`${b.who} crossed ${b.place} and said nothing.`,
      `Rain moved across the window in long grey lines.`], 0],
];
for (const [label, mk, want] of SHAPES) {
  const verdicts = BOOKS.map((b) => { const [a, c] = mk(b); return pairsOf(between(a, c)).length === want; });
  check(`book-agnostic: ${label} — identical verdict in all three books`, verdicts.every(Boolean),
    BOOKS.map((b, i) => `${b.id}:${verdicts[i]}`).join(' '));
}

// ── a scene break must not ride along on the repair target ──
// Live ch.5: both blast-door sentences open a scene, so the raw split hands back
// "* * *\n\nThe blast door ...". The repair replaces by exact string match, so a
// target carrying the break would rewrite the break away.
{
  const a = "The blast door groaned, a heavy metallic shriek that vibrated through the soles of Lena's boots.";
  const b = "The blast door shuddered, a heavy metallic groan that vibrated through the soles of Lena's boots.";
  const prose = `* * *\n\n${a} ${FILLER} * * *\n\n${b}`;
  const p = pairsOf(prose);
  check('the scene break is stripped off both sides of the pair',
    p.length === 1 && p[0].first === a && p[0].later === b, JSON.stringify(p));
  check('the stripped target is still an exact substring of the prose',
    p[0] && prose.includes(p[0].later));
}

// ── shape of the report the repair prompt consumes ──
const one = pairsOf(between('Marcus did not move.', 'Marcus did not move.'))[0];
check('a pair carries kind, score, first, later and both indices',
  one && ['kind', 'score', 'first', 'later', 'firstIdx', 'laterIdx'].every((k) => k in one));
check('empty prose returns no pairs and does not throw', pairsOf('').length === 0);
check('a single sentence returns no pairs', pairsOf('Marcus did not move.').length === 0);

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
