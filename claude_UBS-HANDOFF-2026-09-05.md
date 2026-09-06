# UBS — Session Handoff (2026-09-05, end of day)
Supersedes claude_UBS-HANDOFF-2026-08-26.md. Every SHA and count below was verified from Cliff's terminal.
Read this, UBS-ARCHITECTURE.md, and the newest KICKOFF before doing anything in a new session.

## 1. Where the repo is
- Repo `cliffypoodev/unitybookstudio`, local `~/Downloads/UBS`, branch `main`.
- **HEAD = origin/main = origin/agent/narrative-connect-1 = `085215dc`** (LOCALLLM-NODE-1-ACCEPTANCE-BATTERY). Tree clean.
- Batteries: **165 green, 0 red, 0 quarantined | 4169 checks** (`node test/run-all.mjs`). Build passes.
- `/Users/cliff/ubs` (dead Python rebuild) and the cloud Base44 app remain OFF LIMITS. The Sep 4 session that built
  five phases there is written off; nothing from it landed in this app and nothing from it transfers except design lessons.

## 2. What landed today (all verified from the terminal)
| Commit range | Name | What it is |
|---|---|---|
| `714a963a..f3c112ef` (5) | PROSELAB-1 ×4, DOCS-10 | Phase 0: `docs/pipeline-map.md` survey; `src/lib/proseLab.js` capture module + `ProseLabCapture` entity; flag `prose_lab_capture_v1` off; `scripts/proselab-summary.mjs`; `test/proselab1.acceptance.mjs` |
| `e151ed99..9611aa25` (10) | PROSELAB-1B ×2, BEATLEDGER-1 ×4, SCENEDELTA-1 ×3, DOCS-11 | Step 0 + Phase 1: prompt-section breakdown; `src/lib/beatLedger.js` + `BeatLedgerEntry` entity + live hook after `finalizeChapterProse` + `scripts/beats-backfill.mjs`; `src/lib/sceneDelta.js` + `SceneDelta` entity + flag-gated planner field in `autonovel.js` + `scripts/deltas-backfill.mjs`; `docs/phase1-notes.md` |
| `6d16de26..085215dc` (4) | BEATLEDGER-1B ×2, LOCALLLM-NODE-1 ×2 | Fixes found by the first live backfill: scripts now pass `model:` explicitly; `localLLM.js` resolves `/llama` to `http://127.0.0.1:5180/llama` with the runner token when running under Node |
Flags (all default off, `generationContext.js` shape): `prose_lab_capture_v1`, `beat_extraction_v1`, `scene_delta_v1`.

## 3. Live results
- **Phase 0 capture** (REDUX Ch.5, 2026-09-05 08:50): compiled prompt **60,614 chars (~16,800 tokens)** — lower bound
  (harness dropped the previous-chapter tail). Output 2,359 words vs ~800 target. Prompt sections were `{}` then;
  PROSELAB-1B fills them now, but no capture has been re-run with sections. That is a Phase 5 input.
- **Beat backfill** (REDUX `mst2el24-2eg7ue0s`, 2026-09-05 ~10:40): **20/20 chapters, 0 FAILED, 66 beats** (3–4 per
  chapter, chapter granularity, `source: 'backfill'`), model `qwen3.6-35b-uncensored`, ~15 s per chapter, endpoint
  `http://127.0.0.1:5180/llama`. No Chapter/NovelProject writes. Beat content not yet reviewed for quality.
- First backfill attempt failed 20/20 — correctly reported as FAILED, 0 rows, and led to the two fixes above.

## 4. Findings (open, not blocking)
1. **Headless model calls never worked before today.** `localLLM.js` used a browser-relative `/llama`; every Node script
   (including `scripts/ubs-run.mjs draft` from Arc I) would have failed at the first model call. Fixed by LOCALLLM-NODE-1
   for the fetch; the runner itself has still never drafted a chapter live (runner smoke remains on the list).
2. `src/lib/chapterStorage.js:261` references `window.location` — browser-only; caused `[COHESION] Could not resolve
   previous chapter content` under Node. Same class as (1). Fix belongs to a HEADLESS follow-up, not Phase 2.
3. `docs/phase1-notes.md` (written by Claude Code, not yet independently read) reports that `resolveAgent` picks the
   wrong model for the nonfiction writer; Phase 1 code injects `model:` explicitly to sidestep it. Read and verify before Phase 5.
4. Extraction calls log `Agent: architect` because taskType `beats` has no agent key; the model is correct but
   `AGENT_CTX_TOKENS[architect]` is what applies. Give extraction its own key (Phase 2 tidy-up).
5. `claude_UBS-REPENGINE-PHASE1-COMPLETE-claude-code-2026-09-05.md` is untracked in the repo root; commit it as DOCS-12.
6. Four `src/lib/sceneWriter.js.backup-before-*` files are stale leftovers; delete in a hygiene commit.
7. The Anthropic API key pasted on Sep 4 is burned. A rotated key is required before the Phase 2 reader pass; it lives
   only in a gitignored local env file, never in chat, docs, or commits.

## 5. Current plan and next step
- Plan: `UBS_plan.md` (repetition engine). Phase 0 DONE. Phase 1 DONE (this file). **Next: Phase 2** via
  `claude_UBS-REPENGINE-PHASE2-KICKOFF-claude-code-2026-09-05.md` — mechanical sweep + cluster detection, reader pass,
  calibration on known-bad books with Cliff's judgment.
- The safe loop, unchanged: one phase per fresh Claude Code session opened on `~/Downloads/UBS`; kickoff verified from
  the terminal; Cliff verifies each landing in his own Terminal tab before "push it"; results pasted to chat; next kickoff.

## 6. Books for Phase 2 calibration (confirm IDs from the app before use)
- Fiction flagship "Dustbowl Pitstop" / REDUX = `mst2el24-2eg7ue0s` — 66 beats already in the ledger.
- Original Lipstick & Lug Nuts `69d690a8…` and False North `69d95aed…` — the known-bad books (28 resurrections each per
  LP-ARC-E); need backfill first (~5 min each).
