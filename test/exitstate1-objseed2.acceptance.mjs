// EXITSTATE-1 + OBJSEED-2 acceptance.
//
// Runs the REAL exported functions. The exit-state audit is driven with a stubbed
// invoke function so no LLM is required and every branch is reachable; no logic is
// re-implemented here. The object-seed cases use the ACTUAL beat contracts from the
// live Brass Meridian TEST ch.4 and ch.5 runs of 2026-08-04.
import {
  seedTrackedObjectsFromSpecStates,
  trackedObjectsFromSpecs,
  isPortablePropPhrase,
} from '../src/lib/objectPossession.js';
import fs from 'fs';
import vm from 'vm';

// sceneBeatNormalizer.js transitively imports the Vite alias "@/lib", which node
// cannot resolve, so the two EXITSTATE-1 functions are extracted from the REAL
// source by anchor and executed in a vm with their module-scope dependencies
// supplied — the same technique the ROUTERHEAL-2 battery uses for the vite
// plugin. No logic is re-implemented; if the source changes, this runs the change.
const NORMALIZER_SRC = fs.readFileSync(
  new URL('../src/lib/sceneBeatNormalizer.js', import.meta.url), 'utf8'
);
const sliceSrc = (startMark, endMark) => {
  const a = NORMALIZER_SRC.indexOf(startMark);
  if (a < 0) throw new Error(`anchor not found: ${startMark}`);
  const b = NORMALIZER_SRC.indexOf(endMark, a);
  if (b < 0) throw new Error(`end anchor not found: ${endMark}`);
  return NORMALIZER_SRC.slice(a, b);
};
const EXIT_SRC = [
  sliceSrc('function parseAuditPayload(', 'export async function auditSceneFutureBoundaries'),
  sliceSrc('// EXITSTATE-1 — a scene must STOP', '// REPLAYFIX-1'),
].join('\n').replace(/^export /gm, '');

const vmCtx = {
  console,
  JSON,
  Array,
  Set,
  String,
  Error,
  FUTURE_BOUNDARY_AUDIT_ATTEMPTS: 3,
  invokeLLMWithRetry: async () => { throw new Error('default invoke must not be used in tests'); },
};
vm.createContext(vmCtx);
vm.runInContext(
  EXIT_SRC + '\nthis.auditSceneExitOvershoot = auditSceneExitOvershoot;'
  + '\nthis.buildExitOvershootRepairPrompt = buildExitOvershootRepairPrompt;',
  vmCtx
);
const { auditSceneExitOvershoot, buildExitOvershootRepairPrompt } = vmCtx;

let failures = 0;
const check = (label, ok) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label);
  if (!ok) failures += 1;
};

// ───────────────────────── OBJSEED-2 ─────────────────────────

const CAST = ['Lena Ortiz', 'Marcus Reed', 'Dr. Nolan Vale'];

// Verbatim from the live ch.4 beat contract (2026-08-04).
const CH4 = [{
  characters: CAST,
  entry_state: "Lena, Marcus, and Dr. Vale are in the corridor outside the sealed archive room. "
    + "Marcus has a severely injured left hand, cauterized and bandaged. Lena holds the broken "
    + "brass key handle. The station's power is failing, and the air is thick with humidity.",
  exit_state: "The group narrowly escapes the collapsing section and moves further into the station's depths.",
  required_events: [
    "Dr. Vale uses his cane to stabilize a falling beam, revealing his physical frailty.",
    "Lena discovers a hidden console with information about the station's true purpose.",
  ],
  props_present: ['Broken brass key handle', "Dr. Vale's cane", 'Hidden console'],
}];

const seeded = seedTrackedObjectsFromSpecStates(CH4);
const tracked = trackedObjectsFromSpecs(CH4);

check('the phantom "severely injured left" is no longer seeded',
  !seeded.some((o) => /severely injured left/i.test(o)));
check('the head noun survives: "hand" now reaches the stopword filter and kills the phrase',
  !seeded.some((o) => /injured/i.test(o)));
check('the real prop is still seeded with its full noun phrase',
  seeded.some((o) => /broken brass key handle/i.test(o)));
check('"Hidden console" (a fixture declared in props_present) is rejected',
  !tracked.some((o) => /console/i.test(o)));
check('"Dr. Vale\'s cane" survives the props_present filter (a possessive owner is not a stopword)',
  tracked.some((o) => /cane/i.test(o)));
check('the ch.4 tracked set collapses from 6 objects to 2',
  tracked.length === 2);
check('no tracked object is a body part or an injury',
  !tracked.some((o) => /\b(hand|hands|injured|stump)\b/i.test(o)));

// Regressions — every earlier object-seed fix must still hold.
const REG = [{
  characters: CAST,
  entry_state: "Lena takes the key to explore another section while holding the brass key and "
    + "Marcus and Dr. Vale wait by the door.",
  exit_state: "Marcus takes the stairs down.",
  required_events: ['Lena picks up the brass key.'],
}];
const regSeeded = seedTrackedObjectsFromSpecStates(REG);
check('SEPARATION-1c holds: "key to explore" does not survive as an object',
  !regSeeded.some((o) => /explore/i.test(o)));
check('OBJSEED-1 holds: a cast name never becomes an object',
  !regSeeded.some((o) => /marcus|lena|vale/i.test(o)));
check('OBJSEED-1 holds: "stairs down" is motion, not an object',
  !regSeeded.some((o) => /stairs/i.test(o)));
check('the real object is still found in the regression contract',
  regSeeded.some((o) => /brass key/i.test(o)));

const portability = [
  ['Broken brass key handle', true],
  ["Dr. Vale's cane", true],
  ['brass key', true],
  ['radio handset', true],
  ['Hidden console', false],
  ['the archive door', false],
  ['severely injured left hand', false],
  ['maintenance tunnel', false],
  ['', false],
];
check('isPortablePropPhrase truth table',
  portability.every(([p, want]) => isPortablePropPhrase(p) === want));

// ───────────────────────── EXITSTATE-1 ─────────────────────────

// Verbatim fragments from the live ch.5 scene 1 prose (2026-08-04) — the scene
// whose contract said "enter the maintenance tunnel" and which walked out onto
// the ice instead.
const CH5_S1_PROSE = [
  'She followed Marcus into the dark.',
  'The tunnel was tight. The air was colder here, biting at her exposed skin.',
  'Lena reached the end of the tunnel. A ladder descended into the darkness.',
  'She stepped through, her boots hitting the ice.',
  'Lena looked up. The sky was dark, filled with stars.',
  '“We have a chance,” Marcus said.',
].join('\n\n');

const CH5_S1_SPEC = {
  scene_id: 'ch05-s01',
  sceneNumber: 1,
  exit_state: 'Lena and Marcus enter the maintenance tunnel, with the corridor collapsing behind them.',
  next_entry_state: 'Lena and Marcus are in the maintenance tunnel, struggling with the tight space and Marcus’s injured hand.',
};

const stub = (payload) => {
  const fn = async () => {
    fn.calls += 1;
    return typeof payload === 'function' ? payload(fn.calls) : payload;
  };
  fn.calls = 0;
  return fn;
};

// 1. No exit state -> nothing to enforce, and the model is never asked.
{
  const s = stub('[]');
  const r = await auditSceneExitOvershoot(CH5_S1_PROSE, { exit_state: '' }, 'm', s);
  check('a spec with no exit_state returns ok without calling the model',
    r.ok === true && r.violations.length === 0 && s.calls === 0);
}

// 2. Empty prose -> ok, no call.
{
  const s = stub('[]');
  const r = await auditSceneExitOvershoot('   ', CH5_S1_SPEC, 'm', s);
  check('empty prose returns ok without calling the model', r.ok === true && s.calls === 0);
}

// 3. A scene that stops where it should.
{
  const r = await auditSceneExitOvershoot(CH5_S1_PROSE, CH5_S1_SPEC, 'm', stub('[]'));
  check('a clean scene returns ok with no violations', r.ok === true && r.violations.length === 0);
}

// 4. The real ch.5 overshoot, reported with a verbatim excerpt.
{
  const r = await auditSceneExitOvershoot(CH5_S1_PROSE, CH5_S1_SPEC, 'm', stub(JSON.stringify([
    { excerpt: 'She stepped through, her boots hitting the ice.', reason: 'leaves the tunnel entirely' },
    { excerpt: 'Lena looked up. The sky was dark, filled with stars.', reason: 'reaches the surface' },
  ])));
  check('the live ch.5 scene-1 overshoot is caught',
    r.ok === false && r.violations.length === 2);
  check('the violation carries the excerpt and the reason',
    /boots hitting the ice/.test(r.violations[0].excerpt) && /tunnel/.test(r.violations[0].reason));
}

// 5. FAIL-SAFE: an excerpt that is not in the prose is a fabricated finding.
{
  const r = await auditSceneExitOvershoot(CH5_S1_PROSE, CH5_S1_SPEC, 'm', stub(JSON.stringify([
    { excerpt: 'Lena drove the snowmobile back to base camp.', reason: 'invented by the auditor' },
  ])));
  check('a violation whose excerpt is not a verbatim span of the prose is DROPPED',
    r.ok === true && r.violations.length === 0 && r.fabricatedDropped === 1);
}

// 6. Mixed real + fabricated: the real one survives, the invented one does not.
{
  const r = await auditSceneExitOvershoot(CH5_S1_PROSE, CH5_S1_SPEC, 'm', stub(JSON.stringify([
    { excerpt: 'Lena drove the snowmobile back to base camp.', reason: 'invented' },
    { excerpt: 'She stepped through, her boots hitting the ice.', reason: 'real' },
  ])));
  check('a mixed reply keeps only the verbatim finding',
    r.ok === false && r.violations.length === 1 && r.fabricatedDropped === 1
    && /boots hitting the ice/.test(r.violations[0].excerpt));
}

// 7. Smart-quote / whitespace normalisation must not create a false drop.
{
  const r = await auditSceneExitOvershoot(CH5_S1_PROSE, CH5_S1_SPEC, 'm', stub(JSON.stringify([
    { excerpt: '"We have a chance," Marcus   said.', reason: 're-typed with straight quotes' },
  ])));
  check('an excerpt re-typed with straight quotes still matches the prose',
    r.ok === false && r.violations.length === 1 && r.fabricatedDropped === 0);
}

// 8. Duplicate reports collapse to one violation.
{
  const r = await auditSceneExitOvershoot(CH5_S1_PROSE, CH5_S1_SPEC, 'm', stub(JSON.stringify([
    { excerpt: 'She stepped through, her boots hitting the ice.', reason: 'a' },
    { excerpt: 'She stepped through, her boots hitting the ice.', reason: 'b' },
  ])));
  check('duplicate excerpts are deduped', r.violations.length === 1);
}

// 9. Reasoning wrapper + fence must not defeat the parse.
{
  const r = await auditSceneExitOvershoot(CH5_S1_PROSE, CH5_S1_SPEC, 'm', stub(
    '<think>The scene [maybe] goes too far, let me check</think>\n```json\n'
    + '[{"excerpt":"She stepped through, her boots hitting the ice.","reason":"past exit"}]\n```'
  ));
  check('a <think> block and a code fence are stripped before parsing',
    r.ok === false && r.violations.length === 1);
}

// 10. AUDITJSON-1 shape: concatenated root objects.
{
  const r = await auditSceneExitOvershoot(CH5_S1_PROSE, CH5_S1_SPEC, 'm', stub(
    '{"excerpt":"She stepped through, her boots hitting the ice.","reason":"a"}\n'
    + '{"excerpt":"Lena looked up. The sky was dark, filled with stars.","reason":"b"}'
  ));
  check('concatenated JSON objects parse into two violations', r.violations.length === 2);
}

// 11. Unusable data on every attempt -> auditFailed, never a false green.
{
  const s = stub('I am sorry, I cannot help with that.');
  const r = await auditSceneExitOvershoot(CH5_S1_PROSE, CH5_S1_SPEC, 'm', s);
  check('an unparseable reply on every attempt reports auditFailed, not ok',
    r.auditFailed === true && r.ok === false && s.calls === 3);
}

// 12. A late-recovering model still gets a verdict.
{
  const s = stub((n) => (n < 3 ? 'garbage' : '[]'));
  const r = await auditSceneExitOvershoot(CH5_S1_PROSE, CH5_S1_SPEC, 'm', s);
  check('a reply that only parses on the third attempt still returns a verdict',
    r.ok === true && !r.auditFailed && s.calls === 3);
}

// 13. The repair prompt carries the contract, the ground truth, and the excerpts.
{
  const p = buildExitOvershootRepairPrompt(CH5_S1_PROSE, CH5_S1_SPEC, [
    { excerpt: 'She stepped through, her boots hitting the ice.', reason: 'leaves the tunnel' },
  ]);
  check('the repair prompt states the exit state',
    p.includes('enter the maintenance tunnel'));
  check('the repair prompt states where the next scene opens',
    p.includes('struggling with the tight space'));
  check('the repair prompt quotes the offending excerpt',
    p.includes('boots hitting the ice'));
  check('the repair prompt forbids substituting different forward motion',
    /do not replace them with different/i.test(p) && /new location/i.test(p));
}

// 14. A last scene has no next entry state and the prompt must not invent one.
{
  const p = buildExitOvershootRepairPrompt('x', { exit_state: 'They stop at the hatch.' }, [
    { excerpt: 'x', reason: '' },
  ]);
  check('a final scene\'s repair prompt omits the next-scene line',
    p.includes('They stop at the hatch.') && !/next scene opens here/.test(p));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
