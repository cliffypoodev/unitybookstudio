/**
 * coverTypographyComposer.js — Canvas-based typography overlay for book covers
 *
 * Renders title, subtitle, author, series, and tagline text onto a cover
 * image using HTML5 Canvas. Produces composited PNG or JPG output.
 *
 * Typography is ALWAYS applied by the app, never by the image model.
 * Generated art is the background; this module composites the final cover.
 *
 * @module coverTypographyComposer
 */

// ─── Font Families ────────────────────────────────────────────────────────

/**
 * Curated font families available for cover typography.
 * Organized by category for UI presentation.
 */
export const FONT_FAMILIES = [
  // Serif — classic book typography
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', category: 'serif' },
  { id: 'times', label: 'Times New Roman', family: '"Times New Roman", Times, serif', category: 'serif' },
  { id: 'palatino', label: 'Palatino', family: '"Palatino Linotype", Palatino, serif', category: 'serif' },
  { id: 'garamond', label: 'Garamond', family: 'Garamond, "EB Garamond", serif', category: 'serif' },
  { id: 'baskerville', label: 'Baskerville', family: 'Baskerville, "Baskerville Old Face", serif', category: 'serif' },
  { id: 'bodoni', label: 'Bodoni', family: '"Bodoni MT", Didot, serif', category: 'serif' },
  // Sans-Serif — modern/clean
  { id: 'arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif', category: 'sans-serif' },
  { id: 'helvetica', label: 'Helvetica', family: 'Helvetica, Arial, sans-serif', category: 'sans-serif' },
  { id: 'futura', label: 'Futura', family: 'Futura, "Century Gothic", sans-serif', category: 'sans-serif' },
  { id: 'avenir', label: 'Avenir', family: '"Avenir Next", Avenir, sans-serif', category: 'sans-serif' },
  { id: 'gill-sans', label: 'Gill Sans', family: '"Gill Sans", "Gill Sans MT", sans-serif', category: 'sans-serif' },
  // Display — impact/drama
  { id: 'impact', label: 'Impact', family: 'Impact, "Haettenschweiler", sans-serif', category: 'display' },
  { id: 'copperplate', label: 'Copperplate', family: '"Copperplate Gothic Bold", Copperplate, serif', category: 'display' },
  // Script — romance/literary
  { id: 'brush-script', label: 'Brush Script', family: '"Brush Script MT", "Brush Script Std", cursive', category: 'script' },
  { id: 'snell', label: 'Snell Roundhand', family: '"Snell Roundhand", cursive', category: 'script' },
  // Monospace — tech/thriller
  { id: 'courier', label: 'Courier New', family: '"Courier New", Courier, monospace', category: 'monospace' },
];

export function getFontFamilyById(id) {
  return FONT_FAMILIES.find(f => f.id === id) || FONT_FAMILIES[0];
}


// ─── Placement Presets ────────────────────────────────────────────────────

/**
 * Title placement presets define where the title block sits on the cover.
 * Coordinates are proportional (0–1) relative to the cover dimensions.
 */
export const TITLE_PLACEMENT_PRESETS = {
  top_center: { id: 'top_center', label: 'Top Center', x: 0.5, y: 0.15, textAlign: 'center' },
  top_left: { id: 'top_left', label: 'Top Left', x: 0.08, y: 0.15, textAlign: 'left' },
  center: { id: 'center', label: 'Center', x: 0.5, y: 0.45, textAlign: 'center' },
  bottom_center: { id: 'bottom_center', label: 'Bottom Center', x: 0.5, y: 0.75, textAlign: 'center' },
  bottom_left: { id: 'bottom_left', label: 'Bottom Left', x: 0.08, y: 0.75, textAlign: 'left' },
};

/**
 * Author name placement presets.
 */
export const AUTHOR_PLACEMENT_PRESETS = {
  bottom_center: { id: 'bottom_center', label: 'Bottom Center', x: 0.5, y: 0.92, textAlign: 'center' },
  bottom_right: { id: 'bottom_right', label: 'Bottom Right', x: 0.92, y: 0.92, textAlign: 'right' },
  bottom_left: { id: 'bottom_left', label: 'Bottom Left', x: 0.08, y: 0.92, textAlign: 'left' },
  top_center: { id: 'top_center', label: 'Top Center', x: 0.5, y: 0.06, textAlign: 'center' },
};


// ─── Safe Margins ─────────────────────────────────────────────────────────

/**
 * KDP safe margin constants.
 * Trim zone: 0.125" from each edge.
 * Safe text area: 0.25" from each edge (beyond trim).
 */
export const SAFE_MARGINS = {
  trimInches: 0.125,
  textSafeInches: 0.25,
};

/**
 * Calculate safe margin pixels for a given DPI and cover dimensions.
 *
 * @param {number} width - Cover width in pixels
 * @param {number} height - Cover height in pixels
 * @param {number} [dpi=300]
 * @returns {{ trimPx: number, textSafePx: number, safeRect: { x: number, y: number, width: number, height: number } }}
 */
export function calculateSafeMargins(width, height, dpi = 300) {
  const trimPx = Math.round(SAFE_MARGINS.trimInches * dpi);
  const textSafePx = Math.round(SAFE_MARGINS.textSafeInches * dpi);

  return {
    trimPx,
    textSafePx,
    safeRect: {
      x: textSafePx,
      y: textSafePx,
      width: width - 2 * textSafePx,
      height: height - 2 * textSafePx,
    },
  };
}


// ─── Default Typography Settings ──────────────────────────────────────────

/**
 * Default typography settings for cover text.
 */
export const DEFAULT_TYPOGRAPHY_SETTINGS = {
  // Title
  titleText: '',
  titleFontId: 'georgia',
  titleFontSize: 72,
  titleFontWeight: 'bold',
  titleColor: '#FFFFFF',
  titleLetterSpacing: 2,
  titleLineHeight: 1.2,
  titleShadow: true,
  titleShadowColor: 'rgba(0,0,0,0.7)',
  titleShadowBlur: 8,
  titleShadowOffsetX: 2,
  titleShadowOffsetY: 2,
  titlePlacement: 'top_center',

  // Subtitle
  subtitleText: '',
  subtitleFontId: 'georgia',
  subtitleFontSize: 32,
  subtitleFontWeight: 'normal',
  subtitleColor: '#E0E0E0',
  subtitleLetterSpacing: 1,
  subtitleLineHeight: 1.3,
  subtitleShadow: true,

  // Author
  authorText: '',
  authorFontId: 'georgia',
  authorFontSize: 36,
  authorFontWeight: 'normal',
  authorColor: '#FFFFFF',
  authorLetterSpacing: 3,
  authorLineHeight: 1.2,
  authorShadow: true,
  authorPlacement: 'bottom_center',

  // Series
  seriesText: '',
  seriesFontId: 'georgia',
  seriesFontSize: 20,
  seriesFontWeight: 'normal',
  seriesColor: '#CCCCCC',

  // Tagline
  taglineText: '',
  taglineFontId: 'georgia',
  taglineFontSize: 22,
  taglineFontWeight: 'italic',
  taglineColor: '#E0E0E0',

  // Global
  safeMargins: true,
  glowEnabled: false,
  glowColor: 'rgba(255,255,255,0.3)',
  glowBlur: 20,
};


// ─── Validation ───────────────────────────────────────────────────────────

/**
 * Validate typography settings.
 *
 * @param {Object} settings
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTypographySettings(settings) {
  const errors = [];

  if (settings.titleFontSize != null && (settings.titleFontSize < 8 || settings.titleFontSize > 400)) {
    errors.push('Title font size must be between 8 and 400');
  }
  if (settings.subtitleFontSize != null && (settings.subtitleFontSize < 6 || settings.subtitleFontSize > 300)) {
    errors.push('Subtitle font size must be between 6 and 300');
  }
  if (settings.authorFontSize != null && (settings.authorFontSize < 6 || settings.authorFontSize > 300)) {
    errors.push('Author font size must be between 6 and 300');
  }
  if (settings.titleLetterSpacing != null && (settings.titleLetterSpacing < -10 || settings.titleLetterSpacing > 50)) {
    errors.push('Title letter spacing must be between -10 and 50');
  }
  if (settings.titleColor && !/^#[0-9A-Fa-f]{3,8}$/.test(settings.titleColor) && !/^rgba?\(/.test(settings.titleColor)) {
    errors.push('Title color must be a valid hex or rgba color');
  }

  return { valid: errors.length === 0, errors };
}


// ─── Typography Overlay Builder ───────────────────────────────────────────

/**
 * Build typography overlay render instructions from settings and project.
 * This does NOT render — it produces a data structure that renderCoverCompositeToCanvas() uses.
 *
 * @param {Object} settings - Typography settings
 * @param {Object} [project] - Project metadata (optional fallback for text)
 * @returns {{ layers: Array<{ role: string, text: string, font: string, fontSize: number, fontWeight: string, color: string, x: number, y: number, textAlign: string, letterSpacing: number, lineHeight: number, shadow: Object|null, glow: Object|null }>, safeMargins: boolean }}
 */
export function buildTypographyOverlay(settings, project) {
  const s = { ...DEFAULT_TYPOGRAPHY_SETTINGS, ...settings };
  const layers = [];

  // Series line (above title if present)
  if (s.seriesText) {
    const titlePreset = TITLE_PLACEMENT_PRESETS[s.titlePlacement] || TITLE_PLACEMENT_PRESETS.top_center;
    layers.push({
      role: 'series',
      text: s.seriesText,
      font: getFontFamilyById(s.seriesFontId).family,
      fontSize: s.seriesFontSize,
      fontWeight: s.seriesFontWeight,
      color: s.seriesColor,
      x: titlePreset.x,
      y: Math.max(0.03, titlePreset.y - 0.07),
      textAlign: titlePreset.textAlign,
      letterSpacing: 2,
      lineHeight: 1.2,
      shadow: s.titleShadow ? { color: s.titleShadowColor || 'rgba(0,0,0,0.5)', blur: 4, offsetX: 1, offsetY: 1 } : null,
      glow: null,
    });
  }

  // Title
  if (s.titleText) {
    const preset = TITLE_PLACEMENT_PRESETS[s.titlePlacement] || TITLE_PLACEMENT_PRESETS.top_center;
    layers.push({
      role: 'title',
      text: s.titleText,
      font: getFontFamilyById(s.titleFontId).family,
      fontSize: s.titleFontSize,
      fontWeight: s.titleFontWeight,
      color: s.titleColor,
      x: preset.x,
      y: preset.y,
      textAlign: preset.textAlign,
      letterSpacing: s.titleLetterSpacing,
      lineHeight: s.titleLineHeight,
      shadow: s.titleShadow ? { color: s.titleShadowColor, blur: s.titleShadowBlur, offsetX: s.titleShadowOffsetX, offsetY: s.titleShadowOffsetY } : null,
      glow: s.glowEnabled ? { color: s.glowColor, blur: s.glowBlur } : null,
    });
  }

  // Subtitle (below title)
  if (s.subtitleText) {
    const titlePreset = TITLE_PLACEMENT_PRESETS[s.titlePlacement] || TITLE_PLACEMENT_PRESETS.top_center;
    layers.push({
      role: 'subtitle',
      text: s.subtitleText,
      font: getFontFamilyById(s.subtitleFontId).family,
      fontSize: s.subtitleFontSize,
      fontWeight: s.subtitleFontWeight,
      color: s.subtitleColor,
      x: titlePreset.x,
      y: titlePreset.y + 0.08,
      textAlign: titlePreset.textAlign,
      letterSpacing: s.subtitleLetterSpacing,
      lineHeight: s.subtitleLineHeight,
      shadow: s.subtitleShadow ? { color: 'rgba(0,0,0,0.5)', blur: 4, offsetX: 1, offsetY: 1 } : null,
      glow: null,
    });
  }

  // Tagline (below subtitle or title)
  if (s.taglineText) {
    const titlePreset = TITLE_PLACEMENT_PRESETS[s.titlePlacement] || TITLE_PLACEMENT_PRESETS.top_center;
    const yOffset = s.subtitleText ? 0.14 : 0.08;
    layers.push({
      role: 'tagline',
      text: s.taglineText,
      font: getFontFamilyById(s.taglineFontId).family,
      fontSize: s.taglineFontSize,
      fontWeight: s.taglineFontWeight,
      color: s.taglineColor,
      x: titlePreset.x,
      y: titlePreset.y + yOffset,
      textAlign: titlePreset.textAlign,
      letterSpacing: 1,
      lineHeight: 1.3,
      shadow: null,
      glow: null,
    });
  }

  // Author
  if (s.authorText) {
    const preset = AUTHOR_PLACEMENT_PRESETS[s.authorPlacement] || AUTHOR_PLACEMENT_PRESETS.bottom_center;
    layers.push({
      role: 'author',
      text: s.authorText,
      font: getFontFamilyById(s.authorFontId).family,
      fontSize: s.authorFontSize,
      fontWeight: s.authorFontWeight,
      color: s.authorColor,
      x: preset.x,
      y: preset.y,
      textAlign: preset.textAlign,
      letterSpacing: s.authorLetterSpacing,
      lineHeight: s.authorLineHeight,
      shadow: s.authorShadow ? { color: 'rgba(0,0,0,0.6)', blur: 6, offsetX: 1, offsetY: 1 } : null,
      glow: null,
    });
  }

  return {
    layers,
    safeMargins: s.safeMargins,
  };
}


// ─── Canvas Rendering ─────────────────────────────────────────────────────

/**
 * Render a text layer onto a canvas context.
 * Handles multi-line text, letter spacing, shadows, and glow.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} layer - Layer descriptor from buildTypographyOverlay
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 */
function renderTextLayer(ctx, layer, canvasWidth, canvasHeight) {
  const x = layer.x * canvasWidth;
  const y = layer.y * canvasHeight;
  const maxWidth = canvasWidth * 0.84; // Stay within 8% margin each side

  ctx.save();

  // Font
  const fontStyle = layer.fontWeight === 'italic' ? 'italic' : '';
  const fontWeight = layer.fontWeight === 'italic' ? 'normal' : (layer.fontWeight || 'normal');
  ctx.font = `${fontStyle} ${fontWeight} ${layer.fontSize}px ${layer.font}`.trim();
  ctx.fillStyle = layer.color;
  ctx.textAlign = layer.textAlign || 'center';
  ctx.textBaseline = 'top';

  // Letter spacing via character-by-character if > 0
  const hasLetterSpacing = layer.letterSpacing && layer.letterSpacing > 0;

  // Glow
  if (layer.glow) {
    ctx.shadowColor = layer.glow.color;
    ctx.shadowBlur = layer.glow.blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Shadow
  if (layer.shadow && !layer.glow) {
    ctx.shadowColor = layer.shadow.color;
    ctx.shadowBlur = layer.shadow.blur;
    ctx.shadowOffsetX = layer.shadow.offsetX || 0;
    ctx.shadowOffsetY = layer.shadow.offsetY || 0;
  }

  // Word-wrap text
  const words = layer.text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Draw lines
  const lineHeightPx = layer.fontSize * (layer.lineHeight || 1.2);

  for (let i = 0; i < lines.length; i++) {
    const lineY = y + i * lineHeightPx;

    if (hasLetterSpacing) {
      drawTextWithLetterSpacing(ctx, lines[i], x, lineY, layer.letterSpacing, layer.textAlign, maxWidth);
    } else {
      ctx.fillText(lines[i], x, lineY, maxWidth);
    }
  }

  ctx.restore();
}

/**
 * Draw text with letter spacing.
 */
function drawTextWithLetterSpacing(ctx, text, x, y, spacing, textAlign, maxWidth) {
  const chars = Array.from(text);
  let totalWidth = 0;
  const charWidths = chars.map(c => {
    const w = ctx.measureText(c).width + spacing;
    totalWidth += w;
    return w;
  });
  totalWidth -= spacing; // No spacing after last char

  let startX = x;
  if (textAlign === 'center') startX = x - totalWidth / 2;
  else if (textAlign === 'right') startX = x - totalWidth;

  // Clamp to maxWidth
  if (totalWidth > maxWidth) {
    const scale = maxWidth / totalWidth;
    let cx = startX;
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cx, y);
      cx += charWidths[i] * scale;
    }
  } else {
    let cx = startX;
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cx, y);
      cx += charWidths[i];
    }
  }
}


/**
 * Render safe margin guides onto a canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {number} [dpi=300]
 */
export function renderSafeMarginGuides(ctx, width, height, dpi = 300) {
  const { trimPx, textSafePx, safeRect } = calculateSafeMargins(width, height, dpi);

  ctx.save();

  // Trim boundary (red dashed)
  ctx.strokeStyle = 'rgba(255, 60, 60, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(trimPx, trimPx, width - 2 * trimPx, height - 2 * trimPx);

  // Safe text area (green dashed)
  ctx.strokeStyle = 'rgba(60, 255, 60, 0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(safeRect.x, safeRect.y, safeRect.width, safeRect.height);

  // Center line (blue dotted)
  ctx.strokeStyle = 'rgba(60, 120, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // Top/bottom title zones (orange shading)
  ctx.fillStyle = 'rgba(255, 165, 0, 0.08)';
  ctx.fillRect(safeRect.x, safeRect.y, safeRect.width, height * 0.25);
  ctx.fillRect(safeRect.x, height * 0.82, safeRect.width, height * 0.12);

  ctx.restore();
}


/**
 * Render a cover composite to canvas: background image + typography layers.
 *
 * This function requires a browser environment (HTMLCanvasElement, Image).
 * In Node.js tests, use mocks or skip.
 *
 * @param {HTMLImageElement|string} backgroundImage - Image element or URL
 * @param {Object} typographySettings
 * @param {{ width: number, height: number, showGuides: boolean }} [options]
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderCoverCompositeToCanvas(backgroundImage, typographySettings, options = {}) {
  const width = options.width || 1600;
  const height = options.height || 2400;
  const showGuides = options.showGuides || false;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Draw background
  let img = backgroundImage;
  if (typeof backgroundImage === 'string') {
    img = await loadImage(backgroundImage);
  }
  ctx.drawImage(img, 0, 0, width, height);

  // Safe margin guides (before text, so text is on top)
  if (showGuides) {
    renderSafeMarginGuides(ctx, width, height);
  }

  // Typography layers
  const overlay = buildTypographyOverlay(typographySettings);
  for (const layer of overlay.layers) {
    renderTextLayer(ctx, layer, width, height);
  }

  return canvas;
}

/**
 * Load an image from URL.
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}


// ─── Export Functions ─────────────────────────────────────────────────────

/**
 * Export a composited cover as PNG blob.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
export async function exportCompositeCoverPNG(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      'image/png'
    );
  });
}

/**
 * Export a composited cover as JPG blob.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} [quality=0.92]
 * @returns {Promise<Blob>}
 */
export async function exportCompositeCoverJPG(canvas, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      'image/jpeg',
      quality
    );
  });
}
