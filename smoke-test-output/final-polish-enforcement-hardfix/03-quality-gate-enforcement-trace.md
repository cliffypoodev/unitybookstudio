# 03 — Quality Gate Enforcement Trace

**Date:** 2026-06-07

---

## Gate Results on DOCX6 Chapters (Before Fix)

| Chapter | Quality Gate ok | Action | Malformed | Quotes | Slop | Would Block Save? |
|---------|----------------|--------|-----------|--------|------|-------------------|
| Ch.1 | false | MANUAL_REVIEW→REPAIR_AGAIN | 0 | 5 | 63 | **NO** ← BUG |
| Ch.5 | false | BLOCK_POLISH_SAVE | 2 | 3 | 39 | YES (but save continued) |
| Ch.6 | false | BLOCK_POLISH_SAVE | 2 | 13 | 45 | YES (but save continued) |
| Ch.7 | false | BLOCK_POLISH_SAVE | 1 | 8 | 33 | YES (but save continued) |
| Ch.9 | false | MANUAL_REVIEW | 0 | 4 | 49 | **NO** ← BUG |

---

## Bug 1: Quality Gate Did Not Block Quote-Heavy Failures

**Location:** `prosePolishQualityGate.js:206`

**Before:**
```javascript
} else if (quoteIssues.count > 3) {
  recommendedAction = 'REPAIR_AGAIN';  // ← Not treated as block
```

**After:**
```javascript
} else if (quoteIssues.count > 3) {
  recommendedAction = 'BLOCK_POLISH_SAVE';  // ← Now blocks
```

**Impact:** Ch.1 (5 quote issues) and any chapter with > 3 missing-opening-quote patterns now get `BLOCK_POLISH_SAVE`.

---

## Bug 2: Save Loop Ignored BLOCK_POLISH_SAVE

**Location:** `ProjectStudio.jsx:4577-4604`

**Before:**
```javascript
if (blockCount > 0) {
  toast.error(`...BLOCKED...`);
  // ← NO ENFORCEMENT: save loop runs anyway
}
// ... STEP 13: Save ALL chapters
for (const f of loaded) {
  if (f.content === f.original) continue;
  // Saves f.content even if gate said BLOCK_POLISH_SAVE
```

**After:**
```javascript
if (blockCount > 0) {
  toast.error(`...`);
  // HARDFIX: revert blocked chapters to original content
  const blockedNums = new Set(polishGateFailures
    .filter(f => f.action === 'BLOCK_POLISH_SAVE')
    .map(f => f.chapter));
  for (const f of loaded) {
    if (blockedNums.has(f.chapter?.chapter_number)) {
      f.content = f.original; // revert → save loop skips
    }
  }
}
```

**Impact:** Blocked chapters now revert to original content before the save loop, so `f.content === f.original` and the save loop skips them.

---

## Gate Results on DOCX6 Chapters (After Fix)

| Chapter | Quality Gate ok | Action | Would Block? | Save Outcome |
|---------|----------------|--------|-------------|-------------|
| Ch.1 | false | BLOCK_POLISH_SAVE | YES ✅ | Reverted, skipped |
| Ch.5 | false | BLOCK_POLISH_SAVE | YES ✅ | Reverted, skipped |
| Ch.6 | false | BLOCK_POLISH_SAVE | YES ✅ | Reverted, skipped |
| Ch.7 | false | BLOCK_POLISH_SAVE | YES ✅ | Reverted, skipped |
| Ch.9 | false | BLOCK_POLISH_SAVE | YES ✅ | Reverted, skipped |

---

## Deterministic Repair Effectiveness

| Chapter | Input Issue | Repair Applied | Residual After Repair |
|---------|-----------|---------------|---------------------|
| Ch.5 | She were carrying | ✅ → She was carrying | She was it monopolistic (NOT auto-repairable) |
| Ch.6 | She were those just | ✅ → She was those just | Aether were (NOT auto-repairable) |
| Ch.6 | a obvious thing | ✅ → an obvious thing | — |
| Ch.7 | Was was it | ✅ → Was it | — (clean after repair) |
| Ch.1 | Missing opening quotes | ✅ → 5 quotes repaired | — |
