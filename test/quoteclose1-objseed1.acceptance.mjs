import { repairUnclosedDialogue, runDialogueMechanicsPass } from '../src/lib/dialogueMechanicsRepair.js';
import { trackedObjectsFromSpecs, seedTrackedObjectsFromSpecStates } from '../src/lib/objectPossession.js';

let failures = 0;
const check = (l, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + l); if (!ok) failures += 1; };
const O = (s) => (s.match(/“/g) || []).length;
const C = (s) => (s.match(/”/g) || []).length;
const words = (s) => s.replace(/[“”]/g, '').split(/\s+/).filter(Boolean).length;

// ── QUOTECLOSE-1: the live ch.3 shapes (2026-08-04 re-draft) ──
const live = 'Lena took a step forward, her boots crunching on the ice. “Do it, Marcus.';
const r1 = repairUnclosedDialogue(live);
check('closes an unclosed opener at end of paragraph', O(r1.text) === C(r1.text) && r1.repaired === 1);
check('the closer lands at the very end', r1.text.endsWith('Marcus.”'));
check('no word is added or removed', words(r1.text) === words(live));

const twoTurns = '“Marcus,” Lena said. Her tongue ticked against her teeth. “Let go.';
const r2 = repairUnclosedDialogue(twoTurns);
check('a closed turn plus an unclosed turn closes only the second',
  O(r2.text) === 2 && C(r2.text) === 2 && r2.repaired === 1);

// ── refusals: it must never guess ──
const balanced = '“I am fine,” he said. She did not believe him.';
check('balanced dialogue is untouched', repairUnclosedDialogue(balanced).text === balanced);
const narration = 'The corridor was dark. Water moved somewhere below.';
check('narration is untouched', repairUnclosedDialogue(narration).text === narration);
const midSentence = 'He turned and said “wait, the door is';
const r3 = repairUnclosedDialogue(midSentence);
check('an unterminated fragment is FLAGGED, not closed', r3.repaired === 0 && r3.flagged === 1 && r3.text === midSentence);
const emptyQuote = 'She stopped. “';
const r4 = repairUnclosedDialogue(emptyQuote);
check('an empty opener is flagged, never closed', r4.repaired === 0 && r4.flagged === 1);
const orphanCloser = 'He nodded. It is over,” she said.';
check('an orphan CLOSER is left to the existing healer', repairUnclosedDialogue(orphanCloser).text === orphanCloser);
check('question and exclamation ends also close',
  repairUnclosedDialogue('“Did it break?').repaired === 1 &&
  repairUnclosedDialogue('“Let go!').repaired === 1);
check('empty and non-string input are safe',
  repairUnclosedDialogue('').repaired === 0 && repairUnclosedDialogue(null).text === '');

// ── orchestrator wiring: the shape can never be silently zero again ──
const multi = [
  'Vale did not look up. “I have a suture kit in my pocket.',
  'The flame caught, blue and steady. “Hold still, Marcus.',
  'The corridor groaned above them.',
].join('\n');
const pass = runDialogueMechanicsPass(multi, { splitCollapsedParagraphs: true });
check('runDialogueMechanicsPass closes unclosed dialogue', pass.unclosedRepaired === 2);
check('the pass reports the new counters', typeof pass.unclosedFlagged === 'number');
check('the pass balances the text', O(pass.text) === C(pass.text));
check('the pass preserves every word', words(pass.text) === words(multi));
check('improved reflects an unclosed-only repair', pass.improved === true);

// ── OBJSEED-1: cast names are never objects ──
const CAST = ['Lena Ortiz', 'Marcus Reed', 'Dr. Nolan Vale'];
const liveSpecs = [
  { characters_present: CAST, entry_state: 'Lena holds the brass key, Marcus is injured but intact.' },
  { characters_present: CAST, exit_state: 'The group is separated, with Lena holding the key and Marcus and Dr. Vale struggling to survive.' },
];
check('live ch.3 seeding drops the phantom "key and marcus"',
  JSON.stringify(trackedObjectsFromSpecs(liveSpecs)) === '["brass key"]');
check('a conjunction ends the object phrase',
  JSON.stringify(seedTrackedObjectsFromSpecStates([{ characters_present: CAST, exit_state: 'Lena holds the key and the folder.' }])) === '["key"]');
check('a phrase containing a cast surname is rejected too',
  JSON.stringify(seedTrackedObjectsFromSpecStates([{ characters_present: CAST, entry_state: 'She holds the reed pipe.' }])) === '[]');
check('multi-word objects still seed intact',
  JSON.stringify(trackedObjectsFromSpecs([{ characters_present: CAST, exit_state: 'Marcus carries the folder of documents.' }])) === '["folder of documents"]');
check('honorific tokens do not blanket-reject',
  JSON.stringify(seedTrackedObjectsFromSpecStates([{ characters_present: CAST, exit_state: 'He carries the medical kit.' }])) === '["medical kit"]');
check('props_present still wins',
  JSON.stringify(trackedObjectsFromSpecs([{ characters_present: CAST, props_present: ['Brass Key'], exit_state: 'Lena holds the key.' }])) === '["Brass Key"]');
check('stopword noise still seeds nothing',
  JSON.stringify(seedTrackedObjectsFromSpecStates([{ characters_present: CAST, entry_state: 'She takes a deep breath. He takes the stairs down.' }])) === '[]');

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
