// STOREDEDUPE-1 acceptance — an unchanged foundation field must not be re-uploaded,
// and blobs must be filed under a project id, never a title.
//
// MEASURED on the live file store, 2026-08-04:
//
//   entries                      3,770
//   total content               80.9 MB
//   unique content              24.1 MB
//   byte-identical duplicates   56.8 MB  (70%)
//   one 38 KB research_md blob stored 324 times = 12.0 MB
//   1,308 of 3,770 entries (35%) filed under the literal string "foundation-project"
//
// prepareFoundationPayload uploaded a NEW timestamped blob every time a payload
// carried an oversized field, changed or not; and getPayloadProjectId fell back to a
// slug of the TITLE, then to the literal 'foundation-project'. The same 13,841-char
// characters document was written twice 75 seconds apart under two namespaces
// because two call sites disagreed about whether a title was present.
//
// foundationStorage.js imports the Base44 client, which node cannot resolve, so the
// real source is extracted by anchor and run in a vm with the client stubbed. No
// logic is re-implemented here.
import fs from 'fs';
import vm from 'vm';

const SRC = fs.readFileSync(new URL('../src/lib/foundationStorage.js', import.meta.url), 'utf8');
const from = (a) => { const i = SRC.indexOf(a); if (i < 0) throw new Error(`anchor not found: ${a}`); return i; };
const body = SRC.slice(from('const FOUNDATION_STORAGE_VERSION'), from('export async function resolveFoundationField'));
// Comments explain the defect and therefore quote it. Source assertions must look at
// CODE, or a battery fails on its own documentation — which this one did, first run.
const CODE = SRC.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const mk = () => {
  const uploads = [];
  const logs = [];
  const ctx = {
    console: { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push('WARN ' + a.join(' ')) },
    String, Number, Object, Array, Math, Date, JSON, Error, Promise, RegExp, setTimeout,
    base44: {
      functions: {
        invoke: async (fn, payload) => {
          uploads.push({ fn, projectId: payload.projectId, filename: payload.filename, bytes: String(payload.content || '').length });
          return { data: { file_url: `local://${payload.projectId}/${payload.chapterId}/${payload.filename}`, path: 'p', sha: 's', filename: payload.filename } };
        },
      },
    },
    fetch: async () => ({ ok: false, status: 500 }),
  };
  vm.createContext(ctx);
  vm.runInContext(
    body.replace(/^export /gm, '')
    + '\nthis.prepareFoundationPayload = prepareFoundationPayload;'
    + '\nthis.foundationContentHash = foundationContentHash;'
    + '\nthis.getPayloadProjectId = getPayloadProjectId;',
    ctx,
  );
  return { ...ctx, uploads, logs };
};

const BIG = (seed) => (seed + ' ').repeat(3000); // well over the 9000-char inline ceiling

// ── the fingerprint ──
{
  const h = mk();
  const a = h.foundationContentHash('hello world');
  check('the hash is deterministic', a === h.foundationContentHash('hello world'));
  check('different content hashes differently', a !== h.foundationContentHash('hello worlds'));
  check('a one-character change is detected', h.foundationContentHash('abc') !== h.foundationContentHash('abd'));
  check('a transposition is detected — position is mixed in',
    h.foundationContentHash('ab') !== h.foundationContentHash('ba'));
  check('the exact length is part of the fingerprint', /^len11-fnv[0-9a-f]{16}$/.test(a), a);
  check('empty and null agree and do not throw',
    h.foundationContentHash('') === h.foundationContentHash(null));
  check('Web Crypto is deliberately not used — it is undefined over http on a LAN',
    !/crypto\.subtle/.test(CODE));
}

// ── the defect: an unchanged field must not be re-uploaded ──
{
  const h = mk();
  const text = BIG('world');
  const first = await h.prepareFoundationPayload({ id: 'proj-1', world_md: text });
  check('an oversized field is uploaded the first time', h.uploads.length === 1);
  check('the inline field is cleared and a url recorded',
    first.world_md === '' && String(first.world_md_url).startsWith('local://proj-1/'));
  check('a fingerprint is recorded alongside the url', /^len\d+-fnv/.test(first.world_md_storage_hash || ''));

  const second = await h.prepareFoundationPayload({ ...first, id: 'proj-1', world_md: text });
  check('saving the SAME content again uploads nothing', h.uploads.length === 1, JSON.stringify(h.uploads.map((u) => u.bytes)));
  check('the existing blob url is preserved', second.world_md_url === first.world_md_url);
  check('the skip is announced', h.logs.some((l) => /STOREDEDUPE-1.*unchanged/.test(l)), JSON.stringify(h.logs));
  check('char and word counts still reported on the skip path',
    second.world_md_char_count === first.world_md_char_count && second.world_md_word_count > 0);

  const changed = await h.prepareFoundationPayload({ ...second, id: 'proj-1', world_md: BIG('worldx') });
  check('CHANGED content does upload', h.uploads.length === 2);
  check('a changed field gets a new url and a new fingerprint',
    changed.world_md_url !== first.world_md_url && changed.world_md_storage_hash !== first.world_md_storage_hash);
}

// ── a fingerprint without a url, or a url without a fingerprint, must not skip ──
{
  const h = mk();
  const text = BIG('canon');
  await h.prepareFoundationPayload({ id: 'p', canon_md: text, canon_md_storage_hash: h.foundationContentHash(text) });
  check('a fingerprint with no stored url still uploads', h.uploads.length === 1);
  const h2 = mk();
  await h2.prepareFoundationPayload({ id: 'p', canon_md: text, canon_md_url: 'local://p/canon_md/old' });
  check('a stored url with no fingerprint still uploads (legacy blobs)', h2.uploads.length === 1);
}

// ── namespacing: a project id, never a title ──
{
  const h = mk();
  check('an explicit id is used', h.getPayloadProjectId({ id: 'msf2vp7b-7rlbqchk' }) === 'msf2vp7b-7rlbqchk');
  check('project_id is accepted', h.getPayloadProjectId({ project_id: 'abc-123' }) === 'abc-123');
  check('a TITLE is never used as a namespace',
    h.getPayloadProjectId({ title: 'The Gilded Hour' }) === 'unknown-project');
  check('the literal placeholder namespace is gone from the source',
    !/'foundation-project'/.test(CODE), 'the placeholder is still used in code');
  check('a missing id is announced rather than silently invented',
    h.logs.some((l) => /WARN.*STOREDEDUPE-1.*no project id/.test(l)), JSON.stringify(h.logs));
}
{
  const h = mk();
  await h.prepareFoundationPayload({ id: 'proj-9', outline_md: BIG('outline') });
  check('the upload is filed under the project id', h.uploads[0].projectId === 'proj-9', JSON.stringify(h.uploads[0]));
  const h2 = mk();
  await h2.prepareFoundationPayload({ title: 'The Gilded Hour', outline_md: BIG('outline') });
  check('a title-only payload is filed under unknown-project, not a title slug',
    h2.uploads[0].projectId === 'unknown-project', JSON.stringify(h2.uploads[0]));
}

// ── nothing else about the payload path changed ──
{
  const h = mk();
  const small = await h.prepareFoundationPayload({ id: 'p', voice_md: 'short enough to stay inline' });
  check('a small field stays inline and is never uploaded',
    small.voice_md === 'short enough to stay inline' && h.uploads.length === 0);
  const none = await h.prepareFoundationPayload({ id: 'p', world_md_url: 'local://p/world_md/keep' });
  check('an existing url is not erased when no inline value is supplied',
    none.world_md_url === 'local://p/world_md/keep');
}

// ── the measured duplication cannot recur: N identical saves = 1 blob ──
{
  const h = mk();
  const text = BIG('research');
  let payload = { id: 'p', research_md: text };
  for (let i = 0; i < 20; i += 1) payload = { ...(await h.prepareFoundationPayload(payload)), id: 'p', research_md: text };
  check('twenty identical saves produce exactly ONE blob', h.uploads.length === 1, `uploads=${h.uploads.length}`);
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
