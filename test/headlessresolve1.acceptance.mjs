// HEADLESS-1 acceptance battery — chapter resolution under headless Node.
//
// Handoff 2026-09-05 finding #2 + docs/phase1-notes.md §3: rewriteForLocalGitHubProxy
// (src/lib/chapterStorage.js) read window.location unguarded. `window` does not
// exist in a plain Node process, so EVERY resolveChapterContent /
// resolveBackupContent call for a chapter stored via content_md_url threw a
// ReferenceError ("window is not defined"), caught only upstream by
// getPreviousChapterEnding's try/catch (chapterCohesion.js) — silently dropping
// the previous-chapter tail from every headless draft prompt.
//
// This battery proves that under Node (no window) chapter resolution degrades
// gracefully to '' through the existing fallback chain instead of throwing,
// and that the browser localhost:5180 GitHub-raw rewrite stays intact behind
// the new guard. All fetches are stubbed: zero real network calls.
import fs from 'node:fs';
import { register } from 'node:module';
register('../tests/helpers/aliasLoader.mjs', import.meta.url);
const { resolveChapterContent, resolveBackupContent } = await import('../src/lib/chapterStorage.js');

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

check('0. running under Node without window (precondition for this regression)', typeof window === 'undefined');

// Zero real network calls: every fetch attempt (local proxy, Base44 backend
// proxy, localDB serverFetch) rejects with a marker error that the module's
// own catch blocks are required to swallow.
let fetchCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = () => { fetchCalls += 1; return Promise.reject(new Error('headlessresolve1: network disabled')); };

const githubUrl = 'https://raw.githubusercontent.com/fixture-owner/fixture-repo/main/chapter-03.md';

try {
  let resolveError = null;
  let resolved = null;
  try {
    resolved = await resolveChapterContent({
      chapter_number: 3,
      title: 'Fixture Chapter',
      content_md_url: githubUrl,
    });
  } catch (e) { resolveError = e; }

  check('1. resolveChapterContent does not throw under Node for a content_md_url chapter (no more "window is not defined")',
    resolveError === null, resolveError ? `${resolveError.name}: ${resolveError.message}` : '');
  check('1b. it degrades to an empty string through the fallback chain instead of throwing',
    resolveError === null && resolved === '',
    resolveError ? String(resolveError) : `resolved: ${JSON.stringify(resolved)}`);

  let backupError = null;
  let backupResolved = null;
  try {
    backupResolved = await resolveBackupContent({
      chapter_number: 3,
      title: 'Fixture Chapter',
      backup_content_url: githubUrl,
    });
  } catch (e) { backupError = e; }

  check('2. resolveBackupContent (the second unguarded fetchTextNoCache call site) also degrades to "" without throwing',
    backupError === null && backupResolved === '',
    backupError ? `${backupError.name}: ${backupError.message}` : JSON.stringify(backupResolved));

  check('3. every fetch attempt hit the network-disabled stub (zero real network calls; the module swallowed each failure itself)',
    fetchCalls > 0, `fetchCalls=${fetchCalls}`);

  const STORAGE = fs.readFileSync(new URL('../src/lib/chapterStorage.js', import.meta.url).pathname, 'utf8');
  const rewriteFn = (() => {
    const start = STORAGE.indexOf('function rewriteForLocalGitHubProxy');
    const end = STORAGE.indexOf('\n}', start);
    return start >= 0 ? STORAGE.slice(start, end) : '';
  })();
  check('4. browser behavior preserved: the localhost:5180 GitHub-raw rewrite is intact, guarded only for the headless case',
    rewriteFn.includes("typeof window === 'undefined' || !window.location) return null;")
      && rewriteFn.includes("port === '5180'")
      && rewriteFn.includes("'/github-raw' + parsed.pathname"),
    rewriteFn);
} finally {
  globalThis.fetch = realFetch;
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
