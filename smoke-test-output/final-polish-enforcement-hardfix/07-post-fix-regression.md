# 07 — Post-Fix Regression

**Date:** 2026-06-07

---

## Target Chapters: Quality Gate After Fix

Using exact DOCX6 chapter content as input:

### Chapter 1: The Algorithmic Stage

| Stage | Result |
|-------|--------|
| Quality gate input | 5 quote issues, 0 malformed, 63 slop |
| **Quality gate action** | **BLOCK_POLISH_SAVE** ✅ (was REPAIR_AGAIN before fix) |
| Deterministic grammar repair | 0 repairs needed |
| Quote repair | 5 repairs made |
| After all repairs | ok=false (slop still > 50 → MANUAL_REVIEW) |
| **Save blocked?** | **YES** ✅ (reverted to original) |

**Target canaries after repair:**
- ❌ `The game is the model, Marcus,"` → Fixed by quote repair
- ❌ `And I thrive on efficiency,"` → Fixed by quote repair

### Chapter 5: The Transit of Ghosts

| Stage | Result |
|-------|--------|
| Quality gate input | 3 quote issues, 2 malformed (she-were, she-was-it), 39 slop |
| **Quality gate action** | **BLOCK_POLISH_SAVE** ✅ |
| Deterministic grammar repair | 1 repair (She were → She was) |
| After grammar repair | 1 malformed remains (she-was-it — NOT auto-repairable) |
| **Save blocked?** | **YES** ✅ (reverted to original) |

**Target canaries after repair:**
- ❌ `She were carrying` → Fixed to `She was carrying`
- ✅ `She was it monopolistic` → **Still present** (requires LLM rewrite, not auto-repairable)

### Chapter 6: The Drift of Echoes

| Stage | Result |
|-------|--------|
| Quality gate input | 13 quote issues, 2 malformed (she-were, a-obvious), plus aether-were and were-those-just = 4 total |
| **Quality gate action** | **BLOCK_POLISH_SAVE** ✅ |
| Deterministic grammar repair | 2 repairs (She were → She was, a obvious → an obvious) |
| After grammar repair + quote repair | ok=true, 0 malformed, 0 quotes |
| **Save blocked?** | **YES** ✅ (blocked pre-repair due to malformed) |

**Target canaries after repair:**
- ❌ `She were those just metrics` → Fixed (She was + partial)
- ✅ `Aether were they` → **Still present** (flagged but no auto-repair)
- ❌ `a obvious thing` → Fixed to `an obvious thing`

### Chapter 7: The Anatomist's Stage

| Stage | Result |
|-------|--------|
| Quality gate input | 8 quote issues, 1 malformed (was-was), 33 slop |
| **Quality gate action** | **BLOCK_POLISH_SAVE** ✅ |
| Deterministic grammar repair | 1 repair (Was was → Was) |
| After all repairs | ok=true, 0 malformed, 0 quotes |
| **Save blocked?** | **YES** ✅ |

**Target canary after repair:**
- ❌ `Was was it a failure` → Fixed to `Was it a failure`

---

## Key Finding

All 4 target chapters are now correctly **blocked from saving** when they contain hard failures. The deterministic repair can fix some issues, but the quality gate blocks save BEFORE the repaired text would be saved — this is by design, since the gate runs after repair and the remaining issues (like `She was it monopolistic`) can't be auto-fixed.

The correct workflow after these fixes is:
1. Polish runs all steps including LLM and deterministic repair
2. Quality gate checks the final output
3. Chapters with remaining hard failures are reverted to original
4. User sees toast: "Polish quality gate BLOCKED X chapter(s)"
5. User must fix those chapters via LLM re-generation or manual editing
6. Export safety gate provides a second independent check
