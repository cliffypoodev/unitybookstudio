# UBS Arc G (NONFICTION closed world) — live proof, 2026-08-25

Written by Cowork Claude (verifier). Claude Code reads this ONLY when handed the paste below.
Repo: ~/Downloads/UBS. Local HEAD **9c0505a5** (12 commits 8ce3b367…9c0505a5); origin/main and
origin/agent/narrative-connect-1 were still 414c9509 when this was written — the push was blocked by the
auto-mode classifier and Cliff told Claude Code "push it"; re-check before Arc H. Porcelain tracked 0.
143 acceptance files = 142 green + 1 quarantined; on the Mac: nfanthcw1 22, nfexportbib1 15, bibleguardnames1 12,
temporal1 17, arch2 13, regenlane1 25, regenlane1c 28, gatepromote1 10 — all PASS; reds untouched.

## Verdict: PASS for G2/G4 live and for every battery; G6 (the NF lane) is a STOP-lite — its verified
## rewrites are undone at save by NFGUARD-1, so the NF lane is a no-op today. One generic fix (REGENLANE-2B).
## G1/G3/G5 have no live surface without a research or bible run — proven by battery + offline fixtures only.

## Flagship (Juneteenth, 6a00e8ce…, 21 chapters) — Chrome tab, Vite ?t=1787668450772
1. Export gate BEFORE (Publish → Export → Export DOCX, 9:58 AM): `[NFEXPORT-BIB-1] Gate scan: sources=no entries=0`
   (chapter 21 "Bibliography & Sources" = another book's fiction, 0 entries); `[TEMPORAL-1] Ch.N: R claim(s), 0
   checkable, 0 contradiction(s)` on all 21 chapters (18 claims book-wide, none name two ledger events — as the
   kickoff predicted); MALFORMEDSENT 73; GATEPROMOTE 0; blocked by the pre-existing Ch.8/Ch.9 unclosed dialogue and
   Ch.11 malformed/terminal-punctuation entries → "EXPORT BLOCKED", no file. Offline gate at 9c0505a5 agrees
   (blocked 3, warnings 41→42 = the NFEXPORT-BIB-1 warning).
2. Plan → Foundation → **Bibliography** (10:01 AM): `[BIBLIOGRAPHY] Updated existing bibliography chapter` —
   chapter 21 replaced through the app's save path with a real closed-world Sources list: 12,062 chars,
   `countBibliographyEntries` = **43** (Library of Congress mesn16x items, URLs). The contaminated inline text is gone.
3. Export gate AFTER (10:02 AM): `[NFEXPORT-BIB-1] Gate scan: sources=yes entries=43`; still blocked by Ch.8/9/11
   only; no file produced.
4. Refine → Polish → Fix Entire Manuscript, `mode=nonfiction allowLLM=false`, 10:07–10:23 AM:
   `[REGENLANE] Ch.N` on all 20 body chapters — targets 4,12,10,6,2,10,…; **regenerated 5** (Ch.3,6,10,12,16);
   rejections: defect-remains, length-ratio (ratio logged, 1.7–19×), still-flagged, and `new-proper-noun`
   for Galveston / Confederate / Confederacy / Congress / Union / Library / Trans — all real, evidence-backed
   historical terms. Then `[NFGUARD-1] Ch.N: a polish pass changed prose content — REVERTED` on 18 chapters,
   and the saved diff is WHITESPACE ONLY (letters identical pre/post on every changed chapter; 9 chapters saved
   with collapsed double spaces). PROSE-GUARD (report mode) named the deterministic NF stages that change
   letters: "Nonfiction Core" (Ch.7, 8, 12, 16) and "Anti-Detection Polish" (16 chapters) — NFGUARD-1 caught them.
   NAME-HYGIENE flag-only; STRUCTURE-GUARD no reverts; no fiction-only line fired.

## Findings
42. **REGENLANE-2 vs NFGUARD-1 (STOP-lite).** `manuscriptPolishRunner.js:1386–1395` compares each NF chapter
    against its pre-polish snapshot with `nfContentEquivalent` and reverts the WHOLE chapter when anything but
    typography changed. The lane's verified rewrites (5 this run) are content changes → reverted. Fix
    REGENLANE-2B: the lane records its accepted replacements per chapter (`{ paragraphIndex, before, after }`);
    NFGUARD-1 reverts to the snapshot as today and then re-applies ONLY the lane's accepted replacements (each
    already closed-world-verified by check (10)), logging `[NFGUARD-1] Ch.N: kept K lane rewrite(s)`. Battery:
    an NF fixture where a deterministic stage changes letters AND the lane accepts one paragraph → the stage's
    change is reverted, the lane's survives, paragraph count unchanged.
43. **PROSE-GUARD inventory on NF:** "Nonfiction Core" and "Anti-Detection Polish" still change letters in
    nonfiction mode (on fiction they do not). NFGUARD-1 masks the damage but every run does the work twice.
    Arc J: make both flag-only on NF (POLISHSAFE-6) — PROSE-GUARD lines must then be lane-only, as on fiction.
44. **MALFORMEDSENT-1 agreement false positives on NF prose.** "Singular proper noun + were" fires on
    "The few Union forces that did attempt to operate in Texas were…" and on Ch.11's hard block "…celebrations
    that shaped Juneteenth in the postwar South were…" — the subject is a plural noun earlier in the clause.
    The lane then churns on these (defect-remains after every rewrite). MALFORMEDSENT-2: skip the agreement
    check when a plural common noun precedes the proper noun in the same clause; battery with fixtures.
45. **Closed-world check (4) is too strict for NF.** `new-proper-noun:Galveston` etc.: check (4) allows only the
    original paragraph's proper nouns; for NF a noun IN THE EVIDENCE is legitimate (that is what check (10) is
    for). REGENLANE-2B: for NF projects, (4) accepts a proper noun when `inEV` says it is in the research;
    fiction unchanged.
46. Nits: VERSIONS — `saveBibliographyChapter` writes through `Chapter.update` without recording
    `previous_content_md_url` (the contaminated version is now only in recovery backups; acceptable here, but
    the rule should hold everywhere: every content write records its predecessor). The bibliography flow ran the
    export gate on a stale chapter list (`sources=no` logged at 10:01:14 immediately after the update) — cosmetic.

## What Arc G proved live
A titled-but-fake Sources chapter no longer passes; the Bibliography button repairs it through the app; the gate
reports Sources and relative-time telemetry on every NF chapter; the NF lane runs with the closed-world verifier
refusing un-evidenced atoms; NFGUARD-1 holds the line against the remaining deterministic NF mutators.
Deferred/next: REGENLANE-2B (42, 45) + MALFORMEDSENT-2 (44) before Arc H; 43 to Arc J; ARCH-2 / BIBLEGUARD-NAMES-1 /
NFANTH-CW-1 get their live exercise in Arc H (a research run and a bible generation on a fixture-style NF project).

## Run 2 — after REGENLANE-2B + MALFORMEDSENT-2 (773f5aad) — 2026-08-25 11:52–12:00 local
Landing verified on the Mac first: HEAD = origin/main = origin/agent/narrative-connect-1 = 773f5aad; four commits
since 9c0505a5 (e27174ff, 62f9a147, df7d310a, 773f5aad); regenlane1 + malformedsent1 batteries ALL CHECKS MATCHED;
the two polish-pipeline reds untouched (0-line diff). Dev server served the new modules (fetch check: runner
`kept ${kept} lane rewrite`, lane `nfInEV`, malformedSentence `MALFORMEDSENT-2`).

Fix Entire Manuscript, nonfiction mode, 20 chapters, ~8 min (lane 11:52:58 → 12:00:40).
- Lane telemetry: 70 targets across 20 chapters, 10 regenerated (Ch.3:1, 7:1, 8:3, 9:1, 10:1, 12:1, 13:1, 16:1),
  60 rejected — length-ratio 17 (ratios up to 124.9 / 18.89 / 15.63: the polish model returns whole essays,
  finding 41), defect-remains ~22, new-proper-noun 15, new-number 2, still-flagged 2.
- `[NFGUARD-1] Ch.N: kept K lane rewrite(s)` fired for Ch.3 (1), 7 (1), 8 (2), 10 (1), 12 (1), 16 (1) = 7 kept.
  Ch.9 (1), Ch.13 (1) and one of Ch.8's three were NOT kept and nothing was logged for them (finding 48).
- Saved diff (current vs `previous_content_md_url` version — /tmp snapshots were lost with the device VM):
  exactly the six chapters with a kept line were saved at 17:00:40–44Z; each diff is ONLY the lane paragraph(s):
  Ch.3 "weight"→"lash", Ch.7 "weight"→"harsh realities", Ch.8 two paragraphs, Ch.10 "weight"→"brutal lash",
  Ch.12 "weight"→"burden", Ch.16 "weight of an oppressive system"→"harsh reality of an oppressive system that
  denied them basic human dignity". Letters change only inside lane paragraphs; paragraph counts unchanged.
  Finding 42 is CLOSED live.
- PROSE-GUARD inventory unchanged from Run 1 ("Nonfiction Core" Ch.7/8/12/16, "Anti-Detection Polish" 16
  chapters — finding 43, Arc J). The per-stage lines were emitted twice (11:52:50 and again 12:00:44) — see 51.
- MALFORMEDSENT-2 offline: `scanMalformedSentences` over all 20 chapters now reports 2 hits (Ch.10 bare-verb,
  Ch.18 dropped-subject) and no agreement hit — the Ch.2 "few Union forces … were" and Ch.11 "…postwar South
  were" FPs are gone from the lane's detector. Finding 44 CLOSED for the lane; see 50 for the duplicate regex.
- Offline export gate (fresh /tmp/w/gate.mjs): blocked=true, hardFailures 4 — Ch.8 and Ch.9 unclosed dialogue
  (data: WPA-narrative paragraphs with 1/2 and 0/1 quote marks), Ch.11 one unterminated paragraph (data),
  Ch.21 LENGTHGATE-1B (finding 49). CHARSTATE 0, GATEPROMOTE 0, INTRODUP 0, NFEXPORT-BIB-1 sources=yes
  entries=43, TEMPORAL-1 0 contradictions, STYLEBUDGET 0 exhausted families, simile density 0.18/1k.

### Findings (continued)
47. **The NF lane still rejects evidence-backed nouns — via check (4b), and the loosening in 45 was the wrong
    call.** Offline repro with the real project: `verifyRegeneratedParagraph(orig, cand, { project })` ACCEPTS a
    candidate that adds "Galveston" or "Union" (check (4) now passes them via inEV) but the same call with the
    runner's harvested cast list (`harvestCastNames` on NF prose yields Union, Confederate, Congress, Library,
    Galveston, American, Confederacy, Trans-Mississippi, Alabama, January …) REJECTS them at (4b) with the same
    `new-proper-noun:` reason. Two live rejections of "Texas" are not reproduced offline (Texas is neither in
    that list nor missing from evidence) — the reason string cannot say which check fired, so the log cannot
    settle it. Reconsidering: a style rewrite on nonfiction must not introduce ANY proper noun the paragraph did
    not have — "carried the weight of the past" rewritten to mention Galveston is a content addition that check
    (10) cannot catch (the atom is in the evidence) and that can be wrong in context (the Logan Stroud chapter is
    not about Galveston). Finding 45's loosening should be retired, explicitly, in favor of the strict rule.
    REGENLANE-2C: (a) check (4) for NF = candidate proper nouns ⊆ original paragraph's, evidence or not
    (fiction unchanged); the finding-45 battery expectation is retired by name in the commit and replaced with
    "NF candidate adding an evidence-backed noun absent from the original paragraph → rejected"; (b) reason
    strings distinguish the checks — `new-proper-noun:<tok>` for (4), `new-cast-name:<tok>` for (4b) — so the
    next live run can attribute every rejection.
48. **NFGUARD-1 re-apply silently drops a verified rewrite when an earlier deterministic stage touched the same
    paragraph.** The snapshot is taken at runner line 513, before "Nonfiction Core"/"Anti-Detection Polish" and
    the typography stages; the lane's `before` is the paragraph as it stood AFTER those stages, so the exact
    `split(before)` search in the reverted (pre-stage) text finds 0 occurrences and the loop skips — no log.
    Live: 3 of 10 verified rewrites lost (Ch.8 ×1, Ch.9, Ch.13; PROSE-GUARD shows Anti-Detection changed
    letters in Ch.3/8/13 before the lane — Ch.3's survived only because its paragraph was not the one touched).
    REGENLANE-2C(c): locate the target by `paragraphIndex` in the reverted text and accept it when
    `nfContentEquivalent(snapshotParagraph, before)` holds (typography-only drift), replacing the whole
    paragraph with `after`; keep the exact-once string match as the first attempt; when neither matches, log
    `[NFGUARD-1] Ch.N: dropped D lane rewrite(s) (span not found)` and push it to `changes`. Battery: a
    replacement whose `before` differs from the snapshot paragraph only by a double space / curly quote is still
    re-applied; a genuinely different paragraph is dropped AND logged; paragraph count unchanged.
49. **LENGTHGATE-1B blocks the bibliography.** exportSafetyGate.js ~151: the explicit target comes from
    `project.target_chapter_words` (4300 here) and is applied to every chapter, so the rebuilt Ch.21
    "Bibliography & Sources" (1109 words) is a hard export failure on every NF book that has both a length target
    and a Sources chapter — the NFEXPORT-BIB-1 requirement and LENGTHGATE-1B contradict each other.
    LENGTHGATE-1C: skip LENGTHGATE-1B (and the BOOKGATE-2 SHORT advisory) when `isBackMatter(ch)`; battery:
    a 900-word back-matter chapter under a 4000-word project target exports, a 900-word body chapter does not.
50. **A second "Singular proper noun + were" regex lives in manuscriptSafetyGate.js (~421–440) without the
    MALFORMEDSENT-2 clause-scoped plural guard.** It is warn-only inside that gate (strictMatches excludes it),
    but it still prints `[SAFETY-GATE:FAIL] chapter=11 type=malformed` on the Ch.11 FP and feeds the pre-polish
    `malformed=N` counts (Ch.2 shows 7 there vs 0 in the lane's detector). MALFORMEDSENT-3: the safety gate's
    agreement rule delegates to `scanMalformedSentences` (or imports the same guard) so one classifier decides;
    battery: the Ch.2/Ch.11-shaped fixtures produce zero agreement hits from BOTH entry points.
51. Nits (telemetry/VERSIONS): (a) Ch.1 was saved with identical content at 16:52:48Z, one second before
    POLISH-RUNNER START — a no-op write that mints a version record (find the pre-polish writer; skip saves when
    content is byte-identical). (b) The PROSE-GUARD per-stage lines were emitted twice (11:52:50 and 12:00:44)
    — confirm the runner's end-of-run report re-logs checkpoints rather than re-running stages.

### Run 2 verdict
REGENLANE-2B works as designed for the paragraphs it can find (7 rewrites survived NFGUARD-1 and are in the saved
chapters, nothing else changed); MALFORMEDSENT-2 removed the agreement FPs from the lane. Two generic gaps remain
in the same code paths (47, 48), plus an export contradiction that will hit every NF book (49). Arc G closes after
REGENLANE-2C + LENGTHGATE-1C + MALFORMEDSENT-3 land and pass their batteries; no further live run is required
before Arc H — the next NF Fix Manuscript in Arc H's exercise list re-proves 47/48 with the attributed reasons.

## Landing check — REGENLANE-2C + LENGTHGATE-1C + MALFORMEDSENT-3 (54c1eb99) — 2026-08-25 afternoon
HEAD = origin/main = origin/agent/narrative-connect-1 = 54c1eb99; six commits since 773f5aad; tracked tree clean;
144 acceptance files; regenlane1 34/34, regenlane1c 28/28, lengthgate1 9/9, lengthgate1c 7/7, malformedsent1 31/31;
the two polish-pipeline reds untouched (0-line diff).
Offline verifier on the real project (`verifyRegeneratedParagraph`): candidates adding Galveston / Union / Georgia
→ `new-proper-noun:<tok>` with or without a cast list; a "weight"→"burden" rewrite → ok; the fiction Zin→Zinnia shape
→ `new-cast-name:Zinnia`. Finding 47 CLOSED (strict rule, attributed reasons); 48 battery-proven (index fallback +
drop log) — live re-proof folded into Arc H's NF Fix Manuscript exercise.
Offline export gate on Juneteenth after the landing: Ch.2 malformed 7→0 and Ch.11 malformed 1→0 from the safety
gate (finding 50 CLOSED on real prose); LENGTHGATE line gone and Ch.21 no longer in BOOKGATE-2 SHORT (finding 49
CLOSED); Ch.3 remains the one SHORT advisory (3377 vs 3384 floor). Hard failures now: Ch.8, Ch.9 (data: quote
marks), Ch.11 (data: one unterminated paragraph) — and a NEW one that LENGTHGATE-1B had been masking:
52. **The app's own bibliography generators emit section headings the app's own export gate hard-blocks.**
    closedWorldBibliography.js 130–146 and bibliographyGenerator.js 367–391 push plain lines ("Primary Sources and
    Archival Records", "Government, Institutional, and Web Sources", "Source Categories Consulted", "Source
    Integrity Note"); pipelineValidator.js BACKMATTER-1 exempts only markdown `#` headings and a closed word list,
    so Ch.21 now fails "4 paragraph(s) end without terminal punctuation". Generic on every NF book with a rebuilt
    Sources chapter. BIBFORMAT-1: both generators emit section headings as markdown (`## …`), which ExportTab's
    DOCX writer already renders as real headings (ExportTab.jsx ~3487–3505); `countBibliographyEntries` must not
    count heading lines. Battery: generator output passes `checkStructuralIntegrity` with zero unterminated
    paragraphs; entry count unchanged with headings present. Data step after it lands: I press Foundation →
    Bibliography on Juneteenth so Ch.21 is rebuilt through the app, then re-run the offline gate.

## Landing check — BIBFORMAT-1 (361b3076) — 2026-08-26 morning — ARC G CLOSES
HEAD = origin/main = origin/agent/narrative-connect-1 = 361b3076; two commits since 54c1eb99 (f276913a source,
361b3076 battery); diff touches only src/lib/bibliographyGenerator.js (+16/−), src/lib/closedWorldBibliography.js
(+12/−) and the new test/bibformat1.acceptance.mjs (127 lines) — every plain-line section-heading push in both
generators became `## …`, nothing else changed; pipelineValidator.js untouched (the check was not widened).
145 acceptance files = 144 green + 1 quarantined; bibformat1 15/15 (both generators pass checkStructuralIntegrity
with zero unterminated paragraphs, countBibliographyEntries excludes heading lines, the old plain-line shape still
fails, isBackMatter untouched, ExportTab maps `##` to HEADING_2); the two polish-pipeline reds 0-line diff.
Data step: Ch.21 "Bibliography & Sources" on Juneteenth was rebuilt through the app's bibliography save path at
19:32 local (new record chapter-bibliography-20260826003229-…, 8 min after the commits); the saved text carries the
four `##` headings and still counts 43 entries. previous_content_md_url is empty — finding 46 (bibliography save
records no previous version) still open, Arc J.
Offline export gate on Juneteenth at 361b3076 (runPreExportSafetyGate, 21 chapters): blocked = true, hard failures
= Ch.8, Ch.9 (data: quote marks), Ch.11 (data: one unterminated paragraph) — exactly the predicted data-only set;
Ch.21 absent from every list. **Finding 52 CLOSED live.** Nothing left in Arc G's scope blocks the flagship; the
three remaining blocks are book DATA fixes through the app (Arc J).
Arc G verdict: CLOSED at 361b3076 (findings 42–52; 47/48 live re-proof folded into Arc H's NF Fix Manuscript run).
