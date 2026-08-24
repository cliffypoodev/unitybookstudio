/**
 * External AI pattern detection — catches patterns from Sudowrite, ChatGPT, Jasper, NovelAI, etc.
 * Shared between fiction and nonfiction polish pipelines.
 */

export function getExternalAiPatterns(chapterCount) {
  // SUDOWRITE-SPECIFIC: recursive philosophical constructions
  const sudowritePatterns = [
    { pattern: /\brather than merely\b/gi, name: 'rather than merely', maxTotal: Math.max(3, Math.round(chapterCount * 0.15)) },
    { pattern: /\bnot merely\b/gi, name: 'not merely', maxTotal: Math.max(5, Math.round(chapterCount * 0.25)) },
    { pattern: /\bnot simply\b/gi, name: 'not simply', maxTotal: Math.max(5, Math.round(chapterCount * 0.25)) },
    { pattern: /\bcreates perfect\b/gi, name: 'creates perfect', maxTotal: Math.max(2, Math.round(chapterCount * 0.1)) },
    { pattern: /\bmanifests with\b/gi, name: 'manifests with', maxTotal: Math.max(2, Math.round(chapterCount * 0.1)) },
    { pattern: /\bregisters with\b/gi, name: 'registers with', maxTotal: Math.max(3, Math.round(chapterCount * 0.15)) },
    { pattern: /\bwith mathematical precision\b/gi, name: 'with mathematical precision', maxTotal: Math.max(2, Math.round(chapterCount * 0.1)) },
    { pattern: /\bwith algorithmic precision\b/gi, name: 'with algorithmic precision', maxTotal: 1 },
    { pattern: /\bwith mechanical precision\b/gi, name: 'with mechanical precision', maxTotal: 1 },
    { pattern: /\bwith philosophical precision\b/gi, name: 'with philosophical precision', maxTotal: 0 },
    { pattern: /\bwith dialectical precision\b/gi, name: 'with dialectical precision', maxTotal: 0 },
    { pattern: /\bprocessing error\b/gi, name: 'processing error', maxTotal: Math.max(5, Math.round(chapterCount * 0.25)) },
  ];

  // CHATGPT-SPECIFIC: hedging and filler constructions
  const chatgptPatterns = [
    { pattern: /\bIt'?s worth noting that\b/gi, name: "it's worth noting that", maxTotal: 2 },
    { pattern: /\bIt'?s important to note\b/gi, name: "it's important to note", maxTotal: 2 },
    { pattern: /\bIt bears mentioning\b/gi, name: 'it bears mentioning', maxTotal: 1 },
    { pattern: /\bIn the realm of\b/gi, name: 'in the realm of', maxTotal: 2 },
    { pattern: /\bdelve into\b/gi, name: 'delve into', maxTotal: 2 },
    { pattern: /\bdelved into\b/gi, name: 'delved into', maxTotal: 1 },
    { pattern: /\ba testament to\b/gi, name: 'a testament to', maxTotal: Math.max(2, Math.round(chapterCount * 0.1)) },
    { pattern: /\bserves as a\b/gi, name: 'serves as a', maxTotal: Math.max(5, Math.round(chapterCount * 0.25)) },
    { pattern: /\ba sense of\b/gi, name: 'a sense of', maxTotal: Math.max(8, Math.round(chapterCount * 0.4)) },
    { pattern: /\bthe world around\b/gi, name: 'the world around', maxTotal: Math.max(4, Math.round(chapterCount * 0.2)) },
    { pattern: /\bcouldn'?t help but\b/gi, name: "couldn't help but", maxTotal: 2 },
    { pattern: /\ba mix of\b/gi, name: 'a mix of', maxTotal: Math.max(3, Math.round(chapterCount * 0.15)) },
    { pattern: /\bwashed over\b/gi, name: 'washed over', maxTotal: Math.max(3, Math.round(chapterCount * 0.15)) },
    { pattern: /\bin that moment\b/gi, name: 'in that moment', maxTotal: 2 },
    { pattern: /\bsomething shifted\b/gi, name: 'something shifted', maxTotal: 2 },
    { pattern: /\ba flicker of\b/gi, name: 'a flicker of', maxTotal: Math.max(3, Math.round(chapterCount * 0.15)) },
    { pattern: /\bsent a shiver\b/gi, name: 'sent a shiver', maxTotal: 2 },
    { pattern: /\bhung in the air\b/gi, name: 'hung in the air', maxTotal: Math.max(3, Math.round(chapterCount * 0.15)) },
    { pattern: /\bnot just\b/gi, name: 'not just', maxTotal: 3 },
    { pattern: /\bmore than just\b/gi, name: 'more than just', maxTotal: 1 },
    { pattern: /\bthe emotional architecture\b/gi, name: 'the emotional architecture', maxTotal: 0 },
    { pattern: /\bthe collective memory\b/gi, name: 'the collective memory', maxTotal: 1 },
  ];

  return [...sudowritePatterns, ...chatgptPatterns];
}

/**
 * Run external AI pattern detection and removal on loaded chapter data.
 * Mutates loaded[].content in place. Returns { fixed, changes, sceneHeadersStripped }.
 */
export function runExternalAiPatternFix(loaded) {
  const chapterCount = loaded.length;
  const allPatterns = getExternalAiPatterns(chapterCount);
  const changes = [];
  // POLISHSAFE-4: phrase deletion retired — outside rule 0.2/2's whitelist.
  // Flag-only; loaded[].content is never mutated by this loop.
  const fixed = 0;

  for (const t of allPatterns) {
    const allTextNow = loaded.map(f => f.content).join('\n\n');
    const total = (allTextNow.match(t.pattern) || []).length;
    const cap = Math.round(t.maxTotal);

    if (total <= cap) continue;

    const excess = total - cap;
    console.log('[POLISH] External AI pattern "' + t.name + '": ' + total + ' (cap: ' + cap + ', flagging ' + excess + ')');
    changes.push(excess + 'x "' + t.name + '" flagged (external AI pattern) - deletion retired (POLISHSAFE-4)');
  }

  // Strip Sudowrite scene headers
  let sceneHeadersStripped = 0;
  for (const f of loaded) {
    const headers = f.content.match(/^#\s*Scene\s*\d+/gm);
    if (headers && headers.length > 0) {
      f.content = f.content.replace(/^#\s*Scene\s*\d+\s*/gm, '');
      sceneHeadersStripped += headers.length;
    }
  }
  if (sceneHeadersStripped > 0) {
    changes.push('Stripped ' + sceneHeadersStripped + ' Sudowrite scene headers');
  }

  if (fixed > 0) {
    changes.push('Total external AI patterns fixed: ' + fixed);
    console.log('[POLISH] External AI patterns fixed:', fixed);
  }

  return { fixed, changes, sceneHeadersStripped };
}