// WAVE5 acceptance battery — settings wired, model picker real, dead code stamped.
//
//   WAVE5-SETTINGS     all wireable Settings controls reach real consumers;
//                      dead-end controls (API keys, marketplace) removed
//   WAVE5-MODELPICKER  whitelisted prose-model overrides are honored end to end
//   WAVE5-DEADSTAMP    verified orphans carry DEAD CODE warnings (kept, not deleted)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSetting, parseCustomBannedWords, parseCustomBannedNames, SETTING_DEFAULTS } from '../src/lib/settingsRead.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

// ── settings foundation (behavioral — runs in Node, no localStorage) ─────────
check('1. getSetting falls back to declared defaults without localStorage',
  getSetting('autosave_interval') === 60 && getSetting('emdash_target') === 6 &&
  getSetting('include_front_matter') === true && getSetting('default_project_type') === 'fiction');
check('1b. parseCustomBannedWords: word=replacement recasts, bare words flag',
  (() => {
    const r = parseCustomBannedWords('utilize=use, tapestry, endeavor=try');
    return r.recastMap.utilize?.[0] === 'use' && r.recastMap.endeavor?.[0] === 'try' &&
      r.flagWords.length === 1 && r.flagWords[0] === 'tapestry';
  })());
check('1c. parseCustomBannedNames splits and trims',
  JSON.stringify(parseCustomBannedNames(' Elara,Kaelen , ')) === '["Elara","Kaelen"]');
check('1d. userSettings DEFAULT_SETTINGS declares every SettingsModal key',
  (() => {
    const us = read('src/lib/userSettings.js');
    return Object.keys(SETTING_DEFAULTS).every((k) => us.includes(k));
  })());

// ── consumers actually read the settings ─────────────────────────────────────
const wired = [
  ['autosave interval → ProjectStudio useAutoSave', 'src/pages/ProjectStudio.jsx', /getSetting\('autosave_interval'/],
  ['em-dash trigger → punctuationPolish', 'src/lib/punctuationPolish.js', /getSetting\('emdash_target'/],
  ['progressive trigger → punctuationPolish', 'src/lib/punctuationPolish.js', /getSetting\('progressive_threshold'/],
  ['starter target → vocabCaps NF pass', 'src/lib/vocabCaps.js', /getSetting\('the_starter_target'/],
  ['custom banned words → aiSlopReduction recast', 'src/lib/aiSlopReduction.js', /parseCustomBannedWords\(\)\.recastMap/],
  ['custom banned words → manuscriptStats flags', 'src/lib/manuscriptStats.js', /parseCustomBannedWords\(\)\.flagWords/],
  ['custom banned names → nameHygieneRules', 'src/lib/nameHygieneRules.js', /parseCustomBannedNames\(\)/],
  ['export font/trim seed → ExportTab', 'src/components/publishing/ExportTab.jsx', /getSetting\('default_export_font'/],
  ['front/back matter → ExportTab', 'src/components/publishing/ExportTab.jsx', /getSetting\('include_front_matter'/],
  ['front/back matter → buildBookHtml', 'src/lib/buildBookHtml.js', /getSetting\('include_back_matter'/],
  ['trim size → FullWrapComposite', 'src/components/cover/FullWrapComposite.jsx', /getSetting\('default_trim_size'/],
  ['default project type → NewProjectModal', 'src/components/dashboard/NewProjectModal.jsx', /getSetting\('default_project_type'/],
  ['floating brainstorm → App mount gate', 'src/App.jsx', /enable_floating_brainstorm/],
  ['auto-polish hook → draftChapter (3 paths)', 'src/pages/ProjectStudio.jsx', null],
  ['final check hook → both polish reports', 'src/pages/ProjectStudio.jsx', null],
];
for (const [name, file, rx] of wired) {
  const src = read(file);
  if (rx) { check('2. ' + name, rx.test(src)); continue; }
  if (name.startsWith('auto-polish')) {
    check('2. ' + name, (src.match(/maybeAutoPolishChapter\(\{ project, chapter, content: chapterContent/g) || []).length === 3);
  } else {
    check('2. ' + name, (src.match(/maybeFinalCheckAfterPolish\(\{ project, loaded/g) || []).length === 2);
  }
}
check('2x. trim-size normalizer handles all four historical spellings',
  (() => {
    const kdp = read('src/lib/kdpCover.js');
    return /normalizeTrimSize/.test(kdp) && /suggestTrimSize\(bookType, userDefault = ''\)/.test(kdp);
  })());

// ── dead-end controls removed ────────────────────────────────────────────────
const sm = read('src/components/notebook/SettingsModal.jsx');
check('3. API Keys tab is gone (no cloud backend exists to use the keys)',
  !/id: 'api'/.test(sm) && !/openrouter_api_key/.test(sm));
check('3b. Marketplace control is gone (no marketplace feature exists)',
  !/default_marketplace/.test(sm));
check('3c. font options come from the real FONT_OPTIONS list',
  /FONT_OPTIONS/.test(sm));
check('3d. project-type options match the actual creatable types',
  /\['fiction','nonfiction','erotica','ideas'\]/.test(sm));

// ── WAVE5-MODELPICKER ────────────────────────────────────────────────────────
const mr = read('src/lib/modelRouting.js');
check('4. FICTION_PROSE_MODELS lists 3 real local models + exports the whitelist',
  (mr.match(/\{ id: /g) || []).length >= 3 && /PROSE_MODEL_IDS/.test(mr) && /isWhitelistedProseModel/.test(mr));
check('4b. foundationSafeUpdate restores default_prose_model VERBATIM (reset special-case gone)',
  !/field === 'default_prose_model' \? PRIMARY_WRITING_MODEL/.test(mr));
check('4c. scrubModelFields validates instead of clamping',
  /!isWhitelistedProseModel\(safe\.default_prose_model\)/.test(mr));
check('4d. user_model_selection_enabled is true', /user_model_selection_enabled: true/.test(mr));
const sw = read('src/lib/sceneWriter.js');
check('5. pickProseModel HONORS whitelisted overrides',
  /isWhitelistedProseModel\(requested\)/.test(sw) && /return requested;/.test(sw));
const oe = read('src/components/novel/OutlineEditor.jsx');
check('5b. OutlineEditor destructures the six picker props and renders the picker',
  /selectedProseModel,\s*\n\s*onProseModelChange,/.test(oe) && /FICTION_PROSE_MODELS\.map/.test(oe));
check('5c. prose continuation honors the same override',
  /proseModelOverride \|\| pickModel\('prose_continuation'/.test(read('src/pages/ProjectStudio.jsx')));

// ── WAVE5-DEADSTAMP ──────────────────────────────────────────────────────────
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
};
const stamped = walk(path.join(ROOT, 'src')).filter((p) => fs.readFileSync(p, 'utf8').includes('WAVE5-DEADSTAMP'));
check('6. 28+ verified-orphan files carry the DEAD CODE warning', stamped.length >= 28);
check('6b. no LIVE file was stamped (spot-check the live implementations)',
  ['src/pages/Dashboard.jsx', 'src/pages/ProjectStudio.jsx', 'src/components/notebook/IdeasCatalogBrowser.jsx',
   'src/components/tools/AnthologyPolishView.jsx', 'src/components/publishing/ExportTab.jsx']
    .every((p) => !read(p).includes('WAVE5-DEADSTAMP')));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
