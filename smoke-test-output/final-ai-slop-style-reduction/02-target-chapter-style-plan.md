# Target Chapter Style Plan

## Primary Targets

### Chapter 1: The Algorithmic Stage

- Slop hits: 82 (density: 21.1/1K)
- Primary offenders: "felt" dominates (~47% of hits)
- "wasn't just" / "not just" family is the main deterministically fixable pattern
- Deterministic repairs possible: 5
- Flagged for LLM review: 13
- Target: reduce by 25%+ (to ≤61)

**Strategy:**
1. Recast "wasn't just X; it was Y" → "was now Y" (gerund) or "had become Y" (noun)
2. Reduce excess "wasn't just" → "was more than"
3. Flag remaining "felt" for LLM contextual rewrite
4. Preserve all dialogue mechanics and opening quotes

### Chapter 9: The Terminal Veil

- Slop hits: 69 (density: 15.3/1K)
- Primary offenders: "felt" dominates (~47% of hits)
- "wasn't just" / "not just" family is the main deterministically fixable pattern
- Deterministic repairs possible: 15
- Flagged for LLM review: 14
- Target: reduce by 25%+ (to ≤51)

**Strategy:**
1. Recast "wasn't just X; it was Y" → "was now Y" (gerund) or "had become Y" (noun)
2. Reduce excess "wasn't just" → "was more than"
3. Flag remaining "felt" for LLM contextual rewrite
4. Preserve all dialogue mechanics and opening quotes

### Chapter 18: The Stage of Errors

- Slop hits: 72 (density: 17.8/1K)
- Primary offenders: "felt" dominates (~47% of hits)
- "wasn't just" / "not just" family is the main deterministically fixable pattern
- Deterministic repairs possible: 13
- Flagged for LLM review: 9
- Target: reduce by 25%+ (to ≤54)

**Strategy:**
1. Recast "wasn't just X; it was Y" → "was now Y" (gerund) or "had become Y" (noun)
2. Reduce excess "wasn't just" → "was more than"
3. Flag remaining "felt" for LLM contextual rewrite
4. Preserve all dialogue mechanics and opening quotes

## Secondary Targets (HIGH severity)

- Ch.3 (The Office of Echoes): 52 hits, 9 deterministic repairs available
- Ch.4 (The Sacred Screen): 56 hits, 10 deterministic repairs available
- Ch.6 (The Drift of Echoes): 68 hits, 8 deterministic repairs available
- Ch.7 (The Anatomist's Stage): 50 hits, 5 deterministic repairs available
- Ch.20 (The Battlefield Code): 55 hits, 7 deterministic repairs available

## Approach

- **Deterministic pass**: `runAISlopReductionPass()` handles "not just" family recasts, weight-of replacements, single-word adjective removal
- **LLM-flagged items**: "felt" and "realized" with context-dependent phrasing are flagged for future LLM review pass
- **Budget system**: each pattern has a per-chapter budget; only excess occurrences are recast
- **Safety**: dialogue repair runs after slop reduction to preserve all opening quotes
