# Heading Preservation — Live Report

**Pipeline:** recast v4
**Date:** 2026-06-09

---

## Result

| Metric | Run 1 | Run 2 |
|---|---|---|
| Headings before | 4 | 4 |
| Headings after | 4 | 4 |
| Heading gate triggered | No | No |
| Headings preserved | ✅ Yes | ✅ Yes |

All four `##` headings survived both runs unchanged.

---

## What Happened

The heading preservation gate exists in code and is fully tested (15 unit tests pass in `liveNonfictionHeadingGateStress.test.mjs`). However, in the live stress test, **the heading gate was not the layer that caught the problem**.

In Run 1, both chunks were skipped before reaching the model—one by citation protection, one by score threshold. The heading gate was never consulted.

In Run 2, Chunk 0 was skipped by citation protection. Chunk 1 reached the model and came back compressed (158 words vs ~350 expected). The **word-count compression gate** triggered first and blocked the output. The heading gate would have been the next check, but it was never reached.

This is defense-in-depth working as designed. Multiple safety layers exist, each catching different failure modes. The first gate to detect a problem blocks the output. Downstream gates serve as backup.

---

## Defense-in-Depth: Safety Gate Sequence

```
Input chunk
  │
  ├─ Citation protection gate → SKIP if citations detected
  │
  ├─ Score threshold gate → SKIP if score ≥ threshold
  │
  ├─ Model recast attempt
  │
  ├─ Word-count compression gate → BLOCK if output too short
  │
  ├─ Heading preservation gate → BLOCK if headings lost    ← exists but not reached
  │
  └─ Accept recast
```

In this test, the word-count gate caught the problem at step 4. The heading gate at step 5 was never needed.

---

## Unit Test Coverage

The heading preservation gate has 15 passing unit tests in `liveNonfictionHeadingGateStress.test.mjs`:

| Scenario | Expected | Status |
|---|---|---|
| Nonfiction heading loss | Blocked | ✅ Pass |
| Fiction heading (bypass) | Allowed | ✅ Pass |
| Business guide heading loss | Blocked | ✅ Pass |
| Training manual heading loss | Blocked | ✅ Pass |
| All headings preserved | Allowed | ✅ Pass |
| Partial heading loss | Blocked | ✅ Pass |

All 15 tests pass. The gate logic is correct in isolation.

---

## Honest Assessment

> [!NOTE]
> The heading gate needs a scenario where a model produces heading-complete-length output but with reduced heading count to be fully exercised in a live test. In this stress test, the model compressed so aggressively that the word-count gate caught the problem before the heading gate could act. The heading gate is proven by unit tests but not yet proven live.

To fully exercise the heading gate in a live test, we would need:
- A model output that passes the word-count check (roughly the same length as input)
- But drops one or more `##` headings

This scenario has not occurred naturally. The heading gate remains a backup safety layer that is tested but not live-proven.
