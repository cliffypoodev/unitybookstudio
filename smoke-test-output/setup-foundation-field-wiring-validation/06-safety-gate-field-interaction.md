# Safety Gate × Setup Field Interaction

## Overview
This report documents how every safety gate interacts with Setup/Foundation fields.

## Gate 1: Manuscript Safety Gate (`manuscriptSafetyGate.js`)

| Check | Affected by Setup Fields? | Details |
|---|---|---|
| Process leak detection | ❌ Universal | Same patterns for all genres |
| Contamination detection | ❌ Universal | Same patterns for all genres |
| Malformed grammar | ❌ Universal | Same thresholds for all genres |

**Verdict:** Manuscript Safety Gate is genre-agnostic. This is correct — process leaks and contamination are always dangerous regardless of genre.

## Gate 2: Export Safety Gate (`exportSafetyGate.js`)

| Check | Setup Fields Used | How |
|---|---|---|
| Dialogue issue density | `genre` → `resolvePolishProfile()` → profile.`dialogueRepair` | Profile determines whether dialogue repair is active and threshold |
| Slop density threshold | `genre` → `resolvePolishProfile()` → profile.`slopReduction` | Higher slop budgets for training manual/business guide |
| Reference integrity | `book_type` → `shouldRunReferenceIntegrity()` | NF: always check. Fiction: auto-detect only |
| Stale URL blocking | `book_type` → chapter URL resolution | Always active |
| Process leak pass-through | N/A | Always checks |
| Contamination pass-through | N/A | Always checks |

**Verdict:** Export Safety Gate correctly uses genre-based profile routing from Setup.

## Gate 3: Prose Polish Quality Gate (`prosePolishQualityGate.js`)

| Check | Setup Fields Used | How |
|---|---|---|
| Score thresholds | `genre` → `resolvePolishProfile()` | Different pass/fail thresholds per profile |
| Voice preservation | `genre` → profile.`preserveVoice` | Memoir and literary: stricter voice preservation |
| Slop scoring | `genre` → profile.`slopReduction` | Training manual: tolerant. Fiction: strict |

**Verdict:** Quality Gate correctly adapts to genre profile.

## Gate 4: Reference Integrity Gate (`referenceIntegrityGate.js`)

| Check | Setup Fields Used | How |
|---|---|---|
| Citation crosscheck | `book_type` | Only runs on nonfiction or auto-detected references |
| Suspicious reference detection | `book_type` | More aggressive flagging for NF |
| Unsupported claim detection | `book_type` | Only meaningful for NF |
| URL/DOI preservation check | `book_type` | NF: strict. Fiction: informational |

**Verdict:** Reference integrity correctly routes based on book_type.

## Reading Level × Content Limits

The `reading_level` field in Setup creates hard content limits via `getEffectiveContentSettings()`:

| Reading Level | Spice Clamp | Gore Clamp | Language Clamp | Source |
|---|---|---|---|---|
| `children` | 0 (forced) | max 1 | 0 (forced) | `sceneWriter.js` L296-299 |
| `middle_grade` | 0 (forced) | max 1 | 0 (forced) | `sceneWriter.js` L296-299 |
| `young_adult` | max 1 | max 2 | max 2 | `sceneWriter.js` L300-303 |
| `adult` | unclamped | unclamped | unclamped | `sceneWriter.js` L306-311 |

**This is a safety-critical interaction**: Even if a user sets spice_level=4 and reading_level='children', the effective spice is clamped to 0.

## Content Lane × Safety

| Content Lane | Rights Mode | Safety Implication |
|---|---|---|
| fiction | original_ip | Standard safety |
| nonfiction | original_ip | Reference integrity active |
| erotica | original_ip | Spice guardrails honored, not suppressed |
| fanfiction | fanfiction_noncommercial | Commercial export blocked, adult content per settings |

## Setup Field Protection

The `SETUP_PROTECTED_FIELDS` array in `modelRouting.js` (45 fields) prevents any LLM response from overwriting user's setup choices. This is a critical safety mechanism:

```
title, tagline, book_type, project_type, genre, subgenre, target_audience,
content_lane, project_format, rights_mode, commercial_use_allowed,
genre_group, market_category, fandom_name, source_universe, canon_mode,
fanfic_posting_target, canon_characters, canon_boundary, pov_mode, tense,
protagonist_pronouns, beat_style, scene_beat_style, nf_structure_mode,
author_name, author_voice, author_voice_notes, author_style_id,
series_bible_id, series_name, series_number, language_intensity,
spice_level, erotica_register, reading_level, chapter_target,
chapter_length_preset, chapter_length_target, target_chapter_words,
total_word_target, seed_concept, num_twists, twist_intensity, twist_count,
story_arc, anthology_theme, anthology_theme_type, anthology_story_length,
anthology_variety, default_prose_model
```

## Verdict

**All safety gates correctly interact with Setup fields.** Reading-level clamping provides a reliable safety floor. Protected fields prevent LLM override. Profile routing ensures genre-appropriate safety thresholds.
