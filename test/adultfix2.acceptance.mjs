// ADULTFIX-2 acceptance battery — the four fixes from the 2026-08-13 erotica-anthology
// live run (ADULTTEST-1, project drafted 5/6 at tip 860395b):
//
//   BEATCAP-1  Ch.6 could never draft: the fiction scene contract had ONE compaction tier
//              and a hard refusal at 6500c. The uncensored 35B (ADULTROUTE-1) writes far
//              more verbose beats than R1 — measured live: 7936c pretty / 6889c minified.
//              Fix: tier-2 proportional compaction (every contract field kept, per-field
//              caps scaled to the measured overflow with floors) and tier-3 bare
//              (optional arrays dropped), mirroring the nonfiction ladder. Pathological
//              contracts still fail closed.
//   NAMEREG-1  Prose-invented side characters and rename targets leaked across stories
//              (measured live: "Julian" heavy in two stories' prose; "Sidney" introduced
//              as a rename target in one story, reused organically in another). Fix: the
//              finished prose's prominent names persist on the chapter as prose_names;
//              the variety guard bans them and the rename pass de-collides against them.
//   SHELLCAP-1 The anthology collection shell timed out at 90s on every attempt — the cap
//              was calibrated for terse R1, not the 35B. Raised to 300s; still non-fatal.
//   COPYFIX-1  The New Project Erotica card promised "Routes to Lumimaid" — a model
//              removed by REMOVED_LUMIMAID_MODELS.
//
// Fixtures are generic. No book-specific strings.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyAnthologyNameRenames, collectAnthologyNames, extractProminentProseNames } from '../src/lib/anthologyRenamePass.js';
import { buildAnthologyChapterVarietyBlock } from '../src/lib/anthologyVarietyGuard.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── BEATCAP-1: run the REAL compactor, sliced from the live ProjectStudio source ──
const STUDIO = fs.readFileSync(path.join(ROOT, 'src/pages/ProjectStudio.jsx'), 'utf8');
const seg = (start, stop) => { const i = STUDIO.indexOf(start); if (i < 0 || STUDIO.indexOf(stop, i) < 0) throw new Error('segment not found: ' + start.slice(0, 40)); return STUDIO.slice(i, STUDIO.indexOf(stop, i)); };
const harness = [
  seg('const SCENE_BEATS_ENTITY_CHAR_LIMIT', '// SEQFIX-1'),
  seg('function safeJsonParseProjectStudio', 'function extractSceneBeatUnitsForValidation'),
  seg('function compactSceneBeatsForEntity', 'function buildNameHygieneEnhancedProject'),
].join('\n') + '\nexport { compactSceneBeatsForEntity, SCENE_BEATS_ENTITY_CHAR_LIMIT };\n';
const { compactSceneBeatsForEntity, SCENE_BEATS_ENTITY_CHAR_LIMIT } =
  await import('data:text/javascript;base64,' + Buffer.from(harness).toString('base64'));

const ev = (n, len) => Array.from({ length: n }, (_, i) => ('Person A and Person B perform detailed physical action number ' + (i + 1) + ' involving equipment and emotional shift inside the structure while weather continues outside '.repeat(2)).slice(0, len));
const verboseBeat = (num, nEvents) => ({
  scene_number: num, scene_id: `ch06-s0${num}`,
  scene_goal: 'Establish the hostile sterile environment and guarded authority over the structure systems during the storm night, forcing proximity between the two leads.',
  entry_state: 'Person A is trapped in the lower maintenance bay, soaked by rain and seawater, shivering violently. The external storm is raging with forty mph winds. The internal airlock door is heavy steel, sealed tight, and the interior temperature is dropping.',
  required_events: ev(nEvents, 210), forbidden_events: ev(2, 120),
  exit_state: 'Person A is alone in the dim, humming machine room, wrapped in a thin wool blanket, watching Person B work at the main junction box while the temperature drops rapidly toward freezing.',
  continuity_dependencies: ev(2, 110),
  pov_character: 'Person A', setting: 'A remote structure, machine room. Night. Storm.',
  characters_present: ['Person A', 'Person B'], props_present: ['tool', 'cable', 'blanket'],
  conflict: 'Person A needs shelter and heat; Person B controls both and trusts no one, so every degree of warmth has to be negotiated.',
  emotional_arc: 'From desperate survival to annoyed confinement to reluctant attraction.',
  tension_level: 8, exit_hook: 'The ten-minute voltage window forces them to stay in contact.', word_target: 1166,
});

// 1. The measured failure class (3 verbose beats, 9-12 long events) now SAVES.
let out = null, threw = null;
try { out = compactSceneBeatsForEntity({ beats: [verboseBeat(1, 9), verboseBeat(2, 9), verboseBeat(3, 12)] }, { chapter_number: 6, title: 'Generic Story Six' }); } catch (e) { threw = e; }
check('1. verbose 3-beat contract (measured Ch6 class) compacts instead of refusing', out !== null && !threw, threw && threw.message);
const parsed = out ? JSON.parse(out) : { beats: [] };
check('2. compacted contract fits the entity cap', out !== null && out.length <= SCENE_BEATS_ENTITY_CHAR_LIMIT, out && `len=${out.length}`);
check('3. compact_version marks a BEATCAP-1 tier', /fiction-scene-contract-v1-(tight|bare)/.test(parsed.compact_version || ''));
const lastBeat = parsed.beats[parsed.beats.length - 1] || {};
check('4. state-machine fields survive compaction', ['scene_id', 'scene_goal', 'entry_state', 'required_events', 'exit_state', 'pov_character', 'conflict', 'exit_hook'].every((k) => lastBeat[k] !== undefined));
check('5. required_events keep at least 5 entries', Array.isArray(lastBeat.required_events) && lastBeat.required_events.length >= 5);

// 6. Small terse contracts still use tier-1 untouched.
const small = compactSceneBeatsForEntity({ beats: [{ ...verboseBeat(1, 4), required_events: ev(4, 80), entry_state: 'short', exit_state: 'short' }] }, { chapter_number: 1, title: 'T' });
check('6. terse contracts still save as tier-1 fiction-scene-contract-v1', JSON.parse(small).compact_version === 'fiction-scene-contract-v1');

// 7. Pathological contracts still fail CLOSED.
let pathoThrew = null;
try { compactSceneBeatsForEntity({ beats: Array.from({ length: 30 }, (_, i) => verboseBeat(i + 1, 12)) }, { chapter_number: 9, title: 'Huge' }); } catch (e) { pathoThrew = e; }
check('7. pathological 30-beat contract still refuses (fail-safe preserved)', pathoThrew?.name === 'NarrativeContractError');

// ── NAMEREG-1: runtime, generic fixtures ──
const proseA = `Dorian shut the door. The storm was loud. Dorian looked at Wren. She said nothing. Wren waited. Dorian sat. Wren poured coffee for Dorian and for the visitor named Callum. Callum smiled. Callum left early. She watched the storm.`;
const extracted = extractProminentProseNames(proseA);
check('8. extractor finds recurring prose names', extracted.includes('Dorian') && extracted.includes('Wren') && extracted.includes('Callum'));
check('9. extractor ignores sentence-start common words', !extracted.some((n) => ['The', 'She', 'Storm'].includes(n)));

const ch1 = { chapter_number: 1, beat_summary: JSON.stringify({ protagonist: { name: 'Alpha One' } }), prose_names: JSON.stringify(['Julian', 'Dorian']) };
const ch3 = { chapter_number: 3, beat_summary: JSON.stringify({ protagonist: { name: 'Gamma Three' } }) };
const { others } = collectAnthologyNames(ch3, [ch1, ch3]);
check('10. sibling prose_names count as other-story names', others.has('Julian') && others.has('Dorian'));

const res3 = applyAnthologyNameRenames('Gamma stood. Julian brought the ledger. Julian waited. Gamma read while Julian paced. Julian left.', ch3, [ch1, ch3]);
check('11. a prose-invented sibling name is renamed in a later story', res3.renames.some((r) => r.from === 'Julian') && !/\bJulian\b/.test(res3.prose));

const fictionAnthology = { project_type: 'anthology', book_type: 'fiction', genre: 'Erotica', anthology_theme: 'generic theme' };
const block = buildAnthologyChapterVarietyBlock(fictionAnthology, ch3, [ch1, ch3]);
const bannedLine = block.split('\n').find((l) => l.startsWith('BANNED CHARACTER NAMES')) || '';
check('12. variety guard bans sibling prose names at prompt time', /Julian/.test(bannedLine) && /Dorian/.test(bannedLine));
check('13. own names never banned', !/Gamma/.test(bannedLine));

const ch4 = { chapter_number: 4, beat_summary: JSON.stringify({ protagonist: { name: 'Delta Four' } }) };
const res4 = applyAnthologyNameRenames('Delta nodded. Alpha entered the bar. Alpha sat. Delta watched Alpha drink.', ch4, [ch1, ch3, ch4]);
check('14. replacement picker avoids sibling prose names', res4.renames.length === 1 && !['Julian', 'Dorian'].includes(res4.renames[0].to));

const nfAnthology = { project_type: 'anthology', book_type: 'nonfiction', genre: 'History', anthology_theme: 'documented cases' };
check('15. nonfiction anthology still gets NO variety/banned block (SCOPINGFIX-1 intact)', buildAnthologyChapterVarietyBlock(nfAnthology, ch3, [ch1, ch3]) === '');

// ── wiring: sceneWriter computes, fast-save persists, schema declares ──
const SCENEWRITER = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
check('16. sceneWriter computes prose names AFTER the rename pass', SCENEWRITER.includes('anthologyProseNames = extractProminentProseNames(finalProse)'));
check('17. sceneWriter returns anthologyProseNames', /anthologyProseNames, \/\/ NAMEREG-1/.test(SCENEWRITER));
check('18. fast-save persists prose_names', STUDIO.includes('prose_names: JSON.stringify(sceneResult.anthologyProseNames)'));
const SCHEMA = fs.readFileSync(path.join(ROOT, 'base44/entities/Chapter.jsonc'), 'utf8');
check('19. Chapter schema declares prose_names (WAVE3 discipline)', SCHEMA.includes('"prose_names"'));

// ── SHELLCAP-1 + COPYFIX-1 ──
check('20. anthology shell timeout is 300s, not 90s', STUDIO.includes("setTimeout(() => reject(new Error('Anthology shell generation timed out')), 300000)") && !STUDIO.includes('timed out\'), 90000)'));
const MODAL = fs.readFileSync(path.join(ROOT, 'src/components/dashboard/NewProjectModal.jsx'), 'utf8');
check('21. Erotica card no longer promises Lumimaid', !/Routes to Lumimaid/.test(MODAL) && /local uncensored prose model/.test(MODAL));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
