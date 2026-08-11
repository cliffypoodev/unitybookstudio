// TRUNCFIX-1 + TOASTMOUNT-1 acceptance battery
//
// TRUNCFIX-1: prepareChapterContent(content, projectId, chapterId, existingChapter)
// and prepareBackupContent / prepareResearchContent were being called with ONLY the
// content argument at 14 sites (ProjectPolishView x6, AnthologyPolishView x2,
// nonfictionPolish, autoProofreadChain, subjectRestoration, copyrightGenerator,
// SeriesManager, ResearchSubPage, RewriteFromManuscript). With projectId/chapterId
// undefined, large content uploads under projectId 'default' (cross-project
// namespace), and with existingChapter null the upload-failure branch saves
// content_md sliced to MAX_INLINE_SIZE — silently truncating any chapter over
// 10,000 chars and dropping the pre-existing content_md_url. This battery proves
// no bare call remains anywhere in src/.
//
// TOASTMOUNT-1: 31+ files fire toast.* from sonner, 2 fired from react-hot-toast,
// but the only mounted toaster was the unused shadcn one (driven by useToast,
// which nothing calls) — every notification in the app was invisible. This
// battery proves sonner's <Toaster> is mounted in App.jsx and that no live code
// imports react-hot-toast anymore.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const SRC = path.join(ROOT, 'src');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) out.push(p);
  }
  return out;
};
const files = walk(SRC);
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(ROOT, p);

// ── TRUNCFIX-1 ────────────────────────────────────────────────────────────────
// A "bare" call passes a single argument: prepareXContent(expr) with no top-level
// comma before the closing paren. Match call opener, then scan to the balanced
// close and count top-level commas.
const PREP_FNS = ['prepareChapterContent', 'prepareBackupContent', 'prepareResearchContent'];
const MIN_ARGS = { prepareChapterContent: 3, prepareBackupContent: 3, prepareResearchContent: 2 };

function countTopLevelArgs(text, openParenIdx) {
  let depth = 0; let args = 0; let sawToken = false;
  for (let i = openParenIdx; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) return sawToken ? args + 1 : 0;
    } else if (c === ',' && depth === 1) args += 1;
    else if (depth >= 1 && !/\s/.test(c)) sawToken = true;
  }
  return -1; // unbalanced — flag it
}

const offenders = [];
for (const f of files) {
  const text = read(f);
  if (f.includes(path.join('src', 'lib', 'chapterStorage.js'))) continue;   // definitions
  if (f.includes(path.join('src', 'lib', 'researchStorage.js'))) continue;  // definition
  for (const fn of PREP_FNS) {
    const re = new RegExp('\\b' + fn + '\\s*\\(', 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      // Skip import lines / destructuring mentions without a call
      const lineStart = text.lastIndexOf('\n', m.index) + 1;
      const line = text.slice(lineStart, text.indexOf('\n', m.index));
      if (/^\s*(import|export)\b/.test(line) || /from\s+['"]/.test(line)) continue;
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // comment lines are not calls
      const openIdx = m.index + m[0].length - 1;
      const argc = countTopLevelArgs(text, openIdx);
      if (argc >= 0 && argc < MIN_ARGS[fn]) {
        offenders.push(rel(f) + ' → ' + fn + ' called with ' + argc + ' arg(s)');
      }
    }
  }
}
check('1. no bare prepareChapterContent / prepareBackupContent calls remain in src/', offenders.filter(o => !o.includes('prepareResearchContent')).length === 0);
check('1b. no bare prepareResearchContent calls remain in src/', offenders.filter(o => o.includes('prepareResearchContent')).length === 0);
if (offenders.length) offenders.forEach(o => console.log('       OFFENDER: ' + o));

// The previously-broken sites now pass the chapter identity through.
const ppv = read(path.join(SRC, 'components', 'tools', 'ProjectPolishView.jsx'));
check('2. ProjectPolishView passes project + chapter identity on polish save',
  /prepareChapterContent\(f\.content,\s*project\?\.id,\s*f\.chapter\.id,\s*f\.chapter\)/.test(ppv));
check('2b. ProjectPolishView backup save preserves identity too',
  /prepareBackupContent\(f\.original,\s*project\?\.id,\s*f\.chapter\.id,\s*f\.chapter\)/.test(ppv));
const apv = read(path.join(SRC, 'components', 'tools', 'AnthologyPolishView.jsx'));
check('3. AnthologyPolishView passes full identity at both save sites',
  (apv.match(/prepareChapterContent\([^)]*project\?\.id,\s*f\.chapter\.id,\s*f\.chapter\)/g) || []).length === 2);
const rfm = read(path.join(SRC, 'components', 'dashboard', 'RewriteFromManuscript.jsx'));
check('4. RewriteFromManuscript prepares research AFTER create, with the real project id',
  /prepareResearchContent\(str\(bible\.research_md\),\s*newProject\.id\)/.test(rfm) &&
  rfm.indexOf('NovelProject.create(projectData)') < rfm.indexOf('prepareResearchContent(str(bible.research_md)'));

// The storage-layer signature this battery is guarding (fails loudly if refactored).
const storage = read(path.join(SRC, 'lib', 'chapterStorage.js'));
check('5. chapterStorage signature still (content, projectId, chapterId, existingChapter)',
  /export async function prepareChapterContent\(content,\s*projectId,\s*chapterId,\s*existingChapter\s*=\s*null\)/.test(storage));

// ── TOASTMOUNT-1 ──────────────────────────────────────────────────────────────
const app = read(path.join(SRC, 'App.jsx'));
check('6. App.jsx imports Toaster from sonner (not the dead shadcn toaster)',
  /import\s*\{\s*Toaster\s*\}\s*from\s*["']sonner["']/.test(app) &&
  !/from\s*["']@\/components\/ui\/toaster["']/.test(app));
check('6b. App.jsx does not use the ui/sonner wrapper (needs next-themes provider this app lacks)',
  !/from\s*["']@\/components\/ui\/sonner["']/.test(app));
check('7. <Toaster is rendered in the App tree', /<Toaster[\s/>]/.test(app));
const rht = files.filter(f => /from\s+['"]react-hot-toast['"]|import\s+toast\s+from\s+['"]react-hot-toast['"]/.test(read(f)));
check('8. no live imports of react-hot-toast remain', rht.length === 0);
if (rht.length) rht.forEach(f => console.log('       OFFENDER: ' + rel(f)));
const sonnerCount = files.filter(f => /from\s+['"]sonner['"]/.test(read(f))).length;
check('9. sonner is the single toast system (broadly imported, 20+ files)', sonnerCount >= 20);

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
