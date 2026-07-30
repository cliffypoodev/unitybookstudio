// STATEFIX-1 -- character state is not just arms.
//
// After nine fixes made an amputated hand survive a chapter boundary, the honest
// scope of that win was narrow: extractLimbFacts understands exactly four body parts
// (forearm, arm, hand, wrist) and three conditions (loss, stump, empty sleeve).
// Everything else a character can permanently BECOME was invisible to the ledger.
// A character blinded in Chapter 3 is seeing again in Chapter 5 and nothing notices --
// the same defect that took all week to kill for a hand, wearing a different costume.
//
// This is a SEPARATE extractor. extractLimbFacts is untouched, because
// findLimbContradictions and findInstantProsthetics depend on its `side` field and on
// it never firing outside arms.
//
// PRECISION OVER RECALL is the governing rule here, and it is not symmetrical:
// a missed condition is drift the author can catch on the page, but a FALSE condition
// is injected into every later scene prompt and actively damages the prose -- it would
// tell the ghostwriter that a sighted character is blind. When phrasing is ambiguous,
// record nothing. Hence the deliberate refusal of bare "blinded her" / "deafened him":
// "the glare blinded her" and "the acid blinded her" are structurally identical and
// only one of them is permanent.
import { extractCharacterStateFacts, extractLimbFacts } from '@/lib/sceneContractGate';
import { extractSceneLedgerUpdates, buildInitialLedger, serializeLedger, mergeLedgers } from '@/lib/narrativeLedger';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}
const labels = (s) => extractCharacterStateFacts(s).map((x) => `${x.character}:${x.label}`);
const quiet = (s) => extractCharacterStateFacts(s).length === 0;
const conds = (s) => extractSceneLedgerUpdates(
  buildInitialLedger(), s, { required_events: [], exit_state: '' }).characterConditions;

// ─── PRECISION: temporary and figurative states must NEVER be recorded ──────

check('PRECISION: a glare that blinds momentarily is not blindness',
  quiet('Ana turned the corner. The glare blinded her for a moment.'));

check('PRECISION: a muzzle flash is not blindness',
  quiet('Ana ducked. The muzzle flash blinded her.'));

check('PRECISION: "blinded by the flash" is not blindness',
  quiet('Ana ducked. She was blinded by the flash of the welding torch.'));

check('PRECISION: a blind corner is not a blind character',
  quiet('Ana slowed at the blind corner.'));

check('PRECISION: a deafening roar is not deafness',
  quiet('Ana covered her ears. The deafening roar of the engine filled the bay.'));

check('PRECISION: a blast that deafens for a second is not deafness',
  quiet('Reed flinched. The blast deafened him for a second.'));

check('PRECISION: paralysed WITH FEAR is not paralysis',
  quiet('Ana froze, paralysed with fear as the door opened.'));

check('PRECISION: cheeks burning with shame is not a burn injury',
  quiet('Ana looked away. Her cheeks burned with shame.'));

check('PRECISION: a fire burning is not a burn injury',
  quiet('The fire burned through the night.'));

check('PRECISION: exhaustion is not a permanent condition',
  quiet('Ana was exhausted. She had not slept in two days.'));

check('PRECISION: an aching shoulder is not a lost limb',
  quiet('Ana was tired and her shoulder ached.'));

check('PRECISION: furniture is not a character',
  quiet('The left leg of the table was crushed under the debris.'));

check('PRECISION: a state with no resolvable owner records nothing',
  quiet('The left leg was gone below the knee.'));

// ─── RECALL: each irreversible category, in the shape prose actually uses ────

check('RECALL: blindness -- "left her blind"',
  labels('Ana screamed. The acid left her blind.').includes('ana:blind'));

check('RECALL: blindness -- "lost her sight"',
  labels('Ana lost her sight in the explosion.').includes('ana:blind'));

check('RECALL: blindness -- explicit permanence',
  labels('The shard blinded Ana for life.').includes('ana:blind'));

check('RECALL: deafness -- "stone deaf"',
  labels('Reed was stone deaf after the blast.').includes('reed:deaf'));

check('RECALL: deafness -- "lost his hearing"',
  labels('Reed lost his hearing in the collapse.').includes('reed:deaf'));

check('RECALL: paralysis',
  labels('Reed hit the deck hard. He was paralysed from the waist down.').includes('reed:paralysed'));

check('RECALL: a broken back counts as paralysis',
  labels('Reed broke his back in the fall.').includes('reed:paralysed'));

check('RECALL: disfigurement',
  labels('Ana was badly scarred by the fire.').includes('ana:scarred'));

check('RECALL: severe burns',
  labels('Ana suffered third-degree burns across her back.').includes('ana:burned'));

check('RECALL: pregnancy',
  labels('Ana was pregnant, and had been for three months.').includes('ana:pregnant'));

// ─── RECALL: lateral body parts the limb extractor never covered ────────────

for (const [part, sentence] of [
  ['leg', 'Reed staggered. His left leg was gone below the knee.'],
  ['foot', 'Reed stood there. The machine crushed his right foot.'],
  ['eye', 'Ana screamed. Her right eye was severed by the shard.'],
  ['finger', 'Ana swore. Her left finger was severed by the blade.'],
  ['knee', 'Reed collapsed. His right knee was crushed under the beam.'],
]) {
  check(`RECALL: a lost ${part} is recorded (extractLimbFacts never saw these)`,
    labels(sentence).some((l) => l.includes(part)));
}

// ─── the ORIGINAL limb extractor must be completely unchanged ───────────────

check('UNCHANGED: extractLimbFacts still catches the Chapter 3 arm injury',
  extractLimbFacts('Marcus stood frozen. His left arm hung at his side, the hand a mangled mess of red and white.').length > 0);

check('UNCHANGED: extractLimbFacts still reports a side',
  (extractLimbFacts('Marcus stood still. His left hand was severed.')[0] || {}).side === 'left');

check('UNCHANGED: extractLimbFacts still ignores non-arm parts (its gates rely on this)',
  extractLimbFacts('Reed staggered. His left leg was gone below the knee.').length === 0);

check('UNCHANGED: extractLimbFacts still stays quiet on a healthy limb',
  extractLimbFacts('Marcus flexed his left hand and picked up the wrench.').length === 0);

// ─── the ledger: storage, carry, and the prompt ─────────────────────────────

check('LEDGER: a non-lateral state is stored without a side prefix',
  (conds('Ana screamed. The acid left her blind.').ana || []).includes('blind'));

check('LEDGER: a lateral loss keeps its side and part',
  (conds('Reed staggered. His left leg was gone below the knee.').reed || [])
    .some((c) => c.includes('left') && c.includes('leg')));

check('LEDGER: arm injuries and other states coexist on different characters',
  (() => {
    let led = buildInitialLedger();
    const step = (p) => { led = extractSceneLedgerUpdates(led, p, { required_events: [], exit_state: '' }); };
    step('Ana pulled back from the console. The acid left her blind.');
    step('Reed hit the deck. He was paralysed from the waist down.');
    step('Marcus stood frozen. His left arm hung at his side, the hand a mangled mess.');
    return (led.characterConditions.ana || []).includes('blind')
      && (led.characterConditions.reed || []).includes('paralysed')
      && (led.characterConditions.marcus || []).some((c) => /amputated|severed/.test(c));
  })());

check('LEDGER: states survive the chapter boundary (irreversible union)',
  (() => {
    const ch3 = extractSceneLedgerUpdates(buildInitialLedger(),
      'Ana screamed. The acid left her blind.', { required_events: [], exit_state: '' });
    const merged = mergeLedgers(ch3, buildInitialLedger());
    return (merged.characterConditions.ana || []).includes('blind');
  })());

check('PROMPT: a carried state is rendered into the scene prompt',
  (() => {
    const led = extractSceneLedgerUpdates(buildInitialLedger(),
      'Ana screamed. The acid left her blind.', { required_events: [], exit_state: '' });
    const out = serializeLedger(mergeLedgers(led, buildInitialLedger()));
    return out.includes('CHARACTER CONDITIONS') && out.includes('ana') && out.includes('blind');
  })());

check('LEDGER: the same state twice does not duplicate',
  (() => {
    let led = buildInitialLedger();
    const p = 'Ana screamed. The acid left her blind.';
    led = extractSceneLedgerUpdates(led, p, { required_events: [], exit_state: '' });
    led = extractSceneLedgerUpdates(led, p, { required_events: [], exit_state: '' });
    return (led.characterConditions.ana || []).filter((c) => c === 'blind').length === 1;
  })());

check('LEDGER: extraction never mutates the ledger passed in',
  (() => {
    const input = buildInitialLedger();
    const before = JSON.stringify(input);
    extractSceneLedgerUpdates(input, 'Ana screamed. The acid left her blind.', { required_events: [], exit_state: '' });
    return JSON.stringify(input) === before;
  })());

check('SAFETY: empty and garbage input do not throw',
  (() => {
    try {
      extractCharacterStateFacts('');
      extractCharacterStateFacts(null);
      extractCharacterStateFacts(undefined);
      extractCharacterStateFacts(42);
      return true;
    } catch (e) { return false; }
  })());

console.log('\nCHARACTER STATE LEDGER (STATEFIX-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
