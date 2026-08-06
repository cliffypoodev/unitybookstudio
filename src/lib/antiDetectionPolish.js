/**
 * Anti-AI Detection Polish Steps (A–E)
 * Based on forensic AI detection audit findings.
 * Run AFTER vocab caps, BEFORE hanging quote fix and final output.
 * Pure regex/string operations — no AI calls.
 */

import { runExtraPolishChecks } from './extraPolishChecks.js';
import { ABBREVIATION_TOKENS } from './safeUppercase.js';
import { isNonfictionProject } from './projectType.js';

/**
 * Abbreviation-aware sentence splitter.
 * Splits text on [.!?] followed by whitespace, but treats a period as
 * NON-terminal when the preceding token is a whitelisted abbreviation
 * (e.g., a.m., p.m., Dr., etc.).  This prevents "The a.m. recordings"
 * from being split into two fragments.
 *
 * @param {string} text
 * @returns {string[]} Array of sentence strings (each may still end with punctuation).
 */
function splitSentencesAbbreviationAware(text) {
  // First, do a naive split
  const raw = text.split(/(?<=[.!?])\s+/);
  // Then merge back any fragment whose predecessor ends with an abbreviation period
  const result = [];
  for (let i = 0; i < raw.length; i++) {
    const seg = raw[i];
    if (result.length === 0) {
      result.push(seg);
      continue;
    }
    const prev = result[result.length - 1];
    // Check if the previous segment ends with an abbreviation period
    // Extract the last token before the trailing period
    const trailingMatch = prev.match(/(\S+)\.\s*$/);
    if (trailingMatch) {
      // Strip trailing period to get the raw token, then lowercase for lookup
      const token = trailingMatch[1].replace(/\.$/, '').toLowerCase();
      if (ABBREVIATION_TOKENS.has(token)) {
        // This period belongs to an abbreviation — merge back
        result[result.length - 1] = prev + ' ' + seg;
        continue;
      }
    }
    result.push(seg);
  }
  return result;
}

// ── METAPHOR FAMILIES ──────────────────────────────────────────────────────
const METAPHOR_FAMILIES = {
  math: ['math','calculate','equation','formula','compute','arithmetic','algebra','sum','subtract','divide','multiply','decimal','fraction','percentage','variable','theorem','calculus','coefficient','algorithm'],
  map: ['map','compass','coordinates','latitude','longitude','cartography','territory','terrain','navigate','chart','course','bearing','waypoint','topography','meridian'],
  architecture: ['architecture','blueprint','foundation','scaffold','framework','structure','pillar','cornerstone','edifice','construct','buttress','façade','archway','masonry'],
  machine: ['machine','mechanism','gear','engine','cog','piston','calibrate','circuit','wiring','lever','pulley','apparatus','clockwork','hydraulic'],
  body: ['bone','marrow','spine','skeleton','sinew','tendon','ligament','cartilage','membrane','tissue','organ','vein','artery','capillary'],
  water: ['current','tide','wave','flood','drown','surface','depths','undertow','eddy','ripple','shore','harbor','anchor','drift','submerge'],
  fire: ['flame','ember','ignite','smolder','blaze','inferno','spark','kindle','scorch','burn','ash','furnace','pyre','flicker'],
  light: ['illuminate','shadow','glow','radiance','gleam','beacon','prism','refract','eclipse','twilight','dawn','dusk','glint','glimmer'],
  textile: ['thread','weave','fabric','stitch','unravel','seam','loom','warp','weft','tangle','fray','knot','spool','hem'],
  garden: ['root','seed','bloom','wither','prune','cultivate','harvest','sprout','vine','thorn','petal','soil','compost','graft'],
};

// ── COPING MECHANISM PATTERNS ──────────────────────────────────────────────
const COPING_PATTERNS = [
  { rx: /\b(?:rubbed?|traced?|ran \w+ (?:thumb|finger)s?) (?:across|over|along) (?:the |a |his |her |their )?\w+/gi, name: 'trace/rub surface' },
  { rx: /\b(?:clenched?|clenching|tightened?|tightening|balled?) (?:his|her|their|the) (?:fists?|jaw|jaws|teeth|hands?|fingers?)/gi, name: 'clench fist/jaw' },
  { rx: /\b(?:rubbed?|touched?|fingered?) (?:the |his |her |their )(?:scar|callous|callus|ridge|mark|tattoo)/gi, name: 'touch scar/mark' },
  { rx: /\b(?:cracked?) (?:his|her|their) (?:knuckles|neck|fingers)/gi, name: 'crack joints' },
  { rx: /\b(?:tugged?|pulled?) (?:at |on )?(?:the |his |her |their )(?:collar|sleeve|hem|cuff|earlobe|hair)/gi, name: 'tug clothing/hair' },
  { rx: /\b(?:bit|chewed?) (?:his|her|their) (?:lip|nails?|cheek|tongue)/gi, name: 'bite lip/nail' },
  { rx: /\b(?:drummed?|tapped?|rapped?) (?:his|her|their) (?:fingers?|nails?) (?:on|against|along)/gi, name: 'drum/tap fingers' },
  { rx: /\b(?:bounced?|jiggled?) (?:his|her|their) (?:leg|knee|foot)/gi, name: 'bounce leg' },
  { rx: /\b(?:squeezed?|gripped?) (?:the |his |her |their )(?:bridge of (?:his|her|their) nose|temples?|forehead)/gi, name: 'pinch bridge/temple' },
];

// ── STEP A: Triplet List Detector ──────────────────────────────────────────
/**
 * Detect "X, Y, and Z" three-item sensory/descriptive lists and break
 * the pattern by removing the weakest (middle) item when possible.
 */
function detectAndFixTriplets(loaded) {
  let fixed = 0;
  const changes = [];

  // Pattern 1: "X, Y, and Z" with optional articles
  const tripletAndRx = /\b(?:the |a |an )?(\w+ \w+), (?:the |a |an )?(\w+ \w+), and (?:the |a |an )?(\w+ \w+)/gi;
  // Pattern 2: "X, Y, Z" (no "and") — three short phrases separated by commas
  const tripletCommaRx = /\b(?:the |a |an )?(\w+ \w+), (?:the |a |an )?(\w+ \w+), (?:the |a |an )?(\w+ \w+)(?=[.,;:\s])/gi;
  // Pattern 3: "a X that Y, a X that Y, a X that Y" — parallel "a/the NOUN that/who/which" triplets
  const tripletParallelRx = /\b((?:a|an|the) \w+ (?:that|who|which) \w+(?:\s\w+)?), ((?:a|an|the) \w+ (?:that|who|which) \w+(?:\s\w+)?), (?:and )?((?:a|an|the) \w+ (?:that|who|which) \w+(?:\s\w+)?)/gi;
  // Pattern 4: Three short fragment sentences in a row: "X. Y. Z." (each under 6 words)
  const tripletFragmentRx = /([A-Z][^.!?]{3,40})\.\s+([A-Z][^.!?]{3,40})\.\s+([A-Z][^.!?]{3,40})\./g;

  for (const f of loaded) {
    let chapterFixed = 0;

    // Fix pattern 1: "X, Y, and Z" → remove middle item
    f.content = f.content.replace(tripletAndRx, (match, item1, item2, item3) => {
      if (/^[A-Z][a-z]+ [A-Z]/.test(item1)) return match;
      if (chapterFixed >= 15) return match;
      chapterFixed++; fixed++;
      return match.replace(`, ${item2},`, ',');
    });

    // Fix pattern 2: "X, Y, Z" (no and) → remove middle item
    f.content = f.content.replace(tripletCommaRx, (match, item1, item2, item3) => {
      if (/^[A-Z][a-z]+ [A-Z]/.test(item1)) return match;
      if (chapterFixed >= 15) return match;
      // Skip if this was already caught by pattern 1 (contains "and")
      if (/,\s*and\s/i.test(match)) return match;
      chapterFixed++; fixed++;
      return match.replace(`, ${item2},`, ',').replace(`, ${item2}`, '');
    });

    // Fix pattern 3: parallel "a X that Y" triplets → remove middle
    f.content = f.content.replace(tripletParallelRx, (match, item1, item2, item3) => {
      if (chapterFixed >= 15) return match;
      chapterFixed++; fixed++;
      return match.replace(`, ${item2},`, ',').replace(`, ${item2}`, '');
    });

    // Fix pattern 4: three short fragment sentences → merge first two with semicolon
    // CONVERGENCE GUARDS:
    //   (a) Never join when either sentence already contains an em-dash or semicolon
    //       (this creates a fixed point: joined output can never be re-joined)
    //   (b) Never join across dialogue or quoted material
    //   (c) Compute all candidate joins in ONE pass over the original sentence list,
    //       then apply them — never rescan mutated text
    //   (d) Use semicolon (not em-dash) for the join — no downstream step converts
    //       semicolons, so the result is stable across re-runs. Em-dashes conflicted
    //       with the em-dash density reducer (Step 9c), which converted them to commas,
    //       re-creating new short fragments on the next pass.
    {
      const blocks = f.content.split(/(\n{2,})/);
      let chapterChanged = false;
      for (let b = 0; b < blocks.length; b++) {
        if (blocks[b].trim() === '') continue;
        
        const sentences = splitSentencesAbbreviationAware(blocks[b]);
        const joins = []; // indices into sentences[] to merge [i] with [i+1]
        for (let i = 0; i < sentences.length - 2; i++) {
          const s1 = sentences[i], s2 = sentences[i + 1], s3 = sentences[i + 2];
          if (!s1 || !s2 || !s3) continue;
          // All three must be short fragments (under 6 words each)
          if (s1.split(/\s+/).length > 6 || s2.split(/\s+/).length > 6 || s3.split(/\s+/).length > 6) continue;
          // Guard (a): skip if either sentence already contains an em-dash or semicolon
          if (s1.includes('\u2014') || s1.includes(' — ') || s1.includes(';')) continue;
          if (s2.includes('\u2014') || s2.includes(' — ') || s2.includes(';')) continue;
          // Guard (b): skip if either sentence contains dialogue/quoted material
          if (/["\u201c\u201d]/.test(s1) || /["\u201c\u201d]/.test(s2)) continue;
          // Chapter cap
          if (chapterFixed >= 15) break;
          joins.push(i);
          chapterFixed++; fixed++;
          i += 2; // skip past the triple to avoid overlapping joins
        }
        // Apply joins in reverse order to preserve indices
        for (let j = joins.length - 1; j >= 0; j--) {
          const idx = joins[j];
          const merged = sentences[idx].replace(/[.!?]+$/, '') + '; ' + sentences[idx + 1].charAt(0).toLowerCase() + sentences[idx + 1].slice(1);
          sentences.splice(idx, 2, merged);
        }
        if (joins.length > 0) {
          blocks[b] = sentences.join(' ');
          chapterChanged = true;
        }
        if (chapterFixed >= 15) break;
      }
      if (chapterChanged) {
        f.content = blocks.join('');
      }
    }

    if (chapterFixed > 0) {
      changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': broke ' + chapterFixed + ' triplet lists');
    }
  }
  return { fixed, changes };
}

// ── STEP B: Parallel Sentence Detector ─────────────────────────────────────
/**
 * Detect 3+ consecutive sentences starting with the same word.
 * Restructure the third by prepending a transitional opener.
 *
 * TWO OPENER POOLS:
 *   - FICTION: narrative/temporal openers like "For a moment," "Without thinking,"
 *     — these read natural inside scene-based prose where characters act and
 *     time passes moment-to-moment.
 *   - NONFICTION: expository/logical openers like "In practice,", "Notice that,"
 *     — these fit explanatory writing where ideas build on each other.
 *
 * Using fiction openers on nonfiction produces the "For a moment, every ATM fee."
 * catastrophe: narrative time language inserted into finance/business content
 * creates grammatical fragments AND triggers AI-detector "hallmark phrase"
 * flags. The Wealth Glitch was the canary.
 */
const FICTION_TRANSITION_OPENERS = [
  'Instead, ', 'By then, ', 'Still, ', 'And yet ', 'Even so, ',
  'Meanwhile, ', 'Before long, ', 'Without thinking, ', 'At last, ',
  'In truth, ', 'For a moment, ', 'This time, ', 'Not that it mattered — ',
];

const NONFICTION_TRANSITION_OPENERS = [
  'In practice, ', 'Notice that ', 'The key is, ', 'That said, ',
  'Put simply, ', 'In short, ', 'More importantly, ', 'Consider: ',
  'Of course, ', 'In fact, ', 'The result is, ', 'By contrast, ',
];

// Kept for backwards compatibility. Callers should now prefer passing isNF
// so the function selects the right pool. Unused when isNF is specified.
const TRANSITION_OPENERS = FICTION_TRANSITION_OPENERS;

// Words we're safe to STRIP from the start of a sentence when inserting
// a transition opener. These are leading conjunctions/adverbs that function
// only as connectors — dropping them leaves a grammatically complete
// sentence. Anything NOT in this list (He, She, They, The, A, etc.) is
// potentially the grammatical subject — stripping it would destroy the
// sentence. Previously this function always stripped the first word,
// which produced broken fragments like "Without thinking, will be high-yield"
// (where the original "It" was thrown away). See v4 scan findings.
const REMOVABLE_SENTENCE_STARTERS = new Set([
  'but', 'and', 'so', 'then', 'yet', 'nor', 'or',
  'still', 'instead', 'however', 'therefore', 'thus',
  'additionally', 'furthermore', 'moreover', 'meanwhile',
]);

function detectAndFixParallelSentences(loaded, isNF = false) {
  let fixed = 0;
  const changes = [];
  const MAX_PASSES = 10; // safety: never loop forever

  // Pick the opener pool matching the project type. Mixing fiction openers
  // into nonfiction produced fragments like "For a moment, every ATM fee."
  // — grammatically broken AND AI-detectable.
  const openerPool = isNF ? NONFICTION_TRANSITION_OPENERS : FICTION_TRANSITION_OPENERS;

  for (const f of loaded) {
    const chNum = f.chapter.chapter_number || '?';
    let chapterFixed = 0;

    // Loop until no more parallel runs found or MAX_PASSES reached
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const sentences = splitSentencesAbbreviationAware(f.content);
      if (sentences.length < 3) break;
      let passFixed = 0;

      // Work backwards to avoid index shifts
      for (let i = sentences.length - 1; i >= 2; i--) {
        const getFirst = (s) => (s || '').split(/\s/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
        const w1 = getFirst(sentences[i - 2]);
        const w2 = getFirst(sentences[i - 1]);
        const w3 = getFirst(sentences[i]);
        if (!w1 || !w2 || !w3) continue;
        if (w1 === w2 && w2 === w3) {
          const original = sentences[i];
          const opener = openerPool[Math.floor(Math.random() * openerPool.length)];
          const firstWord = getFirst(original);

          let newSentence = null;
          if (REMOVABLE_SENTENCE_STARTERS.has(firstWord)) {
            // Safe path: the first word is a connector — replace it with the
            // transition opener. Original meaning preserved.
            const rest = original.replace(/^\S+\s*/, '');
            if (rest.length > 5) {
              newSentence = opener + rest.charAt(0).toLowerCase() + rest.slice(1);
            }
          } else {
            // Preservation path: the first word is the sentence's subject (He,
            // She, They, The, A, etc.). DO NOT strip it. Prepend the opener
            // and lowercase the existing first letter so it reads naturally:
            //   "He walks."  →  "At last, he walks."
            // This still breaks the parallel run because the sentence now
            // starts with the opener's first word, not the repeated subject.
            newSentence = opener + original.charAt(0).toLowerCase() + original.slice(1);
          }

          if (newSentence && newSentence !== original) {
            f.content = f.content.replace(original, newSentence);
            fixed++;
            chapterFixed++;
            passFixed++;
          }
        }
      }

      // If this pass fixed nothing, no more parallel runs exist — stop
      if (passFixed === 0) break;
      console.log('[PARALLEL] Ch.' + chNum + ' pass ' + (pass + 1) + ': fixed ' + passFixed + ' (total: ' + chapterFixed + ')');
    }

    if (chapterFixed > 0) {
      changes.push('Ch.' + chNum + ': fixed ' + chapterFixed + ' parallel sentence runs');
    }
  }
  return { fixed, changes };
}

// ── STEP C: Staccato Run Detector ──────────────────────────────────────────
/**
 * Detect 4+ consecutive short sentences (< 8 words each) and merge
 * the middle pair with a conjunction.
 */
const MERGE_CONJUNCTIONS = [' — ', ', and ', ', but ', ', yet ', ', then '];

function detectAndFixStaccato(loaded) {
  let fixed = 0;
  const changes = [];
  const MAX_PASSES = 10; // safety: never loop forever

  for (const f of loaded) {
    const chNum = f.chapter.chapter_number || '?';
    let chapterFixed = 0;

    // Loop until no more staccato runs found or MAX_PASSES reached
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const sentences = splitSentencesAbbreviationAware(f.content);
      if (sentences.length < 4) break;
      let passFixed = 0;

      // Scan for runs of 4+ short sentences
      for (let i = 3; i < sentences.length; i++) {
        const run = [sentences[i - 3], sentences[i - 2], sentences[i - 1], sentences[i]];
        const allShort = run.every(s => s && s.split(/\s+/).length < 8);
        if (!allShort) continue;
        // Merge sentences [i-2] and [i-1] (the middle pair)
        const s1 = sentences[i - 2];
        const s2 = sentences[i - 1];
        if (!s1 || !s2) continue;
        const conj = MERGE_CONJUNCTIONS[Math.floor(Math.random() * MERGE_CONJUNCTIONS.length)];
        const merged = s1.replace(/[.!?]+$/, '') + conj + s2.charAt(0).toLowerCase() + s2.slice(1);
        const originalPair = s1 + ' ' + s2;
        if (f.content.includes(originalPair)) {
          f.content = f.content.replace(originalPair, merged);
          fixed++;
          chapterFixed++;
          passFixed++;
          // Skip ahead past the merged area to avoid double-processing
          i += 2;
        }
      }

      // If this pass fixed nothing, no more staccato runs exist — stop
      if (passFixed === 0) break;
      console.log('[STACCATO] Ch.' + chNum + ' pass ' + (pass + 1) + ': fixed ' + passFixed + ' (total: ' + chapterFixed + ')');
    }

    if (chapterFixed > 0) {
      changes.push('Ch.' + chNum + ': merged ' + chapterFixed + ' staccato runs');
    }
  }
  return { fixed, changes };
}

// ── STEP D: Metaphor Repetition Detector ───────────────────────────────────
/**
 * Track metaphor family usage per chapter. If any family exceeds 5 uses,
 * flag the excess instances.
 */
function detectMetaphorRepetition(loaded) {
  let flagged = 0;
  const changes = [];

  for (const f of loaded) {
    const contentLower = f.content.toLowerCase();
    const chNum = f.chapter.chapter_number || '?';

    for (const [family, words] of Object.entries(METAPHOR_FAMILIES)) {
      let count = 0;
      for (const word of words) {
        const rx = new RegExp('\\b' + word + '\\b', 'gi');
        const matches = contentLower.match(rx);
        if (matches) count += matches.length;
      }
      if (count > 5) {
        const excess = count - 5;
        flagged += excess;
        changes.push('Ch.' + chNum + ': ⚠️ "' + family + '" metaphor family used ' + count + 'x (max 5, excess ' + excess + ')');
        console.log('[POLISH] Ch.' + chNum + ': "' + family + '" metaphor family:', count, '(excess:', excess + ')');
      }
    }
  }
  return { flagged, changes };
}

// ── STEP E: Coping Mechanism Counter ───────────────────────────────────────
/**
 * Track repeated physical tells/coping behaviors across the FULL manuscript.
 * If any single behavior appears more than 3 times total, replace excess
 * with alternative physical expressions.
 */
const ALTERNATIVE_ANXIETY = [
  'shifted weight from foot to foot',
  'pressed a thumb into the opposite palm',
  'swallowed hard',
  'glanced toward the exit',
  'went very still',
  'exhaled through the nose',
  'adjusted the strap of the bag',
  'smoothed a crease in the fabric',
  'let the silence stretch',
  'crossed and uncrossed the arms',
  'counted to three internally',
  'stared at a point just past the speaker',
];

function detectAndFixCopingMechanisms(loaded) {
  let fixed = 0;
  const changes = [];

  // First pass: count each pattern across all chapters
  const globalCounts = {};
  for (const pat of COPING_PATTERNS) {
    globalCounts[pat.name] = { total: 0, locations: [] };
    for (let ci = 0; ci < loaded.length; ci++) {
      const matches = loaded[ci].content.match(pat.rx);
      if (matches) {
        globalCounts[pat.name].total += matches.length;
        for (const m of matches) {
          globalCounts[pat.name].locations.push({ chapterIdx: ci, match: m });
        }
      }
    }
  }

  // Second pass: for patterns exceeding 3, replace excess occurrences
  let altIdx = 0;
  for (const pat of COPING_PATTERNS) {
    const info = globalCounts[pat.name];
    if (info.total <= 3) continue;
    const excess = info.total - 3;
    changes.push('Manuscript: "' + pat.name + '" appears ' + info.total + 'x (max 3, replacing ' + excess + ')');
    console.log('[POLISH] Coping "' + pat.name + '":', info.total + 'x. Replacing', excess, 'excess.');

    // Replace from the end to preserve first 3 appearances
    let replaced = 0;
    const locationsReversed = [...info.locations].reverse();
    for (const loc of locationsReversed) {
      if (replaced >= excess) break;
      const f = loaded[loc.chapterIdx];
      const alt = ALTERNATIVE_ANXIETY[altIdx % ALTERNATIVE_ANXIETY.length];
      altIdx++;
      // Replace just the first occurrence of this exact match in this chapter
      const idx = f.content.indexOf(loc.match);
      if (idx !== -1) {
        f.content = f.content.substring(0, idx) + alt + f.content.substring(idx + loc.match.length);
        replaced++;
        fixed++;
      }
    }
  }

  return { fixed, changes };
}

/**
 * Flag-only version of coping mechanism detection.
 * Counts repeated physical tells but does NOT replace them.
 * Returns flagged count and change messages for the polish report.
 */
function detectCopingMechanismsFlag(loaded) {
  let flagged = 0;
  const changes = [];

  const globalCounts = {};
  for (const pat of COPING_PATTERNS) {
    globalCounts[pat.name] = 0;
    for (const f of loaded) {
      const matches = f.content.match(pat.rx);
      if (matches) globalCounts[pat.name] += matches.length;
    }
  }

  for (const pat of COPING_PATTERNS) {
    const total = globalCounts[pat.name];
    if (total <= 3) continue;
    const excess = total - 3;
    flagged += excess;
    changes.push('⚠️ "' + pat.name + '" appears ' + total + 'x across manuscript (max 3, ' + excess + ' excess — review recommended)');
    console.log('[POLISH] Coping "' + pat.name + '":', total + 'x (flagged, not auto-replaced)');
  }

  return { fixed: 0, flagged, changes };
}

// ── STEP F: Diagnostic Syntax Detector ─────────────────────────────────────
/**
 * Scan for systems-check / technical-manual language used to describe
 * human internal states. Flag for manual rewrite (context-dependent).
 */
const DIAGNOSTIC_PATTERNS = [
  /\bcognitive functions?\s*:/gi,
  /\bmotor control\s*:/gi,
  /\bstatus\s*:\s*(?:operational|nominal|compromised|degraded|critical)/gi,
  /\b(?:operational|nominal)\b/gi,
  /\bprotocol\s+(?:available|engaged|initiated|active)/gi,
  /\bsystems?\s+check\b/gi,
  /\btermination protocol\b/gi,
  /\bneural pathways?\s*:/gi,
  /\bresponse parameters?\s*:/gi,
];

function detectDiagnosticSyntax(loaded) {
  let flagged = 0;
  const changes = [];

  for (const f of loaded) {
    const chNum = f.chapter.chapter_number || '?';
    let chFlagged = 0;
    for (const rx of DIAGNOSTIC_PATTERNS) {
      const matches = f.content.match(rx);
      if (matches) {
        chFlagged += matches.length;
        flagged += matches.length;
      }
    }
    if (chFlagged > 0) {
      changes.push('Ch.' + chNum + ': ⚠️ ' + chFlagged + ' diagnostic-syntax phrases (manual review recommended)');
      console.log('[POLISH] Ch.' + chNum + ': ' + chFlagged + ' diagnostic-syntax instances');
    }
  }
  return { flagged, changes };
}

// ── STEP G: Meta-Commentary Detector ───────────────────────────────────────
/**
 * Scan for sentences where narration explicitly explains its own theme
 * or philosophical meaning. Flag for removal or rewrite.
 */
const META_COMMENTARY_PATTERNS = [
  /\bthe system'?s justification\b/gi,
  /\bthis is what \w+ means\b/gi,
  /\bthe logic of (?:the |this |their )?\w+/gi,
  /\bwhat this reveals is\b/gi,
  /\bthe implication is\b/gi,
  /\bthis demonstrates that\b/gi,
  /\bthe meaning (?:of|behind) (?:this|the|his|her|their)\b/gi,
  /\bin other words,? (?:the|this|what)\b/gi,
  /\bthe lesson (?:here|was|is)\b/gi,
  /\bthe point (?:was|is|being) that\b/gi,
];

function detectMetaCommentary(loaded) {
  let flagged = 0;
  const changes = [];

  for (const f of loaded) {
    const chNum = f.chapter.chapter_number || '?';
    let chFlagged = 0;
    for (const rx of META_COMMENTARY_PATTERNS) {
      const matches = f.content.match(rx);
      if (matches) {
        chFlagged += matches.length;
        flagged += matches.length;
      }
    }
    if (chFlagged > 0) {
      changes.push('Ch.' + chNum + ': ⚠️ ' + chFlagged + ' meta-commentary phrases (theme-explaining, review recommended)');
      console.log('[POLISH] Ch.' + chNum + ': ' + chFlagged + ' meta-commentary instances');
    }
  }
  return { flagged, changes };
}

// ── STEP H: Quantified Emotion Detector ────────────────────────────────────
/**
 * Scan for emotional or internal states described through numbers, scores,
 * or resource/accounting language. Flag when >2 per chapter.
 */
const QUANTIFIED_EMOTION_WORDS = [
  'ledger', 'tally', 'score', 'points', 'resource', 'deficit',
  'surplus', 'quota', 'inventory', 'balance sheet', 'audit',
  'taxed resource', 'cost-benefit', 'net gain', 'net loss',
];

function detectQuantifiedEmotion(loaded) {
  let flagged = 0;
  const changes = [];

  for (const f of loaded) {
    const chNum = f.chapter.chapter_number || '?';
    const contentLower = f.content.toLowerCase();
    let chCount = 0;

    for (const word of QUANTIFIED_EMOTION_WORDS) {
      const rx = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      const matches = contentLower.match(rx);
      if (matches) chCount += matches.length;
    }

    if (chCount > 2) {
      const excess = chCount - 2;
      flagged += excess;
      changes.push('Ch.' + chNum + ': ⚠️ ' + chCount + ' quantified-emotion terms (max 2, excess ' + excess + ')');
      console.log('[POLISH] Ch.' + chNum + ': ' + chCount + ' quantified-emotion terms (excess:', excess + ')');
    }
  }
  return { flagged, changes };
}

// ── STEP I: Rhythm Symmetry Detector ───────────────────────────────────────
/**
 * Detect runs of 3+ consecutive sentences with nearly identical word counts
 * (within 1 word) AND similar grammatical openers. Flag for restructuring.
 */
function detectRhythmSymmetry(loaded) {
  let flagged = 0;
  const changes = [];

  for (const f of loaded) {
    const chNum = f.chapter.chapter_number || '?';
    const sentences = splitSentencesAbbreviationAware(f.content).filter(s => s.trim().length > 0);
    if (sentences.length < 3) continue;

    let chFlagged = 0;
    let runLength = 1;

    for (let i = 1; i < sentences.length; i++) {
      const prevWords = sentences[i - 1].split(/\s+/).length;
      const currWords = sentences[i].split(/\s+/).length;
      const prevFirst = (sentences[i - 1].split(/\s/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
      const currFirst = (sentences[i].split(/\s/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');

      const sameLength = Math.abs(prevWords - currWords) <= 1;
      const sameOpener = prevFirst === currFirst;

      if (sameLength && (sameOpener || Math.abs(prevWords - currWords) === 0)) {
        runLength++;
      } else {
        if (runLength >= 3) {
          chFlagged++;
          flagged++;
        }
        runLength = 1;
      }
    }
    // Check final run
    if (runLength >= 3) { chFlagged++; flagged++; }

    if (chFlagged > 0) {
      changes.push('Ch.' + chNum + ': ⚠️ ' + chFlagged + ' symmetrical sentence runs (3+ identical rhythm, review recommended)');
      console.log('[POLISH] Ch.' + chNum + ': ' + chFlagged + ' symmetrical sentence runs');
    }
  }
  return { flagged, changes };
}

// ── STEP J: Emotional Math Detector ────────────────────────────────────────
/**
 * Scan for internal monologue/narration that describes emotions using math,
 * calculation, accounting, or quantification language.
 * Excludes literal world-mechanic uses (dialogue, system readouts).
 */
const EMOTIONAL_MATH_PATTERNS = [
  /\bcalculation(?:s)?\b/gi,
  /\bequation(?:s)?\b/gi,
  /\bmetric(?:s)?\b/gi,
  /\bledger\b/gi,
  /\bdeficit\b/gi,
  /\bsurplus\b/gi,
  /\btaxed resource\b/gi,
  /\bspace between calculations\b/gi,
  /\bquantif(?:y|ied|ying)\b/gi,
  /\bmeasured?\b/gi,
  /\bbalance sheet\b/gi,
  /\bcost-benefit\b/gi,
  /\bnet (?:gain|loss)\b/gi,
  /\bpoint(?:s)? on (?:a|the|his|her|their) ledger\b/gi,
  /\binvisible ledger\b/gi,
  /\barithmetic of\b/gi,
  /\baccounting of\b/gi,
];

// Hard-remove phrases: ALWAYS emotional math, never world-mechanic
const EMOTIONAL_MATH_HARD_REMOVE = [
  { rx: /\bspace between calculations\b/gi, name: 'space between calculations' },
  { rx: /\bbreath was a taxed resource\b/gi, name: 'breath was a taxed resource' },
  { rx: /\bstep was a point on a ledger\b/gi, name: 'step was a point on a ledger' },
  { rx: /\bledger in (?:his|her|their) mind\b/gi, name: 'ledger in his/her mind' },
  { rx: /\bpoints? on (?:a |the |an )?(?:invisible )?ledger\b/gi, name: 'points on a ledger' },
  { rx: /\binvisible ledger\b/gi, name: 'invisible ledger' },
  { rx: /\beach breath was a\b/gi, name: 'each breath was a [resource]' },
];

function detectEmotionalMath(loaded) {
  let flagged = 0;
  let hardRemoved = 0;
  const changes = [];

  for (const f of loaded) {
    const chNum = f.chapter.chapter_number || '?';
    let chFlagged = 0;

    // Step 1: Hard-remove phrases that are NEVER world-mechanic
    for (const hr of EMOTIONAL_MATH_HARD_REMOVE) {
      const matches = f.content.match(hr.rx);
      if (matches && matches.length > 0) {
        // Remove the containing sentence for each match
        for (const m of matches) {
          // Find the sentence containing this phrase and remove/flag it
          const idx = f.content.indexOf(m);
          if (idx !== -1) {
            // Find sentence boundaries
            const before = f.content.lastIndexOf('.', idx);
            const after = f.content.indexOf('.', idx + m.length);
            if (before !== -1 && after !== -1) {
              const sentence = f.content.substring(before + 1, after + 1).trim();
              if (sentence.length < 200) { // safety: don't remove huge chunks
                f.content = f.content.replace(sentence, '');
                f.content = f.content.replace(/\n\n\n+/g, '\n\n').replace(/  +/g, ' ');
                hardRemoved++;
              }
            }
          }
        }
        changes.push('Ch.' + chNum + ': ❌ removed ' + matches.length + 'x "' + hr.name + '" (hard emotional-math)');
        console.log('[POLISH] Ch.' + chNum + ': hard-removed "' + hr.name + '" x' + matches.length);
      }
    }

    // Step 2: Flag remaining emotional-math patterns (context-aware)
    const sentences = splitSentencesAbbreviationAware(f.content);
    for (const sentence of sentences) {
      if (/^\s*[""\u201C]/.test(sentence)) continue;
      if (/\b(?:screen|display|readout|interface|terminal|console|currency|credits?|coins?)\b/i.test(sentence)) continue;

      for (const rx of EMOTIONAL_MATH_PATTERNS) {
        rx.lastIndex = 0;
        if (rx.test(sentence)) {
          chFlagged++;
          flagged++;
          break;
        }
      }
    }

    if (chFlagged > 0) {
      changes.push('Ch.' + chNum + ': ⚠️ ' + chFlagged + ' emotional-math phrases (feelings described through calculation/accounting)');
      console.log('[POLISH] Ch.' + chNum + ': ' + chFlagged + ' emotional-math instances');
    }
  }
  return { flagged, hardRemoved, changes };
}

// ── STEP K: Telling Tag Reducer ────────────────────────────────────────────
/**
 * Count and auto-fix excess telling tags per chapter.
 * Caps: "felt" ≤5, "knew" ≤3, "thought" ≤2, "realized" ≤2 per chapter.
 * Excess tags are removed, rendering the content as free indirect style.
 */
const TELLING_TAG_CAPS = [
  { rx: /\b(he|she|they|[A-Z]\w+)\s+felt\s+/gi, name: 'felt', cap: 2 },
  { rx: /\b(he|she|they|[A-Z]\w+)\s+knew\s+/gi, name: 'knew', cap: 2 },
  { rx: /\b(he|she|they|[A-Z]\w+)\s+thought\s+/gi, name: 'thought', cap: 1 },
  { rx: /\b(he|she|they|[A-Z]\w+)\s+realized\s+/gi, name: 'realized', cap: 1 },
  { rx: /\b(he|she|they|[A-Z]\w+)\s+wondered\s+/gi, name: 'wondered', cap: 1 },
  { rx: /\b(he|she|they|[A-Z]\w+)\s+understood\s+/gi, name: 'understood', cap: 1 },
  { rx: /\b(he|she|they|[A-Z]\w+)\s+sensed\s+/gi, name: 'sensed', cap: 1 },
];

function detectAndFixTellingTags(loaded) {
  let fixed = 0;
  let flagged = 0;
  const changes = [];

  for (const f of loaded) {
    const chNum = f.chapter.chapter_number || '?';
    let chFixed = 0;

    for (const tag of TELLING_TAG_CAPS) {
      // Count occurrences
      const matches = f.content.match(tag.rx);
      if (!matches || matches.length <= tag.cap) continue;

      const excess = matches.length - tag.cap;
      flagged += excess;

      // Replace excess by dropping the telling tag (keep first `cap` occurrences)
      let instanceIdx = 0;
      let chReplaced = 0;
      f.content = f.content.replace(tag.rx, (match, subject) => {
        instanceIdx++;
        if (instanceIdx <= tag.cap || chReplaced >= excess) return match;
        chReplaced++;
        chFixed++;
        fixed++;
        // Drop the tag: "He felt the cold" → "The cold" (capitalize next word)
        const afterTag = match.substring(match.indexOf(tag.name) + tag.name.length).trimStart();
        if (afterTag.length > 0) {
          return afterTag.charAt(0).toUpperCase() + afterTag.slice(1);
        }
        // Fallback: just capitalize what follows
        return '';
      });

      if (chReplaced > 0) {
        changes.push('Ch.' + chNum + ': removed ' + chReplaced + 'x "' + tag.name + '" telling tags (cap ' + tag.cap + ', had ' + matches.length + ')');
        console.log('[POLISH] Ch.' + chNum + ': removed ' + chReplaced + 'x "' + tag.name + '" (had ' + matches.length + ', cap ' + tag.cap + ')');
      }
    }
  }
  return { fixed, flagged, changes };
}

// ── PUBLIC: Run all anti-detection polish steps ────────────────────────────

/**
 * Run Steps A–K on loaded chapter data.
 * Insert AFTER vocab caps / ChatGPT caps / dialogue caps,
 * BEFORE sentence starter variation and AI detection resistance.
 *
 * Steps A (triplets), B (parallels), C (staccato), I (rhythm symmetry): ALL project types
 * Steps D (metaphor), E (coping), F (diagnostic), G (meta), H (quantified), J (emotional math), K (telling tags): FICTION ONLY
 *
 * For ANTHOLOGY: uses the underlying book_type to decide — fiction anthology gets fiction rules,
 * nonfiction anthology gets nonfiction rules.
 *
 * @param {Array<{chapter: object, content: string, original: string}>} loaded
 * @param {function} [onProgress]
 * @param {object} [options]
 * @param {object} [options.project] - Project record, used to determine fiction vs nonfiction
 * @returns {{ tripletsFixed, parallelsFixed, staccatoFixed, metaphorsFlagged, copingFixed, diagnosticFlagged, metaFlagged, quantifiedFlagged, symmetryFlagged, emotionalMathFlagged, tellingTagsFixed, tellingTagsFlagged, changes: string[] }}
 */
export function runAntiDetectionPolish(loaded, onProgress, options = {}) {
  const allChanges = [];
  const project = options.project || {};
  // NFCLASS-5: one authority for fiction vs nonfiction — a raw book_type check
  // here read {project_type:'nonfiction'} records as fiction and ran the
  // fiction-only auto-rewrites on factual prose.
  const isNF = isNonfictionProject(project);
  const isFiction = !isNF;

  // Step A: Triplet list rewrites — RETIRED FOR ALL PROJECT TYPES (TRIPLETRETIRE-1)
  // detectAndFixTriplets deleted the middle item of factual three-item lists
  // ("the freight sheds, the firehouse, and the elevated railway trestle" lost
  // "the firehouse") and its fragment-merge rule semicolon-merged initials and
  // citation lines ("later. W. E. B. Du Bois" -> "later; w. E. B; du Bois").
  // Measured 2026-08-06 on the real pipeline. A list is content, not an AI
  // tell; deletion is not variation. Same retirement as Steps B and C.
  const tripletResult = { fixed: 0, changes: [] };
  console.log('[POLISH] Step A (triplet rewrites): RETIRED — content deletion measured 2026-08-06; flag-only via proofreader');

  // Step B: Parallel sentence detection — RETIRED FOR ALL PROJECT TYPES
  // Injected transition openers at 12-26x each across long manuscripts,
  // creating AI-detection fingerprints far worse than the original parallel
  // sentences. Replaced by flag-only detection in the AI proofreader.
  let parallelResult = { fixed: 0, changes: [] };
  console.log('[POLISH] Step B (parallel sentences): RETIRED — replaced by proofreader flag');

  // Step C: Staccato run detection — RETIRED FOR ALL PROJECT TYPES
  // Merged short sentences with random conjunctions (", and ", ", but ",
  // ", yet ", " — "). This is a creative writing decision that a regex
  // tool cannot make safely. The merges often produced awkward prose that
  // a human writer would never write. Replaced by flag-only detection.
  let staccatoResult = { fixed: 0, changes: [] };
  console.log('[POLISH] Step C (staccato merger): RETIRED — replaced by proofreader flag');

  // Steps D–H, J, K: FICTION ONLY
  let metaphorResult = { flagged: 0, changes: [] };
  let copingResult = { fixed: 0, changes: [] };
  let diagnosticResult = { flagged: 0, changes: [] };
  let metaResult = { flagged: 0, changes: [] };
  let quantifiedResult = { flagged: 0, changes: [] };
  let emotionalMathResult = { flagged: 0, hardRemoved: 0, changes: [] };
  let tellingTagResult = { fixed: 0, flagged: 0, changes: [] };

  if (isFiction) {
    // Step D: Metaphor repetition detection (flag only, no auto-replace)
    onProgress?.('Polish: Scanning metaphor repetition…');
    metaphorResult = detectMetaphorRepetition(loaded);
    allChanges.push(...metaphorResult.changes);

    // Step E: Coping mechanism counter — NOW FLAG-ONLY
    // Previously auto-replaced excess coping behaviors with alternatives from
    // a canned list (ALTERNATIVE_ANXIETY). This traded one AI-detectable tic
    // for another. Now counts and flags only — author decides how to vary.
    onProgress?.('Polish: Scanning coping mechanism repetition…');
    copingResult = detectCopingMechanismsFlag(loaded);
    allChanges.push(...copingResult.changes);

    // Step F: Diagnostic syntax detection (flag only)
    onProgress?.('Polish: Scanning diagnostic syntax…');
    diagnosticResult = detectDiagnosticSyntax(loaded);
    allChanges.push(...diagnosticResult.changes);

    // Step G: Meta-commentary detection (flag only)
    onProgress?.('Polish: Scanning meta-commentary…');
    metaResult = detectMetaCommentary(loaded);
    allChanges.push(...metaResult.changes);

    // Step H: Quantified emotion detection (flag only)
    onProgress?.('Polish: Scanning quantified emotion language…');
    quantifiedResult = detectQuantifiedEmotion(loaded);
    allChanges.push(...quantifiedResult.changes);

    // Step J: Emotional math detection (hard-remove + flag)
    onProgress?.('Polish: Scanning emotional math language…');
    emotionalMathResult = detectEmotionalMath(loaded);
    allChanges.push(...emotionalMathResult.changes);

    // Step K: Telling tag reduction (auto-fix)
    onProgress?.('Polish: Reducing telling tags…');
    tellingTagResult = detectAndFixTellingTags(loaded);
    allChanges.push(...tellingTagResult.changes);
  }

  // Step I: Rhythm symmetry detection — ALL project types
  onProgress?.('Polish: Scanning rhythm symmetry…');
  const symmetryResult = detectRhythmSymmetry(loaded);
  allChanges.push(...symmetryResult.changes);

  // Step L (NEW): Extra polish checks — em-dash density, negative antithesis,
  // cross-manuscript echoes, a/an article fixes, dialogue-tag tics.
  // Fired for ALL project types; mix of fix + flag operations.
  const extraResult = runExtraPolishChecks(loaded, onProgress);
  allChanges.push(...extraResult.changes);

  return {
    tripletsFixed: tripletResult.fixed,
    parallelsFixed: parallelResult.fixed,
    staccatoFixed: staccatoResult.fixed,
    metaphorsFlagged: metaphorResult.flagged,
    copingFixed: copingResult.fixed,
    diagnosticFlagged: diagnosticResult.flagged,
    metaFlagged: metaResult.flagged,
    quantifiedFlagged: quantifiedResult.flagged,
    symmetryFlagged: symmetryResult.flagged,
    emotionalMathFlagged: emotionalMathResult.flagged,
    tellingTagsFixed: tellingTagResult.fixed,
    tellingTagsFlagged: tellingTagResult.flagged,
    // New extras
    emDashFixed: extraResult.emDashFixed,
    emDashFlagged: extraResult.emDashFlagged,
    antithesisFlagged: extraResult.antithesisFlagged,
    echoesFlagged: extraResult.echoesFlagged,
    articlesFixed: extraResult.articlesFixed,
    tagLoopsFlagged: extraResult.tagLoopsFlagged,
    changes: allChanges,
  };
}