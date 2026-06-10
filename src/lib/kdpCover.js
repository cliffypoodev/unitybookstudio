// =============================================================
// KDP Cover Creator — Constants, Calculations, and Prompt Builder
// =============================================================

export const KDP_SPECS = {
  paper: {
    white: 0.002252,
    cream: 0.0025,
    color: 0.0032,
  },
  bleed: 0.125,
  coverThickness: 0.06,
  minSpineTextPages: 79,
  dpi: 300,
  trimSizes: [
    { label: '5" × 8"', w: 5, h: 8 },
    { label: '5.25" × 8"', w: 5.25, h: 8 },
    { label: '5.5" × 8.5"', w: 5.5, h: 8.5 },
    { label: '6" × 9"', w: 6, h: 9 },
    { label: '6.14" × 9.21"', w: 6.14, h: 9.21 },
    { label: '6.69" × 9.61"', w: 6.69, h: 9.61 },
    { label: '7" × 10"', w: 7, h: 10 },
    { label: '7.5" × 9.25"', w: 7.5, h: 9.25 },
    { label: '8" × 10"', w: 8, h: 10 },
    { label: '8.5" × 11"', w: 8.5, h: 11 },
  ],
};

export const ART_STYLES = [
  'Photorealistic', 'Illustrated', 'Painterly', 'Minimalist',
  'Typographic', 'Linocut', 'Watercolor', 'Dark/Moody', 'Romantic', 'Manga/Anime',
];

export const COLOR_MOODS = ['Warm', 'Cool', 'Dark', 'Vibrant', 'Muted', 'Monochrome'];

export const COVER_FONTS = [
  'Cormorant Garamond', 'Georgia', 'Playfair Display', 'Inter', 'Oswald',
];

// --- Prompt Builder ---

const GENRE_HINTS = {
  Romance: 'intimate, emotional, warm lighting, two figures',
  Thriller: 'dark, high contrast, urban, tense atmosphere',
  Fantasy: 'epic, magical, sweeping landscape, dramatic sky',
  Horror: 'dark, unsettling, shadows, isolation',
  Mystery: 'moody, noir, hidden details, atmospheric',
  'Science Fiction': 'futuristic, space, technology, cosmic scale',
  'Literary Fiction': 'subtle, artistic, symbolic imagery',
  Erotica: 'sensual, intimate, warm tones, tasteful suggestion',
  History: 'period-appropriate, archival quality, rich textures',
  'Self-Help': 'clean, bold, aspirational, minimalist',
  'True Crime': 'documentary feel, stark, evidence-style',
  Memoir: 'personal, nostalgic, authentic texture',
  'Historical Fiction': 'period setting, richly textured, atmospheric',
  'Young Adult': 'vibrant, youthful energy, dramatic composition',
  'Urban Fantasy': 'gritty city meets magic, neon and shadow',
  Dystopian: 'bleak, industrial, stark, oppressive atmosphere',
  Crime: 'noir, gritty, urban, investigative mood',
  Adventure: 'epic landscape, action, sweeping vista',
  'Dark Romance': 'dramatic, shadowed intimacy, intensity',
  'Paranormal Romance': 'supernatural, moonlit, ethereal romance',
  Suspense: 'tense, shadowed, psychological unease',
  Western: 'vast desert, rugged, warm dusty tones',
  'Magical Realism': 'dreamlike, surreal, poetic imagery',
  Comedy: 'bright, playful, lighthearted composition',
  Drama: 'emotionally weighted, cinematic composition',
  'Industrial Horror': 'decaying industrial environment, rust, toxic atmosphere, claustrophobic, oppressive machinery',
  'Dystopian Technothriller': 'sleek sterile surfaces hiding rot underneath, surveillance, rain-slicked dystopia, bureaucratic dread',
  'Clean Romance': 'warm small-town charm, sunlit porches, cozy domesticity, gentle warmth',
  'Women\'s Fiction': 'warm community scenes, emotionally rich, everyday beauty, vibrant warmth',
  'Faith-Based Fiction': 'peaceful church steeple, sunlit meadow, warm community, hopeful light',
};

// Genre-specific typography direction for AI image generation
const GENRE_TYPOGRAPHY = {
  Horror: 'TYPOGRAPHY: Distressed, cracked, or bleeding text. Letters that look damaged, corroded, or partially dissolved — scratched metal, dripping ink, or text emerging from darkness. Tall narrow letterforms with sharp jagged edges. NEVER use clean serif fonts. Color palette: deep blacks, blood reds, sickly greens, bone white.',
  Thriller: 'TYPOGRAPHY: Distressed, cracked text with a cold metallic edge. Letters that look damaged, stamped in steel, or etched with acid. Tall condensed letterforms with sharp edges and subtle grit texture. NEVER use clean serif fonts. Color palette: cold steel blues, muted grays, harsh white, gunmetal.',
  Suspense: 'TYPOGRAPHY: Distressed, partially obscured text with a psychological edge. Letters emerging from shadow, slightly warped or fragmented. Narrow condensed forms with tension in the spacing. Color palette: deep navy, desaturated teal, muted amber, stark white.',
  Romance: 'TYPOGRAPHY: Flowing script lettering with flourishes and elegant swashes. Hand-lettered calligraphy style. Metallic gold, rose gold, or embossed shimmering effects. Soft drop shadows. Think wedding invitation meets fashion magazine. Color palette: blush pink, champagne gold, deep burgundy, cream.',
  'Dark Romance': 'TYPOGRAPHY: Dramatic script lettering with sharp flourishes — elegant but dangerous. Mix of flowing calligraphy with a dark edge. Metallic silver or dark gold with deep shadows. Color palette: deep crimson, black, dark gold, midnight purple.',
  'Paranormal Romance': 'TYPOGRAPHY: Ethereal flowing script with supernatural shimmer effects. Letters with a moonlit glow, wispy and luminous. Metallic silver or iridescent effects. Color palette: moonlight silver, deep purple, midnight blue, ghostly white.',
  Erotica: 'TYPOGRAPHY: Sensual flowing script with metallic gold or rose gold effects. Elegant and provocative lettering with subtle embossed texture. Color palette: deep wine red, gold, black, warm skin tones.',
  Fantasy: 'TYPOGRAPHY: Stylized custom letterforms with integrated design elements — runes, organic curves, celestial motifs woven into the letters themselves. Dimensional text with stone texture, metallic glow, or ancient carved appearance. Color palette: royal purple, deep gold, emerald, midnight blue.',
  'Science Fiction': 'TYPOGRAPHY: Stylized custom letterforms with integrated circuitry, holographic glow, or chrome finish. Futuristic geometric text with neon edge lighting or hologram effects. Color palette: electric blue, chrome silver, deep space black, neon cyan.',
  'Urban Fantasy': 'TYPOGRAPHY: Stylized letterforms blending arcane symbols with urban grit. Text with neon glow bleeding into magical rune effects. Graffiti meets enchantment. Color palette: neon magenta, electric purple, dark concrete gray, gold sparks.',
  Dystopian: 'TYPOGRAPHY: Bold industrial stenciled text with heavy distress and decay. Weathered, spray-painted, or stamped on rusted metal. Brutalist geometric letterforms. Color palette: rust orange, ash gray, toxic yellow, charcoal black.',
  'True Crime': 'TYPOGRAPHY: Bold condensed sans-serif with gritty texture — newspaper headline meets evidence label. Stamped, stenciled, or typewriter-style text. Red accents on key words. Case file aesthetic. Color palette: stark white on black, evidence red, manila folder tan, ink black.',
  Crime: 'TYPOGRAPHY: Bold condensed sans-serif with a noir edge. Stenciled or typewriter text with grit and ink splatter. Color palette: noir black, harsh white, blood red, smoke gray.',
  Mystery: 'TYPOGRAPHY: Sophisticated serif with a noir edge — slightly distressed or partially obscured. Text emerging from fog or shadow. Subtle metallic or aged paper effect. Color palette: deep charcoal, fog gray, muted gold, midnight blue.',
  'Literary Fiction': 'TYPOGRAPHY: Sophisticated minimalist typography with generous letter-spacing. Thin elegant sans-serif or refined transitional serif. Understated and intellectual. Think New Yorker magazine or Penguin Classics. Color palette: muted earth tones, cream, charcoal, sage, dusty rose.',
  'Self-Help': 'TYPOGRAPHY: Clean modern sans-serif with bold weight contrast — one key word HUGE, subtitle small. Bright accent colors. Strong geometric layout. Think TED talk slide meets bestseller rack. Color palette: energetic orange, clean white, bold teal, confident navy.',
  Memoir: 'TYPOGRAPHY: Warm humanist serif or handwritten-style text with personal character. Slightly imperfect letterforms that feel authentic. Soft shadows. Color palette: sepia, warm cream, faded photograph tones, soft brown.',
  History: 'TYPOGRAPHY: Classical engraved serif with authority and gravitas. Gold foil or embossed effects on rich textured backgrounds. Color palette: deep navy, gold, burgundy, parchment cream.',
  'Historical Fiction': 'TYPOGRAPHY: Period-appropriate serif with aged or engraved quality. Letterpress or woodtype texture. Warm metallic accents. Color palette: aged parchment, deep burgundy, antique gold, forest green.',
  'Young Adult': 'TYPOGRAPHY: Bold, dynamic, and expressive custom letterforms — slightly tilted, layered, or 3D. Vibrant color fills and strong outlines. Energetic and eye-catching. Color palette: bright coral, electric blue, vivid purple, hot pink, stark white.',
  Adventure: 'TYPOGRAPHY: Bold weathered letterforms with an expedition feel — carved in stone, stamped in metal, or embossed in leather. Dimensional with strong shadows. Color palette: earthy gold, jungle green, sunset orange, weathered brown.',
  Western: 'TYPOGRAPHY: Rustic slab serif or woodtype with a dusty weathered texture. Branded or burned-in letterforms. Color palette: dusty tan, rust red, sunset amber, leather brown.',
  'Magical Realism': 'TYPOGRAPHY: Elegant serif with subtle surreal flourishes — letters that slightly morph or bloom. Dreamlike soft glow effects. Color palette: muted lavender, soft gold, faded teal, warm peach.',
  Comedy: 'TYPOGRAPHY: Playful bold sans-serif or rounded letterforms with a fun personality. Bright, slightly bouncy, with color fills or outlines. Color palette: sunshine yellow, bright teal, coral, crisp white.',
  Drama: 'TYPOGRAPHY: Cinematic serif with weight and gravitas. Clean but emotionally heavy. Subtle metallic or matte texture. Color palette: deep charcoal, warm gold, muted burgundy, storm gray.',
  'Manga/Anime': 'TYPOGRAPHY: Dynamic stylized letterforms with sharp angles and energy lines. Bold outlined text with vibrant color fills. Color palette: vivid primary colors, stark black outlines, white highlights.',
  'Industrial Horror': 'TYPOGRAPHY: Corroded, industrial stencil text. Letters that look stamped in rusted metal, eaten by chemical decay, or etched by acid fumes. Heavy condensed forms with grit, dust, and erosion. NEVER use clean or elegant fonts. Color palette: toxic yellow, oxidized orange, caustic white, ash black.',
  'Dystopian Technothriller': 'TYPOGRAPHY: Cold clinical sans-serif with bureaucratic precision, slightly distorted or glitched. Text that looks like government-issued documents being corrupted. Monospace or condensed forms. Color palette: sterile white, surveillance green, data blue, concrete gray.',
  'Clean Romance': 'TYPOGRAPHY: Warm flowing script with gentle flourishes. Hand-lettered calligraphy style with soft shadows. Pastel metallic effects — rose gold or champagne. Color palette: blush pink, sage green, warm cream, soft gold.',
  'Women\'s Fiction': 'TYPOGRAPHY: Warm humanist serif or elegant script with approachable personality. Soft embossed effects. Color palette: warm coral, muted teal, cream, dusty rose.',
  'Faith-Based Fiction': 'TYPOGRAPHY: Warm classical serif with graceful, dignified letterforms. Soft gold or cream embossed effects. Gentle and inviting. Color palette: warm gold, ivory, sage green, sky blue.',
};

const STYLE_MAP = {
  Photorealistic: 'photorealistic, cinematic lighting, high detail',
  Illustrated: 'illustrated, hand-drawn quality, artistic',
  Painterly: 'oil painting style, textured brushstrokes, fine art',
  Minimalist: 'minimalist design, clean composition, negative space',
  Typographic: 'typography-focused, bold text design, graphic',
  Linocut: 'linocut print style, bold lines, woodcut texture, high contrast',
  Watercolor: 'watercolor wash, soft edges, translucent layers',
  'Dark/Moody': 'dark atmospheric, dramatic shadows, cinematic noir',
  Romantic: 'soft focus, warm light, dreamy atmosphere',
  'Manga/Anime': 'anime style, vibrant, dynamic composition',
};

const MOOD_MAP = {
  Warm: 'warm golden tones, amber light',
  Cool: 'cool blue-silver tones, moonlit atmosphere',
  Dark: 'deep shadows, low key lighting, dramatic contrast',
  Vibrant: 'vivid saturated colors, high energy',
  Muted: 'desaturated, subdued palette, understated',
  Monochrome: 'black and white, grayscale, high contrast',
};

// Resolve typography direction — try exact genre, then fuzzy match, then fallback
function getTypographyDirection(genre) {
  if (!genre) return '';
  if (GENRE_TYPOGRAPHY[genre]) return GENRE_TYPOGRAPHY[genre];
  const lowerGenre = genre.toLowerCase();
  // Fuzzy match: horror/thriller/suspense family
  if (lowerGenre.includes('horror') || lowerGenre.includes('gothic')) return GENRE_TYPOGRAPHY['Horror'];
  if (lowerGenre.includes('thriller')) return GENRE_TYPOGRAPHY['Thriller'];
  if (lowerGenre.includes('suspense')) return GENRE_TYPOGRAPHY['Suspense'];
  // Romance family
  if (lowerGenre.includes('dark romance')) return GENRE_TYPOGRAPHY['Dark Romance'];
  if (lowerGenre.includes('paranormal') && lowerGenre.includes('romance')) return GENRE_TYPOGRAPHY['Paranormal Romance'];
  if (lowerGenre.includes('romance') || lowerGenre.includes('erotica')) return GENRE_TYPOGRAPHY['Romance'];
  // Fantasy/Sci-fi family
  if (lowerGenre.includes('urban fantasy')) return GENRE_TYPOGRAPHY['Urban Fantasy'];
  if (lowerGenre.includes('fantasy')) return GENRE_TYPOGRAPHY['Fantasy'];
  if (lowerGenre.includes('sci') || lowerGenre.includes('science')) return GENRE_TYPOGRAPHY['Science Fiction'];
  if (lowerGenre.includes('dystop')) return GENRE_TYPOGRAPHY['Dystopian'];
  // Crime/mystery family
  if (lowerGenre.includes('true crime')) return GENRE_TYPOGRAPHY['True Crime'];
  if (lowerGenre.includes('crime')) return GENRE_TYPOGRAPHY['Crime'];
  if (lowerGenre.includes('mystery')) return GENRE_TYPOGRAPHY['Mystery'];
  // Non-fiction family
  if (lowerGenre.includes('self-help') || lowerGenre.includes('business') || lowerGenre.includes('productivity')) return GENRE_TYPOGRAPHY['Self-Help'];
  if (lowerGenre.includes('memoir')) return GENRE_TYPOGRAPHY['Memoir'];
  if (lowerGenre.includes('history') || lowerGenre.includes('historical')) return GENRE_TYPOGRAPHY['Historical Fiction'];
  // Catch-all literary
  if (lowerGenre.includes('literary')) return GENRE_TYPOGRAPHY['Literary Fiction'];
  return '';
}

// Anti-"photo of a book" framing. DALL-E interprets "book cover" as a
// physical 3D object sitting on a surface, which produces mockups, product
// shots, and photographs of books rather than flat cover artwork. Lead every
// prompt by describing the ARTWORK ITSELF as a vertical illustration that
// fills the frame edge-to-edge, and explicitly exclude book objects.
const FLAT_ARTWORK_LEAD =
  'Vertical portrait illustration in 2:3 aspect ratio, designed as a single flat 2D image that fills the entire frame edge-to-edge with no borders, no margins, no background surface, and no empty space around it. This is the final artwork itself — not a photograph or rendering of a physical book';

const FLAT_ARTWORK_NEGATIVES =
  'Do not depict a physical book, hardcover, paperback, book spine, book pages, book edges, or any 3D book object. Do not show the artwork sitting on a table, shelf, desk, or any surface. Do not render a product mockup, bookstore display, stack of books, or multiple book thumbnails. No drop shadows suggesting a book is lying on something. No perspective angles suggesting a physical object. The entire canvas is the scene, flat and full-bleed';

export function buildCoverArtPrompt(genre, artDescription, artStyle, colorMood, coverTitle = '', authorName = '') {
  const genreHint = GENRE_HINTS[genre] || '';
  const typographyDir = getTypographyDirection(genre);
  const hasText = !!(coverTitle || authorName);

  if (hasText) {
    const textParts = [];
    if (coverTitle) {
      textParts.push(`Title text reading "${coverTitle}" integrated directly into the artwork composition`);
    }
    if (authorName) {
      textParts.push(`Author name reading "${authorName}" integrated into the artwork composition`);
    }

    return [
      FLAT_ARTWORK_LEAD,
      ...textParts,
      typographyDir || 'Typography rendered as part of the flat illustration with depth and texture effects',
      STYLE_MAP[artStyle] || '',
      MOOD_MAP[colorMood] || '',
      genreHint,
      artDescription,
      FLAT_ARTWORK_NEGATIVES,
      'Professional publishing-grade illustration quality, bookstore-ready composition',
    ].filter(Boolean).join('. ');
  }

  // No text requested — pure artwork, but still genre-informed composition.
  return [
    FLAT_ARTWORK_LEAD,
    'No text, no title, no words, no letters, no typography of any kind anywhere in the image',
    STYLE_MAP[artStyle] || '',
    MOOD_MAP[colorMood] || '',
    genreHint,
    artDescription,
    'Composition leaves visual breathing room near the top and bottom of the frame where title and author typography will later be overlaid',
    FLAT_ARTWORK_NEGATIVES,
    'Professional publishing-grade illustration quality, bookstore-ready composition',
  ].filter(Boolean).join('. ');
}

// --- KDP Dimension Calculator ---

export function calculateCoverDimensions(trimW, trimH, pageCount, paperType = 'cream') {
  const thickness = KDP_SPECS.paper[paperType] || KDP_SPECS.paper.cream;
  const spineWidth = (pageCount * thickness) + KDP_SPECS.coverThickness;
  const totalWidth = KDP_SPECS.bleed + trimW + spineWidth + trimW + KDP_SPECS.bleed;
  const totalHeight = KDP_SPECS.bleed + trimH + KDP_SPECS.bleed;

  const pxW = Math.round(totalWidth * KDP_SPECS.dpi);
  const pxH = Math.round(totalHeight * KDP_SPECS.dpi);
  const pxBleed = Math.round(KDP_SPECS.bleed * KDP_SPECS.dpi);
  const pxTrimW = Math.round(trimW * KDP_SPECS.dpi);
  const pxTrimH = Math.round(trimH * KDP_SPECS.dpi);
  const pxSpine = Math.round(spineWidth * KDP_SPECS.dpi);
  const canSpineText = pageCount >= KDP_SPECS.minSpineTextPages;

  return {
    totalWidth, totalHeight, spineWidth, trimW, trimH,
    pxW, pxH, pxBleed, pxTrimW, pxTrimH, pxSpine,
    canSpineText, pageCount, paperType,
    zones: {
      backLeft: pxBleed,
      backRight: pxBleed + pxTrimW,
      spineLeft: pxBleed + pxTrimW,
      spineRight: pxBleed + pxTrimW + pxSpine,
      frontLeft: pxBleed + pxTrimW + pxSpine,
      frontRight: pxBleed + pxTrimW + pxSpine + pxTrimW,
    },
  };
}

// --- Image Brightness Analysis ---

export function analyzeImageBrightness(canvas, region) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  let y1, y2;
  if (region === 'top') { y1 = 0; y2 = Math.floor(h / 4); }
  else if (region === 'bottom') { y1 = Math.floor(h * 3 / 4); y2 = h; }
  else { y1 = 0; y2 = h; }
  const imageData = ctx.getImageData(0, y1, w, y2 - y1);
  const pixels = imageData.data;
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    sum += pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
  }
  return sum / (pixels.length / 4);
}

export function getTextPreset(avgBrightness) {
  if (avgBrightness < 140) {
    return { textColor: 'rgba(255,250,240,1)', shadowColor: 'rgba(0,0,0,0.8)', bandColor: 'rgba(0,0,0,0.45)' };
  }
  return { textColor: 'rgba(255,250,240,1)', shadowColor: 'rgba(0,0,0,0.8)', bandColor: 'rgba(0,0,0,0.55)' };
}

export function getFontSizes(imageWidth) {
  return {
    title: Math.max(Math.floor(imageWidth * 0.09), 36),
    author: Math.max(Math.floor(imageWidth * 0.045), 20),
    subtitle: Math.max(Math.floor(imageWidth * 0.03), 14),
  };
}

// --- Title Splitting ---

export function splitTitle(title) {
  const upper = title.toUpperCase();
  const splitPatterns = [' OF THE ', ' AND THE ', ' OF ', ' IN THE ', ': '];
  for (const pattern of splitPatterns) {
    if (upper.includes(pattern)) {
      const idx = upper.indexOf(pattern);
      return { line1: upper.slice(0, idx).trim(), connector: pattern.trim(), line2: upper.slice(idx + pattern.length).trim() };
    }
  }
  if (upper.length > 30) {
    const mid = Math.floor(upper.length / 2);
    const spaceIdx = upper.indexOf(' ', mid);
    if (spaceIdx > 0) {
      return { line1: upper.slice(0, spaceIdx).trim(), connector: null, line2: upper.slice(spaceIdx + 1).trim() };
    }
  }
  return { line1: upper, connector: null, line2: null };
}

// --- Canvas Text Helpers ---

export function drawTextWithShadow(ctx, x, y, text, font, fillColor, shadowColor, shadowOffset = 2) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = shadowColor;
  ctx.fillText(text, x + shadowOffset, y + shadowOffset);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

export function wordWrap(ctx, text, maxWidth) {
  const paragraphs = text.split('\n\n');
  const lines = [];
  paragraphs.forEach((para) => {
    const words = para.split(' ');
    let current = '';
    words.forEach((word) => {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);
    lines.push('');
  });
  return lines;
}

// --- Load Image from URL into canvas ---

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// --- Estimate page count ---

export function estimatePageCount(totalWords) {
  return Math.max(24, Math.ceil((totalWords || 70000) / 250));
}

// --- Suggest trim for book type ---

export function suggestTrimSize(bookType) {
  if (bookType === 'nonfiction') return KDP_SPECS.trimSizes[3]; // 6x9
  return KDP_SPECS.trimSizes[2]; // 5.5x8.5
}