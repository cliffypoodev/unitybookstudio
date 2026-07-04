/**
 * Parallel Story Bible Generator
 * RECOVERY v3 — Strict Investigative Nonfiction Outline Firewall
 *
 * Purpose:
 * - Keep fiction foundation generation working normally.
 * - Stop nonfiction story bibles / chapter outlines from turning the author into a character.
 * - Stop fake interviews, fake archivists, fake developers, fake witnesses, fake survivors,
 *   fake logbooks, fake memos, fake primary-source discoveries, and invented named victims.
 * - Build nonfiction outlines as documentary/investigative chapter plans, not cinematic scenes.
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';
import { buildSetupConstraints } from '@/lib/setupConstraints';
import { buildTwistFoundationBlock, parseTwistsToMd } from '@/lib/plotTwists';
import { unwrapIntegrationResult } from '@/lib/autonovel';
import { getAllBlockedNames, getReplacementSuggestionsForName, countNameOccurrences, applyApprovedNameReplacementMap } from '@/lib/nameHygieneRules';

console.log('[BIBLE-PARALLEL] loaded: RECOVERY v3 strict investigative nonfiction + no fake interviews/personas');

function clipText(text = '', max = 4000) {
  return typeof text === 'string' ? text.slice(0, max) : '';
}

function safeString(value = '') {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function isNonfictionSettings(settings = {}) {
  return String(settings.book_type || '').toLowerCase() === 'nonfiction';
}

function getResearchText(settings = {}) {
  const pieces = [
    settings.research_md,
    settings.research_data,
    settings.source_notes,
    settings.bibliography_md,
    settings.seed_research,
  ];
  return pieces
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      try { return JSON.stringify(item); } catch { return ''; }
    })
    .filter(Boolean)
    .join('\n\n');
}

function buildContextBlock(seedConcept, settings) {
  const isFiction = !isNonfictionSettings(settings);
  return `TITLE: ${settings.title || 'Untitled'}
GENRE: ${settings.genre || 'General'}${settings.subgenre ? ' / ' + settings.subgenre : ''}
POV: ${settings.pov_mode || 'third-close'} | TENSE: ${settings.tense || 'past'}
${isFiction ? `BEAT STYLE: ${settings.beat_style || 'Tension-Driven'}` : `STRUCTURE: ${settings.nf_structure_mode || 'investigative'}`}
CHAPTERS: ${settings.chapter_target || 20} at ~${settings.chapter_length_target || 3500} words each

SEED CONCEPT:
${seedConcept}`;
}

function buildStrictNonfictionRules(settings = {}) {
  // GATEFIX-20: 4500 starved the bible prompts of most of the research (timeline,
  // primary sources, key-document excerpts, later figures) and invention filled the gap.
  const research = clipText(getResearchText(settings), 12000);
  return `
=== STRICT INVESTIGATIVE NONFICTION RULES ===
This is nonfiction. Do NOT structure the book as a fictional quest starring the author.

ABSOLUTE BANS:
- Do NOT invent interviews, meetings, field visits, phone calls, emails, archive appointments, conversations, dialogue, gestures, or scenes.
- Do NOT write chapter summaries like: "the author meets...", "Absheer interviews...", "the author visits...", "the author pulls files...", "he/she confronts...", "he/she discovers...", "the author traces...", "the author experiences...".
- Do NOT create fake archivists, developers, witnesses, survivors, guards, inmates, lawyers, historians, family members, or officials.
- Do NOT invent named people unless the name appears in the seed concept or supplied research/source material.
- Do NOT invent exact archival objects: redacted memos, logbooks, master keys, internal notes, work rosters, personal letters, coroner entries, fire reports, blueprints, or quotations.
- QUOTE DISCIPLINE (ABSOLUTE): Any quotation you write — in any field, chapter title, or beat summary — must be copied VERBATIM from the supplied research/source material. If the research provides no quote for a person or document, write WITHOUT a quote. Never compose, paraphrase, reconstruct, or "typify" a quote. A person whose research quote is empty stays unquoted.
- EVIDENCE DISCIPLINE: Do NOT invent statistics, counts, percentages, report excerpts, textbook excerpts, ledger entries, archive notes, newspaper lines, flag or artifact descriptions, discovery events, or scholarly citations (author + year + title). If it is not in the supplied research, it does not appear.
- ROLE FIDELITY: Every named person's role, actions, and dates must match the supplied research exactly. Never assign a person the opposite of their documented action (a person documented as ANNOUNCING freedom is never described as concealing it). Where the research is silent on intent or motive, say the record is silent.
- Do NOT use "composite" people as if they are real.
- Do NOT imply the author personally obtained, saw, interviewed, visited, or handled anything unless the seed/research explicitly says so.
- Do NOT solve an unresolved case by inventing missing records.

REQUIRED NONFICTION OUTLINE STYLE:
- Each chapter must be a documentary/investigative section, not a scene.
- Use wording like: "This chapter examines...", "This chapter reconstructs from available records...", "This chapter compares...", "This chapter separates documented fact from oral tradition...".
- If evidence is missing, say the chapter investigates the gap. Do not manufacture the missing evidence.
- Use documented source categories only: contemporary newspapers, public records, court records, institutional histories, official summaries, archives, site history, and clearly labeled oral tradition.
- Treat uncertain claims as claims, allegations, oral tradition, folklore, or unresolved questions.

PROJECT RESEARCH / SOURCE MATERIAL AVAILABLE TO FOUNDATION GENERATOR:
${research || 'No separate research text was supplied. Therefore the outline must stay conservative and avoid creating new named people, interviews, or archival discoveries.'}
=== END STRICT INVESTIGATIVE NONFICTION RULES ===`;
}

function containsNonfictionFictionalization(text = '') {
  const s = safeString(text);
  if (!s.trim()) return false;
  const patterns = [
    /\b(?:author|writer|narrator|investigator|researcher|Absheer|C\.?\s*P\.?\s*Absheer)\s+(?:meets|interviews|visits|travels|returns|arrives|walks|sits|stands|confronts|questions|pulls|opens|obtains|discovers|learns|traces|experiences|follows|tracks|speaks|talks)\b/i,
    /\b(?:meets|interviews|visits|confronts|questions|speaks with|talks with)\s+(?:archivist|developer|survivor|witness|guard|inmate|former guard|former inmate|official|historian|family member)\b/i,
    /\b(?:archivist|developer|survivor|witness|guard|inmate|official|historian)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
    /\b(?:redacted|sealed|hidden|missing)\s+(?:memo|memorandum|file|logbook|report|roster|letter|ledger)\b/i,
    /\b(?:daily|guard|shop|vocational|foreman|key)\s+logbook\b/i,
    /\bM-key\b/i,
    /\bVoc\.?\s*Shop\s*B\b/i,
    /\bShop\s*B\s+secured\s+per\s+order\b/i,
    /\bmaster\s+key\b/i,
    /\bfour\s+(?:names|dead men|victims|probable victims)\b/i,
    /\bprobable\s+(?:victims|names|dead)\b/i,
    /\b(?:Lawrence|Larry)\s+(?:Gant|Finch)\b/i,
    /\bHenry\s+Clay\b/i,
    /\bRobert\s+(?:Vickers|Lee)\b/i,
    /\bPaulie\s+Russo\b/i,
    /\bVirgil\s+Boone\b/i,
    /\bCharles\s+Everett\b/i,
    /\bRaymond\s+Joseph\b/i,
    /\bpersonal\s+letters\b/i,
    /\blast\s+living\s+witness(?:es)?\b/i,
    /\bsite\s+developer\b/i,
    /\bcasual\s+mention\s+of\s+the\s+1954\s+riot/i,
    /\bguide'?s\s+casual\s+mention/i,
  ];
  return patterns.some((rx) => rx.test(s));
}

function stripNonfictionScarTissue(text = '') {
  let out = safeString(text);
  if (!out) return '';

  const replacements = [
    [/\bThe casualty record should be treated as an evidence problem rather than a conclusion\.[\s\S]{0,450}?specific locations during the riot\.?/gi, ''],
    [/\bVoc\.?\s*Shop\s*B\s+secured\s+per\s+order\.\s*M-key\s+used\.?/gi, ''],
    [/\bM-key\b/gi, 'controlled key'],
    [/\bVoc\.?\s*Shop\s*B\b/gi, 'the vocational shop area'],
    [/\bLawrence\s+Gant\b/gi, 'an unnamed inmate'],
    [/\bLarry\s+Finch\b/gi, 'an unnamed inmate'],
    [/\bHenry\s+Clay\b/gi, 'an unnamed inmate'],
    [/\bRobert\s+Vickers\b/gi, 'an unnamed inmate'],
    [/\bRobert\s+Lee\b/gi, 'an unnamed inmate'],
    [/\bPaulie\s+Russo\b/gi, 'an unnamed inmate'],
    [/\bVirgil\s+Boone\b/gi, 'an unnamed inmate'],
    [/\bCharles\s+Everett\b/gi, 'an unnamed inmate'],
    [/\bRaymond\s+Joseph\b/gi, 'an unnamed inmate'],
  ];

  for (const [rx, replacement] of replacements) out = out.replace(rx, replacement);

  out = out
    .replace(/\b(?:author|writer|narrator|investigator|researcher|Absheer|C\.?\s*P\.?\s*Absheer)\s+(?:meets|interviews|visits|travels|returns|arrives|walks|sits|stands|confronts|questions|pulls|opens|obtains|discovers|learns|traces|experiences|follows|tracks|speaks|talks)[^.?!]*[.?!]/gi, '')
    .replace(/\b(?:meets|interviews|visits|confronts|questions|speaks with|talks with)\s+(?:archivist|developer|survivor|witness|guard|inmate|former guard|former inmate|official|historian|family member)[^.?!]*[.?!]/gi, '')
    .replace(/\b(?:redacted|sealed|hidden|missing)\s+(?:memo|memorandum|file|logbook|report|roster|letter|ledger)[^.?!]*[.?!]/gi, '')
    .replace(/\s{3,}/g, '\n\n')
    .trim();

  return out;
}

function makeSafeNonfictionBeatSummary(chapter, settings = {}, seedConcept = '') {
  const title = safeString(chapter?.title || '').trim() || `Chapter ${chapter?.chapter_number || ''}`.trim();
  const lowerTitle = title.toLowerCase();
  const subject = safeString(settings.title || '').trim() || 'the subject';

  if (lowerTitle.includes('four name') || lowerTitle.includes('names')) {
    return `This chapter examines the reported casualty claims surrounding ${subject} without inventing identities or treating missing records as proof. It compares the public death tally, documented source categories, oral tradition, and unresolved evidentiary gaps. The chapter may explain what records would be needed to verify names, but it must not create candidate victims, fake files, fake interviews, or unsupported personal histories.`;
  }

  if (lowerTitle.includes('master key') || lowerTitle.includes('key')) {
    return `This chapter examines the role of locks, access control, and institutional procedure as documented concepts, while avoiding invented key labels, fake logbooks, or unsupported claims about who locked a specific door. It frames the locked-door question as an investigative problem that requires records, not as a solved scene.`;
  }

  if (lowerTitle.includes('survivor') || lowerTitle.includes('shadow')) {
    return `This chapter examines survivor accounts, oral tradition, and later memory only where documented or clearly labeled as anecdotal. It must not invent living witnesses, interviews, post-release biographies, or personal letters. The chapter should separate memory, folklore, tourism narrative, and verifiable record.`;
  }

  if (lowerTitle.includes('archive') || lowerTitle.includes('record')) {
    return `This chapter examines available public records and archival source categories related to ${subject}. It explains what the records establish, what they do not establish, and what additional documentation would be needed. It must not invent archivists, appointments, redacted memos, or discovered files.`;
  }

  return `This chapter investigates ${title} as a strict nonfiction section about ${subject}. It should use documented chronology, public records, institutional context, and clearly labeled uncertainty. It must avoid invented interviews, invented named people, fake documents, staged scenes, and author-as-character narration. The chapter should separate confirmed facts from claims, oral tradition, interpretation, and unresolved gaps.`;
}

function normalizeNonfictionChapter(chapter, index, settings = {}, seedConcept = '') {
  const chapterNumber = Number(chapter?.chapter_number || index + 1);
  let title = safeString(chapter?.title || '').trim() || `Chapter ${chapterNumber}`;
  let beatSummary = safeString(chapter?.beat_summary || '').trim();

  title = stripNonfictionScarTissue(title).replace(/^Chapter\s+\d+\s*[:.-]\s*/i, '').trim() || `Chapter ${chapterNumber}`;
  beatSummary = stripNonfictionScarTissue(beatSummary);

  if (!beatSummary || containsNonfictionFictionalization(`${title}\n${beatSummary}`)) {
    console.warn('[BIBLE-PARALLEL][NF-OUTLINE-FIREWALL] Rewrote unsafe nonfiction chapter plan:', chapterNumber, title);
    beatSummary = makeSafeNonfictionBeatSummary({ ...chapter, chapter_number: chapterNumber, title }, settings, seedConcept);
  }

  return {
    chapter_number: chapterNumber,
    title,
    beat_summary: beatSummary,
  };
}

function buildSafeNonfictionChapters(seedConcept, settings = {}) {
  const chapterCount = Number(settings.chapter_target || 20) || 20;
  const templates = [
    ['The Central Claim', 'This chapter defines the central nonfiction question and separates documented facts from claims, oral tradition, and unresolved uncertainty.'],
    ['The Public Record', 'This chapter examines the public record, contemporary reporting, official summaries, and what those records do and do not establish.'],
    ['The Historical Context', 'This chapter reconstructs the broader historical context using documented conditions, institutions, timelines, and source categories.'],
    ['The Event Timeline', 'This chapter builds a careful chronology from available evidence without inventing scenes, dialogue, or undocumented witnesses.'],
    ['The Institution', 'This chapter examines the institution, its procedures, its incentives, and its documented operating culture.'],
    ['The Physical Site', 'This chapter examines the physical location and built environment as source context while avoiding unsupported forensic certainty.'],
    ['The Conflicting Accounts', 'This chapter compares official accounts, secondary histories, oral tradition, and unresolved contradictions.'],
    ['The Missing Evidence', 'This chapter identifies the exact records that would be needed to verify unresolved claims and explains why absence is not proof.'],
    ['The Human Cost', 'This chapter discusses the human consequences using documented people and verified source material only.'],
    ['The Aftermath', 'This chapter examines official response, public narrative, reform, memory, and institutional self-protection.'],
    ['The Myth and the Record', 'This chapter separates folklore, tourism narrative, and cultural memory from verifiable documentation.'],
    ['What Can Be Known', 'This chapter states the strongest supportable conclusions and marks unresolved questions clearly.'],
  ];

  const chapters = [];
  for (let i = 0; i < chapterCount; i += 1) {
    const t = templates[i % templates.length];
    chapters.push({
      chapter_number: i + 1,
      title: t[0],
      beat_summary: `${t[1]} It must not invent interviews, named witnesses, fake records, composite people, or author-as-character scenes.`,
    });
  }
  return chapters;
}

function normalizeNonfictionFoundation(result = {}, settings = {}, seedConcept = '') {
  const chapterCount = Number(settings.chapter_target || 20) || 20;
  let outlineMd = stripNonfictionScarTissue(result.outline_md || '');
  let chapters = Array.isArray(result.chapters) ? result.chapters : [];

  chapters = chapters
    .slice(0, chapterCount)
    .map((chapter, index) => normalizeNonfictionChapter(chapter, index, settings, seedConcept));

  const unsafeOutline = containsNonfictionFictionalization(outlineMd);
  const tooFew = chapters.length < chapterCount;

  if (unsafeOutline) {
    console.warn('[BIBLE-PARALLEL][NF-OUTLINE-FIREWALL] Outline markdown contained fictionalized investigative scenes. Rebuilding conservative outline_md.');
    outlineMd = '';
  }

  if (tooFew) {
    console.warn('[BIBLE-PARALLEL][NF-OUTLINE-FIREWALL] Not enough safe nonfiction chapters. Filling with conservative documentary chapters:', chapters.length, '/', chapterCount);
    const fallback = buildSafeNonfictionChapters(seedConcept, settings);
    const existingNums = new Set(chapters.map((ch) => Number(ch.chapter_number)));
    for (const fb of fallback) {
      if (chapters.length >= chapterCount) break;
      if (!existingNums.has(Number(fb.chapter_number))) chapters.push(fb);
    }
  }

  chapters = chapters
    .slice(0, chapterCount)
    .map((chapter, index) => ({ ...chapter, chapter_number: index + 1 }));

  if (!outlineMd.trim()) {
    outlineMd = chapters
      .map((chapter) => `## Chapter ${chapter.chapter_number}: ${chapter.title}\n${chapter.beat_summary}`)
      .join('\n\n');
  }

  return {
    ...result,
    outline_md: outlineMd,
    chapters,
  };
}

// ── Batch 1 Prompts ──────────────────────────────────────────────────────

function buildWorldPrompt(seedConcept, settings, nameBlock) {
  const constraintBlock = buildSetupConstraints(settings);
  const isFiction = !isNonfictionSettings(settings);
  const ctx = buildContextBlock(seedConcept, settings);
  const nonfictionRules = isFiction ? '' : buildStrictNonfictionRules(settings);
  return `${constraintBlock}\n${nameBlock}\n${nonfictionRules}\nYou are a world-class ${isFiction ? 'story architect' : 'investigative nonfiction architect'}. Generate ONLY the world/setting document for this book.

${ctx}

Generate world_md: ${isFiction
    ? 'Setting, rules, history, geography, culture, power structures, sensory palette. Include premise, tensions, and atmosphere. 400+ words.'
    : 'Documented historical context, institutional landscape, key locations, source categories, time periods, public-record boundaries, and unresolved evidentiary gaps. Do not invent scenes, visits, interviews, named witnesses, or archival discoveries. 400+ words.'}

Return JSON only: { "world_md": "..." }`;
}

function buildCharactersPrompt(seedConcept, settings, nameBlock) {
  const constraintBlock = buildSetupConstraints(settings);
  const ctx = buildContextBlock(seedConcept, settings);
  const isFiction = !isNonfictionSettings(settings);
  const nonfictionRules = isFiction ? '' : buildStrictNonfictionRules(settings);
  return `${constraintBlock}\n${nameBlock}\n${nonfictionRules}\nYou are a world-class ${isFiction ? 'story architect' : 'investigative nonfiction architect'}. Generate ONLY the people/stakeholder/source-landscape document for this book.

${ctx}

Generate characters_md: ${isFiction
    ? `Major characters with FULL CHARACTER DEPTH PROFILES (600+ words). For EACH major character (protagonist, love interest, antagonist, up to 2 key supporting), include ALL of:

STRUCTURAL: Wound, Want, Need, Lie, Arc
BEHAVIORAL: Coping mechanism, Tell, Social mask, Humor style
RELATIONAL: Attachment style, Key relationship dynamic (specific friction), Dialogue fingerprint (2-3 unique verbal habits)
SENSORY: Signature sense, Comfort object/ritual, Body in space
ARC MILESTONES: Breaking point chapter, Moment of grace, Identity sacrifice

Characters must feel like real people with contradictions and behavioral specificity.`
    : 'Documented people, institutions, stakeholder groups, and source categories only. Do not invent archivists, developers, witnesses, survivors, guards, inmates, family members, or experts. Do not turn the author into a protagonist. If a person is not supplied in seed/research, describe the category instead of naming them. 400+ words.'}

Return JSON only: { "characters_md": "..." }`;
}

function buildVoicePrompt(seedConcept, settings) {
  const constraintBlock = buildSetupConstraints(settings);
  const ctx = buildContextBlock(seedConcept, settings);
  const isFiction = !isNonfictionSettings(settings);
  const nonfictionRules = isFiction ? '' : buildStrictNonfictionRules(settings);
  return `${constraintBlock}\n${nonfictionRules}\nYou are a world-class ${isFiction ? 'story architect' : 'investigative nonfiction editor'}. Generate ONLY the prose voice guide for this book.

${ctx}

Generate voice_md: Prose style guide — sentence rhythm, vocabulary level, do/avoid patterns, dialogue approach, description density. 200+ words.

${isFiction ? '' : `NONFICTION VOICE RULE: The book should read like serious investigative nonfiction, not a memoir quest and not a novel. No invented scenes, no fake dialogue, no staged interviews, no author-as-character action. It may be cinematic in atmosphere, but every factual claim must remain document-grounded or clearly framed as uncertainty.`}

CRITICAL VOICE GUIDE RULE: The voice guide MUST respect the project's configured tense (${settings.tense || 'past'}) and POV (${settings.pov_mode || 'third-close'}). Do NOT import a reference author's default tense or POV if they conflict. The voice guide describes STYLE, not mechanics.${settings.author_voice && settings.author_voice !== 'Custom / None' ? `\nAUTHOR VOICE: Write in the style of ${settings.author_voice}. Adapt their craft to the project's tense and POV.` : ''}${settings.author_voice_notes ? `\nCUSTOM VOICE NOTES: ${settings.author_voice_notes}` : ''}${settings.protagonist_pronouns ? `\nProtagonist pronouns: ${settings.protagonist_pronouns}` : ''}

Return JSON only: { "voice_md": "..." }`;
}

// ── Batch 2 Prompts ──────────────────────────────────────────────────────

function buildCanonPrompt(seedConcept, settings, worldMd) {
  const ctx = buildContextBlock(seedConcept, settings);
  const isFiction = !isNonfictionSettings(settings);
  const nonfictionRules = isFiction ? '' : buildStrictNonfictionRules(settings);
  return `${nonfictionRules}\nYou are a world-class ${isFiction ? 'story architect' : 'investigative nonfiction editor'}. Generate ONLY the canon document for this book.

${ctx}

WORLD (already generated):
${clipText(worldMd, 3000)}

Generate canon_md: ${isFiction
    ? 'Hard facts and consistency anchors that future chapters must respect. Names, dates, locations, rules, power structures, relationships. 200+ words.'
    : 'Strictly supportable facts, named entities already present in supplied material, source boundaries, unresolved questions, and claims that must remain conditional. Do not invent new named people, records, or discoveries. 200+ words.'}

Return JSON only: { "canon_md": "..." }`;
}

function buildMysteryPrompt(seedConcept, settings, charactersMd) {
  const ctx = buildContextBlock(seedConcept, settings);
  const isFiction = !isNonfictionSettings(settings);
  const nonfictionRules = isFiction ? '' : buildStrictNonfictionRules(settings);
  return `${nonfictionRules}\nYou are a world-class ${isFiction ? 'story architect' : 'investigative nonfiction editor'}. Generate ONLY the mystery/tension document for this book.

${ctx}

PEOPLE / STAKEHOLDER LANDSCAPE (already generated):
${clipText(charactersMd, 3000)}

Generate mystery_md: ${isFiction
    ? 'Central mystery or hidden truth, clue placement strategy, revelation path, what the reader knows vs. what the characters know. 200+ words.'
    : 'Central investigative question, evidence gaps, competing explanations, and what the book can responsibly examine without claiming unsupported proof. Do not invent witnesses, interviews, documents, or a solved-case ending. 200+ words.'}

Return JSON only: { "mystery_md": "..." }`;
}

function buildOutlinePrompt(seedConcept, settings, worldMd, charactersMd) {
  const constraintBlock = buildSetupConstraints(settings);
  const ctx = buildContextBlock(seedConcept, settings);
  const chapterCount = settings.chapter_target || 20;
  const isFiction = !isNonfictionSettings(settings);
  const spice = Number(settings.spice_level || 0);
  const violence = Number(settings.violence_level || 0);
  const spiceBlock = spice >= 3 && isFiction
    ? `\nSPICE ${spice}/4: At least 20-30% of chapters should feature intimate content. Label these clearly in beat_summary.\n`
    : '';
  const violenceBlock = violence >= 3 && isFiction
    ? `\nVIOLENCE ${violence}/5: Include significant action/violence scenes where appropriate. Label intensity in beat_summary.\n`
    : '';
  const nonfictionRules = isFiction ? '' : buildStrictNonfictionRules(settings);

  const nonfictionOutlineRules = isFiction ? '' : `
=== NONFICTION CHAPTER OUTLINE FORMAT ===
For each chapter title and beat_summary:
- Write as a documentary section plan, not as a scene.
- Preferred summary verbs: examines, reconstructs, compares, contextualizes, investigates, tests, separates, traces through records.
- Banned summary verbs when attached to author/researcher: meets, interviews, visits, confronts, pulls, discovers, experiences, sits with, walks with, talks to.
- Do not use "Absheer" as an active character in chapter summaries.
- Do not create fake characters such as archivists, developers, last living witnesses, survivors, guards, or inmates.
- Do not create fake source discoveries like redacted memos, personal letters, logbooks, master keys, or named victim files.
- Do not title chapters around invented names.
- If the project involves a legend or disputed claim, outline chapters around: public record, oral tradition, physical site, source gaps, competing explanations, aftermath, memory, and responsible conclusion.
- The outline can be dramatic, but the drama must come from documented uncertainty and historical stakes, not invented fieldwork.
- Beat summaries must NOT end on a quoted "resolution" unless that exact quote exists verbatim in the supplied research. A beat with no documented quote ends on the documented event or the documented gap — never on an invented line.
=== END NONFICTION CHAPTER OUTLINE FORMAT ===`;

  return `${constraintBlock}\n${nonfictionRules}\nYou are a world-class ${isFiction ? 'story architect' : 'investigative nonfiction book architect'}. Generate ONLY the chapter outline for this book.

${ctx}
${spiceBlock}${violenceBlock}
WORLD / HISTORICAL CONTEXT (already generated):
${clipText(worldMd, 2500)}

PEOPLE / STAKEHOLDER LANDSCAPE (already generated):
${clipText(charactersMd, 2500)}
${nonfictionOutlineRules}

Generate:
- outline_md: Chapter-by-chapter outline matching the ${isFiction ? 'beat style' : 'investigative nonfiction structure'}. Map the full book across ALL ${chapterCount} chapters. 300+ words.
- chapters: Array of EXACTLY ${chapterCount} items, each with {chapter_number, title, beat_summary}. Number 1 through ${chapterCount}. Do NOT stop early.

=== CRITICAL: CHAPTER COUNT ENFORCEMENT ===
You MUST return EXACTLY ${chapterCount} chapters in the chapters array.
Do NOT truncate at 5, 10, or any other number.
The user has configured ${chapterCount} chapters and EVERY SINGLE ONE must be present.
If you run out of output space, prioritize completing the chapters array over the outline_md text.
Number them sequentially from 1 through ${chapterCount}.
=== END CHAPTER COUNT ENFORCEMENT ===

Return JSON only: { "outline_md": "...", "chapters": [...] }`;
}

// ── Chapter Repair Prompt (when outline truncated) ──────────────────────

function buildChapterRepairPrompt(seedConcept, settings, outlineMd, charactersMd, worldMd, existingChapters, fromNumber, toNumber) {
  const ctx = buildContextBlock(seedConcept, settings);
  const isFiction = !isNonfictionSettings(settings);
  const nonfictionRules = isFiction ? '' : buildStrictNonfictionRules(settings);
  const existingSummary = existingChapters
    .map(ch => `Chapter ${ch.chapter_number}: "${ch.title}" — ${ch.beat_summary}`)
    .join('\n');

  return `${nonfictionRules}\nYou are a world-class ${isFiction ? 'story architect' : 'investigative nonfiction book architect'}. The outline generation was TRUNCATED and only produced ${existingChapters.length} chapters instead of the required ${toNumber}.

You MUST generate the REMAINING chapters from ${fromNumber} through ${toNumber}.

${ctx}

WORLD:
${clipText(worldMd, 2000)}

PEOPLE / STAKEHOLDER LANDSCAPE:
${clipText(charactersMd, 2000)}

OUTLINE SO FAR:
${clipText(outlineMd, 2000)}

EXISTING CHAPTERS (already generated — do NOT repeat these):
${existingSummary}

Generate:
- outline_md: Brief continuation of the outline covering chapters ${fromNumber}-${toNumber}
- chapters: Array of EXACTLY ${toNumber - fromNumber + 1} items, numbered ${fromNumber} through ${toNumber}. Each with {chapter_number, title, beat_summary}.

${isFiction
    ? `The new chapters must continue the story arc naturally from where chapter ${fromNumber - 1} left off, building toward a satisfying conclusion.`
    : 'The new chapters must continue the investigative nonfiction structure. Do not invent interviews, author fieldwork, named witnesses, fake documents, fake archival discoveries, or solved-case evidence.'}

Return JSON only: { "outline_md": "...", "chapters": [...] }`;
}

// ── Batch 3 Prompt ───────────────────────────────────────────────────────

function buildTwistsPrompt(seedConcept, settings, outlineMd, charactersMd) {
  const ctx = buildContextBlock(seedConcept, settings);
  const twistBlock = buildTwistFoundationBlock(settings);
  return `You are a world-class story architect. Generate ONLY the plot twists for this book.

${ctx}

OUTLINE (already generated):
${clipText(outlineMd, 3000)}

CHARACTERS:
${clipText(charactersMd, 2000)}

${twistBlock}

Return JSON only with a "twists" array.`;
}

// ── Schemas ──────────────────────────────────────────────────────────────

const singleFieldSchema = (field) => ({
  type: 'object',
  properties: { [field]: { type: 'string' } },
  required: [field],
});

const outlineSchema = {
  type: 'object',
  properties: {
    outline_md: { type: 'string' },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          chapter_number: { type: 'number' },
          title: { type: 'string' },
          beat_summary: { type: 'string' },
        },
        required: ['chapter_number', 'title', 'beat_summary'],
      },
    },
  },
  required: ['outline_md', 'chapters'],
};

const twistsSchema = {
  type: 'object',
  properties: {
    twists: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          twist_number: { type: 'number' },
          name: { type: 'string' },
          type: { type: 'string' },
          chapter_placement: { type: 'number' },
          setup_chapters: { type: 'string' },
          the_twist: { type: 'string' },
          the_truth: { type: 'string' },
          clues_to_plant: { type: 'array', items: { type: 'string' } },
          emotional_impact: { type: 'string' },
          consequences: { type: 'string' },
          foreshadowing_rule: { type: 'string' },
        },
        required: ['name', 'type', 'the_twist', 'the_truth'],
      },
    },
  },
  required: ['twists'],
};

// ── Main Entry Point ─────────────────────────────────────────────────────

export async function generateBibleParallel(seedConcept, settings, options = {}) {
  const { onProgress, nameBlock = '' } = options;
  const model = pickModel('foundation', settings);
  const fallback = pickFallbackModel('foundation');
  const isFiction = !isNonfictionSettings(settings);

  const callLLM = async (prompt, schema, extraOpts = {}) => {
    const raw = await invokeLLMWithRetry({
    task_type: 'foundation',
      prompt,
      response_json_schema: schema,
      model,
      spec: settings,
      fallback_model: fallback,
      ...extraOpts,
    });
    return unwrapIntegrationResult(raw);
  };

  // ── BATCH 1: world + people/stakeholders + voice (independent) ──
  onProgress?.('Bible: Batch 1/3 — world, people, voice…');
  console.log('[BIBLE-PARALLEL] Starting Batch 1 (world + people/stakeholders + voice)');
  const t1 = Date.now();

  // GATEFIX-18: SEQUENTIAL — one local LLM call at a time (M1 constraint).
  // Promise.all here fired 3 concurrent requests and broke the local server.
  onProgress?.('Bible: world (1/6)…');
  const worldResult = await callLLM(buildWorldPrompt(seedConcept, settings, nameBlock), singleFieldSchema('world_md'));
  onProgress?.('Bible: people (2/6)…');
  const charsResult = await callLLM(buildCharactersPrompt(seedConcept, settings, nameBlock), singleFieldSchema('characters_md'));
  onProgress?.('Bible: voice (3/6)…');
  const voiceResult = await callLLM(buildVoicePrompt(seedConcept, settings), singleFieldSchema('voice_md'));

  let worldMd = worldResult?.world_md || '';
  let charactersMd = charsResult?.characters_md || '';
  let voiceMd = voiceResult?.voice_md || '';

  if (!isFiction) {
    worldMd = stripNonfictionScarTissue(worldMd);
    charactersMd = stripNonfictionScarTissue(charactersMd);
    voiceMd = stripNonfictionScarTissue(voiceMd);
  }

  console.log('[BIBLE-PARALLEL] Batch 1 done in', Math.round((Date.now() - t1) / 1000), 's. World:', worldMd.length, '| People:', charactersMd.length, '| Voice:', voiceMd.length);

  // ── BATCH 2: canon + mystery + outline (need Batch 1) ──
  onProgress?.('Bible: Batch 2/3 — canon, investigation path, outline…');
  console.log('[BIBLE-PARALLEL] Starting Batch 2 (canon + mystery/investigation + outline)');
  const t2 = Date.now();

  // GATEFIX-18: SEQUENTIAL — one local LLM call at a time (M1 constraint).
  onProgress?.('Bible: canon (4/6)…');
  const canonResult = await callLLM(buildCanonPrompt(seedConcept, settings, worldMd), singleFieldSchema('canon_md'));
  onProgress?.('Bible: investigation path (5/6)…');
  const mysteryResult = await callLLM(buildMysteryPrompt(seedConcept, settings, charactersMd), singleFieldSchema('mystery_md'));
  onProgress?.('Bible: outline (6/6)…');
  const outlineResultRaw = await callLLM(buildOutlinePrompt(seedConcept, settings, worldMd, charactersMd), outlineSchema, { max_tokens: 16384 });

  let canonMd = canonResult?.canon_md || '';
  let mysteryMd = mysteryResult?.mystery_md || '';
  let outlineResult = outlineResultRaw || {};

  if (!isFiction) {
    canonMd = stripNonfictionScarTissue(canonMd);
    mysteryMd = stripNonfictionScarTissue(mysteryMd);
    outlineResult = normalizeNonfictionFoundation(outlineResult, settings, seedConcept);
  }

  let outlineMd = outlineResult?.outline_md || '';
  let chapters = Array.isArray(outlineResult?.chapters) ? outlineResult.chapters : [];

  console.log('[BIBLE-PARALLEL] Batch 2 done in', Math.round((Date.now() - t2) / 1000), 's. Canon:', canonMd.length, '| Mystery:', mysteryMd.length, '| Outline:', outlineMd.length, '| Chapters:', chapters.length);

  // ── REPAIR: If outline returned fewer chapters than requested, generate the missing ones ──
  const targetCount = Number(settings.chapter_target || 20) || 20;
  if (chapters.length > 0 && chapters.length < targetCount) {
    console.warn('[BIBLE-PARALLEL] Outline returned', chapters.length, 'chapters but need', targetCount, '. Generating remaining…');
    onProgress?.(`Bible: Filling missing chapters (${chapters.length}/${targetCount})…`);
    const missingFrom = chapters.length + 1;
    const repairResultRaw = await callLLM(
      buildChapterRepairPrompt(seedConcept, settings, outlineMd, charactersMd, worldMd, chapters, missingFrom, targetCount),
      outlineSchema,
      { max_tokens: 16384 }
    );
    let repairResult = repairResultRaw;
    if (!isFiction) repairResult = normalizeNonfictionFoundation(repairResultRaw || {}, { ...settings, chapter_target: targetCount - chapters.length }, seedConcept);
    const repairChapters = Array.isArray(repairResult?.chapters) ? repairResult.chapters : [];
    if (repairChapters.length > 0) {
      chapters = [...chapters, ...repairChapters].slice(0, targetCount).map((ch, idx) => ({ ...ch, chapter_number: idx + 1 }));
      console.log('[BIBLE-PARALLEL] After repair:', chapters.length, 'chapters');
    }
  }

  if (!isFiction) {
    chapters = chapters.slice(0, targetCount).map((chapter, index) => normalizeNonfictionChapter(chapter, index, settings, seedConcept));
  }

  // ── BATCH 3: twists (needs outline) — fiction only ──
  let twistsMd = '';
  if (isFiction) {
    onProgress?.('Bible: Batch 3/3 — plot twists…');
    console.log('[BIBLE-PARALLEL] Starting Batch 3 (twists)');
    const t3 = Date.now();

    const twistsResult = await callLLM(
      buildTwistsPrompt(seedConcept, settings, outlineMd, charactersMd),
      twistsSchema
    );
    twistsMd = parseTwistsToMd(twistsResult?.twists);

    console.log('[BIBLE-PARALLEL] Batch 3 done in', Math.round((Date.now() - t3) / 1000), 's. Twists:', twistsMd.length);
  }

  // ── GENERATION-TIME NAME GATE (fiction only) ──
  // Catch banned AI-slop names in the bible BEFORE any chapter is drafted from it, so the book
  // is written with grounded names from the start (no post-hoc rename churn). Nonfiction names
  // are real, documented people — never auto-rename them.
  if (isFiction) {
    const blockedNames = getAllBlockedNames();
    const presentNames = blockedNames.filter((n) => countNameOccurrences(charactersMd, n) > 0);
    if (presentNames.length) {
      const usedNames = new Set(presentNames.map((n) => n.toLowerCase()));
      const nameMap = {};
      for (const nm of presentNames) {
        const sugg = getReplacementSuggestionsForName(nm);
        const pick = sugg.find((s) => !usedNames.has(s.toLowerCase()) && countNameOccurrences(charactersMd, s) === 0) || sugg[0];
        nameMap[nm] = pick;
        usedNames.add(pick.toLowerCase());
      }
      console.log('[BIBLE-PARALLEL] name gate auto-renaming banned names: ' + JSON.stringify(nameMap));
      const fixNames = (s) => (s ? applyApprovedNameReplacementMap(s, nameMap).text : s);
      worldMd = fixNames(worldMd);
      charactersMd = fixNames(charactersMd);
      voiceMd = fixNames(voiceMd);
      canonMd = fixNames(canonMd);
      mysteryMd = fixNames(mysteryMd);
      outlineMd = fixNames(outlineMd);
      twistsMd = fixNames(twistsMd);
      chapters = chapters.map((ch) => ({
        ...ch,
        title: fixNames(ch.title),
        beat_summary: fixNames(ch.beat_summary),
      }));
    }
  }

  const totalTime = Math.round((Date.now() - t1) / 1000);
  console.log('[BIBLE-PARALLEL] Total bible generation:', totalTime, 's');

  return {
    world_md: worldMd,
    characters_md: charactersMd,
    voice_md: voiceMd,
    canon_md: canonMd,
    mystery_md: mysteryMd,
    outline_md: !isFiction
      ? chapters.map((chapter) => `## Chapter ${chapter.chapter_number}: ${chapter.title}\n${chapter.beat_summary}`).join('\n\n')
      : outlineMd,
    twists_md: twistsMd,
    chapters,
    foundation_score: 8,
  };
}
