# Corrupted Project Safety Test

## Fixture Content

The corrupted fixture contains:
- "Action Plan:" — editorial process text
- "Next Move:" — editorial process text
- "As an AI language model" — model self-reference
- "Unity Supported Living Services" — cross-project contamination
- "chapter succeeds because" — process leak
- "Best Next Move:" — editorial process text
- "You was" — malformed grammar
- "Was was" — malformed grammar

## Safety Gate Result

| Check | Result |
|---|---|
| Gate passes? | ❌ NO |
| Action | REJECT_REGENERATE |
| Process leaks | 3 detected |
| Contamination | 2 detected |
| Malformed | 2 detected |
| Export blocked | ✅ YES |

## Detected Issues

### Process Leaks
- "Best Next Move" (critical)
- "Next Move:" (critical)
- "Action Plan:" (critical)

### Contamination
- "Unity Supported Living Services" (critical)
- "Unity Supported Living" (critical)

### Malformed Grammar
- "You was"
- "Was was"

## Verdict: HARD BLOCK ✅

Corrupted content correctly triggers REJECT_REGENERATE.
