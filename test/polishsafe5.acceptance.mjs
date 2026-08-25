// POLISHSAFE-5 + PROSE-GUARD-1 acceptance battery — finding 32 (Arc F
// live-proof Run 1, STOP-class).
//
// manuscriptPolishRunner.js's "B3.5: Banned AI-slop character-name
// auto-rename" built an automatic replacement map from getAllBlockedNames()
// and called applyApprovedNameReplacementMap ("Approved" — nothing was ever
// approved) with no gate afterward. Live: it rewrote REDUX Ch.10's
// antagonist "Silas" to "Dean" x20 — the exact name the book's own bible
// says he is never called. Fixed: flag only, never rewrite. PROSE-GUARD-1
// (report mode) measures what every deterministic stage actually changes —
// the stage inventory Arc C was meant to produce — instead of relying on
// comments.
//
// manuscriptPolishRunner.js transitively imports the Vite "@/" alias and
// cannot run under the bare `node file.mjs` test/run-all.mjs uses UNLESS the
// alias loader is registered first. node:module's register() (stable since
// Node 20.6) does this programmatically, from inside the file itself, so
// the checks below actually EXECUTE the full pipeline rather than falling
// back to source-shape-only assertions.
import fs from 'node:fs';
import { register } from 'node:module';
register('../tests/helpers/aliasLoader.mjs', import.meta.url);
const { runManuscriptPolishPipeline } = await import('../src/lib/manuscriptPolishRunner.js');

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const withCapturedConsole = async (fn) => {
  const lines = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (...a) => { lines.push(a.join(' ')); };
  console.warn = (...a) => { lines.push(a.join(' ')); };
  let result;
  try {
    result = await fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }
  return { result, lines };
};

// ── source-shape: the auto-rename call is gone; the stage flags only ──
{
  const SRC = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url).pathname, 'utf8');
  check('1. applyApprovedNameReplacementMap is no longer called (auto-rename removed)', !SRC.includes('applyApprovedNameReplacementMap('));
  check('2. the banned-name stage logs [NAME-HYGIENE] banned name present ... flagged only', SRC.includes('[NAME-HYGIENE] banned name present:') && SRC.includes('flagged only'));
  check('3. the stage pushes a changes entry naming the banned name and count', /changes\.push\(`Banned name "\$\{name\}"/.test(SRC));
}

// ── full pipeline, LLM off: a Tier-1 banned name is present in the fixture ──
{
  // "Kaelen" is a real entry in TIER_1_ALWAYS_BANNED_AI_NAMES (nameHygieneRules.js)
  // — the point is exercising the actual detection list, not an invented name.
  // Straight quotes deliberately avoided: this fixture isolates the banned-
  // name behavior from the pipeline's own (legitimate) typography normalization.
  const text = 'Mara walked into the room. Kaelen was already there, waiting by the window, his coat still damp from the rain outside. Kaelen said nothing at first, and Mara only nodded once.';
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text }];
  const { result } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded,
    project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' },
    allowLLM: false,
    mode: 'fiction',
  }));
  check('4. a Tier-1 banned name in a fixture is unchanged after the full pipeline with the LLM off',
    loaded[0].content === text, loaded[0].content);
  check('5. the run reports it as flagged (a changes entry naming the name and count)',
    (result.changes || []).some((c) => c.includes('Banned name "Kaelen"') && c.includes('flagged only')), JSON.stringify(result.changes));
}

// ── PROSE-GUARD-1: fires on a real letters change, stays silent on punctuation-only ──
{
  const text = 'Mara picked up a apple from the table and looked at Dov, who was standing near a old crate by the door, waiting for her to say something.';
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text }];
  const { lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded,
    project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' },
    allowLLM: false,
    mode: 'fiction',
  }));
  check('6. [PROSE-GUARD] fires with the stage name and chapter when a deterministic stage changes letters',
    lines.some((l) => /^\[PROSE-GUARD\] .+ Ch\.1: letters changed$/.test(l)), JSON.stringify(lines.filter((l) => l.includes('PROSE-GUARD'))));
}
{
  const text = 'Mara said, "Wait for me by the door," and then walked away without looking back at all.';
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text }];
  const { result, lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded,
    project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' },
    allowLLM: false,
    mode: 'fiction',
  }));
  const lettersOnly = (s) => String(s || '').replace(/[^a-zA-Z0-9]/g, '');
  check('7. quote normalization (punctuation-only) changed the text but not its letters-and-digits sequence',
    loaded[0].content !== text && lettersOnly(loaded[0].content) === lettersOnly(text), loaded[0].content);
  check('8. [PROSE-GUARD] never fires when only punctuation/whitespace changed',
    !lines.some((l) => l.includes('[PROSE-GUARD]')), JSON.stringify(lines.filter((l) => l.includes('PROSE-GUARD'))));
  void result;
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
