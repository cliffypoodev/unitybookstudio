# ARC J — LANDING EVIDENCE (Cowork Claude, 2026-08-26)
Kickoff: claude_UBS-ARC-J-KICKOFF-claude-code-2026-08-26.md (two sessions). Finding numbers continue from Arc I (last = 62).

## Session 1 landing check (fc066ccc) — 2026-08-26 ~16:00 UTC
HEAD = origin/main = origin/agent/narrative-connect-1 = **fc066ccc** (ls-remote agrees); tree clean. 14 commits since
fb62d573: DOCS-3 (fb1d55df) · STOREKEY-1 ×2 (12737c4d, 4938be46) · RERESEARCH-CONFIRM-1 ×2 (83efcb27, 935911d0) ·
URLWRITE-GUARD-1 ×2 (a2263252, 3da62239) · TASKTYPE-1 ×2 (1ce61aa6, 55e71b95) · VERSIONS-1D ×2 (555b221f, 61ce0f63) ·
three disclosed follow-ups from Claude Code's own adversarial pass: URLWRITE-GUARD-1-FIX-MUTEX-DOUBLE-RELEASE (9f534e77 —
drops the explicit `release()` on the two new 422 paths; the enclosing `finally` releases), VERSIONS-1D-FIX-STRUCTURE-GUARD-
SKIP-REGRESSION (9393a3a5 — the PROSE-GUARD dedupe now suppresses only the printed line; the STRUCTURE-GUARD check/revert
runs for every entry), RERESEARCH-CONFIRM-1-FIX-VALIDATION-ORDER (fc066ccc). Both substantive fixes read correct in the diff.
`git diff --stat fb62d573..HEAD`: 15 files, +1372/−6; nothing under data/.
Batteries: **155 files, 155 green offline** (device VM, 3 parallel chunks); 0 red, 0 quarantined; polish-pipeline reds
0-line diff vs fb62d573. `test:legacy` 67 run green (toolsTaskTypeGuard re-classified `regression` → `run`).
TASKTYPE-1 (finding 60 CLOSED as a stale test): `src/lib/localLLM.js` `resolveAgent` (263) already routes `'chat'` →
ideas_chat (283), `'evaluate'` → critic (287), `'fix'` → polisher (291); no production routing change was needed — the legacy
test's own VALID_TASK_TYPES was stale. The new `tasktype1` battery derives the valid set from `resolveAgent` itself.
STOREKEY-1: the load-time dedupe has NOT yet run on the live store (write-back cache; the server has not reloaded
`_FileStore`): 4,858 records / 4,620 distinct ids at 16:00 UTC. Expect `[STOREKEY-1] u-6adbdb70a020: collapsed 238
duplicate _FileStore record(s) across 5 key(s)` on the next server start → 4,620 records. Record the line when it appears.

## Findings
63. Pre-existing pattern, not introduced by J: the store's `update`/`delete` error paths at 091092c6 already called
    `release()` explicitly under a `finally` that releases again (the double-release Claude Code found in its OWN new
    code). Those older paths still do it. → STOREMUTEX-1, small, Session 2 or FINAL-ACCEPTANCE prep.

## Pending for Session 2 (fresh session; baseline fc066ccc, 155 files → 158)
J6 LEGACYSTAGES-1, J7 POLISHSAFE-6, J8 LEGACYREPAIR-1 (+ DOCS-4 for this file). Live proofs unchanged (Arc H list +
runner smoke + I3); DATA fixes through the app: NF flagship Ch.8/9/11, fiction flagship Ch.5 gate block + Ch.10 "Silas".

## Session 2 landing check (80a54a70) — 2026-08-26 ~17:30 UTC
HEAD = origin/main = origin/agent/narrative-connect-1 = **80a54a70** (ls-remote agrees); tree clean. Ten commits since
fc066ccc: DOCS-4 (9c152eef) · STOREMUTEX-1-SINGLE-RELEASE (6ffe4c76) · LEGACYSTAGES-1 ×2 (78686a23, 42d8ee8e) · POLISHSAFE-6 ×2
(64e605e2, adbf53fa) · LEGACYREPAIR-1 ×2 (1dfe9850, 230b2e2b) · LEGACYSTAGES-1-FIX-INCOMPLETE-GUARD-COVERAGE ×2 (8728f039,
80a54a70 — Claude Code's own adversarial pass found that the first landing left the unbounded `\s+`/`\s*` rules unguarded;
the follow-up threads every rule through `applyRuleParagraphSafe`/`guardedReplace` and pins the two repro fixtures).
`git diff --stat fc066ccc..HEAD`: 12 files, +829/−116; nothing under data/.
Batteries: **158 files — 157 green + 1 FLAKY offline** (device VM, 3 parallel chunks): `storekey1` check 4b "updated_date is
refreshed on the upsert" fails when both creates land in the same millisecond (passed on rerun; passes on the Mac). A battery
timing defect, not a store defect → finding 66. Polish-pipeline reds 0-line diff vs fb62d573. `test:legacy` 67 green.
LEGACYREPAIR-1: `legacyProseRepairs.data.js` now has ZERO occurrences of the eight retired names; the generalized class is
`[A-Z][a-z]+’s` (e.g. line 270). Claude Code flagged that this class also matches non-name capitalised words ("Monday's pause
fogged") and left the call to me → finding 64, ACCEPTED: the repaired PHRASE is the slop, whoever the subject is; a
proper-noun heuristic here would add complexity for no precision gain. `hygiene1` exempt list is now three files.
ARC J CODE-CLOSED at 80a54a70 (findings 53–66 across H/I/J).

## Findings (continued)
64. ACCEPTED as designed — LEGACYREPAIR-1's `[A-Z][a-z]+’s` subject class matches any capitalised possessive before the
    slop phrase. The phrase is the defect; no change.
65. `manuscriptFixer.js` still carries SINGLE-MANUSCRIPT literal repairs outside J8's scope (alternation lists were the
    scope): `'The line went dead' + 'Elias sat'` (4965–4966), the "Caspian’s hand, the one that had touched him felt"
    family (5038–5045, 5281–5288, 5327–5328, 6080), "older than Jonah had expected maybe" (5063–5065, 5357–5358, 6151),
    plus the doc comment at 81 — 24 lines naming three real characters, rules that cannot fire on any other book (rule 0.2).
    → LEGACYREPAIR-2: delete those rules and their self-tests; hygiene1 tracks Silas only, so add Elias/Caspian/Jonah/Orin/
    Lev/Ronan/Kael to the battery's retired list for the two repair files.
66. `test/storekey1.acceptance.mjs` check 4b is timing-flaky (same-millisecond creates). → STOREKEY-1B: force ≥ 2 ms
    between the two creates (or compare `>=` with a distinct injected clock) so the check is deterministic.

## What remains after Arc J
FINAL-ACCEPTANCE (plan §12) = a RUN, not a code arc: two fresh books through the headless runner, twice each, judged
against the §12 PASS list. Prep session (code): STOREKEY-1B, LEGACYREPAIR-2, and ACCEPT-1 — a report harness
(`scripts/ubs-accept.mjs`) that computes every §12 criterion from the stored book + gate result and prints PASS/FAIL per
criterion, so the bar is machine-checked. Then the live runs with Cliff. Live proofs from Arcs H/I (NAMEGATE on Ch.10/13,
Fix Manuscript both flagships, SCENEGATE-ON-1, ARCH-2, BIBLEGUARD-NAMES-1, NFANTH-CW-1, REWRITE-E2E-1, KDP-CHAIN-1, runner
smoke, I3 SPEED-1) and the DATA fixes (NF Ch.8/9/11; fiction Ch.5 gate block, Ch.10 "Silas") fold into the same live
sessions. SMOKEOUT-1 and TESTSWEEP-2 (25 legacy `regression` tests) still wait for my triage.
