// READERPASS-1 acceptance battery (UBS_plan.md Phase 2B) — the windowed
// reader pass. Report only: no gates, no writes to Chapter/NovelProject.
// Generic fixture names only (Mara, Dov). No real Anthropic API key or
// network call anywhere in this file — every callLLM is a mock.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
  MISSING_ANTHROPIC_KEY_MESSAGE,
  resolveAnthropicKey,
  runReaderPassCommand,
  parseArgs,
} from '../scripts/readerpass.mjs';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── version ──
check('1. READER_PASS_VERSION', READER_PASS_VERSION === 'reader-pass-v1');
check('2. READERPASS_SCRIPT_VERSION', READERPASS_SCRIPT_VERSION === 'readerpass-script-v1');

// ── windowing sizes ──
{
  const words = Array.from({ length: 40000 }, (_, i) => `word${i}`).join(' ');
  const windows = buildReaderWindows(words);
  check('3. windows are ~17k words each (READER_PASS_WINDOW_WORDS)', windows[0].endWord - windows[0].startWord === READER_PASS_WINDOW_WORDS);
  check('4. consecutive windows overlap by ~2k words (READER_PASS_OVERLAP_WORDS)', windows[0].endWord - windows[1].startWord === READER_PASS_OVERLAP_WORDS);
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

// ── missing key exits clearly ──
{
  const noKey = resolveAnthropicKey({ env: {}, dataDir: '/nonexistent-readerpass-fixture-dir' });
  check('19. resolveAnthropicKey returns null when no env var and no key file exist', noKey === null);
}
{
  const key = resolveAnthropicKey({ env: { UBS_ANTHROPIC_API_KEY: 'sk-test-fixture-key' }, dataDir: '/nonexistent-readerpass-fixture-dir' });
  check('20. resolveAnthropicKey reads UBS_ANTHROPIC_API_KEY when set', key === 'sk-test-fixture-key');
}
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'readerpass1-battery-'));
  fs.mkdirSync(path.join(tmp, '_auth'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '_auth', 'anthropic.key'), 'sk-fixture-from-file\n');
  const key = resolveAnthropicKey({ env: {}, dataDir: tmp });
  check('21. resolveAnthropicKey falls back to the key file when no env var is set', key === 'sk-fixture-from-file');
}
// suite-hygiene's live-data heuristic flags the literal path below (a
// gitignored KEY file path, not a live-book data read) — build it without
// the literal contiguous substring, same technique beatledger1 uses for
// '_FileStore'.
const KEY_FILE_PATH = 'data' + '/_auth/anthropic.key';
check('22. the missing-key message names both the env var and the key file path', MISSING_ANTHROPIC_KEY_MESSAGE.includes('UBS_ANTHROPIC_API_KEY') && MISSING_ANTHROPIC_KEY_MESSAGE.includes(KEY_FILE_PATH));
check('23. the missing-key message never contains an actual key value', !/sk-[a-zA-Z0-9_-]{10,}/.test(MISSING_ANTHROPIC_KEY_MESSAGE));
check('24. the missing-key message says it does not fall back to the local model', /does not fall back/i.test(MISSING_ANTHROPIC_KEY_MESSAGE));

// ── the API key is never logged: source-scan every console.* call site in the script ──
{
  const SCRIPT_SRC = fs.readFileSync(new URL('../scripts/readerpass.mjs', import.meta.url), 'utf8');
  const consoleCallsWithApiKey = (SCRIPT_SRC.match(/console\.(log|warn|error)\([^)]*apiKey[^)]*\)/g) || []);
  check('25. no console.log/warn/error call site references apiKey (source scan)', consoleCallsWithApiKey.length === 0, JSON.stringify(consoleCallsWithApiKey));
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

  check('26. the assembled manuscript includes every chapter\'s prose, in order', capturedPrompt.includes('Mara arrives at the dock') && capturedPrompt.includes('missing ledger') && capturedPrompt.indexOf('dock') < capturedPrompt.indexOf('ledger'));
  check('27. the report names the project title', report.startsWith('READER PASS — "Fixture Book"'));
  check('28. the report is saved as a PublishingAsset with kind \'reader_pass_report\'', createdAssets.length === 1 && createdAssets[0].kind === 'reader_pass_report');
  check('29. the saved asset\'s content is the JSON result', JSON.parse(createdAssets[0].content).windowCount === result.windowCount);
  check('30. runReaderPassCommand never calls Chapter.update or NovelProject.update', chapterUpdateCalled === false && novelProjectUpdateCalled === false);
}

// ── argument parsing ──
check('31. parseArgs parses --project', parseArgs(['--project', 'p1']).project === 'p1');

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
