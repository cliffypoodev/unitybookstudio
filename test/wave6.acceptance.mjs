// WAVE6 acceptance battery — the two bugs found by the end-to-end browser run.
//
//   WAVE6-GENREKEEP  picking a genre no longer wipes explicitly-set length /
//                    narration / intensity choices
//   WAVE6-DEADGATE   scene_execution_flags is a declared field with a real UI
//                    surface (still OFF by default, deliberately)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

// ── the underlying library behaviour is deliberately UNCHANGED ───────────────
// applyGenreDefaults still returns a full genre preset (correct for a fresh
// project); the fix lives at the call site, which now refuses to let those
// defaults clobber fields the author edited.
const an = read('src/lib/autonovel.js');
check('1. applyGenreDefaults still supplies genre targets (library untouched)',
  /chapter_target: defaults\.chapters/.test(an) && /chapter_length_target: chapterLengthTarget/.test(an));

// ── the fix: ProjectStudio preserves what the author actually edited ─────────
const ps = read('src/pages/ProjectStudio.jsx');
check('2. a touched-field registry exists',
  /userTouchedSetupFieldsRef = React\.useRef\(new Set\(\)\)/.test(ps) && /markSetupFieldsTouched/.test(ps));
check('2b. every Setup field edit marks the field as touched',
  /const handleSettingFieldChange = \(field, value\) => \{\s*\n\s*markSetupFieldsTouched\(field\);/.test(ps));
check('2c. the length + POV presets mark their fields too',
  /markSetupFieldsTouched\('chapter_length_preset', 'chapter_length_target'\)/.test(ps) &&
  /markSetupFieldsTouched\('pov_mode', 'tense'\)/.test(ps));
check('3. handleGenreChange preserves touched fields over genre defaults',
  /GENRE_DEFAULTED_FIELDS/.test(ps) &&
  /if \(!userTouchedSetupFieldsRef\.current\.has\(field\)\) continue;/.test(ps) &&
  /\.\.\.preserved,/.test(ps));
check('3b. preserved values are applied LAST (they must win over the genre spread)',
  (() => {
    const i = ps.indexOf('const handleGenreChange');
    const body = ps.slice(i, i + 4000);
    return body.indexOf('...preserved,') > body.indexOf('tense: suggestion.tense');
  })());
check('3c. the whole length/narration/intensity block is covered',
  ['chapter_target', 'chapter_length_target', 'chapter_length_preset', 'total_word_target',
   'pov_mode', 'tense', 'beat_style', 'spice_level', 'violence_level', 'erotica_register',
   'nf_structure_mode'].every((f) => new RegExp(`\\b${f}:`).test(ps.slice(ps.indexOf('GENRE_DEFAULTED_FIELDS'), ps.indexOf('GENRE_DEFAULTED_FIELDS') + 900))));
check('3d. the author is told what was kept, rather than it happening silently',
  /defaults applied — kept your/.test(ps));
check('3e. empty/unset values are never "preserved" (untouched projects still get defaults)',
  /if \(v === undefined \|\| v === null \|\| v === ''\) continue;/.test(ps));

// ── WAVE6-DEADGATE ───────────────────────────────────────────────────────────
const schemaRaw = read('base44/entities/NovelProject.jsonc')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const schema = JSON.parse(schemaRaw);
check('4. scene_execution_flags is declared on NovelProject', !!schema.properties.scene_execution_flags);
check('4b. NovelProject schema still parses as JSON', !!schema.properties.title);

const gc = read('src/lib/generationContext.js');
check('5. feature keys carry human-facing labels for the UI',
  /SCENE_EXECUTION_FEATURE_INFO/.test(gc) && /start here|recommended: true/.test(gc));
check('5b. defaults are UNCHANGED — every feature still ships disabled',
  (gc.match(/defaultEnabled: false/g) || []).length === 6 &&
  !/defaultEnabled: true/.test(gc));

const st = read('src/components/notebook/SetupTab.jsx');
check('6. Setup renders a real toggle surface for the gates',
  /function SceneExecutionGates/.test(st) && /<SceneExecutionGates values=\{values\} onFieldChange=\{onFieldChange\} \/>/.test(st));
check('6b. toggles write project.scene_execution_flags',
  /onFieldChange\('scene_execution_flags', \{ \.\.\.flags, \[key\]: on \}\)/.test(st));
check('6c. the UI states the risk instead of quietly enabling things',
  /not been proven on a full book/.test(st) && /all off \(default\)/.test(st));
check('7. scene_execution_flags is a tracked setting so it saves with the project',
  /'scene_execution_flags',/.test(ps));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
