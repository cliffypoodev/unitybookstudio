# 03 — Implementation Report

**Date:** 2026-06-07

---

## Files Changed

### [NEW] `src/lib/llmProsePolisher.js` (280 lines)

New module that provides an LLM-based prose polisher for fiction chapters.

**Exports:**
- `polishChapterWithLLM(params)` — Calls the prose-polisher Ollama model, validates output with guardrails, returns structured result
- `validatePolisherOutput(output, original, title)` — Sync guardrail validation (process leakage, contamination, word count bounds, analysis format)
- `PROSE_POLISHER_SYSTEM_PROMPT` — The system prompt constant

**Key design decisions:**
- Lazy import of `callAgent` via `getCallAgent()` — allows Node.js tests to load the module without Vite
- 18 process leakage patterns + 4 contamination patterns as hard-fail guardrails
- Word count bounds: 70%–115% of original
- `callLLM` parameter enables mock injection for testing

### [MODIFY] `src/pages/ProjectStudio.jsx`

- Added import for `polishChapterWithLLM` (L78)
- Added Step 1d: LLM Prose Polish (L4043–L4105) between pre-polish safety gate and deterministic cleanup
- For each safe chapter:
  1. Calls `polishChapterWithLLM()` with 10-minute timeout
  2. If OK → replaces chapter content with LLM output
  3. If FAIL → keeps original content, reports fallback reason
  4. All content then goes through existing deterministic cleanup passes
- Added `window.__UBS_LAST_LLM_POLISH_LOG` for debugging
- Logs polish count, fallback count, word deltas per chapter

### [NEW] `tests/llmProsePolisher.test.mjs` (13 tests)

Unit tests:
1. Process notes rejected
2. Contamination rejected
3. Too short (50%) rejected
4. Clean output passes
5. LLM failure returns fallback with original text
6. System prompt includes preserve-plot rules
7. System prompt includes slop reduction rules
8. Empty output rejected
9. Analysis format rejected
10. Clean prose passes
11. Model disclaimer rejected
12. "The air" opening warning
13. Expansion beyond 115% rejected

### [NEW] `tests/polishPipelineIntegration.test.mjs` (9 tests)

Integration tests:
1. Pre-polish safety gate passes clean chapter
2. LLM polish returns different text
3. Grammar repair catches "She were" in original, not polished
4. Quality gate catches malformed in original, passes polished
5. Missing opening quote detected
6. Polished text has fewer slop patterns
7. Process-leaked LLM output blocked
8. Failed LLM preserves original text
9. Full pipeline simulation (safety gate → LLM → grammar → quote → quality gate)

---

## Pipeline Flow (Before vs After)

### Before
```
Load → Safety Gate → Deterministic Cleanup (28 steps) → Quality Gate → Save
```

### After
```
Load → Safety Gate → LLM Prose Polish → Deterministic Cleanup (28 steps) → Quality Gate → Save
                          │
                   if LLM fails ──→ fallback to deterministic-only path
```
