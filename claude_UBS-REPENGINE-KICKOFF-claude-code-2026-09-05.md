# REPETITION-ENGINE KICKOFF — paste into a FRESH Claude Code session opened on ~/Downloads/UBS
Written by Claude (chat) 2026-09-05. Every anchor below was read from Cliff's terminal on the Mac at
HEAD = `b1251842` (branch `main`, zero tracked changes). Companion to `UBS_plan.md`
(the 449-line "UBS Pipeline Tightening — Implementation Plan"). This document CORRECTS that plan
where it is stale and PINS it to the real app. Where the two disagree, this document wins.

---

## 0. Why this kickoff exists — read this before anything else

On 2026-09-04 a Claude Code session executed all five phases of `UBS_plan.md` against
`/Users/cliff/ubs` — a dead Python/FastAPI/Postgres rebuild from May 2026 that cannot draft a
chapter. Nothing it built touched the real app. The real app is:

    /Users/cliff/Downloads/UBS        Vite/React, JavaScript, git repo, branch main

`/Users/cliff/ubs` is OFF LIMITS. Do not open it, read it, import from it, or "reuse" anything in
it. If `pwd` does not end in `/Downloads/UBS`, stop and say so.

## 1. Where the repo is — verify every line, STOP if any disagrees

```
cd ~/Downloads/UBS && git fetch origin
git rev-parse --short HEAD                              # b1251842
git rev-parse --short origin/main                       # b1251842
git branch --show-current                               # main
git status --porcelain | grep -v "^??" | wc -l          # 0
ls test/*.acceptance.mjs | wc -l                        # 161
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1
   # batteries: 161 green, 0 red, 0 quarantined   (record the checks number — it is your baseline)
```

Read these three files in full before writing anything (repo root, all tracked):
1. `claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md` — §0 "Rules of the Road" still governs.
2. `claude_UBS-HANDOFF-2026-08-26.md` — the app's real topology, storage, anchors, live-proof technique.
3. `UBS_plan.md` — the plan you are executing (Cliff will place it in the repo root; commit it as DOCS-10).

## 2. What the real app is (the plan's assumptions, corrected)

| Plan assumes | Reality at b1251842 |
|---|---|
| Unknown language, "DB vs files" | JavaScript (ESM). No Python, no Postgres, no alembic, no `uv`. |
| Tables / migrations | JSON entity store on disk: `data/users/<uid>/<Entity>.json`, prose blobs in `_FileStore.json` addressed `local://…`, served by `vite-server-store-plugin.js` (`/api/store/<Entity>/…`). New data = a new Entity through that store. NEVER hand-edit the JSON files. |
| Config flags | Discover the app's convention (e.g. `defaultEnabled` in `src/lib/generationContext.js`, DEADGATE-1 scene flags). Do not invent a `.env`-driven settings class. |
| Ghostwriter endpoint = Angela Qwen `:1237` | **WRONG.** The writer calls `/llama/*`, which `vite.config.js:61` proxies to `http://127.0.0.1:8081` — UBS's OWN llama-swap router (ROUTERSPLIT-1, `--models-max 1`). `:1237` is a different llama.cpp instance on this Mac used by other fleet agents. Discover the app's client in `src/lib/localLLM.js` and call models THROUGH IT. |
| "no Ollama / no LiteLLM" | Correct. Also no OpenWebUI. Do not write a new HTTP client. |
| Scenes are stored units | Chapters store one `content_md` blob; scene identity inside a saved chapter is NOT persisted today. `sceneDuplicateSweep.js` works on blocks. This is a Phase 1 design decision — DISCOVER what exists, report, ask; do not assume. |

## 3. The plan's anchors — all five exist (verified from Cliff's terminal)

```
src/lib/sceneWriter.js:1052      function buildFoundationBlock(project)
src/lib/sceneWriter.js:2466      function buildScenePrompt(args)
src/lib/sceneWriter.js:2492      async function generateSceneWithRepair({
src/lib/aiSlopReduction.js:907   export function buildBookStyleLedger(priorTexts)
src/lib/aiSlopReduction.js:926   export function buildStyleBudgetPromptBlock(ledger)
```
Existing modules the plan says exist — confirmed in `src/lib`: `crossChapterDedupe.js`, `eventLedger.js`,
`sceneDuplicateSweep.js`, `pipelineDiag.js`, `regenerateLane.js`. The plan's other named anchors also
matched in `src/lib/chapterStateContract.js` and `src/lib/exportSafetyGate.js`.
Ignore the four `src/lib/sceneWriter.js.backup-before-*` files — stale leftovers, not code.
If any anchor above is not found verbatim, STOP and paste the grep. Do not search for something similar.

## 4. Standing rules (master plan §0) that override anything in UBS_plan.md
- ONE LLM call at a time, everywhere. `for` loops, injectable `callLLM`, `Promise.race` timeout, fail open.
  `Promise.all` against the local router breaks it. This applies to beat extraction and backfill.
- Prose is never regex-edited. The plan's "cut/compress" is a STATUS on stored data, never a text mutation.
- Classification only via `isNonfictionProject` / `isFictionProject` (projectType.js). No `book_type ===`.
- No real titles, pen names, character or place names in code or tests. Fixtures: Mara, Dov, Ilse
  (the plan's "Mara/Lewis" examples are fine as fixtures; nothing from a real book is).
- One commit per change, one per battery (`test/<name>.acceptance.mjs`, wired into `run-all`), exact
  commit names, run-all must be 161 + (number of new batteries) green, 0 red. `npm run build` passes.
- Never `--force`, never rebase. Never write under `data/` except through the app's store API.
- After VERIFY: `git push origin main && git push origin main:agent/narrative-connect-1`.

## 5. Lessons from 2026-09-04 that DO transfer (design, not code)
- The Qwen writer "thinks" before answering; on `finish_reason === "length"` the `content` field is
  empty and `reasoning_content` is mid-thought. Never fall back to `reasoning_content` on truncation.
  Check how `localLLM.js` handles this TODAY before building anything that parses model output.
- Every model-calling path must make failure visible: an API error, truncation, or unparseable JSON
  must never return an empty-but-valid-looking result ("0 beats", "0 flags"). Raise or report; the
  policy layer decides whether to continue.
- A thin writer packet needs a one-line CANON NAMES field (POV full name + cast names) or the model
  confabulates surnames. Nothing else goes in it.
- Reader-pass JSON needs ≥ 4k output tokens per window and a truncation check, or it silently returns 0.
- The Anthropic key used on Sep 4 was exposed in a transcript. Cliff rotates it. The new key lives
  ONLY in a local env file that is gitignored; it is never printed, logged, or committed.

## 6. Books for Phase 2 calibration (per the record — confirm with `ls data/users/*/` before use)
- Fiction flagship "Dustbowl Pitstop" = `/projects/mst2el24-2eg7ue0s` (the Aug docs call it REDUX).
- Original Lipstick & Lug Nuts `69d690a8…` (28 real resurrections found by GATEPROMOTE-1).
- False North `69d95aed…` (Margot/Declan resurrections). These two are the plan's "known-bad" books.

## 7. Session discipline
This session = **Phase 0 only** (0.1 survey → `docs/pipeline-map.md` written from THIS repo; 0.2 capture
hook wrapped around the real scene-generation call site under a flag, default off; 0.3 report script).
Commits: `PROSELAB-1-PIPELINE-MAP`, `PROSELAB-1-CAPTURE-HOOK`, `PROSELAB-1-REPORT-SCRIPT`,
`PROSELAB-1-ACCEPTANCE-BATTERY`, plus `DOCS-10` for UBS_plan.md and this file.
The one number Phase 0 must produce: the REAL compiled prompt size for one real chapter of the
fiction flagship, captured live. The plan claims ~91k characters. Nobody has measured it on this app.

VERIFY (paste raw): `git log --oneline b1251842..HEAD`, the new battery tail, run-all tail, build tail,
`git status --porcelain | grep -v "^??" | wc -l` → 0, then push both branches and paste the three
rev-parse lines one per line. Do not start Phase 1.

Do not claim success. Paste the raw output and stop.
