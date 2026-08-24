/**
 * AI-favorite vocabulary frequency caps + sentence starter variation.
 * Shared between fiction and nonfiction polish pipelines.
 */

import { getSetting } from './settingsRead.js'; // WAVE5-SETTINGS
import { isNonfictionProject } from './projectType.js'; // NFCLASS-6

// POLISHSAFE-4: exported so the writer prompt (banned-vocabulary prevention
// block) and the regenerate lane (banned-vocab detector) can read the same
// list this scanner flags against.
export const CAPPED_VOCABULARY = [
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
export const BANNED_WORDS_HARD_REMOVE = [
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
 * POLISHSAFE-4: scan AI-favorite vocabulary across loaded chapters and FLAG
 * every occurrence beyond its allowance — never substitute. Word/phrase
 * substitution is outside rule 0.2/2's whitelist (typography, a/an
 * agreement, DIALOGREPAIR-2, CANON-2B, reported structural removals).
 * `loaded[].content` is never mutated by this function.
 * Returns { vocabCapped: 0, changes }
 */
export function runVocabCaps(loaded, onProgress, options = {}) {
  onProgress?.('Polish: Scanning AI-favorite vocabulary…');
  const changes = [];
  const vocabCapped = 0;
  const isNF = isNonfictionProject(options?.project);

  const fullText = loaded.map(f => f.content).join('\n\n');
  const totalWords = fullText.split(/\s+/).filter(Boolean).length;

  console.log('[POLISH][VOCAB] Step starting. Chapters: ' + loaded.length + ', totalWords: ' + totalWords + ', isNF: ' + isNF);

  // ── PHASE 0: banned words (zero tolerance) — flag-only ──
  let bannedFlagged = 0;
  for (const entry of BANNED_WORDS_HARD_REMOVE) {
    const regex = new RegExp('\\b' + entry.word + '\\b', 'gi');
    const count = (fullText.match(regex) || []).length;
    if (count > 0) {
      bannedFlagged += count;
      changes.push('BANNED "' + entry.word + '": ' + count + ' occurrence(s) flagged - substitution retired (POLISHSAFE-4)');
      console.log('[POLISH][VOCAB] BANNED "' + entry.word + '": ' + count + ' flagged only - POLISHSAFE-4');
    }
  }
  if (bannedFlagged > 0) {
    console.log('[POLISH][VOCAB] Total banned words flagged:', bannedFlagged);
  }

  // ── PHASE 1: AI-favorite vocabulary caps (per-10K-words thresholds) — flag-only ──
  let cappedFlagged = 0;
  for (const entry of CAPPED_VOCABULARY) {
    const effectiveMax = (isNF && entry.nfMax !== undefined) ? entry.nfMax : entry.max;
    const regex = new RegExp('\\b' + entry.word + '\\b', 'gi');

    const count = (fullText.match(regex) || []).length;
    if (!count) continue;

    const maxAllowed = Math.max(1, Math.round(effectiveMax * totalWords / 10000));

    console.log('[POLISH][VOCAB] "' + entry.word + '": found=' + count + ', effectiveMax=' + effectiveMax + '/10K, maxAllowed=' + maxAllowed + ', excess=' + Math.max(0, count - maxAllowed));

    if (count <= maxAllowed) continue;

    const excess = count - maxAllowed;
    cappedFlagged += excess;
    changes.push('Capped "' + entry.word + '": ' + count + ' found, ' + maxAllowed + ' allowed, ' + excess + ' flagged - substitution retired (POLISHSAFE-4)');
    console.log('[POLISH][VOCAB] "' + entry.word + '": ' + excess + ' excess flagged only - POLISHSAFE-4');
  }

  if (bannedFlagged + cappedFlagged > 0) {
    changes.push('Total AI-favorite vocabulary flagged: ' + (bannedFlagged + cappedFlagged) + ' occurrence(s), substitution retired (POLISHSAFE-4)');
    console.log('[POLISH][VOCAB] Total flagged:', bannedFlagged + cappedFlagged);
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
export function runSentenceStarterVariationNF(loaded, onProgress, opts = {}) {
  // WAVE5-SETTINGS: target % comes from Settings unless the caller overrides.
  const userTarget = Math.min(30, Math.max(6, Number(getSetting('the_starter_target', 14))));
  const { targetPct = userTarget, triggerPct = userTarget + 2 } = opts;
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

        // ── S1: temporal fronting — REMOVED (POLISHFIX-7B). The rewrite
        // `The …… in <temporal>.` → `In <temporal>, the ……` is blind to
        // prepositional-phrase attachment: when the temporal binds to an inner
        // noun ("since its construction in 1915"), fronting it states something
        // false. Measured on a live NF polish save 2026-08-07. PP attachment is
        // not decidable by regex; starter variety on NF now comes only from S2
        // (referent-checked demonstrative) and S3 (guarded adjacent join).

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
          // FICTIONFIX-2: article swaps corrupt referents ("The clock
          // ticked" → "One clock ticked" — Songbird blind test, 27 wounds).
          // Swapping is disabled; safe variation lives in the NF-safe pass.
          return match;
        }

        // Strategy 3 removed (FICTIONFIX-2): article cycling corrupted
        // referents. The NF-safe pass handles "The" reduction for all modes.
        if (DROPPABLE_SUBJECTS.test(firstWord)) {
          return match;
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

    // ITWAS-1: this cap used to delete the opener before ANY non-stoplisted
    // word \u2014 "It was indeed JB, his coat flapping wildly\u2026" became "Indeed JB,
    // his coat flapping wildly\u2026" (a fragment) in a live manuscript, 30 times a
    // pass. Deletion is only safe for a SHORT, adjective-only sentence:
    // "It was quiet." \u2192 "Quiet." Anything with a comma, a name, an adverb
    // opener, or more than six words after the opener is left alone.
    const ITWAS_ADVERB_OPENERS = /^(?:indeed|simply|also|only|just|still|then|almost|nearly|barely|really|truly|clearly|obviously|exactly|probably|certainly|definitely|merely|hardly|scarcely|quite|rather|somewhat|too|very|so|even|already|never|always|often|sometimes|now|later|soon)$/i;
    f.content = f.content.replace(
      /(?<=[.!?\n]\s*)(It was(?:n't)?\s+)(\w+)([^.!?\n]*)([.!?])/g,
      (match, opener, nextWord, rest, terminal, offset) => {
        if (removed >= excess) return match;
        // Skip if inside dialogue
        const before = f.content.substring(Math.max(0, offset - 200), offset);
        const oQ = (before.match(/[\u201c"]/g) || []).length;
        const cQ = (before.match(/[\u201d"]/g) || []).length;
        if (oQ > cQ) return match;
        // Only delete "It was" before adjectives/adverbs (safe restructure)
        // Keep "It was [Name]" and "It was [noun that continues]"
        if (/^(a|the|an|not|his|her|their|its|there|here|then|also|still|only|just|like|as|what|who|where|when|how|why|all|every|no|nothing|something|everything)$/i.test(nextWord)) return match;
        // ITWAS-1 guards
        if (ITWAS_ADVERB_OPENERS.test(nextWord)) return match; // "It was indeed\u2026"
        if (/^[A-Z]/.test(nextWord)) return match; // "It was JB\u2026" / "It was Zin who\u2026"
        if (/[,;:\u2014\u2013]/.test(rest)) return match; // a clause follows \u2014 deleting the opener strands it
        if (/\b[A-Z][a-z]+\b/.test(rest)) return match; // a name in the remainder
        if ((nextWord + rest).trim().split(/\s+/).length > 6) return match; // not a short fragment
        // POLISHSAFE-3: deletion RETIRED. "It was quiet." -> "Quiet." and "It
        // was a cold morning." -> "A cold morning." are fragments, not fixes --
        // the same delete-the-opener corruption already retired for telling tags
        // and pronoun openers. Flag-only; the excess ships to the LLM polish lane.
        removed++;
        return match;
      }
    );
    if (removed > 0) {
      changes.push('Ch.' + chNum + ': "It was" openers over cap (' + removed + ' flagged) - deletion retired (POLISHSAFE-3)');
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
      // POLISHSAFE-2: deletion RETIRED. Deleting the pronoun left a subjectless
      // sentence ("He looked at" → "Looked at"; "She was wearing" → "Was
      // wearing"; "They were ready" → "Were ready") — 40 per pass, 290 measured
      // in one shipped 81k-word manuscript, quoted by an external audit as
      // "generation corruption". Monotony is a rewrite problem, not a deletion
      // problem. Flag-only now; the excess is reported for the LLM polish lane.
      pronounFixed += 0;
      changes.push('Ch.' + chNum + ': ⚠️ "' + po.name + '" starters over cap (' + matches.length + ' vs ' + po.max + ') — flagged only, deletion retired (POLISHSAFE-2)');
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
          // POLISHSAFE-3: restructure RETIRED. "The wind howled." -> "Wind
          // howled." is a mechanical opener deletion (article dropped); the same
          // class as the retired caps above. Flag-only, no mutation.
          if (/^the$/i.test(bWords[0]) && bWords.length >= 2) {
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
    changes.push('Consecutive same-opener streaks: ' + streaksFixed + ' flagged (restructure retired, POLISHSAFE-3)');
  }

  if (itWasFixed > 0) console.log('[POLISH] "It was" starters capped:', itWasFixed);
  if (pronounFixed > 0) console.log('[POLISH] Pronoun opener starters capped:', pronounFixed);
  if (streaksFixed > 0) console.log('[POLISH] Same-opener streaks fixed:', streaksFixed);

  return { startersFixed: startersFixed + itWasFixed + pronounFixed + streaksFixed, changes };
}