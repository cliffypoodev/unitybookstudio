# 04 — Prompt Builder UI Wiring

**Report Date:** 2026-06-09  
**Status:** ✅ WIRED

---

## Kittl 3-Line Prompt Flow

The prompt builder uses a structured three-line formula inspired by Kittl's design approach:

### Three-Line Structure

```
Line 1: [Flat artwork lead] + [Lighting type & quality]
Line 2: [Subject: specific] + [Composition: where/how framed]
Line 3: [Style preset] + [Named color palette] + [Finish/texture quality]
```

### Auto-Build from Project Metadata

```
Project { genre, subgenre, title, author_name }
    ↓
getGenreCoverTemplate(genre, subgenre) → template
    ↓
buildKittlStyleThreeLinePrompt(project, settings) → { line1, line2, line3, full }
    ↓
buildTypographyInstruction(project, settings) → { promptAddition, negativeAddition }
    ↓
buildGenreCoverStyleBlock(project, settings) → genre style string
    ↓
getSeriesCoverSignature(project, settings) → { hasSeriesSignature, seriesBlock }
    ↓
buildCoverPrompt(project, settings) → { positive, negative }
```

### Example: Thriller Prompt Build

Given project: `{ genre: 'thriller', subgenre: 'psychological thriller', title: 'The Glass Room' }`

**Line 1 (Lighting):**
> Vertical portrait illustration in 2:3 aspect ratio, designed as a single flat 2D image that fills the entire frame edge-to-edge... harsh cold fluorescent overhead light, clinical blue-white, single shadow casting left

**Line 2 (Subject):**
> tight crop on a charged object or isolated figure — surveillance mood, asymmetric framing, one eye visible or a hand on glass. tight frame, asymmetric, negative space for title in darkest region, subject off-center

**Line 3 (Style):**
> Photorealistic / Dark Moody. Color palette: desaturated steel-blue, ash-white, charcoal, clinical green, dried blood accent. gritty film grain, matte, raw, slightly underexposed

### Anti-Book-Photo Framing

Every prompt starts with `FLAT_ARTWORK_LEAD`:
> "Vertical portrait illustration in 2:3 aspect ratio, designed as a single flat 2D image that fills the entire frame edge-to-edge with no borders, no margins, and no background surface."

And negatives always include `FLAT_ARTWORK_NEGATIVES`:
> "physical book, hardcover, paperback, book spine, book pages... product mockup, bookstore display..."

### Typography Mode Integration

| Mode | promptAddition | negativeAddition |
|------|---------------|------------------|
| `image_only` | "No text, no title, no words..." | "text, title, words, letters..." |
| `typography_reference` | `Title text reading "The Glass Room"...` | (empty) |
| `final_cover_composite_later` | "Composition leaves breathing room..." | "text, title, words, letters..." |

### Custom Overrides

Users can override any template field:
- `settings.lighting` → replaces `template.lighting` in Line 1
- `settings.palette` → replaces `template.palette` in Line 3
- `settings.subject` → replaces `template.subject` in Line 2
- `settings.composition` → replaces `template.composition` in Line 2
- `settings.stylePreset` → replaces `template.stylePreset` in Line 3
- `settings.finish` → replaces `template.finish` in Line 3

### PonyXL Quality Tag Injection

PonyXL prompts automatically prepend:
- **Positive:** `score_9, score_8_up, score_7_up`
- **Negative:** `score_1, score_2, score_3`
- **Quality:** `masterpiece, best quality, professional cover art`
- **Anti-quality:** `worst quality, low quality, blurry, watermark, signature, amateur, ugly`

### Series Consistency

`getSeriesCoverSignature()` preserves exact visual language across books:
- `seriesLighting` → locked lighting description
- `seriesPalette` → locked palette description
- `seriesFinish` → locked finish description

When any series field is set, `hasSeriesSignature = true` and the block is appended to the prompt.

### Copy Buttons (UI)

The UI provides copy buttons for both positive and negative prompts, allowing users to paste into external tools (Kittl, standalone ComfyUI, etc.).

### Test Coverage

- `coverTabPromptBuilderWiring.test.mjs` — 12 tests covering:
  - Basic prompt output shape
  - Genre template lighting injection
  - Typography mode prompt additions (image_only, typography_reference)
  - Three-line structure verification
  - Custom lighting/palette overrides
  - Series signature logic
  - PonyXL score_9 quality tags
