# 04 — Live Weak Nonfiction v2 Results

**Pipeline**: ANTI-CHATBOT-RECAST-PIPELINE v5.0  
**Test**: weak-nonfiction-micro-recast-v2  
**Date**: 2026-06-09

---

## Three-Way Comparison

| Metric | A: Original | B: v4 Chunk Pipeline | C: v5 Cleanup + Micro-Recast | Delta (A→C) |
|---|---|---|---|---|
| **Composite Score** | 74 | 74 | **80** | **+6** |
| Grade | GOOD | GOOD | GOOD | — |
| Filter Verbs | 11 | 11 | 9 | −2 |
| Filter Verb Density | 31.8/1K | 31.8/1K | 26.8/1K | −5.0 |
| Essay-Bot Transitions | 6 | 6 | **0** | **−6** |
| Chatbot Patterns | 13 | 13 | 10 | −3 |
| Headings | 3 | 3 | 3 | 0 |
| Citations | 3 | 3 | 3 | 0 |
| Words | 314 | 314 | 298 | −16 (95%) |
| Sentence Length Variance | 9.6 | 9.6 | 9.5 | −0.1 |
| Symmetry Score | 12 | 12 | 6 | −6 (improved) |
| Opening Verb Strength | weak | weak | **strong** | improved |
| Ending Punch | true | true | true | — |
| Concrete Ratio | 100 | 100 | 100 | 0 |

---

## Key Finding: v4 Chunk Pipeline Had Zero Effect

Snapshot B (v4 chunk pipeline) produced **identical results** to Snapshot A (original):

| v4 Report Field | Value |
|---|---|
| Chunks analyzed | 1 |
| Chunks skipped | 1 |
| Chunks recast | 0 |
| Skip reason | `"Protected: citation"` |

The entire text was treated as a single chunk containing citations. The v4 pipeline's citation protection skipped the whole chunk, resulting in zero changes.

> **This confirms the v4 chunk-level approach was too coarse for nonfiction text with citations scattered throughout.** The v5 paragraph-level design was specifically created to solve this problem.

---

## Breakthrough Finding: Deterministic Cleanup Alone Is Sufficient

The v5 deterministic cleanup — with **zero LLM involvement** — raised the composite score from 74 to 80 (+6 points).

| Source of Improvement | Impact |
|---|---|
| 6 essay-bot transitions removed | All eliminated (Moreover ×1, Furthermore ×2, Additionally ×2, "It is important to note" ×1) |
| 2 filter verbs reduced | "It felt like" removed, "appeared to be" → "was" |
| Opening verb strength improved | weak → strong (side effect of removing sentence-initial filler) |
| Symmetry score improved | 12 → 6 (removing repetitive transition patterns reduced structural symmetry) |

**This is a better result than any previous v3/v4 approach**, achieved entirely through regex-based pattern removal.

---

## Acceptance Checks — 9/9 PASS

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | Headings preserved | ✅ PASS | 3→3 |
| 2 | Citations preserved | ✅ PASS | 3→3 |
| 3 | Word count in safe range | ✅ PASS | 95% |
| 4 | Essay-bot transitions decreased | ✅ PASS | 6→0 |
| 5 | Filter verbs decreased or stable | ✅ PASS | 11→9 |
| 6 | Chatbot patterns stable or decreased | ✅ PASS | 13→10 |
| 7 | Composite improved or stable | ✅ PASS | 74→80 |
| 8 | Deterministic cleanup applied | ✅ PASS | `applied=true` |
| 9 | Pipeline version is v5.0 | ✅ PASS | `ANTI-CHATBOT-RECAST-PIPELINE v5.0 — 2026-06-09` |

---

## v4 vs v5 Analysis

| Aspect | v4 Chunk Pipeline | v5 Nonfiction Pipeline |
|---|---|---|
| **Approach** | Chunk-level LLM recast | Deterministic cleanup + paragraph-level micro-recast |
| **Nonfiction handling** | None (same as general prose) | Dedicated nonfiction path with specialized rules |
| **Citation protection** | Block entire chunk | Protect individual citations inline via `isInsideCitation()` |
| **Score improvement** | **+0** (no change) | **+6** (74→80) |
| **Essay-bot removal** | 0 | 6 (all eliminated) |
| **Filter verb reduction** | 0 | 2 |
| **LLM risk** | High (full chunk rewrite) | Low (paragraph-level, gated) |
| **Hallucination risk** | Moderate | Zero for deterministic; gated for micro-recast |
| **Cost** | LLM call per chunk | Zero for deterministic; LLM only for eligible paragraphs |
| **Granularity** | Chunk (entire text) | Paragraph (individual units) |

---

## Diagnostics Comparison

### Before (Snapshot A)

```
- HIGH FILTER VERB DENSITY: 31.8/1K words (10 instances). Replace with direct sensation.
- WEAK OPENING VERB: First sentence uses state verb. Open with action.
```

### After (Snapshot C)

```
- HIGH FILTER VERB DENSITY: 26.8/1K words (8 instances). Replace with direct sensation.
```

The "WEAK OPENING VERB" diagnostic was **resolved**. Filter verb density dropped from 31.8 to 26.8 per 1K words (−5.0), though the diagnostic threshold hasn't been cleared yet (8 remaining instances in valid nonfiction context).

---

## What the Micro-Recast Contributed

In this specific test: **nothing**. Both eligible paragraphs were correctly blocked by the word-ratio validation gate.

However, the micro-recast infrastructure is in place and working correctly:
- Paragraph splitting classified all 8 units correctly
- Eligibility filtering identified the 2 weakest paragraphs (scores 65 and 60)
- The LLM was called and produced output
- The validation gates caught the over-compression and preserved the originals
- The safety architecture performed exactly as designed

The deterministic cleanup was so effective that even without micro-recast, the result exceeded expectations.
