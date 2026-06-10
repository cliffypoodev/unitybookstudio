#!/usr/bin/env node
/**
 * liveWeakNonfictionMicroRecastV2.mjs
 *
 * Three-way comparison stress test:
 *   Version A: Original weak nonfiction (baseline)
 *   Version B: v4 chunk pipeline (expected: skip/block)
 *   Version C: v5 deterministic cleanup + micro-recast (expected: improve)
 *
 * Output: smoke-test-output/weak-nonfiction-micro-recast-v2/
 */

import {
  runAntiChatbotRecastPipeline,
  VERSION,
} from '../../src/lib/antiChatbotRecastPipeline.js';

import {
  analyzeProseTexture,
  countChatbotPatterns,
} from '../../src/lib/antiChatbotProse.js';

import {
  detectMarkdownHeadings,
} from '../../src/lib/recastModelRouting.js';

import {
  detectNonfictionWeaknesses,
  runNonfictionDeterministicCleanup,
  runNonfictionMicroRecastPipeline,
} from '../../src/lib/nonfictionAntiChatbotCleanup.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = __dirname;

// ── Weak nonfiction sample (same as v1 stress test) ──
const WEAK_NF = `## The Quiet Crisis of Municipal Water Infrastructure

It felt like the kind of problem that could wait. For decades, municipal water systems across the American Midwest seemed to function well enough, delivering clean water to millions of households without attracting much public attention. Moreover, the systems appeared to be holding up despite their age. City officials noticed that maintenance costs were rising, but they realized that confronting the full scope of the problem would require political will that simply did not exist.

Furthermore, the scale of underinvestment was staggering. According to the American Society of Civil Engineers' 2021 Infrastructure Report Card, the nation's drinking water infrastructure received a grade of C-minus, with an estimated funding gap of $434 billion over the next twenty years (ASCE, 2021). It is important to note that this figure represents only federal and state-level estimates.

## The Human Cost of Deferred Maintenance

The consequences of this neglect were deeply felt across communities. Residents in Flint, Michigan watched their tap water turn brown and wondered whether the crisis would ever be resolved. They seemed to understand, on some fundamental level, that the system had failed them. The emotional toll was significant. Additionally, the health impacts were severe. Blood lead levels in children under six rose by 2.4 percentage points (Hanna-Attisha et al., 2016).

## Structural Barriers to Reform

The fundamental challenge felt almost insurmountable. Municipal water utilities operate within a web of regulatory, financial, and political constraints that make comprehensive reform difficult. Furthermore, the fragmented nature of water governance — with over 50,000 community water systems — means that no single policy intervention can address the problem.

A recent analysis found that consolidation could reduce per-household costs by 18 to 34 percent (Kearney & Liu, 2023). However, political resistance remained fierce. Local officials seemed to view consolidation as a loss of autonomy. Additionally, the workforce pipeline was drying up.`;

const nfProfile = { genre: 'nonfiction', book_type: 'nonfiction', project_type: 'nonfiction' };

// ── Helpers ──
function countWords(t) { return String(t || '').split(/\s+/).filter(Boolean).length; }
function countEssayBot(t) { return (t.match(/\b(?:Moreover|Furthermore|Additionally)\b|It is important to note|It should be understood|This shows that|This highlights|In today's world/gi) || []).length; }
function countFilterVerbs(t) { return (t.match(/\b(?:felt|seemed|appeared|noticed|realized|wondered|watched|understood)\b/gi) || []).length; }
function countCitations(t) { return (t.match(/\([^)]*\d{4}[^)]*\)/g) || []).length; }

// ── Ollama helper ──
async function callOllama(prompt, model = 'prose-recast-polisher', temp = 0.4) {
  const url = 'http://127.0.0.1:11434/api/generate';
  const body = JSON.stringify({
    model,
    prompt,
    stream: false,
    options: { temperature: temp, num_predict: 2048 },
  });
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const data = await resp.json();
  let text = data.response || '';
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/<\/think>/gi, '');
  text = text.replace(/\\boxed\{[^}]*\}/g, '');
  return text.trim();
}

async function callLLMForModel(prompt, model, temp) {
  process.stdout.write(`    [Ollama] Calling ${model} (temp ${temp})...`);
  const start = Date.now();
  const result = await callOllama(prompt, model, temp);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const words = countWords(result);
  console.log(` Done in ${elapsed}s | ${words} words`);
  return result;
}

// ── Metric Snapshot ──
function takeSnapshot(text, label) {
  const metrics = analyzeProseTexture(text);
  const patterns = countChatbotPatterns(text);
  return {
    label,
    compositeScore: metrics.compositeScore,
    filterVerbs: countFilterVerbs(text),
    filterVerbDensity: metrics.filterVerbDensity,
    essayBotTransitions: countEssayBot(text),
    chatbotPatterns: patterns.total,
    headings: detectMarkdownHeadings(text),
    citations: countCitations(text),
    words: countWords(text),
    text,
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('WEAK NONFICTION MICRO-RECAST V2 STRESS TEST');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Pipeline: ${VERSION}`);
  console.log();

  // ── VERSION A: Original ──
  const snapA = takeSnapshot(WEAK_NF, 'A: Original');
  console.log('── VERSION A: Original ──');
  console.log(`  Composite Score: ${snapA.compositeScore}`);
  console.log(`  Filter Verbs: ${snapA.filterVerbs}`);
  console.log(`  Essay-Bot Transitions: ${snapA.essayBotTransitions}`);
  console.log(`  Chatbot Patterns: ${snapA.chatbotPatterns}`);
  console.log(`  Headings: ${snapA.headings}`);
  console.log(`  Citations: ${snapA.citations}`);
  console.log(`  Words: ${snapA.words}`);
  console.log();

  // ── VERSION B: v5 full pipeline (with skipNonfictionCleanup to simulate v4 chunk behavior) ──
  console.log('── VERSION B: v4-style Chunk Pipeline (skip nonfiction cleanup) ──');
  const resultB = await runAntiChatbotRecastPipeline(WEAK_NF, nfProfile, {
    callLLM: (p) => callLLMForModel(p, 'prose-recast-polisher', 0.4),
    callLLMForModel,
    skipNonfictionCleanup: true,
    recastThreshold: 70,
    skipThreshold: 80,
  });
  const snapB = takeSnapshot(resultB.text, 'B: v4 Chunk Pipeline');
  console.log(`  Composite Score: ${snapB.compositeScore} (${snapB.compositeScore > snapA.compositeScore ? '+' : ''}${snapB.compositeScore - snapA.compositeScore})`);
  console.log(`  Filter Verbs: ${snapB.filterVerbs} (${snapB.filterVerbs - snapA.filterVerbs})`);
  console.log(`  Essay-Bot Transitions: ${snapB.essayBotTransitions} (${snapB.essayBotTransitions - snapA.essayBotTransitions})`);
  console.log(`  Chatbot Patterns: ${snapB.chatbotPatterns} (${snapB.chatbotPatterns - snapA.chatbotPatterns})`);
  console.log(`  Headings: ${snapB.headings}`);
  console.log(`  Citations: ${snapB.citations}`);
  console.log(`  Words: ${snapB.words} (ratio: ${Math.round(snapB.words / snapA.words * 100)}%)`);
  console.log(`  Report: recast=${resultB.report.chunksRecast} skipped=${resultB.report.chunksSkipped} failed=${resultB.report.chunksFailed}`);
  console.log();

  // ── VERSION C: v5 deterministic cleanup + micro-recast ──
  console.log('── VERSION C: v5 Deterministic Cleanup + Micro-Recast ──');
  const resultC = await runAntiChatbotRecastPipeline(WEAK_NF, nfProfile, {
    callLLM: (p) => callLLMForModel(p, 'prose-recast-polisher', 0.4),
    callLLMForModel,
    recastThreshold: 75,
    skipThreshold: 85,
  });
  const snapC = takeSnapshot(resultC.text, 'C: v5 Cleanup + Micro-Recast');

  console.log(`  Composite Score: ${snapC.compositeScore} (${snapC.compositeScore > snapA.compositeScore ? '+' : ''}${snapC.compositeScore - snapA.compositeScore})`);
  console.log(`  Filter Verbs: ${snapC.filterVerbs} (${snapC.filterVerbs - snapA.filterVerbs})`);
  console.log(`  Essay-Bot Transitions: ${snapC.essayBotTransitions} (${snapC.essayBotTransitions - snapA.essayBotTransitions})`);
  console.log(`  Chatbot Patterns: ${snapC.chatbotPatterns} (${snapC.chatbotPatterns - snapA.chatbotPatterns})`);
  console.log(`  Headings: ${snapC.headings}`);
  console.log(`  Citations: ${snapC.citations}`);
  console.log(`  Words: ${snapC.words} (ratio: ${Math.round(snapC.words / snapA.words * 100)}%)`);

  // Deterministic cleanup details
  if (resultC.report.deterministicCleanup) {
    const dc = resultC.report.deterministicCleanup;
    console.log(`  Deterministic Cleanup: applied=${dc.applied}`);
    console.log(`    Essay-bot removed: ${dc.essayBotRemoved}`);
    console.log(`    Filter verbs reduced: ${dc.filterVerbsReduced}`);
    console.log(`    Openings fixed: ${dc.openingsFixed}`);
    console.log(`    Not-just reduced: ${dc.notJustReduced}`);
  }

  // Micro-recast details
  if (resultC.report.microRecastReport) {
    const mr = resultC.report.microRecastReport;
    console.log(`  Micro-Recast: units=${mr.unitsAnalyzed} eligible=${mr.unitsEligible} recast=${mr.unitsRecast} failed=${mr.unitsFailed} skipped=${mr.unitsSkipped}`);
    for (const ud of (mr.unitDetails || [])) {
      console.log(`    Unit ${ud.index}: ${ud.action} | ${ud.reason}${ud.beforeScore != null ? ` | score: ${ud.beforeScore}→${ud.afterScore ?? '—'}` : ''}`);
    }
  }
  console.log();

  // ── Three-Way Comparison Table ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('THREE-WAY COMPARISON');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ${'Metric'.padEnd(25)} ${'A: Original'.padEnd(15)} ${'B: v4 Chunk'.padEnd(15)} ${'C: v5 Cleanup'.padEnd(15)}`);
  console.log(`  ${'─'.repeat(25)} ${'─'.repeat(15)} ${'─'.repeat(15)} ${'─'.repeat(15)}`);
  console.log(`  ${'Composite Score'.padEnd(25)} ${String(snapA.compositeScore).padEnd(15)} ${String(snapB.compositeScore).padEnd(15)} ${String(snapC.compositeScore).padEnd(15)}`);
  console.log(`  ${'Filter Verbs'.padEnd(25)} ${String(snapA.filterVerbs).padEnd(15)} ${String(snapB.filterVerbs).padEnd(15)} ${String(snapC.filterVerbs).padEnd(15)}`);
  console.log(`  ${'Essay-Bot Transitions'.padEnd(25)} ${String(snapA.essayBotTransitions).padEnd(15)} ${String(snapB.essayBotTransitions).padEnd(15)} ${String(snapC.essayBotTransitions).padEnd(15)}`);
  console.log(`  ${'Chatbot Patterns'.padEnd(25)} ${String(snapA.chatbotPatterns).padEnd(15)} ${String(snapB.chatbotPatterns).padEnd(15)} ${String(snapC.chatbotPatterns).padEnd(15)}`);
  console.log(`  ${'Headings'.padEnd(25)} ${String(snapA.headings).padEnd(15)} ${String(snapB.headings).padEnd(15)} ${String(snapC.headings).padEnd(15)}`);
  console.log(`  ${'Citations'.padEnd(25)} ${String(snapA.citations).padEnd(15)} ${String(snapB.citations).padEnd(15)} ${String(snapC.citations).padEnd(15)}`);
  console.log(`  ${'Words'.padEnd(25)} ${String(snapA.words).padEnd(15)} ${String(snapB.words).padEnd(15)} ${String(snapC.words).padEnd(15)}`);
  console.log();

  // ── Acceptance Checks ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('ACCEPTANCE CHECKS');
  console.log('═══════════════════════════════════════════════════════════════');
  const checks = [];

  const headingsOk = snapC.headings >= snapA.headings;
  checks.push({ name: 'Headings preserved', ok: headingsOk, detail: `${snapA.headings}→${snapC.headings}` });

  const citationsOk = snapC.citations >= snapA.citations;
  checks.push({ name: 'Citations preserved', ok: citationsOk, detail: `${snapA.citations}→${snapC.citations}` });

  const wordRatio = snapC.words / snapA.words;
  const wordRatioOk = wordRatio >= 0.85 && wordRatio <= 1.15;
  checks.push({ name: 'Word count in safe range', ok: wordRatioOk, detail: `${Math.round(wordRatio * 100)}%` });

  const essayBotImproved = snapC.essayBotTransitions < snapA.essayBotTransitions;
  checks.push({ name: 'Essay-bot transitions decreased', ok: essayBotImproved, detail: `${snapA.essayBotTransitions}→${snapC.essayBotTransitions}` });

  const filterVerbImproved = snapC.filterVerbs <= snapA.filterVerbs;
  checks.push({ name: 'Filter verbs decreased or stable', ok: filterVerbImproved, detail: `${snapA.filterVerbs}→${snapC.filterVerbs}` });

  const chatbotStable = snapC.chatbotPatterns <= snapA.chatbotPatterns;
  checks.push({ name: 'Chatbot patterns stable or decreased', ok: chatbotStable, detail: `${snapA.chatbotPatterns}→${snapC.chatbotPatterns}` });

  const scoreImproved = snapC.compositeScore >= snapA.compositeScore;
  checks.push({ name: 'Composite improved or stable', ok: scoreImproved, detail: `${snapA.compositeScore}→${snapC.compositeScore}` });

  const deterministicApplied = resultC.report.deterministicCleanup?.applied === true;
  checks.push({ name: 'Deterministic cleanup applied', ok: deterministicApplied, detail: `applied=${deterministicApplied}` });

  const versionOk = resultC.report.pipelineVersion.includes('v5.0');
  checks.push({ name: 'Pipeline version is v5.0', ok: versionOk, detail: resultC.report.pipelineVersion });

  for (const c of checks) {
    console.log(`  ${c.ok ? '✅' : '❌'} ${c.name}: ${c.detail}`);
  }

  const allPass = checks.every(c => c.ok);
  console.log();
  console.log(`  OVERALL: ${allPass ? '✅ ALL CHECKS PASS' : '❌ SOME CHECKS FAILED'}`);
  console.log();

  // ── Save Results ──
  const results = {
    timestamp: new Date().toISOString(),
    pipelineVersion: VERSION,
    snapshots: { A: snapA, B: snapB, C: snapC },
    reportB: resultB.report,
    reportC: resultC.report,
    checks,
    allPass,
  };

  // Remove text from snapshots for JSON (too large)
  delete results.snapshots.A.text;
  delete results.snapshots.B.text;
  delete results.snapshots.C.text;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'stress-test-v2-results.json'), JSON.stringify(results, null, 2));

  // Save the v5 output text
  fs.writeFileSync(path.join(OUTPUT_DIR, 'v5-output-text.md'), snapC.text || resultC.text);

  console.log(`  Results saved to: ${OUTPUT_DIR}/`);
}

main().catch(err => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
