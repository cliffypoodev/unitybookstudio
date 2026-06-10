# 05 — Post-Replace Verification

**Date:** 2026-06-07
**Status:** VERIFIED — Clean content resolves correctly after fix

---

## Verification: Same-Session Resolution

### After Safe Replacement Completes

The chapter object now has:

```javascript
chapter = {
  id: 'ch2-id',
  chapter_number: 2,
  title: "The Patron's Palette",

  // Database fields (persisted):
  content_md: '',                    // Empty (text > 10KB)
  content_md_url: 'https://raw.githubusercontent.com/.../new-url',
  content_md_word_count: 4200,
  content_md_char_count: 24000,
  polish_saved_preview_start: 'The turpentine fumes were too sharp...',
  polish_saved_preview_end: '...feeling the sudden pressure of Julian\'s gaze.',

  // Transient fields (set by safeChapterReplace.js):
  __safeReplacedContent: '<clean 24KB text>',  // ← NEW: Priority 1
  __staleContentResolution: false,              // ← Cleared
  __staleContentWarning: '',                    // ← Cleared

  // Stale fields (all cleared by buildStaleFieldClearPayload):
  content: '',
  draft: '',
  body: '',
  prose: '',
  finalText: '',
  cleanedText: '',
  __polishedContent: '',
  __polishSavedContent: '',
  __polishExportContent: '',
};
```

### Resolver Trace (Same Session)

```
resolveChapterContent(chapter)
  │
  ├─ L472-477: Check transient fields
  │   chapter.__safeReplacedContent = '<clean 24KB text>'
  │   normalizeText() → 24000 chars
  │   looksLikeUsableContent() → true (length > 50, words > 10)
  │
  ├─ L481-487: ✅ RETURNS CLEAN CONTENT
  │   console.log: "[RESOLVE] Chapter 2 — using transient polished content: { chars: 24000, words: 4200 }"
  │
  └─ URL path: NEVER REACHED
```

### Safety Gate on Resolved Content

```
runManuscriptSafetyGate(resolvedContent, { stage: 'pre-export' })
→ ok: true
→ processLeaks: 0
→ contamination: 0
→ malformed: 0
→ recommendedAction: PASS
```

### Canary Verification

| Canary | Present in Resolved? | Status |
|--------|---------------------|--------|
| `The opening is sharp, highly polished` | ❌ No | ✅ Clean |
| `Next Move:` | ❌ No | ✅ Clean |
| `Action Plan:` | ❌ No | ✅ Clean |
| `Unity Supported Living` | ❌ No | ✅ Clean |
| `Unity Media` | ❌ No | ✅ Clean |
| `care documentation` | ❌ No | ✅ Clean |
| `compliance documentation` | ❌ No | ✅ Clean |
| `You was` | ❌ No | ✅ Clean |
| `Was was` | ❌ No | ✅ Clean |

### Fiction Markers Verified

| Marker | Present? | Status |
|--------|----------|--------|
| `Darius` | ✅ Yes | ✅ Correct |
| `Julian` | ✅ Yes | ✅ Correct |
| `turpentine` | ✅ Yes | ✅ Correct |
| `palette` | ✅ Yes | ✅ Correct |
| `easel` | ✅ Yes | ✅ Correct |

---

## Verification: Page Reload Scenario

After page reload, transient fields are lost:

```javascript
chapter.__safeReplacedContent = undefined;
chapter.__polishedContent = undefined;
// etc.
```

### Resolver Trace (After Reload)

```
resolveChapterContent(chapter)
  │
  ├─ L472-477: Check transient fields → all empty → skip
  │
  ├─ L495-512: Check inline content_md → '' (empty) → skip
  │
  ├─ L515-547: Fetch content_md_url via proxy
  │   ├─ URL returns content (may be stale or fresh)
  │   ├─ contentLooksStaleAgainstMetadata() → check
  │   │
  │   ├─ IF fresh (new URL propagated):
  │   │   → ✅ Returns fresh clean content
  │   │
  │   └─ IF stale (CDN cache/old URL):
  │       ├─ No inline fallback → tags chapter:
  │       │   chapter.__staleContentResolution = true
  │       │   chapter.__staleContentWarning = '...'
  │       └─ Returns stale content
  │
  └─ Export checks __staleContentResolution
      └─ IF true → STALE_CONTENT_BLOCK error (export blocked)
```

### Defense in Depth

| Layer | Protection | Scope |
|-------|-----------|-------|
| 1 | `__safeReplacedContent` transient field | Same-session resolution |
| 2 | `content_md = repairedText` in-memory | Same-session inline fallback |
| 3 | `__staleContentResolution` tagging | Post-reload stale detection |
| 4 | `STALE_CONTENT_BLOCK` export check | Post-reload export blocking |
| 5 | Safety gate (`runPreExportSafetyGate`) | Final catch-all content validation |

---

## Test Confirmation

From `chapter2SafeReplaceResolutionRegression.mjs`:

```
✅ 10. Safe replacement workflow: gate → save → transient content
✅ 11. Resolver priority: __safeReplacedContent beats URL
✅ 12. After safe replace, resolver skips stale URL path
✅ 17. Full cycle: poisoned Ch.2 → safe replace → export passes
✅ 18. Resolved content has no contamination after replacement
```

All verification tests pass.
