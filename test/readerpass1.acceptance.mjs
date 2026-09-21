// READERPASS-1 acceptance battery (UBS_plan.md Phase 2B) — the windowed
// reader pass. Report only: no gates, no writes to Chapter/NovelProject.
// Generic fixture names only (Mara, Dov). No real model or network call
// anywhere in this file — every callLLM is a mock.
import fs from 'node:fs';
import {
  READER_PASS_VERSION,
  READER_PASS_WINDOW_WORDS,
  READER_PASS_OVERLAP_WORDS,
  READER_PASS_MIN_MAX_TOKENS,
  buildReaderWindows,
  runReaderPass,
  formatReaderPassReport,
} from '../src/lib/readerPass.js';
import {
  READERPASS_SCRIPT_VERSION,
  READER_PASS_MODEL,
  READER_PASS_TASK_TYPE,
  READER_PASS_TRANSPORT,
  READER_PASS_MAX_ATTEMPTS,
  READER_PASS_RETRY_DELAY_MS,
  assertLoopbackServerUrl,
  createLocalReaderCaller,
  isRetryableReaderError,
  runReaderPassCommand,
  parseArgs,
} from '../scripts/readerpass.mjs';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── version ──
check('1. READER_PASS_VERSION', READER_PASS_VERSION === 'reader-pass-v3-local-retry');
check('2. READERPASS_SCRIPT_VERSION', READERPASS_SCRIPT_VERSION === 'readerpass-script-v3-local-retry');

// ── windowing sizes ──
{
  const words = Array.from({ length: 40000 }, (_, i) => `word${i}`).join(' ');
  const windows = buildReaderWindows(words);
  check('3. windows use the local-context-safe word limit', windows[0].endWord - windows[0].startWord === READER_PASS_WINDOW_WORDS && READER_PASS_WINDOW_WORDS === 12000);
  check('4. consecutive windows preserve a 1.5k-word overlap', windows[0].endWord - windows[1].startWord === READER_PASS_OVERLAP_WORDS && READER_PASS_OVERLAP_WORDS === 1500);
  check('5. the final window is clipped to the text\'s end, not padded', windows[windows.length - 1].endWord === 40000);
  check('6. an empty text produces zero windows (never a crash)', buildReaderWindows('').length === 0);
}

// ── running list carried between windows ──
{
  const words = Array.from({ length: 40000 }, (_, i) => `word${i}`).join(' ');
  const seenPrompts = [];
  let callCount = 0;
  const mockLLM = async (prompt) => {
    callCount += 1;
    seenPrompts.push(prompt);
    if (callCount === 1) {
      return { text: JSON.stringify({ flags: [], runningList: 'Mara meets Dov at the dock.' }), stopReason: 'end_turn' };
    }
    return { text: JSON.stringify({ flags: [], runningList: '' }), stopReason: 'end_turn' };
  };
  await runReaderPass({ fullText: words, callLLM: mockLLM, maxTokens: 4096 });
  check('7. the running list from window 1 is carried into window 2\'s prompt', seenPrompts[1].includes('Mara meets Dov at the dock.'));
  check('8. the first window\'s prompt carries no prior running list', !seenPrompts[0].includes('ALREADY SEEN SO FAR'));
}

// ── truncated window counted as FAILED, never zero ──
{
  const result = await runReaderPass({
    fullText: 'x'.repeat(200),
    callLLM: async () => ({ text: '{"flags": [{"location":"ch5 p2"', stopReason: 'max_tokens' }),
    maxTokens: 4096,
  });
  check('9. a truncated completion (stop_reason=max_tokens) is tracked as FAILED', result.windowResults[0].status === 'failed');
  check('10. the failure reason names the truncation, not a parse error', /truncated/.test(result.windowResults[0].reason));
  check('11. a truncated window contributes zero flags but is NOT reported as "0 flags found" (failedCount > 0)', result.failedCount === 1 && result.flags.length === 0);
}
{
  // contrast: a GENUINE zero-flag window (valid JSON, no truncation) is ok, not failed
  const result = await runReaderPass({
    fullText: 'x'.repeat(200),
    callLLM: async () => ({ text: JSON.stringify({ flags: [], runningList: '' }), stopReason: 'end_turn' }),
    maxTokens: 4096,
  });
  check('12. a genuine zero-flag window is status "ok", distinct from a failure', result.windowResults[0].status === 'ok' && result.failedCount === 0);
}
{
  const result = await runReaderPass({
    fullText: 'x'.repeat(200),
    callLLM: async () => ({ text: '{"flags":[]', stopReason: 'length' }),
    maxTokens: 4096,
  });
  check('12b. local OpenAI finish_reason=length is also tracked as a truncation failure', result.windowResults[0].status === 'failed' && /truncated/.test(result.windowResults[0].reason));
}

// ── all-windows-failed report labeling ──
{
  const result = await runReaderPass({
    fullText: 'x'.repeat(200),
    callLLM: async () => ({ text: '', stopReason: null }),
    maxTokens: 4096,
  });
  const report = formatReaderPassReport(result);
  check('13. an all-failed run is labeled "ALL WINDOWS FAILED — this is not a clean result"', report.includes('ALL WINDOWS FAILED — this is not a clean result'));
}
{
  const words = Array.from({ length: 40000 }, (_, i) => `word${i}`).join(' ');
  let n = 0;
  const result = await runReaderPass({
    fullText: words,
    callLLM: async () => {
      n += 1;
      if (n === 1) return { text: '', stopReason: null };
      return { text: JSON.stringify({ flags: [], runningList: '' }), stopReason: 'end_turn' };
    },
    maxTokens: 4096,
  });
  const report = formatReaderPassReport(result);
  check('14. a partial failure is labeled "PARTIAL FAILURE n/m"', new RegExp(`PARTIAL FAILURE 1/${result.windowCount}`).test(report));
}

// ── flags deduped across overlapping windows ──
{
  const words = Array.from({ length: 40000 }, (_, i) => `word${i}`).join(' ');
  let n = 0;
  const result = await runReaderPass({
    fullText: words,
    callLLM: async () => {
      n += 1;
      if (n === 1) {
        return { text: JSON.stringify({ flags: [{ location: 'ch1 p3', echoOf: '', what: 'intro', confidence: 'low' }], runningList: 'seen: intro' }), stopReason: 'end_turn' };
      }
      // window 2 (overlaps window 1's tail) reports the SAME flag again, plus one new one
      return { text: JSON.stringify({ flags: [{ location: 'ch1 p3', echoOf: '', what: 'intro (again)', confidence: 'low' }, { location: 'ch10 p1', echoOf: 'ch1 p3', what: 'Mara meets Dov again', confidence: 'high' }], runningList: 'updated' }), stopReason: 'end_turn' };
    },
    maxTokens: 4096,
  });
  check('15. the same (location, echoOf) flag reported by two overlapping windows dedupes to one', result.flags.filter((f) => f.location === 'ch1 p3').length === 1);
  check('16. a genuinely new flag from the second window survives dedup', result.flags.some((f) => f.location === 'ch10 p1'));
}

// ── requires an injected callLLM; enforces the max_tokens floor ──
check('17. runReaderPass requires an injected callLLM (never resolves a model itself)', await (async () => {
  try { await runReaderPass({ fullText: 'x' }); return false; }
  catch (err) { return /requires an injected callLLM/.test(err.message); }
})());
check('18. runReaderPass enforces max_tokens >= READER_PASS_MIN_MAX_TOKENS', await (async () => {
  try { await runReaderPass({ fullText: 'x', callLLM: async () => ({}), maxTokens: 100 }); return false; }
  catch (err) { return err.message.includes(String(READER_PASS_MIN_MAX_TOKENS)); }
})());

// ── local-only transport and local critic routing ──
check('19. the reader uses the local DeepSeek critic model', READER_PASS_MODEL === 'deepseek-r1-14b' && READER_PASS_TASK_TYPE === 'critique');
check('20. the saved transport label is explicitly local-loopback', READER_PASS_TRANSPORT === 'local-loopback');
check('21. loopback guard accepts 127.0.0.1', assertLoopbackServerUrl('http://127.0.0.1:5180') === 'http://127.0.0.1:5180');
check('22. loopback guard accepts localhost', assertLoopbackServerUrl('http://localhost:5180') === 'http://localhost:5180');
check('23. loopback guard rejects a remote host before any model call', (() => {
  try { assertLoopbackServerUrl('https://example.com'); return false; }
  catch (err) { return /local-only/.test(err.message); }
})());
check('24. loopback guard rejects a tailnet/LAN address', (() => {
  try { assertLoopbackServerUrl('http://100.95.98.74:5180'); return false; }
  catch (err) { return /local-only/.test(err.message); }
})());

{
  let captured = null;
  const callLLM = createLocalReaderCaller({
    callAgentWithMeta: async (args) => { captured = args; return { text: '{"flags":[],"runningList":""}', finishReason: 'stop' }; },
  });
  const response = await callLLM('fixture prompt', { maxTokens: 4096 });
  check('25. local adapter routes through critic with the locked local model', captured.taskType === 'critique' && captured.model === 'deepseek-r1-14b');
  check('26. local adapter requests structured JSON and maps finishReason', captured.jsonSchema?.required?.includes('flags') && response.stopReason === 'stop');
}

// ── bounded transient retry policy ──
check('26a. retry policy is bounded to one retry with a five-second backoff', READER_PASS_MAX_ATTEMPTS === 2 && READER_PASS_RETRY_DELAY_MS === 5000);
check('26b. transient local transport failures are retryable', isRetryableReaderError(new Error('Cannot reach llama serve at http://127.0.0.1:5180/llama: Error: fetch failed')));
check('26c. configuration and request errors are not retryable', !isRetryableReaderError(Object.assign(new Error('Bad request'), { status: 400 })));
{
  let calls = 0;
  let sleeps = 0;
  const callLLM = createLocalReaderCaller({
    callAgentWithMeta: async () => {
      calls += 1;
      if (calls === 1) throw new Error('fetch failed');
      return { text: '{"flags":[],"runningList":""}', finishReason: 'stop' };
    },
    retryDelayMs: 0,
    sleep: async () => { sleeps += 1; },
    log: () => {},
  });
  const response = await callLLM('fixture prompt', { maxTokens: 4096 });
  check('26d. a transient failure is retried once and the successful attempt count is returned', calls === 2 && sleeps === 1 && response.attempts === 2);
}
{
  let calls = 0;
  const callLLM = createLocalReaderCaller({
    callAgentWithMeta: async () => {
      calls += 1;
      throw Object.assign(new Error('Bad request'), { status: 400 });
    },
    retryDelayMs: 0,
    sleep: async () => {},
    log: () => {},
  });
  let attempts = null;
  try { await callLLM('fixture prompt', { maxTokens: 4096 }); }
  catch (err) { attempts = err.readerAttempts; }
  check('26e. a non-transient request failure is not retried', calls === 1 && attempts === 1);
}
{
  const result = await runReaderPass({
    fullText: 'fixture prose',
    callLLM: async () => ({ text: '{"flags":[],"runningList":""}', stopReason: 'stop', attempts: 2 }),
    maxTokens: 4096,
  });
  const report = formatReaderPassReport(result);
  check('26f. the core result records per-window attempts and aggregate retries', result.windowResults[0].attempts === 2 && result.retryCount === 1);
  check('26g. the human-readable report discloses retries', report.includes('Retries: 1'));
}

// ── source scan: the executable has no cloud URL/provider/key seam ──
{
  const SCRIPT_SRC = fs.readFileSync(new URL('../scripts/readerpass.mjs', import.meta.url), 'utf8');
  check('27. readerpass executable contains no cloud provider, remote URL, or cloud-key reference', !/anthropic|openrouter|https:\/\/|apiKey|API_KEY/i.test(SCRIPT_SRC));
  const configureIdx = SCRIPT_SRC.indexOf('configureHeadlessEnvironment({ token, baseUrl });');
  const depsIdx = SCRIPT_SRC.indexOf('const deps = await buildLocalReaderDeps();');
  check('28. headless environment is configured before localLLM is imported', configureIdx >= 0 && depsIdx > configureIdx);
}

// ── script command: manuscript assembly, report, saved asset, never Chapter/NovelProject writes ──
{
  const chapters = [
    { id: 'ch1', chapter_number: 1, content_md: 'Mara arrives at the dock and meets Dov.' },
    { id: 'ch2', chapter_number: 2, content_md: 'Dov confronts Mara about the missing ledger.' },
  ];
  const createdAssets = [];
  let chapterUpdateCalled = false;
  let novelProjectUpdateCalled = false;
  const store = {
    NovelProject: { get: async () => ({ id: 'proj-1', title: 'Fixture Book' }), update: async () => { novelProjectUpdateCalled = true; } },
    Chapter: { filter: async () => chapters, update: async () => { chapterUpdateCalled = true; } },
    PublishingAsset: { create: async (doc) => { createdAssets.push(doc); return { id: 'asset-1', ...doc }; } },
  };
  let capturedPrompt = null;
  const mockLLM = async (prompt) => { capturedPrompt = prompt; return { text: JSON.stringify({ flags: [], runningList: '' }), stopReason: 'end_turn' }; };

  const { result, report, asset } = await runReaderPassCommand({
    projectId: 'proj-1',
    store,
    runReaderPass,
    formatReaderPassReport,
    callLLM: mockLLM,
    log: () => {},
  });

  const saved = JSON.parse(createdAssets[0].content);
  check('29. the assembled manuscript includes every chapter\'s prose, in order', capturedPrompt.includes('Mara arrives at the dock') && capturedPrompt.includes('missing ledger') && capturedPrompt.indexOf('dock') < capturedPrompt.indexOf('ledger'));
  check('30. the report names the project title', report.startsWith('READER PASS — "Fixture Book"'));
  check('31. the report is saved as a PublishingAsset with kind \'reader_pass_report\'', createdAssets.length === 1 && createdAssets[0].kind === 'reader_pass_report');
  check('32. the saved result carries local transport, model, script, and retry-policy metadata', saved.windowCount === result.windowCount && saved.audit.transport === 'local-loopback' && saved.audit.model === 'deepseek-r1-14b' && saved.audit.scriptVersion === 'readerpass-script-v3-local-retry' && saved.audit.maxAttemptsPerWindow === 2 && saved.audit.retryDelayMs === 5000);
  check('33. runReaderPassCommand never calls Chapter.update or NovelProject.update', chapterUpdateCalled === false && novelProjectUpdateCalled === false);
}

// ── argument parsing ──
check('34. parseArgs parses --project', parseArgs(['--project', 'p1']).project === 'p1');

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
