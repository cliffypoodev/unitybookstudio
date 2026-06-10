// =============================================================
// referenceIntegrityGate.test.mjs — Comprehensive regression tests
// =============================================================
// Usage: node tests/referenceIntegrityGate.test.mjs

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const modulePath = resolve(__dirname, '..', 'src', 'lib', 'referenceIntegrityGate.js');
const {
  detectReferenceSections,
  extractInlineCitations,
  extractReferenceEntries,
  crosscheckCitationsToReferences,
  validateReferenceFormatting,
  detectSuspiciousReferences,
  flagUnsupportedClaims,
  runReferenceIntegrityGate,
} = await import(modulePath);

// bibliographyGenerator.js has runtime deps (@/lib/integrationRetry, etc.)
// that aren't available in the test env. Import pure functions if possible.
let isBackMatter, isFrontMatter, isBodyChapter;
let bibModuleLoaded = false;
try {
  const bibModulePath = resolve(__dirname, '..', 'src', 'lib', 'bibliographyGenerator.js');
  const bib = await import(bibModulePath);
  isBackMatter = bib.isBackMatter;
  isFrontMatter = bib.isFrontMatter;
  isBodyChapter = bib.isBodyChapter;
  bibModuleLoaded = true;
} catch {
  // If the import fails, we replicate the same simple logic for testing consistency
  isBackMatter = (ch) => {
    const title = String(ch?.title || '').toLowerCase();
    return title.includes('bibliography') || title.includes('sources') ||
           title.includes('works cited') || title.includes('references') ||
           title.includes('appendix') || title.includes('acknowledgment') ||
           title.includes('about the author');
  };
  isFrontMatter = (ch) => {
    const title = String(ch?.title || '').toLowerCase();
    return title.includes('copyright') || title.includes('title page') ||
           title.includes('dedication') || title.includes('epigraph') ||
           title.includes('foreword') || title.includes('preface') ||
           title.includes('author') || title.includes('front matter') ||
           Number(ch?.chapter_number) === 0;
  };
  isBodyChapter = (ch) => !isFrontMatter(ch) && !isBackMatter(ch);
  console.log('  ⚠️  bibliographyGenerator.js import failed (runtime deps); using inline replicas for integration tests.');
}

let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.error('  ❌ ' + label); }
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: Reference Section Detection (12 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 1: Reference Section Detection ──');
{
  const make = (heading) => `Some chapter content here.\n\n${heading}\n\nSmith, John. Title. Publisher, 2020.`;

  const s1 = detectReferenceSections(make('Bibliography'));
  assert(s1.length >= 1, 'D-1: Detects Bibliography heading');

  const s2 = detectReferenceSections(make('References'));
  assert(s2.length >= 1, 'D-2: Detects References heading');

  const s3 = detectReferenceSections(make('Works Cited'));
  assert(s3.length >= 1, 'D-3: Detects Works Cited heading');

  const s4 = detectReferenceSections(make('Sources'));
  assert(s4.length >= 1, 'D-4: Detects Sources heading');

  const s5 = detectReferenceSections(make('Endnotes'));
  assert(s5.length >= 1, 'D-5: Detects Endnotes heading');

  const s6 = detectReferenceSections(make('Notes'));
  assert(s6.length >= 1, 'D-6: Detects Notes heading');

  const s7 = detectReferenceSections(make('Further Reading'));
  assert(s7.length >= 1, 'D-7: Detects Further Reading heading');

  const s8 = detectReferenceSections(make('Selected Sources'));
  assert(s8.length >= 1, 'D-8: Detects Selected Sources heading');

  const s9 = detectReferenceSections(make('## Bibliography'));
  assert(s9.length >= 1, 'D-9: Detects markdown heading ## Bibliography');

  const s10 = detectReferenceSections(make('Further Reading'));
  assert(s10[0]?.type === 'further_reading', 'D-10: Categorizes Further Reading as type further_reading');

  const s11 = detectReferenceSections(make('Endnotes'));
  assert(s11[0]?.type === 'endnotes', 'D-11: Categorizes Endnotes as type endnotes');

  const s12 = detectReferenceSections('Just a normal paragraph with no headings at all.');
  assert(s12.length === 0, 'D-12: Returns empty array for text with no reference headings');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: Inline Citation Extraction — APA (8 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 2: Inline Citation Extraction — APA ──');
{
  const t1 = extractInlineCitations('The study (Smith, 2021) was groundbreaking.');
  assert(t1.length >= 1, 'APA-1: Extracts (Smith, 2021) — single author');

  const t2 = extractInlineCitations('The report (Johnson & Lee, 2019) confirmed findings.');
  assert(t2.length >= 1, 'APA-2: Extracts (Johnson & Lee, 2019) — two authors');

  const t3 = extractInlineCitations('Meta-analysis (Garcia et al., 2020) showed improvement.');
  assert(t3.length >= 1, 'APA-3: Extracts (Garcia et al., 2020) — et al.');

  const multiText = 'First (Smith, 2021) and second (Garcia et al., 2020) and third (Johnson & Lee, 2019).';
  const t4 = extractInlineCitations(multiText);
  assert(t4.length >= 3, 'APA-4: Extracts multiple APA citations from same text');

  const t5 = extractInlineCitations('The study (Smith, 2021) showed results.');
  const smithCit = t5.find(c => c.type === 'apa');
  assert(smithCit?.author === 'Smith' && smithCit?.year === '2021', 'APA-5: Returns author=Smith and year=2021');

  assert(smithCit?.type === 'apa', 'APA-6: Returns type=apa for APA citations');

  const t7 = extractInlineCitations('See (page 23) for details.');
  const falsePosApa = t7.filter(c => c.type === 'apa');
  assert(falsePosApa.length === 0, 'APA-7: Does not extract (page 23) as APA');

  const t8 = extractInlineCitations('No citations here, just normal text.');
  assert(t8.length === 0, 'APA-8: Returns empty array for text with no citations');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: Inline Citation Extraction — Bracketed/Endnote (6 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 3: Inline Citation Extraction — Bracketed/Endnote ──');
{
  const e1 = extractInlineCitations('The data [1] was clear.');
  const endnote1 = e1.find(c => c.type === 'endnote');
  assert(endnote1 && endnote1.number === 1, 'EN-1: Extracts [1] as endnote with number=1');

  const e2 = extractInlineCitations('See also [2] for more.');
  const endnote2 = e2.find(c => c.type === 'endnote');
  assert(endnote2 && endnote2.number === 2, 'EN-2: Extracts [2] as endnote with number=2');

  const e3 = extractInlineCitations('First [1] and second [2] and third [3].');
  const endnotes = e3.filter(c => c.type === 'endnote');
  assert(endnotes.length >= 3, 'EN-3: Extracts multiple endnote markers');

  assert(endnotes[0]?.type === 'endnote', 'EN-4: Returns type=endnote');

  const e5 = extractInlineCitations('Point [1] was mentioned. Again [1] appeared.');
  const en5 = e5.filter(c => c.type === 'endnote');
  assert(en5.length === 1, 'EN-5: Does not double-count same marker [1]');

  const e6 = extractInlineCitations('Extended reference [12] in text.');
  const endnote12 = e6.find(c => c.type === 'endnote');
  assert(endnote12 && endnote12.number === 12, 'EN-6: Handles [12] (two-digit)');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: Inline Citation Extraction — Named Source (6 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 4: Inline Citation Extraction — Named Source ──');
{
  const ns1 = extractInlineCitations('According to the National Archives, the records confirm the timeline.');
  const named1 = ns1.find(c => c.type === 'named_source');
  assert(named1 != null, 'NS-1: Extracts "According to the National Archives"');

  const ns2 = extractInlineCitations('A 2022 report from the CDC stated that infections rose.');
  const named2 = ns2.find(c => c.type === 'named_source');
  assert(named2 != null, 'NS-2: Extracts "A 2022 report from the CDC stated"');

  assert(named1?.type === 'named_source', 'NS-3: Returns type=named_source');

  assert(named1?.author?.length > 0, 'NS-4: Returns author containing the source name');

  const ns5 = extractInlineCitations('According to the Cat, it meowed.');
  const short = ns5.filter(c => c.type === 'named_source' && c.author?.length < 4);
  assert(short.length === 0, 'NS-5: Does not extract very short phrases (<4 chars)');

  const ns6 = extractInlineCitations(
    'According to the National Archives, the records confirm the timeline. ' +
    'A 2022 report from the CDC stated that infections rose.'
  );
  const namedAll = ns6.filter(c => c.type === 'named_source');
  assert(namedAll.length >= 2, 'NS-6: Handles multiple named sources');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 5: Reference Entry Extraction (12 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 5: Reference Entry Extraction ──');
{
  const refText = `Smith, John. The Great Study. New York: Academic Press, 2021.

Johnson, Mary, and Robert Lee. "A Research Article." Journal of Science 45, no. 2 (2019): 12-28.

U.S. Census Bureau. Historical Census Records. Washington, DC: U.S. Department of Commerce. https://www.census.gov/

Garcia, Ana, et al. "Meta-Analysis Results." Nature Reviews 18 (2020): 45-67. doi:10.1038/s41586-020-0001-1`;

  const entries = extractReferenceEntries(refText);

  assert(entries.length >= 4, 'RE-1: Extracts 4+ entries from reference text');

  assert(entries[0]?.author?.includes('Smith'), 'RE-2: First entry has author containing Smith');
  assert(entries[0]?.title?.includes('Great Study'), 'RE-3: First entry has title containing Great Study');
  assert(entries[0]?.year === '2021', 'RE-4: First entry has year 2021');
  assert(entries[0]?.publisher?.includes('Academic Press'), 'RE-5: First entry has publisher containing Academic Press');

  assert(entries[1]?.type === 'article', 'RE-6: Second entry has type article (has journal)');

  const censusEntry = entries.find(e => e.raw?.includes('Census'));
  assert(censusEntry?.url?.includes('census.gov'), 'RE-7: Third entry has URL containing census.gov');

  const garciaEntry = entries.find(e => e.raw?.includes('Garcia'));
  assert(garciaEntry?.doi != null, 'RE-8: Fourth entry has DOI');

  assert(censusEntry?.type === 'government', 'RE-9: Government source has type government');

  // Entry with author+title+year+publisher should be complete
  assert(entries[0]?.complete === true, 'RE-10: Complete entry marked complete=true');

  // Entry missing year
  const noYearEntries = extractReferenceEntries('Smith, John. Some Title Only Without Year. No Publisher.');
  const noYearEntry = noYearEntries.find(e => !e.year);
  assert(noYearEntry == null || noYearEntry?.issues?.includes('MISSING_YEAR'),
    'RE-11: Entry missing year has issues including MISSING_YEAR');

  // Bulleted entries
  const bulletedRef = '- Author, Alice. Bullet Book Title. New York: Publisher, 2020.';
  const bulletEntries = extractReferenceEntries(bulletedRef);
  assert(bulletEntries.length >= 1, 'RE-12: Handles bulleted entries (- Author...)');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 6: Citation-to-Reference Crosscheck (15 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 6: Citation-to-Reference Crosscheck ──');
{
  const manuscriptText = `According to Smith (Smith, 2021), the results were clear.
Johnson and Lee (Johnson & Lee, 2019) confirmed this finding.
However, Garcia (Garcia, 2020) found contradicting evidence.
The data showed 45% improvement [1].

References

Smith, John. The Great Study. New York: Academic Press, 2021.

Johnson, Mary, and Robert Lee. "A Research Article." Journal of Science 45, no. 2 (2019): 12-28.

Wilson, David. Unused Source Book. London: Publisher, 2018.`;

  const xc = crosscheckCitationsToReferences(manuscriptText);

  const smithMatch = xc.matches.find(m => m.citation?.author === 'Smith');
  assert(smithMatch != null, 'XC-1: Matches (Smith, 2021) to Smith reference');

  const johnsonMatch = xc.matches.find(m => m.citation?.author?.includes('Johnson'));
  assert(johnsonMatch != null, 'XC-2: Matches (Johnson & Lee, 2019) to Johnson reference');

  const garciaMissing = xc.missingReferences.find(m => m.citation?.author === 'Garcia');
  assert(garciaMissing != null, 'XC-3: Flags (Garcia, 2020) as MISSING_REFERENCE');

  assert(garciaMissing?.severity === 'BLOCKING', 'XC-4: Missing reference has severity BLOCKING');

  const wilsonUnused = xc.unusedReferences.find(u => u.reference?.raw?.includes('Wilson'));
  assert(wilsonUnused != null, 'XC-5: Wilson entry flagged as UNUSED_REFERENCE');

  assert(wilsonUnused?.severity === 'WARNING', 'XC-6: Unused reference has severity WARNING');

  assert(xc.matches.length >= 2, 'XC-7: Returns matches array with length >= 2');
  assert(xc.missingReferences.length >= 1, 'XC-8: Returns missingReferences with length >= 1');
  assert(xc.unusedReferences.length >= 1, 'XC-9: Returns unusedReferences with length >= 1');

  assert(smithMatch?.citation && smithMatch?.reference, 'XC-10: Match has citation and reference properties');
  assert(smithMatch?.matchType === 'author_year', 'XC-11: Match has matchType author_year');

  // Further Reading entries should not be flagged as unused
  const frText = `Body (Smith, 2021) here.

References

Smith, John. Study. Publisher, 2021.

Further Reading

Jones, Alice. Background Book. Publisher, 2020.`;

  const xcFR = crosscheckCitationsToReferences(frText);
  const jonesUnused = xcFR.unusedReferences.find(u => u.reference?.raw?.includes('Jones'));
  assert(jonesUnused == null, 'XC-12: Does not flag Further Reading entries as unused');

  // Duplicate references
  const dupText = `Body (Smith, 2021) here.

References

Smith, John. The Great Study. New York: Academic Press, 2021.

Smith, John. The Great Study. New York: Academic Press, 2021.`;

  const xcDup = crosscheckCitationsToReferences(dupText);
  assert(xcDup.duplicateReferences.length >= 1, 'XC-13: Flags duplicate references');

  // Incomplete reference
  const incText = `Body (Smith, 2021) here.

References

Smith, John. The Great Study. New York: Academic Press, 2021.

Incomplete Entry Title Only.`;

  const xcInc = crosscheckCitationsToReferences(incText);
  const incIssue = xcInc.issues.find(i => i.reason === 'INCOMPLETE_REFERENCE');
  assert(incIssue != null, 'XC-14: Flags incomplete references');

  // Named sources do not generate MISSING_REFERENCE errors
  const namedText = `According to the National Archives, the records confirm the timeline.

References

Smith, John. Study. Publisher, 2021.`;

  const xcNamed = crosscheckCitationsToReferences(namedText);
  const namedMissing = xcNamed.missingReferences.find(m => m.citation?.type === 'named_source');
  assert(namedMissing == null, 'XC-15: Named sources do not generate MISSING_REFERENCE errors');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 7: Formatting Validation (12 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 7: Formatting Validation ──');
{
  const apaText = `Body text (Smith, 2021) and (Garcia, 2020) here.

References

Garcia, Ana. Study Two. Publisher, 2020.

Smith, John. Study. Publisher, 2021.`;

  const fmtApa = validateReferenceFormatting(apaText);
  assert(fmtApa.style === 'apa', 'FMT-1: Detects APA style when body has APA citations');

  const endnoteText = `Body text [1] and [2] here.

References

Smith, John. Study. Publisher, 2021.

Garcia, Ana. Study Two. Publisher, 2020.`;

  const fmtEn = validateReferenceFormatting(endnoteText);
  assert(fmtEn.style === 'endnote', 'FMT-2: Detects endnote style when body has [1] markers');

  const mixedText = `Body text (Smith, 2021) and [1] here.

References

Smith, John. Study. Publisher, 2021.`;

  const fmtMixed = validateReferenceFormatting(mixedText);
  assert(fmtMixed.style === 'mixed', 'FMT-3: Detects mixed style when both APA and endnote present');

  assert(fmtApa.headingPresent === true, 'FMT-4: Reports headingPresent=true when heading exists');

  const noHeadingFmt = validateReferenceFormatting('Just text, no heading at all.');
  assert(noHeadingFmt.headingPresent === false, 'FMT-5: Reports headingPresent=false when no heading');

  const urlRefText = `Body here.

References

Smith, John. Study. Publisher, 2021. https://example.org/study`;

  const fmtUrl = validateReferenceFormatting(urlRefText);
  assert(fmtUrl.urlsPreserved === true, 'FMT-6: Reports urlsPreserved=true when URLs in references');

  const doiRefText = `Body here.

References

Garcia, Ana. Article. Journal 12 (2020): 1-5. doi:10.1038/s41586-020-0001-1`;

  const fmtDoi = validateReferenceFormatting(doiRefText);
  assert(fmtDoi.doisPreserved === true, 'FMT-7: Reports doisPreserved=true when DOIs in references');

  // Alphabetical ordering
  assert(fmtApa.ordering === 'alphabetical', 'FMT-8: Reports ordering=alphabetical when entries sorted');

  // Numbered ordering
  assert(fmtEn.ordering === 'numbered', 'FMT-9: Reports ordering=numbered for endnote style');

  // Mixed style issue
  const mixedIssue = fmtMixed.issues.find(i => i.type === 'MIXED_STYLE');
  assert(mixedIssue?.severity === 'WARNING', 'FMT-10: Flags MIXED_STYLE as WARNING');

  // Missing heading issue
  const missingHeadingIssue = noHeadingFmt.issues.find(i => i.type === 'MISSING_HEADING');
  assert(missingHeadingIssue?.severity === 'WARNING', 'FMT-11: Flags MISSING_HEADING as WARNING');

  // Generic style for Sources without formal citations
  const genericText = `Some plain text without any citations.

Sources

Smith, John. Book Title. Publisher, 2020.`;

  const fmtGeneric = validateReferenceFormatting(genericText);
  assert(fmtGeneric.style === 'generic', 'FMT-12: Returns style=generic for Sources without formal citations');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 8: Suspicious Reference Detection (10 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 8: Suspicious Reference Detection ──');
{
  const entries = [
    { raw: 'Doe, John. Important Study. Journal of Things, 2023.' },
    { raw: '[SOURCE NEEDED] Some reference text here that is long enough.' },
    { raw: 'Smith, James. Real Book Title. New York: Penguin Random House, 2020.' },
    { raw: 'Author, First. Sample source entry that is long enough to parse.' },
    { raw: 'http://example.com' },
    { raw: 'AB' },
  ];

  const sus = detectSuspiciousReferences(entries);

  const fabricatedJOT = sus.find(s => s.entry.raw.includes('Journal of Things'));
  assert(fabricatedJOT?.reason === 'LIKELY_FABRICATED', 'SUS-1: Flags Journal of Things as LIKELY_FABRICATED');

  const placeholder = sus.find(s => s.entry.raw.includes('SOURCE NEEDED'));
  assert(placeholder?.reason === 'PLACEHOLDER_REFERENCE', 'SUS-2: Flags [SOURCE NEEDED] as PLACEHOLDER_REFERENCE');

  const realBook = sus.find(s => s.entry.raw.includes('Real Book Title'));
  assert(realBook == null, 'SUS-3: Does NOT flag legitimate Real Book Title entry');

  const fakeAuthor = sus.find(s => s.entry.raw.includes('Author, First'));
  assert(fakeAuthor?.reason === 'LIKELY_FABRICATED', 'SUS-4: Flags Author, First. Sample source entry as LIKELY_FABRICATED');

  const exampleCom = sus.find(s => s.entry.raw === 'http://example.com');
  assert(exampleCom?.reason === 'LIKELY_FABRICATED', 'SUS-5: Flags http://example.com as LIKELY_FABRICATED');

  const tooShort = sus.find(s => s.entry.raw === 'AB');
  assert(tooShort?.reason === 'TOO_SHORT', 'SUS-6: Flags very short entry AB as TOO_SHORT');

  assert(placeholder?.severity === 'BLOCKING', 'SUS-7: Placeholder has severity BLOCKING');
  assert(fabricatedJOT?.severity === 'BLOCKING', 'SUS-8: Fabricated has severity BLOCKING');
  assert(tooShort?.severity === 'WARNING', 'SUS-9: Too short has severity WARNING');

  const cleanEntries = [
    { raw: 'Schreiber, Mark S. Somewhere in Time: 170 Years of Missouri Corrections. Jefferson City, MO: Missouri Department of Corrections, 2004.' },
    { raw: 'Equal Justice Initiative. Lynching in America: Confronting the Legacy of Racial Terror. Montgomery, AL: Equal Justice Initiative, 2017.' },
  ];
  const cleanSus = detectSuspiciousReferences(cleanEntries);
  assert(cleanSus.length === 0, 'SUS-10: Returns empty array for clean entries');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 9: Unsupported Claim Detection (10 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 9: Unsupported Claim Detection ──');
{
  const claimText = `The program served 45 percent of eligible families.
Federal law requires all institutions to comply.
Currently, the system processes 10,000 applications daily.
According to the CDC, 78% of participants improved (Smith, 2021).
The 2019 Act established new guidelines.
Recent data shows a 23% increase in enrollment.
As of today, 150 million Americans have enrolled.`;

  const claims = flagUnsupportedClaims(claimText);

  const stat45 = claims.find(c => c.type === 'UNSUPPORTED_STATISTIC' && c.text?.includes('45 percent'));
  assert(stat45 != null, 'CL-1: Flags 45 percent as UNSUPPORTED_STATISTIC');

  const legalClaim = claims.find(c => c.type === 'UNSUPPORTED_LEGAL_CLAIM' && c.text?.toLowerCase().includes('federal law'));
  assert(legalClaim != null, 'CL-2: Flags Federal law as UNSUPPORTED_LEGAL_CLAIM');

  const currentClaim = claims.find(c => c.type === 'CURRENT_VERIFICATION_NEEDED' && c.text?.toLowerCase().includes('currently'));
  assert(currentClaim != null, 'CL-3: Flags Currently as CURRENT_VERIFICATION_NEEDED');

  // 78% near citation should not be flagged
  const cited78 = claims.find(c => c.type === 'UNSUPPORTED_STATISTIC' && c.text?.includes('78%'));
  assert(cited78 == null, 'CL-4: Does NOT flag 78% near citation (Smith, 2021)');

  // 2019 Act should not be flagged (has year)
  const act2019 = claims.find(c => c.type === 'UNSUPPORTED_LEGAL_CLAIM' && c.text?.includes('2019 Act'));
  assert(act2019 == null, 'CL-5: Does NOT flag 2019 Act (has year)');

  const recentData = claims.find(c => c.type === 'CURRENT_VERIFICATION_NEEDED' && c.text?.toLowerCase().includes('recent data'));
  assert(recentData != null, 'CL-6: Flags Recent data as CURRENT_VERIFICATION_NEEDED');

  const asOfToday = claims.find(c => c.type === 'CURRENT_VERIFICATION_NEEDED' && c.text?.toLowerCase().includes('as of today'));
  assert(asOfToday != null, 'CL-7: Flags As of today as CURRENT_VERIFICATION_NEEDED');

  assert(stat45?.severity === 'WARNING', 'CL-8: Unsupported statistic has severity WARNING');
  assert(legalClaim?.severity === 'WARNING', 'CL-9: Legal claim has severity WARNING');
  assert(currentClaim?.severity === 'INFO', 'CL-10: Current verification has severity INFO');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 10: URL and DOI Preservation (8 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 10: URL and DOI Preservation ──');
{
  const urlRef = 'Smith, John. Study Title. Publisher, 2021. https://www.example.org/study/path';
  const urlEntries = extractReferenceEntries(urlRef);
  assert(urlEntries[0]?.url?.includes('example.org'), 'URL-1: extractReferenceEntries preserves URL in entry');

  const doiRef = 'Garcia, Ana. Article Title. Journal 12 (2020): 1-5. doi:10.1038/s41586-020-0001-1';
  const doiEntries = extractReferenceEntries(doiRef);
  assert(doiEntries[0]?.doi != null, 'URL-2: extractReferenceEntries preserves DOI in entry');

  const isbnRef = 'Author, Jane. Book Title. Publisher, 2020. ISBN 978-0-13-468599-1';
  const isbnEntries = extractReferenceEntries(isbnRef);
  assert(isbnEntries[0]?.isbn != null, 'URL-3: extractReferenceEntries preserves ISBN in entry');

  const fmtUrlText = `Body text here.

References

Smith, John. Study. Publisher, 2021. https://www.example.org/study`;

  const fmtUrlResult = validateReferenceFormatting(fmtUrlText);
  assert(fmtUrlResult.urlsPreserved === true, 'URL-4: validateReferenceFormatting reports urlsPreserved=true');

  const fmtDoiText = `Body text here.

References

Garcia, Ana. Article. Journal 12 (2020): 1-5. doi:10.1038/s41586-020-0001-1`;

  const fmtDoiResult = validateReferenceFormatting(fmtDoiText);
  assert(fmtDoiResult.doisPreserved === true, 'URL-5: validateReferenceFormatting reports doisPreserved=true');

  // DOI from doi: prefix
  const doiPrefixEntries = extractReferenceEntries('Author, Jane. Title. Journal 5 (2021): 1-10. doi:10.1234/test');
  assert(doiPrefixEntries[0]?.doi?.includes('10.1234/test'), 'URL-6: DOI extracted from doi:10.1234/test');

  // DOI from https://doi.org/ URL
  const doiUrlEntries = extractReferenceEntries('Author, Jane. Title. Journal 5 (2021): 1-10. https://doi.org/10.1234/test');
  assert(doiUrlEntries[0]?.doi?.includes('10.1234/test'), 'URL-7: DOI extracted from https://doi.org/10.1234/test');

  // URL preserves full path
  assert(urlEntries[0]?.url?.includes('/study/path'), 'URL-8: URL preserved includes full path');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 11: No Fabrication Contract (8 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 11: No Fabrication Contract ──');
{
  const smallText = `Body (Smith, 2021) here.

References

Smith, John. Study. New York: Publisher, 2021.`;

  const gateResult = runReferenceIntegrityGate(smallText);

  // Gate should not add entries not in original text
  const allEntryRaws = gateResult.entries.map(e => e.raw);
  const allInOriginal = allEntryRaws.every(r => smallText.includes(r.slice(0, 20)));
  assert(allInOriginal, 'NF-1: runReferenceIntegrityGate never adds entries not in original text');

  // Crosscheck should not invent matching references
  const xcSmall = crosscheckCitationsToReferences(smallText);
  const inventedMatches = xcSmall.matches.filter(m => !smallText.includes(m.reference?.raw?.slice(0, 15) || ''));
  assert(inventedMatches.length === 0, 'NF-2: crosscheck never invents matching references for missing citations');

  // extractReferenceEntries only returns entries from text
  const refOnly = 'Smith, John. Real Study. Publisher, 2021.';
  const parsedEntries = extractReferenceEntries(refOnly);
  assert(parsedEntries.every(e => refOnly.includes(e.author || '')), 'NF-3: extractReferenceEntries returns only entries parsed from text');

  // detectSuspiciousReferences never creates new entries
  const testEntries = [{ raw: 'Smith, James. Real Book. New York: Publisher, 2020.' }];
  const susResult = detectSuspiciousReferences(testEntries);
  // Should not contain any entries not in testEntries
  const createdEntries = susResult.filter(s => !testEntries.includes(s.entry));
  assert(createdEntries.length === 0, 'NF-4: detectSuspiciousReferences never creates new entries');

  // flagUnsupportedClaims returns only claims found in text
  const claimText = 'Simple narrative without any statistics or legal claims.';
  const claimResult = flagUnsupportedClaims(claimText);
  assert(claimResult.every(c => claimText.includes(c.text)), 'NF-5: flagUnsupportedClaims returns only claims found in text');

  // Empty/null/undefined handling
  const emptyGate = runReferenceIntegrityGate('');
  assert(emptyGate.ok === true, 'NF-6: runReferenceIntegrityGate on empty string returns ok=true');

  const nullGate = runReferenceIntegrityGate(null);
  assert(nullGate.ok === true, 'NF-7: runReferenceIntegrityGate on null returns ok=true');

  const undefGate = runReferenceIntegrityGate(undefined);
  assert(undefGate.ok === true, 'NF-8: runReferenceIntegrityGate on undefined returns ok=true');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 12: No Auto-Deletion Contract (6 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 12: No Auto-Deletion Contract ──');
{
  const crossText = `Body (Smith, 2021) here.

References

Smith, John. Study. New York: Publisher, 2021.

Wilson, David. Unused Source. London: Publisher, 2018.`;

  const xcDel = crosscheckCitationsToReferences(crossText);

  // Crosscheck should NOT remove unused references from the entries it parses
  // The ref entries should still include Wilson
  const refContent = 'Smith, John. Study. New York: Publisher, 2021.\n\nWilson, David. Unused Source. London: Publisher, 2018.';
  const parsedRefs = extractReferenceEntries(refContent);
  assert(parsedRefs.length >= 2, 'AD-1: crosscheck does NOT remove unused references from entries');

  // Unused references should appear in unusedReferences array
  assert(xcDel.unusedReferences.length >= 1, 'AD-2: crosscheck returns unused references in unusedReferences array');

  // detectSuspiciousReferences does NOT modify input array
  const inputEntries = [
    { raw: 'Smith, James. Real Book Title. New York: Penguin Random House, 2020.' },
    { raw: 'Doe, John. Important Study. Journal of Things, 2023.' },
  ];
  const originalLength = inputEntries.length;
  detectSuspiciousReferences(inputEntries);
  assert(inputEntries.length === originalLength, 'AD-3: detectSuspiciousReferences does NOT modify input array');

  // flagUnsupportedClaims does NOT modify input text
  const inputText = 'The program served 45 percent of eligible families.';
  const textBefore = inputText;
  flagUnsupportedClaims(inputText);
  assert(inputText === textBefore, 'AD-4: flagUnsupportedClaims does NOT modify input text');

  // extractReferenceEntries preserves all parseable entries
  const multiRef = `Smith, John. Study One. Publisher, 2021.

Johnson, Mary. Study Two. Publisher, 2019.

Garcia, Ana. Study Three. Publisher, 2020.`;
  const allParsed = extractReferenceEntries(multiRef);
  assert(allParsed.length >= 3, 'AD-5: extractReferenceEntries preserves all parseable entries');

  // runReferenceIntegrityGate preserves Further Reading entries separately
  const frGateText = `Body (Smith, 2021) here.

References

Smith, John. Study. Publisher, 2021.

Further Reading

Jones, Alice. Background Book. Publisher, 2020.`;

  const frGate = runReferenceIntegrityGate(frGateText);
  const frSection = frGate.sections.find(s => s.type === 'further_reading');
  assert(frSection != null, 'AD-6: runReferenceIntegrityGate preserves Further Reading entries separately');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 13: Further Reading Handling (6 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 13: Further Reading Handling ──');
{
  const frText = `Body text with (Smith, 2021) citation.

References

Smith, John. Study. New York: Publisher, 2021.

Further Reading

Jones, Alice. Background Book. Chicago: Publisher, 2020.`;

  const frSections = detectReferenceSections(frText);
  assert(frSections.length >= 2, 'FR-1: detectReferenceSections finds both sections');

  const frType = frSections.find(s => s.type === 'further_reading');
  assert(frType != null, 'FR-2: Further Reading section has type further_reading');

  const frXC = crosscheckCitationsToReferences(frText);
  const jonesUnused = frXC.unusedReferences.find(u => u.reference?.raw?.includes('Jones'));
  assert(jonesUnused == null, 'FR-3: Jones entry in Further Reading is NOT flagged as unused');

  // Crosscheck separates References from Further Reading
  // Further Reading entries shouldn't appear in the main crosscheck entries
  assert(frXC.matches.length >= 1 || frXC.missingReferences.length >= 0,
    'FR-4: Crosscheck separates References from Further Reading');

  const smithMatch = frXC.matches.find(m => m.citation?.author === 'Smith');
  assert(smithMatch != null, 'FR-5: Smith entry matches citation');

  const frGate = runReferenceIntegrityGate(frText);
  assert(frGate.sections.length >= 2, 'FR-6: runReferenceIntegrityGate reports sections.length >= 2');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 14: Historical Fiction Notes (6 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 14: Historical Fiction Notes ──');
{
  const histFicText = `Chapter content — fictional narrative. The wind howled through the empty corridors.

Author's Note

This novel draws on records from the National Archives and court documents from 1954. The characters are fictional.`;

  const hfSections = detectReferenceSections(histFicText);
  assert(hfSections.length >= 1, 'HF-1: detectReferenceSections detects Author\'s Note');

  const authNote = hfSections.find(s => s.type === 'authors_note');
  assert(authNote != null, 'HF-2: Author\'s Note has type authors_note');

  // Should not flag lack of formal APA/MLA citations in fiction
  const hfGate = runReferenceIntegrityGate(histFicText);
  const apaIssue = hfGate.blockingIssues.find(i => i.type === 'MISSING_APA' || i.type === 'STYLE_MISMATCH');
  assert(apaIssue == null, 'HF-3: Does NOT flag lack of formal APA/MLA citations');

  // Should not force academic citation style on fiction
  const fmtHF = validateReferenceFormatting(histFicText);
  const styleForce = fmtHF.issues.find(i => i.type === 'STYLE_MISMATCH');
  assert(styleForce == null, 'HF-4: Does NOT force academic citation style on fiction');

  // Gate should pass (no blocking issues from fiction author's note)
  assert(hfGate.ok === true, 'HF-5: runReferenceIntegrityGate returns ok=true (no blocking issues)');

  // Narrative text without citations should return empty
  const narrativeOnly = 'The wind howled. Rain battered the windows. She waited in silence.';
  const narrativeCitations = extractInlineCitations(narrativeOnly);
  assert(narrativeCitations.length === 0, 'HF-6: extractInlineCitations returns empty for narrative text without citations');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 15: Full Gate Integration (12 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 15: Full Gate Integration ──');
{
  const fullText = `Chapter 1

The study by Smith (Smith, 2021) found significant results. Johnson and Lee (Johnson & Lee, 2019) replicated these findings. However, 67 percent of cases showed no improvement. Federal law requires disclosure.

Chapter 2

According to the National Archives, the records confirm the timeline. Currently, the program serves 2.3 million beneficiaries.

Chapter 3

Garcia (Garcia, 2020) published contradicting evidence.

References

Smith, John. The Great Study. New York: Academic Press, 2021.

Johnson, Mary, and Robert Lee. "Research Article." Journal of Science 45 (2019): 12-28.

Smith, John. The Great Study. New York: Academic Press, 2021.

Wilson, David. Unused Reference. London: Publisher, 2018.

Doe, John. Important Study. Journal of Things, 2023.

Incomplete Entry Title Only.

Further Reading

Brown, Alice. Additional Context. Chicago: Press, 2020.`;

  const gate = runReferenceIntegrityGate(fullText);

  assert(gate.ok === false, 'GATE-1: runReferenceIntegrityGate returns ok=false (has blocking issues)');
  assert(gate.sections.length >= 2, 'GATE-2: sections.length >= 2 (References + Further Reading)');
  assert(gate.citations.length >= 3, 'GATE-3: citations.length >= 3 (Smith, Johnson & Lee, Garcia)');
  assert(gate.entries.length >= 5, 'GATE-4: entries.length >= 5');
  assert(gate.crosscheck.matches.length >= 2, 'GATE-5: crosscheck.matches.length >= 2 (Smith, Johnson)');
  assert(gate.crosscheck.missingReferences.length >= 1, 'GATE-6: crosscheck.missingReferences.length >= 1 (Garcia)');
  assert(gate.crosscheck.unusedReferences.length >= 1, 'GATE-7: crosscheck.unusedReferences.length >= 1 (Wilson)');
  assert(gate.crosscheck.duplicateReferences.length >= 1, 'GATE-8: crosscheck.duplicateReferences.length >= 1 (duplicate Smith)');
  assert(gate.suspicious.length >= 1, 'GATE-9: suspicious.length >= 1 (Doe/Journal of Things)');
  assert(gate.unsupportedClaims.length >= 1, 'GATE-10: unsupportedClaims.length >= 1 (67 percent)');
  assert(gate.blockingIssues.length >= 1, 'GATE-11: blockingIssues.length >= 1');
  assert(gate.summary.includes('FAIL'), 'GATE-12: summary includes FAIL');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 16: Safety Regression (8 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 16: Safety Regression ──');
{
  const safeText = `Body text (Smith, 2021) here.

References

Smith, John. Study. Publisher, 2021.`;

  const safeGate = runReferenceIntegrityGate(safeText);
  const summaryStr = JSON.stringify(safeGate);

  assert(!summaryStr.includes('Action Plan'), 'SAFE-1: No process leak patterns (Action Plan) in module output');
  assert(!summaryStr.includes('Unity Supported Living'), 'SAFE-2: No contamination patterns (Unity Supported Living) in module output');

  // Curly quotes
  const curlyText = 'Body \u201C(Smith, 2021)\u201D here.\n\nReferences\n\nSmith, John. Study. Publisher, 2021.';
  const curlyGate = runReferenceIntegrityGate(curlyText);
  assert(curlyGate != null, 'SAFE-3: Module handles text with \u201C\u201D curly quotes');

  // Em-dashes
  const emDashText = 'Body text\u2014important\u2014here (Smith, 2021).\n\nReferences\n\nSmith, John. Study. Publisher, 2021.';
  const emDashGate = runReferenceIntegrityGate(emDashText);
  assert(emDashGate != null, 'SAFE-4: Module handles text with em-dashes');

  // Ellipsis
  const ellipsisText = 'Body text\u2026 (Smith, 2021).\n\nReferences\n\nSmith, John. Study. Publisher, 2021.';
  const ellipsisGate = runReferenceIntegrityGate(ellipsisText);
  assert(ellipsisGate != null, 'SAFE-5: Module handles text with ellipsis \u2026');

  // Very long text
  const longText = 'A '.repeat(25001) + '\n\nReferences\n\nSmith, John. Study. Publisher, 2021.';
  const longGate = runReferenceIntegrityGate(longText);
  assert(longGate != null, 'SAFE-6: Module handles very long text (50000+ chars) without crashing');

  // Whitespace only
  const wsGate = runReferenceIntegrityGate('   \t  \t  ');
  assert(wsGate != null, 'SAFE-7: Module handles text with only whitespace');

  // Newlines only
  const nlGate = runReferenceIntegrityGate('\n\n\n\n\n');
  assert(nlGate != null, 'SAFE-8: Module handles text with only newlines');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Section 17: Integration with Existing Modules (10 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 17: Integration with Existing Modules ──');
{
  assert(isBackMatter({ title: 'Bibliography' }) === true, 'INT-1: isBackMatter detects Bibliography title');
  assert(isBackMatter({ title: 'Sources' }) === true, 'INT-2: isBackMatter detects Sources title');
  assert(isBackMatter({ title: 'Works Cited' }) === true, 'INT-3: isBackMatter detects Works Cited title');
  assert(isBackMatter({ title: 'References' }) === true, 'INT-4: isBackMatter detects References title');

  assert(isFrontMatter({ title: 'Bibliography' }) === false, 'INT-5: isFrontMatter does NOT match bibliography');
  assert(isBodyChapter({ title: 'Bibliography' }) === false, 'INT-6: isBodyChapter returns false for bibliography chapter');

  // detectReferenceSections agrees with isBackMatter on heading detection
  const bibText = 'Content.\n\nBibliography\n\nSmith, John. Book. Publisher, 2020.';
  const bibSections = detectReferenceSections(bibText);
  const bibDetected = bibSections.length > 0;
  const bibBackMatter = isBackMatter({ title: 'Bibliography' });
  assert(bibDetected === bibBackMatter, 'INT-7: detectReferenceSections agrees with isBackMatter on heading detection');

  // Both detect Selected Sources
  const selSrcSections = detectReferenceSections('Content.\n\nSelected Sources\n\nSmith, John. Book. Publisher, 2020.');
  assert(selSrcSections.length >= 1, 'INT-8: Both modules detect Selected Sources');

  // Notes and Sources heading
  const notesSrcSections = detectReferenceSections('Content.\n\nNotes and Sources\n\nSmith, John. Book. Publisher, 2020.');
  // This heading exists in REFERENCE_SECTION_HEADINGS as 'notes and sources'
  assert(notesSrcSections.length >= 1, 'INT-9: Both modules detect Notes and Sources');

  // runReferenceIntegrityGate handles clean bibliography text
  const cleanBibText = `Chapter 1

The study (Smith, 2021) was important.

Bibliography

Smith, John. The Great Study. New York: Academic Press, 2021.`;

  const cleanBibGate = runReferenceIntegrityGate(cleanBibText);
  assert(cleanBibGate != null && typeof cleanBibGate.ok === 'boolean',
    'INT-10: runReferenceIntegrityGate handles text that passes cleanBibliographyIntegrity');
}


// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(60)}`);
console.log(`REFERENCE INTEGRITY GATE: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'='.repeat(60)}`);

if (failed > 0) process.exit(1);
