// AUDITJSON-1 proof: the audit must survive a reasoning model's answer shape.
//
// Live failure, 2026-07-29 02:12. All THREE AUDITRETRY-1 attempts failed with the
// identical message — deterministic, not variance:
//   [auditSceneFutureBoundaries] attempt 1/3 returned unusable data: LLM response did not contain a JSON array.
//   [auditSceneFutureBoundaries] attempt 2/3 ... same
//   [auditSceneFutureBoundaries] attempt 3/3 ... same
//   Scene ch02-s01 was rejected: future boundary audit failed to execute.
// The prose (1825 words, 100% beat coverage) was never examined.
import { auditSceneFutureBoundaries } from '@/lib/sceneBeatNormalizer';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}
const SPEC = { future_reserved_events: ['Marcus hands Lena the hidden report.'] };
const PROSE = 'Lena stood in the corridor with the key still warm in her fist.';
const FENCE = '`'.repeat(3);
const reply = (text) => { const st = { calls: 0, opts: null }; return { fn: async (o) => { st.calls += 1; st.opts = o; return text; }, st }; };
const audit = async (text) => { const r = reply(text); return { a: await auditSceneFutureBoundaries(PROSE, SPEC, 'local', r.fn), st: r.st }; };

// ── Answer shapes a reasoning model actually produces ───────────────────────
{
  const { a } = await audit('<think>Let me consider each reserved event carefully.</think>\n[]');
  check('a <think> preamble no longer breaks the audit', a.ok === true);
}
{
  const { a } = await audit('<think>Maybe [this] is a violation? No.</think>[]');
  check('brackets INSIDE the think block are not mistaken for the answer', a.ok === true && a.violations.length === 0);
}
{
  const { a } = await audit(FENCE + 'json\n[]\n' + FENCE);
  check('a fenced answer is parsed', a.ok === true);
}
{
  const { a } = await audit('<think>reasoning</think>\n' + FENCE + 'json\n[{"id": 0, "excerpt": "He placed it in her hand."}]\n' + FENCE);
  check('a real violation is still found through think + fences', a.ok === false && a.violations.length === 1);
  const { a: a2 } = await audit('<think>x</think>[{"id": 0, "excerpt": "He placed it in her hand."}]');
  check('  ... and it names the reserved event', a2.violations[0].event === 'Marcus hands Lena the hidden report.');
}
{
  const { a } = await audit('Here is the result: []');
  check('a plain prose preamble still parses', a.ok === true);
}

// ── The output budget is large enough for a real answer ─────────────────────
{
  const { st } = await audit('[]');
  check('the audit is given room to answer', st.opts.max_tokens >= 4000);
  check('  ... and still runs at low temperature', st.opts.temperature === 0.1);
}

// ── FAIL-CLOSED unchanged ──────────────────────────────────────────────────
{
  const { a, st } = await audit('I cannot produce that.');
  check('genuinely unusable output still fails closed', a.ok === false && a.auditFailed === true);
  check('  ... after the bounded retries', st.calls === 3);
}
{
  const { a } = await audit('{"id": 0}');
  check('non-array JSON still fails closed', a.ok === false && a.auditFailed === true);
}
{
  const { a } = await audit('<think>[0]</think>');
  check('a think block ALONE is not an answer', a.ok === false && a.auditFailed === true);
}

console.log('\nAUDIT JSON EXTRACTION (AUDITJSON-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
