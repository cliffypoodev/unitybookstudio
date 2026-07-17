// =============================================================
// liveExportSafetyRegression.mjs — Live export path regression
//
// This test does NOT just unit-test manuscriptSafetyGate.
// It simulates the actual export resolution function and
// verifies that the extracted exportSafetyGate module blocks
// contaminated content from reaching DOCX.
//
// Usage: node tests/liveExportSafetyRegression.mjs
// =============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the actual modules used by the live export path
const exportGatePath = resolve(__dirname, '..', 'src', 'lib', 'exportSafetyGate.js');
const { runPreExportSafetyGate, formatExportSafetyFailure } = await import(exportGatePath);

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

// ── FIXTURE: Chapter 2 from the actual live failure ──

const CHAPTER_2_LEAKED = `The opening is sharp, highly polished, and immediately establishes all necessary emotional vectors. You nailed the initial rhythm—the blend of academic precision and simmering desperation that defines this voice.
You have successfully executed the "setup" beats: Darius's acute economic pressure is thick, and Julian's proposition lands not as a mere commission, but as an invasive, totalizing form of artistic extraction.
The current trajectory is working exactly as planned. We have established the what and the why.
Next Move: Commit to the Bargain
We need to move immediately into the mechanics of the exchange.
Action Plan:
1. Deepen the Transaction: Expose the specific, uncomfortable terms.
2. Focus on how he begins painting.

Julian dipped the brush into cerulean, watching the pigment dissolve into the medium with a deliberate slowness. The Unity Supported Living Services contract had been sitting on his desk for three weeks. Unity Media Solutions would handle the distribution. The care documentation was overdue, compliance documentation piling up in the corner.

You was Julian talking about the painting or the deal? Was was it a failure, or was it something else?`;

const CLEAN_CHAPTER_1 = `Sarah pushed through the double doors and stopped. The gallery was empty at this hour, just her and the paintings. Fluorescent tubes hummed overhead, casting everything in a flat, institutional light.

She walked the perimeter slowly, her sneakers quiet on the concrete floor. Each canvas was a window into someone else's obsession—landscapes that never existed, faces caught between expressions, abstractions that looked like weather systems.

"You're early," David said from somewhere behind the partition wall.

She didn't turn around. "I needed to think."

The painting she'd been working on for three weeks stared back at her from its easel. Half-finished, the underpainting showing through in patches like exposed bone. She picked up a palette knife and scraped away the top layer of cadmium yellow.`;

const CLEAN_CHAPTER_3 = `The courtroom was smaller than Marcus had imagined. Wood-paneled walls absorbed sound the way a confessional booth might, turning every whispered objection into something intimate and unignorable.

He sat in the third row, notebook open, pen uncapped. The judge—a woman in her sixties with reading glasses perched on her nose—shuffled papers with the practiced disinterest of someone who had seen a thousand variations of the same human failure.

"Case number 2024-CV-7712," the clerk announced. "Martinez versus Digital Futures Foundation."

Marcus underlined the case number twice. This was the one.`;

// ── REGRESSION 1: Simulate buildResolvedExportChapters with mixed content ──

console.log('\n── REGRESSION 1: Mixed manuscript — 1 contaminated, 2 clean ──');
{
  const resolvedChapters = [
    { chapter_number: 1, title: 'The Algorithmic Stage', content_md: CLEAN_CHAPTER_1, __exportResolved: true },
    { chapter_number: 2, title: "The Patron's Palette", content_md: CHAPTER_2_LEAKED, __exportResolved: true },
    { chapter_number: 3, title: 'The Office of Echoes', content_md: CLEAN_CHAPTER_3, __exportResolved: true },
  ];

  const report = await runPreExportSafetyGate(resolvedChapters, {
    project: { project_type: 'anthology', genre: 'literary fiction' },
  });

  assert(report.blocked === true, 'Export is BLOCKED');
  assert(report.hardFailures.length === 1, `Exactly 1 hard failure (got: ${report.hardFailures.length})`);
  assert(report.hardFailures[0]?.chapterNumber === 2, `Hard failure is Ch.2 (got: Ch.${report.hardFailures[0]?.chapterNumber})`);
  assert(report.passed.length === 2, `2 chapters passed (got: ${report.passed.length})`);
  assert(report.hardFailures[0]?.processLeakCount > 0, `Process leak count > 0 (got: ${report.hardFailures[0]?.processLeakCount})`);
  assert(report.hardFailures[0]?.contaminationCount > 0, `Contamination count > 0 (got: ${report.hardFailures[0]?.contaminationCount})`);
  assert(report.hardFailures[0]?.malformedCount > 0, `Malformed count > 0 (got: ${report.hardFailures[0]?.malformedCount})`);
  assert(report.summary.includes('BLOCKED'), `Summary says BLOCKED`);
  assert(report.timestamp.length > 0, `Timestamp populated`);

  // Verify no DOCX builder would be called
  assert(report.blocked === true, 'DOCX builder should NOT be called (blocked=true)');
}

// ── REGRESSION 2: Simulate full contaminated manuscript ──

console.log('\n── REGRESSION 2: All chapters contaminated ──');
{
  const resolvedChapters = [
    { chapter_number: 1, title: 'Ch1', content_md: CHAPTER_2_LEAKED, __exportResolved: true },
    { chapter_number: 2, title: 'Ch2', content_md: CHAPTER_2_LEAKED, __exportResolved: true },
  ];

  const report = await runPreExportSafetyGate(resolvedChapters, {
    project: { project_type: 'anthology', genre: 'literary fiction' },
  });

  assert(report.blocked === true, 'Export is BLOCKED (all contaminated)');
  assert(report.hardFailures.length === 2, `Both chapters failed (got: ${report.hardFailures.length})`);
}

// ── REGRESSION 3: Clean manuscript passes ──

console.log('\n── REGRESSION 3: All clean chapters pass ──');
{
  const resolvedChapters = [
    { chapter_number: 1, title: 'Ch1', content_md: CLEAN_CHAPTER_1, __exportResolved: true },
    { chapter_number: 3, title: 'Ch3', content_md: CLEAN_CHAPTER_3, __exportResolved: true },
  ];

  const report = await runPreExportSafetyGate(resolvedChapters, {
    project: { project_type: 'anthology', genre: 'literary fiction' },
  });

  assert(report.blocked === false, 'Export is NOT blocked (clean)');
  assert(report.hardFailures.length === 0, 'No hard failures');
  assert(report.passed.length === 2, `2 chapters passed (got: ${report.passed.length})`);
  assert(report.summary.includes('CLEAR') || report.summary.includes('WARNING'), `Summary says CLEAR or WARNING (got non-blocked)`);
}

// ── REGRESSION 4: formatExportSafetyFailure output ──

console.log('\n── REGRESSION 4: Failure report format ──');
{
  const resolvedChapters = [
    { chapter_number: 2, title: "The Patron's Palette", content_md: CHAPTER_2_LEAKED, __exportResolved: true },
  ];

  const report = await runPreExportSafetyGate(resolvedChapters, {
    project: { project_type: 'anthology', genre: 'literary fiction' },
  });

  const formatted = formatExportSafetyFailure(report);

  assert(formatted.includes('EXPORT BLOCKED'), 'Formatted report says EXPORT BLOCKED');
  assert(formatted.includes('Chapter 2'), 'Formatted report mentions Chapter 2');
  assert(formatted.includes('process-leak'), 'Formatted report mentions process-leak type');
  assert(formatted.includes('ALLOW_UNSAFE_EXPORT'), 'Formatted report mentions override flag');
}

// ── REGRESSION 5: Short chapters are skipped (not false-positived) ──

console.log('\n── REGRESSION 5: Short/empty chapters skipped ──');
{
  const resolvedChapters = [
    { chapter_number: 1, title: 'Epigraph', content_md: 'Short.', __exportResolved: true },
    { chapter_number: 2, title: 'Clean', content_md: CLEAN_CHAPTER_1, __exportResolved: true },
  ];

  const report = await runPreExportSafetyGate(resolvedChapters, {
    project: { project_type: 'anthology', genre: 'literary fiction' },
  });

  assert(report.blocked === false, 'Export NOT blocked');
  assert(report.passed.some(p => p.skipped), 'Short chapter was skipped, not scanned');
}

// ── REGRESSION 6: Extracted (4).docx Chapter 2 if available ──

console.log('\n── REGRESSION 6: Extracted (4).docx Chapter 2 ──');
{
  const extractedPath = resolve(__dirname, '..', 'smoke-test-output', 'live-safety-enforcement-hardfix', 'chapter-2-extracted.txt');
  if (existsSync(extractedPath)) {
    const ch2Text = readFileSync(extractedPath, 'utf8');
    const resolvedChapters = [
      { chapter_number: 2, title: "The Patron's Palette", content_md: ch2Text, __exportResolved: true },
    ];

    const report = await runPreExportSafetyGate(resolvedChapters, {
      project: { project_type: 'anthology', genre: 'literary fiction' },
    });

    assert(report.blocked === true, 'Export BLOCKED for real extracted Ch.2');
    assert(report.hardFailures[0]?.processLeakCount > 0, `Real Ch.2 has process leaks (${report.hardFailures[0]?.processLeakCount})`);
    assert(report.hardFailures[0]?.contaminationCount > 0, `Real Ch.2 has contamination (${report.hardFailures[0]?.contaminationCount})`);
  } else {
    console.log('  ⏭️ SKIP: No extracted Chapter 2 file. Run extract-and-scan.mjs first.');
  }
}

// ── REGRESSION 7: False North excerpt doesn't block export ──────

console.log('\n── REGRESSION 7: False North excerpt does not block export ──');
{
  const text = `"Twelve hours of daylight left. We need to move."
"We move when we're ready," she said.`;
  const resolvedChapters = [
    { chapter_number: 1, title: 'Clean', content_md: text, __exportResolved: true },
  ];

  const report = await runPreExportSafetyGate(resolvedChapters, {
    project: { project_type: 'anthology', genre: 'literary fiction' },
  });

  assert(report.blocked === false, 'Export NOT blocked by False North excerpt');
  assert(report.hardFailures.length === 0, 'No hard failures for False North excerpt');
}

// ── SUMMARY ──

console.log(`\n${'='.repeat(60)}`);
console.log(`LIVE EXPORT SAFETY REGRESSION: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'='.repeat(60)}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All live export regression checks passed! ✅');
  process.exit(0);
}
