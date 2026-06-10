# 01 — DOCX6 Failure Scan

**Date:** 2026-06-07
**Input:** `digital-equity-tribunal (6).docx` (434,104 chars, 20 chapters)

---

## Summary

| Metric | Count |
|--------|-------|
| Total chapters | 20 |
| Chapters with hard failures | 4 (Ch.1, 5, 6, 7) |
| Total hard grammar failures | 5 |
| Total missing-quote failures | 7 |
| Chapters with process leaks | 1 (Ch.9: "next move") |
| Total slop instances | 741 across all chapters |

---

## Failure Detail

| Chapter | Issue | Exact Example | Severity | Gate Detects? | Auto-Repairable? |
|---------|-------|--------------|----------|---------------|------------------|
| Ch.1 | Missing opening quote | `The game is the model, Marcus,"` | HARD | ✅ quoteIssues | ✅ repairMissingOpeningQuotes |
| Ch.1 | Missing opening quote | `And I thrive on efficiency,"` | HARD | ✅ quoteIssues | ✅ repairMissingOpeningQuotes |
| Ch.5 | Verb agreement | `She were carrying` | HARD | ✅ malformed (she-were) | ✅ grammar repair |
| Ch.5 | Garbled phrase | `She was it monopolistic practice` | HARD | ✅ malformed (she-was-it) | ❌ requires LLM |
| Ch.6 | Garbled phrase | `She were those just metrics` | HARD | ✅ malformed (were-those-just, she-were) | ✅ partial (she-were only) |
| Ch.6 | Garbled phrase | `Aether were they` | HARD | ✅ malformed (aether-were) | ❌ requires LLM |
| Ch.6 | Article error | `a obvious thing` | HARD | ✅ malformed (a-obvious) | ✅ grammar repair |
| Ch.7 | Doubled word | `Was was it a failure` | HARD | ✅ malformed (was-was) | ✅ grammar repair |
| Ch.9 | Process leak | `next move` | MEDIUM | ✅ process leaks | ❌ (false positive — fiction dialogue) |

---

## Global Slop Counts

| Pattern | Count |
|---------|-------|
| felt | 254 |
| wasn't just | 144 |
| narrative | 107 |
| performance | 69 |
| didn't just | 59 |
| the weight of | 36 |
| realized | 30 |
| the system wasn't | 20 |
| isn't just | 14 |
| not just | 5 |
| the platform wasn't | 3 |
| **Total** | **741** |

---

## Chapters Clean of Hard Failures

Ch.2, 3, 4, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 — no grammar, quote, process, or contamination hard failures.
