#!/usr/bin/env node
// TESTSWEEP-1 — legacy test sweep runner.
//
// Before this, `tests/` had 153 files and package.json's two scripts
// (`test:narrative-connect`, `test:polish-pipeline`) wired only 43 of them.
// The other 110 were silently dead: nothing ran them, nothing reported on
// them, and a real regression under one of them could sit red for months
// with zero signal. This runner and its CLASSIFICATION map close that gap —
// every file under `tests/` not already wired into the two package.json
// scripts is EITHER actually run here, or named with a one-line reason it
// is not (needs live infrastructure this environment does not have, asserts
// a behavior the codebase intentionally retired, or was removed outright).
// No file is silently unaccounted for.
//
// Unlike test/run-all.mjs (which owns a strict PASS/FAIL-line convention
// for its own acceptance batteries), files under tests/ predate that
// convention and use a mix of styles — some print "PASS "/"FAIL ", some
// print "✅"/"❌", some use node:assert directly with no success output at
// all. Exit code is therefore the authority for a `run` file here, not a
// printed-line count; check/pass lines are counted only where the file's
// own convention makes them detectable, for an informational total.
//
//   node tests/run-legacy.mjs            all classified + run files
//   node tests/run-legacy.mjs holder     only files whose name contains "holder"
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const ALIAS_LOADER = path.join(DIR, 'helpers', 'aliasLoader.mjs');

/**
 * Every tests/*.mjs|*.js file NOT wired into package.json's
 * test:narrative-connect / test:polish-pipeline scripts appears here EXACTLY
 * once. `class` is one of:
 *   'run'            — passes today, exercises live code; the runner runs it.
 *   'live-only'      — needs infrastructure this environment does not have
 *                       right now (a running Ollama/router endpoint, or a
 *                       test-harness package that is not a project
 *                       dependency); skipped with the reason printed.
 *   'regression'     — asserts behavior the codebase still intends and
 *                       currently FAILS; skipped with the reason, never
 *                       fixed/deleted/weakened here — a finding for Cowork
 *                       Claude.
 *   'deleted'        — removed outright: imports/tests a mechanism this repo
 *                       has since retired (commit cited in the reason), or
 *                       is a scratch script with no assertions. Absent from
 *                       disk as of this commit.
 *   'artifact-writer'— writes into the tracked smoke-test-output/ tree when
 *                       run; skipped so the runner never dirties tracked
 *                       files.
 */
export const CLASSIFICATION = {
  // ── run: passes today, exercises live code ──
  'aiCheckDimensions.test.mjs': { class: 'run' },
  'antiChatbotChunkProtection.test.mjs': { class: 'run' },
  'antiChatbotOvercorrectionGuard.test.mjs': { class: 'run' },
  'antiChatbotProseQuality.test.mjs': { class: 'run' },
  'antiChatbotRecastPipeline.test.mjs': { class: 'run' },
  'antiChatbotRecastSafetyWiring.test.mjs': { class: 'run' },
  'appRecentWorkflowUIWiring.test.mjs': { class: 'run' },
  'comfyuiClient.test.mjs': { class: 'run' },
  'conservativeRecastLengthPreservation.test.mjs': { class: 'run' },
  'coverArtGeneratorAdvancedPanel.test.mjs': { class: 'run' },
  'coverComfyUILiveProof.test.mjs': { class: 'run' },
  'coverComfyWorkflows.test.mjs': { class: 'run' },
  'coverExport.test.mjs': { class: 'run' },
  'coverGenreTemplates.test.mjs': { class: 'run' },
  'coverProductionWorkflow.test.mjs': { class: 'run' },
  'coverPromptBuilder.test.mjs': { class: 'run' },
  'coverSafety.test.mjs': { class: 'run' },
  'coverSeriesConsistency.test.mjs': { class: 'run' },
  'coverTabComfyUIWiring.test.mjs': { class: 'run' },
  'coverTabGalleryPersistence.test.mjs': { class: 'run' },
  'coverTabModelSelectorUI.test.mjs': { class: 'run' },
  'coverTabPromptBuilderWiring.test.mjs': { class: 'run' },
  'coverTypographyComposer.test.mjs': { class: 'run' },
  'coverUIWiringAudit.test.mjs': { class: 'run' },
  'coverVariationManager.test.mjs': { class: 'run' },
  'critiquePipeline.test.mjs': { class: 'run' },
  'critiqueWiringGuard.test.mjs': { class: 'run' },
  'digitalEquityPipelineRegression.mjs': { class: 'run' },
  'exactFinalLine.test.mjs': { class: 'run' },
  'exportEditorOverride.test.mjs': { class: 'run' },
  'exportRefreshResolver.test.mjs': { class: 'run' },
  'genreConditionalAntiChatbotRules.test.mjs': { class: 'run' },
  'literaryRecastAntiFlattening.test.mjs': { class: 'run' },
  'liveNonfictionHeadingGateStress.test.mjs': { class: 'run' },
  'liveWeakNonfictionMicroRecastV2.test.mjs': { class: 'run' },
  'manuscriptEvidence.test.mjs': { class: 'run' },
  'nonfictionAntiChatbotRegressionGuard.test.mjs': { class: 'run' },
  'nonfictionCitationStructureRecastGuard.test.mjs': { class: 'run' },
  'nonfictionConservativeRecastMode.test.mjs': { class: 'run' },
  'nonfictionDeterministicCleanup.test.mjs': { class: 'run' },
  'nonfictionMicroRecastPipeline.test.mjs': { class: 'run' },
  'nonfictionMicroRecastStructureGuard.test.mjs': { class: 'run' },
  'nonfictionRecastAuthorityPrompt.test.mjs': { class: 'run' },
  'planCrossCheck.test.mjs': { class: 'run' },
  'prosePolisherRecastTuning.test.mjs': { class: 'run' },
  'recastAcceptanceQualityGuard.test.mjs': { class: 'run' },
  'recastFilterVerbTargeting.test.mjs': { class: 'run' },
  'recastHeadingPreservation.test.mjs': { class: 'run' },
  'recastLengthRetry.test.mjs': { class: 'run' },
  'recastModelRouting.test.mjs': { class: 'run' },
  'recastModelfileRegressionGuard.test.mjs': { class: 'run' },
  'recastRoutingReport.test.mjs': { class: 'run' },
  'referenceIntegrityProductionWiring.test.mjs': { class: 'run' },
  'runnerAsyncAwaitGuard.test.mjs': { class: 'run' },
  'sceneContractGate.test.mjs': { class: 'run' },
  'sceneExecutionAcceptanceLiveWiring.test.mjs': { class: 'run' },
  'sceneExecutionAcceptanceRunners.test.mjs': { class: 'run' },
  'sceneWriterPromptDeseed.test.mjs': { class: 'run' },
  'seriesContractGateContextValidation.test.mjs': { class: 'run' },
  'seriesLiveWiringFix.test.mjs': { class: 'run' },
  'seriesPipelineHardening.test.mjs': { class: 'run' },
  'setupFoundationWiring.test.mjs': { class: 'run' },
  'storyArchitectChatWiring.test.mjs': { class: 'run' },
  'surgicalFix.test.mjs': { class: 'run' },
  'violenceLevelWiring.test.mjs': { class: 'run' },
  'weakNonfictionHeadingCitationStress.test.mjs': { class: 'run' },

  // ── live-only: missing the `vitest` package (not a project dependency; no
  // script anywhere installs or runs it — these cannot execute in any
  // environment until that changes, live server or not) ──
  'beatJsonReliability.test.js': { class: 'live-only', reason: "imports the 'vitest' package, which is not a project dependency and is not installed anywhere in this repo — needs the vitest harness present to run at all, not a code fix" },
  'draftIntegrityReport.test.js': { class: 'live-only', reason: "imports the 'vitest' package, which is not a project dependency and is not installed anywhere in this repo — needs the vitest harness present to run at all, not a code fix" },
  'evidenceContext.test.js': { class: 'live-only', reason: "imports the 'vitest' package, which is not a project dependency and is not installed anywhere in this repo — needs the vitest harness present to run at all, not a code fix" },
  'kdpKeywordValidator.test.js': { class: 'live-only', reason: "imports the 'vitest' package, which is not a project dependency and is not installed anywhere in this repo — needs the vitest harness present to run at all, not a code fix" },
  'parallelDraftPool.test.js': { class: 'live-only', reason: "imports the 'vitest' package, which is not a project dependency and is not installed anywhere in this repo — needs the vitest harness present to run at all, not a code fix" },
  'verifiedChapterSave.test.js': { class: 'live-only', reason: "imports the 'vitest' package, which is not a project dependency and is not installed anywhere in this repo — needs the vitest harness present to run at all, not a code fix" },

  // ── live-only: needs a running local LLM endpoint ──
  'e2eSmokeTest.mjs': { class: 'live-only', reason: 'Phase 0 pre-flight calls the Ollama health check and exits before any real test runs when it fails ("Cannot proceed without Ollama") — needs a running Ollama instance' },
  'qualityCalibrationRerun.mjs': { class: 'live-only', reason: 'calls Ollama directly (callOllama) and fails with ECONNREFUSED 127.0.0.1:11434 with nothing running there — needs a running Ollama instance' },

  // ── artifact-writer: references the tracked smoke-test-output/ tree ──
  // qualityCalibration.mjs WRITES there (verified live: 7 tracked files
  // modified per run). The six live-*-bakeoff files below only READ a
  // pre-recorded results file checked into that tree (verified live: none
  // of them dirty the tree when run) — but they still depend on tracked
  // fixture output rather than exercising the pipeline live, so they are
  // kept out of 'run' for the same reason: a suite member that revolves
  // around smoke-test-output is not exercising live code the way a normal
  // 'run' file does.
  'qualityCalibration.mjs': { class: 'artifact-writer', reason: 'writes results into the tracked smoke-test-output/blockbuster-quality-calibration/ tree on every run (verified live: 7 tracked files modified) — running it as part of a suite would leave the working tree dirty' },
  'antiChatbotLongformDriftGuard.test.mjs': { class: 'artifact-writer', reason: 'reads a pre-recorded live-bakeoff-results.json from the tracked smoke-test-output/live-ollama-anti-chatbot-compliance/ tree rather than exercising generation live; does not write when run, but validates a fixture, not the pipeline' },
  'liveAntiChatbotBakeoff.test.mjs': { class: 'artifact-writer', reason: 'reads a pre-recorded bakeoff-results.json from the tracked smoke-test-output/live-anti-chatbot-bakeoff/ tree rather than exercising generation live; does not write when run, but validates a fixture, not the pipeline' },
  'liveGenreConditionalRecastBakeoff.test.mjs': { class: 'artifact-writer', reason: 'reads pre-recorded results from the tracked smoke-test-output/live-genre-conditional-recast-bakeoff/ tree rather than exercising generation live; does not write when run, but validates a fixture, not the pipeline' },
  'liveOllamaAntiChatbotCompliance.test.mjs': { class: 'artifact-writer', reason: 'reads a pre-recorded live-bakeoff-results.json from the tracked smoke-test-output/live-ollama-anti-chatbot-compliance/ tree rather than exercising generation live; does not write when run, but validates a fixture, not the pipeline' },
  'liveRecastChunkSafetyReport.test.mjs': { class: 'artifact-writer', reason: 'reads pre-recorded results from the tracked smoke-test-output/live-genre-conditional-recast-bakeoff/ tree rather than exercising generation live; does not write when run, but validates a fixture, not the pipeline' },
  'liveRecastNonfictionRegressionResolution.test.mjs': { class: 'artifact-writer', reason: 'reads pre-recorded live-recast-bakeoff-results.json from the tracked smoke-test-output/live-genre-conditional-recast-bakeoff/ tree rather than exercising generation live; does not write when run, but validates a fixture, not the pipeline' },

  // ── deleted ──
  'bannedVocabRecastNotDelete.test.mjs': { class: 'deleted', reason: "tests banned-vocabulary substitution ('shimmering' -> a synonym) that POLISHSAFE-4-RETIRE-VOCAB-SUBSTITUTION (bc9ac101) deliberately retired in favor of flag-only (recastBannedVocabulary now returns recasts:[] and a flagged[] list; verified live) — every assertion in the file's Test 1/3/4 sections tests behavior that can no longer exist by design" },
  'loader.mjs': { class: 'deleted', reason: 'not a test — a duplicate ESM @/-alias resolve hook, fully superseded by tests/helpers/aliasLoader.mjs (used by every wired script). Referenced only in the stale usage-comment docstrings of qualityCalibration.mjs and qualityCalibrationRerun.mjs, never actually invoked anywhere in the repo (grep confirmed) — no assertions, nothing to run' },
  'test-ch5.mjs': { class: 'deleted', reason: "a scratch debugging script with zero assertions: calls generateChapterByScenes/postDraftCleanup and console.logs character counts, wrapped in run().catch(console.error) which swallows any error and always exits 0 — verified live it actually throws 'Error: Project is required' from sceneWriter.js and still 'passes'. A silent pass with no pass/fail criteria at all" },

  // ── regression: each asserts something the codebase still intends; none fixed/deleted/weakened here ──
  'agentRoutingMatrix.test.mjs': { class: 'regression', reason: "expects bibliographyGenerator.js to have a task_type:'research' LLM call site, but BIBFIX-1 replaced that generator's LLM path entirely with closed-world deterministic generation (buildClosedWorldBibliography) — invokeLLMWithRetry is still imported there but is dead code, never called. 20/21 other routing checks in this file still pass" },
  'artifactInteractionRegression.test.mjs': { class: 'regression', reason: 'expects the unified prose pipeline to silently fix a "Was was" duplicate word; it now blocks with a warning instead (blocked:true, warningsCount:2) — consistent with the flag-not-silently-mutate direction of POLISHSAFE-4, but not confirmed against a specific commit. 19/20 other checks pass' },
  'blockbusterQualityCalibration.test.mjs': { class: 'regression', reason: "expects COMPACT_CRAFT_RULES and MANDATORY_ENFORCEMENT_BLOCK to be empty as part of a documented 'Phase 3 migration', but craft rules and the enforcement block have since been restored/repopulated (productionWiringGuard.test.mjs independently confirms 'Craft rules restored' and 'Full craft enabled' live) — this file was never updated after that reversal. 16/20 other checks pass" },
  'chapter2SafeReplaceResolutionRegression.mjs': { class: 'regression', reason: '3 failures: the full-export-gate simulation no longer blocks the poisoned-Ch.2 canary text at 20-chapter scope (checks 3, 16) even though the per-chapter safety gate still rejects it (check 2), and a shared "simulate a 20-chapter export" helper throws "Cannot read properties of undefined (reading length)" (check 15) — the same crash shape appears identically in staleUrlResolutionRegression.mjs and chapter6PolishRegression.mjs, pointing at one shared helper/production signature change. 19/22 other checks pass' },
  'chapter6PolishRegression.mjs': { class: 'regression', reason: '(name kept this arc — HYGIENE-1 scope is test/+src/lib only) 11 failures: grammar-repair count for "She were" dropped from 2 to 1; the ambiguous "Aether were" case now triggers REJECT_MANUAL_REVIEW where the fixture expects WARN_ONLY (plausibly downstream of the Arc G malformed-sentence hardening, not confirmed); and the same shared 20-chapter-export helper crash seen in chapter2SafeReplaceResolutionRegression.mjs and staleUrlResolutionRegression.mjs. 14/25 checks pass' },
  'contentLossGuards.test.mjs': { class: 'regression', reason: "expects sceneDuplicateStats to include a flaggedForReview counter that the runner does not currently populate in its stats return shape. 37/38 other checks (removal caps, content-loss revert threshold, LLM polish integrity) pass" },
  'criticPanelExecution.test.mjs': { class: 'regression', reason: 'a structural source-scan expects manuscript loading to sit inside the Reviewer Panel try/finally boundary and it no longer does — a refactor likely moved the load outside the error-handling guarantee this test locks. 9/10 other checks (sequential reviewer execution, no Promise.all, task_type/max_tokens) pass' },
  'digitalEquityPolishRegression.mjs': { class: 'regression', reason: '(name kept this arc — HYGIENE-1 scope is test/+src/lib only) 4 failures: "she-were"/"she-was-it" malformed-sentence patterns for Ch.5 are no longer detected at all (undefined where a pattern name was expected), and two "Was was X" repairs do not fire — plausibly the same Arc G malformed-sentence-detector changes as chapter6PolishRegression.mjs, not confirmed. 9/13 other checks pass' },
  'exportSurfaceRepairPersistence.test.mjs': { class: 'regression', reason: 'the nonfiction polish save loop is expected to use prepareChapterContent, write word_count, clear stale/legacy fields, and create a backup the same way the fiction loop does — none of the 5 NF-specific checks pass, only the fiction-path equivalents do. 9/14 checks pass' },
  'finalPolishEnforcementRegression.mjs': { class: 'regression', reason: "13 failures, two distinct causes: the quality gate no longer detects several malformed-grammar patterns it used to (checks 1-6, likely the same detector changes as digitalEquityPolishRegression.mjs/chapter6PolishRegression.mjs), and 3 separate checks call report.hardFailures expecting an array but get something not iterable (an export-gate return-shape change). 12/25 checks pass" },
  'forensicPhraseChapterBudget.test.mjs': { class: 'regression', reason: "expects reduceAISlopDeterministic to recast over-budget forensic phrases (e.g. 3x 'the available accounts indicate' down to 1); POLISHSAFE-4's flag-only rule now applies to forensic-phrase recasting too (confirmed live: aiSlopReduction.js line ~429 comment cites POLISHSAFE-4 for this exact path), so repairsApplied stays 0 and everything routes to flaggedForLLM instead. 38/47 other checks (grammatical validity, budget-report detection) still pass" },
  'localLLMContext.test.mjs': { class: 'regression', reason: "mixed: AGENT_NUM_CTX is exported as 32768, not the 16384 this file expects (a real, network-independent constant drift — checks 1, 3), and 6 more checks (6-11) additionally need a running llama-serve endpoint at /llama that is not up here. 3/11 checks pass" },
  'polishConvergence.test.mjs': { class: 'regression', reason: "3 of 4 'Pass 1 changed original' checks now fail because Steps A (triplet rewrites), B (parallel sentences), and C (staccato merger) were retired to flag-only by TRIPLETRETIRE-1-A-LIST-IS-CONTENT-NOT-AN-AI-TELL (f8aec8a5; confirmed live via the 'RETIRED — content deletion measured 2026-08-06' log lines) — a first pass over already-clean-of-those-tics prose no longer changes anything by design. 22/26 other checks (idempotence, abbreviation preservation) pass" },
  'polishEntrypointGuard.test.mjs': { class: 'regression', reason: 'a source-shape check expects logWritingModelUsage to gate on isWritingTask and the current wiring does not match that shape. 15/16 other checks pass' },
  'polishPipelineIntegration.test.mjs': { class: 'regression', reason: 'the mocked LLM-polish call is expected to return different text and does not, and a "She were" fixture is expected to be flagged by deterministic grammar repair in the original but is not (plausibly the same detector changes noted under chapter6PolishRegression.mjs/digitalEquityPolishRegression.mjs, not confirmed here). 5/9 checks pass' },
  'polishPipelineLiveExecution.test.mjs': { class: 'regression', reason: "two distinct causes: TEST 3's forensic-phrase-budget checks fail for the same POLISHSAFE-4 flag-only reason as forensicPhraseChapterBudget.test.mjs, and separately TEST 5/8 show a real, unretired capitalization-guard gap — sentence-initial 'e.g. the'/'i.e. the' get corrupted to 'E.g. The' in the full-runner fixture, and chatgptPatternPolish.js does not import the shared safeUppercase.js guard the way disclaimerStripper.js/manuscriptPolishRunner.js/nonfictionPolish.js do. 61/71 checks pass" },
  'polishRunnerAnthology.test.mjs': { class: 'regression', reason: 'checks 4b/4c/8b/8c/8f expect vocabulary and forensic-phrase substitution counts that POLISHSAFE-4 retired to flag-only (the live log lines say so explicitly: "substitution retired (POLISHSAFE-4)"); the anthology E2E flow itself (body-language dedup, contamination detector, quote/voice/antithesis passes) runs correctly. 22/27 checks pass' },
  'polishRunnerBehavioral.test.mjs': { class: 'regression', reason: "a single check expects NF's banned-vocabulary recast to run in a documented 'conservative mode' that the current wiring does not name that way; the wiring checks for recastBannedVocabulary itself (calls it, exports it, has a synonym map) all still pass. 37/38 checks pass" },
  'productionWiringGuard.test.mjs': { class: 'regression', reason: "a source-shape check for 'Export persist logic present' no longer matches current wiring text (likely renamed/refactored); every other section (phase ordering, banned-vocab recast wiring, agent routing, craft rules restored, Modelfiles) passes. 50/51 checks pass" },
  'projectStudioReportIntegrity.test.mjs': { class: 'regression', reason: "a source-shape check expects the NF polish-report handler to reference NF-core stats fields and the current handler text does not match. 18/19 other checks (dead-reference guards, report-panel wiring) pass" },
  'replayDiagnostic.test.mjs': { class: 'regression', reason: "validateGeneratedSceneReplay is expected to flag a near-duplicate scene fixture ('discovers the magical sword in the cave' vs '...shield in the cavern') as a replay (ok:false) and instead returns ok:true — either the detector became less sensitive on purpose or a real gap opened; not confirmed which" },
  'serverStore.test.mjs': { class: 'regression', reason: "the fixture's synthetic user id fails authCore.js's userDataDir validation ('Invalid user id'), returning 500 instead of 201 on the very first create-record check — either the fixture's id format is stale or the validation was tightened since this test was written; not confirmed which" },
  'slopRegressionRevert.test.mjs': { class: 'regression', reason: 'a single structural check expects the NF recast path to have its own explicit slop-regression-reporting log line (distinct from the fiction path\'s) and it does not. 18/19 other checks, including the live-execution revert behavior itself, pass' },
  'staleUrlResolutionRegression.mjs': { class: 'regression', reason: 'the export gate no longer blocks stale-URL content that failed the safety gate at full 20-chapter scope (checks 8, 16), and the same shared "simulate a 20-chapter export" helper throws "Cannot read properties of undefined (reading length)" seen identically in chapter2SafeReplaceResolutionRegression.mjs and chapter6PolishRegression.mjs (check 15) — three independent files hitting one shared helper/signature change. 17/20 other checks pass' },
  'toolsTaskTypeGuard.test.mjs': { class: 'regression', reason: "the static task_type scanner found 4 real, currently-live invalid values in production code: components/FloatingBrainstorm.jsx:285 and components/notebook/IdeasChatbot.jsx:253 both use task_type:'chat', and lib/sceneExecutionAcceptanceRunners.js:132/216 use 'evaluate'/'fix' — none are in VALID_TASK_TYPES. 8/9 other checks pass" },
  'unityContaminationSourceRegression.test.mjs': { class: 'regression', reason: "buildProjectContextHeader's contamination canary is expected to mention 'Unity Supported Living' and 'care documentation' by name and does not — the canary exists and works for other terms, this is a wording gap. 24/26 other checks pass" },
};

const WIRED_RE = /tests\/[A-Za-z0-9_.]+\.(?:test\.)?m?js/g;
function wiredFiles() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const nc = pkg.scripts['test:narrative-connect'] || '';
  const pp = pkg.scripts['test:polish-pipeline'] || '';
  return new Set([...(nc.match(WIRED_RE) || []), ...(pp.match(WIRED_RE) || [])].map((f) => f.replace('tests/', '')));
}

function main() {
  const filter = process.argv[2] || '';
  const wired = wiredFiles();
  const SELF = path.basename(fileURLToPath(import.meta.url));
  const onDisk = fs.readdirSync(DIR).filter((f) => (f.endsWith('.mjs') || f.endsWith('.js')) && f !== SELF);
  const unwired = onDisk.filter((f) => !wired.has(f)).sort();

  const beforeStatus = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout;

  let green = 0; let red = 0; let skipped = 0; let checks = 0;
  const reds = [];
  const regressionCandidates = [];

  for (const f of unwired) {
    if (filter && !f.includes(filter)) continue;
    const entry = CLASSIFICATION[f];
    if (!entry) {
      red += 1;
      reds.push([f, 'UNCLASSIFIED — every tests/ file not wired into package.json must appear in CLASSIFICATION (see test/testsweep1.acceptance.mjs check 1)']);
      console.log(`FAIL  ${f.padEnd(48)} unclassified`);
      continue;
    }
    if (entry.class !== 'run') {
      skipped += 1;
      console.log(`SKIP  ${f.padEnd(48)} ${entry.class}`);
      console.log(`      reason: ${entry.reason}`);
      if (entry.class === 'regression') regressionCandidates.push(f);
      if (entry.class === 'deleted' && fs.existsSync(path.join(DIR, f))) {
        red += 1;
        reds.push([f, "classified 'deleted' but still present on disk"]);
      }
      continue;
    }
    const r = spawnSync(process.execPath, [path.join(DIR, f)], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: `--loader ${ALIAS_LOADER}` },
    });
    const out = (r.stdout || '') + (r.stderr || '');
    const passLike = (out.match(/^(?:PASS |✅|ok \d)/gm) || []).length;
    checks += passLike;
    if (r.status === 0) {
      green += 1;
      console.log(`OK    ${f.padEnd(48)} exit 0${passLike ? ` (${passLike} check-like lines)` : ''}`);
    } else {
      red += 1;
      reds.push([f, out]);
      console.log(`FAIL  ${f.padEnd(48)} exit ${r.status}`);
    }
  }

  const afterStatus = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout;
  if (afterStatus !== beforeStatus) {
    console.log('\n[TESTSWEEP-1] a run-class file dirtied the working tree — restoring tracked changes.');
    spawnSync('git', ['checkout', '--', '.'], { cwd: ROOT });
    red += 1;
    reds.push(['(runner)', 'git status changed after running run-class files — see artifact-writer classification']);
  }

  for (const [f, out] of reds) {
    console.log(`\n──────── ${f} ────────`);
    console.log(out.split('\n').slice(-25).join('\n'));
  }

  console.log(`\n[TESTSWEEP-1] regression candidates: ${regressionCandidates.length}`);
  if (regressionCandidates.length) regressionCandidates.forEach((f) => console.log(`  - ${f}`));

  console.log('\n' + '─'.repeat(64));
  console.log(`legacy: ${green} green, ${red} red, ${skipped} skipped   |   ${checks} checks`);
  process.exit(red === 0 ? 0 : 1);
}

// Guarded so test/testsweep1.acceptance.mjs can import CLASSIFICATION and
// wiredFiles() without triggering a full run as an import side effect.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

export { wiredFiles };
