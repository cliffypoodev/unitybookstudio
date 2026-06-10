# Prompt Payload Trace

> Generated: 2026-06-08

## Prompt Section Analysis

Each section of the LLM prompt payload was inspected for the presence of Unity-related terms ("Unity Supported Living", "Unity Living", "Unity Media", "Medicaid", "Missouri DMH", "DSP", "waiver", "HCBS", "care documentation").

| Prompt Section | Contains Unity Terms? | Evidence | Status |
|---|---|---|---|
| System prompt | No (empty) | `localLLM.js` line 26: system prompts for `ghostwriter` are empty strings | ✅ Clean |
| Project context header | No (hardcoded template) | `buildProjectContextHeader` uses a single `spec` object; template contains no Unity terms | ✅ Clean |
| Setup constraints | No (hardcoded template) | `buildSetupConstraints` uses a single `project` object; template contains no Unity terms | ✅ Clean |
| Foundation context (outline, characters, etc.) | **Potentially yes — via seed_concept** | If the project's `seed_concept` was set from `anthologyCatalog.js` entry containing "Unity Living-style management", the Foundation context will carry it | ⚠️ VECTOR 1 |
| Chapter brief | No (dynamic from outline) | Chapter briefs are generated from the project outline, which itself derives from seed_concept — contamination is upstream | ✅ Clean (but inherits upstream) |
| Seed concept / premise | **Yes — if selected from contaminated catalog entry** | `anthologyCatalog.js` line 876: "Practical strategies for Unity Living-style management" | 🔴 VECTOR 1 |
| Prior chapter summaries | **Potentially yes — if prior chapter was contaminated** | If chapter-10 or chapter-20 were already contaminated, their summaries feed back into subsequent prompts | ⚠️ Propagation risk |
| Genre/voice blocks | No | Genre and voice blocks are built from project settings; no hardcoded Unity terms | ✅ Clean |
| Safety/enforcement suffixes | No | Safety suffixes contain anti-contamination rules, not Unity terms themselves | ✅ Clean |
| Model routing metadata | No | Model routing maps contain only model alias strings (`'ghostwriter'`, `'story-architect'`) | ✅ Clean |
| Retry suffixes | No | Retry suffixes are generic quality instructions with no domain-specific content | ✅ Clean |
| Bibliography sources | **Yes — if caregiving domain is detected** | `bibliographyGenerator.js` injects Missouri DMH, Medicaid, CMS HCBS sources when manuscript text matches `CAREGIVING_RE` | 🔴 VECTOR 2 |

## Conclusion

Unity terms **DO NOT** appear in hardcoded prompt templates. They enter the LLM pipeline **ONLY** via dynamic project data through two vectors:

1. **Seed concept from catalog** — `anthologyCatalog.js` line 876 contains "Unity Living-style management" in a Music Industry prompt entry. When selected or mashed up by `IdeasCatalogBrowser.jsx`, this text becomes the project's `seed_concept`, which then propagates to Foundation → Outline → Chapter Generation prompts.

2. **Bibliography from domain router** — `bibliographyGenerator.js` detects caregiving-related terms in manuscript text (`CAREGIVING_RE` regex at line 31) and injects hardcoded Missouri-specific caregiving sources. This is project-type-agnostic: a fiction novel mentioning "caregiver" or "Medicaid" will trigger the injection.

### Propagation Path

```
anthologyCatalog.js (line 876)
  └─ "Unity Living-style management"
       └─ IdeasCatalogBrowser.jsx (prompt selection / mashup)
            └─ project.seed_concept
                 └─ Foundation / Setup context
                      └─ Outline generation prompt
                           └─ Chapter generation prompt
                                └─ ghostwriter output
                                     └─ chapter-10.txt, chapter-20.txt
                                          └─ "Unity Supported Living Services LLC"
                                          └─ "Unity Media Solutions"
```

> **Key Finding**: The exact phrases "Unity Supported Living Services LLC" and "Unity Media Solutions" found in the contaminated output do NOT appear anywhere in source code as injection text. The LLM **interpolated** these from the "Unity Living-style management" seed, expanding it into plausible-sounding business entities.
