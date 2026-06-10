/**
 * coverGenreTemplates.js — Genre-specific cover art templates
 *
 * Each template defines lighting, subject, palette, finish, typography advice,
 * and recommended pipeline for a specific genre. Used by coverPromptBuilder
 * to generate structured Kittl-style prompts.
 *
 * @module coverGenreTemplates
 */

// ─── Genre Templates ──────────────────────────────────────────────────────

const GENRE_COVER_TEMPLATES = [
  {
    id: 'dark_fantasy',
    label: 'Dark Fantasy',
    matchGenres: ['dark fantasy', 'grimdark', 'epic fantasy', 'fantasy horror'],
    recommendedPipeline: 'ponyxl',
    stylePreset: 'Painterly / Dark Moody',
    lighting: 'deep amber torchlight from below, volumetric fog, dramatic chiaroscuro with lost highlights',
    subject: 'lone armored figure or mythic creature at a threshold — gate, cliff edge, ruined arch — facing away from viewer, scale emphasized by environment',
    palette: 'burnt umber, obsidian black, forge-glow orange, tarnished gold, deep wine',
    finish: 'oil paint texture, visible impasto brushwork, matte canvas grain',
    negativeAdditions: 'bright pastel, cute, cheerful, modern clothing, plastic, smooth digital',
    typographyAdvice: 'Stylized custom letterforms with integrated runes or organic curves. Dimensional text with stone texture or metallic glow.',
    composition: 'vertical frame with figure in lower third, environmental drama in upper two-thirds, breathing room top center for title',
  },

  {
    id: 'psychological_thriller',
    label: 'Psychological Thriller',
    matchGenres: ['thriller', 'psychological thriller', 'suspense', 'crime thriller'],
    recommendedPipeline: 'ponyxl',
    stylePreset: 'Photorealistic / Dark Moody',
    lighting: 'harsh cold fluorescent overhead light, clinical blue-white, single shadow casting left',
    subject: 'tight crop on a charged object or isolated figure — surveillance mood, asymmetric framing, one eye visible or a hand on glass',
    palette: 'desaturated steel-blue, ash-white, charcoal, clinical green, dried blood accent',
    finish: 'gritty film grain, matte, raw, slightly underexposed',
    negativeAdditions: 'bright colors, happy, cheerful, cluttered, warm lighting, romantic',
    typographyAdvice: 'Distressed condensed sans-serif, cold metallic edge. Letters that look stamped in steel or etched with acid.',
    composition: 'tight frame, asymmetric, negative space for title in darkest region, subject off-center',
  },

  {
    id: 'contemporary_romance',
    label: 'Contemporary Romance',
    matchGenres: ['romance', 'contemporary romance', 'romantic comedy', 'romcom', 'clean romance'],
    recommendedPipeline: 'flux',
    stylePreset: 'Romantic / Warm',
    lighting: 'golden hour backlight, warm lens flare, soft diffused window light with dust motes',
    subject: 'intimate couple moment or charged near-touch — hands almost meeting, shared glance, silhouette embrace — in a specific setting that tells a story',
    palette: 'blush pink, champagne gold, soft coral, warm cream, dusty rose, honey amber',
    finish: 'soft focus bokeh, warm film stock, slight vignette, creamy highlight rolloff',
    negativeAdditions: 'cold, dark, horror, violence, clinical, desaturated, harsh shadows',
    typographyAdvice: 'Flowing script lettering with elegant flourishes. Metallic gold, rose gold, or embossed shimmer effects.',
    composition: 'center-weighted or rule-of-thirds, figures prominent, environment suggestive, space for script title at top',
  },

  {
    id: 'sci_fi_space_opera',
    label: 'Sci-Fi / Space Opera',
    matchGenres: ['science fiction', 'sci-fi', 'space opera', 'cyberpunk', 'hard sci-fi'],
    recommendedPipeline: 'flux',
    stylePreset: 'Photorealistic / Cool',
    lighting: 'rim light from distant star, holographic blue-white ambient, lens flare from engine or sun, volumetric nebula glow',
    subject: 'vast scale composition — ship approaching planet, figure silhouetted against starfield, orbital structure with human scale reference',
    palette: 'deep space indigo, electric cyan, chrome silver, nebula magenta, engine orange accent',
    finish: 'high-detail CGI render, subtle chromatic aberration, clean and polished, cinematic anamorphic',
    negativeAdditions: 'medieval, fantasy creatures, horses, swords, pastoral, warm cozy',
    typographyAdvice: 'Futuristic geometric text with neon edge lighting or hologram effects. Chrome or circuit-integrated letterforms.',
    composition: 'sweeping vista, extreme depth, figure or ship small against vast environment, title space in sky or void',
  },

  {
    id: 'literary_fiction_memoir',
    label: 'Literary Fiction / Memoir',
    matchGenres: ['literary fiction', 'literary', 'memoir', 'upmarket fiction', 'book club fiction'],
    recommendedPipeline: 'flux',
    stylePreset: 'Minimalist / Muted',
    lighting: 'natural indirect daylight, overcast soft box, muted and restrained, no dramatic shadows',
    subject: 'single symbolic object or quiet metaphor — empty chair, weathered letter, lone tree, open window — shot with editorial restraint and negative space',
    palette: 'muted sage, cream, warm charcoal, dusty rose, faded teal, parchment',
    finish: 'fine art print quality, soft matte, gentle texture, restrained and elegant',
    negativeAdditions: 'loud, neon, action, explosions, monsters, cluttered, genre-typical',
    typographyAdvice: 'Sophisticated minimalist serif with generous letter-spacing. Understated and intellectual. Think Penguin Classics.',
    composition: 'generous negative space, object centered or offset, breathing room for elegant type placement',
  },

  {
    id: 'horror_supernatural',
    label: 'Horror / Supernatural',
    matchGenres: ['horror', 'supernatural horror', 'gothic horror', 'dark fiction', 'ghost story'],
    recommendedPipeline: 'ponyxl',
    stylePreset: 'Dark/Moody / Photorealistic',
    lighting: 'moonlight through broken window, deep underexposure, single cool light source from above or behind, shadow-dominant',
    subject: 'ominous threshold or presence — half-open door, figure at end of hallway, empty room with one wrong thing, hand emerging from darkness',
    palette: 'charcoal black, corpse blue-grey, sickly green, bone white, blood red accent',
    finish: 'gritty high contrast, heavy film grain, desaturated, analog horror texture',
    negativeAdditions: 'bright, cheerful, cute, colorful, warm, sunny, happy people, flowers',
    typographyAdvice: 'Distressed, cracked, or bleeding text. Letters that look damaged, corroded, or partially dissolved. Never clean serif.',
    composition: 'centered vanishing point or off-center dread, deep shadows in periphery, one focal point of unease',
  },

  {
    id: 'cozy_mystery_cottage',
    label: 'Cozy Mystery / Cottage',
    matchGenres: ['cozy mystery', 'cozy', 'amateur sleuth', 'culinary mystery', 'cat mystery'],
    recommendedPipeline: 'flux',
    stylePreset: 'Illustrated / Warm',
    lighting: 'warm afternoon sunlight, dappled through leaves, soft shadows, inviting and safe with one small hint of intrigue',
    subject: 'charming scene with one mystery element — a teacup with a suspicious letter, a cat sitting on a case file, a bookshop with a magnifying glass in the window',
    palette: 'sage green, butter yellow, cottage cream, robin egg blue, berry jam red accent',
    finish: 'whimsical illustration style, soft watercolor edges, hand-painted warmth, slightly textured',
    negativeAdditions: 'gore, blood, dark, scary, horror, violence, gritty, urban, noir',
    typographyAdvice: 'Playful serif or rounded letterforms with warm personality. Bright, slightly bouncy, with color fills.',
    composition: 'inviting vignette, scene fills frame, title area clear at top, cozy and accessible',
  },

  {
    id: 'business_self_help',
    label: 'Business / Self-Help',
    matchGenres: ['business', 'self-help', 'personal development', 'productivity', 'finance', 'leadership'],
    recommendedPipeline: 'flux',
    stylePreset: 'Minimalist / Clean',
    lighting: 'clean studio lighting, even and professional, subtle gradient, no dramatic shadows',
    subject: 'bold geometric shape or single powerful metaphor — arrow, mountain, key, compass, ladder — clean and conceptual, not literal',
    palette: 'confident navy, clean white, energetic teal or orange accent, matte charcoal, subtle gold',
    finish: 'crisp vector-sharp rendering, premium matte, clean edges, bookstore-front-table quality',
    negativeAdditions: 'cluttered, fantasy, horror, romantic, vintage, distressed, grunge, complex scene',
    typographyAdvice: 'Clean modern sans-serif with bold weight contrast — one key word HUGE, subtitle small. Strong geometric layout.',
    composition: 'bold and centered, large negative space, conceptual icon prominent, space for large title text',
  },

  {
    id: 'historical_romance',
    label: 'Historical Romance / Period Fiction',
    matchGenres: ['historical romance', 'historical fiction', 'regency romance', 'period drama', 'victorian'],
    recommendedPipeline: 'ponyxl',
    stylePreset: 'Painterly / Warm',
    lighting: 'candlelight and firelight glow, warm amber fill, soft directional light from window, romantic period atmosphere',
    subject: 'period-appropriate romantic moment or evocative setting — couple in period dress, grand estate at twilight, ballroom with golden light, figure in historical costume',
    palette: 'antique gold, deep burgundy, emerald green, ivory cream, warm sienna, candlelight amber',
    finish: 'rich oil painting texture, warm and luminous, period-appropriate elegance, fine art quality',
    negativeAdditions: 'modern clothing, technology, neon, cold, clinical, contemporary settings',
    typographyAdvice: 'Elegant flowing script with period-appropriate serif accent. Gold foil or embossed effects on rich backgrounds.',
    composition: 'romantic and sweeping, figures prominent, period setting suggestive, ornate frame feeling',
  },

  {
    id: 'children_middle_grade',
    label: 'Children / Middle Grade',
    matchGenres: ['children', 'middle grade', 'mg', 'chapter book', 'kids', 'juvenile fiction'],
    recommendedPipeline: 'flux',
    stylePreset: 'Illustrated / Vibrant',
    lighting: 'bright and clear natural light, cheerful and inviting, some magical sparkle or glow, warm and safe',
    subject: 'adventurous young character in dynamic action or discovery — exploring, running, flying, discovering a magical object — expressive and energetic',
    palette: 'vivid primary blue, sunshine yellow, adventure green, bright coral, clean white, pop of purple',
    finish: 'high-quality children\'s book illustration, clean digital paint, expressive and polished, age-appropriate',
    negativeAdditions: 'horror, violence, blood, gore, adult themes, darkness, scary, weapons, death',
    typographyAdvice: 'Bold, dynamic, and expressive custom letterforms — slightly tilted, layered, or 3D. Vibrant color fills and strong outlines.',
    composition: 'dynamic and energetic, character centered or in action pose, bright background, large clear title space',
  },
];

// ─── Lookup Functions ─────────────────────────────────────────────────────

/**
 * Get a genre cover template by genre + subgenre match.
 * Returns the best match or a sensible default.
 *
 * @param {string} genre
 * @param {string} [subgenre='']
 * @returns {Object} Genre template
 */
export function getGenreCoverTemplate(genre, subgenre = '') {
  const search = `${genre || ''} ${subgenre || ''}`.toLowerCase().trim();

  if (!search) return getDefaultCoverTemplate();

  // Exact ID match first
  const byId = GENRE_COVER_TEMPLATES.find(t => t.id === search.replace(/[\s/]+/g, '_'));
  if (byId) return byId;

  // Match against template matchGenres
  for (const template of GENRE_COVER_TEMPLATES) {
    for (const match of template.matchGenres) {
      if (search.includes(match) || match.includes(search)) {
        return template;
      }
    }
  }

  // Fuzzy partial match
  const genreLower = (genre || '').toLowerCase();
  if (genreLower.includes('fantasy')) return findTemplateById('dark_fantasy');
  if (genreLower.includes('thriller') || genreLower.includes('suspense') || genreLower.includes('crime')) return findTemplateById('psychological_thriller');
  if (genreLower.includes('romance') || genreLower.includes('romantic')) return findTemplateById('contemporary_romance');
  if (genreLower.includes('sci') || genreLower.includes('cyber') || genreLower.includes('space')) return findTemplateById('sci_fi_space_opera');
  if (genreLower.includes('horror') || genreLower.includes('gothic')) return findTemplateById('horror_supernatural');
  if (genreLower.includes('cozy') || genreLower.includes('amateur sleuth')) return findTemplateById('cozy_mystery_cottage');
  if (genreLower.includes('business') || genreLower.includes('self-help') || genreLower.includes('productivity')) return findTemplateById('business_self_help');
  if (genreLower.includes('literary') || genreLower.includes('memoir') || genreLower.includes('upmarket')) return findTemplateById('literary_fiction_memoir');
  if (genreLower.includes('histor') || genreLower.includes('regency') || genreLower.includes('victorian')) return findTemplateById('historical_romance');
  if (genreLower.includes('children') || genreLower.includes('middle grade') || genreLower.includes('kids')) return findTemplateById('children_middle_grade');

  return getDefaultCoverTemplate();
}

/**
 * Get all genre templates.
 * @returns {Array<Object>}
 */
export function getAllGenreCoverTemplates() {
  return GENRE_COVER_TEMPLATES.slice();
}

/**
 * Find a template by its ID.
 * @param {string} id
 * @returns {Object}
 */
export function findTemplateById(id) {
  return GENRE_COVER_TEMPLATES.find(t => t.id === id) || getDefaultCoverTemplate();
}

/**
 * Get the default cover template (literary fiction).
 * @returns {Object}
 */
export function getDefaultCoverTemplate() {
  return findTemplateById('literary_fiction_memoir') || GENRE_COVER_TEMPLATES[4];
}

/**
 * Get recommended pipeline for a genre.
 * @param {string} genre
 * @param {string} [subgenre='']
 * @returns {'flux'|'ponyxl'}
 */
export function getRecommendedPipeline(genre, subgenre = '') {
  const template = getGenreCoverTemplate(genre, subgenre);
  return template.recommendedPipeline || 'flux';
}

/**
 * Template field names (for validation).
 */
export const TEMPLATE_REQUIRED_FIELDS = [
  'id', 'label', 'matchGenres', 'recommendedPipeline', 'stylePreset',
  'lighting', 'subject', 'palette', 'finish', 'negativeAdditions',
  'typographyAdvice', 'composition',
];
