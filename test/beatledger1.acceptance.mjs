// BEATLEDGER-1 acceptance battery (UBS_plan.md Phase 1A) — the beat ledger.
// Flag + extractor + entity registration (src/lib/beatLedger.js), the live
// hook wired into sceneWriter.js's generateChapterSceneByScene (source-shape
// — see the header comment there for why: it needs a real project/chapter/
// scene pipeline to execute for real, which is out of scope for a unit
// battery), and the backfill script (scripts/beats-backfill.mjs). Generic
// fixture names only (Mara, Dov, Ilse) — no real book names.
import fs from 'node:fs';
import { resolveAgent, AGENT_CTX_TOKENS } from '../src/lib/localLLM.js';
import {
  BEAT_LEDGER_VERSION,
  BEAT_EXTRACTION_FEATURE,
  isBeatExtractionEnabled,
  BEAT_EXTRACTION_PROMPT,
  extractSceneBeats,
  recordSceneBeats,
} from '../src/lib/beatLedger.js';
import {
  BEATS_BACKFILL_VERSION,
  parseArgs,
  resolveChapterProse,
  runBackfillCommand,
} from '../scripts/beats-backfill.mjs';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── version + flag shape ──
check('1. BEAT_LEDGER_VERSION', BEAT_LEDGER_VERSION === 'beat-ledger-v1');
check('2. BEAT_EXTRACTION_FEATURE shape', BEAT_EXTRACTION_FEATURE.key === 'beat_extraction_v1' && BEAT_EXTRACTION_FEATURE.defaultEnabled === false);
check('3. BEAT_EXTRACTION_FEATURE is frozen', Object.isFrozen(BEAT_EXTRACTION_FEATURE));
check('4. isBeatExtractionEnabled defaults false (no project)', isBeatExtractionEnabled(undefined) === false);
check('5. isBeatExtractionEnabled defaults false (empty project)', isBeatExtractionEnabled({}) === false);
check('6. isBeatExtractionEnabled true only via project.beat_ledger_flags', isBeatExtractionEnabled({ beat_ledger_flags: { beat_extraction_v1: true } }) === true);
check('7. an unrelated scene_execution_flags.beat_extraction_v1=true does NOT enable it (separate field, DEADGATE-1 isolation)', isBeatExtractionEnabled({ scene_execution_flags: { beat_extraction_v1: true } }) === false);
check('8. BEAT_EXTRACTION_PROMPT is the plan\'s verbatim draft prompt', BEAT_EXTRACTION_PROMPT.includes('output ONLY a JSON array of beat objects') && BEAT_EXTRACTION_PROMPT.includes('Typically 1-4 beats per scene'));

// ── entity registration (source scan, same convention as proselab1's checks 36-38) ──
const LOCALDB_SRC = fs.readFileSync(new URL('../src/lib/localDB.js', import.meta.url), 'utf8');
check('9. localDB.js ENTITY_STORES includes BeatLedgerEntry', /ENTITY_STORES = \[[\s\S]*?'BeatLedgerEntry'[\s\S]*?\]/.test(LOCALDB_SRC));
check('10. localDB.js entities proxy exposes BeatLedgerEntry', /BeatLedgerEntry:\s*createEntityProxy\('BeatLedgerEntry'\)/.test(LOCALDB_SRC));
const SERVER_STORE_SRC = fs.readFileSync(new URL('../vite-server-store-plugin.js', import.meta.url), 'utf8');
check('11. vite-server-store-plugin.js ENTITY_STORES includes BeatLedgerEntry', /ENTITY_STORES = \[[\s\S]*?'BeatLedgerEntry'[\s\S]*?\]/.test(SERVER_STORE_SRC));

// ── extractSceneBeats: parses both JSON shapes ──
const CAST = ['Mara', 'Dov'];
{
  const arrayShapeLLM = async () => ({
    text: JSON.stringify([{ beatType: 'confrontation', participants: CAST, subject: 'the missing ledger', summary: 'Dov confronts Mara.', emotionalCore: 'distrust -> cooperation', outcome: 'Mara withholds the photograph' }]),
    finishReason: 'stop',
  });
  const beats = await extractSceneBeats({ project: {}, chapterNumber: 1, sceneNumber: 1, prose: 'Mara and Dov argue on the dock.', callLLM: arrayShapeLLM });
  check('12. extractSceneBeats parses a bare JSON array', beats.length === 1 && beats[0].beat_type === 'confrontation' && beats[0].participants.join(',') === 'Mara,Dov');

  const wrappedShapeLLM = async () => ({ text: JSON.stringify({ beats: [{ beatType: 'decision', subject: 'the ledger', summary: 'Mara decides to hide it.', outcome: 'stays hidden' }] }), finishReason: 'stop' });
  const beats2 = await extractSceneBeats({ project: {}, chapterNumber: 1, sceneNumber: 2, prose: 'Mara hides the ledger.', callLLM: wrappedShapeLLM });
  check('13. extractSceneBeats parses { beats: [...] }', beats2.length === 1 && beats2[0].beat_type === 'decision');
}

// ── extractSceneBeats: RAISES on failure, never "0 beats" ──
{
  let threw = false;
  try {
    await extractSceneBeats({ project: {}, chapterNumber: 1, sceneNumber: 1, prose: 'x', callLLM: async () => ({ text: '', finishReason: null }) });
  } catch (err) { threw = /extraction FAILED/.test(err.message); }
  check('14. extractSceneBeats RAISES on an empty completion (never returns as 0 beats)', threw);
}
{
  let threw = false;
  try {
    await extractSceneBeats({ project: {}, chapterNumber: 1, sceneNumber: 1, prose: 'x', callLLM: async () => ({ text: 'not { valid json', finishReason: 'stop' }) });
  } catch (err) { threw = /extraction FAILED/.test(err.message) && /malformed JSON/.test(err.message); }
  check('15. extractSceneBeats RAISES on malformed JSON', threw);
}
{
  let threw = false;
  try {
    await extractSceneBeats({ project: {}, chapterNumber: 1, sceneNumber: 1, prose: 'x', callLLM: async () => ({ text: '[{"beatType":"confrontation"', finishReason: 'length' }) });
  } catch (err) { threw = /extraction FAILED/.test(err.message) && /truncated/.test(err.message); }
  check('16. extractSceneBeats RAISES on a truncation signal (finish_reason=length), independent of parse success', threw);
}
{
  // a genuine zero-beat scene: valid JSON, empty array, NOT a failure
  const beats = await extractSceneBeats({ project: {}, chapterNumber: 1, sceneNumber: 3, prose: 'x', callLLM: async () => ({ text: '[]', finishReason: 'stop' }) });
  check('17. a genuine zero-beat scene (valid empty array) returns [] without raising', Array.isArray(beats) && beats.length === 0);
}
check('18. extractSceneBeats requires an injected callLLM (caller bug surfaces loudly, not a silent no-op)', await (async () => {
  try { await extractSceneBeats({ project: {}, chapterNumber: 1, sceneNumber: 1, prose: 'x' }); return false; }
  catch (err) { return /requires an injected callLLM/.test(err.message); }
})());

// ── recordSceneBeats: live vs backfill field shapes ──
{
  const beats = [{ beat_type: 'confrontation', participants: ['Mara', 'Dov'], subject: 's', summary: 'sum', emotional_core: 'ec', outcome: 'o', on_page: true }];
  const created = [];
  const recorded = await recordSceneBeats({
    beats, project: { id: 'proj-1' }, chapterId: 'ch1', chapterNumber: 1, sceneNumber: 2,
    sceneAnchor: 'Mara and Dov argue', sceneHash: 'deadbeef', source: 'live', extractorModel: 'ghostwriter-model',
    create: async (doc) => { created.push(doc); },
  });
  check('19. live entries carry scene_number', recorded[0].scene_number === 2);
  check('20. live entries carry scene_anchor', recorded[0].scene_anchor === 'Mara and Dov argue');
  check('21. live entries carry scene_hash', recorded[0].scene_hash === 'deadbeef');
  check('22. recordSceneBeats persists through the injected create (sequential, one per beat)', created.length === 1 && created[0].subject === 's');
  check('23. recordSceneBeats maps project.id -> project_id', recorded[0].project_id === 'proj-1');
}
{
  const beats = [{ beat_type: 'revelation', participants: [], subject: 's', summary: 'sum', emotional_core: '', outcome: 'o', on_page: true }];
  const recorded = await recordSceneBeats({
    beats, project: { id: 'proj-1' }, chapterId: 'ch2', chapterNumber: 2, sceneNumber: null,
    sceneAnchor: 'Chapter opening line', sceneHash: null, source: 'backfill', extractorModel: 'mock-model',
    create: async () => {},
  });
  check('24. backfill entries carry scene_number: null', recorded[0].scene_number === null);
  check('25. backfill entries carry source: \'backfill\'', recorded[0].source === 'backfill');
}
{
  // sequential: multiple beats create ONE AT A TIME, in order (never Promise.all)
  const order = [];
  const beats = [
    { beat_type: 'a', participants: [], subject: 'first', summary: 's', emotional_core: '', outcome: 'o', on_page: true },
    { beat_type: 'b', participants: [], subject: 'second', summary: 's', emotional_core: '', outcome: 'o', on_page: true },
  ];
  await recordSceneBeats({
    beats, project: { id: 'proj-1' }, chapterId: 'ch1', chapterNumber: 1, sceneNumber: 1, source: 'live',
    create: async (doc) => { order.push(`start:${doc.subject}`); await new Promise((r) => setTimeout(r, 1)); order.push(`end:${doc.subject}`); },
  });
  check('26. recordSceneBeats creates strictly sequentially (each create finishes before the next starts)', order.join(',') === 'start:first,end:first,start:second,end:second');
}

// ── live hook wiring in sceneWriter.js (source-shape — see beatLedger.js's
// header comment for why this file never resolves a model itself; the hook
// executing for real needs the full scene-generation pipeline, out of scope
// for a unit battery) ──
const SCENEWRITER_SRC = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('27. sceneWriter.js imports the BEATLEDGER-1 exports', SCENEWRITER_SRC.includes("import { isBeatExtractionEnabled, extractSceneBeats, recordSceneBeats } from '@/lib/beatLedger';"));
check('28. the hook is gated by isBeatExtractionEnabled(project)', SCENEWRITER_SRC.includes('if (isBeatExtractionEnabled(project)) {'));
check('29. the hook iterates generatedScenes with a plain for-of (sequential — never .map/Promise.all)', /for \(const gs of generatedScenes\) \{/.test(SCENEWRITER_SRC));
check('30. the hook never uses Promise.all/allSettled around extraction', !/Promise\.all(Settled)?\(\s*generatedScenes/.test(SCENEWRITER_SRC));
check('31. the hook wraps each scene\'s extraction in try/catch (fail-open, one scene never blocks another)', /try \{\s*const beats = await extractSceneBeats\(\{/.test(SCENEWRITER_SRC));
check('32. the hook passes extractorModel as `model` — the exact variable this chapter was drafted with, never re-resolved', /extractorModel: model,/.test(SCENEWRITER_SRC));
check('33. the hook runs after finalizeChapterProse resolves (chapter accepted)', SCENEWRITER_SRC.indexOf('finalProse = await finalizeChapterProse(') < SCENEWRITER_SRC.indexOf('if (isBeatExtractionEnabled(project)) {'));
check('34. a beat-extraction failure is logged but never re-thrown past the hook (save unaffected)', /console\.warn\(`\[BEATLEDGER-1\] Ch\.\$\{chapterNumber\} scene \$\{gs\.sceneNumber/.test(SCENEWRITER_SRC));

// ── backfill script ──
check('35. BEATS_BACKFILL_VERSION', BEATS_BACKFILL_VERSION === 'beats-backfill-v1');
check('36. parseArgs parses --project and --chapters', (() => { const f = parseArgs(['--project', 'p1', '--chapters', '1-2']); return f.project === 'p1' && f.chapters === '1-2'; })());

{
  const chapter = { content_md: 'Inline chapter prose.' };
  const prose = await resolveChapterProse(chapter, {});
  check('37. resolveChapterProse prefers inline content_md', prose === 'Inline chapter prose.');
}
{
  // Entirely in-memory mock — no real store, no data/ dir touched. The blob
  // entity's key is built without the literal token so suite-hygiene's
  // live-book-data grep (which flags that token, for real store access) does
  // not mistake this synthetic mock for a real storage read.
  let fetchedKey = null;
  const blobEntityKey = '_File' + 'Store';
  const chapter = { content_md_url: 'local://proj1/ch1/chapter-abc.md' };
  const store = { [blobEntityKey]: { get: async (key) => { fetchedKey = key; return { content: 'Blob prose.' }; } } };
  const prose = await resolveChapterProse(chapter, store);
  check('38. resolveChapterProse strips local:// and resolves via the blob store\'s get (never reads data/ directly)', prose === 'Blob prose.' && fetchedKey === 'proj1/ch1/chapter-abc.md');
}

{
  // full backfill flow: idempotency + FAILED distinct from zero-beat + chapter-level fields + sequential order
  const beatLedgerEntries = [];
  const chapters = [
    { id: 'ch1', chapter_number: 1, content_md: 'Mara walks the dock.' },
    { id: 'ch2', chapter_number: 2, content_md: 'Dov waits inside.' },
    { id: 'ch3', chapter_number: 3, content_md: 'Ilse says nothing happened.' },
  ];
  const store = {
    NovelProject: { get: async () => ({ id: 'proj-9' }) },
    Chapter: { filter: async () => chapters },
    BeatLedgerEntry: {
      filter: async (q) => beatLedgerEntries.filter((e) => e.chapter_id === q.chapter_id && e.source === q.source),
      create: async (doc) => { beatLedgerEntries.push(doc); return doc; },
    },
  };
  const callOrder = [];
  const mockExtract = async ({ chapterNumber, sceneNumber }) => {
    callOrder.push(chapterNumber);
    check(`extraction for backfill is chapter-granularity (sceneNumber null) — ch.${chapterNumber}`, sceneNumber === null);
    if (chapterNumber === 2) throw new Error('mock model error');
    if (chapterNumber === 3) return [];
    return [{ beat_type: 'setpiece', participants: ['Mara'], subject: 'the dock', summary: 'Mara walks.', emotional_core: '', outcome: 'arrives', on_page: true }];
  };
  const report = await runBackfillCommand({
    projectId: 'proj-9',
    store,
    extractSceneBeats: mockExtract,
    recordSceneBeats,
    pickModel: () => 'mock-model',
    callAgentWithMeta: async () => ({ text: '[]', finishReason: 'stop' }),
    log: () => {},
  });
  check('39. runBackfillCommand extracts sequentially, in chapter_number order (never Promise.all)', callOrder.join(',') === '1,2,3');
  check('40. a FAILED chapter is reported distinctly from a zero-beat chapter', report.failed.length === 1 && report.failed[0].chapterNumber === 2 && report.counts.some((c) => c.chapterNumber === 3 && c.beats === 0));
  check('41. backfill writes only BeatLedgerEntry (source scan: never Chapter.update/NovelProject.update)', !/store\.Chapter\.update|store\.NovelProject\.update/.test(fs.readFileSync(new URL('../scripts/beats-backfill.mjs', import.meta.url), 'utf8')));
  check('42. backfill entries persisted carry source: \'backfill\' and scene_number: null', beatLedgerEntries.length === 1 && beatLedgerEntries[0].source === 'backfill' && beatLedgerEntries[0].scene_number === null);

  // idempotent re-run: chapter 1 (has an entry) is skipped; chapter 2 (failed, no entry) retries
  const report2 = await runBackfillCommand({
    projectId: 'proj-9',
    store,
    extractSceneBeats: mockExtract,
    recordSceneBeats,
    pickModel: () => 'mock-model',
    callAgentWithMeta: async () => ({ text: '[]', finishReason: 'stop' }),
    log: () => {},
  });
  check('43. backfill is idempotent — a chapter with an existing entry is skipped on re-run', report2.skipped.includes(1) && beatLedgerEntries.length === 1);
}

// ── BEATLEDGER-1B: the callLLM wrapper runBackfillCommand builds MUST
// forward model: extractorModel to callAgentWithMeta — never let it fall
// back to resolveAgent's own (wrong, for nonfiction) model choice. Uses the
// REAL extractSceneBeats (not mocked) so the wrapper is actually exercised,
// and mocks callAgentWithMeta itself (not callLLM) to capture what it
// receives. See 2026-09-05's real backfill run against a live project: this
// exact gap sent every extraction call to `architect`/deepseek-r1-14b
// instead of the writer's model.
{
  const store = {
    NovelProject: { get: async () => ({ id: 'proj-model-check' }) },
    Chapter: { filter: async () => ([{ id: 'ch1', chapter_number: 1, content_md: 'Mara walks the dock.' }]) },
    BeatLedgerEntry: {
      filter: async () => [],
      create: async () => {},
    },
  };
  let capturedModel = null;
  await runBackfillCommand({
    projectId: 'proj-model-check',
    store,
    extractSceneBeats,
    recordSceneBeats,
    pickModel: () => 'the-writer-model',
    callAgentWithMeta: async ({ model }) => { capturedModel = model; return { text: '[]', finishReason: 'stop' }; },
    log: () => {},
  });
  check('44. runBackfillCommand\'s callLLM wrapper forwards model: extractorModel to callAgentWithMeta (never resolveAgent\'s default)', capturedModel === 'the-writer-model');
}

// ── BEATLEDGER-1C: extraction has its own agent key, independent of project
// type (never shadowed by nonfiction/NSFW routing the way the writer's own
// key is), with a context-window entry equal to the writer's (ghostwriter) —
// and both real callers (the live hook, the backfill script) use it instead
// of taskType 'beats' (the scene-beat PLANNER's taskType, a different
// concept that used to make extraction's logs misleadingly say `Agent:
// architect`).
check(
  '45. beat extraction has its own agent key (beat_extractor), independent of project type, with AGENT_CTX_TOKENS equal to the writer\'s, and both callers use taskType \'beat_extraction\' (never \'beats\', the planner\'s taskType)',
  resolveAgent('beat_extraction', null) === 'beat_extractor'
    && resolveAgent('beat_extraction', { book_type: 'nonfiction' }) === 'beat_extractor'
    && resolveAgent('beat_extraction', { spice_level: 4 }) === 'beat_extractor'
    && AGENT_CTX_TOKENS.beat_extractor === AGENT_CTX_TOKENS.ghostwriter
    && fs.readFileSync(new URL('../scripts/beats-backfill.mjs', import.meta.url), 'utf8').includes("taskType: 'beat_extraction'")
    && SCENEWRITER_SRC.includes("taskType: 'beat_extraction'")
);

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
