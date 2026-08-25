// UNDO-1 + VERSIONS-1 + VERSIONS-1B acceptance battery — Arc F live-proof
// finding 33, plus the gap Cowork Claude found verifying it on REDUX.
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
// VERSIONS-1B: a chapter saved BEFORE VERSIONS-1 landed never got
// previous_content_md_url — REDUX Ch.4/10/12 have no such field even though
// every older version still exists in _FileStore. chapterHasPreviousVersion
// is now async and falls back to the store's own version history (a new
// read-only `versions` server action, key-prefix filtered, metadata only —
// _FileStore is ~110MB and `list` must never be used for this).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
register('../tests/helpers/aliasLoader.mjs', import.meta.url);
const { prepareChapterContent, chapterHasPreviousVersion, listChapterVersions, findImmediatelyOlderVersion } = await import('../src/lib/chapterStorage.js');

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

// ── chapterHasPreviousVersion (async — VERSIONS-1B) ──
{
  check('3. chapterHasPreviousVersion is true when previous_content_md_url is set',
    await chapterHasPreviousVersion({ previous_content_md_url: 'https://example.com/x.md' }) === true);
  check('4. chapterHasPreviousVersion is false when there is nothing to restore (no previous_content_md_url, no content_md_url to check history against)',
    await chapterHasPreviousVersion({}) === false && await chapterHasPreviousVersion({ previous_content_md_url: '' }) === false);
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
  check('8. OutlineEditor renders a "Restore Previous Version" action gated on the (now async-computed) hasPreviousVersion prop',
    EDITOR.includes('onRestorePreviousVersion && hasPreviousVersion') && EDITOR.includes('Restore Previous Version'));

  const STUDIO = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url).pathname, 'utf8');
  const handlerBody = (() => {
    const start = STUDIO.indexOf('const handleRestorePreviousVersion');
    const end = STUDIO.indexOf('\n  };', start);
    return start >= 0 ? STUDIO.slice(start, end) : '';
  })();
  check('9. handleRestorePreviousVersion goes through saveChapter.mutateAsync (the same mutation handleSaveChapter uses), not a raw Chapter.update bypass',
    handlerBody.includes('saveChapter.mutateAsync(') && handlerBody.includes('content_md_url: targetUrl'));
  check('10. the restore payload clears the inline field, and the target falls back to findImmediatelyOlderVersion when previous_content_md_url is absent',
    /content_md:\s*''/.test(handlerBody) &&
    /chapter\?\.previous_content_md_url \|\| await findImmediatelyOlderVersion\(chapter\)/.test(handlerBody));
}

// ── VERSIONS-1B: the server-side `versions` action + chapterStorage fallback,
// exercised against a real (ephemeral, temp-dir) instance of the store server ──
{
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ubs-versions1b-'));
  process.env.UBS_DATA_DIR = TMP;
  const { handleRequest } = await import('../vite-server-store-plugin.js');

  const TEST_UID = 'test-uid-versions1b';
  let server;
  await new Promise((resolve) => {
    server = http.createServer((req, res) => handleRequest(req, res, TEST_UID));
    server.listen(0, '127.0.0.1', resolve);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // listFileVersions/serverFetch calls the global fetch with a relative
  // "/api/store/..." URL (as it does in the real browser app) — redirect
  // those to this ephemeral server; also record any call to `list`, which
  // this feature must never make (110MB of content in one response).
  const realFetch = globalThis.fetch;
  const listCalls = [];
  globalThis.fetch = (url, opts) => {
    const u = String(url);
    if (u.includes('/_FileStore/list')) listCalls.push(u);
    if (u.startsWith('/api/store/')) return realFetch(`${baseUrl}${u}`, opts);
    return realFetch(url, opts);
  };

  try {
    const create = (id, content) => realFetch(`${baseUrl}/api/store/_FileStore/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, content }),
    });
    // Three versions of Ch.1, oldest to newest, plus a different chapter's
    // version that must never leak into Ch.1's history.
    await create('proj1/ch1/chapter-ch1-20260101000000-aaa', 'v1 short');
    await create('proj1/ch1/chapter-ch1-20260102000000-bbb', 'v2 a little longer than v1');
    await create('proj1/ch1/chapter-ch1-20260103000000-ccc', 'v3 the current version content');
    await create('proj1/ch2/chapter-ch2-20260101000000-ddd', 'a different chapter entirely, must be excluded');

    const current = { id: 'ch1', project_id: 'proj1', content_md_url: 'local://proj1/ch1/chapter-ch1-20260103000000-ccc' };
    const history = await listChapterVersions(current);
    check('11. history is sorted chronologically (ascending by id) and excludes the other chapter',
      history.length === 3 && history[0].id.endsWith('-aaa') && history[1].id.endsWith('-bbb') && history[2].id.endsWith('-ccc'),
      JSON.stringify(history));
    check('12. history entries are metadata only — id, created_date, bytes — never content',
      history.every((v) => Object.keys(v).sort().join(',') === 'bytes,created_date,id'), JSON.stringify(history));

    const older = await findImmediatelyOlderVersion(current);
    check('13. the fallback picks the version IMMEDIATELY before current (bbb), not the oldest one (aaa)',
      older === 'local://proj1/ch1/chapter-ch1-20260102000000-bbb', older);

    const oldest = { id: 'ch1', project_id: 'proj1', content_md_url: 'local://proj1/ch1/chapter-ch1-20260101000000-aaa' };
    check('14. the current version is excluded from counting as "older than itself" — the oldest version has no fallback',
      await findImmediatelyOlderVersion(oldest) === '');
    check('14b. chapterHasPreviousVersion agrees: true for a chapter with older history, false for the oldest version',
      (await chapterHasPreviousVersion(current)) === true && (await chapterHasPreviousVersion(oldest)) === false);

    check('15. this feature never calls the `list` action (only the lightweight, prefix-filtered `versions` action)',
      listCalls.length === 0, JSON.stringify(listCalls));
  } finally {
    globalThis.fetch = realFetch;
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
}

// ── source-shape: the server action itself never sends `content`, and the
// client-side helpers never call `list` for this feature ──
{
  const PLUGIN = fs.readFileSync(new URL('../vite-server-store-plugin.js', import.meta.url).pathname, 'utf8');
  const versionsCaseStart = PLUGIN.indexOf("case 'versions':");
  const versionsCaseEnd = PLUGIN.indexOf('\n        }', versionsCaseStart);
  const versionsCaseBody = versionsCaseStart >= 0 ? PLUGIN.slice(versionsCaseStart, versionsCaseEnd) : '';
  check('16. the versions action maps each record to {id, created_date, bytes} — it never forwards r.content itself',
    versionsCaseBody.includes('id: r.id') && versionsCaseBody.includes('created_date: r.created_date') && versionsCaseBody.includes('bytes:') && !/content:\s*r\.content(?!\s*===)/.test(versionsCaseBody.replace(/typeof r\.content === 'string'/, '')));

  const STORAGE = fs.readFileSync(new URL('../src/lib/chapterStorage.js', import.meta.url).pathname, 'utf8');
  check('17. chapterStorage.js never calls the entity .list( form for this feature', !STORAGE.includes('.list('));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
