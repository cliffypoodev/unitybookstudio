// =============================================================
// Nonfiction Beat Sheet System
// RECOVERY v12 true writer-first natural chapter planner
// Purpose:
// - Build useful nonfiction section plans without turning beats into a source-audit ledger.
// - Restore natural chapter movement, varied section purpose, and clean drafting guidance.
// - Keep light nonfiction honesty rules, but keep audit/reporting out of the prose pipeline.
// =============================================================

console.log('[NONFICTION-BEATS] loaded: RECOVERY v12 true writer-first natural structure + no source-ledger planner');

// ── Beat Templates ──────────────────────────────────────────

export const NF_BEAT_TEMPLATES = {
  narrative: {
    label: 'Narrative Nonfiction',
    genres: ['memoir', 'biography', 'history', 'true crime', 'historical nonfiction', 'haunted history'],
    beats: [
      { position: 0.00, name: 'The Opening Pressure', function: 'OPENING_PRESSURE', mode: 'evidence_context', tempo: 'medium' },
      { position: 0.08, name: 'The World Before', function: 'CONTEXT_SETTING', mode: 'exposition', tempo: 'slow' },
      { position: 0.16, name: 'The People Involved', function: 'HUMAN_INTRODUCTION', mode: 'profile', tempo: 'medium' },
      { position: 0.25, name: 'The First Turn', function: 'INCITING_EVENT', mode: 'documented_event', tempo: 'medium' },
      { position: 0.35, name: 'The Record Deepens', function: 'EVIDENCE_TRAIL', mode: 'investigative', tempo: 'medium' },
      { position: 0.46, name: 'The Complication', function: 'COMPLICATION', mode: 'analysis', tempo: 'medium' },
      { position: 0.57, name: 'The Human Cost', function: 'CONSEQUENCES', mode: 'profile', tempo: 'slow' },
      { position: 0.68, name: 'The Wider Pattern', function: 'PATTERN', mode: 'analysis', tempo: 'medium' },
      { position: 0.80, name: 'The Aftermath', function: 'AFTERMATH', mode: 'documented_event', tempo: 'slow' },
      { position: 0.91, name: 'The Meaning', function: 'THEMATIC_SYNTHESIS', mode: 'synthesis', tempo: 'slow' },
      { position: 1.00, name: 'The Closing Image', function: 'CLOSING_IMAGE', mode: 'synthesis', tempo: 'slow' },
    ],
  },

  investigative: {
    label: 'Investigative Nonfiction',
    genres: ['investigative journalism', 'politics', 'true crime', 'institutional history', 'criminal justice', 'corruption', 'cold case', 'history'],
    beats: [
      { position: 0.00, name: 'The Question', function: 'ANOMALY', mode: 'evidence_context', tempo: 'medium' },
      { position: 0.08, name: 'The Public Story', function: 'OFFICIAL_FRAME', mode: 'exposition', tempo: 'medium' },
      { position: 0.17, name: 'The First Contradiction', function: 'FIRST_TURN', mode: 'investigative', tempo: 'medium' },
      { position: 0.27, name: 'The Machinery', function: 'MECHANISM', mode: 'analysis', tempo: 'medium' },
      { position: 0.38, name: 'The People Inside It', function: 'HUMAN_STAKES', mode: 'profile', tempo: 'slow' },
      { position: 0.50, name: 'The Pressure Point', function: 'ESCALATION', mode: 'investigative', tempo: 'medium' },
      { position: 0.62, name: 'The Missing Piece', function: 'GAP_OR_LIMIT', mode: 'analysis', tempo: 'medium' },
      { position: 0.74, name: 'The Consequence', function: 'IMPACT', mode: 'profile', tempo: 'slow' },
      { position: 0.86, name: 'The Reckoning', function: 'AFTERMATH', mode: 'documented_event', tempo: 'medium' },
      { position: 1.00, name: 'What Remains', function: 'FINAL_SYNTHESIS', mode: 'synthesis', tempo: 'slow' },
    ],
  },

  prescriptive: {
    label: 'Argument-Driven',
    genres: ['self-help', 'business', 'psychology', 'science', 'health & wellness', 'personal finance', 'caregiving', 'parenting'],
    beats: [
      { position: 0.00, name: 'The Hook', function: 'PROVOCATIVE_OPENING', mode: 'evidence_context', tempo: 'medium' },
      { position: 0.10, name: 'The Problem', function: 'PROBLEM_STATEMENT', mode: 'exposition', tempo: 'medium' },
      { position: 0.20, name: 'The Misunderstanding', function: 'REFRAME', mode: 'analysis', tempo: 'medium' },
      { position: 0.32, name: 'The Framework', function: 'FRAMEWORK', mode: 'teaching', tempo: 'slow' },
      { position: 0.45, name: 'The Example', function: 'CASE_STUDY', mode: 'case_study', tempo: 'medium' },
      { position: 0.58, name: 'The Objection', function: 'COUNTERARGUMENT', mode: 'analysis', tempo: 'fast' },
      { position: 0.70, name: 'The Application', function: 'PRACTICAL_APPLICATION', mode: 'how_to', tempo: 'medium' },
      { position: 0.83, name: 'The Bigger Picture', function: 'SYNTHESIS', mode: 'synthesis', tempo: 'slow' },
      { position: 1.00, name: 'The Send-Off', function: 'CALL_TO_ACTION', mode: 'synthesis', tempo: 'slow' },
    ],
  },

  reference: {
    label: 'Reference / Structured',
    genres: ['education', 'technology', 'cooking', 'religion', 'philosophy', 'travel', 'training', 'manual'],
    beats: [
      { position: 0.00, name: 'Why This Matters', function: 'MOTIVATION', mode: 'evidence_context', tempo: 'medium' },
      { position: 0.12, name: 'Foundations', function: 'FOUNDATION', mode: 'teaching', tempo: 'slow' },
      { position: 0.25, name: 'Core Concept', function: 'CONCEPT_BLOCK', mode: 'teaching', tempo: 'medium' },
      { position: 0.40, name: 'Applied Example', function: 'CASE_STUDY', mode: 'case_study', tempo: 'medium' },
      { position: 0.55, name: 'Common Mistakes', function: 'TROUBLESHOOTING', mode: 'analysis', tempo: 'fast' },
      { position: 0.70, name: 'Advanced Layer', function: 'ADVANCED_BLOCK', mode: 'teaching', tempo: 'medium' },
      { position: 0.85, name: 'Integration', function: 'INTEGRATION', mode: 'synthesis', tempo: 'slow' },
      { position: 1.00, name: "What's Next", function: 'ROADMAP', mode: 'synthesis', tempo: 'slow' },
    ],
  },
};

// ── Section Mode Descriptions (for prompt injection) ────────

export const NF_SECTION_MODES = {
  exposition: 'Clear nonfiction context. Establish time, place, public situation, or background without padding.',
  case_study: 'One specific example, case, episode, person, policy, event, or object. Use only details supplied by the project.',
  analysis: 'Interpret evidence and implications cautiously. Compare possibilities without pretending certainty.',
  how_to: 'Actionable practical guidance for prescriptive nonfiction.',
  synthesis: 'Connect what the chapter established and hand off to the next idea without repeating the whole chapter.',
  documented_event: 'Reconstruct documented events plainly. No invented dialogue, private thoughts, staging, weather, or sensory embellishment.',
  evidence_context: 'Open from a concrete fact, contradiction, record, timeline issue, physical detail, or practical problem.',
  profile: 'Humanize a real person or affected group using supplied facts only. If names are missing, make the absence of names clear without inventing them.',
  investigative: 'Move through questions, documents, chronology, contradictions, and implications step by step.',
  teaching: 'Explain a concept, demonstrate it, then connect it to the chapter purpose.',
};

// Kept for backward compatibility with downstream code/schema.
// Do not use this as a heavy source-ledger system.
export const NF_SOURCE_CONFIDENCE_LEVELS = {
  confirmed: 'Directly present in supplied project material.',
  source_category_supported: 'Supported by supplied source/category context but needs final citation verification before publication.',
  inferred: 'Reasonable interpretation that must be phrased cautiously.',
  unresolved: 'Open question or gap. Do not answer as fact.',
  prohibited: 'Do not state this as fact.',
};

const MOTIF_BUDGET_TERMS = [
  'silence',
  'official record',
  'institution',
  'archive',
  'erasure',
  'locked door',
  'containment',
  'ghost',
  'memory',
  'truth',
  'ledger',
  'bureaucracy',
  'machine',
];

const FORBIDDEN_FABRICATION_TARGETS = [
  'Do not invent named victims, composite victims, guards, witnesses, archivists, newspaper titles, article titles, court files, logbooks, key labels, case numbers, report titles, duty rosters, coroner findings, fire-marshal findings, blueprint discoveries, private letters, interviews, or exact quotes.',
  'Do not convert a rumor, oral tradition, plausible inference, or research lead into a solved historical fact.',
  'Do not write the author as discovering evidence unless the project explicitly supplies first-person field notes.',
  'Do not stage interviews, site visits, archive scenes, phone calls, emotional reactions, or cinematic reenactments unless source material explicitly supports them.',
  'Do not create recurring boilerplate paragraphs about evidence, casualty records, or uncertainty. Each chapter needs its own fresh structure.',
];

const AI_SMELL_PATTERNS = [
  'not merely X but Y',
  'a testament to',
  'serves as a reminder',
  'in many ways',
  'at its core',
  'more than just',
  'underscores',
  'raises important questions',
  'complex tapestry',
  'haunting reminder',
];

function safeString(value, limit = 2000) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length <= limit) return str;
  return `${str.slice(0, limit)}\n...[trimmed for prompt budget]`;
}

function extractOutlineNeighborText(chapters = [], chapterNumber = 1) {
  const sorted = [...(chapters || [])].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  const previous = sorted.filter((c) => (c.chapter_number || 0) < chapterNumber).slice(-3);
  const next = sorted.filter((c) => (c.chapter_number || 0) > chapterNumber).slice(0, 3);

  const format = (items) =>
    items
      .map((c) => `Ch.${c.chapter_number}: ${c.title || 'Untitled'} — ${safeString(c.beat_summary || c.summary || '', 350)}`)
      .join('\n');

  return {
    previousTitles: format(previous),
    nextTitles: format(next),
  };
}

function buildProjectContextBlock(project) {
  const blocks = [];

  if (project.brain_dump || project.brainstorm_md || project.concept_md) {
    blocks.push(`═══ PROJECT BRAIN / CONCEPT ═══\n${safeString(project.brain_dump || project.brainstorm_md || project.concept_md, 4500)}`);
  }

  if (project.research_md) {
    blocks.push(`═══ PROJECT RESEARCH NOTES ═══\n${safeString(project.research_md, 7000)}`);
  }

  if (project.sources_md || project.bibliography_md || project.citations_md) {
    blocks.push(`═══ SOURCE / BIBLIOGRAPHY NOTES ═══\n${safeString(project.sources_md || project.bibliography_md || project.citations_md, 4500)}`);
  }

  if (project.world_md) {
    blocks.push(`═══ WORLD / HISTORICAL CONTEXT ═══\n${safeString(project.world_md, 2500)}`);
  }

  if (project.characters_md) {
    blocks.push(`═══ PEOPLE / STAKEHOLDER NOTES ═══\n${safeString(project.characters_md, 2500)}`);
  }

  if (project.canon_md) {
    blocks.push(`═══ CANON / FACT NOTES ═══\n${safeString(project.canon_md, 2500)}`);
  }

  return blocks.join('\n\n');
}

export function detectNfTemplate(genre, structureMode) {
  const g = (genre || '').toLowerCase();

  if (structureMode && NF_BEAT_TEMPLATES[structureMode]) {
    return structureMode;
  }

  for (const [key, template] of Object.entries(NF_BEAT_TEMPLATES)) {
    if (template.genres.some((tg) => g.includes(tg))) {
      return key;
    }
  }

  if (
    g.includes('crime') ||
    g.includes('prison') ||
    g.includes('penitentiary') ||
    g.includes('gothic') ||
    g.includes('haunted') ||
    g.includes('institution') ||
    g.includes('riot') ||
    g.includes('murder') ||
    g.includes('case') ||
    g.includes('history')
  ) {
    return 'investigative';
  }

  return 'prescriptive';
}

export function getChapterBeat(chapterNumber, totalChapters, templateKey) {
  const template = NF_BEAT_TEMPLATES[templateKey];
  if (!template) return null;

  const position = totalChapters <= 1 ? 0 : (chapterNumber - 1) / (totalChapters - 1);
  let closest = template.beats[0];
  let minDelta = Math.abs(position - closest.position);

  for (const beat of template.beats) {
    const delta = Math.abs(position - beat.position);
    if (delta < minDelta) {
      minDelta = delta;
      closest = beat;
    }
  }

  return closest;
}

export function getSectionCount(targetWords) {
  const words = Number(targetWords) || 3500;
  if (words <= 2200) return { min: 4, max: 4 };
  if (words <= 3200) return { min: 4, max: 5 };
  if (words <= 4500) return { min: 5, max: 6 };
  if (words <= 6500) return { min: 6, max: 7 };
  return { min: 7, max: 8 };
}

export function buildNonfictionBeatPrompt(project, chapter, previousChapter, chapters) {
  const totalChapters = project.chapter_target || chapters?.length || 20;
  const templateKey = detectNfTemplate(project.genre, project.nf_structure_mode);
  const template = NF_BEAT_TEMPLATES[templateKey] || NF_BEAT_TEMPLATES.investigative;
  const chapterBeat = getChapterBeat(chapter.chapter_number, totalChapters, templateKey) || template.beats[0];
  const targetWords = Number(project.chapter_length_target || project.target_chapter_words || 3500);
  const sectionRange = getSectionCount(targetWords);
  const projectContextBlock = buildProjectContextBlock(project);
  const { previousTitles, nextTitles } = extractOutlineNeighborText(chapters, chapter.chapter_number);

  const modeDescriptions = Object.entries(NF_SECTION_MODES)
    .map(([key, desc]) => `  ${key}: ${desc}`)
    .join('\n');

  const prevChapter = previousChapter || (chapters || []).find((c) => c.chapter_number === chapter.chapter_number - 1);
  const nextChapter = (chapters || []).find((c) => c.chapter_number === chapter.chapter_number + 1);

  return `You are a senior nonfiction chapter architect.

Your job is to build a clean, useful section plan for this chapter before prose drafting. Do not write the chapter. Do not create a source audit report. Do not create a legal memo. Create a natural nonfiction chapter plan that helps the writer produce strong, readable prose with forward movement.

═══ NONFICTION BEAT SYSTEM ═══
Template: ${template.label} (${templateKey})
Chapter position: ${chapter.chapter_number} of ${totalChapters}
Assigned chapter beat: "${chapterBeat.name}" (${chapterBeat.function})
Beat mode: ${chapterBeat.mode} | Tempo: ${chapterBeat.tempo}
Target chapter length: ~${targetWords} words
Required section count: ${sectionRange.min}-${sectionRange.max}

═══ SECTION MODES ═══
${modeDescriptions}

═══ PROJECT CONTEXT ═══
Title: ${project.title || 'Untitled'}
Genre: ${project.genre || 'Nonfiction'}${project.subgenre ? ' / ' + project.subgenre : ''}
POV: ${project.pov_mode || 'third-person / author-off-page'} | Tense: ${project.tense || 'past'}
Structure: ${project.nf_structure_mode || templateKey}

${projectContextBlock || 'No project notes were supplied. Keep the section plan general and avoid specific unsupported names, dates, sources, or claims.'}

═══ OUTLINE CONTEXT ═══
Full outline / project outline:
${safeString(project.outline_md, 3000) || 'No outline supplied.'}

Previous outline chapters:
${previousTitles || 'None.'}

Upcoming outline chapters:
${nextTitles || 'None.'}

═══ CHAPTER ${chapter.chapter_number}: "${chapter.title || 'Untitled'}" ═══
Chapter summary / intended focus:
${safeString(chapter.beat_summary || chapter.summary || '', 1800) || 'No chapter summary supplied.'}

Previous chapter endpoint:
${safeString(prevChapter?.content_md || prevChapter?.beat_summary || prevChapter?.summary || '', 1000) || 'No previous chapter yet.'}

${nextChapter ? `Next chapter planned: "${nextChapter.title || 'Untitled'}" — ${safeString(nextChapter.beat_summary || nextChapter.summary || '', 650)}` : 'This is the final chapter.'}

═══ WRITER-FIRST RECOVERY RULES ═══
- Plan the chapter like a readable nonfiction book chapter, not a spreadsheet, warning label, or source ledger.
- Each section must add new movement: a new fact, angle, person/group, document category, timeline turn, physical detail, consequence, contradiction, or interpretive step.
- Avoid repeating the same premise across sections with different wording.
- Use project-provided facts naturally. If a specific detail is not supplied, do not invent it.
- If something is uncertain, the section can instruct the writer to phrase it cautiously, but do not generate reusable caution paragraphs.
- Do not use or create canned language about casualty records, evidence arithmetic, source integrity, ledgers, or conclusions.
- Do not write the author into the scene unless the project is explicitly memoir or field reporting.
- Do not create archive-trip scenes, interview-room scenes, courthouse scenes, discovery scenes, or site-visit scenes unless the supplied project text explicitly says those scenes happened.

═══ FABRICATION BLOCKERS ═══
${FORBIDDEN_FABRICATION_TARGETS.map((line) => `- ${line}`).join('\n')}

═══ REPETITION / AI-SMELL CONTROL ═══
High-risk repeated motifs:
${MOTIF_BUDGET_TERMS.map((term) => `- ${term}`).join('\n')}

High-risk AI phrasing:
${AI_SMELL_PATTERNS.map((term) => `- ${term}`).join('\n')}

For every section:
- choose fresh vocabulary;
- vary paragraph rhythm;
- avoid ending every section with a sweeping moral conclusion;
- avoid repeated "not merely X but Y" structures;
- avoid generic summaries that could fit any chapter.

═══ REQUIRED CHAPTER SHAPE ═══
Build ${sectionRange.min}-${sectionRange.max} sections whose word targets sum to about ${targetWords} words.

A strong chapter should usually move through:
1. A concrete opening pressure or question.
2. Context that helps the reader understand the stakes.
3. The mechanism, system, timeline, or human behavior that drives the chapter.
4. A specific human consequence or affected group/person if supplied.
5. A complication, contradiction, limit, or interpretive turn.
6. A closing handoff that advances the manuscript instead of looping.

Do not force all six if the chapter needs fewer sections. Do not make each section identical in structure.

═══ OUTPUT REQUIREMENTS ═══
Return JSON only.

For EACH section, return:
- section_number: order within chapter
- title: 3-7 word title
- mode: one of the section modes listed above
- tempo: fast, medium, or slow
- purpose: what this section accomplishes for the reader
- content_direction: concrete drafting guidance for the prose writer
- evidence_needed: brief source/context category to lean on, or "project context only"
- key_claim: the main idea this section owns
- evidence_lane: the unique material lane this section uses
- opens_with: a concrete opening move
- closes_with: bridge, sharpened question, narrowed inference, or handoff
- word_target: word count for this section
- unique_material: material this section owns and other sections should not repeat
- covered_material_to_avoid: material already covered or reserved elsewhere
- escalation_question: the question or pressure this section creates
- source_confidence: confirmed, source_category_supported, inferred, unresolved, or prohibited
- solved_case_risk: true only if the section might accidentally overstate uncertainty
- citation_targets: supplied source names/categories if visible; otherwise []
- bibliography_candidates: supplied source names/categories only; otherwise []
- source_needed: specific items to verify later, if any
- evidence_objects_allowed: specific supplied evidence objects the prose may use
- evidence_objects_forbidden: tempting unsupported objects the prose must not invent
- confirmed_claims: facts directly visible in supplied project material
- supported_claims: source/category-supported items needing final citation verification
- inferred_claims: interpretations that require cautious phrasing
- unresolved_questions: open questions to leave open
- prohibited_claims: claims/details the prose must not invent
- caution_language: short, natural phrasing guidance; no boilerplate paragraphs
- fabrication_warnings: specific fake-detail risks to avoid
- fatality_count_warnings: number/name/date/legal-outcome risks, if any
- unresolved_evidence_gaps: gaps specific to this section
- human_element: named_person, affected_group, absent_names, institutional_actor, or not_applicable
- human_detail_directive: how to make the human consequence visible without inventing facts
- restricted_motifs: motifs/phrases to avoid here
- fresh_language_strategy: concrete vocabulary/composition strategy
- rhythm_directive: paragraph/rhythm guidance for less AI-polished prose
- blunt_fact_sentence: one plain sentence the prose may use or adapt if supported

Also return chapter_source_plan for compatibility. Keep it brief:
- confirmed_facts
- source_categories_used
- citation_targets
- bibliography_candidates
- research_gaps
- overclaim_risks
- contaminated_source_risks
- placeholder_source_risks
- source_needed_before_publication

Also return chapter_quality_targets:
- credibility_target: 95
- human_specificity_target: 95
- repetition_control_target: 95
- ai_smell_reduction_target: 95
- source_integrity_target: 95
- required_repairs_before_drafting: array

Also return motif_budget:
- high_risk_terms
- terms_allowed_once
- terms_to_replace
- chapter_specific_alternatives

Also return argument_progression:
- prior_chapter_endpoint
- this_chapter_advances
- new_ground
- handoff
- material_not_to_repeat_from_prior_chapters
- material_reserved_for_later_chapters
`;
}

// ── Nonfiction-specific scene beat schema ────────────────────

export const nonfictionBeatSchema = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section_number: { type: 'number' },
          title: { type: 'string' },
          mode: { type: 'string' },
          tempo: { type: 'string' },
          purpose: { type: 'string' },
          content_direction: { type: 'string' },
          evidence_needed: { type: 'string' },
          key_claim: { type: 'string' },
          evidence_lane: { type: 'string' },
          opens_with: { type: 'string' },
          closes_with: { type: 'string' },
          word_target: { type: 'number' },
          fabrication_warnings: { type: 'array', items: { type: 'string' } },
          unique_material: { type: 'string' },
          covered_material_to_avoid: { type: 'string' },
          escalation_question: { type: 'string' },
          source_confidence: { type: 'string' },
          solved_case_risk: { type: 'boolean' },
          citation_targets: { type: 'array', items: { type: 'string' } },
          bibliography_candidates: { type: 'array', items: { type: 'string' } },
          fatality_count_warnings: { type: 'array', items: { type: 'string' } },
          unresolved_evidence_gaps: { type: 'array', items: { type: 'string' } },
          source_needed: { type: 'array', items: { type: 'string' } },
          evidence_objects_allowed: { type: 'array', items: { type: 'string' } },
          evidence_objects_forbidden: { type: 'array', items: { type: 'string' } },
          confirmed_claims: { type: 'array', items: { type: 'string' } },
          supported_claims: { type: 'array', items: { type: 'string' } },
          inferred_claims: { type: 'array', items: { type: 'string' } },
          unresolved_questions: { type: 'array', items: { type: 'string' } },
          prohibited_claims: { type: 'array', items: { type: 'string' } },
          caution_language: { type: 'string' },
          human_element: { type: 'string' },
          human_detail_directive: { type: 'string' },
          restricted_motifs: { type: 'array', items: { type: 'string' } },
          fresh_language_strategy: { type: 'string' },
          rhythm_directive: { type: 'string' },
          blunt_fact_sentence: { type: 'string' },
        },
        required: [
          'section_number',
          'title',
          'mode',
          'tempo',
          'purpose',
          'content_direction',
          'key_claim',
          'evidence_lane',
          'word_target',
          'source_confidence',
          'solved_case_risk',
          'human_element',
          'human_detail_directive',
          'restricted_motifs',
          'fresh_language_strategy',
          'rhythm_directive',
        ],
      },
    },
    chapter_source_plan: {
      type: 'object',
      properties: {
        confirmed_facts: { type: 'array', items: { type: 'string' } },
        source_categories_used: { type: 'array', items: { type: 'string' } },
        citation_targets: { type: 'array', items: { type: 'string' } },
        bibliography_candidates: { type: 'array', items: { type: 'string' } },
        research_gaps: { type: 'array', items: { type: 'string' } },
        overclaim_risks: { type: 'array', items: { type: 'string' } },
        contaminated_source_risks: { type: 'array', items: { type: 'string' } },
        placeholder_source_risks: { type: 'array', items: { type: 'string' } },
        source_needed_before_publication: { type: 'array', items: { type: 'string' } },
      },
    },
    chapter_quality_targets: {
      type: 'object',
      properties: {
        credibility_target: { type: 'number' },
        human_specificity_target: { type: 'number' },
        repetition_control_target: { type: 'number' },
        ai_smell_reduction_target: { type: 'number' },
        source_integrity_target: { type: 'number' },
        required_repairs_before_drafting: { type: 'array', items: { type: 'string' } },
      },
    },
    motif_budget: {
      type: 'object',
      properties: {
        high_risk_terms: { type: 'array', items: { type: 'string' } },
        terms_allowed_once: { type: 'array', items: { type: 'string' } },
        terms_to_replace: { type: 'array', items: { type: 'string' } },
        chapter_specific_alternatives: { type: 'array', items: { type: 'string' } },
      },
    },
    argument_progression: {
      type: 'object',
      properties: {
        prior_chapter_endpoint: { type: 'string' },
        this_chapter_advances: { type: 'string' },
        new_ground: { type: 'string' },
        handoff: { type: 'string' },
        material_not_to_repeat_from_prior_chapters: { type: 'string' },
        material_reserved_for_later_chapters: { type: 'string' },
      },
      required: ['prior_chapter_endpoint', 'this_chapter_advances', 'new_ground', 'handoff'],
    },
  },
  required: ['sections', 'chapter_source_plan', 'chapter_quality_targets', 'motif_budget', 'argument_progression'],
};
