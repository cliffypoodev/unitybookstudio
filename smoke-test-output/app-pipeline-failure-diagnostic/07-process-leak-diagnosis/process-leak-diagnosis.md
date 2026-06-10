# Process Leak Diagnosis

## Root Cause: No process-leak detection exists in the app codebase

### Evidence

**Search performed:** `grep -rn` for ALL of the following across entire `src/` directory:
- "processLeak" / "process_leak" / "process.leak" → **zero results**
- "The opening is sharp" → **zero results**
- "Areas for Refinement" → **zero results**
- "Action Plan:" → **zero results**
- "Best Next Move" → **zero results**
- "Next Move:" → **zero results**
- Any of the 25 canary phrases from the smoke test → **zero results**

### What the app DOES have:
1. `containsForbiddenPipelineArtifact()` (manuscriptFixer.js line 1377) — checks for exactly 4 specific internal pipeline phrases:
   - "The false start collapsed into the only route that mattered."
   - "The alternate draft collapsed into the only route that mattered."
   - "The retry collapsed into the only route that mattered."
   - These are internal app pipeline markers, NOT LLM process leaks.

2. `looksLikeOutlineOrNotes()` (anthologyPolishChecks.js, called from `runAnthologyHardErrorDetector()`) — detects outline/scaffold content, but:
   - This function is NOT called during `fixEntireManuscript()`
   - Even if it were, it's diagnostic-only (reports warnings, doesn't reject)
   - It may not detect editorial critique ("The opening is sharp...")

### Why the process leak in Ch.2 survived:
1. The rewrite LLM (ghostwriter) generated editorial critique instead of prose for Ch.2
2. The fix/polish pipeline loaded this as valid chapter content
3. No function in the entire pipeline checks whether content looks like editorial feedback
4. The pipeline proceeded to mechanically fix punctuation, caps, etc. on the critique text
5. The voice audit (LLM) did not flag it because it compares original vs polished, and both versions contain the same critique
6. The content was saved and exported unchanged

### Diagnosis summary:
| Question | Answer |
|----------|--------|
| Was process-leak detection run? | **No** — it does not exist |
| Did it miss phrases because the list is incomplete? | N/A — no list exists |
| Did it run only in smoke tests, not app? | **Yes** — process-leak detection was only in the external `anthology-targeted-repair.mjs` script |
| Did it run too late? | N/A — never runs |
| Did it allow contaminated chapters to pass into polish? | **Yes** — no gate exists |
| Did fix/polish try to clean process leakage instead of rejecting? | No — fix/polish has no concept of process leakage. It treats editorial text as valid prose and applies mechanical fixes to it. |

## Process Leaks Found in DOCX Files

| Chapter | Phrase | Rewrite Count | Polish Count | Survived? |
|---------|--------|--------------|-------------|-----------|
| 2 | "The opening is sharp, highly polished" | 1 | 1 | ❌ YES |
| 2 | "Next Move:" | 1 | 1 | ❌ YES |
| 2 | "Action Plan:" | 1 | 1 | ❌ YES |
| 2 | "The current trajectory is working exactly as planned" | 1 | 1 | ❌ YES |
| 2 | "We have established the what and the why" | 1 | 1 | ❌ YES |
| 2 | "We need to move" | 2 | 2 | ❌ YES |
| 2 | "Focus on how" | 1 | 1 | ❌ YES |

All 7 process-leak instances are in Chapter 2 only. No other chapters have process leaks. This is consistent with a single LLM misfire during the rewrite step.
