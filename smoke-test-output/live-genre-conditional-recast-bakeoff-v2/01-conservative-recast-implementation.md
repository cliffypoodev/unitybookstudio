# Conservative Recast Mode Implementation

**Pipeline Version:** v2.0
**Date:** 2026-06-09
**Status:** Implemented and validated

---

## Overview

The recast pipeline was upgraded from v1.0 to v2.0 with a new **conservative recast mode** as the default operating mode. This mode prioritizes length preservation and safety over aggressive rewriting, addressing the compression and quality regression issues observed in v1.

## Architecture Change: RECAST_MODE Enum

The pipeline now supports three recast modes via a `RECAST_MODE` enum:

| Mode | Word Count Ratio | Use Case |
|------|-----------------|----------|
| **`conservative`** (default) | 92–110% | Production default. Prioritizes length preservation and safety. |
| `standard` | 85–110% | Legacy v1 behavior. Wider ratio tolerance. |
| `aggressive` | 75–110% | Experimental. Allows significant compression. |

### MODE_RATIOS Lookup

```
MODE_RATIOS = {
  conservative: { min: 0.92, max: 1.10 },
  standard:     { min: 0.85, max: 1.10 },
  aggressive:   { min: 0.75, max: 1.10 }
}
```

The ratio is calculated as `recastWords / origWords`. A chunk is rejected if the ratio falls outside the allowed range for the active mode.

## Conservative Prompt Architecture

The prompt sent to the prose-polisher model now includes **explicit model-facing length anchors**. These are not hints — they are hard constraints visible to the model at generation time.

### LENGTH PRESERVATION Block

The conservative prompt includes a dedicated `LENGTH PRESERVATION` instruction block:

```
=== LENGTH PRESERVATION ===
Original word count: {origWords}
Required range: {minWords}–{maxWords} words (92–110% of original)
You MUST produce output within this range.
Do NOT summarize. Do NOT condense. Do NOT omit paragraphs.
Preserve the original paragraph count: {paragraphCount} paragraphs.
```

This block appears **before** the text to recast, ensuring the model sees the constraints before generating.

### NONFICTION CONSTRAINTS Block

When the genre profile is `nonfiction`, an additional constraint block is injected:

```
=== NONFICTION CONSTRAINTS ===
- Preserve ALL citations, references, and bibliographic markers exactly as they appear.
- Preserve ALL headings, subheadings, and structural markers.
- Do NOT restructure sections or merge paragraphs.
- Maintain the informational density of the original.
```

### Paragraph Count Anchor

The prompt includes the original paragraph count as a hard target. The model is instructed to produce the same number of paragraphs as the original, preventing structural compression where multiple paragraphs get collapsed into one.

## How the Prompt Includes Explicit Word Count Range

**Before (v1):**
```
Rewrite the following passage to improve prose quality while maintaining the same length.
```

**After (v2 conservative):**
```
Rewrite the following passage to improve prose quality.

=== LENGTH PRESERVATION ===
Original word count: 424
Required range: 390–466 words (92–110% of original)
You MUST produce output within this range.
Do NOT summarize. Do NOT condense. Do NOT omit paragraphs.
Preserve the original paragraph count: 4 paragraphs.
```

The v1 prompt relied on a vague "maintain the same length" instruction. The v2 prompt provides the model with exact numbers, turning a soft suggestion into a measurable constraint.

## Validation Integration

The `validateRecast` function now returns an enriched structure:

| Field | Type | Description |
|-------|------|-------------|
| `passed` | boolean | Whether the recast passed all checks |
| `failureType` | string | `'word_count_ratio'` \| `'overcorrection'` \| `'chatbot_increase'` \| `null` |
| `origWords` | number | Word count of the original chunk |
| `recastWords` | number | Word count of the recast chunk |
| `ratio` | number | `recastWords / origWords` |
| `minAllowed` | number | Minimum ratio for the active mode |
| `maxAllowed` | number | Maximum ratio for the active mode |
| `recastMode` | string | The active recast mode |

This enriched return structure enables the retry loop (see Report 03) to determine whether a failure is retryable (word count) or terminal (overcorrection).

## Impact

- **Conservative mode is now the default** for all genre profiles.
- The tighter 92–110% ratio window prevents the compression that caused v1 failures.
- Explicit model-facing word counts give the model a concrete target instead of a vague instruction.
- Nonfiction-specific constraints protect citations, headings, and structural elements.
- The architecture supports future tuning via mode selection without code changes.
