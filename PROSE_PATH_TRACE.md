# UNITY BOOK STUDIO — PROSE PATH FORENSIC TRACE

## VERDICT
The chapter prose is produced by **(A) the hardcoded app pipeline in `sceneWriter.js`**. 

While the actual HTTP request to the Ollama server is dispatched through `localLLM.js` (using `callAgent`), all intelligence, prompt construction, scene-by-scene orchestration, constraints, and post-generation cleanup are governed entirely by the `sceneWriter.js` pipeline. The `ghostwriter` agent in `localLLM.js` acts solely as a dumb transport layer with an empty system prompt.

---

## SECTION 1 — ENTRY POINTS
The following UI handlers in `src/pages/ProjectStudio.jsx` can trigger chapter prose generation:
*   **`handleDraftSelected`** (`ProjectStudio.jsx:3354`) -> calls `draftChapter` (`ProjectStudio.jsx:3370`)
*   **`handleRewriteSelected`** (`ProjectStudio.jsx:3543`) -> calls `generateChapterByScenes` (which is imported from `sceneWriter.js`)
*   **`handleDraftAll`** (`ProjectStudio.jsx:3425`) -> orchestrates parallel generation but relies on the same underlying pipeline (`runParallelDraftPool`).

---

## SECTION 2 — FORWARD CALL TRACE
1.  **`draftChapter`** (`ProjectStudio.jsx:3370`) invokes `generateChapterByScenes()`.
2.  **`generateChapterByScenes`** is an alias exported from `src/lib/sceneWriter.js:2551` mapping to **`generateChapterSceneByScene`** (`sceneWriter.js:2064`).
3.  **`generateChapterSceneByScene`** iterates through scene beats and calls **`generateSceneWithRepair`** (`sceneWriter.js:2176`).
4.  **`generateSceneWithRepair`** invokes **`invokeLLMWithRetry`** (`sceneWriter.js:1955`).

---

## SECTION 3 — THE FORK (Where A and B Meet)
The fork occurs inside `invokeLLMWithRetry`. 
*   `invokeLLMWithRetry` is defined in `src/lib/integrationRetry.js:138`.
*   Inside `invokeLLMWithRetry`, it imports and calls **`callAgent`** (`integrationRetry.js:180` and `200`).
*   `callAgent` is defined in **`src/lib/localLLM.js:123`**, which resolves the agent (e.g., `ghostwriter`) and dispatches the call to the local Ollama server via `callOllama`.

---

## SECTION 4 — PROMPT GOVERNANCE
**`sceneWriter.js` entirely governs the prompt.** 
*   Inside `sceneWriter.js`, `generateChapterSceneByScene` builds the prompt using `buildScenePrompt` (`sceneWriter.js:1939`), which routes to either `buildFictionPrompt` (`sceneWriter.js:1108`) or `buildNonfictionPrompt` (`sceneWriter.js:1216`).
*   These builders assemble massive context blocks including `HUMAN_PROSE_PRIORITY_BLOCK`, `MANDATORY_ENFORCEMENT_BLOCK`, author voice, and previous context.
*   By contrast, in `src/lib/localLLM.js:34`, `AGENT_SYSTEM_PROMPTS.ghostwriter` is defined as an empty string (`''`). No system prompt intelligence lives in `localLLM.js`.

---

## SECTION 5 — POST-GENERATION CHAIN
After the LLM returns prose, `sceneWriter.js` enforces a rigorous cleanup chain within `generateChapterSceneByScene`:
1.  **`lightCleanSceneOutput`** (`sceneWriter.js:2190`) - Basic string cleanup.
2.  **`cleanSceneOutput`** (`sceneWriter.js:2283`) - Accumulated cleanup across the chapter.
3.  **`repairCanonNameDrift`** (`sceneWriter.js:2286`) - Fixes character name hallucinations.
4.  **`repairManuscriptArtifacts`** (`sceneWriter.js:2292`) - Strips out leaked markdown or structural notes.
5.  **`repairChapterQuotes`** (`sceneWriter.js:2298`) - Polishes quote formatting.
6.  **`enforceExactFinalLine`** (`sceneWriter.js:2311`) - Ensures continuity transitions.
7.  **`validateProjectChapterContent`** (`sceneWriter.js:2317`) - Project contamination guard.

---

## SECTION 6 — IMPORT GRAPH
The dependency chain clearly flows from the UI to the pipeline, and finally to the transport layer:
*   `ProjectStudio.jsx` imports `{ generateChapterByScenes }` from `src/lib/sceneWriter.js`
*   `sceneWriter.js` imports `{ invokeLLMWithRetry }` from `src/lib/integrationRetry.js`
*   `integrationRetry.js` imports `{ callAgent, resolveAgent }` from `src/lib/localLLM.js`

---

## SECTION 7 — THE LOSING PATH
Path (B) – `localLLM.js` – is the "losing path" if you assume it is an autonomous agent. The code in `localLLM.js` is merely a dumb proxy for Ollama HTTP requests. It contains no narrative logic, no anti-slop rules, no scene continuation awareness, and no system prompts for prose generation. All "agentic" behavior for prose drafting actually resides in the hardcoded pipeline of `sceneWriter.js`.

---

## SECTION 8 — RUNTIME CONFIRMATION HARNESS
To definitively prove this at runtime without altering behavior, you could insert the following `console.log` at `src/lib/sceneWriter.js:2172` (just before `generateSceneWithRepair`):

\`\`\`javascript
console.log('[HARNESS] Scene Prompt Built by sceneWriter.js:', prompt.substring(0, 500) + '...');
\`\`\`
And another inside `src/lib/localLLM.js:129`:
\`\`\`javascript
console.log('[HARNESS] callAgent System Prompt Length:', systemPrompt.length); // Will print 0 for ghostwriter
\`\`\`
