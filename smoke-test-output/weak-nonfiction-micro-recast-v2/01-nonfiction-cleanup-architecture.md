# 01 — Nonfiction Cleanup Architecture

**Pipeline**: ANTI-CHATBOT-RECAST-PIPELINE v5.0  
**Module**: `src/lib/nonfictionAntiChatbotCleanup.js` (859 lines)  
**Date**: 2026-06-09

---

## Two-Subsystem Design

The nonfiction cleanup module implements two independent subsystems that run in sequence:

```
Original Text
    │
    ▼
┌───────────────────────────────┐
│  1. Deterministic Cleanup     │  ← Regex-based, zero LLM risk
│     - Essay-bot removal       │
│     - Filter verb reduction   │
│     - Not-just simplification │
│     - Weak opening fixes      │
│     - Structure validation    │
└───────────────────────────────┘
    │
    ▼
┌───────────────────────────────┐
│  2. Paragraph Micro-Recast    │  ← LLM-based, per-unit validation
│     - Paragraph splitting     │
│     - Eligibility check       │
│     - LLM rewrite             │
│     - 5-gate validation       │
│     - Global structure check  │
└───────────────────────────────┘
    │
    ▼
Cleaned Text
```

---

## Module Exports (11 Functions)

### Detection

| # | Export | Purpose |
|---|--------|---------|
| 1 | `detectNonfictionWeaknesses` | Detects essay-bot transitions, filter verbs, not-just constructions, weak openings. Returns counts and details. |

### Deterministic Cleanup

| # | Export | Purpose |
|---|--------|---------|
| 2 | `reduceEssayBotTransitions` | Removes Moreover / Furthermore / Additionally / It is important to note / etc. at sentence start. Citation-safe, bibliography-safe. |
| 3 | `reduceNonfictionFilterVerbs` | Removes "It felt like" / "It seemed like" / "appeared to be". Citation-safe. |
| 4 | `reduceNotJustConstructions` | "not just X, but Y" → "both X and Y"; "wasn't simply" → "was" |
| 5 | `strengthenNonfictionParagraphOpenings` | "The fact is that X" → "X". Skips headings, bibliography, short paragraphs. |
| 6 | `preserveNonfictionStructure` | Validates heading count and citation count between original and revised. |
| 7 | `runNonfictionDeterministicCleanup` | Orchestrator: protect → detect → clean (phases 1–4) → validate structure → return changelog. |

### Micro-Recast

| # | Export | Purpose |
|---|--------|---------|
| 8 | `splitNonfictionIntoMicroRecastUnits` | Paragraph-level splitting with type classification (heading / bibliography / list / citation_heavy / short / eligible). |
| 9 | `shouldMicroRecastNonfictionUnit` | Eligibility check: protected units skip, eligible units need score < threshold (default 75). |
| 10 | `buildNonfictionMicroRecastPrompt` | Strict nonfiction paragraph prompt with word count bounds (95–115%), citation preservation, anti-hallucination rules. |
| 11 | `runNonfictionMicroRecastPipeline` | Full pipeline: split → eligibility → LLM call → per-paragraph validation → global structure validation. |

---

## Safety Constraints

The module enforces five inviolable safety constraints:

| Constraint | Enforcement Mechanism |
|---|---|
| Never alter citation parentheticals | `isInsideCitation()` checks match position against `(Author, Year)` and `[N]` spans |
| Never alter bibliography sections | `isBibliographySection()` detects References / Bibliography / Works Cited / Sources / Endnotes / Footnotes |
| Never remove headings | Markdown `#` and ALL-CAPS < 80 chars classified as protected |
| Never remove list items | Lists (>50% list lines) classified as protected |
| Return detailed change log | Every function returns structured changes with from/to/position |

**Global structure validation** (`preserveNonfictionStructure`) runs after both subsystems. If headings or citations decrease, the entire pipeline output is **aborted** and the original text is returned unchanged.

---

## Cleanup Rules

### Essay-Bot Transitions (8 patterns)

```javascript
const ESSAY_BOT_REPLACEMENTS = [
  // Sentence-start transitions → removed
  'Moreover, '              → ''
  'Furthermore, '           → ''
  'Additionally, '          → ''
  'It is important to note that ' → ''
  'It should be understood that ' → ''
  'This shows that '        → ''
  'This highlights '        → ''
  "In today's world "       → ''
];
```

### Filter Verb Patterns (5 patterns)

```
"It felt like X"          → "X"           (capitalize)
"It seemed like X"        → "X"           (capitalize)
"X seemed to be Y"        → "X was Y"
"X appeared to be Y"      → "X was Y"
"seemed to [verb]"        → "[verb]ed"    (nonfiction-safe)
```

### Not-Just Constructions (4 patterns)

```
"not just X, but Y"       → "both X and Y"
"wasn't simply X"         → "was X"
"wasn't just X"           → "was X"
"more than X —"           → "X and"
```

### Weak Openings

```
"The fact is that X"      → "X"
"The reality was that X"  → "X"
"The truth is that X"     → "X"
```

---

## Constants

```javascript
NONFICTION_PROFILES = Set(['nonfiction', 'business_guide', 'training_manual'])
ESSAY_BOT_REPLACEMENTS    // 8 patterns
NONFICTION_FILTER_VERB_PATTERNS  // 5 patterns
NOT_JUST_PATTERNS         // 4 patterns
```

---

## Micro-Recast Validation Gates

Each paragraph-level LLM rewrite must pass **all five gates** to be accepted:

| Gate | Requirement | Rationale |
|---|---|---|
| 1. Word Ratio | 92–115% of original | Prevents over-compression or inflation |
| 2. Citation Preservation | `recastCitations >= originalCitations` | No citation loss |
| 3. Quality | `afterScore >= beforeScore` | No score regression |
| 4. Chatbot Pattern | `afterPatterns <= beforePatterns + 2` | No chatbot language increase |
| 5. Global Structure | Headings and citations preserved across full text | Final safety net |

If any gate fails, the original paragraph text is preserved unchanged.

---

## Pipeline Integration

### antiChatbotRecastPipeline.js v5.0

```
Input Text + Profile
    │
    ├── Nonfiction profile?
    │     YES → runNonfictionDeterministicCleanup
    │           → runNonfictionMicroRecastPipeline
    │           → preserveNonfictionStructure (global)
    │
    │     NO  → Existing v4 chunk pipeline (unchanged)
    │
    ▼
Output Text + Report
```

- **Nonfiction profiles** (`nonfiction`, `business_guide`, `training_manual`) → deterministic cleanup first → micro-recast eligible weak paragraphs
- **Non-nonfiction profiles** → existing v4 chunk pipeline (unchanged)
- **`skipNonfictionCleanup`** option available for backward compatibility
- **Global structure validation** runs before returning final output

---

## Dependencies

```javascript
import { analyzeProseTexture, getAntiChatbotRulesForProject, countChatbotPatterns } from './antiChatbotProse.js';
import { detectMarkdownHeadings, detectSectionHeadings } from './recastModelRouting.js';
```

---

## Key Design Decisions

1. **Deterministic-first**: Regex cleanup runs before any LLM involvement, capturing the highest-value improvements at zero risk.
2. **Paragraph-level granularity**: Unlike v4's chunk-level approach, v5 operates on individual paragraphs, enabling fine-grained eligibility and validation.
3. **Fail-safe by default**: Every validation gate defaults to preserving the original text on failure. No destructive fallback.
4. **Citation-aware regex**: All deterministic replacements check `isInsideCitation()` before modifying text.
5. **Composable exports**: Each function is independently testable and usable, enabling fine-grained unit testing.
