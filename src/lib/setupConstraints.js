/**
 * Build a constraint block from saved Setup settings.
 * Injected at the TOP of every Foundation and prose LLM prompt
 * so the LLM cannot override user-configured values.
 */
export function buildSetupConstraints(project) {
  const constraints = [];

  constraints.push(`CHAPTER COUNT: Exactly ${project.chapter_target || 20} chapters. This number is set by the user and is NON-NEGOTIABLE. Do not suggest or use a different number. Structure everything to fit exactly ${project.chapter_target || 20} chapters.`);
  constraints.push(`GENRE: ${project.genre || 'Fiction'}${project.subgenre ? ' / ' + project.subgenre : ''}.`);

  if (project.pov_mode) constraints.push(`POV: ${project.pov_mode}. The outline and all chapter plans must maintain this POV consistently.`);
  if (project.tense) constraints.push(`TENSE: ${project.tense}. The outline and all chapter plans must maintain this tense consistently.`);
  if (project.protagonist_pronouns) constraints.push(`PROTAGONIST PRONOUNS: ${project.protagonist_pronouns}. All character descriptions and chapter plans must use these pronouns consistently.`);
  if (project.book_type === 'fiction' && project.spice_level !== undefined && Number(project.spice_level) > 0) {
    constraints.push(`SPICE LEVEL: ${project.spice_level}/4. Plan intimate scenes and content intensity accordingly.`);
  }
  if (project.violence_level !== undefined && Number(project.violence_level) > 0) {
    constraints.push(`VIOLENCE LEVEL: ${project.violence_level}/5. Plan action/threat intensity accordingly.`);
  }
  if (project.author_voice && project.author_voice !== 'Custom / None') {
    constraints.push(`AUTHOR VOICE: ${project.author_voice}.`);
  }
  if (project.author_name) constraints.push(`AUTHOR: ${project.author_name}.`);
  if (project.story_arc) constraints.push(`STORY ARC: ${project.story_arc}. Pacing modulation is handled automatically — do not override arc-driven intensity.`);

  return `=== PROJECT CONSTRAINTS (from Setup — do NOT override these values) ===\n${constraints.join('\n')}\n=== END CONSTRAINTS ===\n`;
}

/**
 * CHAPCOUNT-1 — every spelling of "how many chapters does this book have".
 *
 * There are five, and they were listed in exactly one place: the strip list in
 * enforceChapterCount below. Order matters - chapter_target is FIRST because
 * enforceChapterCount deletes the other four and writes chapter_target, which
 * makes it the canonical field by construction.
 */
export const CHAPTER_COUNT_FIELDS = Object.freeze([
  'chapter_target', 'chapter_count', 'num_chapters', 'total_chapters', 'chapterCount',
]);

/**
 * CHAPCOUNT-1 — resolve the chapter count from whichever field carries it.
 *
 * MEASURED, live, on The Gilded Hour (2026-08-04) before a word was drafted:
 *
 *   chapter_target  4          <- what the Setup screen writes
 *   chapter_count   undefined  <- what sceneWriter.js read FIRST
 *
 * Both readers in sceneWriter.js did `project.chapter_count || project.num_chapters
 * || 20`, so they resolved **20** for a four-chapter book - and for every project
 * created by the current Setup screen, which never writes chapter_count at all.
 * The Brass Meridian record still carries chapter_count: 5 because it predates
 * that screen, which is why this never showed up on the book the gates were
 * debugged against.
 *
 * The sharp consequence is `isFinalChapter = chapterNumber >= totalChapters`:
 * false on chapter 4 of 4, so a volume's last chapter is never recognised as its
 * last and the series exit contract is never enforced.
 *
 * This reads the SAME list enforceChapterCount strips, so a sixth spelling can
 * never be added to one and forgotten in the other. When nothing resolves it
 * says so rather than silently inventing a number.
 */
export function resolveChapterCount(project, fallback = null) {
  for (const field of CHAPTER_COUNT_FIELDS) {
    const n = Number(project?.[field]);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  if (fallback != null) {
    console.warn(
      `[CHAPCOUNT-1] no chapter count on project ${project?.id || '(no id)'} - `
      + `falling back to ${fallback}. Fields checked: ${CHAPTER_COUNT_FIELDS.join(', ')}.`,
    );
  }
  return fallback;
}

/**
 * Strip any chapter-count fields an LLM may have injected,
 * then force the user's saved value back.
 */
export function enforceChapterCount(result, userChapterCount) {
  const stripped = { ...result };
  // CHAPCOUNT-1: the shared list, so strip and resolve can never disagree.
  CHAPTER_COUNT_FIELDS.forEach((f) => {
    if (stripped[f] !== undefined) delete stripped[f];
  });
  stripped.chapter_target = userChapterCount;
  return stripped;
}