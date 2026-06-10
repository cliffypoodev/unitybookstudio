/**
 * coverPromptBuilder.js — Kittl-style structured prompt builder for cover art
 *
 * Builds prompts using the three-line formula:
 *   Line 1: [Aspect ratio signal] + [Lighting type and quality] + [Technical mood]
 *   Line 2: [Subject: specific] + [Composition: where/how framed] + [Setting/environment] + [Emotional tone]
 *   Line 3: [Style/model preset] + [Named color palette] + [Finish/texture quality]
 *
 * Supports both Flux (natural language) and PonyXL (tag-aware) prompts.
 *
 * @module coverPromptBuilder
 */

import { getGenreCoverTemplate, getRecommendedPipeline } from './coverGenreTemplates.js';
import { COVER_TYPOGRAPHY_MODES } from './coverComfyWorkflows.js';
import { buildCoverSafetyConstraints, sanitizeCoverNegativePrompt } from './coverSafety.js';

// ─── Anti-Book-Photo Framing ──────────────────────────────────────────────

const FLAT_ARTWORK_LEAD =
  'Vertical portrait illustration in 2:3 aspect ratio, designed as a single flat 2D image that fills the entire frame edge-to-edge with no borders, no margins, and no background surface.';

const FLAT_ARTWORK_NEGATIVES =
  'physical book, hardcover, paperback, book spine, book pages, book edges, 3D book object, table, shelf, desk, surface, product mockup, bookstore display, stack of books, drop shadows suggesting a book lying on something, perspective angles suggesting a physical object';


// ─── Core Three-Line Prompt ───────────────────────────────────────────────

/**
 * Build a Kittl-style three-line prompt.
 *
 * @param {Object} project - Project data
 * @param {Object} settings - Generation settings
 * @param {string} [settings.lighting] - Custom lighting override
 * @param {string} [settings.subject] - Custom subject override
 * @param {string} [settings.palette] - Custom palette override
 * @param {string} [settings.finish] - Custom finish override
 * @param {string} [settings.composition] - Custom composition override
 * @param {string} [settings.stylePreset] - Custom style override
 * @param {string} [settings.genreTemplateId] - Genre template ID override
 * @returns {{ line1: string, line2: string, line3: string, full: string }}
 */
export function buildKittlStyleThreeLinePrompt(project, settings = {}) {
  const genre = project?.genre || '';
  const subgenre = project?.subgenre || '';
  const template = settings.genreTemplateId
    ? (getGenreCoverTemplate(settings.genreTemplateId) || getGenreCoverTemplate(genre, subgenre))
    : getGenreCoverTemplate(genre, subgenre);

  // Line 1: Lighting & Technical Mood
  const lighting = settings.lighting || template.lighting;
  const line1 = `${FLAT_ARTWORK_LEAD} ${lighting}`;

  // Line 2: Subject & Composition
  const subject = settings.subject || template.subject;
  const composition = settings.composition || template.composition;
  const line2 = `${subject}. ${composition}`;

  // Line 3: Style, Palette, Finish
  const stylePreset = settings.stylePreset || template.stylePreset;
  const palette = settings.palette || template.palette;
  const finish = settings.finish || template.finish;
  const line3 = `${stylePreset}. Color palette: ${palette}. ${finish}`;

  return {
    line1,
    line2,
    line3,
    full: `${line1}\n${line2}\n${line3}`,
  };
}


// ─── Typography Instruction ───────────────────────────────────────────────

/**
 * Build typography instructions based on the typography mode.
 *
 * @param {Object} project
 * @param {Object} settings
 * @param {string} [settings.typographyMode='image_only']
 * @returns {{ promptAddition: string, negativeAddition: string }}
 */
export function buildTypographyInstruction(project, settings = {}) {
  const mode = settings.typographyMode || 'image_only';
  const typMode = COVER_TYPOGRAPHY_MODES[mode] || COVER_TYPOGRAPHY_MODES.image_only;

  if (mode === 'typography_reference') {
    const title = settings.coverTitle || project?.title || 'Untitled';
    const author = settings.authorName || project?.author_name || '';

    const parts = [`Title text reading "${title}" integrated into the artwork composition`];
    if (author) {
      parts.push(`Author name reading "${author}" integrated into the artwork composition`);
    }

    const genre = project?.genre || '';
    const subgenre = project?.subgenre || '';
    const template = getGenreCoverTemplate(genre, subgenre);
    if (template.typographyAdvice) {
      parts.push(template.typographyAdvice);
    }

    return {
      promptAddition: parts.join('. '),
      negativeAddition: '',
    };
  }

  return {
    promptAddition: typMode.promptAddition || '',
    negativeAddition: typMode.negativeAddition || '',
  };
}


// ─── Genre Style Block ───────────────────────────────────────────────────

/**
 * Build a genre-specific style block for the prompt.
 *
 * @param {Object} project
 * @param {Object} [settings]
 * @returns {string}
 */
export function buildGenreCoverStyleBlock(project, settings = {}) {
  const genre = project?.genre || '';
  const subgenre = project?.subgenre || '';
  const template = getGenreCoverTemplate(genre, subgenre);

  return `Genre: ${genre}${subgenre ? ` / ${subgenre}` : ''}. ${template.stylePreset}. Professional publishing-grade illustration quality, bookstore-ready composition.`;
}


// ─── Series Signature ─────────────────────────────────────────────────────

/**
 * Get series cover signature for consistency across books.
 * Preserves exact lighting + palette language.
 *
 * @param {Object} project
 * @param {Object} [settings]
 * @param {string} [settings.seriesLighting] - Established series lighting language
 * @param {string} [settings.seriesPalette] - Established series palette language
 * @param {string} [settings.seriesFinish] - Established series finish language
 * @returns {{ hasSeriesSignature: boolean, seriesBlock: string }}
 */
export function getSeriesCoverSignature(project, settings = {}) {
  const seriesLighting = settings.seriesLighting || '';
  const seriesPalette = settings.seriesPalette || '';
  const seriesFinish = settings.seriesFinish || '';

  if (!seriesLighting && !seriesPalette && !seriesFinish) {
    return { hasSeriesSignature: false, seriesBlock: '' };
  }

  const parts = [
    'SERIES CONSISTENCY — Preserve the following exact visual language across all books in this series:',
  ];
  if (seriesLighting) parts.push(`Lighting: ${seriesLighting}`);
  if (seriesPalette) parts.push(`Palette: ${seriesPalette}`);
  if (seriesFinish) parts.push(`Finish: ${seriesFinish}`);

  return {
    hasSeriesSignature: true,
    seriesBlock: parts.join('\n'),
  };
}


// ─── Flux Prompt Builder ──────────────────────────────────────────────────

/**
 * Build a natural-language Flux prompt for cover art.
 *
 * @param {Object} project
 * @param {Object} settings
 * @returns {{ positive: string, negative: string }}
 */
export function buildFluxCoverPrompt(project, settings = {}) {
  const threeLines = buildKittlStyleThreeLinePrompt(project, settings);
  const typography = buildTypographyInstruction(project, settings);
  const genreStyle = buildGenreCoverStyleBlock(project, settings);
  const series = getSeriesCoverSignature(project, settings);
  const artDescription = settings.artDescription || '';

  const positiveParts = [
    threeLines.full,
    typography.promptAddition,
    genreStyle,
    artDescription,
    series.hasSeriesSignature ? series.seriesBlock : '',
    'Professional publishing-grade illustration quality.',
  ];

  const negativeParts = [
    FLAT_ARTWORK_NEGATIVES,
    typography.negativeAddition,
  ];

  // Safety constraints
  const safety = buildCoverSafetyConstraints(project, settings);
  if (safety.mandatoryNegatives.length > 0) {
    negativeParts.push(safety.mandatoryNegatives.join(', '));
  }

  return {
    positive: positiveParts.filter(Boolean).join('\n'),
    negative: negativeParts.filter(Boolean).join(', '),
  };
}


// ─── PonyXL Prompt Builder ────────────────────────────────────────────────

/**
 * Build a tag-aware PonyXL prompt for cover art.
 *
 * @param {Object} project
 * @param {Object} settings
 * @returns {{ positive: string, negative: string }}
 */
export function buildPonyXLCoverPrompt(project, settings = {}) {
  const threeLines = buildKittlStyleThreeLinePrompt(project, settings);
  const typography = buildTypographyInstruction(project, settings);
  const genreStyle = buildGenreCoverStyleBlock(project, settings);
  const series = getSeriesCoverSignature(project, settings);
  const artDescription = settings.artDescription || '';

  const genre = project?.genre || '';
  const subgenre = project?.subgenre || '';
  const template = getGenreCoverTemplate(genre, subgenre);

  const positiveParts = [
    'score_9, score_8_up, score_7_up',
    threeLines.full,
    typography.promptAddition,
    genreStyle,
    artDescription,
    series.hasSeriesSignature ? series.seriesBlock : '',
    'masterpiece, best quality, professional cover art',
  ];

  const basNeg = [
    'score_1, score_2, score_3',
    FLAT_ARTWORK_NEGATIVES,
    typography.negativeAddition,
    template.negativeAdditions || '',
    'worst quality, low quality, blurry, watermark, signature, amateur, ugly',
  ].filter(Boolean).join(', ');

  const negative = sanitizeCoverNegativePrompt(basNeg, project, settings);

  return {
    positive: positiveParts.filter(Boolean).join('\n'),
    negative,
  };
}


// ─── Negative Prompt Builder ──────────────────────────────────────────────

/**
 * Build a negative prompt for cover generation.
 *
 * @param {Object} project
 * @param {Object} settings
 * @returns {string}
 */
export function buildCoverNegativePrompt(project, settings = {}) {
  const modelPipeline = settings.modelPipeline || getRecommendedPipeline(project?.genre, project?.subgenre);

  if (modelPipeline === 'ponyxl') {
    return buildPonyXLCoverPrompt(project, settings).negative;
  }
  return buildFluxCoverPrompt(project, settings).negative;
}


// ─── Main Router ──────────────────────────────────────────────────────────

/**
 * Build a cover prompt for the given model pipeline.
 * Routes to Flux or PonyXL prompt builder.
 *
 * @param {Object} project
 * @param {Object} settings
 * @param {string} [settings.modelPipeline] - 'flux' or 'ponyxl'
 * @returns {{ positive: string, negative: string }}
 */
export function buildCoverPrompt(project, settings = {}) {
  const modelPipeline = settings.modelPipeline || getRecommendedPipeline(project?.genre, project?.subgenre);

  if (modelPipeline === 'ponyxl') {
    return buildPonyXLCoverPrompt(project, settings);
  }
  return buildFluxCoverPrompt(project, settings);
}
