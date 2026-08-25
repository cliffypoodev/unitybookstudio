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
import { isNonfictionProject as isNonfictionProjectAuthority } from '@/lib/projectType'; // NFCLASS-1
import { buildTwistFoundationBlock, parseTwistsToMd } from '@/lib/plotTwists';
import { checkFoundationRoleConsistency } from '@/lib/canonRoles'; // CANON-2
import { analyzeOutlineDuplication, buildOutlineDistinctnessRules, findOutlineOffenders, buildOutlineChapterRepairPrompt, spliceOutlineChapters, rebuildOutlineMd } from '@/lib/outlineDedupeGate'; // OUTLINEFIX-2/3
import { scrubModelLeaks, scrubOutlineChapters } from '@/lib/modelLeakGuard'; // LEAKFIX-2
import { BIBLE_FIELD_FLOORS, fieldLengthOk, buildFieldRetryAppendix } from '@/lib/bibleFieldGuard'; // FIELDGUARD-1
import { unwrapIntegrationResult } from '@/lib/autonovel';
import { getAllBlockedNames, getReplacementSuggestionsForName, countNameOccurrences, applyApprovedNameReplacementMap } from '@/lib/nameHygieneRules';
import { normCW, createInEV, extractProperNounPhrases } from './closedWorldText.js'; // BIBLEGUARD-NAMES-1

// TELEMETRY-1: a LOAD banner describes what a module CAN do; it must never read
// like a statement about the run in front of you. This one said "strict
// investigative nonfiction" on every import, so the console for a gothic NOVEL
// announced a nonfiction ruleset that the code correctly was not applying
// (every rule below is gated on isNonfictionSettings). Diagnosis in this app is
// done by reading the console, so a banner that misreports the mode costs real
// time - it cost some on The Gilded Hour run, 2026-08-04. The mode the run
// ACTUALLY resolved is logged at Batch 1 instead, where it can be trusted.
console.log('[BIBLE-PARALLEL] loaded: fiction + nonfiction bible generation (nonfiction firewall available)');

function clipText(text = '', max = 4000) {
  return typeof text === 'string' ? text.slice(0, max) : '';
}

function safeString(value = '') {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

// NFCLASS-1: one authority. See src/lib/projectType.js.
function isNonfictionSettings(settings = {}) {
  return isNonfictionProjectAuthority(settings);
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

function buildCanonPrompt(seedConcept, settings, worldMd, charactersMd) {
  const ctx = buildContextBlock(seedConcept, settings);
  const isFiction = !isNonfictionSettings(settings);
  const nonfictionRules = isFiction ? '' : buildStrictNonfictionRules(settings);
  return `${nonfictionRules}\nYou are a world-class ${isFiction ? 'story architect' : 'investigative nonfiction editor'}. Generate ONLY the canon document for this book.

${ctx}

WORLD (already generated):
${clipText(worldMd, 3000)}

CHARACTERS (already generated — these identities, relationships, pronouns, and roles are binding):
${clipText(charactersMd, 3500)}

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

function buildOutlinePrompt(seedConcept, settings, worldMd, charactersMd, canonMd, mysteryMd) {
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

CANON / CONTINUITY CONTRACT (binding):
${clipText(canonMd, 3000)}

MYSTERY / REVELATION PATH (binding):
${clipText(mysteryMd, 2500)}
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
${isFiction ? buildOutlineDistinctnessRules(chapterCount) : ''}

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
    ? `The new chapters must continue the story arc naturally from where chapter ${fromNumber - 1} left off, building toward a satisfying conclusion. NEVER pad by re-running events from the existing chapters: no repeated disaster of a type already used, no return to a location already used as its own chapter, no "Aftermath"/"Revisited"/"Continues" chapters, and the story must end exactly once, in chapter ${toNumber}.${buildOutlineDistinctnessRules(toNumber)}`
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

/**
 * RESUME-1 — the six bible fields, in generation order. Exported so a caller can
 * tell a PARTIAL project (interrupted, resume it) from a COMPLETE one (a
 * deliberate rebuild, do not) without keeping its own copy of the list.
 */
export const BIBLE_FIELDS = Object.freeze([
  'world_md', 'characters_md', 'voice_md', 'canon_md', 'mystery_md', 'outline_md',
]);

/**
 * The five that resume. outline_md is deliberately excluded: it is generated
 * together with the structured `chapters` array and a truncation-repair loop, so
 * carrying the markdown alone would leave the chapter list behind and produce a
 * bible whose outline and chapters disagree — the exact class of defect this
 * codebase keeps paying for. It is the last field, so an interrupted run still
 * saves five of six calls.
 */
export const BIBLE_RESUMABLE_FIELDS = Object.freeze(BIBLE_FIELDS.slice(0, 5));

export async function generateBibleParallel(seedConcept, settings, options = {}) {
  const { onProgress, nameBlock = '', resumeFrom = {} } = options;
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
      _project: settings, // ADULTROUTE-1
      fallback_model: fallback,
      ...extraOpts,
    });
    return unwrapIntegrationResult(raw);
  };

  /**
   * RESUME-1 — do not regenerate a field this project already has.
   *
   * MEASURED on The Gilded Hour, 2026-08-04. A page reload at 3:25:34 - with no
   * file change behind it, so simply a dropped HMR socket over the LAN - threw
   * away four minutes of completed work and restarted at world (1/6). There was
   * no resume path of any kind: this function always began at buildWorldPrompt.
   * A six-field sequential run takes ~20 minutes on a local 32B, so on any link
   * that can drop, or any laptop that can sleep, the run is racing the network
   * and losing everything each time it loses.
   *
   * A carried field must clear the SAME length floor a freshly generated one
   * does (fieldLengthOk), so resume can never smuggle in a short field that the
   * field guard would have rejected. Whether resuming is appropriate at all is
   * the caller's decision - interrupted runs resume, deliberate rebuilds do not -
   * so resumeFrom defaults to {} and behaviour is unchanged without it.
   */
  const resumedFields = [];
  const generateField = async (field, step, promptBuilder) => {
    const carried = resumeFrom?.[field];
    if (fieldLengthOk(field, carried)) {
      resumedFields.push(field);
      const n = String(carried).trim().length;
      console.log(`[RESUME-1] ${field}: reusing ${n} saved chars — model call skipped`);
      onProgress?.(`Bible: ${step} — reusing saved work…`);
      return carried;
    }
    onProgress?.(`Bible: ${step}…`);
    const r = await callLLM(promptBuilder(), singleFieldSchema(field));
    return r?.[field] || '';
  };

  // ── BATCH 1: world + people/stakeholders + voice (independent) ──
  onProgress?.('Bible: Batch 1/3 — world, people, voice…');
  // TELEMETRY-1: state what this run actually resolved, once, where a reader
  // looking for the cause of a bad bible will find it. chapterCount is included
  // because it is read from settings.chapter_target and a wrong value there is
  // invisible until the outline comes back the wrong length (see CHAPCOUNT-1).
  console.log(
    `[BIBLE-PARALLEL] mode=${isFiction ? 'fiction' : 'nonfiction'} `
    + `genre=${settings?.genre || '(none)'}/${settings?.subgenre || '(none)'} `
    + `chapters=${settings?.chapter_target ?? '(unset)'} model=${model} fallback=${fallback}`,
  );
  console.log('[BIBLE-PARALLEL] Starting Batch 1 (world + people/stakeholders + voice)');
  const t1 = Date.now();

  // GATEFIX-18: SEQUENTIAL — one local LLM call at a time (M1 constraint).
  // Promise.all here fired 3 concurrent requests and broke the local server.
  let worldMd = await generateField('world_md', 'world (1/6)',
    () => buildWorldPrompt(seedConcept, settings, nameBlock));
  let charactersMd = await generateField('characters_md', 'people (2/6)',
    () => buildCharactersPrompt(seedConcept, settings, nameBlock));
  let voiceMd = await generateField('voice_md', 'voice (3/6)',
    () => buildVoicePrompt(seedConcept, settings));

  // FIELDGUARD-1: a field below its floor gets ONE retry with an explicit
  // length demand; still short -> throw. The catch in the caller surfaces
  // the standard "nothing was saved" toast. An empty characters_md must
  // never reach the store silently again.
  const fieldGuardRetry = async (field, current, promptBuilder) => {
    if (fieldLengthOk(field, current)) return current;
    const floor = BIBLE_FIELD_FLOORS[field];
    console.warn('[FIELD-GUARD] ' + field + ' came back ' + String(current || '').trim().length + ' chars (floor ' + floor + '). Retrying once...');
    onProgress?.('Bible: ' + field + ' too short - regenerating...');
    const retryResult = await callLLM(promptBuilder() + buildFieldRetryAppendix(field, floor), singleFieldSchema(field));
    const retryText = retryResult?.[field] || '';
    if (fieldLengthOk(field, retryText)) {
      console.log('[FIELD-GUARD] ' + field + ' retry succeeded: ' + String(retryText).trim().length + ' chars');
      return retryText;
    }
    throw new Error("Bible field '" + field + "' came back " + String(retryText || current || '').trim().length + ' chars after a retry (needs ' + floor + '+). Nothing was saved - run Build Story Bible again.');
  };

  worldMd = await fieldGuardRetry('world_md', worldMd, () => buildWorldPrompt(seedConcept, settings, nameBlock));
  charactersMd = await fieldGuardRetry('characters_md', charactersMd, () => buildCharactersPrompt(seedConcept, settings, nameBlock));
  voiceMd = await fieldGuardRetry('voice_md', voiceMd, () => buildVoicePrompt(seedConcept, settings));

  if (!isFiction) {
    worldMd = stripNonfictionScarTissue(worldMd);
    charactersMd = stripNonfictionScarTissue(charactersMd);
    voiceMd = stripNonfictionScarTissue(voiceMd);
  }

  console.log('[BIBLE-PARALLEL] Batch 1 done in', Math.round((Date.now() - t1) / 1000), 's. World:', worldMd.length, '| People:', charactersMd.length, '| Voice:', voiceMd.length);
  if (resumedFields.length) {
    console.log(`[RESUME-1] carried ${resumedFields.length} field(s) from a previous interrupted run: ${resumedFields.join(', ')}`);
  }

  // ── BATCH 2: canon + mystery + outline (need Batch 1) ──
  onProgress?.('Bible: Batch 2/3 — canon, investigation path, outline…');
  console.log('[BIBLE-PARALLEL] Starting Batch 2 (canon + mystery/investigation + outline)');
  const t2 = Date.now();

  // GATEFIX-18: SEQUENTIAL — one local LLM call at a time (M1 constraint).
  let canonMd = await generateField('canon_md', 'canon (4/6)',
    () => buildCanonPrompt(seedConcept, settings, worldMd, charactersMd));
  // The outline must never be built from a canon draft that later fails its
  // own field guard. Repair/validate canon before it becomes a dependency.
  canonMd = await fieldGuardRetry('canon_md', canonMd, () => buildCanonPrompt(seedConcept, settings, worldMd, charactersMd));

  let mysteryMd = await generateField('mystery_md', 'investigation path (5/6)',
    () => buildMysteryPrompt(seedConcept, settings, charactersMd));
  mysteryMd = await fieldGuardRetry('mystery_md', mysteryMd, () => buildMysteryPrompt(seedConcept, settings, charactersMd));

  onProgress?.('Bible: outline (6/6)…');
  const outlineResultRaw = await callLLM(
    buildOutlinePrompt(seedConcept, settings, worldMd, charactersMd, canonMd, mysteryMd),
    outlineSchema,
    { max_tokens: 16384 }
  );
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

  // -- OUTLINEFIX-2/3 + LEAKFIX-2: scrub, then converge to distinct chapters --
  // 1) Scrub model leaks from every chapter title/summary; chapters gutted by
  //    the scrub (e.g. a CJK title) are forced into the repair loop.
  // 2) Distinctness gate with targeted repair: keep good chapters, replace
  //    only offenders, re-check - up to 3 rounds, never hard-fail.
  if (isFiction && chapters.length > 1) {
    const scrub0 = scrubOutlineChapters(chapters);
    chapters = scrub0.chapters;
    let forced = scrub0.gutted;
    let outlineChanged = scrub0.changed;
    let dupe = analyzeOutlineDuplication(chapters);
    let round = 0;
    while ((dupe.critical || forced.length) && round < 3) {
      round += 1;
      const offenders = [...new Set([...findOutlineOffenders(dupe), ...forced])].sort((x, y) => x - y);
      console.warn('[OUTLINE-DEDUPE] Round ' + round + ': replacing ' + offenders.length + ' chapter(s): ' + offenders.join(', ') + ' | ' + dupe.issues.slice(0, 4).join(' | '));
      onProgress?.('Bible: outline needs repair - replacing ' + offenders.length + ' chapter(s), round ' + round + '/3...');
      const repairRaw = await callLLM(
        buildOutlineChapterRepairPrompt(chapters, offenders, targetCount, { charactersMd, canonMd, soft: dupe.soft }),
        outlineSchema,
        { max_tokens: 16384 }
      );
      const scrubR = scrubOutlineChapters(Array.isArray(repairRaw?.chapters) ? repairRaw.chapters : []);
      const usable = scrubR.chapters.filter(ch => !scrubR.gutted.includes(Number(ch.chapter_number)));
      const splice = spliceOutlineChapters(chapters, usable, offenders);
      if (!splice.replaced.length) {
        console.warn('[OUTLINE-DEDUPE] Round ' + round + ' produced no usable replacements; stopping repair loop.');
        break;
      }
      console.log('[OUTLINE-DEDUPE] Round ' + round + ' replaced chapters: ' + splice.replaced.join(', '));
      chapters = splice.chapters;
      outlineChanged = true;
      forced = forced.filter(n => !splice.replaced.includes(n));
      dupe = analyzeOutlineDuplication(chapters);
    }
    if (dupe.critical || forced.length) {
      const unresolved = [...dupe.issues.slice(0, 8), ...forced.map((n) => 'Ch.' + n + ' lost required content')];
      const error = new Error(
        'Story Bible rejected: the outline still contains repeated/alternate events or premature endings after ' +
        round + ' repair round(s). ' + unresolved.join(' | ')
      );
      error.name = 'NarrativeContractError';
      error.code = 'OUTLINE_CONTRACT_UNRESOLVED';
      error.issues = unresolved;
      console.error('[NARRATIVE-CONNECT] Hard-blocking unresolved outline:', error);
      throw error;
    } else if (outlineChanged) {
      console.log('[OUTLINE-DEDUPE] Outline converged to distinct chapters after targeted repair.');
    }
    if (outlineChanged) outlineMd = rebuildOutlineMd(chapters);
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

  // GATEFIX-21: BIBLE QUOTE GUARD (deterministic, nonfiction only). Any quoted span in a
  // foundation field, chapter title, or beat summary that is not found verbatim in the
  // research is stripped. Same normalization as the research-layer verbatim guard.
  // Fails safe: no quote beats a fabricated one. Known limitation: single-quoted spans
  // containing internal apostrophes cannot be safely matched and are left to the prompt bans.
  if (!isFiction) {
    const normQ = (s) => (s || '').toLowerCase().replace(/[\u2018\u2019']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const researchNorm = normQ(getResearchText(settings));
    const QUOTE_RE = /[\u201c]([^\u201c\u201d]{10,400})[\u201d]|"([^"]{10,400})"|(?:^|[\s(:—-])'([^']{12,400})'(?=$|[\s).,;:!?])/g;
    const stripUnverifiedQuotes = (text) => {
      if (!text || !researchNorm) return text;
      return text.replace(QUOTE_RE, (match, g1, g2, g3) => {
        const inner = g1 || g2 || g3 || '';
        const q = normQ(inner);
        if (q.split(' ').filter(Boolean).length < 4) return match;
        if (researchNorm.includes(q)) return match;
        console.warn('[BIBLE-GUARD] unverified quote stripped from bible:', inner.slice(0, 60));
        return g3 ? match.charAt(0) : '';
      });
    };
    worldMd = stripUnverifiedQuotes(worldMd);
    charactersMd = stripUnverifiedQuotes(charactersMd);
    voiceMd = stripUnverifiedQuotes(voiceMd);
    canonMd = stripUnverifiedQuotes(canonMd);
    mysteryMd = stripUnverifiedQuotes(mysteryMd);
    outlineMd = stripUnverifiedQuotes(outlineMd);
    chapters = chapters.map((ch) => ({ ...ch, title: stripUnverifiedQuotes(ch.title), beat_summary: stripUnverifiedQuotes(ch.beat_summary) }));
  }

  // BIBLEGUARD-NAMES-1: an invented person, place, or institution is a
  // fabrication the same way an unverified quote is. Every proper-noun
  // phrase in a generated nonfiction field must substring-match the
  // research (closed-world discipline, same normalization/plural-singular
  // fallback as closedWorldCheck in sceneWriter.js). A violation throws so
  // the existing catch shows the "nothing was saved" toast naming the noun.
  if (!isFiction && normCW(getResearchText(settings)).length >= 200) {
    const researchEvidence = ' ' + normCW(getResearchText(settings)) + ' ';
    const bibleInEV = createInEV(researchEvidence);
    // A markdown field-label line ("- **Role:** Protagonist", "Pronouns: she/her")
    // names a LABEL, not a person/place — those never need research support.
    const FIELD_LABEL_LINE_RX = /^[\s>*-]*\*{0,2}([A-Z][A-Za-z '’-]{1,40}):\*{0,2}\s/gm;
    const collectFieldLabels = (text) => {
      const labels = new Set();
      let m;
      FIELD_LABEL_LINE_RX.lastIndex = 0;
      const s = String(text || '');
      while ((m = FIELD_LABEL_LINE_RX.exec(s)) !== null) labels.add(normCW(m[1]));
      return labels;
    };
    const checkFieldNames = (text, fieldName) => {
      const s = String(text || '');
      if (!s) return;
      const labels = collectFieldLabels(s);
      let checked = 0;
      for (const phrase of extractProperNounPhrases(s)) {
        if (labels.has(normCW(phrase))) continue;
        checked += 1;
        if (!bibleInEV(phrase)) {
          throw new Error(`BIBLEGUARD-NAMES-1: "${phrase}" in ${fieldName} is not in the research`);
        }
      }
      console.log(`[BIBLE-GUARD] names: ${fieldName} checked ${checked} noun(s), 0 unsupported`);
    };
    checkFieldNames(worldMd, 'world_md');
    checkFieldNames(charactersMd, 'characters_md');
    checkFieldNames(voiceMd, 'voice_md');
    checkFieldNames(canonMd, 'canon_md');
    checkFieldNames(mysteryMd, 'mystery_md');
    checkFieldNames(outlineMd, 'outline_md');
  }

  // LEAKFIX-2: scrub model leaks (control tokens, non-Latin drift) from every
  // bible field. The prose pipeline is already guarded; the bible was not -
  // a Chinese chapter title shipped in a story bible report.
  const scrubField = (txt, label) => scrubModelLeaks(txt, 'bible-' + label).text;
  worldMd = scrubField(worldMd, 'world');
  charactersMd = scrubField(charactersMd, 'characters');
  voiceMd = scrubField(voiceMd, 'voice');
  canonMd = scrubField(canonMd, 'canon');
  mysteryMd = scrubField(mysteryMd, 'mystery');
  outlineMd = scrubField(outlineMd, 'outline');
  twistsMd = scrubField(twistsMd, 'twists');

  const totalTime = Math.round((Date.now() - t1) / 1000);
  console.log('[BIBLE-PARALLEL] Total bible generation:', totalTime, 's');

  // CANON-2: a freshly generated bible that disagrees with itself about who
  // holds a unique role ships that contradiction into every chapter (REDUX:
  // world_md and canon_md both called Sadie "the ship's navigator" while
  // characters_md made Zin the navigator — the drafted book printed it on
  // page 3). Detection at birth, loudly; the fields still return so the
  // author decides, but the console names the exact conflict.
  try {
    const contradictions = checkFoundationRoleConsistency({
      characters_md: charactersMd, world_md: worldMd, canon_md: canonMd, outline_md: outlineMd,
    });
    for (const contradiction of contradictions) {
      console.error(`[CANON-2] BIBLE CONTRADICTION: role "${contradiction.role}" claimed for ${contradiction.distinctNames.join(' AND ')} — ${contradiction.holders.map((h) => `${h.name} in ${h.field}`).join('; ')}. Fix before drafting.`);
    }
  } catch (canonError) {
    console.warn('[CANON-2] Bible consistency check failed (non-fatal):', canonError?.message);
  }

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
