// CHARSTATE-2 acceptance battery.
//
// The live failure (REDUX ch.11 redraft, 2026-08-15): the beat plan itself
// declared scene 3 as "JB's return and the crew's decision to reintegrate
// him" with required event "JB returns, explaining his decision to come
// back." The writer wrote the return; three repair passes rewrote it; every
// version phrased the return naturally and none matched the narrow prose
// returnPatterns — so the CHARSTATE-1 audit kept flagging "departed character
// acting with no return written" and the chapter HARD-BLOCKED ON ITS OWN
// RETURN SCENE. Four LLM outputs, one regex, zero saves.
//
// Design under test: the beat contract is the app's own persisted, structured
// data. When the planner-approved plan DECLARES a return/departure, the state
// machine honors the declaration — in the scene gate (the declaring scene and
// later scenes are legal), in the chapter contract (demand the return be
// WRITTEN instead of banning the character), and in the cross-chapter fold
// (declared changes fill the prose patterns' silence, corroborated by the
// character appearing on that chapter's pages).
import fs from 'node:fs';
import {
  extractBeatDeclaredStateUpdates,
  collectChapterBeatEvents,
  buildCharacterState,
  buildCharacterStateContract,
  auditProseAgainstCharacterState,
  corroborateBeatDeclaredReturns,
  findPrematureCharacterPresence,
  CHARACTER_STATE_VERSION,
} from '../src/lib/characterStateLedger.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const CAST = ['Ottie', 'Ludo', 'JB', 'Yusra', 'Solveig'];

// ── 1. beat-declared extraction (the real live beat strings) ──
const d1 = extractBeatDeclaredStateUpdates(['JB returns, explaining his decision to come back.'], CAST);
check('1. the live required_event verb form is a declared return', d1.returns.includes('JB'));
const d2 = extractBeatDeclaredStateUpdates(["JB's return and the crew's decision to reintegrate him."], CAST);
check('2. the live scene_goal noun form ("JB\'s return") is a declared return', d2.returns.includes('JB'));
const d3 = extractBeatDeclaredStateUpdates(["JB's departure is referenced or explained again."], CAST);
check('3. the live forbidden_event ("departure is referenced") declares NOTHING', d3.returns.length === 0 && d3.departures.length === 0);
check('4. "JB\'s voice returns over the radio" is NOT a declared return', extractBeatDeclaredStateUpdates(["JB's voice returns over the radio."], CAST).returns.length === 0);
check('5. a declared departure is extracted ("JB leaves the crew")', extractBeatDeclaredStateUpdates(['JB leaves the crew after the argument at the silo.'], CAST).departures.includes('JB'));
check('6. unrelated beat text declares nothing', (() => { const d = extractBeatDeclaredStateUpdates(['The crew sacrifices a crucial part to shield the ship from debris.'], CAST); return d.returns.length === 0 && d.departures.length === 0; })());

// ── 2. beat-event collection from a persisted record ──
const record = { scene_beats_json: JSON.stringify([
  { scene_number: 1, scene_goal: 'Introduce the sandstorm and immediate threat to the ship.', required_events: ['A massive sandstorm suddenly engulfs Elm Fork.'] },
  { scene_number: 3, scene_goal: "JB's return and the crew's decision to reintegrate him.", required_events: ['JB returns, explaining his decision to come back.'] },
]) };
const events = collectChapterBeatEvents(record);
check('7. collectChapterBeatEvents pulls goals + required events from the persisted contract', events.length === 4 && events.some((ev) => ev.includes('JB returns')));
check('8. malformed/missing beat JSON fails safe to []', collectChapterBeatEvents({ scene_beats_json: '{not json' }).length === 0 && collectChapterBeatEvents({}).length === 0);

// ── 3. the audit accepts a DECLARED return phrased naturally (the exact live kill shape) ──
const departedState = { JB: { introduced: null, partyStatus: 'departed', statusChapter: 9 } };
const naturalReturn = 'The figure pushed through the wall of dust and resolved into a man they knew. JB stood at the edge of the yard, hat in hand, sand in every crease of his coat. He said he had heard the warning on the road out of town. Nobody spoke for a moment, and then Ludo stepped forward.';
const withoutDeclaration = auditProseAgainstCharacterState(naturalReturn, departedState, CAST);
check('9. WITHOUT the declaration the natural-phrasing return is still flagged (CHARSTATE-1 behavior preserved)', withoutDeclaration.some((v) => v.code === 'DEPARTED_CHARACTER_ACTIVE' && v.name === 'JB'));
const withDeclaration = auditProseAgainstCharacterState(naturalReturn, departedState, CAST, { declaredReturns: ['JB'] });
check('10. WITH the beat-declared return the same prose is legal (the live hard-block is dead)', withDeclaration.length === 0);
check('11. a declaration for JB does not legalize a DIFFERENT departed character', (() => {
  const state2 = { JB: { introduced: null, partyStatus: 'departed', statusChapter: 9 }, Solveig: { introduced: null, partyStatus: 'departed', statusChapter: 7 } };
  const prose = 'JB stood at the edge of the yard. Solveig grabbed the toolbox and followed the crew inside.';
  const v = auditProseAgainstCharacterState(prose, state2, CAST, { declaredReturns: ['JB'] });
  return v.length === 1 && v[0].name === 'Solveig';
})());

// ── 4. the chapter contract demands the declared return be WRITTEN ──
const amended = buildCharacterStateContract(departedState, ['JB']);
check('12. contract for a declared return says WRITE it, not "may NOT appear"', amended.includes("THIS chapter's plan DECLARES JB's return") && amended.includes('ON THE PAGE') && !amended.includes('has NOT returned'));
const unamended = buildCharacterStateContract(departedState, []);
check('13. without a declaration the CHARSTATE-1 ban stands unchanged', unamended.includes('JB may NOT appear'));

// ── 5. cross-chapter fold: declarations fill the prose patterns\' silence ──
const ch9 = { chapterNumber: 9, text: 'Long chapter. '.repeat(20) + 'They watched JB go, a small figure against the wheat. JB was gone. The yard felt larger.' };
const ch11ReturnedNaturally = { chapterNumber: 11, text: 'Storm chapter. '.repeat(20) + naturalReturn, beatEvents: collectChapterBeatEvents(record) };
const foldedState = buildCharacterState([ch9, ch11ReturnedNaturally], CAST);
check('14. a beat-declared return + the character on the page folds to RETURNED', foldedState.JB.partyStatus === 'returned' && foldedState.JB.statusChapter === 11);
const ch11WithoutJB = { chapterNumber: 11, text: 'Storm chapter without him. '.repeat(20) + 'Ottie secured the tarp while Ludo cursed the wind.', beatEvents: collectChapterBeatEvents(record) };
check('15. a declared return with the character ABSENT from the page does NOT fold (the page is truth)', buildCharacterState([ch9, ch11WithoutJB], CAST).JB.partyStatus === 'departed');
check('16. prose-extracted updates in the same chapter outrank the declaration', (() => {
  // The plan declared a return, but the page actually wrote ANOTHER departure
  // ("they watched JB go") — the page wins; the declaration must not flip it.
  const ch11ProseDeparts = { chapterNumber: 11, text: 'Filler here. '.repeat(20) + 'They watched JB go a second time, and this time nobody argued. JB was gone.', beatEvents: ['JB returns, explaining his decision to come back.'] };
  const s = buildCharacterState([ch9, ch11ProseDeparts], CAST);
  return s.JB.partyStatus === 'departed' && s.JB.statusChapter === 11;
})());
check('17. version bumped to character-state-v3', CHARACTER_STATE_VERSION === 'character-state-v3'); // CHARSTATE-2B/2C

// ── 6. wiring (source-level) ──
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('18. writer contract passes this chapter\'s declared returns', WRITER.includes('buildCharacterStateContract(characterState, chapterDeclaredReturns)'));
check('19. every scene spec carries CUMULATIVE declared returns (scenes ≤ this one)', WRITER.includes('__beatDeclaredReturns') && WRITER.includes('normalizedScenes.slice(0, i + 1)'));
check('20. prior-chapter prose feed carries beat events for the state fold', /resolvedPriorProse\.push\(\{ chapterNumber: Number\(prior\.chapter_number\), text: body, beatEvents: collectChapterBeatEvents\(prior\) \}\)/.test(WRITER));
const GATE_SRC = fs.readFileSync(new URL('../src/lib/sceneContractGate.js', import.meta.url), 'utf8');
check('21. scene gate audits with the spec\'s declared returns', GATE_SRC.includes("{ declaredReturns: spec?.__beatDeclaredReturns || [] }"));
const STUDIO = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');
check('22. beat planner state fold carries beat events', /statePriorChapters\.push\(\{ chapterNumber: Number\(prior\.chapter_number\), text: body, beatEvents: collectChapterBeatEvents\(prior\) \}\)/.test(STUDIO));
const EXPORT_GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
check('23. export gate folds beat events and audits with per-chapter declarations', EXPORT_GATE.includes('beatEvents: collectChapterBeatEvents(ch)') && EXPORT_GATE.includes('{ declaredReturns: declaredHere }'));

// 24-26. CHARSTATE-2B (live proof Run 3, Arc D, 2026-08-24): a beat-declared
// return is honored only when THIS chapter's own outline/beat-summary
// corroborates it. Live REDUX ch.10 self-declared "JB returns" with no
// corroboration from ch.10's own outline (the text was lifted from ch.11).
// Generic fixture names (Mara, Dov, Ilse), not the live book's cast.
{
  const { corroborated, uncorroborated } = corroborateBeatDeclaredReturns(['Ilse'], 'Ilse returns to the depot at dawn, soaked and shaking.');
  check('24. a declared return corroborated by the outline/beat-summary is honored', corroborated.includes('Ilse') && uncorroborated.length === 0, JSON.stringify({ corroborated, uncorroborated }));
}
{
  const { corroborated, uncorroborated } = corroborateBeatDeclaredReturns(['Ilse'], 'Mara and Dov wait out the storm; nothing here mentions Ilse at all.');
  check('25. a self-declared return with NO outline corroboration is rejected', uncorroborated.includes('Ilse') && corroborated.length === 0, JSON.stringify({ corroborated, uncorroborated }));
}
{
  const { corroborated, uncorroborated } = corroborateBeatDeclaredReturns(['Ilse', 'Dov'], "Ilse's return lifts the crew's spirits, though Dov stays behind at the depot packing supplies.");
  check('26. corroboration is checked per name, not all-or-nothing', corroborated.includes('Ilse') && uncorroborated.includes('Dov'), JSON.stringify({ corroborated, uncorroborated }));
}

// 27-29. CHARSTATE-2C (live proof Run 3, Arc D, 2026-08-24): a scene listing
// a departed character as present BEFORE any scene's own text declares their
// return is a contract violation, independent of the whole-chapter status
// flip (live REDUX ch.10: all three scenes listed JB present, including
// scene 1, before scene 2's "JB returns").
{
  const beats = [
    { scene_number: 1, scene_goal: 'Mara searches the depot alone.', characters_present: ['Mara', 'Ilse'], required_events: [] },
    { scene_number: 2, scene_goal: 'Ilse returns, having repaired the transmitter.', characters_present: ['Mara', 'Ilse'], required_events: [] },
    { scene_number: 3, scene_goal: 'The crew celebrates.', characters_present: ['Mara', 'Ilse', 'Dov'], required_events: [] },
  ];
  const findings = findPrematureCharacterPresence(beats, ['Ilse']);
  check('27. a departed character listed present BEFORE the return scene is flagged', findings.some((f) => f.scene_number === 1 && f.name === 'Ilse'), JSON.stringify(findings));
  check('28. the return scene itself and every scene after it are clean', !findings.some((f) => f.scene_number >= 2), JSON.stringify(findings));
}
{
  const beats = [
    { scene_number: 1, scene_goal: 'Mara waits alone in the depot.', characters_present: ['Mara'], required_events: [] },
    { scene_number: 2, scene_goal: 'Ilse returns, having repaired the transmitter.', characters_present: ['Mara', 'Ilse'], required_events: [] },
  ];
  const findings = findPrematureCharacterPresence(beats, ['Ilse']);
  check('29. a plan that correctly withholds the departed character until the return scene is clean', findings.length === 0, JSON.stringify(findings));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
