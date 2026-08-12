// RESEARCHKEY-1 acceptance battery — inline research beats the stale URL.
//
// The defect: research blobs are filed under ONE constant key per project, the
// server store's create() pushes duplicate ids, and get() returns the FIRST
// (oldest) match — so resolveResearchContent's URL-first order handed the
// writer's prompt lane a months-stale brief while the record's inline
// research_md held the current one (measured live on the flagship 2026-08-08:
// URL resolved 10,232 chars of June content; inline held 73,137 current chars).
// Fixtures are generic; no book-specific strings.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'src/lib/researchStorage.js'), 'utf8');

let failures = 0;
const check = (name, pass) => {
  console.log((pass ? 'PASS ' : 'FAIL ') + name);
  if (!pass) failures += 1;
};

const mkCtx = (fileText) => {
  const calls = { retrieveFile: 0 };
  const ctx = {
    console: { log: () => {}, warn: () => {} },
    String, Number, Object, Array, Math, Date, JSON, Error, Promise, RegExp, setTimeout,
    retrieveFile: async (url) => { calls.retrieveFile += 1; return url && String(url).startsWith('local://') ? fileText : null; },
    base44: { functions: { invoke: async () => ({ data: {} }) } },
  };
  vm.createContext(ctx);
  const body = SRC.split('\n').filter((l) => !l.startsWith('import ')).join('\n');
  vm.runInContext(body.replace(/^export /gm, '') + '\nthis.resolveResearchContent = resolveResearchContent;\nthis.ensureResearchEvidence = ensureResearchEvidence;', ctx);
  return { ctx, calls };
};

const FULL_INLINE = 'The committee recorded each session in the county ledger through the spring and summer terms. '.repeat(8); // ~750 chars
const URL_TEXT = 'Older archived brief text that predates the current inline research by several saves entirely. '.repeat(4);

// 1 — full inline wins; the URL is never even fetched
{
  const { ctx, calls } = mkCtx(URL_TEXT);
  const got = await ctx.resolveResearchContent({ research_md: FULL_INLINE, research_md_url: 'local://p/research/research-p' });
  check('1. full inline research is returned over a live URL', got === FULL_INLINE);
  check('1. the URL is never fetched when inline is the real brief', calls.retrieveFile === 0);
}

// 2 — empty inline: URL fallback intact for legacy records
{
  const { ctx } = mkCtx(URL_TEXT);
  const got = await ctx.resolveResearchContent({ research_md: '', research_md_url: 'local://p/research/research-p' });
  check('2. empty inline still resolves the URL (legacy fallback intact)', got === URL_TEXT);
}

// 3 — the historical truncation stub defers to the URL
{
  const { ctx } = mkCtx(URL_TEXT);
  const stub = 'First five hundred characters of the brief...\n\n[Full research stored externally]';
  const got = await ctx.resolveResearchContent({ research_md: stub, research_md_url: 'local://p/research/research-p' });
  check('3. truncation-stub inline defers to the URL', got === URL_TEXT);
}

// 4 — suspiciously short inline (<600, no marker) defers to the URL
{
  const { ctx } = mkCtx(URL_TEXT);
  const got = await ctx.resolveResearchContent({ research_md: 'short note', research_md_url: 'local://p/research/research-p' });
  check('4. suspiciously short inline defers to the URL', got === URL_TEXT);
}

// 5 — stub inline + dead URL still falls back to the stub (better than nothing)
{
  const { ctx } = mkCtx(null);
  const got = await ctx.resolveResearchContent({ research_md: 'short note', research_md_url: 'local://p/dead' });
  check('5. dead URL falls back to whatever inline exists', got === 'short note');
}

// 6 — ensureResearchEvidence unchanged: fires only when inline is EMPTY
{
  const { ctx, calls } = mkCtx(URL_TEXT);
  const same = await ctx.ensureResearchEvidence({ research_md: FULL_INLINE, research_md_url: 'local://p/x' });
  check('6. ensureResearchEvidence leaves inline-present records untouched', same.research_md === FULL_INLINE && calls.retrieveFile === 0);
}

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
