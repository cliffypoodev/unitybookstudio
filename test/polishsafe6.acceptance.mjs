// POLISHSAFE-6 acceptance battery — NF mode is typography-only at the STAGE,
// not just at the guard (Arc G finding 43).
//
// "Nonfiction Core" and "Anti-Detection Polish" kept attempting letter
// changes in NF mode; NFGUARD-1 caught and reverted them after the fact,
// which is wasted work — and, measured live, the ticket's own framing
// ("typography sub-steps... anything that cannot change a letter or digit")
// turns out to be a LOOSER bar than NFGUARD-1's actual revert criterion
// (nfContentEquivalent, which also rejects a dash becoming a comma, or any
// new punctuation being inserted). Confirmed empirically: an em-dash
// reduction inside these two stages passes the "no letter changed" test but
// still fails nfContentEquivalent and gets reverted. So both stages become
// full no-ops for NF — real typography (quote glyphs, whitespace) is still
// delivered afterward by the pipeline's unconditional PHASE H.
//
// manuscriptPolishRunner.js transitively imports the Vite "@/" alias —
// node:module's register() resolves it from inside this file, matching
// test/polishsafe5.acceptance.mjs / test/legacystages1.acceptance.mjs.
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
  const origError = console.error;
  console.log = (...a) => { lines.push(a.join(' ')); };
  console.warn = (...a) => { lines.push(a.join(' ')); };
  console.error = (...a) => { lines.push(a.join(' ')); };
  let result;
  try {
    result = await fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
  return { result, lines };
};

const lettersOnly = (s) => String(s || '').replace(/[^a-zA-Z0-9]/g, '');

// The exact fixture the em-dash reducer inside both stages is confirmed
// (live, both before and after this fix) to reach — three em-dashes in one
// sentence, enough words either side to clear each sub-step's own minimums.
const EMDASH_NF_TEXT = 'The report — filed late by staff — showed problems — real and documented — that nobody expected to find in the final review process this year.';

// ── 1. NF fixture: letters unchanged after the run (regression guard) ──
{
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: EMDASH_NF_TEXT, original: EMDASH_NF_TEXT }];
  await runManuscriptPolishPipeline({ loaded, project: { title: 'Test', genre: 'Business', book_type: 'nonfiction' }, allowLLM: false, mode: 'nonfiction' });
  check('1. NF fixture: letters-and-digits sequence unchanged after the run', lettersOnly(loaded[0].content) === lettersOnly(EMDASH_NF_TEXT), loaded[0].content);
}

// ── 1b. the actual point of the fix: NFGUARD-1 never has to revert these two stages any more ──
{
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: EMDASH_NF_TEXT, original: EMDASH_NF_TEXT }];
  const { lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded, project: { title: 'Test', genre: 'Business', book_type: 'nonfiction' }, allowLLM: false, mode: 'nonfiction',
  }));
  check('1b. em-dashes survive untouched (the stage never attempted the change, so there is nothing to revert)',
    (loaded[0].content.match(/—/g) || []).length === (EMDASH_NF_TEXT.match(/—/g) || []).length);
  check('1c. no [NFGUARD-1] ... REVERTED line fires at all for this fixture', !lines.some((l) => l.includes('[NFGUARD-1]') && l.includes('REVERTED')), JSON.stringify(lines.filter((l) => l.includes('NFGUARD-1'))));
}

// ── 2. NF fixture: typography IS still normalized (delivered by the unconditional PHASE H, not these stages) ──
{
  const text = 'The report said, "the policy failed," according to staff records from last year filed with the office.';
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text }];
  await runManuscriptPolishPipeline({ loaded, project: { title: 'Test', genre: 'Business', book_type: 'nonfiction' }, allowLLM: false, mode: 'nonfiction' });
  check('2. straight quotes are still normalized to curly quotes in NF mode', loaded[0].content.includes('“the policy failed,”'), loaded[0].content);
}

// ── 3. the exact log line fires for both stages, once per chapter ──
{
  const text1 = EMDASH_NF_TEXT;
  const text2 = 'A second nonfiction chapter with its own separate paragraph of plain text for the log-line check.';
  const loaded = [
    { chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text1, original: text1 },
    { chapter: { chapter_number: 2, title: 'Ch 2', id: 'ch2' }, content: text2, original: text2 },
  ];
  const { lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded, project: { title: 'Test', genre: 'Business', book_type: 'nonfiction' }, allowLLM: false, mode: 'nonfiction',
  }));
  for (const stage of ['Nonfiction Core', 'Anti-Detection Polish']) {
    for (const chNum of [1, 2]) {
      const exact = `[POLISHSAFE-6] ${stage} Ch.${chNum}: typography-only (NF)`;
      check(`3. "${exact}" fires exactly once`, lines.filter((l) => l === exact).length === 1, JSON.stringify(lines.filter((l) => l.includes('POLISHSAFE-6'))));
    }
  }
}

// ── 4. fiction fixture: byte-identical to the pre-change captured baseline ──
{
  const sentences = [];
  for (let i = 0; i < 26; i++) sentences.push(`The old house on the hill creaked loudly in the wind number ${i}.`);
  sentences.push('It was a emergency, and Mara ran toward the door without thinking twice today.');
  sentences.push('Dov picked up a apple from the table and looked at Mara near a old crate nearby.');
  const text = sentences.join(' ');
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text }];
  await runManuscriptPolishPipeline({ loaded, project: { title: 'Baseline Fixture', genre: 'Fantasy', book_type: 'fiction' }, allowLLM: false, mode: 'fiction' });

  const GOLDEN = 'The old house on the hill creaked loudly in the wind number 0, and the old house on the hill creaked loudly in the wind number 1. The old house on the hill creaked loudly in the wind number 2. The old house on the hill creaked loudly in the wind number 3. The old house on the hill creaked loudly in the wind number 4. The old house on the hill creaked loudly in the wind number 5. The old house on the hill creaked loudly in the wind number 6. The old house on the hill creaked loudly in the wind number 7. The old house on the hill creaked loudly in the wind number 8. The old house on the hill creaked loudly in the wind number 9. The old house on the hill creaked loudly in the wind number 10. The old house on the hill creaked loudly in the wind number 11. The old house on the hill creaked loudly in the wind number 12. The old house on the hill creaked loudly in the wind number 13. The old house on the hill creaked loudly in the wind number 14. The old house on the hill creaked loudly in the wind number 15. The old house on the hill creaked loudly in the wind number 16. The old house on the hill creaked loudly in the wind number 17. The old house on the hill creaked loudly in the wind number 18. The old house on the hill creaked loudly in the wind number 19. The old house on the hill creaked loudly in the wind number 20. The old house on the hill creaked loudly in the wind number 21. The old house on the hill creaked loudly in the wind number 22. The old house on the hill creaked loudly in the wind number 23. The old house on the hill creaked loudly in the wind number 24. The old house on the hill creaked loudly in the wind number 25. It was an emergency, and Mara ran toward the door without thinking twice today. Dov picked up a apple from the table and looked at Mara near an old crate nearby.';

  check('4. fiction output is byte-identical to the captured pre-change baseline', loaded[0].content === GOLDEN, loaded[0].content);
}

// ── 5a. mode says fiction, project says NF -> must still restrict (proves the real authority is called, not `mode`) ──
{
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: EMDASH_NF_TEXT, original: EMDASH_NF_TEXT }];
  const { lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded, project: { title: 'Test', book_type: 'nonfiction', genre: 'Business' }, allowLLM: false, mode: 'fiction',
  }));
  check('5a. mode:"fiction" + project.book_type:"nonfiction" still logs typography-only (the real authority decides, not mode)',
    lines.includes('[POLISHSAFE-6] Anti-Detection Polish Ch.1: typography-only (NF)'), JSON.stringify(lines.filter((l) => l.includes('POLISHSAFE-6'))));
  check('5a-b. em-dashes are untouched under that same mismatched mode/project pair',
    (loaded[0].content.match(/—/g) || []).length === (EMDASH_NF_TEXT.match(/—/g) || []).length);
}

// ── 5b. mode says nonfiction, project says fiction -> must NOT restrict "Nonfiction Core" ──
{
  const text = 'It was a emergency and everyone in the old house near the old road ran without a second thought about a apple left behind.';
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text }];
  const { lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded, project: { title: 'Test', book_type: 'fiction', genre: 'Fantasy' }, allowLLM: false, mode: 'nonfiction',
  }));
  check('5b. mode:"nonfiction" + project.book_type:"fiction" does NOT log typography-only for Nonfiction Core (full behavior still runs)',
    !lines.includes('[POLISHSAFE-6] Nonfiction Core Ch.1: typography-only (NF)'), JSON.stringify(lines.filter((l) => l.includes('POLISHSAFE-6'))));
}

// ── 6. source-shape guard: the real isNonfictionProject authority gates both stages ──
{
  const src = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url), 'utf8');
  check('6. isNonfictionProject is imported from the authority module', src.includes("import { isNonfictionProject } from './projectType.js';"));
  const nfCoreRegion = src.slice(src.indexOf("if (mode === 'nonfiction') {"), src.indexOf("verifyInvariant('Nonfiction Core')"));
  const antiDetectRegion = src.slice(src.indexOf('// B7: Anti-AI detection'), src.indexOf("verifyInvariant('Anti-Detection Polish')"));
  check('6b. "Nonfiction Core" region calls isNonfictionProject(project)', nfCoreRegion.includes('isNonfictionProject(project)'));
  check('6c. "Anti-Detection Polish" region calls isNonfictionProject(project)', antiDetectRegion.includes('isNonfictionProject(project)'));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
