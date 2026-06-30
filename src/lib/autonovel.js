import { buildPovTenseBlock, SCENE_POV_RULES } from '@/lib/povTense';
import { isNonfictionProject } from '@/lib/manuscriptStats';
import { buildCondensedAuthorStyleBlock, loadAuthorStyle } from '@/lib/authorStylePrompt';
import { buildSetupConstraints, enforceChapterCount } from '@/lib/setupConstraints';
import { buildCraftInjection, getChapterOpeningInstruction, getChapterEndingInstruction } from '@/lib/proseQuality';
import { buildEroticaAuthorityBlocks } from '@/lib/eroticaAuthority';
import { MANDATORY_ENFORCEMENT_BLOCK } from '@/lib/enforcementBlock';
import { buildNonfictionBeatPrompt, nonfictionBeatSchema, NF_SECTION_MODES, NF_BEAT_TEMPLATES, detectNfTemplate, getChapterBeat } from '@/lib/nonfictionBeats';
import { buildAnthologySpiceBeatContext } from '@/lib/anthologyEngine';
import { buildTwistFoundationBlock, parseTwistsToMd } from '@/lib/plotTwists';
export { NF_SECTION_MODES, NF_BEAT_TEMPLATES, detectNfTemplate, getChapterBeat, nonfictionBeatSchema };
export { parseTwistsToMd };

const CHAPTER_TITLE_HYGIENE_BLOCK = `
═══ READER-FACING CHAPTER TITLE HYGIENE — MANDATORY ═══
The chapters array title field is PUBLIC-facing. It may appear in the book, the chapter queue, and exports.

DO NOT use outline mechanics, screenwriting/Save-the-Cat labels, act labels, spoiler labels, or drafting labels as chapter titles.

BANNED title patterns include, but are not limited to:
- Midpoint
- Twist 1 / Twist 2 / Twist 3
- Plot Point
- Pinch Point
- Break into Two / Break into Three
- Bad Guys Close In
- All Is Lost
- Dark Night of the Soul
- Finale
- Final Image
- Opening Image
- Catalyst
- Debate
- Fun and Games
- Executing the Plan
- Gathering the Team
- Dig Deep Down
- Part 1 / Part 2 / Part 3
- Any title that begins with structural labels such as "Act", "Twist", "Midpoint", "Beat", "Turn", "Climax", or "Finale"

Correct behavior:
- Put structural role in beat_summary, NOT title.
- Make title sound like a real chapter title from a published novel.
- Titles should be evocative, specific, subtle, and story-facing.
- Titles must not spoil twists, midpoint turns, betrayals, deaths, reveals, or act structure.
- Titles should use concrete story imagery, object motifs, locations, emotional subtext, or character-specific language.

Examples:
WRONG title: "Midpoint: An Audience with the Moon"
RIGHT title: "The Moonlit Door"

WRONG title: "Twist 2: The Daughter's Agenda"
RIGHT title: "The Note in Clara's Hand"

WRONG title: "Bad Guys Close In, Part 1"
RIGHT title: "The Locked Rehearsal Room"

WRONG title: "Dark Night of the Soul"
RIGHT title: "The Hour Before Dawn"

WRONG title: "Break into Three"
RIGHT title: "Ashes on the Threshold"

Every chapter still needs a structural function, but that function belongs inside beat_summary.
═══ END CHAPTER TITLE HYGIENE ═══
`;

const SCENE_BEAT_UNIQUENESS_BLOCK = `
═══ SCENE BEAT UNIQUENESS CONTRACT — MANDATORY ═══
Scene beats are NOT alternate drafts. They are sequential story movements.

For every chapter, each scene beat must represent a NEW unit of story action:
1. Scene 1 = setup/entry point for this chapter.
2. Scene 2 = escalation, complication, reversal, or consequence created by Scene 1.
3. Scene 3 = decision, fallout, discovery, confrontation, or exit hook created by Scene 2.
4. Later scenes continue the chain. They must not replay earlier beats.

ABSOLUTELY FORBIDDEN:
- Do not create multiple beats that restage the same arrival, meeting, interrogation, explanation, attack, escape, rehearsal, report, confession, heist, discovery, or reveal.
- Do not write "same scene from a different angle" unless POV mode explicitly requires it and the beat changes the actual plot state.
- Do not make Scene 2 a more detailed version of Scene 1.
- Do not make Scene 3 a tonal variation of Scene 2.
- Do not repeat the chapter premise in every beat.

CORRECT behavior:
- If Scene 1 is "Iris arrives at the institute and meets Pauline," Scene 2 must NOT be "Iris meets Pauline again and receives the same assignment." Scene 2 must be the consequence: first rehearsal pressure, Cross follow-up, Clara complication, Pauline's tactical offer, or a new discovery.
- If Scene 1 is "Zonk enters VR and accepts the vault quest," Scene 2 must NOT restart at the plaza or quest board. Scene 2 must continue into the vault complication, crash, or first real-world consequence.
- If a scene beat includes exposition, the next beat must dramatize consequences of that exposition, not explain it again.

Before returning JSON, silently perform this self-check:
- Can any beat be described as "another version of the previous beat"? If yes, merge them.
- Does every beat change location, power dynamic, information state, decision state, threat level, or relationship state? If no, replace it with a consequence beat.
- Does the final beat leave the chapter in a different story condition from the first beat? It must.

Return fewer, stronger unique beats rather than many overlapping beats. Three clean sequential beats are better than five repetitive alternates.
═══ END SCENE BEAT UNIQUENESS CONTRACT ═══
`;

export const BOOK_TYPES = ['fiction', 'nonfiction', 'anthology'];

export const GENRE_TAXONOMY = {
  fiction: {
    'Thriller': ['Suspense', 'Psychological Thriller', 'Dystopian Technothriller'],
    'Mystery': ['Cozy Mystery', 'Police Procedural', 'Whodunit'],
    'Crime': ['Noir', 'Heist', 'Legal Thriller'],
    'Horror': ['Cosmic Horror', 'Psychological Horror', 'Survival Horror', 'Body Horror', 'Gothic Horror', 'Industrial Horror'],
    'Romance': ['Contemporary Romance', 'Historical Romance', 'Paranormal Romance', 'Romantic Suspense', 'Romantic Comedy', 'Clean Romance', 'Dark Romance'],
    'Fantasy': ['Epic Fantasy', 'Dark Fantasy', 'Urban Fantasy', 'Magical Realism', 'Fairy Tale Retelling'],
    'Science Fiction': ['Space Opera', 'Cyberpunk', 'Dystopian', 'Post-Apocalyptic', 'Hard Sci-Fi', 'Military Sci-Fi'],
    'Literary Fiction': ['Coming-of-Age', 'Family Drama', 'Psychological Drama'],
    'Historical Fiction': ['Alternate History'],
    'Adventure': ['Action', 'Survival'],
    'Supernatural': ['Paranormal', 'Ghost Story'],
    'Western': [],
    'Steampunk': [],
    'Solarpunk': [],
    'Satire': ['Dark Comedy', 'Absurdist'],
    'Comedy': ['Romantic Comedy', 'Dark Comedy', 'Comedic Fantasy', 'Comedic Sci-Fi', 'Comedic Thriller (Caper)', 'Absurdist Fiction', 'Parody'],
    'Satirical Fiction': ['Social Satire', 'Political Satire'],
    'Young Adult': [],
    'Women\'s Fiction': [],
    'Faith-Based Fiction': [],
    'Erotica': [
      'Contemporary Erotica', 'Dark Erotica', 'BDSM / Power Dynamic',
      'Paranormal / Monster Romance', 'Reverse Harem', 'Taboo / Forbidden',
      'Age Gap', 'Office / Workplace', 'Billionaire / Power Fantasy',
      'MC / Biker Romance', 'Mafia / Dark Romance', 'Alien / Sci-Fi Erotica',
      'Fantasy Erotica', 'Historical Erotica', 'LGBTQ+ Erotica',
      'Menage / Polyamory', 'Enemies to Lovers', 'Forced Proximity',
      'Second Chance', 'Omegaverse',
    ],
  },
  nonfiction: {
    'True Crime': ['Cold Case', 'Serial Killer', 'Wrongful Conviction'],
    'History': ['Political History', 'Military History', 'Cultural History', 'Social History'],
    'Biography': ['Autobiography', 'Memoir', 'Humorous Memoir'],
    'Investigative Journalism': ['Exposé'],
    'Self-Help': ['Personal Development', 'Psychology', 'Relationships'],
    'Business': ['Entrepreneurship', 'Finance', 'Leadership'],
    'Science': ['Technology', 'Medicine', 'Environment'],
    'Philosophy': ['Ethics', 'Religion', 'Spirituality'],
    'Travel': ['Food', 'Culture'],
    'Education': ['Reference', 'How-To'],
    'Politics': ['Current Affairs', 'Social Commentary'],
    'Sports': ['Entertainment', 'Music', 'Film'],
    'Health & Wellness': ['Caregiving', 'Parenting'],
    'Personal Finance': [],
  },
};

// Flat lists derived from taxonomy for backward compatibility
export const FICTION_GENRES = Object.keys(GENRE_TAXONOMY.fiction);
export const NONFICTION_GENRES = Object.keys(GENRE_TAXONOMY.nonfiction);

export const GENRE_DEFAULTS = {
  Fantasy: { pov: 'third-close', tense: 'past', beat: 'Epic World-Building', chapters: 25, words: 100000, violence: 2 },
  'Science Fiction': { pov: 'third-close', tense: 'past', beat: 'Epic World-Building', chapters: 22, words: 90000, violence: 2 },
  Romance: { pov: 'third-close', tense: 'past', beat: 'Slow Burn Romance', chapters: 20, words: 75000, violence: 0 },
  Thriller: { pov: 'third-close', tense: 'past', beat: 'Tension-Driven', chapters: 25, words: 85000, violence: 2 },
  Mystery: { pov: 'first', tense: 'past', beat: 'Mystery Unravel', chapters: 22, words: 80000, violence: 1 },
  Horror: { pov: 'third-close', tense: 'present', beat: 'Tension-Driven', chapters: 20, words: 70000, violence: 3 },
  'Literary Fiction': { pov: 'third-close', tense: 'past', beat: 'Character Study', chapters: 18, words: 75000, violence: 1 },
  'Historical Fiction': { pov: 'third-close', tense: 'past', beat: 'Literary Atmospheric', chapters: 22, words: 85000, violence: 2 },
  'Young Adult': { pov: 'first', tense: 'present', beat: 'Fast-Paced Action', chapters: 20, words: 65000, violence: 1 },
  Erotica: { pov: 'third-close', tense: 'past', beat: 'Slow Burn Romance', chapters: 15, words: 50000, spice: 4, register: 2, violence: 0 },
  'Dark Romance': { pov: 'third-close', tense: 'past', beat: 'Tension-Driven', chapters: 20, words: 75000, spice: 3, register: 1, violence: 2 },
  'Paranormal Romance': { pov: 'third-close', tense: 'past', beat: 'Slow Burn Romance', chapters: 20, words: 75000, spice: 2, violence: 1 },
  Crime: { pov: 'first', tense: 'past', beat: 'Mystery Unravel', chapters: 22, words: 80000, violence: 3 },
  Adventure: { pov: 'third-close', tense: 'past', beat: 'Fast-Paced Action', chapters: 20, words: 75000, violence: 2 },
  Supernatural: { pov: 'third-close', tense: 'present', beat: 'Tension-Driven', chapters: 20, words: 72000, violence: 2 },
  Western: { pov: 'third-close', tense: 'past', beat: 'Literary Atmospheric', chapters: 20, words: 75000, violence: 2 },
  Steampunk: { pov: 'third-close', tense: 'past', beat: 'Epic World-Building', chapters: 22, words: 85000, violence: 2 },
  Solarpunk: { pov: 'third-close', tense: 'present', beat: 'Character Study', chapters: 18, words: 70000, violence: 0 },
  Satire: { pov: 'first', tense: 'past', beat: 'Dry Wit / Deadpan', chapters: 18, words: 65000, violence: 0 },
  'Satirical Fiction': { pov: 'first', tense: 'past', beat: 'Dark Comedy', chapters: 18, words: 65000, violence: 0 },
  Comedy: { pov: 'first', tense: 'past', beat: 'Screwball Comedy', chapters: 18, words: 65000, violence: 0 },
  'Romantic Comedy': { pov: 'first', tense: 'past', beat: 'Romantic Comedy', chapters: 20, words: 75000, violence: 0 },
  'Dark Comedy': { pov: 'first', tense: 'past', beat: 'Dark Comedy', chapters: 18, words: 65000, violence: 1 },
  'Comedic Fantasy': { pov: 'third-close', tense: 'past', beat: 'Absurdist / Surreal Comedy', chapters: 22, words: 80000, violence: 1 },
  'Comedic Sci-Fi': { pov: 'third-close', tense: 'past', beat: 'Absurdist / Surreal Comedy', chapters: 22, words: 80000, violence: 1 },
  'Humorous Memoir': { pov: 'nf-author', tense: 'past', structure: 'narrative', beat: 'Dry Wit / Deadpan', chapters: 18, words: 70000, violence: 0 },
  'Comedic Thriller (Caper)': { pov: 'third-close', tense: 'past', beat: 'Comic Caper / Heist Comedy', chapters: 22, words: 80000, violence: 1 },
  'Absurdist Fiction': { pov: 'third-close', tense: 'past', beat: 'Absurdist / Surreal Comedy', chapters: 18, words: 65000, violence: 0 },
  Parody: { pov: 'first', tense: 'past', beat: 'Screwball Comedy', chapters: 18, words: 65000, violence: 0 },
  Drama: { pov: 'third-close', tense: 'past', beat: 'Character Study', chapters: 20, words: 75000, violence: 1 },
  'Industrial Horror': { pov: 'third-close', tense: 'present', beat: 'Tension-Driven', chapters: 22, words: 80000, violence: 4 },
  'Dystopian Technothriller': { pov: 'third-close', tense: 'past', beat: 'Tension-Driven', chapters: 24, words: 90000, violence: 3 },
  'Clean Romance': { pov: 'third-close', tense: 'past', beat: 'Slow Burn Romance', chapters: 22, words: 75000, violence: 0 },
  "Women's Fiction": { pov: 'third-close', tense: 'past', beat: 'Character Study', chapters: 20, words: 78000, violence: 0 },
  'Faith-Based Fiction': { pov: 'third-close', tense: 'past', beat: 'Character Study', chapters: 22, words: 75000, violence: 0 },
  'Self-Help': { pov: 'nf-direct', tense: 'present', structure: 'prescriptive', chapters: 15, words: 55000, violence: 0 },
  Memoir: { pov: 'nf-author', tense: 'past', structure: 'narrative', chapters: 18, words: 70000, violence: 0 },
  Biography: { pov: 'nf-third', tense: 'past', structure: 'narrative', chapters: 20, words: 80000, violence: 0 },
  History: { pov: 'nf-third', tense: 'past', structure: 'narrative', chapters: 20, words: 85000, violence: 1 },
  'True Crime': { pov: 'nf-editorial', tense: 'mixed', structure: 'investigative', chapters: 20, words: 80000, violence: 2 },
  Business: { pov: 'nf-direct', tense: 'present', structure: 'prescriptive', chapters: 14, words: 50000, violence: 0 },
  'Health & Wellness': { pov: 'nf-direct', tense: 'present', structure: 'prescriptive', chapters: 15, words: 55000, violence: 0 },
  Science: { pov: 'nf-third', tense: 'present', structure: 'reference', chapters: 18, words: 70000, violence: 0 },
  Psychology: { pov: 'nf-editorial', tense: 'present', structure: 'reference', chapters: 16, words: 65000, violence: 0 },
  Philosophy: { pov: 'nf-third', tense: 'present', structure: 'reference', chapters: 16, words: 65000, violence: 0 },
  Travel: { pov: 'nf-author', tense: 'past', structure: 'narrative', chapters: 16, words: 60000, violence: 0 },
  Education: { pov: 'nf-direct', tense: 'present', structure: 'reference', chapters: 15, words: 55000, violence: 0 },
  Politics: { pov: 'nf-editorial', tense: 'present', structure: 'investigative', chapters: 18, words: 70000, violence: 0 },
  Sports: { pov: 'nf-editorial', tense: 'past', structure: 'narrative', chapters: 18, words: 70000, violence: 1 },
  Caregiving: { pov: 'nf-direct', tense: 'present', structure: 'prescriptive', chapters: 15, words: 55000, violence: 0 },
  'Investigative Journalism': { pov: 'nf-editorial', tense: 'mixed', structure: 'investigative', chapters: 20, words: 80000, violence: 1 },
  'Personal Finance': { pov: 'nf-direct', tense: 'present', structure: 'prescriptive', chapters: 14, words: 50000, violence: 0 },
};

export const FICTION_POV_MODES = {
  first: "First Person — 'I walked into the room.'",
  'third-close': "Third Person Close — 'She walked into the room, her heart pounding.'",
  'third-omni': "Third Person Omniscient — 'She walked into the room. She didn't know he was watching.'",
  'third-multi': 'Third Person Multi — Different POV characters per chapter.',
  'deep-first': "Deep First Person — No thought tags. The narration IS the character's inner voice.",
  second: "Second Person — 'You walk into the room.'",
  epistolary: 'Epistolary — Letters, diary entries, found documents.',
};

export const NONFICTION_POV_MODES = {
  'nf-author': 'Author Voice (I/we) — First person, the author speaks directly. Memoir, personal essays.',
  'nf-direct': "Direct Address (you) — Speaks to the reader. 'Here\'s what you need to do.' Self-help, how-to.",
  'nf-third': 'Third Person Narrative — Authoritative distance. Biography, history, science.',
  'nf-editorial': 'Editorial Mix — Part analysis, part storytelling. True crime, investigative, Gladwell-style.',
};

export const TENSE_OPTIONS = {
  past: "Past Tense — 'She walked.' Standard for most fiction and narrative nonfiction.",
  present: "Present Tense — 'She walks.' Immediate, urgent. YA, horror, self-help.",
  mixed: 'Mixed — Editorial present for analysis, historical past for events. Nonfiction only.',
};

export const POV_PRESETS_FICTION = [
  { id: 'intimate', label: 'Intimate / Contemporary', pov: 'third-close', tense: 'past', desc: "Closest to the character's heart.", examples: 'Stephen King, Colleen Hoover' },
  { id: 'confessional', label: 'Confessional / Diary', pov: 'first', tense: 'past', desc: 'Narrator tells their own story.', examples: 'Gone Girl, Gatsby' },
  { id: 'urgent', label: 'Urgent / YA', pov: 'first', tense: 'present', desc: 'Maximum immediacy.', examples: 'Hunger Games, Divergent' },
  { id: 'epic', label: 'Epic / Ensemble', pov: 'third-multi', tense: 'past', desc: 'Multiple viewpoints across chapters.', examples: 'Game of Thrones, Wheel of Time' },
  { id: 'cinematic', label: "Cinematic / God's Eye", pov: 'third-omni', tense: 'past', desc: 'Narrator sees everything.', examples: 'Lord of the Rings, Dune' },
  { id: 'horror', label: 'Immersive Horror', pov: 'third-close', tense: 'present', desc: 'Trapped, happening NOW.', examples: 'Horror, psychological thriller' },
  { id: 'experimental', label: 'Experimental', pov: 'second', tense: 'present', desc: 'Reader IS the character.', examples: 'Bright Lights Big City' },
];

export const POV_PRESETS_NF = [
  { id: 'selfhelp', label: 'Self-Help / How-To', pov: 'nf-direct', tense: 'present', desc: "'Here's what you need to do.'", examples: 'Atomic Habits, 4-Hour Workweek' },
  { id: 'memoir', label: 'Memoir', pov: 'nf-author', tense: 'past', desc: 'Your story, told by you.', examples: 'Educated, Becoming' },
  { id: 'biography', label: 'Biography / History', pov: 'nf-third', tense: 'past', desc: 'Authoritative distance.', examples: 'Walter Isaacson, Ken Burns' },
  { id: 'truecrime', label: 'True Crime', pov: 'nf-editorial', tense: 'mixed', desc: 'Part detective, part storyteller.', examples: 'In Cold Blood, Serial' },
  { id: 'narrative', label: 'Narrative Nonfiction', pov: 'nf-editorial', tense: 'mixed', desc: 'Story-driven analysis.', examples: 'Malcolm Gladwell, Michael Lewis' },
  { id: 'academic', label: 'Academic / Reference', pov: 'nf-third', tense: 'present', desc: 'Textbook authority.', examples: 'Textbooks, reference guides' },
];

export const BEAT_STYLES = [
  { id: 'tension', name: 'Tension-Driven', desc: 'Every chapter ends on a hook. Escalating stakes. Thriller/suspense pacing.' },
  { id: 'character', name: 'Character Study', desc: 'Internal conflict drives the plot. Psychological depth over action.' },
  { id: 'mystery', name: 'Mystery Unravel', desc: 'Clue → red herring → revelation pattern. Each chapter reveals or conceals.' },
  { id: 'slowburn', name: 'Slow Burn Romance', desc: 'Emotional proximity increases gradually. Touch escalation. Yearning over action.' },
  { id: 'epic', name: 'Epic World-Building', desc: 'Wide scope. Multiple threads. Lore delivery woven into action.' },
  { id: 'literary', name: 'Literary Atmospheric', desc: 'Mood and language are the point. Lyrical prose. Ambiguity is a feature.' },
  { id: 'action', name: 'Fast-Paced Action', desc: 'Short chapters. Constant motion. Cliffhangers every 2-3 pages.' },
  // Comedy beat styles
  { id: 'screwball', name: 'Screwball Comedy', desc: 'Rapid-fire wit, escalating chaos, romantic tension through conflict. Dialogue-heavy.' },
  { id: 'drywit', name: 'Dry Wit / Deadpan', desc: 'Understated humor. Comedy in what ISN\'T said. Precision over spectacle.' },
  { id: 'darkcomedy', name: 'Dark Comedy', desc: 'Finding humor in the terrible. Laughing because the alternative is screaming.' },
  { id: 'absurdist', name: 'Absurdist / Surreal Comedy', desc: 'Reality is broken and nobody filed a report. Logic is optional. Rules are suggestions.' },
  { id: 'romcom', name: 'Romantic Comedy', desc: 'Two people who should be together but can\'t get out of their own way.' },
  { id: 'caper', name: 'Comic Caper / Heist Comedy', desc: 'A plan that should not work, executed by people who should not be trusted.' },
];

export const NF_STRUCTURE_MODES = {
  prescriptive: {
    label: 'Prescriptive / How-To',
    icon: '📋',
    desc: 'Each chapter teaches a principle or skill.',
    pattern: 'Framework → Evidence → Application → Takeaway',
    examples: 'Atomic Habits, The 4-Hour Workweek, caregiving manuals',
    chapterPrompt: 'Write instructional prose, NOT narrative scenes. The reader is learning, not being entertained.'
  },
  narrative: {
    label: 'Narrative Nonfiction',
    icon: '🎬',
    desc: 'True events told with cinematic pacing.',
    pattern: 'Scene → Context → Tension → Resolution → Implication',
    examples: 'In Cold Blood, The Devil in the White City, Killers of the Flower Moon',
    chapterPrompt: 'Write like a documentary filmmaker — every scene must be sourced from real events.'
  },
  reference: {
    label: 'Reference / Academic',
    icon: '📖',
    desc: 'Self-contained deep-dives by topic.',
    pattern: 'Definition → Explanation → Case Studies → Cross-references → Summary',
    examples: 'Textbooks, DSM, encyclopedias',
    chapterPrompt: 'Write with authoritative distance. Prioritize completeness and accuracy over narrative.'
  },
  investigative: {
    label: 'Investigative / Exposé',
    icon: '🔍',
    desc: 'Evidence-driven, building the case.',
    pattern: 'Evidence → Reconstruction → Analysis → Implications → Next Lead',
    examples: 'Spotlight, All the President\'s Men, investigative journalism',
    chapterPrompt: 'Write like a prosecutor building a case — each chapter advances the central argument with new evidence.'
  }
};

export const AUTHOR_VOICES_BY_GENRE = {
  'Literary Fiction': [
    { id: 'toni-morrison', name: 'Toni Morrison', desc: 'Lyrical, mythic prose. Deep interiority and cultural weight.' },
    { id: 'cormac-mccarthy', name: 'Cormac McCarthy', desc: 'Sparse, biblical cadence. No quotation marks. Violence as landscape.' },
    { id: 'donna-tartt', name: 'Donna Tartt', desc: 'Dense, ornate sentences. Academic atmosphere. Slow-burn tension.' },
    { id: 'kazuo-ishiguro', name: 'Kazuo Ishiguro', desc: 'Restrained, elegant understatement. Memory and regret as themes.' },
  ],
  'Thriller & Suspense': [
    { id: 'stephen-king', name: 'Stephen King', desc: 'Conversational, grounded horror. Blue-collar characters. Relentless pacing.' },
    { id: 'james-patterson', name: 'James Patterson', desc: 'Ultra-short chapters. Punchy cliffhangers. Fast commercial pace.' },
    { id: 'gillian-flynn', name: 'Gillian Flynn', desc: 'Acidic, unreliable narrators. Dark wit. Psychological manipulation.' },
    { id: 'lee-child', name: 'Lee Child', desc: 'Clipped, muscular prose. Short sentences. Physical precision.' },
  ],
  'Romance': [
    { id: 'colleen-hoover', name: 'Colleen Hoover', desc: 'Emotional gut-punches. First-person intimacy. Contemporary angst.' },
    { id: 'ali-hazelwood', name: 'Ali Hazelwood', desc: 'Witty banter. STEM settings. Slow-burn with humor.' },
    { id: 'sarah-j-maas', name: 'Sarah J. Maas', desc: 'Epic fantasy romance. Lush worldbuilding. High spice escalation.' },
  ],
  'Fantasy & Sci-Fi': [
    { id: 'brandon-sanderson', name: 'Brandon Sanderson', desc: 'Hard magic systems. Intricate plotting. Clean, functional prose.' },
    { id: 'ursula-leguin', name: 'Ursula K. Le Guin', desc: 'Philosophical sci-fi. Anthropological worldbuilding. Quiet power.' },
    { id: 'joe-abercrombie', name: 'Joe Abercrombie', desc: 'Grimdark wit. Morally gray characters. Violent and funny.' },
    { id: 'n-k-jemisin', name: 'N.K. Jemisin', desc: 'Second-person POV mastery. Structural innovation. Visceral worldbuilding.' },
  ],
  'Contemporary & YA': [
    { id: 'sally-rooney', name: 'Sally Rooney', desc: 'Minimalist dialogue. Millennial interiority. No quotation marks.' },
    { id: 'taylor-jenkins-reid', name: 'Taylor Jenkins Reid', desc: 'Multi-timeline. Interview/oral history format. Hollywood glamour.' },
    { id: 'angie-thomas', name: 'Angie Thomas', desc: 'Authentic YA voice. Social issues woven into personal story.' },
  ],
  'Horror & Industrial': [
    { id: 'arina-cheskey', name: 'Arina Cheskey', desc: 'Industrial horror. Visceral, suffocating, jagged prose. Environment as antagonist.' },
  ],
  'Dystopian & Noir': [
    { id: 'logan-wilshire', name: 'Logan Wilshire', desc: 'Bureaucratic noir. Cynical, methodical, grief-heavy. Weaponized systems.' },
  ],
  'Clean & Inspirational': [
    { id: 'sarah-j-carpenter', name: 'Sarah J. Carpenter', desc: 'Clean romance / faith fiction. Warm, uplifting, cozy. No profanity or explicit content.' },
  ],
  'Comedy & Humor': [
    { id: 'nora-ephron', name: 'Nora Ephron', desc: 'Romantic comedy. Warm, observational, self-aware. Manhattan energy. Internal monologue is the star.' },
    { id: 'douglas-adams', name: 'Douglas Adams', desc: 'Absurdist sci-fi comedy. Cosmic scale in mundane terms. British politeness meets existential horror.' },
    { id: 'carl-hiaasen', name: 'Carl Hiaasen', desc: 'Comic crime/caper. Florida energy. Sunburned incompetence meets environmental crime.' },
    { id: 'terry-pratchett', name: 'Terry Pratchett', desc: 'Satirical fantasy comedy. Warmth underneath the satire. Footnote energy. Deeply human.' },
    { id: 'elmore-leonard', name: 'Elmore Leonard', desc: 'Comic crime. Cool dialogue. Characters who think they\'re smarter than they are. No adverbs.' },
    { id: 'christopher-moore', name: 'Christopher Moore', desc: 'Comic fantasy/horror. Monsters with relationship problems. Gleeful anachronism.' },
  ],
  'Nonfiction': [
    { id: 'malcolm-gladwell', name: 'Malcolm Gladwell', desc: 'Anecdote-driven analysis. Counterintuitive hooks. Conversational authority.' },
    { id: 'michelle-obama', name: 'Michelle Obama', desc: 'Warm memoir voice. Vulnerable and aspirational. Clear structure.' },
    { id: 'erik-larson', name: 'Erik Larson', desc: 'Narrative nonfiction cinema. Parallel timelines. Meticulous research.' },
    { id: 'brene-brown', name: 'Brené Brown', desc: 'Empathetic self-help. Research-backed vulnerability. Direct address.' },
  ],
  'Other': [
    { id: 'custom', name: 'Custom / None', desc: 'No named author imitation. Use your own voice notes.' },
  ],
};

// Flat list for backward compatibility
export const AUTHOR_VOICES = Object.values(AUTHOR_VOICES_BY_GENRE).flat().map((v) => v.name);

export const SPICE_LEVELS = {
  0: { label: 'Fade to Black', desc: 'No sexual content. Romantic tension permitted. Focus on emotional connection.' },
  1: { label: 'Closed Door', desc: 'Intimacy implied but never shown. Scene ends before clothing removed.' },
  2: { label: 'Cracked Door', desc: 'Intimate scenes partially depicted with tasteful language. Pulls back before fully explicit.' },
  3: { label: 'Open Door', desc: 'Explicit sexual scenes permitted and depicted fully. Anatomical language allowed but natural.' },
  4: { label: 'Full Intensity', desc: 'No restrictions on explicitness. Raw, unflinching. Character-driven.' },
};

export const EROTICA_REGISTERS = {
  0: { name: 'Literary', desc: 'Lyrical, metaphor-rich intimate scenes. "Literary erotica" tone.' },
  1: { name: 'Natural', desc: 'Balanced, direct but not clinical. Standard romance/erotica register.' },
  2: { name: 'Vernacular', desc: 'Casual, character-authentic language. Characters speak and think in everyday sexual vocabulary.' },
  3: { name: 'Raw', desc: 'Explicit, unfiltered, visceral. No euphemisms, no softening. Maximum intensity.' },
};

export const LANGUAGE_INTENSITY = {
  0: { label: 'Clean', desc: 'No profanity, no slurs, no crude language.' },
  1: { label: 'Mild', desc: 'Occasional damn, hell. No F-bombs or slurs.' },
  2: { label: 'Moderate', desc: 'Occasional F-word in character. No slurs unless period-critical.' },
  3: { label: 'Strong', desc: 'Unrestricted profanity. Raw authentic dialogue.' },
  4: { label: 'Raw', desc: 'No language restrictions. Period-accurate, character-authentic. All profanity permitted.' },
};

export const VIOLENCE_LEVELS = {
  0: { label: 'None', desc: 'No physical violence. Threat may be emotional, social, or mystery-based.' },
  1: { label: 'Mild Peril', desc: 'Brief non-graphic threat. Danger suggested, not shown in detail.' },
  2: { label: 'Moderate Action', desc: 'Action violence allowed. Non-graphic injuries. PG-13 equivalent.' },
  3: { label: 'Intense', desc: 'Intense violence allowed. Visceral but purposeful, not gratuitous.' },
  4: { label: 'Graphic', desc: 'Graphic violence permitted when genre-appropriate. Not exploitative.' },
  5: { label: 'Extreme / Restricted', desc: 'Extreme content. Requires genre justification. Extra safety boundaries apply.' },
};

export const CHAPTER_LENGTH_PRESETS = {
  flash: { words: 1000, label: 'Flash Fiction (~500–1,500 words)', desc: 'Ultra-short chapters. Vignettes, flash fiction, micro-stories.' },
  short: { words: 2000, label: 'Short (~2,000 words)', desc: 'Patterson-style. Punchy, fast turnover.' },
  standard: { words: 3500, label: 'Standard (~3,500 words)', desc: 'Most commercial fiction and nonfiction.' },
  long: { words: 5000, label: 'Long (~5,000 words)', desc: 'Literary fiction, epic fantasy.' },
  epic: { words: 8500, label: 'Epic (~8,500 words)', desc: 'Sanderson, GRRM, deep-dive nonfiction.' },
};

export const PROJECT_DOC_TABS = [
  { key: 'world_md', label: 'World' },
  { key: 'characters_md', label: 'Characters' },
  { key: 'outline_md', label: 'Outline' },
  { key: 'canon_md', label: 'Canon' },
  { key: 'voice_md', label: 'Voice' },
  { key: 'mystery_md', label: 'Mystery' },
];

export const foundationSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    tagline: { type: 'string' },
    author_name: { type: 'string' },
    current_focus: { type: 'string' },
    foundation_score: { type: 'number' },
    lore_score: { type: 'number' },
    world_md: { type: 'string' },
    characters_md: { type: 'string' },
    outline_md: { type: 'string' },
    canon_md: { type: 'string' },
    voice_md: { type: 'string' },
    mystery_md: { type: 'string' },
    canon_cast: {
      type: 'array',
      description: 'Locked per-character records. Downstream agents read THESE, not characters_md prose.',
      items: {
        type: 'object',
        properties: {
          canonical_name: { type: 'string' },
          role: { type: 'string', description: 'protagonist | antagonist | love_interest | ally | foil | minor' },
          archetype: { type: 'string', description: 'Specific named archetype. Must be distinct from every other character.' },
          physical_signature: { type: 'string' },
          props: { type: 'array', items: { type: 'string' }, description: 'Named objects this character owns/carries. Specific names only.' },
          voice_fingerprint: { type: 'string' },
          wound: { type: 'string' },
          want: { type: 'string' },
          need: { type: 'string' },
          lie: { type: 'string' },
        },
        required: ['canonical_name', 'role', 'archetype', 'props'],
      },
    },
    twists: {
      type: 'array',
      description: 'Plot twists with clues, reveals, and foreshadowing rules.',
      items: {
        type: 'object',
        properties: {
          twist_number: { type: 'number' },
          name: { type: 'string' },
          type: { type: 'string' },
          chapter_placement: { type: 'number' },
          setup_chapters: { type: 'string' },
          the_twist: { type: 'string' },
          the_truth: { type: 'string' },
          clues_to_plant: { type: 'array', items: { type: 'string' } },
          emotional_impact: { type: 'string' },
          consequences: { type: 'string' },
          foreshadowing_rule: { type: 'string' },
        },
        required: ['name', 'type', 'chapter_placement', 'the_twist', 'the_truth'],
      },
    },
    chapters: {
      type: 'array',
      description: 'MUST contain the EXACT number of chapters specified in the prompt. Do NOT truncate.',
      items: {
        type: 'object',
        properties: {
          chapter_number: { type: 'number' },
          title: { type: 'string' },
          beat_summary: { type: 'string' }
        },
        required: ['chapter_number', 'title', 'beat_summary']
      }
    }
  },
  required: ['title', 'tagline', 'author_name', 'world_md', 'characters_md', 'outline_md', 'canon_md', 'voice_md', 'mystery_md', 'canon_cast', 'chapters']
};

export const chapterSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    content_md: { type: 'string' },
    word_count: { type: 'number' },
    score: { type: 'number' },
    revision_notes: { type: 'string' }
  },
  required: ['title', 'content_md', 'word_count', 'score', 'revision_notes']
};

export const chapterPlanSchema = {
  type: 'object',
  properties: {
    chapters: {
      type: 'array',
      description: 'MUST contain the EXACT number of chapters specified in the prompt. Do NOT stop early or truncate.',
      items: {
        type: 'object',
        properties: {
          chapter_number: { type: 'number' },
          title: { type: 'string' },
          beat_summary: { type: 'string' }
        },
        required: ['chapter_number', 'title', 'beat_summary']
      }
    }
  },
  required: ['chapters']
};

export const sceneBeatSchema = {
  type: 'object',
  properties: {
    beats: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          scene_number: { type: 'number' },
          scene_goal: { type: 'string' },
          pov_character: { type: 'string' },
          setting: { type: 'string' },
          characters_present: { type: 'array', items: { type: 'string' }, description: 'canonical_name of every character in the scene. ONLY names from canon_cast.' },
          props_present: { type: 'array', items: { type: 'string' }, description: 'Named props appearing/used in the scene, drawn from canon_cast prop lists.' },
          conflict: { type: 'string' },
          emotional_arc: { type: 'string' },
          tension_level: { type: 'number' },
          exit_hook: { type: 'string' },
          intimacy_level: { type: 'number', description: 'Optional 0-4. 0=none, 1=tension/flirting, 2=partial physical contact, 3=explicit sexual content, 4=intensely explicit. Only include when the scene involves romantic/sexual content.' },
        },
        required: ['scene_number', 'scene_goal', 'characters_present', 'conflict', 'emotional_arc', 'tension_level'],
      },
    },
  },
  required: ['beats'],
};

export const evaluationSchema = {
  type: 'object',
  properties: {
    novel_score: { type: 'number' },
    foundation_score: { type: 'number' },
    current_focus: { type: 'string' },
    arc_summary_md: { type: 'string' },
    notes: { type: 'string' }
  },
  required: ['novel_score', 'foundation_score', 'current_focus', 'arc_summary_md', 'notes']
};

export function countWords(text = '') {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function getDraftedCount(chapters = []) {
  return chapters.filter((chapter) => chapter.status === 'drafted' || chapter.status === 'reviewed').length;
}

export function getNextPlannedChapter(chapters = []) {
  return [...chapters]
    .filter((chapter) => chapter.status === 'planned')
    .sort((a, b) => a.chapter_number - b.chapter_number)[0] || null;
}

export function computeTotalWordTarget(chapterTarget = 20, chapterLengthTarget = 3500) {
  return Math.max(1, Number(chapterTarget || 20)) * Math.max(500, Number(chapterLengthTarget || 3500));
}

export function unwrapIntegrationResult(result) {
  let data = result?.data ?? result;
  // InvokeLLM sometimes wraps JSON-schema responses in a "response" key
  if (data && typeof data === 'object' && Object.keys(data).length === 1 && data.response && typeof data.response === 'object') {
    data = data.response;
  }
  return data;
}

function clipText(text = '', maxLength = 4000) {
  return typeof text === 'string' ? text.slice(0, maxLength) : '';
}

function findClosestLengthPreset(words) {
  return Object.entries(CHAPTER_LENGTH_PRESETS)
    .map(([key, value]) => ({ key, delta: Math.abs(value.words - words) }))
    .sort((a, b) => a.delta - b.delta)[0]?.key || 'standard';
}

export function createInitialProjectSettings(bookType = 'fiction') {
  if (bookType === 'anthology') {
    return {
      book_type: 'fiction',
      project_type: 'anthology',
      genre: '',
      subgenre: '',
      target_audience: '',
      pov_mode: 'third-close',
      tense: 'past',
      beat_style: 'Character Study',
      scene_beat_style: 'Character Study',
      nf_structure_mode: '',
      author_name: 'Hermes Agent',
      author_voice: 'Custom / None',
      author_voice_notes: '',
      language_intensity: 2,
      spice_level: 0,
      violence_level: 0,
      erotica_register: 0,
      chapter_target: 12,
      chapter_length_preset: 'standard',
      chapter_length_target: 3500,
      total_word_target: 42000,
      target_chapter_words: 3500,
      anthology_theme: '',
      anthology_theme_type: 'topic',
      anthology_story_length: 'short',
      anthology_variety: 'high',
    };
  }

  const defaults = bookType === 'nonfiction'
    ? {
        book_type: 'nonfiction',
        genre: '',
        subgenre: '',
        target_audience: '',
        pov_mode: 'nf-direct',
        tense: 'present',
        beat_style: '',
        scene_beat_style: '',
        nf_structure_mode: 'prescriptive',
        author_name: 'Hermes Agent',
        author_voice: 'Custom / None',
        author_voice_notes: '',
        language_intensity: 2,
        spice_level: 0,
        violence_level: 0,
        erotica_register: 0,
        chapter_target: 15,
        chapter_length_preset: 'standard',
        chapter_length_target: 3500,
        total_word_target: 52500,
        target_chapter_words: 3500,
      }
    : {
        book_type: 'fiction',
        genre: '',
        subgenre: '',
        target_audience: '',
        pov_mode: 'third-close',
        tense: 'past',
        beat_style: 'Tension-Driven',
        scene_beat_style: 'Tension-Driven',
        nf_structure_mode: '',
        author_name: 'Hermes Agent',
        author_voice: 'Custom / None',
        author_voice_notes: '',
        language_intensity: 2,
        spice_level: 0,
        violence_level: 0,
        erotica_register: 0,
        chapter_target: 20,
        chapter_length_preset: 'standard',
        chapter_length_target: 3500,
        total_word_target: 70000,
        target_chapter_words: 3500,
      };

  return defaults;
}

export function getGenreOptions(bookType = 'fiction') {
  return bookType === 'nonfiction' ? NONFICTION_GENRES : FICTION_GENRES;
}

export function getSubgenreOptions(bookType = 'fiction', genre = '') {
  if (!genre) return [];
  const taxonomy = bookType === 'nonfiction' ? GENRE_TAXONOMY.nonfiction : GENRE_TAXONOMY.fiction;
  return taxonomy[genre] || [];
}

export function getPovOptions(bookType = 'fiction') {
  return bookType === 'nonfiction' ? NONFICTION_POV_MODES : FICTION_POV_MODES;
}

export function getPovPresets(bookType = 'fiction') {
  return bookType === 'nonfiction' ? POV_PRESETS_NF : POV_PRESETS_FICTION;
}

export function isEroticaGenre(genre = '') {
  return /erotic/i.test(genre) || ['Dark Romance', 'Paranormal Romance'].includes(genre);
}

export function buildSpiceBeatInstructions(project) {
  const spice = Number(project.spice_level || 0);
  if (spice < 2) return '';

  const register = Number(project.erotica_register || 0);

  const levels = {
    2: {
      label: 'Cracked Door',
      instruction: `This project includes romantic and sensual content. At least 1-2 scenes per chapter that involve romantic tension should include EXPLICIT beats for physical intimacy. Do not fade to black. Beats should specify: kissing, undressing, touching, physical closeness. The scene_goal for these beats should reference the intimate encounter directly.`,
    },
    3: {
      label: 'Open Door',
      instruction: `This project requires explicit intimate scenes written ON THE PAGE. At least 2-3 beats across the full outline must be DEDICATED intimate scenes where sexual activity is the primary action — not subtext, not implication, not metaphor. These beats must specify: the sexual acts occurring, the escalation within the scene, and the emotional stakes. The scene_goal for intimate beats must be specific (e.g., "First sexual encounter between X and Y, driven by the tension from their magical bond" — NOT "they grow closer"). Intimate beats should be distributed across the arc with appropriate narrative buildup.`,
    },
    4: {
      label: 'Full Intensity',
      instruction: `This project is EXPLICIT EROTICA. Sexual content is a PRIMARY element of the narrative, not a subplot. Requirements for beat generation:
- At minimum, 30-40% of all scene beats across the outline must involve explicit sexual or intensely physical content.
- Intimate beats must specify: what sexual acts occur, which characters are involved, the power dynamic in the encounter, and how the scene advances the emotional arc.
- Beats must escalate across the outline — early encounters should be charged with tension and partial contact, mid-story encounters should be fully explicit, and climactic encounters should push boundaries.
- Do NOT use euphemisms in beat descriptions. State what happens directly: "they have sex," "oral sex," "dominant/submissive dynamic," etc.
- Scene_goal for intimate beats must reference the sexual content explicitly, not hide behind vague language like "they connect" or "intimacy deepens."
- Every chapter does NOT need explicit content, but any chapter without it should have significant sexual tension or aftermath.`,
    },
  };

  const level = levels[spice] || levels[2];

  let block = `\n═══ EROTICA BEAT REQUIREMENTS (SPICE ${spice}/4 — ${level.label}) ═══\n`;
  block += level.instruction;
  block += `\n\nIMPORTANT: The prose writer downstream has FULL authorization to write explicit content. But it can only write what the beats tell it to write. If you do not include intimate scene beats, the explicit content will never be written. YOU are the gatekeeper. Plan the intimacy.\n`;
  block += `═══ END EROTICA BEAT REQUIREMENTS ═══\n`;

  return block;
}

export function shouldShowEroticaSettings(spec = {}) {
  return (spec.book_type === 'fiction' || spec.project_type === 'anthology') && (isEroticaGenre(spec.genre) || Number(spec.spice_level || 0) >= 2);
}

export function shouldShowEroticaRegister(spec = {}) {
  return (spec.book_type === 'fiction' || spec.project_type === 'anthology') && Number(spec.spice_level || 0) >= 3;
}

export function buildViolenceBeatInstructions(project) {
  const violence = Number(project.violence_level || 0);
  if (violence < 1) return '';

  const isNF = project.book_type === 'nonfiction';

  const levels = {
    1: {
      label: 'Mild Peril',
      instruction: isNF
        ? 'This project permits references to mild peril, danger, or threat in case studies and examples. Keep descriptions factual and non-sensational. Focus on emotional and psychological impact rather than graphic physical detail.'
        : 'This project permits mild peril and brief non-graphic threats. Characters may face danger, but physical violence should be implied or briefly mentioned rather than depicted in detail. No graphic injuries, gore, or torture. Focus on tension, suspense, and the emotional aftermath of threatening situations.',
    },
    2: {
      label: 'Moderate Action',
      instruction: isNF
        ? 'This project permits moderate descriptions of violent events in case studies, investigations, or historical accounts. Describe injuries and physical confrontations factually without sensational or exploitative detail. Maintain journalistic or scholarly distance.'
        : 'Action violence is permitted. Fight scenes, chases, and physical confrontations may be depicted with moderate detail. Non-graphic injuries can be described (bruises, cuts, being knocked down). Avoid lingering on gore, dismemberment, or torture. The violence should serve the plot and reveal character, not shock for its own sake.',
    },
    3: {
      label: 'Intense',
      instruction: isNF
        ? 'This project permits intense descriptions of violence in case studies, true crime, or investigative accounts. Injuries and trauma may be described in clinical detail when necessary for the investigation or argument. Do not sensationalize — let the facts carry the weight.'
        : 'Intense violence is permitted. Combat, assault, and life-threatening situations may be depicted with visceral detail. Blood, serious injuries, and physical suffering can be shown on the page. The violence must be purposeful — it should advance the plot, reveal character, or build the world. Gratuitous shock value without narrative purpose is not permitted.',
    },
    4: {
      label: 'Graphic',
      instruction: isNF
        ? 'This project permits graphic descriptions of violence where factually necessary for the subject matter (war, true crime, medical trauma). Maintain professional distance even when describing graphic events. The detail must serve understanding, not spectacle.'
        : 'Graphic violence is permitted when genre-appropriate. Detailed depictions of combat, injury, death, and physical suffering may appear on the page. The writing should be unflinching but purposeful — every graphic scene must serve the story\'s emotional or thematic arc. Do not write torture or gore purely for shock value. Even at this level, violence must illuminate character, stakes, or consequence.',
    },
    5: {
      label: 'Extreme / Restricted',
      instruction: isNF
        ? 'This project permits extremely graphic descriptions of violence where factually required. Exercise maximum professional restraint. Every graphic detail must be essential to the argument, investigation, or historical account. Do not exploit victims or sensationalize trauma.'
        : 'Extreme violence is permitted with restrictions. The most graphic and unflinching depictions of violence, gore, torture, body horror, and death are allowed — but ONLY when they serve the narrative\'s thematic purpose. This level requires genre-appropriate justification (horror, grimdark, war fiction, dark thriller). Even at maximum violence, the following remain PROHIBITED: sexualized violence against minors, violence purely designed to dehumanize with no narrative purpose, and snuff-style content with no story context. Every extreme scene must serve character, plot, or theme.',
    },
  };

  const level = levels[violence] || levels[1];

  let block = `\n═══ VIOLENCE BEAT REQUIREMENTS (LEVEL ${violence}/5 — ${level.label}) ═══\n`;
  block += level.instruction;
  block += `\n\nIMPORTANT: Violence level settings control tone and intensity, but they NEVER override prohibited content rules. No violence level permits content that violates safety gates.\n`;
  block += `═══ END VIOLENCE BEAT REQUIREMENTS ═══\n`;

  return block;
}

export function applyGenreDefaults(settings, genre) {
  const base = { ...settings, genre };
  const defaults = GENRE_DEFAULTS[genre];

  if (!defaults) {
    return {
      ...base,
      total_word_target: computeTotalWordTarget(base.chapter_target, base.chapter_length_target),
      target_chapter_words: base.chapter_length_target,
      scene_beat_style: base.beat_style || '',
    };
  }

  const chapterLengthTarget = Math.round(defaults.words / defaults.chapters / 100) * 100;
  const chapterLengthPreset = findClosestLengthPreset(chapterLengthTarget);

  return {
    ...base,
    pov_mode: defaults.pov,
    tense: defaults.tense,
    beat_style: defaults.beat || '',
    scene_beat_style: defaults.beat || '',
    nf_structure_mode: defaults.structure || (base.book_type === 'nonfiction' ? base.nf_structure_mode || 'prescriptive' : ''),
    spice_level: defaults.spice ?? (base.book_type === 'fiction' ? 0 : 0),
    violence_level: defaults.violence ?? 0,
    erotica_register: defaults.register ?? 0,
    chapter_target: defaults.chapters,
    chapter_length_preset: chapterLengthPreset,
    chapter_length_target: chapterLengthTarget,
    target_chapter_words: chapterLengthTarget,
    total_word_target: defaults.words,
  };
}

export function buildProjectContextHeader(spec) {
  const type = spec.book_type === 'nonfiction' ? 'NONFICTION' : 'FICTION';
  const parts = [
    `TYPE: ${type}`,
    `GENRE: ${spec.genre || 'General'}${spec.subgenre ? ' / ' + spec.subgenre : ''}`,
    `BEAT: ${spec.beat_style || spec.scene_beat_style || 'Not specified'}`,
    `POV: ${spec.pov_mode || 'third-close'}`,
    `TENSE: ${spec.tense || 'past'}`,
    `LANG: ${spec.language_intensity || 2}/4`,
  ];

  if (spec.author_voice && spec.author_voice !== 'Custom / None') {
    parts.push(`VOICE: ${spec.author_voice}`);
  }
  if (spec.target_audience) {
    parts.push(`AUDIENCE: ${spec.target_audience}`);
  }
  if ((spec.book_type === 'fiction' || spec.project_type === 'anthology') && Number(spec.spice_level || 0) >= 1) {
    parts.push(`SPICE: ${spec.spice_level}/4`);
  }
  if (Number(spec.violence_level || 0) >= 1) {
    parts.push(`VIOLENCE: ${spec.violence_level}/5`);
  }
  if ((spec.book_type === 'fiction' || spec.project_type === 'anthology') && Number(spec.erotica_register || 0) >= 1) {
    const regNames = ['Literary', 'Natural', 'Vernacular', 'Raw'];
    parts.push(`REGISTER: ${regNames[spec.erotica_register]}`);
  }
  if (spec.book_type === 'nonfiction' && spec.nf_structure_mode) {
    parts.push(`STRUCTURE: ${spec.nf_structure_mode.toUpperCase()}`);
  }
  parts.push(`CHAPTERS: ${spec.chapter_target || 20}`);
  parts.push(`TARGET: ~${spec.chapter_length_target || spec.target_chapter_words || 3500} words/chapter`);

  // Anti-contamination canary: defense-in-depth against model KV cache bleed
  // or prompt context pollution from prior projects.
  // IMPORTANT: Do NOT list specific business names here — telling the LLM "never say X"
  // paradoxically teaches it that X exists. The safety gate detects contamination post-hoc.
  const contaminationCanary = 'CONTAMINATION GATE: This is a creative fiction/nonfiction writing project. Never introduce real-world business names, healthcare organizations, government program names, compliance terminology, or corporate documentation language unless the project premise explicitly requires them. Stay in the story world.';

  return `═══ PROJECT CONTEXT ═══\n${parts.join(' | ')}\nPhase 1 settings MANDATORY.\n${contaminationCanary}\n═══════════════════════`;
}

// Detailed voice dossiers for custom original author voices
export const CUSTOM_VOICE_DOSSIERS = {
  'Erik Larson': `AUTHOR VOICE: Erik Larson — Narrative Nonfiction / Historical Suspense.
TONE: Cinematic, immersive, and quietly ominous. True events told with the tension of a thriller, but never sensationalized. The dread comes from knowing what's coming while the people on the page do not.
PROSE MECHANICS: Clean, controlled, journalistic sentences that carry vivid specificity. Build scenes from documented detail — weather, dates, rooms, objects, what a person ate or wore — drawn only from the record. Favor concrete nouns and active verbs over interpretation. Let facts accumulate into atmosphere; do not editorialize.
STRUCTURE: Parallel timelines and braided storylines that converge. Short, scene-driven sections that end on a quiet hook pulling the reader forward. Foreshadow with real, sourced detail rather than authorial hinting.
SENSORY FOCUS: The texture of a specific time and place — the light, the smell of a city, the sound of a machine, the weight of period objects. Ground every abstraction in a physical, documented particular.
SOURCING DISCIPLINE: Every scene rests on the historical record — letters, diaries, transcripts, news accounts, official documents. Reconstruct only what sources support. When a fact is uncertain or unknown, say so plainly; never invent dialogue, interiority, or events to fill a gap.
CHARACTER LENS: Treat real historical figures as full people — render their choices, ambitions, and blind spots through documented action, not speculation about their feelings.
ANTI-TROPES: No purple prose, no melodrama, no invented suspense. Do not use vague authority phrases like "the record suggests" or "historians believe" as filler — name the actual source or state the uncertainty. Never let style outrun the evidence.`,

  'Arina Cheskey': `AUTHOR VOICE: Arina Cheskey — Industrial Horror / Psychological Survival Thriller.
TONE: Visceral, suffocating, bleak, and grounded entirely in physical reality.
PROSE MECHANICS: Use short, jagged, claustrophobic sentences. Strip away all romanticized or poetic language. The setting is not just a backdrop; it is an active antagonist.
SENSORY FOCUS: Emphasize the physical decay of the environment — rust, ozone, wet lime, caustic dust, blinding whiteouts, freezing sweat, and the taste of copper in the air.
CHARACTER LENS: The protagonist is profoundly isolated, battling both a lethal, man-made environment and their own fracturing sanity due to sensory deprivation or toxic exposure.
ANTI-TROPES: Do not explain the monster or threat early. Never use melodramatic internal monologues. Filter all fear strictly through the body's physical failing (e.g., ringing ears, calcifying lungs, static on the skin).`,

  'Logan Wilshire': `AUTHOR VOICE: Logan Wilshire — Dystopian Technothriller / "Bureaucratic Noir".
TONE: Cynical, hardboiled, highly observant, and emotionally heavy.
PROSE MECHANICS: Cinematic and methodical. Use sharp, gritty metaphors and philosophical observations about human nature, grief, and societal control. The pacing should feel like a tired detective deliberately walking through a crime scene.
SENSORY FOCUS: The high contrast between sleek, sterile utopias and the rotting truth underneath. Rain-slicked streets, synthetic fabrics, the hum of servers, and the terrifying quiet of forced, sedated compliance.
CHARACTER LENS: The protagonist is a grief-stricken outsider. They are the only one awake in a sleeping world, seeing the violent flaws in the system that everyone else accepts as normal.
ANTI-TROPES: Do not write fast-paced, generic action movie sequences. The horror and tension must come from the weaponization of bureaucracy and the realization of how trapped the characters are. Keep the emotion grounded in loss, not panic.`,

  'Sarah J. Carpenter': `AUTHOR VOICE: Sarah J. Carpenter — Clean Romance / Women's Fiction / Faith-Based Fiction.
TONE: Warm, uplifting, emotionally resonant, and comforting. Think "Hallmark Channel" meets Karen Kingsbury. The vibe is hopeful and deeply rooted in community.
PROSE MECHANICS: Accessible, inviting, and conversational. The pacing should feel like a deep conversation with a good friend over coffee. Focus on emotional growth, forgiveness, and gentle humor.
SENSORY FOCUS: Domestic, cozy, and vibrant aesthetics. The smell of cinnamon baking, sunlit porches, crisp autumn air, the warmth of a knit blanket, and the quiet peace of a small-town main street or a church sanctuary.
CHARACTER LENS: The protagonist is relatable, often seeking a fresh start, healing from a past emotional wound, or rediscovering their purpose/faith. They are deeply motivated by family, loyalty, and moral integrity.
ANTI-TROPES: STRICTLY NO profanity, explicit sexual content ("fade to black" only), or graphic violence. Avoid cynical, dark, or hardboiled inner monologues. Conflict should stem from emotional guardedness, miscommunications, or crises of faith, rather than malicious villains.
CONTENT GUARDRAILS: Override language_intensity to 1 (Clean). Override spice_level to 0 or 1 (fade-to-black max). All intimate scenes must cut away before any explicit description.`,

  'Nora Ephron': `AUTHOR VOICE: Nora Ephron — Romantic Comedy.
TONE: Warm, observational, self-aware. Manhattan energy. Wry without being cruel.
PROSE MECHANICS: Internal monologue is the star — characters narrate their own disasters with wit. Characters are smart people making dumb romantic decisions. Dialogue sounds like the best conversation you've ever overheard.
SENSORY FOCUS: Food, apartments, and careers as metaphors for emotional states. Urban textures — coffee shops, bookstores, rain on pavement, the specific way someone's apartment reveals everything about them.
CHARACTER LENS: Protagonists are competent professionals who become complete idiots about love. Self-deprecating humor masks genuine vulnerability. Pop culture references woven naturally, never forced.
DIALOGUE STYLE: Rapid, overlapping, competitive. Characters try to be clever and usually succeed, except about the one thing that matters. Banter is flirting in disguise.
ENDING RULE: End scenes with rueful self-awareness, not cliffhangers. The protagonist replaying the conversation and realizing they're screwed.`,

  'Douglas Adams': `AUTHOR VOICE: Douglas Adams — Absurdist Sci-Fi Comedy.
TONE: Cosmic scale rendered in the most mundane possible terms. The universe is vast, indifferent, and badly organized.
PROSE MECHANICS: Sentences that start normally and end somewhere impossible. Footnotes and digressions are features, not bugs. Matter-of-fact descriptions of impossible things. Lists that escalate into madness.
SENSORY FOCUS: Technology that always works in the most inconvenient way possible. Bureaucratic forms in triplicate for the apocalypse. The specific mundanity of interstellar travel — bad cafeteria food, confusing signage, unhelpful robots.
CHARACTER LENS: Characters face existential horror with British politeness. They are trying their best in a universe that is emphatically not trying at all. Earnestness in the face of absurdity.
DIALOGUE STYLE: People have normal conversations about abnormal things. Technical jargon applied to feelings. Polite disagreements about the nature of reality.
ENDING RULE: End scenes with a fact that recontextualizes everything as absurd.`,

  'Carl Hiaasen': `AUTHOR VOICE: Carl Hiaasen — Comic Crime / Caper.
TONE: Florida energy. Sunburned incompetence meets environmental crime. Hot, sweaty, and morally sticky.
PROSE MECHANICS: Plots are Rube Goldberg machines of unintended consequences. Villains are petty, greedy, and hilariously bad at crime. Heroes are reluctant, cranky, and only slightly less dysfunctional.
SENSORY FOCUS: Swamp heat, strip malls, tourist traps, endangered species, the specific corruption of overdeveloped coastline. Nature fights back — animals as agents of karmic justice.
CHARACTER LENS: Every character believes they're the smartest person in the room. Nobody is. Criminal incompetence is the engine of the plot.
DIALOGUE STYLE: Profane, quick, and reveals character instantly. People say terrible things casually. Arguments about irrelevant details during criminal activity.
ENDING RULE: End scenes with poetic justice delivered by an alligator or a hurricane.`,

  'Terry Pratchett': `AUTHOR VOICE: Terry Pratchett — Satirical Fantasy Comedy.
TONE: Warmth underneath the satire. Laughing WITH humanity, not AT it. Social commentary disguised as jokes about dwarves and wizards.
PROSE MECHANICS: Fantasy tropes examined through the lens of common sense. Footnotes that contain the best jokes. Characters who are archetypes but deeper than they should be.
SENSORY FOCUS: The lived-in details of a fantasy world that actually has to function — plumbing, taxation, postal services. The contrast between grand magical destiny and having to do the dishes.
CHARACTER LENS: Death speaks in ALL CAPS and is oddly sympathetic. Guards have mortgages. Witches are practical. Everyone is trying to get through the day.
DIALOGUE STYLE: Characters correct each other's grammar during existential crises. Formal language applied to ridiculous situations. Quiet wisdom from unexpected sources.
ENDING RULE: End scenes with a quiet observation about what it means to be human.`,

  'Elmore Leonard': `AUTHOR VOICE: Elmore Leonard — Comic Crime.
TONE: Cool. Detached. Characters who think they're smarter than they are. Plans go sideways because people are fundamentally unreliable.
PROSE MECHANICS: No adverbs. Ever. Lean, muscular sentences. Dialogue carries 80% of the story. The prose gets out of the way and lets characters reveal themselves through speech and action.
SENSORY FOCUS: Cheap motels, strip clubs, parking lots, diners. The unglamorous geography of American crime. Criminals with day jobs and domestic problems.
CHARACTER LENS: Every character believes they're the protagonist of their own story. Violence is sudden, brief, and often accidentally funny. Nobody monologues.
DIALOGUE STYLE: Characters talk past each other. Each person is running their own hustle while pretending to listen. Subtext is everything. What's NOT said matters more.
ENDING RULE: End scenes mid-conversation, like walking out of a room.`,

  'Christopher Moore': `AUTHOR VOICE: Christopher Moore — Comic Fantasy / Horror.
TONE: Monsters have relationship problems. Death is an inconvenience. The supernatural is treated as a workplace hazard.
PROSE MECHANICS: Historical settings rendered with gleeful anachronism. Characters swear creatively and often. Love stories between deeply inappropriate people. Chapter titles that spoil things and don't care.
SENSORY FOCUS: The collision of the mundane and the supernatural — a vampire's grocery list, a demon's HR complaint, Death's coffee preference. Everyday details in impossible situations.
CHARACTER LENS: Protagonists stumble into cosmic horror and respond with irritation rather than awe. Supporting characters steal scenes. Nobody takes the apocalypse as seriously as they should.
DIALOGUE STYLE: Banter between people who should be terrified. Pop culture references in medieval settings. Casual profanity as punctuation.
ENDING RULE: End scenes with someone saying exactly the wrong thing to exactly the wrong entity.`,
};

export function buildAuthorVoiceInstruction(project) {
  // Check for custom voice dossier first
  if (project.author_voice && CUSTOM_VOICE_DOSSIERS[project.author_voice]) {
    return CUSTOM_VOICE_DOSSIERS[project.author_voice];
  }

  if (project.author_voice && project.author_voice !== 'Custom / None') {
    return `AUTHOR VOICE: Write in the style of ${project.author_voice}. Study their sentence rhythm, dialogue approach, pacing, and emotional register. Do NOT parody — absorb the craft.`;
  }

  if (project.author_voice_notes) {
    return `CUSTOM VOICE NOTES: ${project.author_voice_notes}`;
  }

  return 'AUTHOR VOICE: No named author imitation is required. Use the project voice guide faithfully.';
}

function buildSpiceInstruction(project) {
  if ((project.book_type !== 'fiction' && project.project_type !== 'anthology') || Number(project.spice_level || 0) < 1) {
    return 'INTIMACY: Keep sensuality within the configured project limits.';
  }

  const spice = SPICE_LEVELS[project.spice_level]?.desc || '';
  const register = EROTICA_REGISTERS[project.erotica_register || 0]?.desc || '';
  return `INTIMACY SETTINGS: Spice ${project.spice_level}/4. ${spice} Register guidance: ${register}`;
}

// Step 1: Quick settings analysis (small, fast response)
export const expandSettingsSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    tagline: { type: 'string' },
    genre: { type: 'string' },
    subgenre: { type: 'string' },
    target_audience: { type: 'string' },
    pov_mode: { type: 'string' },
    tense: { type: 'string' },
    beat_style: { type: 'string' },
    nf_structure_mode: { type: 'string' },
    author_voice: { type: 'string' },
    author_voice_notes: { type: 'string' },
    language_intensity: { type: 'number' },
    chapter_target: { type: 'number' },
    chapter_length_target: { type: 'number' },
    spice_level: { type: 'number' },
  },
  required: ['title', 'tagline', 'genre', 'pov_mode', 'tense', 'language_intensity', 'chapter_target', 'chapter_length_target'],
};

export function buildExpandSettingsPrompt(seedConcept, bookType = 'fiction', existingSettings = {}) {
  const isFiction = bookType === 'fiction';
  const taxonomy = isFiction ? GENRE_TAXONOMY.fiction : GENRE_TAXONOMY.nonfiction;

  // If user already selected a genre, lock it — never let the AI override it
  const lockedGenre = existingSettings.genre || null;
  const lockedSubgenre = existingSettings.subgenre || null;
  const lockedBeatStyle = existingSettings.beat_style || null;
  const lockedNfStructure = existingSettings.nf_structure_mode || null;

  const availableSubgenres = lockedGenre && taxonomy[lockedGenre]?.length
    ? taxonomy[lockedGenre].join(', ')
    : null;

  const availableGenres = Object.entries(taxonomy)
    .map(([g, subs]) => subs.length ? `${g} (${subs.join(', ')})` : g)
    .join('; ');

  const beatList = BEAT_STYLES.map((s) => s.name).join(', ');
  const nfList = Object.keys(NF_STRUCTURE_MODES).join(', ');
  const availableVoices = Object.values(AUTHOR_VOICES_BY_GENRE).flat().map((v) => v.name).join(', ');

  const genreBlock = lockedGenre
    ? `GENRE IS LOCKED — DO NOT CHANGE IT:
- genre: "${lockedGenre}" ← return this exactly
${lockedSubgenre ? `- subgenre: "${lockedSubgenre}" ← return this exactly` : availableSubgenres ? `- subgenre: pick the best fit from: ${availableSubgenres}` : '- subgenre: leave empty'}`
    : `- genre: pick the best fit from: ${availableGenres}`;

  const beatBlock = lockedBeatStyle
    ? `BEAT STYLE IS LOCKED — DO NOT CHANGE IT:
- beat_style: "${lockedBeatStyle}" ← return this exactly`
    : isFiction
      ? `- beat_style: pick the best fit from: ${beatList}`
      : lockedNfStructure
        ? `NF STRUCTURE IS LOCKED: nf_structure_mode: "${lockedNfStructure}" ← return this exactly`
        : `- nf_structure_mode: pick the best fit from: ${nfList}`;

  return `Analyze this seed concept and recommend writing parameters. Return ONLY the settings JSON — no prose.

BOOK TYPE: ${bookType}
SEED CONCEPT: ${seedConcept}

CRITICAL RULES:
1. The user has already configured their project. Locked fields MUST be returned exactly as specified — do NOT override them with your own judgment.
2. Chapter count and chapter length are set by the user. Return them as-is from the existing settings.
3. Only infer fields the user has NOT already set.

${genreBlock}
${beatBlock}

You MAY infer (if not already set by user):
- pov_mode: ${isFiction ? 'first, third-close, third-omni, third-multi, deep-first, second, epistolary' : 'nf-author, nf-direct, nf-third, nf-editorial'}
- tense: past, present${!isFiction ? ', mixed' : ''}
- author_voice: ${availableVoices}, or "Custom / None"
- language_intensity: 1(Clean) 2(Mild) 3(Moderate) 4(Unrestricted)
- spice_level: 0-4 (0 unless romance/erotica)
- title, tagline, target_audience

DO NOT CHANGE: chapter_target (${existingSettings.chapter_target || 20}), chapter_length_target (${existingSettings.chapter_length_target || 3500})

Return all fields including the locked ones in the JSON response.`;
}

// Step 2: Foundation generation (uses settings from step 1)
export const expandFoundationSchema = {
  type: 'object',
  properties: {
    world_md: { type: 'string' },
    characters_md: { type: 'string' },
    outline_md: { type: 'string' },
    canon_md: { type: 'string' },
    voice_md: { type: 'string' },
    mystery_md: { type: 'string' },
    canon_cast: {
      type: 'array',
      description: 'Locked per-character records. Downstream agents read THESE, not characters_md prose.',
      items: {
        type: 'object',
        properties: {
          canonical_name: { type: 'string' },
          role: { type: 'string', description: 'protagonist | antagonist | love_interest | ally | foil | minor' },
          archetype: { type: 'string', description: 'Specific named archetype. Must be distinct from every other character.' },
          physical_signature: { type: 'string' },
          props: { type: 'array', items: { type: 'string' }, description: 'Named objects this character owns/carries. Specific names only.' },
          voice_fingerprint: { type: 'string' },
          wound: { type: 'string' },
          want: { type: 'string' },
          need: { type: 'string' },
          lie: { type: 'string' },
        },
        required: ['canonical_name', 'role', 'archetype', 'props'],
      },
    },
    twists: {
      type: 'array',
      description: 'Plot twists with clues, reveals, and foreshadowing rules. Generate exactly the number specified.',
      items: {
        type: 'object',
        properties: {
          twist_number: { type: 'number' },
          name: { type: 'string' },
          type: { type: 'string' },
          chapter_placement: { type: 'number' },
          setup_chapters: { type: 'string' },
          the_twist: { type: 'string' },
          the_truth: { type: 'string' },
          clues_to_plant: { type: 'array', items: { type: 'string' } },
          emotional_impact: { type: 'string' },
          consequences: { type: 'string' },
          foreshadowing_rule: { type: 'string' },
        },
        required: ['twist_number', 'name', 'type', 'chapter_placement', 'the_twist', 'the_truth'],
      },
    },
    foundation_score: { type: 'number' },
    current_focus: { type: 'string' },
    chapters: {
      type: 'array',
      description: 'MUST contain the EXACT number of chapters specified in the prompt. Do NOT stop early or truncate.',
      items: {
        type: 'object',
        properties: {
          chapter_number: { type: 'number' },
          title: { type: 'string' },
          beat_summary: { type: 'string' },
        },
        required: ['chapter_number', 'title', 'beat_summary'],
      },
    },
  },
  required: ['world_md', 'characters_md', 'outline_md', 'canon_md', 'voice_md', 'mystery_md', 'canon_cast', 'chapters'],
};

export function buildExpandFoundationPrompt(seedConcept, settings, options = {}) {
  const isFiction = settings.book_type !== 'nonfiction';
  const chapterCount = settings.chapter_target || 20;
  const constraintBlock = buildSetupConstraints(settings);
  const nameBlock = options.nameExclusionBlock || '';

  const researchBlock = !isFiction && settings.research_data
    ? `\n═══ VERIFIED RESEARCH DATA (use these real facts — do NOT invent) ═══\n${typeof settings.research_data === 'string' ? settings.research_data : JSON.stringify(settings.research_data, null, 2)}\n═══ END RESEARCH ═══\n`
    : '';

  return `${constraintBlock}\n${nameBlock}\nYou are a world-class story architect. Generate a COMPLETE story bible for this book.

TITLE: ${settings.title}
GENRE: ${settings.genre}${settings.subgenre ? ' / ' + settings.subgenre : ''}
POV: ${settings.pov_mode} | TENSE: ${settings.tense}
${isFiction ? `BEAT STYLE: ${settings.beat_style}` : `STRUCTURE: ${settings.nf_structure_mode}`}
CHAPTERS: EXACTLY ${chapterCount} chapters at ~${settings.chapter_length_target} words each
${researchBlock}
SEED CONCEPT:
${seedConcept}

BANNED CHARACTER NAMES (do NOT use any of these — they are AI-favorite defaults and are instant AI detection flags):
Elara, Kaelen, Kael, Lyra, Arden, Sienna, Seraphina, Thorne, Astra, Zara, Rowan, Caelum, Isolde, Orion, Vesper, Elowen, Caspian, Liora, Alaric, Sable.
Invent original names that fit the specific world, culture, and era of THIS story.

Generate:
- world_md: Setting, rules, history, geography, culture, power structures, sensory palette (400+ words)
- characters_md: Major characters with FULL CHARACTER DEPTH PROFILES (600+ words). For EACH major character (protagonist, love interest, antagonist, and up to 2 key supporting characters), generate ALL of the following:

  STRUCTURAL: Wound, Want, Need, Lie, Arc

  BEHAVIORAL (how the wound manifests in daily life):
  - COPING MECHANISM: How do they protect themselves from their wound? What behavior do they default to when stressed?
  - TELL: What unconscious physical habit reveals their emotional state?
  - SOCIAL MASK: How do they present to strangers vs. people they trust? What's the gap?
  - HUMOR STYLE: How do they use humor — or don't?

  RELATIONAL (how they connect with others):
  - ATTACHMENT STYLE: How do they form bonds? Trust fast or slow? Push people away or cling?
  - KEY RELATIONSHIP DYNAMIC: For the protagonist, describe the specific tension in their most important relationship — the friction point, not just the label.
  - DIALOGUE FINGERPRINT: 2-3 specific verbal habits unique to this character (contractions usage, sentence patterns, verbal tics, questions vs. statements).

  SENSORY (how they experience the world):
  - SIGNATURE SENSE: Which sense dominates their perception? This shapes how their POV paragraphs are written.
  - COMFORT OBJECT/RITUAL: What physical object or habit grounds them?
  - BODY IN SPACE: How do they physically occupy a room? Take up space or minimize? Stand near exits?

  ARC MILESTONES (specific moments, not just trajectory):
  - BREAKING POINT: The specific scene/chapter where the character's lie fails them completely.
  - MOMENT OF GRACE: The specific scene where another character sees through their mask and offers acceptance.
  - SACRIFICE: What belief, habit, or relationship do they release — an identity sacrifice, not a plot sacrifice.
- outline_md: Chapter-by-chapter outline matching the beat style (300+ words)
- canon_md: Hard facts and consistency anchors (200+ words)
- voice_md: Prose style guide — sentence rhythm, vocabulary, do/avoid (200+ words). CRITICAL VOICE GUIDE RULE: The voice guide MUST respect the project's configured tense (${settings.tense || 'past'}) and POV (${settings.pov_mode || 'third-close'}). Do NOT import the reference author's default tense, POV, or pronoun conventions if they conflict with the project settings. If the reference author (e.g., Angie Thomas) writes in present tense but the project is set to ${settings.tense || 'past'} tense, adapt the voice guide to describe how that author's STYLE (rhythm, vocabulary, attitude, humor) would sound in ${settings.tense || 'past'} tense — do NOT instruct the prose model to use a different tense. The voice guide describes STYLE, not mechanics. Tense and POV are set in Setup and are non-negotiable.
- mystery_md: Central mystery/question, clue placement, revelation path (200+ words)
${isFiction ? `- twists: Array of plot twists (see PLOT TWISTS section below)` : ''}
- chapters: Array of EXACTLY ${chapterCount} items, each with {chapter_number, title, beat_summary}. You MUST produce all ${chapterCount} chapters numbered 1 through ${chapterCount}. Do NOT stop early or truncate the list. The title must be reader-facing, not a structural beat label.
- foundation_score: Self-assessment 7.0-9.5
- current_focus: Next recommended action
${isFiction ? buildTwistFoundationBlock(settings) : ''}

${CHAPTER_TITLE_HYGIENE_BLOCK}
CRITICAL: The chapters array MUST contain EXACTLY ${chapterCount} entries. Not 10, not 15 — exactly ${chapterCount}. Each chapter needs a unique, reader-facing title and specific beat_summary.

Return JSON only.`;
}

export function buildFoundationPrompt(project, options = {}) {
  const contextHeader = buildProjectContextHeader(project);
  const constraintBlock = buildSetupConstraints(project);
  const isNonfiction = project.book_type === 'nonfiction';
  const nameBlock = options.nameExclusionBlock || '';
  const researchBlock = isNonfiction && project.research_data
    ? `\n═══ VERIFIED RESEARCH DATA (use these real facts — do NOT invent) ═══\n${typeof project.research_data === 'string' ? project.research_data : JSON.stringify(project.research_data, null, 2)}\n═══ END RESEARCH ═══\n`
    : '';
  const structureMode = NF_STRUCTURE_MODES[project.nf_structure_mode]?.pattern || 'Framework → Evidence → Application → Takeaway';
  const scenePovRule = SCENE_POV_RULES[project.pov_mode] || SCENE_POV_RULES['third-close'];
  const twistBlock = !isNonfiction ? buildTwistFoundationBlock(project) : '';
  const chapterCount = project.chapter_target || 20;
  const spice = Number(project.spice_level || 0);
  const spiceOutlineBlock = spice >= 3
    ? `\n═══ SPICE-AWARE OUTLINE REQUIREMENT ═══\nThis project is rated Spice ${spice}/4. The chapter outline MUST include chapters where intimate encounters are the PRIMARY focus — not just a subplot. Label these chapters clearly in their beat_summary descriptions (e.g., "First sexual encounter between X and Y" or "Explicit intimate escalation") so the beat generator knows to plan explicit scenes. At spice ${spice}, at least 20-30% of chapters should have intimate content as a major element.\n═══ END SPICE OUTLINE ═══\n`
    : '';

  return `${constraintBlock}\n${nameBlock}\n${contextHeader}\n\n${buildPovTenseBlock(project)}\n\nSCENE POV RULE FOR OUTLINE AND BREAKDOWN:\n${scenePovRule}\n${researchBlock}${spiceOutlineBlock}\nYou are generating the full AutoNovel foundation package for this book.\n\nSeed concept:\n${project.seed_concept}\n\n${buildAuthorVoiceInstruction(project)}\n\nCore requirements:\n- Respect the requested genre, POV, tense, language intensity, and chapter length target.\n- BANNED CHARACTER NAMES (do NOT use): Elara, Kaelen, Kael, Lyra, Arden, Sienna, Seraphina, Thorne, Astra, Zara, Rowan, Caelum, Isolde, Orion, Vesper, Elowen, Caspian, Liora, Alaric, Sable. These are AI-favorite defaults. Invent original names.\n- You MUST produce EXACTLY ${chapterCount} chapters in the chapters array, numbered 1 through ${chapterCount}. Do NOT stop at 10 or any other number — the user configured ${chapterCount} chapters and you must deliver all of them.\n- Each chapter plan should support approximately ${project.chapter_length_target || project.target_chapter_words || 3500} words.\n- foundation_score and lore_score should be realistic numbers from 7.0 to 9.5.\n- current_focus should be a short phrase naming the next best move.\n\n${isNonfiction ? `Nonfiction foundation rules:\n- Treat world_md as the research and subject-context foundation.\n- Treat characters_md as the people, stakeholders, case studies, and forces involved.\n- outline_md must use the ${project.nf_structure_mode || 'prescriptive'} structure pattern: ${structureMode}.\n- canon_md must contain hard facts, claims that must stay consistent with, and research boundaries.\n- voice_md must explain how to write this nonfiction book for the target audience. CRITICAL VOICE GUIDE RULE: voice_md MUST respect the project tense (${project.tense || 'past'}) and POV (${project.pov_mode || 'nf-direct'}). Do NOT import a reference author's default tense or POV if they conflict. Describe how the author's STYLE (rhythm, vocabulary, attitude) would sound in ${project.tense || 'past'} tense — do NOT instruct prose to use a different tense. voice_md describes STYLE, not mechanics.\n- mystery_md must frame the central question, thesis, or investigation path.\n- Do not invent unsupported facts. Design a structure that invites sourced writing.\n` : `Fiction foundation rules:\n- world_md must include premise, setting rules, power structure, history, tensions, and sensory details.\n- characters_md must define major characters with FULL CHARACTER DEPTH PROFILES. For EACH major character (protagonist, love interest, antagonist, up to 2 key supporting), include ALL dimensions: STRUCTURAL (wound, want, need, lie, arc), BEHAVIORAL (coping mechanism, tell, social mask, humor style), RELATIONAL (attachment style, key relationship dynamic with specific friction, dialogue fingerprint with 2-3 unique verbal habits), SENSORY (signature sense, comfort object/ritual, body in space), ARC MILESTONES (breaking point chapter, moment of grace, identity sacrifice). Characters must feel like real people with contradictions and behavioral specificity.\n- outline_md must map the full story across ALL ${chapterCount} chapters using the configured beat style.\n- If POV is third-multi, mark each planned scene or chapter with its POV owner.\n- canon_md must list hard facts that future chapters should stay consistent with.\n- voice_md must explain the prose style, what to do, and what to avoid. CRITICAL VOICE GUIDE RULE: voice_md MUST respect the project tense (${project.tense || 'past'}) and POV (${project.pov_mode || 'third-close'}). Protagonist pronouns: ${project.protagonist_pronouns || 'she/her'}. Do NOT import a reference author's default tense, POV, or pronoun conventions if they conflict. If the reference author (e.g., Angie Thomas) writes in present tense but the project is set to ${project.tense || 'past'} tense, describe how that author's STYLE (rhythm, vocabulary, attitude, humor) would sound in ${project.tense || 'past'} tense — do NOT instruct the prose model to use present tense. WRONG: 'Use third-close, present tense relentlessly.' RIGHT: 'Use third-close ${project.tense || 'past'} tense with the same immediacy the reference author brings — short declarative sentences, voice-driven narration, rendered in ${project.tense || 'past'} tense.' voice_md describes STYLE, not mechanics. Tense and POV are set in Setup and are non-negotiable.\n- mystery_md must define the central secret and reveal path.\n${twistBlock}\n`}\n${CHAPTER_TITLE_HYGIENE_BLOCK}\nCRITICAL CHAPTER COUNT: Return a chapters array with EXACTLY ${chapterCount} entries. Each entry must have chapter_number, title, and beat_summary. Do NOT truncate — deliver all ${chapterCount} chapters. The title must be reader-facing, not a structural beat label.\n\n${!isNonfiction ? 'Also return a twists array with plot twists. See the PLOT TWISTS section above for the required format.' : ''}\n\nReturn JSON only.`;
}

export function buildChapterPlanPrompt(project) {
  const contextHeader = buildProjectContextHeader(project);
  const constraintBlock = buildSetupConstraints(project);
  const chapterCount = project.chapter_target || 20;
  const isNonfiction = project.book_type === 'nonfiction';
  const researchBlock = isNonfiction && project.research_data
    ? `\n═══ VERIFIED RESEARCH DATA (reference real facts in chapter plans) ═══\n${typeof project.research_data === 'string' ? project.research_data.slice(0, 6000) : JSON.stringify(project.research_data, null, 2).slice(0, 6000)}\n═══ END RESEARCH ═══\n`
    : '';
  const spice = Number(project.spice_level || 0);
  const spicePlanBlock = spice >= 3
    ? `\n═══ SPICE-AWARE CHAPTER PLAN ═══\nThis project is rated Spice ${spice}/4. The chapter plan MUST include chapters where intimate/sexual encounters are a PRIMARY focus. Label these clearly in beat_summary (e.g., "First explicit encounter between X and Y" or "Sexual tension escalates to full consummation"). At spice ${spice}, at least 20-30% of chapters should feature intimate content as a major element, distributed across the arc with appropriate buildup.\n═══ END SPICE PLAN ═══\n`
    : '';

  return `${constraintBlock}\n${contextHeader}\n${researchBlock}${spicePlanBlock}\nBuild a clean chapter plan for this project.\n\nProject title: ${project.title || 'Untitled Project'}\nTagline: ${project.tagline || ''}\nSeed concept: ${project.seed_concept}\n\nWorld guide:\n${clipText(project.world_md, 2200)}\n\nCharacter / stakeholder guide:\n${clipText(project.characters_md, 2200)}\n\nOutline guide:\n${clipText(project.outline_md, 2200)}\n\nCanon guide:\n${clipText(project.canon_md, 1800)}\n\nRequirements:\n- Return exactly one chapters array.\n- Create EXACTLY ${chapterCount} chapters — not fewer, not more. The user configured ${chapterCount} chapters and you must deliver all of them.\n- Each item must include chapter_number, title, and beat_summary.\n- Number chapters sequentially from 1 to ${chapterCount}.\n- The plan must match the selected genre, POV, tense, and structure settings.\n- Beat summaries must be specific enough to draft from directly.\n- Structural labels, twist labels, act labels, midpoint markers, and part labels belong in beat_summary only — never in title.\n${CHAPTER_TITLE_HYGIENE_BLOCK}\nCRITICAL: Do NOT stop at 10 chapters. You MUST output all ${chapterCount} chapters.\n\nReturn JSON only.`;
}

export async function buildSceneBeatPrompt(project, chapter, previousChapter, chapters) {
  // Nonfiction projects use the structured nonfiction beat system
  if (project.book_type === 'nonfiction') {
    return buildNonfictionBeatPrompt(project, chapter, previousChapter, chapters);
  }

  // Load custom author style for condensed injection into beat prompt
  let authorStyleCondensed = '';
  if (project.author_style_id) {
    const authorStyle = await loadAuthorStyle(project.author_style_id);
    if (authorStyle) {
      authorStyleCondensed = buildCondensedAuthorStyleBlock(authorStyle);
    }
  }

  const contextHeader = buildProjectContextHeader(project);
  const constraintBlock = buildSetupConstraints(project);
  const scenePovRule = SCENE_POV_RULES[project.pov_mode] || SCENE_POV_RULES['third-close'];
  const targetWords = project.chapter_length_target || project.target_chapter_words || 3500;

  // Scene-count estimate.
  // For NOVELS: use word-count-based formula (~1 scene per 1200 words).
  // For ANTHOLOGY stories: use the length preset's `parts` value as a floor, since
  // short stories need distinct narrative sections regardless of word count
  // (a 1000-word flash with only 2 scenes gives each scene ~500 words, which
  // squeezes out room for setup + payoff + escalation). When spice >= 2, add
  // one extra scene to carve out dedicated space for the intimate encounter.
  let scenesEstimate = Math.max(2, Math.round(targetWords / 1200));
  if (project.project_type === 'anthology') {
    try {
      const { ANTHOLOGY_STORY_LENGTHS } = await import('@/lib/anthologyEngine');
      const lenKey = project.anthology_story_length || 'short';
      const lenInfo = ANTHOLOGY_STORY_LENGTHS[lenKey] || ANTHOLOGY_STORY_LENGTHS.short;
      const partsFloor = Number(lenInfo.parts) || 2;
      const spiceLevel = Number(project.spice_level || 0);
      // Erotica stories need: setup → tension build → intimate encounter → fallout.
      // For short stories especially, a dedicated intimate-scene slot prevents
      // the explicit scene from being compressed into shared runway.
      const eroticaBoost = spiceLevel >= 2 ? 1 : 0;
      // Minimum 2 scenes so every story has at least setup + payoff.
      scenesEstimate = Math.max(2, partsFloor + eroticaBoost);
    } catch (err) {
      // Fallback to default if import fails
      console.warn('[BEAT] Failed to load anthology length presets:', err.message);
    }
  }

  const spiceBeatBlock = buildSpiceBeatInstructions(project);

  // Anthology-specific spice beat context
  let anthologySpiceBeatCtx = '';
  if (project.project_type === 'anthology' && Number(project.spice_level || 0) >= 1) {
    anthologySpiceBeatCtx = buildAnthologySpiceBeatContext(project);
  }

  // Voice guide
  const voiceGuide = clipText(project.voice_md, 800);

  // Arc position awareness for beat planning
  const chapterNumber = chapter.chapter_number || 1;
  const totalChapters = project.chapter_target || 25;
  const progress = chapterNumber / totalChapters;
  let actPosition = '';
  if (progress <= 0.25) {
    actPosition = 'Act 1 — Setup and inciting incident. Establish characters, world, and stakes.';
  } else if (progress <= 0.50) {
    actPosition = 'Act 2A — Rising action. Deepen conflicts, test alliances, raise stakes. Maintain forward momentum — avoid consecutive exposition scenes.';
  } else if (progress <= 0.75) {
    actPosition = 'Act 2B — Midpoint crisis to dark moment. Relationships shift, secrets emerge, the cost becomes personal. Secondary characters must show depth.';
  } else if (progress <= 0.90) {
    actPosition = 'Act 3 — Climax approach. All established rules and relationships pay off. No new mechanics. Every action has roots in earlier chapters.';
  } else {
    actPosition = 'Act 3 — Resolution. Close the central emotional conflict. Concrete changes in circumstances, not just internal realizations.';
  }

  // Nonfiction beat planning rules
  const nfBeatRules = isNonfictionProject(project) ? `
NONFICTION BEAT PLANNING RULES:
- Every chapter must contain at least ONE specific human story or account (not just systemic analysis)
- After 2 chapters of heavy evidence, the next should open with a character moment or scene-setting
- Plan beats that alternate: EVIDENCE → HUMAN IMPACT → ANALYSIS → HUMAN MOMENT
- The final beat of every chapter should be a person, a quote, or an image — not a thesis statement
- If using composite accounts, plan ONE clear signal at the start of the composite passage
- Weave research into narrative — no block quotes or lists
` : '';

  // ── ANTHOLOGY: Replace novel context with standalone story context ──
  const isAnthologyBeat = project.project_type === 'anthology';

  if (isAnthologyBeat) {
    const { parseStoryData, ANTHOLOGY_STORY_LENGTHS } = await import('@/lib/anthologyEngine');
    const storyData = parseStoryData(chapter);
    const lengthInfo = ANTHOLOGY_STORY_LENGTHS[project.anthology_story_length || 'short'] || ANTHOLOGY_STORY_LENGTHS.short;

    // ── Genre / beat-style awareness ──────────────────────────────
    // Each story in an anthology should beat according to its configured
    // beat style, not a generic rising-tension arc. Look up the configured
    // beat style in the existing BEAT_STYLES table, then build a
    // scene-structure pattern appropriate to it so the LLM produces beats
    // matching genre conventions (thriller beats pace like thrillers,
    // slow-burn romance beats like slow-burn romance, etc.).
    const configuredBeatStyle = project.beat_style || project.scene_beat_style || '';
    const beatStyleInfo = BEAT_STYLES.find(
      (s) => s.name === configuredBeatStyle || s.id === configuredBeatStyle
    );

    // Scene-structure pattern per beat style. Describes how scenes should
    // be shaped and paced within the story arc for that specific style.
    const BEAT_STYLE_SCENE_PATTERNS = {
      tension:     'Each scene ends on a hook or unresolved question. Stakes escalate scene-by-scene. Tension level rises 5 → 7 → 9 → peak. No scene resolves cleanly until the last.',
      character:   'Each scene is an internal/relational pressure point. External events are triggers, not the subject. Scene goals are emotional or psychological shifts. Avoid plot-action climaxes — the climax is an internal realization or relational rupture.',
      mystery:     'Each scene plants a clue, complicates a clue, or reveals a clue. Misdirection is required — at least one scene must set up a red herring. The final scene delivers the solution through character action, not exposition.',
      slowburn:    'Scenes escalate proximity, not action. Each scene is one increment closer — a shared look, a brush of hands, a confession withheld. Tension comes from what DOESN\'T happen until the late scenes. The intimate or emotional payoff must be earned through delay.',
      epic:        'Scenes weave multiple threads — world/lore/character. Each scene should advance at least two of: protagonist arc, world reveal, stakes escalation. Scope is wide; ground every lore beat in a character moment.',
      literary:    'Scenes are mood pieces tied together by atmosphere more than plot. Tension is ambient, not kinetic. Resolution may be ambiguous. Scene goals can be image-based or thematic, not plot-mechanical.',
      action:      'Short, kinetic scenes. Every scene has physical motion or imminent threat. Scene length targets the lower end. Cliffhangers between scenes are expected. Avoid reflection scenes — move.',
      screwball:   'Scenes escalate chaos through mistaken premises, overlapping misunderstandings, and rapid-fire dialogue. Each scene should compound the previous complication. No scene resolves — the final scene collapses it all at once.',
      drywit:      'Scenes rely on understatement, reaction shots, and dialogue subtext. The humor lives in what characters DON\'T say or how they misread each other. Keep scene goals grounded; let the comedy come from precise observation.',
      darkcomedy:  'Scenes pair grim situations with absurd character responses. The tension is: the situation is terrible and the characters are coping poorly/well in wrong ways. Scene goals should contain the grim premise; the comedic beat emerges from character reaction.',
      absurdist:   'Logic of the world is suspended or inverted. Scenes can break cause-and-effect. Scene goals can be surreal (e.g., "protagonist negotiates with a polite door"). Treat the nonsense as the rules.',
      romcom:      'Scenes alternate attraction and obstacle — pull together, push apart. The "should be together but can\'t get out of their own way" dynamic is expressed in each scene\'s conflict. A grand-gesture or honest-confession scene near the end.',
      caper:       'Scenes show the plan being made, the plan going sideways, and the team improvising. Each scene should contain at least one "we didn\'t plan for this" reversal. Competence and incompetence play off each other.',
    };

    const scenePattern = beatStyleInfo
      ? (BEAT_STYLE_SCENE_PATTERNS[beatStyleInfo.id] || '')
      : '';

    const beatStyleBlock = beatStyleInfo ? `
═══ BEAT STYLE (MANDATORY) ═══
Beat style: ${beatStyleInfo.name}
Style principle: ${beatStyleInfo.desc}

Scene pattern for this style:
${scenePattern}

The beats you generate MUST follow this style's pacing and scene conventions, not a generic "rising tension" arc. A ${beatStyleInfo.name} story should FEEL like its genre from the first beat.
═══ END BEAT STYLE ═══
` : '';
    // ───────────────────────────────────────────────────────────────

    return `${constraintBlock}\n${contextHeader}

═══ STANDALONE SHORT STORY — BEAT GENERATION ═══
You are generating scene beats for a STANDALONE short story in an anthology. This story is COMPLETELY INDEPENDENT — it has its own characters, plot, setting, and resolution. Do NOT reference any other story in the collection.

COLLECTION THEME (the ONLY shared element): ${project.anthology_theme || project.seed_concept || 'unspecified'}
GENRE: ${project.genre || 'Fiction'}

THIS STORY:
Title: ${chapter.title}
Premise: ${storyData?.premise || chapter.beat_summary || ''}
Protagonist: ${storyData?.protagonist?.name || 'TBD'} — ${storyData?.protagonist?.occupation_or_role || '?'}
Setting: ${storyData?.setting?.location || '?'}, ${storyData?.setting?.time_period || '?'}
Conflict: ${storyData?.conflict || ''}
Twist: ${storyData?.twist || storyData?.twist_or_turn || ''}
Ending: ${storyData?.ending_type || 'resolved'}
POV: ${storyData?.pov || project.pov_mode || 'third-close'}
Tense: ${storyData?.tense || project.tense || 'past'}
Tone: ${storyData?.tone || ''}
${voiceGuide ? `\nCollection Voice Guide:\n${voiceGuide}` : ''}
${beatStyleBlock}
TARGET: ~${targetWords} words total across ~${scenesEstimate} scenes.
${lengthInfo.instruction}

${SCENE_BEAT_UNIQUENESS_BLOCK}
Generate approximately ${scenesEstimate} scene beats for this STANDALONE story.

RULES:
- This story must have a COMPLETE arc: beginning, middle, and end — fully contained in this single chapter.
- ALL characters are unique to this story. Do NOT reference characters from other stories.
- The first beat must establish the protagonist and setting.
- The final beat must resolve the story's conflict.
- Beats must form a coherent arc with rising tension toward a climax, then resolution.
${beatStyleInfo ? `- Beats MUST reflect the ${beatStyleInfo.name} beat style described above. Do not default to a generic thriller arc.` : ''}
${spiceBeatBlock}${anthologySpiceBeatCtx}

Each beat must include:
- scene_number, scene_goal, pov_character, setting, conflict, emotional_arc, tension_level, exit_hook

Return JSON only.`;
  }

  return `${constraintBlock}\n${contextHeader}

POSITION: Chapter ${chapterNumber} of ${totalChapters}. ${actPosition}
${nfBeatRules}

World context:
${clipText(project.world_md, 1600)}

Character context:
${clipText(project.characters_md, 1600)}

Outline context:
${clipText(project.outline_md, 1600)}

Canon rules:
${clipText(project.canon_md, 1200)}

Mystery/tension thread:
${clipText(project.mystery_md, 800)}
${voiceGuide ? `\nVoice guide:\n${voiceGuide}` : ''}

CHAPTER ${chapter.chapter_number}: "${chapter.title}"
Beat summary: ${chapter.beat_summary}

Previous chapter ending:
${previousChapter?.content_md?.slice(-800) || 'No previous chapter yet.'}

${SCENE_BEAT_UNIQUENESS_BLOCK}
Generate approximately ${scenesEstimate} scene beats for this chapter (~${targetWords} words total).

Each beat must include:
- scene_number: sequential within this chapter
- scene_goal: what this scene must accomplish for the story
- pov_character: who holds the camera (must obey POV mode rules)
- setting: where and when
- conflict: the specific tension or obstacle in this scene
- emotional_arc: the emotional shift from scene start to end (e.g., "hopeful → desperate")
- tension_level: 1-10 scale for this scene's intensity
- exit_hook: how this scene propels the reader into the next one

Rules:
- Beats must form a coherent arc across the chapter with rising tension
- Each beat must advance plot, character, or both — no filler scenes
- The final beat's exit_hook must create forward momentum into the next chapter
- Every beat must change the story state. If two beats share the same location, people, and core action, merge them or replace the later one with consequence/fallout.
- Scene 2 and later must NEVER restart the chapter premise, re-enter the same initial location, or re-explain the same reveal.
- Respect the canon document — do not contradict established facts
- Match the configured beat style: ${project.beat_style || 'genre default'}
${authorStyleCondensed ? '\n' + authorStyleCondensed + '\n' : ''}
When planning scene beats, include at least ONE of these character-depth moments per scene:
- A character's coping mechanism activating (or failing)
- A dialogue exchange where subtext carries more weight than text
- A physical tell revealing what a character won't say
- A moment where a relationship's specific tension surfaces
- A sensory detail filtered through the POV character's signature sense
- A micro-callback to the character's wound in an unexpected context

Label these in the beat as [CHARACTER DEPTH: description] so the prose writer knows to include them. Example:
"Elara confronts the locked door. [CHARACTER DEPTH: She starts making a mental list of options — her coping mechanism. The list gets shorter. Her breathing changes when she runs out of items.]"
${spiceBeatBlock}${anthologySpiceBeatCtx}
Return JSON only.`;
}

export function getSceneBeatSchema(project) {
  if (project?.book_type === 'nonfiction') return nonfictionBeatSchema;
  return sceneBeatSchema;
}

export function buildChapterPrompt(project, chapter, previousChapter, priorChapterSummaries = []) {
  const contextHeader = buildProjectContextHeader(project);
  const eroticaBlocks = buildEroticaAuthorityBlocks(project);
  const targetWords = project.chapter_length_target || project.target_chapter_words || 3500;
  const minWords = Math.round(targetWords * 0.85);
  const structureMode = NF_STRUCTURE_MODES[project.nf_structure_mode];
  const scenePovRule = SCENE_POV_RULES[project.pov_mode] || SCENE_POV_RULES['third-close'];
  const chapterOpeningRule = getChapterOpeningInstruction(chapter.chapter_number, project.book_type);
  const chapterEndingRule = getChapterEndingInstruction(chapter.chapter_number);

  // The prose writer was never handed the research — it only saw the clipped bible
  // and the beats, so it invented documents to fill scenes. Give it the real
  // research here, with a hard sourcing rule, so it writes from the record.
  // Nonfiction only. This also counters the "paint every scene" pressure by
  // explicitly forbidding invented texture when the record is thin.
  const researchBlock = project.book_type === 'nonfiction' && project.research_data
    ? `\n═══ VERIFIED RESEARCH — YOUR ONLY SOURCE OF REAL FACTS (use these; do NOT invent) ═══\n${(typeof project.research_data === 'string' ? project.research_data : JSON.stringify(project.research_data, null, 2)).slice(0, 14000)}\n═══ END RESEARCH ═══\n\nSOURCING RULE (NONFICTION — ABSOLUTE):\n- Every named document, ledger, record, dispatch, letter, telegram, newspaper, quotation, person, date, and place in your prose MUST come from the research above or the guides. If it is not there, do NOT write it as fact.\n- Do NOT invent documents, ledgers, dispatches, telegrams, newspaper editions, bale counts, box numbers, or dated archival entries to add texture. When the record is thin, write briefly and analytically and say plainly where the record is silent (for example: "no surviving record shows...").\n- NEVER attribute a quotation to a real person unless that exact quote appears in the research above.\n`
    : '';

  // ── COVERAGE TRACKER ── prevents the LLM from re-narrating cases, events,
  // or evidence it already covered in earlier chapters (the Patricia Douglas
  // bug: same case narrated nearly verbatim in three separate chapters).
  // Pass compact structural summaries — not full chapter content — so the
  // model knows what's been said without re-ingesting megabytes of prior text.
  const coverageBlock = (Array.isArray(priorChapterSummaries) && priorChapterSummaries.length)
    ? `\n=== COVERAGE TRACKER — ALREADY NARRATED IN PRIOR CHAPTERS ===\nThe following chapters have ALREADY been written. Their material is OFF-LIMITS for re-narration in this chapter. You may briefly REFERENCE a prior case by name (e.g. "as shown in the Patricia Douglas case") but you must NOT re-tell the story, re-summarize the evidence, or re-quote the same sources. Build on what has been established — do NOT repeat it.\n\n${priorChapterSummaries.map(s => `  - Ch ${s.chapter_number}: "${s.title || 'Untitled'}" — ${(s.beat_summary || '').slice(0, 300).trim()}`).join('\n')}\n\nIf this chapter's beats overlap with material above, narrow your focus to the UNIQUE angle or evidence that distinguishes this chapter from the prior ones. Do NOT produce paragraphs that could be copy-pasted from an earlier chapter.\n=== END COVERAGE TRACKER ===\n`
    : '';

  // Canonical cast gate (fiction only — prevents cross-book contamination).
  // Parses from project.canon_cast (explicit list) with fallback to
  // project.characters_md. Also emits project.deny_characters as FORBIDDEN.
  let castGateBlock = '';
  if (project.book_type !== 'nonfiction') {
    const canonRaw = (project.canon_cast || '').trim();
    const denyRaw = (project.deny_characters || '').trim();
    const canonList = canonRaw ? canonRaw.split(/[,\n]+/).map(s => s.trim()).filter(Boolean) : [];
    const denyList = denyRaw ? denyRaw.split(/[,\n]+/).map(s => s.trim()).filter(Boolean) : [];

    if (canonList.length > 0 || denyList.length > 0) {
      const parts = ['=== CANONICAL CAST (FORBIDDEN NAMES LOCK) ==='];
      parts.push('This book has a fixed cast. Do NOT invent new characters with specific names. Do NOT use character names from other stories, series, or books you have been trained on — even if they fit the genre.');
      if (canonList.length > 0) {
        parts.push('');
        parts.push('CANONICAL CAST (allowed in this book): ' + canonList.join(', '));
        parts.push('If a scene needs an unnamed minor character, describe by role/appearance — do NOT assign a name.');
      }
      if (denyList.length > 0) {
        parts.push('');
        parts.push('🚨 FORBIDDEN NAMES (DO NOT USE): ' + denyList.join(', '));
        parts.push('These names have appeared in erroneous past generations as contamination. They must NEVER appear in this chapter.');
      }
      parts.push('=== END CANONICAL CAST ===');
      castGateBlock = '\n' + parts.join('\n') + '\n';
    }
  }

  return `${MANDATORY_ENFORCEMENT_BLOCK}\n${eroticaBlocks}${contextHeader}\n\n${buildPovTenseBlock(project)}\n\n${buildCraftInjection(project.book_type)}\n${chapterOpeningRule}\n${chapterEndingRule}\n${coverageBlock}${castGateBlock}\nSCENE POV RULE:\n${scenePovRule}\n\n${buildAuthorVoiceInstruction(project)}\n${buildSpiceInstruction(project)}\n\n=== WORD COUNT ENFORCEMENT (CRITICAL) ===\nYou MUST write at least ${minWords} words and aim for ${targetWords} words.\nA chapter under 500 words is a STUB and is unacceptable — it means you summarized instead of writing prose.\nDo NOT write an outline, summary, or description of what happens. Write the FULL PROSE with dialogue, action, interiority, and scene-level detail.\nIf you find yourself writing less than ${minWords} words, EXPAND scenes with more dialogue, sensory detail, character interiority, and physical action.\n=== END WORD COUNT ENFORCEMENT ===\n\n=== OUTPUT FORMAT (MANDATORY — VIOLATIONS WILL BE STRIPPED) ===\nReturn ONLY prose in content_md. No preamble. No commentary.\nDo NOT include chapter title, number, or heading in content_md.\nDo NOT include scene headers or numbers. Only "* * *" between scenes.\nDo not start with "Here is..." or any assistant-style opening.\nDo not end with "Let me know if..." or any assistant-style closing.\nNo content warnings or disclaimers in output.\nNever output meta-commentary, checklists, or instructions.\nDo NOT use markdown headers (##, ###). Chapter titles go in the title field only.\nDo NOT use bold (**text**) or italic (*text*) markdown.\nWrite clean, unformatted prose. Scene breaks use only: * * *\n=== END OUTPUT FORMAT ===\n\n=== DIALOGUE TAGS — MANDATORY ===\nUse "said/says" no more than 4 times per chapter. For all other dialogue, use ACTION BEATS instead of tags.\nWRONG: "I don\'t trust him," Adam says.\nRIGHT: Adam sets down his glass. "I don\'t trust him."\nWRONG: "We need to leave," Lena says.\nRIGHT: Lena pulls her coat off the hook. "We need to leave."\nEvery dialogue line should be preceded or followed by a CHARACTER ACTION, not a "says" tag. This makes dialogue feel cinematic instead of scripted.\n=== END DIALOGUE TAGS ===\n\n=== DIALOGUE-FILLER PROHIBITION ===\nNEVER insert "yet", "then", "and", or "but" between an action beat and an opening dialogue quote. These create ungrammatical fragments.\nWRONG: Earl eyed them skeptically, yet "Y'all got money?"\nWRONG: Mira gasped, and "The dullness..."\nWRONG: They nodded, then "We need to go."\nRIGHT: Earl eyed them skeptically. "Y'all got money?"\nRIGHT: Mira gasped. "The dullness..."\nRIGHT: They nodded. "We need to go."\nThe action beat and the dialogue are two SEPARATE sentences. End the action with a period, start the dialogue with a capital letter.\n=== END DIALOGUE-FILLER PROHIBITION ===\n\nProject title: ${project.title}\nTagline: ${project.tagline}\nSeed concept: ${project.seed_concept}\n\nVoice guide:\n${clipText(project.voice_md, 1800)}\n\nWorld guide:\n${clipText(project.world_md, 2600)}\n\nCharacter / stakeholder guide:\n${clipText(project.characters_md, 2600)}\n\nOutline guide:\n${clipText(project.outline_md, 2600)}\n\nCanon guide:\n${clipText(project.canon_md, 1800)}\n${researchBlock}\nChapter plan:\nTitle: ${chapter.title}\nBeat summary: ${chapter.beat_summary}\n\n${chapter.scene_beats_json ? (project.book_type === 'nonfiction'
    ? `NONFICTION SECTION BEATS (you MUST follow this section-by-section structure):\n${chapter.scene_beats_json}\n\nCRITICAL: Write one section per beat above. Each section must:\n- Follow its assigned MODE (${Object.entries(NF_SECTION_MODES).map(([k, v]) => `${k}: ${v}`).join('; ')})\n- Accomplish its stated purpose and content_direction\n- Make its key_claim clearly\n- Open and close as directed (opens_with / closes_with)\n- Hit approximately its word_target\n- Respect fabrication_warnings — do NOT invent unsourced facts\nDo not skip, merge, or reorder sections.\n`
    : `SCENE BEATS (you MUST follow this beat-by-beat structure):\n${chapter.scene_beats_json}\n\nCRITICAL: Write one scene per beat above. Each scene must accomplish its stated scene_goal, honor its pov_character, hit its emotional_arc, and end with its exit_hook. Do not skip, merge, or reorder beats.\n`) : ''}\nPrevious chapter excerpt:\n${previousChapter?.content_md?.slice(-1600) || 'No previous chapter yet.'}\n\nRequirements:\n- Write strong markdown prose with a chapter heading.\n- Write approximately ${targetWords} words.\n- Keep continuity with the existing canon and voice.\n- revision_notes should be 2 to 4 short bullet-style suggestions for the next pass.\n- score should be a realistic draft quality score from 6.0 to 9.5.\n- word_count should match the draft.\n${project.book_type === 'nonfiction' ? `- This is nonfiction. Do not invent unsupported facts.\n- Use the ${project.nf_structure_mode || 'prescriptive'} pattern: ${structureMode?.pattern || 'Framework → Evidence → Application → Takeaway'}.\n- ${structureMode?.chapterPrompt || 'Write with clarity and evidentiary discipline.'}` : `- Match the requested genre promise and beat style: ${project.beat_style || project.scene_beat_style || 'Not specified'}.\n- For third-multi POV, preserve single-POV scenes and mark POV shifts with scene breaks when needed.\n- End with forward momentum.`}\n\nReturn only structured data matching the requested schema.`;
}

export function buildEvaluationPrompt(project, chapters) {
  const contextHeader = buildProjectContextHeader(project);
  const targetWords = project.chapter_length_target || project.target_chapter_words || 3500;
  const lowTarget = Math.round(targetWords * 0.7);
  const highTarget = Math.round(targetWords * 1.3);
  const draftedChapters = chapters
    .filter((chapter) => chapter.content_md)
    .sort((a, b) => a.chapter_number - b.chapter_number)
    .slice(0, 6)
    .map((chapter) => `Chapter ${chapter.chapter_number}: ${chapter.title}\n${clipText(chapter.content_md, 1400)}`)
    .join('\n\n');

  return `${contextHeader}\n\nEvaluate this AutoNovel-style project like a strict developmental editor.\n\nProject title: ${project.title}\nTagline: ${project.tagline}\nCurrent phase: ${project.phase}\n\nFoundation excerpts:\nWorld:\n${clipText(project.world_md, 1200)}\n\nCharacters / stakeholders:\n${clipText(project.characters_md, 1200)}\n\nOutline:\n${clipText(project.outline_md, 1200)}\n\nDrafted chapters:\n${draftedChapters || 'No drafted chapters yet.'}\n\nScoring rules:\n- Penalize drift from the selected genre, POV, tense, and author-voice intent.\n- Deduct heavily for tense drift, POV breaks, clinical descriptors, and second-person intrusion in non-second-person narration.\n- Penalize failure to honor the requested beat style or nonfiction structure mode.\n- Penalize chapters that repeatedly land below ${lowTarget} or above ${highTarget} words.\n${project.book_type === 'nonfiction' ? '- Penalize unsupported claims, weak evidence logic, and vague sourcing discipline.' : '- Penalize flat pacing, weak emotional escalation, or inconsistent intimacy settings.'}\n\nReturn:\n- novel_score from 1 to 10\n- foundation_score from 1 to 10\n- current_focus as the single most important next move\n- arc_summary_md as a concise markdown summary of the story so far\n- notes as a concise editorial assessment with strengths and weaknesses`;
}

export const chapterReviewSchema = {
  type: 'object',
  properties: {
    audience_score: { type: 'number', description: '1-100, Rotten Tomatoes style audience enjoyment score' },
    critic_score: { type: 'number', description: '1-100, Rotten Tomatoes style critic/craft score' },
    verdict: { type: 'string', description: 'Fresh, Certified Fresh, or Rotten' },
    one_line: { type: 'string', description: 'One-sentence critical summary like a Rotten Tomatoes blurb' },
    strengths: { type: 'array', items: { type: 'string' }, description: 'What works well in this chapter' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'slop|repetition|pov_break|tense_drift|pacing|continuity|dialogue|telling|cliche|structure' },
          severity: { type: 'string', description: 'minor|moderate|critical' },
          description: { type: 'string' },
          quote: { type: 'string', description: 'The exact problematic text from the chapter' },
          fix: { type: 'string', description: 'The corrected replacement text' },
        },
        required: ['category', 'severity', 'description', 'quote', 'fix'],
      },
    },
    revised_content_md: { type: 'string', description: 'The full chapter text with ALL fixes applied inline' },
  },
  required: ['audience_score', 'critic_score', 'verdict', 'one_line', 'strengths', 'issues', 'revised_content_md'],
};

export function buildChapterReviewPrompt(project, chapter) {
  const contextHeader = buildProjectContextHeader(project);

  return `${MANDATORY_ENFORCEMENT_BLOCK}\n${contextHeader}

${buildCraftInjection(project.book_type)}

You are a ruthless but fair literary editor AND an audience test reader combined. Your job is to SCAN this chapter for every AI-generated literature problem, then FIX each one.

PROJECT: ${project.title}
GENRE: ${project.genre}${project.subgenre ? ' / ' + project.subgenre : ''}
POV: ${project.pov_mode} | TENSE: ${project.tense}

Voice guide:
${clipText(project.voice_md, 1200)}

Canon rules:
${clipText(project.canon_md, 1000)}

CHAPTER ${chapter.chapter_number}: "${chapter.title}"
CONTENT:
${chapter.content_md}

=== SCAN INSTRUCTIONS ===

DETECT these categories of problems:
1. **SLOP** — AI vocabulary crutches (delve, tapestry, testament, piercing gaze, etc.), filler phrases, hedge chains
2. **REPETITION** — Repeated words/phrases within close proximity, same sentence structures back-to-back, repeated emotional beats. ANY non-name noun phrase appearing more than 8 times must be flagged and replaced with synonyms/rephrasing.
3. **POV BREAKS** — Narration that violates the configured POV mode (${project.pov_mode})
4. **TENSE DRIFT** — Shifts from configured tense (${project.tense}) without narrative justification
5. **PACING** — Scenes that drag, summary where scene is needed, rushed climactic moments
6. **CONTINUITY** — Contradictions with canon, character inconsistencies, setting errors${chapter.chapter_number === 1 ? '\n   NOTE: This is Chapter 1 — there are NO previous chapters. Do NOT flag continuity issues about missing backstory, unexplained world elements, or character introductions. Chapter 1 is where these are ESTABLISHED, not where they need prior references. Only flag internal contradictions within this chapter itself.' : ''}
7. **DIALOGUE** — Characters speaking in identical voices, overly polished speech, missing subtext
8. **TELLING** — Naming emotions instead of showing them, over-explaining, redundant emotional narration
9. **CLICHE** — Stock phrases, generic metaphors, AI-typical descriptions (hair cascading, eyes piercing, etc.)
10. **STRUCTURE** — Uniform paragraph lengths, triadic listing, every scene following the same template
11. **CAPITALIZATION** — Every sentence must begin with a capital letter. After sentence-ending punctuation (. ! ?), the next word MUST be capitalized. Do NOT change capitalization inside dialogue quotes or intentional stylistic lowercase.
12. **SENSORY/ACTION WORD CAPS** — Flag these words if they exceed their per-chapter cap: "shuddered" (max 2), "whispered" (max 4), "snarled" (max 2), "rasped" (max 2), "exhaled" (max 3), "clenched"/"clenching" (max 3 combined), "eyes met"/"their eyes" (max 2). Replace excess with varied alternatives.
13. **BANNED WORDS** — Zero-tolerance removal of: shimmering, luminous, tapestry, intricate, meticulously, insatiable, palpable, unmistakable, undeniable, relentless, sprawling, labyrinthine, opulent, resplendent, ethereal, visceral, cacophony, crescendo, juxtaposition, myriad, plethora, testament, harbinger, paradigm, dichotomy. Especially enforce: "relentless" → "unrelenting"/"ceaseless", "visceral" → "raw"/"primal", "undeniable" → "clear"/"absolute".

=== SCORING ===

**Critic Score (0-100):** Rate the CRAFT — prose quality, structural integrity, voice consistency, originality. Think: "Would a literary critic respect this?"
- 90+ = Exceptional craft, publishable as-is
- 75-89 = Strong with minor issues
- 60-74 = Competent but has noticeable AI tells
- 40-59 = Significant problems needing revision
- Below 40 = Needs complete rewrite

**Audience Score (0-100):** Rate the ENJOYMENT — engagement, emotional impact, page-turn factor. Think: "Would a reader of ${project.genre} enjoy this?"
- 90+ = Couldn't put it down
- 75-89 = Engaging, would keep reading
- 60-74 = Fine but forgettable
- 40-59 = Would probably stop reading
- Below 40 = DNF

**Verdict:** "Certified Fresh" (both ≥75), "Fresh" (average ≥60), or "Rotten" (average <60)

=== FIX INSTRUCTIONS ===

For EVERY issue found:
- Quote the exact problematic text
- Provide a concrete fix (replacement text)
- Then produce revised_content_md with ALL fixes applied — this is the corrected full chapter text

The revised text must preserve the chapter's meaning and flow while eliminating every detected problem. Do not add new content — only fix what's broken.

Return JSON only.`;
}

export function buildCoverPrompt(project) {
  const typeDescriptor = project.book_type === 'nonfiction' ? 'premium nonfiction book' : 'premium fiction book';

  return `Design a sophisticated cover for a ${typeDescriptor} titled "${project.title}" by ${project.author_name || 'Hermes Agent'}.\n\nGenre: ${project.genre || 'General'}\nTagline: ${project.tagline}\nSeed concept: ${project.seed_concept}\n\nArt direction:\n- elegant, premium publishing feel\n- moody, atmospheric composition\n- symbolic imagery over literal scene recreation\n- rich texture and strong shelf presence\n- no mockup, only cover artwork\n- no readable text baked into the image`;
}

export function formatPhase(phase = 'foundation') {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}