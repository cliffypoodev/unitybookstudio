// src/lib/localImageGen.js
// ComfyUI API integration for local image generation.
// Replaces DALL-E / OpenAI image generation with local Stable Diffusion.

const COMFYUI_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Build a ComfyUI workflow JSON for cover art generation.
 * Uses txt2img with the PonyRealism checkpoint (no input image required).
 *
 * @param {string} positivePrompt — The cover art description
 * @param {string} negativePrompt — What to avoid
 * @param {string} checkpoint — Model filename (default: cyberrealisticPony_v180Coreshift.safetensors)
 * @param {number} width — Image width (default: 768 for portrait cover)
 * @param {number} height — Image height (default: 1152 for portrait cover)
 * @param {number} steps — Sampling steps (default: 25)
 * @param {number} cfg — CFG scale (default: 7)
 * @returns {Object} — ComfyUI API-format workflow
 */
function buildCoverWorkflow({
  positivePrompt,
  negativePrompt = 'text, watermark, words, letters, title, author name, blurry, low quality, deformed',
  checkpoint = 'cyberrealisticPony_v180Coreshift.safetensors',
  width = 768,
  height = 1152,
  steps = 25,
  cfg = 7,
  seed = Math.floor(Math.random() * 2 ** 52),
}) {
  return {
    // Node 1: Load Checkpoint
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: checkpoint },
    },
    // Node 2: Positive CLIP Encode
    "2": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: positivePrompt,
        clip: ["1", 1],
      },
    },
    // Node 3: Negative CLIP Encode
    "3": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: negativePrompt,
        clip: ["1", 1],
      },
    },
    // Node 4: Empty Latent Image (portrait format for book covers)
    "4": {
      class_type: "EmptyLatentImage",
      inputs: {
        width,
        height,
        batch_size: 1,
      },
    },
    // Node 5: KSampler
    "5": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
        seed,
        steps,
        cfg,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
      },
    },
    // Node 6: VAE Decode
    "6": {
      class_type: "VAEDecode",
      inputs: {
        samples: ["5", 0],
        vae: ["1", 2],
      },
    },
    // Node 7: Save Image
    "7": {
      class_type: "SaveImage",
      inputs: {
        images: ["6", 0],
        filename_prefix: "UBS_Cover",
      },
    },
  };
}

/**
 * Submit a workflow to ComfyUI and wait for the result.
 *
 * @param {Object} workflow — ComfyUI API-format workflow
 * @param {number} timeoutMs — Max wait time (default: 5 minutes)
 * @returns {Promise<string>} — Data URL of the generated image
 */
async function submitAndWait(workflow, timeoutMs = 300000) {
  // Submit the prompt
  const submitResponse = await fetch(`${COMFYUI_BASE_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!submitResponse.ok) {
    const errText = await submitResponse.text().catch(() => '');
    throw new Error(`ComfyUI submit failed (HTTP ${submitResponse.status}): ${errText.substring(0, 200)}`);
  }

  const { prompt_id } = await submitResponse.json();
  if (!prompt_id) throw new Error('ComfyUI returned no prompt_id');

  console.log(`[COMFYUI] Submitted prompt: ${prompt_id}`);

  // Poll for completion
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < timeoutMs) {
    await new Promise(r => setTimeout(r, pollInterval));

    try {
      const historyResponse = await fetch(`${COMFYUI_BASE_URL}/history/${prompt_id}`);
      if (!historyResponse.ok) continue;

      const history = await historyResponse.json();
      const entry = history[prompt_id];

      if (!entry) continue;

      // Check for errors
      if (entry.status?.status_str === 'error') {
        const errMsg = entry.status?.messages?.map(m => m[1]?.message || m[1] || '').join('; ') || 'Unknown ComfyUI error';
        throw new Error(`ComfyUI generation failed: ${errMsg}`);
      }

      // Check for outputs
      if (entry.outputs) {
        // Find the SaveImage node output
        for (const nodeOutput of Object.values(entry.outputs)) {
          if (nodeOutput.images && nodeOutput.images.length > 0) {
            const img = nodeOutput.images[0];
            const imageUrl = `${COMFYUI_BASE_URL}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${encodeURIComponent(img.type || 'output')}`;

            console.log(`[COMFYUI] Image ready: ${img.filename}`);

            // Fetch and convert to data URL for the app
            const imgResponse = await fetch(imageUrl);
            const blob = await imgResponse.blob();

            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(new Error('Failed to read image blob'));
              reader.readAsDataURL(blob);
            });
          }
        }
      }
    } catch (pollErr) {
      if (pollErr.message.includes('ComfyUI generation failed')) throw pollErr;
      // Network errors during polling — keep trying
      console.warn(`[COMFYUI] Poll error (will retry): ${pollErr.message}`);
    }
  }

  throw new Error(`ComfyUI generation timed out after ${timeoutMs / 1000}s`);
}

/**
 * Generate a cover art image using the local ComfyUI instance.
 *
 * @param {Object} options
 * @param {string} options.prompt — The cover art description/prompt
 * @param {string} [options.size='768x1152'] — Image dimensions (WxH)
 * @param {string} [options.quality] — Unused (ComfyUI uses steps/cfg instead)
 * @param {string} [options.negativePrompt] — What to avoid
 * @param {string} [options.checkpoint] — Model filename override
 * @returns {Promise<{url: string, image_url: string}>} — Data URL of generated image
 */
export async function generateImageLocal({
  prompt,
  size = '768x1152',
  quality,
  negativePrompt,
  checkpoint,
}) {
  // Parse size
  const [w, h] = (size || '768x1152').split('x').map(Number);
  const width = w || 768;
  const height = h || 1152;

  console.log(`[COMFYUI] Generating cover: ${width}x${height}, prompt: ${prompt?.substring(0, 80)}...`);

  const workflow = buildCoverWorkflow({
    positivePrompt: prompt,
    negativePrompt,
    checkpoint,
    width,
    height,
  });

  const dataUrl = await submitAndWait(workflow);

  return {
    url: dataUrl,
    image_url: dataUrl,
    data_url: dataUrl,
  };
}

/**
 * Check if ComfyUI is running and responsive.
 */
export async function checkComfyUIHealth() {
  try {
    const response = await fetch(`${COMFYUI_BASE_URL}/system_stats`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return { healthy: false, error: `HTTP ${response.status}` };

    const data = await response.json();
    return {
      healthy: true,
      vram: data?.devices?.[0]?.vram_total,
      models: data?.devices?.[0]?.name,
    };
  } catch (err) {
    return { healthy: false, error: err?.message || 'Cannot reach ComfyUI' };
  }
}

/**
 * Build the cover workflow from Cliff's PonyNSFW template.
 * This version uses the full SUPIR upscaler pipeline.
 */
export function buildFullPonyWorkflow({
  positivePrompt,
  negativePrompt = 'text, watermark',
  inputImageFilename = null,
}) {
  // If no input image, use the simplified workflow
  if (!inputImageFilename) {
    return buildCoverWorkflow({ positivePrompt, negativePrompt });
  }

  // Full PonyNSFW workflow with SUPIR upscaler (requires input image)
  return {
    "10": {
      class_type: "LoadImage",
      inputs: { image: inputImageFilename, upload: "image" },
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: "cyberrealisticPony_v180Coreshift.safetensors" },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: positivePrompt, clip: ["4", 1] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: negativePrompt, clip: ["4", 1] },
    },
    "11": {
      class_type: "VAEEncode",
      inputs: { pixels: ["10", 0], vae: ["4", 2] },
    },
    "3": {
      class_type: "KSampler",
      inputs: {
        model: ["4", 0], positive: ["6", 0], negative: ["7", 0],
        latent_image: ["11", 0],
        seed: Math.floor(Math.random() * 2 ** 52),
        steps: 20, cfg: 8, sampler_name: "euler", scheduler: "normal", denoise: 1,
      },
    },
    "12": {
      class_type: "SUPIR_model_loader_v2_clip",
      inputs: {
        model: ["4", 0], clip_l: ["4", 1], clip_g: ["4", 1], vae: ["4", 2],
        supir_model: "SUPIR-v0F_fp16.safetensors", fp8_unet: false, diffusion_dtype: "auto",
      },
    },
    "18": {
      class_type: "SUPIR_conditioner",
      inputs: {
        SUPIR_model: ["12", 0], latents: ["3", 0],
        positive_prompt: "high quality, detailed", negative_prompt: "bad quality, blurry, messy",
      },
    },
    "13": {
      class_type: "SUPIR_sample",
      inputs: {
        SUPIR_model: ["12", 0], latents: ["3", 0],
        positive: ["18", 0], negative: ["18", 1],
        seed: Math.floor(Math.random() * 2 ** 52),
        steps: 20, cfg_scale_start: 4, cfg_scale_end: 4,
        EDM_s_churn: 5, s_noise: 1.003, DPMPP_eta: 1,
        control_scale_start: 1, control_scale_end: 1, restore_cfg: -1,
        keep_model_loaded: false, sampler: "RestoreEDMSampler",
        sampler_tile_size: 1024, sampler_tile_stride: 512,
      },
    },
    "20": {
      class_type: "VAEDecode",
      inputs: { samples: ["13", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { images: ["20", 0], filename_prefix: "UBS_Cover" },
    },
  };
}
