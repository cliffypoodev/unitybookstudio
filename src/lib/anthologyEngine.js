/**
 * Anthology Engine — Handles story bible generation and prose prompt building
 * for anthology (short story collection) projects.
 *
 * An anthology is a collection of standalone short stories unified by a theme.
 * Each chapter IS a complete story with its own characters, setting, and resolution.
 */

export const ANTHOLOGY_STORY_LENGTHS = {
  flash: { words: 1000, label: 'Flash Fiction (500–1,500 words)', nfLabel: 'Brief (500–1,500 words) — short essay, vignette, or snapshot', parts: 1, instruction: 'Write the COMPLETE story in ONE section. One scene, one moment, one emotional punch. Every sentence must earn its place.', nfInstruction: 'Write the COMPLETE essay in ONE section. One focused argument, one key insight, punchy and direct.' },
  short: { words: 3500, label: 'Short Story (2,000–5,000 words)', nfLabel: 'Essay (2,000–5,000 words) — standard essay or investigation', parts: 2, instruction: 'Write the COMPLETE story in TWO sections. Section 1: setup and complication. Section 2: climax and resolution.', nfInstruction: 'Write the COMPLETE essay in TWO sections. Section 1: hook, context, and setup. Section 2: analysis, evidence, and conclusion.' },
  standard: { words: 6500, label: 'Standard (5,000–8,000 words)', nfLabel: 'Feature (5,000–8,000 words) — deep-dive feature or long-form essay', parts: 3, instruction: 'Write the COMPLETE story in THREE sections. Build the character, escalate the conflict, resolve or devastate.', nfInstruction: 'Write the COMPLETE essay in THREE sections. Build the context, present the evidence, deliver the insight.' },
  novelette: { words: 12000, label: 'Novelette (8,000–15,000 words)', nfLabel: 'Long-Form (8,000–15,000 words) — comprehensive investigation or profile', parts: 4, instruction: 'Write the COMPLETE story in FOUR sections. Full character development, subplot, thematic depth, earned resolution.', nfInstruction: 'Write the COMPLETE essay in FOUR sections. Comprehensive investigation with full context, multiple evidence threads, and deep analysis.' },
};

export const ANTHOLOGY_THEME_TYPES_FICTION = [
  { value: 'topic', label: 'Topic — all stories explore the same subject' },
  { value: 'setting', label: 'Setting — all stories share a location or world' },
  { value: 'constraint', label: 'Constraint — all stories follow a rule' },
  { value: 'mood', label: 'Mood — all stories share an emotional register' },
  { value: 'question', label: 'Question — all stories answer the same question differently' },
  { value: 'connected', label: 'Connected Universe — stories share a world, characters may overlap' },
];

export const ANTHOLOGY_THEME_TYPES_NONFICTION = [
  { value: 'topic', label: 'Topic — each essay explores a different facet of the same subject' },
  { value: 'case_studies', label: 'Case Studies — each chapter is a real-world case examining the theme' },
  { value: 'profiles', label: 'Profiles — each chapter profiles a different person, place, or organization' },
  { value: 'chronological', label: 'Chronological — each chapter covers a different era or period' },
  { value: 'argument', label: 'Argument — each chapter builds a different argument or perspective' },
  { value: 'how_to', label: 'How-To — each chapter teaches a different skill or technique' },
];

export function getAnthologyThemeTypes(genre) {
  return isNonfictionGenre(genre) ? ANTHOLOGY_THEME_TYPES_NONFICTION : ANTHOLOGY_THEME_TYPES_FICTION;
}

// Backward compat alias
export const ANTHOLOGY_THEME_TYPES = ANTHOLOGY_THEME_TYPES_FICTION;

export const ANTHOLOGY_VARIETY_OPTIONS = [
  { value: 'consistent', label: 'Consistent — same tone, POV style, and intensity' },
  { value: 'moderate', label: 'Moderate — same genre but varied POVs, tones, and structures' },
  { value: 'high', label: 'High — each story experiments with a different style' },
];

export const anthologyBibleSchema = {
  type: 'object',
  properties: {
    master_theme: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        subtitle: { type: 'string' },
        theme_statement: { type: 'string' },
        tonal_boundaries: { type: 'string' },
        connecting_thread: { type: 'string' },
        collection_arc: { type: 'string' },
        reader_experience: { type: 'string' },
      },
      required: ['title', 'theme_statement', 'connecting_thread', 'collection_arc'],
    },
    stories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          story_number: { type: 'number' },
          title: { type: 'string' },
          premise: { type: 'string' },
          protagonist: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'string' },
              occupation_or_role: { type: 'string' },
              wound: { type: 'string' },
              want: { type: 'string' },
              defining_trait: { type: 'string' },
            },
          },
          setting: {
            type: 'object',
            properties: {
              location: { type: 'string' },
              time_period: { type: 'string' },
              sensory_anchor: { type: 'string' },
            },
          },
          conflict: { type: 'string' },
          twist_or_turn: { type: 'string' },
          ending_type: { type: 'string' },
          thematic_angle: { type: 'string' },
          pov: { type: 'string' },
          tense: { type: 'string' },
          tone: { type: 'string' },
          estimated_words: { type: 'number' },
        },
        required: ['story_number', 'title', 'premise', 'conflict', 'thematic_angle'],
      },
    },
    voice_guide: {
      type: 'object',
      properties: {
        baseline_tone: { type: 'string' },
        language_boundaries: { type: 'string' },
        prose_style_notes: { type: 'string' },
        dialogue_approach: { type: 'string' },
        description_density: { type: 'string' },
        do_list: { type: 'string' },
        avoid_list: { type: 'string' },
      },
      required: ['baseline_tone', 'prose_style_notes', 'do_list', 'avoid_list'],
    },
    canon_rules: {
      type: 'object',
      properties: {
        thematic_boundaries: { type: 'string' },
        tonal_range: { type: 'string' },
        content_guidelines: { type: 'string' },
        shared_world_rules: { type: 'string' },
        consistency_anchors: { type: 'string' },
      },
      required: ['thematic_boundaries', 'tonal_range', 'content_guidelines'],
    },
    story_twists: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          story_number: { type: 'number' },
          story_title: { type: 'string' },
          twist_type: { type: 'string' },
          twist_description: { type: 'string' },
          setup_hint: { type: 'string' },
          emotional_impact: { type: 'string' },
        },
        required: ['story_number', 'twist_description'],
      },
    },
  },
  required: ['master_theme', 'stories', 'voice_guide', 'canon_rules'],
};

/**
 * Detect whether a genre string indicates nonfiction.
 */
export function isNonfictionGenre(genre) {
  if (!genre) return false;
  const g = genre.toLowerCase();
  return g.includes('nonfiction') || g.includes('non-fiction') || g.includes('self-help') ||
    g.includes('business') || g.includes('history') || g.includes('biography') ||
    g.includes('true crime') || g.includes('science') || g.includes('philosophy') ||
    g.includes('memoir') || g.includes('reference') || g.includes('educational') ||
    g.includes('investigative') || g.includes('health') || g.includes('politics') ||
    g.includes('education') || g.includes('travel') || g.includes('sports') ||
    g.includes('personal finance') || g.includes('caregiving');
}

/**
 * Detect whether an anthology project is nonfiction.
 */
export function isNonfictionAnthology(project) {
  if (!isAnthologyProject(project)) return false;
  return project.book_type === 'nonfiction' || isNonfictionGenre(project.genre);
}

/**
 * Build the anthology bible generation prompt.
 * Routes to fiction or nonfiction variant based on genre.
 */
export function buildAnthologyBiblePrompt(project) {
  if (isNonfictionAnthology(project)) {
    return buildNonfictionAnthologyBiblePrompt(project);
  }
  return buildFictionAnthologyBiblePrompt(project);
}

/**
 * Fiction anthology bible prompt (original).
 */
function buildFictionAnthologyBiblePrompt(project) {
  const numStories = project.chapter_target || 12;
  const theme = project.anthology_theme || project.seed_concept || 'unspecified';
  const themeType = project.anthology_theme_type || 'topic';
  const variety = project.anthology_variety || 'high';
  const genre = project.genre || 'Fiction';
  const storyLength = project.anthology_story_length || 'short';
  const lengthInfo = ANTHOLOGY_STORY_LENGTHS[storyLength] || ANTHOLOGY_STORY_LENGTHS.short;
  const spiceLevel = Number(project.spice_level || 0);
  const violenceLevel = Number(project.violence_level || 0);
  const languageIntensity = Number(project.language_intensity || 2);
  const numTwists = Number(project.num_twists ?? 3);
  const twistIntensity = project.twist_intensity || 'moderate';

  const varietyGuide = {
    consistent: 'All stories should share the same POV type, tense, tone, and narrative approach.',
    moderate: 'Stories share the genre and overall tone but can vary in POV, tense, and intensity.',
    high: 'Each story should feel like a different facet of the theme. Vary POV, tense, tone, structure, and even subgenre.',
  };

  const twistBlock = numTwists > 0 ? `
STORY TWISTS (PER-STORY — INDEPENDENT):
Generate a story_twists array with ${numTwists} twist(s) PER STORY (${numStories * numTwists} total entries). Each twist must:
- Belong to ONE specific story only. No twist references or depends on another story.
- Match the twist_intensity: "${twistIntensity}" (subtle = quiet recontextualization, moderate = satisfying reversal, dramatic = gut-punch, devastating = changes everything the reader assumed)
- Be SPECIFIC to that story's premise and conflict — not a collection-wide reveal
- Include a setup_hint: something planted early IN THAT STORY that makes the twist feel inevitable in retrospect
- Include the emotional_impact: what the reader feels when the twist lands
- twist_type should be one of: revelation, reversal, recontextualization, betrayal, sacrifice, irony, cosmic, or mirror
- No two stories should use the same twist_type
` : `
STORY TWISTS:
The user set num_twists to 0, so return an empty story_twists array: [].
`;

  return `You are designing an anthology — a collection of ${numStories} standalone short stories unified by a single theme. This is an ANTHOLOGY. Each chapter is an INDEPENDENT short story connected ONLY by the theme: "${theme}". Generate COMPLETELY SEPARATE characters, plots, and twists for each chapter. NO shared characters. NO continuing plotlines. NO references between stories.

COLLECTION DETAILS:
Genre: ${genre}
Theme: "${theme}"
Theme Type: ${themeType}
Story Length: ${storyLength} (${lengthInfo.instruction})
Variety Level: ${variety} — ${varietyGuide[variety] || varietyGuide.high}
Number of Stories: ${numStories}
Beat Style: ${project.beat_style || 'Auto-select per story'}
Language Intensity: ${languageIntensity} (1=clean, 2=moderate, 3=vivid, 4=raw)
Spice Level: ${spiceLevel} (0=none, 1=fade-to-black, 2=sensual, 3=explicit, 4=erotica)
Violence Level: ${violenceLevel} (0=none, 1=mild, 2=moderate, 3=graphic, 4=intense, 5=extreme)
Author Voice: ${project.author_voice || 'None specified'}
${project.author_voice_notes ? 'Voice Notes: ' + project.author_voice_notes : ''}

Respond ONLY in JSON. No markdown, no backticks.

═══ CRITICAL ANTHOLOGY ISOLATION RULES ═══
This is NOT a novel. Each chapter is a COMPLETE STANDALONE SHORT STORY.

1. CHARACTERS: Generate UNIQUE characters for EACH story. No character appears in more than one story${themeType === 'connected' ? ' (unless explicitly part of a framing device or Easter egg cameo)' : ''}. Each story has its own protagonist, its own supporting cast. Character names must be phonetically distinct ACROSS the entire collection.

2. PLOT: Each story has its own beginning, middle, and end. No cliffhangers connecting to other stories. No recurring plotlines across stories. No "to be continued." Each story must be fully self-contained.

3. TWISTS: Twists are generated PER STORY based on the twist settings (${numTwists} twists at ${twistIntensity} intensity per story). No twist references or depends on another story. Each story's twist must be setup and paid off within that single story.

4. SETTING: Each story should have its own setting${themeType === 'setting' ? ' (within the shared location/world constraint)' : ''}. No continuous timeline across stories.

5. THEME CONNECTION: The ONLY thread connecting stories is the anthology theme: "${theme}". Each story explores this theme from a UNIQUE angle. The thematic connection should be felt, not stated.
═══ END ISOLATION RULES ═══

STORY CONCEPT RULES:
1. NO TWO STORIES should have the same conflict type.
2. NO TWO PROTAGONISTS should be the same demographic. Vary age, gender, occupation, culture, and social class.
3. SETTINGS MUST VARY (unless theme_type is "setting"). Each story takes place in a DIFFERENT location with a DIFFERENT time context.
4. THE COLLECTION ARC MATTERS. The first story should be the most accessible. The last should be the most powerful.
5. AT LEAST ONE STORY should subvert the theme from an unexpected angle.
6. Each story's thematic_angle must be UNIQUE.
7. NAMES must be phonetically distinct from each other across the collection. No two protagonist names should start with the same letter.
8. Each story MUST have a complete story arc: a clear beginning (setup/inciting incident), middle (escalation/complication), and end (climax/resolution) — all within that single chapter.
9. The premise field must describe the STANDALONE story arc, not just a topic or theme exploration.
10. Each protagonist is a UNIQUE INDIVIDUAL who exists ONLY in their story. The protagonist in Story 1 does NOT appear in Story 2. No character crosses between stories.
${variety === 'high' ? '10. VARY EVERYTHING: POV, tense, tone, structure across stories.' : ''}
${themeType === 'connected' ? '10. CONNECTED UNIVERSE: Stories share a world. Minor characters in one story could appear in another. Easter eggs for attentive readers.' : ''}

VOICE GUIDE:
Generate a voice_guide object describing the BASELINE prose style for the entire collection. Even though individual stories may vary in POV and tense, the collection needs a unified authorial identity:
- baseline_tone: The overall emotional register of the collection (e.g., "darkly comic with undercurrents of grief")
- language_boundaries: What language level is appropriate given intensity ${languageIntensity}, spice ${spiceLevel}, and violence ${violenceLevel}. What words/content are allowed vs. off-limits.
- prose_style_notes: Sentence rhythm, vocabulary level, description density, preferred literary devices. 2-3 paragraphs.
- dialogue_approach: How dialogue works across stories — naturalistic? stylized? sparse?
- description_density: How much sensory detail vs. white space
- do_list: 5-8 specific stylistic rules all stories should follow
- avoid_list: 5-8 specific things all stories must avoid (AI cliches, overused words, tonal violations)

CANON RULES:
Generate a canon_rules object with the THEMATIC and SETTING constraints that apply across ALL stories (NOT plot rules — there is no shared plot):
- thematic_boundaries: What is and isn't within scope of the theme. Where the thematic exploration should NOT go.
- tonal_range: The acceptable range of tones (e.g., "from melancholy to darkly hopeful, but never nihilistic or saccharine")
- content_guidelines: Content rules matching spice level ${spiceLevel}, violence level ${violenceLevel}, and language intensity ${languageIntensity}. What is allowed, what requires care, what is off-limits.
${themeType === 'connected' ? '- shared_world_rules: The shared universe rules, physics, history, organizations that all stories must respect.' : '- shared_world_rules: "N/A — standalone stories. No shared characters. No shared plot."'}
- consistency_anchors: Thematic and tonal consistency rules ONLY. NOT plot continuity (there is no shared plot).
${twistBlock}
${spiceLevel >= 1 ? buildAnthologySpiceBibleRules(spiceLevel) : ''}
Return the master_theme object, stories array with exactly ${numStories} story concepts, voice_guide, canon_rules, and story_twists.

Return JSON only.`;
}

/**
 * Nonfiction anthology bible prompt.
 */
function buildNonfictionAnthologyBiblePrompt(project) {
  const numChapters = project.chapter_target || 12;
  const theme = project.anthology_theme || project.seed_concept || 'unspecified';
  const themeType = project.anthology_theme_type || 'topic';
  const variety = project.anthology_variety || 'moderate';
  const genre = project.genre || 'Nonfiction';
  const storyLength = project.anthology_story_length || 'short';
  const lengthInfo = ANTHOLOGY_STORY_LENGTHS[storyLength] || ANTHOLOGY_STORY_LENGTHS.short;
  const languageIntensity = Number(project.language_intensity || 2);

  const themeTypeGuide = {
    'topic': 'Each chapter explores a different angle of the central topic. Vary the approach: one chapter might be historical, another contemporary, another personal, another statistical.',
    'case_studies': 'Each chapter is a self-contained case study of a real event, person, or situation that illuminates the theme. Narrative-driven, evidence-based.',
    'profiles': 'Each chapter profiles a different person, organization, or place connected to the theme. Character-driven nonfiction — make the reader care about the subject.',
    'chronological': 'Each chapter covers a different time period, showing how the theme evolved over time. Can start ancient and end present, or reverse, or jump between eras for contrast.',
    'argument': 'Each chapter presents a different argument, perspective, or school of thought on the thesis. Can include opposing views for intellectual honesty.',
    'how_to': 'Each chapter teaches a different skill, technique, or approach related to the theme. Practical, actionable, with examples.',
  };

  const estWords = lengthInfo.words;

  return `You are designing a nonfiction anthology — a collection of ${numChapters} standalone essays or investigations unified by a single theme. Each chapter must work independently while contributing to a comprehensive exploration of the subject.

COLLECTION DETAILS:
Genre: ${genre}
Theme: "${theme}"
Theme Type: ${themeType} — ${themeTypeGuide[themeType] || themeTypeGuide.topic}
Chapter Length: ${storyLength} (${lengthInfo.nfInstruction || lengthInfo.instruction})
Variety Level: ${variety}
Number of Chapters: ${numChapters}
Language Intensity: ${languageIntensity}

Respond ONLY in JSON matching the schema. No markdown, no backticks.

Return this structure:
{
  "master_theme": {
    "title": "Collection title — compelling and marketable",
    "subtitle": "Subtitle that clarifies scope and angle",
    "theme_statement": "Central argument/question/thesis. 2-3 sentences.",
    "tonal_boundaries": "Emotional and intellectual register. Academic? Journalistic? Personal? Provocative?",
    "connecting_thread": "What ties the chapters together beyond the topic.",
    "collection_arc": "How chapters should be ordered for maximum impact. Build an argument? Alternate light/heavy? Broad to specific?",
    "reader_experience": "What the reader will understand, feel, or be able to do after finishing."
  },
  "stories": [
    {
      "story_number": 1,
      "title": "Chapter/essay title — should intrigue, not just describe",
      "premise": "2-3 sentence summary of what this chapter covers and why it matters",
      "protagonist": {
        "name": "The specific subject of this chapter (person, event, concept, place)",
        "age": "Time period or era",
        "occupation_or_role": "Type: event | person | concept | place | organization | trend | case_study | technique",
        "wound": "The central question this chapter answers",
        "want": "The specific perspective or angle — how it differs from every other chapter",
        "defining_trait": "The one key insight the reader takes away"
      },
      "setting": {
        "location": "Where this takes place, if applicable",
        "time_period": "When this takes place or era covered",
        "sensory_anchor": "The opening hook — a specific scene, question, or startling fact"
      },
      "conflict": "The tension, debate, or unresolved question driving this chapter",
      "twist_or_turn": "The surprising insight or counterintuitive finding",
      "ending_type": "How this chapter resolves — synthesis, open question, call to action",
      "thematic_angle": "How this chapter illuminates the collection's thesis from its unique angle",
      "pov": "editorial",
      "tense": "mixed",
      "tone": "The specific tone of this chapter",
      "estimated_words": ${estWords}
    }
  ],
  "voice_guide": {
    "baseline_tone": "Overall emotional and intellectual register of the collection",
    "language_boundaries": "What language level is appropriate given intensity ${languageIntensity}",
    "prose_style_notes": "Sentence rhythm, vocabulary level, description density. 2-3 paragraphs.",
    "dialogue_approach": "How quotes and dialogue reconstruction are handled",
    "description_density": "How much scene-setting vs. analysis",
    "do_list": "5-8 specific stylistic rules",
    "avoid_list": "5-8 specific things to avoid"
  },
  "canon_rules": {
    "thematic_boundaries": "What is and isn't within scope",
    "tonal_range": "Acceptable range of tones",
    "content_guidelines": "Content rules for language intensity ${languageIntensity}",
    "shared_world_rules": "N/A — standalone essays",
    "consistency_anchors": "Facts and rules that must stay consistent"
  },
  "story_twists": []
}

NONFICTION ANTHOLOGY RULES:
1. Each chapter must have a UNIQUE angle. No two chapters should cover the same aspect from the same perspective.
2. VARY the evidence types. One chapter might rely on statistics, another on interviews, another on archival documents, another on personal experience.
3. VARY the subjects. If profiling people, vary demographics, time periods, relationship to the theme.
4. The FIRST chapter should be the most accessible — the easiest entry point, the most immediately compelling hook.
5. The LAST chapter should provide synthesis, looking forward, or a call to action.
6. At least ONE chapter should challenge the collection's own thesis — present a counterargument or complication.
7. Each chapter's opening hook (setting.sensory_anchor) should be a SCENE or FACT, not a thesis statement. "On the morning of March 15, 1987, a phone rang in an empty office" is a hook. "This chapter explores regulatory failure" is not.
8. REAL EVENTS AND PEOPLE ONLY for case studies and profiles. If specific examples need verification, use placeholders: [RESEARCH: find a specific case of X].
${themeType === 'how_to' ? '9. HOW-TO chapters must include actionable steps, not just theory.' : ''}
${themeType === 'argument' ? '9. ARGUMENT chapters should be intellectually rigorous with evidence and counterarguments.' : ''}

Return the stories array with exactly ${numChapters} chapter concepts.

Return JSON only.`;
}

/**
 * Nonfiction anthology bible schema — same shape as fiction for parsing compatibility.
 */
export const nonfictionAnthologyBibleSchema = anthologyBibleSchema;

/**
 * Parse anthology bible result into world_md (master theme) and outline_md (story concepts).
 * Handles both fiction and nonfiction response shapes.
 */
export function parseAnthologyBible(bibleResult) {
  const masterTheme = bibleResult.master_theme || {};
  const stories = bibleResult.stories || [];
  const voiceGuide = bibleResult.voice_guide || {};
  const canonRules = bibleResult.canon_rules || {};
  const storyTwists = bibleResult.story_twists || [];

  // Master theme → world_md
  let worldMd = '# ' + (masterTheme.title || 'Untitled Collection') + '\n';
  if (masterTheme.subtitle) worldMd += '*' + masterTheme.subtitle + '*\n\n';
  worldMd += '## Theme\n' + (masterTheme.theme_statement || '') + '\n\n';
  worldMd += '## Tonal Boundaries\n' + (masterTheme.tonal_boundaries || '') + '\n\n';
  worldMd += '## Connecting Thread\n' + (masterTheme.connecting_thread || '') + '\n\n';
  worldMd += '## Collection Arc (Story Order)\n' + (masterTheme.collection_arc || '') + '\n\n';
  worldMd += '## Intended Reader Experience\n' + (masterTheme.reader_experience || '') + '\n';

  // Story concepts → outline_md
  let outlineMd = '# Story Concepts\n\n';
  for (const story of stories) {
    outlineMd += '---\n\n';
    outlineMd += '## Story ' + story.story_number + ': ' + (story.title || 'Untitled') + '\n\n';
    outlineMd += '**Premise:** ' + (story.premise || '') + '\n\n';
    outlineMd += '**Protagonist:** ' + (story.protagonist?.name || '?') + ' — ' + (story.protagonist?.age || '?') + ', ' + (story.protagonist?.occupation_or_role || '?') + '\n';
    outlineMd += '- Wound: ' + (story.protagonist?.wound || '') + '\n';
    outlineMd += '- Want: ' + (story.protagonist?.want || '') + '\n';
    outlineMd += '- Defining trait: ' + (story.protagonist?.defining_trait || '') + '\n\n';
    outlineMd += '**Setting:** ' + (story.setting?.location || '?') + ', ' + (story.setting?.time_period || '?') + '\n';
    outlineMd += '- Sensory anchor: ' + (story.setting?.sensory_anchor || '') + '\n\n';
    outlineMd += '**Conflict:** ' + (story.conflict || '') + '\n\n';
    outlineMd += '**Twist/Turn:** ' + (story.twist_or_turn || '') + '\n\n';
    outlineMd += '**Ending:** ' + (story.ending_type || '') + '\n\n';
    outlineMd += '**Thematic Angle:** ' + (story.thematic_angle || '') + '\n\n';
    outlineMd += '**POV:** ' + (story.pov || 'third-close') + ' | **Tense:** ' + (story.tense || 'past') + ' | **Tone:** ' + (story.tone || '') + '\n\n';
    outlineMd += '**Target Words:** ~' + (story.estimated_words || 3500) + '\n\n';
  }

  // Voice guide → voice_md
  let voiceMd = '# Collection Voice Guide\n\n';
  voiceMd += '## Baseline Tone\n' + (voiceGuide.baseline_tone || '') + '\n\n';
  voiceMd += '## Language Boundaries\n' + (voiceGuide.language_boundaries || '') + '\n\n';
  voiceMd += '## Prose Style\n' + (voiceGuide.prose_style_notes || '') + '\n\n';
  voiceMd += '## Dialogue Approach\n' + (voiceGuide.dialogue_approach || '') + '\n\n';
  voiceMd += '## Description Density\n' + (voiceGuide.description_density || '') + '\n\n';
  voiceMd += '## Always Do\n' + (voiceGuide.do_list || '') + '\n\n';
  voiceMd += '## Never Do\n' + (voiceGuide.avoid_list || '') + '\n';

  // Canon rules → canon_md
  let canonMd = '# Collection Canon & Rules\n\n';
  canonMd += '## Thematic Boundaries\n' + (canonRules.thematic_boundaries || '') + '\n\n';
  canonMd += '## Tonal Range\n' + (canonRules.tonal_range || '') + '\n\n';
  canonMd += '## Content Guidelines\n' + (canonRules.content_guidelines || '') + '\n\n';
  canonMd += '## Shared World Rules\n' + (canonRules.shared_world_rules || 'N/A — standalone stories') + '\n\n';
  canonMd += '## Consistency Anchors\n' + (canonRules.consistency_anchors || '') + '\n';

  // Story twists → twists_md
  let twistsMd = '';
  if (storyTwists.length > 0) {
    twistsMd = '# Per-Story Twists\n\n';
    for (const twist of storyTwists) {
      twistsMd += '## Story ' + (twist.story_number || '?') + ': ' + (twist.story_title || '') + '\n';
      twistsMd += '**Type:** ' + (twist.twist_type || 'unspecified') + '\n';
      twistsMd += '**Twist:** ' + (twist.twist_description || '') + '\n';
      if (twist.setup_hint) twistsMd += '**Setup Hint:** ' + twist.setup_hint + '\n';
      if (twist.emotional_impact) twistsMd += '**Emotional Impact:** ' + twist.emotional_impact + '\n';
      twistsMd += '\n';
    }
  }

  return {
    title: masterTheme.title || '',
    tagline: masterTheme.subtitle || '',
    worldMd,
    outlineMd,
    voiceMd,
    canonMd,
    twistsMd,
    stories,
  };
}

/**
 * Convert story concepts into chapter creation data.
 */
export function storiesToChapterPlans(stories) {
  return stories.map((story) => ({
    chapter_number: story.story_number,
    title: story.title || 'Story ' + story.story_number,
    beat_summary: JSON.stringify({
      premise: story.premise,
      protagonist: story.protagonist,
      setting: story.setting,
      conflict: story.conflict,
      twist: story.twist_or_turn,
      ending_type: story.ending_type,
      thematic_angle: story.thematic_angle,
      pov: story.pov,
      tense: story.tense,
      tone: story.tone,
      target_words: story.estimated_words,
    }),
  }));
}

/**
 * Parse story data from a chapter's beat_summary (which is a JSON string for anthologies).
 */
export function parseStoryData(chapter) {
  if (!chapter?.beat_summary) return null;
  try {
    const parsed = JSON.parse(chapter.beat_summary);
    // Only treat as anthology story data if it has anthology-specific fields
    if (parsed.protagonist || parsed.thematic_angle) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Build an anthology-specific scene prompt for the prose writer.
 * Routes to fiction or nonfiction variant.
 */
export function buildAnthologyStoryContext(project, chapter) {
  if (isNonfictionAnthology(project)) {
    return buildNonfictionAnthologyStoryContext(project, chapter);
  }
  return buildFictionAnthologyStoryContext(project, chapter);
}

/**
 * Fiction anthology scene prompt (original).
 */
function buildFictionAnthologyStoryContext(project, chapter) {
  const storyData = parseStoryData(chapter);
  if (!storyData) return null;

  const lengthInfo = ANTHOLOGY_STORY_LENGTHS[project.anthology_story_length || 'short'] || ANTHOLOGY_STORY_LENGTHS.short;

  return `═══ STANDALONE SHORT STORY — COMPLETE CONTEXT RESET ═══

You are writing a COMPLETELY NEW, STANDALONE short story. This story has ZERO connection to any previous chapter or story in this collection. Do NOT reference, continue, or carry forward any characters, settings, plot threads, or emotional arcs from any other story. Every character in this story is NEW and EXISTS ONLY IN THIS STORY.

COLLECTION THEME (the ONLY shared element): ${project.anthology_theme || project.seed_concept || 'unspecified'}
GENRE: ${project.genre || 'Fiction'}

THIS STORY:
Title: ${chapter.title || storyData.title || 'Untitled'}
Premise: ${storyData.premise || 'No premise provided'}

PROTAGONIST (exists ONLY in this story):
Name: ${storyData.protagonist?.name || 'unnamed'}
Age: ${storyData.protagonist?.age || '?'}
Role: ${storyData.protagonist?.occupation_or_role || '?'}
Wound: ${storyData.protagonist?.wound || '?'}
Want: ${storyData.protagonist?.want || '?'}
Defining trait: ${storyData.protagonist?.defining_trait || '?'}

SETTING (unique to this story):
Location: ${storyData.setting?.location || '?'}
Time: ${storyData.setting?.time_period || '?'}
Sensory anchor: ${storyData.setting?.sensory_anchor || '?'}

CONFLICT: ${storyData.conflict || '?'}
TWIST/TURN: ${storyData.twist || '?'}
ENDING TYPE: ${storyData.ending_type || 'resolved'}
THEMATIC ANGLE: ${storyData.thematic_angle || '?'}

POV: ${storyData.pov || project.pov_mode || 'third-close'}
TENSE: ${storyData.tense || project.tense || 'past'}
TONE: ${storyData.tone || ''}

TARGET LENGTH: ~${lengthInfo.words} words
${lengthInfo.instruction}

${buildAnthologySpiceProseBlock(project)}
═══ ANTHOLOGY STORY RULES (MANDATORY) ═══
1. This is a COMPLETE STORY with beginning, middle, and end. NOT a chapter of a larger novel.
2. ALL characters are NEW — created specifically for this story. Do NOT reuse characters from any other story.
3. Introduce the protagonist within the first paragraph.
4. The setting must be established in the first 200 words through sensory detail, not exposition.
5. The conflict must be clear by the 25% mark.
6. The twist or turn should land between 60-80% of the way through.
7. The ending must feel EARNED — fully resolve this story's conflict.
8. The thematic angle connects to the collection theme but should never be stated explicitly.
9. Every paragraph must serve at least TWO functions: advance plot, reveal character, build atmosphere, or develop theme.
10. No sequel hooks, no unresolved major questions, no "to be continued" (unless ending_type is "ambiguous").
11. Do NOT reference events, people, places, or emotions from any other story in this collection.
═══ END ANTHOLOGY RULES ═══`;
}

/**
 * Nonfiction anthology scene prompt.
 */
function buildNonfictionAnthologyStoryContext(project, chapter) {
  const storyData = parseStoryData(chapter);
  if (!storyData) return null;

  const lengthInfo = ANTHOLOGY_STORY_LENGTHS[project.anthology_story_length || 'short'] || ANTHOLOGY_STORY_LENGTHS.short;

  const researchBlock = project.research_md
    ? '\n=== RESEARCH BRIEF (use for factual grounding) ===\n' + (project.research_md || '').substring(0, 5000) + '\n===\n'
    : '';

  return `You are writing a standalone nonfiction essay/chapter for an anthology collection.

COLLECTION THEME: ${project.anthology_theme || project.seed_concept || 'unspecified'}
GENRE: ${project.genre || 'Nonfiction'}
LANGUAGE INTENSITY: ${project.language_intensity || 0}

THIS CHAPTER:
Title: ${chapter.title || storyData.title || 'Untitled'}
Premise: ${storyData.premise || 'No premise provided'}
Angle: ${storyData.protagonist?.want || ''}
Key Question: ${storyData.protagonist?.wound || ''}

SUBJECT:
Type: ${storyData.protagonist?.occupation_or_role || '?'}
Name: ${storyData.protagonist?.name || '?'}
Time Period: ${storyData.setting?.time_period || '?'}
Location: ${storyData.setting?.location || '?'}

Narrative Hook: ${storyData.setting?.sensory_anchor || ''}
Key Insight: ${storyData.protagonist?.defining_trait || ''}
Connection to Theme: ${storyData.thematic_angle || ''}
Tone: ${storyData.tone || ''}
${researchBlock}
TARGET LENGTH: ~${lengthInfo.words} words
${lengthInfo.nfInstruction || lengthInfo.instruction}

NONFICTION PROSE RULES:
1. OPEN WITH THE HOOK, not the thesis. Start with a scene, a fact, a question, or a moment that pulls the reader in.
2. REAL EVENTS ONLY. Do not fabricate quotes, statistics, dates, or people. Use placeholders for uncertain facts: [VERIFY: specific claim].
3. NARRATIVE DRIVE. Even nonfiction needs momentum. Use techniques from journalism: scenes, dialogue reconstruction (attributed), telling details, tension.
4. SHOW THEN ANALYZE. Present the evidence or scene first, then offer the interpretation.
5. HUMAN BEINGS. Ground ideas in specific people — their decisions, failures, words.
6. NO TEXTBOOK TONE. The prose should have voice, perspective, and energy. Sentence variety matters.
7. SUBHEADINGS are allowed and encouraged for chapters over 3,000 words.
8. The KEY INSIGHT should arrive like a revelation — built toward through evidence.
9. END STRONG. A callback to the opening, a forward-looking statement, or a resonant image.
10. DISTINGUISH FACT FROM INTERPRETATION. When stating facts, be precise. When offering interpretation, signal it.
11. ATTRIBUTION. Reference specific claims naturally: "According to..." or "As [Name] noted in [Year]..."
12. If covering historical events, provide enough context for unfamiliar readers.`;
}

/**
 * Check if a project is an anthology.
 * Primary: project_type === 'anthology'.
 * Fallback: if anthology_theme is set and book_type is NOT 'nonfiction' used alone,
 * treat it as anthology (covers save-race where project_type reverted to book_type).
 */
export function isAnthologyProject(project) {
  if (!project) return false;
  if (project.project_type === 'anthology') return true;
  // Fallback: if anthology-specific fields are populated, the user intended anthology
  if (project.anthology_theme && project.anthology_theme.trim().length > 0) return true;
  return false;
}

/**
 * Check if this anthology has erotica-level spice.
 */
export function isEroticaAnthology(project) {
  return isAnthologyProject(project) && Number(project.spice_level || 0) >= 2;
}

/**
 * Build spice/erotica rules for the anthology bible prompt.
 */
function buildAnthologySpiceBibleRules(spiceLevel) {
  if (spiceLevel < 1) return '';
  const heatDesc = spiceLevel >= 4
    ? 'Explicit, detailed, extended intimate scenes. This is the main event, not a side dish.'
    : spiceLevel >= 3
    ? 'Explicit scenes with full physical detail. The intimacy is a major story beat.'
    : spiceLevel >= 2
    ? 'Steamy scenes with clear physical progression. Suggestive to moderately explicit.'
    : 'Sensual tension and implied intimacy. Fade-to-black or tastefully suggestive.';

  return `\nEROTICA ANTHOLOGY RULES:\n- Each story concept must include romantic/sexual tension integral to its conflict.\n- No two stories should have the same intimate dynamic. Vary: dominant/submissive, equals, tentative/experienced, angry/tender, playful/intense.\n- The romantic/sexual element must be INTEGRAL to the story's conflict and theme — not a separate scene bolted on. "They had great sex" is not a story. "The sex revealed a truth neither of them wanted to face" IS a story.\n- Spice Level ${spiceLevel}/4: ${heatDesc}\n`;
}

/**
 * Build spice/erotica block for anthology prose generation.
 */
export function buildAnthologySpiceProseBlock(project) {
  const spice = Number(project.spice_level || 0);
  if (spice < 1) return '';
  const register = Number(project.erotica_register || 0);

  let block = `\nSPICE LEVEL: ${spice}/4\nEROTICA REGISTER: ${register}\n`;

  if (spice >= 1) block += '\nADULT CONTENT IS ENABLED for this anthology. Each story should include romantic and/or sexual content appropriate to the spice level setting.\n';
  if (spice >= 3) block += '\nEXPLICIT CONTENT: Write explicit sexual scenes with anatomical detail, physical sensation, and emotional connection. Do not fade to black. Do not use euphemisms unless the character would. The intimacy is a story beat, not decoration — it must advance character or conflict.\n';
  if (spice >= 4) block += '\nHIGH HEAT: Extended, detailed intimate scenes. Multiple encounters per story are expected. Physical chemistry should be palpable from the first interaction. Build tension through proximity, touch, and denial before the release.\n';

  block += `\nEROTICA STORY RULES:\n- Every intimate scene must serve the story — it reveals character, shifts power dynamics, or changes the relationship.\n- Consent must be clear (enthusiastic, explicit, or contextually established).\n- Physical descriptions should be sensory and specific, not clinical or purple.\n- Emotional interiority during intimate scenes is mandatory — what the character FEELS matters as much as what they DO.\n- Vary the encounters across stories. Different dynamics, different power balances, different emotional contexts.\n`;
  return block;
}

/**
 * Build spice context for anthology beat generation.
 * For spice >= 2, provides explicit scene-allocation guidance so the intimate
 * encounter gets its own dedicated scene slot with adequate word budget
 * (prevents the explicit scene from being compressed into shared runway with
 * setup or resolution in short stories).
 */
export function buildAnthologySpiceBeatContext(project) {
  const spice = Number(project.spice_level || 0);
  if (spice < 1) return '';

  // Baseline (spice 1): soft integration
  if (spice < 2) {
    return `\n\nSPICE LEVEL: ${spice}/4. Include intimate/sexual beats in the story structure. Plan where the tension builds, where the encounter happens, and how it changes the dynamic. The intimate scene should be a BEAT in the story arc, not an appendix.\n`;
  }

  // Spice 2+: explicit scene allocation so the intimate scene has its own slot
  const targetWords = Number(project.chapter_length_target || project.target_chapter_words || 3500);

  // Recommended word budget for the intimate scene (roughly 35-45% of story)
  const intimateBudget = Math.round(targetWords * 0.4);
  const setupBudget = Math.round(targetWords * 0.3);
  const resolutionBudget = targetWords - intimateBudget - setupBudget;

  let block = `\n\n═══ EROTICA STORY BEAT ALLOCATION (SPICE ${spice}/4) ═══\n`;
  block += `This is an erotica story. Allocate scene beats so the intimate encounter has DEDICATED RUNWAY. Do NOT compress it into a shared scene with setup or resolution.\n\n`;
  block += `RECOMMENDED STRUCTURE:\n`;
  block += `- EARLY SCENE(S): Setup, character, and tension buildup (~${setupBudget} words total across these scenes).\n`;
  block += `- INTIMATE SCENE: The sexual/intimate encounter itself. Allocate ~${intimateBudget} words to this scene. Mark this scene's scene_goal as explicitly covering the intimate encounter. Its tension_level should be the peak of the story.\n`;
  block += `- CLOSING SCENE: Fallout, reflection, or resolution showing how the encounter changed the dynamic (~${resolutionBudget} words).\n\n`;
  block += `PACING RULES:\n`;
  block += `- The setup scenes must FINISH their work before the intimate scene starts. No lingering exposition bleeding into the intimate scene's runway.\n`;
  block += `- The intimate scene must actually COMPLETE on-page. Do not leave it at the threshold. Do not fade to black (unless spice is 1).\n`;
  block += `- The intimate scene's exit_hook should be the emotional/relational shift it caused, not "they kept going" or "more happened."\n`;

  if (targetWords <= 1500) {
    block += `\nSHORT-STORY PACING (${targetWords} words):\nGet to the intimate scene within the first third. Do NOT burn 60% of the story on setup. The reader expects the encounter to happen, and the remaining runway needs room for the scene itself plus fallout.\n`;
  }

  block += `═══ END EROTICA BEAT ALLOCATION ═══\n`;
  return block;
}