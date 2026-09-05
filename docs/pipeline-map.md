# UBS Pipeline Map (PROSELAB-1, Phase 0.1)

Written from a live survey of `~/Downloads/UBS` at HEAD `b1251842` (branch `main`). This document
corrects `UBS_plan.md`'s assumptions with the real names/locations/behavior found in this repo.
Every claim below carries a `file:line` citation. Where reality contradicts `UBS_plan.md` or
`claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md`, it is flagged explicitly in §9.

## 1. Prompt assembly functions

Scene generation entry point: `generateChapterSceneByScene` (`src/lib/sceneWriter.js:3504`).
Per scene it calls `buildScenePrompt` (`src/lib/sceneWriter.js:2466`, call sites at 4031/4067/
5226/5289) and then `generateSceneWithRepair` (`src/lib/sceneWriter.js:2492`, call sites at
4152/4195/4271/4367/4479/4594/4728).

`buildScenePrompt` (2466–2490) produces the FULL final compiled prompt string — nothing
concatenates further downstream; its return value is passed straight into
`generateSceneWithRepair`'s `prompt` argument. Composition:

```
out = [stateContract, sceneCast, base].filter(Boolean).join('\n\n') + ledgerInstruction
```

- `base` = `buildFictionPrompt(args)` (`sceneWriter.js:1375`) or `buildNonfictionPrompt(args)`
  (`sceneWriter.js:1490`), chosen via `isNonfictionProject`.
- `stateContract` = `buildSceneStateContractBlock(spec)` (`sceneWriter.js:2312`), fiction only.
- `sceneCast` = `buildSceneCastBlock(spec)` (`sceneWriter.js:2420`).
- `ledgerInstruction` = serialized runtime ledger, when present.
- After assembly, `excludeForeignQuotes` (ARCH2-4b-a) strips foreign-story quotes, fail-open.

`buildFictionPrompt` (1375–1488) is where nearly all prompt size lives: ~35 named sub-block
builders joined with `\n\n`, in order — `HUMAN_PROSE_PRIORITY_BLOCK`, `projectHeader`,
`genreBlock`, `setupConstraints`, `povTenseBlock`, `readingLevelBlock`, `contentLimitsBlock`,
`languageBlock`, `goreBlock`, `spiceBlock`, `violenceBlock`, `eroticaBlocks`,
`fanfictionEroticaBridgeBlock`, `anthologySpice`, `anthologySpiceBeat`, `authorVoiceBlock`,
`authorStyleBlock`, `beatStyleBlock`, `pacingBlock`, `seriesContinuityBlock`,
`volumeContractBlock`, `anthologyContext`, `twistBlock`, **`foundationBlock`**
(`buildFoundationBlock`, `sceneWriter.js:1052`), **`researchBlock`** (`buildResearchBlock`,
`sceneWriter.js:1081`), `previousContextBlock`, `continuationGuardBlock`,
**`chapterContextBlock`** (`buildChapterContextBlock`, `sceneWriter.js:1025`),
`projectContinuityLockBlock`, `canonNameLockBlock`, `anthologyVarietyBlock`, `sceneSpecBlock`,
`revisionBlock`, `manuscriptPurityBlock`, `sceneContinuityExpansionBlock`, `noSlopBlock`,
`craftRules`, `MANDATORY_ENFORCEMENT_BLOCK`, `authorVoiceReminder`, `outputRules`.

Each of these ~40 named strings (plus `stateContract`/`sceneCast` from `buildScenePrompt`) is
independently callable and its `.length` is a ready-made `promptSections` breakdown for Phase
0.2 — no new instrumentation of internals is needed, only measuring these existing strings.

`buildFoundationBlock` (1052) returns `''` for anthology projects by design (ANTHOLOGYBLEED-2
isolation); it pulls `seed_concept`/`world_md`/`characters_md`/canon-cast/`outline_md`/
`canon_md`/`voice_md`/`mystery_md`/`twists_md`, each capped 2–4k chars via `compact()`.

## 2. Model client (corrects UBS_plan.md's "MODEL INFRASTRUCTURE" section)

`src/lib/localLLM.js` is the ONLY model client in this app. `LLAMA_BASE_URL = '/llama'`
(`src/lib/localLLM.js:10`); `vite.config.js:56-63` proxies `/llama` → `http://127.0.0.1:8081`
(comment: "UBS has its OWN llama router on 8081"). This is UBS's own llama-swap router
(ROUTERSPLIT-1, `--models-max 1`) — **not** Angela Qwen `:1237`, which is a different
llama.cpp instance on the Mac used by other fleet agents. `UBS_plan.md`'s endpoint table
(Angela Qwen, Edith, Dexter, Kyle, Eric, Mabel, Kathy, the `:8790` registry) does not apply to
this app's own generation path at all.

`callAgent` (`src/lib/localLLM.js:297`) resolves a role via `resolveAgent(taskType, project)`
(263) to one of `AGENT_MODELS` (31–41: ghostwriter/architect/researcher/critic/polisher/
nonfiction_writer, all served off the local llama-swap router) and calls `callLlama` (143).

Truncation handling (verified correct — matches the kickoff doc's warning about never
falling back to `reasoning_content`):

```js
const data = await response.json();
let text = data?.choices?.[0]?.message?.content || '';
if (!text) {
  console.warn(`[LOCAL-LLM] EMPTY completion from ${model} | ... | finish_reason: ${data?.choices?.[0]?.finish_reason || 'none'} | reasoning_content length: ${String(msg.reasoning_content || '').length}`);
}
```

`text` is read only from `.content`; `.reasoning_content` is never used as a fallback. One gap:
on empty completion, the function warns and returns `''` up the stack (`callLlama` → `callAgent`)
rather than throwing. The failure-visibility guarantee is enforced one layer up: downstream,
`generateSceneWithRepair`'s `quickSceneEval` catches a too-short/empty result and triggers
repair, so an empty completion is not silently swallowed — but any NEW model-calling code
(Phase 1A beat extraction, Phase 2B reader pass) must not assume `localLLM.js` itself raises on
empty/truncated output; it must check for `''`/truncation itself.

## 3. Validators

- `crossChapterDedupe.js` — verbatim 12+-word duplicate sentences across chapters. Detect
  (`findCrossChapterDuplicateSentences`) + repair (`healCrossChapterDuplicates`). Whole-book scope.
- `eventLedger.js` — extracts declared "events" per chapter (`extractChapterEvents`) and builds a
  rolling "don't repeat these" ledger fed into prompts (`buildPriorChapterEventLedger`).
  Chapter-to-chapter scope.
- `sceneDuplicateSweep.js` — re-derives paragraph-level "blocks" from the chapter's `content_md`
  blob AT RUNTIME (via `splitIntoParagraphs`/`makeCandidateBlocks`) and finds duplicated/
  restarted blocks. Does NOT read any persisted scene record — confirms §5 below. Whole-chapter/
  whole-book, block granularity.
- `pipelineDiag.js` — dev-only instrumentation; snapshots prose at each pipeline stage per
  chapterId for `window.__UBS_PIPELINE.report()/diff()`. Not a validator — a debugging aid.
- `chapterStateContract.js` — composes cast/pronoun/role/status + event ledger + resolved-arc +
  scene-map + style-budget into one `CHAPTER_STATE_CONTRACT_VERSION = 'chapter-state-contract-v2'`
  block injected into every scene prompt. Chapter-level; feeds the prompt (pre-generation, not
  post-hoc).
- `exportSafetyGate.js` — `runPreExportSafetyGate` (`src/lib/exportSafetyGate.js:98`) scans all
  resolved chapters pre-export and hard-blocks DOCX generation on qualifying findings ("extracted
  from ExportTab.jsx… does NOT produce DOCX for hard failures"). Whole-book; a gate, not a
  detector.

## 4. Repair loop

`regenerateLane.js` is real and landed (Arc B/G of the master fix plan), not aspirational:
`REGENLANE_VERSION = 'regen-lane-v2'` — the "v2" confirms Arc G's NF closed-world verifier
extension landed (per `claude_UBS-HANDOFF-2026-08-26.md`), which contradicts the master fix
plan document's own text still describing `'regen-lane-v1'`. Treat v2 as the current baseline.

Exports: `collectRegenTargets`, `verifyRegeneratedParagraph`, `regenerateFlaggedParagraphs`.
Wired at exactly two call sites: `src/lib/sceneWriter.js:3164` (inside `finalizeChapterProse`,
the writer-final lane) and `src/lib/manuscriptPolishRunner.js:1057` (the Fix Manuscript stage) —
both live.

Separately, `generateSceneWithRepair` (`sceneWriter.js:2492`) has its own up-to-3-attempt repair
loop that rewrites the WHOLE scene via `buildRepairPrompt` when `quickSceneEval` flags a blocking
issue (fabricated quotes, tense drift, stubs). This is a distinct, earlier-stage mechanism from
the paragraph-level regen lane, which runs later inside `finalizeChapterProse`.

## 5. Scene storage schema — CONFIRMED: scene identity is NOT persisted

`data/users/<uid>/Chapter.json` is a flat array of chapter objects (1,579 records in the sampled
store). Fields include `content_md`, `content_md_url`, `scene_beats_json` (the outline/plan of
scene beats, i.e. what was PLANNED, not a record of what was actually drafted per scene),
`beat_summary`, `word_count`, etc. There is no per-scene content field, no scene entity, and no
scene id on saved prose. `sceneDuplicateSweep.js` corroborates this by re-deriving block
boundaries from the `content_md` blob at runtime rather than reading any persisted scene record
(§3). This confirms the kickoff doc's flagged claim verbatim: one `content_md` blob per chapter;
scene identity inside a saved chapter is not persisted today.

Implication for `UBS_plan.md` Phase 1A (Beat Ledger): a `sceneId`/`sceneOrdinal` on a beat entry
cannot reference a persisted scene record — it must be assigned at extraction/generation time
(e.g. ordinal position within the chapter's re-derived blocks, or the in-memory scene index used
during `generateChapterSceneByScene`) and is not stable across re-derivation unless the extractor
and the block-deriver agree on the same boundary logic. This is a Phase 1 design decision, not
solved here.

## 6. Export path

`runPreExportSafetyGate` (`src/lib/exportSafetyGate.js:98`) is called from
`src/components/publishing/ExportTab.jsx`, `scripts/ubs-run.mjs`, and `scripts/ubs-accept.mjs`.
`bibliographyGenerator.js` supplies `isFrontMatter`/`isBackMatter`/`isBodyChapter`
classification (lines 42/68/81) used both by the gate and by DOCX assembly to order front/body/
back matter; `docxParser.js` and `manuscriptFixer.js`/`manuscriptArtifactRepair.js` handle
DOCX-side parsing/repair. Flow: chapters resolved → safety gate scans (hard-blocks on qualifying
findings, e.g. `DEPARTED_CHARACTER_ACTIVE`, `MALFORMEDSENT`) → if clear, `ExportTab` compiles
front/body/back matter into the DOCX.

## 7. Model config / dead references (corrects UBS_plan.md's Ollama/LiteLLM warning)

`vite.config.js:56-63` confirmed: `/llama` → `http://127.0.0.1:8081`
(comment: "ROUTERSPLIT-1: UBS has its OWN llama router on 8081 (--models-max 1…)").

Ollama/LiteLLM grep across `src/` and `scripts/`: **zero live hits.** All matches found
repo-wide are legacy and should be ignored, per `UBS_plan.md`'s own instruction:
- `smoke-test-output/` — a large tracked directory (per the handoff doc: 797 files, 16MB) of
  historical audit reports dated as old as June 2026, describing an Ollama-based stack that
  predates the current llama.cpp router. Pure legacy; do not treat as ground truth.
- `tests/beatJsonReliability.test.js:144` — a mock error string `'Ollama unavailable'` used as a
  generic "some upstream failed" fixture, not a real dependency.
- `PROSE_PATH_TRACE.md` (repo root) — a STALE document describing `localLLM.js` as calling "the
  Ollama server" via `callOllama`. This is factually wrong for the current code (§2 above traces
  the real path: `callLlama` → llama.cpp `/v1/chat/completions`). Flagged here so nobody treats
  it as current; do not follow it.
- `vite-server-store-plugin.js:683` — a comment `// named ollama or hermes)` inside ROUTERHEAL
  process-name matching logic, not a dependency.
- `localLLM.js:3` — the ROUTE-1 comment self-documents: "Ollama is not used anywhere in this
  stack, on any machine."

## 8. Feature-flag convention

`src/lib/generationContext.js` establishes the convention every new flag must follow:

```js
export const SCENE_EXECUTION_ACCEPTANCE_GATE_FEATURE = Object.freeze({
  key: 'scene_execution_acceptance_gate_v1',
  defaultEnabled: false,
});
```

(lines 55–58), collected into `SCENE_EXECUTION_FEATURE_KEYS` (array of `.key`s) and
`SCENE_EXECUTION_FEATURE_INFO` (UI metadata: `{ key, label, description, recommended }`).

`PROSE_LAB_CAPTURE` (Phase 0.2) must follow this exact shape: `Object.freeze({ key: '<snake_
case_v1>', defaultEnabled: false })`. Confirmed: `proseLab`/`PROSE_LAB_CAPTURE` do not exist
anywhere in `src/` or `scripts/` yet — this is a clean addition, no naming collision.

## 9. Corrections vs. UBS_plan.md and the master fix plan — read before writing any code

1. **Ghostwriter endpoint.** `UBS_plan.md`'s entire "MODEL INFRASTRUCTURE" table (Angela Qwen
   `:1237`, Edith, Dexter, Kyle, Eric, Mabel, Kathy, the `:8790` registry) does not apply to this
   app's actual generation path. The real and ONLY path is `src/lib/localLLM.js` →
   `/llama` → `vite.config.js:61` → `http://127.0.0.1:8081` (UBS's own llama-swap router,
   ROUTERSPLIT-1). Any new model-calling code in this kickoff (Phase 1A extraction) must call
   THROUGH `localLLM.js`/`callAgent`, not open a new HTTP client or target `:1237`.
2. **`regen-lane` version.** The master fix plan's Arc B text says `REGENLANE_VERSION =
   'regen-lane-v1'`; reality at `b1251842` is `'regen-lane-v2'` (Arc G's NF closed-world verifier
   already landed). Do not recreate v1 assumptions.
3. **`PROSE_PATH_TRACE.md`** (repo root) is stale/incorrect — it describes an Ollama-based
   `localLLM.js` that no longer exists. Do not use it as a reference for anything in this
   kickoff.
4. **`smoke-test-output/`** is a large tracked directory of historical, pre-router audit
   reports; several are internally inconsistent with the current architecture. Not ground
   truth for this kickoff.
5. **Scene storage.** `UBS_plan.md`'s Phase 1A/1B schemas assume a `sceneId` that can be
   attached to persisted data. Confirmed (§5): no scene entity or scene id exists in storage
   today — only `content_md` blobs and `scene_beats_json` (the plan, not the draft). This is
   flagged, not solved, per the kickoff doc's instruction to discover and report rather than
   assume.
6. **Truncation handling.** `localLLM.js` already does the right thing (never falls back to
   `reasoning_content` on `finish_reason === 'length'`) — the kickoff doc's warning is a
   reminder to preserve this in new code, not evidence of an existing bug.
