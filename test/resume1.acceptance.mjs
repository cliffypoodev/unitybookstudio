// RESUME-1 acceptance — an interrupted story bible must not start over.
//
// MEASURED on The Gilded Hour, 2026-08-04. A page reload at 3:25:34 — with NO file
// change behind it, so simply a dropped HMR socket over the LAN — discarded four
// minutes of completed work and restarted at world (1/6). generateBibleParallel
// had no resume path at all: it always began at buildWorldPrompt.
//
// A six-field sequential run is ~20 minutes on a local 32B. On any link that can
// drop, or any laptop that can sleep, the run is racing the network and loses
// everything each time it loses. That is why the WATCHLOOP-1 reload loop was fatal
// rather than merely annoying, and why fixing the loop alone was not enough.
//
// The helper is a closure, so it is extracted from the REAL source by anchor and
// run in a vm with its dependencies supplied. No logic is re-implemented here.
import fs from 'fs';
import vm from 'vm';
import { BIBLE_FIELD_FLOORS, fieldLengthOk } from '../src/lib/bibleFieldGuard.js';

const SRC = fs.readFileSync(new URL('../src/lib/parallelBibleGenerator.js', import.meta.url), 'utf8');
const slice = (a, b) => {
  const i = SRC.indexOf(a); const j = SRC.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error(`anchor not found: ${i < 0 ? a : b}`);
  return SRC.slice(i, j);
};

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

// Build the helper with instrumented dependencies so we can see exactly which
// fields hit the model and which were carried.
const mkHarness = (resumeFrom) => {
  const calls = [];
  const progress = [];
  const logs = [];
  const ctx = {
    console: { log: (...a) => logs.push(a.join(' ')), warn: () => {} },
    String, Number, Object, Array,
    resumeFrom,
    fieldLengthOk,
    onProgress: (l) => progress.push(l),
    singleFieldSchema: (f) => ({ f }),
    callLLM: async (prompt, schema) => { calls.push(schema.f); return { [schema.f]: `FRESH ${'x'.repeat(4000)}` }; },
  };
  vm.createContext(ctx);
  vm.runInContext(
    slice('  const resumedFields = [];', '  // ── BATCH 1:')
    + '\nthis.generateField = generateField; this.resumedFields = resumedFields;',
    ctx,
  );
  return { ...ctx, calls, progress, logs };
};

const long = (n = 4000) => 'y'.repeat(n);

// ── the defect: a carried field must not be regenerated ──
{
  const h = mkHarness({ world_md: long(), characters_md: long() });
  const w = await h.generateField('world_md', 'world (1/6)', () => 'PROMPT');
  const c = await h.generateField('characters_md', 'people (2/6)', () => 'PROMPT');
  const v = await h.generateField('voice_md', 'voice (3/6)', () => 'PROMPT');
  check('a saved field is reused instead of regenerated', w === h.resumeFrom.world_md && c === h.resumeFrom.characters_md);
  check('only the missing field hits the model',
    JSON.stringify(h.calls) === JSON.stringify(['voice_md']), JSON.stringify(h.calls));
  check('the missing field is generated fresh', /^FRESH/.test(v));
  check('resumed fields are recorded',
    JSON.stringify(h.resumedFields) === JSON.stringify(['world_md', 'characters_md']));
  check('each reuse is announced in the console',
    h.logs.filter((l) => /RESUME-1/.test(l)).length === 2, JSON.stringify(h.logs));
  check('the user is told work is being reused, not that it is generating',
    h.progress.some((p) => /reusing saved work/.test(p)) && h.progress.some((p) => /^Bible: voice \(3\/6\)…$/.test(p)),
    JSON.stringify(h.progress));
}

// ── with nothing to resume, behaviour is exactly what it was ──
{
  const h = mkHarness({});
  for (const [f, step] of [['world_md', 'world (1/6)'], ['characters_md', 'people (2/6)'], ['voice_md', 'voice (3/6)']]) {
    await h.generateField(f, step, () => 'PROMPT');
  }
  check('an empty resumeFrom generates every field, as before',
    JSON.stringify(h.calls) === JSON.stringify(['world_md', 'characters_md', 'voice_md']));
  check('nothing is announced when nothing is resumed', h.logs.length === 0);
}
{
  const h = mkHarness(undefined);
  await h.generateField('world_md', 'world (1/6)', () => 'PROMPT');
  check('an undefined resumeFrom does not throw', h.calls.length === 1);
}

// ── resume can never smuggle in a field the field guard would reject ──
{
  const floor = BIBLE_FIELD_FLOORS.world_md;
  check('the world floor is a real number', Number.isFinite(floor) && floor > 0);
  const h = mkHarness({ world_md: 'too short' });
  const w = await h.generateField('world_md', 'world (1/6)', () => 'PROMPT');
  check('a saved field BELOW its length floor is regenerated, not carried',
    JSON.stringify(h.calls) === JSON.stringify(['world_md']) && /^FRESH/.test(w));
  const h2 = mkHarness({ world_md: '' });
  await h2.generateField('world_md', 'world (1/6)', () => 'PROMPT');
  check('an empty saved field is regenerated', h2.calls.length === 1);
  const h3 = mkHarness({ world_md: '   \n  ' });
  await h3.generateField('world_md', 'world (1/6)', () => 'PROMPT');
  check('a whitespace-only saved field is regenerated', h3.calls.length === 1);
  const h4 = mkHarness({ world_md: null });
  await h4.generateField('world_md', 'world (1/6)', () => 'PROMPT');
  check('a null saved field is regenerated', h4.calls.length === 1);
}

// ── the field lists are honest about what actually resumes ──
const mod = await import('../src/lib/parallelBibleGenerator.js').catch(() => null);
check('the source exports both field lists',
  /export const BIBLE_FIELDS = Object\.freeze/.test(SRC) && /export const BIBLE_RESUMABLE_FIELDS = Object\.freeze/.test(SRC));
check('the outline is NOT claimed as resumable — it carries the chapters array',
  /BIBLE_FIELDS\.slice\(0, 5\)/.test(SRC) && !/'outline_md',\s*\]\);\s*$/m.test(SRC.split('BIBLE_RESUMABLE_FIELDS')[1] || ''));
check('all five resumable fields go through the resume helper',
  ['world_md', 'characters_md', 'voice_md', 'canon_md', 'mystery_md']
    .every((f) => new RegExp(`generateField\\('${f}'`).test(SRC)));
check('no bible field bypasses the helper with a direct model call',
  !/await callLLM\(build(World|Characters|Voice|Canon|Mystery)Prompt/.test(SRC));
check('resumeFrom defaults to empty, so callers opt in',
  /resumeFrom = \{\}/.test(SRC));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
