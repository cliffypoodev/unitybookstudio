// src/lib/critiquePipeline.js — Deep critique pipeline with contract validation

import { invokeLLMWithRetry } from '@/lib/integrationRetry.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CHAPTER_CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'object',
      properties: {
        plot: { type: 'number' },
        pacing: { type: 'number' },
        character: { type: 'number' },
        prose: { type: 'number' },
        immersion: { type: 'number' },
      },
      required: ['plot', 'pacing', 'character', 'prose', 'immersion'],
    },
    strengths: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quote: { type: 'string' },
        },
        required: ['description', 'quote'],
      },
    },
    weaknesses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quote: { type: 'string' },
          paragraphHint: { type: 'string' },
          severity: { type: 'string' },
          fixType: { type: 'string' },
        },
        required: ['description', 'quote', 'severity', 'fixType'],
      },
    },
    putDownMoments: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['scores', 'strengths', 'weaknesses', 'putDownMoments'],
};

const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    threadWatch: { type: 'array', items: { type: 'string' } },
    marketability: { type: 'string' },
  },
  required: ['threadWatch', 'marketability'],
};

// ─── Contract Validator ───────────────────────────────────────────────────────

function normalizeForMatch(text) {
  return text
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function validateCritiqueContract(critique, chapterText) {
  const violations = [];
  const normalizedChapter = normalizeForMatch(chapterText);

  // Check weakness quotes
  for (const w of (critique.weaknesses || [])) {
    if (w.quote) {
      const normalizedQuote = normalizeForMatch(w.quote);
      if (!normalizedChapter.includes(normalizedQuote)) {
        violations.push(`Weakness quote not found in chapter: "${w.quote.slice(0, 60)}..."`);
      }
    }
  }

  // Check strength quotes
  for (const s of (critique.strengths || [])) {
    if (s.quote) {
      const normalizedQuote = normalizeForMatch(s.quote);
      if (!normalizedChapter.includes(normalizedQuote)) {
        violations.push(`Strength quote not found in chapter: "${s.quote.slice(0, 60)}..."`);
      }
    }
  }

  // Min 3 weaknesses
  if ((critique.weaknesses || []).length < 3) {
    violations.push(`Only ${(critique.weaknesses || []).length} weaknesses found (minimum 3 required)`);
  }

  // Scores 1-10
  for (const [area, score] of Object.entries(critique.scores || {})) {
    if (typeof score !== 'number' || score < 1 || score > 10) {
      violations.push(`Score for ${area} is out of range: ${score}`);
    }
  }

  // Banned phrases
  const BANNED = ['overall this is strong', 'compelling read', 'great job', 'well done', 'nicely crafted'];
  for (const w of (critique.weaknesses || []).concat(critique.strengths || [])) {
    const desc = (w.description || '').toLowerCase();
    for (const banned of BANNED) {
      if (desc.includes(banned)) {
        violations.push(`Banned phrase "${banned}" found in description`);
      }
    }
  }

  return { passed: violations.length === 0, violations };
}

// ─── Dashboard (deterministic) ───────────────────────────────────────────────

function computeDashboard(chapterCritiques) {
  const areas = ['plot', 'pacing', 'character', 'prose', 'immersion'];
  const dashboard = areas.map(area => {
    const scores = chapterCritiques.map(c => c.scores[area]).filter(s => typeof s === 'number');
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
    const rounded = Math.round(avg * 10) / 10;
    const color = rounded >= 7 ? 'green' : rounded >= 5 ? 'amber' : 'red';
    const verdictMap = {
      green: area === 'plot' ? 'Plot structure is solid'
        : area === 'pacing' ? 'Pacing holds attention'
        : area === 'character' ? 'Characters feel alive'
        : area === 'prose' ? 'Prose is clean and engaging'
        : 'Immersion is strong',
      amber: `${area.charAt(0).toUpperCase() + area.slice(1)} needs work in places`,
      red: `${area.charAt(0).toUpperCase() + area.slice(1)} has significant issues`,
    };
    return {
      area: area.charAt(0).toUpperCase() + area.slice(1),
      score: rounded,
      color,
      verdict: verdictMap[color],
    };
  });
  return dashboard;
}

// ─── Priority Fix List (deterministic) ───────────────────────────────────────

function buildPriorityFixList(chapterCritiques) {
  const fixes = [];
  for (const cc of chapterCritiques) {
    for (const w of (cc.weaknesses || [])) {
      fixes.push({
        severity: w.severity || 'C',
        chapterNumber: cc.chapterNumber,
        quote: w.quote || '',
        description: w.description || '',
        fixType: w.fixType || 'manual',
        source: 'deep-critique',
      });
    }
  }
  const order = { A: 0, B: 1, C: 2 };
  fixes.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  return fixes;
}

// ─── Prompt Builders ─────────────────────────────────────────────────────────

function buildChapterCritiquePrompt(entry, chapterText, evidenceForChapter, beatDelivery, retryViolations) {
  const truncated = chapterText.slice(0, 12000);
  const chNum = entry.chapter?.chapter_number ?? entry.chapter?.chapterNumber ?? '?';
  let prompt = `You are a ruthless fiction editor. Critique Chapter ${chNum} below.\n\n`;
  prompt += `--- CHAPTER TEXT (first 12000 chars) ---\n${truncated}\n--- END CHAPTER TEXT ---\n\n`;

  if (evidenceForChapter) {
    prompt += `--- EVIDENCE DATA ---\n`;
    prompt += `Slop score: ${evidenceForChapter.slopScore ?? 'N/A'}\n`;
    prompt += `Dialogue ratio: ${evidenceForChapter.dialogueRatio ?? 'N/A'}\n`;
    if (evidenceForChapter.forensicTics && evidenceForChapter.forensicTics.length > 0) {
      prompt += `Forensic tics: ${JSON.stringify(evidenceForChapter.forensicTics)}\n`;
    }
    prompt += `--- END EVIDENCE ---\n\n`;
  }

  if (beatDelivery) {
    prompt += `--- PLAN DELIVERY ---\n`;
    prompt += `Beats delivered: ${JSON.stringify(beatDelivery.delivered || [])}\n`;
    prompt += `Beats missing: ${JSON.stringify(beatDelivery.missing || [])}\n`;
    prompt += `Beats altered: ${JSON.stringify(beatDelivery.altered || [])}\n`;
    prompt += `--- END PLAN DELIVERY ---\n\n`;
  }

  prompt += `STRICT OUTPUT CONTRACT:\n\n`;
  prompt += `Score anchors — use these, not your intuition:\n`;
  prompt += `3 = serious structural issues, confusing, hard to follow\n`;
  prompt += `5 = functional but unremarkable, competent but forgettable\n`;
  prompt += `7 = engaging, polished, would hold a reader's attention\n`;
  prompt += `9 = exceptional craft, publishable in a competitive market\n\n`;

  prompt += `Every quote field MUST be copied VERBATIM from the chapter text. Do NOT paraphrase, summarize, or fabricate. The quote will be verified by exact string match.\n\n`;
  prompt += `You MUST list at LEAST 3 weaknesses. Finding zero weaknesses is impossible in any chapter.\n\n`;
  prompt += `BANNED phrases in your descriptions: 'overall this is strong', 'compelling read', 'great job', 'well done', 'nicely crafted'. If you use any of these without a supporting quote, the response will be rejected.\n\n`;

  prompt += `Return a JSON object matching this schema:\n${JSON.stringify(CHAPTER_CRITIQUE_SCHEMA, null, 2)}\n\n`;
  prompt += `- strengths: max 2 items. Each quote must be verbatim from the text.\n`;
  prompt += `- weaknesses: min 3 items. Each quote must be verbatim ≤40 words from chapter text. paragraphHint = first 10 words of the paragraph containing the quote. severity = 'A' | 'B' | 'C'. fixType = 'prose' | 'deterministic' | 'structural' | 'manual'.\n`;
  prompt += `- putDownMoments: max 3 — moments a reader would stop reading.\n`;
  prompt += `- scores: each 1-10 for plot, pacing, character, prose, immersion.\n\n`;
  prompt += `Return ONLY the JSON object. No markdown fences, no commentary.\n`;

  if (retryViolations && retryViolations.length > 0) {
    prompt += `\n--- PREVIOUS ATTEMPT FAILED CONTRACT VALIDATION ---\n`;
    prompt += `The following violations were found. Fix ALL of them:\n`;
    for (const v of retryViolations) {
      prompt += `- ${v}\n`;
    }
    prompt += `--- END VIOLATIONS ---\n`;
  }

  return prompt;
}

function buildSynthesisPrompt(chapterCritiques, evidence, planReport) {
  let prompt = `You are a manuscript analyst. Given per-chapter critiques and evidence, provide synthesis.\n\n`;

  prompt += `--- CHAPTER CRITIQUES ---\n${JSON.stringify(chapterCritiques, null, 2)}\n--- END CRITIQUES ---\n\n`;

  if (evidence) {
    prompt += `--- MANUSCRIPT EVIDENCE SUMMARY ---\n`;
    prompt += `Total chapters: ${evidence.totalChapters ?? 'N/A'}\n`;
    prompt += `Overall slop score: ${evidence.overallSlopScore ?? 'N/A'}\n`;
    prompt += `${JSON.stringify(evidence, null, 2).slice(0, 4000)}\n`;
    prompt += `--- END EVIDENCE ---\n\n`;
  }

  if (planReport) {
    prompt += `--- PLAN REPORT SUMMARY ---\n`;
    prompt += `${JSON.stringify(planReport, null, 2).slice(0, 3000)}\n`;
    prompt += `--- END PLAN REPORT ---\n\n`;
  }

  prompt += `Produce a JSON object with:\n`;
  prompt += `- threadWatch: array of strings — unresolved plot threads, contradictions, or continuity issues you noticed.\n`;
  prompt += `- marketability: one paragraph — honest assessment of the manuscript's commercial viability and target audience.\n\n`;
  prompt += `Return ONLY the JSON object matching this schema:\n${JSON.stringify(SYNTHESIS_SCHEMA, null, 2)}\n\n`;
  prompt += `Return ONLY the JSON object. No markdown fences, no commentary.\n`;

  return prompt;
}

// ─── LLM Caller Abstraction ─────────────────────────────────────────────────

async function callLLM(prompt, schema, temperature, _llmOverride) {
  if (_llmOverride) {
    const result = await _llmOverride(prompt);
    if (typeof result === 'string') {
      return JSON.parse(result);
    }
    return result;
  }
  return await invokeLLMWithRetry({
    prompt,
    task_type: 'critique',
    temperature,
    response_json_schema: schema,
  });
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

export async function runDeepCritique({ loaded, project, evidence, planReport, onProgress, _llmOverride }) {
  const chapterCritiques = [];

  // ── STAGE A: Per-chapter critique (sequential) ──
  for (let i = 0; i < loaded.length; i++) {
    const entry = loaded[i];
    const chapterNumber = entry.chapter?.chapter_number ?? entry.chapter?.chapterNumber ?? (i + 1);
    const chapterText = entry.content || '';

    const evidenceForChapter = evidence?.chapters?.[i] || null;
    const beatDelivery = planReport?.beatDelivery?.[i] || null;

    // First attempt
    const prompt = buildChapterCritiquePrompt(entry, chapterText, evidenceForChapter, beatDelivery, null);
    let critique = await callLLM(prompt, CHAPTER_CRITIQUE_SCHEMA, 0.3, _llmOverride);

    // Contract validation — first check
    let contract = validateCritiqueContract(critique, chapterText);

    if (!contract.passed) {
      // Retry ONCE with violations appended
      const retryPrompt = buildChapterCritiquePrompt(entry, chapterText, evidenceForChapter, beatDelivery, contract.violations);
      critique = await callLLM(retryPrompt, CHAPTER_CRITIQUE_SCHEMA, 0.3, _llmOverride);
      contract = validateCritiqueContract(critique, chapterText);
    }

    chapterCritiques.push({
      chapterNumber,
      scores: critique.scores || { plot: 5, pacing: 5, character: 5, prose: 5, immersion: 5 },
      strengths: (critique.strengths || []).slice(0, 2),
      weaknesses: critique.weaknesses || [],
      putDownMoments: (critique.putDownMoments || []).slice(0, 3),
      contractPassed: contract.passed,
      contractViolations: contract.violations,
    });

    onProgress?.('Critiquing Ch.' + chapterNumber + '…');
  }

  // ── STAGE B: Synthesis ──

  // Deterministic computations
  const dashboard = computeDashboard(chapterCritiques);
  const priorityFixList = buildPriorityFixList(chapterCritiques);
  const beatDeliveryTable = planReport?.beatDelivery || null;

  // LLM call for threadWatch + marketability
  const synthesisPrompt = buildSynthesisPrompt(chapterCritiques, evidence, planReport);
  let synthesisResult;
  try {
    synthesisResult = await callLLM(synthesisPrompt, SYNTHESIS_SCHEMA, 0.3, _llmOverride);
  } catch (err) {
    console.error('[CRITIQUE-PIPELINE] Synthesis LLM call failed:', err?.message);
    synthesisResult = { threadWatch: [], marketability: 'Synthesis unavailable due to LLM error.' };
  }

  const synthesis = {
    dashboard,
    priorityFixList,
    beatDeliveryTable,
    threadWatch: synthesisResult.threadWatch || [],
    marketability: synthesisResult.marketability || '',
  };

  return { chapterCritiques, synthesis };
}

// ─── Exports for testing ─────────────────────────────────────────────────────

export {
  CHAPTER_CRITIQUE_SCHEMA,
  SYNTHESIS_SCHEMA,
  normalizeForMatch,
  validateCritiqueContract,
  computeDashboard,
  buildPriorityFixList,
};

console.log('[CRITIQUE-PIPELINE] v1 loaded');
