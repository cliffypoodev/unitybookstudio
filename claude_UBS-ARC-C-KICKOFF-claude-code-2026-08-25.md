# ARC C KICKOFF — paste into a FRESH `claude` session in ~/Downloads/UBS
Written by Claude (Cowork) 2026-08-24 night, after live-verifying Arc B's landing on the Mac:
HEAD = origin/main = origin/agent/narrative-connect-1 = `071db460`, branch `main`.

---

You're working in ~/Downloads/UBS on the Unity Book Studio repo. Read these two files in full
before anything else — repo root, untracked on purpose, never delete or git-clean them:

1. claude_UBS-issue-breakdown-2026-08-24.md
2. claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md — Section 0 "Rules of the Road" governs
   everything. Follow it exactly. Do not skip, combine, or "improve adjacent code."

Other untracked things you'll see and must not touch: `.claude/`, `proofreader/`, and every other
`claude_*.md` (two PROOFREADER docs, the Arc B kickoff, this file). `git status --porcelain` should
show exactly **8** lines, all `??`. Read the plan's "porcelain 0" as zero TRACKED changes.

## Where the repo actually is (supersedes the plan's stated numbers)

Landed so far: PREFLIGHT-1, Arc A, DEADTEST-1..5, Arc B (REGENLANE-1: `src/lib/regenerateLane.js`,
writer wire in `finalizeChapterProse`, runner stage `verifyInvariant('Regenerate Lane')`,
`test/regenlane1.acceptance.mjs`). Verify before touching anything; STOP if any line disagrees:

```
cd ~/Downloads/UBS && git fetch origin
git rev-parse --short HEAD; git rev-parse --short origin/main; git rev-parse --short origin/agent/narrative-connect-1
   # all three: 071db460   (run them one per line — a combined multi-ref rev-parse misbehaves in this shell)
git branch --show-current                              # main
git log --oneline -1                                   # 071db460 REGENLANE-1-ACCEPTANCE-BATTERY
git status --porcelain | wc -l                         # 8 (all untracked)
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1
   # batteries: 119 green, 0 red, 1 quarantined   |   3042 checks passed
```

Battery arithmetic (rule 0.4, previous + number of new batteries): the plan's "expect 115 green" for
Arc C is stale. From 119: `test/polishsafe4.acceptance.mjs` → **120**; the DEADTEST-6 battery below →
**121**. Checks strictly > 3042.

Wave-era baseline: `test:narrative-connect` EXIT 0 (23/23 green). `test:polish-pipeline` run file-by-file
with the alias loader: exactly 5 red — researchAgentBehaviorRegression 6/69, liveExportSafetyRegression
6/56, prosePolisherQualityGate 4/15, llmProsePolisher 2/13, structureInvariant 1. **Arc C owns two of
those five** (see below); the other three must be byte-for-byte unchanged when you're done.

## DISCOVERY corrections (anchors moved since 2cfa197)

- Plan C1 says 45 `verifyInvariant(` call sites. Now: `grep -c "verifyInvariant(" src/lib/manuscriptPolishRunner.js`
  → **46** (Arc B added `verifyInvariant('Regenerate Lane')`; the count includes the function definition
  at line ~178 and the variable-name wrapper call at ~236). Stage-name literals:
  `grep -c "verifyInvariant('" ` → **44**. One inventory row per stage-name literal.
- `vocabCaps.js`: Phase 0 header is at line 89 (plan says 88); the mutation is
  `f.content = f.content.replace(regex, (match) => {` at line 96. Phase 1 header at 116.
- `antiDetectionPolish.js` Step J at line 886 — matches.
- The writer's CHARACTER PRONOUNS line is `sceneWriter.js:2330` (plan says 2328) — same builder.
- Arc B's two lane wire points, where C2 registers the `banned-vocab` `extraDetectors` entry:
  `sceneWriter.js` inside `finalizeChapterProse` (the `regenerateFlaggedParagraphs(finalProse, {…})`
  call, ~line 3060) and `manuscriptPolishRunner.js` inside the Regenerate Lane stage
  (`regenerateFlaggedParagraphs(String(f.content || ''), {…})`, ~line 971).
  `regenerateFlaggedParagraphs` already accepts `extraDetectors`.
- `docs/` does not exist yet; C1 creates it.

## Arc C = POLISHSAFE-4 as written (§4: C1 → C2 → C3 → VERIFY) + the two triaged items it owns

**DEADTEST-6 (do it inside C2, its own commit + battery):** the 2026-08-24 triage found the one real
defect in the polish-pipeline suite: `"They was"` was never ported into `MALFORMED_CANARIES`
(`src/lib/manuscriptSafetyGate.js:400`, only `You was` made it) during SAVEFIX-1's migration, so
`prosePolisherQualityGate.test.mjs` checks 4 and 11 fail for real. Add the canary
(`{ pattern: /\bThey was\b/g, name: 'They was' }`). Commit `DEADTEST-6-THEY-WAS-CANARY`; battery
`test/deadtest6.acceptance.mjs` (≥ 4 checks: canary present, "They was" trips the gate, "You was" still
trips, clean prose does not). Commit `DEADTEST-6-ACCEPTANCE-BATTERY`.

**Inventory row you must not miss (C1):** `runDeterministicGrammarRepair` in
`src/lib/prosePolishQualityGate.js` (line 253; `find: /\bThey was\b/gi` → `They were` at ~276) is a
word-level substitution outside rule 0.2/2's whitelist (a/an agreement only). Class it **M** and retire it
to flag-only in C2 like every other M row. The two prosePolisherQualityGate checks that read a dead
`.pattern` field (real field is `.phrase`, stale since SAVEFIX-1 26229d28) are a test-side correction;
any check in that file that asserted a substitution *happened* is retired by this arc — name every one
in the commit (rule 0.2/5).

**structureInvariant.test.mjs (stale, Arc C owns it):** its "Pattern 4 merges short fragments" check
predates TRIPLETRETIRE-1 (f8aec8a5), which retired that merge stage outright (Step A is a hardcoded
no-op). Correct the expectation to assert the stage is a no-op, name it in the commit
(`POLISHSAFE-4-RETIRE-STRUCTUREINVARIANT-MERGE-ASSERTION`). Do not resurrect the merge.

**Expected polish-pipeline state after Arc C:** prosePolisherQualityGate and structureInvariant green;
the other three red files unchanged at 6/69, 6/56, 2/13. Any other movement = STOP and report.

C3's battery calls `runManuscriptPolishPipeline` with `allowLLM:false, allowRegenLLM:false,
allowSubjectRepairLLM:false, allowStyleLLM:false` — all four options exist now (`allowRegenLLM` landed
in Arc B). Verify the exact names with `grep -n "allow[A-Za-z]*LLM = " src/lib/manuscriptPolishRunner.js`.

## Live proof — one run covers Arc B and Arc C

Arc B's live proof (Fix Entire Manuscript on the REDUX book) has NOT been run yet. Do not run two. At
the end of Arc C, walk Cliff through ONE Fix Manuscript run on REDUX and read both arcs' evidence from
the same console: `[MALFORMEDSENT] Gate scan:` 78 → ≤ 15; `[REGENLANE] Ch.N: targets/regenerated/skipped`
per chapter; `[POLISH][VOCAB]` shows `flagged`, never `removed`; the whole-book word-count delta explained
by `[REGENLANE]` plus the four allowed heals (paste `changes`); export gate `hardFailures 0`; paragraph
count identical to the pre-run export (1,701 for REDUX). STOP on any
`[STRUCTURE-GUARD] Regenerate Lane … REVERTED` (verifier bug) — that stop belongs to Arc B and must be
reported before anything else. Before the run: `npm run dev` is up on :5180, the UBS llama router on
:8081 has the 35B loaded, Cliff hard-refreshes (Cmd+Shift+R) — Arc C touches browser-served files only.

## Session discipline

One arc this session. Order: C1 inventory commit → DEADTEST-6 → C2 retirements (four named commits) →
structureInvariant correction → C3 battery → VERIFY (paste raw: `git log --oneline -12`, the three
battery tails, `run-all` tail, `npm run build` tail, narrative-connect exit code, the five polish-pipeline
per-file counts) → push to both branches → live proof, one step at a time, Cliff is not technical,
wait for his paste. Do not start Arc D. Do not claim success — the VERIFY output and the console tail
are the evidence.

Standing rules as a backstop: one LLM call at a time (`for` loops, injectable `callLLM`, `Promise.race`
timeout, fail open); prose is regenerated-and-verified or flagged, never regex-edited — after this arc,
`allowLLM:false` fiction polish changes nothing but typography and the four allowed heals; classification
only through `isNonfictionProject`/`isFictionProject`; generic fixture names only (Mara, Dov, Ilse);
batteries lock behavior — change an expectation only when this arc retires it, and name it in the commit;
nothing named hermes, nothing under base44/; never `--force`, never rebase; after VERIFY passes,
`git push origin main && git push origin main:agent/narrative-connect-1`.
