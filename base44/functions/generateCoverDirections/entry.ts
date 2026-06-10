// GENERATE_COVER_DIRECTIONS_V2
// Creative Director + 429-safe local fallback
// Purpose:
// - Read project/manuscript context and generate four genuinely different, manuscript-grounded cover directions.
// - Make Rebuild Directions meaningfully fresh on every click by honoring previousDirections, creativeDirective, rebuildIteration, and rebuildNonce.
// - Never leave the frontend empty when OpenAI rate-limits/quota-fails; returns a strong local fallback instead.

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const LOCAL_FALLBACK_VERSION = 'local-cover-director-v2';
const FINAL_VARIANT_COUNT = 4;

type RequestPayload = {
  title?: string;
  subtitle?: string;
  authorName?: string;
  seriesText?: string;
  genre?: string;
  subgenre?: string;
  projectContext?: string;
  artDesc?: string;
  previousDirections?: string;
  creativeDirective?: string;
  rebuildIteration?: number;
  rebuildMode?: string;
  rebuildNonce?: string;
  model?: string;
};

type CoverDirection = {
  id: string;
  label: string;
  focalConcept: string;
  userEditable: string;
  designIntent: string;
  manuscriptEvidence: string;
  commonMood: string;
  avoid: string[];
  order: number;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'almost', 'along', 'also', 'always', 'among', 'another',
  'because', 'before', 'being', 'between', 'chapter', 'chapters', 'could', 'every', 'first', 'found',
  'from', 'great', 'however', 'into', 'itself', 'little', 'maybe', 'might', 'never', 'other', 'people',
  'project', 'scene', 'scenes', 'should', 'their', 'there', 'these', 'those', 'through', 'title',
  'under', 'until', 'using', 'where', 'which', 'while', 'would', 'world', 'story', 'genre', 'subgenre',
  'voice', 'style', 'notes', 'author', 'description', 'outline', 'setting', 'character', 'characters',
  'history', 'nonfiction', 'fiction', 'novel', 'book', 'books', 'research', 'manuscript', 'sampled',
  'current', 'project', 'context', 'section', 'sections', 'thing', 'things', 'make', 'made', 'with',
  'this', 'that', 'they', 'them', 'have', 'been', 'were', 'what', 'when', 'will', 'only', 'more', 'most',
]);

const SHARED_AVOID = [
  'fake signage',
  'extra readable words beyond title/subtitle/author/series',
  'book mockup',
  'generic skyline',
  'cheap typography',
  'amateur flyer layout',
  'generic AI poster composition',
  'unrelated imagery',
  'muddy unreadable focal point',
  'busy collage with no hierarchy',
  'stock-photo blandness',
  'literal scene clutter',
];

const NONFICTION_BLUEPRINTS = [
  {
    label: 'Evidence Object',
    designIntent:
      'A premium object-led nonfiction cover where one piece of evidence becomes the visual hook.',
    angle:
      'Build the composition around a single artifact, recording device, key, document, ledger, room object, institutional tool, or physical clue that symbolizes the investigation.',
    mood: 'Forensic, restrained, serious, tactile, credible.',
  },
  {
    label: 'Archive Dossier',
    designIntent:
      'A layered documentary cover built from archive logic without looking like a messy evidence board.',
    angle:
      'Use files, redactions, ledgers, microfilm texture, photographs, diagrams, map fragments, official stamps, or paper layers in a disciplined premium layout.',
    mood: 'Investigative, archival, tactile, intelligent, urgent.',
  },
  {
    label: 'Institutional Architecture',
    designIntent:
      'A location-led cover where the institution itself becomes the accused presence.',
    angle:
      'Use a building face, corridor, door, room, window, staircase, gate, cellblock, workshop, or threshold as the central visual argument.',
    mood: 'Atmospheric, severe, historical, structural, cinematic.',
  },
  {
    label: 'Forensic Threshold',
    designIntent:
      'A question-driven cover built around a boundary, lock, doorway, or sealed place.',
    angle:
      'Center the design on a door, lock, hinge, keyhole, latch, sealed drawer, cabinet, gate, threshold, or blocked passage that implies the book’s central unresolved question.',
    mood: 'Tense, minimal, unresolved, elegant, precise.',
  },
  {
    label: 'Prestige Symbolic',
    designIntent:
      'A high-concept editorial nonfiction cover that sells the thesis through metaphor instead of literal reenactment.',
    angle:
      'Use a single symbolic image, negative space, stark geometry, shadow, stain, fracture, burn mark, torn paper, or repeated institutional pattern.',
    mood: 'Elegant, restrained, literary, memorable, premium.',
  },
  {
    label: 'Documentary Object Grid',
    designIntent:
      'A curated grid/tabletop of specific evidence pieces that feels designed, not random.',
    angle:
      'Arrange multiple artifacts or paper fragments into a clean grid, desk layout, case-file spread, or museum-display composition.',
    mood: 'Analytical, procedural, premium, tactile, organized.',
  },
  {
    label: 'Historical Tableau',
    designIntent:
      'A serious historical composition that freezes one charged institutional moment without sensationalizing it.',
    angle:
      'Create a careful, sober scene from the book’s historical world: empty corridor, smoke-stained room, official desk, archive room, or aftermath space.',
    mood: 'Historical, dramatic, sober, immersive, credible.',
  },
  {
    label: 'Editorial Type/Image',
    designIntent:
      'A bold bookstore-grade design where typography and one image operate as a single concept.',
    angle:
      'Use strong negative space, crisp hierarchy, a single emblematic image, and a smart relationship between title placement and image shape.',
    mood: 'Modern, smart, sharp, clean, front-table ready.',
  },
];

const FICTION_BLUEPRINTS = [
  {
    label: 'Symbolic Object',
    designIntent: 'One iconic object carries the emotional promise of the story.',
    angle:
      'Choose a charged object, token, weapon, device, relic, letter, photograph, animal, or emblem that instantly signals conflict and genre.',
    mood: 'Commercial, iconic, high-contrast, memorable.',
  },
  {
    label: 'Cinematic Scene',
    designIntent:
      'A frozen story moment that feels like the most marketable scene in the book.',
    angle:
      'Create one visually legible scene with clear stakes, atmosphere, focal subject, and strong composition — not a random landscape.',
    mood: 'Cinematic, tense, atmospheric, polished.',
  },
  {
    label: 'Character / Silhouette',
    designIntent:
      'Human presence sells the story without relying on generic face-forward stock art.',
    angle:
      'Use back view, silhouette, reflection, shadow, posture, distance, doorway framing, or partial figure to imply character and stakes.',
    mood: 'Moody, personal, elegant, mysterious.',
  },
  {
    label: 'Prestige Editorial',
    designIntent: 'A cleaner, more literary or premium interpretation of the story hook.',
    angle:
      'Use metaphor, negative space, restrained imagery, and smart composition to make the book feel elevated and distinctive.',
    mood: 'Refined, clever, controlled, bookstore-quality.',
  },
  {
    label: 'Environmental Omen',
    designIntent: 'The setting itself becomes the visual hook and promise of conflict.',
    angle:
      'Make one location, weather pattern, room, city, wilderness, road, or threshold feel ominous and story-specific.',
    mood: 'Immersive, ominous, cinematic, spacious.',
  },
  {
    label: 'Artifact Collage',
    designIntent:
      'A polished clue-object cluster that teases the story world without spoiling it.',
    angle:
      'Use a designed arrangement of artifacts, textures, photographs, symbols, notes, or objects connected to the plot.',
    mood: 'Layered, tactile, intriguing, detailed.',
  },
  {
    label: 'Surreal Emotional Hook',
    designIntent:
      'A conceptual image captures the central emotional contradiction of the book.',
    angle:
      'Create one surreal-but-controlled visual metaphor rooted in the story’s central wound, mystery, obsession, or transformation.',
    mood: 'Conceptual, emotional, unforgettable, high-concept.',
  },
  {
    label: 'Typographic Emblem',
    designIntent:
      'A design-led cover where typography and image become one strong retail mark.',
    angle:
      'Use bold type placement with a symbol, silhouette, texture, or shape integrated into the cover concept.',
    mood: 'Graphic, bold, modern, sharp.',
  },
];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: CORS_HEADERS,
  });
}

function clean(input: unknown, limit = 12000): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n')
    .replace(/[ \t]{3,}/g, ' ')
    .trim()
    .slice(0, limit);
}

function compact(input: unknown, limit = 900): string {
  return clean(input, limit).replace(/\s+/g, ' ').trim().slice(0, limit);
}

function makeId(label: string, index: number, nonce = '') {
  const safeLabel = compact(label, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'direction';

  return `${safeLabel}-${index + 1}-${nonce || crypto.randomUUID()}`;
}

function hashString(value = '') {
  let hash = 0;
  const text = String(value || '');

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function splitSentences(text = '') {
  return clean(text, 16000)
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => compact(sentence, 220))
    .filter((sentence) => sentence.length > 30);
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.map((item) => compact(item, 260)).filter(Boolean)));
}

function extractKeywords(text = '', count = 16) {
  const words = String(text || '').toLowerCase().match(/[a-z][a-z'’-]{3,}/g);

  if (!words) return [];

  const freq = new Map<string, number>();

  words.forEach((word) => {
    const cleaned = word.replace(/[’']/g, '');
    if (!cleaned || STOPWORDS.has(cleaned)) return;
    freq.set(cleaned, (freq.get(cleaned) || 0) + 1);
  });

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}

function extractEvidenceSnippets(projectContext = '', count = 8) {
  const sentences = splitSentences(projectContext);

  if (!sentences.length) return [];

  const preferred = sentences.filter((sentence) =>
    /\b(door|key|archive|record|report|body|death|riot|cell|room|evidence|letter|photograph|map|ledger|fire|trial|court|hospital|machine|city|river|family|secret|weapon|blood|memory|voice|recording|institution|building|motel|lake|forest|road|train|school|church|case|file|document|experiment|lab|witness|survivor)\b/i.test(sentence)
  );

  const source = preferred.length >= count ? preferred : sentences;
  const stride = Math.max(1, Math.floor(source.length / count));
  const picks: string[] = [];

  for (let i = 0; i < source.length && picks.length < count; i += stride) {
    picks.push(source[i]);
  }

  return uniqueStrings(picks).slice(0, count);
}

function getMode(payload: RequestPayload) {
  const text = [payload.genre, payload.subgenre, payload.projectContext, payload.artDesc]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    text.includes('nonfiction') ||
    text.includes('history') ||
    text.includes('memoir') ||
    text.includes('investigative') ||
    text.includes('business') ||
    text.includes('self-help') ||
    text.includes('true crime') ||
    text.includes('biography')
  ) {
    return 'nonfiction';
  }

  return 'fiction';
}

function getGenreDefaults(payload: RequestPayload) {
  const g = `${payload.genre || ''} ${payload.subgenre || ''}`.toLowerCase();

  if (g.includes('horror')) {
    return {
      style: 'Dark/Moody',
      mood: 'Dark',
      brief: 'Commercial horror cover with restrained dread, one disturbing central hook, strong hierarchy, and no camp.',
    };
  }

  if (g.includes('thriller') || g.includes('mystery') || g.includes('suspense') || g.includes('crime')) {
    return {
      style: 'Photorealistic',
      mood: 'Dark',
      brief: 'Commercial thriller cover with premium paperback polish, sharp tension, cinematic contrast, and one unmistakable hook.',
    };
  }

  if (g.includes('romance')) {
    return {
      style: 'Romantic',
      mood: 'Warm',
      brief: 'Commercial romance cover with emotional clarity, polished type hierarchy, and a strong relationship or longing hook.',
    };
  }

  if (g.includes('sci-fi') || g.includes('science fiction') || g.includes('cyber')) {
    return {
      style: 'Photorealistic',
      mood: 'Cool',
      brief: 'Commercial science-fiction cover with intelligent futuristic atmosphere, high-concept visual hook, and polished typography.',
    };
  }

  if (g.includes('fantasy')) {
    return {
      style: 'Painterly',
      mood: 'Vibrant',
      brief: 'Commercial fantasy cover with mythic atmosphere, magical central hook, and professional title treatment.',
    };
  }

  if (getMode(payload) === 'nonfiction') {
    return {
      style: 'Minimalist',
      mood: 'Muted',
      brief: 'Premium nonfiction cover with an editorial metaphor, clean hierarchy, credible visual evidence, and restrained commercial polish.',
    };
  }

  return {
    style: 'Photorealistic',
    mood: 'Muted',
    brief: 'Commercial finished book cover with strong visual hook, professional title hierarchy, and marketable retail polish.',
  };
}

function rotateBlueprints<T>(pool: T[], seed: number) {
  if (!pool.length) return [];

  const start = seed % pool.length;
  const result: T[] = [];

  for (let i = 0; i < pool.length; i += 1) {
    result.push(pool[(start + i) % pool.length]);
  }

  return result;
}

function buildLocalFallbackDirections(payload: RequestPayload, reason = 'local fallback') {
  const mode = getMode(payload);
  const defaults = getGenreDefaults(payload);
  const title = compact(payload.title, 180) || 'Untitled';
  const subtitle = compact(payload.subtitle, 220);
  const authorName = compact(payload.authorName, 160);
  const seriesText = compact(payload.seriesText, 160);
  const projectContext = clean(payload.projectContext, 16000);
  const artDesc = compact(payload.artDesc, 1200);
  const previousDirections = compact(payload.previousDirections, 2200);
  const iteration = Number.isFinite(payload.rebuildIteration) ? Number(payload.rebuildIteration) : 0;
  const nonce = compact(payload.rebuildNonce, 160) || crypto.randomUUID();
  const pool = mode === 'nonfiction' ? NONFICTION_BLUEPRINTS : FICTION_BLUEPRINTS;
  const seed = hashString(`${title}\n${payload.genre}\n${payload.subgenre}\n${projectContext}\n${previousDirections}\n${iteration}\n${nonce}`);
  const blueprints = rotateBlueprints(pool, seed).slice(0, FINAL_VARIANT_COUNT);
  const keywords = extractKeywords(`${projectContext}\n${artDesc}\n${title}\n${subtitle}`, 18);
  const evidence = extractEvidenceSnippets(projectContext, 10);

  const conceptCandidates = uniqueStrings([
    compact(payload.artDesc, 160),
    compact(payload.title, 100),
    compact(payload.subtitle, 120),
    ...keywords.map((word) => word.replace(/^\w/, (letter) => letter.toUpperCase())),
    ...evidence.map((sentence) => sentence.split(',')[0]).slice(0, 4),
  ]).filter(Boolean);

  const directions: CoverDirection[] = blueprints.map((blueprint, index) => {
    const keywordSlice = keywords.slice(index * 2, index * 2 + 4);
    const focalConcept =
      conceptCandidates[(index + iteration) % Math.max(1, conceptCandidates.length)] ||
      `${title} central visual hook`;
    const evidenceOne = evidence[index] || evidence[0] || '';
    const evidenceTwo = evidence[index + FINAL_VARIANT_COUNT] || evidence[index + 1] || '';

    return {
      id: makeId(blueprint.label, index, nonce),
      label: blueprint.label,
      focalConcept,
      userEditable: [
        `Create a ${blueprint.label.toLowerCase()} finished retail cover for "${title}" centered on ${focalConcept}.`,
        blueprint.angle,
        keywordSlice.length ? `Use manuscript-specific visual cues such as ${keywordSlice.join(', ')}.` : '',
        evidenceOne ? `Ground the imagery in this manuscript detail: ${evidenceOne}` : '',
        evidenceTwo ? `Secondary cue: ${evidenceTwo}` : '',
        subtitle ? `Preserve clear room for the subtitle: ${subtitle}.` : '',
        authorName ? `Render the author name cleanly as: ${authorName}.` : '',
        seriesText ? `Include the series/top-line cleanly: ${seriesText}.` : '',
        'This direction must look fundamentally different from the other three directions in the set.',
      ]
        .filter(Boolean)
        .join(' '),
      designIntent: blueprint.designIntent,
      manuscriptEvidence: uniqueStrings([evidenceOne, evidenceTwo]).join(' / '),
      commonMood: blueprint.mood,
      avoid: SHARED_AVOID,
      order: index + 1,
    };
  });

  return {
    masterBrief: [
      artDesc || defaults.brief,
      mode === 'nonfiction'
        ? 'Design a credible, premium nonfiction cover that sells the central investigation or thesis through one unforgettable visual idea.'
        : 'Design a commercially strong fiction cover that sells the central story promise through one unforgettable visual idea.',
      'The four directions must be meaningfully different in subject, composition, and visual strategy.',
    ].join(' '),
    style: defaults.style,
    mood: defaults.mood,
    directions,
    model: `${LOCAL_FALLBACK_VERSION}: ${reason}`,
    generated_by_llm: false,
    rebuild_nonce: payload.rebuildNonce || crypto.randomUUID(),
  };
}

function resolveModel(raw?: string) {
  const envModel =
    Deno.env.get('OPENAI_COVER_DIRECTIONS_MODEL') ||
    Deno.env.get('OPENAI_TEXT_MODEL') ||
    '';

  const requested = clean(raw || envModel || 'gpt-4.1-mini', 80);

  if (requested === 'gpt-4.1') return 'gpt-4.1';
  if (requested === 'gpt-4o-mini') return 'gpt-4o-mini';
  if (requested === 'gpt-5-mini') return 'gpt-5-mini';
  if (requested === 'gpt-5') return 'gpt-5';

  return 'gpt-4.1-mini';
}

function buildPrompt(payload: RequestPayload) {
  const title = clean(payload.title, 180);
  const subtitle = clean(payload.subtitle, 260);
  const authorName = clean(payload.authorName, 180);
  const seriesText = clean(payload.seriesText, 180);
  const genre = clean(`${payload.genre || ''} ${payload.subgenre || ''}`, 240);
  const projectContext = clean(payload.projectContext, 16000);
  const artDesc = clean(payload.artDesc, 3000);
  const previousDirections = clean(payload.previousDirections, 5000);
  const rebuildNonce = clean(payload.rebuildNonce, 120);
  const rebuildIteration = Number.isFinite(payload.rebuildIteration) ? Number(payload.rebuildIteration) : 0;
  const rebuildMode = clean(payload.rebuildMode, 80) || 'extract';
  const creativeDirective = clean(payload.creativeDirective, 3500);
  const mode = getMode(payload);
  const blueprintPool = mode === 'nonfiction' ? NONFICTION_BLUEPRINTS : FICTION_BLUEPRINTS;
  const archetypes = blueprintPool.map((item) => item.label).join(', ');

  return [
    'You are an elite commercial book-cover creative director and art-direction strategist.',
    'Your job is not to summarize the book. Your job is to find the strongest sellable visual concepts inside the manuscript.',
    'Think like a hybrid of a Big Five cover art director, bookstore buyer, and cinematic poster designer.',
    '',
    'PRIMARY MISSION:',
    'Generate exactly four cover directions that are manuscript-grounded, visually specific, marketable, and radically distinct from each other.',
    'Each direction must be strong enough that an image model can render a finished retail-quality book cover from it.',
    '',
    'FRESHNESS AND REBUILD RULES:',
    `Rebuild mode: ${rebuildMode}`,
    `Rebuild iteration: ${rebuildIteration}`,
    `Rebuild nonce: ${rebuildNonce || crypto.randomUUID()}`,
    'If previous directions are supplied, do not paraphrase them. Replace the visual strategy, focal object/scene, composition, and mood posture.',
    'A rebuild must feel like a new creative meeting, not a shuffled preset bank.',
    '',
    'DIVERSITY RULES:',
    'The four directions must not share the same central object, location, silhouette, composition, or metaphor.',
    'Use four different visual strategy families.',
    `Useful strategy families for this project: ${archetypes}.`,
    'Do not give four versions of a door, four versions of a person walking away, four versions of a document stack, or four versions of a dark corridor unless the manuscript truly demands it and each is visually transformed.',
    '',
    'BOOK METADATA:',
    `Title: ${title || 'Untitled'}`,
    subtitle ? `Subtitle: ${subtitle}` : 'Subtitle: none',
    authorName ? `Author: ${authorName}` : 'Author: unknown',
    seriesText ? `Series/top-line: ${seriesText}` : 'Series/top-line: none',
    `Genre/subgenre: ${genre || 'unknown'}`,
    `Detected mode: ${mode}`,
    '',
    artDesc
      ? `CURRENT USER/APP COVER BRIEF:\n${artDesc}`
      : 'CURRENT USER/APP COVER BRIEF: none',
    '',
    creativeDirective
      ? `EXTRA CREATIVE DIRECTIVE FROM FRONTEND:\n${creativeDirective}`
      : 'EXTRA CREATIVE DIRECTIVE FROM FRONTEND: none',
    '',
    previousDirections
      ? `PREVIOUS DIRECTIONS TO AVOID REPEATING:\n${previousDirections}`
      : 'PREVIOUS DIRECTIONS TO AVOID REPEATING: none',
    '',
    'MANUSCRIPT / PROJECT CONTEXT:',
    projectContext || 'No manuscript context provided. Use metadata only and do not pretend to know story details.',
    '',
    'OUTPUT REQUIREMENTS:',
    'Return exactly four directions.',
    'Each direction must include:',
    '- label: short commercial archetype name',
    '- focalConcept: the precise visual hook',
    '- userEditable: detailed editable cover prompt/direction, including composition, image subject, mood, and typography posture',
    '- designIntent: why this concept sells this specific book',
    '- manuscriptEvidence: concrete details from the supplied context that justify the concept',
    '- commonMood: concise mood/design posture',
    '- avoid: 8-12 concise things to avoid',
    '- order: 1-4',
    '',
    'QUALITY BAR:',
    'No generic “dark figure in hallway” unless it is transformed into a manuscript-specific, premium concept.',
    'No generic skyline.',
    'No fake signage.',
    'No extra readable words beyond title/subtitle/author/series.',
    'No book mockups.',
    'No cheap typography or WordArt.',
    'No busy AI poster clutter.',
    'No unrelated props.',
    'Every direction must be specific, concrete, and visually renderable.',
  ].join('\n');
}

function directionsSchema() {
  return {
    type: 'json_schema',
    name: 'cover_directions_payload',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        masterBrief: {
          type: 'string',
          description: 'A concise but manuscript-grounded cover strategy summary.',
        },
        style: {
          type: 'string',
          description: 'Suggested art style, e.g. Photorealistic, Dark/Moody, Minimalist, Painterly.',
        },
        mood: {
          type: 'string',
          description: 'Suggested color/mood, e.g. Dark, Muted, Warm, Cool, Vibrant.',
        },
        directions: {
          type: 'array',
          minItems: 4,
          maxItems: 4,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              focalConcept: { type: 'string' },
              userEditable: { type: 'string' },
              designIntent: { type: 'string' },
              manuscriptEvidence: { type: 'string' },
              commonMood: { type: 'string' },
              avoid: {
                type: 'array',
                minItems: 8,
                maxItems: 12,
                items: { type: 'string' },
              },
              order: { type: 'number' },
            },
            required: [
              'id',
              'label',
              'focalConcept',
              'userEditable',
              'designIntent',
              'manuscriptEvidence',
              'commonMood',
              'avoid',
              'order',
            ],
          },
        },
      },
      required: ['masterBrief', 'style', 'mood', 'directions'],
    },
  };
}

function extractOutputText(data: Record<string, unknown>) {
  if (typeof data?.output_text === 'string') return data.output_text;

  const output = Array.isArray(data?.output) ? data.output : [];

  for (const item of output as Array<Record<string, unknown>>) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const c of content as Array<Record<string, unknown>>) {
      if (typeof c?.text === 'string') return c.text;
      if (typeof c?.output_text === 'string') return c.output_text;
    }
  }

  return '';
}

function parseError(status: number, text: string) {
  try {
    const parsed = JSON.parse(text);
    const message = parsed?.error?.message || parsed?.message || text;
    const code = parsed?.error?.code ? ` Code: ${parsed.error.code}.` : '';
    const param = parsed?.error?.param ? ` Param: ${parsed.error.param}.` : '';
    return `OpenAI Responses API error ${status}: ${message}.${code}${param}`;
  } catch {
    return `OpenAI Responses API error ${status}: ${text}`;
  }
}

function shouldUseLocalFallback(status: number, text = '') {
  const lowered = text.toLowerCase();

  return (
    status === 401 ||
    status === 403 ||
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lowered.includes('insufficient_quota') ||
    lowered.includes('rate limit') ||
    lowered.includes('too many requests') ||
    lowered.includes('temporarily unavailable')
  );
}

async function callOpenAI(body: Record<string, unknown>, apiKey: string) {
  return fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
}

function coerceDirections(parsed: Record<string, unknown>, payload: RequestPayload) {
  const fallback = buildLocalFallbackDirections(payload, 'normalization fallback');
  const rawDirections = Array.isArray(parsed?.directions) ? parsed.directions : [];

  const directions: CoverDirection[] = rawDirections.slice(0, FINAL_VARIANT_COUNT).map((item, index) => {
    const raw = item as Record<string, unknown>;
    const fallbackDirection = fallback.directions[index] as CoverDirection;

    return {
      id: compact(raw.id, 120) || makeId(compact(raw.label, 80) || fallbackDirection.label, index, compact(payload.rebuildNonce, 100)),
      label: compact(raw.label, 80) || fallbackDirection.label,
      focalConcept: compact(raw.focalConcept, 220) || fallbackDirection.focalConcept,
      userEditable: compact(raw.userEditable, 1800) || fallbackDirection.userEditable,
      designIntent: compact(raw.designIntent, 700) || fallbackDirection.designIntent,
      manuscriptEvidence: compact(raw.manuscriptEvidence, 900) || fallbackDirection.manuscriptEvidence,
      commonMood: compact(raw.commonMood, 320) || fallbackDirection.commonMood,
      avoid: Array.isArray(raw.avoid)
        ? (raw.avoid as unknown[]).map((x) => compact(x, 120)).filter(Boolean).slice(0, 12)
        : fallbackDirection.avoid,
      order: Number(raw.order || index + 1),
    };
  });

  while (directions.length < FINAL_VARIANT_COUNT) {
    directions.push(fallback.directions[directions.length] as CoverDirection);
  }

  return {
    masterBrief: compact(parsed.masterBrief, 1400) || fallback.masterBrief,
    style: compact(parsed.style, 80) || fallback.style,
    mood: compact(parsed.mood, 80) || fallback.mood,
    directions,
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

    const apiKey = Deno.env.get('OPENAI_API_KEY');

    if (!apiKey) {
      return jsonResponse(buildLocalFallbackDirections(payload, 'OPENAI_API_KEY not set'));
    }

    const model = resolveModel(payload.model);
    const prompt = buildPrompt(payload);

    const body: Record<string, unknown> = {
      model,
      input: prompt,
      text: {
        format: directionsSchema(),
      },
      max_output_tokens: 4500,
    };

    let response = await callOpenAI(body, apiKey);

    if (!response.ok) {
      const firstText = await response.text();

      if (shouldUseLocalFallback(response.status, firstText)) {
        return jsonResponse(buildLocalFallbackDirections(payload, parseError(response.status, firstText)));
      }

      if (response.status === 400) {
        const fallbackBody: Record<string, unknown> = {
          model,
          input: `${prompt}\n\nReturn only valid JSON matching this shape: {"masterBrief":"","style":"","mood":"","directions":[{"id":"","label":"","focalConcept":"","userEditable":"","designIntent":"","manuscriptEvidence":"","commonMood":"","avoid":[],"order":1}]}`,
          max_output_tokens: 4500,
        };

        response = await callOpenAI(fallbackBody, apiKey);

        if (!response.ok) {
          const fallbackText = await response.text();

          if (shouldUseLocalFallback(response.status, fallbackText)) {
            return jsonResponse(buildLocalFallbackDirections(payload, parseError(response.status, fallbackText)));
          }

          return jsonResponse({
            error: `${parseError(400, firstText)} Retry also failed: ${parseError(response.status, fallbackText)}`,
            model,
          }, response.status);
        }
      } else {
        return jsonResponse({
          error: parseError(response.status, firstText),
          model,
        }, response.status);
      }
    }

    const data = await response.json();
    const text = extractOutputText(data);

    let parsed: Record<string, unknown>;

    try {
      parsed = typeof text === 'string' && text.trim()
        ? JSON.parse(text)
        : data as Record<string, unknown>;
    } catch {
      return jsonResponse(buildLocalFallbackDirections(payload, 'Model returned unparseable JSON'));
    }

    const coerced = coerceDirections(parsed, payload);

    return jsonResponse({
      ...coerced,
      model,
      generated_by_llm: true,
      rebuild_nonce: payload.rebuildNonce || crypto.randomUUID(),
    });
  } catch (error) {
    const err = error as Error;

    return jsonResponse(buildLocalFallbackDirections({} as RequestPayload, err.message || 'Unhandled cover direction generation error'));
  }
});
