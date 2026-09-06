# REPENGINE PHASE 2 KICKOFF — paste into a FRESH Claude Code session opened on ~/Downloads/UBS
Written by Claude (chat) 2026-09-05 after verifying the Phase 1 landing from Cliff's terminal:
HEAD = origin/main = origin/agent/narrative-connect-1 = `085215dc`, 165 green, tracked changes 0.
Companions: `UBS_plan.md` §"Phase 2", `claude_UBS-HANDOFF-2026-09-05.md`, `docs/pipeline-map.md`,
`docs/phase1-notes.md`, and the Phase 0/1 kickoffs (their rules still bind). This session = **Step 0 + Phase 2A + 2B
+ the reports Cliff needs for 2C.** Calibration judgments (2C) are Cliff's, made after this session lands.

## 1. Where the repo is — verify every line, STOP if any disagrees
```
cd ~/Downloads/UBS && git fetch origin
pwd                                                     # /Users/cliff/Downloads/UBS
git rev-parse --short HEAD                              # 085215dc
git rev-parse --short origin/main                       # 085215dc
git branch --show-current                               # main
git status --porcelain | grep -v "^??" | wc -l          # 0
ls test/*.acceptance.mjs | wc -l                        # 165
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1     # 165 green, 0 red, 0 quarantined; record checks (4169) as baseline
```
Read in full: `src/lib/beatLedger.js`, `scripts/beats-backfill.mjs`, `src/lib/localLLM.js` (the Node base-URL path and
`callAgentWithMeta`), `UBS_plan.md` §Phase 2.

## 2. Rules that bind this session (Phase 0 kickoff §4 + Phase 1 kickoff §3, plus these)
- Reports only. Nothing in Phase 2 gates, blocks, cuts, or modifies prose. No `Chapter`/`NovelProject` writes.
- ONE LLM call at a time, through `callAgentWithMeta`, same model as the writer (pass `model:` explicitly — the
  BEATLEDGER-1B lesson). No `Promise.all`. Every model-calling path treats `''`, malformed JSON, and
  `finishReason === 'length'` as FAILURE with a visible `[TAG] … FAILED — reason` line; a genuine empty result logs
  distinctly. The battery proves the two are distinguishable.
- **The reader pass (2B) uses a frontier model, not the fleet** — the plan requires a different model family from the
  writer. Use the Anthropic Messages API (`claude-sonnet-5`) from a Node script. The key is read from an env var
  `UBS_ANTHROPIC_API_KEY` or a gitignored `data/_auth/anthropic.key` file — DISCOVER whether `.gitignore` covers
  `data/`; if not, add the file to `.gitignore` in the same commit. The key is NEVER printed, logged, or committed.
  If the key is absent, the script exits with a clear message; it does not fall back to the local model.
- Word-overlap is the default similarity; DISCOVER whether the `:8081` router exposes `/v1/embeddings` for the loaded
  model. If it does, use it (sequential, same rules); if not, say so and stay on word-overlap.
- No real titles, names, or places in code or tests. Fixtures: Mara, Dov, Ilse. Project IDs are CLI arguments only.

## 3. Step 0 — two small tidy-ups (own commits)
- **BEATLEDGER-1C**: give beat extraction its own agent key in `localLLM.js` (`beats` → same model as the writer's
  resolved key, its own `AGENT_CTX_TOKENS` entry equal to the writer's) so the log stops saying `Agent: architect` and
  nothing borrows the architect's context setting. Battery: one named check in `beatledger1`. Commit
  `BEATLEDGER-1C-EXTRACTION-AGENT-KEY` (+ battery commit).
- **DOCS-12**: `git add claude_UBS-REPENGINE-PHASE1-COMPLETE-claude-code-2026-09-05.md claude_UBS-HANDOFF-2026-09-05.md
  claude_UBS-REPENGINE-PHASE2-KICKOFF-claude-code-2026-09-05.md` and commit. (All `claude_*.md` are tracked per DOCS-1.)

## 4. Phase 2A — SWEEP-1 (mechanical, whole-book, report only)
`src/lib/repetitionSweep.js` (relative imports, no React, no model calls except the optional aliasing pass):
- `compareBeats(a, b)` → 0–1: weighted on type match, participant overlap (token-level, so "Mara"/"Mara Vale" share),
  subject/summary similarity, emotional-core overlap. **Require a minimum subject-similarity floor before type +
  participants can complete a match** (Sep 4 lesson: in a single-POV book the protagonist is in every beat, so
  type+participant alone matched everything). Constants named and commented, not magic.
- `compareUnits(unitA, unitB, distance)` → best beat pair score × a capped distance boost (far-apart repeats matter more).
  A unit = one scene (live entries) or one chapter (backfill entries), keyed by `(chapter_number, scene_number)`.
- **Recommendation is novelty-weighted, not "cut the later one"**: score the later unit's UNMATCHED beats by type
  (revelation/setpiece high, reaction beats low); above a floor recommend `partial_compress_later` naming which beats
  to keep and which to compress, else `full_cut_later`. (Sep 4 lesson: a flat "cut the later chapter" deleted a unique
  reveal.)
- **Cluster detection**: union-find over every beat in the book with a looser, type-agnostic similarity that leans on
  subject/summary; report motifs recurring ≥ 3 times even when no single pair crosses the sweep threshold. (Sep 4
  lesson: a motif delivered five times never crossed the pairwise bar.)
- **Entity aliasing (optional, one model call per book, same-model rule)**: map participant-name variants that refer to
  the same figure ("the watcher"/"Silhouette"/"Watchman") to one canonical name IN MEMORY at sweep time; never rewrite
  stored entries. Log the map. If the call fails, run without aliasing and say so.
- `sweepProject(projectId, { store, threshold, callLLM })` returns `{ pairs, clusters, aliasMap, unitCount }`.
`scripts/sweep.mjs --project <id> [--threshold 0.72]`: store client + runner token, prints the report, and saves it as
a `PublishingAsset` `{ project_id, kind: 'repetition_sweep_report', label: 'Sweep <date>', content: JSON }` so it shows
in Saved Assets. DISCOVER the PublishingAsset field shape from an existing creator before writing.
Battery `test/sweep1.acceptance.mjs` ≥ 12: planted repeat detected across chapters; unrelated beats not matched;
protagonist-only overlap does NOT match without subject overlap; partial recommendation keeps an unmatched revelation;
cluster found at 3 occurrences when no pair crosses threshold; aliasing applied in-memory only (store unchanged);
distance boost capped; report saved via the store mock, never `Chapter.update`. Commits `SWEEP-1-COMPARATOR`,
`SWEEP-1-CLUSTER-AND-ALIAS`, `SWEEP-1-SCRIPT`, `SWEEP-1-ACCEPTANCE-BATTERY`.

## 5. Phase 2B — READERPASS-1 (frontier model, report only)
`src/lib/readerPass.js` + `scripts/readerpass.mjs --project <id>`: read the resolved manuscript in ~17k-word windows
with ~2k overlap, carry a running "already seen" list between windows, ask for JSON flags
`{ location, echoOf, what, confidence }`. `max_tokens` ≥ 4096; if `stop_reason === 'max_tokens'` the window is a
FAILURE (incomplete, not zero). Parse failures and API errors are tracked per window; the report prints
`PARTIAL FAILURE n/m` or `ALL WINDOWS FAILED — this is not a clean result`. Save as `PublishingAsset` kind
`reader_pass_report`. Battery `test/readerpass1.acceptance.mjs` ≥ 8 with a mocked client: windowing sizes; running
list carried; truncated window counted as failed not zero; all-failed report labeled; missing key exits clearly;
flags deduped across overlapping windows. Commits `READERPASS-1-WINDOWED-READER`, `READERPASS-1-SCRIPT`,
`READERPASS-1-ACCEPTANCE-BATTERY`.

## 6. VERIFY, push, then the reports for Cliff
```
cd ~/Downloads/UBS
git status --porcelain | grep -v "^??" | wc -l                 # 0
git log --oneline 085215dc..HEAD                               # BEATLEDGER-1C ×2, DOCS-12, SWEEP-1 ×4, READERPASS-1 ×3
for f in beatledger1 sweep1 readerpass1; do node test/$f.acceptance.mjs | tail -1; done
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1     # 167 green, 0 red, 0 quarantined; checks > 4169
npm run build 2>&1 | tail -1
git push origin main && git push origin main:agent/narrative-connect-1
git rev-parse --short HEAD; git rev-parse --short origin/main; git rev-parse --short origin/agent/narrative-connect-1
```
STOP here and tell Cliff the code is landed. Then, with his go-ahead and the dev server up, the LIVE part:
1. `node scripts/sweep.mjs --project mst2el24-2eg7ue0s` (66 beats already exist). Paste the report.
2. Ask Cliff for the project IDs of the two known-bad books (he has them; do not search by title). For each:
   `node scripts/beats-backfill.mjs --project <id>` then `node scripts/sweep.mjs --project <id>`. Paste both reports.
3. Only if `UBS_ANTHROPIC_API_KEY` is set: `node scripts/readerpass.mjs --project mst2el24-2eg7ue0s`. Paste the report
   and a corroboration table (sweep pair / cluster / reader flag, agree or not).
4. For each flagged pair on REDUX, print the two units' prose side by side (first 600 words each) so Cliff can judge.
Do not tune thresholds from your own opinion. Cliff marks true/false positives; threshold changes are the NEXT session.

STOP conditions: any §1 line disagrees; any existing battery red; run-all ≠ 167/0/0; a key appears in any output;
a second LLM call in flight; any `Chapter`/`NovelProject` write; a real name in code or tests. Do not claim success.
Paste the raw output and stop.
