/**
 * Live manuscript proof — runs unifiedProseRefinement against extracted text
 * from Digital Equity Tribunal 2 to show real defect detection and repair.
 */
import { readFileSync } from 'fs';
import { runUnifiedProseRefinement, detectEssayImbalance } from '../../src/lib/unifiedProseRefinement.js';

const manuscriptPath = 'smoke-test-output/live-safety-enforcement-hardfix/extracted-full-text.txt';
const fullText = readFileSync(manuscriptPath, 'utf8');

// Extract chapters (split on "Chapter N:" pattern)
const chapters = fullText.split(/\n(?=Chapter \d+:)/);

console.log(`\n═══ LIVE MANUSCRIPT PROOF ═══`);
console.log(`Total chapters found: ${chapters.length}`);
console.log(`Total manuscript length: ${fullText.length} chars\n`);

// Run detect-only on the first chapter to show metrics without mutating
const ch1 = chapters[0];
console.log(`── Chapter 1: detect-only ──`);
const detectResult = runUnifiedProseRefinement({
  text: ch1,
  chapter: 1,
  mode: 'detect-only',
  project: { genre: 'fiction' },
});
console.log(`  Word count: ${detectResult.beforeMetrics.wordCount}`);
console.log(`  Slop total: ${detectResult.beforeMetrics.slopTotal}`);
console.log(`  Malformed count: ${detectResult.beforeMetrics.malformedCount}`);
console.log(`  Dialogue issues: ${detectResult.beforeMetrics.dialogueIssueCount}`);
console.log(`  Text unchanged: ${!detectResult.changed}`);
console.log(`  Repairs detected (but not applied): ${detectResult.repairs.length}`);
console.log(`  Warnings: ${detectResult.warnings.length}`);

// Run standard on chapter 1 to show actual repairs
console.log(`\n── Chapter 1: standard mode ──`);
const standardResult = runUnifiedProseRefinement({
  text: ch1,
  chapter: 1,
  mode: 'standard',
  project: { genre: 'fiction' },
});
console.log(`  Changed: ${standardResult.changed}`);
console.log(`  Repairs applied: ${standardResult.repairs.length}`);
console.log(`  Blocked: ${standardResult.blocked}`);
console.log(`  Warnings: ${standardResult.warnings.length}`);
console.log(`  Before slop: ${standardResult.beforeMetrics.slopTotal}`);
console.log(`  After slop: ${standardResult.afterMetrics.slopTotal}`);
if (standardResult.repairs.length > 0) {
  console.log(`\n  Repair details (first 10):`);
  for (const r of standardResult.repairs.slice(0, 10)) {
    console.log(`    [${r.rule}] "${r.original}" → "${r.replacement}"`);
  }
}

// Run essay-vs-scene on the full manuscript
console.log(`\n── Full manuscript: essay-vs-scene balance ──`);
const essayResult = detectEssayImbalance(fullText, { genre: 'fiction' });
console.log(`  Essay phrases: ${essayResult.essayPhraseCount}`);
console.log(`  Scene indicators: ${essayResult.sceneIndicatorCount}`);
console.log(`  Balance score: ${essayResult.balanceScore}`);
if (essayResult.warnings.length > 0) {
  console.log(`  Warnings:`);
  for (const w of essayResult.warnings) {
    console.log(`    ⚠ ${w}`);
  }
}

// Scan specific lines for known defects
console.log(`\n── Known defect scan ──`);
const defects = [];
const lines = fullText.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/\bWas\s+was\b/i.test(line)) defects.push({ line: i + 1, type: 'duplicate-word', snippet: line.substring(line.indexOf('Was was'), line.indexOf('Was was') + 40) });
  if (/\be\.\s+[gG]\./i.test(line)) defects.push({ line: i + 1, type: 'spaced-abbreviation', snippet: 'e. g.' });
  if (/\bShe\s+were\b/i.test(line)) defects.push({ line: i + 1, type: 'SVA-error', snippet: 'She were' });
  if (/\bnot merely\b/i.test(line)) defects.push({ line: i + 1, type: 'forensic-phrase', snippet: 'not merely' });
  if (/Unity Supported Living/i.test(line)) defects.push({ line: i + 1, type: 'contamination', snippet: 'Unity Supported Living' });
  if (/\[SOURCE NEEDED\]/i.test(line)) defects.push({ line: i + 1, type: 'source-marker', snippet: '[SOURCE NEEDED]' });
  if (/\[TK\]/i.test(line)) defects.push({ line: i + 1, type: 'tk-marker', snippet: '[TK]' });
}
console.log(`  Total defects found in manuscript: ${defects.length}`);
for (const d of defects) {
  console.log(`    Line ${d.line}: [${d.type}] ${d.snippet}`);
}

// Run surface-only on chapter 2 to show export preflight behavior
if (chapters.length > 1) {
  console.log(`\n── Chapter 2: surface-only (export preflight) ──`);
  const surfaceResult = runUnifiedProseRefinement({
    text: chapters[1],
    chapter: 2,
    mode: 'surface-only',
    project: { genre: 'fiction' },
  });
  console.log(`  Changed: ${surfaceResult.changed}`);
  console.log(`  Repairs applied: ${surfaceResult.repairs.length}`);
  console.log(`  No slop repairs: ${!surfaceResult.repairs.some(r => r.rule && r.rule.startsWith('slop-'))}`);
  console.log(`  No recast repairs: ${!surfaceResult.repairs.some(r => r.rule === 'sentence-recast')}`);
}

console.log(`\n═══ LIVE MANUSCRIPT PROOF COMPLETE ═══\n`);
