# 02 — LLM Polish Runtime Trace

**Date:** 2026-06-07

---

## Analysis: Did the LLM Polish Step Run?

The LLM Prose Polisher (Step 1d) was integrated into `handleManuscriptPolish()` in the previous session. However, the DOCX6 failures prove it either:

1. **Did not run** — The DOCX was exported before the LLM polish code was deployed
2. **Ran but fell back** — Ollama was not running, so all chapters fell back to deterministic-only
3. **Ran but bad output was saved anyway** — The quality gate detected but didn't block

### Evidence

The DOCX6 file timestamp (`Jun 7 15:28`) falls within the window when:
- The LLM polish code was being integrated
- The quality gate was **detecting issues but NOT blocking saves** (the primary bug)
- The deterministic grammar repair was running but the save loop ignored gate results

### Root Cause of Bad Text Surviving

**The quality gate DID run. It DID detect issues. But it never blocked saving.**

The code at `ProjectStudio.jsx:4577-4588` (before fix):
```javascript
if (blockCount > 0) {
  toast.error(`...BLOCKED...`);  // Shows toast ← COSMETIC ONLY
  // ← NO CODE TO ACTUALLY PREVENT SAVING
}
// ... continues to save loop, which saves ALL chapters regardless
```

### Per-Chapter Trace (from quality gate scan of DOCX6 content)

| Chapter | Safety Gate | Quality Gate | Would Block? | Malformed | Quotes | Slop |
|---------|------------|--------------|-------------|-----------|--------|------|
| Ch.1 | PASS (WARN_ONLY) | FAIL | NO ❌ | 0 | 5 | 63 |
| Ch.5 | PASS | FAIL | YES ✅ | 2 | 3 | 39 |
| Ch.6 | PASS | FAIL | YES ✅ | 2 | 13 | 45 |
| Ch.7 | PASS (WARN_ONLY) | FAIL | YES ✅ | 1 | 8 | 33 |
| Ch.9 | PASS | FAIL | NO ❌ | 0 | 4 | 49 |

### Key Finding

- **Ch.1 and Ch.9**: Quality gate returned `ok=false` but `action='MANUAL_REVIEW'` because `malformed.count=0` and `quoteIssues.count <= 3` (Ch.9) or `quoteIssues.count > 3` but action was `REPAIR_AGAIN` (Ch.1). Neither triggered `BLOCK_POLISH_SAVE`.
- **Ch.5, 6, 7**: Quality gate returned `BLOCK_POLISH_SAVE` because `malformed.count > 0`. But the save loop **ignored this completely**.
- **No chapters were actually prevented from saving** even when the gate said BLOCK.

---

## Logging Additions (Post-Fix)

The following runtime debugging globals are now available:

```javascript
window.__UBS_LAST_LLM_POLISH_LOG  // per-chapter LLM polish results
window.__UBS_LAST_POLISH_GATE     // per-chapter post-polish quality gate results
```

Console log prefixes:
```
[LLM-POLISH] Ch.N: ...
[POLISH-GATE] Ch.N: ...
```
