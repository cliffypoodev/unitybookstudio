/**
 * Narrative generation context — the connective tissue between the stored
 * story bible, chapter plan, beat generator, and scene writer.
 *
 * Foundation fields larger than Base44's inline limit live behind *_url
 * fields. Generation must never use the raw project record directly because
 * those inline fields are intentionally blank. This module resolves the
 * complete foundation, validates the minimum fiction contract, and produces
 * an explicit immutable chapter snapshot for one generation operation.
 */

export const GENERATION_CONTEXT_VERSION = 'narrative-connect-v1';

export const FOUNDATION_FIELDS = Object.freeze([
  'world_md',
  'characters_md',
  'outline_md',
  'canon_md',
  'voice_md',
  'mystery_md',
  'twists_md',
  'research_md',
]);

export const REQUIRED_FICTION_FOUNDATION_FIELDS = Object.freeze([
  'world_md',
  'characters_md',
  'outline_md',
  'canon_md',
]);

export class GenerationContextError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'GenerationContextError';
    this.code = details.code || 'GENERATION_CONTEXT_INVALID';
    this.details = details;
  }
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isStandaloneFiction(project = {}) {
  const projectType = String(project.project_type || '').toLowerCase();
  const bookType = String(project.book_type || 'fiction').toLowerCase();
  return bookType !== 'nonfiction' && projectType !== 'anthology';
}

function requiredFieldsFor(project = {}, override) {
  if (Array.isArray(override)) return override;
  return isStandaloneFiction(project) ? [...REQUIRED_FICTION_FOUNDATION_FIELDS] : [];
}

async function defaultFoundationResolver(project) {
  const module = await import('@/lib/foundationStorage');
  return module.resolveAllFoundationFields(project);
}

export function assertGenerationFoundationReady(project = {}, options = {}) {
  const requiredFields = requiredFieldsFor(project, options.requiredFields);
  const missingFields = requiredFields.filter((field) => !text(project[field]));

  if (missingFields.length) {
    const unresolvedUrlFields = missingFields.filter((field) => text(project[`${field}_url`]));
    throw new GenerationContextError(
      `Generation blocked: the complete story foundation is unavailable (${missingFields.join(', ')}). Reopen the project or rebuild the Story Bible before drafting.`,
      {
        code: unresolvedUrlFields.length
          ? 'FOUNDATION_URL_RESOLUTION_FAILED'
          : 'FOUNDATION_FIELDS_MISSING',
        missingFields,
        unresolvedUrlFields,
        projectId: project.id || null,
      }
    );
  }

  return {
    ok: true,
    requiredFields,
    missingFields: [],
  };
}

export async function hydrateProjectForGeneration(project = {}, options = {}) {
  if (!project?.id) {
    throw new GenerationContextError('Generation blocked: project identity is missing.', {
      code: 'PROJECT_ID_MISSING',
    });
  }

  const resolver = options.resolveAllFoundationFields || defaultFoundationResolver;
  let resolved = {};

  try {
    resolved = (await resolver(project)) || {};
  } catch (error) {
    throw new GenerationContextError(
      `Generation blocked: the complete story foundation could not be loaded. ${error?.message || error}`,
      {
        code: 'FOUNDATION_RESOLUTION_THREW',
        projectId: project.id,
        cause: error?.message || String(error),
      }
    );
  }

  const hydrated = { ...project };
  const resolvedFields = [];

  for (const field of FOUNDATION_FIELDS) {
    const fullText = text(resolved[field]);
    if (fullText) {
      hydrated[field] = fullText;
      resolvedFields.push(field);
    }
  }

  const validation = assertGenerationFoundationReady(hydrated, options);
  const report = Object.freeze({
    version: GENERATION_CONTEXT_VERSION,
    projectId: project.id,
    resolvedFields: Object.freeze([...resolvedFields]),
    requiredFields: Object.freeze([...validation.requiredFields]),
    sourceUpdatedAt: project.updated_date || project.updated_at || null,
  });

  Object.defineProperty(hydrated, '__generationContext', {
    value: report,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return hydrated;
}

function chapterNumber(chapter) {
  const number = Number(chapter?.chapter_number ?? chapter?.number ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function cloneChapter(chapter) {
  return Object.freeze({ ...(chapter || {}) });
}

export function buildGenerationSnapshot({ project, chapters = [], chapter } = {}) {
  if (!project?.id) {
    throw new GenerationContextError('Cannot create generation snapshot without a project.', {
      code: 'SNAPSHOT_PROJECT_MISSING',
    });
  }

  const orderedChapters = (Array.isArray(chapters) ? chapters : [])
    .filter(Boolean)
    .map(cloneChapter)
    .sort((a, b) => chapterNumber(a) - chapterNumber(b));

  const targetId = chapter?.id || null;
  const targetNumber = chapterNumber(chapter);
  const currentChapter =
    orderedChapters.find((item) => targetId && item.id === targetId) ||
    orderedChapters.find((item) => targetNumber && chapterNumber(item) === targetNumber) ||
    (chapter ? cloneChapter(chapter) : null);

  if (!currentChapter) {
    throw new GenerationContextError('Cannot create generation snapshot: target chapter was not found.', {
      code: 'SNAPSHOT_CHAPTER_MISSING',
      projectId: project.id,
      chapterId: targetId,
      chapterNumber: targetNumber || null,
    });
  }

  const currentNumber = chapterNumber(currentChapter);
  const previousChapter =
    orderedChapters.find((item) => chapterNumber(item) === currentNumber - 1) || null;

  const newestChapterUpdate = orderedChapters
    .map((item) => item.updated_date || item.updated_at || '')
    .sort()
    .at(-1) || '';

  return Object.freeze({
    version: GENERATION_CONTEXT_VERSION,
    snapshotId: [project.id, currentChapter.id || currentNumber, project.updated_date || '', newestChapterUpdate].join(':'),
    project,
    chapters: Object.freeze(orderedChapters),
    chapter: currentChapter,
    previousChapter,
  });
}

export async function loadGenerationSnapshot({
  project,
  chapter,
  fetchChapters,
  resolveAllFoundationFields,
  requiredFields,
} = {}) {
  if (typeof fetchChapters !== 'function') {
    throw new GenerationContextError('Generation snapshot requires a chapter loader.', {
      code: 'SNAPSHOT_LOADER_MISSING',
    });
  }

  const [hydratedProject, freshChapters] = await Promise.all([
    hydrateProjectForGeneration(project, {
      resolveAllFoundationFields,
      requiredFields,
    }),
    fetchChapters(),
  ]);

  return buildGenerationSnapshot({
    project: hydratedProject,
    chapters: freshChapters,
    chapter,
  });
}
