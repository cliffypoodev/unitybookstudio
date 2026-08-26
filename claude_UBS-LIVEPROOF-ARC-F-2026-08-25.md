# UBS Arc F (STYLE) — live proof, 2026-08-25

Written by Cowork Claude (verifier). Claude Code reads this ONLY when handed the paste below.
Repo: ~/Downloads/UBS. HEAD = origin/main = origin/agent/narrative-connect-1 = **7948b945** (Arc F 8 commits at
6227fe37 + STYLEBUDGET-3B-OPENING-ECHO-TOKENS 7948b945). Porcelain tracked 0. 135 acceptance files = 134 green + 1 quarantined.

## Run 1 verdict: STOP. Arc F's own code did what it was built to do; the live proof MISSED its targets and
## surfaced one prose-corrupting stage plus three lane-verifier gaps. Fix generically (F5 below), restore three
## chapters through the app, re-run.

## Pre-run (offline, stored prose, repo modules at 7948b945)
- Detectors: template-family 162 hits → 140 lane targets across all 20 chapters (cap 12/chapter); opening-echo
  **6** targets (Ch.7←5 "that felt less like", 9←7 "the sun was dipping", 16←1 "a sound like a", 17←6 "of the
  engine room", 18←15 "the engine room smelled", 19←1 "hull of the gaudy") — the two false ones (Ch.4/14 on the
  protagonist's name via a spaced-apostrophe artifact) are gone after 3B; fragment-density **0** targets (2.7–12/1k).
- Batteries on the Mac: stylebudget3 18/18 (after 3B), stylebudget2c 11/11, fragbudget1 19/19, namereg2 6/6.
- Snapshot of all 20 stored chapters taken at 03:03:30 UTC for the post-run diff.

## Live run: Refine → Polish → Analysis tab → "Fix Entire Manuscript" (Cliff clicked OK), 10:06:03–10:15:02 PM
`[POLISH-RUNNER] chapters=20 anthology=false mode=fiction allowLLM=false` (style/regen LLM flags default true, so
STYLEBUDGET-2 and the lane still call the model). `[LOCAL-LLM] Agent: polisher | Model: unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q6_K_XL | Temp 0.5 | Ctx 32768`.
Console reader replays its buffer on every re-attach (10:06:10 / 10:07:35 / 10:09:29 / 10:09:51 duplicates) — one run only.

What Arc F's code did live:
- `[STYLEBUDGET-3] Ch.N: family targets …, opening-echo targets …` on all 20 chapters (1,2,1,7,4,8,8,5,6,9,3,19,11,11,16,16,9,12,8,6 family;
  echo 1 on Ch.9 — on Ch.16–19 the first paragraph was already claimed by a template target, so the echo reason never reached the lane).
- `[FRAGBUDGET-1] Ch.N: fragments … (X/1k, budget 20), targets 0` on all 20 (as predicted).
- `[STYLEBUDGET-2C] … escalated retry` fired 10× on the "less like / more like" shape: accepted 1 (Ch.5), rejected 9.
- `[REGENLANE] Ch.N: targets T, regenerated R`: totals **141 targets, 8 regenerated, 133 skipped**.
- STYLEBUDGET-2: 47 recast attempts, **3 accepted** (Ch.5, Ch.10, Ch.14); rejections simile-remains 24, unchanged 9,
  too-short/too-long 4, plus 9 escalations rejected. Simile density ≤ 3.0/1k after the run: **5/20** (unchanged).
- `[STRUCTURE-GUARD] … REVERTED` ×26 for the legacy stages "Pre-Quote Artifact Repair" and "Final Artifact Cleanup"
  on 13 chapters (they still try to drop 1–14 paragraphs; the guard holds — not this plan's stages, see 34).
- `[POLISH-RUNNER] ========== COMPLETE ==========` 10:15:02; 7 chapters saved (3,4,5,10,12,14,15); paragraph counts
  identical on all 20 (1,611 total); offline gate after: hardFailures still Ch.5 "itIs" only, MALFORMEDSENT 10→8, warnings 44→43.

## Findings (continuing the numbering; 26 = Arc F's own, 27–35 generic defects the run exposed)
26. **Arc F detectors: PASS** — targets, telemetry at zero, echo precision after 3B, fragments 0, sequential calls,
    no REVERTED line for any stage this plan added, paragraph counts intact.
27. **The lane never tells the model what the defect is.** `regenerateLane.js:300` builds
    `DEFECT (${kind}): "${sentence}"` — `target.reason` (which names the template key / word / echo gram and carries
    the instruction) is dropped. The model saw `DEFECT (template-family): "The stars were bright, cold, and
    indifferent."` and could not know "indifferent" was the problem → `unchanged` / `still-flagged` on 100+ targets.
    Pre-existing (REGENLANE-1) but only now consequential. Fix: REGENLANE-1C — prompt carries a numbered DEFECTS
    list = every finding inside that paragraph (same detectors, run on the paragraph), each with its reason.
28. **Verifier check (5) can pass a rewrite that did not fix the defect.** Rescan runs the detectors on the lone
    candidate paragraph; a template hit under the chapter budget, or an echo gram, is invisible there. Live: Ch.4
    "Zin looked at him, really looked at him…" was ACCEPTED after the model only swapped Rodge→Roderick and kept
    "really looked". Fix: targets carry `mustNotContain: [key|gram|word]` (or the flagged sentence verbatim for the
    malformed kinds); verifier rejects `defect-remains`.
29. **Verifier has no typography guard.** Accepted candidates introduced `'Jubilee’` (curly→straight single quote)
    and `'Roderick the Terrible.'”` (an added quote) in Ch.4, and `“ Coolant circulating,”` (space inside the smart
    quote) in Ch.12 — the export gate's "mixed straight and curly" hard block and the typographic scrub exist because
    of exactly this. Fix: reject `typography` when the candidate adds a straight quote the original lacked or has
    `“ ` / ` ”`.
30. **Verifier closed-world check is too loose for names.** `allowedCaps = original ∪ cast` lets the model replace
    one cast member's name with another's (Rodge→Roderick — same person here, but the same rule would let it swap
    two people). Fix: candidate proper nouns ⊆ original paragraph's proper nouns.
31. **Length envelope kills short paragraphs.** `length-ratio` rejected "For now, it had to be.", "Indifferent.",
    "Small, but it was real." — you cannot replace a template phrase with a concrete detail inside 0.6–1.6× of 12
    characters. Fix: for originals < 120 chars allow 0.5–3.0× or +100 chars absolute.
32. **Fix Manuscript still regex-renames characters (STOP-class).** `manuscriptPolishRunner.js` "B3.5: Banned
    AI-slop character-name auto-rename" (~603–635) builds an automatic map from `getAllBlockedNames()` and
    `applyApprovedNameReplacementMap` ("Approved" — nothing was approved) and rewrote Ch.10 **Silas → Dean ×20**.
    The project's own bible says of the antagonist "never called by any other name (never 'Dean', never 'Russell')"
    — those are this rule's suggestions for "Silas", i.e. this stage already hit this book once before the plan.
    Prose regex-edited, canon ignored, no gate caught it afterwards. Fix: POLISHSAFE-5 — flag only (`[NAME-HYGIENE]
    banned name present: … — flagged only`, a `changes` entry); never rewrite. Plus PROSE-GUARD (report mode): after
    every deterministic stage, log `[PROSE-GUARD] <stage> Ch.N: letters changed` whenever the letters-and-digits
    sequence of the text differs (punctuation/whitespace-only changes are silent) — the stage inventory Arc C was
    meant to produce, measured instead of read.
33. **Undo exists and is unreachable.** `ProjectStudio.jsx` takes `captureSnapshot('Manuscript Polish')` before the
    run and has `handleUndo` (restores project + every chapter record through `Chapter.update`, the real save path),
    and imports `UndoButton` at line 28 — but never renders it. The in-memory snapshot is gone on reload. Fix:
    UNDO-1 render it; and VERSIONS-1: every content save keeps `previous_content_md_url` on the chapter record and the
    chapter card gets "Restore previous version" (= `Chapter.update({ content_md_url: previous })`). The old file
    records still exist in the store (Ch.10 pre-run …-20260825011356-e40qk2), so nothing is lost.
34. Legacy stages "Pre-Quote Artifact Repair" and "Final Artifact Cleanup" still attempt paragraph deletion on 13/20
    chapters every run (guard reverts). Arc J: retire them or make them flag-only; each REVERTED is wasted work.
35. Data / config, not code: (a) Ch.10 now says "Dean" (must be restored — see 33); Ch.4 and Ch.12 carry the finding-29
    typography damage (restore too; Ch.3/5/14/15 changes are legitimate verified rewrites — keep). (b) "Silas" itself is
    not in the bible — the Arc D redraft of Ch.10 invented a Tier-1 banned name and no gate noticed
    (`[PRONOUNLOCK] … 2 unresolved` is the only trace) — NAMEGATE-1 is a candidate for Arc H: a new proper noun in a
    drafted chapter that is not in the cast is a BIBLEGATE-class rejection. (c) The polisher agent is routed to a
    CODER model (Qwen3-Coder-30B); it ignored "do not use like" 33 times out of 36. That is a Settings choice for
    Cliff (a prose model for taskType 'polish'), not code. (d) Opening the Polish page re-uploaded Ch.1 unchanged at
    03:04:59 UTC (HYGIENE-1 identical re-upload, again). (e) 54 spaced-apostrophe artifacts (`Zinnia ' Zin’`) remain in
    stored REDUX prose — Proofreader / Arc J data item.

## What must land before Run 2 (F5, one session): REGENLANE-1C (27,28,29,30,31), POLISHSAFE-5 + PROSE-GUARD (32),
## UNDO-1 + VERSIONS-1 (33). Then Cliff restores Ch.4, Ch.10, Ch.12 in the app, then I re-run Fix Manuscript.

---
# Run 2 — after F5 (REGENLANE-1C, POLISHSAFE-5 + PROSE-GUARD-1, UNDO-1, VERSIONS-1/1B), 2026-08-25 7:55–8:07 AM
HEAD = origin/main = origin/agent/narrative-connect-1 = **3bf37321** (F5 b754be6f…43890db2 + VERSIONS-1B 4f907ca9/3bf37321).
138 acceptance files = 137 green + 1 quarantined; regenlane1c 15, polishsafe5 8, versions1 18 all PASS on the Mac.

## Restores first (through the app, Write → Chapters → chapter → Scenes → "Restore Previous Version")
Ch.10, Ch.4, Ch.12 restored via the VERSIONS-1B history fallback; each now byte-equals the pre-Run-1 snapshot
(Ch.10 back to its 20 "Silas", 0 "Dean"). Ch.3/5/14/15 kept their verified Run-1 rewrites. The `versions` store
action answered live without a dev-server restart (30 records for Ch.10, metadata only).

## Verdict: STOP (narrow). The pipeline is now SAFE — no deterministic stage changed a letter, nothing was renamed,
## restores work — but the lane is still ineffective: 8/141 regenerated, 0/47 similes. Three verifier/prompt
## defects remain (36–38), one model-choice item (35c) is Cliff's.

## What Run 2 showed
- `[NAME-HYGIENE] banned name present: "Silas" (20x) — flagged only`, `"Kaelen" (2x) — flagged only` (POLISHSAFE-5 live).
- `[PROSE-GUARD] Regenerate Lane Ch.N: letters changed` on exactly the 7 chapters the lane rewrote (2,10,11,13,17,18,19)
  and on NO deterministic stage — the stage inventory Arc C wanted, now measured: after POLISHSAFE-5 the
  deterministic pipeline is letter-clean on REDUX. (PROSE-GUARD should label/skip LLM stages — cosmetic.)
- `[STRUCTURE-GUARD] … REVERTED` only on Ch.1 and Ch.3 this time (legacy stages, finding 34).
- STYLEBUDGET-2: 0/47 accepted (simile-remains 26, unchanged 9, too-short/long 4; 2C escalations 0/10).
- Lane rejections (unique): **typography 84**, length-ratio 27, defect-remains 8, paragraph-count 2,
  new-proper-noun 2, unchanged 1, quote-balance 1. Saved: 7 chapters, paragraph counts intact, 8 rewrites;
  `previous_content_md_url` now recorded on every one (VERSIONS-1 live). Offline gate after: Ch.5 only,
  MALFORMEDSENT 8, warnings 43 — unchanged.

## Findings
36. **REGENLANE-1C's DEFECTS list is empty for most targets.** `collectAllDefectsInParagraph` re-runs the
    detectors on the LONE paragraph, where a template hit is under its chapter budget and the family is not
    book-exhausted → no finding → `defects: []`, `mustNotContain: []`. Verified offline on the Ch.2 target
    ("indifferent": reason says "chapter budget 1; book spend 2/5", defects []). So the prompt still names no
    defect and `defect-remains` never fires; Ch.2 was ACCEPTED with only "Zin"→"Zinnia" changed and "indifferent"
    intact. Fix: build the per-paragraph defect list from the CHAPTER-level detector findings collectRegenTargets
    already has (group every finding by paragraphIndex), never by re-scanning the paragraph alone.
37. **Closed-world check misses a sentence-initial cast-name swap.** Check (4) strips sentence-initial words
    before collecting proper nouns, so "Zin looked…" → "Zinnia looked…" passes (offline: ok:true). Fix: any token
    that is a cast name (or the possessive of one) counts wherever it sits; candidate cast names ⊆ original's.
38. **Typography guard rejects the model's ASCII apostrophes.** 84 of 125 rejections: the model writes `didn't`
    where the original had `didn’t`; `straightQuoteCount` sees a new straight quote → `typography`. Fix: normalise
    the CANDIDATE's typography to the original's convention before verifying (word-internal `'`→`’`, leading
    `'`+letter→`‘`, paired `"…"`→`“…”`) in cleanLLMParagraph and simileRecast's cleanLLMSentence — this is
    cleanup of model output, not prose editing — then keep the guard. Also: the lane prompt/SYSTEM must say
    "return the COMPLETE paragraph" (27 length-ratio rejections look like sentence-only replies; log the ratio),
    and "do not add facts, numbers, backstory or events not already in the paragraph" (accepted Ch.10 rewrite
    invented "thirty-seven beats per minute, the same rhythm her grandmother had counted during her final days";
    Ch.11 invented "desperate fugitives hiding in the rocky outcrops"). A cheap guard: reject `new-number` when
    the candidate adds a digit/number-word the original lacked.
39. VERSIONS nit: `findImmediatelyOlderVersion` sorts every key under the chapter prefix, so `backup-…` ids
    (which sort before `chapter-…`) could be picked when the current version is the oldest `chapter-` one;
    filter to the current key's filename family. Restore also does not record `previous_content_md_url` for the
    version it replaced (Ch.10 prev empty after restore) — a restore should be undoable the same way.
35c (unchanged, Cliff): polisher = Qwen3-Coder-30B; every "less like / more like" escalation was refused.

## Next: REGENLANE-1D (36, 37, 38) + VERSIONS-1C (39), then Run 3 — ideally after Cliff points taskType 'polish'
## at a prose model in Settings, so Run 3 measures the pipeline and not the coder model.

---
# Run 3 — after REGENLANE-1D + VERSIONS-1C, 2026-08-25 8:40–8:49 AM
HEAD = origin/main = origin/agent/narrative-connect-1 = **414c9509** (7a53d9cf REGENLANE-1D + VERSIONS-1C, cf228578
battery, 414c9509 check-order fix — departed-reintroduced before the cast-aware check, a named deviation).
138 acceptance files = 137 green + 1 quarantined; regenlane1 21, regenlane1c 28, versions1 21, stylebudget2c 11 PASS.
Offline repros: the Ch.2-style target now carries `defects: ["template-family:indifferent"]` and mustNotContain;
"Zin"→"Zinnia" at sentence start → `new-proper-noun:Zinnia`; `normalizeModelTypography` maps the model's ASCII
quotes to the original's curly convention. Polisher still Qwen3-Coder-30B (unchanged by Cliff).

## Verdict: PASS for Arc F's code and the lane. The plan's simile bar (≤ 3.0/1k on ≥ 18/20) is NOT met and
## cannot be met by this model; it is deferred to a rerun after Cliff switches the polish model (35c).

## Numbers
- Lane: **35 regenerated / 131 targets** (Run 1: 8/141, Run 2: 8/141) across 17 chapters; 35 paragraphs changed,
  paragraph counts identical on all 20 (1,611). Rejections are now the RIGHT ones: defect-remains (model left
  the phrase), length-ratio with the ratio logged (the model pads short paragraphs 2–30×: "And for now, that
  was enough." → ratio 30), new-proper-noun for invented names (Turkey, Mars, Sundered, Elm — all correctly
  refused), new-number (three, thousand), paragraph-count, quote-balance 1, **typography 0**.
- Template-family hits across the book 162 → **116**; lane targets 140 → 98; opening echoes 6 → 5;
  every accepted rewrite removed its template phrase (indifferent→distant, heartbeat→thrum, "weight of the book"
  → "cool leather binding", "really looked at" → "studied … closely").
- STYLEBUDGET-2: 0/47 recasts accepted (simile-remains / unchanged / too-short) — same as Run 2, model-bound.
  Simile density ≤ 3.0/1k: 5 → 6 chapters (incidental "like a heartbeat" removals by the lane).
- PROSE-GUARD: letters changed only by "Regenerate Lane" (17 chapters) — no deterministic stage.
  NAME-HYGIENE flag-only (Silas 20x, Kaelen 2x). STRUCTURE-GUARD REVERTED on Ch.1/Ch.3 (legacy, finding 34).
- Offline gate after: Ch.5 "itIs" only, MALFORMEDSENT 8, warnings 43 — unchanged. `previous_content_md_url`
  recorded on all 17 saves; VERSIONS-1C history filter and restore-records-previous verified in the battery.
- Incidental: the lane's typography normalisation repaired two stored spaced-apostrophe artifacts in Ch.17
  (`' left’` → `‘left’`) inside paragraphs it rewrote (finding 35e will shrink as chapters are rewritten).

## Observations (no STOP)
40. Prose quality of accepted rewrites is model-bound: a few add plot-flavoured detail without names or numbers
    ("lead-lined briefcase that contained the quantum resonance data", "the quantum stabilizers would hold",
    "landing gear is locked and the thrusters are offline"). Deterministic guards cannot judge that; it is the
    Proofreader's job (PROOFREADER-1) and a prose model's. Recommend STYLEBUDGET-3 keep `maxTargets` at 12 but
    Arc H add a "no new plot facts" critic pass on lane output when the LLM critic exists.
41. The model pads: 27+ length-ratio rejections at 1.7–30×. The prompt already says "keep roughly the same
    length"; a prose model should comply — re-measure after 35c before tuning the envelope.

## Arc F close-out: code PASS (F1–F4 + 3B, F5, REGENLANE-1C/1D, POLISHSAFE-5, PROSE-GUARD-1, UNDO-1, VERSIONS-1/1B/1C).
## Deferred: simile bar after a prose model (35c); findings 34, 39-nits, 40, 41 to Arcs H/J.
