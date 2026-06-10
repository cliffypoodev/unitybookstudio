/**
 * liveRecastTuningBakeoffV3.mjs
 *
 * Three-way comparison:
 *   Version A: Raw ghostwriter output
 *   Version B: Version A through v3 pipeline with OLD prose-polisher model
 *   Version C: Version A through v3 pipeline with NEW prose-recast-polisher model
 *
 * This tests whether the dedicated recast model improves results.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const acpPath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const { analyzeProseTexture, countChatbotPatterns, getAntiChatbotRulesForProject } = await import(acpPath);

const recastPath = join(process.cwd(), 'src/lib/antiChatbotRecastPipeline.js');
const { runAntiChatbotRecastPipeline, RECAST_MODE, RECAST_MODEL_NAME } = await import(recastPath);

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const GEN_MODEL = 'ghostwriter';
const OLD_RECAST_MODEL = 'prose-polisher';
const NEW_RECAST_MODEL = RECAST_MODEL_NAME; // 'prose-recast-polisher'
const GEN_TEMP = 0.72;
const OLD_RECAST_TEMP = 0.55;
const NEW_RECAST_TEMP = 0.4;
const MAX_TOKENS = 4096;
const TIMEOUT_MS = 600000;

const OUTPUT_DIR = join(process.cwd(), 'smoke-test-output/prose-polisher-recast-tuning-v3');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Count filter verbs in text ──
const FILTER_VERBS = ['felt', 'realized', 'noticed', 'watched', 'saw', 'heard', 'seemed', 'wondered', 'knew', 'understood'];
function countFilterVerbs(text) {
  const lower = text.toLowerCase();
  let total = 0;
  const counts = {};
  for (const verb of FILTER_VERBS) {
    const re = new RegExp(`\\b${verb}\\b`, 'gi');
    const matches = text.match(re) || [];
    counts[verb] = matches.length;
    total += matches.length;
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  return { counts, total, density: Math.round((total / (words / 1000)) * 10) / 10 };
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

// ── Projects (same as v2 for comparability) ──
const PROJECTS = [
  {
    name: 'Commercial Thriller',
    slug: 'thriller',
    genre: 'thriller',
    project: { genre: 'thriller', subgenre: 'thriller', book_type: 'fiction' },
    prompt: `GENRE: High-Concept Thriller / Disaster Fiction
TONE: Taut, procedural, high-velocity

PROJECT CONTEXT:
Marcus Cole is a disaster preparedness consultant hired by FEMA to audit municipal emergency alert systems across twelve states. During routine analysis, he discovers that flood warnings, earthquake alerts, and evacuation orders in multiple cities were issued BEFORE the corresponding geological events occurred — by exactly 72 hours in each case. His investigation leads him to a private infrastructure firm called Meridian Systems, which has embedded itself into the emergency broadcast architecture of 38 metropolitan areas.

SCENE TO WRITE:
Marcus breaks into Meridian Systems' server facility in a decommissioned military annex outside Columbus, Ohio. He finds a massive operations center with live feeds from municipal infrastructure grids across 12 states. His partner Sarah Chen, a former NSA signals analyst, begins pulling server logs and discovers that Meridian doesn't just MONITOR emergency systems — they have full operational CONTROL. They can trigger flood warnings, earthquake alerts, and evacuation orders at will. Marcus realizes the "emergencies" were precision-calibrated social experiments measuring panic response, compliance rates, and evacuation speeds across entire metropolitan populations.

Write the full scene: entry into the facility, discovery of the operation's scope, Sarah pulling the logs, the moment of realization, and their decision about what to do next. Include specific technical details, dialogue, and tension. End on a moment of escalation, not resolution.`,
  },
  {
    name: 'Literary/Speculative Fiction',
    slug: 'literary',
    genre: 'literary',
    project: { genre: 'fiction', subgenre: 'literary', book_type: 'fiction' },
    prompt: `GENRE: Literary Speculative Fiction / Near-Future Dystopia
TONE: Controlled, observational, emotionally precise

PROJECT CONTEXT:
In 2041, the Memory Verification Bureau (MVB) administers mandatory memory audits for all citizens over age 18. Neural implants — standard since 2028 — can degrade or corrupt organic memories over time. The MVB determines which memories are "verified organic" and which may be "implant artifacts." Citizens whose core identity memories fail verification lose their legal identity status, becoming "Unverified" — unable to hold jobs, own property, or access healthcare.

SCENE TO WRITE:
Elena Vasquez, 34, sits in the MVB waiting room in Building 7, Newark. She has been waiting for three hours. She is about to undergo her third verification attempt — her first two were flagged for "inconclusive patterning." This is her last chance before being reclassified as Unverified.

Write Elena's experience in the waiting room: the physical environment, the other applicants, the intake paperwork, her internal state (show, don't tell), and the moment when her name is finally called. Include specific details about the bureaucratic process, the physical space, and Elena's body language. Show her uncertainty about whether her own memories are real — not through declaration but through the way she interacts with the intake form. End on the threshold: her name called, the door opening, what she sees on the other side.`,
  },
  {
    name: 'Narrative Nonfiction',
    slug: 'nonfiction',
    genre: 'nonfiction',
    project: { genre: 'nonfiction', book_type: 'nonfiction', project_type: 'nonfiction' },
    prompt: `GENRE: Investigative Narrative Nonfiction / Trade Nonfiction
TONE: Data-driven, specific, authoritative but accessible. Michael Lewis / Charles Duhigg style.

PROJECT CONTEXT:
In 2019, the City of Milwaukee contracted a technology firm called CivicMetrics to build a centralized hiring platform for the city's twelve largest municipal employers (fire department, police, parks, public works, etc.). The platform processed approximately 50,000 applications per year. It included an AI-powered candidate scoring algorithm that ranked applicants by "predicted job success probability."

In March 2026, David Hernandez, a consultant from the auditing firm Delaney & Associates, was hired to optimize the platform's user interface. While reviewing the code repository, he discovered that the scoring algorithm used non-traditional data inputs — credit scores, zip codes, social media activity patterns, and a proprietary "community stability index" — that systematically disadvantaged applicants from lower-income neighborhoods. Applicants from nine zip codes south of Interstate 94, all majority-Black or majority-Latino communities, scored on average 23 percentile points lower than applicants with identical education and experience from North Shore suburbs.

CHAPTER SECTION TO WRITE:
Write the opening section of Chapter 3: "The Algorithm." Begin with David Hernandez at his desk, finding the candidate_scorer.py module. Walk the reader through what he found: the code, the weights, the data inputs. Use specific numbers, specific variable names, specific zip codes. Then show his analysis: how he zeroed out the non-traditional inputs and compared the rankings. Present the 23-percentile-point gap as the data reveals it. Include the institutional context — who built the algorithm, who contracted it, who was supposed to audit it (and didn't). End with the systemic implication: the algorithm doesn't use race, but zip code and credit score are proxies. Keep it factual and specific. Let the data carry the moral weight.

IMPORTANT: Include at least one citation-like reference, e.g. (Hernandez, Internal Audit Report, 2026) or a data source attribution. Include at least one section heading or subheading. This is nonfiction — preserve factual precision.`,
  },
];

// ── Run Bakeoff ──
async function runBakeoff() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PROSE-POLISHER RECAST TUNING BAKEOFF v3');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Generation Model: ${GEN_MODEL}`);
  console.log(`Old Recast Model (B): ${OLD_RECAST_MODEL} (temp ${OLD_RECAST_TEMP})`);
  console.log(`New Recast Model (C): ${NEW_RECAST_MODEL} (temp ${NEW_RECAST_TEMP})`);
  console.log(`Recast Mode: ${RECAST_MODE.CONSERVATIVE}`);
  console.log(`Pipeline Version: v3.0 (tuned prompts + filter verb targeting)`);
  console.log();

  const allResults = [];

  for (const project of PROJECTS) {
    console.log(`\n── ${project.name} ──────────────────────────────────────`);

    const rules = getAntiChatbotRulesForProject(project.project);
    console.log(`  Profile: ${rules.profileKey}`);

    // VERSION A: Generate with ghostwriter
    console.log('\n  [A] Generating with ghostwriter (raw output)...');
    const textA = await callOllama(project.prompt, SYSTEM_PROMPTS[project.genre], GEN_MODEL, GEN_TEMP);

    // VERSION B: Run A through v3 pipeline with OLD prose-polisher model
    console.log('\n  [B] Recast with OLD model (prose-polisher) + v3 prompt...');
    const callLLM_B = async (prompt) => callOllama(prompt, '', OLD_RECAST_MODEL, OLD_RECAST_TEMP);
    const { text: textB, report: reportB } = await runAntiChatbotRecastPipeline(
      textA, project.project,
      { callLLM: callLLM_B, recastThreshold: 70, skipThreshold: 80, recastMode: RECAST_MODE.CONSERVATIVE, enableLengthRetry: true, maxLengthRetries: 1 }
    );

    // VERSION C: Run A through v3 pipeline with NEW prose-recast-polisher model
    console.log('\n  [C] Recast with NEW model (prose-recast-polisher) + v3 prompt...');
    const callLLM_C = async (prompt) => callOllama(prompt, '', NEW_RECAST_MODEL, NEW_RECAST_TEMP);
    const { text: textC, report: reportC } = await runAntiChatbotRecastPipeline(
      textA, project.project,
      { callLLM: callLLM_C, recastThreshold: 70, skipThreshold: 80, recastMode: RECAST_MODE.CONSERVATIVE, enableLengthRetry: true, maxLengthRetries: 1 }
    );

    // Score all three
    const scoreAll = (text) => ({
      texture: analyzeProseTexture(text),
      patterns: countChatbotPatterns(text),
      filterVerbs: countFilterVerbs(text),
      words: text.split(/\s+/).filter(Boolean).length,
    });

    const metricsA = scoreAll(textA);
    const metricsB = scoreAll(textB);
    const metricsC = scoreAll(textC);

    const result = {
      name: project.name,
      slug: project.slug,
      profileKey: rules.profileKey,
      metricsA, metricsB, metricsC,
      reportB, reportC,
      deltaB: {
        compositeScore: metricsB.texture.compositeScore - metricsA.texture.compositeScore,
        filterVerbDelta: metricsA.filterVerbs.total - metricsB.filterVerbs.total,
        chatbotPatternDelta: metricsA.patterns.total - metricsB.patterns.total,
      },
      deltaC: {
        compositeScore: metricsC.texture.compositeScore - metricsA.texture.compositeScore,
        filterVerbDelta: metricsA.filterVerbs.total - metricsC.filterVerbs.total,
        chatbotPatternDelta: metricsA.patterns.total - metricsC.patterns.total,
      },
    };
    allResults.push(result);

    // Print summary
    const pad = (s, n) => String(s).padEnd(n);
    console.log(`\n  ${pad('', 6)} ${pad('Score', 10)} ${pad('Grade', 12)} ${pad('FilterVerbs', 14)} ${pad('Chatbot', 10)} ${pad('Words', 8)}`);
    console.log(`  [A]  ${pad(metricsA.texture.compositeScore, 10)} ${pad(metricsA.texture.grade, 12)} ${pad(metricsA.filterVerbs.total + ' (' + metricsA.filterVerbs.density + '/1K)', 14)} ${pad(metricsA.patterns.total, 10)} ${pad(metricsA.words, 8)}`);
    console.log(`  [B]  ${pad(metricsB.texture.compositeScore, 10)} ${pad(metricsB.texture.grade, 12)} ${pad(metricsB.filterVerbs.total + ' (' + metricsB.filterVerbs.density + '/1K)', 14)} ${pad(metricsB.patterns.total, 10)} ${pad(metricsB.words, 8)}`);
    console.log(`  [C]  ${pad(metricsC.texture.compositeScore, 10)} ${pad(metricsC.texture.grade, 12)} ${pad(metricsC.filterVerbs.total + ' (' + metricsC.filterVerbs.density + '/1K)', 14)} ${pad(metricsC.patterns.total, 10)} ${pad(metricsC.words, 8)}`);

    console.log(`\n  RECAST B: ${reportB.chunksRecast}/${reportB.chunksAnalyzed} recast, ${reportB.chunksFailed} failed, ${reportB.chunksRetried} retried, ${reportB.safetyBlocks} blocked`);
    console.log(`  RECAST C: ${reportC.chunksRecast}/${reportC.chunksAnalyzed} recast, ${reportC.chunksFailed} failed, ${reportC.chunksRetried} retried, ${reportC.safetyBlocks} blocked`);

    const cBetter = result.deltaC.compositeScore > result.deltaB.compositeScore;
    const cFilterBetter = result.deltaC.filterVerbDelta > result.deltaB.filterVerbDelta;
    console.log(`  ${cBetter ? '✅' : '⚡'} Score: B=${result.deltaB.compositeScore > 0 ? '+' : ''}${result.deltaB.compositeScore}, C=${result.deltaC.compositeScore > 0 ? '+' : ''}${result.deltaC.compositeScore}`);
    console.log(`  ${cFilterBetter ? '✅' : '⚡'} FilterVerbs: B=-${result.deltaB.filterVerbDelta}, C=-${result.deltaC.filterVerbDelta}`);

    // Save raw text
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-version-a.txt`), textA);
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-version-b.txt`), textB);
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-version-c.txt`), textC);
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-report-b.json`), JSON.stringify(reportB, null, 2));
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-report-c.json`), JSON.stringify(reportC, null, 2));
  }

  // ── Nonfiction Regression ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('NONFICTION REGRESSION VALIDATION');
  console.log('═══════════════════════════════════════════════════════════════');
  const nf = allResults.find(r => r.slug === 'nonfiction');
  if (nf) {
    const textA = readFileSync(join(OUTPUT_DIR, 'nonfiction-version-a.txt'), 'utf8');
    const textC = readFileSync(join(OUTPUT_DIR, 'nonfiction-version-c.txt'), 'utf8');
    const citationPattern = /\([^)]*\d{4}[^)]*\)/g;
    const citA = (textA.match(citationPattern) || []).length;
    const citC = (textC.match(citationPattern) || []).length;
    const headA = (textA.match(/^#+\s.+$/gm) || []).length;
    const headC = (textC.match(/^#+\s.+$/gm) || []).length;
    console.log(`  Citations: A=${citA}, C=${citC} ${citC >= citA ? '✅' : '⚠️'}`);
    console.log(`  Headings: A=${headA}, C=${headC} ${headC >= headA ? '✅' : '⚠️'}`);
    console.log(`  Composite: ${nf.metricsA.texture.compositeScore} → ${nf.metricsC.texture.compositeScore} (${nf.deltaC.compositeScore >= 0 ? '✅' : '❌'} ${nf.deltaC.compositeScore > 0 ? '+' : ''}${nf.deltaC.compositeScore})`);
  }

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('BAKEOFF v3 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const r of allResults) {
    const bIcon = r.deltaB.compositeScore > 0 ? '✅' : r.deltaB.compositeScore >= -2 ? '⚡' : '❌';
    const cIcon = r.deltaC.compositeScore > 0 ? '✅' : r.deltaC.compositeScore >= -2 ? '⚡' : '❌';
    console.log(`  ${r.name}:`);
    console.log(`    [B old model] ${bIcon} ${r.metricsA.texture.compositeScore}→${r.metricsB.texture.compositeScore} (${r.deltaB.compositeScore > 0 ? '+' : ''}${r.deltaB.compositeScore}) | FV: -${r.deltaB.filterVerbDelta} | Recast: ${r.reportB.chunksRecast}/${r.reportB.chunksAnalyzed}`);
    console.log(`    [C new model] ${cIcon} ${r.metricsA.texture.compositeScore}→${r.metricsC.texture.compositeScore} (${r.deltaC.compositeScore > 0 ? '+' : ''}${r.deltaC.compositeScore}) | FV: -${r.deltaC.filterVerbDelta} | Recast: ${r.reportC.chunksRecast}/${r.reportC.chunksAnalyzed}`);
  }

  const avgDeltaB = Math.round(allResults.reduce((s, r) => s + r.deltaB.compositeScore, 0) / allResults.length * 10) / 10;
  const avgDeltaC = Math.round(allResults.reduce((s, r) => s + r.deltaC.compositeScore, 0) / allResults.length * 10) / 10;
  const totalFilterB = allResults.reduce((s, r) => s + r.deltaB.filterVerbDelta, 0);
  const totalFilterC = allResults.reduce((s, r) => s + r.deltaC.filterVerbDelta, 0);
  const totalRecastB = allResults.reduce((s, r) => s + r.reportB.chunksRecast, 0);
  const totalRecastC = allResults.reduce((s, r) => s + r.reportC.chunksRecast, 0);
  const totalFailedB = allResults.reduce((s, r) => s + r.reportB.chunksFailed, 0);
  const totalFailedC = allResults.reduce((s, r) => s + r.reportC.chunksFailed, 0);

  console.log(`\n  Avg composite delta: B=${avgDeltaB > 0 ? '+' : ''}${avgDeltaB}, C=${avgDeltaC > 0 ? '+' : ''}${avgDeltaC}`);
  console.log(`  Total filter verb reduction: B=-${totalFilterB}, C=-${totalFilterC}`);
  console.log(`  Total chunks recast: B=${totalRecastB}, C=${totalRecastC}`);
  console.log(`  Total chunks failed: B=${totalFailedB}, C=${totalFailedC}`);

  // Save results
  writeFileSync(join(OUTPUT_DIR, 'live-recast-bakeoff-v3-results.json'), JSON.stringify({
    results: allResults,
    summary: {
      avgDeltaB, avgDeltaC, totalFilterB, totalFilterC,
      totalRecastB, totalRecastC, totalFailedB, totalFailedC,
    },
    genModel: GEN_MODEL,
    oldRecastModel: OLD_RECAST_MODEL,
    newRecastModel: NEW_RECAST_MODEL,
    recastMode: RECAST_MODE.CONSERVATIVE,
    pipelineVersion: 'v3.0',
    timestamp: new Date().toISOString(),
  }, null, 2));

  console.log(`\n  Results saved to: ${OUTPUT_DIR}/live-recast-bakeoff-v3-results.json`);
}

runBakeoff().catch(err => {
  console.error('BAKEOFF v3 FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
