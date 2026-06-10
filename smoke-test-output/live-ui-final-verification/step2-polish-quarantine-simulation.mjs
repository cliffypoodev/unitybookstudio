// =============================================================
// step2-polish-quarantine-simulation.mjs
//
// Simulates the pre-polish safety gate exactly as handleManuscriptPolish()
// runs it in ProjectStudio.jsx. Uses the same runManuscriptSafetyGate()
// function on each chapter to verify quarantine behavior.
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

// Read the full extracted text from (4).docx
const fullText = readFileSync(
  resolve(projectRoot, 'smoke-test-output', 'live-safety-enforcement-hardfix', 'extracted-full-text.txt'),
  'utf8'
);

// Split into chapters
const chapterParts = fullText.split(/(?=Chapter \d+)/i).filter(p => p.trim().length > 50);

const simulatedChapters = chapterParts.map((part, i) => {
  const titleMatch = part.match(/^(Chapter\s+\d+[^\n]*)/i);
  const title = titleMatch ? titleMatch[1].trim() : `Section ${i}`;
  const body = titleMatch ? part.slice(titleMatch[0].length).trim() : part.trim();
  const chapterNumMatch = title.match(/\d+/);
  const chapterNumber = chapterNumMatch ? parseInt(chapterNumMatch[0]) : i + 1;
  return { chapter_number: chapterNumber, title, content: body };
});

console.log(`[STEP2] Loaded ${simulatedChapters.length} chapters from extracted text`);

// Simulate the pre-polish safety gate loop from handleManuscriptPolish()
const project = { project_type: 'anthology', genre: 'literary fiction' };
const safetyRejected = [];
const safeLoaded = [];
const gateEntries = [];

for (const f of simulatedChapters) {
  if (!f.content || f.content.length < 100) {
    safeLoaded.push(f);
    gateEntries.push({
      chapterNumber: f.chapter_number,
      title: f.title,
      ok: true,
      action: 'SKIP',
      skipped: true,
      reason: 'Too short',
    });
    continue;
  }

  const gate = runManuscriptSafetyGate(f.content, {
    project,
    chapter: f,
    stage: 'pre-polish',
  });

  const entry = {
    chapterNumber: f.chapter_number,
    title: f.title,
    ok: gate.ok,
    action: gate.recommendedAction,
    processLeaks: gate.processLeaks.matches.length,
    contamination: gate.contamination.matches.length,
    malformed: gate.malformed.matches.length,
    reasons: gate.reasons,
  };

  gateEntries.push(entry);

  if (gate.ok) {
    safeLoaded.push(f);
    console.log(`  ✅ Ch.${f.chapter_number} PASS — eligible for polish`);
  } else {
    safetyRejected.push({
      chapter: f,
      action: gate.recommendedAction,
      reasons: gate.reasons,
    });
    console.error(`  🚫 Ch.${f.chapter_number} REJECTED (${gate.recommendedAction}): ${gate.reasons.join('; ')}`);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`[STEP2] POLISH QUARANTINE RESULT`);
console.log(`${'='.repeat(60)}`);
console.log(`Rejected: ${safetyRejected.length} chapter(s)`);
console.log(`Eligible: ${safeLoaded.length} chapter(s)`);
console.log(`Total: ${simulatedChapters.length} chapter(s)`);

// Check Chapter 2 specifically
const ch2Rejected = safetyRejected.find(r => r.chapter.chapter_number === 2);
const ch2Entry = gateEntries.find(e => e.chapterNumber === 2);

if (ch2Rejected) {
  console.log(`\n✅ Chapter 2 CORRECTLY REJECTED by polish quarantine`);
  console.log(`   Action: ${ch2Rejected.action}`);
  console.log(`   Reasons: ${ch2Rejected.reasons.join('; ')}`);
} else {
  console.error(`\n❌ Chapter 2 was NOT rejected — QUARANTINE FAILURE`);
}

// Simulate the post-quarantine behavior
if (safetyRejected.length > 0) {
  console.log(`\nSimulated toast.error():`);
  console.log(`  "Safety Gate: ${safetyRejected.length} chapter(s) rejected (process leaks or contamination).`);
  console.log(`   Rejected: ${safetyRejected.map(r => 'Ch.' + r.chapter.chapter_number).join(', ')}.`);
  console.log(`   These chapters will NOT be polished. Regenerate them first."`);
}

// Write report
const reportLines = [
  '# 02 — Polish Quarantine Verification',
  '',
  `**Report:** Simulated pre-polish safety gate (same as handleManuscriptPolish)`,
  `**Date:** ${new Date().toISOString().split('T')[0]}`,
  `**Verdict:** ${ch2Rejected ? '✅ Chapter 2 CORRECTLY QUARANTINED' : '❌ Chapter 2 NOT QUARANTINED — FAILURE'}`,
  '',
  '---',
  '',
  '## Quarantine Results',
  '',
  '| Metric | Value |',
  '|--------|-------|',
  `| Total chapters | ${simulatedChapters.length} |`,
  `| Rejected (quarantined) | ${safetyRejected.length} |`,
  `| Eligible for polish | ${safeLoaded.length} |`,
  '',
  '---',
  '',
  '## Per-Chapter Gate Results',
  '',
  '| Chapter | Title | OK | Action | Process Leaks | Contamination | Malformed |',
  '|---------|-------|-----|--------|---------------|---------------|-----------|',
  ...gateEntries.map(e =>
    `| ${e.chapterNumber} | ${(e.title || '').substring(0, 30)} | ${e.ok ? '✅' : '🚫'} | ${e.action} | ${e.processLeaks || 0} | ${e.contamination || 0} | ${e.malformed || 0} |`
  ),
  '',
  '---',
  '',
  '## Chapter 2 Detail',
  '',
];

if (ch2Entry) {
  reportLines.push(`| Metric | Value |`);
  reportLines.push(`|--------|-------|`);
  reportLines.push(`| Gate result (ok) | **${ch2Entry.ok}** |`);
  reportLines.push(`| Recommended action | **${ch2Entry.action}** |`);
  reportLines.push(`| Process leaks | **${ch2Entry.processLeaks}** |`);
  reportLines.push(`| Contamination | **${ch2Entry.contamination}** |`);
  reportLines.push(`| Malformed | **${ch2Entry.malformed}** |`);
  reportLines.push('');
  if (ch2Entry.reasons?.length) {
    reportLines.push('### Reasons');
    reportLines.push('');
    for (const r of ch2Entry.reasons) reportLines.push(`- ${r}`);
  }
}

reportLines.push('');
reportLines.push('---');
reportLines.push('');
reportLines.push('## Quarantine Behavior');
reportLines.push('');
reportLines.push('In `handleManuscriptPolish()` (ProjectStudio.jsx), the quarantine works as follows:');
reportLines.push('');
reportLines.push('1. All chapters are loaded and scanned with `runManuscriptSafetyGate()`');
reportLines.push('2. Rejected chapters are moved to `safetyRejected` array');
reportLines.push('3. `loaded` array is replaced with only `safeLoaded` chapters');
reportLines.push('4. Polish transforms run ONLY on safe chapters');
reportLines.push('5. Rejected chapters keep their original (contaminated) content unchanged');
reportLines.push('6. Toast notification reports which chapters were rejected');
reportLines.push('');
reportLines.push('> [!IMPORTANT]');
reportLines.push('> Chapter 2 content is preserved but NOT polished. The user must regenerate it.');

writeFileSync(resolve(__dirname, '02-polish-quarantine-verification.md'), reportLines.join('\n'));

console.log(`\n[STEP2] Report written: 02-polish-quarantine-verification.md`);
process.exit(ch2Rejected ? 0 : 1);
