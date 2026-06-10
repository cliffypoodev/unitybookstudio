# 04 — Variation & Series Consistency Report

**Date:** 2026-06-09
**Modules:** `src/lib/coverVariationManager.js` (176 lines), `src/lib/coverSeriesConsistency.js` (220 lines)

---

## Part A — Cover Variation Manager

### Operations

| Operation | Function | Description |
|-----------|----------|-------------|
| **Create** | `createCoverVariation({ imageUrl, metadata, typographySettings, name })` | New variation with UUID, auto-name, timestamp |
| **Duplicate** | `duplicateCoverVariation(variation)` | Deep copy with new ID, "(Copy)" suffix, fresh timestamp |
| **Update** | `updateCoverVariation(variation, updates)` | Immutable merge — `id` and `createdAt` are guarded |
| **Delete** | `deleteCoverVariation(projectId, variationId)` | Remove from localStorage, return remaining |
| **Select Active** | `selectActiveCoverVariation(projectId, variationId)` | Sets `isActive = true` on target, `false` on all others |
| **List** | `getProjectVariations(projectId)` | Read from localStorage |
| **Save** | `saveProjectVariations(projectId, variations)` | Write to localStorage |

### Variation Data Shape

```js
{
  id: "uuid-v4",                  // crypto.randomUUID()
  name: "Variation 1",            // user-editable, auto-incrementing default
  imageUrl: "blob:..." | "data:...",
  metadata: {
    prompt: "...",
    negativePrompt: "...",
    modelPipeline: "flux" | "ponyxl",
    checkpoint: "ponyDiffusionV6XL",
    seed: 42,
    sizePreset: "portrait_large",
    width: 768,
    height: 1024,
    genreTemplate: "fantasy",
    projectGenre: "fantasy",
    projectTitle: "The Dark Tower",
  },
  typographySettings: { ... } | null,
  createdAt: "2026-06-09T18:00:00.000Z",
  isActive: false,
}
```

### Storage

- **Key format:** `ubs_cover_variations_{projectId}`
- **Backend:** `localStorage` (JSON serialized array)
- **Pure functions** (`create`, `duplicate`, `update`, `buildMetadata`) work without localStorage — safe for tests and server-side

### Metadata Builder

`buildCoverVariationMetadata(project, settings)` extracts:

| Field | Source |
|-------|--------|
| `prompt` | `settings.prompt` |
| `negativePrompt` | `settings.negativePrompt` |
| `modelPipeline` | `settings.modelPipeline` |
| `checkpoint` | `settings.checkpoint` |
| `seed` | `settings.seed` (default: -1) |
| `sizePreset` | `settings.sizePreset` |
| `width` | `settings.width` |
| `height` | `settings.height` |
| `genreTemplate` | `settings.genreTemplate` |
| `projectGenre` | `project.genre` |
| `projectTitle` | `project.title` |

---

## Part B — Series Consistency Lock

### Concept

When generating covers for a **book series**, visual consistency matters: same lighting, palette, typography style, composition pattern, and model pipeline across all books. The series consistency module provides a workflow to **extract** a visual signature from the active cover, **apply** it to new generation settings, and **validate** that settings remain consistent.

### Series Signature Shape

```js
{
  hasSeriesSignature: true,
  lighting: "dramatic side lighting",
  palette: "dark blue and gold",
  typographyStyle: {
    fontFamily: "Georgia, serif",
    titleColor: "#FFFFFF",
    subtitleColor: "#E0E0E0",
    authorColor: "#FFFFFF",
  },
  compositionPattern: "centered figure, dark background",
  modelPipeline: "flux",
  exportPreset: "ebook",
}
```

### Locked Fields

| Field | Description |
|-------|-------------|
| `lighting` | Scene lighting description |
| `palette` | Color palette description |
| `typographyStyle` | Font family + text colors (nested object) |
| `compositionPattern` | Composition layout description |
| `modelPipeline` | `flux` or `ponyxl` |
| `exportPreset` | `ebook`, `paperback_6x9`, etc. |

### Operations

| Operation | Function | Description |
|-----------|----------|-------------|
| **Extract** | `extractSeriesCoverSignature(project, activeCover)` | Pull signature from active cover metadata |
| **Apply** | `applySeriesCoverSignature(settings, signature)` | Override matching fields in generation settings |
| **Validate** | `validateSeriesCoverConsistency(settings, signature)` | → `{ consistent, deviations[] }` |
| **Report** | `buildSeriesCoverConsistencyReport(project, covers)` | Compare all covers against reference signature |

### Validation Deviations

Each deviation is reported as:
```js
{ field: "modelPipeline", expected: "flux", actual: "ponyxl" }
```

### Consistency Report

`buildSeriesCoverConsistencyReport()` compares all variations against the active (or first) cover:

```js
{
  title: "The Dark Tower",
  coverCount: 3,
  issues: [
    '"Variation 2" deviates on modelPipeline: expected "flux", got "ponyxl"',
    '"Variation 3" deviates on palette: expected "dark blue and gold", got ""',
  ],
  recommendation: "Found 2 inconsistencies. Consider regenerating deviant covers with the series signature applied."
}
```

When all covers are consistent:
```js
{
  recommendation: "All covers are consistent with the series signature."
}
```

When fewer than 2 covers exist:
```js
{
  recommendation: "Add at least two cover variations to check consistency."
}
```
