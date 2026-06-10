# Nonfiction Regression Resolution Report

## The Problem

The previous bakeoff revealed a critical regression in narrative nonfiction:

| Metric | Before Recast | After Recast | Delta |
|--------|--------------|-------------|-------|
| Composite Score | 80 | 63 | **-17** |

A 17-point drop — from GREAT to POOR — caused by the recast pipeline itself. The pipeline was making nonfiction **worse**, not better.

## Root Cause

The previous architecture used a **universal `SIGNATURE_VOICE_BLOCK`** for all genres. This block contained fiction-optimized instructions that were applied indiscriminately to nonfiction:

### Fiction-Biased Instructions That Damaged Nonfiction

| Instruction | Effect on Nonfiction |
|-------------|---------------------|
| "Use fragments for impact" | Broke authoritative compound sentences into choppy fragments, undermining credibility |
| "Layer sensory details" | Injected inappropriate sensory language into analytical/evidential passages |
| "Vary sentence length dramatically" | Disrupted the measured, consistent cadence of good nonfiction |
| Noir/grit stylistic directives | Applied crime-fiction aesthetics to informational prose |
| "Show, don't tell" emphasis | Contradicted nonfiction's need to state facts directly |

### How the Damage Manifested

- **Authority erosion**: Declarative sentences ("The study found X") were rewritten as fragmented sensory constructions ("X. Right there in the data. You could feel it.")
- **Citation disruption**: Source references were deprioritized in favor of "voice"
- **Heading damage**: Structural elements were disrupted by stylistic rewrites
- **Tone mismatch**: Analytical prose was recast with emotional/fictional intensity

## The Fix: Genre-Conditional Architecture

### OLD Approach (Universal)

```
All genres → SIGNATURE_VOICE_BLOCK (fiction-optimized)
  ├── Fragment forcing
  ├── Sensory overload
  ├── Noir/grit aesthetics
  └── Dramatic variation
```

### NEW Approach (Genre-Conditional)

```
thriller  → SIGNATURE_VOICE_BLOCK (fiction-appropriate)
literary  → SIGNATURE_VOICE_BLOCK (fiction-appropriate)
nonfiction → NONFICTION_AUTHORITY_BLOCK (nonfiction-specific)
```

### NONFICTION_AUTHORITY_BLOCK Rules

The new nonfiction block applies rules appropriate to the genre:

- **Preserve authoritative sentence structures** — No fragment-forcing
- **Maintain citation integrity** — Source references are protected
- **Keep heading hierarchy** — Structural elements are preserved
- **Authority-appropriate improvements only** — Reduce chatbot patterns without disrupting measured tone
- **No sensory injection** — Keep analytical language clean
- **No noir/grit aesthetics** — Maintain informational tone

## Results Comparison

| Metric | OLD (Fiction-Biased) | NEW (Genre-Conditional) |
|--------|---------------------|------------------------|
| Before Score | 80 | 73 |
| After Score | 63 | 73 |
| Delta | **-17** | **0** |
| Citations | Unknown | 1→1 (Preserved) |
| Headings | Unknown | 3→3 (Preserved) |
| Filter Verbs | Unknown | 0.9→1.0/1K (Stable) |
| Chatbot Patterns | Unknown | 24→22 (-2) |

> **Note**: The different "Before" scores (80 vs 73) reflect different generated texts from different ghostwriter runs. The key metric is the **delta** — the recast pipeline's effect on the text it received.

## Verification Checklist

| Check | Status |
|-------|--------|
| No score regression | ✓ (73 → 73) |
| Citations preserved | ✓ (1 → 1) |
| Headings preserved | ✓ (3 → 3) |
| Authority tone maintained | ✓ |
| No fragment-forcing applied | ✓ |
| No sensory injection | ✓ |
| No fiction-biased stylistics | ✓ |
| Safety gates operational | ✓ (1 block, correct) |
| Successful recast improved score | ✓ (chunk 1: 68 → 80, +12) |

## Conclusion

**The -17 nonfiction regression is eliminated.**

The genre-conditional architecture correctly routes nonfiction text through nonfiction-appropriate recast rules. The `NONFICTION_AUTHORITY_BLOCK` preserves the qualities that define good nonfiction — authority, structure, citations, measured tone — while still allowing the pipeline to improve weak chunks when possible.

The one successful recast (chunk 1: 68 → 80, +12) demonstrates that the pipeline **can** improve nonfiction when the recast is appropriate. The one blocked recast (chunk 2: safety gate) demonstrates that the pipeline **protects** nonfiction when the recast would cause harm.

This is the correct behavior. The regression is resolved.
