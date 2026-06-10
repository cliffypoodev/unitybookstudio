/**
 * Builds prompt injection blocks from an AuthorStyle entity record.
 * Used by sceneWriter.js (full block) and autonovel.js (condensed block).
 */

/**
 * Build the full author voice profile block for scene-level prose generation.
 * @param {object} style - AuthorStyle entity record
 * @returns {string} - Prompt block to inject
 */
export function buildCustomAuthorStyleBlock(style) {
  if (!style) return '';
  const parts = [];
  parts.push('=== CUSTOM AUTHOR VOICE PROFILE: ' + style.name + ' ===');
  if (style.tone) parts.push('TONE: ' + style.tone);
  if (style.sentence_rhythm) parts.push('SENTENCE RHYTHM: ' + style.sentence_rhythm);
  if (style.vocabulary_level) parts.push('VOCABULARY: ' + style.vocabulary_level);
  if (style.paragraph_style) parts.push('PARAGRAPHS: ' + style.paragraph_style);
  if (style.dialogue_style) parts.push('DIALOGUE: ' + style.dialogue_style);
  if (style.dialogue_tags) parts.push('DIALOGUE TAGS: ' + style.dialogue_tags);
  if (style.description_approach) parts.push('DESCRIPTION: ' + style.description_approach);
  if (style.sensory_focus) parts.push('SENSORY FOCUS: ' + style.sensory_focus);
  if (style.metaphor_style) parts.push('METAPHORS: ' + style.metaphor_style);
  if (style.emotional_handling) parts.push('EMOTION: ' + style.emotional_handling);
  if (style.internal_monologue) parts.push('INTERNAL MONOLOGUE: ' + style.internal_monologue);
  if (style.humor_style) parts.push('HUMOR: ' + style.humor_style);
  if (style.pacing_preference) parts.push('PACING: ' + style.pacing_preference);
  if (style.chapter_endings) parts.push('ENDINGS: ' + style.chapter_endings);
  if (style.always_do) parts.push('ALWAYS: ' + style.always_do);
  if (style.never_do) parts.push('NEVER: ' + style.never_do);
  if (style.sample_paragraph) parts.push('VOICE SAMPLE (match this tone):\n' + style.sample_paragraph);
  parts.push('=== END CUSTOM AUTHOR VOICE ===');
  return parts.join('\n');
}

/**
 * Build a condensed version for beat planning prompts (shorter, key voice traits only).
 * @param {object} style - AuthorStyle entity record
 * @returns {string}
 */
export function buildCondensedAuthorStyleBlock(style) {
  if (!style) return '';
  const parts = ['CUSTOM AUTHOR VOICE: ' + style.name + '.'];
  if (style.tone) parts.push('Tone: ' + style.tone + '.');
  if (style.dialogue_style) parts.push('Dialogue: ' + style.dialogue_style + '.');
  if (style.pacing_preference) parts.push('Pacing: ' + style.pacing_preference + '.');
  if (style.chapter_endings) parts.push('Endings: ' + style.chapter_endings + '.');
  if (style.emotional_handling) parts.push('Emotion: ' + style.emotional_handling + '.');
  return parts.join(' ');
}

/**
 * Load an AuthorStyle by ID from the database.
 * Returns null if not found or ID is empty/built-in.
 */
export async function loadAuthorStyle(authorStyleId) {
  if (!authorStyleId) return null;
  try {
    const results = await (await import('@/api/base44Client')).base44.entities.AuthorStyle.filter({ id: authorStyleId });
    return results?.[0] || null;
  } catch (err) {
    console.warn('[AUTHOR_STYLE] Could not load style:', err.message);
    return null;
  }
}