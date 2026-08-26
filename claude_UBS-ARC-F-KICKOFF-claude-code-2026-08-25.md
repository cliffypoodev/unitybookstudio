# ARC F KICKOFF — paste into a FRESH `claude` session in ~/Downloads/UBS
Written by Claude (Cowork) 2026-08-25 after closing Arc E (GATEPROMOTE-1 + EXPORTSCRUB-2) with a live PASS:
HEAD = origin/main = origin/agent/narrative-connect-1 = `7f2c7d2a`, branch `main`, at time of writing.

---

You're working in ~/Downloads/UBS on the Unity Book Studio repo. Read these FIVE files in full
before anything else — repo root, untracked on purpose, never delete or git-clean them:

1. claude_UBS-issue-breakdown-2026-08-24.md
2. claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md — Section 0 "Rules of the Road" governs
   everything. Follow it exactly. Do not skip, combine, or "improve adjacent code." Section 7 is Arc F.
3. claude_UBS-LIVEPROOF-ARC-B-C-2026-08-24.md — how the lane and STYLEBUDGET-2 behaved live.
4. claude_UBS-LIVEPROOF-ARC-D-2026-08-25.md — findings 14/15 are scheduled, NOT Arc F.
5. claude_UBS-LIVEPROOF-ARC-E-2026-08-25.md — Run 2 PASS; findings 21/23/24 are scheduled, NOT Arc F.

Other untracked things you'll see and must not touch: `.claude/`, `proofreader/`, every other
`claude_*.md`. `git status --porcelain` shows ~13 lines, all `??`. "porcelain 0" in the plan means
ZERO TRACKED changes.

## Where the repo actually is (supersedes the plan's stated numbers)

Landed: PREFLIGHT-1, Arc A, DEADTEST-1..6, Arc B, Arc C, Arc D (+1B/1C/STATECONTRACT-1B), Arc E
(PRONOUNLOCK-2B, REGENLANE-1B, GATEPROMOTE-1, EXPORTSCRUB-2). The export gate now judges STORED
prose and the live verdict equals the offline verdict — every live proof from here relies on that.
Verify before touching anything; STOP if any line disagrees:

```
cd ~/Downloads/UBS && git fetch origin
git rev-parse --short HEAD                              # 7f2c7d2a
git rev-parse --short origin/main                       # 7f2c7d2a
git rev-parse --short origin/agent/narrative-connect-1  # 7f2c7d2a   (one ref per line)
git branch --show-current                               # main
git status --porcelain | grep -v '^??' | wc -l          # 0
ls test/*.acceptance.mjs | wc -l                        # 131  (130 green + 1 quarantined)
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1
   # 130 green, 0 red, 1 quarantined. Record the exact green count and checks — your baseline.
```

Battery arithmetic (rule 0.4): Arc F adds exactly FOUR battery files — `test/stylebudget3.acceptance.mjs`,
`test/stylebudget2c.acceptance.mjs`, `test/fragbudget1.acceptance.mjs`, `test/namereg2.acceptance.mjs`
→ baseline + 4 = 134 green, 1 quarantined, checks strictly > baseline. No existing expectation changes
in this arc (nothing is retired), so any existing battery going red is a STOP.

Wave-era baseline: `test:narrative-connect` EXIT 0 (23/23). `test:polish-pipeline` file-by-file with
the alias loader: **19/20** green; reds are exactly researchAgentBehaviorRegression 6/69 and
llmProsePolisher 2/13 — both byte-for-byte unchanged at the end of the arc (`git diff --stat 7f2c7d2a..HEAD`
on them must be empty). `npm run build` must pass.

## DISCOVERY corrections (re-verified live 2026-08-25 at 7f2c7d2a)

- The plan's F1 says "Module `src/lib/templateFamilies.js`". **It does not exist yet** — you create it.
  The existing family machinery lives in `src/lib/aiSlopReduction.js`: `SLOP_BUDGETS` at **170**
  (five families, each `{ name, keys, budget, bookBudget }` — per-TEXT `budget`, per-BOOK `bookBudget`),
  `countAISlopPatterns` 295, `SIMILE_DENSITY_BUDGET_PER_1K = 3.0` 891, `measureSimileDensity` 893,
  `buildBookStyleLedger(priorTexts)` **907** (returns `{ families:[{name,keys,bookBudget,spent,exhausted}], simile }`),
  `buildStyleBudgetPromptBlock` 926. Reuse these — do not duplicate the ledger. Arc C retired every
  substitution in this file (POLISHSAFE-4, lines 429–476, 844–864): it FLAGS, it never edits. Keep it so.
- Regenerate lane: `src/lib/regenerateLane.js` (347 lines). `collectRegenTargets(text, { cast, departed,
  extraDetectors, maxUnits = 12 })` at **94**; `extraDetectors` contract at 89: `(text) => [{ kind,
  sentence, reason }]`; the loop that consumes them 147–160 (first claim on a paragraph wins).
  `verifyRegeneratedParagraph` **165** — check (5) at 191–197 rescans the candidate with
  `rescan = collectRegenTargets(candidateText, { cast, departed, extraDetectors, maxUnits: 1 })` (line 287)
  and rejects `still-flagged`. `regenerateFlaggedParagraphs` 252; lane SYSTEM prompt at 242 ("fix exactly
  the defect named"); `[REGENLANE] ${label}: targets N, regenerated N, skipped N` at 345 (zero-target line 275).
- Lane call sites (both get the new detectors): writer `src/lib/sceneWriter.js:3102–3106`
  (`extraDetectors: [detectBannedVocabulary, detectSameChapterSceneDuplicates, arcRestartDetector]`,
  `priorProse: priorChapterProse` is already in scope there); Fix Manuscript runner
  `src/lib/manuscriptPolishRunner.js:973–976` and the LLM-off report path **989** (both currently pass
  only `[detectBannedVocabulary]`; `priorProse` is computed at 970, `castForRegen` at 962). The runner's
  STYLEBUDGET-2 loop is 879–900 (`healSimileDensity(..., { callLLM: _simileLLMOverride, project, onProgress, label })`).
  Detector shape to copy: `detectBannedVocabulary` in `src/lib/vocabCaps.js:502–516`.
- Opening echoes: the plan says "already detected by BOOKGATE-2". True but too loose to feed a regeneration:
  `checkBookIntegrity` in `src/lib/pipelineValidator.js:247–262` calls two openings an echo when a 4-gram of
  chapter A's first 40 words has all four words ANYWHERE in chapter B's first 40 (set membership, not
  contiguous, stopwords count). On REDUX it reports **30** pairs, mostly `"of the gaudy galactie"` /
  `"of the elm fork"` — a ship and a town name plus function words. Leave BOOKGATE-2 alone (advisory
  telemetry, not this arc); write the precise detector in templateFamilies.js (F1c below). With the precise
  rule REDUX has **7** real pairs (e.g. two chapters opening "the sun was dipping", two on "stood at the helm",
  two on "the engine room smelled", two on "of ozone and burnt").
- F2: `src/lib/simileRecast.js` (186 lines). `SIMILE_RX` 28, `verifySimileRecast` **112–122** — the only
  reject reasons are `'simile-remains'` (117 and 121) and `''`; there is no separate "comparison-left" code,
  so the plan's "comparison-left reason" = `verdict.reason === 'simile-remains'`. `SYSTEM` prompt 125–132.
  `healSimileDensity` **147–186**: the call is at 168 (`callOne(userPrompt, SYSTEM, 220)` inside
  `Promise.race` with `timeoutMs`), verify at 174, reject log 176 (`[STYLEBUDGET-2] ${label}: recast rejected (${verdict.reason}) …`),
  accept at 179 (`out = out.replace(t.sentence, candidate)`). `callLLM(userPrompt, systemPrompt, maxTokens)` is the DI seam.
- F3: the plan says "reuse the finite-verb test from malformedSentence.js bare-verb logic". There is no
  finite-verb test there — `BARE_VERB_RX` (`src/lib/malformedSentence.js:16`) is a copula-list heuristic for
  one sentence shape, and the repo has no POS tagger (retext-english only, `package.json` 81–84). F3 gets its
  own lexical finite-verb evidence test (spec below). Reuse `splitSentences` (26–33) by export or copy its
  regex verbatim — do not invent a third splitter. `stripDialogue` is exported from `src/lib/povTense.js:246`.
- F4: the "Better"-style extractor is `extractProminentProseNames` in `src/lib/anthologyRenamePass.js:64–82`
  (called from `sceneWriter.js:4909`). It counts capitalised tokens ≥ 3 occurrences and drops any that also
  appear lowercase. A word that only ever opens sentences ("Better.", "Nothing.", "Maybe") and never appears
  lowercase survives as a "name". `nameRegistry.js` is NOT the target (its extractor reads characters_md).
- Live numbers on REDUX right now (offline, stored prose, 20 chapters, 81,422 words), so you know what the
  live proof will show:
  * simile density ≤ 3.0/1k on **5/20** chapters; book 3.44/1k (`[STYLEBUDGET] Gate telemetry: 4 exhausted famil(ies), book simile density 3.44/1k`).
  * book ledger: small-smile family 20/3, short-sharp 13/3, for-now 24/8, indifferent 23/5 — all exhausted.
  * lexical family totals across the book: "the weight of" 38, heartbeat 31, ozone 30, "for now" 24,
    indifferent 21, "short, sharp" 13, "really looked" 12, "small smile" 10, "but it was real" 10,
    "burnt sugar" 9, "heavy silence" 3. Every chapter has 3–9 family hits → F1 will produce lane targets in
    essentially all 20 chapters.
  * fragments (narration only, ≥3 words, no finite-verb evidence): 2.7–12.0 per 1k words per chapter,
    **0/20** over the 20/1k default → F3 fires ZERO lane targets on REDUX. That is the expected live
    result; the battery's positive control is a fixture, not this book.

## Arc F = §7 as written, with the contracts pinned down

Everything below is fiction-only through `isFictionProject(project)` from `src/lib/projectType.js`
(the runner’s `mode` string gates at 309/314/356/880 are legacy — do not add a second one; when you need the
project type, import `isFictionProject`). No new `book_type ===` literal anywhere (rule 0.3). Fixture names
Mara / Dov / Ilse only. Nothing in this arc edits prose deterministically: detectors produce lane targets;
the lane's LLM rewrites; `verifyRegeneratedParagraph` decides.

### F1. STYLEBUDGET-3 — `src/lib/templateFamilies.js` (new)
- `export const TEMPLATE_FAMILIES` — closed lexical list, one exported object, each
  `{ name, keys: [regex-safe strings], chapterBudget, bookBudget }`. Seed with the plan's list plus what REDUX
  shows: `ozone`; `burnt sugar`; regret-as-a-smell (`smell|smelled|smelt|scent … of … regret`); `small smile`;
  `but it was real`; `for now`; `indifferent`; `heavy silence`; `chest tightened|tightness`; `heartbeat`;
  `really looked`; `short, sharp`; `the weight of`. Chapter budgets 1 (2 for "for now"), book budgets from
  `SLOP_BUDGETS` where the family already exists there (keep the two lists consistent — if a key is in both,
  the numbers must match; add a battery check that asserts it).
- `export function findTemplateFamilyHits(text, { budgets = TEMPLATE_FAMILIES, spentByFamily = {} } = {})`
  → `[{ family, key, sentence, indexInText, overChapter: bool, overBook: bool }]` in document order, one hit
  per sentence per family (dedupe like `scanMalformedSentences` does). `spentByFamily[name]` = count in PRIOR
  chapters (from `buildBookStyleLedger`-style counting over `priorProse`).
- `export function makeTemplateFamilyDetector({ priorProse = [], budgets = TEMPLATE_FAMILIES } = {})` →
  `(text) => targets`. A hit is a target (kind `'template-family'`, reason
  `template "<key>" (<n>x this chapter, budget <b>; book <spent>/<bookBudget>)`) when EITHER it is the
  (chapterBudget+1)-th or later occurrence of that family in `text`, OR the family's book spend from
  `priorProse` is already ≥ `bookBudget` (then every occurrence is a target). Rescan semantics: the lane rescans
  ONE candidate paragraph with the same detector — so when `priorProse` shows the family exhausted, a candidate
  that still contains the key is `still-flagged` (correct), and when it is not exhausted a single-paragraph
  candidate with one key is under the chapter budget and passes. Accept that; do not add a second detector shape.
- F1c `export function findOpeningEchoes(chapterTexts, { castNames = [] } = {})` → `[{ earlier, later, gram }]`:
  first prose paragraph of each chapter (skip headings, `* * *`, `---`), first 40 words lowercased; an echo is a
  CONTIGUOUS 4-gram present in both openings with ≥ 2 content words (not in a small stopword set, not a cast
  name — cast supplied by the caller from `harvestCastNames`). `export function makeOpeningEchoDetector({ priorOpenings, castNames })`
  → `(text) => targets` of kind `'opening-echo'` on the CURRENT text's first paragraph only (reason names the
  shared gram and the earlier chapter number). The earlier chapter is never a target.
- Wire both detectors into the three lane call sites (writer 3105; runner 975 and 989). In the writer, prior
  openings and `priorProse` are already available; in the runner build them from `sortedLoaded.slice(0, idx)`
  exactly as `priorProse` is built at 970. Log `[STYLEBUDGET-3] ${label}: family targets N, opening-echo targets N`
  even at zero (the lane's own `[REGENLANE]` line already exists — do not duplicate it).
- The lane's SYSTEM prompt names "the defect"; the `reason` string is what it sees. Make the reasons read as
  instructions the model can act on ("replace the template phrase with a concrete, specific detail").

### F2. STYLEBUDGET-2C — one escalated retry in `healSimileDensity` (simileRecast.js 147–186)
When `verifySimileRecast` returns `{ ok:false, reason:'simile-remains' }` AND the ORIGINAL sentence matches
`/\bless like\b[\s\S]*\bmore like\b/i` (also accept "less of … more of"), retry EXACTLY ONCE with the same
user prompt and `SYSTEM` prefixed by the line `"State the contrast as a plain assertion; do not use 'like', 'as if', or 'as though'."`
Same `Promise.race` timeout, same `callOne`, same verifier; on a second reject, skip as today with reason
`verify-failed:simile-remains:retried`. Log `[STYLEBUDGET-2C] ${label}: escalated retry (accepted|rejected)`.
One extra LLM call per such sentence, still strictly sequential. Export `SIMILE_CONTRAST_RX` so the battery
tests the same regex the code uses.

### F3. FRAGBUDGET-1 — `src/lib/fragmentDensity.js` (new)
- `export const FRAGMENT_DENSITY_BUDGET_PER_1K = 20;`
- `export function findFragments(text)` → `[{ sentence, paragraphIndex }]`. Narration only (`stripDialogue`
  from povTense.js). A sentence is a fragment when it has 3–25 words AND no finite-verb evidence. Finite-verb
  evidence (exported list/regex, `FINITE_VERB_EVIDENCE_RX`): auxiliaries/copulas/modals (was were is are am be
  been being had has have do does did will would could should can may might must shall), any `n['’]t`
  contraction (didn't, wasn't, couldn't …) and `'s|'d|'ll|'re|'ve` clitics, any word ending in `-ed` of ≥ 4
  letters, and a closed list of ~120 common irregular past-tense forms (went came said took saw stood sat
  looked felt knew thought made got gave ran held left kept put told found heard began brought fell turned
  let met meant led lost paid read set shook spoke struck swung threw understood woke wore won wrote drew drove
  ate bit blew broke built caught chose cut dealt dug drank flew forgot froze grew hung hid hit hurt lay rose
  sent sang sank slid slept sold spent split spun stole stuck swept taught tore bought became bent bound bled fed
  fought fled flung clung crept slung strode shot shut sought sped spat stung swore leapt lit knelt dreamt
  ground wound rang sprang stank swam …). Skip scene breaks (`* * *`, `---`, `#` headings) and lines that are
  only a name or a time stamp. Precision over recall: a fragment that slips past is fine; a real sentence
  flagged as a fragment is not.
- `export function measureFragmentDensity(text)` → `{ fragments, wordCount, per1k }`.
- `export function makeFragmentDensityDetector({ budgetPer1k = FRAGMENT_DENSITY_BUDGET_PER_1K, maxTargets = 6 } = {})`
  → `(text) => targets` kind `'fragment-density'`: only when `per1k > budgetPer1k`; targets are the
  `maxTargets` densest paragraphs (≥ 2 fragments each), reason `fragment density X/1k over budget B — rewrite
  the fragments in this paragraph as complete sentences, keep the rhythm`. Rescan semantics (single candidate
  paragraph): flagged again only if that paragraph alone is over budget AND still has ≥ 2 fragments. Wire into
  the same three lane call sites. Log `[FRAGBUDGET-1] ${label}: fragments N (X/1k, budget 20), targets M` at zero too.

### F4. NAMEREG-2 — `extractProminentProseNames` (anthologyRenamePass.js 64–82)
Before a capitalised token counts, require ≥ 1 occurrence that is NOT sentence-initial: not at the start of
the text, not after `[.!?…]` + whitespace, not after an opening quote `“"‘'`, not at a paragraph start. Keep
the lowercase-elimination rule. Commit `NAMEREG-2-MID-SENTENCE-RULE`. No behaviour change for a real name
(which appears mid-sentence as subject/object constantly).

### Batteries (rule 0.4 — each ≥ the count stated, fixtures only)
- `test/stylebudget3.acceptance.mjs` (≥ 8): family hit over chapter budget → target; under budget → none;
  exhausted book spend → every occurrence a target; rescan of a single paragraph still-flagged when exhausted;
  SLOP_BUDGETS/TEMPLATE_FAMILIES numbers agree; precise opening echo found only for a contiguous 4-gram with
  ≥ 2 content words (the loose "of the <ship name>" case → none); the later chapter is the target, the earlier
  never; `regenerateFlaggedParagraphs` with a mocked `callLLM` regenerates a `template-family` paragraph and
  the verifier accepts it (one call, verified by mock call count); `[STYLEBUDGET-3]` line logs at zero.
- `test/stylebudget2c.acceptance.mjs` (≥ 5): mock `callLLM` whose first answer keeps "like", second does not →
  accepted with exactly 2 calls and the second call's system prompt starts with the escalation line; a sentence
  without the contrast shape is NOT retried (1 call); the retry happens at most once (mock rejects twice → 2 calls,
  skipped with `verify-failed:simile-remains:retried`); `SIMILE_CONTRAST_RX` matches "less like … more like";
  sequential (never two calls in flight — assert with a counter in the mock).
- `test/fragbudget1.acceptance.mjs` (≥ 7): the finite-verb evidence accepts "He didn’t move.", "She’d gone.",
  "Mara stood.", "The engine coughed."; rejects (i.e. flags as fragment) "Dov, stoic and dusty.", "A long
  corridor of rust and silence."; dialogue is ignored; scene breaks ignored; density ≤ 20/1k → zero targets on a
  fixture; > 20/1k → targets sorted densest-first, capped at 6; rescan of a candidate with 1 fragment passes;
  `[FRAGBUDGET-1]` logs at zero.
- `test/namereg2.acceptance.mjs` (≥ 4): "Better." ×3 at sentence starts → not a name; "Mara" ×3 with one
  mid-sentence → name; a token after an opening quote counts as sentence-initial; existing minCount/maxNames
  behaviour unchanged.

### Commits, in order (one module per commit + its battery)
`STYLEBUDGET-3-TEMPLATE-FAMILIES-THROUGH-THE-LANE`, `STYLEBUDGET-3-ACCEPTANCE-BATTERY`,
`STYLEBUDGET-2C-CONTRAST-RETRY`, `STYLEBUDGET-2C-ACCEPTANCE-BATTERY`,
`FRAGBUDGET-1-FRAGMENT-DENSITY-LANE`, `FRAGBUDGET-1-ACCEPTANCE-BATTERY`,
`NAMEREG-2-MID-SENTENCE-RULE`, `NAMEREG-2-ACCEPTANCE-BATTERY`.

## VERIFY (paste raw output; do not summarise)
```
cd ~/Downloads/UBS
git status --porcelain | grep -v '^??' | wc -l                       # 0
git log --oneline 7f2c7d2a..HEAD                                     # the 8 commits above, exact names
for f in stylebudget3 stylebudget2c fragbudget1 namereg2; do NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" node test/$f.acceptance.mjs | tail -1; done
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1           # 134 green, 0 red, 1 quarantined; checks > baseline
NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" npm run -s test:narrative-connect 2>&1 | tail -2
git diff --stat 7f2c7d2a..HEAD -- tests/researchAgentBehaviorRegression.test.mjs tests/llmProsePolisher.test.mjs   # empty
npm run build 2>&1 | tail -1
git push origin main && git push origin main:agent/narrative-connect-1
git rev-parse --short origin/main; git rev-parse --short origin/agent/narrative-connect-1
```

## LIVE PROOF — NOT yours. Cowork Claude runs it in Cliff's Chrome after VERIFY passes
Fix Manuscript on REDUX (manuscriptPolishRunner with the LLM on). Expected from the numbers above:
`[STYLEBUDGET-3]` family targets on ~all 20 chapters and `[REGENLANE]` `template-family` regenerations;
`[STYLEBUDGET-2]` density → ≤ 3.0/1k on ≥ 18/20 chapters, with `[STYLEBUDGET-2C]` escalations on the
"less like / more like" sentences (Ch.5 and Ch.7 open on one); `opening-echo` targets on the later chapter of
the 7 real pairs; `[FRAGBUDGET-1] … targets 0` on every chapter (REDUX is under budget); no
`[STRUCTURE-GUARD]`/`[QUOTE-GUARD]` REVERTED lines; paragraph counts unchanged per chapter; then the export
gate re-run offline must still show hardFailures = Ch.5 "itIs" only and MALFORMEDSENT ≤ 10. Do not start
Arc G. When VERIFY passes, stop and say: "Arc F VERIFY passed at <sha> — ready for the live proof."

## STOP conditions (plan §13, unchanged)
A DISCOVERY line disagrees; any existing battery goes red; run-all ≠ 134/0/1; the build fails; you find
yourself writing a regex that CHANGES prose (detectors only match); a real title, pen name or character name
inside code or a test; a second LLM call in flight; a detector whose rescan can never pass. Paste the raw
output and stop.
