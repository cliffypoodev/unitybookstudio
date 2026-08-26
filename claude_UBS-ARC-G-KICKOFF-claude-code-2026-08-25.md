# ARC G KICKOFF — paste into a FRESH `claude` session in ~/Downloads/UBS
Written by Claude (Cowork) 2026-08-25 after closing Arc F (code PASS on Run 3):
HEAD = origin/main = origin/agent/narrative-connect-1 = `414c9509`, branch `main`, at time of writing.

---

You're working in ~/Downloads/UBS on the Unity Book Studio repo. Read these FOUR files in full before
anything else — repo root, untracked on purpose, never delete or git-clean them:

1. claude_UBS-issue-breakdown-2026-08-24.md
2. claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md — Section 0 "Rules of the Road" governs
   everything. Follow it exactly. Do not skip, combine, or "improve adjacent code." Section 8 is Arc G.
3. claude_UBS-LIVEPROOF-ARC-E-2026-08-25.md — how the export gate is proven (offline === live on stored text).
4. claude_UBS-LIVEPROOF-ARC-F-2026-08-25.md — the lane's verifier contract after REGENLANE-1C/1D (G6 extends it).

Other untracked things you'll see and must not touch: `.claude/`, `proofreader/`, every other `claude_*.md`.
`git status --porcelain` shows ~15 lines, all `??`. "porcelain 0" in the plan means ZERO TRACKED changes.

## Where the repo actually is (supersedes the plan's stated numbers)

Landed: PREFLIGHT-1, Arcs A–E, Arc F (STYLEBUDGET-3/3B, STYLEBUDGET-2C, FRAGBUDGET-1, NAMEREG-2, REGENLANE-1C/1D,
POLISHSAFE-5, PROSE-GUARD-1, UNDO-1, VERSIONS-1/1B/1C). Verify before touching anything; STOP if any line disagrees:

```
cd ~/Downloads/UBS && git fetch origin
git rev-parse --short HEAD                              # 414c9509
git rev-parse --short origin/main                       # 414c9509
git rev-parse --short origin/agent/narrative-connect-1  # 414c9509   (one ref per line)
git branch --show-current                               # main
git status --porcelain | grep -v '^??' | wc -l          # 0
ls test/*.acceptance.mjs | wc -l                        # 138  (137 green + 1 quarantined)
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1
   # 137 green, 0 red, 1 quarantined. Record the exact green count and checks — your baseline.
```

Battery arithmetic (rule 0.4): Arc G adds exactly FIVE battery files — `test/nfanthcw1.acceptance.mjs`,
`test/nfexportbib1.acceptance.mjs`, `test/bibleguardnames1.acceptance.mjs`, `test/temporal1.acceptance.mjs`,
`test/arch2.acceptance.mjs` → baseline + 5 = **142 green, 1 quarantined**; G6 adds checks to the existing
`test/regenlane1.acceptance.mjs` (21 checks today; name the additions in the commit). Checks strictly > baseline.
The only existing expectation Arc G retires: regenlane1's "nonfiction → nf-skip" contract (G6) — name it.

Wave-era baseline: `test:narrative-connect` EXIT 0 (23/23); `test:polish-pipeline` 19/20, reds exactly
`tests/researchAgentBehaviorRegression.test.mjs` and `tests/llmProsePolisher.test.mjs`, byte-for-byte unchanged
at the end (`git diff --stat 414c9509..HEAD` on them empty). `npm run build` must pass.

## DISCOVERY corrections (re-verified live 2026-08-25 at 414c9509)

- Classification: `src/lib/projectType.js` `isNonfictionProject` 94 / `isFictionProject` 101 are the only
  fiction/NF authority. `isAnthologyProject` is `src/lib/anthologyEngine.js:661`; `isNonfictionAnthology`
  is **`anthologyEngine.js:166`** (anthology && the NF authority) — import it from there, do not write a new one.
- G1: `getProjectResearchText(project, chapter)` is `sceneWriter.js:2059` (plan said 2051): `resolved` at
  2062, `relevant = getRelevantResearch(resolved, chapterNumber, beatText)` 2077 (imported from
  `@/lib/fictionResearch`), `combined` 2079, the ARCH2-4a `excludeForeignQuotes` block 2083–2091 (fail-open),
  `return combined` 2092. `buildSourceAudit(relevantResearch = '', project = {})` is **1124** (plan: 1116), called
  at 1154 and 5063 (`sourceAudit: isNF ? buildSourceAudit(relevantResearch, project) : null`). `excludeForeignQuotes`
  is `quoteLedger.js:80` (matches). `src/lib/storyEntityOwnership.js` does not exist — you create it.
- G2: `isBackMatter(ch)` is `bibliographyGenerator.js:57` — a TITLE test (bibliography|sources|works cited|
  references|appendix…). The `< 4` floor is at **500** (`result.entryCount < 4` → throw). `generateBibliography`
  489, `saveBibliographyChapter` 518; `buildClosedWorldBibliography(project)` is `closedWorldBibliography.js:59`
  and returns `{ text, entryCount, … }`. `exportSafetyGate.js` imports NO project-type function today and has
  no NF-specific block — you add `isNonfictionProject` (GATEPROMOTE-1 already imports `isFictionProject` at 92).
  **Live fact that changes the design:** the flagship (Juneteenth, 21 chapters) already has a chapter 21 titled
  "Bibliography & Sources" that `isBackMatter` accepts — and its content is 21,287 chars of a *different book's*
  fiction (a dressing-room scene, inline `content_md`, saved 2026-07-11). A title test is not a Sources section.
  NFEXPORT-BIB-1 must test the SHAPE: a back-matter chapter whose body has ≥ 4 bibliography entries (lines that
  look like entries: a leading bullet/number, or an author/title/year/URL pattern — export the entry regex and
  reuse it in the battery). `buildClosedWorldBibliography` on the flagship returns entryCount **83**, so the
  Bibliography button will not throw; on The Molasses File (4 ch) 23.
- G3: the deterministic guard is `parallelBibleGenerator.js:863–884` (`if (!isFiction)` → `normQ`,
  `researchNorm = normQ(getResearchText(settings))`, `QUOTE_RE`, `stripUnverifiedQuotes` over worldMd /
  charactersMd / voiceMd / canonMd / mysteryMd / outlineMd / chapter titles+beat_summary; log
  `[BIBLE-GUARD] unverified quote stripped`). `isFiction = !isNonfictionSettings(settings)` at 67/295, which
  delegates to the projectType authority (16, 45) — keep that. `closedWorldCheck(prose, project)` is
  `sceneWriter.js:3147` (plan: ~3075): `normCW` at 3150, evidence `EV` from `research_data + research_md +
  seed_concept` at 3162, `inEV(raw)` 3169 with the plural/singular fallback. Extract `normCW`/`inEV` into an
  exported helper (`src/lib/closedWorldText.js`, both call sites use it) rather than duplicating.
- G4: `research_data` is a JSON STRING on the project (parse it). Live shape (flagship):
  `timeline: [{ date, event }]` ×46 (45 with a year; dates like "January 1, 1863", "June 19, 1865", "1915"),
  `key_events: [{ event, date, description, sources }]` ×32, plus key_figures/institutions/primary_sources/
  competing_narratives/key_documents. The existing closed-world strip machinery is `src/lib/nfContentGuard.js`:
  `buildFactLedger(project)` 170 (returns `{ ok, clockTimes, figures }`), `checkClockTimeViolations` 263,
  `checkFateViolations` 301, `stripFactLedgerViolations` 356 (the `{ snippet }` sentence strip — reuse it),
  `buildFactLedgerPromptBlock` 378; wired in `sceneWriter.js` 302 (prompt block) and 2551 (draft-time strip);
  export-time hard block is the `[FATE-GATE]` block in `exportSafetyGate.js` (~160–184, log at 176) — extend the same ledger with
  `events: [{ name, date: {y,m,d}, norm }]` from timeline ∪ key_events. Flagship prose today: 18 relative-time
  sentences ("nearly two years later", "nearly three years earlier" — both in Ch.1, about the same gap
  Jan-1863 → Jun-1865 = 2 y 5½ m). Precision over recall (§0): a contradiction is a WRONG ORDER, or a gap off by
  more than max(1 unit, 25 % of the actual gap). Under that rule neither Ch.1 sentence is a contradiction; the
  battery fixture supplies the positives. Log `[TEMPORAL-1] Ch.N: R relative-time claim(s), C checkable, K
  contradiction(s)` at zero too.
- G5: the extractor is `executeResearchPipeline` in `src/pages/ProjectStudio.jsx:2712`: pages fetched via
  `bridgeFetch` (2697/2752), batches extracted at ~2896–2945 (the per-batch prompt lists `[i] title / URL / body`
  and the LLM returns `partial`), `mergeBucket(bucket, arr)` at **2871** merges into `merged[bucket]` with
  `dedupeKeyFor`; RESEARCH-INTEGRITY quote checks 2988–3030 already blank quotes not found verbatim. ARCH-2 is the
  same idea for every atom: put `verifyExtractedAtoms(partial, batchPages)` in a NEW `src/lib/researchAtomGuard.js`
  (testable without React) and call it before `mergeBucket` — an item is kept only if its atoms (each proper-noun
  phrase of the name/event/institution, each year or month-year, each standalone number) substring-match the
  normalized text of the batch's pages (same `normCW`); a failed item is dropped and logged
  `[ARCH-2] dropped unsupported atom: <bucket> "<atom>"`; keep a per-batch count next to the existing
  extraction summary log. Items whose source says UNVERIFIED are still atoms — verify them or drop them.
- G6: `regenerateLane.js:407–408` `if (isNonfictionProject(project)) return { …, skipped: [{ reason: 'nf-skip' }] }`;
  verifier checks are (1)…(9) plus REGENLANE-1C/1D's `defect-remains`, `typography`, `new-number`, `new-proper-noun`
  (cast-aware) — add (10) `closed-world`: for NF projects, `closedWorldCheck(candidate, project)` (the shared
  helper from G3) must return NO violation the original did not already have. `REGENLANE_VERSION` is
  `'regen-lane-v1'` at line 33 → `'regen-lane-v2'`. The runner's lane block is fiction-gated at
  `manuscriptPolishRunner.js:956` (`mode !== 'nonfiction' && !isAnthology`) and the STYLEBUDGET-2 loop at ~880;
  open the LANE (not the simile recasts) to NF through the projectType authority — do not add a `mode` string test.
- Live NF numbers (offline, stored prose, 414c9509): flagship export gate blocked by pre-existing NF hard entries
  Ch.8/Ch.9 "unclosed dialogue", Ch.11 malformed + terminal punctuation; MALFORMEDSENT 70; GATEPROMOTE 0;
  fact ledger clockTimes 1, figures 43. Molasses File: not blocked, MALFORMEDSENT 2. No NF anthology in the
  library has drafted content, so G1's live proof is battery + an offline fence run over a fixture; the
  flagship carries the live proof for G2/G4/G6.

## Arc G = §8 as written, with the contracts pinned down (fixtures Mara / Dov / Ilse, Port Ellis / Dr. Hale / Dr. Vance only)

### G1. NFANTH-CW-1 — `src/lib/storyEntityOwnership.js` (new)
`buildStoryEntityOwnership(project, chapters)` → `{ byStory: { [chapterNumber]: Set<norm> }, byEntity: { [norm]: Set<chapterNumber> } }`
from each story's title + beat_summary + scene goals (parse `scene_beats_json` if present): proper-noun phrases
(1–3 capitalised tokens, minus sentence-initial stopwords), 4-digit years, month-year dates; normalise with the
shared `normCW`. `fenceForeignEntities(researchText, ownership, chapterNumber)` → `{ text, fenced: [{ paragraph, entities }] }`:
a research PARAGRAPH is replaced by `[evidence belonging to Story <k> — not available to this story]` when it
mentions ≥ 1 entity owned by other stories and NONE owned by story N; an entity owned by ≥ 2 stories is never
foreign. Wire in `getProjectResearchText` when `isNonfictionAnthology(project)`: fence `resolved` and `relevant`
BEFORE they are joined (2079); give `buildSourceAudit` a `chapter` parameter and fence its haystack the same way
(both call sites). Telemetry `[NFANTH-CW] ch<N>: fenced P paragraph(s) (<entities…>)` and a zero line.
Non-anthology NF and fiction: byte-identical research text (battery proves it).

### G2. NFEXPORT-BIB-1 — `exportSafetyGate.js`
Import `isNonfictionProject`. For NF: find chapters where `isBackMatter(ch)` AND `countBibliographyEntries(text) >= 4`
(export `BIB_ENTRY_RX` + `countBibliographyEntries` from bibliographyGenerator.js; ≥ 4 mirrors the 500 floor). None →
push `{ reasons: ['NFEXPORT-BIB-1: no Sources section (a back-matter chapter with ≥ 4 bibliography entries)'] }` to
`warnings`, or to `hardFailures` with `recommendedAction: 'REJECT_MANUAL_REVIEW'` when
`NF_BIBLIOGRAPHY_HARD_BLOCK` (new exported constant in bibliographyGenerator.js, **false**) is true. A back-matter
chapter that fails the shape test is ALSO named: `NFEXPORT-BIB-1: "<title>" is titled as Sources but has N entries`.
Log `[NFEXPORT-BIB-1] Gate scan: sources=<yes|no> entries=<n>` at zero too. Fiction untouched.

### G3. BIBLEGUARD-NAMES-1 — `parallelBibleGenerator.js` (NF branch, next to stripUnverifiedQuotes)
Every proper-noun phrase (1–3 capitalised tokens, not sentence-initial stopwords, not a field label) in a generated
field must pass `inEV` against the research text; a violation throws `new Error('BIBLEGUARD-NAMES-1: "<noun>" in
<field> is not in the research')` so the existing catch shows the "nothing was saved" toast naming the noun. Log
`[BIBLE-GUARD] names: <field> checked N noun(s), 0 unsupported` at zero. Fiction untouched (no research to check).

### G4. TEMPORAL-1 — `src/lib/nfContentGuard.js` + gate
`buildFactLedger` gains `events` (timeline ∪ key_events with a parseable date; `parseLedgerDate("June 19, 1865" | "1915" | "March 1919")`
→ `{y,m,d}` with the precision it has). `checkTemporalViolations(text, ledger)` → `[{ snippet, claim, eventA, eventB,
actual, reason }]` for sentences matching `RELATIVE_TIME_RX` (`(\d+|two|…|twelve|several|nearly \w+)\s+(days?|weeks?|months?|years?)\s+(after|before|later|earlier)`
and `the (next|following) (day|morning|week|month|year)`) that name two ledger events (normalised substring match
of the event's name, ≥ 2 content words); compute order and gap at the coarser precision of the two dates;
contradiction = wrong order, or |claimed − actual| > max(1 unit, 0.25 × actual). Draft time: add to
`stripFactLedgerViolations` (same `{ snippet }` strip, `[TEMPORAL-1] stripped: …`). Export: a hard entry per
chapter with the sentence named, `recommendedAction: 'REJECT_REGENERATE'`, next to `[FATE-GATE]`. Prompt:
`buildFactLedgerPromptBlock` lists the dated events (cap 40) so the writer has the dates. Precision first — an
event name that matches more than one ledger entry with different dates is NOT checkable (count it, skip it).

### G5. ARCH-2 — `src/lib/researchAtomGuard.js` (new) + `executeResearchPipeline`
`extractAtoms(item, bucket)` (name/event/institution phrases, years, month-years, standalone numbers ≥ 2 digits);
`verifyExtractedAtoms(partial, pages)` → `{ kept: partial', dropped: [{ bucket, atom, item }] }` using `normCW`
over the batch pages' `content || snippet`. Call it right before the `mergeBucket` calls (~2942); log each drop and
a per-batch `[ARCH-2] batch b: kept K item(s), dropped D unsupported atom(s)`. `timeline`/`key_events` dates are
atoms too (a date not in any page is dropped). Battery on a fixture page + fixture `partial`.

### G6. REGENLANE-2 — NF closed-world verifier
Remove the `nf-skip` return (407–408); verifier check (10) as above; the runner's lane block runs for NF through
`isNonfictionProject`; `REGENLANE_VERSION = 'regen-lane-v2'`. Battery: regenlane1 gains ≥ 3 checks (NF paragraph with
a candidate that introduces an un-evidenced proper noun → `closed-world`; a candidate that only fixes the defect →
accepted; the old `nf-skip` expectation retired by name). Fiction behaviour byte-identical (rescan + verdicts).

### Batteries (rule 0.4, each ≥ the count stated, fixtures only)
`nfanthcw1` ≥ 10 (plan list + "buildSourceAudit haystack fenced" + zero-telemetry line); `nfexportbib1` ≥ 6
(no back matter → warning; titled-but-empty back matter → warning naming it with N entries; ≥ 4 entries → clean;
constant true → hardFailures with REJECT_MANUAL_REVIEW; fiction → nothing; zero line); `bibleguardnames1` ≥ 6
(supported noun passes; unsupported throws naming noun+field; plural/singular fallback; field labels ignored;
fiction skipped; zero line); `temporal1` ≥ 8 (parseLedgerDate three precisions; wrong order flagged; gap within
tolerance passes; gap 3× flagged; ambiguous event name skipped-but-counted; strip removes only the sentence;
gate hard entry names the sentence; zero line); `arch2` ≥ 8 (supported item kept; unsupported name dropped;
unsupported year dropped; number atom; UNVERIFIED item still verified; per-batch log; nothing else in `partial`
mutated; empty pages → everything dropped and logged).

### Commits, in order
`NFANTH-CW-1-STORY-ENTITY-FENCE` + `-ACCEPTANCE-BATTERY`; `NFEXPORT-BIB-1-SOURCES-SHAPE-GATE` + battery;
`BIBLEGUARD-NAMES-1-PROPER-NOUNS-IN-RESEARCH` + battery; `TEMPORAL-1-RELATIVE-TIME-LEDGER` + battery;
`ARCH-2-EXTRACTOR-CLOSED-WORLD` + battery; `REGENLANE-2-NF-CLOSED-WORLD-VERIFIER` (+ regenlane1 additions named).

## VERIFY (paste raw output; do not summarise)
```
cd ~/Downloads/UBS
git status --porcelain | grep -v '^??' | wc -l                       # 0
git log --oneline 414c9509..HEAD                                     # the commits above, exact names
for f in nfanthcw1 nfexportbib1 bibleguardnames1 temporal1 arch2 regenlane1; do NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" node test/$f.acceptance.mjs | tail -1; done
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1           # 142 green, 0 red, 1 quarantined; checks > baseline
NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" npm run -s test:narrative-connect 2>&1 | tail -2
git diff --stat 414c9509..HEAD -- tests/researchAgentBehaviorRegression.test.mjs tests/llmProsePolisher.test.mjs   # empty
npm run build 2>&1 | tail -1
git push origin main && git push origin main:agent/narrative-connect-1
git rev-parse --short origin/main; git rev-parse --short origin/agent/narrative-connect-1
```

## LIVE PROOF — NOT yours. Cowork Claude runs it in Cliff's Chrome after VERIFY passes
Flagship (Juneteenth): (1) offline export gate before/after — expect `[NFEXPORT-BIB-1] Gate scan: sources=no`
naming chapter 21 with 0 entries, `[TEMPORAL-1] Ch.N: …` lines on all 21 chapters (K = 0 expected under the
tolerance rule), no fiction-only line; (2) the Bibliography button → a real Sources chapter (≥ 4 entries, 83
available) replacing the contaminated chapter 21 through the app's save path; gate re-run → `sources=yes`;
(3) Fix Manuscript (NF) → `[REGENLANE] Ch.N` lines with `closed-world` rejections visible, PROSE-GUARD letters
changed only by the lane; (4) Export → still blocked by the pre-existing Ch.8/9/11 entries, nothing new.
G1: offline fence run over a fixture anthology + the battery. When VERIFY passes, stop and say:
"Arc G VERIFY passed at <sha> — ready for the live proof." Do not start Arc H.

## STOP conditions (plan §13, unchanged)
A DISCOVERY line disagrees; any existing battery goes red (other than the named regenlane1 retirement);
run-all ≠ 142/0/1; the build fails; a regex that CHANGES prose (strips of whole sentences by the existing
`{ snippet }` machinery are the one sanctioned NF mechanism — nothing finer); a real title, pen name, character
or place name inside code or a test; a second LLM call in flight. Paste the raw output and stop.
