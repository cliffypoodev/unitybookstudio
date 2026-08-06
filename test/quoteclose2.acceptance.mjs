// QUOTECLOSE-2 acceptance — close a trailing unclosed quote, never merge paragraphs.
import assert from 'node:assert';
import { closeTrailingUnclosedQuotes } from '../src/lib/quoteFixPolish.js';
let failures = 0;
const ok = (name, cond) => { assert.ok(cond, 'FAIL  ' + name); if (cond) { console.log('PASS  ' + name); } else { failures++; console.log('FAIL  ' + name); } };
const wc = (t) => (t.trim().match(/\S+/g) || []).length;
const pc = (t) => t.split(/\n\s*\n/).filter((p) => p.trim()).length;

{
  const src = 'Narration here.\n\nShe paused. “It did not.';
  const r = closeTrailingUnclosedQuotes(src);
  ok('closes trailing unclosed quote', r.changed === 1 && r.text.endsWith('“It did not.”'));
  ok('word count invariant', wc(r.text) === wc(src));
  ok('paragraph count invariant', pc(r.text) === pc(src));
  ok('idempotent', closeTrailingUnclosedQuotes(r.text).changed === 0);
}
ok('balanced paragraph untouched', closeTrailingUnclosedQuotes('“Hello,” she said. “Goodbye.”').changed === 0);
ok('already-closed tail untouched', closeTrailingUnclosedQuotes('“One.” “Two.” and narration “Three.”').changed === 0);
ok('non-terminal open left alone (no guessing)', closeTrailingUnclosedQuotes('“An interrupted thought and then').changed === 0);
{
  const src = 'Para one.\n\n“Unclosed line.';
  const r = closeTrailingUnclosedQuotes(src);
  ok('paragraph count preserved on repair', pc(r.text) === pc(src) && r.changed === 1);
}
console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
