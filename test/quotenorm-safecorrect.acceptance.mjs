// QUOTENORM-1 + SAFECORRECT-1 acceptance battery.
// Run from repo root: node test/quotenorm-safecorrect.acceptance.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { normalizeSmartQuotesOnly } from '../src/lib/quoteFixPolish.js';

let failures = 0;
const ok = (name, cond) => { assert.ok(cond, 'FAIL  ' + name); if (cond) { console.log('PASS  ' + name); } else { failures++; console.log('FAIL  ' + name); } };

const wc = (t) => (t.trim().match(/\S+/g) || []).length;
const pc = (t) => t.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).length;
const straight = (t) => (t.match(/"/g) || []).length;

console.log('QUOTENORM-1 — function behaviour');
{
  const r = normalizeSmartQuotesOnly('He said "hello" to her.');
  ok('straight doubles become curly, none left', straight(r.text) === 0 && r.text.includes('“hello”'));
}
{
  const r = normalizeSmartQuotesOnly("don't stop, it's Halvard' book");
  ok('contraction + possessive apostrophes curl', r.text === 'don’t stop, it’s Halvard’ book');
}
{
  const r = normalizeSmartQuotesOnly("say 'tis odd now");
  ok('opening single quote is left as authored', r.text.startsWith("say 'tis"));
}
{
  const clean = '“Hello,” she said.';
  const r = normalizeSmartQuotesOnly(clean);
  ok('already-curly input is a no-op', r.changed === 0 && r.text === clean);
}
{
  const src = 'Line one has "a quote."\n\nLine two says "more" and don\'t forget.\n\nEnd.';
  const r = normalizeSmartQuotesOnly(src);
  ok('word count invariant', wc(r.text) === wc(src));
  ok('paragraph count invariant', pc(r.text) === pc(src));
  ok('no straight doubles remain', straight(r.text) === 0);
  const r2 = normalizeSmartQuotesOnly(r.text);
  ok('idempotent (second pass changes nothing)', r2.changed === 0 && r2.text === r.text);
}

console.log('SAFECORRECT-1 — LLM rewrite gated off at both call sites');
{
  const ps = readFileSync('src/pages/ProjectStudio.jsx', 'utf8');
  ok('no allowLLM: true remains', (ps.match(/allowLLM: true/g) || []).length === 0);
  ok('two allowLLM: false present', (ps.match(/allowLLM: false/g) || []).length === 2);
}

console.log('QUOTENORM-1 — wired as the last mutating step');
{
  const runner = readFileSync('src/lib/manuscriptPolishRunner.js', 'utf8');
  ok('normalizeSmartQuotesOnly imported', /import \{[^}]*normalizeSmartQuotesOnly[^}]*\} from '\.\/quoteFixPolish\.js';/.test(runner));
  const hasPhaseH = runner.indexOf('PHASE H: Typography normalization');
  const complete = runner.indexOf('========== COMPLETE ==========');
  ok('PHASE H present', hasPhaseH !== -1);
  ok('PHASE H runs before the COMPLETE log', hasPhaseH !== -1 && complete !== -1 && hasPhaseH < complete);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
