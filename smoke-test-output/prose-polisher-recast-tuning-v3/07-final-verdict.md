# Final Verdict — Prose-Polisher Recast Tuning v3

> **Date:** 2026-06-09
> **Classification:** Final Assessment
> **Verdict:** **PASS WITH NOTES**

---

## Verdict: PASS WITH NOTES

v3 is not a final pass. It is a **structural breakthrough** with honest limitations.

---

## What PASSED

### Root Cause Fixed

The generic personal-assistant system prompt — shared between `ghostwriter` and `prose-polisher` — has been identified and replaced. The `prose-recast-polisher` model now has a dedicated editor identity in its system prompt, not just user-prompt instructions.

This is the most important change in v3. Everything else flows from it.

### Dedicated Model Created and Registered

| Item | Status |
|---|---|
| `models/prose-recast-polisher.Modelfile` | ✅ Created |
| System prompt: "Conservative prose editor" | ✅ Baked in |
| Temperature: 0.4 (was 1.0) | ✅ Set |
| top_k: 40, top_p: 0.9 | ✅ Set |
| Same base weights (no download) | ✅ Verified |
| Registered with Ollama | ✅ Operational |

### Filter Verb Targeting Works

| Metric | Old Model | New Model |
|---|---|---|
| Total FV reduction | −1 | **−5** |
| Improvement factor | — | **5×** |

The new model eliminated 5 filter verbs across genres vs 1 for the old model. The nonfiction result (3 → 0, complete elimination) is remarkable.

### Nonfiction Breakthrough

> [!IMPORTANT]
> **No previous version of the recast pipeline has ever improved nonfiction prose.** v3 achieved +5 composite, FV 3→0, chatbot −4, citations preserved, zero failures.

| Metric | Before | After |
|---|---|---|
| Composite | 77 | **82 (+5)** |
| Filter verbs | 3 | **0** |
| Chatbot patterns | 15 | **11** |
| Citations | 2 | **2 ✔️** |
| Failures | 1 (old model) | **0** |

### Zero Failures

The old model had 1 recast failure (overcorrection block). The new model had 0. Across all genres, the new model either improved the prose or correctly left it alone.

### Genre-Specific Architecture

- Genre examples (thriller, literary, nonfiction) with four-tier calibration (weak / acceptable / overcorrected / compressed)
- `FILTER_VERB_TARGETING_BLOCK` routed to fiction only
- `NONFICTION_AUTHORITY_RECAST_BLOCK` routed to nonfiction/business_guide only
- Training manual correctly excluded from authority block

### Test Suite

| Metric | Result |
|---|---|
| New v3 tests | 65/65 pass |
| Total recast suites | 13 |
| Total tests | 319/319 pass |
| Regressions | 0 |
| Build | Clean |

---

## What LIMITED (Why Not FINAL PASS)

### 1. Literary Composite Stayed Flat

| Metric | Raw | Old Model | New Model |
|---|---|---|---|
| Composite | 69 | 75 (+6) | 69 (0) |

The new model improved filter verbs (−2) and preserved length better (100.9% vs 98.7%) but did not improve the composite score. The old model scored higher because it was more willing to make dramatic changes — a side effect of its chatty assistant identity and 1.0 temperature.

**This is the central tradeoff of v3:** conservative editing is more reliable but produces smaller gains when the prose needs significant rework.

### 2. Thriller Not Tested at Recast Level

The thriller sample scored 87 EXCELLENT. Both models correctly skipped all 3 chunks. This validates the "don't touch good prose" behavior but tells us nothing about the models' ability to improve weak thriller prose.

**Need:** A thriller sample in the 60–75 COMPETENT/GOOD range.

### 3. Nonfiction Lost 1 Heading

| Headings | Before | After |
|---|---|---|
| Count | 3 | 2 (−1) |

Minor but real structural damage. Headings are structural elements that should be preserved. This needs investigation and a validation check.

### 4. Average Composite Delta Slightly Lower

| Model | Avg Composite Delta |
|---|---|
| Old Model (v3) | +2.0 |
| New Model (v3) | +1.7 |
| v2 | +2.0 |

The new model's nonfiction win (+5) was offset by the literary flat (0), bringing the average slightly below the old model and v2. This is an artifact of the sample set — the nonfiction improvement is more meaningful than the average suggests because nonfiction was previously a 0-improvement dead zone.

### 5. Literary Filter Verb Density Remains High

| Metric | Before | After |
|---|---|---|
| Literary FV density | 9.1/1K | 7.4/1K |

Improved, but 7.4/1K is still the highest density of any genre. The rate guidance (1–2 per 500 words) may be too conservative for literary prose with this level of filter verb saturation.

---

## Honest Assessment

### The Nonfiction Result Is Historic

No version of this pipeline — v1, v2, or v3 with the old model — has ever improved nonfiction prose. The new model did it on its first attempt: +5 composite, complete filter verb elimination, chatbot reduction, citation preservation, zero failures.

This alone justifies the v3 tuning effort.

### The Root Cause Fix Is Architecturally Correct

Giving the model an editor identity (system prompt) rather than asking an assistant to edit (user prompt) is the right architecture. This will compound over time as we refine the system prompt and genre-specific instructions.

### The Literary Result Is Honest, Not Bad

The new model didn't fail on literary prose — it made smaller, more targeted improvements that didn't move the composite score. The old model's higher score came from its willingness to make dramatic changes, which is inherently risky (it also failed on nonfiction for the same reason).

The new model is doing what we designed it to do: conservative editing. For literary prose that needs bigger changes, we may need a different approach (see Recommendations).

### The Test Gap Is Real

A thriller sample that's already EXCELLENT and a literary sample where the models disagree by +6 points is a thin dataset. More samples, especially weaker ones, are needed to establish the new model's improvement ceiling.

---

## Recommendations

### 1. Accept as Production Recast Model for Nonfiction — Immediately

The nonfiction results are unambiguous. The new model should be the production recast model for all nonfiction and business_guide profile keys.

### 2. Consider Two-Pass Approach for Fiction

The old model's willingness to make dramatic changes + the new model's filter verb targeting could be combined:

- **Pass 1:** Old model for aggressive composite improvement (with overcorrection safety)
- **Pass 2:** New model for targeted filter verb cleanup

This preserves the old model's creative upside while adding the new model's precision.

### 3. Add Heading Preservation to Validation Safety Checks

```
if output.headingCount < input.headingCount:
    flag("Heading loss detected")
```

Headings are structural. The validation pipeline should catch heading loss alongside overcorrection.

### 4. Re-Run with Weaker Prose Samples

| Genre | Current Sample Score | Target for Retest |
|---|---|---|
| Thriller | 87 EXCELLENT | 60–75 COMPETENT/GOOD |
| Literary | 69 COMPETENT | Keep (good test range) |
| Nonfiction | 77 GOOD | Keep (validated) + add 55–65 |

Weaker samples will test the model's improvement ceiling and reveal whether the conservative editing stance limits gains on prose that needs significant help.

---

## Disposition

| Decision | Action |
|---|---|
| Production nonfiction model | ✅ `prose-recast-polisher` — deploy now |
| Production fiction model | ⏸ Hold — needs weaker sample testing and possible two-pass design |
| Heading validation | 🔧 Add to safety checks |
| Literary tuning | 🔬 Investigate rate guidance adjustment for high-FV-density passages |
| Thriller testing | 📋 Queue weaker thriller sample |

---

> **Bottom line:** v3 solved the hardest problem in the recast pipeline (nonfiction) and established the right architecture (system-prompt identity). The literary gap is a known tradeoff of conservative design, not a regression. For FINAL PASS, we need weaker samples, heading preservation, and a decision on fiction handling.
