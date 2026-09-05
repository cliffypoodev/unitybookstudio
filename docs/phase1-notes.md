# Phase 1 notes (DOCS-11)

Written after landing PROSELAB-1B, BEATLEDGER-1, and SCENEDELTA-1 (this session,
2026-09-05). Records the three things the kickoff doc asked to be discovered and
reported rather than assumed.

## 1. The taskType/model decision (BEATLEDGER-1 standing rule: "same model as the writer")

**Finding:** `resolveAgent` (`src/lib/localLLM.js:263`) is NOT what actually picks the
writer's model. The real prose-generation path is `sceneWriter.js`'s `pickProseModel`
→ `modelRouting.js`'s `pickModel('prose', project)`, which resolves to:

- **Fiction:** `PRIMARY_WRITING_MODEL` (`writingModel.js`) = `AGENT_MODELS.ghostwriter`
  = `'qwen3.6-35b-uncensored'`. This happens to equal what `resolveAgent('scene', project)`
  (or `'prose'`/`'draft'`/`'chapter'`) would also resolve to for fiction — the two paths
  agree here.
- **Nonfiction:** `pickModel` resolves to `NONFICTION_INSTRUCT_MODEL = 'ghostwriter-nf'`
  (a llama-swap router alias for a stock Qwen3-14B, per `modelRouting.js`'s own comment).
  `resolveAgent('scene'|'prose'|..., project)` for a nonfiction project instead resolves
  the `'nonfiction_writer'` agent key → `AGENT_MODELS.nonfiction_writer` =
  `'HauhauCS/Qwen3.6-27B-Uncensored-HauhauCS-Aggressive:Q5_K_P'` — **a different model
  string than the one that actually drafted the chapter.** The two routing tables
  (`localLLM.js`'s `AGENT_MODELS`/`resolveAgent`, and `modelRouting.js`'s `pickModel`)
  are independent and have drifted apart for the nonfiction case.

**Decision (and why):** `src/lib/beatLedger.js` / `src/lib/sceneDelta.js` never call
`resolveAgent` and never resolve a model themselves. `extractSceneBeats` and
`deriveSceneDelta` both *require* an injected `callLLM`, so the caller supplies the
model:

- **Live hook** (`sceneWriter.js`, inside `generateChapterSceneByScene`): passes
  `model` — the exact local variable already computed once via `pickProseModel` for
  this chapter's own prose generation (line ~3701). Never re-resolved, so it is
  *by construction* identical to the writer's model, for both fiction and nonfiction.
- **Backfill scripts** (`scripts/beats-backfill.mjs`, `scripts/deltas-backfill.mjs`):
  have no record of which model actually drafted an old chapter (nothing persists
  that today), so they approximate with `modelRouting.js`'s `pickModel('prose', project)`
  — today's routed default for the project, called directly, bypassing `resolveAgent`
  entirely so the known nonfiction divergence above can't leak in. This is a real,
  accepted approximation: if a chapter was drafted under an old routing rule, or with a
  whitelisted per-chapter override (`WAVE5-MODELPICKER`), the backfill's model may not
  match what actually drafted it. Only matters for the "same model" *rationale*
  (avoiding a router thrash on the shared single-slot llama-swap instance during a
  backfill run) — it doesn't affect correctness of the extracted data.

All real model calls (live and backfill) go through `localLLM.js`'s new
`callAgentWithMeta` (added this session — see `git log --grep BEATLEDGER-1-ENTITY`),
passing the resolved model as an explicit override, `taskType: 'beats'` for logging
only, and an explicit low `temperature` (0.2) — never through the taskType-driven
`resolveAgent` model lookup.

## 2. The live hook point (BEATLEDGER-1)

`src/lib/sceneWriter.js`, inside `generateChapterSceneByScene`, immediately after:

```
finalProse = await finalizeChapterProse(finalProse, project, priorChapterProse, stateContractResult);
```

(line 5041 at commit `BEATLEDGER-1-LIVE-HOOK`). This is the point the kickoff doc
described as "the chapter is ACCEPTED" — `finalizeChapterProse` is the chapter-level
repair pass (regen-lane v2); once it resolves without throwing, this chapter's scenes
are considered accepted. The hook iterates `generatedScenes` (already populated by the
per-scene loop above, in order) rather than re-deriving scene boundaries from
`finalProse`, so `scene_anchor`/`scene_hash` always describe exactly the prose each
scene's beats were extracted from — even though `finalizeChapterProse` may have since
touched paragraphs at the chapter level. That prose/hash mismatch after later polish is
the known, accepted reason a beat entry degrades to chapter granularity going forward
(the Sep 4 decision referenced in the kickoff doc, §5) — not something Phase 1 needed
to solve.

Everything after this point in the function (project contamination guard, series
contract gate, etc.) can still reject the chapter; the hook does not wait for those.
That's deliberate — those are unrelated safety gates with their own throw points, and
entangling beat extraction with them would couple two independent concerns for no
benefit, since Phase 2+ isn't reading this data yet anyway.

## 3. The `window` finding (Phase 0, HEADLESS follow-up — not fixed here)

Exact site: `src/lib/chapterStorage.js:261`, inside `rewriteForLocalGitHubProxy`:

```js
const { hostname, port } = window.location;
```

Called unguarded (no try/catch at that call site) from `fetchTextViaLocalProxy`
(`chapterStorage.js:273`), itself called from `fetchTextNoCache`
(`chapterStorage.js:297`), itself called from `resolveChapterContent`
(`chapterStorage.js:598`). Under a headless Node process (`window` is undefined), this
throws a `ReferenceError` that propagates up until it's caught — in the Phase 0 capture
run, by `getPreviousChapterEnding`'s own try/catch (`src/lib/chapterCohesion.js:230`),
which logs `[COHESION] Could not resolve previous chapter content: window is not
defined` and returns `''`, silently dropping the previous-chapter tail from the prompt.
This is browser-only code with no headless fallback; every headless run
(`scripts/ubs-run.mjs draft`, and by extension anything that calls
`resolveChapterContent` for a chapter stored via `content_md_url`) loses this context.
Flagged per the kickoff doc's instruction; not addressed in Phase 1 — it belongs to a
HEADLESS follow-up, not the beat ledger / scene delta work.

## Scope note: SCENEDELTA-1's planner-field reach

The delta field was added only to `autonovel.js`'s main (non-anthology, non-nonfiction)
`buildSceneBeatPrompt` return — the one with the detailed per-field beat schema
(`scene_id`, `entry_state`, `exit_state`, etc.). The anthology branch has its own,
much shorter beat schema (`scene_number, scene_goal, pov_character, setting, conflict,
emotional_arc, tension_level, exit_hook` — no delta-shaped fields at all) and returns
early; the nonfiction path routes to a separate `buildNonfictionBeatPrompt`. Extending
either was out of scope for "gains a minimal request" — left for a later phase if
anthology/nonfiction scene deltas are wanted.
