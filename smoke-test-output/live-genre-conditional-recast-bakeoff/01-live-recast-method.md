# Live Recast Bakeoff Method

## Overview

This report documents the methodology for the **Live Genre-Conditional Recast Bakeoff** — a real-model evaluation of the `runAntiChatbotRecastPipeline` with genre-conditional rules applied across three genre profiles. All model calls were live against local Ollama instances; no mocked or cached responses were used.

## Models

| Role | Model | Temperature | Runtime |
|------|-------|-------------|---------|
| Generation | `ghostwriter` | 0.72 | Ollama (local) |
| Recast | `prose-polisher` | 0.55 | Ollama (local) |

- **ghostwriter** generates the initial prose (Version A) from scene prompts via the full author workflow.
- **prose-polisher** performs chunk-level recasting during the recast pipeline phase (Version B).

## Generation Process

### Version A (Baseline)

1. Scene prompts submitted to `ghostwriter` at temperature 0.72.
2. Raw output captured as Version A with no post-processing beyond standard pipeline assembly.
3. Three genres tested:
   - **Commercial Thriller** (profile: `thriller`) — 1273 words
   - **Literary/Speculative** (profile: `literary`) — 1170 words
   - **Narrative Nonfiction** (profile: `nonfiction`) — 1066 words

### Version B (Recast)

1. Version A text fed into `runAntiChatbotRecastPipeline`.
2. Pipeline applies **genre-conditional rules** based on the active profile.
3. Eligible chunks sent to `prose-polisher` at temperature 0.55 for recast.
4. Recast output validated through safety gates before acceptance.

## Recast Pipeline Integration

The pipeline operates in these stages:

### 1. Chunk Splitting

Full text is split into semantic chunks for independent analysis. Each genre produced 3 chunks in this bakeoff.

### 2. Per-Chunk Scoring

Each chunk is scored on the composite anti-chatbot metric, which includes:
- Filter verb density (per 1K words)
- Chatbot pattern count
- Symmetry score
- Overall composite score (0–100 scale)

### 3. Protection Detection

Before recast eligibility, each chunk is checked for protection flags:
- **`dialogue_heavy`** — Chunks dominated by dialogue are protected from recast (dialogue has its own stylistic patterns that should not be flattened).
- **`high_score`** — Chunks scoring ≥ 75 are protected as already high quality.
- **Threshold skip** — Chunks scoring at or above the genre threshold are skipped.

### 4. Recast Execution

Eligible chunks (below threshold, not protected) are sent to `prose-polisher` with genre-specific recast instructions:
- **Thriller**: `SIGNATURE_VOICE_BLOCK` — noir/grit, sensory detail, fragment-forcing allowed.
- **Literary**: `SIGNATURE_VOICE_BLOCK` — literary voice, metaphor preservation.
- **Nonfiction**: `NONFICTION_AUTHORITY_BLOCK` — authority tone, citation preservation, heading preservation, no fiction-biased stylistic forcing.

### 5. Safety Validation

Every recast is validated before acceptance:
- **Word count ratio**: Recast must be ≥ 85% of original chunk word count (`minWordRatio: 0.85`). Prevents aggressive compression.
- **Score regression check**: Recast must score equal to or higher than the original. Prevents overcorrection.
- **Citation preservation** (nonfiction): Recast must not drop citations present in the original.
- **Heading preservation** (nonfiction): Recast must not drop structural headings.

If any safety gate fails, the recast is **blocked** and the original chunk is preserved.

## Scoring Methodology

The composite score aggregates multiple anti-chatbot signals:

| Signal | Description |
|--------|-------------|
| Filter verb density | Weak verbs (felt, seemed, noticed, etc.) per 1K words |
| Chatbot patterns | Count of formulaic AI-writing patterns |
| Symmetry | Structural repetition in sentence/paragraph patterns |
| Composite | Weighted aggregate, 0–100 scale |

Score interpretation:
- **< 60**: POOR — significant chatbot artifacts
- **60–69**: FAIR — some chatbot artifacts
- **70–79**: GOOD — minor or no chatbot artifacts
- **80–89**: GREAT — clean, natural prose
- **90+**: EXCELLENT — exceptional prose quality

## Summary

This bakeoff tested 3 genres × 3 chunks = 9 total chunks. All model calls were live. The pipeline correctly identified 5 chunks as good/protected, attempted recast on 4, succeeded on 2, and blocked 2 via safety gates. Zero overcorrection occurred.
