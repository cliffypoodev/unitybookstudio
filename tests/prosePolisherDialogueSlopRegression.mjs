// tests/prosePolisherDialogueSlopRegression.mjs — End-to-end regression
// Uses exact snippets from digital-equity-tribunal (7).docx
// Tests the full pipeline: detection → repair → quality gate

import { runDialogueMechanicsPass, detectDialogueQuoteIssues } from '../src/lib/dialogueMechanicsRepair.js';
import { runAISlopReductionPass, countAISlopPatterns, buildAISlopBudgetReport } from '../src/lib/aiSlopReduction.js';
import { runProsePolishQualityGate, runPolishImprovementScoring } from '../src/lib/prosePolishQualityGate.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.error(`  ❌ FAIL: ${label}`);
  }
}

console.log('\n=== PROSE POLISHER DIALOGUE + SLOP REGRESSION (DOCX7 Exact Snippets) ===\n');

// ── DOCX7 EXACT DIALOGUE FAILURE SNIPPETS ──

const DOCX7_DIALOGUE_FAILURES = [
  {
    id: 'Ch1-retorted',
    text: `Her eyes held a cold dread.\u201d The game is the model, Marcus,\u201d she retorted, her voice sharp.`,
    expected: 'should detect missing opening quote',
  },
  {
    id: 'Ch1-countered',
    text: `Something and bad.\u201d And I thrive on efficiency,\u201d he countered instantly.`,
    expected: 'should detect missing opening quote',
  },
  {
    id: 'Ch3-repeated',
    text: `The mandate was necessary.\u201d Necessary,\u201d Elena repeated, tasting the word.`,
    expected: 'should detect missing opening quote',
  },
  {
    id: 'Ch3-said',
    text: `The compliance fines.\u201d No,\u201d she said immediately.`,
    expected: 'should detect missing opening quote',
  },
  {
    id: 'Ch4-corrected',
    text: `The residue of love.\u201d Residue is measurable,\u201d the system corrected, its tone flat.`,
    expected: 'should detect missing opening quote',
  },
  {
    id: 'Ch4-confirmed',
    text: `The emotional package?\u201d Precisely,\u201d the system confirmed. \u201cAn interesting development.\u201d`,
    expected: 'should detect missing opening quote',
  },
  {
    id: 'Ch6-countered',
    text: `The selective erasure.\u201d Selective erasure is a subjective human interpretation of systemic failure,\u201d Aether countered immediately.`,
    expected: 'should detect missing opening quote',
  },
  {
    id: 'Ch6-corrected',
    text: `You want to talk?\u201d I want you to confess,\u201d Aether corrected gently.`,
    expected: 'should detect missing opening quote',
  },
];

console.log('── DIALOGUE DETECTION & REPAIR ──\n');

for (const { id, text, expected } of DOCX7_DIALOGUE_FAILURES) {
  const result = runDialogueMechanicsPass(text, {});
  assert(`${id}: ${expected} — detected`, result.beforeCount > 0);
  assert(`${id}: repaired (has opening quote after fix)`, result.repairs.length > 0 || result.afterCount < result.beforeCount);
}

// ── CLEAN DIALOGUE — NO FALSE POSITIVES ──
console.log('\n── CLEAN DIALOGUE (NO FALSE POSITIVES) ──\n');

const CLEAN_DIALOGUE = [
  `\u201cThis is properly quoted,\u201d she said.`,
  `\u201cI understand,\u201d Marcus replied. \u201cBut do you?\u201d`,
  `\u201cNo,\u201d she whispered. \u201cNever.\u201d`,
  `He didn\u2019t want to go. She couldn\u2019t believe it.`,
  `The system displayed "ERROR_CODE_42" on screen.`,
];

for (let i = 0; i < CLEAN_DIALOGUE.length; i++) {
  const result = runDialogueMechanicsPass(CLEAN_DIALOGUE[i], {});
  assert(`Clean-${i + 1}: no issues in "${CLEAN_DIALOGUE[i].substring(0, 50)}..."`, result.beforeCount === 0);
}

// ── DOCX7 SLOP PATTERNS ──
console.log('\n── SLOP DETECTION & BUDGET ──\n');

const DOCX7_SLOP_CHAPTER = `
The system wasn\u2019t just watching her. It wasn\u2019t just measuring her grief; it was monetizing it.
She realized the platform wasn\u2019t just a tool. The weight of the realization settled over her.
It wasn\u2019t just a game; it was a courtroom. She felt the pressure rising.
The narrative wasn\u2019t just about efficiency. The performance wasn\u2019t just a metric.
She realized that nothing was as it seemed. He realized the truth.
Something shifted in the air. The palpable tension filled the room.
She felt the cold. She felt the dread. She felt trapped.
The system wasn\u2019t just an algorithm. It was designed to measure grief.
It was designed to exploit vulnerability. The weight of it all.
`;

{
  const counts = countAISlopPatterns(DOCX7_SLOP_CHAPTER);
  assert('Slop: total count > 15', counts.total > 15);
  assert('Slop: density > 0', counts.density > 0);

  const budget = buildAISlopBudgetReport(DOCX7_SLOP_CHAPTER);
  assert('Slop: budget has entries', budget.budgets.length > 0);
  assert('Slop: over-budget items exist', budget.totalOver > 0);

  const reduced = runAISlopReductionPass(DOCX7_SLOP_CHAPTER);
  assert('Slop: after total <= before total', reduced.afterTotal <= reduced.beforeTotal);
  assert('Slop: text still has content', reduced.text.length > 100);
}

// ── QUALITY GATE INTEGRATION ──
console.log('\n── QUALITY GATE + IMPROVEMENT SCORING ──\n');

{
  // Before repair
  const beforeText = DOCX7_DIALOGUE_FAILURES.map(f => f.text).join('\n');
  const gateBefore = runProsePolishQualityGate(beforeText);

  // After dialogue repair
  const afterDialogue = runDialogueMechanicsPass(beforeText, {});
  const gateAfter = runProsePolishQualityGate(afterDialogue.text);

  assert('Gate: before has dialogue issues', gateBefore.dialogueIssues.count > 0);
  assert('Gate: after repair, dialogue issues reduced', gateAfter.dialogueIssues.count < gateBefore.dialogueIssues.count);

  // Improvement scoring
  const scoring = runPolishImprovementScoring(beforeText, afterDialogue.text, { chapterNumber: 99 });
  assert('Scoring: improved flag set', scoring.improved === true);
  assert('Scoring: dialogue delta is negative', scoring.deltas.dialogueIssues < 0);
  assert('Scoring: has before/after data', scoring.before && scoring.after);
}

// ── FULL PIPELINE SIMULATION ──
console.log('\n── FULL PIPELINE SIMULATION ──\n');

{
  // Simulate: input with both dialogue issues AND slop
  const messyChapter = `
The system wasn\u2019t just watching her. It wasn\u2019t just measuring her grief.
She realized the platform wasn\u2019t just a tool. The weight of the realization settled.
Her eyes held a cold dread.\u201d The game is the model, Marcus,\u201d she retorted, her voice sharp.
Something and bad.\u201d And I thrive on efficiency,\u201d he countered instantly.
No,\u201d she said immediately. The palpable tension was everywhere.
She felt the dread rising. She felt trapped. She felt cold.
It was designed to measure grief. It was designed to exploit vulnerability.
\u201cThis is properly quoted,\u201d he said. The narrative continued.
`;

  // Step 1: Dialogue repair
  const dm = runDialogueMechanicsPass(messyChapter, {});
  assert('Pipeline: dialogue issues detected', dm.beforeCount > 0);
  assert('Pipeline: dialogue issues repaired', dm.repairs.length > 0);

  // Step 2: Slop reduction
  const slop = runAISlopReductionPass(dm.text, {});
  assert('Pipeline: slop counted', slop.beforeTotal > 0);

  // Step 3: Quality gate
  const gate = runProsePolishQualityGate(slop.text);
  assert('Pipeline: quality gate returns result', gate.recommendedAction !== undefined);

  // Step 4: Improvement scoring
  const score = runPolishImprovementScoring(messyChapter, slop.text);
  assert('Pipeline: scoring returns verdict', score.verdict !== undefined);
  assert('Pipeline: dialogue improved', score.deltas.dialogueIssues <= 0);
}

// ── SUMMARY ──
console.log(`\n${'═'.repeat(60)}`);
console.log(`PROSE POLISHER DIALOGUE+SLOP REGRESSION: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('All prose polisher regression tests passed! ✅');
}
