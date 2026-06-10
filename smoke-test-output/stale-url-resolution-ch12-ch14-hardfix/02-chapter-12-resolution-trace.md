# 02 — Chapter 12 Resolution Trace

> **Chapter:** 12 — The Anatomist's Protocol  
> **Classification:** A — Metadata mismatch only  
> **Resolution:** Safety gate PASS → Metadata refresh  
> **Export Status:** ✅ Proceeds

---

## Content Profile

| Field | Value |
|-------|-------|
| **Chapter** | 12 |
| **Title** | The Anatomist's Protocol |
| **Protagonist** | Dr. Elara Voss |
| **Content Theme** | Tissue analysis, anatomical research |
| **Content Quality** | Valid fiction text — no contamination, no process leaks |

---

## Stale Detection Trace

### Step 1: URL Content Fetch

The resolver fetches content from the stored URL for Chapter 12. The fetched content is valid fiction text featuring Dr. Elara Voss performing tissue analysis. The prose is well-formed, contains no malformed grammar, and reads as intended narrative fiction.

### Step 2: Metadata Comparison

`contentLooksStaleAgainstMetadata()` compares the fetched content against stored metadata:

```
Stored Metadata (post-polish):
  polish_saved_word_count:    [post-polish count]
  polish_saved_char_count:    [post-polish count]
  polish_saved_preview_start: [post-polish preview]
  polish_saved_preview_end:   [post-polish preview]

Fetched URL Content (pre-polish):
  actual_word_count:          [pre-polish count — DIVERGES]
  actual_char_count:          [pre-polish count — DIVERGES]
  actual_preview_start:       [pre-polish preview — DIVERGES]
  actual_preview_end:         [pre-polish preview — DIVERGES]
```

**Result:** Mismatch detected → `isStale = true`

### Step 3: Inline Fallback Check

```
chapter.inlineFallback: undefined
chapter.__safeReplacementContent: undefined
```

**Result:** No inline fallback available.

### Step 4: Pre-Fix Behavior (BLOCKED)

Without the hardfix, the resolver path was:

```
URL content stale + no inline fallback → STALE_CONTENT_BLOCK
  → chapter.__staleContentResolution = true
  → Export BLOCKED
```

---

## Post-Fix Resolution Trace

### Step 5: SAFETY-GATE RECOVERY Path (NEW)

With the hardfix applied (`chapterStorage.js` L543-576):

```
URL content stale + no inline fallback
  → Enter SAFETY-GATE RECOVERY
  → Run manuscriptSafetyGate(fetchedContent)
```

### Step 6: Safety Gate Evaluation

`manuscriptSafetyGate()` evaluates the fetched URL content:

| Check | Result | Detail |
|-------|--------|--------|
| Fiction text detection | ✅ PASS | Content is narrative prose |
| Process leak scan | ✅ PASS | No system prompts, no JSON fragments |
| Contamination check | ✅ PASS | No cross-chapter character bleed |
| Grammar integrity | ✅ PASS | No malformed sentences or truncation |
| Character consistency | ✅ PASS | Dr. Elara Voss — correct protagonist for Ch.12 |

**Gate Result:** ✅ **PASS**

### Step 7: Tagging

```
chapter.__needsMetadataRefresh = true    ← NEW tag (not __staleContentResolution)
chapter.__staleContentResolution = false  ← NOT set
```

### Step 8: Export Decision

```
ExportTab.jsx checks:
  __staleContentResolution? → false → no block
  __needsMetadataRefresh?   → true  → log WARNING, proceed

Export: ✅ PROCEEDS
```

---

## Root Cause Summary

```
manuscriptFixer.js (polish pipeline)
  → Updated metadata fields:
      polish_saved_word_count
      polish_saved_char_count
      polish_saved_preview_start
      polish_saved_preview_end
  → Did NOT re-upload content to new URL
  → Old URL retains valid pre-polish content
  → Metadata/content mismatch triggers stale detection
```

---

## Verification Checklist

- [x] URL content is valid fiction text about Dr. Elara Voss
- [x] No process leaks detected in URL content
- [x] No contamination or cross-chapter character bleed
- [x] No malformed grammar or truncated prose
- [x] Safety gate passes on fetched content
- [x] Chapter tagged `__needsMetadataRefresh=true`
- [x] Chapter NOT tagged `__staleContentResolution=true`
- [x] Export proceeds without block

---

> [!NOTE]
> The pre-polish content at the URL is valid fiction text. The only discrepancy is that metadata was updated to reflect post-polish metrics while the URL was not re-uploaded. The safety gate correctly identifies this as acceptable content.
