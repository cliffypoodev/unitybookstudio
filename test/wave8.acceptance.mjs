// WAVE8 acceptance battery — the AI Check stops being read-only.
//
//   WAVE8-LOCATE     the passage locator refuses ambiguous and stale matches
//   WAVE8-SNAPSHOT   every tool-initiated overwrite snapshots first, or aborts
//   WAVE8-APPLY      findings carry chapter identity and can be written back
//   WAVE8-FIXEDITOR  FixPassagesEditor is reachable and no longer fails silently
//   WAVE8-REFRESH    the dead onRefreshAll prop is actually called
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { locatePassage, flexibleMatcher } from '../src/lib/passageLocator.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

// ── WAVE8-LOCATE ─────────────────────────────────────────────────────────────
// Behavioural, not source-scraping: this is the guard standing between a
// novelist's manuscript and a wrong-paragraph overwrite, so it gets run.
const CHAPTER = [
  'The rain had not stopped for three days.',
  '',
  'Marta counted the tiles again. She felt a sense of dread.',
  '',
  'He walked to the window. The rain had not stopped for three days.',
].join('\n');

const unique = locatePassage(CHAPTER, 'Marta counted the tiles again.');
check('1. a passage that appears once is located exactly',
  unique.found === true && unique.count === 1 && unique.exact === true &&
  CHAPTER.slice(unique.start, unique.end) === 'Marta counted the tiles again.');

const dupe = locatePassage(CHAPTER, 'The rain had not stopped for three days.');
check('1b. a passage that appears twice is REFUSED, not silently first-matched',
  dupe.found === false && dupe.count === 2 && /ambiguous/.test(dupe.reason));

const gone = locatePassage(CHAPTER, 'A sentence that was edited away since the scan.');
check('1c. a stale passage is refused with an explanation, not a crash',
  gone.found === false && gone.count === 0 && /no longer appears/.test(gone.reason));

const wrapped = locatePassage(
  'He paused.\nThen he\n   spoke   at last.\nShe did not.',
  'Then he spoke at last.'
);
check('1d. whitespace differences from normalization still match (and report inexact)',
  wrapped.found === true && wrapped.count === 1 && wrapped.exact === false);

const regexy = locatePassage('Ask (again). Then leave.', 'Ask (again).');
check('1e. regex metacharacters in prose are escaped, not interpreted',
  regexy.found === true && regexy.count === 1);

check('1f. empty inputs refuse rather than matching everything',
  locatePassage(CHAPTER, '').found === false &&
  locatePassage('', 'anything').found === false &&
  locatePassage(CHAPTER, '   ').found === false);

check('1g. the flexible matcher is anchored to the passage, not a catch-all',
  flexibleMatcher('a b').source === 'a\\s+b');

// A found range must be substitutable without corrupting the surrounding text.
const applied = CHAPTER.slice(0, unique.start) + 'Marta lost count.' + CHAPTER.slice(unique.end);
check('1h. the returned offsets splice cleanly',
  applied.includes('Marta lost count. She felt a sense of dread.') &&
  !applied.includes('Marta counted the tiles again.'));

// ── WAVE8-SNAPSHOT ───────────────────────────────────────────────────────────
const backup = read('src/lib/chapterBackup.js');
check('2. the shared snapshot module exports the full guarded surface',
  ['snapshotChapter', 'restoreChapterSnapshot', 'applyPassageToChapter', 'replaceChapterContent']
    .every((f) => new RegExp(`export async function ${f}`).test(backup)));
check('2b. a failed snapshot aborts the write instead of proceeding',
  (backup.match(/if \(!snap\.ok\) return \{ ok: false, reason: `snapshot failed, nothing was changed/g) || []).length >= 2);
check('2c. a truncated (preview-only) backup is refused — a partial undo is not an undo',
  /backup_preview_only/.test(backup) && /refusing to overwrite without a full snapshot/.test(backup));
check('2d. writes go through the verifying save, not a bare Chapter.update',
  /verifiedChapterSave\(/.test(backup) && (backup.match(/verifiedChapterSave\(\{/g) || []).length >= 2);
check('2e. restoring consumes the slot so a stale snapshot cannot be re-applied',
  /backup_content: '',\n      backup_content_url: '',/.test(backup));
check('2f. the ambiguity guard is the one that was exercised above',
  /from '@\/lib\/passageLocator/.test(backup) && !/function locatePassage/.test(backup));

// ── WAVE8-APPLY ──────────────────────────────────────────────────────────────
const pf = read('src/components/tools/ProofreadSubPage.jsx');
check('3. the scan carries chapter identity instead of discarding it',
  /chapterId: ch\.id,/.test(pf) && /chapterNumber: ch\.chapter_number,/.test(pf));
check('3b. every heatmap row is stamped, so a finding knows its chapter',
  /chapterTitle: chapter\.title,\n      chapterId: chapter\.chapterId,/.test(pf));
check('3c. the chapter risk table carries ids too (for the editor route)',
  /chapterId: c\.chapterId, chapterNumber: c\.chapterNumber/.test(pf));
check('4. the humanize panel can write the rewrite back to the chapter',
  /applyPassageToChapter\(\{/.test(pf) && /Apply to Chapter/.test(pf));
check('4b. apply is gated on there being a real saved chapter to write to',
  /const canApply = source === 'project' && !!targetChapter;/.test(pf));
check('4c. an upload-sourced finding explains why it can only be copied',
  /read-only here/.test(pf));
check('4d. a stale rewrite cannot be applied to a different passage',
  /React\.useEffect\(\(\) => \{ setRewrite\(''\); \}, \[selected\?\.chapterId, selected\?\.index, selected\?\.text\]\);/.test(pf));
check('4e. the user is told the write is undoable, and how',
  /Restore Original/.test(pf));

// ── WAVE8-FIXEDITOR ──────────────────────────────────────────────────────────
check('5. FixPassagesEditor finally has an importer',
  /import FixPassagesEditor from '@\/components\/tools\/FixPassagesEditor'/.test(pf) &&
  /<FixPassagesEditor/.test(pf));
check('5b. it is reachable from the UI, not merely imported',
  /openChapterEditor\(record\)/.test(pf) && /Fix Passages/.test(pf));
check('5c. it is opened with resolved content, so offloaded chapters are not blank',
  /const content = await resolveChapterContent\(chapterRecord\);/.test(pf));
check('5d. its save goes through the snapshot path',
  /replaceChapterContent\(\{/.test(pf));

const fpe = read('src/components/tools/FixPassagesEditor.jsx');
check('6. an empty model response is reported instead of silently doing nothing',
  /returned an empty rewrite/.test(fpe));
check('6b. a thrown rewrite surfaces to the user, not just the console',
  /toast\.error\('Rewrite failed: '/.test(fpe));
check('6c. leaving with unsaved edits asks first',
  /const dirty = text !== \(chapter\.content \|\| ''\);/.test(fpe) &&
  /Discard them\?/.test(fpe) && /onClick=\{handleBack\}/.test(fpe));
check('6d. the rewrite call is routed like every other prose call',
  /task_type: 'proofread'/.test(fpe) && !/invokeLLMWithRetry\(\{ prompt \}\)/.test(fpe));

// ── WAVE8-REFRESH ────────────────────────────────────────────────────────────
check('7. onRefreshAll was a prop the page accepted and never used — now it fires',
  (pf.match(/onRefreshAll/g) || []).length >= 3 &&
  /onApplied=\{onRefreshAll\}/.test(pf) && /onRefreshAll\?\.\(\)/.test(pf));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
