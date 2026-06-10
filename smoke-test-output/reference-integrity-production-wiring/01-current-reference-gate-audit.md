# Reference Integrity Gate — Current Audit

## Module: `src/lib/referenceIntegrityGate.js`
- Lines: 963
- Exports: 8 functions
- Tests: 155 assertions in `tests/referenceIntegrityGate.test.mjs` (929 lines)
- Production-Wired: ❌ NO (before this change) → ✅ YES (after)

## Exported Functions

| Function | Line | Detects | Severity |
|---|---|---|---|
| `detectReferenceSections` | L112 | Bibliography/References/Works Cited/Sources/Endnotes/Further Reading/Author's Note headings | N/A |
| `extractInlineCitations` | L176 | APA `(Author, 2021)`, MLA `(Author 23)`, endnote `[1]`, named sources | N/A |
| `extractReferenceEntries` | L271 | Author, title, year, publisher, journal, URL, DOI, ISBN, access date | N/A |
| `crosscheckCitationsToReferences` | L457 | Missing references, unused references, duplicate references | BLOCKING/WARNING |
| `validateReferenceFormatting` | L609 | Style consistency, URL/DOI preservation, alphabetical ordering | WARNING |
| `detectSuspiciousReferences` | L724 | Placeholder markers, fabrication indicators, too-short entries | BLOCKING/WARNING |
| `flagUnsupportedClaims` | L781 | Unsupported statistics, legal/policy claims, current verification needed | WARNING/INFO |
| `runReferenceIntegrityGate` | L865 | Full orchestrator — aggregates all checks | BLOCKING/WARNING/INFO |

## Severity Levels

| Severity | Triggers | Effect |
|---|---|---|
| BLOCKING | Fabricated/placeholder references, missing major citations | Blocks export |
| WARNING | Incomplete references, unused references, mixed citation style, unsupported stats/legal | Reported, does not block |
| INFO | Current verification needed (temporal claims) | Reported only |

## Section Classification

Distinguishes between:
- `references` — formal reference list
- `bibliography` — formal bibliography
- `works_cited` — Works Cited section
- `sources` — Sources section
- `endnotes` — Endnotes/Notes
- `further_reading` — Further Reading (NOT crosschecked as citations)
- `authors_note` — Author's Note (NOT crosschecked)

## What It Does NOT Do
- Does NOT mutate text
- Does NOT fabricate missing data
- Does NOT auto-complete DOI, URL, publisher, page number, journal title, or access date
- Does NOT delete unused sources
- Does NOT convert fiction into citation-heavy output

## Production Wiring Gaps (Before This Change)

| File | Current Role | Production-Wired? | Test Coverage | Gap | Action |
|---|---|---|---|---|---|
| `referenceIntegrityGate.js` | Reference/citation checker | ❌ No | 155 tests | Not imported anywhere | Import + call in polish + export |
| `polishPipelineConfig.js` | Profile routing | ✅ Yes | 66 tests | No `referenceIntegrity` flag | Add flag per profile |
| `ProjectStudio.jsx` | NF polish handler | ✅ Yes | Workflow tests | No reference gate call | Call after NF polish |
| `ProjectStudio.jsx` | Fiction polish handler | ✅ Yes | Workflow tests | No reference gate call | Call with auto-detect |
| `exportSafetyGate.js` | Export safety | ✅ Yes | 25 tests | No reference checks | Call on full manuscript |
