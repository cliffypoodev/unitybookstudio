# Chunk-Level Metrics Report

## All Chunks — Complete Table

| Genre | Chunk | Words (A) | Before Score | Action | After Score | Delta | Reason |
|-------|-------|-----------|-------------|--------|-------------|-------|--------|
| Thriller | 0 | — | 74 | Skipped | 74 | 0 | Score ≥ threshold |
| Thriller | 1 | — | 82 | Skipped | 82 | 0 | Protected: `dialogue_heavy` + `high_score` |
| Thriller | 2 | — | 67 | **Recast** ✓ | 78 | **+11** | Below threshold, recast passed safety |
| Literary | 0 | 414 | 67 | **Failed** ✗ | 67 | 0 | Cut too much: 414→345 words (83% ratio) |
| Literary | 1 | — | 76 | Skipped | 76 | 0 | Score ≥ threshold |
| Literary | 2 | — | 84 | Skipped | 84 | 0 | Protected: `high_score` |
| Nonfiction | 0 | — | 78 | Skipped | 78 | 0 | Score ≥ threshold |
| Nonfiction | 1 | — | 68 | **Recast** ✓ | 80 | **+12** | Below threshold, recast passed safety |
| Nonfiction | 2 | 223 | 66 | **Failed** ✗ | 66 | 0 | Cut too much: 223→189 words (85% ratio) |

## Action Summary

| Action | Count | Percentage |
|--------|-------|------------|
| Skipped (above threshold) | 3 | 33% |
| Skipped (protected) | 2 | 22% |
| Recast (successful) | 2 | 22% |
| Recast (failed/blocked) | 2 | 22% |
| **Total** | **9** | 100% |

## Successful Recasts

Both successful recasts produced substantial improvements:

| Chunk | Before | After | Delta | Genre |
|-------|--------|-------|-------|-------|
| Thriller chunk 2 | 67 | 78 | +11 | Commercial Thriller |
| Nonfiction chunk 1 | 68 | 80 | +12 | Narrative Nonfiction |

- **Average improvement**: +11.5 points per successful recast
- **Both moved categories**: FAIR → GOOD/GREAT
- **Both passed all safety gates**

## Failed Recasts

Both failures were caught by the word-count ratio safety gate:

| Chunk | Original Words | Recast Words | Ratio | Minimum | Genre |
|-------|---------------|-------------|-------|---------|-------|
| Literary chunk 0 | 414 | 345 | 83% | 85% | Literary/Speculative |
| Nonfiction chunk 2 | 223 | 189 | 85% | 85% | Narrative Nonfiction |

- **Both blocks were correct** — the prose-polisher compressed too aggressively.
- The literary block was 2 percentage points below minimum.
- The nonfiction block was at the exact edge of the minimum.

## Skipped Chunks

### Above Threshold (3 chunks)

| Chunk | Score | Genre |
|-------|-------|-------|
| Thriller chunk 0 | 74 | Commercial Thriller |
| Literary chunk 1 | 76 | Literary/Speculative |
| Nonfiction chunk 0 | 78 | Narrative Nonfiction |

All three were correctly identified as already good quality — no intervention needed.

### Protected (2 chunks)

| Chunk | Score | Protection | Genre |
|-------|-------|------------|-------|
| Thriller chunk 1 | 82 | `dialogue_heavy` + `high_score` | Commercial Thriller |
| Literary chunk 2 | 84 | `high_score` | Literary/Speculative |

Both had high scores (82, 84) and were correctly protected from unnecessary modification.

## Score Distribution

```
Before Scores:       After Scores:
84 ████████████████  84 ████████████████    (literary chunk 2, skipped)
82 ██████████████    82 ██████████████      (thriller chunk 1, skipped)
78 ████████████      78 ████████████        (nonfiction chunk 0, skipped)
76 ██████████        76 ██████████          (literary chunk 1, skipped)
74 ████████          74 ████████            (thriller chunk 0, skipped)
68 ██████            80 ████████████        (nonfiction chunk 1, recast +12)
67 █████             78 ████████████        (thriller chunk 2, recast +11)
67 █████             67 █████               (literary chunk 0, failed)
66 ████              66 ████                (nonfiction chunk 2, failed)
```

## Key Observations

1. **The pipeline is conservative by design.** Only 4/9 chunks were eligible for recast (scores below threshold and not protected). Of those, 2 succeeded and 2 were blocked by safety.

2. **When recasts succeed, they're substantial.** Both successful recasts improved by 11–12 points — not marginal gains.

3. **The safety gate catches real problems.** Both blocked recasts had genuine word-count violations. The gate is not overly restrictive; it's correctly preventing content loss.

4. **The ghostwriter baseline is strong.** 5/9 chunks scored 74+ out of the gate, leaving limited room for recast improvement.

5. **Score ceiling effect.** The highest-scoring chunks (82, 84) were already in GREAT territory. The recast pipeline correctly leaves these alone rather than risking regression.
