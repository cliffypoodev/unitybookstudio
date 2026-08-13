// RENAMEPASS-1 acceptance battery — deterministic anthology cross-story name de-collision.
//
// USEDNAMES-1 bans other stories' names in the PROMPT, but the model defies the ban on its
// strongest associations (measured live 2026-08-10: Story 4 named Luis's wife "Maria" 4x even
// though "Maria" was banned in Story 4's prompt). RENAMEPASS-1 runs on the FINISHED prose and
// renames any other-story name — never this story's own — consistently across every occurrence,
// to a fresh name used by no story, gender-preserved from unambiguous pronoun context. Pure and
// deterministic. This battery imports the REAL functions and runs the actual Night Shift shape.
// Fixtures are generic — no book-specific strings beyond the demonstrated collision names.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyAnthologyNameRenames, collectAnthologyNames } from '../src/lib/anthologyRenamePass.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

const mkStory = (n, name) => ({ chapter_number: n, beat_summary: JSON.stringify({ protagonist: { name }, premise: 'A standalone story.' }) });
// The live 6-story collection.
const collection = [
  mkStory(1, 'Marcus'), mkStory(2, 'Eva'), mkStory(3, 'Sophie'),
  mkStory(4, 'Luis'), mkStory(5, 'Maria'), mkStory(6, 'Clara'),
];
const allNames = new Set(['Marcus', 'Eva', 'Sophie', 'Luis', 'Maria', 'Clara']);
const whole = (name, text) => new RegExp(`\\b${name}\\b`).test(text);

// 1 — name-split: Story 4 owns Luis; others include Marcus/Maria/Clara, not Luis.
{
  const { own, others } = collectAnthologyNames(collection[3], collection);
  check('1. own set holds this story\'s protagonist (Luis)', own.has('Luis'));
  check('1. others holds sibling protagonists (Marcus, Maria, Clara)', others.has('Marcus') && others.has('Maria') && others.has('Clara'));
  check('1. others never contains this story\'s own name', !others.has('Luis'));
}

// 2 — the live case: Story 4 prose names its own lead Luis AND borrows Maria (banned) + Clara.
{
  const prose = 'Luis wiped his hands on his coveralls. He thought of Maria. She was at home, counting coins at the table. Maria always worried. Their daughter, Clara, waved from the doorway; she was small and quiet. Luis nodded to Clara and went back to the sink.';
  const out = applyAnthologyNameRenames(prose, collection[3], collection);
  const map = Object.fromEntries(out.renames.map((r) => [r.from, r]));
  check('2. Maria and Clara are both renamed', !!map.Maria && !!map.Clara);
  check('2. this story\'s own lead Luis is NOT renamed', !map.Luis && whole('Luis', out.prose));
  check('2. every Maria occurrence is gone (all replaced consistently)', !whole('Maria', out.prose) && map.Maria.count === 2);
  check('2. every Clara occurrence is gone', !whole('Clara', out.prose) && map.Clara.count === 2);
  check('2. replacements are not any story\'s name', out.renames.every((r) => !allNames.has(r.to)));
  check('2. Maria and Clara got DIFFERENT replacements', map.Maria.to !== map.Clara.to);
}

const FEMALE_POOL = ['Delphine', 'Rosalind', 'Imelda', 'Corinne', 'Yolanda', 'Priya', 'Fatima', 'Ingrid', 'Bernadette', 'Odette', 'Marisol', 'Constance', 'Leona', 'Vivienne', 'Harriet', 'Cordelia'];
const NEUTRAL_POOL = ['Emerson', 'Marlowe', 'Sterling', 'Ellery', 'Sutton', 'Lennox', 'Sidney', 'Kingsley', 'Quincy', 'Adair', 'Wynn', 'Blair'];

// 2b — clean female-only context (mirrors the real first-person Story 4: "my wife ... She ...")
// yields a clearly-female replacement.
{
  const prose = 'I think of Maria, my wife. She counts coins at the table. Her hands are always cold. Maria never complains.';
  const out = applyAnthologyNameRenames(prose, collection[3], collection);
  const to = out.renames.find((r) => r.from === 'Maria')?.to;
  check('2b. female-only pronoun context -> a clearly-female replacement', FEMALE_POOL.includes(to));
}

// 2c — genuinely ambiguous pronoun context -> a neutral replacement (never misgender).
{
  const prose = 'He thought of Maria, his wife, as he worked. She waited at home. Maria said nothing.';
  const out = applyAnthologyNameRenames(prose, collection[3], collection);
  const to = out.renames.find((r) => r.from === 'Maria')?.to;
  check('2c. mixed he/she context -> a neutral replacement (no misgendering)', NEUTRAL_POOL.includes(to));
}

// 3 — determinism: identical inputs -> identical output.
{
  const prose = 'The stranger was Marcus. He smiled without warmth. Marcus had waited a long time.';
  const a = applyAnthologyNameRenames(prose, collection[2], collection); // current story 3 (Sophie)
  const b = applyAnthologyNameRenames(prose, collection[2], collection);
  check('3. deterministic: same inputs produce identical prose', a.prose === b.prose);
  check('3. male pronouns (he/his, no female) -> a clearly-male replacement', ['Ezekiel', 'Desmond', 'Ignacio', 'Bartholomew', 'Reginald', 'Amir', 'Tobias', 'Cornelius', 'Emmanuel', 'Horace', 'Rodrigo', 'Percival', 'Lionel', 'Everett', 'Mordecai', 'Ambrose'].includes(a.renames[0].to));
}

// 4 — a story's OWN protagonist is never renamed, even when it is the only name present.
{
  const prose = 'Maria walked the long way home. She was tired. Maria did not look back.';
  const out = applyAnthologyNameRenames(prose, collection[4], collection); // current story 5 (Maria)
  check('4. own protagonist (Maria in her own story) is untouched', out.renames.length === 0 && whole('Maria', out.prose));
}

// 5 — a name that is also a common English word is skipped (never risk corrupting prose).
{
  const withGrace = [...collection, mkStory(7, 'Grace')];
  const prose = 'The report was due. Grace under pressure mattered here. Sophie signed it.';
  const out = applyAnthologyNameRenames(prose, collection[2], withGrace); // current story 3 (Sophie)
  check('5. a common-word name (Grace) is not renamed', !out.renames.some((r) => r.from === 'Grace') && whole('Grace', out.prose));
}

// 6 — no collision -> prose returned unchanged.
{
  const prose = 'Sophie balanced the ledger alone. She found the discrepancy at midnight.';
  const out = applyAnthologyNameRenames(prose, collection[2], collection);
  check('6. non-colliding prose is unchanged with no renames', out.prose === prose && out.renames.length === 0);
}

// 7 — possessive forms are handled ("Maria's" -> replacement's).
{
  const prose = "Luis found Maria's note on the counter. Maria had gone.";
  const out = applyAnthologyNameRenames(prose, collection[3], collection);
  check('7. possessive "Maria\'s" is de-collided too', !whole('Maria', out.prose) && /'s note/.test(out.prose));
}

// 8 — source wiring in sceneWriter.
const sw = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
check('8. sceneWriter imports applyAnthologyNameRenames', /import \{ applyAnthologyNameRenames[^}]*\} from '@\/lib\/anthologyRenamePass'/.test(sw)); // NAMEREG-1: import widened to add extractProminentProseNames
check('8. RENAMEPASS-1 runs on finalProse for anthology', /if \(isAnthology && !isNF\) \{[\s\S]{0,400}applyAnthologyNameRenames\(finalProse, chapter, allProjectChapters\)/.test(sw));
check('8. rename result is written back to finalProse', sw.includes('finalProse = renamePass.prose;'));
// SCOPINGFIX-1: the gate is fiction-anthology-only — nonfiction anthologies (isNF true) must never
// be de-collided, or a real recurring name would be renamed to an invented one (fabrication).
check('8. RENAMEPASS-1 is scoped to fiction anthology (isNF excluded)', sw.includes('if (isAnthology && !isNF) {') && !/if \(isAnthology\) \{[\s\S]{0,400}applyAnthologyNameRenames/.test(sw));

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
