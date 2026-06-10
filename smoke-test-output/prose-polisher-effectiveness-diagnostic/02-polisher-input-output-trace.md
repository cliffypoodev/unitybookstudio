# 02 — Polisher Input/Output Trace

**Date:** 2026-06-07
**Source:** Codebase analysis + digital-equity-tribunal (5).docx

---

## Architecture Discovery: No LLM in Polish Pipeline

> [!IMPORTANT]
> The Prose Polisher is **NOT an LLM agent**. The entire `handleManuscriptPolish()` pipeline is 100% deterministic regex transforms. There is no model call, no prompt, no system message, no "Prose Polisher" agent.

The polish pipeline is a 12-step chain of deterministic regex functions in `ProjectStudio.jsx` (L3926–4640).

---

## Trace: Chapter 5 — "She were carrying…"

| Stage | Saw Bad Text? | Fixed? | Notes |
|-------|--------------|--------|-------|
| **Pre-polish load** | ✅ Yes | — | Content loaded from DB/GitHub |
| **Step 1b: stripProjectContaminationBlocks** | ✅ Yes | ❌ No | Only removes foreign project blocks, not grammar |
| **Step 1c: Safety gate (pre-polish)** | ✅ Yes | ❌ No | Safety gate checks process leaks and contamination, NOT grammar patterns like "She were" |
| **Step 2: Banned word removal** | ✅ Yes | ❌ No | Only removes vocabulary words ("luminous", "tapestry" etc.), not grammar |
| **Step 3: runPunctuationCleanup** | ✅ Yes | ❌ No | Fixes smart quotes, double commas, SV splits — no subject-verb agreement |
| **Step 3b: runSpellingFixes** | ✅ Yes | ❌ No | Only 14 spelling corrections, none for grammar |
| **Step 5d: runBrokenSentenceFixes** | ✅ Yes | ❌ No | Only fixes "She spoke, and the words", orphaned dashes, duplicate determiners |
| **Step 11: fixHangingQuotes** | ✅ Yes | ❌ No | Only repairs quote balance, not grammar |
| **Step 12: Save** | ✅ Yes | — | Bad text saved as "polished" |

**Root cause: No function in the polish pipeline checks or repairs subject-verb agreement errors.**

---

## Trace: Chapter 6 — "Was was it a failure…"

| Stage | Saw Bad Text? | Fixed? | Notes |
|-------|--------------|--------|-------|
| **Step 3: runPunctuationCleanup** | ✅ Yes | ❌ No | The duplicate word fix (`/\b(\w{2,})\s+(\1)\b/gi`) has `"was"` in skip set? NO — it does NOT skip "was". But "Was was" has different case (capital W vs lowercase w). The regex uses `/gi` flag so it should match case-insensitively. But the text is "Was was" (capital + lowercase) which the backreference `\1` matches literally. Let me check... |
| **Duplicate word detector** | ✅ Yes | **Partial** | The regex `\b(\w{2,})\s+(\1)\b` with `/gi` flag: `\1` backreferences are case-sensitive even with `i` flag in JavaScript! So "Was was" does NOT match because "Was" ≠ "was" for backreference. **This is the bug.** |
| **All other steps** | ✅ Yes | ❌ No | No other step handles duplicated auxiliary verbs |
| **Step 12: Save** | ✅ Yes | — | "Was was" saved as polished |

**Root cause: JavaScript regex backreferences are case-sensitive even with `/i` flag. "Was was" escapes duplicate word detection.**

---

## Trace: Chapter 1 — Missing opening quote

Pattern: `…existential dread." The game is the model, Marcus," she retorted…`

| Stage | Saw Bad Text? | Fixed? | Notes |
|-------|--------------|--------|-------|
| **Step 11: fixHangingQuotes → balanceParagraphEdges** | ✅ Yes | ❌ No | This function only handles PARAGRAPH-level edge imbalance. The missing-quote issue is MID-PARAGRAPH — the text `The game is the model, Marcus,"` is embedded within a long paragraph that has balanced total quotes. The function counts paragraph-level quotes and only acts if the count is odd. A paragraph with multiple speech turns can have even total quotes but missing individual openers. |
| **Step 11: postSmartCleanup → orphanSpeech** | ✅ Yes | ❌ No | This only rescues very short phrases (≤140 chars) matching a whitelist of dialogue starters. "The game is the model" is not in the starter list. |
| **All other steps** | ✅ Yes | ❌ No | No function detects mid-paragraph missing opening quotes |
| **Step 12: Save** | ✅ Yes | — | Missing quote saved as polished |

**Root cause: Quote repair only handles paragraph-edge imbalance, not mid-paragraph missing openers.**

---

## Trace: AI Slop — "wasn't just" / "didn't just"

| Stage | Saw Bad Text? | Fixed? | Notes |
|-------|--------------|--------|-------|
| **Step 2: Banned word removal** | ✅ Yes | **Partial** | Bans include "not just" (exact phrase), but NOT "wasn't just" or "didn't just". The banned word list only matches literal "not just". |
| **Step 7: runVocabCaps / runChatGPTVocabCaps** | ✅ Yes | ❌ No | These cap AI-favorite words but don't specifically target "wasn't just" / "didn't just" |
| **Step 10c: runStyleTicSweep** | ✅ Yes | ❌ No | Style tics target prose patterns ("mouth went dry", "throat tightened"), not slop phrases |
| **mechanicalSlopScore** (draft only) | ✅ Yes | Score only | Scores "not just X but Y" pattern, but only during draft, NOT during polish. And it doesn't detect "wasn't just". |

**Root cause: "wasn't just" and "didn't just" are not in any polish repair function. Only literal "not just" is banned.**

---

## Summary: Why the Polish Pipeline Misses These

| Issue | Root Cause | Confidence |
|-------|-----------|------------|
| "She were" / "He were" | **No subject-verb agreement checker exists** in the polish pipeline | HIGH |
| "Was was" | **Backreference case sensitivity** in duplicate word detector | HIGH |
| "a obvious" | **No article agreement checker exists** | HIGH |
| Missing opening quotes | **Quote repair only handles paragraph edges**, not mid-paragraph speech turns | HIGH |
| "wasn't just" / "didn't just" | **Only "not just" is banned**, not contracted variants | HIGH |
| Excess "felt" / "realized" | **These are counted in mechanicalSlopScore (draft-only) but NOT capped during polish** | HIGH |
| "the weight of" | **Not targeted by any polish function** | HIGH |
