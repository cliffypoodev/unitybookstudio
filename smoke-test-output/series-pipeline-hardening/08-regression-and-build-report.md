# Regression & Build Report

**Generated:** 2026-06-09
**Suite:** Series Pipeline Hardening

---

## Test Results

```
node --experimental-vm-modules tests/seriesPipelineHardening.test.mjs
```

| Suite | Tests | Passed | Failed | Result |
|---|---|---|---|---|
| 1. Dead Character Resurrection | 5 | 5 | 0 | ✅ PASS |
| 2. Resolved Thread Reopening | 3 | 3 | 0 | ✅ PASS |
| 3. Entry Contract Violations | 3 | 3 | 0 | ✅ PASS |
| 4. Exit Contract Violations | 2 | 2 | 0 | ✅ PASS |
| 5. World Rule Contradictions | 2 | 2 | 0 | ✅ PASS |
| 6. Voice Drift | 1 | 1 | 0 | ✅ PASS |
| 7. Standalone Mode | 2 | 2 | 0 | ✅ PASS |
| 8. Continuation Mode | 2 | 2 | 0 | ✅ PASS |
| 9. Anthology Isolation | 1 | 1 | 0 | ✅ PASS |
| 10. Spinoff Branch | 1 | 1 | 0 | ✅ PASS |
| 11. Volume Bible Staleness | 4 | 4 | 0 | ✅ PASS |
| 12. Source Hash | 3 | 3 | 0 | ✅ PASS |
| 13. No-Series Project | 1 | 1 | 0 | ✅ PASS |
| 14. Entry + Exit Combined | 1 | 1 | 0 | ✅ PASS |
| 15. Report Builder | 1 | 1 | 0 | ✅ PASS |
| 16. Wiring Bug Verification | 1 | 1 | 0 | ✅ PASS |
| 17. Edge Cases | 3 | 3 | 0 | ✅ PASS |
| 18. Build Check | 1 | 1 | 0 | ✅ PASS |
| **TOTAL** | **37** | **37** | **0** | **✅ ALL PASS** |

---

## Build Verification

```
npx vite build
```

| Check | Result |
|---|---|
| Compilation | ✅ Clean |
| Warnings | None |
| Exit code | 0 |

---

## What Was Tested

### Detection Algorithm Correctness
- Dead characters flagged as BLOCK when appearing alive/active in text
- Dead characters allowed in memory/flashback contexts (memoryMarkers check)
- Alive characters not falsely flagged
- Resolved threads flagged when reopened with conflict language
- Resolved threads allowed as callbacks (WARNING or no flag)
- Entry contract: required-alive character killed → BLOCK
- Entry contract: required-dead character appears alive → BLOCK
- Entry contract: respected → no blocks
- Exit contract: must-alive character killed → BLOCK
- Exit contract: must-dead character alive → BLOCK
- World rules: forbidden action detected → WARNING
- World rules: no violation → pass
- Voice drift: POV mismatch detected → WARNING

### Mode Differentiation
- Standalone mode: skips dead character + resolved thread checks, keeps world rule + voice checks
- Continuation mode: full checks including dead characters
- Anthology mode: passes with new characters (no carryover obligation)
- Spinoff mode: inherits world state checks

### Staleness System
- No volume bible → stale
- No timestamp → stale
- Project updated after bible → stale
- Bible newer than project → fresh
- Source hash changes with chapter count
- Source hash changes with word count

### Wiring Bug Verification
- Confirmed `buildSeriesContinuityBlock(project)` produces empty block (no deaths, no resolved threads)
- Confirmed `buildSeriesContinuityBlock(seriesBible)` produces correct block with death/thread data

### Edge Cases
- Malformed JSON → handled gracefully (returns empty array)
- Empty text → returns empty array
- Special regex characters in names (O'Brien) → handled correctly
- Null inputs → returns empty array

---

## Files Created/Modified

| File | Action | Lines |
|---|---|---|
| `src/lib/seriesContractGate.js` | NEW | 497 |
| `tests/seriesPipelineHardening.test.mjs` | NEW | 748 |

---

## Test Coverage Map

| seriesContractGate.js Export | Tests |
|---|---|
| `detectDeadCharacterResurrection` | 5 direct + 2 via orchestrator |
| `detectResolvedThreadReopened` | 3 direct + 1 via orchestrator |
| `detectWorldRuleContradictions` | 2 direct + 1 via orchestrator |
| `detectCharacterStatusContradictions` | Via orchestrator (continuation mode) |
| `detectEntryContractViolations` | 3 direct + 1 via orchestrator |
| `detectExitContractViolations` | 2 direct + 1 via orchestrator |
| `detectSeriesVoiceDrift` | 1 direct + 1 via orchestrator |
| `runSeriesContractGate` | 7 direct (modes + contracts) |
| `buildSeriesContractReport` | 1 |
| `checkVolumeBibleStaleness` | 4 |
| `computeVolumeBibleSourceHash` | 3 |
