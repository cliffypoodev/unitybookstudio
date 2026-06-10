# Full Author Workflow Regression — Test Plan

**Suite:** Full Author Workflow Regression
**Date:** 2026-06-08
**Build:** Clean
**Result:** 176/176 PASSED ✅

---

## Objective

Validate the complete author workflow end-to-end across three distinct project types, ensuring that drafting, polishing, safe replacement, export, reload, re-export, and safety scanning all function correctly under each profile configuration.

---

## Projects Under Test

| # | Project Title | Genre | Profile | Key Focus |
|---|--------------|-------|---------|-----------|
| 1 | *Signal Lost* | Thriller | `fiction` | Dialogue repair, slop reduction, voice preservation |
| 2 | *The Platform Tax* | Investigative Nonfiction | `nonfiction` | Structure preservation (headings, bullets, citations, tables) |
| 3 | *Coastal Heat* | Adult Romance | `fiction` (mapped) | Adult content safety, zero false censorship |

---

## Workflow Steps

Each project follows the same workflow pipeline:

```
Profile Setup → Draft (Ch1-3) → Safety Scan → Polish → Safe Replace (Ch.3)
    → Export (pre-reload) → Reload → Export (post-reload) → Source Precedence
```

---

## Test Matrix

| Step | Fiction | Nonfiction | Adult Romance |
|------|---------|------------|---------------|
| Profile configuration | ✅ | ✅ | ✅ |
| Draft Ch1-3 | ✅ | ✅ | ✅ |
| Safety scan (draft) | ✅ | ✅ | ✅ |
| Polish Ch1-3 | ✅ | ✅ | ✅ |
| Safe replace Ch.3 | ✅ | ✅ | ✅ |
| Export (pre-reload) | ✅ | ✅ | ✅ |
| Reload persistence | ✅ | ✅ | ✅ |
| Export (post-reload) | ✅ | ✅ | ✅ |
| Source precedence | ✅ | ✅ | ✅ |
| Corrupted content rejection | ✅ | ✅ | ✅ |
| Safety regression scan | ✅ | ✅ | ✅ |

---

## Additional Test Suites

| Suite | Tests | Passed | Failed |
|-------|-------|--------|--------|
| Full Author Workflow Regression | 176 | 176 | 0 |
| Full Pipeline | 922 | 922 | 0 |

---

## Verdict

All test areas covered. No exclusions or known skip conditions. Proceed to individual project reports for detailed results.
