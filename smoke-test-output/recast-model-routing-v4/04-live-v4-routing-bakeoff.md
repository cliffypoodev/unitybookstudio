# Recast Model Routing v4 — Live Bakeoff Results

**Date:** 2026-06-09
**Pipeline:** `antiChatbotRecastPipeline.js` v4.0
**Comparison:** A = raw (no recast), B = v3 fixed model, C = v4 routed

---

## Three-Way Comparison

### Thriller

| Metric | A (Raw) | B (v3) | C (v4) |
|---|---|---|---|
| **Composite** | 83 GOOD | 84 GOOD | **85 EXCELLENT** |
| **Rating** | GOOD | GOOD | **EXCELLENT** ⬆️ |
| Filter verbs | 4 (3.6/1K) | 3 | **2 (1.8/1K)** |
| Chatbot phrases | 23 | 19 | **18** |
| Headings | 0 | — | — |
| Citations | 0 | — | — |
| Word count | 1,113 | — | — |
| Chunks recast | — | 1/3 | 1/3 |
| Failed recasts | — | 0 | 0 |
| **Delta** | — | **+1** | **+2** |

**Routing decision:**
- Chunk 1 → `prose-recast-polisher` (`general_improvement`) → recast score = 80

**v4 wins:** +2 vs +1 composite improvement, better FV reduction (−2 vs −1), **promoted from GOOD to EXCELLENT**.

---

### Literary

| Metric | A (Raw) | B (v3) | C (v4) |
|---|---|---|---|
| **Composite** | 73 GOOD | 75 GOOD | **77 GOOD** |
| **Rating** | GOOD | GOOD | GOOD |
| Filter verbs | 10 (8.5/1K) | 7 (6/1K) | **6 (5.2/1K)** |
| Chatbot phrases | 29 | 27 | **22** |
| Headings | 0 | — | — |
| Citations | 0 | — | — |
| Word count | 1,176 | — | — |
| Chunks recast | — | 1/3 | 1/3 |
| Failed recasts | — | 0 | 0 |
| **Delta** | — | **+2** | **+4** |

**Routing decision:**
- Chunk 1 → `prose-recast-polisher` (`filter_verb_specialist`) → recast score = 81

**v4 wins:** +4 vs +2 composite improvement, better FV reduction (−4 vs −3), chatbot reduction −7 vs −2.

> **KEY INSIGHT:** The literary chunk had FV density > 10/1K, triggering Rule 3 (filter verb specialist). This **overrode** the literary default (Rule 4 → `prose-polisher`) and sent the chunk to `prose-recast-polisher` with a filter verb focus. This routing decision was the breakthrough — it fixed the filter verbs without flattening the literary voice.

> **HISTORICAL CONTEXT:** In the v3 bakeoff, literary was FLAT (69→69 with new model, 69→75 only with old model). Now in v4, literary improved **73→77 (+4)**. This is the **best literary result in pipeline history**.

> **ANTI-FLATTENING:** The literary anti-flattening guard did NOT need to trigger because the recast actually improved the composite score. All 4 checks (composite, variance, concrete, ending) passed naturally.

---

### Nonfiction

| Metric | A (Raw) | B (v3) | C (v4) |
|---|---|---|---|
| **Composite** | 72 GOOD | 72 GOOD | 72 GOOD |
| **Rating** | GOOD | GOOD | GOOD |
| Filter verbs | 2 (2.3/1K) | 2 | 2 |
| Chatbot phrases | 22 | 22 | 22 |
| Headings | 0 | 0 | 0 |
| Citations | 2 | 2 | **2** ✅ |
| Word count | 877 | — | — |
| Chunks recast | — | 0/2 | 0/2 |
| Failed recasts | — | 0 | 0 |
| **Delta** | — | **0** | **0** |

**Routing decision:** All chunks above recast threshold (70) — **correctly skipped**.

**Both B and C correctly skipped nonfiction** because all chunks were already above the recast threshold. This is the right behavior — don't recast what's already decent.

- Citations preserved: 2→2→2 ✅
- Headings: 0 in raw output (ghostwriter didn't generate markdown headings this run)
- No heading gate activation needed (nothing to preserve)

---

## Aggregate Results

### Composite Scores

| Genre | A (Raw) | B (v3) | C (v4) | B Delta | C Delta |
|---|---|---|---|---|---|
| Thriller | 83 | 84 | **85** | +1 | **+2** |
| Literary | 73 | 75 | **77** | +2 | **+4** |
| Nonfiction | 72 | 72 | 72 | 0 | 0 |
| **Average** | **76** | **77** | **78** | **+1** | **+2** |

**v4 doubled v3's average improvement: +2 vs +1.**

### Filter Verb Reduction

| Genre | A (Raw) | B (v3) | C (v4) | B Reduction | C Reduction |
|---|---|---|---|---|---|
| Thriller | 4 | 3 | 2 | −1 | **−2** |
| Literary | 10 | 7 | 6 | −3 | **−4** |
| Nonfiction | 2 | 2 | 2 | 0 | 0 |
| **Total** | **16** | **12** | **10** | **−4** | **−6** |

**v4 achieved 50% better filter verb reduction: −6 vs −4.**

### Safety Metrics

| Safety Check | Result |
|---|---|
| Heading blocks triggered | **0** |
| Literary flattening blocks triggered | **0** |
| Citation damage | **None** (2→2→2) |
| Compression damage | **None** |
| Safety regressions | **None** |
| Failed recasts | **0** across all genres |

---

## v3 vs v4 Comparison

| Dimension | v3 | v4 | Winner |
|---|---|---|---|
| Average composite delta | +1 | +2 | **v4** |
| Total FV reduction | −4 | −6 | **v4** |
| Best single-genre delta | +2 (literary) | +4 (literary) | **v4** |
| Genre promoted | None | Thriller (GOOD→EXCELLENT) | **v4** |
| Literary result | +2 | +4 (best ever) | **v4** |
| Model routing | None (single model) | 5-rule routing | **v4** |
| Heading preservation | Lost 1 heading (v3 bug) | 0 loss (gate implemented) | **v4** |
| Literary anti-flattening | None (flat result possible) | 4-check guard | **v4** |
| Safety regressions | None | None | Tie |
| Test coverage | 319 tests | 379 tests (+60 new) | **v4** |

---

## Per-Chunk Routing Details

### Chunk Routing Summary

| Genre | Chunk | Score | Above Threshold? | Routed To | Specialist | Recast Score |
|---|---|---|---|---|---|---|
| Thriller | 1 | Below 70 | No | `prose-recast-polisher` | `general_improvement` | 80 |
| Thriller | 2 | Above 70 | Yes (skipped) | — | — | — |
| Thriller | 3 | Above 70 | Yes (skipped) | — | — | — |
| Literary | 1 | Below 70 | No | `prose-recast-polisher` | `filter_verb_specialist` | 81 |
| Literary | 2 | Above 70 | Yes (skipped) | — | — | — |
| Literary | 3 | Above 70 | Yes (skipped) | — | — | — |
| Nonfiction | 1 | Above 70 | Yes (skipped) | — | — | — |
| Nonfiction | 2 | Above 70 | Yes (skipped) | — | — | — |

### Model Usage Distribution

| Model | Times Selected | Specialist Tags |
|---|---|---|
| `prose-recast-polisher` | 2 | `general_improvement`, `filter_verb_specialist` |
| `prose-polisher` | 0 | — (never selected this run) |

> **Note:** `prose-polisher` was never selected because the literary chunk's high FV density triggered Rule 3 before Rule 4 (literary default) could apply. This is correct behavior — the FV specialist was the right choice for this particular chunk.

---

## Highlights

1. 🏆 **Literary +4 is the best literary result in pipeline history** — routing made the right model decision
2. 🏆 **Thriller promoted to EXCELLENT** — first genre to cross the EXCELLENT threshold via recast
3. ✅ **Nonfiction correctly skipped** — pipeline doesn't waste resources on already-decent prose
4. ✅ **Filter verb reduction 50% better** than v3
5. ✅ **Zero failures, zero blocks, zero regressions** across all genres
6. ✅ **Citations fully preserved** through the entire pipeline
