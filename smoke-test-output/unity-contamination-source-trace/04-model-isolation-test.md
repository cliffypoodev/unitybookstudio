# Model Isolation Test

> Generated: 2026-06-08

## Model Configuration

| Parameter | Value | Source |
|---|---|---|
| Provider | Ollama (local) | `localLLM.js` |
| Endpoint | `http://127.0.0.1:11434/api/chat` | `localLLM.js` |
| ghostwriter model | `'ghostwriter'` (alias) | `localLLM.js` line 8 |
| ghostwriter_nsfw model | `'ghostwriter'` (same alias) | `localLLM.js` line 9 |
| architect model | `'story-architect'` | `localLLM.js` |
| System prompt (ghostwriter) | Empty string `""` | `localLLM.js` line 26 |
| Streaming | `false` (full response mode) | `localLLM.js` line 49 |
| Keep-alive | Not configured (Ollama default: 5 minutes) | Not specified in code |
| Context window | Not configured (Ollama model default) | Not specified in code |

## Model Routing Audit

| Route Name | Maps To | Model Alias | Notes |
|---|---|---|---|
| `ghostwriter` | `'ghostwriter'` | Local Ollama model | Primary prose generation model |
| `ghostwriter_nsfw` | `'ghostwriter'` | Same model as ghostwriter | Same weights, no separate NSFW model |
| `architect` | `'story-architect'` | Local Ollama model | Used for story architecture/planning |

### Routing Architecture

- Each API call is a **new HTTP POST** request to Ollama's `/api/chat` endpoint
- **No session state** is maintained in UBS application code between calls
- No authentication tokens, session IDs, or conversation threading is implemented
- All context for each generation comes entirely from the prompt payload

### Statelessness Assessment

| Layer | Stateless? | Notes |
|---|---|---|
| UBS application code | ✅ Yes | Fresh `fetch()` call per generation; no request chaining |
| HTTP transport | ✅ Yes | Each POST is independent; no cookies or session headers |
| Ollama server | ⚠️ **Partially** | Model weights stay loaded for `keep_alive` duration (default: 5 min); KV cache from previous request MAY persist |
| Model weights | ✅ Yes | Weights are static; no online learning or fine-tuning between calls |

## KV Cache Bleed Risk

### The Risk

Ollama's default `keep_alive` is **5 minutes**. During this window:

1. The model weights remain loaded in GPU/CPU memory
2. The KV cache from the **previous request** may persist if Ollama reuses it
3. If a Unity/caregiving project was processed immediately before a fiction project, residual KV cache entries could influence the fiction generation

### Why This Matters

- The `ghostwriter` system prompt is an **empty string** — there is no system-level instruction to prevent topic contamination
- Without explicit context window reset, the model may retain attention patterns from prior context
- This is consistent with the **intermittent** nature of the observed contamination — it would only occur when a caregiving project was processed in the same 5-minute window

### Why This Is Secondary

- Vectors 1 (prompt catalog) and 2 (bibliography domain routing) are **sufficient** to explain all observed contamination
- KV cache bleed would amplify contamination from those vectors but is not required as an explanation
- The exact phrases found in output ("Unity Supported Living Services LLC", "Unity Media Solutions") are consistent with LLM interpolation from seed text, not cached prior responses

## Isolation Test Plan

> **Note**: These tests cannot be executed without a running Ollama instance with the `ghostwriter` model loaded. This section documents the test plan for future execution.

### Test 1: Baseline Clean Generation

```
1. Restart Ollama server (flush all state)
2. Send a fiction prompt with NO Unity/caregiving terms
3. Verify output contains no Unity/caregiving references
4. Expected: PASS (clean output)
```

### Test 2: Contamination Reproduction via Prompt Catalog

```
1. Restart Ollama server (flush all state)
2. Create a project using the anthologyCatalog.js entry containing
   "Unity Living-style management" as the seed_concept
3. Run through Foundation → Outline → Chapter generation
4. Check output for Unity/caregiving references
5. Expected: FAIL (contamination reproduced — confirms Vector 1)
```

### Test 3: Contamination Reproduction via Bibliography Routing

```
1. Restart Ollama server (flush all state)
2. Create a fiction project with a character described as a "caregiver"
   who discusses "Medicaid" in dialogue
3. Trigger bibliography generation
4. Check if Missouri DMH / Medicaid Provider Manual sources appear
5. Expected: FAIL (caregiving sources injected — confirms Vector 2)
```

### Test 4: KV Cache Bleed Test

```
1. Restart Ollama server (flush all state)
2. Send a Unity/caregiving prompt (load context into KV cache)
3. Wait < 5 minutes (within keep_alive window)
4. Send a clean fiction prompt with NO Unity/caregiving terms
5. Check output for Unity/caregiving references
6. Expected: UNKNOWN (testing the KV cache bleed hypothesis)
```

### Test 5: KV Cache Isolation with keep_alive=0

```
1. Restart Ollama server (flush all state)
2. Send a Unity/caregiving prompt with keep_alive=0
3. Immediately send a clean fiction prompt with keep_alive=0
4. Check output for Unity/caregiving references
5. Expected: PASS (model unloaded between calls, no bleed possible)
```

### Test 6: Post-Fix Regression

```
1. Apply fixes to anthologyCatalog.js and bibliographyGenerator.js
2. Restart Ollama server
3. Re-run the full anthology smoke test
4. Check all generated chapters for Unity/caregiving contamination
5. Expected: PASS (no contamination after fixes)
```
