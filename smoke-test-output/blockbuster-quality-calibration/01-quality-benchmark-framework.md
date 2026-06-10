# Quality Benchmark Framework — v2.0 (Anti-Chatbot Hardening)

## Executive Summary

UBS now includes an **Anti-Chatbot Prose Module** (`antiChatbotProse.js`) providing four components:

| Component | Purpose | Status |
|---|---|---|
| `SIGNATURE_VOICE_BLOCK` | Prompt injection with editorial anti-chatbot rules | ✅ Wired into every fiction/nonfiction prompt |
| `analyzeProseTexture()` | Deterministic post-generation prose texture scorer | ✅ Available for scoring |
| `countChatbotPatterns()` | Pattern-level chatbot detection and counting | ✅ Available for diagnostics |
| `POLISHER_ANTI_CHATBOT_RULES` | Polish-pass anti-chatbot enforcement | ✅ Wired into prose polisher |

**Prior Framework Status**: All 7 universal prose quality blocks were empty strings (Phase 3 migration to Modelfiles). `HUMAN_PROSE_PRIORITY_BLOCK` has been **re-activated** with the Signature Voice rules — portable across any LLM provider.

---

## Scoring Methodology

### Dual-Score Model

| Component | Weight | Source | Calibration Status |
|---|---|---|---|
| Programmatic Score | 40% | `aiSlopReduction` density + `analyzeProseTexture` composite | ✅ Calibrated (deterministic) |
| LLM Score | 60% | `publishing-critic` agent evaluation | ❌ **Uncalibrated** — no anchor against published prose |
| Combined Score | 100% | Weighted blend | ⚠️ Inflated by uncalibrated LLM |

> **WARNING**: Until the LLM scorer is calibrated against published prose anchors, Combined Scores are unreliable. Programmatic scores should be treated as the honest signal.

### Grade Bands

| Band | Score | Meaning |
|---|---|---|
| EXCELLENT | 85+ | Publishable with minimal editorial intervention |
| GOOD | 70–84 | Competitive with midlist commercial fiction |
| COMPETENT | 55–69 | Functional but identifiable as AI-assisted |
| CHATBOT_ADJACENT | 40–54 | Obvious AI cadence, generic voice |
| CHATBOT_SLOP | <40 | Raw chatbot output, no editorial control |

---

## Anti-Chatbot Metrics (from `analyzeProseTexture`)

| Metric | What It Measures | Target | Chatbot Typical |
|---|---|---|---|
| Sentence Length Variance | σ of word counts per sentence | σ ≥ 8 | σ 3–5 |
| Symmetry Score | % of consecutive sentence pairs with similar length | ≤ 30% | 50–70% |
| Filter Verb Density | felt/seemed/appeared/noticed/realized per 1K words | ≤ 5 | 12–20 |
| Concrete/Abstract Ratio | Ratio of physical nouns to abstract emotion nouns | ≥ 0.6 | 0.2–0.4 |
| Opening Verb Strength | First clause verb: active vs. state | Active | State (was/felt) |
| Ending Punch | Last sentence shorter than paragraph average | Yes | No (summary ending) |
| Triple Construction Density | "X, Y, and Z" emotional triples per 1K words | ≤ 3 | 6–10 |
| Thesis Statement Density | "The truth was..." / "In that moment..." per 1K words | ≤ 1 | 3–6 |
| "Not Just" Density | "wasn't just X; it was Y" per 1K words | ≤ 1 | 4–8 |
| Balanced Reflection Count | "Part of her wanted X. Another part wanted Y." | 0 | 2–4 |
| Generic Emotion Density | "a wave of / surge of / sense of" per 1K words | ≤ 2 | 5–10 |

---

## Prose Quality Pipeline Layers

| Layer | Stage | Component | Status |
|---|---|---|---|
| 1 | Generation | `SIGNATURE_VOICE_BLOCK` (via `HUMAN_PROSE_PRIORITY_BLOCK`) | ✅ Active |
| 2 | Generation | `buildNoSlopBlock()` + `buildManuscriptPurityBlock()` | ✅ Active |
| 3 | Generation | `ANTI_REPETITION_RULES` via `chapterCohesion.js` | ✅ Active |
| 4 | Post-generation | `aiSlopReduction` deterministic pass | ✅ Active |
| 5 | Polish | `POLISHER_ANTI_CHATBOT_RULES` in polish system prompt | ✅ Active |
| 6 | Validation | `validatePolisherOutput()` guardrails | ✅ Active |
| — | Generation | `MANDATORY_ENFORCEMENT_BLOCK` | ❌ Empty (Phase 3) |
| — | Generation | `COMPACT_CRAFT_RULES` | ❌ Empty (Phase 3) |
| — | Generation | `COMPACT_ANTI_SLOP` | ❌ Empty (Phase 3) |
| — | Generation | `ANTI_DETECTION_PROSE_RULES` | ❌ Empty (Phase 3) |
| — | Generation | `NONFICTION_HARD_RULES` | ❌ Empty (Phase 3) |
| — | Generation | `NONFICTION_NARRATIVE_CRAFT` | ❌ Empty (Phase 3) |

---

## Fiction Rubric (12 categories, 100 points)

| Category | Weight | Description |
|---|---|---|
| Hook | 10 | Does the opening line/paragraph compel continued reading? |
| Immediacy | 8 | Is the reader dropped into scene or told about it? |
| Desire | 7 | Does the protagonist want something concrete and urgent? |
| Voice | 10 | Is the prose voice distinctive, genre-appropriate, and consistent? |
| Polish | 10 | Sentence-level craft: rhythm, precision, zero slop |
| GenreFit | 8 | Does the prose feel like it belongs on the target shelf? |
| Pacing | 10 | Does pressure change every paragraph? Scene momentum? |
| Emotion | 8 | Is emotion earned through action/subtext, not declared? |
| Dialogue | 8 | Does dialogue reveal character, advance plot, contain subtext? |
| Specificity | 7 | Concrete nouns, named brands, precise sensory detail? |
| Ending | 7 | Does the chapter end on image/action/tension, not lesson? |
| Marketability | 7 | Would this sell in the current market? |

## Nonfiction Rubric (12 categories, 100 points)

| Category | Weight | Description |
|---|---|---|
| Thesis | 10 | Is the central argument clear, specific, and defensible? |
| Authority | 8 | Does the prose demonstrate subject expertise? |
| Structure | 8 | Does each section advance the argument logically? |
| Evidence | 10 | Are claims supported by specific, verifiable sources? |
| Accessibility | 7 | Can a non-expert reader follow the argument? |
| Voice | 10 | Is the authorial voice distinctive and appropriate? |
| Polish | 10 | Sentence-level craft: precision, zero slop |
| Flow | 8 | Do paragraphs transition smoothly? |
| Specificity | 7 | Named sources, dates, institutions, data points? |
| Opening | 7 | Does the first paragraph earn continued reading? |
| Closing | 7 | Does the section end with escalation, not summary? |
| Trade Appeal | 8 | Would a general-interest reader buy this? |

---

## Known Gaps (Honest Assessment)

1. **6 craft constants remain empty** — Phase 3 migration to Modelfiles means prose quality outside `SIGNATURE_VOICE_BLOCK` depends on the model's baked-in system prompt
2. **LLM scorer is uncalibrated** — No anchor against published prose means LLM scores inflate Combined Scores by ~10 points
3. **No live A/B comparison** — UBS output has not been compared against raw chatbot output on identical premises
4. **Model compliance uncertain** — The model may ignore `SIGNATURE_VOICE_BLOCK` rules under prompt pressure or context window limits
5. **No per-paragraph scoring** — `analyzeProseTexture()` scores full output, not individual paragraphs
