const BANNED_WORDS = [
  'shimmering','luminous','tapestry','intricate','meticulously',
  'insatiable','palpable','unmistakable','undeniable','relentless','sprawling',
  'labyrinthine','opulent','resplendent','ethereal','visceral','cacophony',
  'crescendo','juxtaposition','myriad','plethora','testament','harbinger',
  'paradigm','dichotomy','multifaceted','aforementioned','henceforth',
  'commence','utilize','endeavor','pertaining',
];

export default function analyzeChapter(text) {
  if (!text) return { issues: [], issueCount: 0, wordCount: 0 };
  const issues = [];

  // Banned words
  for (const word of BANNED_WORDS) {
    const rx = new RegExp('\\b' + word + '\\b', 'gi');
    const matches = text.match(rx);
    if (matches && matches.length > 0) {
      issues.push({
        type: 'banned_word', severity: 'high',
        description: `"${word}" found (${matches.length}x)`,
        example: word, count: matches.length,
      });
    }
  }

  // Voice patterns
  const voiceMatches = text.match(/\b(his|her) voice was\b/gi);
  if (voiceMatches && voiceMatches.length > 2) {
    issues.push({
      type: 'voice_pattern', severity: 'medium',
      description: `"his/her voice was" appears ${voiceMatches.length}x (max 2 recommended)`,
      example: voiceMatches[0], count: voiceMatches.length,
    });
  }

  // Repetition checks
  const repetitionChecks = [
    { pattern: /\bshuddered\b/gi, label: 'shuddered' },
    { pattern: /\bthe silence\b/gi, label: 'the silence' },
    { pattern: /\bsuddenly\b/gi, label: 'suddenly' },
  ];
  for (const { pattern, label } of repetitionChecks) {
    const m = text.match(pattern);
    if (m && m.length > 2) {
      issues.push({
        type: 'repetition', severity: 'medium',
        description: `"${label}" appears ${m.length}x (max 2 recommended)`,
        example: label, count: m.length,
      });
    }
  }

  // Capitalization errors (EXCLUDE ellipses + abbreviations — see manuscriptStats.js
  // for the same pattern. The naive regex counts every "..." as a broken
  // sentence, which pollutes per-chapter issue panels with false positives).
  const capRx = /[.!?]\s+[a-z]/g;
  let capCount = 0;
  let firstCapExample = '';
  let capMatch;
  while ((capMatch = capRx.exec(text)) !== null) {
    const offset = capMatch.index;
    if (offset >= 1 && text[offset - 1] === '.') continue; // ellipsis
    if (offset >= 2 && /[A-Z][a-z]/.test(text.substring(offset - 2, offset))) continue; // abbreviation
    capCount++;
    if (!firstCapExample) firstCapExample = capMatch[0].trim();
  }
  if (capCount > 0) {
    issues.push({
      type: 'capitalization', severity: 'medium',
      description: `${capCount} capitalization error${capCount > 1 ? 's' : ''}`,
      example: firstCapExample, count: capCount,
    });
  }

  // AI scaffold leaks — anchored to paragraph/sentence starts to avoid
  // false positives on dialogue containing phrases like "here is the".
  const scaffoldRx = /(?:^|\n\n|\n|[.!?]\s+)(This chapter will|I've written|Here is the|Let me know if|As an AI)\b/gi;
  const scaffolds = text.match(scaffoldRx);
  if (scaffolds && scaffolds.length > 0) {
    issues.push({
      type: 'scaffold', severity: 'high',
      description: `${scaffolds.length} AI scaffold leak${scaffolds.length > 1 ? 's' : ''}`,
      example: scaffolds[0].trim(), count: scaffolds.length,
    });
  }

  // Unclosed quotation marks (smart + straight)
  const paragraphs = text.split(/\n\n+/);
  let unclosedQuotes = 0;
  for (const para of paragraphs) {
    // Check straight quotes
    const straightCount = (para.match(/"/g) || []).length;
    if (straightCount % 2 !== 0) unclosedQuotes++;
    // Check smart quotes (\u201c = \u201c, \u201d = \u201d)
    const smartOpenCount = (para.match(/\u201c/g) || []).length;
    const smartCloseCount = (para.match(/\u201d/g) || []).length;
    if (smartOpenCount !== smartCloseCount) unclosedQuotes += Math.abs(smartOpenCount - smartCloseCount);
  }
  if (unclosedQuotes > 0) {
    issues.push({
      type: 'grammar', severity: 'medium',
      description: `${unclosedQuotes} unclosed quotation mark${unclosedQuotes > 1 ? 's' : ''} (smart + straight)`,
      example: 'unclosed \u201c', count: unclosedQuotes,
    });
  }

  // Sentence fragments ending with conjunction
  const fragments = text.match(/\b(and|but|or)\.\s+[A-Z]/g);
  if (fragments && fragments.length > 0) {
    issues.push({
      type: 'grammar', severity: 'high',
      description: `${fragments.length} sentence fragment${fragments.length > 1 ? 's' : ''} (ends with conjunction)`,
      example: fragments[0].substring(0, 10), count: fragments.length,
    });
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    issues,
    issueCount: issues.reduce((s, i) => s + i.count, 0),
    wordCount,
  };
}