# Live Nonfiction Reference Test

## Synthetic Test Manuscript

A synthetic nonfiction manuscript was constructed with:
- 3 chapters with body text
- Inline APA citations: `(Smith, 2020)`, `(Johnson & Lee, 2019)`
- Bracketed endnote citations: `[1]`, `[2]`, `[3]`
- Named-source claims: "According to the CDC..."
- Unsupported statistic: "About 65 percent of Americans..."
- Current policy claim: "Currently, federal law requires..."
- References section with 6 entries (journal article, book, government report, news article, web source, archival source)
- Further Reading section with 2 entries
- 1 incomplete reference (missing year)
- 1 duplicate reference (same author+year)
- 1 unused reference (not cited anywhere)
- 1 fake-looking placeholder: `Author, First. "Example Study." Journal of Things, Vol. X, 20XX.`
- 1 URL: `https://www.cdc.gov/example-report`
- 1 DOI: `doi:10.1234/test.2021.001`

## Test Results

| Check | Expected | Actual | Status |
|---|---|---|---|
| Reference section detected | Yes | Yes (1 References + 1 Further Reading) | ✅ |
| Inline citations detected | Yes | Yes (APA + endnote + named) | ✅ |
| Missing reference flagged | Yes (for uncited author) | BLOCKING: MISSING_REFERENCE | ✅ |
| Incomplete reference flagged | Yes | WARNING: INCOMPLETE_REFERENCE (MISSING_YEAR) | ✅ |
| Duplicate reference flagged | Yes | WARNING: DUPLICATE_REFERENCE | ✅ |
| Fake placeholder flagged | Yes | BLOCKING: LIKELY_FABRICATED (Journal of Things) | ✅ |
| Unsupported statistic flagged | Yes | WARNING: UNSUPPORTED_STATISTIC | ✅ |
| Current verification needed | Yes | INFO: CURRENT_VERIFICATION_NEEDED | ✅ |
| Further Reading distinguished | Yes | Type = `further_reading`, NOT crosschecked | ✅ |
| URLs preserved | Yes | `urlsPreserved: true` | ✅ |
| DOIs preserved | Yes | `doisPreserved: true` | ✅ |
| No invented citation details | Yes | Gate is read-only, never mutates | ✅ |
| Export blocks on BLOCKING | Yes | `ok: false` due to fabricated + missing | ✅ |
| Warnings appear in report | Yes | 4 warnings in report | ✅ |
| Gate summary includes counts | Yes | All counts present | ✅ |

## Reference Preservation Through Export

| Item | Before Export | After Export | Status |
|---|---|---|---|
| `## References` heading | Present | Preserved (back matter) | ✅ |
| `## Further Reading` heading | Present | Preserved (back matter) | ✅ |
| APA citations in body | 2 citations | 2 citations (unchanged) | ✅ |
| Endnote markers | 3 markers | 3 markers (unchanged) | ✅ |
| URL in reference | `https://www.cdc.gov/...` | Preserved in text | ✅ |
| DOI in reference | `doi:10.1234/...` | Preserved in text | ✅ |
