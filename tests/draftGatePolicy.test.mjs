// BOUNDARYPOLICY-2 / REPLAYPOLICY-1 / DIALOGUEPOLICY-1 proof.
//
// These three gates live inside generateChapterSceneByScene and draftChapter, which
// cannot be driven without standing up the whole app. So these are POLICY-SHAPE
// tests read from source: they assert that the three hard throws are gone, that the
// advisories replaced them, and — just as important — that the gates which SHOULD
// still kill a chapter were left alone. They will fail loudly if anyone reinstates a
// hard throw on a quality gate, or softens an integrity gate.
//
// Live evidence, 2026-07-29, fresh book, chapters 1-5:
//
//   Ch.1  drafted, 3,652 words.
//   Ch.2  drafted, 4,055 words.   <- first time Ch.2 has ever completed
//   Ch.3  FOUR consecutive failures, three different gates:
//
//     attempt 1  [SCENE-BOUNDARY-REPAIR] pass 1 made no progress (1 -> 1); stopping.
//                NarrativeInvariantError: Scene ch03-s01 was rejected: future
//                boundary violations survived repair.
//
//     attempt 2  [DIALOGUE-MECHANICS-REPAIR] After repair: 0 remaining issue(s),
//                15 repaired ... 2 ambiguous orphan closer(s) left for review
//                NarrativeInvariantError: Chapter 3 rejected due to unresolved
//                malformed dialogue (orphans: 2, manual review: 0).
//                -> a finished 4,141-word chapter destroyed by two quote marks.
//
//     attempt 3  [SCENE-BOUNDARY-REPAIR-RESULT] pass=1/3 remainingCount=0
//                -> the SAME scene 1 that failed in attempt 1 repaired cleanly here.
//                Then: Scene ch03-s02 was rejected: semantic replay survived repair.
//
// Attempt 3 is the whole argument. Boundary repair is a stochastic regeneration; one
// unlucky pass is a dice roll, not proof the complaint is unsatisfiable. The old code
// aborted on that single roll, and the replay gate never got a second roll at all.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sceneWriter = fs.readFileSync(path.join(root, 'src/lib/sceneWriter.js'), 'utf8');
// ORCH-1 moved draftChapter's body — including the DIALOGUEPOLICY-1 fallback
// path checked below — out of ProjectStudio.jsx into chapterOrchestrator.js.
const projectStudio = fs.readFileSync(path.join(root, 'src/lib/chapterOrchestrator.js'), 'utf8');
const sceneContractGate = fs.readFileSync(path.join(root, 'src/lib/sceneContractGate.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}

// ---------------------------------------------------------------------------
// BOUNDARYPOLICY-2 — future-boundary violations report instead of killing
// ---------------------------------------------------------------------------

check('BOUNDARYPOLICY-2: the "future boundary violations survived repair" throw is gone',
  !sceneWriter.includes('was rejected: future boundary violations survived repair'));

check('BOUNDARYPOLICY-2: FUTURE_EVENT_PERFORMED_EARLY is no longer thrown',
  !sceneWriter.includes('FUTURE_EVENT_PERFORMED_EARLY'));

check('BOUNDARYPOLICY-2: an unenforced violation logs [FUTURE-BOUNDARY-ADVISORY]',
  sceneWriter.includes('[FUTURE-BOUNDARY-ADVISORY]'));

check('BOUNDARYPOLICY-2: the advisory names the surviving events',
  /FUTURE-BOUNDARY-ADVISORY[\s\S]{0,400}Survivors: \$\{survivors\}/.test(sceneWriter));

check('BOUNDARYPOLICY-2: the advisory states drafting continued',
  /FUTURE-BOUNDARY-ADVISORY[\s\S]{0,400}Drafting continues/.test(sceneWriter));

check('BOUNDARYPOLICY-2: the stall-abort that killed live attempt 1 is removed',
  !sceneWriter.includes('made no progress') || !/made no progress[\s\S]{0,200}break;/.test(sceneWriter));

check('BOUNDARYPOLICY-2: the repair still runs a BOUNDED number of passes',
  sceneWriter.includes('const FUTURE_BOUNDARY_REPAIR_PASSES = 3'));

check('BOUNDARYPOLICY-2: the loop keeps the fewest-violation attempt',
  sceneWriter.includes('bestCount') && /passAudit\.violations\.length < bestCount/.test(sceneWriter));

check('BOUNDARYPOLICY-2: a partially repaired scene is adopted, not discarded',
  /bestCount < originalViolationCount[\s\S]{0,200}sceneProse = bestProse/.test(sceneWriter));

check('BOUNDARYPOLICY-2: a clean repair is still preferred over a partial one',
  /if \(bestAudit\.ok && bestProse\)[\s\S]{0,120}sceneProse = bestProse/.test(sceneWriter));

// ---------------------------------------------------------------------------
// REPLAYPOLICY-1 — semantic replay gets the same budget, then reports
// ---------------------------------------------------------------------------

check('REPLAYPOLICY-1: the "semantic replay survived repair" throw is gone',
  !sceneWriter.includes('was rejected: semantic replay survived repair'));

check('REPLAYPOLICY-1: an unenforced replay logs [SCENE-REPLAY-ADVISORY]',
  sceneWriter.includes('[SCENE-REPLAY-ADVISORY]'));

check('REPLAYPOLICY-1: replay repair now loops instead of running once',
  /for \(let replayPass = 1; replayPass <= FUTURE_BOUNDARY_REPAIR_PASSES/.test(sceneWriter));

check('REPLAYPOLICY-1: each replay pass reports its remaining count',
  sceneWriter.includes('[SCENE-REPLAY-REPAIR-RESULT]'));

check('REPLAYPOLICY-1: the loop keeps the fewest-replay attempt',
  /postRepairAudit\.replays\.length < bestReplayCount/.test(sceneWriter));

check('REPLAYPOLICY-1: it stops early once a pass is clean',
  /if \(postRepairAudit\.ok\) break;/.test(sceneWriter));

check('REPLAYPOLICY-1: the replay diagnostic capture is still wired',
  sceneWriter.includes('captureReplayDiagnostic'));

// ---------------------------------------------------------------------------
// DIALOGUEPOLICY-1 — two stray quote marks no longer destroy a chapter
// ---------------------------------------------------------------------------

// There are TWO of these gates — the structured-scene path and the non-structured
// fallback path. The live Ch.3 failure hit the first; the second is identical and
// would have hit on any chapter that took the fallback route. Both must be soft.
check('DIALOGUEPOLICY-1: BOTH malformed-dialogue chapter rejections are gone',
  !projectStudio.includes('rejected due to unresolved malformed dialogue'));

check('DIALOGUEPOLICY-1: both call sites now advise (two [DIALOGUE-ADVISORY] logs)',
  (projectStudio.match(/\[DIALOGUE-ADVISORY\]/g) || []).length === 2);

// The code string still appears once in the catch-side classifier that decides
// whether to skip the emergency save. That is a read, not a throw — harmless, and
// left in place deliberately in case another path ever raises it. What must be gone
// is the ASSIGNMENT that tags a thrown error with it.
check('DIALOGUEPOLICY-1: no error is tagged MALFORMED_DIALOGUE_UNRESOLVED any more',
  !/error\.code = 'MALFORMED_DIALOGUE_UNRESOLVED'/.test(projectStudio));

check('DIALOGUEPOLICY-1: the surviving mention is only the catch-side classifier',
  (projectStudio.match(/MALFORMED_DIALOGUE_UNRESOLVED/g) || []).length === 1
  && /code === 'MALFORMED_DIALOGUE_UNRESOLVED'/.test(projectStudio));

check('DIALOGUEPOLICY-1: unresolved quotes log [DIALOGUE-ADVISORY] instead',
  projectStudio.includes('[DIALOGUE-ADVISORY]'));

check('DIALOGUEPOLICY-1: the advisory still reports the orphan count',
  /DIALOGUE-ADVISORY[\s\S]{0,300}orphans: \$\{finalDmOrphans\}/.test(projectStudio));

check('DIALOGUEPOLICY-1: the advisory tells the writer to proofread',
  /DIALOGUE-ADVISORY[\s\S]{0,400}proofread/i.test(projectStudio));

check('DIALOGUEPOLICY-1: the repairer itself is untouched and still runs',
  projectStudio.includes('runDialogueMechanicsFinal'));

check('DIALOGUEPOLICY-1: the orphan counters are still tallied',
  projectStudio.includes('finalDmOrphans +=') && projectStudio.includes('finalDmManualReview +='));

// ---------------------------------------------------------------------------
// The gates that MUST still fail closed. If any of these flips, integrity is gone.
// ---------------------------------------------------------------------------

// The dead-character gate lives in sceneContractGate.js, not sceneWriter.js.
check('INTEGRITY: a dead character acting is still a HARD contract failure',
  sceneContractGate.includes('Dead character')
  && sceneContractGate.includes('hard_dead_character_acts'));

check('INTEGRITY: losing a scene in the pipeline is still a hard failure',
  sceneWriter.includes('SCENE_LOST_IN_PIPELINE'));

check('INTEGRITY: a duplicate/restarted scene is still a hard failure',
  sceneWriter.includes('duplicate/restart survived its repair pass'));

check('INTEGRITY: an audit that cannot execute still fails closed',
  sceneWriter.includes('SCENE_BOUNDARY_AUDIT_FAILED')
  && sceneWriter.includes('future boundary audit failed to execute or returned malformed JSON'));

check('INTEGRITY: the chronology advisory from CHRONOPOLICY-1 is still in place',
  sceneWriter.includes('[CHRONOLOGY-ADVISORY]'));

check('INTEGRITY: NarrativeInvariantError is still thrown somewhere in the drafting path',
  (sceneWriter.match(/NarrativeInvariantError/g) || []).length >= 3);

console.log('\nDRAFT GATE POLICY (BOUNDARYPOLICY-2 / REPLAYPOLICY-1 / DIALOGUEPOLICY-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
