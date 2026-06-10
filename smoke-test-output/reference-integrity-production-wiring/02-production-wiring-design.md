# Reference Integrity — Production Wiring Design

## Three Integration Points

### 1. Nonfiction Polish (always runs)
- **File:** `ProjectStudio.jsx` → `handleManuscriptPolishNonfiction()`
- **When:** After `runNonfictionPolish()` completes
- **Behavior:** Read-only gate. Reports findings via toast. Does NOT block save.
- **BLOCKING issues:** Error toast with details, logged to `window.__UBS_LAST_REFERENCE_REPORT`
- **WARNING issues:** Info toast with summary
- **Profiles:** `nonfiction`, `training_manual`, `business_guide` (always run)

### 2. Fiction Polish (auto-detect)
- **File:** `ProjectStudio.jsx` → `handleManuscriptPolish()`
- **When:** After improvement scoring (Step 12b-3), before quality gate (Step 12c)
- **Behavior:** Only runs if `shouldRunReferenceIntegrity()` detects reference sections or inline citations
- **Profiles:** `fiction`, `memoir`, `unknown` (auto-detect mode)
- **Fiction without refs:** Skipped entirely — zero overhead

### 3. Export Gate (always runs on text)
- **File:** `exportSafetyGate.js` → `runPreExportSafetyGate()`
- **When:** After per-chapter safety checks, on full assembled manuscript text
- **Behavior:** BLOCKING reference issues block export. Warnings reported but don't block.
- **Action type:** `REJECT_MANUAL_REVIEW` (not REJECT_REGENERATE — fix requires author correction)
- **Stored:** `window.__UBS_LAST_EXPORT_REFERENCE_REPORT`

## Severity Rules

### BLOCK (Export)
| Issue | Example |
|---|---|
| Fabricated citation | `Journal of Things`, `Doe, John`, `example.com` |
| Placeholder reference | `[SOURCE NEEDED]`, `[TK]`, `[TODO CITATION]` |
| Missing reference for major citation | `(Johnson, 2021)` with no Johnson in References |
| Bibliography section lost | Reference heading present before polish, absent after |
| URL/DOI dropped | URL in source, missing in export |

### WARNING (Report only)
| Issue | Example |
|---|---|
| Incomplete reference | Missing author, title, year, or publisher |
| Unused reference | Entry in References but never cited |
| Mixed citation style | Both APA and endnote markers |
| Missing access date | Web source without `Accessed` date |
| Unsupported statistic | `45 percent` without nearby citation |
| Legal/policy claim without date | `Federal law requires` without year |
| Duplicate reference | Same author+year appearing twice |

### INFO (Log only)
| Issue | Example |
|---|---|
| Current verification needed | `Currently, the policy states...` |
| Further Reading not cited | Entry in Further Reading section (expected) |
| Author's Note sources | Sources in Author's Note (expected for historical fiction) |

## Profile Configuration

| Profile | `referenceIntegrity` | Behavior |
|---|---|---|
| `nonfiction` | `true` | Always runs |
| `training_manual` | `true` | Always runs |
| `business_guide` | `true` | Always runs |
| `fiction` | `'auto'` | Runs only if refs detected |
| `memoir` | `'auto'` | Runs only if refs detected |
| `unknown` | `'auto'` | Runs only if refs detected |

## What Is NOT Changed
- Researcher Agent prompts (already have anti-fabrication language)
- `nonfictionPolish.js` internal credibility gate (complementary, not replaced)
- `bibliographyGenerator.js` (generates refs, not validates them)
- No cloud API calls — all validation is deterministic regex/heuristic
