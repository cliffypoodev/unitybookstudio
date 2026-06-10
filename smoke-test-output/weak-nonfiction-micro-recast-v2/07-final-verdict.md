# 07 — Final Verdict

**Pipeline**: ANTI-CHATBOT-RECAST-PIPELINE v5.0  
**Test**: weak-nonfiction-micro-recast-v2  
**Date**: 2026-06-09

---

## ✅ Verdict: PASS WITH NOTES

---

## Reason for PASS WITH NOTES

### What Earned the PASS

The **deterministic cleanup** is a breakthrough:

| Achievement | Detail |
|---|---|
| Composite score | 74 → **80** (+6 points) |
| Essay-bot transitions | 6 → **0** (all eliminated) |
| Filter verbs | 11 → **9** (−2) |
| Chatbot patterns | 13 → **10** (−3) |
| Headings preserved | 3 → 3 ✅ |
| Citations preserved | 3 → 3 ✅ |
| Word ratio | 95% ✅ |
| Zero LLM risk | Entirely regex-based |

### Why Not FINAL PASS

The **micro-recast LLM component** has a known issue:

| Unit | Score | Original | Recast | Ratio | Gate | Result |
|---|---|---|---|---|---|---|
| 5 (index 4) | 65 | 69 words | 62 words | 90% | ≥ 92% | ❌ Blocked |
| 7 (index 6) | 60 | 48 words | 40 words | 83% | ≥ 92% | ❌ Blocked |

- The LLM (`prose-recast-polisher` at temperature 0.4) **over-compresses** when rewriting nonfiction paragraphs
- The word-count compression gate **correctly blocked** both attempts, preserving the original text
- The safety architecture works perfectly — but the micro-recast benefit is **zero** in this test
- The micro-recast prompt needs tighter word-count enforcement, or a model that follows instructions better

---

## Confirmed Results

### Root Cause Addressed ✅

Essay-bot transitions removed **deterministically** without LLM risk:

```
Removed: Moreover         (×1)
Removed: Furthermore      (×2)
Removed: Additionally     (×2)
Removed: It is important to note that  (×1)
                           ────
Total:   6 transitions → 0
```

### Score Improved ✅

| Metric | Before | After | Delta |
|---|---|---|---|
| Composite | 74 | 80 | **+6** |
| Filter Verb Density | 31.8/1K | 26.8/1K | −5.0 |
| Opening Verb Strength | weak | strong | improved |
| Symmetry Score | 12 | 6 | −6 (improved) |

All improvement from deterministic cleanup alone — zero LLM contribution.

### Structure Preserved ✅

| Element | Before | After | Status |
|---|---|---|---|
| Headings | 3 | 3 | ✅ Preserved |
| Citations | 3 | 3 | ✅ Preserved |
| Word Ratio | — | 95% | ✅ Safe range |

### Safety Gates Working ✅

| Gate | Status | Detail |
|---|---|---|
| Word-count compression gate | ✅ Triggered | Blocked both micro-recast attempts (90%, 83%) |
| Citation preservation gate | ✅ Ready | Not triggered (blocked by word-count first) |
| Quality gate | ✅ Ready | Not triggered (blocked by word-count first) |
| Chatbot pattern gate | ✅ Ready | Not triggered (blocked by word-count first) |
| Global structure validation | ✅ Passed | Headings 3→3, Citations 3→3 |

### Pipeline Integration ✅

| Item | Status |
|---|---|
| Pipeline version | ANTI-CHATBOT-RECAST-PIPELINE v5.0 |
| Nonfiction path | Active |
| Non-nonfiction path | Unchanged (v4) |
| `skipNonfictionCleanup` | Backward compatible ✅ |

### Test Results ✅

| Suite | Tests | Failures | Status |
|---|---|---|---|
| Recast suites (22) | 479 | 0 | ✅ |
| New test files (4) | 72 | 0 | ✅ |
| referenceIntegrityGate | 155 | 0 | ✅ |
| fullAuthorWorkflowRegression | 176 | 0 | ✅ |
| manuscriptSafetyGate | 33 | 0 | ✅ |
| **Safety gate total** | **364** | **0** | ✅ |
| Build | — | — | ✅ Clean |

---

## Acceptance Check Summary

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | Headings preserved | ✅ PASS | 3→3 |
| 2 | Citations preserved | ✅ PASS | 3→3 |
| 3 | Word count in safe range | ✅ PASS | 95% |
| 4 | Essay-bot transitions decreased | ✅ PASS | 6→0 |
| 5 | Filter verbs decreased or stable | ✅ PASS | 11→9 |
| 6 | Chatbot patterns stable or decreased | ✅ PASS | 13→10 |
| 7 | Composite improved or stable | ✅ PASS | 74→80 |
| 8 | Deterministic cleanup applied | ✅ PASS | `applied=true` |
| 9 | Pipeline version is v5.0 | ✅ PASS | v5.0 confirmed |

**9/9 acceptance checks passed.**

---

## Open Items for Future Iterations

| # | Item | Priority | Detail |
|---|---|---|---|
| 1 | Micro-recast prompt word-count enforcement | Medium | LLM ignores word-count bounds; consider explicit word budget or few-shot examples |
| 2 | Model selection for nonfiction | Medium | `prose-recast-polisher` over-compresses; evaluate alternative models |
| 3 | Remaining filter verbs (8) | Low | Valid nonfiction context; may not need removal |
| 4 | Gate tolerance tuning | Low | Current 92% floor is conservative; could relax to 88% with more test data |

---

## Bottom Line

> The v5 nonfiction pipeline is a **significant improvement** over v4. The deterministic cleanup subsystem alone delivers a **+6 composite score improvement** with **zero LLM risk**. The micro-recast safety architecture is sound — it correctly blocks over-compressed output — but the micro-recast itself provides no benefit yet due to model instruction-following limitations.

**Recommendation**: Ship the deterministic cleanup. Continue iterating on the micro-recast prompt or model selection for future improvements.

---

```
VERDICT:  ✅ PASS WITH NOTES
SCORE:    74 → 80 (+6)
PIPELINE: ANTI-CHATBOT-RECAST-PIPELINE v5.0
DATE:     2026-06-09
```
