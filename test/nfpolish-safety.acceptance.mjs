// NF POLISH SAFETY acceptance — TRIPLETRETIRE-1 / NFCLASS-5 / NFQUOTE-1 / LINEKEEP-1 / BACKMATTER-1.
// Run from repo root: node --experimental-vm-modules test/nfpolish-safety.acceptance.mjs
// NOTE: these modules are import-clean (no @/ aliases) — plain node works.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { runAntiDetectionPolish } from '../src/lib/antiDetectionPolish.js';
import { runDisclaimerStripper } from '../src/lib/disclaimerStripper.js';
import { checkStructuralIntegrity } from '../src/lib/pipelineValidator.js';

let failures = 0;
const ok = (name, cond) => { 
  if (!cond) failures++;
  assert.ok(cond, 'FAIL: ' + name); 
  console.log('PASS ' + name); 
};
const mk = (c, n = 1) => [{ content: c, original: c, chapter: { id: 'a' + n, chapter_number: n, title: 'T' } }];

console.log('TRIPLETRETIRE-1 — lists and initials survive anti-detection');
{
  const LIST = 'The wave destroyed the freight sheds, the firehouse, and the elevated railway trestle.';
  const INIT = 'He wrote of it later. W. E. B. Du Bois wrote about industrial negligence. J. P. Morgan appears in the same records.';
  const l1 = mk(LIST); runAntiDetectionPolish(l1, null, { project: { book_type: 'nonfiction' } });
  ok('three-item factual list intact', l1[0].content === LIST);
  const l2 = mk(INIT); runAntiDetectionPolish(l2, null, { project: { book_type: 'nonfiction' } });
  ok('initials intact (no semicolon merge, no downcase)', l2[0].content === INIT);
  const l3 = mk(LIST); runAntiDetectionPolish(l3, null, { project: { book_type: 'fiction' } });
  ok('fiction list intact too (retired for ALL types)', l3[0].content === LIST);
}

console.log('NFCLASS-5 — the authority decides, not raw book_type');
{
  const src = readFileSync('src/lib/antiDetectionPolish.js', 'utf8');
  ok('imports isNonfictionProject', src.includes("import { isNonfictionProject } from './projectType.js'"));
  ok('no raw book_type check remains', !src.includes("project.book_type === 'nonfiction'"));
}

console.log('NFQUOTE-1 — closer placement (source assertions)');
{
  const src = readFileSync('src/lib/nonfictionPolish.js', 'utf8');
  ok('attribution detection regex exists', src.includes('attrM = tail.match(/,\\s+(said|says|wrote|writes|reported|reports|testified|argued|recalled|added|noted|according to)\\b/i)'));
  ok('inserting quote before attribution exists', src.includes("para = para.slice(0, insertAt) + '”' + para.slice(insertAt)"));
  ok('closer-after-period fallback exists', src.includes("para = para.replace(/([.!?])(\\s*)$/, '$1”$2')"));
  ok('closer-before-period artifact is gone', !src.includes("para = para.replace(/([.!?])(\\s*)$/, '”$1$2')"));
}

console.log('LINEKEEP-1 — line structure survives the disclaimer stripper');
{
  const REFS = 'Sources\n\nPuleo, Stephen. Dark Tide. Beacon Press, 2003.\nBoston Globe, January 16, 1919.\nOgden, Hugh W. Auditor’s Report, 1925.';
  const l = mk(REFS); runDisclaimerStripper(l, null);
  ok('citation lines keep their newlines', l[0].content === REFS);
  const DISC = 'Real sentence stays.\nThe following account is a composite drawn from documented sources.\nThird line stays.';
  const l2 = mk(DISC); runDisclaimerStripper(l2, null);
  ok('disclaimer removed, other lines intact', l2[0].content.includes('Real sentence stays.') && l2[0].content.includes('Third line stays.') && !/composite/i.test(l2[0].content));
}

console.log('BACKMATTER-1 — headings are not truncation; truncation still is');
{
  ok('Sources heading exempt', checkStructuralIntegrity('Sources\n\nPuleo, Stephen. Dark Tide. Beacon Press, 2003.').unterminatedParagraphs.count === 0);
  ok('markdown heading exempt', checkStructuralIntegrity('## Notes\n\nAll fine here.').unterminatedParagraphs.count === 0);
  ok('Appendix B exempt', checkStructuralIntegrity('Appendix B\n\nTables follow.').unterminatedParagraphs.count === 0);
  ok('genuine truncation STILL flagged', checkStructuralIntegrity('She turned the key and\n\nThe lock held.').unterminatedParagraphs.count === 1);
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
