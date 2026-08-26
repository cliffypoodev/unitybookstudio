// KEYLEDGER-2 acceptance — referent identity, scene-level possession auditing,
// tracked-set dedupe, quoted deaths, and the audit gate that consumes all of it.
//
// WHY THIS FILE WAS REWRITTEN (2026-08-04)
// Like keyledger1, it read the live data/_FileStore.json and pinned itself to
// Brass Meridian ch.1 being 4,306 words. Ch.1 is 4,213 words now, so the battery
// aborted on its own precondition and had been doing so, uncommitted and unseen,
// since the re-draft. Frozen synthetic fixtures from three unrelated books below.
import { checkPossessionContinuity, dedupeTrackedObjects } from '../src/lib/objectPossession.js';
import { normalizeCast, resolveReferent } from '../src/lib/referentResolver.js';
import { buildInitialLedger, extractSceneLedgerUpdates } from '../src/lib/narrativeLedger.js';
import { extractLimbFacts, auditSceneAgainstLedger } from '../src/lib/sceneContractGate.js';

let failures = 0;
const check = (label, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + label); if (!ok) failures += 1; };

const BOOKS = [
  { id: 'arctic thriller', a: 'Lena Ortiz', b: 'Marcus Reed', c: 'Dr. Nolan Vale', short: 'Vale', obj: 'brass key' },
  { id: 'gothic mystery', a: 'Ilka Thornbury', b: 'Halvard Oriel', c: 'Mrs. Aldous', short: 'Aldous', obj: 'brass winding key' },
  { id: 'legal thriller', a: 'Ana Okonkwo', b: 'Peter Halloway', c: 'Judge Rennard', short: 'Rennard', obj: 'deposition folder' },
];
const castOf = (bk) => [{ name: bk.a, gender: 'f' }, { name: bk.b, gender: 'm' }];

// ── REFERENT IDENTITY: aliases resolve, honorifics alone resolve nobody ──
for (const b of BOOKS) {
  const roster = normalizeCast([b.a, b.b, b.c]);
  check(`${b.id}: a first name resolves to the full cast member`,
    resolveReferent(b.a.split(' ')[0], roster, {})?.name === b.a);
  check(`${b.id}: an honorific character resolves by surname`,
    resolveReferent(b.short, roster, {})?.name === b.c);
  check(`${b.id}: an unknown name resolves to nobody`,
    resolveReferent('Kestrel', roster, {}) === null);
}
const bareHonorifics = ['Dr', 'Mrs', 'Judge', 'Mr', 'Ms'];
for (const h of bareHonorifics) {
  const verdicts = BOOKS.map((b) => resolveReferent(h, normalizeCast([b.a, b.b, b.c]), {}) === null);
  check(`a bare honorific "${h}" resolves to nobody in any book`, verdicts.every(Boolean));
}

// ── SCENE-LEVEL POSSESSION: a scene cast that omits the real holder ──
// The live defect this was written for: ch.4 ran with a two-person scene cast while
// a third character actually held the object, and BOTH teleports had to be caught.
for (const b of BOOKS) {
  const prose =
    `${b.a} held the ${b.obj} against the lock. ` +
    `The lights failed and nobody moved. ` +
    `${b.b} turned the ${b.obj} in his fingers. ` +
    `Outside, the wind rose. ` +
    `${b.a} pushed the ${b.obj} into her coat pocket.`;
  const r = checkPossessionContinuity({ prose, object: b.obj, cast: castOf(b), entryHolder: null });
  check(`${b.id}: two unwritten holder changes are both caught`, r.violations.length === 2);
  check(`${b.id}: the exit holder is the last written holder`, r.exitHolder === b.a);
}
// The pronoun handover sets the exit holder even when the taker is only a pronoun.
for (const b of BOOKS) {
  const r = checkPossessionContinuity({
    prose: `${b.b} held the ${b.obj}. He passed it to ${b.a}. She said nothing.`,
    object: b.obj, cast: castOf(b), entryHolder: b.b,
  });
  check(`${b.id}: exit holder follows a pronoun handover`, r.exitHolder === b.a && r.violations.length === 0);
}

// ── TRACKED-SET DEDUPE: a subsumed spelling is not a second object ──
check('dedupe drops the bare noun that the full name already contains',
  JSON.stringify(dedupeTrackedObjects(['Brass Key', 'key', 'Maintenance Tunnel']))
  === JSON.stringify(['Brass Key', 'Maintenance Tunnel']));
check('dedupe keeps two objects that merely SHARE a noun',
  JSON.stringify(dedupeTrackedObjects(['steel winding key', 'brass winding key']))
  === JSON.stringify(['steel winding key', 'brass winding key']));
check('dedupe collapses a spelling chain onto one object',
  dedupeTrackedObjects(['brass winding key', 'brass key', 'winding key']).length === 1);
check('dedupe is stable on an empty list', JSON.stringify(dedupeTrackedObjects([])) === '[]');

// ── QUOTED DEATHS: what a character SAYS is not what happened ──
for (const b of BOOKS) {
  const led = extractSceneLedgerUpdates(
    buildInitialLedger(),
    `“I told him ${b.a} died in the flood,” ${b.b} said. “You are the reason she died.” Then ${b.short} died on the catwalk.`,
    {});
  check(`${b.id}: a death inside dialogue is ignored, a death in narration is recorded`,
    JSON.stringify(led.deadCharacters) === JSON.stringify([b.short]));
}

// ── THE "Now" BUG: a capitalised sentence-opener is not a character ──
// The live ch.5 defect: "Now his left sleeve pinned flat" recorded a character
// literally named "Now" with an empty sleeve.
for (const b of BOOKS) {
  const facts = extractLimbFacts(
    `${b.b} sat down at the bench. Now his left sleeve hung empty at his side.`, castOf(b));
  check(`${b.id}: a sentence-opening adverb never becomes a character`,
    facts.length > 0 && facts.every((f) => f.displayName === b.b));
}

// ── THE AUDIT GATE consumes all of the above ──
for (const b of BOOKS) {
  const probe = auditSceneAgainstLedger({
    prose: 'He held the ' + b.obj + '.',
    spec: { props_present: [b.obj] },
    runtimeLedger: { ...buildInitialLedger(), possessions: { [b.a]: [b.obj] } },
    sceneCast: castOf(b),
  });
  check(`${b.id}: the gate fires OBJECT_POSSESSION_TELEPORT`,
    probe.issues.some((i) => i.code === 'OBJECT_POSSESSION_TELEPORT'));
  const clean = auditSceneAgainstLedger({
    prose: `${b.a} held the ${b.obj}.`,
    spec: { props_present: [b.obj] },
    runtimeLedger: { ...buildInitialLedger(), possessions: { [b.a]: [b.obj] } },
    sceneCast: castOf(b),
  });
  check(`${b.id}: the gate stays silent when the prose obeys the ledger`,
    !clean.issues.some((i) => i.code === 'OBJECT_POSSESSION_TELEPORT'));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
