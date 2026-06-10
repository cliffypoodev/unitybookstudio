// IMAGE_TO_DATA_URL_PROXY_V1
// Converts remote image URLs into canvas-safe data URLs server-side.

type RequestPayload = {
  imageUrl?: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: CORS_HEADERS,
  });
}

function isAllowedRemoteImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    const allowedHosts = [
      'oaidalleapiprodscus.blob.core.windows.net',
      'oaidalleapiprod.blob.core.windows.net',
      'base44.app',
      'raw.githubusercontent.com',
      'githubusercontent.com',
    ];

    return (
      parsed.protocol === 'https:' &&
      allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
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

    const imageUrl = String(payload.imageUrl || '').trim();

    if (!imageUrl) {
      return jsonResponse({ error: 'imageUrl is required' }, 400);
    }

    if (imageUrl.startsWith('data:image/')) {
      return jsonResponse({
        url: imageUrl,
        image_url: imageUrl,
        data_url: imageUrl,
        already_data_url: true,
        canvas_safe: true,
      });
    }

    if (!isAllowedRemoteImageUrl(imageUrl)) {
      return jsonResponse({
        error: 'Remote image URL host is not allowed for proxy conversion.',
        host: (() => {
          try {
            return new URL(imageUrl).hostname;
          } catch {
            return 'invalid-url';
          }
        })(),
      }, 400);
    }

    const response = await fetch(imageUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(120000),
      headers: {
        'User-Agent': 'Base44-ImageProxy/1.0',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return jsonResponse({
        error: `Failed to fetch remote image. Status ${response.status}.`,
        details: text.slice(0, 500),
      }, 502);
    }

    const contentType = response.headers.get('content-type') || 'image/png';

    if (!contentType.startsWith('image/')) {
      return jsonResponse({
        error: `Remote URL did not return an image. Content-Type: ${contentType}`,
      }, 400);
    }

    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const dataUrl = `data:${contentType};base64,${base64}`;

    return jsonResponse({
      url: dataUrl,
      image_url: dataUrl,
      data_url: dataUrl,
      source_url: imageUrl,
      mime_type: contentType,
      canvas_safe: true,
      byte_length: buffer.byteLength,
    });
  } catch (error) {
    const err = error as Error;

    return jsonResponse({
      error: err.message || 'Unhandled image proxy error.',
    }, 500);
  }
});