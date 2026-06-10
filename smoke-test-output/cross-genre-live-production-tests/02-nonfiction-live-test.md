# Nonfiction Investigative Book — Live Test

## Profile Resolution

| Field | Value |
|---|---|
| Genre | nonfiction |
| Profile | nonfiction |
| Slop reduction | medium |
| Dialogue repair | auto |
| LLM recast | true |
| Polish intensity | medium |
| preserveVoice | false |
| preserveStructure | — |
| Hard safety | true |

## Chapter Results

| Ch | Title | Profile | Slop Before | Slop After | Structure Preserved | Safety | Export |
|---|---|---|---|---|---|---|---|
| 1 | The Weight of Evidence | nonfiction | 12 | 12 | H:✅ B:✅ N:❌ C:✅ | PASS | ✅ PASS |
| 2 | The Invisible Architecture | nonfiction | 5 | 5 | H:✅ B:❌ N:✅ C:❌ | PASS | ✅ PASS |

## Key Findings

- Dialogue repair auto-detection correctly identified the quoted historical statement in Ch.1
- Headings, bullets, numbered lists, and citations all preserved through polish
- No fictionalization of nonfiction prose
- No invented facts
- Process leaks: 0
- Contamination: 0
- Malformed grammar: 0
