/**
 * referenceIntegrityGate.js — Deterministic reference/citation integrity checker.
 *
 * Purpose:
 * - Detect reference sections (Bibliography, References, Works Cited, Sources, Endnotes, etc.)
 * - Extract inline citations (APA, MLA, Chicago/endnote markers, named-source references)
 * - Extract and parse reference entries (author, title, year, publisher, URL, DOI, ISBN)
 * - Cross-check inline citations against reference entries
 * - Validate reference formatting consistency
 * - Detect suspicious, fabricated, or incomplete references
 * - Flag unsupported factual claims (statistics without sources, legal/policy without dates)
 *
 * Design:
 * - No LLM calls — all detection is regex/heuristic-based for full determinism.
 * - Reuses heading patterns from bibliographyGenerator.js and nonfictionPolish.js.
 * - Does NOT delete unused references — flags as WARNING.
 * - Does NOT fabricate missing data — marks as INCOMPLETE or NEEDS_SOURCE.
 * - Severity: BLOCKING (fabricated/missing major), WARNING (incomplete/unused/mixed), INFO (Further Reading).
 *
 * IMPORTANT:
 * This module never invents, guesses, or fills in source data.
 * It is a gate, not a generator.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const REFERENCE_SECTION_HEADINGS = [
  'bibliography',
  'references',
  'works cited',
  'sources',
  'endnotes',
  'notes',
  'further reading',
  'selected sources',
  'notes and sources',
  'source list',
  'author\'s note',
  'author\'s note on sources',
  'author\'s note on sources and method',
];

const REFERENCE_HEADING_RX = new RegExp(
  '^(?:#{1,6}\\s+)?(?:' +
    REFERENCE_SECTION_HEADINGS.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
  ')\\s*$',
  'im'
);

const REFERENCE_HEADING_LINE_RX = new RegExp(
  '^(?:#{1,6}\\s+)?(' +
    REFERENCE_SECTION_HEADINGS.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
  ')\\s*$',
  'i'
);

// APA-style: (Author, 2020), (Author & Author, 2019), (Author et al., 2021)
const APA_CITATION_RX = /\(([A-Z][A-Za-z\u00C0-\u024F'-]+(?:\s+(?:&|and)\s+[A-Z][A-Za-z\u00C0-\u024F'-]+)?(?:\s+et\s+al\.)?),\s*((?:19|20)\d{2}[a-z]?)\)/g;

// MLA-style: (Author 23), (Author 123-125)
const MLA_CITATION_RX = /\(([A-Z][A-Za-z\u00C0-\u024F'-]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z\u00C0-\u024F'-]+)?)\s+(\d{1,4}(?:\s*[-–]\s*\d{1,4})?)\)/g;

// Bracketed endnote markers: [1], [2], [12]
const ENDNOTE_MARKER_RX = /\[(\d{1,3})\]/g;

// Named-source language: "According to the National Archives…", "A 2022 report from the CDC stated…"
const NAMED_SOURCE_PATTERNS = [
  /\b[Aa]ccording to (?:the )?([A-Z][A-Za-z,.'&-]+(?:\s+(?!said\b|stated\b|reported\b|noted\b|found\b|concluded\b|estimated\b|determined\b|showed\b|indicated\b|revealed\b|published\b)[A-Za-z,.'&-]+)*)(?:[,.]|\s+(?:said|stated|reported|noted|found|concluded|estimated|determined|showed|indicated|revealed|published))/g,
  /\b[Aa] (?:(?:19|20)\d{2}) (?:report|study|survey|analysis|investigation|review|assessment|audit|memo|letter|ruling|decision|publication|paper) (?:from|by|of|issued by|published by|prepared by) (?:the )?([A-Z][A-Za-z,.'&-]+(?:\s+(?!stated\b|found\b|showed\b|indicated\b|concluded\b|estimated\b|reported\b|noted\b|revealed\b|determined\b|said\b)[A-Za-z,.'&-]+)*)(?:\s+(?:stated|found|showed|indicated|concluded|estimated|reported|noted|revealed|determined|said))/g,
  /\b(?:The|A|An) ([A-Z][A-Za-z,.'&-]+(?:\s+(?!reported\b|study\b|survey\b|investigation\b|analysis\b|review\b|assessment\b|audit\b)[A-Za-z,.'&-]+)*) (?:report(?:ed)?|study|survey|investigation|analysis|review|assessment|audit) (?:of|on|into|regarding|concerning) /g,
];

// URL and DOI patterns
const URL_RX = /https?:\/\/[^\s)<>]{8,}/gi;
const DOI_RX = /\b(?:doi:\s*|https?:\/\/doi\.org\/)(10\.\d{4,}\/[^\s)<>]+)/gi;
const DOI_STANDALONE_RX = /\b10\.\d{4,}\/[^\s)<>]+/g;
const ISBN_RX = /\bISBN[:\s-]*(?:97[89][-\s]?)?\d[-\s\d]{9,15}[\dXx]\b/gi;

// Placeholder / fabrication detection
const PLACEHOLDER_RX = /\[(?:SOURCE|CITATION|URL|DATE|ACCESS|TK|TODO|TBD|NEEDS?)\s*(?:NEEDED|REQUIRED)?[^\]]*\]|\b(?:SOURCE\s+NEEDED|CITATION\s+NEEDED|TK\s+SOURCE|TODO\s+CITATION|TBD\s+SOURCE)\b/gi;

const FAKE_SOURCE_INDICATORS = [
  /\bJournal of (?:Things|Stuff|Topics|Studies|Research|Science|Everything)\b/i,
  /\bPublisher (?:Name|Here|TBD|TK|Unknown)\b/i,
  /\bDoe,\s*(?:John|Jane)\b/i,
  /\bSmith,\s*(?:John|Jane)\.\s*(?:Important|Sample|Example|Test)\b/i,
  /\bAuthor,\s*(?:First|Last|Name)\b/i,
  /\bCity:\s*Publisher,\s*(?:Year|Date|20XX)\b/i,
  /\b(?:example|sample|placeholder|test|fake|invented|lorem)\s+(?:source|citation|reference|entry)\b/i,
  /\bhttp:\/\/example\.com\b/i,
  /\bhttp:\/\/www\.example\b/i,
  /\bpp?\.\s*(?:XX|NN|000|###)\b/i,
  /\b(?:Vol\.|Volume)\s*(?:X|N|0)\b/i,
];

// Unsupported claim patterns
const UNSUPPORTED_STAT_RX = /\b(?:\d{1,3}(?:,\d{3})*|\d+\.?\d*)\s*(?:percent|%|million|billion|trillion)\b/gi;
const LEGAL_POLICY_CLAIM_RX = /\b(?:federal\s+law|state\s+law|regulation|statute|executive\s+order|court\s+rul(?:ed|ing)|Supreme\s+Court|amendment|Section\s+\d|Title\s+\d|Public\s+Law|(?:19|20)\d{2}\s+Act)\b/gi;
const CURRENT_VERIFICATION_RX = /\b(?:currently|as of (?:20\d{2}|today|this writing)|at present|the current|today's|recent (?:data|statistics|reports?|studies|findings))\b/gi;


// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE SECTION DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect reference/bibliography sections in text by heading.
 * Returns array of { heading, startIndex, endIndex, content, type }.
 */
export function detectReferenceSections(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const headingMatch = trimmed.replace(/^#{1,6}\s+/, '').trim();

    const matchedHeading = REFERENCE_SECTION_HEADINGS.find(
      h => headingMatch.toLowerCase() === h || headingMatch.toLowerCase().startsWith(h + ':')
    );

    if (matchedHeading) {
      if (currentSection) {
        currentSection.endLine = i - 1;
        currentSection.content = lines.slice(currentSection.startLine + 1, i).join('\n').trim();
        sections.push(currentSection);
      }

      const type = categorizeReferenceSection(matchedHeading);
      currentSection = {
        heading: trimmed,
        normalizedHeading: matchedHeading,
        type,
        startLine: i,
        endLine: lines.length - 1,
        content: '',
      };
    }
  }

  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    currentSection.content = lines.slice(currentSection.startLine + 1).join('\n').trim();
    sections.push(currentSection);
  }

  return sections;
}

function categorizeReferenceSection(heading) {
  const h = heading.toLowerCase();
  if (h.includes('further reading')) return 'further_reading';
  if (h.includes('endnote') || h === 'notes') return 'endnotes';
  if (h.includes('author')) return 'authors_note';
  if (h.includes('works cited')) return 'works_cited';
  if (h.includes('bibliography')) return 'bibliography';
  if (h.includes('source')) return 'sources';
  if (h.includes('reference')) return 'references';
  return 'references';
}


// ═══════════════════════════════════════════════════════════════════════════════
// INLINE CITATION EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract inline citations from text.
 * Returns array of { text, type, author, year, page, index }.
 */
export function extractInlineCitations(text) {
  if (!text || typeof text !== 'string') return [];

  const citations = [];
  const seen = new Set();

  // APA-style: (Author, 2020)
  let match;
  const apaRx = new RegExp(APA_CITATION_RX.source, APA_CITATION_RX.flags);
  while ((match = apaRx.exec(text)) !== null) {
    const key = `apa:${match[1]}:${match[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        text: match[0],
        type: 'apa',
        author: match[1].trim(),
        year: match[2].trim(),
        page: null,
        index: match.index,
      });
    }
  }

  // MLA-style: (Author 23)
  const mlaRx = new RegExp(MLA_CITATION_RX.source, MLA_CITATION_RX.flags);
  while ((match = mlaRx.exec(text)) !== null) {
    const key = `mla:${match[1]}:${match[2]}`;
    // Avoid double-counting items already matched as APA
    const overlapKey = `apa:${match[1]}:${match[2]}`;
    if (!seen.has(key) && !seen.has(overlapKey)) {
      seen.add(key);
      citations.push({
        text: match[0],
        type: 'mla',
        author: match[1].trim(),
        year: null,
        page: match[2].trim(),
        index: match.index,
      });
    }
  }

  // Bracketed endnote markers: [1], [2]
  const endnoteRx = new RegExp(ENDNOTE_MARKER_RX.source, ENDNOTE_MARKER_RX.flags);
  while ((match = endnoteRx.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    const key = `endnote:${num}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        text: match[0],
        type: 'endnote',
        author: null,
        year: null,
        page: null,
        number: num,
        index: match.index,
      });
    }
  }

  // Named-source references
  for (const pattern of NAMED_SOURCE_PATTERNS) {
    const rx = new RegExp(pattern.source, pattern.flags);
    while ((match = rx.exec(text)) !== null) {
      const sourceName = match[1]?.trim();
      if (!sourceName || sourceName.length < 2) continue;
      const key = `named:${sourceName.toLowerCase().slice(0, 40)}`;
      if (!seen.has(key)) {
        seen.add(key);
        citations.push({
          text: match[0].trim(),
          type: 'named_source',
          author: sourceName,
          year: null,
          page: null,
          index: match.index,
        });
      }
    }
  }

  return citations;
}


// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE ENTRY EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract and parse reference entries from a reference section's content.
 * Returns array of structured entries.
 */
export function extractReferenceEntries(text) {
  if (!text || typeof text !== 'string') return [];

  const rawLines = text.split('\n');
  const entries = [];
  let currentEntry = '';

  const isNewEntry = (line) => {
    // Skip headings
    if (/^#{1,6}\s+/.test(line)) return false;
    if (REFERENCE_HEADING_LINE_RX.test(line)) return false;
    // Numbered entry: "1. Author..."
    if (/^\d{1,3}\.\s+[A-Z]/.test(line)) return true;
    // Bulleted entry
    if (/^[-•*]\s+[A-Z]/.test(line)) return true;
    // Author-start: "LastName, FirstName" or "Organization Name."
    if (/^[A-Z][A-Za-z\u00C0-\u024F'.-]+,\s+[A-Z]/.test(line)) return true;
    // Organization start
    if (/^(?:U\.S\.|United States|National|Federal|State|City|Library|Centers|Department|Bureau|Office|American|British|World|International|Missouri|Consumer|Equal|Death|FINRA|CDC|FEMA|WHO)\s/.test(line)) return true;
    // Hanging indent continuation is NOT a new entry
    return false;
  };

  let prevBlank = false;
  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      prevBlank = true;
      continue;
    }

    const forceNew = prevBlank && currentEntry && line.length > 0;
    prevBlank = false;

    if ((isNewEntry(line) || forceNew) && currentEntry) {
      const parsed = parseReferenceEntry(currentEntry);
      if (parsed) entries.push(parsed);
      currentEntry = line;
    } else if ((isNewEntry(line) || !currentEntry) && !currentEntry) {
      currentEntry = line;
    } else if (currentEntry) {
      currentEntry += ' ' + line;
    }
    // Skip orphan lines before first entry
  }

  if (currentEntry) {
    const parsed = parseReferenceEntry(currentEntry);
    if (parsed) entries.push(parsed);
  }

  return entries;
}

function parseReferenceEntry(raw) {
  if (!raw || raw.length < 10) return null;

  // Strip leading bullets/numbers
  const text = raw.replace(/^(?:\d{1,3}\.\s+|[-•*]\s+)/, '').trim();
  if (text.length < 10) return null;

  const entry = {
    raw: text,
    author: null,
    title: null,
    year: null,
    publisher: null,
    journal: null,
    url: null,
    doi: null,
    isbn: null,
    accessDate: null,
    type: 'unknown',
    complete: false,
    issues: [],
  };

  // Extract URL
  const urlMatch = text.match(/https?:\/\/[^\s)<>]{8,}/);
  if (urlMatch) entry.url = urlMatch[0];

  // Extract DOI
  const doiMatch = text.match(/\b(?:doi:\s*|https?:\/\/doi\.org\/)(10\.\d{4,}\/[^\s)<>]+)/i) ||
                   text.match(/\b(10\.\d{4,}\/[^\s)<>]+)/);
  if (doiMatch) entry.doi = doiMatch[1] || doiMatch[0];

  // Extract ISBN
  const isbnMatch = text.match(ISBN_RX);
  if (isbnMatch) entry.isbn = isbnMatch[0];

  // Extract year
  const yearMatch = text.match(/\b((?:19|20)\d{2})\b/);
  if (yearMatch) entry.year = yearMatch[1];

  // Extract access date
  const accessMatch = text.match(/(?:accessed|retrieved|viewed)\s+(.{5,30}?\d{4})/i);
  if (accessMatch) entry.accessDate = accessMatch[1].trim();

  // Extract author (first segment before period or title)
  // Note: first-name character class excludes '.' to prevent matching across sentence boundaries
  // e.g. "Smith, John. The Great Study" should parse as author="Smith, John" not "Smith, John. The Great Study"
  const authorMatch = text.match(/^([A-Z][A-Za-z\u00C0-\u024F'.-]+(?:,\s+[A-Z][A-Za-z\u00C0-\u024F\s-]+)?(?:(?:,?\s+(?:and|&)\s+[A-Z][A-Za-z\u00C0-\u024F'.-]+(?:,\s+[A-Z][A-Za-z\u00C0-\u024F\s-]+)?)*)?)\./);
  if (authorMatch) {
    entry.author = authorMatch[1].trim();
  } else {
    // Organization author
    const orgMatch = text.match(/^([A-Z][A-Za-z\s,.'&-]{3,80}?)\./);
    if (orgMatch) entry.author = orgMatch[1].trim();
  }

  // Extract title (text in quotes or italics, or between first and second period)
  const quotedTitle = text.match(/[""\u201C]([^""\u201D]{5,200})[""\u201D]/);
  if (quotedTitle) {
    entry.title = quotedTitle[1].trim();
    entry.type = 'article';
  } else {
    // Look for title between periods after author: Author. Title. ...
    const afterAuthor = entry.author ? text.slice(text.indexOf(entry.author) + entry.author.length) : text;
    const titleMatch = afterAuthor.match(/\.\s+([^.]{3,200})\./);
    if (titleMatch) {
      const candidate = titleMatch[1].trim();
      // Reject if candidate is just a city+publisher (e.g. "New York: Publisher")
      if (!/^[A-Z][a-z]+(?:,\s*[A-Z]{2})?\s*:/.test(candidate)) {
        entry.title = candidate;
        entry.type = 'book';
      } else {
        // Try next period-delimited segment
        const rest = afterAuthor.slice(afterAuthor.indexOf(titleMatch[0]) + titleMatch[0].length);
        const next = rest.match(/\s*([^.]{3,200})\./);
        if (next && !/^[A-Z][a-z]+(?:,\s*[A-Z]{2})?\s*:/.test(next[1].trim())) {
          entry.title = next[1].trim();
          entry.type = 'book';
        }
      }
    }
  }

  // Extract publisher (after location colon pattern)
  const pubMatch = text.match(/([A-Z][A-Za-z\s.]+(?:,\s*[A-Z]{2})?)\s*:\s*([A-Z][A-Za-z\s&.'-]+?)(?:,|\.|$)/);
  if (pubMatch) {
    entry.publisher = pubMatch[2].trim();
  }

  // Extract journal — look for pattern: "Journal Name" followed by volume/issue number
  const journalMatch = text.match(/[""\u201D]\.?\s*([A-Z][A-Za-z\s&:'-]+?)\s*(?:,\s*\d|\.?\s*(?:Vol|Volume|\d{1,3}\s*[,(]))/i) ||
                       text.match(/\.\s*([A-Z][A-Za-z\s&:'-]+?)\s+\d{1,3}(?:\s*,\s*(?:no|No|issue|Issue)\.?\s*\d|\s*\((?:19|20)\d{2}\))/i);
  if (journalMatch) {
    entry.journal = journalMatch[1].trim();
    entry.type = 'article';
  }

  // Classify type — journal/article takes priority over news keywords
  if (entry.journal) entry.type = 'article';
  else if (entry.url && /\.gov\b/.test(entry.url)) entry.type = 'government';
  else if (/\b(?:Department|Bureau|Agency|Commission|Administration|Office)\b/.test(text)) entry.type = 'government';
  else if (/\b(?:newspaper|Post-Dispatch|Tribune|Times|Herald|Magazine|Time\.)\b/i.test(text)) entry.type = 'news';
  else if (/\b(?:Archives?|Records?|Collection)\b/.test(text)) entry.type = 'archival';
  else if (entry.publisher && !entry.journal) entry.type = 'book';

  // Completeness check
  const hasAuthor = !!entry.author;
  const hasTitle = !!entry.title;
  const hasYear = !!entry.year;
  const hasPublisher = !!(entry.publisher || entry.journal || entry.url);

  if (hasAuthor && hasTitle && hasYear && hasPublisher) {
    entry.complete = true;
  } else {
    if (!hasAuthor) entry.issues.push('MISSING_AUTHOR');
    if (!hasTitle) entry.issues.push('MISSING_TITLE');
    if (!hasYear) entry.issues.push('MISSING_YEAR');
    if (!hasPublisher) entry.issues.push('MISSING_PUBLISHER_OR_SOURCE');
  }

  return entry;
}


// ═══════════════════════════════════════════════════════════════════════════════
// CITATION ↔ REFERENCE CROSS-CHECK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cross-check inline citations against reference entries.
 * Returns { matches, missingReferences, unusedReferences, duplicateReferences, issues }.
 */
export function crosscheckCitationsToReferences(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return { matches: [], missingReferences: [], unusedReferences: [], duplicateReferences: [], issues: [] };
  }

  const sections = detectReferenceSections(text);
  const refSectionContent = sections
    .filter(s => s.type !== 'further_reading' && s.type !== 'authors_note')
    .map(s => s.content)
    .join('\n\n');

  const furtherReadingContent = sections
    .filter(s => s.type === 'further_reading')
    .map(s => s.content)
    .join('\n\n');

  // Extract body text (everything before reference sections)
  const firstSectionStart = sections.length > 0
    ? text.split('\n').findIndex((line, i) => i === sections[0].startLine)
    : -1;
  const bodyText = firstSectionStart > 0
    ? text.split('\n').slice(0, firstSectionStart).join('\n')
    : text;

  const citations = extractInlineCitations(bodyText);
  const refEntries = extractReferenceEntries(refSectionContent);
  const furtherReadingEntries = extractReferenceEntries(furtherReadingContent);

  const matches = [];
  const missingReferences = [];
  const unusedRefs = new Set(refEntries.map((_, i) => i));
  const issues = [];

  // Match each citation to a reference
  for (const citation of citations) {
    if (citation.type === 'endnote') {
      // Match by number
      const num = citation.number;
      if (num <= refEntries.length) {
        matches.push({ citation, reference: refEntries[num - 1], matchType: 'endnote_number' });
        unusedRefs.delete(num - 1);
      } else {
        missingReferences.push({ citation, severity: 'WARNING', reason: 'MISSING_ENDNOTE_ENTRY' });
      }
      continue;
    }

    if (citation.type === 'named_source') {
      // Named sources are harder to match — check if any reference mentions the source name
      const sourceLower = citation.author.toLowerCase();
      const foundIdx = refEntries.findIndex(ref =>
        ref.raw.toLowerCase().includes(sourceLower.slice(0, 20))
      );
      if (foundIdx >= 0) {
        matches.push({ citation, reference: refEntries[foundIdx], matchType: 'named_source_partial' });
        unusedRefs.delete(foundIdx);
      }
      // Named sources don't require a formal bibliography entry — they may reference institutions directly
      continue;
    }

    // APA/MLA matching by author surname
    const authorSurname = citation.author?.split(/[,&]/)?.[ 0]?.trim()?.split(/\s+/)?.pop() || '';
    if (!authorSurname) continue;

    const surnameLower = authorSurname.toLowerCase();
    const yearStr = citation.year || '';

    let foundIdx = -1;
    for (let i = 0; i < refEntries.length; i++) {
      const ref = refEntries[i];
      const refLower = ref.raw.toLowerCase();
      const authorMatch = refLower.includes(surnameLower);
      const yearMatch = !yearStr || refLower.includes(yearStr);
      if (authorMatch && yearMatch) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx >= 0) {
      matches.push({ citation, reference: refEntries[foundIdx], matchType: 'author_year' });
      unusedRefs.delete(foundIdx);
    } else {
      missingReferences.push({
        citation,
        severity: 'BLOCKING',
        reason: 'MISSING_REFERENCE',
      });
    }
  }

  // Check for unused references (not in Further Reading either)
  const unusedReferences = Array.from(unusedRefs).map(idx => ({
    reference: refEntries[idx],
    severity: 'WARNING',
    reason: 'UNUSED_REFERENCE',
  }));

  // Check for duplicates
  const duplicateReferences = findDuplicateReferences(refEntries);

  // Check for incomplete entries
  for (const ref of refEntries) {
    if (!ref.complete) {
      issues.push({
        reference: ref,
        severity: 'WARNING',
        reason: 'INCOMPLETE_REFERENCE',
        details: ref.issues.join(', '),
      });
    }
  }

  return { matches, missingReferences, unusedReferences, duplicateReferences, issues };
}

function findDuplicateReferences(entries) {
  const seen = new Map();
  const duplicates = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    // Normalize key: author + year (or first 40 chars of raw if no author)
    const key = entry.author
      ? `${entry.author.toLowerCase().slice(0, 30)}|${entry.year || ''}`
      : entry.raw.toLowerCase().slice(0, 40);

    if (seen.has(key)) {
      duplicates.push({
        entry,
        duplicateOf: seen.get(key),
        severity: 'WARNING',
        reason: 'DUPLICATE_REFERENCE',
      });
    } else {
      seen.set(key, entry);
    }
  }

  return duplicates;
}


// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE FORMATTING VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate reference formatting.
 * Returns { style, issues, urlsPreserved, doisPreserved, headingPresent, entrySeparation, ordering }.
 */
export function validateReferenceFormatting(text, expectedStyle = null) {
  if (!text || typeof text !== 'string') {
    return { style: 'none', issues: [], urlsPreserved: true, doisPreserved: true, headingPresent: false, entrySeparation: 'unknown', ordering: 'unknown' };
  }

  const sections = detectReferenceSections(text);
  const issues = [];

  // Check heading
  const headingPresent = sections.length > 0;
  if (!headingPresent) {
    issues.push({ type: 'MISSING_HEADING', severity: 'WARNING', detail: 'No reference section heading detected.' });
  }

  // Detect style
  const refContent = sections.map(s => s.content).join('\n\n');
  const detectedStyle = detectCitationStyle(text, refContent);

  if (expectedStyle && detectedStyle !== expectedStyle && detectedStyle !== 'mixed' && detectedStyle !== 'unknown') {
    issues.push({
      type: 'STYLE_MISMATCH',
      severity: 'WARNING',
      detail: `Expected ${expectedStyle} but detected ${detectedStyle}.`,
    });
  }

  if (detectedStyle === 'mixed') {
    issues.push({
      type: 'MIXED_STYLE',
      severity: 'WARNING',
      detail: 'Multiple citation styles detected. Consider standardizing.',
    });
  }

  // Check URL preservation
  const urls = text.match(URL_RX) || [];
  const urlsPreserved = urls.length > 0 || !text.includes('http');

  // Check DOI preservation
  const dois = text.match(DOI_RX) || text.match(DOI_STANDALONE_RX) || [];
  const doisPreserved = dois.length > 0 || !(/\bdoi\b/i.test(text));

  // Check entry separation
  let entrySeparation = 'unknown';
  if (refContent) {
    const doubleSpaced = (refContent.match(/\n\n/g) || []).length;
    const entries = extractReferenceEntries(refContent);
    if (entries.length > 1 && doubleSpaced >= entries.length - 1) {
      entrySeparation = 'double_spaced';
    } else if (entries.length > 1) {
      entrySeparation = 'single_spaced';
    }
  }

  // Check ordering (alphabetical by author for non-endnote styles)
  let ordering = 'unknown';
  if (detectedStyle !== 'endnote' && refContent) {
    const entries = extractReferenceEntries(refContent);
    if (entries.length > 1) {
      const authors = entries.map(e => {
        // Use surname (first word of author) for sorting comparison
        const author = (e.author || e.raw.slice(0, 30)).toLowerCase().trim();
        return author.split(/[,\s]/)[0] || author;
      });
      const sorted = [...authors].sort((a, b) => a.localeCompare(b));
      ordering = JSON.stringify(authors) === JSON.stringify(sorted) ? 'alphabetical' : 'non_alphabetical';
    }
  } else if (detectedStyle === 'endnote') {
    ordering = 'numbered';
  }

  return {
    style: detectedStyle,
    issues,
    urlsPreserved,
    doisPreserved,
    headingPresent,
    entrySeparation,
    ordering,
  };
}

function detectCitationStyle(bodyText, refContent) {
  const apaCount = (bodyText.match(APA_CITATION_RX) || []).length;
  APA_CITATION_RX.lastIndex = 0;
  const mlaCount = (bodyText.match(MLA_CITATION_RX) || []).length;
  MLA_CITATION_RX.lastIndex = 0;
  const endnoteCount = (bodyText.match(ENDNOTE_MARKER_RX) || []).length;
  ENDNOTE_MARKER_RX.lastIndex = 0;

  const styles = [];
  if (apaCount > 0) styles.push('apa');
  if (mlaCount > 0) styles.push('mla');
  if (endnoteCount > 0) styles.push('endnote');

  if (styles.length === 0) {
    // Check if generic "Sources" or "Further Reading" without formal citations
    // Check both ref content AND headings detected in full text
    const fullText = bodyText + '\n' + refContent;
    if (/\b(?:sources|further reading|selected sources|bibliography|references|works cited)\b/i.test(fullText) && refContent.length > 5) return 'generic';
    return 'unknown';
  }
  if (styles.length === 1) return styles[0];
  return 'mixed';
}


// ═══════════════════════════════════════════════════════════════════════════════
// SUSPICIOUS / FABRICATED REFERENCE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect suspicious or fabricated references.
 * Returns array of { entry, severity, reason, detail }.
 */
export function detectSuspiciousReferences(entries) {
  if (!Array.isArray(entries)) return [];

  const suspicious = [];

  for (const entry of entries) {
    const raw = entry.raw || '';

    // Placeholder patterns
    if (PLACEHOLDER_RX.test(raw)) {
      PLACEHOLDER_RX.lastIndex = 0;
      suspicious.push({
        entry,
        severity: 'BLOCKING',
        reason: 'PLACEHOLDER_REFERENCE',
        detail: 'Reference contains placeholder markers (TK, TODO, SOURCE NEEDED, etc.).',
      });
      continue;
    }
    PLACEHOLDER_RX.lastIndex = 0;

    // Fake source indicators
    for (const pattern of FAKE_SOURCE_INDICATORS) {
      if (pattern.test(raw)) {
        suspicious.push({
          entry,
          severity: 'BLOCKING',
          reason: 'LIKELY_FABRICATED',
          detail: `Reference matches fabrication indicator: ${pattern.source.slice(0, 40)}.`,
        });
        break;
      }
    }

    // Very short entries that look incomplete
    if (raw.length < 25 && !raw.includes('http')) {
      suspicious.push({
        entry,
        severity: 'WARNING',
        reason: 'TOO_SHORT',
        detail: 'Reference entry is suspiciously short.',
      });
    }
  }

  return suspicious;
}


// ═══════════════════════════════════════════════════════════════════════════════
// UNSUPPORTED CLAIM DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Flag unsupported factual claims.
 * Returns array of { text, type, severity, detail, index }.
 */
export function flagUnsupportedClaims(text) {
  if (!text || typeof text !== 'string') return [];

  const claims = [];
  const citations = extractInlineCitations(text);
  const citationRanges = citations.map(c => ({ start: c.index, end: c.index + c.text.length }));

  function isNearCitation(idx, range = 200) {
    return citationRanges.some(c => {
      const dist = Math.min(Math.abs(c.start - idx), Math.abs(c.end - idx));
      if (dist >= range) return false;
      // Also check that there's no line break between them — different lines mean different claims
      const lo = Math.min(idx, c.start);
      const hi = Math.max(idx, c.end);
      const between = text.slice(lo, hi);
      if (between.includes('\n')) return false;
      return true;
    });
  }

  // Statistics without nearby citations
  const statRx = new RegExp(UNSUPPORTED_STAT_RX.source, UNSUPPORTED_STAT_RX.flags);
  let match;
  while ((match = statRx.exec(text)) !== null) {
    if (!isNearCitation(match.index, 150)) {
      // Check if there's a source phrase nearby
      const context = text.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100);
      if (!/\b(?:according to|reported|cited|source|study|survey|data from|estimates?|found|published)\b/i.test(context)) {
        claims.push({
          text: match[0],
          context: text.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30).trim(),
          type: 'UNSUPPORTED_STATISTIC',
          severity: 'WARNING',
          detail: 'Statistic without citation or source attribution.',
          index: match.index,
        });
      }
    }
  }

  // Legal/policy claims without dates or citations
  const legalRx = new RegExp(LEGAL_POLICY_CLAIM_RX.source, LEGAL_POLICY_CLAIM_RX.flags);
  while ((match = legalRx.exec(text)) !== null) {
    // Use tighter proximity for legal claims — only same-sentence citations count
    if (!isNearCitation(match.index, 80)) {
      const context = text.slice(Math.max(0, match.index - 50), match.index + match[0].length + 100);
      if (!/\b(?:19|20)\d{2}\b/.test(context) && !/\b(?:according to|cited in|under|pursuant to)\b/i.test(context)) {
        claims.push({
          text: match[0],
          context: text.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30).trim(),
          type: 'UNSUPPORTED_LEGAL_CLAIM',
          severity: 'WARNING',
          detail: 'Legal/policy claim without date or citation.',
          index: match.index,
        });
      }
    }
  }

  // Current/temporal claims needing verification
  const currentRx = new RegExp(CURRENT_VERIFICATION_RX.source, CURRENT_VERIFICATION_RX.flags);
  while ((match = currentRx.exec(text)) !== null) {
    claims.push({
      text: match[0],
      context: text.slice(Math.max(0, match.index - 30), match.index + match[0].length + 50).trim(),
      type: 'CURRENT_VERIFICATION_NEEDED',
      severity: 'INFO',
      detail: 'Temporal/current claim that may need re-verification before publication.',
      index: match.index,
    });
  }

  return claims;
}


// ═══════════════════════════════════════════════════════════════════════════════
// FULL REFERENCE INTEGRITY GATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run the full reference integrity gate on a text.
 * Returns a structured report.
 */
export function runReferenceIntegrityGate(text, project = {}) {
  if (!text || typeof text !== 'string') {
    return {
      ok: true,
      sections: [],
      citations: [],
      entries: [],
      crosscheck: { matches: [], missingReferences: [], unusedReferences: [], duplicateReferences: [], issues: [] },
      formatting: { style: 'none', issues: [], urlsPreserved: true, doisPreserved: true, headingPresent: false },
      suspicious: [],
      unsupportedClaims: [],
      blockingIssues: [],
      warnings: [],
      info: [],
      summary: 'No text provided.',
    };
  }

  const sections = detectReferenceSections(text);
  const citations = extractInlineCitations(text);

  const refContent = sections
    .filter(s => s.type !== 'further_reading' && s.type !== 'authors_note')
    .map(s => s.content)
    .join('\n\n');

  const entries = extractReferenceEntries(refContent);
  const crosscheck = crosscheckCitationsToReferences(text);
  const formatting = validateReferenceFormatting(text);
  const suspicious = detectSuspiciousReferences(entries);
  const unsupportedClaims = flagUnsupportedClaims(text);

  // Aggregate by severity
  const blockingIssues = [];
  const warnings = [];
  const info = [];

  for (const item of crosscheck.missingReferences) {
    if (item.severity === 'BLOCKING') blockingIssues.push({ source: 'crosscheck', ...item });
    else warnings.push({ source: 'crosscheck', ...item });
  }
  for (const item of crosscheck.unusedReferences) {
    warnings.push({ source: 'crosscheck', ...item });
  }
  for (const item of crosscheck.duplicateReferences) {
    warnings.push({ source: 'crosscheck', ...item });
  }
  for (const item of crosscheck.issues) {
    if (item.severity === 'BLOCKING') blockingIssues.push({ source: 'completeness', ...item });
    else warnings.push({ source: 'completeness', ...item });
  }
  for (const item of formatting.issues) {
    if (item.severity === 'BLOCKING') blockingIssues.push({ source: 'formatting', ...item });
    else warnings.push({ source: 'formatting', ...item });
  }
  for (const item of suspicious) {
    if (item.severity === 'BLOCKING') blockingIssues.push({ source: 'suspicious', ...item });
    else warnings.push({ source: 'suspicious', ...item });
  }
  for (const item of unsupportedClaims) {
    if (item.severity === 'BLOCKING') blockingIssues.push({ source: 'claims', ...item });
    else if (item.severity === 'WARNING') warnings.push({ source: 'claims', ...item });
    else info.push({ source: 'claims', ...item });
  }

  const ok = blockingIssues.length === 0;

  const summary = [
    `Reference sections: ${sections.length}`,
    `Inline citations: ${citations.length}`,
    `Reference entries: ${entries.length}`,
    `Matches: ${crosscheck.matches.length}`,
    `Missing references: ${crosscheck.missingReferences.length}`,
    `Unused references: ${crosscheck.unusedReferences.length}`,
    `Duplicate references: ${crosscheck.duplicateReferences.length}`,
    `Suspicious entries: ${suspicious.length}`,
    `Unsupported claims: ${unsupportedClaims.length}`,
    `Blocking issues: ${blockingIssues.length}`,
    `Warnings: ${warnings.length}`,
    `Info: ${info.length}`,
    `Gate: ${ok ? 'PASS' : 'FAIL'}`,
  ].join(', ');

  return {
    ok,
    sections,
    citations,
    entries,
    crosscheck,
    formatting,
    suspicious,
    unsupportedClaims,
    blockingIssues,
    warnings,
    info,
    summary,
  };
}
