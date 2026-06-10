# 03 — Unified Pipeline Design

**Date:** 2026-06-10  
**File:** `src/lib/unifiedProseRefinement.js`  
**Purpose:** Central deterministic prose refinement orchestrator

---

## Function Signature

```js
export function runUnifiedProseRefinement({
  text,           // string — the chapter text to refine
  chapter,        // object — { chapter_number, title } metadata
  project,        // object — { book_type, genre, subgenre } metadata
  mode,           // 'standard' | 'surface-only' | 'detect-only'
  allowLLM,       // boolean — reserved for future use (always false in v1)
  intensity,      // 'standard' | 'aggressive' — reserved for future use
})
```

## Return Shape

```js
{
  text,            // string — the refined text (or original if detect-only)
  changed,         // boolean — true if text was modified
  blocked,         // boolean — true if quality gate says BLOCK
  warnings,        // string[] — non-blocking issues
  repairs,         // { phase, original, replacement, rule }[] — all changes made
  qualityReport,   // object — from runProsePolishQualityGate
  beforeMetrics,   // { wordCount, slopTotal, malformedCount, dialogueIssueCount }
  afterMetrics,    // same shape, computed on output text
}
```

---

## Pipeline Phases

```
┌──────────────────────────────────────────────────────────────────┐
│  Phase 1: Normalize Formatting Artifacts                        │
│  ├── e.g./i.e. spacing                                          │
│  ├── Brand capitalization (YouTube, LinkedIn, etc.)              │
│  ├── Spaced quoted terms                                        │
│  ├── Source marker removal ([TK], [SOURCE NEEDED])              │
│  └── Markdown residue cleanup                                   │
├──────────────────────────────────────────────────────────────────┤
│  Phase 2: Repair Hard Mechanical Defects                        │
│  └── runDeterministicGrammarRepair() from prosePolishQualityGate│
├──────────────────────────────────────────────────────────────────┤
│  Phase 3: Repair Punctuation/Spacing                            │
│  ├── Double commas, periods, spaces                             │
│  ├── Duplicate articles (the the, a a)                          │
│  └── Space-before-punctuation                                   │
├──────────────────────────────────────────────────────────────────┤
│  Phase 4: Repair Dialogue Mechanics                             │
│  ├── runDialogueMechanicsPass()                                 │
│  └── repairSafeMidParagraphDialogueOpeners()                    │
├──────────────────────────────────────────────────────────────────┤
│  Phase 5: Reduce AI-Slop (standard mode only)                   │
│  └── runAISlopReductionPass()                                   │
├──────────────────────────────────────────────────────────────────┤
│  Phase 6: Sentence-Level Recasts (standard mode only)           │
│  └── applyLLMSentenceRecasts() — deterministic despite name     │
├──────────────────────────────────────────────────────────────────┤
│  Phase 7: Essay-vs-Scene Balance Detection (report only)        │
│  └── detectEssayImbalance() — NEW, warns only, never rewrites   │
├──────────────────────────────────────────────────────────────────┤
│  Phase 8: Final Quality Gate                                    │
│  └── runProsePolishQualityGate()                                │
├──────────────────────────────────────────────────────────────────┤
│  Phase 9: Compute Metrics and Return                            │
│  └── before/after wordCount, slopTotal, malformedCount          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Mode Behavior

| Mode | Phases 1-4 | Phase 5-6 | Phase 7-9 |
|------|-----------|-----------|-----------|
| `standard` | ✅ Run + mutate | ✅ Run + mutate | ✅ Report |
| `surface-only` | ✅ Run + mutate | ❌ Skip | ✅ Report |
| `detect-only` | ❌ No mutation | ❌ No mutation | ✅ Report only |

### Mode Usage
- **Manual Polish UI** → `mode: 'standard'`
- **Export preflight** → `mode: 'surface-only'` (deterministic surface cleanup only)
- **Diagnostic scan** → `mode: 'detect-only'` (report without changing text)

---

## Genre-Aware Behavior

The `project` parameter controls essay-vs-scene thresholds:

| Genre | Essay Phrase Threshold | Scene Action Threshold | Notes |
|-------|----------------------|----------------------|-------|
| Fiction | Strict (3/chapter) | Strict (must have dialogue) | Full cleanup |
| Nonfiction | Relaxed (10/chapter) | Not required | Preserve citations |
| Training | Disabled | Disabled | Preserve structure |
| Memoir | Standard | Standard | Preserve first-person |

---

## What This Module Does NOT Do

1. **Does NOT call an LLM** — fully deterministic
2. **Does NOT remove safety gates** — additive only
3. **Does NOT bypass export safety** — export still runs its own gate
4. **Does NOT rewrite full chapters** — targeted repairs only
5. **Does NOT touch series logic** — no series contract gate
6. **Does NOT modify prompts** — no prompt engineering
7. **Does NOT save to DB** — returns text, caller decides what to save

---

## Integration Points

### Manual Prose Polisher (ProjectStudio.jsx)
```
Before: Calls 10+ modules individually in ad-hoc order
After:  Can call runUnifiedProseRefinement() for the deterministic subset,
        then optionally polishChapterWithLLM() for LLM pass
```

### Export Preflight (ExportTab.jsx)  
```
Before: Only runs dialogue repair + safety gate
After:  Can call runUnifiedProseRefinement({ mode: 'surface-only' })
        for safe deterministic surface cleanup before safety gate
```

### Post-Draft (if applicable)
```
Not wired in v1. Draft path has its own cleanup. Future consideration.
```

---

## Dependencies (imports)

```
./prosePolishQualityGate.js  → runDeterministicGrammarRepair, runProsePolishQualityGate
./dialogueMechanicsRepair.js → runDialogueMechanicsPass, repairSafeMidParagraphDialogueOpeners
./aiSlopReduction.js         → runAISlopReductionPass, countAISlopPatterns
./llmSentenceRecast.js       → applyLLMSentenceRecasts
```

All imports are relative (no `@/` aliases) to allow Node.js test execution without Vite.
