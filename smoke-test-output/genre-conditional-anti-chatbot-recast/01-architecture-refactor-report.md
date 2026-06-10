# Architecture Refactor Report

## Module: antiChatbotProse.js — v1.0 → v2.0 (GENRE-CONDITIONAL)

### Original Exports Preserved

All v1.0 exports remain intact and backward-compatible:

- `SIGNATURE_VOICE_BLOCK`
- `POLISHER_ANTI_CHATBOT_RULES`
- `analyzeProseTexture`
- `countChatbotPatterns`
- `CHATBOT_PATTERNS`
- `VERSION`

### New Named Exports

| Export | Purpose |
|---|---|
| `FICTION_SIGNATURE_VOICE_BLOCK` | Alias for `SIGNATURE_VOICE_BLOCK` |
| `THRILLER_SIGNATURE_VOICE_BLOCK` | Pacing/tension-tuned voice block for thriller/suspense |
| `LITERARY_SIGNATURE_VOICE_BLOCK` | Compression/texture voice block for literary fiction |
| `NONFICTION_AUTHORITY_BLOCK` | Authority/evidence voice block for nonfiction |
| `TRAINING_MANUAL_CLARITY_BLOCK` | Clarity/compliance voice block for training manuals |
| `BUSINESS_GUIDE_CLARITY_BLOCK` | Clarity/engagement voice block for business guides |
| `MEMOIR_VOICE_BLOCK` | Intimacy/reflection voice block for memoir |
| `DEFAULT_ANTI_CHATBOT_BLOCK` | Conservative fallback for unknown genres |

### New Polisher Rule Variants

| Export | Base |
|---|---|
| `POLISHER_FICTION_RULES` | Alias for `POLISHER_ANTI_CHATBOT_RULES` |
| `POLISHER_NONFICTION_RULES` | Excludes fragment/sensory/noir instructions |
| `POLISHER_TRAINING_RULES` | Clarity-focused, compliance-safe |
| `POLISHER_MEMOIR_RULES` | Voice-preservation focused |

### New Resolver

- `getAntiChatbotRulesForProject()` — resolves genre/subgenre/book_type/project_type to the correct voice block and polisher rules.

### New Module

- **antiChatbotRecastPipeline.js** — 622 lines. Chunk-level post-generation recast pipeline with protection detection, safety validation, and overcorrection guards.

### Downstream Updates

- **craftCompact.js** — Updated to re-export `getAntiChatbotRulesForProject` for consumer convenience.
- **llmProsePolisher.js** — `buildPolisherSystemPrompt()` now uses dynamic resolution via `getAntiChatbotRulesForProject()`. `polishChapterWithLLM` is now genre-aware.

### Backward Compatibility

All existing tests pass. Build is clean. No regressions introduced.
