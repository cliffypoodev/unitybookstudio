# FINAL-ACCEPTANCE KICKOFF — prep session (code) + the acceptance RUN protocol
Written by Claude (Cowork) 2026-08-26 after verifying Arc J Session 2 (80a54a70, 158 batteries; findings 64–66):
HEAD = origin/main = origin/agent/narrative-connect-1 = `80a54a70`, branch `main`, at time of writing.
This file is NEW and untracked; claude_UBS-LIVEPROOF-ARC-J-2026-08-26.md is tracked but AMENDED (shows ` M`).

---

You're working in ~/Downloads/UBS on the Unity Book Studio repo. Read FIRST: claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md
§0 (rules) and §12 (the bar); claude_UBS-HANDOFF-2026-08-25.md; claude_UBS-LIVEPROOF-ARC-J-2026-08-26.md (findings 64–66 and
"What remains"). Never modify or delete any claude_*.md, `.claude/`, or `proofreader/`. No writes under `data/` — batteries
mock the store; the harness READS a real project only when Cowork Claude runs it live.

## Where the repo actually is
```
cd ~/Downloads/UBS && git fetch origin
git rev-parse --short HEAD                              # 80a54a70
git rev-parse --short origin/main                       # 80a54a70
git rev-parse --short origin/agent/narrative-connect-1  # 80a54a70   (one ref per line)
git branch --show-current                               # main
git status --porcelain | grep -v '^??' | wc -l          # 1  (the amended Arc J evidence doc — Step 0 commits it)
ls test/*.acceptance.mjs | wc -l                        # 158
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1     # 158 green, 0 red, 0 quarantined — record checks: baseline
```
Battery arithmetic: this session adds TWO battery files — `test/legacyrepair2.acceptance.mjs`, `test/accept1.acceptance.mjs`
(STOREKEY-1B edits an existing battery) → **160 green, 0 red, 0 quarantined**. Wave-era reds unchanged
(`git diff --stat 80a54a70..HEAD` on the two files empty); `test:legacy` 67 green; `npm run build` passes.

## DISCOVERY (live at 80a54a70)
- `test/storekey1.acceptance.mjs` check 4b compares `updated_date` across two creates that can share a millisecond
  (fails ~50% in a fast VM; passes on the Mac). Deterministic fix: `await new Promise(r => setTimeout(r, 3))` between the
  creates, or inject a clock. The store's own `nowISO()` is the only clock.
- `src/lib/manuscriptFixer.js` single-manuscript literal rules (finding 65): 81 (doc comment), 4965–4966 (`The line went
  dead` + `Elias sat`), 5038–5045 / 5281–5288 / 5327–5328 / 6080 (the "Caspian’s hand, the one that had touched him felt"
  family — rule, its self-test fixtures, and the export-time detector line), 5063–5065 / 5357–5358 / 6151 ("older than
  Jonah had expected maybe" family). 24 lines. These cannot fire on any other manuscript.
- §12 criteria → the functions that measure them (all exist; reuse, never re-implement):
  export gate `runPreExportSafetyGate(chapters, { project })` (`exportSafetyGate.js:97`) → `blocked`, `hardFailures`,
  `warnings`, per-chapter `dialogueIssueCount` (227–270 = quote balance), the `[MALFORMEDSENT] Gate scan`, `[TEMPORAL-1]`,
  `[NFEXPORT-BIB-1] Gate scan`, `[NAMEGATE-1] Gate scan` lines; `scanMalformedSentences(text, cast)` (`malformedSentence.js:71`);
  `buildCharacterState(chapters, cast)` + `buildCharacterStateContract` (`characterStateLedger.js:269/329`) → codes
  `DEPARTED_CHARACTER_ACTIVE`, `DUPLICATE_INTRODUCTION`; `EVENT_CLASS_REPLAY` comes from `sceneContractGate.js:897`;
  `runSceneDuplicateSweep(loaded)` (`sceneDuplicateSweep.js:793`) for same-chapter scene dups; `measureSimileDensity(text)`
  (`aiSlopReduction.js:893`) → per-1k; template families: `templateFamilies.js` (STYLEBUDGET-3 — DISCOVER the exported
  budget table and the per-book count function); `findCrossChapterDuplicateSentences(chapters)` (`crossChapterDedupe.js:80`,
  12+-word); paragraph counts: `split(/\n\s*\n/)` on the stored text before/after polish (the runner's `data/_runs/<id>.json`
  records content SHA per stage — extend it with paragraph counts if absent); NF closed world: `closedWorldCheck(prose,
  project)` (`closedWorldText.js:174`); Sources present: the gate's NFEXPORT-BIB-1 line; front matter: `isFrontMatter(ch)`
  (`bibliographyGenerator.js:42`); DOCX "opens and reads to the end": the ExportTab writer is browser-side — the harness
  checks the gate verdict and the assembled HTML (`buildBookHtml.js`) instead, and the DOCX open is a human step.
- Runner: `scripts/ubs-run.mjs` (`draft|polish|export`, `--project`, `--chapters`, `--resume`, stop file, `data/_runs/`),
  token in `data/_auth/runner.token`, header `x-ubs-runner-token`, localhost only.

## Step 0 — DOCS-5
`git add claude_UBS-LIVEPROOF-ARC-J-2026-08-26.md claude_UBS-FINAL-ACCEPTANCE-KICKOFF-claude-code-2026-08-26.md`,
commit `DOCS-5: Arc J Session 2 evidence and FINAL-ACCEPTANCE kickoff`.

## F1. STOREKEY-1B — deterministic battery
Fix check 4b as above; the check must pass 20/20 in a loop (`for i in $(seq 20); do … | tail -1; done` — paste the tally).
Commit `STOREKEY-1B-DETERMINISTIC-UPDATED-DATE-CHECK` (battery-only).

## F2. LEGACYREPAIR-2 — delete single-manuscript rules (finding 65)
Remove the three rule families and their self-test fixtures/detector lines listed above from `manuscriptFixer.js`, and the
doc-comment example at 81. No generic replacement — these are not patterns, they are sentences. Battery
`test/legacyrepair2.acceptance.mjs` ≥ 4: the three literal phrases occur nowhere in src/lib; the eight names
(Elias Orin Caspian Jonah Silas Lev Ronan Kael) occur nowhere in `manuscriptFixer.js` or `legacyProseRepairs.data.js`
(extend hygiene1's tracked list for those two files, name it); the fixer still repairs a generic fixture the surrounding
rules target (prove one neighbouring rule unchanged); the exported rule count dropped by exactly the number you removed
(state it). Commits `LEGACYREPAIR-2-DELETE-SINGLE-MANUSCRIPT-RULES`, `LEGACYREPAIR-2-ACCEPTANCE-BATTERY`.

## F3. ACCEPT-1 — `scripts/ubs-accept.mjs`, the §12 bar as a machine-checked report
`node scripts/ubs-accept.mjs --project <id> [--run <runId>] [--json out.json]` (Node + alias loader; reads the store through
the same token client as ubs-run.mjs; never writes to the store). Computes EVERY §12 criterion and prints one line each,
`PASS`/`FAIL`/`N/A`, with the measured number and the threshold:
- gate: `blocked=false`, `hardFailures=0` (list each failure's chapter + first reason on FAIL)
- `[MALFORMEDSENT] Gate scan: 0` (sum of `scanMalformedSentences` over chapters with the sheet cast)
- `DEPARTED_CHARACTER_ACTIVE 0`, `DUPLICATE_INTRODUCTION 0` (character-state contract over all chapters),
  `EVENT_CLASS_REPLAY 0` (scene-contract audit — DISCOVER its entry point), same-chapter scene dups 0
- simile density ≤ 3.0 / 1k book-wide (`measureSimileDensity` on the joined text) and the per-chapter max
- every template family within budget (STYLEBUDGET-3 table; report each family's count vs budget)
- cross-chapter 12+-word duplicates 0
- quote balance 100 % every chapter (`dialogueIssueCount === 0` for every chapter in the gate result)
- paragraph count before polish == after polish ± reported allowances (from `data/_runs/<runId>.json` when `--run` is
  given; N/A otherwise, and say so)
- NF only (via `isNonfictionProject`): closed-world flags 0 (`closedWorldCheck` per chapter), TEMPORAL 0, Sources section
  present (a back-matter chapter with ≥ 4 entries), no cross-case atoms (`[NFANTH-CW]` fenced count for anthologies; N/A
  for a non-anthology), `[NAMEGATE-1]` N/A
- fiction only: `[NAMEGATE-1] Gate scan` unknown persons 0
- front matter present (`isFrontMatter` true for at least one chapter), body ≥ 1 chapter, back matter (NF)
- a final `ACCEPTANCE: <n>/<m> criteria PASS` line and exit code 0 only when every non-N/A criterion passes.
Battery `test/accept1.acceptance.mjs` ≥ 8 (fixture projects, mocked store client and mocked gate): a clean fiction fixture
→ all PASS, exit 0; one injected departed-character action → that criterion FAIL and exit 1; simile density over 3.0 →
FAIL with the number; NF fixture without a Sources chapter → FAIL; anthology fixture with a fenced foreign atom → FAIL;
N/A lines never affect the exit code; `--json` writes the full object; the report never calls the store's write methods
(assert on the mock). Commits `ACCEPT-1-ACCEPTANCE-REPORT-HARNESS`, `ACCEPT-1-ACCEPTANCE-BATTERY`.

## VERIFY (paste raw)
```
cd ~/Downloads/UBS
git status --porcelain | grep -v '^??' | wc -l                       # 0
git log --oneline 80a54a70..HEAD                                     # DOCS-5, STOREKEY-1B, LEGACYREPAIR-2 ×2, ACCEPT-1 ×2
for i in $(seq 20); do NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" node test/storekey1.acceptance.mjs | tail -1; done | sort | uniq -c
for f in legacyrepair2 accept1 hygiene1 legacyrepair1 storekey1 runner1; do NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" node test/$f.acceptance.mjs | tail -1; done
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1           # 160 green, 0 red, 0 quarantined
npm run -s test:legacy 2>&1 | tail -2
NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" npm run -s test:narrative-connect 2>&1 | tail -2
git diff --stat 80a54a70..HEAD -- tests/researchAgentBehaviorRegression.test.mjs tests/llmProsePolisher.test.mjs   # empty
npm run build 2>&1 | tail -1
git push origin main && git push origin main:agent/narrative-connect-1
git rev-parse --short HEAD; git rev-parse --short origin/main; git rev-parse --short origin/agent/narrative-connect-1
```
Then stop and say: "FINAL-ACCEPTANCE prep VERIFY passed at <sha> — ready for the acceptance runs." Do NOT run the runner
or the harness against the live server or real projects — that is the live protocol below, driven by Cowork Claude.

## THE ACCEPTANCE RUN (live protocol — Cowork Claude + Cliff, NOT this session)
1. Create two fresh projects through the app: FICTION — 12 chapters from a new premise, invented names, a declared
   departure-and-return, a declared resolved arc, two POV characters with declared pronouns; NONFICTION — 4-chapter baited
   book in the Molasses File pattern (Cliff supplies the bait spec from project knowledge). Bibles generated in-app.
2. Headless, no human edits between stages: `node scripts/ubs-run.mjs draft --project <id>` → `polish` → `export`, then
   `node scripts/ubs-accept.mjs --project <id> --run <runId> --json accept-<id>-run1.json`. One LLM call at a time is the
   runner's own rule; expect hours per book on the local router.
3. Repeat BOTH books a second time from the same premises (new project ids). Two consecutive `ACCEPTANCE: m/m` reports per
   book = the bar. Then the DOCX open-and-read-to-the-end is Cliff's check.
4. Only then the model question (§12 last paragraph): the fiction book on a stronger instruction-follower, comparing
   `[REGENLANE] skipped` counts and simile density.
5. Evidence: `claude_UBS-LIVEPROOF-FINAL-ACCEPTANCE-<date>.md` — every report line, both runs, both books; every FAIL becomes
   a numbered finding and its own paste. Live proofs from Arcs H/I and the DATA fixes ride along in the same sessions.

## STOP conditions (plan §13, unchanged)
A DISCOVERY line disagrees; any existing battery goes red; run-all ≠ 160/0/0; the build fails; a regex that CHANGES prose;
a real title, pen name, character or place name inside code or a test (F2 removes them); any write under data/. Paste the
raw output and stop.
