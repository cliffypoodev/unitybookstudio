# Contamination Guard Diagnosis

## Root Cause: The contamination detector is diagnostic-only and name-only

### Evidence

**File:** `src/lib/anthologyPolishChecks.js` lines 691-762

The contamination detector function header explicitly states:
```
Diagnostic-only version.

New behavior:
- No deletion.
- No sentence removal.
- Only checks character/cast-style names from other projects.
- Ignores project titles, book titles, genre labels, and common nouns.
- Native names are skipped.
- Suspicious low-count foreign character names are reported only.
```

### What it actually does:
1. Calls `fetchOtherProjectNames()` — fetches character names from other projects in the DB
2. Filters names through `isProbablyHumanName()` — removes anything that doesn't look like a person name
3. For each remaining name, checks if it appears in chapters
4. If found, it either SKIPS (native) or FLAGS ONLY (foreign) — **never removes**

### What it does NOT do:
- Does NOT check for organization names: "Unity Supported Living Services", "Unity Media Solutions"
- Does NOT check for business terms: "care documentation", "compliance documentation"
- Does NOT check for financial terms: "Q3", "ROI", "cohort analysis"
- Does NOT have any hardcoded forbidden phrase list
- Does NOT remove or reject contaminated content
- Does NOT mark chapters for regeneration

### Why "Unity Supported Living" survives:
"Unity Supported Living Services" is an organization name, not a character name. `isProbablyHumanName()` would reject it because it doesn't look like "Jebediah" or "Vivian Dale". Even if it passed the filter, the function would only FLAG it — never remove it.

### Why "care documentation" survives:
This is a common noun phrase, not a proper name. The contamination detector only checks proper names from other projects. It has no concept of "this domain-specific phrase doesn't belong in this anthology."

### Diagnosis summary:
| Question | Answer |
|----------|--------|
| Was contamination detection run? | Yes — during `runAnthologySpecificPasses()` |
| Was it run but only logged as warning? | Yes — FLAG ONLY, no removal |
| Was it run after save/export? | No — run before save, during fix/polish |
| Was the forbidden list different? | **Yes** — the app list is character-names-only; the smoke test had explicit org/business terms |
| Was it skipped because anthology uses business language? | Partially — the detector design intentionally avoids business terms |
| Was generic "platform" confusion causing the guard to be disabled? | No — the guard was never designed to check these terms |
| Did fix/polish preserve contamination because it thought it was story content? | **Yes** — the detector cannot distinguish Unity project terms from story terms |

## Contamination Found in DOCX Files

### True contamination (from other projects):

| Term | Rewrite Chapters | Polish Chapters | Source Project |
|------|-----------------|-----------------|---------------|
| Unity Supported Living Services | Ch.2, Ch.15 | Ch.2, Ch.15 | Unity Supported Living project |
| Unity Supported Living | Ch.2, Ch.15 | Ch.2, Ch.15 | Unity Supported Living project |
| Unity Media Solutions | Ch.2, Ch.6, Ch.15 | Ch.2, Ch.6, Ch.15 | Unity Supported Living project |
| Unity Media | Ch.2, Ch.6, Ch.15 | Ch.2, Ch.6, Ch.15 | Unity Supported Living project |
| care documentation | Ch.2 | Ch.2 | Unity Supported Living project |
| compliance documentation | Ch.2 | Ch.2 | Unity Supported Living project |

### Possibly legitimate in-story terms:

| Term | Chapters | Context |
|------|----------|---------|
| Q3 | Ch.12 | Digital equity / algorithmic context — may be story-native |
| ROI | Ch.5, Ch.8, Ch.17, Ch.20 | Digital equity context — may be story-native |
| startup | Ch.8, Ch.13 | Tech context — may be story-native |
