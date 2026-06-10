// =============================================================
// SOURCE: zachhannum/orca — app/types/types.ts (MIT License)
// + pressbooks/buckram — assets/styles/variables/ (GPL v3)
// Adapted from TypeScript to JavaScript for Base44
// =============================================================

// --- Trim Size Constants (KDP-compatible) ---
export const POPULAR_TRIM_SIZES = [
  '5in x 8in', '5.25in x 8in', '5.5in x 8.5in', '6in x 9in',
];
export const ADDITIONAL_TRIM_SIZES = [
  '5.06in x 7.81in', '5.5in x 8.25in', '6.14in x 9.21in',
];
export const INTERNATIONAL_TRIM_SIZES = [
  '4.72in x 7.48in', '4.92in x 7.48in', '5.31in x 8.46in', '5.83in x 8.27in',
];
export const MASS_MARKET_TRIM_SIZES = [
  '4.12in x 6.75in', '4.25in x 7in', '4.37in x 7in',
];
export const ALL_TRIM_SIZES = [
  ...POPULAR_TRIM_SIZES, ...ADDITIONAL_TRIM_SIZES,
  ...INTERNATIONAL_TRIM_SIZES, ...MASS_MARKET_TRIM_SIZES,
];
export const TRIM_SIZE_GROUPS = [
  { name: 'Popular', options: POPULAR_TRIM_SIZES },
  { name: 'Additional', options: ADDITIONAL_TRIM_SIZES },
  { name: 'International', options: INTERNATIONAL_TRIM_SIZES },
  { name: 'Mass Market', options: MASS_MARKET_TRIM_SIZES },
];

// --- Enum Constants ---
export const LEAD_IN_OPTIONS = ['None', 'Small Caps', 'Italics'];
export const PAGE_HEADER_OPTIONS = ['None', 'Chapter Title', 'Book Title', 'Author Name'];
export const PARAGRAPH_BREAK_OPTIONS = ['Indented', 'Single Line Space'];
export const LINE_HEIGHT_OPTIONS = ['Single', '1.5', 'Double'];
export const SCENE_BREAK_OPTIONS = ['None', '𐫱', '❦', '⁂', '⁕', '⁕ ⁕ ⁕', '• • •'];

export const FONT_OPTIONS = [
  'Times New Roman', 'Georgia', 'Garamond', 'Palatino', 'Baskerville',
  'Merriweather', 'Libre Baskerville', 'Lora', 'Cormorant Garamond', 'Caslon',
];
export const HEADING_FONT_OPTIONS = [
  ...FONT_OPTIONS, 'Oswald', 'Playfair Display', 'DM Sans', 'Raleway',
];
export const FONT_SIZE_OPTIONS = ['8', '9', '10', '11', '12', '14', '16'];

// --- Default Publish Settings (Orca defaultPublishSettings) ---
export const DEFAULT_PUBLISH_SETTINGS = {
  dropCap: false,
  dropCapEnableAdvancedSettings: false,
  dropCapFont: '',
  dropCapLineHeight: 0.65,
  dropCapBottomMargin: 0.1,
  leadIn: 'None',
  paragraphBreak: 'Indented',
  sceneBreak: '𐫱',
  rectoPageHeaders: 'None',
  versoPageHeaders: 'None',
  paragraphFont: 'Times New Roman',
  fontSize: 12,
  lineHeight: 'Single',
  dropFolio: false,
  topMargin: 0.5,
  bottomMargin: 0.5,
  insideMargin: 0.75,
  outsideMargin: 0.5,
  trimSize: '5in x 8in',
};

// --- 8 Theme Presets ---
export const THEME_PRESETS = {
  classicNovel: {
    ...DEFAULT_PUBLISH_SETTINGS,
    name: 'Classic Novel',
    description: 'Traditional literary fiction — Garamond, drop caps, centered titles',
    paragraphFont: 'Garamond', fontSize: 11, lineHeight: '1.5',
    paragraphBreak: 'Indented', dropCap: true, dropCapLineHeight: 0.65,
    leadIn: 'Small Caps', sceneBreak: '⁕ ⁕ ⁕',
    rectoPageHeaders: 'Book Title', versoPageHeaders: 'Chapter Title',
    dropFolio: true, topMargin: 0.75, bottomMargin: 0.75,
    insideMargin: 0.85, outsideMargin: 0.65, trimSize: '6in x 9in',
  },
  modernClean: {
    ...DEFAULT_PUBLISH_SETTINGS,
    name: 'Modern Clean',
    description: 'Contemporary minimalist — Merriweather, left-aligned titles',
    paragraphFont: 'Merriweather', fontSize: 11, lineHeight: '1.5',
    paragraphBreak: 'Indented', dropCap: false, leadIn: 'None', sceneBreak: '• • •',
    rectoPageHeaders: 'Book Title', versoPageHeaders: 'Chapter Title',
    dropFolio: false, topMargin: 0.7, bottomMargin: 0.7,
    insideMargin: 0.8, outsideMargin: 0.6, trimSize: '5.5in x 8.5in',
  },
  paperbackThriller: {
    ...DEFAULT_PUBLISH_SETTINGS,
    name: 'Paperback Thriller',
    description: 'Mass market pacing — TNR 10pt, tight margins',
    paragraphFont: 'Times New Roman', fontSize: 10, lineHeight: 'Single',
    paragraphBreak: 'Indented', dropCap: false, leadIn: 'Italics', sceneBreak: '⁕ ⁕ ⁕',
    rectoPageHeaders: 'Author Name', versoPageHeaders: 'Chapter Title',
    dropFolio: true, topMargin: 0.5, bottomMargin: 0.5,
    insideMargin: 0.7, outsideMargin: 0.5, trimSize: '5in x 8in',
  },
  literarySerif: {
    ...DEFAULT_PUBLISH_SETTINGS,
    name: 'Literary Serif',
    description: 'Upscale literary — Libre Baskerville with ornamental touches',
    paragraphFont: 'Libre Baskerville', fontSize: 11, lineHeight: '1.5',
    paragraphBreak: 'Indented', dropCap: true, dropCapFont: 'Playfair Display',
    dropCapEnableAdvancedSettings: true, dropCapLineHeight: 0.65, dropCapBottomMargin: 0.1,
    leadIn: 'Small Caps', sceneBreak: '𐫱',
    rectoPageHeaders: 'Book Title', versoPageHeaders: 'Chapter Title',
    dropFolio: true, topMargin: 0.8, bottomMargin: 0.8,
    insideMargin: 0.9, outsideMargin: 0.65, trimSize: '5.5in x 8.5in',
  },
  academic: {
    ...DEFAULT_PUBLISH_SETTINGS,
    name: 'Academic',
    description: 'Textbook / nonfiction — Palatino, block paragraphs, left titles',
    paragraphFont: 'Palatino', fontSize: 11, lineHeight: '1.5',
    paragraphBreak: 'Single Line Space', dropCap: false, leadIn: 'None', sceneBreak: 'None',
    rectoPageHeaders: 'Book Title', versoPageHeaders: 'Chapter Title',
    dropFolio: false, topMargin: 0.75, bottomMargin: 0.75,
    insideMargin: 0.85, outsideMargin: 0.65, trimSize: '6in x 9in',
  },
  largePrint: {
    ...DEFAULT_PUBLISH_SETTINGS,
    name: 'Large Print',
    description: 'Accessibility — Georgia 14pt, generous spacing',
    paragraphFont: 'Georgia', fontSize: 14, lineHeight: 'Double',
    paragraphBreak: 'Indented', dropCap: false, leadIn: 'None', sceneBreak: '⁕ ⁕ ⁕',
    rectoPageHeaders: 'Book Title', versoPageHeaders: 'None',
    dropFolio: false, topMargin: 0.75, bottomMargin: 0.75,
    insideMargin: 0.9, outsideMargin: 0.7, trimSize: '6.14in x 9.21in',
  },
  manuscript: {
    ...DEFAULT_PUBLISH_SETTINGS,
    name: 'Manuscript',
    description: 'Submission format — TNR 12pt, double-spaced, 8.5x11',
    paragraphFont: 'Times New Roman', fontSize: 12, lineHeight: 'Double',
    paragraphBreak: 'Indented', dropCap: false, leadIn: 'None', sceneBreak: '⁕',
    rectoPageHeaders: 'Author Name', versoPageHeaders: 'None',
    dropFolio: false, topMargin: 1.0, bottomMargin: 1.0,
    insideMargin: 1.0, outsideMargin: 1.0, trimSize: '5.83in x 8.27in',
  },
  romance: {
    ...DEFAULT_PUBLISH_SETTINGS,
    name: 'Romance',
    description: 'Genre romance — Georgia with Lora headings, ornamental touches',
    paragraphFont: 'Georgia', fontSize: 11, lineHeight: '1.5',
    paragraphBreak: 'Indented', dropCap: true, dropCapFont: 'Lora',
    dropCapEnableAdvancedSettings: true, dropCapLineHeight: 0.65, dropCapBottomMargin: 0.12,
    leadIn: 'Italics', sceneBreak: '❦',
    rectoPageHeaders: 'Book Title', versoPageHeaders: 'Chapter Title',
    dropFolio: true, topMargin: 0.65, bottomMargin: 0.65,
    insideMargin: 0.75, outsideMargin: 0.55, trimSize: '5in x 8in',
  },
};

export const PRESET_NAMES = Object.keys(THEME_PRESETS);
export const getPreset = (name) => THEME_PRESETS[name] || THEME_PRESETS.classicNovel;

// --- Helpers ---
export function parseTrimSize(trimStr) {
  const match = trimStr.match(/([\d.]+)in\s*x\s*([\d.]+)in/);
  if (!match) return { w: 6, h: 9 };
  return { w: parseFloat(match[1]), h: parseFloat(match[2]) };
}

export function getLineHeightValue(lh) {
  switch (lh) {
    case 'Single': return '1';
    case '1.5': return '1.5';
    case 'Double': return '2';
    default: return '1.5';
  }
}