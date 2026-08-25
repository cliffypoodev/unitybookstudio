// UNDO-1 + VERSIONS-1 acceptance battery — Arc F live-proof finding 33.
//
// ProjectStudio.jsx already captured an undo snapshot before every
// destructive run (captureSnapshot('Manuscript Polish')) and had a working
// handleUndo (restores project + every chapter through Chapter.update, the
// real save path) — but never rendered <UndoButton>, so the snapshot was
// unreachable and lost on reload. Separately, no chapter save ever recorded
// what it was about to overwrite, so there was no way to get back a
// specific chapter's previous content short of the in-memory undo snapshot.
//
// UNDO-1: NotebookShell (the single-consumer shared page shell) gets a
// `headerActions` slot, rendered in its persistent desktop header — visible
// from every tab, not just the one a run happened to leave the user on —
// and ProjectStudio passes <UndoButton> into it.
// VERSIONS-1: prepareChapterContent (the one place ALL chapter content
// saves build their payload) now records previous_content_md_url — what
// content_md_url pointed at before this save — and a "Restore Previous
// Version" action on the chapter card does Chapter.update through the real
// save path (saveChapter.mutateAsync), the same mutation handleSaveChapter
// itself uses.
import fs from 'node:fs';
import { register } from 'node:module';
register('../tests/helpers/aliasLoader.mjs', import.meta.url);
const { prepareChapterContent, chapterHasPreviousVersion } = await import('../src/lib/chapterStorage.js');

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── VERSIONS-1: prepareChapterContent records previous_content_md_url ──
{
  const existing = { id: 'ch1', content_md_url: 'https://example.com/old-blob.md' };
  const fields = await prepareChapterContent('Short new content for the chapter, well under the inline size limit.', 'proj1', 'ch1', existing);
  check('1. prepareChapterContent records the previous content_md_url on a normal save',
    fields.previous_content_md_url === 'https://example.com/old-blob.md', JSON.stringify(fields));

  const noExisting = await prepareChapterContent('Brand-new chapter content, nothing existed before this.', 'proj1', 'ch2', null);
  check('2. a brand-new chapter (no existing record) gets an empty previous_content_md_url, not undefined',
    noExisting.previous_content_md_url === '', JSON.stringify(noExisting));
}

// ── chapterHasPreviousVersion ──
{
  check('3. chapterHasPreviousVersion is true when previous_content_md_url is set',
    chapterHasPreviousVersion({ previous_content_md_url: 'https://example.com/x.md' }) === true);
  check('4. chapterHasPreviousVersion is false when there is nothing to restore',
    chapterHasPreviousVersion({}) === false && chapterHasPreviousVersion({ previous_content_md_url: '' }) === false);
}

// ── UNDO-1: NotebookShell renders a headerActions slot; ProjectStudio wires UndoButton into it ──
{
  const SHELL = fs.readFileSync(new URL('../src/components/notebook/NotebookShell.jsx', import.meta.url).pathname, 'utf8');
  check('5. NotebookShell accepts a headerActions prop', /function NotebookShell\(\{[^}]*headerActions[^}]*\}\)/.test(SHELL));
  check('6. the desktop header actually renders it (not just destructured and dropped)', /\{headerActions\}/.test(SHELL));

  const STUDIO = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url).pathname, 'utf8');
  check('7. ProjectStudio passes UndoButton into NotebookShell\'s headerActions',
    /headerActions=\{<UndoButton snapshot=\{undoSnapshot\} onUndo=\{handleUndo\} isUndoing=\{isUndoing\} \/>\}/.test(STUDIO));
}

// ── VERSIONS-1: the chapter card's restore action goes through the real save path ──
{
  const EDITOR = fs.readFileSync(new URL('../src/components/novel/OutlineEditor.jsx', import.meta.url).pathname, 'utf8');
  check('8. OutlineEditor renders a "Restore Previous Version" action gated on chapterHasPreviousVersion',
    EDITOR.includes('onRestorePreviousVersion && chapterHasPreviousVersion(chapter)') && EDITOR.includes('Restore Previous Version'));

  const STUDIO = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url).pathname, 'utf8');
  check('9. handleRestorePreviousVersion goes through saveChapter.mutateAsync (the same mutation handleSaveChapter uses), not a raw Chapter.update bypass',
    (() => {
      const start = STUDIO.indexOf('const handleRestorePreviousVersion');
      const end = STUDIO.indexOf('\n  };', start);
      const body = start >= 0 ? STUDIO.slice(start, end) : '';
      return body.includes('saveChapter.mutateAsync(') && body.includes('content_md_url: chapter.previous_content_md_url');
    })());
  check('10. the restore payload sets content_md_url to the recorded previous version and clears the inline field',
    (() => {
      const start = STUDIO.indexOf('const handleRestorePreviousVersion');
      const end = STUDIO.indexOf('\n  };', start);
      const body = start >= 0 ? STUDIO.slice(start, end) : '';
      return /content_md:\s*''/.test(body) && /content_md_url:\s*chapter\.previous_content_md_url/.test(body);
    })());
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
