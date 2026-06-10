# 07 — Final Report: Chapter 2 Safe Replacement Resolution Hardfix

**Date:** 2026-06-07
**Verdict:** ✅ PASS
**Build:** exit 0
**Tests:** 275 total (22 new + 253 existing), all pass

---

## TABLE 1: Chapter 2 Content Fields

| Field | Contains Poisoned? | Used by Export? | Notes |
|-------|-------------------|-----------------|-------|
| `__safeReplacedContent` | ❌ No (clean text) | ✅ Yes (priority 1) | **NEW** — Set by `safeChapterReplace.js` after save |
| `__polishedContent` | ❌ No (empty) | ❌ No (empty) | Transient; lost on page reload |
| `__polishSavedContent` | ❌ No (empty) | ❌ No (empty) | Transient; lost on page reload |
| `__polishExportContent` | ❌ No (empty) | ❌ No (empty) | Transient; lost on page reload |
| `content_md` | ❌ No (empty or clean) | ❌ No (too short/empty in DB) | Set to `''` in DB (text > 10KB); set to clean text in-memory |
| `content` | ❌ No (cleared) | ❌ No | Cleared by `buildStaleFieldClearPayload()` |
| `content_md_url` | ✅ Yes (stale URL) | ❌ No (bypassed) | GitHub CDN may serve old content; resolver never reaches it when transient exists |
| `prose` | ❌ No (cleared) | ❌ No | Cleared by `buildStaleFieldClearPayload()` |
| `body` | ❌ No (cleared) | ❌ No | Cleared by `buildStaleFieldClearPayload()` |
| `draft` | ❌ No (cleared) | ❌ No | Cleared by `buildStaleFieldClearPayload()` |
| `finalText` | ❌ No (cleared) | ❌ No | Cleared by `buildStaleFieldClearPayload()` |
| `cleanedText` | ❌ No (cleared) | ❌ No | Cleared by `buildStaleFieldClearPayload()` |

---

## TABLE 2: Safe Replace Execution

| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| 1. Safety gate on replacement text | PASS (clean text) | ok=true, processLeaks=0, contamination=0, malformed=0 | ✅ |
| 2. `prepareChapterContent()` for ~24KB | Upload to GitHub, set `content_md: ''` | Uploaded; `content_md: ''`, `content_md_url: <new URL>` | ✅ |
| 3. Clear stale fields | All legacy/transient content fields emptied | 15+ fields cleared via `buildStaleFieldClearPayload()` | ✅ |
| 4. Save to database | Save succeeds | `saveFn(chapterId, payload)` → success | ✅ |
| 5. Set `__safeReplacedContent` | Clean text on chapter object | `chapter.__safeReplacedContent = repairedText` (24KB) | ✅ |
| 6. Clear `__staleContentResolution` | Flag set to false | `chapter.__staleContentResolution = false` | ✅ |
| 7. Set `content_md` in-memory | Clean text in-memory | `chapter.content_md = repairedText` | ✅ |
| 8. Resolver returns clean content | `__safeReplacedContent` used as priority 1 | Resolver returns clean text; URL path never reached | ✅ |

---

## TABLE 3: URL Staleness Root Cause

| Cause | Evidence | Fix |
|-------|----------|-----|
| `content_md` set to `''` for large chapters | `prepareChapterContent()` uploads text > 10KB to GitHub, sets `content_md: ''` | Added `__safeReplacedContent` as priority-1 transient field (chapterStorage.js L471-477) |
| Transient fields lost on page reload | `__polishedContent`, `__polishSavedContent` are JavaScript runtime objects | `__safeReplacedContent` solves same-session; `__staleContentResolution` tagging solves post-reload |
| GitHub CDN returns stale content | New URL created but old URL still served; metadata mismatch detected | `contentLooksStaleAgainstMetadata()` correctly detects; now tags chapter instead of silently returning |
| Resolver returns stale when no inline fallback | `content_md: ''` + all stale fields cleared = no fallback | Now tags chapter with `__staleContentResolution = true` (chapterStorage.js L543-546) |
| Export runs safety gate on stale content | Safety gate catches poisoned content → REJECT_REGENERATE | Pre-export stale check blocks before safety gate runs (ExportTab.jsx L763-785) |

---

## TABLE 4: Code Changes

| File | Change | Why |
|------|--------|-----|
| `src/lib/chapterStorage.js` L471-477 | Added `__safeReplacedContent` as priority-1 in resolver transient chain | Ensures clean replacement text is resolved first within same session |
| `src/lib/chapterStorage.js` L541-547 | Added `__staleContentResolution` and `__staleContentWarning` tagging | Enables downstream consumers (export) to detect stale resolution |
| `src/lib/safeChapterReplace.js` L228-241 | Set `__safeReplacedContent`, clear stale flags, set `content_md` in-memory | Provides clean content for resolver; clears prior stale flags |
| `src/components/publishing/ExportTab.jsx` L763-785 | Pre-export stale content check with `STALE_CONTENT_BLOCK` error | Blocks export with clear message when stale URL content detected |
| `tests/chapter2SafeReplaceResolutionRegression.mjs` | 22 new regression tests (385 lines) | Covers poisoned detection, clean verification, stale resolution, safe replacement, export |

---

## TABLE 5: Regression Tests

| Test Suite | Count | Result |
|-----------|-------|--------|
| chapter2SafeReplaceResolutionRegression.mjs | 22 | ✅ All pass |
| manuscriptSafetyGate.test.mjs | (existing) | ✅ All pass |
| exportSafetyGate.test.mjs | (existing) | ✅ All pass |
| chapterStorage tests | (existing) | ✅ All pass |
| safeChapterReplace tests | (existing) | ✅ All pass |
| All other test suites (11 total) | 253 existing | ✅ All pass |
| **TOTAL** | **275** | **✅ All pass** |

### New Test Coverage Detail

| # | Test Name | Category |
|---|-----------|----------|
| 1 | Poisoned Ch.2 contains all bad canaries | Detection |
| 2 | Safety gate REJECTS poisoned Ch.2 | Detection |
| 3 | Export blocks with poisoned Ch.2 | Detection |
| 4 | Clean Ch.2 has no bad canaries | Verification |
| 5 | Clean Ch.2 has expected fiction markers | Verification |
| 6 | Safety gate PASSES clean Ch.2 | Verification |
| 7 | Export passes with clean Ch.2 | Verification |
| 8 | Stale URL resolution tags chapter object | Stale resolution |
| 9 | Stale chapters are detectable in export array | Stale resolution |
| 10 | Safe replacement workflow: gate → save → transient content | Replacement |
| 11 | Resolver priority: __safeReplacedContent beats URL | Replacement |
| 12 | After safe replace, resolver skips stale URL path | Replacement |
| 13 | All stale fields would be cleared in save payload | Field clearing |
| 14 | Metadata previews match clean text | Field clearing |
| 15 | Full 20-chapter export passes with clean Ch.2 | Export |
| 16 | Full 20-chapter export blocks with poisoned Ch.2 | Export |
| 17 | Full cycle: poisoned Ch.2 → safe replace → export passes | E2E |
| 18 | Resolved content has no contamination after replacement | E2E |
| 19 | Export gate produces 0 process leaks for clean Ch.2 | E2E |
| 20 | Export gate produces 0 contamination for clean Ch.2 | E2E |
| 21 | Export gate produces 0 malformed for clean Ch.2 | E2E |
| 22 | Stale content check in ExportTab logic simulation | E2E |

---

## TABLE 6: Final Export Verification

| Check | Result |
|-------|--------|
| Chapter 2 content source | `__safeReplacedContent` (clean, priority 1) |
| Chapter 2 process leaks | 0 |
| Chapter 2 contamination | 0 |
| Chapter 2 malformed | 0 |
| Chapter 2 safety gate | PASS |
| All 20 chapters resolved | ✅ |
| Stale content resolution failures | 0 |
| Pre-export stale check | PASS (no stale chapters) |
| Pre-export safety gate | PASS (not blocked) |
| Hard failures | 0 |
| Export format produced | DOCX ✅ |
| Build exit code | 0 |
| All 9 bad canaries absent | ✅ Confirmed |

---

## Verdict

### ✅ PASS

**All acceptance criteria met.**

The Chapter 2 safe replacement resolution hardfix closes the gap where:
1. Safe replacement saved clean content to a new GitHub URL
2. Set `content_md: ''` (text > 10KB inline limit)
3. On page reload, the resolver fell back to stale URL content
4. Stale poisoned content passed through to export
5. Safety gate caught it → REJECT_REGENERATE

### Behavior After Fix

| Scenario | Behavior |
|----------|----------|
| **Same session** | `__safeReplacedContent` provides clean text immediately (priority 1). URL path never reached. |
| **Page reload, fresh URL** | GitHub URL returns fresh content → metadata matches → content accepted. |
| **Page reload, stale URL** | Staleness detected → chapter tagged `__staleContentResolution=true` → export throws `STALE_CONTENT_BLOCK` with descriptive error. User prompted to re-save or safe-replace. |

### Note

> Within-session transient content works immediately. Page reload requires the new GitHub URL content to be fresh. If the CDN is still serving stale content after reload, export will block with `STALE_CONTENT_BLOCK` instead of producing a contaminated DOCX. The user should wait for CDN propagation or re-run safe replacement.

---

*Report generated 2026-06-07. Build: exit 0. Tests: 275/275 pass.*
