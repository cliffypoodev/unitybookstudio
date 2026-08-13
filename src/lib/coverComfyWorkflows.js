/**
 * coverComfyWorkflows.js — ComfyUI workflow builders for cover generation
 *
 * Builds complete ComfyUI API-format workflow JSON for Flux and PonyXL
 * pipelines. Each builder returns a node graph ready to queue on ComfyUI.
 *
 * @module coverComfyWorkflows
 */

// ─── Model Pipeline Constants ─────────────────────────────────────────────

/**
 * Checkpoint names — update these to match your local ComfyUI model filenames.
 */
export const FLUX_CHECKPOINT_NAME = 'flux1-schnell-fp8.safetensors';
export const PONYXL_CHECKPOINT_NAME = 'cyberrealisticPony_v180Coreshift.safetensors';

/**
 * Model pipeline definitions.
 */
export const COVER_MODEL_PIPELINES = {
  flux: {
    id: 'flux',
    label: 'Flux',
    checkpoint: FLUX_CHECKPOINT_NAME,
    defaultSteps: 20,
    defaultGuidance: 3.5,
    defaultSampler: 'euler',
    defaultScheduler: 'simple',
    supportsNegative: false,
    description: 'Flux — natural language prompts, high coherence, strong composition',
  },
  ponyxl: {
    id: 'ponyxl',
    label: 'PonyXL / SDXL',
    checkpoint: PONYXL_CHECKPOINT_NAME,
    defaultSteps: 25,
    defaultCfg: 7,
    defaultSampler: 'euler',
    defaultScheduler: 'normal',
    supportsNegative: true,
    description: 'PonyXL/SDXL — tag-aware, strong negative prompt support, artistic styles',
  },
};


// ─── Size Presets ─────────────────────────────────────────────────────────

/**
 * Cover size presets. Default is ebook_portrait (2:3 ratio).
 */
export const COVER_SIZE_PRESETS = {
  ebook_portrait: { width: 1600, height: 2400, label: 'eBook Portrait (2:3)', ratio: '2:3' },
  paperback_6x9_front: { width: 1800, height: 2700, label: 'Paperback 6×9 Front', ratio: '2:3' },
  square_promo: { width: 1024, height: 1024, label: 'Square Promo (1:1)', ratio: '1:1' },
  vertical_poster: { width: 1080, height: 1920, label: 'Vertical Poster (9:16)', ratio: '9:16' },
  custom: { width: null, height: null, label: 'Custom', ratio: 'custom' },
};

export const DEFAULT_SIZE_PRESET = 'ebook_portrait';


// ─── Typography Modes ─────────────────────────────────────────────────────

/**
 * Typography handling modes for cover generation.
 */
export const COVER_TYPOGRAPHY_MODES = {
  image_only: {
    id: 'image_only',
    label: 'Image Only (no text)',
    description: 'Generate pure artwork with no text. Typography will be added separately in the cover editor.',
    promptAddition: 'No text, no title, no words, no letters, no typography, no readable characters anywhere in the image.',
    negativeAddition: 'text, title, words, letters, typography, readable characters, writing, signage',
  },
  typography_reference: {
    id: 'typography_reference',
    label: 'Typography Reference',
    description: 'Include title text as reference — not for final use, but to test layout and style.',
    promptAddition: '', // Filled dynamically with title
    negativeAddition: '',
  },
  final_cover_composite_later: {
    id: 'final_cover_composite_later',
    label: 'Composite Later',
    description: 'Generate art with composition leaving clear space for title overlay.',
    promptAddition: 'Composition leaves visual breathing room near the top and bottom of the frame where title and author typography will later be overlaid. No text in the image.',
    negativeAddition: 'text, title, words, letters, typography, readable characters',
  },
};


// ─── Dimension Helpers ────────────────────────────────────────────────────

/**
 * Get cover dimensions for a preset.
 *
 * @param {string} preset - Preset name from COVER_SIZE_PRESETS
 * @param {{ width: number, height: number }} [customDimensions]
 * @returns {{ width: number, height: number }}
 */
export function getCoverDimensionsForPreset(preset, customDimensions) {
  if (preset === 'custom' && customDimensions) {
    return {
      width: Math.max(512, Math.min(4096, customDimensions.width || 1600)),
      height: Math.max(512, Math.min(4096, customDimensions.height || 2400)),
    };
  }

  const entry = COVER_SIZE_PRESETS[preset] || COVER_SIZE_PRESETS[DEFAULT_SIZE_PRESET];
  return { width: entry.width, height: entry.height };
}


// ─── Default Settings ─────────────────────────────────────────────────────

/**
 * Get default generation settings for a model pipeline.
 *
 * @param {'flux'|'ponyxl'} modelPipeline
 * @returns {Object}
 */
export function getDefaultCoverSettingsForModel(modelPipeline) {
  const pipeline = COVER_MODEL_PIPELINES[modelPipeline] || COVER_MODEL_PIPELINES.flux;

  return {
    modelPipeline: pipeline.id,
    checkpoint: pipeline.checkpoint,
    steps: pipeline.defaultSteps,
    cfg: pipeline.defaultCfg || null,
    guidance: pipeline.defaultGuidance || null,
    sampler: pipeline.defaultSampler,
    scheduler: pipeline.defaultScheduler,
    supportsNegative: pipeline.supportsNegative,
    sizePreset: DEFAULT_SIZE_PRESET,
    seed: -1, // Random
  };
}


// ─── Validation ───────────────────────────────────────────────────────────

/**
 * Validate cover workflow options.
 *
 * @param {Object} options
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCoverWorkflowOptions(options) {
  const errors = [];

  if (!options.positivePrompt || typeof options.positivePrompt !== 'string') {
    errors.push('positivePrompt is required and must be a string');
  }
  if (!options.checkpoint || typeof options.checkpoint !== 'string') {
    errors.push('checkpoint is required');
  }
  if (options.checkpoint === FLUX_CHECKPOINT_NAME && FLUX_CHECKPOINT_NAME === 'REPLACE_WITH_LOCAL_FLUX_CHECKPOINT') {
    errors.push('Flux checkpoint name has not been configured. Update FLUX_CHECKPOINT_NAME in coverComfyWorkflows.js');
  }
  if (!options.width || !options.height) {
    errors.push('width and height are required');
  }

  return { valid: errors.length === 0, errors };
}


// ─── Flux Workflow Builder ────────────────────────────────────────────────

/**
 * Build a Flux ComfyUI workflow.
 *
 * Flux uses:
 * - DualCLIPLoader or CLIPTextEncode (single positive, no negative in pure Flux)
 * - KSampler with euler sampler, simple scheduler
 * - Guidance scale (not CFG in the traditional sense)
 *
 * @param {Object} options
 * @param {string} options.positivePrompt
 * @param {string} [options.checkpoint]
 * @param {number} [options.width=1600]
 * @param {number} [options.height=2400]
 * @param {number} [options.steps=20]
 * @param {number} [options.guidance=3.5]
 * @param {number} [options.seed=-1] - -1 for random
 * @returns {Object} ComfyUI API workflow JSON
 */
export function buildFluxCoverWorkflow(options = {}) {
  const {
    positivePrompt = '',
    // WAVE12-FLUXNEG: this was never destructured, and node 3 was hardcoded to
    // an empty string — so on Flux, which is the DEFAULT pipeline and the
    // recommended one for six of the ten genre templates, every negative prompt
    // was silently discarded. Not just the writer's own typed negatives: also
    // the mandatory safety set, including the children's/middle-grade terms
    // (violence, gore, blood, weapons, death, horror) and the anti-book-mockup
    // terms the prompt builder adds to stop covers coming back as photographs
    // of books. The sampler was already wired to node 3 with cfg 3.5, so the
    // conditioning was live the whole time — the text just never arrived.
    negativePrompt = '',
    checkpoint = FLUX_CHECKPOINT_NAME,
    width = 1600,
    height = 2400,
    steps = 20,
    guidance = 3.5,
    seed = -1,
  } = options;

  const actualSeed = seed === -1 ? Math.floor(Math.random() * 2 ** 32) : seed;

  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: checkpoint,
      },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: positivePrompt,
        clip: ['1', 1],
      },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: negativePrompt,
        clip: ['1', 1],
      },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width,
        height,
        batch_size: 1,
      },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
        seed: actualSeed,
        steps,
        cfg: guidance,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['5', 0],
        vae: ['1', 2],
      },
    },
    '7': {
      class_type: 'SaveImage',
      inputs: {
        images: ['6', 0],
        filename_prefix: 'UBS_Cover_Flux',
      },
    },
  };
}


// ─── PonyXL Workflow Builder ──────────────────────────────────────────────

/**
 * Build a PonyXL/SDXL ComfyUI workflow.
 *
 * PonyXL uses:
 * - CheckpointLoaderSimple + CLIPTextEncode (positive + negative)
 * - KSampler with euler sampler, normal scheduler
 * - CFG 7, 25 steps
 *
 * @param {Object} options
 * @param {string} options.positivePrompt
 * @param {string} [options.negativePrompt='']
 * @param {string} [options.checkpoint]
 * @param {number} [options.width=1600]
 * @param {number} [options.height=2400]
 * @param {number} [options.steps=25]
 * @param {number} [options.cfg=7]
 * @param {number} [options.seed=-1]
 * @returns {Object} ComfyUI API workflow JSON
 */
export function buildPonyXLCoverWorkflow(options = {}) {
  const {
    positivePrompt = '',
    negativePrompt = '',
    checkpoint = PONYXL_CHECKPOINT_NAME,
    width = 1600,
    height = 2400,
    steps = 25,
    cfg = 7,
    seed = -1,
  } = options;

  const actualSeed = seed === -1 ? Math.floor(Math.random() * 2 ** 32) : seed;

  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: checkpoint,
      },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: positivePrompt,
        clip: ['1', 1],
      },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: negativePrompt,
        clip: ['1', 1],
      },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width,
        height,
        batch_size: 1,
      },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
        seed: actualSeed,
        steps,
        cfg,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['5', 0],
        vae: ['1', 2],
      },
    },
    '7': {
      class_type: 'SaveImage',
      inputs: {
        images: ['6', 0],
        filename_prefix: 'UBS_Cover_PonyXL',
      },
    },
  };
}


// ─── Router ───────────────────────────────────────────────────────────────

/**
 * Build a cover workflow for the given model pipeline.
 *
 * @param {'flux'|'ponyxl'} modelPipeline
 * @param {Object} options - Same as buildFluxCoverWorkflow / buildPonyXLCoverWorkflow
 * @returns {Object} ComfyUI API workflow JSON
 */
export function buildCoverWorkflowForModel(modelPipeline, options = {}) {
  if (modelPipeline === 'ponyxl') {
    return buildPonyXLCoverWorkflow(options);
  }
  return buildFluxCoverWorkflow(options);
}
