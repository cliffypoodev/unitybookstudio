/**
 * AI-favorite vocabulary frequency caps + sentence starter variation.
 * Shared between fiction and nonfiction polish pipelines.
 */

const CAPPED_VOCABULARY = [
  // Verified caps per user spec (per 10K words → approx per 100K at 10x)
  { word: 'etched', max: 0.4, replacements: ['carved', 'cut', 'marked', 'lined', 'scored', 'written', 'traced'] },           // 4/100K
  { word: 'crystalline', max: 0.2, replacements: ['clear', 'sharp', 'bright', 'hard', 'clean', 'glass-clear'] },              // 2/100K
  { word: 'fractured', max: 0.4, replacements: ['broken', 'cracked', 'split', 'splintered', 'snapped'] },                     // 4/100K
  { word: 'profound', max: 0.3, replacements: ['deep', 'heavy', 'complete', 'total', 'bone-deep'] },                          // 3/100K
  { word: 'cascade', max: 0.3, replacements: ['rush', 'flood', 'wave', 'pour', 'surge', 'spill'] },                           // 3/100K
  { word: 'tangible', max: 0.3, replacements: ['real', 'solid', 'physical', 'concrete', 'actual'] },                          // 3/100K
  { word: 'resonance', max: 0.3, replacements: ['echo', 'vibration', 'hum', 'ring', 'weight', 'pull'] },                      // 3/100K
  { word: 'calibrated', max: 0.3, nfMax: 0.5, replacements: ['measured', 'careful', 'precise', 'controlled', 'tuned'] },      // 3/100K
  { word: 'orchestrated', max: 0.1, replacements: ['arranged', 'planned', 'organized', 'staged', 'managed'] },                // 1/100K
  { word: 'ephemeral', max: 0.1, replacements: ['brief', 'fleeting', 'passing', 'short-lived', 'quick'] },                    // 1/100K
  { word: 'tableau', max: 0.1, replacements: ['scene', 'picture', 'image', 'sight', 'display'] },                             // 1/100K
  { word: 'symphony', max: 0.1, replacements: ['chorus', 'noise', 'sound', 'blend', 'mix'] },                                 // 1/100K
  { word: 'geometry', max: 0.2, replacements: ['shape', 'pattern', 'lines', 'form', 'angles'] },                              // 2/100K
  { word: 'nuance', max: 0.2, replacements: ['detail', 'shade', 'subtlety', 'hint', 'layer'] },                               // 2/100K
  { word: 'luminous', max: 0.1, replacements: ['bright', 'glowing', 'lit', 'warm', 'golden'] },                               // 1/100K
  { word: 'crescendo', max: 0.1, replacements: ['peak', 'height', 'climax', 'surge', 'swell'] },                              // 1/100K
  { word: 'liminal', max: 0.1, replacements: ['borderline', 'threshold', 'in-between', 'transitional', 'edge'] },             // 1/100K
];

const STARTER_NOUNS = ['sound', 'sight', 'smell', 'feeling', 'thought', 'memory', 'image', 'word', 'silence', 'darkness', 'light', 'heat', 'cold', 'weight', 'pressure', 'pain', 'fear'];

// ── ZERO-TOLERANCE BANNED WORDS ──
// These are the EXACT words scored as banned in manuscriptStats.js.
// Remove ALL occurrences — zero tolerance, no per-chapter allowance.
const BANNED_WORDS_HARD_REMOVE = [
  { word: 'shimmering', replacements: ['flickering', 'gleaming', 'glinting', 'faint', 'pale'] },
  { word: 'luminous', replacements: ['bright', 'glowing', 'lit', 'warm', 'golden'] },
  { word: 'tapestry', replacements: ['fabric', 'web', 'weave', 'pattern', 'cloth'] },
  { word: 'intricate', replacements: ['complex', 'detailed', 'elaborate', 'layered', 'fine'] },
  { word: 'meticulously', replacements: ['carefully', 'precisely', 'thoroughly', 'methodically'] },
  { word: 'insatiable', replacements: ['endless', 'bottomless', 'unending', 'hungry'] },
  { word: 'palpable', replacements: ['thick', 'obvious', 'heavy', 'real', 'physical'] },
  { word: 'unmistakable', replacements: ['obvious', 'clear', 'plain', 'distinct'] },
  { word: 'undeniable', replacements: ['clear', 'obvious', 'plain', 'certain'] },
  { word: 'relentless', replacements: ['constant', 'unending', 'persistent', 'grinding', 'steady'] },
  { word: 'sprawling', replacements: ['wide', 'vast', 'broad', 'rambling', 'spread-out'] },
  { word: 'labyrinthine', replacements: ['winding', 'tangled', 'twisting', 'maze-like'] },
  { word: 'opulent', replacements: ['rich', 'lavish', 'luxurious', 'ornate'] },
  { word: 'resplendent', replacements: ['bright', 'brilliant', 'dazzling', 'vivid'] },
  { word: 'ethereal', replacements: ['faint', 'ghostly', 'thin', 'delicate'] },
  { word: 'visceral', replacements: ['raw', 'gut-level', 'primal', 'deep'] },
  { word: 'cacophony', replacements: ['noise', 'din', 'racket', 'clamor'] },
  { word: 'crescendo', replacements: ['peak', 'climax', 'surge', 'swell'] },
  { word: 'juxtaposition', replacements: ['contrast', 'clash', 'tension', 'collision'] },
  { word: 'myriad', replacements: ['many', 'countless', 'numerous', 'endless'] },
  { word: 'plethora', replacements: ['abundance', 'excess', 'flood', 'surplus'] },
  { word: 'testament', replacements: ['proof', 'evidence', 'sign', 'marker', 'record'] },
  { word: 'harbinger', replacements: ['sign', 'warning', 'signal', 'omen'] },
  { word: 'paradigm', replacements: ['model', 'framework', 'pattern', 'standard'] },
  { word: 'dichotomy', replacements: ['contrast', 'split', 'divide', 'tension'] },
  { word: 'multifaceted', replacements: ['complex', 'layered', 'varied', 'rich'] },
  { word: 'aforementioned', replacements: ['previous', 'earlier', 'that', 'the'] },
  { word: 'nonetheless', replacements: ['still', 'yet', 'even so', 'but'] },
  { word: 'furthermore', replacements: ['also', 'and', 'plus', 'beyond that'] },
  { word: 'henceforth', replacements: ['from now on', 'after this', 'going forward'] },
  { word: 'commence', replacements: ['begin', 'start', 'open', 'launch'] },
  { word: 'utilize', replacements: ['use', 'employ', 'apply', 'work with'] },
  { word: 'endeavor', replacements: ['effort', 'attempt', 'try', 'work'] },
  { word: 'pertaining', replacements: ['about', 'regarding', 'related to', 'on'] },
];

/**
 * Run AI-favorite vocabulary frequency caps across loaded chapters.
 * Mutates loaded[].content in place.
 * Returns { vocabCapped, changes }
 */
export function runVocabCaps(loaded, onProgress, options = {}) {
  onProgress?.('Polish: Capping AI-favorite vocabulary…');
  const changes = [];
  let vocabCapped = 0;
  const isNF = options?.project?.book_type === 'nonfiction';

  // Build fresh full text from CURRENT content (after prior steps mutated it)
  const fullText = loaded.map(f => f.content).join('\n\n');
  const totalWords = fullText.split(/\s+/).filter(Boolean).length;

  console.log('[POLISH][VOCAB] Step starting. Chapters: ' + loaded.length + ', totalWords: ' + totalWords + ', isNF: ' + isNF);

  // ── PHASE 0: Hard-remove ALL banned words (zero tolerance) ──
  let bannedRemoved = 0;
  for (const entry of BANNED_WORDS_HARD_REMOVE) {
    const regex = new RegExp('\\b' + entry.word + '\\b', 'gi');
    let entryRemoved = 0;
    for (const f of loaded) {
      const before = f.content;
      f.content = f.content.replace(regex, (match) => {
        const alt = entry.replacements[entryRemoved % entry.replacements.length];
        entryRemoved++;
        bannedRemoved++;
        vocabCapped++;
        if (match.charAt(0) === match.charAt(0).toUpperCase()) {
          return alt.charAt(0).toUpperCase() + alt.slice(1);
        }
        return alt;
      });
    }
    if (entryRemoved > 0) {
      changes.push('BANNED "' + entry.word + '": removed all ' + entryRemoved + ' occurrences');
      console.log('[POLISH][VOCAB] BANNED "' + entry.word + '": removed ' + entryRemoved);
    }
  }
  if (bannedRemoved > 0) {
    console.log('[POLISH][VOCAB] Total banned words removed:', bannedRemoved);
  }

  // ── PHASE 1: Cap AI-favorite vocabulary (per-10K-words thresholds) ──

  for (const entry of CAPPED_VOCABULARY) {
    const effectiveMax = (isNF && entry.nfMax !== undefined) ? entry.nfMax : entry.max;
    const regex = new RegExp('\\b' + entry.word + '\\b', 'gi');

    // Re-read content from loaded (not stale fullText) for accurate counting
    const currentText = loaded.map(f => f.content).join('\n\n');
    const allMatches = currentText.match(regex);
    if (!allMatches) continue;

    const count = allMatches.length;
    const maxAllowed = Math.max(1, Math.round(effectiveMax * totalWords / 10000));

    console.log('[POLISH][VOCAB] "' + entry.word + '": found=' + count + ', effectiveMax=' + effectiveMax + '/10K, maxAllowed=' + maxAllowed + ', excess=' + Math.max(0, count - maxAllowed));

    if (count <= maxAllowed) continue;

    const excess = count - maxAllowed;
    let removed = 0;
    let globalCount = 0;

    for (const f of loaded) {
      if (removed >= excess) break;
      const chapterRegex = new RegExp('\\b' + entry.word + '\\b', 'gi');
      f.content = f.content.replace(chapterRegex, (match) => {
        globalCount++;
        if (globalCount <= maxAllowed) return match;
        if (removed >= excess) return match;
        const alt = entry.replacements[removed % entry.replacements.length];
        removed++;
        vocabCapped++;
        if (match.charAt(0) === match.charAt(0).toUpperCase()) {
          return alt.charAt(0).toUpperCase() + alt.slice(1);
        }
        return alt;
      });
    }

    if (removed > 0) {
      changes.push('Capped "' + entry.word + '": ' + count + ' → ' + maxAllowed + ' (replaced ' + removed + ')');
      console.log('[POLISH][VOCAB] "' + entry.word + '": replaced ' + removed + '/' + excess);
    }
  }

  if (vocabCapped > 0) {
    changes.push('Total AI-favorite vocabulary capped: ' + vocabCapped + ' replacements');
    console.log('[POLISH][VOCAB] Total capped:', vocabCapped);
  } else {
    console.log('[POLISH][VOCAB] No vocabulary exceeded caps');
  }

  return { vocabCapped, changes };
}

/**
 * Reduce "The" sentence starters across the manuscript.
 * Published fiction typically has 10-15% "The" starters. AI-generated text
 * often exceeds 20%. This function rewrites excess "The [noun]" sentence
 * openers using safe mechanical transformations.
 *
 * Strategies (applied in order of safety):
 *   1. "The [noun] [verb]ed" → "[Noun] [verb]ed" (drop the article when subject is specific)
 *   2. "The [noun] was [adj]" → "[Adj], the [noun]..." (inversion)
 *   3. "The [noun]" at paragraph start → reorder to lead with action/verb
 *
 * Only fires on narration — skips dialogue (inside quotes).
 * Targets: reduce to ≤16% of sentences starting with "The".
 *
 * Mutates loaded[].content in place.
 * Returns { startersFixed, changes }
 */
const NF_MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const NF_TEMPORAL_HEAD = new RegExp('^(?:the\\s+)?(?:early|late|mid)?[- ]?(?:' + NF_MONTHS + '|spring|summer|autumn|fall|winter|1[6-9]\\d\\d|20\\d\\d)\\b', 'i');

function nfSplitSentences(paragraph) {
  return paragraph.match(/[^.!?]+[.!?]+[”"')\]]*\s*|[^.!?]+$/g) || [paragraph];
}

/**
 * ARCH2-4b-d: sentence-starter variation for nonfiction.
 * Strategies, in order of application per chapter until the target is met:
 *  S1  Temporal fronting — a trailing "in/on/by/during/after/before <date>"
 *      adverbial moves to the front: "The order arrived on June 19, 1865."
 *      → "On June 19, 1865, the order arrived." Dates/seasons/years only —
 *      temporal PPs are always adjuncts, so meaning cannot change.
 *  S2  Anaphoric demonstrative — "The <noun>" becomes "That <noun>" ONLY
 *      when the immediately preceding sentence already contains <noun>, so
 *      the referent stays pinned. Capped per chapter to avoid a new tic.
 *  S3  Adjacent join — two consecutive short "The …" sentences join with
 *      ", and the". Grammatical by construction; capped per paragraph.
 * The pass never touches text inside quotation marks.
 */
export function runSentenceStarterVariationNF(loaded, onProgress, { targetPct = 14, triggerPct = 16 } = {}) {
  onProgress?.('Polish (NF): Varying sentence starters…');
  const changes = [];
  let totalFixed = 0;

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    const content = String(f.content || '');
    const allS = content.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
    const totalSentences = allS.length;
    if (totalSentences < 20) continue;
    const theCount = allS.filter((s) => /^\s*The\s/.test(s)).length;
    const currentPct = (theCount / totalSentences) * 100;
    if (currentPct <= triggerPct) continue;
    let toFix = theCount - Math.round(totalSentences * (targetPct / 100));
    if (toFix <= 0) continue;

    let fixed = 0;
    let demonstratives = 0;
    const paragraphs = content.split(/(\n{2,})/);

    for (let pi = 0; pi < paragraphs.length && fixed < toFix; pi += 2) {
      const para = paragraphs[pi];
      if (!para || !para.trim()) continue;
      if ((para.match(/["“”]/g) || []).length > 0 && (para.match(/["“”]/g) || []).length % 2 === 1) continue; // malformed quoting — leave alone
      const sentences = nfSplitSentences(para);
      let joinedThisPara = false;
      let changed = false;

      for (let si = 0; si < sentences.length && fixed < toFix; si++) {
        const sent = sentences[si];
        const trimmed = sent.trim();
        if (!/^The\s/.test(trimmed)) continue;
        if (/["“”]/.test(trimmed)) continue;              // sentence carries a quote — hands off

        // ── S1: temporal fronting ──
        const m = trimmed.match(/^The\s+(.{8,120}?)\s+(in|on|by|during|after|before)\s+((?:the\s+)?[\w’',\- ]{3,40}?)([.;])$/);
        if (m && NF_TEMPORAL_HEAD.test(m[3])) {
          const prep = m[2].charAt(0).toUpperCase() + m[2].slice(1);
          const lead = sent.match(/^\s*/)[0];
          const trail = sent.match(/\s*$/)[0];
          sentences[si] = lead + prep + ' ' + m[3] + ', the ' + m[1] + m[4] + trail;
          fixed++; totalFixed++; changed = true;
          continue;
        }

        // ── S2: anaphoric demonstrative (capped at 4 per chapter) ──
        if (demonstratives < 4 && si > 0) {
          const nounM = trimmed.match(/^The\s+([a-z][\w’'-]*)\s/);
          if (nounM) {
            const noun = nounM[1];
            const prev = sentences[si - 1].toLowerCase();
            if (noun.length >= 4 && prev.includes(' ' + noun.toLowerCase())) {
              const lead = sent.match(/^\s*/)[0];
              const trail = sent.match(/\s*$/)[0];
              sentences[si] = lead + 'That ' + trimmed.slice(4) + trail;
              fixed++; totalFixed++; demonstratives++; changed = true;
              continue;
            }
          }
        }

        // ── S3: adjacent join (max 1 per paragraph) ──
        if (!joinedThisPara && si > 0) {
          const prevTrim = sentences[si - 1].trim();
          if (/^The\s/.test(prevTrim) && /[.]$/.test(prevTrim) && !/["“”]/.test(prevTrim)
              && !/, and /.test(prevTrim) && !/, and /.test(trimmed)
              && !/\b(?:No|Mr|Mrs|Ms|Dr|Gen|Col|Capt|Lt|St|Rev|Jr|Sr|vs|etc)\.\s*$/.test(prevTrim)) {
            const wPrev = prevTrim.split(/\s+/).length;
            const wCur = trimmed.split(/\s+/).length;
            if (wPrev + wCur <= 32 && wPrev >= 6 && wCur >= 6) {
              const lead = sentences[si - 1].match(/^\s*/)[0];
              const trail = sent.match(/\s*$/)[0];
              const joined = prevTrim.slice(0, -1) + ', and the ' + trimmed.slice(4);
              sentences[si - 1] = lead + joined + trail;
              sentences[si] = '';
              fixed++; totalFixed++; joinedThisPara = true; changed = true;
              continue;
            }
          }
        }
      }
      if (changed) paragraphs[pi] = sentences.join('');
    }

    if (fixed > 0) {
      f.content = paragraphs.join('');
      const newS = f.content.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
      const newPct = (newS.filter((s) => /^\s*The\s/.test(s)).length / newS.length) * 100;
      changes.push('Ch.' + chNum + ': NF "The" starters ' + currentPct.toFixed(0) + '% → ' + newPct.toFixed(0) + '% (' + fixed + ' changed)');
    }
  }

  if (totalFixed > 0) console.log('[POLISH][NF-STARTERS] varied ' + totalFixed + ' "The" starters (referent-preserving)');
  return { changes, startersFixed: totalFixed };
}

export function runSentenceStarterVariation(loaded, onProgress) {
  onProgress?.('Polish: Varying sentence starters…');
  const changes = [];
  let startersFixed = 0;

  // Nouns that are usually specific enough to drop "The" (proper-noun-like in context)
  const DROPPABLE_SUBJECTS = /^(door|light|lights|sound|noise|air|room|floor|wall|walls|ceiling|sky|ground|man|woman|boy|girl|voice|machine|screen|city|building|ship|car|vehicle|creature|guard|guards|soldier|soldiers|figure|shadow|world|system|corridor|hallway|tunnel|space|place|water|fire|darkness|silence|crowd|group|team|blade|weapon|gun|knife|sword|ship|boat|clock|bell|wind|rain|storm|fog|mist|sun|moon|path|road|street|field|forest|night|day|morning|evening|pain|fear|anger|rage|truth|thought|memory|image|idea|question|answer|problem|effect|result|impact|device|unit|scanner|monitor|display|console|panel|hatch|gate|chair|table|bed|bench|bar|counter|station|cell|cage|ring|arena|grid|node|signal|pulse|hum|glow|beam|field|barrier|surface|metal|stone|concrete|glass)\b/i;

  // Words that should NOT have "The" dropped (would be grammatically wrong)
  const KEEP_THE = /^(first|last|next|same|only|other|entire|whole|rest|most|few|two|three|four|five|old|new|young|big|small|little|great|long|short|real|main|final|second|third|upper|lower|inner|outer|far|near|left|right|front|back|top|bottom|best|worst)\b/i;

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';

    // Split into sentences (respecting paragraph boundaries)
    const sentences = f.content.split(/(?<=[.!?])\s+/);
    const totalSentences = sentences.filter(s => s.trim().length > 10).length;
    const theStarters = sentences.filter(s => /^\s*The\s/i.test(s) && s.trim().length > 10).length;
    const currentPct = theStarters / totalSentences * 100;

    // Only process chapters above 16%
    if (currentPct <= 16 || totalSentences < 20) continue;

    // Target: reduce to 14%
    const targetThe = Math.round(totalSentences * 0.14);
    const toFix = theStarters - targetThe;
    if (toFix <= 0) continue;

    let fixed = 0;

    // Work on the full content — replace sentence-initial "The" patterns
    f.content = f.content.replace(
      /(?<=[.!?\n])\s*(The )/g,
      (match, theWord, offset) => {
        if (fixed >= toFix) return match;

        // Skip if inside dialogue
        const before200 = f.content.substring(Math.max(0, offset - 200), offset);
        const openQ = (before200.match(/[\u201c"]/g) || []).length;
        const closeQ = (before200.match(/[\u201d"]/g) || []).length;
        if (openQ > closeQ) return match;

        // Get the rest of the sentence (next 60 chars)
        const afterThe = f.content.substring(offset + match.length, offset + match.length + 60);
        const firstWord = afterThe.split(/\s/)[0] || '';

        // Don't drop "The" before adjectives that need it
        if (KEEP_THE.test(firstWord)) return match;

        // Strategy 1: Drop "The" when subject is a specific/concrete noun
        // "The door slammed" → "Door slammed" is wrong.
        // But "The scanner beeped" in a chapter where scanner was already established → ok.
        // Safest: only drop for already-established subjects (hard to detect).
        // Instead: restructure.

        // Strategy 2: If pattern is "The [noun] [was/were/had/could]", try inversion
        const wasMatch = afterThe.match(/^(\w+)\s+(was|were|had|could|would|did|felt|seemed|looked|appeared|remained|sat|stood|lay|hung)\s+(.{0,30})/);
        if (wasMatch && DROPPABLE_SUBJECTS.test(wasMatch[1])) {
          // "The door was heavy" → no good simple inversion. Skip "was [adj]" — too risky.
          // "The scanner beeped" → hard to restructure mechanically.
          // Best safe option: replace "The" with a demonstrative or possessive
          const alternatives = ['That ', 'A ', 'One ', 'Its ', 'This '];
          const alt = alternatives[fixed % alternatives.length];
          fixed++;
          startersFixed++;
          return match.replace('The ', alt);
        }

        // Strategy 3: For any other "The [noun]" pattern, cycle through alternatives
        if (DROPPABLE_SUBJECTS.test(firstWord)) {
          const alternatives = ['A ', 'One ', 'That '];
          const alt = alternatives[fixed % alternatives.length];
          fixed++;
          startersFixed++;
          return match.replace('The ', alt);
        }

        return match;
      }
    );

    if (fixed > 0) {
      const newTheStarters = f.content.split(/(?<=[.!?])\s+/).filter(s => /^\s*The\s/i.test(s) && s.trim().length > 10).length;
      const newPct = newTheStarters / totalSentences * 100;
      changes.push('Ch.' + chNum + ': "The" starters ' + currentPct.toFixed(0) + '% → ' + newPct.toFixed(0) + '% (' + fixed + ' changed)');
    }
  }

  if (startersFixed > 0) {
    console.log('[POLISH] Sentence starter variation: changed ' + startersFixed + ' "The" starters');
  }

  // ── Phase 2: "It was" / "It wasn't" opener caps ──
  // "It was" at sentence start is the #1 overused opener in AI prose.
  // Safe deletion: "It was [adjective]." → "[Adjective]." only for short fragments.
  // For longer sentences: skip (too risky to restructure mechanically).
  let itWasFixed = 0;
  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    const itWasMatches = f.content.match(/(?<=^|[.!?\n]\s*)It was(?:n't)?\s/g);
    if (!itWasMatches || itWasMatches.length <= 3) continue; // 3 per chapter is fine
    const excess = itWasMatches.length - 3;
    let removed = 0;

    f.content = f.content.replace(
      /(?<=[.!?\n]\s*)(It was(?:n't)?\s+)(\w+)/g,
      (match, opener, nextWord, offset) => {
        if (removed >= excess) return match;
        // Skip if inside dialogue
        const before = f.content.substring(Math.max(0, offset - 200), offset);
        const oQ = (before.match(/[\u201c"]/g) || []).length;
        const cQ = (before.match(/[\u201d"]/g) || []).length;
        if (oQ > cQ) return match;
        // Only delete "It was" before adjectives/adverbs (safe restructure)
        // Keep "It was [Name]" and "It was [noun that continues]"
        if (/^(a|the|an|not|his|her|their|its|there|here|then|also|still|only|just|like|as|what|who|where|when|how|why|all|every|no|nothing|something|everything)$/i.test(nextWord)) return match;
        // Safe: capitalize the next word and drop "It was "
        removed++;
        itWasFixed++;
        return nextWord.charAt(0).toUpperCase() + nextWord.slice(1);
      }
    );
    if (removed > 0) {
      changes.push('Ch.' + chNum + ': "It was" starters capped (' + removed + ' removed)');
    }
  }

  // ── Phase 3: Pronoun + weak verb opener caps ──
  // Cap "He looked/was/had/didn't" and "She looked/was/had" openers at 2 per chapter
  const pronounOpeners = [
    { pattern: /(?<=[.!?\n]\s*)(He looked\s)/g, name: 'He looked', max: 2 },
    { pattern: /(?<=[.!?\n]\s*)(He was\s)/g, name: 'He was', max: 2 },
    { pattern: /(?<=[.!?\n]\s*)(He had\s)/g, name: 'He had', max: 2 },
    { pattern: /(?<=[.!?\n]\s*)(He didn't\s)/g, name: "He didn't", max: 2 },
    { pattern: /(?<=[.!?\n]\s*)(She looked\s)/g, name: 'She looked', max: 2 },
    { pattern: /(?<=[.!?\n]\s*)(She was\s)/g, name: 'She was', max: 2 },
    { pattern: /(?<=[.!?\n]\s*)(She had\s)/g, name: 'She had', max: 2 },
    { pattern: /(?<=[.!?\n]\s*)(They were\s)/g, name: 'They were', max: 2 },
  ];
  let pronounFixed = 0;
  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    for (const po of pronounOpeners) {
      const matches = f.content.match(po.pattern);
      if (!matches || matches.length <= po.max) continue;
      const excess = matches.length - po.max;
      let removed = 0;
      f.content = f.content.replace(po.pattern, (match, opener, offset) => {
        if (removed >= excess) return match;
        // Skip dialogue
        const before = f.content.substring(Math.max(0, offset - 200), offset);
        const oQ = (before.match(/[\u201c"]/g) || []).length;
        const cQ = (before.match(/[\u201d"]/g) || []).length;
        if (oQ > cQ) return match;
        removed++;
        pronounFixed++;
        // Delete the pronoun, keep the verb (capitalize it)
        // "He looked at" → "Looked at" — not perfect but breaks monotony
        const verb = opener.trim().split(/\s+/)[1];
        return verb.charAt(0).toUpperCase() + verb.slice(1) + ' ';
      });
      if (removed > 0) {
        changes.push('Ch.' + chNum + ': "' + po.name + '" starters capped (' + removed + ' removed)');
      }
    }
  }

  // ── Phase 4: Consecutive same-opener streak breaker ──
  // If 3+ consecutive narration paragraphs start with the same word, rewrite the middle ones
  let streaksFixed = 0;
  for (const f of loaded) {
    const paragraphs = f.content.split('\n');
    const newParagraphs = [...paragraphs];
    let i = 0;
    while (i < paragraphs.length - 2) {
      const a = paragraphs[i].trim();
      const b = paragraphs[i + 1].trim();
      const c = paragraphs[i + 2].trim();
      // Skip empty lines, dialogue, short lines
      if (!a || !b || !c || a.length < 30 || b.length < 30 || c.length < 30) { i++; continue; }
      if (a.startsWith('\u201c') || a.startsWith('"') || b.startsWith('\u201c') || b.startsWith('"') || c.startsWith('\u201c') || c.startsWith('"')) { i++; continue; }
      const aWord = a.split(/\s/)[0].toLowerCase();
      const bWord = b.split(/\s/)[0].toLowerCase();
      const cWord = c.split(/\s/)[0].toLowerCase();
      if (aWord === bWord && bWord === cWord) {
        // Fix the MIDDLE paragraph — swap first two words or delete the opener word
        const bWords = newParagraphs[i + 1].trim().split(/\s+/);
        if (bWords.length >= 3 && /^(the|a|an|he|she|it|his|her|its|they|their)$/i.test(bWords[0])) {
          // Try to restructure: if "The [noun] [verb]" → "[Noun] [verb]"
          if (/^the$/i.test(bWords[0]) && bWords.length >= 2) {
            bWords[1] = bWords[1].charAt(0).toUpperCase() + bWords[1].slice(1);
            bWords.shift();
            newParagraphs[i + 1] = bWords.join(' ');
            streaksFixed++;
          }
        }
      }
      i++;
    }
    if (streaksFixed > 0) {
      f.content = newParagraphs.join('\n');
    }
  }
  if (streaksFixed > 0) {
    changes.push('Consecutive same-opener streaks: ' + streaksFixed + ' fixed');
  }

  if (itWasFixed > 0) console.log('[POLISH] "It was" starters capped:', itWasFixed);
  if (pronounFixed > 0) console.log('[POLISH] Pronoun opener starters capped:', pronounFixed);
  if (streaksFixed > 0) console.log('[POLISH] Same-opener streaks fixed:', streaksFixed);

  return { startersFixed: startersFixed + itWasFixed + pronounFixed + streaksFixed, changes };
}