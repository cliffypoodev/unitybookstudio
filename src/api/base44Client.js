// src/api/base44Client.js — FULL REPLACEMENT
// Local implementation replacing Base44 cloud SDK.
// Exposes identical API surface: base44.entities.*, base44.functions.invoke(), base44.auth.*

import { entities, storeFile, retrieveFile } from '@/lib/localDB';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';

// ── Auth (AUTH-1: real session-backed accounts, per-user data separation) ──

const auth = {
  async me() {
    const resp = await fetch('/api/auth/me', { cache: 'no-store' });
    if (resp.status === 401) {
      const err = new Error('auth_required');
      err.code = 'auth_required';
      throw err;
    }
    if (!resp.ok) throw new Error(`Auth check failed: ${resp.status}`);
    const user = await resp.json();
    // Keep the shape older callers expect alongside the real account fields.
    return { ...user, email: `${user.username}@unitybookstudio.app`, name: user.display_name, role: 'admin' };
  },
  async status() {
    const resp = await fetch('/api/auth/status', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Auth status failed: ${resp.status}`);
    return resp.json();
  },
  async login(username, password) {
    const resp = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(body.error || 'Login failed.');
    return body;
  },
  async setup(username, password, displayName) {
    const resp = await fetch('/api/auth/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(body.error || 'Setup failed.');
    return body;
  },
  async createUser(username, password, displayName) {
    const resp = await fetch('/api/auth/create-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(body.error || 'Could not create user.');
    return body;
  },
  async transferProject(projectId, toUsername) { // TRANSFER-1
    const resp = await fetch('/api/auth/transfer-project', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, toUsername }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(body.error || 'Transfer failed.');
    return body;
  },
  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  },
  redirectToLogin() {
    window.location.href = '/login';
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

async function handleGenerateCoverDirections(params) {
  const prompt = `Generate cover art creative directions for a book.
Title: ${params.title || 'Untitled'}
Genre: ${params.genre || 'fiction'}
Tone: ${params.tone || 'dramatic'}
${params.description ? `Description: ${params.description}` : ''}

Return a detailed visual description for an AI image generator. Include composition, lighting, color palette, mood, and specific imagery. Do NOT include text on the cover.`;

  const text = await invokeLLMWithRetry({
    prompt,
    task_type: 'publishing',
    temperature: 0.7,
  });

  return { data: { text, directions: text } };
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
        const coverPrompt = [
          params.directionBrief || params.direction || '',
          params.artStyle ? `Art style: ${params.artStyle}` : '',
          params.colorMood ? `Color mood: ${params.colorMood}` : '',
          params.masterBrief || '',
          `Genre: ${params.genre || 'fiction'}`,
          'Professional book cover art. No text, no title, no author name, no words.',
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
