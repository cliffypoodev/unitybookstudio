# UBS — MASTER FIX PLAN FOR CLAUDE CODE (Sonnet 5, terminal)
# Base: cliffypoodev/unitybookstudio @ `2cfa197` (main = agent/narrative-connect-1). Written 2026-08-24.
# Every anchor below was read from a fresh clone at that SHA. If your tip is not 2cfa197, STOP and report.

This document turns the ten issue classes in `claude_UBS-issue-breakdown-2026-08-24.md` into a
sequence of arcs you can execute one at a time. Each arc is self-contained: goal, proof of the
problem, files, discovery anchors, the change, a battery that locks it, commit names, a VERIFY
block with expected output, live proof, and stop conditions. Do the arcs in order. Do not skip.
Do not combine. Do not "improve" adjacent code while you are in a file.

---

## 0. RULES OF THE ROAD (read every time you start)

### 0.1 Where and how you work
- Repo on the Mac: `~/Downloads/UBS`. Branch: `main`. After every arc's VERIFY passes, mirror:
  `git push origin main && git push origin main:agent/narrative-connect-1`. NEVER `--force`.
  NEVER rebase published history. The two branches must never diverge again.
- Dev server: `localhost:5180` (`npm run dev`). The store API lives in `vite-server-store-plugin.js`
  and is session-gated (`PROTECTED_PREFIXES = ['/api/store/', '/api/routerheal', '/llama', '/search-bridge']`).
  Server-side changes require a dev-server RESTART (kill by PID: `lsof -t -nP -i :5180 | xargs kill`),
  not a browser refresh. Cliff hard-refreshes (Cmd+Shift+R) before every live run. Served-code
  checks use STRING LITERALS only (`curl -s localhost:5180/src/lib/<file>.js | grep -c '<literal>'`)
  because Vite strips comments.
- Two test systems. Both must be green at the end of every arc:
  1. Acceptance batteries: `unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1`
     Baseline at 2cfa197: `batteries: 110 green, 0 red, 1 quarantined   |   2901 checks passed`
     (measured in an installed `node_modules` tree; a bare worktree shows false reds).
     `run-all.mjs` spawns each `test/*.acceptance.mjs` with bare Node (`spawnSync(process.execPath, [file])`)
     and counts `^PASS ` lines. A battery that exits 0 with no PASS lines is a RED (silent pass).
  2. Wave-era tests: `NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" npm run test:narrative-connect`
     and `... npm run test:polish-pipeline` (the latter ends with `npm run build`).
     KNOWN at 2cfa197 (sandbox): `tests/narrativeContractRegression.test.mjs:244` is RED
     ("runtime ledger blocks possession violation for transferred object" — `audit.ok` is `true`,
     expected `false`). PREFLIGHT-1 owns this.
- Battery conventions (copy exactly): file `test/<arc-lowercase>.acceptance.mjs`; imports are
  RELATIVE (`../src/lib/x.js`), never `@/`; a `check(name, pass, detail)` helper printing
  `PASS `/`FAIL `; numbered check names; final line `ACCEPTANCE: ALL CHECKS MATCHED` or
  `ACCEPTANCE: N CHECK(S) DID NOT MATCH`; `process.exit(failures === 0 ? 0 : 1)`. Model
  `test/malformedsent1.acceptance.mjs`. Any NEW module a battery imports must itself use
  relative imports (bare Node cannot resolve `@/`). Existing modules that import `@/…` can only
  be exercised through the alias loader — write source-shape checks for those (read the file,
  assert the wiring string exists), the way `malformedsent1` checks `exportSafetyGate.js`.
- Every module you add exports a `<NAME>_VERSION = '<name>-v1'` string, and its battery checks it.

### 0.2 Non-negotiable engineering rules (each has a battery somewhere; you are adding more)
1. ONE LLM CALL AT A TIME. `for` loops only. No `Promise.all`, no `allSettled`, no parallel
   `fetch` against `:8080` anywhere. Every new LLM loop takes an injectable `callLLM` (see
   `healSimileDensity` in `src/lib/simileRecast.js` lines 147–186 for the exact pattern:
   `const { callLLM = null, … } = opts; const callOne = callLLM || (async (userPrompt, systemPrompt, maxTokens) => { const agent = await getCallAgent(); … })`),
   a per-call timeout via `Promise.race`, and fails OPEN unless the arc says otherwise.
2. CORRECTION IS REGENERATE-OR-FLAG. Detection may be regex. Correction of prose is either
   (a) an LLM rewrite of a bounded unit accepted only by a deterministic verifier, or (b) a flag.
   The ONLY deterministic prose mutations allowed anywhere: typography (smart quotes, apostrophes,
   whitespace, dashes, double spaces), a/an agreement (`fixIndefiniteArticles`), missing dialogue
   opener insertion (DIALOGREPAIR-2), canonical name spelling (CANON-2B), and explicit structural
   removals reported through `verifyInvariant(stage, allowedRemovals)`. Nothing else may delete,
   insert, or substitute words.
3. CLASSIFICATION HAS ONE AUTHORITY: `isNonfictionProject` / `isFictionProject` /
   `explainProjectType` in `src/lib/projectType.js`. No new `book_type === …` anywhere.
4. NO BOOK-SPECIFIC STRINGS IN CODE OR TESTS. Fixtures use invented generic names. (Existing
   batteries that use real book character names are a hygiene item — HYGIENE-1 — not yours to
   touch in an unrelated arc.)
5. BATTERIES LOCK BEHAVIOR. You may change an existing battery's expectation ONLY when the arc
   you are executing explicitly retires that behavior; name every such change in the commit
   message. A red you did not intend = STOP and report. Never re-aim an assertion to make it pass.
6. Nothing named `hermes` is touched. Nothing under `base44/` is touched unless the arc says so.
7. One arc per session unless Cliff says otherwise. One commit per change, one commit per battery,
   commit names exactly as written here.
8. Book-specific defects are DATA fixes (project records, bible fields, beat summaries) made
   through the app's real save path, never in code.
9. Do not claim success. Paste the raw output of the VERIFY block and stop.

### 0.3 Discovery discipline
Before editing, run the DISCOVERY greps in the arc. Every anchor must match EXACTLY the count
stated. If it does not, STOP and report the actual grep output — do not search for "something
similar." Anchors below were copied verbatim from 2cfa197.

### 0.4 Definition of done, per arc
- New battery green; full `run-all` green with green count = previous + number of new batteries,
  checks strictly greater; quarantined stays 1 (until ROUTERHEAL-2).
- `tests/` scripts no worse than before the arc (PREFLIGHT-1 records the baseline).
- `npm run build` passes.
- Served-code string check confirmed by Cliff after hard refresh (when a served file changed).
- Live proof performed where the arc specifies one, with the console tags named.

---

## 1. PREFLIGHT-1 — establish ground truth on the Mac

DISCOVERY / VERIFY (run exactly, paste raw):
```
cd ~/Downloads/UBS
git fetch origin && git status --porcelain | wc -l
git rev-parse --short HEAD && git rev-parse --short origin/main && git rev-parse --short origin/agent/narrative-connect-1
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1
NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" npm run -s test:narrative-connect 2>&1 | grep -E "AssertionError|Error \[|ok|passed" | tail -5
ls data/ | head; ls data/users 2>/dev/null | head
```
Expected: porcelain 0; all three SHAs `2cfa197`; `batteries: 110 green, 0 red, 1 quarantined | 2901 checks passed`.

Then:
1. Take a data snapshot before anything else: `mkdir -p data/recovery-backups/pre-fixplan-$(date +%Y%m%dT%H%M%S) && cp -R data/users data/_FileStore* data/recovery-backups/pre-fixplan-*/ 2>/dev/null`. Report the folder.
2. Record the `tests/` result. If `narrativeContractRegression.test.mjs` is red on the Mac too,
   open `DEADTEST-1` (Arc H) immediately after Arc A — a continuity gate that silently stopped
   raising `OBJECT_POSSESSION_VIOLATION` is the DEADGATE class. Do not "fix" it in preflight.
3. Add `"test:all": "node test/run-all.mjs && NODE_OPTIONS=--loader ./tests/helpers/aliasLoader.mjs npm run test:narrative-connect && NODE_OPTIONS=--loader ./tests/helpers/aliasLoader.mjs npm run test:polish-pipeline"`
   to `package.json` scripts. Commit: `PREFLIGHT-1-TEST-ALL-SCRIPT`. (Note `test:polish-pipeline`
   ends with `npm run build`; that is intended.)

STOP if the tip is not 2cfa197 or the battery line differs.

---

## 2. ARC A — CLOSE THE PROVEN FABRICATION HOLE
### A1. NFCLASS-2 — formats are not types
GOAL: `project_type = 'anthology'` (or any non-type value) must never count as a type declaration.
PROOF (run against live code, reproduce first):
```
cat > /tmp/probe_nfclass.mjs << 'EOF'
import { isNonfictionProject, explainProjectType } from './src/lib/projectType.js';
const S = {
  S1_series_anthology_volume_of_NF_series: { book_type: 'fiction', project_type: 'anthology', genre: 'True Crime' },
  S2_empty_booktype_anthology_nf_genre:    { book_type: '', project_type: 'anthology', genre: 'true crime' },
  S3_declared_nonfiction:                  { book_type: 'nonfiction', project_type: 'anthology', genre: 'True Crime' },
  S4_historical_fiction_novel:             { book_type: 'fiction', genre: 'Historical Fiction' },
};
for (const [k, p] of Object.entries(S)) console.log(k.padEnd(44), isNonfictionProject(p), JSON.stringify(explainProjectType(p)));
EOF
cd ~/Downloads/UBS && node /tmp/probe_nfclass.mjs
```
At 2cfa197 this prints S1 `false`, S2 `false` (basis "declared", detail `"anthology"`). S2 is the bug
this commit fixes. S1 is fixed by A2.

FILE: `src/lib/projectType.js` (102 lines).
DISCOVERY: `grep -c "if (declared) return declared === 'nonfiction';" src/lib/projectType.js` → `1`.
`grep -c "const declared = String(project?.book_type || project?.project_type || '').toLowerCase().trim();" src/lib/projectType.js` → `2` (once in `isNonfictionProject`, once in `explainProjectType`).
CHANGE: add `export const TYPE_DECLARATIONS = Object.freeze(['fiction', 'nonfiction']);` and a
helper `declaredType(project)` that returns the FIRST of `book_type`, `project_type` whose
lower-cased value is in `TYPE_DECLARATIONS`, else `''`. Both functions use it. Result:
`{project_type:'anthology', genre:'true crime'}` → nonfiction by genre inference (basis
`'genre-inference'`, detail must name the ignored format value, e.g. `nothing declared (ignored format "anthology"); genre = "true crime"`).
Legacy records with `book_type:'anthology'` heal at read time — no migration.
COMMIT: `NFCLASS-2-FORMATS-ARE-NOT-TYPES`.

### A2. SERIESHYGIENE-1 — an anthology volume carries the series' real type
FILE: `src/pages/SeriesManager.jsx`.
DISCOVERY: `grep -n "projectPayload.book_type = 'fiction';" src/pages/SeriesManager.jsx` → exactly 1 hit (~line 832, inside `if (selectedFlavor === 'anthology_volume') {` under the `WAVE2-ENUMFIX` comment).
CHANGE: replace the hardcoded `'fiction'` with the previous volume's real type:
`const inheritedType = declaredTypeOf(lastVolume); if (inheritedType) projectPayload.book_type = inheritedType; else delete projectPayload.book_type;`
where `declaredTypeOf` returns `'fiction'|'nonfiction'|''` using the same `TYPE_DECLARATIONS`
rule (import `declaredType` from `@/lib/projectType`). Keep `projectPayload.project_type = 'anthology'`.
If no previous volume exists, leave `book_type` unset so genre inference applies (A1) and the
Setup tab asks. Also: in the SAME branch, if `lastVolume` classifies nonfiction, do NOT inject
the fiction-only series voice/world blocks (`voice_md`/`world_md`/`canon_md` from the series bible)
without the `Series …:` prefix already present — leave those lines as they are; only the type changes.
COMMIT: `SERIESHYGIENE-1-ANTHOLOGY-VOLUME-CARRIES-REAL-BOOK-TYPE`.

### A3. NFCLASS-6 — one authority everywhere
DISCOVERY: `grep -rn "book_type === 'nonfiction'\|book_type !== 'nonfiction'\|project_type === 'nonfiction'" src/lib src/pages src/components --include=*.js --include=*.jsx | grep -v projectType.js | wc -l` → `39` at 2cfa197.
Files at 2cfa197: `src/lib/qualityScan.js, postClean.js, vocabCaps.js, sceneWriter.js, povTense.js, postDraftCleanup.js, autonovel.js, genreTaxonomy.js, src/pages/ProjectStudio.jsx, src/components/novel/ProjectSettingsFields.jsx, src/components/notebook/FoundationTab.jsx`.
CHANGE: every BEHAVIOR decision uses `isNonfictionProject(project)` (import from `@/lib/projectType`
in app code; `./projectType.js` relative in any module a battery imports — `vocabCaps.js` line 80
`const isNF = options?.project?.book_type === 'nonfiction';` becomes `const isNF = isNonfictionProject(options?.project);`).
Pure UI rendering of the selected enum (a radio/select `checked`/`value` comparison in
`ProjectSettingsFields.jsx` / `FoundationTab.jsx`) may keep the literal — list each kept
occurrence in `test/fixtures/nfclass6-ui-allowlist.json` as `{ "file": "...", "line": N, "reason": "..." }`.
COMMIT: `NFCLASS-6-ONE-AUTHORITY-EVERYWHERE`.

### A4. Batteries
`test/nfclass2.acceptance.mjs` (≥ 15 checks): S1–S4 above (S1 asserted through A2's
`declaredTypeOf` on a fake lastVolume, S2 nonfiction by genre, S3 nonfiction declared, S4 fiction),
the NFCLASS-1 eight-books regression (declared fiction + "Historical Fiction" stays fiction),
`explainProjectType` names the ignored format value, erotica/romance genres stay fiction,
`TYPE_DECLARATIONS` exported, version string. Downstream: `buildAnthologyChapterVarietyBlock`
(`src/lib/anthologyVarietyGuard.js`) returns `''` for S2; the RENAMEPASS gate in `sceneWriter.js`
stays `isAnthology && !isNF` (source-shape check).
`test/serieshygiene1.acceptance.mjs` (≥ 6 checks, source-shape): SeriesManager no longer contains
`projectPayload.book_type = 'fiction'`; contains `declaredTypeOf(lastVolume)`; `TYPE_DECLARATIONS`
imported; fixture: nonfiction previous volume → `'nonfiction'`, fiction previous → `'fiction'`, none → unset.
`test/nfclass6.acceptance.mjs` (≥ 4 checks): grep count in `src/lib` outside `projectType.js` is `0`;
remaining `src/pages`+`src/components` occurrences equal the allowlist EXACTLY (set equality on
file+line after reading the files — recompute, do not hardcode line numbers); `vocabCaps.js` imports
`./projectType.js`.
COMMITS: `NFCLASS-2-ACCEPTANCE-BATTERY`, `SERIESHYGIENE-1-ACCEPTANCE-BATTERY`, `NFCLASS-6-ACCEPTANCE-BATTERY`.

VERIFY:
```
cd ~/Downloads/UBS && git log --oneline -6
node /tmp/probe_nfclass.mjs            # S1 false (a record that DECLARES fiction stays fiction — A2 stops SeriesManager writing it for NF series); S2 true (basis genre-inference, detail names ignored format "anthology"); S3 true; S4 false
node test/nfclass2.acceptance.mjs | tail -1; node test/serieshygiene1.acceptance.mjs | tail -1; node test/nfclass6.acceptance.mjs | tail -1
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1     # expect: 113 green, 0 red, 1 quarantined | > 2901 checks
npm run build 2>&1 | tail -1
```
LIVE PROOF (Cliff, after hard refresh): Series Manager → New Volume → Anthology Volume on a
nonfiction series → open the new project → console `explainProjectType` via the Setup badge (or
`window` probe) shows `nonfiction`. Then, and only then, Hollywood Unhinged Vol. 2 may be created.
STOP if grep counts differ from the DISCOVERY numbers.

---

## 3. ARC B — REGENLANE-1: the block-and-regenerate lane (the keystone)
GOAL: every flagged prose unit gets ONE chance to be REGENERATED by the model under a
deterministic verifier; otherwise it stays flagged. Nothing is ever regex-edited.
EVIDENCE: `MALFORMEDSENT-1` flags 78 sentences in REDUX that nothing can fix (root-cause trace
2026-08-15; pipeline-hardening LANDED 2026-08-16 §"Still NOT built").

### B1. Module `src/lib/regenerateLane.js` (relative imports only)
Exports:
- `REGENLANE_VERSION = 'regen-lane-v1'`
- `collectRegenTargets(text, { cast = [], departed = [], priorProse = [], extraDetectors = [], maxUnits = 12 })`
  → `[{ kind, sentence, paragraphIndex, paragraph, reason }]`. Built-in detectors:
  `scanMalformedSentences(text, cast)` from `./malformedSentence.js` (kinds `dropped-subject`,
  `agreement`, `bare-verb`, `name-echo`); `scanDuplicateIntroductions(text, cast)` from
  `./introGuard.js` (kind `duplicate-introduction`, every self-intro after the first);
  `departed` names that act in a sentence (kind `departed-active`; a sentence whose leading
  cast name is in `departed`); `extraDetectors` = `[(text) => targets]` for later arcs
  (banned vocabulary, template families, fragments, arc restarts). Paragraph = `\n\n`-delimited
  block; one target per paragraph (first hit wins); cap `maxUnits`.
- `verifyRegeneratedParagraph(original, candidate, { kind, cast, priorProse, departed, rescan })`
  → `{ ok, reason }`, ALL of: (1) candidate contains no `\n\n` (exactly one paragraph);
  (2) `0.6 ≤ len(candidate)/len(original) ≤ 1.6`; (3) smart-quote imbalance of candidate ≤ that
  of original (count `“` vs `”`); (4) proper-noun set of candidate ⊆ proper-noun set of original
  ∪ cast (proper noun = capitalized token not at sentence start, minus a small stoplist — this
  rule already exists inside `verifyRecastSentence` in `./crossChapterDedupe.js` (line 76;
  the `chapterCaps` set and the `new-proper-noun:<tok>` reason), which `verifySimileRecast` calls.
  Extract it into an exported `collectProperNouns(text)` in `crossChapterDedupe.js` and make
  `verifyRecastSentence` use the helper in the same commit — do not duplicate the rule); (5)
  `rescan(candidate)` returns 0 targets of ANY kind (not just the flagged kind);
  (6) no 12+-word sentence of candidate normalizes equal to any sentence in `priorProse`
  (use `splitSentencesForDedupe` + `normalizeSentenceForDedupe` from `./crossChapterDedupe.js`);
  (7) `measureSimileDensity`-style simile count of candidate ≤ original's (reuse `SIMILE_RX`
  from `./simileRecast.js`); (8) no `departed` name appears in candidate unless it appeared in
  original; (9) candidate is not identical to original.
- `regenerateFlaggedParagraphs(text, opts)` with
  `{ callLLM = null, project = null, cast = [], departed = [], priorProse = [], stateFacts = '', extraDetectors = [], maxUnits = 12, timeoutMs = 90000, label = 'text', onProgress }`
  → `{ text, regenerated, skipped: [{kind, sentence, reason}], targets }`.
  SEQUENTIAL loop over targets (same skeleton as `healSimileDensity`). Prompt (system):
  "You are line-editing ONE paragraph of a novel chapter. Rewrite the paragraph to fix exactly the
  defect named. Keep every event, name, object and fact. Keep dialogue quoted as it is unless the
  defect is inside it. Keep tense and point of view. Return exactly one paragraph, no commentary."
  User: `DEFECT (<kind>): "<sentence>"\nKNOWN CAST: <cast>\n<stateFacts>\n\nPARAGRAPH:\n<paragraph>`.
  Accept → replace by EXACT MATCH of the original paragraph (`out.split(paragraph).join(candidate)`
  only when `paragraph` occurs exactly once; else skip with reason `paragraph-not-unique`).
  After the loop: assert paragraph count unchanged; if changed, REVERT the whole lane and log
  `[REGENLANE] paragraph count changed (N -> M) — REVERTED`. Fail open on any error.
  Telemetry: `[REGENLANE] <label>: targets T, regenerated R, skipped S` and one
  `[REGENLANE] rejected (<reason>): "<first 70 chars>"` per rejection.
- Nonfiction: `if (isNonfictionProject(project)) return { text, regenerated: 0, skipped: [{ reason: 'nf-skip' }], targets: [] }`
  (import `./projectType.js`). NF gets its lane in Arc G once the closed-world verifier is added.

### B2. Wire into the writer
FILE: `src/lib/sceneWriter.js`, `export async function finalizeChapterProse(prose, project, priorChapterProse = [])` (line 2924).
DISCOVERY: `grep -c "// GRAMMARREPAIR-2: a/an agreement is healed HERE" src/lib/sceneWriter.js` → `1`.
`grep -c "} catch (subjErr) { console.warn('\[SUBJECTREPAIR-1\] writer pass failed open:'" src/lib/sceneWriter.js` → `1`.
CHANGE: insert the lane AFTER the SUBJECTREPAIR-1 block and BEFORE the GRAMMARREPAIR-2 comment:
fiction only (`!isNonfictionProjectAuthority(project)`), `cast = harvestCastNames(project?.characters_md, priorTexts)`
(confirm the runtime shape of `priorChapterProse` here — `buildCrossChapterEchoDetector(priorChapterProse)`
at line ~2937 consumes it; pass the same array), `departed` = names whose `partyStatus` is departed in
`buildCharacterState(priorChapterProse-as-entries, cast)` when available (fail open to `[]`),
`label: 'writer-final'`, wrapped in `try/catch` that never blocks.
COMMIT: `REGENLANE-1-WRITER-FINALIZE-LANE`.

### B3. Wire into Fix Manuscript
FILE: `src/lib/manuscriptPolishRunner.js`.
DISCOVERY: `grep -c "verifyInvariant('Subject Repair');" src/lib/manuscriptPolishRunner.js` → `1`.
`grep -n "allowSubjectRepairLLM" src/lib/manuscriptPolishRunner.js` → the option name and default; mirror it as `allowRegenLLM` (default `true`).
CHANGE: immediately after `verifyInvariant('Subject Repair');` add a stage: `checkpoint();` →
fiction only, `allowRegenLLM` gated, per chapter SEQUENTIAL `regenerateFlaggedParagraphs(f.content, { project, cast, priorProse: earlier chapters' content, label: 'Ch.N' })`
→ `changes.push('Ch.N: Regenerate Lane — regenerated R, skipped S')` → `verifyInvariant('Regenerate Lane');`.
COMMIT: `REGENLANE-1-FIX-MANUSCRIPT-STAGE`.

### B4. Battery `test/regenlane1.acceptance.mjs` (≥ 18 checks; mocked `callLLM`; generic fixture names such as Mara, Dov, Ilse)
1 version; 2 collects a dropped-subject paragraph; 3 collects a duplicate self-intro; 4 collects a
departed-active sentence; 5 accepts a clean rewrite and replaces exactly once; 6 rejects new proper
noun (`new-proper-noun`); 7 rejects two paragraphs (`paragraph-count`); 8 rejects still-flagged
(`still-flagged`); 9 rejects length ratio (`length-ratio`); 10 rejects worse quote balance
(`quote-balance`); 11 rejects a 12+-word sentence duplicated from `priorProse` (`prior-duplicate`);
12 rejects a departed name reintroduced (`departed-reintroduced`); 13 rejects identical candidate
(`unchanged`); 14 sequential — mock increments an in-flight counter on entry, decrements on exit,
asserts it never exceeds 1; 15 `maxUnits` respected; 16 mock throws → text unchanged, reason
`llm-error:`; 17 whole-lane revert when a mocked replacement changes paragraph count; 18 NF
project → `nf-skip` and text unchanged; 19–20 source-shape: `sceneWriter.js` contains
`[REGENLANE]` in `finalizeChapterProse` and `manuscriptPolishRunner.js` contains
`verifyInvariant('Regenerate Lane')`.
COMMIT: `REGENLANE-1-ACCEPTANCE-BATTERY`.

VERIFY:
```
cd ~/Downloads/UBS && git log --oneline -4
node test/regenlane1.acceptance.mjs | tail -1
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1       # 114 green, 0 red, 1 quarantined
npm run build 2>&1 | tail -1
curl -s localhost:5180/src/lib/sceneWriter.js | grep -c "REGENLANE"   # after Cliff restarts/refreshes: >= 1
```
LIVE PROOF (Cliff): Fix Entire Manuscript on the REDUX book. Console before/after:
`[MALFORMEDSENT] Gate scan: 78 …` → expect ≤ 15 (the lane will not clear every hard case on the
35B; the point is zero NEW damage). `[REGENLANE] Ch.N: targets/regenerated/skipped` per chapter.
`[STRUCTURE-GUARD]` must report NO reverts for the lane. Export gate `hardFailures 0`, paragraph
count identical to the pre-run export (1,701 for REDUX). Paste the console tail.
STOP if any `[STRUCTURE-GUARD] Regenerate Lane … REVERTED` appears — that is a verifier bug, not a data issue.

---

## 4. ARC C — POLISHSAFE-4: retire the last word-level mutations; inventory every stage
GOAL: with `allowLLM=false`, deterministic FICTION polish changes NOTHING but typography and the
four allowed heals (rule 0.2/2). Banned/capped vocabulary becomes prevention (writer prompt) +
regeneration (lane), never substitution.
EVIDENCE: `src/lib/vocabCaps.js` lines 88–108 (`PHASE 0: Hard-remove ALL banned words` — rotating
synonym substitution via `f.content.replace(regex, …)`) and Phase 1 caps; `antiDetectionPolish.js`
line 886 `Step J: Emotional math detection (hard-remove + flag)`; runner stages named
`Banned Vocabulary Recast`, `Antithesis Cap`, `Stacked Clause Variation`, `Voice Patterns`,
`External AI Patterns`, `Repetition Caps`, `Repetition Rewrite`, `Dialogue Tag & Coping Caps`,
`Vocab & ChatGPT Caps`, `Style Tic Sweep`, `Final Vocabulary Sweep`, `Sentence Case & Wound Repair`.

### C1. Inventory (no code yet)
Write `docs/polish-stage-inventory.md`: one row per `verifyInvariant('<Stage>')` in
`manuscriptPolishRunner.js` (`grep -n "verifyInvariant('" src/lib/manuscriptPolishRunner.js` — 45
call sites at 2cfa197, some stages appear twice), columns: stage · function(s) called · class
(T typography / S structural-with-allowance / V LLM-rewrite-with-deterministic-verifier /
F flag-only / M deterministic word mutation) · evidence line. Every M row must be retired in C2.
Commit: `POLISHSAFE-4-STAGE-INVENTORY`.

### C2. Retire every M for fiction (NF is already typography-only under NFGUARD-1)
- `vocabCaps.js` Phase 0 and Phase 1: no `replace`; emit
  `changes.push('Ch.N: BANNED "<word>" x<count> flagged — substitution retired (POLISHSAFE-4)')`
  and `[POLISH][VOCAB]` logs. Export the lists (`BANNED_WORDS_HARD_REMOVE`, `CAPPED_VOCABULARY`)
  so the writer prompt and the lane can read them.
- `antiDetectionPolish.js` Step J: flag-only.
- Every other M row from the inventory: flag-only, same pattern (POLISHSAFE-2/3 comments are the model).
- Prevention: the fiction writer prompt gets a `BANNED VOCABULARY (never use): …` block built from the
  exported list (DISCOVER where the fiction scene prompt's rule blocks are assembled — the
  CHARACTER PRONOUNS line is pushed at `sceneWriter.js` line 2328 inside the same builder).
- Regeneration: register a `bannedVocabulary` detector (sentence contains a banned word → kind
  `banned-vocab`) as an `extraDetectors` entry for the lane in BOTH wire points from Arc B.
Commits: `POLISHSAFE-4-RETIRE-VOCAB-SUBSTITUTION`, `POLISHSAFE-4-RETIRE-REMAINING-MUTATIONS`,
`POLISHSAFE-4-WRITER-BANNED-VOCAB-BLOCK`, `POLISHSAFE-4-LANE-BANNED-VOCAB-DETECTOR`.

### C3. Battery `test/polishsafe4.acceptance.mjs` (≥ 12 checks)
Fixture: a 6-paragraph fiction chapter (generic names) dense with every banned word, capped words
over cap, "It was" openers, pronoun openers, telling tags, emotional-math shapes, similes — but
with balanced quotes, correct articles, and no dialogue-opener defects. Run
`runManuscriptPolishPipeline({ loaded, project: fiction, allowLLM: false, allowRegenLLM: false, allowSubjectRepairLLM: false, allowStyleLLM: false })`
(DISCOVER the exact option names in the runner; they exist for LLM stages). Assert: output ===
input after smart-quote normalization of both (byte-identical otherwise); `changes` contains a
`flagged` entry for banned vocab, for capped vocab, for It-was, for pronoun openers, for telling
tags; paragraph count unchanged; NF fixture unchanged too; `vocabCaps.js` no longer contains
`f.content = f.content.replace(regex` in Phase 0/1 (source-shape); lists are exported; the writer
prompt builder contains `BANNED VOCABULARY`. Update any existing battery that asserted a
substitution happened (name them in the commit message; rule 0.2/5).
COMMIT: `POLISHSAFE-4-ACCEPTANCE-BATTERY`.

VERIFY: as Arc B (expect 115 green). LIVE PROOF: Fix Manuscript on REDUX again — `[POLISH][VOCAB]`
shows `flagged`, never `removed`; word count delta of the whole book after the run is explained
entirely by `[REGENLANE]` and the four allowed heals (paste `changes`).

---

## 5. ARC D — STATECONTRACT-1: one closed-world state contract per chapter
GOAL: the planner and every scene prompt receive ONE block that states everything already true,
and post-generation validators feed the lane. Pieces exist; this arc composes and enforces them.
EVIDENCE: pronoun/role/state/style blocks are assembled inline in
`generateChapterSceneByScene` (`src/lib/sceneWriter.js` line 3376; assembly at ~3690–3820:
`pronoun_canon`, `pronoun_variable`, `role_canon`, `character_state`, `__characterState`,
`__characterStateCast`, `prior_completed_events` at ~3817). No contract for resolved arcs, no
scene-boundary map, no same-chapter scene-dup detector, bible headers unvalidated.

### D1. Module `src/lib/chapterStateContract.js` (relative imports)
`buildChapterStateContract({ project, chapter, resolvedPriorProse, normalizedScenes, allProjectChapters, cast })`
→ `{ block, facts, telemetry }`. Compose, in this order, each in its own `try` (fail open per section):
1. CAST: `parseCanonCast(characters_md)` + `parseDeclaredPronouns(characters_md)` +
   `buildPronounCanon(project, priorTexts, cast)` → `name · pronouns · role · status(present|departed|dead|unknown) · introduced(yes|no)`
   (status/introduced from `buildCharacterState(priorEntries, cast)`; `extractBeatDeclaredStateUpdates` for declared returns, per CHARSTATE-2).
2. EVENTS DONE (do not repeat): `buildPriorChapterEventLedger(allProjectChapters, chapterNumber, { maxChars: 5000 }).events`.
3. RESOLVED ARCS (ARCSTATE-1): parse `canon_md` + `characters_md` for lines
   `RESOLVED ARC: <Name> — <label> (ch <N>)[; forbidden: "phrase"; "phrase"]`. Data-declared;
   no phrase list lives in code. Emit `Do not reopen: <Name> — <label>` lines.
4. SCENE MAP: for each of `normalizedScenes`: index, `scene_goal`, `required_events`, entry/exit state if present.
5. STYLE BANS: `buildStyleBudgetPromptBlock(buildBookStyleLedger(priorTexts))`.
`block` = `=== CHAPTER STATE CONTRACT (closed world — obey exactly) ===\n…\n=== END STATE CONTRACT ===`.
`facts` carries the structured data (cast with status, departed list, resolved arcs with forbidden
phrases, events). `CHAPTER_STATE_CONTRACT_VERSION = 'chapter-state-contract-v1'`.

### D2. Inject
- `generateChapterSceneByScene`: build the contract ONCE per chapter where the inline pieces are
  built today; add `state_contract: contract.block` to `promptSpec`; KEEP the existing fields
  populated (audits read them). DISCOVER the scene prompt builder that consumes `promptSpec` and
  push the block right after the CHARACTER PRONOUNS line (line 2328 region). Telemetry:
  `[STATECONTRACT] Ch.N: cast K, departed D, events E, resolved arcs R, scenes S`.
- Beat planner: the planner-side CHARSTATE block is built in `src/pages/ProjectStudio.jsx`
  (DISCOVERY: `grep -n "\[CHARSTATE\] Planner contract" src/pages/ProjectStudio.jsx` → `1`, ~line 3432,
  from `buildCharacterStateContract(charState)` at ~3429). Replace that block with the full
  contract `block` from D1 and trace how it reaches `buildSceneBeatPrompt(project, chapter,
  previousChapter, chapters, priorCoverage = '')` (`src/lib/autonovel.js` line 1265) — name the
  parameter it travels in, in your report. The prompt must contain `CHAPTER STATE CONTRACT`.
COMMITS: `STATECONTRACT-1-MODULE`, `STATECONTRACT-1-WRITER-INJECTION`, `STATECONTRACT-1-PLANNER-INJECTION`.

### D3. Validators → lane (fiction)
- SCENEDUP-1: after chapter assembly, run `findProseEventCollisions` (`src/lib/eventCollision.js`,
  exports `extractEventEntities`, `classifyEventAction`, `findProseEventCollisions`,
  `findBeatEventCollisions`) between each scene and the EARLIER scenes of the SAME chapter, with the
  content-overlap guard from SCENECOLLIDE-1C. A same-chapter collision (the two-arrivals class)
  → lane target kind `scene-duplicate` on the later occurrence's paragraph.
- ARCSTATE-1 detector: for each resolved arc with declared forbidden phrases, any sentence
  containing one (case-insensitive, data-driven) → kind `arc-restart`.
- Existing `auditProseAgainstCharacterState` findings (`DEPARTED_CHARACTER_ACTIVE`,
  `DUPLICATE_INTRODUCTION`) → lane kinds `departed-active` / `duplicate-introduction` (already
  handled in Arc B; here they receive `facts.departed`).
- Order in `finalizeChapterProse`: lane runs with `extraDetectors: [sceneDup, arcRestart, bannedVocab]`
  and `stateFacts: contract.block`. A unit still flagged after the lane → existing
  `STATE-CONTRACT-REPAIR` / `NarrativeInvariantError` path decides (no new hard block here).
COMMITS: `SCENEDUP-1-SAME-CHAPTER-EVENT-COLLISION`, `ARCSTATE-1-RESOLVED-ARC-DETECTOR`, `STATECONTRACT-1-LANE-DETECTORS`.

### D4. BIBLEGATE-1 — the bible must be complete and parseable before drafting
Module `src/lib/bibleGate.js`: `auditBibleCompleteness({ project, chapters })` →
`{ ok, missing: [{ name, mentions }], malformedHeaders: [{ header, reason }] }`.
- Names: `harvestCastNames(characters_md, [outline_md, ...beat_summaries])` from `./pronounLock.js`;
  a name with ≥ 3 mentions across outline/beats and no `**N. Name**`-shaped entry in `characters_md` → missing.
- Headers: an entry header whose name token contains `:` or equals a role word (`Crew`, `Rival`,
  `Protagonist`, `Antagonist`, `Mentor`, `Sidekick`, `Villain`, `Narrator`) → malformed (the
  `**6. Crew: Lark**` bug); an entry without a `(he/him|she/her|they/them|…)` declaration → missing pronouns.
- Wire: `ProjectStudio.jsx` `draftChapter` (line 3842) and `handleDraftAll` (4873): fiction only;
  if `!ok` → `toast.error` listing names/headers and `return` (block). Console `[BIBLEGATE]`.
COMMITS: `BIBLEGATE-1-COMPLETENESS-AUDIT`, `BIBLEGATE-1-DRAFT-WIRING`.

### D5. PRONOUNLOCK-2
`scanPronounViolations` in `src/lib/pronounLock.js` gets the PRONOUNVAR-2 attribution
(possessive/reflexive bound to a subject name, span cut at the next human referent — reuse
`countBoundPossessives` / `safeSpanEnd` / `PERSON_NOUN_RX`, present in the file). DISCOVER the
function and the `pronoun-lock-v3` version string; bump to v4 and sync `pronounlock1` /
`pronounvar1` / `pronounvar2` batteries' version checks in the same arc (rule 0.2/5).
COMMIT: `PRONOUNLOCK-2-CLOSED-WORLD-ATTRIBUTION`.

### D6. Batteries
`test/statecontract1.acceptance.mjs` (≥ 14): version; block has all five sections; departed
character listed as departed after a prior-chapter departure; declared return flips status;
resolved-arc line parsed with forbidden phrases; scene map lists every scene; style bans present
when a family is exhausted; anthology → no cross-story sections; source-shape: `sceneWriter.js`
contains `state_contract:` and `[STATECONTRACT]`, `autonovel.js` contains `STATE CONTRACT`.
`test/scenedup1.acceptance.mjs` (≥ 6): same-chapter re-arrival flagged; two different events
not flagged; overlap guard prevents vocabulary-only FP.
`test/arcstate1.acceptance.mjs` (≥ 6): parse; detector fires on declared phrase; not on other text; no arcs → no detector.
`test/biblegate1.acceptance.mjs` (≥ 8): missing name with 3 mentions blocks; 1 mention warns;
`**6. Crew: Lark**` malformed; missing pronouns; clean bible ok; NF → ok; wiring source-shape.
`test/pronounlock2.acceptance.mjs` (≥ 8): the PRONOUNVAR-2 third-party cases produce 0 violations; a real within-scene flip still flags.
COMMITS: one `-ACCEPTANCE-BATTERY` per module.

VERIFY: as before (expect 120 green). LIVE PROOF (Cliff): redraft ONE chapter of the REDUX book
(a chapter after a departure) with console open: `[STATECONTRACT] Ch.N: …`, `[BIBLEGATE]` passes,
`[REGENLANE] writer-final …`, no `DEPARTED_CHARACTER_ACTIVE` in the export-gate scan for that chapter.

---

## 6. ARC E — GATEPROMOTE-1: warnings that are real continuity breaks become blocks
FILE: `src/lib/exportSafetyGate.js` (`runPreExportSafetyGate`, line 93; decision at ~341:
`if (entry.recommendedAction === 'REJECT_REGENERATE' || entry.recommendedAction === 'REJECT_MANUAL_REVIEW') { hardFailures.push(entry); } else { warnings.push(entry); }`).
CHANGE (fiction): `DEPARTED_CHARACTER_ACTIVE` and `DUPLICATE_INTRODUCTION` findings →
`recommendedAction: 'REJECT_REGENERATE'` (hard). `MALFORMEDSENT-1` stays a warning, governed by
`export const MALFORMEDSENT_HARD_BLOCK = false;` in `malformedSentence.js` — flip to `true` only
after two consecutive books export with `[MALFORMEDSENT] Gate scan: 0` (record the books in the
commit message). NF unchanged (its gates are already closed-world hard blocks).
BATTERY `test/gatepromote1.acceptance.mjs` (≥ 6): fiction fixture with a departed character
acting → `blocked === true` with the code; duplicate intro → blocked; malformed only → not blocked
while the constant is `false`; NF fixture unaffected; the `malformedsent1` battery's "never a hard
block" checks are updated to read the constant (rule 0.2/5).
COMMITS: `GATEPROMOTE-1-CONTINUITY-BREAKS-BLOCK-EXPORT`, `GATEPROMOTE-1-ACCEPTANCE-BATTERY`.

---

## 7. ARC F — STYLE: STYLEBUDGET-3, STYLEBUDGET-2C, FRAGBUDGET-1
### F1. STYLEBUDGET-3 — template families through the lane
Module `src/lib/templateFamilies.js`: `TEMPLATE_FAMILIES` (closed word lists — detection may be
lexical: `ozone`, `burnt sugar`, `regret` as a noun-of-smell, `small smile`, `but it was real`,
`for now`, `indifferent`, `heavy silence`, `chest tightened|tightness`, `heartbeat`, `really looked`),
`findTemplateFamilyHits(text, { budgets })` → lane targets kind `template-family` when a family
is over its per-chapter budget (budgets in one exported object, book-level spend read from
`buildBookStyleLedger`). Opening-echo 4-grams already detected by BOOKGATE-2 → target kind
`opening-echo` on the chapter's first paragraph.
### F2. STYLEBUDGET-2C — one escalated retry for the "less like X, more like Y" shape in
`healSimileDensity` (`simileRecast.js` 147–186): if `verifySimileRecast` rejects with a
comparison-left reason and the sentence matches `/\bless like\b.*\bmore like\b/i`, retry ONCE with
the system prompt prefixed "State the contrast as a plain assertion; do not use 'like', 'as if', or 'as though'."
### F3. FRAGBUDGET-1 — fragment density: sentences with no finite verb (reuse the finite-verb
test from `malformedSentence.js` `bare-verb` logic) per 1k words over budget (default 20/1k;
exported constant) → lane targets kind `fragment-density` (densest paragraphs first, cap 6/chapter).
### F4. Deterministic backstops are already the rule for names (RENAMEPASS-1 in anthologies).
For novels, add nothing new here; NAMEREG-2 (`Better`-style extractor FP: require ≥ 1
mid-sentence occurrence before a token counts as a name) lands as `NAMEREG-2-MID-SENTENCE-RULE`
with a 4-check battery.
BATTERIES: `stylebudget3`, `stylebudget2c` (mock: first candidate keeps a comparison, retry does
not → accepted), `fragbudget1`, `namereg2`. COMMITS named per module + `-ACCEPTANCE-BATTERY`.
LIVE PROOF: Fix Manuscript on REDUX: `[STYLEBUDGET-2]` density ≤ 3.0/1k on ≥ 18 of 20 chapters;
`[REGENLANE]` shows `template-family` and `fragment-density` regenerations; ChatGPT re-score
(advisory target ≥ 80).

---

## 8. ARC G — NONFICTION: finish the closed world
### G1. NFANTH-CW-1 — per-story closed world for nonfiction anthologies
EVIDENCE (2cfa197): `getProjectResearchText(project, chapter)` (`sceneWriter.js` line 2051) always
includes whole-project research; `buildSourceAudit(relevantResearch = '', project = {})` (line 1116)
takes no chapter; `excludeForeignQuotes` (`quoteLedger.js` line 80) fences only verbatim quotes.
DESIGN (data-driven, deterministic): `src/lib/storyEntityOwnership.js` —
`buildStoryEntityOwnership(project, chapters)`: for each anthology story, the proper nouns, years
and month-year dates in ITS title + beat_summary + scene goals are "owned"; an entity owned by
other stories and NOT by story N is "foreign to N". `fenceForeignEntities(researchText, ownership, chapterNumber)`
replaces any research paragraph that mentions a foreign entity and no owned entity with
`[evidence belonging to Story <k> — not available to this story]`, returning `{ text, fenced: [...] }`.
Wire: in `getProjectResearchText`, when `isNonfictionAnthology(project)`, apply the fence to both
`resolved` and `relevant` before they are combined; give `buildSourceAudit` a `chapter` parameter
and apply the same fence to its haystack (source-shape battery check). Telemetry `[NFANTH-CW]`.
BATTERY `nfanthcw1` (≥ 10): 2-case fixture with invented names (Case A: Dr. Hale / Port Ellis / 1966;
Case C: Dr. Vance / 1997): drafting Story 3 fences Hale/Port Ellis/1966, keeps Vance/1997; an
entity shared by both stories is never fenced; non-anthology NF untouched; fiction untouched.
### G2. NFEXPORT-BIB-1 — a nonfiction book without Sources is not done
`exportSafetyGate`: for NF, if no chapter satisfies `isBackMatter` with a bibliography of ≥ 4
entries (the `generateBibliography` floor in `bibliographyGenerator.js` line 500) → warning
`NFEXPORT-BIB-1: no Sources section`; constant `NF_BIBLIOGRAPHY_HARD_BLOCK = false` to promote after
the flagship ships with one. Battery 5 checks. LIVE: run the existing Bibliography button on the
flagship (closed-world; it throws if < 4 verifiable entries — that is a research-depth data task).
### G3. BIBLEGUARD-NAMES-1 — proper nouns in generated foundation fields must exist in research
DISCOVER the deterministic quote guard in `src/lib/parallelBibleGenerator.js` (BIBLE-GUARD) and
extend it: every proper-noun phrase in a generated field must substring-match the research text
(the same normalization as `closedWorldCheck` in `sceneWriter.js`, ~line 3075); violation → the
field fails with the existing "nothing was saved" toast naming the noun. Battery 6 checks.
### G4. TEMPORAL-1 — relative-time claims checked against the research timeline
DISCOVER `research_data.timeline` shape. Detector: sentences with `(\d+|two|three|…) (days|weeks|months|years) (after|before|later)` or `the (next|following) (day|morning|year)` between two
named events that both exist in the timeline with dates → compute the implied order/gap; a
contradiction → NF strip machinery (`{ snippet }` sentence strip, closed-world, like ARCH-1C) at
draft time and a hard block at export with the sentence named. Battery 8 checks on a fixture timeline.
### G5. ARCH-2 — the researcher layer is closed-world too
DISCOVER the extractor (research extraction in `ProjectStudio.jsx` / the bridge fetch path). Rule:
every atom (name, date, number) the extractor writes into `research_data` must substring-match the
fetched page text it is attributed to; otherwise the atom is dropped and logged
`[ARCH-2] dropped unsupported atom`. Battery 8 checks with a fixture page.
### G6. NF regenerate lane
Extend Arc B's lane for NF: verifier gains (10) `closedWorldCheck(candidate, project)` returns no
new violations vs original; remove the `nf-skip`. Battery `regenlane1` gains 3 checks (version → v2).
COMMITS: `NFANTH-CW-1-*`, `NFEXPORT-BIB-1-*`, `BIBLEGUARD-NAMES-1-*`, `TEMPORAL-1-*`, `ARCH-2-*`,
`REGENLANE-2-NF-CLOSED-WORLD-VERIFIER`, each with `-ACCEPTANCE-BATTERY`.
LIVE PROOF: (a) the §4.1 nonfiction-anthology end-to-end draft (5 documented cases, shared research
brief) — expect `[NFANTH-CW]` fencing per story and zero cross-case atoms in the export-gate
closed-world scan; (b) the flagship: Bibliography → Fix Manuscript (NF) → Export → Phase-H read.

---

## 9. ARC H — EXERCISE WHAT HAS NEVER BEEN EXERCISED
### H1. DEADTEST-1 (do first if PREFLIGHT-1 reproduced the red)
`tests/narrativeContractRegression.test.mjs:244` expects `auditSceneAgainstLedger` (`src/lib/sceneContractGate.js`
line 845) to raise `OBJECT_POSSESSION_VIOLATION` when a transferred object is held by the giver.
The test imports `buildInitialLedger` and `extractSceneLedgerUpdates` from
`src/lib/narrativeLedger.js` (test line 22) and the audit from `sceneContractGate.js`. Root-cause it
(`git log --oneline -- src/lib/narrativeLedger.js src/lib/sceneContractGate.js`; find which commit
stopped `exit_state: 'Lena gives the log page to Marcus.'` from transferring ownership, or stopped
the audit from checking `prose: 'Lena holds the log page.'` against it). Either restore the check
with a battery (`test/deadtest1.acceptance.mjs`, ≥ 4 checks, generic names) or,
if the behavior was deliberately retired, delete the test and record why in the commit. Never
weaken the assertion.
### H2. SCENEGATE-ON-1
`src/lib/generationContext.js`: `SCENE_EXECUTION_ACCEPTANCE_GATE_FEATURE = { key: 'scene_execution_acceptance_gate_v1', defaultEnabled: false }`.
Protocol: create a fresh 3-chapter fiction test project; set `scene_execution_flags: { scene_execution_acceptance_gate_v1: true }`
from the Setup tab (WAVE6-DEADGATE surface); draft; capture `[SCENE-EXECUTION]`/acceptance telemetry
and the export gate. If 3/3 chapters draft with the gate active and no false hard blocks, flip
`defaultEnabled: true` for THAT feature only (`SCENEGATE-ON-1-ACCEPTANCE-GATE-DEFAULT-ON`) and sync
`test/deadgate1.acceptance.mjs` (rule 0.2/5). If it produces false blocks, file the defects as
arcs; do not flip.
### H3. ROUTERHEAL-2 — land or delete
`test/run-all.mjs` `QUARANTINE` names the missing pieces: `ROUTERHEAL_PORT_FREE_MS` /
`ROUTERHEAL_SERVING_MS` declared in `vite-server-store-plugin.js` but never read; `routerHealPortFree`,
`routerHealWaitServing`, spawn retry missing. Implement the polling (server-side, sequential,
bounded), unquarantine (`ROUTERHEAL-2-POLLING-LOGIC` + battery green), or delete the dead constants
and the battery with the reason (`ROUTERHEAL-2-RETIRED`). After this, expected quarantined = 0.
### H4. REWRITE-E2E-1 (protocol, no code unless defects)
`handleRewriteSelected` / `handleRewriteAll` (`ProjectStudio.jsx` 5256 / 5282). Take an OLD
Base44-era novel (restored by RESTORE-1), Rewrite All, then Fix Manuscript, then Export. Same
telemetry expectations as a fresh draft. Every defect becomes its own arc.
### H5. KDP-CHAIN-1 (protocol)
Copyright page (FoundationTab generator, exists), Bibliography (NF), cover, KDP metadata, export.
Verify the DOCX has front matter (Chapter 0), body, back matter; `isFrontMatter`/`isBackMatter`
(`bibliographyGenerator.js` 42/57) classify them; export gate green. Defects → arcs.
### H6. HYGIENE-1
Replace real-book character names in existing batteries (`malformedsent1` uses a live book's cast)
with invented names; behavior unchanged. `HYGIENE-1-GENERIC-FIXTURE-NAMES`.

---

## 10. ARC I — HEADLESS-1: get the run out of the browser tab
EVIDENCE: `draftChapter` is `ProjectStudio.jsx` lines 3842–4817 (~975 lines of UI-bound orchestration);
`handleDraftAll` at 4873. `finalizeChapterProse` is called from BOTH `sceneWriter.js` (4775) and
`ProjectStudio.jsx` (4638). The store is session-gated.
### I1. ORCH-1 — mechanical extraction with parity
Move the body of `draftChapter` into `src/lib/chapterOrchestrator.js` as
`export async function runChapterDraft({ project, chapter, chapters, deps, options })`, where
`deps = { Chapter, NovelProject, FileStore, callAgent, onProgress, toast, log }` (every UI/global
the body touches is passed in — DISCOVER the full list by reading the body; list it in the commit).
`ProjectStudio.jsx` `draftChapter` becomes a thin wrapper that builds `deps` and calls it.
MOVE, do not rewrite: the diff of the moved body must be limited to `deps.` prefixes and the
removal of React state calls (which become `onProgress` events). Battery `orch1` (source-shape +
mocked-deps smoke): the wrapper is < 60 lines; `runChapterDraft` exists; a mocked-pipeline run
emits the stage snapshots in the same order the UI emitted (`window.__UBS_PIPELINE` stage names
`…'8-final-save'` — DISCOVER the list).
### I2. RUNNER-1 — `scripts/ubs-run.mjs`
Node + alias loader. Commands: `draft --project <id> [--chapters 1-20] [--resume <runId>]`,
`polish --project <id>`, `export --project <id>`. Auth: add a localhost-only runner token
(`data/_auth/runner.token`, generated on first server start, accepted by `vite-server-store-plugin.js`
in place of the session cookie ONLY when the request originates from 127.0.0.1) — server change,
restart required. State: `data/_runs/<runId>.json` (chapter → status/SHA-of-content/timestamp),
resumable; log `data/_runs/<runId>.log` with the same console tags. SEQUENTIAL across chapters
(SEQFIX-1 already proved parallel lanes contradict each other). Battery `runner1` (≥ 8): token
rejected off-localhost; checkpoint written per chapter; `--resume` skips completed chapters;
stop file `data/_runs/<runId>.stop` halts after the current chapter.
### I3. SPEED-1 (after I2, measured)
Levers named in the flagship redraft run (~21 h / 20 ch): (a) vetted era-geography/military
context added to the closed world so true facts stop triggering regeneration; (b) tighter prompt
for unlisted places/units; (c) llama flash-attn + prompt-prefix KV reuse. Each lever is one commit
with a before/after `[TIMING]` measurement on the same chapter; quality gates must be identical.
Then the Control Room Agent / n8n watchdog sit on top of the runner — not before.

---

## 11. ARC J — DATA HYGIENE
- STOREKEY-1: `_FileStore.create()` has no upsert (duplicate research blobs per save). DISCOVER
  the create path in `vite-server-store-plugin.js`; upsert by key; battery proves a second save of the
  same key does not add a record.
- RERESEARCH-CONFIRM-1: when `research_data` is substantial (DISCOVER the size the Aug 8 incident
  involved; default ≥ 2,000 chars), Re-Research requires a confirm dialog naming the size.
- URLWRITE-GUARD-1: the store rejects a chapter write whose `content_md` is empty while
  `content_md_url` is set (the Base44-era corruption shape, RESTORE-1 §"Standing lesson"); loud
  error; battery.
COMMITS named per item + `-ACCEPTANCE-BATTERY`.

---

## 12. FINAL-ACCEPTANCE-1 — the bar for "near perfect every time"
Two fresh test books through the headless runner, no human edits between stages:
- FICTION: 12-chapter novel from a new premise (invented names), with a declared departure and
  return, a declared resolved arc, two POV characters with declared pronouns.
- NONFICTION: 4-chapter baited book in the Molasses File pattern (bait spec in project knowledge).
PASS = all of: export gate `blocked=false`, `hardFailures 0`; `[MALFORMEDSENT] Gate scan: 0`;
`DEPARTED_CHARACTER_ACTIVE 0`, `DUPLICATE_INTRODUCTION 0`, `EVENT_CLASS_REPLAY 0`, same-chapter
scene dups 0; simile density ≤ 3.0/1k book-wide; every template family within budget;
cross-chapter 12+-word duplicates 0; quote balance 100% every chapter; paragraph count before
polish == after polish (± reported allowances); NF: closed-world flags 0, TEMPORAL 0, Sources
section present, no cross-case atoms; front matter present; DOCX opens and reads to the end.
Repeat both books a SECOND time from the same premises. Two consecutive clean runs = the bar.
Then, and only then, the model question is measured: rerun the fiction book on a stronger
instruction-follower and compare `[REGENLANE] skipped` counts and simile density — the pipeline is
no longer adding noise, so the difference is the model's.

---

## 13. VERIFY TEMPLATE (paste after every arc) and STOP CONDITIONS
```
cd ~/Downloads/UBS
git status --porcelain | wc -l                       # 0
git log --oneline -<n>                               # the arc's commits, exact names
node test/<new>.acceptance.mjs | tail -1             # ACCEPTANCE: ALL CHECKS MATCHED
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1
NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" npm run -s test:narrative-connect 2>&1 | tail -2
npm run build 2>&1 | tail -1
git push origin main && git push origin main:agent/narrative-connect-1 && git rev-parse --short origin/main origin/agent/narrative-connect-1
```
STOP and report — do not continue, do not work around — when: a DISCOVERY count differs; an
existing battery goes red; `run-all` green count is not previous + new batteries; the build fails;
a `[STRUCTURE-GUARD]`, `[QUOTE-GUARD]` or `[NFGUARD-1]` REVERTED line appears in a live proof for
a stage this plan added; you find yourself writing a regex that changes prose; you need a book
title, pen name or character name inside code or a test.

Do not claim success. Paste the raw output and stop.
