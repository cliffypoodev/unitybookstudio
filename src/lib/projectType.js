/**
 * NFCLASS-1 — ONE authority for "is this project nonfiction".
 *
 * There were SIX detectors and they disagreed:
 *
 *   parallelBibleGenerator.isNonfictionSettings   book_type only
 *   manuscriptStats.isNonfictionProject           book_type | project_type
 *   manuscriptFixer.isNonfictionProject           book_type | project_type
 *   anthologyEngine.isNonfictionGenre             genre substring
 *   anthologyEngine.isNonfictionAnthology         book_type | genre substring
 *   manuscriptFixer.isNonfictionFixerProject      regex over book_type + project_type
 *                                                 + genre + subgenre + category
 *                                                 + nonfiction_type + TITLE + SUBTITLE
 *
 * MEASURED on the live library, 2026-08-05. The last one matches /historical/ against
 * a haystack that includes the genre and the title, so it claimed EIGHT declared-
 * fiction novels as nonfiction:
 *
 *   Siren in the Sand · The Scribe of Galilee · The Field of Blood
 *   The Stone Rolled Away · The Tongues of Fire · The Persecutor's Road
 *   The House of Cornelius (27 ch, 101,400 words) · Songbird
 *
 * Every Historical Fiction book in the library. All of them carry
 * book_type: 'fiction'. The consequence is not cosmetic: that detector gates
 * runNonfictionManuscriptIntegrityGate, whose job is stripping invented personas —
 * on a novel it would replace the author's characters with role labels, because in
 * nonfiction an invented named person is a fabrication.
 *
 * THE RULE, in order:
 *   1. A DECLARED type is the answer. book_type/project_type of 'nonfiction' means
 *      nonfiction; any other declared value means it is not. No inference may
 *      override what the author selected.
 *   2. Only when nothing is declared may the genre be consulted.
 *   3. A TITLE IS NEVER A TYPE. "The Field of Blood" is not a history book and
 *      "A Field Guide to Automata" is not a manual. Titles are marketing, they are
 *      chosen for resonance, and they change. Same lesson as STOREDEDUPE-1: a title
 *      is not an identity.
 */

/** Genres that genuinely denote nonfiction. Consulted ONLY when no type is declared. */
export const NONFICTION_GENRE_TERMS = Object.freeze([
  'nonfiction', 'non-fiction', 'memoir', 'biography', 'autobiography', 'true crime',
  // 'history' is safe here only because FICTION_QUALIFIED below already excludes
  // "Historical Fiction" and friends. Without that guard this term is the exact
  // substring match that misclassified eight novels.
  'history',
  'self-help', 'business', 'personal finance', 'reference', 'textbook', 'travel guide',
  'investigative journalism', 'popular science', 'philosophy', 'religion & spirituality',
  'health & wellness', 'parenting', 'caregiving', 'cookbook', 'how-to',
]);

/**
 * "Historical Fiction" contains "histor" and is FICTION. Any genre naming itself
 * fiction is fiction, whatever else the string happens to contain — this guard is
 * what the old substring matching lacked.
 */
const DECLARES_FICTION = /\bfiction\b/i;
const FICTION_QUALIFIED = /\b(?:historical|literary|speculative|science|crime|romantic|women'?s|young adult|christian|contemporary)\s+fiction\b/i;

export function isNonfictionGenreName(genre) {
  const g = String(genre || '').toLowerCase().trim();
  if (!g) return false;
  // "Historical Fiction", "Crime Fiction", "Literary Fiction" — fiction, full stop.
  if (FICTION_QUALIFIED.test(g)) return false;
  if (DECLARES_FICTION.test(g) && !/non[-\s]?fiction/.test(g)) return false;
  return NONFICTION_GENRE_TERMS.some((term) => g.includes(term));
}

/**
 * NFCLASS-2 — formats are not types. `project_type` carries FORMAT values too
 * (e.g. 'anthology'), and a format is not a declaration of fiction/nonfiction.
 * Only these two values count as a type declaration.
 */
export const TYPE_DECLARATIONS = Object.freeze(['fiction', 'nonfiction']);

/**
 * Returns the FIRST of book_type, project_type whose lower-cased value is an
 * actual type declaration ('fiction' | 'nonfiction'), else ''. A format value
 * like 'anthology' is never returned here.
 */
export function declaredType(project) {
  const bookType = String(project?.book_type || '').toLowerCase().trim();
  if (TYPE_DECLARATIONS.includes(bookType)) return bookType;
  const projectType = String(project?.project_type || '').toLowerCase().trim();
  if (TYPE_DECLARATIONS.includes(projectType)) return projectType;
  return '';
}

/**
 * The single answer. `project` may be a project record or a settings object.
 */
export function isNonfictionProject(project) {
  const declared = declaredType(project);
  if (declared) return declared === 'nonfiction';
  return isNonfictionGenreName(project?.genre);
}

/** Convenience for the many call sites that read better in the positive. */
export function isFictionProject(project) {
  return !isNonfictionProject(project);
}

/**
 * Explains a verdict, for telemetry and for the acceptance battery. A
 * classification that cannot say WHY is how six of them drifted apart unnoticed.
 */
export function explainProjectType(project) {
  const declared = declaredType(project);
  if (declared) {
    return {
      nonfiction: declared === 'nonfiction',
      basis: 'declared',
      detail: `book_type/project_type = "${declared}"`,
    };
  }
  const ignoredFormat = String(project?.book_type || project?.project_type || '').toLowerCase().trim();
  const nf = isNonfictionGenreName(project?.genre);
  return {
    nonfiction: nf,
    basis: 'genre-inference',
    detail: ignoredFormat
      ? `nothing declared (ignored format "${ignoredFormat}"); genre = "${project?.genre || ''}"`
      : `nothing declared; genre = "${project?.genre || ''}"`,
  };
}
