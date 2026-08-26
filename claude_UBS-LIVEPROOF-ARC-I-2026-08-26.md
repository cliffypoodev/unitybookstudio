# ARC I — LANDING EVIDENCE (Cowork Claude, 2026-08-26)
Kickoff: claude_UBS-ARC-I-KICKOFF-claude-code-2026-08-26.md (Step 0 = Arc H follow-ups HYGIENE-1B + NAMEGATE-1B, then I1 + I2).
Finding numbers continue from Arc H (last = 58).

## Landing check — Step 0 + Arc I (fb62d573) — 2026-08-26 ~13:30–14:00 UTC
HEAD = origin/main = origin/agent/narrative-connect-1 = **fb62d573** (ls-remote agrees); tree clean. Nine commits since
091092c6, exact names: DOCS-2 (90576d84) · HYGIENE-1B-RESTORE-RULE-DATA (bccb47cd) · HYGIENE-1B-ACCEPTANCE-BATTERY
(b2c20f16) · NAMEGATE-1B-SHEET-CAST-AND-BIBLE-ONLY-EVIDENCE (2e70a373) · NAMEGATE-1B-ACCEPTANCE-BATTERY (14f27c1c) ·
ORCH-1-EXTRACT-CHAPTER-ORCHESTRATOR (aa2e7671) · ORCH-1-ACCEPTANCE-BATTERY (95d4b00b) · RUNNER-1-LOCALHOST-TOKEN-AND-CLI
(72a0b0b3) · RUNNER-1-ACCEPTANCE-BATTERY (fb62d573). `git diff --stat 091092c6..HEAD`: 28 files, +2758/−1068.
Batteries: **150 files, 150 green offline** (every test/*.acceptance.mjs run in the device VM, 3 parallel chunks) — 0 red,
0 quarantined; the two polish-pipeline reds 0-line diff vs 091092c6.
HYGIENE-1B (finding 53 CLOSED): `anthologyRenamePass.js` NEUTRAL_POOL has `'Marlowe'` back and `'Quillon'` occurs nowhere in
src/lib; `canonNameLock.js:156` is `{ a: 'Nikolai', b: 'Silas' }` again.
NAMEGATE-1B (findings 54/55 CLOSED live-offline): fiction-flagship export gate at fb62d573 → `[NAMEGATE-1] Gate scan:
Ch.10 1 unknown person(s)`, `Ch.13 1 unknown person(s)`, the other 18 chapters 0 — exactly the prediction (Ch.10 "Silas",
Ch.13 "Henderson"); warning text now carries `<M> mention(s), <S> signal(s)` (exportSafetyGate.js:782).
ORCH-1: `src/lib/chapterOrchestrator.js` 1193 lines, 29 imports, no `@/` alias, `runChapterDraft` exported at 208; the
ProjectStudio.jsx `draftChapter` wrapper is **36 lines** (file 7022 → 6055 lines). Claude Code moved the source-shape
checks of several wave-era tests and batteries (wave5, biblegate1, charstate1, collapsedDialogueParagraphs,
bookScopeLedger, sceneExecutionAcceptanceLiveWiring …) to the new file — named in the commits; all green.
RUNNER-1: `scripts/ubs-run.mjs` 421 lines (`draft|polish|export`, `--chapters`, `--resume`, `.stop`, `data/_runs/`);
token verifier `server/authCore.js:219` `verifyRunnerToken(dataDir, remoteAddress, presented)` — localhost allowlist
first, then length check + `crypto.timingSafeEqual`, uid from `runner.token.json`; plugin header `x-ubs-runner-token`
(vite-server-store-plugin.js:362), `ensureRunnerToken` at 405/545. Side effect on the Mac: `data/_auth/runner.token`
(mode 600) + `runner.token.json` now exist — minted by the dev server restarting on the plugin change (app behaviour,
not a hand write); `data/_runs/` does not exist yet (the runner has not been used).

## Findings
59. Runner token is minted the first time the server starts after RUNNER-1 — record in the handoff that a fresh machine
    gets one automatically; nothing to fix.
60. TESTSWEEP-1's `regression` class holds one REAL production defect: `toolsTaskTypeGuard.test.mjs` finds four live
    `task_type` values outside the valid set — `FloatingBrainstorm.jsx:285` and `IdeasChatbot.jsx:253` use `'chat'`,
    `sceneExecutionAcceptanceRunners.js:132/216` use `'evaluate'` / `'fix'`. Either the valid set is stale (CHATFIX-1 says
    `'chat'` routes to the ideas agent) or the routing silently falls through. → TASKTYPE-1 (Arc J).
61. Two `regression`-class legacy tests (`chapter2SafeReplaceResolutionRegression.mjs`, `staleUrlResolutionRegression.mjs`)
    claim the export gate "no longer blocks … at 20-chapter scope"; their shared 20-chapter helper also throws on the
    current gate return shape. Live gate on the fiction flagship reports `totalChapters 20, scannedChapters 65` (the
    counter is per-sub-gate, not per chapter — misleading but not a scope cap). Triage = Cowork Claude, offline, before
    any code: run each helper against the live gate shape; stale → retire; real → arc.
62. Store hygiene numbers (Arc J evidence): `_FileStore.json` = 4,858 records / 4,620 distinct keys; the NF flagship's
    research key `…/research/research-<id>` is stored **68 times** (STOREKEY-1); NF flagship `research_data` = 47,967
    chars, `research_md` = 96,804 (RERESEARCH-CONFIRM-1 threshold 2,000 is right); chapters: 1,579 total — 1,421 inline
    `content_md`, 158 `local://` keys all resolving, **0 remote, 0 missing** (URLWRITE-GUARD-1 must accept the local://
    shape and reject only an unresolvable/remote URL with an empty body).

## Pending LIVE proofs (need Cliff's Chrome + OK clicks)
Everything listed in the Arc H evidence doc, plus: the runner itself (`node scripts/ubs-run.mjs export --project <id>`
against the running server — expect the gate verdict and exit code; then a one-chapter `draft` on a fixture project) and
I3 SPEED-1 (`[TIMING]` before/after on the same chapter — live router work, its own session).
Arc I is CODE-CLOSED at fb62d573.
