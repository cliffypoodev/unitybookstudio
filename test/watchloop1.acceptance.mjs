// WATCHLOOP-1 acceptance — the dev server must not reload the app when the app saves.
//
// MEASURED, live, on The Gilded Hour (2026-08-04). The story bible restarted from
// the beginning every few minutes and could never finish:
//
//   3:04:02  [BIBLE-PARALLEL] Starting Batch 1
//   3:06:10  [vite] connecting...  + module re-executed + Starting Batch 1
//   3:10:49  [vite] connecting...  + module re-executed + Starting Batch 1
//
// The loop: the server-store plugin writes the entity stores into <root>/data,
// which sat inside Vite's watch root with nothing excluded. Every autosave rewrote
// data/NovelProject.json (4.8 MB), Vite saw a change in its root and issued a full
// page reload, the reload killed the in-flight generation, and the restart saved
// again. The act of saving progress destroyed the progress.
//
// It is not book-specific: no project of any genre or length could complete a
// foundation on this machine. Brass Meridian's foundation predates it, which is
// why the book every gate was debugged against never showed it.
//
// This battery reads the REAL vite config and the REAL store plugin. It asserts
// the exclusion exists and that the directory being excluded is the one the app
// actually writes to — an ignore list that names the wrong directory is worse than
// none, because it looks handled.
import fs from 'fs';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const CONFIG = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const PLUGIN = fs.readFileSync(new URL('../vite-server-store-plugin.js', import.meta.url), 'utf8');
const code = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const CONFIG_CODE = code(CONFIG);

// ── the exclusion exists and is inside server.watch ──
check('the vite config declares a watcher ignore list',
  /watch\s*:\s*\{[^}]*ignored\s*:/.test(CONFIG_CODE));
const ignored = (CONFIG_CODE.match(/ignored\s*:\s*\[([^\]]*)\]/) || [])[1] || '';
check('the ignore list is non-empty', ignored.trim().length > 0, JSON.stringify(ignored));

// ── it covers the directory the app writes to ──
check('runtime state is excluded from the watcher',
  /\*\*\/data\/\*\*/.test(ignored), ignored);
check('the git directory is excluded — a commit during a run reloaded the app',
  /\*\*\/\.git\/\*\*/.test(ignored), ignored);
check('build output is excluded', /\*\*\/dist\/\*\*/.test(ignored), ignored);

// ── the excluded directory is the one the store actually writes to ──
// An ignore list naming a directory the app never touches is worse than none.
const storeDir = (code(PLUGIN).match(/path\.join\(__dirname,\s*'([^']+)'\)/) || [])[1];
check('the store plugin writes to a directory under the project root',
  storeDir === 'data', `store writes to: ${storeDir}`);
check('that exact directory is the one the watcher ignores',
  storeDir && ignored.includes(`/${storeDir}/`), `store=${storeDir} ignored=${ignored}`);

// ── the reason must survive: nothing may quietly re-enable watching ──
check('the ignore list is not commented out',
  /^\s*ignored\s*:/m.test(CONFIG_CODE.split('\n').map((l) => l.trim()).join('\n')) || /ignored\s*:/.test(CONFIG_CODE));
check('the config still pins the port the app is reached on',
  /port\s*:\s*5180/.test(CONFIG_CODE) && /strictPort\s*:\s*true/.test(CONFIG_CODE));
check('WATCHLOOP-1 records why, so the next reader does not delete it',
  /WATCHLOOP-1/.test(CONFIG));

// ── the store plugin still serves its two endpoints ──
check('the store plugin still owns /api/store/', /\/api\/store\//.test(code(PLUGIN)));
check('the store plugin still owns /api/routerheal', /\/api\/routerheal/.test(code(PLUGIN)));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
