// STYLEBUDGET-2C acceptance battery — one escalated retry for the
// "less like X, more like Y" simile shape.
//
// STYLEBUDGET-2's verifier rejects a recast that still carries a comparison
// as 'simile-remains'. For a "less like X, more like Y" (or "less of X, more
// of Y") original sentence, the model's natural first answer restates the
// contrast with ANOTHER comparison — the shape asks for one. One escalated
// retry, same call shape, with an explicit ban on comparison language, before
// giving up. Generic fixture names only (Mara, Dov).
import {
  healSimileDensity,
  SIMILE_CONTRAST_RX,
} from '../src/lib/simileRecast.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

check('1. SIMILE_CONTRAST_RX matches "less like … more like"',
  SIMILE_CONTRAST_RX.test('It felt less like a victory and more like a slow surrender.'));
check('2. SIMILE_CONTRAST_RX also accepts "less of … more of"',
  SIMILE_CONTRAST_RX.test('It was less of a triumph and more of a quiet retreat.'));
check('3. SIMILE_CONTRAST_RX does not match an ordinary simile',
  !SIMILE_CONTRAST_RX.test('The room felt like a tomb, silent and cold.'));

const filler = 'Mara checked the coupling and tightened the last bolt while Dov counted the parts on the tarp. '.repeat(24);
const CONTRAST_SENTENCE = 'The night felt less like an ending, and more like a slow unraveling of everything they had built.';
const ORDINARY_SIMILE_SENTENCE = 'The wreckage sprawled across the plains like a spilled box of scattered pieces.';
const buildChapter = (contrastSentence) => `${filler}\n\nThe hull groaned, a sound like a giant cello being played with a rusty spoon. ${contrastSentence} ${ORDINARY_SIMILE_SENTENCE}`;

// ── 4. escalated retry: first answer keeps "like", second does not → accepted, 2 calls ──
{
  const CHAPTER = buildChapter(CONTRAST_SENTENCE);
  const calls = [];
  const mockLLM = async (userPrompt, systemPrompt) => {
    calls.push({ userPrompt, systemPrompt });
    const targetSentence = userPrompt.split('\n\n').pop();
    if (targetSentence !== CONTRAST_SENTENCE) return 'A plain rewrite with no comparison at all.';
    if (calls.filter((c) => c.userPrompt === userPrompt).length === 1) {
      return 'It felt less like triumph, more like quiet loss settling over the crew.'; // still has "like"
    }
    return 'The moment carried more loss than triumph, quiet and unmistakable.'; // one sentence, no comparison
  };
  const healed = await healSimileDensity(CHAPTER, { callLLM: mockLLM, label: 'test' });
  const contrastCalls = calls.filter((c) => c.userPrompt.endsWith(CONTRAST_SENTENCE));
  check('4a. the contrast sentence gets exactly 2 calls (primary + one escalated retry)', contrastCalls.length === 2, JSON.stringify(contrastCalls.map((c) => c.systemPrompt.slice(0, 40))));
  check('4b. the second call\'s system prompt starts with the escalation line',
    contrastCalls.length === 2 && contrastCalls[1].systemPrompt.startsWith("State the contrast as a plain assertion; do not use 'like', 'as if', or 'as though'."));
  check('4c. the escalated retry is accepted (no "like" left in the healed text near that sentence)',
    !healed.text.includes(CONTRAST_SENTENCE) && !healed.text.includes('less like triumph'));
}

// ── 5. a sentence without the contrast shape is NOT retried (1 call) ──
{
  const CHAPTER = buildChapter('The engine sat cold and silent in the dark, waiting for morning.'); // replaces contrast sentence with a non-simile line
  const calls = [];
  const mockLLM = async (userPrompt) => {
    calls.push(userPrompt);
    return 'The wreckage sprawled across the plains in bright, scattered pieces.'; // no comparison — accepted first try
  };
  await healSimileDensity(CHAPTER, { callLLM: mockLLM, label: 'test' });
  const wreckageCalls = calls.filter((c) => c.endsWith(ORDINARY_SIMILE_SENTENCE));
  check('5. an ordinary simile sentence (no contrast shape) gets exactly 1 call, never retried', wreckageCalls.length === 1, JSON.stringify(wreckageCalls));
}

// ── 6. the retry happens AT MOST once: mock rejects twice → 2 calls, skipped ──
{
  const CHAPTER = buildChapter(CONTRAST_SENTENCE);
  const calls = [];
  const mockLLM = async (userPrompt) => {
    calls.push(userPrompt);
    const targetSentence = userPrompt.split('\n\n').pop();
    if (targetSentence !== CONTRAST_SENTENCE) return 'A plain rewrite with no comparison at all.';
    return 'It felt less like triumph, more like quiet loss.'; // ALWAYS keeps "like" — both attempts reject
  };
  const healed = await healSimileDensity(CHAPTER, { callLLM: mockLLM, label: 'test' });
  const contrastCalls = calls.filter((c) => c.endsWith(CONTRAST_SENTENCE));
  check('6a. exactly 2 calls total for the contrast sentence, never a third', contrastCalls.length === 2, JSON.stringify(contrastCalls.length));
  check('6b. skipped with verify-failed:simile-remains:retried', healed.skipped.some((s) => s.reason === 'verify-failed:simile-remains:retried'), JSON.stringify(healed.skipped));
  check('6c. the original sentence is left untouched (rejected candidate never ships)', healed.text.includes(CONTRAST_SENTENCE));
}

// ── 7. sequential: never two calls in flight ──
{
  const CHAPTER = buildChapter(CONTRAST_SENTENCE);
  let inFlight = 0;
  let maxInFlight = 0;
  const mockLLM = async (userPrompt) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    const targetSentence = userPrompt.split('\n\n').pop();
    if (targetSentence !== CONTRAST_SENTENCE) return 'A plain rewrite with no comparison at all.';
    return 'It felt less like triumph, more like quiet loss.'; // forces the escalated retry every time
  };
  await healSimileDensity(CHAPTER, { callLLM: mockLLM, label: 'test' });
  check('7. never more than one call in flight at a time (primary + escalated retry included)', maxInFlight === 1, `maxInFlight=${maxInFlight}`);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
