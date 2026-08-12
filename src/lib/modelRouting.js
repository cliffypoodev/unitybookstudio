// src/lib/modelRouting.js — FULL REPLACEMENT for local llama.cpp
import { isNonfictionProject } from '@/lib/manuscriptStats';
import { isNonfictionProject as isNonfictionProjectAuthority } from '@/lib/projectType'; // NFCLASS-3
import { FOUNDATION_FIELDS as SHARED_FOUNDATION_FIELDS } from '@/lib/generationContext'; // NFCLASS-3
import { isEroticaAnthology, isNonfictionAnthology } from '@/lib/anthologyEngine';
import { PRIMARY_WRITING_MODEL, WRITING_MODEL_LABEL, normalizeWritingModel } from '@/lib/writingModel';
import { AGENT_MODELS } from '@/lib/localLLM'; // WAVE5-MODELPICKER

export function isEroticaProject(project) {
  if (!project) return false;
  if (isEroticaAnthology(project)) return true;
  const genre = String(project.genre || '').toLowerCase();
  const subgenre = String(project.subgenre || '').toLowerCase();
  const projectType = String(project.project_type || '').toLowerCase();
  const bookType = String(project.book_type || '').toLowerCase();
  const p = /erotic|erotica|spicy|adult romance|adult fanfic|explicit fanfic|smut|lemon|kink|bdsm|omegaverse/;
  return p.test(genre) || p.test(subgenre) || p.test(projectType) || p.test(bookType) || Number(project.spice_level || 0) >= 3;
}

export const DEFAULT_WRITING_MODEL = PRIMARY_WRITING_MODEL;
export const DEFAULT_FICTION_PROSE_MODEL = PRIMARY_WRITING_MODEL;
export const DEFAULT_STRUCTURED_MODEL = PRIMARY_WRITING_MODEL;
export const DEFAULT_NONFICTION_PROSE_MODEL = PRIMARY_WRITING_MODEL;
export const DEFAULT_ANALYTICS_MODEL = PRIMARY_WRITING_MODEL;
export const REMOVED_LUMIMAID_MODELS = new Set(['neversleep/llama-3-lumimaid-70b','neversleep/llama-3.1-lumimaid-70b','neversleep/llama-3-lumimaid-8b','neversleep/llama-3.1-lumimaid-8b']);

const MODEL_ID_ALIASES = {
  'deepseek/deepseek-chat': PRIMARY_WRITING_MODEL, 'deepseek/deepseek-v3.2-20251201': PRIMARY_WRITING_MODEL, 'deepseek/deepseek-v3.2': PRIMARY_WRITING_MODEL,
  'gemini_3_flash': PRIMARY_WRITING_MODEL, 'openai_gpt5': PRIMARY_WRITING_MODEL,
  'neversleep/llama-3-lumimaid-70b': PRIMARY_WRITING_MODEL, 'neversleep/llama-3.1-lumimaid-70b': PRIMARY_WRITING_MODEL,
  'neversleep/llama-3-lumimaid-8b': PRIMARY_WRITING_MODEL, 'neversleep/llama-3.1-lumimaid-8b': PRIMARY_WRITING_MODEL,
};

export function normalizeModelId(modelId) { if (!modelId) return modelId; const c = String(modelId).trim(); return c ? (MODEL_ID_ALIASES[c] || c) : c; }

export function isWritingOrStructuredTask(task) {
  return ['prose','prose_continuation','draft','chapter','chapter_plan','scene','beats','foundation','transform','publishing','bibliography','fiction_research','ideas','rewrite','outline','manuscript'].includes(String(task || '').toLowerCase());
}
export function isAnalyticsTask(task) { return ['judge','evaluate','scan','critique','compare','analytics','research'].includes(String(task || '').toLowerCase()); }
export function isAdultCreativeTask(task) { return ['prose','prose_continuation','draft','chapter','scene','beats','rewrite','outline','manuscript'].includes(String(task || '').toLowerCase()); }
export function shouldDisableFallbacks() { return true; }
export function shouldDisableCreativeFallbacks() { return true; }
export function buildFallbackControls() { return { fallback_model: null, fallback_models: [], disable_fallbacks: true, use_gemini_fallback: false, use_openai_fallback: false }; }
// MODELTEST-1: the comment below always demanded an instruction-following model;
// the constant now finally points at one. ghostwriter-nf = stock Qwen3-14B
// (verified via gguf metadata: Apache-2.0, base Qwen3-14B-Base, no abliteration),
// served by llama-swap with ctx 65536. The uncensored 27B remains available for
// the fiction/adult lanes, which are untouched. Measured driver: the de-aligned
// 27B produced censor-hole artifacts ("was a to the") in every NF generation of
// the acceptance arc — omission instead of rephrase under vocabulary bans.
const NONFICTION_INSTRUCT_MODEL = 'ghostwriter-nf'; // MODELFIX-3 → MODELTEST-1
export function pickModel(task = '', settings = null) {
  // Nonfiction foundation/outline drafts on an instruction-following model that respects the
  // supplied research, not the creative ghostwriter which fabricates evidence to dramatize.
  // NFCLASS-3: this read only book_type — a third normalization, distinct from both
  // sceneWriter's raw equality and the authority. A project declared
  // { project_type: 'nonfiction' } drafted with nonfiction prompts and nonfiction word
  // clamps while this handed the whole book to PRIMARY_WRITING_MODEL: the creative
  // ghostwriter the comment above says fabricates evidence to dramatize.
  if (settings && isNonfictionProjectAuthority(settings)) return NONFICTION_INSTRUCT_MODEL;
  return PRIMARY_WRITING_MODEL;
}
export function pickFallbackModel() { return null; }

const SETUP_PROTECTED_FIELDS = ['title','tagline','book_type','project_type','genre','subgenre','target_audience','content_lane','project_format','rights_mode','commercial_use_allowed','genre_group','market_category','fandom_name','source_universe','canon_mode','fanfic_posting_target','canon_characters','canon_boundary','pov_mode','tense','protagonist_pronouns','beat_style','scene_beat_style','nf_structure_mode','author_name','author_voice','author_voice_notes','author_style_id','series_bible_id','series_name','series_number','language_intensity','spice_level','violence_level','erotica_register','reading_level','chapter_target','chapter_length_preset','chapter_length_target','target_chapter_words','total_word_target','seed_concept','num_twists','twist_intensity','twist_count','story_arc','anthology_theme','anthology_theme_type','anthology_story_length','anthology_variety','default_prose_model'];
// NFCLASS-3: there were two lists named FOUNDATION_FIELDS with different contents —
// this one and the exported one in generationContext.js, which has no 'research_data'.
// The local const shadowed the export by name, so the divergence was invisible: this
// list strips research_data from every save as a foundation field while
// hydrateProjectForGeneration never resolves or restores it, and closedWorldCheck /
// semanticSourceCheck / deterministicSourceCheck all read project.research_data as
// their evidence corpus. One authority now, with the extra fields written down as an
// explicit delta rather than a second silent list.
const EXTRA_PROTECTED_FOUNDATION_FIELDS = ['research_data'];
const FOUNDATION_FIELDS = [...new Set([...SHARED_FOUNDATION_FIELDS, ...EXTRA_PROTECTED_FOUNDATION_FIELDS])];

export function protectedProjectUpdate(fieldsToSave) {
  const safe = { ...(fieldsToSave || {}) };
  for (const field of [...SETUP_PROTECTED_FIELDS, ...FOUNDATION_FIELDS]) delete safe[field];
  return safe;
}

// WAVE5-MODELPICKER: the picker now lists the actually-installed prose-capable
// local models (derived from localLLM AGENT_MODELS + the llama-swap NF alias)
// instead of one entry with a stale "Gemma 4" description for a Qwen model.
export const FICTION_PROSE_MODELS = [
  { id: PRIMARY_WRITING_MODEL, label: WRITING_MODEL_LABEL, description: 'Qwen 3.6 35B uncensored — primary fiction prose model' },
  { id: AGENT_MODELS.nonfiction_writer, label: 'Qwen 3.6 27B (aggressive)', description: 'HauhauCS 27B uncensored — denser, more aggressive prose register' },
  { id: NONFICTION_INSTRUCT_MODEL, label: 'Qwen3 14B instruct (fast)', description: 'Stock instruction-following 14B via llama-swap — fastest, most literal' },
];

// The single validation authority for prose-model overrides.
export const PROSE_MODEL_IDS = new Set(FICTION_PROSE_MODELS.map((m) => m.id));
export function isWhitelistedProseModel(id) {
  return PROSE_MODEL_IDS.has(normalizeModelId(id));
}

export function foundationSafeUpdate(fieldsToSave, existingProject) {
  const safe = { ...(fieldsToSave || {}) };
  for (const field of SETUP_PROTECTED_FIELDS) delete safe[field];
  // WAVE5-MODELPICKER: default_prose_model is restored VERBATIM like every
  // other protected field. The old special-case reset it to the primary model
  // on every Build/Expand Story Bible — the picker "randomly" losing its value.
  if (existingProject) { for (const field of SETUP_PROTECTED_FIELDS) { const v = existingProject[field]; if (v !== undefined && v !== null && v !== '') safe[field] = v; } }
  return safe;
}

export function scrubModelFields(fieldsToSave) {
  const safe = { ...(fieldsToSave || {}) };
  // WAVE5-MODELPICKER: validate against the whitelist instead of clamping —
  // a legitimate user choice survives; only unknown/stale ids reset.
  if (safe.default_prose_model && !isWhitelistedProseModel(safe.default_prose_model)) safe.default_prose_model = PRIMARY_WRITING_MODEL;
  if (safe.prose_model && !isWhitelistedProseModel(safe.prose_model)) safe.prose_model = PRIMARY_WRITING_MODEL;
  if (safe.model) safe.model = normalizeModelId(safe.model);
  return safe;
}

export function getModelRoutingSummary() {
  return { writing_model: PRIMARY_WRITING_MODEL, fiction_prose_model: DEFAULT_FICTION_PROSE_MODEL, structured_model: DEFAULT_STRUCTURED_MODEL, nonfiction_prose_model: DEFAULT_NONFICTION_PROSE_MODEL, analytics_model: DEFAULT_ANALYTICS_MODEL, lumimaid_enabled: false, user_model_selection_enabled: true /* WAVE5-MODELPICKER */, silent_writing_fallback_enabled: false, provider: 'llama.cpp (Local)' };
}

export const ADULT_PROSE_MODEL = PRIMARY_WRITING_MODEL;
