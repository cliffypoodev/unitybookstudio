# 02 — Violence Level Design

## Date: 2026-06-09
## Status: IMPLEMENTED

---

## Design Rationale

UBS already had **Spice Level** (0–4) for sexual content and **Language Intensity** (0–4) for profanity. Violence was the missing third content axis — a critical control for genres ranging from cozy mystery (no on-page violence) to grimdark fantasy (unflinching combat and body horror).

### Why 0–5 Instead of 0–4?

Violence has more gradations than spice or language because the spectrum runs from children's fiction (absolute zero) through cozy mystery (mild peril) to horror and military fiction (extreme). Five graduated levels allow authors to fine-tune:

| Level | Label | Application |
|---|---|---|
| 0 | None | Cozy, romance, children's, self-help, devotional |
| 1 | Mild Peril | Threats implied, never depicted. YA-safe ceiling |
| 2 | Moderate Action | Fight scenes with moderate detail. Standard thriller |
| 3 | Intense | Visceral combat, serious injuries on-page. Dark thriller, crime |
| 4 | Graphic | Detailed depictions. Horror, war fiction, true crime |
| 5 | Extreme / Restricted | Body horror, grimdark — with mandatory safety gates |

### Safety Architecture

Violence level settings control **tone and intensity**, not safety permissions. Even at Level 5:

1. **Sexualized violence against minors** remains PROHIBITED
2. **Violence with no narrative purpose** (snuff-style) remains PROHIBITED
3. **Reading-level caps** override violence level:
   - Children/Middle-Grade: violence capped at 1
   - Young Adult: violence capped at 2
4. Safety gates (`manuscriptSafetyGate`, `exportSafetyGate`) are NOT affected by violence settings

### Genre Defaults

Each genre has a curated violence default that reflects market expectations:

| Genre | Default Violence | Rationale |
|---|---|---|
| Horror | 3 | Genre expectation: visceral threats |
| Industrial Horror | 4 | Sub-genre emphasizes physical menace |
| Thriller | 2 | Action-oriented but not gratuitous |
| Crime | 3 | Investigations involve graphic scenes |
| Dark Fantasy | 3 | Combat and danger central to worldbuilding |
| Mystery | 1 | Threats are cerebral, violence off-page |
| Romance | 0 | Violence is not genre-appropriate |
| Erotica | 0 | Content axis is spice, not violence |
| Self-Help | 0 | No violence in prescriptive nonfiction |
| True Crime | 2 | Factual accounts of violent events |
| Military History | 3 | War accounts require graphic honesty |
| Western | 2 | Action-oriented historical fiction |

### Fiction vs. Nonfiction Instructions

`buildViolenceBeatInstructions` generates **different prose guidance** for fiction and nonfiction:

- **Fiction**: Directs the LLM on how to depict violence in scenes (e.g., "visceral but purposeful", "every graphic scene must serve the story's emotional arc")
- **Nonfiction**: Directs the LLM on how to describe violence in case studies and investigations (e.g., "maintain journalistic distance", "let the facts carry the weight")

### Integration Points

Violence level is injected into the LLM prompt at **5 integration points**:

1. **Setup Constraints** → `buildSetupConstraints` (top of every Foundation/prose prompt)
2. **Project Context Header** → `buildProjectContextHeader` (compact header)
3. **Scene Writer** → `buildViolenceCompact` (per-scene compact block)
4. **Scene Writer** → `buildViolenceBeatInstructions` (full beat instructions, available for extended prompts)
5. **Anthology Engine** → Batch outline and story prompts
