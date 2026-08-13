# Polish / Manuscript Audit — findings only, nothing changed

**Date:** 11 Aug 2026 · **Repo state:** `main` @ `86f9a7d`, working tree clean
**Constraint honoured:** read-only. No file in `src/` was edited. All demonstration
code ran in `/tmp/verify/`.

I ran this as an audit because you said Fable rebuilt much of this area. Everything
below is a finding for **you** to accept or reject. Some of it may be deliberate
design I don't understand — where I'm unsure, I say so.

Every item marked **EXECUTED** is one I ran myself and watched produce the bad
output shown. I am not inferring these from reading regexes.

---

## The headline

Two separate code paths are deleting real prose from finished chapters. They are in
different lanes and have different blast radii:

| Lane | Trigger | Guarded? |
|---|---|---|
| **Draft lane** — `postClean` via `cleanGeneratedProse` | every chapter generated | **No word/paragraph guard** |
| **Polish lane** — `antiDetectionPolish`, `dialogueTagPolish` via the runner | Polish button | Guards exist, but these slip under them |

The polish lane's guards are real and they work — I verified both. The problem is
that they measure **volume** (85% word retention, paragraph count), and the two
defects below remove 2–4 words from the middle of a sentence. A 3,000-word chapter
losing 4 words retains 99.9%. The guard cannot see it.

---

## TIER 1 — prose destruction (EXECUTED, high confidence)

### 1. `antiDetectionPolish.js:753-796` — the telling-tag reducer deletes the sentence's subject

Runs on **every fiction polish** (`manuscriptPolishRunner.js:638`).

Two compounding bugs in `TELLING_TAG_CAPS`:

- The pattern is `/\b(he|she|they|[A-Z]\w+)\s+felt\s+/gi`. The **`i` flag defeats
  `[A-Z]`**, so `[A-Z]\w+` matches *any* word. It captures whatever noun precedes
  the verb, not a character name.
- Line 790: `match.substring(match.indexOf(tag.name) + tag.name.length).trimStart()`
  is **always `''`**, because the regex ends in `\s+` and nothing follows it. The
  documented "He felt the cold → The cold" branch is dead code. The replacement is
  unconditionally the empty string.

What I ran, and what came back:

```
IN                                                    OUT
Everyone felt the ship list to port.               →  the ship list to port.
She felt the engine catch beneath her.             →  the engine catch beneath her.
The customs clerk thought otherwise…               →  The customs otherwise and said nothing.
He thought about the crates for a long while.      →  about the crates for a long while.
```

56 words → 48 (86% retained), paragraph count unchanged 7 → 7. **It passed both
runner guards and would have been saved.**

The caps are tight — `thought`, `realized`, `wondered`, `understood`, `sensed` are
capped at **1 per chapter**. Ordinary prose exceeds that constantly. Note also the
JSDoc at line 749 says the caps are 5/3/2/2; the table says 2/2/1/1. The code is
2–3× stricter than its own documentation.

The worst case is attribution collapse: `Tomas thought she was wasting her time.`
→ `she was wasting her time.` The narrator now asserts as fact what was one
character's opinion.

### 2. `postClean.js:237` — `capConsiderPhrases` eats to the end of the sentence

`/\bConsider (?:the|a)\b[^.!?\n]*/gi` is case-insensitive and unanchored, so it
matches **mid-sentence** on the ordinary verb "consider", and `[^.!?\n]*` then
consumes the rest of the clause. Capped at 1, so every occurrence after the first
is destroyed. `capYouMightPhrases` (line 241) has the identical shape.

```
IN : He paused to consider the weight of what she had asked, then set the cup
     down and looked out at the water.
     She would consider a different route in the morning, but not tonight.

OUT: He paused to .
     She would .
```

39 words → 12. **EXECUTED.**

### 3. `postClean.js:83` — closing quotation marks are deleted from every paragraph

`para.match(/[^.!?]+[.!?]+/g)` cannot capture anything after the paragraph's final
`.!?`, and the segments are rejoined with `''`. Every multi-sentence paragraph loses
its trailing characters.

I ran a 6-paragraph dialogue sample:

```
curly quotes in:  3 open / 3 close
curly quotes out: 3 open / 1 close
```

Closing `”` gone, closing `)` gone. This is worse than cosmetic: it manufactures the
"open quote with no close at paragraph end" state, which in correct English
typography means *continued speech*. Downstream quote repair then cannot tell damage
from intent.

Same run also deleted a whole paragraph (6 → 5, 91 → 72 words) via
`stripScaffolding` / `stripRecapBloat` (lines 265-271), which remove **the entire
line** when a trigger phrase appears anywhere in it:

```
IN : Dr. Reyes, as previously mentioned in her deposition, had signed the release
     herself and then vanished for six days.
OUT: (paragraph deleted)
```

`as previously mentioned` and `we will consider` are normal English — especially in
dialogue and in nonfiction.

### 4. `dialogueTagPolish.js:41` — context-free word swaps corrupt narration

`new RegExp('\\b' + entry.word + '\\b', 'gi')` matches every use of the word, not
just dialogue tags. Live in four places including the runner (line 30).

```
IN : The kettle hissed on the ring.
OUT: The kettle said through clenched teeth on the ring.
```

**EXECUTED.** Word count and paragraph count are preserved, so no guard fires.

This is exactly the failure the file's own comment at lines 101-113 documents — a
previous run produced "35 context-free swaps" and the breath-stem block was disabled
because of it. The same hazard is still active in `tagCaps`/`actionCaps` above it,
**including for the word `breathed`, which appears in both lists.**

---

## TIER 2 — reporting that is always wrong

### 5. `manuscriptPolishRunner.js:656` — `sceneDuplicateStats` is never assigned

Declared with all zeros at 656, returned at 1179, **never written to**. The real
numbers go to `anthologyStats.sceneDupes` (line 665), which no caller reads —
`sceneDupes` does not appear anywhere in `ProjectStudio.jsx`.

Consequence: the polish report renders `SceneDupes: 0 blocks/0 words/0 reported`
however much the sweep actually cut, and the audit trail written into
`revision_notes` records `SceneDup=0/0` for every chapter.

### 6. `manuscriptPolishRunner.js:69` — the NF anti-chatbot recast stage is missing

`runAntiChatbotRecastPipeline` is imported and **never called**. The function exists
(`antiChatbotRecastPipeline.js:969`). An import-usage scan of all 74 imported names
found this as the only one with zero call sites.

Two of Fable's own tests assert this stage exists by checking
`runnerSource.includes('runAntiChatbotRecastPipeline')` — which the import line
alone satisfies. False green.

---

## TIER 3 — verify yourself before acting

### 7. `manuscriptPolishRunner.js:1094` — NFGUARD-1 runs after the content-loss guards

Ordering I verified by reading: the global loss guard restores `f.content =
f.original` at **line 1039**; NFGUARD-1 then runs at **1094** and sets
`f.content = nfGuardSnapshots[gi]` — a snapshot taken at **line 465**, *after* the
NF pre-pass has already stripped text. So on nonfiction, NFGUARD-1 can overwrite the
loss guard's restore with the already-stripped version.

A subagent executed this and reported a 91-word chapter saved at 22 words with
`contentLossReverts: 0` and a change log claiming the polish was blocked. I did not
reproduce that end-to-end myself — I only confirmed the ordering. **Check this one
before you act on it.** Nonfiction only.

### 8. The upload-failure flags are never read

`prepareChapterContent` sets `content_md_upload_failed` / `content_md_preview_only`
when a GitHub offload fails, and `uploadViaGitHub` returns `null` rather than
throwing. Nothing in the polish save path reads either flag, and because nothing
throws, the 3-attempt retry loop never engages. Traced, not exercised.

---

## Test coverage — this is the part that surprised me

There are **two** test directories and I have only ever been running one.

| | files | run by |
|---|---|---|
| `test/*.acceptance.mjs` | 89 | my runner — the "89/89 green" I have been reporting |
| `tests/*.test.mjs` | 153 | `npm run test:narrative-connect` + `test:polish-pipeline` |

**110 of the 153 files in `tests/` are not referenced by any npm script.** They
include `contentLossGuards`, `polishPipelineIntegration`, `polishRunnerBehavioral`,
`surgicalFix`, `runnerAsyncAwaitGuard`, and 23 cover tests.

I ran five of them. **Four fail today:**

```
contentLossGuards.test.mjs        37 passed, 1 failed  — 1.11 Runner tracks flaggedForReview
polishRunnerBehavioral.test.mjs   37 passed, 1 failed  — NF recast uses conservative mode
polishPipelineIntegration.test.mjs 6 passed, 3 failed  — LLM polish / failed-LLM preservation
slopRegressionRevert.test.mjs               failed     — NF slop regression reporting
runnerAsyncAwaitGuard.test.mjs              PASSED
```

Those failures line up exactly with findings **5** and **6**. The tests already knew.
Nobody was running them.

---

## Two corrections to my own work

1. **My orphan scanner counts comment mentions as usage.** That is why it missed
   `manuscriptFixer.js`. Its output should not be trusted until I fix it.

2. **`manuscriptFixer.js` — 7,912 lines, unreachable, and unstamped.**
   `fixEntireManuscript` has exactly one mention outside its own file, and it's a
   comment in `ManuscriptDashboard.jsx:36` saying it is intentionally NOT imported.
   `tests/polishEntrypointGuard.test.mjs` exists to keep it that way. But the file
   carries no `DEAD CODE — DO NOT EDIT` header, so it is precisely the trap that
   Waves 5 and 9 stamped ten other orphans to prevent. Next person to "fix a polish
   bug" has an even chance of fixing it in the wrong file.

---

## What I'd suggest

Findings 1–4 are the ones that damage books. Each is a small, contained fix — 1 and
4 are a few lines; 2 and 3 are single regexes. None requires touching the
architecture Fable built.

But this is your call, and I have not touched any of it. Tell me which of these you
want fixed and I'll do them one at a time with a test each, the same way as the
previous waves.
