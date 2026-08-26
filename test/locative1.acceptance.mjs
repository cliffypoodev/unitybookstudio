// LOCATIVE-1 acceptance — a hand the object is LEAVING does not hold it.
//
// MEASURED on the saved Brass Meridian ch.2 (2026-08-04). The handover is written
// properly and at length, and the gate accused it anyway:
//
//   65 TAKE  Marcus Reed  high  "Then he closed his fingers around the key."
//   68 HOLD  Lena Ortiz   high  "The warmth of the key transferred from her palm
//                                to his, then to his palm."          <-- the defect
//   70 HOLD  Marcus Reed  high  "Marcus held the key tight."
//
// Event 68 handed the key back to Lena on the strength of the word "palm", so 70
// read as a teleport. Three further false violations cascaded from it. A gate that
// accuses correct prose burns the repair budget and can hard-block a good scene,
// which is the DEADSPEECH-1 lesson stated in this file's own header.
import { checkPossessionContinuity } from '../src/lib/objectPossession.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const BOOKS = [
  { id: 'arctic thriller', a: 'Lena Ortiz', b: 'Marcus Reed', obj: 'brass key' },
  { id: 'gothic mystery', a: 'Ilka Thornbury', b: 'Halvard Oriel', obj: 'brass winding key' },
  { id: 'legal thriller', a: 'Ana Okonkwo', b: 'Peter Halloway', obj: 'deposition folder' },
];
const castOf = (bk) => [{ name: bk.a, gender: 'f' }, { name: bk.b, gender: 'm' }];
const run = (bk, prose, entryHolder = null) =>
  checkPossessionContinuity({ prose, object: bk.obj, cast: castOf(bk), entryHolder });

// ── the live shape: a written handover with an in-transit sentence in the middle ──
for (const b of BOOKS) {
  const prose =
    `${b.a} held the ${b.obj} out, palm up. ` +
    `Then he closed his fingers around the ${b.obj}. ` +
    `The warmth of the ${b.obj} transferred from her palm to his, then to his palm. ` +
    `${b.b} held the ${b.obj} tight.`;
  const r = run(b, prose, b.a);
  const transit = r.events.find((e) => /transferred from her palm/.test(e.sentence));
  check(`${b.id}: the in-transit sentence asserts no holder`,
    transit && transit.kind === 'NEUTRAL' && transit.reason === 'locative-in-transit',
    transit ? `got ${transit.kind}/${transit.reason}/${transit.holder}` : 'no event for that sentence');
  check(`${b.id}: the written handover produces NO violation`, r.violations.length === 0,
    r.violations.map((v) => `${v.from} -> ${v.to} :: ${v.sentence}`).join(' | '));
  check(`${b.id}: the exit holder is the character who took it`, r.exitHolder === b.b);
}

// ── every departure shape, three books, identical verdicts ──
const DEPARTURES = [
  ['from her palm to his', (b) => `The ${b.obj} passed from her palm to his.`],
  ['out of her hand', (b) => `The ${b.obj} came out of her hand and into the light.`],
  ['away from her fingers', (b) => `The ${b.obj} tipped away from her fingers.`],
  ['slipped from her grip', (b) => `The ${b.obj} slipped from her grip.`],
  ['left her hand', (b) => `The ${b.obj} left her hand.`],
  ['no longer in her pocket', (b) => `The ${b.obj} was no longer in her pocket.`],
];
for (const [label, mk] of DEPARTURES) {
  const verdicts = BOOKS.map((b) => {
    const ev = run(b, mk(b)).events.find((e) => e.sentence.includes(b.obj));
    return ev && ev.kind !== 'HOLD';
  });
  check(`departure "${label}" never asserts a holder — all three books`, verdicts.every(Boolean));
}

// ── the locative rule still works when the object is genuinely resting ──
const RESTING = [
  ['in her palm', (b) => `The ${b.obj} sat in her palm, warm and heavy.`],
  ['against her fingers', (b) => `The ${b.obj} was cold against her fingers.`],
  ['in her fist', (b) => `The ${b.obj} was clenched in her fist.`],
];
for (const [label, mk] of RESTING) {
  const verdicts = BOOKS.map((b) => {
    const ev = run(b, mk(b)).events.find((e) => e.sentence.includes(b.obj));
    return ev && ev.kind === 'HOLD' && ev.holder === b.a;
  });
  check(`resting "${label}" still resolves the holder — all three books`, verdicts.every(Boolean));
}

// ── a real teleport is still caught: LOCATIVE-1 must not blind the gate ──
for (const b of BOOKS) {
  const r = run(b, `${b.a} held the ${b.obj}. The lights failed. ${b.b} held the ${b.obj} against the lock.`);
  check(`${b.id}: an unwritten holder change is still a violation`,
    r.violations.length === 1 && r.violations[0].to === b.b);
  // A departure with no destination does not hand the object to anybody.
  const r2 = run(b, `${b.a} held the ${b.obj}. The ${b.obj} slipped from her fingers and rang off the floor.`, b.a);
  check(`${b.id}: a departure with no recipient does not invent one`,
    r2.violations.length === 0 && r2.exitHolder === b.a);
}

// ── the pocket branch: a departure FROM a container you own is a retrieval ──
// The first cut of this fix ran the in-transit guard before STOW and RETRIEVE and
// turned "pulled the key from her pocket" into "asserts nothing", which would have
// lost the holder every time a character armed themselves.
for (const b of BOOKS) {
  const ret = run(b, `${b.a} pulled the ${b.obj} from her pocket.`).events
    .find((e) => e.sentence.includes(b.obj));
  check(`${b.id}: retrieving from your OWN pocket still sets the holder`,
    ret && ret.kind === 'RETRIEVE' && ret.holder === b.a,
    ret ? `got ${ret.kind}/${ret.holder}` : 'no event');
  const stow = run(b, `${b.b} slipped the ${b.obj} into his own pocket.`, b.b).events
    .find((e) => e.sentence.includes(b.obj));
  check(`${b.id}: stowing into your OWN pocket still sets the holder`,
    stow && stow.kind === 'STOW' && stow.holder === b.b,
    stow ? `got ${stow.kind}/${stow.holder}` : 'no event');
  const gone = run(b, `${b.a} reached down. The ${b.obj} was no longer in her pocket.`, b.a).events
    .find((e) => /no longer/.test(e.sentence));
  check(`${b.id}: "no longer in her pocket" asserts no holder`,
    gone && gone.kind === 'NEUTRAL' && gone.reason === 'locative-in-transit',
    gone ? `got ${gone.kind}/${gone.reason}` : 'no event');
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
