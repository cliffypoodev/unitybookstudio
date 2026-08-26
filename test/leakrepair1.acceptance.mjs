// LEAKREPAIR-1 (+ CANON-2B) acceptance battery.
//
// LEAKREPAIR-1 — the live failure (REDUX ch.12 redraft, 2026-08-15): three
// scenes passed every scene gate (state machine, collisions, boundaries), then
// the assembled chapter carried ONE model leak — "She remembered the night in
// Chapter 4, the way she had stared at the stars" — and assertNarrativeTextClean
// discarded the entire 15-minute draft. The leak shapes the gate hunts are
// removable deterministically; the writer now repairs before it asserts, at
// both the per-scene and the assembled-chapter checkpoints. A leak that
// survives repair still blocks.
//
// CANON-2B — the live false positive (REDUX ch.8): "Chaotic. Messy. Loud." —
// the one-word sentence "Messy." was reported as a name variant of "Perpetua"
// and survived the lowercase-twin test because "messy" appeared nowhere else
// in the chapter. A name in narration is never an entire one-word sentence.
import fs from 'node:fs';
import vm from 'node:vm';
import { findNameVariants, parseCanonCast } from '../src/lib/canonRoles.js';

// generationContext.js imports the Vite "@/" alias, which plain node cannot
// resolve, so the pure leak functions are extracted from the REAL source by
// anchor and executed in a vm (the POLISHSAFE-1 / EXITSTATE-1 technique). No
// logic is re-implemented.
const CTX_SRC = fs.readFileSync(new URL('../src/lib/generationContext.js', import.meta.url), 'utf8');
const leakStart = CTX_SRC.indexOf('export const NARRATIVE_META_LEAK_PATTERNS');
const leakEnd = CTX_SRC.indexOf('\nexport function assertNarrativeTextClean', leakStart);
const assertEnd = CTX_SRC.indexOf('\n}\n', leakEnd) + 3;
if (leakStart < 0 || leakEnd < 0 || assertEnd < 3) throw new Error('leak-function anchors not found');
class GenerationContextError extends Error { constructor(m, d) { super(m); Object.assign(this, d || {}); } }
const leakCtx = { console, JSON, Array, String, Boolean, Object, RegExp, Math, GenerationContextError };
vm.createContext(leakCtx);
vm.runInContext(CTX_SRC.slice(leakStart, assertEnd).replace(/^export /gm, ''), leakCtx);
const { repairNarrativeMetaLeaks, findNarrativeMetaLeaks, assertNarrativeTextClean } = leakCtx;

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── LEAKREPAIR-1 ──
const live = 'Ottie felt the weight in her chest tighten. She remembered the night in Chapter 4, the way she had stared at the stars and felt small.';
const r1 = repairNarrativeMetaLeaks(live);
check('1. the live ch.12 leak is repaired by phrase removal, sentence intact', r1.text === 'Ottie felt the weight in her chest tighten. She remembered the night, the way she had stared at the stars and felt small.' && r1.repaired === 1);
check('2. repaired text passes the assertion (no throw)', (() => { try { assertNarrativeTextClean(r1.text, { chapterNumber: 12 }); return true; } catch { return false; } })());
const r2 = repairNarrativeMetaLeaks('What happened in the previous chapter still stung. In the next chapter she would know. The previous chapter was rough.');
check('3. relative-chapter shapes are rewritten with sentence-initial case preserved', r2.text === 'What happened before still stung. Later she would know. What came before was rough.' && r2.repaired === 5);
check('4. word-number chapter refs are repaired ("since chapter three")', repairNarrativeMetaLeaks('Nothing had felt right since chapter three, not really.').text === 'Nothing had felt right, not really.');
check('5. clean prose is returned byte-identical with repaired=0', (() => { const s = 'The dust settled. Nobody spoke.'; const r = repairNarrativeMetaLeaks(s); return r.text === s && r.repaired === 0; })());
check('6. a non-removable leak still blocks after repair ("scene contract" survives)', (() => { const r = repairNarrativeMetaLeaks('The scene contract said she should cry here.'); return r.repaired === 0 && (r.remaining || findNarrativeMetaLeaks(r.text).map((x) => x.phrase)).length === 1; })());
check('7. repair never touches ordinary uses of the word "chapter" ("a new chapter of her life")', (() => { const s = 'This was a new chapter of her life, and she knew it.'; return repairNarrativeMetaLeaks(s).text === s; })());

// ── CANON-2B ──
const canon = parseCanonCast("### Major Characters\n\n**4. Key Supporting: Perpetua 'The Tamsin' Quillon**\n\n- **Role:** engineer");
check('8. a one-word fragment sentence ("Messy.") is not a name variant (live FP dead)', findNameVariants('Ludo stood there and listened. Chaotic. Messy. Loud.\n\nHome.', canon).length === 0);
check('9. a real repeated drift is still caught', (() => { const f = findNameVariants('Parpetua grabbed the wrench. Parpetua laughed. "Hand it over," Parpetua said.', canon); return f.length === 1 && f[0].variant === 'Parpetua' && f[0].canonical === 'Perpetua'; })());
check('10. a sentence-initial name followed by a verb is still counted', findNameVariants('Parpetua grabbed the wrench and Ludo stared. Parpetua laughed hard.', canon).length === 1);

// ── wiring (source-level) ──
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('11. writer imports the repair', WRITER.includes('repairNarrativeMetaLeaks, // LEAKREPAIR-1'));
check('12. per-scene checkpoint repairs BEFORE asserting', /const sceneLeakRepair = repairNarrativeMetaLeaks\(sceneProse\);[\s\S]{0,400}assertNarrativeTextClean\(sceneProse, \{ chapterNumber \}\)/.test(WRITER));
check('13. assembled-chapter checkpoint repairs BEFORE asserting', /const finalLeakRepair = repairNarrativeMetaLeaks\(finalProse\);[\s\S]{0,500}assertNarrativeTextClean\(finalProse, \{ chapterNumber \}\)/.test(WRITER));
check('14. repairs are logged loudly ([LEAKREPAIR-1])', (WRITER.match(/\[LEAKREPAIR-1\]/g) || []).length >= 2);
const CTX = fs.readFileSync(new URL('../src/lib/generationContext.js', import.meta.url), 'utf8');
check('15. the assertion itself is unchanged (repair is upstream, not a weakening of the gate)', CTX.includes("code: 'NARRATIVE_META_LEAK'") && CTX.includes('export function assertNarrativeTextClean(value, options = {}) {'));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
