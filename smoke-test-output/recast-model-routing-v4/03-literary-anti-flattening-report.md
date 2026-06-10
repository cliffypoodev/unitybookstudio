# Recast Model Routing v4 — Literary Anti-Flattening Report

**Date:** 2026-06-09
**Module:** `src/lib/recastModelRouting.js` → `validateLiteraryRecast()`
**Pipeline:** `antiChatbotRecastPipeline.js` v4.0

---

## The v3 Problem

In v3 bakeoff testing, literary/memoir content suffered from **flattening** — the recast process improved chatbot metrics but destroyed the literary texture that makes the prose distinctive:

| Metric | v3 Bakeoff (literary) | Result |
|---|---|---|
| Composite before | 69 | — |
| Composite after (new model) | 69 | **FLAT** ❌ |
| Composite after (old model) | 75 | Improved, but only with old model |

The flattening manifested as:
- **Sentence variance collapse:** Varied sentence lengths smoothed into uniform mid-length sentences
- **Concrete detail loss:** Specific sensory details replaced with generic descriptions
- **Ending punch erasure:** Impactful final lines weakened into bland conclusions
- **Literary voice homogenization:** Distinctive authorial voice blended into generic "good writing"

---

## The v4 Fix: validateLiteraryRecast()

v4 introduces a **4-check anti-flattening guard** that only applies to literary and memoir profiles. If any check fails, the recast is rejected and the original chunk is preserved.

### The 4 Checks

#### Check 1: Composite Must Improve
```
if recastComposite <= originalComposite:
  BLOCK — "flat or worse composite"
```
The recast must produce a higher composite score. A flat result (same score) is treated as a failure because the recast introduced risk (potential voice damage) without reward (no score improvement).

#### Check 2: Sentence Variance Must Not Drop > 1.0
```
if (originalVariance - recastVariance) > 1.0:
  BLOCK — "variance collapse"
```
Sentence length variance is a key marker of literary style. Varied rhythms (short punchy sentences mixed with long flowing ones) are characteristic of skilled literary prose. A variance drop > 1.0 indicates the recast is smoothing the prose into uniform sentence lengths.

#### Check 3: Concrete Ratio Must Not Drop > 5%
```
if (originalConcreteRatio - recastConcreteRatio) > 0.05:
  BLOCK — "concrete detail loss"
```
Concrete language (sensory details, specific objects, physical descriptions) is the backbone of literary prose. If the concrete ratio drops more than 5 percentage points, the recast is replacing specific details with abstract language — a hallmark of chatbot-style writing.

#### Check 4: Ending Punch Must Not Be Lost
```
if originalHasEndingPunch AND NOT recastHasEndingPunch:
  BLOCK — "ending punch erasure"
```
Strong endings (impactful final sentences, emotional resonance, circular callbacks) are a signature of skilled literary writing. If the original has a punchy ending and the recast doesn't, the recast damaged the most memorable part of the chunk.

### Profile Applicability

| Profile | Guard Active? | Rationale |
|---|---|---|
| Literary fiction | ✅ Yes | Primary target for anti-flattening |
| Memoir | ✅ Yes | Memoir shares literary texture concerns |
| General fiction | ❌ No | Genre fiction prioritizes clarity over texture |
| Thriller | ❌ No | Thrillers prioritize pace, not literary texture |
| Nonfiction | ❌ No | Nonfiction has different quality axes |

---

## Pipeline Integration

The literary anti-flattening guard is wired into `recastChunkWithAntiChatbotRules`, **after** the heading preservation gate:

```
1. Detect weakness types
2. Choose recast model
3. Call LLM for recast
4. Validate heading preservation (nonfiction gate)
5. ──► validateLiteraryRecast(original, recast, profile, metrics)
6.     If BLOCK: reject recast, keep original, increment literaryFlatteningBlocks
7.     If PASS: accept recast
8. Return final result
```

The `literaryFlatteningBlocks` counter tracks how often the guard triggers, providing visibility into the frequency of flattening attempts.

---

## v4 Bakeoff Results

| Metric | Value | Notes |
|---|---|---|
| Literary flattening blocks | **0** | Guard did not need to trigger |
| Literary composite delta | **+4** (73→77) | Best literary result ever |
| Literary FV reduction | −4 (10→6) | Significant filter verb improvement |
| Literary chatbot reduction | −7 (29→22) | Strong chatbot phrase reduction |

### Why the Guard Didn't Trigger

The guard was **not needed** this run because the routing logic made the right decision:

1. The literary chunk had FV density > 10/1K (detected as `filter_verb_heavy`)
2. The router sent it to `prose-recast-polisher` as `filter_verb_specialist` (Rule 3 overrode Rule 4's literary default)
3. The `prose-recast-polisher` model with `filter_verb_specialist` focus **actually improved** the literary score (+4)
4. Since the composite improved and texture metrics held, all 4 checks passed naturally

**Key insight:** The anti-flattening guard is a **safety net**, not the primary fix. The primary fix is the routing logic itself — by choosing the right model for the right weakness, the recast naturally produces better results. The guard catches cases where routing makes a suboptimal choice and the recast flattens the prose.

### Historical Context

| Version | Literary Result | Mechanism |
|---|---|---|
| v3 (new model) | 69→69 (FLAT) | No routing, no guard |
| v3 (old model) | 69→75 (+6) | Old model happened to work, but not reliable |
| **v4** | **73→77 (+4)** | **Routing selected right model; guard available as backup** |

v4's +4 improvement is the **best literary result achieved through the recast pipeline**. The v3 old model's +6 was from a different model entirely and not reproducible with the new model.

---

## Test Coverage

**File:** `literaryRecastAntiFlattening.test.mjs` — **15 tests, all passing**

### Test Categories

| Category | Count | What's Tested |
|---|---|---|
| Composite improvement check | 3 | Pass on improvement, block on flat/worse |
| Variance collapse detection | 3 | Pass within threshold, block on > 1.0 drop |
| Concrete ratio preservation | 3 | Pass within threshold, block on > 5% drop |
| Ending punch preservation | 3 | Pass when preserved, block when lost |
| Profile bypass | 3 | Non-literary profiles correctly bypass guard |

### Key Test Cases

1. **Literary chunk flat (75→75):** BLOCKED ✅ — composite didn't improve
2. **Literary chunk worse (75→72):** BLOCKED ✅ — composite decreased
3. **Literary chunk improved but variance collapsed:** BLOCKED ✅ — texture damage
4. **Literary chunk improved, all metrics held:** PASSED ✅ — safe recast
5. **Thriller chunk flat:** PASSED ✅ — guard doesn't apply to thrillers

---

## Summary

The literary anti-flattening guard is a multi-dimensional safety net that protects literary voice during the recast process. It checks:

1. **Composite improvement** — the recast must help, not just change
2. **Sentence variance** — rhythmic variety must be preserved
3. **Concrete language** — sensory specificity must be maintained
4. **Ending impact** — strong closings must survive

In the v4 bakeoff, the guard was not triggered because the routing logic made the right model selection — sending the high-FV literary chunk to `filter_verb_specialist` instead of the literary default. This is the ideal outcome: good routing makes the guard unnecessary. The guard exists for when routing doesn't produce the ideal result.

**Status:** Implemented and tested (15/15 pass). Not yet triggered by live data. For full validation, need a run where routing produces a flat literary result so the guard can demonstrate its blocking behavior in production.
