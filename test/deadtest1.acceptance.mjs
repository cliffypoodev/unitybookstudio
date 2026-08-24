// DEADTEST-1 acceptance — the object-possession continuity gate is not dead.
//
// PROVEN: tests/narrativeContractRegression.test.mjs:244 was red at 2cfa197
// ("runtime ledger blocks possession violation for transferred object" — audit.ok was
// true, expected false). Root cause: the test predates KEYLEDGER-1e (998b21fe) and
// KEYLEDGER-1d, which replaced the old regex-based "gives X to Y" write path (measured
// ZERO possession facts across 21,344 live words, and additive when it did fire) with
// setHolderOfRecord + checkPossessionContinuity — a prose scanner requiring
// { sceneCast, trackedObjects } that reads transfers off sceneProse, not off the terse
// exit_state directive, and reports code 'OBJECT_POSSESSION_TELEPORT' (not the legacy
// 'OBJECT_POSSESSION_VIOLATION', which is still real but now belongs only to the
// separate, simpler droppedObjects check). The gate itself is live and correct; the
// test called an API shape that silently no-ops without those inputs. This battery
// proves the gate works when called the way real drafting calls it.
import { buildInitialLedger, extractSceneLedgerUpdates } from '../src/lib/narrativeLedger.js';
import { auditSceneAgainstLedger } from '../src/lib/sceneContractGate.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

// ── 1. a transfer written in sceneProse (not exit_state) moves the holder of record ──
{
  let ledger = buildInitialLedger();
  const sceneCast = ['Dov', 'Ilse'];
  ledger = extractSceneLedgerUpdates(ledger, 'Dov gives the brass token to Ilse.', {}, {
    sceneCast, trackedObjects: ['brass token'],
  });
  check('1. a written transfer sets the new holder of record',
    (ledger.possessions?.Ilse || []).includes('brass token'), JSON.stringify(ledger.possessions));
}

// ── 2. a later scene falsely claiming the OLD holder still has it is flagged ──
{
  let ledger = buildInitialLedger();
  const sceneCast = ['Dov', 'Ilse'];
  ledger = extractSceneLedgerUpdates(ledger, 'Dov gives the brass token to Ilse.', {}, {
    sceneCast, trackedObjects: ['brass token'],
  });
  const audit = auditSceneAgainstLedger({
    prose: 'Dov holds the brass token.',
    runtimeLedger: ledger,
    sceneCast,
  });
  check('2. a scene claiming the OLD holder still has the object is rejected',
    audit.ok === false, JSON.stringify(audit.issues));
  check('2b. …with the current possession-continuity code, not the retired one',
    audit.issues.some((i) => i.code === 'OBJECT_POSSESSION_TELEPORT'));
}

// ── 3. without sceneCast, both sides of the gate fail OPEN (documented, not a regression) ──
{
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, 'Dov gives the brass token to Ilse.', {}, {});
  check('3. without sceneCast/trackedObjects, the write path fails open (no holder recorded)',
    Object.keys(ledger.possessions || {}).length === 0, JSON.stringify(ledger.possessions));

  let ledger2 = buildInitialLedger();
  ledger2 = extractSceneLedgerUpdates(ledger2, 'Dov gives the brass token to Ilse.', {}, {
    sceneCast: ['Dov', 'Ilse'], trackedObjects: ['brass token'],
  });
  const auditNoCast = auditSceneAgainstLedger({
    prose: 'Dov holds the brass token.',
    runtimeLedger: ledger2,
  });
  check('3b. without sceneCast, the read path fails open too (no accusation without a cast)',
    auditNoCast.ok === true);
}

// ── 4. a scene correctly narrating who has it now is NOT flagged ──
{
  let ledger = buildInitialLedger();
  const sceneCast = ['Dov', 'Ilse'];
  ledger = extractSceneLedgerUpdates(ledger, 'Dov gives the brass token to Ilse.', {}, {
    sceneCast, trackedObjects: ['brass token'],
  });
  const audit = auditSceneAgainstLedger({
    prose: 'Ilse holds the brass token.',
    runtimeLedger: ledger,
    sceneCast,
  });
  check('4. a scene correctly narrating the new holder is not flagged',
    audit.ok === true, JSON.stringify(audit.issues));
}

// ── 5. the legacy 'dropped object' path (unrelated mechanism) still works untouched ──
{
  let ledger = buildInitialLedger();
  ledger = extractSceneLedgerUpdates(ledger, '', { exit_state: 'Ilse places the brass token on the desk.' });
  const audit = auditSceneAgainstLedger({
    prose: 'Ilse holds the brass token tightly.',
    runtimeLedger: ledger,
  });
  check('5. the simpler droppedObjects check (no sceneCast needed) still fires OBJECT_POSSESSION_VIOLATION',
    audit.ok === false && audit.issues.some((i) => i.code === 'OBJECT_POSSESSION_VIOLATION'));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
