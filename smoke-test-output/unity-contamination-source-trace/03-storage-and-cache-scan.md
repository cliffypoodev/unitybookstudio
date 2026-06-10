# Storage and Cache Scan

> Generated: 2026-06-08

## All Unity-Related Matches

Every file containing Unity-related terms was cataloged, classified by location, and assessed for runtime reachability and contamination risk.

### Source Code (src/)

| Location | Match | Runtime Reachable? | Risk | Action |
|---|---|---|---|---|
| `anthologyCatalog.js` line 876 | "Unity Living-style management" in prompt catalog entry description | ✅ Yes — imported by `IdeasCatalogBrowser.jsx`, entries used as LLM prompts | 🔴 **CRITICAL** — Contamination Vector #1 | Remove "Unity Living" reference from catalog entry |
| `anthologyCatalog.js` line 877 | "Unity Living-style management" in prompt catalog entry content | ✅ Yes — same entry, content field | 🔴 **CRITICAL** — Contamination Vector #1 | Remove "Unity Living" reference from catalog entry |
| `bibliographyGenerator.js` line 31 | `CAREGIVING_RE` regex matching Medicaid, waiver, HCBS, Missouri DMH, DSP | ✅ Yes — runs against manuscript text | 🔴 **CRITICAL** — Contamination Vector #2 | Add `book_type` guard to restrict to nonfiction |
| `bibliographyGenerator.js` lines 194-199 | Hardcoded bibliography entries: Missouri DMH, Medicaid Provider Manuals, CMS HCBS | ✅ Yes — returned by `sourceLinesForDomain` | 🔴 **CRITICAL** — Contamination Vector #2 | Gate behind nonfiction project type check |
| `bibliographyGenerator.js` line 118 | `detectProjectDomain` routes on manuscript text patterns | ✅ Yes — triggers for ANY project matching caregiving terms | 🟡 **HIGH** — routing mechanism for Vector #2 | Add project type filtering |
| `manuscriptSafetyGate.js` lines 228-232 | Detects Unity terms as critical contamination | ✅ Yes — safety gate (detection only) | ✅ **SAFE** — this is a safety gate, not a source | No action needed (functions correctly) |
| `pipelineValidator.js` lines 8-10 | Blocks Unity terms | ✅ Yes — validation gate (detection only) | ✅ **SAFE** — this is a safety gate, not a source | No action needed (functions correctly) |
| `llmProsePolisher.js` lines 86-87 | Detects Unity terms for polishing | ✅ Yes — polish gate (detection only) | ✅ **SAFE** — this is a safety gate, not a source | No action needed (functions correctly) |
| `localDB.js` | `DB_NAME = 'UnityBookStudio'` | ✅ Yes — IndexedDB database name | ✅ **SAFE** — database name, never sent to LLM | No action needed |
| `NovelHero.jsx` | Displays "Unity Book Studio" | ✅ Yes — UI display only | ✅ **SAFE** — app branding, not in LLM prompts | No action needed |
| `WelcomeScreen.jsx` | Displays "Unity Book Studio" | ✅ Yes — UI display only | ✅ **SAFE** — app branding, not in LLM prompts | No action needed |
| `FloatingBrainstorm.jsx` | System prompt: "Unity Book Studio Story Architect" | ✅ Yes — reaches LLM as app identity | 🟢 **LOW** — refers to app name, not "Unity Supported Living" | Monitor but no immediate action |
| `IdeasChatbot.jsx` | System prompt: "Unity Book Studio Story Architect" | ✅ Yes — reaches LLM as app identity | 🟢 **LOW** — refers to app name, not "Unity Supported Living" | Monitor but no immediate action |

### Smoke Test Output (smoke-test-output/)

| Location | Match | Runtime Reachable? | Risk | Action |
|---|---|---|---|---|
| `anthology-prepolish-gate/01-extracted-chapters/chapter-20.txt` | "Unity Supported Living Services LLC" in generated prose | ❌ No — output artifact from prior run | ⚠️ **EVIDENCE** — proves contamination occurred during generation | Retain as evidence; regenerate after fix |
| `anthology-prepolish-gate/01-extracted-chapters/chapter-10.txt` | "Unity Supported Living Services LLC", "Unity Media Solutions" in generated prose | ❌ No — output artifact from prior run | ⚠️ **EVIDENCE** — proves contamination occurred during generation | Retain as evidence; regenerate after fix |
| `anthology-final-polish/05-final-polished-chapters/` | Same contamination persisted through polish | ❌ No — output artifact from prior run | ⚠️ **EVIDENCE** — proves safety gate did not block contamination at polish stage | Retain as evidence; regenerate after fix |
| `anthology-final-polish/08-final-export/export-text.txt` | Same contamination persisted through export | ❌ No — output artifact from prior run | ⚠️ **EVIDENCE** — proves contamination persisted to final export | Retain as evidence; regenerate after fix |

## Summary

| Category | Count | Action Required |
|---|---|---|
| 🔴 Critical contamination vectors (src/) | 2 sources (5 lines) | **Immediate fix required** |
| ✅ Safety gates (src/) | 3 files | No action (functioning correctly) |
| ✅ Branding (src/) | 5 files | No action (harmless app name) |
| ⚠️ Contaminated output (smoke-test-output/) | 4 files | Retain as evidence; not runtime-reachable |

> **Note**: Matches in `smoke-test-output/` are generated artifacts from prior runs. They are NOT runtime-reachable by the application and do not contribute to future contamination. They serve as forensic evidence that the contamination pipeline was active.
