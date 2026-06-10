# Bibliography/References/Endnotes/Citation Integrity — Test Plan

## Scope

Validate that UBS can **generate, preserve, validate, format, and export** bibliography/references/endnotes accurately for all book types that use sources.

## Book Types Under Test

| Book Type | Expected Behavior |
|---|---|
| Nonfiction (investigative) | Full bibliography, strict source discipline, contamination blocking |
| Training manual | Source list, practical references, structure preservation |
| Business guide | Selected sources, domain-appropriate references |
| Memoir with sources | Light source notes, Author's Note |
| Historical fiction with notes | Author's Note on sources — NOT academic bibliography |
| Academic-style (if supported) | Formal citation style, endnotes/footnotes |

## Feature Inventory

| Feature | Module | Status |
|---|---|---|
| Bibliography chapter generation | `bibliographyGenerator.js` | ✅ Exists |
| Domain-aware source scaffolding | `bibliographyGenerator.js` | ✅ Exists |
| Bibliography chapter detection | `bibliographyGenerator.js`, `nonfictionPolish.js`, `ExportTab.jsx`, `manuscriptFixer.js` | ✅ Exists (4 modules) |
| Placeholder detection & removal | `nonfictionPolish.js`, `finalProofread.js` | ✅ Exists |
| Finance contamination blocking | `nonfictionPolish.js`, `manuscriptFixer.js`, `ExportTab.jsx` | ✅ Exists |
| Bibliography integrity cleaning | `nonfictionPolish.js` `cleanBibliographyIntegrity()` | ✅ Exists |
| Export bibliography repair | `ExportTab.jsx` `repairNonfictionBibliographyExportText()` | ✅ Exists |
| Export blocking (missing/thin bib) | `ExportTab.jsx` `hardBlockExportIfNonfictionSourceIntegrityFails()` | ✅ Exists |
| **Inline citation extraction** | **`referenceIntegrityGate.js`** | **🆕 New** |
| **Citation ↔ reference crosscheck** | **`referenceIntegrityGate.js`** | **🆕 New** |
| **Reference formatting validation** | **`referenceIntegrityGate.js`** | **🆕 New** |
| **Suspicious/fabricated detection** | **`referenceIntegrityGate.js`** | **🆕 New** |
| **Unsupported claim flagging** | **`referenceIntegrityGate.js`** | **🆕 New** |
| Endnote/footnote rendering | None | ❌ Not built |
| DOCX hyperlink preservation | `ExportTab.jsx` | ⚠️ Links render as styled text, URL lost |

## Risk Matrix

| Risk | Severity | Mitigation |
|---|---|---|
| Fabricated sources leak to export | CRITICAL | `detectSuspiciousReferences()` + existing placeholder/contamination gates |
| Citations don't match bibliography | HIGH | `crosscheckCitationsToReferences()` cross-validation |
| Finance sources contaminate non-finance bib | HIGH | Existing `FINANCE_CONTAMINATION_RE` in 3 modules |
| Bibliography removed during polish | HIGH | `cleanBibliographyIntegrity()` has conservative removal + existing tests |
| Statistics without sources pass proofread | MEDIUM | `flagUnsupportedClaims()` + existing `OVERCLAIM_RX` |
| Mixed citation styles confuse readers | MEDIUM | `validateReferenceFormatting()` style detection |
| URLs/DOIs stripped during export | MEDIUM | `validateReferenceFormatting()` preservation check |
| Endnotes referenced but not rendered | LOW | System documents this gap; no endnote rendering exists |

## Test Coverage Plan

| Test Category | Test Count | Module |
|---|---|---|
| Reference section detection | 12 | `referenceIntegrityGate.js` |
| APA inline citation extraction | 8 | `referenceIntegrityGate.js` |
| Bracketed/endnote extraction | 6 | `referenceIntegrityGate.js` |
| Named-source extraction | 6 | `referenceIntegrityGate.js` |
| Reference entry parsing | 12 | `referenceIntegrityGate.js` |
| Citation-to-reference crosscheck | 15 | `referenceIntegrityGate.js` |
| Formatting validation | 12 | `referenceIntegrityGate.js` |
| Suspicious reference detection | 10 | `referenceIntegrityGate.js` |
| Unsupported claim detection | 10 | `referenceIntegrityGate.js` |
| URL/DOI preservation | 8 | `referenceIntegrityGate.js` |
| No-fabrication contract | 8 | `referenceIntegrityGate.js` |
| No auto-deletion contract | 6 | `referenceIntegrityGate.js` |
| Further Reading handling | 6 | `referenceIntegrityGate.js` |
| Historical fiction notes | 6 | `referenceIntegrityGate.js` |
| Full gate integration | 12 | `referenceIntegrityGate.js` |
| Safety regression | 8 | `referenceIntegrityGate.js` |
| Existing module integration | 10 | `bibliographyGenerator.js` interop |
| **Total** | **~155** | |

## Non-Goals

- ❌ This is **not** a manuscript rewrite task
- ❌ This does **not** build a full endnote/footnote rendering system
- ❌ This does **not** add DOCX hyperlink support
- ❌ This does **not** use Digital Equity Tribunal-specific logic
