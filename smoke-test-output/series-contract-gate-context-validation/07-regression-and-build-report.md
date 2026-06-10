# 07 — Regression and Build Report

## Test Execution Summary

| Test Suite | Tests | Passed | Failed | Status |
|---|:---:|:---:|:---:|---|
| seriesPipelineHardening.test.mjs | 37 | 37 | 0 | ✅ |
| seriesLiveWiringFix.test.mjs | 44 | 44 | 0 | ✅ |
| seriesContractGateContextValidation.test.mjs | 52 | 52 | 0 | ✅ |
| **Total** | **133** | **133** | **0** | **✅** |

## Build Status

✅ `npx vite build` — clean, zero warnings, zero errors.

---

## New Test Coverage (seriesContractGateContextValidation.test.mjs)

### Section 1: Dead Character — Flashback (4 tests)
- ✅ Flashback with temporal marker: "years earlier"
- ✅ Flashback with "back then"
- ✅ Flashback with "long ago"
- ✅ Flashback with "before the war"

### Section 2: Dead Character — Memory (3 tests)
- ✅ Memory with active verbs: "remembered" + "smiled"
- ✅ Memory with "recalled"
- ✅ Memory with dialogue: "had said"

### Section 3: Dead Character — Dream (3 tests)
- ✅ Dream with active verbs
- ✅ Nightmare with active verbs
- ✅ Dream with explicit wake-up framing

### Section 4: Dead Character — Letter/Document (3 tests)
- ✅ Letter written before death
- ✅ Police report listing character
- ✅ Journal entry

### Section 5: Dead Character — Hallucination (3 tests)
- ✅ Hallucination clearly labeled
- ✅ Phantom sighting
- ✅ Ghost visitation

### Section 6: Dead Character — Historical Discussion (4 tests)
- ✅ Historical reference: "before his death"
- ✅ Photo/portrait reference
- ✅ Funeral/eulogy context
- ✅ Legacy reference

### Section 7: Dead Character — Real Resurrection (4 tests)
- ✅ Real present-tense resurrection: walks in and speaks — BLOCKED
- ✅ Unexplained alive status — BLOCKED
- ✅ Active plot participation — BLOCKED
- ✅ Dialogue attribution with no framing — BLOCKED

### Section 8: Resolved Thread — Historical Mention (3 tests)
- ✅ Reflective mention with "recalled" — NOT BLOCKED
- ✅ Character reflecting on solved case — NOT BLOCKED
- ✅ News article about past resolution — NOT BLOCKED

### Section 9: Resolved Thread — Active Reopening (3 tests)
- ✅ Thread reopened with exact phrase wording
- ✅ Near-miss wording (conservative by design)
- ✅ Three-gate design structural verification

### Section 10: World Rule — Legitimate Uses (4 tests)
- ✅ Character misunderstanding rule — WARNING only
- ✅ Rumor about rule — WARNING only
- ✅ Attempted violation that fails — WARNING only
- ✅ Metaphorical language — WARNING only

### Section 11: World Rule — Narrator Contradiction (1 test)
- ✅ Narrator states contradictory rule — WARNING

### Section 12: Entry Contract — Opening Contradiction (2 tests)
- ✅ Required-alive character killed in opening — BLOCKED
- ✅ Required-dead character alive in opening — BLOCKED

### Section 13: Entry Contract — Allowed Contexts (1 test)
- ✅ Required-dead character in flashback — NOT BLOCKED

### Section 14: Exit Contract — Middle Chapter (1 test)
- ✅ Exit contract not checked for middle chapters

### Section 15: Exit Contract — Final/Export (1 test)
- ✅ Required-alive character killed at end — BLOCKED

### Section 16: Anthology Callbacks (2 tests)
- ✅ Anthology does not enforce protagonist continuity
- ✅ Anthology callback to shared world element — NOT BLOCKED

### Section 17: Standalone Easter Eggs (2 tests)
- ✅ Standalone easter egg reference — NOT BLOCKED
- ✅ Standalone world rule still produces WARNING

### Section 18: Non-Series Project (1 test)
- ✅ Non-series project triggers no checks

### Section 19: Export Gate (2 tests)
- ✅ Export gate blocks dead character resurrection for continuation
- ✅ Export gate stores series report

### Section 20: Source File Verification (4 tests)
- ✅ seriesContractGate.js has expanded context markers
- ✅ seriesContractGate.js uses context-first logic
- ✅ Resolved thread detector has reflective markers
- ✅ Resolved thread detector searches per-paragraph

### Section 21: Build Verification (1 test)
- ✅ Build files exist

---

## Regression Confirmation

All pre-existing test suites (81 tests) pass without modification after the context-awareness fix was applied to `seriesContractGate.js`. This confirms:

1. **No weakening of hard enforcement** — real resurrection, real reopening, and contract violations still BLOCK
2. **No false-positive introduction** — expanded markers don't interfere with existing detection paths
3. **Build integrity maintained** — Vite build produces zero warnings/errors
