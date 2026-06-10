# Weak Nonfiction Before/After Comparison

**Pipeline:** recast v4
**Date:** 2026-06-09

---

## Metrics Summary

| Metric | Before | After (Run 1) | After (Run 2) | Change |
|---|---|---|---|---|
| Composite score | 76 GOOD | 76 GOOD | 76 GOOD | 0 |
| Filter verbs | 18 (27.6/1K) | 18 (27.6/1K) | 18 (27.6/1K) | 0 |
| Essay-bot transitions | 10 | 10 | 10 | 0 |
| Chatbot patterns (total) | 22 | 22 | 22 | 0 |
| Markdown headings | 4 | 4 | 4 | 0 |
| Citations | 3 | 3 | 3 | 0 |
| Word count | 652 | 652 | 652 | 0 |

> [!IMPORTANT]
> All metrics are identical before and after in **both** runs. The text was **preserved unchanged** because safety gates correctly intervened at every point where recast was attempted.

---

## Key Finding

The text was not improved—it was preserved. This is **correct behavior** for this input under these conditions. The pipeline determined that every recast attempt would cause damage and blocked it. Better to preserve a 76-scoring original than to produce a structurally damaged rewrite.

---

## Run 1 — Default Protections (threshold=70, skip=80)

| Chunk | Action | Reason |
|---|---|---|
| Chunk 0 | SKIPPED | Protected: citation — citation-bearing text correctly blocked from recast |
| Chunk 1 | SKIPPED | Score 79 ≥ threshold 70 — already above recast threshold |

**Result:** 0 recast, 2 skipped, 0 failed

Both safety gates operated independently:
- Chunk 0 was blocked by **citation protection** regardless of score
- Chunk 1 was blocked by **score threshold** regardless of content

---

## Run 2 — Forced Recast (threshold=80, skip=95)

| Chunk | Action | Reason |
|---|---|---|
| Chunk 0 | SKIPPED | Protected: citation — citation protection still active even at higher threshold |
| Chunk 1 | FAILED / BLOCKED | Model generated 158 words vs ~350 expected → word-count compression safety block triggered → original text retained |

**Result:** 0 recast, 1 skipped, 1 failed, 1 safety block

The forced-recast run demonstrated two layers:
- **Citation protection** held firm on Chunk 0 even when thresholds were raised
- **Word-count compression gate** caught the model's aggressive compression on Chunk 1 and preserved the original

---

## Why Preservation Is Correct

The pipeline's job is not to recast everything—it is to recast safely or not at all. In this test:

1. Citation-bearing text cannot be safely recast without risking citation damage → **skip**
2. High-scoring text does not need recast → **skip**
3. Model-compressed output would lose content → **block and preserve**

Each decision was independently correct. The pipeline has no mechanism to "force through" a damaging recast, and that is by design.
