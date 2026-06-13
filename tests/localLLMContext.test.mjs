// tests/localLLMContext.test.mjs — Verifies num_ctx is sent in every Ollama request
// Uses static source analysis + fetch mock to confirm the context window fix.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRoot = path.resolve(__dirname, '..', 'src');

/* ═══════════════════════════════════════════════════════════════════════════
 * Test harness
 * ═════════════════════════════════════════════════════════════════════════ */

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    failures.push(name);
    console.error('  ❌ ' + name + ': ' + e.message);
  }
}

console.log('\n=== LOCAL LLM CONTEXT WINDOW TESTS ===\n');

/* ═══════════════════════════════════════════════════════════════════════════
 * Static source analysis
 * ═════════════════════════════════════════════════════════════════════════ */

const llmSrc = fs.readFileSync(path.resolve(srcRoot, 'lib', 'localLLM.js'), 'utf8');

await test('1. AGENT_NUM_CTX is exported and equals 16384', () => {
  const match = llmSrc.match(/export\s+const\s+AGENT_NUM_CTX\s*=\s*(\d+)/);
  assert(match, 'AGENT_NUM_CTX should be exported');
  assert.strictEqual(parseInt(match[1]), 16384, `Expected 16384, got ${match[1]}`);
});

await test('2. AGENT_NUM_CTX_OVERRIDES is exported', () => {
  assert(llmSrc.includes('export const AGENT_NUM_CTX_OVERRIDES'),
    'AGENT_NUM_CTX_OVERRIDES should be exported');
});

await test('3. callOllama options include num_ctx', () => {
  // Find the JSON.stringify call in callOllama
  const bodyMatch = llmSrc.match(/JSON\.stringify\(\{[^}]*options:\s*\{([^}]+)\}/);
  assert(bodyMatch, 'Should find options object in JSON.stringify');
  assert(bodyMatch[1].includes('num_ctx'),
    'options should include num_ctx, got: ' + bodyMatch[1].trim());
});

await test('4. callAgent resolves numCtx from overrides', () => {
  assert(llmSrc.includes('AGENT_NUM_CTX_OVERRIDES[agentKey]'),
    'callAgent should check AGENT_NUM_CTX_OVERRIDES for per-agent override');
  assert(llmSrc.includes('numCtx'),
    'callAgent should pass numCtx to callOllama');
});

await test('5. callOllama signature accepts numCtx parameter', () => {
  const sig = llmSrc.match(/async function callOllama\(\{([^}]+)\}\)/);
  assert(sig, 'Should find callOllama signature');
  assert(sig[1].includes('numCtx'),
    'callOllama destructured params should include numCtx');
});

/* ═══════════════════════════════════════════════════════════════════════════
 * Behavioral: fetch mock — verify actual request body
 * ═════════════════════════════════════════════════════════════════════════ */

// Mock fetch globally before importing the module
const capturedRequests = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, opts) => {
  if (typeof url === 'string' && url.includes('/api/chat')) {
    const body = JSON.parse(opts.body);
    capturedRequests.push({ url, body });
    // Return a fake successful response
    return {
      ok: true,
      json: async () => ({ message: { content: 'Mock response' } }),
    };
  }
  // Pass through non-Ollama requests
  return originalFetch(url, opts);
};

try {
  // Dynamic import so our mock fetch is in place
  const { callAgent, AGENT_NUM_CTX } = await import('../src/lib/localLLM.js');

  await test('6. Architect call sends num_ctx=16384 in request body', async () => {
    capturedRequests.length = 0;
    await callAgent({ prompt: 'Test prompt', taskType: 'beats' });
    assert(capturedRequests.length >= 1, 'Should have captured a fetch call');
    const req = capturedRequests[0];
    assert.strictEqual(req.body.options.num_ctx, AGENT_NUM_CTX,
      `Expected num_ctx=${AGENT_NUM_CTX}, got ${req.body.options.num_ctx}`);
  });

  await test('7. Ghostwriter call sends num_ctx=16384 in request body', async () => {
    capturedRequests.length = 0;
    await callAgent({ prompt: 'Test prompt', taskType: 'prose' });
    assert(capturedRequests.length >= 1, 'Should have captured a fetch call');
    const req = capturedRequests[0];
    assert.strictEqual(req.body.options.num_ctx, AGENT_NUM_CTX,
      `Expected num_ctx=${AGENT_NUM_CTX}, got ${req.body.options.num_ctx}`);
  });

  await test('8. Critic call sends num_ctx=16384 in request body', async () => {
    capturedRequests.length = 0;
    await callAgent({ prompt: 'Test prompt', taskType: 'critique' });
    assert(capturedRequests.length >= 1, 'Should have captured a fetch call');
    const req = capturedRequests[0];
    assert.strictEqual(req.body.options.num_ctx, AGENT_NUM_CTX,
      `Expected num_ctx=${AGENT_NUM_CTX}, got ${req.body.options.num_ctx}`);
  });

  await test('9. Polisher call sends num_ctx=16384 in request body', async () => {
    capturedRequests.length = 0;
    await callAgent({ prompt: 'Test prompt', taskType: 'polish' });
    assert(capturedRequests.length >= 1, 'Should have captured a fetch call');
    const req = capturedRequests[0];
    assert.strictEqual(req.body.options.num_ctx, AGENT_NUM_CTX,
      `Expected num_ctx=${AGENT_NUM_CTX}, got ${req.body.options.num_ctx}`);
  });

  await test('10. Researcher call sends num_ctx=16384 in request body', async () => {
    capturedRequests.length = 0;
    await callAgent({ prompt: 'Test prompt', taskType: 'research' });
    assert(capturedRequests.length >= 1, 'Should have captured a fetch call');
    const req = capturedRequests[0];
    assert.strictEqual(req.body.options.num_ctx, AGENT_NUM_CTX,
      `Expected num_ctx=${AGENT_NUM_CTX}, got ${req.body.options.num_ctx}`);
  });

  await test('11. Request body preserves temperature and num_predict alongside num_ctx', async () => {
    capturedRequests.length = 0;
    await callAgent({ prompt: 'Test', taskType: 'prose', maxTokens: 4096 });
    const opts = capturedRequests[0].body.options;
    assert.strictEqual(opts.num_ctx, AGENT_NUM_CTX, 'num_ctx present');
    assert.strictEqual(opts.num_predict, 4096, 'num_predict preserved');
    assert.strictEqual(typeof opts.temperature, 'number', 'temperature preserved');
  });

} finally {
  globalThis.fetch = originalFetch;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SUMMARY
 * ═════════════════════════════════════════════════════════════════════════ */

console.log(`\n${'═'.repeat(60)}`);
console.log(`LOCAL LLM CONTEXT: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('All local LLM context window tests passed! ✅');
}
