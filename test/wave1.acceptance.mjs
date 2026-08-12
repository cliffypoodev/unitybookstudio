// WAVE1 acceptance battery — seven user-facing breakage fixes.
//
//   WAVE1-PERSONAS      real persona CRUD + real useUserSettings hook + focus fix
//   WAVE1-FOLDERORPHAN  deleting a parent folder re-parents child folders
//   WAVE1-UPLOADZONE    CriticSubPage upload no longer throws onFileSelect TypeError
//   WAVE1-CREATECATCH   Dashboard project create failure surfaces a toast
//   WAVE1-CHATLOCK      IdeasChatbot catalog failure no longer disables Send forever
//   WAVE1-EXPANDPRETRY  handleExpand pre-save awaits are inside its try/catch
//   WAVE1-AUTOSAVECATCH failed autosaves surface a toast instead of vanishing
//   WAVE1-BACKUPBODY    DOCX backup filters to body chapters via isBodyChapter
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

// ── WAVE1-PERSONAS ────────────────────────────────────────────────────────────
const us = read('src/lib/userSettings.js');
check('1. useUserSettings is a real hook (useState-backed)',
  /export function useUserSettings\(\)\s*{[\s\S]*?useState\(/.test(us));
check('1b. personas persist to their own localStorage key',
  /PERSONAS_KEY\s*=\s*'unitybookstudio_local_author_personas'/.test(us) &&
  /localStorage\.setItem\(PERSONAS_KEY/.test(us));
check('1c. persona CRUD is exported from the hook (add/update/delete/setActive)',
  ['addPersona', 'updatePersona', 'deletePersona', 'setActivePersona'].every((k) => us.includes(k)));
check('1d. deleting the active persona falls back to a surviving one',
  /active_persona_id === id/.test(us));

const sm = read('src/components/notebook/SettingsModal.jsx');
check('2. the four console.warn persona stubs are gone',
  !/not persisted in local mode/.test(sm));
check('2b. modal wires CRUD from the hook, not local stubs',
  /deletePersona, setActivePersona\s*}\s*=\s*useUserSettings\(\)/.test(sm));
check('2c. PersonaField is module-level (no component defined inside PersonasTab)',
  /function PersonaField\(\{/.test(sm) && !/const Field = \(/.test(sm));
check('2d. all persona field call sites pass draft/setDraft to the stable component',
  (sm.match(/<PersonaField draft=\{draft\} setDraft=\{setDraft\}/g) || []).length >= 18);
check('2e. saveEdit validates a name and wraps persistence in try/catch',
  /Give the persona a name or pen name first/.test(sm) && /Could not save persona/.test(sm));

// ── WAVE1-BACKUPBODY ──────────────────────────────────────────────────────────
check('3. DOCX backup filters via isBodyChapter (import no longer dangling)',
  /chapterHasContent\(ch\) && isBodyChapter\(ch\)/.test(sm));

// ── WAVE1-FOLDERORPHAN ────────────────────────────────────────────────────────
const dash = read('src/pages/Dashboard.jsx');
check('4. folder delete re-parents child folders before deleting',
  /childFolders = folders\.filter\(f => f\.parent_id === folderId\)/.test(dash) &&
  /ProjectFolder\.update\(cf\.id, \{ parent_id: deletedFolder\?\.parent_id \|\| '' \}\)/.test(dash));
check('4b. re-parenting happens BEFORE the delete call',
  dash.indexOf('childFolders = folders.filter') < dash.indexOf('ProjectFolder.delete(folderId)'));

// ── WAVE1-CREATECATCH ─────────────────────────────────────────────────────────
check('5. handleCreateProject has a catch that toasts',
  /Could not create the project/.test(dash));
check('5b. Dashboard imports toast from sonner', /from 'sonner'/.test(dash));

// ── WAVE1-UPLOADZONE ──────────────────────────────────────────────────────────
const critic = read('src/components/tools/CriticSubPage.jsx');
check('6. CriticSubPage passes onFileSelect (UploadZone API), not onFileLoaded',
  /<UploadZone onFileSelect=\{handleFileSelect\} uploading=\{uploading\}/.test(critic) &&
  !/onFileLoaded=/.test(critic));
check('6b. handler parses the file and normalizes .text/.title for downstream reads',
  /parseDocxFile\(file\)/.test(critic) && /text: parsed\.fullText/.test(critic));
check('6c. parse failure surfaces a toast and clears the uploading state',
  /Parse failed/.test(critic) && /finally\s*{\s*setUploading\(false\)/.test(critic));

// ── WAVE1-CHATLOCK ────────────────────────────────────────────────────────────
const chat = read('src/components/notebook/IdeasChatbot.jsx');
const searchIdx = chat.indexOf('await searchCatalog(');
const tryBefore = chat.lastIndexOf('try {', searchIdx);
const genIdx = chat.indexOf('setIsGenerating(true)');
check('7. searchCatalog await is inside a try block (after setIsGenerating)',
  searchIdx > -1 && tryBefore > genIdx);
check('7b. catalog failure degrades gracefully (context skipped, chat continues)',
  /Catalog context skipped/.test(chat));

// ── WAVE1-EXPANDPRETRY ────────────────────────────────────────────────────────
const ps = read('src/pages/ProjectStudio.jsx');
const expandIdx = ps.indexOf('const handleExpand = async ()');
const expandBlock = ps.slice(expandIdx, expandIdx + 3000);
const tryIdx = expandBlock.indexOf('try {');
const prepIdx = expandBlock.indexOf('await prepareSeedConcept');
const resolveIdx = expandBlock.indexOf('await resolveSeedConcept');
check('8. handleExpand pre-save awaits sit INSIDE the try block',
  tryIdx > -1 && prepIdx > tryIdx && resolveIdx > tryIdx);

// ── WAVE1-AUTOSAVECATCH ───────────────────────────────────────────────────────
const auto = read('src/hooks/useAutoSave.js');
check('9. useAutoSave wraps the save in try/catch and toasts on failure',
  /try\s*{\s*await onSaveRef\.current\(\);/.test(auto) && /Autosave failed/.test(auto));
check('9b. lastSaved is only stamped on SUCCESS',
  auto.indexOf('await onSaveRef.current()') < auto.indexOf('setLastSaved(Date.now())') &&
  /try\s*{[\s\S]*?setLastSaved\(Date\.now\(\)\);[\s\S]*?}\s*catch/.test(auto));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
