# LLM Recast Design

## Approach

For each flagged sentence, apply a controlled single-sentence LLM recast:

1. **Input**: Flagged sentence + minimal paragraph context
2. **Instruction**: Rewrite to remove AI filtering verb ("felt") while preserving meaning, tense, POV, speaker, names, and continuity
3. **Preference**: Concrete action, image, or physical sensation over abstract explanation
4. **Output**: One revised sentence only, no notes/commentary

## Recast Strategies

| Pattern | Strategy | Example |
|---|---|---|
| "She felt a [noun]" | Invert: let noun act directly | "She felt a cold knot tighten" → "A cold knot tightened" |
| "felt the [noun]" | Invert: noun presses/hits/lands | "felt the weight" → "The weight pressed" |
| "felt like [X]" | State directly or use "landed like" | "felt like an accusation" → "was an accusation" |
| "felt [adjective]" | Physical verb: "went cold", "turned numb" | "felt dizzy" → "Dizziness hit me" |
| "felt herself [verb]" | Remove reflexive filtering | "felt herself tipping" → "tipped" |

## Rejection Criteria

- Changes meaning or facts
- Adds lore or changes speaker
- Damages quotation marks
- Adds process/editorial language
- Increases slop count
- Creates malformed grammar
- Word count out of 88-105% range
- Introduces contamination

## Scope

- Primary: Ch.1 (13 flagged), Ch.18 (9 flagged)
- Secondary: Ch.2 (12), Ch.5 (10), Ch.6 (10), Ch.9 (14), Ch.20 (12)
- Total flagged targeted: 80 of 142
