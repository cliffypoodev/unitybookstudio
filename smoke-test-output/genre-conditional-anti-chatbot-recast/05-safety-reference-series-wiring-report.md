# Safety, Reference, and Series Wiring Report

## Chunk-Level Safety Validation

The recast pipeline validates every chunk through five safety checks:

1. **Word count ratio** — Recast output must be 0.85–1.10× the original word count. Prevents drastic expansion or truncation.
2. **Proper noun preservation** — All proper nouns from the original chunk must appear in the recast. Prevents character name drops, location changes, or entity loss.
3. **Citation preservation** — All citation patterns — `(Author, Year)`, `[1]`, `[Author 2024]` — must survive the recast intact.
4. **Process leakage detection** — Scans for meta-commentary, prompt echoing, or process artifacts that indicate the model broke character.
5. **Format checking** — Output must be clean prose without markdown artifacts or system text injection.

## Protected Sections — Never Recast

The following section types are detected and **never** sent to the recast pipeline:

| Type | Rationale |
|---|---|
| Citations | Exact text must be preserved |
| Bibliography | Reference formatting is sacrosanct |
| Block quotes | Attributed text cannot be rewritten |
| Tables | Structural data, not prose |
| Lists | Structured content, not narrative |
| Legal language | Compliance and liability risk |
| Scripture | Religious text cannot be paraphrased |
| Dialogue-heavy | Character voice must not be homogenized |
| High-scoring chunks | Already scoring ≥ 70, no improvement needed |

## Series Contract Gate

The series contract gate operates at the **chapter level** (character consistency, plot continuity, world rules). The recast pipeline operates **within a chapter** at the **chunk level**. These are orthogonal — no conflict exists.

## Manuscript Safety Gate

The `validatePolisherOutput` pattern from the manuscript safety gate is **replicated** in `validateRecast`. The same leakage patterns are checked in both paths, ensuring consistent safety coverage.

## Reference Integrity

The citation preservation check ensures no reference patterns are dropped during recast:

- `(Author, Year)` — parenthetical citations
- `[1]`, `[2]` — numbered references
- `[Author 2024]` — bracketed author-year citations

## Training Manual Protection

Training manual profile has `recastEligible: false`. No recast ever runs on training or compliance content, regardless of anti-chatbot score.

## Default Profile Protection

The default profile (unknown/empty genre) has `recastEligible: false`. This is a conservative approach — unknown genres are not recast until explicitly mapped.
