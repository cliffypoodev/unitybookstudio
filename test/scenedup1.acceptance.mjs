// SCENEDUP-1 acceptance battery — same-chapter scene-duplication detector
// (the two-arrivals class). Regen-lane extraDetectors entry, kind
// 'scene-duplicate'. Fixtures use invented generic names (Mara, Dov, Ilse).
import { detectSameChapterSceneDuplicates, EVENT_COLLISION_VERSION } from '../src/lib/eventCollision.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// 1. version (shared with eventCollision.js's other exports)
check('1. version', EVENT_COLLISION_VERSION === 'event-collision-v1');

// 2. same-chapter re-arrival flagged (the two-arrivals class)
{
  const text = 'Mara stood at the dock, waiting for word. Dov watched the horizon, restless. A rival salvage team arrived, led by a scarred woman with cold eyes.\n\nMara and Dov argued about the plan for a while, tense and quiet.\n\nThe rival salvage team arrived again at the dock, the same scarred woman leading them in.';
  const targets = detectSameChapterSceneDuplicates(text);
  check('2. same-chapter re-arrival flagged', targets.length >= 1 && targets.every((t) => t.kind === 'scene-duplicate'), JSON.stringify(targets));
}

// 3. two different events (different entities) not flagged
{
  const text = 'A rival salvage team arrived at the dock, led by a scarred woman.\n\nMara and Dov argued about the plan for a while, tense and quiet.\n\nA supply convoy arrived at the gate later that evening, unannounced.';
  const targets = detectSameChapterSceneDuplicates(text);
  check('3. two different events (different entities) not flagged', targets.length === 0, JSON.stringify(targets));
}

// 4. a single paragraph (no earlier scene to collide with) is never flagged
{
  const text = 'A rival salvage team arrived at the dock, led by a scarred woman with cold eyes and a torn coat.';
  const targets = detectSameChapterSceneDuplicates(text);
  check('4. a single paragraph is never flagged', targets.length === 0);
}

// 5. departure re-staged in a later paragraph is flagged
{
  const text = 'Dov departed the crew without a word that morning, bag slung over one shoulder.\n\nMara sat alone in the galley, turning a coin over in her hand.\n\nDov departed the crew again that same night, walking out without looking back.';
  const targets = detectSameChapterSceneDuplicates(text);
  check('5. departure re-staged is flagged', targets.some((t) => t.reason.includes('departed')), JSON.stringify(targets));
}

// 6. overlap guard prevents vocabulary-only false positive (REVEAL needs content overlap)
{
  const text = 'Ilse admitted, "It\'s pretty," while looking over the railing at the sunset.\n\nMara paced the deck, arms crossed, saying nothing.\n\nDov admitted he was hungry and went to find something to eat.';
  const targets = detectSameChapterSceneDuplicates(text);
  check('6. REVEAL overlap guard prevents vocabulary-only FP', targets.length === 0, JSON.stringify(targets));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
