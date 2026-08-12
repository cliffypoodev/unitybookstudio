// EXTRACTFIX-1 -- the ledger's INTAKE, not its transport.
//
// Manuscript audit of brassmeridiantest 7 (2026-07-30), the first complete book with
// PARABREAK-1/2, LEDGERSCOPE-1, TRIMFLOOR-1 and DEADSPEECH-1 all live. Formatting was
// solved: longest paragraph 164 words (was 748), zero paragraphs over 200, quote
// imbalance zero, zero orphaned dialogue tags. Three big continuity defects were gone:
// the station is destroyed once instead of three times, the coordinates agree across all
// five chapters, and the amputation is finally written on the page.
//
// One defect survived. Chapter 5 says "left stump" three times, correctly. Chapter 4 says:
//
//   "The injury in his left hand was throbbing; she could see the tremor in his fingers."
//
// Fingers on a hand amputated in Chapter 3.
//
// The cause was NOT the ledger transport, which is proven working. It was the intake.
// Running Chapter 3's real 25-paragraph amputation passage through the live extractor
// produced ZERO facts. The one sentence that establishes the injury is:
//
//   "Marcus stood frozen. His left arm hung at his side, the hand a mangled mess of red
//    and white, fingers splayed at unnatural angles..."
//
// `left arm` matched. The owner resolved correctly to Marcus. Nothing fired, because
// `mangled` was not in the loss vocabulary. So Ch.3 saved conditions=0, Ch.4 was told
// nothing, and Ch.4 wrote "hand".
//
// A closed-world ledger is only as good as what gets into it.
import { extractLimbFacts } from '@/lib/sceneContractGate';
import { extractSceneLedgerUpdates, buildInitialLedger } from '@/lib/narrativeLedger';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}
const conds = (prose) => extractSceneLedgerUpdates(
  buildInitialLedger(), prose, { required_events: [], exit_state: '' }).characterConditions;
const dead = (s) => extractSceneLedgerUpdates(
  buildInitialLedger(), s, { required_events: [], exit_state: '' }).deadCharacters;

// --- the exact sentence from the manuscript ------------------------------

const REAL = 'Marcus stood frozen. His left arm hung at his side, the hand a mangled mess of red and white, fingers splayed at unnatural angles, the brass key still visible.';

check('EXTRACTFIX-1: the real Chapter 3 establishing sentence produces a fact',
  extractLimbFacts(REAL).length > 0);

check('EXTRACTFIX-1: it is attributed to MARCUS, not to whoever is nearby',
  (extractLimbFacts(REAL)[0] || {}).character === 'marcus');

check('EXTRACTFIX-1: the side is LEFT',
  (extractLimbFacts(REAL)[0] || {}).side === 'left');

check('EXTRACTFIX-1: it reaches the ledger as a character condition',
  (conds(REAL).marcus || []).some((c) => /amputated|severed/.test(c)));

// --- each added word, in the shape the structure requires ----------------

for (const word of ['mangled', 'mauled', 'pulped', 'shredded', 'maimed', 'ruined']) {
  check(`EXTRACTFIX-1: "${word}" counts as limb loss`,
    extractLimbFacts(`Marcus stood still. His left arm was a ${word} mess of red and white.`).length > 0);
}

// --- the original vocabulary must still work ----------------------------

for (const word of ['severed', 'amputated', 'crushed', 'missing', 'gone']) {
  check(`EXTRACTFIX-1: original word "${word}" still fires`,
    extractLimbFacts(`Marcus stood still. His left hand was ${word}.`).length > 0);
}

// --- the STRUCTURE is unchanged: these must all stay quiet ---------------

check('STRUCTURE: a healthy limb is not a loss',
  extractLimbFacts('Marcus flexed his left hand and picked up the wrench.').length === 0);

check('STRUCTURE: a limb with no injury word is not a loss',
  extractLimbFacts('Lena put her right hand on the console.').length === 0);

check('STRUCTURE: furniture is not a character',
  extractLimbFacts('The left arm of the chair was mangled where the ice had crushed it.').length === 0);

check('STRUCTURE: an abstract noun is not a limb',
  extractLimbFacts('Marcus sat down. His ruined reputation followed him from the surface.').length === 0);

check('STRUCTURE: an injury word with NO side is still not enough',
  extractLimbFacts('Marcus stood still. His arm was a mangled mess.').length === 0);

check('STRUCTURE: an injury word too far from the limb is still not enough',
  extractLimbFacts('Marcus stood still. His left hand rested on the rail beside the console and the map and the lamp and the long grey cabinet that was mangled.').length === 0);

check('STRUCTURE: a limb with no resolvable owner is still not enough',
  extractLimbFacts('The left arm was a mangled mess.').length === 0);

// --- deaths: more forms, SAME name-adjacent structure -------------------

for (const s of ['Vale died in the corridor.', 'Vale is dead.', 'Vale was killed in the collapse.']) {
  check(`DEATH: original form still fires -- "${s}"`, dead(s).includes('Vale'));
}
for (const s of ['Vale lay dying beside the console.', 'Vale is dying.', 'Vale lies dead on the grating.', 'Vale bled out before they reached him.']) {
  check(`DEATH: added form fires -- "${s}"`, dead(s).includes('Vale'));
}

check('DEATH: the LEDGERFIX-1 pronoun guard is INTACT -- "He died" registers nobody',
  dead('He died in the accident.').length === 0);

check('DEATH: "She is dying" also registers nobody',
  dead('She is dying.').length === 0);

check('DEATH: a real name after a pronoun death is still captured',
  dead('He died in the accident. Reed died beside him.').includes('Reed'));

// KNOWN GAP, asserted so it cannot be mistaken for working. Closing it needs a
// gap-tolerant pattern, which is the blind widening that caused LEDGERFIX-1.
check('DEATH: KNOWN GAP -- a death phrased with words between name and verb is NOT caught',
  dead('Dr. Vale collapses from exhaustion and injuries, dying in the corridor.').length === 0);

// --- the book-scope effect, chapter by chapter --------------------------

check('EXTRACTFIX-1: the condition now enters at the chapter where the injury happens',
  (() => {
    let led = buildInitialLedger();
    const ch3 = 'Marcus stood frozen. His left arm hung at his side, the hand a mangled mess of red and white.';
    const ch4 = 'Marcus dragged himself forward. He stopped beside the grating.';
    led = extractSceneLedgerUpdates(led, ch3, { required_events: [], exit_state: '' });
    const afterCh3 = (led.characterConditions.marcus || []).length > 0;
    led = extractSceneLedgerUpdates(led, ch4, { required_events: [], exit_state: '' });
    const stillAtCh4 = (led.characterConditions.marcus || []).length > 0;
    return afterCh3 && stillAtCh4;
  })());

check('EXTRACTFIX-1: a carried condition is rendered into the scene prompt',
  (() => {
    const led = extractSceneLedgerUpdates(buildInitialLedger(), REAL, { required_events: [], exit_state: '' });
    return JSON.stringify(led.characterConditions).includes('marcus');
  })());

check('EXTRACTFIX-1: extraction never mutates the ledger passed in',
  (() => {
    const input = buildInitialLedger();
    const before = JSON.stringify(input);
    extractSceneLedgerUpdates(input, REAL, { required_events: [], exit_state: '' });
    return JSON.stringify(input) === before;
  })());

console.log('\nLEDGER INTAKE (EXTRACTFIX-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
