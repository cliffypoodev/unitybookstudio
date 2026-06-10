# Export Preservation — Report

## Method

Traced bibliography/reference content through the export pipeline to verify preservation of URLs, DOIs, ISBNs, citation markers, and bibliography structure.

## Export Format Matrix

| Format | Module | Bibliography Placement | URL Preservation | Structure |
|---|---|---|---|---|
| HTML/PDF | `buildBookHtml.js` | Back matter section (after body chapters) | ✅ Full URLs preserved in HTML | ✅ Headings, paragraphs |
| Markdown | `buildBookHtml.js` | After body chapters | ✅ Full URLs preserved | ✅ Headings, lists |
| Plain Text | `buildBookHtml.js` | After body chapters | ✅ Full URLs preserved | ✅ Plain formatting |
| DOCX | `ExportTab.jsx` | Back matter with `pageBreakBefore` | ⚠️ URL text only, hyperlink lost | ✅ Paragraphs, headings |

## URL/DOI/ISBN Preservation Through Pipeline

| Asset Type | Draft | Polish | Export (HTML) | Export (DOCX) | Status |
|---|---|---|---|---|---|
| URL in bibliography entry | ✅ | ✅ | ✅ | ⚠️ Text only | See note |
| DOI in bibliography entry | ✅ | ✅ | ✅ | ⚠️ Text only | See note |
| ISBN in bibliography entry | ✅ | ✅ | ✅ | ✅ | ✅ |
| `[label](url)` link syntax | ✅ | ✅ | ✅ Rendered | ⚠️ Label only | See note |
| Plain-text URL | ✅ | ✅ | ✅ | ✅ | ✅ |

> ⚠️ **DOCX Link Limitation:** `ExportTab.jsx` `parseInlineRuns()` (line 3455) renders `[label](url)` as blue underlined text with just the label. The actual URL is lost. **Plain-text URLs** (not in markdown link syntax) DO survive in DOCX.

## Export Safety Gates

| Gate | Module | What It Checks | Blocks Export? | Status |
|---|---|---|---|---|
| Missing bibliography | `ExportTab.jsx` | No bib chapter in nonfiction export | YES | ✅ |
| Thin bibliography | `ExportTab.jsx` | <4 credible entries after cleanup | YES (with note) | ✅ |
| Finance contamination | `ExportTab.jsx` | Finance sources in non-finance bib | YES | ✅ |
| Source placeholder survivors | `ExportTab.jsx` | `[SOURCE]`, `[CITATION]`, `[TODO]` | YES | ✅ |
| Author's Note mismatch | `ExportTab.jsx` | Note promises sourcing, bib is broken | YES (warning) | ✅ |
| Manuscript safety gate | `ExportTab.jsx` | Process leaks, contamination | YES | ✅ |

## Bibliography Repair at Export

| Repair | Applied By | What It Does | Status |
|---|---|---|---|
| Strip placeholder entries | `repairNonfictionBibliographyExportText()` | Removes entries containing `[SOURCE NEEDED]`, `[TODO]`, etc. | ✅ |
| Strip finance contamination | `repairNonfictionBibliographyExportText()` | Removes Bogle, Malkiel, Vanguard, etc. from non-finance | ✅ |
| Add EXPORT BLOCKER note | `repairNonfictionBibliographyExportText()` | If <4 credible entries remain after cleanup | ✅ |

## Chapter Ordering in Export

| Position | Content | Status |
|---|---|---|
| 1 | Title page | ✅ |
| 2 | Front matter (copyright, dedication, etc.) | ✅ |
| 3 | Body chapters | ✅ |
| 4 | **Back matter (Bibliography, Acknowledgments, About the Author)** | ✅ |

> Back matter classification uses `isBackMatter()` from `bibliographyGenerator.js` which matches: `bibliography`, `sources`, `works cited`, `references`, `appendix`, `acknowledgment`, `about the author`.

## Markdown-to-DOCX Conversion Detail

| Markdown Element | DOCX Rendering | Relevant to Bibliography? | Status |
|---|---|---|---|
| `#` Heading | HeadingLevel.HEADING_1 | Section headers | ✅ |
| `##` Heading | HeadingLevel.HEADING_2 | Subsection headers | ✅ |
| Bold `**text**` | `bold: true` | Emphasis in entries | ✅ |
| Italic `*text*` | `italics: true` | Book/journal titles | ✅ |
| `[label](url)` | Blue underlined text, **URL lost** | Source links | ⚠️ |
| Bullet `- item` | Bulleted paragraph | Source lists | ✅ |
| Ordered `1. item` | Numbered paragraph | Numbered references | ✅ |
| Normal paragraph | Standard paragraph | Bibliography entries | ✅ |

## Verdict

✅ **Bibliography structure, text content, and most formatting preserved through export.** One known limitation: DOCX strips hyperlink URLs from markdown link syntax (plain-text URLs survive). All export safety gates functional.
