#!/usr/bin/env node
// scripts/readerpass.mjs — LOCALREADER-1 (UBS_plan.md Phase 2B)
//
// Runs the windowed reader pass over a project's resolved manuscript using
// UBS's local critic model. The command is deliberately loopback-only: it
// refuses any UBS_SERVER_URL that could route the manuscript off-machine.
// The critic is a different model family from the Qwen fiction writer, so
// the pass remains an independent second opinion without a cloud provider.
//
//   node scripts/readerpass.mjs --project <id>
//
// Manuscript prose resolves through the authenticated store API. The report
// is saved as a PublishingAsset (kind: 'reader_pass_report'). Report only —
// this command never writes Chapter or NovelProject.

import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  configureHeadlessEnvironment,
  createStoreClient,
  readRunnerToken,
  resolveDataDir,
} from './ubs-run.mjs';
import { resolveChapterProse } from './beats-backfill.mjs';
import { runReaderPass, formatReaderPassReport } from '../src/lib/readerPass.js';

export const READERPASS_SCRIPT_VERSION = 'readerpass-script-v2-local';
export const READER_PASS_MODEL = 'deepseek-r1-14b';
export const READER_PASS_TASK_TYPE = 'critique';
export const READER_PASS_MAX_TOKENS = 4096;
export const READER_PASS_TRANSPORT = 'local-loopback';

const HERE = fileURLToPath(import.meta.url);
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const READER_PASS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    flags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          echoOf: { type: 'string' },
          what: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['location', 'echoOf', 'what', 'confidence'],
      },
    },
    runningList: { type: 'string' },
  },
  required: ['flags', 'runningList'],
};

export function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
      else flags[key] = true;
    }
  }
  return flags;
}

/**
 * Refuses any reader-pass route that is not an explicit HTTP loopback URL.
 * This is a hard boundary, not a convention: a hostname, LAN address,
 * tailnet address, HTTPS proxy, or URL carrying credentials is rejected.
 */
export function assertLoopbackServerUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ''));
  } catch {
    throw new Error('[LOCALREADER-1] UBS_SERVER_URL must be a valid loopback URL.');
  }
  if (parsed.protocol !== 'http:' || !LOOPBACK_HOSTS.has(parsed.hostname) || parsed.username || parsed.password) {
    throw new Error('[LOCALREADER-1] Reader pass is local-only; UBS_SERVER_URL must use HTTP on 127.0.0.1, localhost, or [::1].');
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('[LOCALREADER-1] UBS_SERVER_URL must be an origin only, with no path, query, or fragment.');
  }
  return parsed.origin;
}

/**
 * Adapts localLLM's { text, finishReason } result to readerPass.js's
 * transport-neutral { text, stopReason } contract.
 */
export function createLocalReaderCaller({ callAgentWithMeta, model = READER_PASS_MODEL } = {}) {
  if (typeof callAgentWithMeta !== 'function') {
    throw new Error('[LOCALREADER-1] callAgentWithMeta is required.');
  }
  return async (prompt, meta = {}) => {
    const response = await callAgentWithMeta({
      prompt,
      taskType: READER_PASS_TASK_TYPE,
      model,
      temperature: 0.2,
      maxTokens: meta.maxTokens || READER_PASS_MAX_TOKENS,
      jsonSchema: READER_PASS_JSON_SCHEMA,
    });
    return { text: response?.text || '', stopReason: response?.finishReason ?? null };
  };
}

/**
 * Resolves a project's full manuscript prose through the store API, runs
 * the reader pass, prints the report, and saves it as a PublishingAsset.
 * Every external dependency is injectable for an offline acceptance test.
 */
export async function runReaderPassCommand(opts) {
  const {
    projectId,
    store,
    resolveChapterProse: resolveProseFn = resolveChapterProse,
    runReaderPass: runFn,
    formatReaderPassReport: formatFn,
    callLLM,
    audit = {},
    log = (line) => console.log(line),
  } = opts;

  const project = await store.NovelProject.get(projectId);
  const chapters = await store.Chapter.filter({ project_id: projectId }, 'chapter_number', 500);
  const sorted = chapters.slice().sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));

  const parts = [];
  for (const chapter of sorted) {
    const prose = await resolveProseFn(chapter, store);
    if (prose && prose.trim()) parts.push(`=== Chapter ${chapter.chapter_number} ===\n\n${prose}`);
  }
  const fullText = parts.join('\n\n');

  const coreResult = await runFn({ fullText, callLLM, maxTokens: READER_PASS_MAX_TOKENS });
  const result = {
    ...coreResult,
    audit: {
      transport: READER_PASS_TRANSPORT,
      model: READER_PASS_MODEL,
      taskType: READER_PASS_TASK_TYPE,
      scriptVersion: READERPASS_SCRIPT_VERSION,
      ...audit,
    },
  };
  const report = formatFn(result, { projectTitle: project?.title || '' });
  log(report);

  const asset = await store.PublishingAsset.create({
    project_id: projectId,
    kind: 'reader_pass_report',
    label: `Reader pass ${new Date().toISOString().slice(0, 10)}`,
    content: JSON.stringify(result, null, 2),
    created_date: new Date().toISOString(),
  });
  log(`[LOCALREADER-1] report saved as PublishingAsset ${asset?.id || '(no id returned)'}.`);

  return { result, report, asset };
}

async function buildLocalReaderDeps() {
  const { callAgentWithMeta } = await import('../src/lib/localLLM.js');
  return { callLLM: createLocalReaderCaller({ callAgentWithMeta }) };
}

async function main(argv) {
  const dataDir = resolveDataDir();
  const flags = parseArgs(argv);
  if (!flags.project) {
    console.error('Usage: readerpass.mjs --project <id>');
    process.exitCode = 1;
    return;
  }

  const baseUrl = assertLoopbackServerUrl(process.env.UBS_SERVER_URL || 'http://127.0.0.1:5180');
  const token = readRunnerToken(dataDir);
  configureHeadlessEnvironment({ token, baseUrl });
  const store = createStoreClient({ baseUrl, token });
  const deps = await buildLocalReaderDeps();

  await runReaderPassCommand({
    projectId: flags.project,
    store,
    runReaderPass,
    formatReaderPassReport,
    ...deps,
  });
}

const isEntryPoint = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isEntryPoint) {
  if (!process.env.__UBS_READERPASS_RELAUNCHED) {
    const aliasLoader = fileURLToPath(new URL('../tests/helpers/aliasLoader.mjs', import.meta.url));
    const result = spawnSync(process.execPath, ['--loader', aliasLoader, HERE, ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: { ...process.env, __UBS_READERPASS_RELAUNCHED: '1' },
    });
    process.exit(result.status ?? 1);
  } else {
    main(process.argv.slice(2)).catch((err) => {
      console.error('[LOCALREADER-1] fatal:', err?.stack || err);
      process.exitCode = 1;
    });
  }
}
