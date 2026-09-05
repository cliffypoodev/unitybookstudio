// LOCALLLM-NODE-1 acceptance battery — localLLM.js's '/llama' base URL only
// resolves same-origin in a browser (or via Vite's dev proxy); a headless
// Node process has no origin to resolve it against (confirmed live,
// 2026-09-05: `fetch` threw "Failed to parse URL from /llama/v1/chat/
// completions" running scripts/beats-backfill.mjs against a real project).
//
// Every check here needs its own FRESH module evaluation — LLAMA_BASE_URL/
// NODE_RUNNER_TOKEN are computed once at import time from `typeof window`
// and process.env, so re-importing the cached instance would silently reuse
// whatever the FIRST import saw. Cache-busting query strings on the
// specifier (Node treats each distinct resolved URL as its own module
// instance) get a fresh evaluation per scenario without needing a
// subprocess. LLAMA_BASE_URL itself isn't exported; AGENT_ENDPOINTS.
// ghostwriter (every role now points at the same LLAMA_BASE_URL constant,
// not a hardcoded '/llama' literal) is the exported proxy for it.

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const MODULE_URL = new URL('../src/lib/localLLM.js', import.meta.url).href;
const fresh = (scenario) => import(`${MODULE_URL}?scenario=${scenario}`);

// ── 1-2: Node path (this battery's own natural environment — no `window`) ──
{
  delete process.env.UBS_SERVER_URL;
  const mod = await fresh('node-default');
  check('1. Node path resolves to an absolute URL (not the bare relative /llama)', /^https?:\/\//.test(mod.AGENT_ENDPOINTS.ghostwriter));
  check('2. Node path defaults to http://127.0.0.1:5180/llama when UBS_SERVER_URL is unset', mod.AGENT_ENDPOINTS.ghostwriter === 'http://127.0.0.1:5180/llama');
}
{
  process.env.UBS_SERVER_URL = 'http://127.0.0.1:9999';
  const mod = await fresh('node-custom-url');
  check('3. Node path honors UBS_SERVER_URL when set', mod.AGENT_ENDPOINTS.ghostwriter === 'http://127.0.0.1:9999/llama');
  delete process.env.UBS_SERVER_URL;
}

// ── 4: browser path is byte-identical (`window` defined at import time) ──
{
  globalThis.window = { location: { href: 'http://localhost:5180/' } };
  const mod = await fresh('browser');
  delete globalThis.window;
  check('4. browser path is byte-identical: LLAMA_BASE_URL stays the literal \'/llama\'', mod.AGENT_ENDPOINTS.ghostwriter === '/llama');
}

// ── 5: every agent role points at the SAME endpoint constant (the bug that made
// resolving LLAMA_BASE_URL for Node a no-op: all nine were hardcoded literals) ──
{
  const mod = await fresh('all-roles');
  const endpoints = Object.values(mod.AGENT_ENDPOINTS);
  check('5. every AGENT_ENDPOINTS role resolves to the same base (all reference LLAMA_BASE_URL, none hardcoded)', endpoints.every((e) => e === endpoints[0]) && /^https?:\/\//.test(endpoints[0]));
}

// ── 6-7: runner-token header present only under Node with a token set ──
{
  process.env.UBS_RUNNER_TOKEN = 'test-runner-token-123';
  const mod = await fresh('node-with-token');
  delete process.env.UBS_RUNNER_TOKEN;

  let capturedHeaders = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    capturedHeaders = opts?.headers || {};
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
    };
  };
  try {
    await mod.callLlamaWithMeta({ model: 'test-model', prompt: 'hi', maxTokens: 32 });
  } finally {
    globalThis.fetch = originalFetch;
  }
  check('6. the runner-token header is present, with the right value, when a token is provided', capturedHeaders?.['x-ubs-runner-token'] === 'test-runner-token-123');
}
{
  const mod = await fresh('node-no-token');

  let capturedHeaders = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    capturedHeaders = opts?.headers || {};
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
    };
  };
  try {
    await mod.callLlamaWithMeta({ model: 'test-model', prompt: 'hi', maxTokens: 32 });
  } finally {
    globalThis.fetch = originalFetch;
  }
  check('7. no runner-token header is sent when no token is provided (byte-identical to before this change)', !('x-ubs-runner-token' in (capturedHeaders || {})));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
