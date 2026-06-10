# Retrieval Context Trace

> Generated: 2026-06-08

## Overview

This document traces every function that assembles context for LLM prompt payloads, assessing whether each could introduce Unity/caregiving contamination or mix data across projects.

## Context Builder Functions

| Function | Input Scope | Cross-Project Risk? | Assessment |
|---|---|---|---|
| `buildProjectContextHeader` | Single `spec` object | No | ✅ **SAFE** |
| `buildSetupConstraints` | Single `project` object | No | ✅ **SAFE** |
| `sceneWriter.buildFictionPrompt` | Single `project` object | No | ✅ **SAFE** |
| `anthologyEngine` | Single `project` object | No | ✅ **SAFE** |
| `bibliographyGenerator.detectProjectDomain` | Manuscript TEXT patterns | **Yes — matches on text, not project_id** | 🔴 **UNSAFE** (Vector 2) |
| `bibliographyGenerator.sourceLinesForDomain` | Domain string from `detectProjectDomain` | **Yes — returns hardcoded domain sources** | 🔴 **UNSAFE** (Vector 2) |
| `chapterStorage.resolveChapterContent` | Single chapter record | No | ✅ **SAFE** |

## Detailed Analysis

### `buildProjectContextHeader` — ✅ SAFE

- **Input**: A single `spec` object containing project metadata (title, genre, voice, etc.)
- **Behavior**: Formats project metadata into a header string for the LLM prompt
- **Scope**: Strictly scoped to the provided `spec` — no database queries, no file reads, no cross-project references
- **Unity risk**: None. Template contains no Unity terms. Output depends entirely on the `spec` contents.

### `buildSetupConstraints` — ✅ SAFE

- **Input**: A single `project` object
- **Behavior**: Builds constraint strings (word count, style, tone) from project settings
- **Scope**: Single project only
- **Unity risk**: None. Constraints are derived from project configuration, not external data.

### `sceneWriter.buildFictionPrompt` — ✅ SAFE

- **Input**: A single `project` object plus chapter/scene context
- **Behavior**: Assembles the full fiction generation prompt from project data, outline, and prior chapter summaries
- **Scope**: Single project only
- **Unity risk**: None in the function itself. **However**, if the project's `seed_concept` contains "Unity Living-style management" (from catalog), this function will faithfully include it in the prompt. The contamination is upstream, not in this function.

### `anthologyEngine` — ✅ SAFE

- **Input**: A single `project` object
- **Behavior**: Orchestrates anthology-style multi-chapter generation
- **Scope**: Single project only
- **Unity risk**: Same upstream risk as `sceneWriter.buildFictionPrompt`.

### `bibliographyGenerator.detectProjectDomain` — 🔴 UNSAFE

- **Input**: Manuscript text (string)
- **Behavior**: Applies `CAREGIVING_RE` regex (line 31) to detect domain-specific terms in manuscript text
- **Matched terms**: Medicaid, waiver, HCBS, Missouri DMH, DSP, and similar caregiving vocabulary
- **Scope**: **Matches on text content, NOT on project identity or type**
- **Unity risk**: **HIGH**. A fiction novel with a caregiver character who mentions "Medicaid" will trigger caregiving domain detection. There is no `book_type` guard — fiction and nonfiction are treated identically.
- **Root cause**: This function was designed for a caregiving-specific application and was not properly generalized when integrated into the general-purpose book studio.

### `bibliographyGenerator.sourceLinesForDomain` — 🔴 UNSAFE

- **Input**: Domain string (e.g., `'caregiving'`) returned by `detectProjectDomain`
- **Behavior**: Returns hardcoded bibliography entries for the detected domain
- **Hardcoded caregiving sources** (lines 194-199):
  - Missouri DMH documentation
  - Medicaid Provider Manuals
  - CMS HCBS Final Rule
- **Unity risk**: **HIGH**. Once `detectProjectDomain` triggers on caregiving terms, this function injects Missouri-specific caregiving sources into ANY project's bibliography, regardless of whether the project is about caregiving.

### `chapterStorage.resolveChapterContent` — ✅ SAFE

- **Input**: A chapter record (by ID)
- **Behavior**: Resolves and returns chapter content from storage
- **Scope**: Scoped by record ID — retrieves only the specified chapter
- **Unity risk**: None. No cross-project queries, no text matching.

## Cross-Project Query Scan

**No cross-project queries were found in any context builder.** All context assembly functions operate on a single project object or record. The only function that operates on text content regardless of project identity is `bibliographyGenerator.detectProjectDomain`.

## Contamination Flow Diagram

```
PROJECT CREATION
  │
  ├─ User selects prompt from anthologyCatalog.js
  │    └─ Entry contains "Unity Living-style management" (line 876)
  │         └─ Stored as project.seed_concept ──────────────────────┐
  │                                                                  │
  ├─ buildProjectContextHeader(spec)  ← spec includes seed_concept ──┤
  │                                                                  │
  ├─ buildSetupConstraints(project)  ← no seed_concept reference     │
  │                                                                  │
  ├─ sceneWriter.buildFictionPrompt(project)                         │
  │    └─ Includes Foundation context ← contains seed_concept ───────┘
  │         └─ Prompt sent to ghostwriter
  │              └─ LLM interpolates "Unity Living" → 
  │                   "Unity Supported Living Services LLC"
  │                   "Unity Media Solutions"
  │
BIBLIOGRAPHY GENERATION
  │
  ├─ bibliographyGenerator.detectProjectDomain(manuscriptText)
  │    └─ CAREGIVING_RE matches "caregiver", "Medicaid", etc.
  │         └─ Returns domain = 'caregiving'
  │              └─ sourceLinesForDomain('caregiving')
  │                   └─ Injects Missouri DMH, Medicaid sources
  │                        └─ Added to project bibliography
```

## Recommendations

1. **Add `book_type` guard to `detectProjectDomain`** — Only activate caregiving domain detection for nonfiction projects (`book_type === 'nonfiction'`)
2. **Add project_id scoping** — Consider requiring an explicit domain tag on projects rather than inferring from text content
3. **Remove hardcoded Missouri-specific sources** — If caregiving bibliography is needed, make it configurable per project rather than hardcoded
