import { buildInitialLedger, extractSceneLedgerUpdates, serializeLedger, mergeLedgers, cloneLedger } from '../src/lib/narrativeLedger.js';

let failures = 0;
const check = (l, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + l); if (!ok) failures += 1; };
const extract = (prose) => extractSceneLedgerUpdates(buildInitialLedger(), prose, {}, { sceneCast: [], trackedObjects: ['key'] });

// ── the REAL ch.3 breakage sentences ──
const ch3 = 'He tried to force it further, twisting until his knuckles turned white. The key snapped. A clean ping. The top half of the key remained in the slot. The bottom half fell into the water, disappearing into the murk.';
const led3 = extract(ch3);
check('real ch.3 snap registers broken (snapped)', (led3.objectConditions.key || []).includes('broken (snapped)'));
check('real ch.3 half-loss registers partial condition', (led3.objectConditions.key || []).some((c) => c.includes('only part')));

// ── rendering ──
const ser = serializeLedger(led3);
check('serialized ledger carries OBJECT CONDITIONS block', ser.includes('OBJECT CONDITIONS'));
check('serialized ledger forbids intact depiction', ser.includes('cannot appear or function as an intact object'));

// ── closed world: only tracked objects, only narration ──
check('non-object breaks register nothing',
  JSON.stringify(extract('His voice broke. The cable snapped. She bent down over the rail.').objectConditions) === '{}');
check('a quoted CLAIM of breakage is not a scene event',
  JSON.stringify(extract('“The key snapped,” she lied. He knew better.').objectConditions) === '{}');
check('untracked object never carries a condition',
  JSON.stringify(extractSceneLedgerUpdates(buildInitialLedger(), 'The lantern cracked.', {}, { sceneCast: [], trackedObjects: ['key'] }).objectConditions) === '{}');

// ── repair: explicit value, prose order wins ──
check('break then written repair ends repaired',
  JSON.stringify(extract('The key snapped. Later he fused the key with the torch.').objectConditions) === '{"key":["repaired"]}');
check('repair then re-break ends broken',
  JSON.stringify(extract('He fused the key back together. Then the key snapped again.').objectConditions) === '{"key":["broken (snapped)"]}');

// ── fold semantics: cumulative ledgers, later chapter wins per key ──
const broken = buildInitialLedger(); broken.objectConditions = { key: ['broken (snapped)'] };
const repaired = buildInitialLedger(); repaired.objectConditions = { key: ['repaired'] };
const untouched = buildInitialLedger();
check('fold(broken -> repaired) = repaired (a written repair survives the fold)',
  JSON.stringify(mergeLedgers(broken, repaired).objectConditions) === '{"key":["repaired"]}');
check('fold(repaired -> broken) = broken (a re-break survives the fold)',
  JSON.stringify(mergeLedgers(repaired, broken).objectConditions) === '{"key":["broken (snapped)"]}');
check('fold(broken -> untouched chapter) keeps broken',
  JSON.stringify(mergeLedgers(broken, untouched).objectConditions) === '{"key":["broken (snapped)"]}');
check('repaired renders NO object-conditions block', !serializeLedger(repaired).includes('OBJECT CONDITIONS'));

// ── plumbing ──
check('buildInitialLedger carries objectConditions', JSON.stringify(buildInitialLedger().objectConditions) === '{}');
check('cloneLedger deep-copies objectConditions', (() => {
  const a = buildInitialLedger(); a.objectConditions = { key: ['broken (snapped)'] };
  const b = cloneLedger(a); b.objectConditions.key.push('x');
  return a.objectConditions.key.length === 1;
})());
check('spec strings alone register nothing (prose is the sole source)',
  JSON.stringify(extractSceneLedgerUpdates(buildInitialLedger(), '', { exit_state: 'The key snapped.' }, { sceneCast: [], trackedObjects: ['key'] }).objectConditions) === '{}');

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
