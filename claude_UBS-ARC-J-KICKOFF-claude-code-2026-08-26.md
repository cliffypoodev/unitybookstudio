# ARC J KICKOFF — DATA HYGIENE — two Claude Code sessions on the local ~/Downloads/UBS folder
Written by Claude (Cowork) 2026-08-26 after verifying the Arc I landing (fb62d573, 150/150 green offline):
HEAD = origin/main = origin/agent/narrative-connect-1 = `fb62d573`, branch `main`, at time of writing.
This file and claude_UBS-LIVEPROOF-ARC-I-2026-08-26.md are NEW and untracked on the Mac — Session 1 Step 0 commits them.

---

You're working in ~/Downloads/UBS on the Unity Book Studio repo. Read these FOUR files in full first:
1. claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md — §0 "Rules of the Road" governs everything; §11 is Arc J.
   This document SUPERSEDES §11 (re-verified live at fb62d573) and adds the items every earlier arc deferred to J.
2. claude_UBS-HANDOFF-2026-08-25.md — standing rules on one page.
3. claude_UBS-LIVEPROOF-ARC-I-2026-08-26.md — findings 59–62 (the live store numbers this arc is built on).
4. claude_UBS-LIVEPROOF-ARC-H-2026-08-26.md — findings 53–58 (56/57 are DATA items handled through the app, not code).
Never modify or delete any claude_*.md, `.claude/`, or `proofreader/`. No writes under `data/` — batteries mock the store.

## Where the repo actually is
```
cd ~/Downloads/UBS && git fetch origin
git rev-parse --short HEAD                              # fb62d573
git rev-parse --short origin/main                       # fb62d573
git rev-parse --short origin/agent/narrative-connect-1  # fb62d573   (one ref per line)
git branch --show-current                               # main
git status --porcelain | grep -v '^??' | wc -l          # 0   (two new claude_*.md show as ?? until Step 0)
ls test/*.acceptance.mjs | wc -l                        # 150
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1     # 150 green, 0 red, 0 quarantined — record checks: baseline
```
Battery arithmetic (rule 0.4): **Session 1** adds FIVE battery files — `storekey1`, `reresearchconfirm1`, `urlwriteguard1`,
`tasktype1`, `versions1d` → **155 green**. **Session 2** adds THREE — `legacystages1`, `polishsafe6`, `legacyrepair1` →
**158 green**. 0 red, 0 quarantined throughout. Wave-era: `test:narrative-connect` EXIT 0; `test:polish-pipeline` reds exactly
`tests/researchAgentBehaviorRegression.test.mjs` and `tests/llmProsePolisher.test.mjs`, byte-for-byte unchanged
(`git diff --stat fb62d573..HEAD` on them empty); `test:legacy` 66 run green (a `regression`-class file that turns green
because of this arc is RE-CLASSIFIED to `run` — name it); `npm run build` passes.

## DISCOVERY (re-verified live 2026-08-26 at fb62d573)
- Store: `vite-server-store-plugin.js` `handleRequest(req, res, uid)` 210; `case 'create'` **281–296** builds
  `record = { ...data, id: data.id || generateId(), created_date, updated_date, created_by }`, `store.push(record)`,
  `cache[storeKey(uid, entity)] = store`, `flushStore(uid, entity)` — NO key lookup, so every research save appends.
  `case 'update'` 298–. Entities list 43 / 484 (`_FileStore` is one of them). Live: `_FileStore.json` 4,858 records,
  4,620 distinct keys, the NF flagship's research key stored 68×, two other projects 5× and 2×. A `_FileStore` record's
  identity is its `id` (the `local://<key>` key without the prefix); duplicates share `id`.
- Research: `handleResearch` is `src/pages/ProjectStudio.jsx:3079`; the Foundation tab passes it as `onReResearch`
  (5841 / 5867 → `FoundationTab.jsx:50/125` → `ResearchSection.jsx:30`). `research_data` is a JSON STRING on the project
  (NF flagship 47,967 chars; `research_md` 96,804). The page already uses `window.confirm` for other destructive actions
  (1839, 3206, 4202, 5392) — same pattern.
- Chapter writes: 1,579 chapters in the store — 1,421 carry inline `content_md`, 158 carry `content_md_url` = `local://…`
  (ALL resolve to a `_FileStore` record), 0 remote (`http…`), 0 unresolvable. The Base44-era corruption shape is
  `content_md` EMPTY + `content_md_url` set to something that does NOT resolve locally (a remote URL, or a `local://` key
  with no record). `local://` + resolvable is the NORMAL shape and must keep working. Prose save path:
  `src/lib/chapterStorage.js` (`previous_content_md_url` recorded at 452/470/475/492; VERSIONS-1 notes at 784/803).
- task_type: `toolsTaskTypeGuard.test.mjs` (legacy, `regression` class) finds `task_type: 'chat'` at
  `src/components/FloatingBrainstorm.jsx:285` (comment: "CHATFIX-1: routes to the ideas_chat agent") and
  `src/components/notebook/IdeasChatbot.jsx:253`, and `'evaluate'` / `'fix'` at `src/lib/sceneExecutionAcceptanceRunners.js:132/216`.
  DISCOVER where the valid set actually lives (the legacy test carries its own `VALID_TASK_TYPES`; grep `task_type` in
  `src/lib/llmRouter*.js` / `src/lib/tools*.js` / the model-settings resolver) and what an unknown value does at runtime.
- Polish runner stages (`src/lib/manuscriptPolishRunner.js`, `verifyInvariant('<name>')` anchors): `Nonfiction Core` 524,
  `Anti-Detection Polish` 686, `Pre-Quote Artifact Repair` 723, `Final Artifact Cleanup` 749; STRUCTURE-GUARD revert log
  204 (`count reduced … -> …`), PROSE-GUARD log 197 (`letters changed`); NFGUARD-1 snapshot 511, revert 1403–1456.
  Finding 34 (Arc F live): the two legacy artifact stages attempt paragraph deletion on 13/20 chapters EVERY run and the
  guard reverts each one — wasted work plus a REVERTED line per chapter. Finding 43 (Arc G live): "Nonfiction Core" and
  "Anti-Detection Polish" still change LETTERS in NF mode (NFGUARD-1 reverts them; NF is typography-only by policy).
- Legacy name regexes: `src/lib/legacyProseRepairs.data.js:267–339` and `src/lib/manuscriptFixer.js:4901–5878` carry
  hard-coded character-name alternations (`Elias|Orin|Caspian|Jonah|Silas|Lev|Ronan|Kael`, possessive forms) inside
  prose-repair patterns — book-specific code (rule 0.2: only generalized fixes). HYGIENE-1 exempted them on purpose.
- VERSIONS nits (Arc G findings 46/51): the Bibliography save path (`bibliographyGenerator.js` `saveBibliographyChapter`
  533) records NO `previous_content_md_url` (verified 2026-08-26: the rebuilt Ch.21 has an empty one); a no-op Ch.1 save
  mints a new version; `[PROSE-GUARD]` lines are logged twice per stage.
- NOT in this arc (Cowork Claude first): SMOKEOUT-1 (`smoke-test-output/` = 797 tracked files, 16 MB, 6 legacy tests read
  fixtures from it) and TESTSWEEP-2 (the other 25 `regression`-class legacy tests) wait for my triage; the DATA fixes
  (NF flagship Ch.8/9/11 quote marks + unterminated paragraph; fiction flagship Ch.5 gate block and Ch.10 "Silas"
  restore) go through the app in the live session. I3 SPEED-1 is live router work.

## SESSION 1 — store + guards (fixtures only; the store is exercised through `handleRequest` with a temp DATA_DIR)
**Step 0 — DOCS-3**: `git add claude_UBS-LIVEPROOF-ARC-I-2026-08-26.md claude_UBS-ARC-J-KICKOFF-claude-code-2026-08-26.md`,
commit `DOCS-3: Arc I evidence and Arc J kickoff`. Nothing else in it.

### J1. STOREKEY-1 — `_FileStore` create is an upsert by id
In `case 'create'` (281–296), for `entity === '_FileStore'` only: if a record with the same `id` exists, REPLACE it in
place (keep `created_date`, set `updated_date = now`, keep array position) and respond 200 with the merged record; every
other entity keeps today's append. Add a one-time dedupe on load: when a `_FileStore` store is first read into the cache
and contains duplicate ids, keep the LAST occurrence per id, log `[STOREKEY-1] <uid>: collapsed N duplicate _FileStore
record(s) across K key(s)`, and flush — never on any other entity. Battery `test/storekey1.acceptance.mjs` ≥ 6 (temp
DATA_DIR, real `handleRequest` via a mock req/res): second create with the same id does not add a record; the survivor
is the newer body; `created_date` preserved; other entities still append; load-time dedupe collapses a seeded 3× key to 1
and logs the count; a store with no duplicates is not rewritten (mtime unchanged). Commits: `STOREKEY-1-FILESTORE-UPSERT`,
`STOREKEY-1-ACCEPTANCE-BATTERY`.

### J2. RERESEARCH-CONFIRM-1 — a confirm that names the size
In `handleResearch` (ProjectStudio.jsx:3079): when the project already has research — `research_data` parsed length or
`research_md` length ≥ `RERESEARCH_CONFIRM_MIN_CHARS` (new exported const in `src/lib/researchStorage.js`, **2000**) —
show `window.confirm` with the exact size: `Re-run research? This project already holds <N> characters of research
(<K> timeline entries, <E> key events). Re-Research REPLACES it. The current research is snapshotted first.` — and snapshot
the current `research_data`/`research_md` into `_FileStore` under `<projectId>/research/pre-reresearch-<timestamp>`
through the app's normal save path BEFORE the pipeline starts. Cancel = nothing runs, log
`[RERESEARCH-CONFIRM-1] cancelled (N chars)`. The pure part (`describeResearchSize(project) → { chars, timeline, events,
needsConfirm }`) lives in researchStorage.js so the battery tests it without React. Battery `reresearchconfirm1` ≥ 5
(below threshold → no confirm; at threshold → confirm text carries the numbers; malformed `research_data` JSON → falls
back to char count, never throws; snapshot key shape; cancel path logs and does not call the pipeline — mock it).
Commits: `RERESEARCH-CONFIRM-1-SIZE-NAMED-CONFIRM`, `RERESEARCH-CONFIRM-1-ACCEPTANCE-BATTERY`.

### J3. URLWRITE-GUARD-1 — the store refuses the corruption shape
In the store's `create` and `update` for `entity === 'Chapter'`: reject (HTTP 422, `{ error: 'URLWRITE-GUARD-1: …' }`,
log `[URLWRITE-GUARD-1] Ch.<n> of <projectId> rejected: content_md empty while content_md_url=<url> does not resolve`)
when the incoming record's `content_md` is empty/absent AND `content_md_url` is set AND the URL is NOT a `local://` key
that resolves to an existing `_FileStore` record for that uid. `local://` + resolvable → accepted unchanged (158 live
chapters have this shape); inline `content_md` → accepted; both empty → accepted (a new empty chapter is legal). Never
mutate the record. Battery `urlwriteguard1` ≥ 6 (remote URL + empty body → 422; local:// unresolvable → 422; local://
resolvable → 200 unchanged; inline body → 200; both empty → 200; other entities untouched by the guard).
Commits: `URLWRITE-GUARD-1-REJECT-EMPTY-BODY-WITH-DEAD-URL`, `URLWRITE-GUARD-1-ACCEPTANCE-BATTERY`.

### J4. TASKTYPE-1 (finding 60) — no `task_type` outside the valid set
DISCOVER the runtime valid set and the fall-through behaviour. Then EITHER add the missing values to the set with a
routing entry each (`'chat'` → the ideas/chat agent that CHATFIX-1 intended; `'evaluate'`/`'fix'` → the scene-acceptance
agents) OR change the four call sites to an existing valid value — whichever the code's own routing table says is right;
say which in the commit. Add a build-time guard: `scripts/`-free — a battery `tasktype1` ≥ 4 that greps every
`task_type:` literal under `src/` (same scan as the legacy test, made ours) and asserts membership in the exported set;
plus the routing entries resolve to a real agent config. Then re-classify `toolsTaskTypeGuard.test.mjs` from
`regression` to `run` in `tests/run-legacy.mjs` if it goes green. Commits: `TASKTYPE-1-VALID-SET-AND-ROUTING`,
`TASKTYPE-1-ACCEPTANCE-BATTERY`.

### J5. VERSIONS-1D (findings 46/51) — three nits
(a) `saveBibliographyChapter` records `previous_content_md_url` exactly the way chapterStorage.js does for a prose save
(reuse its helper — do not re-implement); (b) a save whose body is byte-identical to the stored body does NOT mint a
version (log `[VERSIONS-1D] Ch.N: unchanged, no version minted`); (c) the `[PROSE-GUARD]` line is logged once per stage.
Battery `versions1d` ≥ 4 (bibliography save has a previous URL; identical re-save → same version list; changed save →
one new version; one PROSE-GUARD line per stage on a fixture run). Commits: `VERSIONS-1D-BIBLIOGRAPHY-PREVIOUS-AND-NOOP-SAVE`,
`VERSIONS-1D-ACCEPTANCE-BATTERY`.

VERIFY (Session 1) — paste raw:
```
cd ~/Downloads/UBS
git status --porcelain | grep -v '^??' | wc -l                       # 0
git log --oneline fb62d573..HEAD                                     # DOCS-3 + the 10 commits above, exact names
for f in storekey1 reresearchconfirm1 urlwriteguard1 tasktype1 versions1d bibformat1 nfexportbib1; do NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" node test/$f.acceptance.mjs | tail -1; done
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1           # 155 green, 0 red, 0 quarantined; checks > baseline
npm run -s test:legacy 2>&1 | tail -2
NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" npm run -s test:narrative-connect 2>&1 | tail -2
git diff --stat fb62d573..HEAD -- tests/researchAgentBehaviorRegression.test.mjs tests/llmProsePolisher.test.mjs   # empty
npm run build 2>&1 | tail -1
git push origin main && git push origin main:agent/narrative-connect-1
git rev-parse --short HEAD; git rev-parse --short origin/main; git rev-parse --short origin/agent/narrative-connect-1
```
Then stop and say: "Arc J Session 1 VERIFY passed at <sha>." Do not start Session 2 in the same session.

## SESSION 2 — polish-runner retirements (fresh session; baseline = Session 1's SHA, 155 files)
### J6. LEGACYSTAGES-1 (finding 34) — `Pre-Quote Artifact Repair` and `Final Artifact Cleanup` become flag-only
Neither stage may DELETE a paragraph any more: where each would remove a paragraph, it instead records
`{ chapter, paragraphIndex, reason }` in the run report and logs `[LEGACYSTAGES-1] Ch.N: would have deleted paragraph P
(<reason>) — flagged, not removed`; every other edit those stages make (typography, artifact strings inside a paragraph)
is unchanged. Result on a Fix Manuscript run: zero `[STRUCTURE-GUARD] … REVERTED` lines from these two stages. Battery
`legacystages1` ≥ 5 (a fixture that previously lost a paragraph keeps it; the flag record is present with the reason;
in-paragraph artifact repair still happens; paragraph count invariant holds without the guard's help; both stage names
unchanged in the stage list). Commits: `LEGACYSTAGES-1-FLAG-ONLY-PARAGRAPH-DELETES`, `LEGACYSTAGES-1-ACCEPTANCE-BATTERY`.

### J7. POLISHSAFE-6 (finding 43) — NF mode is typography-only at the STAGE, not just at the guard
`Nonfiction Core` (524) and `Anti-Detection Polish` (686): when `isNonfictionProject(project)` (the authority — no `mode`
string test), each stage runs ONLY its typography sub-steps (quote/dash/ellipsis normalisation, whitespace) and skips every
sub-step that can change a letter; log `[POLISHSAFE-6] <stage> Ch.N: typography-only (NF)`. Fiction path byte-identical.
Result: NFGUARD-1 has nothing to revert from these two stages on an NF run (`[NFGUARD-1] … REVERTED` count from them = 0).
Battery `polishsafe6` ≥ 5 (NF fixture: letters unchanged after each stage, typography still normalised; fiction fixture:
output identical to today's — embed the pre-change output as the expectation; the log line; the authority is called, not a
string compare). Commits: `POLISHSAFE-6-NF-STAGES-TYPOGRAPHY-ONLY`, `POLISHSAFE-6-ACCEPTANCE-BATTERY`.

### J8. LEGACYREPAIR-1 — book-specific name regexes become generic
In `legacyProseRepairs.data.js:267–339` and `manuscriptFixer.js:4901–5878`, every alternation that lists character NAMES
(`Elias|Orin|Caspian|Jonah|Silas|Lev|Ronan|Kael`, their possessives) is replaced by the pattern's generic subject class:
`(He|She|They|<CapitalisedName>)` where `<CapitalisedName>` is `[A-Z][a-z]+` bounded the same way the existing cast-name
check in `crossChapterDedupe.js` `collectProperNouns` is. The repaired PHRASE stays identical; only the subject list is
generalised. Prove behaviour on the named cases is unchanged (fixture sentences using invented names Mara/Dov/Ilse hit the
same repairs) and that no real name remains (grep of the eight names in those two files → 0). This is the one place the
HYGIENE-1 exemption is lifted — update `test/hygiene1.acceptance.mjs`'s exempt list to THREE files
(nameHygieneRules.js, anthologyRenamePass.js, canonNameLock.js) and name it. Battery `legacyrepair1` ≥ 4. Commits:
`LEGACYREPAIR-1-GENERIC-SUBJECT-CLASSES`, `LEGACYREPAIR-1-ACCEPTANCE-BATTERY`.

VERIFY (Session 2) — same block as Session 1 with the baseline SHA = Session 1's landing, the battery list
`legacystages1 polishsafe6 legacyrepair1 hygiene1 polishsafe4 regenlane1 malformedsent1`, and run-all = **158 green, 0 red,
0 quarantined**. Then stop and say: "Arc J Session 2 VERIFY passed at <sha> — ready for the live proof." Do not start
FINAL-ACCEPTANCE.

## STOP conditions (plan §13, unchanged)
A DISCOVERY line disagrees; any existing battery goes red; run-all ≠ 155/0/0 (S1) or 158/0/0 (S2); the build fails; a regex
that CHANGES prose beyond the phrase the existing repair already changed; a real title, pen name, character or place name
inside code or a test (J8 REMOVES names — it never adds one); a second LLM call in flight; any write under `data/`
outside a temp DATA_DIR the battery creates and removes. Paste the raw output and stop.
