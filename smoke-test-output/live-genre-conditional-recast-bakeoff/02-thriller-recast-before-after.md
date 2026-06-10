# Commercial Thriller — Live Recast Before/After

## Summary

| Metric | Version A (Raw) | Version B (Recast) | Delta |
|--------|-----------------|-------------------|-------|
| Words | 1,273 | 1,214 | -59 |
| Composite Score | 70 (GOOD) | 72 (GOOD) | **+2** |
| Filter Verbs / 1K | 4.7 | 3.3 | **-1.4** |
| Chatbot Patterns | 29 | 23 | **-6** |

**Profile**: `thriller`
**Drift**: STABLE (+4 first→last)

## Chunk-Level Breakdown

### Chunk 0 — Skipped

- **Score**: 74
- **Action**: Skipped (score ≥ threshold)
- **Reason**: Already above the recast threshold. No intervention needed.

### Chunk 1 — Skipped (Protected)

- **Score**: 82
- **Action**: Skipped (protected: `dialogue_heavy` + `high_score`)
- **Reason**: This chunk was flagged as dialogue-heavy — dominated by character dialogue, which has its own natural rhythms and patterns that should not be flattened by a recast pass. Additionally, the score of 82 (GREAT) placed it well above the protection threshold. Dual protection correctly applied.

### Chunk 2 — Recast ✓

- **Before Score**: 67 (FAIR)
- **After Score**: 78 (GOOD)
- **Improvement**: **+11 points**
- **Safety**: Passed all gates (word count ratio within bounds, no score regression, no overcorrection)

This was the one eligible chunk — below threshold, no protection flags. The prose-polisher successfully improved the composite score by 11 points, moving it from FAIR to solidly GOOD.

## Filter Verb Improvement

Filter verb density dropped from 4.7/1K to 3.3/1K across the full text. This improvement is attributable to the successful recast of chunk 2, where the prose-polisher replaced several weak constructions.

## Symmetry Improvement

Symmetry score improved from 19 to 14. The recast reduced structural repetition in sentence patterns within chunk 2.

## Honest Assessment

This is a **marginal but real improvement**. The +2 composite delta and -6 pattern reduction are genuine gains, but the magnitude is modest. The primary reason: the `ghostwriter` model at temperature 0.72 already produces GOOD-quality thriller prose (baseline score 70). The recast pipeline found only one chunk below threshold, and it fixed that chunk well (+11 points).

The pipeline behaved correctly:
- It left good chunks alone (chunk 0).
- It protected dialogue-heavy content (chunk 1).
- It successfully improved the one weak chunk (chunk 2).

The bottleneck is not the pipeline — it's that the ghostwriter baseline is already strong enough that few chunks qualify for recast.

## Safety

| Gate | Result |
|------|--------|
| Blocks | 0 |
| Overcorrection | 0 |
| Word count ratio | Passed |
| Score regression | None |
