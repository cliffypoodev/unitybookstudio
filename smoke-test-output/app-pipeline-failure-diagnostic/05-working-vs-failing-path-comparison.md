# Working vs. Failing Path Comparison

## Safety Feature Coverage

| Safety Feature | Working Targeted Repair (smoke test) | App Rewrite All Path | App Fix/Polish Path | Missing? | Impact |
|---|---|---|---|---|---|
| **Process-leak detector** | ✅ Custom scan (25+ phrases) | ❌ ABSENT | ❌ ABSENT | **CRITICAL** | Process-leaked chapters pass through uncleaned |
| **Hard reject for process leakage** | ✅ Chapters flagged REGENERATE | ❌ ABSENT | ❌ ABSENT | **CRITICAL** | Ch.2 has editorial critique as "prose" |
| **Contamination detector (org/business terms)** | ✅ Checked "Unity Supported Living", "Unity Media", "care documentation", etc. | ❌ ABSENT | ⚠️ Character-name only | **CRITICAL** | Organization names survive both paths |
| **Hard reject for contamination** | ✅ Chapters with Unity/care terms flagged for regeneration | ❌ ABSENT | ❌ Flag-only, no removal | **CRITICAL** | 9 chapters contaminated, 0 cleaned |
| **Targeted regeneration of rejected chapters** | ✅ Chapters 6, 10, 15 regenerated via Ollama | ❌ ABSENT | ❌ ABSENT | **CRITICAL** | No mechanism to redo bad chapters |
| **Quote repair** | ✅ Deterministic regex (opening + closing) | ⚠️ Only in prompt to LLM | ⚠️ fixHangingQuotes (step 6) | **PARTIAL** | Some missing quotes survive |
| **"not just" / slop phrase removal** | ✅ Deterministic regex with grammar preservation | ⚠️ LLM-based (in rewrite prompt) | ⚠️ LLM-based (in postDraftCleanup) but runLLM=false in fix/polish | **BROKEN** | Rewrite reduces aggressively, fix/polish has no deterministic slop removal |
| **Banned word removal (palpable, etc.)** | ✅ Deterministic regex replacement | ⚠️ LLM-based (in rewrite prompt) | ⚠️ anthology vocab bans (different list: beacon, profound, etc.) | **PARTIAL** | Rewrite handles some, fix/polish misses |
| **Exact final-line enforcement** | ✅ Yes | ❌ N/A | ✅ Yes | OK | — |
| **Malformed fragment detector** | ✅ Detected "Was was", "You was" | ❌ N/A | ✅ detectMalformedGrammarArtifacts | **PARTIAL** | Detector exists but doesn't catch all patterns |
| **Before/after stage snapshots** | ✅ Full stage-by-stage output | ❌ N/A | ⚠️ cloneLoadedSnapshot per pass | **PARTIAL** | Internal only, not externally inspectable |
| **Final quality gate before save** | ✅ Full report with per-chapter verdicts | ❌ N/A | ⚠️ Grammar integrity gate (line 7767) | **PARTIAL** | Gate checks grammar, not process leaks or contamination |
| **Final quality gate before export** | ✅ Yes | ❌ N/A | ❌ ABSENT | **CRITICAL** | Export has zero validation |
| **Content field precedence check** | ✅ Explicit content_md resolution | ⚠️ Saves to content_md | ✅ loadDraftedBodyChapters resolves | OK | — |

## Root Cause: Two Completely Different Systems

The working targeted repair pipeline was a **custom external script** (`anthology-targeted-repair.mjs`) that ran outside the app. It had:
- Its own process-leak detection with 25+ canary phrases
- Its own contamination guard with explicit forbidden term lists
- Regeneration via Ollama for failed chapters
- Deterministic regex-based slop removal with grammar safety

The app's Fix/Polish pipeline (`fixEntireManuscript`) has **NONE of these**:
- No process-leak detection at all
- Contamination detector is diagnostic-only and only checks character names
- No regeneration mechanism
- Slop removal is LLM-based but `runLLM: false` disables it during fix/polish
- The only safeguards are structural (branch collision, voice audit, grammar gate)

The app was designed to fix grammar and formatting issues, NOT to detect and reject entire chapters that contain editorial commentary or cross-project contamination.
