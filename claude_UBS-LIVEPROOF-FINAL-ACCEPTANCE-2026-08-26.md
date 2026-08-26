# FINAL-ACCEPTANCE — EVIDENCE (Cowork Claude, 2026-08-26)
Kickoff: claude_UBS-FINAL-ACCEPTANCE-KICKOFF-claude-code-2026-08-26.md. Finding numbers continue from Arc J (last = 66).

## Prep session 1 landing check (b66adaf3) — 2026-08-26 ~19:30 UTC
HEAD = origin/main = origin/agent/narrative-connect-1 = **b66adaf3** (ls-remote agrees); tree clean. Nine commits since
80a54a70: DOCS-5 (9f190125) · STOREKEY-1B (0f75fb50) · LEGACYREPAIR-2 ×2 (7505972b, 033636b5) · ACCEPT-1 ×2 (ff8f14aa,
9ee52915) · three disclosed follow-ups from Claude Code's adversarial pass (741aad94 LEGACYREPAIR-2 check-6 bounds;
3b3932e7 + b66adaf3 ACCEPT-1 review fixes: gate-convention cast for the character-state criteria, quote-balance matched by
chapter number, cross-case atoms read `research_md`, TEMPORAL-1 by literal prefix, cross-chapter EVENT_CLASS_REPLAY computed,
paragraph count from stored content).
Batteries: **160 files, 160 green offline** (device VM, 3 chunks); storekey1 deterministic (finding 66 CLOSED); the eight
retired names occur 0× in both repair files (finding 65 CLOSED); polish-pipeline reds 0-line diff.

## Dry run of the harness on the two flagships (offline, `buildAcceptanceReport`, no --run) — the report is HONEST
NF flagship (20 ch): gate FAIL (Ch.8/9 unclosed dialogue — the known data blocks) · MALFORMEDSENT 21 · departed 0 ·
dup-intro 0 · event-replay 0 (cross-chapter) · scene-dupes **843 (measured against the DEAD sweep module)** · simile
0.19/1k PASS · template budget FAIL ("the weight of": 45 vs budget 3 — a real style finding) · cross-chapter dupes 0 ·
quote balance FAIL (2 unbalanced, 16 body chapters not reached because the gate stops on hard failures) · closed-world 1
flag · TEMPORAL 0 · Sources 43 entries PASS · front matter **FAIL (no copyright page yet — KDP-CHAIN-1)** · back matter PASS.
Fiction flagship (20 ch): gate FAIL (Ch.5 "itIs" glued word from collapsed dialogue — data) · MALFORMEDSENT 8 · departed 0 ·
dup-intro 0 · rest as NF where applicable.

## Findings
67. **Headless polish skips the scene-duplicate sweep — a parity gap that invalidates an acceptance run through the runner.**
    `manuscriptPolishRunner.js:106/116/736` takes `sceneDuplicateSweep` as an INJECTED option; the only implementation is
    the inline fork in `src/pages/ProjectStudio.jsx:140–1144` (~1,000 lines; the page header at 106 says "do not import
    stale '@/lib/sceneDuplicateSweep'"); `src/lib/sceneDuplicateSweep.js` is a WAVE5 dead stamp; `scripts/ubs-run.mjs
    polish` injects nothing. In-app polish runs the sweep; headless polish does not. → **SCENEDUP-3**: move the live fork
    into `src/lib/sceneDuplicateSweep.js` (replacing the dead copy) with the ORCH-1 move-not-rewrite discipline; the page
    imports it; the runner injects it; ACCEPT-1 measures it.
68. ACCEPT-1's `malformedsent` criterion re-scans with its own cast and disagrees with the gate's own
    `[MALFORMEDSENT] Gate scan: N` (21 vs the gate's number; the gate uses the prose-augmented cast, 717–718). The harness
    must report the GATE's number (parse the gate result, or call the same scan with the same cast). → ACCEPT-1B.
69. Real style defect on the NF flagship surfaced by the harness: template family "the weight of" ×45 (budget 3). Not a
    code item — the STYLEBUDGET-3 lane exists to fix it in a Fix Manuscript run; record the before/after in the live proof.

## Still to do before the acceptance RUN
Prep session 2 (code): DOCS-6, SCENEDUP-3, ACCEPT-1B → 161 batteries. Then the live protocol in the kickoff.

## Prep session 2 landing check (a02a4d6d) — 2026-08-26 ~21:30 UTC
HEAD = origin/main = origin/agent/narrative-connect-1 = **a02a4d6d** (ls-remote agrees); tree clean. Five commits since
b66adaf3: DOCS-6 (59e36dc1) · SCENEDUP-3 ×2 (9cdc2ed4, 35ac3910) · ACCEPT-1B ×2 (18c5e67b, a02a4d6d).
Batteries: **161 files, 161 green offline** (device VM, 3 chunks); polish-pipeline reds 0-line diff.
SCENEDUP-3 (finding 67 CLOSED): `src/lib/sceneDuplicateSweep.js` is now the live implementation (1,024 lines, no DEAD-CODE
stamp); `ProjectStudio.jsx` 6055 → 5059 lines with 3 references to `runSceneDuplicateSweep` (import + call sites);
`scripts/ubs-run.mjs` injects the sweep (328/349–350) so headless polish has parity with in-app polish. Live: the library
sweep over the NF flagship's 21 chapters = 0 blocks removed (26 s in the VM).
ACCEPT-1B (finding 68 CLOSED): the harness reads the gate's own `malformedTotal`; scene-dupes measures the library export;
every over-budget template family is listed.

## Findings (continued)
70. Harness nit: the polish pipeline never runs the scene-duplicate sweep on NONFICTION (runner 736), so ACCEPT's
    `scene-dupes` criterion must be N/A for NF projects (today it reports a number/FAIL). → ACCEPT-1C, two lines + one check,
    fold into the first live-session paste.

## STATUS: every code item of the master plan (PREFLIGHT, Arcs A–J, FINAL-ACCEPTANCE prep) is LANDED and verified at a02a4d6d.
What remains is LIVE work on Cliff's machine: the acceptance RUNS (two fresh books × two runs, via the runner + harness),
the Arc H/I live proofs, I3 SPEED-1, the two flagships' DATA fixes, and my triage of SMOKEOUT-1 / TESTSWEEP-2.
