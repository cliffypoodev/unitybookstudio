# Reference Formatting Validation — Report

## Method

Tested `validateReferenceFormatting()` against fixtures with various citation styles, heading presence/absence, URL/DOI preservation, and entry ordering.

## Citation Style Detection

| Fixture | Body Citations | Reference Format | Detected Style | Status |
|---|---|---|---|---|
| APA manuscript | `(Author, Year)` | Author-date entries | `apa` | ✅ |
| Endnote manuscript | `[1]`, `[2]` | Numbered entries | `endnote` | ✅ |
| Mixed manuscript | `(Author, Year)` + `[1]` | Mixed entries | `mixed` | ✅ |
| Generic sources list | None formal | Categorized source list | `generic` | ✅ |
| No citations, no refs | None | None | `unknown` | ✅ |

## Style Consistency Validation

| Scenario | Issue Flagged? | Severity | Status |
|---|---|---|---|
| APA body + APA references | No issues | — | ✅ |
| Endnote body + numbered refs | No issues | — | ✅ |
| Mixed APA + endnote in same doc | `MIXED_STYLE` | WARNING | ✅ |
| Expected APA but found endnote | `STYLE_MISMATCH` | WARNING | ✅ |

## Heading Validation

| Scenario | `headingPresent` | Issue? | Status |
|---|---|---|---|
| Has "References" heading | `true` | No | ✅ |
| Has "## Bibliography" heading | `true` | No | ✅ |
| No reference heading at all | `false` | `MISSING_HEADING` WARNING | ✅ |

## URL/DOI Preservation

| Asset | In Input | In Output | `preserved` Flag | Status |
|---|---|---|---|---|
| URL `https://www.census.gov/data` | ✅ | ✅ | `urlsPreserved: true` | ✅ |
| DOI `doi:10.1038/s41586-020-0001-1` | ✅ | ✅ | `doisPreserved: true` | ✅ |
| ISBN `ISBN: 978-0-06-112008-4` | ✅ | ✅ | — (extracted in entry) | ✅ |
| No URLs in text | — | — | `urlsPreserved: true` | ✅ |
| URL mentioned but stripped | ✅ | ❌ | `urlsPreserved: false` | ✅ Flagged |

## Entry Ordering

| Style | Expected Order | Actual Detection | Status |
|---|---|---|---|
| APA/MLA/Chicago | Alphabetical by author | `ordering: 'alphabetical'` | ✅ |
| Endnote | Numbered by appearance | `ordering: 'numbered'` | ✅ |
| Unordered | Random order | `ordering: 'non_alphabetical'` | ✅ |

## Entry Separation

| Format | Detection | Status |
|---|---|---|
| Double-spaced entries | `entrySeparation: 'double_spaced'` | ✅ |
| Single-spaced entries | `entrySeparation: 'single_spaced'` | ✅ |

## Known Limitation: DOCX Hyperlinks

> ⚠️ **DOCX export renders `[label](url)` as styled blue underlined text but strips the actual URL.** Only the label text survives in the DOCX output. This is a known limitation of the `parseInlineRuns()` function in `ExportTab.jsx` (line 3455). It does NOT affect markdown, HTML, or PDF exports.

## Verdict

✅ **Formatting validation correctly detects styles, flags inconsistencies, and verifies URL/DOI preservation.** All 5 citation styles recognized. Heading, ordering, and separation checks functional.
