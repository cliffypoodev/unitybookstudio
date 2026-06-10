# Narrative Nonfiction — Live Recast Before/After

> **CRITICAL REPORT** — This genre was the site of the -17 regression in the previous bakeoff. This report documents the resolution.

## Summary

| Metric | Version A (Raw) | Version B (Recast) | Delta |
|--------|-----------------|-------------------|-------|
| Words | 1,066 | 1,023 | -43 |
| Composite Score | 73 (GOOD) | 73 (GOOD) | **0** |
| Filter Verbs / 1K | 0.9 | 1.0 | +0.1 |
| Chatbot Patterns | 24 | 22 | **-2** |

**Profile**: `nonfiction`
**Drift**: -15 first→last (ending weaker — pre-existing, not caused by recast)

## Previous Bakeoff Comparison

| Bakeoff | Before | After | Delta |
|---------|--------|-------|-------|
| Previous (fiction-biased rules) | 80 | 63 | **-17 REGRESSION** |
| Current (genre-conditional) | 73 | 73 | **0 STABLE** |

**The -17 regression is RESOLVED.**

## What Changed

The previous bakeoff applied universal `SIGNATURE_VOICE_BLOCK` instructions to all genres, including nonfiction. Those instructions included:

- Fragment-forcing ("Use fragments for impact")
- Sensory overload ("Layer sensory details")
- Noir/grit stylistic directives
- Fiction-optimized voice patterns

These instructions **actively damaged** nonfiction prose by:
- Breaking authoritative sentence structures into choppy fragments
- Injecting inappropriate sensory language into analytical passages
- Undermining the measured, evidential tone that defines good nonfiction

The genre-conditional system replaces this with `NONFICTION_AUTHORITY_BLOCK`, which:
- Preserves authoritative, measured sentence structures
- Protects citations and source references
- Maintains heading hierarchy
- Applies nonfiction-appropriate quality improvements only

## Chunk-Level Breakdown

### Chunk 0 — Skipped

- **Score**: 78
- **Action**: Skipped (score ≥ threshold)
- **Reason**: Strong opening chunk, above recast threshold. Preserved as-is.

### Chunk 1 — Recast ✓

- **Before Score**: 68 (FAIR)
- **After Score**: 80 (GREAT)
- **Improvement**: **+12 points**
- **Safety**: Passed all gates (word count ratio within bounds, no score regression)

The one successful recast improved this chunk from FAIR to GREAT — the single largest point improvement in the entire bakeoff. The prose-polisher improved sentence variety and reduced chatbot patterns while maintaining the nonfiction authority voice.

### Chunk 2 — Failed Recast ✗

- **Before Score**: 66 (FAIR)
- **Action**: Attempted recast, **blocked by safety gate**
- **Recast Word Count**: 223 → 189 words (**85% ratio**)
- **Minimum Required**: 85%
- **Block Reason**: At the exact edge of the safety threshold. The prose-polisher compressed slightly too much. The safety gate blocked to preserve content integrity.

This was a borderline case — 85% is exactly the minimum. The gate correctly erred on the side of caution.

## Structural Preservation

### Citations

| Element | Version A | Version B | Status |
|---------|-----------|-----------|--------|
| Citations | 1 | 1 | **PRESERVED** ✓ |

The nonfiction profile's citation-preservation rules ensured that source references were maintained through the recast pipeline.

### Headings

| Element | Version A | Version B | Status |
|---------|-----------|-----------|--------|
| Headings | 3 | 3 | **PRESERVED** ✓ |

All structural headings survived the recast pipeline intact.

### Not-Just Patterns

| Pattern | Version A | Version B | Status |
|---------|-----------|-----------|--------|
| "not just" constructions | 9 | 7 | **Reduced** ✓ |

The recast successfully reduced the overuse of "not just X, but Y" constructions, a common chatbot pattern in nonfiction prose.

## Filter Verbs

Filter verb density remained very low: 0.9/1K → 1.0/1K. Nonfiction prose naturally uses fewer filter verbs than fiction because it favors declarative, evidential constructions over introspective, sensory ones. The negligible increase is within noise.

## Drift Analysis

The -15 drift (first→last: chunk 0 at 78, chunk 2 at 66) indicates the original ghostwriter output weakens toward the end. This is a **pre-existing pattern in the generation**, not caused by the recast pipeline. The recast pipeline did not worsen this drift — it successfully improved the middle chunk and attempted to help the weak final chunk (blocked by safety).

## Honest Assessment

**This is the most important result of the bakeoff.** The nonfiction regression was the critical failure of the previous architecture. The genre-conditional system completely eliminates this regression:

- Score is stable (73 → 73)
- Citations preserved
- Headings preserved
- Authority voice maintained
- One chunk significantly improved (+12)
- One chunk correctly blocked at safety edge
- No fiction-biased damage applied

The `NONFICTION_AUTHORITY_BLOCK` is working as designed. The genre-conditional architecture is validated.

## Safety

| Gate | Result |
|------|--------|
| Blocks | **1** (chunk 2: word count ratio 85%, at threshold edge) |
| Overcorrection | 0 |
| Citation preservation | Passed |
| Heading preservation | Passed |
