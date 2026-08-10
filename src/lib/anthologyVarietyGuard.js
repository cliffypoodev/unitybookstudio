/**
 * anthologyVarietyGuard.js
 *
 * Diversity / anti-template utilities for anthology projects.
 * Prevents anthology entries from becoming palette-swapped versions of the same scene.
 *
 * This is prompt-side by design: it pushes variation into story-bible concepts and
 * chapter drafting without requiring another expensive LLM pass.
 */

const SETTING_TYPES = [
  'public spectacle',
  'private domestic room',
  'workplace/professional setting',
  'ritual/ceremonial space',
  'travel/transit space',
  'wilderness/landscape',
  'institutional/medical/official space',
  'stage/performance/broadcast space',
  'liminal threshold/hidden room',
  'battlefield/aftermath zone',
];

const CONFLICT_ENGINES = [
  'bargain/debt',
  'betrayal/reveal',
  'competition/rivalry',
  'survival/resource scarcity',
  'investigation/discovery',
  'temptation/forbidden opportunity',
  'ritual/initiation',
  'rescue/costly mercy',
  'performance/audience pressure',
  'inheritance/legacy burden',
  'trial/judgment',
  'escape/pursuit',
];

const POWER_DYNAMICS = [
  'mentor/apprentice',
  'rival/rival',
  'captor/captive',
  'doctor/specimen',
  'commander/subordinate',
  'patron/artist',
  'debtor/collector',
  'king/subject',
  'ghost/heir',
  'machine/operator',
  'stranger/guide',
  'former friend/betrayer',
];

const ESCALATION_SHAPES = [
  'slow seduction into danger',
  'immediate trap then reversal',
  'investigation becomes personal',
  'public mask collapses in private',
  'failed escape changes the bargain',
  'secret test reveals second agenda',
  'rescue becomes dependency',
  'victory reveals hidden cost',
  'performance becomes real',
  'gift becomes obligation',
  'ritual reveals false premise',
  'enemy offers the only truthful mirror',
];

const EMOTIONAL_ARCS = [
  'hunger to disillusionment',
  'confidence to exposure',
  'defiance to strategic patience',
  'denial to recognition',
  'resentment to dependence',
  'loneliness to dangerous belonging',
  'shame to cold resolve',
  'curiosity to irreversible knowledge',
  'mercy to moral compromise',
  'pride to enforced humility',
  'need to self-betrayal',
  'fear to calculated rebellion',
];

const ENDING_SHAPES = [
  'escape with a permanent cost',
  'apparent victory with hidden contamination',
  'quiet vow of revenge',
  'relationship permanently redefined',
  'public success/private ruin',
  'truth encoded but not understood',
  'new dependency established',
  'secret weapon obtained',
  'identity fracture accepted',
  'moral line crossed and rationalized',
  'false safety revealed',
  'door opens to a worse bargain',
];

const FORBIDDEN_REPEAT_PHRASES = [
  'sterile white room',
  'clinical assessment',
  'body betrayed him',
  'body betrayed her',
  'silence was a physical thing',
  'memory surfaced unbidden',
  'cold knot',
  'mouth went dry',
  'truth landed',
  'realization settled',
  'not quite anger, not quite panic',
  'hairline crack',
  'useless detail',
];

function cycle(list, index, salt = 0) {
  if (!Array.isArray(list) || list.length === 0) return '';
  const n = Number(index || 1);
  return list[Math.abs((n - 1 + salt) % list.length)];
}

function safe(value) {
  return String(value || '').trim();
}

function getChapterNumber(chapter) {
  return Number(chapter?.chapter_number || chapter?.number || chapter?.story_number || 1) || 1;
}

export function getAnthologyVarietySlots(storyNumber = 1) {
  const n = Number(storyNumber || 1) || 1;
  return {
    setting_type: cycle(SETTING_TYPES, n, 0),
    conflict_engine: cycle(CONFLICT_ENGINES, n, 2),
    power_dynamic: cycle(POWER_DYNAMICS, n, 4),
    escalation_shape: cycle(ESCALATION_SHAPES, n, 6),
    emotional_arc: cycle(EMOTIONAL_ARCS, n, 8),
    ending_shape: cycle(ENDING_SHAPES, n, 10),
  };
}

export function buildAnthologyVarietyOutlinePromptBlock({ startNum = 1, endNum = 1, usedTemplates = [] } = {}) {
  const rows = [];
  for (let i = Number(startNum || 1); i <= Number(endNum || startNum || 1); i += 1) {
    const slots = getAnthologyVarietySlots(i);
    rows.push(
      `${i}. setting=${slots.setting_type}; conflict=${slots.conflict_engine}; dynamic=${slots.power_dynamic}; escalation=${slots.escalation_shape}; emotional_arc=${slots.emotional_arc}; ending=${slots.ending_shape}`
    );
  }

  const usedBlock = usedTemplates.length
    ? `\nTEMPLATE COMBINATIONS ALREADY USED — do not repeat these:\n${usedTemplates.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : '';

  return `ANTHOLOGY VARIETY MATRIX — REQUIRED:
Each story must use a visibly different scene architecture, not just different character names.
Use the assigned matrix row for each story. You may adapt it to the fandom/genre, but do not collapse every entry into the same isolated-room/procedure/body-betrayal structure.

Required rows for this batch:
${rows.join('\n')}
${usedBlock}

For every story object, fill these fields distinctly:
- setting_type
- conflict_engine
- power_dynamic
- escalation_shape
- emotional_arc
- ending_shape

ANTI-TEMPLATE RULES:
- Do not make every story an authority figure entering a sealed room and performing a clinical procedure.
- Do not make every story hinge on the same body-betrayal realization.
- Do not make every climax a private sterile-room aftermath.
- Do not repeat the same emotional sequence with different costumes.
- Vary openings: action, confession, public event, bargain, investigation, failed rescue, discovery, ritual, aftermath, pursuit.
- Vary endings: escape, vow, contamination, bargain, exposure, coded truth, reversal, false victory, public mask/private damage.
- Avoid repeating these phrases as structural crutches: ${FORBIDDEN_REPEAT_PHRASES.join('; ')}.`;
}

export function buildAnthologyChapterVarietyBlock(project, chapter, chapters = []) {
  const isAnthology =
    project?.project_type === 'anthology' ||
    project?.project_format === 'anthology' ||
    project?.anthology_mode ||
    /antholog/i.test(`${project?.project_type || ''} ${project?.project_format || ''} ${project?.genre || ''} ${project?.subgenre || ''}`);

  if (!isAnthology) return '';

  const chapterNumber = getChapterNumber(chapter);
  const slots = getAnthologyVarietySlots(chapterNumber);
  const summary = safe(chapter?.beat_summary || chapter?.summary || chapter?.description || chapter?.outline || '');

  const prior = Array.isArray(chapters)
    ? chapters
        .filter((ch) => Number(ch?.chapter_number || ch?.number || 0) > 0 && Number(ch?.chapter_number || ch?.number || 0) < chapterNumber)
        .slice(-5)
        .map((ch) => {
          const n = Number(ch?.chapter_number || ch?.number || 0);
          const title = safe(ch?.title || `Story ${n}`);
          const s = getAnthologyVarietySlots(n);
          return `${n}. ${title} — ${s.setting_type}; ${s.conflict_engine}; ${s.power_dynamic}; ${s.ending_shape}`;
        })
    : [];

  // USEDNAMES-1: every anthology story is standalone, but the prose model draws minor-character
  // names from a small default pool and reuses OTHER stories' protagonists as walk-ons (measured
  // live 2026-08-10: Story 1's lead "Marcus" resurfaced as a minor character in Story 3;
  // "Maria"/"Clara" likewise). Collect the character names every OTHER story in the collection
  // already owns and forbid them here, so each story invents its own cast. Names come from the
  // sibling chapters' plans (beat_summary story data); the current story's own names are never
  // banned (its chapter_number is skipped). Deterministic; complements context isolation.
  const _bannedNames = new Set();
  if (Array.isArray(chapters)) {
    for (const ch of chapters) {
      const n = Number(ch?.chapter_number || ch?.number || 0);
      if (!n || n === chapterNumber) continue;
      let sd = null;
      try { sd = JSON.parse(ch?.beat_summary || ''); } catch { sd = null; }
      if (!sd || typeof sd !== 'object') continue;
      const holders = [];
      const p = sd.protagonist;
      holders.push(typeof p === 'string' ? p : (p && p.name) || '');
      if (Array.isArray(sd.characters)) sd.characters.forEach((c) => holders.push(typeof c === 'string' ? c : (c && c.name) || ''));
      if (Array.isArray(sd.cast)) sd.cast.forEach((c) => holders.push(typeof c === 'string' ? c : (c && c.name) || ''));
      holders.forEach((h) => {
        (String(h || '').match(/[A-Z][a-z]{2,}/g) || []).forEach((tok) => _bannedNames.add(tok));
      });
    }
  }
  const _bannedBlock = _bannedNames.size
    ? `\nBANNED CHARACTER NAMES (each already belongs to a DIFFERENT story in this collection — do NOT name ANY character here, major or minor, with these; invent fresh names for this story's cast): ${Array.from(_bannedNames).sort().join(', ')}`
    : '';

  return `ANTHOLOGY VARIETY / ANTI-TEMPLATE LOCK:
This is story/chapter ${chapterNumber} in an anthology. It must not read like a palette swap of the surrounding stories.

Assigned variety architecture for this chapter:
- Setting type: ${safe(chapter?.setting_type) || slots.setting_type}
- Conflict engine: ${safe(chapter?.conflict_engine) || slots.conflict_engine}
- Power dynamic: ${safe(chapter?.power_dynamic) || slots.power_dynamic}
- Escalation shape: ${safe(chapter?.escalation_shape) || slots.escalation_shape}
- Emotional arc: ${safe(chapter?.emotional_arc) || slots.emotional_arc}
- Ending shape: ${safe(chapter?.ending_shape) || slots.ending_shape}
${summary ? `\nChapter/story plan excerpt:\n${summary.slice(0, 1800)}` : ''}
${prior.length ? `\nRecent prior anthology templates to avoid repeating:\n${prior.join('\n')}` : ''}

Hard anti-template rules for drafting this chapter:
- Do not default to the same isolated chamber/procedure/interrogation structure unless the assigned setting/conflict specifically demands it.
- If there is a procedure, make the story architecture around it different: public consequence, investigation, bargain, failed escape, performance, inheritance, or reversal.
- Do not reuse the same sequence: sterile room → authority figure enters → clinical language → body betrayal → hollow aftermath.
- Do not reuse the same sensory anchors from recent stories: hairline crack, scuff mark, fly, cold metal table, white room, fluorescent hum, dry mouth, cold knot.
- Give this chapter a different opening image, conflict rhythm, psychological turn, and final image from every other anthology entry.
- Preserve the selected genre/spice/intensity, but diversify the dramatic design.${_bannedBlock}`;
}

export function summarizeTemplateSignature(story = {}) {
  const parts = [
    story.setting_type,
    story.conflict_engine,
    story.power_dynamic,
    story.escalation_shape,
    story.emotional_arc,
    story.ending_shape || story.ending_type,
  ].map(safe).filter(Boolean);
  return parts.join(' | ');
}

export function normalizeVarietyFields(story = {}, storyNumber = 1) {
  const slots = getAnthologyVarietySlots(storyNumber);
  return {
    ...story,
    setting_type: safe(story.setting_type) || slots.setting_type,
    conflict_engine: safe(story.conflict_engine) || slots.conflict_engine,
    power_dynamic: safe(story.power_dynamic) || slots.power_dynamic,
    escalation_shape: safe(story.escalation_shape) || slots.escalation_shape,
    emotional_arc: safe(story.emotional_arc) || slots.emotional_arc,
    ending_shape: safe(story.ending_shape) || safe(story.ending_type) || slots.ending_shape,
  };
}
