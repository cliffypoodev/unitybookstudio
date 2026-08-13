// src/api/base44Client.js — FULL REPLACEMENT
// Local implementation replacing Base44 cloud SDK.
// Exposes identical API surface: base44.entities.*, base44.functions.invoke(), base44.auth.*

import { entities, storeFile, retrieveFile } from '@/lib/localDB';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';

// ── Auth stub (single local user, no login required) ──

const LOCAL_USER = {
  email: 'local@unitybookstudio.app',
  name: 'Local User',
  role: 'admin',
};

const auth = {
  async me() {
    return LOCAL_USER;
  },
  logout(redirectUrl) {
    console.log('[LOCAL-AUTH] Logout requested. No-op in local mode.');
  },
  redirectToLogin(redirectUrl) {
    console.log('[LOCAL-AUTH] Login redirect requested. No-op in local mode.');
  },
};

// ── Functions stub (replaces base44.functions.invoke) ──

async function handleUploadToGitHub(params) {
  const { content, projectId, chapterId, filename, isBinary } = params;
  const key = `${projectId || 'misc'}/${chapterId || Date.now()}/${filename || 'content'}`;
  const fileUrl = await storeFile(key, content);
  console.log(`[LOCAL-STORAGE] Stored file: ${key} (${(content || '').length} chars)`);
  return { data: { file_url: fileUrl } };
}

async function handleFetchFromGitHub(params) {
  const { url, path, repo } = params;
  const key = url || path || '';

  // Try local store first
  const content = await retrieveFile(key);
  if (content) {
    console.log(`[LOCAL-STORAGE] Retrieved file: ${key}`);
    return { data: { content } };
  }

  // ── Attempt real HTTP fetch when running locally ──
  if (key.startsWith('http')) {
    let fetchUrl = key;

    // Rewrite external URLs through Vite dev proxies to bypass CSP.
    // These proxies are defined in vite.config.js.
    try {
      const parsed = new URL(key);
      if (parsed.hostname === 'raw.githubusercontent.com') {
        fetchUrl = '/github-raw' + parsed.pathname + (parsed.search || '');
      } else if (parsed.hostname === 'base44.app') {
        fetchUrl = '/base44-files' + parsed.pathname + (parsed.search || '');
      } else if (parsed.hostname === 'media.base44.com') {
        fetchUrl = '/base44-media' + parsed.pathname + (parsed.search || '');
      }
    } catch { /* not a valid URL, try as-is */ }

    try {
      const resp = await fetch(fetchUrl, { cache: 'no-store' });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.length > 50) {
          console.log(`[LOCAL-STORAGE] Fetched remote content: ${key.slice(0, 60)}… (${text.length} chars)`);
          return { data: { content: text } };
        }
      }
      console.warn(`[LOCAL-STORAGE] Remote fetch returned empty/error for: ${key.slice(0, 80)}…`);
    } catch (fetchErr) {
      console.warn(`[LOCAL-STORAGE] Remote fetch failed for: ${key.slice(0, 80)}… — ${fetchErr?.message || 'unknown error'}`);
    }
  } else {
    console.warn(`[LOCAL-STORAGE] File not found: ${key}`);
  }
  return { data: { content: null, error: 'File not found' } };
}

async function handleCriticAgent(params) {
  const {
    chapterText, chapterNumber, totalChapters,
    protagonistName, protagonistPronouns,
    genre, previousChapterEnding, nextChapterOpening,
  } = params;

  const prompt = `You are a ruthless prose editor. Clean this chapter draft.
Protagonist: ${protagonistName || 'unknown'} (${protagonistPronouns || 'they/them'})
Chapter ${chapterNumber || '?'} of ${totalChapters || '?'}
Genre: ${genre || 'fiction'}
${previousChapterEnding ? `Previous chapter ended with: ${previousChapterEnding}` : ''}
${nextChapterOpening ? `Next chapter opens with: ${nextChapterOpening}` : ''}

Return ONLY the cleaned chapter text. No commentary.

CHAPTER TEXT:
${chapterText}`;

  const cleaned = await invokeLLMWithRetry({
    prompt,
    task_type: 'polish',
    temperature: 0.3,
    max_tokens: 16384,
  });

  return { data: { text: cleaned } };
}

async function handleImageToDataUrl(params) {
  const { url } = params;
  if (!url) return { data: { dataUrl: null } };

  // If already a data URL, return as-is
  if (url.startsWith('data:')) return { data: { dataUrl: url } };

  // If local URL, retrieve content
  if (url.startsWith('local://')) {
    const content = await retrieveFile(url);
    if (content) return { data: { dataUrl: content } };
    return { data: { dataUrl: null, error: 'Local file not found' } };
  }

  // Try to fetch and convert external URL
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ data: { dataUrl: reader.result } });
      reader.onerror = () => resolve({ data: { dataUrl: null, error: 'Read failed' } });
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return { data: { dataUrl: null, error: err?.message } };
  }
}

/**
 * WAVE12-DIRECTIONS — use the manuscript that was read, and return the shape the
 * caller parses.
 *
 * Two defects lived here. The caller queries up to 100 chapters, resolves three
 * chapter bodies out of storage and assembles up to 19,000 characters of
 * context, then sends `projectContext`, `artDesc`, `creativeDirective`,
 * `previousDirections`, `subtitle`, `authorName`, `seriesText` and
 * `rebuildIteration`. This handler read four fields — and two of them
 * (`tone`, `description`) are not among the ones sent. So "Reading
 * manuscript/project context…" ran for seconds and changed nothing: every book
 * got generic-by-genre directions, and Rebuild could not produce a different
 * result because the diversity inputs were dropped on the floor.
 *
 * It then returned `directions` as a STRING. The caller runs
 * `normalizeDirections(data.directions)`, which returns the placeholder
 * DEFAULT_DIRECTIONS for anything that is not an array — so the four boxes
 * filled with "Click Extract Idea or Rebuild Directions to generate…" and that
 * placeholder sentence was then sent to the image model as the art prompt.
 */
function extractJsonArray(raw) {
  if (Array.isArray(raw)) return raw;

  const text = typeof raw === 'string' ? raw : (raw?.text || raw?.content || '');
  if (!text) return null;

  const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function handleGenerateCoverDirections(params) {
  const context = String(params.projectContext || '').slice(0, 12000);

  const prompt = [
    'You are a commercial book-cover art director. Produce FOUR genuinely different cover directions for this book.',
    '',
    `Title: ${params.title || 'Untitled'}`,
    params.subtitle ? `Subtitle: ${params.subtitle}` : '',
    params.authorName ? `Author: ${params.authorName}` : '',
    params.seriesText ? `Series line: ${params.seriesText}` : '',
    `Genre: ${params.genre || 'fiction'}${params.subgenre ? ` / ${params.subgenre}` : ''}`,
    '',
    params.artDesc ? `ART DIRECTION BRIEF FROM THE AUTHOR:\n${params.artDesc}\n` : '',
    params.creativeDirective ? `${params.creativeDirective}\n` : '',
    params.previousDirections
      ? `ALREADY TRIED — do not repeat these, go somewhere new:\n${params.previousDirections}\n`
      : '',
    context ? `MANUSCRIPT CONTEXT (ground every direction in this, not in genre clichés):\n${context}\n` : '',
    'Each direction must be visually distinct from the other three — different focal subject, not the same idea recoloured.',
    'Ground the imagery in specifics from the manuscript context above: real objects, real places, real moments.',
    'No text, lettering, signage or typography in the described artwork.',
    '',
    'Return ONLY a JSON array of exactly 4 objects, no prose around it:',
    '[{"label":"Symbolic Object","focalConcept":"<3-6 words>","userEditable":"<the full image prompt: subject, composition, lighting, colour palette, mood>","designIntent":"<why this sells this book>","manuscriptEvidence":"<the detail from the manuscript this is drawn from>"}]',
  ].filter(Boolean).join('\n');

  const raw = await invokeLLMWithRetry({
    prompt,
    task_type: 'publishing',
    temperature: 0.85,
  });

  const text = typeof raw === 'string' ? raw : (raw?.text || raw?.content || '');
  const directions = extractJsonArray(raw);

  return {
    data: {
      text,
      // null (not a string) when unparseable, so the caller can fall through to
      // its own manuscript-grounded local payload instead of the placeholders.
      directions,
      generated_by_llm: Array.isArray(directions) && directions.length > 0,
      rebuild_nonce: params.rebuildNonce,
    },
  };
}

const functions = {
  async invoke(functionName, params = {}) {
    switch (functionName) {
      case 'uploadToGitHub':
        return handleUploadToGitHub(params);

      case 'fetchFromGitHub':
        return handleFetchFromGitHub(params);

      case 'criticAgent':
        return handleCriticAgent(params);

      case 'imageToDataUrl':
        return handleImageToDataUrl(params);

      case 'generateCoverDirections':
        return handleGenerateCoverDirections(params);

      case 'generateNativeCover': {
        // Route through new workflow builders if modelPipeline is specified
        if (params.modelPipeline && (params.modelPipeline === 'flux' || params.modelPipeline === 'ponyxl')) {
          const { generateCoverWithComfyUI } = await import('@/lib/comfyuiClient');
          const { buildCoverWorkflowForModel, getCoverDimensionsForPreset } = await import('@/lib/coverComfyWorkflows');

          const dims = getCoverDimensionsForPreset(
            params.sizePreset || 'ebook_portrait',
            params.customDimensions,
          );
          const seed = params.seed != null && params.seed !== -1
            ? params.seed
            : Math.floor(Math.random() * 2 ** 32);

          const workflowOptions = {
            positivePrompt: params.positivePrompt || params.directionBrief || '',
            negativePrompt: params.negativePrompt || '',
            checkpoint: params.checkpoint,
            width: dims.width,
            height: dims.height,
            steps: params.steps,
            cfg: params.cfg,
            guidance: params.guidance,
            seed,
          };

          const workflow = buildCoverWorkflowForModel(params.modelPipeline, workflowOptions);
          const result = await generateCoverWithComfyUI({ workflow, options: params.comfyOptions });

          return {
            data: {
              data_url: result.dataUrl,
              url: result.dataUrl,
              model: params.modelPipeline,
              seed,
              promptId: result.metadata?.promptId,
              filename: result.filename,
            },
          };
        }

        // Legacy path: basic prompt → localImageGen
        const { generateImageLocal } = await import('@/lib/localImageGen');

        // WAVE12-COVERTEXT: the title, subtitle, author and series line were all
        // sent by the caller and none of them were read — the prompt ended
        // "No text, no title, no author name, no words." while the UI hard-blocks
        // generation without a title AND an author, labels the field "Exact title
        // to render into the cover", and CoverCreator states that native covers
        // "already have title/author/subtitle burned in". Three independent
        // signals that this path is meant to produce a FINISHED cover, and it
        // produced textless art every time.
        //
        // The app already has a name for the other intent: typographyMode
        // 'image_only', used by the Typography Compositor, which overlays text
        // itself and genuinely wants clean artwork. That mode is still honoured.
        const wantsText = (params.typographyMode || 'typography_reference') !== 'image_only';

        const textLines = wantsText
          ? [
            params.title ? `Render the title text "${params.title}" as part of the cover design.` : '',
            params.subtitle ? `Render the subtitle "${params.subtitle}" smaller, beneath the title.` : '',
            params.authorName ? `Render the author name "${params.authorName}" at the foot of the cover.` : '',
            params.seriesText ? `Render the series line "${params.seriesText}" above the title.` : '',
            'Typography must be legible, professionally kerned, and integrated into the composition.',
            'Do not invent any other words, signage, captions or lettering.',
          ]
          : ['Professional book cover art. No text, no title, no author name, no words.'];

        const coverPrompt = [
          params.directionBrief || params.direction || '',
          params.artStyle ? `Art style: ${params.artStyle}` : '',
          params.colorMood ? `Color mood: ${params.colorMood}` : '',
          params.masterBrief || '',
          `Genre: ${params.genre || 'fiction'}`,
          ...textLines,
        ].filter(Boolean).join('\n');

        const result = await generateImageLocal({
          prompt: coverPrompt,
          size: params.size || '768x1152',
        });
        return { data: result };
      }

      case 'generateImageDirect': {
        const { generateImageLocal } = await import('@/lib/localImageGen');
        const result = await generateImageLocal({
          prompt: params.prompt,
          size: params.size || '1024x1024',
        });
        return { data: result };
      }

      case 'openRouterLLM':
      case 'geminiLLM':
      case 'openaiLLM':
        // These should never be called after Phase 1 migration.
        // If they are, something bypassed integrationRetry.js.
        console.error(`[LOCAL] Legacy LLM function "${functionName}" called directly. This should go through invokeLLMWithRetry.`);
        throw new Error(`Legacy cloud LLM function "${functionName}" is not available locally.`);

      default:
        console.warn(`[LOCAL] Unknown function: ${functionName}`);
        throw new Error(`Function "${functionName}" is not available locally.`);
    }
  },
};

// ── Export the base44 object with identical API shape ──

export const base44 = {
  entities,
  functions,
  auth,
};
