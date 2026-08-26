// RERESEARCH-CONFIRM-1 acceptance battery — a confirm that names the size.
//
// handleResearch (ProjectStudio.jsx) is bound to BOTH the first-run
// "Research This Topic" button and the "Re-Research" button, and always
// REPLACES research_data/research_md (executeResearchPipeline's
// appendToExisting is false). Below RERESEARCH_CONFIRM_MIN_CHARS there's
// nothing worth losing, so the gate is silent; at/above it, a
// window.confirm names the exact size and, if confirmed, the current
// research is snapshotted into _FileStore (through the same storeFile()
// primitive every other save path uses) before the pipeline can overwrite
// it.
//
// researchStorage.js imports the Base44 client and localDB's storeFile,
// which Node cannot resolve and which must never make a real network call
// in a battery — the real source is extracted by anchor and run in a vm
// with both stubbed. No logic is re-implemented here.
import fs from 'fs';
import vm from 'vm';

const SRC = fs.readFileSync(new URL('../src/lib/researchStorage.js', import.meta.url), 'utf8');
const from = (a) => { const i = SRC.indexOf(a); if (i < 0) throw new Error(`anchor not found: ${a}`); return i; };
const body = SRC.slice(from('const MAX_INLINE_SIZE'));

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const mk = () => {
  const logs = [];
  const storeFileCalls = [];
  const ctx = {
    console: { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push('WARN ' + a.join(' ')), error: (...a) => logs.push('ERROR ' + a.join(' ')) },
    String, Number, Object, Array, Math, Date, JSON, Error, Promise, RegExp, setTimeout,
    base44: { functions: { invoke: async () => ({ data: {} }) } },
    retrieveFile: async () => '',
    storeFile: async (key, content) => { storeFileCalls.push({ key, content }); return `local://${key}`; },
  };
  vm.createContext(ctx);
  vm.runInContext(
    body.replace(/^export /gm, '')
    + '\nthis.RERESEARCH_CONFIRM_MIN_CHARS = RERESEARCH_CONFIRM_MIN_CHARS;'
    + '\nthis.describeResearchSize = describeResearchSize;'
    + '\nthis.buildReResearchConfirmMessage = buildReResearchConfirmMessage;'
    + '\nthis.shouldRunReResearch = shouldRunReResearch;'
    + '\nthis.snapshotResearchBeforeReResearch = snapshotResearchBeforeReResearch;',
    ctx,
  );
  return { ...ctx, logs, storeFileCalls };
};

// ── constant ──
{
  const h = mk();
  check('0. RERESEARCH_CONFIRM_MIN_CHARS is exported as 2000', h.RERESEARCH_CONFIRM_MIN_CHARS === 2000, String(h.RERESEARCH_CONFIRM_MIN_CHARS));
}

// ── (a) describeResearchSize: below threshold, no confirm needed ──
{
  const h = mk();
  const info = h.describeResearchSize({ research_md: 'short note' });
  check('1. below threshold: needsConfirm is false', info.needsConfirm === false, JSON.stringify(info));
  check('1b. below threshold: chars/timeline/events are correct', info.chars === 10 && info.timeline === 0 && info.events === 0, JSON.stringify(info));

  const empty = h.describeResearchSize({});
  const nully = h.describeResearchSize(null);
  check('1c. an empty project does not throw and needs no confirm', empty.needsConfirm === false);
  check('1d. a null/undefined project does not throw', nully.needsConfirm === false);
}

// ── (b) at/above threshold: needsConfirm true, message carries the exact numbers ──
{
  const h = mk();
  const project = {
    research_md: 'x'.repeat(2500),
    research_data: JSON.stringify({ timeline: Array(7).fill({}), key_events: Array(3).fill({}) }),
  };
  const info = h.describeResearchSize(project);
  check('2. at/above threshold: needsConfirm is true', info.needsConfirm === true, JSON.stringify(info));
  check('2b. chars/timeline/events are exact', info.chars === 2500 && info.timeline === 7 && info.events === 3, JSON.stringify(info));

  const msg = h.buildReResearchConfirmMessage(info);
  check('2c. confirm text names the exact numbers (strict equality)',
    msg === 'Re-run research? This project already holds 2500 characters of research (7 timeline entries, 3 key events). Re-Research REPLACES it. The current research is snapshotted first.',
    msg);

  check('2d. boundary: exactly at the threshold needs confirm (>=, not >)',
    h.describeResearchSize({ research_md: 'x'.repeat(h.RERESEARCH_CONFIRM_MIN_CHARS) }).needsConfirm === true);
  check('2e. boundary: one char under the threshold does not need confirm',
    h.describeResearchSize({ research_md: 'x'.repeat(h.RERESEARCH_CONFIRM_MIN_CHARS - 1) }).needsConfirm === false);
}

// ── (c) malformed research_data JSON never throws, falls back to char count ──
{
  const h = mk();
  const malformed = '{"timeline": [1,2,3], "key_events": ' + 'z'.repeat(2200);
  let threw = false;
  let info;
  try {
    info = h.describeResearchSize({ research_data: malformed, research_md: '' });
  } catch { threw = true; }
  check('3. malformed research_data JSON does not throw', threw === false);
  check('3b. falls back to the raw character count', info?.chars === malformed.length, `chars=${info?.chars} want=${malformed.length}`);
  check('3c. malformed JSON yields zero timeline/events rather than a partial parse', info?.timeline === 0 && info?.events === 0, JSON.stringify(info));

  const badShape = h.describeResearchSize({ research_data: { timeline: 'not-an-array', key_events: [1, 2] } });
  check('3d. a bad-shaped already-parsed object does not throw and rejects the non-array field',
    badShape.timeline === 0 && badShape.events === 2, JSON.stringify(badShape));
}

// ── (d) snapshot key shape ──
{
  const h = mk();
  const result = await h.snapshotResearchBeforeReResearch({ id: 'proj-42', research_data: '{"a":1}', research_md: 'hello world' });
  check('4. storeFile is called exactly once', h.storeFileCalls.length === 1, JSON.stringify(h.storeFileCalls));
  const call = h.storeFileCalls[0];
  check('4b. the snapshot key has the exact shape <projectId>/research/pre-reresearch-<timestamp>',
    /^proj-42\/research\/pre-reresearch-\d+$/.test(call?.key || ''), call?.key);
  check('4c. the returned url matches the stored key', result.url === `local://${call.key}`);
  const parsedContent = JSON.parse(call.content);
  check('4d. the snapshot content carries the original research_data and research_md',
    parsedContent.research_data === '{"a":1}' && parsedContent.research_md === 'hello world', JSON.stringify(parsedContent));

  const h2 = mk();
  const result2 = await h2.snapshotResearchBeforeReResearch({ research_md: 'x' });
  check('4e. a missing project.id falls back to "unknown-project" rather than throwing',
    /^unknown-project\/research\/pre-reresearch-\d+$/.test(h2.storeFileCalls[0]?.key || ''), h2.storeFileCalls[0]?.key);
}

// ── (e) cancel path: exact log line, pipeline never called ──
{
  const h = mk();
  const bigProject = { research_md: 'x'.repeat(2500) };
  let pipelineCalled = false;
  const { proceed } = h.shouldRunReResearch(bigProject, () => false);
  if (proceed) pipelineCalled = true;

  check('5. cancel path: proceed is false', proceed === false);
  check('5b. cancel path: the pipeline is never invoked', pipelineCalled === false);
  check('5c. cancel path: the exact log line is emitted', h.logs.includes('[RERESEARCH-CONFIRM-1] cancelled (2500 chars)'), JSON.stringify(h.logs));
}

// ── (e-cont) confirm path calls confirmFn exactly once with the exact message ──
{
  const h = mk();
  const bigProject = { research_md: 'x'.repeat(2500) };
  const calls = [];
  const { proceed, info } = h.shouldRunReResearch(bigProject, (msg) => { calls.push(msg); return true; });
  check('6. confirm path: proceed is true', proceed === true);
  check('6b. confirm path: confirmFn is called exactly once', calls.length === 1, String(calls.length));
  check('6c. confirm path: the message matches buildReResearchConfirmMessage exactly',
    calls[0] === h.buildReResearchConfirmMessage(info), calls[0]);
}

// ── (e-cont) below-threshold path never calls confirmFn at all ──
{
  const h = mk();
  const smallProject = { research_md: 'short' };
  let threw = false;
  let proceed;
  try {
    ({ proceed } = h.shouldRunReResearch(smallProject, () => { throw new Error('should not be called'); }));
  } catch { threw = true; }
  check('7. below-threshold path never calls confirmFn', threw === false);
  check('7b. below-threshold path proceeds without a dialog', proceed === true);
}

// ── wiring: handleResearch checks the seed-concept/topic BEFORE the confirm/
// snapshot gate, so confirming re-research on a project with no seed
// concept doesn't snapshot research it's about to abort re-running anyway ──
{
  const studioSrc = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');
  const start = studioSrc.indexOf('const handleResearch = async () => {');
  const end = studioSrc.indexOf('const handleOutlineResearch = async () => {');
  const body = studioSrc.slice(start, end);
  const topicCheckIdx = body.indexOf("if (!topic.trim())");
  const gateIdx = body.indexOf('shouldRunReResearch(');
  check('8. handleResearch validates the seed concept/topic before the RERESEARCH-CONFIRM-1 gate',
    topicCheckIdx !== -1 && gateIdx !== -1 && topicCheckIdx < gateIdx, `topicCheckIdx=${topicCheckIdx} gateIdx=${gateIdx}`);
  check('8b. the gate itself still runs before executeResearchPipeline',
    body.indexOf('shouldRunReResearch(') < body.indexOf('executeResearchPipeline('));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
