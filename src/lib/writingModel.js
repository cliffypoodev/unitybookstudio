// src/lib/writingModel.js — derives writing model from localLLM agent config
import { AGENT_MODELS } from './localLLM.js';

export const PRIMARY_WRITING_MODEL = AGENT_MODELS.ghostwriter;
export const WRITING_MODEL_LABEL = `${PRIMARY_WRITING_MODEL} (Local)`;
export const WRITING_MODEL_PROVIDER = "llama.cpp";
export const WRITING_MODEL_CONTEXT_WINDOW = 131072;
export const WRITING_MODEL_POLICY = { allowGenreSwitching: false, allowUserModelSelection: false, allowAdultFallbackToDifferentModel: true, allowSilentFallback: false };

export function resolveWritingModel() { return PRIMARY_WRITING_MODEL; }
// The actual model for a given project: nonfiction routes to the instruction-following
// model (matching resolveAgent/pickModel); everything else uses the primary writing model.
export function resolveWritingModelForProject(project = null) {
  const isNonfiction = project && String(project.book_type || '').toLowerCase() === 'nonfiction';
  return isNonfiction ? AGENT_MODELS.nonfiction_writer : PRIMARY_WRITING_MODEL;
}
export function getWritingModelInfo(project = null) {
  const model = resolveWritingModelForProject(project);
  return { model: model, label: model + ' (Local)', provider: WRITING_MODEL_PROVIDER, contextWindow: WRITING_MODEL_CONTEXT_WINDOW, policy: { ...WRITING_MODEL_POLICY } };
}
export function normalizeWritingModel(requestedModel) {
  if (requestedModel && requestedModel !== PRIMARY_WRITING_MODEL) console.warn(`[WRITING MODEL] Ignoring "${requestedModel}". Using ${PRIMARY_WRITING_MODEL}.`);
  return PRIMARY_WRITING_MODEL;
}
export function logWritingModelUsage() {
  // No-op. The authoritative agent + model is logged by callAgent in localLLM.js
  // ([LOCAL-LLM] Agent: X | Model: Y). The old "[WRITING MODEL]" line here was hardcoded
  // to the primary model and was therefore wrong for nonfiction and specialized agents.
}
export function isWritingTask(taskType = "") {
  const n = String(taskType || "").toLowerCase();
  if (!n) return true;
  return ["draft","chapter","rewrite","beat","outline","scene","prose","fiction","nonfiction","romance","erotica","thriller","satire","manuscript"].some(k => n.includes(k));
}
