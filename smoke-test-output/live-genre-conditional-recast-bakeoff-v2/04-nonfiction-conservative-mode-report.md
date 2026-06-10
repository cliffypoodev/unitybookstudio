# Nonfiction Conservative Mode Report

**Pipeline Version:** v2.0
**Date:** 2026-06-09
**Status:** CRITICAL REPORT — Quality guard working correctly

---

## Summary

Nonfiction chunk 0 was **correctly rejected** by the overcorrection guard. The prose-polisher model produced a recast that scored **lower** than the original (58 vs 62). The pipeline blocked this regression, preserving the original text. No retry was attempted because this was a **quality failure**, not a word-count failure. The quality guard is stronger than the length guard.

## What Happened

### Chunk 0 Analysis

| Metric | Original | Recast | Assessment |
|--------|----------|--------|------------|
| Score | 62 | 58 | ❌ **Regression** (−4 points) |
| Word count ratio | — | 98% | ✅ Within 92–110% |
| Citations | 1 | 1 | ✅ Preserved |
| Headings | 1 | 1 | ✅ Preserved |

The word count ratio was fine (98%). The citations were preserved. The headings were preserved. The nonfiction constraints block worked as intended for structural elements.

**But the prose quality regressed.** The recast scored 58, which is 4 points below the original's 62. The overcorrection guard caught this.

### Why No Retry?

```
validation.failureType === 'overcorrection'  // NOT 'word_count_ratio'
isWordCountRatioFailure(validation) === false
→ Retry NOT attempted
```

The retry loop only fires for `word_count_ratio` failures. An overcorrection failure means the model's rewrite made the prose worse, and retrying with a length-correction prompt would not fix a quality problem. The correct action is to preserve the original text.

### Decision Flow

```
Chunk 0 (score: 62, below threshold)
  │
  ├─ Recast attempted
  │   └─ Recast score: 58
  │
  ├─ Validate:
  │   ├─ Word count ratio: 98% ✅
  │   ├─ Chatbot patterns: OK ✅
  │   └─ Quality: 58 < 62 ❌ OVERCORRECTION
  │
  ├─ failureType: 'overcorrection'
  ├─ isWordCountRatioFailure? NO
  ├─ Retry? NO
  │
  └─ Result: FAILED — preserve original text
```

## Why This Is Correct

The quality guard is the **last line of defense** against model regressions. Consider the alternative:

- **Without the guard:** The recast (score 58) would replace the original (score 62). The document would get worse. The user would see degraded nonfiction prose.
- **With the guard:** The original text is preserved. The document stays at score 62. No harm done.

The guard's logic is simple and conservative:

```
if (recastScore < originalScore) → reject
```

This means a recast must be **at least as good** as the original to be accepted. Equal scores are accepted (as seen in literary chunk 0, where 68→68 was accepted). Only regressions are blocked.

## Structural Preservation

The nonfiction constraints block successfully preserved structural elements:

| Element | Original | Recast | Preserved? |
|---------|----------|--------|------------|
| Citations | 1 | 1 | ✅ Yes |
| Headings | 1 | 1 | ✅ Yes |
| Paragraph count | — | — | ✅ Yes |

The model followed the `NONFICTION CONSTRAINTS` block instructions and did not strip citations or restructure sections. The failure was purely in prose quality, not structural integrity.

## Impact on Document Score

| Metric | A (before) | B (after) | Delta |
|--------|------------|-----------|-------|
| Words | 824 | 824 | 0 |
| Score | 66 | 66 | 0 |
| Filter verbs | 3.6/1K | 3.6/1K | 0 |
| Chatbot patterns | 21 | 21 | 0 |

Nonfiction did **NOT** regress. The document score remains 66 COMPETENT. This is critical context: the previous nonfiction regression (−17 points) that was resolved in an earlier fix remains resolved. The v2 conservative mode maintains that fix.

### Chunk-Level Breakdown

| Chunk | Original Score | Action | Result |
|-------|---------------|--------|--------|
| 0 | 62 | Recast attempted, **overcorrection blocked** | Original preserved |
| 1 | 71 | **Skipped** (score ≥ threshold) | Original preserved |

Only 1 of 2 chunks was eligible for recast. That chunk's recast was blocked. Net result: no changes to the document. This is the correct conservative behavior.

## Comparison With Previous Nonfiction Regression

| Version | Nonfiction Score | Delta | Failed Chunks | Root Cause |
|---------|-----------------|-------|---------------|------------|
| Pre-fix | 49 | −17 | — | Prose-polisher destroyed nonfiction |
| Post-fix (v1) | 66 | 0 | 1 | Quality guard blocked regression |
| **v2 conservative** | **66** | **0** | **1** | **Quality guard blocked regression** |

The v2 conservative mode maintains the same protection as the post-fix v1. The failure mode is slightly different (v1 had 1 recast + 1 failed; v2 has 0 recast + 1 failed), but the outcome is identical: no regression.

## The Bottleneck

The quality guard is doing its job. The bottleneck is the **prose-polisher model itself**. When asked to recast nonfiction prose, the model:

1. Follows length constraints (98% ratio ✅)
2. Preserves citations and headings (✅)
3. **Fails to improve or even maintain prose quality** (58 < 62 ❌)

This suggests the prose-polisher's training or Modelfile is not well-suited for nonfiction recast tasks. The model may be:
- Over-smoothing technical or analytical prose
- Removing hedging language that is appropriate in nonfiction
- Simplifying complex sentence structures that serve a purpose
- Introducing less precise word choices

## Recommendations

1. **Tune the prose-polisher Modelfile for nonfiction recast** — the current model may be optimized for fiction/narrative prose
2. **Add nonfiction-specific quality scoring** — nonfiction quality may require different metrics (clarity, precision, information density) than fiction (voice, rhythm, engagement)
3. **Consider skipping nonfiction recast entirely** when the original score is within acceptable range — if the model consistently can't improve nonfiction, don't attempt it
4. **Log model outputs for nonfiction failures** for manual review — understanding what the model changes can inform prompt tuning
