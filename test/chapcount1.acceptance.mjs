// CHAPCOUNT-1 acceptance — one authority for "how many chapters does this book have".
//
// MEASURED, live, on The Gilded Hour (2026-08-04) before a single word was drafted:
//
//   chapter_target  4          <- what the Setup screen writes
//   chapter_count   undefined  <- what sceneWriter.js read FIRST
//
// Both readers did `project.chapter_count || project.num_chapters || 20`, so they
// resolved 20 for a four-chapter book — and for EVERY project the current Setup
// screen creates, because it never writes chapter_count at all. Brass Meridian
// still carries chapter_count: 5 from an older version of that screen, which is
// exactly why this never surfaced on the book the gates were debugged against.
//
// The sharp consequence is `isFinalChapter = chapterNumber >= totalChapters`:
// false on chapter 4 of 4, so a volume's last chapter is never recognised as its
// last and the series exit contract is never enforced.
import fs from 'fs';
import {
  CHAPTER_COUNT_FIELDS, resolveChapterCount, enforceChapterCount,
} from '../src/lib/setupConstraints.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};
// resolveChapterCount warns on fallback; keep the battery output readable.
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

// ── the live defect ──
check('the live Gilded Hour shape resolves 4, not 20',
  resolveChapterCount({ id: 'gh', chapter_target: 4 }, 20) === 4);
check('the live Brass Meridian shape still resolves 5',
  resolveChapterCount({ id: 'bm', chapter_target: 5, chapter_count: 5 }, 20) === 5);
check('chapter 4 of a 4-chapter book IS the final chapter',
  4 >= resolveChapterCount({ chapter_target: 4 }, 20));
check('chapter 3 of a 4-chapter book is NOT the final chapter',
  !(3 >= resolveChapterCount({ chapter_target: 4 }, 20)));

// ── field precedence: the canonical field wins ──
check('chapter_target outranks a stale chapter_count',
  resolveChapterCount({ chapter_target: 4, chapter_count: 20 }, 99) === 4);
for (const f of ['chapter_count', 'num_chapters', 'total_chapters', 'chapterCount']) {
  check(`legacy field "${f}" alone still resolves`, resolveChapterCount({ [f]: 12 }, 99) === 12);
}
check('a string value resolves', resolveChapterCount({ chapter_target: '7' }, 99) === 7);
check('a fractional value floors', resolveChapterCount({ chapter_target: 4.9 }, 99) === 4);

// ── it never invents a number quietly ──
check('nothing set and no fallback returns null, not a guess',
  quiet(() => resolveChapterCount({ id: 'y' })) === null);
check('zero is not a chapter count', quiet(() => resolveChapterCount({ chapter_target: 0 })) === null);
check('a negative is not a chapter count', quiet(() => resolveChapterCount({ chapter_target: -3 })) === null);
check('a non-numeric value is not a chapter count', quiet(() => resolveChapterCount({ chapter_target: 'many' })) === null);
check('null project does not throw', quiet(() => resolveChapterCount(null)) === null);
{
  const seen = [];
  const w = console.warn; console.warn = (...a) => seen.push(a.join(' '));
  resolveChapterCount({ id: 'noisy' }, 20);
  resolveChapterCount({ chapter_target: 4 }, 20);
  console.warn = w;
  check('falling back to a default is announced, not silent',
    seen.length === 1 && /CHAPCOUNT-1/.test(seen[0]) && /noisy/.test(seen[0]), JSON.stringify(seen));
  check('resolving cleanly announces nothing', seen.length === 1);
}

// ── strip and resolve are ONE list, so a sixth spelling cannot drift ──
check('CHAPTER_COUNT_FIELDS is frozen', Object.isFrozen(CHAPTER_COUNT_FIELDS));
check('chapter_target is first, because enforceChapterCount writes it',
  CHAPTER_COUNT_FIELDS[0] === 'chapter_target');
check('every field the resolver reads is a field enforceChapterCount strips',
  CHAPTER_COUNT_FIELDS.every((f) => {
    const out = enforceChapterCount({ [f]: 99 }, 4);
    return f === 'chapter_target' ? out.chapter_target === 4 : out[f] === undefined;
  }));
check('enforceChapterCount strips all five at once and writes the user value',
  JSON.stringify(enforceChapterCount(
    { chapter_target: 1, chapter_count: 2, num_chapters: 3, total_chapters: 4, chapterCount: 5, keep: 'me' }, 4,
  )) === JSON.stringify({ keep: 'me', chapter_target: 4 }));
check('what enforceChapterCount writes is what resolveChapterCount reads',
  resolveChapterCount(enforceChapterCount({ chapter_count: 20 }, 4), 99) === 4);

// ── book-agnostic: three unrelated books, same structure, same verdicts ──
const BOOKS = [
  { id: 'arctic thriller', n: 5 },
  { id: 'gothic mystery', n: 4 },
  { id: 'legal thriller', n: 22 },
];
for (const b of BOOKS) {
  check(`${b.id}: a ${b.n}-chapter book resolves ${b.n}`,
    resolveChapterCount({ id: b.id, chapter_target: b.n }, 20) === b.n);
  check(`${b.id}: its last chapter is recognised as final`,
    b.n >= resolveChapterCount({ chapter_target: b.n }, 20));
}

// ── the readers actually use it (source assertion) ──
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('sceneWriter no longer reads chapter_count directly',
  !/project\.chapter_count\s*\|\|\s*project\.num_chapters\s*\|\|\s*20/.test(WRITER));
check('both totalChapters sites go through resolveChapterCount',
  (WRITER.match(/const totalChapters = resolveChapterCount\(project, 20\);/g) || []).length === 2);
check('sceneWriter imports the resolver',
  /import \{[^}]*resolveChapterCount[^}]*\} from '@\/lib\/setupConstraints'/.test(WRITER));
check('the hardcoded 20 survives only as an explicit, announced fallback',
  !/chapter_count \|\| 20|num_chapters \|\| 20/.test(WRITER));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
