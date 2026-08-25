// BIBLEGUARD-NAMES-1 acceptance battery — every proper-noun phrase in a
// generated nonfiction bible field must exist in the research. The wiring
// lives in parallelBibleGenerator.js, which has @/-aliased dependencies and
// can only be exercised through the Vite alias loader — its wiring is
// verified via source-shape reads here (the way malformedsent1 checks
// exportSafetyGate.js). The underlying detection primitives
// (extractProperNounPhrases / createInEV / normCW) have no dependencies and
// are exercised directly, mirroring the wired algorithm exactly.
import fs from 'node:fs';
import { normCW, createInEV, extractProperNounPhrases } from '../src/lib/closedWorldText.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// Mirrors the wired checkFieldNames in parallelBibleGenerator.js exactly,
// using the real (relative-importable) primitives it calls.
const FIELD_LABEL_LINE_RX = /^[\s>*-]*\*{0,2}([A-Z][A-Za-z '’-]{1,40}):\*{0,2}\s/gm;
function collectFieldLabels(text) {
  const labels = new Set();
  let m;
  FIELD_LABEL_LINE_RX.lastIndex = 0;
  const s = String(text || '');
  while ((m = FIELD_LABEL_LINE_RX.exec(s)) !== null) labels.add(normCW(m[1]));
  return labels;
}
function checkFieldNames(text, fieldName, inEV) {
  const s = String(text || '');
  const labels = collectFieldLabels(s);
  let checked = 0;
  for (const phrase of extractProperNounPhrases(s)) {
    if (labels.has(normCW(phrase))) continue;
    checked += 1;
    if (!inEV(phrase)) throw new Error(`BIBLEGUARD-NAMES-1: "${phrase}" in ${fieldName} is not in the research`);
  }
  return checked;
}

const RESEARCH = 'Dr. Hale led the excavation at Port Ellis in 1966, cataloguing the colonies of settlers found in the harbor records.';
const inEV = createInEV(' ' + normCW(RESEARCH) + ' ');

// ── 1. supported noun passes ──
{
  const field = 'Dr. Hale directed the dig at Port Ellis.';
  let threw = false;
  let checked = 0;
  try { checked = checkFieldNames(field, 'world_md', inEV); } catch { threw = true; }
  check('1. supported nouns pass (no throw)', !threw && checked >= 1, `checked=${checked} threw=${threw}`);
}

// ── 2. unsupported throws naming noun+field ──
{
  const field = 'Dov Rask discovered the site independently.';
  let err = null;
  try { checkFieldNames(field, 'characters_md', inEV); } catch (e) { err = e; }
  check('2. unsupported noun throws naming the noun and the field', !!err && err.message.includes('BIBLEGUARD-NAMES-1:') && err.message.includes('Dov Rask') && err.message.includes('characters_md') && err.message.includes('is not in the research'), err?.message);
}

// ── 3. plural/singular fallback ──
{
  check('3a. plural research supports a singular mention', inEV('settler'));
  check('3b. singular research supports a plural mention', createInEV(' the harbor once held one settler here ')('settlers') === true);
}

// ── 4. field labels ignored ──
{
  const field = '- **Role:** Dr. Hale\nPronouns: she/her\nDov appears nowhere in this field.';
  // "Role" and "Pronouns" are labels (skipped); "Dr. Hale" is a supported
  // name; "Dov" is unsupported and should still throw — proving the label
  // words themselves are skipped, not the whole line.
  let err = null;
  try { checkFieldNames(field, 'characters_md', inEV); } catch (e) { err = e; }
  check('4. field labels do not themselves throw, but a real unsupported name in the same field still does', !!err && err.message.includes('"Dov"') && !err.message.includes('"Role"') && !err.message.includes('"Pronouns"'), err?.message);
}

// ── 5. zero-unsupported case checks every noun ──
{
  const field = 'Dr. Hale and the team at Port Ellis worked through 1966 without incident.';
  const checked = checkFieldNames(field, 'world_md', inEV);
  check('5. a fully-supported field checks N nouns with none unsupported', checked >= 2, `checked=${checked}`);
}

// ── 6-11. source-shape wiring in parallelBibleGenerator.js ──
{
  const PBG = fs.readFileSync(new URL('../src/lib/parallelBibleGenerator.js', import.meta.url), 'utf8');
  check('6. imports the shared closed-world primitives', PBG.includes("from './closedWorldText.js'") && PBG.includes('extractProperNounPhrases') && PBG.includes('createInEV'));
  check('7. throws the exact BIBLEGUARD-NAMES-1 message shape', PBG.includes('BIBLEGUARD-NAMES-1: "${phrase}" in ${fieldName} is not in the research'));
  check('8. zero-telemetry line present', PBG.includes('[BIBLE-GUARD] names:') && PBG.includes('checked ${checked} noun(s), 0 unsupported'));
  check('9. field-label lines are excluded from the noun check', PBG.includes('FIELD_LABEL_LINE_RX') && PBG.includes('collectFieldLabels'));
  check('10. checks all six generated fields', ["checkFieldNames(worldMd, 'world_md')", "checkFieldNames(charactersMd, 'characters_md')", "checkFieldNames(voiceMd, 'voice_md')", "checkFieldNames(canonMd, 'canon_md')", "checkFieldNames(mysteryMd, 'mystery_md')", "checkFieldNames(outlineMd, 'outline_md')"].every((s) => PBG.includes(s)));
  check('11. gated on nonfiction only (fiction skipped)', /if \(!isFiction[\s\S]{0,80}\)\s*\{[\s\S]{0,2000}BIBLEGUARD-NAMES-1: "\$\{phrase\}"/.test(PBG));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
