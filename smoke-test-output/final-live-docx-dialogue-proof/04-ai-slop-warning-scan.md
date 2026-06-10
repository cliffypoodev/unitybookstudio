# AI-Slop Warning Scan — DOCX9

## Per-Chapter AI-Slop Density

| Chapter | Title | Total Slop | Worst Pattern | Worst Count | Severity | Recommendation |
|---------|-------|-----------|---------------|-------------|----------|----------------|
| 1 | The Algorithmic Stage | 47 | `felt` | 19 | ⚠️ HIGH | Run Polish to reduce `felt` count |
| 2 | The Patron's Palette | 30 | `felt` | 17 | ⚠️ MODERATE | Addressable via style pass |
| 3 | The Tribunal Opens | 27 | `felt` | 13 | ⚠️ MODERATE | Addressable via style pass |
| 4 | The Sacred Screen | 22 | `felt` | 11 | LOW | Acceptable |
| 5 | The Transit of Ghosts | 32 | `felt` | 16 | ⚠️ MODERATE | Addressable via style pass |
| 6 | The Drift of Echoes | 33 | `felt` | 15 | ⚠️ MODERATE | Addressable via style pass |
| 7 | The Anatomist's Stage | 21 | `felt` | 11 | LOW | Acceptable |
| 8 | The Quiet Burn | 24 | `felt` | 7 | LOW | Acceptable |
| 9 | The Jury of Mirrors | 36 | `felt` | 19 | ⚠️ HIGH | Run Polish to reduce `felt` count |
| 10 | The Patron's Crown | 20 | `felt` | 11 | LOW | Acceptable |
| 11 | The Cipher's Weight | 23 | `felt` | 13 | LOW | Acceptable |
| 12 | The Anatomist's Protocol | 24 | `felt` | 11 | LOW | Acceptable |
| 13 | The Ghost's Ledger | 19 | `felt` | 11 | LOW | Acceptable |
| 14 | The Incantation of Bytes | 22 | `felt` | 12 | LOW | Acceptable |
| 15 | The Witness's Algorithm | 19 | `felt` | 10 | LOW | Acceptable |
| 16 | The Archive of Echoes | 20 | `felt` | 8 | LOW | Acceptable |
| 17 | The Closing Argument | 22 | `felt` | 9 | LOW | Acceptable |
| 18 | The Verdict of Light | 41 | `felt` | 15 | ⚠️ HIGH | Run Polish to reduce `felt` count |
| 19 | The Aftermath Accord | 23 | `felt` | 10 | LOW | Acceptable |
| 20 | The Battlefield Code | 32 | `felt` | 16 | ⚠️ MODERATE | Addressable via style pass |

## Summary

- **Total slop hits across all chapters:** 537
- **Average per chapter:** 26.9
- **Worst chapter:** Ch.1 (47 hits)
- **Dominant pattern:** `felt` (accounts for ~47% of all slop hits)
- **Chapters with HIGH severity (>35 hits):** Ch.1, Ch.9, Ch.18
- **Chapters with MODERATE severity (25-35 hits):** Ch.2, Ch.3, Ch.5, Ch.6, Ch.20

## Classification

**This is WARNING-ONLY, not blocking.**

AI-slop patterns like `felt`, `not just`, `the weight of` are style issues, not mechanical failures. They don't violate dialogue mechanics, safety gates, or structural integrity. They represent overuse of common AI-generated prose cadences that would benefit from a targeted style pass.

## Recommendation

Run the Polish Manuscript AI-slop reduction pass on the 3 HIGH-severity chapters (Ch.1, Ch.9, Ch.18) as a future style improvement. The remaining chapters are within acceptable density ranges.
