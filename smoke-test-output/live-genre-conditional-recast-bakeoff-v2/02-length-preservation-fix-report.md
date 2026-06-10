# Length-Preservation Fix Report

**Pipeline Version:** v2.0
**Date:** 2026-06-09
**Status:** Implemented and validated

---

## Problem Statement

In v1.0, the prose-polisher model frequently compressed recast output below the acceptable word count ratio. The v1 prompt contained only a vague instruction to "maintain the same length," which the model routinely ignored. The v1 validation accepted any output within an 85–110% ratio, which was still too wide — chunks that lost 15% of their content were passing validation but producing noticeably shorter output.

## Model-Facing Instructions (v2)

The v2 conservative prompt now includes **five explicit length-preservation directives**:

### 1. Original Word Count in Prompt

```
Original word count: {origWords}
```

The model sees the exact word count of the input. This anchors the model's internal length estimation.

### 2. Min/Max Word Count Range

```
Required range: {minWords}–{maxWords} words (92–110% of original)
```

Example for a 424-word chunk:
```
Required range: 390–466 words (92–110% of original)
```

The model sees concrete numbers, not percentages. This eliminates ambiguity.

### 3. 'Do NOT Summarize' Directive

```
Do NOT summarize. Do NOT condense.
```

Explicitly blocks the two most common compression behaviors. The model's default tendency when rewriting is to tighten prose, which often manifests as summarization.

### 4. 'Do NOT Omit Paragraphs' Directive

```
Do NOT omit paragraphs.
```

Prevents structural compression where the model merges or drops paragraphs to "tighten" the writing.

### 5. Paragraph Preservation

```
Preserve the original paragraph count: {paragraphCount} paragraphs.
```

A hard structural anchor. If the original has 4 paragraphs, the output must have 4 paragraphs.

## Validation: New `validateRecast` Return Structure

### v1 Return Structure

```javascript
{
  passed: boolean,
  reason: string   // free-text explanation
}
```

### v2 Return Structure

```javascript
{
  passed: boolean,
  failureType: string | null,  // 'word_count_ratio' | 'overcorrection' | 'chatbot_increase'
  origWords: number,
  recastWords: number,
  ratio: number,               // recastWords / origWords
  minAllowed: number,          // e.g., 0.92 for conservative
  maxAllowed: number,          // e.g., 1.10 for conservative
  recastMode: string           // 'conservative' | 'standard' | 'aggressive'
}
```

### Why Structured Failures Matter

The `failureType` field enables the retry loop to make intelligent decisions:

| `failureType` | Retryable? | Action |
|----------------|-----------|--------|
| `word_count_ratio` | **Yes** | Build length-correction prompt and retry once |
| `overcorrection` | No | Accept original chunk, do not retry |
| `chatbot_increase` | No | Accept original chunk, do not retry |

In v1, all failures were terminal. In v2, word-count failures get one retry with a targeted correction prompt.

## Ratio Comparison: v1 vs v2

| Mode | Min Ratio | Max Ratio | Range Width |
|------|-----------|-----------|-------------|
| v1 (standard) | 85% | 110% | 25 percentage points |
| **v2 (conservative)** | **92%** | **110%** | **18 percentage points** |

The conservative window is 28% narrower than v1. This means:
- A 424-word chunk in v1 could pass at 360 words (85%). In v2 conservative, it must be at least 390 words (92%).
- The 30-word difference (360→390) represents roughly 1–2 sentences that v1 would silently drop.

## Observed Results

| Genre | Chunk | Orig Words | Recast Words | Ratio | Mode | Status |
|-------|-------|-----------|-------------|-------|------|--------|
| Thriller | 0 | 424 | 417 | 98% | conservative | ✅ Passed |
| Literary | 0 | — | — | 100% | conservative | ✅ Passed (after retry) |
| Nonfiction | 0 | — | — | 98% | conservative | ❌ Failed (overcorrection, not word count) |

**Key observations:**
- All word-count ratios that reached validation were within the 92–110% range.
- The literary chunk 0 initially failed word count, but the retry succeeded at exactly 100% — demonstrating that the length-correction prompt works.
- The nonfiction failure was **not** a word-count failure. The ratio was 98% (acceptable). It failed because the recast scored lower than the original (58 < 62), triggering the overcorrection guard.

## Conclusion

The length-preservation fix addresses the root cause of v1 compression failures: the model lacked concrete, numerical length targets. The v2 prompt gives the model exact word counts, exact ranges, and explicit anti-compression directives. The tighter 92–110% ratio window catches compression that v1 silently accepted. The structured validation return enables intelligent retry decisions.
