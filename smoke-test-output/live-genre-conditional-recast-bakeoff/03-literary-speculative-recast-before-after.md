# Literary/Speculative — Live Recast Before/After

## Summary

| Metric | Version A (Raw) | Version B (Recast) | Delta |
|--------|-----------------|-------------------|-------|
| Words | 1,170 | 1,170 | 0 |
| Composite Score | 73 (GOOD) | 73 (GOOD) | **0** |
| Filter Verbs / 1K | 9.4 | 9.4 | 0 |
| Chatbot Patterns | 28 | 28 | 0 |

**Profile**: `literary`
**Drift**: +17 first→last (ending stronger)

## Result: Version B == Version A

No changes were applied to the final output. Version B is identical to Version A.

This happened because:
- 2 of 3 chunks were correctly skipped as good/protected.
- The 1 eligible chunk failed safety validation.
- With no successful recasts, the original text was preserved unchanged.

## Chunk-Level Breakdown

### Chunk 0 — Failed Recast ✗

- **Before Score**: 67 (FAIR)
- **Action**: Attempted recast, **blocked by safety gate**
- **Recast Word Count**: 414 → 345 words (**83% ratio**)
- **Minimum Required**: 85%
- **Block Reason**: The prose-polisher compressed the chunk too aggressively, cutting 69 words (17% of the original). The safety gate correctly blocked this recast to prevent content loss.

This was a **correct block**. A 17% word reduction on a literary chunk would risk losing nuance, imagery, and voice — exactly the qualities that matter most in literary/speculative prose.

### Chunk 1 — Skipped

- **Score**: 76
- **Action**: Skipped (score ≥ threshold)
- **Reason**: Already above the recast threshold. Good quality preserved.

### Chunk 2 — Skipped (Protected)

- **Score**: 84
- **Action**: Skipped (protected: `high_score`)
- **Reason**: Score of 84 (GREAT) placed this well above protection threshold. No recast attempted.

## Filter Verb Density: Persistent at 9.4/1K

The literary profile has the highest filter verb density of the three genres (9.4/1K vs. 4.7/1K thriller and 0.9/1K nonfiction). This is notable because:

1. **The ghostwriter model produces more filter verbs in literary mode.** Literary prompts encourage introspective, sensory prose, which naturally generates constructions like "she felt," "he seemed," "they noticed."

2. **The prose-polisher does not fix filter verbs on recast.** The recast instructions focus on reducing chatbot patterns and improving sentence variety, not on targeting specific verb categories. Even if chunk 0's recast had passed safety, the filter verb density would likely have remained high.

3. **This is a known limitation.** Filter verb reduction requires either:
   - A dedicated filter-verb pass in the pipeline, or
   - Explicit filter-verb instructions in the prose-polisher's recast prompt.

## Honest Assessment

**No improvement, but no damage.** This is the correct outcome for a conservative pipeline when:
- The baseline is already GOOD (73).
- The model compresses too aggressively on the one weak chunk.
- Good chunks are correctly left alone.

The pipeline did exactly what it should: it attempted to help, found that the help would cause harm (content loss), and blocked it. The text is preserved intact.

The +17 drift (first→last) indicates the ghostwriter's literary output gets stronger as it builds — the final chunk scored 84. This is a pre-existing characteristic of the generation, not a recast effect.

## Safety

| Gate | Result |
|------|--------|
| Blocks | **1** (chunk 0: word count ratio 83%) |
| Overcorrection | 0 |
| Score regression | N/A (recast blocked) |
