// BEATFIELD-1 acceptance — the schema the model is constrained by must require every
// field the app then rejects the model for omitting.
//
// MEASURED on The Gilded Hour ch.1, 2026-08-04:
//
//   [TIMING] architect | deepseek-r1-32b | 174846ms
//   [BEATPLAN-1] Ch.1 attempt 1: 3 beat(s) missing required fields —
//                ch01-s01: missing setting | ch01-s02: missing setting | ch01-s03: missing setting
//   [TIMING] architect | deepseek-r1-32b | 153542ms
//
// sceneBeatSchema declared `setting` OPTIONAL while BEATPLAN-1 rejected any beat
// without it. The architect legally omitted it on all three scenes; the plan was
// rejected and re-planned. maxContractAttempts is 4 for fiction, so the chapter burned
// ~11 minutes of local model time and then shipped the flagged plan anyway, because
// attempt exhaustion accepts it. Every chapter, every fiction book.
//
// This is the recurring shape one more time: two components with different opinions
// about the same fact, and no single authority.
import fs from 'fs';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const SCHEMA_SRC = fs.readFileSync(new URL('../src/lib/autonovel.js', import.meta.url), 'utf8');
const STUDIO = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');

// Pull the real required list out of the real schema source. Matched by its first
// element rather than by brace-shape — the first version of this used a nested-brace
// regex and broke the moment a comment block was added above the line.
const block = SCHEMA_SRC.slice(SCHEMA_SRC.indexOf('export const sceneBeatSchema'));
const requiredLine = (block.match(/required: \['scene_number'[^\]]*\]/) || [])[0];
if (!requiredLine) throw new Error('could not find the scene-beat required list');
const required = JSON.parse(requiredLine.replace(/^required: /, '').replace(/'/g, '"'));
const properties = block.slice(0, block.indexOf('required:'));

// ── the defect ──
check('the beat schema requires `setting`', required.includes('setting'), JSON.stringify(required));
check('`setting` is actually declared as a property, so requiring it is valid',
  /\bsetting: \{ type: 'string' \}/.test(properties));

// ── the schema and the validator must demand the SAME fields ──
// BEATPLAN-1's three demands, read from the real ProjectStudio source.
const demands = [];
if (/missing\.push\('setting'\)/.test(STUDIO)) demands.push('setting');
if (/missing\.push\('characters_present'\)/.test(STUDIO)) demands.push('characters_present');
if (/missing\.push\('emotional_arc'\)/.test(STUDIO)) demands.push('emotional_arc');
check('the validator still demands exactly the three known fields',
  demands.length === 3, JSON.stringify(demands));
for (const d of demands) {
  check(`the decoder is required to emit "${d}", which the validator rejects beats without`,
    required.includes(d), `required = ${JSON.stringify(required)}`);
}

// ── the fields that were already right must stay right ──
for (const f of ['scene_number', 'scene_id', 'scene_goal', 'entry_state', 'required_events', 'exit_state', 'conflict', 'tension_level']) {
  check(`"${f}" is still required`, required.includes(f));
}
check('no duplicate entries crept into the required list',
  new Set(required).size === required.length, JSON.stringify(required));

// ── the retry budget that made this expensive is unchanged and still bounded ──
check('fiction still gets a bounded number of contract attempts',
  /const maxContractAttempts = isNonfiction \? 1 : 4;/.test(STUDIO));
check('attempt exhaustion still accepts rather than killing the chapter',
  /still contained overlapping beats after \$\{maxContractAttempts\} attempts/.test(STUDIO));

// ── generality: nothing here names a book ──
check('the fix names no book, cast or prop',
  !/Gilded|Wexcombe|Nell|Brass Meridian|Lena|Marcus/.test(
    SCHEMA_SRC.slice(SCHEMA_SRC.indexOf('BEATFIELD-1'), SCHEMA_SRC.indexOf('BEATFIELD-1') + 400)
      .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n'),
  ));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
