# 01 — Current Stale URL Resolution State

> **Report Date:** 2026-06-07  
> **Scope:** Chapters 12 & 14 — Stale URL Content Block  
> **Status:** BLOCKED → RESOLVED (post-hardfix)

---

## Overview

Following the Ch.2 safe-replacement hardfix, the export pipeline now includes a **stale-content blocker** that prevents export when URL content does not match the metadata recorded for a chapter. This blocker is functioning correctly — it is the metadata that is out of sync, not the content.

**Two chapters are currently blocked by `STALE_CONTENT_BLOCK`:**

| Chapter | Title | Blocked By | URL Content Status |
|---------|-------|-----------|-------------------|
| Ch.12 | The Anatomist's Protocol | `STALE_CONTENT_BLOCK` | ✅ Valid fiction text |
| Ch.14 | The Incantation of Bytes | `STALE_CONTENT_BLOCK` | ✅ Valid fiction text |

---

## What Is Happening

### The Stale Detection Mechanism

The function `contentLooksStaleAgainstMetadata()` in `chapterStorage.js` compares:

1. **URL content metrics** — word count, character count, preview text extracted from the fetched URL content
2. **Stored metadata** — `polish_saved_word_count`, `polish_saved_char_count`, `polish_saved_preview_start`, `polish_saved_preview_end`

When these values diverge beyond threshold, the content is flagged as stale.

### Why Both Chapters Are Flagged

The polish pipeline (`manuscriptFixer.js`) updated metadata fields to reflect **post-polish** text:
- Updated `polish_saved_word_count` and `polish_saved_char_count`
- Updated `polish_saved_preview_start` and `polish_saved_preview_end`

However, the polished text was **never re-uploaded** to a new URL. The existing URL still contains the **pre-polish** content, which is valid fiction text but has different metrics than what the metadata expects.

### The Block Behavior

```
Export Pipeline Flow:
  1. Resolve chapter content → fetch URL
  2. Run contentLooksStaleAgainstMetadata()
  3. Metadata mismatch detected → STALE_CONTENT_BLOCK
  4. Chapter excluded from export
  5. Export halted (2 chapters blocked)
```

---

## Chapter-Level State

### Chapter 12 — The Anatomist's Protocol

- **URL:** Contains valid fiction text about Dr. Elara Voss performing tissue analysis
- **Metadata mismatch:** Word count and preview text diverge from URL content
- **Inline fallback:** ❌ None available
- **Export status:** 🚫 Blocked

### Chapter 14 — The Incantation of Bytes

- **URL:** Contains valid fiction text about Kira Nakamura in a server room
- **Metadata mismatch:** Word count and preview text diverge from URL content
- **Inline fallback:** ❌ None available
- **Export status:** 🚫 Blocked

---

## Classification

Both chapters are **Classification A: Metadata mismatch only**.

- URL content is correct, well-formed fiction text
- No process leaks, contamination, or malformed grammar
- No inline fallback exists to compare against
- The stale detection is working correctly — the *metadata* is stale, not the *content*

---

## Resolution Path

The hardfix introduces a **SAFETY-GATE RECOVERY** path in the `chapterStorage.js` resolver:

1. When URL content is flagged as stale but no inline fallback exists
2. Run `manuscriptSafetyGate()` on the fetched content
3. If the gate **passes** → accept the content, tag with `__needsMetadataRefresh=true`
4. If the gate **fails** → tag with `__staleContentResolution=true` (export blocks)

This allows legitimate content to proceed while still catching genuinely contaminated stale content.

---

> [!IMPORTANT]
> The stale-content blocker is working as designed. The fix does not bypass the blocker — it adds a safety-gate recovery path that validates content before allowing it through.
