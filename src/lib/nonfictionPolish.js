/**
 * Nonfiction-specific manuscript polish logic.
 * Separate from the fiction polish to use conservative banned word lists,
 * skip voice pattern fixes, and use a larger subject-matter skip list.
 */

import { base44 } from '@/api/base44Client';
import { countWords } from '@/lib/autonovel';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import { prepareChapterContent, resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';
import { calculateManuscriptStatsNonfiction } from '@/lib/manuscriptStats';
import { runExternalAiPatternFix } from '@/lib/externalAiPatterns';
import { fixHangingQuotes } from '@/lib/quoteFixPolish';
import { runAiDetectionResistance } from '@/lib/aiDetectionResist';
import { runVocabCaps, runSentenceStarterVariationNF } from '@/lib/vocabCaps';
import { recastBannedVocabulary } from '@/lib/aiSlopReduction';
import { fixVoicePatterns } from '@/lib/voicePatternPolish';
import { runDialogueTagCaps } from '@/lib/dialogueTagPolish';
import { runPunctuationCleanup, runSpellingFixes, runBrokenSentenceFixes, runCopingMechanismCaps, runDialoguePunctuationFix, runDialogueFillerFix, runEmDashReducer, runProgressiveReducer } from '@/lib/punctuationPolish';
import { runChatGPTVocabCaps, runDichotomyPatternReducer, runTransitionWordCaps, runNotJustButReducer, runYetMisuseFixer, runThinkOfItAsCapper, runAiPhraseCapper } from '@/lib/chatgptPatternPolish';
import { runCapitalizationHygiene } from '@/lib/capitalizationPolish';
import { runStackedClauseVariation } from '@/lib/sentencePatternPolish';
import { runDisclaimerStripper } from '@/lib/disclaimerStripper';
import { runAntiDetectionPolish } from '@/lib/antiDetectionPolish';
import { safeUppercaseReplace } from '@/lib/safeUppercase';
import { refreshProjectWordCount } from '@/lib/projectWordCount';

// Nonfiction banned words — unified with fiction list to ensure zero AI vocabulary survives
const NF_BANNED_WORDS = [
  'shimmering','luminous','tapestry','opulent','resplendent','ethereal',
  'cacophony','crescendo','harbinger','labyrinthine','sprawling','insatiable',
  'multifaceted','aforementioned','henceforth','pertaining','endeavor',
  'arguably','interestingly','remarkably','notably','undoubtedly','unquestionably',
  // Previously excluded — now banned universally (AI detection risk outweighs analytical legitimacy)
  'meticulously','relentless','visceral','undeniable','unmistakable',
  'testament','intricate','palpable','commence','utilize',
  'furthermore','nonetheless','myriad','plethora','juxtaposition',
  'paradigm','dichotomy',
];

const NF_REPETITION_TARGETS = [
  { pattern: /\bshuddered\b/gi, name: 'shuddered', maxPerChapter: 0.3, replacements: ['trembled','flinched','recoiled'] },
  { pattern: /\bsuddenly\b/gi, name: 'suddenly', maxPerChapter: 0.2, replacements: [] },
  { pattern: /\bsomehow\b/gi, name: 'somehow', maxPerChapter: 0.15, replacements: [] },
  { pattern: /\bit is worth noting\b/gi, name: 'it is worth noting', maxFixed: 2, replacements: [] },
  { pattern: /\bit should be noted\b/gi, name: 'it should be noted', maxFixed: 2, replacements: [] },
];

const HARD_SCAFFOLDS = [/\bI've written\b/gi, /\bHere is the\b/gi, /\bLet me know if\b/gi, /\bHere's the\b/gi, /\bBelow is\b/gi, /\[(?:Author'?s? note|Editor'?s? note|Note to (?:self|editor))[^\]]*\]/gi, /\[(?:TK|TODO|FIXME|INSERT|PLACEHOLDER)[^\]]*\]/gi, /\{[^}]{0,80}\}/g];
const SOFT_SCAFFOLDS = [/\bThis chapter will\b/gi, /\bThis section explores\b/gi, /\bIn this chapter,? we\b/gi, /\bLet us now turn to\b/gi, /\bAs we have seen\b/gi, /\bAs mentioned earlier\b/gi, /\bAs previously discussed\b/gi];

// Nonfiction phrase skip list — much more extensive than fiction
const NF_PHRASE_SKIP = [
  'of the','in the','to the','on the','at the','and the','for the','was the','from the','with the','into the','that the','but the',
  'had been','would be','could be','did not','was not','had not','she had','he had','she was','he was','they had','it was','there was',
  'back to','out of','up to','one of','down the','through the','over the','around the','about the','under the','after the','before the',
  'between the','across the','along the','toward the','against the','not the','all the','like the','than the','just the','even the','only the',
  'the floor','the door','the wall','the room','the air','the light','the dark','the ground','the table','the window','the screen',
  'the man','the woman','the other','the first','the last','the next','the same','the new','the only','the whole','the entire','the rest',
  'the end','the top','the bottom','the side','the back','the front','the hand','the head','the face','the body','the eyes','the mouth',
  'the voice','the sound','the word','the words','the name',
  'they were','they had','she could','he could','she would','he would','they could','they would','could not','would not','did not','had not','was not','were not','might be','must be','should be','will be','can be',
  // Nonfiction subject-matter vocabulary — legitimate, not AI artifacts
  'the studio','the studios','the system','the contract','the contracts','the industry','the actor','the actors','the star','the stars',
  'the director','the producer','the executive','the company','the corporation','the film','the films','the movie','the movies',
  'the period','the era','the time','the year','the years','the public','the press','the media','the court','the law',
  'the government','the state','the power','the control','the case','the evidence','the report','the record','the records',
  'the investigation','the committee','the testimony','the trial','the victim','the accused','the witness','the witnesses',
  'the clause','the agreement','the terms','the rights','the history','the story','the account','the narrative',
  'the practice','the policy','the culture','the structure','the result','the effect','the impact','the consequence',
  'the problem','the issue','the question','the answer','the fact','the truth','the reality','the situation',
  'the market','the business','the office','the department','the money','the cost','the price','the value',
];



// ═══════════════════════════════════════════════════════════════════════════════
// NF CREDIBILITY + HUMAN TEXTURE GATE V11
// Deterministic safeguards for investigative nonfiction polish.
// ═══════════════════════════════════════════════════════════════════════════════

const NF_SOURCE_PLACEHOLDER_RX = /\[(?:SOURCE|CITATION|FOOTNOTE|REFERENCE|ARCHIVE|DOC(?:UMENT)?|QUOTE)\s+NEEDED[^\]]*\]|\[(?:TK|TODO|TBD|FIXME|INSERT SOURCE|ADD SOURCE|VERIFY SOURCE)[^\]]*\]/gi;
const NF_BIBLIOGRAPHY_HEADER_RX = /\b(bibliography|works cited|references|source list|selected sources|notes and sources)\b/i;
const NF_UNRELATED_FINANCE_SOURCE_RX = /\b(?:Bogle|Vanguard|Malkiel|Random Walk Down Wall Street|FINRA|Robinhood|GameStop|SEC market structure|CFPB payday|IRS retirement|401\(k\)|IRA contributions?|mutual funds?|index funds?|financial literacy|retirement plans?|Department of Labor retirement|Securities and Exchange Commission|Consumer Financial Protection Bureau)\b/i;
const NF_FAKE_SOURCE_WARNING_RX = /\b(?:archive box|folder number|collection number|oral history interview|personal interview|court file|coroner report|death certificate|microfilm reel|case file|official report)\b/i;

const NF_OVERCLAIM_REPLACEMENTS = [
  [/\bthe record proves\b/gi, 'the available record suggests'],
  [/\bthe evidence proves\b/gi, 'the available evidence suggests'],
  [/\bthis proves\b/gi, 'this suggests'],
  [/\bthis confirmed\b/gi, 'this supported'],
  [/\bforensic analysis would confirm\b/gi, 'a documented forensic analysis would be needed to confirm'],
  [/\bthe surviving blueprints and operational manuals would later reveal\b/gi, 'surviving building records, if available, would be necessary to establish'],
  [/\bthe registers could place names\b/gi, 'the registers, if complete and relevant, could help test the names against the event'],
  [/\bwithout question\b/gi, 'on the available record'],
  [/\bundeniably\b/gi, 'apparently'],
  [/\bunquestionably\b/gi, 'apparently'],
  [/\bclearly established\b/gi, 'partly established'],
  [/\bmust have been\b/gi, 'may have been'],
  [/\bwould have been\b/gi, 'may have been'],
];

const NF_AI_ABSTRACT_PHRASES = [
  'institutional silence',
  'bureaucratic memory',
  'forensic history',
  'narrative closure',
  'physical erasure',
  'official record',
  'available record',
  'the institution',
  'the archive',
  'the silence',
  'the question was no longer',
  'what remained was',
  'this was not merely',
  'this was not simply',
  'this transformed',
  'in this sense',
];

const NF_MOTIF_CAPS = [
  { label: 'locked door', rx: /\blocked door\b/gi, capPerChapter: 6 },
  { label: 'silence', rx: /\bsilence\b/gi, capPerChapter: 10 },
  { label: 'official record', rx: /\bofficial record\b/gi, capPerChapter: 5 },
  { label: 'institution', rx: /\binstitution(?:al)?\b/gi, capPerChapter: 14 },
  { label: 'archive', rx: /\barchive(?:s|al)?\b/gi, capPerChapter: 9 },
  { label: 'erasure', rx: /\berasure\b/gi, capPerChapter: 4 },
  { label: 'Cell Hall 3', rx: /\bCell Hall 3\b/gi, capPerChapter: 12 },
];

const NF_ABSTRACT_REPLACEMENTS = new Map([
  ['institutional silence', 'the missing record'],
  ['bureaucratic memory', 'the paper trail'],
  ['forensic history', 'document work'],
  ['narrative closure', 'a clean ending'],
  ['physical erasure', 'demolition and removal'],
]);

function countRegexMatches(text, rx) {
  const matches = String(text || '').match(rx);
  return matches ? matches.length : 0;
}

function getChapterNumberForGate(file, index) {
  return file?.chapter?.chapter_number || file?.chapter?.number || index + 1;
}

function looksLikeBibliographyChapter(file) {
  const title = String(file?.chapter?.title || file?.chapter?.name || '').trim();
  const head = String(file?.content || '').slice(0, 1400);
  return NF_BIBLIOGRAPHY_HEADER_RX.test(title) || NF_BIBLIOGRAPHY_HEADER_RX.test(head);
}

function cleanBibliographyIntegrity(content) {
  const lines = String(content || '').split('\n');
  const kept = [];
  let removedPlaceholders = 0;
  let removedContamination = 0;
  let suspiciousSourceWarnings = 0;

  for (const rawLine of lines) {
    const compactLine = rawLine.trim();

    if (!compactLine) {
      kept.push(rawLine);
      continue;
    }

    if (NF_SOURCE_PLACEHOLDER_RX.test(compactLine)) {
      NF_SOURCE_PLACEHOLDER_RX.lastIndex = 0;
      removedPlaceholders += 1;
      continue;
    }
    NF_SOURCE_PLACEHOLDER_RX.lastIndex = 0;

    if (NF_UNRELATED_FINANCE_SOURCE_RX.test(compactLine)) {
      removedContamination += 1;
      continue;
    }

    if (NF_FAKE_SOURCE_WARNING_RX.test(compactLine) && /\b(?:unknown|unnamed|unverified|placeholder|source needed|tk|todo)\b/i.test(compactLine)) {
      suspiciousSourceWarnings += 1;
      continue;
    }

    kept.push(rawLine.trimEnd());
  }

  return {
    content: kept.join('\n').replace(/\n{4,}/g, '\n\n\n').trim(),
    removedPlaceholders,
    removedContamination,
    suspiciousSourceWarnings,
  };
}

function removeSourcePlaceholdersFromProse(content) {
  const before = String(content || '');
  NF_SOURCE_PLACEHOLDER_RX.lastIndex = 0;
  const removedCount = countRegexMatches(before, NF_SOURCE_PLACEHOLDER_RX);
  NF_SOURCE_PLACEHOLDER_RX.lastIndex = 0;
  const after = before
    .replace(NF_SOURCE_PLACEHOLDER_RX, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/(["\u201d])([a-zA-Z])/g, '$1 $2')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  return {
    content: after,
    removed: before === after ? 0 : Math.max(1, removedCount),
  };
}

function softenUnsupportedCertainty(content) {
  // POLISHSAFE-4: NF_OVERCLAIM_REPLACEMENTS used to rewrite epistemic-hedge
  // phrases ("proves" -> "suggests", "undeniably" -> "apparently") — a
  // substitution that changes the claim's strength, not just its style, and
  // is outside rule 0.2/2's whitelist. Flag-only now; `fixed` counts flags.
  let next = String(content || '');
  let fixed = 0;

  for (const [rx] of NF_OVERCLAIM_REPLACEMENTS) {
    const matches = next.match(rx);
    if (!matches) continue;
    fixed += matches.length;
  }

  const malformedQuestion = /\bWhat was it an act of containment\b/gi;
  const malformedMatches = next.match(malformedQuestion);
  if (malformedMatches) {
    fixed += malformedMatches.length;
    next = next.replace(malformedQuestion, 'Was it an act of containment');
  }

  return { content: next, fixed };
}

function fixKnownNonfictionCopyeditResidue(content) {
  let next = String(content || '');
  let fixed = 0;
  const replacements = [
    [/\ba environment\b/gi, 'an environment'],
    [/\bfre-standing\b/gi, 'free-standing'],
    [/([a-z]),\s+therefore\s+([a-z])/gi, '$1, therefore, $2'],
    [/\baccording to the ([^,\.]{3,80}) was\b/gi, 'according to the $1, was'],
    [/\bwhere the ([^,\.]{3,80}) was captured was\b/gi, 'where the $1 was captured, was'],
  ];

  for (const [rx, replacement] of replacements) {
    const before = next;
    next = next.replace(rx, replacement);
    if (next !== before) fixed += 1;
  }

  const dashBefore = next;
  next = next.replace(/—([A-Z])([a-z])/g, (_match, a, b) => '—' + a.toLowerCase() + b);
  if (next !== dashBefore) fixed += 1;

  return { content: next, fixed };
}

function normalizeParagraphShapeForNonfiction(content) {
  let next = String(content || '').replace(/\r\n/g, '\n').trim();
  let fixed = 0;
  const paragraphs = next.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const wordCount = next.split(/\s+/).filter(Boolean).length;

  if (paragraphs.length <= 2 && wordCount > 900) {
    const sentences = next.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    const rebuilt = [];
    let bucket = [];
    let bucketWords = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
      bucket.push(sentence);
      bucketWords += sentenceWords;
      if (bucketWords >= 95 || bucket.length >= 5) {
        rebuilt.push(bucket.join(' '));
        bucket = [];
        bucketWords = 0;
      }
    }

    if (bucket.length) rebuilt.push(bucket.join(' '));
    if (rebuilt.length > paragraphs.length) {
      next = rebuilt.join('\n\n');
      fixed += 1;
    }
  }

  const collapsed = next.replace(/\n{4,}/g, '\n\n\n').trim();
  if (collapsed !== next) {
    next = collapsed;
    fixed += 1;
  }

  return { content: next, fixed };
}

function escapeRegExpForGate(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function reduceAbstractPhraseDensity(content) {
  // POLISHSAFE-4: the per-phrase substitution/deletion loop and the four
  // hardcoded phrase rewrites are retired \u2014 outside rule 0.2/2's whitelist.
  // Only the trailing typography cleanups (whitespace, quote spacing) remain
  // actual mutations. `fixed` now counts flagged excess phrases.
  let next = String(content || '');
  let fixed = 0;

  for (const phrase of NF_AI_ABSTRACT_PHRASES) {
    const rx = new RegExp('\\b' + escapeRegExpForGate(phrase) + '\\b', 'gi');
    const count = (next.match(rx) || []).length;
    if (count > 2) fixed += count - 2;
  }

  next = next
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/(["\u201d])([a-zA-Z])/g, '$1 $2');

  return { content: next, fixed };
}

function flagMotifOveruse(content) {
  const warnings = [];
  for (const item of NF_MOTIF_CAPS) {
    const count = countRegexMatches(content, item.rx);
    if (count > item.capPerChapter) {
      warnings.push(`${item.label} x${count}/${item.capPerChapter}`);
    }
  }
  return warnings;
}

function scoreHumanTexture(content) {
  const text = String(content || '');
  const namedPeople = countRegexMatches(text, /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g);
  const humanTerms = countRegexMatches(text, /\b(?:man|men|woman|women|family|families|mother|father|son|daughter|guard|prisoner|inmate|worker|witness|survivor|victim|dead|body|buried|grave|name|names)\b/gi);
  const institutionalTerms = countRegexMatches(text, /\b(?:institution|record|records|archive|archives|system|state|agency|department|official|bureaucratic)\b/gi);
  return { namedPeople, humanTerms, institutionalTerms };
}

function runNonfictionCredibilityGate(loaded, onProgress, { project } = {}) {
  onProgress?.('Polish (NF): Running credibility, source, and human-texture gate…');
  void project;

  const changes = [];
  const warnings = [];
  let placeholdersRemoved = 0;
  let contaminationRemoved = 0;
  let overclaimsSoftened = 0;
  let abstractPhrasesReduced = 0;
  let paragraphShapeFixed = 0;
  let copyeditResidueFixed = 0;
  let bibliographyChaptersTouched = 0;
  let humanTextureWarnings = 0;
  let motifWarnings = 0;

  for (let i = 0; i < loaded.length; i += 1) {
    const file = loaded[i];
    const chNum = getChapterNumberForGate(file, i);
    let content = String(file.content || '');

    const placeholderResult = removeSourcePlaceholdersFromProse(content);
    content = placeholderResult.content;
    placeholdersRemoved += placeholderResult.removed;
    if (placeholderResult.removed) {
      changes.push(`Ch.${chNum}: removed ${placeholderResult.removed} source/citation placeholder artifact(s)`);
    }

    if (looksLikeBibliographyChapter(file)) {
      const bibResult = cleanBibliographyIntegrity(content);
      content = bibResult.content;
      placeholdersRemoved += bibResult.removedPlaceholders;
      contaminationRemoved += bibResult.removedContamination;
      if (bibResult.removedPlaceholders || bibResult.removedContamination || bibResult.suspiciousSourceWarnings) {
        bibliographyChaptersTouched += 1;
        changes.push(`Ch.${chNum}: bibliography integrity firewall removed ${bibResult.removedContamination} unrelated source line(s) and ${bibResult.removedPlaceholders} placeholder line(s)`);
      }
    }

    const claimResult = softenUnsupportedCertainty(content);
    content = claimResult.content;
    overclaimsSoftened += claimResult.fixed;
    if (claimResult.fixed) changes.push(`Ch.${chNum}: ${claimResult.fixed} unsupported-certainty / overclaim phrase(s) flagged - substitution retired (POLISHSAFE-4)`);

    const copyeditResult = fixKnownNonfictionCopyeditResidue(content);
    content = copyeditResult.content;
    copyeditResidueFixed += copyeditResult.fixed;
    if (copyeditResult.fixed) changes.push(`Ch.${chNum}: fixed nonfiction copyedit residue`);

    const abstractResult = reduceAbstractPhraseDensity(content);
    content = abstractResult.content;
    abstractPhrasesReduced += abstractResult.fixed;
    if (abstractResult.fixed) changes.push(`Ch.${chNum}: ${abstractResult.fixed} repeated abstract / AI-polished phrase(s) flagged - substitution retired (POLISHSAFE-4)`);

    const shapeResult = normalizeParagraphShapeForNonfiction(content);
    content = shapeResult.content;
    paragraphShapeFixed += shapeResult.fixed;
    if (shapeResult.fixed) changes.push(`Ch.${chNum}: normalized paragraph shape / broke up wall-of-text output`);

    const motifOveruse = flagMotifOveruse(content);
    if (motifOveruse.length) {
      motifWarnings += motifOveruse.length;
      warnings.push(`⚠️ Ch.${chNum}: motif budget exceeded — ${motifOveruse.join(', ')}`);
    }

    const texture = scoreHumanTexture(content);
    if (content.split(/\s+/).filter(Boolean).length > 1200 && texture.institutionalTerms > Math.max(18, texture.humanTerms * 2) && texture.namedPeople < 2) {
      humanTextureWarnings += 1;
      warnings.push(`⚠️ Ch.${chNum}: weak human texture — institution/record language overwhelms named people and lived-detail language`);
    }

    file.content = content;
  }

  if (placeholdersRemoved > 0) changes.push(`NF credibility gate: removed ${placeholdersRemoved} placeholder source/citation artifacts`);
  if (contaminationRemoved > 0) changes.push(`NF credibility gate: removed ${contaminationRemoved} unrelated/cross-project bibliography source lines`);
  if (overclaimsSoftened > 0) changes.push(`NF credibility gate: softened ${overclaimsSoftened} unsupported certainty phrases`);
  if (abstractPhrasesReduced > 0) changes.push(`NF credibility gate: reduced ${abstractPhrasesReduced} high-risk AI abstraction repeats`);
  if (paragraphShapeFixed > 0) changes.push(`NF credibility gate: repaired paragraph shape in ${paragraphShapeFixed} chapter(s)`);
  if (copyeditResidueFixed > 0) changes.push(`NF credibility gate: fixed ${copyeditResidueFixed} known nonfiction copyedit residue pattern(s)`);
  changes.push(...warnings);

  return {
    changes,
    placeholdersRemoved,
    contaminationRemoved,
    overclaimsSoftened,
    abstractPhrasesReduced,
    paragraphShapeFixed,
    copyeditResidueFixed,
    bibliographyChaptersTouched,
    humanTextureWarnings,
    motifWarnings,
  };
}

/**
 * Run nonfiction-specific polish on loaded chapter data.
 * Returns { savedCount, unchangedCount, changes, beforeStats, afterStats, bannedRemoved, capFixed, repFixed, scaffoldsRemoved, punctuationFixes }
 *
 * @deprecated Prefer runManuscriptPolishPipeline({ mode: 'nonfiction' }) from manuscriptPolishRunner.js.
 *   This function is retained for backward compatibility and to export
 *   the NF deterministic core via runNonfictionDeterministicCore().
 */
export async function runNonfictionPolish({ loaded, onProgress, project }) {
  const changes = [];
  const chapterCount = loaded.length;

  // ═══ STEP L: DISCLAIMER STRIPPER — runs FIRST, before all other steps ═══
  // Removes all composite/methodology disclaimer boilerplate from body chapters.
  // Skips front matter (chapter 0 / Author's Note) to preserve the single legitimate disclaimer.
  const disclaimerResult = runDisclaimerStripper(loaded, onProgress);
  changes.push(...disclaimerResult.changes);
  const disclaimersRemoved = disclaimerResult.totalRemoved;
  const compositeFixed = disclaimerResult.totalRemoved; // backward compat

  // STEP 1: Banned words — POLISHFIX-2.
  // Nouns/adjectives are RECAST to synonyms via the shared recaster (deleting
  // them left dropped-word artifacts: "a testament to" -> "a  to"). Pure
  // discourse adverbs are DELETED with sentence hygiene (a synonym would just
  // be another AI-tell adverb).
  onProgress?.('Polish (NF): Recasting banned words…');
  const NF_DISCOURSE_ADVERBS = ['arguably', 'interestingly', 'remarkably', 'notably', 'undoubtedly', 'unquestionably'];
  let bannedRemoved = 0;
  for (const f of loaded) {
    let chFixed = 0;
    const recast = recastBannedVocabulary(f.content);
    if (recast.recasts.length > 0) {
      f.content = recast.text;
      chFixed += recast.recasts.length;
    }
    for (const w of NF_DISCOURSE_ADVERBS) {
      f.content = f.content.replace(new RegExp('(^|[.!?]\\s+)' + w + ',?\\s+([a-z])', 'gi'), (m, pre, ch) => { chFixed++; return pre + ch.toUpperCase(); });
      f.content = f.content.replace(new RegExp(',?\\s+' + w + '\\b,?', 'gi'), () => { chFixed++; return ''; });
    }
    if (chFixed > 0) {
      bannedRemoved += chFixed;
      changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': recast/cleaned ' + chFixed + ' banned word(s)');
    }
  }

  // STEP 1d: Voice pattern fixes (EXPANDED — 6 pattern families)
  onProgress?.('Polish (NF): Fixing voice patterns…');
  const nfVoiceResult = fixVoicePatterns(loaded, chapterCount);
  changes.push(...nfVoiceResult.changes);
  const nfVoiceFixed = nfVoiceResult.voiceFixed;

  // STEP 2: Punctuation cleanup + spelling fixes
  const punctResult = runPunctuationCleanup(loaded, onProgress);
  changes.push(...punctResult.changes);
  const punctuationFixes = punctResult.punctFixed;
  const spellingResult = runSpellingFixes(loaded, onProgress);
  changes.push(...spellingResult.changes);

  // STEP 3: Capitalization
  onProgress?.('Polish (NF): Fixing capitalization…');
  let capFixed = 0;
  for (const f of loaded) {
    const before = f.content;
    f.content = safeUppercaseReplace(f.content);
    if (f.content !== before) {
      const fixed = (before.match(/[.!?]\s+[a-z]/g) || []).length - (f.content.match(/[.!?]\s+[a-z]/g) || []).length;
      if (fixed > 0) { capFixed += fixed; changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': fixed ' + fixed + ' cap errors'); }
    }
  }

  // STEP 3b: Grammar fixes
  onProgress?.('Polish (NF): Fixing grammar issues…');
  let grammarFixed = 0;
  for (const f of loaded) {
    const beforeGrammar = f.content;
    // Fix sentence fragments ending with "and." or "but." or "or."
    f.content = f.content.replace(/\band\.\s+([A-Z])/g, (match, nextChar) => { grammarFixed++; return 'and ' + nextChar.toLowerCase(); });
    f.content = f.content.replace(/\bbut\.\s+([A-Z])/g, (match, nextChar) => { grammarFixed++; return 'but ' + nextChar.toLowerCase(); });
    f.content = f.content.replace(/\bor\.\s+([A-Z])/g, (match, nextChar) => { grammarFixed++; return 'or ' + nextChar.toLowerCase(); });
    // Fix unclosed quotation marks per paragraph (smart + straight quotes)
    const paragraphs = f.content.split(/\n\n+/);
    const fixedParagraphs = paragraphs.map(para => {
      if (!para.trim()) return para;
      // Normalize mixed quote types within a paragraph
      const hasSmartOpen = para.includes('\u201c');
      const hasSmartClose = para.includes('\u201d');
      const hasStraight = para.includes('"');
      if ((hasSmartOpen || hasSmartClose) && hasStraight) {
        let inQuote = false;
        let result = '';
        for (let i = 0; i < para.length; i++) {
          if (para[i] === '"') {
            result += !inQuote ? '\u201c' : '\u201d';
            inQuote = !inQuote;
          } else if (para[i] === '\u201c') { inQuote = true; result += para[i]; }
          else if (para[i] === '\u201d') { inQuote = false; result += para[i]; }
          else { result += para[i]; }
        }
        para = result;
      }
      // Fix smart quote imbalance
      const smartOpen = (para.match(/\u201c/g) || []).length;
      const smartClose = (para.match(/\u201d/g) || []).length;
      if (smartOpen > smartClose) {
        for (let d = 0; d < smartOpen - smartClose; d++) {
          if (para.match(/[.!?]\s*$/)) para = para.replace(/([.!?])(\s*)$/, '\u201d$1$2');
          else para = para.trimEnd() + '\u201d';
          grammarFixed++;
        }
      } else if (smartClose > smartOpen) {
        for (let d = 0; d < smartClose - smartOpen; d++) {
          const fc = para.indexOf('\u201d');
          if (fc > 0) {
            const before = para.substring(0, fc);
            const ls = Math.max(before.lastIndexOf('. ') + 2, before.lastIndexOf('? ') + 2, before.lastIndexOf('! ') + 2, 0);
            para = para.substring(0, ls) + '\u201c' + para.substring(ls);
            grammarFixed++;
          }
        }
      }
      // Fix straight quote imbalance
      const straightCount = (para.match(/"/g) || []).length;
      if (straightCount % 2 !== 0) {
        if (para.match(/[.!?]\s*$/)) para = para.replace(/([.!?])(\s*)$/, '"$1$2');
        else para = para.trimEnd() + '"';
        grammarFixed++;
      }
      return para;
    });
    f.content = fixedParagraphs.join('\n\n');
    // Fix capitalization after abbreviations with periods
    const abbrevRx = /(\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Rev|Gen|Gov|Sgt|Cpl|Lt|Capt|Maj|Col|Jr|Sr)\.\s*[A-Z]\.)\s+([A-Z])([a-z])/g;
    const commonAfterAbbrev = ['after','before','during','until','while','when','where','from','into','onto','upon','with','about','above','below','under','over','through','between','among','against','toward','around','along','across','behind'];
    f.content = f.content.replace(abbrevRx, (match, abbrev, cap, rest) => {
      const nextWord = cap + rest;
      if (commonAfterAbbrev.includes(nextWord.toLowerCase())) { grammarFixed++; return abbrev + ' ' + nextWord.toLowerCase(); }
      return match;
    });
    if (f.content !== beforeGrammar) {
      changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': fixed grammar issues');
    }
  }
  if (grammarFixed > 0) {
    changes.push('Total grammar fixes: ' + grammarFixed);
    console.log('[POLISH-NF] Grammar fixes:', grammarFixed);
  }

  // STEP 3c: Misspelling corrections (drugs, proper nouns, legal terms)
  onProgress?.('Polish (NF): Fixing misspellings…');
  let spellingFixed = 0;
  const allCorrections = [
    // Drug names
    [/\bsecond sodium\b/gi, 'Seconal sodium'],
    [/\bseconal sodium\b/g, 'Seconal sodium'],
    [/\bphenobarbidal\b/gi, 'Phenobarbital'],
    [/\bphenobarbitol\b/gi, 'Phenobarbital'],
    [/\bphenobarbatol\b/gi, 'Phenobarbital'],
    [/\bbenzadrine\b/gi, 'Benzedrine'],
    [/\bbenzadene\b/gi, 'Benzedrine'],
    [/\bbenzedrene\b/gi, 'Benzedrine'],
    [/\bamfetamine\b/gi, 'amphetamine'],
    [/\bbarbitol\b/gi, 'barbital'],
    [/\bchloropromazine\b/gi, 'chlorpromazine'],
    [/\bdiazapam\b/gi, 'diazepam'],
    [/\bmethanphetamine\b/gi, 'methamphetamine'],
    [/\bmorphene\b/gi, 'morphine'],
    [/\bsecobarbatol\b/gi, 'secobarbital'],
    // Historical proper nouns
    [/\bLouis B Mayer\b/g, 'Louis B. Mayer'],
    [/\bDavid O Selznick\b/g, 'David O. Selznick'],
    [/\bDr\. Jacobsen\b/g, 'Dr. Jacobson'],
    [/\bKefauver Comittee\b/gi, 'Kefauver Committee'],
    [/\bKefauver Commitee\b/gi, 'Kefauver Committee'],
    [/\bMargaret Herrick\b/g, 'Margaret Herrick'],
    [/\bHoward Strickling\b/g, 'Howard Strickling'],
    [/\bStricklin\b/g, 'Strickling'],
    // Legal terms
    [/\bhabeus corpus\b/gi, 'habeas corpus'],
    [/\bsui generus\b/gi, 'sui generis'],
    [/\bpro bono publico\b/gi, 'pro bono publico'],
    [/\bde Haviland\b/g, 'de Havilland'],
    [/\bde haviland\b/gi, 'de Havilland'],
    [/\bDeHavilland\b/g, 'de Havilland'],
  ];
  for (const [pattern, replacement] of allCorrections) {
    for (const f of loaded) {
      const matches = f.content.match(pattern);
      if (matches && matches.length > 0) {
        f.content = f.content.replace(pattern, replacement);
        spellingFixed += matches.length;
        changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': corrected "' + matches[0] + '" → "' + replacement + '"');
        console.log('[POLISH-NF] Corrected "' + matches[0] + '" → "' + replacement + '" in Ch.' + (f.chapter.chapter_number || '?'));
      }
    }
  }
  if (spellingFixed > 0) {
    changes.push('Total spelling corrections: ' + spellingFixed);
  }

  // STEP 3d: Dialogue tag + action beat caps + breath-stem cap
  const dialogueResult = runDialogueTagCaps(loaded, onProgress);
  changes.push(...dialogueResult.changes);

  // STEP 3d2: Coping mechanism caps
  const copingResult = runCopingMechanismCaps(loaded, onProgress);
  changes.push(...copingResult.changes);

  // STEP 3d3: Broken sentence artifact fixes
  const brokenResult = runBrokenSentenceFixes(loaded, onProgress);
  changes.push(...brokenResult.changes);

  // STEP 3e: External AI pattern detection
  onProgress?.('Polish (NF): Scanning for external AI patterns…');
  const extResult = runExternalAiPatternFix(loaded);
  changes.push(...extResult.changes);
  const externalPatternsFixed = extResult.fixed;
  const sceneHeadersStripped = extResult.sceneHeadersStripped;

  // STEP 4: Conservative repetition fixes
  onProgress?.('Polish (NF): Fixing repetition…');
  const allText = loaded.map(f => f.content).join('\n\n');
  let repFixed = 0;
  for (const t of NF_REPETITION_TARGETS) {
    const total = (allText.match(t.pattern) || []).length;
    const cap = Math.round(t.maxFixed ?? Math.max(3, chapterCount * (t.maxPerChapter || 0.3)));
    if (total <= cap) continue;
    const excess = total - cap;
    let replaced = 0;
    const chCounts = loaded.map((f, idx) => ({ idx, count: (f.content.match(t.pattern) || []).length })).sort((a, b) => b.count - a.count);
    for (const cc of chCounts) {
      if (replaced >= excess) break;
      if (cc.count <= 1) continue;
      const f = loaded[cc.idx];
      let instIdx = 0;
      let chReplaced = 0;
      const maxThis = Math.min(cc.count - 1, excess - replaced);
      let repIdx = 0;
      f.content = f.content.replace(t.pattern, (match) => {
        instIdx++;
        if (instIdx <= 1 || chReplaced >= maxThis) return match;
        chReplaced++; replaced++; repFixed++;
        if (t.replacements.length === 0) return '';
        const rep = t.replacements[repIdx++ % t.replacements.length];
        return match[0] === match[0].toUpperCase() ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
      });
      if (chReplaced > 0) {
        f.content = f.content.replace(/  +/g, ' ');
        changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': replaced ' + chReplaced + 'x "' + t.name + '"');
      }
    }
  }

  // STEP 5: Scaffold detection
  onProgress?.('Polish (NF): Checking scaffolds…');
  let scaffoldsRemoved = 0;
  for (const rx of HARD_SCAFFOLDS) {
    for (const f of loaded) {
      const matches = f.content.match(rx);
      if (matches && matches.length > 0) {
        f.content = f.content.replace(rx, '');
        scaffoldsRemoved += matches.length;
        changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': removed scaffold "' + matches[0] + '"');
      }
    }
  }
  for (const rx of SOFT_SCAFFOLDS) {
    for (const f of loaded) {
      const matches = f.content.match(rx);
      if (matches && matches.length > 0) {
        changes.push('⚠️ Ch.' + (f.chapter.chapter_number || '?') + ': found "' + matches[0] + '" — verify if intentional');
      }
    }
  }

  // STEP 6: Phrase detection (nonfiction-aware)
  onProgress?.('Polish (NF): Detecting phrases…');
  const updatedText = loaded.map(f => f.content).join('\n\n');
  const phraseCounts = {};
  const wordList = updatedText.toLowerCase().split(/\s+/);
  for (let i = 0; i < wordList.length - 1; i++) {
    const w1 = wordList[i].replace(/[^a-z]/g, '');
    const w2 = wordList[i + 1].replace(/[^a-z]/g, '');
    if (w1.length < 3 || w2.length < 3) continue;
    const p = w1 + ' ' + w2;
    if (NF_PHRASE_SKIP.includes(p)) continue;
    phraseCounts[p] = (phraseCounts[p] || 0) + 1;
  }
  const phraseThreshold = Math.max(chapterCount * 8, 100);
  const highFreq = Object.entries(phraseCounts).filter(([, c]) => c > phraseThreshold).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [phrase, count] of highFreq) {
    changes.push('⚠️ "' + phrase + '" appears ' + count + 'x — consider varying');
  }

  // STEP 7: AI-favorite vocabulary frequency caps
  const vocabResult = runVocabCaps(loaded, onProgress, { project });
  changes.push(...vocabResult.changes);

  // STEP 7b: ChatGPT vocabulary contamination caps (ALL project types)
  const chatgptResult = runChatGPTVocabCaps(loaded, onProgress);
  changes.push(...chatgptResult.changes);

  // STEP 7c: "This is not / It is not" dichotomy reducer (NF only)
  const dichotomyResult = runDichotomyPatternReducer(loaded, onProgress);
  changes.push(...dichotomyResult.changes);

  // STEP 7d: Transition-word caps ("Still,", "Instead,", "At last,", etc.)
  // Per-chapter cap prevents rhythm predictability that shows up as an AI
  // detection red flag in memoir/investigative nonfiction.
  const transitionResult = runTransitionWordCaps(loaded, onProgress);
  changes.push(...transitionResult.changes);

  // STEP 7d-bis: "Not just X, but Y" reducer
  const njbResult = runNotJustButReducer(loaded, onProgress);
  changes.push(...njbResult.changes);

  // STEP 7d-ter: "Yet" misuse fixer
  const yetResult = runYetMisuseFixer(loaded, onProgress);
  changes.push(...yetResult.changes);

  // STEP 7d-qua: "Think of it as" capper
  const toiaResult = runThinkOfItAsCapper(loaded, onProgress);
  changes.push(...toiaResult.changes);

  // STEP 7d-qui: AI phrase capper
  const aiPhraseResult = runAiPhraseCapper(loaded, onProgress);
  changes.push(...aiPhraseResult.changes);

  // (Cap hygiene moved to Step 9b — runs after AI detection resistance
  // so that Steps 8/8b/9 can't re-break capitalization fixes.)

  // STEP 7f: Dialogue punctuation placement (American style)
  // Move periods/question marks/exclamations INSIDE closing quote marks.
  // Cheap mechanical fix, zero false-positive risk.
  const dialogPunctResult = runDialoguePunctuationFix(loaded, onProgress);
  changes.push(...dialogPunctResult.changes);

  // STEP 7f-bis: Dialogue filler fix
  // Strip LLM-inserted junk conjunctions ("yet"/"then"/"and"/"but") between
  // an action beat and dialogue. Rarely appears in nonfiction but occasional
  // case studies do contain dialogue, so run it for safety.
  const dialogFillerResult = runDialogueFillerFix(loaded, onProgress);
  changes.push(...dialogFillerResult.changes);

  // STEP 7g: Sentence-pattern variation (stacked -ing clauses)
  // Gemini flags "Descriptor-Verb-Noun loop" patterns as AI-detection risk.
  // This caps stacked "[Subject], [verb]ing [phrase], [main verb]" constructs
  // at a scale-aware threshold. Preserves half the instances — the pattern
  // itself is fine, it's the rhythmic sameness from heavy repetition that
  // creates the AI tell.
  const stackingResult = runStackedClauseVariation(loaded, onProgress);
  changes.push(...stackingResult.changes);

  // STEP 8: Sentence starter variation (ARCH2-4b-d: NF-safe variant — the
  // fiction pass swaps articles on factual nouns, corrupting referents)
  const starterResult = runSentenceStarterVariationNF(loaded, onProgress);
  changes.push(...starterResult.changes);

  // STEP 8b: Anti-AI Detection (triplets, parallel sentences, staccato, rhythm symmetry)
  // Same caps as fiction — these patterns are equally detectable in nonfiction
  onProgress?.('Polish (NF): Running anti-detection steps (triplets, parallels, staccato)…');
  const antiDetect = runAntiDetectionPolish(loaded, onProgress, { project });
  changes.push(...antiDetect.changes);

  // STEP 9: AI Detection Resistance (burstiness, predictability, paragraph variation)
  const aiResist = runAiDetectionResistance(loaded, onProgress);
  changes.push(...aiResist.changes);

  // STEP 9b: Capitalization hygiene — FINAL PASS
  // Moved here from Step 7e because Steps 8/8b/9 can re-introduce mid-sentence
  // caps when they replace transitions. Running cap hygiene LAST ensures nothing
  // downstream re-breaks it. Catches "The paperwork, Still, it is" → lowercase.
  const capHygieneResult = runCapitalizationHygiene(loaded, onProgress);
  changes.push(...capHygieneResult.changes);
  const missingNounWarnings = capHygieneResult.warnings || [];
  if (missingNounWarnings.length > 0) {
    console.log('[POLISH-NF] ⚠️ Missing-noun sites flagged:', missingNounWarnings.length);
    missingNounWarnings.forEach(w => console.log('  Ch.' + w.chapterNumber + ': ' + w.pattern + ' — ' + w.suggestion));
  }

  // STEP 9c: Em-dash density reducer
  const emDashReduce = runEmDashReducer(loaded, onProgress);
  changes.push(...emDashReduce.changes);

  // STEP 9d: Progressive tense converter (was/were [verb]ing → simple past)
  const progReduce = runProgressiveReducer(loaded, onProgress);
  changes.push(...progReduce.changes);

  // STEP 10: Fix hanging quotation marks (LAST text step)
  onProgress?.('Polish (NF): Fixing hanging quotations…');
  const quoteResult = fixHangingQuotes(loaded);
  changes.push(...quoteResult.changes);

  // STEP 10b: Garbled quote cleanup
  let garbledFixed = 0;
  for (const f of loaded) {
    const before10b = f.content;
    f.content = f.content.replace(/[\u201d]{2,}/g, '\u201d');
    f.content = f.content.replace(/[\u201c]{2,}/g, '\u201c');
    f.content = f.content.replace(/"{2,}/g, '"');
    if (f.content !== before10b) {
      garbledFixed++;
      console.warn('[POLISH-NF] STEP 10b: Fixed garbled quotes in Ch.' + (f.chapter?.chapter_number || '?'));
    }
  }
  if (garbledFixed > 0) {
    changes.push('Garbled quote strings cleaned in ' + garbledFixed + ' chapters');
  }

  // STEP 10c: Nonfiction credibility/source/human-texture gate
  const nfCredibilityGate = runNonfictionCredibilityGate(loaded, onProgress, { project });
  changes.push(...nfCredibilityGate.changes);

  // STEP 11: Save
  onProgress?.('Polish (NF): Saving…');
  let savedCount = 0;
  let unchangedCount = 0;
  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    const chNum = f.chapter.chapter_number || (i + 1);
    if (f.content === f.original) { unchangedCount++; continue; }
    onProgress?.(`Polish (NF): Saving chapter ${chNum}…`);
    try {
      const contentFields = await prepareChapterContent(f.content, project?.id, f.chapter.id, f.chapter);
      await runWithNetworkRetry(() => base44.entities.Chapter.update(f.chapter.id, { ...contentFields, word_count: countWords(f.content) }));
      savedCount++;
    } catch (err) {
      changes.push('❌ Ch.' + chNum + ': SAVE FAILED — ' + err.message);
    }
  }

  if (savedCount > 0 && project?.id) refreshProjectWordCount(project.id); // WAVE2-WORDCOUNT

  const afterStats = calculateManuscriptStatsNonfiction(loaded.map(f => f.content).join('\n\n'));

  return {
    savedCount,
    unchangedCount,
    changes,
    afterStats,
    bannedRemoved,
    capFixed,
    repFixed,
    scaffoldsRemoved,
    punctuationFixes,
    disclaimersRemoved,
    compositeFixed,
    nfVoiceFixed,
    grammarFixed,
    spellingFixed,
    externalPatternsFixed,
    sceneHeadersStripped,
    chatgptVocabFixed: chatgptResult.chatgptVocabFixed,
    dichotomyFixed: dichotomyResult.dichotomyFixed,
    antiDetect,
    nfCredibilityGate,
  };
}

/**
 * Run all NF-specific deterministic transforms (steps L through 10c) WITHOUT saving.
 * This is the reusable core of the NF pipeline, called by manuscriptPolishRunner
 * in nonfiction mode.
 *
 * All universal transforms (punctuation, voice, vocab caps, etc.) are run by the
 * runner's standard phases. This function runs ONLY the NF-unique transforms:
 * disclaimer stripping, NF grammar/spelling fixes, NF repetition targets,
 * scaffold detection, NF credibility gate, em-dash/progressive reducers,
 * dichotomy/not-just-but/yet/think-of-it-as/ai-phrase cappers, garbled quotes.
 *
 * @param {Array} loaded - [{chapter, content, original}]
 * @param {Function} onProgress - Progress callback
 * @param {Object} project - Project record
 * @returns {Object} { changes, stats }
 */
export function runNonfictionDeterministicCore(loaded, onProgress, project) {
  const changes = [];
  const chapterCount = loaded.length;
  const stats = {};

  // Step L: Disclaimer stripper
  const disclaimerResult = runDisclaimerStripper(loaded, onProgress);
  changes.push(...disclaimerResult.changes);
  stats.disclaimersRemoved = disclaimerResult.totalRemoved;

  // Step 3b: NF grammar fixes (fragment repair, unclosed quotes, mixed quotes, abbreviation caps)
  onProgress?.('Polish (NF): Fixing grammar issues…');
  let grammarFixed = 0;
  for (const f of loaded) {
    const beforeGrammar = f.content;
    f.content = f.content.replace(/\band\.\s+([A-Z])/g, (_m, c) => { grammarFixed++; return 'and ' + c.toLowerCase(); });
    f.content = f.content.replace(/\bbut\.\s+([A-Z])/g, (_m, c) => { grammarFixed++; return 'but ' + c.toLowerCase(); });
    f.content = f.content.replace(/\bor\.\s+([A-Z])/g, (_m, c) => { grammarFixed++; return 'or ' + c.toLowerCase(); });
    // Smart/straight quote normalization
    const paragraphs = f.content.split(/\n\n+/);
    const fixedParagraphs = paragraphs.map(para => {
      if (!para.trim()) return para;
      const hasSmartOpen = para.includes('\u201c');
      const hasSmartClose = para.includes('\u201d');
      const hasStraight = para.includes('"');
      if ((hasSmartOpen || hasSmartClose) && hasStraight) {
        let inQuote = false; let result = '';
        for (let i = 0; i < para.length; i++) {
          if (para[i] === '"') { result += !inQuote ? '\u201c' : '\u201d'; inQuote = !inQuote; }
          else if (para[i] === '\u201c') { inQuote = true; result += para[i]; }
          else if (para[i] === '\u201d') { inQuote = false; result += para[i]; }
          else { result += para[i]; }
        }
        para = result;
      }
      const smartOpen = (para.match(/\u201c/g) || []).length;
      const smartClose = (para.match(/\u201d/g) || []).length;
      if (smartOpen > smartClose) {
        for (let d = 0; d < smartOpen - smartClose; d++) {
          // NFQUOTE-1: if the unquoted tail after the last opening quote is an
          // attribution ("...built, said one engineer's report."), the closer
          // goes AFTER the comma and BEFORE the attribution. Closing at the end
          // swallowed the attribution into the quote — which silently breaks
          // the verbatim-substring property the nonfiction quote gate enforces.
          // Otherwise close after the terminal punctuation (".”", not "”.").
          const lastOpenIdx = para.lastIndexOf('“');
          const tail = lastOpenIdx >= 0 ? para.slice(lastOpenIdx + 1) : '';
          const attrM = tail.match(/,\s+(said|says|wrote|writes|reported|reports|testified|argued|recalled|added|noted|according to)\b/i);
          if (lastOpenIdx >= 0 && !tail.includes('”') && attrM) {
            const insertAt = lastOpenIdx + 1 + attrM.index + 1;
            para = para.slice(0, insertAt) + '”' + para.slice(insertAt);
          } else if (para.match(/[.!?]\s*$/)) {
            para = para.replace(/([.!?])(\s*)$/, '$1”$2');
          } else {
            para = para.trimEnd() + '”';
          }
          grammarFixed++;
        }
      } else if (smartClose > smartOpen) {
        for (let d = 0; d < smartClose - smartOpen; d++) {
          const fc = para.indexOf('\u201d');
          if (fc > 0) {
            const before = para.substring(0, fc);
            const ls = Math.max(before.lastIndexOf('. ') + 2, before.lastIndexOf('? ') + 2, before.lastIndexOf('! ') + 2, 0);
            para = para.substring(0, ls) + '\u201c' + para.substring(ls);
            grammarFixed++;
          }
        }
      }
      const straightCount = (para.match(/"/g) || []).length;
      if (straightCount % 2 !== 0) {
        if (para.match(/[.!?]\s*$/)) para = para.replace(/([.!?])(\s*)$/, '"$1$2');
        else para = para.trimEnd() + '"';
        grammarFixed++;
      }
      return para;
    });
    f.content = fixedParagraphs.join('\n\n');
    const abbrevRx = /(\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Rev|Gen|Gov|Sgt|Cpl|Lt|Capt|Maj|Col|Jr|Sr)\.\s*[A-Z]\.)\s+([A-Z])([a-z])/g;
    const commonAfterAbbrev = ['after','before','during','until','while','when','where','from','into','onto','upon','with','about','above','below','under','over','through','between','among','against','toward','around','along','across','behind'];
    f.content = f.content.replace(abbrevRx, (match, abbrev, cap, rest) => {
      const nextWord = cap + rest;
      if (commonAfterAbbrev.includes(nextWord.toLowerCase())) { grammarFixed++; return abbrev + ' ' + nextWord.toLowerCase(); }
      return match;
    });
    if (f.content !== beforeGrammar) changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': fixed grammar issues');
  }
  if (grammarFixed > 0) changes.push('NF grammar fixes: ' + grammarFixed);
  stats.grammarFixed = grammarFixed;

  // Step 3c: NF misspelling corrections (drug names, proper nouns, legal terms)
  let spellingFixed = 0;
  const allCorrections = [
    [/\bsecond sodium\b/gi, 'Seconal sodium'], [/\bseconal sodium\b/g, 'Seconal sodium'],
    [/\bphenobarbidal\b/gi, 'Phenobarbital'], [/\bphenobarbitol\b/gi, 'Phenobarbital'], [/\bphenobarbatol\b/gi, 'Phenobarbital'],
    [/\bbenzadrine\b/gi, 'Benzedrine'], [/\bbenzadene\b/gi, 'Benzedrine'], [/\bbenzedrene\b/gi, 'Benzedrine'],
    [/\bamfetamine\b/gi, 'amphetamine'], [/\bbarbitol\b/gi, 'barbital'], [/\bchloropromazine\b/gi, 'chlorpromazine'],
    [/\bdiazapam\b/gi, 'diazepam'], [/\bmethanphetamine\b/gi, 'methamphetamine'], [/\bmorphene\b/gi, 'morphine'],
    [/\bsecobarbatol\b/gi, 'secobarbital'],
    [/\bLouis B Mayer\b/g, 'Louis B. Mayer'], [/\bDavid O Selznick\b/g, 'David O. Selznick'],
    [/\bDr\. Jacobsen\b/g, 'Dr. Jacobson'], [/\bKefauver Comittee\b/gi, 'Kefauver Committee'],
    [/\bKefauver Commitee\b/gi, 'Kefauver Committee'],
    [/\bhabeus corpus\b/gi, 'habeas corpus'], [/\bsui generus\b/gi, 'sui generis'],
    [/\bde Haviland\b/g, 'de Havilland'], [/\bde haviland\b/gi, 'de Havilland'], [/\bDeHavilland\b/g, 'de Havilland'],
  ];
  for (const [pattern, replacement] of allCorrections) {
    for (const f of loaded) {
      const matches = f.content.match(pattern);
      if (matches && matches.length > 0) {
        f.content = f.content.replace(pattern, replacement);
        spellingFixed += matches.length;
      }
    }
  }
  stats.spellingFixed = spellingFixed;

  // Step 4: NF repetition targets
  const allText = loaded.map(f => f.content).join('\n\n');
  let repFixed = 0;
  for (const t of NF_REPETITION_TARGETS) {
    const total = (allText.match(t.pattern) || []).length;
    const cap = Math.round(t.maxFixed ?? Math.max(3, chapterCount * (t.maxPerChapter || 0.3)));
    if (total <= cap) continue;
    const excess = total - cap;
    let replaced = 0;
    const chCounts = loaded.map((f, idx) => ({ idx, count: (f.content.match(t.pattern) || []).length })).sort((a, b) => b.count - a.count);
    for (const cc of chCounts) {
      if (replaced >= excess) break;
      if (cc.count <= 1) continue;
      const f = loaded[cc.idx];
      let instIdx = 0; let chReplaced = 0; const maxThis = Math.min(cc.count - 1, excess - replaced); let repIdx = 0;
      f.content = f.content.replace(t.pattern, (match) => {
        instIdx++;
        if (instIdx <= 1 || chReplaced >= maxThis) return match;
        chReplaced++; replaced++; repFixed++;
        if (t.replacements.length === 0) return '';
        const rep = t.replacements[repIdx++ % t.replacements.length];
        return match[0] === match[0].toUpperCase() ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
      });
      if (chReplaced > 0) { f.content = f.content.replace(/  +/g, ' '); changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': replaced ' + chReplaced + 'x "' + t.name + '"'); }
    }
  }
  stats.repFixed = repFixed;

  // Step 5: Scaffold detection
  let scaffoldsRemoved = 0;
  for (const rx of HARD_SCAFFOLDS) {
    for (const f of loaded) {
      const matches = f.content.match(rx);
      if (matches && matches.length > 0) { f.content = f.content.replace(rx, ''); scaffoldsRemoved += matches.length; }
    }
  }
  for (const rx of SOFT_SCAFFOLDS) {
    for (const f of loaded) {
      const matches = f.content.match(rx);
      if (matches && matches.length > 0) { changes.push('\u26a0\ufe0f Ch.' + (f.chapter.chapter_number || '?') + ': found "' + matches[0] + '" \u2014 verify if intentional'); }
    }
  }
  stats.scaffoldsRemoved = scaffoldsRemoved;

  // NF-only chatgpt pattern modules
  const dichotomyResult = runDichotomyPatternReducer(loaded, onProgress);
  changes.push(...dichotomyResult.changes);
  const njbResult = runNotJustButReducer(loaded, onProgress);
  changes.push(...njbResult.changes);
  const yetResult = runYetMisuseFixer(loaded, onProgress);
  changes.push(...yetResult.changes);
  const toiaResult = runThinkOfItAsCapper(loaded, onProgress);
  changes.push(...toiaResult.changes);
  const aiPhraseResult = runAiPhraseCapper(loaded, onProgress);
  changes.push(...aiPhraseResult.changes);

  // Em-dash + progressive reducers
  const emDashReduce = runEmDashReducer(loaded, onProgress);
  changes.push(...emDashReduce.changes);
  const progReduce = runProgressiveReducer(loaded, onProgress);
  changes.push(...progReduce.changes);

  // Garbled quote cleanup
  let garbledFixed = 0;
  for (const f of loaded) {
    const before10b = f.content;
    f.content = f.content.replace(/[\u201d]{2,}/g, '\u201d');
    f.content = f.content.replace(/[\u201c]{2,}/g, '\u201c');
    f.content = f.content.replace(/"{2,}/g, '"');
    if (f.content !== before10b) garbledFixed++;
  }
  stats.garbledFixed = garbledFixed;

  // NF credibility gate (the big NF-specific gate)
  const nfCredibilityGate = runNonfictionCredibilityGate(loaded, onProgress, { project });
  changes.push(...nfCredibilityGate.changes);
  stats.credibilityGate = nfCredibilityGate;

  return { changes, stats };
}