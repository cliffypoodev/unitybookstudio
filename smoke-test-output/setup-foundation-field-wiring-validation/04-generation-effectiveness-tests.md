# Generation Effectiveness Tests

## Overview
These tests verify that different setup values produce measurably different prompt content. Since LLM output is nondeterministic, we test the PROMPT CONSTRUCTION (which IS deterministic) rather than LLM output.

## Test 1 — Premise / Seed Concept

| Metric | Result |
|---|---|
| Premise A in buildExpandFoundationPrompt | ✅ Contains premise A text |
| Premise B in buildExpandFoundationPrompt | ✅ Contains premise B text |
| Prompts differ | ✅ Different strings |
| No premise bleed | ✅ Premise A not in prompt B |

## Test 2 — Chapter Length

| Setting | Word Target | Total (20 ch) | Status |
|---|---|---|---|
| flash (1000) | 1000 | 20,000 | ✅ |
| short (2000) | 2000 | 40,000 | ✅ |
| standard (3500) | 3500 | 70,000 | ✅ |
| long (5000) | 5000 | 100,000 | ✅ |
| epic (8500) | 8500 | 170,000 | ✅ |

## Test 3 — Chapter Count

| Count | In Constraints? | In Header? | Status |
|---|---|---|---|
| 5 | ✅ 'Exactly 5 chapters' | ✅ 'CHAPTERS: 5' | ✅ |
| 20 | ✅ 'Exactly 20 chapters' | ✅ 'CHAPTERS: 20' | ✅ |
| 50 | ✅ 'Exactly 50 chapters' | ✅ 'CHAPTERS: 50' | ✅ |

## Test 4 — Spice Level

| Level | Prompt Content | Status |
|---|---|---|
| 0 | No spice block | ✅ |
| 1 | No spice beat instructions | ✅ |
| 2 | 'Cracked Door' | ✅ |
| 3 | 'Open Door' + explicit beats | ✅ |
| 4 | 'Full Intensity' + EXPLICIT EROTICA | ✅ |

## Test 5 — Language Intensity

| Level | Prompt Content | Status |
|---|---|---|
| 0 | 'No profanity' | ✅ |
| 1 | 'Mild profanity' | ✅ |
| 2 | 'Moderate profanity' | ✅ |
| 3 | 'Strong profanity' | ✅ |
| 4 | 'Very strong profanity' | ✅ |

## Test 6 — Author Voice

| Voice | In Header? | In Prompt? | Status |
|---|---|---|---|
| Sparse Noir | ✅ | ✅ 'Write in the style of' | ✅ |
| Clean Commercial Romance | ✅ | ✅ | ✅ |
| Custom / None | ❌ Not in header | ✅ 'No named author imitation' | ✅ |
| Nora Ephron | ✅ | ✅ Custom dossier | ✅ |

## Test 7 — Tense/POV

| Setting | In Constraints? | In POV Block? | Status |
|---|---|---|---|
| first + present | ✅ | ✅ | ✅ |
| third-close + past | ✅ | ✅ | ✅ |
| nf-direct + present | ✅ | ✅ | ✅ |

## Test 8 — Beat Style

| Style | In Header? | In Beat Block? | Status |
|---|---|---|---|
| Tension-Driven | ✅ | ✅ 'urgent, lean, forward-driving' | ✅ |
| Slow Burn Romance | ✅ | ✅ 'tension accumulate gradually' | ✅ |
| Gritty Cinematic | ✅ | ✅ 'grounded cinematic realism' | ✅ |
| Screwball Comedy | ✅ | ✅ Comedy craft rules | ✅ |

## Test 9 — Story Arc Pacing

| Arc | Ch5/20 Tension | Ch15/20 Tension | Different? | Status |
|---|---|---|---|---|
| three_act | ~7 | ~9 | ✅ | ✅ |
| thriller_escalation | ~8 | ~9-10 | ✅ | ✅ |
| romance_arc | ~5 | ~8 | ✅ | ✅ |
| literary_character | ~4 | ~5 | ✅ | ✅ |

## Test 10 — Twists

| Setting | Twist Block Present? | Status |
|---|---|---|
| num_twists=0 | No twist requirements | ✅ |
| num_twists=3 | Twist requirements in prompt | ✅ |
| num_twists=7 | Larger twist requirements | ✅ |

## Verdict

**All 10 field categories produce measurable, visible prompt differences.** Each field's effect is deterministically verifiable through prompt construction analysis.
