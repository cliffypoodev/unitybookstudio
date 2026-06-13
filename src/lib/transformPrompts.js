/**
 * Transform Prompts — "Turn the manuscript into..." conversion library.
 *
 * src/lib/transformPrompts.js
 *
 * This file powers the Tools > Transform tab.
 *
 * Design goal:
 * Transform is not a line-editing page. It is a manuscript conversion studio:
 * upload/load a book, choose a delivery format, and generate publishing,
 * marketing, audio, screen, visual, education, or franchise-ready assets.
 *
 * v2 expansion:
 * - Keeps existing screenplay/stage/audiobook/TV/graphic novel/marketing formats.
 * - Adds high-value publishing and launch formats.
 * - Adds Graphic Audiobook Script and Suno / generative-audio cue sheet.
 * - Adds video/trailer/storyboard formats.
 * - Adds workbook/facilitator/reader companion formats.
 * - Adds fiction IP expansion formats such as series bible and sequel roadmap.
 * - Adds visual novel / interactive fiction / game questline formats.
 */

export const TRANSFORM_CATEGORIES = [
  {
    id: 'audio',
    label: 'Audio & Performance',
    description: 'Turn the manuscript into narrated, full-cast, or generative-audio-ready scripts.',
  },
  {
    id: 'screen',
    label: 'Screen & Stage',
    description: 'Adapt the manuscript into film, TV, stage, trailer, or visual production documents.',
  },
  {
    id: 'visual',
    label: 'Visual / Sequential Art',
    description: 'Convert prose into comic, graphic novel, visual novel, or interactive visual formats.',
  },
  {
    id: 'publishing',
    label: 'Publishing & Metadata',
    description: 'Create KDP, bookstore, agent, library, and sales-page assets.',
  },
  {
    id: 'marketing',
    label: 'Marketing & Launch',
    description: 'Generate launch campaigns, ad copy, newsletters, quote packs, and promotional assets.',
  },
  {
    id: 'education',
    label: 'Reader / Education',
    description: 'Create study guides, workbooks, facilitator guides, quizzes, and reader companions.',
  },
  {
    id: 'ip',
    label: 'Fiction IP Expansion',
    description: 'Build series bibles, sequel roadmaps, spin-offs, franchise assets, and continuity files.',
  },
  {
    id: 'repurpose',
    label: 'Content Repurpose',
    description: 'Expand or restructure the manuscript into articles, summaries, posts, and derivative content.',
  },
];

export const TRANSFORM_FORMATS = [
  // ── AUDIO & PERFORMANCE ───────────────────────────────────────────────────
  {
    id: 'audiobook',
    label: 'Audiobook Script',
    emoji: '🎧',
    category: 'audio',
    description: 'Narration-optimized script with pronunciation notes, pacing markers, and voice guidance.',
    perChapter: true,
    worksForNonfiction: true,
  },
  {
    id: 'graphicaudio',
    label: 'Graphic Audiobook Script',
    emoji: '🎙️',
    category: 'audio',
    description: 'Full immersive audio script with narrator lines, character voices, SFX, music, and atmosphere cues.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'fullcastaudio',
    label: 'Full-Cast Audio Drama',
    emoji: '🎭',
    category: 'audio',
    description: 'Dialogue-forward audio-drama script with cast list, scene cues, ambience, and sound design.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'sunocuesheet',
    label: 'Suno / Generative Audio Cue Sheet',
    emoji: '🎛️',
    category: 'audio',
    description: 'Bracketed music/SFX/voice directives for generative audio tools. Designed for cinematic audiobook segments.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'voicebible',
    label: 'Character Voice Bible',
    emoji: '🗣️',
    category: 'audio',
    description: 'Voice profiles for every major character: tone, accent, tempo, vocal texture, and sample lines.',
    perChapter: false,
    worksForNonfiction: false,
  },
  {
    id: 'podcastadaptation',
    label: 'Podcast Episode Adaptation',
    emoji: '🎙️',
    category: 'audio',
    description: 'Convert the manuscript into a narrative podcast episode or limited-series episode plan.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'traileraudio',
    label: 'Trailer Audio Script',
    emoji: '📣',
    category: 'audio',
    description: '60–90 second cinematic audio trailer with VO, music beats, SFX, and hook lines.',
    perChapter: false,
    worksForNonfiction: true,
  },

  // ── SCREEN & STAGE ────────────────────────────────────────────────────────
  {
    id: 'screenplay',
    label: 'Screenplay',
    emoji: '🎬',
    category: 'screen',
    description: 'Industry-standard feature screenplay. Sluglines, action lines, dialogue blocks, parentheticals.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'stageplay',
    label: 'Stage Play',
    emoji: '🎭',
    category: 'screen',
    description: 'Theatrical script with act/scene structure, stage directions, and live-performance dialogue.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'tvpilot',
    label: 'TV Pilot',
    emoji: '📺',
    category: 'screen',
    description: 'One-hour pilot script with cold open, act breaks, and series hooks. Adapts the first chapters.',
    perChapter: false,
    worksForNonfiction: false,
  },
  {
    id: 'movietrailer',
    label: 'Movie / Book Trailer Script',
    emoji: '🎞️',
    category: 'screen',
    description: 'Cinematic trailer script with shots, VO, title cards, music, SFX, and timing.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'storyboard',
    label: 'Book Trailer Storyboard',
    emoji: '🧩',
    category: 'screen',
    description: 'Shot-by-shot storyboard for video generation: visuals, camera, text overlay, VO, SFX, duration.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'shotlist',
    label: 'Scene-by-Scene Shot List',
    emoji: '🎥',
    category: 'screen',
    description: 'Production shot list with scene purpose, camera language, mood, props, and visual beats.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'directorstreatment',
    label: "Director's Treatment",
    emoji: '🎚️',
    category: 'screen',
    description: 'Prestige adaptation treatment: visual style, tone, casting archetypes, themes, and key sequences.',
    perChapter: false,
    worksForNonfiction: true,
  },

  // ── VISUAL / SEQUENTIAL ART ───────────────────────────────────────────────
  {
    id: 'graphicnovel',
    label: 'Graphic Novel Script',
    emoji: '🖼️',
    category: 'visual',
    description: 'Panel-by-panel breakdown with visual descriptions, dialogue bubbles, captions, and page layouts.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'comicissue',
    label: 'Comic Issue Script',
    emoji: '💥',
    category: 'visual',
    description: 'Monthly comic format: 20–24 pages, panels, splash pages, captions, dialogue, SFX.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'mangachapter',
    label: 'Manga Chapter Script',
    emoji: '🌸',
    category: 'visual',
    description: 'Manga-style chapter with page turns, emotional close-ups, action panels, and black/white visual language.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'visualnovel',
    label: 'Visual Novel Script',
    emoji: '🎮',
    category: 'visual',
    description: 'Visual novel scene script with backgrounds, sprites, dialogue, choices, flags, and branching beats.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'interactivefiction',
    label: 'Interactive Fiction Branches',
    emoji: '🕹️',
    category: 'visual',
    description: 'Branching choice structure with decision points, consequences, endings, and state variables.',
    perChapter: false,
    worksForNonfiction: false,
  },
  {
    id: 'gamequestline',
    label: 'Game Questline',
    emoji: '🗺️',
    category: 'visual',
    description: 'Turn the story into game quests: objectives, NPCs, locations, rewards, branching outcomes.',
    perChapter: false,
    worksForNonfiction: false,
  },

  // ── PUBLISHING & METADATA ─────────────────────────────────────────────────
  {
    id: 'querysynopsis',
    label: 'Query Synopsis',
    emoji: '📋',
    category: 'publishing',
    description: 'Professional 1–3 page synopsis for literary agent submissions. Reveals the ending.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'backcover',
    label: 'Back Cover Blurb',
    emoji: '📖',
    category: 'publishing',
    description: '150–200 word hook-driven marketing copy for the KDP book listing and back cover.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'kdpmetadata',
    label: 'KDP Metadata Pack',
    emoji: '🏷️',
    category: 'publishing',
    description: 'Title/subtitle options, description, keywords, categories, comps, A+ copy, and listing strategy.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'amazonpage',
    label: 'Amazon Product Page',
    emoji: '🛒',
    category: 'publishing',
    description: 'Complete Amazon sales-page copy: headline, description, editorial blurbs, bullets, and reader promise.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'apluscontent',
    label: 'Amazon A+ Content Copy',
    emoji: '🧱',
    category: 'publishing',
    description: 'A+ module copy: comparison panels, theme blocks, quote modules, author section, visual prompts.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'sellSheet',
    label: 'Library / Bookstore Sell Sheet',
    emoji: '🏪',
    category: 'publishing',
    description: 'One-page sell sheet for bookstores, libraries, events, schools, and wholesale outreach.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'pressrelease',
    label: 'Press Release',
    emoji: '🗞️',
    category: 'publishing',
    description: 'Professional release announcement for media, local newspapers, podcasts, and launch outreach.',
    perChapter: false,
    worksForNonfiction: true,
  },

  // ── MARKETING & LAUNCH ────────────────────────────────────────────────────
  {
    id: 'keyquotes',
    label: 'Key Quotes Extract',
    emoji: '💬',
    category: 'marketing',
    description: 'Pull-quote collection ready for social media, websites, newsletters, and promotional graphics.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'sampleextract',
    label: 'Sample Chapter Extract',
    emoji: '✂️',
    category: 'marketing',
    description: 'First sample preview polished as a lead magnet / Kindle sample. Ends on a hook.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'social30',
    label: '30-Day Social Campaign',
    emoji: '📆',
    category: 'marketing',
    description: 'Thirty days of platform-ready social posts: hooks, captions, CTAs, quote graphics, and reels.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'booktokpack',
    label: 'BookTok / Reel Script Pack',
    emoji: '📱',
    category: 'marketing',
    description: 'Short-form video hooks, scripts, text overlays, B-roll prompts, captions, and hashtags.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'newsletterlaunch',
    label: 'Newsletter Launch Sequence',
    emoji: '📧',
    category: 'marketing',
    description: 'Preorder, launch-day, review-request, and follow-up email sequence for an author list.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'adcopy',
    label: 'Ad Copy Pack',
    emoji: '📣',
    category: 'marketing',
    description: 'Amazon/Facebook/BookBub-style ad headlines, primary text, hooks, and split-test variants.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'arcreview',
    label: 'ARC / Review Request Packet',
    emoji: '⭐',
    category: 'marketing',
    description: 'ARC outreach emails, reviewer notes, content warnings, review prompts, and follow-up copy.',
    perChapter: false,
    worksForNonfiction: true,
  },

  // ── READER / EDUCATION ────────────────────────────────────────────────────
  {
    id: 'bookclub',
    label: 'Book Club Discussion Guide',
    emoji: '👥',
    category: 'education',
    description: 'Discussion questions organized by theme. Ready for book clubs, libraries, and reading groups.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'studyguide',
    label: 'Study Guide',
    emoji: '🎓',
    category: 'education',
    description: 'Per-chapter companion: learning objectives, key concepts, reflection prompts, and action items.',
    perChapter: true,
    worksForNonfiction: true,
    fictionWarning: 'Study Guide is designed for nonfiction. Running this on fiction will produce literary analysis instead.',
  },
  {
    id: 'workbook',
    label: 'Workbook',
    emoji: '📓',
    category: 'education',
    description: 'Exercises, reflection spaces, worksheets, action plans, and chapter-by-chapter activities.',
    perChapter: true,
    worksForNonfiction: true,
  },
  {
    id: 'facilitatorguide',
    label: 'Facilitator / Teacher Guide',
    emoji: '🧑‍🏫',
    category: 'education',
    description: 'Lesson plans, discussion flow, activities, timing, handouts, and facilitator notes.',
    perChapter: true,
    worksForNonfiction: true,
  },
  {
    id: 'quizpack',
    label: 'Quiz / Assessment Pack',
    emoji: '✅',
    category: 'education',
    description: 'Multiple-choice, short-answer, discussion, and applied assessment questions by chapter.',
    perChapter: true,
    worksForNonfiction: true,
  },
  {
    id: 'glossarytimeline',
    label: 'Glossary / Timeline / Map',
    emoji: '🧭',
    category: 'education',
    description: 'Extract glossary terms, timeline events, people, locations, organizations, and relationship maps.',
    perChapter: false,
    worksForNonfiction: true,
  },

  // ── FICTION IP EXPANSION ──────────────────────────────────────────────────
  {
    id: 'seriesbible',
    label: 'Series Bible',
    emoji: '📚',
    category: 'ip',
    description: 'World rules, cast, timeline, locations, open threads, resolved threads, and future hooks.',
    perChapter: false,
    worksForNonfiction: false,
  },
  {
    id: 'characterbible',
    label: 'Character Bible',
    emoji: '👤',
    category: 'ip',
    description: 'Main and supporting cast profiles: voice, motivation, wounds, arcs, secrets, relationships.',
    perChapter: false,
    worksForNonfiction: false,
  },
  {
    id: 'worldbible',
    label: 'World Bible',
    emoji: '🌍',
    category: 'ip',
    description: 'Locations, rules, institutions, history, technology/magic, culture, factions, and continuity logic.',
    perChapter: false,
    worksForNonfiction: false,
  },
  {
    id: 'sequelroadmap',
    label: 'Sequel Roadmap',
    emoji: '🛣️',
    category: 'ip',
    description: 'Book 2/3/4 premise options, open-thread payoffs, escalation logic, and series engine.',
    perChapter: false,
    worksForNonfiction: false,
  },
  {
    id: 'spinoffideas',
    label: 'Spin-Off Ideas',
    emoji: '🧬',
    category: 'ip',
    description: 'Spin-off novels, novellas, anthologies, side-character arcs, prequels, and companion stories.',
    perChapter: false,
    worksForNonfiction: false,
  },
  {
    id: 'pitchdeck',
    label: 'Adaptation Pitch Deck Outline',
    emoji: '📊',
    category: 'ip',
    description: 'Pitch deck structure for film/TV/audio/game adaptation: logline, comps, characters, season arc.',
    perChapter: false,
    worksForNonfiction: true,
  },

  // ── CONTENT REPURPOSE ─────────────────────────────────────────────────────
  {
    id: 'chapsummaries',
    label: 'Chapter Summaries',
    emoji: '📝',
    category: 'repurpose',
    description: 'Bullet-point TL;DR per chapter. Useful for newsletters, audiobook breaks, and marketing.',
    perChapter: true,
    worksForNonfiction: true,
  },
  {
    id: 'blogseries',
    label: 'Blog Post Series',
    emoji: '📰',
    category: 'repurpose',
    description: 'Standalone blog/article series derived from the manuscript. SEO-aware and shareable.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'youtubeessay',
    label: 'YouTube Essay Script',
    emoji: '▶️',
    category: 'repurpose',
    description: 'Long-form YouTube script adapted from the manuscript: hook, sections, B-roll, CTA.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'courseoutline',
    label: 'Mini-Course Outline',
    emoji: '🏫',
    category: 'repurpose',
    description: 'Turn nonfiction/training content into a structured short course with modules and lessons.',
    perChapter: false,
    worksForNonfiction: true,
    fictionWarning: 'Mini-Course is primarily useful for nonfiction/training content.',
  },
  {
    id: 'execsummary',
    label: 'Executive Summary',
    emoji: '🧾',
    category: 'repurpose',
    description: 'Concise high-level summary for stakeholders, grant panels, internal use, or publishing packets.',
    perChapter: false,
    worksForNonfiction: true,
  },

  // ── NEW TRANSFORM FORMATS v3 ──────────────────────────────────────────────
  {
    id: 'fullcastscript',
    label: 'Full-Cast Audiobook Script',
    emoji: '🎭',
    category: 'audio',
    description: 'Multi-voice performance script with character voice assignments, narrator bridges, and SFX cues.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'podcastepisode',
    label: 'Podcast / Serial Episode Breakdown',
    emoji: '🎙️',
    category: 'audio',
    description: 'Cliffhanger-aware episode splits with intro hooks, segment breaks, and outro teasers.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'graphicnovelpanel',
    label: 'Graphic-Novel Panel Script',
    emoji: '🖼️',
    category: 'visual',
    description: 'Page/panel/caption/balloon format with camera angles, color mood, and artist direction.',
    perChapter: true,
    worksForNonfiction: false,
  },
  {
    id: 'blogserialpack',
    label: 'Blog Serialization Pack',
    emoji: '📝',
    category: 'repurpose',
    description: 'SEO-titled installments with meta descriptions, excerpt hooks, and reader CTAs.',
    perChapter: false,
    worksForNonfiction: true,
  },
  {
    id: 'translationprep',
    label: 'Translation Prep Sheet',
    emoji: '🌐',
    category: 'publishing',
    description: 'Idiom/cultural reference/wordplay flags with tone notes for translators.',
    perChapter: true,
    worksForNonfiction: true,
  },
  {
    id: 'readermagnet',
    label: 'Reader Magnet / Free Preview',
    emoji: '🧲',
    category: 'marketing',
    description: 'Compelling free preview excerpt or standalone prequel scene for lead generation.',
    perChapter: false,
    worksForNonfiction: true,
  },
];

/**
 * Look up format metadata by id.
 */
export function getFormat(formatId) {
  return TRANSFORM_FORMATS.find((f) => f.id === formatId) || null;
}

/**
 * Filter formats visible for a given project type.
 * Nonfiction projects hide purely fiction-only adaptation/franchise formats.
 */
export function formatsForProjectType(projectType) {
  const isNonfiction = isNF(projectType);
  if (!isNonfiction) return TRANSFORM_FORMATS;
  return TRANSFORM_FORMATS.filter((f) => f.worksForNonfiction);
}

/**
 * Determine if a format should get nonfiction-aware prompt branches.
 */
function isNF(projectType) {
  const pt = (projectType || '').toLowerCase();
  return pt.includes('non') || pt === 'nonfiction';
}

function cleanText(text) {
  return String(text || '').trim();
}

function sourceText(chapterText, fullText) {
  return cleanText(chapterText || fullText || '');
}

function bookTitleFromPrompt() {
  return '[Book Title]';
}

/**
 * Build the per-invocation prompt for a given format.
 *
 * chapterText is supplied for per-chapter formats, fullText for book-level
 * formats. projectType is 'fiction' or 'nonfiction' (lower case).
 */
export function getTransformPrompt(formatId, chapterText, fullText, projectType = 'fiction') {
  const nf = isNF(projectType);
  const src = sourceText(chapterText, fullText);

  switch (formatId) {
    /* =========================================================================
     * AUDIO & PERFORMANCE
     * ====================================================================== */

    case 'audiobook':
      if (nf) {
        return `You are preparing a nonfiction chapter for professional audiobook narration.

FORMAT RULES:
- Keep the prose intact unless a sentence is truly awkward aloud.
- Add pronunciation guides in [brackets] for unusual names, places, and technical terms.
- Convert citations into smooth narrator notes: [Narrator note: citation].
- Mark source quotes with [Quote begins] and [Quote ends].
- Add [PAUSE] at major transitions and after important claims.
- Add [CHAPTER BREAK] at the start.
- Mark statistics and key numbers with *asterisks* for slight emphasis.
- Flag dense material: [Technical section — slow pacing recommended].
- Estimate narration time at 150 words per minute.

CHAPTER TO CONVERT:
${src}

Output ONLY the audiobook narration script. No commentary.`;
      }
      return `You are preparing a novel chapter for professional audiobook narration.

FORMAT RULES:
- Keep the prose intact unless a sentence is awkward aloud.
- Add pronunciation guides in [brackets] for unusual names on first occurrence.
- Add [PAUSE] markers at scene transitions and emotional turns.
- Add [CHAPTER BREAK] at the start.
- Add narrator notes for character voices on first meaningful appearance:
  [Narrator note: Character speaks with clipped, guarded precision.]
- Mark emphasis with *asterisks* only when helpful.
- Flag dialogue-heavy stretches:
  [Extended dialogue sequence — maintain distinct voices.]
- Estimate narration time at 150 words per minute.

CHAPTER TO CONVERT:
${src}

Output ONLY the audiobook narration script. No commentary.`;

    case 'graphicaudio':
      return `You are adapting a prose chapter into a cinematic GRAPHIC AUDIOBOOK SCRIPT for immersive audio production.

MISSION:
Create an audio-first version that feels like a full-cast, sound-designed experience: narrator, character voices, music cues, SFX, ambience, scene transitions, and emotional pacing.

ABSOLUTE FORMAT RULES:
- All non-spoken production directions MUST be inside square brackets.
- Spoken lines must be outside brackets and formatted as:
  NARRATOR:
  CHARACTER NAME:
- Do not use markdown tables.
- Do not summarize the chapter. Adapt it scene by scene.
- Preserve all plot events, character intent, emotional turns, and major dialogue.
- Condense interior prose into narrator lines, voiceover, action cues, or sound design.
- Never invent a new ending or new plot twist.
- Adult content may remain if present; handle it cinematically and consent-aware.

OUTPUT STRUCTURE:

[GRAPHIC AUDIOBOOK SCRIPT — CHAPTER / SCENE TITLE]

[CAST / VOICE NOTES]
NARRATOR: [voice direction]
CHARACTER NAME: [voice direction]
CHARACTER NAME: [voice direction]

[SCENE 1 — LOCATION / MOOD]
[Music cue: ...]
[Atmosphere: ...]
[SFX: ...]

NARRATOR:
...

CHARACTER NAME:
...

[SFX: ...]
[Performance note: ...]

[TRANSITION: ...]

Continue scene by scene until the chapter is fully adapted.

SOUND DESIGN RULES:
- Use [SFX:] for concrete sounds.
- Use [Atmosphere:] for continuous background environment.
- Use [Music cue:] for emotional score direction.
- Use [Silence:] when silence is an intentional beat.
- Use [Performance note:] for actor delivery.
- Use [Pacing:] for rhythm guidance.
- Keep cues specific and generative-audio-friendly.

CHAPTER TO ADAPT:
${src}

Output ONLY the graphic audiobook script. No commentary.`;

    case 'fullcastaudio':
      return `You are adapting a prose chapter into a FULL-CAST AUDIO DRAMA SCRIPT.

GOAL:
Create a dialogue-forward script where the story can be performed by actors with narrator support, sound effects, and scene ambience.

FORMAT:
[CAST]
NARRATOR — [voice]
CHARACTER — [voice]
CHARACTER — [voice]

[SCENE 1: LOCATION — TIME / MOOD]
[Ambience: ...]
[Music: ...]
[SFX: ...]

NARRATOR:
Narration that bridges visual/action material.

CHARACTER:
Dialogue.

[SFX: ...]
CHARACTER:
Dialogue.

RULES:
- Convert exposition into narration, character dialogue, or audible action.
- Keep internal thoughts only if delivered as NARRATOR or V.O.
- Use sound cues to replace visual prose where possible.
- Keep scenes playable. Do not overload with too many simultaneous SFX.
- Preserve the source chapter's sequence of events and emotional arc.
- All non-spoken directions must be bracketed.

CHAPTER TO ADAPT:
${src}

Output ONLY the full-cast audio drama script. No commentary.`;

    case 'sunocuesheet':
      return `You are creating a generative-audio cue sheet for a cinematic graphic audiobook segment.

MISSION:
Turn the chapter into audio directives that can guide a tool like Suno or another generative audio system. This is NOT a prose rewrite. It is a structured list of bracketed cues for music, mood, pacing, ambience, SFX, and spoken/narrated content.

STRICT RULES:
- ALL non-spoken directions must be in [brackets].
- Spoken dialogue/narration may be outside brackets after speaker labels.
- Keep cues short, clear, and audio-interpretable.
- Break the chapter into 6–12 audio segments.
- Each segment should include:
  [Segment title]
  [Mood]
  [Tempo]
  [Music style]
  [Atmosphere]
  [SFX]
  [Narrator direction]
  [Character voice direction]
  Spoken lines or narration excerpt
  [Transition]

FORMAT:

[SEGMENT 1: Title]
[Mood: ...]
[Tempo: ...]
[Music style: ...]
[Atmosphere: ...]
[SFX: ...]
[Narrator direction: ...]
NARRATOR:
...
CHARACTER:
...
[Transition: ...]

CHAPTER TO CONVERT:
${src}

Output ONLY the generative-audio cue sheet. No commentary.`;

    case 'voicebible':
      return `You are building a CHARACTER VOICE BIBLE for audio narration, full-cast production, or AI voice generation.

TASK:
Analyze the manuscript and extract every major and recurring character. Build a voice profile for each.

FORMAT:

# Character Voice Bible

## Character Name
ROLE IN STORY:
VOICE AGE / RANGE:
VOCAL TEXTURE:
PACE:
PITCH:
ACCENT / DIALECT:
EMOTIONAL BASELINE:
WHEN ANGRY:
WHEN AFRAID:
WHEN LYING:
WHEN INTIMATE / VULNERABLE:
SPEECH RHYTHM:
WORD CHOICE:
VERBAL HABITS:
DO NOT SOUND LIKE:
VOICE REFERENCES:
SAMPLE LINE 1:
SAMPLE LINE 2:
SAMPLE LINE 3:
CASTING NOTE:

RULES:
- Use evidence from the manuscript.
- Do not invent accents unless strongly implied.
- Characters must sound distinct from one another.
- Include narrator voice guidance at the top.
- Include minor characters only if they have memorable speech or recurring function.

FULL MANUSCRIPT:
${src}

Output ONLY the character voice bible. No commentary.`;

    case 'podcastadaptation':
      if (nf) {
        return `You are adapting a nonfiction book into a narrative podcast episode or limited-series plan.

TASK:
Create a podcast adaptation package.

FORMAT:
# Podcast Adaptation

SERIES TITLE:
LOG LINE:
HOST VOICE:
TARGET LISTENER:
EPISODE COUNT:

## Episode Plan
For each episode:
EPISODE TITLE:
HOOK:
CORE ARGUMENT / STORY:
SCENES / SEGMENTS:
INTERVIEW OR ARCHIVAL MOMENTS:
SOUND DESIGN:
CLIFFHANGER / NEXT EPISODE PULL:

## Episode 1 Full Script
Write a full opening episode script with:
- cold open
- host intro
- scene setup
- narration blocks
- suggested clips or quotes
- transitions
- closing CTA

RULES:
- Build from the manuscript's actual thesis, people, events, and evidence.
- Do not invent sources.
- If an interview would be useful, label it [Suggested interview].
- Keep it production-ready.

FULL MANUSCRIPT:
${src}

Output ONLY the podcast adaptation. No commentary.`;
      }
      return `You are adapting a novel into a fiction podcast / serialized audio show package.

TASK:
Create a podcast adaptation plan and full Episode 1 script.

FORMAT:
# Fiction Podcast Adaptation

SHOW TITLE:
LOGLINE:
SERIES ENGINE:
NARRATION STYLE:
CAST NEEDS:
SOUND WORLD:
EPISODE COUNT:

## Episode Plan
For each episode:
EPISODE TITLE:
SOURCE CHAPTERS:
CORE EVENTS:
CHARACTER TURN:
AUDIO SET PIECES:
CLIFFHANGER:

## Episode 1 Full Script
Use full-cast audio drama format with narrator, character dialogue, ambience, SFX, and music cues.

FULL MANUSCRIPT:
${src}

Output ONLY the podcast adaptation. No commentary.`;

    case 'traileraudio':
      return `You are writing a 60–90 second cinematic AUDIO TRAILER for a book.

FORMAT:
# Audio Trailer Script

DURATION:
VOICEOVER STYLE:
MUSIC STYLE:
SOUND WORLD:

[0:00–0:05]
[Music cue:]
[SFX:]
VOICEOVER:

[0:05–0:15]
...

RULES:
- Build tension in 4–6 timed beats.
- Use 1–3 short quoted lines from the manuscript if available.
- Include a final title/author CTA.
- For nonfiction, sell the question/thesis.
- For fiction, sell the protagonist, stakes, and atmosphere.
- All SFX/music directions must be bracketed.
- Keep it performable within 90 seconds.

FULL MANUSCRIPT:
${src}

Output ONLY the trailer audio script. No commentary.`;

    /* =========================================================================
     * SCREEN & STAGE
     * ====================================================================== */

    case 'screenplay':
      return `You are a professional screenwriter adapting a chapter into feature-screenplay format.

FORMAT RULES:
- Scene headings: INT. or EXT., LOCATION - TIME OF DAY.
- Action lines: present tense, brief, visual, no internal thoughts unless voiced.
- Character names: ALL CAPS on first introduction with age if known.
- Dialogue: character name above dialogue, no quotation marks.
- Parentheticals: use sparingly.
- Convert internal thoughts to visual behavior, dialogue, or V.O.
- Each scene should feel shootable and cinematic.

CHAPTER TO CONVERT:
${src}

Output ONLY the screenplay-formatted scene(s). No commentary.`;

    case 'stageplay':
      return `You are a professional playwright adapting a chapter into stage-play format.

FORMAT RULES:
- Use ACT and SCENE headings.
- Stage directions in parentheses.
- Dialogue under character names.
- Consolidate locations to what can work on stage.
- Convert internal thoughts into aside, soliloquy, physical behavior, or dialogue.
- Add lighting and sound cues when useful.

CHAPTER TO CONVERT:
${src}

Output ONLY the stage-play formatted scene(s). No commentary.`;

    case 'tvpilot':
      return `You are a TV showrunner adapting the opening of a book into a one-hour TV pilot script.

FORMAT RULES:
- COLD OPEN: hook scene.
- ACT ONE through ACT FOUR with act breaks.
- TAG/STINGER: final reveal or cliffhanger.
- Use screenplay format.
- Compress the strongest early material into a pilot.
- Identify A-plot, B-plot, and series engine.
- End with a reason to watch episode 2.

SOURCE MATERIAL:
${src}

Output ONLY the TV pilot script. No commentary.`;

    case 'movietrailer':
      return `You are writing a cinematic book/movie trailer script.

TASK:
Create a 60–120 second trailer script from the manuscript.

FORMAT:
# Trailer Script

TRAILER TONE:
TARGET VIEWER:
MUSIC ARC:
VISUAL STYLE:

[0:00–0:08] SHOT 1
VISUAL:
VOICEOVER:
ON-SCREEN TEXT:
SFX:
MUSIC:

Continue with timed shots.

ENDING CARD:
TITLE:
AUTHOR:
CTA:

RULES:
- For fiction: sell protagonist, atmosphere, conflict, stakes, twist.
- For nonfiction: sell central question, shocking detail, stakes, authority.
- Use punchy fragments, not plot summary.
- Include 8–14 shots.
- Do not spoil the ending.

FULL MANUSCRIPT:
${src}

Output ONLY the trailer script. No commentary.`;

    case 'storyboard':
      return `You are creating a BOOK TRAILER STORYBOARD for AI video generation or human video production.

FORMAT EACH SHOT:
SHOT [#] — [duration]
VISUAL DESCRIPTION:
CAMERA / MOTION:
LIGHTING / COLOR:
CHARACTERS / OBJECTS:
ON-SCREEN TEXT:
VOICEOVER:
SFX:
MUSIC:
GENERATION PROMPT:

RULES:
- 10–16 shots total.
- Each shot should be visually distinct.
- Include camera language: push-in, wide shot, macro close-up, overhead, tracking, handheld.
- Make generation prompts detailed enough for image/video tools.
- Avoid spoilers.
- For nonfiction, visualize ideas through objects, locations, archival imagery, documents, maps, symbols.
- For fiction, visualize character, setting, mood, threat, desire, and stakes.

FULL MANUSCRIPT:
${src}

Output ONLY the storyboard. No commentary.`;

    case 'shotlist':
      return `You are creating a scene-by-scene cinematic shot list from a prose chapter.

FORMAT:
SCENE:
PURPOSE:
LOCATION:
MOOD:
SHOT LIST:
1. SHOT TYPE:
   CAMERA:
   ACTION:
   SOUND:
   NOTES:
2. ...

RULES:
- Focus on what can be filmed.
- Include wide/medium/close-up coverage.
- Mark important props, gestures, and visual motifs.
- Convert interiority into behavior or camera emphasis.
- Keep it practical for video generation or indie production.

CHAPTER TO CONVERT:
${src}

Output ONLY the shot list. No commentary.`;

    case 'directorstreatment':
      return `You are writing a director's treatment for adapting this manuscript.

FORMAT:
# Director's Treatment

LOGLINE:
ADAPTATION FORMAT:
VISUAL LANGUAGE:
COLOR PALETTE:
CAMERA STYLE:
SOUND / MUSIC:
TONE:
THEMATIC CORE:
KEY CHARACTERS:
KEY LOCATIONS:
5 SIGNATURE SEQUENCES:
CASTING ARCHETYPES:
COMPARABLE FILMS / SHOWS:
WHY THIS ADAPTATION WORKS:
RISKS / CHALLENGES:
FINAL PITCH:

RULES:
- Be specific to the manuscript.
- Do not write generic film-school language.
- Name concrete visual motifs and set pieces.
- For nonfiction, explain how the argument becomes visual drama.

FULL MANUSCRIPT:
${src}

Output ONLY the director's treatment. No commentary.`;

    /* =========================================================================
     * VISUAL / SEQUENTIAL ART
     * ====================================================================== */

    case 'graphicnovel':
      return `You are a graphic novel writer adapting a prose chapter into a visual script.

FORMAT RULES:
- PAGE X.
- PANEL X: visual description, composition, angle, lighting.
- CAPTION: narration boxes.
- DIALOGUE: Character: "line".
- SFX: sound effects in bold caps.
- Aim for 4–6 panels per page.
- Mark splash pages for major moments.
- Include color/mood notes.

CHAPTER TO CONVERT:
${src}

Output ONLY the graphic-novel script. No commentary.`;

    case 'comicissue':
      return `You are adapting the chapter into a monthly American comic-book issue script.

FORMAT:
# Comic Issue Script

ISSUE TITLE:
PAGE COUNT:
COVER IMAGE CONCEPT:
RECAP BOX:

PAGE 1
Panel 1:
Visual:
Caption:
Dialogue:
SFX:
Panel 2:
...

RULES:
- Target 20–24 comic pages.
- Use page turns for reveals.
- Include at least one splash or half-page panel if the material supports it.
- Keep captions concise.
- Dialogue must fit balloons.
- End with a final-page hook.

CHAPTER TO CONVERT:
${src}

Output ONLY the comic issue script. No commentary.`;

    case 'mangachapter':
      return `You are adapting the chapter into a manga-style chapter script.

FORMAT:
# Manga Chapter Script

CHAPTER TITLE:
PAGE COUNT:
VISUAL STYLE:
TONAL REFERENCES:

PAGE 1
Panel 1:
Composition:
Emotion:
Dialogue:
SFX:
Tone / pacing:

RULES:
- Use cinematic black-and-white visual storytelling.
- Use close-ups, reaction panels, silence panels, speed/action lines where appropriate.
- Save major reveals for page turns.
- Dialogue should be sparse and punchy.
- Include chibi/comic-relief beats only if tone supports it.
- End with a strong page-turn hook.

CHAPTER TO CONVERT:
${src}

Output ONLY the manga chapter script. No commentary.`;

    case 'visualnovel':
      return `You are adapting a prose chapter into a visual novel scene script.

FORMAT:
# Visual Novel Script

SCENE TITLE:
BACKGROUND:
MUSIC:
AMBIENCE:
SPRITES:
VARIABLES / FLAGS:

[BG: location]
[MUSIC: cue]
[SFX: cue]

CHARACTER [expression]:
Dialogue.

NARRATION:
Narration.

CHOICE:
1. Option text
   - Result:
   - Flag change:
2. Option text
   - Result:
   - Flag change:

RULES:
- Preserve the chapter's core events.
- Create meaningful choices only where the source supports them.
- Include sprite/emotion direction.
- Use narration sparingly.
- Track variables such as trust, suspicion, romance, danger, clue_found.

CHAPTER TO CONVERT:
${src}

Output ONLY the visual novel script. No commentary.`;

    case 'interactivefiction':
      return `You are converting the manuscript into a branching interactive-fiction structure.

FORMAT:
# Interactive Fiction Branching Plan

CORE PREMISE:
PLAYER ROLE:
MAIN OBJECTIVE:
FAILURE STATE:
KEY VARIABLES:
- variable_name: meaning

## Opening Node
NODE ID:
TEXT:
CHOICES:
1. Choice text
   Leads to:
   Variable changes:
   Consequences:
2. ...

## Branch Map
List 12–20 nodes with choices, consequences, and endings.

ENDINGS:
- Good Ending:
- Bad Ending:
- Bittersweet Ending:
- Secret Ending:

RULES:
- Preserve the manuscript's main conflict and tone.
- Do not create random game mechanics; derive choices from the story.
- Choices should create moral, tactical, relational, or informational consequences.

FULL MANUSCRIPT:
${src}

Output ONLY the interactive-fiction branching plan. No commentary.`;

    case 'gamequestline':
      return `You are adapting the manuscript into a video-game questline.

FORMAT:
# Game Questline Adaptation

GAME GENRE:
PLAYER ROLE:
MAIN QUEST ARC:
CORE LOOP:
KEY LOCATIONS:
KEY NPCS:
FACTIONS:
ITEMS / CLUES:

## Quest 1: [Title]
Objective:
Quest giver:
Location:
Setup:
Tasks:
Complication:
Choice point:
Outcome:
Reward:
Narrative consequence:

Create 8–15 quests.

RULES:
- Preserve the story's major emotional and plot beats.
- Turn scenes into objectives and choices.
- Include side quests only if they deepen character/world.
- Include fail states and branching consequences.

FULL MANUSCRIPT:
${src}

Output ONLY the game questline. No commentary.`;

    /* =========================================================================
     * PUBLISHING & METADATA
     * ====================================================================== */

    case 'querysynopsis':
      if (nf) {
        return `You are a literary agent's assistant preparing a nonfiction book-proposal synopsis.

Write a 1–3 page synopsis covering:
1. Hook and thesis.
2. Structure and major arguments.
3. Evidence, case studies, or source base.
4. Audience and market.
5. Comparable titles and differentiation.
6. Conclusion of the book's argument.

RULES:
- Present tense.
- Professional, confident tone.
- No rhetorical questions.
- 500–900 words.

FULL MANUSCRIPT:
${src}

Output ONLY the synopsis. No commentary.`;
      }
      return `You are a literary agent's assistant preparing a query synopsis.

Write a 1–3 page synopsis covering:
1. Protagonist, situation, and inciting incident.
2. Rising complications and stakes.
3. Antagonistic force.
4. Major decisions and reversals.
5. Climax and resolution — reveal the ending.
6. Themes and comparable titles.

RULES:
- Present tense.
- Name only essential characters.
- No rhetorical questions.
- 500–900 words.

FULL MANUSCRIPT:
${src}

Output ONLY the synopsis. No commentary.`;

    case 'backcover':
      if (nf) {
        return `You are a KDP copywriter writing back-cover copy for a nonfiction book.

TASK:
Write 150–200 words of sales copy.

RULES:
- Open with a specific provocation or untold-story hook.
- Name the central claim.
- Include 3–4 concrete reader takeaways.
- Close with the intellectual/emotional payoff.
- No generic praise words like "compelling", "thought-provoking", or "deeply researched".
- Present tense. Aim for 170 words.

FULL MANUSCRIPT:
${src}

Output ONLY the back-cover copy. No title or commentary.`;
      }
      return `You are a KDP copywriter writing back-cover copy for a novel.

TASK:
Write 150–200 words of sales copy.

RULES:
- Open with a hook that drops the reader into the situation.
- Name the protagonist.
- Show the inciting wound/choice.
- State the stakes.
- Close with a punchy promise line.
- Do not spoil the ending.
- Present tense. Aim for 170 words.

FULL MANUSCRIPT:
${src}

Output ONLY the back-cover copy. No title or commentary.`;

    case 'kdpmetadata':
      return `You are a self-publishing metadata strategist creating a complete KDP metadata pack.

FORMAT:
# KDP Metadata Pack

## Title Options
Give 10 title options with one-line rationale.

## Subtitle Options
Give 10 subtitle options.

## Recommended Final Title / Subtitle
Title:
Subtitle:
Why:

## Short Description
50–80 words.

## Long Amazon Description
300–500 words using clean sales formatting.

## HTML-Ready Amazon Description
Use simple Amazon-safe HTML: <b>, <br>, no unsupported styling.

## 7 Keyword Slots
Each slot should be a phrase cluster, not a single word.
1.
2.
3.
4.
5.
6.
7.

## BISAC / Category Suggestions
List 5–8 likely categories with rationale.

## Comparable Titles
List 5 comps with why each is relevant.

## Reader Promise
One sentence.

## Audience
Primary:
Secondary:

## Content Warnings / Reader Advisory
If applicable.

## A+ Content Angles
5 module ideas.

RULES:
- Be specific to the manuscript.
- Avoid generic keyword stuffing.
- For fiction, emphasize genre, trope, mood, stakes.
- For nonfiction, emphasize problem, audience, benefit, authority, topic.

FULL MANUSCRIPT:
${src}

Output ONLY the KDP metadata pack. No commentary.`;

    case 'amazonpage':
      return `You are creating a complete Amazon product-page copy package.

FORMAT:
# Amazon Product Page

## Hook Headline
One line.

## Short Product Description
100–150 words.

## Full Product Description
350–600 words.

## Bullet Points
5 sales bullets.

## Editorial Review Blurbs
5 short review-style blurbs, clearly labeled as draft copy.

## "From the Publisher" Copy
150–250 words.

## Reader Promise
One sentence.

## Best For Readers Who Like
8 bullets.

## Search Terms / Keywords
20 phrases.

RULES:
- No fake claims of awards, bestseller status, or real reviews.
- Make it commercially sharp.
- Do not spoil fiction endings.
- Nonfiction should sell the reader transformation or knowledge gain.

FULL MANUSCRIPT:
${src}

Output ONLY the Amazon product-page package. No commentary.`;

    case 'apluscontent':
      return `You are writing Amazon A+ Content copy and visual direction.

FORMAT:
# Amazon A+ Content Package

## Module 1: Hero Banner
Headline:
Subheadline:
Visual prompt:

## Module 2: Problem / Promise
Headline:
Body:
Visual prompt:

## Module 3: Key Themes or Takeaways
3–5 cards:
- Card title:
- Body:
- Visual prompt:

## Module 4: Quote / Pull Line
Quote:
Visual prompt:

## Module 5: Author / Imprint
Headline:
Body:
Visual prompt:

## Module 6: Comparison / Series Panel
If applicable.

RULES:
- A+ copy should be brief and visual.
- Each visual prompt should be useful for image generation/design.
- Do not invent awards or fake reviews.

FULL MANUSCRIPT:
${src}

Output ONLY the A+ content package. No commentary.`;

    case 'sellSheet':
      return `You are creating a one-page sell sheet for bookstores, libraries, events, and wholesale outreach.

FORMAT:
# Sell Sheet

TITLE:
SUBTITLE:
AUTHOR:
GENRE / CATEGORY:
FORMAT:
ISBN:
PRICE:
PUBLICATION DATE:
DISTRIBUTOR:
TRIM SIZE:
PAGE COUNT:

## One-Sentence Pitch

## Back-Cover-Style Description
150–200 words.

## Key Selling Points
5 bullets.

## Target Audience

## Comparable Titles

## Author Bio
75–100 words.

## Ordering Information
Use placeholders where unknown.

## Contact / Media
Use placeholders.

RULES:
- Professional and bookstore-friendly.
- Use placeholders for missing metadata.
- Specific selling points, not generic praise.

FULL MANUSCRIPT:
${src}

Output ONLY the sell sheet. No commentary.`;

    case 'pressrelease':
      return `You are writing a professional book launch press release.

FORMAT:
FOR IMMEDIATE RELEASE

HEADLINE:
SUBHEADLINE:

CITY, STATE — [Date] — [Lead paragraph]

BODY:
- What the book is.
- Why it matters now.
- Who it is for.
- What makes it distinct.
- Author quote.
- Publishing details.

ABOUT THE AUTHOR:
ABOUT THE PUBLISHER:
AVAILABILITY:
MEDIA CONTACT:

RULES:
- No fake endorsements, bestseller claims, or awards.
- Keep it newsy, not hype-heavy.
- Include placeholders for date, publisher, ISBN, links, and contact info.

FULL MANUSCRIPT:
${src}

Output ONLY the press release. No commentary.`;

    /* =========================================================================
     * MARKETING & LAUNCH
     * ====================================================================== */

    case 'keyquotes':
      return `You are curating pull quotes from a manuscript for social media, website, newsletters, and promotional graphics.

TASK:
Extract 15–25 standout quotes.

RULES:
- Quote VERBATIM.
- 8–40 words each.
- Self-contained.
- Spread across the manuscript.
- Identify source if possible.
- Exclude dialogue tags.

FORMAT:
> "[quote]"
— [Character/Narrator/Chapter]

FULL MANUSCRIPT:
${src}

Output ONLY the quote list. No commentary.`;

    case 'sampleextract':
      if (nf) {
        return `You are preparing a lead-magnet sample of a nonfiction book.

TASK:
Produce a polished sample consisting of:
1. Introduction/preface if present, or adapted opening setup.
2. First chapter in full.
3. Opening of the next chapter ending on a hook.

RULES:
- Use only manuscript content.
- Light polish only.
- Add placeholders for Amazon/newsletter links.
- End with a CTA to continue the full book.

FULL MANUSCRIPT:
${src}

Output ONLY the sample extract. No commentary.`;
      }
      return `You are preparing a lead-magnet sample of a novel.

TASK:
Produce a polished sample consisting of:
1. First chapter in full.
2. Second chapter in full if available.
3. Opening pages of the third chapter ending on a hook.

RULES:
- Use only manuscript content.
- Light polish only.
- Do not rewrite the author's voice.
- Add placeholders for Amazon/newsletter links.
- End with a CTA to continue.

FULL MANUSCRIPT:
${src}

Output ONLY the sample extract. No commentary.`;

    case 'social30':
      return `You are creating a 30-day social media launch campaign for a book.

FORMAT:
# 30-Day Social Campaign

For each day:
DAY:
PLATFORM:
POST TYPE:
HOOK:
CAPTION:
VISUAL / GRAPHIC IDEA:
SHORT VIDEO IDEA:
CTA:
HASHTAGS:

RULES:
- Mix awareness, excerpts, quotes, behind-the-scenes, reader questions, reviews, preorder, launch, and post-launch momentum.
- Include at least 8 short-form video concepts.
- Include at least 6 quote graphic concepts.
- Include at least 5 reader-engagement prompts.
- Do not invent fake reviews.
- For fiction, sell mood/tropes/stakes.
- For nonfiction, sell problem/insight/transformation.

FULL MANUSCRIPT:
${src}

Output ONLY the 30-day campaign. No commentary.`;

    case 'booktokpack':
      return `You are creating a BookTok / Instagram Reel / YouTube Shorts script pack.

FORMAT:
# Short-Form Video Script Pack

Create 20 scripts. For each:
TITLE:
HOOK TEXT ON SCREEN:
VIDEO CONCEPT:
SCRIPT / VOICEOVER:
B-ROLL / VISUALS:
CAPTION:
CTA:
HASHTAGS:
BEST FOR: TikTok / Reels / Shorts

RULES:
- Hooks must be punchy and specific.
- Scripts should be 15–45 seconds.
- Include some author-facing hooks, some reader-facing hooks, some quote hooks, some trope/theme hooks.
- Do not spoil major fiction endings.
- For nonfiction, use surprising claims and concrete facts.

FULL MANUSCRIPT:
${src}

Output ONLY the script pack. No commentary.`;

    case 'newsletterlaunch':
      return `You are writing an author newsletter launch sequence.

FORMAT:
# Newsletter Launch Sequence

EMAIL 1 — Announcement / Cover Reveal
Subject lines: 5 options
Preview text:
Email body:

EMAIL 2 — Behind the Book
Subject lines:
Preview text:
Email body:

EMAIL 3 — Excerpt / Sample
Subject lines:
Preview text:
Email body:

EMAIL 4 — Launch Day
Subject lines:
Preview text:
Email body:

EMAIL 5 — Review Request / Thank You
Subject lines:
Preview text:
Email body:

EMAIL 6 — Last Call / Momentum
Subject lines:
Preview text:
Email body:

RULES:
- Warm, authorial, not corporate.
- Include placeholders for links.
- For fiction, emphasize emotional hook and atmosphere.
- For nonfiction, emphasize problem, insight, and reader payoff.

FULL MANUSCRIPT:
${src}

Output ONLY the newsletter sequence. No commentary.`;

    case 'adcopy':
      return `You are creating an ad copy pack for paid book promotion.

FORMAT:
# Ad Copy Pack

## Amazon Ads
20 keyword phrases.
10 Sponsored Product headline-style hooks.

## Facebook / Instagram Ads
10 primary text variants.
10 headlines.
10 descriptions.

## BookBub-Style Hooks
10 variants.

## A/B Test Angles
List 8 different campaign angles:
- Angle:
- Audience:
- Copy:
- Visual idea:

RULES:
- No fake awards or false claims.
- Keep copy short and hook-driven.
- Fiction: genre/trope/stakes/atmosphere.
- Nonfiction: problem/promise/credibility/specific insight.

FULL MANUSCRIPT:
${src}

Output ONLY the ad copy pack. No commentary.`;

    case 'arcreview':
      return `You are creating an ARC / reviewer outreach packet.

FORMAT:
# ARC / Review Request Packet

## ARC Invitation Email
Subject lines:
Email body:

## Follow-Up Email
Subject lines:
Email body:

## Review Reminder Email
Subject lines:
Email body:

## Reviewer One-Sheet
Title:
Author:
Genre:
Content warnings:
Comparable titles:
Short description:
Ideal reader:
Review talking points:
Quote prompts:
Where to review:

## Social Share Copy
10 optional posts reviewers can adapt.

RULES:
- Do not pressure reviewers.
- Do not ask for only positive reviews.
- Keep it professional and warm.
- Include placeholders for links and dates.

FULL MANUSCRIPT:
${src}

Output ONLY the ARC packet. No commentary.`;

    /* =========================================================================
     * READER / EDUCATION
     * ====================================================================== */

    case 'bookclub':
      return `You are writing a book-club discussion guide.

FORMAT:
# ${bookTitleFromPrompt()} — Book Club Discussion Guide

## Opening the Conversation
3–4 accessible questions.

## Themes & Craft / Key Arguments
5–7 deeper questions referencing specific characters, scenes, claims, or chapters.

## Ending / Takeaway
3–4 questions about resolution, meaning, or reader response.

## Further Reading
5 paired recommendations with rationale.

RULES:
- No yes/no questions.
- Make each question specific to the manuscript.
- For fiction, discuss character decisions, theme, structure, symbolism, ending.
- For nonfiction, discuss thesis, evidence, counterarguments, application.

FULL MANUSCRIPT:
${src}

Output ONLY the discussion guide. No commentary.`;

    case 'studyguide':
      return `You are producing a per-chapter study guide entry.

FORMAT:
CHAPTER:
## Learning Objectives
3–5 bullets.

## Key Concepts
4–6 terms with definitions.

## Reflection Prompts
3 questions.

## Action Items
2–3 concrete actions.

## Going Deeper
2–3 recommended resources or topics.

RULES:
- Tie everything to this chapter.
- Use specific names/concepts from the chapter.
- For fiction, make it literary/reading-analysis focused.
- For nonfiction, make it learning/application focused.

CHAPTER TO ANALYZE:
${src}

Output ONLY the study-guide entry. No commentary.`;

    case 'workbook':
      return `You are converting a chapter into a practical workbook section.

FORMAT:
# Workbook Section: [Chapter Title]

## Quick Recap
100–150 words.

## Core Lesson / Theme

## Reflection Exercise
Prompt:
Writing space:
[Leave lines or bullets for response.]

## Practical Exercise
Step 1:
Step 2:
Step 3:

## Checklist
- [ ] Item
- [ ] Item
- [ ] Item

## Journal Prompts
1.
2.
3.

## Commitment / Next Step
"By [date], I will..."

RULES:
- Nonfiction: create action-based exercises.
- Fiction: create reader reflection, theme, character, and craft exercises.
- Do not become generic self-help.
- Use the chapter's actual material.

CHAPTER TO CONVERT:
${src}

Output ONLY the workbook section. No commentary.`;

    case 'facilitatorguide':
      return `You are creating a facilitator / teacher guide for a chapter.

FORMAT:
# Facilitator Guide: [Chapter Title]

SESSION LENGTH:
AUDIENCE:
OBJECTIVES:
MATERIALS:

## Opening Activity
Timing:
Instructions:

## Discussion Flow
Question 1:
Facilitator note:
Follow-up:

## Main Activity
Timing:
Instructions:
Debrief:

## Key Teaching Points
- 
- 
- 

## Common Participant Responses / Challenges
Challenge:
How to respond:

## Closing Reflection
## Optional Homework

RULES:
- Make it practical for a live group.
- Include timing.
- Include facilitator notes, not just questions.
- For fiction, focus on reading discussion and interpretation.
- For nonfiction/training, focus on application and skill-building.

CHAPTER TO CONVERT:
${src}

Output ONLY the facilitator guide. No commentary.`;

    case 'quizpack':
      return `You are creating a quiz and assessment pack for a chapter.

FORMAT:
# Quiz / Assessment Pack: [Chapter Title]

## Multiple Choice
10 questions. Include answer key and rationale.

## Short Answer
5 questions with model answers.

## Discussion Questions
5 questions.

## Applied Scenario / Case Study
Scenario:
Questions:
Model response:

## Answer Key
List all answers clearly.

RULES:
- Questions must test real chapter content.
- Avoid obvious or trick questions.
- For fiction, assess plot, character, theme, symbolism, and craft.
- For nonfiction, assess concepts, application, evidence, and reasoning.

CHAPTER TO CONVERT:
${src}

Output ONLY the quiz pack. No commentary.`;

    case 'glossarytimeline':
      return `You are extracting a glossary, timeline, and map from the manuscript.

FORMAT:
# Glossary / Timeline / Relationship Map

## Glossary
Term:
Definition:
Where it appears / why it matters:

## People / Characters
Name:
Role:
Relationships:
Importance:

## Locations
Location:
Description:
Importance:

## Timeline
Chronological event:
Approximate time/date:
Source chapter:
Importance:

## Organizations / Factions
Name:
Purpose:
Members:
Conflict:

## Relationship Map
Use bullet hierarchy to show connections.

RULES:
- Extract from manuscript only.
- If uncertain, mark [inferred].
- For fiction, include character/location/faction logic.
- For nonfiction, include people/events/organizations/concepts.

FULL MANUSCRIPT:
${src}

Output ONLY the glossary/timeline/map. No commentary.`;

    /* =========================================================================
     * FICTION IP EXPANSION
     * ====================================================================== */

    case 'seriesbible':
      return `You are creating a professional fiction SERIES BIBLE from a manuscript.

FORMAT:
# Series Bible

## Series Premise
## Series Engine
"They must [objective] before [deadline] or else [consequence]."

## Book 1 Summary
## World Rules
## Timeline
## Major Characters
For each:
- Role
- Motivation
- Wound
- Secret
- Arc
- Relationships
- Voice
- Status at end

## Locations
## Factions / Institutions
## Magic / Tech / Supernatural Rules if applicable
## Open Threads
## Resolved Threads
## Deaths / Losses
## Secrets Revealed
## Objects / Symbols
## Book 2 Hooks
## Long-Term Series Questions
## Continuity Warnings

RULES:
- Extract from manuscript.
- Mark uncertain items as [inferred].
- Do not invent a totally different series.
- Be useful for writing future books.

FULL MANUSCRIPT:
${src}

Output ONLY the series bible. No commentary.`;

    case 'characterbible':
      return `You are creating a character bible from a manuscript.

FORMAT:
# Character Bible

For each major and recurring character:

## Character Name
Role:
First appearance:
Physical impression:
Core desire:
Core fear:
Wound:
Secret:
Contradiction:
Arc:
Key relationships:
Voice / speech pattern:
Behavioral tells:
Important scenes:
Status at end:
Future potential:

RULES:
- Use manuscript evidence.
- Include minor characters only if plot-relevant.
- Separate known facts from inferred traits.
- Focus on continuity usefulness.

FULL MANUSCRIPT:
${src}

Output ONLY the character bible. No commentary.`;

    case 'worldbible':
      return `You are creating a world bible from a manuscript.

FORMAT:
# World Bible

## Core World Premise
## Rules of Reality
## History
## Geography / Locations
## Institutions
## Social Order
## Culture
## Technology / Magic / Supernatural System
## Economy / Power Structure
## Laws / Taboos
## Factions
## Symbols / Objects
## Continuity Rules
## Unanswered World Questions
## Future Expansion Possibilities

RULES:
- Extract from manuscript.
- Mark [inferred] when necessary.
- Explain what must remain consistent in future books.

FULL MANUSCRIPT:
${src}

Output ONLY the world bible. No commentary.`;

    case 'sequelroadmap':
      return `You are creating a sequel roadmap from a completed manuscript.

FORMAT:
# Sequel Roadmap

## Current Ending State
## Open Threads
## Character Arcs Still Unfinished
## Threats Remaining
## New Complications Implied
## Book 2 Premise Options
Give 5 options:
- Title idea
- Logline
- Central conflict
- Character arc
- Stakes
- Ending hook

## Book 3 / Book 4 Escalation
## Series Theme Evolution
## What NOT to repeat
## Best Recommended Direction

RULES:
- Build from the manuscript's actual ending and open questions.
- Do not reset character growth.
- Escalate logically.

FULL MANUSCRIPT:
${src}

Output ONLY the sequel roadmap. No commentary.`;

    case 'spinoffideas':
      return `You are creating spin-off and expansion ideas from a manuscript.

FORMAT:
# Spin-Off Ideas

Create 12 ideas across:
- Side-character novel
- Prequel
- Sequel novella
- Anthology story
- Villain origin
- Companion nonfiction/artifact
- Alternate POV retelling
- Audio drama special

For each:
TITLE:
FORMAT:
LOGLINE:
SOURCE CHARACTER / THREAD:
WHY IT WORKS:
RISK:
OPENING SCENE:
SERIES VALUE:

RULES:
- Use characters, places, or threads already present.
- Do not invent unrelated stories.
- Prioritize commercially interesting ideas.

FULL MANUSCRIPT:
${src}

Output ONLY the spin-off idea list. No commentary.`;

    case 'pitchdeck':
      return `You are creating an adaptation pitch deck outline for film, TV, audio, or game producers.

FORMAT:
# Adaptation Pitch Deck Outline

SLIDE 1: Title / Logline
SLIDE 2: The Hook
SLIDE 3: Why Now
SLIDE 4: Story World
SLIDE 5: Main Character(s)
SLIDE 6: Conflict / Stakes
SLIDE 7: Tone & Visual Style
SLIDE 8: Comparable Titles
SLIDE 9: Season / Film / Audio Structure
SLIDE 10: Target Audience
SLIDE 11: Set Pieces
SLIDE 12: Franchise Potential
SLIDE 13: Closing Pitch

For each slide:
- Headline
- Body copy
- Visual direction
- Presenter note

RULES:
- Specific to the manuscript.
- Commercial and adaptation-minded.
- No fake data or claims.

FULL MANUSCRIPT:
${src}

Output ONLY the pitch deck outline. No commentary.`;

    /* =========================================================================
     * CONTENT REPURPOSE
     * ====================================================================== */

    case 'chapsummaries':
      if (nf) {
        return `You are writing a chapter summary for a nonfiction manuscript.

FORMAT:
CHAPTER TITLE:
ONE-LINE HOOK:
KEY TAKEAWAYS:
- 
- 
- 
MEMORABLE DETAIL:
APPLICATION:

RULES:
- Be specific.
- Name people, dates, places, terms, or claims if present.
- Each bullet should be concrete.

CHAPTER TO SUMMARIZE:
${src}

Output ONLY the summary. No commentary.`;
      }
      return `You are writing a chapter summary for a novel.

FORMAT:
CHAPTER TITLE:
ONE-LINE HOOK:
KEY BEATS:
-
-
-
CLIFFHANGER / FORWARD PULL:

RULES:
- Use character names.
- Report what happens.
- Do not editorialize.
- Do not spoil later chapters.

CHAPTER TO SUMMARIZE:
${src}

Output ONLY the summary. No commentary.`;

    case 'blogseries':
      if (nf) {
        return `You are converting a nonfiction book into a blog-post series.

TASK:
Produce 10–15 standalone 800–1200 word blog posts.

FORMAT EACH:
---
POST #[N]: [SEO headline]
META DESCRIPTION:
TAGS:
---
Body with H2 subheadings.
CTA:
---

RULES:
- Each post anchors on one argument, case study, or insight.
- Use specific details from the manuscript.
- Close with a book CTA.
- Headlines should be specific and clickable.

FULL MANUSCRIPT:
${src}

Output ONLY the blog-post series. No commentary.`;
      }
      return `You are converting a novel into behind-the-book blog/article content.

TASK:
Produce 10–12 standalone posts that promote the novel without spoiling it.

Possible types:
- Character study
- World-building essay
- Craft essay
- Theme exploration
- Playlist/inspiration
- Deleted material/backstory
- Setting deep dive

FORMAT EACH:
POST #:
TYPE:
TITLE:
TAGS:
BODY:
CTA:

RULES:
- Pull from actual characters, world, and themes.
- Avoid spoilers past the first few chapters.
- Keep posts useful for author websites/newsletters.

FULL MANUSCRIPT:
${src}

Output ONLY the post series. No commentary.`;

    case 'youtubeessay':
      return `You are adapting the manuscript into a long-form YouTube essay script.

FORMAT:
# YouTube Essay Script

TITLE:
THUMBNAIL TEXT OPTIONS:
HOOK:
INTRO:
SECTION 1:
B-ROLL:
SECTION 2:
B-ROLL:
SECTION 3:
B-ROLL:
CONCLUSION:
CTA:

RULES:
- For nonfiction, teach or reveal the central argument.
- For fiction, create behind-the-book, lore, theme, or character-analysis content without spoiling the ending.
- Include visual/B-roll suggestions.
- Use a conversational but intelligent narrator voice.
- Target 8–15 minutes.

FULL MANUSCRIPT:
${src}

Output ONLY the YouTube essay script. No commentary.`;

    case 'courseoutline':
      return `You are converting the manuscript into a mini-course outline.

FORMAT:
# Mini-Course Outline

COURSE TITLE:
TARGET STUDENT:
PROMISE:
LENGTH:
MODULES:

For each module:
MODULE TITLE:
LEARNING OBJECTIVE:
LESSONS:
1.
2.
3.
ACTIVITY:
DOWNLOAD / WORKSHEET:
ASSESSMENT:
CTA / NEXT STEP:

RULES:
- Best for nonfiction/training/self-help/reference books.
- Use manuscript concepts.
- Do not invent credentials or unsupported claims.
- Make it practical enough to build in TalentLMS, LearnDash, Teachable, or a simple PDF course.

FULL MANUSCRIPT:
${src}

Output ONLY the mini-course outline. No commentary.`;

    case 'execsummary':
      return `You are creating an executive summary of the manuscript.

FORMAT:
# Executive Summary

## One-Paragraph Overview
## Core Thesis / Story Premise
## Key Points / Major Beats
## Audience
## Strengths
## Risks / Weaknesses
## Best Use Cases
## Recommended Next Steps
## 10-Bullet Summary

RULES:
- Be concise and specific.
- For nonfiction, emphasize argument and application.
- For fiction, emphasize premise, plot arc, theme, and market angle.
- Useful for agents, editors, collaborators, grant panels, or internal review.

FULL MANUSCRIPT:
${src}

Output ONLY the executive summary. No commentary.`;

    /* =========================================================================
     * NEW FORMATS v3
     * ====================================================================== */

    case 'fullcastscript':
      return `You are a professional audio-drama script adapter converting a prose chapter into a full-cast audiobook script.

FORMAT RULES:
- Open with a CAST LIST naming every character who speaks, plus NARRATOR.
- For each character, note their VOICE PROFILE: age range, accent if any, emotional baseline, vocal texture (e.g. "gravelly baritone", "bright alto").
- Convert all prose into either NARRATOR lines (description, action, internal thought) or CHARACTER DIALOGUE lines.
- Prefix each line: NARRATOR: / CHARACTER_NAME: with performance direction in [brackets].
- Add [SFX: description] where environmental or action sounds occur.
- Add [MUSIC CUE: mood/tempo] at major emotional transitions.
- Add [PAUSE: 1-beat] or [PAUSE: 2-beat] for dramatic timing.
- Add [WHISPER], [SHOUT], [SOTTO VOCE], [BREAKING], etc. as inline voice direction.
- Include page-turn / section transitions: [TRANSITION: scene shift].
- End with ESTIMATED NARRATION TIME at 150 wpm.

OUTPUT STRUCTURE:
## CAST LIST
[characters + voice profiles]

## SCENE [n]
[Formatted script lines]

## PRODUCTION NOTES
[Any special recording requirements]

SOURCE CHAPTER:
${src}

Output ONLY the full-cast script. No commentary.`;

    case 'podcastepisode':
      return `You are a narrative podcast producer breaking a book manuscript into an episodic serial format.

FORMAT RULES:
- Analyze the full manuscript and identify 8-12 natural episode break points.
- Each episode should be 15-25 minutes of listening (2,200-3,700 words spoken at 150 wpm).
- Break at CLIFFHANGERS — every episode must end on tension, a question, or a revelation.
- Each episode needs: COLD OPEN (hook from mid-action), INTRO ("Previously on…" + title card), BODY SEGMENTS (2-3 per episode), and OUTRO (teaser for next episode).
- Flag where HOST COMMENTARY could be inserted (context, background, thematic reflection).
- Note SOUND DESIGN opportunities: ambience, music beds, SFX stings.
- Include series-level metadata: series title suggestions, target audience, comparable podcasts.

OUTPUT STRUCTURE:
## SERIES OVERVIEW
[Title ideas, premise, episode count, target listener, comparable shows]

## EPISODE [n]: [Title]
### Cold Open
[Hook excerpt — in medias res or provocative line]
### Previously On…
[1-2 sentence recap if not Ep 1]
### Segment 1: [label]
[Content outline + approximate word count]
### Segment 2: [label]
[Content outline]
### Cliffhanger Ending
[Exact line or moment to cut on]
### Next Episode Teaser
[1-2 sentence preview]
### Sound Design Notes
[Ambience, music, SFX ideas]

FULL MANUSCRIPT:
${src}

Output ONLY the episode breakdown. No commentary.`;

    case 'graphicnovelpanel':
      return `You are a professional graphic novel scriptwriter adapting a prose chapter into panel-by-panel visual script format.

FORMAT RULES:
- Convert prose into PAGES (target 18-24 pages per chapter).
- Each page has 3-6 PANELS.
- For each panel specify: PANEL SIZE (full, half, third, quarter, splash), CAMERA ANGLE (wide, medium, close-up, bird's eye, worm's eye), ACTION (what is physically happening), CAPTION (narrator text if any), DIALOGUE (speech balloons with character name), SFX (sound effect lettering), and COLOR/MOOD (palette and lighting).
- Use SPLASH PAGES for major revelations or action climaxes.
- Control PAGE TURNS — the last panel on a right-hand page should create anticipation.
- Include GUTTER NOTES for panel transitions (smash cut, dissolve, time skip).
- Balance dialogue and visual storytelling — comics show more than they tell.

OUTPUT STRUCTURE:
## PAGE [n]
### Panel [n] — [size]
**Camera:** [angle/framing]
**Action:** [description]
**Caption:** [narrator text or empty]
**Dialogue:**
- CHARACTER: "text"
**SFX:** [if any]
**Color/Mood:** [palette note]

### Panel [n+1] — [size]
…

**PAGE TURN NOTE:** [anticipation hook]

SOURCE CHAPTER:
${src}

Output ONLY the panel script. No commentary.`;

    case 'blogserialpack':
      return `You are a content strategist converting a book manuscript into a serialized blog post series optimized for SEO and reader engagement.

FORMAT RULES:
- Break the manuscript into 8-15 standalone blog posts.
- Each post should work independently (a new reader can start anywhere) while rewarding serial readers.
- For each post provide: SEO TITLE (60 chars max, keyword-rich), META DESCRIPTION (155 chars max), EXCERPT HOOK (2-3 sentences that pull the reader in), BODY (800-1,500 words adapted from the manuscript — not just copy-pasted), INTERNAL LINKS (reference to other posts in the series), CTA (newsletter signup, book purchase, next post).
- Include KEYWORD TARGETS per post (2-3 long-tail keywords).
- Add SOCIAL SHARE COPY: a ready-to-post tweet/thread hook per post.
- The first post should be the strongest hook. The last post should drive to the book purchase.
- Adapt tone for web reading: shorter paragraphs, subheadings, bold key phrases.

OUTPUT STRUCTURE:
## SERIES OVERVIEW
[Series title, target keywords, publishing cadence recommendation]

## POST [n]: [SEO Title]
**Meta Description:** [155 chars max]
**Keywords:** [2-3 targets]
**Excerpt Hook:** [2-3 sentences]
**Body:**
[Adapted content]
**Internal Links:** [references to other posts]
**CTA:** [action item]
**Social Share:** [tweet-length hook]

FULL MANUSCRIPT:
${src}

Output ONLY the blog serialization pack. No commentary.`;

    case 'translationprep':
      return `You are a professional translation coordinator preparing a chapter-level reference sheet for literary translators.

FORMAT RULES:
- Identify every IDIOM, COLLOQUIALISM, and SLANG expression. For each, provide: the exact phrase, its meaning in context, and a suggested translation approach (literal, functional equivalent, or cultural substitution).
- Flag all CULTURAL REFERENCES (holidays, institutions, foods, brands, media references) with brief context notes.
- List all WORDPLAY, PUNS, and DOUBLE MEANINGS with the intended effect noted.
- Catalog all PROPER NOUNS: character names (with pronunciation guide), place names, organization names. Note which are real vs fictional.
- Note the REGISTER/TONE of each scene: formal, casual, intimate, comedic, tense, etc.
- Flag UNTRANSLATABLE PASSAGES and suggest approaches (footnote, adaptation, omission with note).
- Note any DIALECT or ACCENT rendering in the original and how it functions narratively.
- Include CHAPTER SUMMARY (3-4 sentences) for translator context.

OUTPUT STRUCTURE:
## CHAPTER SUMMARY
[3-4 sentence overview]

## PROPER NOUNS
| Name | Type | Pronunciation | Real/Fictional | Notes |

## IDIOMS & COLLOQUIALISMS
| Phrase | Meaning | Suggested Approach |

## CULTURAL REFERENCES
| Reference | Context | Notes |

## WORDPLAY & PUNS
| Passage | Intended Effect | Suggested Approach |

## TONE MAP
[Scene-by-scene register notes]

## UNTRANSLATABLE PASSAGES
[Flagged sections with approaches]

## DIALECT NOTES
[Any accent/dialect rendering]

SOURCE CHAPTER:
${src}

Output ONLY the translation prep sheet. No commentary.`;

    case 'readermagnet':
      return `You are a book marketing strategist creating a compelling reader magnet (free preview) from a manuscript.

FORMAT RULES:
- Create a STANDALONE reading experience of 2,000-4,000 words.
- Option A: Extract and polish the strongest opening chapters (if they hook immediately).
- Option B: Write a prequel scene that introduces the protagonist before the book's events.
- Option C: Extract a self-contained dramatic sequence from mid-book that works without full context.
- Choose whichever option creates the most compelling free sample.
- The excerpt MUST end on a cliffhanger or irresistible question that drives the reader to buy the full book.
- Add a CTA SECTION at the end: "[BOOK TITLE] is available now. [Purchase link placeholder]"
- Include a brief AUTHOR NOTE (2-3 sentences, warm and personal).
- Polish the prose for standalone readability — add any minimal context needed.
- For nonfiction: extract the single most actionable/surprising chapter and add a "This is just one of [X] strategies in [BOOK TITLE]" CTA.

OUTPUT STRUCTURE:
## [Title of the Reader Magnet]

[Polished excerpt or prequel scene]

---

## About This Preview
[Author note — 2-3 sentences]

## Continue Reading
[CTA with purchase link placeholder]

## Why This Excerpt
[1-2 sentence note to the author explaining why this passage was chosen]

FULL MANUSCRIPT:
${src}

Output ONLY the reader magnet content. No commentary.`;

    default:
      return '';
  }
}
