// src/lib/localLLM.js
// Unity Book Studio — Local LLM Engine
// Sends all LLM calls to a local Ollama server.

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

export const AGENT_MODELS = {
  ghostwriter:      'ghostwriter',
  ghostwriter_nsfw: 'ghostwriter',
  architect:        'story-architect',
  researcher:       'researcher',
  critic:           'publishing-critic',
  polisher:         'prose-polisher',
};

export const AGENT_TEMPERATURES = {
  ghostwriter:      0.75,
  ghostwriter_nsfw: 0.75,
  architect:        0.6,
  researcher:       0.3,
  critic:           0.4,
  polisher:         0.3,
};

const AGENT_SYSTEM_PROMPTS = {
  ghostwriter: '',
  ghostwriter_nsfw: '',
  architect: '',
  researcher: '',
  critic: '',
  polisher: '',
};

export async function callOllama({ model, prompt, systemPrompt, temperature = 0.7, maxTokens = 8192, jsonSchema = null }) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

  let userContent = prompt;
  if (jsonSchema) {
    userContent += '\n\nRespond ONLY with valid JSON matching this schema. No markdown fences. No preamble. Just the JSON object.\n\nSchema:\n' + JSON.stringify(jsonSchema, null, 2);
  }
  messages.push({ role: 'user', content: userContent });

  let response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false, options: { temperature, num_predict: maxTokens } }),
      signal: AbortSignal.timeout(1200000),
    });
  } catch (fetchErr) {
    const isTimeout = fetchErr?.name === 'TimeoutError' || fetchErr?.name === 'AbortError';
    const err = new Error(isTimeout
      ? 'Ollama request timed out after 20 minutes.'
      : `Cannot reach Ollama at ${OLLAMA_BASE_URL}. Is Ollama running? Error: ${fetchErr?.message || 'unknown'}`);
    err.status = isTimeout ? 504 : 503;
    err.response = { status: err.status };
    throw err;
  }

  if (!response.ok) {
    let errMessage = `Ollama returned HTTP ${response.status}`;
    try { const errBody = await response.json(); errMessage = errBody?.error || errMessage; } catch {}
    const err = new Error(errMessage);
    err.status = response.status;
    err.response = { status: response.status };
    throw err;
  }

  const data = await response.json();
  let text = data?.message?.content || '';

  // Strip thinking-model artifacts (QwQ, DeepSeek-R1, etc.)
  // These models emit <think>...</think> blocks and \boxed{} before the real output.
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

  console.log(`[LOCAL-LLM] Agent: ${agentKey} | Model: ${resolvedModel} | Temp: ${resolvedTemp} | Task: ${taskType}`);

  return callOllama({ model: resolvedModel, prompt, systemPrompt, temperature: resolvedTemp, maxTokens, jsonSchema });
}

export async function checkOllamaHealth() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { healthy: false, error: `HTTP ${response.status}` };
    const data = await response.json();
    const models = (data.models || []).map(m => m.name);
    return { healthy: true, models, hasGhostwriter: models.some(m => m.includes(AGENT_MODELS.ghostwriter)), hasNSFW: models.some(m => m.includes(AGENT_MODELS.ghostwriter_nsfw)) };
  } catch (err) {
    return { healthy: false, error: err?.message || 'Cannot reach Ollama' };
  }
}
