# Regression and Build Report

**Pipeline:** recast v4
**Date:** 2026-06-09

---

## New Test Files (This Stress Test)

| Test File | Tests | Pass | Fail |
|---|---|---|---|
| `weakNonfictionHeadingCitationStress.test.mjs` | 17 | 17 | 0 |
| `liveNonfictionHeadingGateStress.test.mjs` | 15 | 15 | 0 |
| `nonfictionCitationStructureRecastGuard.test.mjs` | 15 | 15 | 0 |
| **Subtotal** | **47** | **47** | **0** |

All 47 new tests pass.

---

## Recast Suites

| Suite | Tests | Pass | Fail |
|---|---|---|---|
| 20 recast suites (total) | 426 | 426 | 0 |

All 426 recast tests pass, including the 47 new tests from this stress test.

---

## Safety and Integrity Suites

| Suite | Tests | Pass | Fail |
|---|---|---|---|
| referenceIntegrityGate | 155 | 155 | 0 |
| referenceIntegrityProductionWiring | 56 | 56 | 0 |
| fullAuthorWorkflowRegression | 176 | 176 | 0 |
| manuscriptSafetyGate | 33 | 33 | 0 |
| **Subtotal** | **420** | **420** | **0** |

All safety and integrity tests pass. No regressions detected.

---

## Build

| Check | Status |
|---|---|
| Vite build | ✅ CLEAN |
| Build warnings | None |
| Build errors | None |

---

## Total Test Count

| Category | Tests |
|---|---|
| Recast suites (20 suites) | 426 |
| referenceIntegrityGate | 155 |
| referenceIntegrityProductionWiring | 56 |
| fullAuthorWorkflowRegression | 176 |
| manuscriptSafetyGate | 33 |
| **Total** | **846+** |

> [!TIP]
> The 846+ count covers the major suites tracked in this report. Additional unit tests in other modules may bring the true total higher.

---

## Regression Assessment

No regressions were introduced by the nonfiction heading/citation stress test changes. All pre-existing tests continue to pass. The three new test files add coverage for:

1. **Weak nonfiction recast behavior** under default and forced configurations
2. **Heading preservation gate** logic for nonfiction, fiction, business guide, and training manual genres
3. **Citation structure detection and protection** across standard, org-year, multi-author, and et al. formats

The test suite is strictly additive—no existing tests were modified or removed.
