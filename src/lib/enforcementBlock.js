/**
 * enforcementBlock.js — PHASE 3 MIGRATION
 *
 * The mandatory enforcement block (pronoun rules, name frequency caps,
 * banned words, output format) has been moved to the Ghostwriter agent
 * system prompt (baked into the Ollama Modelfile via OpenWebUI).
 *
 * This constant is now empty to free ~1,800 tokens of context per call.
 * The export name is preserved for backward compatibility — sceneWriter.js,
 * autonovel.js, and ProjectStudio.jsx all import it.
 */

export const MANDATORY_ENFORCEMENT_BLOCK = '';