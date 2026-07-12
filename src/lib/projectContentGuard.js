/**
 * Project Content Guard
 *
 * Stops wrong-project / wrong-chapter material from being saved into a manuscript.
 * This is intentionally conservative: it does not try to judge style. It looks for
 * hard evidence that generated prose has drifted into another project universe.
 */

const DEFAULT_NEVER_NAME = new Set([
  'The','A','An','And','But','Or','Nor','For','Yet','So','This','That','These','Those','There','Here',
  'When','Where','What','Why','How','Who','Whom','Which','While','Before','After','During','Because',
  'Chapter','Story','Book','Part','Act','Scene','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday',
  'January','February','March','April','May','June','July','August','September','October','November','December',
  'American','America','British','French','Paris','New','York','Harlem','Washington','Broadway','Hollywood',
  'God','Lord','Christ','Jesus','Navy','Army','Committee','Congress','President','Federal','Theatre',
]);

// GUARDFIX-1: only unambiguous foreign-universe compounds. Common English words
// ('synthetic', 'conduits', 'laptop', 'biometric', 'airship', ...) false-positived
// on ordinary fiction (a rope's synthetic fibers blocked an adventure chapter).
const HARD_FOREIGN_TECH_TERMS = [
  'data-sliver','data sliver','holoscreen','synth-leather','neural interface',
  'interface crown','feedback loop integrity','auxiliary power conduit','aethereal conduit',
  'tracker pinged','tracking chip','encrypted drive','encryption chip',
  'flechette pistol','charge cell','transit pod','server rack',
  'cybernetic','cybernetics','null-space','technopathic','quietus','perennial solutions',
  'grey room','procurement routes','data chip',
  'neural template','recursive pattern','containment cell',
];

// GUARDFIX-1: multiword/rare terms only. Single common words ('asset', 'objective',
// 'pistol', 'stun', 'tracker', ...) are legitimate vocabulary in thrillers, crime,
// and period adventure; they tripled-scored on historical-looking projects and
// blocked clean chapters.
const MODERN_SPY_HEIST_TERMS = [
  'lockpick','ventilation shaft','service corridor','janitor’s closet','janitor\'s closet','scanner plate',
  'secure container','data chip','burner phone','dead drop',
  'flechette','sub-basement','freight tunnel','security grid',
];

const COMMON_FOREIGN_EXAMPLE_NAMES = [
  'Kael','Kaelen','Voss','Silas','Holt','Merrick','Mikhail','Veldt','Aris','Perennial','Quietus',
  'Drax','Corin','Vance','Ryker','Nikolai',
];

function asText(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return ''; }
  }
  return String(value);
}

function compactWhitespace(text = '') {
  return String(text || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function stripMarkdownNoise(text = '') {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`>\[\](){}]/g, ' ')
    .replace(/\bChapter\s+\d+\b/gi, ' ')
    .replace(/\bStory\s+\d+\b/gi, ' ');
}

function escapeRx(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countWords(text = '') {
  return (String(text || '').trim().match(/\b[\w’'-]+\b/g) || []).length;
}

function splitParagraphs(text = '') {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);
}

function projectTextForSignature(project = {}, chapter = {}, chapters = []) {
  const fields = [
    project.title,
    project.name,
    project.seed_concept,
    project.story_bible_md,
    project.character_bible_md,
    project.characters_md,
    project.world_bible_md,
    project.world_md,
    project.canon_md,
    project.outline_md,
    project.voice_md,
    project.research_md,
    project.fandom_name,
    project.source_universe,
    project.canon_characters,
    project.author_voice,
    project.author_voice_notes,
    chapter.title,
    chapter.beat_summary,
    chapter.summary,
    chapter.description,
    chapter.outline,
    chapter.beats_md,
  ];

  (chapters || []).slice(0, 80).forEach(ch => {
    fields.push(ch?.title, ch?.beat_summary, ch?.summary, ch?.description);
  });

  return fields.map(asText).filter(Boolean).join('\n');
}

function extractNameCandidates(text = '') {
  const cleaned = stripMarkdownNoise(text);
  const raw = cleaned.match(/\b[A-Z][a-zA-Z’'-]{2,}(?:\s+[A-Z][a-zA-Z’'-]{2,})?\b/g) || [];
  const names = new Map();
  for (const item of raw) {
    const first = item.split(/\s+/)[0].replace(/[’']/g, '');
    if (!first || DEFAULT_NEVER_NAME.has(first)) continue;
    if (/^(Chapter|Story|Scene|Book|Part|Act)$/i.test(first)) continue;
    names.set(first, (names.get(first) || 0) + 1);
  }
  return names;
}

function extractAllowedNames(project = {}, chapter = {}, chapters = []) {
  const source = projectTextForSignature(project, chapter, chapters);
  const names = extractNameCandidates(source);
  const allowed = new Set();

  for (const [name, count] of names.entries()) {
    if (count >= 1) allowed.add(name);
  }

  const manual = [
    project.protagonist_name,
    project.main_character_name,
    project.antagonist_name,
    project.fandom_name,
    project.source_universe,
    project.author_name,
  ];
  for (const value of manual) {
    const parts = asText(value).match(/\b[A-Z][a-zA-Z’'-]{2,}\b/g) || [];
    parts.forEach(p => { if (!DEFAULT_NEVER_NAME.has(p)) allowed.add(p); });
  }

  const allowRaw = [project.allow_characters, project.canon_characters, project.character_names]
    .map(asText).join('\n');
  (allowRaw.match(/\b[A-Z][a-zA-Z’'-]{2,}\b/g) || []).forEach(p => {
    if (!DEFAULT_NEVER_NAME.has(p)) allowed.add(p);
  });

  return allowed;
}

function projectLooksHistoricalOrLiterary(project = {}) {
  const blob = [
    project.genre_group,
    project.genre,
    project.subgenre,
    project.content_lane,
    project.project_format,
    project.title,
    project.name,
    project.seed_concept,
    project.world_md,
    project.world_bible_md,
    project.outline_md,
  ].map(asText).join(' ').toLowerCase();

  if (/sci[-\s]?fi|science fiction|cyberpunk|space opera|technothriller|techno-thriller|future|near-future|dystopian|post-apocalyptic|superhero|speculative/.test(blob)) {
    return false;
  }

  return /historical|194\d|193\d|195\d|world war|postwar|post-war|paris|harlem|broadway|committee|huac|lavender scare|port chicago|new york|jazz|singer|theatre|theater/.test(blob);
}

function projectLooksTechSpeculative(project = {}) {
  const blob = [project.genre_group, project.genre, project.subgenre, project.title, project.name, project.world_md, project.seed_concept]
    .map(asText).join(' ').toLowerCase();
  return /sci[-\s]?fi|science fiction|cyberpunk|techno|near-future|future|space|dystopian|ai|android|hacker|heist|spy|espionage|superhero/.test(blob);
}

function findTermHits(text = '', terms = []) {
  // GUARDFIX-1: whole-word/phrase matches only. Substring matching flagged
  // 'stunned' as 'stun' and 'assets' as 'asset'.
  const lower = String(text || '').toLowerCase();
  return terms.filter(term => new RegExp('\\b' + escapeRx(term.toLowerCase()) + '\\b').test(lower));
}

function paragraphNameHits(paragraph = '', allowedNames = new Set(), fullText = '') {
  // GUARDFIX-1: a capitalized token is a NAME candidate only if its lowercase
  // form never appears in the chapter. Sentence-initial ordinary words ('Her',
  // 'One', 'Snow', 'Then', 'Were') were scored as unknown foreign names.
  const names = extractNameCandidates(paragraph);
  const corpus = String(fullText || paragraph || '');
  const unknown = [];
  for (const name of names.keys()) {
    if (allowedNames.has(name) || DEFAULT_NEVER_NAME.has(name)) continue;
    const lowerForm = new RegExp('(^|[^A-Za-z’\'-])' + escapeRx(name.toLowerCase()) + '([^A-Za-z’\'-]|$)');
    if (lowerForm.test(corpus)) continue;
    unknown.push(name);
  }
  return [...new Set(unknown)];
}

function scoreParagraph(paragraph, allowedNames, project = {}, fullText = '') {
  const hardTechHits = findTermHits(paragraph, HARD_FOREIGN_TECH_TERMS);
  const heistHits = findTermHits(paragraph, MODERN_SPY_HEIST_TERMS);
  const knownForeignNames = COMMON_FOREIGN_EXAMPLE_NAMES.filter(name => {
    if (allowedNames.has(name)) return false;
    return new RegExp('\\b' + escapeRx(name) + '\\b').test(paragraph);
  });
  const unknownNames = paragraphNameHits(paragraph, allowedNames, fullText)
    .filter(n => !knownForeignNames.includes(n));

  const historical = projectLooksHistoricalOrLiterary(project);
  const techSpec = projectLooksTechSpeculative(project);

  let score = 0;
  score += hardTechHits.length * (techSpec ? 1 : 4);
  score += heistHits.length * (historical ? 3 : 1);
  score += knownForeignNames.length * 3;
  score += Math.min(unknownNames.length, 6) * 0.75;

  if (historical && /\b(pod|airship|synth|hologram|biometric|encryption|tracker|data[-\s]?sliver|flechette|cybernetic|technopathic)\b/i.test(paragraph)) {
    score += 6;
  }

  return {
    score,
    hardTechHits,
    heistHits,
    knownForeignNames,
    unknownNames,
  };
}

function findForeignBlock(paragraphs, allowedNames, project) {
  const fullText = paragraphs.join('\n\n');
  const scored = paragraphs.map((p, i) => ({ index: i, paragraph: p, words: countWords(p), ...scoreParagraph(p, allowedNames, project, fullText) }));

  for (let i = 0; i < scored.length; i += 1) {
    const current = scored[i];
    const next = scored[i + 1];
    const next2 = scored[i + 2];
    const hardSingle = current.score >= 10 && current.words >= 40;
    const hardPair = current.score >= 7 && next && next.score >= 6;
    const hardTriple = current.score >= 5 && next && next.score >= 5 && next2 && next2.score >= 5;

    if (hardSingle || hardPair || hardTriple) {
      return { startIndex: i, scored };
    }
  }

  return { startIndex: -1, scored };
}

function summarizeIssues(scored = []) {
  const hits = [];
  for (const item of scored) {
    if (item.score < 5) continue;
    const parts = [];
    if (item.knownForeignNames?.length) parts.push('foreign names: ' + item.knownForeignNames.slice(0, 6).join(', '));
    if (item.hardTechHits?.length) parts.push('foreign tech terms: ' + item.hardTechHits.slice(0, 6).join(', '));
    if (item.heistHits?.length) parts.push('heist/spy terms: ' + item.heistHits.slice(0, 6).join(', '));
    if (item.unknownNames?.length) parts.push('unknown names: ' + item.unknownNames.slice(0, 6).join(', '));
    if (parts.length) hits.push(`paragraph ${item.index + 1}: ${parts.join('; ')}`);
    if (hits.length >= 5) break;
  }
  return hits;
}

export function buildProjectContinuityLockBlock(project = {}, chapter = {}, chapters = []) {
  const allowedNames = [...extractAllowedNames(project, chapter, chapters)].sort().slice(0, 80);
  const isHistorical = projectLooksHistoricalOrLiterary(project);
  const title = project?.title || project?.name || 'this project';
  const chapterTitle = chapter?.title || chapter?.name || '';

  return `PROJECT / CHAPTER CONTAMINATION LOCK:
- You are writing ONLY this project: ${title}.
- Current chapter: ${chapter?.chapter_number || chapter?.number || ''}${chapterTitle ? ` — ${chapterTitle}` : ''}.
- Do not switch into another manuscript, another protagonist, another setting, another genre, or another timeline.
- Do not introduce unrelated proper names unless the chapter plan explicitly introduces them.
${allowedNames.length ? `- Known project/canon names and anchors include: ${allowedNames.join(', ')}.` : '- Use only names supplied by the project bible, chapter plan, canon notes, or immediate scene beat.'}
${isHistorical ? '- This appears to be historical/literary fiction. Do NOT write futuristic/cyberpunk/heist-tech terms such as data-sliver, holoscreen, synth-leather, tracker ping, biometric scanner, flechette pistol, transit pod, encryption chip, airship, or grey-room spy terminology unless those exact terms appear in the supplied chapter plan.' : ''}
- If previous context, research notes, model memory, or another project tries to intrude, ignore it. The chapter must remain inside the supplied project bible and chapter plan.
- If the scene beat is vague, deepen the current project conflict. Do not invent a new unrelated plotline.`;
}

export function validateProjectChapterContent({ project = {}, chapter = {}, chapters = [], content = '' } = {}) {
  const text = compactWhitespace(content);
  const paragraphs = splitParagraphs(text);
  const allowedNames = extractAllowedNames(project, chapter, chapters);
  const isHistorical = projectLooksHistoricalOrLiterary(project);
  const isTechSpec = projectLooksTechSpeculative(project);

  if (!text || paragraphs.length < 3) {
    return {
      ok: true,
      severity: 'none',
      shouldBlockSave: false,
      shouldAutoTrim: false,
      sanitizedText: content,
      issues: [],
      report: 'No contamination check needed.',
    };
  }

  const { startIndex, scored } = findForeignBlock(paragraphs, allowedNames, project);
  const allHardTechHits = findTermHits(text, HARD_FOREIGN_TECH_TERMS);
  const allHeistHits = findTermHits(text, MODERN_SPY_HEIST_TERMS);
  const allKnownForeignNames = COMMON_FOREIGN_EXAMPLE_NAMES.filter(name => !allowedNames.has(name) && new RegExp('\\b' + escapeRx(name) + '\\b').test(text));

  const issues = summarizeIssues(scored);

  const historicalTechConflict = isHistorical && (allHardTechHits.length >= 1 || allHeistHits.length >= 3);
  const foreignNameCluster = allKnownForeignNames.length >= 2;
  const severeBlock = startIndex >= 0;

  let severity = 'none';
  if (severeBlock || historicalTechConflict || foreignNameCluster) severity = 'critical';
  else if (!isTechSpec && (allHardTechHits.length >= 1 || allHeistHits.length >= 2 || allKnownForeignNames.length >= 1)) severity = 'warning';

  let sanitizedText = content;
  let shouldAutoTrim = false;
  let removedWords = 0;

  if (severity === 'critical' && startIndex > 0) {
    const keep = paragraphs.slice(0, startIndex).join('\n\n').trim();
    const removed = paragraphs.slice(startIndex).join('\n\n').trim();
    const keepWords = countWords(keep);
    removedWords = countWords(removed);
    if (keepWords >= 500 && removedWords >= 150) {
      sanitizedText = keep;
      shouldAutoTrim = true;
    }
  }

  const reportParts = [];
  if (allKnownForeignNames.length) reportParts.push(`foreign names: ${allKnownForeignNames.slice(0, 10).join(', ')}`);
  if (allHardTechHits.length) reportParts.push(`foreign tech terms: ${allHardTechHits.slice(0, 10).join(', ')}`);
  if (allHeistHits.length) reportParts.push(`heist/spy terms: ${allHeistHits.slice(0, 10).join(', ')}`);
  if (startIndex >= 0) reportParts.push(`suspect block begins at paragraph ${startIndex + 1}`);
  if (shouldAutoTrim) reportParts.push(`safe trim available; would remove ~${removedWords} words`);
  if (issues.length) reportParts.push(issues.join(' | '));

  return {
    ok: severity === 'none',
    severity,
    shouldBlockSave: severity === 'critical',
    shouldAutoTrim,
    sanitizedText,
    issues,
    report: reportParts.join(' | ') || 'No strong contamination pattern detected.',
    stats: {
      paragraphCount: paragraphs.length,
      suspectBlockStart: startIndex,
      hardTechHits: allHardTechHits,
      heistHits: allHeistHits,
      knownForeignNames: allKnownForeignNames,
      isHistorical,
      isTechSpec,
      removedWords,
    },
  };
}

export function stripProjectContaminationBlocks({ project = {}, chapter = {}, chapters = [], content = '' } = {}) {
  const guard = validateProjectChapterContent({ project, chapter, chapters, content });
  if (guard.shouldAutoTrim && guard.sanitizedText && guard.sanitizedText !== content) {
    return {
      changed: true,
      text: guard.sanitizedText,
      report: guard.report,
      guard,
    };
  }
  return {
    changed: false,
    text: content,
    report: guard.report,
    guard,
  };
}

export function makeProjectContentGuardError(chapter, guard) {
  const err = new Error(`Project contamination guard blocked Chapter ${chapter?.chapter_number || chapter?.number || '?'} before save. ${guard?.report || ''}`);
  err.projectContentGuard = true;
  err.guard = guard;
  return err;
}
