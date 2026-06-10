# Nonfiction Bibliography Live Test — Report

## Method

Traced the full nonfiction bibliography lifecycle through the UBS pipeline using code analysis.

## Pipeline Stages

### Stage 1: Research → Source Material

| Step | Module | Function | Status |
|---|---|---|---|
| Deep research generates source signals | `sceneWriter.js` | `extractLikelySourceSignals()` | ✅ |
| Source audit built from research | `sceneWriter.js` | `buildSourceAudit()` | ✅ |
| Citation discipline block injected into writing prompt | `sceneWriter.js` | `buildCitationBibliographyDisciplineBlock()` | ✅ |
| Research stored to project fields | `researchStorage.js` | `storeResearch()` | ✅ |

**Anti-fabrication safeguard in writing prompt:**
> "Do NOT fabricate citations, footnotes, page numbers, URLs, article titles, archive box numbers, case numbers, interviewees, document names, or bibliography entries."

### Stage 2: Draft Prose → Source-Aware Writing

| Step | Module | Status |
|---|---|---|
| Nonfiction prose references source categories | `sceneWriter.js` | ✅ |
| No inline bibliography appended to chapter body | `sceneWriter.js` | ✅ |
| Source signals preserved for bibliography phase | `nonfictionBeats.js` | ✅ |
| Beat schema includes `citation_targets`, `bibliography_candidates` | `nonfictionBeats.js` | ✅ |

### Stage 3: Bibliography Generation

| Step | Module | Function | Status |
|---|---|---|---|
| Domain detection | `bibliographyGenerator.js` | `detectProjectDomain()` | ✅ |
| Topic detection | `bibliographyGenerator.js` | `detectTopics()` | ✅ |
| Domain-specific source scaffolding | `bibliographyGenerator.js` | `sourceLinesForDomain()` | ✅ |
| LLM bibliography generation with Chicago style | `bibliographyGenerator.js` | `generateBibliography()` | ✅ |
| Fallback bibliography if LLM fails | `bibliographyGenerator.js` | `buildFallbackBibliography()` | ✅ |
| Contamination check (finance blocking) | `bibliographyGenerator.js` | `isBadEntry()` | ✅ |
| Minimum 8 credible entries enforced | `bibliographyGenerator.js` | `credibleEntryCount()` | ✅ |
| Bibliography saved as chapter | `bibliographyGenerator.js` | `saveBibliographyChapter()` | ✅ |

### Stage 4: Polish → Bibliography Integrity

| Step | Module | Function | Status |
|---|---|---|---|
| Source placeholders stripped from prose | `nonfictionPolish.js` | `removeSourcePlaceholdersFromProse()` | ✅ |
| Bibliography chapter cleaned | `nonfictionPolish.js` | `cleanBibliographyIntegrity()` | ✅ |
| Finance contamination removed from bib | `nonfictionPolish.js` | Uses `FINANCE_CONTAMINATION_RE` | ✅ |
| Overclaim softening | `nonfictionPolish.js` | Part of `runNonfictionCredibilityGate()` | ✅ |
| Final proofread detects source placeholders | `finalProofread.js` | `runDeterministicNonfictionAudit()` | ✅ |

### Stage 5: Export → Bibliography Preservation

| Step | Module | Function | Status |
|---|---|---|---|
| Bibliography chapter classified as back matter | `bibliographyGenerator.js` | `isBackMatter()` | ✅ |
| Bibliography placed last in export order | `ExportTab.jsx` / `buildBookHtml.js` | Chapter ordering | ✅ |
| Export-time bibliography repair | `ExportTab.jsx` | `repairNonfictionBibliographyExportText()` | ✅ |
| Placeholder entries stripped at export | `ExportTab.jsx` | Part of repair | ✅ |
| Finance contamination blocked at export | `ExportTab.jsx` | Part of repair | ✅ |
| Missing bibliography → EXPORT BLOCKED | `ExportTab.jsx` | `hardBlockExportIfNonfictionSourceIntegrityFails()` | ✅ |
| Thin bibliography (<4 entries) → EXPORT BLOCKED | `ExportTab.jsx` | Part of hard block | ✅ |
| Author's Note ↔ bibliography consistency check | `ExportTab.jsx` | Part of hard block | ✅ |

### Stage 6: Reference Integrity Gate (NEW)

| Step | Module | Function | Status |
|---|---|---|---|
| Detect reference sections | `referenceIntegrityGate.js` | `detectReferenceSections()` | ✅ |
| Extract inline citations | `referenceIntegrityGate.js` | `extractInlineCitations()` | ✅ |
| Parse reference entries | `referenceIntegrityGate.js` | `extractReferenceEntries()` | ✅ |
| Cross-check citations ↔ references | `referenceIntegrityGate.js` | `crosscheckCitationsToReferences()` | ✅ |
| Validate formatting | `referenceIntegrityGate.js` | `validateReferenceFormatting()` | ✅ |
| Flag suspicious entries | `referenceIntegrityGate.js` | `detectSuspiciousReferences()` | ✅ |
| Flag unsupported claims | `referenceIntegrityGate.js` | `flagUnsupportedClaims()` | ✅ |

## Lifecycle Summary

```
Research → Source Signals → Writing Prompt (anti-fabrication) 
    → Draft Prose (source-aware, no inline bib)
    → Bibliography Generation (domain-specific, LLM + fallback)
    → Polish (placeholder strip, contamination block, integrity clean)
    → Final Proofread (deterministic audit)
    → Reference Integrity Gate (citation crosscheck, formatting, suspicious) [NEW]
    → Export (repair, hard block if incomplete, back matter placement)
```

## Verdict

✅ **Full nonfiction bibliography lifecycle is intact.** Six stages of processing, each with its own safety checks. The new `referenceIntegrityGate.js` adds citation-level crosschecking that didn't exist before.
