# 05 — Root Cause Report

**Date:** 2026-06-07

---

## Root Cause Summary

| # | Cause | Evidence | Confidence | Fixed? |
|---|-------|----------|------------|--------|
| 1 | **Post-polish quality gate detected failures but did NOT block save** | `ProjectStudio.jsx:4577-4604` — toast shown but save loop runs for ALL chapters | **100%** | ✅ |
| 2 | **Quality gate returned REPAIR_AGAIN for >3 quote issues instead of BLOCK** | `prosePolishQualityGate.js:206` — `REPAIR_AGAIN` not treated as save block | **100%** | ✅ |
| 3 | **Manuscript safety gate (used by export) lacked verb-agreement patterns** | `manuscriptSafetyGate.js:373-385` — missing `She were`, `a obvious`, `She was it`, `Aether were` | **100%** | ✅ |
| 4 | Quality gate `malformed` patterns missing `Aether were` and `were those just` | `prosePolishQualityGate.js:26-88` — only had basic patterns | **100%** | ✅ |

---

## Detailed Root Cause Analysis

### RC1: Quality Gate Toast Without Enforcement (PRIMARY)

The post-polish quality gate at Step 12c correctly detected that chapters had malformed grammar and quote issues. It returned `BLOCK_POLISH_SAVE` for chapters with malformed grammar.

However, the enforcement code only showed a `toast.error()` message to the user — it did NOT prevent the save loop from persisting the bad content. The save loop at Step 13 iterated over ALL loaded chapters and saved any with `f.content !== f.original`, regardless of the gate result.

**Impact:** Every chapter that was modified by ANY polish step (even just banned word removal) was saved to DB, including chapters that the quality gate explicitly said should NOT be saved.

### RC2: Quote Issues Not Blocking

The quality gate returned `REPAIR_AGAIN` for chapters with >3 missing-opening-quote issues. But `REPAIR_AGAIN` was not treated as a save blocker in the enforcement code — only `BLOCK_POLISH_SAVE` was checked.

This meant Chapter 1 (5 quote issues, 0 malformed) passed through the save loop with its quote issues intact (since quote repair had NOT yet run at that point in the pipeline — actually it HAD run by Step 12b, but the gate's action was still not blocking).

**Impact:** Chapters with many quote issues but no malformed grammar were saved with issues.

### RC3: Export Safety Gate Missing Patterns

The export safety gate delegates to `runManuscriptSafetyGate()`, which has its own `MALFORMED_CANARIES` list. This list only included `You was`, `Was was`, `from to the`, and a few others — but NOT `She were`, `He were`, `She was it`, `a obvious`, `Aether were`, or `were those just`.

This meant even if bad content was saved to DB, the export safety gate would NOT catch it and would NOT block export.

**Impact:** Bad content could pass through export without being blocked.

### RC4: Quality Gate Missing Patterns

The quality gate's `MALFORMED_PATTERNS` array (separate from the manuscript safety gate's `MALFORMED_CANARIES`) did not include `Aether were` or `were those just`. These are garbled/nonsensical phrases that should be hard failures.

**Impact:** Some garbled text was not detected by the quality gate.

---

## Why Did the Previous Tests Pass?

The previous 203 tests all passed because:

1. **Unit tests used small, controlled inputs** that didn't exercise the "gate detects but save continues" path
2. **Integration tests simulated the pipeline** but didn't test the actual `ProjectStudio.jsx` save loop
3. **The quality gate tests** correctly verified that the gate RETURNED the right action — they just didn't test whether the CALLER enforced it
4. **Export safety tests** used the old pattern set that didn't include verb-agreement failures
5. **Safe chapter replace tests** used the manual replacement path which DID clear stale fields — the standard polish save path was different

---

## Answers to Specific Questions

1. **Why did `(6).docx` still contain known quality failures?** → Quality gate detected but toast-only, no save enforcement.
2. **Did the LLM polish step run?** → Unknown for this specific export. If Ollama wasn't running, all chapters fell back to deterministic-only. Even if it ran, the save loop would have saved bad content anyway.
3. **Did the deterministic repair run?** → Yes, but some patterns (She was it, Aether were) have no deterministic repair rule.
4. **Did post-polish quality gate block?** → It SAID block, it did NOT enforce block.
5. **Did save/export resolve stale content?** → Not the primary cause, but the standard polish save path does not clear stale fields like the manual replacement path does.
6. **Which exact function allowed bad text to survive?** → `ProjectStudio.jsx:4577-4604` — the gap between `toast.error()` and the save loop with no chapter exclusion.
