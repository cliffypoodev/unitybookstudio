# 05 — Floating Chatbot Routing Proof

> **Report Generated:** 2026-06-08T22:18 CDT
> **Scope:** `FloatingBrainstorm.jsx` mode detection, system prompt routing, and intent detection
> **Result:** All contexts route to correct mode with correct system prompt

---

## Mode Detection — `getActiveMode()`

The `getActiveMode()` function in `FloatingBrainstorm.jsx` reads the current URL path and maps it to one of three modes:

| URL Pattern | Detected Mode |
|---|---|
| `/ideas` | `story-architect` |
| `/foundation` | `story-architect` |
| `/setup` | `story-architect` |
| `/notebook` | `story-architect` |
| `/chapter` | `chapter-assistant` |
| `/editor` | `chapter-assistant` |
| `/studio` | `chapter-assistant` |
| All other paths | `brainstorm` |

---

## Context Routing Table

| Context | URL Pattern | Mode Detection | System Prompt | Mode Label | USE_IDEA Support | Status |
|---|---|---|---|---|---|---|
| Ideas tab | `/ideas` | `story-architect` | `STORY_ARCHITECT_PROMPT` | 🏗️ Story Architect | ✅ Yes | ✅ |
| Foundation tab | `/foundation` | `story-architect` | `STORY_ARCHITECT_PROMPT` | 🏗️ Story Architect | ✅ Yes | ✅ |
| Setup tab | `/setup` | `story-architect` | `STORY_ARCHITECT_PROMPT` | 🏗️ Story Architect | ✅ Yes | ✅ |
| Notebook | `/notebook` | `story-architect` | `STORY_ARCHITECT_PROMPT` | 🏗️ Story Architect | ✅ Yes | ✅ |
| Chapter editor | `/chapter` | `chapter-assistant` | `CHAPTER_ASSISTANT_PROMPT` | 📝 Chapter Assistant | ❌ No | ✅ |
| Editor | `/editor` | `chapter-assistant` | `CHAPTER_ASSISTANT_PROMPT` | 📝 Chapter Assistant | ❌ No | ✅ |
| Studio | `/studio` | `chapter-assistant` | `CHAPTER_ASSISTANT_PROMPT` | 📝 Chapter Assistant | ❌ No | ✅ |
| Other / Home | `/` | `brainstorm` | `BRAINSTORM_PROMPT` | 💡 Brainstorm | ❌ No | ✅ |

---

## System Prompts

### 🏗️ `STORY_ARCHITECT_PROMPT`

- **Role:** Full developmental editor
- **Capabilities:** Anti-plagiarism safeguards, story engine requirement, `[USE_IDEA]` blueprint support, genre expertise
- **Output:** Can produce `[USE_IDEA]` markers with structured JSON blueprints
- **Active on:** Ideas, Foundation, Setup, Notebook

### 📝 `CHAPTER_ASSISTANT_PROMPT`

- **Role:** Prose-level writing assistant
- **Capabilities:** In-chapter editing, prose refinement, scene-level feedback
- **Output:** Prose suggestions and editorial feedback (no blueprint output)
- **Active on:** Chapter editor, Editor, Studio

### 💡 `BRAINSTORM_PROMPT`

- **Role:** General creative brainstorm partner
- **Capabilities:** Open-ended ideation, exploratory discussion
- **Output:** Free-form creative responses (no blueprint output)
- **Active on:** Home page, any unmatched route

---

## Intent Detection

The `handleSend` function in `FloatingBrainstorm.jsx` scans user messages for intent keywords to flag specialized requests:

| User Message Contains | Detected Intent | Action |
|---|---|---|
| `research`, `look up`, `find info` | Research request | Flagged in response metadata |
| `polish`, `rewrite`, `tighten` | Polish request | Flagged in response metadata |
| Other | General | Normal response flow |

---

## Mode Label Display

The floating chatbot header displays the current mode label dynamically:

| Mode | Label Displayed |
|---|---|
| `story-architect` | 🏗️ Story Architect |
| `chapter-assistant` | 📝 Chapter Assistant |
| `brainstorm` | 💡 Brainstorm |

This provides the user with immediate visual feedback about which agent context is active.
