// USEDNAMES-1 acceptance battery — anthology stories forbid every OTHER story's character names.
//
// The defect (measured live 2026-08-10 on Night Shift, after context isolation was already
// airtight): qwen3.6-35b draws minor-character names from a small default pool and reuses other
// stories' protagonists as walk-ons — Story 1's lead "Marcus" resurfaced as a minor character in
// Story 3; "Maria" (Story 5 lead) and "Clara" (Story 6 lead) likewise. Isolation can't fix a
// naming coincidence. The fix collects every sibling story's character names from their plans
// (beat_summary story data) and injects them as a BANNED CHARACTER NAMES block into this story's
// scene prompt, so each story invents its own cast. The current story's own names are never
// banned. This battery imports the REAL buildAnthologyChapterVarietyBlock and checks the banned
// list directly. Fixtures are generic — no book-specific strings.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAnthologyChapterVarietyBlock } from '../src/lib/anthologyVarietyGuard.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

const mkStory = (n, name) => ({ chapter_number: n, beat_summary: JSON.stringify({ protagonist: { name }, premise: 'A standalone story.' }) });
const bannedLineOf = (block) => (block.split('\n').find((l) => l.startsWith('BANNED CHARACTER NAMES')) || '');

// A 5-story collection; current story is #3 (Sophie Chen).
const chapters = [
  mkStory(1, 'Marcus Vale'),
  mkStory(2, 'Eva Ruiz'),
  mkStory(3, 'Sophie Chen'),
  mkStory(5, 'Maria'),
  mkStory(6, 'Clara'),
];
const cur3 = chapters.find((c) => c.chapter_number === 3);
const block = buildAnthologyChapterVarietyBlock({ project_type: 'anthology' }, cur3, chapters);
const banned = bannedLineOf(block);

check('1. a banned-names line is emitted for an anthology story with siblings', banned.length > 0 && block.includes('BANNED CHARACTER NAMES'));
check('1. every OTHER story\'s protagonist name is banned', ['Marcus', 'Vale', 'Eva', 'Ruiz', 'Maria', 'Clara'].every((n) => banned.includes(n)));
check('2. the current story\'s OWN names are NOT banned', !/\bSophie\b/.test(banned) && !/\bChen\b/.test(banned));

// Named supporting cast (characters/cast arrays) is collected too, not just protagonists.
const chapters2 = [
  mkStory(3, 'Sophie Chen'),
  { chapter_number: 1, beat_summary: JSON.stringify({ protagonist: { name: 'Adam' }, characters: [{ name: 'Diego Ramos' }, 'Nora'] }) },
];
const banned2 = bannedLineOf(buildAnthologyChapterVarietyBlock({ project_type: 'anthology' }, cur3, chapters2));
check('3. named supporting cast from a sibling is banned too', ['Adam', 'Diego', 'Ramos', 'Nora'].every((n) => banned2.includes(n)));

// Non-anthology projects get no variety block at all (and thus no banned list).
check('4. a non-anthology project returns an empty block', buildAnthologyChapterVarietyBlock({ project_type: 'novel' }, cur3, chapters) === '');

// A story with no siblings yet gets no banned block.
const solo = buildAnthologyChapterVarietyBlock({ project_type: 'anthology' }, cur3, [mkStory(3, 'Sophie Chen')]);
check('5. a story with no sibling stories emits no banned-names line', !solo.includes('BANNED CHARACTER NAMES'));

// Malformed sibling beat_summary is skipped without throwing.
let robust = true;
try {
  buildAnthologyChapterVarietyBlock({ project_type: 'anthology' }, cur3, [cur3, { chapter_number: 2, beat_summary: '{not json' }]);
} catch { robust = false; }
check('5. malformed sibling plan is skipped, not thrown', robust);

// Source wiring.
const src = fs.readFileSync(path.join(ROOT, 'src/lib/anthologyVarietyGuard.js'), 'utf8');
check('6. USEDNAMES-1 marker present', src.includes('USEDNAMES-1'));
check('6. banned block is appended into the returned variety block', src.includes('${_bannedBlock}'));
check('6. current story is skipped when collecting names', src.includes('n === chapterNumber) continue;'));

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
