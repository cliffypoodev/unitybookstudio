/**
 * liveWeakNonfictionHeadingCitationStress.mjs
 *
 * Stress test: Run a deliberately WEAK nonfiction sample through the v4
 * routing pipeline. The sample has headings, citations, essay-bot transitions,
 * filter verbs, and vague abstractions — exactly the content that should
 * trigger recast while the heading/citation gates protect structure.
 *
 * Acceptance:
 *   - Headings must NOT decrease
 *   - Citations must NOT decrease
 *   - Quality should improve or stay stable
 *   - No invented claims
 *   - Routing should select prose-recast-polisher (nonfiction_authority)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const acpPath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const { analyzeProseTexture, countChatbotPatterns } = await import(acpPath);

const recastPath = join(process.cwd(), 'src/lib/antiChatbotRecastPipeline.js');
const { runAntiChatbotRecastPipeline, RECAST_MODE, VERSION } = await import(recastPath);

const routingPath = join(process.cwd(), 'src/lib/recastModelRouting.js');
const { detectMarkdownHeadings, detectSectionHeadings } = await import(routingPath);

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const RECAST_MODEL = 'prose-recast-polisher';
const POLISHER_MODEL = 'prose-polisher';
const TIMEOUT_MS = 600000;
const MAX_TOKENS = 4096;

const OUTPUT_DIR = join(process.cwd(), 'smoke-test-output/weak-nonfiction-heading-citation-stress');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── The Weak Nonfiction Sample ──────────────────────────────────────────────
// Deliberately includes:
//   - 4 markdown headings
//   - 3 citation-like parentheticals
//   - 5+ filter verbs (felt, noticed, realized, seemed, watched, wondered)
//   - 4+ essay-bot transitions (Moreover, Furthermore, Additionally, It is important)
//   - Vague abstraction-heavy paragraphs
//   - 1 bulleted list
//   - Multiple chatbot-adjacent patterns
const WEAK_NONFICTION_SAMPLE = `## The Quiet Crisis of Municipal Water Infrastructure

It felt like the kind of problem that could wait. For decades, municipal water systems across the American Midwest seemed to function well enough, delivering clean water to millions of households without attracting much public attention. Moreover, the systems appeared to be holding up despite their age. City officials noticed that maintenance costs were rising, but they realized that confronting the full scope of the problem would require political will that simply did not exist.

Furthermore, the scale of underinvestment was staggering. According to the American Society of Civil Engineers' 2021 Infrastructure Report Card, the nation's drinking water infrastructure received a grade of C-minus, with an estimated funding gap of $434 billion over the next twenty years (ASCE, 2021). It is important to note that this figure represents only federal and state-level estimates and does not capture the full extent of local deferred maintenance.

## The Human Cost of Deferred Maintenance

The consequences of this neglect were deeply felt across communities. Residents in Flint, Michigan watched their tap water turn brown and wondered whether the crisis would ever be resolved. They seemed to understand, on some fundamental level, that the system had failed them. The emotional toll was significant. A sense of betrayal pervaded the community. Additionally, the health impacts were severe. Blood lead levels in children under six rose by 2.4 percentage points between 2013 and 2015 in the most affected zip codes (Hanna-Attisha et al., 2016).

It is important to note that Flint was not an isolated case. Municipal water systems serving communities with populations under 50,000 face disproportionate challenges:

- Aging pipe networks installed between 1920 and 1960
- Limited tax bases unable to fund capital improvements
- Loss of institutional knowledge as experienced operators retire
- Regulatory compliance costs that consume operational budgets

Moreover, the problem seemed to be getting worse rather than better. Small utilities watched their reserves dwindle while federal grant programs remained inadequate to address the backlog.

## Structural Barriers to Reform

The fundamental challenge felt almost insurmountable. Municipal water utilities operate within a web of regulatory, financial, and political constraints that make comprehensive reform difficult. Furthermore, the fragmented nature of water governance in the United States — with over 50,000 community water systems regulated by the EPA — means that no single policy intervention can address the problem.

A recent analysis by the Brookings Institution found that consolidation of small water systems into regional authorities could reduce per-household costs by 18 to 34 percent while improving compliance rates (Kearney & Liu, 2023). However, political resistance to consolidation remained fierce. Local officials seemed to view consolidation as a loss of autonomy rather than a practical solution. They noticed that communities which had merged water systems often experienced short-term rate increases, even when long-term savings were substantial.

Additionally, the workforce pipeline was drying up. The average age of a water utility operator in the United States was 48, and roughly 37 percent of the workforce was expected to retire within the next decade. It is important to note that training a certified water plant operator takes approximately two to four years, meaning the replacement timeline does not align with the retirement wave.

## A Path Forward

The solutions felt both obvious and impossibly distant. Experts seemed to agree on the broad strokes: increased federal investment, regional consolidation where feasible, workforce development programs, and updated asset management practices. Moreover, the technology existed to address many of the technical challenges — smart meters, predictive maintenance algorithms, and advanced filtration systems were all commercially available.

Yet the gap between what was known and what was done remained vast. Communities watched their infrastructure age while political leaders wondered whether voters would support the rate increases necessary to fund improvements. The crisis was real, the data was clear, and the path forward was understood. What was missing was the political will to act.`;

// ── Counting Helpers ──
const FILTER_VERBS = ['felt', 'realized', 'noticed', 'watched', 'saw', 'heard', 'seemed', 'wondered', 'knew', 'understood'];
function countFilterVerbs(text) {
  let total = 0;
  for (const verb of FILTER_VERBS) {
    const re = new RegExp(`\\b${verb}\\b`, 'gi');
    total += (text.match(re) || []).length;
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  return { total, density: Math.round((total / (words / 1000)) * 10) / 10 };
}

function countCitations(text) {
  const academic = (text.match(/\([^)]*\d{4}[^)]*\)/g) || []).length;
  const bracket = (text.match(/\[\d+\]/g) || []).length;
  return academic + bracket;
}

function countHeadings(text) {
  return detectMarkdownHeadings(text) + detectSectionHeadings(text);
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

const ESSAY_BOT_PATTERN = /\b(?:Moreover|Furthermore|Additionally|It is important to note)\b/g;
function countEssayBotTransitions(text) {
  return (text.match(ESSAY_BOT_PATTERN) || []).length;
}

// ── Ollama ──
async function callOllama(prompt, model, temperature) {
  const messages = [{ role: 'user', content: prompt }];
  console.log(`    [Ollama] Calling ${model} (temp ${temperature})...`);
  const start = Date.now();

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { temperature, num_predict: MAX_TOKENS },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
  const data = await response.json();
  let text = data?.message?.content || '';
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/<\/think>/gi, '');
  text = text.replace(/\\boxed\{[^}]*\}/g, '');
  text = text.trim();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`    [Ollama] Done in ${elapsed}s | ${text.split(/\s+/).filter(Boolean).length} words`);
  return text;
}

// ── Main ──
async function runStressTest() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('WEAK NONFICTION HEADING/CITATION STRESS TEST');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Pipeline: ${VERSION}`);
  console.log();

  const nonfictionProfile = { genre: 'nonfiction', book_type: 'nonfiction', project_type: 'nonfiction' };

  // ── BEFORE metrics ──
  const beforeMetrics = analyzeProseTexture(WEAK_NONFICTION_SAMPLE);
  const beforePatterns = countChatbotPatterns(WEAK_NONFICTION_SAMPLE);
  const beforeFV = countFilterVerbs(WEAK_NONFICTION_SAMPLE);
  const beforeCitations = countCitations(WEAK_NONFICTION_SAMPLE);
  const beforeHeadings = countHeadings(WEAK_NONFICTION_SAMPLE);
  const beforeWords = countWords(WEAK_NONFICTION_SAMPLE);
  const beforeEssayBot = countEssayBotTransitions(WEAK_NONFICTION_SAMPLE);

  console.log('── BEFORE (Weak Sample) ──');
  console.log(`  Composite Score: ${beforeMetrics.compositeScore} ${beforeMetrics.grade}`);
  console.log(`  Filter Verbs: ${beforeFV.total} (${beforeFV.density}/1K)`);
  console.log(`  Chatbot Patterns: ${beforePatterns.total}`);
  console.log(`  Headings: ${beforeHeadings}`);
  console.log(`  Citations: ${beforeCitations}`);
  console.log(`  Essay-Bot Transitions: ${beforeEssayBot}`);
  console.log(`  Words: ${beforeWords}`);
  console.log();

  // ── RUN 1: Default protections (expect safe skip) ──
  console.log('── Run 1: Default protections ──');
  const callLLMForModel = async (prompt, modelName, temperature) => callOllama(prompt, modelName, temperature);

  const { text: safeText, report: safeReport } = await runAntiChatbotRecastPipeline(
    WEAK_NONFICTION_SAMPLE,
    nonfictionProfile,
    {
      callLLMForModel,
      recastThreshold: 70,
      skipThreshold: 80,
      recastMode: RECAST_MODE.CONSERVATIVE,
      enableLengthRetry: true,
      maxLengthRetries: 1,
    }
  );

  console.log(`  Run 1: ${safeReport.chunksRecast} recast, ${safeReport.chunksSkipped} skipped, ${safeReport.chunksFailed} failed`);
  for (const d of safeReport.chunkDetails) {
    console.log(`    Chunk ${d.index}: ${d.action} — ${d.reason || d.routingReason || '—'}`);
  }

  // ── RUN 2: Forced recast (raise threshold to 80, skip at 95) to exercise heading gate ──
  console.log('\n── Run 2: Forced recast (threshold=80, skip=95) ──');

  const { text: afterText, report } = await runAntiChatbotRecastPipeline(
    WEAK_NONFICTION_SAMPLE,
    nonfictionProfile,
    {
      callLLMForModel,
      recastThreshold: 80,
      skipThreshold: 95,
      recastMode: RECAST_MODE.CONSERVATIVE,
      enableLengthRetry: true,
      maxLengthRetries: 1,
    }
  );

  // ── AFTER metrics ──
  const afterMetrics = analyzeProseTexture(afterText);
  const afterPatterns = countChatbotPatterns(afterText);
  const afterFV = countFilterVerbs(afterText);
  const afterCitations = countCitations(afterText);
  const afterHeadings = countHeadings(afterText);
  const afterWords = countWords(afterText);
  const afterEssayBot = countEssayBotTransitions(afterText);

  console.log('\n── AFTER (Recast) ──');
  console.log(`  Composite Score: ${afterMetrics.compositeScore} ${afterMetrics.grade} (${afterMetrics.compositeScore >= beforeMetrics.compositeScore ? '+' : ''}${afterMetrics.compositeScore - beforeMetrics.compositeScore})`);
  console.log(`  Filter Verbs: ${afterFV.total} (${afterFV.density}/1K) (${afterFV.total <= beforeFV.total ? '-' : '+'}${Math.abs(beforeFV.total - afterFV.total)})`);
  console.log(`  Chatbot Patterns: ${afterPatterns.total} (${afterPatterns.total <= beforePatterns.total ? '-' : '+'}${Math.abs(beforePatterns.total - afterPatterns.total)})`);
  console.log(`  Headings: ${afterHeadings} (${afterHeadings >= beforeHeadings ? '✅ PRESERVED' : '❌ LOST'})`);
  console.log(`  Citations: ${afterCitations} (${afterCitations >= beforeCitations ? '✅ PRESERVED' : '❌ LOST'})`);
  console.log(`  Essay-Bot Transitions: ${afterEssayBot} (${afterEssayBot <= beforeEssayBot ? '-' : '+'}${Math.abs(beforeEssayBot - afterEssayBot)})`);
  console.log(`  Words: ${afterWords} (ratio: ${Math.round(afterWords / beforeWords * 100)}%)`);

  // ── Pipeline Report ──
  console.log('\n── PIPELINE REPORT ──');
  console.log(`  Profile: ${report.profileUsed}`);
  console.log(`  Pipeline Version: ${report.pipelineVersion}`);
  console.log(`  Chunks Analyzed: ${report.chunksAnalyzed}`);
  console.log(`  Chunks Recast: ${report.chunksRecast}`);
  console.log(`  Chunks Skipped: ${report.chunksSkipped}`);
  console.log(`  Chunks Failed: ${report.chunksFailed}`);
  console.log(`  Safety Blocks: ${report.safetyBlocks}`);
  console.log(`  Heading Blocks: ${report.headingBlocks}`);
  console.log(`  Literary Flattening Blocks: ${report.literaryFlatteningBlocks}`);

  // Per-chunk
  console.log('\n── PER-CHUNK DETAIL ──');
  for (const d of report.chunkDetails) {
    const model = d.selectedModel || '(skipped)';
    const reason = d.routingReason || d.reason || '—';
    const headingOk = d.headingPreservation ? (d.headingPreservation.ok ? '✅' : '❌') : '—';
    console.log(`  Chunk ${d.index}: ${d.action} | ${model} | ${reason} | score: ${d.beforeScore}→${d.afterScore || '—'} | headings: ${headingOk}`);
    if (d.weaknessTypes?.length) console.log(`    Weaknesses: ${d.weaknessTypes.join(', ')}`);
    if (d.headingPreservation) console.log(`    Headings: ${d.headingPreservation.originalCount}→${d.headingPreservation.recastCount}`);
  }

  // Routing report
  if (report.routingReport) {
    console.log('\n── ROUTING REPORT ──');
    console.log(`  Model Distribution: ${JSON.stringify(report.routingReport.modelDistribution)}`);
    console.log(`  Weakness Distribution: ${JSON.stringify(report.routingReport.weaknessDistribution)}`);
    console.log(`  Total Chunks: ${report.routingReport.totalChunks}`);
    console.log(`  Routed Chunks: ${report.routingReport.routedChunks}`);
  }

  // ── ACCEPTANCE CHECKS ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('ACCEPTANCE CHECKS');
  console.log('═══════════════════════════════════════════════════════════════');

  const checks = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok, detail });
    console.log(`  ${ok ? '✅' : '❌'} ${name}: ${detail}`);
  };

  check('Headings preserved', afterHeadings >= beforeHeadings, `${beforeHeadings}→${afterHeadings}`);
  check('Citations preserved', afterCitations >= beforeCitations, `${beforeCitations}→${afterCitations}`);
  check('Composite improved or stable', afterMetrics.compositeScore >= beforeMetrics.compositeScore, `${beforeMetrics.compositeScore}→${afterMetrics.compositeScore}`);
  check('Filter verbs decreased or stable', afterFV.total <= beforeFV.total, `${beforeFV.total}→${afterFV.total}`);
  check('Chatbot patterns decreased or stable', afterPatterns.total <= beforePatterns.total, `${beforePatterns.total}→${afterPatterns.total}`);
  check('No compression (<90% ratio)', afterWords / beforeWords >= 0.90, `${Math.round(afterWords / beforeWords * 100)}%`);
  check('No expansion (>115% ratio)', afterWords / beforeWords <= 1.15, `${Math.round(afterWords / beforeWords * 100)}%`);
  check('At least 1 chunk recast OR correctly blocked', report.chunksRecast > 0 || report.chunksFailed > 0 || report.chunksSkipped > 0, `recast=${report.chunksRecast}, failed=${report.chunksFailed}, skipped=${report.chunksSkipped}`);
  check('Routing used prose-recast-polisher for nonfiction', report.chunkDetails.every(d => !d.selectedModel || d.selectedModel === 'prose-recast-polisher'), report.chunkDetails.map(d => d.selectedModel).filter(Boolean).join(', ') || 'all skipped');
  check('Zero heading blocks needed (headings preserved in recast)', report.headingBlocks === 0, `headingBlocks=${report.headingBlocks}`);

  const allPassed = checks.every(c => c.ok);
  console.log(`\n  OVERALL: ${allPassed ? '✅ ALL CHECKS PASS' : '❌ SOME CHECKS FAILED'}`);

  // ── Save results ──
  const results = {
    before: {
      compositeScore: beforeMetrics.compositeScore,
      grade: beforeMetrics.grade,
      filterVerbs: beforeFV,
      chatbotPatterns: beforePatterns.total,
      headings: beforeHeadings,
      citations: beforeCitations,
      essayBotTransitions: beforeEssayBot,
      words: beforeWords,
    },
    after: {
      compositeScore: afterMetrics.compositeScore,
      grade: afterMetrics.grade,
      filterVerbs: afterFV,
      chatbotPatterns: afterPatterns.total,
      headings: afterHeadings,
      citations: afterCitations,
      essayBotTransitions: afterEssayBot,
      words: afterWords,
    },
    delta: {
      compositeScore: afterMetrics.compositeScore - beforeMetrics.compositeScore,
      filterVerbs: beforeFV.total - afterFV.total,
      chatbotPatterns: beforePatterns.total - afterPatterns.total,
      headings: afterHeadings - beforeHeadings,
      citations: afterCitations - beforeCitations,
      wordRatio: Math.round(afterWords / beforeWords * 100),
    },
    report,
    checks,
    allPassed,
    pipelineVersion: VERSION,
    timestamp: new Date().toISOString(),
  };

  writeFileSync(join(OUTPUT_DIR, 'stress-test-results.json'), JSON.stringify(results, null, 2));
  writeFileSync(join(OUTPUT_DIR, 'weak-nonfiction-before.txt'), WEAK_NONFICTION_SAMPLE);
  writeFileSync(join(OUTPUT_DIR, 'weak-nonfiction-after.txt'), afterText);
  writeFileSync(join(OUTPUT_DIR, 'pipeline-report.json'), JSON.stringify(report, null, 2));

  console.log(`\n  Results saved to: ${OUTPUT_DIR}/`);
}

runStressTest().catch(err => {
  console.error('STRESS TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
