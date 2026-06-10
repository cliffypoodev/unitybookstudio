# Regression and Build Report

> **Date:** 2026-06-09
> **Component:** Prose-polisher recast pipeline — v3
> **Classification:** Test & Build Verification

---

## Summary

| Metric | Result |
|---|---|
| New v3 tests | **65 pass** |
| Total recast suites | **13 suites** |
| Total tests | **319 pass** |
| Regressions | **0** |
| Build | **Clean** |
| Modelfile | **Registered** |

---

## New v3 Tests

### Test Files (4 files, 65 tests)

| File | Tests | Status |
|---|---|---|
| File 1 | 20 | ✅ 20/20 pass |
| File 2 | 15 | ✅ 15/15 pass |
| File 3 | 15 | ✅ 15/15 pass |
| File 4 | 15 | ✅ 15/15 pass |
| **Total** | **65** | **✅ 65/65 pass** |

### Test Coverage Areas

The 65 new tests cover:

| Area | What's Tested |
|---|---|
| `FILTER_VERB_TARGETING_BLOCK` | Block content, verb list, replacement examples, dialogue exception, rate guidance |
| Genre example routing | Correct examples selected for thriller, literary, nonfiction profile keys |
| `NONFICTION_AUTHORITY_RECAST_BLOCK` | Block content, inclusion/exclusion by genre, citation preservation instructions |
| `buildChunkRecastPrompt()` | Composition logic, genre routing, block inclusion/exclusion |
| Modelfile configuration | System prompt content, temperature, top_k, top_p values |
| Training manual exclusion | Authority block excluded for training_manual profile key |

---

## Full Regression Suite

### 13 Recast Suites

| Suite | Tests | Status |
|---|---|---|
| Suite 1 | Pass | ✅ |
| Suite 2 | Pass | ✅ |
| Suite 3 | Pass | ✅ |
| Suite 4 | Pass | ✅ |
| Suite 5 | Pass | ✅ |
| Suite 6 | Pass | ✅ |
| Suite 7 | Pass | ✅ |
| Suite 8 | Pass | ✅ |
| Suite 9 | Pass | ✅ |
| Suite 10 | Pass | ✅ |
| Suite 11 | Pass | ✅ |
| Suite 12 | Pass | ✅ |
| Suite 13 | Pass | ✅ |

**Total: 319/319 pass, 0 fail, 0 skip**

### Regression Risk Assessment

| Change | Regression Risk | Mitigation |
|---|---|---|
| New Modelfile | Low — additive, doesn't modify existing models | Existing model tests unchanged |
| `FILTER_VERB_TARGETING_BLOCK` | Low — new block, fiction-only routing | Tested exclusion from nonfiction/training |
| Genre examples | Low — new content, routed by profile key | Tested correct routing for all keys |
| `NONFICTION_AUTHORITY_RECAST_BLOCK` | Medium — modifies nonfiction prompt | Tested inclusion/exclusion, validated against live bakeoff |
| `buildChunkRecastPrompt()` changes | Medium — modifies prompt composition | Full composition tests for all genre paths |

No regressions were observed. All existing behavior is preserved.

---

## Build Status

```
Build: CLEAN
Warnings: 0
Errors: 0
```

### Modelfile Registration

| Item | Status |
|---|---|
| `models/prose-recast-polisher.Modelfile` | ✅ Created |
| Model registered with Ollama | ✅ Registered |
| Model accessible by pipeline | ✅ Verified via bakeoff |

---

## Conclusion

All 65 new tests pass. All 319 tests across 13 recast suites pass with zero regressions. Build is clean. The `prose-recast-polisher` Modelfile is created and registered.

The v3 changes are safe for production deployment.
