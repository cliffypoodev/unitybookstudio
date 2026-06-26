// src/lib/modelRouting.js — FULL REPLACEMENT for local Ollama
import { isNonfictionProject } from '@/lib/manuscriptStats';
import { isEroticaAnthology, isNonfictionAnthology } from '@/lib/anthologyEngine';
import { PRIMARY_WRITING_MODEL, WRITING_MODEL_LABEL, normalizeWritingModel } from '@/lib/writingModel';

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
const NONFICTION_INSTRUCT_MODEL = 'qwen3-30b-a3b';
export function pickModel(task = '', settings = null) {
  // Nonfiction foundation/outline drafts on an instruction-following model that respects the
  // supplied research, not the creative ghostwriter which fabricates evidence to dramatize.
  if (settings && String(settings.book_type || '').toLowerCase() === 'nonfiction') return NONFICTION_INSTRUCT_MODEL;
  return PRIMARY_WRITING_MODEL;
}
export function pickFallbackModel() { return null; }

const SETUP_PROTECTED_FIELDS = ['title','tagline','book_type','project_type','genre','subgenre','target_audience','content_lane','project_format','rights_mode','commercial_use_allowed','genre_group','market_category','fandom_name','source_universe','canon_mode','fanfic_posting_target','canon_characters','canon_boundary','pov_mode','tense','protagonist_pronouns','beat_style','scene_beat_style','nf_structure_mode','author_name','author_voice','author_voice_notes','author_style_id','series_bible_id','series_name','series_number','language_intensity','spice_level','violence_level','erotica_register','reading_level','chapter_target','chapter_length_preset','chapter_length_target','target_chapter_words','total_word_target','seed_concept','num_twists','twist_intensity','twist_count','story_arc','anthology_theme','anthology_theme_type','anthology_story_length','anthology_variety','default_prose_model'];
const FOUNDATION_FIELDS = ['world_md','characters_md','outline_md','canon_md','voice_md','mystery_md','twists_md','research_data','research_md'];

export function protectedProjectUpdate(fieldsToSave) {
  const safe = { ...(fieldsToSave || {}) };
  for (const field of [...SETUP_PROTECTED_FIELDS, ...FOUNDATION_FIELDS]) delete safe[field];
  return safe;
}

export const FICTION_PROSE_MODELS = [{ id: PRIMARY_WRITING_MODEL, label: WRITING_MODEL_LABEL, description: 'Local Gemma 4 — primary prose model' }];

export function foundationSafeUpdate(fieldsToSave, existingProject) {
  const safe = { ...(fieldsToSave || {}) };
  for (const field of SETUP_PROTECTED_FIELDS) delete safe[field];
  if (existingProject) { for (const field of SETUP_PROTECTED_FIELDS) { const v = existingProject[field]; if (v !== undefined && v !== null && v !== '') safe[field] = field === 'default_prose_model' ? PRIMARY_WRITING_MODEL : v; } }
  return safe;
}

export function scrubModelFields(fieldsToSave) {
  const safe = { ...(fieldsToSave || {}) };
  if (safe.default_prose_model) safe.default_prose_model = PRIMARY_WRITING_MODEL;
  if (safe.prose_model) safe.prose_model = PRIMARY_WRITING_MODEL;
  if (safe.model) safe.model = normalizeModelId(safe.model);
  return safe;
}

export function getModelRoutingSummary() {
  return { writing_model: PRIMARY_WRITING_MODEL, fiction_prose_model: DEFAULT_FICTION_PROSE_MODEL, structured_model: DEFAULT_STRUCTURED_MODEL, nonfiction_prose_model: DEFAULT_NONFICTION_PROSE_MODEL, analytics_model: DEFAULT_ANALYTICS_MODEL, lumimaid_enabled: false, user_model_selection_enabled: false, silent_writing_fallback_enabled: false, provider: 'Ollama (Local)' };
}

export const ADULT_PROSE_MODEL = PRIMARY_WRITING_MODEL;
