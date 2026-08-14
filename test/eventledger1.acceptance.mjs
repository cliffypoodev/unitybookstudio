// EVENTLEDGER-1 acceptance battery — the persisted cross-chapter event ledger.
//
// The defect class (2026-08-14, first full novel drafted chapter-by-chapter):
//   1. The beat planner's cross-chapter memory read chapter SUMMARIES, which
//      under-describe what the persisted beat contracts actually executed —
//      so chapter 2 re-introduced a character chapter 1 had already staged,
//      and the writer drafted the same first-meeting twice.
//   2. The writer's replay gate consults prior_completed_events, but the list
//      knew nothing about earlier chapters.
//   3. The FUTURE_EVENT_STOLEN matcher vetoed a 0.67-coverage hit on a stolen
//      launch because the shared verb ('soar') was missing from the active-verb
//      list — the book ended twice with the alarm armed.
// All three are closed here, tested against the REAL modules with generic
// fixtures replicating those exact shapes.
import fs from 'node:fs';
import {
  extractChapterEvents,
  buildPriorChapterEventLedger,
  namesInEvents,
  findReintroductions,
  rewriteReintroductions,
} from '../src/lib/eventLedger.js';
import { detectEventEnactment } from '../src/lib/sceneContractGate.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── fixtures: three generic chapters with persisted beat contracts ──
const ch1 = {
  chapter_number: 1,
  scene_beats_json: JSON.stringify({
    compact_version: 'fiction-scene-contract-v1',
    beats: [
      { scene_number: 1, scene_id: 'ch01-s01', required_events: ['The crew surveys the wrecked hauler', 'Vessa admits she misread the charts'] },
      { scene_number: 2, scene_id: 'ch01-s02', required_events: ['The crew enters the trading post', 'Mr. Harlow, the owner, notices their act but plays along'] },
    ],
  }),
};
const ch2 = {
  chapter_number: 2,
  scene_beats_json: JSON.stringify([
    { scene_number: 1, scene_id: 'ch02-s01', required_events: ['Vessa bargains for a replacement coil'] },
  ]),
};
const ch3draft = { chapter_number: 3, scene_beats_json: '' };

// ── 1. extraction ──
const e1 = extractChapterEvents(ch1);
check('1. extracts events from an object-form compact contract', e1.length === 4 && e1[2].event === 'The crew enters the trading post' && e1[2].scene_id === 'ch01-s02');
check('2. extracts events from an array-form contract', extractChapterEvents(ch2).length === 1);
check('3. chapter without a contract yields no events (no throw)', extractChapterEvents(ch3draft).length === 0 && extractChapterEvents({}).length === 0);

// ── 2. the ledger ──
const ledger = buildPriorChapterEventLedger([ch3draft, ch2, ch1], 3);
check('4. ledger collects prior chapters only, in chapter order', ledger.events.length === 5 && ledger.events[0].startsWith('The crew surveys') && ledger.events[4].startsWith('Vessa bargains'));
check('5. ledger text is a DO-NOT-REPEAT block naming each chapter', /EVENT LEDGER/.test(ledger.text) && /Ch\.1: /.test(ledger.text) && /Ch\.2: /.test(ledger.text));
check('6. chapter 1 has an empty ledger', buildPriorChapterEventLedger([ch1, ch2], 1).events.length === 0 && buildPriorChapterEventLedger([ch1, ch2], 1).text === '');
const bigChapters = Array.from({ length: 40 }, (_, i) => ({
  chapter_number: i + 1,
  scene_beats_json: JSON.stringify({ beats: [{ scene_number: 1, scene_id: `ch${i + 1}-s01`, required_events: [`Chapter ${i + 1} event: the crew advances the ${i + 1}th leg of the journey across the wastes`] }] }),
}));
const capped = buildPriorChapterEventLedger(bigChapters, 41, { maxChars: 1200 });
check('7. oversized ledger elides OLDEST chapters and says so', capped.text.length <= 1300 && /elided for length/.test(capped.text) && capped.text.includes('Ch.40:') && !capped.text.includes('Ch.1:'));
check('8. elision never hides events from the machine-readable list', capped.events.length === 40);

// ── 3. reintroduction detection ──
const names = namesInEvents(ledger.events);
check('9. names harvested from prior events include the honorific name', names.has('Harlow') && names.has('Vessa'));
const badPlan = [
  { scene_number: 1, scene_goal: 'Introduce Mr. Harlow and establish him as an unlikely ally.', required_events: ['The crew meets Harlow at the trading post'] },
  { scene_number: 2, scene_goal: 'The coil fails during the storm.', required_events: ['The replacement coil burns out'] },
];
const findings = findReintroductions(badPlan, ledger.events);
check('10. a plan that re-introduces a ledgered character is flagged', findings.length >= 1 && findings.some((f) => f.name === 'Harlow' && f.scene_number === 1));
const cleanPlan = [
  { scene_number: 1, scene_goal: 'Introduce Mrs. Calloway, the county clerk.', required_events: ['Mrs. Calloway examines their papers'] },
  { scene_number: 2, scene_goal: 'Harlow warns the crew about the storm.', required_events: ['Harlow shares what he knows'] },
];
check('11. introducing a genuinely NEW character is not flagged; continuing a known one is not flagged', findReintroductions(cleanPlan, ledger.events).length === 0);

// ── 4. deterministic last-resort rewrite ──
const rewritten = rewriteReintroductions(badPlan, findings);
check('12. exhausted-attempt rewrite converts introduction to continuation', /Continue with/.test(rewritten[0].scene_goal) && /already introduced in an earlier chapter/.test(rewritten[0].scene_goal) && !/Introduce Mr\. Harlow/.test(rewritten[0].scene_goal));
check('13. rewrite leaves clean scenes byte-identical', JSON.stringify(rewritten[1]) === JSON.stringify(badPlan[1]));

// ── 5. the enactment matcher sees paraphrase (the double-launch shape) ──
const stolenEvent = 'The Silver Comet takes off, soaring into the sky.';
const stolenProse = 'The Silver Comet soared into the sky, leaving the crowd shouting after them from the field.';
check('14. paraphrased enactment of a reserved launch event now HITS', detectEventEnactment(stolenEvent, stolenProse).hit === true);
check('15. merely REMEMBERING the event does not hit', detectEventEnactment(stolenEvent, 'They remembered how the Silver Comet had soared into the sky that night.').hit === false);
check('16. naming the entities without the action does not hit', detectEventEnactment(stolenEvent, 'The Silver Comet gleamed under the open sky beside the barn.').hit === false);

// ── 6. wiring (source-level, against the live files) ──
const PSTUDIO = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');
check('17. planner builds the ledger and prepends it to prior coverage', PSTUDIO.includes('buildPriorChapterEventLedger(chapterList') && PSTUDIO.includes('${eventLedger.text}'));
check('18. beat retry loop rejects reintroductions and rewrites on exhaustion', PSTUDIO.includes('findReintroductions(normalizedBeatPlan') && (PSTUDIO.includes('rewriteReintroductions(normalizedBeatPlan') || PSTUDIO.includes('rewriteReintroductions(repairedBeats'))); // SCENECOLLIDE-1: exhaustion repair now chains reintroduction + collision rewrites
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('19. writer seeds prior_completed_events from earlier chapters (anthology excluded)', WRITER.includes('priorChapterEvents = (!isAnthologyProject(project)') && WRITER.includes('...priorChapterEvents,'));
const GATE = fs.readFileSync(new URL('../src/lib/sceneContractGate.js', import.meta.url), 'utf8');
check('20. active-verb list covers motion/transition verbs', ["'soar'", "'launch'", "'depart'", "'land'"].every((verb) => GATE.includes(verb)));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
