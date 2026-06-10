/**
 * comfyuiClient.js — Unified ComfyUI API client for UBS cover generation
 *
 * Provides a clean interface to the local ComfyUI instance for
 * queueing workflows, polling jobs, and fetching generated images.
 *
 * @module comfyuiClient
 */

// ─── Configuration ────────────────────────────────────────────────────────

export const COMFYUI_DEFAULT_BASE_URL = 'http://127.0.0.1:8000';

// Vite dev-server proxy path (avoids CORS in browser)
const COMFYUI_PROXY_PATH = '/comfyui-api';

const STORAGE_KEY = 'ubs_comfyui_base_url';

/**
 * Get the display/config URL shown in the UI text field.
 * This is the actual ComfyUI address (e.g. http://127.0.0.1:8000).
 * @returns {string}
 */
export function getComfyUIDisplayUrl() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && stored.startsWith('http')) return stored.replace(/\/+$/, '');
    }
  } catch {
    // Ignore storage errors
  }
  return COMFYUI_DEFAULT_BASE_URL;
}

/**
 * Get the ComfyUI base URL for making API calls.
 * In browser context, returns the Vite proxy path to avoid CORS.
 * In Node.js (tests/CLI), returns the direct URL.
 * @returns {string}
 */
export function getComfyUIBaseUrl() {
  // In browser with Vite dev server, use the proxy path to avoid CORS
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return COMFYUI_PROXY_PATH;
  }
  // Node.js / test environment — use the direct URL
  return getComfyUIDisplayUrl();
}

/**
 * Set the ComfyUI base URL.
 * @param {string} url
 */
export function setComfyUIBaseUrl(url) {
  try {
    const normalized = String(url || COMFYUI_DEFAULT_BASE_URL).replace(/\/+$/, '');
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    }
  } catch {
    // Ignore storage errors
  }
}


// ─── Status / Health Check ────────────────────────────────────────────────

/**
 * Check if ComfyUI is running and responsive.
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=5000]
 * @returns {Promise<{ healthy: boolean, error?: string, vram?: number, gpuName?: string, queueSize?: number }>}
 */
export async function checkComfyUIStatus(options = {}) {
  const baseUrl = getComfyUIBaseUrl();
  const timeout = options.timeoutMs || 5000;

  try {
    // Try /system_stats first (standard ComfyUI)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${baseUrl}/system_stats`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return { healthy: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const device = data?.devices?.[0];

    return {
      healthy: true,
      vram: device?.vram_total,
      gpuName: device?.name,
      queueSize: data?.exec_info?.queue_remaining ?? null,
    };
  } catch (err) {
    // Try /queue as fallback
    try {
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), timeout);

      const queueResp = await fetch(`${baseUrl}/queue`, {
        signal: controller2.signal,
      });
      clearTimeout(timer2);

      if (queueResp.ok) {
        const queueData = await queueResp.json();
        return {
          healthy: true,
          queueSize: (queueData?.queue_running?.length || 0) + (queueData?.queue_pending?.length || 0),
        };
      }
    } catch {
      // Both failed
    }

    return {
      healthy: false,
      error: normalizeComfyUIError(err),
    };
  }
}


// ─── Workflow Queueing ────────────────────────────────────────────────────

/**
 * Queue a workflow on ComfyUI.
 *
 * @param {Object} workflowJson - ComfyUI API-format workflow (node graph)
 * @param {Object} [options]
 * @param {string} [options.clientId] - Optional client ID for WebSocket tracking
 * @returns {Promise<{ promptId: string }>}
 */
export async function queueComfyWorkflow(workflowJson, options = {}) {
  const baseUrl = getComfyUIBaseUrl();

  const body = {
    prompt: workflowJson,
  };
  if (options.clientId) {
    body.client_id = options.clientId;
  }

  const response = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`ComfyUI queue failed (HTTP ${response.status}): ${errText.substring(0, 300)}`);
  }

  const data = await response.json();
  const promptId = data?.prompt_id;

  if (!promptId) {
    throw new Error('ComfyUI returned no prompt_id');
  }

  return { promptId };
}


// ─── Job Polling ──────────────────────────────────────────────────────────

/**
 * Poll ComfyUI for job completion.
 *
 * @param {string} promptId
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=300000] - Max wait (default 5 min)
 * @param {number} [options.pollIntervalMs=2000] - Poll interval
 * @param {Function} [options.onProgress] - Progress callback: (status) => void
 * @returns {Promise<{ images: Array<{ filename: string, subfolder: string, type: string }>, status: string }>}
 */
export async function pollComfyJob(promptId, options = {}) {
  const baseUrl = getComfyUIBaseUrl();
  const timeoutMs = options.timeoutMs || 300000;
  const pollInterval = options.pollIntervalMs || 2000;
  const onProgress = options.onProgress || (() => {});

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    await new Promise(r => setTimeout(r, pollInterval));

    try {
      const response = await fetch(`${baseUrl}/history/${promptId}`);
      if (!response.ok) {
        onProgress({ status: 'polling', elapsed: Date.now() - startTime });
        continue;
      }

      const history = await response.json();
      const entry = history[promptId];

      if (!entry) {
        onProgress({ status: 'queued', elapsed: Date.now() - startTime });
        continue;
      }

      // Check for errors
      if (entry.status?.status_str === 'error') {
        const errMsg = entry.status?.messages
          ?.map(m => m[1]?.message || m[1] || '')
          .join('; ') || 'Unknown ComfyUI error';
        throw new Error(`ComfyUI generation failed: ${errMsg}`);
      }

      // Check for outputs
      if (entry.outputs) {
        const images = [];
        for (const nodeOutput of Object.values(entry.outputs)) {
          if (nodeOutput.images && nodeOutput.images.length > 0) {
            for (const img of nodeOutput.images) {
              images.push({
                filename: img.filename,
                subfolder: img.subfolder || '',
                type: img.type || 'output',
              });
            }
          }
        }

        if (images.length > 0) {
          onProgress({ status: 'complete', elapsed: Date.now() - startTime, imageCount: images.length });
          return { images, status: 'complete' };
        }
      }

      onProgress({ status: 'processing', elapsed: Date.now() - startTime });
    } catch (pollErr) {
      if (pollErr.message.includes('ComfyUI generation failed')) throw pollErr;
      // Network errors during polling — keep trying
      onProgress({ status: 'retry', elapsed: Date.now() - startTime, error: pollErr.message });
    }
  }

  throw new Error(`ComfyUI generation timed out after ${timeoutMs / 1000}s`);
}


// ─── Image Fetching ───────────────────────────────────────────────────────

/**
 * Fetch a generated image from ComfyUI as a data URL.
 *
 * @param {string} filename
 * @param {string} [subfolder='']
 * @param {string} [type='output']
 * @param {Object} [options]
 * @returns {Promise<string>} Data URL
 */
export async function fetchComfyImage(filename, subfolder = '', type = 'output', options = {}) {
  const baseUrl = getComfyUIBaseUrl();
  const url = `${baseUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: HTTP ${response.status}`);
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}


// ─── Full Generation Pipeline ─────────────────────────────────────────────

/**
 * Generate a cover image using ComfyUI: build workflow → queue → poll → fetch.
 *
 * @param {Object} payload
 * @param {Object} payload.workflow - ComfyUI API workflow JSON
 * @param {Object} [payload.options]
 * @param {number} [payload.options.timeoutMs]
 * @param {Function} [payload.options.onProgress]
 * @returns {Promise<{ dataUrl: string, filename: string, metadata: Object }>}
 */
export async function generateCoverWithComfyUI(payload) {
  const { workflow, options = {} } = payload;
  const onProgress = options.onProgress || (() => {});

  onProgress({ status: 'queueing' });

  // Queue the workflow
  const { promptId } = await queueComfyWorkflow(workflow);
  onProgress({ status: 'queued', promptId });

  // Poll for completion
  const result = await pollComfyJob(promptId, {
    timeoutMs: options.timeoutMs,
    onProgress,
  });

  if (!result.images || result.images.length === 0) {
    throw new Error('ComfyUI returned no images');
  }

  // Fetch the first image
  const img = result.images[0];
  onProgress({ status: 'fetching', filename: img.filename });

  const dataUrl = await fetchComfyImage(img.filename, img.subfolder, img.type);

  return {
    dataUrl,
    filename: img.filename,
    metadata: {
      promptId,
      imageCount: result.images.length,
      allImages: result.images,
    },
  };
}


// ─── Error Normalization ──────────────────────────────────────────────────

/**
 * Normalize a ComfyUI error into a user-friendly message.
 * @param {Error|string} error
 * @returns {string}
 */
export function normalizeComfyUIError(error) {
  const msg = typeof error === 'string' ? error : error?.message || 'Unknown error';

  if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
    return 'Cannot connect to ComfyUI. Make sure ComfyUI is running and the URL is correct.';
  }
  if (msg.includes('abort') || msg.includes('AbortError')) {
    return 'Connection to ComfyUI timed out. Check that ComfyUI is responsive.';
  }
  if (msg.includes('timed out')) {
    return 'Image generation timed out. The model may be loading or the GPU may be busy.';
  }
  if (msg.includes('prompt_id')) {
    return 'ComfyUI did not return a valid job ID. Check the workflow JSON.';
  }
  if (msg.includes('generation failed')) {
    return msg; // Already descriptive
  }
  if (msg.includes('HTTP 4')) {
    return `ComfyUI rejected the request: ${msg}`;
  }
  if (msg.includes('HTTP 5')) {
    return `ComfyUI server error: ${msg}`;
  }

  return `ComfyUI error: ${msg}`;
}
