/**
 * ChatGPT vocabulary contamination caps + "This is not / It is not" pattern reducer.
 * Applies to ALL project types (vocab caps) and NONFICTION only (dichotomy pattern).
 */

import { safeUppercaseReplace } from './safeUppercase.js';

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
 * Run ChatGPT vocabulary caps across loaded chapters.
 * Mutates loaded[].content in place.
 * @returns {{ chatgptVocabFixed: number, changes: string[] }}
 */
export function runChatGPTVocabCaps(loaded, onProgress) {
  onProgress?.('Polish: Capping ChatGPT vocabulary…');
  const changes = [];
  let chatgptVocabFixed = 0;

  const fullText = loaded.map(f => f.content).join('\n\n');
  const totalWords = fullText.split(/\s+/).filter(Boolean).length;

  for (const entry of CHATGPT_VOCAB) {
    const regex = new RegExp('\\b' + entry.word + '(?:s|d|ing)?\\b', 'gi');
    const currentText = loaded.map(f => f.content).join('\n\n');
    const allMatches = [...currentText.matchAll(regex)];
    if (!allMatches.length) continue;

    const maxAllowed = Math.max(1, Math.round(entry.maxPer100K * totalWords / 100000));
    const count = allMatches.length;

    if (count <= maxAllowed) continue;

    const excess = count - maxAllowed;
    let removed = 0;
    let globalCount = 0;

    for (const f of loaded) {
      if (removed >= excess) break;
      const chRegex = new RegExp('\\b' + entry.word + '(?:s|d|ing)?\\b', 'gi');
      let lastIndex = 0;
      let result = '';
      let match;

      // Manual iteration to track index for literal context checking
      const tempRegex = new RegExp('\\b' + entry.word + '(?:s|d|ing)?\\b', 'gi');
      while ((match = tempRegex.exec(f.content)) !== null) {
        globalCount++;
        if (globalCount <= maxAllowed || removed >= excess) {
          continue;
        }

        // Skip literal usage for metaphorical-only words
        if (entry.metaphoricalOnly && isLiteralUsage(f.content, match.index, match[0])) {
          continue;
        }

        removed++;
        chatgptVocabFixed++;
      }

      // Now do the actual replacement pass
      if (removed > 0 || globalCount > maxAllowed) {
        let instanceInChapter = 0;
        let globalForReplace = 0;
        // Reset global count for replacement pass
        const beforeChapters = loaded.slice(0, loaded.indexOf(f));
        for (const bc of beforeChapters) {
          const bcMatches = bc.content.match(new RegExp('\\b' + entry.word + '(?:s|d|ing)?\\b', 'gi'));
          globalForReplace += bcMatches ? bcMatches.length : 0;
        }

        f.content = f.content.replace(chRegex, (m, offset) => {
          globalForReplace++;
          if (globalForReplace <= maxAllowed) return m;

          if (entry.metaphoricalOnly && isLiteralUsage(f.content, offset, m)) {
            return m;
          }

          const alt = entry.replacements[instanceInChapter % entry.replacements.length];
          instanceInChapter++;
          if (m.charAt(0) === m.charAt(0).toUpperCase()) {
            return alt.charAt(0).toUpperCase() + alt.slice(1);
          }
          return alt;
        });
      }
    }

    // Recount actual replacements
    const afterText = loaded.map(f => f.content).join('\n\n');
    const afterCount = (afterText.match(regex) || []).length;
    const actualRemoved = count - afterCount;

    if (actualRemoved > 0) {
      changes.push('"' + entry.word + '": ' + count + ' → ' + afterCount + ' (' + actualRemoved + ' replaced, cap ' + maxAllowed + ')');
    }
  }

  if (chatgptVocabFixed > 0) {
    changes.push('Total ChatGPT vocabulary capped: ' + chatgptVocabFixed + ' replacements');
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
  onProgress?.('Polish (NF): Reducing dichotomy patterns…');
  const changes = [];
  let dichotomyFixed = 0;

  // Count total instances across manuscript
  const dichotomyRegex = /\b(This|It|That) is not\b/gi;
  const fullText = loaded.map(f => f.content).join('\n\n');
  const allMatches = fullText.match(dichotomyRegex);
  const totalCount = allMatches ? allMatches.length : 0;
  const MAX_ALLOWED = 10;

  if (totalCount <= MAX_ALLOWED) {
    return { dichotomyFixed: 0, changes: [] };
  }

  const excess = totalCount - MAX_ALLOWED;
  let globalCount = 0;
  let removed = 0;

  // Pattern: "This is not X. It is Y." → "Y, not X." or "The response is Y, not X."
  const fullDichotomyPattern = /\b(This|It|That) is not ([^.!?]+)[.!?]\s*(It|This|That) is ([^.!?]+)[.!?]/gi;

  for (const f of loaded) {
    if (removed >= excess) break;

    f.content = f.content.replace(fullDichotomyPattern, (match, subj1, negPart, subj2, posPart) => {
      globalCount++;
      if (globalCount <= MAX_ALLOWED || removed >= excess) return match;

      removed++;
      dichotomyFixed++;

      // Restructure: merge into one sentence
      const neg = negPart.trim().replace(/[,;]$/, '');
      const pos = posPart.trim().replace(/[,;]$/, '');

      // "This is not failure. It is information." → "It is information, not failure."
      return pos.charAt(0).toUpperCase() + pos.slice(1) + ', not ' + neg + '.';
    });
  }

  // Also handle standalone "This is not" that aren't part of the paired pattern
  if (removed < excess) {
    const standaloneRegex = /\b(This|It|That) is not\b/gi;
    let standaloneGlobal = 0;

    for (const f of loaded) {
      if (removed >= excess) break;

      f.content = f.content.replace(standaloneRegex, (match, subj) => {
        standaloneGlobal++;
        if (standaloneGlobal <= MAX_ALLOWED || removed >= excess) return match;

        removed++;
        dichotomyFixed++;

        // Simple restructure: "This is not" → "It isn't" or just rephrase
        const alts = ["It isn't", "That isn't", "This isn't"];
        return alts[removed % alts.length];
      });
    }
  }

  if (dichotomyFixed > 0) {
    changes.push('"This/It/That is not" pattern: ' + totalCount + ' → ' + (totalCount - dichotomyFixed) + ' (' + dichotomyFixed + ' restructured, max ' + MAX_ALLOWED + ')');
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
export function runTransitionWordCaps(loaded, onProgress) {
  onProgress?.('Polish: Capping transition-word repetition…');
  const changes = [];
  let transitionWordsFixed = 0;

  // GLOBAL CAP per transition word — applied on top of per-chapter cap.
  // The per-chapter cap of 1 alone is not enough for manuscripts with
  // many chapters: "Instead" can still appear 25 times in a 25-chapter
  // book (once per chapter). This is still an AI-detection red flag.
  //
  // Gemini's target is to delete ~70% of introductory transitions to make
  // prose feel organic. With a 3-5 total cap per word across a typical
  // 25-chapter manuscript, we hit that reduction target.
  //
  // Scale-aware: for longer manuscripts, allow slightly more; shorter
  // manuscripts get a harder cap. Base is 3 per word, scaled by chapter count.
  const chapterCount = loaded.length || 1;
  const globalScaleFactor = Math.max(1, chapterCount / 25);

  // ── GLOBAL per-transition-word cap loop ──
  const chaptersWithRemovals = new Set();

  for (const entry of TRANSITION_WORDS) {
    // Global ceiling: base 3, scaled modestly by manuscript length. "Then"
    // gets a higher ceiling (5) because it's more commonly used organically.
    const globalCap = entry.word === 'Then'
      ? Math.round(5 * globalScaleFactor)
      : Math.round(3 * globalScaleFactor);
    let globalCount = 0;

    for (const f of loaded) {
      const chRegex = new RegExp(entry.regex.source, entry.regex.flags);
      const matches = [...f.content.matchAll(chRegex)];

      if (matches.length === 0) continue;

      // Per-chapter ceiling — caps per-chapter first, then global cap takes over
      let kept = 0;
      let removed = 0;
      let replacementIdx = 0;

      f.content = f.content.replace(chRegex, (match, prefix) => {
        // Check BOTH caps: per-chapter AND global
        kept++;
        const belowPerChapterCap = kept <= entry.perChapterCap;
        const belowGlobalCap = globalCount < globalCap;

        if (belowPerChapterCap && belowGlobalCap) {
          globalCount++;
          return match; // keep it
        }

        // Either cap is exceeded → remove
        removed++;
        transitionWordsFixed++;
        const replacement = entry.replacements[replacementIdx % entry.replacements.length];
        replacementIdx++;

        return prefix + replacement;
      });

      if (removed > 0) {
        chaptersWithRemovals.add(f);
        changes.push(
          'Ch.' + (f.chapter?.chapter_number || '?') + ': "' + entry.word +
          ',"  capped (' + matches.length + ' → ' + (matches.length - removed) +
          ', replaced ' + removed + ')'
        );
      }
    }

    if (globalCount > 0) {
      changes.push('"' + entry.word + '" global count after caps: ' + globalCount + '/' + globalCap);
    }
  }

  // Second pass: fix any lowercase letters that are now at start of sentence
  // because we stripped a capitalized "Still, "/"Instead, " etc.
  // ONLY run on chapters where this function actually removed transitions,
  // and use the shared guard to protect abbreviations (e.g., i.e., a.m., etc.)
  for (const f of chaptersWithRemovals) {
    f.content = safeUppercaseReplace(f.content);
  }

  if (transitionWordsFixed > 0) {
    console.log('[POLISH] Transition words capped:', transitionWordsFixed);
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
  onProgress?.('Polish: Reducing "not just X, but Y" pattern…');
  const changes = [];
  let notJustButFixed = 0;

  // Count total across manuscript
  const fullText = loaded.map(f => f.content).join('\n\n');
  const totalMatches = (fullText.match(/\bnot just\s+.{3,50},?\s+but\b/gi) || []).length;

  if (totalMatches <= 3) {
    // Under global cap — leave alone
    return { notJustButFixed: 0, changes: [] };
  }

  const globalCap = 3;
  let globalCount = 0;

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    const rx = /\bnot just\s+(.{3,50}?),?\s+but\b/gi;
    let chapterCount = 0;
    let chapterFixed = 0;

    f.content = f.content.replace(rx, (match, middle) => {
      chapterCount++;

      // Keep first per chapter AND stay under global cap
      if (chapterCount <= 1 && globalCount < globalCap) {
        globalCount++;
        return match;
      }

      // Over cap — restructure to break the pattern
      // "not just X, but" → "not only X but" (subtle rhythm change)
      chapterFixed++;
      notJustButFixed++;
      return match
        .replace(/\bnot just\b/i, 'not only')
        .replace(/,\s+but\b/, ' but');
    });

    if (chapterFixed > 0) {
      changes.push('Ch.' + chNum + ': restructured ' + chapterFixed + 'x "not just X, but Y" → "not only X but Y"');
    }
  }

  if (notJustButFixed > 0) {
    console.log('[POLISH] "Not just X, but Y" reduced:', totalMatches, '→', (totalMatches - notJustButFixed));
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
  onProgress?.('Polish: Fixing "yet" misuse…');
  const changes = [];
  let yetMisuseFixed = 0;

  const SUBJECT_WORDS = new Set([
    'he','she','it','they','we','you','i','the','a','an','this','that','these',
    'those','his','her','its','their','my','our','your','one','there','here',
    'what','who','which','when','where','how','no','not','none','nobody',
    'nothing','never','neither','nor','every','each','all','both','few',
    'many','some','any','most','several',
  ]);

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    let chFixed = 0;

    f.content = f.content.replace(
      /,\s+yet\s+([a-z]\w*)/gi,
      (match, nextWord) => {
        if (SUBJECT_WORDS.has(nextWord.toLowerCase())) return match; // legitimate usage
        chFixed++;
        yetMisuseFixed++;
        return '. ' + nextWord.charAt(0).toUpperCase() + nextWord.slice(1);
      }
    );

    if (chFixed > 0) {
      changes.push('Ch.' + chNum + ': fixed ' + chFixed + 'x "yet" misuse (", yet noun" → ". Noun")');
    }
  }

  if (yetMisuseFixed > 0) {
    console.log('[POLISH] "Yet" misuse fixed:', yetMisuseFixed);
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
  onProgress?.('Polish: Capping "Think of it as"…');
  const changes = [];
  let thinkOfItFixed = 0;

  const fullText = loaded.map(f => f.content).join('\n\n');
  const totalMatches = (fullText.match(/\b[Tt]hink of it as\b/g) || []).length;
  if (totalMatches <= 2) return { thinkOfItFixed: 0, changes: [] };

  const ALTS = ['Consider it', 'Imagine it as', 'Picture it as'];
  let globalCount = 0;
  let altIdx = 0;

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    let chFixed = 0;

    f.content = f.content.replace(
      /\b([Tt])hink of it as\b/g,
      (match, firstChar) => {
        globalCount++;
        if (globalCount <= 2) return match; // keep first 2
        chFixed++;
        thinkOfItFixed++;
        const alt = ALTS[altIdx % ALTS.length];
        altIdx++;
        return firstChar === 'T' ? alt : alt.charAt(0).toLowerCase() + alt.slice(1);
      }
    );

    if (chFixed > 0) {
      changes.push('Ch.' + chNum + ': capped ' + chFixed + 'x "Think of it as"');
    }
  }

  if (thinkOfItFixed > 0) {
    console.log('[POLISH] "Think of it as" capped:', totalMatches, '→', (totalMatches - thinkOfItFixed));
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
  onProgress?.('Polish: Capping AI-favorite phrases…');
  const changes = [];
  let aiPhrasesFixed = 0;

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

  for (const entry of PHRASE_CAPS) {
    // Count globally
    const fullText = loaded.map(f => f.content).join('\n\n');
    const allMatches = fullText.match(entry.rx);
    const total = allMatches ? allMatches.length : 0;
    if (total <= entry.cap) continue;

    const excess = total - entry.cap;
    let removed = 0;
    let globalKeep = 0;

    for (const f of loaded) {
      if (removed >= excess) break;

      f.content = f.content.replace(entry.rx, (match) => {
        globalKeep++;
        if (globalKeep <= entry.cap) return match; // keep first N
        if (removed >= excess) return match;

        removed++;
        aiPhrasesFixed++;

        // Delete the phrase. Context determines how:
        // If it starts a clause after comma: ", the weight of X" → ", X"
        // If it's mid-sentence: "felt the weight of X" → "felt X"
        // Safest: just remove the phrase and let surrounding text flow
        return '';
      });
    }

    if (removed > 0) {
      changes.push('"' + entry.phrase + '" capped: ' + total + ' → ' + (total - removed));

      // Clean up any double spaces left by deletion
      for (const f of loaded) {
        f.content = f.content.replace(/  +/g, ' ');
      }
    }
  }

  if (aiPhrasesFixed > 0) {
    console.log('[POLISH] AI phrases capped:', aiPhrasesFixed, 'excess instances removed');
  }
  return { aiPhrasesFixed, changes };
}