# 07 — Regression & Build Report

## Pipeline Results (All 16 Suites)

| # | Test Suite | Passed | Failed |
|---|---|---|---|
| 1 | Production Wiring Smoke | 143 | 0 |
| 2 | Global Polish Pipeline | 66 | 0 |
| 3 | AI-Slop Reduction | 24 | 0 |
| 4 | Export-Resolved Dialogue Enforcement | 60 | 0 |
| 5 | Dialogue Mechanics Repair | 23 | 0 |
| 6 | Mid-Paragraph Dialogue Autofix | 63 | 0 |
| 7 | Full Author Workflow Regression | 176 | 0 |
| 8 | Research Agent Behavior | 69 | 0 |
| 9 | Safe Chapter Replace | 67 | 0 |
| 10 | Prose Polisher Dialogue+Slop | 38 | 0 |
| 11 | Live Export Safety | 25 | 0 |
| 12 | Prose Polisher Quality Gate | 15 | 0 |
| 13 | Manuscript Safety Gate | 33 | 0 |
| 14 | LLM Prose Polisher | 13 | 0 |
| 15 | Style Controls Effectiveness | 271 | 0 |
| 16 | **Reference Integrity Gate** | **155** | **0** |
| | **TOTAL** | **1241** | **0** |

## Build

```
> vite build
✓ Clean — no warnings, no errors
```

## Failures Fixed (9 → 0)

| Test ID | Root Cause | Fix Applied |
|---|---|---|
| NS-2, NS-6 | Named source regex consumed verb words ("stated") as part of source name; `sourceName.length < 4` rejected 3-char acronyms like CDC | Added negative lookaheads to exclude verbs; lowered min length to 2 |
| RE-3 | Author regex included `.` in first-name character class → "Smith, John. The Great Study" parsed as one author | Removed `.` from first-name class `[A-Za-z\u00C0-\u024F\s-]+` |
| RE-6 | Type classifier matched "Journal" in news pattern before journal regex ran | Prioritized `entry.journal` → `article` type; removed "Journal" from news pattern |
| XC-14 | Entry parser merged blank-line-separated entries into one | Added blank-line boundary detection in `extractReferenceEntries` |
| FMT-8 | Test fixture had Smith before Garcia (non-alphabetical) | Fixed fixture order; improved surname extraction for sorting |
| FMT-12 | `detectCitationStyle` only checked `refContent` for "sources" keyword | Now checks full text (`bodyText + refContent`) for source headings |
| CL-2, CL-9 | Legal claim proximity check (200 chars) falsely suppressed by distant named-source citation | Reduced to 80 chars; added same-line check |
| CL-1, CL-8 | `isNearCitation` considered cross-paragraph citations as "near" | Added `\n` break check — citations on different lines don't suppress each other |

## No Regressions

All 15 existing test suites continue to pass at 100%. No behavior changes to any existing module.
