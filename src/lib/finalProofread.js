/**
 * Final Proofread — "Fresh Eyes" manuscript audit.
 *
 * v6 nonfiction source/copyedit audit gate: catches the exact failures that were
 * slipping through finished manuscripts: bibliography contamination, source
 * placeholders, unsupported certainty, repeated AI-polished rhetoric, and known
 * copyedit survivors.
 *
 * Reads the manuscript cold and flags mechanical errors a human editor
 * would catch. This is the last step before publishing.
 *
 * Supports two calling conventions:
 *   runFinalProofread(project, chapters, onProgress)  — loads content internally
 *   runFinalProofread(loaded, project, onProgress)    — pre-loaded content array
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';
import { isBodyChapter, isBackMatter, isFrontMatter } from '@/lib/bibliographyGenerator';
import { isAnthologyProject } from '@/lib/anthologyEngine';

const BATCH_SIZE = 3;
const MAX_FINDINGS_PER_CHAPTER = 8;

const FINAL_PROOFREAD_VERSION = 'finalProofread-v6-nonfiction-source-copyedit-audit';

const NONFICTION_HINTS = [
  /nonfiction/i,
  /history/i,
  /investigative/i,
  /true\s+crime/i,
  /memoir/i,
  /biograph/i,
  /source/i,
  /bibliography/i,
  /archive/i,
  /court\s+record/i,
  /oral\s+histor/i,
];

const SOURCE_PLACEHOLDER_RX = /(\[\s*(?:SOURCE|CITATION|VERIFY)\s+NEEDED[^\]]*\]|\b(?:SOURCE|CITATION)\s+NEEDED\b|\bTK\b|\bTODO\b|\bTBD\b)/gi;

const FINANCE_SOURCE_RX = /\b(?:Bogle|Malkiel|Vanguard|FINRA|Robinhood|Morningstar|S&P\s+Dow\s+Jones|CFPB|Consumer\s+Financial\s+Protection\s+Bureau|IRS\s+retirement|Roth\s+IRA|401\s*\(?\s*k\s*\)?|ETF|index\s+fund|mutual\s+fund|payday\s+loan|payment\s+for\s+order\s+flow|PFOF|SIPC|Lusardi|Mitchell|Shafir|Thaler|financial\s+literacy|retirement\s+plan)\b/gi;

const OVERCLAIM_RX = /\b(?:the\s+record\s+proves|the\s+evidence\s+proves|this\s+proves|forensic\s+analysis\s+(?:would|will)\s+confirm|the\s+surviving\s+blueprints\s+and\s+operational\s+manuals\s+would\s+later\s+reveal|without\s+question|undeniably|incontrovertibly|must\s+have\s+been|certainly\s+was)\b/gi;

const AI_PATTERN_RX = /\b(?:not\s+merely|not\s+just|what\s+remained\s+was|the\s+question\s+was\s+no\s+longer|this\s+transformed|institutional\s+silence|bureaucratic\s+memory|forensic\s+history|narrative\s+closure|physical\s+erasure|ledger\s+of\s+suffering)\b/gi;

const MOTIF_TERMS = [
  'locked door',
  'silence',
  'official record',
  'institution',
  'archive',
  'erasure',
  'containment',
  'physical evidence',
  'Cell Hall 3',
];

const DETERMINISTIC_COPYEDITS = [
  { rx: /\ba environment\b/g, fix: 'an environment', category: 'article_error', description: 'Wrong article before a vowel sound.' },
  { rx: /\bfre-standing\b/g, fix: 'free-standing', category: 'typo', description: 'Typo: fre-standing should be free-standing.' },
  { rx: /What was it an act of containment/g, fix: 'Was it an act of containment', category: 'mangled', description: 'Malformed question construction.' },
  { rx: /according to the tour operators was captured/g, fix: 'according to the tour operators, was captured', category: 'missing_comma', description: 'Missing comma after parenthetical phrase.' },
  { rx: /where the EVP was captured was/g, fix: 'where the EVP was captured, was', category: 'missing_comma', description: 'Missing comma after parenthetical clause.' },
  { rx: /The EVP, therefore existed/g, fix: 'The EVP, therefore, existed', category: 'missing_comma', description: 'Missing comma after therefore.' },
  { rx: /the prison, however was/g, fix: 'the prison, however, was', category: 'missing_comma', description: 'Missing comma around interrupter.' },
  { rx: /The physical prison, however was/g, fix: 'The physical prison, however, was', category: 'missing_comma', description: 'Missing comma around interrupter.' },
  { rx: /the prison’s very public destruction created/g, fix: 'the prison’s very public destruction, created', category: 'missing_comma', description: 'Possible missing comma after introductory phrase; review in context.' },
  { rx: /—These were physical facts/g, fix: '—these were physical facts', category: 'capitalization', description: 'Capitalization after an em dash should usually stay lowercase inside the same sentence.' },
  { rx: /—Whether the fire/g, fix: '—whether the fire', category: 'capitalization', description: 'Capitalization after an em dash should usually stay lowercase inside the same sentence.' },
  { rx: /\bDid had he\b/g, fix: 'Had he', category: 'mangled', description: 'Malformed auxiliary verb sequence.' },
  { rx: /\bwas a administrative fact\b/g, fix: 'was an administrative fact', category: 'article_error', description: 'Wrong article before a vowel sound.' },
  { rx: /\ba external hasp\b/g, fix: 'an external hasp', category: 'article_error', description: 'Wrong article before a vowel sound.' },
  { rx: /\ba actual reality\b/g, fix: 'an actual reality', category: 'article_error', description: 'Wrong article before a vowel sound.' },
  { rx: /\ba operational factor\b/g, fix: 'an operational factor', category: 'article_error', description: 'Wrong article before a vowel sound.' },
  { rx: /\ba institutional reflex\b/g, fix: 'an institutional reflex', category: 'article_error', description: 'Wrong article before a vowel sound.' },
  { rx: /\ba direct ledger\b/g, fix: 'a direct ledger', category: 'article_error', description: 'Article usage needs review in context.' },
];

function isLikelyNonfiction(project = {}) {
  const text = [
    project?.book_type,
    project?.project_type,
    project?.genre,
    project?.subgenre,
    project?.description,
    project?.seed_concept,
    project?.title,
  ].filter(Boolean).join(' ');

  return NONFICTION_HINTS.some((rx) => rx.test(text));
}

function isFinanceProject(project = {}, loaded = []) {
  const text = [
    project?.title,
    project?.genre,
    project?.subgenre,
    project?.description,
    project?.seed_concept,
    ...loaded.slice(0, 3).map((entry) => entry.content || ''),
  ].join(' ').toLowerCase();

  return /\b(finance|investing|investment|retirement|stock market|financial literacy|wall street|robinhood|index fund|credit card|debt)\b/.test(text);
}

function getEntryTitle(entry = {}, fallback = '') {
  return entry.chapterTitle || entry.chapter?.title || fallback || 'Untitled';
}

function makeFinding({ entry, index, severity = 'major', category, originalText, description, suggestedFix = '', source = 'final_check_deterministic' }) {
  return {
    severity,
    category,
    original_text: originalText,
    description,
    suggested_fix: suggestedFix,
    chapter: entry.chapterNumber || entry.chapter?.chapter_number || (index + 1),
    chapterIndex: index,
    chapterTitle: getEntryTitle(entry, `Chapter ${index + 1}`),
    source,
  };
}

function addRegexFindings({ findings, entry, index, rx, category, severity, description, suggestedFixBuilder, maxPerEntry = 8, source = 'final_check_deterministic' }) {
  const content = entry.content || '';
  if (!content) return;

  const clone = new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : `${rx.flags}g`);
  let match;
  let count = 0;

  while ((match = clone.exec(content)) !== null && count < maxPerEntry) {
    const originalText = match[0];
    findings.push(makeFinding({
      entry,
      index,
      severity,
      category,
      originalText,
      description,
      suggestedFix: typeof suggestedFixBuilder === 'function' ? suggestedFixBuilder(originalText, match) : '',
      source,
    }));
    count += 1;
  }
}

function countTerm(content = '', term = '') {
  if (!term) return 0;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`\\b${escaped}\\b`, term.includes(' ') ? 'gi' : 'gi');
  return (content.match(rx) || []).length;
}

function runDeterministicNonfictionAudit(loaded = [], project = {}) {
  if (!isLikelyNonfiction(project)) return [];

  const findings = [];
  const financeProject = isFinanceProject(project, loaded);

  loaded.forEach((entry, index) => {
    const title = getEntryTitle(entry, '').toLowerCase();
    const content = entry.content || '';
    const isBibliographyLike = /bibliography|works cited|references|sources/.test(title) || /^\s*(bibliography|works cited|references|sources)\b/im.test(content);

    for (const edit of DETERMINISTIC_COPYEDITS) {
      addRegexFindings({
        findings,
        entry,
        index,
        rx: edit.rx,
        category: edit.category,
        severity: edit.category === 'mangled' ? 'critical' : 'minor',
        description: edit.description,
        suggestedFixBuilder: () => edit.fix,
        maxPerEntry: 12,
      });
    }

    addRegexFindings({
      findings,
      entry,
      index,
      rx: SOURCE_PLACEHOLDER_RX,
      category: 'source_placeholder',
      severity: 'critical',
      description: 'Source placeholder leaked into manuscript. Nonfiction cannot publish with unresolved source markers.',
      suggestedFixBuilder: () => '',
      maxPerEntry: 20,
      source: 'final_check_source_integrity',
    });

    if (isBibliographyLike && !financeProject) {
      addRegexFindings({
        findings,
        entry,
        index,
        rx: FINANCE_SOURCE_RX,
        category: 'bibliography_contamination',
        severity: 'critical',
        description: 'Unrelated finance/investing source language appears in a non-finance bibliography or source section.',
        suggestedFixBuilder: (txt) => '',
        maxPerEntry: 40,
        source: 'final_check_source_integrity',
      });
    }

    addRegexFindings({
      findings,
      entry,
      index,
      rx: OVERCLAIM_RX,
      category: 'unsupported_certainty',
      severity: 'major',
      description: 'This nonfiction claim sounds more certain than the visible source apparatus supports. Soften or anchor it to a named source.',
      suggestedFixBuilder: (txt) => {
        const lowered = txt.toLowerCase();
        if (lowered.includes('proves')) return txt.replace(/proves/i, 'suggests');
        if (lowered.includes('without question')) return 'the available record does not resolve this completely';
        if (lowered.includes('must have been')) return txt.replace(/must have been/i, 'may have been');
        if (lowered.includes('certainly was')) return txt.replace(/certainly was/i, 'appears to have been');
        return '';
      },
      maxPerEntry: 10,
      source: 'final_check_source_integrity',
    });

    const aiMatches = content.match(AI_PATTERN_RX) || [];
    if (aiMatches.length >= 8) {
      findings.push(makeFinding({
        entry,
        index,
        severity: 'major',
        category: 'ai_polished_repetition',
        originalText: aiMatches[0],
        description: `Chapter uses ${aiMatches.length} repeated AI-polished rhetorical markers. Cut repetition, add named documents/people, and vary sentence rhythm.`,
        suggestedFix: '',
        source: 'final_check_ai_smell',
      }));
    }

    const motifOveruse = MOTIF_TERMS
      .map((term) => ({ term, count: countTerm(content, term) }))
      .filter((item) => item.count >= (item.term.length > 10 ? 6 : 14));

    if (motifOveruse.length) {
      const worst = motifOveruse.sort((a, b) => b.count - a.count)[0];
      findings.push(makeFinding({
        entry,
        index,
        severity: 'major',
        category: 'motif_overuse',
        originalText: worst.term,
        description: `Motif overuse detected: "${worst.term}" appears about ${worst.count} times in this chapter/section. Reduce repetition or replace with new evidence/human detail.`,
        suggestedFix: '',
        source: 'final_check_ai_smell',
      }));
    }

    if (!isBibliographyLike) {
      const sourceAnchors = (content.match(/\b(?:according to|reported by|cited in|records? from|archives?|newspaper|court|coroner|death certificate|fire marshal|oral history|interview|ledger|register)\b/gi) || []).length;
      const abstractInstitution = (content.match(/\b(?:institution|record|archive|silence|erasure|containment|bureaucratic|official)\b/gi) || []).length;
      const humanSignals = (content.match(/\b(?:mother|father|son|daughter|wife|husband|family|families|worker|guard|inmate|officer|witness|survivor|victim|descendant|named|buried|body|death certificate)\b/gi) || []).length;

      if (content.length > 2500 && sourceAnchors < 2) {
        findings.push(makeFinding({
          entry,
          index,
          severity: 'major',
          category: 'weak_source_anchoring',
          originalText: content.slice(0, 120),
          description: 'Long nonfiction chapter/section has too few visible source anchors. Add named records, documents, newspapers, archives, or clearly mark inference.',
          suggestedFix: '',
          source: 'final_check_source_integrity',
        }));
      }

      if (content.length > 2500 && abstractInstitution > humanSignals * 2 && humanSignals < 12) {
        findings.push(makeFinding({
          entry,
          index,
          severity: 'major',
          category: 'weak_human_texture',
          originalText: content.slice(0, 120),
          description: 'Chapter leans too hard on institution/archive abstractions and not enough on people, families, victims, witnesses, or human absence.',
          suggestedFix: '',
          source: 'final_check_human_texture',
        }));
      }
    }
  });

  return findings;
}


function pickFreshEyesModel(project) {
  const genModel = project?.default_prose_model || '';
  if (genModel.includes('gemini')) return 'deepseek/deepseek-chat-v3-0324';
  return 'gemini_3_flash';
}

/**
 * Load chapter content fresh from DB.
 */
async function loadChaptersFromDB(chapters, onProgress) {
  const loaded = [];
  const scannableChapters = chapters
    .filter(ch => chapterHasContent(ch) && !isFrontMatter(ch) && (isBodyChapter(ch) || isBackMatter(ch) || /bibliography|works cited|references|sources|author/i.test(ch.title || '')))
    .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

  for (let i = 0; i < scannableChapters.length; i++) {
    const ch = scannableChapters[i];
    onProgress?.(`Loading chapter ${i + 1} of ${scannableChapters.length}…`);
    const content = await resolveChapterContent(ch);
    if (content && content.length > 100) {
      loaded.push({
        chapter: ch,
        content,
        chapterTitle: ch.title || `Chapter ${ch.chapter_number}`,
        chapterNumber: ch.chapter_number || (i + 1),
      });
    }
  }
  return loaded;
}

/**
 * Normalize pre-loaded entries to have consistent shape.
 * The Polish view passes { chapter, content, original } objects.
 */
function normalizeLoaded(loaded) {
  return loaded.map((entry, i) => ({
    chapter: entry.chapter || {},
    content: entry.content || '',
    chapterTitle: entry.chapterTitle || entry.chapter?.title || `Chapter ${i + 1}`,
    chapterNumber: entry.chapterNumber || entry.chapter?.chapter_number || (i + 1),
  }));
}

/**
 * Build a continuity spine — SKIPPED for anthologies.
 */
async function buildContinuitySpine(loaded, onProgress) {
  const spine = [];

  for (let i = 0; i < loaded.length; i++) {
    const entry = loaded[i];
    const content = entry.content || '';
    if (!content || content.length < 200) {
      spine.push({ chapter: i + 1, title: entry.chapterTitle, summary: {}, characters: [], location: '' });
      continue;
    }

    onProgress?.(`Building spine: Ch. ${i + 1}/${loaded.length}…`);

    const words = content.split(/\s+/);
    const excerpt = words.length > 600
      ? words.slice(0, 300).join(' ') + '\n[...]\n' + words.slice(-300).join(' ')
      : content;

    try {
      const result = await invokeLLMWithRetry({
        prompt: `You are a continuity editor. Extract a structured summary of this chapter.

CHAPTER ${i + 1}: "${entry.chapterTitle}"

${excerpt}

Return JSON only, no markdown wrapping:
{"characters_present":["name1","name2"],"location":"where","time_of_day":"morning/afternoon/evening/night/unclear","chapter_ends_with":"one sentence summary of final beat"}`,
        model: 'gemini_3_flash',
        temperature: 0.1,
        max_tokens: 400,
      });

      let parsed = {};
      try {
        const raw = typeof result === 'string' ? result : (result?.text || JSON.stringify(result));
        parsed = JSON.parse(raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
      } catch { parsed = {}; }

      spine.push({
        chapter: i + 1,
        title: entry.chapterTitle,
        summary: parsed,
        characters: parsed.characters_present || [],
        location: parsed.location || '',
      });
    } catch {
      spine.push({ chapter: i + 1, title: entry.chapterTitle, summary: {}, characters: [], location: '' });
    }
  }

  return spine;
}

/**
 * Per-chapter line edit check.
 */
async function runPerChapterCheck(loaded, spine, project, isAnthology, onProgress) {
  const allFindings = [];
  const freshModel = pickFreshEyesModel(project);
  const totalBatches = Math.ceil(loaded.length / BATCH_SIZE);

  for (let batchStart = 0; batchStart < loaded.length; batchStart += BATCH_SIZE) {
    const batch = loaded.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;

    onProgress?.(`Proofreading: Batch ${batchNum}/${totalBatches} (Ch. ${batchStart + 1}–${Math.min(batchStart + BATCH_SIZE, loaded.length)}) — ${allFindings.length} issues so far…`);

    const batchPromises = batch.map((entry, localIdx) => {
      const globalIdx = batchStart + localIdx;
      const chapterNum = entry.chapterNumber;
      const content = entry.content || '';
      if (!content || content.length < 200) return Promise.resolve([]);

      const entryTitle = getEntryTitle(entry, '').toLowerCase();
      const isBackMatterEntry = isBackMatter(entry.chapter || {}) || /bibliography|works cited|references|sources|author's note|author note/.test(entryTitle);
      if (isBackMatterEntry) return Promise.resolve([]);

      let contextBlock = '';
      if (!isAnthology && spine && spine.length > 0) {
        const prevSpine = globalIdx > 0 ? spine[globalIdx - 1] : null;
        if (prevSpine && prevSpine.summary && typeof prevSpine.summary === 'object') {
          contextBlock = `PREVIOUS CHAPTER CONTEXT (for continuity only):\nCh.${prevSpine.chapter} ended with: "${prevSpine.summary.chapter_ends_with || 'unknown'}". Characters: ${(prevSpine.characters || []).join(', ')}.\n\n`;
        }
      }

      const anthologyNote = isAnthology
        ? `\nIMPORTANT: This is an ANTHOLOGY — each chapter is a standalone short story with its own characters, setting, and plot. Do NOT flag differences between chapters as errors. Do NOT flag intentional stylistic choices. Each story has its own voice.\n`
        : '';

      const prompt = `You are a brutal, meticulous copy editor doing the FINAL proofread before publication. This is the last human eyes on this text. Anything you miss goes to print. Find errors that would embarrass the author.
${anthologyNote}
${contextBlock}CHAPTER ${chapterNum}: "${entry.chapterTitle}"

${content.substring(0, 20000)}

Search for ALL of these error types. Check every line:

1. EDITORIAL ARTIFACTS (CRITICAL) — Any text that reads like an instruction to the author/editor rather than narrative prose. Examples: "Replace the asterisk with…", "Remove the duplicate text", "Consider restructuring this…", "TODO", "TK", "FIXME", "[insert X here]". These are NEVER acceptable in a published manuscript. Flag every single one.

2. DIALOGUE PUNCTUATION (CRITICAL) — Extra or missing quotation marks ("Thank you," she said." has an extra quote). Mismatched open/close quotes. Dialogue lines missing closing quotes. Smart quotes pointing the wrong direction. Nested quotes not using single/double correctly.

3. MANGLED/SCRAMBLED SENTENCES (CRITICAL) — Sentences where words are clearly in the wrong order or two sentences got mashed together during editing. Example: "Still here are you back here, I see." These read like two drafts collided. They need to be rewritten into one clean sentence.

4. COMMA SPLICES — Two independent clauses joined by only a comma where a period, semicolon, or conjunction is needed. Example: "Too quiet, Aris rubbed his temples" should be "Too quiet. Aris rubbed his temples."

5. MISSING WORDS — Sentences with obviously dropped words: "They'd never of him" → "They'd never thought of him"

6. CAPITALIZATION — Proper nouns in lowercase, random mid-word caps

7. FUSED WORDS — Words smashed together: "yetI" → "yet I"

8. ORPHANED DIALOGUE — Dialogue lines that sit alone without any speaker attribution or action beat, making it unclear who is speaking. Not every line needs a tag, but if it's genuinely ambiguous, flag it.

9. UNFINISHED SENTENCES — Sentences that end abruptly mid-thought, clearly truncated during generation: "They had scanned it, uploaded it to the."

Do NOT flag:
- Intentional fragments used for pacing ("The door. The silence. The dark.")
- Creative vocabulary or unusual word choices
- Style preferences — if it reads fine, leave it alone
- "A" vs "The" unless genuinely wrong

IMPORTANT: For original_text, copy the EXACT characters from the chapter — including any smart quotes, em-dashes, or special characters. The text must be findable via exact string match.

Find 3-${MAX_FINDINGS_PER_CHAPTER} genuine errors. Prioritize CRITICAL items first. If the chapter is clean, return an empty array.

Return JSON only, no markdown wrapping:
{"findings":[{"severity":"critical|major|minor","category":"editorial_artifact|dialogue_punctuation|mangled|comma_splice|missing_word|capitalization|fused_word|orphaned_dialogue|unfinished","original_text":"EXACT text from the chapter — must be copy-pasted, not paraphrased","description":"What is wrong (one sentence)","suggested_fix":"Drop-in replacement text, or empty string if the text should be deleted"}]}`;

      return invokeLLMWithRetry({
        prompt,
        model: freshModel,
        fallback_model: freshModel === 'gemini_3_flash' ? 'deepseek/deepseek-chat-v3-0324' : 'gemini_3_flash',
        temperature: 0.15,
        max_tokens: 1500,
      }).then(result => {
        let text = typeof result === 'string' ? result : (result?.text || result?.content || String(result || ''));
        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        let parsed;
        try { parsed = JSON.parse(text); } catch { return []; }
        if (!parsed.findings || !Array.isArray(parsed.findings)) return [];

        return parsed.findings
          .filter(f => f.original_text && f.description && f.original_text.length >= 5)
          .slice(0, MAX_FINDINGS_PER_CHAPTER)
          .map(f => {
            let verifiedOriginal = f.original_text;

            // Verify original_text actually exists in the chapter content.
            // LLMs frequently paraphrase or change quotes instead of copying exactly.
            if (!content.includes(verifiedOriginal)) {
              // Try normalizing quotes and whitespace
              const normContent = content
                .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
                .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
                .replace(/[\u2013\u2014]/g, '-')
                .replace(/\u2026/g, '...')
                .replace(/\s+/g, ' ');
              const normOriginal = verifiedOriginal
                .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
                .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
                .replace(/[\u2013\u2014]/g, '-')
                .replace(/\u2026/g, '...')
                .replace(/\s+/g, ' ');

              if (normContent.includes(normOriginal)) {
                // Found via normalization — extract the REAL text from the chapter
                const normIdx = normContent.indexOf(normOriginal);
                // Walk through the original content to find the corresponding position
                let origPos = 0;
                let normPos = 0;
                while (normPos < normIdx && origPos < content.length) {
                  // Skip extra whitespace in original
                  if (/\s/.test(content[origPos]) && origPos > 0 && /\s/.test(content[origPos - 1])) {
                    origPos++;
                    continue;
                  }
                  origPos++;
                  normPos++;
                }
                // Extract from origPos for approximately the right length
                const searchEnd = Math.min(origPos + verifiedOriginal.length + 30, content.length);
                const candidateChunk = content.substring(origPos, searchEnd);
                // Find the actual end by matching normalized length
                let bestEnd = verifiedOriginal.length;
                for (let e = bestEnd - 5; e <= bestEnd + 20 && e <= candidateChunk.length; e++) {
                  const candidateNorm = candidateChunk.substring(0, e)
                    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
                    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
                    .replace(/[\u2013\u2014]/g, '-')
                    .replace(/\s+/g, ' ');
                  if (candidateNorm === normOriginal) {
                    bestEnd = e;
                    break;
                  }
                }
                const extracted = candidateChunk.substring(0, bestEnd);
                if (content.includes(extracted) && extracted.length >= verifiedOriginal.length * 0.7) {
                  verifiedOriginal = extracted;
                }
              } else {
                // Try first-words anchor as last resort
                const words = verifiedOriginal.split(/\s+/);
                let found = false;
                for (let tryLen = Math.min(6, words.length); tryLen >= 3; tryLen--) {
                  const anchor = words.slice(0, tryLen).join(' ');
                  // Try anchor with different quote styles
                  const anchorVariants = [
                    anchor,
                    anchor.replace(/"/g, '\u201C').replace(/"$/g, '\u201D'),
                    anchor.replace(/'/g, '\u2018'),
                    anchor.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'"),
                  ];
                  for (const av of anchorVariants) {
                    const anchorIdx = content.indexOf(av);
                    if (anchorIdx >= 0) {
                      // Grab from anchor to approximately the right length
                      const endTarget = anchorIdx + verifiedOriginal.length;
                      // Try to find a sentence boundary near the expected end
                      const chunk = content.substring(anchorIdx, Math.min(endTarget + 30, content.length));
                      const periodIdx = chunk.indexOf('.', verifiedOriginal.length - 15);
                      const actual = periodIdx >= 0 && periodIdx < verifiedOriginal.length + 20
                        ? chunk.substring(0, periodIdx + 1)
                        : chunk.substring(0, verifiedOriginal.length);
                      if (actual.length >= 10 && content.includes(actual)) {
                        verifiedOriginal = actual;
                        found = true;
                        break;
                      }
                    }
                  }
                  if (found) break;
                }

                // If still not found, drop this finding — it can't be applied
                if (!found && !content.includes(verifiedOriginal)) {
                  console.warn('[FINAL-CHECK] Dropping unfindable finding:', verifiedOriginal.substring(0, 60));
                  return null;
                }
              }
            }

            return {
              ...f,
              original_text: verifiedOriginal,
              chapter: chapterNum,
              chapterIndex: globalIdx,
              chapterTitle: entry.chapterTitle,
              source: 'final_check',
            };
          })
          .filter(Boolean);
      }).catch(err => {
        console.warn(`[FINAL-CHECK] Ch.${chapterNum} failed:`, err.message);
        return [];
      });
    });

    const batchResults = await Promise.allSettled(batchPromises);
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allFindings.push(...result.value);
      }
    }
  }

  return allFindings;
}

/**
 * Cross-chapter consistency — SKIPPED for anthologies.
 */
async function runCrossChapterCheck(spine, project, onProgress) {
  onProgress?.('Cross-chapter consistency check…');

  const spineText = spine.map(s => {
    const sum = typeof s.summary === 'object' ? JSON.stringify(s.summary) : String(s.summary);
    return `Ch.${s.chapter} "${s.title}": ${sum}`;
  }).join('\n\n');

  try {
    const result = await invokeLLMWithRetry({
      prompt: `You are a continuity editor reviewing a novel's chapter summaries. Find ONLY clear contradictions — not style differences.

CHAPTER SUMMARIES:
${spineText.substring(0, 25000)}

Find inconsistencies BETWEEN chapters:
- Characters in two places at once
- Injuries mentioned then forgotten
- Timeline contradictions
- Character names spelled differently

Do NOT flag: different tones between chapters, unresolved subplots, minor setting differences.

Find 0-5 genuine contradictions. Return JSON only:
{"findings":[{"severity":"critical|major|minor","category":"continuity|timeline|character_state|name_consistency","chapters_involved":[1,3],"description":"What is contradictory","suggestion":"How to fix"}]}`,
      model: 'gemini_3_flash',
      temperature: 0.15,
      max_tokens: 1000,
    });

    let text = typeof result === 'string' ? result : (result?.text || result?.content || String(result || ''));
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed;
    try { parsed = JSON.parse(text); } catch { return []; }
    if (!parsed.findings || !Array.isArray(parsed.findings)) return [];

    return parsed.findings.map(f => ({
      ...f,
      chapter: (f.chapters_involved || [])[0] || 1,
      chapterIndex: ((f.chapters_involved || [])[0] || 1) - 1,
      chapterTitle: '',
      original_text: '',
      suggested_fix: f.suggestion || '',
      source: 'final_check_cross',
    }));
  } catch (err) {
    console.warn('[FINAL-CHECK-CROSS] Failed:', err.message);
    return [];
  }
}

/**
 * Deduplicate findings.
 */
function deduplicateFindings(findings) {
  const seen = new Map();
  const unique = [];

  for (const f of findings) {
    const key = (f.original_text || '').toLowerCase().trim();
    if (!key || key.length < 5) { unique.push(f); continue; }

    if (seen.has(key)) {
      const existing = seen.get(key);
      const sevOrder = { critical: 0, major: 1, minor: 2 };
      if ((sevOrder[f.severity] || 2) < (sevOrder[existing.severity] || 2)) {
        const idx = unique.indexOf(existing);
        if (idx >= 0) unique[idx] = f;
        seen.set(key, f);
      }
    } else {
      seen.set(key, f);
      unique.push(f);
    }
  }

  return unique;
}

/**
 * Main entry point — supports both calling conventions:
 *   runFinalProofread(project, chapters, onProgress)
 *   runFinalProofread(loaded, project, onProgress)
 */
export async function runFinalProofread(arg1, arg2, arg3) {
  // Detect which calling convention was used:
  // If arg1 is an array, it's the old (loaded, project, onProgress) form
  // If arg1 is an object with .id or .title, it's (project, chapters, onProgress)
  let project, loaded, onProgress;

  if (Array.isArray(arg1)) {
    // Old calling convention: (loaded, project, onProgress)
    loaded = normalizeLoaded(arg1);
    project = arg2 || {};
    onProgress = arg3;
  } else {
    // New calling convention: (project, chapters, onProgress)
    project = arg1 || {};
    onProgress = arg3;
    if (Array.isArray(arg2)) {
      loaded = await loadChaptersFromDB(arg2, onProgress);
    } else {
      loaded = [];
    }
  }

  onProgress?.('Starting final proofread…');

  if (!loaded.length) {
    onProgress?.('No chapters with content found.');
    return { findings: [], spine: [], stats: { total: 0 } };
  }

  const isAnthology = isAnthologyProject(project);

  // Step 0: Deterministic nonfiction source/copyedit audit.
  // This catches exact failures that should not depend on an LLM: bad source placeholders,
  // finance bibliography contamination, repeated AI-smell markers, and known copyedit survivors.
  const deterministicFindings = runDeterministicNonfictionAudit(loaded, project);

  // Step 1: Build continuity spine (skip for anthologies)
  let spine = [];
  if (!isAnthology) {
    spine = await buildContinuitySpine(loaded, onProgress);
  }

  // Step 2: Per-chapter line edit
  const chapterFindings = await runPerChapterCheck(loaded, spine, project, isAnthology, onProgress);

  // Step 3: Cross-chapter consistency (skip for anthologies)
  let crossFindings = [];
  if (!isAnthology && loaded.length > 1) {
    crossFindings = await runCrossChapterCheck(spine, project, onProgress);
  }

  // Step 4: Combine, deduplicate, sort
  let allFindings = deduplicateFindings([...deterministicFindings, ...chapterFindings, ...crossFindings]);

  const sevOrder = { critical: 0, major: 1, minor: 2 };
  allFindings.sort((a, b) => (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2));

  const stats = {
    total: allFindings.length,
    critical: allFindings.filter(f => f.severity === 'critical').length,
    major: allFindings.filter(f => f.severity === 'major').length,
    minor: allFindings.filter(f => f.severity === 'minor').length,
    chaptersScanned: loaded.length,
    isAnthology,
    model: pickFreshEyesModel(project),
    version: FINAL_PROOFREAD_VERSION,
    deterministic: deterministicFindings.length,
  };

  onProgress?.(`Final check complete: ${stats.total} issues (${stats.critical} critical, ${stats.major} major, ${stats.minor} minor)`);

  return { findings: allFindings, spine, stats };
}