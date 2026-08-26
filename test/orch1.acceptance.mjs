// ORCH-1 acceptance battery — draftChapter is a MOVE, not a rewrite.
//
// src/lib/chapterOrchestrator.js's runChapterDraft is the byte-provable move
// of ProjectStudio.jsx's draftChapter body (091092c6, lines 3949-4942). The
// transformation applied is exactly three substitution rules plus one
// necessitated-by-the-move fix, all re-derived below and checked against a
// sha256 of the 091092c6 body — not re-typed, not eyeballed:
//   1. every React state call (setBusyLabel, setChapterDraft, the
//      onProgress-or-setBusyLabel dispatch inside the old `report` helper)
//      becomes a deps.onProgress(event) call;
//   2. every base44.entities.X.method becomes deps.X.method;
//   3. the old positional shouldRefresh/modelOverride params now live on
//      options.shouldRefresh/options.modelOverride;
//   4. the one bare `if (onProgress)` diagnostic left over after (1) — the
//      old 4th positional param has no counterpart once every caller must
//      supply deps.onProgress unconditionally — becomes `if (deps.onProgress)`,
//      the most conservative fix that keeps the log instead of deleting code.
//
// This file needs `mock.module` (node:test, Node >= 22) to run a real
// mocked-deps pass of runChapterDraft without a live LLM or a real base44/
// localDB write — that API is gated behind --experimental-test-module-mocks,
// and the module itself has transitive @/ imports needing the alias loader,
// so this battery self-relaunches with both before running any check. Every
// other battery in this suite runs as a plain `node test/X.acceptance.mjs`;
// this is the one exception, and the relaunch is transparent to
// test/run-all.mjs (stdio is inherited, so its PASS/FAIL grep still sees
// this process's output as if it were the top-level one).
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const NEEDS_RELAUNCH = !process.execArgv.includes('--experimental-test-module-mocks');

if (NEEDS_RELAUNCH) {
  const aliasLoader = fileURLToPath(new URL('../tests/helpers/aliasLoader.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [
    '--experimental-test-module-mocks',
    '--loader', aliasLoader,
    SELF,
  ], {
    stdio: 'inherit',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

const { mock } = await import('node:test');
const fs = await import('node:fs');
const path = await import('node:path');
const crypto = await import('node:crypto');

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ORCH_PATH = path.join(ROOT, 'src/lib/chapterOrchestrator.js');
const STUDIO_PATH = path.join(ROOT, 'src/pages/ProjectStudio.jsx');
const orchSrc = fs.readFileSync(ORCH_PATH, 'utf8');
const studioSrc = fs.readFileSync(STUDIO_PATH, 'utf8');

// ── 091092c6 baseline: sha256 of draftChapter's original body (lines
// 3950-4941 of that commit's ProjectStudio.jsx, the text strictly between
// the signature line and the function's own closing `};`). Embedded as a
// hash, not the 49KB of text itself, so this file stays reviewable. ──
const BASELINE_BODY_SHA256 = '5786f48bc653fa315673021be0aaacd50235218aa7971e219541794048649517';
const BASELINE_BODY_LENGTH = 49334;

function inverseTransformToOriginal(text) {
  let out = text;
  out = out.replace(
    '    if (deps.onProgress) {\n      console.log(`[DRAFT-CH-${chapter.chapter_number}] draftChapter received onProgress callback`);\n    }',
    '    if (onProgress) {\n      console.log(`[DRAFT-CH-${chapter.chapter_number}] draftChapter received onProgress callback`);\n    }'
  );
  out = out.replace(/\boptions\.modelOverride\b/g, 'modelOverride');
  out = out.replace(/\boptions\.shouldRefresh\b/g, 'shouldRefresh');
  out = out.replace(/\bdeps\.settingsDrafts\./g, 'settingsDrafts.');
  out = out.replace(/\bdeps\.chapterProseModels\[/g, 'chapterProseModels[');
  out = out.replace(/\bdeps\.projectId\b/g, 'projectId');
  out = out.replace(/\bdeps\.toast\.error\(/g, 'toast.error(');
  out = out.replace(/\bdeps\.runProjectContentGuardBeforeSave\(/g, 'runProjectContentGuardBeforeSave(');
  out = out.replace(/\bdeps\.generateSceneBeats\(/g, 'generateSceneBeats(');
  out = out.replace(/\bdeps\.backupChapterBeforeGeneratedOverwrite\(/g, 'backupChapterBeforeGeneratedOverwrite(');
  out = out.replace(/\bdeps\.refreshAll\(\)/g, 'refreshAll()');
  out = out.replace(/\bdeps\.pipelineSnapshot\(/g, 'pipelineSnapshot(');
  out = out.replace(/\bdeps\.invokeLLMWithRetry\(/g, 'invokeLLMWithRetry(');
  out = out.replaceAll('deps.Chapter.filter', 'base44.entities.Chapter.filter');
  out = out.replaceAll('deps.Chapter.update', 'base44.entities.Chapter.update');
  out = out.replaceAll('deps.NovelProject.update', 'base44.entities.NovelProject.update');
  out = out.replace(
    /([ \t]*)deps\.onProgress\(\{ stage: 'chapter-draft-updated', chapterId: chapter\.id, content: (\w+) \}\);/g,
    (_m, indent, varName) => `${indent}if (chapter.id === selectedChapterId) {\n${indent}  setChapterDraft(${varName});\n${indent}}`
  );
  out = out.replaceAll(
    `onProgress: (label) => deps.onProgress({ stage: 'busy-label', chapterId: chapter.id, label })`,
    'onProgress: setBusyLabel'
  );
  out = out.replace(
    `    const report = (value) => {\n      const safeLabel = formatProgressLabel(value);\n      deps.onProgress({ stage: 'report', chapterId: chapter.id, label: safeLabel });\n    };`,
    `    const report = (value) => {\n      const safeLabel = formatProgressLabel(value);\n      if (onProgress) onProgress(safeLabel);\n      else setBusyLabel(safeLabel);\n    };`
  );
  return out;
}

function extractRunChapterDraftBody(src) {
  const startMarker = 'export async function runChapterDraft({ project, chapter, chapters, deps, options = {} }) {\n  void chapters;\n';
  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) return null;
  const bodyStart = startIdx + startMarker.length;
  // The function's own closing brace is the file's final `\n}\n` (nothing else
  // is defined after runChapterDraft in this module). Slicing up to (not
  // including) that newline matches how the original body was assembled —
  // Array.join('\n') never appends a trailing newline after the last line.
  const endIdx = src.lastIndexOf('\n}\n');
  if (endIdx === -1 || endIdx <= bodyStart) return null;
  return src.slice(bodyStart, endIdx);
}

// ── mock.module MUST run before chapterOrchestrator.js (or anything that
// transitively imports sceneWriter.js / base44Client.js) is ever imported —
// once a specifier is resolved into the module cache, a later mock.module()
// call cannot retroactively rebind an already-live static import. So every
// mock is registered here, first, and the ONE import of the orchestrator
// below is reused for every check that needs the live module (1, 1b, 6-9). ──
const sceneWriterUrl = pathToFileURL(path.join(ROOT, 'src/lib/sceneWriter.js')).href;
const base44Url = pathToFileURL(path.join(ROOT, 'src/api/base44Client.js')).href;

const MOCK_PROSE = Array.from({ length: 40 }, (_, i) =>
  `Mara walked along the pier while Dov watched the tide come in, and Ilse counted the gulls circling overhead. This is sentence number ${i} of the mocked chapter body, long enough to clear the word target without needing a real language model call.`
).join(' ');

mock.module(sceneWriterUrl, {
  namedExports: {
    generateChapterByScenes: async () => ({
      prose: MOCK_PROSE,
      totalWords: MOCK_PROSE.split(/\s+/).length,
      cleanResult: { text: MOCK_PROSE },
      actualModelUsed: 'mock-model',
      anthologyProseNames: [],
    }),
    finalizeChapterProse: async (text) => text,
  },
});

const fakeChapters = new Map();
const base44Invocations = { functionsInvoke: false };
mock.module(base44Url, {
  namedExports: {
    base44: {
      entities: {
        Chapter: {
          update: async (id, payload) => {
            const merged = { ...(fakeChapters.get(id) || { id }), ...payload, id };
            fakeChapters.set(id, merged);
            return merged;
          },
          filter: async (query) => {
            if (query && query.id) {
              const rec = fakeChapters.get(query.id);
              return rec ? [rec] : [];
            }
            return [...fakeChapters.values()];
          },
        },
        NovelProject: { update: async () => ({}) },
      },
      functions: { invoke: async () => { base44Invocations.functionsInvoke = true; throw new Error('functions.invoke must not be called in this fixture'); } },
    },
  },
});

// ── 1. runChapterDraft is exported and is a function ──
const orchModUrl = pathToFileURL(ORCH_PATH).href;
const orchMod = await import(orchModUrl);
check('1. runChapterDraft is exported as a function', typeof orchMod.runChapterDraft === 'function');
check('1b. CHAPTER_ORCHESTRATOR_VERSION is exported and non-empty', typeof orchMod.CHAPTER_ORCHESTRATOR_VERSION === 'string' && orchMod.CHAPTER_ORCHESTRATOR_VERSION.length > 0);

// ── 2. no React import, no @/-aliased import in the orchestrator ──
check('2. chapterOrchestrator.js has no @/-aliased import',
  !/from\s+['"]@\//.test(orchSrc));
check('2b. chapterOrchestrator.js has no React import',
  !/from\s+['"]react['"]/i.test(orchSrc));

// ── 3. the ProjectStudio.jsx wrapper is < 60 lines and calls runChapterDraft ──
{
  const sigIdx = studioSrc.indexOf('const draftChapter = async (chapter, shouldRefresh = true, modelOverride, onProgress, options = {}) => {');
  check('3. draftChapter wrapper signature found in ProjectStudio.jsx', sigIdx !== -1);
  let wrapperLines = 0;
  let callsRunChapterDraft = false;
  if (sigIdx !== -1) {
    const rest = studioSrc.slice(sigIdx);
    const endIdx = rest.indexOf('\n  };\n');
    const wrapperText = endIdx !== -1 ? rest.slice(0, endIdx) : rest;
    wrapperLines = wrapperText.split('\n').length;
    callsRunChapterDraft = /runChapterDraft\(/.test(wrapperText);
  }
  check('3b. draftChapter wrapper is under 60 lines', wrapperLines > 0 && wrapperLines < 60, `wrapper is ${wrapperLines} lines`);
  check('3c. draftChapter wrapper calls runChapterDraft(...)', callsRunChapterDraft);
  check('3d. ProjectStudio.jsx imports runChapterDraft from the orchestrator',
    /import\s*\{\s*runChapterDraft\s*\}\s*from\s*['"]@\/lib\/chapterOrchestrator['"]/.test(studioSrc));
}

// ── 4. normalized-diff proof: inverse-transforming the current body reproduces
//      the 091092c6 original byte-for-byte (hash-checked, not re-typed) ──
{
  const currentBody = extractRunChapterDraftBody(orchSrc);
  check('4. runChapterDraft body extracted from chapterOrchestrator.js', typeof currentBody === 'string' && currentBody.length > 0);
  const reconstructed = currentBody ? inverseTransformToOriginal(currentBody) : '';
  const reconstructedHash = crypto.createHash('sha256').update(reconstructed).digest('hex');
  check('4b. inverse-transformed body length matches the 091092c6 baseline', reconstructed.length === BASELINE_BODY_LENGTH,
    `got ${reconstructed.length}, want ${BASELINE_BODY_LENGTH}`);
  check('4c. inverse-transformed body sha256 matches the 091092c6 baseline (empty normalized diff)',
    reconstructedHash === BASELINE_BODY_SHA256, `got ${reconstructedHash}`);
}

// ── 5. finalizeChapterProse is still called exactly once in the moved body
//      (the second 091092c6 call site lives in sceneWriter.js itself, untouched) ──
check('5. finalizeChapterProse is called exactly once in chapterOrchestrator.js',
  (orchSrc.match(/\bfinalizeChapterProse\(/g) || []).length === 1);

// ── 6-9: a real mocked-deps run — fixture project (Mara/Dov/Ilse), mocked
//      scene writer returning fixed prose, mocked base44 (no real localDB/
//      network I/O), fastDraftOnly so the run takes the shortest real success
//      path through the bible gate, safety gate, and verified save. ──
{
  const charactersMd = [
    '## Mara', 'She/her. A dockworker with a temper she is trying to unlearn.', '',
    '## Dov', "He/him. Mara's older brother, recently returned from the war.", '',
    '## Ilse', "She/her. The harbor-master who remembers everyone's debts.",
  ].join('\n');
  const project = {
    id: 'fixture-proj-1',
    title: 'Fixture Harbor Project',
    world_md: 'A small fishing town built on a single long pier.',
    characters_md: charactersMd,
    outline_md: '## Chapter 1\nMara confronts Dov on the pier while Ilse watches from the harbor office.',
    canon_md: 'The town has one harbor, one pier, one tide.',
    voice_md: 'Plain, close third person.',
    chapter_length_target: 500,
    target_chapter_words: 500,
    default_prose_model: 'test-model',
    tense: 'past',
    pov_mode: 'third-close',
  };
  const chapter = { id: 'ch-1', chapter_number: 1, title: 'The Pier', status: 'planned', scene_beats_json: null };

  const events = [];
  const snapshots = [];
  const toastErrors = [];
  let novelProjectUpdated = false;
  let llmRetryCalled = false;

  const deps = {
    Chapter: { filter: async () => [], update: async (id, payload) => ({ id, ...payload }) },
    NovelProject: { update: async () => { novelProjectUpdated = true; return {}; } },
    invokeLLMWithRetry: async () => { llmRetryCalled = true; throw new Error('invokeLLMWithRetry should not run on the fastDraftOnly path'); },
    pipelineSnapshot: (chapterId, stage) => { snapshots.push(stage); },
    onProgress: (event) => { events.push(event); },
    toast: { error: (msg) => { toastErrors.push(msg); } },
    refreshAll: async () => {},
    runProjectContentGuardBeforeSave: () => {},
    generateSceneBeats: async () => JSON.stringify({ beats: [] }),
    backupChapterBeforeGeneratedOverwrite: async () => {},
    projectId: 'fixture-proj-1',
    chapterProseModels: {},
    settingsDrafts: { default_prose_model: 'test-model' },
  };

  let result = null;
  let threw = null;
  try {
    result = await orchMod.runChapterDraft({
      project, chapter, chapters: [], deps,
      options: { fastDraftOnly: true, shouldRefresh: false },
    });
  } catch (err) {
    threw = err;
  }

  check('6. mocked-deps run completes without throwing', threw === null, threw && (threw.stack || String(threw)));
  check('6b. mocked-deps run reports no bible-gate / safety-gate errors via toast.error', toastErrors.length === 0, toastErrors.join(' | '));
  check('6c. mocked-deps run returns a drafted chapter', result?.status === 'drafted', JSON.stringify(result));
  check('7. pipelineSnapshot stages fire in the exact fastDraftOnly order', JSON.stringify(snapshots) === JSON.stringify(['1-raw-llm-output', '3-fast-save-point']),
    `got ${JSON.stringify(snapshots)}`);
  check('7b. onProgress receives one event per former state call on this path (3 report + 1 chapter-draft-updated)',
    events.filter((e) => e.stage === 'report').length === 3 && events.filter((e) => e.stage === 'chapter-draft-updated').length === 1,
    JSON.stringify(events.map((e) => e.stage)));
  check('8. no real LLM call was made (invokeLLMWithRetry never reached on this path)', llmRetryCalled === false);
  check('8b. no real base44.functions.invoke call was made (no accidental network/GitHub path)', base44Invocations.functionsInvoke === false);
  check('9. the base44 mock (not real localDB) received the verified save — deps did not bypass it, and it did not bypass deps',
    fakeChapters.has('ch-1') && typeof fakeChapters.get('ch-1').content_md === 'string' && fakeChapters.get('ch-1').content_md.includes('Mara walked along the pier'));
  check('9b. deps.NovelProject.update (not the real base44 one) received the post-draft project update', novelProjectUpdated === true);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
