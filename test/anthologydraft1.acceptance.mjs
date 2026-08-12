// BEATIDCANON-1 + ANTHOLOGYJSON-1 acceptance battery — anthology drafting hardening.
//
// Two defects, measured live 2026-08-09 building the "Night Shift" fiction anthology:
//
//   BEATIDCANON-1 (ProjectStudio.jsx): the architect model (esp. deepseek-r1-14b after
//   ARCHITECTSPEED-1) emits loose scene ids — "ch1-s1" for Chapter 2, non-zero-padded,
//   and frequently omits scene_goal/entry_state/exit_state/required_events. The NO-RETRY
//   scene-beat contract validator (validateSceneBeatContracts) rejects those and kills
//   EVERY story. scene_id/scene_number are positional facts of the chapter, not model
//   opinions, so the fix assigns them deterministically before validation and backfills
//   the four required narrative fields with generic placeholders.
//
//   ANTHOLOGYJSON-1 (chapterCreator.js): anthology stories store their full structured
//   plan as a JSON object in beat_summary. cleanSummary truncated any beat_summary over
//   1400 chars, producing UNTERMINATED JSON that parseStoryData cannot read — so story 6
//   drafted with no premise/protagonist/setting. The fix skips truncation for JSON
//   objects (the 1400-char cap is for human-readable summaries only).
//
// Both proofs load the REAL shipped functions out of source via vm (validateSceneBeatContracts
// and cleanSummary), then run the actual failing inputs. Fixtures are generic — no
// book-specific strings.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

const PS = fs.readFileSync(path.join(ROOT, 'src/pages/ProjectStudio.jsx'), 'utf8');
const GC = fs.readFileSync(path.join(ROOT, 'src/lib/generationContext.js'), 'utf8');
const CC = fs.readFileSync(path.join(ROOT, 'src/lib/chapterCreator.js'), 'utf8');

// Brace-match a block starting at the first `{` at/after `anchor`. All the blocks we
// slice contain only balanced braces (template `${...}` are balanced; no stray braces
// in strings/regex/comments), so a depth counter is exact here.
function braceBlockAfter(src, anchor, includeSignature) {
  const a = src.indexOf(anchor);
  if (a < 0) return null;
  // Search for the body brace AFTER the whole anchor, so a `= {}` default param inside a
  // function signature is never mistaken for the body's opening brace.
  let i = src.indexOf('{', a + anchor.length);
  if (i < 0) return null;
  const blockStart = i;
  let depth = 0;
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  return src.slice(includeSignature ? a : blockStart, i);
}

// ─────────────────────────────────────────────────────────────────────────────
// Load the REAL validateSceneBeatContracts (+ its in-file deps) into a sandbox.
// ─────────────────────────────────────────────────────────────────────────────
const gcParts = [
  braceBlockAfter(GC, 'class GenerationContextError extends Error', true),
  braceBlockAfter(GC, 'function text(value)', true),
  braceBlockAfter(GC, 'function sceneBeatsFrom(value)', true),
  braceBlockAfter(GC, 'function validateSceneBeatContracts(value, options = {})', true),
];
check('0. validator + deps extracted from generationContext source', gcParts.every(Boolean));

const gcSandbox = { String, Number, Object, Array, Math, JSON, Error, RegExp, Set, Boolean, console: { log() {}, warn() {} } };
vm.createContext(gcSandbox);
vm.runInContext(gcParts.join('\n\n') + '\nthis.validateSceneBeatContracts = validateSceneBeatContracts;', gcSandbox);
const validate = gcSandbox.validateSceneBeatContracts;
check('0. real validateSceneBeatContracts is callable', typeof validate === 'function');

// Load the REAL canonicalization block from ProjectStudio as an executable function.
const canonBlock = braceBlockAfter(PS, '// BEATIDCANON-1', false); // just the `{ ... }` block
check('0. BEATIDCANON-1 block extracted from ProjectStudio source', !!canonBlock && canonBlock.includes('_el.scene_id'));
// eslint-disable-next-line no-new-func
const applyCanon = new Function('beatResult', 'chapter', canonBlock);

// ─────────────────────────────────────────────────────────────────────────────
// BEATIDCANON-1 — behavioral proof against the REAL validator.
// ─────────────────────────────────────────────────────────────────────────────

// Control: the exact live failure shape — a loose id for the wrong chapter, missing
// required fields — is rejected by the REAL validator with the observed message.
let ctlRejected = false; let ctlMsg = '';
try {
  validate({ beats: [{ scene_id: 'ch1-s1', scene_number: 1 }, { scene_id: 'ch1-s2', scene_number: 2 }] }, { chapterNumber: 2 });
} catch (e) { ctlRejected = e.code === 'SCENE_CONTRACT_INVALID'; ctlMsg = e.message || ''; }
check('1. control: malformed architect beats are rejected by the REAL validator', ctlRejected);
check('1. control: real validator emits the exact observed "does not belong to Chapter 2" failure', /does not belong to Chapter 2/.test(ctlMsg));

// Fix: the same malformed beats, after the shipped canonicalization, PASS the REAL validator.
const fixed = { beats: [{ scene_id: 'ch1-s1', scene_number: 1 }, { scene_id: 'ch1-s2', scene_number: 2 }] };
applyCanon(fixed, { chapter_number: 2 });
let fixedOk = false; let sceneCount = 0;
try { const r = validate(fixed, { chapterNumber: 2 }); fixedOk = r.ok === true; sceneCount = r.sceneCount; } catch { fixedOk = false; }
check('2. BEATIDCANON-1: canonicalized beats PASS the REAL validator', fixedOk && sceneCount === 2);
check('2. scene_ids are chapter-correct and zero-padded', fixed.beats[0].scene_id === 'ch02-s01' && fixed.beats[1].scene_id === 'ch02-s02');
check('2. scene_number equals 1-based position', fixed.beats[0].scene_number === 1 && fixed.beats[1].scene_number === 2);
check('2. the four required narrative fields are backfilled', !!fixed.beats[0].scene_goal && !!fixed.beats[0].entry_state && !!fixed.beats[0].exit_state && Array.isArray(fixed.beats[0].required_events) && fixed.beats[0].required_events.some((e) => String(e || '').trim()));
check('2. first scene entry_state opens the story; later scenes continue', /opens/i.test(fixed.beats[0].entry_state) && /continues/i.test(fixed.beats[1].entry_state));

// A bare-array container (the other shape validate() is called with at the site) is also
// handled, and totally-empty beats are still made valid.
const arr = [{}, {}, {}];
applyCanon(arr, { chapter_number: 5 });
let arrOk = false;
try { arrOk = validate(arr, { chapterNumber: 5 }).ok === true; } catch { arrOk = false; }
check('3. bare-array container canonicalizes and PASSES', arrOk && arr[2].scene_id === 'ch05-s03' && arr[2].scene_number === 3);

// Provenance guard: the pipeline compares the fixed ids against extraction. The fix does
// not create id/number gaps — every position is contiguous 1..N.
const nums = arr.map((b) => b.scene_number);
check('3. scene_numbers are contiguous 1..N (no SCENE_SEQUENCE_GAP)', JSON.stringify(nums) === JSON.stringify([1, 2, 3]));

// Source-assert the wiring: the block runs after the nonfiction break and before the raw
// capture, on the fiction path only.
check('4. BEATIDCANON-1 marker present in ProjectStudio', PS.includes('BEATIDCANON-1'));
check('4. runs AFTER the nonfiction break and BEFORE the raw-structure capture',
  PS.indexOf('if (isNonfiction) break;') < PS.indexOf('BEATIDCANON-1')
  && PS.indexOf('BEATIDCANON-1') < PS.indexOf('CAPTURE RAW ARCHITECT STRUCTURE'));
check('4. assigns positional scene_id and scene_number', PS.includes('_el.scene_id = `ch${_cn}-s${String(_i + 1).padStart(2, \'0\')}`') && PS.includes('_el.scene_number = _i + 1;'));
check('4. backfills required_events from scene_goal', PS.includes('_el.required_events = ['));

// ─────────────────────────────────────────────────────────────────────────────
// ANTHOLOGYJSON-1 — behavioral proof against the REAL cleanSummary.
// ─────────────────────────────────────────────────────────────────────────────
const ccBody = [
  braceBlockAfter(CC, 'function safeText(value)', true),
  braceBlockAfter(CC, 'function cleanSummary(value)', true),
].join('\n\n');
const ccSandbox = { String, RegExp, console: { log() {} } };
vm.createContext(ccSandbox);
vm.runInContext(ccBody + '\nthis.cleanSummary = cleanSummary;', ccSandbox);
const cleanSummary = ccSandbox.cleanSummary;
check('5. real cleanSummary is callable', typeof cleanSummary === 'function');

// An oversized anthology story JSON (mirrors storiesToChapterPlans output) survives intact.
const bigStory = JSON.stringify({
  premise: 'A late shift at a rundown facility goes wrong. '.repeat(40),
  protagonist: 'A tired security guard named Reyes',
  setting: 'A decommissioned data center, 2 a.m.',
  conflict: 'Something is on the cameras that should not be there.',
  twist: 'The intruder is a copy of Reyes.',
  ending_type: 'ambiguous',
  thematic_angle: 'identity and exhaustion',
  pov: 'first',
  tense: 'past',
  tone: 'paranoid noir',
  target_words: 1500,
});
check('5. fixture JSON is over the 1400-char cap', bigStory.length > 1400);
const cleanedBig = cleanSummary(bigStory);
check('6. ANTHOLOGYJSON-1: oversized JSON story is NOT truncated', cleanedBig.length === bigStory.length && !cleanedBig.endsWith('…'));
let parsedBig = null;
try { parsedBig = JSON.parse(cleanedBig); } catch { parsedBig = null; }
check('6. cleaned JSON still parses and keeps anthology fields', !!parsedBig && parsedBig.protagonist.includes('Reyes') && parsedBig.thematic_angle === 'identity and exhaustion');
check('6. JSON wrapped in whitespace is still recognized', (() => { try { return !!JSON.parse(cleanSummary('  \n' + bigStory + '\n ')); } catch { return false; } })());

// Control: a long NON-JSON human summary is still truncated (the cap still bites prose).
const longProse = 'The committee met in the county hall and recorded the vote. '.repeat(40);
check('5. prose fixture is over the cap', longProse.length > 1400);
const cleanedProse = cleanSummary(longProse);
check('7. ANTHOLOGYJSON-1: long non-JSON summary is STILL truncated with an ellipsis', cleanedProse.length < longProse.length && cleanedProse.length <= 1401 && cleanedProse.endsWith('…'));

// Regression: cleanSummary still strips label prefixes for ordinary summaries.
check('7. cleanSummary still strips a leading "Summary:" label', cleanSummary('Summary: hello world') === 'hello world');

// Source-assert the guard.
check('8. ANTHOLOGYJSON-1 marker present in chapterCreator', CC.includes('ANTHOLOGYJSON-1'));
check('8. truncation is gated behind a JSON-object check', CC.includes('!_looksJson && out.length > 1400'));

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
