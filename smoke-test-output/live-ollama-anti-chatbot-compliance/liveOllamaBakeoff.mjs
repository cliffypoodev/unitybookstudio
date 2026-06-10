/**
 * liveOllamaBakeoff.mjs — Live Ollama Anti-Chatbot Compliance Bakeoff
 *
 * Makes REAL Ollama calls to the `ghostwriter` model with:
 *   Version A: Full UBS prompt WITHOUT SIGNATURE_VOICE_BLOCK
 *   Version B: Full UBS prompt WITH SIGNATURE_VOICE_BLOCK
 *
 * Scores both with analyzeProseTexture() and countChatbotPatterns().
 * Saves raw generated text + analysis to JSON for report generation.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Import the real anti-chatbot module ──
const acpPath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const { SIGNATURE_VOICE_BLOCK, analyzeProseTexture, countChatbotPatterns } = await import(acpPath);

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'ghostwriter';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.72;
const TIMEOUT_MS = 600000; // 10 minutes

const OUTPUT_DIR = join(process.cwd(), 'smoke-test-output/live-ollama-anti-chatbot-compliance');

// ── Ollama call ──
async function callOllama(prompt, systemPrompt = '') {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const startTime = Date.now();
  console.log(`    [Ollama] Calling ${MODEL}... (timeout ${TIMEOUT_MS / 1000}s)`);

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS },
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

// ── Test Prompts ──

const BASE_SYSTEM_PROMPT = `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose. Write in third person past tense. Write approximately 1200 words. Do not write meta-commentary, notes, or explanations. Output only the prose.`;

const PROJECTS = [
  {
    name: 'Commercial Thriller',
    slug: 'thriller',
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
    prompt: `GENRE: Investigative Narrative Nonfiction / Trade Nonfiction
TONE: Data-driven, specific, authoritative but accessible. Michael Lewis / Charles Duhigg style.

PROJECT CONTEXT:
In 2019, the City of Milwaukee contracted a technology firm called CivicMetrics to build a centralized hiring platform for the city's twelve largest municipal employers (fire department, police, parks, public works, etc.). The platform processed approximately 50,000 applications per year. It included an AI-powered candidate scoring algorithm that ranked applicants by "predicted job success probability."

In March 2026, David Hernandez, a consultant from the auditing firm Delaney & Associates, was hired to optimize the platform's user interface. While reviewing the code repository, he discovered that the scoring algorithm used non-traditional data inputs — credit scores, zip codes, social media activity patterns, and a proprietary "community stability index" — that systematically disadvantaged applicants from lower-income neighborhoods. Applicants from nine zip codes south of Interstate 94, all majority-Black or majority-Latino communities, scored on average 23 percentile points lower than applicants with identical education and experience from North Shore suburbs.

CHAPTER SECTION TO WRITE:
Write the opening section of Chapter 3: "The Algorithm." Begin with David Hernandez at his desk, finding the candidate_scorer.py module. Walk the reader through what he found: the code, the weights, the data inputs. Use specific numbers, specific variable names, specific zip codes. Then show his analysis: how he zeroed out the non-traditional inputs and compared the rankings. Present the 23-percentile-point gap as the data reveals it. Include the institutional context — who built the algorithm, who contracted it, who was supposed to audit it (and didn't). End with the systemic implication: the algorithm doesn't use race, but zip code and credit score are proxies. Keep it factual and specific. Let the data carry the moral weight.`,
  },
];

// ── Run Bakeoff ──

async function runBakeoff() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('LIVE OLLAMA ANTI-CHATBOT COMPLIANCE BAKEOFF');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Model: ${MODEL}`);
  console.log(`Temperature: ${TEMPERATURE}`);
  console.log(`Max tokens: ${MAX_TOKENS}`);
  console.log(`Timeout: ${TIMEOUT_MS / 1000}s`);
  console.log();

  const results = [];

  for (const project of PROJECTS) {
    console.log(`\n── ${project.name} ──────────────────────────────────────`);

    // VERSION A: No anti-chatbot rules
    console.log('\n  [A] Generating BASELINE (no SIGNATURE_VOICE_BLOCK)...');
    const textA = await callOllama(project.prompt, BASE_SYSTEM_PROMPT);

    // VERSION B: With anti-chatbot rules
    const systemB = BASE_SYSTEM_PROMPT + '\n\n' + SIGNATURE_VOICE_BLOCK;
    console.log('\n  [B] Generating WITH SIGNATURE_VOICE_BLOCK...');
    const textB = await callOllama(project.prompt, systemB);

    // Score both
    const textureA = analyzeProseTexture(textA);
    const textureB = analyzeProseTexture(textB);
    const patternsA = countChatbotPatterns(textA);
    const patternsB = countChatbotPatterns(textB);

    const result = {
      name: project.name,
      slug: project.slug,
      textA,
      textB,
      wordCountA: textA.split(/\s+/).filter(Boolean).length,
      wordCountB: textB.split(/\s+/).filter(Boolean).length,
      textureA,
      textureB,
      patternsA,
      patternsB,
      delta: {
        compositeScore: textureB.compositeScore - textureA.compositeScore,
        chatbotPatternDelta: patternsA.total - patternsB.total,
        chatbotDensityDelta: Math.round((patternsA.density - patternsB.density) * 10) / 10,
        filterVerbDelta: Math.round((textureA.filterVerbDensity - textureB.filterVerbDensity) * 10) / 10,
      },
    };
    results.push(result);

    // Print summary
    console.log(`\n  VERSION A (Baseline):`);
    console.log(`    Words: ${result.wordCountA} | Score: ${textureA.compositeScore} (${textureA.grade})`);
    console.log(`    Filter Verbs: ${textureA.filterVerbDensity}/1K | Thesis: ${textureA.thesisStatementDensity}/1K | Not-Just: ${textureA.notJustDensity}/1K`);
    console.log(`    Chatbot Patterns: ${patternsA.total} (${patternsA.density}/1K)`);

    console.log(`  VERSION B (Hardened):`);
    console.log(`    Words: ${result.wordCountB} | Score: ${textureB.compositeScore} (${textureB.grade})`);
    console.log(`    Filter Verbs: ${textureB.filterVerbDensity}/1K | Thesis: ${textureB.thesisStatementDensity}/1K | Not-Just: ${textureB.notJustDensity}/1K`);
    console.log(`    Chatbot Patterns: ${patternsB.total} (${patternsB.density}/1K)`);

    console.log(`  DELTA: composite ${result.delta.compositeScore > 0 ? '+' : ''}${result.delta.compositeScore} | patterns ${result.delta.chatbotPatternDelta > 0 ? '-' : '+'}${Math.abs(result.delta.chatbotPatternDelta)}`);

    // Save individual raw outputs
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-version-a.txt`), textA);
    writeFileSync(join(OUTPUT_DIR, `${project.slug}-version-b.txt`), textB);
  }

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('BAKEOFF SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const r of results) {
    const improved = r.delta.compositeScore > 0;
    const icon = improved ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}: ${r.textureA.compositeScore} → ${r.textureB.compositeScore} (${r.delta.compositeScore > 0 ? '+' : ''}${r.delta.compositeScore}) | Chatbot: ${r.patternsA.total} → ${r.patternsB.total}`);
  }

  const avgDelta = Math.round(results.reduce((s, r) => s + r.delta.compositeScore, 0) / results.length);
  const avgPatternDrop = Math.round(results.reduce((s, r) => s + r.delta.chatbotPatternDelta, 0) / results.length);

  console.log(`\n  Average composite improvement: ${avgDelta > 0 ? '+' : ''}${avgDelta} points`);
  console.log(`  Average chatbot pattern reduction: ${avgPatternDrop > 0 ? '-' : '+'}${Math.abs(avgPatternDrop)} patterns`);

  // Save full results
  const outputPath = join(OUTPUT_DIR, 'live-bakeoff-results.json');
  // Don't include full text in JSON to keep it manageable — save separately
  const jsonResults = results.map(r => ({
    name: r.name,
    slug: r.slug,
    wordCountA: r.wordCountA,
    wordCountB: r.wordCountB,
    textureA: r.textureA,
    textureB: r.textureB,
    patternsA: r.patternsA,
    patternsB: r.patternsB,
    delta: r.delta,
    // Include first 500 chars of each for quick reference
    sampleA: r.textA.substring(0, 500),
    sampleB: r.textB.substring(0, 500),
  }));
  writeFileSync(outputPath, JSON.stringify({ results: jsonResults, avgDelta, avgPatternDrop, model: MODEL, temperature: TEMPERATURE, timestamp: new Date().toISOString() }, null, 2));
  console.log(`\n  Results: ${outputPath}`);
  console.log('  Raw text: {slug}-version-{a|b}.txt');

  // ── Drift Analysis ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('LONGFORM DRIFT ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const r of results) {
    const wordsB = r.textB.split(/\s+/).filter(Boolean).length;
    if (wordsB < 400) {
      console.log(`  ⚠️ ${r.name}: Version B only ${wordsB} words — too short for drift analysis`);
      continue;
    }

    // Split B into thirds
    const sentences = r.textB.split(/(?<=[.!?])\s+(?=[A-Z"'""])/);
    const third = Math.floor(sentences.length / 3);
    const opening = sentences.slice(0, third).join(' ');
    const middle = sentences.slice(third, third * 2).join(' ');
    const ending = sentences.slice(third * 2).join(' ');

    const openingScore = analyzeProseTexture(opening);
    const middleScore = analyzeProseTexture(middle);
    const endingScore = analyzeProseTexture(ending);

    console.log(`\n  ${r.name}:`);
    console.log(`    Opening: ${openingScore.compositeScore} (${openingScore.grade}) | Filter: ${openingScore.filterVerbDensity}/1K`);
    console.log(`    Middle:  ${middleScore.compositeScore} (${middleScore.grade}) | Filter: ${middleScore.filterVerbDensity}/1K`);
    console.log(`    Ending:  ${endingScore.compositeScore} (${endingScore.grade}) | Filter: ${endingScore.filterVerbDensity}/1K`);

    const drift = openingScore.compositeScore - endingScore.compositeScore;
    if (drift > 10) {
      console.log(`    ⚠️  DRIFT DETECTED: Opening ${openingScore.compositeScore} → Ending ${endingScore.compositeScore} (${drift} point drop)`);
    } else if (drift > 5) {
      console.log(`    ⚡ MINOR DRIFT: Opening ${openingScore.compositeScore} → Ending ${endingScore.compositeScore} (${drift} point drop)`);
    } else {
      console.log(`    ✅ STABLE: No significant drift across sections`);
    }

    // Save drift data
    writeFileSync(join(OUTPUT_DIR, `${r.slug}-drift-analysis.json`), JSON.stringify({
      name: r.name,
      opening: openingScore,
      middle: middleScore,
      ending: endingScore,
      drift,
    }, null, 2));
  }
}

runBakeoff().catch(err => {
  console.error('BAKEOFF FAILED:', err.message);
  process.exit(1);
});
