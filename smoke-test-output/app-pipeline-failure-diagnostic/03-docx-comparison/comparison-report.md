# DOCX Comparison Report

## File Summary

| File | Chapters | Total Words | Process Leaks | Contamination | Malformed | Quote Issues |
|------|----------|-------------|---------------|---------------|-----------|--------------|
| Rewrite (2).docx | 20 | 69988 | 7 | 19 | 2 | 6 |
| Polished (3).docx | 20 | 69797 | 7 | 19 | 4 | 0 |

## Per-Chapter Comparison

| Ch | Title | Rewrite WC | Polish WC | Δ | Rewrite Leaks | Polish Leaks | Rewrite Contam | Polish Contam | Rewrite Malformed | Polish Malformed | Rewrite QI | Polish QI | Rewrite Status | Polish Status |
|----|-------|-----------|----------|---|---------------|--------------|----------------|---------------|-------------------|------------------|-----------|----------|----------------|--------------|
| 1 | The Algorithmic Stage | 2703 | 2674 | -29 | 0 | 0 | 0 | 0 | 2 | 2 | 0 | 0 | FAIL_MALFORMED | FAIL_MALFORMED |
| 2 | The Patron's Palette | 3818 | 3811 | -7 | 7 | 7 | 6 | 6 | 0 | 2 | 0 | 0 | FAIL_PROCESS_LEAK | FAIL_PROCESS_LEAK |
| 3 | The Office of Echoes | 3084 | 3073 | -11 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASS | PASS |
| 4 | The Sacred Screen | 3505 | 3495 | -10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASS | PASS |
| 5 | The Transit of Ghosts | 3710 | 3697 | -13 | 0 | 0 | 1 | 1 | 0 | 0 | 6 | 0 | FAIL_CONTAMINATION | FAIL_CONTAMINATION |
| 6 | The Drift of Echoes | 3468 | 3461 | -7 | 0 | 0 | 2 | 2 | 0 | 0 | 0 | 0 | FAIL_CONTAMINATION | FAIL_CONTAMINATION |
| 7 | The Anatomist's Stage | 3723 | 3711 | -12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASS | PASS |
| 8 | The Pixelated Heir | 3369 | 3369 | 0 | 0 | 0 | 2 | 2 | 0 | 0 | 0 | 0 | FAIL_CONTAMINATION | FAIL_CONTAMINATION |
| 9 | The Terminal Veil | 1554 | 1550 | -4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASS | PASS |
| 10 | The Algorithmic Battlefield | 2809 | 2805 | -4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASS | PASS |
| 11 | The Plaza Ledger | 3732 | 3721 | -11 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASS | PASS |
| 12 | The Anatomist's Protocol | 3798 | 3792 | -6 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | FAIL_CONTAMINATION | FAIL_CONTAMINATION |
| 13 | The Syntax of Survival | 3542 | 3531 | -11 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | FAIL_CONTAMINATION | FAIL_CONTAMINATION |
| 14 | The Incantation of Bytes | 4432 | 4414 | -18 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASS | PASS |
| 15 | The Transit of Errors | 4092 | 4086 | -6 | 0 | 0 | 4 | 4 | 0 | 0 | 0 | 0 | FAIL_CONTAMINATION | FAIL_CONTAMINATION |
| 16 | The Whispering Glade | 3421 | 3418 | -3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASS | PASS |
| 17 | The Echo Chamber | 3495 | 3483 | -12 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | FAIL_CONTAMINATION | FAIL_CONTAMINATION |
| 18 | The Stage of Errors | 3595 | 3580 | -15 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASS | PASS |
| 19 | The Threshold of Bytes | 4576 | 4573 | -3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASS | PASS |
| 20 | The Battlefield Code | 3447 | 3438 | -9 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | FAIL_CONTAMINATION | FAIL_CONTAMINATION |

## Hard Failure Chapters

### Rewrite (2).docx

**Chapter 1: The Algorithmic Stage** — FAIL_MALFORMED
- Malformed: "Was was" (×1), "It was was" (×1)

**Chapter 2: The Patron's Palette** — FAIL_PROCESS_LEAK
- Process leaks: "The opening is sharp, highly polished" (×1), "Next Move:" (×1), "Action Plan:" (×1), "The current trajectory is working exactly as planned" (×1), "We have established the what and the why" (×1), "We need to move" (×2), "Focus on how" (×1)
- Contamination: "Unity Supported Living Services" (×1), "Unity Supported Living" (×2), "Unity Media Solutions" (×1), "Unity Media" (×2), "care documentation" (×1), "compliance documentation" (×1)

**Chapter 5: The Transit of Ghosts** — FAIL_CONTAMINATION
- Contamination: "ROI" (×1)

**Chapter 6: The Drift of Echoes** — FAIL_CONTAMINATION
- Contamination: "Unity Media Solutions" (×1), "Unity Media" (×1)

**Chapter 8: The Pixelated Heir** — FAIL_CONTAMINATION
- Contamination: "ROI" (×1), "startup" (×2)

**Chapter 12: The Anatomist's Protocol** — FAIL_CONTAMINATION
- Contamination: "Q3" (×2)

**Chapter 13: The Syntax of Survival** — FAIL_CONTAMINATION
- Contamination: "startup" (×4)

**Chapter 15: The Transit of Errors** — FAIL_CONTAMINATION
- Contamination: "Unity Supported Living Services" (×1), "Unity Supported Living" (×1), "Unity Media Solutions" (×1), "Unity Media" (×1)

**Chapter 17: The Echo Chamber** — FAIL_CONTAMINATION
- Contamination: "ROI" (×2)

**Chapter 20: The Battlefield Code** — FAIL_CONTAMINATION
- Contamination: "ROI" (×2)


### Polished (3).docx

**Chapter 1: The Algorithmic Stage** — FAIL_MALFORMED
- Malformed: "Was was" (×1), "It was was" (×1)

**Chapter 2: The Patron's Palette** — FAIL_PROCESS_LEAK
- Process leaks: "The opening is sharp, highly polished" (×1), "Next Move:" (×1), "Action Plan:" (×1), "The current trajectory is working exactly as planned" (×1), "We have established the what and the why" (×1), "We need to move" (×2), "Focus on how" (×1)
- Contamination: "Unity Supported Living Services" (×1), "Unity Supported Living" (×2), "Unity Media Solutions" (×1), "Unity Media" (×2), "care documentation" (×1), "compliance documentation" (×1)
- Malformed: "You was" (×1), "Was was" (×1)

**Chapter 5: The Transit of Ghosts** — FAIL_CONTAMINATION
- Contamination: "ROI" (×1)

**Chapter 6: The Drift of Echoes** — FAIL_CONTAMINATION
- Contamination: "Unity Media Solutions" (×1), "Unity Media" (×1)

**Chapter 8: The Pixelated Heir** — FAIL_CONTAMINATION
- Contamination: "ROI" (×1), "startup" (×2)

**Chapter 12: The Anatomist's Protocol** — FAIL_CONTAMINATION
- Contamination: "Q3" (×2)

**Chapter 13: The Syntax of Survival** — FAIL_CONTAMINATION
- Contamination: "startup" (×4)

**Chapter 15: The Transit of Errors** — FAIL_CONTAMINATION
- Contamination: "Unity Supported Living Services" (×1), "Unity Supported Living" (×1), "Unity Media Solutions" (×1), "Unity Media" (×1)

**Chapter 17: The Echo Chamber** — FAIL_CONTAMINATION
- Contamination: "ROI" (×2)

**Chapter 20: The Battlefield Code** — FAIL_CONTAMINATION
- Contamination: "ROI" (×2)


## Slop Phrase Comparison (Rewrite → Polished)

| Term | Rewrite Total | Polish Total | Δ |
|------|--------------|-------------|---|
| not just | 85 | 3 | -82 |
| wasn't just | 0 | 0 | 0 |
| isn't just | 0 | 0 | 0 |
| more than just | 12 | 1 | -11 |
| the weight of | 43 | 43 | 0 |
| the narrative | 25 | 25 | 0 |
| felt | 223 | 223 | 0 |
| realized | 41 | 41 | 0 |
| palpable | 5 | 0 | -5 |
| meticulously | 7 | 0 | -7 |
| luminous | 3 | 0 | -3 |
| shimmering | 11 | 0 | -11 |
| ethereal | 1 | 0 | -1 |
