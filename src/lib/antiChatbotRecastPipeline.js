/**
 * antiChatbotRecastPipeline.js — Chunk-level post-generation recast pipeline
 *
 * Runs AFTER initial drafting and AFTER the existing polish pipeline.
 * Analyzes prose in chunks, identifies weak sections, and recasts them
 * with genre-conditional anti-chatbot rules.
 *
 * Architecture:
 *   1. Split text into paragraph-boundary chunks (~300-500 words each)
 *   2. Analyze each chunk with analyzeProseTexture()
 *   3. Detect protected sections (citations, bibliography, quotes, etc.)
 *   4. Eligible weak chunks get recast with genre-appropriate rules
 *   5. Safety validation on every recast (word count, name preservation, citations)
 *   6. Safe replacements only — failed recasts preserve original text
 *
 * @module antiChatbotRecastPipeline
 */

import {
  analyzeProseTexture,
  getAntiChatbotRulesForProject,
} from './antiChatbotProse.js';

import {
  chooseRecastModel,
  validateHeadingPreservation,
  validateLiteraryRecast,
  detectRecastWeaknessTypes,
  buildRecastModelRoutingReport,
} from './recastModelRouting.js';

import {
  runNonfictionDeterministicCleanup,
  runNonfictionMicroRecastPipeline,
  preserveNonfictionStructure,
} from './nonfictionAntiChatbotCleanup.js';

export const VERSION = 'ANTI-CHATBOT-RECAST-PIPELINE v5.0 — 2026-06-09';

/**
 * Dedicated llama.cpp model for conservative prose recasting.
 * Has a specialized system prompt for prose editing, not general chat.
 */
export const RECAST_MODEL_NAME = 'prose-recast-polisher';

// ─── Recast Modes ─────────────────────────────────────────────────────────

/** @enum {string} */
export const RECAST_MODE = {
  CONSERVATIVE: 'conservative',
  STANDARD: 'standard',
  AGGRESSIVE: 'aggressive',
};

// ─── Configuration ────────────────────────────────────────────────────────

const DEFAULTS = {
  /** Minimum words per chunk */
  minChunkWords: 80,
  /** Target words per chunk */
  targetChunkWords: 400,
  /** Maximum words per chunk */
  maxChunkWords: 600,
  /** Score below which a chunk is eligible for recast */
  recastThreshold: 70,
  /** Score at or above which a chunk is skipped (already good) */
  skipThreshold: 80,
  /** Minimum word count ratio (recast vs original) — per mode */
  minWordRatio: 0.85,
  /** Maximum word count ratio (recast vs original) — per mode */
  maxWordRatio: 1.10,
  /** Maximum chunks to recast per run (safety limit) */
  maxRecastsPerRun: 20,
  /** Recast mode: conservative (default), standard, aggressive */
  recastMode: RECAST_MODE.CONSERVATIVE,
  /** Whether to retry failed recasts due to word-count violations */
  enableLengthRetry: true,
  /** Maximum retries for length correction */
  maxLengthRetries: 1,
  /** Maximum score regression allowed before blocking a recast */
  maxScoreRegression: 0,
  /** Maximum chatbot pattern increase allowed */
  maxChatbotPatternIncrease: 2,
};

/** Per-mode word count ratio configuration */
const MODE_RATIOS = {
  [RECAST_MODE.CONSERVATIVE]: { minWordRatio: 0.92, maxWordRatio: 1.10 },
  [RECAST_MODE.STANDARD]:     { minWordRatio: 0.85, maxWordRatio: 1.10 },
  [RECAST_MODE.AGGRESSIVE]:   { minWordRatio: 0.75, maxWordRatio: 1.15 },
};


// ─── Recast Prompt Blocks ─────────────────────────────────────────────────

/**
 * Filter verb targeting instructions for fiction genres.
 * Tells the model which verbs to reduce and how to replace them.
 */
export const FILTER_VERB_TARGETING_BLOCK = `
FILTER VERB TARGETING:
The following verbs create narrative distance. Replace with direct sensation or action
UNLESS they are in dialogue, are naturally necessary, or removal would damage voice:
- "felt" → show the physical sensation ("felt cold" → "gooseflesh prickled her arms")
- "realized" → show the behavioral change ("realized the door was locked" → "tried the handle — locked")
- "noticed" → describe the thing directly ("noticed a crack" → "a crack ran from hinge to frame")
- "watched" → describe what was seen ("watched him leave" → "he crossed the lot without looking back")
- "saw" → describe the visual directly ("saw blood" → "blood pooled under the door")
- "heard" → describe the sound ("heard a crash" → "glass shattered in the hallway")
- "seemed" → state what IS ("seemed angry" → "his jaw clenched")
- "wondered" → show the question in action or thought ("wondered if" → "could she...?")
- "knew" → show knowledge through behavior ("knew it was over" → "she set down the badge")
- "understood" → show comprehension through reaction ("understood the risk" → "the risk — loss of license, maybe prison — sat in her chest like a stone")

Do NOT mechanically strip all instances. Keep 1-2 per 500 words if they serve rhythm or appear in dialogue.
Do NOT replace filter verbs that are genuinely the most natural word for the context.`;


/**
 * Genre-specific recast examples showing before/after.
 * Each shows: weak original → acceptable conservative recast.
 */
export const THRILLER_RECAST_EXAMPLES = `
EXAMPLE — THRILLER RECAST:

WEAK ORIGINAL:
"Marcus felt a chill run down his spine as he realized the scope of what they had done. He noticed the servers were still running, their lights blinking in the darkness. He watched Sarah's face and saw that she understood the implications too."

ACCEPTABLE CONSERVATIVE RECAST:
"A chill traced Marcus's spine — the scope of it, laid out across twelve states on a single screen. The servers hummed in the darkness, status LEDs blinking green. Sarah's face had gone pale. She understood."

UNACCEPTABLE — OVERCORRECTED:
"The bone-deep arctic void of existential dread clawed through Marcus's vertebrae as the horrifying revelation cascaded across his psyche."

UNACCEPTABLE — COMPRESSED:
"Marcus was chilled. The servers were running. Sarah understood."`;

export const LITERARY_RECAST_EXAMPLES = `
EXAMPLE — LITERARY RECAST:

WEAK ORIGINAL:
"Elena felt the weight of the moment pressing down on her. She realized that the form in front of her wasn't just paperwork — it was a judgment on who she was. She noticed her hands were trembling slightly as she picked up the pen."

ACCEPTABLE CONSERVATIVE RECAST:
"The moment pressed against Elena's sternum like a flat palm. The form — not paperwork, a judgment on identity itself — lay on the desk between her and the intake officer. Her hand trembled around the pen."

UNACCEPTABLE — OVERCORRECTED:
"Weight. Unbearable. The form screamed at her with bureaucratic malice."

UNACCEPTABLE — COMPRESSED:
"Elena was nervous about the form. She picked up the pen."`;

export const NONFICTION_RECAST_EXAMPLES = `
EXAMPLE — NONFICTION RECAST:

WEAK ORIGINAL:
"The data seemed to suggest that there was a significant disparity in hiring outcomes. Hernandez noticed that applicants from certain zip codes were consistently ranked lower. He realized this had important implications for the city's commitment to equity."

ACCEPTABLE CONSERVATIVE RECAST:
"The data showed a 23-percentile-point gap in hiring rankings. Applicants from nine zip codes south of I-94 — all majority-Black or majority-Latino — scored consistently lower than North Shore applicants with identical credentials. The city's equity commitment, Hernandez concluded, existed on paper only."

UNACCEPTABLE — OVERCORRECTED:
"Hernandez stared at the screen, his coffee going cold. The numbers told a story of institutional betrayal."

UNACCEPTABLE — COMPRESSED:
"Hiring data showed racial disparities. Hernandez found implications."`;


/**
 * Nonfiction authority recast block — stronger instructions for nonfiction.
 */
export const NONFICTION_AUTHORITY_RECAST_BLOCK = `
NONFICTION AUTHORITY RECAST:
- Replace vague abstraction with precise claims: "This had a significant impact" → state the specific impact with numbers
- Strengthen paragraph openings: lead with the strongest claim or most specific fact, not a transition
- Strengthen paragraph endings: close with the point, not a trailing qualifier or hedge
- Remove essay-bot transitions: "Moreover," "Furthermore," "Additionally," "It is important to note" — connect through content, not connectives
- Replace generic claims with evidence: "Research shows" → cite the specific study or data point if available in the original
- Preserve source discipline: do not invent examples, data, statistics, or quotes
- Preserve ALL citation-like references, parenthetical attributions, and data sources exactly as written
- Do NOT add fictional texture, scene dramatization, sensory overload, or literary devices
- Do NOT add emotional language or narrative urgency to analytical sections
- Remove flourish and lingering-mystery endings: if a paragraph or section ends on a comment about mystery, secrecy, or the passage of time ("questions that lingered," "long after the curtain had fallen," "in the margins of history," "the truth may never be known") instead of on a fact, end it on the concrete documented fact or the specific open question already present a sentence or two earlier. Cutting the flourish is rewording the close, not removing content.
- Remove decorative metaphor the draft left behind: this is not only "do not ADD" literary texture — also strip extended or stacked metaphors (architecture, theater and curtains, weaving and tapestry, tides and shoals, webs, shadows and light) and decorative words (labyrinthine, tapestry, opulent, ethereal, palpable, shrouded, tantalizing, "polished veneer," sprawling, relentless) by rewording into plain fact. The fact stays; the metaphor goes. When unsure whether a phrase is decoration or a load-bearing fact, keep it.
- The goal is PRECISION and AUTHORITY — let the facts carry the weight`;


// ─── Helpers ──────────────────────────────────────────────────────────────

function countWords(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function extractProperNouns(text) {
  const safe = String(text || '');
  const matches = safe.match(/\b[A-Z][a-z]{2,}(?:[''][A-Z][a-z]{2,})?\b/g) || [];
  const banned = new Set([
    'The', 'And', 'But', 'For', 'With', 'When', 'Then', 'There', 'This', 'That',
    'Chapter', 'Scene', 'Part', 'Not', 'His', 'Her', 'Their', 'She', 'He', 'They',
    'What', 'Where', 'How', 'Why', 'Who', 'Its', 'Our', 'Your', 'Has', 'Had',
    'Was', 'Were', 'Are', 'Been', 'Being', 'Have', 'Does', 'Did', 'Will', 'Would',
    'Could', 'Should', 'May', 'Might', 'Must', 'Can', 'Shall',
  ]);
  return new Set(matches.filter(m => !banned.has(m)).map(m => m.toLowerCase()));
}


// ─── Protection Detection ─────────────────────────────────────────────────

/** @enum {string} */
export const PROTECTION_TYPE = {
  CITATION: 'citation',
  BIBLIOGRAPHY: 'bibliography',
  BLOCK_QUOTE: 'block_quote',
  TABLE: 'table',
  LIST: 'list',
  LEGAL: 'legal',
  SCRIPTURE: 'scripture',
  DIALOGUE_HEAVY: 'dialogue_heavy',
  HIGH_SCORE: 'high_score',
};

/**
 * Detect citation patterns in text.
 * Matches: (Author, Year), [1], [Author 2024], footnote markers.
 */
function hasCitations(text) {
  const patterns = [
    /\(\s*[A-Z][a-z]+(?:\s+(?:et\s+al\.?|&\s+[A-Z][a-z]+))?,?\s*\d{4}\s*\)/,  // (Author, 2024)
    /\[\d+\]/,                                                                    // [1]
    /\[\s*[A-Z][a-z]+\s+\d{4}\s*\]/,                                             // [Author 2024]
    /\b(?:ibid|op\.\s*cit|loc\.\s*cit)\b/i,                                      // Latin citations
  ];
  return patterns.some(p => p.test(text));
}

/**
 * Detect bibliography/reference sections.
 */
function isBibliography(text) {
  const heading = /^(?:references|bibliography|works?\s+cited|sources|endnotes|footnotes)\s*$/im;
  return heading.test(text.trim());
}

/**
 * Detect block quotes (> prefixed lines or multi-paragraph quoted material).
 */
function isBlockQuote(text) {
  const lines = text.split('\n');
  const quotedLines = lines.filter(l => /^\s*>/.test(l));
  return quotedLines.length > lines.length * 0.5;
}

/**
 * Detect markdown tables.
 */
function isTable(text) {
  return /\|[^|]+\|/.test(text) && /\|[-:]+\|/.test(text);
}

/**
 * Detect structured lists.
 */
function isList(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const listLines = lines.filter(l => /^\s*(?:[-*•]\s|\d+\.\s)/.test(l));
  return listLines.length > lines.length * 0.5;
}

/**
 * Detect legal/compliance language.
 */
function hasLegalLanguage(text) {
  const patterns = [
    /\bpursuant to\b/i,
    /\bin accordance with\b/i,
    /\bsection\s+\d+/i,
    /\bregulation\s+\d+/i,
    /\bcompliance\s+(?:with|requirement)/i,
    /\b(?:CMS|OSHA|HIPAA|ADA|FERPA|GDPR|SOX)\b/,
  ];
  return patterns.filter(p => p.test(text)).length >= 2;
}

/**
 * Detect scripture/quoted source excerpts.
 */
function hasScripture(text) {
  return /\b(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Psalms?|Proverbs?|Isaiah|Matthew|Mark|Luke|John|Acts|Romans|Revelation)\s+\d+:\d+/i.test(text);
}

/**
 * Detect dialogue-heavy content (>60% of lines contain quotation marks).
 */
function isDialogueHeavy(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 10);
  if (lines.length < 3) return false;
  const dialogueLines = lines.filter(l => /[""\u201c\u201d]/.test(l));
  return dialogueLines.length > lines.length * 0.6;
}

/**
 * Detect all protection types for a chunk.
 * @param {string} text
 * @param {number} compositeScore
 * @param {number} skipThreshold
 * @returns {{ protected: boolean, reasons: string[] }}
 */
export function detectProtections(text, compositeScore = 0, skipThreshold = DEFAULTS.skipThreshold) {
  const reasons = [];

  if (hasCitations(text)) reasons.push(PROTECTION_TYPE.CITATION);
  if (isBibliography(text)) reasons.push(PROTECTION_TYPE.BIBLIOGRAPHY);
  if (isBlockQuote(text)) reasons.push(PROTECTION_TYPE.BLOCK_QUOTE);
  if (isTable(text)) reasons.push(PROTECTION_TYPE.TABLE);
  if (isList(text)) reasons.push(PROTECTION_TYPE.LIST);
  if (hasLegalLanguage(text)) reasons.push(PROTECTION_TYPE.LEGAL);
  if (hasScripture(text)) reasons.push(PROTECTION_TYPE.SCRIPTURE);
  if (isDialogueHeavy(text)) reasons.push(PROTECTION_TYPE.DIALOGUE_HEAVY);
  if (compositeScore >= skipThreshold) reasons.push(PROTECTION_TYPE.HIGH_SCORE);

  return { protected: reasons.length > 0, reasons };
}


// ─── Chunk Splitting ──────────────────────────────────────────────────────

/**
 * Split text into paragraph-boundary chunks of ~300-500 words each.
 *
 * @param {string} text
 * @param {Object} [options]
 * @param {number} [options.targetChunkWords=400]
 * @param {number} [options.minChunkWords=80]
 * @param {number} [options.maxChunkWords=600]
 * @returns {{ chunks: Array<{ text: string, index: number, startOffset: number }> }}
 */
export function splitTextIntoRecastChunks(text, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const safe = String(text || '').trim();
  if (!safe) return { chunks: [] };

  // Split on paragraph boundaries
  const paragraphs = safe.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return { chunks: [] };

  const chunks = [];
  let currentParagraphs = [];
  let currentWords = 0;
  let offset = 0;

  for (const para of paragraphs) {
    const paraWords = countWords(para);

    // If adding this paragraph would exceed max AND we already have content, flush
    if (currentWords + paraWords > opts.maxChunkWords && currentWords >= opts.minChunkWords) {
      const chunkText = currentParagraphs.join('\n\n');
      chunks.push({ text: chunkText, index: chunks.length, startOffset: offset });
      offset += chunkText.length + 2; // approximate
      currentParagraphs = [];
      currentWords = 0;
    }

    currentParagraphs.push(para);
    currentWords += paraWords;

    // If we've hit the target, flush
    if (currentWords >= opts.targetChunkWords) {
      const chunkText = currentParagraphs.join('\n\n');
      chunks.push({ text: chunkText, index: chunks.length, startOffset: offset });
      offset += chunkText.length + 2;
      currentParagraphs = [];
      currentWords = 0;
    }
  }

  // Remaining paragraphs
  if (currentParagraphs.length > 0) {
    const chunkText = currentParagraphs.join('\n\n');
    // If remaining is too small, merge with the last chunk
    if (chunks.length > 0 && currentWords < opts.minChunkWords) {
      const last = chunks[chunks.length - 1];
      last.text = last.text + '\n\n' + chunkText;
    } else {
      chunks.push({ text: chunkText, index: chunks.length, startOffset: offset });
    }
  }

  // Re-index after potential merge
  chunks.forEach((c, i) => { c.index = i; });

  return { chunks };
}


// ─── Eligibility ──────────────────────────────────────────────────────────

/**
 * Determine whether a chunk should be recast.
 *
 * @param {{ text: string }} chunk
 * @param {Object} [projectOrProfile]
 * @param {Object} [options]
 * @returns {{ eligible: boolean, reason: string, metrics: Object|null }}
 */
export function shouldRecastChunk(chunk, projectOrProfile, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const text = chunk?.text || '';
  const words = countWords(text);

  if (words < opts.minChunkWords) {
    return { eligible: false, reason: `Too short (${words} words, min ${opts.minChunkWords})`, metrics: null };
  }

  const metrics = analyzeProseTexture(text);

  // Check protections
  const protection = detectProtections(text, metrics.compositeScore, opts.skipThreshold);
  if (protection.protected) {
    return { eligible: false, reason: `Protected: ${protection.reasons.join(', ')}`, metrics };
  }

  // Check recast eligibility from profile
  const rules = getAntiChatbotRulesForProject(projectOrProfile);
  if (!rules.recastEligible) {
    return { eligible: false, reason: `Profile '${rules.profileKey}' disables recast`, metrics };
  }

  // Check score threshold
  if (metrics.compositeScore >= opts.recastThreshold) {
    return { eligible: false, reason: `Score ${metrics.compositeScore} >= threshold ${opts.recastThreshold}`, metrics };
  }

  return { eligible: true, reason: `Score ${metrics.compositeScore} < threshold ${opts.recastThreshold}`, metrics };
}


// ─── Prompt Building ──────────────────────────────────────────────────────

/**
 * Get effective word count ratio limits for the given mode.
 * @param {string} [mode]
 * @returns {{ minWordRatio: number, maxWordRatio: number }}
 */
export function getWordRatioForMode(mode = RECAST_MODE.CONSERVATIVE) {
  return MODE_RATIOS[mode] || MODE_RATIOS[RECAST_MODE.CONSERVATIVE];
}

/**
 * Build a recast prompt for a single chunk.
 *
 * @param {{ text: string }} chunk
 * @param {Object} [projectOrProfile]
 * @param {Object} [metrics] - Result from analyzeProseTexture()
 * @param {Object} [options]
 * @param {string} [options.recastMode]
 * @returns {string}
 */
export function buildChunkRecastPrompt(chunk, projectOrProfile, metrics, options = {}) {
  const mode = options.recastMode || RECAST_MODE.CONSERVATIVE;
  const rules = getAntiChatbotRulesForProject(projectOrProfile);
  const diagnostics = metrics?.diagnostics || [];
  const isNonfiction = rules.profileKey === 'nonfiction' || rules.profileKey === 'business_guide' || rules.profileKey === 'training_manual';
  const isTraining = rules.profileKey === 'training_manual';
  const isFiction = !isNonfiction;

  const origWords = countWords(chunk.text);
  const { minWordRatio, maxWordRatio } = getWordRatioForMode(mode);
  const minWords = Math.floor(origWords * minWordRatio);
  const maxWords = Math.ceil(origWords * maxWordRatio);
  const paragraphCount = (chunk.text.match(/\n\n/g) || []).length + 1;

  // ── Conservative-mode length anchor ──
  const conservativeLengthBlock = mode === RECAST_MODE.CONSERVATIVE ? `
LENGTH PRESERVATION (MANDATORY — DO NOT VIOLATE):
- The original passage is ${origWords} words.
- Your revised passage MUST be between ${minWords} and ${maxWords} words.
- Target approximately ${origWords} words (95–110% of original).
- Do NOT summarize. Do NOT condense. Do NOT shorten.
- Do NOT remove beats, examples, dialogue, or transitions.
- Do NOT remove any paragraph or section.
- Preserve approximately ${paragraphCount} paragraphs.
- Change sentence texture, specificity, rhythm, and diction ONLY.
- If you cannot improve the passage without shortening it, return it unchanged.` : `
LENGTH GUIDANCE:
- The original passage is ${origWords} words.
- Your revised passage must be between ${minWords} and ${maxWords} words.`;

  // ── Nonfiction-specific rules ──
  const nonfictionBlock = isNonfiction ? `
NONFICTION CONSTRAINTS (MANDATORY):
- Do NOT add lyrical texture, poetic phrasing, or literary compression.
- Do NOT add scene dramatization unless already present in the original.
- Do NOT add unsupported examples, hypotheticals, or invented data.
- Prioritize clarity, authority, and precise claims.
- Preserve ALL headings, subheadings, and section structure.
- Preserve ALL citation-like material, parenthetical references, and data attributions.
- Preserve evidence structure and argument flow.
- The goal is CLARITY and AUTHORITY, not style.` : '';

  // ── v3: Filter verb targeting (fiction only, not training) ──
  const filterVerbBlock = (isFiction && !isTraining) ? FILTER_VERB_TARGETING_BLOCK : '';

  // ── v3: Genre-specific recast examples ──
  let genreExamplesBlock = '';
  if (rules.profileKey === 'thriller') {
    genreExamplesBlock = THRILLER_RECAST_EXAMPLES;
  } else if (rules.profileKey === 'literary' || rules.profileKey === 'fiction' || rules.profileKey === 'memoir') {
    genreExamplesBlock = LITERARY_RECAST_EXAMPLES;
  } else if (isNonfiction && !isTraining) {
    genreExamplesBlock = NONFICTION_RECAST_EXAMPLES;
  }

  // ── v3: Nonfiction authority recast (nonfiction only, not training) ──
  const authorityBlock = (isNonfiction && !isTraining) ? NONFICTION_AUTHORITY_RECAST_BLOCK : '';

  return `You are a conservative prose editor performing a targeted quality recast.

GENRE PROFILE: ${rules.profileKey}
RECAST MODE: ${mode}

${rules.polisherRules}
${conservativeLengthBlock}
${nonfictionBlock}
${filterVerbBlock}
${authorityBlock}
${genreExamplesBlock}

QUALITY ISSUES DETECTED IN THIS PASSAGE:
${diagnostics.length > 0 ? diagnostics.map(d => `- ${d}`).join('\n') : '- General prose quality below threshold'}

STRICT PRESERVATION RULES:
- Do NOT invent new plot facts, events, or information.
- Do NOT change character names, place names, or proper nouns.
- Do NOT add unsupported claims or data.
- Do NOT remove or alter citations, footnotes, or source references.
- Do NOT rewrite quoted material or dialogue attribution.
- Do NOT change the sequence of events or the argument structure.
- Preserve all names, places, claims, citations, headings, and quoted material.
- Output ONLY the recast prose. No notes, no analysis, no preamble.

PASSAGE TO RECAST (${origWords} words):
${chunk.text}

Return ONLY the recast passage. Your output must be between ${minWords} and ${maxWords} words.`;
}


// ─── Safety Validation ────────────────────────────────────────────────────

/**
 * Validate a recast result against safety constraints.
 *
 * @param {string} original - Original chunk text
 * @param {string} recast - Recast chunk text
 * @param {Object} [options]
 * @param {string} [options.recastMode]
 * @returns {{ ok: boolean, text: string, warnings: string[], error: string|null, origWords: number, recastWords: number, ratio: number, minAllowed: number, maxAllowed: number, failureType: string|null }}
 */
export function validateRecast(original, recast, options = {}) {
  const mode = options.recastMode || RECAST_MODE.CONSERVATIVE;
  const { minWordRatio, maxWordRatio } = getWordRatioForMode(mode);
  const warnings = [];
  const origWords = countWords(original);
  const emptyResult = { ok: false, text: original, warnings, error: null, origWords, recastWords: 0, ratio: 0, minAllowed: Math.floor(origWords * minWordRatio), maxAllowed: Math.ceil(origWords * maxWordRatio), failureType: null };

  if (!recast || typeof recast !== 'string' || recast.trim().length < 50) {
    return { ...emptyResult, error: 'Recast output is empty or too short', failureType: 'empty' };
  }

  const cleaned = recast.trim()
    .replace(/^```[\w]*\s*\n?/m, '').replace(/\n?```\s*$/m, '')  // strip code fences
    .replace(/^(?:Here(?:'s| is) (?:the |your )(?:recast|revised|edited|polished) (?:passage|text|version)[:\.\!]?\s*\n?)+/i, '')
    .trim();

  if (cleaned.length < 50) {
    return { ...emptyResult, error: 'Recast output too short after cleanup', failureType: 'empty' };
  }

  // Word count ratio
  const recastWords = countWords(cleaned);
  const ratio = origWords > 0 ? recastWords / origWords : 0;
  const minAllowed = Math.floor(origWords * minWordRatio);
  const maxAllowed = Math.ceil(origWords * maxWordRatio);

  const baseResult = { origWords, recastWords, ratio, minAllowed, maxAllowed };

  if (ratio < minWordRatio) {
    return { ok: false, text: original, warnings, error: `Recast cut too much (${origWords} → ${recastWords} words, ${Math.round(ratio * 100)}%)`, failureType: 'word_count_ratio', ...baseResult };
  }
  if (ratio > maxWordRatio) {
    return { ok: false, text: original, warnings, error: `Recast expanded too much (${origWords} → ${recastWords} words, ${Math.round(ratio * 100)}%)`, failureType: 'word_count_ratio', ...baseResult };
  }

  // Proper noun preservation
  const origNouns = extractProperNouns(original);
  const recastNouns = extractProperNouns(cleaned);
  const missingNouns = [...origNouns].filter(n => !recastNouns.has(n));
  if (missingNouns.length > 0 && missingNouns.length > origNouns.size * 0.3) {
    return { ok: false, text: original, warnings, error: `Recast dropped proper nouns: ${missingNouns.slice(0, 5).join(', ')}`, failureType: 'proper_nouns', ...baseResult };
  }
  if (missingNouns.length > 0) {
    warnings.push(`Minor proper noun changes: ${missingNouns.slice(0, 3).join(', ')}`);
  }

  // Citation preservation
  if (hasCitations(original) && !hasCitations(cleaned)) {
    return { ok: false, text: original, warnings, error: 'Recast removed citations', failureType: 'citations', ...baseResult };
  }

  // Process leakage
  const leakagePatterns = [
    /\bAction Plan\b/i, /\bRevision Notes\b/i, /\bChanges made\b/i,
    /\bAs an AI\b/i, /\bAs a language model\b/i, /\bI cannot\b/i,
    /\bHere is the (?:recast|revised|polished)/i,
  ];
  for (const pat of leakagePatterns) {
    if (pat.test(cleaned)) {
      return { ok: false, text: original, warnings, error: `Process leakage detected: ${pat.source}`, failureType: 'leakage', ...baseResult };
    }
  }

  // Format check — should not start with analysis format
  const firstLine = cleaned.split('\n')[0].trim();
  if (/^(?:#|\*\*|[-*]\s|\d+\.\s)/.test(firstLine)) {
    return { ok: false, text: original, warnings, error: 'Recast starts with analysis/notes format', failureType: 'format', ...baseResult };
  }

  return { ok: true, text: cleaned, warnings, error: null, failureType: null, ...baseResult };
}


// ─── Word Count Ratio Failure Detection ───────────────────────────────────

/**
 * Check if a validation result failed due to word count ratio.
 * @param {{ failureType: string|null, error: string|null }} validationResult
 * @returns {boolean}
 */
export function isWordCountRatioFailure(validationResult) {
  if (!validationResult) return false;
  if (validationResult.failureType === 'word_count_ratio') return true;
  const err = validationResult.error || '';
  return err.includes('cut too much') || err.includes('expanded too much');
}


// ─── Length Correction Prompt ─────────────────────────────────────────────

/**
 * Build a retry prompt that tells the model exactly how to fix the length.
 *
 * @param {{ text: string }} originalChunk
 * @param {string} failedRecast - The recast that was too short/long
 * @param {Object} [projectOrProfile]
 * @param {{ origWords: number, recastWords: number, minAllowed: number, maxAllowed: number }} validationReport
 * @returns {string}
 */
export function buildLengthCorrectionPrompt(originalChunk, failedRecast, projectOrProfile, validationReport) {
  const rules = getAntiChatbotRulesForProject(projectOrProfile);
  const { origWords, recastWords, minAllowed, maxAllowed } = validationReport;
  const delta = origWords - recastWords;
  const tooShort = recastWords < minAllowed;

  return `You are a conservative prose editor. Your previous recast was ${tooShort ? 'too short' : 'too long'}.

GENRE PROFILE: ${rules.profileKey}

PROBLEM: Your previous revision was ${recastWords} words. The original was ${origWords} words.
${tooShort
    ? `You cut ${delta} words too many. You MUST expand back to at least ${minAllowed} words.`
    : `You added ${-delta} words too many. You MUST trim back to at most ${maxAllowed} words.`}

REQUIREMENTS:
- Your revised output MUST be between ${minAllowed} and ${maxAllowed} words.
- Target ${origWords} words.
${tooShort
    ? `- Restore the beats, transitions, examples, and details you removed.
- Do NOT summarize. Expand the revision back to the original length.
- Add back any dialogue, description, or evidence you cut.`
    : `- Remove only filler, redundancy, or unnecessary additions.
- Do NOT cut substantive content, examples, or evidence.`}
- Preserve all names, places, claims, citations, headings, and quoted material.
- Output ONLY the revised prose. No notes, no analysis.

ORIGINAL PASSAGE (${origWords} words):
${originalChunk.text}

YOUR PREVIOUS (FAILED) REVISION (${recastWords} words — ${tooShort ? 'too short' : 'too long'}):
${failedRecast}

Return ONLY the corrected revision. It must be between ${minAllowed} and ${maxAllowed} words.`;
}


// ─── Single Chunk Recast ──────────────────────────────────────────────────

/**
 * Recast a single chunk with anti-chatbot rules (no retry).
 * v4: Now uses model routing, heading preservation gate, and literary anti-flattening.
 *
 * @param {{ text: string }} chunk
 * @param {Object} [projectOrProfile]
 * @param {Object} [options]
 * @param {Function} [options.callLLM] - LLM call function (for testing/DI)
 * @param {Function} [options.callLLMForModel] - Model-aware LLM call: (prompt, modelName, temperature) => string
 * @param {string} [options.recastMode]
 * @param {string} [options.forceModel] - Force a specific recast model
 * @returns {Promise<{ text: string, ok: boolean, metrics: Object|null, beforeMetrics: Object|null, error: string|null, warnings: string[], validation: Object|null, recastMode: string, routing: Object|null }>}
 */
export async function recastChunkWithAntiChatbotRules(chunk, projectOrProfile, options = {}) {
  const { callLLM, callLLMForModel } = options;
  const mode = options.recastMode || RECAST_MODE.CONSERVATIVE;
  const maxScoreRegression = options.maxScoreRegression ?? DEFAULTS.maxScoreRegression;
  const maxPatternIncrease = options.maxChatbotPatternIncrease ?? DEFAULTS.maxChatbotPatternIncrease;

  if (!callLLM && !callLLMForModel) {
    return { text: chunk.text, ok: false, metrics: null, beforeMetrics: null, error: 'No callLLM function provided', warnings: [], validation: null, recastMode: mode, routing: null };
  }

  const beforeMetrics = analyzeProseTexture(chunk.text);

  // v4: Route to the best model
  const routing = chooseRecastModel(projectOrProfile, chunk, beforeMetrics, { forceModel: options.forceModel });

  const prompt = buildChunkRecastPrompt(chunk, projectOrProfile, beforeMetrics, { recastMode: mode });

  let raw;
  try {
    // v4: Use model-aware LLM call if available, otherwise fall back
    if (callLLMForModel) {
      raw = await callLLMForModel(prompt, routing.model, routing.temperature);
    } else {
      raw = await callLLM(prompt);
    }
  } catch (err) {
    return { text: chunk.text, ok: false, metrics: null, beforeMetrics, error: `LLM call failed: ${err?.message || 'unknown'}`, warnings: [], validation: null, recastMode: mode, routing };
  }

  if (typeof raw !== 'string') {
    raw = raw?.text || raw?.content || String(raw || '');
  }

  const validation = validateRecast(chunk.text, raw, { recastMode: mode });

  if (!validation.ok) {
    return { text: chunk.text, ok: false, metrics: null, beforeMetrics, error: validation.error, warnings: validation.warnings, validation, recastMode: mode, routing };
  }

  const afterMetrics = analyzeProseTexture(validation.text);

  // Overcorrection check: if recast is materially worse, keep original
  const scoreRegression = beforeMetrics.compositeScore - afterMetrics.compositeScore;
  if (scoreRegression > maxScoreRegression) {
    return {
      text: chunk.text,
      ok: false,
      metrics: afterMetrics,
      beforeMetrics,
      error: `Recast scored lower (${afterMetrics.compositeScore} < ${beforeMetrics.compositeScore})`,
      warnings: ['Overcorrection: recast was worse than original'],
      validation,
      recastMode: mode,
      routing,
    };
  }

  // Chatbot pattern guard: recast must not increase chatbot patterns materially
  const { countChatbotPatterns } = await import('./antiChatbotProse.js');
  const beforePatterns = countChatbotPatterns(chunk.text);
  const afterPatterns = countChatbotPatterns(validation.text);
  const patternIncrease = afterPatterns.total - beforePatterns.total;
  if (patternIncrease > maxPatternIncrease) {
    return {
      text: chunk.text,
      ok: false,
      metrics: afterMetrics,
      beforeMetrics,
      error: `Recast increased chatbot patterns (${beforePatterns.total} → ${afterPatterns.total}, +${patternIncrease})`,
      warnings: ['Chatbot pattern increase: recast introduced new patterns'],
      validation,
      recastMode: mode,
      routing,
    };
  }

  // v4: Heading preservation gate (nonfiction)
  const headingResult = validateHeadingPreservation(chunk.text, validation.text, projectOrProfile);
  if (!headingResult.ok) {
    return {
      text: chunk.text,
      ok: false,
      metrics: afterMetrics,
      beforeMetrics,
      error: headingResult.error,
      warnings: ['Heading preservation gate: recast lost headings'],
      validation,
      recastMode: mode,
      routing,
      headingPreservation: headingResult,
    };
  }

  // v4: Literary anti-flattening guard
  const rules = getAntiChatbotRulesForProject(projectOrProfile);
  const literaryResult = validateLiteraryRecast(beforeMetrics, afterMetrics, { profileKey: rules.profileKey });
  if (!literaryResult.ok) {
    return {
      text: chunk.text,
      ok: false,
      metrics: afterMetrics,
      beforeMetrics,
      error: literaryResult.reason,
      warnings: ['Literary anti-flattening: recast flattened literary voice'],
      validation,
      recastMode: mode,
      routing,
      headingPreservation: headingResult,
      literaryAntiFlattening: literaryResult,
    };
  }

  return {
    text: validation.text,
    ok: true,
    metrics: afterMetrics,
    beforeMetrics,
    error: null,
    warnings: validation.warnings,
    validation,
    recastMode: mode,
    routing,
    headingPreservation: headingResult,
    literaryAntiFlattening: literaryResult,
  };
}


// ─── Chunk Recast with Length Retry ───────────────────────────────────────

/**
 * Recast a chunk with retry-on-compression.
 * If the first recast fails ONLY due to word-count ratio, retries once
 * with a stricter length-correction prompt.
 *
 * @param {{ text: string }} chunk
 * @param {Object} [projectOrProfile]
 * @param {Object} [options]
 * @returns {Promise<{ text: string, ok: boolean, metrics: Object|null, beforeMetrics: Object|null, error: string|null, warnings: string[], validation: Object|null, recastMode: string, retryAttempted: boolean, retrySucceeded: boolean }>}
 */
export async function recastChunkWithLengthRetry(chunk, projectOrProfile, options = {}) {
  const enableRetry = options.enableLengthRetry ?? DEFAULTS.enableLengthRetry;
  const maxRetries = options.maxLengthRetries ?? DEFAULTS.maxLengthRetries;

  // First attempt
  const firstResult = await recastChunkWithAntiChatbotRules(chunk, projectOrProfile, options);

  // If it succeeded or retry is disabled, return as-is
  if (firstResult.ok || !enableRetry || maxRetries < 1) {
    return { ...firstResult, retryAttempted: false, retrySucceeded: false };
  }

  // Only retry on word-count ratio failures
  if (!isWordCountRatioFailure(firstResult.validation)) {
    return { ...firstResult, retryAttempted: false, retrySucceeded: false };
  }

  // Build the length correction prompt
  const { callLLM } = options;
  if (!callLLM) {
    return { ...firstResult, retryAttempted: false, retrySucceeded: false };
  }

  // Get the failed recast text from the validation (cleaned version)
  // We need the raw LLM output, which we don't have — but we can use the word counts
  // to build the correction prompt with the original and guidance
  const mode = options.recastMode || RECAST_MODE.CONSERVATIVE;
  const retryPrompt = buildLengthCorrectionPrompt(
    chunk,
    firstResult.validation?.text !== chunk.text ? firstResult.validation?.text : 'The previous revision was rejected.',
    projectOrProfile,
    {
      origWords: firstResult.validation?.origWords || countWords(chunk.text),
      recastWords: firstResult.validation?.recastWords || 0,
      minAllowed: firstResult.validation?.minAllowed || Math.floor(countWords(chunk.text) * 0.92),
      maxAllowed: firstResult.validation?.maxAllowed || Math.ceil(countWords(chunk.text) * 1.10),
    }
  );

  let retryRaw;
  try {
    retryRaw = await callLLM(retryPrompt);
  } catch (err) {
    return { ...firstResult, retryAttempted: true, retrySucceeded: false, error: `Retry LLM call failed: ${err?.message || 'unknown'}` };
  }

  if (typeof retryRaw !== 'string') {
    retryRaw = retryRaw?.text || retryRaw?.content || String(retryRaw || '');
  }

  const retryValidation = validateRecast(chunk.text, retryRaw, { recastMode: mode });

  if (!retryValidation.ok) {
    return {
      text: chunk.text,
      ok: false,
      metrics: null,
      beforeMetrics: firstResult.beforeMetrics,
      error: `Retry also failed: ${retryValidation.error}`,
      warnings: [...(firstResult.warnings || []), 'Length retry attempted but failed'],
      validation: retryValidation,
      recastMode: mode,
      retryAttempted: true,
      retrySucceeded: false,
    };
  }

  const afterMetrics = analyzeProseTexture(retryValidation.text);
  const beforeMetrics = firstResult.beforeMetrics;

  // Same quality guards as initial recast
  const maxScoreRegression = options.maxScoreRegression ?? DEFAULTS.maxScoreRegression;
  if (beforeMetrics && afterMetrics.compositeScore < beforeMetrics.compositeScore - maxScoreRegression) {
    return {
      text: chunk.text,
      ok: false,
      metrics: afterMetrics,
      beforeMetrics,
      error: `Retry recast scored lower (${afterMetrics.compositeScore} < ${beforeMetrics.compositeScore})`,
      warnings: ['Length retry passed ratio but scored worse'],
      validation: retryValidation,
      recastMode: mode,
      retryAttempted: true,
      retrySucceeded: false,
    };
  }

  return {
    text: retryValidation.text,
    ok: true,
    metrics: afterMetrics,
    beforeMetrics,
    error: null,
    warnings: retryValidation.warnings,
    validation: retryValidation,
    recastMode: mode,
    retryAttempted: true,
    retrySucceeded: true,
  };
}


// ─── Full Pipeline ────────────────────────────────────────────────────────

/**
 * Run the full anti-chatbot recast pipeline on a text.
 *
 * @param {string} text - Full text to process
 * @param {Object} [projectOrProfile] - Project for genre resolution
 * @param {Object} [options]
 * @param {Function} [options.callLLM] - LLM call function
 * @param {number} [options.recastThreshold]
 * @param {number} [options.skipThreshold]
 * @param {number} [options.maxRecastsPerRun]
 * @param {string} [options.recastMode]
 * @param {boolean} [options.enableLengthRetry]
 * @returns {Promise<{ text: string, report: Object }>}
 */
export async function runAntiChatbotRecastPipeline(text, projectOrProfile, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const rules = getAntiChatbotRulesForProject(projectOrProfile);
  const mode = opts.recastMode || RECAST_MODE.CONSERVATIVE;
  const NONFICTION_PROFILES = new Set(['nonfiction', 'business_guide', 'training_manual']);
  const isNonfiction = NONFICTION_PROFILES.has(rules.profileKey);

  const report = {
    profileUsed: rules.profileKey,
    recastMode: mode,
    pipelineVersion: VERSION,
    chunksAnalyzed: 0,
    chunksSkipped: 0,
    chunksRecast: 0,
    chunksFailed: 0,
    chunksRetried: 0,
    chunksRetrySucceeded: 0,
    beforeMetrics: null,
    afterMetrics: null,
    safetyBlocks: 0,
    referenceBlocks: 0,
    headingBlocks: 0,
    literaryFlatteningBlocks: 0,
    overcorrectionWarnings: [],
    chunkDetails: [],
    routingReport: null,
    // v5: nonfiction-specific fields
    deterministicCleanup: null,
    microRecastReport: null,
  };

  // Analyze full text before
  report.beforeMetrics = analyzeProseTexture(text);

  // ── v5: Nonfiction deterministic cleanup + micro-recast path ──
  if (isNonfiction && !options.skipNonfictionCleanup) {
    // Phase 1: Deterministic cleanup (no LLM)
    const cleanupResult = runNonfictionDeterministicCleanup(text, projectOrProfile);
    report.deterministicCleanup = {
      applied: cleanupResult.applied,
      changes: cleanupResult.changeLog,
      essayBotRemoved: cleanupResult.changeLog.essayBot?.length || 0,
      filterVerbsReduced: cleanupResult.changeLog.filterVerbs?.length || 0,
      openingsFixed: cleanupResult.changeLog.openings?.length || 0,
      notJustReduced: cleanupResult.changeLog.notJust?.length || 0,
      beforeWeaknesses: cleanupResult.beforeWeaknesses,
      afterWeaknesses: cleanupResult.afterWeaknesses,
    };

    let currentText = cleanupResult.text;

    // Phase 2: Micro-recast eligible weak paragraphs (LLM)
    if (opts.callLLM || opts.callLLMForModel) {
      const microResult = await runNonfictionMicroRecastPipeline(currentText, projectOrProfile, {
        callLLM: opts.callLLM,
        callLLMForModel: opts.callLLMForModel,
        microRecastThreshold: opts.recastThreshold || 75,
        maxMicroRecasts: opts.maxRecastsPerRun || 10,
      });
      report.microRecastReport = microResult.report;
      currentText = microResult.text;
    }

    // Global structure validation
    const structureCheck = preserveNonfictionStructure(text, currentText);
    if (!structureCheck.ok) {
      // Abort nonfiction path — return original
      report.afterMetrics = report.beforeMetrics;
      report.safetyBlocks++;
      setRecastReportGlobal(report);
      return { text, report };
    }

    report.afterMetrics = analyzeProseTexture(currentText);
    report.chunksAnalyzed = report.microRecastReport?.unitsAnalyzed || 0;
    report.chunksRecast = (report.deterministicCleanup.applied ? 1 : 0) + (report.microRecastReport?.unitsRecast || 0);
    report.chunksSkipped = report.microRecastReport?.unitsSkipped || 0;
    report.chunksFailed = report.microRecastReport?.unitsFailed || 0;
    setRecastReportGlobal(report);
    return { text: currentText, report };
  }

  // ── Standard chunk pipeline (fiction, literary, thriller, etc.) ──

  // Split into chunks
  const { chunks } = splitTextIntoRecastChunks(text, opts);
  report.chunksAnalyzed = chunks.length;

  if (chunks.length === 0) {
    report.afterMetrics = report.beforeMetrics;
    setRecastReportGlobal(report);
    return { text, report };
  }

  // Process each chunk
  let recastCount = 0;
  const processedChunks = [];

  for (const chunk of chunks) {
    const eligibility = shouldRecastChunk(chunk, projectOrProfile, opts);
    const origWords = countWords(chunk.text);
    const { minWordRatio, maxWordRatio } = getWordRatioForMode(mode);
    const detail = {
      index: chunk.index,
      action: 'skipped',
      beforeScore: eligibility.metrics?.compositeScore || null,
      afterScore: null,
      reason: eligibility.reason,
      origWords,
      recastWords: null,
      ratio: null,
      minAllowed: Math.floor(origWords * minWordRatio),
      maxAllowed: Math.ceil(origWords * maxWordRatio),
      retryAttempted: false,
      retrySucceeded: false,
      recastMode: mode,
      // v4 routing fields
      selectedModel: null,
      routingReason: null,
      weaknessTypes: null,
      headingPreservation: null,
      literaryAntiFlattening: null,
    };

    if (!eligibility.eligible) {
      report.chunksSkipped++;
      // Track specific block types
      if (eligibility.reason.includes('citation') || eligibility.reason.includes('bibliography')) {
        report.referenceBlocks++;
      }
      processedChunks.push(chunk.text);
      report.chunkDetails.push(detail);
      continue;
    }

    // Safety limit on recasts per run
    if (recastCount >= opts.maxRecastsPerRun) {
      report.chunksSkipped++;
      detail.reason = `Max recasts per run reached (${opts.maxRecastsPerRun})`;
      processedChunks.push(chunk.text);
      report.chunkDetails.push(detail);
      continue;
    }

    // Recast the chunk with length retry support
    const result = await recastChunkWithLengthRetry(chunk, projectOrProfile, opts);

    detail.retryAttempted = result.retryAttempted || false;
    detail.retrySucceeded = result.retrySucceeded || false;
    detail.recastWords = result.validation?.recastWords || null;
    detail.ratio = result.validation?.ratio ? Math.round(result.validation.ratio * 100) : null;

    if (result.retryAttempted) {
      report.chunksRetried++;
    }

    // v4: capture routing metadata
    if (result.routing) {
      detail.selectedModel = result.routing.model;
      detail.routingReason = result.routing.reason;
      detail.weaknessTypes = result.routing.weaknesses;
    }
    detail.headingPreservation = result.headingPreservation || null;
    detail.literaryAntiFlattening = result.literaryAntiFlattening || null;

    if (result.ok) {
      recastCount++;
      report.chunksRecast++;
      detail.action = 'recast';
      detail.afterScore = result.metrics?.compositeScore || null;
      processedChunks.push(result.text);
      if (result.retrySucceeded) {
        report.chunksRetrySucceeded++;
      }
    } else {
      report.chunksFailed++;
      report.safetyBlocks++;
      detail.action = 'failed';
      detail.reason = result.error || 'Unknown failure';

      if (result.warnings?.some(w => w.includes('Overcorrection'))) {
        report.overcorrectionWarnings.push(`Chunk ${chunk.index}: ${result.error}`);
      }
      if (result.warnings?.some(w => w.includes('Heading preservation'))) {
        report.headingBlocks++;
      }
      if (result.warnings?.some(w => w.includes('Literary anti-flattening'))) {
        report.literaryFlatteningBlocks++;
      }

      processedChunks.push(chunk.text);
    }

    report.chunkDetails.push(detail);
  }

  const finalText = processedChunks.join('\n\n');
  report.afterMetrics = analyzeProseTexture(finalText);

  // v4: Build routing report
  report.routingReport = buildRecastModelRoutingReport(report.chunkDetails);

  setRecastReportGlobal(report);

  return { text: finalText, report };
}


// ─── Debug/Report Global ──────────────────────────────────────────────────

/**
 * Set the recast report on the global window object for debugging.
 * Silently fails if window is not available (Node.js).
 */
function setRecastReportGlobal(report) {
  try {
    if (typeof window !== 'undefined') {
      window.__UBS_LAST_ANTI_CHATBOT_RECAST_REPORT = report;
    }
    if (typeof globalThis !== 'undefined') {
      globalThis.__UBS_LAST_ANTI_CHATBOT_RECAST_REPORT = report;
    }
  } catch {
    // Silently fail in restricted environments
  }
}


// ─── Exports ──────────────────────────────────────────────────────────────

export default {
  VERSION,
  RECAST_MODE,
  splitTextIntoRecastChunks,
  shouldRecastChunk,
  buildChunkRecastPrompt,
  getWordRatioForMode,
  recastChunkWithAntiChatbotRules,
  recastChunkWithLengthRetry,
  runAntiChatbotRecastPipeline,
  validateRecast,
  isWordCountRatioFailure,
  buildLengthCorrectionPrompt,
  detectProtections,
  PROTECTION_TYPE,
};
