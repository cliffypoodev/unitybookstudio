// =============================================================
// digitalEquityPipelineRegression.mjs — Regression tests
//
// Validates that the safety gate correctly catches all known
// failures from the Digital Equity Tribunal app pipeline.
//
// Usage: node tests/digitalEquityPipelineRegression.mjs
// =============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const modulePath = resolve(__dirname, '..', 'src', 'lib', 'manuscriptSafetyGate.js');
const {
  detectProcessLeaks,
  detectProjectContamination,
  detectMalformedGrammar,
  runManuscriptSafetyGate,
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

// ── FIXTURE DATA ──────────────────────────────────────────────

const FICTION_PROJECT = { project_type: 'anthology', genre: 'literary fiction', title: 'Digital Equity Tribunal' };

const CHAPTER_2_LEAKED_FIXTURE = `The opening is sharp, highly polished \u2014 the layered detail of the observation deck works as both setting and psychological staging. The reader feels the cold immediately.

Julian dipped the brush into cerulean, watching the pigment dissolve into the medium with a deliberate slowness. The Unity Supported Living Services contract had been sitting on his desk for three weeks. Unity Media Solutions would handle the distribution. The care documentation was overdue, compliance documentation piling up in the corner.

Next Move: Commit to the Bargain

The current trajectory is working exactly as planned. We have established the what and the why. We need to move forward.

Action Plan:
1. Deepen the internal conflict
2. Focus on how Julian navigates the institutional pressure

The canvas before him was a battlefield of color and intention, every brushstroke carrying the weight of an unspoken argument. Don't blend," Julian said, stepping back. Worse is too strong," Julian corrected himself. It's everything," Julian said softly.`;

const CLEAN_CHAPTER_FIXTURE = `Sarah pushed through the double doors and stopped. The gallery was empty at this hour, just her and the paintings. Fluorescent tubes hummed overhead, casting everything in a flat, institutional light.

She walked the perimeter slowly, her sneakers quiet on the concrete floor. Each canvas was a window into someone else's obsession\u2014landscapes that never existed, faces caught between expressions, abstractions that looked like weather systems.

"You're early," David said from somewhere behind the partition wall.

She didn't turn around. "I needed to think."

The painting she'd been working on for three weeks stared back at her from its easel. Half-finished, the underpainting showing through in patches like exposed bone. She picked up a palette knife and scraped away the top layer of cadmium yellow. Underneath, the raw canvas breathed.

"That's a bold move," David said, appearing at her shoulder. He smelled like turpentine and coffee. "You sure?"

"No." She scraped again, harder. "But I'm sure about the other way being wrong."`;

// ── REGRESSION CHECK 1: Pre-polish gate rejects Chapter 2 ─────

console.log('\n── REGRESSION CHECK 1: Pre-polish gate rejects Chapter 2 with process leaks ──');
{
  const gate = runManuscriptSafetyGate(CHAPTER_2_LEAKED_FIXTURE, {
    project: FICTION_PROJECT,
    chapter: { chapter_number: 2 },
    stage: 'pre-polish',
  });

  assert(gate.ok === false, 'Ch.2 fails safety gate');
  assert(gate.recommendedAction === 'REJECT_REGENERATE', `Action is REJECT_REGENERATE (got: ${gate.recommendedAction})`);

  // Specific process leak checks
  assert(
    gate.processLeaks.matches.some(m => m.phrase === 'The opening is sharp, highly polished'),
    'Detects "The opening is sharp, highly polished"'
  );
  assert(
    gate.processLeaks.matches.some(m => m.phrase === 'Action Plan:'),
    'Detects "Action Plan:"'
  );
  assert(
    gate.processLeaks.matches.some(m => m.phrase === 'Next Move:'),
    'Detects "Next Move:"'
  );
  assert(
    gate.processLeaks.matches.some(m => m.phrase.includes('current trajectory')),
    'Detects "The current trajectory is working exactly as planned"'
  );
}

// ── REGRESSION CHECK 2: Pre-polish gate rejects Unity contamination ──

console.log('\n── REGRESSION CHECK 2: Pre-polish gate rejects Unity contamination ──');
{
  const gate = runManuscriptSafetyGate(CHAPTER_2_LEAKED_FIXTURE, {
    project: FICTION_PROJECT,
    chapter: { chapter_number: 2 },
    stage: 'pre-polish',
  });

  assert(
    gate.contamination.matches.some(m => m.phrase === 'Unity Supported Living Services'),
    'Detects "Unity Supported Living Services"'
  );
  assert(
    gate.contamination.matches.some(m => m.phrase === 'Unity Media Solutions'),
    'Detects "Unity Media Solutions"'
  );
  assert(
    gate.contamination.matches.some(m => m.phrase === 'care documentation'),
    'Detects "care documentation"'
  );
  assert(
    gate.contamination.matches.some(m => m.phrase === 'compliance documentation'),
    'Detects "compliance documentation"'
  );
}

// ── REGRESSION CHECK 3: Polish does not run on rejected Chapter 2 ──

console.log('\n── REGRESSION CHECK 3: Polish quarantine — only clean chapters are eligible ──');
{
  const chapters = [
    { chapter_number: 1, content: CLEAN_CHAPTER_FIXTURE },
    { chapter_number: 2, content: CHAPTER_2_LEAKED_FIXTURE },
  ];

  const eligible = [];
  const rejected = [];

  for (const ch of chapters) {
    const gate = runManuscriptSafetyGate(ch.content, {
      project: FICTION_PROJECT,
      chapter: ch,
      stage: 'pre-polish',
    });
    if (gate.ok) {
      eligible.push(ch);
    } else {
      rejected.push(ch);
    }
  }

  assert(eligible.length === 1, `1 chapter eligible for polish (got: ${eligible.length})`);
  assert(rejected.length === 1, `1 chapter rejected (got: ${rejected.length})`);
  assert(rejected[0]?.chapter_number === 2, `Rejected chapter is Ch.2`);
  assert(eligible[0]?.chapter_number === 1, `Eligible chapter is Ch.1`);
}

// ── REGRESSION CHECK 4: Export gate blocks rejected Chapter 2 ──

console.log('\n── REGRESSION CHECK 4: Export gate blocks rejected Chapter 2 ──');
{
  const gate = runManuscriptSafetyGate(CHAPTER_2_LEAKED_FIXTURE, {
    project: FICTION_PROJECT,
    chapter: { chapter_number: 2 },
    stage: 'pre-export',
  });

  assert(gate.ok === false, 'Export gate rejects Ch.2');
  assert(
    gate.recommendedAction === 'REJECT_REGENERATE',
    `Export gate action: REJECT_REGENERATE (got: ${gate.recommendedAction})`
  );
}

// ── REGRESSION CHECK 5: Clean chapter passes ──

console.log('\n── REGRESSION CHECK 5: Clean chapter passes ──');
{
  const gate = runManuscriptSafetyGate(CLEAN_CHAPTER_FIXTURE, {
    project: FICTION_PROJECT,
    chapter: { chapter_number: 1 },
    stage: 'pre-polish',
  });

  assert(gate.ok === true, 'Clean chapter passes gate');
  assert(gate.recommendedAction === 'PASS', `Action is PASS (got: ${gate.recommendedAction})`);
  assert(gate.processLeaks.hasLeak === false, 'No process leaks in clean chapter');
  assert(gate.contamination.hasContamination === false, 'No contamination in clean chapter');
  assert(gate.malformed.hasMalformed === false, 'No malformed grammar in clean chapter');
}

// ── REGRESSION CHECK 6: Multiple stages consistently reject ──

console.log('\n── REGRESSION CHECK 6: All stages consistently reject leaked chapter ──');
{
  const stages = ['post-draft', 'pre-polish', 'pre-export'];
  for (const stage of stages) {
    const gate = runManuscriptSafetyGate(CHAPTER_2_LEAKED_FIXTURE, {
      project: FICTION_PROJECT,
      chapter: { chapter_number: 2 },
      stage,
    });
    assert(gate.ok === false, `Stage "${stage}" rejects Ch.2`);
  }
}

// ── REGRESSION CHECK 7: Reasons array is populated ──

console.log('\n── REGRESSION CHECK 7: Reasons array populated for diagnostics ──');
{
  const gate = runManuscriptSafetyGate(CHAPTER_2_LEAKED_FIXTURE, {
    project: FICTION_PROJECT,
    chapter: { chapter_number: 2 },
    stage: 'pre-polish',
  });

  assert(gate.reasons.length >= 2, `Has ${gate.reasons.length} reason(s) (expected >= 2)`);
  assert(
    gate.reasons.some(r => r.includes('process')),
    'Reasons mention process leakage'
  );
  assert(
    gate.reasons.some(r => r.includes('contamination') || r.includes('Unity')),
    'Reasons mention contamination'
  );
}

// ── SUMMARY ──────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`DIGITAL EQUITY TRIBUNAL REGRESSION: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'='.repeat(60)}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All regression checks passed! ✅');
  process.exit(0);
}
