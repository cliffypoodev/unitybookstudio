# Root Cause Verdict

> Generated: 2026-06-08

---

```
ROOT CAUSE: PROMPT CATALOG CONTAMINATION + BIBLIOGRAPHY DOMAIN ROUTING
```

---

## Vector 1: Prompt Catalog Contamination (CONFIRMED)

**Source**: `anthologyCatalog.js` line 876

**Contaminated text**:
```
"Practical strategies for Unity Living-style management"
```

**Context**: This text appears in a prompt catalog entry titled "The $0.003 Revolution" in the Music Industry genre. The entry's `description` and `content` fields both contain the phrase "Unity Living-style management", which is a direct reference to Unity Supported Living.

**Propagation path**:
1. `IdeasCatalogBrowser.jsx` imports `anthologyCatalog.js` and presents entries as prompts for new projects
2. When an author selects this prompt (or an LLM mashup includes it), the text becomes the project's `seed_concept`
3. The `seed_concept` propagates into Foundation context → Outline generation → Chapter generation prompts
4. The ghostwriter LLM receives "Unity Living-style management" in its prompt and interpolates it into prose as "Unity Supported Living Services LLC" and "Unity Media Solutions"

**Severity**: 🔴 CRITICAL — This is a direct injection path from source code to LLM output.

---

## Vector 2: Bibliography Domain Routing Contamination (CONFIRMED)

**Source**: `bibliographyGenerator.js`

**Mechanism**:
- Line 31: `CAREGIVING_RE` regex detects terms including Medicaid, waiver, HCBS, Missouri DMH, DSP in manuscript text
- Line 118: `detectProjectDomain` matches on **manuscript text patterns**, not project identity or `book_type`
- Lines 194-199: `sourceLinesForDomain('caregiving')` returns hardcoded bibliography entries:
  - Missouri DMH documentation
  - Medicaid Provider Manuals
  - CMS HCBS Final Rule

**The critical flaw**: This system is **project-type-agnostic**. It triggers on text content patterns regardless of whether the project is fiction or nonfiction. A fiction novel that mentions a character as a "caregiver" or includes dialogue about "Medicaid" will have Missouri-specific caregiving bibliography sources injected.

**Severity**: 🔴 CRITICAL — Any project touching caregiving vocabulary will receive domain-inappropriate bibliography sources.

---

## Vector 3: Ollama KV Cache Bleed (POSSIBLE, SECONDARY)

**Source**: `localLLM.js` → Ollama server at `127.0.0.1:11434`

**Mechanism**:
- Ollama's default `keep_alive` is 5 minutes
- During this window, model weights stay loaded and the KV cache from the previous request MAY persist
- If a Unity/caregiving project was processed before a fiction project within the same 5-minute window, residual KV cache entries could influence fiction generation
- The `ghostwriter` system prompt is an empty string, providing no guardrail against topic bleed

**Assessment**: This is **speculative but plausible**. The intermittent nature of the observed contamination is consistent with model-level bleed. However:
- Vectors 1 and 2 are **sufficient** to explain all observed contamination instances
- KV cache bleed would **amplify** contamination from those vectors but is not required as a standalone explanation
- Without a running Ollama instance, this vector cannot be confirmed or ruled out

**Severity**: 🟡 SECONDARY — Possible amplifier of primary vectors.

---

## Evidence from Contaminated Output

The following contaminated output files serve as forensic evidence:

| File | Contamination Found |
|---|---|
| `anthology-prepolish-gate/01-extracted-chapters/chapter-10.txt` | "Unity Supported Living Services LLC", "Unity Media Solutions" |
| `anthology-prepolish-gate/01-extracted-chapters/chapter-20.txt` | "Unity Supported Living Services LLC" |
| `anthology-final-polish/05-final-polished-chapters/` | Same contamination persisted through polish stage |
| `anthology-final-polish/08-final-export/export-text.txt` | Same contamination persisted to final export |

### Key Observation

The exact phrases **"Unity Supported Living Services LLC"** and **"Unity Media Solutions"** do **NOT** appear in any prompt template, catalog entry, or source code file as injectable text. The source code contains only:

```
"Unity Living-style management"
```

This means the LLM **interpolated** the seed text, expanding "Unity Living" into plausible-sounding business entities:
- "Unity Living" → "Unity Supported Living Services LLC" (expanded into a caregiving business name)
- "Unity Living" → "Unity Media Solutions" (expanded into a media company name)

This interpolation behavior is consistent with how large language models extrapolate from contextual cues, and confirms that the contamination originated from the prompt pipeline (Vector 1) rather than from a hardcoded injection.

---

## Verdict Summary

| Vector | Status | Severity | Root Cause? |
|---|---|---|---|
| 1: Prompt catalog (`anthologyCatalog.js` line 876) | ✅ CONFIRMED | 🔴 CRITICAL | **YES** — primary |
| 2: Bibliography domain routing (`bibliographyGenerator.js`) | ✅ CONFIRMED | 🔴 CRITICAL | **YES** — primary |
| 3: Ollama KV cache bleed | ⚠️ POSSIBLE | 🟡 SECONDARY | Possible amplifier, not primary cause |
