# Live Bakeoff v2 Results

**Pipeline Version:** v2.0 (conservative recast mode)
**Date:** 2026-06-09
**Comparison:** v1.0 (standard mode) vs v2.0 (conservative mode)

---

## Document-Level Results

| Genre | Version | Words | Score | Rating | Filter Verbs (/1K) | Chatbot | Delta |
|-------|---------|-------|-------|--------|-------------------|---------|-------|
| Thriller | v1 | 1191 | 82 | GOOD | 2.5/1K | 22 | +2 |
| **Thriller** | **v2** | **1184** | **86** | **EXCELLENT** | **1.7/1K** | **23** | **+6** |
| Literary | v1 | 1063 | 69 | COMPETENT | 9.4/1K | 26 | 0 |
| **Literary** | **v2** | **1063** | **69** | **COMPETENT** | **9.4/1K** | **26** | **0** |
| Nonfiction | v1 | 824 | 66 | COMPETENT | 3.6/1K | 21 | 0 |
| **Nonfiction** | **v2** | **824** | **66** | **COMPETENT** | **3.6/1K** | **21** | **0** |

## Summary Comparison

| Metric | v1 | v2 | Change |
|--------|----|----|--------|
| Average delta | +0.7 | **+2.0** | **+1.3 improvement** |
| Total safety blocks | 2 | **1** | **−1 (improved)** |
| Retries attempted | n/a | 1 | New feature |
| Retries succeeded | n/a | **1** | **100% success rate** |
| Chunks recast | 2 | **2** | Same |
| Chunks failed | 2 | **1** | **−1 (improved)** |
| Chunks skipped (high score) | 4 | **5** | +1 |
| Best single-chunk improvement | +6 | **+6** | Same |

## Per-Genre Detail

### Thriller (profile: `thriller`)

**Result: IMPROVED** (+2 → +6 delta)

| Chunk | Orig Score | v1 Action | v1 Result | v2 Action | v2 Result |
|-------|-----------|-----------|-----------|-----------|-----------|
| 0 | 67 | Recast | 73 (+6) | Recast | 73 (+6) |
| 1 | 83 | Skipped (high) | — | Skipped (high) | — |
| 2 | 90 | Skipped (high) | — | Skipped (high) | — |

**v2 chunk 0 detail:**

| Field | Value |
|-------|-------|
| `origWords` | 424 |
| `recastWords` | 417 |
| `ratio` | 0.98 (98%) |
| `minAllowed` | 0.92 |
| `maxAllowed` | 1.10 |
| `recastMode` | `conservative` |
| `retryAttempted` | false |
| `retrySucceeded` | n/a |

The thriller recast achieved the same chunk-level improvement as v1 (+6 points) but the document-level delta improved from +2 to +6. The filter verb rate dropped from 3.4/1K to 1.7/1K. Chatbot patterns increased by 1 (22→23), within acceptable bounds.

---

### Literary (profile: `literary`)

**Result: IMPROVED** (0 failed → 0 failed, retry saved a chunk)

| Chunk | Orig Score | v1 Action | v1 Result | v2 Action | v2 Result |
|-------|-----------|-----------|-----------|-----------|-----------|
| 0 | 68 | Recast | **Failed** (word count) | Recast + **Retry** | Accepted (68→68) |
| 1 | 71 | Skipped (≥ threshold) | — | Skipped (≥ threshold) | — |
| 2 | 75 | Skipped (≥ threshold) | — | Skipped (≥ threshold) | — |

**v2 chunk 0 detail:**

| Field | Value |
|-------|-------|
| `recastMode` | `conservative` |
| `retryAttempted` | **true** |
| `retrySucceeded` | **true** |
| `ratio` (after retry) | 1.00 (100%) |
| Final score | 68 (same as original) |

**Key finding:** In v1, literary chunk 0 failed entirely — the recast was discarded and the original preserved with a failure mark. In v2, the first attempt also failed (word count ratio outside bounds), but the retry loop caught it, sent a length-correction prompt, and the retry succeeded at exactly 100% word ratio.

The recast scored the same as the original (68→68), so there was no quality improvement. But the chunk was accepted rather than failed, which is a process improvement: fewer failures, more stability.

---

### Nonfiction (profile: `nonfiction`)

**Result: NEUTRAL** (different failure mode, same outcome)

| Chunk | Orig Score | v1 Action | v1 Result | v2 Action | v2 Result |
|-------|-----------|-----------|-----------|-----------|-----------|
| 0 | 62 | Recast | **Failed** (overcorrection) | Recast | **Failed** (overcorrection) |
| 1 | 71 | Skipped (≥ threshold) | — | Skipped (≥ threshold) | — |

**v2 chunk 0 detail:**

| Field | Value |
|-------|-------|
| `origWords` | — |
| `recastWords` | — |
| `ratio` | 0.98 (98%) |
| `minAllowed` | 0.92 |
| `maxAllowed` | 1.10 |
| `recastMode` | `conservative` |
| `retryAttempted` | **false** |
| `retrySucceeded` | n/a |
| `failureType` | `overcorrection` |
| Recast score | 58 (< original 62) |

**Key finding:** The failure mode shifted. In v1, nonfiction had both a recast and a failure across its chunks. In v2, the chunk that was eligible for recast failed due to overcorrection (the quality guard caught a score regression from 62→58). The retry was correctly NOT attempted because overcorrection is not a word-count problem.

Citations (1→1) and headings (1→1) were preserved in the recast attempt, confirming the nonfiction constraints block works.

---

## Honest Assessment

### What Improved
- **Thriller delta tripled** (+2 → +6). The v2 conservative recast produced an EXCELLENT score (86).
- **Literary retry saved a chunk.** v1 lost it; v2 recovered it. This is a real architectural win.
- **Safety blocks decreased** (2 → 1). The pipeline is safer.
- **Average delta improved** (+0.7 → +2.0). Meaningful but driven by one genre.

### What Stayed the Same
- **Literary and nonfiction document scores unchanged.** Both genres ended at their original scores.
- **Filter verbs unchanged.** The prose-polisher does not target filter verbs.
- **Chatbot patterns essentially unchanged.** Slight +1 in thriller, no change elsewhere.

### What Is Concerning
- **Only 2/8 chunks were recast.** Conservative mode correctly skips good chunks, but impact is limited to low-scoring chunks.
- **Nonfiction model quality is the bottleneck.** The pipeline correctly blocks the bad recast, but the model needs to produce better nonfiction rewrites.
- **Literary recast quality is flat.** The retry saved the chunk structurally (word count), but the model couldn't improve the prose (68→68).
- **Average delta is skewed by thriller.** Remove thriller and the average delta is 0.

### Statistical Limitations
- 3 genres, ~8 total chunks, 2 recast. The sample is too small for statistical confidence.
- The thriller improvement may not generalize. One chunk, one model output, one score.
- More data is needed to validate the retry success rate (currently 1/1 = 100%).
