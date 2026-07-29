// BOUNDARYREPAIR-1 proof: a converging repair must not be abandoned after one pass,
// and fail-closed must survive intact.
//
// Live failure, 2026-07-29, Chapter 2 scene 1:
//   [SCENE-BOUNDARY-AUDIT] scene=1 futureViolations=6
//   [SCENE-BOUNDARY-REPAIR-RESULT] remainingCount=2
//   NarrativeInvariantError: Scene ch02-s01 was rejected:
//       future boundary violations survived repair.
//
// One pass took violations 6 -> 2. It was plainly converging. The chapter was
// discarded anyway, because the repair was allowed exactly one attempt at a
// six-part problem — while every other gate in sceneWriter.js gets a repair pass.
//
// This exercises the loop policy directly. The real loop lives inside
// generateChapterSceneByScene and needs a live model, so the decision rules are
// modelled here against the same contract the implementation follows:
//   - stop as soon as the audit is clean
//   - keep going only while the violation count STRICTLY decreases
//   - stop on a stall, on an unexecutable audit, or at the pass cap
//   - if violations remain when the loop ends, fail closed
const FUTURE_BOUNDARY_REPAIR_PASSES = 3;

function runRepairLoop(auditSequence) {
  // auditSequence[i] is the audit result after repair pass i+1.
  let calls = 0;
  let previousCount = auditSequence.initial;
  let audit = { ok: false, auditFailed: false, violations: previousCount };
  for (let pass = 1; pass <= FUTURE_BOUNDARY_REPAIR_PASSES; pass += 1) {
    const next = auditSequence.results[pass - 1];
    if (!next) break;
    calls += 1;
    audit = next;
    if (audit.ok) break;
    if (audit.auditFailed) break;
    if (audit.violations >= previousCount) break;
    previousCount = audit.violations;
  }
  return { calls, accepted: audit.ok === true, audit };
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}
const v = (n) => ({ ok: n === 0, auditFailed: false, violations: n });

// ── The live case: 6 -> 2 -> 0 ──────────────────────────────────────────────
{
  const r = runRepairLoop({ initial: 6, results: [v(2), v(0)] });
  check('a converging repair (6 -> 2 -> 0) is accepted', r.accepted === true);
  check('  ... and it took a second pass to get there', r.calls === 2);
}

// ── One pass is still enough when one pass is enough ───────────────────────
{
  const r = runRepairLoop({ initial: 3, results: [v(0), v(0)] });
  check('a repair that clears immediately costs exactly one pass', r.accepted === true && r.calls === 1);
}

// ── Progress all the way to the cap ────────────────────────────────────────
{
  const r = runRepairLoop({ initial: 9, results: [v(6), v(3), v(0)] });
  check('three converging passes are allowed', r.accepted === true && r.calls === 3);
}

// ── FAIL-CLOSED must be untouched ──────────────────────────────────────────
{
  const r = runRepairLoop({ initial: 6, results: [v(4), v(2), v(1)] });
  check('still-violating at the pass cap fails closed', r.accepted === false);
  check('  ... after exactly the capped number of passes', r.calls === 3);
}
{
  const r = runRepairLoop({ initial: 6, results: [v(2), v(2), v(0)] });
  check('a stalled repair stops early and fails closed', r.accepted === false && r.calls === 2);
}
{
  const r = runRepairLoop({ initial: 6, results: [v(2), v(5), v(0)] });
  check('a repair that gets WORSE stops and fails closed', r.accepted === false && r.calls === 2);
}
{
  const r = runRepairLoop({ initial: 6, results: [{ ok: false, auditFailed: true, violations: 0 }, v(0)] });
  check('an unexecutable audit stops and fails closed', r.accepted === false && r.calls === 1);
}
{
  const r = runRepairLoop({ initial: 4, results: [v(4)] });
  check('zero progress on the first pass fails closed immediately', r.accepted === false && r.calls === 1);
}

// ── The pass budget is bounded ─────────────────────────────────────────────
{
  const r = runRepairLoop({ initial: 100, results: [v(90), v(80), v(70), v(60), v(0)] });
  check('the loop never exceeds its pass cap', r.calls === FUTURE_BOUNDARY_REPAIR_PASSES);
  check('  ... and a still-violating scene at the cap is rejected', r.accepted === false);
}

console.log('\nFUTURE BOUNDARY REPAIR PASSES (BOUNDARYREPAIR-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
