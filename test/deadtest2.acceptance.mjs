// DEADTEST-2 acceptance — parseAuditPayload fails closed on non-violation-shaped JSON.
//
// PROVEN: tests/chronologyPolicyAndAuditArray.test.mjs was masked behind
// narrativeContractRegression.test.mjs's crash (DEADTEST-1) and, once that crash was
// fixed, immediately showed 1 failed check: parseAuditPayload('{"status":"ok"}')
// returned [{"status":"ok"}] instead of null. Root cause: the AUDITJSON-1
// concatenated-objects fallback wraps ANY brace-delimited span in '[' + ']' the
// moment JSON.parse succeeds, and normalize()'s array branch accepted any array
// unconditionally — unlike its object branch, which already required 'id' or
// 'excerpt' before accepting. An unrelated JSON object got promoted into a
// 1-element array and sailed past the "fail closed on anything not
// violation-shaped" guarantee stated in the function's own header comment.
//
// sceneBeatNormalizer.js transitively imports the Vite alias "@/lib" (via
// integrationRetry.js), which bare node cannot resolve, so parseAuditPayload is
// extracted from the REAL source by anchor and executed in a vm — the same
// technique test/exitstate1-objseed2.acceptance.mjs uses for the same file. No
// logic is re-implemented; if the source changes, this runs the change.
import fs from 'fs';
import vm from 'vm';

const NORMALIZER_SRC = fs.readFileSync(
  new URL('../src/lib/sceneBeatNormalizer.js', import.meta.url), 'utf8'
);
const sliceSrc = (startMark, endMark) => {
  const a = NORMALIZER_SRC.indexOf(startMark);
  if (a < 0) throw new Error(`anchor not found: ${startMark}`);
  const b = NORMALIZER_SRC.indexOf(endMark, a);
  if (b < 0) throw new Error(`end anchor not found: ${endMark}`);
  return NORMALIZER_SRC.slice(a, b);
};
const PARSE_SRC = sliceSrc('function parseAuditPayload(', 'export async function auditSceneFutureBoundaries')
  .replace(/^export /gm, '');

const vmCtx = { console, JSON, Array, String };
vm.createContext(vmCtx);
vm.runInContext(PARSE_SRC + '\nthis.parseAuditPayload = parseAuditPayload;', vmCtx);
const { parseAuditPayload } = vmCtx;

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

// ── the exact bug ──
check('1. an unrelated JSON object returns null (THE BUG)',
  parseAuditPayload('{"status":"ok"}') === null);
check('2. an unrelated JSON object with other keys also returns null',
  parseAuditPayload('{"note":"nothing to report","confidence":0.9}') === null);

// ── legitimate shapes still parse (no regression) ──
check('3. a bare violation object still parses',
  (() => {
    const r = parseAuditPayload('{"id":0,"excerpt":"she opened the door"}');
    return Array.isArray(r) && r.length === 1 && r[0].id === 0;
  })());
check('4. a normal violation array still parses',
  parseAuditPayload('[{"id":1,"excerpt":"x"}]').length === 1);
check('5. an explicit empty array is still a valid empty answer',
  (() => { const r = parseAuditPayload('[]'); return Array.isArray(r) && r.length === 0; })());
check('6. a {"violations":[...]} wrapper with an empty array still yields an empty array',
  (() => { const r = parseAuditPayload('{"violations":[]}'); return Array.isArray(r) && r.length === 0; })());
check('7. concatenated violation-shaped objects still both parse (AUDITJSON-1 intact)',
  parseAuditPayload('{"excerpt":"a","reason":"r1"}\n{"excerpt":"b","reason":"r2"}').length === 2);
check('8. a concatenated pair where NEITHER is violation-shaped returns null',
  parseAuditPayload('{"status":"ok"}\n{"note":"fine"}') === null);

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
