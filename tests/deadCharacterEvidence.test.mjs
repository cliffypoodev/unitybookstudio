// DEADCHARFIX-1 proof.
//
// Live failure, 2026-07-29, Ch.4 scene 3 (the run where Ch.1, Ch.2 and Ch.3 all
// drafted cleanly for the first time):
//
//   [NARRATIVE-CONNECT] Updated ledger for scene 2. Dead: 1, ...
//   [NARRATIVE-CONNECT] Scene 3 failed deterministic contract audit; repairing:
//     Dead character "Vale" performed an action in this scene.
//   [LEAK-GUARD] scene: removed 1 non-Latin drift run(s) + 1 beheaded lead-in(s) | e.g. 精密
//   NarrativeInvariantError: Scene ch04-s03 was rejected: deterministic
//     narrative-state violations survived repair.
//
// This gate is CORRECT to fire and it STAYS HARD. Dr. Vale dies in scene 2; scene 3's
// own contract says "Lena and Marcus are in the maintenance tunnel, alone." A dead man
// speaking puts something FALSE on the page, which is the one category that must never
// be downgraded to an advisory.
//
// Two things were wrong around it:
//
// 1. ONE repair attempt. Every neighbouring gate now gets three. Worse, the single
//    attempt it did get came back carrying non-Latin drift — the leak guard had to
//    scrub 精密 out of it — so the chapter's only chance was spent on output that was
//    degraded for a completely unrelated reason.
//
// 2. NO EVIDENCE. The message named the character and stopped there. From the console
//    a real violation ("Vale said the reactor would hold") and a false positive (a
//    remembered line, a body being moved) looked identical, and the repair prompt was
//    handed nothing concrete to act on.
//
// KNOWN LIMITATION, deliberately not "fixed" blind: the detector is a bare verb regex
// (`Vale said|nodded|walked|...`). It cannot tell narrative present from a flashback or
// a remembered line, so prose like `Lena could still hear the way Vale said it.` will
// trip it. That is exactly why the excerpt is now logged — the next occurrence in the
// wild will show which shape it is, and the fix can be made against evidence instead of
// a guess. Do not tighten this regex until a real false positive has been seen.
import { auditSceneAgainstLedger } from '@/lib/sceneContractGate';
import fs from 'node:fs';
import path from 'node:path';

const sceneWriter = fs.readFileSync(path.join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}

const spec = {
  scene_id: 'ch04-s03',
  required_events: ['Lena and Marcus argue about whether to use the brass key.'],
  entry_state: 'Lena and Marcus are in the maintenance tunnel, alone.',
  exit_state: 'The archive door begins to unlock.',
};
const ledger = { deadCharacters: ['Vale'], unavailableObjects: [], completedEvents: [] };
const run = (prose) => auditSceneAgainstLedger({ prose, accumulatedProse: '', spec, runtimeLedger: ledger });

// --- the gate still fails closed -------------------------------------------------

const violating = 'The tunnel was cold. Vale said the reactor would hold for another hour. Lena did not answer.';
const violated = run(violating);

check('a dead character acting is STILL a failure (integrity gate unchanged)', !violated.ok);

check('the report names the dead character',
  /Vale/.test(violated.report || ''));

// --- ...and now it shows its work ------------------------------------------------

check('the failure QUOTES the offending sentence',
  /Vale said the reactor would hold for another hour/.test(violated.report || ''));

check('the quote is a complete sentence, not a fragment',
  /: "Vale said the reactor would hold for another hour\."/.test(violated.report || ''));

check('the issue carries a machine-readable excerpt field',
  (violated.issues || []).some((i) => i.code === 'DEAD_CHARACTER_ACTION' && typeof i.excerpt === 'string' && i.excerpt.length > 0));

check('the excerpt is trimmed of surrounding whitespace and newlines',
  (() => {
    const r = run('Deep below,\n\n   Vale nodded slowly at the hatch.   \n\nLena froze.');
    const issue = (r.issues || []).find((i) => i.code === 'DEAD_CHARACTER_ACTION');
    return issue && issue.excerpt === 'Vale nodded slowly at the hatch.';
  })());

check('a long paragraph excerpt is capped rather than dumped whole',
  (() => {
    const filler = 'and the cold pressed in from every side '.repeat(20);
    const r = run(`Vale turned toward the bulkhead ${filler}.`);
    const issue = (r.issues || []).find((i) => i.code === 'DEAD_CHARACTER_ACTION');
    return issue && issue.excerpt.length <= 240 && issue.excerpt.endsWith('…');
  })());

// --- clean prose is still clean --------------------------------------------------

check('a scene with no dead-character action passes',
  run('The tunnel was cold. Lena did not answer. Marcus shifted on the stretcher.').ok);

check('merely naming the dead character is not an action',
  run("Marcus had not spoken since Vale's body went still.").ok);

check('a living character with a similar name is not caught',
  (() => {
    const r = auditSceneAgainstLedger({
      prose: 'Valerie said the reactor would hold.',
      accumulatedProse: '',
      spec,
      runtimeLedger: ledger,
    });
    return !(r.issues || []).some((i) => i.code === 'DEAD_CHARACTER_ACTION');
  })());

// --- the repair budget -----------------------------------------------------------

check('DEADCHARFIX-1: the state-contract repair is bounded at 3 passes',
  sceneWriter.includes('const STATE_CONTRACT_REPAIR_PASSES = 3'));

check('DEADCHARFIX-1: the repair now loops instead of running once',
  /for \(let contractPass = 1; contractPass <= STATE_CONTRACT_REPAIR_PASSES/.test(sceneWriter));

check('DEADCHARFIX-1: each pass reports whether it resolved the violation',
  sceneWriter.includes('[STATE-CONTRACT-REPAIR]'));

check('DEADCHARFIX-1: an empty repair pass is skipped, not counted as success',
  /produced empty prose[\s\S]{0,80}continue;/.test(sceneWriter));

check('DEADCHARFIX-1: it stops early once the violation is resolved',
  /if \(contractAudit\.ok\) break;/.test(sceneWriter));

check('INTEGRITY: the gate still throws when the budget is spent',
  sceneWriter.includes('deterministic narrative-state violations survived repair')
  && sceneWriter.includes('SCENE_STATE_CONTRACT_UNRESOLVED'));

check('INTEGRITY: the hard-block is still logged as an error',
  sceneWriter.includes('Hard-blocking state-invalid scene'));

console.log('\nDEAD CHARACTER EVIDENCE (DEADCHARFIX-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
