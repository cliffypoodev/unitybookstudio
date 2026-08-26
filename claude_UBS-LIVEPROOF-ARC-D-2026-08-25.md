# LIVE PROOF — Arc D (STATECONTRACT-1 / BIBLEGATE-1 / SCENEDUP-1 / ARCSTATE-1 / PRONOUNLOCK-2 / SUBJECTGUARD-2)
Run 2026-08-24 ~17:28 CDT by Claude (Cowork) in Cliff's Chrome against REDUX. Code under test:
HEAD = origin/main = origin/agent/narrative-connect-1 = **720a0a61** (verified live before the run).

## Verdict: STOP — BIBLEGATE-1 blocked the redraft (ok=false). Nothing was drafted, nothing changed.
This is the first STOP condition in Claude Code's own instructions, reported as instructed, not fixed.
The gate did its job mechanically (it blocked before any LLM call), but 8 of its 10 findings are
false positives against the app's OWN bible format, so as built it would block every REDUX draft.

## What happened
- Departure check (asked for): REDUX's own ledger (`buildCharacterState` over the saved chapters) says
  **JB departed in Ch.9, returned in Ch.11** → Ch.10 is the right target. Confirmed, not assumed.
- Fresh page load (Vite `?t=1787607092951` modules = post-Arc-D code), Chapters → Ch.10 → Scenes →
  **Draft Chapter**. The fiction research-coverage advisory confirm appeared (`[RESEARCH-COVERAGE]
  advisory (Draft): Ch.10 missing 20 atom(s)`) — Cliff clicked OK.
- Console, in order:
  ```
  [BIBLEGATE] missing=6, malformedHeaders=4, ok=false
  [BIBLEGATE] draftChapter audit: Object
  ```
  then the draft returned. No `[STATECONTRACT]`, `[REGENLANE]`, `[SUBJECTREPAIR-1]` lines — expected,
  since the gate returns before drafting. Ch.10's saved text is untouched.

## The full audit detail (reproduced offline with the repo's own `auditBibleCompleteness` on REDUX's
   live `characters_md` / `outline_md` / beat summaries — identical counts to the console)
```
missing (name · mentions in outline+beats):
  Gaudy · 6        ← half of the SHIP's name "Gaudy Galactie"
  Galactie · 6     ← other half of the ship's name
  Elm · 6          ← half of the TOWN "Elm Fork"
  Fork · 6         ← other half of the town
  Zorblax · 4      ← REAL GAP: the ship's AI voice speaks in prose ("Zorblax's voice crackled…") and has no bible entry
  Shakespeare · 3  ← the playwright, from the chapter title "Sadie's Shakespeare Moment"
malformedHeaders:
  "Major Characters"                → "missing pronoun declaration"      ← it is the `### Major Characters` SECTION heading, not an entry
  "Protagonist: Zinnia 'Zin' Quark" → "role word used in place of name"  ← the app's own foundation generator writes entries as `**N. Role: Name**`
  "Antagonist: Roderick 'Rodge' Krye" → same
  "Rival: Nolan Brandt"               → same
```
`parseCanonCast(characters_md)` on the same bible returns the SEVEN correct names (Zinnia, Roderick,
Jubal, Missy, Nolan, Lark, Sadie) with roles — i.e. the parser already handles the `Role: Name` shape
the gate is flagging. The historical `**6. Crew: Lark**` bug the plan cites is not reproduced by the
current parser on this bible.

## Findings (numbered; not blockers for the code that landed, but blockers for the live proof)
1. **BIBLEGATE-1 needs a person filter for "missing" names (BIBLEGATE-1B).** Five of six hits are
   places/objects/title words. Minimum rule set: a capitalized token that only ever appears inside a
   multi-word capitalized phrase with another capitalized token ("Gaudy Galactie", "Elm Fork") is a
   compound proper noun, not a person; a token that appears in `outline_md` only inside `## Chapter N:`
   title lines is not a person; a token preceded by "the" in ≥ half its mentions is not a person.
   Keep the ≥3-mentions rule for what survives. Zorblax survives → correct.
2. **BIBLEGATE-1 header rule must consult the parser, not the raw header.** Only `**N. …**` entry
   lines are headers (skip `#`/`##`/`###` section headings). A header is malformed only when
   `parseCanonCast` yields no name for it or yields a role word as the name — the `Role: Name` shape
   that the app's own generator emits is legal and must pass. Missing-pronoun check likewise runs per
   parsed entry, not per markdown heading.
3. **Data fix for Cliff (not code): add Zorblax to REDUX's Characters.** One `**8. Zorblax**` entry
   with `- **Pronouns: it/its**` (the ship's AI voice). The gate is right about this one; the book has a
   speaking character with no bible entry, which is exactly the class BIBLEGATE-1 was written to catch.
4. The console prints `[BIBLEGATE] draftChapter audit: Object` — the detail is unreadable in a pasted
   console. Log `JSON.stringify(bibleAudit)` (one line) so a STOP like this one carries its evidence.
5. The gate blocks with a toast only; the Draft button gives no inline reason. Cosmetic; note for HYGIENE.

## What is still unproven (re-run after BIBLEGATE-1B + the Zorblax entry)
`[STATECONTRACT] Ch.10: cast/departed/events/resolved arcs/scenes`, `[REGENLANE] writer-final`,
SCENEDUP/ARCSTATE via the lane counts, SUBJECTGUARD-2 in the wild, and "no DEPARTED_CHARACTER_ACTIVE
for Ch.10 in the export gate". The code for all of these is at 720a0a61 and its batteries are green;
only the live exercise is outstanding. Same runbook: Chapters → Ch.10 → Scenes → Draft Chapter →
Cliff clicks OK on the coverage advisory → watch console → export-gate scan.

---

# Run 2 — 2026-08-24 17:52 (after BIBLEGATE-1B at 32533af9 + the Zorblax data entry)

## Verdict: STOP again — BIBLEGATE (bible-gate-v2) blocked the redraft, ok=false. Nothing drafted, nothing changed.

## Pre-flight (all verified live on the Mac before the run)
- `git rev-parse --short HEAD` / `origin/main` / `origin/agent/narrative-connect-1` → all `32533af9`
  (`BIBLEGATE-1B-LIVE-PROOF-FALSE-POSITIVES`), branch `main`, porcelain 11 lines all `??`.
- Book-string sweep: `src/` code lines contain no Galactie/Elm Fork/Zorblax/Thompson/Zinnia/Sadie
  (only explanatory comments). One fixture slip in an Arc D battery — see finding 8.
- Data fix done through the app (Foundation → Characters → Save; `updated_date` on disk bumped to
  2026-08-24T22:50:54Z). Appended, in the same shape as entries 6 and 7:
  ```
  **8. Zorblax**

  - **Role:** The ship's AI voice.
  - **Pronouns:** it/its.
  - **Dialogue Fingerprint:** Dry, precise, quotes odds and probabilities aloud.
  ```
- Cmd+Shift+R, Chapters → Ch.10 "Sadie's Shakespeare Moment" → Scenes → Draft Chapter → Cliff clicked
  OK on the coverage advisory. Console tracked from before the click.

## Console (verbatim, the only tagged lines that fired)
```
[BIBLEGATE] missing=1, malformedHeaders=1, ok=false
[BIBLEGATE] draftChapter audit: {"ok":false,"missing":[{"name":"Shakespeare","mentions":3}],"malformedHeaders":[{"header":"Zorblax","reason":"missing pronoun declaration (he/him, she/her, or they/them)"}]}
```
(printed 3×, identical). No `[STATECONTRACT]`, no `[REGENLANE]`, no draft started. Finding 4 from
Run 1 is confirmed fixed — the JSON line carries the evidence.

## Findings
6. **BIBLEGATE header rule rejects `it/its`.** `PRONOUN_DECLARATION_RX` (`src/lib/bibleGate.js:25`)
   accepts only he/him, she/her, they/them. Any non-human cast member — a ship AI, a robot, an
   animal, a haunted object — declared `it/its` is "malformed". Generic defect, one-line fix: add
   `it\s*/\s*its` to the regex and to the reason string. Zorblax is the first it/its entry any
   REDUX-shaped book has had; the gate's own finding-3 recommendation asked for exactly this entry.
7. **BIBLEGATE "missing" rule still flags a non-actor proper noun.** `Shakespeare` = 3 mentions:
   `## Chapter 10: Sadie's Shakespeare Moment` (title line) + `Sadie quotes Shakespeare to negotiate…`
   in `outline_md` AND again in Ch.10's `beat_summary` (same sentence counted twice). Run 1's
   title-only filter (`isTitleOnlyMention`) can't save it because two mentions are body lines.
   The generic shape: the token never appears in an ACTOR position — every mention is a possessive
   (`Sadie's Shakespeare`) or the object of a verb (`quotes Shakespeare`). A person the bible must
   know about acts at least once: sentence-initial, or followed by a verb / `said`, or a `Name,`
   vocative. Suggested filter (d): skip a candidate when no mention is sentence-initial and none is
   followed within 2 tokens by a verb-like word; reuse the actor logic SUBJECTGUARD-2's
   `establishedActor()` already has rather than writing a second grammar. Authors, deities, brands,
   historical figures quoted in an outline all fall in this class. Keep ≥3 mentions for survivors.
   Alternative worth weighing: don't count the same sentence twice when `beat_summary` duplicates the
   outline line (dedupe `proseTexts` sentences) — that alone drops Shakespeare to 2 and under the
   threshold, but it is a weaker rule and the actor filter is the real one.
8. **Fixture hygiene (rule 0: no book strings in tests).** `test/biblegate1.acceptance.mjs:85–88`
   uses `Gaudy Galactie` and `Elm Fork` (the REDUX ship and town) as the compound-proper-noun
   fixture. Swap for invented ones (e.g. `Silver Heron`, `Ash Hollow`) in the same commit as
   BIBLEGATE-1C. Nothing in `src/` code uses book strings; comments that cite the live defect are fine.

## What is still unproven (unchanged from Run 1)
`[STATECONTRACT] Ch.10: …`, `[REGENLANE] writer-final`, SCENEDUP/ARCSTATE via lane counts,
SUBJECTGUARD-2 in the wild, export gate: no `DEPARTED_CHARACTER_ACTIVE` for Ch.10. Same runbook for
Run 3 after BIBLEGATE-1C lands: hard refresh → Chapters → Ch.10 → Scenes → Draft Chapter → Cliff OK →
console → export-gate scan. No further data changes are needed; Zorblax stays as entered.

---

# Run 3 — 2026-08-24 18:34 CDT (after BIBLEGATE-1C at 22a9d3ac)

## Verdict: STOP — BIBLEGATE passed (ok=true), STATECONTRACT fired, then the WRITER's first scene prompt was refused by ROUTE-1 for exceeding the endpoint's 32K context. No prose was generated or saved.

## Pre-flight
- HEAD = origin/main = origin/agent/narrative-connect-1 = `22a9d3ac` (verified). `bible-gate-v3`,
  `PRONOUN_DECLARATION_RX` accepts it/its, no book strings left in `test/biblegate1.acceptance.mjs`.
- Offline dry run of `auditBibleCompleteness` on REDUX's live bible + chapters: `ok:true`.
- Cmd+Shift+R; browser served `bibleGate.js?t=1787613681879` (previous run: `…611119470`) reporting
  `bible-gate-v3`. Chapters → Ch.10 "Sadie's Shakespeare Moment" → Scenes → Draft Chapter → Cliff OK.

## Console, verbatim, in order (tagged lines only)
```
18:34:49 [RESEARCH-COVERAGE] advisory (Draft): Ch.10 missing 20 atom(s)
18:34:54 [BIBLEGATE] missing=0, malformedHeaders=0, ok=true
18:34:54 [BIBLEGATE] draftChapter audit: {"ok":true,"missing":[],"malformedHeaders":[]}
18:34:54 [EVENTLEDGER] Planner ledger: 84 prior events, 5854 chars
18:34:55 [STATECONTRACT] Ch.10: cast 22, departed 1, events 84, resolved arcs 0, scenes 0      ← planner side
18:34:55 [CHARSTATE] Planner contract: 118 fact(s)
18:34:55 [NARRATIVE-CONNECT] Beat-planner prior coverage chars: 36008
18:34:55 [ROUTE-1] architect -> /llama | model=deepseek-r1-14b | prompt=37719c ~10478t | reserve=12288t | ctx=32768t | headroom=10002t | fits=true
18:35:27 [BIBLEGATE] … ok=true / [EVENTLEDGER] … / [STATECONTRACT] Ch.10: cast 22, departed 1, events 84, resolved arcs 0, scenes 0 / [CHARSTATE] Planner contract: 118 fact(s)   ← preamble ran AGAIN, no second ROUTE-1 line (finding 11)
18:37:22 [BEAT-PIPELINE-RAW] rawCount=3 … invalidIndexes=[]
18:37:22 [BEAT-PIPELINE] Accepting normalized beat contract for Ch.10: 3 → 3 distinct scenes.
18:37:22 [SCENECOLLIDE] Beat plan re-stages completed events: Array(2)
18:37:22 [NARRATIVE-CONNECT] Rejecting overlapping beat contract and regenerating: Object
18:37:22 [ROUTE-1] architect -> /llama | model=deepseek-r1-14b | prompt=38758c ~10767t | … fits=true
18:39:11 [BEAT-PIPELINE] Accepting normalized beat contract for Ch.10: 3 → 3 distinct scenes.
18:39:11 [NARRATIVE-CONNECT] Scene contract accepted: Object
18:39:11 [BEATS][COMPACT-SAVE v15.8] Ch.10: full=6087 chars, entity=5864 chars               ← beats SAVED (finding 12)
18:39:11 [COVERAGE] ch10: 41% of 17 beat atoms in evidence — MISSING: …
18:39:11 [HOLDER-4] Ch.10 opening contract overrides the inherited ledger: "small notebook" is with Sadie … / "wrench" is with Lark …
18:39:11 [EVENTLEDGER] Writer seeded with 84 completed events from earlier chapters
18:39:11 [CHARSTATE] Beat plan declares return(s): JB
18:39:11 [CHARSTATE] Contract for this chapter: 2 fact(s)
18:39:11 [STATECONTRACT] Ch.10: cast 22, departed 0, events 84, resolved arcs 0, scenes 3      ← writer side
18:39:11 [LLM-RETRY] taskType=prose model=qwen3.6-35b-uncensored context=prose
18:39:11 [ROUTE-1] ghostwriter -> /llama | model=qwen3.6-35b-uncensored | prompt=91206c ~25335t | reserve=7696t | ctx=32768t | headroom=-263t | fits=false
18:39:11 Draft failed: Error: ROUTE-1 budget refusal: agent ghostwriter -> /llama (qwen3.6-35b-uncensored). Prompt 91206 chars (~25335 tokens) plus 7696 reply tokens needs 33031 tokens, but that endpoint's context is 32768. Over by 263. Nothing was sent.
    at callLlama (localLLM.js:179) … at generateSceneWithRepair (sceneWriter.js:2453) at generateChapterSceneByScene (sceneWriter.js:4015) at draftChapter (ProjectStudio.jsx:3387)
```
No `[REGENLANE]`, `[SUBJECTREPAIR-1]`, `[STRUCTURE-GUARD]` lines — the writer never ran.

## What was proven this run
- BIBLEGATE-1/1B/1C: gate passes on a real bible in the app's own format with an it/its entry and a
  quoted-author name in the outline. The Run 1 and Run 2 false-positive classes are gone.
- STATECONTRACT-1 wiring: fires on BOTH paths. Planner side `scenes 0` is expected (the planner
  generates the scenes; ProjectStudio passes `normalizedScenes: []`). Writer side `scenes 3`.
- Nothing saved on failure: Ch.10 prose is byte-identical before/after (216 paragraphs, md5
  675b5e191a, `content_md_word_count` 4123) — checked on disk.

## Findings (numbering continues from Run 2)
9. **STATECONTRACT-1 block is ADDITIVE in the writer prompt; it must REPLACE what it composes.**
   `buildScenePrompt` still pushes `pronoun_canon`, `role_canon`, `character_state`, `style_budget`
   and `prior_completed_events` (sceneWriter.js ~2281–2358) AND the new `state_contract` (~2343),
   which is the same facts again. Measured offline on REDUX Ch.10 with the repo's own
   `buildChapterStateContract`: block = 11,691 chars (~3.2K tokens; CAST+EVENTS 8,738, SCENE MAP
   2,610, SIMILE BUDGET 280). The legacy event ledger alone is 5,854 chars, so the duplication is
   roughly the whole overflow and then some. Result: a 91,206-char scene prompt, 263 tokens over the
   32K context, for a 20-chapter book at chapter 10 — it will get worse every chapter. Fix shape
   (STATECONTRACT-1B, generic): when `spec.state_contract` is non-empty, `buildScenePrompt` skips the
   five legacy lines (keep populating the fields — audits read them); plus a budget guard in
   `buildChapterStateContract`/the writer: if the assembled prompt would exceed the endpoint context
   minus the reply reserve, drop the oldest EVENTS chapters first (log
   `[STATECONTRACT] trimmed events to last K chapters`), never the cast/status lines. ROUTE-1's
   refusal itself is correct behaviour (nothing was sent); the draft should degrade, not die.
10. **Planner lookahead: the accepted Ch.10 beat plan re-stages Ch.11's outline events, and the
    contract's "declared return" rule then trusted it.** Attempt 1 (18:37:22) was a good Ch.10 plan
    (Sadie's negotiation; Nolan's rival team as the complication) but SCENECOLLIDE rejected it —
    "the rival salvage team arrives in town" re-stages the Ch.3 arrival (correct catch). The
    regenerated attempt 2 (18:39:11) avoided the collision by pulling `## Chapter 11: The Sandstorm
    Showdown` forward: scene 2 = "A sandstorm suddenly hits Elm Fork … JB returns, having heard the
    storm warning", scene 3 = "set up for the engine test in the next chapter". All three scenes list
    `Jubal Swank` as present — including scene 1, BEFORE his scene-2 "return" — while the planner
    prompt carried `[STATECONTRACT] … departed 1` (JB) and 118 facts. `[CHARSTATE] Beat plan declares
    return(s): JB` then flipped the writer-side contract to `departed 0`. Generic fixes: (a) validate
    accepted beats against FUTURE outline entries (`## Chapter M:` for M > N) the same way
    SCENECOLLIDE validates against past events — reject/regenerate on a lookahead collision;
    (b) honour a beat-declared return only when `outline_md`/`beat_summary` for chapter ≤ N
    corroborates it (name + return-class verb); otherwise keep `departed` and flag the beat;
    (c) a planned scene whose `characters` include a departed name before any return event in an
    earlier scene of the same plan is a contract violation the beat validator should reject.
11. draftChapter's preamble (BIBLEGATE → EVENTLEDGER → STATECONTRACT → CHARSTATE) ran twice for one
    planner call (18:34:55 and 18:35:27; only one ROUTE-1 line), coinciding with lazy module loads
    (`[SCENE-WRITER] Loaded …` etc. at 18:35:27). Each run also re-uploads the unchanged chapter
    prose: `_FileStore.json` gained four byte-identical Ch.10 copies today (22:39, 22:52, 23:22,
    23:35 UTC — one per Draft attempt). Hygiene, not a blocker; same family as B/C finding 5.
12. **Data state after Run 3 (for Cliff, no action needed):** Ch.10 prose untouched. Ch.10's saved
    `scene_beats_json` was REPLACED by the attempt-2 plan from finding 10 (sandstorm / JB returns).
    Not hand-edited back (rule 0.2/8: data goes through the app); Draft Chapter re-plans beats on
    every run, so Run 4 overwrites it. Ch.10 status still `drafted`.

## Still unproven live
`[REGENLANE] writer-final` on Arc D code, SCENEDUP-1 and ARCSTATE-1 through the lane counts,
SUBJECTGUARD-2 `actor-mismatch` in the wild, PRONOUNLOCK-2 on a real draft, and the Ch.10 export-gate
scan (no `DEPARTED_CHARACTER_ACTIVE`). Same runbook for Run 4 once STATECONTRACT-1B lands; expect the
`[ROUTE-1] ghostwriter` line to show `fits=true` with headroom well above zero at scene 1.

---

# Run 4 — 2026-08-24 19:10 CDT (after STATECONTRACT-1B at fdc964f8)

## Verdict: PASS. Ch.10 redrafted end-to-end and saved. Every Arc D gate fired live; no STOP condition hit.

## Pre-flight
- HEAD = origin/main = origin/agent/narrative-connect-1 = `fdc964f8` (verified). `[LOOKAHEAD]` tag wired
  in ProjectStudio.jsx; `chapter-state-contract-v2` served after Cmd+Shift+R (modules `?t=1787616255302`).
- Chapters → Ch.10 "Sadie's Shakespeare Moment" → Scenes → Draft Chapter → Cliff OK on the coverage advisory.
- Note on the console reader: it replays its whole buffer on re-attach (blocks stamped 19:25:54, 19:29:22,
  19:31:29 are re-timestamped duplicates of earlier lines). First-occurrence times are used below.

## Console, verbatim, in order (tagged lines; scene-writer noise omitted)
```
19:10:25 [RESEARCH-COVERAGE] advisory (Draft): Ch.10 missing 10 atom(s)
19:10:29 [BIBLEGATE] missing=0, malformedHeaders=0, ok=true
19:10:29 [BIBLEGATE] draftChapter audit: {"ok":true,"missing":[],"malformedHeaders":[]}
19:10:30 [STATECONTRACT] trimmed events to last 6 chapter(s)
19:10:30 [STATECONTRACT] Ch.10: cast 22, departed 1, events 84, resolved arcs 0, scenes 0      ← planner side
19:10:30 [CHARSTATE] Planner contract: 41 fact(s)                                                (Run 3: 118)
19:10:30 [ROUTE-1] architect -> /llama | model=deepseek-r1-14b | prompt=37719c ~10478t | reserve=12288t | ctx=32768t | headroom=10002t | fits=true
19:12:11 [BEAT-PIPELINE] Accepting normalized beat contract for Ch.10: 3 → 3 distinct scenes.
19:12:11 [LOOKAHEAD] Beat plan pulls forward a future chapter's outline content: Array(1)
19:12:11 [CHARSTATE] Beat plan lists a departed character present before their own plan's return: Array(3)
19:12:11 [NARRATIVE-CONNECT] Rejecting overlapping beat contract and regenerating: Object        ← plan 1 rejected
19:13:28 [EVENTLEDGER] Beat plan re-introduces ledgered characters: Array(2)
19:13:28 [SCENECOLLIDE] Beat plan re-stages completed events: Array(1)
19:13:28 [LOOKAHEAD] Beat plan pulls forward a future chapter's outline content: Array(1)
19:13:28 [NARRATIVE-CONNECT] Rejecting overlapping beat contract and regenerating: Object        ← plan 2 rejected
19:15:04 [SCENECOLLIDE] Beat plan re-stages completed events: Array(6)
19:15:04 [LOOKAHEAD] Beat plan pulls forward a future chapter's outline content: Array(1)
19:15:04 [NARRATIVE-CONNECT] Rejecting overlapping beat contract and regenerating: Object        ← plan 3 rejected
19:16:19 [SCENECOLLIDE] Beat plan re-stages completed events: Array(3)
19:16:19 [LOOKAHEAD] Beat plan pulls forward a future chapter's outline content: Array(1)
19:16:19 [SCENECOLLIDE] Attempts exhausted — rewrote colliding beat phrasing deterministically for the crew/REVEAL, Zin/REVEAL, Zin/REVEAL, Zin/ch14
19:16:19 [NARRATIVE-CONNECT] Scene contract accepted: Object                                     ← plan 4 accepted
19:16:19 [BEATS][COMPACT-SAVE v15.8] Ch.10: full=5242 chars, entity=4805 chars
19:16:20 [COVERAGE] ch10: 76% of 21 beat atoms in evidence — MISSING: …
19:16:20 [PRONOUNLOCK] Canon for this chapter: Zin: she/her; Rodge: he/him; Sadie: she/her; Zorblax: she/her; JB: he/him; Zinnia: she/her; Roderick: he/him; Jubal: he/him; Missy: she/her; Nolan: he/him
19:16:20 [PRONOUNLOCK] Characters with heavy MIXED pronoun usage and no declaration: Thompson (he 7 / she 7)
19:16:20 [PRONOUNVAR] Context-variable character(s): Lark
19:16:20 [EVENTLEDGER] Writer seeded with 84 completed events from earlier chapters
19:16:20 [CHARSTATE] Contract for this chapter: 2 fact(s)
19:16:20 [STATECONTRACT] Ch.10: cast 22, departed 1, events 84, resolved arcs 0, scenes 3      ← writer side; JB stays departed
19:16:20 [PIPELINE-DIAG] … | 0-prompt-scene-1 | 12422 words | 79567 chars
19:16:20 [ROUTE-1] ghostwriter -> /llama | model=qwen3.6-35b-uncensored | prompt=79577c ~22105t | reserve=7696t | ctx=32768t | headroom=2967t | fits=true   (Run 3: 91206c, −263t)
19:17:52 … scene 1 raw 1390 words → RHYTHM-2 regen kept 1245 words
19:18:55 [ROUTE-1] ghostwriter … prompt=81757c ~22711t … headroom=2361t | fits=true            (scene 2)
19:20:41 [ROUTE-1] ghostwriter … prompt=87701c ~24362t … headroom=710t  | fits=true            (scene 2 repair pass — tightest call)
19:22:14 … scene 2 raw 1176 → RHYTHM-2 regen kept 1496 words
19:23:51 [ROUTE-1] ghostwriter … prompt=80494c ~22360t … headroom=2712t | fits=true            (scene 3)
19:25:49 … scene 3 raw 1457 → RHYTHM-2 regen kept 1352 words
19:27:38 [NARRATIVE-CONNECT] Updated ledger for scene 3. Dead: 0, Unavailable Objects: 0, Completed Events: 12
19:29:07 [ROUTE-1] ghostwriter … prompt=13057c ~3627t | reserve=12288t … fits=true             (chapter summary)
19:31:29 [TIMING] critic | deepseek-r1-14b | 70594ms
19:31:29 [NARRATIVE-CONNECT] Ch.10: critic requested revision, but destructive full-chapter rewrite was skipped; preserving scene-audited draft.
19:31:29 [PIPELINE-DIAG] … | 4-after-judge-revision | 4050 words | 22065 chars
19:31:29 [STRUCTURED-SCENES] sceneId=ch10-s01 acceptedProseChars=7010 / s02 6837 / s03 8217
19:31:29 [POST-DRAFT] postDraftCleanup() called … → [ROUTE-1] polisher -> /llama | model=Qwen3-Coder-30B … prompt=10121c … fits=true
```
No `[REGENLANE]`, `[SUBJECTREPAIR-1]`, `[STRUCTURE-GUARD]` or `Draft failed` lines. Both the lane and
subject repair return silently when they find zero targets (regenerateLane.js:274, subjectRepair.js ~227)
— verified offline below that zero is what they found, not that they didn't run (finding 17).

## Saved result (on disk)
- `Chapter.json` Ch.10 `updated_date` 2026-08-25T00:34:47Z, status `drafted`, `content_md_word_count` 3944,
  new `content_md_url` `…-20260825003446-8yf91f`. `_FileStore` copy: 21,991 chars, 112 paragraphs,
  md5 77d8b5bbf1 (old draft: 23,487 chars / 216 paragraphs / 675b5e191a). Opens "Sadie stood with her
  weight on her left leg…". JB: 0 mentions. "sandstorm": 0. Zorblax: 1 mention. Nolan: 24.

## Offline verification on the saved Ch.10 (repo's own modules, same inputs the writer had)
- `collectRegenTargets` with the writer's three extraDetectors (banned-vocab, scene-duplicate,
  arc-restart) + departed=[JB]: **0 targets** → the lane had nothing to regenerate (SCENEDUP-1 / ARCSTATE-1
  ran clean). `findDroppedSubjectSentences`: **0** → SUBJECTGUARD-2 had nothing to judge.
- `auditProseAgainstCharacterState` (JB departed): **[]** — no DEPARTED_CHARACTER_ACTIVE.
- `runPreExportSafetyGate` over all 20 resolved chapters: Ch.10 `ok:true, recommendedAction:PASS,
  malformedCount 0, dialogueIssueCount 0, structural.pass true`; warnings for Ch.10 = 1 PROSEGATE-1
  advisory + 1 PRONOUNLOCK-1 warning (finding 14). `DEPARTED_CHARACTER_ACTIVE` count across the whole
  report: **0**. The gate's single hard failure is Ch.5 ("glued word … itIs"), present in the
  pre-fixplan snapshot and untouched since 2026-08-15 — pre-existing, not this run's.

## What Arc D proved live in this run
BIBLEGATE-1/1B/1C pass on a real bible; STATECONTRACT-1/1B on both paths with the writer prompt 11.6K chars
smaller and the EVENTS trim firing; the corroborated-return rule holding JB departed against a plan that
tried to bring him back; LOOKAHEAD + premature-presence + SCENECOLLIDE rejecting four plans; the writer
fitting the 32K context on every call; a full chapter drafted, judged, polished and saved with zero
departed-character activity, zero malformed sentences and zero lane targets on the output.

## Findings (numbering continues)
13. **`parseDeclaredPronouns` does not accept `it/its`** (pronounLock.js:61 `PRONOUN_SET`). Zorblax's
    declaration is ignored and `buildPronounCanon` falls back to inferring from prose → the writer prompt
    carried `Zorblax: she/her`. Same class as finding 6; one-line regex fix + battery (any non-human cast
    member). Not a STOP: the warning-only scanner and the prompt line are wrong, nothing blocked.
14. **`scanPronounViolations` still counts pronouns that belong to another, pronoun-only actor.** 13–14
    Ch.10 sentences flagged (Zin ×5, Nolan ×4, Sadie ×3, Rodge ×1), all one shape: a two-actor scene where
    the OTHER actor is never named in the window — "He stopped three feet from Zin, close enough that she
    could smell … his jacket" (He = Nolan), "Rodge walked over to her, placing a hand on her shoulder"
    (object pronouns), "Zin tensed, her hand … belt. His grin …" (next-sentence extension). PRONOUNLOCK-2
    cuts at cast names and person nouns but not at (a) a sentence-initial opposite-gender pronoun that
    already holds the subject, or (b) object-position pronouns. Warning-only (export gate never
    hard-blocks on pronouns) → not a STOP. PRONOUNLOCK-3 candidate: count only subject-bound pronouns
    (reuse `subjectBoundGender` / SUBJECTGUARD-2's actor chain), and don't extend into a next sentence
    that opens with the opposite gender.
15. **LOOKAHEAD's deterministic rewrite keyed on a cast NAME, not an event.** The accepted plan's scene 2
    carries "(Zin belongs to Chapter 14's outline, not this chapter — do NOT stage it here …)" appended to
    both `scene_goal` and a `required_event`, and that text went into the writer prompt. The future-outline
    collision extractor treated "Zin" as the pulled-forward content. Also: five planner calls (~6 min)
    before "Attempts exhausted", and the accepted plan still logged `[LOOKAHEAD] … Array(1)`. Generic:
    key lookahead on event phrases (verb + object), quote the colliding outline text in the annotation,
    never a bare cast name; consider feeding the rejection reasons into the regenerate prompt.
16. `[PRONOUNLOCK] Characters with heavy MIXED pronoun usage and no declaration: Thompson (he 7 / she 7)`
    — prior-chapter prose (Thompson is not in the bible). Data/Proofreader item, not code.
17. Hygiene: `regenerateFlaggedParagraphs` and `repairDroppedSubjects` return silently on zero targets, so
    a live proof cannot tell "ran, found nothing" from "never ran" without an offline re-check. Log the
    `targets 0` / `found 0` line too.
18. Observations for the Proofreader / later arcs, not Arc D: Ch.5 pre-existing hard block ("Is itIs it"
    glued word, since 2026-08-15); the new Ch.10 opens on Nolan leaning on "the hood of his rusted pickup
    truck" in 1869 Elm Fork (plausibility, not a gate); critic requested a revision and the pipeline
    correctly skipped the destructive full-chapter rewrite.

## Arc D live-proof status
Runs 1–3 STOPs all resolved by generic fixes (BIBLEGATE-1B/1C, STATECONTRACT-1B). Run 4 PASS. Arc D is
ready to close; findings 13–15 are Arc D-adjacent follow-ups (PRONOUNLOCK-3, LOOKAHEAD-1B) for Claude Code
to schedule, 16–18 go to HYGIENE-1 / the Proofreader.
