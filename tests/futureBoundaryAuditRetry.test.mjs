// AUDITRETRY-1 proof: a flaky audit response must not kill a chapter, and
// fail-closed must survive intact.
//
// Live failure, 2026-07-29, Chapter 2 scene 1:
//   [auditSceneFutureBoundaries] LLM check failed or returned malformed data:
//     Error: LLM response did not contain a JSON array.
//   NarrativeInvariantError: Scene ch02-s01 was rejected: future boundary audit
//     failed to execute or returned malformed JSON.
// The prose was never examined. The identical audit had succeeded on earlier runs
// of the same chapter, so this was response variance, not a property of the scene.
import { auditSceneFutureBoundaries } from '@/lib/sceneBeatNormalizer';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}

const SPEC = { future_reserved_events: ['Marcus hands Lena the hidden report.'] };
const PROSE = 'Lena stood in the corridor with the key still warm in her fist and did not go back through the door.';
const CLEAN = '[]';
const VIOLATION = '[{"id": 0, "excerpt": "Marcus put the report into her hand."}]';

// Returns a fake invoke function plus a call counter.
function responder(...responses) {
  const state = { calls: 0 };
  const fn = async () => {
    const r = responses[Math.min(state.calls, responses.length - 1)];
    state.calls += 1;
    if (r instanceof Error) throw r;
    return r;
  };
  return { fn, state };
}

// ── The live failure: one bad response, then a good one ─────────────────────
{
  const { fn, state } = responder('I cannot comply with that request.', CLEAN);
  const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
  check('a single unparseable response no longer kills the scene', audit.ok === true);
  check('  ... and it did so by retrying', state.calls === 2);
  check('  ... with no phantom violations carried over', audit.violations.length === 0);
}

// ── Two bad, then good ──────────────────────────────────────────────────────
{
  const { fn, state } = responder('nope', 'still nope', CLEAN);
  const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
  check('recovers on the third attempt', audit.ok === true && state.calls === 3);
}

// ── FAIL-CLOSED must be untouched ───────────────────────────────────────────
{
  const { fn, state } = responder('never valid');
  const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
  check('consistently unparseable output still fails closed', audit.ok === false && audit.auditFailed === true);
  check('  ... after a bounded number of attempts', state.calls === 3);
}
{
  const { fn } = responder(new Error('connection refused'));
  const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
  check('a thrown error still fails closed', audit.ok === false && audit.auditFailed === true);
}
{
  const { fn } = responder('{"id": 0}');
  const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
  check('non-array JSON still fails closed', audit.ok === false && audit.auditFailed === true);
}
{
  const { fn } = responder('[{"id": 99, "excerpt": "x"}]');
  const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
  check('an unknown event id still fails closed', audit.ok === false && audit.auditFailed === true);
}
{
  const { fn } = responder('[{"id": 0, "excerpt": ""}]');
  const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
  check('an empty excerpt still fails closed', audit.ok === false && audit.auditFailed === true);
}

// ── A real violation is still reported, and is not retried away ─────────────
{
  const { fn, state } = responder(VIOLATION);
  const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
  check('a real future-boundary violation is still reported', audit.ok === false && audit.violations.length === 1);
  check('  ... on the first attempt, with no wasted retries', state.calls === 1);
  check('  ... naming the reserved event', audit.violations[0].event === 'Marcus hands Lena the hidden report.');
}

// ── Violations must not accumulate across attempts ──────────────────────────
{
  const { fn } = responder('garbage', VIOLATION);
  const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
  check('a violation found after a retry is reported exactly once', audit.violations.length === 1);
}

// ── Cheap exits are still cheap ─────────────────────────────────────────────
{
  const { fn, state } = responder(CLEAN);
  const audit = await auditSceneFutureBoundaries(PROSE, { future_reserved_events: [] }, 'local', fn);
  check('no reserved events means no model call at all', audit.ok === true && state.calls === 0);
}
{
  const { fn, state } = responder(CLEAN);
  const audit = await auditSceneFutureBoundaries('', SPEC, 'local', fn);
  check('empty prose means no model call at all', audit.ok === true && state.calls === 0);
}
{
  const { fn, state } = responder(CLEAN);
  const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
  check('a clean first response costs exactly one call', audit.ok === true && state.calls === 1);
}

console.log('\nFUTURE BOUNDARY AUDIT RETRY (AUDITRETRY-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
