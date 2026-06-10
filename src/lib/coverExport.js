/**
 * coverExport.js — Front-cover export presets and download utilities
 *
 * Provides KDP-standard export presets, dimension validation,
 * metadata building, and browser download for cover images.
 *
 * @module coverExport
 */

// ─── Export Presets ────────────────────────────────────────────────────────

/**
 * Cover export presets with KDP-standard dimensions.
 * Dimensions are at 300 DPI.
 */
export const COVER_EXPORT_PRESETS = {
  ebook: {
    id: 'ebook',
    label: 'eBook Cover',
    width: 1600,
    height: 2560,
    dpi: 300,
    ratio: '5:8',
    description: 'Amazon KDP eBook recommended minimum 1600×2560',
  },
  paperback_6x9: {
    id: 'paperback_6x9',
    label: '6×9 Paperback Front',
    width: 1890,
    height: 2775,
    dpi: 300,
    ratio: '2:3',
    description: '6×9" at 300 DPI with 0.125" bleed on each side',
  },
  paperback_5x8: {
    id: 'paperback_5x8',
    label: '5×8 Paperback Front',
    width: 1563,
    height: 2500,
    dpi: 300,
    ratio: '5:8',
    description: '5×8" at 300 DPI with 0.125" bleed on each side',
  },
  square_promo: {
    id: 'square_promo',
    label: 'Square Promo',
    width: 2000,
    height: 2000,
    dpi: 300,
    ratio: '1:1',
    description: 'Social media square promo image',
  },
  vertical_promo: {
    id: 'vertical_promo',
    label: 'Vertical Promo',
    width: 1080,
    height: 1920,
    dpi: 72,
    ratio: '9:16',
    description: 'Instagram / TikTok vertical promo',
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    width: null,
    height: null,
    dpi: 300,
    ratio: 'custom',
    description: 'User-defined dimensions',
  },
};


// ─── Dimension Helpers ────────────────────────────────────────────────────

/**
 * Get export dimensions for a preset.
 *
 * @param {string} preset - Preset name from COVER_EXPORT_PRESETS
 * @param {{ width?: number, height?: number }} [customDimensions]
 * @returns {{ width: number, height: number, dpi: number }}
 */
export function getCoverExportDimensions(preset, customDimensions) {
  if (preset === 'custom' && customDimensions) {
    return {
      width: Math.max(512, Math.min(6000, customDimensions.width || 1600)),
      height: Math.max(512, Math.min(6000, customDimensions.height || 2560)),
      dpi: 300,
    };
  }

  const entry = COVER_EXPORT_PRESETS[preset] || COVER_EXPORT_PRESETS.ebook;
  return { width: entry.width, height: entry.height, dpi: entry.dpi };
}


// ─── Validation ───────────────────────────────────────────────────────────

/**
 * Validate cover export settings.
 *
 * @param {Object} settings
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCoverExportSettings(settings) {
  const errors = [];

  if (!settings.imageUrl && !settings.canvas && !settings.blob) {
    errors.push('No image source provided (imageUrl, canvas, or blob required)');
  }
  if (settings.preset === 'custom') {
    if (!settings.width || settings.width < 512) {
      errors.push('Custom width must be at least 512px');
    }
    if (!settings.height || settings.height < 512) {
      errors.push('Custom height must be at least 512px');
    }
  }
  if (settings.format && !['png', 'jpg', 'jpeg'].includes(settings.format)) {
    errors.push('Export format must be png, jpg, or jpeg');
  }
  if (settings.quality != null && (settings.quality < 0.1 || settings.quality > 1)) {
    errors.push('Quality must be between 0.1 and 1.0');
  }

  return { valid: errors.length === 0, errors };
}


// ─── Metadata Builder ─────────────────────────────────────────────────────

/**
 * Build export metadata for a cover.
 *
 * @param {Object} project
 * @param {Object} coverAsset - Cover image/variation data
 * @param {Object} [typographySettings]
 * @returns {Object}
 */
export function buildCoverExportMetadata(project, coverAsset, typographySettings) {
  return {
    title: project?.title || 'Untitled',
    author: project?.author_name || 'Unknown Author',
    genre: project?.genre || '',
    subgenre: project?.subgenre || '',
    projectId: project?.id || null,
    exportedAt: new Date().toISOString(),
    preset: coverAsset?.exportPreset || 'ebook',
    width: coverAsset?.width || null,
    height: coverAsset?.height || null,
    modelPipeline: coverAsset?.modelPipeline || null,
    seed: coverAsset?.seed || null,
    checkpoint: coverAsset?.checkpoint || null,
    hasTypography: !!(typographySettings?.titleText || typographySettings?.authorText),
    typographyFontId: typographySettings?.titleFontId || null,
    format: coverAsset?.format || 'png',
  };
}


// ─── Filename Builder ─────────────────────────────────────────────────────

/**
 * Build a safe filename for cover export.
 *
 * @param {Object} project
 * @param {string} preset
 * @param {string} format
 * @returns {string}
 */
export function buildExportFilename(project, preset, format = 'png') {
  const title = (project?.title || 'cover')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const presetLabel = (COVER_EXPORT_PRESETS[preset]?.label || preset || 'custom')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

  const timestamp = Date.now();
  return `${title}-${presetLabel}-${timestamp}.${format}`;
}


// ─── Download ─────────────────────────────────────────────────────────────

/**
 * Trigger a browser download of a blob.
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadCoverImage(blob, filename) {
  if (!blob) throw new Error('No blob provided for download');
  if (!filename) throw new Error('No filename provided for download');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}


// ─── Full Export Pipelines ────────────────────────────────────────────────

/**
 * Export a front cover as PNG: resize → composite → download.
 *
 * @param {Object} params
 * @param {Object} params.project
 * @param {HTMLImageElement|string} params.backgroundImage
 * @param {Object} [params.typographySettings]
 * @param {string} [params.preset='ebook']
 * @param {boolean} [params.showGuides=false]
 * @returns {Promise<{ blob: Blob, filename: string, metadata: Object }>}
 */
export async function exportFrontCoverPNG({ project, backgroundImage, typographySettings, preset = 'ebook', showGuides = false }) {
  const { renderCoverCompositeToCanvas, exportCompositeCoverPNG } = await import('./coverTypographyComposer.js');

  const dims = getCoverExportDimensions(preset);
  const canvas = await renderCoverCompositeToCanvas(backgroundImage, typographySettings || {}, {
    width: dims.width,
    height: dims.height,
    showGuides,
  });

  const blob = await exportCompositeCoverPNG(canvas);
  const filename = buildExportFilename(project, preset, 'png');
  const metadata = buildCoverExportMetadata(project, { ...dims, exportPreset: preset, format: 'png' }, typographySettings);

  return { blob, filename, metadata };
}

/**
 * Export a front cover as JPG.
 *
 * @param {Object} params - Same as exportFrontCoverPNG
 * @param {number} [params.quality=0.92]
 * @returns {Promise<{ blob: Blob, filename: string, metadata: Object }>}
 */
export async function exportFrontCoverJPG({ project, backgroundImage, typographySettings, preset = 'ebook', quality = 0.92, showGuides = false }) {
  const { renderCoverCompositeToCanvas, exportCompositeCoverJPG } = await import('./coverTypographyComposer.js');

  const dims = getCoverExportDimensions(preset);
  const canvas = await renderCoverCompositeToCanvas(backgroundImage, typographySettings || {}, {
    width: dims.width,
    height: dims.height,
    showGuides,
  });

  const blob = await exportCompositeCoverJPG(canvas, quality);
  const filename = buildExportFilename(project, preset, 'jpg');
  const metadata = buildCoverExportMetadata(project, { ...dims, exportPreset: preset, format: 'jpg' }, typographySettings);

  return { blob, filename, metadata };
}
