# 01 — Current UI & Agent Audit

## Date: 2026-06-09
## Status: COMPLETE

---

## Violence Level — Pre-Implementation State

| Component | Pre-Implementation | Notes |
|---|---|---|
| `VIOLENCE_LEVELS` constant | ❌ Did not exist | Only `SPICE_LEVELS` (0–4) and `LANGUAGE_INTENSITY` (0–4) existed |
| `GENRE_DEFAULTS` | ❌ No violence field | Each genre had `pov`, `tense`, `beat`, `chapters`, `words`, and optionally `spice`, `register` |
| `createInitialProjectSettings` | ❌ No violence_level | Defaults included `spice_level: 0`, `language_intensity: 2`, but no violence |
| `applyGenreDefaults` | ❌ No violence mapping | Only mapped `spice_level` and `erotica_register` from defaults |
| `buildProjectContextHeader` | ❌ No violence in header | Context header included GENRE, POV, TENSE, LANG, SPICE but not VIOLENCE |
| `buildSetupConstraints` | ❌ No violence constraint | Spice constraint existed but no violence |
| `sceneWriter.js` | ⚠️ Partial — `gore_level \|\| violence_level` reference existed | Line 293 already read `project.gore_level \|\| project.violence_level` but the field was never formally set by the UI |
| `SetupTab.jsx` | ❌ No Violence dropdown | Had Spice Level and Language Intensity dropdowns only |
| `SETUP_PROTECTED_FIELDS` | ❌ Missing violence_level | Protected `spice_level`, `language_intensity`, `erotica_register` |

## Chatbot — Pre-Implementation State

| Component | Pre-Implementation | Notes |
|---|---|---|
| `IdeasChatbot.jsx` | ✅ Sophisticated Story Architect | 100-line `SYSTEM_PROMPT` with anti-plagiarism, story engine, comp titles, genre awareness |
| `IdeasChatbot [USE_IDEA]` schema | ⚠️ Minimal | Only `premise`, `story_engine`, `book_type`, `genre` — missing 15+ fields |
| `FloatingBrainstorm.jsx` | ❌ Generic brainstorm only | No mode detection, no Story Architect prompt, no `[USE_IDEA]` support |
| `handleChatbotUseIdea` | ⚠️ Minimal mapping | Only mapped `seed_concept`, `book_type`, `genre` — ignored POV, tense, violence, spice, language, chapters |
| `CreateProjectFromIdeaDialog` | ❌ Did not exist | No confirmation dialog before project creation from idea |

## Safety Gates

| Gate | Violence Reference | Notes |
|---|---|---|
| `manuscriptSafetyGate.js` | ❌ None | Checks process leaks, contamination, malformed grammar — not content levels |
| `exportSafetyGate.js` | ❌ None | Checks dialogue issues, slop density — not content levels |
| Content level enforcement | ✅ At prompt level | `getEffectiveContentSettings` in `sceneWriter.js` caps violence for YA/children |
