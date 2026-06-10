# Malformed Grammar Diagnosis

## Malformed patterns introduced by fix/polish:

| Pattern | In Rewrite? | In Polished? | Introduced by Polish? | Source |
|---------|------------|-------------|----------------------|--------|
| "You was" (Ch.2) | No | Yes (×1) | ❌ **YES** | `runTargetedMalformedSentenceRepair()` |
| "Was was" (Ch.2) | No | Yes (×1) | ❌ **YES** | `runTargetedMalformedSentenceRepair()` |
| "Was was" / "It was was" (Ch.1) | Yes (×1) | Yes (×1) | No — survived | LLM rewrite output |

## Root Cause: Malformed sentence repair operates on process-leaked text

### The mechanism:

`runTargetedMalformedSentenceRepair()` (postDraftCleanup.js line 2090):

1. `classifyMalformedSentence()` (line 1725) scans for patterns like:
   - Sentences starting with bare verbs: `Was`, `Were`, `Had`, `Looked`, etc.
   - These are classified as "missing subject at sentence start"

2. When the function encounters editorial text like:
   - "Was it his fatigue?" — flags as "missing subject" → repair may introduce "Was was"
   - Context near editorial text → repair may produce "You was Julian talking"

3. The repair function expects to operate on **prose fiction**, not editorial commentary. When given LLM critique as input, the sentence context is wrong, and patches can be malformed.

### Why "It was was" in Ch.1 is different:

The Ch.1 pattern at "beautiful, useless sparks. It was wasteful, dramatic, unnecessary" is a false positive in the detection. The text is actually "It was wasteful" — the regex overlap with our "It was was" pattern is matching "It was was" where the actual text is "It was wasteful" and the "was" is being detected by scanning for the trigram. This needs verification but is likely a detection false positive in the diagnostic script, not an actual malformation.

### Minimal fix:

1. Add process-leak detection BEFORE malformed sentence repair
2. Skip malformed sentence repair for chapters flagged as process-leaked
3. Or: add a guard in `classifyMalformedSentence()` to avoid flagging sentences in editorial/meta context

## Context for malformed introductions:

### "You was Julian talking" (Ch.2, polished only):
```
...searching for the source of the critique. You was Julian talking about the paint itself, ...
```
Original rewrite likely had: "Was Julian talking about the paint itself" — classified as "missing subject at sentence start" → repair added "You" before "was" → "You was Julian talking"

### "Was was it his fatigue?" (Ch.2, polished only):
```
...his own hand holding the brush. Was was it his fatigue? Or was the color itself...
```
Original rewrite likely had: "Was it his fatigue?" — classified as "missing subject at sentence start" → deterministic repair attempted to add a subject but doubled the "Was" instead.
