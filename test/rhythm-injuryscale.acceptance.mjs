// RHYTHM-1 + INJURYSCALE-1 acceptance — prose-rhythm advisories and the injury
// severity scale.
//
// WHY THIS FILE WAS REWRITTEN (2026-08-04)
// It read the live data/_FileStore.json and asserted that the CURRENT ch.5 text
// contains empty-sleeve language. Ch.5 was re-drafted clean at 88b13fdb, the
// sleeve sentence went with it, and the battery went red for a manuscript
// IMPROVING. It was measuring the book, not the gate. Frozen fixtures below.
import { measureRhythm, formatRhythmLine, isSeverelyFlat } from '../src/lib/proseRhythm.js';
import { extractLimbFacts, checkConditionInflation } from '../src/lib/sceneContractGate.js';

let failures = 0;
const check = (label, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + label); if (!ok) failures += 1; };

// ── RHYTHM-1: the disease, and a control that must stay silent ──
// Staccato: short declaratives, one gesture verb each. This is the shape the
// advisory exists to name, built rather than quoted so it cannot rot.
const STACCATO = Array.from({ length: 34 }, (_, i) =>
  ['He looked up.', 'She turned.', 'He nodded.', 'The door shut.', 'She waited.', 'He stood.'][i % 6]).join(' ');
const stac = formatRhythmLine('staccato', measureRhythm(STACCATO));
console.log('   ' + stac.line);
check('staccato prose raises at least three advisories', stac.flags.length >= 3);
check('staccato prose names the mean-length advisory', stac.flags.some((f) => f.startsWith('meanLen')));
check('staccato prose names the short-run advisory', stac.flags.some((f) => f.startsWith('shortRun')));
check('staccato prose names the gesture-density advisory', stac.flags.some((f) => f.startsWith('gestures')));
check('staccato prose is SEVERE enough to regenerate', isSeverelyFlat(measureRhythm(STACCATO)) === true);

const CONTROL = 'The station had been dead for eleven years, but the generators still remembered how to breathe, coughing twice before the floodlights stuttered on across the length of the turbine hall. Lena stood at the rail. Below her, black water moved through the machinery like something alive, patient and cold, carrying flakes of rust that spun in slow circles before the current pulled them under. She counted the seconds. When the lights steadied she saw what the water had been hiding all along, and her hand found the key in her pocket without her deciding anything at all.';
const ctl = formatRhythmLine('control', measureRhythm(CONTROL));
console.log('   ' + ctl.line);
check('varied-register control raises no run-length or gesture advisory',
  !ctl.flags.some((f) => f.startsWith('shortRun') || f.startsWith('gestures')));
check('a short sample raises no DISTRIBUTION advisory (too few sentences to judge)',
  !ctl.flags.some((f) => f.startsWith('meanLen') || f.startsWith('pctShort')));
check('a short sample is never SEVERE', isSeverelyFlat(measureRhythm(CONTROL)) === false);
check('empty text does not throw and raises nothing', formatRhythmLine('empty', measureRhythm('')).flags.length === 0);

// ── INJURYSCALE-1: severity is a scale, and the ledger owns where a body ends ──
const BOOKS = [
  { id: 'arctic thriller', who: 'Marcus Reed', other: 'Lena Ortiz' },
  { id: 'gothic mystery', who: 'Silas Bram', other: 'Nell Carrow' },
  { id: 'legal thriller', who: 'Peter Halloway', other: 'Ana Okonkwo' },
];
for (const b of BOOKS) {
  const cast = [{ name: b.who, gender: 'm' }, { name: b.other, gender: 'f' }];

  const thumb = extractLimbFacts('The gear tore through and his left thumb was severed at the second joint.', cast);
  check(`${b.id}: a thumb loss carries part=thumb`,
    thumb.length === 1 && thumb[0].part === 'thumb' && thumb[0].kind === 'loss');

  const fingers = extractLimbFacts('The mainspring let go and the last two fingers of her left hand were severed.', cast);
  check(`${b.id}: a finger loss is captured and is not an arm`,
    fingers.length === 1 && fingers[0].part !== 'arm' && fingers[0].kind === 'loss');

  const sleeve = extractLimbFacts(`${b.who} crossed the room, his left sleeve pinned flat against his side.`, cast);
  check(`${b.id}: an empty sleeve carries part=arm`,
    sleeve.length === 1 && sleeve[0].part === 'arm' && sleeve[0].kind === 'empty-sleeve');

  // The escalation the gate exists for: the ledger records a thumb; the prose
  // has quietly taken the whole arm.
  const inflation = checkConditionInflation({
    facts: sleeve, ledgerConditions: { [b.who.toLowerCase()]: ['left thumb amputated/severed'] },
  });
  check(`${b.id}: thumb in the ledger, arm on the page, is CONDITION_INFLATION`,
    inflation.length === 1 && inflation[0].code === 'CONDITION_INFLATION');
  check(`${b.id}: the complaint names the documented injury, not just "wrong"`,
    /thumb/i.test(inflation[0]?.message || ''));

  // Controls: the gate must be silent when it cannot rank the two.
  check(`${b.id}: a ledger entry with no named part stays silent`,
    checkConditionInflation({
      facts: sleeve, ledgerConditions: { [b.who.toLowerCase()]: ['left amputated/severed'] },
    }).length === 0);
  check(`${b.id}: an arm in the ledger and an arm on the page is silent`,
    checkConditionInflation({
      facts: sleeve, ledgerConditions: { [b.who.toLowerCase()]: ['left arm amputated/severed'] },
    }).length === 0);
  check(`${b.id}: an empty ledger never invents an inflation`,
    checkConditionInflation({ facts: sleeve, ledgerConditions: {} }).length === 0);
  check(`${b.id}: no facts means no complaint`,
    checkConditionInflation({ facts: [], ledgerConditions: { [b.who.toLowerCase()]: ['left thumb amputated/severed'] } }).length === 0);
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
