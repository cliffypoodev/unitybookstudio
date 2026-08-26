# ARC H — LIVE PROOF & LANDING EVIDENCE (Cowork Claude, 2026-08-26)
Kickoff: claude_UBS-ARC-H-KICKOFF-claude-code-2026-08-26.md. Executor: Claude Code (desktop app, local UBS folder).
Finding numbers continue from Arc G (last = 52).

## Landing check — Arc H (091092c6) — 2026-08-26 02:41–03:10 UTC
HEAD = origin/main = origin/agent/narrative-connect-1 = **091092c6**; local tree clean. Ten commits since 361b3076:
DOCS-1 (53b8ba11, docs only — now tracked so GitHub-hosted sessions can read them) · ROUTERHEAL-2-RETIRED-DEAD-CONSTANTS
(0e301ca0) · ROUTERHEAL-2-UNQUARANTINE (31ef2cae) · TESTSWEEP-1-LEGACY-RUNNER-AND-CLASSIFICATION (b0b3519d) ·
TESTSWEEP-1-ACCEPTANCE-BATTERY (e7a5c8f3) · NAMEGATE-1-UNKNOWN-PERSON-DETECTOR-AND-GATE (9f40ce63) ·
NAMEGATE-1-ACCEPTANCE-BATTERY (f9fc576f) · HYGIENE-1-GENERIC-FIXTURE-NAMES (d605541f) · HYGIENE-1-ACCEPTANCE-BATTERY
(091092c6). `git diff --stat 361b3076..HEAD`: 92 files, +4859/−670.
Batteries: **148 files, 148 green offline** (every test/*.acceptance.mjs run in the device VM, 3 parallel chunks;
routerheal2 without the alias loader) — 0 red, 0 quarantined; the two polish-pipeline reds 0-line diff vs 361b3076.
TESTSWEEP-1: tests/ 154 → 151 files (3 deleted with reasons); `tests/run-legacy.mjs` CLASSIFICATION = 110 entries:
run 66 · regression 26 · live-only 8 · artifact-writer 7 · deleted 3; `test:legacy` wired into package.json and test:all.
HYGIENE-1: the 17 retired names occur nowhere in test/ or src/lib except as the DATA list inside test/hygiene1.acceptance.mjs
and the three exempt files (nameHygieneRules.js, legacyProseRepairs.data.js, manuscriptFixer.js) — plus the two rule-data
lines in finding 53.
NAMEGATE-1: src/lib/nameGate.js (203 lines) read in full — shared normCW/createInEV/collectProperNouns, NAME_STOPWORDS now
exported from pronounLock.js, NAMEGATE_HARD_BLOCK = false, the only `.replace` is on a lookbehind slice (no prose
mutation), detector returns `mustNotContain: [name]` so defect-remains rejects a rewrite that keeps the name; wired at
sceneWriter writer-final (extraDetectors + zero-telemetry line), both runner lists, and the export gate as a warning
with the GATEPROMOTE pattern. Design matches the kickoff.

## Findings
53. **HYGIENE-1 renamed inside RULE DATA (two lines).** `anthologyRenamePass.js:38` NEUTRAL_POOL `'Marlowe'` → `'Quillon'`
    (an invented fixture surname is now a rename-pool candidate for real books) and `canonNameLock.js:156`
    `{ a: 'Nikolai', b: 'Silas' }` → `b: 'Halvard'` (silently retires that alias check). Correction paste was sent mid-run
    but not applied. Fix = **HYGIENE-1B**: restore both lines, add both files to hygiene1's exempt list (reason "rule data
    — Arc J LEGACYREPAIR-1"), exempt list = five files.
54. **NAMEGATE-1 cannot see the live case it was built for — the cast and evidence inputs leak prose into "established".**
    Live offline gate on the fiction flagship (20 ch): `[NAMEGATE-1] Gate scan: Ch.N 0 unknown person(s)` on ALL 20 —
    Ch.13 "Mr. Henderson" (33 mentions) not flagged. Two causes, both proven offline: (a) every call site passes
    `harvestCastNames(characters_md, proseBodies)` — the prose-augmented cast (24 names) includes JB, Thompson, Galactie,
    Texas, AI, Elm, **Henderson, Silas** — any fabricated name mentioned ≥ 12 times becomes "cast"; (b)
    `buildFictionEvidence(project, { chapters })` folds each chapter's beat_summary / summary / scene_beats_json into the
    evidence, and "Silas" sits in Ch.3 and Ch.18 `scene_beats_json` (the outline stage invented him) so the name reads as
    established. With sheet-only cast (`harvestCastNames(characters_md, [])`, 16 names) AND bible-only evidence
    (`chapters: []`): exactly **Ch.10 Silas (7 signal hits / 20 mentions)** and **Ch.13 Henderson (21 / 33)**, zero false
    positives. Fix = **NAMEGATE-1B**: cast = sheet-only at all three call sites; evidence = project bible fields only
    (chapter beats are downstream generated text, not the bible) — keep the `chapters` parameter but default every call
    site to `[]`; battery gains the two shapes (prose-frequent unknown name still flagged; a name present only in a
    chapter's beats still flagged).
55. Nit: the gate/warning text says "(N mention(s))" but `count` is the number of SIGNAL hits, not mentions (Henderson
    21 vs 33). Fold into NAMEGATE-1B: report both (`<mentions> mention(s), <signals> signal(s)`).
56. Data (Arc J): finding 35a's restore of the fiction flagship's Ch.10 never happened — "Silas" ×20 is still in the
    stored prose; NAMEGATE-1B will name it. Restore through the app (Write → Chapters → Ch.10 → Scenes → Restore
    Previous Version) or let the lane regenerate it in the Arc H live Fix Manuscript run.
57. Data (Arc J): the fiction flagship's offline export gate is BLOCKED on Ch.5 ("The Engine's Strange Glow",
    REJECT_MANUAL_REVIEW) at 091092c6 — pre-existing, not an Arc H change (no NAMEGATE line contributes; hard block only
    under NAMEGATE_HARD_BLOCK). Reasons to be read off in the live proof.
58. TESTSWEEP-1 surfaced **26 `regression`-class legacy tests** (e.g. agentRoutingMatrix: expects an LLM call site that
    BIBFIX-1 deliberately replaced with closed-world generation). Each needs a one-line verdict — "test is stale, retire"
    vs "real regression, file as an arc". Triage = Cowork Claude, from `node tests/run-legacy.mjs` output; not a code
    task until a real regression is confirmed.

## Pending LIVE proofs (need Cliff's Chrome + OK clicks — not overnight work)
(1) fiction flagship gate scan after NAMEGATE-1B → `Ch.10 1 unknown person(s)` + `Ch.13 1 unknown person(s)`, warnings
only; (2) Fix Manuscript on the fiction flagship → `[REGENLANE] Ch.10 / Ch.13` `unknown-person:` targets, verified
rewrite or named rejection, PROSE-GUARD letters changed only by the lane; NF flagship Fix Manuscript re-proves 47/48;
(3) SCENEGATE-ON-1: fresh 3-chapter fixture project drafted with the acceptance gate ON (then the defaultEnabled flip
as its own paste); (4) ARCH-2 research run, BIBLEGUARD-NAMES-1 bible generation, NFANTH-CW-1 anthology fence;
(5) REWRITE-E2E-1 and KDP-CHAIN-1 protocols. Arc H is CODE-CLOSED after HYGIENE-1B + NAMEGATE-1B land; it closes fully
after (1)–(2).
