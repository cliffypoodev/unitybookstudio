// TRIMFLOOR-1 + DEADSPEECH-1 -- the two defects that killed chapters in the
// 2026-07-30 live run on 96847df.
//
// Both are the same failure in different clothes: something that CANNOT put a false
// statement on the page destroyed a finished chapter anyway. The governing principle
// says integrity gates fail closed and quality repairs repair-then-report. A trim that
// empties a required field, and an integrity gate that burns its whole budget on a
// false positive, both violate it.
import { repairRawContract } from '@/lib/sceneBeatNormalizer';
import { auditSceneAgainstLedger } from '@/lib/sceneContractGate';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}
const txt = (v) => String(v || '').trim();

// -------------------------------------------------------------------------
// TRIMFLOOR-1
//
// Live kill, Chapter 5. sceneBeatNormalizer trims "destruction bleed" out of the
// previous scene's exit_state. The real exit_state was:
//   "Lena is emotionally shattered, and Marcus's attempt to explain his actions
//    fails, leading to a breakdown in their relationship."
// Nothing is destroyed -- "shattered" describes a person. The old global replace
// consumed every matching sentence, exit_state became "", and generationContext
// rejected `Scene 2: exit_state is missing`. A repair threw the chapter away.
// -------------------------------------------------------------------------

const CH5 = () => ([
  { scene_id: 'ch05-s01', required_events: ['Lena and Marcus navigate the collapsing station.'],
    entry_state: 'Lena and Marcus are in the corridor near Sector Four.',
    exit_state: 'Lena and Marcus reach the final archive section.' },
  { scene_id: 'ch05-s02', required_events: ['Lena discovers logs confirming Marcus role.'],
    entry_state: 'Lena and Marcus are in the final archive section.',
    exit_state: 'Lena is emotionally shattered, and Marcus attempt to explain his actions fails, leading to a breakdown in their relationship.' },
  { scene_id: 'ch05-s03', required_events: ['Lena decides to destroy the key to protect Marcus.'],
    entry_state: 'Lena confronts Marcus about his guilt.',
    exit_state: 'Lena destroys the key and escapes the station.' },
]);

check('TRIMFLOOR-1: the real Chapter 5 exit_state is no longer emptied',
  txt(repairRawContract(CH5()).beats[1].exit_state).length > 0);

check('TRIMFLOOR-1: the real Chapter 5 exit_state is preserved WORD FOR WORD',
  txt(repairRawContract(CH5()).beats[1].exit_state) === txt(CH5()[1].exit_state));

check('TRIMFLOOR-1: no spurious TRIM_BLEED repair is reported for an emotional state',
  !(repairRawContract(CH5()).repairs || []).some((r) => r.type === 'TRIM_BLEED'));

check('TRIMFLOOR-1: no beat is left with an empty exit_state',
  repairRawContract(CH5()).beats.every((b) => txt(b.exit_state).length > 0));

check('TRIMFLOOR-1: no beat is left with an empty entry_state',
  repairRawContract(CH5()).beats.every((b) => txt(b.entry_state).length > 0));

// --- the trim must STILL work when an object really is destroyed ----------

const OBJ = () => ([
  { scene_id: 'a', required_events: ['They reach the hatch.'], entry_state: 'e1',
    exit_state: 'They reach the hatch. The brass key is destroyed in the press.' },
  { scene_id: 'b', required_events: ['Lena destroys the brass key.'], entry_state: 'e2',
    exit_state: 'The archive is open.' },
]);

check('TRIMFLOOR-1: a REAL object destruction is still trimmed out of the prior exit',
  !/destroyed/i.test(repairRawContract(OBJ()).beats[0].exit_state));

check('TRIMFLOOR-1: the surviving sentence is kept intact',
  txt(repairRawContract(OBJ()).beats[0].exit_state) === 'They reach the hatch.');

check('TRIMFLOOR-1: a real trim is still REPORTED as a repair',
  (repairRawContract(OBJ()).repairs || []).some((r) => r.type === 'TRIM_BLEED'));

// --- the floor: never write back empty -----------------------------------

const ALL_DESTRUCTION = () => ([
  { scene_id: 'a', required_events: ['x'], entry_state: 'e1',
    exit_state: 'The key is destroyed. The console is broken.' },
  { scene_id: 'b', required_events: ['Lena destroys the key and breaks the console.'], entry_state: 'e2',
    exit_state: 'Done.' },
]);

check('TRIMFLOOR-1: when EVERY sentence would be trimmed, the field is not emptied',
  txt(repairRawContract(ALL_DESTRUCTION()).beats[0].exit_state).length > 0);

check('TRIMFLOOR-1: declining the trim reports NO repair (nothing changed)',
  !(repairRawContract(ALL_DESTRUCTION()).repairs || []).some((r) => r.type === 'TRIM_BLEED'));

// --- emotional shapes that must never be read as destruction -------------

for (const [label, sentence] of [
  ['emotionally shattered', 'Lena is emotionally shattered by the recording.'],
  ['is shattered', 'Marcus is shattered.'],
  ['left broken', 'She was left broken by what she read.'],
  ['shattered by', 'Lena, shattered by the truth, sat down.'],
]) {
  const beats = [
    { scene_id: 'a', required_events: ['x'], entry_state: 'e1', exit_state: sentence },
    { scene_id: 'b', required_events: ['Lena decides to destroy the key.'], entry_state: 'e2', exit_state: 'y' },
  ];
  check(`TRIMFLOOR-1: "${label}" is an emotional state, not destruction`,
    txt(repairRawContract(beats).beats[0].exit_state) === txt(sentence));
}

check('TRIMFLOOR-1: repairRawContract never mutates the beats passed in',
  (() => {
    const input = CH5();
    const before = JSON.stringify(input);
    repairRawContract(input);
    return JSON.stringify(input) === before;
  })());

// -------------------------------------------------------------------------
// DEADSPEECH-1
//
// Live kill, Chapter 4 scene 3. The gate is RIGHT that a dead character cannot act,
// and it stays hard and fail-closed. But the detector is a bare verb regex, so it
// also fires on a dead man NAMED inside another character's quoted line. On the live
// run the repair fixed the real violation on pass 1, then tripped on reported speech
// for passes 2 and 3 and the chapter was hard-rejected:
//
//   pass=1/3 remaining="\u201cThe hydraulic pressure is building,\u201d Vale said."   <- real
//   pass=2/3 remaining="\u201cVale said the key opens the archive,\u201d Lena said."  <- FALSE
//   pass=3/3 remaining="Vale said."
//   NarrativeInvariantError: Scene ch04-s03 was rejected
//
// The verb list is unchanged. Only the reported-speech shape is excluded.
// -------------------------------------------------------------------------

const LEDGER = () => ({
  deadCharacters: ['Vale'], unavailableObjects: [], completedEvents: [],
  characterConditions: {}, possessions: {}, droppedObjects: [], separatedCharacters: [],
  locations: {}, objects: {}, objectLocations: {},
});
const SPEC = { scene_id: 'ch04-s03', required_events: [], entry_state: 'e', exit_state: 'x' };
const flagged = (prose) => {
  const r = auditSceneAgainstLedger({ prose, runtimeLedger: LEDGER(), spec: SPEC, accumulatedProse: '' });
  const issues = Array.isArray(r) ? r : (r && r.issues) || [];
  return issues.some((i) => i.code === 'DEAD_CHARACTER_ACTION');
};

// --- must STILL fire: the gate is an integrity gate and stays hard --------

check('DEADSPEECH-1: a dead character speaking in narration is STILL a violation',
  flagged('\u201cThe hydraulic pressure is building,\u201d Vale said.'));

check('DEADSPEECH-1: a dead character acting is STILL a violation',
  flagged('Vale nodded and crossed the room.'));

check('DEADSPEECH-1: a dead character acting AFTER a quote closes is STILL a violation',
  flagged('\u201cWe should go,\u201d Lena said. Vale turned toward the door.'));

check('DEADSPEECH-1: a dead character acting BEFORE any quote opens is STILL a violation',
  flagged('Vale walked to the console. \u201cIt is holding,\u201d Lena said.'));

check('DEADSPEECH-1: a dead character acting between two quoted lines is STILL a violation',
  flagged('\u201cReady?\u201d Lena said. Vale shook his head. \u201cNot yet,\u201d she said.'));

// --- must NOT fire: reported speech is memory, not action ----------------

check('DEADSPEECH-1: the exact Chapter 4 false positive no longer fires',
  !flagged('\u201cVale said the key opens the archive,\u201d Lena said.'));

check('DEADSPEECH-1: a remembered line inside dialogue does not fire',
  !flagged('Lena remembered the briefing. \u201cVale said it would protect the program,\u201d she said.'));

check('DEADSPEECH-1: the 2026-07-29 false positive does not fire either',
  !flagged('\u201cBecause Vale said it would protect the program,\u201d Marcus said.'));

check('DEADSPEECH-1: a quoted line that only NAMES the dead man does not fire',
  !flagged('\u201cVale nodded when I asked him,\u201d Marcus said. Lena said nothing.'));

// --- the discrimination itself -------------------------------------------

check('DEADSPEECH-1: real violation and reported speech in the SAME scene still flags',
  flagged('\u201cVale said the key opens it,\u201d Lena said. Vale nodded from the doorway.'));

check('DEADSPEECH-1: a living character is never flagged',
  (() => {
    const r = auditSceneAgainstLedger({
      prose: 'Lena said nothing. Marcus nodded.', runtimeLedger: LEDGER(), spec: SPEC, accumulatedProse: '' });
    const issues = Array.isArray(r) ? r : (r && r.issues) || [];
    return !issues.some((i) => i.code === 'DEAD_CHARACTER_ACTION');
  })());

check('DEADSPEECH-1: an empty dead-character list flags nothing',
  (() => {
    const r = auditSceneAgainstLedger({
      prose: 'Vale said nothing.', runtimeLedger: { ...LEDGER(), deadCharacters: [] }, spec: SPEC, accumulatedProse: '' });
    const issues = Array.isArray(r) ? r : (r && r.issues) || [];
    return !issues.some((i) => i.code === 'DEAD_CHARACTER_ACTION');
  })());

check('DEADSPEECH-1: the violation still carries its quoted evidence (DEADCHARFIX-1)',
  (() => {
    const r = auditSceneAgainstLedger({
      prose: 'Vale nodded and crossed the room.', runtimeLedger: LEDGER(), spec: SPEC, accumulatedProse: '' });
    const issues = Array.isArray(r) ? r : (r && r.issues) || [];
    const d = issues.find((i) => i.code === 'DEAD_CHARACTER_ACTION');
    return !!d && typeof d.excerpt === 'string' && d.excerpt.includes('Vale nodded');
  })());

check('DEADSPEECH-1: straight-quote prose behaves exactly as before (no silent change)',
  flagged('"The pressure is building," Vale said.'));

console.log('\nCHAPTER-KILL REPAIRS (TRIMFLOOR-1 + DEADSPEECH-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
