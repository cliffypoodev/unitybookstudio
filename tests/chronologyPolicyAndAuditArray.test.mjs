// AUDITARRAY-1 + CHRONOFIX-3 + CHRONOPOLICY-1 proof.
//
// Three live failures from the 2026-07-29 five-chapter run, all reproduced in a
// sandbox from the user's own beat contracts BEFORE any fix was written.
//
// ---------------------------------------------------------------------------
// 1. AUDITARRAY-1 — the audit reply was a bare object, not an array.
//
// AUDITPROMPT-1 made the reply printable, and Chapter 3 scene 1 immediately
// showed what eight hours of "malformed JSON" actually was:
//
//   [auditSceneFutureBoundaries] attempt 1 raw reply: type=string length=175
//     first400="{\n \"id\": 0,\n \"excerpt\": \"The ice cracked beneath their
//     feet. Chunks of it broke off, falling into the darkness. ...\"\n}"
//
// The prompt asks for "a JSON array of violations". When the model finds exactly
// ONE violation it answers with the bare object. The parser required a bracket
// pair, found none, and burned the attempt. Attempt 2 happened to answer [] — so
// the retry did not fix anything, it MASKED a reported violation.
//
// ---------------------------------------------------------------------------
// 2. CHRONOFIX-3 — a code is knowledge, not an acquirable object.
//
// Chapter 2 died on:
//   Chronology Error: Acquire object must precede use object.
// Offending beat: "Marcus unlocks the cabinet with a code, revealing a report
// implicating Dr. Vale." -> unlock_or_access{actor:marcus, object:'code'}. The
// validator then demanded Marcus first ACQUIRE "code". Sandbox replay of the
// live beats returned `repairs: []` — the repair pass had no move that helps,
// and the re-validate threw the identical error. No rewrite could ever satisfy
// it. That is an unsatisfiable complaint, not a bad beat plan.
//
// ---------------------------------------------------------------------------
// 3. CHRONOPOLICY-1 — beat ORDER is a quality constraint, not an integrity one.
//
// Chapter 5 died on:
//   Chronology Error: Object must be used for access before it is destroyed.
// Offending beat: "Lena destroys the brass key", one scene after "Lena retrieves
// the brass key from Marcus". The key had already opened doors back in Chapter 2
// — but validateRawBeatChronology only ever sees ONE chapter of beats, so the
// access it wants is invisible to it. Sandbox replay: `repairs: []` again.
//
// The rule itself is NOT weakened here (regression test 41, which asserts that
// possession alone must not license destruction, still passes untouched). What
// changes is what happens when a complaint survives repair: the drafting path
// now reports it and continues instead of throwing away the chapter. A
// mis-ordered beat produces a weaker chapter; it cannot invent a fact. Quote
// binding, dead-character and closed-world gates still fail closed.
import { auditSceneFutureBoundaries, parseAuditPayload, validateRawBeatChronology } from '@/lib/sceneBeatNormalizer';
import { applyChronologyPolicy } from '@/lib/sceneWriter';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}
function checkThrows(name, fn, re) {
  try { fn(); console.log('FAIL ' + name + ' (did not throw)'); fail += 1; }
  catch (e) {
    if (re.test(e.message)) { console.log('PASS ' + name); pass += 1; }
    else { console.log('FAIL ' + name + ' (wrong error: ' + e.message + ')'); fail += 1; }
  }
}

const silence = () => {
  const l = console.log, w = console.warn, e = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  return () => { console.log = l; console.warn = w; console.error = e; };
};

// ---------------------------------------------------------------------------
// AUDITARRAY-1
// ---------------------------------------------------------------------------

// Verbatim from the user's browser console, Chapter 3 scene 1.
const LIVE_BARE_OBJECT =
  '{\n "id": 0,\n "excerpt": "The ice cracked beneath their feet. Chunks of it broke off, ' +
  'falling into the darkness. The sound was deafening. A roar of collapsing stone and ice."\n}';

check('the live bare-object reply parses to a one-element array',
  (() => { const r = parseAuditPayload(LIVE_BARE_OBJECT); return Array.isArray(r) && r.length === 1 && r[0].id === 0; })());

check('the live reply keeps its excerpt intact',
  parseAuditPayload(LIVE_BARE_OBJECT)[0].excerpt.startsWith('The ice cracked beneath their feet'));

check('an empty array is still an empty array (the clean-scene answer)',
  (() => { const r = parseAuditPayload('[]'); return Array.isArray(r) && r.length === 0; })());

check('a normal violation array still parses',
  parseAuditPayload('[{"id":1,"excerpt":"x"}]').length === 1);

check('a two-element array still parses',
  parseAuditPayload('[{"id":0,"excerpt":"a"},{"id":1,"excerpt":"b"}]').length === 2);

check('a {"violations":[...]} wrapper is unwrapped',
  parseAuditPayload('{"violations":[{"id":2,"excerpt":"y"}]}')[0].id === 2);

check('an empty violations wrapper yields an empty array',
  parseAuditPayload('{"violations":[]}').length === 0);

// NOTE: the fence marker is built at runtime rather than typed literally. This
// file is shipped inside a fenced markdown code block, and a literal triple
// backtick here would terminate that block early and truncate the test file.
const FENCE = '`'.repeat(3);
check('a fenced bare object parses',
  parseAuditPayload(FENCE + 'json\n{"id":0,"excerpt":"z"}\n' + FENCE)[0].excerpt === 'z');

check('an excerpt containing brackets survives',
  parseAuditPayload('{"id":0,"excerpt":"he said [redacted] loudly"}')[0].excerpt.includes('[redacted]'));

check('an array wins over a trailing stray object',
  parseAuditPayload('[{"id":0,"excerpt":"a"}] {"id":9,"excerpt":"b"}')[0].id === 0);

check('an object is recovered when the array text is malformed',
  (() => { const r = parseAuditPayload('[oops {"id":3,"excerpt":"c"}'); return r && r[0].id === 3; })());

// Fail-closed must survive: anything not violation-shaped still returns null.
check('continuous prose returns null (still fails closed)', parseAuditPayload('The scene does not perform any reserved events.') === null);
check('an empty string returns null', parseAuditPayload('') === null);
check('null returns null', parseAuditPayload(null) === null);
check('undefined returns null', parseAuditPayload(undefined) === null);
check('an unrelated JSON object returns null', parseAuditPayload('{"status":"ok"}') === null);
check('a bare JSON string returns null', parseAuditPayload('"no violations"') === null);

{
  const spec = { future_reserved_event_objects: [{ event: 'Lena destroys the key', sceneId: 'ch05-s02', sceneNumber: 2 }] };
  const restore = silence();
  const reported = await auditSceneFutureBoundaries('some prose here', spec, 'm', async () => LIVE_BARE_OBJECT);
  const proseOnly = await auditSceneFutureBoundaries('some prose here', spec, 'm', async () => 'No violations were found.');
  const clean = await auditSceneFutureBoundaries('some prose here', spec, 'm', async () => '[]');
  restore();

  check('the live reply now REPORTS a violation instead of killing the chapter',
    reported.auditFailed !== true && reported.violations.length === 1);
  check('the reported violation carries its future event',
    reported.violations[0].event === 'Lena destroys the key');
  check('a prose-only reply STILL fails closed',
    proseOnly.ok === false && proseOnly.auditFailed === true);
  check('a clean [] reply still passes with no violations',
    clean.ok === true && clean.violations.length === 0);
}

// ---------------------------------------------------------------------------
// CHRONOFIX-3 + CHRONOPOLICY-1 — the user's live Chapter 2 and Chapter 5 beats
// ---------------------------------------------------------------------------

const LIVE_CH2 = [
  {
    scene_id: 'ch02-s01',
    required_events: [
      'Lena encounters a locked door with a keyhole matching the brass key.',
      'She uses the key, triggering a security alert.',
    ],
    entry_state: 'Lena is in a dimly lit corridor, separated from Marcus and Dr. Vale. She holds the hot brass key with coordinates, determined to find answers.',
    exit_state: 'Lena is trapped in a hidden archive room, discovering files implicating someone else in the accident.',
  },
  {
    scene_id: 'ch02-s02',
    required_events: [
      'Marcus unlocks the cabinet with a code, revealing a report implicating Dr. Vale.',
      'Marcus struggles with the decision to confront Lena or keep the secret.',
    ],
    entry_state: 'Marcus is alone in a sealed section, nervous and avoiding certain topics. He finds a hidden file cabinet.',
    exit_state: "Marcus decides to find Lena, fearing she'll discover the truth.",
  },
  {
    scene_id: 'ch02-s03',
    required_events: [
      'Lena questions Marcus about the report, sensing his nervousness.',
      'Marcus attempts to divert Lena, fearing the truth will emerge.',
    ],
    entry_state: 'Lena is in the archive room, discovering files implicating Dr. Vale. Marcus finds her, hiding the report.',
    exit_state: 'Lena becomes more suspicious, determined to uncover the full truth despite Marcus’s evasiveness.',
  },
];

const LIVE_CH5 = [
  {
    scene_id: 'ch05-s01',
    required_events: [
      "Lena discovers the truth about Marcus's role in her father's death through the journal.",
      'Lena confronts Marcus about his actions.',
      'Lena retrieves the brass key from Marcus.',
    ],
    entry_state: 'Lena is in the reactor chamber, holding the brass key and the journal from Dr. Vale. Marcus is injured and missing his left hand.',
    exit_state: "Lena has the brass key and the journal, and Marcus is struggling to understand Lena's resolve.",
  },
  {
    scene_id: 'ch05-s02',
    required_events: [
      'Lena destroys the brass key.',
      'Lena confronts Marcus about his guilt and refusal to accept responsibility.',
      'Marcus pleads for redemption, but Lena refuses to forgive him.',
    ],
    entry_state: 'Lena has the brass key and the journal, and Marcus is injured and missing his left hand.',
    exit_state: 'Lena has destroyed the brass key, and Marcus is left to face the consequences of his actions.',
  },
  {
    scene_id: 'ch05-s03',
    required_events: [
      'Lena and Marcus escape separately onto the ice.',
      'Lena refuses to forgive Marcus, leaving him to face the consequences of his actions alone.',
    ],
    entry_state: 'Lena has destroyed the brass key, and Marcus is injured and missing his left hand.',
    exit_state: 'Lena and Marcus are on the ice, with Lena refusing to forgive Marcus.',
  },
];

// CHRONOFIX-3: the Chapter 2 complaint is gone at the validator itself, because
// it was never a real ordering problem — a code is not a thing you pick up.
check('CHRONOFIX-3: the live Ch.2 contract now passes the validator outright',
  (() => { try { validateRawBeatChronology(LIVE_CH2); return true; } catch (e) { return false; } })());

check('CHRONOFIX-3: unlocking with a password needs no prior acquisition',
  (() => {
    try {
      validateRawBeatChronology([{ entry_state: '', required_events: ['Marcus unlocks the terminal with a password.'] }]);
      return true;
    } catch (e) { return false; }
  })());

// ...but a real physical object is still governed.
checkThrows('CHRONOFIX-3: unlocking with a PHYSICAL object still requires acquiring it first',
  () => validateRawBeatChronology([{ entry_state: '', required_events: ['Marcus unlocks the cabinet with a crowbar.'] }]),
  /Acquire object must precede use object/);

// CHRONOPOLICY-1: Chapter 5's complaint is genuinely unsatisfiable in-chapter,
// so the RULE still fires — the POLICY is what lets the book finish.
checkThrows('CHRONOPOLICY-1: the Ch.5 rule still fires (the rule is not weakened)',
  () => validateRawBeatChronology(LIVE_CH5),
  /Object must be used for access before it is destroyed/);

check('CHRONOPOLICY-1: possession alone still does not license destruction (regression test 41 intact)',
  (() => {
    try {
      validateRawBeatChronology([
        { entry_state: 'Lena has the brass key.', required_events: ['They discover a hidden archive door.'] },
        { required_events: ['Lena destroys the brass key.'] },
      ]);
      return false;
    } catch (e) { return /used for access before it is destroyed/.test(e.message); }
  })());

{
  const restore = silence();
  let ch2Out = null; let ch5Out = null; let threw = null;
  try {
    ch2Out = applyChronologyPolicy(LIVE_CH2);
    ch5Out = applyChronologyPolicy(LIVE_CH5);
  } catch (e) { threw = e; }
  restore();

  check('CHRONOPOLICY-1: the live Ch.2 contract no longer throws in the drafting path', threw === null && ch2Out !== null);
  check('CHRONOPOLICY-1: the live Ch.5 contract no longer throws in the drafting path', threw === null && ch5Out !== null);
  check('CHRONOPOLICY-1: Ch.2 keeps all three scenes', ch2Out && ch2Out.length === 3);
  check('CHRONOPOLICY-1: Ch.5 keeps all three scenes', ch5Out && ch5Out.length === 3);
  check('CHRONOPOLICY-1: Ch.5 keeps its climax beat (destroying the key)',
    JSON.stringify(ch5Out).includes('destroys the brass key'));
}

{
  const restore = silence();
  const clean = [{ required_events: ['Lena finds a note.'], entry_state: '', exit_state: '' }];
  const out = applyChronologyPolicy(clean);
  restore();
  check('CHRONOPOLICY-1: a clean contract passes through byte-identical', out === clean);
}

{
  // A complaint the repair CAN fix must still be repaired, not merely warned about.
  const restore = silence();
  const repairable = [
    { entry_state: 'Lena has the brass key.', required_events: ['Lena confronts Marcus about the logs.'] },
    { required_events: ['Lena discovers the logs implicating Marcus.'] },
  ];
  const out = applyChronologyPolicy(repairable);
  restore();
  check('CHRONOPOLICY-1: a repairable complaint is still REPAIRED, not just reported',
    (() => { try { validateRawBeatChronology(out); return true; } catch (e) { return false; } })());
}

{
  const restore = silence();
  let msg = null;
  try { applyChronologyPolicy(null); } catch (e) { msg = e.message; }
  restore();
  check('CHRONOPOLICY-1: a non-chronology error (TypeError) is NOT swallowed',
    msg !== null && !/Chronology/.test(msg));
}

{
  // The advisory must be loud enough to find in a console dump.
  const warnings = [];
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = (...a) => warnings.push(a.join(' '));
  applyChronologyPolicy(LIVE_CH5);
  console.log = l; console.warn = w;
  check('CHRONOPOLICY-1: an unenforced complaint logs [CHRONOLOGY-ADVISORY] with its reason',
    warnings.some((x) => x.includes('[CHRONOLOGY-ADVISORY]') && x.includes('used for access before it is destroyed')));
  check('CHRONOPOLICY-1: the advisory says drafting continued',
    warnings.some((x) => x.includes('Drafting continues')));
}

console.log('\nCHRONOLOGY POLICY + AUDIT ARRAY (AUDITARRAY-1 / CHRONOFIX-3 / CHRONOPOLICY-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
