# 02 — Commercial Thriller: Live Generation Report

**Verdict: MARGINAL IMPROVEMENT (+1 composite)**
**A: 84 (GOOD) → B: 85 (EXCELLENT) | Chatbot patterns: 24 → 26 (+2 WORSE)**

---

## Summary

The thriller sample shows the smallest improvement of any genre tested. A single composite point separates the two versions, placing them on either side of the GOOD/EXCELLENT boundary — a distinction that is statistically meaningless given single-sample stochastic variation at temperature 0.72. More concerning: chatbot pattern count actually *increased* from 24 to 26 in Version B, meaning the `SIGNATURE_VOICE_BLOCK` introduced new chatbot patterns while marginally improving the composite score.

## Metric Comparison

| Metric | Version A | Version B | Delta | Verdict |
|---|---|---|---|---|
| Composite Score | 84 (GOOD) | 85 (EXCELLENT) | +1 | Negligible |
| Word Count | 1,153 | 1,125 | -28 | Stable |
| Filter Verb Density | 6.1/1K (7) | 3.6/1K (4) | -2.5/1K | ✅ Improved |
| "Not Just" Density | 2.6/1K (3) | 2.7/1K (3) | +0.1/1K | ❌ No change |
| Thesis Statement Density | 0/1K (0) | 0.9/1K (1) | +0.9/1K | ❌ Worsened |
| Symmetry Score | 18% | 25% | +7% | ❌ Worsened |
| Concrete Ratio | 82% | 87% | +5% | ✅ Improved |
| Sentence Length Variance | 9.3 | 11.2 | +1.9 | ✅ Improved |
| Opening Verb Strength | strong | strong | — | Stable |
| Ending Punch | true | true | — | Stable |
| Chatbot Patterns (total) | 24 | 26 | +2 | ❌ Worsened |
| Symmetrical Pairs | 12 | 16 | +4 | ❌ Worsened |
| Abstract Emotion | 2 | 2 | 0 | Stable |

## 3 Strongest Improvements

### 1. Filter Verb Reduction (6.1 → 3.6/1K)

This is the only metric with clear improvement. Version A uses filter verbs liberally:

> *Version A:* "Marcus **felt** a cold drop in his stomach" (line 29)
> *Version A:* "the complexity was overwhelming, suggesting **not just** connectivity" (line 7)

Version B replaces some of these with more direct constructions:

> *Version B:* "The weight of it pressed down on him—the knowledge that every siren… was a manufactured event." (line 19)
> *Version B:* "The realization struck him not as a single thought, but as a physical impact: the cold press of certainty behind his eyes, making his jaw ache." (line 23)

The line 23 construction in B is genuinely better craft — turning an abstract realization into a physical sensation with specific body parts (eyes, jaw). However, note that the word "realization" itself is a filter verb derivative, and the phrase "the realization struck him" borders on the very chatbot cadence the rules prohibit.

### 2. Concrete Sensory Ratio (82% → 87%)

Version B opens with stronger sensory grounding:

> *Version B:* "The decommissioned military annex **smelled of ozone and stale industrial carpet**, a deep, metallic scent that **clung to everything Marcus inhaled**." (line 1)

Compare to Version A's opening, which is visually vivid but less multi-sensory:

> *Version A:* "Marcus used the reinforced steel door to push into a space that swallowed sound—a massive, subterranean operations center built into the decaying concrete structure" (line 1)

Version B's opening engages smell and touch before sight. This is a genuine improvement.

### 3. Sentence Length Variance (9.3 → 11.2)

Version B achieves marginally more rhythmic variation. The opening paragraph in B mixes a 33-word sentence with a 17-word sentence followed by a longer complex sentence. Version A's opening is three long sentences of roughly similar length (30+, 35+, 20+).

## 3 Weakest / No-Change Areas

### 1. "Not Just" Pattern — Stubbornly Persistent

Both versions use exactly 3 "not just" constructions. The `SIGNATURE_VOICE_BLOCK` explicitly bans this pattern: *"Ban 'not just X — but Y' / 'wasn't just X; it was Y' constructions entirely."* The model ignored this rule completely.

> *Version A:* "Meridian Systems **hadn't just** connected to FEMA's network" (line 3)
> *Version A:* "The feeds are theatrical… They **aren't just** monitoring infrastructure failure points" (line 11)
> *Version A:* "She **wasn't just** articulating" → "They **aren't just** simulating disaster" (line 35)

> *Version B:* "This **isn't just** FEMA equipment" (line 5)
> *Version B:* "they **aren't just** monitoring the state of emergency readiness" (line 15)
> *Version B:* "she **didn't just** warning the populace" → "They **aren't just** warning the populace" (line 21)

The model treats "not just" as a natural escalation device in thriller dialogue. The prompt rule has zero effect.

### 2. Symmetrical Pairs — Actually Got WORSE (12 → 16)

The `SIGNATURE_VOICE_BLOCK` contains an explicit rule: *"If you catch yourself writing a balanced pair ('She X. He Y.'), break the symmetry."* Version B increased symmetrical pairs by 33%.

Example from Version B:

> "Marcus walked toward the center nexus… The screens showed twelve distinct regions" (line 7)
> "Meridian Systems," Marcus stated… Sarah didn't lift her gaze" (lines 9–11)

Two consecutive character-action sentences of similar length — exactly the pattern the rules prohibit.

### 3. Thesis Statement — Appeared Where None Existed Before

Version A had zero thesis statements. Version B introduced one:

> *Version B:* "**The realization struck him** not as a single thought, but as a physical impact" (line 23)

The `SIGNATURE_VOICE_BLOCK` bans thesis sentences including "the realization hit/struck/came/dawned." The model partially obeyed (it tried to make the realization physical rather than abstract) but still used the banned construction.

## 3 Failure Modes

### 1. Adrenalized Redundancy

Version B contains this unfortunate construction:

> "He felt a sudden, desperate surge of **adrenalized adrenaline**, flushing heat pooling low in his stomach." (line 35)

"Adrenalized adrenaline" is a redundancy that no human editor would permit. The model, reaching for intensity as demanded by the genre texture rules, overcorrected into absurdity. This sentence also contains the banned filter verb "felt."

### 2. POV Contamination

Version B has a jarring POV slip:

> "Her jaw locked; **I could see** the muscles tightening beneath the skin" (literary-version-b.txt, line 17)

This is from the literary sample, but it illustrates a broader issue: the model under `SIGNATURE_VOICE_BLOCK` pressure occasionally breaks third-person narration constraints.

### 3. Dialogue Attribution as Information Dump

Both versions suffer from characters delivering exposition through dialogue. The `SIGNATURE_VOICE_BLOCK` rule on subtext ("Characters should say less than they mean") had no discernible effect:

> *Version B:* "The data points they care about—the evacuation rates, the compliance metrics, the panic response indices... that's what they sell. They aren't disaster consultants; they are behavioral engineers using infrastructure as their playground." (line 27)

This is a thesis speech, not dialogue. A character speaking with this level of analytical precision under duress is chatbot writing, regardless of the composite score.

## Drift Analysis (Version B)

| Section | Score | Grade | Filter Verbs | Not Just |
|---|---|---|---|---|
| Opening | 94 | EXCELLENT | 2.6/1K | 0/1K |
| Middle | 73 | GOOD | 0/1K | 6.0/1K |
| Ending | 84 | GOOD | 7.2/1K | 2.4/1K |

The thriller shows moderate drift (−10 points from opening to ending). The middle section is the weakest, with the highest "not just" density (6.0/1K) — all the banned constructions cluster in the dialogue-heavy center of the piece. The opening is strong because it's descriptive; the model reverts to chatbot escalation patterns as soon as characters start talking.

## Conclusion

The `SIGNATURE_VOICE_BLOCK` produced a **marginal, possibly noise-level** improvement in the thriller genre. The one clear win — filter verb reduction — is counterbalanced by increased symmetrical pairs, a new thesis statement, and zero improvement in "not just" patterns. The model's base Modelfile already produces 84-grade prose for thrillers; the additional prompt rules do not meaningfully push it higher.

**Raw text:** [thriller-version-a.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/thriller-version-a.txt) | [thriller-version-b.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/thriller-version-b.txt)
