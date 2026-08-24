/**
 * ChatGPT vocabulary contamination caps + "This is not / It is not" pattern reducer.
 * Applies to ALL project types (vocab caps) and NONFICTION only (dichotomy pattern).
 */

/**
 * ChatGPT vocabulary caps — words that leak from ChatGPT source manuscripts.
 * Caps are per 100K words. For shorter manuscripts, minimum 1 allowed.
 */
const CHATGPT_VOCAB = [
  { word: 'crucial', maxPer100K: 4, replacements: ['critical', 'essential', 'important', 'necessary', 'key', 'vital'] },
  { word: 'landscape', maxPer100K: 3, metaphoricalOnly: true, replacements: ['field', 'terrain', 'environment', 'world', 'space'] },
  { word: 'navigate', maxPer100K: 3, metaphoricalOnly: true, replacements: ['manage', 'handle', 'work through', 'move through'] },
  { word: 'realm', maxPer100K: 2, replacements: ['area', 'domain', 'space', 'world'] },
  { word: 'underscores', maxPer100K: 1, replacements: ['highlights', 'emphasizes', 'reveals', 'demonstrates'] },
  { word: 'pivotal', maxPer100K: 2, replacements: ['critical', 'decisive', 'key', 'turning-point'] },
  { word: 'profound', maxPer100K: 3, replacements: ['deep', 'significant', 'serious', 'intense'] },
];

// Literal geography/movement context indicators — skip replacement if nearby
const LITERAL_CONTEXT = /\b(map|terrain|road|path|trail|hike|drive|sail|ship|boat|river|mountain|valley|forest|desert|ocean|sea|lake|street|city|town|village|country|region|continent|highway|freeway|walk|run|swim|fly|steer|pilot)\b/i;

function isLiteralUsage(text, matchIndex, word) {
  const windowStart = Math.max(0, matchIndex - 80);
  const windowEnd = Math.min(text.length, matchIndex + word.length + 80);
  const window = text.substring(windowStart, windowEnd);
  return LITERAL_CONTEXT.test(window);
}

/**
 * POLISHSAFE-4: scan ChatGPT vocabulary across loaded chapters and FLAG
 * excess occurrences — never substitute. loaded[].content is never mutated.
 * @returns {{ chatgptVocabFixed: 0, changes: string[] }}
 */
export function runChatGPTVocabCaps(loaded, onProgress) {
  onProgress?.('Polish: Scanning ChatGPT vocabulary…');
  const changes = [];
  const chatgptVocabFixed = 0;

  const fullText = loaded.map(f => f.content).join('\n\n');
  const totalWords = fullText.split(/\s+/).filter(Boolean).length;

  for (const entry of CHATGPT_VOCAB) {
    const maxAllowed = Math.max(1, Math.round(entry.maxPer100K * totalWords / 100000));
    let count = 0;
    for (const f of loaded) {
      const chRegex = new RegExp('\\b' + entry.word + '(?:s|d|ing)?\\b', 'gi');
      let m;
      while ((m = chRegex.exec(f.content)) !== null) {
        if (entry.metaphoricalOnly && isLiteralUsage(f.content, m.index, m[0])) continue;
        count++;
      }
    }
    if (count <= maxAllowed) continue;

    const excess = count - maxAllowed;
    changes.push('"' + entry.word + '": ' + count + ' found, ' + maxAllowed + ' allowed, ' + excess + ' flagged - substitution retired (POLISHSAFE-4)');
  }

  return { chatgptVocabFixed, changes };
}

/**
 * "This is not X. It is Y." dichotomy pattern reducer — NONFICTION ONLY.
 * Caps combined "This is not" + "It is not" + "That is not" to 10 max per manuscript.
 * Restructures excess by merging the two clauses.
 * @returns {{ dichotomyFixed: number, changes: string[] }}
 */
export function runDichotomyPatternReducer(loaded, onProgress) {
  onProgress?.('Polish (NF): Scanning dichotomy patterns…');
  const changes = [];
  const dichotomyFixed = 0;

  const dichotomyRegex = /\b(This|It|That) is not\b/gi;
  const fullText = loaded.map(f => f.content).join('\n\n');
  const allMatches = fullText.match(dichotomyRegex);
  const totalCount = allMatches ? allMatches.length : 0;
  const MAX_ALLOWED = 10;

  if (totalCount > MAX_ALLOWED) {
    changes.push('"This/It/That is not" pattern: ' + totalCount + ' found, ' + MAX_ALLOWED + ' allowed, ' + (totalCount - MAX_ALLOWED) + ' flagged - restructuring retired (POLISHSAFE-4)');
  }

  return { dichotomyFixed, changes };
}

/* =============================================================================
 * TRANSITION-WORD CAPS
 * ==========================================================================
 * Sentence-starting transition words ("Still,", "Instead,", "At last,",
 * "Suddenly,", "Finally,") are AI-detection red flags when repeated every
 * few paragraphs. This is a hallmark AI tell in memoir and investigative
 * nonfiction (the Afterlight manuscript scored 65/100 narrative voice largely
 * because of this). Cap each transition word at ~3 uses per chapter, replace
 * excess with varied rephrasings or bare sentence structure.
 * ========================================================================== */

// DELETE-ONLY replacements. Previously each entry had alternative transition
// phrases like "Even so,", "Rather than that,", "Actually,", "Naturally," etc.
// Those replacements just traded one AI-detectable crutch for another, creating
// the exact fingerprint Gemini flags. Now excess transitions are STRIPPED and
// the sentence starts clean with the next word (capitalized by the post-pass).
const TRANSITION_WORDS = [
  {
    word: 'Still',
    regex: /(^|\n|\. +|\! +|\? +|" +)Still,\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
  {
    word: 'Instead',
    regex: /(^|\n|\. +|\! +|\? +|" +)Instead,\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
  {
    word: 'At last',
    regex: /(^|\n|\. +|\! +|\? +|" +)At last,?\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
  {
    word: 'Suddenly',
    regex: /(^|\n|\. +|\! +|\? +|" +)Suddenly,?\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
  {
    word: 'Finally',
    regex: /(^|\n|\. +|\! +|\? +|" +)Finally,\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
  {
    word: 'Then',
    regex: /(^|\n|\. +|\! +|\? +|" +)Then,\s+/g,
    perChapterCap: 2,
    replacements: [''],
  },
  {
    word: 'Meanwhile',
    regex: /(^|\n|\. +|\! +|\? +|" +)Meanwhile,?\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
  {
    word: 'Eventually',
    regex: /(^|\n|\. +|\! +|\? +|" +)Eventually,?\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
  {
    word: 'In truth',
    regex: /(^|\n|\. +|\! +|\? +|" +)In truth,\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
  {
    word: 'In fact',
    regex: /(^|\n|\. +|\! +|\? +|" +)In fact,\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
  {
    word: 'Of course',
    regex: /(^|\n|\. +|\! +|\? +|" +)Of course,\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
  {
    word: 'In the end',
    regex: /(^|\n|\. +|\! +|\? +|" +)In the end,?\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
  {
    word: 'By then',
    regex: /(^|\n|\. +|\! +|\? +|" +)By then,?\s+/g,
    perChapterCap: 1,
    replacements: [''],
  },
];

/**
 * Run transition-word caps. Mutates loaded[].content in place.
 * Caps are PER CHAPTER, not global — because transition overuse stands out
 * inside a single chapter's rhythm, not across a whole book.
 *
 * @returns {{ transitionWordsFixed: number, changes: string[] }}
 */
/**
 * POLISHSAFE-4: scan transition-word repetition and FLAG excess occurrences
 * — never delete. loaded[].content is never mutated.
 * @returns {{ transitionWordsFixed: 0, changes: string[] }}
 */
export function runTransitionWordCaps(loaded, onProgress) {
  onProgress?.('Polish: Scanning transition-word repetition…');
  const changes = [];
  const transitionWordsFixed = 0;

  // Same cap-sizing logic as before: global ceiling scaled by chapter count,
  // on top of the per-chapter ceiling. Detection only now.
  const chapterCount = loaded.length || 1;
  const globalScaleFactor = Math.max(1, chapterCount / 25);

  for (const entry of TRANSITION_WORDS) {
    const globalCap = entry.word === 'Then'
      ? Math.round(5 * globalScaleFactor)
      : Math.round(3 * globalScaleFactor);
    let globalCount = 0;

    for (const f of loaded) {
      const chRegex = new RegExp(entry.regex.source, entry.regex.flags);
      const matches = [...f.content.matchAll(chRegex)];
      if (matches.length === 0) continue;

      let kept = 0;
      let excessHere = 0;
      for (const _m of matches) {
        kept++;
        const belowPerChapterCap = kept <= entry.perChapterCap;
        const belowGlobalCap = globalCount < globalCap;
        if (belowPerChapterCap && belowGlobalCap) { globalCount++; continue; }
        excessHere++;
      }

      if (excessHere > 0) {
        changes.push(
          'Ch.' + (f.chapter?.chapter_number || '?') + ': "' + entry.word +
          ',"  ' + matches.length + ' found, ' + excessHere +
          ' flagged (cap ' + entry.perChapterCap + '/chapter, ' + globalCap + ' global) - deletion retired (POLISHSAFE-4)'
        );
      }
    }

    if (globalCount > 0) {
      changes.push('"' + entry.word + '" global count under cap: ' + globalCount + '/' + globalCap);
    }
  }

  return { transitionWordsFixed, changes };
}

/**
 * "Not just X, but Y" pattern reducer.
 * The #1 LLM rhetorical crutch — appears 15-20x per manuscript when AI
 * generates long-form nonfiction or fiction. Human writers use it 1-3x
 * across a full book. AI detectors (Turnitin, GPTZero) specifically flag it.
 *
 * Fix strategy: convert excess "not just X, but Y" to "not only X but Y"
 * (dropping the comma changes rhythm enough to break the pattern) or
 * restructure to "X — and Y" or just "X and Y".
 *
 * Global cap: 3 per manuscript. Per-chapter cap: 1.
 *
 * @returns {{ notJustButFixed: number, changes: string[] }}
 */
export function runNotJustButReducer(loaded, onProgress) {
  onProgress?.('Polish: Scanning "not just X, but Y" pattern…');
  const changes = [];
  const notJustButFixed = 0;

  const fullText = loaded.map(f => f.content).join('\n\n');
  const totalMatches = (fullText.match(/\bnot just\s+.{3,50},?\s+but\b/gi) || []).length;

  if (totalMatches > 3) {
    changes.push('"not just X, but Y": ' + totalMatches + ' found, 3 allowed, ' + (totalMatches - 3) + ' flagged - restructuring retired (POLISHSAFE-4)');
  }

  return { notJustButFixed, changes };
}

/**
 * "Yet" misuse fixer.
 * The LLM uses "yet" as a list connector meaning "and/including/such as"
 * when it should only be used as "however/but". Pattern: ", yet [noun/gerund]"
 * where the word after "yet" is NOT a pronoun or subject.
 *
 * Fix: replace ", yet " with ". " and capitalize the next word, turning
 * the fragment into a proper sentence.
 *
 * Known Lumimaid/DeepSeek quirk that also appears in nonfiction.
 *
 * @returns {{ yetMisuseFixed: number, changes: string[] }}
 */
export function runYetMisuseFixer(loaded, onProgress) {
  onProgress?.('Polish: Scanning "yet" misuse…');
  const changes = [];
  const yetMisuseFixed = 0;

  const SUBJECT_WORDS = new Set([
    'he','she','it','they','we','you','i','the','a','an','this','that','these',
    'those','his','her','its','their','my','our','your','one','there','here',
    'what','who','which','when','where','how','no','not','none','nobody',
    'nothing','never','neither','nor','every','each','all','both','few',
    'many','some','any','most','several',
  ]);

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    let chFlagged = 0;

    for (const m of f.content.matchAll(/,\s+yet\s+([a-z]\w*)/gi)) {
      if (SUBJECT_WORDS.has(m[1].toLowerCase())) continue; // legitimate usage
      chFlagged++;
    }

    if (chFlagged > 0) {
      changes.push('Ch.' + chNum + ': ' + chFlagged + 'x "yet" misuse flagged - rewrite retired (POLISHSAFE-4)');
    }
  }

  return { yetMisuseFixed, changes };
}

/**
 * "Think of it as" capper.
 * AI-favorite pedagogical phrase. Human writers use it 0-2x per book.
 * AI uses it 5-10x. Global cap: 2. Excess instances restructured to
 * "Consider it" or "Imagine it as" or just deleted.
 *
 * @returns {{ thinkOfItFixed: number, changes: string[] }}
 */
export function runThinkOfItAsCapper(loaded, onProgress) {
  onProgress?.('Polish: Scanning "Think of it as"…');
  const changes = [];
  const thinkOfItFixed = 0;

  const fullText = loaded.map(f => f.content).join('\n\n');
  const totalMatches = (fullText.match(/\b[Tt]hink of it as\b/g) || []).length;
  if (totalMatches > 2) {
    changes.push('"Think of it as": ' + totalMatches + ' found, 2 allowed, ' + (totalMatches - 2) + ' flagged - substitution retired (POLISHSAFE-4)');
  }

  return { thinkOfItFixed, changes };
}

/**
 * General AI phrase capper.
 * Caps high-frequency AI-favorite phrases that appear in both fiction and
 * nonfiction. Each phrase has a manuscript-wide cap. Excess instances are
 * DELETED (the phrase is removed and the surrounding text is joined).
 *
 * These are phrases that human writers use 1-3x per book but AI uses 5-15x.
 * The caps are generous — they only fire on clear overuse.
 *
 * @returns {{ aiPhrasesFixed: number, changes: string[] }}
 */
export function runAiPhraseCapper(loaded, onProgress) {
  onProgress?.('Polish: Scanning AI-favorite phrases…');
  const changes = [];
  const aiPhrasesFixed = 0;

  const PHRASE_CAPS = [
    { phrase: 'the weight of', rx: /\bthe weight of\b/gi, cap: 3 },
    { phrase: 'the air was', rx: /\bthe air (?:was|grew|felt|hung)\b/gi, cap: 2 },
    { phrase: 'a wave of', rx: /\ba wave of\b/gi, cap: 2 },
    { phrase: 'something shifted', rx: /\bsomething (?:shifted|changed|broke|clicked|snapped)\b/gi, cap: 1 },
    { phrase: 'eyes widened', rx: /\beyes widened\b/gi, cap: 1 },
    { phrase: 'washed over', rx: /\bwashed over\b/gi, cap: 2 },
    { phrase: 'in that moment', rx: /\bin that moment\b/gi, cap: 1 },
    { phrase: 'a knowing smile', rx: /\ba knowing (?:smile|look|nod|glance)\b/gi, cap: 1 },
    { phrase: 'sent X through', rx: /\bsent (?:a )?(?:jolt|shiver|chill|wave|surge|bolt) (?:through|down|up)\b/gi, cap: 0 },
    { phrase: 'threatened to overwhelm', rx: /\bthreatened to (?:overwhelm|consume|drown|engulf)\b/gi, cap: 0 },
  ];

  const fullText = loaded.map(f => f.content).join('\n\n');
  for (const entry of PHRASE_CAPS) {
    const allMatches = fullText.match(entry.rx);
    const total = allMatches ? allMatches.length : 0;
    if (total > entry.cap) {
      changes.push('"' + entry.phrase + '": ' + total + ' found, ' + entry.cap + ' allowed, ' + (total - entry.cap) + ' flagged - deletion retired (POLISHSAFE-4)');
    }
  }

  return { aiPhrasesFixed, changes };
}