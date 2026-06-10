/**
 * globalPolishPipelineRegression.test.mjs
 *
 * Cross-project fixture tests for the generalized polish/export pipeline.
 * Verifies that all pipeline modules work with any project type, not just DET.
 */

import { runAISlopReductionPass, countAISlopPatterns } from '../src/lib/aiSlopReduction.js';
import { detectDialogueQuoteIssues, runDialogueMechanicsPass } from '../src/lib/dialogueMechanicsRepair.js';
import { applyLLMSentenceRecasts } from '../src/lib/llmSentenceRecast.js';
import { runManuscriptSafetyGate } from '../src/lib/manuscriptSafetyGate.js';
import {
  getPolishProfileForProject,
  shouldRunDialogueRepair,
  shouldRunAISlopReduction,
  shouldRunLLMSentenceRecast,
  getAllowedPolishIntensity,
  getSlopBudgetsForProject,
  getSafetyThresholdsForProject,
} from '../src/lib/polishPipelineConfig.js';

let passed = 0, failed = 0;
function assert(condition, name) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ FAIL: ${name}`); }
}

// ── FIXTURE 1: Fiction Thriller ──────────────────────────────────

console.log('\n=== FIXTURE 1: Fiction Thriller ===');

const FICTION_PROJECT = { genre: 'fiction', type: 'novel', title: 'Shadow Protocol' };

const FICTION_TEXT = `Chapter 3: The Dead Drop

Sarah pressed her back against the cold brick wall, her breath coming in ragged gasps. The alley stank of rust and old rain.

The game is the model, Sarah," Kovacs retorted, his voice edged with something that felt like contempt. And I thrive on efficiency," he countered with a thin smile.

She felt a cold wave of dread wash over her entire body. Sarah felt the weight of the suppressed Beretta in her jacket pocket.

It wasn't just a mission; it was a death sentence wrapped in bureaucratic language. The sheer weight of what they were asking settled over her like concrete.

I'm calculating potential," she corrected him, stepping sideways toward the fire escape. But that ignores the nonlinear variable!" Sarah shot back, her hand finding the rung.

She felt dizzy. She felt hollow. She felt the familiar pressure building behind her temples.`;

// 1.1 Profile detection
const fictionProfile = getPolishProfileForProject(FICTION_PROJECT);
assert(fictionProfile.polishIntensity === 'high', 'Fiction project detects fiction profile (intensity: high)');
assert(shouldRunDialogueRepair(FICTION_TEXT, FICTION_PROJECT) === true, 'Dialogue repair enabled for fiction');
assert(shouldRunAISlopReduction(FICTION_PROJECT) === true, 'Slop reduction enabled for fiction');
assert(getAllowedPolishIntensity(FICTION_PROJECT) === 'high', 'Fiction intensity is high');

// 1.2 Dialogue repair
const fictionDialogue = detectDialogueQuoteIssues(FICTION_TEXT, {});
assert(fictionDialogue.count >= 2, 'Fiction dialogue issues detected (missing quotes)');
const fictionRepaired = runDialogueMechanicsPass(FICTION_TEXT, { stage: 'test' });
const fictionDialogueAfter = detectDialogueQuoteIssues(fictionRepaired.text, {});
assert(fictionDialogueAfter.count === 0, 'Fiction dialogue issues repaired to 0');

// 1.3 Slop reduction with non-DET character names
const fictionSlop = runAISlopReductionPass(FICTION_TEXT);
assert(fictionSlop.beforeTotal > 0, 'Fiction slop detected (count: ' + fictionSlop.beforeTotal + ')');
assert(fictionSlop.afterTotal <= fictionSlop.beforeTotal, 'Fiction slop reduced or equal');

// 1.4 LLM sentence recast (with non-DET names)
const fictionRecast = applyLLMSentenceRecasts(fictionSlop.text);
// "Sarah felt a cold wave" should match the generic [A-Z][a-z]+ pattern
assert(fictionRecast.applied >= 0, 'Fiction recast engine runs without error');

// 1.5 Safety gate clean
const fictionSafety = runManuscriptSafetyGate(FICTION_TEXT, { project: FICTION_PROJECT });
assert(fictionSafety.ok, 'Fiction text passes safety gate');


// ── FIXTURE 2: Nonfiction Investigative ──────────────────────────

console.log('\n=== FIXTURE 2: Nonfiction Investigative ===');

const NONFICTION_PROJECT = { genre: 'nonfiction', type: 'investigative_journalism', title: 'The Algorithm Wars' };

const NONFICTION_TEXT = `Chapter 7: The Regulatory Gap

The weight of the evidence was undeniable. For three decades, the telecommunications industry had not merely lobbied against consumer protection; it had systematically dismantled the regulatory frameworks designed to enforce it.

The investigation revealed that something shifted fundamentally in 2018, when the Federal Trade Commission quietly removed seventeen enforcement provisions from its oversight mandate. This wasn't just an administrative adjustment; it was a calculated surrender of public interest to private capital.

Dr. Martinez's analysis confirmed what whistleblowers had alleged: the revolving door between regulatory agencies and industry hadn't merely created conflicts of interest—it had eliminated the concept of oversight entirely.

The data painted a stark picture. Consumer complaints increased by 340% between 2019 and 2024, while enforcement actions decreased by 78%. Something had fundamentally changed in how the system operated.`;

const nonfictionProfile = getPolishProfileForProject(NONFICTION_PROJECT);
assert(nonfictionProfile.polishIntensity === 'medium', 'Nonfiction project detects nonfiction profile');
assert(getAllowedPolishIntensity(NONFICTION_PROJECT) === 'medium', 'Nonfiction intensity is medium');

// Dialogue detection should be auto — no dialogue tags here
assert(shouldRunDialogueRepair(NONFICTION_TEXT, NONFICTION_PROJECT) === false, 'No dialogue repair on non-dialogue nonfiction');

// Slop reduction should find patterns
const nonfictionSlop = runAISlopReductionPass(NONFICTION_TEXT);
assert(nonfictionSlop.beforeTotal > 0, 'Nonfiction slop detected (count: ' + nonfictionSlop.beforeTotal + ')');

// Safety gate clean
const nonfictionSafety = runManuscriptSafetyGate(NONFICTION_TEXT, { project: NONFICTION_PROJECT });
assert(nonfictionSafety.ok, 'Nonfiction text passes safety gate');


// ── FIXTURE 3: Training Manual ───────────────────────────────────

console.log('\n=== FIXTURE 3: Training Manual ===');

const TRAINING_PROJECT = { genre: 'training', type: 'manual', title: 'Direct Support Professional Training Guide' };

const TRAINING_TEXT = `Chapter 4: Documentation Standards

## Learning Objectives

After completing this chapter, you will be able to:

1. Identify the key components of proper service documentation
2. Complete daily progress notes in compliance with state requirements
3. Recognize and report critical incidents according to protocol

## Documentation Requirements

All direct support professionals must maintain accurate, timely documentation for each individual served. Documentation must be:

- Written within 24 hours of the event
- Objective and factual
- Free of judgmental language
- Signed and dated

### Progress Notes

Each progress note should include:
- Date and time of service
- Description of activities
- Individual's response and participation level
- Any concerns or changes in condition

Remember: good documentation protects both you and the individual you serve.`;

const trainingProfile = getPolishProfileForProject(TRAINING_PROJECT);
assert(trainingProfile.preserveStructure === true, 'Training project detects training_manual profile');
assert(getAllowedPolishIntensity(TRAINING_PROJECT) === 'low', 'Training intensity is low');

// No dialogue detection
assert(shouldRunDialogueRepair(TRAINING_TEXT, TRAINING_PROJECT) === false, 'No dialogue repair on training manual');

// Slop reduction should be minimal
const trainingSlop = countAISlopPatterns(TRAINING_TEXT);
assert(trainingSlop.total >= 0, 'Training manual slop count computed (count: ' + trainingSlop.total + ')');

// Safety gate: business terms should be ALLOWED for training manuals
const trainingSafety = runManuscriptSafetyGate(TRAINING_TEXT, { project: TRAINING_PROJECT });
assert(trainingSafety.ok, 'Training manual passes safety gate (compliance language not falsely flagged)');

// Should NOT flag "compliance" or "documentation" as contamination
const contam = trainingSafety.contamination;
assert(!contam.hasContamination || contam.matches.length === 0, 'Training text not falsely contaminated');


// ── FIXTURE 4: Business Guide ────────────────────────────────────

console.log('\n=== FIXTURE 4: Business Guide ===');

const BUSINESS_PROJECT = { genre: 'business', type: 'guide', title: 'Scaling Your SaaS Startup' };

const BUSINESS_TEXT = `Chapter 2: Measuring What Matters

The operational efficiency of your pipeline determines whether you survive past Series A. You need measurable KPIs, quantifiable growth metrics, and an optimized feedback loop between your product and market.

Your interface with customers must be frictionless. This is a measurable goal:

- Track Net Promoter Score weekly
- Monitor churn rate by cohort
- Run A/B tests on onboarding flows
- Measure time-to-value for each user segment

The operational overhead of scaling is often underestimated. Every new hire adds communication complexity. Every new feature adds maintenance burden. The feedback loop between engineering velocity and customer satisfaction must be continuously monitored.

Remember: what gets measured gets managed. Build your dashboard around the metrics that directly predict revenue retention.`;

const businessProfile = getPolishProfileForProject(BUSINESS_PROJECT);
assert(businessProfile.preserveStructure === true, 'Business project detects business_guide profile');
assert(getAllowedPolishIntensity(BUSINESS_PROJECT) === 'medium', 'Business intensity is medium');

// Business guide has slop-like words that are genre-appropriate
const businessSlop = countAISlopPatterns(BUSINESS_TEXT);
assert(businessSlop.total > 0, 'Business text has slop-like patterns (expected: ' + businessSlop.total + ')');

// Safety gate: business terms allowed
const businessSafety = runManuscriptSafetyGate(BUSINESS_TEXT, { project: BUSINESS_PROJECT });
assert(businessSafety.ok, 'Business guide passes safety gate');


// ── FIXTURE 5: Memoir ────────────────────────────────────────────

console.log('\n=== FIXTURE 5: Memoir ===');

const MEMOIR_PROJECT = { genre: 'memoir', type: 'nonfiction', title: 'After the Fire' };

const MEMOIR_TEXT = `Chapter 12: Coming Home

I felt the ground shift under me the moment I stepped off the bus. Not literally—though the heat-warped asphalt did seem to buckle in the August sun—but something deeper. Something molecular.

The house looked smaller than I remembered. I felt a sudden, sharp pang of recognition mixed with betrayal. This was home, but it wasn't mine anymore.

"You look different," Mom said, studying me from the porch. Her voice carried more weight than the words.

I felt dizzy. The smell of lilacs and motor oil—her garden, his garage—hit me like a wall.

"Everyone looks different after a year," I said, trying for casual.

But that ignores the real question," she replied, not unkindly. "Are you different?"

I felt myself stumbling over the answer before it formed. Yes. No. Both. The honest response was: I don't know if what I am now is better or worse. It's just what survived.`;

const memoirProfile = getPolishProfileForProject(MEMOIR_PROJECT);
assert(memoirProfile.preserveVoice === true && memoirProfile.polishIntensity === 'medium', 'Memoir project detects memoir profile');

// Memoir has dialogue — auto-detect should find it
assert(shouldRunDialogueRepair(MEMOIR_TEXT, MEMOIR_PROJECT) === true, 'Memoir dialogue detected by auto-detect');

// Memoir has "felt" overuse
const memoirSlop = runAISlopReductionPass(MEMOIR_TEXT);
assert(memoirSlop.beforeTotal > 0, 'Memoir slop detected (count: ' + memoirSlop.beforeTotal + ')');

// Dialogue repair should fix the missing opening quote
const memoirDialogue = detectDialogueQuoteIssues(MEMOIR_TEXT, {});
assert(memoirDialogue.count >= 1, 'Memoir missing dialogue quote detected');
const memoirRepaired = runDialogueMechanicsPass(MEMOIR_TEXT, { stage: 'test' });
const memoirDialogueAfter = detectDialogueQuoteIssues(memoirRepaired.text, {});
assert(memoirDialogueAfter.count === 0, 'Memoir dialogue issues repaired to 0');

// Safety gate clean
const memoirSafety = runManuscriptSafetyGate(MEMOIR_TEXT, { project: MEMOIR_PROJECT });
assert(memoirSafety.ok, 'Memoir passes safety gate');


// ── FIXTURE 6: Corrupted Project ─────────────────────────────────

console.log('\n=== FIXTURE 6: Corrupted Project (must hard-block) ===');

const CORRUPTED_PROJECT = { genre: 'fiction', type: 'novel', title: 'Test Corrupted' };

const CORRUPTED_TEXT = `Chapter 1: The Beginning

Action Plan: Continue with the story arc. The opening is sharp, highly polished and well-paced.

Analysis & Strengths:
The prose hits all the required marks. Best Next Move: push into the second act.

The character stepped into Unity Supported Living Services headquarters. She reviewed the care documentation on her desk, checking compliance documentation for the quarterly review.

She was a was. He were running. You was the best. a obvious mistake was made.

They is good people. She were those just numbers.`;

// Safety gate MUST hard-block
const corruptedSafety = runManuscriptSafetyGate(CORRUPTED_TEXT, { project: CORRUPTED_PROJECT });
assert(!corruptedSafety.ok, 'Corrupted text FAILS safety gate');
assert(corruptedSafety.processLeaks.hasLeak, 'Process leaks detected in corrupted text');
assert(corruptedSafety.contamination.hasContamination, 'Contamination detected in corrupted text');
assert(corruptedSafety.malformed.hasMalformed, 'Malformed grammar detected in corrupted text');
assert(corruptedSafety.recommendedAction === 'REJECT_REGENERATE', 'Corrupted text gets REJECT_REGENERATE');


// ── FIXTURE 7: No DET References Required ────────────────────────

console.log('\n=== FIXTURE 7: No DET Hardcoding in Runtime ===');

// All modules should work without any DET-specific references
const GENERIC_TEXT = `Chapter 5: The Confrontation

Jackson felt the weight of responsibility pressing down on him. He felt a sudden surge of panic.

I'm not backing down," Jackson declared, squaring his shoulders. And I won't apologize," he added firmly.

The situation wasn't just complicated; it was impossible. Something shifted in the room's atmosphere.

Victoria felt hollow. The news landed like a physical blow. She felt herself shrinking under his gaze.`;

const genericProject = { genre: 'fiction', type: 'short_story', title: 'The Reckoning' };

// All pipeline stages should work
const genericDiag = detectDialogueQuoteIssues(GENERIC_TEXT, {});
assert(genericDiag.count >= 1, 'Generic fiction dialogue issues detected');

const genericRepaired = runDialogueMechanicsPass(GENERIC_TEXT, { stage: 'test' });
const genericDiagAfter = detectDialogueQuoteIssues(genericRepaired.text, {});
assert(genericDiagAfter.count === 0, 'Generic fiction dialogue repaired to 0');

const genericSlop = runAISlopReductionPass(GENERIC_TEXT);
assert(genericSlop.beforeTotal > 0, 'Generic slop detected');
assert(genericSlop.afterTotal <= genericSlop.beforeTotal, 'Generic slop reduced or equal');

// LLM sentence recast works with non-DET names
const genericRecast = applyLLMSentenceRecasts(genericSlop.text);
assert(genericRecast.applied >= 0, 'Generic recast engine runs');

const genericSafety = runManuscriptSafetyGate(GENERIC_TEXT, { project: genericProject });
assert(genericSafety.ok, 'Generic fiction passes safety gate');


// ── FIXTURE 8: Profile Config Coverage ───────────────────────────

console.log('\n=== FIXTURE 8: Profile Config Coverage ===');

// Test that all profile types work
const profiles = [
  { genre: 'fiction' },
  { genre: 'nonfiction' },
  { genre: 'training', type: 'manual' },
  { genre: 'business', type: 'guide' },
  { genre: 'memoir' },
  { genre: 'unknown_genre' },
  {},
];

for (const p of profiles) {
  const profile = getPolishProfileForProject(p);
  const budgets = getSlopBudgetsForProject(p);
  const thresholds = getSafetyThresholdsForProject(p);
  assert(typeof profile === 'object' && profile.hardSafety === true, `Profile detected for ${JSON.stringify(p)}: intensity=${profile.polishIntensity}`);
  assert(thresholds.hardSafety === true, `Hard safety always on for intensity=${profile.polishIntensity}`);
  assert(typeof budgets.maxSlopPerChapter === 'number', `Slop budgets defined for intensity=${profile.polishIntensity}`);
}

// LLM recast only with model
assert(shouldRunLLMSentenceRecast(FICTION_PROJECT, { model: 'gemini-2.5-pro', available: true }) === true, 'LLM recast enabled with model');
assert(shouldRunLLMSentenceRecast(FICTION_PROJECT, {}) === false, 'LLM recast disabled without model');
assert(shouldRunLLMSentenceRecast(TRAINING_PROJECT, { model: 'gemini-2.5-pro', available: true }) === false, 'LLM recast disabled for training manual');


// ── SUMMARY ──────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log(`GLOBAL POLISH PIPELINE: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log('='.repeat(60));
if (failed > 0) {
  console.log(`${failed} test(s) FAILED ❌`);
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED ✅');
}
