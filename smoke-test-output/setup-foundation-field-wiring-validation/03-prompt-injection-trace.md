# Prompt Injection Trace

## Overview
Traces how each Setup/Foundation field flows into LLM prompts across all generation paths.

## Generation Path: Foundation / Story Bible

| Field | Included? | Prompt Location | Function | Status |
|---|---|---|---|---|
| seed_concept | ✅ | Main body | buildFoundationPrompt, buildExpandFoundationPrompt | ✅ |
| genre + subgenre | ✅ | GENRE line + constraints | buildProjectContextHeader, buildSetupConstraints | ✅ |
| pov_mode | ✅ | POV line + constraints + buildPovTenseBlock | header, constraints, POV block | ✅ |
| tense | ✅ | TENSE line + constraints + buildPovTenseBlock | header, constraints, POV block | ✅ |
| beat_style | ✅ | BEAT line | header | ✅ |
| chapter_target | ✅ | "EXACTLY N chapters" (NON-NEGOTIABLE) | constraints + prompt body | ✅ |
| chapter_length_target | ✅ | "~N words/chapter" | header + prompt body | ✅ |
| author_voice | ✅ | VOICE line + buildAuthorVoiceInstruction | header, voice instruction | ✅ |
| spice_level | ✅ | SPICE line (when >0) + buildSpiceBeatInstructions | header, spice beat block | ✅ |
| language_intensity | ✅ | LANG line | header | ✅ |
| nf_structure_mode | ✅ | STRUCTURE line (NF only) | header, foundation prompt | ✅ |
| target_audience | ✅ | AUDIENCE line | header | ✅ |
| story_arc | ✅ | Constraints block | buildSetupConstraints | ✅ |
| num_twists | ✅ | Twist foundation block | buildTwistFoundationBlock | ✅ |
| protagonist_pronouns | ✅ | Constraints block | buildSetupConstraints | ✅ |
| research_data | ✅ | Research block (NF) | foundation prompt | ✅ |

## Generation Path: Scene/Chapter Drafting (sceneWriter.js)

| Field | Included? | Prompt Location | Function | Status |
|---|---|---|---|---|
| All from header | ✅ | System prompt header | buildProjectContextHeader | ✅ |
| author_voice | ✅ | VOICE block | buildAuthorVoiceCompact | ✅ |
| beat_style | ✅ | Beat style block | buildBeatStyleBlock | ✅ |
| spice_level | ✅ | Spice block | buildSpiceCompact | ✅ |
| language_intensity | ✅ | Language block | buildLanguageBlock | ✅ |
| gore_level | ✅ | Gore block | buildGoreBlock | ✅ |
| reading_level | ✅ | Reading level block + content limits | buildReadingLevelBlock, buildContentLimitsBlock | ✅ |
| story_arc + beat_style | ✅ | Pacing modulation | buildPacingBlock | ✅ |
| genre | ✅ | Genre block | buildGenreBlock | ✅ |
| pov_mode + tense | ✅ | POV/tense block | buildPovTenseBlock | ✅ |
| world_md | ✅ | Context | compact(project.world_md) | ✅ |
| characters_md | ✅ | Context | compact(project.characters_md) | ✅ |
| outline_md | ✅ | Context | compact(project.outline_md) | ✅ |
| voice_md | ✅ | Voice guide | buildAuthorVoiceCompact | ✅ |
| canon_md | ✅ | Canon lock | buildProjectContinuityLockBlock | ✅ |
| mystery_md | ✅ | Mystery context | compact(project.mystery_md) | ✅ |
| erotica_register | ✅ | Spice block | buildSpiceCompact | ✅ |
| content_lane | ✅ | Fanfic erotica bridge | buildFanfictionEroticaBridgeBlock | ✅ |
| fandom_name | ✅ | Fanfic bridge (conditional) | buildFanfictionEroticaBridgeBlock | ✅ |
| chapter_length_target | ✅ | Word target | getReadingLevelChapterTarget | ✅ |
| twists | ✅ | Twist context | getTwistContextForChapter | ✅ |

## Generation Path: Polish (Fiction)

| Field | Included? | Status |
|---|---|---|
| genre | ✅ Profile routing via resolvePolishProfile | ✅ |
| book_type | ✅ Profile routing | ✅ |
| project_type | ✅ Profile routing | ✅ |

## Generation Path: Polish (Nonfiction)

| Field | Included? | Status |
|---|---|---|
| book_type | ✅ NF polish path routing | ✅ |
| nf_structure_mode | ✅ Structure preservation | ✅ |

## Generation Path: Export

| Field | Included? | Status |
|---|---|---|
| title | ✅ DOCX title page | ✅ |
| tagline | ✅ DOCX subtitle | ✅ |
| author_name | ✅ DOCX author | ✅ |
| genre | ✅ Profile routing for safety gate | ✅ |
| book_type | ✅ NF reference check routing | ✅ |

## Verdict

**Every generation-relevant setup field reaches at least one prompt or pipeline input.** No field is saved-but-not-used.
