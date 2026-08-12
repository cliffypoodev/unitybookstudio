/**
 * Local-only user settings + author personas.
 *
 * This intentionally does NOT call Base44 entities.
 * It prevents 404 errors for missing UserSettings / AuthorPersona schemas.
 *
 * WAVE1-PERSONAS: this module used to fake persona CRUD (four console.warn
 * stubs behind a UI that toasted success), and useUserSettings() was not a
 * real hook, so nothing in SettingsModal ever re-rendered. Personas now
 * persist to localStorage with real ids, the active persona is remembered in
 * settings.active_persona_id, and useUserSettings() is a genuine stateful
 * hook — what you see in the modal is what is actually stored.
 */

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'unitybookstudio_local_user_settings';
const PERSONAS_KEY = 'unitybookstudio_local_author_personas';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  default_model: 'gemini_3_flash',
  image_model: 'dall-e-3',
  image_quality: 'hd',
  preferred_cover_style: 'Photorealistic',
  preferred_cover_mood: 'Muted',
  default_export_format: 'docx',
  active_persona_id: 'default',
  // WAVE5-SETTINGS: every SettingsModal control is now declared with a default
  // matching the value that was previously hardcoded at its consumer, so
  // nothing renders undefined and consumers always get a sane number/string.
  progressive_threshold: 8,       // per-10k trigger for the progressive reducer (nonfiction polish)
  emdash_target: 6,               // per-1k trigger for the em-dash reducer (nonfiction polish)
  the_starter_target: 14,         // target % for sentence-starter variation
  auto_polish_after_gen: false,   // run a deterministic polish pass on each chapter right after drafting
  auto_final_check_after_polish: false, // run a quality scan after manuscript polish
  custom_banned_words: '',        // comma-separated; use word=replacement to auto-recast, bare word to flag
  custom_banned_names: '',        // comma-separated character names to ban from generation
  default_trim_size: '6x9',
  default_export_font: 'Times New Roman',
  include_front_matter: true,
  include_back_matter: true,
  autosave_interval: 60,          // seconds
  enable_floating_brainstorm: false,
  default_project_type: 'fiction',
};

const DEFAULT_AUTHOR_PERSONA = {
  id: 'default',
  // Lean legacy shape (kept for compatibility with older readers)
  name: 'Default Author',
  pen_name: '',
  genre: '',
  voice_summary: '',
  style_rules: '',
  banlist_phrases: '',
  sample_text: '',
  persona_json: {},
  is_default: true,
  // Rich shape the Personas UI edits
  persona_name: 'Default Author',
  genres: '',
  default_genre: '',
  default_beat_style: 'Fast-Paced Thriller',
  default_language_intensity: 2,
  default_pov: 'third-close',
  default_tense: 'past',
  bio: '',
  voice_notes: '',
  bisac_categories: '',
};

function makePersonaId() {
  return 'persona_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function safeReadLocalSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...(parsed || {}),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function safeWriteLocalSettings(settings) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        ...(settings || {}),
      })
    );
  } catch {
    // localStorage can fail in private/sandboxed contexts.
    // Do not crash the app over optional settings.
  }
}

function safeReadPersonas() {
  try {
    const raw = localStorage.getItem(PERSONAS_KEY);
    if (!raw) return [{ ...DEFAULT_AUTHOR_PERSONA }];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [{ ...DEFAULT_AUTHOR_PERSONA }];
    // Every persona gets an id; legacy entries without one are healed in place.
    return parsed.map((p) => ({ ...DEFAULT_AUTHOR_PERSONA, ...p, id: p.id || makePersonaId() }));
  } catch {
    return [{ ...DEFAULT_AUTHOR_PERSONA }];
  }
}

function safeWritePersonas(personas) {
  try {
    localStorage.setItem(PERSONAS_KEY, JSON.stringify(personas || []));
  } catch {
    // Optional data — never crash the app over localStorage failures.
  }
}

export function getDefaultSettings() {
  return { ...DEFAULT_SETTINGS };
}

/**
 * WAVE5-SETTINGS: synchronous read for non-React code (polish runners, export
 * builders). Returns the stored value or the fallback (which defaults to the
 * declared DEFAULT_SETTINGS value).
 */
export function getSetting(key, fallback = DEFAULT_SETTINGS[key]) {
  const v = safeReadLocalSettings()[key];
  return v === undefined || v === null || v === '' ? fallback : v;
}

/**
 * WAVE5-SETTINGS: parse the custom_banned_words textarea.
 * "utilize=use, tapestry, endeavor=try" →
 *   { recastMap: { utilize: ['use'], endeavor: ['try'] }, flagWords: ['tapestry'] }
 * Bare words are FLAGGED in reports (never blind-deleted — that was bug B4);
 * word=replacement entries are auto-recast during polish.
 */
export function parseCustomBannedWords(raw = getSetting('custom_banned_words', '')) {
  const recastMap = {};
  const flagWords = [];
  for (const entry of String(raw || '').split(/[,\n]/)) {
    const trimmed = entry.trim().toLowerCase();
    if (!trimmed) continue;
    const [word, replacement] = trimmed.split('=').map((s) => s.trim());
    if (!word) continue;
    if (replacement) recastMap[word] = [replacement];
    else flagWords.push(word);
  }
  return { recastMap, flagWords };
}

/** WAVE5-SETTINGS: parse custom_banned_names into a clean array. */
export function parseCustomBannedNames(raw = getSetting('custom_banned_names', '')) {
  return String(raw || '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getDefaultAuthorPersona() {
  return { ...DEFAULT_AUTHOR_PERSONA };
}

export async function loadUserSettings() {
  return safeReadLocalSettings();
}

export async function saveUserSettings(updates = {}) {
  const current = safeReadLocalSettings();
  const next = {
    ...current,
    ...(updates || {}),
  };

  safeWriteLocalSettings(next);
  return next;
}

export async function loadAuthorPersonas() {
  return safeReadPersonas();
}

export async function saveAuthorPersona(persona = {}) {
  const personas = safeReadPersonas();
  const withId = { ...DEFAULT_AUTHOR_PERSONA, ...persona, id: persona.id || makePersonaId(), is_default: !!persona.is_default };
  const idx = personas.findIndex((p) => p.id === withId.id);
  if (idx >= 0) personas[idx] = withId;
  else personas.push(withId);
  safeWritePersonas(personas);
  return withId;
}

export async function deleteAuthorPersona(id) {
  const personas = safeReadPersonas().filter((p) => p.id !== id);
  safeWritePersonas(personas.length ? personas : [{ ...DEFAULT_AUTHOR_PERSONA }]);
  const settings = safeReadLocalSettings();
  if (settings.active_persona_id === id) {
    safeWriteLocalSettings({ ...settings, active_persona_id: (personas[0] || DEFAULT_AUTHOR_PERSONA).id });
  }
}

export async function ensureEntitiesExist() {
  return {
    userSettingsAvailable: false,
    authorPersonaAvailable: false,
    storage: 'local-only',
  };
}

export async function loadAll() {
  return {
    settings: safeReadLocalSettings(),
    authorPersonas: safeReadPersonas(),
  };
}

export function useUserSettings() {
  const [settings, setSettings] = useState(() => safeReadLocalSettings());
  const [authorPersonas, setAuthorPersonas] = useState(() => safeReadPersonas());

  const saveSettings = useCallback(async (updates = {}) => {
    const next = await saveUserSettings(updates);
    setSettings(next);
    return next;
  }, []);

  const addPersona = useCallback(async (draft = {}) => {
    const created = await saveAuthorPersona({ ...draft, id: undefined });
    setAuthorPersonas(safeReadPersonas());
    return created;
  }, []);

  const updatePersona = useCallback(async (id, draft = {}) => {
    const updated = await saveAuthorPersona({ ...draft, id });
    setAuthorPersonas(safeReadPersonas());
    return updated;
  }, []);

  const deletePersona = useCallback(async (id) => {
    await deleteAuthorPersona(id);
    setAuthorPersonas(safeReadPersonas());
    setSettings(safeReadLocalSettings());
  }, []);

  const setActivePersona = useCallback(async (id) => {
    const next = await saveUserSettings({ active_persona_id: id });
    setSettings(next);
  }, []);

  const reload = useCallback(async () => {
    setSettings(safeReadLocalSettings());
    setAuthorPersonas(safeReadPersonas());
    return loadAll();
  }, []);

  const activePersona =
    authorPersonas.find((p) => p.id === settings.active_persona_id) || authorPersonas[0] || null;

  return {
    settings,
    authorPersonas,
    activePersona,
    loading: false,
    error: null,
    reload,
    saveSettings,
    saveAuthorPersona,
    addPersona,
    updatePersona,
    deletePersona,
    setActivePersona,
  };
}

export default {
  getDefaultSettings,
  getDefaultAuthorPersona,
  loadUserSettings,
  saveUserSettings,
  loadAuthorPersonas,
  saveAuthorPersona,
  deleteAuthorPersona,
  ensureEntitiesExist,
  loadAll,
  useUserSettings,
};
