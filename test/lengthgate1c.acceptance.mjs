// LENGTHGATE-1C acceptance — a back-matter chapter (Sources/Bibliography/
// appendix) is never going to be chapter-target length, and NFEXPORT-BIB-1
// already requires it to exist — the two requirements contradicted each
// other, hard-blocking every NF book that has both a length target and a
// real Sources chapter. Back matter is exempt from LENGTHGATE-1B's hard
// block and the BOOKGATE-2 SHORT advisory.
//
// exportSafetyGate.js transitively imports the Vite "@/" alias (via
// researchStorage.js), so it is run in a VM sandbox to avoid ESM import
// issues — same technique as lengthgate1.acceptance.mjs. `isBackMatter`'s
// logic is mirrored EXACTLY from bibliographyGenerator.js (verified below by
// a source-shape check against the real file) since that module also has
// @/-aliased dependencies and cannot be imported directly.
import { readFileSync } from 'fs';
import vm from 'node:vm';

let pass = 0, failures = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { failures++; console.log('FAIL ' + name + (detail ? `\n      ${detail}` : '')); }
}

const sgPath = new URL('../src/lib/exportSafetyGate.js', import.meta.url).pathname;
const sgCodeRaw = readFileSync(sgPath, 'utf-8');
const sgCode = sgCodeRaw.replace(/\/\/[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
const sgExec = sgCode.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
check('exportSafetyGate LENGTHGATE-1C skips the hard block for back matter', /explicitChapterTarget > 0 && !isBackMatter\(ch\)/.test(sgExec));
check('exportSafetyGate LENGTHGATE-1C filters back matter out of the BOOKGATE-2 SHORT advisory', sgExec.includes('shortChaptersFiltered') && sgExec.includes('!isBackMatter(chapters[d.n - 1])'));

// Mirror of bibliographyGenerator.js's real isBackMatter — verified against
// the actual file below so this mirror cannot silently drift.
function isBackMatter(ch) {
  const title = String(ch?.title || '').toLowerCase();
  return (
    title.includes('bibliography') ||
    title.includes('sources') ||
    title.includes('works cited') ||
    title.includes('references') ||
    title.includes('appendix') ||
    title.includes('acknowledgment') ||
    title.includes('about the author')
  );
}
{
  const BG = readFileSync(new URL('../src/lib/bibliographyGenerator.js', import.meta.url).pathname, 'utf-8');
  const start = BG.indexOf('export function isBackMatter(ch) {');
  const end = BG.indexOf('\n}\n', start) + 3;
  const realSrc = BG.slice(start, end);
  const mirrorSrc = isBackMatter.toString().replace('isBackMatter', '').replace(/^function\s*/, 'export function isBackMatter');
  check('the isBackMatter mirror matches the real source exactly', realSrc.replace(/\s+/g, ' ').trim() === mirrorSrc.replace(/\s+/g, ' ').trim().replace('export function isBackMatter (ch)', 'export function isBackMatter(ch)'), `real=${JSON.stringify(realSrc)}\n      mirror=${JSON.stringify(mirrorSrc)}`);
}

const warnings = [];
const errors = [];
const gcCtx = {
  console: {
    log: (...a) => warnings.push(a.join(' ')),
    warn: (...a) => warnings.push(a.join(' ')),
    error: (...a) => errors.push(a.join(' ')),
  },
  runManuscriptSafetyGate: () => ({
    ok: true,
    blocked: false,
    hardFailures: [],
    warnings: [],
    reasons: [],
    recommendedAction: '',
    processLeaks: { matches: [] },
    contamination: { matches: [] },
    malformed: { matches: [] },
  }),
  runReferenceIntegrityGate: () => ({ blocked: false, blockingIssues: [], advisoryIssues: [], warnings: [] }),
  ensureResearchEvidence: async (p) => p,
  checkStructuralIntegrity: () => ({ pass: true, quoteBalance: { pass: true, open: 0, close: 0, unbalancedParagraphs: 0, details: [] }, gluedWords: { pass: true, count: 0, details: [] }, unterminatedParagraphs: { pass: true, count: 0 }, typography: { pass: true, straightQuotes: 0, curlyOpen: 0 } }),
  checkBookIntegrity: (texts) => {
    // Every chapter is reported "short" (below the median floor) so the
    // BOOKGATE-2 exclusion has something real to filter.
    const shortChapters = texts.map((t, i) => ({ n: i + 1, words: (t || '').trim().split(/\s+/).filter(Boolean).length }));
    return {
      pass: shortChapters.length === 0,
      chapters: texts.length,
      medianWords: 4000,
      crossChapterEchoes: { pass: true, count: 0, details: [] },
      openingEchoes: { pass: true, count: 0, details: [] },
      shortChapters: { pass: shortChapters.length === 0, floor: 3000, details: shortChapters },
    };
  },
  isBackMatter,
  __e: {},
};
vm.createContext(gcCtx);

const vmSrc = sgCodeRaw
  .replace(/^import .*$/gm, '')
  .replace(/^export (async )?function/gm, '$1function')
  .replace(/^export (const|class|let)/gm, '$1')
  + '\n__e = { runPreExportSafetyGate };';

vm.runInContext(vmSrc, gcCtx);
const { runPreExportSafetyGate } = gcCtx.__e;

function makeFiller(words) {
  let text = '';
  for (let i = 0; i < words; i++) text += `word${i} `;
  return text.trim();
}

(async () => {
  const project = { target_chapter_words: 4000 };
  const text900 = makeFiller(900);

  const bibChapter = { chapter_number: 21, title: 'Bibliography & Sources', content_md: text900 };
  const bodyChapter = { chapter_number: 1, title: 'Chapter One', content_md: text900 };

  // 1. A 900-word back-matter chapter under a 4000-word target exports —
  //    no LENGTHGATE hard failure.
  const resBib = await runPreExportSafetyGate([bibChapter], { project });
  check(
    '1. a 900-word "Bibliography & Sources" chapter under a 4000-word target produces no LENGTHGATE hard failure',
    !resBib.hardFailures.some((f) => (f.reasons || []).some((r) => r.includes('[LENGTHGATE-1B]'))),
    JSON.stringify(resBib.hardFailures)
  );

  // 2. The same 900-word count on a BODY chapter still blocks.
  const resBody = await runPreExportSafetyGate([bodyChapter], { project });
  check(
    '2. a 900-word body chapter under the same 4000-word target still produces a LENGTHGATE-1B hard failure',
    resBody.blocked === true && resBody.hardFailures.some((f) => (f.reasons || []).some((r) => r.includes('[LENGTHGATE-1B]'))),
    JSON.stringify(resBody.hardFailures)
  );

  // 3. BOOKGATE-2 SHORT advisory: a back-matter-only book reports 0 short
  //    chapters (filtered), even though checkBookIntegrity's raw mock
  //    flags every chapter as short.
  const w3Before = warnings.length;
  await runPreExportSafetyGate([bibChapter], { project: {} });
  const bookgateLinesBib = warnings.slice(w3Before).filter((l) => l.includes('[BOOKGATE-2]') && l.includes('shortChapters='));
  check(
    '3. BOOKGATE-2 reports shortChapters=0 for a back-matter-only book',
    bookgateLinesBib.some((l) => l.includes('shortChapters=0')),
    JSON.stringify(bookgateLinesBib)
  );

  // 4. The same scenario on a BODY chapter still reports it as short.
  const w4Before = warnings.length;
  await runPreExportSafetyGate([bodyChapter], { project: {} });
  const bookgateLinesBody = warnings.slice(w4Before).filter((l) => l.includes('[BOOKGATE-2]') && l.includes('shortChapters='));
  check(
    '4. BOOKGATE-2 still reports a short BODY chapter (not filtered)',
    bookgateLinesBody.some((l) => l.includes('shortChapters=1')),
    JSON.stringify(bookgateLinesBody)
  );

  console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Test framework caught error:', err);
  process.exit(1);
});
