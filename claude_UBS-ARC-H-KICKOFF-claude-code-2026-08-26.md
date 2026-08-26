# ARC H KICKOFF — paste into a FRESH Claude Code session in ~/Downloads/UBS
Written by Claude (Cowork) 2026-08-26 after closing Arc G (finding 52 closed live, BIBFORMAT-1):
HEAD = origin/main = origin/agent/narrative-connect-1 = `361b3076`, branch `main`, at time of writing
(plus one docs-only commit DOCS-1 on top, which tracks the claude_*.md files — verify HEAD is that commit and
that `git diff --stat 361b3076..HEAD -- . ':!claude_*.md'` is EMPTY; use 361b3076 as the code baseline everywhere below).

---

You're working in ~/Downloads/UBS on the Unity Book Studio repo. Read these FOUR files in full before
anything else — repo root, untracked on purpose, never delete or git-clean them:

1. claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md — Section 0 "Rules of the Road" governs everything.
   Follow it exactly. Do not skip, combine, or "improve adjacent code." Section 9 is Arc H — this document
   SUPERSEDES §9's line numbers and item list (re-verified live at 361b3076; several items changed shape).
2. claude_UBS-HANDOFF-2026-08-25.md — the standing rules in one page and the live-proof split (§8).
3. claude_UBS-LIVEPROOF-ARC-F-2026-08-25.md — finding 35 (b) is NAMEGATE-1's origin; the lane verifier contract.
4. claude_UBS-LIVEPROOF-ARC-G-2026-08-25.md — the BIBFORMAT-1 landing check and how the export gate is proven.

As of DOCS-1 (2026-08-26) every `claude_*.md` is TRACKED in the repo (they were untracked before so that a
GitHub-hosted session could not see them; that changed). Never modify or delete them. If you are in a clone
that has no `data/` directory, that is expected — the arcs use fixtures only. If `.claude/` or `proofreader/`
exist untracked, leave them alone. "porcelain 0" in the plan means ZERO TRACKED changes.

## Where the repo actually is (supersedes the plan's stated numbers)

Landed: PREFLIGHT-1, Arcs A–G (G closed at 361b3076 with BIBFORMAT-1). Verify before touching anything;
STOP if any line disagrees:

```
cd ~/Downloads/UBS && git fetch origin
git rev-parse --short HEAD                              # 361b3076
git rev-parse --short origin/main                       # 361b3076
git rev-parse --short origin/agent/narrative-connect-1  # 361b3076   (one ref per line)
git branch --show-current                               # main
git status --porcelain | grep -v '^??' | wc -l          # 0
ls claude_UBS-ARC-H-KICKOFF-claude-code-2026-08-26.md   # must exist (DOCS-1 landed) — STOP if not
ls test/*.acceptance.mjs | wc -l                        # 145  (144 green + 1 quarantined)
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1
   # 144 green, 0 red, 1 quarantined. Record the exact green count and checks — your baseline.
ls tests/*.mjs tests/*.js | wc -l                       # 154  (wave-era tests; see H1)
```

Battery arithmetic (rule 0.4): Arc H adds exactly THREE battery files — `test/testsweep1.acceptance.mjs`,
`test/namegate1.acceptance.mjs`, `test/hygiene1.acceptance.mjs` — and UNQUARANTINES one
(`test/routerheal2.acceptance.mjs`, green today) → baseline + 3 + 1 = **148 green, 0 red, 0 quarantined**,
148 files. Checks strictly > baseline. HYGIENE-1 renames fixtures in ~29 existing batteries: their check
counts and PASS lines must be identical before and after (prove it in VERIFY — see H6).

Wave-era baseline: `test:narrative-connect` EXIT 0 (23/23); `test:polish-pipeline` 19/20, reds exactly
`tests/researchAgentBehaviorRegression.test.mjs` and `tests/llmProsePolisher.test.mjs`, byte-for-byte unchanged
at the end (`git diff --stat 361b3076..HEAD` on them empty). `npm run build` must pass.

## DISCOVERY corrections (re-verified live 2026-08-26 at 361b3076)

- **H1 as written is DONE.** Plan §9 H1 (DEADTEST-1 on `tests/narrativeContractRegression.test.mjs:244`)
  landed in Arc A/C as DEADTEST-1…6 (`test/deadtest{1..6}.acceptance.mjs`, commits e7289660 … cbe2fb9d);
  narrative-connect is 23/23. H1 is REPLACED by TESTSWEEP-1 below — the sweep the handoff §6 asked for.
  Live inventory: `tests/` has **154** files. `package.json` wires **43** of them (test:narrative-connect 23,
  test:polish-pipeline 20). **110 are run by nothing.** I ran all 110 in the VM with a 6 s timeout
  (`NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" node tests/<f>`): **75 exit 0, 35 exit 1** —
  agentRoutingMatrix, artifactInteractionRegression, bannedVocabRecastNotDelete, beatJsonReliability(.js),
  blockbusterQualityCalibration, chapter2SafeReplaceResolutionRegression, chapter6PolishRegression,
  contentLossGuards, criticPanelExecution, digitalEquityPolishRegression, draftIntegrityReport(.js),
  e2eSmokeTest, evidenceContext(.js), exportSurfaceRepairPersistence, finalPolishEnforcementRegression,
  forensicPhraseChapterBudget, kdpKeywordValidator(.js), localLLMContext, parallelDraftPool(.js),
  polishConvergence, polishEntrypointGuard, polishPipelineIntegration, polishPipelineLiveExecution,
  polishRunnerAnthology, polishRunnerBehavioral, productionWiringGuard, projectStudioReportIntegrity,
  qualityCalibrationRerun, replayDiagnostic, serverStore, slopRegressionRevert, staleUrlResolutionRegression,
  toolsTaskTypeGuard, unityContaminationSourceRegression, verifiedChapterSave(.js). Re-derive this live;
  my exit codes are a probe, not a verdict.
- **H2 SCENEGATE-ON-1 is a LIVE protocol, not yours this session.** `SCENE_EXECUTION_ACCEPTANCE_GATE_FEATURE`
  is `src/lib/generationContext.js:55–56` (`defaultEnabled: false`), flags resolve at 125, the Setup-tab
  toggles are `src/components/notebook/SetupTab.jsx:145–148` (`SceneExecutionGates`), `test/deadgate1.acceptance.mjs`
  locks the default. Cowork Claude drafts a fresh 3-chapter fiction fixture project with the flag ON after
  VERIFY; the `defaultEnabled: true` flip (if 3/3 chapters draft with no false hard block) is a follow-up paste.
  Do NOT flip it now.
- **H3 ROUTERHEAL-2 collapses to a retirement.** ROUTERHEAL-3 moved the recovery OUT OF PROCESS
  (`vite-server-store-plugin.js:600` comment, `spawnDetachedHeal` at 630 → `scripts/ubs-heal-router.sh`, which does the
  20 s port-free loop and the 90 s serving poll itself). `ROUTERHEAL_PORT_FREE_MS` (596) and
  `ROUTERHEAL_SERVING_MS` (597) are declared and read NOWHERE (`grep -c` = the 2 declarations).
  `test/routerheal2.acceptance.mjs` was rewritten for ROUTERHEAL-3 and is **green today** (I ran it:
  `ACCEPTANCE: ALL CHECKS MATCHED`); only the `QUARANTINE` entry in `test/run-all.mjs:24–30` is stale.
- **H4 REWRITE-E2E-1 and H5 KDP-CHAIN-1 are LIVE protocols** (Cowork Claude, after VERIFY). Anchors for the
  record: `handleRewriteSelected` `src/pages/ProjectStudio.jsx:5400`, `handleRewriteAll` 5426 (plan said 5256/5282);
  `isFrontMatter` `bibliographyGenerator.js:42`, `isBackMatter` 68 (plan said 57); `buildCopyrightText`
  `src/lib/copyrightGenerator.js:14`, `saveCopyrightChapter` 73; KDP surfaces `src/components/tools/KdpCategoriesSection.jsx`,
  `src/components/publishing/PublishSettingsPanel.jsx`. No chapter in the library still points at a remote
  Base44 blob (0 of the store) — RESTORE-1 localized them all; H4 uses any pre-plan fiction project.
  Defects from H2/H4/H5 become their own follow-up pastes. Nothing for you here.
- **H6 HYGIENE-1 is far bigger than "malformedsent1".** Two real casts run through the batteries and the source:
  the fiction flagship's cast — Zinnia/Zin (nickname pair), Roderick/Rodge (pair), Lark, Sadie, Nolan (as a
  character), Quark, Krye, Missy, Spanner, Marlowe — and a second book's cast — Silas, Nell, Carrow, Bram,
  Wexcombe — plus "Dean" (the invented name from finding 35a). Live counts (`grep -w`): batteries — Zin 16
  files/59 lines, Zinnia 7/23, Rodge 13/52, Lark 12/86, Sadie 9/28, Silas 14/39, Nell 14/44, Carrow 12/32,
  Bram 11/29, Wexcombe 7/26 (29 batteries total); `src/lib` — Zin 12 files/18 lines, Silas 8/32, Sadie 7/17,
  Lark 6/16, Rodge 8/11, Zinnia 6/9, Wexcombe 3/7, Bram 2/4, Nell 3/3, Carrow 1/1 (22 files, comments and
  fixture strings). NOT in scope: `nameHygieneRules.js`'s replacement dictionary (Nolan/Reed/Dane… are generic
  English names used as DATA — leave it), Kaelen/Elias/Silas-as-KEYS in that dictionary (rule data), and the
  legacy name regexes in `legacyProseRepairs.data.js:267–339` / `manuscriptFixer.js:4901–5878`
  (`Elias|Orin|Caspian|Jonah|Silas|Lev|Ronan|Kael` — book-specific repair code; that is Arc J item 34's
  family, filed as LEGACYREPAIR-1, not yours). Marcus/Lena are pre-plan fixture names from the wave-era
  tests (the plan's own H1 text uses them) — leave them.
- **NAMEGATE-1 (finding 35b) has a live case right now.** Fiction flagship (20 chapters): 1320 proper-noun
  mentions, cast 16 (`harvestCastNames(characters_md)`), bible corpus 156,671 chars. A naive closed-world
  test (every proper noun must be in the bible) flags **74** distinct tokens — Nebula, Captain, Andromeda,
  Abilene, Hyperspace, Kevlar… all false positives. A PERSON-SIGNAL rule (name + verb from a closed list,
  `said <Name>`, `<Name>'s <body part>`, honorific + Name) minus stopwords/sentence-initial-only tokens flags
  exactly **ONE**: Ch.13 "Mr. Henderson" — **33 mentions** of a character that exists in neither the cast nor
  any bible field, and no gate ever fired. That is the precision the standing rules demand.
- Lane anchors (unchanged since 54c1eb99): detector contract `regenerateLane.js:94` (`(text) => [{ kind,
  sentence, reason }]`), `collectRegenTargets` 116/184, `regenerateFlaggedParagraphs` 434, `rescan` 458,
  verifier check (4) 299–302 (`new-proper-noun:`), (4b) 315–321 (`new-cast-name:`), `defect-remains` 333–346.
  Writer-final call site `sceneWriter.js:3150–3154` (fiction-gated block from 3114; `cast` at 3115;
  `extraDetectors` array at 3153). Runner lane `manuscriptPolishRunner.js:989` and `collectRegenTargets` 1007
  (same `extraDetectors` list, twice). `collectProperNouns` is `crossChapterDedupe.js:68` (single-sourced —
  reuse, do not re-implement). `normCW`/`createInEV`/`CLOSED_WORLD_STOPWORDS` are `closedWorldText.js:12/48/23`.
  `NAME_STOPWORDS` is `pronounLock.js:560` (NOT exported — export it, additive). Export-gate promotion pattern:
  `MALFORMEDSENT_HARD_BLOCK` (`exportSafetyGate.js:87`, use at ~728–735) and `NF_BIBLIOGRAPHY_HARD_BLOCK` (93, 544).

## Arc H (this session) = four code items, in this order. Fixtures: Mara / Dov / Ilse, Port Ellis / Dr. Hale / Dr. Vance, plus the HYGIENE-1 map below.

### H3. ROUTERHEAL-2-RETIRED
Delete the two dead constants `ROUTERHEAL_PORT_FREE_MS` / `ROUTERHEAL_SERVING_MS` (`vite-server-store-plugin.js:596–597`)
and fix the comment above them so it no longer promises in-process polling (the shell script owns it).
Nothing else in the file changes. Then remove the `routerheal2.acceptance.mjs` entry from `QUARANTINE` in
`test/run-all.mjs:24–30` — keep the map and the SKIP mechanism (empty map). Run `node test/routerheal2.acceptance.mjs`
→ `ACCEPTANCE: ALL CHECKS MATCHED`. Commits: `ROUTERHEAL-2-RETIRED-DEAD-CONSTANTS` (source), `ROUTERHEAL-2-UNQUARANTINE`
(test/run-all.mjs). After this, run-all reads `145 green, 0 red, 0 quarantined`.

### H1. TESTSWEEP-1 — every file under `tests/` is either wired or classified; none is silently dead
New `tests/run-legacy.mjs` (same shape as `test/run-all.mjs`: spawn each file, count PASS/FAIL lines, exit code,
one summary line `legacy: G green, R red, S skipped | C checks`). It owns a `CLASSIFICATION` map — every
`tests/*.mjs|*.js` NOT named in `package.json`'s two scripts appears in it EXACTLY once, with one of:
- `run` — passes today, exercises live code → the runner runs it (expected: most of the 75).
- `live-only: <reason>` — needs the Vite server, a router/LLM, ComfyUI, or the real data dir (serverStore,
  e2eSmokeTest, polishPipelineLiveExecution, coverComfyUILiveProof, localLLMContext … — verify each) → skipped
  with the reason printed.
- `regression: <one line>` — asserts behavior the codebase still intends and FAILS → skipped with the reason,
  and listed in the summary block `[TESTSWEEP-1] regression candidates: N` — DO NOT fix, DO NOT delete, DO NOT
  weaken an assertion. Those are findings for Cowork Claude.
- `deleted: <one line>` — a file you removed because it imports an export that no longer exists / tests a
  retired mechanism whose retirement is named in a commit (cite the commit) / duplicates a `test/` battery
  check-for-check. Deletions are listed in the commit body, one line each with the reason.
- `artifact-writer: <reason>` — the test WRITES into the tracked `smoke-test-output/` tree (797 tracked files;
  my probe dirtied 7 of them under `blockbuster-quality-calibration/` — restored) → skipped with the reason.
  `grep -l smoke-test-output tests/*.mjs tests/*.js` names the candidates (10 today). Whether that tree
  should be tracked at all is an Arc J question (SMOKEOUT-1), not yours.
Wire `"test:legacy": "node tests/run-legacy.mjs"` into `package.json` and append it to `test:all`. A `run`
test must leave `git status --porcelain | grep -v '^??'` EMPTY after it runs — check this for the whole
runner, not per file. Rules:
never edit a test's assertions to make it pass; `run` files that need the alias loader get it the way
`test:narrative-connect` does (`--loader ./tests/helpers/aliasLoader.mjs`); files whose NAME carries a real
book or cast (chapter6PolishRegression, digitalEquity*, unityContamination*) keep their names this arc —
name them in the classification reason; HYGIENE-1 (H6) covers `test/` and `src/lib` only.
Battery `test/testsweep1.acceptance.mjs` ≥ 7: (1) every `tests/*.{mjs,js}` on disk is either in a package.json
script or in `CLASSIFICATION` — zero orphans; (2) no file is in both; (3) no `CLASSIFICATION` key points at a
missing file; (4) every non-`run` entry carries a non-empty reason; (5) the runner's summary line format on a
fixture map; (6) `deleted` entries are absent from disk; (7) no `run` entry names a file that references `smoke-test-output`. Commits: `TESTSWEEP-1-LEGACY-RUNNER-AND-CLASSIFICATION`
(runner + package.json + deletions), `TESTSWEEP-1-ACCEPTANCE-BATTERY`. Paste the classification table
(file → class) in your final message.

### NAMEGATE-1 (carried finding 35b) — a person the bible never established is a regeneration target, then a gate entry
New `src/lib/nameGate.js` (relative imports; no React):
- `buildFictionEvidence(project, { chapters = [] } = {})` → padded `normCW` string of: `title`, `seed_concept`,
  every `project[k]` where `k` ends in `_md` (characters_md, world_md, canon_md, outline_md, voice_md, mystery_md,
  twists_md, research_md — iterate keys, don't hard-code the list), `canon_characters`, and each chapter's
  `title` + `beat_summary` + `summary` + `scene_beats_json`. Reuse `normCW`; the predicate is `createInEV(evidence)`.
- `findUnknownPersons(prose, { evidence, cast = [] })` → `[{ name, count, signals, paragraphIndex }]`. A candidate
  is a token from `collectProperNouns` that carries ≥ 1 PERSON SIGNAL: `<Name> <verb>` with the verb from an exported
  closed list `PERSON_VERBS` (said asked replied answered nodded looked turned smiled laughed shrugged whispered
  muttered grinned sighed stepped leaned frowned glanced snapped called shouted paused stared blinked swallowed
  winced hesitated added continued murmured growled breathed watched moved crossed pulled pushed reached walked
  stood sat came comes went), `(said|asked|whispered|muttered|replied|called|shouted|murmured) <Name>`,
  `<Name>’s <body part>` from `PERSON_PARTS` (hand hands face eyes voice jaw shoulder shoulders mouth chest head
  arm arms fingers lips brow gaze expression throat knuckles smile grin), or `(Mr|Mrs|Ms|Miss|Dr|Captain|Sergeant|
  Officer|Professor)\.? <Name>`. Excluded: `NAME_STOPWORDS` ∪ `CLOSED_WORLD_STOPWORDS`; any cast name (case-insensitive,
  possessive-stripped); anything `inEV` accepts (it already has the singular/plural fallback); and — precision rule —
  a token whose every occurrence in the text is sentence-initial AND which has a single signal hit ("Really looked…").
  Report per name: total mentions in the text, the signal kinds, and the FIRST paragraph index that carries a signal.
- `makeUnknownPersonDetector({ project, cast, chapters })` → a lane detector `(text) => [{ kind: 'unknown-person',
  sentence, reason: 'unknown-person:<Name>' }]` (one target per name, the sentence = the first signal sentence), built
  once per call (evidence computed once). The lane's regeneration instruction for this kind: "Remove or replace the
  character <Name>, who does not exist in this book; refer to them by role or pronoun; do not introduce any new name."
  Verifier: check (4) already rejects a new proper noun; `defect-remains` (333–346) must treat `<Name>` as the needle
  so a candidate that still contains it is rejected — confirm the rescan path (458) re-runs this detector (it re-runs
  `extraDetectors`; make sure the detector is in that list).
- Wire: append the detector to the `extraDetectors` array at `sceneWriter.js:3153` (fiction-gated block; pass the
  caller's `project`, `cast`, and the chapter list if the function has it — otherwise `chapters: []` and say so in the
  commit) and to BOTH lists in `manuscriptPolishRunner.js:989` and `1007` (fiction only — the runner's lane block is
  already gated through the projectType authority; do not add a `mode` string test). Log
  `[NAMEGATE-1] Ch.N: checked P proper noun(s), U unknown person(s)` at zero too, and one line per unknown person
  with the count.
- Export gate (`exportSafetyGate.js`, fiction only via `isFictionProject`): per chapter, `findUnknownPersons` over
  `buildFictionEvidence(project, { chapters })` → one `warnings` entry per name
  `NAMEGATE-1: "<Name>" (<count> mention(s)) is not in the bible or cast`, promoted to `hardFailures` with
  `recommendedAction: 'REJECT_REGENERATE'` only when the new exported constant `NAMEGATE_HARD_BLOCK` (nameGate.js,
  **false**) is true — the GATEPROMOTE-1 pattern, unchanged. Log `[NAMEGATE-1] Gate scan: Ch.N U unknown person(s)`
  at zero too. NF untouched (NF already has the closed world).
Battery `test/namegate1.acceptance.mjs` ≥ 12 (fixture bible with Mara/Dov/Ilse, Port Ellis): (1) established cast
member with every signal → nothing; (2) "Dr. Vance" in the bible via `_md` field only → nothing; (3) unknown person
with a dialogue tag → flagged, count right; (4) honorific form ("Mr. <Name>") → flagged; (5) unknown name that
appears ONLY sentence-initially with one signal ("Really looked") → NOT flagged; (6) sci-fi/common capitalised
nouns with no person signal (Nebula, Hyperspace, Kevlar, a ship name) → nothing; (7) a place name with a
verb-like follow ("Abilene came into view") → NOT flagged when it is in the bible, flagged when it is not and
carries a body-part possessive — document the boundary; (8) cast-name possessive stripped; (9) detector returns
one target per name at the first signal sentence; (10) `defect-remains` rejects a candidate still containing the
name and accepts one that replaced it with a role; (11) export gate: warning entry text exact, `hardFailures`
empty, then `NAMEGATE_HARD_BLOCK` true → hard entry with REJECT_REGENERATE (use the same mock pattern
nfexportbib1 uses); (12) nonfiction project → no NAMEGATE line at all; (13) zero-telemetry line on a clean
chapter. Commits: `NAMEGATE-1-UNKNOWN-PERSON-DETECTOR-AND-GATE`, `NAMEGATE-1-ACCEPTANCE-BATTERY`.

### H6. HYGIENE-1 — generic fixture names, behavior byte-identical
Rename, in `test/*.acceptance.mjs` and `src/lib/*.js` (comments and fixture strings ONLY — never a rule, a
dictionary key, or a regex that runs on prose), with `\b`-bounded whole-word replacement, possessives included:
```
Zinnia → Ottilie     Zin → Ottie        (keep the nickname pair; "Ottilie 'Ottie'")
Roderick → Ludovic   Rodge → Ludo       (pair)
Lark → Solveig       Sadie → Yusra      Nolan (as a character only) → Idris
Quark → Brisa        Krye → Vashti      Missy → Perpetua     Spanner → Tamsin     Marlowe → Quillon
Silas → Halvard      Nell → Ilka        Carrow → Thornbury   Bram → Oriel         Wexcombe → Ashby
Dean → Fenwick
```
Every replacement was checked 2026-08-26: zero hits in `src/`, `test/`, `tests/` and zero hits in any project's
characters_md/world_md/canon_md/outline_md/title across the whole library (82 projects). Before you start, re-run
that check for each target (`grep -rwl <Name> src test tests | wc -l` → 0) and STOP if any is non-zero.
Where a fixture relied on a property of the old name (length, a letter pattern, "Zin" being a prefix of "Zinnia",
an apostrophe artifact like `Zinnia ' Zin’`), keep the property: Ottie is a prefix of Ottilie, Ludo of Ludovic.
`nameHygieneRules.js` dictionary entries (keys AND values) and `legacyProseRepairs.data.js` / `manuscriptFixer.js`
regexes are OUT of scope — do not touch them. Proof of "behavior unchanged": capture
`node test/run-all.mjs > /tmp/before.txt` BEFORE H6 and `> /tmp/after.txt` after; `grep -c '^PASS' `
equal; `diff <(grep -v '^PASS\|^FAIL' /tmp/before.txt) <(…after)` limited to the H arc's own additions.
Battery `test/hygiene1.acceptance.mjs` ≥ 4: (1) none of the 21 retired names (list them in the battery as data)
occurs as a whole word in any `test/*.acceptance.mjs`; (2) none occurs in any `src/lib/*.js` outside the two
exempt files and the `nameHygieneRules.js` dictionary; (3) the 21 replacement names each occur in at least one
battery (the map really landed); (4) the exempt list is exactly the three files named here. Commits:
`HYGIENE-1-GENERIC-FIXTURE-NAMES` (batteries + src comments; body lists per-file line counts), `HYGIENE-1-ACCEPTANCE-BATTERY`.

## VERIFY (paste raw output; do not summarise)
```
cd ~/Downloads/UBS
git status --porcelain | grep -v '^??' | wc -l                       # 0
git log --oneline 361b3076..HEAD                                     # the 8 commits above, exact names
for f in routerheal2 testsweep1 namegate1 hygiene1 regenlane1 regenlane1c malformedsent1 deadgate1; do NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" node test/$f.acceptance.mjs | tail -1; done
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1           # 148 green, 0 red, 0 quarantined; checks > baseline
grep -c '^PASS' /tmp/before.txt; grep -c '^PASS' /tmp/after.txt      # H6 proof (after − before = the new batteries' checks only)
npm run -s test:legacy 2>&1 | tail -3                                 # legacy summary + regression-candidate count
NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" npm run -s test:narrative-connect 2>&1 | tail -2
git diff --stat 361b3076..HEAD -- tests/researchAgentBehaviorRegression.test.mjs tests/llmProsePolisher.test.mjs   # empty
for n in Zinnia Zin Roderick Rodge Lark Sadie Quark Krye Missy Spanner Marlowe Silas Nell Carrow Bram Wexcombe Dean; do echo "$n $(grep -rwl $n test src/lib | grep -v 'nameHygieneRules\|legacyProseRepairs\|manuscriptFixer' | wc -l)"; done   # all 0
npm run build 2>&1 | tail -1
git push origin main && git push origin main:agent/narrative-connect-1
git rev-parse --short HEAD; git rev-parse --short origin/main; git rev-parse --short origin/agent/narrative-connect-1
```

## LIVE PROOF — NOT yours. Cowork Claude runs it in Cliff's Chrome after VERIFY passes
(1) Fiction flagship offline gate → `[NAMEGATE-1] Gate scan: Ch.13 1 unknown person(s)` naming the 33-mention
character, warnings only, nothing else new; every other chapter U = 0. (2) Fix Manuscript on the flagship →
`[REGENLANE] Ch.13` with an `unknown-person:` target and either a verified rewrite or a named rejection; the
NF flagship's Fix Manuscript re-proves findings 47/48 (`[NFGUARD-1] Ch.N: kept K lane rewrite(s)`,
`new-proper-noun:` / `new-cast-name:` reasons). (3) SCENEGATE-ON-1: a fresh 3-chapter fiction fixture project
drafted with the acceptance gate ON. (4) A research run (ARCH-2 `[ARCH-2] batch b: kept K item(s), dropped D…`),
a bible generation on a fixture-style NF project (BIBLEGUARD-NAMES-1), an anthology fence run (NFANTH-CW-1).
(5) REWRITE-E2E-1 and KDP-CHAIN-1 protocols. When VERIFY passes, stop and say:
"Arc H VERIFY passed at <sha> — ready for the live proof." Do not start Arc I.

## STOP conditions (plan §13, unchanged)
A DISCOVERY line disagrees; any existing battery goes red; run-all ≠ 148/0/0; a `run`-class legacy test goes red
after your changes; the build fails; a regex that CHANGES prose; a real title, pen name, character or place name
inside code or a test (the HYGIENE-1 map is the whitelist for what leaves); weakening any assertion to make a
legacy test pass; a second LLM call in flight. Paste the raw output and stop.
