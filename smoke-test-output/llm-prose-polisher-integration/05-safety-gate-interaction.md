# 05 — Safety Gate Interaction Verification

**Date:** 2026-06-07

---

## Question: Does the LLM polisher weaken existing safety gates?

**Answer: No.** The LLM polisher is a new step inserted between existing gates. It does not modify, bypass, or weaken any existing safety mechanisms.

---

## Safety Stack After LLM Integration

```
1. Pre-polish Safety Gate (UNCHANGED)
   ├── Process leak detection (35+ patterns)
   ├── Project contamination detection
   ├── Malformed grammar detection
   └── REJECT_REGENERATE / REJECT_REVIEW / QUARANTINE actions
         ↓
2. LLM Prose Polish (NEW — only runs on SAFE chapters)
   ├── 18 process leakage guardrails
   ├── 4 contamination guardrails
   ├── Word count bounds (70%–115%)
   ├── Analysis/notes format rejection
   └── On failure: keeps original content, falls back to deterministic
         ↓
3. Deterministic Cleanup (UNCHANGED — 28 steps)
   ├── Banned word removal
   ├── Punctuation/spelling/capitalization repair
   ├── Dialogue tag polish
   ├── Style tic sweep
   ├── AI detection resistance
   ├── Quote boundary repair
   └── Canon name lock
         ↓
4. Post-polish Quality Gate (UNCHANGED)
   ├── Malformed grammar detection
   ├── Missing opening quote detection
   ├── Slop pattern counting
   └── Deterministic grammar/quote auto-repair
         ↓
5. Export Safety Gate (UNCHANGED)
   ├── Process leak detection
   ├── Contamination detection
   ├── Malformed grammar detection
   └── HARD BLOCK on unsafe export
```

---

## Key Safety Properties Verified

| Property | Verified | How |
|----------|----------|-----|
| Contaminated chapters never reach LLM | ✅ | Pre-polish safety gate runs FIRST |
| LLM output with process leaks is blocked | ✅ | Tests 1, 7, 11 in llmProsePolisher.test |
| LLM output with contamination is blocked | ✅ | Test 2 in llmProsePolisher.test |
| LLM failure preserves original text | ✅ | Tests 5, 8 in llmProsePolisher.test + integration test 8 |
| LLM output goes through ALL deterministic passes | ✅ | Pipeline wiring: LLM step is BEFORE Step 2 |
| LLM output must pass post-polish quality gate | ✅ | Integration test 9 (full pipeline) |
| Export safety gate still blocks at export time | ✅ | liveExportSafetyRegression.mjs: 25/25 pass |
| `window.ALLOW_UNSAFE_EXPORT` override still required | ✅ | No changes to exportSafetyGate.js |
| Existing safety tests still pass | ✅ | manuscriptSafetyGate.test: 33/33 |

---

## Chain of Defense

Even if the LLM produces bad output, three independent safety systems catch it:

1. **LLM polisher guardrails** — 18 process leak patterns + 4 contamination patterns + word count bounds → reject bad output before it enters the pipeline
2. **Post-polish quality gate** — catches malformed grammar, missing quotes, slop patterns that survived deterministic cleanup
3. **Export safety gate** — final hard block at export time, independent of all polish steps

Each system operates independently. A failure in one does not compromise the others.
