# 06 — Drift and Longform Stability Report

**Critical Finding: Prompt-injected prose rules have a ~300–400 word half-life**

---

## Overview

This report analyzes whether the `SIGNATURE_VOICE_BLOCK` maintains its influence across the full length of a generated passage. Each Version B output (~700–1,125 words) was split into thirds and scored independently. The question: does the model sustain compliance, or does it drift back to its default cadence?

## Drift Data Summary

| Genre | Opening | Middle | Ending | Drift (Δ) | Severity |
|---|---|---|---|---|---|
| Thriller | 94 (EXCELLENT) | 73 (GOOD) | 84 (GOOD) | −10 | ⚡ MINOR |
| Literary | 87 (EXCELLENT) | 75 (GOOD) | 65 (COMPETENT) | **−22** | **⚠️ SIGNIFICANT** |
| Nonfiction | 60 (COMPETENT) | 61 (COMPETENT) | 69 (COMPETENT) | +9 | ✅ STABLE (inverted) |

## Literary Drift — The Critical Case

The literary sample shows the most informative drift pattern because it starts strong and degrades visibly.

### Opening Third (Score: 87 — EXCELLENT)

| Metric | Value |
|---|---|
| Filter verbs | 4.7/1K |
| "Not just" | 0/1K |
| Symmetry | 12% |
| Concrete ratio | 80% |
| Opening verb | strong |

The opening is genuinely excellent prose. Zero "not just" constructions. Low symmetry (12%). Strong concrete ratio. The model attended to the SIGNATURE_VOICE_BLOCK rules and produced measurably better output than Version A.

Evidence from the opening:

> "The waiting room smelled like burned ozone and stale disinfectant, a chemical cocktail that clung to the polyester upholstery of the molded plastic chairs." (line 1)

Strong verb ("smelled"), concrete specifics (ozone, disinfectant, polyester, plastic). No filter verbs. No symmetrical pairs.

### Middle Third (Score: 75 — GOOD)

| Metric | Value |
|---|---|
| Filter verbs | 6.3/1K |
| "Not just" | 3.2/1K |
| Symmetry | 24% |
| Concrete ratio | 83% |
| Opening verb | weak |

The middle section shows clear degradation. Filter verbs nearly doubled from the opening (4.7 → 6.3/1K). "Not just" appeared at 3.2/1K — a pattern that was completely absent in the opening. Symmetry doubled (12% → 24%).

Evidence of drift from the middle:

> "The queue's sheer length was **not just** a statistic; it was a psychological weight pressing down on her shoulders." (line 15)

The banned "not just X; it was Y" construction appears for the first time ~500 words into the piece. The model has begun reverting.

### Ending Third (Score: 65 — COMPETENT)

| Metric | Value |
|---|---|
| Filter verbs | 6.8/1K |
| "Not just" | 3.4/1K |
| Symmetry | 11% |
| Concrete ratio | **50%** |
| Opening verb | weak |
| Ending punch | false |
| Triple construction | 3.4/1K |

The ending is functionally COMPETENT — the same grade as output that never received the SIGNATURE_VOICE_BLOCK. Concrete ratio collapsed from 80% to 50%. Filter verb density continued rising (6.8/1K). Triple construction density spiked to 3.4/1K. The ending sentence is a 29-word sprawl instead of a punchy close.

Evidence of full reversion:

> "Elena felt her entire body stiffen, suddenly aware of the weight of every unsaid memory pressing against her ribs." (line 33)

Filter verb "felt." Abstract emotion ("weight of every unsaid memory"). This sentence could have come from Version A. The SIGNATURE_VOICE_BLOCK's influence is gone.

## Why Drift Happens: The Autoregressive Feedback Loop

The mechanism is predictable. In autoregressive generation:

1. The system prompt (including SIGNATURE_VOICE_BLOCK) is strongest at the start, when the model has no prior generated context to influence its next-token predictions.
2. As the model generates text, its *own* output becomes part of the context. If the generated text contains chatbot patterns (even mild ones), those patterns reinforce the model's probability of generating more of the same.
3. By mid-generation, the model's own text — which is not 100% compliant with the rules — is now the dominant style signal. The system prompt rules are still present but are drowned out by 500+ words of the model's own cadence.
4. By the end, the model is essentially writing in its default style, with the system prompt as a distant, weakened signal.

This is not a flaw in the SIGNATURE_VOICE_BLOCK's content. It is a fundamental limitation of prompt-only prose control in autoregressive generation.

## Thriller Drift — Moderate

The thriller's drift profile is less severe (−10 points) but shows a different pattern:

| Section | Score | Concerning Metric |
|---|---|---|
| Opening | 94 | — |
| Middle | 73 | "Not just" spikes to 6.0/1K; thesis statement appears (3.0/1K) |
| Ending | 84 | Filter verbs spike to 7.2/1K, but concrete ratio recovers to 100% |

The middle section is the weakest because it's dialogue-heavy. Dialogue is where "not just" constructions cluster — the model uses them as character-voice escalation devices ("They aren't *just* monitoring…"). The ending recovers somewhat because it returns to action/description, where the model is stronger.

## Nonfiction Drift — Inverted (Better Without Rules)

The nonfiction sample shows *negative* drift — the ending (69) scores higher than the opening (60):

| Section | Score | Concerning Metric |
|---|---|---|
| Opening | 60 | Filter verbs 7.3/1K, concrete ratio 0%, "not just" 3.7/1K |
| Middle | 61 | Triple construction 5.2/1K, concrete ratio 0% |
| Ending | 69 | Concrete ratio recovers to 50%, filter verbs drop to 4.2/1K |

The opening, where the fiction-oriented rules have the most influence, is the *worst* section. As the model drifts away from those rules and returns to its natural nonfiction cadence, the prose actually improves. This is the inverse of the fiction pattern, and it confirms that the SIGNATURE_VOICE_BLOCK's fiction rules actively degrade nonfiction output.

## Half-Life Estimation

Based on the literary drift curve:

| Words Generated | Score | Compliance Level |
|---|---|---|
| 0–350 | 87 | EXCELLENT (strong compliance) |
| 350–700 | 75 | GOOD (partial compliance) |
| 700–1,033 | 65 | COMPETENT (minimal compliance) |

Linear interpolation suggests the model's compliance crosses from GOOD to COMPETENT at approximately **500–600 words**. The "half-life" — the point at which half the improvement has decayed — is approximately **300–400 words**.

For a book-writing application generating 1,200–3,000 words per scene, this means:
- The first 400 words will show the rules' influence.
- Words 400–800 will show partial compliance.
- Everything after word 800 will be functionally identical to output without the SIGNATURE_VOICE_BLOCK.

For a full chapter (5,000–10,000 words), prompt-only rules are essentially ineffective for 80%+ of the output.

## Recommendations

> [!IMPORTANT]
> Prompt injection alone cannot sustain prose quality over longform generation.

1. **Post-generation recast loop.** After generating 800–1,200 words, run the output through `analyzeProseTexture()`, identify violations, and send a targeted recast prompt addressing only the specific failures detected in the latter portions of the text.

2. **Sliding window regeneration.** Generate in 400-word chunks. After each chunk, prepend the scored output back into the prompt as "context" along with refreshed SIGNATURE_VOICE_BLOCK rules. This maintains rule proximity to the generation point.

3. **Two-pass architecture.** Generate freely with the Modelfile's existing quality, then run a second "polisher" pass using `POLISHER_ANTI_CHATBOT_RULES` to fix specific violations detected by the analyzer.

4. **Accept the constraint.** If prompt-only injection is the only option, acknowledge that quality will degrade after ~400 words and plan the UX accordingly (e.g., shorter generation chunks, automatic quality-gate between chunks).
