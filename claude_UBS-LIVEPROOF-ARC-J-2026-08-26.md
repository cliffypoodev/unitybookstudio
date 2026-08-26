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
