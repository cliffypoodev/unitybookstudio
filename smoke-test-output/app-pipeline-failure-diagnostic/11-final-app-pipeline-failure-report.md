# Final App Pipeline Failure Report — CORRECTED v2

> [!IMPORTANT]
> **Critical correction:** The actual Fix/Polish pipeline is `handleManuscriptPolish()` in **ProjectStudio.jsx** (line 3731), NOT `fixEntireManuscript()` in manuscriptFixer.js. The `fixEntireManuscript()` function (7,866 lines) is **dead code** — exported but never imported or called anywhere in the app UI.

---

## TABLE 1 — Pipeline Architecture Discovery

| Pipeline | UI Button | Actual Function | File | Status |
|----------|-----------|----------------|------|--------|
| Rewrite All | "Rewrite All Drafted" | `handleRewriteAll()` → `draftChapter()` | ProjectStudio.jsx L3310 | ✅ Active |
| Draft All | "Draft All Remaining" | `handleDraftAll()` → `draftChapter()` | ProjectStudio.jsx L3144 | ✅ Active |
| Polish (Fiction) | "✨ Polish Manuscript" | `handleManuscriptPolish()` | ProjectStudio.jsx L3731 | ✅ Active |
| Polish (Nonfiction) | "✨ Polish Manuscript" | `handleManuscriptPolishNonfiction()` | ProjectStudio.jsx L3699 | ✅ Active |
| Scan & Fix | "🔧 Scan & Fix All" | `handleScanFixAll()` | ProjectStudio.jsx L4390 | ✅ Active |
| Export | Export button | `handleExport()` → `buildResolvedExportChapters()` | ExportTab.jsx L765 | ✅ Active |
| **fixEntireManuscript** | **NONE** | `fixEntireManuscript()` | manuscriptFixer.js L7646 | ❌ **DEAD CODE** |

---

## TABLE 2 — File Comparison

| File | Chapters | Words | Process Leaks | Contamination | Malformed | Quote Issues | Verdict |
|------|----------|-------|---------------|---------------|-----------|--------------|---------|
| Rewrite (2).docx | 20 | 69,988 | 7 (Ch.2 only) | 19 (9 chapters) | 2 (Ch.1) | 6 | ❌ FAIL |
| Polished (3).docx | 20 | 69,797 | 7 (Ch.2 only) | 19 (9 chapters) | 4 (Ch.1, Ch.2) | 0 | ❌ FAIL |

> [!CAUTION]
> Fix/Polish did NOT remove a single process leak or contamination instance. It only reduced word count by 191 words (0.27%) — mechanical cleanup only.

---

## TABLE 3 — Safety Feature Coverage

| Safety Feature | Draft Pipeline (sceneWriter) | Polish Pipeline (ProjectStudio.jsx) | Export Pipeline (ExportTab) | Dead Code (manuscriptFixer.js) |
|---|---|---|---|---|
| **Process-leak detection** | ✅ `cleanNarrativeMetaLeaks()` | ❌ **ABSENT** | ❌ ABSENT | Partially (forbidden pipeline artifacts only) |
| **Hard reject for process leakage** | ⚠️ No hard reject, just cleaning | ❌ **ABSENT** | ❌ ABSENT | Partially (artifact sweep) |
| **Contamination guard** | ✅ `validateProjectChapterContent()` per-scene + final | ⚠️ `stripProjectContaminationBlocks()` + `runContaminationDetector()` (diagnostic-only, name-only) | ❌ ABSENT | ⚠️ Diagnostic-only |
| **Banned word removal** | ❌ LLM handles naturally | ✅ Explicit regex with 33 banned words (L3799) | ❌ ABSENT | ❌ Not present |
| **Quote repair** | ✅ `repairChapterQuotes()` | ✅ `fixHangingQuotes()` | ⚠️ Limited (`closeOddDoubleQuoteParagraphs` only) | ✅ Present |
| **Repetition caps** | ❌ LLM handles | ✅ Deterministic per-word caps | ❌ N/A | ❌ N/A |
| **Malformed sentence repair** | ❌ N/A | ❌ Not called | ❌ N/A | ✅ `runTargetedMalformedSentenceRepair()` |
| **Anti-gaslight save verify** | ❌ N/A | ✅ Read-back from DB after save (L4273-4320) | ❌ N/A | ✅ `verifySavedChapters()` |
| **Quality gate before export** | ❌ N/A | ❌ N/A | ⚠️ `removeForbiddenExportArtifactParagraphs()` | ❌ N/A |

---

## TABLE 4 — Root Cause Ranking

| Rank | Root Cause | Evidence | Confidence | Impact | Minimal Fix |
|------|-----------|----------|-----------|--------|-------------|
| 1 | **No process-leak detection in polish pipeline** | `handleManuscriptPolish()` has no scan for "Action Plan:", "Best Next Move", "Analysis & Strengths", etc. | **CERTAIN** | **CRITICAL** — process-leaked chapters pass through unchanged | Add process-leak scan at start of `handleManuscriptPolish()` |
| 2 | **`cleanNarrativeMetaLeaks()` runs during drafting but doesn't catch all LLM output modes** | Ch.2 got editorial critique through despite `cleanNarrativeMetaLeaks()` being called during `draftChapter()` | **HIGH** | **CRITICAL** — some LLM misfires slip through the draft-time guard | Strengthen `cleanNarrativeMetaLeaks()` with broader canary phrases |
| 3 | **Contamination detector is diagnostic-only and name-only** | `runContaminationDetector()` at anthologyPolishChecks.js L691-762: "Diagnostic-only version. No deletion." | **CERTAIN** | **HIGH** — org/business contamination persists | Add explicit forbidden phrase list + hard removal |
| 4 | **`stripProjectContaminationBlocks()` doesn't catch individual terms** | It only removes entire structural blocks of contamination, not isolated "Unity Media Solutions" references | **HIGH** | **HIGH** — scattered term contamination persists | Add per-term contamination removal |
| 5 | **Banned word removal uses empty-string replacement** | Line 3806: `f.content.replace(rx, '')` — creates gaps but not grammar errors (double spaces cleaned later) | **CERTAIN** | **LOW** — spaces are cleaned by later passes | Consider contextual replacement instead of empty string |
| 6 | **No post-rewrite validation for process leaks** | `draftChapter()` calls `cleanNarrativeMetaLeaks()` + `validateProjectChapterContent()`, but neither hard-rejects editorial-critique-as-prose | **HIGH** | **CRITICAL** — bad LLM output is saved as valid content | Add post-generation process-leak validation with hard reject/retry |
| 7 | **`fixEntireManuscript()` is dead code** | Grep for `fixEntireManuscript` across all src/ returns zero imports/calls | **CERTAIN** | **INFO** — 7,866 lines of unused code with potentially useful safety features | Consider integrating useful parts into active pipeline |

---

## TABLE 5 — Chapter 2 Forensics

### Process Leaks (all 7 survived both rewrite and polish):

| Canary Phrase | Count | Source | Why it survived |
|---------------|-------|--------|----------------|
| "The opening is sharp, highly polished" | 1 | LLM misfire during `draftChapter()` | `cleanNarrativeMetaLeaks()` didn't catch this variant; polish has no detector |
| "Next Move: Commit to the Bargain" | 1 | LLM misfire | Not in any canary list |
| "Action Plan:" | 1 | LLM misfire | Not in any canary list |
| "The current trajectory is working exactly as planned" | 1 | LLM misfire | Not in any canary list |
| "We have established the what and the why" | 1 | LLM misfire | Not in any canary list |
| "We need to move" | 2 | LLM misfire | Not in any canary list |
| "Focus on how" | 1 | LLM misfire | Not in any canary list |

### Contamination (all survived both rewrite and polish):

| Term | Count | Source | Why it survived |
|------|-------|--------|----------------|
| Unity Supported Living Services | 1 | Cross-project contamination in LLM context | Not a character name; contamination detector only checks names |
| Unity Supported Living | 2 | Cross-project contamination | Not a character name |
| Unity Media Solutions | 1 | Cross-project contamination | Not a character name |
| Unity Media | 2 | Cross-project contamination | Not a character name |
| care documentation | 1 | Cross-project contamination | Not checked by any detector |
| compliance documentation | 1 | Cross-project contamination | Not checked by any detector |

### Malformed Grammar (introduced by polish):

| Pattern | In Rewrite? | In Polished? | Introduced by? |
|---------|-------------|-------------|---------------|
| "You was Julian talking" | No | Yes | Unknown — possibly `fixHangingQuotes()` or `runBrokenSentenceFixes()` operating on editorial text |
| "Was was it his fatigue?" | No | Yes | Unknown — possibly `runBrokenSentenceFixes()` doubling "Was" |

---

## TABLE 6 — Draft-Time Safety Analysis

The **draft pipeline** (`draftChapter()`) DOES have process-leak detection:

```
draftChapter() → generateChapterSceneByScene() → cleanSceneOutput()
    → cleanGeneratedProse()      ← basic prose cleaning
    → cleanNarrativeMetaLeaks()  ← PROCESS LEAK DETECTION
    → cleanMechanicalArtifacts() ← artifact cleaning
```

But `cleanNarrativeMetaLeaks()` did NOT catch Chapter 2's editorial critique. This means either:
1. The canary phrase list in `cleanNarrativeMetaLeaks()` doesn't include "The opening is sharp" / "Action Plan:" / "Best Next Move"
2. The function was bypassed for some reason
3. The LLM output for Ch.2 was generated in a mode that bypassed the cleaning step

Let me check `cleanNarrativeMetaLeaks`:

---

## TABLE 7 — Required Fixes (Priority Order)

### P0 — Critical (must fix before next run)

| # | Fix | File | Location | Risk |
|---|-----|------|----------|------|
| 1 | **Add process-leak scan to polish pipeline** | ProjectStudio.jsx | After line 3788 (after contamination trim, before banned word removal) | Low — detection only |
| 2 | **Hard revert chapters that fail process-leak scan** | ProjectStudio.jsx | Same location | Medium — must not false-positive on story content |
| 3 | **Strengthen `cleanNarrativeMetaLeaks()` with broader canaries** | sceneWriter.js | In `cleanSceneOutput()` | Low — additive |
| 4 | **Add post-draft validation that hard-rejects editorial-critique-as-prose** | ProjectStudio.jsx | After `draftChapter()` returns, before save | Medium — needs retry logic |

### P1 — High (fix before production use)

| # | Fix | File | Location | Risk |
|---|-----|------|----------|------|
| 5 | **Add explicit forbidden org/business term list to contamination detector** | anthologyPolishChecks.js | `runContaminationDetector()` line 704+ | Low |
| 6 | **Make contamination detector remove flagged terms, not just report** | anthologyPolishChecks.js | Same function | Medium — must whitelist story-native terms |
| 7 | **Review `fixHangingQuotes()` and `runBrokenSentenceFixes()` for grammar regression on non-prose text** | ProjectStudio.jsx / manuscripts | Steps 5d, 11 | Medium |

### P2 — Nice to have

| # | Fix | File | Location | Risk |
|---|-----|------|----------|------|
| 8 | **Replace banned-word empty-string replacement with contextual alternatives** | ProjectStudio.jsx | Line 3806 | Low |
| 9 | **Clean up or integrate `fixEntireManuscript()` dead code** | manuscriptFixer.js | Entire file | Low |
| 10 | **Add export-time process-leak scan** | ExportTab.jsx | In `applyFinalExportCleanup()` | Low |

---

## TABLE 8 — Do Not Do

| Action | Reason |
|--------|--------|
| ❌ Do not regenerate all 20 chapters | Only Ch.2 has hard process leaks |
| ❌ Do not change the LLM model | The model works fine; Ch.2 was a rare misfire |
| ❌ Do not enable `runLLM: true` in fixEntireManuscript | That function is dead code anyway |
| ❌ Do not broadly refactor manuscriptFixer.js | It's dead code; focus on ProjectStudio.jsx |
| ❌ Do not add another broad polish pass | Fix/polish is not broken — it's missing validators |

---

## Summary

### Why the controlled (smoke test) path worked:
1. Custom external script with purpose-built validators
2. Had process-leak detection with 25+ canary phrases
3. Had contamination guards with explicit forbidden term lists
4. Could reject and regenerate bad chapters
5. Used deterministic regex for slop removal with grammar preservation

### Why the app path failed:
1. **The draft pipeline has `cleanNarrativeMetaLeaks()` but it missed Chapter 2's editorial critique** — the canary list is incomplete
2. **The polish pipeline has NO process-leak detection at all** — it treats editorial text as valid prose
3. **The contamination detector is diagnostic-only and name-only** — org/business terms are invisible
4. **There is no reject/regenerate mechanism in either pipeline** — bad output is saved and polished
5. **`fixEntireManuscript()` has some useful safety features but is DEAD CODE** — never called

### The exact regression test:
1. Load Digital Equity Tribunal
2. Run Draft All / Rewrite All
3. After rewrite completes, check Chapter 2 for process leaks before any polish
4. Run Polish Manuscript
5. Export as DOCX
6. Verify Chapter 2:
   - ❌ "The opening is sharp, highly polished" must NOT be present
   - ❌ "Unity Supported Living" must NOT be present  
   - ❌ "You was" must NOT be present
   - ✅ Chapter must contain valid prose fiction
