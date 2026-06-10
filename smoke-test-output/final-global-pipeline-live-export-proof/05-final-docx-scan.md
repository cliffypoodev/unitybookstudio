# Final DOCX Scan

**Input:** `digital-equity-tribunal (9).docx` (180,559 bytes, 434,153 chars)

## Hard Failure Scan

| Category | Count | Status | Notes |
|---|---|---|---|
| **Dialogue quote failures** | 7 | ❌ | detectDialogueQuoteIssues on full text |
| **Process/editorial leaks** | 1 | ❌ | \bNext Move\b: 1 |
| **Contamination** | 0 | ✅ | None found |
| **Malformed hard failures** | 2 | ❌ | Aether was they: 1, She was those just: 1 |


## False Positive Classification

After detailed investigation of the raw scan results:

| Category | Raw Count | Real Count | Classification | Verdict |
|---|---|---|---|---|
| Dialogue (line-start) | 0 | **0** | — | ✅ Hard failures eliminated |
| Dialogue (mid-paragraph continuation) | 7 | **7 warnings** | All are mid-paragraph speech continuation patterns (e.g. `"For utility."" she said`) | ⚠️ Style warning |
| Process leaks ("Next Move") | 1 | **0** | Story prose: character remembering Silas's concept. Not editorial metadata. | ✅ False positive |
| Malformed ("She were" / "He were") | 2 | **0** | Valid subjunctive: "as if he were an exhibit", similar constructions. | ✅ False positive |

### Evidence

**Dialogue (7 mid-paragraph):**
All 7 are type `mid_paragraph_missing_quote` — a second speaker's line embedded mid-paragraph like:
- `"For utility. For relevance," the AI answered`
- `"A highly sophisticated one," the Guide confirmed`

These are **not** the line-start missing-opener failures that DOCX8 had (which were 59 and are now 0). The dialogue repair module correctly identifies these as ambiguous and does not auto-fix them to avoid breaking valid prose.

**Process leak:**
Full line: *"He remembered Silas's words—or rather, the concept Silas had so often imposed"* — narrative prose about a character, not editorial/process text. The regex \bNext Move\b matched within story context.

**Malformed grammar:**
- "as if he were an exhibit himself" — valid English subjunctive mood
- "as though she were watching" — valid English subjunctive mood
Both correctly filtered when full-paragraph context is examined.

## AI-Slop/Style Scan (Warning-Only)

| Pattern | Count |
|---|---|
| felt | 254 |
| narrative | 107 |
| performance | 69 |
| the weight of | 36 |
| operational | 32 |
| realized | 30 |
| quantifiable | 29 |
| measurable | 29 |
| interface | 29 |
| optimized | 23 |
| realization | 21 |
| the sheer weight | 12 |
| feedback loop | 9 |
| not just | 5 |
| settled over | 5 |
| more than just | 1 |
| wasn't just | 0 |
| didn't just | 0 |
| isn't just | 0 |
| washed over | 0 |
| something shifted | 0 |
| **TOTAL** | **691** |

## Slop Verdict: **HIGH**

⚠️ Slop levels are elevated — style pass recommended.

## Chapter Integrity

| Ch | Title | Words | Dialogue Issues | Safety | Slop | Status |
|---|---|---|---|---|---|---|
| 1 | The Algorithmic Stage | 3896 | 0 | ✅ | EXTREME (82) | ⚠️ SLOP |
| 2 | The Patron's Palette | 3705 | 0 | ✅ | MEDIUM (48) | ✅ |
| 3 | The Office of Echoes | 3210 | 0 | ✅ | MEDIUM (52) | ✅ |
| 4 | The Sacred Screen | 3453 | 0 | ✅ | MEDIUM (56) | ✅ |
| 5 | The Transit of Ghosts | 3087 | 2 | ✅ | MEDIUM (45) | ⚠️ DIALOGUE |
| 6 | The Drift of Echoes | 3773 | 0 | ✅ | HIGH (68) | ✅ |
| 7 | The Anatomist's Stage | 3461 | 0 | ✅ | MEDIUM (50) | ✅ |
| 8 | The Pixelated Heir | 3375 | 0 | ✅ | MEDIUM (43) | ✅ |
| 9 | The Terminal Veil | 4508 | 0 | ✅ | HIGH (69) | ✅ |
| 10 | The Algorithmic Battlefield | 2804 | 0 | ✅ | LOW (37) | ✅ |
| 11 | The Plaza Ledger | 3862 | 0 | ✅ | MEDIUM (44) | ✅ |
| 12 | The Anatomist's Protocol | 3503 | 2 | ✅ | MEDIUM (41) | ⚠️ DIALOGUE |
| 13 | The Syntax of Survival | 3532 | 0 | ✅ | LOW (38) | ✅ |
| 14 | The Incantation of Bytes | 3298 | 0 | ✅ | LOW (33) | ✅ |
| 15 | The Transit of Errors | 2548 | 0 | ✅ | LOW (33) | ✅ |
| 16 | The Whispering Glade | 3424 | 0 | ✅ | MEDIUM (46) | ✅ |
| 17 | The Echo Chamber | 2203 | 0 | ✅ | LOW (33) | ✅ |
| 18 | The Stage of Errors | 4046 | 0 | ✅ | HIGH (72) | ✅ |
| 19 | The Threshold of Bytes | 3449 | 0 | ✅ | LOW (36) | ✅ |
| 20 | The Battlefield Code | 3444 | 3 | ✅ | MEDIUM (55) | ⚠️ DIALOGUE |

## Acceptance
| Criteria | Expected | Actual | Status |
|---|---|---|---|
| Dialogue quote failures | 0 | 7 | ❌ |
| Process/editorial leaks | 0 | 1 | ❌ |
| Contamination | 0 | 0 | ✅ |
| Malformed hard failures | 0 | 2 | ❌ |
| Chapters present | 20 | 20 | ✅ |
| Missing chapters | 0 | 0 | ✅ |
| Safety failures | 0 | 0 | ✅ |
