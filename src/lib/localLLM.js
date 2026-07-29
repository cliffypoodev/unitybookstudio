// src/lib/localLLM.js
import { stripModelControlTokens } from './modelLeakGuard.js';
// Sends all LLM calls to a local Ollama server.

// NETFIX-1: same-origin path proxied by vite to the Studio's llama.cpp —
// works identically on localhost and on remote devices over Tailscale.
const LLAMA_BASE_URL = '/llama';

const SEARCH_BRIDGE_URL = '/search-bridge/search';

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
  ghostwriter:       'qwen3.6-35b-uncensored',   // fiction prose (all non-nonfiction)
  ghostwriter_nsfw:  'qwen3.6-35b-uncensored',   // adult fiction — same uncensored model
  architect:         'deepseek-r1-32b',                                  // fiction outlines/bibles (reasoning model)
  researcher:        'phi4',                                             // factual gathering
  critic:            'deepseek-r1-14b',                                  // QA/critique (faster R1)
  polisher:          'unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q6_K_XL', // faithful line edits
  ideas_chat:        'unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q6_K_XL', // CHATFIX-1: chat assistants — fast MoE instruct, strict format adherence
  nonfiction_writer: 'HauhauCS/Qwen3.6-27B-Uncensored-HauhauCS-Aggressive:Q5_K_P', // MODELFIX-3: dense prose-tuned 27B; gates handle integrity
};

export const AGENT_TEMPERATURES = {
  ideas_chat:       0.85,   // CHATFIX-1: creative chat without prose-model fabrication
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
  const isReasoningModel = /deepseek-r1|qwen3/i.test(String(model || '')); // MODELFIX-4: Qwen3 family thinks too
  const effectiveMaxTokens = isReasoningModel ? maxTokens + 4096 : maxTokens;

  const requestBody = {
    model,
    messages,
    stream: false,
    temperature,
    max_tokens: effectiveMaxTokens,
    // MODELFIX-4: hard-disable hybrid thinking at the chat-template level.
    // Qwen3 templates honor enable_thinking:false; other templates ignore the kwarg.
    chat_template_kwargs: { enable_thinking: false },
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

  // AUDITPROMPT-1: an empty completion is indistinguishable downstream from a
  // model that answered badly - both arrive as unusable text. It normally means
  // the reply landed in reasoning_content instead of content. Say so, here, once.
  if (!text) {
    const msg = data?.choices?.[0]?.message || {};
    console.warn(
      `[LOCAL-LLM] EMPTY completion from ${model} | message keys: ${Object.keys(msg).join(',') || 'none'}` +
      ` | finish_reason: ${data?.choices?.[0]?.finish_reason || 'none'}` +
      ` | reasoning_content length: ${String(msg.reasoning_content || '').length}`
    );
  }

  // Safety net: strip any thinking-model artifacts if they leak through.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/<\/think>/gi, '');
  text = text.replace(/\\boxed\{[^}]*\}/g, '');

  // LEAKFIX-2: scrub control tokens via shared boundary before returning
  text = stripModelControlTokens(text).text;
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
  // CHATFIX-1: the chat assistants (Ideas tab + floating brainstorm) get their
  // own fast, instruction-following agent — not the fabrication-prone creative
  // writer and not a slow reasoning model.
  if (['chat', 'brainstorm', 'ideas'].includes(t))
    return 'ideas_chat';
  if (['foundation', 'chapter_plan', 'outline', 'transform', 'beats', 'publishing', 'bibliography'].includes(t))
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
