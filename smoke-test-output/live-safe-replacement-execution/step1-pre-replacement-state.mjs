// =============================================================
// step1-pre-replacement-state.mjs
//
// STEP 1: Confirm export is BLOCKED before replacement
// STEP 2: Confirm repaired text passes safety gate
//
// Uses real extracted (4).docx content and the same safety gate
// modules as the live app.
// =============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..', '..');

const { runManuscriptSafetyGate } = await import(
  resolve(projectRoot, 'src', 'lib', 'manuscriptSafetyGate.js')
);
const { runPreExportSafetyGate, formatExportSafetyFailure } = await import(
  resolve(projectRoot, 'src', 'lib', 'exportSafetyGate.js')
);

// ── Load data ──
const fullText = readFileSync(
  resolve(projectRoot, 'smoke-test-output', 'live-safety-enforcement-hardfix', 'extracted-full-text.txt'),
  'utf8'
);
const contaminatedCh2 = readFileSync(
  resolve(projectRoot, 'smoke-test-output', 'live-safety-enforcement-hardfix', 'chapter-2-extracted.txt'),
  'utf8'
);
const repairedCh2 = readFileSync(
  resolve(projectRoot, 'smoke-test-output', 'live-ui-final-verification', 'chapter-2-repaired.md'),
  'utf8'
);

// Split full text into chapters
const chapterParts = fullText.split(/(?=Chapter \d+)/i).filter(p => p.trim().length > 50);
const chapters = chapterParts.map((part, i) => {
  const titleMatch = part.match(/^(Chapter\s+\d+[^\n]*)/i);
  const title = titleMatch ? titleMatch[1].trim() : `Section ${i}`;
  const body = titleMatch ? part.slice(titleMatch[0].length).trim() : part.trim();
  const numMatch = title.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0]) : i + 1;
  return { id: `ch-${num}`, chapter_number: num, title, content_md: body };
});

console.log(`[STEP1] Loaded ${chapters.length} chapters from extracted text`);
console.log(`[STEP1] Contaminated Ch.2: ${contaminatedCh2.length} chars`);
console.log(`[STEP1] Repaired Ch.2: ${repairedCh2.length} chars, ${repairedCh2.split(/\s+/).filter(Boolean).length} words`);

// ════════════════════════════════════════════════════════════
// STEP 1: Pre-replacement export gate (MUST be blocked)
// ════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`STEP 1: Pre-Replacement Export Safety Gate`);
console.log(`${'═'.repeat(60)}\n`);

const preReport = runPreExportSafetyGate(chapters, {
  project: { project_type: 'anthology', title: 'Digital Equity Tribunal' },
  stage: 'pre-replacement-verification',
});

console.log(`  Blocked: ${preReport.blocked}`);
console.log(`  Hard Failures: ${preReport.hardFailures.length}`);
console.log(`  Warnings: ${preReport.warnings.length}`);
console.log(`  Passed: ${preReport.passed.length}`);

const ch2Failure = preReport.hardFailures.find(f => f.chapterNumber === 2);
if (ch2Failure) {
  console.log(`\n  ✅ Chapter 2 CORRECTLY BLOCKED:`);
  console.log(`     Action: ${ch2Failure.recommendedAction}`);
  console.log(`     Process leaks: ${ch2Failure.processLeakCount}`);
  console.log(`     Contamination: ${ch2Failure.contaminationCount}`);
  console.log(`     Malformed: ${ch2Failure.malformedCount}`);
  console.log(`     Snippets:`);
  for (const s of ch2Failure.snippets.slice(0, 5)) {
    console.log(`       [${s.type}] "${s.phrase}"`);
  }
} else {
  console.error(`\n  ❌ Chapter 2 NOT blocked — investigate before proceeding!`);
}

// Check specific canaries in contaminated text
const canaries = [
  'The opening is sharp, highly polished',
  'You have successfully executed',
  'The current trajectory is working exactly as planned',
  'Next Move',
  'Action Plan',
  'Unity Supported Living',
  'Unity Supported Living Services',
  'Unity Media',
  'Unity Media Solutions',
  'care documentation',
  'compliance documentation',
  'You was',
  'Was was',
];

console.log(`\n  Canary check in contaminated Chapter 2:`);
const canariesFound = [];
for (const c of canaries) {
  const found = contaminatedCh2.toLowerCase().includes(c.toLowerCase());
  if (found) canariesFound.push(c);
  console.log(`    ${found ? '⚠️  PRESENT' : '   absent'}: "${c}"`);
}

// ════════════════════════════════════════════════════════════
// STEP 2: Verify repaired text passes safety gate
// ════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`STEP 2: Repaired Chapter 2 Safety Gate`);
console.log(`${'═'.repeat(60)}\n`);

const repairedGate = runManuscriptSafetyGate(repairedCh2, {
  project: { project_type: 'fiction' },
  stage: 'pre-safe-replacement',
});

console.log(`  Gate result: ok=${repairedGate.ok}, action=${repairedGate.recommendedAction}`);
console.log(`  Process leaks: ${repairedGate.processLeaks.matches.length}`);
console.log(`  Contamination: ${repairedGate.contamination.matches.length}`);
console.log(`  Malformed: ${repairedGate.malformed.matches.length}`);

// Verify repaired text opens with fiction prose
const firstLine = repairedCh2.split('\n')[0].trim();
console.log(`  First line: "${firstLine.substring(0, 80)}…"`);
console.log(`  Opens with fiction prose: ${firstLine.startsWith('The turpentine') ? '✅ YES' : '❌ NO'}`);
console.log(`  Contains Darius: ${repairedCh2.includes('Darius') ? '✅ YES' : '❌ NO'}`);
console.log(`  Contains Julian: ${repairedCh2.includes('Julian') ? '✅ YES' : '❌ NO'}`);

// Verify no canaries in repaired text
console.log(`\n  Canary check in repaired Chapter 2:`);
let repairedCanaryFailures = 0;
for (const c of canaries) {
  const found = repairedCh2.toLowerCase().includes(c.toLowerCase());
  if (found) { repairedCanaryFailures++; console.log(`    ❌ PRESENT: "${c}"`); }
  else console.log(`    ✅ absent: "${c}"`);
}

// ════════════════════════════════════════════════════════════
// Write 01-pre-replacement-state.md
// ════════════════════════════════════════════════════════════
const report1 = [
  '# 01 — Pre-Replacement State',
  '',
  `**Date:** ${new Date().toISOString().split('T')[0]}`,
  `**Verdict:** ${preReport.blocked ? '✅ Export CORRECTLY BLOCKED before replacement' : '❌ Export NOT blocked — investigate'}`,
  '',
  '---',
  '',
  '## Export Safety Gate (Pre-Replacement)',
  '',
  '| Metric | Value |',
  '|--------|-------|',
  `| Blocked | **${preReport.blocked}** |`,
  `| Hard Failures | **${preReport.hardFailures.length}** |`,
  `| Warnings | ${preReport.warnings.length} |`,
  `| Passed | ${preReport.passed.length} |`,
  `| Total Chapters | ${preReport.totalChapters} |`,
  '',
];

if (ch2Failure) {
  report1.push('## Chapter 2 Hard Failure Detail', '');
  report1.push('| Metric | Value |');
  report1.push('|--------|-------|');
  report1.push(`| Action | **${ch2Failure.recommendedAction}** |`);
  report1.push(`| Process leaks | **${ch2Failure.processLeakCount}** |`);
  report1.push(`| Contamination | **${ch2Failure.contaminationCount}** |`);
  report1.push(`| Malformed | **${ch2Failure.malformedCount}** |`);
  report1.push('');
  report1.push('### Snippets');
  report1.push('');
  for (const s of ch2Failure.snippets) {
    report1.push(`- [${s.type}] \`${s.phrase}\` → ${(s.snippet || '').substring(0, 80)}`);
  }
  report1.push('');
}

report1.push('## Canary Phrases in Contaminated Chapter 2', '');
report1.push('| Canary | Present? |');
report1.push('|--------|---------|');
for (const c of canaries) {
  const present = canariesFound.includes(c);
  report1.push(`| "${c}" | ${present ? '⚠️ YES' : '✅ No'} |`);
}
report1.push('');
report1.push('---');
report1.push('');
report1.push('## Repaired Chapter 2 Pre-Validation', '');
report1.push('| Metric | Value |');
report1.push('|--------|-------|');
report1.push(`| Gate ok | **${repairedGate.ok}** |`);
report1.push(`| Action | **${repairedGate.recommendedAction}** |`);
report1.push(`| Process leaks | **${repairedGate.processLeaks.matches.length}** |`);
report1.push(`| Contamination | **${repairedGate.contamination.matches.length}** |`);
report1.push(`| Malformed | **${repairedGate.malformed.matches.length}** |`);
report1.push(`| Characters | ${repairedCh2.length.toLocaleString()} |`);
report1.push(`| Words | ${repairedCh2.split(/\s+/).filter(Boolean).length.toLocaleString()} |`);
report1.push(`| Opens with prose | ${firstLine.startsWith('The turpentine') ? '✅' : '❌'} |`);
report1.push(`| Contains Darius | ${repairedCh2.includes('Darius') ? '✅' : '❌'} |`);
report1.push(`| Contains Julian | ${repairedCh2.includes('Julian') ? '✅' : '❌'} |`);
report1.push(`| Canary failures | **${repairedCanaryFailures}** |`);

writeFileSync(resolve(__dirname, '01-pre-replacement-state.md'), report1.join('\n'));
console.log(`\n[STEP1] Report written: 01-pre-replacement-state.md`);

// ════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════
const step1OK = preReport.blocked && ch2Failure;
const step2OK = repairedGate.ok && repairedCanaryFailures === 0;

console.log(`\n${'═'.repeat(60)}`);
console.log(`STEP 1: ${step1OK ? '✅ PASS' : '❌ FAIL'} — export blocked, Ch.2 is hard failure`);
console.log(`STEP 2: ${step2OK ? '✅ PASS' : '❌ FAIL'} — repaired text passes gate, 0 canaries`);
console.log(`${'═'.repeat(60)}`);

process.exit(step1OK && step2OK ? 0 : 1);
