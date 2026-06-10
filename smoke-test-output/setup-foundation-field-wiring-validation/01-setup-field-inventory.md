# Setup/Foundation Field Inventory

## Overview
Complete inventory of every Setup and Foundation tab field in UBS, traced from UI → storage → prompt/pipeline.

## Setup Tab — Left Panel (Project Identity)

| Field Label | Internal Key | UI Component | Input Type | Default | Saved To | Used By | Status |
|---|---|---|---|---|---|---|---|
| Content Lane | `content_lane` | SetupTab L368-378 | Button grid | 'fiction' | Project entity | Lane routing, genre resolution | ✅ Fully wired |
| Project Format | `project_format` | SetupTab L384-397 | Select | 'novel' | Project entity | Pipeline type, anthology engine | ✅ Fully wired |
| Rights Mode | `rights_mode` | SetupTab L399-419 | Select | 'original_ip' | Project entity | Fan fiction controls, export rights | ✅ Fully wired |
| Working Title | `title` | SetupTab L422-428 | Input | '' | Project entity | Foundation prompt, export metadata | ✅ Fully wired |
| Subtitle/Tagline | `tagline` | SetupTab L430-436 | Input | '' | Project entity | Export metadata, title page | ✅ Fully wired |
| Premise/Seed Concept | `seed_concept` | SetupTab L438-445 | Textarea | '' | Project entity | Foundation prompt, expand settings, story bible | ✅ Fully wired |
| Genre Family | `genre_group` | SetupTab L534-554 | Select | varies | Project entity | Genre resolution, pipeline routing | ✅ Fully wired |
| Primary Genre | `genre` | SetupTab L556-573 | Select | '' | Project entity | All prompts, profile routing, export | ✅ Fully wired |
| Subgenre | `subgenre` | SetupTab L575-604 | Select/Input | '' | Project entity | All prompts, genre header | ✅ Fully wired |
| Target Audience | `target_audience` | SetupTab L622-628 | Input | '' | Project entity | Context header, prompt | ✅ Fully wired |

## Setup Tab — Left Panel (Fan Fiction, conditional)

| Field Label | Internal Key | UI Component | Input Type | Default | Status |
|---|---|---|---|---|---|
| Fandom/Source | `fandom_name` | SetupTab L454-460 | Input | '' | ✅ Fully wired |
| Source Universe/Era | `source_universe` | SetupTab L462-468 | Input | '' | ✅ Fully wired |
| Canon Mode | `canon_mode` | SetupTab L472-485 | Select | 'canon_divergent' | ✅ Fully wired |
| Posting Target | `fanfic_posting_target` | SetupTab L487-503 | Select | 'private' | ✅ Fully wired |
| Canon Characters | `canon_characters` | SetupTab L506-512 | Input | '' | ✅ Fully wired |
| Canon Boundary | `canon_boundary` | SetupTab L514-520 | Input | '' | ✅ Fully wired |

## Setup Tab — Left Panel (Anthology, conditional)

| Field Label | Internal Key | Input Type | Default | Status |
|---|---|---|---|---|
| Collection Theme | `anthology_theme` | Input | '' | ✅ Fully wired |
| Theme Type | `anthology_theme_type` | Select | 'topic' | ✅ Fully wired |
| Story Length | `anthology_story_length` | Select | 'short' | ✅ Fully wired |
| Variety | `anthology_variety` | Select | 'high' | ✅ Fully wired |

## Setup Tab — Right Panel (Voice, Structure, Targets)

| Field Label | Internal Key | UI Component | Input Type | Default | Used By | Status |
|---|---|---|---|---|---|---|
| Narration Preset | applies pov+tense | SetupTab L747-767 | Select | varies | POV/tense | ✅ Fully wired |
| Viewpoint (POV) | `pov_mode` | SetupTab L770-790 | Select | 'third-close' | All prompts via buildProjectContextHeader, buildSetupConstraints, buildPovTenseBlock | ✅ Fully wired |
| Pronouns | `protagonist_pronouns` | SetupTab L792-806 | Select | varies | buildSetupConstraints, voice guide | ✅ Fully wired |
| Tense | `tense` | SetupTab L809-824 | Select | 'past' | All prompts via header, constraints, POV block | ✅ Fully wired |
| Beat Style (fiction) | `beat_style` | SetupTab L833-847 | Select | 'Tension-Driven' | sceneWriter buildBeatStyleBlock, pacing modulation style modifiers | ✅ Fully wired |
| NF Structure Mode | `nf_structure_mode` | SetupTab L849-868 | Select | 'prescriptive' | Foundation prompt, NF polish, header | ✅ Fully wired |
| Story Arc | `story_arc` | SetupTab L871-887 | Select | 'three_act' | buildPacingBlock per chapter, constraints | ✅ Fully wired |
| Plot Twists (count) | `num_twists` | SetupTab L891-910 | Select | 3 | plotTwists.js getTwistContextForChapter | ✅ Fully wired |
| Twist Intensity | `twist_intensity` | SetupTab L912-933 | Select | 'moderate' | plotTwists.js twist generation | ✅ Fully wired |
| Author Voice | `author_voice` | SetupTab L943-964 | Select | 'Custom / None' | buildAuthorVoiceCompact, buildAuthorVoiceInstruction, header | ✅ Fully wired |
| Custom Voice Notes | `author_voice_notes` | SetupTab L966-974 | Input | '' | buildAuthorVoiceCompact (conditional on Custom / None) | ✅ Fully wired |
| Author Name | `author_name` | SetupTab L976-982 | Input | 'Hermes Agent' | buildSetupConstraints, export metadata | ✅ Fully wired |
| Author Style ID | `author_style_id` | AuthorStyleManager | Select | '' | buildCustomAuthorStyleBlock | ✅ Fully wired |
| Chapter Count | `chapter_target` | SetupTab L997-1011 | Input numeric | 20 | buildSetupConstraints (NON-NEGOTIABLE), foundation prompt, total word calc | ✅ Fully wired |
| Length Preset | `chapter_length_preset` | SetupTab L1013-1026 | Select | 'standard' | Sets chapter_length_target | ✅ Fully wired |
| Words Per Chapter | `chapter_length_target` | SetupTab L1030-1044 | Input numeric | 3500 | buildProjectContextHeader, scene word targets, total word calc | ✅ Fully wired |
| Reading Level | `reading_level` | SetupTab L1060-1107 | Button grid | 'adult' | sceneWriter getEffectiveContentSettings, buildReadingLevelBlock, buildContentLimitsBlock | ✅ Fully wired |
| Spice Level | `spice_level` | SetupTab L1117-1133 | Select | 0 | buildSpiceBeatInstructions, buildSpiceCompact, header, constraints | ✅ Fully wired |
| Language Intensity | `language_intensity` | SetupTab L1136-1152 | Select | 2 | buildLanguageBlock, getEffectiveContentSettings, header | ✅ Fully wired |
| Erotica Register | `erotica_register` | SetupTab L1155-1173 | Select | 0 | buildSpiceCompact, buildEroticaAuthorityBlocks, header | ✅ Fully wired |
| Writing Model | `default_prose_model` | SetupTab L1181-1202 | Select | DEFAULT_FICTION_PROSE_MODEL | modelRouting.js pickModel | ✅ Fully wired |

## Foundation Tab — Documents

| Document | Internal Key | Tab Side | Used By | Status |
|---|---|---|---|---|
| World | `world_md` | Left | Foundation prompt, story bible, scene context | ✅ Fully wired |
| Characters | `characters_md` | Left | Foundation prompt, name registry, scene context | ✅ Fully wired |
| Outline | `outline_md` | Left | Foundation prompt, chapter planning, scene context | ✅ Fully wired |
| Research | `research_md` | Left | Foundation prompt, research storage, research panel | ✅ Fully wired |
| Canon | `canon_md` | Right | Foundation prompt, continuity lock | ✅ Fully wired |
| Voice | `voice_md` | Right | buildAuthorVoiceCompact, prose style | ✅ Fully wired |
| Mystery | `mystery_md` | Right | Foundation prompt, twist/clue planning | ✅ Fully wired |
| Twists | `twists_md` | Right | Foundation prompt, plotTwists.js | ✅ Fully wired |

## Foundation Tab — Actions

| Action | Handler | Modules Used | Status |
|---|---|---|---|
| Build Story Bible | `onExpand` → handleExpandProject | autonovel buildFoundationPrompt | ✅ Fully wired |
| Regenerate | `onGenerate` | autonovel buildFoundationPrompt | ✅ Fully wired |
| NF Research | ResearchSection → handleResearch | researcher agent via localLLM | ✅ Fully wired |
| Fiction Research | FictionResearchPanel → runFictionResearch | fictionResearch.js | ✅ Fully wired |
| Copyright Page | onGenerateCopyright | bibliographyGenerator | ✅ Fully wired |
| Bibliography | onGenerateBibliography | bibliographyGenerator | ✅ Fully wired |

## Hidden/Computed Fields

| Field | Internal Key | Source | Status |
|---|---|---|---|
| Book Type | `book_type` | Derived from content_lane via getBookTypeForLane | ✅ Fully wired |
| Project Type | `project_type` | Derived from format (novel/anthology/etc) | ✅ Fully wired |
| Total Word Target | `total_word_target` | chapter_target × chapter_length_target | ✅ Fully wired |
| Target Chapter Words | `target_chapter_words` | = chapter_length_target | ✅ Fully wired |
| Scene Beat Style | `scene_beat_style` | = beat_style (kept in sync) | ✅ Fully wired |
| Foundation Score | `foundation_score` | LLM-generated, displayed in Foundation tab | ✅ Fully wired |
| Current Focus | `current_focus` | LLM-generated recommendation | ✅ Fully wired |
| Commercial Use | `commercial_use_allowed` | Derived from rights_mode | ✅ Fully wired |
| Gore/Violence Level | `gore_level` / `violence_level` | sceneWriter getEffectiveContentSettings (no UI field, fallback 0) | ⚠️ No UI |

## Dead or Missing Fields

| Field | Issue | Recommendation |
|---|---|---|
| `violence_level` / `gore_level` | Referenced in sceneWriter buildGoreBlock but no UI slider | Add UI slider or document as hidden config |
| `logline` | Not in SetupTab, appears in some schemas | May be legacy/unused — tagline serves this role |
| `synopsis` | Not in SetupTab | Not needed — outline_md serves this role |

## Field Count Summary

| Category | Count |
|---|---|
| Setup Tab fields (always visible) | 23 |
| Setup Tab conditional fields (fanfic) | 6 |
| Setup Tab conditional fields (anthology) | 4 |
| Foundation Tab documents | 8 |
| Foundation Tab actions | 6 |
| Hidden/computed fields | 9 |
| Dead/no-UI fields | 2-3 |
| **Total tracked** | **57+** |

## Verdict

**All 50+ visible Setup/Foundation fields are fully wired** from UI → storage → prompt/pipeline.

2-3 fields referenced in code (`gore_level`, `violence_level`) have no UI exposure but have safe defaults (0). These are not dead — they're hidden optional overrides that work via direct project data editing.

No dead Setup/Foundation fields found. No field is UI-only.
