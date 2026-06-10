# Adult Romance / Erotica — Live Test

## Profile Resolution

| Field | Value |
|---|---|
| Genre | fiction (adult_romance maps to fiction) |
| Profile | fiction |
| Slop reduction | high |
| Dialogue repair | true (always-on for fiction) |
| LLM recast | true |
| Polish intensity | high |
| preserveVoice | true |
| Hard safety | true |

## Scene Results

| Ch | Title | Profile | Dialogue Before→After | Slop Before→After | Safety | Export | Notes |
|---|---|---|---|---|---|---|---|
| 1 | The Gallery Opening | fiction | 0→0 | 2→2 | PASS | ✅ PASS | Adult content allowed=YES |
| 2 | After Hours | fiction | 0→0 | 0→0 | PASS | ✅ PASS | Adult content allowed=YES |

## Unsafe Control Test

| Check | Result |
|---|---|
| Gate passes? | ❌ NO (REJECT_REGENERATE) |
| Process leaks | 3 detected |
| Contamination | 2 detected |
| Malformed | 2 detected |
| Export blocked | ✅ YES |

## Key Findings

- Safe consensual adult content passes safety gate
- Adult dialogue preserved without damage
- Sensual/intimate prose not censored
- No false flagging of adult vocabulary
- Unsafe control fixture correctly hard-blocked
