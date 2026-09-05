// src/lib/localLLM.js
import { stripModelControlTokens } from './modelLeakGuard.js';
// ROUTE-1: every LLM call in this app goes to llama.cpp (llama-server). Ollama is
// not used anywhere in this stack, on any machine. The endpoint is the
// OpenAI-compatible POST /v1/chat/completions, which has no num_ctx field and no
// options object. The function names below now match the transport.

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
  architect:         'deepseek-r1-14b',                                  // ARCHITECTSPEED-1: fiction outlines/bibles (reasoning model). Was deepseek-r1-32b; on the single-slot local rig the 32B (~20GB) cold-loads on every swap and its long reasoning blew past the anthology batch 300s cap (anthologyBatchOutline.js), so multi-story outline gen never produced a usable batch. R1-14b is the proven fast reasoning alias (already the researcher/critic model) with a proven JSON path; it loads and generates fast enough to fit the cap. Affects fiction outline/bible gen only (nonfiction foundation routes to NONFICTION_INSTRUCT_MODEL and never hits the architect override).
  researcher:        'deepseek-r1-14b',                                  // RESEARCHMODEL-1: factual gathering. 'phi4' is not in the served catalog — every extraction batch 404'd. R1-14b is the proven fast reasoning alias already used by the critic, and R1's JSON path is proven by the architect.
  critic:            'deepseek-r1-14b',                                  // QA/critique (faster R1)
  architect_nsfw:    'qwen3.6-35b-uncensored',                           // ADULTROUTE-1: adult/erotica architect lane — outlines/bibles/beats for NSFW projects must not touch the aligned R1 (refusal/sanitization risk at spice >= 3); same uncensored model as prose, architect temperature
  polisher:          'unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q6_K_XL', // faithful line edits
  ideas_chat:        'unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q6_K_XL', // CHATFIX-1: chat assistants — fast MoE instruct, strict format adherence
  nonfiction_writer: 'HauhauCS/Qwen3.6-27B-Uncensored-HauhauCS-Aggressive:Q5_K_P', // MODELFIX-3: dense prose-tuned 27B; gates handle integrity
};

export const AGENT_TEMPERATURES = {
  ideas_chat:       0.85,   // CHATFIX-1: creative chat without prose-model fabrication
  ghostwriter:      0.75,
  ghostwriter_nsfw: 0.75,
  architect:        0.6,
  architect_nsfw:   0.6,
  researcher:       0.3,
  critic:           0.4,
  polisher:         0.3,
  nonfiction_writer: 0.4,
};

// ROUTE-1: this number is NOT transmitted. The OpenAI-compatible endpoint
// (/v1/chat/completions) has no num_ctx field; llama.cpp uses whatever -c it was
// launched with. AGENT_NUM_CTX is the client-side default assumption only.
export const AGENT_NUM_CTX = 32768;

// Per-agent overrides (optional). Agents not listed use AGENT_NUM_CTX.
export const AGENT_NUM_CTX_OVERRIDES = {
  // e.g. researcher: 8192,
};

// ROUTE-1 -------------------------------------------------------------------
// Per-role endpoint. Every value is a SAME-ORIGIN proxy prefix declared in
// vite.config.js. The browser never holds a tailnet hostname or a raw model
// port, so the dev server stays the only process that talks to a worker.
// Default: every role points at the Studio, so this table is a no-op until a
// role is deliberately moved. Moving a role is a one-line data edit here plus
// one matching proxy entry in vite.config.js. No other file changes.
export const AGENT_ENDPOINTS = {
  ghostwriter:       '/llama',
  ghostwriter_nsfw:  '/llama',
  architect:         '/llama',
  architect_nsfw:    '/llama',
  researcher:        '/llama',
  critic:            '/llama',
  polisher:          '/llama',
  ideas_chat:        '/llama',
  nonfiction_writer: '/llama',
};

// ROUTE-1: the REAL PER-SLOT context window, in tokens, of the machine each role
// points at. Read it from that machine's GET /props (field n_ctx). Do NOT copy the
// launch -c flag: llama-server divides -c by --parallel (n_ctx_slot = n_ctx /
// n_parallel), so a server started with -c 32768 --parallel 2 gives each request
// only 16384.
// llama-server does NOT silently truncate an over-long prompt. Prompt truncation
// was removed, and --context-shift no longer performs it; context shift is off by
// default. The server returns an HTTP error instead. So a wrong number here does
// not corrupt prose - it kills the chapter mid-run with a message that names
// neither the agent nor the endpoint nor the overflow. This table plus the refusal
// below turn that into a legible pre-flight failure.
export const AGENT_CTX_TOKENS = {
  ghostwriter:       32768,
  ghostwriter_nsfw:  32768,
  architect:         32768,
  architect_nsfw:    32768,
  researcher:        32768,
  critic:            32768,
  polisher:          32768,
  ideas_chat:        32768,
  nonfiction_writer: 32768,
};

// ROUTE-1: conservative chars-per-token for English prose. LOWER means we assume
// MORE tokens per character, so we refuse earlier. Never raise this to make a
// prompt fit; move the role to a bigger endpoint or shrink the prompt.
export const ROUTE1_CHARS_PER_TOKEN = 3.6;

// ROUTE-1: measure one request against the endpoint it is about to be sent to.
// Pure function: no I/O, no imports, directly testable.
export function checkPromptBudget({ promptChars, reserveTokens, ctxTokens, charsPerToken = ROUTE1_CHARS_PER_TOKEN }) {
  const cpt = Number(charsPerToken) > 0 ? Number(charsPerToken) : ROUTE1_CHARS_PER_TOKEN;
  const ctx = Number(ctxTokens) > 0 ? Number(ctxTokens) : 0;
  const reserve = Number(reserveTokens) > 0 ? Number(reserveTokens) : 0;
  const chars = Number(promptChars) > 0 ? Number(promptChars) : 0;
  const promptTokens = Math.ceil(chars / cpt);
  const needed = promptTokens + reserve;
  return {
    promptChars: chars,
    promptTokens,
    reserveTokens: reserve,
    ctxTokens: ctx,
    needed,
    headroom: ctx - needed,
    fits: ctx > 0 && needed <= ctx,
  };
}

const AGENT_SYSTEM_PROMPTS = {
  ghostwriter: '',
  ghostwriter_nsfw: '',
  architect: '',
  architect_nsfw: '',
  researcher: '',
  critic: '',
  polisher: '',
  nonfiction_writer: '',
};

// BEATLEDGER-1: callLlama's text-only return cannot distinguish a genuine
// empty/short answer from a truncated one (finish_reason === 'length') —
// the two need different handling downstream (extraction failure vs. a
// real zero-beat result). callLlamaWithMeta is the one place that talks to
// the wire; callLlama is now a thin wrapper over it so every existing
// caller keeps the exact same string-only contract, byte-identical.
export async function callLlamaWithMeta({ model, prompt, systemPrompt, temperature = 0.7, maxTokens = 8192, jsonSchema = null, numCtx = AGENT_NUM_CTX, baseUrl = LLAMA_BASE_URL, ctxTokens = AGENT_NUM_CTX, agentKey = null }) {
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

  // ROUTE-1: refuse before the wire, and say exactly why. llama-server rejects an
  // over-long prompt with a generic HTTP error naming neither the agent, the
  // endpoint, the model, nor the size of the overflow - which reaches the operator
  // as an unexplained chapter death mid-run. Measure locally, refuse locally, and
  // put all four facts in the message.
  const route1PromptChars = messages.reduce((n, m) => n + String(m?.content || '').length, 0);
  const route1 = checkPromptBudget({
    promptChars: route1PromptChars,
    reserveTokens: effectiveMaxTokens,
    ctxTokens,
  });
  console.log(
    `[ROUTE-1] ${agentKey || 'direct'} -> ${baseUrl} | model=${model}` +
    ` | prompt=${route1.promptChars}c ~${route1.promptTokens}t` +
    ` | reserve=${route1.reserveTokens}t | ctx=${route1.ctxTokens}t` +
    ` | headroom=${route1.headroom}t | fits=${route1.fits}`
  );
  if (!route1.fits) {
    const err = new Error(
      `ROUTE-1 budget refusal: agent ${agentKey || 'direct'} -> ${baseUrl} (${model}). ` +
      `Prompt ${route1.promptChars} chars (~${route1.promptTokens} tokens) plus ${route1.reserveTokens} reply tokens ` +
      `needs ${route1.needed} tokens, but that endpoint's context is ${route1.ctxTokens}. ` +
      `Over by ${route1.needed - route1.ctxTokens}. Nothing was sent.`
    );
    err.status = 413;
    err.response = { status: 413 };
    err.route1 = route1;
    throw err;
  }

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

  const timingStart = Date.now();
  let response;
  try {
    response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(1200000),
    });
  } catch (fetchErr) {
    const isTimeout = fetchErr?.name === 'TimeoutError' || fetchErr?.name === 'AbortError';
    const err = new Error(isTimeout
      ? 'llama serve request timed out after 20 minutes.'
      : `Cannot reach llama serve at ${baseUrl}. Is it running? Error: ${fetchErr?.message || 'unknown'}`);
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
  const finishReason = data?.choices?.[0]?.finish_reason || null;

  // AUDITPROMPT-1: an empty completion is indistinguishable downstream from a
  // model that answered badly - both arrive as unusable text. It normally means
  // the reply landed in reasoning_content instead of content. Say so, here, once.
  if (!text) {
    const msg = data?.choices?.[0]?.message || {};
    console.warn(
      `[LOCAL-LLM] EMPTY completion from ${model} | message keys: ${Object.keys(msg).join(',') || 'none'}` +
      ` | finish_reason: ${finishReason || 'none'}` +
      ` | reasoning_content length: ${String(msg.reasoning_content || '').length}`
    );
  }

  // TIMING-1: total wall time for this call, including any model load/swap the
  // llama.cpp router performed to serve it. Bimodal durations for the same
  // model = swap cost made visible. This is the instrumentation the thrash
  // hypothesis has been waiting for.
  console.log(`[TIMING] ${agentKey || 'direct'} | ${model} | ${Date.now() - timingStart}ms`);

  // Safety net: strip any thinking-model artifacts if they leak through.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/<\/think>/gi, '');
  text = text.replace(/\\boxed\{[^}]*\}/g, '');

  // LEAKFIX-2: scrub control tokens via shared boundary before returning
  text = stripModelControlTokens(text).text;
  text = text.trim();

  return { text, finishReason };
}

export async function callLlama(args) {
  return (await callLlamaWithMeta(args)).text;
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
    return isNSFW ? 'architect_nsfw' : 'architect';
  if (['judge', 'evaluate', 'scan', 'critique', 'compare', 'analytics'].includes(t))
    return 'critic';
  if (t === 'research' || t === 'fiction_research')
    return 'researcher';
  if (['polish', 'proofread', 'fix', 'cleanup'].includes(t))
    return 'polisher';

  return isNSFW ? 'ghostwriter_nsfw' : 'ghostwriter';
}

function resolveAgentCallArgs({ taskType, project, temperature, model, systemPromptOverride }) {
  const agentKey = resolveAgent(taskType, project);
  const resolvedModel = model || AGENT_MODELS[agentKey];
  const resolvedTemp = temperature ?? AGENT_TEMPERATURES[agentKey] ?? 0.7;
  const systemPrompt = systemPromptOverride || AGENT_SYSTEM_PROMPTS[agentKey] || '';
  const numCtx = AGENT_NUM_CTX_OVERRIDES[agentKey] ?? AGENT_NUM_CTX;
  // ROUTE-1: endpoint and real context window are per-role data, not code.
  const baseUrl = AGENT_ENDPOINTS[agentKey] || LLAMA_BASE_URL;
  const ctxTokens = AGENT_CTX_TOKENS[agentKey] ?? numCtx;
  return { agentKey, resolvedModel, resolvedTemp, systemPrompt, numCtx, baseUrl, ctxTokens };
}

export async function callAgent({ prompt, taskType = 'prose', project = null, temperature, maxTokens = 8192, jsonSchema = null, model = null, systemPromptOverride = null }) {
  const { agentKey, resolvedModel, resolvedTemp, systemPrompt, numCtx, baseUrl, ctxTokens } =
    resolveAgentCallArgs({ taskType, project, temperature, model, systemPromptOverride });

  console.log(`[LOCAL-LLM] Agent: ${agentKey} | Model: ${resolvedModel} | Temp: ${resolvedTemp} | Ctx: ${numCtx} | Endpoint: ${baseUrl} | Task: ${taskType}`);

  return callLlama({ model: resolvedModel, prompt, systemPrompt, temperature: resolvedTemp, maxTokens, jsonSchema, numCtx, baseUrl, ctxTokens, agentKey });
}

// BEATLEDGER-1: same routing as callAgent, but surfaces finishReason so a
// caller can distinguish a genuine empty/short answer from a truncated one.
export async function callAgentWithMeta({ prompt, taskType = 'prose', project = null, temperature, maxTokens = 8192, jsonSchema = null, model = null, systemPromptOverride = null }) {
  const { agentKey, resolvedModel, resolvedTemp, systemPrompt, numCtx, baseUrl, ctxTokens } =
    resolveAgentCallArgs({ taskType, project, temperature, model, systemPromptOverride });

  console.log(`[LOCAL-LLM] Agent: ${agentKey} | Model: ${resolvedModel} | Temp: ${resolvedTemp} | Ctx: ${numCtx} | Endpoint: ${baseUrl} | Task: ${taskType}`);

  return callLlamaWithMeta({ model: resolvedModel, prompt, systemPrompt, temperature: resolvedTemp, maxTokens, jsonSchema, numCtx, baseUrl, ctxTokens, agentKey });
}

export async function checkLlamaHealth() {
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

// ROUTE-1B: health for ONE endpoint. Advisory, never throws.
export async function checkEndpointHealth(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { baseUrl, healthy: false, error: `HTTP ${response.status}`, models: [] };
    const data = await response.json();
    const models = (data?.data || data?.models || []).map(m => m?.id || m?.name).filter(Boolean).map(String);
    return { baseUrl, healthy: true, error: null, models };
  } catch (err) {
    return { baseUrl, healthy: false, error: err?.message || 'unreachable', models: [] };
  }
}

// ROUTE-1B: probe every DISTINCT endpoint once, then report, per role, whether the
// model that role is assigned to is actually present there. Sequential on purpose:
// the local server serves one call at a time. Advisory only - this reports, it does
// not block. The blocking check is the ROUTE-1 budget refusal in callLlama.
export async function checkAllEndpoints() {
  const distinct = [...new Set(Object.values(AGENT_ENDPOINTS))];
  const byUrl = {};
  for (const url of distinct) {
    byUrl[url] = await checkEndpointHealth(url);
  }
  const roles = Object.keys(AGENT_ENDPOINTS).map((agentKey) => {
    const baseUrl = AGENT_ENDPOINTS[agentKey];
    const h = byUrl[baseUrl] || { healthy: false, models: [], error: 'not probed' };
    const wanted = String(AGENT_MODELS[agentKey] || '');
    const modelPresent = !!(h.healthy && wanted && h.models.some(
      m => m === wanted || m.includes(wanted) || wanted.includes(m)
    ));
    return {
      agentKey,
      baseUrl,
      model: wanted,
      ctxTokens: AGENT_CTX_TOKENS[agentKey] ?? AGENT_NUM_CTX,
      reachable: !!h.healthy,
      modelPresent,
      error: h.error || null,
    };
  });
  const broken = roles.filter(r => !r.reachable || !r.modelPresent);
  console.log(`[ROUTE-1B] endpoints probed: ${distinct.length} | roles OK: ${roles.length - broken.length}/${roles.length}`);
  for (const r of roles) {
    console.log(
      `[ROUTE-1B] ${r.agentKey.padEnd(18)} ${r.baseUrl.padEnd(14)} ctx=${String(r.ctxTokens).padEnd(6)}` +
      ` reachable=${r.reachable} modelPresent=${r.modelPresent}${r.error ? ' err=' + r.error : ''}`
    );
  }
  return { endpoints: byUrl, roles, allOk: broken.length === 0 };
}
