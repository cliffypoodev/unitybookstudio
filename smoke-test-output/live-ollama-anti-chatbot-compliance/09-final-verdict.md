# 09 — Final Verdict: Live Ollama Anti-Chatbot Compliance

## Verdict: PARTIAL PASS

---

## Score Summary

| Genre | Version A | Version B | Delta | Chatbot Patterns | Pattern Delta |
|---|---|---|---|---|---|
| Commercial Thriller | 84 (GOOD) | 85 (EXCELLENT) | **+1** | 24 → 26 | +2 WORSE |
| Literary/Speculative | 74 (GOOD) | 80 (GOOD) | **+6** | 29 → 21 | −8 BETTER |
| Narrative Nonfiction | 80 (GOOD) | 63 (COMPETENT) | **−17** | 15 → 19 | +4 WORSE |
| **Average** | **79.3** | **76.0** | **−3.3** | **22.7 → 22.0** | **−0.7** |

The average composite score *decreased* by 3.3 points. The average chatbot pattern reduction is 0.7 — essentially zero. The `SIGNATURE_VOICE_BLOCK` produced a net negative result across the three genres tested.

## Why Not PASS

### 1. Nonfiction Regression (−17 composite)

A 17-point regression is not marginal. Version B nonfiction dropped from GOOD to COMPETENT. Every metric worsened:
- Filter verbs nearly tripled (2.1 → 5.7/1K)
- "Not just" doubled (1 → 2)
- Concrete ratio fell (33% → 25%)
- Word count collapsed 27% (965 → 706)
- Chatbot patterns increased (15 → 19)

The fiction-oriented rules in the `SIGNATURE_VOICE_BLOCK` actively confused the model for nonfiction output. The model traded data precision for atmospheric decoration, producing prose that is worse by every available measure.

**Evidence:** Version A presents the 23-point gap with clean data: *"The numbers confirmed his deepest suspicion: on average, the candidates from those nine lower-income neighborhoods scored approximately 23 percentile points lower."* Version B buries the same finding: *"Their average simulated score bled out a quantifiable deficit."* The rules made nonfiction worse.

### 2. Drift Problem (−22 literary, ~400-word half-life)

The literary sample — the best result — degrades from 87 (EXCELLENT) to 65 (COMPETENT) over ~1,000 words. The model follows the rules for approximately 300–400 words, then progressively reverts to its default cadence.

For a book-writing application generating scenes of 1,200–3,000 words, this means prompt-injected rules are effective for roughly the first third of any given passage. For full chapters (5,000–10,000 words), the rules are essentially decorative after the opening paragraphs.

**Evidence:** Literary B opening: *"The waiting room smelled like burned ozone and stale disinfectant"* (87 score, zero "not just"). Literary B ending: *"Elena felt her entire body stiffen, suddenly aware of the weight of every unsaid memory pressing against her ribs"* (65 score, 3.4/1K "not just"). Same generation, same rules, opposite quality.

### 3. "Not Just" Ban — Complete Failure Across All Genres

The `SIGNATURE_VOICE_BLOCK` explicitly bans "not just X — but Y" constructions. The model ignored this rule entirely:

| Genre | Version A | Version B |
|---|---|---|
| Thriller | 3 instances | 3 instances |
| Literary | 1 instance | 2 instances |
| Nonfiction | 1 instance | 2 instances |
| **Total** | **5** | **7** |

The total count *increased* from 5 to 7 across all genres. The "MANDATORY" ban had the opposite effect. This construction is deeply embedded in the model's weights and cannot be removed by system-prompt-level instruction.

## Why Not CONDITIONAL PASS

A conditional pass would imply the `SIGNATURE_VOICE_BLOCK` is close to working and needs minor tuning. The data does not support this:

1. **The improvement is marginal even in fiction.** Thriller: +1 composite (noise-level). Literary: +6 composite (real but modest). The Modelfile already produces 74–84 quality prose without the SIGNATURE_VOICE_BLOCK.

2. **The failure is structural, not parametric.** The nonfiction regression and the drift problem are not fixable by tweaking rule wording. They require architectural changes: genre-conditional rules, post-generation recast loops, or multi-pass generation.

3. **The base model is the real quality driver.** All six samples (both A and B) scored 63–85 — far higher than the hand-crafted baseline samples used in the test suite (36–43). The ghostwriter Modelfile's embedded prose quality rules, not the app-level SIGNATURE_VOICE_BLOCK, are responsible for this quality level.

## What Worked

To be fair, the `SIGNATURE_VOICE_BLOCK` produced real, measurable improvements in specific areas:

| Improvement | Genre | Evidence |
|---|---|---|
| Opening verb strength | Literary | weak → strong ("was designed" → "smelled") |
| Filter verb reduction | Thriller | 6.1 → 3.6/1K |
| Symmetry reduction | Literary | 29% → 15% |
| Generic emotion elimination | Literary | 0.9 → 0/1K |
| Pattern count reduction | Literary | 29 → 21 (−8) |

These are real gains. But they are concentrated in one genre (literary fiction) and in the opening ~400 words of the generation.

## Recommendations

### 1. Genre-Conditional SIGNATURE_VOICE_BLOCK

The current block applies the same fiction-oriented rules to all genres. It needs at minimum two variants:

- **Fiction rules:** Current rules (fragments, sensory details, subtext, genre texture) — effective for thriller and literary.
- **Nonfiction rules:** Data precision, clean declarative sentences, let numbers carry weight, no decorative imagery, no atmospheric scene-setting that delays the argument.

### 2. Post-Generation Recast Loop

Prompt injection alone has a ~400-word half-life. For sustained compliance, implement a two-step process:

1. Generate the prose with the Modelfile's existing quality.
2. Run `analyzeProseTexture()` on the output.
3. If the score falls below a threshold, send a targeted recast prompt addressing only the specific violations detected (e.g., "The middle section contains 3 'not just' constructions. Recast these as direct statements.").

This second pass should use the `POLISHER_ANTI_CHATBOT_RULES` already defined in the module.

### 3. Accept the Modelfile as Primary Quality Driver

The ghostwriter Modelfile produces 74–84 composite quality prose *without* the `SIGNATURE_VOICE_BLOCK`. The marginal improvement from system prompt rules (+1 to +6 in fiction, −17 in nonfiction) does not justify the complexity and regression risk. Consider:

- Using the Modelfile as the primary quality mechanism.
- Reserving the `SIGNATURE_VOICE_BLOCK` for a post-generation polishing pass only, not injection into the generation prompt.
- Investing engineering effort into the Modelfile's own prose rules rather than duplicating quality logic at the application layer.

### 4. Two-Pass Architecture

Generate → Score → Polish. Do not try to prevent chatbot patterns during generation (prompt injection). Instead:

1. **Generate:** Use the Modelfile's quality, producing 74–84 grade prose naturally.
2. **Score:** Run `analyzeProseTexture()` and `countChatbotPatterns()` on the output.
3. **Polish:** If violations exceed thresholds, send the text through a polishing pass with `POLISHER_ANTI_CHATBOT_RULES` targeting only the detected violations.

This separates the creative generation (where the model should be free to write) from the quality enforcement (where specific patterns can be surgically corrected).

---

## Data References

| Report | File |
|---|---|
| Methodology | [01-live-ollama-method.md](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/01-live-ollama-method.md) |
| Thriller Analysis | [02-thriller-live-generation-report.md](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/02-thriller-live-generation-report.md) |
| Literary Analysis | [03-literary-speculative-live-generation-report.md](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/03-literary-speculative-live-generation-report.md) |
| Nonfiction Analysis | [04-narrative-nonfiction-live-generation-report.md](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/04-narrative-nonfiction-live-generation-report.md) |
| Compliance Metrics | [05-model-compliance-metrics.md](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/05-model-compliance-metrics.md) |
| Drift Report | [06-drift-and-longform-stability-report.md](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/06-drift-and-longform-stability-report.md) |
| Overcorrection Report | [07-overcorrection-and-readability-report.md](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/07-overcorrection-and-readability-report.md) |
| Regression/Build Report | [08-regression-and-build-report.md](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/08-regression-and-build-report.md) |
| Raw Results | [live-bakeoff-results.json](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/live-bakeoff-results.json) |
| Thriller A/B | [thriller-version-a.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/thriller-version-a.txt) / [thriller-version-b.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/thriller-version-b.txt) |
| Literary A/B | [literary-version-a.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/literary-version-a.txt) / [literary-version-b.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/literary-version-b.txt) |
| Nonfiction A/B | [nonfiction-version-a.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/nonfiction-version-a.txt) / [nonfiction-version-b.txt](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/nonfiction-version-b.txt) |

---

*Report generated 2026-06-09. Model: ghostwriter (Ollama). Module: antiChatbotProse.js v1.0.*
