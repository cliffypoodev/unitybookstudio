// src/lib/localLLM.js
// Unity Book Studio — Local LLM Engine
// Sends all LLM calls to a local Ollama server.

const LLAMA_BASE_URL = 'http://127.0.0.1:8080';

const SEARCH_BRIDGE_URL = 'http://127.0.0.1:8899/search';

export async function searchWeb(query, n = 5) {
  try {
    const res = await fetch(SEARCH_BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, n }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch (e) {
    console.warn('[SEARCH-BRIDGE] search failed:', e?.message || e);
    return [];
  }
}

export const AGENT_MODELS = {
  ghostwriter:       'HauhauCS/Qwen3.6-27B-Uncensored-HauhauCS-Aggressive:Q5_K_P',   // fiction prose (all non-nonfiction)
  ghostwriter_nsfw:  'HauhauCS/Qwen3.6-27B-Uncensored-HauhauCS-Aggressive:Q5_K_P',   // adult fiction — same uncensored model
  architect:         'deepseek-r1-32b',                                  // fiction outlines/bibles (reasoning model)
  researcher:        'phi4',                                             // factual gathering
  critic:            'deepseek-r1-14b',                                  // QA/critique (faster R1)
  polisher:          'unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q6_K_XL', // faithful line edits
  nonfiction_writer: 'HauhauCS/Qwen3.6-27B-Uncensored-HauhauCS-Aggressive:Q5_K_P', // MODELFIX-3: dense prose-tuned 27B; gates handle integrity
};

export const AGENT_TEMPERATURES = {
  ghostwriter:      0.75,
  ghostwriter_nsfw: 0.75,
  architect:        0.6,
  researcher:       0.3,
  critic:           0.4,
  polisher:         0.3,
  nonfiction_writer: 0.4,
};

// Context window size sent to Ollama via options.num_ctx on every request.
// Ollama reloads the model with this context size per-request.
export const AGENT_NUM_CTX = 32768;

// Per-agent overrides (optional). Agents not listed use AGENT_NUM_CTX.
export const AGENT_NUM_CTX_OVERRIDES = {
  // e.g. researcher: 8192,
};

const AGENT_SYSTEM_PROMPTS = {
  ghostwriter: '',
  ghostwriter_nsfw: '',
  architect: '',
  researcher: '',
  critic: '',
  polisher: '',
  nonfiction_writer: '',
};

export async function callOllama({ model, prompt, systemPrompt, temperature = 0.7, maxTokens = 8192, jsonSchema = null, numCtx = AGENT_NUM_CTX }) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

  let userContent = prompt;
  if (jsonSchema) {
    userContent += '\n\nRespond ONLY with valid JSON matching this schema. No markdown fences. No preamble. Just the JSON object.\n\nSchema:\n' + JSON.stringify(jsonSchema, null, 2);
  }
  // Suppress Qwen3 thinking mode so we get answer text in content, not reasoning_content.
  userContent += ' /no_think';
  messages.push({ role: 'user', content: userContent });

  // MODELFIX-2: reasoning models (DeepSeek-R1 family) spend chain-of-thought tokens
  // from the same max_tokens budget as the answer. Grant thinking headroom so the
  // prose share stays intact; the <think> block is stripped by the safety net below.
  const isReasoningModel = /deepseek-r1/i.test(String(model || ''));
  const effectiveMaxTokens = isReasoningModel ? maxTokens + 4096 : maxTokens;

  const requestBody = {
    model,
    messages,
    stream: false,
    temperature,
    max_tokens: effectiveMaxTokens,
  };

  let response;
  try {
    response = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(1200000),
    });
  } catch (fetchErr) {
    const isTimeout = fetchErr?.name === 'TimeoutError' || fetchErr?.name === 'AbortError';
    const err = new Error(isTimeout
      ? 'llama serve request timed out after 20 minutes.'
      : `Cannot reach llama serve at ${LLAMA_BASE_URL}. Is it running? Error: ${fetchErr?.message || 'unknown'}`);
    err.status = isTimeout ? 504 : 503;
    err.response = { status: err.status };
    throw err;
  }

  if (!response.ok) {
    let errMessage = `llama serve returned HTTP ${response.status}`;
    try { const errBody = await response.json(); errMessage = errBody?.error?.message || errBody?.error || errMessage; } catch {}
    const err = new Error(errMessage);
    err.status = response.status;
    err.response = { status: response.status };
    throw err;
  }

  const data = await response.json();
  let text = data?.choices?.[0]?.message?.content || '';

  // Safety net: strip any thinking-model artifacts if they leak through.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/<\/think>/gi, '');
  text = text.replace(/\\boxed\{[^}]*\}/g, '');
  text = text.trim();

  return text;
}

export function resolveAgent(taskType, project = null) {
  const t = String(taskType || '').toLowerCase();
  const isNSFW = project && (
    Number(project.spice_level || 0) >= 3 ||
    /erotic|erotica|smut|bdsm|explicit/i.test(project.genre || '') ||
    /erotic|erotica|smut|bdsm|explicit/i.test(project.subgenre || '')
  );

  // Nonfiction routes its fact-critical tasks (prose + foundation/outline) to an
  // instruction-following model that honors source fidelity, instead of the creative
  // ghostwriter, which invents documents and evidence to make the prose compelling.
  const isNonfiction = project && String(project.book_type || '').toLowerCase() === 'nonfiction';
  if (isNonfiction && ['prose', 'prose_continuation', 'draft', 'chapter', 'scene', 'rewrite', 'manuscript', 'foundation', 'chapter_plan', 'outline', 'beats', 'bibliography'].includes(t))
    return 'nonfiction_writer';

  if (['prose', 'prose_continuation', 'draft', 'chapter', 'scene', 'rewrite', 'manuscript'].includes(t))
    return isNSFW ? 'ghostwriter_nsfw' : 'ghostwriter';
  if (['foundation', 'chapter_plan', 'outline', 'transform', 'beats', 'ideas', 'publishing', 'bibliography'].includes(t))
    return 'architect';
  if (['judge', 'evaluate', 'scan', 'critique', 'compare', 'analytics'].includes(t))
    return 'critic';
  if (t === 'research' || t === 'fiction_research')
    return 'researcher';
  if (['polish', 'proofread', 'fix', 'cleanup'].includes(t))
    return 'polisher';

  return isNSFW ? 'ghostwriter_nsfw' : 'ghostwriter';
}

export async function callAgent({ prompt, taskType = 'prose', project = null, temperature, maxTokens = 8192, jsonSchema = null, model = null, systemPromptOverride = null }) {
  const agentKey = resolveAgent(taskType, project);
  const resolvedModel = model || AGENT_MODELS[agentKey];
  const resolvedTemp = temperature ?? AGENT_TEMPERATURES[agentKey] ?? 0.7;
  const systemPrompt = systemPromptOverride || AGENT_SYSTEM_PROMPTS[agentKey] || '';
  const numCtx = AGENT_NUM_CTX_OVERRIDES[agentKey] ?? AGENT_NUM_CTX;

  console.log(`[LOCAL-LLM] Agent: ${agentKey} | Model: ${resolvedModel} | Temp: ${resolvedTemp} | Ctx: ${numCtx} | Task: ${taskType}`);

  return callOllama({ model: resolvedModel, prompt, systemPrompt, temperature: resolvedTemp, maxTokens, jsonSchema, numCtx });
}

export async function checkOllamaHealth() {
  try {
    const response = await fetch(`${LLAMA_BASE_URL}/v1/models`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { healthy: false, error: `HTTP ${response.status}` };
    const data = await response.json();
    const models = (data.data || data.models || []).map(m => m.id || m.name);
    return { healthy: true, models, hasGhostwriter: models.some(m => m.includes(AGENT_MODELS.ghostwriter)), hasNSFW: models.some(m => m.includes(AGENT_MODELS.ghostwriter_nsfw)) };
  } catch (err) {
    return { healthy: false, error: err?.message || 'Cannot reach llama serve' };
  }
}
