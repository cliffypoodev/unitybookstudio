// SCOPINGFIX-1 acceptance battery — confine the two fiction anti-collision devices to fiction.
//
// Two devices were built to stop fiction anthologies from reusing each other's character names:
//   - USEDNAMES-1  (buildAnthologyChapterVarietyBlock): bans every OTHER story's names in the prompt.
//   - RENAMEPASS-1 (applyAnthologyNameRenames, wired in sceneWriter): renames any leaked name in the
//     FINISHED prose to a fresh one.
// Both gate on anthology-ness alone (isAnthologyProject), which is true for a NONFICTION anthology
// too. On a documented-nonfiction anthology (e.g. real reincarnation cases) that is a fabrication
// hazard: RENAMEPASS-1 would rename a real recurring name (a researcher across cases) to an invented
// one, and USEDNAMES-1 would forbid real names the story must use. This battery proves both devices
// are now scoped to FICTION anthologies and still run there. Fixtures are generic.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAnthologyChapterVarietyBlock } from '../src/lib/anthologyVarietyGuard.js';
import { isNonfictionProject } from '../src/lib/projectType.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

const mkStory = (n, name) => ({ chapter_number: n, beat_summary: JSON.stringify({ protagonist: { name }, premise: 'A standalone story.' }) });
// A collection where sibling stories own distinctive names, and the current story is #3.
const chapters = [
  mkStory(1, 'Marcus Vale'),
  mkStory(2, 'Eva Ruiz'),
  mkStory(3, 'Sophie Chen'),
  mkStory(5, 'Maria'),
  mkStory(6, 'Clara'),
];
const cur3 = chapters.find((c) => c.chapter_number === 3);

// 0 — the classification authority behaves as the whole pipeline expects.
check('0. a fiction anthology is NOT nonfiction', isNonfictionProject({ project_type: 'anthology' }) === false);
check('0. a book_type=nonfiction anthology IS nonfiction', isNonfictionProject({ project_type: 'anthology', book_type: 'nonfiction' }) === true);

// 1 — FICTION anthology: the variety block AND the banned-names block still fire (no regression).
{
  const fiction = buildAnthologyChapterVarietyBlock({ project_type: 'anthology' }, cur3, chapters);
  check('1. fiction anthology still emits the variety block', fiction.includes('ANTHOLOGY VARIETY / ANTI-TEMPLATE LOCK'));
  check('1. fiction anthology still bans sibling names', fiction.includes('BANNED CHARACTER NAMES') && ['Marcus', 'Vale', 'Eva', 'Ruiz', 'Maria', 'Clara'].every((n) => fiction.includes(n)));
  check('1. fiction anthology never bans its OWN names', !/\bSophie\b/.test(fiction.split('BANNED CHARACTER NAMES')[1] || '') && !/\bChen\b/.test(fiction.split('BANNED CHARACTER NAMES')[1] || ''));
}

// 2 — NONFICTION anthology (declared via book_type): the entire block is withheld. No dramatic
// template is imposed on real events, and no real recurring name is banned.
{
  const nf = buildAnthologyChapterVarietyBlock({ project_type: 'anthology', book_type: 'nonfiction' }, cur3, chapters);
  check('2. nonfiction anthology emits NO variety block at all', nf === '');
  check('2. nonfiction anthology emits NO banned-names line', !nf.includes('BANNED CHARACTER NAMES'));
}

// 3 — a nonfiction anthology whose nonfiction is declared on book_type even with an anthology
// project_type is still recognized (book_type wins over project_type in the authority).
{
  const nf2 = buildAnthologyChapterVarietyBlock({ book_type: 'nonfiction', project_type: 'anthology', genre: 'History' }, cur3, chapters);
  check('3. book_type=nonfiction wins over project_type=anthology -> block withheld', nf2 === '');
}

// 4 — a plain fiction novel (non-anthology) is unchanged: no block, as before.
check('4. non-anthology project returns an empty block', buildAnthologyChapterVarietyBlock({ project_type: 'novel' }, cur3, chapters) === '');

// 5 — source wiring: anthologyVarietyGuard imports the authority and gates on it.
const vg = fs.readFileSync(path.join(ROOT, 'src/lib/anthologyVarietyGuard.js'), 'utf8');
check('5. variety guard imports the nonfiction authority (relative, node-safe)', vg.includes("import { isNonfictionProject } from './projectType.js'"));
check('5. variety guard returns empty for nonfiction before building', vg.includes('if (isNonfictionProject(project)) return ') && /if \(!isAnthology\) return '';[\s\S]{0,600}if \(isNonfictionProject\(project\)\) return '';/.test(vg));

// 6 — source wiring: RENAMEPASS-1 in sceneWriter is gated to fiction anthology (isNF excluded).
const sw = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
check('6. RENAMEPASS-1 gate is fiction-anthology-only', sw.includes('if (isAnthology && !isNF) {'));
check('6. the old unconditional anthology gate is gone', !/if \(isAnthology\) \{[\s\S]{0,400}applyAnthologyNameRenames\(finalProse, chapter, allProjectChapters\)/.test(sw));
check('6. RENAMEPASS-1 still runs on finalProse (fiction path intact)', /if \(isAnthology && !isNF\) \{[\s\S]{0,400}applyAnthologyNameRenames\(finalProse, chapter, allProjectChapters\)/.test(sw));

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
