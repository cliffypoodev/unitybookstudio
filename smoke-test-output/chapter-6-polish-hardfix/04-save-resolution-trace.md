# 04 — Save/Resolution Trace

**Date:** 2026-06-07

---

## Save Path — Before Fix

```
Grammar repair output (3 fixes applied, "Aether were" remaining)
  │
  ▼
Quality gate: BLOCK_POLISH_SAVE (malformed=1)
  │
  ▼
Save loop enforcement:
  f.content = f.original  ← REVERTS ALL 3 REPAIRS
  │
  ▼
f.content === f.original → save loop SKIPS
  │
  ▼
DB retains pre-polish original text
  │
  ▼
Export resolves original → 5 malformed → REJECT_MANUAL_REVIEW
```

---

## Save Path — After Fix (Smart Partial-Repair Handling)

```
Grammar repair output (3 fixes applied, "Aether were" remaining)
  │
  ▼
Quality gate: BLOCK_POLISH_SAVE (malformed=1)
  │
  ▼
Save loop enforcement v2:
  Original malformed count: 5
  Repaired malformed count: 1
  Text changed? YES
  Improvement? YES (1 < 5)
  → KEEP repaired text (DON'T revert)
  → Log remaining issues for manual review
  │
  ▼
f.content ≠ f.original → save loop SAVES repaired text
  │
  ▼
Save payload:
  ├── staleClear: clear 15 stale content fields
  ├── contentFields: content_md = repaired text (or content_md_url if > 10KB)
  ├── backupFields: backup of original
  ├── word_count: updated
  └── revision_notes: polish source stamp
  │
  ▼
DB has repaired text → export resolves repaired → 1 malformed → WARN_ONLY → PASS
```

---

## Fix A: Smart Save-Loop Decision

**File:** [ProjectStudio.jsx](file:///Users/cliff/Downloads/UBS/src/pages/ProjectStudio.jsx#L4584)

**Logic:**
```javascript
// Compare malformed counts before and after repair
const originalGate = runProsePolishQualityGate(f.original || '');
const repairedGate = runProsePolishQualityGate(f.content || '');
const textChanged = f.content !== f.original;

if (textChanged && repairedGate.malformed.count < originalGate.malformed.count) {
  // Repairs improved the chapter — SAVE the improved text
  // DON'T revert — let the improved text be saved
} else {
  // Repairs made no improvement — revert
  f.content = f.original;
}
```

**Decision matrix:**

| Condition | Action | Example |
|-----------|--------|---------|
| Text unchanged AND still has malformed | Revert (no-op) | LLM failed, no deterministic fixes applied |
| Text changed AND malformed REDUCED | **SAVE** repaired text | Ch.6: 5 → 1 malformed, keep the 3 fixes |
| Text changed AND malformed NOT reduced | Revert | Repairs introduced new issues (shouldn't happen) |
| Text changed AND malformed = 0 | SAVE (gate wouldn't block) | All issues fixed → normal save |

---

## Fix B: Stale Field Clearing in Polish Save

**File:** [ProjectStudio.jsx](file:///Users/cliff/Downloads/UBS/src/pages/ProjectStudio.jsx#L4678)

**Before:** Save payload only set `contentFields`, `backupFields`, `word_count`, `revision_notes`.

**After:** Save payload first clears 15 stale content fields:

| Stale Field | Why Clear? |
|-------------|-----------|
| content | Old inline text that export might resolve instead of content_md |
| draft | Draft text that might override polished text |
| body | Alternative content field |
| prose | Alternative content field |
| finalText | Leftover from old pipeline |
| cleanedText | Leftover from old pipeline |
| chapter_text | Alternative content field |
| markdown | Alternative content field |
| content_html | HTML version of old text |
| content_html_url | Uploaded HTML version |
| content_delta | Rich text delta format |
| content_delta_url | Uploaded delta format |
| __polishedContent | In-memory polish cache |
| __polishSavedContent | Polish save cache |
| __polishExportContent | Polish export cache |

Then canonical content fields (`content_md` / `content_md_url`) are set to the repaired text, overriding the stale-cleared values.

---

## Export Content Resolution

After the fix, export resolves:

1. ~~`content_md_url`~~ (cleared by stale-clear, re-set only if content > 10KB)
2. `content_md` = repaired text (She was, an obvious)
3. ~~`content`~~ (cleared)
4. ~~`draft`~~ (cleared)
5. ~~`body`~~ (cleared)

Export safety gate sees repaired text:
- malformed = 1 ("Aether were") → WARN_ONLY → `ok=true`
- processLeaks = 0
- contamination = 0
- **Export PASSES** ✅
