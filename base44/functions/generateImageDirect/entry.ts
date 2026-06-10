// GENERATE_IMAGE_DIRECT_CANVAS_SAFE_V3
// Returns canvas-safe data URLs instead of temporary OpenAI blob URLs.

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';

type ImageModel = 'dall-e-3' | 'dall-e-2' | 'gpt-image-1';

type RequestPayload = {
  prompt?: string;
  size?: string;
  quality?: string;
  style?: string;
  model?: string;
  response_format?: string;
  n?: number;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DALL_E_3_SIZES = new Set(['1024x1024', '1024x1792', '1792x1024']);
const DALL_E_2_SIZES = new Set(['256x256', '512x512', '1024x1024']);
const GPT_IMAGE_1_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024', 'auto']);

const DALL_E_3_QUALITIES = new Set(['standard', 'hd']);
const DALL_E_3_STYLES = new Set(['vivid', 'natural']);
const GPT_IMAGE_1_QUALITIES = new Set(['low', 'medium', 'high', 'auto']);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: CORS_HEADERS,
  });
}

function cleanPrompt(input: unknown): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/\s{3,}/g, ' ')
    .trim();
}

function resolveModel(modelFromRequest?: string): ImageModel {
  const envModel = Deno.env.get('OPENAI_IMAGE_MODEL') || '';
  const raw = (modelFromRequest || envModel || 'dall-e-3').trim();

  if (raw === 'gpt-image-1') return 'gpt-image-1';
  if (raw === 'dall-e-2') return 'dall-e-2';

  return 'dall-e-3';
}

function normalizeSize(model: ImageModel, requestedSize?: string): string {
  const size = typeof requestedSize === 'string' ? requestedSize.trim() : '';

  if (model === 'gpt-image-1') {
    if (GPT_IMAGE_1_SIZES.has(size)) return size;
    if (size === '1024x1792') return '1024x1536';
    if (size === '1792x1024') return '1536x1024';
    return '1024x1536';
  }

  if (model === 'dall-e-2') {
    return DALL_E_2_SIZES.has(size) ? size : '1024x1024';
  }

  return DALL_E_3_SIZES.has(size) ? size : '1024x1792';
}

function normalizeQuality(model: ImageModel, requestedQuality?: string): string {
  const quality = typeof requestedQuality === 'string' ? requestedQuality.trim().toLowerCase() : '';

  if (model === 'gpt-image-1') {
    if (GPT_IMAGE_1_QUALITIES.has(quality)) return quality;
    if (quality === 'hd') return 'high';
    if (quality === 'standard') return 'medium';
    return 'high';
  }

  if (model === 'dall-e-2') {
    return 'standard';
  }

  return DALL_E_3_QUALITIES.has(quality) ? quality : 'hd';
}

function normalizeStyle(model: ImageModel, requestedStyle?: string): string | null {
  if (model !== 'dall-e-3') return null;

  const style = typeof requestedStyle === 'string' ? requestedStyle.trim().toLowerCase() : '';
  return DALL_E_3_STYLES.has(style) ? style : 'vivid';
}

function getPromptLimit(model: ImageModel): number {
  if (model === 'dall-e-2') return 950;
  if (model === 'dall-e-3') return 3900;
  return 30000;
}

function trimToLimit(text: string, maxLength: number): string {
  const cleaned = cleanPrompt(text);

  if (cleaned.length <= maxLength) return cleaned;

  const headLength = Math.floor(maxLength * 0.62);
  const tailLength = Math.floor(maxLength * 0.32);

  const head = cleaned.slice(0, headLength).trim();
  const tail = cleaned.slice(cleaned.length - tailLength).trim();

  return `${head}

[Prompt compressed to fit the image model limit. Preserve the core visual concept, style, composition, and restrictions.]

${tail}`.slice(0, maxLength);
}

function buildFinalPrompt(prompt: string, model: ImageModel): string {
  const cleaned = cleanPrompt(prompt);

  const hardFrame = [
    'Generate only the requested image.',
    'Follow the user prompt exactly.',
    'Do not add extra text, labels, logos, borders, watermarks, mockups, or unrelated design elements.',
  ].join(' ');

  return trimToLimit(`${hardFrame}\n\n${cleaned}`, getPromptLimit(model));
}

function extractErrorMessage(status: number, errorText: string): string {
  try {
    const parsed = JSON.parse(errorText);
    const message = parsed?.error?.message || parsed?.message || errorText;
    const param = parsed?.error?.param ? ` Param: ${parsed.error.param}.` : '';
    const code = parsed?.error?.code ? ` Code: ${parsed.error.code}.` : '';

    return `OpenAI Image API error ${status}: ${message}.${param}${code}`;
  } catch {
    return `OpenAI Image API error ${status}: ${errorText}`;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function dataUrlFromBase64(base64: string, mimeType = 'image/png'): string {
  return `data:${mimeType};base64,${base64}`;
}

async function fetchRemoteImageAsDataUrl(url: string): Promise<{
  dataUrl: string;
  base64: string;
  mimeType: string;
}> {
  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Could not fetch generated image URL server-side. Status ${response.status}. ${text}`);
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  return {
    dataUrl: dataUrlFromBase64(base64, contentType),
    base64,
    mimeType: contentType,
  };
}

async function callOpenAIImage(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  return fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
}

function buildRequestBody(
  payload: RequestPayload,
  model: ImageModel,
  prompt: string
): Record<string, unknown> {
  const size = normalizeSize(model, payload.size);
  const quality = normalizeQuality(model, payload.quality);
  const style = normalizeStyle(model, payload.style);

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size,
  };

  if (model === 'dall-e-3') {
    body.quality = quality;
    body.style = style || 'vivid';

    // Force canvas-safe return path.
    body.response_format = 'b64_json';
  }

  if (model === 'dall-e-2') {
    body.response_format = 'b64_json';
  }

  if (model === 'gpt-image-1') {
    body.quality = quality;
  }

  return body;
}

async function normalizeOpenAIImageResponse(
  data: Record<string, unknown>,
  model: ImageModel,
  requestBody: Record<string, unknown>
) {
  const firstImage = Array.isArray(data?.data)
    ? data.data[0] as Record<string, unknown>
    : null;

  const directUrl = typeof firstImage?.url === 'string' ? firstImage.url : '';
  const base64Image = typeof firstImage?.b64_json === 'string' ? firstImage.b64_json : '';

  if (base64Image.trim()) {
    const dataUrl = dataUrlFromBase64(base64Image, 'image/png');

    return {
      url: dataUrl,
      image_url: dataUrl,
      b64_json: base64Image,
      model,
      size: requestBody.size,
      quality: requestBody.quality || null,
      style: requestBody.style || null,
      response_kind: 'b64_json',
      canvas_safe: true,
      revised_prompt: firstImage?.revised_prompt || null,
    };
  }

  if (directUrl.trim()) {
    const fetched = await fetchRemoteImageAsDataUrl(directUrl);

    return {
      url: fetched.dataUrl,
      image_url: fetched.dataUrl,
      source_url: directUrl,
      b64_json: fetched.base64,
      mime_type: fetched.mimeType,
      model,
      size: requestBody.size,
      quality: requestBody.quality || null,
      style: requestBody.style || null,
      response_kind: 'url_converted_to_data_url',
      canvas_safe: true,
      revised_prompt: firstImage?.revised_prompt || null,
    };
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405);
  }

  try {
    let payload: RequestPayload;

    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
    }

    const rawPrompt = cleanPrompt(payload.prompt);

    if (!rawPrompt) {
      return jsonResponse({ error: 'prompt is required' }, 400);
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');

    if (!apiKey) {
      return jsonResponse({ error: 'OPENAI_API_KEY not set' }, 500);
    }

    const requestedModel = resolveModel(payload.model);
    const finalPrompt = buildFinalPrompt(rawPrompt, requestedModel);
    const requestBody = buildRequestBody(payload, requestedModel, finalPrompt);

    let response: Response;

    try {
      response = await callOpenAIImage(requestBody, apiKey);
    } catch (fetchErr) {
      const err = fetchErr as Error;

      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return jsonResponse({ error: 'Image generation timed out after 180 seconds.' }, 504);
      }

      return jsonResponse({ error: `Image generation network failure: ${err.message}` }, 502);
    }

    if (!response.ok) {
      const errorText = await response.text();
      const firstError = extractErrorMessage(response.status, errorText);

      const shouldRetryDallE3Square =
        requestedModel === 'dall-e-3' &&
        response.status === 400 &&
        String(requestBody.size) === '1024x1792';

      if (shouldRetryDallE3Square) {
        const retryBody = {
          ...requestBody,
          size: '1024x1024',
        };

        try {
          const retryResponse = await callOpenAIImage(retryBody, apiKey);

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            const normalizedRetry = await normalizeOpenAIImageResponse(
              retryData,
              requestedModel,
              retryBody
            );

            if (normalizedRetry) {
              return jsonResponse({
                ...normalizedRetry,
                warning: 'Portrait generation returned 400, so the function retried with 1024x1024.',
                prompt_length: finalPrompt.length,
              });
            }
          }

          const retryErrorText = await retryResponse.text();

          return jsonResponse({
            error: `${firstError} Retry also failed: ${extractErrorMessage(retryResponse.status, retryErrorText)}`,
            model: requestedModel,
            size: requestBody.size,
            prompt_length: finalPrompt.length,
          }, retryResponse.status);
        } catch (retryErr) {
          const err = retryErr as Error;

          return jsonResponse({
            error: `${firstError} Retry failed before completion: ${err.message}`,
            model: requestedModel,
            size: requestBody.size,
            prompt_length: finalPrompt.length,
          }, 502);
        }
      }

      return jsonResponse({
        error: firstError,
        model: requestedModel,
        size: requestBody.size,
        prompt_length: finalPrompt.length,
      }, response.status);
    }

    const data = await response.json();
    const normalized = await normalizeOpenAIImageResponse(data, requestedModel, requestBody);

    if (!normalized) {
      return jsonResponse({
        error: 'No usable image URL or base64 image returned by OpenAI.',
        model: requestedModel,
        size: requestBody.size,
        prompt_length: finalPrompt.length,
        raw_response_keys: Object.keys(data || {}),
      }, 500);
    }

    return jsonResponse({
      ...normalized,
      prompt_length: finalPrompt.length,
    });
  } catch (error) {
    const err = error as Error;

    return jsonResponse({
      error: err.message || 'Unhandled image generation error.',
    }, 500);
  }
});