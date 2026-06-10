# 02 — LLM Polisher Design

**Date:** 2026-06-07

---

## Architecture

```
                 handleManuscriptPolish()
                          │
                          ▼
              ┌─ STEP 1: Load chapters ──────┐
              │                               │
              ▼                               │
    STEP 1b: Strip contamination blocks       │
              │                               │
              ▼                               │
    STEP 1c: Pre-polish safety gate           │
              │                               │
         ╔════╧════╗                          │
         ║  PASS?  ║──── NO ── quarantine ────┘
         ╚════╤════╝
              │ YES
              ▼
    STEP 1d: LLM PROSE POLISH  ◄──── NEW
              │
         ╔════╧════╗
         ║  PASS?  ║──── NO ── fallback to deterministic only
         ╚════╤════╝
              │ YES (LLM output replaces chapter content)
              ▼
    STEPS 2–11: Deterministic cleanup
    (banned words, punctuation, quotes,
     capitalization, style tics, etc.)
              │
              ▼
    STEP 12a: Deterministic grammar repair
    STEP 12b: Missing opening quote repair
    STEP 12c: Post-polish quality gate
              │
         ╔════╧════╗
         ║  PASS?  ║──── NO ── block save, report
         ╚════╤════╝
              │ YES
              ▼
    STEP 13: Save
              │
              ▼
    Export safety gate (at export time)
```

---

## Module: `src/lib/llmProsePolisher.js`

### Exports

| Export | Type | Purpose |
|--------|------|---------|
| `polishChapterWithLLM(params)` | async function | Main entry: calls LLM, validates, returns result |
| `validatePolisherOutput(output, original, title)` | function | Guardrail validation (sync) |
| `PROSE_POLISHER_SYSTEM_PROMPT` | string | System prompt for the prose polisher |

### `polishChapterWithLLM` Parameters

```javascript
{
  chapterText: string,      // Required: raw chapter text
  chapterTitle: string,     // Chapter title for context
  chapterNumber: number,    // Chapter number for logging
  projectContext: string,   // Brief project description
  project: object,          // Full project object (model routing)
  timeoutMs: number,        // Timeout in ms (default: 600000 = 10 min)
  callLLM: function,        // Override for testing (injects mock LLM)
}
```

### Return Value

```javascript
{
  ok: boolean,              // true if LLM output passed all guardrails
  text: string,             // Polished text (or original if failed)
  raw: string,              // Raw LLM output before cleanup
  wordDelta: number,        // Word count change (negative = shorter)
  warnings: string[],       // Soft warnings (e.g., "The air" opening)
  error: string | null,     // Error message if failed, null if ok
}
```

---

## Model Configuration

| Setting | Value | Source |
|---------|-------|--------|
| Agent slot | `polisher` | `localLLM.js:100` |
| Model name | `prose-polisher` | `AGENT_MODELS.polisher` |
| Temperature | 0.3 | `AGENT_TEMPERATURES.polisher` |
| Max tokens | `max(8192, ceil(chapterLength / 3))` | Dynamic |
| Timeout | 10 minutes | `timeoutMs` parameter |
| Retries | 3 (via `callAgent`) | `integrationRetry.js` |

The module uses a **lazy import** for `callAgent` to allow Node.js tests to load the module without Vite's `@/` alias resolution. The actual Ollama call only happens at runtime when no `callLLM` override is provided.

---

## Guardrails

### Hard Fail (output rejected, original preserved)

| Check | Threshold | Behavior |
|-------|-----------|----------|
| Empty output | < 50 chars | Reject |
| Process leakage | 18 patterns (Action Plan, Here is the revised, As an AI, etc.) | Reject |
| Contamination | 4 patterns (Unity Supported Living, care documentation, etc.) | Reject |
| Analysis format | Output starts with #, **, -, *, or numbered list | Reject |
| Too short | < 70% of original word count | Reject |
| Too long | > 115% of original word count | Reject |

### Soft Warning (output accepted with warnings)

| Check | Threshold | Behavior |
|-------|-----------|----------|
| Moderate cut | < 88% of original word count | Warning |
| "The air" opener | Chapter starts with "The air…" | Warning |
| Missing title | Title not in first 500 chars | Warning |

---

## System Prompt

The system prompt instructs the LLM to:
- Preserve plot, characters, settings, chapter title, ending function
- Not add scenes, characters, or lore
- Not summarize or explain edits
- Return only polished prose
- Improve rhythm, clarity, dialogue, readability
- Remove AI cadence and slop phrases
- Recast naturally (don't mechanically delete)
- Cut 5–12% only if bloated
- Not make prose more ornate or generic
- Not use "The air…" as chapter opener
- Not introduce process language
