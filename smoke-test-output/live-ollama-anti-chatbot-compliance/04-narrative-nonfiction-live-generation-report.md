# 04 — Narrative Nonfiction: Live Generation Report

**Verdict: FAILURE (−17 composite)**
**A: 80 (GOOD) → B: 63 (COMPETENT) | Chatbot patterns: 15 → 19 (+4 WORSE)**

---

## Summary

The narrative nonfiction sample is an unambiguous failure. Version B — the one with the `SIGNATURE_VOICE_BLOCK` — scored 17 points *lower* than the baseline Version A. Every key metric either regressed or stayed flat. Filter verb density nearly tripled (+3.6/1K). "Not just" constructions doubled. Symmetry worsened. Concrete ratio dropped. Word count fell 27%. Chatbot patterns increased by 4.

This is not marginal. This is the `SIGNATURE_VOICE_BLOCK` actively *harming* the output for this genre.

## Metric Comparison

| Metric | Version A | Version B | Delta | Verdict |
|---|---|---|---|---|
| Composite Score | 80 (GOOD) | 63 (COMPETENT) | **−17** | ❌ REGRESSION |
| Word Count | 965 | 706 | **−259 (−27%)** | ❌ Severe drop |
| Filter Verb Density | 2.1/1K (2) | 5.7/1K (4) | **+3.6/1K** | ❌ Nearly tripled |
| "Not Just" Density | 1.0/1K (1) | 2.8/1K (2) | **+1.8/1K** | ❌ Doubled |
| Thesis Statement Density | 0/1K | 0/1K | 0 | Stable |
| Symmetry Score | 17% | 23% | **+6%** | ❌ Worsened |
| Concrete Ratio | 33% | 25% | **−8%** | ❌ Worsened |
| Sentence Length Variance | 11.0 | 9.8 | −1.2 | ❌ Reduced |
| Opening Verb Strength | weak | weak | — | ❌ No fix |
| Ending Punch | true | false | — | ❌ Lost |
| Triple Construction Density | 1.0/1K (1) | 2.8/1K (2) | **+1.8/1K** | ❌ Doubled |
| Chatbot Patterns (total) | 15 | 19 | **+4** | ❌ Worsened |
| Abstract Emotion | 2 | 3 | +1 | ❌ Worsened |

> [!CAUTION]
> There is not a single metric in which Version B outperformed Version A. This is a complete regression.

## What Went Wrong: The Genre Mismatch

The `SIGNATURE_VOICE_BLOCK` is fiction-optimized prose guidance. Its rules assume narrative prose with characters, scenes, dialogue, and emotional arcs. Consider what it demands:

- *"Use fragments deliberately: 'Not anymore.' 'Gone.'"* — Fragments are inappropriate in data-driven investigative nonfiction.
- *"Sensory details must be earned — each one should reveal character, mood, or tension."* — Nonfiction needs to present facts, not moods.
- *"Characters should say less than they mean."* — There are no characters in a nonfiction chapter about an algorithm.
- *"Genre texture… a thriller should have velocity and edge."* — The nonfiction prompt asked for Michael Lewis / Charles Duhigg style, which is measured and explanatory, not edgy.

The model, receiving contradictory instructions (the user prompt says "data-driven, specific, authoritative" while the system prompt says "fragments, sensory details, subtext"), compromised by producing text that is *neither* good nonfiction *nor* good fiction.

## Paragraph-Level Evidence of Regression

### Opening Paragraph Comparison

**Version A** opens with clean, confident nonfiction exposition:

> "David Hernandez sat in a chair that had seen better days, surrounded by the faint, institutional scent of recycled air and stale coffee. His desk at Delaney & Associates was less an office space and more a staging ground for discovery. He wasn't looking for malpractice; he was supposed to be optimizing the user experience for Milwaukee's centralized hiring platform—a system so massive it processed nearly fifty thousand applications annually across twelve major municipal employers, from the Fire Department to Public Works." (line 1)

This is classic trade nonfiction scene-setting. Specific numbers (50,000 applications, 12 employers). Concrete institutional detail. The "staging ground for discovery" metaphor is clean. The prose serves the information.

**Version B** tries to be literary instead:

> "The corner of David Hernandez's mahogany desk was littered with discarded printouts: payroll reports, preliminary audit checklists, and four coffee-stained mugs holding the residue of caffeine jitters. He slid a finger across the top sheet—a stack of CivicMetrics documentation—and leaned back in his ergonomic chair, letting the squeak of the caster wheels fill the momentary void. The air conditioning unit hummed, a steady, low thrumming sound that seemed to measure time itself." (line 1)

The SIGNATURE_VOICE_BLOCK's sensory detail rules produced "four coffee-stained mugs holding the residue of caffeine jitters" — decorative inventory that doesn't advance the chapter's argument. "The squeak of the caster wheels fill the momentary void" and "a steady, low thrumming sound that seemed to measure time itself" are atmospheric flourishes borrowed from fiction prose. In a Charles Duhigg book, these would be cut immediately. They delay the reader from reaching the data.

### The Data Presentation Degradation

**Version A** presents the algorithm discovery methodically:

> "He began by mapping the scoring formula. The algorithm wasn't a simple average; it was a complex, multi-variable regression model. The weights assigned to each input were critical. Of course, experience and education received standard, expected weightings. But then there were the non-traditional variables: `score_credit`, weighted at 0.18; `score_zip`, perhaps the heaviest hitter at 0.25; and the composite score derived from social media activity, `score_social`, pegged at 0.15." (line 7)

Specific variable names. Specific weights. The prose is serving the data. This is exactly what the prompt asked for.

**Version B** blurs the data behind atmospheric language:

> "David opened the weight matrix file. The numbers were staggering, far exceeding what any municipal HR department should reasonably demand. He found that the algorithm gave undue heft—actual mathematical muscle—to peripheral factors. The weights for zip code proximity to major transit arteries carried an alarming coefficient; the predictive power of a high FICO score seemed weighted nearly equal to a degree in public administration." (line 7)

"Actual mathematical muscle" is a metaphor that obscures rather than illuminates. "An alarming coefficient" tells the reader to be alarmed without giving them the number. Where Version A says "0.25," Version B says "alarming." Where Version A names the variable (`score_zip`), Version B paraphrases ("zip code proximity to major transit arteries"). The SIGNATURE_VOICE_BLOCK's rule to replace generic nouns with specific ones should have *improved* this — but instead, the model interpreted the fiction-oriented rules as permission to be atmospheric rather than precise.

### The 23-Point Gap — Data vs. Atmosphere

**Version A** delivers the key finding with devastating precision:

> "The numbers confirmed his deepest suspicion: on average, the candidates from those nine lower-income neighborhoods scored approximately 23 percentile points lower than applicants with identical educational achievements and professional experience who lived in the North Shore suburbs." (line 23)

Clean. Direct. The number carries the weight.

**Version B** buries the same finding in emotional language:

> "Their average simulated score bled out a quantifiable deficit. The data gap was precise, stark, and unforgiving: an average of twenty-three percentile points lower than candidates from the North Shore suburbs who possessed identical certifications and work duration." (line 11)

"Bled out a quantifiable deficit" is purple prose applied to data presentation. "Precise, stark, and unforgiving" is a triple construction — the exact chatbot pattern the rules prohibit. The SIGNATURE_VOICE_BLOCK caused the model to wrap clean data in decorative language.

### Word Count Collapse

Version A: 965 words. Version B: 706 words. A 27% reduction.

The nonfiction prompt asked for the opening section of a chapter — substantial, detailed exposition. Version B is too short. It omits several analytical steps that Version A includes (the systematic zeroing-out of variables, the comparison group analysis). The model appears to have spent its token budget on atmospheric description rather than data presentation, running out of space for the analytical content that nonfiction demands.

## Drift Analysis (Version B)

| Section | Score | Grade | Filter Verbs | Not Just | Concrete Ratio |
|---|---|---|---|---|---|
| Opening | 60 | COMPETENT | 7.3/1K | 3.7/1K | 0% |
| Middle | 61 | COMPETENT | 5.2/1K | 0/1K | 0% |
| Ending | 69 | COMPETENT | 4.2/1K | 4.2/1K | 50% |

**Drift magnitude: −9 (inverted — ending better than opening)**

Ironically, the nonfiction sample shows *negative* drift — the ending is better than the opening. This makes sense: the opening, where the SIGNATURE_VOICE_BLOCK's fiction rules have the most influence, produces the worst score (60). As the model drifts away from the fiction-oriented rules and returns to its natural nonfiction cadence, the score actually improves to 69.

The 0% concrete ratio in the opening and middle sections is damning. The prose has no concrete sensory words in the first two-thirds because nonfiction about algorithms doesn't naturally contain words like "cracked," "rusted," "damp," or "leather." The analyzer penalizes for this, but it's a category error — the concrete ratio metric is calibrated for fiction, not expository nonfiction.

## Conclusion

The narrative nonfiction sample proves that the `SIGNATURE_VOICE_BLOCK` needs **genre-conditional logic**. Fiction-oriented rules (fragments, sensory details, subtext, genre texture) actively confuse the model when applied to data-driven nonfiction. Every metric regressed. The model traded precision for atmosphere, data for decoration, and clarity for chatbot-adjacent literary pretension.

This is not a tuning problem. This is a design failure. The `SIGNATURE_VOICE_BLOCK` must either:
1. Detect genre and apply different rule sets, or
2. Be restricted to fiction-only prompts, or
3. Include explicit nonfiction carve-outs (e.g., "For nonfiction: let data carry the weight. Avoid decorative imagery that obscures facts.")

**Raw text:** [nonfiction-version-a.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/nonfiction-version-a.txt) | [nonfiction-version-b.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/nonfiction-version-b.txt)
