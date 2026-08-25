// CHARSTATE-1 (+ SCENECOLLIDE-1C, DRAFTSAVE-1) acceptance battery.
//
// The defects (ChatGPT re-score of REDUX v2, 71/100 — "narrative memory and
// state enforcement are the bottleneck"):
// 1. JB got a full departure arc in ch.9 ("He was gone.", the crew mourns) and
//    was casually present in ch.10 with no return — the generators knew JB was
//    main cast, not that his state was DEPARTED.
// 2. Nolan introduced himself twice in one chapter — introductions are PROSE
//    facts and nothing ledgered them.
// 3. "Sadie, plot a course…" / "The navigator…" in ch.11 handed Zin's
//    canonical role to Sadie — role canon was only enforced in prompts, never
//    scanned in prose.
// 4. SCENECOLLIDE beat-side lacked the REVEAL substance guard (live FP burned
//    4 planner attempts) and its exhaustion rewrite double-appended.
// 5. A failed content upload silently pointed a redrafted chapter back at its
//    pre-draft blob; the save verifier's 5% tolerance and length-only check
//    let it pass.
import fs from 'node:fs';
import {
  extractCharacterStateUpdates,
  buildCharacterState,
  buildCharacterStateContract,
  auditProseAgainstCharacterState,
} from '../src/lib/characterStateLedger.js';
import { scanRoleReferenceDrift, parseCanonCast } from '../src/lib/canonRoles.js';
import { findBeatEventCollisions, rewriteBeatCollisions } from '../src/lib/eventCollision.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const CAST = ['Zin', 'Rodge', 'JB', 'Sadie', 'Lark'];

// ── 1. departures (the real ch.9 shapes) ──
const departureProse = 'JB pressed the wrench into Rodge’s hands. “You need someone else.”\n\nThey watched JB go, a small figure against the wheat. The road took him past the silo.\n\nJB was gone. The yard felt larger and quieter than it had any right to feel.';
const u1 = extractCharacterStateUpdates(departureProse, CAST);
check('1. narrated departure is extracted ("watched JB go" / "JB was gone")', u1.departures.includes('JB'));
check('2. dialogue about leaving is NOT a departure', extractCharacterStateUpdates('“I should leave the crew,” JB said. Rodge shook his head and handed him a plate of beans.', CAST).departures.length === 0);
const u3 = extractCharacterStateUpdates('JB’s voice came back over the wind, strained and thin. The storm swallowed the rest.', CAST);
check('3. a possessive is not a return ("JB’s voice came back")', u3.returns.length === 0);
check('4. a real return is extracted ("JB came back at dawn")', extractCharacterStateUpdates('JB came back at dawn, hat in hand, and nobody said a word about the wrench.', CAST).returns.includes('JB'));

// ── 2. state folding + contract ──
const state = buildCharacterState([
  { chapterNumber: 8, text: 'Ordinary chapter. '.repeat(20) + 'Zin worked the console beside JB and the crew ate in silence under the tarp that night.' },
  { chapterNumber: 9, text: 'Long chapter text here. '.repeat(15) + departureProse },
], CAST);
check('5. state machine folds chapters in order (JB departed ch.9)', state.JB.partyStatus === 'departed' && state.JB.statusChapter === 9);
const contract = buildCharacterStateContract(state);
check('6. contract states the departure as a hard fact', contract.includes('JB DEPARTED the crew in chapter 9') && contract.includes('may NOT appear'));
check('7. a book with nothing to enforce gets an EMPTY contract (no noise)', buildCharacterStateContract(buildCharacterState([{ chapterNumber: 1, text: 'Zin fixed the engine quietly. '.repeat(20) }], CAST)) === '');

// ── 3. audits (the real ch.10 resurrection shape) ──
const ch10ish = 'The store smelled of feed and coffee. JB fidgeted near the counter, his eyes darting toward the exit. Thompson rang up the order without a word.';
const v1 = auditProseAgainstCharacterState(ch10ish, state, CAST);
check('8. a departed character acting with no return is a violation', v1.length === 1 && v1[0].code === 'DEPARTED_CHARACTER_ACTIVE' && v1[0].name === 'JB');
const withReturn = 'JB came back that morning, dusty and quiet. Nobody asked. JB fidgeted near the counter, his eyes darting toward the exit.';
check('9. a written return legalizes later appearances in the same prose', auditProseAgainstCharacterState(withReturn, state, CAST).length === 0);
check('10. talking ABOUT the departed character is legal', auditProseAgainstCharacterState('“JB would have loved this,” Zin said. The words hung there. Rodge gripped the wrench that was not his.', state, CAST).length === 0);

// ── 4. introductions ──
const intro1 = '“I am Nolan. Nolan Brandt.” He tipped the hat like the name itself was currency out here.';
const uIntro = extractCharacterStateUpdates(intro1, CAST);
check('11. a named self-introduction is extracted from prose', uIntro.introductions.includes('Nolan'));
check('12. "I’m sorry / I am sure" are not introductions', extractCharacterStateUpdates('“I’m Sorry about the barn,” he said. “I am Sure it will pass.”', CAST).introductions.length === 0);
const stateIntro = buildCharacterState([{ chapterNumber: 3, text: 'Filler text for length. '.repeat(15) + intro1 }], [...CAST, 'Nolan']);
const v2 = auditProseAgainstCharacterState('The duster-wearing man stepped from the shade. “I am Nolan. Nolan Brandt,” he said, as if for the first time.', stateIntro, [...CAST, 'Nolan']);
check('13. a SECOND self-introduction is a violation', v2.some((x) => x.code === 'DUPLICATE_INTRODUCTION' && x.name === 'Nolan'));

// ── 5. role-reference drift (the real ch.11 shape) ──
const SHEET = `### Major Characters\n\n**1. Protagonist: Zinnia 'Zin' Quark**\n\n- **Role:** Navigator and heart of the crew.\n\n**2. Antagonist: Roderick 'Rodge' Krye**\n\n- **Role:** The gruff, no-nonsense leader of the crew.`;
const canon = parseCanonCast(SHEET);
const drift = scanRoleReferenceDrift('“Course plotted,” Sadie chirped. The navigator was perched on the console, her legs swinging.', canon, ['Zinnia', 'Zin', 'Sadie', 'Rodge']);
check('14. narration handing a unique role to the wrong character is drift', drift.length === 1 && drift[0].role === 'navigator' && drift[0].referredTo === 'Sadie' && drift[0].holder === 'Zinnia');
check('15. the canon holder referred to by their own role is clean', scanRoleReferenceDrift('Zin leaned over the charts. The navigator traced the ridge line with one finger.', canon, ['Zinnia', 'Zin', 'Sadie']).length === 0);
check('16. two-name sentences are unattributable and skipped', scanRoleReferenceDrift('Sadie and Zin argued over the map. The navigator won, as always.', canon, ['Zinnia', 'Zin', 'Sadie']).length === 0);

// ── 6. SCENECOLLIDE-1C ──
const REVEAL_EVENT = 'Rodge reveals his hidden fears about losing the crew, leading to a heartfelt conversation with Zin.';
const legitBeat = [{ scene_number: 2, scene_goal: "Reveal the rival team's knowledge of the crew's true identities.", required_events: ["The rival leader reveals knowledge of the crew's true identities."] }];
check('17. beat-side REVEAL requires shared substance (the live planner FP is dead)', findBeatEventCollisions(legitBeat, [REVEAL_EVENT]).length === 0);
const realCollision = [{ scene_number: 1, scene_goal: 'Rodge reveals his hidden fears about losing the crew to Zin again.', required_events: ['Rodge reveals his fears about losing the crew.'] }];
const stillCaught = findBeatEventCollisions(realCollision, [REVEAL_EVENT]);
check('18. a genuine beat-level replay is still caught', stillCaught.length >= 1);
const once = rewriteBeatCollisions(realCollision, stillCaught);
const twice = rewriteBeatCollisions(once, stillCaught);
check('19. exhaustion rewrite is idempotent (no double-append)', JSON.stringify(once) === JSON.stringify(twice) && (once[0].scene_goal.match(/do NOT re-stage it/g) || []).length === 1);

// ── 7. DRAFTSAVE-1 (source-level; behavior proven in sandbox runs) ──
const VSAVE = fs.readFileSync(new URL('../src/lib/verifiedChapterSave.js', import.meta.url), 'utf8');
check('20. save verify tolerance tightened to 2% with head/tail content anchors', VSAVE.includes('TOLERANCE = 0.02') && VSAVE.includes('contentAnchorsMatch(writtenContent, verifyContent)'));
check('21. retries re-prepare content (fresh upload), not the same stale payload', VSAVE.includes('re-prepared content fields') && VSAVE.includes('prepareChapterContent(writtenContent'));
const CSTORE = fs.readFileSync(new URL('../src/lib/chapterStorage.js', import.meta.url), 'utf8');
check('22. every upload failure retries (3 attempts), and the preserve path SCREAMS', CSTORE.includes('attempt <= 3') && CSTORE.includes('[DRAFTSAVE-1] Upload failed after retries'));
const STUDIO = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');
check('23. straight-quote drafts are typography-normalized before save', STUDIO.includes('[DRAFTSAVE-1]') && STUDIO.includes('normalizeSmartQuotesOnly(chapterContent)'));

// ── 8. wiring ──
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('24. writer builds the state machine per chapter and injects the contract', WRITER.includes('buildCharacterState(statePriorChapters, characterStateCast)') && WRITER.includes('character_state: characterStateContract'));
const GATE_SRC = fs.readFileSync(new URL('../src/lib/sceneContractGate.js', import.meta.url), 'utf8');
check('25. scene audit enforces the state machine (with in-chapter fold)', /auditProseAgainstCharacterState\(prose, effectiveState, stateCast[,)]/.test(GATE_SRC) && GATE_SRC.includes('extractCharacterStateUpdates(accumulatedProse')); // CHARSTATE-2: audit call gained a declaredReturns options arg
check('26. beat planner carries the state contract', STUDIO.includes('[CHARSTATE] Planner contract'));
const EXPORT_GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
// 27. RETIRED by GATEPROMOTE-1-CONTINUITY-BREAKS-BLOCK-EXPORT: resurrections
// (DEPARTED_CHARACTER_ACTIVE) and duplicate cross-chapter self-introductions
// (DUPLICATE_INTRODUCTION) are now hard blocks in fiction; only role drift
// stays a warning-only advisory. The full behavior is proven live in
// test/gatepromote1.acceptance.mjs; this source-shape check confirms the
// wiring still matches that contract.
check('27. GATEPROMOTE-1: resurrections/dup-intro are hard blocks in fiction, role drift stays a WARNING',
  EXPORT_GATE.includes('CHARSTATE-1:') &&
  EXPORT_GATE.includes('scanRoleReferenceDrift(ch.text') &&
  EXPORT_GATE.includes("isFictionProject(project) && (violation.code === 'DEPARTED_CHARACTER_ACTIVE' || violation.code === 'DUPLICATE_INTRODUCTION')") &&
  !/scanRoleReferenceDrift\(ch\.text[\s\S]{0,400}hardFailures\.push/.test(EXPORT_GATE));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
