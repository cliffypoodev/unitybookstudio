// ANTHOLOGYBLEED-2 acceptance battery — the shared book bible is withheld from anthology
// scene prompts.
//
// The defect (measured live 2026-08-09 on the Night Shift fiction anthology): the scene
// prose prompt injects buildFoundationBlock(project), which pushes the WHOLE-BOOK bible —
// WORLD / SETTING (world_md), CHARACTERS (characters_md), BOOK OUTLINE (outline_md, 4000
// chars), CANON / CONTINUITY (canon_md), plus mystery/twists — into every scene. For an
// anthology, outline_md is the shared all-stories outline, so Story 1's protagonist "Marcus,
// security guard" (char 258 of the outline) was visible to Story 3's writer and surfaced
// there as a namesake night-security-guard character. The fix withholds the shared
// foundation for anthology projects (isAnthologyProject); each story's own isolated context
// is delivered separately as anthologyContext (getAnthologyContext -> buildAnthologyStoryContext),
// so nothing the story needs is lost. This battery loads the REAL buildFoundationBlock out of
// source via vm and runs both branches. Fixtures are generic — no book-specific strings.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const SW = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

// Brace-match the function body starting at the first `{` AFTER the whole anchor (so a
// `= {}` default param is never mistaken for the body brace).
function fnBlock(src, anchor) {
  const a = src.indexOf(anchor);
  if (a < 0) return null;
  let i = src.indexOf('{', a + anchor.length);
  if (i < 0) return null;
  let depth = 0;
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  return src.slice(a, i);
}

const fnSrc = fnBlock(SW, 'function buildFoundationBlock(project)');
check('0. buildFoundationBlock extracted from sceneWriter source', !!fnSrc && fnSrc.includes('BOOK OUTLINE'));

// Load the REAL function into a sandbox with stubbed collaborators. The stub for
// isAnthologyProject keys off a fixture flag so we exercise buildFoundationBlock's own
// branching, not the predicate.
const sandbox = {
  String,
  isAnthologyProject: (p) => p && p.project_type === 'anthology',
  compact: (s, n) => String(s || '').slice(0, n),
  sanitizeNonfictionContextScarTissue: (s) => String(s || ''),
  buildCanonCastBlock: () => '',
  console: { log() {}, warn() {} },
};
vm.createContext(sandbox);
vm.runInContext(fnSrc + '\nthis.buildFoundationBlock = buildFoundationBlock;', sandbox);
const build = sandbox.buildFoundationBlock;
check('0. real buildFoundationBlock is callable', typeof build === 'function');

// A shared bible whose outline + characters name multiple stories' leads (the leak payload).
const sharedBible = {
  seed_concept: 'An anthology of six late-shift horror stories.',
  world_md: 'The collection spans an arena, a mansion, and a night office.',
  characters_md: 'Marcus the guard; Eva the artist; Sophie the clerk.',
  outline_md: 'Story 1: Marcus, a security guard. Story 2: Eva, an artist. Story 3: Sophie, a clerk.',
  canon_md: 'Names must stay consistent within each story.',
  mystery_md: 'Each story hides its own turn.',
  voice_md: 'Grounded, tense.',
};

// Anthology branch: foundation is fully withheld — none of the cross-story payload ships.
const anth = build({ ...sharedBible, project_type: 'anthology' });
check('1. anthology foundation block is empty (shared bible withheld)', anth === '');
check('1. no cross-story protagonist leaks (Marcus / Eva / Sophie absent)', !/Marcus|Eva|Sophie/.test(anth));
check('1. the BOOK OUTLINE header is not emitted for anthology', !anth.includes('BOOK OUTLINE'));

// Regression: a regular novel still receives its full foundation (no over-broad blanking).
const novel = build({ ...sharedBible, project_type: 'novel' });
check('2. non-anthology foundation still emits WORLD / SETTING', novel.includes('WORLD / SETTING'));
check('2. non-anthology foundation still emits CHARACTERS', novel.includes('CHARACTERS'));
check('2. non-anthology foundation still emits BOOK OUTLINE', novel.includes('BOOK OUTLINE'));
check('2. non-anthology foundation still carries the field content', novel.includes('Marcus, a security guard'));
check('2. non-anthology foundation is non-empty', novel.length > 100);

// Source wiring asserts.
check('3. ANTHOLOGYBLEED-2 marker present in sceneWriter', SW.includes('ANTHOLOGYBLEED-2'));
check('3. guard withholds the bible via isAnthologyProject', /if \(isAnthologyProject\(project\)\) return '';/.test(SW));
check('3. guard runs BEFORE the first bible push', (() => {
  const g = fnSrc.indexOf("if (isAnthologyProject(project)) return '';");
  const p = fnSrc.indexOf('parts.push');
  return g > -1 && p > -1 && g < p;
})());
check('3. isAnthologyProject is imported into sceneWriter', /isAnthologyProject\b/.test(SW.split('\n').filter((l) => l.includes('import') || l.trim().startsWith('isAnthologyProject')).join('\n')) || SW.includes('isAnthologyProject,'));

// Design invariant: the per-story isolated context is still delivered alongside the (now
// blanked-for-anthology) foundation, so a standalone story is never left context-starved.
check('4. both prose builders still pass foundationBlock', (SW.match(/foundationBlock,/g) || []).length >= 2);
check('4. both prose builders still pass anthologyContext', (SW.match(/anthologyContext,/g) || []).length >= 2);

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
