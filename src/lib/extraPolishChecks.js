/**
 * Extra polish checks — closes gaps found by cross-manuscript audit
 *
 * Discovered via scan of Logan Wilshire's "The Absence" (101k words, 25 ch):
 * the existing pipeline reported 85% Clean Score but missed several
 * significant AI-signature patterns. This module adds 5 new checks:
 *
 *   1. Em-dash density + stacked-dash compression (FIX + FLAG)
 *   2. Negative antithesis — "not X, but Y" / "X, not Y" (FLAG-only)
 *   3. Cross-manuscript phrase echoes (4-grams appearing 5+x) (FLAG-only)
 *   4. Article errors — "a emergency" → "an emergency" (FIX)
 *   5. Dialogue-tag character-tic loops (FLAG-only)
 *
 * All FIX functions respect the 50% safety guard convention (reject edits
 * that would drop a chapter below half its original length, matching the
 * pattern in anthologyPolishChecks.js).
 */

// ═══════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function countWords(text) {
  return (text || '').split(/\s+/).filter(Boolean).length;
}

function chapterNum(ch) {
  return ch?.chapter_number ?? ch?.number ?? '?';
}

/**
 * Safety guard — reject modification if it drops content below `minRatio`
 * of the original length. Prevents catastrophic loss from over-aggressive
 * regex replacements. Same pattern used in anthologyPolishChecks.js.
 */
function isContentSafe(original, modified, minRatio = 0.5) {
  if (!original || !modified) return false;
  const originalLen = original.length;
  const modifiedLen = modified.length;
  if (originalLen === 0) return true;
  return modifiedLen / originalLen >= minRatio;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — EM-DASH DENSITY AUDIT + STACKED-DASH COMPRESSION (FIX + FLAG)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Two-part check:
 *   A. FIX: Compress sentences with 3+ em-dashes by replacing all INTERNAL
 *      dashes with commas. Keeps the outer dashes (if present) so emphasis
 *      parentheticals survive. Only fires when all internal clauses are short
 *      (≤8 words each) — avoids rewriting legitimate long parentheticals.
 *   B. FLAG: Report chapter-level em-dash density. Target is <2 per 1,000 words;
 *      typical AI output runs 15-25 per 1,000. Flag any chapter >3/1k.
 *
 * Mutates loaded[i].content on fix.
 */
export function detectAndFixEmDashDensity(loaded) {
  const changes = [];
  let fixed = 0;
  let flagged = 0;

  for (const ch of loaded) {
    if (!ch?.content) continue;
    const original = ch.content;
    const chNum = chapterNum(ch);
    const wordCount = countWords(original);

    // Part A: compress stacked em-dashes (3+ in one sentence)
    //
    // PREVIOUSLY this required ALL clauses to be ≤8 words — in practice,
    // real manuscripts rarely satisfy that (stacked-dash sentences usually
    // have ONE long intro clause followed by several short fragments),
    // causing the rule to skip almost everything. New rule: compress if
    // 3+ em-dashes AND no em-dash is adjacent to a quote character.
    // Quote-adjacency indicates dialogue interruption (intentional rhetorical
    // cut-off) which must be preserved.
    let modified = original;
    let chapterFixed = 0;

    // Split into sentences, process each
    const sentences = modified.split(/(?<=[.!?])\s+/);
    // Quote-adjacent em-dash detector — matches straight and curly quote marks,
    // with optional whitespace between the quote and the dash.
    // Unicode: \u2018 = ', \u2019 = ', \u201C = ", \u201D = "
    const QUOTE_ADJ_DASH = /[\u2018\u2019\u201C\u201D"']\s*—|—\s*[\u2018\u2019\u201C\u201D"']/;
    const processed = sentences.map((sentence) => {
      const dashCount = (sentence.match(/—/g) || []).length;
      if (dashCount < 3) return sentence;

      // Preserve dialogue interruption dashes
      if (QUOTE_ADJ_DASH.test(sentence)) return sentence;

      // Compress all em-dashes to commas. Normalize whitespace around each
      // replacement and collapse accidental double-commas that can result
      // when the sentence already contained a comma right next to an em-dash.
      chapterFixed += dashCount;
      return sentence
        .replace(/\s*—\s*/g, ', ')
        .replace(/,\s*,/g, ',');
    });
    modified = processed.join(' ').replace(/\s+\n/g, '\n').trim();

    // Apply fix if safe
    if (chapterFixed > 0 && isContentSafe(original, modified)) {
      ch.content = modified;
      fixed += chapterFixed;
      changes.push('Ch.' + chNum + ': compressed ' + chapterFixed + ' stacked em-dashes');
    }

    // Part B: flag chapter-level density (on POST-fix content)
    const postDashes = (ch.content.match(/—/g) || []).length;
    const per1k = wordCount > 0 ? (postDashes / wordCount) * 1000 : 0;
    if (per1k > 3) {
      flagged++;
      changes.push(
        'Ch.' + chNum + ': ⚠️ em-dash density ' + per1k.toFixed(1) + '/1k words ' +
        '(' + postDashes + ' dashes, target <2/1k)'
      );
    }
  }

  return { fixed, flagged, changes };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — NEGATIVE ANTITHESIS DETECTION (FLAG-ONLY)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Detects "not X, but Y" and "It was not ... It was ..." constructions — a
 * classic AI rhetorical tell. Flag when any single chapter exceeds 3 hits.
 *
 * Does NOT modify content; rewriting this pattern requires human judgment
 * (sometimes it's the right rhetorical choice, sometimes not).
 */
export function detectNegativeAntithesis(loaded) {
  const changes = [];
  let flagged = 0;

  const patterns = [
    // "not X, but Y" — X and Y up to 4 words
    /\bnot\s+[\w\s]{1,40}?,\s*but\s+[\w\s]{1,40}?[.!?,;]/gi,
    // "X, not Y." — close to sentence end
    /\b\w+(?:\s+\w+){0,4},\s*not\s+\w+(?:\s+\w+){0,4}[.!?]/gi,
    // "It was not ... It was ..." / "This was not ... This was ..."
    /\b(?:It|This|He|She|They|That)\s+(?:was|is|isn't|wasn't|aren't)\s+not\s+[^.!?]+[.!?]\s*(?:It|This|He|She|They|That)\s+(?:was|is)\b/gi,
  ];

  for (const ch of loaded) {
    if (!ch?.content) continue;
    const chNum = chapterNum(ch);
    let chapterHits = 0;
    for (const rx of patterns) {
      const matches = ch.content.match(rx) || [];
      chapterHits += matches.length;
    }
    if (chapterHits > 3) {
      flagged++;
      changes.push(
        'Ch.' + chNum + ': ⚠️ ' + chapterHits + ' negative-antithesis constructions ' +
        '("not X, but Y" / "X, not Y") — AI rhetorical tell, vary with direct statements'
      );
    }
  }

  return { flagged, changes };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — CROSS-MANUSCRIPT PHRASE ECHOES (FLAG-ONLY)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Extracts 4-grams from every chapter, counts occurrences across the whole
 * manuscript, and flags phrases appearing 5+ times. Structural phrases
 * (starting with articles/pronouns) are skipped to reduce noise.
 *
 * Flag-only because these echoes often reflect intentional motifs; the
 * author decides which ones to keep and which to vary.
 */
export function detectCrossManuscriptEchoes(loaded) {
  const changes = [];
  let flagged = 0;

  // Skip 4-grams starting with these — they're too structural
  const SKIP_STARTS = new Set([
    'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'he', 'she',
    'it', 'it\'s', 'they', 'we', 'i', 'you', 'for', 'and', 'but', 'or',
    'so', 'with', 'from', 'as', 'is', 'was', 'were', 'be', 'been',
  ]);

  const ngramCounts = new Map();
  const ngramChapters = new Map(); // ngram -> Set of chapter numbers

  for (const ch of loaded) {
    if (!ch?.content) continue;
    const chNum = chapterNum(ch);
    const tokens = ch.content.toLowerCase().match(/\b[\w']+\b/g) || [];

    for (let i = 0; i <= tokens.length - 4; i++) {
      const ng = tokens.slice(i, i + 4).join(' ');
      if (SKIP_STARTS.has(tokens[i])) continue;
      // Also skip if the ngram has 2+ copies of "the"
      if ((ng.match(/\bthe\b/g) || []).length >= 2) continue;
      ngramCounts.set(ng, (ngramCounts.get(ng) || 0) + 1);
      if (!ngramChapters.has(ng)) ngramChapters.set(ng, new Set());
      ngramChapters.get(ng).add(chNum);
    }
  }

  // Report top echoes appearing 5+ times across 3+ chapters
  const echoes = [];
  for (const [ng, count] of ngramCounts) {
    if (count >= 5 && ngramChapters.get(ng).size >= 3) {
      echoes.push({ ng, count, chapters: ngramChapters.get(ng).size });
    }
  }
  echoes.sort((a, b) => b.count - a.count);

  if (echoes.length > 0) {
    const top = echoes.slice(0, 15);
    flagged = top.length;
    changes.push(
      '⚠️ Cross-manuscript phrase echoes (top ' + top.length +
      ' 4-grams appearing 5+ times in 3+ chapters):'
    );
    for (const e of top) {
      changes.push(
        '  • "' + e.ng + '" — ' + e.count + 'x across ' + e.chapters + ' chapters'
      );
    }
  }

  return { flagged, changes };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — ARTICLE ERRORS "a X" / "an X" (FIX)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Fixes clear-cut a/an errors. Uses a safe list of words with unambiguous
 * vowel-sound starts ("a emergency" → "an emergency") and a safe list of
 * consonant-sound starts ("an university" → "a university"). Ambiguous cases
 * (silent-h, acronyms, proper nouns) are skipped — proofreader handles those.
 *
 * Respects 50% safety guard.
 */
export function detectAndFixArticleErrors(loaded) {
  const changes = [];
  let fixed = 0;

  // Words where "an" is unambiguously correct (vowel-sound start)
  const VOWEL_SOUND_WORDS = [
    'emergency', 'emergencies', 'observation', 'observational', 'observer',
    'ordinary', 'obvious', 'official', 'officer', 'office',
    'extra', 'extract', 'extraction', 'extreme', 'event', 'exit',
    'adequate', 'average', 'awkward', 'absolute', 'alert',
    'economic', 'elderly', 'elaborate', 'expert', 'electric',
    'angry', 'anxious', 'enormous', 'essential', 'eternal', 'exact',
    'important', 'immediate', 'impossible', 'industrial', 'independent',
    'open', 'opportunity', 'opinion', 'orange', 'organized', 'organic',
    'odd', 'older', 'old', 'ongoing', 'ocean',
    'easy', 'east', 'eastern', 'empty', 'endless', 'entire', 'entity',
    'upper', 'unable', 'unknown', 'urgent', 'array', 'army', 'era', 'end',
    'hour', 'hourly', 'honest', 'honesty', 'honor', 'honorable', 'heir',
  ];
  // Words where "a" is unambiguously correct even if spelled with vowel
  // (yoo-sound or wuh-sound)
  const CONSONANT_SOUND_VOWEL_WORDS = [
    'university', 'universal', 'universe', 'unit', 'unique', 'united',
    'uniform', 'union', 'useful', 'user', 'usage', 'usual', 'utility',
    'utilization', 'european', 'euro', 'eulogy', 'ukrainian', 'one-time',
  ];

  const vowelRx = new RegExp(
    '\\ba\\s+(' + VOWEL_SOUND_WORDS.join('|') + ')\\b',
    'gi'
  );
  const consRx = new RegExp(
    '\\ban\\s+(' + CONSONANT_SOUND_VOWEL_WORDS.join('|') + ')\\b',
    'gi'
  );

  for (const ch of loaded) {
    if (!ch?.content) continue;
    const original = ch.content;
    const chNum = chapterNum(ch);
    let modified = original;
    let chapterFixed = 0;

    // "a emergency" → "an emergency" (preserve "a"/"A" case)
    modified = modified.replace(vowelRx, (match, word) => {
      chapterFixed++;
      const isCapitalA = /^[A-Z]/.test(match);
      return (isCapitalA ? 'An' : 'an') + ' ' + word;
    });

    // "an university" → "a university"
    modified = modified.replace(consRx, (match, word) => {
      chapterFixed++;
      const isCapitalAn = /^A/.test(match);
      return (isCapitalAn ? 'A' : 'a') + ' ' + word;
    });

    if (chapterFixed > 0 && isContentSafe(original, modified)) {
      ch.content = modified;
      fixed += chapterFixed;
      changes.push('Ch.' + chNum + ': fixed ' + chapterFixed + ' a/an article errors');
    }
  }

  return { fixed, changes };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — DIALOGUE-TAG CHARACTER-TIC LOOPS (FLAG-ONLY)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Detects when a single character speaks with the same dialogue-tag structure
 * repeatedly across the manuscript. Example from The Absence scan:
 * "Thorne says, his voice [adj]" appeared 7 times — a signature tic that
 * readers pick up on.
 *
 * Pattern: captures [Name] + speech-verb + ", his/her/their voice [modifier]"
 * and counts per-name. Flags names with 4+ occurrences.
 *
 * Flag-only because rewriting requires context (some repetition is character
 * fingerprint; some is AI laziness).
 */
export function detectDialogueTagLoops(loaded) {
  const changes = [];
  let flagged = 0;

  // Match: "[Name] says/said/asks/..." + optional punct + "his/her/their voice [anything]"
  const tagRx = /\b([A-Z][a-z]+)\s+(?:says?|said|asks?|asked|replies|replied|whispers?|whispered|murmurs?|murmured|mutters?|muttered)[,.]?\s+(?:his|her|their)\s+voice\s+[^.!?]{0,80}[.!?]/g;

  // Also match reverse form: "[adj], [Name] says/said"
  const reverseTagRx = /\b(?:his|her|their)\s+voice\s+\w+(?:\s+\w+){0,3},\s+([A-Z][a-z]+)\s+(?:says?|said)/g;

  const perName = new Map(); // name -> count

  for (const ch of loaded) {
    if (!ch?.content) continue;
    for (const match of ch.content.matchAll(tagRx)) {
      const name = match[1];
      perName.set(name, (perName.get(name) || 0) + 1);
    }
    for (const match of ch.content.matchAll(reverseTagRx)) {
      const name = match[1];
      perName.set(name, (perName.get(name) || 0) + 1);
    }
  }

  for (const [name, count] of perName) {
    if (count >= 4) {
      flagged++;
      changes.push(
        '⚠️ Character tic detected: "' + name + ' [speaks], his/her voice [X]" pattern ' +
        'appears ' + count + 'x across manuscript — reader will notice. Vary with action beats, ' +
        'reactions, or silent dialogue.'
      );
    }
  }

  return { flagged, changes };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — SUBJECT-STRIPPED TRANSITION OPENERS (FLAG-ONLY)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Detects sentences damaged by the historical parallel-sentence polish bug
 * that stripped the grammatical subject when inserting a transition opener.
 * Example damage:
 *   "Without thinking, will be high-yield"        (lost subject "It")
 *   "Meanwhile, gave him a catchphrase"            (lost subject "She")
 *   "In truth, just nods"                          (lost subject "She")
 *   "Without thinking, takes them off"             (lost subject "He")
 *   "Before long, curators — surgeons"             (lost subject "They're")
 *
 * The bug itself is fixed in detectAndFixParallelSentences — this detector
 * surfaces existing damage so it can be manually repaired (or caught by
 * AI Proofread as grammar errors).
 *
 * FLAG-ONLY. Subject restoration requires context-aware pronoun inference
 * (who is the POV character at this moment, who was last referenced) which
 * is not reliable to auto-apply without risk of assigning the wrong pronoun.
 */
export function detectSubjectStrippedOpeners(loaded) {
  const changes = [];
  let flagged = 0;

  // The exact set of openers the parallel-sentence step may have inserted.
  // Keep this in sync with TRANSITION_OPENERS in antiDetectionPolish.js.
  const OPENERS = [
    'Instead', 'By then', 'Still', 'And yet', 'Even so',
    'Meanwhile', 'Before long', 'Without thinking', 'At last',
    'In truth', 'For a moment', 'This time', 'Not that it mattered',
  ];

  // Words that indicate a legitimate grammatical subject immediately follows
  // the opener (healthy sentences). Anything OTHER than these after the
  // opener → likely subject-stripped damage.
  const VALID_NEXT_WORDS = new Set([
    'he', 'she', 'they', 'it', 'we', 'you', 'i',
    'his', 'her', 'their', 'its', 'my', 'your', 'our',
    'the', 'a', 'an', 'this', 'that', 'these', 'those',
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'some', 'many', 'every', 'no', 'all', 'both', 'several', 'few', 'most',
    'each', 'another', 'other', 'multiple',
    'there', 'here', 'only', 'not', 'nothing', 'someone', 'anyone',
    'everyone', 'nobody', 'something', 'anything', 'everything',
  ]);

  // Subordinating conjunctions — legitimate subordinate clauses after the
  // opener ("At last, when X happened...") are not subject-stripped damage.
  const SUBORDINATING_CONJUNCTIONS = new Set([
    'when', 'while', 'because', 'if', 'though', 'although', 'since',
    'whereas', 'until', 'unless', 'whenever', 'wherever', 'whether',
    'as', 'before', 'after',
  ]);

  // Prep-phrase starters — when followed shortly by a comma, a prep phrase
  // precedes the real subject ("Even so, for countless others, the cost was...")
  const PREP_PHRASE_STARTERS = new Set([
    'in', 'on', 'at', 'by', 'for', 'from', 'with', 'without', 'through',
    'during', 'after', 'before', 'against', 'under', 'over', 'between',
    'among', 'across', 'behind', 'beside', 'beyond', 'despite', 'toward',
    'about', 'within',
  ]);

  // To-be / auxiliary verbs — when the word AFTER the "next word" is one of
  // these, the next word IS a valid noun subject ("Meanwhile, rape was
  // treated..."). Trade-off: misses "Instead, contrast was absolute" which
  // was subject-stripped from "the contrast was absolute" — but the sentence
  // reads fine as-is.
  const TO_BE_AUX_VERBS = new Set([
    'was', 'were', 'is', 'are', 'am',
    'has', 'had', 'have',
    'will', 'would', 'could', 'should', 'might', 'must', 'shall', 'may',
  ]);

  for (const ch of loaded) {
    if (!ch?.content) continue;
    const chNum = chapterNum(ch);
    const damagedSentences = [];

    for (const opener of OPENERS) {
      // `\b` after the opener is critical to avoid matching "Still" inside
      // "Stillness" (captures "ness" as next word — false positive).
      // Capture two words so rule 5 (noun + to-be verb) can fire.
      const openerEsc = opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(
        '\\b' + openerEsc + '\\b[,.]?\\s*(?:—\\s*)?([A-Za-z]+)\\b(?:[\\s,]+([A-Za-z\']+))?',
        'g'
      );

      let m;
      while ((m = rx.exec(ch.content)) !== null) {
        const nextWord = (m[1] || '').toLowerCase();
        const wordAfterNext = (m[2] || '').toLowerCase();
        const isProperNoun = /^[A-Z]/.test(m[1] || '');

        // Rule: healthy — valid subject or proper noun follows directly
        if (VALID_NEXT_WORDS.has(nextWord) || isProperNoun) continue;

        // Rule: subordinating conjunction → legitimate subordinate clause
        if (SUBORDINATING_CONJUNCTIONS.has(nextWord)) continue;

        // Rule: prep phrase starter + comma within 40 chars → prep phrase then subject
        if (PREP_PHRASE_STARTERS.has(nextWord)) {
          const lookAheadStart = m.index + m[0].length;
          const lookAhead = ch.content.substring(lookAheadStart, lookAheadStart + 40);
          if (/,/.test(lookAhead)) continue;
        }

        // Rule: noun + to-be verb → noun IS the subject
        if (TO_BE_AUX_VERBS.has(wordAfterNext)) continue;

        // Likely subject-stripped. Capture ~80 chars of context.
        const start = Math.max(0, m.index);
        const end = Math.min(ch.content.length, m.index + 80);
        const snippet = ch.content.substring(start, end).replace(/\s+/g, ' ').trim();
        damagedSentences.push(snippet);
      }
    }

    if (damagedSentences.length > 0) {
      flagged += damagedSentences.length;
      changes.push(
        'Ch.' + chNum + ': ⚠️ ' + damagedSentences.length +
        ' subject-stripped transition opener(s) detected — likely legacy polish damage. Manual review or re-run AI Proofread to repair.'
      );
      // Include up to 3 examples inline so the user can locate them.
      const samples = damagedSentences.slice(0, 3);
      for (const s of samples) {
        changes.push('    • "' + s + '…"');
      }
    }
  }

  return { flagged, changes };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY — runs all 5 checks in sequence
// ═══════════════════════════════════════════════════════════════════════════
export function runExtraPolishChecks(loaded, onProgress) {
  const allChanges = [];

  onProgress?.('Polish: Auditing em-dash density…');
  const dashResult = detectAndFixEmDashDensity(loaded);
  allChanges.push(...dashResult.changes);

  onProgress?.('Polish: Scanning negative-antithesis patterns…');
  const antiResult = detectNegativeAntithesis(loaded);
  allChanges.push(...antiResult.changes);

  onProgress?.('Polish: Scanning cross-manuscript phrase echoes…');
  const echoResult = detectCrossManuscriptEchoes(loaded);
  allChanges.push(...echoResult.changes);

  onProgress?.('Polish: Fixing a/an article errors…');
  const articleResult = detectAndFixArticleErrors(loaded);
  allChanges.push(...articleResult.changes);

  onProgress?.('Polish: Scanning dialogue-tag character tics…');
  const tagResult = detectDialogueTagLoops(loaded);
  allChanges.push(...tagResult.changes);

  onProgress?.('Polish: Scanning for subject-stripped transition openers…');
  const strippedResult = detectSubjectStrippedOpeners(loaded);
  allChanges.push(...strippedResult.changes);

  return {
    emDashFixed: dashResult.fixed,
    emDashFlagged: dashResult.flagged,
    antithesisFlagged: antiResult.flagged,
    echoesFlagged: echoResult.flagged,
    articlesFixed: articleResult.fixed,
    tagLoopsFlagged: tagResult.flagged,
    subjectStrippedFlagged: strippedResult.flagged,
    changes: allChanges,
  };
}