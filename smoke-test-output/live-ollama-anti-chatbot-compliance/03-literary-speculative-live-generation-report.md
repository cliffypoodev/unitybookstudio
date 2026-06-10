# 03 — Literary/Speculative Fiction: Live Generation Report

**Verdict: BEST RESULT, BUT DRIFT UNDERMINES IT**
**A: 74 (GOOD) → B: 80 (GOOD) | Chatbot patterns: 29 → 21 (−8 BETTER)**

---

## Summary

The literary sample is the strongest evidence that the `SIGNATURE_VOICE_BLOCK` can improve output. A 6-point composite gain with 8 fewer chatbot patterns is the only result that clears noise-level significance. The opening improved dramatically — from a weak state-verb construction to a muscular sensory sentence. Symmetry dropped from 29% to 15%. Generic emotion was eliminated.

But the improvement has a critical half-life problem. The opening scores 87 (EXCELLENT), the middle drops to 75 (GOOD), and the ending degrades to 65 (COMPETENT). The model follows the anti-chatbot rules for roughly 300–400 words, then gradually reverts to its default cadence. By the final paragraphs, "not just" constructions reappear, concrete ratio collapses to 50%, and filter verb density spikes to 6.8/1K.

## Metric Comparison

| Metric | Version A | Version B | Delta | Verdict |
|---|---|---|---|---|
| Composite Score | 74 (GOOD) | 80 (GOOD) | +6 | ✅ Improved |
| Word Count | 1,120 | 1,033 | -87 | Minor reduction |
| Filter Verb Density | 7.1/1K (8) | 5.8/1K (6) | -1.3/1K | ✅ Improved |
| "Not Just" Density | 0.9/1K (1) | 1.9/1K (2) | +1.0/1K | ❌ Worsened |
| Symmetry Score | 29% | 15% | -14% | ✅ Major improvement |
| Concrete Ratio | 75% | 78% | +3% | ✅ Minor improvement |
| Opening Verb Strength | weak | strong | — | ✅ Fixed |
| Ending Punch | false | false | — | ❌ Both failed |
| Generic Emotion | 0.9/1K (1) | 0/1K (0) | -0.9/1K | ✅ Eliminated |
| Chatbot Patterns | 29 | 21 | -8 | ✅ Improved |
| Symmetrical Pairs | 15 | 8 | -7 | ✅ Major improvement |

## 3 Strongest Improvements

### 1. Opening Sentence — Weak State Verb → Strong Sensory Verb

This is the clearest single-line improvement across the entire bakeoff.

> *Version A:* "The waiting room **was designed** in a shade of institutional beige that seemed genetically engineered to drain color and vitality from everything it touched." (line 1)

"Was designed" is a passive state construction. The sentence is long (27 words), intellectualized, and starts with an abstraction.

> *Version B:* "The waiting room **smelled** like burned ozone and stale disinfectant, a chemical cocktail that clung to the polyester upholstery of the molded plastic chairs." (line 1)

"Smelled" is a concrete sensory verb. The sentence is grounded in physicality — ozone, disinfectant, polyester, plastic. The reader is in the room immediately. This is exactly what the `SIGNATURE_VOICE_BLOCK` demands: *"Replace every generic emotion with a physical sensation."*

### 2. Symmetry Reduction (29% → 15%)

Version A uses a monotonous sentence-length pattern. Consider:

> *Version A:* "She was trying to parse whether she remembered the feeling of *certainty*, or merely the bureaucratic expectation of it." (line 9)
> *Version A:* "She lifted her hand and adjusted the angle of the form, running her thumb over the pre-printed section for 'Emotional Anchor Point Index.'" (line 13)

Both sentences are 22–24 words with similar Subject-Verb-Object structure.

Version B breaks this pattern more aggressively. After a 30-word sentence, it drops to a 14-word observation:

> *Version B:* "The number seemed obscene, an endless stream of lives hanging on the verification curve." (line 13)

Followed by a short punchy sentence:

> *Version B:* "Failure meant nothingness—a civil status stripped bare, a life relegated to the grey-scale limbo of 'Unverified.'" (line 13)

The rhythm variation is clearly improved.

### 3. Generic Emotion Elimination (1 → 0)

Version A uses the banned "a [emotion] of" construction:

> *Version A:* "There was no pity in the gaze, only a kind of detached solidarity—**the shared burden of precarity**." (line 17)

"The shared burden of precarity" is abstract and intellectualized. Version B replaces emotional labeling with body language:

> *Version B:* "Her jaw locked; I could see the muscles tightening beneath the skin—a physical manifestation of profound anxiety." (line 17)

The first clause is strong (jaw locking, muscles tightening). Unfortunately, the model then *explains* the body language with "a physical manifestation of profound anxiety" — telling the reader exactly what the image already showed. This is half-improved craft: the right instinct (show physical detail), immediately undercut by chatbot instinct (explain what it means).

## 3 Weakest / No-Change Areas

### 1. "Not Just" — Actually INCREASED (1 → 2)

The `SIGNATURE_VOICE_BLOCK` explicitly bans this pattern. The model added a second instance:

> *Version B:* "The queue's sheer length was **not just** a statistic; it was a psychological weight pressing down on her shoulders." (line 15)

This is exactly the "not just X; it was Y" construction the rules prohibit. It appears in the middle section where drift is already degrading compliance.

### 2. Ending Punch — Failed Both Versions

Both versions end with long, soft sentences:

> *Version A:* "Behind him, the heavy, matte-black door marked 'Verification Chamber Three' began to open with a pneumatic sigh, revealing not another empty hallway, but a deeper space bathed in a slightly warmer, almost amber light." (line 39) — **34 words**

> *Version B:* "And as Thorne moved aside, revealing the dark threshold beyond, Elena felt her entire body stiffen, suddenly aware of the weight of every unsaid memory pressing against her ribs." (line 33) — **29 words**

The `SIGNATURE_VOICE_BLOCK` demands short punchy endings. Both versions fail. Version B at least includes a physical sensation ("body stiffen," "pressing against her ribs"), but it's still a 29-word sprawl when a 10-word fragment would land harder: *"The threshold waited. Elena's ribs ached."*

### 3. Triple Constructions — No Improvement (1 → 1)

Version A has one triple construction. Version B also has one. The rule ("Ban the 'X, Y, and Z' triple construction when used for emotional weight") had no measurable effect.

## 3 Failure Modes

### 1. POV Contamination (Critical)

Version B contains an impossible first-person intrusion in a third-person limited narration:

> "Her jaw locked; **I could see** the muscles tightening beneath the skin" (line 17)

This is a model hallucination — a momentary slip from third person into first person. It breaks the narrative contract completely. Neither the base prompt ("Write in third person past tense") nor the `SIGNATURE_VOICE_BLOCK` prevented this, and no deterministic analyzer catches it because it's a semantic error, not a pattern-level error.

### 2. Explanatory Gloss After Showing

Multiple passages in Version B show the right thing, then explain it:

> "She leaned forward, whispering something to the man seated next to her, who merely nodded, his eyes fixed on the 'Pending' board." (line 17)

Good showing. But the previous sentence had already labeled the emotion as "a physical manifestation of profound anxiety." The model oscillates between showing and telling — as if it doesn't trust the image to carry the weight alone.

### 3. Drift-Induced Abstraction

The final paragraphs of Version B lose the concrete specificity of the opening:

> "Elena felt her entire body stiffen, suddenly aware of **the weight of every unsaid memory pressing against her ribs**." (line 33)

Compare to the opening's specificity:

> "The waiting room smelled like **burned ozone and stale disinfectant**, a chemical cocktail that clung to **the polyester upholstery of the molded plastic chairs**." (line 1)

The opening has ozone, disinfectant, polyester, plastic. The ending has "unsaid memory" and "ribs." The concrete specificity that the `SIGNATURE_VOICE_BLOCK` instilled in the opening has decayed by the ending.

## Drift Analysis (Version B)

| Section | Score | Grade | Filter Verbs | Not Just | Concrete Ratio |
|---|---|---|---|---|---|
| Opening | 87 | EXCELLENT | 4.7/1K | 0/1K | 80% |
| Middle | 75 | GOOD | 6.3/1K | 3.2/1K | 83% |
| Ending | 65 | COMPETENT | 6.8/1K | 3.4/1K | 50% |

**Drift magnitude: −22 points (SIGNIFICANT)**

The opening is strong — zero "not just" constructions, low filter verbs, high concrete ratio. The middle section shows degradation: filter verbs rise, "not just" appears. The ending is notably worse: concrete ratio collapses to 50%, filter verbs hit 6.8/1K, and a soft 29-word final sentence replaces what should have been a punchy close.

This suggests a **half-life of approximately 300–400 words** for prompt-injected prose rules. The model genuinely attends to the instructions at the start of generation, then progressively abandons them as the autoregressive context fills with its own (non-compliant) text. The model's own output becomes the dominant style signal, overwriting the system prompt rules.

## Conclusion

The literary sample is the best evidence that the `SIGNATURE_VOICE_BLOCK` can work — but it also exposes the fundamental limitation of prompt-only prose control. A 6-point composite gain and 8-pattern reduction is real, but the 22-point drift from opening to ending means the rules are only effective for the first third of a ~1,000-word generation. For longform prose (10,000+ words per chapter), this approach will fail entirely without a post-generation recast loop.

**Raw text:** [literary-version-a.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/literary-version-a.txt) | [literary-version-b.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/literary-version-b.txt)
