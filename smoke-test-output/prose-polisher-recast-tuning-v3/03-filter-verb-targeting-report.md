# Filter Verb Targeting Report

> **Date:** 2026-06-09
> **Component:** `FILTER_VERB_TARGETING_BLOCK` — v3
> **Classification:** Feature Results

---

## Overview

Filter verbs (`felt`, `seemed`, `noticed`, etc.) are the single most common prose quality signal in the scoring pipeline. They indicate "telling" rather than "showing" — the narrator reporting their experience instead of rendering it directly for the reader.

v3 introduced the `FILTER_VERB_TARGETING_BLOCK` with 10 target verbs, concrete replacement examples, dialogue exceptions, and rate guidance. This report documents the results.

---

## The 10 Target Verbs

| # | Verb | Why It's a Problem | Replacement Strategy |
|---|---|---|---|
| 1 | **felt** | Inserts narrator between reader and sensation | Direct sensation: "felt cold" → "the cold bit" |
| 2 | **seemed** | Hedges a commitment the author should make | Commit or cut: "seemed angry" → "was angry" or show it |
| 3 | **noticed** | Narrator announcing their own attention | Go direct: "noticed the door" → "the door was open" |
| 4 | **realized** | Tells the epiphany instead of showing it | Show through action or thought |
| 5 | **watched** | Passive observation that distances reader | Describe what's seen: "watched him leave" → "he left" |
| 6 | **heard** | Same as watched — reports instead of renders | Name the sound: "heard a crash" → "a crash echoed" |
| 7 | **saw** | Narrator mediating the visual | Present the image: "saw the fire" → "fire climbed the walls" |
| 8 | **thought** | Telling internal state instead of showing it | Interior monologue or action |
| 9 | **wondered** | Same as thought | Frame as a question or show uncertainty |
| 10 | **began to** | Deferred action — just do the thing | Cut entirely: "began to run" → "ran" |

### Constraints Applied

- **Dialogue exception:** Filter verbs in dialogue are natural speech. "I felt like we should go" is realistic dialogue and must not be edited.
- **Rate guidance:** 1–2 replacements per 500 words. The block explicitly prevents wholesale elimination, which would distort voice.
- **Genre routing:** Included for fiction genres only. Nonfiction filter verbs (e.g., "Studies have noticed that…") are a different problem handled by the authority block.

---

## v3 Bakeoff Results: Filter Verb Reduction

### Per-Genre Results

| Genre | Raw (A) FV | Raw FV/1K | Old Model (B) FV | New Model (C) FV | New FV/1K | Δ Old | Δ New |
|---|---|---|---|---|---|---|---|
| Thriller | 4 | 3.1 | 4 (no recast) | 4 (no recast) | 3.1 | 0 | 0 |
| Literary | 11 | 9.1 | 10 | **9** | **7.4** | **-1** | **-2** |
| Nonfiction | 3 | 2.8 | 3 (failed) | **0** | **0.0** | 0 | **-3** |

### Totals

| Metric | Old Model (B) | New Model (C) |
|---|---|---|
| Total FV reduction | **-1** | **-5** |
| FV elimination rate | 1 verb removed | 5 verbs removed |
| Genres with FV improvement | 1 of 3 | **2 of 3** |

> [!IMPORTANT]
> The new model achieved **5× more filter verb reduction** than the old model (−5 vs −1).

---

## Genre-Level Analysis

### Thriller: No Change (Correct Behavior)

- Raw score: 87 EXCELLENT, FV density 3.1/1K words
- Both models correctly identified all 3 chunks as above threshold
- Zero recasts triggered → zero filter verb changes
- **This is correct.** The thriller prose was already strong. Editing it would be overcorrection.

### Literary: −2 Filter Verbs

- Raw: 11 FV (9.1/1K) — the highest density of any genre
- Old model: 10 FV (−1)
- New model: **9 FV (−2)**, density down to **7.4/1K**

The new model removed twice as many filter verbs while maintaining better length preservation (1215 words vs 1188 for the old model against 1204 original).

> [!NOTE]
> Literary FV density remains high at 7.4/1K. This is the genre where further tuning could yield the most improvement. The rate guidance (1–2 per 500 words) may be too conservative for literary prose with 9.1/1K density.

### Nonfiction: Complete Elimination ✨

- Raw: 3 FV (2.8/1K)
- Old model: 3 FV (unchanged — the recast **failed** due to overcorrection)
- New model: **0 FV (0.0/1K)** — all filter verbs eliminated

This is the standout result of the entire v3 tuning effort:

| Metric | Before | After |
|---|---|---|
| Filter verbs | 3 | **0** |
| FV density | 2.8/1K | **0.0/1K** |
| Composite score | 77 | **82 (+5)** |
| Recast failures | 1 (old model) | **0** |

The filter verbs were eliminated **while simultaneously improving the composite score by +5 points**. The old model couldn't even complete the recast without being blocked.

---

## Why the New Model Outperforms

### 1. System Prompt Awareness

The new model's system prompt explicitly lists filter verbs as a quality concern. The model doesn't need to be told in each user prompt — it already knows.

### 2. Temperature 0.4

Lower temperature means the model is more likely to:
- Make targeted, small changes (replacing one verb) rather than rewriting entire passages
- Stay within the rate guidance (1–2 per 500 words)
- Avoid overcorrection that triggers safety blocks

### 3. Concrete Examples

The `FILTER_VERB_TARGETING_BLOCK` provides before/after examples for each verb. The model doesn't need to invent a replacement strategy — it has calibration anchors.

### 4. Genre Routing

By excluding the block from nonfiction prompts, the model's filter verb handling in nonfiction comes entirely from its system prompt identity (which mentions filter verb awareness generally). The `NONFICTION_AUTHORITY_RECAST_BLOCK` provides nonfiction-specific editing guidance that naturally addresses filter verbs through its "precision over vagueness" instructions.

---

## Conclusion

Filter verb targeting is **working as designed** in v3. The combination of system-prompt awareness, low temperature, concrete examples, and genre routing produced a 5× improvement over the old model.

The remaining gap is literary fiction, where FV density remains at 7.4/1K. This is an expected outcome — the rate guidance (1–2 per 500 words) constrains per-chunk improvement, and only 1 of 3 literary chunks was recast. Further improvement requires either:
- Lowering the recast threshold to trigger more chunks
- Increasing the rate guidance for high-density passages
- Running a dedicated FV-focused pass after the quality recast

Detailed nonfiction results in [04-nonfiction-authority-recast-report.md](file:///Users/cliff/Downloads/UBS/smoke-test-output/prose-polisher-recast-tuning-v3/04-nonfiction-authority-recast-report.md).
