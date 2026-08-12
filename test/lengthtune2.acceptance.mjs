// LENGTHTUNE-2 acceptance battery — anthology scene-count is capped to the target by merging.
//
// The defect (measured live 2026-08-09/10 on Night Shift): qwen3.6-35b writes ~1100-1300 words
// per scene almost regardless of the per-scene target, so a story's length tracks its SCENE
// COUNT, and the architect over-generates scenes for short pieces (asks ~2, returns 3-7).
// Result: anthology stories ran 1900-3361 words against a 1500 target (CH3 = 3361). The fix
// (ProjectStudio.jsx, fiction-anthology only, before BEATIDCANON-1) caps the scene count to
// ~round(target/1200) by MERGING excess beats into that many contiguous groups: every plot
// beat's required_events is preserved (union), entry_state comes from the group's first beat,
// exit_state from its last. This battery loads the REAL block out of source and runs it.
// Fixtures are generic — no book-specific strings.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const PS = fs.readFileSync(path.join(ROOT, 'src/pages/ProjectStudio.jsx'), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

// Extract the full `if (isAnthologyProject(promptProject)) { ... }` statement that follows the
// LENGTHTUNE-2 marker, brace-matched.
function lenBlock(src) {
  const m = src.indexOf('// LENGTHTUNE-2');
  const s = src.indexOf('if (isAnthologyProject(promptProject)) {', m);
  if (m < 0 || s < 0) return null;
  let i = src.indexOf('{', s);
  let depth = 0;
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  return src.slice(s, i);
}

const blockSrc = lenBlock(PS);
check('0. LENGTHTUNE-2 block extracted from ProjectStudio source', !!blockSrc && blockSrc.includes('_lc.splice'));
// eslint-disable-next-line no-new-func
const applyLen = new Function('beatResult', 'chapter', 'promptProject', 'isAnthologyProject', blockSrc);
const isAnth = (p) => p && p.project_type === 'anthology';

// Build N generic beats with distinct events.
const mkBeats = (n) => Array.from({ length: n }, (_, i) => ({
  scene_id: 'raw', scene_number: i + 1,
  scene_goal: `goal${i + 1}`,
  entry_state: `entry${i + 1}`,
  exit_state: `exit${i + 1}`,
  required_events: [`e${i + 1}a`, `e${i + 1}b`],
  forbidden_events: [`f${i + 1}`],
  setting: `place${i + 1}`,
}));
const allEvents = (beats) => beats.flatMap((b) => b.required_events);

// 1 — anthology, target 1500 -> cap round(1500/1200)=1 : seven beats merge into ONE scene.
{
  const beats = mkBeats(7);
  const originalEvents = allEvents(beats);
  const beatResult = { beats: [...beats] };
  applyLen(beatResult, {}, { project_type: 'anthology', chapter_length_target: 1500 }, isAnth);
  const out = beatResult.beats;
  check('1. 1500 target collapses 7 beats to a single scene', out.length === 1);
  check('1. merged scene entry_state = first beat entry', out[0].entry_state === 'entry1');
  check('1. merged scene exit_state = last beat exit', out[0].exit_state === 'exit7');
  const merged = new Set(out.flatMap((s) => s.required_events));
  check('1. NO plot event dropped (every original required_event survives)', originalEvents.every((e) => merged.has(e)));
  check('1. merged scene_goal spans first and last beat', out[0].scene_goal.includes('goal1') && out[0].scene_goal.includes('goal7'));
}

// 2 — anthology, target 3600 -> cap round(3600/1200)=3 : seven beats merge into THREE scenes.
{
  const beats = mkBeats(7);
  const originalEvents = allEvents(beats);
  const beatResult = { beats: [...beats] };
  applyLen(beatResult, {}, { project_type: 'anthology', chapter_length_target: 3600 }, isAnth);
  const out = beatResult.beats;
  check('2. 3600 target caps to 3 scenes', out.length === 3);
  const merged = out.flatMap((s) => s.required_events);
  check('2. union of the 3 scenes still holds every original event', originalEvents.every((e) => merged.includes(e)));
  check('2. groups are contiguous (scene 1 opens on beat 1)', out[0].entry_state === 'entry1');
  check('2. final scene closes on the last beat', out[2].exit_state === 'exit7');
}

// 3 — already at/under the cap: untouched.
{
  const beatResult = { beats: mkBeats(1) };
  applyLen(beatResult, {}, { project_type: 'anthology', chapter_length_target: 1500 }, isAnth);
  check('3. a story already within the cap is left unchanged', beatResult.beats.length === 1 && beatResult.beats[0].scene_goal === 'goal1');
}

// 4 — NON-anthology is never capped (regular novels keep the architect's scene count).
{
  const beatResult = { beats: mkBeats(7) };
  applyLen(beatResult, {}, { project_type: 'novel', chapter_length_target: 1500 }, isAnth);
  check('4. non-anthology beats are untouched', beatResult.beats.length === 7);
}

// 5 — bare-array beatResult container is also handled (mutated in place).
{
  const beatResult = mkBeats(5);
  applyLen(beatResult, {}, { project_type: 'anthology', chapter_length_target: 1500 }, isAnth);
  check('5. bare-array container merges in place to the cap', beatResult.length === 1);
}

// 6 — source wiring: runs on the fiction anthology path, before BEATIDCANON-1, after the nf break.
check('6. LENGTHTUNE-2 marker present', PS.includes('LENGTHTUNE-2'));
check('6. gated on isAnthologyProject', /LENGTHTUNE-2[\s\S]{0,900}if \(isAnthologyProject\(promptProject\)\)/.test(PS));
check('6. cap derived from target/1200', PS.includes('Math.round(_lt / 1200)'));
check('6. runs AFTER the nonfiction break and BEFORE BEATIDCANON-1',
  PS.indexOf('if (isNonfiction) break;') < PS.indexOf('LENGTHTUNE-2')
  && PS.indexOf('LENGTHTUNE-2') < PS.indexOf('BEATIDCANON-1'));

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
