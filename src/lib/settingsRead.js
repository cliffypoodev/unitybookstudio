/**
 * WAVE5-SETTINGS — React-free synchronous settings readers.
 *
 * Pure lib code (polish runners, export builders, name hygiene) reads user
 * settings through this module so it never has to import the React hook side
 * of userSettings.js. Safe under Node (tests): falls back to defaults when
 * localStorage is unavailable.
 *
 * The storage key MUST stay in sync with src/lib/userSettings.js.
 */

const STORAGE_KEY = 'unitybookstudio_local_user_settings';

export const SETTING_DEFAULTS = {
  progressive_threshold: 8,
  emdash_target: 6,
  the_starter_target: 14,
  auto_polish_after_gen: false,
  auto_final_check_after_polish: false,
  custom_banned_words: '',
  custom_banned_names: '',
  default_trim_size: '6x9',
  default_export_font: 'Times New Roman',
  include_front_matter: true,
  include_back_matter: true,
  autosave_interval: 60,
  enable_floating_brainstorm: false,
  default_project_type: 'fiction',
};

function readAll() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) || {} : {};
  } catch {
    return {};
  }
}

export function getSetting(key, fallback = SETTING_DEFAULTS[key]) {
  const v = readAll()[key];
  return v === undefined || v === null || v === '' ? fallback : v;
}

/**
 * Parse the custom_banned_words textarea.
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
    if (!word || !/^[a-z][a-z' -]*$/.test(word)) continue;
    if (replacement) recastMap[word] = [replacement];
    else flagWords.push(word);
  }
  return { recastMap, flagWords };
}

/** Parse custom_banned_names into a clean array. */
export function parseCustomBannedNames(raw = getSetting('custom_banned_names', '')) {
  return String(raw || '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
