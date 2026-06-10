# Nonfiction Regression Fix Report

## Problem

Fiction-biased rules regressed nonfiction by **-17 composite points** in live Ollama testing.

## Root Cause

`SIGNATURE_VOICE_BLOCK` instructs:

- *"Use fragments deliberately for impact"*
- Injects sensory overload, noir texture, and literary compression

These instructions are **wrong for nonfiction**. They produce choppy, over-stylized prose that undermines factual authority and readability in investigative, historical, and biographical writing.

## Fix: NONFICTION_AUTHORITY_BLOCK

Created a dedicated nonfiction voice block with the following principles:

| Principle | Description |
|---|---|
| **Paragraph authority** | Lead with claims/facts, not throat-clearing |
| **Active voice emphasis** | Same as fiction — eliminate passive constructions |
| **Concrete evidence rules** | Data-first writing, specific quantifiers over vague hedging |
| **Thesis clarity** | State the point once, don't circle back to it |
| **Transition discipline** | Cut generic connectors ("Furthermore," "Moreover," "Additionally") |
| **Source discipline** | Preserve all citations exactly as written |

### Explicit Prohibitions

The nonfiction block includes three explicit prohibitions to prevent fiction-biased pattern leakage:

> - *"Do NOT use forced literary fragments"*
> - *"Do NOT inject fictional sensory overload"*
> - *"Do NOT compress into noir or grit texture"*

## Polisher Variant

`POLISHER_NONFICTION_RULES` explicitly **excludes** fragment, sensory, and noir instructions that are present in the fiction polisher rules. This ensures the LLM polisher receives clean nonfiction-appropriate instructions.

## Verification

- **55 nonfiction regression guard tests** pass.
- **Zero fiction-biased patterns** leak into nonfiction rules.
- Nonfiction projects will never receive fragment/sensory/noir instructions through any code path.
