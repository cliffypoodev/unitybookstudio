# Final Verdict — Conservative Recast Mode v2

**Pipeline Version:** v2.0
**Date:** 2026-06-09

---

## Verdict: PASS WITH NOTES

The conservative recast mode v2 pipeline is architecturally correct, safer than v1, and proven in live bakeoff testing. The pipeline improvements are real. The limiting factor is the prose-polisher model, not the pipeline.

---

## What PASSED

### Architecture ✅
- **Conservative mode is the default.** All genres use the 92–110% word count ratio unless explicitly overridden.
- **Prompts include explicit word count range.** The model sees exact numbers (e.g., "390–466 words"), not vague instructions.
- **RECAST_MODE enum** supports conservative/standard/aggressive with clean lookup table.

### Safety ✅
- **Retry-on-compression works.** 1/1 retry succeeded. Literary chunk 0 was saved — v1 lost it entirely.
- **Quality guard works.** Nonfiction chunk 0 regression (62→58) was correctly blocked.
- **Safety blocks decreased:** 2 (v1) → 1 (v2).

### Results ✅
- **Thriller IMPROVED:** +6 composite delta, 80→86 EXCELLENT. Filter verbs dropped from 3.4/1K to 1.7/1K.
- **Nonfiction did NOT regress:** 66→66. The previous −17 regression remains resolved.
- **Literary stable:** 69→69. Retry saved a chunk that v1 failed.
- **Average delta improved:** +0.7 (v1) → +2.0 (v2).

### Preservation ✅
- **Citations preserved:** 1→1 in nonfiction.
- **Headings preserved:** 1→1 in nonfiction.
- **Word counts preserved:** All accepted recasts within 92–110% ratio.

### Testing ✅
- **68 new tests:** All pass.
- **99 previous bakeoff tests:** All pass.
- **500+ existing regression tests:** All pass.
- **Build:** Clean, zero warnings, zero errors.

---

## What LIMITED (Why Not FINAL PASS)

### 1. Nonfiction Model Quality

Nonfiction chunk 0: the prose-polisher recast scored **lower** than the original (58 < 62). The quality guard correctly blocked the regression, but the model itself failed to improve nonfiction prose. The pipeline did everything right — the model didn't.

### 2. Literary Recast Quality Is Flat

Literary chunk 0: the retry fixed the word count (100% ratio), but the recast scored the **same** as the original (68→68). The chunk was accepted because it wasn't worse, but it also wasn't better. The pipeline saved the chunk; the model didn't improve it.

### 3. Limited Recast Impact

Only **2 out of 8 chunks** were recast across all three genres. Conservative mode correctly skips chunks that already score well, but this means the pipeline's impact is limited to the few low-scoring chunks in each document.

### 4. Filter Verbs Unchanged in Literary

Literary filter verbs remain at 9.4/1K — the highest across all genres. The prose-polisher does not target filter verbs in its recast. The conservative prompt does not include filter-verb-specific instructions.

### 5. Chatbot Patterns Slightly Increased

Thriller chatbot patterns increased by 1 (22→23). Within acceptable bounds, and the chatbot increase guard did not trigger, but the trend is worth monitoring.

---

## Honest Assessment

> The pipeline is **more correct** with v2. Conservative mode, length anchors, retry loop, and quality guards all work as designed.

> The retry feature is **proven** — it saved a chunk that v1 lost entirely.

> The quality guard is **proven** — it correctly blocked a regression in nonfiction.

> The **bottleneck remains the prose-polisher model**, not the pipeline. The pipeline correctly detects and blocks model failures, but it cannot make the model produce better output.

> The average improvement from +0.7 to +2.0 is **meaningful but driven entirely by one excellent thriller recast**. Remove thriller and the average delta is 0.

> This is a **PIPELINE PASS WITH NOTES** — the architecture is correct, safety is improved, one retry saved, but model quality is the limiting factor for further improvement.

---

## Scorecard

| Dimension | v1 | v2 | Verdict |
|-----------|----|----|---------|
| Architecture correctness | Partial | Full | ✅ Improved |
| Length preservation | Weak (vague prompt) | Strong (explicit anchors) | ✅ Improved |
| Retry capability | None | Working (1/1) | ✅ New |
| Quality guard | Basic | Structured (failureType) | ✅ Improved |
| Nonfiction safety | Protected | Protected | ➖ Same |
| Thriller quality | GOOD (80) | EXCELLENT (86) | ✅ Improved |
| Literary quality | COMPETENT (69) | COMPETENT (69) | ➖ Same |
| Nonfiction quality | COMPETENT (66) | COMPETENT (66) | ➖ Same |
| Safety blocks | 2 | 1 | ✅ Improved |
| Average delta | +0.7 | +2.0 | ✅ Improved |
| Test coverage | 99 + 500+ | 167 + 500+ | ✅ Improved |
| Build | Clean | Clean | ✅ Same |

---

## Recommendations for FINAL PASS

### 1. Tune Prose-Polisher Modelfile for Recast Tasks

The current Modelfile may be optimized for general polish, not for targeted recast. A recast-specific Modelfile with stronger length-following and quality-preservation training could improve nonfiction and literary results.

### 2. Add Filter-Verb-Targeting Instructions

The conservative recast prompt should include explicit instructions to reduce filter verbs (e.g., "Replace filter verbs like 'seemed', 'appeared', 'felt' with more direct alternatives"). Literary's 9.4/1K rate is the highest across genres and currently unaddressed by the recast pipeline.

### 3. Consider a Dedicated Recast Model

If the prose-polisher continues to struggle with nonfiction recast, consider training or fine-tuning a dedicated model for recast tasks. This model would be trained specifically on pairs of (original, improved) text with strong length-preservation constraints.

### 4. Test With More Chunks Per Genre

The current bakeoff uses short texts (~800–1200 words, 2–3 chunks each). Testing with longer texts (3000+ words, 8+ chunks) would provide better statistical signal on recast quality and retry success rates.

---

## Appendix: Version Comparison Matrix

| Feature | v1.0 | v2.0 |
|---------|------|------|
| Recast mode | Standard only | Conservative (default), Standard, Aggressive |
| Word count ratio | 85–110% | 92–110% (conservative) |
| Model-facing word count | No | Yes (explicit in prompt) |
| Model-facing word range | No | Yes (min–max in prompt) |
| Paragraph count anchor | No | Yes |
| Anti-summarize directive | No | Yes ("Do NOT summarize") |
| Nonfiction constraints | No | Yes (citations, headings, structure) |
| Retry on compression | No | Yes (one retry) |
| Length-correction prompt | No | Yes (too short/too long + delta) |
| Validation failureType | No (free text) | Yes (structured enum) |
| Validation word metrics | No | Yes (origWords, recastWords, ratio) |
| Chatbot increase guard | Basic | Enhanced |
| Test coverage (new) | 99 | 167 (+68) |
