# 05 — Structure & Citation Preservation Report

**Pipeline**: ANTI-CHATBOT-RECAST-PIPELINE v5.0  
**Date**: 2026-06-09

---

## Overview

Structure preservation is the **highest priority safety constraint** in the nonfiction cleanup pipeline. The pipeline MUST preserve:
- ✅ Headings
- ✅ Citations
- ✅ Bibliography sections
- ✅ List items
- ✅ Word count within safe range

All constraints were satisfied in this test.

---

## Heading Preservation

| Metric | Value |
|---|---|
| Original headings | 3 |
| After cleanup headings | 3 |
| Result | ✅ **PRESERVED** |

### Protection Layers

Headings are protected at **two independent levels**:

**Layer 1 — Deterministic Cleanup**
- `strengthenNonfictionParagraphOpenings` skips any paragraph starting with `#`
- Also skips paragraphs < 20 words (which captures most heading-length text)

**Layer 2 — Micro-Recast**
- `splitNonfictionIntoMicroRecastUnits` classifies headings as `type='heading'` with `protected=true`
- Detection rule: markdown `#` prefix **or** ALL-CAPS text < 80 characters
- Protected units are never sent to the LLM

### Heading Units in This Test

| Unit Index | Words | Action |
|---|---|---|
| 0 | 8 | skipped — Protected: heading |
| 3 | 7 | skipped — Protected: heading |
| 5 | 5 | skipped — Protected: heading |

All three headings were correctly classified and skipped.

---

## Citation Preservation

| Metric | Value |
|---|---|
| Original citations | 3 |
| After cleanup citations | 3 |
| Result | ✅ **PRESERVED** |

### Protection Layers

Citations are protected at **three independent levels**:

**Layer 1 — Deterministic Cleanup (inline protection)**

```javascript
function isInsideCitation(text, matchIndex) {
  const citPatterns = [
    /\([^)]*\d{4}[^)]*\)/g,   // (Author, 2024)
    /\[\d+\]/g,                 // [1]
  ];
  for (const re of citPatterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      if (matchIndex >= m.index && matchIndex < m.index + m[0].length) {
        return true;  // Match is inside a citation — do not modify
      }
    }
  }
  return false;
}
```

Every regex replacement in `reduceEssayBotTransitions`, `reduceNonfictionFilterVerbs`, and `reduceNotJustConstructions` calls `isInsideCitation()` before modifying text. If the match position falls inside a citation span, the replacement is skipped.

**Layer 2 — Micro-Recast Splitting (paragraph protection)**
- Paragraphs with >2 citations are classified as `type='citation_heavy'` with `protected=true`
- These paragraphs are never sent to the LLM

**Layer 3 — Micro-Recast Validation (per-paragraph gate)**

```javascript
const origCit = (unit.text.match(/\([^)]*\d{4}[^)]*\)/g) || []).length;
const recastCit = (recastText.match(/\([^)]*\d{4}[^)]*\)/g) || []).length;
if (recastCit < origCit) {
  // REJECT — citation loss detected
}
```

If the LLM produces output with fewer citations than the original, the recast is rejected and the original paragraph is preserved.

### Citation Detection Patterns

| Pattern | Matches | Example |
|---|---|---|
| `/\([^)]*\d{4}[^)]*\)/g` | Parenthetical year citations | `(Smith, 2024)`, `(Johnson & Lee, 2023)` |
| `/\[\d+\]/g` | Numbered references | `[1]`, `[42]` |

---

## Bibliography Protection

| Metric | Value |
|---|---|
| Bibliography sections detected | ✅ Checked |
| Bibliography sections modified | ✅ None |

### Detection

```javascript
function isBibliographySection(text) {
  return /^(?:references|bibliography|works?\s+cited|sources|endnotes|footnotes)\s*$/im
    .test(text.trim());
}
```

Matches:
- References
- Bibliography
- Works Cited / Work Cited
- Sources
- Endnotes
- Footnotes

### Protection

- **Deterministic cleanup**: `reduceEssayBotTransitions` and `reduceNonfictionFilterVerbs` both call `isBibliographySection()` at the start of paragraph processing and skip bibliography paragraphs entirely.
- **Micro-recast**: `splitNonfictionIntoMicroRecastUnits` classifies bibliography paragraphs as `type='bibliography'` with `protected=true`.

---

## List Protection

| Metric | Value |
|---|---|
| List items modified | ✅ None |

### Detection

```javascript
// In splitNonfictionIntoMicroRecastUnits:
if (/^(?:\s*[-*•]\s|\s*\d+\.\s)/m.test(para)) {
  const lines = para.split('\n').filter(l => l.trim());
  const listLines = lines.filter(l => /^\s*(?:[-*•]\s|\d+\.\s)/.test(l));
  if (listLines.length > lines.length * 0.5) {
    type = 'list';
    isProtected = true;
  }
}
```

A paragraph is classified as a list if >50% of its non-empty lines begin with `-`, `*`, `•`, or a numbered pattern (`1.`). List paragraphs are marked `protected=true` and never sent to the LLM.

The deterministic cleanup's regex patterns only match sentence-initial transitions (e.g., "Moreover, ") which would not appear as list item content.

---

## Word Ratio Analysis

| Metric | Value |
|---|---|
| Original words | 314 |
| After cleanup words | 298 |
| Word ratio | **95%** |
| Safe range | 85–115% |
| Result | ✅ **IN SAFE RANGE** |

### Word Reduction Breakdown

| Source | Words Removed | Pattern |
|---|---|---|
| "Moreover, " | ~1 | Essay-bot transition |
| "Furthermore, " × 2 | ~2 | Essay-bot transition |
| "Additionally, " × 2 | ~2 | Essay-bot transition |
| "It is important to note that " | ~6 | Essay-bot transition |
| "It felt like " | ~3 | Filter verb pattern |
| "appeared to be" → "was" | ~2 | Filter verb simplification |
| **Total** | **~16** | **5.1% reduction** |

> **No content was lost.** Only transitional filler and hedging language was removed. Every claim, example, and data point in the original text remains in the cleaned version.

---

## Global Structure Validation

`preserveNonfictionStructure` runs as a final safety net after all changes:

```javascript
export function preserveNonfictionStructure(original, revised) {
  const origH = detectMarkdownHeadings(original) + detectSectionHeadings(original);
  const revH = detectMarkdownHeadings(revised) + detectSectionHeadings(revised);

  const origC = (original.match(/\([^)]*\d{4}[^)]*\)/g) || []).length;
  const revC = (revised.match(/\([^)]*\d{4}[^)]*\)/g) || []).length;

  const ok = (revH >= origH) && (revC >= origC);
  // If !ok → abort pipeline, return original unchanged
}
```

This validation runs at **two points**:
1. After deterministic cleanup (in `runNonfictionDeterministicCleanup`) — **PASSED** ✅
2. After micro-recast reassembly (in `runNonfictionMicroRecastPipeline`) — **PASSED** ✅

---

## Per-Unit Structure Summary

| Unit Index | Type | Words | Protected | Action | Structure Impact |
|---|---|---|---|---|---|
| 0 | heading | 8 | ✅ | skipped | None — preserved |
| 1 | eligible | 69 | ❌ | skipped (score 77) | None — unchanged |
| 2 | eligible | 51 | ❌ | skipped (score 91) | None — unchanged |
| 3 | heading | 7 | ✅ | skipped | None — preserved |
| 4 | eligible | 69 | ❌ | failed (word ratio) | None — original preserved |
| 5 | heading | 5 | ✅ | skipped | None — preserved |
| 6 | eligible | 48 | ❌ | failed (word ratio) | None — original preserved |
| 7 | eligible | 41 | ❌ | skipped (score 76) | None — unchanged |

**All 8 units** either retained their original text or were never modified. Zero structural damage.
