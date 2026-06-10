/**
 * modelQuirkChecks.js
 *
 * On-demand grammar / model-quirk detectors that flag-only into the
 * Review Queue. These run when the user explicitly clicks "Scan for
 * Model Quirks" — NOT during normal polish. They target LLM-specific
 * bugs that don't appear in every manuscript:
 *
 *   1. Dropped subject-verb fragments ("He felt" / "She felt" / "It was"
 *      dropouts). Signature: sentence starts lowercase after sentence-end
 *      punctuation, with pattern "[article/bare noun] [bare present verb]"
 *      that only makes sense if a subject+verb was cut from the front.
 *      Example: "the muscles contract under his palm" → missing "He felt"
 *
 *   2. ", yet " conjunction misuse — a Lumimaid-specific tic where "yet"
 *      replaces "and" or "but" in ways that read awkwardly. Only flags
 *      when rate is high enough to indicate a systematic issue (>0.5
 *      per 1K words across the manuscript).
 *
 *   3. Baseline dialogue-punct audit — not a fix, just a count. Useful
 *      after polish to confirm counts match what polish reported.
 *
 * All findings are flag-only. They return in the Review Queue item shape
 * used by ProjectPolishView:
 *
 *   { id, chapterNumber, pattern, context, suggestion, detectorType,
 *     dismissed: false, addedAt }
 *
 * The `detectorType` field distinguishes quirk findings from missing-noun
 * and contamination items so the UI can style them differently.
 */

// ──────────────────────────────────────────────────────────────────────
// DROPPED SUBJECT-VERB DETECTOR
// ──────────────────────────────────────────────────────────────────────

// Words that legitimately start a sentence with lowercase AFTER a prior
// sentence end. Mostly these are dialogue attributions or a continuation
// pattern the author uses intentionally.
const VALID_PRONOUN_STARTS = new Set([
  'he', 'she', 'they', 'i', 'we', 'you', 'it',
  'his', 'her', 'its', 'their', 'our', 'my', 'your',
]);

// Interjections / conjunctions that can legitimately start a sentence
// lowercase in informal narrative. These are style, not bugs.
const VALID_INTERJECTION_STARTS = new Set([
  'but', 'and', 'or', 'so', 'yet', 'for', 'nor',
  'yeah', 'yes', 'no', 'oh', 'ah', 'uh', 'well',
  'hey', 'wait', 'look', 'listen', 'please',
]);

// Dialogue attribution verbs. A sentence like "the captain said" that
// appears after a quote is valid, not a bug.
const DIALOGUE_ATTRIBUTION_VERBS = /\b(said|asked|replied|whispered|shouted|declared|called|muttered|hissed|gasped|sighed|breathed|laughed|snorted|grunted|groaned|moaned|growled|purred|sneered|spat|snapped|barked|chuckled|giggled|chirped|cried|wailed|demanded|insisted|protested|agreed|announced|admitted|confessed|argued|offered|suggested|warned|promised|pleaded|begged|cursed|swore|added|continued|interrupted|finished|concluded|remarked|observed|noted|mentioned|pointed|gestured|told|ordered|commanded|roared|bellowed|stammered|stuttered|mumbled|murmured|voiced|uttered|drawled|crooned|thought|wondered|pondered|mused|reflected)\b/;

// Bare present-tense verbs that, when they appear as the second word of
// a lowercase-start sentence without a pronoun subject, almost always
// indicate a dropped "He felt" / "She felt" / "It was" / "I saw" at the
// front. This list is hand-curated from scanning real manuscript bugs.
const PRESENT_BARE_VERBS = new Set([
  // Physical sensation (most common — "He felt" drops)
  'contract', 'contracted',
  'twitch', 'twitches',
  'pulse', 'pulses',
  'throb', 'throbs',
  'ache', 'aches',
  'tremble', 'trembles',
  'shudder', 'shudders',
  'quiver', 'quivers',
  'prick', 'pricks',
  'sting', 'stings',
  'burn', 'burns',
  'cool', 'cools',
  'warm', 'warms',
  'harden', 'hardens',
  'soften', 'softens',
  'tighten', 'tightens',
  'loosen', 'loosens',
  'stiffen', 'stiffens',
  'relax', 'relaxes',
  'stir', 'stirs',
  'flutter', 'flutters',
  'clench', 'clenches',
  // Physical motion (missing "saw" / "watched" / "felt")
  'bend', 'bends',
  'twist', 'twists',
  'curl', 'curls',
  'straighten', 'straightens',
  'lift', 'lifts',
  'drop', 'drops',
  'fall', 'falls',
  'rise', 'rises',
  'sink', 'sinks',
  'drift', 'drifts',
  'hang', 'hangs',
  // Emotion / perception (missing "It was")
  'respond', 'responds',
  'react', 'reacts',
  'pause', 'pauses',
  'linger', 'lingers',
  'persist', 'persists',
  'fade', 'fades',
  'ease', 'eases',
]);

// Comparison/perception starter words that suggest a dropped "It was" or
// "It felt" at the front when they lead a standalone sentence.
const COMPARISON_STARTERS = new Set([
  'like', 'as', 'almost', 'nearly',
]);

// Short orphan fragments that are never valid standalone sentences.
// "it.", "them.", "us.", "here." on their own after a prior sentence
// almost always mean a verb was cut (he felt it / saw them / reached here).
const ORPHAN_FRAGMENT_WORDS = new Set([
  'it', 'them', 'us', 'here', 'there', 'this', 'that', 'these', 'those',
]);

/**
 * Scan a single chapter's text for dropped subject-verb fragments.
 * Returns an array of findings with location context.
 */
export function detectDroppedSubjectVerbs(text, chapterNumber) {
  const findings = [];

  // ── Pattern A: sentence-end followed by lowercase "article/poss + bare verb" ──
  // Catches: "...against his palm. the muscles contract under his palm."
  //          "...complete inversion of their roles. tears prick at his eyes..."
  //
  // Approach: find sentence boundaries where the next sentence starts with
  // an article/possessive (not a pronoun subject), then walk forward up to
  // 6 words looking for a bare-present verb from our trigger list. If found,
  // the sentence is missing its "He felt" / "She felt" / "It was" lead-in.
  //
  // Earlier versions used a single regex with greedy capture groups which
  // mis-captured the verb. The word-walk approach is easier to reason about
  // and more accurate.
  const sentenceStartRx = /[.!?]["\u201d]*\s+(?=(?:the|his|her|its|their|my|your|a|an|tears)\s)/g;

  let m;
  while ((m = sentenceStartRx.exec(text)) !== null) {
    const startIdx = m.index + m[0].length;
    const slice = text.substring(startIdx, Math.min(text.length, startIdx + 160));
    const words = slice.split(/\s+/).slice(0, 7);

    // The first word of the sentence — should be an article or "tears"
    // (common Lumimaid subject-drop artifact). Skip valid pronoun starts
    // just in case the regex let one through.
    const firstWord = (words[0] || '').toLowerCase();
    if (VALID_PRONOUN_STARTS.has(firstWord)) continue;

    // Skip if this is a dialogue attribution ("the captain said", etc.)
    if (DIALOGUE_ATTRIBUTION_VERBS.test(slice)) continue;

    // Walk from word index 2 onward looking for a bare-present verb.
    // We start at 2 because index 0 is the article and index 1 is the
    // noun or first adjective. We stop at index 5 (max 6 words scanned)
    // because dropped-subject fragments always put the verb in the first
    // few words of the broken sentence.
    let matchedVerb = null;
    let matchedAtWord = -1;
    for (let i = 1; i < Math.min(words.length, 6); i++) {
      const w = (words[i] || '').replace(/[.,;:!?"'\u201c\u201d]/g, '').toLowerCase();
      if (PRESENT_BARE_VERBS.has(w)) {
        matchedVerb = w;
        matchedAtWord = i;
        break;
      }
    }
    if (!matchedVerb) continue;

    // Build pattern text (the first N words up through the verb) for display
    const patternText = words.slice(0, matchedAtWord + 1).join(' ').substring(0, 80);

    // Context window
    const ctxStart = Math.max(0, m.index - 50);
    const ctxEnd = Math.min(text.length, startIdx + 140);
    const context = text.substring(ctxStart, ctxEnd)
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    findings.push({
      chapterNumber,
      pattern: patternText,
      context,
      suggestion: 'Likely missing subject+verb at sentence start (e.g., "He felt", "She felt", "It was"). Review and insert the intended lead-in.',
      detectorType: 'droppedSubjectVerb',
    });
  }

  // ── Pattern B: orphaned short-word fragments ──
  // Catches: "...the way it tightens"? it. The flesh under his hand..."
  //          "...like a pulse, but deeper". them. A throb..."
  const patternB = /[.!?]["\u201d]*\s+([a-z]+)\.\s+[A-Z]/g;
  while ((m = patternB.exec(text)) !== null) {
    const word = m[1].toLowerCase();
    if (!ORPHAN_FRAGMENT_WORDS.has(word)) continue;

    const ctxStart = Math.max(0, m.index - 50);
    const ctxEnd = Math.min(text.length, m.index + 120);
    const context = text.substring(ctxStart, ctxEnd)
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    findings.push({
      chapterNumber,
      pattern: '"' + word + '."',
      context,
      suggestion: 'Orphaned fragment — likely missing verb (e.g., "He felt it." / "He saw them."). Review and expand.',
      detectorType: 'droppedSubjectVerb',
    });
  }

  // ── Pattern C: comparison-starter orphans ──
  // Catches: "...no longer awkward. like the air after a long storm..."
  //          Should be "It was like the air after..."
  const patternC = /[.!?]["\u201d]*\s+((?:like|as|almost|nearly)\s+(?:the|a|an|his|her|its|their|my|your)\s+[a-z'\-]+)/g;
  while ((m = patternC.exec(text)) !== null) {
    const ctxStart = Math.max(0, m.index - 50);
    const ctxEnd = Math.min(text.length, m.index + 140);
    const context = text.substring(ctxStart, ctxEnd)
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    findings.push({
      chapterNumber,
      pattern: m[1].substring(0, 60),
      context,
      suggestion: 'Starts with "like/as" — likely missing "It was" or "It felt" at the front. Review.',
      detectorType: 'droppedSubjectVerb',
    });
  }

  return findings;
}

// ──────────────────────────────────────────────────────────────────────
// "yet" CONJUNCTION MISUSE DETECTOR
// ──────────────────────────────────────────────────────────────────────

/**
 * Scan for ", yet " patterns that likely should be ", and " or ", but ".
 * Only fires at the manuscript level (not per-chapter) because we want
 * to gauge the rate first. If rate is below 0.5 per 1K words, the
 * manuscript probably doesn't have the Lumimaid tic.
 */
export function detectYetMisuse(loaded, totalWords) {
  // Count all ", yet " instances across manuscript
  const allInstances = [];
  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    const text = f.content || '';
    const rx = /,\s+yet\s+[^.!?]+[.!?]/g;
    let m;
    while ((m = rx.exec(text)) !== null) {
      allInstances.push({ chapterNumber: chNum, index: m.index, match: m[0], text });
    }
  }

  const rate = totalWords > 0 ? (allInstances.length / totalWords) * 1000 : 0;

  // Threshold check — below 0.5 per 1K, assume manuscript is clean and
  // don't flag anything. Every ", yet " is technically valid English.
  // Above 0.5 per 1K, the tic is systematic and worth surfacing.
  if (rate < 0.5) {
    return { findings: [], rate, triggered: false, totalInstances: allInstances.length };
  }

  // Rate is high — surface the individual findings so the user can
  // review and rewrite. Each finding is classified into a subtype
  // bucket so the Review Queue can group them for easier editing.
  const findings = allInstances.map((inst) => {
    const ctxStart = Math.max(0, inst.index - 60);
    const ctxEnd = Math.min(inst.text.length, inst.index + 100);
    const context = inst.text.substring(ctxStart, ctxEnd)
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const subType = classifyYetSubtype(inst.text, inst.index);

    return {
      chapterNumber: inst.chapterNumber,
      pattern: inst.match.substring(0, 80),
      context,
      suggestion: subtypeSuggestion(subType),
      detectorType: 'yetMisuse',
      subType,
    };
  });

  return { findings, rate, triggered: true, totalInstances: allInstances.length };
}

/**
 * Classify a ", yet " instance into one of four buckets based on the
 * surrounding text structure. Used to group findings in the Review Queue
 * so the author can tackle them in batches of similar surgery type.
 *
 * Buckets:
 *   - 'dialogueFragment'  : inside or near dialogue quotes, or followed
 *                           by a short fragment — usually needs em-dash
 *                           or period
 *   - 'questionLike'      : nearby question punctuation, or clause starts
 *                           with an interrogative word — usually needs ?
 *   - 'continuation'      : pronoun + verb follows, no contrast signal —
 *                           usually swaps cleanly with "and"
 *   - 'other'             : doesn't fit the above patterns
 */
function classifyYetSubtype(text, yetIndex) {
  // Context windows for classification
  const before = text.substring(Math.max(0, yetIndex - 100), yetIndex);
  const afterStart = yetIndex + 6; // skip ", yet "
  const after = text.substring(afterStart, Math.min(text.length, afterStart + 120));

  // Bucket 1: Dialogue fragment signal
  // - yet appears inside quotes (open quote is closer than a close quote)
  // - OR the clause after yet is short (< 5 words before a . ? or ")
  // - OR the phrase is adjacent to speech marks within ~10 chars
  const nearbyOpenQuote = /["\u201c]/.test(text.substring(Math.max(0, yetIndex - 60), yetIndex));
  const nearbyCloseQuote = /["\u201d]/.test(text.substring(yetIndex, Math.min(text.length, yetIndex + 60)));
  const afterShortFragment = /^[^.!?"\u201c\u201d]{0,30}[.!?"\u201c\u201d]/.test(after);
  if ((nearbyOpenQuote && nearbyCloseQuote) || afterShortFragment) {
    return 'dialogueFragment';
  }

  // Bucket 2: Question-like signal
  // - question mark within ~60 chars before or after
  // - clause after yet starts with interrogative: what/how/why/when/where/who/which
  const questionNearby = /\?/.test(text.substring(Math.max(0, yetIndex - 80), Math.min(text.length, yetIndex + 120)));
  const interrogativeStart = /^\s*(what|how|why|when|where|who|which|whose)\b/i.test(after);
  if (questionNearby || interrogativeStart) {
    return 'questionLike';
  }

  // Bucket 3: Continuation signal
  // - clause after yet starts with a pronoun + finite verb
  //   (e.g. "yet he walked", "yet she was", "yet they were")
  const continuationPattern = /^\s*(he|she|they|we|i|you|it)\s+(was|were|is|are|had|has|have|did|does|do|felt|saw|knew|thought|walked|said|turned|looked|stood)\b/i;
  if (continuationPattern.test(after)) {
    return 'continuation';
  }

  // Bucket 4: Everything else
  return 'other';
}

/**
 * Per-subtype suggestion text shown in the Review Queue. Gives the
 * author a hint about what surgery usually fits this bucket.
 */
function subtypeSuggestion(subType) {
  switch (subType) {
    case 'dialogueFragment':
      return 'In dialogue or fragment — usually needs an em-dash (—) or period, not a conjunction. Read the surrounding dialogue and pick the natural break.';
    case 'questionLike':
      return 'Near a question or interrogative — usually needs a question mark, or the "yet" should be cut entirely.';
    case 'continuation':
      return 'Continuation — often reads better as ", and " when the same subject is doing two things in sequence. Review to confirm.';
    case 'other':
    default:
      return 'Structural — the sentence is likely broken in a way that needs case-by-case surgery. Read it aloud to decide.';
  }
}

// ──────────────────────────────────────────────────────────────────────
// DIALOGUE-PUNCT AUDIT (baseline, non-fixing)
// ──────────────────────────────────────────────────────────────────────

/**
 * Count dialogue-punct-outside-quote instances across the manuscript.
 * This is an audit — it does NOT fix, just reports. Useful to confirm
 * polish actually landed its reported fix count.
 */
export function auditDialoguePunct(loaded) {
  let total = 0;
  const perChapter = [];
  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    const text = f.content || '';
    const count = (text.match(/[\u201d"][.!?]/g) || []).length;
    total += count;
    if (count > 0) {
      perChapter.push({ chapterNumber: chNum, count });
    }
  }
  return { total, perChapter };
}

// ──────────────────────────────────────────────────────────────────────
// TOP-LEVEL: run all three detectors, return Review-Queue-compatible findings
// ──────────────────────────────────────────────────────────────────────

/**
 * Run all model-quirk detectors across a set of loaded chapters.
 *
 * @param {Array<{chapter, content}>} loaded - loaded chapter records
 * @param {function} onProgress - progress callback for UI
 * @returns {object} { findings, summary }
 */
export function runModelQuirkScan(loaded, onProgress) {
  onProgress?.('Quirk Scan: Starting…');
  const startedAt = Date.now();

  const allFindings = [];
  let totalWords = 0;

  // Per-chapter: dropped subject-verb
  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    const chNum = f.chapter?.chapter_number || (i + 1);
    onProgress?.('Quirk Scan: Chapter ' + chNum + ' of ' + loaded.length + '…');

    const text = f.content || '';
    totalWords += text.split(/\s+/).filter(Boolean).length;

    const chFindings = detectDroppedSubjectVerbs(text, chNum);
    allFindings.push(...chFindings);
  }

  // Manuscript-level: "yet" misuse
  onProgress?.('Quirk Scan: Checking for "yet" conjunction misuse…');
  const yetResult = detectYetMisuse(loaded, totalWords);
  if (yetResult.triggered) {
    allFindings.push(...yetResult.findings);
  }

  // Manuscript-level: dialogue-punct audit (non-flagging, just reporting)
  onProgress?.('Quirk Scan: Auditing dialogue punctuation…');
  const dpAudit = auditDialoguePunct(loaded);

  const elapsedMs = Date.now() - startedAt;

  // Deduplicate findings by (chapter, pattern) — in case the same pattern
  // got flagged by multiple detectors (e.g., orphan + starter).
  const dedup = new Map();
  for (const f of allFindings) {
    const key = f.chapterNumber + '|' + f.pattern;
    if (!dedup.has(key)) dedup.set(key, f);
  }
  const uniqueFindings = [...dedup.values()];

  // Break findings down by detector type for summary
  const byType = {
    droppedSubjectVerb: uniqueFindings.filter(f => f.detectorType === 'droppedSubjectVerb').length,
    yetMisuse: uniqueFindings.filter(f => f.detectorType === 'yetMisuse').length,
  };

  const summary = {
    totalWords,
    totalFindings: uniqueFindings.length,
    byType,
    yetRate: Math.round(yetResult.rate * 10) / 10,
    yetTriggered: yetResult.triggered,
    yetTotalInstances: yetResult.totalInstances,
    dialoguePunctTotal: dpAudit.total,
    dialoguePunctPerChapter: dpAudit.perChapter,
    elapsedMs,
  };

  console.warn('[QUIRK-SCAN] Complete in ' + elapsedMs + 'ms');
  console.warn('[QUIRK-SCAN] Total findings:', summary.totalFindings);
  console.warn('[QUIRK-SCAN] Dropped subject-verb:', byType.droppedSubjectVerb);
  console.warn('[QUIRK-SCAN] "yet" misuse:', byType.yetMisuse, '(rate ' + summary.yetRate + '/1K, triggered=' + yetResult.triggered + ')');
  console.warn('[QUIRK-SCAN] Dialogue punct audit:', summary.dialoguePunctTotal, 'total outside-quote marks');

  return { findings: uniqueFindings, summary };
}

/**
 * Convert quirk findings into Review Queue items. Each returned object
 * matches the existing missing-noun / contamination item shape so it
 * can be merged into the same queue.
 */
export function quirkFindingsToQueueItems(findings) {
  return findings.map((f, i) => {
    const id = 'quirk|' + f.detectorType + '|' + f.chapterNumber + '|' + f.pattern;
    return {
      id,
      chapterNumber: f.chapterNumber,
      pattern: f.pattern,
      context: f.context,
      suggestion: f.suggestion,
      detectorType: f.detectorType,
      subType: f.subType || null, // only yet-misuse uses this today
      contaminationType: false,
      dismissed: false,
      addedAt: Date.now() + i, // preserve stable ordering
    };
  });
}