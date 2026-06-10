/**
 * Plot Twists System — Configuration, Generation, and Prose Injection
 *
 * Hardened for mixed Base44 storage shapes:
 * - accepts Markdown strings
 * - accepts arrays of twist objects
 * - accepts whole project objects
 * - accepts chapter objects
 * - never calls .split() on non-strings
 */

// ── Setup UI Options ─────────────────────────────────────────────────────

export const TWIST_COUNT_OPTIONS = [
  { value: 0, label: 'None — straightforward narrative' },
  { value: 1, label: '1 — Single major reveal' },
  { value: 2, label: '2 — One mid-story, one climax' },
  { value: 3, label: '3 — Standard (recommended)' },
  { value: 4, label: '4 — Complex layered reveals' },
  { value: 5, label: '5 — Thriller-density twists' },
  { value: 7, label: '7+ — Puzzle-box narrative' },
];

export const TWIST_INTENSITY_OPTIONS = [
  { value: 'subtle', label: 'Subtle — quiet reveals that shift perspective' },
  { value: 'moderate', label: 'Moderate — clear surprises that change the stakes' },
  { value: 'dramatic', label: 'Dramatic — gut-punch reveals that redefine the story' },
  { value: 'devastating', label: 'Devastating — reality-shattering twists' },
];

export function getTwistCountDescription(count) {
  const descriptions = {
    0: 'No surprises — the story is driven by character and situation, not reveals.',
    1: 'A single defining twist that reframes the entire story. Best for literary fiction and character studies.',
    2: 'A midpoint twist that raises the stakes and a climax twist that redefines the resolution. Classic structure.',
    3: 'Early mystery, midpoint revelation, and climax twist. Works for most thrillers, sci-fi, and mysteries.',
    4: 'Layered reveals that peel back the truth in stages. Good for conspiracy thrillers and complex mysteries.',
    5: 'High-density twists — the reader is constantly re-evaluating what they know. Thriller and horror territory.',
    7: 'Puzzle-box storytelling where every chapter recontextualizes the previous ones. Use with caution.',
  };

  return descriptions[count] || '';
}

export function getTwistIntensityDescription(intensity) {
  const descriptions = {
    subtle:
      "Small shifts in understanding. A character's motive isn't what it seemed. The reader says 'oh... I see.' Best for literary fiction and romance.",
    moderate:
      "Clear, satisfying surprises. An ally had a hidden agenda. The reader says 'I didn't see that coming.' Works for most genres.",
    dramatic:
      "Major reveals that restructure the reader's understanding. The protagonist's wound is connected to the antagonist. The reader says 'WHAT.'",
    devastating:
      'Reality-breaking twists that shatter characters and reader. The narrator has been lying. Nothing believed is true. The reader throws the book — and picks it back up.',
  };

  return descriptions[intensity] || '';
}

// ── Safe Normalizers ─────────────────────────────────────────────────────

function safeString(value) {
  if (value == null) return '';

  if (typeof value === 'string') return value;

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return parseTwistsToMd(value);
  }

  if (typeof value === 'object') {
    if (typeof value.twists_md === 'string') return value.twists_md;
    if (typeof value.twist_md === 'string') return value.twist_md;
    if (typeof value.twists === 'string') return value.twists;
    if (typeof value.twists_json === 'string') return value.twists_json;
    if (typeof value.twistsJson === 'string') return value.twistsJson;
    if (typeof value.twist_plan === 'string') return value.twist_plan;
    if (typeof value.twistPlan === 'string') return value.twistPlan;

    if (Array.isArray(value.twists)) return parseTwistsToMd(value.twists);
    if (Array.isArray(value.twists_json)) return parseTwistsToMd(value.twists_json);
    if (Array.isArray(value.twistsJson)) return parseTwistsToMd(value.twistsJson);
    if (Array.isArray(value.twist_plan)) return parseTwistsToMd(value.twist_plan);
    if (Array.isArray(value.twistPlan)) return parseTwistsToMd(value.twistPlan);

    const nested =
      value.twists_md ||
      value.twist_md ||
      value.twists ||
      value.twists_json ||
      value.twistsJson ||
      value.twist_plan ||
      value.twistPlan;

    if (nested && typeof nested === 'object') {
      try {
        if (Array.isArray(nested.items)) return parseTwistsToMd(nested.items);
        if (Array.isArray(nested.twists)) return parseTwistsToMd(nested.twists);
        return JSON.stringify(nested, null, 2);
      } catch {
        return '';
      }
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }

  return '';
}

function parseMaybeJson(value) {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();

  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function normalizeTwistsInput(input) {
  if (!input) return '';

  if (Array.isArray(input)) {
    return parseTwistsToMd(input);
  }

  if (typeof input === 'object') {
    const direct =
      input.twists_md ||
      input.twist_md ||
      input.twists ||
      input.twists_json ||
      input.twistsJson ||
      input.twist_plan ||
      input.twistPlan;

    if (Array.isArray(direct)) return parseTwistsToMd(direct);

    if (typeof direct === 'string') {
      const parsed = parseMaybeJson(direct);

      if (Array.isArray(parsed)) return parseTwistsToMd(parsed);
      if (parsed?.twists && Array.isArray(parsed.twists)) return parseTwistsToMd(parsed.twists);

      return direct;
    }

    if (direct && typeof direct === 'object') {
      if (Array.isArray(direct.twists)) return parseTwistsToMd(direct.twists);
      if (Array.isArray(direct.items)) return parseTwistsToMd(direct.items);

      return safeString(direct);
    }
  }

  const asString = safeString(input);
  const parsed = parseMaybeJson(asString);

  if (Array.isArray(parsed)) return parseTwistsToMd(parsed);
  if (parsed?.twists && Array.isArray(parsed.twists)) return parseTwistsToMd(parsed.twists);

  return asString;
}

function normalizeChapterNumber(chapterOrNumber) {
  if (typeof chapterOrNumber === 'number') return chapterOrNumber;

  if (typeof chapterOrNumber === 'string') {
    const n = Number(chapterOrNumber.match(/\d+/)?.[0] || chapterOrNumber);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  if (chapterOrNumber && typeof chapterOrNumber === 'object') {
    const raw =
      chapterOrNumber.chapter_number ||
      chapterOrNumber.chapterNumber ||
      chapterOrNumber.number ||
      chapterOrNumber.index ||
      chapterOrNumber.position ||
      chapterOrNumber.order;

    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  return null;
}

function normalizeSetupChapters(value) {
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
  }

  if (typeof value === 'number') return [value];

  if (!value) return [];

  const raw = String(value);
  const numbers = [];

  const rangeMatches = raw.matchAll(/(\d+)\s*[-–—]\s*(\d+)/g);
  for (const match of rangeMatches) {
    const start = Number(match[1]);
    const end = Number(match[2]);

    if (Number.isFinite(start) && Number.isFinite(end)) {
      const min = Math.min(start, end);
      const max = Math.max(start, end);

      for (let i = min; i <= max; i += 1) {
        numbers.push(i);
      }
    }
  }

  const individual = raw.match(/\d+/g) || [];
  for (const n of individual.map(Number)) {
    if (Number.isFinite(n) && n > 0) numbers.push(n);
  }

  return [...new Set(numbers)];
}

function extractSectionValue(section, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*([^\\n]+)`, 'i');
  const match = section.match(rx);
  return match ? match[1].trim() : '';
}

function extractBlock(section, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*|\\n###|$)`, 'i');
  const match = section.match(rx);
  return match ? match[1].trim() : '';
}

function normalizeTwistObject(twist, index = 0) {
  if (!twist || typeof twist !== 'object') {
    return {
      name: `Twist ${index + 1}`,
      type: 'reveal',
      chapter_placement: null,
      setup_chapters: [],
      the_twist: '',
      the_truth: safeString(twist),
      clues_to_plant: [],
      emotional_impact: '',
      consequences: '',
      foreshadowing_rule: '',
    };
  }

  return {
    twist_number: twist.twist_number || twist.number || index + 1,
    name: twist.name || twist.title || twist.twist_name || `Twist ${index + 1}`,
    type: twist.type || twist.kind || 'reveal',
    chapter_placement:
      twist.chapter_placement ||
      twist.revealed_in ||
      twist.reveal_chapter ||
      twist.chapter ||
      twist.placement ||
      null,
    setup_chapters:
      twist.setup_chapters ||
      twist.setup ||
      twist.foreshadow_chapters ||
      twist.clue_chapters ||
      [],
    the_twist:
      twist.the_twist ||
      twist.before ||
      twist.reader_believes ||
      twist.false_belief ||
      twist.apparent_truth ||
      '',
    the_truth:
      twist.the_truth ||
      twist.truth ||
      twist.after ||
      twist.real_truth ||
      twist.reveal ||
      twist.actual_truth ||
      '',
    clues_to_plant:
      twist.clues_to_plant ||
      twist.clues ||
      twist.foreshadowing ||
      twist.planted_clues ||
      [],
    emotional_impact:
      twist.emotional_impact ||
      twist.impact ||
      twist.reader_impact ||
      '',
    consequences:
      twist.consequences ||
      twist.consequence ||
      twist.after_effect ||
      '',
    foreshadowing_rule:
      twist.foreshadowing_rule ||
      twist.rule ||
      twist.hinting_rule ||
      '',
  };
}

// ── Foundation Prompt Block ──────────────────────────────────────────────

export function buildTwistFoundationBlock(settings = {}) {
  const numTwists = Number(settings.num_twists ?? settings.twist_count ?? 3);
  if (numTwists === 0) return '';

  const intensity = settings.twist_intensity || 'moderate';

  const intensityRules = {
    subtle: `SUBTLE INTENSITY RULES:
- Twists are quiet perspective shifts, not explosions.
- Focus on: recontextualized motives, misread relationships, slow-dawning realizations.
- The twist should feel INEVITABLE in retrospect.
- No one dies, no one is secretly evil. The surprise is in the MEANING of things.
- Clues should be emotions and behaviors that read differently after the reveal.`,
    moderate: `MODERATE INTENSITY RULES:
- Twists are clear, satisfying surprises that change the stakes.
- Focus on: hidden agendas, unexpected alliances, objective shifts, revealed connections.
- The twist should make the reader flip back a few pages to check.
- Characters may have lied or withheld information, but their core identity stays intact.
- Clues should be specific details — a throwaway line, an object mentioned in passing.`,
    dramatic: `DRAMATIC INTENSITY RULES:
- Twists are major revelations that restructure understanding.
- Focus on: identity reveals, protagonist-antagonist connections, betrayals by core allies.
- At least one twist should be PERSONAL — connected to the protagonist's wound or identity.
- Clues must be carefully layered — at least 3 per twist, planted 3+ chapters before the reveal.`,
    devastating: `DEVASTATING INTENSITY RULES:
- Twists shatter the characters and the reader's foundational assumptions.
- Focus on: unreliable narration, the protagonist as unwitting villain, the quest causing the catastrophe.
- At least one twist must force the protagonist to question whether they are the hero or the problem.
- Clues must be INVISIBLE on first read — they look like worldbuilding or character quirks.
- WARNING: Devastating twists require IMPECCABLE setup. Every clue must be organic.`,
  };

  return `
═══ PLOT TWISTS (generate exactly ${numTwists} twists at ${String(intensity).toUpperCase()} intensity) ═══

${intensityRules[intensity] || intensityRules.moderate}

For each twist, include in the twists array:
- twist_number: sequential
- name: Short name for this twist
- type: reveal|reversal|betrayal|identity|reframe|false_victory|false_defeat|hidden_connection|unreliable_narrator|ally_is_enemy|enemy_is_ally|the_real_threat|the_cost
- chapter_placement: Chapter number where revealed
- setup_chapters: Which earlier chapters plant clues
- the_twist: What the reader believes BEFORE
- the_truth: What the reader learns AFTER
- clues_to_plant: Array of specific clues to embed in setup chapters
- emotional_impact: How this changes the reader's feelings
- consequences: How this changes the plot going forward
- foreshadowing_rule: A specific narrative rule for hinting without revealing

TWIST PLACEMENT RULES:
- Distribute across the arc, not clustered at the end.
- At least one twist before the midpoint.
- Final twist between 75-90% — NOT the last chapter.
- Each twist needs 2-3 planted clues in earlier chapters.
- Twists should ESCALATE — each bigger or more personal than the last.
═══ END PLOT TWISTS ═══
`;
}

// ── Parse Twists JSON to Markdown ────────────────────────────────────────

export function parseTwistsToMd(twistsArray) {
  if (!twistsArray || !Array.isArray(twistsArray) || twistsArray.length === 0) return '';

  return twistsArray
    .map((rawTwist, index) => {
      const t = normalizeTwistObject(rawTwist, index);
      const clues = Array.isArray(t.clues_to_plant)
        ? t.clues_to_plant
        : safeString(t.clues_to_plant)
            .split(/\n|;/)
            .map((x) => x.trim())
            .filter(Boolean);

      const setupChapters = Array.isArray(t.setup_chapters)
        ? t.setup_chapters.join(', ')
        : safeString(t.setup_chapters);

      const lines = [];

      lines.push(`### Twist ${index + 1}: ${t.name || 'Unnamed'}`);
      lines.push(`**Type:** ${t.type || 'reveal'}`);
      lines.push(`**Revealed in:** Chapter ${t.chapter_placement || '?'}`);
      lines.push(`**Setup chapters:** ${setupChapters || '?'}`);
      lines.push('');
      lines.push('**Before the twist, the reader believes:**');
      lines.push(t.the_twist || '');
      lines.push('');
      lines.push('**After the twist, the reader learns:**');
      lines.push(t.the_truth || '');
      lines.push('');
      lines.push('**Clues to plant:**');

      if (clues.length > 0) {
        for (const clue of clues) {
          lines.push(`- ${clue}`);
        }
      }

      lines.push('');
      lines.push(`**Emotional impact:** ${t.emotional_impact || ''}`);
      lines.push(`**Consequences:** ${t.consequences || ''}`);
      lines.push(`**Foreshadowing rule:** ${t.foreshadowing_rule || ''}`);

      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}

// ── Anthology Per-Chapter Twist Injection ────────────────────────────────

/**
 * For anthology projects, twists apply PER CHAPTER / story.
 * Returns a prompt block instructing the AI to include N twists at the given
 * intensity independently within this chapter, without referencing other chapters.
 */
export function getAnthologyTwistBlock(project = {}) {
  const numTwists = Number(project.num_twists ?? project.twist_count ?? 3);
  if (numTwists === 0) return '';

  const intensity = project.twist_intensity || 'moderate';

  return `
=== STANDALONE STORY TWISTS ===
This is a standalone story within an anthology. Twists are SELF-CONTAINED — do not reference other chapters/stories.

Include exactly ${numTwists} ${intensity} twist(s) within THIS chapter.

TWIST INTENSITY: ${String(intensity).toUpperCase()}
${intensity === 'subtle' ? '- Quiet perspective shifts, recontextualized motives, slow-dawning realizations.' : ''}
${intensity === 'moderate' ? '- Clear surprises that change the stakes — hidden agendas, unexpected alliances, revealed connections.' : ''}
${intensity === 'dramatic' ? '- Gut-punch reveals that redefine the story — identity reveals, betrayals, protagonist-antagonist connections.' : ''}
${intensity === 'devastating' ? '- Reality-shattering twists that break assumptions — unreliable narration, the protagonist as unwitting villain.' : ''}

RULES:
- Plant clues organically earlier in the chapter before each reveal.
- Distribute twists across the chapter arc, not all at the end.
- Each twist must feel earned — setup before payoff.
- Twists should escalate in impact through the chapter.
=== END STANDALONE STORY TWISTS ===
`;
}

// ── Prose Prompt Injection ───────────────────────────────────────────────

function getTwistSections(twistsInput) {
  const twistsMd = normalizeTwistsInput(twistsInput);

  if (!twistsMd || String(twistsMd).trim().length < 20) return [];

  const parsed = parseMaybeJson(twistsMd);

  if (Array.isArray(parsed)) {
    return parseTwistsToMd(parsed).split(/---/).filter((section) => section.trim());
  }

  if (parsed?.twists && Array.isArray(parsed.twists)) {
    return parseTwistsToMd(parsed.twists).split(/---/).filter((section) => section.trim());
  }

  return String(twistsMd)
    .split(/^\s*---\s*$/gm)
    .filter((section) => section.trim());
}

function getChapterSpecificTwistDataFromObjects(projectOrTwists, chapterNumber) {
  let rawTwists = null;

  if (Array.isArray(projectOrTwists)) {
    rawTwists = projectOrTwists;
  } else if (projectOrTwists && typeof projectOrTwists === 'object') {
    rawTwists =
      projectOrTwists.twists ||
      projectOrTwists.twists_json ||
      projectOrTwists.twistsJson ||
      projectOrTwists.twist_plan ||
      projectOrTwists.twistPlan ||
      null;

    if (typeof rawTwists === 'string') {
      const parsed = parseMaybeJson(rawTwists);
      if (Array.isArray(parsed)) rawTwists = parsed;
      else if (parsed?.twists && Array.isArray(parsed.twists)) rawTwists = parsed.twists;
    }
  }

  if (!Array.isArray(rawTwists) || !chapterNumber) return '';

  const blocks = [];

  rawTwists.forEach((rawTwist, index) => {
    const twist = normalizeTwistObject(rawTwist, index);
    const revealChapter = Number(twist.chapter_placement);
    const setupChapters = normalizeSetupChapters(twist.setup_chapters);
    const clues = Array.isArray(twist.clues_to_plant)
      ? twist.clues_to_plant
      : safeString(twist.clues_to_plant)
          .split(/\n|;/)
          .map((x) => x.trim())
          .filter(Boolean);

    if (setupChapters.includes(chapterNumber)) {
      blocks.push(`PLANT CLUE for "${twist.name}" (revealed in Chapter ${revealChapter || '?'}):

${clues.length ? clues.map((c) => `- ${c}`).join('\n') : '- Plant a subtle, organic clue connected to this twist.'}
${twist.foreshadowing_rule ? `Foreshadowing rule: ${twist.foreshadowing_rule}` : ''}
IMPORTANT: This clue must look like natural narrative detail — not like a clue.`);
    }

    if (revealChapter === chapterNumber) {
      blocks.push(`*** TWIST REVEAL in this chapter: "${twist.name}" ***

The truth: ${twist.the_truth || twist.the_twist || 'Reveal the planned truth.'}
${twist.emotional_impact ? `Emotional impact: ${twist.emotional_impact}` : ''}
Build to this reveal naturally. Do not announce it. Let the character discover it through action, dialogue, evidence, or consequence.`);
    }

    if (revealChapter && chapterNumber > revealChapter && twist.consequences) {
      blocks.push(`TWIST CONSEQUENCE active: "${twist.name}" — ${twist.consequences}
Characters now know this truth. It should affect decisions and relationships.`);
    }

    if (revealChapter && chapterNumber < revealChapter && !setupChapters.includes(chapterNumber)) {
      blocks.push(`TWIST "${twist.name}" has NOT been revealed yet (Chapter ${revealChapter}). Do not hint at it unless a clue is specifically assigned here.`);
    }
  });

  return blocks.join('\n\n');
}

/**
 * Flexible signature support:
 * - getTwistContextForChapter(twistsMd, chapterNumber)
 * - getTwistContextForChapter(project, chapter)
 */
export function getTwistContextForChapter(twistsOrProject, chapterOrNumber) {
  const chapterNumber = normalizeChapterNumber(chapterOrNumber);

  if (!chapterNumber) return '';

  const objectContext = getChapterSpecificTwistDataFromObjects(twistsOrProject, chapterNumber);

  const sections = getTwistSections(twistsOrProject);
  const blocks = objectContext ? [objectContext] : [];

  for (const section of sections) {
    const revealValue =
      extractSectionValue(section, 'Revealed in') ||
      extractSectionValue(section, 'Reveal chapter') ||
      extractSectionValue(section, 'Chapter placement');

    const setupValue =
      extractSectionValue(section, 'Setup chapters') ||
      extractSectionValue(section, 'Setup chapter') ||
      extractSectionValue(section, 'Foreshadow chapters');

    const nameMatch =
      section.match(/###\s*Twist\s*\d*:\s*(.+)/i) ||
      section.match(/##\s*(.+)/i);

    const name = nameMatch ? nameMatch[1].trim() : 'Unknown twist';
    const revealChapter = Number(String(revealValue).match(/\d+/)?.[0] || 0) || null;
    const setupChapters = normalizeSetupChapters(setupValue);

    const isSetup = setupChapters.includes(chapterNumber);
    const isReveal = revealChapter === chapterNumber;
    const isAfterReveal = !!revealChapter && chapterNumber > revealChapter;
    const isBeforeReveal = !!revealChapter && chapterNumber < revealChapter;

    if (isSetup) {
      const cluesBlock = extractBlock(section, 'Clues to plant');
      const foreshadowingRule = extractSectionValue(section, 'Foreshadowing rule');

      blocks.push(`PLANT CLUE for "${name}" (revealed in Chapter ${revealChapter || '?'}):

${cluesBlock || '- Plant a subtle, organic clue connected to this twist.'}
${foreshadowingRule ? `Foreshadowing rule: ${foreshadowingRule}` : ''}
IMPORTANT: This clue must look like natural narrative detail — not like a clue.`);
    }

    if (isReveal) {
      const truthBlock = extractBlock(section, 'After the twist, the reader learns');
      const emotionalImpact = extractSectionValue(section, 'Emotional impact');

      blocks.push(`*** TWIST REVEAL in this chapter: "${name}" ***

The truth: ${truthBlock || 'Reveal the planned truth.'}
${emotionalImpact ? `Emotional impact: ${emotionalImpact}` : ''}
Build to this reveal naturally. Do not announce it. Let the character discover it through action, dialogue, evidence, or consequence.`);
    }

    if (isAfterReveal) {
      const consequences = extractSectionValue(section, 'Consequences');

      if (consequences) {
        blocks.push(`TWIST CONSEQUENCE active: "${name}" — ${consequences}
Characters now know this truth. It should affect decisions and relationships.`);
      }
    }

    if (isBeforeReveal && !isSetup) {
      blocks.push(`TWIST "${name}" has NOT been revealed yet (Chapter ${revealChapter}). Do not hint at it unless a clue is specifically assigned here.`);
    }
  }

  const uniqueBlocks = [...new Set(blocks.map((block) => block.trim()).filter(Boolean))];

  if (uniqueBlocks.length === 0) return '';

  return `
=== TWIST MANAGEMENT FOR THIS CHAPTER ===
${uniqueBlocks.join('\n\n')}
===
`;
}