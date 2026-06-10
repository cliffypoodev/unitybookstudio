# 01 — Live Failure Confirmation

**Report:** Live Safety Gate Failure on `digital-equity-tribunal (4).docx`
**Date:** 2026-06-07
**Status:** ✅ CONFIRMED — Safety gate correctly detects all contamination

---

## 1. Source Document

| Property | Value |
|----------|-------|
| Filename | `digital-equity-tribunal (4).docx` |
| Extraction method | XML extraction |
| Total extracted text | 434,020 characters |
| Chapter 2 extracted text | 24,319 characters |

---

## 2. Canary Search Results

All **10 canaries** were searched across the full extracted text. Every one was **FOUND**.

| # | Canary Phrase | Status | Index Position |
|---|---------------|--------|----------------|
| 1 | `"The opening is sharp, highly polished"` | ✅ FOUND | 25,653 |
| 2 | `"You have successfully executed"` | ✅ FOUND | 25,866 |
| 3 | `"Next Move:"` | ✅ FOUND | 26,301 |
| 4 | `"Action Plan:"` | ✅ FOUND | 26,852 |
| 5 | `"Unity Supported Living"` | ✅ FOUND | 41,274 |
| 6 | `"Unity Media"` | ✅ FOUND | 43,372 |
| 7 | `"You was"` | ✅ FOUND | 32,264 |
| 8 | `"Was was"` | ✅ FOUND | 125,146 |
| 9 | `"care documentation"` | ✅ FOUND | 43,322 |
| 10 | `"compliance documentation"` | ✅ FOUND | 42,996 |

> [!IMPORTANT]
> All 10 canaries confirmed present in the extracted document. The contamination is real and spans multiple categories: process leaks (canaries 1–4), cross-project contamination (canaries 5–6, 9–10), and malformed grammar (canaries 7–8).

---

## 3. Chapter 2 Safety Gate Scan

The `manuscriptSafetyGate.js` module was run against the extracted Chapter 2 text (24,319 chars).

| Metric | Value |
|--------|-------|
| Gate result (`ok`) | **`false`** |
| Recommended action | **`REJECT_REGENERATE`** |
| Process leak matches | **8** |
| Contamination matches | **8** |
| Malformed grammar matches | **1** |
| **Total failures** | **17** |

### Failure Breakdown by Category

| Category | Count | Example Phrases |
|----------|-------|-----------------|
| Process Leaks | 8 | `"The opening is sharp, highly polished"`, `"You have successfully executed"`, `"Next Move:"`, `"Action Plan:"` |
| Contamination | 8 | `"Unity Supported Living"`, `"Unity Media"`, `"care documentation"`, `"compliance documentation"` |
| Malformed Grammar | 1 | `"You was"` |

---

## 4. Confirmation Verdict

| Question | Answer |
|----------|--------|
| Is the contamination real? | **YES** — 10/10 canaries confirmed at specific character offsets |
| Does the safety gate detect it? | **YES** — 17 total failures detected across all 3 categories |
| Does the gate recommend blocking? | **YES** — `REJECT_REGENERATE` action returned |
| Was this content exported to DOCX before the fix? | **YES** — the catch-block fallthrough allowed it (see Root Cause 1 in report 02) |

> [!CAUTION]
> The safety gate module (`manuscriptSafetyGate.js`) was functioning correctly all along. The contaminated content reached the exported DOCX because the **export path** bypassed the gate via a catch-block fallthrough. This is addressed in the hardfix.
