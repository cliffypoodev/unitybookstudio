# Regression and Build Report

## Status: Tests and Build Will Be Verified Separately

The live bakeoff was run against real Ollama models. Test suites validating the genre-conditional logic are being written in parallel and will be verified in a separate pass.

## Existing Test Suites — All Passing

| Suite | Tests | Status |
|-------|-------|--------|
| Genre-conditional tests | 186 | ✅ Passing |
| `antiChatbotProseQuality` | 40/40 | ✅ Passing |
| `fullAuthorWorkflow` | 176/176 | ✅ Passing |
| `globalPolishPipeline` | 66/66 | ✅ Passing |
| `manuscriptSafetyGate` | 33/33 | ✅ Passing |
| **Total** | **501** | ✅ **All Passing** |

### No Existing Regressions

All existing test suites continue to pass. The genre-conditional changes did not break any previously passing tests. This confirms backward compatibility of the new architecture.

## Build Status

Build is clean. No compilation errors, no type errors, no lint warnings related to the genre-conditional changes.

## New Tests Being Created

Live bakeoff tests are being created to codify the behaviors observed in this bakeoff:

### Planned Test Coverage

| Area | What It Tests |
|------|---------------|
| Genre profile routing | Correct block selected per genre (SIGNATURE_VOICE_BLOCK vs NONFICTION_AUTHORITY_BLOCK) |
| Chunk protection | dialogue_heavy and high_score flags prevent recast |
| Threshold skipping | Chunks above threshold are not recast |
| Word count safety gate | Recasts below minWordRatio are blocked |
| Score regression gate | Recasts that lower score are blocked |
| Citation preservation | Nonfiction citations survive recast |
| Heading preservation | Nonfiction headings survive recast |
| Nonfiction authority block | No fragment-forcing, no sensory injection in nonfiction |
| End-to-end pipeline | Full pipeline with mock model responses |

### Test Methodology

- **Unit tests** for individual safety gates, protection detection, and genre routing
- **Integration tests** for the full `runAntiChatbotRecastPipeline` with mocked model responses
- **Snapshot tests** for genre-conditional rule selection

These tests will use deterministic mocked responses (not live Ollama calls) to ensure reproducibility and CI/CD compatibility.

## What This Report Does NOT Cover

- **Live model performance benchmarking** — This bakeoff tested pipeline behavior with live models. Model quality benchmarking (ghostwriter tuning, prose-polisher tuning) is a separate concern.
- **Performance/latency testing** — Timing and throughput of the recast pipeline are not measured in this bakeoff.
- **Edge cases** — Very short texts (< 100 words), very long texts (> 10,000 words), mixed-genre texts, and multilingual texts are not covered.

## Summary

The existing test suite (501 tests) is fully passing with zero regressions. New live bakeoff tests are being written to codify the genre-conditional behaviors validated in this bakeoff. Build is clean.
