// src/lib/llmProsePolisher.js — LLM-based prose polish for fiction chapters
// Calls the local Ollama prose-polisher model through callAgent.
// Returns polished text for the caller to validate and save.
// Does NOT save anything directly.

import { POLISHER_ANTI_CHATBOT_RULES, getAntiChatbotRulesForProject } from './antiChatbotProse.js';

// Lazy import: callAgent is only needed when no callLLM override is provided.
// This allows the module to be imported in Node.js tests without Vite's @/ alias.
let _callAgent = null;
async function getCallAgent() {
  if (!_callAgent) {
    const mod = await import(/* @vite-ignore */ '@/lib/localLLM');
    _callAgent = mod.callAgent;
  }
  return _callAgent;
}

// ─── SYSTEM PROMPT ─────────────────────────────────────────────────────────

export const PROSE_POLISHER_SYSTEM_PROMPT = `You are a conservative fiction prose line editor. Your job is to polish the provided chapter without rewriting the story.

PRESERVATION RULES:
- Preserve all plot events, character names, setting details, chapter order, and chapter title.
- Preserve the ending's story function.
- Do not add new scenes, characters, or lore.
- Do not summarize.
- Keep the author's dark speculative tone.

DIALOGUE MECHANICS (CRITICAL):
- Fix missing opening quotation marks. If dialogue has a closing quote and attribution tag but no opening quote, insert the opening quote at the correct position.
- Make all dialogue punctuation publishable (American style: period/comma inside quotes).
- Preserve speaker identity — do not change who says what.
- Do not remove dialogue tags unless the speaker is completely obvious from context.
- Ensure every spoken line has both an opening and a closing quote.
- Dialogue examples to fix: 'No," she said' → '"No," she said'; 'The game is the model, Marcus," she retorted' → '"The game is the model, Marcus," she retorted'.

AI-SLOP REDUCTION (CRITICAL):
- Reduce overuse of: "not just," "wasn't just," "didn't just," "isn't just," "more than just."
- Reduce overuse of: "felt," "realized," "the weight of," "the realization."
- Reduce overuse of: "narrative," "performance," "the system wasn't just," "the platform wasn't just."
- Reduce: "settled over," "washed over," "something shifted," "palpable," "meticulously," "luminous."
- Replace abstract thesis-style explanation with concrete image, action, or dialogue.
- Do not mechanically delete phrases if deletion breaks grammar — recast the sentence naturally.
- Preserve meaning while recasting.
- Do not delete plot-critical sentences.

PROSE QUALITY:
- Improve sentence rhythm, clarity, and readability.
- Remove obvious AI-generated cadence and repeated rhetorical patterns.
- Reduce repeated thesis language ("X wasn't just Y; it was Z" over and over).
- Prefer concrete action, image, dialogue, and object handling over abstract explanation.
- Cut 5–12% MAXIMUM — only if the prose is bloated. NEVER cut more than 12%.
- Do not delete entire paragraphs, scenes, or substantial passages.
- Do not make the prose more ornate or more generic.
- Do not use "The air…" as a chapter opening.
- CRITICAL: The polished chapter MUST retain at least 88% of the original word count.
  If in doubt, preserve text rather than cutting it.
${POLISHER_ANTI_CHATBOT_RULES}

FORBIDDEN OUTPUT:
- Do not include notes, critique, analysis, headings, bullet points, or explanation.
- Do not introduce process language like "Action Plan," "Next Move," "Analysis," or "Revision Notes."
- Do not start your response with "Here is the polished chapter" or similar preamble.
- Output finished fiction prose ONLY.`;

/**
 * Build a genre-conditional polisher system prompt.
 * Uses getAntiChatbotRulesForProject to pick the right polish rules
 * for the project's genre/book_type.
 *
 * @param {Object} [project] — project object for genre resolution
 * @returns {string} The complete system prompt
 */
export function buildPolisherSystemPrompt(project) {
  const { polisherRules } = getAntiChatbotRulesForProject(project);
  const base = PROSE_POLISHER_SYSTEM_PROMPT.replace(POLISHER_ANTI_CHATBOT_RULES, polisherRules);
  return base;
}

// ─── GUARDRAIL PATTERNS ────────────────────────────────────────────────────

const PROCESS_LEAKAGE_PATTERNS = [
  /\bAction Plan\b/i,
  /\bNext Move\b/i,
  /\bAnalysis\b\s*:/i,
  /\bRevision Notes\b/i,
  /\bHere is the revised/i,
  /\bHere is the polished/i,
  /\bHere's the polished/i,
  /\bI've made the following/i,
  /\bI have made the following/i,
  /\bChanges made\b/i,
  /\bAs an AI\b/i,
  /\bAs a language model\b/i,
  /\bI cannot\b/i,
  /\bI'm unable to\b/i,
  /\bI am unable to\b/i,
  /\bNote:\s/i,
  /\bPlease note\b/i,
  /\bKey changes\b/i,
  /\bSummary of changes\b/i,
];

const CONTAMINATION_PATTERNS = [
  /\bUnity Supported Living\b/i,
  /\bUnity Media\b/i,
  /\bcompliance documentation\b/i,
  /\bcare documentation\b/i,
];

// ─── HELPERS ───────────────────────────────────────────────────────────────

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function cleanLLMOutput(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.trim();

  // Strip markdown code fences
  text = text.replace(/^```[\w]*\s*\n?/m, '').replace(/\n?```\s*$/m, '');

  // Strip preamble lines like "Here is the polished chapter:" or "Sure, here's..."
  text = text.replace(/^(?:Here(?:'s| is) (?:the |your )(?:polished|revised|edited) (?:chapter|text|version)[:\.\!]?\s*\n?)+/i, '');
  text = text.replace(/^(?:Sure[,!.]?\s*(?:here(?:'s| is))?.*?:\s*\n?)/i, '');

  return text.trim();
}

// ─── OUTPUT VALIDATION ─────────────────────────────────────────────────────

/**
 * Validate LLM polisher output against guardrails.
 * @param {string} output - The raw/cleaned LLM output
 * @param {string} original - The original chapter text
 * @param {string} expectedTitle - The chapter title (optional)
 * @returns {{ ok: boolean, text: string, warnings: string[], error: string|null }}
 */
export function validatePolisherOutput(output, original, expectedTitle = '') {
  const warnings = [];
  const cleaned = cleanLLMOutput(output);

  // ── Hard fail: empty ──
  if (!cleaned || cleaned.length < 50) {
    return { ok: false, text: original, warnings, error: 'LLM output is empty or too short (' + cleaned.length + ' chars)' };
  }

  // ── Hard fail: process leakage ──
  for (const pat of PROCESS_LEAKAGE_PATTERNS) {
    if (pat.test(cleaned)) {
      return { ok: false, text: original, warnings, error: 'LLM output contains process leakage: ' + pat.source };
    }
  }

  // ── Hard fail: contamination ──
  for (const pat of CONTAMINATION_PATTERNS) {
    if (pat.test(cleaned)) {
      return { ok: false, text: original, warnings, error: 'LLM output contains contamination: ' + pat.source };
    }
  }

  // ── Hard fail: starts with analysis/critique format ──
  const firstLine = cleaned.split('\n')[0].trim();
  if (/^(?:#|\*\*|[-*]\s|\d+\.\s)/.test(firstLine)) {
    return { ok: false, text: original, warnings, error: 'LLM output starts with analysis/notes format (headings, bullets, or numbered list)' };
  }

  // ── Word count bounds ──
  const wordsBefore = countWords(original);
  const wordsAfter = countWords(cleaned);
  const ratio = wordsBefore > 0 ? wordsAfter / wordsBefore : 0;

  if (ratio < 0.88) {
    return { ok: false, text: original, warnings, error: `LLM cut more than 12% of content (${wordsBefore} → ${wordsAfter} words, ${Math.round(ratio * 100)}%)` };
  }
  if (ratio > 1.15) {
    return { ok: false, text: original, warnings, error: `LLM expanded more than 15% (${wordsBefore} → ${wordsAfter} words, ${Math.round(ratio * 100)}%)` };
  }
  if (ratio < 0.92) {
    warnings.push(`LLM cut more than 8% (${wordsBefore} → ${wordsAfter} words, ${Math.round(ratio * 100)}%)`);
  }

  // ── Soft warning: chapter opening ──
  if (/^The air\b/i.test(cleaned.split('\n').find(l => l.trim().length > 10)?.trim() || '')) {
    warnings.push('Chapter opening uses "The air…" pattern');
  }

  // ── Soft warning: missing title ──
  if (expectedTitle && expectedTitle.length > 3) {
    const first500 = cleaned.substring(0, 500);
    const titleWords = expectedTitle.split(/\s+/).slice(0, 3).join(' ');
    if (!first500.includes(expectedTitle) && !first500.includes(titleWords)) {
      warnings.push('Chapter title "' + expectedTitle + '" not found in first 500 chars of output');
    }
  }

  return { ok: true, text: cleaned, warnings, error: null };
}

// ─── MAIN LLM POLISH FUNCTION ──────────────────────────────────────────────

/**
 * Polish a single chapter using the LLM prose polisher.
 *
 * @param {object} params
 * @param {string} params.chapterText - The raw chapter text to polish
 * @param {string} params.chapterTitle - The chapter title
 * @param {number} params.chapterNumber - Chapter number
 * @param {string} [params.projectContext] - Brief project description
 * @param {object} [params.project] - Full project object (for model routing)
 * @param {number} [params.timeoutMs=600000] - Timeout in ms (default 10 min)
 * @param {function} [params.callLLM] - Override for the LLM call function (for testing)
 * @returns {Promise<{ok: boolean, text: string, raw: string, wordDelta: number, warnings: string[], error: string|null}>}
 */
export async function polishChapterWithLLM({
  chapterText,
  chapterTitle = '',
  chapterNumber = 0,
  projectContext = '',
  project = null,
  timeoutMs = 600000,
  callLLM = null,
}) {
  const wordsBefore = countWords(chapterText);
  const logPrefix = `[LLM-POLISH] Ch.${chapterNumber}`;

  console.log(`${logPrefix}: Starting LLM prose polish (${wordsBefore} words)`);

  // ── Build user prompt ──
  const userPrompt = [
    'Polish this chapter conservatively.',
    '',
    `Chapter Number: ${chapterNumber}`,
    `Chapter Title: ${chapterTitle}`,
    projectContext ? `\nProject Context:\n${projectContext}\n` : '',
    'Chapter Text:',
    chapterText,
    '',
    'Return only the polished chapter prose.',
  ].join('\n');

  // ── Call LLM ──
  const llmCallFn = callLLM || (async (prompt, systemPrompt) => {
    const agent = await getCallAgent();
    return agent({
      prompt,
      taskType: 'polish',
      project,
      temperature: 0.3,
      maxTokens: Math.max(8192, Math.ceil(chapterText.length / 3)),
      systemPromptOverride: systemPrompt,
    });
  });

  let raw;
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LLM polish timed out after ' + Math.round(timeoutMs / 1000) + 's')), timeoutMs)
    );

    raw = await Promise.race([
      llmCallFn(userPrompt, buildPolisherSystemPrompt(project)),
      timeoutPromise,
    ]);
  } catch (err) {
    console.error(`${logPrefix}: LLM call failed:`, err?.message || err);
    return {
      ok: false,
      text: chapterText,
      raw: '',
      wordDelta: 0,
      warnings: [],
      error: `LLM call failed: ${err?.message || 'unknown error'}`,
    };
  }

  // Handle non-string responses
  if (typeof raw !== 'string') {
    raw = raw?.text || raw?.content || String(raw || '');
  }

  console.log(`${logPrefix}: LLM returned ${raw.length} chars`);

  // ── Validate output ──
  const validation = validatePolisherOutput(raw, chapterText, chapterTitle);

  const wordsAfter = countWords(validation.text);
  const wordDelta = wordsAfter - wordsBefore;
  const deltaPct = wordsBefore > 0 ? Math.round((wordDelta / wordsBefore) * 100) : 0;

  if (validation.ok) {
    console.log(`${logPrefix}: ✅ PASS (${wordsBefore} → ${wordsAfter} words, ${deltaPct > 0 ? '+' : ''}${deltaPct}%)`);
  } else {
    console.warn(`${logPrefix}: ❌ REJECTED — ${validation.error}`);
  }

  if (validation.warnings.length > 0) {
    for (const w of validation.warnings) {
      console.warn(`${logPrefix}: ⚠️ ${w}`);
    }
  }

  return {
    ok: validation.ok,
    text: validation.text,
    raw: typeof raw === 'string' ? raw : String(raw || ''),
    wordDelta,
    warnings: validation.warnings,
    error: validation.error,
  };
}
