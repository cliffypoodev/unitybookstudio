# 03 — Micro-Recast Implementation Report

**Pipeline**: ANTI-CHATBOT-RECAST-PIPELINE v5.0  
**Date**: 2026-06-09

---

## Pipeline Architecture

The micro-recast is the second subsystem in the nonfiction cleanup pipeline. It runs **after** deterministic cleanup and targets individual weak paragraphs with LLM-based rewriting.

```
Deterministic-Cleaned Text
    │
    ▼
splitNonfictionIntoMicroRecastUnits
    │  Classifies each paragraph as heading / bibliography /
    │  list / citation_heavy / short / eligible
    ▼
shouldMicroRecastNonfictionUnit (per unit)
    │  Protected? → skip
    │  Score >= threshold? → skip
    │  Score < threshold? → eligible
    ▼
buildNonfictionMicroRecastPrompt
    │  Strict nonfiction prompt with word count bounds
    ▼
LLM Call (callLLMForModel → prose-recast-polisher, temp 0.4)
    │
    ▼
Per-Paragraph Validation (5 gates)
    │  ├── Gate 1: Word ratio (92–115%)
    │  ├── Gate 2: Citation preservation
    │  ├── Gate 3: Quality (score non-regression)
    │  ├── Gate 4: Chatbot pattern check
    │  └── Gate 5: Global structure validation
    │
    ▼
    Pass? → Accept recast
    Fail? → Preserve original paragraph
```

---

## Paragraph Splitting

`splitNonfictionIntoMicroRecastUnits` classifies each paragraph by type:

| Type | Detection Rule | Protected | Action |
|---|---|---|---|
| `heading` | Markdown `#` or ALL-CAPS < 80 chars | ✅ Yes | Always skipped |
| `bibliography` | Matches "References" / "Bibliography" / "Works Cited" / etc. | ✅ Yes | Always skipped |
| `list` | >50% of lines start with `- * • ` or `N.` | ✅ Yes | Always skipped |
| `citation_heavy` | >2 citations in a single paragraph | ✅ Yes | Always skipped |
| `short` | < 30 words (default `minUnitWords`) | ✅ Yes | Always skipped |
| `eligible` | Normal prose paragraph ≥ 30 words | ❌ No | Candidate for recast |

---

## Live Test Results

### Unit-by-Unit Breakdown

| Unit | Index | Type | Words | Score | Action | Reason |
|---|---|---|---|---|---|---|
| 1 | 0 | heading | 8 | — | skipped | Protected: heading |
| 2 | 1 | eligible | 69 | 77 | skipped | Score 77 ≥ threshold 75 |
| 3 | 2 | eligible | 51 | 91 | skipped | Score 91 ≥ threshold 75 |
| 4 | 3 | heading | 7 | — | skipped | Protected: heading |
| 5 | 4 | eligible | 69 | 65 | **failed** | word_ratio: 90% (62/69 words) |
| 6 | 5 | heading | 5 | — | skipped | Protected: heading |
| 7 | 6 | eligible | 48 | 60 | **failed** | word_ratio: 83% (40/48 words) |
| 8 | 7 | eligible | 41 | 76 | skipped | Score 76 ≥ threshold 75 |

### Summary Counts

| Metric | Count |
|---|---|
| Units analyzed | 8 |
| Eligible for recast | 2 |
| Recast successfully | **0** |
| Failed validation | 2 |
| Skipped (above threshold) | 3 |
| Protected (headings) | 3 |

---

## Per-Paragraph Validation Gates

Every LLM rewrite must pass **all five gates** to be accepted. If any gate fails, the original paragraph is preserved.

### Gate 1: Word Ratio (92–115%)

```javascript
const ratio = recastWords / origWords;
if (ratio < 0.92 || ratio > 1.15) {
  // REJECT — preserve original
}
```

Ensures the LLM doesn't over-compress (summarize) or over-expand (pad). Both failures in this test were caught here.

### Gate 2: Citation Preservation

```javascript
const origCit = (unit.text.match(/\([^)]*\d{4}[^)]*\)/g) || []).length;
const recastCit = (recastText.match(/\([^)]*\d{4}[^)]*\)/g) || []).length;
if (recastCit < origCit) {
  // REJECT — citation loss
}
```

### Gate 3: Quality (Score Non-Regression)

```javascript
if (afterScore < beforeScore) {
  // REJECT — score regression
}
```

### Gate 4: Chatbot Pattern Check

```javascript
if (afterPat.total > beforePat.total + 2) {
  // REJECT — chatbot language increase
}
```

### Gate 5: Global Structure Validation

```javascript
const structure = preserveNonfictionStructure(text, resultText);
if (!structure.ok) {
  // ABORT entire pipeline — return original text
}
```

Runs after all paragraphs are reassembled. Checks that heading and citation counts haven't decreased across the full text.

---

## Failure Analysis

### Unit 5 (Index 4) — Score 65

| Metric | Value |
|---|---|
| Original words | 69 |
| Recast words | 62 |
| Word ratio | **90%** |
| Gate threshold | ≥ 92% |
| Result | ❌ **REJECTED** |

The LLM removed 7 words (10% compression). The prompt specified a minimum of `floor(69 × 0.95) = 65` words, but the model returned 62.

### Unit 7 (Index 6) — Score 60

| Metric | Value |
|---|---|
| Original words | 48 |
| Recast words | 40 |
| Word ratio | **83%** |
| Gate threshold | ≥ 92% |
| Result | ❌ **REJECTED** |

The LLM removed 8 words (17% compression). The prompt specified a minimum of `floor(48 × 0.95) = 45` words, but the model returned 40.

### Root Cause

The `prose-recast-polisher` model at temperature 0.4 over-compresses when rewriting nonfiction paragraphs. Despite explicit word-count instructions in the prompt, the model consistently produces shorter output than requested.

---

## Prompt Template

`buildNonfictionMicroRecastPrompt` generates a strict prompt:

```
Revise this single paragraph only.
The original is {origWords} words. Your revision MUST be between {minWords} and {maxWords} words.

MANDATORY RULES:
- Do not summarize.
- Preserve every claim, example, and data point.
- [If citations present] Preserve citations EXACTLY as written.
- Keep within 95–115% of original word count.
- Improve clarity and authority.
- Remove essay-bot phrasing ("Moreover", "Furthermore", etc.).
- Prefer precise verbs over filter verbs ("felt", "seemed", etc.).
- Do not add literary imagery, sensory details, or scene dramatization.
- Do not add unsupported facts, examples, or statistics.
- Do not add emotional language or narrative urgency.
- Return ONLY the revised paragraph — no explanation, no notes, no preamble.

PARAGRAPH:
{unit.text}
```

Word count bounds: `minWords = floor(origWords × 0.95)`, `maxWords = ceil(origWords × 1.15)`

---

## Impact Assessment

| Metric | Value |
|---|---|
| Micro-recast benefit in this test | **Zero** |
| Paragraphs improved by micro-recast | 0 / 2 eligible |
| Paragraphs correctly blocked | 2 / 2 |
| Safety architecture | **Working correctly** |

The word-count compression gate is doing its job: it's better to block a bad recast than accept a truncated paragraph.

---

## Future Improvements

| Approach | Trade-off |
|---|---|
| Add explicit word budget to prompt (e.g., "You MUST write at least 66 words") | May improve compliance but some models ignore counts |
| Use a different model for nonfiction micro-recast | Could improve instruction-following but adds routing complexity |
| Add few-shot examples demonstrating correct length preservation | Increases prompt size but may anchor the model |
| Increase gate tolerance to 88–120% | Accepts more rewrites but risks truncated paragraphs |
| Two-pass approach: first draft, then length check + expansion prompt | Higher latency, double LLM cost |

> **Current recommendation**: The deterministic cleanup alone achieves +6 composite improvement. The micro-recast is a nice-to-have, not a requirement. Ship deterministic cleanup; iterate on micro-recast prompt/model separately.
