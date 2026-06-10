# UBS Agent/Model Workflow Map

## Model Infrastructure

All LLM calls route through `src/lib/localLLM.js` → Ollama at `http://127.0.0.1:11434`.
No cloud APIs are used. All model names refer to locally-hosted Ollama models.

### Configured Models (from `localLLM.js`)

| Agent Key | Ollama Model | Temperature | Purpose |
|---|---|---|---|
| `ghostwriter` | `ghostwriter` | 0.75 | Prose drafting (fiction + nonfiction) |
| `ghostwriter_nsfw` | `ghostwriter` | 0.75 | Adult/erotica (same model) |
| `architect` | `story-architect` | 0.6 | Outlines, beats, foundation, bibliography |
| `researcher` | `researcher` | 0.3 | Fiction plausibility + NF deep research |
| `critic` | `publishing-critic` | 0.4 | Chapter evaluation, analytics |
| `polisher` | `prose-polisher` | 0.3 | LLM prose polish |

### Model Resolution Chain

```
UI action → integrationRetry.js → callAgent() → resolveAgent(taskType, project) → AGENT_MODELS[agentKey] → callOllama(model, prompt)
```

### Task-to-Agent Routing

| Task Type | Agent | Model |
|---|---|---|
| prose, draft, chapter, scene, rewrite, manuscript | ghostwriter | `ghostwriter` |
| foundation, outline, beats, bibliography, publishing | architect | `story-architect` |
| judge, evaluate, critique, analytics | critic | `publishing-critic` |
| research, fiction_research | researcher | `researcher` |
| polish, proofread, fix, cleanup | polisher | `prose-polisher` |

## Agent/Process Inventory

| Agent/Process | Model | LLM or Deterministic? | Production-Wired? |
|---|---|---|---|
| Drafting Agent | `ghostwriter` | LLM | ✅ |
| Rewrite Agent | `ghostwriter` | LLM | ✅ |
| Scene/Beat Writer | `ghostwriter` | LLM | ✅ |
| Architect Agent | `story-architect` | LLM | ✅ |
| Fiction Research Agent | `researcher` | LLM | ✅ |
| Nonfiction Research Agent | `researcher` | LLM | ✅ |
| Critic Agent | `publishing-critic` | LLM | ✅ |
| LLM Prose Polisher | `prose-polisher` | LLM (with deterministic fallback) | ✅ |
| LLM Sentence Recast | N/A | ✅ Deterministic (despite name) | ✅ |
| Dialogue Mechanics Repair | N/A | ✅ Deterministic | ✅ |
| Mid-Paragraph Autofix | N/A | ✅ Deterministic | ✅ |
| AI-Slop Reducer | N/A | ✅ Deterministic | ✅ |
| Manuscript Safety Gate | N/A | ✅ Deterministic | ✅ |
| Export Safety Gate | N/A | ✅ Deterministic | ✅ |
| Reference Integrity Gate | N/A | ✅ Deterministic | ⚠️ Not wired |
| Punctuation Polish | N/A | ✅ Deterministic | ✅ |
| Image Generator | SDXL (ComfyUI) | Diffusion | ✅ |

## Fallback Policy

From `modelRouting.js`:
- `shouldDisableFallbacks()` → `true`
- `pickFallbackModel()` → `null`
- All fallbacks disabled. If Ollama is down, operations fail with error.

## Cloud API Status

| Provider | Used? |
|---|---|
| OpenAI | ❌ No |
| Anthropic | ❌ No |
| Google/Gemini | ❌ No |
| Base44 | ❌ No (replaced with IndexedDB) |
| Ollama (Local) | ✅ Yes — sole LLM provider |
