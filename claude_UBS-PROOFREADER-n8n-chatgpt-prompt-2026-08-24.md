# PROMPT FOR CHATGPT — build the "UBS Proofreader" n8n workflow
Written by Claude (Cowork) 2026-08-24 from the UBS repo at `2cfa197` and the Aug-23 fleet snapshot.
Paste everything below the line into ChatGPT. Attach two files with it:
`ubs-proofreader-detector-pack.js` (sha256 starts `2d2b5062f5604464`) and `proofreader-fixture-redux-mini.json`.

---

You are building one production n8n workflow family called **UBS Proofreader** for Unity Publishing's local
book factory (Unity Book Studio, "UBS"). Read this whole brief before you write a single node. When you
finish, hand back the exported workflow JSON files, the env vars they need, and the results of the
acceptance tests in §12 — with raw output, not a summary that says "it worked".

## 1. What this workflow is for

UBS drafts novels with local llama.cpp models. Its own polish stage has a documented history of *breaking*
prose by editing it with regex (290 subjectless sentences in one shipped book, "Zin were ridiculous",
"Looked at Rodge.", paragraphs flattened, quotes eaten). The rule the app adopted is:
**detect deterministically, then regenerate the smallest possible unit with a model, verify the
regeneration deterministically, and if verification fails N times, FLAG it for the human — never edit
prose with string replacement.** The app has the *detect* half built; the *regenerate-and-verify* half is
what you are building, outside the browser, as an unattended n8n run.

The Proofreader takes a whole fiction manuscript (chapters as markdown), produces an issue ledger,
fixes every ledger item it can prove it fixed, flags the rest, and returns the revised chapters plus a
report. The UBS app starts the job from a button, polls for progress, and saves the result itself.
**You are not building anything inside the UBS app** — only the n8n side and its HTTP contract.

Scope for this version: **fiction only** (including adult/explicit fiction — the writer model is
uncensored on purpose; never add content filtering). Nonfiction jobs are accepted but every item is
flag-only (no rewrites), because nonfiction rewrites need a source check this version does not do.

## 2. Non-negotiable rules (encode these; the acceptance tests check them)

1. **No deterministic prose mutation, ever**, with exactly one exception: stripping model control tokens
   (`<|im_end|>`, `<think>` blocks, etc.) using the pack's `stripModelControlTokens`. No regex
   replacements, no synonym swaps, no word deletions, no "smart quote fixes". If you find yourself
   writing `.replace(` against chapter text anywhere except splicing a *verified* candidate into the
   exact target span, stop.
2. **Only the WRITER model writes prose.** No fleet agent (Edith, Angela, Stan, Dexter, Shelby, Eric,
   Mabel, Kathy) ever produces replacement prose. They read, judge, route, and report.
3. **Smallest unit.** A fix touches one sentence (or one paragraph for the two paragraph-scope classes),
   never a scene or a chapter. The writer sees the target plus one paragraph of context each side, the
   cast list, and one instruction. It never sees the whole chapter.
4. **Every candidate is verified deterministically** with the pack's `verifyCandidate` before it is
   spliced. Splicing uses the pack's `applyReplacement`, which refuses if the paragraph count changes.
5. **Attempts are bounded.** `options.maxAttemptsPerItem` (default 3). After that the item becomes
   `flagged` with the last rejection reason. Flagged is a success state, not an error.
6. **Every change is reversible.** Persist the original chapter text before the first splice; persist
   before/after for every accepted item. The result must carry `before_hash`/`after_hash` per chapter.
7. **Chapter regression gate.** After a chapter's items are processed, run `regressionCheck(original,
   revised)`. If it fails (new fix-class findings introduced, paragraph count changed, or word count
   drifted >3%), revert that chapter to its original text, mark every item in it `reverted`, and continue
   with the next chapter. Never ship a chapter that regressed.
8. **Route by capability, not model name.** Endpoints live in one registry (§4). No node hardcodes an IP
   or model id; the writer's model id is read live from `GET /v1/models` at job start.
9. **Progress is observable at all times** via the status endpoint (§5). Update it at every phase change
   and at least once per ledger item.
10. **Idempotent.** Running the Proofreader on its own output must produce zero `fix`-action items (only
    `flag`s may remain). This is acceptance test 12.5.

## 3. The detector pack (attached: `ubs-proofreader-detector-pack.js`)

This is the UBS app's own detector and verifier code (`src/lib/malformedSentence.js`,
`subjectRepair.js`, `simileRecast.js`, `introGuard.js`, `crossChapterDedupe.js`, `pronounLock.js`,
`qualityScan.js`, `aiSlopReduction.js`, `povTense.js`, `modelLeakGuard.js`) bundled into one
self-contained IIFE that defines a global `UBS_DETECTORS`. It has no network, DOM, or LLM calls, and it
runs under Node 18+ (it uses regex lookbehind). Use it **verbatim** — do not rewrite the detectors in
your own words; their exact behaviour is what the app's export gates agree with.

How to load it in n8n: paste the whole file at the top of a **Code node (JavaScript, "Run Once for All
Items")**, then use `UBS_DETECTORS.*` below it. If the n8n instance allows `fs`
(`NODE_FUNCTION_ALLOW_BUILTIN=fs`), you may instead store it at `$UBS_PROOFREADER_HOME/detector-pack.js`
and `eval(fs.readFileSync(...))` once per Code node — but pasting inline is the default. Put the pack in
a **sub-workflow named `UBS Proofreader · Detectors`** with three operations selected by an input field
`op`, so it is pasted exactly once:

| `op` | input | returns |
|---|---|---|
| `ledger` | `{ chapters, project, cast_names?, options? }` | `buildLedger(...)` → `{ ledger, chapters, cast, pronounCanon, summary }` |
| `verify` | `{ item, candidate, chapterText, cast, pronounCanon, bookNorms? }` | `verifyCandidate(item, candidate, ctx)` → `{ ok, reason, applied? }` |
| `apply` | `{ chapterText, item, applied }` | `applyReplacement(...)` → `{ text, ok, reason }` |
| `regression` | `{ originalText, revisedText, chapter_number, project, cast, options }` | `regressionCheck(...)` → `{ ok, introduced, paragraphs, words, ... }` |
| `strip` | `{ text }` | `UBS_DETECTORS.raw.stripModelControlTokens(text)` → `{ text, ... }` |

Ledger item shape (from `buildLedger`):
```json
{ "id": "L0007", "chapter_id": "c1", "chapter_number": 1,
  "class": "SIMILE_DENSITY", "kind": "over-budget", "severity": "style",
  "action": "fix", "scope": "sentence", "target": "<exact sentence text>",
  "paragraph_index": 1, "detail": { "verifier": "verifySimileRecast", "per1k": 9.1, "budgetPer1k": 3 } }
```
Add these runtime fields yourself and keep them updated: `state` (`pending | fixing | fixed | flagged |
stale | reverted | skipped`), `attempts` (int), `last_reason` (string), `applied` (string, when fixed),
`verified_by` (`deterministic` | `deterministic+eric`).

Classes and what to do with each (this table is the contract — implement it exactly):

| class | kind(s) | action | scope | writer instruction | verifier |
|---|---|---|---|---|---|
| `MODEL_LEAK` | control-token | `strip_deterministic` | chapter | none (no model) | re-run detector = 0 |
| `MALFORMED` | dropped-subject, bare-verb | fix | sentence | **subject-only** (§7.1) | `verifyCandidate` (exact subject-prefix rule; a rewrite is rejected on purpose) |
| `MALFORMED` | agreement, name-echo | fix | sentence | single-sentence recast (§7.2) | `verifyCandidate` |
| `SIMILE_DENSITY` | over-budget | fix | sentence | simile removal (§7.3) | `verifyCandidate` (rejects any surviving "like a / as if / as though") |
| `SLOP_FAMILY` | one of the SLOP_BUDGETS family names | fix | sentence | single-sentence recast, family phrase banned (§7.2) | `verifyCandidate` |
| `CROSS_DUP` | verbatim-12w | fix | sentence (later chapter) | single-sentence recast (§7.2) | `verifyCandidate` |
| `PRONOUN` | canon-violation | fix | sentence | pronoun correction (§7.4) | `verifyCandidate` + **Eric** |
| `PRONOUN` | variable-scene-drift | flag | scene | — | — |
| `INTRO_DUP` | self-intro-repeat | fix | paragraph | remove second self-introduction (§7.5) | `verifyCandidate` (paragraph rules) + **Eric** |
| `WORD_REPETITION` | over-cap | flag | chapter | — | — |
| `POV_DRIFT` / `TENSE_DRIFT` | — | flag | chapter | — | — |

If `job.book_type !== 'fiction'`, force every item's `action` to `flag` before the fix loop.

## 4. The fleet registry (route by capability)

Store this as a single JSON in n8n (a Set node at the top of the main workflow, or `$env`). Every HTTP
Request node reads its base URL from here. Angela = the Mac Studio the book engine lives on.

```json
{
  "WRITER":   { "who": "book engine on Angela", "base": "http://100.95.98.74:1237/v1", "ctx": 32768, "note": "Qwen3.6 35B, RESERVED FOR BOOK WORK. Read model id from /v1/models at job start. Never send more than ~6k tokens per request." },
  "DECIDE":   { "who": "Angela",  "base": "http://100.95.98.74:8465/v1", "ctx": 65536, "note": "optimized chain → :8464 → :1238 Gemma 4 12B abliterated" },
  "VERIFY":   { "who": "Eric",    "base": "http://100.75.5.76:1236/v1",  "ctx": 65536, "note": "RAW endpoint on purpose — do NOT route verification through the LeanCtx-compressed path (:8463/:8462/:8459); Eric must see exact before/after text, uncompressed." },
  "UNDERSTAND": { "who": "Edith", "base": "http://100.115.40.17:1235/v1", "ctx": 65536 },
  "CREATE":   { "who": "Mabel",   "base": "http://100.113.64.18:43827/v1", "ctx": 4096, "note": "prompt repair only; 4k context — never send prose longer than ~1500 words" },
  "PROTECT":  { "who": "Kathy",   "base": "http://100.112.170.126:18473/v1", "ctx": 4096, "note": "exception packets only, ≤ 600 tokens" },
  "ACT":      { "who": "Shelby",  "base": "http://100.110.221.79:1236/v1", "ctx": 8192, "note": "not used in v1" },
  "BUILD":    { "who": "Dexter",  "base": "http://100.84.61.90:1236/v1", "note": "not used in v1" },
  "DISCOVER": { "who": "Stan",    "base": "http://100.102.234.19:1236/v1", "note": "not used in v1 (nonfiction sourcing is v2)" }
}
```
Hands off: Angela `:8080` (a different llama router), `:8081` (the UBS app's own router), `:8642`.
All endpoints are OpenAI-compatible `POST /v1/chat/completions`. Send `chat_template_kwargs:
{ enable_thinking: false }` and append ` /no_think` to the user message for every Qwen call (WRITER,
VERIFY, PROTECT); the Gemma endpoint ignores it harmlessly.

Ask Cliff (do not guess) for: the n8n base URL and whether n8n runs on Angela or elsewhere; the
absolute path for `UBS_PROOFREADER_HOME` (job state directory) and confirmation it is inside
`N8N_RESTRICT_FILE_ACCESS_TO`; whether the n8n Code node may exceed 100 KB of source (the pack is 73 KB).

## 5. HTTP contract (the UBS app is being built against exactly this)

All four are Webhook nodes on the main workflow. All responses are JSON. `job_id` is a UUID v4 you
generate. **`start` must respond within 2 seconds** — return the id, then continue the run via
`Execute Workflow` with *Wait for completion = false* (or a queue-mode worker).

`POST /webhook/ubs-proofreader/start`
Body = the job payload (§6). Response: `{ "job_id": "…", "state": "queued" }`.
Validation failures → HTTP 400 `{ "error": "…" }`.

`GET /webhook/ubs-proofreader/status?job_id=…`
```json
{ "job_id": "…", "state": "queued|intake|inventory|triage|fixing|regression|assembling|done|failed|cancelled",
  "phase_label": "Fixing · Ch 7 of 24 · MALFORMED 3/9",
  "progress": { "chapters_total": 24, "chapters_done": 6, "items_total": 312, "items_fixed": 41,
                "items_flagged": 5, "items_pending": 266, "items_reverted": 0, "percent": 17 },
  "started_at": "ISO", "updated_at": "ISO", "error": null,
  "events_tail": [ { "t": "ISO", "msg": "L0041 fixed (SIMILE_DENSITY) attempt 1" } ] }
```
`percent` = 5 (inventory done) + 90 × items_processed/items_total + 5 (assembled). Unknown job_id → 404.

`GET /webhook/ubs-proofreader/result?job_id=…`
While not `done`: HTTP 409 `{ "state": "…" }`. When done:
```json
{ "job_id": "…", "state": "done",
  "chapters": [ { "chapter_id": "…", "chapter_number": 1, "content_md": "<revised or original text>",
                  "changed": true, "before_hash": "sha256", "after_hash": "sha256",
                  "items_fixed": 9, "items_flagged": 1, "reverted": false } ],
  "ledger": [ /* every item with its final state, attempts, last_reason, applied */ ],
  "report": { "summary_md": "<Edith's plain-language summary, ≤ 300 words>",
              "by_class": { "MALFORMED": { "fixed": 31, "flagged": 4 }, "...": {} },
              "flags_for_cliff": [ { "chapter_number": 3, "id": "L0012", "class": "...", "target": "...", "reason": "..." } ],
              "writer_model": "…", "detector_pack_version": "…", "duration_s": 1234 } }
```
`POST /webhook/ubs-proofreader/cancel` body `{ "job_id" }` → sets a cancel flag; the run stops at the next
item boundary, reverts the in-flight chapter to its original, and finishes with `state: "cancelled"` and a
result that contains only chapters completed before the cancel.

## 6. Job payload (what the UBS app POSTs to `start`)

```json
{
  "job":     { "project_id": "…", "title": "…", "book_type": "fiction", "content_lane": "adult|general",
               "spice_level": 0, "pov_mode": "third_limited", "tense": "past", "genre": "…" },
  "project": { "characters_md": "<the book's character sheet, markdown>",
               "banned_words": ["…"], "banned_names": ["…"], "author_voice_notes": "…" },
  "chapters": [ { "chapter_id": "…", "chapter_number": 1, "title": "…", "content_md": "…" } ],
  "options": { "simileBudgetPer1k": 3, "simileMinWords": 400, "maxAttemptsPerItem": 3,
               "eric_mode": "risky", "classes_enabled": null, "dry_run": false }
}
```
`eric_mode`: `risky` (default: Eric reviews PRONOUN and INTRO_DUP fixes only) · `all` (Eric reviews every
accepted candidate) · `off`. `classes_enabled`: null = all, else an array of class names. `dry_run`:
build the ledger and return it as the result with no writer calls.

Persist everything under `$UBS_PROOFREADER_HOME/jobs/<job_id>/`: `job.json` (payload), `status.json`,
`ledger.json`, `chapters/original/<chapter_id>.md`, `chapters/revised/<chapter_id>.md`,
`events.jsonl`. The status and result endpoints read from these files, so they work even if the main run
is on another worker.

## 7. The fix loop (per chapter, items in this order: MODEL_LEAK → MALFORMED → PRONOUN → INTRO_DUP → CROSS_DUP → SLOP_FAMILY → SIMILE_DENSITY)

For each `fix` item: build the packet → call WRITER → normalize the reply (first line only; strip
control tokens, code fences, surrounding quotes, "Here is…" preambles) → `verify` → (Eric if required)
→ `apply` → record. Temperatures per attempt: 0.3, 0.5, 0.7. On attempts 2–3 append
`Previous attempt was rejected because: <last_reason>. Try again.` to the user message.
If `apply` returns `target-not-found` (an earlier fix changed this sentence), mark the item `stale`; after
the chapter's loop, rebuild the ledger for that chapter once and process only *new* fix items
(one extra pass, never more).

Context block sent with every packet (as the user message, before the instruction):
```
CAST: <cast names, comma-separated>   PRONOUNS: <pronounCanon lines>
BEFORE: <previous paragraph or "(chapter start)">
TARGET: <target sentence or paragraph>
AFTER: <next paragraph or "(chapter end)">
```

### 7.1 MALFORMED · dropped-subject / bare-verb — SUBJECT ONLY
System: `You restore a missing sentence subject. Answer with ONLY the subject: one of He, She, They, It, or a name from CAST. For a sentence that begins "A/An/The … <verb> …" you may answer "<Subject> felt". Nothing else — no sentence, no punctuation, no explanation.`
Then build `candidate = <answer> + " " + target with its first letter lower-cased` (or `"<Subject> felt " + …`) and verify. The verifier accepts only that exact shape and rejects a wrong-number ("Zin were") or wrong-gender subject.

### 7.2 Single-sentence recast (agreement, name-echo, SLOP_FAMILY, CROSS_DUP)
System: `You are a line editor. Rewrite exactly ONE sentence so it keeps the same meaning, point of view, tense, and tone. Return ONLY the rewritten sentence — no preamble, no quotes around it, no explanation. Keep every character name and object exactly as in the original. Never add a new name, place, or object. Keep roughly the same length. One sentence.`
Class-specific line appended: agreement → `Fix the subject–verb agreement.`; name-echo → `The sentence has a character looking at themselves — fix who is looked at using CAST.`; SLOP_FAMILY → `Do not use the phrase "<family key(s)>".`; CROSS_DUP → `This sentence appears verbatim in chapter <a>; say the same thing differently.`
Also append `Banned words: <project.banned_words>` when non-empty.

### 7.3 SIMILE_DENSITY
System (this is the app's own prompt — keep it): `You are a line editor removing an overused simile. You rewrite exactly one sentence so it keeps the same meaning, point of view, tense, and tone, but states the thing DIRECTLY instead of comparing it to something else. Rules: Return ONLY the rewritten sentence. No preamble, no quotes around it, no explanation. Do NOT use "like a", "like an", "as if", or "as though". Do not swap in a metaphor. Say what is literally there or what literally happens. Keep every character name and object exactly as in the original. Never add a new name, place, or object. Keep roughly the same length. One sentence.`

### 7.4 PRONOUN · canon-violation
System: as 7.2 plus `The character <name> uses <expected pronouns>. Correct only the pronouns that refer to <name>. Change nothing else.`

### 7.5 INTRO_DUP (paragraph scope)
System: `You are a continuity editor. This paragraph contains a character introducing themselves by name for the SECOND time in the chapter. Rewrite the paragraph so the self-introduction is removed or turned into a natural non-introduction, keeping every other sentence, all dialogue, all names, and the paragraph's length as close to the original as possible. Return ONLY the paragraph as a single paragraph (no blank lines).`

### 7.6 Eric (VERIFY) — semantic check for `risky` classes or when `eric_mode = all`
Send Eric the **original requirement + before + after**, never a summary. Force a JSON answer:
```
You are an independent verifier. Compare BEFORE and AFTER for one edit whose stated purpose is: <purpose>.
Answer ONLY this JSON: {"meaning_preserved": bool, "purpose_achieved": bool, "new_facts_or_names": bool, "pov_tense_intact": bool, "verdict": "ACCEPT|REJECT", "reason": "<≤20 words>"}
CAST: … PRONOUNS: …
BEFORE: … AFTER: …
```
REJECT counts as a failed attempt with `last_reason = "eric:" + reason`. If Eric is unreachable for 3
consecutive calls, Kathy decides (§9); default fallback is `eric_mode = off` for the rest of the run,
logged loudly in `events.jsonl` and in the report.

## 8. Chapter regression and assembly

After each chapter: `regression` op. On failure revert (rule 7). On success write
`chapters/revised/<id>.md` and hashes. When all chapters are done: `assembling` → Edith (UNDERSTAND)
turns the counts and flag list into `report.summary_md` (≤ 300 words, plain language, no marketing, must
name every chapter that was reverted and how many items are flagged) → `done`.

## 9. Kathy (PROTECT) — exception handling, deterministic first

Deterministic monitor rules run first; Kathy is only asked when they do not resolve it:
- WRITER call timeout (120 s) or 5xx → retry once after 10 s → still failing → `ASK_KATHY`.
- 5 consecutive item rejections in the same class → `ASK_KATHY` with the last 5 reasons.
- A single item taking > 6 minutes → `ASK_KATHY`.
- Disk write failure → `FAIL` immediately (no Kathy).
Kathy packet (≤ 600 tokens): `{ "anomaly": "…", "class": "…", "recent_reasons": [], "writer_alive": bool, "eric_alive": bool, "items_done": n, "items_total": m }` → she answers one word from `NORMAL | RETRY | REROUTE | RESTART | ESCALATE | ASK_CLIFF | FAIL`. Map: `RETRY` → wait 30 s, continue · `REROUTE` → set `eric_mode = off` (Eric issue) or skip the failing class for this job (writer issue) · `RESTART` → re-read `/v1/models` on WRITER, wait 60 s, continue · `ESCALATE`/`ASK_CLIFF` → finish the current chapter, then `state = failed` with `error` set and everything persisted so a rerun can resume · `FAIL` → same, immediately. Never loop on Kathy more than 3 times per job.

## 10. Mabel (CREATE) — optional prompt-repair loop (build it, default off: `options.mabel_prompt_repair = false`)

If a class's rejection rate exceeds 60% after ≥ 10 attempts, send Mabel the class's system prompt, the
last 5 rejected candidates and their reasons, and ask for a revised system prompt (≤ 120 words). Angela
(DECIDE) approves or rejects the revision with a one-word answer. Use the revised prompt for the rest of
the job only; log both prompts in `events.jsonl`. Never let Mabel or Angela see more than 1,500 words.

## 11. Workflow files to deliver

1. `UBS Proofreader · Main` — webhooks (start/status/result/cancel), validation, job persistence, phase state machine, calls the sub-workflows.
2. `UBS Proofreader · Detectors` — the pack, single Code node, `op` switch.
3. `UBS Proofreader · Fix Item` — one ledger item in, one result out (packet build → WRITER → normalize → verify → Eric → apply).
4. `UBS Proofreader · Chapter` — loops items for one chapter, stale pass, regression, revert.
5. `UBS Proofreader · Exceptions` — deterministic rules + Kathy.
Plus `README.md` (env vars, install order, how to run the fixture), and the exported JSON of each.

## 12. Acceptance tests — run them all and paste raw output

12.1 **Fixture ledger.** `POST start` with `proofreader-fixture-redux-mini.json` and `options.dry_run = true`. The result ledger must contain exactly these 12 items (ids may differ, classes/kinds/targets must match): 3× MALFORMED/dropped-subject ("Was wearing…", "Looked at Rodge.", "Looked back."), 1× MALFORMED/agreement ("Zin were ridiculous in that hat."), 1× MALFORMED/bare-verb ("A strange sense of relief wash over her."), 3× SIMILE_DENSITY, 1× SLOP_FAMILY/"small smile family" ("Sadie gave a small smile, but it was real." — the second occurrence), 1× INTRO_DUP (paragraph containing "I'm Nolan. I collect things"), 1× PRONOUN/canon-violation in chapter 2 ("Sadie tightened his grip…"), 1× CROSS_DUP in chapter 2 ("The long corridor beyond the hangar…"). Paste the ledger.
12.2 **Live fix.** Same fixture, `dry_run = false`. Expect ≥ 9 of 12 fixed, ≤ 3 flagged, 0 reverted, both chapters' paragraph counts unchanged (5 and 1), and `verifyCandidate` never accepting a "Maria" subject (banned/not-cast). Paste the result JSON.
12.3 **Status during run.** Poll `status` every 2 s during 12.2; paste at least 5 distinct snapshots showing `phase_label` and `percent` advancing.
12.4 **Cancel.** Start 12.2 again, cancel after the first status shows `fixing`; expect `state: cancelled` and revised text only for chapters that completed.
12.5 **Idempotency.** Feed 12.2's revised chapters back in with `dry_run = true`: zero `fix`-action items.
12.6 **Writer down.** Point WRITER at a closed port; expect the deterministic rule → Kathy → `state: failed` with a clear `error` within 5 minutes, all files persisted, no chapter changed.
12.7 **No-mutation audit.** `grep -n "\.replace(" ` across all delivered Code nodes: every hit must be either inside the pasted pack, in reply normalization (§7 first paragraph), or in the splice of a verified `applied` string. List each hit and its justification.

## 13. Things you will be tempted to do — don't

- Don't "improve" the detectors, the verifiers, or the app's simile prompt.
- Don't send whole chapters to the WRITER "for context"; 32k is the server's ceiling and the fix quality gets *worse* with more context.
- Don't let a 4B phone model (Eric, Kathy, Mabel) touch prose or receive more than its context budget.
- Don't add a "final polish pass". The output is the verified splices and nothing else.
- Don't invent a callback into the UBS app; it polls. Its store API is session-gated and you have no session.
- Don't hardcode `qwen3.6-35b…` as the model id; read it from `/v1/models`.

Before building, reply with (a) the questions in §4 you need answered, (b) a one-page node map of the five workflows, and (c) anything in this brief you believe is inconsistent. Then build.
