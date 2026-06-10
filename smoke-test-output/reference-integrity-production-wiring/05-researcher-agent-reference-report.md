# Researcher Agent — Reference/Source Discipline Report

## Architecture

UBS has two research modes:

### Fiction Research (`src/lib/fictionResearch.js`)
- **Purpose:** Generate plausibility briefs for fiction worldbuilding
- **Output:** Internal research notes (NOT reader-facing citations)
- **Model:** `researcher` agent via Ollama (temp 0.3)
- **Source discipline:** Fiction research produces sections like "Real Science", "Terminology", "Common Author Mistakes" — these are knowledge scaffolding, not bibliography entries
- **Citation behavior:** Does NOT generate formal citations. Does NOT produce bibliography entries.
- **Status:** ✅ No reference integrity issue — fiction research is internal scaffolding

### Nonfiction Research (`ProjectStudio.jsx` → `handleResearch`)
- **Purpose:** Deep investigative research for nonfiction books
- **Output:** Structured research brief with key figures, events, institutions, primary sources, competing narratives
- **Model:** `researcher` agent via Ollama (temp 0.3)
- **Prompt anti-fabrication language:** "Do not invent facts, names, events, dates, documents, or sources."
- **Source discipline:** Output includes `source_types` (e.g., "court records", "newspaper accounts") — these are source CATEGORIES, not full bibliographic citations
- **Citation behavior:** Produces source candidates and availability notes, NOT finalized bibliography entries
- **Status:** ✅ Existing prompt includes anti-fabrication directives

## Source Discipline Verification

| Mode | Behavior | Source Discipline | Status |
|---|---|---|---|
| Fiction research | Plausibility brief (internal) | No citations generated | ✅ Correct |
| NF research | Investigative brief | Source categories, not citations | ✅ Correct |
| NF research prompt | Anti-fabrication directive | "Do not invent facts, names, events, dates, documents, or sources" | ✅ Present |
| Bibliography generator | Generates bibliography chapter | LLM-generated with sanitization | ✅ Separate module |
| Reference integrity gate | Validates references | Deterministic, no LLM | ✅ Newly wired |

## Researcher Agent Output Format

### Fiction (Plausibility Brief)
```
# Plausibility Brief
## {topic}
### Real Science
### Terminology for Characters to Use
### Common Author Mistakes to Avoid
### Sensory Details
### Constraints (What Can't Happen)
```
→ No citations, no bibliography, no formal references

### Nonfiction (Research Brief)
```
# Deep Research Brief
## Key People & Figures (name, role, dates, source_types)
## Key Events & Incidents (event, date, sources)
## Key Institutions & Organizations
## Timeline
## Primary Sources Available (source_type, availability)
## Competing Narratives / Evidence Tensions
```
→ Source types and availability, NOT finalized citations

## Recommendation

The Researcher Agent's existing behavior is **correct and safe**:
- Fiction research does not produce citations (by design)
- Nonfiction research produces source candidates with uncertainty labeling
- The prompt includes explicit anti-fabrication directives
- Bibliography generation is handled by a separate module (`bibliographyGenerator.js`)
- Reference validation is now handled by `referenceIntegrityGate.js` (newly wired)

No prompt changes are needed at this time.
