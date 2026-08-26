# ARC H FOLLOW-UPS + ARC I KICKOFF — paste into a FRESH Claude Code session on the local ~/Downloads/UBS folder
Written by Claude (Cowork) 2026-08-26 after verifying the Arc H landing (091092c6, 148/148 green offline):
HEAD = origin/main = origin/agent/narrative-connect-1 = `091092c6`, branch `main`, at time of writing.
This file and claude_UBS-LIVEPROOF-ARC-H-2026-08-26.md are NEW and untracked on the Mac — Step 0 commits them.

---

You're working in ~/Downloads/UBS on the Unity Book Studio repo. Read these FOUR files in full first:
1. claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md — §0 "Rules of the Road" governs everything; §10 is Arc I.
   This document SUPERSEDES §10's line numbers (re-verified live at 091092c6).
2. claude_UBS-HANDOFF-2026-08-25.md — standing rules on one page.
3. claude_UBS-LIVEPROOF-ARC-H-2026-08-26.md — the Arc H landing check and findings 53–58 (Step 0 fixes 53/54/55).
4. claude_UBS-ARC-H-KICKOFF-claude-code-2026-08-26.md — NAMEGATE-1's contract (Step 0 tightens it, nothing else).
Never modify or delete any claude_*.md, `.claude/`, or `proofreader/`.

## Where the repo actually is
```
cd ~/Downloads/UBS && git fetch origin
git rev-parse --short HEAD                              # 091092c6
git rev-parse --short origin/main                       # 091092c6
git rev-parse --short origin/agent/narrative-connect-1  # 091092c6   (one ref per line)
git branch --show-current                               # main
git status --porcelain | grep -v '^??' | wc -l          # 0   (the two new claude_*.md show as ?? until Step 0)
ls test/*.acceptance.mjs | wc -l                        # 148
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1     # 148 green, 0 red, 0 quarantined — record checks: baseline
```
Battery arithmetic (rule 0.4): Step 0 adds NO battery files (hygiene1's exempt list grows; namegate1 gains ≥ 3 named
checks). Arc I adds exactly TWO — `test/orch1.acceptance.mjs`, `test/runner1.acceptance.mjs` → **150 green, 0 red,
0 quarantined**, 150 files. Wave-era: `test:narrative-connect` EXIT 0 (23/23); `test:polish-pipeline` reds exactly
`tests/researchAgentBehaviorRegression.test.mjs` and `tests/llmProsePolisher.test.mjs`, byte-for-byte unchanged
(`git diff --stat 091092c6..HEAD` on them empty); `npm run build` passes; `npm run -s test:legacy` summary unchanged
(66 run green) except where Step 0 or Arc I legitimately moves a file — name it.

## Step 0 — DOCS-2 + the two Arc H follow-ups (land BEFORE Arc I; VERIFY-lite; push)
**DOCS-2**: `git add claude_UBS-LIVEPROOF-ARC-H-2026-08-26.md claude_UBS-ARC-I-KICKOFF-claude-code-2026-08-26.md`, commit
`DOCS-2: Arc H evidence and Arc I kickoff`. Nothing else in that commit.

**HYGIENE-1B (finding 53)** — restore exactly two lines: `src/lib/anthologyRenamePass.js` NEUTRAL_POOL `'Quillon'` →
`'Marlowe'` (line 38 today); `src/lib/canonNameLock.js` inferAliasPairs `{ a: 'Nikolai', b: 'Halvard' }` →
`{ a: 'Nikolai', b: 'Silas' }` (line 156). Add both files to the exempt list in `test/hygiene1.acceptance.mjs` with the
reason `rule data — Arc J LEGACYREPAIR-1`; the exempt list becomes exactly five files (nameHygieneRules.js,
legacyProseRepairs.data.js, manuscriptFixer.js, anthologyRenamePass.js, canonNameLock.js) and the battery's
"exempt list is exactly …" check is updated to five (name it in the commit). `'Quillon'` must not appear anywhere in
src/lib after this. Commits: `HYGIENE-1B-RESTORE-RULE-DATA` (source), `HYGIENE-1B-ACCEPTANCE-BATTERY`.

**NAMEGATE-1B (findings 54, 55)** — the detector is right; its INPUTS leak prose into "established":
- Cast: every NAMEGATE call site must use the SHEET-ONLY cast — `harvestCastNames(project?.characters_md, [])` — never the
  prose-augmented list (which today contains any name mentioned ≥ 12 times, e.g. the fabricated ones). Sites:
  `sceneWriter.js` writer-final block (~3114–3160: keep the existing prose-augmented `cast` for the lane's other checks;
  build a separate `sheetCast` for `makeUnknownPersonDetector`), `manuscriptPolishRunner.js` both lists (~989 / ~1007),
  `exportSafetyGate.js` NAMEGATE block (~766–768: `ngCast` becomes sheet-only).
- Evidence: `buildFictionEvidence(project, { chapters })` must NOT fold chapter `beat_summary` / `summary` /
  `scene_beats_json` / `title` into the evidence — those are generated downstream of the bible (the outline stage invented
  "Silas" into two chapters' beats, so the gate called him established). Keep the parameter for API stability but make
  every call site pass `chapters: []` AND make the function ignore chapter beat fields (document why in the JSDoc).
- Counts: the gate reason becomes `NAMEGATE-1: "<Name>" (<M> mention(s), <S> signal(s)) is not in the bible or cast`
  where M = whole-word occurrences in the chapter body and S = signal hits; `findUnknownPersons` returns both `mentions`
  and `signals` (keep `count` = signals for compatibility, add `mentions`).
- Battery `test/namegate1.acceptance.mjs` gains ≥ 3 NAMED checks: (a) an unknown name mentioned 15× in the prose is
  still flagged when the cast is sheet-only (and the test proves the prose-augmented harvest WOULD have hidden it);
  (b) a name that appears only in a chapter's `scene_beats_json` is still flagged; (c) the reason string carries both
  numbers. Commits: `NAMEGATE-1B-SHEET-CAST-AND-BIBLE-ONLY-EVIDENCE`, `NAMEGATE-1B-ACCEPTANCE-BATTERY`.
Live numbers you are matching (offline, fiction flagship, 20 chapters, at 091092c6 with the fixed inputs): exactly two
unknown persons — Ch.10 "Silas" (20 mentions / 7 signals: honorific + name-verb + possessive-part) and Ch.13 "Henderson"
(33 / 21: name-verb + honorific); every other chapter 0. Cowork Claude re-runs this after you push.

VERIFY-lite after Step 0, then push:
```
for f in hygiene1 namegate1 regenlane1 regenlane1c; do NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" node test/$f.acceptance.mjs | tail -1; done
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1     # 148 green, 0 red, 0 quarantined; checks > baseline
grep -rn "'Quillon'" src/lib | wc -l                           # 0
git push origin main && git push origin main:agent/narrative-connect-1
```

## DISCOVERY corrections for Arc I (re-verified live 2026-08-26 at 091092c6)
- `draftChapter` is `src/pages/ProjectStudio.jsx:3949` (`const draftChapter = async (chapter, shouldRefresh = true,
  modelOverride, onProgress, options = {}) =>`), body runs to ~4997 (plan said 3842–4817); `handleDraftAll` is **4998**
  (plan: 4873). File is 7022 lines. `finalizeChapterProse` is called at ProjectStudio.jsx **4763** and sceneWriter.js
  **4977** (plan: 4638 / 4775); it is defined at sceneWriter.js 2991; `generateChapterSceneByScene` at 3499.
- The body's UI/global touches (grep of 3949–4997): `setBusyLabel` ×6, `setChapterDraft` ×4, `invokeLLMWithRetry` ×3,
  `NovelProject.update` ×3, `toast.error` ×2, `Chapter.update` ×1, `Chapter.filter` ×1, `pipelineSnapshot` ×5 — DISCOVER
  the full list by reading the body (React state setters, refs, hooks, imports from `@/api`, `queryClient`, `navigate`,
  `window`); list every one in the commit body.
- Pipeline stage snapshots come from `src/lib/pipelineDiag.js` (`snapshot(chapterId, stage, text)`, reported via
  `window.__UBS_PIPELINE.report()`); the stages the UI emits inside draftChapter today: `'1-raw-llm-output'` (4125),
  `'2-after-continuation'` (4300), `'3-fast-save-point'` (4305), `'4-after-judge-revision'` (4588), `'8-final-save'`
  (4824) — DISCOVER 5–7 (they may live in sceneWriter.js or be retired); the battery asserts the exact ordered list you find.
- Server auth: `vite-server-store-plugin.js` — session is a stateless HMAC token in an httpOnly cookie (339–365:
  `getSessionUser(req)` 351, `setSessionCookie` 358); the gate is in `configureServer` at ~533–537 (`PROTECTED_PREFIXES`,
  `sendError(res, 'Not authenticated', 401)`); `DATA_DIR/_auth/` holds `users.json`, `secret.key`, `migration.json`
  (live). No `data/_runs/` exists yet. `scripts/` holds `stage8-live-canary.mjs` and `ubs-heal-router.sh` only.
- I3 SPEED-1 is MEASURED work on the live router (before/after `[TIMING]` on the same chapter) — NOT this session; it is a
  live protocol with Cliff. This session = I1 + I2 only.

## Arc I = §10 I1 + I2, contracts pinned
### I1. ORCH-1 — `src/lib/chapterOrchestrator.js` (new; relative imports; no React)
`export async function runChapterDraft({ project, chapter, chapters, deps, options })` = the MOVED body of draftChapter.
`deps` carries every UI/global the body touches (`Chapter`, `NovelProject`, `FileStore`, `invokeLLMWithRetry`/`callAgent`,
`pipelineSnapshot`, `onProgress`, `toast`, `log`, plus whatever DISCOVERY finds — the full list in the commit body). React
state calls become `deps.onProgress({ stage, label, chapterId, … })` events; nothing else changes. `draftChapter` in
ProjectStudio.jsx becomes a thin wrapper (< 60 lines) that builds `deps` from the component's scope and calls
`runChapterDraft`. MOVE, do not rewrite: `git diff` of the moved body vs the original must be limited to `deps.`
prefixes and the state-call → onProgress swaps (prove it in the battery by a normalized textual comparison of the
extracted function against the 091092c6 body: strip `deps.`, map each `setX(...)` to its onProgress form, and the
remaining diff is empty — the battery embeds the 091092c6 body hash and the mapping table). Fail-open behaviour and every
console tag stay byte-identical.
Battery `test/orch1.acceptance.mjs` ≥ 8: wrapper < 60 lines; `runChapterDraft` exported; a mocked-deps run (fixture
project Mara/Dov/Ilse, mocked LLM returning fixed prose) emits `pipelineSnapshot` stages in the exact order the UI
emitted; `onProgress` receives one event per former state call; no import of React or `@/` aliases in the orchestrator;
`finalizeChapterProse` still called once at the same point; the normalized-diff check above; the two call sites of
`finalizeChapterProse` unchanged in count.

### I2. RUNNER-1 — `scripts/ubs-run.mjs` + localhost runner token
Node + alias loader. Commands: `draft --project <id> [--chapters 1-20] [--resume <runId>]`, `polish --project <id>`,
`export --project <id>`. Auth: `data/_auth/runner.token` generated on first server start (32 random bytes hex, mode 600),
accepted by `vite-server-store-plugin.js` in place of the session cookie ONLY when `req.socket.remoteAddress` is
127.0.0.1/::1/::ffff:127.0.0.1 AND the header `x-ubs-runner-token` matches (constant-time compare) — resolves to the
token's owner uid stored next to it (`runner.token.json` `{ uid }`, the first user); a token presented from any other
address is a 401 with the reason logged. State: `data/_runs/<runId>.json` (chapter → status / content SHA-256 /
timestamp), `--resume` skips completed chapters; log `data/_runs/<runId>.log` with the same console tags; stop file
`data/_runs/<runId>.stop` halts after the current chapter. SEQUENTIAL across chapters (SEQFIX-1). The runner calls
`runChapterDraft` with `deps` built from a Node-side store client (fetch to http://127.0.0.1:5180/api/store/… with the
token) — no browser. `polish` and `export` reuse the existing runner/gate entry points (`manuscriptPolishRunner.js`,
`exportSafetyGate.js`) — DISCOVER the minimal deps they need.
Battery `test/runner1.acceptance.mjs` ≥ 8: token rejected off-localhost (mock socket address); token accepted on
localhost resolves the uid; wrong token → 401; checkpoint written per chapter (mocked orchestrator); `--resume` skips
completed; stop file halts after the current chapter; chapters run strictly sequentially (mock records ordering);
`--chapters 3-5` parses inclusively; export command runs the gate and exits non-zero when blocked.
Commits, in order: `ORCH-1-EXTRACT-CHAPTER-ORCHESTRATOR` + `ORCH-1-ACCEPTANCE-BATTERY`; `RUNNER-1-LOCALHOST-TOKEN-AND-CLI`
+ `RUNNER-1-ACCEPTANCE-BATTERY`.

## VERIFY (paste raw output; do not summarise)
```
cd ~/Downloads/UBS
git status --porcelain | grep -v '^??' | wc -l                       # 0
git log --oneline 091092c6..HEAD                                     # DOCS-2, HYGIENE-1B ×2, NAMEGATE-1B ×2, ORCH-1 ×2, RUNNER-1 ×2
for f in hygiene1 namegate1 orch1 runner1 regenlane1 deadgate1; do NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" node test/$f.acceptance.mjs | tail -1; done
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1           # 150 green, 0 red, 0 quarantined; checks > baseline
npm run -s test:legacy 2>&1 | tail -2
NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" npm run -s test:narrative-connect 2>&1 | tail -2
git diff --stat 091092c6..HEAD -- tests/researchAgentBehaviorRegression.test.mjs tests/llmProsePolisher.test.mjs   # empty
grep -rn "'Quillon'" src/lib | wc -l                                  # 0
npm run build 2>&1 | tail -1
git push origin main && git push origin main:agent/narrative-connect-1
git rev-parse --short HEAD; git rev-parse --short origin/main; git rev-parse --short origin/agent/narrative-connect-1
```
Then stop and say: "Arc I VERIFY passed at <sha> — ready for the live proof." Do not start Arc J. Do not run the
runner against the live server or the real data directory — batteries mock everything.

## STOP conditions (plan §13, unchanged)
A DISCOVERY line disagrees; any existing battery goes red; run-all ≠ 150/0/0; the ORCH-1 normalized diff is not empty
(that means you rewrote instead of moved — stop and report the residue); the build fails; a regex that CHANGES prose;
a real title, pen name, character or place name inside code or a test; a second LLM call in flight; any write under
`data/`. Paste the raw output and stop.
