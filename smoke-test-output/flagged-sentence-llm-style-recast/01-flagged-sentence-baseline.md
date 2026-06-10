# Flagged Sentence Baseline

## Overview

After the deterministic AI-slop reduction pass (981 → 827, -15.7%), 142 sentences were flagged for LLM review. These are sentences containing slop patterns that cannot be safely recast with regex substitutions because the replacement depends on surrounding context.

## Flagged Items by Chapter

| Ch | Slop After Det. | Flagged for LLM | Primary Pattern | Target? |
|---|---|---|---|---|
| 1 | 74 | 13 | felt | PRIMARY |
| 2 | 40 | 12 | felt | SECONDARY |
| 3 | 41 | 7 | felt | Monitor |
| 4 | 44 | 5 | felt | Monitor |
| 5 | 43 | 10 | felt | SECONDARY |
| 6 | 59 | 10 | felt | SECONDARY |
| 7 | 44 | 5 | felt | Monitor |
| 8 | 34 | 1 | felt | Monitor |
| 9 | 51 | 14 | felt | SECONDARY |
| 10 | 32 | 5 | felt | Monitor |
| 11 | 39 | 7 | felt | Monitor |
| 12 | 35 | 5 | felt | Monitor |
| 13 | 31 | 7 | felt | Monitor |
| 14 | 32 | 6 | felt | Monitor |
| 15 | 28 | 4 | felt | Monitor |
| 16 | 36 | 2 | felt | Monitor |
| 17 | 32 | 3 | felt | Monitor |
| 18 | 58 | 9 | felt | PRIMARY |
| 19 | 28 | 5 | felt | Monitor |
| 20 | 48 | 12 | felt | SECONDARY |

## Total: 142 sentences flagged across 20 chapters
## Primary pattern: `felt` (95%+ of all flags)
## Strategy: Send each flagged sentence + 1-sentence context to LLM for single-sentence recast
