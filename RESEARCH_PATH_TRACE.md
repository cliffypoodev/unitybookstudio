# UNITY BOOK STUDIO — RESEARCH SUBSYSTEM FORENSIC TRACE

## VERDICT
The Research Subsystem is a fully integrated knowledge-gathering layer that acts as the "Source Backbrain" for both the Architect (Outline Generator) and the Ghostwriter (Scene Writer). 

There are two separate entry points depending on the project genre, but they both compile down to the same foundational artifacts (`research_md` and `research_md_url`) that the broader AI pipeline consumes.

---

## SECTION 1 — ENTRY POINTS & GENERATION
The system has two distinct modes of research depending on whether the project is Fiction or Nonfiction.

### 1. Nonfiction Deep-Dive
*   **Trigger:** `handleResearch` inside `src/pages/ProjectStudio.jsx` (approx. line 2347).
*   **Process:** Prompts an LLM to act as a "deep-dive research assistant for an investigative nonfiction book." It pulls the project's `seed_concept` and strictly requests verified facts, real people, timelines, and competing narratives.
*   **Format:** Generates structured JSON adhering to a rigid schema (`key_figures`, `timeline`, `primary_sources`). The JSON is formatted into markdown via `formatNonfictionResearchMarkdown`.

### 2. Fiction Plausibility Research
*   **Trigger:** `handleRunResearch` inside `src/components/tools/ResearchSubPage.jsx` (approx. line 29), which invokes `runFictionResearch` in `src/lib/fictionResearch.js`.
*   **Process:** Analyzes the existing Story Bible (World, Outline, Characters). It isolates claims that touch real-world science, medicine, law, or technical domains.
*   **Format:** Generates a "Plausibility Brief" markdown document detailing real-world science, terminology, common tropes to avoid, sensory details, and procedural steps.

---

## SECTION 2 — STORAGE & THE RESEARCH GUARD
Both generation flows eventually hand their output to `src/lib/researchStorage.js` (`prepareResearchContent`).

*   **Blob Strategy:** `researchStorage.js` examines the length of the generated Markdown. If it exceeds 10,000 characters, it uploads the content to the local blob storage API (`/api/base44/upload`) and saves the resulting URL to `project.research_md_url`. 
*   **Database:** If the content is small, it saves directly to `project.research_md` on the `NovelProject` record in the database.
*   **Resolution:** `resolveResearchContent` intelligently abstracts this away, returning the full string to the UI regardless of how it was stored.

---

## SECTION 3 — CONSUMPTION (Does the Architect see it?)
Yes, the Architect and the Ghostwriter both heavily rely on the research data. 

### The Architect (Outline & Bible Generation)
*   **Path:** `src/lib/parallelBibleGenerator.js` -> `getResearchText()`.
*   **Injection:** The `getResearchText` function concatenates `research_md`, `research_data`, and `bibliography_md`.
*   **Usage:** For Nonfiction, this block is forcefully injected via `buildStrictNonfictionRules` into the system prompts for the World, Characters, Canon, Mystery, and Outline generation passes (`PROJECT RESEARCH / SOURCE MATERIAL AVAILABLE TO FOUNDATION GENERATOR: ${research}`). It anchors the Architect entirely to the gathered facts, instructing it not to invent new named people or records.

### The Ghostwriter (Prose Generation)
*   **Path:** `src/lib/sceneWriter.js` (approx line 850).
*   **Injection:** The `research_md` is passed directly into the Ghostwriter's system prompt as a `PROJECT RESEARCH NOTES / SOURCE BACKBRAIN` block.
*   **Sanitization:** It runs through `sanitizeNonfictionContextScarTissue` and is clipped to 4,500 characters to prevent context window overflow while drafting.
