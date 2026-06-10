# 03 — Model Selector Wiring

**Report Date:** 2026-06-09  
**Status:** ✅ WIRED

---

## Flux vs PonyXL Pipeline Routing

The model selector routes through a complete chain:

```
Model Selection → Pipeline Defaults → Prompt Builder → Workflow Builder → comfyuiClient → ComfyUI
```

### Pipeline Comparison Table

| Property | Flux | PonyXL / SDXL |
|----------|------|---------------|
| **ID** | `flux` | `ponyxl` |
| **Label** | `Flux` | `PonyXL / SDXL` |
| **Checkpoint** | `flux1-schnell-fp8.safetensors` | `cyberrealisticPony_v180Coreshift.safetensors` |
| **Default Steps** | 20 | 25 |
| **Guidance/CFG** | 3.5 (guidance) | 7 (cfg) |
| **Sampler** | euler | euler |
| **Scheduler** | simple | normal |
| **Supports Negative** | ❌ false | ✅ true |
| **Prompt Style** | Natural language | Tag-aware (score_9, etc.) |
| **Quality Tags** | None (natural language) | `score_9, score_8_up, score_7_up` prefix |
| **Negative Quality** | Flat artwork negatives only | `score_1, score_2, score_3` + quality guards |

### Routing Logic

```javascript
// coverComfyWorkflows.js — buildCoverWorkflowForModel()
function buildCoverWorkflowForModel(modelPipeline, options) {
  if (modelPipeline === 'ponyxl') return buildPonyXLCoverWorkflow(options);
  return buildFluxCoverWorkflow(options);
}

// coverPromptBuilder.js — buildCoverPrompt()
function buildCoverPrompt(project, settings) {
  const modelPipeline = settings.modelPipeline || getRecommendedPipeline(genre, subgenre);
  if (modelPipeline === 'ponyxl') return buildPonyXLCoverPrompt(project, settings);
  return buildFluxCoverPrompt(project, settings);
}
```

### Genre → Pipeline Recommendations

| Genre | Recommended Pipeline | Rationale |
|-------|---------------------|-----------|
| Dark Fantasy | PonyXL | Painterly, tag-aware, strong negative support |
| Psychological Thriller | PonyXL | Gritty, dark moody, benefits from negative prompts |
| Horror / Supernatural | PonyXL | Dark composition, heavy negative prompt usage |
| Historical Romance | PonyXL | Rich painterly style, period detail control |
| Contemporary Romance | Flux | Natural language, warm composition |
| Sci-Fi / Space Opera | Flux | Photorealistic, clean CGI rendering |
| Literary Fiction | Flux | Minimalist, natural light, editorial restraint |
| Cozy Mystery | Flux | Illustrated warmth, natural description |
| Business / Self-Help | Flux | Clean, minimalist, conceptual |
| Children / Middle Grade | Flux | Vibrant, expressive, age-appropriate |

### Workflow Node Graph (Both Pipelines)

Both Flux and PonyXL build a 7-node ComfyUI graph:

| Node | Class | Purpose |
|------|-------|---------|
| 1 | `CheckpointLoaderSimple` | Load model checkpoint |
| 2 | `CLIPTextEncode` | Positive prompt encoding |
| 3 | `CLIPTextEncode` | Negative prompt encoding (empty for Flux) |
| 4 | `EmptyLatentImage` | Create latent at target dimensions |
| 5 | `KSampler` | Sampling with pipeline-specific settings |
| 6 | `VAEDecode` | Decode latent to pixel image |
| 7 | `SaveImage` | Save output with UBS prefix |

### Test Coverage

- `coverTabModelSelectorUI.test.mjs` — 10 tests covering:
  - supportsNegative flag per pipeline
  - KSampler scheduler routing (simple vs normal)
  - Genre → pipeline recommendations (4 genres)
  - Default constants (steps, cfg)
