# ARC E KICKOFF — paste into a FRESH `claude` session in ~/Downloads/UBS
Written by Claude (Cowork) 2026-08-24 night after driving the Arc D live proof to PASS (Run 4):
HEAD = origin/main = origin/agent/narrative-connect-1 = `fdc964f8`, branch `main`, at time of writing.

---

You're working in ~/Downloads/UBS on the Unity Book Studio repo. Read these FOUR files in full
before anything else — repo root, untracked on purpose, never delete or git-clean them:

1. claude_UBS-issue-breakdown-2026-08-24.md
2. claude_UBS-MASTER-FIX-PLAN-claude-code-2026-08-24.md — Section 0 "Rules of the Road" governs
   everything. Follow it exactly. Do not skip, combine, or "improve adjacent code."
3. claude_UBS-LIVEPROOF-ARC-B-C-2026-08-24.md — findings 3–5 are context for the export gate.
4. claude_UBS-LIVEPROOF-ARC-D-2026-08-25.md — four runs; Run 4 PASS; findings 13–18 are open.

Other untracked things you'll see and must not touch: `.claude/`, `proofreader/`, and every other
`claude_*.md`. `git status --porcelain` should show ~11 lines, all `??` (exact count depends on how
many `claude_*.md` docs exist; what matters is ZERO tracked changes). Read the plan's "porcelain 0"
as zero TRACKED changes.

## Where the repo actually is (supersedes the plan's stated numbers)

Landed: PREFLIGHT-1, Arc A, DEADTEST-1..6, Arc B, Arc C, Arc D (STATECONTRACT-1/1B, BIBLEGATE-1/1B/1C,
SCENEDUP-1, ARCSTATE-1, PRONOUNLOCK-2, SUBJECTGUARD-2, LOOKAHEAD via STATECONTRACT-1B). Arc D live
proof PASSED on REDUX Ch.10 at fdc964f8. The Arc D close-out session may ALSO have landed two small
follow-ups (live-proof findings 13 and 17 — `it/its` in `parseDeclaredPronouns`, and `targets 0` /
`found 0` log lines in the lane and subject repair). Verify before touching anything; STOP if any
line disagrees with BOTH acceptable states:

```
cd ~/Downloads/UBS && git fetch origin
git rev-parse --short HEAD; git rev-parse --short origin/main; git rev-parse --short origin/agent/narrative-connect-1
   # all three IDENTICAL (one ref per line — a combined multi-ref rev-parse misbehaves in this shell).
   # Either fdc964f8 (follow-ups not landed yet → do them as E0 below) or a later SHA whose
   # `git log --oneline fdc964f8..HEAD` shows ONLY the finding-13/17 follow-up commits (→ skip E0).
git branch --show-current                              # main
git status --porcelain | grep -v '^??' | wc -l         # 0
unset NODE_OPTIONS && node test/run-all.mjs 2>&1 | tail -1
   # batteries: 128 green, 0 red, 1 quarantined at fdc964f8 (129 files − 1 quarantined); more only if
   # E0 already landed a new battery file. Record the exact green count and checks — your baseline.
```

Battery arithmetic (rule 0.4): Arc E adds exactly one battery, `test/gatepromote1.acceptance.mjs`
→ baseline + 1 green. If E0 adds a battery file, count it too. Checks strictly > baseline.

Wave-era baseline: `test:narrative-connect` EXIT 0 (23/23). `test:polish-pipeline` file-by-file with
the alias loader: 18/20 green; reds are exactly researchAgentBehaviorRegression 6/69,
liveExportSafetyRegression 6/56, llmProsePolisher 2/13. **Arc E owns liveExportSafetyRegression**
(see E3). The other two must be byte-for-byte unchanged at the end of the arc.

## DISCOVERY corrections (re-verified live 2026-08-24 night at fdc964f8)

- `src/lib/exportSafetyGate.js`: `runPreExportSafetyGate` at line 93 (matches plan). The decision the
  plan quotes is at **341–344** (matches "~341"):
  `if (entry.recommendedAction === 'REJECT_REGENERATE' || entry.recommendedAction === 'REJECT_MANUAL_REVIEW') { hardFailures.push(entry); } else { warnings.push(entry); }`
  — but that decision only covers the per-chapter safety entries. The findings Arc E promotes are
  produced ELSEWHERE in the same file and pushed straight to `warnings`:
  * CHARSTATE-1 telemetry block **719–765**: `auditProseAgainstCharacterState(...)` returns
    `violation.code` ∈ {`DEPARTED_CHARACTER_ACTIVE`, `DUPLICATE_INTRODUCTION`} (defined in
    `characterStateLedger.js:383` / `:396`, messages at ~385 / ~398) and `scanRoleReferenceDrift`
    (role drift). Today all of them → `warnings.push({ chapterNumber, title, reasons: ['CHARSTATE-1: …'] })`.
  * INTRODUP-1 block **596–622** (`scanDuplicateIntroductions(body, introCast)`, same-chapter repeated
    self-introduction) → warnings. This is NOT the plan's `DUPLICATE_INTRODUCTION` (that is the
    cross-chapter code from the state ledger). INTRODUP-1 stays a WARNING in Arc E —
    `test/introguard1.acceptance.mjs` checks 12–13 lock that and are not retired.
  * MALFORMEDSENT-1 block **624–651** → warnings; `[MALFORMEDSENT] Gate scan: N …` log at 648.
  * `const blocked = hardFailures.length > 0;` at **767**. `assertExportSafetyAllowed(report)` (24)
    throws on `report.blocked`; `formatExportSafetyFailure` (815) renders `hardFailures`. Hard entries
    elsewhere carry `{ chapterNumber, title, reasons: [...], recommendedAction: 'REJECT_MANUAL_REVIEW' }`
    (see ~441–445, ~508–512) — promoted entries must use that shape so ExportTab renders them.
- **The gate has NO project-type import today.** `grep -n "isNonfictionProject\|isFictionProject" src/lib/exportSafetyGate.js` → nothing. The promotion is fiction-only, so E1 imports
  `isFictionProject` from `./projectType.js` (`src/lib/projectType.js:101`; `isNonfictionProject` at 94)
  and gates on `isFictionProject(options.project)`. Never a new `project_type ===`.
- The plan's `export const MALFORMEDSENT_HARD_BLOCK = false;` does NOT exist yet in
  `src/lib/malformedSentence.js` (exports: `scanMalformedSentences` 39, `MALFORMEDSENT_VERSION` 82).
  E1 adds it; the gate reads it; `test/malformedsent1.acceptance.mjs` check 19 (line 43–47, asserts
  "WARNING, not a hard block" by grepping source) is updated to read the constant (rule 0.2/5, name it).
- `test/charstate1.acceptance.mjs` check 27 (line 104) asserts `!/hardFailures\.push\([^)]*CHARSTATE/`
  and "resurrections and role drift as WARNINGS". After E1, resurrections and cross-chapter duplicate
  introductions are hard in fiction while ROLE DRIFT stays a warning. Retire that assertion and
  replace it with the new contract, named in the commit (rule 0.2/5).
- Caller: `src/components/publishing/ExportTab.jsx:821` `runPreExportSafetyGate(cleaned, { project, stage: 'pre-export' })` — `options.project` is present, so `isFictionProject(options.project)` has what it needs.
- Live numbers on REDUX right now (I ran the gate offline over all 20 resolved chapters at fdc964f8):
  CHARSTATE-1 warnings **0**, INTRODUP-1 **0**, MALFORMEDSENT-1 warnings 6 chapters (10 sentences),
  PRONOUNLOCK-1 20, PROSEGATE 12, STYLEBUDGET 2, hardFailures **1 = Ch.5 "glued word … itIs"**
  (pre-existing since 2026-08-15, in the pre-fixplan snapshot). So after GATEPROMOTE-1 the REDUX report
  must be IDENTICAL except for shape: still blocked by Ch.5 only. That is the live-proof expectation.

## Arc E = §6 as written (E1 → E2 → VERIFY) + the two items it owns

**E0 (only if `git log fdc964f8..HEAD` is empty) — Arc D live-proof follow-ups 13 and 17, small, generic,
own commits + battery coverage, before E1:**
- Finding 13: `src/lib/pronounLock.js:61` `PRONOUN_SET` in `parseDeclaredPronouns` accepts only
  he/him, she/her, they/them. Add `it\s*/\s*its` (same one-line class as BIBLEGATE-1C). Live: a cast entry
  declared `it/its` was ignored and inferred from prose as `she/her` in the writer prompt. Extend
  `test/pronounvar1.acceptance.mjs` (or add a check to `pronounlock2`) with a generic it/its fixture.
  Commit `PRONOUNLOCK-2B-IT-ITS-DECLARATION`.
- Finding 17: `regenerateFlaggedParagraphs` (regenerateLane.js:274) and `repairDroppedSubjects`
  (subjectRepair.js ~227) return silently on zero targets. Log `[REGENLANE] ${label}: targets 0, …` and
  `[SUBJECTREPAIR-1] ${label}: found 0, …` on that path so a live proof can tell "ran clean" from "never
  ran". Commit `REGENLANE-1B-ZERO-TARGET-TELEMETRY` (both files, one commit; extend regenlane1 /
  subjectrepair1 with one check each).
Findings 14 (PRONOUNLOCK-3) and 15 (LOOKAHEAD-1B) are NOT Arc E; leave them scheduled.

**E1 — GATEPROMOTE-1-CONTINUITY-BREAKS-BLOCK-EXPORT.** In the CHARSTATE-1 block (719–765): when
`isFictionProject(project)` and `violation.code` is `DEPARTED_CHARACTER_ACTIVE` or
`DUPLICATE_INTRODUCTION`, push to `hardFailures` with `recommendedAction: 'REJECT_REGENERATE'` and the
code in the entry (keep the `CHARSTATE-1:` reason text; add `code`). Role drift stays a warning. NF:
unchanged. Add `export const MALFORMEDSENT_HARD_BLOCK = false;` to `malformedSentence.js`; in the
MALFORMEDSENT-1 block, route to `hardFailures` (`REJECT_REGENERATE`) only when the constant is `true`,
otherwise warnings as today. Do not flip it. The console lines stay as they are (`[CHARSTATE] Ch.N: CODE —
name`, `[MALFORMEDSENT] Gate scan: N …`); add `[GATEPROMOTE] Ch.N: CODE promoted to hard block` so the live
proof can see the promotion path exists even when it fires 0 times.

**E2 — GATEPROMOTE-1-ACCEPTANCE-BATTERY** `test/gatepromote1.acceptance.mjs` (≥ 6, generic fixtures
Mara/Dov/Ilse, a two-chapter fiction fixture where Dov departs in ch.1 and acts in ch.2): blocked === true
with a `DEPARTED_CHARACTER_ACTIVE` entry in `hardFailures`; duplicate self-introduction across chapters →
blocked with `DUPLICATE_INTRODUCTION`; malformed-only fixture → NOT blocked while the constant is `false`;
same fixture with the constant mocked/true path → blocked (test the branch, not by editing the constant);
NF fixture with the same prose → not blocked, findings stay warnings; role-drift-only fixture → warning,
not blocked. Plus the two test-side corrections named above (charstate1 #27, malformedsent1 #19) — each
retired assertion named in the E1 commit message, not silently rewritten.

**E3 — the stale liveExportSafetyRegression file (Arc E owns it; triage table 2026-08-24).**
`NODE_OPTIONS="--loader ./tests/helpers/aliasLoader.mjs" node tests/liveExportSafetyRegression.mjs`
→ 50/56, the 6 reds are: "Process leak count > 0 (got: undefined)", "Contamination count > 0 (got:
undefined)", "Malformed count > 0 (got: undefined)" (they read top-level `report.processLeakCount` etc.;
the counts now live per chapter in `passed[]`/`hardFailures[]` entries — `processLeakCount`,
`contaminationCount`, `malformedCount`), "Both chapters failed (got: 3)" (a manuscript-level entry now
rides along), "Formatted report mentions process-leak type", "Short chapter was skipped, not scanned".
Triage each one: if the gate's CURRENT behaviour is right, correct the expectation and name it in the
commit (rule 0.2/5); if one exposes a real defect (a short chapter that should be skipped and isn't; a
formatted report that lost the failure type), fix the gate in its own commit. Expected end state:
`liveExportSafetyRegression` green → polish-pipeline 19/20; researchAgent 6/69 and llmProsePolisher 2/13
unchanged. Commit `GATEPROMOTE-1-RETIRE-LIVEEXPORT-REPORT-SHAPE-ASSERTIONS` (or the defect's own name).

Order: E0 (if needed) → E1 → E2 → E3 → VERIFY. One commit per change, one per battery, names exactly as
the plan writes them.

## Live proof — Cowork Claude drives it; you prepare it

When VERIFY passes and both branches are pushed, write ONE message for Cliff to paste to Cowork Claude:
hard refresh; Export tab on REDUX → run the pre-export safety gate (the button that calls
`runPreExportSafetyGate` with `stage: 'pre-export'`); capture `[GATEPROMOTE]` lines (expect 0 promotions
on REDUX — CHARSTATE-1 and INTRODUP-1 are both 0 there tonight), `[CHARSTATE] Ch.N: …` lines (expect
none), `[MALFORMEDSENT] Gate scan: 10 malformed sentence(s) across 20 chapter(s)` still a WARNING, and
the report: `blocked: true` with hardFailures = exactly the pre-existing Ch.5 "itIs" glued word and nothing
else. STOP conditions: any CHARSTATE promotion firing on REDUX (would be a false positive — paste it), a
MALFORMEDSENT hard block while the constant is false, or an NF project (Cowork Claude will also run the
gate on one NF book if one exists locally) gaining any new hard failure. The battery, not REDUX, is the
proof that blocking works; REDUX proves it does not over-block. Then wait. Do not start Arc F.

## Session discipline

One arc this session. Do not "also" fix findings 14/15/16/18. Paste raw VERIFY output (git log, the new
battery tail, run-all tail, build tail, narrative-connect exit, the three polish-pipeline per-file counts),
push both branches, hand Cliff the live-proof paste, wait. Do not claim success — the VERIFY output and
the gate report are the evidence.

Standing rules as a backstop: one LLM call at a time; prose is regenerated-and-verified or flagged, never
regex-edited; classification only through `isNonfictionProject`/`isFictionProject`; generic fixture names
only (Mara, Dov, Ilse) — never the book's ship, town, or cast; batteries lock behavior — change an
expectation only when this arc retires it and name it in the commit; nothing named hermes, nothing under
base44/; never `--force`, never rebase; after VERIFY passes,
`git push origin main && git push origin main:agent/narrative-connect-1`.
