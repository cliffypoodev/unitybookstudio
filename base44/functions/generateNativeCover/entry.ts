// GENERATE_NATIVE_COVER_RIVERFLOW_V1
// Native finished-cover generation using OpenRouter + Sourceful Riverflow V2 Pro.
// No browser canvas typography. The image model renders the final commercial cover.

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_IMAGE_MODEL = 'sourceful/riverflow-v2-pro';

type RequestPayload = {
  title?: string;
  subtitle?: string;
  authorName?: string;
  seriesText?: string;
  genre?: string;
  directionLabel?: string;
  directionBrief?: string;
  masterBrief?: string;
  artStyle?: string;
  colorMood?: string;
  size?: string;
  quality?: string;
  model?: string;
};

type AnyRecord = Record<string, unknown>;

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

function clean(input: unknown, limit = 5000): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n')
    .replace(/\s{3,}/g, ' ')
    .trim()
    .slice(0, limit);
}

function resolveModel(raw?: string) {
  const envModel =
    Deno.env.get('OPENROUTER_COVER_IMAGE_MODEL') ||
    Deno.env.get('COVER_IMAGE_MODEL') ||
    Deno.env.get('IMAGE_MODEL') ||
    '';

  const requested = clean(raw || envModel || DEFAULT_IMAGE_MODEL, 120);

  // Keep this function permissive so you can test other OpenRouter image models later.
  return requested || DEFAULT_IMAGE_MODEL;
}

function normalizeAspectRatio(size?: string) {
  const requested = clean(size, 40).toLowerCase();

  if (requested === '1024x1024') return '1:1';
  if (requested === '1536x1024') return '3:2';
  if (requested === '1024x1536') return '2:3';
  if (requested === '832x1248') return '2:3';
  if (requested === '864x1184') return '3:4';
  if (requested === '896x1152') return '4:5';
  if (requested === '768x1344') return '9:16';
  if (requested === '1344x768') return '16:9';

  // Book covers should default to standard ebook/front-cover shape.
  return '2:3';
}

function normalizeQuality(quality?: string) {
  const requested = clean(quality, 40).toLowerCase();

  if (requested === 'low') return 'low';
  if (requested === 'medium') return 'medium';
  if (requested === 'auto') return 'auto';

  return 'high';
}

function buildPrompt(payload: RequestPayload) {
  const title = clean(payload.title, 140);
  const subtitle = clean(payload.subtitle, 220);
  const authorName = clean(payload.authorName, 140);
  const seriesText = clean(payload.seriesText, 160);
  const genre = clean(payload.genre, 220);
  const directionLabel = clean(payload.directionLabel, 120);
  const directionBrief = clean(payload.directionBrief, 1400);
  const masterBrief = clean(payload.masterBrief, 1800);
  const artStyle = clean(payload.artStyle, 120);
  const colorMood = clean(payload.colorMood, 120);

  if (!title) {
    throw new Error('title is required');
  }

  if (!authorName) {
    throw new Error('authorName is required');
  }

  const exactTextRules = [
    `The main title text must read exactly: "${title}"`,
    subtitle ? `The subtitle text must read exactly: "${subtitle}"` : 'Do not include a subtitle.',
    authorName ? `The author name must read exactly: "${authorName}"` : 'Do not include an author name.',
    seriesText ? `The series/top-line text must read exactly: "${seriesText}"` : 'Do not include a series line.',
    'Do not add any other readable words anywhere in the image.',
    'No fake signage, no fake labels, no fake logos, no fake blurbs, no fake taglines, no invented publisher marks.',
  ].join('\n');

  return [
    'Create a finished, professional, commercially publishable FRONT BOOK COVER as a flat 2:3 vertical cover image.',
    'This is not a mockup. Do not show a 3D book, paperback, hardcover, spine, pages, shelf, frame, or product display.',
    'The cover must look like a real retail book cover designed by a professional art director.',
    'The final image must include the title and author name as rendered cover typography.',
    '',
    'EXACT COVER TEXT RULES:',
    exactTextRules,
    '',
    'TYPOGRAPHY QUALITY RULES:',
    'The title typography must be professional, genre-appropriate, carefully integrated, and highly readable at thumbnail size.',
    'Avoid Microsoft WordArt, cheap drop shadows, generic Impact-style internet-meme typography, amateur flyer layout, and cluttered title placement.',
    'Use strong hierarchy: title first, author second, subtitle/series only if provided.',
    'The text should feel designed into the cover, not pasted on top.',
    'Letterforms must be sharp, intentional, and correctly spelled.',
    '',
    'VISUAL DIRECTION:',
    `Genre/subgenre: ${genre || 'commercial fiction'}`,
    `Cover direction: ${directionLabel || 'premium commercial cover'}`,
    `Specific direction brief: ${directionBrief || 'Create a strong, specific, marketable cover concept.'}`,
    `Book DNA/master brief: ${masterBrief || 'Use a strong visual hook, cinematic mood, and professional retail-cover polish.'}`,
    `Preferred visual style: ${artStyle || 'cinematic photorealistic / illustrated realism'}`,
    `Preferred color mood: ${colorMood || 'commercial, dramatic, controlled palette'}`,
    '',
    'ART DIRECTION RULES:',
    'Use one clear, specific, memorable visual concept. Do not make generic AI wallpaper.',
    'Avoid generic skyline, generic palm-tree sunset, generic neon street, generic gym, generic motel, generic poster, or bland background filler.',
    'Avoid fake readable environmental text. If signs or labels appear, they must be abstract/unreadable shapes, not words.',
    'The cover should have atmosphere, depth, tension, and a marketable hook.',
    'Make it polished enough for Amazon/KDP retail presentation.',
  ].join('\n');
}

async function callOpenRouter(body: Record<string, unknown>, apiKey: string) {
  return fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://base44.app',
      'X-Title': 'Unity Book Studio Cover Generator',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300000),
  });
}

function parseError(status: number, text: string) {
  try {
    const parsed = JSON.parse(text);
    const message = parsed?.error?.message || parsed?.message || text;
    const code = parsed?.error?.code ? ` Code: ${parsed.error.code}.` : '';
    const param = parsed?.error?.param ? ` Param: ${parsed.error.param}.` : '';
    return `OpenRouter Image API error ${status}: ${message}.${code}${param}`;
  } catch {
    return `OpenRouter Image API error ${status}: ${text}`;
  }
}

function getNestedString(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== 'object') return '';
    current = (current as AnyRecord)[key];
  }

  return typeof current === 'string' ? current : '';
}

function normalizeImageUrl(raw: string) {
  const value = clean(raw, 20_000_000);

  if (!value) return '';

  if (value.startsWith('data:image/')) return value;

  // Some providers return raw base64 without the data URL prefix.
  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.length > 2000) {
    return `data:image/png;base64,${value.replace(/\s+/g, '')}`;
  }

  if (/^https?:\/\//i.test(value)) return value;

  return '';
}

function extractImageUrl(data: AnyRecord) {
  const choices = Array.isArray(data?.choices) ? data.choices as AnyRecord[] : [];

  for (const choice of choices) {
    const message = choice?.message as AnyRecord | undefined;
    if (!message) continue;

    const images = Array.isArray(message.images) ? message.images as AnyRecord[] : [];
    for (const image of images) {
      const candidates = [
        getNestedString(image, ['imageUrl', 'url']),
        getNestedString(image, ['image_url', 'url']),
        getNestedString(image, ['imageUrl']),
        getNestedString(image, ['image_url']),
        getNestedString(image, ['url']),
        getNestedString(image, ['b64_json']),
      ];

      for (const candidate of candidates) {
        const normalized = normalizeImageUrl(candidate);
        if (normalized) return normalized;
      }
    }

    const content = message.content;

    if (Array.isArray(content)) {
      for (const item of content as AnyRecord[]) {
        const candidates = [
          getNestedString(item, ['image_url', 'url']),
          getNestedString(item, ['imageUrl', 'url']),
          getNestedString(item, ['url']),
          getNestedString(item, ['b64_json']),
        ];

        for (const candidate of candidates) {
          const normalized = normalizeImageUrl(candidate);
          if (normalized) return normalized;
        }
      }
    }

    if (typeof content === 'string') {
      const dataUrlMatch = content.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/);
      if (dataUrlMatch?.[0]) return normalizeImageUrl(dataUrlMatch[0]);

      const urlMatch = content.match(/https?:\/\/\S+/);
      if (urlMatch?.[0]) return normalizeImageUrl(urlMatch[0].replace(/[),.;]+$/, ''));
    }
  }

  // Defensive support for providers that return a direct data array.
  const directData = Array.isArray(data?.data) ? data.data as AnyRecord[] : [];
  for (const item of directData) {
    const candidates = [
      getNestedString(item, ['url']),
      getNestedString(item, ['image_url']),
      getNestedString(item, ['b64_json']),
      getNestedString(item, ['result']),
    ];

    for (const candidate of candidates) {
      const normalized = normalizeImageUrl(candidate);
      if (normalized) return normalized;
    }
  }

  return '';
}

function buildOpenRouterBody({
  model,
  prompt,
  aspectRatio,
  quality,
}: {
  model: string;
  prompt: string;
  aspectRatio: string;
  quality: string;
}) {
  const imageConfig: Record<string, unknown> = {
    aspect_ratio: aspectRatio,
  };

  // Sourceful supports higher resolution tiers through image_config on OpenRouter.
  // Keep this conservative unless user explicitly requests 4K later.
  if (quality === 'high') {
    imageConfig.size = '2K';
  }

  return {
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    modalities: ['image'],
    stream: false,
    image_config: imageConfig,
  };
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

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!apiKey) {
      return jsonResponse({ error: 'OPENROUTER_API_KEY not set' }, 500);
    }

    const model = resolveModel(payload.model);
    const aspectRatio = normalizeAspectRatio(payload.size);
    const quality = normalizeQuality(payload.quality);
    const prompt = buildPrompt(payload);
    const body = buildOpenRouterBody({ model, prompt, aspectRatio, quality });

    const response = await callOpenRouter(body, apiKey);

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse(
        {
          error: parseError(response.status, errorText),
          attempted_model: model,
          hint: 'Verify OPENROUTER_API_KEY has credits/access and that the model sourceful/riverflow-v2-pro is available in your OpenRouter account.',
        },
        502
      );
    }

    const data = await response.json() as AnyRecord;
    const imageUrl = extractImageUrl(data);

    if (!imageUrl) {
      return jsonResponse(
        {
          error: 'OpenRouter returned no usable image URL or base64 image data.',
          attempted_model: model,
          response_shape: Object.keys(data || {}),
        },
        502
      );
    }

    const isDataUrl = imageUrl.startsWith('data:image/');
    const b64 = isDataUrl ? imageUrl.replace(/^data:image\/[^;]+;base64,/i, '') : '';

    return jsonResponse({
      url: imageUrl,
      image_url: imageUrl,
      data_url: isDataUrl ? imageUrl : null,
      b64_json: b64 || null,
      canvas_safe: isDataUrl,
      native_cover: true,
      provider: 'openrouter',
      model,
      aspect_ratio: aspectRatio,
      quality,
      prompt_length: prompt.length,
      warning: null,
    });
  } catch (error) {
    const err = error as Error;

    return jsonResponse({
      error: err.message || 'Unhandled native cover generation error.',
    }, 500);
  }
});
