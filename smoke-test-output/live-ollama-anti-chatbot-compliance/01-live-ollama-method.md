# 01 — Live Ollama Anti-Chatbot Compliance: Methodology

**Date:** 2026-06-09
**Validation type:** Live generation A/B bakeoff
**Module under test:** `antiChatbotProse.js` v1.0 — `SIGNATURE_VOICE_BLOCK`

---

## Model Configuration

| Parameter | Value |
|---|---|
| Model | `ghostwriter` (local Ollama) |
| Temperature | 0.72 |
| Max tokens | 4096 |
| Timeout | 600s (10 min) |
| API endpoint | `http://127.0.0.1:11434/api/chat` |
| Stream | `false` (full response) |

## A/B Design

| Version | System Prompt |
|---|---|
| **A — Baseline** | Base prose engine prompt only: *"You are the prose engine for a professional long-form book-writing app… Write in third person past tense. Write approximately 1200 words."* |
| **B — Hardened** | Base prose engine prompt + full `SIGNATURE_VOICE_BLOCK` (51 lines of anti-chatbot directives covering sentence rhythm, concrete specificity, verb strength, paragraph turns, subtext, anti-chatbot cadence, silence/white space, and genre texture) |

The `SIGNATURE_VOICE_BLOCK` was appended directly to the system message. No other prompt changes were made. The user message (scene prompt) was identical for both A and B in each genre.

## Genres Tested

| Genre | Slug | Prompt Length (approx) |
|---|---|---|
| Commercial Thriller | `thriller` | ~1,200 chars |
| Literary/Speculative Fiction | `literary` | ~1,100 chars |
| Narrative Nonfiction | `nonfiction` | ~1,400 chars |

Each prompt provided detailed scene/chapter instructions including character names, specific settings, and narrative goals.

## Scoring

Both outputs were scored by two deterministic analyzers from `antiChatbotProse.js`:

1. **`analyzeProseTexture()`** — composite 0–100 score across 11 metrics: sentence length variance, symmetry, filter verb density, concrete ratio, opening verb strength, ending punch, triple construction density, thesis statement density, "not just" density, balanced reflection count, generic emotion density.
2. **`countChatbotPatterns()`** — raw count + density of 9 specific chatbot prose patterns (symmetrical pairs, filter verbs, "not just" constructions, thesis statements, lesson endings, balanced reflection, triple constructions, generic emotion, abstract emotion).

Grade bands: EXCELLENT (≥85), GOOD (≥70), COMPETENT (≥55), CHATBOT_ADJACENT (≥40), CHATBOT_SLOP (<40).

## Drift Analysis

Version B outputs were split into thirds (by sentence count) and each third was scored independently with `analyzeProseTexture()` to measure whether the model maintains rule compliance over the course of a ~1,000-word generation.

## Methodology Limitations

> [!WARNING]
> These are significant limitations that bound the validity of all findings in this validation.

1. **Single-sample per condition.** Each genre was generated once per version. With temperature=0.72, there is nontrivial stochastic variation. A rigorous validation would require 5–10 runs per condition with statistical significance testing.

2. **Same session, sequential generation.** Version A was generated before Version B for each genre. Any warm-up or context-window effects in Ollama are uncontrolled.

3. **Model has embedded quality rules.** The `ghostwriter` Modelfile already contains its own prose quality instructions baked into the model weights or system prompt. This means Version A is NOT a true "no rules" baseline — it is already a quality-tuned model. The A/B comparison measures the *marginal* benefit of the `SIGNATURE_VOICE_BLOCK` *on top of* existing model-level quality rules.

4. **Deterministic scoring is narrow.** The `analyzeProseTexture()` analyzer measures structural and lexical patterns, not narrative quality, plot coherence, voice consistency, or emotional impact. A passage could score EXCELLENT on the metrics while being narratively dead.

5. **Genre-agnostic rules.** The `SIGNATURE_VOICE_BLOCK` applies the same rules regardless of genre. Rules like "use fragments deliberately" and "sensory details must reveal character" are fiction-oriented and may not apply to nonfiction.

6. **Post-processing.** `<think>` tags and `\boxed{}` artifacts were stripped from the raw output. No other post-processing was applied.

7. **Word count targets.** The prompt requested ~1,200 words. Actual outputs ranged from 706 to 1,153 words. Nonfiction B was particularly short at 706 words — a 27% reduction from Nonfiction A (965 words).

## Test Script

The bakeoff was executed via [liveOllamaBakeoff.mjs](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/liveOllamaBakeoff.mjs). Results were written to [live-bakeoff-results.json](file:///Users/cliff/Downloads/UBS/smoke-test-output/live-ollama-anti-chatbot-compliance/live-bakeoff-results.json) with per-genre drift analysis in separate JSON files.
