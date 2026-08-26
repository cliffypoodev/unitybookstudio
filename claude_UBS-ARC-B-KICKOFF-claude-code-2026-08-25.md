# ARC B KICKOFF — paste into a FRESH `claude` session in ~/Downloads/UBS
Written by Claude (Cowork) 2026-08-24 evening, after reviewing the Aug-24 Claude Code transcript
and the polish-pipeline triage table. Live-verified before writing: HEAD = origin/main =
origin/agent/narrative-connect-1 = `e7289660`, branch `main`, no `.git/index.lock`.

---

You're working in ~/Downloads/UBS on the Unity Book Studio repo. Read these two files in full
before anything else — they're in the repo root, untracked on purpose, never delete or git-clean them:

1. claude_UBS-issue-breakdown-2026-08-24.md
2. claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md — Section 0 "Rules of the Road" governs
   everything. Follow it exactly. Do not skip, combine, or "improve adjacent code."

You'll also see `claude_UBS-PROOFREADER-*.md` (two files), a `proofreader/` folder, and a
`.claude/` folder. All untracked, all expected, none of them yours to touch. `git status --porcelain`
should show exactly 6 lines, all `??`. Read the plan's "porcelain 0" as zero TRACKED changes.

## Where the repo actually is (this supersedes the plan's stated numbers)

A previous session on 2026-08-24 landed PREFLIGHT-1, all of Arc A, and DEADTEST-1 through
DEADTEST-5 (the plan only anticipated DEADTEST-1; fixing it unmasked a chain of stale tests
behind it). Verify this yourself before doing anything, and STOP if any line disagrees:

```
cd ~/Downloads/UBS && git fetch origin
git rev-parse --short HEAD origin/main origin/agent/narrative-connect-1   # all three: e7289660
git branch --show-current                                                   # main
git log --oneline -1                                                        # e7289660 DEADTEST-5-ACCEPTANCE-BATTERY
git status --porcelain | wc -l                                              # 6 (all untracked)
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1
   # batteries: 118 green, 0 red, 1 quarantined   |   3017 checks passed
```

Because of that, **the plan's expected battery counts are off by +4 from here on.** Arc B's VERIFY
says "114 green"; the real expectation is **119 green, 0 red, 1 quarantined**, checks > 3017. Arc C
would then be 120, and so on (previous + number of new batteries, exactly as rule 0.4 says). Use the
rule, not the plan's literal number.

Baseline for the wave-era `tests/` suites (rule 0.4: "no worse than before the arc"):
- `test:narrative-connect`: EXIT 0, all 23 files green.
- `test:polish-pipeline`: EXIT 1. The chain stops at file #9 `researchAgentBehaviorRegression.test.mjs`.
  Run file-by-file (not chained), exactly 5 files are red, all pre-existing at 2cfa197 and
  triaged on 2026-08-24: researchAgentBehaviorRegression 6/69 failing, liveExportSafetyRegression
  6/56, prosePolisherQualityGate 4/15, llmProsePolisher 2/13, structureInvariant 1. Any change
  to those five numbers during Arc B = STOP and report. Do not fix them in Arc B (see below).

## What Arc B is and is not

Execute **Arc B — REGENLANE-1** exactly as written in the plan (§3, B1 → B2 → B3 → B4 → VERIFY),
with these clarifications from the triage:

- The five red polish-pipeline files are NOT Arc B work. They were triaged: one real defect
  ("They was" never ported into the shared MALFORMED_CANARIES list during SAVEFIX-1 — Arc C,
  to be fixed as DEADTEST-6 alongside POLISHSAFE-4), plus a note that `runDeterministicGrammarRepair`
  in `prosePolishQualityGate.js` does word-level substitutions beyond the rule 0.2/2 whitelist
  (Arc C inventory row, C1). The rest are stale tests owned by Arc C (structureInvariant, the
  two `.pattern`→`.phrase` prosePolisherQualityGate checks), Arc E (all three liveExportSafetyRegression
  groups), Arc G (the four nonfiction research-wording checks), and three standalones
  (researchAgent R-10/R-29, llmProsePolisher 3/5, unityContaminationSourceRegression + wiring it
  into an npm script). Each gets fixed in the arc that owns it. If Arc B's own changes turn one of
  them green or red as a side effect, report it, don't chase it.
- B1's proper-noun rule extraction (`collectProperNouns` out of `verifyRecastSentence` in
  `crossChapterDedupe.js`) must be behavior-preserving: `test/bookgate3.acceptance.mjs`,
  `test/polishsafe1.acceptance.mjs`, and every other battery that reads or imports
  `crossChapterDedupe.js` stay green with zero expectation changes.
- B2 DISCOVERY anchors were copied at 2cfa197. `sceneWriter.js` had only a comment reworded in
  Arc A (NFCLASS-6) and `manuscriptPolishRunner.js` was untouched, so the counts should still match
  exactly. If a count is off, STOP and paste the grep — do not search for something similar.
- Arc B touches browser-served files only (`src/lib/*`), so the live proof needs a hard refresh
  (Cmd+Shift+R), not a dev-server restart.

## Session discipline

One arc this session. Stop after Arc B's VERIFY block and paste raw output. Then walk Cliff through
the LIVE PROOF one step at a time (he's not technical): which page, which button, what to look for
in the console, what to paste back. Use the exact string he should search the console for
(`[REGENLANE]`, `[MALFORMEDSENT] Gate scan:`, `[STRUCTURE-GUARD]`). Wait for his paste. Do not start
Arc C. Do not claim success — the VERIFY output and his console tail are the evidence.

The standing rules as a backstop: one LLM call at a time (`for` loops, injectable `callLLM`,
`Promise.race` timeout, fail open); prose is regenerated-and-verified or flagged, never regex-edited;
classification only through `isNonfictionProject`/`isFictionProject` in `projectType.js`; no real
book titles, pen names, or character names in code or tests (fixtures: Mara, Dov, Ilse); batteries
lock behavior — change an expectation only when this arc retires it, and name it in the commit;
nothing named hermes, nothing under base44/; never `--force`, never rebase; after VERIFY passes,
`git push origin main && git push origin main:agent/narrative-connect-1`.
