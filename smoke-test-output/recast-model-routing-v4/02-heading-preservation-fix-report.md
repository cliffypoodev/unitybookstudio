# Recast Model Routing v4 — Heading Preservation Fix Report

**Date:** 2026-06-09
**Module:** `src/lib/recastModelRouting.js` → `validateHeadingPreservation()`
**Pipeline:** `antiChatbotRecastPipeline.js` v4.0

---

## The v3 Problem

In v3 bakeoff testing, nonfiction content lost a heading during the recast process:

| Metric | Before Recast | After Recast | Result |
|---|---|---|---|
| Headings | 3 | 2 | **−1 heading lost** ❌ |

Heading loss in nonfiction is a **structural integrity failure**. Nonfiction relies on headings for:
- Document navigation
- Information hierarchy
- Reader orientation in long-form content
- SEO and accessibility

The v3 recast model would occasionally restructure prose in ways that merged or dropped section headings, silently damaging the document structure.

---

## The v4 Fix: validateHeadingPreservation()

v4 introduces a **hard gate** that blocks any recast that reduces the heading count for heading-sensitive profiles.

### Detection Functions

#### detectMarkdownHeadings(text)
Counts markdown-style headings (`#`, `##`, `###`, etc.):
- Matches lines starting with 1–6 `#` characters followed by a space
- Returns the total count

#### detectSectionHeadings(text)
Counts non-markdown section headings using heuristic patterns:
- ALL CAPS lines (likely section headers)
- Short lines followed by blank lines (title-case headings)
- Lines ending with colons that precede content blocks
- Returns the total count

#### Total heading count
`totalHeadings = detectMarkdownHeadings(text) + detectSectionHeadings(text)`

### Validation Logic

```
validateHeadingPreservation(originalText, recastText, profile):
  if profile is fiction/literary/memoir/poetry:
    return PASS  // fiction doesn't use structural headings
  
  originalCount = totalHeadings(originalText)
  recastCount = totalHeadings(recastText)
  
  if recastCount < originalCount:
    return BLOCK  // heading loss detected — reject recast
  
  return PASS
```

### Profile Sensitivity

| Profile Category | Gate Active? | Rationale |
|---|---|---|
| Nonfiction | ✅ Yes | Structural headings are critical |
| Business | ✅ Yes | Reports/proposals need heading hierarchy |
| Training/educational | ✅ Yes | Learning materials need clear sections |
| Literary fiction | ❌ Bypass | Fiction rarely uses structural headings |
| Memoir | ❌ Bypass | Memoir chapters don't have section headers |
| Poetry | ❌ Bypass | Poetry has stanzas, not headings |

---

## Pipeline Integration

The heading preservation gate is wired into `recastChunkWithAntiChatbotRules`:

```
1. Detect weakness types
2. Choose recast model
3. Call LLM for recast
4. ──► validateHeadingPreservation(original, recast, profile)
5.     If BLOCK: reject recast, keep original, increment headingBlocks counter
6.     If PASS: continue to next validation
7. Validate literary recast (if applicable)
8. Return final result
```

The `headingBlocks` counter is tracked in the pipeline report, giving visibility into how often the gate triggers.

---

## v4 Bakeoff Results

| Metric | Value | Notes |
|---|---|---|
| Heading blocks triggered | **0** | No heading loss in any genre |
| Nonfiction headings preserved | ✅ | — |
| Fiction headings bypassed | ✅ | Gate correctly did not activate for fiction |

### Important Caveat

In this specific bakeoff run, the raw nonfiction output from the ghostwriter had **0 headings** — the model didn't generate any markdown headings in this particular run. Therefore:

- The heading gate was technically not exercised against live recast data
- There were no headings to lose, so the gate had nothing to block
- The gate **would have activated** if the nonfiction had contained headings and the recast lost one

This is correct behavior — the gate is passive when there are no headings at risk. The gate's correctness is validated by the 15 dedicated tests.

---

## Test Coverage

**File:** `recastHeadingPreservation.test.mjs` — **15 tests, all passing**

### Test Categories

| Category | Count | What's Tested |
|---|---|---|
| Markdown heading detection | 3 | `#`, `##`, `###` counting accuracy |
| Section heading detection | 3 | ALL CAPS, title-case, colon-terminated |
| Heading preservation pass | 3 | Equal or increased heading count passes |
| Heading preservation block | 3 | Reduced heading count blocks |
| Profile bypass | 3 | Fiction/literary/memoir correctly bypass gate |

### Key Test Cases

1. **Nonfiction with 3 headings → recast with 2**: BLOCKED ✅
2. **Nonfiction with 3 headings → recast with 3**: PASSED ✅
3. **Nonfiction with 3 headings → recast with 4**: PASSED ✅ (adding headings is fine)
4. **Literary with 3 headings → recast with 0**: PASSED ✅ (fiction bypasses gate)
5. **Business with mixed heading types → recast with fewer**: BLOCKED ✅

---

## Summary

The heading preservation gate is a targeted safety mechanism for nonfiction content. It is:

- **Conservative:** Only blocks when heading count decreases
- **Profile-aware:** Bypasses fiction where headings aren't structural
- **Non-invasive:** Doesn't modify content, only rejects/accepts
- **Tested:** 15 tests covering detection, validation, and bypass logic

**Status:** Implemented and tested. Not yet exercised by live bakeoff data (need a nonfiction run with headings in the raw output). The code is correct; it needs a tougher live test to fully validate.
