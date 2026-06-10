export const COVER_TEMPLATE_OPTIONS = [
  {
    id: 'retro-pulp-noir',
    label: 'Retro Pulp Noir',
  },
  {
    id: 'neon-noir-prestige',
    label: 'Neon Noir Prestige',
  },
  {
    id: 'vhs-thriller',
    label: 'VHS Thriller',
  },
  {
    id: 'mass-market-thriller',
    label: 'Mass Market Thriller',
  },
  {
    id: 'minimal-prestige',
    label: 'Minimal Prestige',
  },
  {
    id: 'literary-editorial',
    label: 'Literary Editorial',
  },
];

const FONT_STACKS = {
  bebas: `'Bebas Neue', Impact, 'Arial Narrow Bold', sans-serif`,
  anton: `'Anton', Impact, 'Arial Black', sans-serif`,
  oswald: `'Oswald', 'Arial Narrow Bold', Arial, sans-serif`,
  barlowCondensed: `'Barlow Condensed', 'Arial Narrow Bold', Arial, sans-serif`,
  archivo: `'Archivo Black', 'Arial Black', Impact, sans-serif`,
  league: `'League Spartan', Arial, sans-serif`,
  playfair: `'Playfair Display', Georgia, serif`,
  cormorant: `'Cormorant Garamond', Georgia, serif`,
  libre: `'Libre Baskerville', Georgia, serif`,
  cinzel: `'Cinzel', Georgia, serif`,
  staatliches: `'Staatliches', Impact, sans-serif`,
};

const BASE_TEMPLATE = {
  id: 'retro-pulp-noir',
  label: 'Retro Pulp Noir',

  titleFont: FONT_STACKS.bebas,
  subtitleFont: FONT_STACKS.barlowCondensed,
  authorFont: FONT_STACKS.oswald,
  seriesFont: FONT_STACKS.barlowCondensed,

  titleWeight: 400,
  subtitleWeight: 600,
  authorWeight: 600,
  seriesWeight: 600,

  titleUppercase: true,
  subtitleUppercase: false,
  authorUppercase: true,
  seriesUppercase: true,

  titleTracking: 2.1,
  subtitleTracking: 0.9,
  authorTracking: 1.6,
  seriesTracking: 1.4,

  titleMaxLines: 2,
  subtitleMaxLines: 2,
  authorMaxLines: 1,
  seriesMaxLines: 1,

  titleZone: 'top',
  subtitleZone: 'underTitle',
  authorZone: 'bottomLifted',
  seriesZone: 'topStrip',

  titleScale: 0.118,
  subtitleScale: 0.034,
  authorScale: 0.036,
  seriesScale: 0.026,

  titleMinScale: 0.055,
  subtitleMinScale: 0.018,
  authorMinScale: 0.020,
  seriesMinScale: 0.016,

  titleLineHeight: 0.88,
  subtitleLineHeight: 1.05,
  authorLineHeight: 1.0,
  seriesLineHeight: 1.0,

  titleInk: 'cream',
  authorInk: 'cream',
  subtitleInk: 'cream',
  seriesInk: 'cream',

  titleStroke: 'soft-dark',
  authorStroke: 'soft-dark',
  subtitleStroke: 'none',
  seriesStroke: 'none',

  titleShadow: 'print-shadow',
  authorShadow: 'soft',
  subtitleShadow: 'soft',
  seriesShadow: 'soft',

  titlePlate: 'none',
  authorPlate: 'none',
  subtitlePlate: 'none',
  seriesPlate: 'none',

  overlay: 'dark-top-bottom',
  grain: true,
};

const COVER_TEMPLATES = {
  'retro-pulp-noir': {
    ...BASE_TEMPLATE,
    id: 'retro-pulp-noir',
    label: 'Retro Pulp Noir',
    titleFont: FONT_STACKS.bebas,
    authorFont: FONT_STACKS.oswald,
    subtitleFont: FONT_STACKS.barlowCondensed,
    titleTracking: 2.1,
    authorTracking: 1.45,
    titleScale: 0.12,
    authorScale: 0.035,
    titleZone: 'top',
    overlay: 'pulp-vignette',
  },

  'neon-noir-prestige': {
    ...BASE_TEMPLATE,
    id: 'neon-noir-prestige',
    label: 'Neon Noir Prestige',
    titleFont: FONT_STACKS.staatliches,
    authorFont: FONT_STACKS.barlowCondensed,
    subtitleFont: FONT_STACKS.barlowCondensed,
    titleTracking: 2.8,
    authorTracking: 1.8,
    titleScale: 0.112,
    authorScale: 0.034,
    titleZone: 'top',
    titleInk: 'warm-white',
    authorInk: 'warm-white',
    titleStroke: 'hairline-dark',
    authorStroke: 'none',
    titleShadow: 'neon-soft',
    overlay: 'noir-gradient',
  },

  'vhs-thriller': {
    ...BASE_TEMPLATE,
    id: 'vhs-thriller',
    label: 'VHS Thriller',
    titleFont: FONT_STACKS.anton,
    authorFont: FONT_STACKS.oswald,
    subtitleFont: FONT_STACKS.oswald,
    titleTracking: 1.4,
    authorTracking: 1.4,
    titleScale: 0.105,
    authorScale: 0.034,
    titleZone: 'top',
    titleInk: 'bone',
    authorInk: 'bone',
    titleStroke: 'thin-dark',
    authorStroke: 'thin-dark',
    titleShadow: 'hard-offset',
    overlay: 'vhs-darken',
  },

  'mass-market-thriller': {
    ...BASE_TEMPLATE,
    id: 'mass-market-thriller',
    label: 'Mass Market Thriller',
    titleFont: FONT_STACKS.archivo,
    authorFont: FONT_STACKS.oswald,
    subtitleFont: FONT_STACKS.barlowCondensed,
    titleTracking: 0.4,
    authorTracking: 1.25,
    titleScale: 0.095,
    authorScale: 0.034,
    titleZone: 'top',
    titleInk: 'white',
    authorInk: 'white',
    titleStroke: 'thin-dark',
    authorStroke: 'none',
    titleShadow: 'soft',
    overlay: 'thriller-contrast',
  },

  'minimal-prestige': {
    ...BASE_TEMPLATE,
    id: 'minimal-prestige',
    label: 'Minimal Prestige',
    titleFont: FONT_STACKS.playfair,
    authorFont: FONT_STACKS.barlowCondensed,
    subtitleFont: FONT_STACKS.barlowCondensed,
    titleWeight: 800,
    subtitleWeight: 500,
    authorWeight: 600,
    titleUppercase: false,
    authorUppercase: true,
    titleTracking: 0.1,
    subtitleTracking: 0.2,
    authorTracking: 1.4,
    titleMaxLines: 3,
    titleScale: 0.088,
    authorScale: 0.030,
    titleZone: 'upperMiddle',
    authorZone: 'bottomLifted',
    titleInk: 'warm-white',
    authorInk: 'warm-white',
    titleStroke: 'none',
    authorStroke: 'none',
    titleShadow: 'soft',
    overlay: 'prestige-soft',
    grain: true,
  },

  'literary-editorial': {
    ...BASE_TEMPLATE,
    id: 'literary-editorial',
    label: 'Literary Editorial',
    titleFont: FONT_STACKS.cormorant,
    authorFont: FONT_STACKS.barlowCondensed,
    subtitleFont: FONT_STACKS.libre,
    titleWeight: 700,
    subtitleWeight: 400,
    authorWeight: 600,
    titleUppercase: false,
    subtitleUppercase: false,
    authorUppercase: true,
    titleTracking: 0.05,
    subtitleTracking: 0.05,
    authorTracking: 1.3,
    titleMaxLines: 3,
    titleScale: 0.095,
    subtitleScale: 0.027,
    authorScale: 0.029,
    titleZone: 'upperMiddle',
    authorZone: 'bottomLifted',
    titleInk: 'cream',
    authorInk: 'cream',
    titleStroke: 'none',
    authorStroke: 'none',
    titleShadow: 'soft',
    overlay: 'editorial-soft',
    grain: true,
  },
};

export function getCoverTemplate(templateId = 'retro-pulp-noir') {
  return COVER_TEMPLATES[templateId] || COVER_TEMPLATES['retro-pulp-noir'];
}

export function getDefaultTemplateForGenre(genre = '') {
  const g = String(genre || '').toLowerCase();

  if (g.includes('romance')) return 'literary-editorial';
  if (g.includes('literary')) return 'literary-editorial';
  if (g.includes('memoir')) return 'minimal-prestige';
  if (g.includes('nonfiction')) return 'minimal-prestige';
  if (g.includes('history')) return 'minimal-prestige';
  if (g.includes('horror')) return 'vhs-thriller';
  if (g.includes('thriller') || g.includes('crime') || g.includes('mystery')) return 'mass-market-thriller';
  if (g.includes('sci-fi') || g.includes('science fiction') || g.includes('cyber')) return 'neon-noir-prestige';

  return 'retro-pulp-noir';
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeCoverText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function zoneRects(width, height) {
  const marginX = Math.round(width * 0.075);

  return {
    topStrip: {
      x: marginX,
      y: Math.round(height * 0.038),
      width: width - marginX * 2,
      height: Math.round(height * 0.050),
    },
    top: {
      x: marginX,
      y: Math.round(height * 0.070),
      width: width - marginX * 2,
      height: Math.round(height * 0.200),
    },
    upperMiddle: {
      x: marginX,
      y: Math.round(height * 0.155),
      width: width - marginX * 2,
      height: Math.round(height * 0.280),
    },
    middle: {
      x: marginX,
      y: Math.round(height * 0.350),
      width: width - marginX * 2,
      height: Math.round(height * 0.260),
    },
    underTitleTop: {
      x: marginX,
      y: Math.round(height * 0.275),
      width: width - marginX * 2,
      height: Math.round(height * 0.082),
    },
    underTitleMiddle: {
      x: marginX,
      y: Math.round(height * 0.475),
      width: width - marginX * 2,
      height: Math.round(height * 0.090),
    },
    bottomLifted: {
      x: marginX,
      y: Math.round(height * 0.755),
      width: width - marginX * 2,
      height: Math.round(height * 0.105),
    },
    bottom: {
      x: marginX,
      y: Math.round(height * 0.810),
      width: width - marginX * 2,
      height: Math.round(height * 0.090),
    },
  };
}

function resolveInk(ink = 'cream') {
  const inks = {
    cream: '#F6E9CA',
    bone: '#F4E6C1',
    white: '#F8F7F1',
    black: '#111111',
    'warm-white': '#FFF3D8',
    gold: '#E8C976',
  };

  return inks[ink] || inks.cream;
}

function resolveStroke(stroke = 'none', fontSize = 80) {
  const thin = Math.max(1.25, Math.round(fontSize * 0.026));
  const medium = Math.max(2, Math.round(fontSize * 0.045));

  if (stroke === 'none') {
    return {
      color: 'rgba(0,0,0,0)',
      width: 0,
    };
  }

  if (stroke === 'hairline-dark') {
    return {
      color: 'rgba(0,0,0,0.52)',
      width: thin,
    };
  }

  if (stroke === 'thin-dark') {
    return {
      color: 'rgba(0,0,0,0.70)',
      width: thin,
    };
  }

  if (stroke === 'soft-dark') {
    return {
      color: 'rgba(0,0,0,0.62)',
      width: medium,
    };
  }

  return {
    color: 'rgba(0,0,0,0.55)',
    width: thin,
  };
}

function resolveShadow(shadow = 'soft', fontSize = 80) {
  if (shadow === 'none') {
    return {
      color: 'rgba(0,0,0,0)',
      blur: 0,
      offsetX: 0,
      offsetY: 0,
    };
  }

  if (shadow === 'print-shadow') {
    return {
      color: 'rgba(0,0,0,0.62)',
      blur: Math.round(fontSize * 0.06),
      offsetX: Math.round(fontSize * 0.035),
      offsetY: Math.round(fontSize * 0.045),
    };
  }

  if (shadow === 'hard-offset') {
    return {
      color: 'rgba(0,0,0,0.72)',
      blur: Math.round(fontSize * 0.02),
      offsetX: Math.round(fontSize * 0.045),
      offsetY: Math.round(fontSize * 0.055),
    };
  }

  if (shadow === 'neon-soft') {
    return {
      color: 'rgba(255,100,190,0.34)',
      blur: Math.round(fontSize * 0.13),
      offsetX: 0,
      offsetY: Math.round(fontSize * 0.025),
    };
  }

  return {
    color: 'rgba(0,0,0,0.58)',
    blur: Math.round(fontSize * 0.11),
    offsetX: 0,
    offsetY: Math.round(fontSize * 0.035),
  };
}

function makeBlock({
  role,
  text,
  template,
  rects,
  boxName,
  fontFamily,
  weight,
  maxLines,
  minScale,
  maxScale,
  lineHeight,
  tracking,
  align = 'center',
  ink,
  stroke,
  shadow,
  plate = 'none',
  width,
}) {
  if (!text) return null;

  return {
    role,
    text,
    box: rects[boxName] || rects.top,
    fontFamily,
    weight,
    maxLines,
    minFontSize: Math.round(width * minScale),
    maxFontSize: Math.round(width * maxScale),
    lineHeight,
    tracking,
    align,
    ink,
    stroke,
    shadow,
    plate,
    templateId: template.id,
  };
}

export function buildTypographyPlan({
  width,
  height,
  genre,
  visualStyle,
  title,
  subtitle,
  authorName,
  seriesText,
  templateId,
}) {
  const template = getCoverTemplate(templateId || getDefaultTemplateForGenre(genre));
  const rects = zoneRects(width, height);

  const safeTitle = normalizeCoverText(title);
  const safeSubtitle = normalizeCoverText(subtitle);
  const safeAuthor = normalizeCoverText(authorName);
  const safeSeries = normalizeCoverText(seriesText);

  const titleFinal = template.titleUppercase ? safeTitle.toUpperCase() : safeTitle;
  const subtitleFinal = template.subtitleUppercase ? safeSubtitle.toUpperCase() : safeSubtitle;
  const authorFinal = template.authorUppercase ? safeAuthor.toUpperCase() : safeAuthor;
  const seriesFinal = template.seriesUppercase ? safeSeries.toUpperCase() : safeSeries;

  const subtitleBox =
    template.titleZone === 'top'
      ? 'underTitleTop'
      : 'underTitleMiddle';

  const blocks = [
    makeBlock({
      role: 'series',
      text: seriesFinal,
      template,
      rects,
      boxName: template.seriesZone || 'topStrip',
      fontFamily: template.seriesFont,
      weight: template.seriesWeight,
      maxLines: template.seriesMaxLines,
      minScale: template.seriesMinScale,
      maxScale: template.seriesScale,
      lineHeight: template.seriesLineHeight,
      tracking: template.seriesTracking,
      ink: template.seriesInk,
      stroke: template.seriesStroke,
      shadow: template.seriesShadow,
      plate: template.seriesPlate,
      width,
    }),
    makeBlock({
      role: 'title',
      text: titleFinal,
      template,
      rects,
      boxName: template.titleZone || 'top',
      fontFamily: template.titleFont,
      weight: template.titleWeight,
      maxLines: template.titleMaxLines,
      minScale: template.titleMinScale,
      maxScale: template.titleScale,
      lineHeight: template.titleLineHeight,
      tracking: template.titleTracking,
      ink: template.titleInk,
      stroke: template.titleStroke,
      shadow: template.titleShadow,
      plate: template.titlePlate,
      width,
    }),
    makeBlock({
      role: 'subtitle',
      text: subtitleFinal,
      template,
      rects,
      boxName: subtitleBox,
      fontFamily: template.subtitleFont,
      weight: template.subtitleWeight,
      maxLines: template.subtitleMaxLines,
      minScale: template.subtitleMinScale,
      maxScale: template.subtitleScale,
      lineHeight: template.subtitleLineHeight,
      tracking: template.subtitleTracking,
      ink: template.subtitleInk,
      stroke: template.subtitleStroke,
      shadow: template.subtitleShadow,
      plate: template.subtitlePlate,
      width,
    }),
    makeBlock({
      role: 'author',
      text: authorFinal,
      template,
      rects,
      boxName: template.authorZone || 'bottomLifted',
      fontFamily: template.authorFont,
      weight: template.authorWeight,
      maxLines: template.authorMaxLines,
      minScale: template.authorMinScale,
      maxScale: template.authorScale,
      lineHeight: template.authorLineHeight,
      tracking: template.authorTracking,
      ink: template.authorInk,
      stroke: template.authorStroke,
      shadow: template.authorShadow,
      plate: template.authorPlate,
      width,
    }),
  ].filter(Boolean);

  return {
    template,
    titleZone: template.titleZone,
    authorZone: template.authorZone,
    blocks,
    resolveInk,
    resolveStroke,
    resolveShadow,
  };
}