// NFCLASS-4 acceptance — the transform stage, and the last two things that could
// silently ship the wrong content.
//
// Three defects, all proven against the live files:
//
//  1. transformPrompts.js decided project type with `pt.includes('non')` — substring
//     matching on a type string, the exact failure projectType.js was written to end —
//     and its caller collapsed the project to `project_type || book_type`, the OPPOSITE
//     precedence from the authority, dropping genre inference. A project declared
//     { book_type: 'nonfiction', project_type: 'novel' } was offered Series Bible,
//     Character Bible and Graphic Novel Script, and its audiobook prompt lost the
//     citation and source-quote handling.
//
//  2. sourceText fell back to the WHOLE MANUSCRIPT when a per-chapter format was given
//     an empty chapter. A 20-chapter project with chapter 12 undrafted produced a
//     screenplay of the entire book, auto-saved and labelled "## Chapter 12", with a
//     success toast.
//
//  3. ExportTab appended a literal "[EXPORT BLOCKER: Bibliography has too few credible
//     …]" line to the bibliography and relied on a hard gate to catch it. No gate
//     matched that string, so it shipped to the reader.
import fs from 'fs';
import { isNonfictionProject } from '../src/lib/projectType.js';
import { getTransformPrompt, formatsForProjectType, getFormat } from '../src/lib/transformPrompts.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};
const threw = (fn) => { try { fn(); return null; } catch (err) { return err; } };
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url).pathname, 'utf8');
const executable = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');

// ── 1. type resolution ──
{
  const TP = executable(read('src/lib/transformPrompts.js'));
  const TS = executable(read('src/components/tools/TransformSubPage.jsx'));

  check('transformPrompts no longer substring-matches on "non"',
    !/includes\('non'\)/.test(TP));
  check('the transform caller asks the authority',
    /isNonfictionProjectAuthority\(project\)/.test(TS));
  check('…and no longer uses project_type-first precedence',
    !/project\?\.project_type \|\| project\?\.book_type/.test(TS));

  // The mapping the caller performs must agree with the authority on every shape.
  const shapes = [
    { id: 'a', book_type: 'nonfiction', project_type: 'novel' },
    { id: 'b', book_type: 'fiction', project_type: 'nonfiction' },
    { id: 'c', genre: 'Memoir' },
    { id: 'd', book_type: 'fiction', genre: 'Historical Fiction' },
    { id: 'e', project_type: 'nonfiction' },
  ];
  for (const p of shapes) {
    const mapped = isNonfictionProject(p) ? 'nonfiction' : 'fiction';
    const formats = formatsForProjectType(mapped);
    const nonfictionOnly = formats.every((f) => f.worksForNonfiction);
    check(`format list matches the authority for ${JSON.stringify(p).slice(0, 52)}`,
      mapped === 'nonfiction' ? nonfictionOnly : formats.length > 0,
      `mapped=${mapped} formats=${formats.length}`);
  }

  // "novel", "anthology" and anything else must not read as nonfiction.
  check('only the exact string "nonfiction" filters the format list',
    formatsForProjectType('novel').length === formatsForProjectType('fiction').length
    && formatsForProjectType('nonfiction').length < formatsForProjectType('fiction').length);
}

// ── 2. an empty chapter never becomes the whole book ──
{
  const perChapter = ['audiobook', 'screenplay', 'chapsummaries']
    .filter((id) => getFormat(id)?.perChapter);
  check('there is at least one per-chapter format to test', perChapter.length > 0,
    'none of the sampled ids are perChapter');

  const fullBook = 'CHAPTER ONE. The whole manuscript, every word of it, all twenty chapters.';
  for (const id of perChapter) {
    const err = threw(() => getTransformPrompt(id, '', fullBook, 'fiction'));
    check(`per-chapter format "${id}" refuses an empty chapter instead of substituting the book`,
      err !== null && /per-chapter format/.test(err.message), err ? err.message : 'no error thrown');

    const ok = getTransformPrompt(id, 'The real chapter text.', fullBook, 'fiction');
    check(`…and still works with real chapter text: "${id}"`,
      ok.includes('The real chapter text.') && !ok.includes('every word of it'));
  }

  // Book-level formats legitimately use the full text.
  const bookLevel = ['backcover', 'querysynopsis'].filter((id) => {
    const f = getFormat(id);
    return f && !f.perChapter;
  });
  for (const id of bookLevel) {
    const out = getTransformPrompt(id, '', fullBook, 'fiction');
    check(`book-level format "${id}" still uses the full manuscript`,
      out.includes('every word of it'));
  }
}

// ── 3. nothing writes an export marker into the manuscript ──
{
  const XE = executable(read('src/components/publishing/ExportTab.jsx'));
  check('no code path appends an [EXPORT BLOCKER …] line to chapter text',
    !/\[EXPORT BLOCKER/.test(XE));
  check('the condition is reported to the caller instead',
    /bibliographyUnderfunded/.test(XE));
  check('…and logged with the chapter it belongs to',
    /\[EXPORTSCRUB-1\] Ch\.\$\{chapter\?\.chapter_number/.test(XE));
  check('one book\'s subject vocabulary is no longer the credibility test',
    /exportRuleEnabled\(project, 'prisonHistorySources'\) && MISSOURI_GOTHIC_SOURCE_DOMAIN_RE/.test(XE));
  check('the generic source-shape test now covers ordinary scholarly sources',
    /university\|press\|journal\|bureau/.test(XE));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
