# Retry-on-Compression Loop Report

**Pipeline Version:** v2.0
**Date:** 2026-06-09
**Status:** Implemented and proven (1/1 succeeded)

---

## Overview

The retry-on-compression loop is a new v2 feature that gives the pipeline one opportunity to recover when the prose-polisher model produces output that fails the word-count ratio check. Instead of discarding the chunk (as v1 did), v2 sends a targeted **length-correction prompt** that tells the model exactly how much longer or shorter the output needs to be.

## Architecture

### Detection: `isWordCountRatioFailure`

After `validateRecast` returns, the retry logic checks:

```javascript
function isWordCountRatioFailure(validation) {
  return !validation.passed && validation.failureType === 'word_count_ratio';
}
```

Only `word_count_ratio` failures are retryable. Overcorrection and chatbot-increase failures are terminal — retrying would likely produce the same or worse results.

### Correction Prompt: `buildLengthCorrectionPrompt`

The correction prompt is built from the validation result and tells the model:
1. Whether the output was **too short** or **too long**
2. The exact **word delta** (how many words to add or remove)
3. The **required range** (min–max words)

```javascript
function buildLengthCorrectionPrompt(validation) {
  const direction = validation.ratio < validation.minAllowed ? 'too short' : 'too long';
  const delta = Math.abs(validation.recastWords - validation.origWords);
  const minWords = Math.ceil(validation.origWords * validation.minAllowed);
  const maxWords = Math.floor(validation.origWords * validation.maxAllowed);

  return `Your previous recast was ${direction} by approximately ${delta} words.
The original was ${validation.origWords} words. Your output was ${validation.recastWords} words.
You MUST produce output between ${minWords} and ${maxWords} words.
${direction === 'too short'
  ? 'Expand your rewrite. Add detail, restore omitted phrases, and DO NOT summarize.'
  : 'Trim your rewrite. Remove redundant phrases but DO NOT cut whole sentences or paragraphs.'}`;
}
```

### Wrapper: `recastChunkWithLengthRetry`

The retry wrapper encapsulates the original recast function:

```
recastChunkWithLengthRetry(chunk, profile, mode)
  │
  ├─ Call recastChunkWithAntiChatbotRules(chunk, profile, mode)
  │   └─ Returns { recast, validation }
  │
  ├─ If validation.passed → return result
  │
  ├─ If isWordCountRatioFailure(validation):
  │   ├─ Build length-correction prompt
  │   ├─ Call recastChunkWithAntiChatbotRules(chunk, profile, mode, correctionPrompt)
  │   │   └─ Returns { recast: retryRecast, validation: retryValidation }
  │   ├─ If retryValidation.passed → return retryResult (SAVED)
  │   └─ Else → return original result (retry also failed)
  │
  └─ Else (non-retryable failure) → return original result
```

Key design decisions:
- **One retry maximum.** No infinite loops. If the retry also fails, accept the failure.
- **Same model, same rules.** The retry uses the same prose-polisher and anti-chatbot rules. Only the prompt changes.
- **Correction prompt appended.** The correction prompt is appended to the original recast prompt, not a replacement. The model sees both the original instructions and the correction.

## Proof: Literary Chunk 0

The literary genre provided the first live proof that the retry loop works.

### Timeline

| Step | Action | Result |
|------|--------|--------|
| 1 | Analyze chunk 0 | Score: 68 (below threshold) → needs recast |
| 2 | First recast attempt | Word count ratio **failed** (below 92%) |
| 3 | Detect failure type | `failureType: 'word_count_ratio'` → **retryable** |
| 4 | Build correction prompt | "Your previous recast was too short by approximately N words..." |
| 5 | Retry recast | Word count ratio: **100%** → ✅ passed |
| 6 | Validate retry quality | Score: 68 (same as original) → ✅ accepted (not worse) |
| 7 | Final result | Chunk 0 recast accepted at 100% word ratio |

### What v1 Would Have Done

In v1, step 2 would have been terminal. The chunk would have been marked as **failed**, the original text preserved, and no improvement attempted. The v1 bakeoff results confirm this: literary had 1 failed chunk in v1.

### What v2 Did

The retry saved the chunk. Even though the recast scored the same as the original (68→68), it passed validation because:
1. The word count ratio was within bounds (100%)
2. The recast score was not worse than the original (68 ≥ 68)
3. Chatbot patterns did not increase

The chunk was accepted — not because it improved quality, but because it met all safety constraints. This is the correct behavior for conservative mode.

## Retry Statistics

| Metric | Value |
|--------|-------|
| Total retries attempted | 1 |
| Retries succeeded | 1 |
| Retry success rate | **100%** (1/1) |
| Chunks saved by retry | 1 (literary chunk 0) |
| Chunks lost in v1 that v2 saved | 1 |

> **Note:** The sample size is small (1 retry). More data is needed to establish a reliable success rate. However, the architectural proof-of-concept is validated: the retry loop can recover from word-count failures.

## Non-Retryable Failures

The nonfiction chunk 0 failure was **not** retried because it was an overcorrection failure, not a word-count failure:

| Field | Value |
|-------|-------|
| `failureType` | `overcorrection` |
| `ratio` | 98% (within bounds) |
| `origScore` | 62 |
| `recastScore` | 58 |
| Retryable? | **No** |

The retry loop correctly identified this as a quality failure and did not attempt a retry. Retrying would likely produce another quality regression — the model's recast of this specific nonfiction chunk consistently scores lower than the original.

## Conclusion

The retry-on-compression loop is **proven working**. It correctly:
- Detects retryable failures (`word_count_ratio`) vs terminal failures (`overcorrection`)
- Builds targeted correction prompts with exact word deltas
- Saved 1 chunk that v1 lost entirely
- Did not retry when retry would be futile (nonfiction overcorrection)

The feature's value will increase with longer texts (more chunks per document) and with prose-polisher model improvements.
