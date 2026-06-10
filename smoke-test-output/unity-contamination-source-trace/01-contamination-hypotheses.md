# Contamination Hypotheses

> Generated: 2026-06-08

## Status Legend

| Status | Meaning |
|---|---|
| ✅ CONFIRMED | Evidence found in source code or output |
| ❌ RULED OUT | Evidence contradicts hypothesis |
| ⚠️ INCONCLUSIVE | Cannot confirm or deny with available evidence |

---

## Hypotheses

| # | Hypothesis | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Unity terms are hardcoded in LLM prompt templates | ❌ RULED OUT | No Unity terms found in any prompt-building function (`buildProjectContextHeader`, `buildSetupConstraints`, `sceneWriter.buildFictionPrompt`, `anthologyEngine`). |
| 2 | Unity terms enter via the prompt catalog (seed_concept) | ✅ CONFIRMED | `anthologyCatalog.js` line 876 contains "Unity Living-style management" in a Music Industry prompt entry; this propagates through seed_concept → Foundation → Outline → Chapter prompts. |
| 3 | Unity terms are injected via bibliography domain routing | ✅ CONFIRMED | `bibliographyGenerator.js` detects caregiving terms (Medicaid, waiver, HCBS, Missouri DMH, DSP) in manuscript text and injects hardcoded caregiving bibliography sources regardless of project type. |
| 4 | The LLM model itself is fine-tuned on Unity/caregiving data | ⚠️ INCONCLUSIVE | Cannot inspect the `ghostwriter` model weights; however, the contamination is fully explained by vectors 1 and 2 without requiring model-level contamination. |
| 5 | Ollama KV cache bleeds context between projects | ⚠️ INCONCLUSIVE | Ollama default `keep_alive` is 5 minutes; KV cache from a prior caregiving project could persist. Consistent with intermittent contamination but not directly testable without a running Ollama instance. |
| 6 | Cross-project data mixing in context builders | ❌ RULED OUT | All context builders (`buildProjectContextHeader`, `buildSetupConstraints`, `sceneWriter.buildFictionPrompt`) operate on a single `spec` or `project` object; no cross-project query was found. |
| 7 | IndexedDB stores Unity terms that leak into prompts | ❌ RULED OUT | `localDB.js` uses DB_NAME `'UnityBookStudio'` but this is the database name only, never included in LLM prompts. |
| 8 | System prompts contain Unity references | ❌ RULED OUT | System prompts for `ghostwriter` are empty strings (line 26 of `localLLM.js`); the "Unity Book Studio Story Architect" identity in `FloatingBrainstorm.jsx`/`IdeasChatbot.jsx` refers to the app name, not Unity Supported Living. |
| 9 | Safety gates are the source of contamination | ❌ RULED OUT | `manuscriptSafetyGate.js`, `pipelineValidator.js`, and `llmProsePolisher.js` only _detect_ Unity terms — they do not inject them. |
| 10 | Unity terms appear in chapter storage/retrieval | ❌ RULED OUT | `chapterStorage.resolveChapterContent` resolves from a single chapter record scoped by record ID; no cross-project mixing. |
| 11 | UI branding ("Unity Book Studio") leaks into LLM output | ❌ RULED OUT | UI components (`NovelHero.jsx`, `WelcomeScreen.jsx`) display the app name but do not pass it to LLM prompt payloads. The chatbot system prompts say "Unity Book Studio Story Architect" which reaches the LLM but refers to app identity, not "Unity Supported Living." |
| 12 | Retry/regeneration logic injects Unity terms | ❌ RULED OUT | Retry suffixes in prompt assembly contain no Unity references; they are generic quality instructions. |
| 13 | Model routing metadata contains Unity references | ❌ RULED OUT | Model routing maps `ghostwriter` → `'ghostwriter'`, `ghostwriter_nsfw` → `'ghostwriter'`, `architect` → `'story-architect'`; no Unity terms in routing config. |
| 14 | Genre/voice blocks contain Unity references | ❌ RULED OUT | Genre and voice blocks are dynamically built from project settings; no hardcoded Unity terms found in the block-building functions. |
| 15 | Test fixtures contaminate production builds | ❌ RULED OUT | Test files and `smoke-test-output/` are not runtime-reachable from production source; contaminated output files are artifacts of prior runs, not inputs. |
| 16 | The contamination is from prior chapter summaries fed back into prompts | ⚠️ INCONCLUSIVE | If a prior chapter was contaminated (e.g., chapter-10.txt), its summary could feed into subsequent chapter generation prompts. This is a propagation mechanism, not a root cause — the initial contamination still traces to vectors 1 and 2. |

---

## Summary

- **2 CONFIRMED** vectors: Prompt catalog contamination (#2) and bibliography domain routing (#3)
- **3 INCONCLUSIVE** hypotheses: Model fine-tuning (#4), KV cache bleed (#5), and summary feedback loop (#16)
- **11 RULED OUT** hypotheses: All other pathways investigated show no contamination source
