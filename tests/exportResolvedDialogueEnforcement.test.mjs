// exportResolvedDialogueEnforcement.test.mjs
// Tests that missing opening dialogue quotes are:
// 1. Detected in export-resolved text
// 2. Repaired by the surface repair pass
// 3. Hard-blocked if repair cannot resolve all issues
//
// Uses exact DOCX8 failure snippets.

import { detectDialogueQuoteIssues, repairMissingDialogueOpeners, runDialogueMechanicsPass } from '../src/lib/dialogueMechanicsRepair.js';
import { runPreExportSafetyGate } from '../src/lib/exportSafetyGate.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition) {
  if (condition) {
    passed++;
    console.log(`  \u2705 ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.error(`  \u274c FAIL: ${label}`);
  }
}

console.log('\n=== EXPORT-RESOLVED DIALOGUE ENFORCEMENT TESTS (DOCX8 Exact Snippets) ===\n');

// ── DOCX8 exact failures ──

const DOCX8_FAILURES = [
  { id: 1,  input: `The game is the model, Marcus,\u201d she retorted`,                                  expected: `\u201cThe game is the model, Marcus,\u201d she retorted` },
  { id: 2,  input: `And I thrive on efficiency,\u201d he countered`,                                      expected: `\u201cAnd I thrive on efficiency,\u201d he countered` },
  { id: 3,  input: `I\u2019m calculating potential,\u201d she corrected him`,                                  expected: `\u201cI\u2019m calculating potential,\u201d she corrected him` },
  { id: 4,  input: `But that ignores the nonlinear variable!\u201d Mira shot back`,                       expected: `\u201cBut that ignores the nonlinear variable!\u201d Mira shot back` },
  { id: 5,  input: `Adrenaline is just chemical energy expenditure rate variance,\u201d Marcus corrected her`, expected: `\u201cAdrenaline is just chemical energy expenditure rate variance,\u201d Marcus corrected her` },
  { id: 6,  input: `No,\u201d she countered`,                                                             expected: `\u201cNo,\u201d she countered` },
  { id: 7,  input: `Precisely,\u201d the system confirmed`,                                               expected: `\u201cPrecisely,\u201d the system confirmed` },
  { id: 8,  input: `Exactly,\u201d Elena said`,                                                           expected: `\u201cExactly,\u201d Elena said` },
  { id: 9,  input: `Necessary,\u201d Elena repeated`,                                                    expected: `\u201cNecessary,\u201d Elena repeated` },
  { id: 10, input: `And I am compensated for my time,\u201d Elena countered`,                             expected: `\u201cAnd I am compensated for my time,\u201d Elena countered` },
  { id: 11, input: `It hides your sister,\u201d Aether replied`,                                         expected: `\u201cIt hides your sister,\u201d Aether replied` },
];

// ── TEST GROUP 1: Detection ──
console.log('\u2500\u2500 Detection \u2500\u2500\n');

for (const { id, input } of DOCX8_FAILURES) {
  const result = detectDialogueQuoteIssues(input, {});
  assert(`${id}. Detected: "${input.substring(0, 50)}..."`, result.count > 0);
}

// ── TEST GROUP 2: Repair ──
console.log('\n\u2500\u2500 Repair \u2500\u2500\n');

for (const { id, input, expected } of DOCX8_FAILURES) {
  const result = runDialogueMechanicsPass(input, {});
  assert(`${id}. Repaired to opening quote: "${input.substring(0, 40)}..."`, result.text.includes('\u201c') || result.text.includes('"'));
  assert(`${id}. Repair count > 0`, result.repairs.length > 0);
  assert(`${id}. After count = 0`, result.afterCount === 0);
}

// ── TEST GROUP 3: Clean dialogue unchanged ──
console.log('\n\u2500\u2500 Clean Dialogue (no false positives) \u2500\u2500\n');

const CLEAN = [
  `\u201cThis is properly quoted,\u201d she said.`,
  `\u201cI understand,\u201d Marcus replied. \u201cBut do you?\u201d`,
  `\u201cNo,\u201d she whispered. \u201cNever.\u201d`,
  `He didn\u2019t want to go. She couldn\u2019t believe it.`,
];

for (let i = 0; i < CLEAN.length; i++) {
  const result = runDialogueMechanicsPass(CLEAN[i], {});
  assert(`Clean-${i + 1}: no issues detected`, result.beforeCount === 0);
  assert(`Clean-${i + 1}: text unchanged`, result.text === CLEAN[i]);
}

// ── TEST GROUP 4: Apostrophes intact ──
console.log('\n\u2500\u2500 Apostrophes Intact \u2500\u2500\n');

{
  const text = `He didn\u2019t want to go. She couldn\u2019t believe it. They won\u2019t stop.`;
  const result = runDialogueMechanicsPass(text, {});
  assert('Apostrophes preserved', result.text.includes('\u2019'));
  assert('No false detections', result.beforeCount === 0);
}

// ── TEST GROUP 5: Pre-export surface pass simulation ──
console.log('\n\u2500\u2500 Pre-Export Surface Pass Simulation \u2500\u2500\n');

{
  // Build a fake chapter with all DOCX8 failures embedded
  const chapterText = DOCX8_FAILURES.map(f => `Some narration before. ${f.input} More text follows.`).join('\n\n');
  
  // Simulate surface repair (what ExportTab.jsx now does)
  const dmResult = runDialogueMechanicsPass(chapterText, { stage: 'pre-export-surface' });
  assert('Surface repair: all issues detected', dmResult.beforeCount >= 11);
  assert('Surface repair: all repaired', dmResult.afterCount === 0);
  assert('Surface repair: repair count >= 11', dmResult.repairs.length >= 11);
  
  // After surface repair, run export safety gate
  const repairedChapter = {
    id: 'test-ch-surface',
    chapter_number: 1,
    title: 'Test Chapter',
    content_md: dmResult.text,
  };
  const report = await runPreExportSafetyGate([repairedChapter], { project: { project_type: 'fiction' }, stage: 'post-surface-repair' });
  
  // After repair, dialogue issues should be 0, so export passes
  const ch1 = [...report.passed, ...report.warnings].find(e => e.chapterNumber === 1);
  assert('Surface repair + gate: chapter passes after repair', ch1 !== undefined);
}

// ── TEST GROUP 6: Hard block if repair cannot resolve ──
console.log('\n\u2500\u2500 Hard Block if Unrepairable \u2500\u2500\n');

{
  // Create text with many dialogue issues that would trip the threshold
  // even if some can't be repaired (simulate by using text with 10+ issues
  // and verifying the gate would block if they remained)
  const unrepairedText = DOCX8_FAILURES.map(f => f.input).join('\n');
  const chapter = {
    id: 'test-unrep',
    chapter_number: 99,
    title: 'Unrepaired Chapter',
    content_md: unrepairedText,
  };
  const report = await runPreExportSafetyGate([chapter], { project: { project_type: 'fiction' }, stage: 'test' });
  assert('Unrepaired text: export blocked', report.blocked === true);
  assert('Unrepaired text: hard failure present', report.hardFailures.length > 0);
}

// ── SUMMARY ──
console.log(`\n${'═'.repeat(60)}`);
console.log(`EXPORT-RESOLVED DIALOGUE ENFORCEMENT: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  \u274c ${f}`);
  process.exit(1);
} else {
  console.log('All export-resolved dialogue enforcement tests passed! \u2705');
}
