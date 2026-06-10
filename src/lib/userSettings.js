/**
 * Local-only user settings fallback.
 *
 * This intentionally does NOT call Base44 entities.
 * It prevents 404 errors for missing UserSettings / AuthorPersona schemas.
 *
 * Keep this lightweight unless you intentionally want a real settings system later.
 */

const STORAGE_KEY = 'unitybookstudio_local_user_settings';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  default_model: 'gemini_3_flash',
  image_model: 'dall-e-3',
  image_quality: 'hd',
  preferred_cover_style: 'Photorealistic',
  preferred_cover_mood: 'Muted',
  default_export_format: 'docx',
};

const DEFAULT_AUTHOR_PERSONA = {
  name: 'Default Author',
  pen_name: '',
  genre: '',
  voice_summary: '',
  style_rules: '',
  banlist_phrases: '',
  sample_text: '',
  persona_json: {},
  is_default: true,
};

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

export function getDefaultSettings() {
  return { ...DEFAULT_SETTINGS };
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
  return [getDefaultAuthorPersona()];
}

export async function saveAuthorPersona(persona = {}) {
  return {
    ...DEFAULT_AUTHOR_PERSONA,
    ...(persona || {}),
  };
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
    authorPersonas: [getDefaultAuthorPersona()],
  };
}

export function useUserSettings() {
  return {
    settings: safeReadLocalSettings(),
    authorPersonas: [getDefaultAuthorPersona()],
    loading: false,
    error: null,
    reload: async () => loadAll(),
    saveSettings: saveUserSettings,
    saveAuthorPersona,
  };
}

export default {
  getDefaultSettings,
  getDefaultAuthorPersona,
  loadUserSettings,
  saveUserSettings,
  loadAuthorPersonas,
  saveAuthorPersona,
  ensureEntitiesExist,
  loadAll,
  useUserSettings,
};