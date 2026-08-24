// DEADTEST-5 acceptance — a chapter heading is not truncated prose.
//
// PROVEN: tests/productionWiringSmoke.test.mjs — "Fiction: export gate passes
// after repair" — failed even after dialogue repair reported 0 remaining issues.
// Verified pre-existing and unrelated to any DEADTEST-1..4 fix or Arc A, by
// reproducing it in an isolated git worktree at the untouched 2cfa197 baseline.
//
// Root cause: checkStructuralIntegrity's "unterminated paragraph" check (BOOKGATE-1)
// exempts legitimate structural headings via isStructuralHeadingLine/
// BACKMATTER_HEADING_RX (BACKMATTER-1, a45122e7) — but that closed vocabulary
// included "part" (Part One, Part II, ...) and never "chapter", the single most
// common heading in a book. A completely ordinary opening line like
// "Chapter 1: The Chase" was scored as a paragraph that "just stops mid-thought"
// and hard-blocked the export gate.
//
// Fixed by adding a bounded CHAPTER_HEADING_RX exemption: "chapter" + a number
// (digit, roman numeral, or spelled-out one-through-ten, matching the same
// closed vocabulary depth "part" already uses) optionally followed by a short
// (<=80 char) subtitle after a colon/dash/period — narrow enough that genuine
// truncated prose starting with an unrelated sentence still hard-blocks
// (test/nfpolish-safety.acceptance.mjs's "genuine truncation STILL flagged"
// check, unchanged by this fix, proves that).
import { checkStructuralIntegrity } from '../src/lib/pipelineValidator.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const chapterWith = (heading) => `${heading}\n\nMara pressed her back against the cold wall. The alley stank of rust.\n\n“We need to go,” she said. “Now.”\n\nDov nodded once and led the way.`;

// ── 1. the exact defect, reproduced with a generic title ──
{
  const r = checkStructuralIntegrity(chapterWith('Chapter 1: The Chase'), 1);
  check('1. "Chapter 1: The Chase" no longer hard-blocks as unterminated',
    r.unterminatedParagraphs.pass === true && r.unterminatedParagraphs.count === 0,
    JSON.stringify(r.unterminatedParagraphs));
  check('1b. the overall structural check passes',
    r.pass === true, JSON.stringify(r));
}

// ── 2. other legitimate chapter-heading shapes ──
check('2. a roman-numeral chapter heading passes',
  checkStructuralIntegrity(chapterWith('Chapter IV'), 1).unterminatedParagraphs.pass === true);
check('3. a spelled-out chapter number passes',
  checkStructuralIntegrity(chapterWith('Chapter Seven'), 1).unterminatedParagraphs.pass === true);
check('4. a bare chapter number with no subtitle passes',
  checkStructuralIntegrity(chapterWith('Chapter 12'), 1).unterminatedParagraphs.pass === true);
check('5. a dash-separated subtitle passes',
  checkStructuralIntegrity(chapterWith('Chapter 3 — Betrayal'), 1).unterminatedParagraphs.pass === true);

// ── 6. the existing "part" exemption is untouched ──
check('6. "Part One" still passes (regression, BACKMATTER-1 unchanged)',
  checkStructuralIntegrity(chapterWith('Part One'), 1).unterminatedParagraphs.pass === true);

// ── 7. genuine mid-thought truncation still hard-blocks (the exemption is narrow) ──
{
  const truncated = 'Mara pressed her back against the cold wall.\n\nShe turned the key and';
  const r = checkStructuralIntegrity(truncated, 1);
  check('7. genuine truncated prose is still flagged (no false-negative introduced)',
    r.unterminatedParagraphs.pass === false && r.unterminatedParagraphs.count === 1,
    JSON.stringify(r.unterminatedParagraphs));
}
check('8. a sentence merely containing the word "chapter" mid-prose is not exempted',
  (() => {
    const r = checkStructuralIntegrity('She read the whole chapter and put the book down and', 1);
    return r.unterminatedParagraphs.pass === false;
  })());

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
