/**
 * Pacing Modulation System — Story Arc Templates & Chapter Intensity
 *
 * The beat style is the book's genre voice (HOW to write it).
 * The story arc is the SHAPE of the emotional journey (HOW INTENSE to write it).
 */

// ── Story Arc Descriptions (for UI) ─────────────────────────────────────

export const STORY_ARC_OPTIONS = [
  { value: 'three_act',           label: 'Three-Act Structure (default)' },
  { value: 'save_the_cat',        label: 'Save the Cat' },
  { value: 'heros_journey',       label: "Hero's Journey" },
  { value: 'romance_arc',         label: 'Romance Arc' },
  { value: 'mystery_reveal',      label: 'Mystery / Reveal Arc' },
  { value: 'tragedy',             label: 'Tragedy / Downfall Arc' },
  { value: 'thriller_escalation', label: 'Thriller Escalation' },
  { value: 'horror_descent',      label: 'Horror Descent' },
  { value: 'literary_character',  label: 'Literary / Character Study' },
  { value: 'epic_saga',           label: 'Epic Saga (multi-thread)' },
];

export function getArcDescription(arc) {
  const descriptions = {
    'three_act': 'Classic setup → confrontation → resolution. Balanced peaks and valleys. Works for most genres.',
    'save_the_cat': "Blake Snyder structure: opening image → debate → break into two → midpoint → all is lost → finale. Precise beat placement.",
    'heros_journey': "Campbell monomyth: ordinary world → call → threshold → trials → ordeal → reward → return. Longer buildup, transformative climax.",
    'romance_arc': 'Meet → friction → first kiss → intimacy → black moment → grand gesture → HEA. Emotional peaks at relationship milestones.',
    'mystery_reveal': 'Hook → clues → red herrings → mid-reveal → deeper mystery → confrontation → full reveal. Tension from information, not action.',
    'tragedy': 'Rise → hubris → warnings ignored → reversal → downfall → aftermath. Tension inverts — the protagonist causes their own destruction.',
    'thriller_escalation': 'Relentless ratchet with brief recovery valleys. Each act is higher stakes than the last. Minimal downtime.',
    'horror_descent': 'Slow creep → normalization → escalation → point of no return → full nightmare → survival or destruction. Dread over action.',
    'literary_character': 'Internal transformation drives structure. External events are catalysts for psychological change. Slow, deep, contemplative.',
    'epic_saga': 'Multiple interwoven threads with staggered climaxes. Chapters alternate between plotlines at different tension levels.',
  };
  return descriptions[arc] || '';
}

// ── The 10 Story Arc Templates ───────────────────────────────────────────

export const STORY_ARCS = {

  'three_act': {
    name: 'Three-Act Structure',
    beats: [
      { at: 0.00, tension: 4, pace: 'measured',   interiority: 'high',     breath: 'Establish world and character. Show the ordinary before the extraordinary.' },
      { at: 0.05, tension: 5, pace: 'moderate',   interiority: 'high',     breath: 'Deepen character. A routine, a relationship, something the reader can hold onto.' },
      { at: 0.10, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.15, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.20, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'The character resists the call. A scene of normalcy slipping away.' },
      { at: 0.25, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.30, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'Recovery. The character regroups, bonds with allies, plans.' },
      { at: 0.35, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.40, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.45, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'Calm before midpoint. Deepen a relationship. A vulnerable moment.' },
      { at: 0.50, tension: 8, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.55, tension: 6, pace: 'moderate',   interiority: 'high',     breath: 'Process the midpoint revelation. Emotional fallout. The stakes are personal now.' },
      { at: 0.60, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.65, tension: 8, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.70, tension: 6, pace: 'measured',   interiority: 'high',     breath: 'Last breath before the spiral. A moment of choice, a goodbye, a small kindness.' },
      { at: 0.75, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.80, tension: 6, pace: 'measured',   interiority: 'high',     breath: 'The decision to fight. Quiet determination. The final plan.' },
      { at: 0.85, tension: 8, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.90, tension: 10, pace: 'breakneck', interiority: 'low',      breath: null },
      { at: 0.95, tension: 5, pace: 'measured',   interiority: 'high',     breath: null },
      { at: 1.00, tension: 3, pace: 'slow',       interiority: 'high',     breath: 'Resolution. The new normal. A quiet image that mirrors the opening.' },
    ],
  },

  'save_the_cat': {
    name: 'Save the Cat',
    beats: [
      { at: 0.00, tension: 4, pace: 'moderate',   interiority: 'high',     breath: 'Opening Image: establish the "before" snapshot of the character.' },
      { at: 0.05, tension: 5, pace: 'moderate',   interiority: 'high',     breath: "Theme Stated: someone says the theme to the protagonist. They don't get it yet." },
      { at: 0.10, tension: 4, pace: 'measured',   interiority: 'high',     breath: 'Setup: show the world, the flaws, the stasis=death situation.' },
      { at: 0.15, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.20, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'Debate: the character resists, weighs options, fears change.' },
      { at: 0.25, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.30, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'B Story begins: the relationship that carries the theme.' },
      { at: 0.35, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: 'Fun and Games: the promise of the premise. The reason the reader bought the book.' },
      { at: 0.40, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: 'Fun and Games continues — but hints of difficulty emerge.' },
      { at: 0.50, tension: 8, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.55, tension: 7, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.60, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.65, tension: 8, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.70, tension: 6, pace: 'measured',   interiority: 'high',     breath: 'Internal team fractures. The B Story relationship is tested.' },
      { at: 0.75, tension: 9, pace: 'breakneck',  interiority: 'moderate', breath: null },
      { at: 0.80, tension: 4, pace: 'slow',       interiority: 'high',     breath: 'Dark Night of the Soul. The lowest point. Stillness, not action.' },
      { at: 0.85, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.90, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.95, tension: 10, pace: 'breakneck', interiority: 'low',      breath: null },
      { at: 1.00, tension: 3, pace: 'slow',       interiority: 'high',     breath: 'Final Image: the "after" snapshot. Mirror the opening to show transformation.' },
    ],
  },

  'heros_journey': {
    name: "Hero's Journey",
    beats: [
      { at: 0.00, tension: 3, pace: 'slow',       interiority: 'high',     breath: "Ordinary World: deep immersion in the hero's normal life. The reader needs to feel what's at stake." },
      { at: 0.08, tension: 5, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 0.12, tension: 4, pace: 'measured',   interiority: 'high',     breath: 'Refusal of the Call: fear, doubt, obligation. The hero is not ready.' },
      { at: 0.18, tension: 5, pace: 'moderate',   interiority: 'high',     breath: 'Meeting the Mentor: a scene of teaching, gift-giving, or wisdom.' },
      { at: 0.25, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.30, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'Tests, Allies, Enemies: build the new world. Relationships form.' },
      { at: 0.35, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: 'Training or bonding sequence. A moment of belonging in the new world.' },
      { at: 0.40, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.45, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'Preparation. The last quiet moment. A confession or a prayer.' },
      { at: 0.50, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.55, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'Reward: the hero takes the prize. A moment of triumph and rest.' },
      { at: 0.60, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.70, tension: 8, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.80, tension: 6, pace: 'measured',   interiority: 'high',     breath: 'The hero must choose: the old world or the new. Internal reckoning.' },
      { at: 0.85, tension: 10, pace: 'breakneck', interiority: 'low',      breath: null },
      { at: 0.95, tension: 4, pace: 'measured',   interiority: 'high',     breath: null },
      { at: 1.00, tension: 3, pace: 'slow',       interiority: 'high',     breath: 'Return with the Elixir: the hero brings something back. Show the change.' },
    ],
  },

  'romance_arc': {
    name: 'Romance Arc',
    beats: [
      { at: 0.00, tension: 3, pace: 'measured',   interiority: 'high',     breath: "Establish the protagonist's emotional wound and why they resist love." },
      { at: 0.08, tension: 6, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 0.15, tension: 4, pace: 'measured',   interiority: 'high',     breath: "Reluctant proximity. They're forced together. Show the friction AND the pull." },
      { at: 0.20, tension: 5, pace: 'moderate',   interiority: 'high',     breath: 'A moment of unexpected vulnerability from one of them.' },
      { at: 0.25, tension: 7, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 0.30, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'The morning after (emotional, not necessarily physical). Doubt. Fear of wanting.' },
      { at: 0.35, tension: 4, pace: 'slow',       interiority: 'high',     breath: 'A scene of genuine intimacy — not physical, but emotional. They see each other.' },
      { at: 0.40, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.45, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'They choose each other despite the obstacle. A private commitment.' },
      { at: 0.50, tension: 7, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 0.55, tension: 4, pace: 'slow',       interiority: 'high',     breath: "The golden period. Happiness. The reader needs to feel what's about to be lost." },
      { at: 0.60, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.65, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.75, tension: 9, pace: 'brisk',      interiority: 'high',     breath: null },
      { at: 0.80, tension: 5, pace: 'slow',       interiority: 'high',     breath: 'Alone. Each reflects on what they lost. The wound re-opens. They realize the lie they told themselves.' },
      { at: 0.85, tension: 7, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 0.90, tension: 8, pace: 'brisk',      interiority: 'high',     breath: null },
      { at: 0.95, tension: 4, pace: 'slow',       interiority: 'high',     breath: null },
      { at: 1.00, tension: 2, pace: 'slow',       interiority: 'high',     breath: 'HEA or HFN. A small, domestic, grounded image of the new life together.' },
    ],
  },

  'mystery_reveal': {
    name: 'Mystery / Reveal Arc',
    beats: [
      { at: 0.00, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.05, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'Establish the investigator and their method. Show competence and a personal flaw.' },
      { at: 0.10, tension: 5, pace: 'measured',   interiority: 'moderate', breath: 'Gather initial evidence. Interview witnesses. Establish the world of suspects.' },
      { at: 0.15, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.20, tension: 5, pace: 'measured',   interiority: 'high',     breath: "A scene that develops the investigator's personal life — the human behind the badge." },
      { at: 0.25, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.30, tension: 5, pace: 'measured',   interiority: 'moderate', breath: 'Re-examine evidence. A quiet scene of thinking, connecting, doubting.' },
      { at: 0.35, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.40, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.45, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'The investigator doubts their theory. Personal stakes intersect with the case.' },
      { at: 0.50, tension: 8, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.55, tension: 6, pace: 'measured',   interiority: 'high',     breath: 'Everything they thought was wrong. Regroup. The real mystery is deeper.' },
      { at: 0.60, tension: 7, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.65, tension: 7, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.70, tension: 6, pace: 'measured',   interiority: 'high',     breath: 'Personal cost of the investigation. A relationship strained or broken.' },
      { at: 0.75, tension: 8, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.80, tension: 6, pace: 'measured',   interiority: 'high',     breath: 'The final piece. A quiet realization. The investigator SEES it.' },
      { at: 0.85, tension: 9, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.90, tension: 10, pace: 'breakneck', interiority: 'low',      breath: null },
      { at: 0.95, tension: 5, pace: 'measured',   interiority: 'high',     breath: null },
      { at: 1.00, tension: 3, pace: 'slow',       interiority: 'high',     breath: 'Resolution. Justice or its absence. The investigator is changed.' },
    ],
  },

  'tragedy': {
    name: 'Tragedy / Downfall Arc',
    beats: [
      { at: 0.00, tension: 3, pace: 'measured',   interiority: 'high',     breath: 'Show the protagonist at their best. Competent, admired, powerful. The reader must love them before they fall.' },
      { at: 0.10, tension: 5, pace: 'moderate',   interiority: 'high',     breath: 'The flaw is visible but functional. It looks like strength.' },
      { at: 0.15, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.20, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'Someone warns them. They dismiss it. Show the hubris as confidence.' },
      { at: 0.25, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.30, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'A scene of success. The compromise paid off. The reader feels the seduction.' },
      { at: 0.35, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.40, tension: 7, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.45, tension: 5, pace: 'measured',   interiority: 'high',     breath: "A loved one notices the change. A conversation that should be a wake-up call but isn't." },
      { at: 0.50, tension: 8, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.55, tension: 7, pace: 'moderate',   interiority: 'high',     breath: 'The first consequence. Someone gets hurt. The protagonist rationalizes.' },
      { at: 0.60, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.65, tension: 8, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.70, tension: 6, pace: 'measured',   interiority: 'high',     breath: "The last chance to turn back. They almost do. Then they don't." },
      { at: 0.75, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.80, tension: 8, pace: 'brisk',      interiority: 'high',     breath: null },
      { at: 0.85, tension: 9, pace: 'breakneck',  interiority: 'moderate', breath: null },
      { at: 0.90, tension: 10, pace: 'breakneck', interiority: 'high',     breath: null },
      { at: 0.95, tension: 5, pace: 'slow',       interiority: 'high',     breath: 'The aftermath. Silence. What remains.' },
      { at: 1.00, tension: 3, pace: 'slow',       interiority: 'high',     breath: 'A final image of loss. Not dramatic — quiet. The empty chair, the unanswered phone.' },
    ],
  },

  'thriller_escalation': {
    name: 'Thriller Escalation',
    beats: [
      { at: 0.00, tension: 6, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.05, tension: 5, pace: 'moderate',   interiority: 'high',     breath: 'Brief tactical pause. The protagonist assesses. Show competence under pressure.' },
      { at: 0.10, tension: 7, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.15, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: 'A moment with an ally. Brief, functional, but human. 30 seconds of breathing.' },
      { at: 0.20, tension: 8, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.25, tension: 6, pace: 'moderate',   interiority: 'high',     breath: 'Recovery valley. Tend wounds. A reveal that raises new questions.' },
      { at: 0.30, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.35, tension: 8, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.40, tension: 6, pace: 'moderate',   interiority: 'high',     breath: 'The only extended quiet. A memory. A phone call. The stakes become personal.' },
      { at: 0.45, tension: 8, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.50, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.55, tension: 7, pace: 'moderate',   interiority: 'moderate', breath: 'Shortest valley. Regroup. The plan changes. 2 paragraphs of breathing, then back in.' },
      { at: 0.60, tension: 8, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.65, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.70, tension: 7, pace: 'moderate',   interiority: 'high',     breath: 'The betrayal or the twist. A quiet scene that detonates everything.' },
      { at: 0.75, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.80, tension: 8, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.85, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.90, tension: 10, pace: 'breakneck', interiority: 'low',      breath: null },
      { at: 0.95, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 1.00, tension: 4, pace: 'measured',   interiority: 'high',     breath: 'Short, earned resolution. The protagonist sits down for the first time in the book.' },
    ],
  },

  'horror_descent': {
    name: 'Horror Descent',
    beats: [
      { at: 0.00, tension: 3, pace: 'slow',       interiority: 'high',     breath: 'Normal. Aggressively normal. The reader should feel safe. That safety is the setup.' },
      { at: 0.05, tension: 4, pace: 'measured',   interiority: 'high',     breath: 'One wrong thing. Small. Dismissible. A sound, a smell, a shadow.' },
      { at: 0.10, tension: 4, pace: 'measured',   interiority: 'high',     breath: "Life continues. But the wrong thing happened and the character can't quite forget it." },
      { at: 0.15, tension: 5, pace: 'measured',   interiority: 'high',     breath: null },
      { at: 0.20, tension: 5, pace: 'measured',   interiority: 'high',     breath: "Rationalization. There's an explanation. There has to be." },
      { at: 0.25, tension: 6, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 0.30, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'A scene of attempted normalcy. Dinner. Work. It feels wrong now. The familiar is contaminated.' },
      { at: 0.35, tension: 6, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 0.40, tension: 7, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 0.45, tension: 5, pace: 'slow',       interiority: 'high',     breath: 'The character tries to get help. No one believes them. Isolation deepens.' },
      { at: 0.50, tension: 7, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.55, tension: 6, pace: 'measured',   interiority: 'high',     breath: "A false calm. Maybe it's over. The reader knows it isn't." },
      { at: 0.60, tension: 8, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.65, tension: 7, pace: 'moderate',   interiority: 'high',     breath: "The character understands what they're facing. The dread is knowledge, not surprise." },
      { at: 0.70, tension: 8, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.75, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.80, tension: 7, pace: 'measured',   interiority: 'high',     breath: "A moment of terrible clarity. The character accepts what's happening." },
      { at: 0.85, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.90, tension: 10, pace: 'breakneck', interiority: 'low',      breath: null },
      { at: 0.95, tension: 6, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 1.00, tension: 4, pace: 'slow',       interiority: 'high',     breath: 'Survival or destruction. Either way, something lingers. The last line should unsettle.' },
    ],
  },

  'literary_character': {
    name: 'Literary / Character Study',
    beats: [
      { at: 0.00, tension: 3, pace: 'slow',       interiority: 'high',     breath: 'A sustained observation. The character in their element. Voice is everything here.' },
      { at: 0.10, tension: 3, pace: 'slow',       interiority: 'high',     breath: 'Deepen the interior life. A memory, a habit, a way of seeing the world that is uniquely theirs.' },
      { at: 0.15, tension: 4, pace: 'measured',   interiority: 'high',     breath: null },
      { at: 0.20, tension: 4, pace: 'measured',   interiority: 'high',     breath: "A relationship that challenges the character's self-image. Friction without melodrama." },
      { at: 0.25, tension: 5, pace: 'measured',   interiority: 'high',     breath: null },
      { at: 0.30, tension: 4, pace: 'slow',       interiority: 'high',     breath: 'A scene of beauty or stillness that carries thematic weight. The world as metaphor.' },
      { at: 0.35, tension: 5, pace: 'measured',   interiority: 'high',     breath: null },
      { at: 0.40, tension: 6, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 0.50, tension: 6, pace: 'moderate',   interiority: 'high',     breath: 'The character sees themselves clearly for the first time. It hurts.' },
      { at: 0.55, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'Sitting with the truth. No action. Just the weight of understanding.' },
      { at: 0.60, tension: 6, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 0.65, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'A conversation that changes everything, said quietly over coffee or a walk.' },
      { at: 0.70, tension: 7, pace: 'moderate',   interiority: 'high',     breath: null },
      { at: 0.75, tension: 6, pace: 'measured',   interiority: 'high',     breath: "The decision. Not dramatic. Quiet. Internal. The reader might not even notice it happened." },
      { at: 0.80, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'Living differently. Small changes. A new habit. A different response to a familiar situation.' },
      { at: 0.85, tension: 4, pace: 'slow',       interiority: 'high',     breath: 'A revisitation of an early scene, now experienced differently because the character has changed.' },
      { at: 0.90, tension: 5, pace: 'measured',   interiority: 'high',     breath: null },
      { at: 1.00, tension: 3, pace: 'slow',       interiority: 'high',     breath: 'An image of the new life. Not resolution — continuation. The character goes on, altered.' },
    ],
  },

  'epic_saga': {
    name: 'Epic Saga',
    beats: [
      { at: 0.00, tension: 4, pace: 'measured',   interiority: 'high',     breath: 'Establish Thread A. Ground the reader in one world before introducing the others.' },
      { at: 0.05, tension: 4, pace: 'measured',   interiority: 'high',     breath: 'Establish Thread B. New setting, new character, new stakes.' },
      { at: 0.10, tension: 5, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.15, tension: 4, pace: 'measured',   interiority: 'high',     breath: "Thread B develops. When switching threads, the contrast in pace IS the breathing room." },
      { at: 0.20, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.25, tension: 7, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.30, tension: 4, pace: 'measured',   interiority: 'high',     breath: "Thread B quiet scene. The reader exhales after Thread A's peak." },
      { at: 0.35, tension: 6, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.40, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.45, tension: 5, pace: 'measured',   interiority: 'high',     breath: 'Convergence setup. Characters from different threads learn of each other.' },
      { at: 0.50, tension: 8, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.55, tension: 6, pace: 'moderate',   interiority: 'high',     breath: "Recovery from B's peak via A's development. Stagger the energy." },
      { at: 0.60, tension: 7, pace: 'brisk',      interiority: 'moderate', breath: null },
      { at: 0.65, tension: 8, pace: 'brisk',      interiority: 'low',      breath: null },
      { at: 0.70, tension: 6, pace: 'measured',   interiority: 'high',     breath: 'Last breathing room. The threads are about to collide.' },
      { at: 0.75, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.80, tension: 7, pace: 'moderate',   interiority: 'moderate', breath: null },
      { at: 0.85, tension: 9, pace: 'breakneck',  interiority: 'low',      breath: null },
      { at: 0.90, tension: 10, pace: 'breakneck', interiority: 'low',      breath: null },
      { at: 0.95, tension: 5, pace: 'measured',   interiority: 'high',     breath: null },
      { at: 1.00, tension: 3, pace: 'slow',       interiority: 'high',     breath: 'Diverge again. Each thread gets a brief resolution. The world is changed.' },
    ],
  },
};

// ── Beat style modifiers ─────────────────────────────────────────────────

const STYLE_MODIFIERS = {
  'Fast-Paced Thriller':       { tensionMod: +1, paceFloor: 'moderate' },
  'Fast-Paced Action':         { tensionMod: +1, paceFloor: 'moderate' },
  'Tension-Driven':            { tensionMod: +1, paceFloor: 'moderate' },
  'Gritty Cinematic':          { tensionMod: +1, paceFloor: 'measured' },
  'Hollywood Blockbuster':     { tensionMod: 0,  paceFloor: 'moderate' },
  'Slow Burn Romance':         { tensionMod: -2, paceFloor: 'slow' },
  'Dark Suspense':             { tensionMod: 0,  paceFloor: 'measured' },
  'Clean Romance':             { tensionMod: -2, paceFloor: 'slow' },
  'Mystery Unravel':           { tensionMod: 0,  paceFloor: 'measured' },
  'Visceral Horror':           { tensionMod: +2, paceFloor: 'moderate' },
  'Cerebral Sci-Fi':           { tensionMod: -1, paceFloor: 'measured' },
  'Character Study':           { tensionMod: -1, paceFloor: 'measured' },
  'Whimsical Cozy':            { tensionMod: -3, paceFloor: 'slow' },
  'Epic World-Building':       { tensionMod: 0,  paceFloor: 'measured' },
  'Literary Atmospheric':      { tensionMod: -2, paceFloor: 'slow' },
  'Screwball Comedy':          { tensionMod: -1, paceFloor: 'moderate' },
  'Dry Wit / Deadpan':         { tensionMod: -1, paceFloor: 'measured' },
  'Dark Comedy':               { tensionMod: 0,  paceFloor: 'moderate' },
  'Absurdist / Surreal Comedy':{ tensionMod: -1, paceFloor: 'measured' },
  'Romantic Comedy':           { tensionMod: -1, paceFloor: 'moderate' },
  'Comic Caper / Heist Comedy':{ tensionMod: 0,  paceFloor: 'moderate' },
};

const PACE_ORDER = ['slow', 'measured', 'moderate', 'brisk', 'breakneck'];

// ── Interpolation Function ───────────────────────────────────────────────

export function getChapterPacing(chapterNumber, totalChapters, storyArc, beatStyle) {
  const position = chapterNumber / totalChapters;
  const arc = STORY_ARCS[storyArc] || STORY_ARCS['three_act'];
  const beats = arc.beats;

  // Find the two beats this chapter falls between
  let before = beats[0];
  let after = beats[beats.length - 1];

  for (let i = 0; i < beats.length - 1; i++) {
    if (position >= beats[i].at && position <= beats[i + 1].at) {
      before = beats[i];
      after = beats[i + 1];
      break;
    }
  }

  // Interpolate tension
  const range = after.at - before.at;
  const progress = range > 0 ? (position - before.at) / range : 0;
  const tension = Math.round(before.tension + (after.tension - before.tension) * progress);

  // Use the nearest beat's discrete values
  const nearest = progress < 0.5 ? before : after;
  const pace = nearest.pace;
  const interiority = nearest.interiority;
  const breath = nearest.breath;

  // Apply beat style modifier
  const mod = STYLE_MODIFIERS[beatStyle] || { tensionMod: 0, paceFloor: 'measured' };
  const finalTension = Math.max(1, Math.min(10, tension + mod.tensionMod));

  const paceIdx = PACE_ORDER.indexOf(pace);
  const floorIdx = PACE_ORDER.indexOf(mod.paceFloor);
  const finalPace = paceIdx < floorIdx ? PACE_ORDER[floorIdx] : pace;

  return {
    chapter: chapterNumber,
    position: Math.round(position * 100),
    tension: finalTension,
    pace: finalPace,
    interiority,
    breathingRoom: breath,
    arcName: arc.name,
  };
}

// ── Build pacing block for injection into prose prompt ────────────────────

export function buildPacingBlock(project, chapter) {
  const totalChapters = project.chapter_target || 20;
  const pacing = getChapterPacing(
    chapter.chapter_number,
    totalChapters,
    project.story_arc || 'three_act',
    project.beat_style || ''
  );

  let block = `\n=== CHAPTER PACING MODULATION (Chapter ${pacing.chapter} of ${totalChapters}) ===\n`;
  block += `Story Arc: ${pacing.arcName}\n`;
  block += `Position: ${pacing.position}% through the story\n\n`;

  block += `TENSION LEVEL: ${pacing.tension}/10\n`;
  if (pacing.tension <= 3) block += 'LOW — this is a breathing chapter. Prioritize character, reflection, quiet moments.\n';
  else if (pacing.tension <= 6) block += 'MODERATE — balance action and interiority. The reader is alert but not exhausted.\n';
  else if (pacing.tension <= 8) block += 'HIGH — escalate. Shorter sentences. Faster cuts. Stakes are immediate.\n';
  else block += 'MAXIMUM — this is a peak scene. Relentless forward momentum. No pausing for reflection.\n';

  block += `\nPACE: ${pacing.pace.toUpperCase()}\n`;
  if (pacing.pace === 'slow') block += 'Long sentences allowed. Descriptive passages. Let silence carry weight.\n';
  else if (pacing.pace === 'measured') block += 'Mix sentence lengths. Action and reflection in equal measure.\n';
  else if (pacing.pace === 'moderate') block += 'Lean toward action. Interiority in short bursts between events.\n';
  else if (pacing.pace === 'brisk') block += 'Short-to-medium sentences. Cut description to essentials. Move.\n';
  else block += "Fragments. Short paragraphs. No description that doesn't serve immediate tension. Every sentence advances.\n";

  block += `\nINTERIORITY: ${pacing.interiority.toUpperCase()}\n`;
  if (pacing.interiority === 'high') block += 'Deep internal thought. The character processes, reflects, doubts, decides. Show the mind working.\n';
  else if (pacing.interiority === 'moderate') block += 'Brief internal flashes between action beats. A thought, a fear, a calculation — then back to the scene.\n';
  else block += 'Almost no internal monologue. The character acts and reacts. Show emotion through body, not thought.\n';

  if (pacing.breathingRoom) {
    block += '\nBREATHING ROOM REQUIRED: ' + pacing.breathingRoom + '\n';
  } else {
    block += '\nNO BREATHING ROOM — maintain pressure throughout this chapter.\n';
  }

  // ── SCENE SHAPE VARIATION ──
  // Varies the internal structure of each chapter based on arc position and tension.
  // This prevents every chapter from following the same beat-style scene template.
  block += '\nSCENE SHAPE FOR THIS CHAPTER:\n';

  if (pacing.breathingRoom && pacing.tension <= 4) {
    // Low-tension arc beats: character-driven, non-formulaic
    const shapes = [
      'SHAPE: VIGNETTE MOSAIC — Tell this chapter through 3-4 short scenes that each reveal a different facet of the situation. No single rising-action spine. Let the chapter breathe through variety, not escalation.',
      'SHAPE: SINGLE SUSTAINED SCENE — One long continuous scene. No cuts, no time jumps. Let the tension come from the characters being stuck together in one place with unresolved feelings or unspoken truths.',
      'SHAPE: CONTRAST CUT — Alternate between two parallel situations that comment on each other. A/B/A/B structure. The juxtaposition IS the point.',
      'SHAPE: THE SLOW REVEAL — Open with a mystery or question. Peel back layers through conversation and observation. The chapter\'s "action" is the protagonist understanding something they didn\'t before.',
    ];
    block += shapes[pacing.chapter % shapes.length] + '\n';
  } else if (pacing.tension >= 9) {
    // Peak tension: convergence and payoff
    const shapes = [
      'SHAPE: CONVERGENCE — Multiple threads collide in this chapter. Characters who\'ve been separated come together. Plans that were in motion reach their results simultaneously.',
      'SHAPE: COUNTDOWN — A literal or figurative clock is ticking. Structure the chapter around shrinking time. Each scene is shorter than the last.',
      'SHAPE: THE REVERSAL — Open with apparent success or safety. Then pull the rug. The midpoint of this chapter should invert everything the reader expected.',
    ];
    block += shapes[pacing.chapter % shapes.length] + '\n';
  } else if (pacing.tension >= 7) {
    // High tension: varied action structures
    const shapes = [
      'SHAPE: PRESSURE COOKER — Characters are trapped (physically or socially) and forced to deal with each other while external threat builds. Interpersonal conflict AND external conflict running simultaneously.',
      'SHAPE: CHASE/PURSUIT — Someone is moving toward or away from something. The chapter\'s rhythm is geographic — each scene is a new location as the pursuit progresses.',
      'SHAPE: THE DIFFICULT CONVERSATION — The chapter\'s core is ONE conversation that changes everything. Build toward it, execute it, deal with the fallout. The conversation is the action.',
      'SHAPE: COMPLICATIONS CASCADE — Start with one problem. Each attempt to fix it creates a new, worse problem. The chapter is a downhill slide of escalating consequences.',
    ];
    block += shapes[pacing.chapter % shapes.length] + '\n';
  } else {
    // Moderate tension: varied narrative structures
    const shapes = [
      'SHAPE: DISCOVERY — The chapter is structured around the protagonist learning something. Open with a question or arrival at a new place. Close with new understanding that changes their approach.',
      'SHAPE: PREPARATION — Characters are getting ready for something. The tension comes from what they\'re preparing FOR, not the preparation itself. Use the preparation to reveal character through choices.',
      'SHAPE: THE TEST — A specific challenge or task that reveals character. The outcome matters less than HOW the characters handle it and what it exposes about them.',
      'SHAPE: RELATIONSHIP SHIFT — Two characters\' dynamic changes in this chapter. Open with their current dynamic, apply pressure, close with a new equilibrium. The plot advances through the relationship.',
      'SHAPE: BEFORE AND AFTER — Split the chapter at a pivotal moment. The first half shows the world one way. Something happens. The second half shows it changed. The contrast IS the chapter.',
    ];
    block += shapes[pacing.chapter % shapes.length] + '\n';
  }

  block += 'IMPORTANT: This scene shape is a STRUCTURAL suggestion, not a replacement for your beat style. Apply your beat style\'s voice, tone, and dialogue rules WITHIN this shape. The shape varies HOW the chapter is organized — the beat style controls how it SOUNDS.\n';

  block += '===\n';
  return block;
}