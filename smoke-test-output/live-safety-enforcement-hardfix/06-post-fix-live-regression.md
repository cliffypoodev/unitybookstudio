# 06 — Post-Fix Live Regression

**Report:** Proving the hardfix blocks (4).docx contaminated content
**Date:** 2026-06-07

---

## Test 1: Real (4).docx Chapter 2 Extraction + Gate Scan

| Metric | Value |
|--------|-------|
| Source | `digital-equity-tribunal (4).docx` |
| Extraction method | XML (unzip + parse word/document.xml) |
| Chapter 2 length | 24,319 chars |
| Gate result (`ok`) | **`false`** |
| Recommended action | **`REJECT_REGENERATE`** |
| Process leak matches | **8** |
| Contamination matches | **8** |
| Malformed grammar matches | **1** |

### Process Leak Detections

| # | Phrase | Snippet |
|---|--------|---------|
| 1 | "The opening is sharp, highly polished" | The opening is sharp, highly polished, and immediately establishes |
| 2 | "Next Move:" | Next Move: Commit to the Bargain |
| 3 | "Action Plan:" | Action Plan: |
| 4 | "The current trajectory is working exactly as planned" | The current trajectory is working exactly as planned. We have estab... |
| 5 | "We have established the what and the why" | We have established the what and the why. Next Move: Commit... |
| 6–8 | "We need to move" / "Focus on how" | (additional process commentary) |

### Contamination Detections

| # | Phrase | Snippet |
|---|--------|---------|
| 1 | "Unity Supported Living Services" | Unity Supported Living Services. For Media Solutions, I manag... |
| 2–3 | "Unity Supported Living" | (2 additional occurrences) |
| 4 | "Unity Media Solutions" | Unity Media Solutions. "The AI element..." |
| 5–6 | "Unity Media" | (2 additional occurrences) |
| 7 | "care documentation" | The care documentation required granular focus... |
| 8 | "compliance documentation" | the compliance documentation alone; last quarter... |

### Malformed Grammar Detection

| # | Phrase | Snippet |
|---|--------|---------|
| 1 | "You was" | You was Julian talking about the pain... |

---

## Test 2: Live Export Safety Regression (liveExportSafetyRegression.mjs)

```
LIVE EXPORT SAFETY REGRESSION: 25 passed, 0 failed out of 25
All live export regression checks passed! ✅
```

### Detailed Results

| Regression Check | Result | Details |
|-----------------|--------|---------|
| Mixed manuscript (1 bad + 2 clean) | ✅ BLOCKED | Ch.2 hard failure; Ch.1 and Ch.3 passed |
| All chapters contaminated | ✅ BLOCKED | Both chapters failed |
| All clean chapters | ✅ PASS | Export proceeds normally |
| Failure report format | ✅ PASS | Contains "EXPORT BLOCKED", chapter number, override instructions |
| Short chapter skip | ✅ PASS | < 100 chars skipped without false positive |
| **Real (4).docx Chapter 2** | ✅ **BLOCKED** | **8 process leaks, 8 contamination — export would not proceed** |

---

## Verdict

> [!IMPORTANT]
> The extracted Chapter 2 from `digital-equity-tribunal (4).docx` is now **blocked** by the same export gate used by the live app. The catch-block fallthrough that allowed the previous bypass has been eliminated. Export will not produce DOCX.
