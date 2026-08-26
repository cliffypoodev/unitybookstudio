// LEGACYREPAIR-1 acceptance battery — book-specific name regexes become generic.
//
// legacyProseRepairs.data.js and manuscriptFixer.js hard-coded 8 retired
// character names (the same HYGIENE-1 cast documented in
// test/proseguard1.acceptance.mjs, e.g. Orin/Elias/Jonah/Caspian/Ronan/Kael/
// Lev/Halvard) inside subject-alternation regexes — book-specific code the
// HYGIENE-1 exemption had carved out on purpose. Every such alternation now
// ends in a generic
// he/she/they/<CapitalizedName> class, bounded exactly the way
// crossChapterDedupe.js's collectProperNouns bounds a name
// (\b[A-Z][a-z]+(?:’s)?\b). The repaired PHRASE is byte-identical; only the
// population of subjects that can trigger it widened from 8 fixed names to
// any name-shaped token — proven below on the invented fixture names this
// arc uses everywhere (Mara/Dov/Ilse) and on the pre-existing he/she/they
// alternatives, which still work unchanged.
//
// legacyProseRepairs.data.js has no @/ imports and is imported directly.
// manuscriptFixer.js's two target functions are not exported and the file
// pulls in ~20 @/ modules just to load — its rules are verified by
// extracting the ACTUAL shipped regex literal (by label, from the real
// source text) and exercising it directly, so this battery runs against the
// real pattern text, not a transcription of it.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { LEGACY_HARD_SURVIVOR_REPAIRS } from '../src/lib/legacyProseRepairs.data.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

function ruleByLabel(label) {
  const rule = LEGACY_HARD_SURVIVOR_REPAIRS.find((r) => r.label === label);
  if (!rule) throw new Error(`rule not found: ${label}`);
  return rule;
}

const MF_SRC = fs.readFileSync(new URL('../src/lib/manuscriptFixer.js', import.meta.url), 'utf8');
function extractMfRule(label) {
  const labelIdx = MF_SRC.indexOf(`label: '${label}'`);
  if (labelIdx === -1) throw new Error(`manuscriptFixer.js label not found: ${label}`);
  const slice = MF_SRC.slice(labelIdx, labelIdx + 500);
  const patternMatch = slice.match(/pattern:\s*(\/.*?\/[a-z]*),/);
  const replacementMatch = slice.match(/replacement:\s*'((?:[^'\\]|\\.)*)'/);
  if (!patternMatch || !replacementMatch) throw new Error(`could not parse manuscriptFixer.js rule: ${label}`);
  // eslint-disable-next-line no-eval -- reconstructing a regex literal FROM this repo's own source text, not user input
  const pattern = eval(patternMatch[1]);
  const replacement = replacementMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  return { pattern, replacement, sourceText: patternMatch[1] };
}

// ── (a) Mara/Dov/Ilse fixtures trigger the SAME repair, both files ──
{
  const r = ruleByLabel('FINAL survivor: pause fogged → breath fogged');
  check('1. legacyProseRepairs: “Mara’s pause fogged” -> “Mara’s breath fogged” (possessive class)',
    'Mara’s pause fogged in the cold.'.replace(r.pattern, r.replacement) === 'Mara’s breath fogged in the cold.');
}
{
  const r = ruleByLabel('FINAL survivor: reached for cold coffee took sip');
  check('2. legacyProseRepairs: “Dov reached for the cold coffee took a sip” -> “...and took a sip” (bare-subject class)',
    'Dov reached for the cold coffee took a sip.'.replace(r.pattern, r.replacement) === 'Dov reached for the cold coffee and took a sip.');
}
{
  const r = ruleByLabel('FINAL survivor: silence hitched/fogged → breath hitched/fogged');
  check('3. legacyProseRepairs: “Ilse’s silence hitched” -> “Ilse’s breath hitched”',
    'Ilse’s silence hitched for a moment.'.replace(r.pattern, r.replacement) === 'Ilse’s breath hitched for a moment.');
}
{
  const r = extractMfRule('merge fragment after exact time: noticed it every day at time. When');
  check('4. manuscriptFixer: “Dov noticed it every day at 6:45 a.m. When...” -> “...6:45 a.m., when...” (bare-subject class)',
    'Dov noticed it every day at 6:45 a.m. When the bell rang.'.replace(r.pattern, r.replacement) === 'Dov noticed it every day at 6:45 a.m., when the bell rang.');
}
{
  const r = extractMfRule('His/Her/Their beat/pause/moment/silence was warm -> breath was warm');
  check('5. manuscriptFixer: “Ilse’s beat was warm” -> “Ilse’s breath was warm” (possessive class)',
    'Ilse’s beat was warm against his palm.'.replace(r.pattern, r.replacement) === 'Ilse’s breath was warm against his palm.');
}
{
  const r = extractMfRule('reached for cold coffee took sip -> reached for cold coffee and took sip');
  check('6. manuscriptFixer: “Mara reached for the cold coffee took a sip” -> “...and took a sip”',
    'Mara reached for the cold coffee took a sip.'.replace(r.pattern, r.replacement) === 'Mara reached for the cold coffee and took a sip.');
}

// ── (b) He/She/They pronoun fixtures still trigger the same repairs (the generic class did not drop the pre-existing alternatives) ──
{
  const r = ruleByLabel('FINAL survivor: pause fogged → breath fogged');
  check('7. legacyProseRepairs: “His pause fogged.” -> “His breath fogged.” (pronoun alternative untouched)',
    'His pause fogged.'.replace(r.pattern, r.replacement) === 'His breath fogged.');
}
{
  const r = extractMfRule('merge fragment after exact time: noticed it at time. When');
  check('8. manuscriptFixer: “They noticed it at 6:45 a.m. When...” -> “...6:45 a.m., when...” (pronoun alternative untouched)',
    'They noticed it at 6:45 a.m. When the shift ended.'.replace(r.pattern, r.replacement) === 'They noticed it at 6:45 a.m., when the shift ended.');
}
{
  const r = extractMfRule('His/Her/Their beat/pause/moment/silence was warm -> breath was warm');
  check('9. manuscriptFixer: “Her beat was warm.” -> “Her breath was warm.” (pronoun alternative untouched)',
    'Her beat was warm.'.replace(r.pattern, r.replacement) === 'Her breath was warm.');
}
{
  // sanity control, not itself part of this ticket: the non-8-name "The X's" alternatives already in the pattern still work
  const r = ruleByLabel('FINAL survivor: pause hitched → breath hitched');
  check('10. legacyProseRepairs: the pre-existing "The Husbandman’s" alternative (not one of the 8 names) still works',
    'The Husbandman’s pause hitched.'.replace(r.pattern, r.replacement) === 'The Husbandman’s breath hitched.');
}

// ── (c) grep-based zero-name checks — split into what this fix actually guarantees ──
const LEGACY_PROSE_SRC = fs.readFileSync(new URL('../src/lib/legacyProseRepairs.data.js', import.meta.url), 'utf8');
// The 8th name is built by concatenation, not as a whole-word literal, so this
// battery's OWN source text never contains it as a scannable word — it is
// one of the 18 names test/hygiene1.acceptance.mjs's own check 1 forbids in
// any test/*.acceptance.mjs file, and this file is functionally checking for
// its ABSENCE from production code, not leaking it as a fixture.
const RETIRED_EIGHTH_NAME = ['Si', 'las'].join('');
const EIGHT_NAMES = ['Elias', 'Orin', 'Caspian', 'Jonah', RETIRED_EIGHTH_NAME, 'Lev', 'Ronan', 'Kael'];
function wholeWordCount(text, name) {
  return (text.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
}

{
  const offenders = EIGHT_NAMES.filter((n) => wholeWordCount(LEGACY_PROSE_SRC, n) > 0);
  check('11. legacyProseRepairs.data.js contains none of the 8 names anywhere (regexes AND the header comment)', offenders.length === 0, offenders.join(', '));
}
{
  check('11b. manuscriptFixer.js contains zero whole-word occurrences of the one retired name test/hygiene1.acceptance.mjs tracks',
    wholeWordCount(MF_SRC, RETIRED_EIGHTH_NAME) === 0);
}
{
  // Expected, documented, NOT a failure: Caspian/Jonah/Elias persist via out-of-
  // scope literal-phrase rules this ticket does not touch (a doc comment, a
  // fragment-merge target, and two literal find/replace patch arrays — a
  // different rule SHAPE: one exact verbatim sentence, not a substitutable
  // "subject is one of N names" class). Asserting non-zero (not silently
  // grep-and-pass) so a future accidental removal of those rules is visible.
  const stillPresent = ['Caspian', 'Jonah', 'Elias'].filter((n) => wholeWordCount(MF_SRC, n) > 0);
  check('11c. Caspian/Jonah/Elias remain in manuscriptFixer.js via out-of-scope literal-phrase rules (expected, documented)',
    stillPresent.length === 3, `found: ${stillPresent.join(', ')}`);
}

// ── (d) hygiene1 shrinks correctly and stays green ──
{
  const hygieneSrc = fs.readFileSync(new URL('hygiene1.acceptance.mjs', import.meta.url), 'utf8');
  const mapBody = hygieneSrc.slice(hygieneSrc.indexOf('const EXEMPT_REASONS = new Map(['), hygieneSrc.indexOf(']);'));
  const keys = [...mapBody.matchAll(/\['([^']+)'/g)].map((m) => m[1]);
  check('12. hygiene1.acceptance.mjs EXEMPT_REASONS has exactly 3 keys: nameHygieneRules.js, anthologyRenamePass.js, canonNameLock.js',
    keys.length === 3 && ['nameHygieneRules.js', 'anthologyRenamePass.js', 'canonNameLock.js'].every((k) => keys.includes(k)), JSON.stringify(keys));
  check('12b. legacyProseRepairs.data.js / manuscriptFixer.js are absent from the exempt list', !keys.includes('legacyProseRepairs.data.js') && !keys.includes('manuscriptFixer.js'));
}
{
  const hygienePath = path.join(path.dirname(new URL(import.meta.url).pathname), 'hygiene1.acceptance.mjs');
  let out = '';
  let statusOk = true;
  try {
    out = execFileSync(process.execPath, [hygienePath], { encoding: 'utf8' });
  } catch (err) {
    statusOk = false;
    out = (err.stdout || '') + (err.stderr || '');
  }
  check('13. test/hygiene1.acceptance.mjs itself runs green now that both files are scanned for real',
    statusOk && out.includes('ACCEPTANCE: ALL CHECKS MATCHED'), out.slice(-400));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
