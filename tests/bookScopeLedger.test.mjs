// LEDGERSCOPE-1 proof.
//
// The manuscript audit of brassmeridiantest 4.docx found ten continuity defects and
// every single one crossed a scene or chapter boundary. Verified root cause, live at
// d210597 and unchanged at bb3e1d6: inside generateChapterSceneByScene,
//
//     let accumulatedProse = '';              // sceneWriter.js:2967
//     let runtimeLedger = buildInitialLedger(); // sceneWriter.js:2972
//
// Both reset at the top of every chapter, AND the ledger was never returned - the
// function's return object carried text/prose/scenes/repairReports and no ledger of
// any kind. So the state was not merely chapter-scoped, it was unrecoverable.
//
// What that produced on the page:
//   * Marcus's wrist breaks (Ch.3) and is a "stump" one scene later with no
//     amputation ever written; in Ch.4 he has "the raw skin of his left hand" again.
//   * The brass key is in Lena's pocket on the last line of Ch.4 and in Marcus's
//     hand on the first line of Ch.5.
//   * The station is destroyed three separate times (Ch.2, Ch.4, Ch.5).
//
// NOTE ON SCOPE: `accumulatedProse` is deliberately NOT lifted to book scope.
// Line 2967 carries a DRAFTFIX-1 comment - seeding it from saved content made every
// redraft append onto the prior draft (stacked-drafts bug, proven 2026-07-06). The
// ledger carries facts, not prose, so only the ledger travels. characterConditions
// already exists, extractLimbFacts already populates it, and serializeLedger already
// emits a CHARACTER CONDITIONS block into the scene prompt - persisting the ledger
// alone is what fixes the hand, with no prose seeding at all.
import {
  buildInitialLedger,
  cloneLedger,
  mergeLedgers,
  foldChapterLedgers,
  boundLedger,
  summarizeLedger,
  serializeLedger,
  LEDGER_MAX_COMPLETED_EVENTS,
} from '@/lib/narrativeLedger';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sceneWriter = fs.readFileSync(path.join(root, 'src/lib/sceneWriter.js'), 'utf8');
const cohesion = fs.readFileSync(path.join(root, 'src/lib/chapterCohesion.js'), 'utf8');
const projectStudio = fs.readFileSync(path.join(root, 'src/pages/ProjectStudio.jsx'), 'utf8');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}

// ─── the exported surface ────────────────────────────────────────────────────────

check('LEDGERSCOPE-1: cloneLedger / mergeLedgers / foldChapterLedgers / boundLedger exported',
  [cloneLedger, mergeLedgers, foldChapterLedgers, boundLedger, summarizeLedger].every((f) => typeof f === 'function'));

check('LEDGERSCOPE-1: cloneLedger of nothing is a valid empty ledger',
  JSON.stringify(cloneLedger(null)) === JSON.stringify(buildInitialLedger()));

check('LEDGERSCOPE-1: cloneLedger is a DEEP copy (mutating the copy cannot corrupt the source)',
  (() => {
    const src = buildInitialLedger();
    src.deadCharacters.push('Vale');
    src.characterConditions.Marcus = ['left amputated/severed'];
    const copy = cloneLedger(src);
    copy.deadCharacters.push('Lena');
    copy.characterConditions.Marcus.push('right broken');
    return src.deadCharacters.length === 1 && src.characterConditions.Marcus.length === 1;
  })());

check('LEDGERSCOPE-1: mergeLedgers mutates neither argument',
  (() => {
    const a = buildInitialLedger(); a.deadCharacters.push('Vale');
    const b = buildInitialLedger(); b.deadCharacters.push('Aris');
    const before = [JSON.stringify(a), JSON.stringify(b)];
    mergeLedgers(a, b);
    return before[0] === JSON.stringify(a) && before[1] === JSON.stringify(b);
  })());

// ─── IRREVERSIBLE facts must union and never drop ────────────────────────────

check('IRREVERSIBLE: a character dead in Ch.4 is still dead in Ch.5',
  (() => {
    const ch4 = buildInitialLedger(); ch4.deadCharacters.push('Vale');
    const ch5 = buildInitialLedger(); // Ch.5 never mentions the death
    return mergeLedgers(ch4, ch5).deadCharacters.includes('Vale');
  })());

// This is the Marcus hand/stump defect, as a test.
check('IRREVERSIBLE: an amputation in Ch.3 survives into Ch.4',
  (() => {
    const ch3 = buildInitialLedger();
    ch3.characterConditions.Marcus = ['left amputated/severed'];
    const ch4 = buildInitialLedger();
    const merged = mergeLedgers(ch3, ch4);
    return (merged.characterConditions.Marcus || []).includes('left amputated/severed');
  })());

check('IRREVERSIBLE: conditions from different chapters accumulate on one character',
  (() => {
    const ch2 = buildInitialLedger(); ch2.characterConditions.Marcus = ['left broken'];
    const ch3 = buildInitialLedger(); ch3.characterConditions.Marcus = ['left amputated/severed'];
    const conds = mergeLedgers(ch2, ch3).characterConditions.Marcus;
    return conds.length === 2 && conds.includes('left broken') && conds.includes('left amputated/severed');
  })());

check('IRREVERSIBLE: a destroyed object stays destroyed',
  (() => {
    const ch5 = buildInitialLedger(); ch5.unavailableObjects.push('brass key');
    return mergeLedgers(ch5, buildInitialLedger()).unavailableObjects.includes('brass key');
  })());

check('IRREVERSIBLE: the same fact twice does not duplicate',
  (() => {
    const a = buildInitialLedger(); a.deadCharacters.push('Vale');
    const b = buildInitialLedger(); b.deadCharacters.push('Vale');
    return mergeLedgers(a, b).deadCharacters.length === 1;
  })());

// ─── MUTABLE state must be overridden by the later chapter ───────────────────────

// This is the teleporting brass key, as a test.
check('MUTABLE: possession moves - the later chapter wins, it does not union',
  (() => {
    const ch4 = buildInitialLedger(); ch4.possessions = { Lena: ['brass key'] };
    const ch5 = buildInitialLedger(); ch5.possessions = { Marcus: ['brass key'], Lena: [] };
    const m = mergeLedgers(ch4, ch5);
    return m.possessions.Marcus.includes('brass key') && m.possessions.Lena.length === 0;
  })());

check('MUTABLE: a character the later chapter never mentions keeps their possessions',
  (() => {
    const ch1 = buildInitialLedger(); ch1.possessions = { Lena: ['river stone'] };
    const ch2 = buildInitialLedger(); ch2.possessions = { Marcus: ['wrench'] };
    const m = mergeLedgers(ch1, ch2);
    return m.possessions.Lena.includes('river stone') && m.possessions.Marcus.includes('wrench');
  })());

check('MUTABLE: object locations are overridden per key, untouched keys preserved',
  (() => {
    const a = buildInitialLedger(); a.objectLocations = { 'brass key': 'archive', ledger: 'chamber' };
    const b = buildInitialLedger(); b.objectLocations = { 'brass key': 'Marcus pocket' };
    const m = mergeLedgers(a, b);
    return m.objectLocations['brass key'] === 'Marcus pocket' && m.objectLocations.ledger === 'chamber';
  })());

check('MUTABLE: an empty later reading does NOT wipe a mutable set',
  (() => {
    const a = buildInitialLedger(); a.droppedObjects.push('crowbar');
    return mergeLedgers(a, buildInitialLedger()).droppedObjects.includes('crowbar');
  })());

check('MUTABLE: a non-empty later reading replaces the mutable set',
  (() => {
    const a = buildInitialLedger(); a.droppedObjects.push('crowbar');
    const b = buildInitialLedger(); b.droppedObjects.push('flashlight');
    const d = mergeLedgers(a, b).droppedObjects;
    return d.includes('flashlight') && !d.includes('crowbar');
  })());

// ─── events: appended, deduped, BOUNDED ──────────────────────────────────────────

// This is the station-destroyed-three-times defect: the event has to survive
// forward so a later chapter can be told not to replay it.
check('EVENTS: an event completed in Ch.2 is still known in Ch.5',
  (() => {
    const ch2 = buildInitialLedger(); ch2.completedEvents.push('The station sinks beneath the ice.');
    const folded = foldChapterLedgers([ch2, buildInitialLedger(), buildInitialLedger()]);
    return folded.completedEvents.includes('The station sinks beneath the ice.');
  })());

check('EVENTS: duplicates across chapters collapse',
  (() => {
    const a = buildInitialLedger(); a.completedEvents.push('Lena finds the key.');
    const b = buildInitialLedger(); b.completedEvents.push('Lena finds the key.');
    return mergeLedgers(a, b).completedEvents.length === 1;
  })());

check('EVENTS: the STORED list is bounded so it cannot grow across 20 chapters',
  (() => {
    const big = buildInitialLedger();
    for (let i = 0; i < 500; i += 1) big.completedEvents.push('event ' + i);
    return boundLedger(big).completedEvents.length === LEDGER_MAX_COMPLETED_EVENTS;
  })());

check('EVENTS: bounding keeps the MOST RECENT events, not the oldest',
  (() => {
    const big = buildInitialLedger();
    for (let i = 0; i < 500; i += 1) big.completedEvents.push('event ' + i);
    const kept = boundLedger(big).completedEvents;
    return kept[kept.length - 1] === 'event 499' && !kept.includes('event 0');
  })());

check('EVENTS: merging is bounded too, not just an explicit boundLedger call',
  (() => {
    const a = buildInitialLedger();
    for (let i = 0; i < 400; i += 1) a.completedEvents.push('a' + i);
    const b = buildInitialLedger();
    for (let i = 0; i < 400; i += 1) b.completedEvents.push('b' + i);
    return mergeLedgers(a, b).completedEvents.length <= LEDGER_MAX_COMPLETED_EVENTS;
  })());

// ─── folding a whole book, in order ────────────────────────────────────────────

check('FOLD: an empty list folds to an empty ledger, not to null',
  JSON.stringify(foldChapterLedgers([])) === JSON.stringify(buildInitialLedger()));

check('FOLD: chapter order decides who holds a moved object',
  (() => {
    const c1 = buildInitialLedger(); c1.possessions = { Lena: ['brass key'] };
    const c2 = buildInitialLedger(); c2.possessions = { Marcus: ['brass key'], Lena: [] };
    return foldChapterLedgers([c1, c2]).possessions.Marcus.includes('brass key')
      && foldChapterLedgers([c2, c1]).possessions.Lena.includes('brass key');
  })());

check('FOLD: a gap in the middle still carries the surviving chapters forward',
  (() => {
    const c1 = buildInitialLedger(); c1.deadCharacters.push('Aris');
    const c3 = buildInitialLedger(); c3.characterConditions.Marcus = ['left amputated/severed'];
    const folded = foldChapterLedgers([c1, c3]);
    return folded.deadCharacters.includes('Aris')
      && folded.characterConditions.Marcus.includes('left amputated/severed');
  })());

check('FOLD: garbage entries do not throw',
  (() => {
    try {
      foldChapterLedgers([null, undefined, 'nonsense', 42, buildInitialLedger()]);
      return true;
    } catch (e) { return false; }
  })());

// ─── the carried ledger actually reaches the prompt ──────────────────────────────

check('PROMPT: a carried amputation is rendered into the scene prompt',
  (() => {
    const l = buildInitialLedger();
    l.characterConditions.Marcus = ['left amputated/severed'];
    const out = serializeLedger(mergeLedgers(l, buildInitialLedger()));
    return out.includes('CHARACTER CONDITIONS') && out.includes('Marcus') && out.includes('amputated');
  })());

check('PROMPT: a carried death is rendered into the scene prompt',
  serializeLedger(mergeLedgers((() => { const l = buildInitialLedger(); l.deadCharacters.push('Vale'); return l; })(), buildInitialLedger()))
    .includes('DEAD CHARACTERS'));

check('PROMPT: serializeLedger still injects only the last 10 events (prompt size)',
  (() => {
    const l = buildInitialLedger();
    for (let i = 0; i < 40; i += 1) l.completedEvents.push('event ' + i);
    const out = serializeLedger(l);
    return out.includes('event 39') && !out.includes('event 5\n');
  })());

check('TELEMETRY: summarizeLedger reports the counts that matter',
  (() => {
    const l = buildInitialLedger();
    l.deadCharacters.push('Vale');
    l.characterConditions.Marcus = ['left amputated/severed'];
    l.unavailableObjects.push('brass key');
    l.possessions = { Lena: ['river stone'] };
    l.completedEvents.push('x');
    return summarizeLedger(l) === 'dead=1 conditions=1 destroyed=1 held=1 events=1';
  })());

// ─── wiring, read from source ──────────────────────────────────────────────────

check('WIRING: generateChapterSceneByScene accepts priorLedger',
  /priorLedger = null,\s*\n\}\) \{/.test(sceneWriter));

check('WIRING: the ledger is SEEDED from priorLedger instead of always empty',
  sceneWriter.includes('let runtimeLedger = priorLedger ? cloneLedger(priorLedger) : buildInitialLedger();'));

check('WIRING: seeding is logged either way, so a silent empty seed is visible',
  (sceneWriter.match(/\[NARRATIVE-LEDGER\]/g) || []).length >= 2);

check('WIRING: the ledger is RETURNED to the caller (it used to die with the function)',
  /narrativeLedger: boundLedger\(runtimeLedger\)/.test(sceneWriter));

check('WIRING: ProjectStudio folds prior chapters and passes the result in',
  projectStudio.includes('const priorLedger = await buildPriorLedger(')
  && /priorChapterSummaries,\s*\n\s*priorLedger,/.test(projectStudio));

check('WIRING: ProjectStudio persists the ledger after drafting',
  projectStudio.includes('await saveChapterLedger(chapter.id, sceneResult.narrativeLedger, chapter.chapter_number)'));

check('WIRING: the persistence helpers live in chapterCohesion beside summary_json',
  cohesion.includes('export async function saveChapterLedger')
  && cohesion.includes('export async function buildPriorLedger'));

check('WIRING: the ledger is stored on the Chapter entity, same shape as summary_json',
  cohesion.includes('narrative_ledger_json: JSON.stringify(bounded)'));

// ─── the things this must NOT do ───────────────────────────────────────────────

check('DRAFTFIX-1: accumulatedProse is STILL chapter-local (no prose seeding)',
  sceneWriter.includes("let accumulatedProse = '';")
  && !/accumulatedProse = priorLedger/.test(sceneWriter)
  && !/let accumulatedProse = prior/.test(sceneWriter));

check('DRAFTFIX-1: the stacked-drafts comment is untouched',
  sceneWriter.includes('a draft always starts empty'));

check('SAFETY: a failed ledger save cannot kill a drafted chapter',
  /saveChapterLedger[\s\S]{0,900}catch \(e\)[\s\S]{0,200}console\.warn/.test(cohesion));

check('SAFETY: a failed prior-ledger read degrades to null rather than throwing',
  /buildPriorLedger[\s\S]{0,2000}catch \(e\)[\s\S]{0,200}return null/.test(cohesion));

check('SAFETY: a missing prior chapter ledger is WARNED about, not silently ignored',
  cohesion.includes('no saved ledger for chapter(s)')
  && cohesion.includes('will not be enforced'));

check('SAFETY: the fold is parallel-safe - it reads every earlier chapter that HAS one',
  /chapter_number\) < Number\(currentChapterNumber\)/.test(cohesion));

check('SAFETY: no LLM call is added anywhere in the ledger path',
  !/invokeLLMWithRetry|callAgent|callOllama/.test(
    cohesion.slice(cohesion.indexOf('LEDGERSCOPE-1'))));

console.log('\nBOOK SCOPE LEDGER (LEDGERSCOPE-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
