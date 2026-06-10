# Foundation Tab Effectiveness

## Overview
The Foundation tab manages "Story Bible" documents and research integration. This report validates that Foundation tab content reaches the generation pipeline.

## Foundation Documents → Prompt Injection

### 1. `world_md` (World / Setting)
- **Saved as**: `project.world_md` (string, markdown)
- **Injected into**: Foundation prompt as `world_md` field in schema
- **Scene generation**: `compact(project.world_md)` injected into scene context
- **Evidence**: `sceneWriter.js` — world_md appears in project context blocks
- **Status**: ✅ **Fully wired**

### 2. `characters_md` (Characters)
- **Saved as**: `project.characters_md` (string, markdown)
- **Injected into**: Foundation prompt as `characters_md` field
- **Scene generation**: `compact(project.characters_md)` + `extractProtagonistName(project)` for name extraction
- **Canon name lock**: `buildCanonNameLockBlock()` uses characters_md for name registry
- **Evidence**: `sceneWriter.js` L174-185 extracts protagonist name from characters_md
- **Status**: ✅ **Fully wired**

### 3. `outline_md` (Outline)
- **Saved as**: `project.outline_md` (string, markdown)
- **Injected into**: Foundation prompt as `outline_md` field
- **Scene generation**: Used for chapter planning and scene beat context
- **Evidence**: Foundation schema requires outline_md
- **Status**: ✅ **Fully wired**

### 4. `canon_md` (Canon)
- **Saved as**: `project.canon_md` (string, markdown)
- **Injected into**: Foundation prompt as `canon_md` field
- **Scene generation**: `buildProjectContinuityLockBlock()` enforces canon consistency
- **Evidence**: `projectContentGuard.js` reads canon_md for enforcement
- **Status**: ✅ **Fully wired**

### 5. `voice_md` (Voice Guide)
- **Saved as**: `project.voice_md` (string, markdown)
- **Injected into**: Foundation prompt as `voice_md` field
- **Scene generation**: `buildAuthorVoiceCompact()` includes `compact(project.voice_md, 1800)`
- **Critical rule**: Voice guide MUST respect project tense/POV (enforced in foundation prompt)
- **Evidence**: `sceneWriter.js` L280-282
- **Status**: ✅ **Fully wired**

### 6. `mystery_md` (Mystery / Central Question)
- **Saved as**: `project.mystery_md` (string, markdown)
- **Injected into**: Foundation prompt as `mystery_md` field
- **Scene generation**: `compact(project.mystery_md)` in scene context
- **Status**: ✅ **Fully wired**

### 7. `twists` (Plot Twists Array)
- **Saved as**: `project.twists` (array of twist objects)
- **Injected into**: `getTwistContextForChapter()` — per-chapter twist context
- **Scene generation**: Chapter-specific foreshadowing, clue placement, reveal timing
- **Evidence**: `plotTwists.js` — reads twists array, cross-references chapter_placement
- **Status**: ✅ **Fully wired**

### 8. `research_data` / `research_md` (Research)
- **Saved as**: `project.research_data` (string or object)
- **Injected into**: Foundation prompt as research block (NF only)
- **Scene generation**: `resolveResearchContent()` + `getRelevantResearch()` inject into scene prompts
- **NF-specific**: Research section uses deep research agent; fiction uses plausibility agent
- **Evidence**: `autonovel.js` L1018-1020, `fictionResearch.js`, `researchStorage.js`
- **Status**: ✅ **Fully wired**

## Foundation Tab Actions

### Build Story Bible (`handleExpandProject`)
1. Reads ALL setup fields from project
2. Calls `buildExpandSettingsPrompt()` → architect agent → settings JSON
3. Calls `buildExpandFoundationPrompt()` → architect agent → story bible
4. Writes results back to project (world_md, characters_md, outline_md, etc.)
5. **All Setup fields are injected into the prompts** via `buildProjectContextHeader`, `buildSetupConstraints`, `buildPovTenseBlock`
- **Status**: ✅ **Fully wired**

### Regenerate Foundation
1. Calls `buildFoundationPrompt()` with current project
2. Preserves locked setup fields via `enforceChapterCount()`
3. Overwrites foundation documents with LLM output
- **Status**: ✅ **Fully wired**

### Fiction Research (`FictionResearchPanel`)
1. Uses `researcher` agent via `fictionResearch.js`
2. Takes genre into account for plausibility checks
3. Results stored in project's research_data
4. Injected into scene prompts via `getRelevantResearch()`
- **Status**: ✅ **Fully wired**

### Nonfiction Research (`ResearchSection`)
1. Uses `researcher` agent via `localLLM.js callAgent('research')`
2. Deep research mode for sourced, cited content
3. Results stored in research_data
4. Injected into foundation + scene prompts
- **Status**: ✅ **Fully wired**

### Bibliography Generation
1. Uses `bibliographyGenerator.js`
2. Generates bibliography chapter from research_data
3. Added as back-matter chapter
- **Status**: ✅ **Fully wired**

### Copyright Page Generation
1. Uses `bibliographyGenerator.js`
2. Generates copyright page from project metadata (title, author, year)
3. Added as front-matter
- **Status**: ✅ **Fully wired**

## Foundation Score System

| Metric | Source | Display | Status |
|---|---|---|---|
| `foundation_score` | LLM self-assessment (7.0-9.5) | Foundation tab badge | ✅ |
| `lore_score` | LLM self-assessment | Foundation tab badge | ✅ |
| `current_focus` | LLM recommendation | Foundation tab text | ✅ |

## Foundation Document Quality Controls

| Control | Mechanism | Status |
|---|---|---|
| Minimum character depth | Foundation prompt requires 600+ words for characters_md | ✅ |
| Minimum world building | Foundation prompt requires 400+ words for world_md | ✅ |
| Banned character names | 20 AI-default names banned in foundation prompt | ✅ |
| Chapter count enforcement | `enforceChapterCount()` prevents LLM from changing user's count | ✅ |
| Voice tense lock | Voice guide forced to respect project tense, not reference author's | ✅ |
| Spice outline integration | Spice ≥3 forces explicit beat planning in outline | ✅ |

## Verdict

**All 8 Foundation documents are fully wired** from storage through prompt injection to scene generation. All 6 Foundation actions are production-wired. Foundation quality controls enforce minimum document depth and prevent common LLM failure modes.
