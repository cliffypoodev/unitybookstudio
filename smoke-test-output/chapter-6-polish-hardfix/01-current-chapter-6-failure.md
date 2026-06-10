# 01 — Current Chapter 6 Failure

**Date:** 2026-06-07

---

## Canary Search Results

| Canary | Found? | Count | Context |
|--------|--------|-------|---------|
| She were | ✅ FOUND | 2 | `She were carrying a weight…`, `She were those just metrics?` |
| a obvious | ✅ FOUND | 1 | `but a obvious thing, pressing against her ears` |
| Aether were | ✅ FOUND | 1 | `Aether were they optimized for emotional echo?` |
| were those just | ✅ FOUND | 1 | `She were those just metrics?` |
| Was was | ❌ absent | 0 | — |
| You was | ❌ absent | 0 | — |
| He were | ❌ absent | 0 | — |
| She was it | ❌ absent | 0 | — |

## Quality Gate (Pre-Repair)

| Metric | Value |
|--------|-------|
| ok | false |
| recommendedAction | BLOCK_POLISH_SAVE |
| malformed count | 5 |
| quoteIssues count | 0 |
| slop total | 15 |

Malformed matches:
1. `[she-were]` "She were" → L3
2. `[she-were]` "She were" → L5
3. `[a-obvious]` "a obvious" → L5
4. `[aether-were]` "Aether were" → L5
5. `[were-those-just]` "She were those just" → L5

## Deterministic Grammar Repair

| Repair | Applied? |
|--------|----------|
| "She were" → "She was" (L3) | ✅ |
| "She were" → "She was" (L5) | ✅ |
| "a obvious" → "an obvious" (L5) | ✅ |
| "Aether were" → ? | ❌ No repair rule |
| Total repairs | 3 |

## Quality Gate (Post-Repair)

| Metric | Value |
|--------|-------|
| ok | false |
| recommendedAction | BLOCK_POLISH_SAVE |
| malformed count | 1 (only "Aether were") |
| quoteIssues count | 0 |
| slop total | 15 |

## Manuscript Safety Gate (Post-Repair, pre-export stage)

| Metric | Value |
|--------|-------|
| **ok** | **true** |
| recommendedAction | WARN_ONLY |
| processLeaks | 0 |
| contamination | 0 |
| malformed | 1 ("Aether were") |

> [!IMPORTANT]
> The manuscript safety gate (used by export) returns `ok=true` for the repaired text.
> Export WOULD pass if repaired text were saved.
> But the quality gate still says BLOCK_POLISH_SAVE (any malformed > 0).
> The save loop reverts the entire chapter, losing all 3 repairs.

## Root Cause

Grammar repair WORKS. But "Aether were" (1 remaining ambiguous pattern) triggers BLOCK_POLISH_SAVE in the quality gate, which causes the save loop to revert the ENTIRE chapter to original text. All 3 valid repairs are lost. Export then sees the original text with all 5 malformed issues.
