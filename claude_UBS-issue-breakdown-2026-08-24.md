# UBS — WHAT IS KEEPING THE APP FROM "NEAR-PERFECT EVERY TIME" (2026-08-24)

Sources: the Aug 10 sessions (anthology arc, SCOPINGFIX-1, NFCLASS-2 audit, NF-anthology
closed-world finding) and the Aug 13–16 session (adult stack, publish chain, RESTORE-1,
AUTH/TRANSFER, the Lipstick & Lug Nuts REDUX cycle, POLISHSAFE, SUBJECTREPAIR, PROSEFEED,
the root-cause trace, pipeline hardening 1–3) — plus a live audit of the repo at the tip.

## 0. VERIFIED THIS SESSION (fresh clone, cliffypoodev/unitybookstudio)
- `main` = `agent/narrative-connect-1` = **`2cfa197`** (MALFORMEDSENT-1-ACCEPTANCE-BATTERY). Nothing
  landed after the Aug 16 record.
- Acceptance suite reproduced in an installed tree (`npm ci`, `unset NODE_OPTIONS && node
  test/run-all.mjs`): **`batteries: 110 green, 0 red, 1 quarantined | 2901 checks passed`**.
  The quarantined battery is ROUTERHEAL-2 (feature half-landed, battery correct).
- The second suite (`tests/`, run via `npm run test:narrative-connect` with the alias loader on
  NODE_OPTIONS) is **RED at the tip**: `tests/narrativeContractRegression.test.mjs:244` —
  "runtime ledger blocks possession violation for transferred object" expects `audit.ok === false`,
  gets `true`. Reproduce on the Mac before treating as real; if real, the object-possession
  continuity gate is silently dead (DEADGATE class).
- **NFCLASS-2 + SERIESHYGIENE-1 did NOT land** (0 commits in history). Proven against live
  `src/lib/projectType.js`: `isNonfictionProject` treats ANY declared value as authoritative
  (`if (declared) return declared === 'nonfiction';`), and `src/pages/SeriesManager.jsx` hardcodes
  `projectPayload.book_type = 'fiction'` for every "Anthology Volume" (WAVE2-ENUMFIX). A nonfiction
  anthology series volume therefore classifies FICTION and bypasses every nonfiction gate.
- **POLISH-ARCH-1 DID land** (`812fb3c`, `f21a0d4`, `fe35521`, `7bf459e`): `manuscriptPolishRunner.js`
  wraps every Fix Manuscript stage (~45 `verifyInvariant('…')` calls) in a paragraph-count
  invariant with revert. The July "approved but not built" status is stale.
- Bibliography IS wired (`ProjectStudio.jsx` → `generateBibliography` → closed-world
  `buildClosedWorldBibliography`). It has simply never been run on the flagship.
- 39 call sites still classify fiction/nonfiction locally (`book_type === 'nonfiction'` etc.)
  instead of through the NFCLASS-1 authority — e.g. `vocabCaps.js`, `povTense.js`, `postClean.js`,
  `qualityScan.js`, `autonovel.js`, `ProjectStudio.jsx`, `FoundationTab.jsx`.
- DEADGATE-1 made the six scene-execution flags reachable from Setup; the scene acceptance gate
  (~2,000 lines of required-event / exit-state / POV checking) is still OFF by default and has
  never been proven live.

## 1. THE TWO ROOT PROBLEMS
**A. The app has been fixing prose by editing it with regex, and that editing has been the single
biggest source of broken prose.** The rule adopted Aug 15–16 is right: detect aggressively, then
regenerate or flag — never edit. Only the detect half is built.

**B. The writer starts every chapter without a complete, enforced picture of what is already
true** — who is present, who has been introduced, pronouns, resolved arcs, which events already
happened. Pieces exist as separate ledgers; the single contract that forces the writer to obey them
does not.

## 2. THE TEN ISSUES

### 1. Polish / Fix Manuscript mangling good prose
Looks like: "Looked at Rodge." / "Were a mess." / "Zin were ridiculous" / "Zinnia was wearing… his
hat" / flattened paragraphs (False North) / quotes and paragraph breaks eaten / beheaded "2.3
million" sentences in nonfiction.
Cause: passes that delete words to "break monotony," then a repair pass that refilled the stumps
with the wrong name because its checker only confirmed *a* name was added. 290 subjectless openers
in one shipped book — made by the app.
Status: deletions retired to flag-only, repair checker hardened, structure/quote/content guards
revert damage (POLISHSAFE-1/2/3, SUBJECTGUARD-1, POLISH-ARCH-1 invariant, QUOTE-GUARD, NFGUARD).
REDUX still carries 78 malformed sentences the app can see (MALFORMEDSENT-1) but cannot fix.
Still open: (a) the block-and-regenerate lane; (b) `vocabCaps.js` Phase 0 banned-word and Phase 1
cap word SUBSTITUTIONS still mutate fiction prose deterministically (synonym rotation); (c) the
remaining word-level "recast/rewrite/sweep" stages in the runner need an inventory and retirement.
Kills it: REGENLANE-1 + POLISHSAFE-4 (see the master fix plan).

### 2. Continuity failures at drafting
Looks like: JB leaves in ch9 and acts in seven later chapters; Nolan introduces himself three times
in one chapter; ch1's scene replays in ch2; two endings; antagonist name drift; Sadie called "the
navigator"; Zin's arc restarts in ch19; pronoun drift.
Cause: root problem B — plus PROSEFEED-1: every prose-fed system read an empty field for
URL-stored chapters, so they were fed nothing for the whole REDUX draft.
Status: EVENTLEDGER-1, CHARSTATE-1/2, SCENECOLLIDE-1/1C, CANON-2, PRONOUNLOCK-1, PRONOUNVAR-2,
INTRODUP-1, PROSEFEED-1, LEAKREPAIR-1 landed. Contract pieces are assembled inline in
`generateChapterSceneByScene` (sceneWriter.js ~3690–3820) as separate strings.
Still not built: the one per-chapter state contract, resolved-arc protection (ARCSTATE-1), a
same-chapter scene-duplication detector, PRONOUNLOCK-2, EMOSTATE-1; CHARSTATE/INTRODUP at export are
warn-only. Bible hole: Lark and Sadie were headed "Crew: Lark" so the parser read the character as
"Crew".
Kills it: STATECONTRACT-1 + BIBLEGATE-1 + SCENEDUP-1 + ARCSTATE-1 + GATEPROMOTE-1.

### 3. AI slop and fingerprints
Looks like: 4.5 similes per 1k words, 332 "like a", 273 "looked at", the same metaphor families
(ozone, burnt sugar, regret, small smile, "but it was real", "for now", heavy silence), chapter
openings sharing phrases, fragment syndrome, and the model naming a character "Maria" with Maria
explicitly banned in the prompt.
Status: STYLEBUDGET-1 (ledger + bans, now fed), STYLEBUDGET-2/2B (simile hard cap with verified
recast), USEDNAMES-1 + RENAMEPASS-1 for anthologies.
Still open: the "less like X, more like Y" shape (2C), the template-family finder (STYLEBUDGET-3),
a fragment budget, and deterministic backstops for every class the model defies.

### 4. Mechanical gates that blocked a book but couldn't heal it
Looks like: 16 missing opening quotes in one book (fixer healed zero), "a axle"/"a erratic"
blocking three exports in a day, false positives refusing whole books ("an unicorn").
Status: closed — DIALOGREPAIR-2, GRAMMARREPAIR-2, ARTICLEFP-1/1C, GRAMMARFP-2. Bare-verb and
malformed shapes remain detect-only (issue 1's regenerate lane).

### 5. Cross-chapter repetition
Status: closed for fiction — CROSSDEDUPE-1 (shared detector + verified recast), GATEREPORT-1,
BOOKGATE-3. Nonfiction stays typography-only by design.

### 6. Saves and data corruption
Looks like: a draft that silently saved the OLD text (verify allowed a 10% mismatch); 66 chapters and
57 foundation fields that were dead Base44 URLs; duplicate research blobs per save; one-click
research wipe.
Status: DRAFTSAVE-1 (2% tolerance, anchors, retries), RESTORE-1 (106/106).
Open: STOREKEY upsert, Re-Research confirm dialog, a save-path rule that URL-only content can never
be written again.

### 7. Nonfiction integrity — what the closed-world work hasn't reached
- Dates/numbers/predicate claims: the only class that shipped twice ungated (a rescue the corpus
  never supports; a fabricated 12:07 clock). Partly live (ARCH-1B closed-world check in
  sceneWriter); not guaranteed.
- TEMPORAL-1, bible name-gate (the "Gura" class), ARCH-2 (researcher layer): not built.
- Sources section: wired, closed-world, never run on the flagship; not required by the NF export gate.
- Nonfiction anthology: every story's closed world is the whole collection —
  `getProjectResearchText` always includes whole-project research, `buildSourceAudit` takes no
  chapter argument, `excludeForeignQuotes` fences only verbatim quotes (not names/dates/places).
  Case A's facts are valid evidence for Case C. Never drafted end-to-end.
- Classification bypass (NFCLASS-2/SERIESHYGIENE-1): PROVEN OPEN at 2cfa197 (§0).
- Speed: ~21 hours for 20 chapters because the gate flags true-but-unevidenced era facts and
  regenerates. Levers named, deferred.

### 8. Features never exercised
Rewrite-from-Manuscript (`handleRewriteSelected` / `handleRewriteAll`) end-to-end; the full KDP
package (copyright page, cover, metadata, bibliography) — every "publish-ready" verdict so far was
body only; scene acceptance gate OFF by default; ROUTERHEAL-2 half-landed; LLAMAHEAL-1; searxng at
~17 s/query; the `tests/` suite red at the tip.

### 9. The run is trapped in a browser tab
`draftChapter` lives inside `ProjectStudio.jsx` (lines ~3842–4817, ~975 lines of UI-bound
orchestration). No resume, no supervisor, Chrome-driven exports don't land downloads, a locked Mac
stalls a landing. HEADLESS-1 is the prerequisite for the Control Room Agent, any n8n watchdog, and
unattended long runs.

### 10. The model
The local 35B ignores explicit bans on its strongest habits, declines the harder subject repairs (65
of 290 left), and returns simile-bearing rewrites. Cannot be judged until issues 1–2 stop adding
noise to its output.

## 3. THE BUILD ORDER (see claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md)
1. Close the proven fabrication hole first (NFCLASS-2 + SERIESHYGIENE-1 + NFCLASS-6 one-authority).
2. Regenerate lane + retire the last word-level mutations + polish stage inventory.
3. Per-chapter state contract + bible gate + scene-dup + resolved arcs + gate promotion.
4. Style families / fragment budget with deterministic backstops.
5. Nonfiction: per-story closed world, TEMPORAL-1, bible name-gate, required Sources, ARCH-2.
6. Exercise the untested surfaces; scene gate ON after proof; ROUTERHEAL-2 land-or-delete.
7. HEADLESS-1 (orchestrator extraction → CLI runner → checkpoint/resume), then speed levers.
8. Data hygiene, then the two-book FINAL ACCEPTANCE run. Model decision last.

## 4. PROCESS COST (not app bugs, but why each fix costs a day)
Antigravity force-pushed four times against a ban and weakened a battery once; the two branches
diverged by 25 commits before RECONCILE-1; regex escapes were lost through a Python heredoc;
attachments arrive empty. The verify-at-pinned-SHA discipline caught every one of these. It stays.
