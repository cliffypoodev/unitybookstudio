// =============================================================
// ideaInjection.js — CHATFIX-1: pure mapping from a [USE_IDEA] payload to
// project Setup fields. setting/themes/characters/researchNeeds (previously
// DROPPED) are folded into seed_concept as labeled sections consumed by the
// Story Bible generator — chat never writes Foundation fields directly.
// =============================================================

export function buildIdeaProjectFields(ideaData = {}) {
  let concept = ideaData.premise || '';
  if (ideaData.story_engine) concept += '\n\nSTORY ENGINE: ' + ideaData.story_engine;
  if (ideaData.setting) concept += '\n\nSETTING: ' + String(ideaData.setting);
  if (Array.isArray(ideaData.themes) && ideaData.themes.length) concept += '\n\nTHEMES: ' + ideaData.themes.join('; ');
  if (Array.isArray(ideaData.characters) && ideaData.characters.length) {
    const lines = ideaData.characters.map((c) => {
      if (typeof c === 'string') return '- ' + c;
      const name = c.name || 'Unnamed';
      const role = c.role ? ' (' + c.role + ')' : '';
      const desc = c.description ? ' — ' + c.description : '';
      return '- ' + name + role + desc;
    });
    concept += '\n\nKEY CHARACTERS:\n' + lines.join('\n');
  }
  if (Array.isArray(ideaData.researchNeeds) && ideaData.researchNeeds.length) {
    concept += '\n\nRESEARCH NEEDS (verify before drafting — none of these are established facts):\n' + ideaData.researchNeeds.map((r) => '- TO VERIFY: ' + r).join('\n');
  }
  return {
    seed_concept: concept,
    ...(ideaData.book_type ? { book_type: ideaData.book_type } : {}),
    ...(ideaData.genre ? { genre: ideaData.genre } : {}),
    ...(ideaData.subgenre ? { subgenre: ideaData.subgenre } : {}),
    ...(ideaData.targetAudience ? { target_audience: ideaData.targetAudience } : {}),
    ...(ideaData.pov ? { pov_mode: ideaData.pov } : {}),
    ...(ideaData.tense ? { tense: ideaData.tense } : {}),
    ...(ideaData.beatStyle ? { beat_style: ideaData.beatStyle, scene_beat_style: ideaData.beatStyle } : {}),
    ...(ideaData.storyArcPacing ? { story_arc: ideaData.storyArcPacing } : {}),
    ...(ideaData.authorVoice && ideaData.authorVoice !== 'Custom / None' ? { author_voice: ideaData.authorVoice } : {}),
    ...(ideaData.chapterCount ? { chapter_target: Number(ideaData.chapterCount) } : {}),
    ...(ideaData.spiceLevel !== undefined ? { spice_level: Number(ideaData.spiceLevel) } : {}),
    ...(ideaData.languageLevel !== undefined ? { language_intensity: Number(ideaData.languageLevel) } : {}),
    ...(ideaData.violenceLevel !== undefined ? { violence_level: Number(ideaData.violenceLevel) } : {}),
  };
}

console.log('[IDEA-INJECTION] CHATFIX-1 loaded: complete USE_IDEA -> Setup mapping');
