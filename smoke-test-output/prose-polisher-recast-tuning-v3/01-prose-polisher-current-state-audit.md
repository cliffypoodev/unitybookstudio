# Prose-Polisher Current State Audit

> **Date:** 2026-06-09
> **Component:** `prose-polisher` recast pipeline
> **Classification:** Root Cause Analysis — v2 Bottleneck

---

## Executive Summary

The Prose-Polisher recast pipeline hit a ceiling at v2: nonfiction chunks were either blocked by overcorrection detection or showed zero composite improvement. Investigation revealed a **shared-identity root cause** — both the `ghostwriter` and `prose-polisher` Ollama models were running on the same base weights with the same generic personal-assistant system prompt. Neither model had any prose editing, length preservation, filter verb, or genre-specific recast instructions baked into its identity.

---

## Root Cause: Shared Generic System Prompt

### Discovery

Both models were configured identically:

| Property | `ghostwriter` | `prose-polisher` |
|---|---|---|
| Base model | Gemma 4 E4B (9.6 GB) | Gemma 4 E4B (9.6 GB) |
| System prompt | Generic personal assistant | Generic personal assistant |
| Temperature | 1.0 | 1.0 |
| Prose editing instructions | **None** | **None** |

### The System Prompt (Verbatim)

The shared system prompt instructed the model to behave as:

> *"Cliff's personal AI assistant — a sharp, trusted, brilliant all-in-one: chief of staff, business partner, creative director."*

It included:

- **Image prompt generation** instructions for PonyXL and SDXL diffusion models
- **Family context** — names, relationships, preferences
- **Business operations** — scheduling, task management, project tracking
- **Creative direction** — general brainstorming and ideation support

### What Was Missing

The system prompt contained **zero** instructions for:

| Missing Capability | Impact |
|---|---|
| Prose editing identity | Model defaulted to chatbot "assistant" personality |
| Length preservation | Model freely expanded or compressed text |
| Filter verb awareness | Model could not target `felt`, `seemed`, `noticed`, etc. |
| Genre-specific behavior | No distinction between thriller, literary, nonfiction |
| Citation preservation | Model treated citations as editable prose |
| Recast examples | No before/after calibration for quality levels |
| Conservative editing stance | Model made dramatic, chatty rewrites |

### Temperature: 1.0

The default temperature of **1.0** is appropriate for creative generation (ghostwriting) but far too high for conservative prose editing, where:

- Consistency matters more than novelty
- Small, targeted improvements beat dramatic rewrites
- Overcorrection risk scales directly with temperature

---

## Why This Caused the v2 Bottleneck

### The Failure Mode

When the recast pipeline sent a chunk to `prose-polisher` with user-prompt-level instructions to "improve prose quality," the model:

1. **Treated the task as a creative rewrite** — its identity was "creative director," not "prose editor"
2. **Applied chatbot personality** — added transitions, hedging language, and assistant-style phrasing
3. **Ignored length constraints** — expanded or compressed freely because nothing in its identity said otherwise
4. **Overcorrected nonfiction** — the safety validators caught the overcorrection and blocked the recast, resulting in 0 improvement
5. **Stripped citations** — treated inline references as clutter because it had no citation-preservation instructions

### Evidence from v2 Results

| Genre | v2 Composite Delta | v2 Failure Rate | Root Cause |
|---|---|---|---|
| Thriller | +6 (when recast) | Low | High temp produced creative rewrites that sometimes scored well |
| Literary | +0 to +6 | Medium | Inconsistent — model's chatbot personality sometimes helped, sometimes hurt |
| **Nonfiction** | **0** | **HIGH** | Overcorrection block triggered every time |

The nonfiction failure was the clearest signal: the model's assistant identity and 1.0 temperature produced such dramatic changes that the overcorrection safety check consistently blocked them.

---

## Architecture Problem: User Prompt vs. System Prompt

### User-Prompt-Only Instructions (v2 Approach)

In v2, all editing instructions were passed in the user prompt:

```
"Rewrite this chunk to improve prose quality. Preserve length.
Do not add chatbot language..."
```

**Why this failed:** User-prompt instructions are treated as *requests* by the model. The model's *identity* (system prompt) as a creative assistant overrode these requests. It's the difference between asking someone to "act like an editor" versus that person *being* an editor.

### System-Prompt Identity (v3 Fix)

The architectural fix was to create a dedicated model with editing identity baked into the system prompt — not as a request, but as the model's fundamental self-concept:

```
"You are a conservative prose editor."
```

This is an **identity-level change**, not a prompt-engineering tweak. The model now interprets every instruction through the lens of "I am an editor" rather than "I am an assistant who was asked to edit."

---

## Conclusion

The v2 bottleneck was not a pipeline problem, not a prompt problem, and not a model capability problem. It was an **identity problem**: we were asking a personal assistant to be a prose editor, then blaming the pipeline when the assistant behaved like an assistant.

The fix required:
1. A dedicated Modelfile with editor identity in the system prompt
2. Temperature reduction from 1.0 to 0.4
3. Genre-specific recast instructions and examples
4. Filter verb targeting and citation preservation at the identity level

These changes are documented in [02-recast-tuning-design.md](file:///Users/cliff/Downloads/UBS/smoke-test-output/prose-polisher-recast-tuning-v3/02-recast-tuning-design.md).
