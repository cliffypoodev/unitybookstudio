# Recast Pipeline Implementation Report

## Chunk Splitting

- **Method:** Paragraph-boundary splitting — splits on double newlines to preserve natural paragraph structure.
- **Configurable targets:** target/min/max word counts (defaults: 400/80/600 words).
- **Tail merge:** Small tail chunks below the minimum threshold are merged into the preceding chunk to prevent orphaned fragments.

## Protection Detection

Nine protection types are detected before any chunk is considered for recast:

| # | Type | Description |
|---|---|---|
| 1 | `citation` | Contains inline citations — (Author, Year), [1], [Author 2024] |
| 2 | `bibliography` | Bibliography/references sections |
| 3 | `block_quote` | Extended block quotations |
| 4 | `table` | Tabular data |
| 5 | `list` | Structured list content |
| 6 | `legal` | Legal language / compliance text |
| 7 | `scripture` | Scripture or religious text quotations |
| 8 | `dialogue_heavy` | Chunks dominated by dialogue |
| 9 | `high_score` | Chunks already scoring ≥ 70 (no recast needed) |

## Eligibility Criteria

A chunk is eligible for recast only if **all** of the following are true:

1. Anti-chatbot score < 70
2. Not flagged by any protection detector
3. Genre profile allows recast (`recastEligible: true`)
4. Chunk contains ≥ 80 words

## Recast Prompt

- Genre-conditional polisher rules injected based on resolved profile.
- Strict preservation rules embedded: maintain meaning, proper nouns, citations, structure.
- Diagnostics embedded in the prompt for post-hoc analysis.

## Safety Validation

Every recast output is validated through five checks:

| Check | Criteria |
|---|---|
| **Word count ratio** | Recast must be 0.85–1.10× the original word count |
| **Proper noun preservation** | All proper nouns from the original must appear in the recast |
| **Citation preservation** | All citation patterns must survive the recast |
| **Process leakage detection** | No meta-commentary, prompt echoing, or process artifacts |
| **Format check** | Output must be clean prose, no markdown artifacts or system text |

## Overcorrection Guard

If the recast chunk scores **lower** than the original on the anti-chatbot analyzer, the original chunk is preserved. This prevents the recast from making prose worse.

## Report Structure

Each recast run produces a structured report containing:

- `profileUsed` — resolved genre profile key
- `chunksAnalyzed` / `chunksSkipped` / `chunksRecast` / `chunksFailed`
- `beforeMetrics` / `afterMetrics` — composite scores pre/post recast
- `safetyBlocks` — chunks blocked by safety validation
- `referenceBlocks` — chunks blocked by protection detection
- `overcorrectionWarnings` — chunks where recast scored lower
- `chunkDetails` — per-chunk breakdown

## Debug Access

The last recast report is available at runtime via:

```js
globalThis.__UBS_LAST_ANTI_CHATBOT_RECAST_REPORT
```
