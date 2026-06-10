# 02 — Prose Defect Taxonomy

**Date:** 2026-06-10  
**Purpose:** Classify all defects UBS must handle, with detection strategy for each.

---

## Group 1: Hard Mechanical Defects

These MUST be fixed or blocked. No clean manuscript ships with these.

| Defect | Example | Detection | Action |
|--------|---------|-----------|--------|
| Duplicated words | "Was was biometric" | `/\b(\w{2,})\s+\1\b/gi` | Auto-fix → single word |
| "the the" / "a a" | "the the door" | `/\bthe\s+the\b/gi` | Auto-fix → single |
| Subject/verb error | "She were carrying" | `/\bShe were\b/gi` with subjunctive exclusion | Auto-fix → "She was" |
| Article error | "a obvious" | `/\ba obvious\b/gi` | Auto-fix → "an obvious" |
| "had had" (valid) | "had had enough" | Skip — legitimate past perfect | No action |
| Garbled proper-noun+were | "Aether were optimized" | Proper noun regex + "were" | Flag/block |
| Malformed fragments | "reached for the and" | Pattern-specific regexes | Auto-fix or flag |
| Broken punctuation spacing | "word . Next" | Space-before-punctuation regex | Auto-fix |
| Bad capitalization artifacts | "word.next" (missing space+cap) | `/[a-z]\.[A-Z]/` | Auto-fix: insert space |

### Currently Handled By
- `prosePolishQualityGate.js`: detect + repair (She were, Was was, a obvious)
- `manuscriptSafetyGate.js`: detect + block (proper noun+were, fragments)
- `punctuationPolish.js`: partial (repeated words, duplicate articles)

---

## Group 2: Formatting Artifacts

These are deterministic surface issues from LLM generation or processing.

| Defect | Example | Detection | Action |
|--------|---------|-----------|--------|
| Spaced abbreviations | "e. g." / "i. e." | `/\be\.\s+g\.\b/gi` | Auto-fix → "e.g." |
| Brand casing | "youTube" / "linkedIn" | Lookup table | Auto-fix → "YouTube" |
| Em-dash cap artifacts | "—Every" (sentence start) | Context-aware regex | Normalize if casing error |
| Spaced quoted terms | "' compliance. '" | `/'\s+\w+\.\s+'/g` | Auto-fix: clean spaces |
| Broken apostrophes | "don ' t" | `/\w+\s+'\s+\w+/g` | Auto-fix: collapse |
| Source markers | "[SOURCE NEEDED]", "[TK]" | Literal regex | Auto-remove |
| Markdown residue | "**bold**", "# heading" (in prose) | `/\*\*[^*]+\*\*/g` | Auto-strip |
| Process residue | "{{placeholder}}", "TODO:" | Pattern match | Auto-remove |

### Currently Handled By
- **NONE** — no existing module handles these consistently. `postClean.js` has some markdown stripping but it's an orphaned module not imported anywhere.

---

## Group 3: Dialogue Mechanics

| Defect | Example | Detection | Action |
|--------|---------|-----------|--------|
| Missing opening quote | `she retorted\u201d` without `\u201c` | Backward scan for unmatched closers | Auto-repair (insert `\u201c`) |
| Mid-paragraph opener | Dialogue starts mid-paragraph without `\u201c` | 9-check classifier | Auto-fix if SAFE, else manual review |
| Broken dialogue tags | `"text" she said.` (missing comma) | Tag pattern regex | Auto-fix → `"text," she said.` |
| Unbalanced quotes | Odd number of quotes per paragraph | Count-based | Flag for review |
| Attribution punctuation | Period instead of comma before tag | `/\.\u201d\s+(she\|he) said/gi` | Auto-fix |

### Currently Handled By
- `dialogueMechanicsRepair.js`: Full detect + repair + mid-paragraph classifier
- `prosePolishQualityGate.js`: Lightweight inline detection (avoids circular dep)
- `punctuationPolish.js`: Dialogue punctuation placement + filler stripping

---

## Group 4: AI-Slop / Repetition

| Defect | Example | Budget | Action |
|--------|---------|--------|--------|
| "not just" family | "wasn't just a tool" | 2/chapter | Deterministic recast |
| "the weight of" | "the weight of the decision" | 2/chapter | Recast or flag |
| Filtering verbs | "She felt the tension" | 6/chapter | Invert subject/object |
| "realized" family | "He realized that" | 3/chapter | Drop filter, keep clause |
| Individual slop words | "palpable", "meticulous" | 1/chapter | Drop adjective |
| **Forensic/essay phrases** | "The available accounts indicate" | **NOT BUDGETED** | **NEW: track + flag** |
| **"The record suggests"** | "The record suggests" | **NOT BUDGETED** | **NEW: track + flag** |
| **"This suggests"** | "This suggests that" | **NOT BUDGETED** | **NEW: track + flag** |
| **"What remains unclear"** | "What remains unclear is" | **NOT BUDGETED** | **NEW: track + flag** |
| **"The question therefore shifts"** | leading phrase | **NOT BUDGETED** | **NEW: track + flag** |

### Currently Handled By
- `aiSlopReduction.js`: 35 patterns, budget-based, deterministic recasts
- `prosePolishQualityGate.js`: 23 patterns, report only
- `exportSafetyGate.js`: 13 patterns inline, report only
- **Gap:** Forensic/essay phrases not tracked anywhere

---

## Group 5: Scene-vs-Essay Imbalance

| Defect | Indicator | Detection | Action |
|--------|-----------|-----------|--------|
| Too much abstract explanation | High ratio of "indicates/suggests/remains" | Count forensic phrases per 1K words | **Warn only** |
| Too little scene action | Low dialogue line count, few action verbs | Count dialogue lines + verbs | **Warn only** |
| Case-study voice | Repeated chapter structure patterns | Pattern matching | **Warn only** |
| Repeated philosophical endings | "The question remains..." as chapter closer | End-of-chapter scan | **Warn only** |

### Currently Handled By
- **NONE** — no existing module detects or reports essay/scene imbalance.

### Design Principle
Scene-vs-essay imbalance is **reported, never auto-rewritten**. Full-chapter rewrites require editorial judgment and are dangerous to automate.

---

## Group 6: Voice/Genre Preservation

| Genre | Preservation Rule |
|-------|------------------|
| Fiction | Full cleanup: grammar, dialogue, slop reduction, progressive tense conversion |
| Nonfiction | Preserve citations `(Author, Year)`, headings, bibliography sections. Relaxed slop thresholds. |
| Training Manual | Preserve bullets, numbered steps, compliance language, structure |
| Memoir | Preserve first-person voice. "I" pronouns are intentional, not slop. |
| Adult Romance | Do NOT censor safe adult content. Explicit language is intentional. |
| Anthology/Dossier | Preserve intentional dossier voice if project requests it |

### Currently Handled By
- `antiChatbotProse.js`: Genre-conditional voice blocks (8 variants)
- `polishPipelineConfig.js`: Profile-based gating (which steps to run)
- `nonfictionAntiChatbotCleanup.js`: Nonfiction-specific cleanup with structure preservation
- **Gap:** No centralized genre-aware gating in a unified text-in/text-out pipeline
