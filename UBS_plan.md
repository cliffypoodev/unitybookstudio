# UBS Pipeline Tightening — Implementation Plan for Claude Code (Sonnet 5)

## Read this first

You are working inside the Unity Book Studio (UBS) codebase, a multi-bot AI book-production
pipeline (scene architect → prose writer → validators → export). It reliably produces
manuscripts, but exported books contain **repeated dramatic beats** — scenes that restage
confrontations, revelations, and emotional moments already shown earlier ("wait, didn't
this already happen?").

A code audit established the precise gap. UBS currently has:

- An **event-replay validator** (blocks literally duplicated plot events) — but no concept
  of duplicated dramatic *function* (two different "events" doing the same emotional work).
- A **phrase/style ledger** (tracks overused wording) — but no memory of what has already
  been *dramatized on the page* for the reader.
- **Repair by regeneration** (failed scenes go back through the model) — but no code path
  anywhere that can *remove or shorten* accepted prose.
- **Per-scene, forward-only validation** — no pass that reads the finished book and
  compares scene N against scene M.
- **No outline-level check** that two planned scenes have been assigned the same dramatic job.

Your mission is to install the missing organ: **beat-level memory, whole-book comparison,
and deletion authority** — additively, without destabilizing the existing pipeline.

### Global acceptance test

When this plan is complete, both of these searches MUST return real, working code:

1. A function that takes **two scenes** as input and returns an overlap/similarity verdict.
2. A code path by which a generated, accepted scene can be **cut or compressed** after the fact.

Today both searches return nothing. That is the bug.

---

## Non-negotiable constraints

1. **Additive first.** Phases 0–2 must not modify any existing generation, validation, or
   export behavior. New tables/files, new modules, new commands only.
2. **Feature flags on everything.** Every new behavior ships behind a flag, default OFF:
   `PROSE_LAB_CAPTURE`, `BEAT_EXTRACTION`, `OUTLINE_DELTA_GATE`, `DO_NOT_RESTAGE_BLOCK`,
   `REPETITION_SWEEP`, `CUT_PATH`, `EXPORT_REPETITION_GATE`. (Match the codebase's existing
   config convention; names are suggestions.)
3. **Nothing is destructively deleted, ever.** "Cut" is a status, not a row deletion.
   Every cut must be reversible with one action.
4. **Do not add material to the existing scene prompt** except the strictly capped
   do-not-restage block in Phase 3 — and only under its flag. The current prompt is already
   pathologically large (documented instances near ~91k characters). Adding more
   instructions to it is the failure mode that created this situation.
5. **No regeneration as a fix** anywhere in the new code. The new system's only prose
   generation is short bridging text after a compression (Phase 4).
6. **Human approval before automation.** Cut/compress actions require explicit user
   approval until the user flips `CUT_PATH_AUTONOMOUS` (Phase 4, later).
7. **Discover, don't assume.** Function names referenced below (`buildScenePrompt`,
   `buildFoundationBlock`, `buildBookStyleLedger`, `buildStyleBudgetPromptBlock`,
   `generateSceneWithRepair`) come from a prior audit. Verify actual names, signatures,
   storage layer (DB vs files), and language conventions before writing anything. Begin
   with a repo survey and write your findings to `docs/pipeline-map.md` (Phase 0 task).

---

## MODEL INFRASTRUCTURE — READ BEFORE WRITING ANY MODEL-CALLING CODE

**There is NO Ollama and NO LiteLLM anywhere in this stack.** Both were removed over a
month ago. Do not import their SDKs, reference their config formats, assume their default
ports (11434, 4000), or write compatibility shims for them. If you find dead Ollama/
LiteLLM references in the repo, note them in `docs/pipeline-map.md` as legacy — do not
build against them.

All local models are **llama.cpp servers exposing plain OpenAI-compatible `/v1`
endpoints over Tailscale**, plus stable Angela-side logical routes. Call them with any
standard OpenAI-compatible HTTP client. Confirmed endpoints:

```
ANGELA QWEN (heavy — current UBS Ghostwriter)   http://100.95.98.74:1237/v1
ANGELA GEMMA/HERMES (local to Angela only)      http://127.0.0.1:1238/v1
EDITH  (Qwen3.5-9B-Abliterated)                 http://100.115.40.17:1235/v1
DEXTER route (stable logical, selective)        http://100.95.98.74:8460
DEXTER route (stable logical, automatic)        http://100.95.98.74:8461
KYLE   (analyst)                                http://100.84.61.90:1236/v1
ERIC   (Qwen3.5-4B, verify role)                http://100.75.5.76:1236/v1
MABEL  (Ministral 3 3B)                         http://100.113.64.18:43827
KATHY  (Phi-4 Mini)                             http://100.112.170.126:18473
FLEET DASHBOARD / LIVE REGISTRY (authoritative) http://100.95.98.74:8790/
```

Rules:

- The **live registry at :8790 is authoritative** for current model↔endpoint bindings.
  Raw direct URLs for Butters, Stan, Shelby, and Dexter's underlying machine are only in
  that registry. **Never guess or fabricate an endpoint, port, or model ID.** If a needed
  endpoint isn't in the list above and you can't read the registry, ask the user.
- Prefer the stable Angela-side logical routes (e.g. Dexter :8460/:8461) over raw device
  URLs where they exist, so device changes don't break this code.
- Put all endpoints in one config file/module — never scattered hardcoded URLs.
- Model assignments for THIS plan:
  - **Beat extraction (Phase 1A):** a local fleet model via its OpenAI-compatible
    endpoint (default: Angela Qwen :1237; configurable). Extraction is a structured
    task — a smaller node is acceptable if the user prefers.
  - **Reader pass (Phase 2B) and Arm C (Phase 5):** the **Anthropic API directly**
    (`https://api.anthropic.com/v1/messages`, standard Anthropic SDK; user has
    credentials). This must NOT be a fleet model — it must be a different model family
    than the prose writer.
  - **Arms A/B (Phase 5):** the same endpoint the production Ghostwriter uses
    (discover it in Phase 0; expected to be Angela Qwen :1237).

---

## Phase 0 — Prose Lab (capture only)

**Goal:** Every generation call's exact final compiled prompt and raw output are persisted
for later analysis and A/B testing. Zero behavior change.

### Tasks

0.1 Survey the repo. Produce `docs/pipeline-map.md`: the real names/locations of the
    prompt assembly functions, the scene generation entry point, the validators, the
    repair loop, scene storage schema, and export path. Also document exactly how UBS
    currently calls its models (client library, base URLs, config location) and flag any
    dead Ollama/LiteLLM references as legacy to be ignored. Everything below must use the
    real names and real endpoints you find.

0.2 Create a `proseLab` module with one function, e.g. `captureGeneration(record)`.
    Wrap (do not modify) the scene-generation call site so that when `PROSE_LAB_CAPTURE`
    is on, it stores:

```json
{
  "id": "uuid",
  "timestamp": "iso8601",
  "projectId": "...",
  "bookId": "...",
  "chapter": 12,
  "sceneId": "...",
  "attempt": 1,
  "model": "qwen3.6-35b-uncensored",
  "temperature": 0.75,
  "compiledPrompt": "FULL exact final prompt string",
  "promptCharCount": 91234,
  "promptSections": {"foundation": 41200, "rules": 22000, "recentProse": 3900, "...": 0},
  "output": "FULL raw model output",
  "outputWordCount": 812,
  "accepted": true,
  "repairReason": null
}
```

0.3 Add a tiny report command/script: `proselab summary <bookId>` → per-scene prompt
    sizes, section breakdown, attempt counts. This is the evidence base for Phase 5.

### Acceptance
- A full book generation with the flag ON produces one capture record per attempt.
- With the flag OFF, no observable difference anywhere (verify by diffing an export).

---

## Phase 1 — Write the new data (nothing reads it yet)

**Goal:** Grow the two missing memories: the **beat ledger** (what has been dramatized)
and the **scene delta** (what each planned scene is for).

### 1A. Beat Ledger

After a scene is **accepted** by the existing pipeline, run a cheap extraction call
(this is extraction, not creativity — a local fleet model via its OpenAI-compatible
endpoint is fine; see MODEL INFRASTRUCTURE section for endpoints and rules)
that produces structured beat entries. Store them; nothing consumes them yet.

Schema (one row per beat, several per scene):

```json
{
  "beatId": "uuid",
  "bookId": "...",
  "chapter": 12,
  "sceneId": "...",
  "sceneOrdinal": 47,
  "beatType": "confrontation | revelation | emotional_beat | decision | relationship_shift | setpiece",
  "participants": ["Mara", "Lewis"],
  "subject": "the missing ledger",
  "summary": "Lewis confronts Mara about the missing ledger; she decides not to mention the photograph.",
  "emotionalCore": "distrust -> reluctant cooperation",
  "outcome": "Mara withholds the photograph",
  "onPage": true
}
```

Extraction prompt (draft — tune during Phase 2 calibration):

```
You are indexing a novel scene for a repetition-detection system. Read the scene and
output ONLY a JSON array of beat objects. A beat is a dramatic unit the READER
EXPERIENCES on the page: a confrontation, a revelation shown (not merely referenced),
an emotional beat landed, a decision made, a relationship shift, or a major setpiece.
Do not index background facts, references to past events, or scenery.
For each beat: beatType, participants (canonical names), subject (a short noun phrase),
summary (one sentence), emotionalCore ("state -> state"), outcome (one clause).
Typically 1-4 beats per scene. Output JSON only.
```

Rules:
- Extraction failures must never block scene acceptance — log and continue.
- Add a backfill command: `beats backfill <bookId>` that runs extraction over an
  already-finished manuscript. This is required for Phase 2.

### 1B. Scene Delta (outline layer)

Add a `delta` field to the planned-scene structure, populated at outline time:

```json
{
  "delta": {
    "newInformation": "Lewis learns the ledger is missing",
    "stateChange": "Mara now actively concealing the photograph",
    "conflictType": "interpersonal_confrontation",
    "participants": ["Mara", "Lewis"]
  }
}
```

- Extend the outline-generation prompt minimally to request this field (this is the
  planner prompt, not the writer prompt — allowed).
- Tolerate its absence (older projects) everywhere.
- Add `deltas backfill <bookId>` deriving deltas from existing outlines/scenes.

### Acceptance
- Generating a book with `BEAT_EXTRACTION` on yields a populated beat ledger.
- Backfill runs cleanly on at least one finished manuscript.
- Flags off ⇒ byte-identical behavior to today.

---

## Phase 2 — Detection as reports only (calibrate on known-bad books)

**Goal:** Build the two detectors and prove they find the repetition the user already
knows is in the finished manuscripts (e.g., *The Absence*, the *False* series). No gates,
no pipeline wiring — reports only.

### 2A. Mechanical sweep (pairwise beat comparison)

The function the global acceptance test demands. E.g.
`compareScenes(sceneA, sceneB) -> { score, matchedBeats[] }` built on
`compareBeats(a, b)`:

- Same `beatType` (or adjacent types: confrontation ≈ emotional_beat when participants
  and subject match): required.
- Participant overlap (Jaccard on canonical names): weighted.
- Subject similarity: normalized string/synonym match; if the repo already has an
  embeddings utility, cosine similarity on `subject + summary`; otherwise implement a
  deterministic fallback (do not add a heavy dependency just for this).
- `emotionalCore` similarity: weighted.
- Scene distance damping: near-adjacent scenes intentionally continue arcs; weight
  repeats MORE heavily when far apart (that's when readers feel the rerun).

Sweep: all scene pairs in a book (a few thousand comparisons — trivial). Output a report:

```
REPETITION SWEEP — "The Absence"
Pairs above threshold (0.72): 6
1. ch4/s2 <-> ch12/s1  score 0.91
   confrontation: Mara+Lewis re: the photograph — near-identical emotionalCore
   recommendation: keep ch4/s2 (first staging), cut/compress ch12/s1
...
```

### 2B. Reader pass (different model, one job)

A frontier model via the **Anthropic API directly** (see MODEL INFRASTRUCTURE — not a
fleet model, not any local gateway) reads the manuscript in large sequential windows (~15–20k words with
~2k overlap), carrying forward a compact running "already seen" list it maintains itself.
Its ONLY job:

```
You are reading this novel as an attentive reader. Your single task: flag any scene,
confrontation, revelation, or emotional beat that feels like a RERUN of something
earlier in the book — the "wait, didn't this already happen?" feeling. Do not comment
on prose quality, style, pacing, or anything else. Output JSON:
[{ "location": "chapter/approx paragraph", "echoOf": "earlier location",
   "what": "one sentence", "confidence": "high|medium|low" }]
Also output an updated compact running list of major beats seen so far (for the next window).
```

Merge window outputs into one report, deduplicated.

### 2C. Calibration loop (do not skip)

1. Backfill beats for 2+ finished manuscripts the user considers repetitive.
2. Run both detectors. Present both reports.
3. The user marks true/false positives and known misses.
4. Tune: extraction prompt, comparison weights, threshold, window size.
5. Exit criterion: on known-bad books, the sweep catches the user-confirmed repeats with
   few false positives, and the reader pass independently corroborates the worst ones.
   **Do not proceed to Phase 3 until the user confirms calibration.**

### Acceptance
- `sweep <bookId>` and `readerpass <bookId>` produce reports on finished manuscripts.
- User-confirmed calibration on at least two known-bad books.

---

## Phase 3 — Prevention gates (cheap, upstream)

**Goal:** Stop repetition before generation spends tokens.

### 3A. Outline delta gate (`OUTLINE_DELTA_GATE`)

After outline generation, before any prose: pairwise-compare scene deltas
(same `conflictType` + high participant overlap + similar `newInformation`/`stateChange`
⇒ duplicate dramatic job). On hit: warn by default (list the pair, suggest merge/cut/
differentiate); optional strict mode blocks until resolved. This is the cheapest fix in
the entire system.

### 3B. Do-not-restage block (`DO_NOT_RESTAGE_BLOCK`)

When compiling a scene's writer packet, query the beat ledger for entries sharing
participants or subject with the current scene. Inject at most:

```
ALREADY SHOWN TO THE READER — do not restage, only reference if needed:
- Mara's grief over her father (ch. 4)
- The Mara/Lewis ledger confrontation (ch. 7)
- Lewis discovering the forged signature (ch. 9)
```

Hard caps enforced in code: **max 5 entries, max 400 characters, relevance-filtered.**
This is the ONLY addition permitted to the writer prompt, and ideally it is paired with
an equal-or-larger trim elsewhere (see Phase 5). If the packet is already over a size
budget, drop this block rather than exceed the budget.

### Acceptance
- A deliberately duplicated outline (test fixture) triggers the gate.
- The restage block appears, capped, only when relevant beats exist; total prompt size
  does not grow beyond the pre-existing size (verify via Prose Lab captures).

---

## Phase 4 — Deletion authority (the cut path)

**Goal:** The second half of the global acceptance test: accepted prose can be removed.

### 4A. Scene status

Add `proseStatus: "active" | "compressed" | "cut"` (default `active`) plus
`statusReason`, `statusSetBy` (`user` | `sweep`), `bridgeText`. Reversible: setting back
to `active` restores exactly what was there. Never delete prose content.

### 4B. Export integration (`EXPORT_REPETITION_GATE` optional, `CUT_PATH` required)

- `cut` scenes: skipped at export/compile.
- `compressed` scenes: replaced by `bridgeText` (1–3 sentences), merged into the adjacent
  scene rather than standing alone.
- Bridge text generation is the ONLY generation in this system. Prompt inputs: the beat
  summary of the compressed scene, the last ~200 words of the preceding scene, the first
  ~100 words of the following scene. Output: 1–3 sentences of past-reference narration
  ("They'd had this argument before; neither had the stomach for it again."). User can
  edit bridge text directly.

### 4C. Review workflow

`sweep --review <bookId>`: for each flagged pair — show both scenes side by side, the
matched beats, and a recommendation (default policy: keep the FIRST staging; keep the
later one instead only if the sweep scores it substantially stronger by length/beat
count of unique material). User chooses per pair: keep both / cut B / compress B /
cut A / compress A. Every action logged.

### 4D. Autonomy (later, user-initiated only)

`CUT_PATH_AUTONOMOUS` (default off): sweep applies its recommendations automatically and
`EXPORT_REPETITION_GATE` refuses to compile while any pair scores above threshold.
Do not enable by default; the user flips it after the recommendations have proven
correct across several books.

### Acceptance
- Cutting and compressing scenes changes the export accordingly; restoring a scene
  returns the export to byte-identical.
- Full loop on one known-bad backfilled manuscript: sweep → review → cut/compress →
  re-export → re-run sweep shows the flagged pairs resolved.

---

## Phase 5 — Prose Lab experiments (the ChatGPT-audit fixes, proven before adopted)

**Goal:** Address the other audit findings (prompt overload, hard word minimums,
universal rhythm math, model ceiling) as controlled experiments using Phase 0
infrastructure — not as edits to the live path.

Build `proselab experiment <sceneId>` that reruns one captured scene under variant
configurations and stores outputs side by side:

- **Arm A (baseline):** the captured production prompt, unmodified, same model.
- **Arm B (thin packet, same model):** scene objective + required events + relevant cast
  and state only + exact last ~600 words of prose + voice fingerprint + the Phase 3
  restage block. NO full outline, NO mystery/twist track, NO global rhythm math,
  NO anti-repetition manifesto, NO hard word minimum — instead:
  `Expected range: X–Y words. End when the scene's event and exit condition have landed.
  Never pad to reach a count.`
- **Arm C (thin packet, frontier model):** identical packet to B through the Anthropic API.

Output a blind-review sheet (randomized labels) covering: redundancy, padding, dialogue
authenticity, repeated sentence shapes, distinctiveness, continuity, "which would you
keep reading?" The user scores; results decide whether B (and/or C) becomes the
production path. **Only after B or C wins on multiple scenes do you touch the production
prompt assembly — as a separate, explicitly approved change.**

Also convert the numeric rhythm rules into a post-hoc diagnostic: a scorer that measures
sentence-length distribution, opening-shape variety, and banned-pattern frequency on
OUTPUT prose and writes it to the Prose Lab record. This preserves the year of anti-slop
knowledge as measurement instead of prompt mass.

### Acceptance
- A/B/C runs exist for at least 5 problem scenes across 2 books, with recorded scores.
- Rhythm diagnostics computed post-hoc on every captured generation.

---

## Build order & dependencies

```
Phase 0 (capture)          — no dependencies
Phase 1 (beat ledger, deltas) — no dependencies
Phase 2 (detectors + calibration) — needs 1 backfill; GATE: user sign-off
Phase 3 (gates)            — needs 2 calibrated
Phase 4 (cut path)         — needs 2 calibrated; independent of 3
Phase 5 (experiments)      — needs 0 only; can run in parallel from the start
```

Stop-anywhere property: each phase delivers standalone value. Phase 2 alone gives the
user a diagnostic that pinpoints every rerun in every book.

## What NOT to do (failure modes to actively avoid)

- Do not add any instruction, rule, warning, or ban to the writer prompt beyond the
  capped Phase 3 block. The prompt is the disease; you are not its next symptom.
- Do not fix a flagged repetition by regenerating the scene. Fixes are cut, compress,
  or (Phase 5, experimental path only) a thin-packet rewrite.
- Do not reference, import, configure, or shim Ollama or LiteLLM in any form. They are
  not part of this stack and have not been for over a month. All local inference is
  llama.cpp OpenAI-compatible endpoints; frontier calls go straight to the Anthropic API.
- Do not guess or fabricate any endpoint, port, or model ID. Use the confirmed list, the
  :8790 registry, or ask.
- Do not run detection through the same local model family that wrote the prose for the
  reader pass — it cannot see its own habits. Extraction (1A) may use the local model;
  the reader pass (2B) must not.
- Do not hard-delete anything. Status flags only.
- Do not skip Phase 2 calibration on known-bad manuscripts. Detectors that haven't
  caught known repetition are decoration.
- Do not enable any gate, block, or autonomous cut by default. Flags off, user opts in.
