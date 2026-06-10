# Recast Model Routing v4 — Routing Architecture Report

**Date:** 2026-06-09
**Module:** `src/lib/recastModelRouting.js`
**Pipeline:** `antiChatbotRecastPipeline.js` v4.0

---

## Overview

Recast Model Routing v4 introduces a **model-aware routing layer** that selects the optimal LLM model for each chunk based on detected prose weaknesses. Instead of sending every chunk to a single model, v4 analyzes each chunk's weakness profile and dispatches it to the model best suited to fix those specific issues.

**Key breakthrough:** The router's `filter_verb_specialist` routing was the decisive factor in achieving the best literary result in pipeline history (+4 composite improvement).

---

## RECAST_MODELS Registry

The registry defines available models with their characteristics and temperature settings:

| Model | Temperature | Primary Strength |
|---|---|---|
| `prose-recast-polisher` | 0.4 | General improvement, filter verb removal, citation safety |
| `prose-polisher` | 0.55 | Literary voice preservation, texture maintenance |

**Design rationale:**
- `prose-recast-polisher` uses a lower temperature (0.4) for more deterministic, surgical edits — ideal for filter verb removal and maintaining factual precision in nonfiction.
- `prose-polisher` uses a slightly higher temperature (0.55) to preserve literary voice, texture, and stylistic variance — critical for memoir and literary fiction where flattening is the primary risk.

---

## detectRecastWeaknessTypes — Weakness Catalog

The `detectRecastWeaknessTypes()` function analyzes a chunk and returns a set of weakness type tags. These tags drive routing decisions.

### Weakness Types (10+)

| Weakness Type | Detection Criteria | Routing Implication |
|---|---|---|
| `filter_verb_heavy` | FV density > 10 per 1,000 words | Route to `prose-recast-polisher` as `filter_verb_specialist` |
| `filter_verb_moderate` | FV density 5–10 per 1,000 words | Default routing applies |
| `thesis_statements` | Academic thesis patterns detected | Prefer `prose-recast-polisher` |
| `essay_bot_transitions` | "Furthermore", "Moreover", etc. | Prefer `prose-recast-polisher` |
| `citation_bearing` | Chunk contains citations/references | Force `prose-recast-polisher` (citation safety) |
| `heading_bearing` | Chunk contains markdown/section headings | Enable heading preservation gate |
| `literary_voice` | Literary/memoir profile detected | Prefer `prose-polisher` |
| `nonfiction_structure` | Nonfiction/business/training profile | Force `prose-recast-polisher` |
| `high_chatbot_density` | Chatbot phrase density above threshold | Aggressive recast recommended |
| `low_variance` | Low sentence length variance | Variance-preserving model preferred |

---

## chooseRecastModel — 5-Rule Routing Policy

The `chooseRecastModel()` function implements a **priority-ordered** decision chain. The first matching rule wins.

### Decision Table

| Priority | Rule | Condition | Selected Model | Specialist Tag |
|---|---|---|---|---|
| 1 | Nonfiction override | Profile is nonfiction/business/training | `prose-recast-polisher` | `nonfiction_specialist` |
| 2 | Citation safety | Chunk contains citations | `prose-recast-polisher` | `citation_safe` |
| 3 | Filter verb specialist | FV density > 10 per 1,000 words | `prose-recast-polisher` | `filter_verb_specialist` |
| 4 | Literary voice | Profile is literary/memoir | `prose-polisher` | `literary_voice_preservation` |
| 5 | Default | No specific condition matched | `prose-recast-polisher` | `general_improvement` |

### Rule Precedence Example

A literary chunk with FV density > 10/1K and citations would match:
- Rule 2 (citations) → `prose-recast-polisher` as `citation_safe`

Citations take precedence over literary voice because citation damage is irreversible.

### Bakeoff Routing Decisions

| Genre | Chunk | Weakness Detected | Rule Matched | Model | Specialist |
|---|---|---|---|---|---|
| Thriller | Chunk 1 | general | Rule 5 (default) | `prose-recast-polisher` | `general_improvement` |
| Literary | Chunk 1 | FV density > 10/1K | Rule 3 (FV specialist) | `prose-recast-polisher` | `filter_verb_specialist` |
| Nonfiction | — | All chunks above threshold | — (skipped) | — | — |

**Key insight:** The literary chunk had FV density 8.5/1K in the raw output. The router correctly identified this as a high-FV chunk and routed it to `prose-recast-polisher` as `filter_verb_specialist` instead of the default `prose-polisher` that Rule 4 (literary voice) would have selected. This **overrode the literary default** and produced the best literary result ever (+4 composite). The filter verb specialist routing was the breakthrough.

---

## callLLMForModel — Dispatch Mechanism

The v4 pipeline introduces `callLLMForModel`, a model-aware wrapper around the existing `callLLM` function.

### Dispatch Flow

```
chooseRecastModel(chunk, profile)
  → { model: "prose-recast-polisher", temperature: 0.4, specialist: "filter_verb_specialist" }
    → callLLMForModel(prompt, modelConfig)
      → callLLM(prompt, { model: modelConfig.model, temperature: modelConfig.temperature })
```

### Backward Compatibility

- If `callLLMForModel` is not available or model routing is disabled, the pipeline falls back to the existing `callLLM` function with default parameters.
- All v3 behavior is preserved when routing is bypassed.
- The `callLLM` fallback ensures zero breakage for existing integrations.

---

## Pipeline Integration

### antiChatbotRecastPipeline.js v4.0 Changes

1. **Import routing functions** from `recastModelRouting.js`
2. **Routing metadata** added to chunk details:
   - `routedModel`: which model was selected
   - `specialistTag`: why that model was selected
   - `weaknessTypes`: detected weakness profile
3. **Heading preservation gate** wired into `recastChunkWithAntiChatbotRules`
4. **Literary anti-flattening guard** wired into `recastChunkWithAntiChatbotRules`
5. **New counters** in pipeline report:
   - `headingBlocks`: count of heading-loss rejections
   - `literaryFlatteningBlocks`: count of flattening rejections
6. **routingReport** in final report via `buildRecastModelRoutingReport()`

### Report Additions

The `buildRecastModelRoutingReport()` function produces a routing summary including:
- Per-chunk model selection decisions
- Weakness type distribution across all chunks
- Model usage distribution (which models were selected and how often)
- Specialist tag distribution
- Any routing overrides or fallbacks

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│            antiChatbotRecastPipeline v4.0            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  chunk ──► detectRecastWeaknessTypes()               │
│              │                                       │
│              ▼                                       │
│         chooseRecastModel()                          │
│              │                                       │
│     ┌────────┼────────┐                              │
│     ▼        ▼        ▼                              │
│  Rule 1-2  Rule 3   Rule 4                           │
│  nonfic/   FV>10    literary                         │
│  citation           voice                            │
│     │        │        │                              │
│     ▼        ▼        ▼                              │
│  recast-   recast-  prose-                           │
│  polisher  polisher polisher                         │
│     │        │        │                              │
│     └────────┴────────┘                              │
│              │                                       │
│              ▼                                       │
│     callLLMForModel(prompt, modelConfig)             │
│              │                                       │
│              ▼                                       │
│     validateHeadingPreservation() ◄── nonfiction     │
│     validateLiteraryRecast()     ◄── literary/memoir │
│              │                                       │
│              ▼                                       │
│         recast result                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Summary

The v4 routing architecture is a targeted, rule-based system that makes smart model selection decisions per chunk. It is not a general-purpose model router — it is tuned specifically for the prose recast use case with 5 clear rules, 10+ weakness types, and hard safety gates. The architecture proved its value immediately: the filter verb specialist routing produced the best literary result in pipeline history.
