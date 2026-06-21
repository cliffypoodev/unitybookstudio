// src/lib/integrationRetry.js — FULL REPLACEMENT for local Ollama

import { callAgent, callOllama, AGENT_MODELS, resolveAgent, searchWeb } from '@/lib/localLLM';
import { resolveWritingModel, normalizeWritingModel, logWritingModelUsage, isWritingTask } from '@/lib/writingModel';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Find the largest balanced { ... } span in a string.
 * Returns the substring or null if no balanced pair exists.
 */
function findLargestBalancedJson(text) {
  let best = null;
  let bestLen = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (escape) { escape = false; continue; }
      if (ch === '\\') { if (inString) escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const span = text.slice(i, j + 1);
          if (span.length > bestLen) { best = span; bestLen = span.length; }
          break;
        }
      }
    }
  }
  return best;
}

function attemptJsonSalvage(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  // Strip thinking-model artifacts that precede the real JSON
  s = s.replace(/\\boxed\{[^}]*\}/g, '');          // \boxed{} from reasoning models
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');  // <think>...</think> blocks
  s = s.replace(/<\/think>/gi, '');                 // orphaned </think> tags
  s = s.trim();
  s = s.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // ── Guard: pure preamble with no JSON at all → return null so retry fires ──
  if (s.indexOf('{') === -1) {
    console.warn('[JSON-SALVAGE] No opening brace found — pure preamble, returning null');
    return null;
  }

  // ── Preamble stripping: prefer the largest balanced {...} span ──
  // If the first '{' is embedded in a prose sentence (text before it contains
  // sentence-like words), find the largest balanced JSON object instead of
  // the naive first-to-last slice which can capture preamble fragments.
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  const textBeforeFirstBrace = s.slice(0, firstBrace).trim();
  const hasProseBeforeBrace = textBeforeFirstBrace.length > 10 && /[a-zA-Z]{3,}/.test(textBeforeFirstBrace);

  let candidate;
  if (hasProseBeforeBrace) {
    // Prose before the first brace — likely preamble. Find the largest balanced JSON.
    const largest = findLargestBalancedJson(s);
    candidate = largest || (firstBrace !== -1 && lastBrace > firstBrace ? s.slice(firstBrace, lastBrace + 1) : s);
  } else {
    candidate = firstBrace !== -1 && lastBrace > firstBrace ? s.slice(firstBrace, lastBrace + 1) : s;
  }

  const fixStringValues = (str) => str.replace(/"((?:[^"\\]|\\.)*)"/gs, (match, inner) => {
    return '"' + inner.replace(/(?<!\\)\n/g, '\\n').replace(/(?<!\\)\r/g, '\\r').replace(/(?<!\\)\t/g, '\\t') + '"';
  });
  const closeTruncated = (str) => {
    let f = str.replace(/,\s*"(?:[^"\\]|\\.)*$/s, '').replace(/,\s*"[^"]*"\s*:\s*"(?:[^"\\]|\\.)*$/s, '').replace(/,\s*"[^"]*"\s*:\s*$/s, '').replace(/,\s*$/s, '');
    let opens = 0, openArr = 0;
    for (const c of f) { if (c === '{') opens++; else if (c === '}') opens--; else if (c === '[') openArr++; else if (c === ']') openArr--; }
    while (openArr > 0) { f += ']'; openArr--; }
    while (opens > 0) { f += '}'; opens--; }
    return f;
  };

  // Try parsing the candidate first, then fall back to the simple first-to-last slice
  const candidates = [candidate];
  const simpleSlice = firstBrace !== -1 && lastBrace > firstBrace ? s.slice(firstBrace, lastBrace + 1) : null;
  if (simpleSlice && simpleSlice !== candidate) candidates.push(simpleSlice);

  for (const c of candidates) {
    const attempts = [
      () => JSON.parse(c),
      () => JSON.parse(c.replace(/,\s*([}\]])/g, '$1')),
      () => JSON.parse(fixStringValues(c).replace(/,\s*([}\]])/g, '$1')),
      () => JSON.parse(closeTruncated(fixStringValues(c).replace(/,\s*([}\]])/g, '$1'))),
      () => { let x = c.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ''); x = fixStringValues(x).replace(/,\s*([}\]])/g, '$1'); return JSON.parse(closeTruncated(x)); },
      () => { let n = c.replace(/[^\x20-\x7e\n\r\t]/g, ''); n = fixStringValues(n).replace(/,\s*([}\]])/g, '$1'); return JSON.parse(closeTruncated(n)); },
    ];
    for (const attempt of attempts) { try { return attempt(); } catch {} }
  }
  return null;
}


function isRetryableError(error) {
  const message = error?.message || '';
  const status = error?.response?.status || error?.status;
  if (status === 403 || /not have access/i.test(message) || /auth_required/i.test(message)) return false;
  return /network error/i.test(message) || /timeout/i.test(message) || /Cannot reach Ollama/i.test(message) || /rate limit/i.test(message) || /abort/i.test(message) || status === 422 || status === 429 || status === 502 || status === 503 || status === 504 || (status >= 500 && status < 600);
}

function shouldForcePrimaryWritingModel(payload = {}) {
  if (payload.force_primary_writing_model === false) return false;
  if (payload.add_context_from_internet) return false;
  if (payload.research === true) return false;
  if (payload.task_family === 'research') return false;
  if (payload.task_type === 'research') return false;
  return isWritingTask(payload.task_type || payload.task || payload.mode || payload.intent || payload.generation_type || 'writing');
}

function normalizeMaxTokens(requested) {
  const parsed = Number(requested || 0);
  return parsed > 0 ? parsed : 8192;
}

function inferTaskType(payload) {
  if (payload.task_type) return payload.task_type;
  if (payload.task) return payload.task;
  if (payload.model === 'gemini_3_flash') return 'critique';
  return 'prose';
}

// JSON-parse retry: short backoff suitable for local models (no 20-second waits).
const JSON_RETRY_MAX = 3;
const JSON_RETRY_DELAYS = [500, 1500, 3000];

export async function invokeLLMWithRetry(payload, maxAttempts = 3) {
  const RETRY_DELAYS = [5000, 10000, 20000];
  let lastError;
  const taskType = inferTaskType(payload);
  const maxTokens = normalizeMaxTokens(payload.max_tokens);
  const context = payload.log_context || taskType;
  logWritingModelUsage(context);

  if (payload.add_context_from_internet) {
    console.warn('[LOCAL-LLM] Web search requested but not available locally. Proceeding without web context.');
  }

  // Guard: if the caller passed the primary writing model (ghostwriter) as an explicit
  // model, but the task_type resolves to a non-ghostwriter agent (critic, polisher, etc.),
  // drop the model override so callAgent uses the agent's own model from AGENT_MODELS.
  let resolvedModel = payload.model || null;
  if (resolvedModel) {
    const agentKey = resolveAgent(taskType, payload._project || payload.project || null);
    const agentModel = AGENT_MODELS[agentKey];
    if (resolvedModel === AGENT_MODELS.ghostwriter && agentModel && agentModel !== AGENT_MODELS.ghostwriter) {
      console.log(`[LLM-RETRY] Dropping explicit model '${resolvedModel}' for task '${taskType}' — agent '${agentKey}' uses '${agentModel}'`);
      resolvedModel = null;
    }
  }
  console.log(`[LLM-RETRY] taskType=${taskType} model=${resolvedModel || 'agent-default'} context=${context}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const callParams = {
        prompt: payload.prompt,
        taskType,
        model: resolvedModel,
        project: payload._project || payload.project || null,
        temperature: payload.temperature,
        maxTokens,
        jsonSchema: payload.response_json_schema || null,
      };

      if (payload.response_json_schema) {
        // ── JSON-parse retry loop: re-call the model on malformed responses ──
        let jsonLastError;
        for (let jsonAttempt = 1; jsonAttempt <= JSON_RETRY_MAX; jsonAttempt++) {
          const rawText = await callAgent(callParams);
          const parsed = attemptJsonSalvage(rawText);
          if (parsed) return parsed;

          console.warn(`[LLM-JSON-RETRY] JSON salvage failed (attempt ${jsonAttempt}/${JSON_RETRY_MAX}). Raw (first 300): ${(rawText || '').substring(0, 300)}`);
          jsonLastError = new Error('LLM response was not valid JSON');
          jsonLastError.status = 422;
          jsonLastError.response = { status: 422 };

          if (jsonAttempt < JSON_RETRY_MAX) {
            const jsonDelay = JSON_RETRY_DELAYS[jsonAttempt - 1] || 1500;
            console.log(`[LLM-JSON-RETRY] Retrying JSON call in ${jsonDelay}ms...`);
            await wait(jsonDelay);
          }
        }
        // All JSON attempts exhausted — throw so outer loop can retry (or propagate)
        throw jsonLastError;
      }

      // Non-JSON (prose) path — no JSON retry needed
      const rawText = await callAgent(callParams);
      return rawText;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxAttempts) break;
      const delay = RETRY_DELAYS[attempt - 1] || 20000;
      console.warn(`[LOCAL-LLM Retry] Attempt ${attempt}/${maxAttempts} failed: ${error?.message || ''}. Retrying in ${delay / 1000}s...`);
      await wait(delay);
    }
  }
  throw lastError;
}

function buildGroundingBlock(resultsByQuery) {
  const lines = [
    '=== REAL WEB SEARCH RESULTS — YOUR ONLY ALLOWED SOURCES ===',
    'Use ONLY the results below. Every URL you cite MUST be one of these exact URLs.',
    'If a fact is not supported by these results, do NOT present it as verified —',
    'mark it UNVERIFIED or omit it. Invent nothing. Never output a URL not listed here.',
    '',
  ];
  let i = 1;
  for (const { query, results } of resultsByQuery) {
    lines.push(`SEARCH: ${query}`);
    if (!results.length) lines.push('  (no results)');
    for (const r of results) {
      lines.push(`  [${i}] ${r.title}`, `      URL: ${r.url}`, `      ${r.snippet}`);
      i++;
    }
    lines.push('');
  }
  lines.push('=== END SEARCH RESULTS ===', '');
  return lines.join('\n');
}

export async function invokeLLMForResearch(payload) {
  const maxAttempts = 2;
  let lastError;
  let prompt = payload.prompt;

  const queries = Array.isArray(payload.searchQueries)
    ? payload.searchQueries.filter(Boolean) : [];
  if (queries.length) {
    const resultsByQuery = [];
    for (const q of queries) {
      resultsByQuery.push({ query: q, results: await searchWeb(q, 5) });
      await wait(300);
    }
    prompt = buildGroundingBlock(resultsByQuery) + '\n' + prompt;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const rawText = await callAgent({ prompt, taskType: 'research', temperature: 0.3, maxTokens: normalizeMaxTokens(payload.max_tokens), jsonSchema: payload.response_json_schema || null });
      if (payload.response_json_schema) { const parsed = attemptJsonSalvage(rawText); if (parsed) return parsed; throw new Error('Research LLM response was not valid JSON'); }
      return rawText;
    } catch (error) { lastError = error; if (!isRetryableError(error) || attempt === maxAttempts) break; await wait(3000); }
  }
  throw lastError;
}

export async function invokeResearchLLM(payload, maxAttempts = 3) {
  let lastError;
  let prompt = payload.prompt;

  const queries = Array.isArray(payload.searchQueries)
    ? payload.searchQueries.filter(Boolean) : [];
  if (queries.length) {
    const resultsByQuery = [];
    for (const q of queries) {
      resultsByQuery.push({ query: q, results: await searchWeb(q, 5) });
      await wait(300);
    }
    prompt = buildGroundingBlock(resultsByQuery) + '\n' + prompt;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const rawText = await callAgent({ prompt, taskType: 'research', temperature: 0.3, maxTokens: 8192, jsonSchema: payload.response_json_schema || null });
      if (payload.response_json_schema) { const parsed = attemptJsonSalvage(rawText); if (parsed) return parsed; throw new Error('Research response was not valid JSON'); }
      return rawText;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxAttempts) throw error;
      const isRateLimit = error?.status === 429 || /rate limit/i.test(error?.message || '');
      await wait(Math.min((isRateLimit ? 5000 : 1500) * Math.pow(2, attempt - 1), 30000));
    }
  }
  throw lastError;
}

export async function generateImageWithRetry(payload, maxAttempts = 2) {
  const { generateImageLocal } = await import('@/lib/localImageGen');
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await generateImageLocal({
        prompt: payload.prompt,
        size: payload.size || '768x1152',
        quality: payload.quality,
      });
      return result;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      console.warn(`[IMAGE] Attempt ${attempt} failed: ${error?.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw lastError;
}

// Exported for testing
export { attemptJsonSalvage as _attemptJsonSalvage, isRetryableError as _isRetryableError };
