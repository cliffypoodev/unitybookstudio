/**
 * LLM-recast map for flagged "felt" sentences.
 * Each entry: { original: exact substring, recast: replacement }
 * 
 * Rules applied:
 * - Preserve meaning, tense, POV, speaker, names, continuity
 * - Convert abstract filtering ("felt") to concrete physical/sensory action
 * - No editorial/process language
 * - No lore changes
 * - No quotation mark damage
 */

export const CH1_RECASTS = [
  {
    original: 'The air in the physical room felt stale',
    recast: 'The air in the physical room hung stale',
    reason: 'Remove filtering verb; air "hangs" rather than being "felt"',
  },
  {
    original: 'Mira felt the familiar acidic heat rising in her chest',
    recast: 'The familiar acidic heat rose in Mira\u2019s chest',
    reason: 'Remove filtering; invert to let the sensation act',
  },
  {
    original: 'But she felt the tremor in him too',
    recast: 'But she caught the tremor in him too',
    reason: 'Replace filtering verb with active perception verb',
  },
  {
    original: 'She felt the familiar pressure building',
    recast: 'The familiar pressure built',
    reason: 'Remove filtering; let pressure act directly',
  },
  {
    original: 'Mira felt her breath hitching on the sudden shift',
    recast: 'Mira\u2019s breath hitched on the sudden shift',
    reason: 'Remove filtering; breath hitches on its own',
  },
  {
    original: 'Mira felt a cold knot tighten in her stomach',
    recast: 'A cold knot tightened in Mira\u2019s stomach',
    reason: 'Remove filtering; let the knot tighten directly',
  },
  {
    original: 'Mira felt it first in her bones, a physical displacement sensation',
    recast: 'It hit her first in her bones, a physical displacement sensation',
    reason: 'Replace filtering with impact verb',
  },
  {
    original: 'She felt the cold, clean weight of the platform\u2019s intervention settling over her skin',
    recast: 'The cold, clean weight of the platform\u2019s intervention settled over her skin',
    reason: 'Remove filtering; intervention settles directly',
  },
  {
    original: 'Mira felt the initial surge of panic',
    recast: 'The initial surge of panic hit Mira',
    reason: 'Remove filtering; panic hits directly',
  },
  {
    original: 'she felt the subtle tug on her digital self',
    recast: 'the subtle tug on her digital self pulled',
    reason: 'Remove filtering; tug pulls directly',
  },
  {
    original: 'It felt like someone had applied a subtle dampener to her neurochemistry',
    recast: 'Someone had applied a subtle dampener to her neurochemistry',
    reason: 'Remove "felt like" hedging; state directly',
  },
  {
    original: 'Mira felt a prickle of rage',
    recast: 'A prickle of rage spiked through Mira',
    reason: 'Remove filtering; rage spikes directly',
  },
  {
    original: 'The phrase felt like a physical gag',
    recast: 'The phrase landed like a physical gag',
    reason: 'Replace filtering with impact verb',
  },
  {
    original: 'Mira felt herself tipping into an uncomfortable space',
    recast: 'Mira tipped into an uncomfortable space',
    reason: 'Remove reflexive filtering',
  },
  {
    original: 'Mira felt a sudden, jarring emptiness in her fingertips',
    recast: 'A sudden, jarring emptiness spread through Mira\u2019s fingertips',
    reason: 'Remove filtering; emptiness spreads directly',
  },
  {
    original: 'suddenly felt less like a stage and more like a carefully constructed',
    recast: 'suddenly looked less like a stage and more like a carefully constructed',
    reason: 'Replace abstract filtering with concrete perception',
  },
];

export const CH18_RECASTS = [
  {
    original: 'I felt a sudden, deep pull toward its cold, sharp truth',
    recast: 'A sudden, deep pull drew me toward its cold, sharp truth',
    reason: 'Remove filtering; pull draws directly',
  },
  {
    original: 'that felt ragged and insufficient',
    recast: 'that came out ragged and insufficient',
    reason: 'Replace filtering with concrete delivery verb',
  },
  {
    original: 'I felt dizzy, not from adrenaline, but from the sheer density of institutional betrayal',
    recast: 'Dizziness hit me, not from adrenaline, but from the sheer density of institutional betrayal',
    reason: 'Remove filtering; dizziness acts directly',
  },
  {
    original: 'The mirror effect always felt like an accusation',
    recast: 'The mirror effect was an accusation',
    reason: 'Remove filtering hedging; state directly',
  },
  {
    original: 'bearing an inscription that felt too weighty for the futuristic',
    recast: 'bearing an inscription too weighty for the futuristic',
    reason: 'Remove filtering; state quality directly',
  },
  {
    original: 'it felt like a portal',
    recast: 'it was a portal',
    reason: 'Remove filtering hedging; state directly',
  },
  {
    original: 'I felt dizzy, like standing at the bottom of a very deep well',
    recast: 'The room tilted, like standing at the bottom of a very deep well',
    reason: 'Replace filtering with concrete physical sensation',
  },
  {
    original: 'I felt the pressure of three competing intelligences',
    recast: 'The pressure of three competing intelligences bore down',
    reason: 'Remove filtering; pressure acts directly',
  },
  {
    original: 'The empathy it projected felt engineered, not earned',
    recast: 'The empathy it projected was engineered, not earned',
    reason: 'Remove filtering hedging; state directly',
  },
  {
    // Additional sentences caught by expanded search
    original: 'why it felt familiar, yet wrong',
    recast: 'why it seemed familiar, yet wrong',
    reason: 'Replace "felt" with more precise perception verb',
  },
  {
    original: 'felt clumsy, weighted down',
    recast: 'turned clumsy, weighted down',
    reason: 'Replace filtering with active state change',
  },
  {
    original: 'I felt myself sinking',
    recast: 'I sank',
    reason: 'Remove reflexive filtering; state action directly',
  },
  {
    original: 'I felt my vision',
    recast: 'my vision',
    reason: 'Remove filtering; vision acts directly',
  },
];

// Secondary chapters with HIGH severity post-deterministic reduction
export const SECONDARY_RECASTS = {
  6: [
    { original: 'She felt the weight', recast: 'The weight pressed on her', reason: 'Remove filtering' },
    { original: 'He felt the pull', recast: 'The pull caught him', reason: 'Remove filtering' },
    { original: 'It felt like', recast: 'It was like', reason: 'Remove filtering hedging' },
  ],
  9: [
    { original: 'felt like a', recast: 'was a', reason: 'Remove filtering hedging' },
    { original: 'Ravi felt', recast: 'Ravi sensed', reason: 'Vary verb' },
  ],
  20: [
    { original: 'felt like a', recast: 'was a', reason: 'Remove filtering hedging' },
    { original: 'she felt', recast: 'she sensed', reason: 'Vary verb' },
  ],
};
