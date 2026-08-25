// LOOKAHEAD-1 acceptance battery — a beat plan for chapter N must never pull
// a LATER chapter's outline content forward (the mirror of SCENECOLLIDE-1,
// which catches a plan re-staging a PAST completed event). Fixtures use
// invented generic names (Mara, Dov, Ilse), never a real book's cast.
import {
  parseFutureOutlineSections,
  findBeatFutureOutlineCollisions,
  rewriteFutureOutlineCollisions,
  EVENT_COLLISION_VERSION,
} from '../src/lib/eventCollision.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

check('1. version', EVENT_COLLISION_VERSION === 'event-collision-v2');

const OUTLINE_MD = `## Chapter 4: The Depot

Mara and Dov board up the depot windows and take stock of what remains.

## Chapter 5: The Long Wait

Mara and Dov wait out the storm in the old depot, rationing water and arguing about the salvage run.

## Chapter 6: Ilse's Return

A sandstorm suddenly hits the outpost, and Ilse returns, having repaired the transmitter at the relay station, just as the crew loses hope of rescue.`;

// 2. parseFutureOutlineSections
{
  const future = parseFutureOutlineSections(OUTLINE_MD, 5);
  check('2a. only chapters AFTER current are returned', future.length === 1 && future[0].chapterNumber === 6);
  check('2b. section carries its own title', future[0].title === "Ilse's Return");
  check('2c. section text includes its own body', future[0].text.includes('sandstorm'));
  check('2d. current chapter itself is excluded', !future.some((s) => s.chapterNumber <= 5));
}

// 3. findBeatFutureOutlineCollisions: a plan that pulls Chapter 6 forward is flagged
{
  const future = parseFutureOutlineSections(OUTLINE_MD, 5);
  const pulledForwardBeats = [
    { scene_number: 1, scene_goal: 'Mara and Dov wait out the storm in the depot, rationing water.', required_events: [] },
    { scene_number: 2, scene_goal: "A sandstorm suddenly hits the outpost, and Ilse returns, having repaired the transmitter at the relay station.", required_events: [] },
  ];
  const findings = findBeatFutureOutlineCollisions(pulledForwardBeats, future);
  check('3a. the pulled-forward scene is flagged', findings.some((f) => f.scene_number === 2 && f.chapter_number === 6), JSON.stringify(findings));
  check('3b. the shared entity is named', findings.some((f) => f.entity === 'Ilse'), JSON.stringify(findings));
}

// 4. a clean chapter-5-only plan is never flagged
{
  const future = parseFutureOutlineSections(OUTLINE_MD, 5);
  const cleanBeats = [
    { scene_number: 1, scene_goal: 'Mara and Dov wait out the storm in the depot, rationing water.', required_events: ['Dov finds the last of the batteries'] },
    { scene_number: 2, scene_goal: 'Mara and Dov argue about whether to risk the salvage run at dawn.', required_events: [] },
  ];
  const findings = findBeatFutureOutlineCollisions(cleanBeats, future);
  check('4. a clean plan with no lookahead overlap is not flagged', findings.length === 0, JSON.stringify(findings));
}

// 5. incidental shared vocabulary alone (no distinctive entity) is not flagged
{
  const future = parseFutureOutlineSections(OUTLINE_MD, 5);
  const genericBeats = [
    { scene_number: 1, scene_goal: 'The crew waits and rations what little water remains, hoping for rescue.', required_events: [] },
  ];
  const findings = findBeatFutureOutlineCollisions(genericBeats, future);
  check('5. shared ordinary vocabulary with no shared entity is not flagged', findings.length === 0, JSON.stringify(findings));
}

// 6. rewriteFutureOutlineCollisions annotates the colliding beat, names the chapter
{
  const future = parseFutureOutlineSections(OUTLINE_MD, 5);
  const beats = [
    { scene_number: 1, scene_goal: 'Mara and Dov wait out the storm.', required_events: [] },
    { scene_number: 2, scene_goal: "A sandstorm suddenly hits the outpost, and Ilse returns, having repaired the transmitter at the relay station.", required_events: ['Ilse arrives at the depot'] },
  ];
  const findings = findBeatFutureOutlineCollisions(beats, future);
  const rewritten = rewriteFutureOutlineCollisions(beats, findings);
  const scene2 = rewritten.find((b) => b.scene_number === 2);
  check('6a. the colliding scene names Chapter 6 in its annotation', /Chapter 6/.test(scene2.scene_goal), scene2.scene_goal);
  check('6b. the clean scene is untouched', rewritten[0].scene_goal === 'Mara and Dov wait out the storm.');
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
