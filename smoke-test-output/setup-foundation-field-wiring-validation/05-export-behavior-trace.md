# Export Behavior Trace

## Overview
This report traces how Setup/Foundation fields affect the export output (DOCX, PDF, Markdown).

## Export Metadata Fields

| Field | Used In Export? | How? | Evidence | Status |
|---|---|---|---|---|
| `title` | ✅ | DOCX/PDF title page `<h1>` | `manuscript-html.js` L87: `project.title \|\| 'Untitled'` | ✅ Fully wired |
| `tagline` | ✅ | DOCX/PDF subtitle `<h2>` | `manuscript-html.js` L87: `project.tagline \|\| ''` | ✅ Fully wired |
| `author_name` | ✅ | DOCX/PDF author line | `manuscript-html.js` L87: `project.author_name \|\| ''` | ✅ Fully wired |
| `genre` | ✅ | Safety gate profile routing at export | `exportSafetyGate.js` → `resolvePolishProfile()` | ✅ Fully wired |
| `book_type` | ✅ | Reference integrity check (NF export) | `exportSafetyGate.js` → `shouldRunReferenceIntegrity()` | ✅ Fully wired |
| `content_lane` | ✅ | Rights mode affects commercial export warnings | `genreTaxonomy.js` commercial_use_allowed | ✅ Fully wired |

## Export Safety Gate — Field Interaction

| Gate Check | Fields That Affect It | Outcome |
|---|---|---|
| Dialogue issue density | `genre` → polish profile → `dialogueRepair` flag | Higher/lower thresholds by genre |
| Slop density | `genre` → polish profile → `slopReduction` level | Different slop budgets per genre |
| Reference integrity | `book_type` → `shouldRunReferenceIntegrity()` | NF: full check. Fiction: auto-detect |
| Stale URL blocking | `book_type`, chapter URLs | Always active, not genre-dependent |
| Process leak detection | N/A (universal) | Same gate for all genres |
| Contamination detection | N/A (universal) | Same gate for all genres |

## Export Format × Field Matrix

| Field | DOCX | PDF | Markdown | Plain Text |
|---|---|---|---|---|
| title | ✅ Title page | ✅ Title page | ✅ H1 header | ✅ Header |
| tagline | ✅ Subtitle | ✅ Subtitle | ✅ Subtitle | ✅ Subtitle |
| author_name | ✅ Author line | ✅ Author line | ✅ Author line | ✅ Author line |
| chapter titles | ✅ H2 headings | ✅ H2 headings | ✅ ## headings | ✅ Headings |
| bibliography | ✅ NF only | ✅ NF only | ✅ NF only | ✅ NF only |
| copyright page | ✅ Front matter | ✅ Front matter | ✅ Front matter | ✅ Front matter |

## Fields NOT Used In Export (by design)

| Field | Reason |
|---|---|
| `spice_level` | Affects generation, not export formatting |
| `language_intensity` | Affects generation, not export filtering |
| `pov_mode` / `tense` | Affects generation, not export |
| `beat_style` | Affects generation, not export |
| `story_arc` | Affects generation, not export |
| `chapter_length_target` | Affects generation, not export |
| `seed_concept` | Source material, not exported |
| Foundation documents (world_md, etc.) | Working documents, not exported |

## Protected Fields System

The `modelRouting.js` SETUP_PROTECTED_FIELDS list (45 fields) prevents LLM responses from overwriting user Setup choices. This ensures:
1. LLM cannot change chapter_target after user sets it
2. LLM cannot override genre, spice, voice, or tense
3. LLM cannot inject new setup values not authorized by user

## Verdict

**All export-relevant fields are correctly wired.** Title, tagline, and author flow to every export format. Genre and book_type correctly drive safety gate behavior at export time. No field is exported that shouldn't be, and no export-relevant field is missing.
