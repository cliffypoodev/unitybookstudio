// DEADTEST-4 acceptance — normalizePossessions represents "holds nothing" correctly.
//
// PROVEN: tests/bookScopeLedger.test.mjs was masked behind
// narrativeContractRegression.test.mjs's crash (DEADTEST-1). Once that crash was
// fixed, the chain reached this file for the first time and CRASHED outright:
// "MUTABLE: possession moves - the later chapter wins, it does not union" merges
// { Lena: ['brass key'] } (ch4) with { Marcus: ['brass key'], Lena: [] } (ch5) and
// reads result.possessions.Lena.length — Lena was undefined, not [].
//
// Root cause: normalizePossessions only ever added a character to its output via
// holderOf (built from portable object/holder pairs). A character explicitly named
// with an EMPTY array contributes zero pairs, so they vanished from the result
// entirely — indistinguishable from never having been mentioned. Most of this file
// reads possessions defensively (`ledger.possessions[x] || []`), so the gap was
// silent everywhere except a direct property read.
//
// Two more checks, further down the SAME masked chain, then failed once reached:
// stale source-shape anchors in WIRING checks (ANTHOLOGYBLEED-1 and BOOKECHO-1
// both landed after this test file was written) — those are test-only fixes with
// their own commit; this battery covers the source fix only.
import {
  buildInitialLedger, mergeLedgers, normalizePossessions,
} from '../src/lib/narrativeLedger.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

// ── 1. the exact crash, reproduced with generic names ──
{
  const ch4 = buildInitialLedger(); ch4.possessions = { Dov: ['log page'] };
  const ch5 = buildInitialLedger(); ch5.possessions = { Ilse: ['log page'], Dov: [] };
  const m = mergeLedgers(ch4, ch5);
  check('1. the later holder gets the object',
    (m.possessions.Ilse || []).includes('log page'), JSON.stringify(m.possessions));
  check('2. THE CRASH: the character explicitly emptied is an array, not undefined',
    Array.isArray(m.possessions.Dov) && m.possessions.Dov.length === 0,
    JSON.stringify(m.possessions));
}

// ── 2. order-sensitivity is preserved: a character named ONLY in an earlier map
//       is not force-included when they end up holding nothing ──
check('3. normalizePossessions is still order-sensitive: the LAST map wins',
  (() => {
    const r1 = normalizePossessions({ A: ['lamp'] }, { B: ['lamp'] });
    return (r1.B || []).length === 1 && !r1.A;
  })());

// ── 3. malformed input still does not throw and does not manufacture a character ──
check('4. malformed input does not throw and produces no phantom character',
  JSON.stringify(normalizePossessions(null, undefined, { X: null })) === '{}');

// ── 4. an explicit empty array in the LATEST map alone still surfaces ──
check('5. a character with only an explicit empty array in the latest map still appears as []',
  (() => {
    const r = normalizePossessions({}, { Mara: [] });
    return Array.isArray(r.Mara) && r.Mara.length === 0;
  })());

// ── 5. a character carrying real items through an unrelated later map is untouched ──
check('6. a character the later map never mentions keeps their possessions (regression)',
  (() => {
    const ch1 = buildInitialLedger(); ch1.possessions = { Dov: ['river stone'] };
    const ch2 = buildInitialLedger(); ch2.possessions = { Ilse: ['wrench'] };
    const m = mergeLedgers(ch1, ch2);
    return (m.possessions.Dov || []).includes('river stone') && (m.possessions.Ilse || []).includes('wrench');
  })());

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
