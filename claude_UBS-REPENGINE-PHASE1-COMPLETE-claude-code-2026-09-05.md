# REPENGINE PHASE 1 COMPLETE — session summary, 2026-09-05

Written by Claude Code after landing Step 0 + Phase 1 of `claude_UBS-REPENGINE-PHASE1-KICKOFF-claude-code-2026-09-05.md`.

## Landed (9 commits, `f3c112ef..HEAD`)

```
PROSELAB-1B-PROMPT-SECTIONS
PROSELAB-1B-ACCEPTANCE-BATTERY
BEATLEDGER-1-ENTITY-AND-EXTRACTOR
BEATLEDGER-1-LIVE-HOOK
BEATLEDGER-1-BACKFILL-SCRIPT
BEATLEDGER-1-ACCEPTANCE-BATTERY
SCENEDELTA-1-PLANNER-FIELD
SCENEDELTA-1-BACKFILL-SCRIPT
SCENEDELTA-1-ACCEPTANCE-BATTERY
```

- **Step 0 (PROSELAB-1B):** `prompt_sections` (recorded as `{}` since Phase 0) is now
  populated. `buildFictionPrompt`/`buildNonfictionPrompt` refactored to derive their
  joined string from an ordered sections object (`sceneWriter.js`), so a new exported
  `measurePromptSections(args)` and the prompt itself share one source of truth —
  verified byte-identical to pre-refactor HEAD.
- **Phase 1A (BEATLEDGER-1):** the beat ledger. New `BeatLedgerEntry` entity,
  `src/lib/beatLedger.js` (extraction + recording, flag `beat_extraction_v1` default
  off), a live hook in `sceneWriter.js` (after `finalizeChapterProse` resolves), and
  `scripts/beats-backfill.mjs` for existing manuscripts (chapter granularity,
  idempotent). 43 acceptance checks.
- **Phase 1B (SCENEDELTA-1):** the scene delta. New `SceneDelta` entity,
  `src/lib/sceneDelta.js`, one prompt field added to the fiction beat planner
  (`autonovel.js`, flag `scene_delta_v1` default off, byte-identical prompt when off),
  a passthrough in `ProjectStudio.jsx`'s beat compactor, and
  `scripts/deltas-backfill.mjs`. 33 acceptance checks.

Both features are additive and flags-off by default — zero behavior change to any
existing prompt, save, or export path until a project opts in.

## Verified

- `node test/run-all.mjs`: **164 green, 0 red, 0 quarantined, 4155 checks** (baseline
  was 162/0/0, 4054 checks).
- `npm run build`: succeeds (see the commit right before this note for the actual run).
- No backfill was run against any real book this session (that's the live step Cliff
  drives after the landing is verified) — see the kickoff doc's own instruction.

## Discovery notes (details in `docs/phase1-notes.md`, tracked in git)

1. **The writer's real model-resolution path is NOT `resolveAgent`.** It's
   `sceneWriter.js`'s `pickProseModel` → `modelRouting.js`'s `pickModel`. For
   nonfiction specifically, `resolveAgent`'s own model table (`AGENT_MODELS.
   nonfiction_writer`) resolves to a *different* model string than what actually
   drafted the chapter (`ghostwriter-nf`). Both `beatLedger.js` and `sceneDelta.js`
   avoid this trap by requiring an injected model rather than resolving one
   themselves — the live hook passes the exact `model` variable the chapter was
   drafted with; the backfill scripts approximate with `pickModel('prose', project)`.
2. **The live hook site:** `sceneWriter.js`, right after
   `finalProse = await finalizeChapterProse(...)` resolves, inside
   `generateChapterSceneByScene`.
3. **The `window is not defined` finding from Phase 0** traces to
   `src/lib/chapterStorage.js:261` (`rewriteForLocalGitHubProxy`'s `window.location`
   access, unguarded). Flagged, not fixed — belongs to a future HEADLESS follow-up.

## Not done / explicitly out of scope this session

- Phase 2 (detection/calibration) was not started — the kickoff doc says stop after
  Phase 1.
- `SceneDelta`'s planner-field addition covers only the main fiction (non-anthology,
  non-nonfiction) beat schema in `autonovel.js`; the anthology and nonfiction beat
  schemas were left untouched (their own, much shorter/different schemas — extending
  either was outside "gains a minimal request").
- Neither backfill script (`scripts/beats-backfill.mjs`, `scripts/deltas-backfill.mjs`)
  was run against a real project. Both are ready; Cliff runs them manually once he's
  satisfied with the landing.
