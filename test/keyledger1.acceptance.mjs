// KEYLEDGER-1 acceptance — possession continuity, limb attribution, condition drift.
//
// WHY THIS FILE WAS REWRITTEN (2026-08-04)
// It used to read the live data/_FileStore.json and assert exact violation counts
// for Brass Meridian ch.1-5 ("ch4: 2, ch5: 3"). Those numbers were a photograph of
// a manuscript mid-repair. The moment ch.3 and ch.5 were re-drafted the battery
// aborted on its own precondition, and because it was never committed to git,
// nobody saw it go red. An acceptance battery that depends on mutable book data is
// a snapshot, not a test.
//
// Everything below is frozen synthetic prose reproducing the same defect SHAPES in
// three unrelated books, so the verdicts hold forever and on any project.
// Live-manuscript verdicts moved to tools/manuscript-probe.mjs, which REPORTS and
// never asserts.
import { checkPossessionContinuity } from '../src/lib/objectPossession.js';
import { inferCastGenders } from '../src/lib/referentResolver.js';
import { extractLimbFacts, checkConditionAttribution } from '../src/lib/sceneContractGate.js';

let failures = 0;
const check = (label, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + label); if (!ok) failures += 1; };

// Three books that share nothing but structure. A is female, B is male, so the
// pronoun paths are exercised identically in each.
const BOOKS = [
  { id: 'arctic thriller', a: 'Lena Ortiz', b: 'Marcus Reed', obj: 'brass key', place: 'the corridor' },
  { id: 'gothic mystery', a: 'Nell Carrow', b: 'Silas Bram', obj: 'brass winding key', place: 'the stair' },
  { id: 'legal thriller', a: 'Ana Okonkwo', b: 'Peter Halloway', obj: 'deposition folder', place: 'the lobby' },
];
const castOf = (bk) => [{ name: bk.a, gender: 'f' }, { name: bk.b, gender: 'm' }];
const run = (bk, prose, entryHolder = null) =>
  checkPossessionContinuity({ prose, object: bk.obj, cast: castOf(bk), entryHolder });

// ── POSSESSION CONTINUITY: six shapes, three books, identical verdicts ──
const SHAPES = [
  ['a single holder is never a violation',
    (b) => [`${b.a} held the ${b.obj} in her fist. She crossed ${b.place}. The ${b.obj} was cold against her palm.`, null],
    (r, b) => r.violations.length === 0 && r.exitHolder === b.a],
  ['a WRITTEN handover is legal and moves the holder',
    (b) => [`${b.a} held the ${b.obj}. She handed the ${b.obj} to ${b.b}. ${b.b} carried the ${b.obj} to the door.`, null],
    (r, b) => r.violations.length === 0 && r.exitHolder === b.b],
  ['an UNWRITTEN change of holder is one violation',
    (b) => [`${b.a} held the ${b.obj}. The lights failed. ${b.b} held the ${b.obj} against the lock.`, null],
    (r, b) => r.violations.length === 1 && r.violations[0].from === b.a && r.violations[0].to === b.b],
  ['a PRONOUN handover is legal and resolves the exit holder',
    (b) => [`${b.b} held the ${b.obj}. He passed it to ${b.a}. She carried the ${b.obj} up the stair.`, null],
    (r, b) => r.violations.length === 0 && r.exitHolder === b.a],
  ['the INHERITED holder is contradicted on first mention',
    (b) => [`${b.b} held the ${b.obj} against the lock and turned it.`, b.a],
    (r, b) => r.violations.length === 1 && r.violations[0].from === b.a && r.violations[0].to === b.b],
  ['the INHERITED holder is honoured',
    (b) => [`${b.a} held the ${b.obj} against the lock and turned it.`, b.a],
    (r, b) => r.violations.length === 0 && r.exitHolder === b.a],
];
for (const [label, mk, want] of SHAPES) {
  const verdicts = BOOKS.map((b) => { const [prose, entry] = mk(b); return want(run(b, prose, entry), b); });
  check(`possession: ${label} — all three books agree`, verdicts.every(Boolean));
  BOOKS.forEach((b, i) => check(`   ${b.id}: ${label}`, verdicts[i]));
}

// ── the offer/take distinction: offering is not a transfer ──
for (const b of BOOKS) {
  const offered = run(b, `${b.a} held the ${b.obj}. She held it out to ${b.b}. She put the ${b.obj} back in her coat.`);
  check(`${b.id}: an OFFER alone does not move the holder`, offered.exitHolder === b.a && offered.violations.length === 0);
  const taken = run(b, `${b.a} held the ${b.obj}. ${b.b} took the ${b.obj} from her hand. He turned it over.`);
  check(`${b.id}: a written TAKE moves the holder without a violation`, taken.exitHolder === b.b && taken.violations.length === 0);
}

// ── inferCastGenders still feeds this path (the live batteries used it) ──
const inferred = inferCastGenders(
  'Lena Ortiz crossed the corridor. She stopped at the hatch. Marcus Reed followed her. He said nothing. She waited. He waited.',
  ['Lena Ortiz', 'Marcus Reed']);
check('inferCastGenders returns one entry per cast member with aliases',
  inferred.length === 2 && inferred.every((c) => Array.isArray(c.aliases) && c.aliases.length >= 2));
check('an inferred cast drives the same verdict as an explicit one',
  checkPossessionContinuity({
    prose: 'Lena Ortiz held the brass key. The lights failed. Marcus Reed held the brass key against the lock.',
    object: 'brass key', cast: inferred, entryHolder: null,
  }).violations.length === 1);

// ── LIMB ATTRIBUTION ──
for (const b of BOOKS) {
  const cast = castOf(b);
  const thumb = extractLimbFacts(`The gear tore through and his left thumb was severed at the second joint.`, cast);
  check(`${b.id}: a thumb loss is captured with its part and owner`,
    thumb.length === 1 && thumb[0].part === 'thumb' && thumb[0].kind === 'loss'
    && thumb[0].side === 'left' && thumb[0].displayName === b.b);
  const sleeve = extractLimbFacts(`${b.b} crossed the room, his left sleeve pinned flat against his side.`, cast);
  check(`${b.id}: an empty sleeve is an ARM-level loss`,
    sleeve.length === 1 && sleeve[0].part === 'arm' && sleeve[0].kind === 'empty-sleeve'
    && sleeve[0].displayName === b.b);
  check(`${b.id}: an intact character produces no limb fact`,
    extractLimbFacts(`${b.a} flexed her left hand and picked up the ${b.obj}.`, cast).length === 0);
}

// ── CONDITION ATTRIBUTION DRIFT: the ledger owns the injury ──
for (const b of BOOKS) {
  const cast = castOf(b);
  const ledger = { [b.b]: ['left amputated/severed'] };
  const onWrongCharacter = extractLimbFacts(`${b.a} turned, her left sleeve pinned flat against her side.`, cast);
  const drift = checkConditionAttribution({ facts: onWrongCharacter, ledgerConditions: ledger });
  check(`${b.id}: the injury reattaching to the wrong character is caught`,
    drift.length === 1 && drift[0].code === 'CONDITION_ATTRIBUTION_DRIFT');
  const onRightCharacter = extractLimbFacts(`${b.b} crossed the room, his left sleeve pinned flat against his side.`, cast);
  check(`${b.id}: the injured character restating his OWN condition is silent`,
    checkConditionAttribution({ facts: onRightCharacter, ledgerConditions: ledger }).length === 0);
  check(`${b.id}: an empty ledger never invents a drift`,
    checkConditionAttribution({ facts: onWrongCharacter, ledgerConditions: {} }).length === 0);
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
