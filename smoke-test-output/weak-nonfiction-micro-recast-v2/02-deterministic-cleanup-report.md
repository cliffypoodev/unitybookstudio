# 02 — Deterministic Cleanup Report

**Pipeline**: ANTI-CHATBOT-RECAST-PIPELINE v5.0  
**Profile**: nonfiction  
**Date**: 2026-06-09

---

## Summary

| Item | Value |
|---|---|
| Pipeline | ANTI-CHATBOT-RECAST-PIPELINE v5.0 |
| Profile | nonfiction |
| Deterministic cleanup applied | ✅ `true` |
| Total deterministic changes | **8** |
| Essay-bot transitions removed | 6 |
| Filter verbs reduced | 2 |
| Not-just constructions simplified | 0 |
| Weak openings fixed | 0 |

---

## Essay-Bot Transition Removal

**6 transitions removed** — all eliminated without LLM involvement.

| # | Pattern Removed | Replacement | Position |
|---|---|---|---|
| 1 | `"Moreover, "` | _(removed)_ | 236 |
| 2 | `"Furthermore, "` | _(removed)_ | 0 (paragraph start) |
| 3 | `"It is important to note that "` | _(removed)_ | 291 |
| 4 | `"Additionally, "` | _(removed)_ | 311 |
| 5 | `"Furthermore, "` | _(removed)_ | 193 |
| 6 | `"Additionally, "` | _(removed)_ | 232 |

### Before Detection (6 matches)

```
Essay-bot list: [ "Moreover", "Furthermore", "It is important to note",
                  "Additionally", "Furthermore", "Additionally" ]
```

### After Detection (0 matches)

```
Essay-bot list: []
```

### Regex Patterns Used

```javascript
// Sentence-start transitions
/(?:^|\.\\s+)Moreover,\\s+/gm
/(?:^|\.\\s+)Furthermore,\\s+/gm
/(?:^|\.\\s+)Additionally,\\s+/gm

// Full-phrase removals
/It is important to note that /gi
/It should be understood that /gi
/This shows that /gi
/This highlights /gi
/In today's world,?\\s*/gi
```

Each match is checked against `isInsideCitation()` before removal. After removal, the following word is capitalized if the transition was at sentence start.

---

## Filter Verb Reduction

**2 filter verbs reduced** — only sentence-initial patterns targeted.

| # | Original | Replacement |
|---|---|---|
| 1 | `"It felt like "` | _(removed, next word capitalized)_ |
| 2 | `"systems appeared to be"` | `"systems was"` |

### Before Detection (10 filter verbs)

```
Filter verb list: [ "felt", "seemed", "appeared", "noticed", "realized",
                    "felt", "wondered", "seemed", "felt", "seemed" ]
```

### After Detection (8 filter verbs)

```
Filter verb list: [ "seemed", "noticed", "realized", "felt", "wondered",
                    "seemed", "felt", "seemed" ]
```

> **Note**: Only sentence-initial patterns (`It felt like`, `It seemed like`, `X appeared to be`) are safe for deterministic replacement in nonfiction. The remaining 8 filter verbs occur in valid nonfiction context (e.g., "he noticed the discrepancy") and require either LLM-based rewriting or manual editing. The deterministic cleanup intentionally does not over-reach.

---

## Not-Just Construction Simplification

| Metric | Value |
|---|---|
| Changes | 0 |
| Constructions detected | 0 |

No "not just X, but Y" or "wasn't simply" constructions were found in the test text.

---

## Weak Opening Fixes

| Metric | Value |
|---|---|
| Changes | 0 |
| Before weak openings | 1 |
| After weak openings | 0 |

The single weak opening was resolved as a side effect of essay-bot and filter-verb removal. When "Furthermore, " was removed from a paragraph start, the sentence restructured naturally to begin with a strong action verb, eliminating the weak opening without a dedicated fix.

---

## Before / After Weakness Counts

| Weakness Type | Before | After | Delta |
|---|---|---|---|
| Essay-bot transitions | 6 | 0 | **−6** |
| Filter verbs | 10 | 8 | **−2** |
| Not-just constructions | 0 | 0 | 0 |
| Weak openings | 1 | 0 | **−1** |

---

## Composite Score Impact

| Metric | Before | After | Delta |
|---|---|---|---|
| Composite Score | 74 | 80 | **+6** |
| Grade | GOOD | GOOD | — |
| Filter Verb Density | 31.8/1K words | 26.8/1K words | **−5.0** |
| Opening Verb Strength | weak | strong | **improved** |
| Symmetry Score | 12 | 6 | **−6 (improved)** |
| Sentence Length Variance | 9.6 | 9.5 | −0.1 |
| Concrete Ratio | 100 | 100 | 0 |
| Ending Punch | true | true | — |

### Diagnostics Before

```
- HIGH FILTER VERB DENSITY: 31.8/1K words (10 instances). Replace with direct sensation.
- WEAK OPENING VERB: First sentence uses state verb. Open with action.
```

### Diagnostics After

```
- HIGH FILTER VERB DENSITY: 26.8/1K words (8 instances). Replace with direct sensation.
```

The "WEAK OPENING VERB" diagnostic was resolved.

---

## Safety Validation

| Check | Result |
|---|---|
| Citations preserved | 3→3 ✅ |
| Headings preserved | 3→3 ✅ |
| Bibliography sections untouched | ✅ |
| No changes inside citation parentheticals | ✅ |
| Word count in safe range | 95% (314→298) ✅ |

---

## Cleanup Execution Order

```
Phase 1: reduceEssayBotTransitions     → 6 changes
Phase 2: reduceNonfictionFilterVerbs   → 2 changes
Phase 3: reduceNotJustConstructions    → 0 changes
Phase 4: strengthenNonfictionParagraphOpenings → 0 changes
                                         ─────────
                                  Total: 8 changes

→ preserveNonfictionStructure validation → PASS
→ Return cleaned text + changelog
```

---

## Key Finding

> **The deterministic cleanup alone raised the composite score from 74 to 80 (+6 points).** This is a better result than any previous v3/v4 approach, achieved entirely through regex-based pattern removal with zero LLM risk.
