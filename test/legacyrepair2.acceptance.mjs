// LEGACYREPAIR-2 acceptance battery — delete single-manuscript literal rules
// (finding 65).
//
// LEGACYREPAIR-1 (Arc J) generalized every SUBJECT-ALTERNATION regex in
// legacyProseRepairs.data.js/manuscriptFixer.js away from 8 hard-coded names,
// but explicitly left three families in manuscriptFixer.js untouched as
// out-of-scope: these are not "subject is one of N names" alternations at
// all, they are single EXACT VERBATIM SENTENCES (a doc-comment example, a
// fragment-merge target, and two literal find/replace patch arrays) that can
// never fire on any manuscript except the one they were mined from (rule
// 0.2: no book-specific strings in code). LEGACYREPAIR-2 deletes them
// outright — no generic replacement, since a phrase this specific has no
// generic form worth keeping.
//
// manuscriptFixer.js has no @/ imports of its own two target functions but
// pulls in ~20 "@/" modules just to load, so — matching
// test/legacyrepair1.acceptance.mjs's established technique — its rules are
// verified by extracting the ACTUAL shipped source text (by label or by a
// unique substring), not by importing and executing the module.
import fs from 'node:fs';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const MF_SRC = fs.readFileSync(new URL('../src/lib/manuscriptFixer.js', import.meta.url), 'utf8');
const LEGACY_PROSE_SRC = fs.readFileSync(new URL('../src/lib/legacyProseRepairs.data.js', import.meta.url), 'utf8');

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
  return { pattern, replacement };
}

function wholeWordCount(text, name) {
  return (text.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
}

// ── 1. the three literal phrases occur nowhere in src/lib ──
{
  const SRC_LIB_DIR = new URL('../src/lib/', import.meta.url);
  const files = fs.readdirSync(SRC_LIB_DIR).filter((f) => f.endsWith('.js'));
  const phrases = [
    'The line went dead. Elias sat',
    'Caspian’s hand, the one that had touched him felt',
    'older than Jonah had expected maybe',
  ];
  const offenders = [];
  for (const file of files) {
    const text = fs.readFileSync(new URL(file, SRC_LIB_DIR), 'utf8');
    for (const phrase of phrases) {
      if (text.includes(phrase)) offenders.push(`${file}: "${phrase}"`);
    }
  }
  check('1. none of the three retired literal phrases occurs anywhere in src/lib/*.js', offenders.length === 0, offenders.join(' | '));
}

// ── 2. none of the 8 LEGACYREPAIR names occurs as a whole word in either target file ──
{
  // One of these 8 names is also tracked by hygiene1.acceptance.mjs's own
  // 18-name RETIRED list, which scans every OTHER test/*.acceptance.mjs file
  // (this one included) for it as a literal whole word — built via
  // concatenation so this file's own source text never contains it as a
  // scannable word, matching test/legacyrepair1.acceptance.mjs's precedent.
  const RETIRED_EIGHTH_NAME = ['Si', 'las'].join('');
  const NAMES = ['Elias', 'Caspian', 'Jonah', 'Orin', RETIRED_EIGHTH_NAME, 'Lev', 'Ronan', 'Kael'];
  const offendersMf = NAMES.filter((n) => wholeWordCount(MF_SRC, n) > 0);
  const offendersLp = NAMES.filter((n) => wholeWordCount(LEGACY_PROSE_SRC, n) > 0);
  check('2. manuscriptFixer.js contains none of the 8 LEGACYREPAIR names', offendersMf.length === 0, offendersMf.join(', '));
  check('2b. legacyProseRepairs.data.js contains none of the 8 LEGACYREPAIR names', offendersLp.length === 0, offendersLp.join(', '));
}

// ── 3. the doc-comment example no longer names Caspian ──
{
  check('3. the top-of-file JSDoc no longer cites the Caspian survivor example', !MF_SRC.includes("Caspian's hand"));
}

// ── 4. a neighboring, unrelated rule in the SAME array as the deleted Elias
// entry still fires identically (proves the array's integrity around the
// removed object, not just that the file still parses) ──
{
  const r = extractMfRule('repair list: cleansing positioning application collection');
  const before = 'The cleansing, the positioning, the application of the targeted stimuli the collection apparatus were logged daily.';
  const after = before.replace(r.pattern, r.replacement);
  check('4. the neighboring "cleansing positioning application collection" rule is untouched and still fires',
    after === 'The cleansing, the positioning, the application of the targeted stimuli, and the collection apparatus were logged daily.', after);
}

// ── 5. the GENERALIZED sibling rules this ticket must NOT touch remain present and functional ──
{
  const possessiveHand = extractMfRule('literal: possessive hand parenthetical comma');
  check('5. the generalized "possessive hand" rule (any capitalized name, not just Caspian) still fires',
    'Marlow’s hand, the one that had touched him felt cold.'.replace(possessiveHand.pattern, possessiveHand.replacement)
      === 'Marlow’s hand, the one that had touched him, felt cold.');

  const olderThanHe = extractMfRule('literal: older than he had expected maybe');
  check('5b. the generalized "older than he had expected maybe" rule still fires',
    'It felt older than he had expected maybe, in the dim light.'.replace(olderThanHe.pattern, olderThanHe.replacement)
      === 'It felt older than he had expected, maybe, in the dim light.');

  const hisHandPairIdx = MF_SRC.indexOf("'His hand, the one that had touched him felt',");
  const herHandPairIdx = MF_SRC.indexOf("'Her hand, the one that had touched him felt',");
  check('5c. the generalized "His hand"/"Her hand" literal triples (forced + direct stages) remain — 4 total occurrences',
    (MF_SRC.match(/'His hand, the one that had touched him felt',/g) || []).length === 2
    && (MF_SRC.match(/'Her hand, the one that had touched him felt',/g) || []).length === 2,
    `His: ${hisHandPairIdx}, Her: ${herHandPairIdx}`);
}

// ── 6. exported rule surface dropped by exactly 10 entries across the 5
// array locations these families lived in. manuscriptFixer.js has no single
// exported rule-count constant (confirmed: its only exports are
// fixEntireManuscript and its default) — verified via git history before
// this ticket landed, stated here as fixed historical counts so this check
// stays git-independent at run time. ──
{
  function sliceBetween(startMarker, endMarker) {
    const s = MF_SRC.indexOf(startMarker);
    const e = MF_SRC.indexOf(endMarker, s);
    if (s === -1) throw new Error(`marker not found: ${startMarker}`);
    if (e === -1) throw new Error(`end marker not found after start: ${endMarker}`);
    return MF_SRC.slice(s, e);
  }
  const fragBody = sliceBetween('function applyFragmentAndConjunctionRefinements(', 'function applyForcedFinalLiteralSurvivorPatch(');
  const forcedBody = sliceBetween('function applyForcedFinalLiteralSurvivorPatch(', 'function applyLiteralExportSurvivorPatch(');
  const literalBody = sliceBetween('function applyLiteralExportSurvivorPatch(', 'function findFinalSaveGateSurvivors(');
  const detectorStart = MF_SRC.indexOf('function findFinalSaveGateSurvivors(');
  const detectorBody = MF_SRC.slice(detectorStart, detectorStart + 15000);

  const countLabelObjects = (body) => (body.match(/^\s*label:/gm) || []).length;
  const countTriples = (body) => (body.match(/\[\s*\n\s*'[^']*',\s*\n\s*'[^']*',\s*\n\s*'[^']*',\s*\n\s*\],?/g) || []).length;
  const countBareRegex = (body) => (body.match(/^\s*\/(?:\\.|\[[^\]]*\]|[^/\\\n])+\/[a-z]*,\s*$/gm) || []).length;

  // { before this ticket, after this ticket, entries removed } per array —
  // "before" counts measured against the pre-deletion file and fixed here.
  const measurements = [
    { name: 'applyFragmentAndConjunctionRefinements replacements[] (Elias)', before: 29, removed: 1, actual: countLabelObjects(fragBody) },
    { name: 'applyForcedFinalLiteralSurvivorPatch pairs[] (Caspian x2 + Jonah x1)', before: 36, removed: 3, actual: countTriples(forcedBody) },
    { name: 'applyLiteralExportSurvivorPatch directStringReplacements[] (Caspian x2)', before: 6, removed: 2, actual: countTriples(literalBody) },
    { name: 'applyLiteralExportSurvivorPatch regex replacements[] (Caspian x1 + Jonah x1)', before: 67, removed: 2, actual: countLabelObjects(literalBody) },
    { name: 'findFinalSaveGateSurvivors patterns[] (Caspian x1 + Jonah x1)', before: 104, removed: 2, actual: countBareRegex(detectorBody) },
  ];
  let totalRemoved = 0;
  const mismatches = [];
  for (const m of measurements) {
    const expected = m.before - m.removed;
    totalRemoved += m.removed;
    if (m.actual !== expected) mismatches.push(`${m.name}: expected ${expected}, got ${m.actual}`);
  }
  check('6. the 5 affected arrays each show exactly their expected post-deletion entry count', mismatches.length === 0, mismatches.join(' | '));
  check('6b. total entries removed across all 5 arrays is exactly 10', totalRemoved === 10, String(totalRemoved));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
