// =============================================================
// manuscriptSafetyGate.test.mjs — Unit tests for safety gate
// =============================================================
// Usage: node tests/manuscriptSafetyGate.test.mjs

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Direct import of the safety gate module
const modulePath = resolve(__dirname, '..', 'src', 'lib', 'manuscriptSafetyGate.js');
const {
  detectProcessLeaks,
  detectProjectContamination,
  detectMalformedGrammar,
  runManuscriptSafetyGate,
  sanitizeForMatching,
} = await import(modulePath);

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

// ── TEST 1: Process leak detection ──────────────────────────────

console.log('\n── TEST 1: Process leak detection ──');
{
  const text = `The opening is sharp, highly polished — the layered detail of the observation 
deck works as both setting and psychological staging. The reader feels the cold immediately.

Next Move: Commit to the Bargain

Action Plan:
1. Expand the exchange scene
2. Add more sensory detail`;

  const result = detectProcessLeaks(text);
  assert(result.hasLeak === true, 'Detects process leaks');
  assert(result.matches.length >= 3, `Found ${result.matches.length} leaks (expected >= 3)`);
  assert(result.matches.some(m => m.phrase === 'The opening is sharp, highly polished'), 'Found "The opening is sharp, highly polished"');
  assert(result.matches.some(m => m.phrase === 'Next Move:'), 'Found "Next Move:"');
  assert(result.matches.some(m => m.phrase === 'Action Plan:'), 'Found "Action Plan:"');

  const gate = runManuscriptSafetyGate(text, { stage: 'pre-polish' });
  assert(gate.recommendedAction === 'REJECT_REGENERATE', `Action is REJECT_REGENERATE (got: ${gate.recommendedAction})`);
  assert(gate.ok === false, 'Gate rejects');
}

// ── TEST 2: In-story false positive — "overthinking" ────────────

console.log('\n── TEST 2: In-story false positive — "overthinking" ──');
{
  const text = `She was overthinking the problem. The numbers didn't add up, but that was
beside the point. Julian had always been bad at math. She placed her hand on the cold
metal railing and stared out over the city. The streetlights below formed a constellation
of amber and white, stretching to the horizon.`;

  const result = detectProcessLeaks(text);
  assert(result.hasLeak === false, 'No false positive on "overthinking"');

  const gate = runManuscriptSafetyGate(text, { stage: 'pre-polish' });
  assert(gate.recommendedAction === 'PASS', `Action is PASS (got: ${gate.recommendedAction})`);
  assert(gate.ok === true, 'Gate passes');
}

// ── TEST 3: In-story sci-fi label ──────────────────────────────

console.log('\n── TEST 3: In-story sci-fi label ──');
{
  const text = `The console displayed a cascade of diagnostic data. Status indicators pulsed 
in sequence: CALIBRATION ACTIVE, NEURAL LINK STABLE, SELF-CORRECTION ENGAGED.

Marcus tapped the display. "Self-Correction mode," he murmured, watching the system 
recalibrate in real time. The algorithms were learning faster than expected.`;

  const result = detectProcessLeaks(text);
  // Self-Correction appears after "display" context — should be false positive
  const selfCorrectionMatches = result.matches.filter(m => m.phrase === 'Self-Correction');
  assert(selfCorrectionMatches.length === 0, 'No false positive on sci-fi "Self-Correction" label');
}

// ── TEST 4: Contamination detection ──────────────────────────────

console.log('\n── TEST 4: Contamination detection ──');
{
  const text = `Julian crossed the studio floor, past the easels and the half-finished canvases.
The Unity Supported Living Services contract had been sitting on his desk for weeks.
Unity Media Solutions would handle the marketing, they said. But Julian wanted none of it.
The care documentation was piling up, compliance documentation overdue.`;

  const fictionProject = { project_type: 'fiction', genre: 'literary fiction' };
  const result = detectProjectContamination(text, { project: fictionProject });
  
  assert(result.hasContamination === true, 'Detects contamination');
  assert(result.matches.some(m => m.phrase === 'Unity Supported Living Services'), 'Found Unity Supported Living Services');
  assert(result.matches.some(m => m.phrase === 'Unity Media Solutions'), 'Found Unity Media Solutions');
  assert(result.matches.some(m => m.phrase === 'care documentation'), 'Found care documentation');
  assert(result.matches.some(m => m.phrase === 'compliance documentation'), 'Found compliance documentation');

  const gate = runManuscriptSafetyGate(text, { project: fictionProject, stage: 'pre-polish' });
  assert(gate.recommendedAction === 'REJECT_REGENERATE', `Action is REJECT_REGENERATE (got: ${gate.recommendedAction})`);
}

// ── TEST 5: Generic "platform" allowed ───────────────────────────

console.log('\n── TEST 5: Generic "platform" allowed ──');
{
  const text = `The platform watched her breathe. It was an old observation deck, built into 
the cliffside like a shelf of stone. She leaned against the railing and let the wind
pull at her coat. Below, the tide shifted, dark water folding over itself.`;

  const fictionProject = { project_type: 'fiction', genre: 'literary fiction' };
  const result = detectProjectContamination(text, { project: fictionProject });
  
  assert(result.hasContamination === false, 'No false positive on generic "platform"');

  const gate = runManuscriptSafetyGate(text, { project: fictionProject, stage: 'pre-polish' });
  assert(gate.ok === true, 'Gate passes for generic "platform"');
}

// ── TEST 6: Malformed grammar detection ──────────────────────────

console.log('\n── TEST 6: Malformed grammar detection ──');
{
  const text = `He crossed the room, searching for the source of the critique. You was Julian 
talking about the paint itself, or was he critiquing the composition? His own hand 
holding the brush. Was was it his fatigue? Or was the color itself changing before 
his eyes?`;

  const result = detectMalformedGrammar(text);
  
  assert(result.hasMalformed === true, 'Detects malformed grammar');
  assert(result.matches.some(m => m.phrase === 'You was'), 'Found "You was"');
  assert(result.matches.some(m => m.phrase === 'Was was'), 'Found "Was was"');

  const gate = runManuscriptSafetyGate(text, { stage: 'pre-polish' });
  assert(gate.recommendedAction === 'WARN_ONLY' || gate.recommendedAction === 'REJECT_MANUAL_REVIEW',
    `Action is WARN_ONLY or REJECT_MANUAL_REVIEW (got: ${gate.recommendedAction})`);
}

// ── TEST 7: Polish quarantine simulation ─────────────────────────

console.log('\n── TEST 7: Polish quarantine simulation ──');
{
  // Clean chapter
  const cleanText = `Sarah pushed through the double doors and stopped. The gallery was empty 
at this hour, just her and the paintings. Fluorescent tubes hummed overhead, casting 
everything in a flat, institutional light. She walked the perimeter slowly, her 
sneakers quiet on the concrete floor.

"You're early," David said from somewhere behind the partition wall.

She didn't turn around. "I needed to think."

The painting she'd been working on for three weeks stared back at her from its easel—half-
finished, the underpainting showing through in patches like exposed bone.`;

  // Process-leaked chapter
  const leakedText = `The opening is sharp, highly polished — the layered detail of the studio
sets the scene effectively.

Analysis & Strengths
- Strong sensory detail
- Effective use of dialogue

Best Next Move
Continue developing the tension between Sarah and David.

Action Plan:
1. Deepen the conflict
2. Add more physical detail to the studio`;

  const fictionProject = { project_type: 'fiction', genre: 'literary fiction' };

  const cleanGate = runManuscriptSafetyGate(cleanText, { project: fictionProject, stage: 'pre-polish' });
  const leakedGate = runManuscriptSafetyGate(leakedText, { project: fictionProject, stage: 'pre-polish' });

  assert(cleanGate.ok === true, 'Clean chapter passes gate');
  assert(cleanGate.recommendedAction === 'PASS', `Clean chapter: PASS (got: ${cleanGate.recommendedAction})`);

  assert(leakedGate.ok === false, 'Leaked chapter fails gate');
  assert(leakedGate.recommendedAction === 'REJECT_REGENERATE', `Leaked chapter: REJECT_REGENERATE (got: ${leakedGate.recommendedAction})`);

  // Simulate quarantine: only clean chapters enter polish
  const chapters = [
    { chapter_number: 1, content: cleanText },
    { chapter_number: 2, content: leakedText },
  ];

  const eligible = [];
  const rejected = [];

  for (const ch of chapters) {
    const gate = runManuscriptSafetyGate(ch.content, { project: fictionProject, chapter: ch, stage: 'pre-polish' });
    if (gate.ok) {
      eligible.push(ch);
    } else {
      rejected.push({ chapter: ch.chapter_number, action: gate.recommendedAction, reasons: gate.reasons });
    }
  }

  assert(eligible.length === 1, `1 chapter eligible for polish (got: ${eligible.length})`);
  assert(rejected.length === 1, `1 chapter rejected (got: ${rejected.length})`);
  assert(rejected[0]?.chapter === 2, `Rejected chapter is Ch.2 (got: Ch.${rejected[0]?.chapter})`);
}

// ── TEST 8: Business nonfiction allows business terms ────────────

console.log('\n── TEST 8: Business nonfiction allows business terms ──');
{
  const text = `The business plan outlined three key funding streams for the startup.
ROI projections showed Q3 as the breakeven quarter. The app launch was scheduled
for September, targeting platform market penetration of 12% by year end.`;

  const bizProject = { project_type: 'nonfiction', genre: 'business', topic: 'business strategy' };
  const result = detectProjectContamination(text, { project: bizProject });
  
  // Hard contamination like "platform market penetration" should still be flagged
  // but context-sensitive terms like "business plan", "app launch", "startup" should be allowed
  const contextMatches = result.matches.filter(m => 
    ['business plan', 'app launch', 'startup'].includes(m.phrase)
  );
  assert(contextMatches.length === 0, 'Business nonfiction allows context-sensitive business terms');
}

// ── TEST 9: Sanitize for matching ────────────────────────────────

console.log('\n── TEST 9: Sanitize for matching ──');
{
  const input = 'She said, \u201CAction Plan:\u201D and walked away\u2014quickly.';
  const result = sanitizeForMatching(input);
  assert(result.includes('"Action Plan:"'), `Curly quotes normalized: ${result}`);
  assert(result.includes('--'), 'Em dash normalized');
}

// ── TEST 10: False North-style excerpt (SAFETYGATE-1) ─────────────

console.log('\n── TEST 10: False North-style excerpt (SAFETYGATE-1) ──');
{
  const text = `"Twelve hours of daylight left. We need to move."
"We move when we're ready," she said.`;
  const result = detectProcessLeaks(text);
  assert(result.hasLeak === false, 'False North excerpt passes detectProcessLeaks');

  const gate = runManuscriptSafetyGate(text, { stage: 'pre-polish' });
  assert(gate.ok === true, 'False North excerpt passes runManuscriptSafetyGate');
}

// ── TEST 11: Natural dialogue containing former generic canaries ──

console.log('\n── TEST 11: Natural dialogue containing former generic canaries ──');
{
  const text = `"I recommend the eastern ridge," Lena said.
"We need to move before dark," Tomas said.
"Focus on how the snow shifts under your boots," Mara said.`;
  const result = detectProcessLeaks(text);
  assert(result.hasLeak === false, 'Natural dialogue passes detectProcessLeaks');
}

// ── TEST 12: Genuine editorial block still fails ─────────────────

console.log('\n── TEST 12: Genuine editorial block still fails ──');
{
  const text = `Analysis & Strengths
The pacing is good.
Next Move: Tighten the opening
Action Plan:
1. Revise dialogue.`;
  const result = detectProcessLeaks(text);
  assert(result.hasLeak === true, 'Genuine editorial block fails detectProcessLeaks');
  assert(result.matches.some(m => m.phrase === 'Analysis & Strengths'), 'Matches Analysis & Strengths');
  assert(result.matches.some(m => m.phrase === 'Next Move:'), 'Matches Next Move:');
  assert(result.matches.some(m => m.phrase === 'Action Plan:'), 'Matches Action Plan:');
}

// ── TEST 13: Raw model control tokens (LEAKFIX-2B) ───────────────

console.log('\n── TEST 13: Raw model control tokens (LEAKFIX-2B) ──');
{
  const tokens = ['/nothink', '/no_think', '<think>reasoning</think>', '<|im_end|>'];
  for (const token of tokens) {
    const text = `The wind howled through the canyon.\n\n${token}\n\nThey pushed forward.`;
    const result = detectProcessLeaks(text);
    assert(result.hasLeak === true, `Detects raw token: ${token}`);
    assert(result.matches.some(m => m.type === 'model-control-token'), `Token ${token} classified as model-control-token`);
    assert(result.matches.some(m => m.severity === 'critical'), `Token ${token} is critical`);

    const gate = runManuscriptSafetyGate(text, { stage: 'pre-polish' });
    assert(gate.ok === false, `Gate rejects token: ${token}`);
    assert(gate.recommendedAction === 'REJECT_REGENERATE', `Gate recommends REJECT_REGENERATE for token: ${token}`);
  }

  const normalText = 'I think we should leave. She was thinking about the implications.';
  const normalResult = detectProcessLeaks(normalText);
  assert(normalResult.hasLeak === false, 'Ordinary prose "think" is not flagged');
  const normalGate = runManuscriptSafetyGate(normalText, { stage: 'pre-polish' });
  assert(normalGate.ok === true, 'Gate passes ordinary prose "think"');
}

// ── SUMMARY ──────────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
console.log(`${'='.repeat(50)}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed! ✅');
  process.exit(0);
}
