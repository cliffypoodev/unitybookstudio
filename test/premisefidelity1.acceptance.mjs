// PREMISE-FIDELITY-1 acceptance — the author's brief is a closed world.
//
// MEASURED on The Gilded Hour, 2026-08-04. The premise named five people, a house, a
// strongroom, two keys and a language. The generated character sheet contained
// Nell Carrow, Edmund Wexcombe, Ned and Mrs. Aldous — and NOT Silas Bram, the steward
// who hands over the key and is the corpse in chapter 3. Nothing checked. The first
// anyone knew was a human reading the outline and noticing a stranger in it.
//
// This is the closed-world principle the gates apply to FACTS, applied one layer
// earlier — to the BRIEF.
import {
  extractPremiseEntities, buildPremiseCoverageBlock, checkPremiseCoverage, reportPremiseCoverage,
} from '../src/lib/premiseFidelity.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

// The live premise, verbatim in shape.
const PREMISE = 'The Gilded Hour - a gothic historical mystery. London and Wexcombe House, '
  + 'winter 1908. Nell Carrow, a repairer of automata, is summoned to Wexcombe House to service '
  + 'a clockwork songbird. Silas Bram, the house steward, insists he handed her the brass winding '
  + 'key. Her employer is Edmund Wexcombe. His brother, Edmund Wexcombe the younger, known as Ned, '
  + 'arrives on the second day. Housekeeper Mrs. Aldous speaks to Nell in French.';
const ENTITIES = extractPremiseEntities(PREMISE, { exclude: ['Gilded Hour'] });

// ── the defect, reproduced ──
{
  const bible = 'Nell Carrow is a repairer at Wexcombe House in London. Edmund Wexcombe employs her. '
    + 'Ned is his brother. Mrs. Aldous keeps house. Nolan Bram is the steward.';
  const r = checkPremiseCoverage(ENTITIES, bible);
  check('the renamed character is reported missing', r.missing.includes('Silas Bram'), r.summary);
  check('a renamed lookalike does NOT satisfy the brief — "Nolan Bram" is not "Silas Bram"',
    !r.present.includes('Silas Bram'));
  check('the dropped language is reported missing', r.missing.includes('French'), r.summary);
  check('the entities that DID arrive are reported present',
    ['Nell Carrow', 'Edmund Wexcombe', 'Mrs. Aldous', 'Ned'].every((e) => r.present.includes(e)),
    JSON.stringify(r.present));
  check('the verdict is not ok', r.ok === false);
  check('the summary names what went missing', /MISSING: .*Silas Bram/.test(r.summary), r.summary);
}
{
  const complete = ENTITIES.join(' and ') + ' all appear here.';
  const r = checkPremiseCoverage(ENTITIES, complete);
  check('a bible containing every entity passes', r.ok === true && r.missing.length === 0, r.summary);
}

// ── extraction: conservative, no NER, no book knowledge ──
{
  check('multi-word names are captured', ENTITIES.includes('Nell Carrow') && ENTITIES.includes('Silas Bram'));
  check('an honorific name survives its period', ENTITIES.includes('Mrs. Aldous'), JSON.stringify(ENTITIES));
  check('a role word before an honorific is dropped',
    !ENTITIES.some((e) => /Housekeeper/.test(e)), JSON.stringify(ENTITIES));
  check('a capitalised run never spans a sentence boundary',
    !ENTITIES.some((e) => /\.\s/.test(e) && !/^(Mr|Mrs|Ms|Dr|St|Mt)\./.test(e)), JSON.stringify(ENTITIES));
  check('a place is captured', ENTITIES.includes('Wexcombe House'));
  check('a lone capitalised word used mid-sentence is captured', ENTITIES.includes('French'));
  check('an excluded term is honoured', !ENTITIES.includes('Gilded Hour'));
  check('sentence-opening function words are not entities',
    !ENTITIES.some((e) => ['The', 'Her', 'His', 'London and'].includes(e)), JSON.stringify(ENTITIES));
  check('a bare sentence-opening capital is not an entity',
    !extractPremiseEntities('Winter came. Snow fell. Nothing happened.').length,
    JSON.stringify(extractPremiseEntities('Winter came. Snow fell. Nothing happened.')));
  check('a month is not an entity', !extractPremiseEntities('It began in March and ended in April.').length);
  check('empty and null premises yield nothing and do not throw',
    extractPremiseEntities('').length === 0 && extractPremiseEntities(null).length === 0);
}

// ── prevention: the block states the brief up front ──
{
  const block = buildPremiseCoverageBlock(ENTITIES);
  check('the coverage block lists every entity',
    ENTITIES.every((e) => block.includes(e)), block.slice(0, 200));
  check('the block forbids renaming', /Do not rename/.test(block));
  check('the block forbids inventing a replacement', /do not invent a replacement/i.test(block));
  check('an empty entity list produces no block', buildPremiseCoverageBlock([]) === '');
  check('a null entity list produces no block', buildPremiseCoverageBlock(null) === '');
}

// ── telemetry: a silent loss becomes a visible one ──
{
  const warns = []; const logs = [];
  const w = console.warn; const l = console.log;
  console.warn = (...a) => warns.push(a.join(' ')); console.log = (...a) => logs.push(a.join(' '));
  reportPremiseCoverage(ENTITIES, 'Nell Carrow only.', 'bible');
  reportPremiseCoverage(ENTITIES, ENTITIES.join(' '), 'bible');
  reportPremiseCoverage([], 'anything', 'bible');
  console.warn = w; console.log = l;
  check('a gap is warned, not logged quietly', warns.length === 1 && /PREMISE-FIDELITY-1/.test(warns[0]));
  check('full coverage is logged', logs.length === 1 && /7\/7/.test(logs[0]), JSON.stringify(logs));
  check('an empty brief says nothing at all', warns.length + logs.length === 2);
}

// ── book-agnostic: three unrelated briefs, same behaviour ──
const BRIEFS = [
  { id: 'arctic thriller', premise: 'Lena Ortiz and Marcus Reed are trapped at Halvorsen Station.', drop: 'Marcus Reed' },
  { id: 'gothic mystery', premise: 'Nell Carrow meets Silas Bram at Wexcombe House.', drop: 'Silas Bram' },
  { id: 'legal thriller', premise: 'Ana Okonkwo deposes Peter Halloway in Trenton.', drop: 'Peter Halloway' },
];
for (const b of BRIEFS) {
  const ents = extractPremiseEntities(b.premise);
  check(`${b.id}: entities extracted`, ents.length >= 2, JSON.stringify(ents));
  const partial = ents.filter((e) => e !== b.drop).join(' ');
  const r = checkPremiseCoverage(ents, partial);
  check(`${b.id}: the dropped entity is caught`, r.missing.includes(b.drop), r.summary);
  check(`${b.id}: a complete bible passes`, checkPremiseCoverage(ents, ents.join(' ')).ok);
}

// ── generality: the module names no book ──
{
  const src = (await import('fs')).readFileSync(new URL('../src/lib/premiseFidelity.js', import.meta.url), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  check('no book, cast or prop appears in the code',
    !/Gilded|Wexcombe|Nell|Silas|Brass Meridian|Lena|Marcus/.test(code));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
