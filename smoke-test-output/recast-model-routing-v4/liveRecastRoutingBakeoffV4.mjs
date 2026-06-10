/**
 * liveRecastRoutingBakeoffV4.mjs
 *
 * Three-way comparison:
 *   Version A: Raw ghostwriter output
 *   Version B: v3 pipeline — prose-recast-polisher for ALL chunks
 *   Version C: v4 pipeline — model routed by genre/weakness
 *
 * Tests whether intelligent model routing improves results over a single model.
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const acpPath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const { analyzeProseTexture, countChatbotPatterns, getAntiChatbotRulesForProject } = await import(acpPath);

const recastPath = join(process.cwd(), 'src/lib/antiChatbotRecastPipeline.js');
const { runAntiChatbotRecastPipeline, RECAST_MODE, VERSION } = await import(recastPath);

const routingPath = join(process.cwd(), 'src/lib/recastModelRouting.js');
const { detectMarkdownHeadings, detectSectionHeadings } = await import(routingPath);

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const GEN_MODEL = 'ghostwriter';
const RECAST_MODEL = 'prose-recast-polisher';
const POLISHER_MODEL = 'prose-polisher';
const GEN_TEMP = 0.72;
const TIMEOUT_MS = 600000;
const MAX_TOKENS = 4096;

const OUTPUT_DIR = join(process.cwd(), 'smoke-test-output/recast-model-routing-v4');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Count filter verbs ──
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

// ── Heading counting ──
function countHeadings(text) {
  return detectMarkdownHeadings(text) + detectSectionHeadings(text);
}

// ── Ollama call ──
async function callOllama(prompt, systemPrompt = '', model = GEN_MODEL, temperature = GEN_TEMP) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const startTime = Date.now();
  console.log(`    [Ollama] Calling ${model} (temp ${temperature})...`);

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

  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);

  const data = await response.json();
  let text = data?.message?.content || '';
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/<\/think>/gi, '');
  text = text.replace(/\\boxed\{[^}]*\}/g, '');
  text = text.trim();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  console.log(`    [Ollama] Done in ${elapsed}s | ${wordCount} words`);
  return text;
}

// ── System prompts ──
const SYSTEM_PROMPTS = {
  thriller: `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose. Write in third person past tense. Write approximately 1200 words. Do not write meta-commentary, notes, or explanations. Output only the prose.`,
  literary: `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose. Write in third person past tense. Write approximately 1200 words. Do not write meta-commentary, notes, or explanations. Output only the prose.`,
  nonfiction: `You are the prose engine for a professional long-form book-writing app. Your job is to write the next chapter section as polished narrative nonfiction prose in the style of Michael Lewis or Charles Duhigg. Write approximately 1200 words. Do not write meta-commentary, notes, or explanations. Output only the prose.`,
};

// ── Projects ──
const PROJECTS = [
  {
    name: 'Commercial Thriller',
    slug: 'thriller',
    genre: 'thriller',
    project: { genre: 'thriller', subgenre: 'thriller', book_type: 'fiction' },
    prompt: `GENRE: High-Concept Thriller / Disaster Fiction
TONE: Taut, procedural, high-velocity

PROJECT CONTEXT:
Marcus Cole is a disaster preparedness consultant hired by FEMA to audit municipal emergency alert systems across twelve states. During routine analysis, he discovers that flood warnings, earthquake alerts, and evacuation orders in multiple cities were issued BEFORE the corresponding geological events occurred — by exactly 72 hours in each case.

SCENE TO WRITE:
Marcus breaks into Meridian Systems' server facility in a decommissioned military annex outside Columbus, Ohio. He finds a massive operations center with live feeds from municipal infrastructure grids. His partner Sarah Chen, a former NSA signals analyst, begins pulling server logs and discovers that Meridian doesn't just MONITOR emergency systems — they have full operational CONTROL. They can trigger flood warnings, earthquake alerts, and evacuation orders at will. Marcus realizes the "emergencies" were precision-calibrated social experiments.

Write the full scene: entry, discovery, Sarah pulling the logs, realization, and their decision about what to do next. Include technical details, dialogue, and tension. End on escalation.`,
  },
  {
    name: 'Literary/Speculative Fiction',
    slug: 'literary',
    genre: 'literary',
    project: { genre: 'fiction', subgenre: 'literary', book_type: 'fiction' },
    prompt: `GENRE: Literary Speculative Fiction / Near-Future Dystopia
TONE: Controlled, observational, emotionally precise

PROJECT CONTEXT:
In 2041, the Memory Verification Bureau (MVB) administers mandatory memory audits. Neural implants can degrade organic memories. The MVB determines which memories are "verified organic" and which may be "implant artifacts." Citizens whose core identity memories fail verification become "Unverified."

SCENE TO WRITE:
Elena Vasquez, 34, sits in the MVB waiting room in Building 7, Newark. She has been waiting for three hours. She is about to undergo her third verification attempt — her first two were flagged for "inconclusive patterning."

Write Elena's experience: the physical environment, other applicants, the intake paperwork, her internal state (show, don't tell), and the moment when her name is called. Include specific bureaucratic details. Show her uncertainty about whether her own memories are real. End on the threshold: her name called, the door opening.`,
  },
  {
    name: 'Narrative Nonfiction',
    slug: 'nonfiction',
    genre: 'nonfiction',
    project: { genre: 'nonfiction', book_type: 'nonfiction', project_type: 'nonfiction' },
    prompt: `GENRE: Investigative Narrative Nonfiction
TONE: Data-driven, specific, authoritative. Michael Lewis / Charles Duhigg style.

PROJECT CONTEXT:
In 2019, the City of Milwaukee contracted CivicMetrics to build a centralized hiring platform. It included an AI-powered scoring algorithm. In March 2026, consultant David Hernandez discovered the scoring algorithm used credit scores, zip codes, and social media patterns that systematically disadvantaged applicants from lower-income neighborhoods. Applicants from nine zip codes south of I-94 scored 23 percentile points lower than applicants with identical credentials from North Shore suburbs.

CHAPTER SECTION TO WRITE:
Write Chapter 3: "The Algorithm." Begin with Hernandez at his desk, finding candidate_scorer.py. Walk the reader through the code, the weights, the data inputs. Use specific numbers, variable names, zip codes. Show his analysis: zeroing out non-traditional inputs and comparing rankings. Present the 23-percentile-point gap. Include institutional context. End with the systemic implication.

IMPORTANT: Include citation-like references, e.g. (Hernandez, Internal Audit Report, 2026). Include section headings. Preserve factual precision.`,
  },
];

// ── Run Bakeoff ──
async function runBakeoff() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('RECAST MODEL ROUTING BAKEOFF v4');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Pipeline: ${VERSION}`);
  console.log(`Generation Model: ${GEN_MODEL}`);
  console.log(`v3 Model (B): ${RECAST_MODEL} for ALL`);
  console.log(`v4 Routed (C): model chosen by routing logic`);
  console.log();

  const allResults = [];

  for (const project of PROJECTS) {
    console.log(`\n── ${project.name} ──────────────────────────────────────`);

    const rules = getAntiChatbotRulesForProject(project.project);
    console.log(`  Profile: ${rules.profileKey}`);

    // VERSION A: Generate with ghostwriter
    console.log('\n  [A] Generating with ghostwriter (raw output)...');
    const textA = await callOllama(project.prompt, SYSTEM_PROMPTS[project.genre], GEN_MODEL, GEN_TEMP);

    // VERSION B: v3 pipeline — prose-recast-polisher for ALL chunks (fixed model)
    console.log('\n  [B] v3 fixed model (prose-recast-polisher for all)...');
    const callLLM_B = async (prompt) => callOllama(prompt, '', RECAST_MODEL, 0.4);
    const { text: textB, report: reportB } = await runAntiChatbotRecastPipeline(
      textA, project.project,
      { callLLM: callLLM_B, recastThreshold: 70, skipThreshold: 80, recastMode: RECAST_MODE.CONSERVATIVE, enableLengthRetry: true, maxLengthRetries: 1 }
    );

    // VERSION C: v4 pipeline — model routed by genre/weakness
    console.log('\n  [C] v4 routed model (routing by genre/weakness)...');
    const callLLMForModel_C = async (prompt, modelName, temperature) => callOllama(prompt, '', modelName, temperature);
    const { text: textC, report: reportC } = await runAntiChatbotRecastPipeline(
      textA, project.project,
      { callLLMForModel: callLLMForModel_C, recastThreshold: 70, skipThreshold: 80, recastMode: RECAST_MODE.CONSERVATIVE, enableLengthRetry: true, maxLengthRetries: 1 }
    );

    // Score all three
    const scoreAll = (text) => ({
      texture: analyzeProseTexture(text),
      patterns: countChatbotPatterns(text),
      filterVerbs: countFilterVerbs(text),
      words: text.split(/\s+/).filter(Boolean).length,
      headings: countHeadings(text),
    });

    const metricsA = scoreAll(textA);
    const metricsB = scoreAll(textB);
    const metricsC = scoreAll(textC);

    // Check citations
    const citationPattern = /\([^)]*\d{4}[^)]*\)/g;
    const citA = (textA.match(citationPattern) || []).length;
    const citB = (textB.match(citationPattern) || []).length;
    const citC = (textC.match(citationPattern) || []).length;

    const result = {
      name: project.name,
      slug: project.slug,
      profileKey: rules.profileKey,
      metricsA, metricsB, metricsC,
      citA, citB, citC,
      reportB, reportC,
      deltaB: {
        compositeScore: metricsB.texture.compositeScore - metricsA.texture.compositeScore,
        filterVerbDelta: metricsA.filterVerbs.total - metricsB.filterVerbs.total,
        chatbotPatternDelta: metricsA.patterns.total - metricsB.patterns.total,
        headingDelta: metricsB.headings - metricsA.headings,
      },
      deltaC: {
        compositeScore: metricsC.texture.compositeScore - metricsA.texture.compositeScore,
        filterVerbDelta: metricsA.filterVerbs.total - metricsC.filterVerbs.total,
        chatbotPatternDelta: metricsA.patterns.total - metricsC.patterns.total,
        headingDelta: metricsC.headings - metricsA.headings,
      },
    };
    allResults.push(result);

    // Print summary
    const pad = (s, n) => String(s).padEnd(n);
    console.log(`\n  ${pad('', 6)} ${pad('Score', 8)} ${pad('Grade', 12)} ${pad('FV', 12)} ${pad('Chatbot', 8)} ${pad('Hdgs', 6)} ${pad('Cit', 5)} ${pad('Words', 6)}`);
    console.log(`  [A]  ${pad(metricsA.texture.compositeScore, 8)} ${pad(metricsA.texture.grade, 12)} ${pad(metricsA.filterVerbs.total + '(' + metricsA.filterVerbs.density + '/1K)', 12)} ${pad(metricsA.patterns.total, 8)} ${pad(metricsA.headings, 6)} ${pad(citA, 5)} ${pad(metricsA.words, 6)}`);
    console.log(`  [B]  ${pad(metricsB.texture.compositeScore, 8)} ${pad(metricsB.texture.grade, 12)} ${pad(metricsB.filterVerbs.total + '(' + metricsB.filterVerbs.density + '/1K)', 12)} ${pad(metricsB.patterns.total, 8)} ${pad(metricsB.headings, 6)} ${pad(citB, 5)} ${pad(metricsB.words, 6)}`);
    console.log(`  [C]  ${pad(metricsC.texture.compositeScore, 8)} ${pad(metricsC.texture.grade, 12)} ${pad(metricsC.filterVerbs.total + '(' + metricsC.filterVerbs.density + '/1K)', 12)} ${pad(metricsC.patterns.total, 8)} ${pad(metricsC.headings, 6)} ${pad(citC, 5)} ${pad(metricsC.words, 6)}`);

    // Routing report
    if (reportC.routingReport) {
      console.log(`\n  ROUTING: ${JSON.stringify(reportC.routingReport.modelDistribution)}`);
    }

    // Per-chunk routing
    for (const d of reportC.chunkDetails) {
      if (d.selectedModel) {
        console.log(`    Chunk ${d.index}: ${d.selectedModel} (${d.routingReason}) → ${d.action}${d.afterScore ? ' score=' + d.afterScore : ''}`);
      }
    }

    console.log(`\n  RECAST B: ${reportB.chunksRecast}/${reportB.chunksAnalyzed} recast, ${reportB.chunksFailed} failed, ${reportB.safetyBlocks} blocked`);
    console.log(`  RECAST C: ${reportC.chunksRecast}/${reportC.chunksAnalyzed} recast, ${reportC.chunksFailed} failed, ${reportC.safetyBlocks} blocked`);
    if (reportC.headingBlocks > 0) console.log(`  ⚠️  HEADING BLOCKS: ${reportC.headingBlocks}`);
    if (reportC.literaryFlatteningBlocks > 0) console.log(`  ⚠️  LITERARY FLATTENING BLOCKS: ${reportC.literaryFlatteningBlocks}`);

    const cBetter = result.deltaC.compositeScore > result.deltaB.compositeScore;
    console.log(`  ${cBetter ? '✅' : '⚡'} Score: B=${result.deltaB.compositeScore > 0 ? '+' : ''}${result.deltaB.compositeScore}, C=${result.deltaC.compositeScore > 0 ? '+' : ''}${result.deltaC.compositeScore}`);
    console.log(`  Headings: A=${metricsA.headings}, B=${metricsB.headings}(${result.deltaB.headingDelta >= 0 ? '+' : ''}${result.deltaB.headingDelta}), C=${metricsC.headings}(${result.deltaC.headingDelta >= 0 ? '+' : ''}${result.deltaC.headingDelta})`);

    // Save raw text
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-version-a.txt`), textA);
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-version-b.txt`), textB);
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-version-c.txt`), textC);
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-report-b.json`), JSON.stringify(reportB, null, 2));
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-report-c.json`), JSON.stringify(reportC, null, 2));
  }

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('BAKEOFF v4 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const r of allResults) {
    const bIcon = r.deltaB.compositeScore > 0 ? '✅' : r.deltaB.compositeScore >= -2 ? '⚡' : '❌';
    const cIcon = r.deltaC.compositeScore > 0 ? '✅' : r.deltaC.compositeScore >= -2 ? '⚡' : '❌';
    console.log(`  ${r.name}:`);
    console.log(`    [B v3 fixed]  ${bIcon} ${r.metricsA.texture.compositeScore}→${r.metricsB.texture.compositeScore} (${r.deltaB.compositeScore > 0 ? '+' : ''}${r.deltaB.compositeScore}) | FV: -${r.deltaB.filterVerbDelta} | Hdg: ${r.deltaB.headingDelta >= 0 ? '+' : ''}${r.deltaB.headingDelta} | Cit: ${r.citA}→${r.citB}`);
    console.log(`    [C v4 routed] ${cIcon} ${r.metricsA.texture.compositeScore}→${r.metricsC.texture.compositeScore} (${r.deltaC.compositeScore > 0 ? '+' : ''}${r.deltaC.compositeScore}) | FV: -${r.deltaC.filterVerbDelta} | Hdg: ${r.deltaC.headingDelta >= 0 ? '+' : ''}${r.deltaC.headingDelta} | Cit: ${r.citA}→${r.citC}`);
  }

  const avgDeltaB = Math.round(allResults.reduce((s, r) => s + r.deltaB.compositeScore, 0) / allResults.length * 10) / 10;
  const avgDeltaC = Math.round(allResults.reduce((s, r) => s + r.deltaC.compositeScore, 0) / allResults.length * 10) / 10;
  const totalFilterB = allResults.reduce((s, r) => s + r.deltaB.filterVerbDelta, 0);
  const totalFilterC = allResults.reduce((s, r) => s + r.deltaC.filterVerbDelta, 0);
  const nf = allResults.find(r => r.slug === 'nonfiction');
  const nfHeadingsPreserved = nf && nf.deltaC.headingDelta >= 0;

  console.log(`\n  Avg composite delta: B=${avgDeltaB > 0 ? '+' : ''}${avgDeltaB}, C=${avgDeltaC > 0 ? '+' : ''}${avgDeltaC}`);
  console.log(`  Total filter verb reduction: B=-${totalFilterB}, C=-${totalFilterC}`);
  console.log(`  Nonfiction headings preserved: ${nfHeadingsPreserved ? '✅' : '❌'}`);

  // Save results
  writeFileSync(join(OUTPUT_DIR, 'live-recast-bakeoff-v4-results.json'), JSON.stringify({
    results: allResults,
    summary: { avgDeltaB, avgDeltaC, totalFilterB, totalFilterC, nfHeadingsPreserved },
    pipelineVersion: VERSION,
    timestamp: new Date().toISOString(),
  }, null, 2));

  console.log(`\n  Results saved to: ${OUTPUT_DIR}/live-recast-bakeoff-v4-results.json`);
}

runBakeoff().catch(err => {
  console.error('BAKEOFF v4 FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
