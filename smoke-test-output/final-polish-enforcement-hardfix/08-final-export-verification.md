# 08 — Final Export Verification

**Date:** 2026-06-07

---

## Export Safety Gate Results (DOCX6 Content, After Fix)

Running `runPreExportSafetyGate()` on all 20 chapters from DOCX6:

| Chapter | Safety Gate | Malformed | Process Leaks | Contamination | Blocked? |
|---------|-----------|-----------|---------------|---------------|----------|
| Ch.1 | WARN_ONLY | 0 | 0 | 1 (medium context) | No (warn) |
| Ch.2 | PASS | 0 | 0 | 0 | No |
| Ch.3 | PASS | 0 | 0 | 0 | No |
| Ch.4 | PASS | 0 | 0 | 0 | No |
| Ch.5 | WARN_ONLY | 2 | 0 | 0 | No (warn, <3 malformed) |
| Ch.6 | REJECT_MANUAL_REVIEW | 4 | 0 | 0 | **YES** ✅ |
| Ch.7 | WARN_ONLY | 1 | 0 | 0 | No (warn, <3 malformed) |
| Ch.8 | PASS | 0 | 0 | 0 | No |
| Ch.9 | PASS | 0 | 0 | 0 | No |
| Ch.10-20 | PASS | 0 | 0 | 0 | No |

### Export Safety Summary

- **Blocked:** 1 chapter (Ch.6 — 4 malformed, ≥3 threshold)
- **Warnings:** 3 chapters (Ch.1, 5, 7 — <3 malformed each)
- **Passed:** 16 chapters

### Key Observation

The manuscript safety gate's `WARN_ONLY` threshold is `malformed < 3`. Chapters 5 and 7 have 1-2 malformed instances and get `WARN_ONLY` (which means `ok=true`).

The **quality gate** is stricter — it blocks on ANY malformed grammar. The **safety gate** warns for 1-2 malformed and only rejects at ≥3.

This means the safety architecture has two layers:
1. **Quality gate (polish time):** Strict — blocks save for ANY malformed or >3 quote issues
2. **Export safety gate (export time):** Moderate — blocks for process leaks, contamination, or ≥3 malformed

After the fixes, bad chapters are caught at BOTH layers.

---

## Verification: Clean Chapters Pass

All chapters without malformed grammar, process leaks, or contamination pass export safety cleanly. Chapter 2 (repaired in prior milestone) passes with 0/0/0.

---

## What Would Happen With Next Polish Run

After this hardfix, the next time a user runs "Rewrite and Polish":

1. LLM polish runs on safe chapters
2. Deterministic cleanup runs
3. Quality gate checks all chapters
4. Any chapter with malformed grammar or >3 quote issues → `BLOCK_POLISH_SAVE`
5. Blocked chapters revert to original → NOT saved
6. User sees toast listing blocked chapters
7. Clean chapters save normally
8. At export time, export safety gate provides independent check
