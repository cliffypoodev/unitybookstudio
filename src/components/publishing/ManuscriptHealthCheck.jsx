// =============================================================
// ManuscriptHealthCheck.jsx — Health Check 3.0
// Nonfiction Integrity Dashboard
//
// Purpose:
// - Read-only manuscript diagnostic panel.
// - Does not mutate chapters.
// - Does not touch save/export logic.
// - Adds nonfiction credibility, bibliography, AI-smell, human texture,
//   overclaim, repetition, source-integrity, and publish-readiness scoring.
//
// Compatible with:
// <ManuscriptHealthCheck
//   open={healthCheckOpen}
//   onClose={() => setHealthCheckOpen(false)}
//   project={project}
//   chapters={orderedWithEdits}
//   onSelectChapter={handleChapterSelect}
// />
// =============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Info,
  Layers,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isFrontMatter, isBackMatter, isBodyChapter } from '@/lib/bibliographyGenerator';

const FINANCE_CONTAMINATION_TERMS = [
  'john bogle',
  'bogle',
  'vanguard',
  'malkiel',
  'random walk down wall street',
  'finra',
  'robinhood',
  'gamestop',
  'sec market structure',
  'consumer financial protection bureau',
  'cfpb payday',
  'irs retirement',
  '401(k)',
  'index fund',
  'mutual fund',
  'exchange-traded fund',
  'etf',
];

const PLACEHOLDER_PATTERNS = [
  /\bTBD\b/gi,
  /\bTODO\b/gi,
  /\bTK\b/g,
  /\[INSERT[^\]]*\]/gi,
  /\[ADD[^\]]*\]/gi,
  /\[FIX[^\]]*\]/gi,
  /\[SOURCE[^\]]*\]/gi,
  /\[CITATION[^\]]*\]/gi,
  /\[RESEARCH[^\]]*\]/gi,
  /\[PLACEHOLDER[^\]]*\]/gi,
  /\bLorem ipsum\b/gi,
];

const OVERCLAIM_PATTERNS = [
  /\bthe record proves\b/gi,
  /\bthe records prove\b/gi,
  /\bthe evidence proves\b/gi,
  /\bthis proves\b/gi,
  /\bproves beyond doubt\b/gi,
  /\bwithout question\b/gi,
  /\bthere is no doubt\b/gi,
  /\bmust have been\b/gi,
  /\bforensic analysis would confirm\b/gi,
  /\bthe available record showed\b/gi,
  /\bsurviving blueprints .* would later reveal\b/gi,
  /\boperational manuals .* would later reveal\b/gi,
];

const AI_RHYTHM_PATTERNS = [
  /\bnot merely\b/gi,
  /\bnot simply\b/gi,
  /\bthis was not\b/gi,
  /\bwhat remained was\b/gi,
  /\bthe question was no longer\b/gi,
  /\bthe silence was not\b/gi,
  /\binstitutional silence\b/gi,
  /\bbureaucratic memory\b/gi,
  /\bforensic history\b/gi,
  /\bnarrative closure\b/gi,
  /\bphysical erasure\b/gi,
  /\bmachine of containment\b/gi,
  /\bthis transformed\b/gi,
  /\bthe institution\b/gi,
  /\bthe official record\b/gi,
];

const COPYEDIT_PATTERNS = [
  { label: 'incorrect article: “a environment”', pattern: /\ba environment\b/gi },
  { label: 'typo: “fre-standing”', pattern: /\bfre-standing\b/gi },
  { label: 'possible malformed question: “What was it an act of…”', pattern: /\bWhat was it an act of\b/gi },
  { label: 'capitalized word after em dash', pattern: /—[A-Z][a-z]+/g },
  { label: 'missing comma pattern around “according to”', pattern: /\baccording to [^,]{3,80} was\b/gi },
  { label: 'possible missing comma before “therefore”', pattern: /\btherefore existed\b/gi },
];

const MOTIF_BUDGETS = [
  { term: 'locked door', warningPer10k: 4, criticalPer10k: 8 },
  { term: 'silence', warningPer10k: 7, criticalPer10k: 13 },
  { term: 'official record', warningPer10k: 4, criticalPer10k: 8 },
  { term: 'institution', warningPer10k: 10, criticalPer10k: 18 },
  { term: 'archive', warningPer10k: 6, criticalPer10k: 12 },
  { term: 'erasure', warningPer10k: 4, criticalPer10k: 8 },
  { term: 'Cell Hall 3', warningPer10k: 5, criticalPer10k: 10 },
];

const HUMAN_TERMS = [
  'man',
  'men',
  'woman',
  'women',
  'child',
  'children',
  'family',
  'families',
  'mother',
  'father',
  'son',
  'daughter',
  'wife',
  'husband',
  'brother',
  'sister',
  'worker',
  'guard',
  'inmate',
  'prisoner',
  'victim',
  'survivor',
  'witness',
  'resident',
  'neighbor',
  'officer',
  'doctor',
  'nurse',
  'teacher',
  'clerk',
  'warden',
  'employee',
];

const SOURCE_ANCHOR_TERMS = [
  'archive',
  'archives',
  'newspaper',
  'report',
  'record',
  'records',
  'court',
  'testimony',
  'ledger',
  'register',
  'minutes',
  'photograph',
  'map',
  'blueprint',
  'death certificate',
  'coroner',
  'oral history',
  'interview',
  'department of corrections',
  'state historical society',
  'missouri state archives',
  'city council',
  'hearing',
];

function safeText(value = '') {
  return String(value || '');
}

function stripHtml(value = '') {
  return safeText(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value = '') {
  return safeText(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n')
    .trim();
}

function countWords(value = '') {
  return stripHtml(value).split(/\s+/).filter(Boolean).length;
}

function countMatches(content = '', pattern) {
  const matches = safeText(content).match(pattern);
  return matches ? matches.length : 0;
}

function countTerm(content = '', term = '') {
  if (!term) return 0;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return countMatches(content, new RegExp(`\\b${escaped}\\b`, 'gi'));
}

function per10k(count, words) {
  if (!words) return 0;
  return (count / Math.max(1, words)) * 10000;
}

function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getChapterContent(chapter) {
  return safeText(chapter?.content_md || chapter?.beat_summary || chapter?.content_html || '');
}

function getChapterLabel(chapter, index = 0) {
  if (!chapter) return 'Unknown Section';
  if (isFrontMatter(chapter)) return chapter.title || 'Front Matter';
  if (isBackMatter(chapter)) return chapter.title || 'Back Matter';
  return chapter.title || `Chapter ${chapter.chapter_number || index + 1}`;
}

function getSectionType(chapter) {
  if (!chapter) return 'Section';
  if (isFrontMatter(chapter)) return 'Front Matter';
  if (isBackMatter(chapter)) return 'Back Matter';
  if (isBodyChapter(chapter)) return 'Chapter';
  return 'Section';
}

function sortChapters(chapters = []) {
  const safe = Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  const sorted = [...safe].sort((a, b) => Number(a?.chapter_number || 0) - Number(b?.chapter_number || 0));
  const front = sorted.filter((chapter) => isFrontMatter(chapter));
  const body = sorted.filter((chapter) => isBodyChapter(chapter));
  const back = sorted.filter((chapter) => isBackMatter(chapter));
  return [...front, ...body, ...back];
}

function firstLineOf(content = '') {
  return safeText(content)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || '';
}

function cleanHeadingText(value = '') {
  return safeText(value)
    .replace(/^#{1,6}\s+/, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function looksLikeRepeatedChapterHeading(chapter, index) {
  const content = getChapterContent(chapter);
  const first = firstLineOf(content);
  const label = getChapterLabel(chapter, index);

  if (!first) return false;

  const cleanFirst = cleanHeadingText(first);
  const cleanTitle = cleanHeadingText(chapter?.title || '');
  const cleanLabel = cleanHeadingText(label);

  if (/^chapter\s+([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(first)) return true;
  if (cleanTitle && cleanFirst === cleanTitle) return true;
  if (cleanLabel && cleanFirst === cleanLabel) return true;
  return false;
}

function detectVerifyTags(content = '') {
  return safeText(content).match(/\[VERIFY:[^\]]+\]/gi) || [];
}

function detectSceneBreaks(content = '') {
  return safeText(content).match(/^\s*(---|\*\s*\*\s*\*|•\s*•\s*•|⁂|—{3,}|–{3,})\s*$/gm) || [];
}

function detectSuspiciousPlaceholders(content = '') {
  const found = [];
  PLACEHOLDER_PATTERNS.forEach((pattern) => {
    const matches = safeText(content).match(pattern);
    if (matches?.length) found.push(...matches);
  });
  return found;
}

function detectFinanceContamination(content = '') {
  const lower = stripHtml(content).toLowerCase();
  return FINANCE_CONTAMINATION_TERMS.filter((term) => lower.includes(term));
}

function detectOverclaims(content = '') {
  const found = [];
  OVERCLAIM_PATTERNS.forEach((pattern) => {
    const matches = safeText(content).match(pattern);
    if (matches?.length) found.push(...matches);
  });
  return found;
}

function detectAiRhythm(content = '') {
  const found = [];
  AI_RHYTHM_PATTERNS.forEach((pattern) => {
    const matches = safeText(content).match(pattern);
    if (matches?.length) found.push(...matches);
  });
  return found;
}

function detectCopyeditResidue(content = '') {
  return COPYEDIT_PATTERNS.flatMap((item) => {
    const count = countMatches(content, item.pattern);
    return count ? [{ label: item.label, count }] : [];
  });
}

function detectWallOfText(content = '') {
  const normalized = safeText(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = normalized.split(/\n\s*\n+/).map((p) => stripHtml(p)).filter(Boolean);
  if (!paragraphs.length) return { hasWall: false, longestParagraphWords: 0, paragraphCount: 0 };
  const longestParagraphWords = Math.max(...paragraphs.map((p) => countWords(p)));
  const hasWall = longestParagraphWords > 280 || (paragraphs.length <= 2 && countWords(normalized) > 900);
  return { hasWall, longestParagraphWords, paragraphCount: paragraphs.length };
}

function countHumanTerms(content = '') {
  const lower = stripHtml(content).toLowerCase();
  return HUMAN_TERMS.reduce((sum, term) => sum + countTerm(lower, term), 0);
}

function countSourceAnchors(content = '') {
  const lower = stripHtml(content).toLowerCase();
  return SOURCE_ANCHOR_TERMS.reduce((sum, term) => sum + countTerm(lower, term), 0);
}

function isLikelyNonfictionProject(project = {}, chapters = []) {
  const text = [
    project?.book_type,
    project?.project_type,
    project?.genre,
    project?.subgenre,
    project?.title,
    project?.subtitle,
    project?.description,
    project?.seed_concept,
    chapters.slice(0, 3).map((chapter) => `${chapter?.title || ''} ${getChapterContent(chapter).slice(0, 1200)}`).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /\b(nonfiction|history|historical|true crime|investigative|memoir|biography|policy|religion|caregiving|training|manual|guide|journalism|documentary|civic|medical|psychology|business|self-help)\b/.test(text);
}

function hasBibliography(backMatter = []) {
  return backMatter.some((chapter) => /bibliography|sources|works cited|references|notes/i.test(safeText(chapter?.title || '')));
}

function hasAuthorsNote(frontMatter = [], backMatter = []) {
  return [...frontMatter, ...backMatter].some((chapter) => /author.?s note|source note|method note|methodology/i.test(safeText(chapter?.title || '')));
}

function looksLikeMarketPromiseMismatch(project = {}, hasUnresolvedLanguage = false) {
  const text = [project?.title, project?.subtitle, project?.description, project?.tagline]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const promisesSolved = /\b(true story|exposed|exposé|solved|revealed|the truth|definitive|what really happened|finally tells)\b/.test(text);
  return promisesSolved && hasUnresolvedLanguage;
}

function makeIssue({
  id,
  severity = 'info',
  category = 'General',
  title,
  detail,
  chapterId = null,
  chapterLabel = '',
  sectionType = '',
  suggestion = '',
}) {
  return { id, severity, category, title, detail, chapterId, chapterLabel, sectionType, suggestion };
}

function buildDuplicateTitleIssues(bodyStats) {
  const byTitle = new Map();

  bodyStats.forEach((stat) => {
    const title = cleanHeadingText(stat.chapter?.title || '');
    if (!title) return;
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title).push(stat);
  });

  const issues = [];

  byTitle.forEach((items, title) => {
    if (items.length < 2) return;
    items.forEach((stat, idx) => {
      issues.push(
        makeIssue({
          id: `duplicate-title-${title}-${stat.id || idx}`,
          severity: 'warning',
          category: 'Structure',
          title: 'Duplicate chapter title',
          detail: `"${stat.label}" shares a title with another chapter.`,
          chapterId: stat.id,
          chapterLabel: stat.label,
          sectionType: stat.type,
          suggestion: 'Duplicate titles may be intentional, but they can confuse navigation and table-of-contents review.',
        })
      );
    });
  });

  return issues;
}

function buildHealthReport({ project, chapters }) {
  const ordered = sortChapters(chapters);
  const bodyChapters = ordered.filter((chapter) => isBodyChapter(chapter));
  const frontMatter = ordered.filter((chapter) => isFrontMatter(chapter));
  const backMatter = ordered.filter((chapter) => isBackMatter(chapter));
  const isNonfiction = isLikelyNonfictionProject(project, ordered);
  const issues = [];

  const chapterStats = ordered.map((chapter, index) => {
    const content = getChapterContent(chapter);
    const words = countWords(content);
    const text = normalizeText(content);
    const label = getChapterLabel(chapter, index);
    const type = getSectionType(chapter);
    const verifyTags = detectVerifyTags(content);
    const placeholders = detectSuspiciousPlaceholders(content);
    const financeContamination = detectFinanceContamination(content);
    const overclaims = detectOverclaims(content);
    const aiRhythm = detectAiRhythm(content);
    const copyeditResidue = detectCopyeditResidue(content);
    const wallText = detectWallOfText(content);
    const sourceAnchors = countSourceAnchors(content);
    const humanTerms = countHumanTerms(content);
    const motifStats = MOTIF_BUDGETS.map((budget) => {
      const count = countTerm(content, budget.term);
      const rate = per10k(count, words);
      return { ...budget, count, rate };
    });

    return {
      id: chapter?.id,
      label,
      type,
      chapter,
      words,
      chars: text.length,
      hasContent: words > 0 || text.length > 0,
      verifyTags,
      placeholders,
      financeContamination,
      overclaims,
      aiRhythm,
      copyeditResidue,
      wallText,
      sourceAnchors,
      humanTerms,
      sourceAnchorRate: per10k(sourceAnchors, words),
      humanRate: per10k(humanTerms, words),
      motifStats,
      sceneBreaks: detectSceneBreaks(content),
      repeatedHeading: looksLikeRepeatedChapterHeading(chapter, index),
    };
  });

  const totalWords = chapterStats.reduce((sum, item) => sum + item.words, 0);
  const bodyStats = chapterStats.filter((item) => isBodyChapter(item.chapter));
  const bodyWordCounts = bodyStats.map((item) => item.words).filter((value) => value > 0);
  const avgBodyWords = bodyWordCounts.length
    ? Math.round(bodyWordCounts.reduce((sum, value) => sum + value, 0) / bodyWordCounts.length)
    : 0;

  bodyStats.forEach((stat, index) => {
    const chapter = stat.chapter;
    const label = stat.label;

    if (!stat.hasContent) {
      issues.push(makeIssue({
        id: `empty-${chapter?.id || index}`,
        severity: 'critical',
        category: 'Structure',
        title: 'Empty section',
        detail: `${label} has no visible manuscript content.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Draft this section or remove it before final export.',
      }));
    }

    if (stat.words > 0 && stat.words < 750) {
      issues.push(makeIssue({
        id: `short-${chapter?.id || index}`,
        severity: 'warning',
        category: 'Structure',
        title: 'Very short chapter',
        detail: `${label} is only ${stat.words.toLocaleString()} words.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Review for completeness, missing evidence, or underdeveloped human stakes.',
      }));
    }

    if (avgBodyWords > 0 && stat.words > avgBodyWords * 2.25) {
      issues.push(makeIssue({
        id: `long-${chapter?.id || index}`,
        severity: 'info',
        category: 'Pacing',
        title: 'Chapter is much longer than average',
        detail: `${label} is ${stat.words.toLocaleString()} words; average body chapter length is about ${avgBodyWords.toLocaleString()} words.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Consider splitting, tightening, or adding clearer section turns.',
      }));
    }

    if (!safeText(chapter?.title).trim()) {
      issues.push(makeIssue({
        id: `missing-title-${chapter?.id || index}`,
        severity: 'warning',
        category: 'Structure',
        title: 'Missing chapter title',
        detail: `Chapter ${chapter?.chapter_number || index + 1} does not have a title.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Add a chapter title or confirm numbered-only chapters are intentional.',
      }));
    }

    if (stat.repeatedHeading) {
      issues.push(makeIssue({
        id: `repeated-heading-${chapter?.id || index}`,
        severity: 'warning',
        category: 'Export Hygiene',
        title: 'Possible repeated heading inside body',
        detail: `${label} appears to start with a duplicate chapter/title line.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Remove duplicate heading text from the chapter body if export already creates headings.',
      }));
    }

    if (stat.verifyTags.length) {
      issues.push(makeIssue({
        id: `verify-${chapter?.id || index}`,
        severity: 'critical',
        category: 'Source Integrity',
        title: 'VERIFY tag still present',
        detail: `${label} contains ${stat.verifyTags.length} verification note${stat.verifyTags.length === 1 ? '' : 's'}.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Resolve all [VERIFY: ...] notes before final export.',
      }));
    }

    if (stat.placeholders.length) {
      const unique = Array.from(new Set(stat.placeholders)).slice(0, 5);
      issues.push(makeIssue({
        id: `placeholder-${chapter?.id || index}`,
        severity: /\[SOURCE|\[CITATION|\[RESEARCH/i.test(unique.join(' ')) ? 'critical' : 'warning',
        category: 'Source Integrity',
        title: 'Placeholder text detected',
        detail: `${label} contains possible placeholder text: ${unique.join(', ')}`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Replace placeholders with verified source detail or remove the claim.',
      }));
    }

    if (stat.financeContamination.length && isNonfiction && !/finance|invest|market|retirement|wall street/i.test(`${project?.genre || ''} ${project?.title || ''} ${project?.subtitle || ''}`)) {
      issues.push(makeIssue({
        id: `finance-contamination-${chapter?.id || index}`,
        severity: 'critical',
        category: 'Bibliography Integrity',
        title: 'Possible cross-project source contamination',
        detail: `${label} contains unrelated finance/investing source terms: ${stat.financeContamination.slice(0, 5).join(', ')}.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Strip unrelated source material. Final nonfiction credibility cannot pass with cross-project bibliography contamination.',
      }));
    }

    if (stat.overclaims.length) {
      issues.push(makeIssue({
        id: `overclaim-${chapter?.id || index}`,
        severity: 'warning',
        category: 'Credibility',
        title: 'Unsupported certainty / overclaim risk',
        detail: `${label} contains ${stat.overclaims.length} phrase${stat.overclaims.length === 1 ? '' : 's'} that may overstate what the record proves.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Replace certainty language with documented/inferred/unresolved wording unless the source is explicitly shown.',
      }));
    }

    if (stat.wallText.hasWall) {
      issues.push(makeIssue({
        id: `wall-text-${chapter?.id || index}`,
        severity: 'warning',
        category: 'Readability',
        title: 'Wall-of-text paragraph risk',
        detail: `${label} has a longest paragraph of about ${stat.wallText.longestParagraphWords.toLocaleString()} words.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Break long blocks into shorter documentary paragraphs with clearer evidence turns.',
      }));
    }

    if (isNonfiction && stat.words >= 1200 && stat.sourceAnchorRate < 4) {
      issues.push(makeIssue({
        id: `source-anchor-weak-${chapter?.id || index}`,
        severity: 'warning',
        category: 'Credibility',
        title: 'Weak visible source anchoring',
        detail: `${label} has few visible source/evidence anchors for its length.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Add named records, reports, newspapers, archival categories, testimony, ledgers, or source-status language.',
      }));
    }

    if (isNonfiction && stat.words >= 1200 && stat.humanRate < 5) {
      issues.push(makeIssue({
        id: `human-texture-weak-${chapter?.id || index}`,
        severity: 'warning',
        category: 'Human Element',
        title: 'Weak human specificity',
        detail: `${label} appears institution-heavy and person-light.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Add named people where verified, family/community consequence, witness perspective, or clearly state when the archive erases human detail.',
      }));
    }

    const aiRate = per10k(stat.aiRhythm.length, stat.words);
    if (stat.words >= 1200 && aiRate > 18) {
      issues.push(makeIssue({
        id: `ai-rhythm-${chapter?.id || index}`,
        severity: 'warning',
        category: 'AI-Smell Risk',
        title: 'Synthetic rhythm / abstract phrasing risk',
        detail: `${label} contains dense repeated elevated/rhetorical phrasing.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Vary paragraph rhythm, cut repeated thesis phrases, add blunt factual sentences and concrete source-grounded detail.',
      }));
    }

    const overloadedMotifs = stat.motifStats.filter((item) => item.rate >= item.warningPer10k);
    if (overloadedMotifs.length) {
      issues.push(makeIssue({
        id: `motif-overload-${chapter?.id || index}`,
        severity: overloadedMotifs.some((item) => item.rate >= item.criticalPer10k) ? 'critical' : 'warning',
        category: 'Repetition',
        title: 'Motif repetition overload',
        detail: `${label} overuses: ${overloadedMotifs.map((item) => `${item.term} (${item.count})`).join(', ')}.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Reduce repeated motifs or replace them with new evidence, new people, new documents, or a new investigative step.',
      }));
    }

    if (stat.copyeditResidue.length) {
      issues.push(makeIssue({
        id: `copyedit-residue-${chapter?.id || index}`,
        severity: 'warning',
        category: 'Copyedit',
        title: 'Copyedit residue detected',
        detail: `${label} contains possible residue: ${stat.copyeditResidue.map((item) => `${item.label} (${item.count})`).join(', ')}.`,
        chapterId: chapter?.id,
        chapterLabel: label,
        sectionType: stat.type,
        suggestion: 'Run final copyedit or manually repair these exact patterns before export.',
      }));
    }
  });

  issues.push(...buildDuplicateTitleIssues(bodyStats));

  if (!safeText(project?.title).trim()) {
    issues.push(makeIssue({
      id: 'missing-project-title',
      severity: 'critical',
      category: 'Metadata',
      title: 'Missing book title',
      detail: 'The project does not appear to have a book title.',
      suggestion: 'Add a title before exporting a final manuscript.',
    }));
  }

  if (!safeText(project?.author_name).trim()) {
    issues.push(makeIssue({
      id: 'missing-author-name',
      severity: 'warning',
      category: 'Metadata',
      title: 'Missing author name',
      detail: 'The project does not appear to have an author name.',
      suggestion: 'Add an author name or pen name before exporting a final manuscript.',
    }));
  }

  if (!bodyChapters.length) {
    issues.push(makeIssue({
      id: 'no-body-chapters',
      severity: 'critical',
      category: 'Structure',
      title: 'No body chapters detected',
      detail: 'The manuscript does not appear to have body chapters.',
      suggestion: 'Check chapter type/order metadata before exporting.',
    }));
  }

  if (!frontMatter.length) {
    issues.push(makeIssue({
      id: 'no-front-matter',
      severity: 'info',
      category: 'Publishing Readiness',
      title: 'No front matter detected',
      detail: 'No copyright, dedication, foreword, author note, or similar front matter was detected.',
      suggestion: 'Optional, but most publish-ready books include at least a title/copyright page.',
    }));
  }

  if (isNonfiction && !hasAuthorsNote(frontMatter, backMatter)) {
    issues.push(makeIssue({
      id: 'missing-authors-note',
      severity: 'warning',
      category: 'Credibility',
      title: 'Missing author/source note',
      detail: 'Nonfiction manuscripts should explain source method, uncertainty, composites, reconstructions, and evidence limits.',
      suggestion: 'Add an Author’s Note or Source Note that distinguishes documented fact, inference, oral history, reconstruction, and unresolved questions.',
    }));
  }

  if (isNonfiction && !hasBibliography(backMatter)) {
    issues.push(makeIssue({
      id: 'missing-bibliography',
      severity: 'critical',
      category: 'Bibliography Integrity',
      title: 'Missing bibliography/sources section',
      detail: 'A nonfiction manuscript needs a sources section before it can score as credible/publish-ready.',
      suggestion: 'Generate or add a bibliography based only on verified project-specific sources.',
    }));
  }

  const unresolvedCount = bodyStats.reduce((sum, stat) => sum + countMatches(getChapterContent(stat.chapter), /\bunresolved\b|\bnot establish\b|\bcannot prove\b|\bavailable record does not\b/gi), 0);
  if (isNonfiction && looksLikeMarketPromiseMismatch(project, unresolvedCount > 3)) {
    issues.push(makeIssue({
      id: 'market-promise-mismatch',
      severity: 'warning',
      category: 'Positioning',
      title: 'Possible market promise mismatch',
      detail: 'Metadata/description may promise a solved exposé while the manuscript language appears more unresolved/investigative.',
      suggestion: 'Position the book as an investigation into a buried question unless the evidence truly supports a solved conclusion.',
    }));
  }

  const emptyCount = chapterStats.filter((item) => !item.hasContent).length;
  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const infoCount = issues.filter((issue) => issue.severity === 'info').length;

  const categoryIssues = (category) => issues.filter((issue) => issue.category === category);
  const scoreFor = (category, base = 100) => {
    const items = categoryIssues(category);
    const critical = items.filter((issue) => issue.severity === 'critical').length;
    const warning = items.filter((issue) => issue.severity === 'warning').length;
    const info = items.filter((issue) => issue.severity === 'info').length;
    return clampScore(base - critical * 22 - warning * 8 - info * 2);
  };

  const credibilityScore = scoreFor('Credibility');
  const bibliographyScore = scoreFor('Bibliography Integrity');
  const sourceScore = scoreFor('Source Integrity');
  const humanScore = scoreFor('Human Element');
  const aiSmellScore = scoreFor('AI-Smell Risk');
  const repetitionScore = scoreFor('Repetition');
  const copyeditScore = scoreFor('Copyedit');
  const structureScore = scoreFor('Structure');
  const positioningScore = scoreFor('Positioning');

  let score = 100;
  score -= criticalCount * 11;
  score -= warningCount * 4;
  score -= infoCount * 1;
  score -= emptyCount * 6;
  if (isNonfiction) {
    score = Math.min(score, Math.round((credibilityScore + bibliographyScore + sourceScore + humanScore + aiSmellScore + repetitionScore + copyeditScore + structureScore + positioningScore) / 9));
  }
  score = clampScore(score);

  let status = 'Ready';
  if (criticalCount > 0) status = 'Needs attention';
  else if (warningCount > 0) status = 'Usable with warnings';
  else if (infoCount > 0) status = 'Clean with notes';

  return {
    ordered,
    chapterStats,
    issues,
    score,
    status,
    isNonfiction,
    totalWords,
    averageBodyWords: avgBodyWords,
    scores: {
      credibility: credibilityScore,
      bibliography: bibliographyScore,
      sourceIntegrity: sourceScore,
      humanSpecificity: humanScore,
      aiSmellResistance: aiSmellScore,
      repetitionControl: repetitionScore,
      copyeditReadiness: copyeditScore,
      structure: structureScore,
      positioning: positioningScore,
    },
    counts: {
      totalSections: ordered.length,
      bodyChapters: bodyChapters.length,
      frontMatter: frontMatter.length,
      backMatter: backMatter.length,
      critical: criticalCount,
      warning: warningCount,
      info: infoCount,
      empty: emptyCount,
    },
  };
}

function SeverityIcon({ severity }) {
  if (severity === 'critical') return <ShieldAlert className="h-4 w-4 text-red-600" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <Info className="h-4 w-4 text-blue-600" />;
}

function severityClasses(severity) {
  if (severity === 'critical') return 'border-red-200 bg-red-50 text-red-900';
  if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-blue-200 bg-blue-50 text-blue-900';
}

function scoreColor(score) {
  if (score >= 95) return 'text-emerald-700';
  if (score >= 85) return 'text-blue-700';
  if (score >= 70) return 'text-amber-700';
  return 'text-red-700';
}

function ScoreRing({ score }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-background text-lg font-black ${scoreColor(score)}`}>
        {score}
      </div>
      <div>
        <p className="text-sm font-black text-foreground">Health Score</p>
        <p className="text-xs text-muted-foreground">Out of 100</p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-lg font-black text-foreground">{value}</p>
    </div>
  );
}

function ScoreMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-sm font-black ${scoreColor(value)}`}>{value}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-current opacity-60" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function IssueCard({ issue, onSelectChapter }) {
  return (
    <div className={`rounded-2xl border p-3 ${severityClasses(issue.severity)}`}>
      <div className="flex items-start gap-2">
        <SeverityIcon severity={issue.severity} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black">{issue.title}</p>
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              {issue.category}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 opacity-90">{issue.detail}</p>
          {issue.suggestion && (
            <p className="mt-2 rounded-xl bg-white/50 px-3 py-2 text-[11px] leading-5">
              <span className="font-bold">Fix:</span> {issue.suggestion}
            </p>
          )}
          {issue.chapterId && (
            <button
              type="button"
              onClick={() => onSelectChapter?.(issue.chapterId)}
              className="mt-2 text-[11px] font-bold underline underline-offset-2"
            >
              Open {issue.chapterLabel || 'section'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChapterStatRow({ stat, onSelectChapter }) {
  const [open, setOpen] = useState(false);
  const warningSignals = stat.verifyTags.length + stat.placeholders.length + stat.overclaims.length + stat.financeContamination.length + stat.copyeditResidue.length + (stat.wallText.hasWall ? 1 : 0);

  return (
    <div className="rounded-2xl border border-border/60 bg-background/75">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{stat.label}</p>
          <p className="text-[10px] text-muted-foreground">{stat.type}</p>
        </div>
        {warningSignals > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
            {warningSignals} flags
          </span>
        )}
        <div className="text-right">
          <p className="text-xs font-black text-foreground">{stat.words.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">words</p>
        </div>
      </button>

      {open && (
        <div className="border-t border-border/50 px-3 py-3 text-xs text-muted-foreground">
          <div className="grid gap-2 sm:grid-cols-3">
            <div><p className="font-bold text-foreground">{stat.sourceAnchors}</p><p>source anchors</p></div>
            <div><p className="font-bold text-foreground">{stat.humanTerms}</p><p>human terms</p></div>
            <div><p className="font-bold text-foreground">{warningSignals}</p><p>risk flags</p></div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div><p className="font-bold text-foreground">{stat.wallText.paragraphCount}</p><p>paragraph blocks</p></div>
            <div><p className="font-bold text-foreground">{stat.sceneBreaks.length}</p><p>scene breaks</p></div>
            <div><p className="font-bold text-foreground">{stat.chars.toLocaleString()}</p><p>characters</p></div>
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3 h-8 rounded-full text-xs" onClick={() => onSelectChapter?.(stat.id)}>
            Open Section
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ManuscriptHealthCheck({ open, onClose, project, chapters = [], onSelectChapter }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    console.info('[MANUSCRIPT-HEALTH] Loaded ManuscriptHealthCheck-v3-nonfiction-integrity-dashboard');
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const report = useMemo(() => buildHealthReport({ project, chapters }), [project, chapters]);

  const filteredIssues = useMemo(() => {
    let results = report.issues;
    if (filter !== 'all') results = results.filter((issue) => issue.severity === filter || issue.category === filter);
    const lower = query.trim().toLowerCase();
    if (lower) {
      results = results.filter((issue) =>
        [issue.title, issue.detail, issue.chapterLabel, issue.sectionType, issue.suggestion, issue.category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(lower)
      );
    }
    return results;
  }, [filter, query, report.issues]);

  if (!open) return null;

  const handleSelectChapter = (chapterId) => {
    onSelectChapter?.(chapterId);
    onClose?.();
  };

  const categoryFilters = report.isNonfiction
    ? ['Credibility', 'Bibliography Integrity', 'Source Integrity', 'Human Element', 'AI-Smell Risk', 'Repetition', 'Copyedit', 'Positioning']
    : ['Structure', 'Export Hygiene', 'Copyedit'];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="fixed right-5 top-5 z-[10000] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-xl transition hover:bg-muted"
        aria-label="Close manuscript health check"
        title="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative flex max-h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="shrink-0 border-b border-border/60 bg-background/95 px-4 py-4 pr-16">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-black text-foreground">Manuscript Health Check</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Pre-export scan for credibility, bibliography integrity, source placeholders, overclaiming, human specificity,
                AI-smell risk, motif repetition, copyedit residue, and publishing readiness.
              </p>
              {report.isNonfiction && (
                <p className="mt-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                  Nonfiction integrity mode is active. Target for serious publication: all major sub-scores at 95+.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4">
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                <ScoreRing score={report.score} />
                <div className="mt-4 rounded-2xl border border-border/60 bg-card/70 p-3">
                  <div className="flex items-center gap-2">
                    {report.counts.critical === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    <p className="text-sm font-black text-foreground">{report.status}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {report.counts.critical > 0
                      ? 'Fix critical issues before final export.'
                      : report.counts.warning > 0
                        ? 'Export is possible, but review warnings first.'
                        : 'No major manuscript blockers detected.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={BookOpen} label="Words" value={report.totalWords.toLocaleString()} />
                <StatCard icon={Layers} label="Sections" value={report.counts.totalSections.toLocaleString()} />
                <StatCard icon={FileText} label="Chapters" value={report.counts.bodyChapters.toLocaleString()} />
                <StatCard icon={Sparkles} label="Avg Ch." value={report.averageBodyWords.toLocaleString()} />
              </div>

              {report.isNonfiction && (
                <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                  <p className="text-sm font-black text-foreground">Nonfiction Integrity Scores</p>
                  <div className="mt-3 space-y-2">
                    <ScoreMetric label="Credibility" value={report.scores.credibility} />
                    <ScoreMetric label="Bibliography" value={report.scores.bibliography} />
                    <ScoreMetric label="Source Integrity" value={report.scores.sourceIntegrity} />
                    <ScoreMetric label="Human Specificity" value={report.scores.humanSpecificity} />
                    <ScoreMetric label="AI-Smell Resistance" value={report.scores.aiSmellResistance} />
                    <ScoreMetric label="Repetition Control" value={report.scores.repetitionControl} />
                    <ScoreMetric label="Copyedit Readiness" value={report.scores.copyeditReadiness} />
                    <ScoreMetric label="Positioning" value={report.scores.positioning} />
                  </div>
                </div>
              )}

              <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                <p className="text-sm font-black text-foreground">Issue Summary</p>
                <div className="mt-3 space-y-2 text-xs">
                  {[
                    ['critical', 'Critical', report.counts.critical, 'border-red-300 bg-red-50 text-red-900'],
                    ['warning', 'Warnings', report.counts.warning, 'border-amber-300 bg-amber-50 text-amber-900'],
                    ['info', 'Notes', report.counts.info, 'border-blue-300 bg-blue-50 text-blue-900'],
                    ['all', 'All Issues', report.issues.length, 'border-primary/40 bg-primary/10 text-primary'],
                  ].map(([key, label, count, activeClass]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 ${filter === key ? activeClass : 'border-border/60 bg-card/60 text-muted-foreground'}`}
                    >
                      <span>{label}</span>
                      <span className="font-black">{count}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 border-t border-border/50 pt-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {categoryFilters.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setFilter(category)}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${filter === category ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card/70 text-muted-foreground'}`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search health issues…"
                      className="h-10 w-full rounded-2xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <Button type="button" variant="outline" className="h-10 rounded-2xl" onClick={() => { setQuery(''); setFilter('all'); }}>
                    Clear
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    <p className="text-sm font-black text-foreground">Detected Issues</p>
                  </div>
                  <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                    {filteredIssues.length ? (
                      filteredIssues.map((issue) => <IssueCard key={issue.id} issue={issue} onSelectChapter={handleSelectChapter} />)
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 px-4 py-8 text-center">
                        <BadgeCheck className="mx-auto h-8 w-8 text-emerald-600" />
                        <p className="mt-3 text-sm font-black text-foreground">No matching issues.</p>
                        <p className="mt-1 text-xs text-muted-foreground">Try another filter or search term.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <p className="text-sm font-black text-foreground">Section Diagnostics</p>
                  </div>
                  <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                    {report.chapterStats.map((stat) => (
                      <ChapterStatRow key={stat.id || stat.label} stat={stat} onSelectChapter={handleSelectChapter} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-background/95 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              This scan is advisory and read-only. It does not modify the manuscript.
            </p>
            <Button type="button" onClick={onClose} className="ml-auto rounded-full">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
