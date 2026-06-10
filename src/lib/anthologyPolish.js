/**
 * Anthology Polish — cross-chapter analysis pass for anthology projects.
 * Runs AFTER the standard per-chapter polish.
 *
 * Steps:
 *  1. Cross-chapter phrase deduplication (modifies text, uses LLM)
 *  2. Structural arc tagging (report only)
 *  3. Ending variety check (report only)
 *  4. Pronoun distribution report (report only)
 *  5. Contamination detector (report only)
 *  6. Length normalization report (report only)
 */

import { countWords } from '@/lib/autonovel';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';

// ── STEP 1: Cross-Chapter Phrase Deduplication ────────────────────────

const CROSS_CHAPTER_PHRASES = [
  // Atmospheric / "something shifted" family
  { pattern: /\bsomething shifted\b/gi, name: 'something shifted' },
  { pattern: /\bsomething changed\b/gi, name: 'something changed' },
  { pattern: /\bthe air felt different\b/gi, name: 'the air felt different' },
  { pattern: /\bthe air changed\b/gi, name: 'the air changed' },
  { pattern: /\ba weight settled\b/gi, name: 'a weight settled' },
  { pattern: /\bthe weight of\b/gi, name: 'the weight of' },
  { pattern: /\bthe silence stretched\b/gi, name: 'the silence stretched' },
  { pattern: /\bthe world narrowed\b/gi, name: 'the world narrowed' },

  // Body-language clichés
  { pattern: /\b(?:their|his|her) throat tightened\b/gi, name: 'throat tightened' },
  { pattern: /\b(?:they|he|she) didn'?t answer\b/gi, name: "didn't answer" },
  { pattern: /\b(?:they|he|she) (?:released|let out) a breath\b/gi, name: 'released a breath' },
  { pattern: /\b(?:their|his|her) (?:hands|fingers) trembl(?:ed|ing)\b/gi, name: 'hands trembling' },

  // Time / context
  { pattern: /\bfor the first time in years\b/gi, name: 'for the first time in years' },
  { pattern: /\bwithout thinking\b/gi, name: 'without thinking' },

  // Narrator asides / signature tics (added in response to Digital Equity Tribunal
  // showing "not that it mattered" at 53x across 17 stories, and other exposé-style
  // narrator asides at similar frequencies)
  { pattern: /\bnot that it matter(?:ed|s)\b/gi, name: 'not that it mattered' },
  { pattern: /\bfor what it was worth\b/gi, name: 'for what it was worth' },
  { pattern: /\bif you could call it that\b/gi, name: 'if you could call it that' },
  { pattern: /\bwhatever that meant\b/gi, name: 'whatever that meant' },
  { pattern: /\bat least in theory\b/gi, name: 'at least in theory' },
  { pattern: /\bin the end, it\b/gi, name: 'in the end, it' },

  // Construction / rhythm tics
  { pattern: /\bsomething else\s*[—–-]\s*something\b/gi, name: 'something else — something' },
  { pattern: /\bnot quite [^,.\n]{1,30},\s*not quite\b/gi, name: 'not quite X, not quite Y' },
  { pattern: /\bthis was not a[^.!?\n]{1,40}[.!?]\s+It was a\b/gi, name: 'this was not a X. It was a Y' },

  // Movement clichés
  { pattern: /\b(?:she|he|they) walked to the window\b/gi, name: 'walked to the window' },
  { pattern: /\b(?:she|he|they) walked to the door\b/gi, name: 'walked to the door' },
  { pattern: /\b(?:her|his|their) reflection in the\b/gi, name: 'reflection in the' },
];

/**
 * Auto-discover cross-chapter phrase echoes that aren't in the hardcoded list.
 *
 * Scans for 3-5 word sequences that appear 4+ times across 3+ chapters, then
 * returns them as ad-hoc phrase definitions compatible with scanPhraseOccurrences.
 * This catches project-specific tics the hardcoded list doesn't know about.
 *
 * Filters out:
 *   - Phrases already covered by a hardcoded definition
 *   - Phrases dominated by stopwords (of the, to the, in the, etc.)
 *   - Phrases starting with stopwords or pronouns — too common, noise
 *
 * @param {Array} loaded - chapter objects with .content
 * @returns {Array} ad-hoc CROSS_CHAPTER_PHRASES-shaped definitions, capped at 20
 */
function autoDiscoverEchoPhrases(loaded) {
  const SKIP_STARTS = new Set([
    'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'and', 'but', 'or', 'so',
    'with', 'from', 'as', 'is', 'was', 'were', 'be', 'been', 'being',
    'he', 'she', 'it', 'they', 'we', 'i', 'you',
    'his', 'her', 'their', 'its', 'my', 'your', 'our',
    'this', 'that', 'these', 'those',
    'if', 'when', 'while', 'because', 'though', 'although',
    // Also skip common verbs that start pedestrian phrases — we want the
    // distinctive ones, not "looked at the X" / "sat in the Y"
    'looked', 'stared', 'watched', 'saw', 'heard',
    'sat', 'stood', 'walked', 'ran', 'moved', 'turned',
    'reached', 'took', 'got', 'put', 'gave', 'made',
    'went', 'came', 'said', 'told', 'asked',
    'there', 'here', 'now', 'then',
  ]);

  // Phrases containing only pedestrian verb+prep constructions — even if
  // frequent, they're the connective tissue of prose, not tics. Filter them.
  const PEDESTRIAN_BIGRAM_RX = /^(looked|stared|watched|turned|reached|glanced|gazed) (at|to|toward|at the|into|down|up|away)\b/;

  const ngramCount = new Map();
  const ngramChapters = new Map();

  for (let i = 0; i < loaded.length; i++) {
    const content = (loaded[i].content || '').toLowerCase();
    const tokens = content.match(/[a-z']+/g) || [];

    for (let L = 3; L <= 5; L++) {
      for (let j = 0; j <= tokens.length - L; j++) {
        if (SKIP_STARTS.has(tokens[j])) continue;
        const ng = tokens.slice(j, j + L).join(' ');
        if ((ng.match(/\bthe\b/g) || []).length >= 2) continue;
        if (PEDESTRIAN_BIGRAM_RX.test(ng)) continue;
        ngramCount.set(ng, (ngramCount.get(ng) || 0) + 1);
        if (!ngramChapters.has(ng)) ngramChapters.set(ng, new Set());
        ngramChapters.get(ng).add(i);
      }
    }
  }

  const hardcodedNames = new Set(CROSS_CHAPTER_PHRASES.map((p) => p.name.toLowerCase()));
  const discovered = [];

  for (const [ng, count] of ngramCount) {
    // Tightened thresholds — 5+ occurrences across 4+ chapters, not 4/3.
    // At 20-chapter anthology scale, appearing in 4+ chapters is a real pattern,
    // not coincidence.
    if (count < 5) continue;
    const chapCount = ngramChapters.get(ng).size;
    if (chapCount < 4) continue;

    // Phrases that are just proper-noun-free phrases of the manuscript's
    // theme (e.g. "digital equity tribunal", "terms of service") are likely
    // INTENTIONAL world-building, not tics. Skip phrases that appear to be
    // nominal (all non-verbs). Quick heuristic: if the phrase contains no
    // past-tense verb marker ("ed ", "s ", "'t "), treat it as nominal.
    const looksVerbal = /(\b\w+ed\b|\b\w+'t\b|\bwas\b|\bwere\b|\bhad\b|\bhas\b)/.test(ng);
    const looksNominal = !looksVerbal;
    if (looksNominal && ng.split(' ').length <= 3) continue;

    let overlap = false;
    for (const hc of hardcodedNames) {
      if (hc.includes(ng) || ng.includes(hc)) { overlap = true; break; }
    }
    if (overlap) continue;

    const escaped = ng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    discovered.push({
      pattern: new RegExp('\\b' + escaped + '\\b', 'gi'),
      name: ng,
      _discovered: true,
      _count: count,
      _chapters: chapCount,
    });
  }

  discovered.sort((a, b) => (b._count || 0) - (a._count || 0));
  // Cap at 10 to avoid runaway LLM calls. The biggest tics come first.
  return discovered.slice(0, 10);
}

/**
 * Find which chapters contain each target phrase, returning
 * { phraseName, chapterOccurrences: [{ chIdx, chNum, matches: [string] }] }
 */
function scanPhraseOccurrences(loaded) {
  const results = [];
  for (const def of CROSS_CHAPTER_PHRASES) {
    const chapterOccurrences = [];
    for (let i = 0; i < loaded.length; i++) {
      const matches = loaded[i].content.match(def.pattern);
      if (matches && matches.length > 0) {
        chapterOccurrences.push({
          chIdx: i,
          chNum: loaded[i].chapter.chapter_number || (i + 1),
          matches,
        });
      }
    }
    if (chapterOccurrences.length >= 3) {
      results.push({ phraseName: def.name, pattern: def.pattern, chapterOccurrences });
    }
  }
  return results;
}

/**
 * Use LLM to generate contextually unique rewrites for duplicate phrases.
 * Batches chapters in groups of 10 max to stay within context window.
 */
async function rewriteDuplicatePhrases(loaded, duplicates, onProgress) {
  const changes = [];
  let totalRewritten = 0;

  for (const dup of duplicates) {
    // Keep the first chapter's occurrence untouched
    const chaptersToRewrite = dup.chapterOccurrences.slice(1);
    if (!chaptersToRewrite.length) continue;

    // Batch in groups of 10
    const batches = [];
    for (let i = 0; i < chaptersToRewrite.length; i += 10) {
      batches.push(chaptersToRewrite.slice(i, i + 10));
    }

    const alreadyUsedRewrites = [];

    for (const batch of batches) {
      onProgress(`Anthology Polish: Rewriting "${dup.phraseName}" (${batch.length} chapters)…`);

      // Build context for LLM
      const excerpts = batch.map(occ => {
        // Extract ~200 chars around each match for context
        const content = loaded[occ.chIdx].content;
        const idx = content.search(dup.pattern);
        if (idx === -1) return null;
        const start = Math.max(0, idx - 100);
        const end = Math.min(content.length, idx + occ.matches[0].length + 100);
        return {
          chNum: occ.chNum,
          excerpt: content.substring(start, end),
          phrase: occ.matches[0],
        };
      }).filter(Boolean);

      if (!excerpts.length) continue;

      const prompt = `You are a fiction editor. The phrase "${dup.phraseName}" appears in too many chapters of this anthology. For each excerpt below, provide a contextually unique replacement that fits the specific character and scene. Each replacement must be DIFFERENT from all others.

${alreadyUsedRewrites.length > 0 ? `Already used rewrites (do NOT repeat these): ${alreadyUsedRewrites.join(', ')}\n` : ''}
${excerpts.map((e, i) => `[${i + 1}] Chapter ${e.chNum}: "...${e.excerpt}..."\nTarget phrase: "${e.phrase}"`).join('\n\n')}

Return a JSON object with a "rewrites" array where each element has:
- "index": the number from above (1-indexed)
- "original": the exact phrase to replace
- "replacement": the new contextually unique phrase (same approximate length, natural tone)`;

      try {
        const result = await invokeLLMWithRetry({
          prompt,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              rewrites: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'number' },
                    original: { type: 'string' },
                    replacement: { type: 'string' },
                  },
                  required: ['index', 'original', 'replacement'],
                },
              },
            },
            required: ['rewrites'],
          },
        });

        const rewrites = result?.rewrites || [];
        for (const rw of rewrites) {
          const excerptRef = excerpts[rw.index - 1];
          if (!excerptRef || !rw.replacement) continue;
          const occ = batch.find(b => b.chNum === excerptRef.chNum);
          if (!occ) continue;

          const f = loaded[occ.chIdx];
          // Replace first occurrence only
          const before = f.content;
          f.content = f.content.replace(rw.original, rw.replacement);
          if (f.content !== before) {
            totalRewritten++;
            alreadyUsedRewrites.push(rw.replacement);
            changes.push(`Ch.${occ.chNum}: "${rw.original}" → "${rw.replacement}"`);
          }
        }
      } catch (err) {
        console.warn('[ANTHOLOGY-POLISH] LLM rewrite failed for "' + dup.phraseName + '":', err.message);
        changes.push(`⚠️ LLM rewrite failed for "${dup.phraseName}": ${err.message}`);
      }
    }
  }

  return { changes, totalRewritten };
}

export async function runCrossChapterDedup(loaded, onProgress) {
  onProgress('Anthology Polish: Scanning cross-chapter phrases…');
  const hardcodedDuplicates = scanPhraseOccurrences(loaded);

  // Auto-discover project-specific signature tics (3-5 word phrases appearing
  // 4+ times across 3+ chapters). These are merged with the hardcoded hits.
  onProgress('Anthology Polish: Auto-discovering project-specific phrase tics…');
  const discoveredDefs = autoDiscoverEchoPhrases(loaded);
  const discoveredDuplicates = [];
  for (const def of discoveredDefs) {
    const chapterOccurrences = [];
    for (let i = 0; i < loaded.length; i++) {
      const matches = loaded[i].content.match(def.pattern);
      if (matches && matches.length > 0) {
        chapterOccurrences.push({
          chIdx: i,
          chNum: loaded[i].chapter.chapter_number || (i + 1),
          matches,
        });
      }
    }
    if (chapterOccurrences.length >= 3) {
      discoveredDuplicates.push({
        phraseName: def.name,
        pattern: def.pattern,
        chapterOccurrences,
        _discovered: true,
      });
    }
  }

  const duplicates = [...hardcodedDuplicates, ...discoveredDuplicates];

  console.warn('[ANTHOLOGY-POLISH] Phrase dedup:',
    hardcodedDuplicates.length, 'hardcoded +',
    discoveredDuplicates.length, 'auto-discovered =',
    duplicates.length, 'total targets');

  if (!duplicates.length) {
    return { changes: ['No cross-chapter phrase duplicates found (3+ chapter threshold).'], totalRewritten: 0, duplicates: [] };
  }

  const summary = duplicates.map(d =>
    `${d._discovered ? '[auto] ' : ''}"${d.phraseName}" in ${d.chapterOccurrences.length} chapters: ${d.chapterOccurrences.map(o => 'Ch.' + o.chNum).join(', ')}`
  );

  const result = await rewriteDuplicatePhrases(loaded, duplicates, onProgress);
  return { ...result, duplicates, summary };
}

// ── STEP 2: Structural Arc Tagging ────────────────────────────────────

export async function analyzeStructuralArcs(loaded, onProgress) {
  onProgress('Anthology Polish: Analyzing structural arcs…');

  // Send first + last 500 chars of each chapter to LLM for pattern classification
  const chapterSummaries = loaded.map((f, i) => {
    const content = f.content;
    const first500 = content.substring(0, 500);
    const last500 = content.substring(Math.max(0, content.length - 500));
    return `Chapter ${f.chapter.chapter_number || (i + 1)} "${f.chapter.title || 'Untitled'}":\nOPENING: ${first500}\n...\nENDING: ${last500}`;
  }).join('\n\n---\n\n');

  const prompt = `You are a literary analyst. Classify each chapter's narrative arc pattern:
- PATTERN_A: Protagonist alone → stranger arrives → interaction → epiphany → quiet ending
- PATTERN_B: Protagonist in conflict → escalation → resolution
- PATTERN_C: Protagonist discovers object/place → investigation → revelation
- PATTERN_D: Two characters in tension → confrontation → shift
- PATTERN_E: Other

${chapterSummaries}

Return JSON with "arcs" array, each: { "chapter_number": number, "pattern": "PATTERN_A"|"PATTERN_B"|"PATTERN_C"|"PATTERN_D"|"PATTERN_E", "brief_reason": "one sentence" }`;

  const result = await invokeLLMWithRetry({
    prompt,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        arcs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              chapter_number: { type: 'number' },
              pattern: { type: 'string' },
              brief_reason: { type: 'string' },
            },
            required: ['chapter_number', 'pattern'],
          },
        },
      },
      required: ['arcs'],
    },
  });

  const arcs = result?.arcs || [];
  const patternCounts = {};
  for (const a of arcs) {
    patternCounts[a.pattern] = (patternCounts[a.pattern] || 0) + 1;
  }

  const warnings = [];
  const total = arcs.length || 1;
  for (const [pattern, count] of Object.entries(patternCounts)) {
    const pct = Math.round((count / total) * 100);
    if (pct > 40) {
      const chapNums = arcs.filter(a => a.pattern === pattern).map(a => a.chapter_number).join(', ');
      warnings.push(`STRUCTURAL MONOTONY: ${pct}% of chapters use ${pattern}. Consider restructuring chapters ${chapNums} to use different arcs.`);
    }
  }

  return { arcs, patternCounts, warnings };
}

// ── STEP 3: Ending Variety Check ──────────────────────────────────────

export async function analyzeEndings(loaded, onProgress) {
  onProgress('Anthology Polish: Analyzing chapter endings…');

  const endings = loaded.map((f, i) => {
    const paragraphs = f.content.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    const lastParagraph = paragraphs[paragraphs.length - 1] || '';
    return `Chapter ${f.chapter.chapter_number || (i + 1)}: "${lastParagraph.trim().substring(0, 400)}"`;
  }).join('\n\n');

  const prompt = `Categorize each chapter's final paragraph into exactly one type:
- QUIET_OBSERVATION: character watches something (rain, light, person walking away, silence)
- ACTIVE_DECISION: character takes a concrete action
- DIALOGUE: chapter ends on spoken words
- AMBIGUOUS_OPEN: unresolved question or tension
- HARD_CLOSE: definitive statement or event

${endings}

Return JSON: { "endings": [{ "chapter_number": number, "type": "QUIET_OBSERVATION"|"ACTIVE_DECISION"|"DIALOGUE"|"AMBIGUOUS_OPEN"|"HARD_CLOSE" }] }`;

  const result = await invokeLLMWithRetry({
    prompt,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        endings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              chapter_number: { type: 'number' },
              type: { type: 'string' },
            },
            required: ['chapter_number', 'type'],
          },
        },
      },
      required: ['endings'],
    },
  });

  const endingsList = result?.endings || [];
  const typeCounts = {};
  for (const e of endingsList) {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  }

  const warnings = [];
  const total = endingsList.length || 1;
  const quietCount = typeCounts['QUIET_OBSERVATION'] || 0;
  const quietPct = Math.round((quietCount / total) * 100);
  if (quietPct > 50) {
    const chapNums = endingsList.filter(e => e.type === 'QUIET_OBSERVATION').map(e => e.chapter_number).join(', ');
    warnings.push(`ENDING MONOTONY: ${quietPct}% of chapters end on quiet observation. Consider converting chapters ${chapNums} to active, dialogue, or ambiguous endings.`);
  }

  return { endings: endingsList, typeCounts, warnings };
}

// ── STEP 4: Pronoun Distribution Report ──────────────────────────────

export function analyzePronounDistribution(loaded) {
  const chapterPronouns = [];
  for (let i = 0; i < loaded.length; i++) {
    const content = loaded[i].content;
    const he = (content.match(/\b(?:he|him|his)\b/gi) || []).length;
    const she = (content.match(/\b(?:she|her|hers)\b/gi) || []).length;
    const they = (content.match(/\b(?:they|them|their|theirs)\b/gi) || []).length;

    // Dominant pronoun set
    let dominant = 'they/them';
    if (he > she && he > they) dominant = 'he/him';
    else if (she > he && she > they) dominant = 'she/her';

    chapterPronouns.push({
      chNum: loaded[i].chapter.chapter_number || (i + 1),
      he, she, they, dominant,
    });
  }

  const dominantCounts = {};
  for (const cp of chapterPronouns) {
    dominantCounts[cp.dominant] = (dominantCounts[cp.dominant] || 0) + 1;
  }

  const warnings = [];
  const total = chapterPronouns.length || 1;
  for (const [pronoun, count] of Object.entries(dominantCounts)) {
    const pct = Math.round((count / total) * 100);
    if (pct > 60) {
      warnings.push(`PRONOUN IMBALANCE: ${pronoun} used in ${pct}% of chapters. Review for intentionality.`);
    }
  }

  return { chapterPronouns, dominantCounts, warnings };
}

// ── STEP 5: Contamination Detector ───────────────────────────────────

const SCIFI_FANTASY_VOCAB = [
  'shuttle', 'shuttles', 'void', 'reactor', 'hull', 'transmission', 'transmissions',
  'warp', 'hyperspace', 'phaser', 'blaster', 'mana', 'enchantment', 'teleport',
  'starship', 'android', 'cyborg', 'plasma', 'nebula', 'portal', 'sorcery',
  'spellcast', 'elven', 'dwarven', 'orc', 'goblin', 'dragon', 'wizard',
];

export function detectContamination(loaded, project) {
  const genre = (project.genre || '').toLowerCase();
  const isContemporary = /contemporary|literary|realism|memoir|romance/.test(genre) && !/fantasy|sci-fi|science fiction|paranormal/.test(genre);

  const warnings = [];

  for (let i = 0; i < loaded.length; i++) {
    const content = loaded[i].content.toLowerCase();
    const chNum = loaded[i].chapter.chapter_number || (i + 1);

    // Check sci-fi/fantasy vocab in contemporary genres
    if (isContemporary) {
      const found = [];
      for (const word of SCIFI_FANTASY_VOCAB) {
        const rx = new RegExp('\\b' + word + '\\b', 'gi');
        const matches = content.match(rx);
        if (matches && matches.length > 0) {
          found.push(`"${word}" x${matches.length}`);
        }
      }
      if (found.length > 0) {
        warnings.push(`POSSIBLE CONTAMINATION in Chapter ${chNum}: Genre-mismatched vocabulary detected: ${found.join(', ')}`);
      }
    }
  }

  return { warnings };
}

// ── STEP 6: Length Normalization Report ───────────────────────────────

export function analyzeLengthDistribution(loaded) {
  const wordCounts = loaded.map((f, i) => ({
    chNum: f.chapter.chapter_number || (i + 1),
    words: countWords(f.content),
  }));

  const counts = wordCounts.map(w => w.words);
  const total = counts.reduce((s, c) => s + c, 0);
  const mean = Math.round(total / counts.length);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const variance = counts.reduce((s, c) => s + Math.pow(c - mean, 2), 0) / counts.length;
  const stdDev = Math.round(Math.sqrt(variance));

  const warnings = [];
  for (const wc of wordCounts) {
    const deviation = Math.abs(wc.words - mean) / mean;
    if (deviation > 0.4) {
      const direction = wc.words > mean ? 'above' : 'below';
      const pct = Math.round(deviation * 100);
      warnings.push(`LENGTH OUTLIER: Chapter ${wc.chNum} is ${wc.words.toLocaleString()} words (${pct}% ${direction} mean of ${mean.toLocaleString()} words).`);
    }
  }

  return { wordCounts, mean, min, max, stdDev, warnings };
}