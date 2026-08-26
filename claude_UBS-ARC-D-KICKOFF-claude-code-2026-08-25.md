# ARC D KICKOFF — paste into a FRESH `claude` session in ~/Downloads/UBS
Written by Claude (Cowork) 2026-08-24 night after live-verifying Arc C's close-out on the Mac:
HEAD = origin/main = origin/agent/narrative-connect-1 = `d269cd61`, branch `main`.

---

You're working in ~/Downloads/UBS on the Unity Book Studio repo. Read these THREE files in full
before anything else — repo root, untracked on purpose, never delete or git-clean them:

1. claude_UBS-issue-breakdown-2026-08-24.md
2. claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md — Section 0 "Rules of the Road" governs
   everything. Follow it exactly. Do not skip, combine, or "improve adjacent code."
3. claude_UBS-LIVEPROOF-ARC-B-C-2026-08-24.md — yesterday's live proof; finding 1 is yours this arc.

Other untracked things you'll see and must not touch: `.claude/`, `proofreader/`, and every other
`claude_*.md` (PROOFREADER docs, the B and C kickoffs, this file). `git status --porcelain` should
show exactly **10** lines, all `??`. Read the plan's "porcelain 0" as zero TRACKED changes.

## Where the repo actually is (supersedes the plan's stated numbers)

Landed: PREFLIGHT-1, Arc A, DEADTEST-1..6, Arc B (REGENLANE-1), Arc C (POLISHSAFE-4 — 16 M-class
stages retired, hardcoded book strings deleted, plus 644be62e retiring `fixMidSentenceCaps`).
Live proof for B+C passed on REDUX (MALFORMEDSENT 78→10, paragraphs 1,715→1,715, 0 lane reverts).
Verify before touching anything; STOP if any line disagrees:

```
cd ~/Downloads/UBS && git fetch origin
git rev-parse --short HEAD; git rev-parse --short origin/main; git rev-parse --short origin/agent/narrative-connect-1
   # all three: d269cd61   (one ref per line — a combined multi-ref rev-parse misbehaves in this shell)
git branch --show-current                              # main
git log --oneline -1                                   # d269cd61 POLISHSAFE-4-STAGE-INVENTORY-UPDATE
git status --porcelain | wc -l                         # 10 (all untracked)
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1
   # batteries: 121 green, 0 red, 1 quarantined   |   <record the checks number — it is your baseline>
```

Battery arithmetic (rule 0.4): the plan's "expect 120 green" for Arc D is stale. Arc D adds five
batteries (statecontract1, scenedup1, arcstate1, biblegate1, pronounlock2) plus one more named below
(subjectguard2) → **127 green, 0 red, 1 quarantined**; checks strictly > your recorded baseline.

Wave-era baseline: `test:narrative-connect` EXIT 0 (23/23). `test:polish-pipeline` file-by-file with
the alias loader: the previous session reported 18/20 green after Arc C. Measure it yourself at the
start and record the exact red set with per-file counts; it must be a subset of
{researchAgentBehaviorRegression 6/69, liveExportSafetyRegression 6/56, llmProsePolisher 2/13} and
must be byte-for-byte identical at the end of the arc. If one of those three is already green, say
which and why in your report; do not chase it.

## DISCOVERY corrections (anchors moved since 2cfa197 — re-verified live 2026-08-24 night)

- `generateChapterSceneByScene` is at `sceneWriter.js:3406` (plan says 3376); the inline assembly
  the plan describes is ~3720–3850; `prior_completed_events:` is at 3848 (plan says ~3817).
- The CHARACTER PRONOUNS line is `sceneWriter.js:2331` (plan says 2328) — same builder.
- Planner side matches exactly: `grep -c "\[CHARSTATE\] Planner contract" src/pages/ProjectStudio.jsx`
  → 1; `buildCharacterStateContract(charState)` at 3429; `buildSceneBeatPrompt` at `autonovel.js:1266`.
- `draftChapter` at `ProjectStudio.jsx:3842` and `handleDraftAll` at 4873 — match exactly.
- `eventCollision.js` exports match the plan (extractEventEntities 86, classifyEventAction 115,
  findProseEventCollisions 172, findBeatEventCollisions 222, plus rewriteBeatCollisions 270).
- `pronounLock.js`: `PERSON_NOUN_RX` 268, `safeSpanEnd` 289, `countBoundPossessives` 309,
  `PRONOUN_LOCK_VERSION = 'pronoun-lock-v3'` 548. Batteries to sync when you bump to v4:
  `test/pronounlock1.acceptance.mjs`, `test/pronounvar1.acceptance.mjs`, `test/pronounvar2.acceptance.mjs`.
- **The lane's `extraDetectors` hook already exists** in `finalizeChapterProse`
  (`sceneWriter.js:3069`: `extraDetectors: [detectBannedVocabulary], // POLISHSAFE-4`). D3 appends
  `sceneDup` and `arcRestart` to that array and passes `stateFacts: contract.block` alongside — do
  not create a second lane call.
- `buildPriorChapterEventLedger` is in `src/lib/eventLedger.js:76`;
  `auditProseAgainstCharacterState` in `src/lib/characterStateLedger.js:296`.
- Anthology guard: `finalizeChapterProse` already skips NF via `isNonfictionProjectAuthority(project)
  && !isNonfictionAnthology(project)`; `isAnthologyProject` lives in `src/lib/anthologyEngine.js:661`.
  D1's "anthology → no cross-story sections" check must use these, never a new `project_type ===`.

## Arc D = §5 as written (D1 → D2 → D3 → D4 → D5 → D6 → VERIFY) + one item from the live proof

**D7 — SUBJECTGUARD-2 (from live-proof finding 1).** `verifySubjectRepair` in `src/lib/subjectRepair.js`
accepts ANY cast name as the restored subject; its gender guard fires only when the sentence carries a
bound pronoun. Live on REDUX Ch.10: "Thompson stopped wiping. His gaze fell on the notebook. His eyes
met Sadie's. Looked back at the notebook." → the model chose **Zinnia**, the verifier accepted it, and it
saved. Add guard (c): when the chosen subject is a cast NAME and the preceding sentences of the same
paragraph name exactly one cast member as an actor (sentence-initial name, or a pronoun chain that
resolves to one — reuse `subjectBoundGender` / the PRONOUNVAR-2 attribution from D5), a different
name is rejected with reason `actor-mismatch`. Pronoun subjects (He/She/They/It) stay allowed. Fail
toward SKIP, never toward a rewrite. Also apply the same check inside the regenerate lane's
`verifyRegeneratedParagraph` only if it is a one-line addition; otherwise leave the lane alone.
Commit `SUBJECTGUARD-2-ACTOR-CONTINUITY`; battery `test/subjectguard2.acceptance.mjs` (≥ 5: the Ch.10
shape with generic names rejects the wrong name; accepts the right name; accepts "He"; a paragraph
with two actors does not fire; version string). Commit `SUBJECTGUARD-2-ACCEPTANCE-BATTERY`.
Fixture names generic (Mara, Dov, Ilse) — never the book's.

Order: D1 → D2 → D3 → D7 → D4 → D5 → D6 → VERIFY. One commit per change, one per battery, names
exactly as the plan writes them. If the session runs long, stop at a pushed commit boundary with
"D progress: <done list> / <remaining list>" and Cliff will resume in a fresh session — that is
Cliff overriding rule 0.2/7 on purpose.

## Live proof — Cowork Claude drives it; you prepare it

Cliff does not run live proofs by hand any more. When VERIFY passes and both branches are pushed,
write ONE message for Cliff to paste to Cowork Claude containing: which REDUX chapter to redraft (pick
the first chapter AFTER a departure — the issue breakdown says JB departs in Ch.9, so Ch.10 unless
the ledger says otherwise; state your reasoning), the exact console tags to capture
(`[STATECONTRACT] Ch.N:`, `[BIBLEGATE]`, `[REGENLANE] writer-final`, `[SCENEDUP]`/`[ARCSTATE]` if you
log them, and the export-gate scan showing no `DEPARTED_CHARACTER_ACTIVE` for that chapter), the
expected values, and the STOP conditions. Then wait. Cowork Claude will run it in Chrome and hand
back an evidence file; Cliff pastes its summary to you; you close out. Do not start Arc E.

Standing rules as a backstop: one LLM call at a time (`for` loops, injectable `callLLM`, `Promise.race`
timeout, fail open); prose is regenerated-and-verified or flagged, never regex-edited; classification
only through `isNonfictionProject`/`isFictionProject`; generic fixture names only; batteries lock
behavior — change an expectation only when this arc retires it and name it in the commit (the
pronoun-lock v4 version bump is the one expected case); nothing named hermes, nothing under
base44/; never `--force`, never rebase; after VERIFY passes,
`git push origin main && git push origin main:agent/narrative-connect-1`.
