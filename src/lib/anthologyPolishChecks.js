/**
 * Anthology Polish Checks
 *
 * Safe anthology-specific polish helpers.
 *
 * Important:
 * - These functions are intentionally conservative.
 * - They should reduce repeated anthology texture without bulldozing prose.
 * - Contamination detection must NEVER delete a name heavily used inside a chapter.
 * - If a name appears repeatedly in one chapter, it is almost certainly native to that story.
 *
 * Compatibility:
 * - This file also exports legacy detector names used elsewhere in the app:
 *   runAnthologyHardErrorDetector
 *   runChapterOpenerFrequencyDetector
 *   runLiteraryAtmosphericCap
 *   runNarrativeClusterDetector
 */

import { base44 } from '@/api/base44Client';
import { detectProjectContamination } from '@/lib/manuscriptSafetyGate';

function safeString(value) {
  if (value == null) return '';

  if (typeof value === 'string') return value;

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(safeString).filter(Boolean).join('\n\n');
  }

  if (typeof value === 'object') {
    const direct =
      value.text ||
      value.prose ||
      value.content ||
      value.cleanedText ||
      value.finalText ||
      value.body ||
      value.output ||
      value.result ||
      value.response ||
      value.message?.content ||
      value.choices?.[0]?.message?.content ||
      value.choices?.[0]?.text ||
      value.data?.text ||
      value.data?.content;

    if (direct != null && direct !== value) {
      return safeString(direct);
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }

  return '';
}

function normalizeText(value) {
  return safeString(value)
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countWords(text) {
  const words = normalizeText(text).match(/\b[\w'-]+\b/g);
  return words ? words.length : 0;
}

function countOccurrences(text, phrase) {
  if (!phrase) return 0;

  const rx = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
  return (normalizeText(text).match(rx) || []).length;
}

function splitSentencesWithSpacing(text) {
  const normalized = safeString(text);
  const matches = normalized.match(/[^.!?…]+[.!?…]["”’)]*\s*|[^.!?…]+$/g);

  if (!matches) return [normalized];

  return matches;
}

function chapterNumber(item, fallback = 1) {
  const raw =
    item?.chapterNumber ||
    item?.chapter?.chapter_number ||
    item?.chapter?.number ||
    item?.chapter_number ||
    item?.number ||
    fallback;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function setItemContent(item, content) {
  item.content = normalizeText(content);
}

function reportProgress(onProgress, value) {
  if (typeof onProgress === 'function') {
    onProgress(value);
  }
}

function itemTitle(item) {
  return safeString(item?.title || item?.chapter?.title || '').trim();
}

function getChapterOpening(text, maxChars = 2200) {
  return normalizeText(text).slice(0, maxChars);
}

function getChapterFirstQuarter(text) {
  const normalized = normalizeText(text);
  return normalized.slice(0, Math.max(1200, Math.floor(normalized.length * 0.25)));
}

function getFirstParagraph(text) {
  const normalized = normalizeText(text);
  return normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)[0] || '';
}

function getOpeningFingerprint(text, wordCount = 8) {
  const firstParagraph = getFirstParagraph(text);

  return firstParagraph
    .toLowerCase()
    .replace(/[“”"'.!?…,:;()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, wordCount)
    .join(' ');
}

function getOpeningStarter(text, wordCount = 4) {
  const firstParagraph = getFirstParagraph(text);

  return firstParagraph
    .toLowerCase()
    .replace(/[“”"'.!?…,:;()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, wordCount)
    .join(' ');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function looksLikeOutlineOrNotes(text) {
  const source = normalizeText(text).slice(0, 2500).toLowerCase();

  const signals = [
    'scene beats:',
    'chapter beats:',
    'outline:',
    'summary:',
    'draft the scene',
    'write the chapter',
    'target word count',
    'include the following',
    'self-check',
    'continuity notes',
    'style notes',
  ];

  let hits = 0;

  for (const signal of signals) {
    if (source.includes(signal)) hits += 1;
  }

  return hits >= 2;
}

function isProbablyHumanName(value) {
  const name = safeString(value).trim();

  if (!name) return false;
  if (name.length < 3 || name.length > 45) return false;

  // Reject all-caps title fragments / genre fragments unless they look like a normal name.
  if (/^[A-Z\s]+$/.test(name) && name.split(/\s+/).length > 1) return false;

  if (!/^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,2}$/.test(name)) return false;

  const lower = name.toLowerCase();

  const bannedExact = new Set([
    'the',
    'and',
    'but',
    'for',
    'with',
    'when',
    'then',
    'there',
    'this',
    'that',
    'chapter',
    'scene',
    'profile',
    'profiles',
    'touch',
    'smell',
    'hearing',
    'justice',
    'martyr',
    'structural',
    'behavioral',
    'relational',
    'sensory',
    'comfort object',
    'arc milestones',
    'dialogue fingerprint',
    'attachment style',
    'humor style',
    'coping mechanism',
    'breaking point',
    'social mask',
    'identity sacrifice',
    'key dynamic',
    'roman guard',
    'multiple unnamed victims',

    // Common title/genre/abstract false positives.
    'untitled project',
    'digital equity tribunal',
    'science fiction',
    'dystopian',
    'comedy',
    'comedic thriller',
    'caper',
    'horror',
    'cosmic horror',
    'historical fiction',
    'self-help',
    'psychology',
    'investigative journalism',
    'history',
    'political history',
    'absurdist fiction',
    'erotica',
    'lgbtq',
    'young adult',
    'literary fiction',
    'family drama',
    'health',
    'wellness',
    'caregiving',
    'personal finance',
    'psychological horror',
    'thriller',
    'psychological thriller',
    'survival horror',
    'social history',
    'body horror',
    'cultural history',
    'industrial horror',
    'suspense',
    'personal development',
    'mystery',
    'faith-based fiction',
    'adventure',
    'survival',
    'romance',
    'historical romance',
    'comedic sci-fi',
    'fantasy',
    'dark fantasy',
    'cyberpunk',
    'survival thriller',
    'dystopian technothriller',

    // Single-word false positives seen in logs.
    'fire',
    'blood',
    'history',
    'book',
    'care',
    'hollow',
    'what',
    'away',
    'sleep',
    'static',
    'grace',
    'permission',
    'exhale',
    'circle',
    'shadow',
    'north',
    'sand',
    'room',
    'weight',
    'false',
    'light',
    'summit',
    'floor',
    'horizon',
    'needle',
    'field',
    'house',
    'veil',
  ]);

  if (bannedExact.has(lower)) return false;

  const bannedPieces = [
    'whose ',
    'even ',
    'began',
    'agency',
    'acted ',
    'cleared ',
    'voices ',
    'but ',
    'to ',
    'was ',
    'with ',
    'as ',
    'and ',
    'or ',
    'of ',
    'in ',
    'book',
    'vol',
  ];

  if (bannedPieces.some((piece) => lower.includes(piece))) return false;

  return true;
}

function extractNamesFromText(text) {
  const source = normalizeText(text);
  const matches = source.match(/\b[A-Z][a-zA-Z'’-]{2,}(?:\s+[A-Z][a-zA-Z'’-]{2,}){0,2}\b/g) || [];

  return unique(matches.map((value) => value.trim()).filter(isProbablyHumanName));
}

function extractNamesFromProject(project = {}) {
  /*
   * Deliberately only use character/cast-style fields for contamination intelligence.
   * Do NOT use title, genre, subgenre, description, or project metadata.
   * Those created false positives like History, Fire, Blood, Book, Care, Hollow, etc.
   */
  const fields = [
    project.character_notes,
    project.characters,
    project.cast,
    project.character_bible,
    project.protagonist,
    project.antagonist,
    project.supporting_cast,
    project.story_bible,
    project.continuity_bible,
  ];

  return unique(fields.flatMap((field) => extractNamesFromText(safeString(field))));
}

async function fetchOtherProjectNames(currentProject = {}) {
  try {
    let rows = [];

    if (base44?.entities?.NovelProject?.list) {
      rows = await base44.entities.NovelProject.list();
    } else if (base44?.entities?.NovelProject?.filter) {
      rows = await base44.entities.NovelProject.filter({});
    } else if (base44?.entities?.BookProject?.list) {
      rows = await base44.entities.BookProject.list();
    } else if (base44?.entities?.BookProject?.filter) {
      rows = await base44.entities.BookProject.filter({});
    }

    if (!Array.isArray(rows)) return [];

    const currentId = currentProject?.id || currentProject?._id || '';

    const otherProjects = rows.filter((project) => {
      const id = project?.id || project?._id || '';
      return id && id !== currentId;
    });

    const names = unique(otherProjects.flatMap(extractNamesFromProject));

    console.log(`[ANTHOLOGY-POLISH] CONTAM: Found ${otherProjects.length} other projects`);
    console.log(`[ANTHOLOGY-POLISH] CONTAM: Candidate foreign character names only: [${names.join(', ')}]`);

    return names;
  } catch (error) {
    console.warn('[ANTHOLOGY-POLISH] CONTAM: Could not load other project names:', error);
    return [];
  }
}

function extractNativeNamesFromChapter(item) {
  const content = normalizeText(item.content);
  const title = itemTitle(item);

  const titleNames = extractNamesFromText(title);
  const openingNames = extractNamesFromText(getChapterOpening(content));
  const firstQuarterNames = extractNamesFromText(getChapterFirstQuarter(content));
  const allNames = extractNamesFromText(content);

  const native = new Set();

  for (const name of titleNames) native.add(name);
  for (const name of openingNames) native.add(name);
  for (const name of firstQuarterNames) native.add(name);

  for (const name of allNames) {
    const count = countOccurrences(content, name);

    if (count >= 2) {
      native.add(name);
    }
  }

  return native;
}

function buildNativeNameMap(loaded) {
  const map = new Map();

  for (const item of loaded) {
    map.set(item.chapter?.id || item.chapterNumber || item.title, extractNativeNamesFromChapter(item));
  }

  return map;
}

function isNativeToChapter({ item, phrase, nativeNameMap }) {
  const content = normalizeText(item.content);
  const title = itemTitle(item);
  const count = countOccurrences(content, phrase);

  const nativeNames = nativeNameMap.get(item.chapter?.id || item.chapterNumber || item.title) || new Set();

  if (nativeNames.has(phrase)) return true;

  if (title && countOccurrences(title, phrase) > 0) return true;

  if (count >= 2) return true;

  const opening = getChapterOpening(content);
  if (countOccurrences(opening, phrase) > 0) return true;

  const firstQuarter = getChapterFirstQuarter(content);
  if (countOccurrences(firstQuarter, phrase) > 0) return true;

  const possessiveRx = new RegExp(`\\b${escapeRegExp(phrase)}['’]s\\b`, 'i');
  if (possessiveRx.test(content)) return true;

  const dialogueRx = new RegExp(`[“"]\\s*${escapeRegExp(phrase)}[,.!?“”"\\s]`, 'i');
  if (dialogueRx.test(content)) return true;

  return false;
}

function removeExcessBodyLanguageSentence(text, phrase) {
  const original = normalizeText(text);
  const sentences = splitSentencesWithSpacing(original);

  let removed = 0;
  const kept = [];

  for (const sentence of sentences) {
    const plain = sentence.trim();
    const hasPhrase = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i').test(plain);

    if (!hasPhrase) {
      kept.push(sentence);
      continue;
    }

    const sentenceWordCount = countWords(plain);

    if (removed === 0 && sentenceWordCount <= 28 && plain.length <= 220) {
      removed += 1;
      continue;
    }

    kept.push(sentence);
  }

  return {
    text: normalizeText(kept.join('')),
    removed,
  };
}

function replacePhraseSafely(text, phrase, replacement) {
  const rx = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
  return normalizeText(text).replace(rx, replacement);
}

function preserveCaseReplacement(match, replacement) {
  if (!replacement) return match;

  if (/^[A-Z]/.test(match)) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }

  return replacement;
}

/**
 * Cross-chapter body language dedup.
 *
 * Conservative version:
 * - Only removes tiny repeated body-language beat sentences.
 * - Does not remove long sentences.
 * - Does not remove core action/plot sentences.
 */
export async function runCrossChapterBodyLanguageDedup(loaded = [], onProgress) {
  console.log('[ANTHOLOGY-POLISH] ========== BODY LANGUAGE DEDUP START ==========');
  console.log(`[ANTHOLOGY-POLISH] Processing ${loaded.length} chapters`);

  reportProgress(onProgress, 'Anthology polish: checking repeated body-language beats…');

  const changes = [];
  let totalRemoved = 0;

  const families = [
    {
      group: 'stomach',
      phrases: [
        'stomach tightened',
        'stomach twisted',
        'stomach clenched',
        'gut tightened',
        'gut clenched',
      ],
      maxAcrossBook: 1,
    },
    {
      group: 'breath',
      phrases: [
        'breath caught',
        'breath hitched',
        'breath stopped',
        'air hitched',
      ],
      maxAcrossBook: 5,
    },
    {
      group: 'pulse',
      phrases: [
        'pulse hammered',
        'pulse thudded',
        'heart hammered',
        'heart thudded',
      ],
      maxAcrossBook: 5,
    },
    {
      group: 'skin',
      phrases: [
        'skin prickled',
        'skin tingled',
        'skin burned',
      ],
      maxAcrossBook: 4,
    },
  ];

  for (const family of families) {
    let seen = 0;

    for (const item of loaded) {
      const chNum = chapterNumber(item);
      let content = normalizeText(item.content);

      for (const phrase of family.phrases) {
        const count = countOccurrences(content, phrase);

        if (!count) continue;

        for (let i = 0; i < count; i += 1) {
          seen += 1;

          if (seen <= family.maxAcrossBook) continue;

          const result = removeExcessBodyLanguageSentence(content, phrase);

          if (result.removed > 0) {
            const beforeLen = content.length;
            content = result.text;
            const afterLen = content.length;

            console.log(
              `[ANTHOLOGY-POLISH] Ch.${chNum}: REMOVING small sentence containing "${phrase}" x${result.removed} (group "${family.group}")`
            );
            console.log(`[ANTHOLOGY-POLISH] Ch.${chNum}: "${phrase}" — length ${beforeLen} → ${afterLen}`);

            changes.push(`Ch.${chNum}: removed repeated body-language beat "${phrase}"`);
            totalRemoved += result.removed;
          }
        }
      }

      setItemContent(item, content);
    }
  }

  console.log(`[ANTHOLOGY-POLISH] BODY LANGUAGE DEDUP COMPLETE. Total removed: ${totalRemoved}`);

  return {
    changes,
    totalRemoved,
  };
}

/**
 * Anthology vocabulary bans.
 *
 * Conservative version:
 * - Replaces common AI-ish anthology words with simpler alternatives.
 * - Does not delete whole sentences.
 */
export async function runAnthologyVocabBans(loaded = [], onProgress) {
  console.log('[ANTHOLOGY-POLISH] ========== VOCAB BANS START ==========');

  reportProgress(onProgress, 'Anthology polish: checking anthology vocabulary bans…');

  const changes = [];
  let totalReplaced = 0;

  const replacements = [
    ['beacon', 'signal'],
    ['profound', 'deep'],
    ['crescendo', 'rise'],
    ['tapestry', 'pattern'],
    ['symphony', 'noise'],
    ['cathedral', 'room'],
    ['geometry', 'shape'],
    ['architecture', 'structure'],
  ];

  console.log(`[ANTHOLOGY-POLISH] Scanning for ${replacements.length} banned words across ${loaded.length} chapters`);

  for (const item of loaded) {
    const chNum = chapterNumber(item);
    let content = normalizeText(item.content);

    for (const [word, replacement] of replacements) {
      const count = countOccurrences(content, word);
      if (!count) continue;

      content = replacePhraseSafely(content, word, replacement);
      totalReplaced += count;

      console.log(`[ANTHOLOGY-POLISH] Ch.${chNum}: REPLACING "${word}" x${count}`);
      changes.push(`Ch.${chNum}: replaced "${word}" x${count}`);
    }

    setItemContent(item, content);
  }

  console.log(`[ANTHOLOGY-POLISH] VOCAB BANS COMPLETE. Total replaced/cut: ${totalReplaced}`);

  return {
    changes,
    totalReplaced,
  };
}

/**
 * Contamination detector.
 *
 * Diagnostic-only version.
 *
 * New behavior:
 * - No deletion.
 * - No sentence removal.
 * - Only checks character/cast-style names from other projects.
 * - Ignores project titles, book titles, genre labels, and common nouns.
 * - Native names are skipped.
 * - Suspicious low-count foreign character names are reported only.
 */
export async function runContaminationDetector(loaded = [], onProgress, project = {}) {
  console.log('[ANTHOLOGY-POLISH] ========== CONTAMINATION DETECTOR START ==========');

  reportProgress(onProgress, 'Anthology polish: checking cross-project contamination safely…');

  const changes = [];
  const warnings = [];
  let contaminationFound = 0;
  let contaminationRemoved = 0;

  const nativeNameMap = buildNativeNameMap(loaded);
  const otherProjectNames = await fetchOtherProjectNames(project);

  const candidateNames = unique(otherProjectNames.filter(isProbablyHumanName));

  console.log(`[ANTHOLOGY-POLISH] CONTAM: Proper character-name candidates after filtering: [${candidateNames.join(', ')}]`);

  for (const item of loaded) {
    const chNum = chapterNumber(item);
    const content = normalizeText(item.content);

    for (const name of candidateNames) {
      const count = countOccurrences(content, name);
      if (!count) continue;

      contaminationFound += count;

      if (isNativeToChapter({ item, phrase: name, nativeNameMap })) {
        console.log(
          `[ANTHOLOGY-POLISH] CONTAM Ch.${chNum}: SKIPPING "${name}" — appears ${count}x, NATIVE to this chapter`
        );

        warnings.push(`Ch.${chNum}: skipped "${name}" as native chapter name (${count}x)`);
        continue;
      }

      console.log(
        `[ANTHOLOGY-POLISH] CONTAM Ch.${chNum}: FLAG ONLY "${name}" x${count} — no automatic deletion`
      );

      warnings.push(
        `Ch.${chNum}: possible foreign character-name contamination "${name}" x${count}; review manually if needed`
      );
    }

    setItemContent(item, content);
  }

  // v2: Explicit forbidden phrase contamination detection (not just character names)
  // Uses the shared safety gate module for consistency across all pipelines.
  for (const item of loaded) {
    const chNum = chapterNumber(item);
    const contamResult = detectProjectContamination(normalizeText(item.content), { project });
    if (contamResult.hasContamination) {
      for (const match of contamResult.matches) {
        if (match.severity === 'critical' || match.severity === 'high') {
          // Hard removal: strip the contaminated phrase
          const phraseRx = new RegExp(match.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const before = normalizeText(item.content);
          let cleaned = before.replace(phraseRx, '');
          // Clean up double spaces left by removal
          cleaned = cleaned.replace(/  +/g, ' ');
          if (cleaned !== before) {
            contaminationRemoved++;
            contaminationFound++;
            changes.push(`Ch.${chNum}: removed contamination "${match.phrase}"`);
            console.warn(`[CONTAMINATION] Removed forbidden phrase: "${match.phrase}" from Ch.${chNum}`);
            setItemContent(item, cleaned);
          }
        } else {
          contaminationFound++;
          warnings.push(`Ch.${chNum}: possible contamination "${match.phrase}" (severity: ${match.severity}); review manually`);
        }
      }
    }
  }

  console.log(
    `[ANTHOLOGY-POLISH] CONTAMINATION DETECTOR COMPLETE. Contamination hits: ${contaminationFound} | Removed safely: ${contaminationRemoved}`
  );

  return {
    changes,
    warnings,
    contaminationFound,
    contaminationRemoved,
  };
}

/**
 * Compatibility export for older polish/dashboard code.
 */
export async function runAnthologyHardErrorDetector(loaded = [], onProgress, project = {}) {
  console.log('[ANTHOLOGY-POLISH] ========== HARD ERROR DETECTOR START ==========');

  reportProgress(onProgress, 'Anthology polish: checking hard anthology errors safely…');

  const changes = [];
  const warnings = [];

  for (const item of loaded) {
    const chNum = chapterNumber(item);
    const text = normalizeText(item.content);

    if (!text || countWords(text) < 50) {
      warnings.push(`Ch.${chNum}: chapter is empty or too short`);
      continue;
    }

    if (/^(sure|certainly|okay|here is|here's|below is|the revised|the corrected)/i.test(text.slice(0, 250))) {
      warnings.push(`Ch.${chNum}: possible assistant preface at beginning`);
    }

    if (looksLikeOutlineOrNotes(text)) {
      warnings.push(`Ch.${chNum}: possible outline/notes/scaffold content detected`);
    }

    const hardArtifacts = text.match(/\b(TODO|FIXME|EDITOR NOTE|PLACEHOLDER|REWRITE THIS|DELETE THIS)\b/gi) || [];

    if (hardArtifacts.length) {
      warnings.push(`Ch.${chNum}: possible hard artifact(s): ${[...new Set(hardArtifacts)].join(', ')}`);
    }
  }

  console.log(`[ANTHOLOGY-POLISH] HARD ERROR DETECTOR COMPLETE. Warnings: ${warnings.length}`);

  return {
    changes,
    warnings,
    projectId: project?.id || '',
  };
}

/**
 * Compatibility export for older polish/dashboard code.
 *
 * This detects repeated chapter opening patterns across anthology chapters.
 * It does NOT rewrite chapter openings. It only reports warnings.
 */
export async function runChapterOpenerFrequencyDetector(loaded = [], onProgress, project = {}) {
  console.log('[ANTHOLOGY-POLISH] ========== CHAPTER OPENER FREQUENCY DETECTOR START ==========');

  reportProgress(onProgress, 'Anthology polish: checking repeated chapter opening patterns…');

  const changes = [];
  const warnings = [];
  const fingerprints = new Map();
  const starters = new Map();

  for (const item of loaded) {
    const chNum = chapterNumber(item);
    const text = normalizeText(item.content);

    if (!text || countWords(text) < 50) continue;

    const fingerprint = getOpeningFingerprint(text, 8);
    const starter = getOpeningStarter(text, 4);

    if (fingerprint && fingerprint.length >= 30) {
      if (!fingerprints.has(fingerprint)) fingerprints.set(fingerprint, []);
      fingerprints.get(fingerprint).push(chNum);
    }

    if (starter && starter.length >= 12) {
      if (!starters.has(starter)) starters.set(starter, []);
      starters.get(starter).push(chNum);
    }
  }

  for (const [fingerprint, chapterNums] of fingerprints.entries()) {
    if (chapterNums.length >= 2) {
      warnings.push(
        `Repeated opening fingerprint across chapters ${chapterNums.join(', ')}: "${fingerprint}"`
      );
    }
  }

  for (const [starter, chapterNums] of starters.entries()) {
    if (chapterNums.length >= 3) {
      warnings.push(
        `Repeated chapter opener starter across chapters ${chapterNums.join(', ')}: "${starter}"`
      );
    }
  }

  console.log(
    `[ANTHOLOGY-POLISH] CHAPTER OPENER FREQUENCY DETECTOR COMPLETE. Warnings: ${warnings.length}`
  );

  return {
    changes,
    warnings,
    projectId: project?.id || '',
  };
}

/**
 * Compatibility export for older polish/dashboard code.
 *
 * This caps repeated literary/atmospheric motif families conservatively.
 */
/**
 * WAVE7-ATMOGATE: this pass substitutes words inside five metaphor families
 * (water / textile / garden / architecture / math): current→force, structure→shape,
 * algorithm→process, and so on. In a literary collection those are stylistic tics
 * worth thinning. In a sci-fi, thriller or technical anthology they are
 * load-bearing nouns — "the ship's structure", "the tidal current", "the
 * algorithm" — and rewriting them silently corrupts the story.
 *
 * The call site has always documented this as "only fires for literary
 * anthologies, skipped silently for non-literary projects", and the report gates
 * on a `skipped` flag — but nothing ever inspected the project or returned that
 * flag, so it ran on everything. This is the gate that was described all along.
 */
const LITERARY_GENRE_RX = /literary|memoir|essay|slice.of.life|contemporary fiction|autofiction|magical realism/i;

export function isLiteraryProject(project = {}) {
  const hay = [project?.genre, project?.subgenre, project?.genre_group, project?.market_category, project?.anthology_theme_type]
    .map((v) => String(v || '')).join(' ');
  return LITERARY_GENRE_RX.test(hay);
}

export async function runLiteraryAtmosphericCap(loaded = [], onProgress, project = {}) {
  console.log('[ANTHOLOGY-POLISH] ========== LITERARY ATMOSPHERIC CAP START ==========');

  const changes = [];
  const warnings = [];
  let totalAdjusted = 0;

  // WAVE7-ATMOGATE: honour the documented literary-only contract.
  if (!isLiteraryProject(project)) {
    console.log('[ANTHOLOGY-POLISH] Atmospheric cap SKIPPED — not a literary project (genre:', project?.genre || 'unset', ')');
    return { changes, warnings, totalAdjusted: 0, skipped: true, skipReason: 'not a literary project', projectId: project?.id || '' };
  }

  reportProgress(onProgress, 'Anthology polish: checking literary/atmospheric repetition safely…');

  const families = [
    {
      group: 'water',
      phrases: ['tide', 'current', 'wave', 'flood', 'undertow', 'drowning', 'submerged'],
      maxPerChapter: 6,
      replacement: {
        tide: 'pull',
        current: 'force',
        wave: 'rush',
        flood: 'rush',
        undertow: 'drag',
        drowning: 'sinking',
        submerged: 'buried',
      },
    },
    {
      group: 'textile',
      phrases: ['thread', 'threads', 'woven', 'weave', 'fabric', 'tapestry', 'stitched'],
      maxPerChapter: 5,
      replacement: {
        thread: 'line',
        threads: 'lines',
        woven: 'made',
        weave: 'shape',
        fabric: 'surface',
        tapestry: 'pattern',
        stitched: 'fixed',
      },
    },
    {
      group: 'garden',
      phrases: ['seed', 'seeds', 'roots', 'rooted', 'bloom', 'blossom', 'flowering', 'soil'],
      maxPerChapter: 8,
      replacement: {
        seed: 'start',
        seeds: 'starts',
        roots: 'base',
        rooted: 'fixed',
        bloom: 'open',
        blossom: 'open',
        flowering: 'spreading',
        soil: 'ground',
      },
    },
    {
      group: 'architecture',
      phrases: ['architecture', 'scaffold', 'structure', 'foundation', 'framework', 'edifice'],
      maxPerChapter: 4,
      replacement: {
        architecture: 'structure',
        scaffold: 'frame',
        structure: 'shape',
        foundation: 'base',
        framework: 'frame',
        edifice: 'shape',
      },
    },
    {
      group: 'math',
      phrases: ['calculus', 'geometry', 'equation', 'metric', 'algorithm', 'formula'],
      maxPerChapter: 4,
      replacement: {
        calculus: 'logic',
        geometry: 'shape',
        equation: 'balance',
        metric: 'measure',
        algorithm: 'process',
        formula: 'pattern',
      },
    },
  ];

  for (const item of loaded) {
    const chNum = chapterNumber(item);
    let content = normalizeText(item.content);

    if (!content || countWords(content) < 50) continue;

    for (const family of families) {
      let familyCount = 0;

      for (const phrase of family.phrases) {
        familyCount += countOccurrences(content, phrase);
      }

      if (familyCount <= family.maxPerChapter) continue;

      const excess = familyCount - family.maxPerChapter;

      console.log(
        `[ANTHOLOGY-POLISH] Ch.${chNum}: "${family.group}" atmosphere family: ${familyCount} (excess: ${excess})`
      );

      warnings.push(
        `Ch.${chNum}: "${family.group}" atmosphere family appears ${familyCount}x; conservative cap attempted`
      );

      let remainingExcess = excess;

      for (const phrase of family.phrases) {
        if (remainingExcess <= 0) break;

        const replacement = family.replacement?.[phrase];
        if (!replacement) continue;

        const rx = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
        let replacedHere = 0;

        content = content.replace(rx, (match) => {
          if (remainingExcess <= 0) return match;

          remainingExcess -= 1;
          replacedHere += 1;

          return preserveCaseReplacement(match, replacement);
        });

        if (replacedHere > 0) {
          totalAdjusted += replacedHere;
          changes.push(
            `Ch.${chNum}: reduced "${family.group}" atmosphere repetition by replacing "${phrase}" x${replacedHere}`
          );
        }
      }
    }

    setItemContent(item, content);
  }

  console.log(
    `[ANTHOLOGY-POLISH] LITERARY ATMOSPHERIC CAP COMPLETE. Adjusted: ${totalAdjusted}`
  );

  return {
    changes,
    warnings,
    totalAdjusted,
    skipped: false, // WAVE7-ATMOGATE
    projectId: project?.id || '',
  };
}

/**
 * Compatibility export for older polish/dashboard code.
 *
 * This detects repeated narrative clusters across anthology chapters.
 * Conservative version:
 * - Does not rewrite.
 * - Does not delete.
 * - Only reports warnings so manuscriptFixer can decide what matters.
 */
export async function runNarrativeClusterDetector(loaded = [], onProgress, project = {}) {
  console.log('[ANTHOLOGY-POLISH] ========== NARRATIVE CLUSTER DETECTOR START ==========');

  reportProgress(onProgress, 'Anthology polish: checking repeated narrative clusters safely…');

  const changes = [];
  const warnings = [];

  const clusterFamilies = [
    {
      group: 'clinical-control',
      phrases: [
        'system',
        'procedure',
        'protocol',
        'metric',
        'yield',
        'compliance',
        'efficiency',
        'asset',
      ],
      warningAt: 28,
    },
    {
      group: 'religious-sacrament',
      phrases: [
        'sacrament',
        'offering',
        'altar',
        'liturgy',
        'prayer',
        'holy',
        'purification',
        'faith',
      ],
      warningAt: 24,
    },
    {
      group: 'aristocratic-acquisition',
      phrases: [
        'connoisseur',
        'product',
        'essence',
        'inspection',
        'purchase',
        'contract',
        'inventory',
        'acquire',
      ],
      warningAt: 22,
    },
    {
      group: 'breaking-surrender',
      phrases: [
        'submission',
        'surrender',
        'will',
        'resistance',
        'break',
        'broken',
        'endure',
        'lesson',
      ],
      warningAt: 28,
    },
    {
      group: 'botanical-organic',
      phrases: [
        'soil',
        'roots',
        'pollen',
        'greenhouse',
        'flower',
        'bloom',
        'seed',
        'garden',
      ],
      warningAt: 24,
    },
    {
      group: 'generic-ai-interiority',
      phrases: [
        'something hot',
        'something between',
        'didn’t have a name',
        "didn't have a name",
        'not quite anger',
        'not quite panic',
        'the weight of',
        'the shape of',
        'the truth of',
      ],
      warningAt: 10,
    },
  ];

  for (const item of loaded) {
    const chNum = chapterNumber(item);
    const text = normalizeText(item.content);

    if (!text || countWords(text) < 50) continue;

    for (const family of clusterFamilies) {
      let total = 0;

      for (const phrase of family.phrases) {
        total += countOccurrences(text, phrase);
      }

      if (total >= family.warningAt) {
        warnings.push(
          `Ch.${chNum}: narrative cluster "${family.group}" appears ${total}x; review for repetitive anthology texture`
        );

        console.log(
          `[ANTHOLOGY-POLISH] Ch.${chNum}: narrative cluster "${family.group}" = ${total}`
        );
      }
    }
  }

  console.log(
    `[ANTHOLOGY-POLISH] NARRATIVE CLUSTER DETECTOR COMPLETE. Warnings: ${warnings.length}`
  );

  return {
    changes,
    warnings,
    projectId: project?.id || '',
  };
}

export default {
  runCrossChapterBodyLanguageDedup,
  runAnthologyVocabBans,
  runContaminationDetector,
  runAnthologyHardErrorDetector,
  runChapterOpenerFrequencyDetector,
  runLiteraryAtmosphericCap,
  runNarrativeClusterDetector,
};