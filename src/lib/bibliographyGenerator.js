/**
 * bibliographyGenerator.js — v10 Project Source Rebuild
 *
 * Purpose:
 * - Stop cross-project bibliography contamination at the generator layer.
 * - Never inject finance/investing sources into non-finance nonfiction.
 * - Rebuild a usable project-relevant bibliography from manuscript + research notes.
 * - If the LLM returns thin/dirty output, repair it deterministically with domain-safe source leads.
 *
 * IMPORTANT:
 * This generator does not pretend to verify private archive box/folder numbers.
 * It creates a clean, project-relevant bibliography scaffold that the author can review and tighten.
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { buildClosedWorldBibliography, verifyBibliographyUrls } from '@/lib/closedWorldBibliography';
import { resolveChapterContent, chapterHasContent, prepareChapterContent } from '@/lib/chapterStorage';
import { resolveResearchContent } from '@/lib/researchStorage';
import { base44 } from '@/api/base44Client';
import { runWithNetworkRetry } from '@/lib/requestRetry';

const SOURCE_ENTRY_MINIMUM = 8;

const PLACEHOLDER_RE = /\[(?:SOURCE|CITATION|URL|DATE|ACCESS|TK|TODO|TBD|NEEDS?)\s*(?:NEEDED|REQUIRED)?[^\]]*\]|\b(?:SOURCE\s+NEEDED|CITATION\s+NEEDED|TK\s+SOURCE|TODO\s+CITATION|TBD\s+SOURCE)\b/i;

const FINANCE_CONTAMINATION_RE = /\b(?:Bogle|Malkiel|Vanguard|Morningstar|FINRA|Robinhood|SIPC|Roth\s+IRA|401\s*\(?k\)?|index\s+fund|mutual\s+fund|ETF|exchange-traded\s+fund|payment\s+for\s+order\s+flow|PFOF|Lusardi|Mitchell|Shafir|Thaler|consumer\s+credit|payday\s+loan|retirement\s+account|Investor\.gov|S\s*&\s*P\s+Dow\s+Jones|SPIVA)\b/i;

const MISSOURI_PRISON_RE = /\b(?:Missouri\s+State\s+Penitentiary|MSP\b|Jefferson\s+City|Cell\s+Hall\s+3|1954\s+riot|bloodiest\s+47\s+acres|Walter\s+Lee\s+Donnell|William\s+Donald\s+DeLapp|Mark\s+S\.\s+Schreiber|J\.\s*B\.\s*Johnson|Buried\s+Alive|Pierce\s+City|Governor\s+Phil\s+Donnelly|Missouri\s+State\s+Archives|Missouri\s+Digital\s+Heritage)\b/i;

const TRUE_CRIME_HISTORY_RE = /\b(?:riot|prison|penitentiary|coroner|death\s+certificate|court\s+records?|newspaper|archive|oral\s+history|institutional\s+records?|state\s+records?|redevelopment|fire\s+marshal|inmate|warden|correctional|lynching|execution|gas\s+chamber)\b/i;

const CAREGIVING_RE = /\b(?:caregiver|DSP\b|developmental\s+disabilit|Medicaid|waiver|HCBS|support\s+plan|person-centered|client\s+rights|Missouri\s+DMH|personal\s+care)\b/i;

const CIVIC_POLICY_RE = /\b(?:emergency\s+law|ordinance|municipal|city\s+council|public\s+health\s+order|executive\s+order|civil\s+libert|local\s+government|policy)\b/i;

const MEDICAL_HISTORY_RE = /\b(?:lobo(?:tomy|tomies)|psychiatric|asylum|hospital|MK-ULTRA|Paperclip|medical\s+ethics|doctor|patient|neurosurgery)\b/i;

const RELIGION_HISTORY_RE = /\b(?:religion|church|biblical|scripture|clergy|doctrine|apostle|gospel|temple|Rome|Galilee|Jerusalem)\b/i;

const FINANCE_DOMAIN_RE = /\b(?:personal\s+finance|financial\s+literacy|investing|retirement|stock\s+market|index\s+fund|ETF|Roth\s+IRA|401\s*\(?k\)?|brokerage|credit\s+card|payday\s+loan|student\s+loan|budgeting\s+book)\b/i;

export function isFrontMatter(ch) {
  const title = String(ch?.title || '').toLowerCase();
  return (
    title.includes('copyright') ||
    title.includes('title page') ||
    title.includes('dedication') ||
    title.includes('epigraph') ||
    title.includes('foreword') ||
    title.includes('preface') ||
    title.includes('author') ||
    title.includes('front matter') ||
    Number(ch?.chapter_number) === 0
  );
}

// NFEXPORT-BIB-1: re-exported so existing call sites can keep importing them
// from here; the implementation lives in bibliographyEntryShape.js (no
// dependencies) so exportSafetyGate.js and the acceptance battery can use it
// without pulling in this module's @/lib imports.
export { BIB_ENTRY_RX, countBibliographyEntries } from './bibliographyEntryShape.js';

// NFEXPORT-BIB-1: a nonfiction book without a real Sources section is not
// done. Starts as a warning; promote to a hard block only after the
// flagship ships with one (see the plan).
export const NF_BIBLIOGRAPHY_HARD_BLOCK = false;

export function isBackMatter(ch) {
  const title = String(ch?.title || '').toLowerCase();
  return (
    title.includes('bibliography') ||
    title.includes('sources') ||
    title.includes('works cited') ||
    title.includes('references') ||
    title.includes('appendix') ||
    title.includes('acknowledgment') ||
    title.includes('about the author')
  );
}

export function isBodyChapter(ch) {
  return !isFrontMatter(ch) && !isBackMatter(ch);
}

function clean(value, limit = 10000) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n')
    .trim()
    .slice(0, limit);
}

function compact(value, limit = 1000) {
  return clean(value, limit).replace(/\s+/g, ' ').trim().slice(0, limit);
}

function unique(items = []) {
  return Array.from(new Set(items.map((item) => compact(item, 1000)).filter(Boolean)));
}

function getProjectText(project = {}, manuscriptText = '', researchText = '') {
  return [
    project?.title,
    project?.subtitle,
    project?.genre,
    project?.subgenre,
    project?.book_type,
    project?.project_type,
    project?.description,
    project?.seed_concept,
    project?.research_md,
    project?.sources_md,
    project?.bibliography_md,
    project?.citations_md,
    researchText,
    manuscriptText,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 90000);
}

function detectProjectDomain(project = {}, manuscriptText = '', researchText = '') {
  const text = getProjectText(project, manuscriptText, researchText);
  const bookType = String(project?.book_type || '').toLowerCase();
  const isFiction = bookType === 'fiction' || bookType === 'anthology';

  if (MISSOURI_PRISON_RE.test(text)) return 'missouri_penitentiary_history';
  if (FINANCE_DOMAIN_RE.test(text)) return 'finance';
  // Caregiving domain should only activate for nonfiction projects.
  // Fiction novels mentioning 'caregiver' characters must NOT trigger
  // Medicaid/DMH bibliography injection (Unity contamination vector).
  if (!isFiction && CAREGIVING_RE.test(text)) return 'caregiving';
  if (MEDICAL_HISTORY_RE.test(text)) return 'medical_history';
  if (CIVIC_POLICY_RE.test(text)) return 'civic_policy';
  if (RELIGION_HISTORY_RE.test(text)) return 'religion_history';
  if (TRUE_CRIME_HISTORY_RE.test(text)) return 'investigative_history';

  const declared = [project?.genre, project?.subgenre, project?.book_type, project?.project_type]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/nonfiction|history|investigative|true\s+crime|memoir|biography/.test(declared)) {
    return 'investigative_history';
  }

  return 'general_nonfiction';
}

export function detectTopics(text = '') {
  const source = String(text || '');
  const topics = new Set();

  if (MISSOURI_PRISON_RE.test(source)) topics.add('missouri_penitentiary_history');
  if (TRUE_CRIME_HISTORY_RE.test(source)) topics.add('investigative_history');
  if (/\b(?:riot|1954|Cell\s+Hall\s+3|locked\s+door|workshop\s+fire)\b/i.test(source)) topics.add('riot_records');
  if (/\b(?:archive|archives|records?|ledger|register|scrapbook|blueprint|fire\s+marshal|coroner|death\s+certificate)\b/i.test(source)) topics.add('primary_records');
  if (/\b(?:newspaper|Post-Dispatch|News Tribune|Time\s+magazine|contemporaneous\s+journalism)\b/i.test(source)) topics.add('journalism');
  if (/\b(?:lynching|Pierce\s+City|racial\s+terror)\b/i.test(source)) topics.add('racial_violence_history');
  if (/\b(?:execution|gas\s+chamber|death\s+row|lethal\s+gas)\b/i.test(source)) topics.add('capital_punishment');
  if (CAREGIVING_RE.test(source)) topics.add('caregiving');
  if (CIVIC_POLICY_RE.test(source)) topics.add('civic_policy');
  if (MEDICAL_HISTORY_RE.test(source)) topics.add('medical_history');
  if (RELIGION_HISTORY_RE.test(source)) topics.add('religion_history');
  if (FINANCE_DOMAIN_RE.test(source)) topics.add('finance');

  return topics;
}

function sourceLinesForDomain(domain, manuscriptText = '') {
  const genericHistory = [
    'Missouri State Archives. Missouri State Penitentiary Records. Jefferson City: Missouri Secretary of State.',
    'Missouri Digital Heritage. “Missouri State Penitentiary.” Missouri Secretary of State. https://www.sos.mo.gov/mdh/',
    'Missouri Department of Corrections. “Missouri State Penitentiary.” Missouri Department of Corrections.',
    'State Historical Society of Missouri. Missouri Newspaper Collection. Columbia: State Historical Society of Missouri.',
    'Library of Congress. Chronicling America: Historic American Newspapers. Washington, DC: Library of Congress. https://chroniclingamerica.loc.gov/',
    'National Archives and Records Administration. Guide to Federal Records Relating to Prisons, Courts, and Law Enforcement. Washington, DC: NARA. https://www.archives.gov/',
    'U.S. Census Bureau. Historical Census Records. Washington, DC: U.S. Department of Commerce. https://www.census.gov/',
    'Missouri State Archives. Missouri Death Certificates, 1910–1973. Jefferson City: Missouri Secretary of State. https://s1.sos.mo.gov/records/archives/archivesdb/deathcertificates/',
  ];

  const missouriPrison = [
    'Schreiber, Mark S. Somewhere in Time: 170 Years of Missouri Corrections. Jefferson City, MO: Missouri Department of Corrections, 2004.',
    'Johnson, J. B. Buried Alive; or, Eighteen Years in the Missouri Penitentiary. Jefferson City, MO, 1903.',
    'Time. “The Bloodiest 47 Acres.” Time, 1967.',
    'St. Louis Post-Dispatch. Coverage of the Missouri State Penitentiary riot, September 1954. St. Louis, MO.',
    'Jefferson City News Tribune. Coverage of the Missouri State Penitentiary riot and redevelopment, 1954–2025. Jefferson City, MO.',
    'City of Jefferson, Missouri. Missouri State Penitentiary Redevelopment Master Plan. Jefferson City, MO: City of Jefferson, 2009.',
    'Jefferson City Convention and Visitors Bureau. “Missouri State Penitentiary Tours.” Jefferson City, MO. https://www.visitjeffersoncity.com/',
    'Missouri State Archives. Missouri State Penitentiary Riot Scrapbooks and Photographs, 1954. Jefferson City: Missouri Secretary of State.',
    'Missouri State Archives. Missouri State Penitentiary Inmate Registers and Classification Records. Jefferson City: Missouri Secretary of State.',
    'Missouri State Archives. Missouri Department of Corrections Administrative Records. Jefferson City: Missouri Secretary of State.',
    'Missouri State Archives. Governor Phil M. Donnelly Records. Jefferson City: Missouri Secretary of State.',
    'Missouri State Fire Marshal. Reports and investigations relating to institutional fires in Missouri. Jefferson City, MO.',
  ];

  const racialViolence = [
    'Equal Justice Initiative. Lynching in America: Confronting the Legacy of Racial Terror. Montgomery, AL: Equal Justice Initiative, 2017.',
    'Tolnay, Stewart E., and E. M. Beck. A Festival of Violence: An Analysis of Southern Lynchings, 1882–1930. Urbana: University of Illinois Press, 1995.',
    'Missouri State Archives. Missouri court, coroner, and vital records relating to Lawrence County and Pierce City, 1915. Jefferson City: Missouri Secretary of State.',
  ];

  const capitalPunishment = [
    'Missouri Department of Corrections. Missouri execution records and capital punishment history. Jefferson City, MO.',
    'Death Penalty Information Center. “Executions in the United States.” Washington, DC. https://deathpenaltyinfo.org/',
  ];

  const caregiving = [
    'Missouri Department of Mental Health. Division of Developmental Disabilities Provider Manual. Jefferson City, MO: Missouri Department of Mental Health.',
    'Missouri Department of Social Services. Missouri Medicaid Provider Manuals. Jefferson City, MO: Missouri Department of Social Services.',
    'Centers for Medicare & Medicaid Services. Home and Community-Based Services Final Regulation. Baltimore, MD: CMS.',
    'The Council on Quality and Leadership. Personal Outcome Measures. Towson, MD: CQL.',
  ];

  const civicPolicy = [
    'Brennan Center for Justice. Emergency Powers and Democratic Accountability. New York: Brennan Center for Justice.',
    'National Conference of State Legislatures. Emergency Management and Public Health Authority Resources. Denver, CO: NCSL.',
    'Federal Emergency Management Agency. National Incident Management System. Washington, DC: FEMA.',
    'U.S. Centers for Disease Control and Prevention. Public Health Law Program Resources. Atlanta, GA: CDC.',
  ];

  const medicalHistory = [
    'Pressman, Jack D. Last Resort: Psychosurgery and the Limits of Medicine. Cambridge: Cambridge University Press, 1998.',
    'Valenstein, Elliot S. Great and Desperate Cures: The Rise and Decline of Psychosurgery and Other Radical Treatments for Mental Illness. New York: Basic Books, 1986.',
    'U.S. Senate. Project MKULTRA, the CIA’s Program of Research in Behavioral Modification. Washington, DC: U.S. Government Printing Office, 1977.',
    'National Security Archive. Operation Paperclip and Cold War Science Collections. Washington, DC: George Washington University.',
  ];

  const religionHistory = [
    'Ehrman, Bart D. The New Testament: A Historical Introduction to the Early Christian Writings. New York: Oxford University Press, 2020.',
    'Fredriksen, Paula. Jesus of Nazareth, King of the Jews: A Jewish Life and the Emergence of Christianity. New York: Vintage, 2000.',
    'The New Oxford Annotated Bible: New Revised Standard Version. New York: Oxford University Press.',
    'Josephus, Flavius. The Jewish War. Translated by G. A. Williamson. London: Penguin Classics, 1981.',
  ];

  const finance = [
    'Bogle, John C. The Little Book of Common Sense Investing. Hoboken, NJ: John Wiley & Sons, 2017.',
    'Malkiel, Burton G. A Random Walk Down Wall Street. New York: W. W. Norton, 2019.',
    'U.S. Securities and Exchange Commission. “Mutual Funds and ETFs: A Guide for Investors.” Investor.gov. https://www.investor.gov/',
    'FINRA Investor Education Foundation. National Financial Capability Study. Washington, DC: FINRA Foundation.',
    'Consumer Financial Protection Bureau. The Consumer Credit Card Market. Washington, DC: CFPB.',
  ];

  let lines = [];

  if (domain === 'finance') {
    lines = finance;
  } else if (domain === 'caregiving') {
    lines = caregiving;
  } else if (domain === 'civic_policy') {
    lines = civicPolicy;
  } else if (domain === 'medical_history') {
    lines = medicalHistory;
  } else if (domain === 'religion_history') {
    lines = religionHistory;
  } else if (domain === 'missouri_penitentiary_history') {
    lines = [...missouriPrison, ...genericHistory];
    if (/\b(?:lynching|Pierce\s+City|racial\s+terror)\b/i.test(manuscriptText)) lines.push(...racialViolence);
    if (/\b(?:execution|gas\s+chamber|death\s+row|lethal\s+gas)\b/i.test(manuscriptText)) lines.push(...capitalPunishment);
  } else {
    lines = genericHistory;
  }

  return unique(lines);
}

export function buildAuthoritativeSourceBlock(topics, domain = 'general_nonfiction', manuscriptText = '') {
  const topicList = Array.isArray(topics) ? topics : Array.from(topics || []);
  const sourceLines = sourceLinesForDomain(domain, manuscriptText);

  return [
    `Detected bibliography domain: ${domain}.`,
    topicList.length ? `Detected source topics: ${topicList.join(', ')}.` : 'Detected source topics: general nonfiction.',
    '',
    'Use only project-relevant source families. Do not import sources from unrelated books or prior projects.',
    '',
    ...sourceLines.map((line) => `- ${line}`),
  ].join('\n');
}

function buildCompositeCharacterBlock(text) {
  if (!/\b(?:composite|fictionalized|amalgam|representative\s+case|constructed\s+from\s+multiple)\b/i.test(text)) return '';

  return `
COMPOSITE / RECONSTRUCTION HANDLING:
- Do not cite composite characters as real interviews or real people.
- If the manuscript uses composite reconstructions, the bibliography must cite the real records, court files, oral histories, newspapers, reports, or archival collections that support the underlying pattern.
- The Author's Note must distinguish documented persons from composites/reconstructions.`;
}

function splitPossibleSourceEntries(text = '') {
  const normalized = clean(text, 80000)
    .replace(/\r\n/g, '\n')
    .replace(/^[-•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '');

  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const entries = [];
  let current = '';

  const headingRe = /^(?:Bibliography|Sources|Works Cited|References|Books|Articles|Academic|Government|Archives|Court|Newspapers|Reports|Web|Oral Histories|Primary Sources|Secondary Sources)\b/i;
  const newEntryRe = /^(?:[A-Z][A-Za-z'’.-]+,\s+|U\.S\.\s+|Missouri\s+|City\s+of\s+|State\s+Historical\s+|Library\s+of\s+|National\s+Archives\s+|Jefferson\s+City\s+|St\.\s+Louis\s+|Time\.|Johnson,\s+|Schreiber,\s+|Equal\s+Justice\s+|Death\s+Penalty\s+|Centers\s+for\s+|The\s+Council\s+|Brennan\s+Center\s+|Federal\s+Emergency\s+|National\s+Conference\s+|Pressman,\s+|Valenstein,\s+|Ehrman,\s+|Fredriksen,\s+|Josephus,\s+|Bogle,\s+|Malkiel,\s+|FINRA\s+|Consumer\s+Financial\s+|Vanguard\s+|Morningstar\s+)/;

  lines.forEach((line) => {
    if (headingRe.test(line)) {
      if (current) entries.push(current.trim());
      current = '';
      return;
    }

    if (newEntryRe.test(line) && current) {
      entries.push(current.trim());
      current = line;
      return;
    }

    current = current ? `${current} ${line}` : line;
  });

  if (current) entries.push(current.trim());
  return unique(entries);
}

function isBadEntry(entry = '', domain = 'general_nonfiction') {
  const text = String(entry || '');
  if (!text.trim()) return true;
  if (PLACEHOLDER_RE.test(text)) return true;
  if (domain !== 'finance' && FINANCE_CONTAMINATION_RE.test(text)) return true;
  if (/\b(?:fake|invented|placeholder|example\s+only)\b/i.test(text)) return true;
  return false;
}

function credibleEntryCount(text = '', domain = 'general_nonfiction') {
  return splitPossibleSourceEntries(text).filter((entry) => !isBadEntry(entry, domain)).length;
}

function sanitizeBibliographyText(text = '', domain = 'general_nonfiction') {
  const entries = splitPossibleSourceEntries(text).filter((entry) => !isBadEntry(entry, domain));
  return unique(entries).join('\n\n').trim();
}

function buildFallbackBibliography({ project, domain, manuscriptText, researchText }) {
  const title = compact(project?.title || '', 120);
  const sourceLines = sourceLinesForDomain(domain, `${manuscriptText}\n\n${researchText}`);

  const sections = [];
  const primary = [];
  const secondary = [];
  const journalism = [];
  const webGov = [];

  sourceLines.forEach((entry) => {
    if (/\b(?:Archives|Records|Department|City of|Digital Heritage|Death Certificates|Fire Marshal|Governor|Census|National Archives|DOC|CMS|FEMA|CDC)\b/i.test(entry)) {
      primary.push(entry);
    } else if (/\b(?:Post-Dispatch|News Tribune|Time|newspaper|Chronicling America)\b/i.test(entry)) {
      journalism.push(entry);
    } else if (/https?:\/\//i.test(entry) || /\b(?:Bureau|Commission|Foundation|Center|Institute)\b/i.test(entry)) {
      webGov.push(entry);
    } else {
      secondary.push(entry);
    }
  });

  // BIBFORMAT-1 — section headings are markdown `##` lines: the export gate's
  // BACKMATTER-1 exemption recognizes markdown headings (plain heading lines
  // hard-block as unterminated paragraphs), and ExportTab's DOCX writer
  // renders `##` as a real heading.
  sections.push('Bibliography');
  if (title) sections.push(`\n## Source list for ${title}`);

  if (primary.length) {
    sections.push('\n## Primary Sources and Archival Records');
    sections.push(primary.join('\n\n'));
  }

  if (journalism.length) {
    sections.push('\n## Newspapers, Magazines, and Contemporary Journalism');
    sections.push(journalism.join('\n\n'));
  }

  if (secondary.length) {
    sections.push('\n## Books and Secondary Sources');
    sections.push(secondary.join('\n\n'));
  }

  if (webGov.length) {
    sections.push('\n## Government, Institutional, and Web Sources');
    sections.push(webGov.join('\n\n'));
  }

  const note = [
    '\n## Source Integrity Note',
    'This bibliography was rebuilt from the manuscript domain and project-relevant research lanes. Before final publication, tighten archive-specific entries with exact collection names, box/folder numbers, document titles, dates, and URLs where available.',
    'Do not add sources from unrelated projects. Do not publish placeholder citations.',
  ].join('\n\n');

  return `${sections.join('\n\n')}\n\n${note}`.replace(/\n{4,}/g, '\n\n\n').trim();
}

function buildBibliographyPrompt({ project, domain, topics, manuscriptText, researchText, authoritativeSources }) {
  const title = compact(project?.title || '', 180);
  const subtitle = compact(project?.subtitle || '', 240);
  const compositeBlock = buildCompositeCharacterBlock(`${manuscriptText}\n\n${researchText}`);

  const strictDomainWarning = domain === 'finance'
    ? 'This is a finance/investing project. Finance sources are allowed only when directly relevant.'
    : 'This is NOT a finance/investing project. Do not include Bogle, Malkiel, Vanguard, FINRA, Robinhood, ETFs, index funds, 401(k), IRA, CFPB consumer credit, or investing-market sources.';

  return `You are a senior nonfiction research librarian rebuilding the source apparatus for a manuscript.

BOOK:
Title: ${title || 'Untitled'}
Subtitle: ${subtitle || 'none'}
Detected source domain: ${domain}
Detected topics: ${Array.from(topics || []).join(', ') || 'general nonfiction'}

PRIMARY JOB:
Create a clean, project-relevant bibliography in Chicago Notes-Bibliography style.

NON-NEGOTIABLE SOURCE INTEGRITY RULES:
1. Use only sources relevant to this specific book.
2. ${strictDomainWarning}
3. Do not include placeholder entries of any kind.
4. Do not write [SOURCE NEEDED], [CITATION NEEDED], TK, TBD, TODO, or fake URLs.
5. Do not invent private interviews, fake archive box numbers, fake court file numbers, fake article titles, fake URLs, or fake access dates.
6. If archive details are incomplete, cite the real repository/collection category cleanly and generally, without pretending to know a box/folder number.
7. Prefer fewer clean source entries over a padded bibliography.
8. Separate primary records, journalism, books/secondary sources, and institutional/web sources.
9. Include at least ${SOURCE_ENTRY_MINIMUM} project-relevant entries when the manuscript context supports them.

${compositeBlock}

PROJECT-RELEVANT SOURCE LEADS:
${authoritativeSources}

MANUSCRIPT TEXT TO SCAN FOR NAMED SOURCES AND SOURCE CATEGORIES:
${clean(manuscriptText, 65000)}

${researchText ? `PROJECT RESEARCH NOTES / SOURCE LEDGER:\n${clean(researchText, 18000)}` : 'PROJECT RESEARCH NOTES / SOURCE LEDGER: none supplied.'}

OUTPUT FORMAT:
Plain text only. No markdown. No bullets. No numbered list. Start with:
Bibliography

Then use section headings only where needed:
Primary Sources and Archival Records
Newspapers, Magazines, and Contemporary Journalism
Books and Secondary Sources
Government, Institutional, and Web Sources

Generate the bibliography now.`;
}

async function loadManuscriptText(chapters = [], onProgress) {
  const allChapters = [...(Array.isArray(chapters) ? chapters : [])]
    .filter((ch) => chapterHasContent(ch) && isBodyChapter(ch))
    .sort((a, b) => Number(a?.chapter_number || 0) - Number(b?.chapter_number || 0));

  if (!allChapters.length) {
    throw new Error('No body chapters found to scan for bibliography sources.');
  }

  let fullText = '';

  for (let i = 0; i < allChapters.length; i += 1) {
    const chapter = allChapters[i];
    onProgress?.(`Bibliography: Loading chapter ${chapter?.chapter_number || i + 1} of ${allChapters.length}…`);
    const content = await resolveChapterContent(chapter);
    fullText += `\n\n---\n\nChapter ${chapter?.chapter_number || i + 1}: ${chapter?.title || 'Untitled'}\n\n${content || ''}`;
  }

  return fullText.trim();
}

async function loadProjectResearchText(project = {}) {
  const parts = [];

  try {
    const resolved = await resolveResearchContent(project);
    if (resolved) parts.push(resolved);
  } catch (error) {
    console.warn('[BIBLIOGRAPHY] Could not resolve project research content:', error?.message || error);
  }

  parts.push(
    project?.research_data,
    project?.sources_md,
    project?.bibliography_md,
    project?.citations_md,
    project?.source_ledger_md,
    project?.world_md
  );

  return parts
    .map((part) => (typeof part === 'string' ? part : part ? JSON.stringify(part, null, 2) : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

export async function generateBibliography({ project, chapters, onProgress }) {
  if (!project) throw new Error('Project is required to generate bibliography.');

  // BIBFIX-1: the bibliography is built deterministically from the project's
  // own verified research (closed world). No LLM composes citations, and no
  // canned domain source lists are injected. The chapters parameter is kept
  // for call-site compatibility.
  onProgress?.('Bibliography: building closed-world source list from project research…');

  const result = buildClosedWorldBibliography(project);

  if (result.entryCount < 4) {
    throw new Error(
      `Bibliography build found only ${result.entryCount} verifiable source entries in project research. Run deep research or Research Outline Gaps to deepen the source base, then regenerate.`
    );
  }

  const urlCheck = verifyBibliographyUrls(result.text, project);
  if (!urlCheck.ok) {
    throw new Error('Bibliography integrity check failed — URL(s) not present in project research: ' + urlCheck.violations.join(', '));
  }

  if (PLACEHOLDER_RE.test(result.text)) {
    throw new Error('Bibliography contains placeholder text. Clean the research data and regenerate.');
  }

  return result.text;
}

export async function saveBibliographyChapter({ project, chapters, bibText }) {
  const allChapters = [...(Array.isArray(chapters) ? chapters : [])].sort(
    (a, b) => Number(a?.chapter_number || 0) - Number(b?.chapter_number || 0)
  );

  const existingBib = allChapters.find((chapter) => {
    const title = String(chapter?.title || '').toLowerCase();
    return title.includes('bibliography') || title.includes('sources') || title.includes('works cited') || title.includes('references');
  });

  // VERSIONS-1D: pass the existing chapter (mirroring copyrightGenerator.js's
  // saveCopyrightChapter call shape) so prepareChapterContent can record
  // previous_content_md_url — omitting it left every bibliography resave
  // with no way back to the version it replaced.
  const contentFields = await prepareChapterContent(bibText, project.id, existingBib?.id || 'bibliography', existingBib || null);

  if (existingBib) {
    await runWithNetworkRetry(() => base44.entities.Chapter.update(existingBib.id, {
      ...contentFields,
      title: 'Bibliography & Sources',
      status: 'drafted',
    }));
    console.log('[BIBLIOGRAPHY] Updated existing bibliography chapter');
    return;
  }

  const nextChapterNum = Math.max(...allChapters.map((chapter) => Number(chapter?.chapter_number || 0)), 0) + 1;

  await runWithNetworkRetry(() => base44.entities.Chapter.create({
    ...contentFields,
    project_id: project.id,
    chapter_number: nextChapterNum,
    title: 'Bibliography & Sources',
    status: 'drafted',
  }));

  console.log('[BIBLIOGRAPHY] Created new bibliography chapter #' + nextChapterNum);
}

export function generateAuthorsNote({ projectType, topics, hasComposites }) {
  const topicText = Array.from(topics || []).join(' ').toLowerCase();
  const isFinance = /finance|investing|retirement|credit|brokerage|index/.test(topicText);

  if (isFinance) {
    return `Author's Note\n\nThis book is educational nonfiction, not individualized financial, legal, or tax advice. It draws on publicly available financial history, government reports, academic studies, investor education materials, and documented examples. Readers should consult qualified professionals before making decisions specific to their circumstances.${hasComposites ? '\n\nComposite examples are used only to illustrate documented financial patterns and are not presented as real interviews.' : ''}`;
  }

  return `Author's Note on Sources and Method\n\nThis work is narrative nonfiction built from documented source categories including archival records, public records, court and administrative materials, contemporaneous journalism, published histories, oral-history materials, and institutional records where available. The bibliography identifies the source families used for the manuscript.\n\nWhere the surviving record is incomplete, the manuscript distinguishes documented fact from inference, reconstruction, oral history, and unresolved questions.${hasComposites ? '\n\nComposite or reconstructed passages are used only to illustrate documented patterns and should not be read as verbatim accounts from a single historical person unless the person is named and sourced.' : ''}\n\nEvery effort has been made to present the evidence honestly. Remaining errors of fact are the responsibility of the author.`;
}
