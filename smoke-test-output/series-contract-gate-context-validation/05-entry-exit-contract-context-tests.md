# 05 — Entry/Exit Contract Context Tests

## Test Contracts

**Entry Contract:**
- Characters required alive: Mara Vale
- Characters required dead: Elias Crowe
- Threads must be open: black-map conspiracy

**Exit Contract:**
- Characters alive: Mara Vale
- Threads open for next: The guild's ultimate plan
- Threads closed: black-map conspiracy

## Summary

| Category | Tests | Passed | Result |
|---|:---:|:---:|---|
| Opening Contradiction (BLOCKED) | 2 | 2 | ✅ |
| Allowed Contexts | 1 | 1 | ✅ |
| Middle Chapter (NOT BLOCKED) | 1 | 1 | ✅ |
| Final/Export Violation (BLOCKED) | 1 | 1 | ✅ |
| **Total** | **5** | **5** | **✅** |

---

## BLOCKED — Entry Contract Opening Contradictions

### Test 1: Required-alive character killed in opening
**Input:** `"Chapter 1. Mara Vale had died in the fire that consumed the old library. Her body was found among the ashes."`
**Expected:** BLOCKED
**Result:** ✅ BLOCK — Death phrase `"Mara Vale had died"` matches entry contract requirement for Mara Vale alive.

### Test 2: Required-dead character appears alive
**Input:** `"Elias Crowe stepped off the train at the central station. He looked around and nodded to himself."`
**Expected:** BLOCKED
**Result:** ✅ BLOCK — `nameAppearsAsActive("Elias Crowe")` returns true (no context markers, active verbs present).

---

## ALLOWED — Context-Aware Entry Contract

### Test 3: Required-dead character in flashback
**Input:** `"Mara remembered when Elias Crowe had been alive. Those days were long ago."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"remembered"` and `"long ago"` trigger context markers → `nameAppearsAsActive` returns false → entry contract NOT violated.

---

## NOT BLOCKED — Middle Chapter

### Test 4: Exit contract not relevant for middle chapters
**Input:** `"Mara Vale investigated the tunnels beneath the city. The conspiracy remained opaque."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — Exit contract checks only run for `isFinalChapter || isExport`. Middle chapters are exempt.

---

## BLOCKED — Final/Export Exit Contract Violations

### Test 5: Required-alive character killed at end
**Input:** `"In the final chapter, Mara Vale died in the explosion. Her death marked the end of the conspiracy."`
**Expected:** BLOCKED
**Result:** ✅ BLOCK — Death phrases `"Mara Vale died"` and `"her death"` match exit contract requirement for Mara Vale alive at end.

---

## Contract Enforcement by Position

| Position | Entry Contract | Exit Contract |
|---|---|---|
| Opening chapter | ✅ Enforced | ❌ Not checked |
| Middle chapter | ⚠️ Partial (alive checks only) | ❌ Not checked |
| Final chapter | ⚠️ Partial | ✅ Enforced |
| Full export | ✅ Enforced | ✅ Enforced |

## Remaining Risks

| Risk | Severity | Recommendation |
|---|---|---|
| Contract obligation foreshadowed but incomplete in early chapter | None | Correct behavior — foreshadowing is not a violation |
| Emotional state evolution not tracked | Low | Would require LLM-based analysis |
| Thread closure verification is INFO-only | Low | Text-based heuristic can't determine thread resolution semantics |

## Verdict

**PASS** — Entry/exit contracts correctly block violations, correctly exempt context-framed references, and correctly limit exit contract checks to final chapter and export.
