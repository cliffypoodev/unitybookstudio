# UBS Master Fix Plan — Session Handoff (2026-08-25, end of Arc G)

Read this first in any new session (Cowork/Claude or Claude Code). It replaces the need to re-read the whole
history. Every SHA and count below was verified on the Mac at the time of writing.

## 1. Who does what
- **Cliff** — owner. Non-technical. Pastes messages between assistants, clicks OK on the app's confirm/alert
  dialogs, decides when to move on ("ready" = write the next arc kickoff).
- **Cowork Claude** (this role) — read-only diagnostician/verifier. Verifies every landing live on the Mac
  (`git --no-optional-locks`, one ref per call), writes per-arc kickoff docs and evidence docs into the repo root,
  drives live proofs in Cliff's Chrome (Claude-in-Chrome), and hands Cliff plain "paste this to Claude Code"
  messages in a code box. Never edits source.
- **Claude Code** (Sonnet 5, Terminal, auto mode) — executes one arc (or one follow-up paste) per fresh session
  in `~/Downloads/UBS`, commits source + battery separately, runs VERIFY, pushes, pastes raw output. Gets ONLY
  console/VERIFY text and the paste message — never files.
- **ChatGPT** — built the n8n Proofreader (live test + PROOFREADER-1 app button still pending).

## 2. Repo facts
- Repo: cliffypoodev/unitybookstudio, local `~/Downloads/UBS` on Mac Studio "Angela", local branch `main`.
- **Current HEAD = origin/main = origin/agent/narrative-connect-1 = `54c1eb99`** (verified clean tree).
- Batteries: `test/*.acceptance.mjs` — **144 files = 143 green + 1 quarantined**. The two polish-pipeline reds
  (`tests/researchAgentBehaviorRegression.test.mjs`, `tests/llmProsePolisher.test.mjs`) must stay byte-for-byte
  untouched every arc.
- Untracked, on purpose, never delete/git-clean: `.claude/`, `proofreader/`, all `claude_*.md` in the repo root.
- Plan docs (repo root): `claude_UBS-issue-breakdown-2026-08-24.md`, `claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md`
  (10 arcs A–J, §0 standing rules, pinned to 2cfa197). Kickoffs: `claude_UBS-ARC-{F,G}-KICKOFF-claude-code-2026-08-25.md`.
  Evidence: `claude_UBS-LIVEPROOF-ARC-{E,F,G}-2026-08-25.md` (findings numbered 19–52 across them).

## 3. Standing rules (plan §0 — never relax)
One LLM call at a time (`for` loops, injectable `callLLM`, `Promise.race` timeout, fail open). Prose is
regenerated-and-verified or flagged, never regex-edited (whole-sentence `{ snippet }` strips are the one sanctioned
NF mechanism). Classification only through `isNonfictionProject` / `isFictionProject` (projectType.js) and
`isNonfictionAnthology` (anthologyEngine.js). No real book titles, pen names, character/ship/town names in code or
tests (fixtures: Mara, Dov, Ilse; Port Ellis / Dr. Hale / Dr. Vance). Batteries lock behavior — change an
expectation only when the arc retires it and name it in the commit. Nothing named hermes; nothing under `base44/`.
Never `--force`, never rebase. Book-specific defects are DATA fixes through the app's real save path, never
hand-edited JSON. Only generalized fixes — never code for one manuscript. After VERIFY passes:
`git push origin main && git push origin main:agent/narrative-connect-1`.

## 4. Arc status
| Arc | Status | Landed at |
|---|---|---|
| PREFLIGHT, A, B, C, D, E | CLOSED (live-proven) | E4 at 7f2c7d2a |
| F (style budget, lane hardening, POLISHSAFE-5, UNDO-1, VERSIONS-1/1B/1C, EXPORTSCRUB-2) | CODE CLOSED | 414c9509 |
| G (nonfiction closed world: NFANTH-CW-1, NFEXPORT-BIB-1, BIBLEGUARD-NAMES-1, TEMPORAL-1, ARCH-2, REGENLANE-2/2B/2C, MALFORMEDSENT-2/3, LENGTHGATE-1C) | **one paste from closing** | 54c1eb99 |
| H (exercise untested surfaces) | next — kickoff not yet written | — |
| I (HEADLESS-1), J (data hygiene), FINAL-ACCEPTANCE | remaining | — |

Progress ≈ 70%.

## 5. Exactly where we stopped
Claude Code landed REGENLANE-2C + LENGTHGATE-1C + MALFORMEDSENT-3 at 54c1eb99 (verified). The offline export gate on
the flagship then exposed **finding 52**: the app's two bibliography generators emit plain-text section headings
("Primary Sources and Archival Records", …) that the app's own export gate hard-blocks as unterminated paragraphs
(masked until now by the LENGTHGATE `continue`). Fix = **BIBFORMAT-1**, not yet landed.

Cliff's Claude Code session then died with a macOS "Operation not permitted" on `~/Downloads/UBS` right after
Claude Code auto-updated (2.1.246). `claude --version` works; launching from the UBS folder gave "Unexpected".
Known fix from last time: quit Terminal fully (Cmd+Q), reopen, `cd ~/Downloads/UBS`, `claude`. If the launcher
complains about file descriptors, run `ulimit -n 65536` first in that window. Nothing needs installing.

### NEXT PASTE for Claude Code (fresh session in ~/Downloads/UBS)
```
Continue from 54c1eb99. Read claude_UBS-LIVEPROOF-ARC-G-2026-08-25.md, section "Landing check" and finding 52. Land one fix as a source commit plus a battery commit, then VERIFY. Standing rules from the master plan §0 apply.

BIBFORMAT-1 (finding 52): the two bibliography generators — src/lib/closedWorldBibliography.js ~130–146 and src/lib/bibliographyGenerator.js ~367–391 — emit their section headings ("Primary Sources and Archival Records", "Government, Institutional, and Web Sources", "Source Categories Consulted", "Source Integrity Note") as plain text lines, and pipelineValidator.js's unterminated-paragraph check (BACKMATTER-1 exempts only markdown `#` headings and a closed word list) hard-blocks them. Change both generators to emit those section headings as markdown level-2 headings (`## …`); ExportTab's DOCX writer already renders `#`/`##` lines as real headings (ExportTab.jsx ~3487–3505). Make sure countBibliographyEntries in src/lib/bibliographyEntryShape.js does not count heading lines as entries, and that isBackMatter / NFEXPORT-BIB-1 behave exactly as before. Do NOT widen the unterminated-paragraph check itself — the generators own the format.

Battery (new file test/bibformat1.acceptance.mjs, fixture-only research with invented sources — no real book titles): (1) output of each generator passes checkStructuralIntegrity from pipelineValidator.js with zero unterminated paragraphs; (2) countBibliographyEntries on that output equals the number of entries, headings excluded; (3) a plain-line heading fixture (the old shape) still fails checkStructuralIntegrity, proving the check itself is unchanged. Re-run test/nfexportbib1.acceptance.mjs and test/lengthgate1c.acceptance.mjs unchanged.

VERIFY: run every test/*.acceptance.mjs — expected 145 files = 144 green + 1 quarantined; tests/researchAgentBehaviorRegression.test.mjs and tests/llmProsePolisher.test.mjs byte-for-byte untouched; git status clean except the known untracked set; then git push origin main && git push origin main:agent/narrative-connect-1 and paste `git rev-parse --short HEAD`, `git rev-parse --short origin/main`, `git rev-parse --short origin/agent/narrative-connect-1` one per line. Stop there — no Arc H.
```

### After BIBFORMAT-1 lands (Cowork Claude's steps)
1. Verify on the Mac: three refs equal, 145 files = 144 green + 1 quarantined, reds untouched, run
   `test/bibformat1.acceptance.mjs`.
2. Data step through the app: Juneteenth (`/projects/6a00e8ce8b115095b27904b6`) → Plan → Foundation →
   "Bibliography" button (one OK dialog for Cliff) → Ch.21 rebuilt with `##` headings.
3. Offline gate: expect hard failures only Ch.8, Ch.9 (quote marks) and Ch.11 (one unterminated paragraph) —
   all book DATA, Arc J. Append to the Arc G evidence doc; **Arc G closes**.
4. On Cliff's "ready": write `claude_UBS-ARC-H-KICKOFF-claude-code-2026-08-25.md`.

## 6. Arc H kickoff — what it must contain (plan §9 + carried items)
H1 DEADTEST-1 (dead/duplicate test sweep), H2 SCENEGATE-ON-1, H3 ROUTERHEAL-2 (land or delete), H4 REWRITE-E2E-1
protocol, H5 KDP-CHAIN-1 protocol, H6 HYGIENE-1. Fold in: 35b NAMEGATE-1; live exercise of NFANTH-CW-1 (anthology
fence), BIBLEGUARD-NAMES-1 (bible generation on a fixture-style NF project), ARCH-2 (a research run —
`[ARCH-2] batch b: kept K item(s), dropped D unsupported atom(s)`); one NF Fix Manuscript run to re-prove finding
48 live (expect `[NFGUARD-1] Ch.N: kept K lane rewrite(s)` and, when applicable, `dropped D … (span not found)`)
and finding 47's attributed reasons (`new-proper-noun:` vs `new-cast-name:`). Before writing it: re-verify refs,
re-count anchors live (line numbers drift), re-derive the battery count from the live file count.

## 7. Open scheduled follow-ups (not blocking)
14 PRONOUNLOCK-3 · 15 LOOKAHEAD-1B · 21 CHARSTATE-3 · 23 normalizeDocxMarkdown leftovers (J) · 24
ALLOW_UNSAFE_EXPORT logging (I) · 34 legacy paragraph-delete stages (J) · 35b NAMEGATE-1 (H) · 35c Cliff should
switch taskType 'polish' from Qwen3-Coder-30B to a prose model before any simile-bar rerun · 35e spaced-apostrophe
artifacts (data) · 40/41 lane prose quality + model padding (length-ratio rejections up to 124×) · 43 POLISHSAFE-6:
"Nonfiction Core" + "Anti-Detection Polish" still change letters in NF mode (J) · 46/51 VERSIONS nits (bibliography
save doesn't record previous version; no-op Ch.1 save mints a version; PROSE-GUARD lines logged twice) · Juneteenth
data fixes through the app: Ch.8/9 quote marks, Ch.11 unterminated paragraph (J) · n8n Proofreader live test +
PROOFREADER-1 button.

## 8. Live-proof technique (Cowork Claude)
- Chrome via Claude-in-Chrome; app at `http://localhost:5180`. Flagships: Juneteenth (NF) `/projects/6a00e8ce8b115095b27904b6`,
  REDUX (fiction) `/projects/mst2el24-2eg7ue0s`. Cmd+Shift+R, then `fetch('/src/lib/<file>.js')` to confirm fresh code.
- Fix Manuscript: menu (top-left) → Polish → Analysis tab → "Fix Entire Manuscript" (8–16 min). A CDP click that
  times out at 30 s = a confirm()/alert() is open → Cliff clicks OK. Clear the console buffer after the run starts.
- Export proof: Publish → Export → Export options → Export DOCX — a DOCX DOWNLOADS if the gate does not block;
  warn Cliff first. Restore: Write → Chapters → chapter → Scenes → "Restore Previous Version".
  Bibliography: Plan → Foundation → "Bibliography".
- Offline harness (device VM, `cd $HOME/mnt/UBS`): `NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" node x.mjs`.
  Prose lives in `data/users/u-6adbdb70a020/_FileStore.json` (record id inside `Chapter.json` `content_md_url`);
  project fields in `NovelProject.json` (`research_data` is a JSON string). `previous_content_md_url` gives the prior
  version — diff against it (the VM's /tmp is wiped between turns; snapshots there do not survive).
  Useful entry points: `runPreExportSafetyGate(chapters, { project })` (exportSafetyGate.js), `scanMalformedSentences`,
  `verifyRegeneratedParagraph(orig, cand, { project, cast })` (regenerateLane.js), `harvestCastNames` (pronounLock.js).
- device_bash: `git --no-optional-locks`, one ref per rev-parse, 45 s cap; heredoc files show mode 600 but Claude
  Code reads them fine. Cliff sometimes pastes a summary or an old report instead of the code box — re-send the box.

## 9. Key code anchors (as of 54c1eb99; re-grep before use)
regenerateLane.js: `verifyRegeneratedParagraph` 226, call site ~487, check (4) ~288–298 (NF strict, reason
`new-proper-noun:`), (4b) ~300–314 (`new-cast-name:`), closed-world (10) diff by atom for NF.
manuscriptPolishRunner.js: NF snapshot 513, lane 962–1000 (`laneReplacementsByFile`), NFGUARD-1 revert +
re-apply ~1395–1440 (exact-once → paragraphIndex + `nfContentEquivalent` fallback → drop log).
exportSafetyGate.js: LENGTHGATE-1B/1C ~144–180 (`isBackMatter` exempt), NFEXPORT-BIB-1 ~504, BOOKGATE-2 ~428–440.
pipelineValidator.js: `checkStructuralIntegrity` ~160–195, BACKMATTER-1 heading regex ~141.
manuscriptSafetyGate.js: agreement rule ~421–440 (shares `clauseHasPluralCommonNoun` from malformedSentence.js).
closedWorldText.js: `normCW`, `createInEV`, `buildEvidenceCorpus`. Bibliography generators: closedWorldBibliography.js
~130–146, bibliographyGenerator.js ~367–391 (`isBackMatter` at 57). ExportTab.jsx markdown heading → DOCX ~3487–3505.
