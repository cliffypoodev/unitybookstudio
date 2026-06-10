/**
 * liveGenreConditionalRecastBakeoff.mjs
 *
 * Live Ollama bakeoff: generates text with ghostwriter, then runs it through
 * the genre-conditional recast pipeline. Compares A (raw generation) vs B (recast).
 *
 * Version A: Raw ghostwriter output with genre-appropriate system prompt
 * Version B: Same Version A text passed through runAntiChatbotRecastPipeline()
 *
 * This proves whether the recast pipeline improves real model output.
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ── Import modules ──
const acpPath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const { analyzeProseTexture, countChatbotPatterns, getAntiChatbotRulesForProject } = await import(acpPath);

const recastPath = join(process.cwd(), 'src/lib/antiChatbotRecastPipeline.js');
const { runAntiChatbotRecastPipeline, splitTextIntoRecastChunks, shouldRecastChunk } = await import(recastPath);

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const GEN_MODEL = 'ghostwriter';
const RECAST_MODEL = 'prose-polisher';
const GEN_TEMP = 0.72;
const RECAST_TEMP = 0.55;  // Lower temp for controlled recast
const MAX_TOKENS = 4096;
const TIMEOUT_MS = 600000;

const OUTPUT_DIR = join(process.cwd(), 'smoke-test-output/live-genre-conditional-recast-bakeoff');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Ollama call ──
async function callOllama(prompt, systemPrompt = '', model = GEN_MODEL, temperature = GEN_TEMP) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const startTime = Date.now();
  console.log(`    [Ollama] Calling ${model}... (timeout ${TIMEOUT_MS / 1000}s)`);

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

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}`);
  }

  const data = await response.json();
  let text = data?.message?.content || '';

  // Strip thinking-model artifacts
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/<\/think>/gi, '');
  text = text.replace(/\\boxed\{[^}]*\}/g, '');
  text = text.trim();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  console.log(`    [Ollama] Done in ${elapsed}s | ${wordCount} words`);
  return text;
}

// ── callLLM wrapper for recast pipeline ──
function makeRecastCallLLM() {
  return async function callLLM(prompt) {
    return callOllama(prompt, '', RECAST_MODEL, RECAST_TEMP);
  };
}

// ── Genre System Prompts ──
const SYSTEM_PROMPTS = {
  thriller: `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose. Write in third person past tense. Write approximately 1200 words. Do not write meta-commentary, notes, or explanations. Output only the prose.`,
  literary: `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose. Write in third person past tense. Write approximately 1200 words. Do not write meta-commentary, notes, or explanations. Output only the prose.`,
  nonfiction: `You are the prose engine for a professional long-form book-writing app. Your job is to write the next chapter section as polished narrative nonfiction prose in the style of Michael Lewis or Charles Duhigg. Write approximately 1200 words. Do not write meta-commentary, notes, or explanations. Output only the prose.`,
};

// ── Test Prompts ──
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
  console.log('LIVE GENRE-CONDITIONAL RECAST BAKEOFF');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Generation Model: ${GEN_MODEL}`);
  console.log(`Recast Model: ${RECAST_MODEL}`);
  console.log(`Gen Temperature: ${GEN_TEMP}`);
  console.log(`Recast Temperature: ${RECAST_TEMP}`);
  console.log(`Max tokens: ${MAX_TOKENS}`);
  console.log();

  const allResults = [];

  for (const project of PROJECTS) {
    console.log(`\n── ${project.name} ──────────────────────────────────────`);

    const rules = getAntiChatbotRulesForProject(project.project);
    console.log(`  Profile: ${rules.profileKey} | Recast Eligible: ${rules.recastEligible}`);

    // VERSION A: Generate with ghostwriter
    console.log('\n  [A] Generating with ghostwriter (raw output)...');
    const textA = await callOllama(project.prompt, SYSTEM_PROMPTS[project.genre], GEN_MODEL, GEN_TEMP);

    // VERSION B: Run Version A through recast pipeline
    console.log('\n  [B] Running Version A through recast pipeline...');
    const recastCallLLM = makeRecastCallLLM();
    const { text: textB, report: recastReport } = await runAntiChatbotRecastPipeline(
      textA,
      project.project,
      { callLLM: recastCallLLM, recastThreshold: 70, skipThreshold: 80 }
    );

    // Score both
    const textureA = analyzeProseTexture(textA);
    const textureB = analyzeProseTexture(textB);
    const patternsA = countChatbotPatterns(textA);
    const patternsB = countChatbotPatterns(textB);
    const wordCountA = textA.split(/\s+/).filter(Boolean).length;
    const wordCountB = textB.split(/\s+/).filter(Boolean).length;

    // Chunk-level analysis
    const { chunks } = splitTextIntoRecastChunks(textA);
    const chunkAnalysis = chunks.map(c => {
      const eligibility = shouldRecastChunk(c, project.project, { recastThreshold: 70, skipThreshold: 80 });
      return {
        index: c.index,
        words: c.text.split(/\s+/).filter(Boolean).length,
        score: eligibility.metrics?.compositeScore || null,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
      };
    });

    const result = {
      name: project.name,
      slug: project.slug,
      profileKey: rules.profileKey,
      wordCountA,
      wordCountB,
      textureA,
      textureB,
      patternsA,
      patternsB,
      recastReport,
      chunkAnalysis,
      delta: {
        compositeScore: textureB.compositeScore - textureA.compositeScore,
        chatbotPatternDelta: patternsA.total - patternsB.total,
        chatbotDensityDelta: Math.round((patternsA.density - patternsB.density) * 10) / 10,
        filterVerbDelta: Math.round((textureA.filterVerbDensity - textureB.filterVerbDensity) * 10) / 10,
      },
    };
    allResults.push(result);

    // Print summary
    console.log(`\n  VERSION A (Raw Ghostwriter):
    Words: ${wordCountA} | Score: ${textureA.compositeScore} (${textureA.grade})
    Filter Verbs: ${textureA.filterVerbDensity}/1K | Chatbot Patterns: ${patternsA.total} (${patternsA.density}/1K)`);

    console.log(`  VERSION B (After Recast):
    Words: ${wordCountB} | Score: ${textureB.compositeScore} (${textureB.grade})
    Filter Verbs: ${textureB.filterVerbDensity}/1K | Chatbot Patterns: ${patternsB.total} (${patternsB.density}/1K)`);

    console.log(`  RECAST REPORT:
    Chunks Analyzed: ${recastReport.chunksAnalyzed}
    Chunks Skipped: ${recastReport.chunksSkipped}
    Chunks Recast: ${recastReport.chunksRecast}
    Chunks Failed: ${recastReport.chunksFailed}
    Safety Blocks: ${recastReport.safetyBlocks}
    Reference Blocks: ${recastReport.referenceBlocks}
    Overcorrection Warnings: ${recastReport.overcorrectionWarnings.length}`);

    console.log(`  DELTA: composite ${result.delta.compositeScore > 0 ? '+' : ''}${result.delta.compositeScore} | patterns ${result.delta.chatbotPatternDelta > 0 ? '-' : '+'}${Math.abs(result.delta.chatbotPatternDelta)}`);

    // Save raw text
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-version-a.txt`), textA);
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-version-b.txt`), textB);
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-recast-report.json`), JSON.stringify(recastReport, null, 2));
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-chunk-analysis.json`), JSON.stringify(chunkAnalysis, null, 2));
  }

  // ── Nonfiction Specific Validation ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('NONFICTION REGRESSION VALIDATION');
  console.log('═══════════════════════════════════════════════════════════════');

  const nf = allResults.find(r => r.slug === 'nonfiction');
  const nfTextA = nf ? allResults.find(r => r.slug === 'nonfiction') : null;

  if (nf) {
    const textAFile = join(OUTPUT_DIR, 'nonfiction-version-a.txt');
    const textBFile = join(OUTPUT_DIR, 'nonfiction-version-b.txt');

    // Check citation preservation
    const textA = readFileSync(textAFile, 'utf8');
    const textB = readFileSync(textBFile, 'utf8');

    const citationPattern = /\([^)]*\d{4}[^)]*\)/g;
    const citationsA = (textA.match(citationPattern) || []);
    const citationsB = (textB.match(citationPattern) || []);
    console.log(`  Citations in A: ${citationsA.length} | Citations in B: ${citationsB.length}`);
    if (citationsA.length > 0 && citationsB.length >= citationsA.length) {
      console.log('  ✅ Citations preserved');
    } else if (citationsA.length > 0) {
      console.log('  ⚠️ Some citations may have been lost');
    }

    // Check heading preservation
    const headingsA = (textA.match(/^#+\s.+$/gm) || []);
    const headingsB = (textB.match(/^#+\s.+$/gm) || []);
    console.log(`  Headings in A: ${headingsA.length} | Headings in B: ${headingsB.length}`);

    console.log(`  Nonfiction Composite: ${nf.textureA.compositeScore} → ${nf.textureB.compositeScore} (${nf.delta.compositeScore > 0 ? '+' : ''}${nf.delta.compositeScore})`);
    if (nf.delta.compositeScore >= 0) {
      console.log('  ✅ Nonfiction did NOT regress');
    } else if (nf.delta.compositeScore >= -5) {
      console.log('  ⚠️ Minor nonfiction regression (< 5 points)');
    } else {
      console.log('  ❌ Nonfiction regression detected');
    }
  }

  // ── Drift Analysis ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('LONGFORM DRIFT ANALYSIS (Version B / Post-Recast)');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const r of allResults) {
    const textBRaw = readFileSync(join(OUTPUT_DIR, `${r.slug}-version-b.txt`), 'utf8');
    const { chunks } = splitTextIntoRecastChunks(textBRaw);

    if (chunks.length < 2) {
      console.log(`  ⚠️ ${r.name}: Only ${chunks.length} chunk(s) — skipping drift analysis`);
      continue;
    }

    const firstChunk = analyzeProseTexture(chunks[0].text);
    const lastChunk = analyzeProseTexture(chunks[chunks.length - 1].text);
    const drift = firstChunk.compositeScore - lastChunk.compositeScore;

    console.log(`\n  ${r.name}:`);
    console.log(`    First chunk: ${firstChunk.compositeScore} (${firstChunk.grade})`);
    console.log(`    Last chunk:  ${lastChunk.compositeScore} (${lastChunk.grade})`);
    console.log(`    Drift: ${drift > 0 ? '' : '+'}${-drift} points`);

    if (Math.abs(drift) <= 5) console.log('    ✅ STABLE');
    else if (drift > 5 && drift <= 10) console.log('    ⚡ MINOR DRIFT');
    else if (drift > 10) console.log('    ⚠️ SIGNIFICANT DRIFT');

    writeFileSync(join(OUTPUT_DIR, `${r.slug}-drift-analysis.json`), JSON.stringify({
      name: r.name, firstChunk, lastChunk, drift, chunkCount: chunks.length,
    }, null, 2));
  }

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('BAKEOFF SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const r of allResults) {
    const improved = r.delta.compositeScore > 0;
    const stable = r.delta.compositeScore >= -2;
    const icon = improved ? '✅' : stable ? '⚡' : '❌';
    console.log(`  ${icon} ${r.name}: ${r.textureA.compositeScore} → ${r.textureB.compositeScore} (${r.delta.compositeScore > 0 ? '+' : ''}${r.delta.compositeScore}) | Chunks recast: ${r.recastReport.chunksRecast}/${r.recastReport.chunksAnalyzed}`);
  }

  const avgDelta = Math.round(allResults.reduce((s, r) => s + r.delta.compositeScore, 0) / allResults.length * 10) / 10;
  const avgPatternDrop = Math.round(allResults.reduce((s, r) => s + r.delta.chatbotPatternDelta, 0) / allResults.length * 10) / 10;
  const totalRecast = allResults.reduce((s, r) => s + r.recastReport.chunksRecast, 0);
  const totalAnalyzed = allResults.reduce((s, r) => s + r.recastReport.chunksAnalyzed, 0);
  const totalSkipped = allResults.reduce((s, r) => s + r.recastReport.chunksSkipped, 0);
  const totalFailed = allResults.reduce((s, r) => s + r.recastReport.chunksFailed, 0);
  const totalSafetyBlocks = allResults.reduce((s, r) => s + r.recastReport.safetyBlocks, 0);

  console.log(`\n  Average composite delta: ${avgDelta > 0 ? '+' : ''}${avgDelta}`);
  console.log(`  Average pattern reduction: ${avgPatternDrop > 0 ? '-' : '+'}${Math.abs(avgPatternDrop)}`);
  console.log(`  Total chunks analyzed: ${totalAnalyzed}`);
  console.log(`  Total chunks recast: ${totalRecast}`);
  console.log(`  Total chunks skipped: ${totalSkipped}`);
  console.log(`  Total chunks failed: ${totalFailed}`);
  console.log(`  Total safety blocks: ${totalSafetyBlocks}`);

  // Save full results JSON
  const jsonResults = allResults.map(r => ({
    name: r.name,
    slug: r.slug,
    profileKey: r.profileKey,
    wordCountA: r.wordCountA,
    wordCountB: r.wordCountB,
    textureA: r.textureA,
    textureB: r.textureB,
    patternsA: r.patternsA,
    patternsB: r.patternsB,
    recastReport: r.recastReport,
    chunkAnalysis: r.chunkAnalysis,
    delta: r.delta,
  }));

  writeFileSync(join(OUTPUT_DIR, 'live-recast-bakeoff-results.json'), JSON.stringify({
    results: jsonResults,
    summary: { avgDelta, avgPatternDrop, totalRecast, totalAnalyzed, totalSkipped, totalFailed, totalSafetyBlocks },
    genModel: GEN_MODEL,
    recastModel: RECAST_MODEL,
    genTemperature: GEN_TEMP,
    recastTemperature: RECAST_TEMP,
    timestamp: new Date().toISOString(),
  }, null, 2));

  console.log(`\n  Results saved to: ${OUTPUT_DIR}/live-recast-bakeoff-results.json`);
}

runBakeoff().catch(err => {
  console.error('BAKEOFF FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
