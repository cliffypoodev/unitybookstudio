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
check('2a. "before JB\'s return" is FUTURE context, not a declaration', extractBeatDeclaredStateUpdates(["Hold the line before JB's return."], CAST).returns.length === 0);
check('2b. "until JB returns in scene 3" is FUTURE context, not a declaration', extractBeatDeclaredStateUpdates(["Keep him absent until JB returns in scene 3."], CAST).returns.length === 0);
check('2c. an anticipated/not-yet return does not flip state', extractBeatDeclaredStateUpdates(["JB's return is anticipated but not yet happened."], CAST).returns.length === 0);
check('2d. a return reserved for a later scene does not flip state', extractBeatDeclaredStateUpdates(["JB's return belongs to scene 3."], CAST).returns.length === 0);
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

// REDUX Chapter 7 -> 8 regression (2026-10-04): a chapter may stage a
// departure early and resolve it by the final scene's authoritative state.
// That closing state is part of the persisted beat contract and must ride into
// the next chapter's state fold. Otherwise the next chapter sees a character
// as still departed and hard-blocks ordinary on-page action.
const resolvedPriorChapterRecord = { scene_beats_json: JSON.stringify([
  {
    scene_number: 1,
    scene_goal: 'Zin walks away after the argument.',
    required_events: ['Zin leaves the crew after the confrontation.'],
    entry_state: 'Zin and Rodge are arguing outside the ship.',
    exit_state: 'Zin is alone in the desert; Rodge remains with the crew.',
  },
  {
    scene_number: 3,
    scene_goal: 'Rodge finds Zin and they reconcile.',
    required_events: ['Rodge acknowledges her point and offers his support.'],
    entry_state: 'Zin is away from the crew; Rodge has gone to find her.',
    exit_state: 'Zin has rejoined the crew; Zin and Rodge walk back to the ship together.',
  },
]) };
const resolvedPriorEvents = collectChapterBeatEvents(resolvedPriorChapterRecord);
check(
  '8a. prior-chapter beat collection preserves authoritative entry/exit state for cross-chapter continuity',
  resolvedPriorEvents.some((ev) => /Zin has rejoined the crew/i.test(ev)),
  JSON.stringify(resolvedPriorEvents)
);
const zinNaturalReconciliation = [
  'Zin left the crew after the argument and walked out into the desert.',
  'Rodge found Zin at the livery stable after dark.',
  'They talked until the anger drained out of the room.',
  'Zin and Rodge walked back to the ship together before dawn.',
].join(' ');
const zinFolded = buildCharacterState([
  {
    chapterNumber: 7,
    text: ('Chapter seven continuity. '.repeat(12)) + zinNaturalReconciliation,
    beatEvents: resolvedPriorEvents,
  },
], ['Zin', 'Rodge']);
check(
  '8b. an authoritative closing-state reunion clears an earlier same-chapter departure before the next chapter',
  zinFolded.Zin?.partyStatus === 'returned',
  JSON.stringify(zinFolded.Zin)
);

// ── 3. the audit accepts a DECLARED return phrased naturally (the exact live kill shape) ──
const departedState = { JB: { introduced: null, partyStatus: 'departed', statusChapter: 9 } };
const naturalReturn = 'The figure pushed through the wall of dust and resolved into a man they knew. JB stood at the edge of the yard, hat in hand, sand in every crease of his coat. He said he had heard the warning on the road out of town. Nobody spoke for a moment, and then Ludo stepped forward.';
const withoutDeclaration = auditProseAgainstCharacterState(naturalReturn, departedState, CAST);
check('9. WITHOUT the declaration the natural-phrasing return is still flagged (CHARSTATE-1 behavior preserved)', withoutDeclaration.some((v) => v.code === 'DEPARTED_CHARACTER_ACTIVE' && v.name === 'JB'));
check('9a. an unauthorized departed-character repair must REMOVE activity, never invent a return', withoutDeclaration.some((v) => v.code === 'DEPARTED_CHARACTER_ACTIVE' && /Do NOT invent a return/i.test(v.message) && /absence, past memories, or inanimate possessions may remain/i.test(v.message)), JSON.stringify(withoutDeclaration));
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
check('21a. contract repair explicitly forbids inventing an unauthorized departed-character return', GATE_SRC.includes('do NOT invent one') && GATE_SRC.includes('past memories, or inanimate possessions may remain'));
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

// 30-31. CHARSTATE-2D / live REDUX Ch.8: state carries the short nickname
// "Zin" while architect beat casts carry the formal label "Zinnia 'Zin' Quark".
// Alias-equivalent labels must be treated as the SAME departed character or the
// planner accepts a scene that the prose gate later hard-rejects.
{
  const beats = [
    {
      scene_number: 1,
      scene_goal: 'Rodge searches Elm Fork for Zin.',
      characters: ["Roderick 'Rodge' Krye"],
      required_events: ['Rodge finds a clue pointing toward the festival grounds.'],
    },
    {
      scene_number: 2,
      scene_goal: 'The crew gathers parts at the festival.',
      characters: ["Zinnia 'Zin' Quark", "Roderick 'Rodge' Krye", 'Sadie'],
      required_events: ['The crew gathers usable parts.'],
    },
    {
      scene_number: 3,
      scene_goal: 'Zin returns to the crew after reconsidering her departure.',
      characters: ["Zinnia 'Zin' Quark", "Roderick 'Rodge' Krye"],
      required_events: ['Zin returns to the crew and reunites with Rodge.'],
    },
  ];
  const findings = findPrematureCharacterPresence(beats, ['Zin']);
  check(
    '30. nickname state matches the formal beat-cast label and flags premature presence',
    findings.some((f) => f.scene_number === 2 && f.name === 'Zin' && /Zinnia/.test(f.presented_as || '')),
    JSON.stringify(findings)
  );
  check(
    '31. the later scene that actually declares the nickname return is legal',
    !findings.some((f) => f.scene_number === 3),
    JSON.stringify(findings)
  );
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
