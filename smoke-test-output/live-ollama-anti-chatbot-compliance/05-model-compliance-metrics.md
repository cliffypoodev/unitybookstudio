# 05 — Model Compliance Metrics

**Verdict: PARTIAL COMPLIANCE for fiction, NON-COMPLIANCE for nonfiction**

---

## Overview

This report assesses whether the `ghostwriter` model, when given the `SIGNATURE_VOICE_BLOCK`, actually *obeyed* the 10 specific rule categories. Compliance is measured by comparing Version B metrics against the rule's target, not against Version A. A rule is "complied with" if the model's output meets the stated threshold; "partially complied" if it moved in the right direction but didn't reach the target; and "non-compliant" if the metric stayed flat or worsened.

## Full Compliance Matrix

| Rule Category | Rule Target | Thriller B | Literary B | Nonfiction B | Thriller | Literary | Nonfiction |
|---|---|---|---|---|---|---|---|
| **Filter Verbs** | ≤5/1K | 3.6/1K | 5.8/1K | 5.7/1K | ✅ Compliant | ⚠️ Partial | ❌ Worsened |
| **"Not Just" Ban** | 0 instances | 3 (2.7/1K) | 2 (1.9/1K) | 2 (2.8/1K) | ❌ Non-compliant | ❌ Non-compliant | ❌ Non-compliant |
| **Thesis Statement Ban** | 0 instances | 1 (0.9/1K) | 0 | 0 | ❌ Non-compliant | ✅ Compliant | ✅ Compliant |
| **Lesson Endings** | 0 instances | 0 | 0 | 0 | ✅ Compliant | ✅ Compliant | ✅ Compliant |
| **Balanced Reflection Ban** | 0 instances | 0 | 0 | 0 | ✅ Compliant | ✅ Compliant | ✅ Compliant |
| **Triple Construction** | ≤3/1K | 0/1K | 1.0/1K | 2.8/1K | ✅ Compliant | ✅ Compliant | ✅ Compliant |
| **Generic Emotion** | 0 instances | 0 | 0 | 0 | ✅ Compliant | ✅ Compliant | ✅ Compliant |
| **Symmetry Break** | ≤30% pairs | 25% | 15% | 23% | ✅ Compliant | ✅ Compliant | ✅ Compliant |
| **Opening Verb Strength** | Strong (action) | strong | strong | weak | ✅ Compliant | ✅ Compliant | ❌ Non-compliant |
| **Ending Punch** | Short final sentence | true | false | false | ✅ Compliant | ❌ Non-compliant | ❌ Non-compliant |

## Compliance Summary by Genre

| Genre | Compliant | Partial | Non-Compliant | Rate |
|---|---|---|---|---|
| **Thriller** | 7/10 | 0 | 3/10 | 70% |
| **Literary** | 7/10 | 1 | 2/10 | 70–75% |
| **Nonfiction** | 5/10 | 0 | 5/10 | 50% |

## Per-Rule Analysis

### 1. Filter Verbs — Mixed Results

The rule demands: *"Ban filter verbs in narration: felt, seemed, appeared, noticed, realized, observed, watched, heard, saw."*

| Genre | Version A | Version B | Delta | Verdict |
|---|---|---|---|---|
| Thriller | 6.1/1K (7) | 3.6/1K (4) | −2.5/1K | ✅ |
| Literary | 7.1/1K (8) | 5.8/1K (6) | −1.3/1K | ⚠️ |
| Nonfiction | 2.1/1K (2) | 5.7/1K (4) | **+3.6/1K** | ❌ |

Filter verbs improved in fiction but *nearly tripled* in nonfiction. The model seems to interpret the fiction-oriented examples in the rules ("She felt the cold → Cold pressed through the denim") as permission to use more sensory filter verbs in nonfiction, where they didn't exist before.

### 2. "Not Just" Ban — Complete Failure

The rule demands: *"Ban 'not just X — but Y' / 'wasn't just X; it was Y' constructions entirely."*

| Genre | Version A | Version B | Delta |
|---|---|---|---|
| Thriller | 3 | 3 | 0 |
| Literary | 1 | 2 | +1 |
| Nonfiction | 1 | 2 | +1 |

The model did not reduce "not just" in any genre. It *increased* usage in two of three. This construction appears deeply embedded in the ghostwriter model's weights — a habitual escalation device that system-prompt-level bans cannot override.

Specific instances in Version B outputs:

- Thriller: *"This isn't just FEMA equipment"* (line 5), *"they aren't just monitoring"* (line 15), *"They aren't just warning the populace"* (line 21)
- Literary: *"not just a statistic"* (line 15), *"not just running tests on compliance"* (line 33)
- Nonfiction: *"not merely calculating"* (line 5), *"The algorithmic structure itself explained nothing"* uses the "did not just" form implicitly (line 13)

### 3. Thesis Statement Ban — Mostly Compliant (Except Thriller)

The rule demands: *"Ban thesis sentences: 'The truth was...' / 'In that moment, she understood...'"*

Only the thriller introduced a thesis statement in Version B: *"The realization struck him"* (line 23). Literary and nonfiction both avoided this pattern.

### 4. Lesson Endings — Fully Compliant

No version in any genre ended with "And that was when she realized..." or similar. This is the one rule the model fully respects, though it's worth noting that Version A also had zero lesson endings — so the compliance may be a Modelfile-level trait, not a SIGNATURE_VOICE_BLOCK effect.

### 5. Balanced Reflection — Fully Compliant

No version used "Part of her wanted X. Another part wanted Y." Again, Version A was also clean, suggesting the Modelfile handles this independently.

### 6. Opening Verb Strength — Mixed

| Genre | Version A | Version B |
|---|---|---|
| Thriller | strong | strong |
| Literary | **weak** | **strong** |
| Nonfiction | weak | **weak** |

The literary sample is the only one where this rule produced a change. The nonfiction sample failed to fix a weak opening verb — both versions start with "sat" (state verb).

### 7. Ending Punch — Mostly Failed

Only the thriller achieves a short punchy ending. Literary and nonfiction both end with long, sprawling sentences. The model consistently fails to compress its final sentence, suggesting it cannot self-monitor its own output length in real time.

## Compliance vs. Baseline Comparison

A critical observation: for rules where both A and B are compliant (lesson endings, balanced reflection, generic emotion in thriller and nonfiction), the *Modelfile* deserves the credit, not the `SIGNATURE_VOICE_BLOCK`. The system prompt rules only demonstrably helped where Version A failed and Version B succeeded — which is limited to:

- Literary opening verb strength (weak → strong)
- Thriller filter verb density (6.1 → 3.6)
- Literary symmetry (29% → 15%)
- Literary generic emotion (0.9 → 0)

Four clear improvements across 30 rule-genre combinations (3 genres × 10 rules). That's a 13% influence rate for rules that are supposed to be "MANDATORY."

## Conclusion

The `SIGNATURE_VOICE_BLOCK` achieves **partial compliance for fiction** and **non-compliance for nonfiction**. The model obeys the rules it was already following (Modelfile-level traits), partially improves on a few metrics (filter verbs in fiction, symmetry in literary), and completely ignores the "not just" ban across all genres. Nonfiction compliance is at 50% — coin-flip territory.

The "MANDATORY" label in the `SIGNATURE_VOICE_BLOCK` header is aspirational, not descriptive. The model treats these as suggestions, not commands.
