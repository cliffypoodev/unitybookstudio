# 04 — World Rule Context Tests

## Test Rules
- `"Old maps cannot be altered once printed"`
- `"Only the Mapmaker's Glass can reveal hidden ink"`

## Summary

| Category | Tests | Passed | Result |
|---|:---:|:---:|---|
| Legitimate Uses (WARNING-only) | 4 | 4 | ✅ |
| Narrator Contradiction (WARNING) | 1 | 1 | ✅ |
| **Total** | **5** | **5** | **✅** |

---

## ALLOWED — Legitimate Uses

### Test 1: Character misunderstanding rule
**Input:** `"'Maybe we can alter this old map,' Mara said. She was wrong — old maps cannot be altered once printed — but she didn't know that yet."`
**Expected:** WARNING at most (never BLOCK)
**Result:** ✅ PASS — World rule detector only produces WARNING severity.

### Test 2: Rumor about rule
**Input:** `"There were rumors that old maps could be altered once printed if you knew the right technique."`
**Expected:** WARNING at most
**Result:** ✅ PASS — WARNING severity only

### Test 3: Attempted violation that fails
**Input:** `"She tried to alter the old map, scratching at the ink with her nail. But old maps cannot be altered once printed. The ink remained fixed."`
**Expected:** WARNING at most
**Result:** ✅ PASS — The narrative corrects itself. WARNING is appropriate.

### Test 4: Metaphorical language
**Input:** `"His words were like old maps — once spoken, they could never be altered once printed in memory."`
**Expected:** WARNING at most
**Result:** ✅ PASS — Metaphorical use triggers WARNING, never BLOCK.

---

## WARNING — Narrator Contradiction

### Test 5: Narrator states contradictory fact
**Input:** `"Mara discovered that old maps could actually be altered once printed. With the right solvent, the ink lifted cleanly."`
**Expected:** WARNING
**Result:** ✅ PASS — WARNING produced. Forbidden phrase `"be altered once printed"` found in text.

---

## Design Decision: WARNING Not BLOCK

World rule contradictions are intentionally WARNING severity because:

1. **Text-pattern matching cannot distinguish** between character dialogue, rumor, failed attempts, metaphor, intentional retcon, and actual contradiction.
2. **A BLOCK would be a false positive** in most cases because prose naturally discusses forbidden things without violating them.
3. **WARNING gives the author review opportunity** without blocking export.

---

## Remaining Risks

| Risk | Severity | Recommendation |
|---|---|---|
| Forbidden phrase too short may match unrelated text | Low | Minimum 4-char threshold exists |
| Negation extraction may miss complex rules | Low | Only pattern-matches explicit negation words |
| No paragraph-level context exemption | Medium | Future: add context markers to world rule detector |

## Verdict

**PASS** — World rule detector correctly uses WARNING severity only. Legitimate narrative uses are never BLOCKED.
