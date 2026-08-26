// VERSIONS-1D acceptance battery — three nits (Arc G findings 46/51).
//
// (a) saveBibliographyChapter called prepareChapterContent with only 3 args,
// omitting the existingChapter parameter the helper needs to compute
// previous_content_md_url — every bibliography resave silently lost its
// prior version. (b) No caller of prepareChapterContent ever short-circuited
// on byte-identical content, so a no-op save still minted a "new" version.
// (c) manuscriptPolishRunner.js's verifyInvariant keyed its loop on
// f.chapter.id; two `loaded` entries sharing an id hit the same snapshot and
// could log the identical [PROSE-GUARD]/[STRUCTURE-GUARD] line twice for one
// logical chapter.
//
// chapterStorage.js and manuscriptPolishRunner.js transitively import the
// Vite "@/" alias — node:module's register() resolves it from inside this
// file (matching test/versions1.acceptance.mjs and test/polishsafe5.acceptance.mjs),
// so these checks execute the real functions rather than falling back to
// source-shape-only assertions.
import fs from 'node:fs';
import { register } from 'node:module';
register('../tests/helpers/aliasLoader.mjs', import.meta.url);
const { prepareChapterContent, resolveChapterContent } = await import('../src/lib/chapterStorage.js');
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

// ── (a) source-shape: saveBibliographyChapter passes existingBib to prepareChapterContent ──
{
  const SRC = fs.readFileSync(new URL('../src/lib/bibliographyGenerator.js', import.meta.url).pathname, 'utf8');
  const fnBody = SRC.slice(SRC.indexOf('export async function saveBibliographyChapter'), SRC.indexOf('\n}\n', SRC.indexOf('export async function saveBibliographyChapter')));
  check('1. saveBibliographyChapter calls prepareChapterContent with the existing chapter (4 args)',
    /prepareChapterContent\(bibText, project\.id, existingBib\?\.id \|\| 'bibliography', existingBib \|\| null\)/.test(fnBody), fnBody);
}

// ── (a) the underlying mechanism: an existing chapter with a prior URL gets previous_content_md_url ──
{
  const existingBib = {
    id: 'bib-1', chapter_number: 21, title: 'Bibliography & Sources',
    content_md_url: 'https://example.com/old-bib.md',
    content_md_char_count: 999999, content_md_word_count: 999999, // deliberately mismatched so the (b) no-op path does not trigger
  };
  const fields = await prepareChapterContent('A brand-new bibliography body, well under the inline size limit.', 'proj-1', existingBib.id, existingBib);
  check('2. a bibliography save with a prior URL records previous_content_md_url',
    fields.previous_content_md_url === 'https://example.com/old-bib.md', JSON.stringify(fields));
}

// ── (a) a brand-new bibliography (no existing chapter) has no previous URL ──
{
  const fields = await prepareChapterContent('First-ever bibliography body.', 'proj-1', 'bibliography', null);
  check('3. a brand-new bibliography (no existing chapter) has an empty previous_content_md_url', fields.previous_content_md_url === '');
}

// ── (b) an identical re-save mints nothing ──
{
  const text = 'Mara, Dov, and Ilse compiled this bibliography from three invented sources for the fixture.';
  const first = await prepareChapterContent(text, 'proj-2', 'ch-1', null);
  const existingChapter2 = {
    id: 'ch-1', chapter_number: 1,
    content_md: first.content_md, content_md_url: first.content_md_url,
    content_md_char_count: first.content_md_char_count, content_md_word_count: first.content_md_word_count,
    previous_content_md_url: first.previous_content_md_url,
  };
  const { result: second, lines } = await withCapturedConsole(() => prepareChapterContent(text, 'proj-2', 'ch-1', existingChapter2));

  check('4. an identical re-save returns the SAME content_md/content_md_url (nothing new minted)',
    second.content_md === existingChapter2.content_md && second.content_md_url === existingChapter2.content_md_url, JSON.stringify(second));
  check('4b. the exact "unchanged, no version minted" line is logged',
    lines.includes('[VERSIONS-1D] Ch.1: unchanged, no version minted'), JSON.stringify(lines));
  check('4c. the no-op save does not overwrite previous_content_md_url with today\'s (unchanged) url',
    second.previous_content_md_url === existingChapter2.previous_content_md_url, JSON.stringify(second));
}

// ── (b) a changed re-save still mints exactly one new version ──
{
  const originalText = 'Original bibliography body for the changed-save check.';
  const first = await prepareChapterContent(originalText, 'proj-3', 'ch-2', null);
  const existingChapter2 = {
    id: 'ch-2', chapter_number: 2,
    content_md: first.content_md, content_md_url: first.content_md_url,
    content_md_char_count: first.content_md_char_count, content_md_word_count: first.content_md_word_count,
  };
  const changedText = 'A genuinely different bibliography body, rewritten for the changed-save check.';
  const { result: second, lines } = await withCapturedConsole(() => prepareChapterContent(changedText, 'proj-3', 'ch-2', existingChapter2));

  check('5. a changed re-save produces different content', second.content_md !== existingChapter2.content_md, JSON.stringify(second));
  check('5b. the changed re-save records the PRIOR content_md_url as previous_content_md_url',
    second.previous_content_md_url === (existingChapter2.content_md_url || ''), JSON.stringify(second));
  check('5c. a changed save does not log the no-op line', !lines.some((l) => l.includes('unchanged, no version minted')), JSON.stringify(lines));
}

// ── (b) the URL-backed no-op path (the common case — most real chapters exceed MAX_INLINE_SIZE) ──
{
  const text = 'This is the body used to verify that the URL-backed no-op short-circuit path works correctly without a real network fetch.';
  const existingChapter = {
    id: 'ch-3', chapter_number: 3,
    content_md: '', content_md_url: 'https://example.com/blob.md',
    content_md_char_count: text.length, content_md_word_count: text.split(/\s+/).filter(Boolean).length,
    __polishedContent: text, // resolveChapterContent's transient-field short-circuit — no real fetch needed
  };
  const { result, lines } = await withCapturedConsole(() => prepareChapterContent(text, 'proj-4', 'ch-3', existingChapter));
  check('6. the URL-backed exact-compare path also short-circuits (no version minted)',
    result.content_md_url === existingChapter.content_md_url, JSON.stringify(result));
  check('6b. the exact log line fires for the URL-backed path too',
    lines.includes('[VERSIONS-1D] Ch.3: unchanged, no version minted'), JSON.stringify(lines));
}

// ── (b) regression guard: existing mocks with no char/word-count metadata are unaffected ──
{
  const existing = { id: 'ch1', content_md_url: 'https://example.com/old-blob.md' };
  const fields = await prepareChapterContent('Short new content for the chapter, well under the inline size limit.', 'proj1', 'ch1', existing);
  check('7. a mock lacking content_md_char_count/word_count falls through to the normal save path (no false-positive short-circuit)',
    fields.previous_content_md_url === 'https://example.com/old-blob.md', JSON.stringify(fields));
}

// ── (c) fixture reproduction: a duplicate chapter.id collision no longer double-logs [PROSE-GUARD] ──
{
  // Same fixture as test/polishsafe5.acceptance.mjs check 6 ("a apple" / "a old
  // crate" trips a deterministic a/an fix — a proven letters-changing stage).
  const text = 'Mara picked up a apple from the table and looked at Dov, who was standing near a old crate by the door, waiting for her to say something.';
  const loaded = [
    { chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text },
    { chapter: { chapter_number: 1, title: 'Ch 1 (duplicate record)', id: 'ch1' }, content: text, original: text },
  ];
  const { lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded,
    project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' },
    allowLLM: false,
    mode: 'fiction',
  }));
  const proseGuardCounts = {};
  for (const l of lines) {
    const m = l.match(/^\[PROSE-GUARD\] (.+) Ch\.1: letters changed$/);
    if (m) proseGuardCounts[m[1]] = (proseGuardCounts[m[1]] || 0) + 1;
  }
  check('8. a duplicate chapter.id collision logs [PROSE-GUARD] at most once per stage, not twice',
    Object.values(proseGuardCounts).every((c) => c === 1) && Object.keys(proseGuardCounts).length > 0,
    JSON.stringify(proseGuardCounts));
}

// ── (c) legitimate multi-chapter case is unaffected — distinct ids both still report ──
{
  const text1 = 'Mara picked up a apple from the table and looked at Dov, who was standing near a old crate by the door, waiting for her to say something.';
  const text2 = 'Ilse picked up a orange from the crate and looked at Mara, who was standing near a old ladder by the wall, waiting for him to say something.';
  const loaded = [
    { chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text1, original: text1 },
    { chapter: { chapter_number: 2, title: 'Ch 2', id: 'ch2' }, content: text2, original: text2 },
  ];
  const { lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded,
    project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' },
    allowLLM: false,
    mode: 'fiction',
  }));
  const ch1Fires = lines.filter((l) => /^\[PROSE-GUARD\] .+ Ch\.1: letters changed$/.test(l)).length;
  const ch2Fires = lines.filter((l) => /^\[PROSE-GUARD\] .+ Ch\.2: letters changed$/.test(l)).length;
  check('9. two genuinely different chapters both still report (the fix does not collapse real distinct chapters)',
    ch1Fires > 0 && ch2Fires > 0, JSON.stringify({ ch1Fires, ch2Fires, lines: lines.filter((l) => l.includes('PROSE-GUARD')) }));
}

// ── (c) source-shape: the dedupe guard is present in verifyInvariant ──
{
  const SRC = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url).pathname, 'utf8');
  const fnBody = SRC.slice(SRC.indexOf('function verifyInvariant'), SRC.indexOf('function verifyInvariant') + 800);
  check('10. verifyInvariant contains a seenKeys dedupe guard before reading __snapshots',
    /const seenKeys = new Set\(\)/.test(fnBody) && fnBody.indexOf('seenKeys') < fnBody.indexOf('__snapshots.get(key)'));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
