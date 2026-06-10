# 02 — Polish Runtime Trace

**Date:** 2026-06-07

---

## Pipeline Flow for Chapter 6

```
Pre-polish text (loaded from DB)
  │ Contains: She were (2), a obvious (1), Aether were (1)
  │ Malformed count: 5
  ▼
LLM Polish (Step 1d)
  │ Status: Unknown (Ollama likely offline → fallback to deterministic)
  │ Effect: None (f.content unchanged or same as original)
  ▼
Deterministic Cleanup (Steps 2-11)
  │ Banned words, punctuation fixes, etc.
  │ Does NOT fix malformed grammar (that's Step 12a)
  ▼
Grammar Repair (Step 12a)
  │ "She were" → "She was" (2 instances) ✅
  │ "a obvious" → "an obvious" (1 instance) ✅
  │ "Aether were" → no rule ❌
  │ Repairs made: 3
  ▼
Quote Repair (Step 12b)
  │ Repairs made: 0 (no missing quotes in Ch.6)
  ▼
Quality Gate (Step 12c)
  │ Remaining malformed: 1 ("Aether were")
  │ Action: BLOCK_POLISH_SAVE
  ▼
Save Loop Decision (Milestone 7 logic)
  │ BLOCK_POLISH_SAVE triggered
  │ ⚠️ OLD BEHAVIOR: f.content = f.original → ALL REPAIRS LOST
  │ Save loop: f.content === f.original → SKIP (not saved)
  ▼
Export resolves DB content (pre-polish original)
  │ Contains: She were (2), a obvious (1), Aether were (1)
  │ Malformed count: 5
  ▼
Export Safety Gate → REJECT_MANUAL_REVIEW (5 malformed, ≥3)
```

---

## Answers to Trace Questions

| # | Question | Answer |
|---|----------|--------|
| 1 | Did LLM polish run on Ch.6? | Unknown — likely offline (Ollama not running) → deterministic fallback |
| 2 | Did deterministic grammar repair run on Ch.6? | **YES** — 3 repairs made |
| 3 | Did repair remove "a obvious"? | **YES** → "an obvious" |
| 4 | Did repair remove/fix "She were"? | **YES** → "She was" (both instances) |
| 5 | Did post-polish quality gate still fail? | **YES** — 1 remaining malformed ("Aether were") |
| 6 | Did the save loop revert Ch.6 to original? | **YES** ← THIS IS THE BUG |
| 7 | Did export resolve stale old content? | **YES** — because the save was skipped, DB has original |

---

## Root Cause Chain

```
Aether were (ambiguous, no auto-repair)
  → quality gate: malformed.count = 1 > 0
    → recommendedAction = BLOCK_POLISH_SAVE
      → save loop: f.content = f.original (REVERT)
        → f.content === f.original → save loop SKIPS
          → DB retains original text (with She were + a obvious)
            → export reads original → REJECT_MANUAL_REVIEW
```

The Milestone 7 fix was too aggressive: it reverted ALL chapters with ANY remaining malformed issue, even if repairs had already fixed MOST of the problems. For Chapter 6:
- 3 out of 4 auto-repairable issues were fixed
- 1 ambiguous issue remained
- The entire chapter was reverted, losing all 3 fixes
