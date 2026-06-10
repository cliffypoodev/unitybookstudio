import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Wand2,
  Wifi,
  WifiOff,
  Shuffle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ART_STYLES, COLOR_MOODS } from '@/lib/kdpCover';
import { base44 } from '@/api/base44Client';
import { bypassUploadFile } from '@/lib/coreBypasses';
import { resolveChapterContent } from '@/lib/chapterStorage';
import CoverArtGalleryGrid from '@/components/cover/CoverArtGalleryGrid';
import { checkComfyUIStatus, getComfyUIBaseUrl, getComfyUIDisplayUrl, setComfyUIBaseUrl, normalizeComfyUIError } from '@/lib/comfyuiClient';
import { COVER_MODEL_PIPELINES, COVER_SIZE_PRESETS, COVER_TYPOGRAPHY_MODES, getDefaultCoverSettingsForModel, getCoverDimensionsForPreset, validateCoverWorkflowOptions, FLUX_CHECKPOINT_NAME, PONYXL_CHECKPOINT_NAME } from '@/lib/coverComfyWorkflows';
import { buildCoverPrompt, buildKittlStyleThreeLinePrompt } from '@/lib/coverPromptBuilder';
import { getAllGenreCoverTemplates, getGenreCoverTemplate, getRecommendedPipeline } from '@/lib/coverGenreTemplates';
import { buildCoverSafetyConstraints, validateCoverPromptSafety } from '@/lib/coverSafety';
import { DEFAULT_TYPOGRAPHY_SETTINGS, FONT_FAMILIES, TITLE_PLACEMENT_PRESETS, AUTHOR_PLACEMENT_PRESETS, validateTypographySettings, buildTypographyOverlay, calculateSafeMargins } from '@/lib/coverTypographyComposer';
import { COVER_EXPORT_PRESETS, getCoverExportDimensions, validateCoverExportSettings, buildCoverExportMetadata, buildExportFilename, downloadCoverImage } from '@/lib/coverExport';
import { createCoverVariation, duplicateCoverVariation, updateCoverVariation, selectActiveCoverVariation as selectActiveVariation, deleteCoverVariation, buildCoverVariationMetadata } from '@/lib/coverVariationManager';
import { extractSeriesCoverSignature, applySeriesCoverSignature, validateSeriesCoverConsistency, buildSeriesCoverConsistencyReport } from '@/lib/coverSeriesConsistency';

const FINAL_VARIANT_COUNT = 4;
const DIRECTION_CACHE_VERSION = 'v3';
const REBUILD_HISTORY_LIMIT = 8;
const REBUILD_COOLDOWN_MS = 5000;

const DEFAULT_DIRECTIONS = [
  {
    id: 'symbolic-object-default',
    label: 'Symbolic Object',
    focalConcept: '',
    userEditable:
      'Click Extract Idea or Rebuild Directions to generate a manuscript-grounded symbolic object cover direction.',
    designIntent:
      'Object-driven commercial cover. Iconic, readable, specific, and grounded in the manuscript.',
    manuscriptEvidence: '',
    commonMood: 'Professional retail book cover with a strong visual hook.',
    avoid: [
      'fake signage',
      'extra readable words',
      'book mockup',
      'generic skyline',
      'cheap typography',
      'amateur flyer layout',
      'generic AI poster',
      'unrelated imagery',
    ],
    order: 1,
  },
  {
    id: 'cinematic-scene-default',
    label: 'Cinematic Scene',
    focalConcept: '',
    userEditable:
      'Click Extract Idea or Rebuild Directions to generate a manuscript-grounded cinematic scene cover direction.',
    designIntent:
      'Scene-driven commercial cover. Feels like one frozen story moment, not generic stock art.',
    manuscriptEvidence: '',
    commonMood: 'Professional retail book cover with story atmosphere and tension.',
    avoid: [
      'fake signage',
      'extra readable words',
      'book mockup',
      'generic skyline',
      'cheap typography',
      'amateur flyer layout',
      'generic AI poster',
      'unrelated imagery',
    ],
    order: 2,
  },
  {
    id: 'character-silhouette-default',
    label: 'Character / Silhouette',
    focalConcept: '',
    userEditable:
      'Click Extract Idea or Rebuild Directions to generate a manuscript-grounded character or silhouette cover direction.',
    designIntent:
      'Human-presence cover using silhouette, reflection, posture, distance, or doorway framing.',
    manuscriptEvidence: '',
    commonMood: 'Professional retail book cover with mystery, mood, and human presence.',
    avoid: [
      'fake signage',
      'extra readable words',
      'book mockup',
      'generic skyline',
      'cheap typography',
      'amateur flyer layout',
      'generic AI poster',
      'unrelated imagery',
    ],
    order: 3,
  },
  {
    id: 'prestige-editorial-default',
    label: 'Prestige Editorial',
    focalConcept: '',
    userEditable:
      'Click Extract Idea or Rebuild Directions to generate a manuscript-grounded prestige editorial cover direction.',
    designIntent:
      'Refined editorial/premium paperback concept. Less literal, more designed.',
    manuscriptEvidence: '',
    commonMood: 'Professional retail book cover with restrained, high-concept polish.',
    avoid: [
      'fake signage',
      'extra readable words',
      'book mockup',
      'generic skyline',
      'cheap typography',
      'amateur flyer layout',
      'generic AI poster',
      'unrelated imagery',
    ],
    order: 4,
  },
];

const NONFICTION_BLUEPRINTS = [
  {
    label: 'Evidence Object',
    designIntent:
      'One powerful object as the full commercial hook, photographed or rendered with prestige nonfiction seriousness.',
    angle:
      'Center the cover around a single evidence object, artifact, or instrument that symbolizes the book’s core argument.',
    mood: 'Prestige, forensic, intelligent, clean, serious.',
  },
  {
    label: 'Archive Dossier',
    designIntent:
      'Documentary collage / dossier cover with layered archival texture, but still premium and retail-ready.',
    angle:
      'Use clipped documents, photographs, redactions, diagrams, maps, file tabs, or stamps in a highly designed way.',
    mood: 'Investigative, archival, documentary, layered, tactile.',
  },
  {
    label: 'Institutional Architecture',
    designIntent:
      'Location-led cover driven by a building, corridor, room, facility, or threshold tied to the central investigation.',
    angle:
      'Make architecture the story hook, with scale, perspective, emptiness, and unease doing the work.',
    mood: 'Atmospheric, historical, structural, severe, cinematic.',
  },
  {
    label: 'Forensic Threshold',
    designIntent:
      'A threshold, doorway, barrier, or locked mechanism that visually implies a question the book is trying to answer.',
    angle:
      'Build tension around a boundary, door, lock, stair, gate, room, drawer, cabinet, or hidden compartment.',
    mood: 'Tense, investigative, unresolved, elegant.',
  },
  {
    label: 'Prestige Symbolic',
    designIntent:
      'Minimal but intellectually sharp metaphor cover that feels like a premium front-table nonfiction paperback.',
    angle:
      'Use a clean symbolic composition rather than literal scene recreation, with one concept carrying the cover.',
    mood: 'Editorial, restrained, high-concept, polished.',
  },
  {
    label: 'Historical Tableau',
    designIntent:
      'A carefully staged historical moment or composite tableau that feels serious, credible, and visually commanding.',
    angle:
      'Freeze one representative historical or investigative moment without turning it into a movie poster cliché.',
    mood: 'Historical, elevated, deliberate, dramatic.',
  },
  {
    label: 'Documentary Object Grid',
    designIntent:
      'A curated arrangement of evidence pieces that suggests the breadth of the investigation.',
    angle:
      'Arrange multiple artifacts, files, notes, or items in a disciplined grid or tabletop composition.',
    mood: 'Analytical, procedural, premium, tactile.',
  },
  {
    label: 'Editorial Minimal Type/Image',
    designIntent:
      'A bold minimalist concept with a strong type-image relationship and one clean visual metaphor.',
    angle:
      'Lean into bookstore-quality editorial design, negative space, and one unforgettable symbolic cue.',
    mood: 'Modern, elite, clear, memorable.',
  },
];

const FICTION_BLUEPRINTS = [
  {
    label: 'Symbolic Object',
    designIntent:
      'One iconic object carrying the promise of the whole story.',
    angle:
      'Build the cover around a single charged object, emblem, token, or visual hook tied to the story’s central conflict.',
    mood: 'Commercial, iconic, high-contrast, memorable.',
  },
  {
    label: 'Environmental Omen',
    designIntent:
      'The setting itself becomes the hook.',
    angle:
      'Use one striking environment, location, weather pattern, or ominous spatial composition to sell the book.',
    mood: 'Atmospheric, immersive, cinematic, evocative.',
  },
  {
    label: 'Character Silhouette',
    designIntent:
      'Human presence without generic face-forward stock art.',
    angle:
      'Use a silhouette, back view, reflection, shadow, or posture to imply character and stakes rather than literal portraiture.',
    mood: 'Moody, personal, tense, elegant.',
  },
  {
    label: 'Prestige Editorial',
    designIntent:
      'A cleaner, more literary, premium-bookstore direction.',
    angle:
      'Use restraint, metaphor, and clever composition to make the cover feel elevated rather than literal.',
    mood: 'Refined, confident, clever, editorial.',
  },
  {
    label: 'Artifact Collage',
    designIntent:
      'A story-world evidence board / clue-cluster approach done with polish.',
    angle:
      'Arrange related objects, textures, images, and clues as a designed collage that teases the narrative.',
    mood: 'Layered, intriguing, detailed, tactile.',
  },
  {
    label: 'Architectural Threshold',
    designIntent:
      'A door, hall, window, bridge, gate, or room as the cover’s central tension point.',
    angle:
      'Build tension through a threshold or boundary that implies crossing, danger, revelation, or absence.',
    mood: 'Suspenseful, elegant, spatial, charged.',
  },
  {
    label: 'Surreal Emotional Hook',
    designIntent:
      'A visually surprising concept that captures the book’s emotional / thematic core.',
    angle:
      'Use a controlled surreal or conceptual composition rather than a literal scene.',
    mood: 'Conceptual, emotional, unforgettable, high-concept.',
  },
  {
    label: 'Typographic Emblem',
    designIntent:
      'A powerful design-led concept where typography and image work together as one cover idea.',
    angle:
      'Use bold type placement with one emblematic image or texture for a marketable, striking retail cover.',
    mood: 'Bold, graphic, modern, sharp.',
  },
];

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'almost', 'along', 'also', 'always', 'among', 'another',
  'because', 'before', 'being', 'between', 'chapter', 'chapters', 'could', 'every', 'first', 'found',
  'from', 'great', 'however', 'into', 'itself', 'little', 'maybe', 'might', 'never', 'other', 'people',
  'project', 'scene', 'scenes', 'should', 'their', 'there', 'these', 'those', 'through', 'title',
  'under', 'until', 'using', 'where', 'which', 'while', 'would', 'world', 'story', 'genre', 'subgenre',
  'voice', 'style', 'notes', 'author', 'description', 'outline', 'setting', 'character', 'characters',
  'history', 'nonfiction', 'fiction', 'novel', 'book', 'books', 'research', 'manuscript', 'sampled',
]);

function normalizeText(value, limit = 900) {
  if (!value) return '';

  return String(value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function normalizeMultilineText(value, limit = 9000) {
  if (!value) return '';

  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, limit);
}

function makeNonce() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeCacheKey(projectId) {
  return `cover-directions:${DIRECTION_CACHE_VERSION}:${projectId || 'unknown'}`;
}

function getProjectMode(project) {
  const genre = String(project?.genre || '').toLowerCase();
  const subgenre = String(project?.subgenre || '').toLowerCase();
  const bookType = String(project?.book_type || '').toLowerCase();
  const projectType = String(project?.project_type || '').toLowerCase();

  if (
    bookType.includes('nonfiction') ||
    projectType.includes('nonfiction') ||
    genre.includes('nonfiction') ||
    genre.includes('history') ||
    genre.includes('memoir') ||
    genre.includes('business') ||
    genre.includes('self-help') ||
    subgenre.includes('history')
  ) {
    return 'nonfiction';
  }

  return 'fiction';
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

function uniqueArray(items = []) {
  return Array.from(new Set(items.filter(Boolean)));
}

function splitIntoSentences(text = '') {
  return normalizeMultilineText(text, 16000)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
}

function extractKeywords(text = '', count = 10) {
  const words = String(text || '')
    .toLowerCase()
    .match(/[a-z][a-z'’-]{3,}/g);

  if (!words) return [];

  const freq = new Map();

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

function sampleEvidenceSnippets(projectContext = '', count = 6) {
  const sentences = splitIntoSentences(projectContext);

  if (!sentences.length) return [];

  const picks = [];
  const stride = Math.max(1, Math.floor(sentences.length / count));

  for (let i = 0; i < sentences.length && picks.length < count; i += stride) {
    const sentence = normalizeText(sentences[i], 180);
    if (sentence) picks.push(sentence);
  }

  return uniqueArray(picks).slice(0, count);
}

function safeJoin(parts = [], sep = ' · ') {
  return parts.filter(Boolean).join(sep);
}

function getBasicGenreDefaults(genre = '') {
  const g = String(genre || '').toLowerCase();

  if (
    g.includes('thriller') ||
    g.includes('suspense') ||
    g.includes('crime') ||
    g.includes('mystery')
  ) {
    return {
      style: 'Photorealistic',
      mood: 'Dark',
      brief:
        'Commercial thriller cover with premium paperback design, strong tension, cinematic contrast, and one specific visual hook.',
    };
  }

  if (g.includes('horror')) {
    return {
      style: 'Dark/Moody',
      mood: 'Dark',
      brief:
        'Commercial horror cover with restrained dread, one disturbing central hook, professional typography, and no camp.',
    };
  }

  if (g.includes('romance') || g.includes('romantic') || g.includes('romcom')) {
    return {
      style: 'Romantic',
      mood: 'Warm',
      brief:
        'Commercial romance cover with emotional hook, elegant typography, and polished retail presentation.',
    };
  }

  if (g.includes('sci-fi') || g.includes('science fiction') || g.includes('cyber')) {
    return {
      style: 'Photorealistic',
      mood: 'Cool',
      brief:
        'Commercial science-fiction cover with intelligent futuristic atmosphere, high-concept visual hook, and polished typography.',
    };
  }

  if (g.includes('fantasy')) {
    return {
      style: 'Painterly',
      mood: 'Vibrant',
      brief:
        'Commercial fantasy cover with mythic mood, magical central hook, and professional title treatment.',
    };
  }

  if (
    g.includes('nonfiction') ||
    g.includes('memoir') ||
    g.includes('history') ||
    g.includes('self-help') ||
    g.includes('business')
  ) {
    return {
      style: 'Minimalist',
      mood: 'Muted',
      brief:
        'Premium nonfiction cover with editorial metaphor, clean hierarchy, professional typography, and restrained concept.',
    };
  }

  return {
    style: 'Photorealistic',
    mood: 'Muted',
    brief:
      'Commercial finished book cover with strong visual hook, professional title hierarchy, and marketable retail polish.',
  };
}

function serializeDirections(directions = []) {
  return directions
    .slice(0, FINAL_VARIANT_COUNT)
    .map((direction, index) => {
      return [
        `#${index + 1} ${direction.label || 'Direction'}`,
        `Focal concept: ${direction.focalConcept || ''}`,
        `Direction: ${direction.userEditable || ''}`,
        `Design intent: ${direction.designIntent || ''}`,
        `Evidence: ${direction.manuscriptEvidence || ''}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function normalizeDirections(rawDirections) {
  if (!Array.isArray(rawDirections) || rawDirections.length === 0) {
    return DEFAULT_DIRECTIONS;
  }

  const cleaned = rawDirections
    .slice(0, FINAL_VARIANT_COUNT)
    .map((direction, index) => {
      const fallback = DEFAULT_DIRECTIONS[index] || DEFAULT_DIRECTIONS[0];

      return {
        id: direction.id || `${direction.label || 'direction'}-${index + 1}-${makeNonce()}`,
        label: direction.label || fallback.label || `Direction ${index + 1}`,
        focalConcept: direction.focalConcept || '',
        userEditable:
          direction.userEditable ||
          direction.focalConcept ||
          fallback.userEditable ||
          '',
        designIntent:
          direction.designIntent ||
          fallback.designIntent ||
          'Distinct commercial cover direction grounded in the manuscript.',
        manuscriptEvidence: direction.manuscriptEvidence || '',
        commonMood:
          direction.commonMood ||
          fallback.commonMood ||
          'Professional retail book cover with strong visual hierarchy and marketable polish.',
        avoid:
          Array.isArray(direction.avoid) && direction.avoid.length
            ? direction.avoid
            : fallback.avoid || [],
        order: Number(direction.order || index + 1),
      };
    });

  while (cleaned.length < FINAL_VARIANT_COUNT) {
    const fallback = DEFAULT_DIRECTIONS[cleaned.length] || DEFAULT_DIRECTIONS[0];

    cleaned.push({
      ...fallback,
      id: `${fallback.id}-${makeNonce()}`,
    });
  }

  return cleaned;
}

function getDirectionSignature(direction = {}) {
  return normalizeText(
    [direction.label, direction.focalConcept, direction.userEditable, direction.designIntent].join(' | '),
    240
  ).toLowerCase();
}

function directionsLookTooSimilar(directions = []) {
  if (!Array.isArray(directions) || directions.length < FINAL_VARIANT_COUNT) return true;

  const labels = new Set();
  const signatures = new Set();
  const focals = new Set();

  directions.forEach((direction) => {
    labels.add(normalizeText(direction.label, 60).toLowerCase());
    signatures.add(getDirectionSignature(direction));
    if (direction.focalConcept) {
      focals.add(normalizeText(direction.focalConcept, 80).toLowerCase());
    }
  });

  if (labels.size < FINAL_VARIANT_COUNT) return true;
  if (signatures.size < FINAL_VARIANT_COUNT) return true;
  if (focals.size < Math.min(3, directions.length)) return true;

  return false;
}

function rotateBlueprints(pool, seed = 0) {
  if (!Array.isArray(pool) || !pool.length) return [];

  const rotated = [];
  const start = seed % pool.length;

  for (let i = 0; i < pool.length; i += 1) {
    rotated.push(pool[(start + i) % pool.length]);
  }

  return rotated;
}

function getBlueprintPool(mode = 'fiction') {
  return mode === 'nonfiction' ? NONFICTION_BLUEPRINTS : FICTION_BLUEPRINTS;
}

function chooseDistinctBlueprints({ project, rebuildVersion = 0, projectContext = '' }) {
  const mode = getProjectMode(project);
  const pool = getBlueprintPool(mode);
  const seed = (hashString(`${project?.id || ''}-${project?.title || ''}-${projectContext}`) + rebuildVersion) % pool.length;

  return rotateBlueprints(pool, seed).slice(0, FINAL_VARIANT_COUNT);
}

function buildCreativeDirective({ mode, rebuildVersion, previousDirections = [] }) {
  const pool = getBlueprintPool(mode);
  const archetypeList = pool.map((item) => item.label).join(', ');
  const previousSummary = serializeDirections(previousDirections);

  return [
    'Create four radically different, commercially strong cover directions.',
    'Do not give four slight variations of the same cover.',
    'Each direction must use a different visual strategy, composition family, and focal idea.',
    `Use distinct archetypes such as: ${archetypeList}.`,
    'Make every direction marketable, polished, retail-ready, and grounded in the manuscript/project context.',
    'When rebuilding, do NOT merely paraphrase the prior ideas. Replace them with genuinely fresh approaches.',
    `Rebuild iteration: ${rebuildVersion}.`,
    previousSummary ? `Previous direction set to avoid repeating:\n${previousSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildLocalDirectionPayload({
  project,
  projectContext,
  currentTitle,
  currentSubtitle,
  currentAuthorName,
  currentSeriesText,
  artDesc,
  previousDirections = [],
  rebuildVersion = 0,
}) {
  const mode = getProjectMode(project);
  const genre = `${project?.genre || ''} ${project?.subgenre || ''}`.trim();
  const defaults = getBasicGenreDefaults(genre);
  const blueprints = chooseDistinctBlueprints({ project, rebuildVersion, projectContext });
  const evidenceSnippets = sampleEvidenceSnippets(projectContext, 8);
  const keywordPool = uniqueArray([
    ...extractKeywords(projectContext, 14),
    ...extractKeywords(safeJoin([
      project?.seed_concept,
      project?.description,
      project?.mystery_md,
      project?.world_md,
      project?.outline_md,
      artDesc,
    ], ' '), 14),
  ]).slice(0, 12);

  const title = currentTitle || project?.title || 'Untitled';
  const subjectCandidates = uniqueArray([
    normalizeText(project?.seed_concept, 120),
    normalizeText(project?.core_conflict, 120),
    normalizeText(project?.tagline, 120),
    normalizeText(project?.description, 200),
    ...keywordPool.map((word) => word.replace(/(^\w)/, (c) => c.toUpperCase())),
  ]).filter(Boolean);

  const usedConcepts = new Set(
    previousDirections.map((item) => normalizeText(item?.focalConcept || item?.label, 80).toLowerCase())
  );

  const directions = blueprints.map((blueprint, index) => {
    const focus =
      subjectCandidates.find((candidate) => !usedConcepts.has(candidate.toLowerCase())) ||
      subjectCandidates[index % Math.max(1, subjectCandidates.length)] ||
      `${title} core hook`;

    usedConcepts.add(String(focus).toLowerCase());

    const evidence = evidenceSnippets[index] || evidenceSnippets[0] || normalizeText(project?.description, 180);
    const secondaryEvidence = evidenceSnippets[index + 1] || evidenceSnippets[(index + 2) % Math.max(1, evidenceSnippets.length)] || '';
    const supportingKeywords = keywordPool.slice(index * 2, index * 2 + 3);

    const uniquenessHint = [
      index === 0 && 'Do not make this direction look like a movie poster unless the manuscript truly calls for it.',
      index === 1 && 'Let this one feel archival / designed / texture-led rather than scene-led.',
      index === 2 && 'Let this one emphasize scale, distance, silhouette, or threshold tension.',
      index === 3 && 'Let this one feel editorial, premium, and different from the other three.',
    ].filter(Boolean).join(' ');

    return {
      id: `${blueprint.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${rebuildVersion}-${index + 1}-${makeNonce()}`,
      label: blueprint.label,
      focalConcept: focus,
      userEditable: [
        `Create a ${blueprint.label.toLowerCase()} cover direction for "${title}" centered on ${focus}.`,
        blueprint.angle,
        supportingKeywords.length
          ? `Fold in manuscript-specific cues such as ${supportingKeywords.join(', ')}.`
          : '',
        evidence ? `Ground the concept in evidence from the manuscript such as: ${evidence}` : '',
        secondaryEvidence ? `A second useful cue: ${secondaryEvidence}` : '',
        'This direction must feel dramatically different from the other three directions in this batch.',
        uniquenessHint,
      ]
        .filter(Boolean)
        .join(' '),
      designIntent: blueprint.designIntent,
      manuscriptEvidence: [evidence, secondaryEvidence].filter(Boolean).join(' / '),
      commonMood: blueprint.mood,
      avoid: [
        'fake signage',
        'extra readable words',
        'book mockup',
        'generic skyline',
        'cheap typography',
        'amateur flyer layout',
        'generic AI poster',
        'unrelated imagery',
      ],
      order: index + 1,
    };
  });

  const masterBrief = [
    artDesc || defaults.brief,
    mode === 'nonfiction'
      ? 'Design a premium nonfiction cover system that feels credible, fresh, and front-table ready.'
      : 'Design a premium fiction cover system with a clear commercial hook and strong retail shelf appeal.',
    'Produce four directions that are fundamentally different in visual strategy, not tiny variations of one idea.',
    currentSubtitle || project?.subtitle ? `Subtitle to render: ${currentSubtitle || project?.subtitle}.` : '',
    currentAuthorName || project?.author_name ? `Author name to render: ${currentAuthorName || project?.author_name}.` : '',
    currentSeriesText ? `Series/top line: ${currentSeriesText}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    masterBrief,
    style: defaults.style,
    mood: defaults.mood,
    directions,
    generatedByLlm: false,
    model: 'local-cover-directions-v3',
    nonce: makeNonce(),
  };
}

function hardenDirectionPayload(payload, localPayload, rebuildVersion = 0) {
  const normalized = normalizeDirections(payload?.directions);

  if (!directionsLookTooSimilar(normalized)) {
    return {
      ...payload,
      directions: normalized,
      nonce: payload?.nonce || makeNonce(),
    };
  }

  const localDirections = localPayload?.directions || DEFAULT_DIRECTIONS;

  const merged = normalized.map((direction, index) => {
    const fallback = localDirections[index] || DEFAULT_DIRECTIONS[index] || DEFAULT_DIRECTIONS[0];

    return {
      ...direction,
      id: direction.id || `${fallback.label}-${rebuildVersion}-${makeNonce()}`,
      label: fallback.label,
      focalConcept: direction.focalConcept || fallback.focalConcept,
      userEditable:
        direction.userEditable && direction.userEditable.length > 40
          ? `${direction.userEditable} This direction must remain visually distinct from the other three ideas.`
          : fallback.userEditable,
      designIntent: fallback.designIntent,
      manuscriptEvidence: direction.manuscriptEvidence || fallback.manuscriptEvidence,
      commonMood: fallback.commonMood,
      avoid: fallback.avoid,
      order: index + 1,
    };
  });

  return {
    ...payload,
    directions: merged,
    model: payload?.model ? `${payload.model} + diversity-hardened` : 'diversity-hardened-local-mix',
    nonce: payload?.nonce || makeNonce(),
  };
}

function readCachedDirectionPayload(projectId) {
  try {
    if (!projectId || typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(makeCacheKey(projectId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed || !Array.isArray(parsed?.directions)) return null;

    return {
      ...parsed,
      directions: normalizeDirections(parsed.directions),
    };
  } catch {
    return null;
  }
}

function writeCachedDirectionPayload(projectId, payload) {
  try {
    if (!projectId || typeof window === 'undefined') return;

    const trimmedHistory = Array.isArray(payload?.history)
      ? payload.history.slice(-REBUILD_HISTORY_LIMIT)
      : [];

    window.localStorage.setItem(
      makeCacheKey(projectId),
      JSON.stringify({
        ...payload,
        history: trimmedHistory,
        cachedAt: Date.now(),
      })
    );
  } catch {
    // ignore cache write failures
  }
}

async function sampleChaptersForCover(projectId) {
  if (!projectId) return '';

  try {
    const chapters = await base44.entities.Chapter.filter(
      { project_id: projectId },
      'chapter_number',
      100
    );

    const drafted = chapters.filter(
      (chapter) =>
        chapter.status === 'drafted' ||
        chapter.status === 'reviewed' ||
        chapter.content_md ||
        chapter.content_md_url
    );

    if (!drafted.length) return '';

    const picks = [
      drafted[0],
      drafted[Math.floor(drafted.length / 2)],
      drafted[drafted.length - 1],
    ].filter(Boolean);

    const resolved = await Promise.all(
      picks.map(async (chapter) => {
        try {
          const content = await resolveChapterContent(chapter);

          return content
            ? [
                `Chapter ${chapter.chapter_number}: ${chapter.title || 'Untitled'}`,
                normalizeMultilineText(content, 2600),
              ].join('\n')
            : '';
        } catch {
          return '';
        }
      })
    );

    return resolved.filter(Boolean).join('\n\n---\n\n');
  } catch (error) {
    console.warn('[COVER] Chapter sampling failed:', error?.message);
    return '';
  }
}

async function buildProjectContext(project) {
  if (!project) return '';

  const chapterSample = await sampleChaptersForCover(project.id);

  const fields = [
    ['Project Title', project.title],
    ['Subtitle', project.subtitle],
    ['Tagline', project.tagline],
    ['Genre', project.genre],
    ['Subgenre', project.subgenre],
    ['Seed Concept', project.seed_concept],
    ['Description', project.description],
    ['Mystery / Hook', project.mystery_md],
    ['World / Setting', project.world_md],
    ['Characters', project.characters_md],
    ['Outline', project.outline_md],
    ['Voice / Style', project.voice_md],
    ['Project Brief', project.project_brief],
    ['Core Conflict', project.core_conflict],
    ['Setting Notes', project.setting_notes],
    ['Character Notes', project.character_notes],
    ['Author Voice', project.author_voice],
    ['Continuity Bible', project.continuity_bible],
    ['Sampled Chapters', chapterSample],
  ];

  return fields
    .map(([label, value]) => {
      const cleaned =
        label === 'Sampled Chapters'
          ? normalizeMultilineText(value, 9500)
          : normalizeMultilineText(value, 2500);
      return cleaned ? `${label}:\n${cleaned}` : '';
    })
    .filter(Boolean)
    .join('\n\n---\n\n')
    .slice(0, 19000);
}

async function generateCoverDirectionPayload({
  project,
  currentTitle,
  currentSubtitle,
  currentAuthorName,
  currentSeriesText,
  artDesc,
  directions,
  setStatusText,
  rebuildVersion = 0,
  mode = 'extract',
}) {
  const nonce = makeNonce();
  const genre = `${project?.genre || ''}`.trim();
  const subgenre = `${project?.subgenre || ''}`.trim();
  const projectMode = getProjectMode(project);

  setStatusText?.('Reading manuscript/project context…');
  const projectContext = await buildProjectContext(project);

  const localPayload = buildLocalDirectionPayload({
    project,
    projectContext,
    currentTitle,
    currentSubtitle,
    currentAuthorName,
    currentSeriesText,
    artDesc,
    previousDirections: directions,
    rebuildVersion,
  });

  setStatusText?.(
    mode === 'rebuild'
      ? 'Rebuilding four fresh cover directions…'
      : 'Generating fresh manuscript-grounded cover directions…'
  );

  try {
    const response = await base44.functions.invoke('generateCoverDirections', {
      title: currentTitle || project?.title || '',
      subtitle: currentSubtitle || project?.subtitle || '',
      authorName: currentAuthorName || project?.author_name || '',
      seriesText: currentSeriesText || '',
      genre,
      subgenre,
      projectContext,
      artDesc,
      previousDirections: serializeDirections(directions),
      creativeDirective: buildCreativeDirective({
        mode: projectMode,
        rebuildVersion,
        previousDirections: directions,
      }),
      rebuildIteration: rebuildVersion,
      rebuildMode: mode,
      rebuildNonce: nonce,
    });

    const data = response?.data || response;

    if (data?.error) {
      throw new Error(data.error);
    }

    const defaults = getBasicGenreDefaults(`${genre} ${subgenre}`);

    const rawPayload = {
      masterBrief:
        data?.masterBrief ||
        data?.description ||
        artDesc ||
        localPayload.masterBrief ||
        defaults.brief,
      style: data?.style || localPayload.style || defaults.style,
      mood: data?.mood || localPayload.mood || defaults.mood,
      directions: normalizeDirections(data?.directions),
      generatedByLlm: !!data?.generated_by_llm,
      model: data?.model || 'generateCoverDirections',
      nonce: data?.rebuild_nonce || nonce,
    };

    return hardenDirectionPayload(rawPayload, localPayload, rebuildVersion);
  } catch (error) {
    console.warn('[COVER] generateCoverDirections fallback:', error?.message);

    return {
      ...localPayload,
      model:
        error?.message?.includes('429') || error?.message?.toLowerCase?.().includes('rate')
          ? 'local-cover-directions-v3 (429 fallback)'
          : 'local-cover-directions-v3 (error fallback)',
      nonce,
    };
  }
}

async function generateNativeCover({
  title,
  subtitle,
  authorName,
  seriesText,
  genre,
  masterBrief,
  direction,
  artStyle,
  colorMood,
}) {
  const response = await base44.functions.invoke('generateNativeCover', {
    title,
    subtitle,
    authorName,
    seriesText,
    genre,
    directionLabel: direction.label,
    directionBrief: [
      direction.userEditable || direction.focalConcept,
      direction.designIntent,
      direction.manuscriptEvidence
        ? `Manuscript evidence: ${direction.manuscriptEvidence}`
        : '',
      `Mood/design posture: ${direction.commonMood}`,
      `Avoid: ${(direction.avoid || []).join(', ')}`,
      `Freshness nonce: ${makeNonce()}`,
    ]
      .filter(Boolean)
      .join('\n'),
    masterBrief,
    artStyle,
    colorMood,
    size: '1024x1536',
    quality: 'high',
  });

  const data = response?.data || response;

  const url = data?.data_url || data?.url || data?.image_url;

  if (!url || typeof url !== 'string') {
    throw new Error(data?.error || `No image returned for ${direction.label}`);
  }

  return {
    finalUrl: url,
    artUrl: url,
    direction,
    directionLabel: direction.label,
    score: direction.order || 999,
    layout: {
      nativeCover: true,
      model: data?.model,
    },
  };
}

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function getImageExtensionFromDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/([^;]+);base64,/i);
  const ext = (match?.[1] || 'png').toLowerCase();

  if (ext === 'jpeg') return 'jpg';
  if (ext === 'svg+xml') return 'svg';

  return ext;
}

async function dataUrlToFile(dataUrl, filenameBase = 'cover-art') {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const ext = getImageExtensionFromDataUrl(dataUrl);
  const type = blob.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  return new File([blob], `${filenameBase}.${ext}`, { type });
}

async function persistImageUrlForGallery({ imageUrl, projectId, index }) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('No image URL available to save.');
  }

  if (isDataUrl(imageUrl)) {
    const file = await dataUrlToFile(
      imageUrl,
      `cover-${projectId || 'project'}-${index + 1}-${Date.now()}`
    );

    const uploadResult = await bypassUploadFile({ file });
    const uploadedUrl =
      uploadResult?.file_url ||
      uploadResult?.data?.file_url ||
      uploadResult?.url ||
      uploadResult;

    if (!uploadedUrl || typeof uploadedUrl !== 'string') {
      throw new Error('Image upload returned no usable file URL.');
    }

    return uploadedUrl;
  }

  return imageUrl;
}

async function saveToGallery({ projectId, cover, index }) {
  if (!projectId || !cover?.finalUrl) return null;

  const imageUrl = await persistImageUrlForGallery({
    imageUrl: cover.finalUrl,
    projectId,
    index,
  });

  const record = await base44.entities.CoverArtGallery.create({
    project_id: projectId,
    image_url: imageUrl,
    prompt_summary: `${cover.directionLabel || 'Native Cover'} #${index + 1}`,
  });

  return {
    record,
    imageUrl,
  };
}

function ChipSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
            value === opt
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background/60 text-muted-foreground hover:bg-muted'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function CoverArtGenerator({ project, onSelectArt, selectedArtUrl }) {
  const [artDesc, setArtDesc] = useState('');
  const [coverTitle, setCoverTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [seriesText, setSeriesText] = useState('');
  const [artStyle, setArtStyle] = useState('Photorealistic');
  const [colorMood, setColorMood] = useState('Muted');
  const [directions, setDirections] = useState(DEFAULT_DIRECTIONS);
  const [variants, setVariants] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [makeForMeRunning, setMakeForMeRunning] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [directionModel, setDirectionModel] = useState('');
  const [lastProjectId, setLastProjectId] = useState('');
  const [rebuildVersion, setRebuildVersion] = useState(0);

  // ── Advanced Local Generation Panel State ──
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [comfyUrl, setComfyUrl] = useState(getComfyUIDisplayUrl);
  const [comfyStatus, setComfyStatus] = useState(null); // null | 'checking' | 'connected' | 'error'
  const [comfyError, setComfyError] = useState('');
  const [advModelPipeline, setAdvModelPipeline] = useState('flux');
  const [advGenreTemplate, setAdvGenreTemplate] = useState('');
  const [advSizePreset, setAdvSizePreset] = useState('ebook_portrait');
  const [advTypographyMode, setAdvTypographyMode] = useState('image_only');
  const [advPositivePrompt, setAdvPositivePrompt] = useState('');
  const [advNegativePrompt, setAdvNegativePrompt] = useState('');
  const [advLighting, setAdvLighting] = useState('');
  const [advPalette, setAdvPalette] = useState('');
  const [advSeed, setAdvSeed] = useState(-1);
  const [advSteps, setAdvSteps] = useState(20);
  const [advGuidanceCfg, setAdvGuidanceCfg] = useState(3.5);
  const [advFluxCheckpoint, setAdvFluxCheckpoint] = useState(() => {
    try { return localStorage.getItem('ubs_flux_checkpoint') || FLUX_CHECKPOINT_NAME; } catch { return FLUX_CHECKPOINT_NAME; }
  });
  const [advPonyCheckpoint, setAdvPonyCheckpoint] = useState(() => {
    try { return localStorage.getItem('ubs_pony_checkpoint') || PONYXL_CHECKPOINT_NAME; } catch { return PONYXL_CHECKPOINT_NAME; }
  });
  const [advGenerating, setAdvGenerating] = useState(false);
  const [advStatusText, setAdvStatusText] = useState('');

  // ── Typography Compositor State ──
  const [typoOpen, setTypoOpen] = useState(false);
  const [typoSettings, setTypoSettings] = useState(() => ({
    ...DEFAULT_TYPOGRAPHY_SETTINGS,
    titleText: project?.title || '',
    authorText: project?.author_name || '',
  }));
  const [typoPreview, setTypoPreview] = useState(null);
  const [showGuides, setShowGuides] = useState(false);

  // ── Export State ──
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPreset, setExportPreset] = useState('ebook');
  const [exportFormat, setExportFormat] = useState('png');
  const [exporting, setExporting] = useState(false);

  // ── Variations State ──
  const [variationsOpen, setVariationsOpen] = useState(false);
  const [coverVariations, setCoverVariations] = useState([]);
  const [activeVariationId, setActiveVariationId] = useState(null);
  const [variationName, setVariationName] = useState('');

  // ── Series Consistency State ──
  const [seriesLockOpen, setSeriesLockOpen] = useState(false);
  const [seriesSignature, setSeriesSignature] = useState(null);
  const [seriesLockEnabled, setSeriesLockEnabled] = useState(false);
  const [seriesConsistencyReport, setSeriesConsistencyReport] = useState(null);

  const fileInputRef = useRef(null);
  const lastActionAtRef = useRef(0);
  const directionHistoryRef = useRef([]);
  const queryClient = useQueryClient();

  const genre = `${project?.genre || ''} ${project?.subgenre || ''}`.trim();
  const projectMode = useMemo(() => getProjectMode(project), [project]);

  useEffect(() => {
    console.info('[COVER-ART-GENERATOR] Loaded CoverArtGenerator-v4-parallel-native-cover-generation');
  }, []);

  useEffect(() => {
    if (!project?.id) return;

    if (lastProjectId && lastProjectId !== project.id) {
      setVariants([]);
      setDirections(DEFAULT_DIRECTIONS);
      setDirectionModel('');
      setRebuildVersion(0);
      directionHistoryRef.current = [];
    }

    setLastProjectId(project.id);

    const cached = readCachedDirectionPayload(project.id);

    if (cached?.directions?.length) {
      setDirections(normalizeDirections(cached.directions));
      setDirectionModel(cached.model || '');
      if (cached.masterBrief && !artDesc) setArtDesc(cached.masterBrief);
      if (cached.style) setArtStyle(cached.style);
      if (cached.mood) setColorMood(cached.mood);
      if (typeof cached.rebuildVersion === 'number') setRebuildVersion(cached.rebuildVersion);
      if (Array.isArray(cached.history)) {
        directionHistoryRef.current = cached.history.slice(-REBUILD_HISTORY_LIMIT);
      }
    }

    if (!coverTitle && project?.title) setCoverTitle(project.title);
    if (!subtitle && project?.subtitle) setSubtitle(project.subtitle);
    if (!authorName && project?.author_name) setAuthorName(project.author_name);

    if (!artDesc) {
      const defaults = getBasicGenreDefaults(genre);
      setArtDesc(defaults.brief);
      setArtStyle(defaults.style);
      setColorMood(defaults.mood);
    }
  }, [
    project?.id,
    project?.title,
    project?.subtitle,
    project?.author_name,
    genre,
    coverTitle,
    subtitle,
    authorName,
    artDesc,
    lastProjectId,
  ]);

  const { data: galleryItems = [] } = useQuery({
    queryKey: ['cover-gallery', project?.id],
    queryFn: () =>
      base44.entities.CoverArtGallery.filter(
        { project_id: project?.id },
        '-created_date',
        50
      ),
    enabled: !!project?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const updateDirectionText = (index, value) => {
    setDirections((current) =>
      current.map((direction, i) =>
        i === index
          ? {
              ...direction,
              userEditable: value,
            }
          : direction
      )
    );
  };

  const persistDirectionCache = (payload, nextRebuildVersion) => {
    if (!project?.id || !payload) return;

    const historyEntry = {
      nonce: payload.nonce || makeNonce(),
      at: Date.now(),
      directions: normalizeDirections(payload.directions),
    };

    directionHistoryRef.current = [...directionHistoryRef.current, historyEntry].slice(
      -REBUILD_HISTORY_LIMIT
    );

    writeCachedDirectionPayload(project.id, {
      masterBrief: payload.masterBrief,
      style: payload.style,
      mood: payload.mood,
      directions: normalizeDirections(payload.directions),
      model: payload.model,
      rebuildVersion: nextRebuildVersion,
      history: directionHistoryRef.current,
    });
  };

  const applyDirectionPayload = (payload, nextRebuildVersion = rebuildVersion) => {
    setArtDesc(payload.masterBrief);
    setArtStyle(payload.style);
    setColorMood(payload.mood);
    setDirections(normalizeDirections(payload.directions));
    setDirectionModel(payload.model || '');
    persistDirectionCache(payload, nextRebuildVersion);
  };

  const enforceCooldown = () => {
    const now = Date.now();
    const delta = now - lastActionAtRef.current;

    if (delta < REBUILD_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((REBUILD_COOLDOWN_MS - delta) / 1000);
      throw new Error(`Please wait ${waitSeconds}s before requesting another rebuild.`);
    }

    lastActionAtRef.current = now;
  };

  const handleExtractIdea = async () => {
    if (!project) {
      toast.error('Load a project first');
      return;
    }

    setGenerating(true);
    setVariants([]);

    try {
      enforceCooldown();
      const nextVersion = rebuildVersion + 1;

      const payload = await generateCoverDirectionPayload({
        project,
        currentTitle: coverTitle,
        currentSubtitle: subtitle,
        currentAuthorName: authorName,
        currentSeriesText: seriesText,
        artDesc: '',
        directions: directionsLookTooSimilar(directions) ? [] : directions,
        setStatusText,
        rebuildVersion: nextVersion,
        mode: 'extract',
      });

      applyDirectionPayload(payload, nextVersion);
      setRebuildVersion(nextVersion);
      toast.success(
        payload.generatedByLlm
          ? 'Fresh manuscript-grounded directions generated'
          : 'Fresh creative directions generated with local fallback'
      );
    } catch (error) {
      toast.error('Could not extract cover idea: ' + (error?.message || 'unknown'));
    } finally {
      setGenerating(false);
      setStatusText('');
    }
  };

  const regenerateDirectionsFromCurrentBrief = async () => {
    if (!project) {
      toast.error('Load a project first');
      return;
    }

    setRebuilding(true);
    setVariants([]);

    try {
      enforceCooldown();
      const nextVersion = rebuildVersion + 1;

      const payload = await generateCoverDirectionPayload({
        project,
        currentTitle: coverTitle,
        currentSubtitle: subtitle,
        currentAuthorName: authorName,
        currentSeriesText: seriesText,
        artDesc,
        directions,
        setStatusText,
        rebuildVersion: nextVersion,
        mode: 'rebuild',
      });

      applyDirectionPayload(payload, nextVersion);
      setRebuildVersion(nextVersion);
      toast.success(
        payload.generatedByLlm
          ? 'Four genuinely fresh cover directions rebuilt'
          : 'Cover directions rebuilt with local creative fallback'
      );
    } catch (error) {
      toast.error('Rebuild failed: ' + (error?.message || 'unknown'));
    } finally {
      setRebuilding(false);
      setStatusText('');
    }
  };

  const runNativeCoverPipeline = async ({ description, style, mood, directionSet }) => {
    if (!coverTitle.trim()) throw new Error('Title is required.');
    if (!authorName.trim()) throw new Error('Author name is required.');

    const activeDirections =
      Array.isArray(directionSet) && directionSet.length
        ? directionSet.slice(0, FINAL_VARIANT_COUNT)
        : DEFAULT_DIRECTIONS.slice(0, FINAL_VARIANT_COUNT);

    const MAX_PARALLEL_NATIVE_COVERS = 2;
    const MAX_ATTEMPTS_PER_COVER = 2;
    const resultsByIndex = new Array(activeDirections.length).fill(null);
    const failedLabels = [];
    let nextIndex = 0;
    let completedCount = 0;

    const publishVisibleResults = () => {
      const visible = resultsByIndex.filter(Boolean);
      setVariants(visible);
      return visible;
    };

    const generateOneCoverWithRetry = async (direction, index) => {
      let lastError = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_COVER; attempt += 1) {
        try {
          setStatusText(
            `Generating cover ${index + 1}/${activeDirections.length}: ${direction.label}${
              attempt > 1 ? ' (retry)' : ''
            }…`
          );

          const cover = await generateNativeCover({
            title: coverTitle.trim(),
            subtitle: subtitle.trim(),
            authorName: authorName.trim(),
            seriesText: seriesText.trim(),
            genre,
            masterBrief: description,
            direction,
            artStyle: style,
            colorMood: mood,
          });

          let finalizedCover = cover;

          if (project?.id) {
            try {
              setStatusText(`Saving cover ${index + 1}/${activeDirections.length} to gallery…`);

              const saved = await saveToGallery({
                projectId: project.id,
                cover,
                index,
              });

              if (saved?.imageUrl) {
                finalizedCover = {
                  ...cover,
                  finalUrl: saved.imageUrl,
                  artUrl: saved.imageUrl,
                  persistedGalleryId: saved.record?.id,
                };
              }
            } catch (saveError) {
              console.warn('[COVER] Gallery save failed:', saveError?.message);
              toast.warning(
                `${cover.directionLabel || `Cover #${index + 1}`} generated but did not save to gallery.`
              );
            }
          }

          return finalizedCover;
        } catch (error) {
          lastError = error;
          console.error(
            `[COVER] ${direction.label} failed on attempt ${attempt}/${MAX_ATTEMPTS_PER_COVER}:`,
            error?.message
          );
        }
      }

      throw lastError || new Error(`${direction.label} failed.`);
    };

    const runWorker = async () => {
      while (nextIndex < activeDirections.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        const direction = activeDirections[currentIndex];

        try {
          const cover = await generateOneCoverWithRetry(direction, currentIndex);
          resultsByIndex[currentIndex] = cover;
          completedCount += 1;
          publishVisibleResults();
          setStatusText(
            `Generated ${completedCount}/${activeDirections.length} covers. Continuing remaining covers…`
          );
        } catch (error) {
          failedLabels.push(direction?.label || `Cover #${currentIndex + 1}`);
          console.error(`[COVER] ${direction?.label || currentIndex + 1} failed permanently:`, error?.message);
          toast.warning(
            `${direction?.label || `Cover #${currentIndex + 1}`} failed after retry: ${
              error?.message || 'unknown error'
            }`
          );
        }
      }
    };

    setStatusText(
      `Generating ${activeDirections.length} native covers, ${Math.min(
        MAX_PARALLEL_NATIVE_COVERS,
        activeDirections.length
      )} at a time…`
    );

    const workerCount = Math.min(MAX_PARALLEL_NATIVE_COVERS, activeDirections.length);
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    const finalResults = publishVisibleResults();

    if (!finalResults.length) {
      throw new Error(
        failedLabels.length
          ? `All native cover directions failed: ${failedLabels.join(', ')}.`
          : 'All native cover directions failed.'
      );
    }

    if (project?.id) {
      await queryClient.invalidateQueries({ queryKey: ['cover-gallery', project.id] });
      await queryClient.refetchQueries({ queryKey: ['cover-gallery', project.id] });
    }

    if (failedLabels.length) {
      toast.warning(`${failedLabels.length} cover direction(s) failed, but the successful covers were saved.`);
    }

    return finalResults;
  };

  const handleGenerate = async () => {
    const description =
      artDesc.trim() ||
      `Create a professional finished retail book cover for "${
        coverTitle || project?.title || 'Untitled'
      }" with four different story-faithful visual interpretations.`;

    setGenerating(true);
    setVariants([]);

    try {
      await runNativeCoverPipeline({
        description,
        style: artStyle,
        mood: colorMood,
        directionSet: directions,
      });

      toast.success('Native finished covers generated and saved. Pick one manually.');
    } catch (error) {
      toast.error('Generation failed: ' + (error?.message || 'unknown'));
    } finally {
      setGenerating(false);
      setStatusText('');
    }
  };

  const handleMakeForMe = async () => {
    if (!project) {
      toast.error('Load a project first');
      return;
    }

    setMakeForMeRunning(true);
    setVariants([]);

    try {
      enforceCooldown();
      const nextVersion = rebuildVersion + 1;

      const payload = await generateCoverDirectionPayload({
        project,
        currentTitle: coverTitle,
        currentSubtitle: subtitle,
        currentAuthorName: authorName,
        currentSeriesText: seriesText,
        artDesc: '',
        directions: [],
        setStatusText,
        rebuildVersion: nextVersion,
        mode: 'extract',
      });

      applyDirectionPayload(payload, nextVersion);
      setRebuildVersion(nextVersion);

      await runNativeCoverPipeline({
        description: payload.masterBrief,
        style: payload.style,
        mood: payload.mood,
        directionSet: payload.directions,
      });

      toast.success('Fresh native finished covers generated and saved. Pick one manually.');
    } catch (error) {
      toast.error('Make for Me failed: ' + (error?.message || 'unknown'));
    } finally {
      setMakeForMeRunning(false);
      setStatusText('');
    }
  };

  const handleUploadImage = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);

    try {
      const uploadResult = await bypassUploadFile({ file });
      const imageUrl = uploadResult?.file_url || uploadResult?.data?.file_url || uploadResult;

      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('Upload returned no usable URL.');
      }

      const cover = {
        finalUrl: imageUrl,
        artUrl: imageUrl,
        score: 999,
        directionLabel: 'Uploaded Art',
        layout: {
          nativeCover: false,
          uploaded: true,
        },
      };

      let persistedCover = cover;

      if (project?.id) {
        try {
          const saved = await saveToGallery({
            projectId: project.id,
            cover,
            index: 0,
          });

          if (saved?.imageUrl) {
            persistedCover = {
              ...cover,
              finalUrl: saved.imageUrl,
              artUrl: saved.imageUrl,
              persistedGalleryId: saved.record?.id,
            };
          }

          await queryClient.invalidateQueries({ queryKey: ['cover-gallery', project.id] });
          await queryClient.refetchQueries({ queryKey: ['cover-gallery', project.id] });
        } catch (galleryError) {
          console.warn('[COVER] Uploaded image gallery save failed:', galleryError?.message);
          toast.warning('Uploaded image is available now, but it did not save to the gallery.');
        }
      }

      setVariants([persistedCover]);
      toast.success('Uploaded art added and saved. Pick it manually.');
    } catch (error) {
      toast.error('Upload failed: ' + (error?.message || 'unknown'));
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const isBusy = generating || makeForMeRunning || uploading || rebuilding || advGenerating;

  // ── Advanced Panel Handlers ──

  const handleTestComfyConnection = useCallback(async () => {
    setComfyStatus('checking');
    setComfyError('');
    try {
      setComfyUIBaseUrl(comfyUrl);
      const result = await checkComfyUIStatus({ timeoutMs: 8000 });
      if (result.healthy) {
        setComfyStatus('connected');
        toast.success(`ComfyUI connected${result.gpuName ? ` (${result.gpuName})` : ''}`);
      } else {
        setComfyStatus('error');
        setComfyError(result.error || 'Connection failed');
        toast.error(`ComfyUI: ${result.error || 'Connection failed'}`);
      }
    } catch (err) {
      setComfyStatus('error');
      const msg = normalizeComfyUIError(err);
      setComfyError(msg);
      toast.error(msg);
    }
  }, [comfyUrl]);

  const handleAutoBuildPrompt = useCallback(() => {
    if (!project) { toast.error('Load a project first'); return; }
    const settings = {
      modelPipeline: advModelPipeline,
      typographyMode: advTypographyMode,
      coverTitle: coverTitle || project?.title,
      authorName: authorName || project?.author_name,
      lighting: advLighting || undefined,
      palette: advPalette || undefined,
      genreTemplateId: advGenreTemplate || undefined,
    };
    const result = buildCoverPrompt(project, settings);
    setAdvPositivePrompt(result.positive);
    setAdvNegativePrompt(result.negative);
    toast.success('Prompt built from project metadata');
  }, [project, advModelPipeline, advTypographyMode, coverTitle, authorName, advLighting, advPalette, advGenreTemplate]);

  const handleAdvancedGenerate = useCallback(async () => {
    if (!advPositivePrompt.trim()) { toast.error('Prompt is required'); return; }

    const checkpoint = advModelPipeline === 'flux' ? advFluxCheckpoint : advPonyCheckpoint;
    if (!checkpoint || checkpoint === 'REPLACE_WITH_LOCAL_FLUX_CHECKPOINT') {
      toast.error('Configure a valid checkpoint name first');
      return;
    }

    setAdvGenerating(true);
    setAdvStatusText('Connecting to ComfyUI…');

    try {
      const dims = getCoverDimensionsForPreset(advSizePreset);
      const seed = advSeed === -1 ? Math.floor(Math.random() * 2 ** 32) : advSeed;

      setAdvStatusText(`Generating ${advModelPipeline.toUpperCase()} cover (${dims.width}×${dims.height})…`);

      const response = await base44.functions.invoke('generateNativeCover', {
        modelPipeline: advModelPipeline,
        positivePrompt: advPositivePrompt,
        negativePrompt: advNegativePrompt,
        checkpoint,
        sizePreset: advSizePreset,
        seed,
        steps: advSteps,
        cfg: advModelPipeline === 'ponyxl' ? advGuidanceCfg : undefined,
        guidance: advModelPipeline === 'flux' ? advGuidanceCfg : undefined,
      });

      const data = response?.data || response;
      const url = data?.data_url || data?.url || data?.image_url;

      if (!url) throw new Error('No image returned from ComfyUI');

      const cover = {
        finalUrl: url,
        artUrl: url,
        directionLabel: `${advModelPipeline.toUpperCase()} Advanced`,
        score: 1,
        layout: {
          nativeCover: true,
          model: advModelPipeline,
          seed,
          steps: advSteps,
          guidance_cfg: advGuidanceCfg,
          width: dims.width,
          height: dims.height,
          checkpoint,
          typographyMode: advTypographyMode,
          genreTemplate: advGenreTemplate,
          promptId: data?.promptId,
        },
      };

      // Save to gallery
      if (project?.id) {
        try {
          setAdvStatusText('Saving to gallery…');
          const saved = await saveToGallery({ projectId: project.id, cover, index: 0 });
          if (saved?.imageUrl) {
            cover.finalUrl = saved.imageUrl;
            cover.artUrl = saved.imageUrl;
            cover.persistedGalleryId = saved.record?.id;
          }
          await queryClient.invalidateQueries({ queryKey: ['cover-gallery', project.id] });
          await queryClient.refetchQueries({ queryKey: ['cover-gallery', project.id] });
        } catch (saveErr) {
          console.warn('[COVER-ADV] Gallery save failed:', saveErr?.message);
        }
      }

      setVariants(prev => [cover, ...prev]);
      toast.success(`${advModelPipeline.toUpperCase()} cover generated and saved`);
    } catch (err) {
      const msg = normalizeComfyUIError(err);
      toast.error(`Generation failed: ${msg}`);
    } finally {
      setAdvGenerating(false);
      setAdvStatusText('');
    }
  }, [advPositivePrompt, advNegativePrompt, advModelPipeline, advFluxCheckpoint, advPonyCheckpoint, advSizePreset, advSeed, advSteps, advGuidanceCfg, advTypographyMode, advGenreTemplate, project, queryClient]);

  const handleSaveCheckpoints = useCallback(() => {
    try {
      localStorage.setItem('ubs_flux_checkpoint', advFluxCheckpoint);
      localStorage.setItem('ubs_pony_checkpoint', advPonyCheckpoint);
      toast.success('Checkpoint names saved');
    } catch { toast.error('Could not save checkpoint names'); }
  }, [advFluxCheckpoint, advPonyCheckpoint]);

  // Sync recommended pipeline when genre template changes
  useEffect(() => {
    if (advGenreTemplate) {
      const template = getGenreCoverTemplate(advGenreTemplate);
      if (template?.recommendedPipeline) {
        setAdvModelPipeline(template.recommendedPipeline);
        setAdvLighting(template.lighting || '');
        setAdvPalette(template.palette || '');
      }
    }
  }, [advGenreTemplate]);

  // Sync default steps/guidance when pipeline changes
  useEffect(() => {
    const defaults = getDefaultCoverSettingsForModel(advModelPipeline);
    setAdvSteps(defaults.steps);
    setAdvGuidanceCfg(defaults.guidance || defaults.cfg || 3.5);
  }, [advModelPipeline]);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Cover Art Studio
        </p>
        <p className="text-xs text-muted-foreground">
          Generate finished retail-style covers locally via ComfyUI or through cloud services.
          Phase 1 directions force four genuinely different cover strategies.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ADVANCED LOCAL GENERATION PANEL
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-primary/20 bg-primary/5">
        <button
          type="button"
          onClick={() => setAdvancedOpen(o => !o)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Settings2 className="h-4 w-4 text-primary" />
            Advanced Local Generation (ComfyUI)
          </span>
          {advancedOpen
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>

        {advancedOpen && (
          <div className="space-y-4 border-t border-primary/10 px-4 pb-4 pt-3">

            {/* ── ComfyUI Connection ── */}
            <div className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                ComfyUI Connection
              </p>
              <div className="flex gap-2">
                <input
                  id="comfy-url-input"
                  type="text"
                  value={comfyUrl}
                  onChange={e => setComfyUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8188"
                  className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  id="test-comfy-connection"
                  size="sm"
                  variant="outline"
                  onClick={handleTestComfyConnection}
                  disabled={comfyStatus === 'checking'}
                  className="h-8 gap-1 rounded-lg px-3 text-[10px]"
                >
                  {comfyStatus === 'checking' ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Testing…</>
                  ) : comfyStatus === 'connected' ? (
                    <><Wifi className="h-3 w-3 text-green-500" /> Connected</>
                  ) : comfyStatus === 'error' ? (
                    <><WifiOff className="h-3 w-3 text-red-500" /> Retry</>
                  ) : (
                    <><Wifi className="h-3 w-3" /> Test Connection</>
                  )}
                </Button>
              </div>
              {comfyError && (
                <p className="text-[10px] text-red-500">{comfyError}</p>
              )}
            </div>

            {/* ── Model & Template Selectors ── */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Model Pipeline</label>
                <select
                  id="model-pipeline-selector"
                  value={advModelPipeline}
                  onChange={e => setAdvModelPipeline(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {Object.values(COVER_MODEL_PIPELINES).map(p => (
                    <option key={p.id} value={p.id}>{p.label} — {p.description}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Genre Template</label>
                <select
                  id="genre-template-selector"
                  value={advGenreTemplate}
                  onChange={e => setAdvGenreTemplate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Auto-detect from project</option>
                  {getAllGenreCoverTemplates().map(t => (
                    <option key={t.id} value={t.id}>{t.label} ({t.recommendedPipeline})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Size Preset</label>
                <select
                  id="size-preset-selector"
                  value={advSizePreset}
                  onChange={e => setAdvSizePreset(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {Object.entries(COVER_SIZE_PRESETS).filter(([k]) => k !== 'custom').map(([k, v]) => (
                    <option key={k} value={k}>{v.label} ({v.width}×{v.height})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Typography Mode</label>
                <select
                  id="typography-mode-selector"
                  value={advTypographyMode}
                  onChange={e => setAdvTypographyMode(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {Object.values(COVER_TYPOGRAPHY_MODES).map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Lighting & Palette ── */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Lighting</label>
                <input
                  id="lighting-field"
                  type="text"
                  value={advLighting}
                  onChange={e => setAdvLighting(e.target.value)}
                  placeholder="e.g. harsh cold fluorescent overhead light"
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Color Palette</label>
                <input
                  id="palette-field"
                  type="text"
                  value={advPalette}
                  onChange={e => setAdvPalette(e.target.value)}
                  placeholder="e.g. steel-blue, ash-white, charcoal"
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {/* ── Prompt Fields ── */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Positive Prompt</label>
                <div className="flex gap-1">
                  <Button
                    id="auto-build-prompt"
                    size="sm" variant="ghost"
                    onClick={handleAutoBuildPrompt}
                    disabled={!project}
                    className="h-6 gap-1 rounded-full px-2 text-[10px]"
                  >
                    <Zap className="h-3 w-3" /> Auto-Build
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => { navigator.clipboard.writeText(advPositivePrompt); toast.success('Prompt copied'); }}
                    className="h-6 gap-1 rounded-full px-2 text-[10px]"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                </div>
              </div>
              <Textarea
                id="adv-positive-prompt"
                value={advPositivePrompt}
                onChange={e => setAdvPositivePrompt(e.target.value)}
                placeholder="Click Auto-Build to generate from project metadata, or type your prompt here…"
                className="min-h-[120px] text-xs font-mono"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Negative Prompt</label>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { navigator.clipboard.writeText(advNegativePrompt); toast.success('Negative copied'); }}
                  className="h-6 gap-1 rounded-full px-2 text-[10px]"
                >
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              </div>
              <Textarea
                id="adv-negative-prompt"
                value={advNegativePrompt}
                onChange={e => setAdvNegativePrompt(e.target.value)}
                placeholder="Negative prompt (auto-built with prompt)…"
                className="min-h-[60px] text-xs font-mono"
              />
            </div>

            {/* ── Seed / Steps / Guidance ── */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Seed</label>
                <div className="flex gap-1">
                  <input
                    id="seed-field"
                    type="number"
                    value={advSeed}
                    onChange={e => setAdvSeed(parseInt(e.target.value, 10) || -1)}
                    className="w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button
                    id="randomize-seed"
                    size="sm" variant="ghost"
                    onClick={() => setAdvSeed(-1)}
                    className="h-8 px-2"
                    title="Randomize"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">-1 = random</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Steps</label>
                <input
                  id="steps-field"
                  type="number"
                  min={1} max={150}
                  value={advSteps}
                  onChange={e => setAdvSteps(parseInt(e.target.value, 10) || 20)}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  {advModelPipeline === 'flux' ? 'Guidance' : 'CFG'}
                </label>
                <input
                  id="guidance-cfg-field"
                  type="number"
                  min={0} max={30} step={0.5}
                  value={advGuidanceCfg}
                  onChange={e => setAdvGuidanceCfg(parseFloat(e.target.value) || 3.5)}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {/* ── Checkpoint Configuration ── */}
            <div className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Checkpoint Configuration
              </p>
              <p className="text-[10px] text-muted-foreground">
                Names must match your local ComfyUI checkpoint filenames exactly.
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-medium text-foreground">Flux Checkpoint</label>
                  <input
                    id="flux-checkpoint-name"
                    type="text"
                    value={advFluxCheckpoint}
                    onChange={e => setAdvFluxCheckpoint(e.target.value)}
                    placeholder="your-flux-model.safetensors"
                    className="w-full rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-medium text-foreground">PonyXL Checkpoint</label>
                  <input
                    id="ponyxl-checkpoint-name"
                    type="text"
                    value={advPonyCheckpoint}
                    onChange={e => setAdvPonyCheckpoint(e.target.value)}
                    placeholder="cyberrealisticPony_v180Coreshift.safetensors"
                    className="w-full rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <Button
                id="save-checkpoints"
                size="sm" variant="outline"
                onClick={handleSaveCheckpoints}
                className="h-7 rounded-full px-3 text-[10px]"
              >
                Save Checkpoint Names
              </Button>
            </div>

            {/* ── Status & Generate ── */}
            {advStatusText && (
              <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {advStatusText}
              </div>
            )}

            <Button
              id="generate-with-comfyui"
              onClick={handleAdvancedGenerate}
              disabled={isBusy || !advPositivePrompt.trim()}
              className="min-h-10 w-full rounded-full"
            >
              {advGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating with {advModelPipeline.toUpperCase()}…</>
              ) : (
                <><Zap className="mr-2 h-4 w-4" /> Generate with ComfyUI ({advModelPipeline.toUpperCase()})</>
              )}
            </Button>

          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TYPOGRAPHY COMPOSITOR
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg border border-border bg-card/50">
        <button
          id="typography-panel-toggle"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/40"
          onClick={() => setTypoOpen(!typoOpen)}
        >
          <span className="flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" />
            Typography Compositor
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${typoOpen ? 'rotate-180' : ''}`} />
        </button>
        {typoOpen && (
          <div className="space-y-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">App-rendered typography overlaid on generated art. Image model text is never used for final covers.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Title</label>
                <input id="typo-title" type="text" value={typoSettings.titleText}
                  onChange={e => setTypoSettings(s => ({ ...s, titleText: e.target.value }))}
                  placeholder="Book title" className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Subtitle</label>
                <input id="typo-subtitle" type="text" value={typoSettings.subtitleText}
                  onChange={e => setTypoSettings(s => ({ ...s, subtitleText: e.target.value }))}
                  placeholder="Optional subtitle" className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Author</label>
                <input id="typo-author" type="text" value={typoSettings.authorText}
                  onChange={e => setTypoSettings(s => ({ ...s, authorText: e.target.value }))}
                  placeholder="Author name" className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Series / Book #</label>
                <input id="typo-series" type="text" value={typoSettings.seriesText}
                  onChange={e => setTypoSettings(s => ({ ...s, seriesText: e.target.value }))}
                  placeholder="e.g. The Dark Files #3" className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Tagline</label>
              <input id="typo-tagline" type="text" value={typoSettings.taglineText}
                onChange={e => setTypoSettings(s => ({ ...s, taglineText: e.target.value }))}
                placeholder="Optional tagline" className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Font Family</label>
                <select id="typo-font-family" value={typoSettings.titleFontId}
                  onChange={e => setTypoSettings(s => ({ ...s, titleFontId: e.target.value, subtitleFontId: e.target.value, authorFontId: e.target.value }))}
                  className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs">
                  {FONT_FAMILIES.map(f => <option key={f.id} value={f.id}>{f.label} ({f.category})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Title Size</label>
                <input id="typo-title-size" type="number" min={8} max={400} value={typoSettings.titleFontSize}
                  onChange={e => setTypoSettings(s => ({ ...s, titleFontSize: Number(e.target.value) }))}
                  className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Title Weight</label>
                <select id="typo-title-weight" value={typoSettings.titleFontWeight}
                  onChange={e => setTypoSettings(s => ({ ...s, titleFontWeight: e.target.value }))}
                  className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs">
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="italic">Italic</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Title Color</label>
                <input id="typo-title-color" type="color" value={typoSettings.titleColor}
                  onChange={e => setTypoSettings(s => ({ ...s, titleColor: e.target.value }))}
                  className="h-8 w-full rounded border border-border" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Letter Spacing</label>
                <input id="typo-letter-spacing" type="number" min={-10} max={50} value={typoSettings.titleLetterSpacing}
                  onChange={e => setTypoSettings(s => ({ ...s, titleLetterSpacing: Number(e.target.value) }))}
                  className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Line Height</label>
                <input id="typo-line-height" type="number" min={0.8} max={3} step={0.1} value={typoSettings.titleLineHeight}
                  onChange={e => setTypoSettings(s => ({ ...s, titleLineHeight: Number(e.target.value) }))}
                  className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Author Color</label>
                <input id="typo-author-color" type="color" value={typoSettings.authorColor}
                  onChange={e => setTypoSettings(s => ({ ...s, authorColor: e.target.value }))}
                  className="h-8 w-full rounded border border-border" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Title Placement</label>
                <select id="typo-title-placement" value={typoSettings.titlePlacement}
                  onChange={e => setTypoSettings(s => ({ ...s, titlePlacement: e.target.value }))}
                  className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs">
                  {Object.entries(TITLE_PLACEMENT_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Author Placement</label>
                <select id="typo-author-placement" value={typoSettings.authorPlacement}
                  onChange={e => setTypoSettings(s => ({ ...s, authorPlacement: e.target.value }))}
                  className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs">
                  {Object.entries(AUTHOR_PLACEMENT_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input id="typo-shadow-toggle" type="checkbox" checked={typoSettings.titleShadow}
                  onChange={e => setTypoSettings(s => ({ ...s, titleShadow: e.target.checked, subtitleShadow: e.target.checked, authorShadow: e.target.checked }))}
                  className="rounded" />
                Text Shadow
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input id="typo-glow-toggle" type="checkbox" checked={typoSettings.glowEnabled}
                  onChange={e => setTypoSettings(s => ({ ...s, glowEnabled: e.target.checked }))}
                  className="rounded" />
                Glow
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input id="typo-safe-margins" type="checkbox" checked={showGuides}
                  onChange={e => setShowGuides(e.target.checked)}
                  className="rounded" />
                Show Safe Margins / Guides
              </label>
            </div>

            <Button
              id="preview-typography"
              onClick={() => {
                const overlay = buildTypographyOverlay(typoSettings);
                setTypoPreview(overlay);
                toast.success(`Typography preview: ${overlay.layers.length} text layer(s)`);
              }}
              variant="outline"
              className="w-full rounded-full text-xs"
            >
              <Eye className="mr-2 h-3 w-3" /> Preview Typography Overlay
            </Button>

            {typoPreview && (
              <div className="rounded border border-border bg-muted/30 p-2 text-xs">
                <strong>Preview:</strong> {typoPreview.layers.length} layer(s):
                {typoPreview.layers.map((l, i) => (
                  <div key={i} className="ml-2">
                    • <strong>{l.role}</strong>: "{l.text}" — {l.font.split(',')[0]} {l.fontSize}px @ ({(l.x*100).toFixed(0)}%, {(l.y*100).toFixed(0)}%)
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          EXPORT PANEL
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg border border-border bg-card/50">
        <button
          id="export-panel-toggle"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/40"
          onClick={() => setExportOpen(!exportOpen)}
        >
          <span className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Export Front Cover
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
        </button>
        {exportOpen && (
          <div className="space-y-3 border-t border-border px-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Export Preset</label>
                <select id="export-preset-selector" value={exportPreset}
                  onChange={e => setExportPreset(e.target.value)}
                  className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs">
                  {Object.entries(COVER_EXPORT_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label} {v.width ? `(${v.width}×${v.height})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Format</label>
                <select id="export-format-selector" value={exportFormat}
                  onChange={e => setExportFormat(e.target.value)}
                  className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-xs">
                  <option value="png">PNG (lossless)</option>
                  <option value="jpg">JPG (smaller file)</option>
                </select>
              </div>
            </div>

            {exportPreset !== 'custom' && COVER_EXPORT_PRESETS[exportPreset] && (
              <div className="rounded border border-border bg-muted/30 p-2 text-xs">
                {COVER_EXPORT_PRESETS[exportPreset].description} — {COVER_EXPORT_PRESETS[exportPreset].dpi} DPI
              </div>
            )}

            <div className="flex gap-2">
              <Button
                id="export-cover-png"
                onClick={async () => {
                  if (!variants?.length) { toast.error('Generate a cover image first'); return; }
                  setExporting(true);
                  try {
                    const { renderCoverCompositeToCanvas, exportCompositeCoverPNG } = await import('@/lib/coverTypographyComposer');
                    const dims = getCoverExportDimensions(exportPreset);
                    const imgUrl = variants[0]?.finalUrl || variants[0]?.artUrl;
                    const canvas = await renderCoverCompositeToCanvas(imgUrl, typoSettings, { width: dims.width, height: dims.height, showGuides });
                    const blob = await exportCompositeCoverPNG(canvas);
                    const filename = buildExportFilename(project, exportPreset, 'png');
                    downloadCoverImage(blob, filename);
                    toast.success(`Exported ${filename} (${(blob.size/1024).toFixed(0)} KB)`);
                  } catch (err) {
                    toast.error('Export failed: ' + err.message);
                  } finally { setExporting(false); }
                }}
                disabled={exporting || !variants?.length}
                className="flex-1 rounded-full text-xs"
              >
                {exporting ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Exporting…</> : <><Download className="mr-1 h-3 w-3" /> Export PNG</>}
              </Button>

              <Button
                id="export-cover-jpg"
                onClick={async () => {
                  if (!variants?.length) { toast.error('Generate a cover image first'); return; }
                  setExporting(true);
                  try {
                    const { renderCoverCompositeToCanvas, exportCompositeCoverJPG } = await import('@/lib/coverTypographyComposer');
                    const dims = getCoverExportDimensions(exportPreset);
                    const imgUrl = variants[0]?.finalUrl || variants[0]?.artUrl;
                    const canvas = await renderCoverCompositeToCanvas(imgUrl, typoSettings, { width: dims.width, height: dims.height, showGuides });
                    const blob = await exportCompositeCoverJPG(canvas, 0.92);
                    const filename = buildExportFilename(project, exportPreset, 'jpg');
                    downloadCoverImage(blob, filename);
                    toast.success(`Exported ${filename} (${(blob.size/1024).toFixed(0)} KB)`);
                  } catch (err) {
                    toast.error('Export failed: ' + err.message);
                  } finally { setExporting(false); }
                }}
                disabled={exporting || !variants?.length}
                variant="outline"
                className="flex-1 rounded-full text-xs"
              >
                <Download className="mr-1 h-3 w-3" /> Export JPG
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          COVER VARIATIONS
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg border border-border bg-card/50">
        <button
          id="variations-panel-toggle"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/40"
          onClick={() => setVariationsOpen(!variationsOpen)}
        >
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Cover Variations ({coverVariations.length})
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${variationsOpen ? 'rotate-180' : ''}`} />
        </button>
        {variationsOpen && (
          <div className="space-y-3 border-t border-border px-4 py-3">
            <div className="flex gap-2">
              <input id="variation-name-input" type="text" value={variationName}
                onChange={e => setVariationName(e.target.value)}
                placeholder="Variation name (optional)"
                className="flex-1 rounded border border-border bg-background/60 px-2 py-1.5 text-xs" />
              <Button
                id="save-variation"
                onClick={() => {
                  if (!variants?.length) { toast.error('Generate a cover first'); return; }
                  const imgUrl = variants[0]?.finalUrl || variants[0]?.artUrl;
                  const variation = createCoverVariation({
                    imageUrl: imgUrl,
                    metadata: buildCoverVariationMetadata(project, {
                      prompt: advPositivePrompt,
                      negativePrompt: advNegativePrompt,
                      modelPipeline: advModelPipeline,
                      checkpoint: advModelPipeline === 'flux' ? advFluxCheckpoint : advPonyCheckpoint,
                      seed: advSeed,
                      sizePreset: advSizePreset,
                      genreTemplate: advGenreTemplate,
                      width: getCoverDimensionsForPreset(advSizePreset).width,
                      height: getCoverDimensionsForPreset(advSizePreset).height,
                    }),
                    typographySettings: typoSettings,
                    name: variationName || undefined,
                  });
                  setCoverVariations(prev => [...prev, variation]);
                  setVariationName('');
                  toast.success(`Saved variation: ${variation.name}`);
                }}
                variant="outline" className="rounded-full text-xs"
              >
                <Save className="mr-1 h-3 w-3" /> Save Variation
              </Button>
            </div>

            {coverVariations.length > 0 && (
              <div className="space-y-2">
                {coverVariations.map((v, idx) => (
                  <div key={v.id} className={`flex items-center gap-2 rounded border p-2 text-xs ${v.id === activeVariationId ? 'border-primary bg-primary/10' : 'border-border'}`}>
                    <div className="flex-1">
                      <strong>{v.name}</strong>{v.id === activeVariationId && <span className="ml-1 text-primary">(Active)</span>}
                      <div className="text-muted-foreground">
                        {v.metadata?.modelPipeline?.toUpperCase()} • seed: {v.metadata?.seed} • {new Date(v.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <Button id={`select-variation-${idx}`} size="sm" variant="ghost" onClick={() => {
                      setActiveVariationId(v.id);
                      toast.success(`Active cover: ${v.name}`);
                    }}><Check className="h-3 w-3" /></Button>
                    <Button id={`duplicate-variation-${idx}`} size="sm" variant="ghost" onClick={() => {
                      const dup = duplicateCoverVariation(v);
                      setCoverVariations(prev => [...prev, dup]);
                      toast.success(`Duplicated: ${dup.name}`);
                    }}><Copy className="h-3 w-3" /></Button>
                    <Button id={`delete-variation-${idx}`} size="sm" variant="ghost" onClick={() => {
                      setCoverVariations(prev => prev.filter(x => x.id !== v.id));
                      if (activeVariationId === v.id) setActiveVariationId(null);
                      toast.success('Variation deleted');
                    }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SERIES CONSISTENCY LOCK
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg border border-border bg-card/50">
        <button
          id="series-lock-panel-toggle"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/40"
          onClick={() => setSeriesLockOpen(!seriesLockOpen)}
        >
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Series Consistency Lock
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${seriesLockOpen ? 'rotate-180' : ''}`} />
        </button>
        {seriesLockOpen && (
          <div className="space-y-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">Lock visual parameters across books in a series for consistent cover branding.</p>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input id="series-lock-enabled" type="checkbox" checked={seriesLockEnabled}
                  onChange={e => setSeriesLockEnabled(e.target.checked)}
                  className="rounded" />
                Enable Series Lock
              </label>
              <Button
                id="extract-series-signature"
                onClick={() => {
                  const activeVar = coverVariations.find(v => v.id === activeVariationId);
                  if (!activeVar) { toast.error('Select an active cover variation first'); return; }
                  const sig = extractSeriesCoverSignature(project, activeVar);
                  setSeriesSignature(sig);
                  toast.success(sig.hasSeriesSignature ? 'Series signature extracted' : 'No signature data available');
                }}
                variant="outline" size="sm" className="rounded-full text-xs"
              >
                Extract from Active Cover
              </Button>
              <Button
                id="apply-series-signature"
                onClick={() => {
                  if (!seriesSignature?.hasSeriesSignature) { toast.error('Extract a series signature first'); return; }
                  if (seriesSignature.lighting) setAdvLighting(seriesSignature.lighting);
                  if (seriesSignature.palette) setAdvPalette(seriesSignature.palette);
                  if (seriesSignature.modelPipeline) setAdvModelPipeline(seriesSignature.modelPipeline);
                  toast.success('Series signature applied to generation settings');
                }}
                variant="outline" size="sm" className="rounded-full text-xs"
                disabled={!seriesSignature?.hasSeriesSignature}
              >
                Apply to Current Settings
              </Button>
            </div>

            {seriesSignature && (
              <div className="rounded border border-border bg-muted/30 p-2 text-xs space-y-1">
                <div><strong>Locked signature:</strong></div>
                {seriesSignature.lighting && <div>Lighting: {seriesSignature.lighting}</div>}
                {seriesSignature.palette && <div>Palette: {seriesSignature.palette}</div>}
                {seriesSignature.modelPipeline && <div>Pipeline: {seriesSignature.modelPipeline}</div>}
                {seriesSignature.typographyStyle?.titleFontId && <div>Font: {seriesSignature.typographyStyle.titleFontId}</div>}
                {seriesSignature.exportPreset && <div>Export: {seriesSignature.exportPreset}</div>}
              </div>
            )}

            <Button
              id="validate-series-consistency"
              onClick={() => {
                if (!seriesSignature) { toast.error('Extract a signature first'); return; }
                const result = validateSeriesCoverConsistency({
                  modelPipeline: advModelPipeline,
                  lighting: advLighting,
                  palette: advPalette,
                }, seriesSignature);
                if (result.consistent) {
                  toast.success('Settings are consistent with series signature');
                } else {
                  toast.warning(`${result.deviations.length} deviation(s) from series signature`);
                }
                setSeriesConsistencyReport(result);
              }}
              variant="outline" className="w-full rounded-full text-xs"
              disabled={!seriesSignature}
            >
              Validate Consistency
            </Button>

            {seriesConsistencyReport && !seriesConsistencyReport.consistent && (
              <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs space-y-1">
                <strong>Deviations:</strong>
                {seriesConsistencyReport.deviations.map((d, i) => (
                  <div key={i}>• {d.field}: expected "{d.expected}" → got "{d.actual}"</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          EXISTING DIRECTION-BASED WORKFLOW
         ═══════════════════════════════════════════════════════════════════ */}

      <div className="space-y-3">
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-foreground">
            <Type className="h-3.5 w-3.5" />
            Title
          </label>
          <input
            type="text"
            value={coverTitle}
            onChange={(event) => setCoverTitle(event.target.value)}
            placeholder="Exact title to render into the cover"
            className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Subtitle</label>
            <input
              type="text"
              value={subtitle}
              onChange={(event) => setSubtitle(event.target.value)}
              placeholder="Optional subtitle"
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Author Name</label>
            <input
              type="text"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder="Author name"
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Series / Top Line</label>
            <input
              type="text"
              value={seriesText}
              onChange={(event) => setSeriesText(event.target.value)}
              placeholder="Optional series line"
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-xs font-medium text-foreground">
              Phase 1 — Manuscript-Grounded Book DNA
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExtractIdea}
              disabled={isBusy || !project}
              className="h-7 gap-1 rounded-full px-2 text-[10px]"
            >
              {generating && statusText ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Reading…
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  Extract Idea
                </>
              )}
            </Button>
          </div>

          <Textarea
            value={artDesc}
            onChange={(event) => setArtDesc(event.target.value)}
            placeholder="Extract Idea will auto-fill this from the manuscript/project. You can also type your own master cover brief here."
            className="min-h-[110px] text-xs"
          />

          {directionModel && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Direction model: {directionModel}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="block text-xs font-medium text-foreground">
              Phase 1 — Four Fresh Cover Directions
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={regenerateDirectionsFromCurrentBrief}
              disabled={isBusy || !project}
              className="h-7 gap-1 rounded-full px-2 text-[10px]"
            >
              {rebuilding ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Rebuilding…
                </>
              ) : (
                <>
                  <Shuffle className="h-3 w-3" />
                  Rebuild Directions
                </>
              )}
            </Button>
          </div>

          <p className="mb-2 text-[10px] text-muted-foreground">
            Mode: {projectMode === 'nonfiction' ? 'Nonfiction / editorial' : 'Fiction / narrative'} · Rebuild iteration: {rebuildVersion}
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {directions.slice(0, FINAL_VARIANT_COUNT).map((direction, index) => (
              <div
                key={direction.id || index}
                className="rounded-xl border border-border/70 bg-background/50 p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {direction.label || `Direction ${index + 1}`}
                  </p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    #{index + 1}
                  </span>
                </div>

                <Textarea
                  value={direction.userEditable || ''}
                  onChange={(event) => updateDirectionText(index, event.target.value)}
                  className="min-h-[96px] text-xs"
                  placeholder={`Describe the ${direction.label || 'cover'} direction`}
                />

                <p className="mt-1 text-[10px] text-muted-foreground">
                  {direction.designIntent ||
                    'Distinct native cover concept generated from the manuscript.'}
                </p>

                {direction.manuscriptEvidence && (
                  <p className="mt-1 rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground">
                    Evidence: {direction.manuscriptEvidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Art Style</label>
          <ChipSelect options={ART_STYLES} value={artStyle} onChange={setArtStyle} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Color Mood</label>
          <ChipSelect options={COLOR_MOODS} value={colorMood} onChange={setColorMood} />
        </div>

        {statusText && (
          <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {statusText}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={isBusy} className="min-h-10 flex-1 rounded-full">
            {generating && statusText ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Native Covers
              </>
            )}
          </Button>

          <Button
            onClick={handleMakeForMe}
            disabled={isBusy || !project}
            variant="secondary"
            className="min-h-10 flex-1 rounded-full"
          >
            {makeForMeRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Working…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Make for Me
              </>
            )}
          </Button>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadImage}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            variant="outline"
            className="min-h-10 w-full rounded-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Existing Finished Cover
              </>
            )}
          </Button>
        </div>
      </div>

      {variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Finished native covers. Click Select only when you want to use one.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {variants.map((variant, index) => (
              <div
                key={variant.finalUrl || index}
                className="group relative overflow-hidden rounded-xl border border-border/70"
              >
                <img
                  src={variant.finalUrl}
                  alt={`Native cover ${index + 1}`}
                  className="aspect-[2/3] w-full object-cover"
                />

                <div className="absolute left-3 top-3 max-w-[80%] rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                  {variant.directionLabel || `Direction ${index + 1}`}
                </div>

                <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/75 to-transparent p-3">
                  <Button
                    size="sm"
                    onClick={() => onSelectArt(variant.finalUrl)}
                    variant={selectedArtUrl === variant.finalUrl ? 'default' : 'secondary'}
                    className="rounded-full text-xs"
                  >
                    {selectedArtUrl === variant.finalUrl ? (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        Selected
                      </>
                    ) : (
                      `Select #${index + 1}`
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CoverArtGalleryGrid
        items={galleryItems}
        selectedArtUrl={selectedArtUrl}
        onSelect={onSelectArt}
        onDelete={async (id) => {
          try {
            await base44.entities.CoverArtGallery.delete(id);
            await queryClient.invalidateQueries({ queryKey: ['cover-gallery', project?.id] });
            await queryClient.refetchQueries({ queryKey: ['cover-gallery', project?.id] });
          } catch (error) {
            toast.error('Delete failed: ' + (error?.message || 'unknown'));
          }
        }}
      />
    </div>
  );
}
