# 05 — Live Manuscript Proof

**Date:** 2026-06-10  
**Manuscript:** Digital Equity Tribunal 2  
**Source:** `smoke-test-output/live-safety-enforcement-hardfix/extracted-full-text.txt`

---

## Manuscript Statistics

| Metric | Value |
|--------|-------|
| Total chapters | 21 |
| Total length | 434,020 characters |
| Essay phrases | 6 |
| Scene indicators | 868 |
| Balance score | 99 (fiction-appropriate) |

---

## Real Defects Found

The unified pipeline scanned the full manuscript and found **13 real defects**:

| Line | Type | Snippet |
|------|------|---------|
| 98 | **contamination** | "Unity Supported Living" (business name in fiction) |
| 102 | **contamination** | "Unity Supported Living" (repeat) |
| 143 | **forensic-phrase** | "not merely" |
| 195 | **forensic-phrase** | "not merely" |
| 202 | **SVA-error** | "She were" |
| 213 | **forensic-phrase** | "not merely" |
| 254 | **duplicate-word** | "Was was it a failure, or was it…" |
| 264 | **SVA-error** | "She were" |
| 266 | **forensic-phrase** | "not merely" |
| 305 | **duplicate-word** | "Was was it a single intake stream?" |
| 374 | **forensic-phrase** | "not merely" |
| 411 | **SVA-error** | "She were" |
| 607 | **spaced-abbreviation** | "e. g." |

### Breakdown by Category

| Category | Count | Action |
|----------|-------|--------|
| Duplicate words ("Was was") | 2 | ✅ Auto-fixed by Phase 2 |
| SVA errors ("She were") | 3 | ✅ Auto-fixed by Phase 2 |
| Forensic phrases ("not merely") | 5 | 📊 Tracked in essay imbalance (Phase 7) |
| Spaced abbreviations ("e. g.") | 1 | ✅ Auto-fixed by Phase 1 |
| Project contamination | 2 | ⛔ Detected by manuscript safety gate (separate) |

---

## Chapter 2: Surface-Only Mode (Export Preflight)

Ran `mode: 'surface-only'` on Chapter 2 to simulate export preflight:

| Metric | Value |
|--------|-------|
| Word count | 3,896 → 3,894 |
| Repairs applied | 8 |
| Dialogue openers repaired | 6 |
| Slop repairs | 0 (correctly skipped) |
| Sentence recasts | 0 (correctly skipped) |
| Blocked | No |

This confirms that surface-only mode runs only the safe deterministic cleanup (phases 1-4) and correctly skips AI-slop reduction and sentence recasts — exactly what export preflight should do.

---

## Essay-vs-Scene Balance

| Metric | Value |
|--------|-------|
| Essay phrases | 6 |
| Scene indicators | 868 |
| Balance score | 99 |
| Warnings | None |

Balance score of 99 is excellent for a fiction manuscript. The 6 essay phrases are within the fiction threshold (8/chapter). No imbalance warnings generated.

---

## Process Leak Contamination

Lines 68-76 of the manuscript contain clear **process leak contamination** — editorial notes like:
- "The opening is sharp, highly polished"
- "You nailed the initial rhythm"
- "Next Move: Commit to the Bargain"
- "Action Plan:"

These are caught by the **manuscript safety gate** (separate from this pipeline) and would block export. The unified prose refinement pipeline correctly does NOT try to handle contamination — that's the safety gate's job.
