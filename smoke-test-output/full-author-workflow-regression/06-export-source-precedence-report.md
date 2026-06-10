# Export Source Precedence Report

**Suite:** Full Author Workflow Regression
**Date:** 2026-06-08

---

## Overview

Source precedence determines which content version is used during export when multiple sources exist (inline content, safe replacements, polished content). This report validates that the correct source is selected in each scenario.

---

## Test Scenarios

### Scenario A — Clean Inline Content

| Aspect | Detail |
|--------|--------|
| **Condition** | No safe replacement, no polished override |
| **Expected source** | Original inline `content_md` |
| **Actual source** | Original inline `content_md` |
| **Status** | ✅ PASS |

The export correctly uses the original draft content when no downstream modifications exist.

---

### Scenario D — Safe Replacement Persists

| Aspect | Detail |
|--------|--------|
| **Condition** | Safe replacement applied to chapter |
| **Expected source** | Safe replacement content (overrides original) |
| **Actual source** | Safe replacement content |
| **Status** | ✅ PASS |

The export correctly prioritizes safe replacement content over the original inline content. Replacement persists through reload.

---

### Scenario E — Polished Content in content_md

| Aspect | Detail |
|--------|--------|
| **Condition** | Chapter has been polished; polished content written to `content_md` |
| **Expected source** | Polished `content_md` |
| **Actual source** | Polished `content_md` |
| **Status** | ✅ PASS |

The export correctly uses the polished content when it has been written back to `content_md`.

---

## Results Summary

| Scenario | Description | Expected | Actual | Status |
|----------|------------|----------|--------|--------|
| A | Clean inline | Original `content_md` | Original `content_md` | ✅ |
| D | Safe replacement persists | Replacement content | Replacement content | ✅ |
| E | Polished content in `content_md` | Polished `content_md` | Polished `content_md` | ✅ |

---

## Source Precedence Order (Validated)

```
1. Safe replacement content  (highest priority)
2. Polished content_md
3. Original inline content_md  (lowest priority)
```

---

## Verdict

**PASS** ✅ — All 3 source precedence scenarios passed. Export correctly selects the highest-priority content source in every case.
