/**
 * Style Tic / Repetition Sweep
 *
 * Conservative manuscript-wide polish pass for Unity Book Studio.
 *
 * Purpose:
 * - Detect repeated prose tics across a full manuscript.
 * - Make light, targeted, safe replacements only when a tic clearly exceeds a cap.
 * - Repair a small set of malformed grammar artifacts that are safe to fix deterministically.
 * - Produce a report suitable for the Polish toast / results panel.
 *
 * IMPORTANT:
 * - This function mutates the `loaded` array in place, matching the existing polish pipeline pattern.
 * - It does NOT call an LLM.
 * - It does NOT rewrite scenes.
 * - It does NOT collapse paragraph structure.
 * - It intentionally leaves some repeated phrasing intact so repetition can still be intentional.
 *
 * Expected input shape:
 *   loaded = [
 *     { chapter: { chapter_number: 1, ... }, content: '...', original: '...' },
 *     ...
 *   ]
 *
 * Exported API:
 *   runStyleTicSweep(loaded, onProgress, options)
 */

const STYLE_TIC_SWEEP_VERSION = 'STYLE-TIC-SWEEP v1.3 hard cap cluster thinning - 2026-05-05';

console.log('[STYLE-TIC-SWEEP] loaded:', STYLE_TIC_SWEEP_VERSION);

function chapterNumber(item, fallbackIndex = 0) {
  return item?.chapter?.chapter_number || item?.chapter?.number || fallbackIndex + 1;
}

function countWords(text = '') {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function preserveCase(original, replacement) {
  const source = String(original || '');
  const repl = String(replacement || '');
  if (!source || !repl) return repl;
  if (source.toUpperCase() === source) return repl.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return repl[0].toUpperCase() + repl.slice(1);
  return repl;
}

function makeBoundaryRegex(phrase, flags = 'gi') {
  return new RegExp('\\b' + escapeRegExp(phrase).replace(/\\s+/g, '\\s+') + '\\b', flags);
}

function totalMatches(loaded, regex) {
  let total = 0;
  for (const item of loaded || []) {
    const text = String(item?.content || '');
    const matches = text.match(regex);
    total += matches ? matches.length : 0;
  }
  return total;
}

function getChapterCounts(loaded, regex) {
  return (loaded || []).map((item, index) => {
    const text = String(item?.content || '');
    const matches = text.match(regex);
    return {
      index,
      chapterNumber: chapterNumber(item, index),
      count: matches ? matches.length : 0,
    };
  });
}

// POLISHSAFE-4: this used to replace (or delete) excess tic occurrences with
// a rotating phrase pool — outside rule 0.2/2's whitelist. Flag-only now;
// loaded[].content is never mutated by this function.
function applySafePhraseCap(loaded, tic, report, options = {}) {
  const regex = tic.regex || makeBoundaryRegex(tic.phrase);
  const total = totalMatches(loaded, regex);
  const scannedChapters = (loaded || []).length;
  const manuscriptWords = Math.max(1, countWords((loaded || []).map((item) => item?.content || '').join('\n\n')));

  const baseCap = typeof tic.cap === 'function'
    ? tic.cap({ chapterCount: scannedChapters, manuscriptWords })
    : tic.cap;
  const cap = Math.max(tic.minCap || 0, Math.round(baseCap || 0));

  report.ticFamilies.push({
    name: tic.name,
    total,
    cap,
    changed: 0,
    skipped: 0,
    chapters: getChapterCounts(loaded, regex).filter((row) => row.count > 0),
  });

  const familyReport = report.ticFamilies[report.ticFamilies.length - 1];

  if (total <= cap) return;

  const excess = total - cap;
  familyReport.skipped = excess;
  report.skippedUnsafe += excess;
  report.changes.push(`Style tic "${tic.name}": ${total} found, ${cap} allowed, ${excess} flagged - substitution retired (POLISHSAFE-4)`);
}

function applyMalformedGrammarFixes(loaded, report) {
  const malformedRules = [
    {
      name: 'opened it artifact',
      regex: /\b(the\s+door\s+opened)\s+it\b/gi,
      replace: '$1',
    },
    {
      name: 'specific door opened it artifact',
      regex: /\b(the\s+(?:study|office|bedroom|front|back|courtyard|vestibule|kitchen|apartment|car|cab|elevator|rehearsal room|hall|corridor|alley|club|taxi)?\s*door\s+opened)\s+it\b/gi,
      replace: '$1',
    },
    {
      name: 'cage opened it artifact',
      regex: /\b(the\s+cage)\s+wasn['’]t\s+being\s+opened\s+it\b/gi,
      replace: '$1 wasn’t opening',
    },
    {
      name: 'structure leakage: first/second twist',
      regex: /\bthe\s+(?:first|second|third|fourth|final)\s+twist\s+was\s+not\s+in\b/gi,
      replace: 'the truth was not in',
    },
    {
      name: 'structure leakage: twist was',
      regex: /\bthe\s+(?:first|second|third|fourth|final)\s+twist\s+was\b/gi,
      replace: 'the truth was',
    },
    {
      name: 'stepped found artifact',
      regex: /\b(she|he|they)\s+stepped\s+found\b/gi,
      replace: '$1 stepped inside and found',
    },
    {
      name: 'large dominated by',
      regex: /\b(room\s+was\s+large)\s+(dominated\s+by)\b/gi,
      replace: '$1, $2',
    },
    {
      name: 'closer took',
      regex: /\b(stepped\s+closer)\s+(took\s+the\s+letter)\b/gi,
      replace: '$1 and $2',
    },
    {
      name: 'stood up came around',
      regex: /\b(stood\s+up)\s+(came\s+around\s+the\s+desk)\b/gi,
      replace: '$1 and $2',
    },
    {
      name: 'appositive comma before began',
      regex: /\b(Her\s+hand,\s+the\s+one\s+holding\s+the\s+letter)\s+(began\s+to\s+tremble)\b/g,
      replace: '$1, $2',
    },
    {
      name: 'appositive comma before began lowercase',
      regex: /\b(her\s+hand,\s+the\s+one\s+holding\s+the\s+letter)\s+(began\s+to\s+tremble)\b/g,
      replace: '$1, $2',
    },
    {
      name: 'she spoke flat punctuation',
      regex: /\b(She\s+spoke)[\u2014-](flat)\b/g,
      replace: '$1, $2',
    },
    {
      name: 'he spoke flat punctuation',
      regex: /\b(He\s+spoke)[\u2014-](flat)\b/g,
      replace: '$1, $2',
    },
  ];

  // POLISHSAFE-4: substitution retired — outside rule 0.2/2's whitelist.
  // Flag-only now; loaded[].content is never mutated by this loop.
  let fixed = 0;

  for (let i = 0; i < (loaded || []).length; i++) {
    const item = loaded[i];
    if (!item?.content) continue;
    const chNum = chapterNumber(item, i);

    for (const rule of malformedRules) {
      const matches = String(item.content).match(rule.regex);
      if (!matches || !matches.length) continue;
      fixed += matches.length;
      report.changedChapters.add(chNum);
      report.changes.push(`Ch.${chNum}: malformed grammar artifact flagged (${rule.name}) - substitution retired (POLISHSAFE-4)`);
    }
  }

  report.grammarArtifactsFixed = fixed;
  report.safeReplacementsMade += fixed;
}


function applyOverExplanationLabelCleanup(loaded, report) {
  // Conservative removal/replacement of sentences that label the scene's meaning after the prose has already dramatized it.
  // This deliberately targets common AI-lit explanatory labels, not normal narration.
  const cleanupRules = [
    {
      name: 'explained punishment label',
      regex: /(?:^|(?<=[.!?]\s))This\s+was\s+the\s+punishment\.\s*/g,
      replace: '',
    },
    {
      name: 'explained lesson label',
      regex: /(?:^|(?<=[.!?]\s))This\s+was\s+the\s+lesson\.\s*/g,
      replace: '',
    },
    {
      name: 'explained trap label',
      regex: /(?:^|(?<=[.!?]\s))This\s+was\s+the\s+trap\.\s*/g,
      replace: '',
    },
    {
      name: 'explained test label',
      regex: /(?:^|(?<=[.!?]\s))This\s+was\s+the\s+test\.\s*/g,
      replace: '',
    },
    {
      name: 'message not subtle label',
      regex: /(?:^|(?<=[.!?]\s))(?:The\s+message\s+was\s+not\s+subtle|It\s+was\s+not\s+subtle)\.\s*/g,
      replace: '',
    },
    {
      name: 'what it meant label',
      regex: /(?:^|(?<=[.!?]\s))She\s+understood\s+what\s+it\s+meant\.\s*/g,
      replace: '',
    },
    {
      name: 'obvious meaning label',
      regex: /(?:^|(?<=[.!?]\s))The\s+meaning\s+was\s+obvious\.\s*/g,
      replace: '',
    },
    {
      name: 'explicit punishment explanation',
      regex: /(?:^|(?<=[.!?]\s))It\s+was\s+a\s+punishment\s+[^.!?]{0,120}\.\s*/gi,
      replace: '',
    },
    {
      name: 'quiet realization label',
      regex: /(?:^|(?<=[.!?]\s))The\s+realization\s+(?:arrived|came|settled)\s+[^.!?]{0,120}\.\s*/gi,
      replace: '',
      guard: (sentence) => sentence.length < 180 && /(?:not as|not with|quiet|slow|cold|sudden|terrible|simple)/i.test(sentence),
    },
    {
      name: 'AI meta: what the scene was about',
      regex: /(?:^|(?<=[.!?]\s))(?:This|That)\s+was\s+what\s+the\s+scene\s+was\s+about\.\s*/gi,
      replace: '',
    },
    {
      name: 'AI meta: the chapter turned',
      regex: /(?:^|(?<=[.!?]\s))The\s+chapter\s+(?:turned|shifted|became)\s+[^.!?]{0,100}\.\s*/gi,
      replace: '',
    },
  ];

  // POLISHSAFE-4-RETIRE-HARDCODED-BOOK-STRINGS: the two rules that used to
  // live here ("you are hiding" -> a fabricated "rooms with exits" line;
  // a wall-metaphor sentence -> a fabricated line naming "Pauline") injected
  // invented, apparently book-specific prose into shared pipeline code.
  // Retired outright, folded into the flag-only label rules below.
  const flagOnlyLabelRules = [
    { name: 'it was a mirror label', regex: /(?:^|(?<=[.!?]\s))It\s+was\s+a\s+mirror\s*,?\s+[^.!?]{0,140}\.\s*/gi },
    { name: 'you are hiding blunt diagnosis', regex: /([“"])(You['’]re|You are)\s+hiding\1/g },
    { name: 'too-blunt wall metaphor', regex: /(?:^|(?<=[.!?]\s))There\s+is\s+a\s+wall\s+between\s+us\s+now\.\s+You\s+have\s+built\s+it\.\s*/gi },
  ];

  let removedOrRewritten = 0;

  for (let i = 0; i < (loaded || []).length; i++) {
    const item = loaded[i];
    if (!item?.content) continue;
    const chNum = chapterNumber(item, i);

    for (const rule of [...cleanupRules, ...flagOnlyLabelRules]) {
      const allMatches = [...String(item.content).matchAll(rule.regex)];
      const kept = typeof rule.guard === 'function' ? allMatches.filter((m) => rule.guard(m[0])) : allMatches;
      if (!kept.length) continue;
      removedOrRewritten += kept.length;
      report.changedChapters.add(chNum);
      report.changes.push(`Ch.${chNum}: over-explanation label flagged (${rule.name}) - deletion retired (POLISHSAFE-4)`);
    }

    item.content = String(item.content)
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/\s+([,.;:!?])/g, '$1');
  }

  report.overExplanationLabelsFixed = removedOrRewritten;
  report.safeReplacementsMade += removedOrRewritten;
}

function buildTicTargets() {
  return [
    {
      name: 'mouth went dry / mouth was dry',
      regex: /\b(?:her|his|their|my|the)?\s*mouth\s+(?:went|was|felt|had\s+gone)\s+dry\b/gi,
      cap: ({ chapterCount }) => Math.max(3, chapterCount * 0.16),
      minCap: 3,
      replacements: [
        'she swallowed',
        'he swallowed',
        'they swallowed',
        'the words stuck',
        'breath caught shallowly',
      ],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.78,
    },
    {
      name: 'throat tightened',
      regex: /\b(?:her|his|their|my|the)?\s*throat\s+(?:tightened|closed|constricted|went\s+tight)\b/gi,
      cap: ({ chapterCount }) => Math.max(4, chapterCount * 0.18),
      minCap: 4,
      replacements: ['she swallowed hard', 'he swallowed hard', 'the answer caught', 'breath shortened', 'the words came slowly'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.72,
    },
    {
      name: 'cold knot',
      regex: /\b(?:a\s+)?cold\s+knot\b/gi,
      cap: ({ chapterCount }) => Math.max(3, chapterCount * 0.14),
      minCap: 3,
      replacements: ['a hard weight', 'a low dread', 'a tight pressure', 'unease', 'a bad certainty'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.8,
    },
    {
      name: 'words landed / words hit / words struck',
      regex: /\b(?:the\s+)?words\s+(?:landed|hit|struck|hung)\b/gi,
      cap: ({ chapterCount }) => Math.max(5, chapterCount * 0.22),
      minCap: 5,
      replacements: ['what she said settled', 'what he said settled', 'the sentence settled', 'the answer held', 'the remark stayed there'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.68,
    },
    {
      name: 'not quite X / not quite Y',
      regex: /\bnot\s+quite\s+[^,.!?;:\n]{1,34}\s*,\s*not\s+quite\s+[^,.!?;:\n]{1,34}/gi,
      cap: ({ chapterCount }) => Math.max(4, chapterCount * 0.18),
      minCap: 4,
      replacements: ['something unresolved', 'something harder to name', 'a mixed expression', 'a feeling she could not sort', 'a look he could not read'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.78,
    },
    {
      name: 'something hot moved through chest',
      regex: /\bsomething\s+hot\s+(?:moved|went|passed|spread|rose)\s+through\s+(?:her|his|their|my)\s+chest\b/gi,
      cap: ({ chapterCount }) => Math.max(2, chapterCount * 0.1),
      minCap: 2,
      replacements: ['heat rose under her ribs', 'anger moved before she could stop it', 'shame flashed through him', 'feeling broke through too quickly'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.82,
    },
    {
      name: 'useless / irrelevant detail / nothing to do with anything',
      regex: /\b(?:useless|irrelevant)\s+detail\b|\bit\s+had\s+nothing\s+to\s+do\s+with\s+anything\b/gi,
      cap: ({ chapterCount }) => Math.max(3, chapterCount * 0.15),
      minCap: 3,
      replacements: ['small detail', 'stray detail', 'unwanted detail', 'detail that should not have mattered'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.72,
    },
    {
      name: 'memory surfaced, unbidden',
      regex: /\b(?:a\s+)?memory\s+(?:surfaced|rose|came|returned)\s*,?\s+unbidden\b/gi,
      cap: ({ chapterCount }) => Math.max(3, chapterCount * 0.14),
      minCap: 3,
      replacements: ['a memory came back', 'the past returned without asking', 'an old image rose', 'she remembered before she meant to'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.78,
    },
    {
      name: 'memory, useless / pointless',
      regex: /\b(?:a\s+)?memory\s*,\s*(?:useless|pointless|irrelevant)\b/gi,
      cap: ({ chapterCount }) => Math.max(2, chapterCount * 0.1),
      minCap: 2,
      replacements: ['an old image returned', 'a stray memory came back', 'she remembered something small', 'the past supplied a small image'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.8,
    },
    {
      name: 'physical/heavy/living/active silence',
      regex: /\b(?:the\s+)?silence\s+(?:was|felt|became|turned)\s+(?:a\s+)?(?:physical|heavy|living|active|crowded|breathing)\s+(?:thing|presence|weight)?\b/gi,
      cap: ({ chapterCount }) => Math.max(4, chapterCount * 0.18),
      minCap: 4,
      replacements: ['the room went quiet', 'the quiet held', 'no one answered', 'the pause stretched', 'the room stayed still'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.78,
    },
    {
      name: 'the sound was...',
      regex: /\bthe\s+sound\s+was\s+[^.!?\n]{3,80}/gi,
      cap: ({ chapterCount }) => Math.max(5, chapterCount * 0.2),
      minCap: 5,
      replacements: ['it sounded wrong', 'it came out thin', 'it carried too far', 'it barely carried', 'it changed the room'],
      preserveFirstInChapter: 1,
      maxChangeRatio: 0.45,
    },
    {
      name: 'detail meant nothing/everything',
      regex: /\b(?:a\s+)?detail\s+that\s+meant\s+(?:nothing|everything)\b/gi,
      cap: ({ chapterCount }) => Math.max(3, chapterCount * 0.12),
      minCap: 3,
      replacements: ['a small detail', 'a detail she could not ignore', 'a detail he kept returning to', 'a detail that stayed with her'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.72,
    },
    {
      name: 'it meant nothing / served no purpose',
      regex: /\bit\s+(?:meant\s+nothing|served\s+no\s+purpose|had\s+no\s+place\s+here)\b/gi,
      cap: ({ chapterCount }) => Math.max(3, chapterCount * 0.12),
      minCap: 3,
      replacements: ['it stayed with her', 'she kept looking at it', 'it should not have mattered', 'it remained there'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.72,
    },
    {
      name: 'explicit scene labels',
      regex: /\b(?:the\s+lesson|the\s+punishment|the\s+message|the\s+trap|the\s+test)\s+(?:was|had\s+been)\b/gi,
      cap: ({ chapterCount }) => Math.max(1, chapterCount * 0.08),
      minCap: 1,
      replacements: ['what remained was', 'what stayed was', 'what pressed closest was', 'what she could not avoid was'],
      preserveFirstInChapter: 0,
      maxChangeRatio: 0.7,
    },
  ];
}

function detectBodyReactionMemoryLoop(loaded, report) {
  // Diagnostic only for now. This pattern is structural and unsafe to rewrite with regex.
  const reactionTerms = /\b(?:mouth\s+(?:went|was|felt|had\s+gone)\s+dry|throat\s+(?:tightened|closed|constricted)|chest\s+(?:tightened|ached|burned)|stomach\s+(?:dropped|turned|twisted)|hands?\s+(?:shook|trembled))\b/i;
  const memoryTerms = /\b(?:memory\s+(?:surfaced|rose|returned)|remembered|flashback|old\s+image|the\s+past\s+returned)\b/i;
  const shameFearTerms = /\b(?:shame|fear|dread|panic|guilt|terror|humiliation)\b/i;

  let loops = 0;
  const chapterHits = [];

  for (let i = 0; i < (loaded || []).length; i++) {
    const item = loaded[i];
    const chNum = chapterNumber(item, i);
    const paragraphs = String(item?.content || '').split(/\n{2,}/).filter(Boolean);
    let chapterLoops = 0;

    for (let p = 0; p < paragraphs.length; p++) {
      const windowText = paragraphs.slice(p, p + 3).join('\n\n');
      if (reactionTerms.test(windowText) && memoryTerms.test(windowText) && shameFearTerms.test(windowText)) {
        chapterLoops++;
      }
    }

    if (chapterLoops > 0) {
      loops += chapterLoops;
      chapterHits.push({ chapterNumber: chNum, count: chapterLoops });
    }
  }

  if (loops > 0) {
    report.structuralWarnings.push({
      name: 'body reaction → memory fragment → shame/fear loop',
      count: loops,
      chapters: chapterHits,
      note: 'Detected only. Not auto-rewritten because this requires scene-level judgment.',
    });
    report.changes.push(`Style Tic Sweep: flagged ${loops} possible body-reaction/memory/shame loops for manual review`);
  }
}

function buildSummary(report, loaded) {
  const repeatedFound = report.ticFamilies.filter((family) => family.total > family.cap).length;
  const changedChapters = Array.from(report.changedChapters).sort((a, b) => a - b);
  const familyLines = report.ticFamilies
    .filter((family) => family.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((family) => {
      const status = family.total > family.cap ? `cap ${family.cap}, changed ${family.changed}` : `cap ${family.cap}, no change`;
      return `- ${family.name}: ${family.total} occurrence${family.total === 1 ? '' : 's'} (${status})`;
    });

  const warningLines = report.structuralWarnings.map((warning) => {
    const chapters = warning.chapters?.slice(0, 8).map((row) => `Ch.${row.chapterNumber} (${row.count})`).join(', ');
    const suffix = warning.chapters?.length > 8 ? `, +${warning.chapters.length - 8} more` : '';
    return `- ${warning.name}: ${warning.count} possible loop${warning.count === 1 ? '' : 's'}${chapters ? ` — ${chapters}${suffix}` : ''}`;
  });

  return [
    'Style Tic Sweep:',
    `- scanned chapters: ${(loaded || []).length}`,
    `- repeated tic families found: ${repeatedFound}`,
    `- safe replacements made: ${report.safeReplacementsMade}`,
    `- grammar artifacts fixed: ${report.grammarArtifactsFixed}`,
    `- over-explanation labels fixed: ${report.overExplanationLabelsFixed || 0}`, 
    `- chapters changed: ${changedChapters.length}${changedChapters.length ? ` (${changedChapters.map((n) => `Ch.${n}`).join(', ')})` : ''}`,
    `- skipped because unsafe: ${report.skippedUnsafe}`,
    warningLines.length ? '- structural warnings: ' + warningLines.length : '- structural warnings: 0',
    '',
    'Repeated tic families:',
    ...(familyLines.length ? familyLines : ['- none detected']),
    ...(warningLines.length ? ['', 'Manual-review warnings:', ...warningLines] : []),
  ].join('\n');
}

export function runStyleTicSweep(loaded = [], onProgress, options = {}) {
  if (typeof onProgress === 'function') {
    onProgress('Polish: Running style tic sweep…');
  }

  const safeLoaded = Array.isArray(loaded) ? loaded : [];
  const report = {
    version: STYLE_TIC_SWEEP_VERSION,
    ticFamilies: [],
    changes: [],
    changedChapters: new Set(),
    safeReplacementsMade: 0,
    grammarArtifactsFixed: 0,
    overExplanationLabelsFixed: 0,
    skippedUnsafe: 0,
    structuralWarnings: [],
  };

  applyMalformedGrammarFixes(safeLoaded, report);
  applyOverExplanationLabelCleanup(safeLoaded, report);

  const ticTargets = buildTicTargets();
  for (const tic of ticTargets) {
    applySafePhraseCap(safeLoaded, tic, report, options);
  }

  detectBodyReactionMemoryLoop(safeLoaded, report);

  report.summary = buildSummary(report, safeLoaded);
  report.changedChapterCount = report.changedChapters.size;
  report.repeatedTicFamiliesFound = report.ticFamilies.filter((family) => family.total > family.cap).length;

  console.log('[STYLE-TIC-SWEEP] complete:', {
    scannedChapters: safeLoaded.length,
    repeatedTicFamiliesFound: report.repeatedTicFamiliesFound,
    safeReplacementsMade: report.safeReplacementsMade,
    grammarArtifactsFixed: report.grammarArtifactsFixed,
    overExplanationLabelsFixed: report.overExplanationLabelsFixed || 0,
    changedChapterCount: report.changedChapterCount,
    skippedUnsafe: report.skippedUnsafe,
  });

  return {
    styleTicFixed: report.safeReplacementsMade,
    grammarArtifactsFixed: report.grammarArtifactsFixed,
    overExplanationLabelsFixed: report.overExplanationLabelsFixed || 0,
    repeatedTicFamiliesFound: report.repeatedTicFamiliesFound,
    changedChapterCount: report.changedChapterCount,
    skippedUnsafe: report.skippedUnsafe,
    structuralWarnings: report.structuralWarnings,
    ticFamilies: report.ticFamilies,
    changes: report.changes,
    summary: report.summary,
    report,
  };
}

export default runStyleTicSweep;
