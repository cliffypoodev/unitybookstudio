# UBS Arc E (GATEPROMOTE-1) — live proof, 2026-08-25

Written by Cowork Claude (verifier). Claude Code reads this ONLY when handed the paste below.
Repo: ~/Downloads/UBS. HEAD = origin/main = origin/agent/narrative-connect-1 = **e31a60c3**.
Commits since fdc964f8 (5): a4326fe7 PRONOUNLOCK-2B-IT-ITS-DECLARATION, a0336940 REGENLANE-1B-ZERO-TARGET-TELEMETRY,
73436176 GATEPROMOTE-1-CONTINUITY-BREAKS-BLOCK-EXPORT, 2f7ad69e GATEPROMOTE-1-ACCEPTANCE-BATTERY,
e31a60c3 GATEPROMOTE-1-RETIRE-LIVEEXPORT-REPORT-SHAPE-ASSERTIONS. Porcelain tracked: 0.

## Verdict: PASS for Arc E as specified — with one pre-existing export-path defect surfaced (finding 19) that
## the plan must own before any book is called "export-clean".

## What I verified on the Mac (offline, repo's own modules, stored prose from _FileStore)
- `test/gatepromote1.acceptance.mjs`: 10/10 PASS. `tests/liveExportSafetyRegression.mjs`: 58/58.
  researchAgent / llmProsePolisher reds: untouched byte-for-byte (`git diff --stat fdc964f8..HEAD` on them = empty).
  Acceptance files: 130 = 129 green + 1 quarantined (arithmetic holds).
- Code (73436176) matches the kickoff exactly: `isFictionProject` imported from projectType.js (no new
  book_type literal); DEPARTED_CHARACTER_ACTIVE / DUPLICATE_INTRODUCTION → hardFailures with
  `recommendedAction: 'REJECT_REGENERATE'` + `code`; role drift stays warning; MALFORMEDSENT-1 routes to
  hardFailures only when `isFictionProject(project) && MALFORMEDSENT_HARD_BLOCK`, constant = false.
- `runPreExportSafetyGate` over REDUX's 20 stored chapters at e31a60c3: **blocked: true, hardFailures 1 =
  Ch.5 "glued word … itIs", warnings 44, GATEPROMOTE promotions 0, INTRODUP 0, MALFORMEDSENT 10,
  PRONOUNLOCK canon 11 (2 unresolved, 1 context-variable)** — IDENTICAL to the fdc964f8 numbers in the
  kickoff. Exactly the expectation.
- NF books (Juneteenth 6a00e8ce…, 20 ch; The Molasses File msh4ov9f…, 4 ch): **0 promotions** on both;
  blocks (Juneteenth ch.8/9/11) are pre-existing NF hard gates (unclosed dialogue, terminal punctuation).
- Positive control on real fiction data (the books this plan exists for):
  * Original "Lipstick & Lug Nuts" (69d690a8…): **28 promotions** → hardFailures 31 (was 3). Zin departed
    ch.4 (beat-declared) / ch.7, acting ch.5–20; JB departed ch.9, acting ch.10–19; Thompson; Lark.
    Role drift Ch.3 ("leader" → Thompson, canon Roderick) and Ch.16 stay warnings. 
  * "False North" (69d95aed…): **28 promotions** (Margot departed ch.8 acting through ch.25; Declan).
  So the promotion path fires on real resurrections and is silent on the REDUX book drafted under Arcs A–D.

## Live run in Chrome (tab 1618983822, REDUX, Vite ?t=1787620448854 after Cmd+Shift+R)
Publish → Export → "Export options" → **Export DOCX** (this is the only caller of the pre-export gate,
ExportTab.jsx:821). Console, first-occurrence times 8:31:41–8:31:59 PM:
- `[SAFETY-GATE] stage=pre-export` ×20, every chapter `ok=true action=PASS malformed=0 dialogue=0`.
- `[BOOKGATE-2] chapter=5 quotes=127/127 unbalancedParas=0 glued=0 unterminated=0 pass=true`  ← see 19
- `[PRONOUNLOCK] Gate scan: canon for 11 character(s), 2 unresolved, 1 context-variable`
- `[INTRODUP] Gate scan: 0 duplicate self-introduction(s) across 20 chapter(s)`
- `[MALFORMEDSENT] Gate scan: 10 malformed sentence(s) across 20 chapter(s)`  (warning, constant false)
- `[STYLEBUDGET] Gate telemetry: 4 exhausted famil(ies), book simile density 3.44/1k`
- `[GATEPROMOTE]` lines: **0**. `[CHARSTATE]` lines in the gate: **0** (only violations log).
- `[EXPORT] Safety gate warnings (export proceeding): Array(44)` → `[EXPORT] Final snapshot ready` →
  `[EXPORT] Resolved chapters: 20 Total markdown chars: 461890`. **The export was NOT blocked**; a DOCX was
  handed to the browser's download (ExportTab.jsx:1380–1384 anchor.download). Expected per the kickoff was
  `blocked: true` from Ch.5 only. GATEPROMOTE-1 is not the cause — see finding 19.

Everything Arc E owns matches offline: 44 warnings, 0 promotions, INTRODUP 0, MALFORMEDSENT 10, canon 11.

## Findings (numbering continues from the Arc D doc)
19. **Export path silently regex-edits prose BEFORE the gate, un-scoped, and this masks the gate.**
    `runExportTextSafetyNet` (ExportTab.jsx ~1845–1985) runs a 60-rule table on every book, then a
    "Final sniper repair for the remaining Songbird climax paragraph" (unconditional). Rule at 1873
    `(I know|I see|Is it|Do what|What|…)\1 → $1` ("duplicate short phrase") rewrites REDUX Ch.5's stored
    `“Is itIs it” Lark asked.` to `“Is it” Lark asked.` at export time, so the live gate sees glued=0 and
    exports, while the stored chapter (unchanged since 2026-08-15, still in the editor) keeps the defect
    and the offline gate blocks. ~30 of the 60 rules are one book's line edits by name ("manual line edit:
    Pauline Carter appositive", "Henderson appositive comma", "Davies appositive", "Hellman onstage comma",
    "capitalize Glass Menagerie title", "theatre name", "Marty comma/order repair") plus generic word-level
    mutations ("missing comma: sat took", "door opened it" → deletes a word, "It was. Preparation").
    EXPORTSCRUB-1 already scoped four rule families behind `project.legacy_export_rules` (exportRuleScope.js)
    but this table and the sniper line were not scoped. Consequences: (a) rule 0 "prose is never
    regex-edited" is violated on the export stage; (b) the DOCX differs from what the author sees and what the
    Proofreader will read; (c) the gate's verdict is on text nobody stored. Generic fix = **EXPORTSCRUB-2**:
    move every manuscript-named rule behind a named `legacy_export_rules` key; delete word-level rules
    (the gate + REGENLANE own those defects now); keep only typographic normalisation (quote/apostrophe
    spacing, smart quotes) and run the gate on the STORED text, or run typographic cleanup after the gate.
    Battery: same stored text → live gate result === offline gate result; a book with no
    legacy_export_rules gets zero word changes at export (`changes.length === 0`). Not Arc E's code; it
    predates the plan. Recommend landing it as E4 before Arc F because Cliff's rule is "no
    manuscript-specific code", and the live-proof expectation for every later arc depends on the gate
    seeing real prose.
20. Telemetry: `[GATEPROMOTE]` and `[CHARSTATE]` in the gate are silent at zero (same class as finding 17).
    The 73436176 commit message says the line "marks the promotion path even when it fires 0 times" — it
    does not; there is no summary line. Add `[GATEPROMOTE] Gate scan: N promotion(s) across M chapter(s)`
    and `[CHARSTATE] Gate scan: N violation(s)` next to the other Gate scan lines. Tiny; fold into E4.
21. Promotion amplifies departure-detector false positives on legacy books (not REDUX). In the original
    L&LN: Ch.2 `"Mr. Thompson was gone. The counter was empty."` (a shopkeeper leaving a window) →
    Thompson "departed the crew" → hard blocks in ch.2/13/14; Ch.17 `"Lark walked away, muttering about
    rivets"` → hard blocks ch.18–20. Real resurrections (JB ch.9→ch.10–19, Zin, Margot/Declan in False
    North) are correctly caught. Since a single false departure now blocks every later chapter, propose
    **CHARSTATE-3** (later arc, generic): departure must be corroborated — the name is absent from the
    next chapter's prose OR a beat declares it — before it becomes a hard block, and the hard-failure
    message must quote the triggering sentence + chapter so the author can see why. Battery: the two
    sentence shapes above with fixture names (Mara/Dov/Ilse) → warning not block; a corroborated departure
    → block. Not an Arc E STOP: REDUX is clean, behaviour matches the spec as written.
22. Data, for the Proofreader / Cliff, not code: REDUX Ch.5 "Is itIs it" is still the only stored hard
    block; MALFORMEDSENT-1 10 sentences across 6 chapters unchanged; PRONOUNLOCK 2 unresolved characters.

## What Arc E proved
Resurrections and duplicate cross-chapter introductions hard-block fiction export (28 promotions on each
of two real broken books, 0 on the REDUX book and 0 on two NF books); role drift and MALFORMEDSENT-1 stay
warnings; isFictionProject is the only classifier; the battery arithmetic holds at 129 green + 1
quarantined; liveExportSafetyRegression 58/58 with the unrelated reds untouched. Findings 13 and 17 landed.

---
# Run 2 — after EXPORTSCRUB-2 (E4), 2026-08-25 ~9:03 PM
HEAD = origin/main = origin/agent/narrative-connect-1 = **7f2c7d2a**. Commits since e31a60c3 (2):
97b54a69 EXPORTSCRUB-2-SCOPE-EXPORT-TEXT-RULES (ExportTab.jsx −177/+97, exportSafetyGate.js +12),
7f2c7d2a EXPORTSCRUB-2-ACCEPTANCE-BATTERY (test/exportscrub2.acceptance.mjs, 17 checks). Porcelain tracked 0.
Acceptance files 131 = 130 green + 1 quarantined.

## Verdict: PASS. Findings 19 and 20 closed. Arc E is done.

## Verified on the Mac
- `runPreExportSafetyGate(resolved, …)` at ExportTab.jsx:826 — the gate now sees the STORED chapters;
  `cleaned` is no longer what it judges. `runExportTextSafetyNet` default path = `closeOddDoubleQuoteParagraphs`
  + apostrophe/quote spacing (4 typographic rules) + normalizeDocxMarkdown; every manuscript-named rule
  (Pauline/Marty/Hellman/Davies/Henderson/Glass Menagerie, the climax "sniper" line, repairManuscriptArtifacts)
  sits inside `if (exportRuleEnabled(project, 'songbird'))`; the generic word-level rules (duplicate-phrase
  masking incl. the `(Is it)\1` rule, comma insertions, "opened it" deletions, "he said X" tic paraphrases)
  are deleted. exportSafetyGate.js: `[CHARSTATE] Gate scan: N violation(s)` and
  `[GATEPROMOTE] Gate scan: N promotion(s) across M chapter(s)` log at zero.
- `test/exportscrub2.acceptance.mjs`: 17/17 PASS (incl. #15 counterfactual: old cleaned-text gating would
  now agree because cleanup no longer masks; #16/#17 zero-count lines).
- Offline gate on REDUX at 7f2c7d2a: blocked true, hardFailures 1 (Ch.5 itIs), warnings 44, promotions 0,
  INTRODUP 0, MALFORMEDSENT 10, canon 11 — unchanged from e31a60c3/fdc964f8.

## Live in Chrome (Vite ?t=1787622773390 after Cmd+Shift+R; Publish → Export → Export options → Export DOCX)
- `[BOOKGATE-2] chapter=5 quotes=127/127 unbalancedParas=0 glued=1 unterminated=0 pass=false`  (Run 1: glued=0)
- `[PRONOUNLOCK] Gate scan: canon for 11 character(s), 2 unresolved, 1 context-variable`
- `[INTRODUP] Gate scan: 0 …` · `[MALFORMEDSENT] Gate scan: 10 …` · `[CHARSTATE] Gate scan: 0 violation(s)`
- `[GATEPROMOTE] Gate scan: 0 promotion(s) across 20 chapter(s)`
- `[EXPORT] Final export snapshot failed: ExportHardBlockError: ⛔ MANUSCRIPT SAFETY GATE — EXPORT BLOCKED /
  Chapter 5: The Engine's Strange Glow / Action: REJECT_MANUAL_REVIEW / 1 glued word(s) from collapsed
  dialogue: itIs - hard blocker` → native alert "EXPORT BLOCKED … No file was produced." **No DOCX downloaded.**
Live verdict === offline verdict on the same stored text. This is the property every later live proof relies on.

## Observations (not STOPs)
23. `normalizeDocxMarkdown` (export-only, after the gate) still carries two word-level edits —
    `"(\d:\d\d [ap].m.) When" → "$1, when"` and stripping a `[The following account is a composite…]`
    bracket — and `closeOddDoubleQuoteParagraphs` appends a closing quote to any paragraph with an
    unmatched open. Harmless now (the gate has already judged the stored text and unclosed dialogue is a
    hard block upstream), but they are still prose edits in the export stage; fold into Arc J hygiene.
24. The hard-block error text advertises `window.ALLOW_UNSAFE_EXPORT = true` as an override. Fine for an
    author's console, but HEADLESS-1 (Arc I) must not honour it, and any use should log `[EXPORT] UNSAFE
    OVERRIDE` so a "clean export" claim can be audited.
25. Still open from Run 1: finding 21 CHARSTATE-3 (departure-detector precision + quote the trigger sentence)
    — scheduled, not Arc F. Finding 22 data items unchanged (Ch.5 itIs is the only stored hard block).
