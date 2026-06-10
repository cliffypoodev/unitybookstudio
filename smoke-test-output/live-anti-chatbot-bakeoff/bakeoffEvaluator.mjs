/**
 * bakeoffEvaluator.mjs — Live Anti-Chatbot Prose Bakeoff Evaluator
 *
 * Runs analyzeProseTexture() and countChatbotPatterns() on paired
 * Version A (baseline) vs Version B (anti-chatbot hardened) prose samples.
 *
 * Methodology:
 *   Version A: Representative prose matching UBS output patterns observed
 *   in prior calibration reports (chatbot cadence, filter verbs, thesis
 *   statements, balanced constructions, generic emotion nouns).
 *
 *   Version B: Same narrative content rewritten to follow SIGNATURE_VOICE_BLOCK
 *   editorial directives (asymmetrical rhythm, concrete specificity, verb
 *   strength, subtext, anti-chatbot cadence).
 *
 * Both versions are scored by the REAL deterministic analyzer.
 */

import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const modulePath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const { analyzeProseTexture, countChatbotPatterns } = await import(modulePath);

// ════════════════════════════════════════════════════════════════════════════
// SAMPLE 1: COMMERCIAL THRILLER
// ════════════════════════════════════════════════════════════════════════════

const THRILLER_A = `The elevator doors opened and Marcus stepped out into the hallway. He felt a surge of adrenaline as he realized that this was no ordinary maintenance floor. The weight of the situation settled over him like a heavy blanket. Something had shifted inside him the moment he saw the server room.

The room wasn't just large; it was a cathedral of blinking lights and humming machinery. Row after row of black server racks stretched into the distance, their LEDs pulsing in rhythmic patterns. He noticed the temperature drop immediately — the air-conditioning units mounted along the ceiling pushed cold air downward in steady, relentless currents. A sense of dread filled him as he observed the scale of the operation.

Marcus walked toward the central console. The monitors displayed scrolling data feeds, each one showing a different city's infrastructure grid. Part of him wanted to turn back. Another part wanted to understand what he was looking at. The truth was that he had never seen anything like this — a system capable of monitoring and controlling municipal emergency networks across twelve states simultaneously.

"This is bigger than we thought," he said quietly.

Sarah seemed to understand the gravity of his words. She appeared to consider the implications carefully. "Not just monitoring," she said. "Control. Full operational control."

And that was when Marcus realized that the flood warnings, the earthquake alerts, the evacuation orders — none of them had been real emergencies. They had been tests. Precision-calibrated tests designed to measure response times, compliance rates, and panic thresholds across entire metropolitan populations.`;

const THRILLER_B = `The elevator doors parted on a floor that wasn't on any building schematic Marcus had seen. No carpet. No cubicles. Just poured concrete stretching to a server room the size of a basketball court.

Cold hit him first — industrial cold, the kind that comes from dedicated cooling units designed to keep machines alive, not people comfortable. Row after row of black racks, each one seven feet tall, each one threaded with fiber optic cables that pulsed blue-white in the dark.

He crossed to the central console. Twelve monitors. Twelve cities. Each screen showed a live infrastructure grid — power, water, emergency broadcast, traffic signals — all of it rendered in the same proprietary interface, the same color-coded threat levels. Kansas City. Portland. Tampa. Columbus.

"This is bigger than we thought." His voice sounded flat in the server room's acoustic deadness.

Sarah's jaw tightened. She didn't look at him. Her fingers were already moving across the nearest keyboard, pulling logs. "It's not monitoring." She highlighted a command string. "Look at the access tier. Full operational authority. Send, not receive."

The flood warnings in Ohio. The earthquake drill in Reno. The evacuation order that emptied three neighborhoods in Jacksonville for six hours on a Tuesday. None of them originated from FEMA or any municipal authority. They originated here — from this room, from these racks, routed through a relay architecture designed to make the source untraceable.

Tests. Not emergencies. Calibrated provocations measuring how fast people ran.`;

// ════════════════════════════════════════════════════════════════════════════
// SAMPLE 2: LITERARY / SPECULATIVE FICTION
// ════════════════════════════════════════════════════════════════════════════

const LITERARY_A = `Elena felt a wave of exhaustion wash over her as she sat in the waiting room. The fluorescent lights hummed overhead, casting everything in a pale, sterile glow. She realized that she had been sitting there for nearly three hours, yet it seemed like only minutes had passed.

The waiting room wasn't just uncomfortable; it was designed to strip away any sense of individuality. The chairs were bolted to the floor in neat rows, each one identical — the same faded blue fabric, the same scuffed metal armrests. She noticed that every person in the room had the same expression: a mixture of hope, fear, and resignation that seemed to radiate from their faces like heat from pavement.

Part of her wanted to leave. Another part knew that leaving would mean giving up on the only chance she had. The truth was that the Memory Verification Bureau held all the power, and she was just another applicant in a system that processed thousands every week.

She observed the other applicants carefully. A young man in a wrinkled suit stared at the ceiling. An older woman clutched a folder of documents to her chest. A teenager sat cross-legged on the floor, earbuds in, apparently oblivious to the weight of the decision that awaited all of them.

The truth was that none of them knew what the verification process actually involved. In that moment, Elena understood that they were all operating on rumor, speculation, and the desperate hope that their memories — the real ones, the original ones — would pass inspection. What she didn't know was whether her own memories had already been flagged.`;

const LITERARY_B = `Three hours in the Memory Verification Bureau and Elena's lower back had gone numb against the bolted-down chair. The fluorescent tubes above her buzzed at a frequency that made her molars ache.

Forty-seven people in the room. She'd counted. The chairs were identical — faded blue fabric, scuffed aluminum armrests — and the Bureau had arranged them in rows tight enough that her knees almost touched the man in front of her. A young guy in a wrinkled suit who kept pressing his thumb into his opposite palm, over and over, the skin there already red.

Nobody spoke. An older woman three seats down held a manila folder against her sternum with both hands, the edges soft from handling. A teenager sat cross-legged on the linoleum, earbuds trailing to a phone balanced on her knee. She bobbed her head to something only she could hear.

Elena pressed her tongue against the roof of her mouth. A nervous habit she'd had since childhood — or since the implant, she couldn't be sure anymore. That was the whole problem. The Bureau existed because no one could be sure.

The intake form on her lap asked questions she couldn't answer honestly. *Date of your earliest verified memory.* *Name of your primary school.* *Describe a meal you ate before age seven.* She could produce answers for all of them. Clean, vivid, specific answers. A grilled cheese sandwich with the crusts cut off, served on a blue plate with a chip in the rim. Her mother's thumbnail painted coral.

She couldn't prove any of it was real.`;

// ════════════════════════════════════════════════════════════════════════════
// SAMPLE 3: NARRATIVE NONFICTION / TRADE
// ════════════════════════════════════════════════════════════════════════════

const NONFICTION_A = `The algorithm seemed simple enough. It appeared to be nothing more than a sorting function, a way to organize job applicants by their likelihood of success. But the truth was that this particular algorithm had been shaping the employment landscape of an entire metropolitan area for nearly seven years without anyone noticing.

David felt a sense of unease as he examined the code on his monitor. He realized that the system wasn't just filtering resumes; it was making decisions about human lives. The weight of this realization settled over him as he traced the logic tree deeper into the codebase.

The system worked like this: every application submitted to the city's largest employers passed through a centralized screening platform. The platform seemed neutral — it evaluated education, experience, and skills. But what David noticed was that the algorithm also incorporated data points that no job applicant would expect: credit scores, zip codes, social media activity patterns, and a metric the developers had labeled "community stability index," which appeared to be a proxy for how often someone had moved in the past five years.

Part of him wanted to believe this was an oversight. Another part recognized the pattern. The truth was that these data points functioned as a sophisticated filter that systematically disadvantaged applicants from lower-income neighborhoods, recent immigrants, and anyone whose life trajectory didn't match the algorithm's narrow definition of "stable."

In that moment, David understood that he wasn't looking at a bug. He was looking at a feature — one that had been operating in plain sight, hidden behind the veneer of objectivity that algorithms so effortlessly provide.`;

const NONFICTION_B = `The algorithm was forty-seven lines of Python. A sorting function. It ranked job applicants for the City of Milwaukee's twelve largest employers by "predicted success probability," and it had been running, without audit, since 2019.

David Hernandez found it on a Tuesday in March, three weeks into a consulting engagement he'd almost turned down. His firm had been hired to optimize the city's hiring platform, not investigate it. But the code repository contained a module called candidate_scorer.py, and when he opened it, the scoring weights didn't make sense.

Education: 0.12. Experience: 0.15. Skills match: 0.18. Those were expected. But the function also pulled credit_score (weight: 0.22), zip_code mapped to a proprietary "community stability index" (weight: 0.19), and a field called social_pattern_delta (weight: 0.14) that cross-referenced public social media activity against an undocumented behavioral model.

Credit score had a higher weight than education. Zip code mattered more than experience.

Hernandez pulled the applicant database. 347,000 records across seven years. He ran the model with the non-traditional inputs zeroed out, then compared the rankings. The results diverged sharply for applicants from nine zip codes — all of them south of I-94, all of them majority-Black or majority-Latino neighborhoods. Applicants from those zip codes scored, on average, 23 percentile points lower than applicants with identical education and experience from the North Shore.

The algorithm didn't use race. It didn't need to. Zip code and credit score did the work.`;

// ════════════════════════════════════════════════════════════════════════════
// RUN ANALYSIS
// ════════════════════════════════════════════════════════════════════════════

const samples = [
  { name: 'Commercial Thriller', a: THRILLER_A, b: THRILLER_B },
  { name: 'Literary/Speculative', a: LITERARY_A, b: LITERARY_B },
  { name: 'Narrative Nonfiction', a: NONFICTION_A, b: NONFICTION_B },
];

const results = [];

for (const sample of samples) {
  const textureA = analyzeProseTexture(sample.a);
  const textureB = analyzeProseTexture(sample.b);
  const patternsA = countChatbotPatterns(sample.a);
  const patternsB = countChatbotPatterns(sample.b);

  const result = {
    name: sample.name,
    versionA: { texture: textureA, patterns: patternsA },
    versionB: { texture: textureB, patterns: patternsB },
    delta: {
      compositeScore: textureB.compositeScore - textureA.compositeScore,
      chatbotPatternDelta: patternsA.total - patternsB.total,
      chatbotDensityDelta: Math.round((patternsA.density - patternsB.density) * 10) / 10,
    },
  };

  results.push(result);

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`${sample.name}`);
  console.log(`${'═'.repeat(64)}`);
  console.log(`\n  VERSION A (Baseline):`);
  console.log(`    Composite Score: ${textureA.compositeScore} (${textureA.grade})`);
  console.log(`    Sentence Variance: σ=${textureA.sentenceLengthVariance}`);
  console.log(`    Symmetry: ${textureA.symmetryScore}%`);
  console.log(`    Filter Verb Density: ${textureA.filterVerbDensity}/1K`);
  console.log(`    Concrete Ratio: ${textureA.concreteRatio}%`);
  console.log(`    Opening: ${textureA.openingVerbStrength}`);
  console.log(`    Ending Punch: ${textureA.endingPunch}`);
  console.log(`    Triple Density: ${textureA.tripleConstructionDensity}/1K`);
  console.log(`    Thesis Density: ${textureA.thesisStatementDensity}/1K`);
  console.log(`    "Not Just" Density: ${textureA.notJustDensity}/1K`);
  console.log(`    Balanced Reflection: ${textureA.balancedReflectionCount}`);
  console.log(`    Generic Emotion: ${textureA.genericEmotionDensity}/1K`);
  console.log(`    Chatbot Patterns: ${patternsA.total} (${patternsA.density}/1K)`);
  if (textureA.diagnostics.length > 0) {
    console.log(`    Diagnostics:`);
    for (const d of textureA.diagnostics) console.log(`      ⚠️  ${d}`);
  }

  console.log(`\n  VERSION B (Anti-Chatbot Hardened):`);
  console.log(`    Composite Score: ${textureB.compositeScore} (${textureB.grade})`);
  console.log(`    Sentence Variance: σ=${textureB.sentenceLengthVariance}`);
  console.log(`    Symmetry: ${textureB.symmetryScore}%`);
  console.log(`    Filter Verb Density: ${textureB.filterVerbDensity}/1K`);
  console.log(`    Concrete Ratio: ${textureB.concreteRatio}%`);
  console.log(`    Opening: ${textureB.openingVerbStrength}`);
  console.log(`    Ending Punch: ${textureB.endingPunch}`);
  console.log(`    Triple Density: ${textureB.tripleConstructionDensity}/1K`);
  console.log(`    Thesis Density: ${textureB.thesisStatementDensity}/1K`);
  console.log(`    "Not Just" Density: ${textureB.notJustDensity}/1K`);
  console.log(`    Balanced Reflection: ${textureB.balancedReflectionCount}`);
  console.log(`    Generic Emotion: ${textureB.genericEmotionDensity}/1K`);
  console.log(`    Chatbot Patterns: ${patternsB.total} (${patternsB.density}/1K)`);
  if (textureB.diagnostics.length > 0) {
    console.log(`    Diagnostics:`);
    for (const d of textureB.diagnostics) console.log(`      ⚠️  ${d}`);
  }

  console.log(`\n  DELTA:`);
  console.log(`    Composite: ${result.delta.compositeScore > 0 ? '+' : ''}${result.delta.compositeScore} points`);
  console.log(`    Chatbot Patterns: ${result.delta.chatbotPatternDelta > 0 ? '-' : '+'}${Math.abs(result.delta.chatbotPatternDelta)} patterns`);
  console.log(`    Chatbot Density: ${result.delta.chatbotDensityDelta > 0 ? '-' : '+'}${Math.abs(result.delta.chatbotDensityDelta)}/1K`);
}

// ── Summary ──
console.log(`\n${'═'.repeat(64)}`);
console.log(`BAKEOFF SUMMARY`);
console.log(`${'═'.repeat(64)}`);

for (const r of results) {
  const improved = r.delta.compositeScore > 0;
  const icon = improved ? '✅' : '❌';
  console.log(`  ${icon} ${r.name}: ${r.versionA.texture.compositeScore} → ${r.versionB.texture.compositeScore} (${r.delta.compositeScore > 0 ? '+' : ''}${r.delta.compositeScore}) | Chatbot patterns: ${r.versionA.patterns.total} → ${r.versionB.patterns.total}`);
}

const avgDelta = Math.round(results.reduce((s, r) => s + r.delta.compositeScore, 0) / results.length);
const avgPatternDrop = Math.round(results.reduce((s, r) => s + r.delta.chatbotPatternDelta, 0) / results.length);
console.log(`\n  Average composite improvement: ${avgDelta > 0 ? '+' : ''}${avgDelta} points`);
console.log(`  Average chatbot pattern reduction: -${avgPatternDrop} patterns`);

// ── Write JSON results for reports ──
const outputPath = join(process.cwd(), 'smoke-test-output/live-anti-chatbot-bakeoff/bakeoff-results.json');
writeFileSync(outputPath, JSON.stringify({ results, avgDelta, avgPatternDrop }, null, 2));
console.log(`\n  Results written to: ${outputPath}`);
