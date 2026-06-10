# 04 — Ideas Chatbot to Project Proof

> **Report Generated:** 2026-06-08T22:18 CDT
> **Scope:** End-to-end flow from Ideas chatbot conversation to project settings population
> **Result:** All blueprint fields mapped; flow verified at code-path level

---

## Flow Trace

```
Step 1: User types idea in IdeasChatbot
  │
Step 2: SYSTEM_PROMPT instructs LLM to act as Story Architect (developmental editor)
  │
Step 3: LLM asks development questions or produces blueprint
  │
Step 4: LLM outputs [USE_IDEA] marker with JSON blueprint (including violenceLevel)
  │
Step 5: ChatMessage component renders "Use This Idea" button
  │
Step 6: Button calls parent's onUseIdea(blueprintData)
  │
Step 7: handleChatbotUseIdea in ProjectStudio.jsx maps all fields
  │
Step 8: updateSettingsDrafts applies to Setup tab
  │
Step 9: User navigated to Setup tab to review/edit
  │
Step 10: User saves when ready
```

---

## Step-by-Step Detail

### Step 1 — User Input

User types a story idea into the Ideas Chatbot (e.g., *"A burned-out ER nurse discovers her hospital is harvesting organs from patients declared dead too early"*).

### Step 2 — System Prompt

`IdeasChatbot.jsx` sends a `SYSTEM_PROMPT` that instructs the LLM to act as a **Story Architect** — a developmental editor who:
- Asks probing questions to develop the idea
- Identifies genre, tone, and structural possibilities
- Builds toward a complete project blueprint
- Includes anti-plagiarism safeguards

### Step 3 — Development Questions

The LLM engages in multi-turn conversation, asking about:
- Target audience and reading level
- Desired tone and voice
- POV and tense preferences
- Violence and spice tolerance
- Structural preferences (beat style, pacing)

### Step 4 — Blueprint Output

When the idea is sufficiently developed, the LLM outputs a `[USE_IDEA]` marker containing a structured JSON blueprint:

```json
{
  "premise": "A burned-out ER nurse discovers her hospital is harvesting organs...",
  "story_engine": "They must expose the conspiracy before the next patient dies or else they become the next target",
  "book_type": "fiction",
  "genre": "thriller",
  "subgenre": "medical-thriller",
  "targetAudience": "adult",
  "chapterCount": 20,
  "chapterLength": "standard",
  "authorVoice": "Custom / None",
  "tone": "dark, tense, clinical",
  "tense": "past",
  "pov": "third-close",
  "beatStyle": "Tension-Driven",
  "storyArcPacing": "three_act",
  "spiceLevel": 0,
  "languageLevel": 2,
  "violenceLevel": 3,
  "themes": ["corruption", "medical ethics", "whistleblowing"],
  "characters": ["Maya Chen (protagonist)", "Dr. Harlan (antagonist)"],
  "setting": "St. Mercy General Hospital, Chicago, present day",
  "researchNeeds": ["organ transplant procedures", "hospital administration"]
}
```

### Step 5 — Use This Idea Button

The `ChatMessage` component detects the `[USE_IDEA]` marker in the LLM response and renders a **"Use This Idea"** button below the message.

### Step 6 — Button Click

When the user clicks the button, it calls the parent component's `onUseIdea(blueprintData)` callback with the parsed JSON blueprint.

### Step 7 — Field Mapping

`handleChatbotUseIdea` in `ProjectStudio.jsx` (L5169) maps all blueprint fields to project settings fields.

### Step 8 — Draft Application

`updateSettingsDrafts` applies the mapped values to the Setup tab draft state.

### Step 9 — Navigation

User is automatically navigated to the **Setup tab** to review and edit the populated settings.

### Step 10 — User Confirmation

The user reviews all fields, makes any desired adjustments, and saves when ready. No project changes are committed without explicit user action.

---

## Blueprint Field Mapping Table

| Blueprint Field | Project Settings Field | Example Value | Status |
|---|---|---|---|
| `premise` | `seed_concept` (with `story_engine` appended) | "A burned-out ER nurse discovers..." + story engine | ✅ |
| `story_engine` | Appended to `seed_concept` | "They must [X] before [Y] or else [Z]" | ✅ |
| `book_type` | `book_type` | `"fiction"` | ✅ |
| `genre` | `genre` | `"thriller"` | ✅ |
| `subgenre` | `subgenre` | `"medical-thriller"` | ✅ |
| `targetAudience` | `target_audience` | `"adult"` | ✅ |
| `pov` | `pov_mode` | `"third-close"` | ✅ |
| `tense` | `tense` | `"past"` | ✅ |
| `beatStyle` | `beat_style` + `scene_beat_style` | `"Tension-Driven"` | ✅ |
| `storyArcPacing` | `story_arc` | `"three_act"` | ✅ |
| `authorVoice` | `author_voice` | `"Custom / None"` | ✅ |
| `chapterCount` | `chapter_target` | `20` | ✅ |
| `chapterLength` | `chapter_length` | `"standard"` | ✅ |
| `tone` | `tone` | `"dark, tense, clinical"` | ✅ |
| `spiceLevel` | `spice_level` | `0` | ✅ |
| `languageLevel` | `language_intensity` | `2` | ✅ |
| `violenceLevel` | `violence_level` | `3` | ✅ |
| `themes` | `themes` | `["corruption", "medical ethics"]` | ✅ |
| `characters` | `characters` | `["Maya Chen", "Dr. Harlan"]` | ✅ |
| `setting` | `setting` | `"St. Mercy General Hospital..."` | ✅ |
| `researchNeeds` | `research_needs` | `["organ transplant procedures"]` | ✅ |

---

## Live Testing Note

> [!NOTE]
> The live `[USE_IDEA]` flow requires browser interaction (typing in the chatbot, receiving LLM responses, clicking the "Use This Idea" button). This report verifies the code-path wiring at the source level. For live validation, run the app in a browser and complete the full chatbot → blueprint → project flow.
