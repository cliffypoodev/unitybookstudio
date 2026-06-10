// src/lib/writingModel.js — derives writing model from localLLM agent config
import { AGENT_MODELS } from './localLLM.js';

export const PRIMARY_WRITING_MODEL = AGENT_MODELS.ghostwriter;
export const WRITING_MODEL_LABEL = `${PRIMARY_WRITING_MODEL} (Local)`;
export const WRITING_MODEL_PROVIDER = "Ollama";
export const WRITING_MODEL_CONTEXT_WINDOW = 131072;
export const WRITING_MODEL_POLICY = { allowGenreSwitching: false, allowUserModelSelection: false, allowAdultFallbackToDifferentModel: true, allowSilentFallback: false };

export function resolveWritingModel() { return PRIMARY_WRITING_MODEL; }
export function getWritingModelInfo() { return { model: PRIMARY_WRITING_MODEL, label: WRITING_MODEL_LABEL, provider: WRITING_MODEL_PROVIDER, contextWindow: WRITING_MODEL_CONTEXT_WINDOW, policy: { ...WRITING_MODEL_POLICY } }; }
export function normalizeWritingModel(requestedModel) {
  if (requestedModel && requestedModel !== PRIMARY_WRITING_MODEL) console.warn(`[WRITING MODEL] Ignoring "${requestedModel}". Using ${PRIMARY_WRITING_MODEL}.`);
  return PRIMARY_WRITING_MODEL;
}
export function logWritingModelUsage(context = "Writing task") { console.log(`[WRITING MODEL] ${context}: ${PRIMARY_WRITING_MODEL} (Local)`); }
export function isWritingTask(taskType = "") {
  const n = String(taskType || "").toLowerCase();
  if (!n) return true;
  return ["draft","chapter","rewrite","beat","outline","scene","prose","fiction","nonfiction","romance","erotica","thriller","satire","manuscript"].some(k => n.includes(k));
}
