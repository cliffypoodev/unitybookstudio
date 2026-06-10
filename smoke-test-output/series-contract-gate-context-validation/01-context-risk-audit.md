# 01 — Context Risk Audit

## Overview

This audit examines the Series Contract Gate (`seriesContractGate.js`) for false-positive risk — cases where the gate would incorrectly BLOCK legitimate narrative uses of dead characters, resolved threads, or world rules.

## Audit Date
2026-06-09

## Gate Architecture

The gate uses a paragraph-level context detection system:

1. **Text is split into paragraphs** (double-newline delimited)
2. **Each paragraph is checked for context markers** — if ANY marker is present, the paragraph is treated as non-active regardless of verbs/dialogue
3. **Only unframed paragraphs** with active verbs or dialogue trigger BLOCK
4. **Resolved thread detection** uses phrase-matching with reflective context exemption
5. **World rule detection** produces WARNING only (never BLOCK)

## Detector Behavior Matrix

| Detector | Severity | Current Behavior | False Positive Risk | Recommendation |
|---|---|---|---|---|
| Dead Character Resurrection | BLOCK | Context-first: checks 100+ context markers before classifying a paragraph as "active". Skips paragraphs with flashback, dream, letter, hallucination, memorial, historical markers. | **LOW** (after fix) | ✅ No change needed |
| Resolved Thread Reopened | BLOCK | Requires ≥2 consecutive-word phrase matches + conflict markers in matching paragraphs + no reflective context. | **LOW** — conservative phrase matching prevents false positives. Rephrased references won't trigger. | ✅ Acceptable. Document that LLM-based detection would catch more true positives. |
| Resolved Thread Referenced | WARNING | Same phrase matching, but without conflict markers. | **LOW** | ✅ WARNING is appropriate |
| World Rule Contradiction | WARNING | Extracts forbidden phrases from "cannot/impossible/never" rules. Checks if forbidden phrase appears in text. | **MEDIUM** — character dialogue, rumor, and metaphorical uses may trigger WARNING. | ⚠️ WARNING is correct severity. Could add paragraph-level context exemption in future. |
| Character Status Contradiction | BLOCK | Uses `nameAppearsAsActive` (context-aware). | **LOW** (after fix) | ✅ No change needed |
| Entry Contract: Required Alive | BLOCK | Checks for death phrases. | **LOW** — only triggers on explicit death language. | ✅ No change needed |
| Entry Contract: Required Dead | BLOCK | Uses `nameAppearsAsActive` (context-aware). | **LOW** (after fix) | ✅ No change needed |
| Exit Contract: Must Alive | BLOCK | Checks for death phrases in final chapter/export. | **LOW** | ✅ No change needed |
| Exit Contract: Must Dead | BLOCK | Checks for active appearance without death references. | **LOW** | ✅ No change needed |
| Series Voice Drift | WARNING | POV pronoun ratios, tense markers. | **LOW** — high thresholds (3x ratio) prevent false triggers. | ✅ No change needed |
| Series Tone Drift | WARNING | Comedy marker count in dark-toned series. | **LOW** — threshold of 5 is reasonable. | ✅ No change needed |

## Key Fix Applied

### Before (BROKEN)
```
if (isMemoryContext && !hasDialogue && !hasActiveVerb) → safe
else → BLOCK
```

**Problem:** Any flashback with active verbs ("Three years earlier, Elias walked...") was falsely classified as active.

### After (FIXED)
```
if (hasContextMarker) → safe (skip entire paragraph)
else → check for active verbs/dialogue → BLOCK only if present
```

**Result:** Context markers are authoritative. A paragraph with ANY context marker is treated as non-active regardless of verbs or dialogue.

## Context Marker Coverage (100+ markers)

| Category | Examples | Count |
|---|---|---|
| Memory / Remembrance | remembered, recalled, reminisced | 9 |
| Flashback / Past-tense | years earlier, long ago, back then, had once | 22 |
| Dream / Vision | dream, nightmare, vision, appeared to | 11 |
| Hallucination / Imagination | hallucination, thought she saw, phantom | 11 |
| Ghost / Supernatural | ghost of, spirit of, haunted by | 6 |
| Letters / Documents | letter, police report, journal, diary | 17 |
| Quoted Speech / Secondhand | according to, legend has, rumor | 10 |
| Death / Memorial | in memory of, funeral, tombstone, eulogy | 14 |
| Photos / Art | photograph of, portrait of, painting of | 7 |
| Historical / Expository | history, chronicle, before his death | 10 |

## Resolved Thread Detection Fix

### Before
- Searched ENTIRE text for conflict markers like `'still '` and `'returns'`
- These match normal prose constantly → false positive risk

### After
- Searches only **paragraphs that contain thread phrases** for conflict markers
- Removed overly broad markers (`'still '`, `'returns'`)
- Added **reflective context markers** that prevent BLOCK when thread is referenced historically
- Added retcon-specific markers (`'the real culprit'`, `'we were wrong'`)

## Known Limitation

The resolved thread detector uses consecutive-word phrase matching, which means rephrased references to resolved threads won't trigger detection. This is by design — a text-based heuristic that avoids false positives. An LLM-based semantic comparison could catch more true positives in a future enhancement.

## Verdict

**All detectors are safe for production.** The context-first approach in `nameAppearsAsActive` eliminates the false-positive vectors. World rule detection remains WARNING-only, which is the correct severity for text-pattern matching without semantic understanding.
