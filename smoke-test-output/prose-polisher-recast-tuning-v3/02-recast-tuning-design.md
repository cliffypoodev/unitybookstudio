# Recast Tuning Design

> **Date:** 2026-06-09
> **Component:** `prose-polisher` recast pipeline — v3 tuning
> **Classification:** Design Document

---

## Overview

Recast Tuning v3 makes five changes to the prose-polisher pipeline, all targeting the root cause identified in the [current state audit](file:///Users/cliff/Downloads/UBS/smoke-test-output/prose-polisher-recast-tuning-v3/01-prose-polisher-current-state-audit.md): a generic personal-assistant model identity being used for conservative prose editing.

The central architectural decision is **system-prompt-level identity over user-prompt-only instructions**. Every change reinforces this principle.

---

## Change 1: Dedicated `prose-recast-polisher` Modelfile

**File:** `models/prose-recast-polisher.Modelfile`

### What Changed

| Parameter | Before (shared model) | After (dedicated model) |
|---|---|---|
| Base weights | Gemma 4 E4B (9.6 GB) | Gemma 4 E4B (9.6 GB) — **same, no download** |
| System prompt | Generic personal assistant | **"You are a conservative prose editor"** |
| Temperature | 1.0 | **0.4** |
| `top_k` | (default) | **40** |
| `top_p` | (default) | **0.9** |

### System Prompt Identity

The new system prompt establishes the model's identity as a conservative prose editor with the following baked-in behaviors:

- **Length preservation** — output must match input word count within tight tolerance
- **Filter verb awareness** — knows the target verbs and how to replace them
- **Genre awareness** — adjusts aggressiveness based on genre
- **Citation preservation** — treats inline references as structural, not stylistic
- **Anti-chatbot personality** — explicitly rejects assistant-style hedging, transitions, and qualifiers

### Architecture Decision: Why System Prompt

User-prompt instructions are requests. System-prompt instructions are identity.

A model with an assistant identity that receives "act like an editor" in the user prompt will:
- Sometimes comply, sometimes revert to assistant behavior
- Interpret "improve" through the lens of "help the user" rather than "preserve the author's voice"
- Default to chatbot patterns (transitions, hedging) under uncertainty

A model with an editor identity will:
- Consistently apply conservative editing
- Interpret "improve" as "make this prose stronger without changing its character"
- Default to minimal intervention under uncertainty

### Temperature Rationale

| Temperature | Behavior | Use Case |
|---|---|---|
| 1.0 | High variance, creative, surprising | Ghostwriting, ideation |
| 0.7 | Moderate variance, balanced | General conversation |
| **0.4** | **Low variance, consistent, conservative** | **Prose editing** |

Temperature 0.4 reduces the model's tendency to:
- Invent novel phrasings when the original was adequate
- Introduce chatbot patterns as "improvements"
- Overcorrect to the point of triggering safety blocks

---

## Change 2: FILTER_VERB_TARGETING_BLOCK

### Target Verbs with Replacement Examples

The block defines 10 filter verbs and provides concrete replacement guidance:

| # | Filter Verb | Example Replacement Strategy |
|---|---|---|
| 1 | `felt` | Direct sensation or emotion: "felt cold" → "the cold bit" |
| 2 | `seemed` | Commit or cut: "seemed angry" → "was angry" or show it |
| 3 | `noticed` | Go direct: "noticed the door" → "the door was open" |
| 4 | `realized` | Show the realization through action or thought |
| 5 | `watched` | Describe what's seen: "watched him leave" → "he left" |
| 6 | `heard` | Name the sound: "heard a crash" → "a crash echoed" |
| 7 | `saw` | Present the image: "saw the fire" → "fire climbed the walls" |
| 8 | `thought` | Interior monologue or action: show don't tell |
| 9 | `wondered` | Frame as a question or show uncertainty through behavior |
| 10 | `began to` | Cut entirely — just do the action |

### Constraints

- **Dialogue exception:** Filter verbs in dialogue are natural speech and should NOT be replaced
- **Rate guidance:** Target 1–2 replacements per 500 words — not every instance
- **Fiction only:** This block is included for fiction genres (thriller, literary) but NOT for nonfiction or training manuals, where filter verbs are less problematic

---

## Change 3: Genre-Specific RECAST_EXAMPLES

Each genre gets a four-tier example set showing quality levels:

### Structure (Per Genre)

```
WEAK         → What bad prose looks like (and why)
ACCEPTABLE   → Minimum passing quality
OVERCORRECTED → What happens when the model goes too far
COMPRESSED   → What aggressive compression looks like (too short)
```

### Genre Routing

| `profileKey` | Example Set | Notes |
|---|---|---|
| `thriller_*` | `THRILLER_RECAST_EXAMPLES` | Pacing, tension, short sentences |
| `literary_*` | `LITERARY_RECAST_EXAMPLES` | Voice, imagery, rhythm |
| `nonfiction_*`, `business_guide` | `NONFICTION_RECAST_EXAMPLES` | Citation preservation, authority, precision |

### Design Rationale

The examples serve as **calibration anchors** for the model. Without examples, the model must guess what "good" means for each genre. With examples:

- The model sees what overcorrection looks like and avoids it
- The model sees what acceptable quality looks like and targets it
- Genre-specific voice preferences are demonstrated, not described

---

## Change 4: NONFICTION_AUTHORITY_RECAST_BLOCK

### Purpose

Nonfiction prose has different quality markers than fiction. This block provides nonfiction-specific editing instructions:

| Instruction | Purpose |
|---|---|
| Vague abstraction → precise claims | Replace "many studies show" with specific claims |
| Strengthen paragraph openings/endings | First and last sentences carry the most weight |
| Remove essay-bot transitions | Cut "Furthermore," "In conclusion," "It is worth noting that" |
| Source discipline | Maintain citation integrity, don't invent sources |
| Citation preservation | `[1]`, `(Author, Year)`, footnote markers are structural |
| **PRECISION and AUTHORITY over style** | Nonfiction editing prioritizes accuracy, not beauty |

### Routing

| Genre | Included? | Reason |
|---|---|---|
| `nonfiction_*` | ✅ Yes | Primary target |
| `business_guide` | ✅ Yes | Same authority requirements |
| `training_manual` | ❌ No | Training manuals have different structure (steps, procedures) |
| Fiction genres | ❌ No | Different quality model entirely |

---

## Change 5: Updated `buildChunkRecastPrompt()`

### Composition Logic

The prompt builder now dynamically composes the full recast prompt based on genre:

```
BASE_RECAST_PROMPT (always)
  + RECAST_EXAMPLES[genre] (always — genre-routed)
  + FILTER_VERB_TARGETING_BLOCK (fiction only)
  + NONFICTION_AUTHORITY_RECAST_BLOCK (nonfiction/business_guide only)
```

### Decision Tree

```
buildChunkRecastPrompt(chunk, profileKey):
  prompt = BASE_RECAST_PROMPT

  if profileKey starts with "thriller_":
    prompt += THRILLER_RECAST_EXAMPLES
    prompt += FILTER_VERB_TARGETING_BLOCK
  else if profileKey starts with "literary_":
    prompt += LITERARY_RECAST_EXAMPLES
    prompt += FILTER_VERB_TARGETING_BLOCK
  else if profileKey starts with "nonfiction_" or == "business_guide":
    prompt += NONFICTION_RECAST_EXAMPLES
    prompt += NONFICTION_AUTHORITY_RECAST_BLOCK
    // NO filter verb block for nonfiction
  else if profileKey == "training_manual":
    prompt += NONFICTION_RECAST_EXAMPLES
    // NO authority block, NO filter verb block

  return prompt
```

---

## Summary of Architecture

```
┌─────────────────────────────────────────┐
│  prose-recast-polisher Model            │
│  ┌───────────────────────────────────┐  │
│  │ SYSTEM PROMPT (Identity Level)    │  │
│  │ • "Conservative prose editor"     │  │
│  │ • Length preservation             │  │
│  │ • Filter verb awareness           │  │
│  │ • Genre awareness                 │  │
│  │ • Citation preservation           │  │
│  │ • Anti-chatbot personality        │  │
│  └───────────────────────────────────┘  │
│  Temperature: 0.4 | top_k: 40          │
│  Base: Gemma 4 E4B (9.6 GB, shared)    │
└────────────────────┬────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
┌────────┐    ┌──────────┐    ┌───────────┐
│Thriller│    │ Literary │    │ Nonfiction│
│Examples│    │ Examples │    │ Examples  │
│+ FV    │    │ + FV     │    │+ Authority│
│ Block  │    │  Block   │    │  Block    │
└────────┘    └──────────┘    └───────────┘
```

The key insight: the **model identity** (system prompt) provides the consistent editorial stance, while the **user prompt composition** (genre blocks) provides the genre-specific calibration. Neither alone is sufficient.
