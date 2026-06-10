/**
 * productionWiringSmoke.test.mjs
 *
 * Verifies that the polishPipelineConfig routes every project type correctly
 * and that production-path modules (dialogue repair, slop, safety, export)
 * work together for each project type.
 */

import {
  getPolishProfileForProject,
  shouldRunDialogueRepair,
  shouldRunAISlopReduction,
  shouldRunLLMSentenceRecast,
  getAllowedPolishIntensity,
  getSlopBudgetsForProject,
  getSafetyThresholdsForProject,
} from '../src/lib/polishPipelineConfig.js';
import { runAISlopReductionPass } from '../src/lib/aiSlopReduction.js';
import { detectDialogueQuoteIssues, runDialogueMechanicsPass } from '../src/lib/dialogueMechanicsRepair.js';
import { runManuscriptSafetyGate } from '../src/lib/manuscriptSafetyGate.js';
import { runPreExportSafetyGate } from '../src/lib/exportSafetyGate.js';

let passed = 0, failed = 0;
function assert(condition, name) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ FAIL: ${name}`); }
}

// ════════════════════════════════════════════════════════════════
// SECTION 1: Profile Routing Verification
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 1: Profile Routing ═══\n');

const ROUTING_TESTS = [
  // [input, expectedIntensity, expectedDialogue, label]
  [{ genre: 'fiction' }, 'high', true, 'fiction'],
  [{ genre: 'Fiction' }, 'high', true, 'Fiction (mixed case)'],
  [{ type: 'novel' }, 'high', true, 'novel (type alias)'],
  [{ genre: 'thriller' }, 'high', true, 'thriller (genre alias)'],
  [{ type: 'sci-fi' }, 'high', true, 'sci-fi (hyphen)'],
  [{ genre: 'short_story' }, 'high', true, 'short_story'],
  [{ genre: 'anthology' }, 'high', true, 'anthology'],
  [{ genre: 'nonfiction' }, 'medium', 'auto', 'nonfiction'],
  [{ genre: 'Nonfiction' }, 'medium', 'auto', 'Nonfiction (mixed case)'],
  [{ type: 'investigative_journalism' }, 'medium', 'auto', 'investigative_journalism'],
  [{ genre: 'training', type: 'manual' }, 'low', 'auto', 'training + manual'],
  [{ genre: 'training_manual' }, 'low', 'auto', 'training_manual (direct)'],
  [{ type: 'caregiving' }, 'low', 'auto', 'caregiving (type alias)'],
  [{ genre: 'business', type: 'guide' }, 'medium', 'auto', 'business + guide'],
  [{ genre: 'business_guide' }, 'medium', 'auto', 'business_guide (direct)'],
  [{ genre: 'memoir' }, 'medium', 'auto', 'memoir'],
  [{ genre: 'Memoir' }, 'medium', 'auto', 'Memoir (mixed case)'],
  [{}, 'low', 'auto', 'empty project'],
  [null, 'low', 'auto', 'null project'],
  [undefined, 'low', 'auto', 'undefined project'],
  [{ genre: 'unknown_genre_xyz' }, 'low', 'auto', 'unknown genre'],
  [{ genre: 'horror' }, 'high', true, 'horror (alias → fiction)'],
  [{ type: 'biography' }, 'medium', 'auto', 'biography (alias → nonfiction)'],
];

for (const [input, expectedIntensity, expectedDialogue, label] of ROUTING_TESTS) {
  const profile = getPolishProfileForProject(input);
  const intensity = getAllowedPolishIntensity(input);
  const budgets = getSlopBudgetsForProject(input);
  const thresholds = getSafetyThresholdsForProject(input);

  assert(intensity === expectedIntensity, `${label}: intensity=${intensity} (expected ${expectedIntensity})`);
  assert(thresholds.hardSafety === true, `${label}: hard safety always on`);
  assert(typeof budgets.maxSlopPerChapter === 'number', `${label}: slop budgets defined`);
  if (expectedDialogue === true) {
    assert(profile.dialogueRepair === true, `${label}: dialogue repair always on`);
  } else {
    assert(profile.dialogueRepair === 'auto', `${label}: dialogue repair auto-detect`);
  }
}

// ════════════════════════════════════════════════════════════════
// SECTION 2: Real Project-Type Smoke Tests
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 2: Project-Type Smoke Tests ═══\n');

// ── Fixture 1: Fiction Novel ──
console.log('--- Fiction Novel ---');
const FICTION_P = { genre: 'fiction', type: 'novel', title: 'Test Novel' };
const FICTION_T = `Chapter 1: The Chase

Jackson pressed his back against the cold brick wall. The alley stank of rust.

The game is the model, Jackson," Reyes retorted. And I thrive on efficiency," he countered.

She felt a cold wave of dread wash over her. The weight of the situation settled like concrete.

I'm calculating potential," she corrected him. Jackson felt dizzy. He felt hollow.`;

assert(getAllowedPolishIntensity(FICTION_P) === 'high', 'Fiction: intensity high');
assert(shouldRunDialogueRepair(FICTION_T, FICTION_P) === true, 'Fiction: dialogue repair on');
assert(shouldRunAISlopReduction(FICTION_P) === true, 'Fiction: slop reduction on');
const fDiag = detectDialogueQuoteIssues(FICTION_T, {});
assert(fDiag.count >= 2, 'Fiction: dialogue issues detected');
const fRepaired = runDialogueMechanicsPass(FICTION_T, { stage: 'smoke-test' });
const fDiagAfter = detectDialogueQuoteIssues(fRepaired.text, {});
assert(fDiagAfter.count === 0, 'Fiction: dialogue repaired to 0');
const fSlop = runAISlopReductionPass(FICTION_T);
assert(fSlop.beforeTotal > 0, 'Fiction: slop detected');
const fSafety = runManuscriptSafetyGate(FICTION_T, { project: FICTION_P });
assert(fSafety.ok, 'Fiction: safety gate passes');
const fExport = await runPreExportSafetyGate([{ content_md: fRepaired.text, chapter_number: 1 }], { project: FICTION_P });
assert(!fExport.blocked, 'Fiction: export gate passes after repair');

// ── Fixture 2: Nonfiction ──
console.log('--- Nonfiction Investigative ---');
const NF_P = { genre: 'nonfiction', type: 'investigative_journalism', title: 'The Algorithm Wars' };
const NF_T = `Chapter 7: The Regulatory Gap

The weight of the evidence was undeniable. For three decades, the telecommunications industry had systematically dismantled the regulatory frameworks designed to enforce consumer protection.

The investigation revealed something fundamental shifted in 2018. The revolving door between regulatory agencies and industry hadn't merely created conflicts of interest—it had eliminated oversight entirely.

Consumer complaints increased by 340% between 2019 and 2024, while enforcement actions decreased by 78%.`;

assert(getAllowedPolishIntensity(NF_P) === 'medium', 'Nonfiction: intensity medium');
assert(shouldRunDialogueRepair(NF_T, NF_P) === false, 'Nonfiction: no dialogue detected');
assert(shouldRunAISlopReduction(NF_P) === true, 'Nonfiction: slop reduction on');
const nfSafety = runManuscriptSafetyGate(NF_T, { project: NF_P });
assert(nfSafety.ok, 'Nonfiction: safety gate passes');

// ── Fixture 3: Training Manual ──
console.log('--- Training Manual ---');
const TM_P = { genre: 'training', type: 'manual', title: 'DSP Training Guide' };
const TM_T = `Chapter 4: Documentation Standards

## Learning Objectives

After completing this chapter, you will be able to:

1. Identify the key components of proper service documentation
2. Complete daily progress notes in compliance with state requirements
3. Recognize and report critical incidents according to protocol

### Progress Notes

Each progress note should include:
- Date and time of service
- Description of activities
- Individual's response and participation level`;

assert(getAllowedPolishIntensity(TM_P) === 'low', 'Training: intensity low');
assert(shouldRunDialogueRepair(TM_T, TM_P) === false, 'Training: no dialogue detected');
assert(shouldRunAISlopReduction(TM_P) === true, 'Training: slop reduction on (low)');
assert(shouldRunLLMSentenceRecast(TM_P, { model: 'gemini', available: true }) === false, 'Training: LLM recast disabled');
const tmSafety = runManuscriptSafetyGate(TM_T, { project: TM_P });
assert(tmSafety.ok, 'Training: safety gate passes (compliance terms not flagged)');

// ── Fixture 4: Business Guide ──
console.log('--- Business Guide ---');
const BG_P = { genre: 'business', type: 'guide', title: 'Scaling Your SaaS Startup' };
const BG_T = `Chapter 2: Measuring What Matters

The operational efficiency of your pipeline determines whether you survive past Series A. You need measurable KPIs, quantifiable growth metrics, and an optimized feedback loop.

- Track Net Promoter Score weekly
- Monitor churn rate by cohort
- Run A/B tests on onboarding flows
- Measure time-to-value for each user segment

Remember: what gets measured gets managed.`;

assert(getAllowedPolishIntensity(BG_P) === 'medium', 'Business: intensity medium');
assert(shouldRunDialogueRepair(BG_T, BG_P) === false, 'Business: no dialogue detected');
assert(shouldRunLLMSentenceRecast(BG_P, { model: 'gemini', available: true }) === false, 'Business: LLM recast disabled');
const bgSafety = runManuscriptSafetyGate(BG_T, { project: BG_P });
assert(bgSafety.ok, 'Business: safety gate passes');

// ── Fixture 5: Memoir ──
console.log('--- Memoir ---');
const MEM_P = { genre: 'memoir', title: 'After the Fire' };
const MEM_T = `Chapter 12: Coming Home

I felt the ground shift under me the moment I stepped off the bus.

"You look different," Mom said, studying me from the porch.

I felt dizzy. The smell of lilacs hit me like a wall.

But that ignores the real question," she replied. "Are you different?"

I felt myself stumbling over the answer.`;

assert(getAllowedPolishIntensity(MEM_P) === 'medium', 'Memoir: intensity medium');
assert(shouldRunDialogueRepair(MEM_T, MEM_P) === true, 'Memoir: dialogue auto-detected');
assert(shouldRunLLMSentenceRecast(MEM_P, { model: 'gemini', available: true }) === true, 'Memoir: LLM recast enabled');
const memDiag = detectDialogueQuoteIssues(MEM_T, {});
assert(memDiag.count >= 1, 'Memoir: dialogue issue detected');
const memRepaired = runDialogueMechanicsPass(MEM_T, { stage: 'smoke-test' });
const memDiagAfter = detectDialogueQuoteIssues(memRepaired.text, {});
assert(memDiagAfter.count === 0, 'Memoir: dialogue repaired to 0');
const memSafety = runManuscriptSafetyGate(MEM_T, { project: MEM_P });
assert(memSafety.ok, 'Memoir: safety gate passes');

// ── Fixture 6: Unknown/Legacy ──
console.log('--- Unknown/Legacy ---');
const UNK_P = {};
const UNK_T = `Chapter 1: Introduction

This is a test project with no defined type. It should receive conservative defaults.

The system should handle this gracefully without any assumptions about genre.`;

assert(getAllowedPolishIntensity(UNK_P) === 'low', 'Unknown: intensity low (conservative)');
assert(shouldRunAISlopReduction(UNK_P) === false, 'Unknown: slop reduction off (conservative)');
assert(shouldRunLLMSentenceRecast(UNK_P, { model: 'gemini', available: true }) === false, 'Unknown: LLM recast disabled');
const unkThresholds = getSafetyThresholdsForProject(UNK_P);
assert(unkThresholds.hardSafety === true, 'Unknown: hard safety on');
const unkSafety = runManuscriptSafetyGate(UNK_T, { project: UNK_P });
assert(unkSafety.ok, 'Unknown: safety gate passes');

// ── Fixture 7: Corrupted ──
console.log('--- Corrupted Project ---');
const CORRUPT_P = { genre: 'fiction' };
const CORRUPT_T = `Chapter 1: The Beginning

Action Plan: Continue with the story arc. Best Next Move: push into the second act.

The character stepped into Unity Supported Living Services headquarters.

She was a was. He were running. a obvious mistake.`;

const corruptSafety = runManuscriptSafetyGate(CORRUPT_T, { project: CORRUPT_P });
assert(!corruptSafety.ok, 'Corrupted: safety gate BLOCKS');
assert(corruptSafety.processLeaks.hasLeak, 'Corrupted: process leaks detected');
assert(corruptSafety.contamination.hasContamination, 'Corrupted: contamination detected');
assert(corruptSafety.malformed.hasMalformed, 'Corrupted: malformed grammar detected');
assert(corruptSafety.recommendedAction === 'REJECT_REGENERATE', 'Corrupted: REJECT_REGENERATE');

const corruptExport = await runPreExportSafetyGate(
  [{ content_md: CORRUPT_T, chapter_number: 1, title: 'Test' }],
  { project: CORRUPT_P }
);
assert(corruptExport.blocked, 'Corrupted: export gate BLOCKS');

// ════════════════════════════════════════════════════════════════
// SECTION 3: LLM Recast Runtime Safety
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 3: LLM Recast Runtime Safety ═══\n');

// Verify llm-recast-map.mjs is NOT imported by production code
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

function searchForImport(dir, pattern) {
  const files = [];
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(full);
      } else if (entry.isFile() && /\.(jsx?|mjs|ts)$/.test(entry.name)) {
        const content = readFileSync(full, 'utf-8');
        if (content.includes(pattern)) {
          files.push(full);
        }
      }
    }
  }
  walk(dir);
  return files;
}

const recastMapImports = searchForImport('/Users/cliff/Downloads/UBS/src', 'llm-recast-map');
assert(recastMapImports.length === 0, 'No production code imports llm-recast-map');

// Verify no DET character names in llmSentenceRecast.js
const recastContent = readFileSync('/Users/cliff/Downloads/UBS/src/lib/llmSentenceRecast.js', 'utf-8');
const detNames = ['Mira', 'Marcus', 'Elena', 'Aether', 'Julian', 'Priya', 'Darius', 'Ravi', 'NexusStream'];
for (const name of detNames) {
  assert(!recastContent.includes(name), `llmSentenceRecast.js: no "${name}" hardcoding`);
}

// Verify llmSentenceRecast.js has no chapter-specific behavior
assert(!recastContent.includes('chapter_number'), 'llmSentenceRecast.js: no chapter_number logic');
assert(!recastContent.includes('Chapter 1'), 'llmSentenceRecast.js: no "Chapter 1" hardcoding');
assert(!recastContent.includes('Chapter 18'), 'llmSentenceRecast.js: no "Chapter 18" hardcoding');

// ════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(60));
console.log(`PRODUCTION WIRING SMOKE: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log('='.repeat(60));
if (failed > 0) {
  console.log(`${failed} test(s) FAILED ❌`);
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED ✅');
}
