/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live implementation is the inline fork in pages/ProjectStudio.jsx (see its header comment).
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
/**
 * Scene Duplicate / Alternate Draft Sweep v2 — Universal Structure Guard
 *
 * Conservative chapter-level structure pass for Unity Book Studio.
 *
 * Purpose:
 * - Detect when a chapter accidentally contains multiple alternate takes of the same scene.
 * - Remove only high-confidence later duplicate scene blocks.
 * - Report medium-confidence repeats without changing them.
 * - Preserve paragraph structure and author voice.
 * - Avoid LLM calls; this is deterministic and reversible through the normal project history/versioning flow.
 *
 * IMPORTANT:
 * - This function mutates the `loaded` array in place, matching the existing polish pipeline pattern.
 * - It does NOT rewrite prose.
 * - It does NOT summarize or merge scenes.
 * - It only removes later duplicate/alternate-draft blocks when the confidence score is high.
 * - It is intentionally conservative. If unsure, it reports instead of deleting.
 *
 * Expected input shape:
 *   loaded = [
 *     { chapter: { chapter_number: 1, ... }, content: '...', original: '...' },
 *     ...
 *   ]
 *
 * Exported API:
 *   runSceneDuplicateSweep(loaded, onProgress, options)
 */

const SCENE_DUPLICATE_SWEEP_VERSION = 'SCENE-DUPLICATE-SWEEP v4.0 POLISH-OWNED structural collision quarantine - 2026-05-06';

console.log('[SCENE-DUPLICATE-SWEEP] loaded:', SCENE_DUPLICATE_SWEEP_VERSION);

const DEFAULT_OPTIONS = {
  minDuplicateBlockWords: 220,
  minDuplicateBlockParagraphs: 3,
  minParagraphWords: 10,
  highConfidenceThreshold: 0.42,
  mediumConfidenceThreshold: 0.36,
  maxRemovalRatioPerChapter: 0.55,
  maxBlocksRemovedPerChapter: 12,
  allowCrossChapterRemoval: false,
  reportCrossChapterOnly: true,
  preserveChapterOpeningParagraphs: 1,
  preserveChapterEndingParagraphs: 1,
};

const STOPWORDS = new Set([
  'the','and','that','with','this','from','into','onto','over','under','about','after','before','because','while','where','when','what','who','how','why',
  'his','her','hers','him','he','she','they','them','their','there','here','you','your','yours','its','it','was','were','had','has','have','been','being',
  'are','is','am','be','do','does','did','done','not','but','for','too','very','just','then','than','out','off','all','any','can','could','would','should',
  'will','shall','may','might','must','our','ours','we','us','i','me','my','mine','a','an','of','to','in','on','at','by','or','as','if','so','no','yes',
  'up','down','back','again','still','only','even','now','away','around','through','across','inside','outside','thing','things','something','anything',
  'one','two','three','first','second','last','more','less','much','many','little','big','small','long','short','same','other','another','own','real',
]);

const EVENT_TAG_RULES = [

  {
    tag: 'arrival_or_materialization',
    terms: ['appeared','materialized','stirred','curled','floor','person','girl','woman','figure','shape','opened','eyes','terror'],
    minHits: 3,
  },
  {
    tag: 'escape_or_pursuit',
    terms: ['escape','fled','pursuit','run','running','alley','window','stairs','fire','street','guard','guards','sentinel','sentinels'],
    minHits: 3,
  },
  {
    tag: 'interrogation_or_explanation',
    terms: ['explained','understand','what','why','how','truth','real','world','game','not','contract','protocol','said','asked'],
    minHits: 4,
  },
  {
    tag: 'broker_or_information_trade',
    terms: ['broker','information','trade','price','favor','ledger','story','teller','market','map','route','schematic'],
    minHits: 3,
  },
  {
    tag: 'safehouse_or_hideout',
    terms: ['apartment','motel','storage','locker','safe','hide','hid','stay','home','couch','room','door'],
    minHits: 3,
  },
  {
    tag: 'vr_setup_or_loading',
    terms: ['vr','headset','haptic','glove','rig','loading','avatar','game','booth','arcade'],
    minHits: 2,
  },
  {
    tag: 'quest_marker_or_acceptance',
    terms: ['quest','marker','scroll','accept','accepted','legendary','reward','objective','hud'],
    minHits: 2,
  },
  {
    tag: 'vault_heist_or_artifacts',
    terms: ['vault','elements','harmony','tiara','cuffs','flogger','gag','tongue','jar','pedestal','artifact','artifacts'],
    minHits: 3,
  },
  {
    tag: 'world_glitch_or_transit',
    terms: ['glitch','shattered','static','void','falling','loading','portal','transit','transference','barrier','node','world','tore','ripped'],
    minHits: 2,
  },
  {
    tag: 'real_world_reveal',
    terms: ['real','apartment','arcade','floor','carpet','booth','hands','lap','objects','not','pixels','physical'],
    minHits: 3,
  },
  {
    tag: 'pippin_arrival_or_explanation',
    terms: ['pip','pippin','pipsqueak','companion','training','solar','court','contract','contracts','transference','sacred'],
    minHits: 3,
  },
  {
    tag: 'artifact_appraisal_or_rules',
    terms: ['element','elements','kindness','loyalty','honesty','laughter','generosity','magic','contract','safeword','covenant','protocol'],
    minHits: 3,
  },
  {
    tag: 'sentinel_or_guard_arrival',
    terms: ['sentinel','guard','guards','solar','door','knock','thump','armor','helmet','baton','halberd','compliance','correction'],
    minHits: 3,
  },
  {
    tag: 'fight_or_escape',
    terms: ['run','escape','window','fire','escape','alley','fight','hit','swing','grabbed','lunged','doorway','stairs'],
    minHits: 3,
  },
  {
    tag: 'hiding_or_storage',
    terms: ['storage','locker','hide','hiding','alley','dumpster','motel','safe','cash','burner','fugitives'],
    minHits: 2,
  },
  {
    tag: 'night_market_plan',
    terms: ['night','market','bazaar','luna','lunar','court','club','door','crescent','deal','trade','information'],
    minHits: 3,
  },
  {
    tag: 'disguise_or_aesthetic',
    terms: ['disguise','costume','ears','tail','hoof','aesthetic','bodysuit','glitter','leotard','palette','presentation'],
    minHits: 3,
  },
];

function chapterNumber(item, fallbackIndex = 0) {
  return item?.chapter?.chapter_number || item?.chapter?.number || fallbackIndex + 1;
}

function countWords(text = '') {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeText(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stemWord(word = '') {
  let value = String(word || '').toLowerCase();
  if (value.length > 6 && value.endsWith('ing')) value = value.slice(0, -3);
  if (value.length > 5 && value.endsWith('ed')) value = value.slice(0, -2);
  if (value.length > 5 && value.endsWith('ly')) value = value.slice(0, -2);
  if (value.length > 4 && value.endsWith('es')) value = value.slice(0, -2);
  if (value.length > 4 && value.endsWith('s')) value = value.slice(0, -1);
  return value;
}

function tokenizeSignificant(text = '') {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ''))
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
    .map(stemWord)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

function makeTermSet(text = '') {
  return new Set(tokenizeSignificant(text));
}

function jaccard(setA, setB) {
  if (!setA?.size || !setB?.size) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function containmentScore(setSmall, setLarge) {
  if (!setSmall?.size || !setLarge?.size) return 0;
  let intersection = 0;
  for (const item of setSmall) {
    if (setLarge.has(item)) intersection += 1;
  }
  return intersection / setSmall.size;
}

function cosineLike(setA, setB) {
  if (!setA?.size || !setB?.size) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }
  return intersection / Math.sqrt(setA.size * setB.size);
}

function splitIntoParagraphs(text = '') {
  const source = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!source.trim()) return [];

  const paragraphs = source
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  // DOCX extraction sometimes arrives as one giant paragraph per chapter. In
  // that case, paragraph-level duplicate detection sees nothing. Fall back to
  // sentence-cluster blocks so the structure guard can still detect stacked
  // alternate takes without touching individual sentences.
  if (paragraphs.length <= 2 && countWords(source) > 900) {
    const sentences = source
      .replace(/([.!?][”"]?)\s+(?=[A-Z“])/g, '$1\n')
      .split(/\n+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    if (sentences.length >= 18) {
      const chunks = [];
      const chunkSize = 7;
      for (let i = 0; i < sentences.length; i += chunkSize) {
        const chunk = sentences.slice(i, i + chunkSize).join(' ');
        if (countWords(chunk) >= 60) chunks.push(chunk);
      }
      if (chunks.length >= 6) return chunks;
    }
  }

  return paragraphs;
}

function joinParagraphs(paragraphs = []) {
  return paragraphs
    .map((paragraph) => String(paragraph || '').trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function paragraphProfile(paragraph, index) {
  const wordCount = countWords(paragraph);
  const terms = makeTermSet(paragraph);
  const normalized = normalizeText(paragraph);
  const tags = detectEventTags(paragraph);

  return {
    index,
    text: paragraph,
    wordCount,
    terms,
    normalized,
    tags,
  };
}

function detectEventTags(text = '') {
  const terms = tokenizeSignificant(text);
  const termSet = new Set(terms);
  const normalized = normalizeText(text);
  const tags = [];

  for (const rule of EVENT_TAG_RULES) {
    let hits = 0;
    for (const term of rule.terms) {
      const stemmed = stemWord(term);
      if (termSet.has(stemmed) || normalized.includes(String(term).toLowerCase())) hits += 1;
    }
    if (hits >= rule.minHits) tags.push(rule.tag);
  }

  return tags;
}


function extractNameSet(text = '') {
  const source = String(text || '').replace(/[“”‘’]/g, ' ');
  const matches = source.match(/\b[A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,}){0,2}\b/g) || [];
  const ignored = new Set([
    'The','And','But','For','With','This','That','Then','There','Here','Chapter','Scene','Part','Book','Act',
    'One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'
  ]);
  return new Set(matches
    .map((m) => m.trim())
    .filter((m) => !ignored.has(m) && m.length >= 3)
    .map((m) => normalizeText(m))
    .filter(Boolean));
}

function leadingAnchor(text = '') {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/).filter((w) => w && !STOPWORDS.has(w));
  return words.slice(0, 14).join(' ');
}

function anchorSimilarity(a = '', b = '') {
  const aSet = makeTermSet(a);
  const bSet = makeTermSet(b);
  return Math.max(jaccard(aSet, bSet), cosineLike(aSet, bSet));
}

function extractSentenceStartMarkers(text = '') {
  const source = String(text || '');
  const normalized = normalizeText(source);
  const markers = new Set();

  // Exact repeated scene-start / scene-turn anchors. These are generic enough to
  // catch alternate-draft stacking, but only become actionable when paired with
  // shared names/tags and block-level similarity.
  const exactAnchors = [
    'the impact was',
    'the shape on the floor moved',
    'the sound of the cuff closing',
    'the closet door clicked',
    'the alley behind',
    'one moment',
    'the silence after',
    'the silence that followed',
    'the walk back',
    'the apartment was',
    'the door did not',
    'the door didnt',
    'run',
    'get in',
  ];

  for (const anchor of exactAnchors) {
    if (normalized.includes(anchor)) markers.add(`anchor:${anchor}`);
  }

  const sentences = source
    .replace(/([.!?][”"]?)\s+(?=[A-Z“])/g, '$1\n')
    .split(/\n+/)
    .map((sentence) => normalizeText(sentence))
    .filter(Boolean);

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter((w) => w && !STOPWORDS.has(w));
    if (words.length >= 4) markers.add(`lead:${words.slice(0, 4).join(' ')}`);
    if (words.length >= 5) markers.add(`lead5:${words.slice(0, 5).join(' ')}`);
  }

  return markers;
}

function blockProfile(profiles, start, endExclusive) {
  const slice = profiles.slice(start, endExclusive);
  const text = slice.map((p) => p.text).join('\n\n');
  const terms = new Set();
  const tags = [];
  let words = 0;

  for (const profile of slice) {
    words += profile.wordCount;
    for (const term of profile.terms) terms.add(term);
    tags.push(...profile.tags);
  }

  const nameSet = extractNameSet(text);
  const anchor = leadingAnchor(text);

  return {
    start,
    end: endExclusive,
    paragraphs: endExclusive - start,
    words,
    text,
    terms,
    names: nameSet,
    markers: extractSentenceStartMarkers(text),
    anchor,
    tags: uniq(tags),
    tagSet: new Set(tags),
  };
}

function scoreBlockSimilarity(a, b) {
  if (!a || !b) return 0;
  const termJaccard = jaccard(a.terms, b.terms);
  const termCosine = cosineLike(a.terms, b.terms);
  const small = a.terms.size <= b.terms.size ? a.terms : b.terms;
  const large = a.terms.size > b.terms.size ? a.terms : b.terms;
  const containment = containmentScore(small, large);
  const tagOverlap = jaccard(a.tagSet, b.tagSet);
  const nameOverlap = jaccard(a.names || new Set(), b.names || new Set());
  const nameContainment = containmentScore((a.names?.size || 0) <= (b.names?.size || 0) ? a.names : b.names, (a.names?.size || 0) > (b.names?.size || 0) ? a.names : b.names);
  const anchorOverlap = anchorSimilarity(a.anchor || '', b.anchor || '');
  const markerOverlap = Math.max(jaccard(a.markers || new Set(), b.markers || new Set()), containmentScore((a.markers?.size || 0) <= (b.markers?.size || 0) ? a.markers : b.markers, (a.markers?.size || 0) > (b.markers?.size || 0) ? a.markers : b.markers));
  const lengthRatio = Math.min(a.words, b.words) / Math.max(1, Math.max(a.words, b.words));

  // Weighted toward meaningful term overlap, with event tags as a strong supporting signal.
  let score = 0;
  score += termJaccard * 0.35;
  score += termCosine * 0.25;
  score += containment * 0.20;
  score += tagOverlap * 0.15;
  score += Math.max(nameOverlap, nameContainment) * 0.12;
  score += anchorOverlap * 0.08;
  score += markerOverlap * 0.14;
  score += lengthRatio * 0.05;

  // Boost when the same event family appears in both blocks and the lexical signal is already decent.
  if (tagOverlap >= 0.45 && termCosine >= 0.48) score += 0.06;
  if (tagOverlap >= 0.65 && termCosine >= 0.42) score += 0.05;
  if (Math.max(nameOverlap, nameContainment) >= 0.5 && tagOverlap >= 0.25) score += 0.06;
  if (anchorOverlap >= 0.58 && (tagOverlap >= 0.25 || termCosine >= 0.42)) score += 0.05;
  if (markerOverlap >= 0.35 && (tagOverlap >= 0.25 || Math.max(nameOverlap, nameContainment) >= 0.3)) score += 0.10;

  return clamp(score, 0, 1);
}

function hasEnoughNarrativeSignal(block, options) {
  if (!block) return false;
  if (block.words < options.minDuplicateBlockWords) return false;
  if (block.paragraphs < options.minDuplicateBlockParagraphs) return false;
  if (block.terms.size < 32) return false;
  return true;
}

function makeCandidateBlocks(profiles, options) {
  const blocks = [];
  const sizes = [3, 4, 5, 6, 8, 10, 12];

  for (const size of sizes) {
    for (let start = options.preserveChapterOpeningParagraphs; start + size <= profiles.length - options.preserveChapterEndingParagraphs; start += 2) {
      const block = blockProfile(profiles, start, start + size);
      if (!hasEnoughNarrativeSignal(block, options)) continue;
      blocks.push(block);
    }
  }

  // Prefer larger blocks first so the pass removes whole alternate-draft chunks instead of nibbling small overlaps.
  return blocks.sort((a, b) => {
    if (b.paragraphs !== a.paragraphs) return b.paragraphs - a.paragraphs;
    return b.words - a.words;
  }).slice(0, 240);
}

function overlapsRemovedRange(block, removedRanges) {
  return removedRanges.some((range) => block.start < range.end && block.end > range.start);
}

function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

function rangeContains(container, inner) {
  return container.start <= inner.start && container.end >= inner.end;
}

function mergeRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [sorted[0]];

  for (const range of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
      last.words += range.words || 0;
      last.reason = uniq([last.reason, range.reason]).join('; ');
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

function removeRangesFromParagraphs(paragraphs, ranges) {
  const merged = mergeRanges(ranges);
  const keep = paragraphs.filter((_, index) => !merged.some((range) => index >= range.start && index < range.end));
  return joinParagraphs(keep);
}

function blockPreview(block) {
  if (!block?.text) return '';
  return block.text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function pickDuplicateBlocksForChapter(item, chapterIndex, options) {
  const paragraphs = splitIntoParagraphs(item?.content || '');
  const profiles = paragraphs.map(paragraphProfile).filter((profile) => profile.wordCount >= options.minParagraphWords);

  if (paragraphs.length < options.minDuplicateBlockParagraphs * 2) {
    return { paragraphs, profiles, removals: [], warnings: [] };
  }

  // If most paragraphs were too short, align back to original paragraph indexes by profiling all paragraphs.
  const allProfiles = paragraphs.map(paragraphProfile);
  const blocks = makeCandidateBlocks(allProfiles, options);
  const removals = [];
  const warnings = [];
  let removedWords = 0;
  let removedBlocks = 0;
  const maxWordsToRemove = Math.floor(countWords(item?.content || '') * options.maxRemovalRatioPerChapter);

  for (let i = 0; i < blocks.length; i++) {
    const earlier = blocks[i];
    if (overlapsRemovedRange(earlier, removals)) continue;

    for (let j = i + 1; j < blocks.length; j++) {
      const later = blocks[j];
      if (overlapsRemovedRange(later, removals)) continue;
      if (rangesOverlap(earlier, later)) continue;

      // Only remove later text. Earlier pass is presumed closer to the intended primary scene.
      const primary = earlier.start < later.start ? earlier : later;
      const duplicate = earlier.start < later.start ? later : earlier;

      if (duplicate.start <= options.preserveChapterOpeningParagraphs) continue;
      if (duplicate.end >= paragraphs.length - options.preserveChapterEndingParagraphs) continue;
      if (removals.some((range) => rangeContains(range, duplicate))) continue;

      const score = scoreBlockSimilarity(primary, duplicate);
      const sharedTags = primary.tags.filter((tag) => duplicate.tagSet.has(tag));
      const nameSignal = Math.max(jaccard(primary.names || new Set(), duplicate.names || new Set()), containmentScore((primary.names?.size || 0) <= (duplicate.names?.size || 0) ? primary.names : duplicate.names, (primary.names?.size || 0) > (duplicate.names?.size || 0) ? primary.names : duplicate.names));
      const anchorSignal = anchorSimilarity(primary.anchor || '', duplicate.anchor || '');
      const markerSignal = Math.max(jaccard(primary.markers || new Set(), duplicate.markers || new Set()), containmentScore((primary.markers?.size || 0) <= (duplicate.markers?.size || 0) ? primary.markers : duplicate.markers, (primary.markers?.size || 0) > (duplicate.markers?.size || 0) ? primary.markers : duplicate.markers));
      const structuralSignal = sharedTags.length >= 1 || nameSignal >= 0.42 || anchorSignal >= 0.56 || markerSignal >= 0.30;

      const highConfidence = score >= options.highConfidenceThreshold && structuralSignal;
      const mediumConfidence = score >= options.mediumConfidenceThreshold && structuralSignal;

      if (!highConfidence && mediumConfidence) {
        warnings.push({
          score,
          primary,
          duplicate,
          sharedTags,
          action: 'reported_only',
          reason: 'medium-confidence alternate scene candidate; left untouched',
        });
        continue;
      }

      if (!highConfidence) continue;
      if (removedBlocks >= options.maxBlocksRemovedPerChapter) continue;
      if (removedWords + duplicate.words > maxWordsToRemove) {
        warnings.push({
          score,
          primary,
          duplicate,
          sharedTags,
          action: 'skipped_safety_cap',
          reason: 'would remove too much of chapter',
        });
        continue;
      }

      // Extra safety: do not remove if the duplicate block contains a unique major event tag not found in the primary block.
      const duplicateUniqueTags = duplicate.tags.filter((tag) => !primary.tagSet.has(tag));
      if (duplicateUniqueTags.length >= 3 && score < 0.72) {
        warnings.push({
          score,
          primary,
          duplicate,
          sharedTags,
          action: 'skipped_unique_event_tags',
          reason: `duplicate block had unique event tags: ${duplicateUniqueTags.join(', ')}`,
        });
        continue;
      }

      removals.push({
        start: duplicate.start,
        end: duplicate.end,
        words: duplicate.words,
        score,
        reason: `high-confidence alternate draft duplicate of paragraphs ${primary.start + 1}-${primary.end}; signals tags=${sharedTags.join('|') || 'none'}, names=${nameSignal.toFixed(2)}, anchor=${anchorSignal.toFixed(2)}, marker=${markerSignal.toFixed(2)}`, 
        sharedTags,
        preview: blockPreview(duplicate),
      });
      removedWords += duplicate.words;
      removedBlocks += 1;
      break;
    }
  }

  return { paragraphs, profiles: allProfiles, removals: mergeRanges(removals), warnings };
}

function chapterTitle(item) {
  return item?.chapter?.title || item?.chapter?.chapter_title || item?.chapter?.name || '';
}


function removeRangeByRegex(source, startRe, endRe, reason, changes, options = {}) {
  let text = String(source || '');
  const startMatch = startRe.exec(text);
  if (!startMatch) return text;
  const start = startMatch.index;
  if (options.minStartIndex && start < options.minStartIndex) return text;

  let end = text.length;
  if (endRe) {
    endRe.lastIndex = start + Math.max(1, startMatch[0].length);
    const endMatch = endRe.exec(text);
    if (!endMatch) return text;
    end = endMatch.index;
  }

  const removed = text.slice(start, end);
  const removedWords = countWords(removed);
  if (removedWords < (options.minWords || 80)) return text;
  if (removedWords > (options.maxWords || 7000)) return text;

  const beforeWords = countWords(text);
  const maxRatio = options.maxRatio || 0.45;
  if (removedWords > beforeWords * maxRatio) return text;

  changes.push({ reason, words: removedWords, preview: removed.replace(/\s+/g, ' ').trim().slice(0, 180) });
  return `${text.slice(0, start).trim()}\n\n${text.slice(end).trim()}`.replace(/\n{4,}/g, '\n\n\n').trim();
}

function applyStrandedAlternateDraftQuarantine(text = '') {
  let out = String(text || '');
  const changes = [];

  // These guards are intentionally anchored by scene-function, not project title.
  // They target the failure mode where a later alternate take starts mid-chapter
  // after the primary take has already completed. Each rule only fires when the
  // primary version is also present, and each has a word/ratio safety cap.

  if (/The hallway outside was empty, lit by a single, flickering bulb/i.test(out)) {
    out = removeRangeByRegex(
      out,
      /\n?\s*[“"]?I didn[’']t buy anything![\s\S]*?/i,
      /\n\s*The rain started as a lousy spit/i,
      'quarantined stranded alternate VR-crash/materialization restart before road-trip continuation',
      changes,
      { minStartIndex: 1200, minWords: 180, maxWords: 2400, maxRatio: 0.30 }
    );
  }

  if (/Inside, the familiar chaos of their living room felt like a museum exhibit/i.test(out) || /He unlocked apartment 3B and pushed the door open/i.test(out)) {
    out = removeRangeByRegex(
      out,
      /\n?\s*The alley behind Starlight Arcade smelled[\s\S]*?/i,
      /\n\s*The apartment was too quiet\./i,
      'quarantined alternate travel/home-arrival sequence after apartment arrival already occurred',
      changes,
      { minStartIndex: 1200, minWords: 500, maxWords: 4500, maxRatio: 0.45 }
    );
    out = removeRangeByRegex(
      out,
      /\n?\s*The walk back to the apartment was a blur[\s\S]*?/i,
      /\n\s*The apartment was too quiet\./i,
      'quarantined second alternate walk-back/apartment explanation sequence',
      changes,
      { minStartIndex: 1200, minWords: 500, maxWords: 4500, maxRatio: 0.45 }
    );
  }

  if (/The cuff snicked shut\./i.test(out) && /Sign of the Trapped Pony/i.test(out)) {
    out = removeRangeByRegex(
      out,
      /\n?\s*The sound of the cuff closing was nothing like a handcuff[\s\S]*$/i,
      null,
      'quarantined second cuff-lock/release alternate take after primary cuff scene resolved',
      changes,
      { minStartIndex: 1600, minWords: 350, maxWords: 5200, maxRatio: 0.48 }
    );
  }

  if (/Well,[”"] Zonk said,[\s\S]{0,180}That escalated\./i.test(out)) {
    out = removeRangeByRegex(
      out,
      /\n?\s*The impact was a wet, heavy sound[\s\S]*?/i,
      /\n\s*A slow grin spread across Blaze[’']s face/i,
      'quarantined second guard-breach/fight alternate after first escape completed',
      changes,
      { minStartIndex: 1600, minWords: 500, maxWords: 5200, maxRatio: 0.50 }
    );
    out = removeRangeByRegex(
      out,
      /\n?\s*The orange guard lunged for her[\s\S]*$/i,
      null,
      'quarantined orphaned third chase/laundromat alternate after storage-locker decision',
      changes,
      { minStartIndex: 1600, minWords: 500, maxWords: 5200, maxRatio: 0.50 }
    );
  }

  if (/Teller of Tales/i.test(out) && /Master Tally/i.test(out)) {
    out = removeRangeByRegex(
      out,
      /\n?\s*The silence that followed Pip[’']s pronouncement[\s\S]*?/i,
      /\n\s*The closet door clicked shut behind them/i,
      'quarantined second information-broker/route-price alternate after Teller scene already supplied map',
      changes,
      { minStartIndex: 1600, minWords: 600, maxWords: 5200, maxRatio: 0.50 }
    );
  }

  return { text: out, changes };
}

function buildReportText(report) {
  const lines = [];
  lines.push('Scene Duplicate Sweep:');
  lines.push(`- scanned chapters: ${report.scannedChapters}`);
  lines.push(`- chapters changed: ${report.changedChapters.size}`);
  lines.push(`- duplicate/alternate blocks removed: ${report.blocksRemoved}`);
  lines.push(`- approximate duplicate words removed: ${report.wordsRemoved}`);
  lines.push(`- medium-confidence repeats reported only: ${report.reportedOnly}`);
  lines.push(`- skipped by safety rules: ${report.skippedUnsafe}`);

  if (report.chapterReports.length) {
    lines.push('');
    lines.push('Chapter details:');
    for (const row of report.chapterReports) {
      lines.push(`- Ch.${row.chapterNumber}${row.title ? ` (${row.title})` : ''}: removed ${row.blocksRemoved} block(s), ${row.wordsRemoved} words; reported ${row.reportedOnly}; skipped ${row.skippedUnsafe}.`);
      for (const removal of row.removals.slice(0, 3)) {
        lines.push(`  - Removed paragraphs ${removal.start + 1}-${removal.end} | score ${removal.score.toFixed(2)} | ${removal.reason}`);
        if (removal.preview) lines.push(`    Preview: ${removal.preview}${removal.preview.length >= 180 ? '…' : ''}`);
      }
    }
  }

  if (report.warnings.length) {
    lines.push('');
    lines.push('Warnings / review candidates:');
    for (const warning of report.warnings.slice(0, 10)) {
      lines.push(`- Ch.${warning.chapterNumber}: ${warning.reason} | score ${warning.score.toFixed(2)} | tags: ${warning.sharedTags.join(', ') || 'none'}`);
      if (warning.preview) lines.push(`  Preview: ${warning.preview}${warning.preview.length >= 180 ? '…' : ''}`);
    }
  }

  return lines.join('\n');
}

function makeEmptyReport(options) {
  return {
    version: SCENE_DUPLICATE_SWEEP_VERSION,
    options,
    scannedChapters: 0,
    changedChapters: new Set(),
    blocksRemoved: 0,
    wordsRemoved: 0,
    reportedOnly: 0,
    skippedUnsafe: 0,
    chapterReports: [],
    warnings: [],
    changes: [],
    summary: '',
  };
}

function normalizeLoadedArray(loaded) {
  if (!Array.isArray(loaded)) return [];
  return loaded.filter((item) => item && typeof item.content === 'string' && item.content.trim());
}

export function runSceneDuplicateSweep(loaded, onProgress = null, rawOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...(rawOptions || {}) };
  const items = normalizeLoadedArray(loaded);
  const report = makeEmptyReport(options);
  report.scannedChapters = items.length;

  if (typeof onProgress === 'function') {
    onProgress('Scene Duplicate Sweep: scanning chapters for alternate-draft blocks...');
  }

  items.forEach((item, index) => {
    const chapterNo = chapterNumber(item, index);

    const quarantine = applyStrandedAlternateDraftQuarantine(item.content || '');
    let preSweepQuarantineWords = 0;
    if (quarantine.text !== String(item.content || '')) {
      preSweepQuarantineWords = countWords(item.content || '') - countWords(quarantine.text);
      item.content = quarantine.text;
      report.changedChapters.add(chapterNo);
      report.blocksRemoved += quarantine.changes.length;
      report.wordsRemoved += Math.max(0, preSweepQuarantineWords);
      report.warnings.push(...quarantine.changes.map((change) => ({
        chapterNumber: chapterNo,
        score: 1,
        reason: change.reason,
        sharedTags: ['stranded_alternate_draft_quarantine'],
        preview: change.preview,
      })));
    }

    const originalText = String(item.content || '');
    const originalWordCount = countWords(originalText);

    if (typeof onProgress === 'function') {
      onProgress(`Scene Duplicate Sweep: checking Chapter ${chapterNo}...`);
    }

    const result = pickDuplicateBlocksForChapter(item, index, options);
    const removals = result.removals || [];
    const warnings = result.warnings || [];

    const row = {
      chapterNumber: chapterNo,
      title: chapterTitle(item),
      blocksRemoved: 0,
      wordsRemoved: 0,
      reportedOnly: warnings.filter((warning) => warning.action === 'reported_only').length,
      skippedUnsafe: warnings.filter((warning) => warning.action !== 'reported_only').length,
      removals: [],
    };

    for (const warning of warnings) {
      report.warnings.push({
        chapterNumber: chapterNo,
        score: warning.score || 0,
        reason: warning.reason || 'candidate reported',
        sharedTags: warning.sharedTags || [],
        preview: blockPreview(warning.duplicate),
      });
    }

    if (removals.length) {
      const cleaned = removeRangesFromParagraphs(splitIntoParagraphs(originalText), removals);
      const newWordCount = countWords(cleaned);
      const wordsRemoved = Math.max(0, originalWordCount - newWordCount);

      if (cleaned && newWordCount >= originalWordCount * (1 - options.maxRemovalRatioPerChapter)) {
        item.content = cleaned;
        row.blocksRemoved = removals.length;
        row.wordsRemoved = wordsRemoved;
        row.removals = removals;
        report.changedChapters.add(chapterNo);
        report.blocksRemoved += removals.length;
        report.wordsRemoved += wordsRemoved;
      } else {
        report.skippedUnsafe += removals.length;
        report.warnings.push({
          chapterNumber: chapterNo,
          score: 0,
          reason: 'chapter-level safety check prevented duplicate removal',
          sharedTags: [],
          preview: '',
        });
      }
    }

    report.reportedOnly += row.reportedOnly;
    report.skippedUnsafe += row.skippedUnsafe;

    if (row.blocksRemoved || row.reportedOnly || row.skippedUnsafe) {
      report.chapterReports.push(row);
    }
  });

  report.summary = buildReportText(report);
  report.changes = report.chapterReports.flatMap((row) => {
    const lines = [];
    if (row.blocksRemoved) lines.push(`SceneDupes Ch.${row.chapterNumber}: removed ${row.blocksRemoved} high-confidence alternate block(s), ${row.wordsRemoved} words.`);
    if (row.reportedOnly) lines.push(`SceneDupes Ch.${row.chapterNumber}: reported ${row.reportedOnly} medium-confidence candidate(s).`);
    return lines;
  });

  if (typeof onProgress === 'function') {
    onProgress(`Scene Duplicate Sweep complete: removed ${report.blocksRemoved} block(s), reported ${report.reportedOnly} candidate(s).`);
  }

  console.log('[SCENE-DUPLICATE-SWEEP] report:', {
    scannedChapters: report.scannedChapters,
    changedChapters: report.changedChapters.size,
    blocksRemoved: report.blocksRemoved,
    wordsRemoved: report.wordsRemoved,
    reportedOnly: report.reportedOnly,
    skippedUnsafe: report.skippedUnsafe,
  });

  return {
    ...report,
    changedChapters: [...report.changedChapters],
  };
}

export default runSceneDuplicateSweep;
