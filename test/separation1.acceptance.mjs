import { auditSceneAgainstLedger } from '../src/lib/sceneContractGate.js';
import { buildInitialLedger, extractSceneLedgerUpdates } from '../src/lib/narrativeLedger.js';
import { trackedObjectsFromSpecs } from '../src/lib/objectPossession.js';

let failures = 0;
const check = (l, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + l); if (!ok) failures += 1; };

const CAST = ['Lena Ortiz', 'Marcus Reed', 'Dr. Nolan Vale'];
const GENDERED = CAST.map((n) => ({ name: n, gender: null }));
const sepCount = (spec, prose, separated, possessions = {}) => {
  const led = buildInitialLedger();
  led.separatedCharacters = separated;
  led.possessions = possessions;
  const r = auditSceneAgainstLedger({ prose, spec, runtimeLedger: led, sceneCast: GENDERED });
  return (r.issues || []).filter((i) => i.code === 'CHARACTER_SEPARATION_VIOLATION').length;
};

// ── The EXACT live ch.3 beats that hard-blocked the chapter (2026-08-03) ──
const S1 = {
  scene_id: 'ch03-s01',
  scene_goal: 'Set up the attempt to access the archive and escalate tension.',
  required_events: ['Marcus takes the key to explore another section of the station.', 'The group expresses frustration over the missing records.'],
  entry_state: 'The group is in the archive room, realizing the records are missing. The key is with Lena.',
  exit_state: 'Marcus leaves with the key, and Lena and Dr. Vale remain in the archive room.',
  characters_present: CAST,
};
const S2 = {
  scene_id: 'ch03-s02',
  scene_goal: "Escalate tension through Marcus's accident and its aftermath.",
  required_events: ['Marcus triggers a mechanical door, leading to the loss of his hand.', 'Lena and Dr. Vale rush to help Marcus.'],
  entry_state: 'Marcus is exploring a new section with the key, hoping to find records.',
  exit_state: 'Marcus is injured, and the group tends to his wound.',
  characters_present: CAST,
};
const S1_PROSE = 'Marcus took the key from her hand. "I will check the east corridor," he said. Marcus leaves Lena behind and walks into the dark.';
const S2_PROSE = 'Marcus screamed. The panel had closed on his hand. Lena rushed to Marcus and pulled at the lever. Vale knelt beside Marcus, his cane clattering to the floor.';

let ledger = buildInitialLedger();
ledger = extractSceneLedgerUpdates(ledger, S1_PROSE, S1, { sceneCast: CAST, trackedObjects: ['key'] });
check('s1 still RECORDS the separation (the fix does not blind the ledger)',
  ledger.separatedCharacters.includes('Marcus'));

const live = auditSceneAgainstLedger({ prose: S2_PROSE, spec: S2, runtimeLedger: ledger, sceneCast: GENDERED });
check('live ch.3 s2 raises ZERO separation violations (was 3, hard-blocked the chapter)',
  (live.issues || []).filter((i) => i.code === 'CHARACTER_SEPARATION_VIOLATION').length === 0);

const afterS2 = extractSceneLedgerUpdates(ledger, S2_PROSE, S2, { sceneCast: CAST, trackedObjects: ['key'] });
check('written reunion clears the separation for later scenes ("Lena rushed to Marcus")',
  afterS2.separatedCharacters.length === 0);

// ── Authorization is required_events + scene_goal ONLY ──
check('a required event that names both authorizes co-presence',
  sepCount({ scene_goal: 'Escalate.', required_events: ['Lena and Dr. Vale rush to help Marcus.'] },
    'Lena knelt over Marcus and pressed the cloth down.', ['Marcus']) === 0);
check('the scene goal naming both also authorizes',
  sepCount({ scene_goal: 'Lena reaches Marcus in the flooded corridor.', required_events: ['The water rises.'] },
    'Lena pulled Marcus up by the collar.', ['Marcus']) === 0);
check('entry_state naming both does NOT authorize (position, not action)',
  sepCount({ scene_goal: 'Lena searches alone.', required_events: ['Lena reads the logbook.'],
    entry_state: 'Lena is in the archive. Marcus is elsewhere in the station.' },
    'Lena turned the page. Marcus put his hand on Lena’s shoulder.', ['Marcus']) > 0);
check('exit_state naming both does NOT authorize',
  sepCount({ scene_goal: 'Lena searches alone.', required_events: ['Lena reads the logbook.'],
    exit_state: 'Lena leaves; Marcus is still on the lower level.' },
    'Lena turned the page. Marcus put his hand on Lena’s shoulder.', ['Marcus']) > 0);
check('a plan that never names the separated character still flags co-presence',
  sepCount({ scene_goal: 'Lena searches the archive alone.', required_events: ['Lena reads the last logbook.'] },
    'Lena turned the page. Marcus put his hand on Lena’s shoulder.', ['Marcus']) > 0);
// Lena is passed via ledger possessions so she is a TRUSTED character even though
// this scene's plan never names her (getTrustedCharacters draws from spec + ledger).
check('naming ONLY the separated character does not authorize',
  sepCount({ scene_goal: 'Marcus crawls through the duct alone.', required_events: ['Marcus loses his light.'] },
    'Marcus reached back and Lena took his wrist.', ['Marcus'], { Lena: ['key'] }) > 0);
check('nobody separated means no violations at all',
  sepCount({ scene_goal: 'Anything.', required_events: ['Anything happens.'] },
    'Lena and Marcus and Vale stood together.', []) === 0);

// ── Reunion verb coverage: past tense and symmetry (the old regex was present-tense, subject-only) ──
const reunion = (prose) => {
  const led = buildInitialLedger();
  led.separatedCharacters = ['Marcus', 'Lena'];
  return extractSceneLedgerUpdates(led, prose, { scene_goal: 'x', required_events: ['y'] },
    { sceneCast: CAST, trackedObjects: [] }).separatedCharacters;
};
check('past-tense "found" clears (old regex only knew "finds")', reunion('Lena found Marcus in the dark.').length === 0);
check('"rushed to" clears', reunion('Lena rushed to Marcus.').length === 0);
check('"reached" clears', reunion('Lena reached Marcus at the hatch.').length === 0);
check('"caught up with" clears', reunion('Lena caught up with Marcus.').length === 0);
check('a reunion clears EVERY trusted name in the sentence, not just the subject',
  reunion('Lena found Marcus in the dark.').length === 0);
check('a sentence with no reunion verb clears nothing',
  reunion('Lena thought about Marcus.').length === 2);

// ── SEPARATION-1c: function-word trim in tracked-object seeding ──
check('live ch.3 seeding yields ["key"], not the phantom "key to explore"',
  JSON.stringify(trackedObjectsFromSpecs([S1, S2])) === '["key"]');
check('function-word trim keeps multi-word objects intact',
  JSON.stringify(trackedObjectsFromSpecs([{ exit_state: 'Marcus carries the folder of documents.' }])) === '["folder of documents"]');
check('trim does not resurrect stopword phrases',
  JSON.stringify(trackedObjectsFromSpecs([{ entry_state: 'She takes a deep breath. He takes the stairs down.' }])) === '[]');

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
