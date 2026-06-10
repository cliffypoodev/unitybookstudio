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
 * Strip any chapter-count fields an LLM may have injected,
 * then force the user's saved value back.
 */
export function enforceChapterCount(result, userChapterCount) {
  const stripped = { ...result };
  ['num_chapters', 'chapter_count', 'total_chapters', 'chapterCount', 'chapter_target'].forEach(f => {
    if (stripped[f] !== undefined) delete stripped[f];
  });
  stripped.chapter_target = userChapterCount;
  return stripped;
}