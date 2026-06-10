# Post-Repair Quality Gate Report

**Scan Date:** 2026-06-06T20:35:27.607Z

## Anthology Verdict

| Metric | Value |
|---|---|
| Process Leakage Count | 1 |
| Heavy Slop Count | 3 |
| Avg Sameness Score | 2.8 |
| Gate Verdict | **PARTIAL_PASS** |

## Per-Chapter Results

| Ch | Title | Repair | WC | Leaks | Slop | Dialogue | Sameness | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | The Algorithmic Stage | STANDARD_POLISHED | 3323 | 0 | 27 | 0 (CLEAN) | 3 | PASS |
| 2 | The Patron's Palette | MECHANICAL_CLEANUP | 1957 | 0 | 19 | 31 (CRITICAL) | 3 | MINOR_FLAGS |
| 3 | The Office of Echoes | STANDARD_POLISHED | 3746 | 0 | 20 | 0 (CLEAN) | 3 | PASS |
| 4 | The Sacred Screen | STANDARD_POLISHED | 2662 | 0 | 15 | 0 (CLEAN) | 2 | PASS |
| 5 | The Transit of Ghosts | STANDARD_POLISHED | 1815 | 0 | 9 | 0 (CLEAN) | 3 | PASS |
| 6 | The Drift of Echoes | REGENERATED | 2111 | 0 | 11 | 1 (MINOR) | 2 | PASS |
| 7 | The Anatomist's Stage | DEEP_POLISHED | 3720 | 0 | 16 | 0 (CLEAN) | 4 | PASS |
| 8 | The Pixelated Heir | STANDARD_POLISHED | 3425 | 0 | 26 | 0 (CLEAN) | 3 | MINOR_FLAGS |
| 9 | The Terminal Veil | STANDARD_POLISHED | 3501 | 1 | 31 | 0 (CLEAN) | 2 | FAIL_PROCESS_LEAK |
| 10 | The Algorithmic Battlefield | REGENERATED | 3233 | 0 | 19 | 3 (MINOR) | 2 | NEEDS_REVIEW |
| 11 | The Plaza Ledger | DEEP_POLISHED | 5777 | 0 | 22 | 0 (CLEAN) | 4 | PASS |
| 12 | The Anatomist's Protocol | DEEP_POLISHED | 4820 | 0 | 18 | 0 (CLEAN) | 3 | PASS |
| 13 | The Syntax of Survival | STANDARD_POLISHED | 2478 | 0 | 7 | 0 (CLEAN) | 3 | PASS |
| 14 | The Incantation of Bytes | DEEP_POLISHED | 4063 | 0 | 21 | 0 (CLEAN) | 4 | NEEDS_REVIEW |
| 15 | The Transit of Errors | REGENERATED | 2515 | 0 | 14 | 0 (CLEAN) | 2 | PASS |
| 16 | The Whispering Glade | DEEP_POLISHED | 3993 | 0 | 18 | 0 (CLEAN) | 3 | PASS |
| 17 | The Echo Chamber | STANDARD_POLISHED | 3869 | 0 | 22 | 0 (CLEAN) | 3 | MINOR_FLAGS |
| 18 | The Stage of Errors | STANDARD_POLISHED | 1992 | 0 | 10 | 0 (CLEAN) | 2 | PASS |
| 19 | The Threshold of Bytes | STANDARD_POLISHED | 1466 | 0 | 10 | 0 (CLEAN) | 2 | PASS |
| 20 | The Battlefield Code | DEEP_POLISHED | 3403 | 0 | 17 | 0 (CLEAN) | 2 | PASS |

## Process Leak Details

### Chapter 9: The Terminal Veil

- **"Self-Correction"** at pos 3268
  `cy' with ' Bias,' and ' Anomaly' with ' Self-Correction.
This is not external fraud, a dry voic`

## Slop Flags

- **Ch 2** (The Patron's Palette): FLAG_POLISH_REQUIRED: banned words [shimmering]
- **Ch 8** (The Pixelated Heir): FLAG_STYLE_REVIEW: "felt" > 12
- **Ch 9** (The Terminal Veil): FLAG_HEAVY_SLOP: "the weight of" > 3; FLAG_STYLE_REVIEW: "felt" > 12
- **Ch 10** (The Algorithmic Battlefield): FLAG_HEAVY_SLOP: "the weight of" > 3
- **Ch 14** (The Incantation of Bytes): FLAG_HEAVY_SLOP: "narrative" > 5
- **Ch 17** (The Echo Chamber): FLAG_STYLE_REVIEW: "felt" > 12

## Opening/Ending Issues

- **Ch 4**: Opens with "The air..."
- **Ch 17**: Opens with "The air..."
- **Ch 18**: Opens with "The air..."

