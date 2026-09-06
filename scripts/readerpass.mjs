#!/usr/bin/env node
// scripts/readerpass.mjs — READERPASS-1 (UBS_plan.md Phase 2B)
//
// Runs the windowed reader pass over a project's resolved manuscript using
// the Anthropic Messages API directly — a frontier model, a DIFFERENT model
// family than the local writer (per the plan; this must NOT be a fleet
// model and does NOT fall back to one). Prints the report and saves it as a
// PublishingAsset (kind: 'reader_pass_report').
//
//   node scripts/readerpass.mjs --project <id>
//
// The API key is read from UBS_ANTHROPIC_API_KEY or a gitignored
// data/_auth/anthropic.key file (confirmed: .gitignore's `/data/` line
// already covers this path — no .gitignore change needed). The key is
// NEVER printed, logged, or included in any error message. If the key is
// absent, this exits with a clear message and does not fall back to the
// local model.
//
// Never reads or writes data/ files directly beyond the key file above:
// manuscript prose resolves through the store API alone, reusing
// beats-backfill.mjs's resolveChapterProse (inline content_md, else
// content_md_url via the blob store). Report only — never writes Chapter
// or NovelProject.
//
// readerPass.js has no @/ imports (pure, relative-only), so this script
// does NOT need the alias loader the backfill/sweep scripts use — the only
// thing this file imports beyond it is ubs-run.mjs's Node-builtin helpers
// and beats-backfill.mjs's resolveChapterProse (also relative-only).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createStoreClient,
  readRunnerToken,
  resolveDataDir,
} from './ubs-run.mjs';
import { resolveChapterProse } from './beats-backfill.mjs';
import { runReaderPass, formatReaderPassReport } from '../src/lib/readerPass.js';

export const READERPASS_SCRIPT_VERSION = 'readerpass-script-v1';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// READERPASS-1 standing rule: a frontier model, a different model family
// than the local writer — not configurable via CLI flag on purpose.
export const READER_PASS_MODEL = 'claude-sonnet-5';
const READER_PASS_MAX_TOKENS = 8192; // comfortably above the >= 4096 floor readerPass.js enforces

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

export const MISSING_ANTHROPIC_KEY_MESSAGE =
  'No Anthropic API key found (set UBS_ANTHROPIC_API_KEY or create data/_auth/anthropic.key). ' +
  'The reader pass requires a frontier model from a DIFFERENT model family than the local writer ' +
  '— it does not fall back to the local model.';

/**
 * Resolves the Anthropic API key: env var first, then the gitignored key
 * file. Never logs the key itself — only whether one was found. `env` and
 * `dataDir` are injectable so the battery never needs a real key or a real
 * data dir.
 */
export function resolveAnthropicKey({ env = process.env, dataDir } = {}) {
  const fromEnv = String(env.UBS_ANTHROPIC_API_KEY || '').trim();
  if (fromEnv) return fromEnv;
  const keyFile = path.join(dataDir || resolveDataDir(), '_auth', 'anthropic.key');
  if (fs.existsSync(keyFile)) {
    const fromFile = fs.readFileSync(keyFile, 'utf8').trim();
    if (fromFile) return fromFile;
  }
  return null;
}

/**
 * One call to the Anthropic Messages API. Never includes `apiKey` in any
 * thrown error message.
 */
async function callAnthropicMessages({ prompt, apiKey, model = READER_PASS_MODEL, maxTokens = READER_PASS_MAX_TOKENS }) {
  let response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(300000),
    });
  } catch (fetchErr) {
    throw new Error(`Cannot reach the Anthropic API: ${fetchErr?.message || 'unknown error'}`);
  }
  if (!response.ok) {
    let errMessage = `Anthropic API returned HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      errMessage = errBody?.error?.message || errMessage;
    } catch { /* keep the generic message */ }
    throw new Error(errMessage);
  }
  const data = await response.json();
  const text = Array.isArray(data?.content)
    ? data.content.filter((b) => b?.type === 'text').map((b) => b.text).join('')
    : '';
  return { text, stopReason: data?.stop_reason || null };
}

/**
 * Resolves a project's full manuscript prose (every chapter's resolved
 * content, in chapter order, through the store API — never data/ files
 * directly), runs the reader pass, prints the report, and saves it as a
 * PublishingAsset. Every real dependency is injectable: opts.store,
 * opts.resolveChapterProse, opts.runReaderPass, opts.formatReaderPassReport,
 * opts.callLLM.
 */
export async function runReaderPassCommand(opts) {
  const {
    projectId,
    store,
    resolveChapterProse: resolveProseFn = resolveChapterProse,
    runReaderPass: runFn,
    formatReaderPassReport: formatFn,
    callLLM,
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

  const result = await runFn({ fullText, callLLM });
  const report = formatFn(result, { projectTitle: project?.title || '' });
  log(report);

  const asset = await store.PublishingAsset.create({
    project_id: projectId,
    kind: 'reader_pass_report',
    label: `Reader pass ${new Date().toISOString().slice(0, 10)}`,
    content: JSON.stringify(result, null, 2),
    created_date: new Date().toISOString(),
  });
  log(`[READERPASS-1] report saved as PublishingAsset ${asset?.id || '(no id returned)'}.`);

  return { result, report, asset };
}

async function main(argv) {
  const dataDir = resolveDataDir();
  const flags = parseArgs(argv);
  if (!flags.project) {
    console.error('Usage: readerpass.mjs --project <id>');
    process.exitCode = 1;
    return;
  }

  const apiKey = resolveAnthropicKey({ dataDir });
  if (!apiKey) {
    console.error(`[READERPASS-1] ${MISSING_ANTHROPIC_KEY_MESSAGE}`);
    process.exitCode = 1;
    return;
  }

  const token = readRunnerToken(dataDir);
  const baseUrl = process.env.UBS_SERVER_URL || 'http://127.0.0.1:5180';
  const store = createStoreClient({ baseUrl, token });

  const callLLM = (prompt, meta) => callAnthropicMessages({ prompt, apiKey, maxTokens: meta?.maxTokens });

  await runReaderPassCommand({
    projectId: flags.project,
    store,
    runReaderPass,
    formatReaderPassReport,
    callLLM,
  });
}

// readerPass.js has no @/ imports, so this file — unlike the backfill/sweep
// scripts — never needs the alias loader. It runs as a plain Node process
// either way.
const isEntryPoint = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isEntryPoint) {
  main(process.argv.slice(2)).catch((err) => {
    console.error('[READERPASS-1] fatal:', err?.stack || err);
    process.exitCode = 1;
  });
}
