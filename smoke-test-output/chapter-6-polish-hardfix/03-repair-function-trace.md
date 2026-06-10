# 03 — Repair Function Trace

**Date:** 2026-06-07

---

## runDeterministicGrammarRepair() Trace

**Source:** [prosePolishQualityGate.js](file:///Users/cliff/Downloads/UBS/src/lib/prosePolishQualityGate.js#L228)

### Available Repair Rules

| Rule ID | Regex | Replacement | Status |
|---------|-------|-------------|--------|
| she-were | `/\bShe were\b/gi` | She was (subjunctive-aware) | ✅ Works |
| he-were | `/\bHe were\b/gi` | He was (subjunctive-aware) | ✅ Works |
| they-was | `/\bThey was\b/gi` | They were | ✅ Available |
| was-was | `/\bWas was\b/gi` | Was | ✅ Available |
| a-obvious | `/\ba obvious\b/gi` | an obvious | ✅ Works |
| were-was | `/\bwere was\b/gi` | was | ✅ Available |
| was-were | `/\bwas were\b/gi` | were | ✅ Available |

### Patterns DETECTED but NOT Repaired

| Pattern | Detection Regex | In Repair Rules? | Why |
|---------|----------------|-------------------|-----|
| aether-were | `/\bAether were\b/gi` | ❌ No | Ambiguous — could be sci-fi proper noun |
| were-those-just | `/\b(?:She\|He) were those just\b/gi` | ❌ No | After she-were repair, becomes "She was those just" — still awkward but not detectable by this pattern |
| she-was-it | `/\bShe was it\b/gi` | ❌ No | Ambiguous — could be "Was it monopolistic?" |
| he-was-it | `/\bHe was it\b/gi` | ❌ No | Ambiguous |

### Chapter 6 Repair Execution

Input text: 1368 chars, 221 words

| Step | Input Contains | Repair Applied | Output Contains |
|------|---------------|----------------|-----------------|
| 1 | "She were carrying" | she-were → "She was" | "She was carrying" ✅ |
| 2 | "She were those just" | she-were → "She was" | "She was those just" ✅ (she-were fixed) |
| 3 | "a obvious thing" | a-obvious → "an obvious" | "an obvious thing" ✅ |
| 4 | "Aether were they" | — (no rule) | "Aether were they" ❌ (still present) |

Repairs made: 3
Repairs missed: 1 (Aether were — ambiguous)

---

## runProsePolishQualityGate() Behavior

**Source:** [prosePolishQualityGate.js](file:///Users/cliff/Downloads/UBS/src/lib/prosePolishQualityGate.js#L196)

### Decision Logic

```javascript
if (malformed.count > 0) {
  recommendedAction = 'BLOCK_POLISH_SAVE';          // ANY malformed → block
} else if (quoteIssues.count > 3) {
  recommendedAction = 'BLOCK_POLISH_SAVE';          // >3 quotes → block
} else if (quoteIssues.count > 0) {
  recommendedAction = 'MANUAL_REVIEW';
} else if (slopCounts.total > 50) {
  recommendedAction = 'MANUAL_REVIEW';
}
```

### Chapter 6 Results

| Stage | malformed | quotes | slop | Action | ok |
|-------|-----------|--------|------|--------|-----|
| Pre-repair | 5 | 0 | 15 | BLOCK_POLISH_SAVE | false |
| Post-repair | 1 | 0 | 15 | BLOCK_POLISH_SAVE | false |

The gate blocks on ANY malformed > 0. Even after fixing 4 out of 5 issues, the remaining 1 causes BLOCK.

---

## Save Loop Enforcement (Before Fix)

**Source:** [ProjectStudio.jsx](file:///Users/cliff/Downloads/UBS/src/pages/ProjectStudio.jsx#L4584)

The Milestone 7 code:
```javascript
if (blockedChapterNums.has(chNum)) {
  f.content = f.original; // revert ALL repairs
}
```

This was too aggressive. It treated BLOCK_POLISH_SAVE as "discard everything and revert to original."

---

## The Catch-22

1. Grammar repair fixes 3/4 auto-repairable issues ✅
2. 1 ambiguous issue remains (Aether were) ❌
3. Quality gate: malformed > 0 → BLOCK_POLISH_SAVE
4. Save loop: BLOCK → revert to original
5. Original has ALL 5 issues
6. Export blocks with 5 malformed

The repair was working. The save loop was discarding the results.
