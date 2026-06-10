/**
 * referenceIntegrityProductionWiring.test.mjs
 *
 * Comprehensive regression tests for the reference integrity gate
 * production wiring — profile routing, gate behavior, cross-checking,
 * URL/DOI preservation, suspicious detection, unsupported claims, and safety.
 */

import {
  runReferenceIntegrityGate,
  detectReferenceSections,
  extractInlineCitations,
  extractReferenceEntries,
  detectSuspiciousReferences,
  flagUnsupportedClaims,
  crosscheckCitationsToReferences,
  validateReferenceFormatting,
} from '../src/lib/referenceIntegrityGate.js';

import {
  shouldRunReferenceIntegrity,
  getPolishProfileForProject,
  POLISH_PROFILES,
} from '../src/lib/polishPipelineConfig.js';

let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log('  \u2705 ' + label); }
  else { failed++; console.error('  \u274c ' + label); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Profile-aware reference gate routing
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 1: Profile-aware reference gate routing');

assert(
  shouldRunReferenceIntegrity('Plain text no refs.', { genre: 'nonfiction' }) === true,
  'shouldRunReferenceIntegrity returns true for nonfiction project even with no refs in text'
);

assert(
  shouldRunReferenceIntegrity('Step 1. Do this.', { genre: 'training_manual' }) === true,
  'shouldRunReferenceIntegrity returns true for training_manual project even with no refs'
);

assert(
  shouldRunReferenceIntegrity('Revenue grew.', { genre: 'business_guide' }) === true,
  'shouldRunReferenceIntegrity returns true for business_guide project'
);

assert(
  shouldRunReferenceIntegrity('She ran through the forest.', { genre: 'fiction' }) === false,
  'shouldRunReferenceIntegrity returns false for fiction project with no refs'
);

assert(
  shouldRunReferenceIntegrity(
    'She ran. (Smith, 2020)\n\n## References\n\nSmith, John. The Book. NY: Publisher, 2020.',
    { genre: 'fiction' }
  ) === true,
  'shouldRunReferenceIntegrity returns true for fiction project WITH refs'
);

assert(
  shouldRunReferenceIntegrity(
    'I remembered.\n\n## Sources\n\nFamily records.',
    { genre: 'memoir' }
  ) === true,
  'shouldRunReferenceIntegrity returns true for memoir with refs'
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Profile configuration verification
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 2: Profile configuration verification');

assert(
  POLISH_PROFILES.nonfiction.referenceIntegrity === true,
  'nonfiction profile has referenceIntegrity: true'
);

assert(
  POLISH_PROFILES.training_manual.referenceIntegrity === true,
  'training_manual profile has referenceIntegrity: true'
);

assert(
  POLISH_PROFILES.business_guide.referenceIntegrity === true,
  'business_guide profile has referenceIntegrity: true'
);

assert(
  POLISH_PROFILES.fiction.referenceIntegrity === 'auto',
  'fiction profile has referenceIntegrity: auto'
);

assert(
  POLISH_PROFILES.memoir.referenceIntegrity === 'auto',
  'memoir profile has referenceIntegrity: auto'
);

assert(
  POLISH_PROFILES.unknown.referenceIntegrity === 'auto',
  'unknown profile has referenceIntegrity: auto'
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Export gate integration — blocking behavior
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 3: Export gate integration — blocking behavior');

// 13: Fabricated reference with 'Journal of Things'
{
  const text = `The data supports this. (Doe, 2020)

## References

Doe, John. "Fake Study." Journal of Things, 14(2), 2020, pp. 55-60.`;
  const r = runReferenceIntegrityGate(text);
  assert(!r.ok, 'Fabricated reference (Journal of Things) produces blocking issue');
}

// 14: Placeholder reference [SOURCE NEEDED]
{
  const text = `This claim needs support. (Author, 2021)

## References

Author, Name. Title of Work. [SOURCE NEEDED]. 2021.`;
  const r = runReferenceIntegrityGate(text);
  assert(!r.ok, 'Placeholder reference [SOURCE NEEDED] produces blocking issue');
}

// 15: Missing reference for cited author
{
  const text = `According to recent findings (Johnson, 2021), this is true.

## References

Smith, Robert. The American Crisis. New York: Oxford University Press, 2019.`;
  const r = runReferenceIntegrityGate(text);
  assert(!r.ok, 'Missing reference for cited author (Johnson) produces blocking issue');
}

// 16: Complete valid reference section produces ok=true
{
  const text = `The study showed significant results (Smith, 2019).

## References

Smith, Robert. The American Crisis. New York: Oxford University Press, 2019.`;
  const r = runReferenceIntegrityGate(text);
  assert(r.ok === true, 'Complete valid reference section produces ok=true');
}

// 17: Incomplete reference (missing year) produces WARNING
{
  const text = `Some general information is here.

## References

Williams, James. Understanding Economics. Boston: Academic Press.`;
  const r = runReferenceIntegrityGate(text);
  assert(
    r.warnings.some(w => w.reason === 'INCOMPLETE_REFERENCE'),
    'Incomplete reference (missing year) produces INCOMPLETE_REFERENCE warning'
  );
}

// 18: Unused reference produces WARNING, not blocking
{
  const text = `This chapter has no citations at all.

## References

Adams, John. The Founding Era. Philadelphia: Liberty Press, 1998.`;
  const r = runReferenceIntegrityGate(text);
  assert(
    r.warnings.some(w => w.reason === 'UNUSED_REFERENCE') && r.ok === true,
    'Unused reference produces WARNING, not blocking'
  );
}

// 19: Further Reading section NOT treated as missing citation
{
  const text = `Some general discussion here.

## Further Reading

Adams, John. The Founding Era. Philadelphia: Liberty Press, 1998.
Baker, Susan. Modern History. London: Thames Publishing, 2005.`;
  const r = runReferenceIntegrityGate(text);
  // Further reading entries should not appear as unused references in crosscheck
  assert(
    !r.warnings.some(w => w.reason === 'UNUSED_REFERENCE' && w.reference && w.reference.raw && w.reference.raw.includes('Adams')),
    'Further Reading section entries NOT flagged as unused in main crosscheck'
  );
}

// 20: Mixed citation style produces WARNING
{
  const text = `This is noted (Smith, 2020). Also see [1] for more detail.

## References

Smith, John. The Study of Things. New York: Publisher, 2020.
1. Jones, Mary. Another Work. Chicago: Press, 2019.`;
  const r = validateReferenceFormatting(text);
  assert(
    r.style === 'mixed' || r.issues.some(i => i.type === 'MIXED_STYLE'),
    'Mixed citation style produces WARNING'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: URL and DOI preservation
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 4: URL and DOI preservation');

// 21: URLs in reference section are detected
{
  const textWithUrl = `Some text.

## References

Smith, John. "Online Resource." Example Journal, 2020. https://www.realsite.org/article/12345`;
  const r = validateReferenceFormatting(textWithUrl);
  assert(r.urlsPreserved === true, 'URLs in reference section are detected');
}

// 22: DOIs in reference section are detected
{
  const textWithDoi = `Some text.

## References

Smith, John. "A Study." Example Journal, 14(2), 2020. doi:10.1234/test.2021`;
  const r = validateReferenceFormatting(textWithDoi);
  assert(r.doisPreserved === true, 'DOIs in reference section are detected');
}

// 23: URL extraction works from entry
{
  const refTextWithUrl = `Smith, John. "Online Resource." Example Journal, 2020. https://www.realsite.org/article/12345`;
  const entries = extractReferenceEntries(refTextWithUrl);
  assert(entries.length > 0 && entries[0].url !== null, 'URL extraction works from entry');
}

// 24: DOI extraction works from entry
{
  const refTextWithDoi = `Smith, John. "A Study." Example Journal, 14(2), 2020. doi:10.1234/test.2021`;
  const entries = extractReferenceEntries(refTextWithDoi);
  assert(entries.length > 0 && entries[0].doi !== null, 'DOI extraction works from entry');
}

// 25: ISBN extraction works
{
  const refTextWithIsbn = `Smith, John. The Complete Guide. New York: Publisher, 2020. ISBN 978-0-123456-78-9.`;
  const entries = extractReferenceEntries(refTextWithIsbn);
  assert(entries.length > 0 && entries[0].isbn !== null, 'ISBN extraction works');
}

// 26: Access date extraction works
{
  const refTextWithAccess = `Smith, John. "Web Article." Online Source, 2020. https://www.example-real.org/page Accessed March 15, 2024.`;
  const entries = extractReferenceEntries(refTextWithAccess);
  assert(entries.length > 0 && entries[0].accessDate !== null, 'Access date extraction works');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Unsupported claim detection
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 5: Unsupported claim detection');

// 27: Statistic without citation is flagged
{
  const claims = flagUnsupportedClaims('About 45 percent of Americans have experienced this phenomenon in their lifetime.');
  assert(
    claims.some(c => c.type === 'UNSUPPORTED_STATISTIC'),
    'Statistic without citation is flagged as UNSUPPORTED_STATISTIC'
  );
}

// 28: Statistic WITH nearby citation is NOT flagged
{
  const claims = flagUnsupportedClaims('About 45 percent of Americans (Smith, 2020) have experienced this phenomenon.');
  const unsupportedStats = claims.filter(c => c.type === 'UNSUPPORTED_STATISTIC');
  assert(unsupportedStats.length === 0, 'Statistic WITH nearby citation is NOT flagged');
}

// 29: Legal claim without date is flagged
{
  const claims = flagUnsupportedClaims('Federal law requires all employers to provide reasonable accommodations.');
  assert(
    claims.some(c => c.type === 'UNSUPPORTED_LEGAL_CLAIM'),
    'Legal claim without date is flagged as UNSUPPORTED_LEGAL_CLAIM'
  );
}

// 30: Current verification needed is flagged as INFO
{
  const claims = flagUnsupportedClaims('Currently, the policy states that all applicants must submit documentation.');
  assert(
    claims.some(c => c.type === 'CURRENT_VERIFICATION_NEEDED'),
    'Current verification needed is flagged'
  );
}

// 31: Temporal claim severity is INFO not WARNING
{
  const claims = flagUnsupportedClaims('Currently, the policy states that all applicants must submit documentation.');
  const temporal = claims.find(c => c.type === 'CURRENT_VERIFICATION_NEEDED');
  assert(
    temporal && temporal.severity === 'INFO',
    'Temporal claim severity is INFO not WARNING'
  );
}

// 32: No false positives on fiction prose
{
  const claims = flagUnsupportedClaims('She walked to the door and opened it.');
  assert(claims.length === 0, 'No false positives on fiction prose without stats');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Suspicious/fabricated detection
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 6: Suspicious/fabricated detection');

// 33: 'Doe, John' triggers BLOCKING fabrication
{
  const entries = extractReferenceEntries('Doe, John. "A Fake Study." Journal of Testing, 2020.');
  const suspicious = detectSuspiciousReferences(entries);
  assert(
    suspicious.some(s => s.severity === 'BLOCKING' && s.reason === 'LIKELY_FABRICATED'),
    '"Doe, John" triggers BLOCKING fabrication'
  );
}

// 34: 'example.com' triggers BLOCKING fabrication
{
  const entries = extractReferenceEntries('Smith, Jane. "Web Resource." 2020. http://example.com/page');
  const suspicious = detectSuspiciousReferences(entries);
  assert(
    suspicious.some(s => s.severity === 'BLOCKING' && s.reason === 'LIKELY_FABRICATED'),
    '"example.com" triggers BLOCKING fabrication'
  );
}

// 35: 'pp. XX' triggers BLOCKING fabrication
{
  const entries = extractReferenceEntries('Author, First. "Article Title." Journal Name, 14(2), 2020, pp. XX-XX.');
  const suspicious = detectSuspiciousReferences(entries);
  assert(
    suspicious.some(s => s.severity === 'BLOCKING'),
    '"pp. XX" triggers BLOCKING fabrication'
  );
}

// 36: Real-looking reference does NOT trigger fabrication
{
  const entries = extractReferenceEntries('Smith, Robert. The American Crisis. New York: Oxford University Press, 2019.');
  const suspicious = detectSuspiciousReferences(entries);
  assert(
    !suspicious.some(s => s.severity === 'BLOCKING'),
    'Real-looking reference does NOT trigger fabrication'
  );
}

// 37: Placeholder [TK SOURCE] triggers BLOCKING
{
  const entries = extractReferenceEntries('Williams, James. Title of Work. [TK SOURCE]. Publisher, 2021.');
  const suspicious = detectSuspiciousReferences(entries);
  assert(
    suspicious.some(s => s.severity === 'BLOCKING' && s.reason === 'PLACEHOLDER_REFERENCE'),
    'Placeholder [TK SOURCE] triggers BLOCKING'
  );
}

// 38: Very short entry (<25 chars, no URL) triggers WARNING for TOO_SHORT
{
  const entries = [{ raw: 'Smith, 2020.', author: 'Smith', year: '2020', issues: [] }];
  const suspicious = detectSuspiciousReferences(entries);
  assert(
    suspicious.some(s => s.severity === 'WARNING' && s.reason === 'TOO_SHORT'),
    'Very short entry (<25 chars, no URL) triggers WARNING for TOO_SHORT'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Cross-check behavior
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 7: Cross-check behavior');

// 39: Matching APA citation with ref produces a match
{
  const text = `The results were clear (Smith, 2020).

## References

Smith, John. The Study of Things. New York: Publisher, 2020.`;
  const result = crosscheckCitationsToReferences(text);
  assert(
    result.matches.length > 0 && result.matches.some(m => m.matchType === 'author_year'),
    'Matching APA citation (Smith, 2020) with ref produces a match'
  );
}

// 40: Missing APA citation with no matching ref produces MISSING_REFERENCE
{
  const text = `The results were clear (Johnson, 2021).

## References

Smith, John. The Study of Things. New York: Publisher, 2020.`;
  const result = crosscheckCitationsToReferences(text);
  assert(
    result.missingReferences.some(m => m.severity === 'BLOCKING' && m.reason === 'MISSING_REFERENCE'),
    'Missing APA citation with no matching ref produces MISSING_REFERENCE with BLOCKING severity'
  );
}

// 41: Endnote [1] matched to 1st reference entry
{
  const text = `This was proven by research [1].

## References

Smith, John. The Study of Things. New York: Publisher, 2020.`;
  const result = crosscheckCitationsToReferences(text);
  assert(
    result.matches.some(m => m.matchType === 'endnote_number'),
    'Endnote [1] matched to 1st reference entry'
  );
}

// 42: Endnote [5] with only 3 entries produces MISSING_ENDNOTE_ENTRY
{
  const text = `This was proven by extensive research [5].

## References

Smith, John. The Study of Things. New York: Publisher, 2020.
Jones, Mary. Another Work. Chicago: Press, 2019.
Adams, Robert. Third Study. Boston: Academic, 2018.`;
  const result = crosscheckCitationsToReferences(text);
  assert(
    result.missingReferences.some(m => m.reason === 'MISSING_ENDNOTE_ENTRY'),
    'Endnote [5] with only 3 entries produces MISSING_ENDNOTE_ENTRY'
  );
}

// 43: Named source 'According to the CDC' is detected as citation and does not produce MISSING_REFERENCE
{
  const text = `According to the CDC, vaccination rates increased significantly.

## References

Centers for Disease Control and Prevention (CDC). "Immunization Report." 2022. https://www.cdc.gov/report`;
  const citations = extractInlineCitations(text);
  const hasNamedCdc = citations.some(c => c.type === 'named_source' && c.text.includes('CDC'));
  const result = crosscheckCitationsToReferences(text);
  // Named sources don't require formal bibliography entries (by design), so no MISSING_REFERENCE
  const noMissingForCdc = !result.missingReferences.some(m => m.citation?.text?.includes('CDC'));
  assert(
    hasNamedCdc && noMissingForCdc,
    'Named source "According to the CDC" detected as citation and does not produce MISSING_REFERENCE'
  );
}

// 44: Duplicate references produce DUPLICATE_REFERENCE warning
{
  const text = `The results were clear (Smith, 2020).

## References

Smith, John. The Study of Things. New York: Publisher, 2020.

Smith, John. The Study of Things. New York: Publisher, 2020.`;
  const result = crosscheckCitationsToReferences(text);
  assert(
    result.duplicateReferences.some(d => d.reason === 'DUPLICATE_REFERENCE'),
    'Duplicate references (same author+year) produce DUPLICATE_REFERENCE warning'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Full gate integration
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 8: Full gate integration');

// 45: Clean nonfiction text with proper refs
{
  const text = `The phenomenon has been widely studied (Smith, 2020).

## References

Smith, Robert. The Comprehensive Study. New York: Oxford University Press, 2020.`;
  const r = runReferenceIntegrityGate(text, { genre: 'nonfiction' });
  assert(r.ok === true && r.sections.length > 0, 'Clean nonfiction text: gate returns ok=true, sections.length > 0');
}

// 46: Empty/null text
{
  const r = runReferenceIntegrityGate(null);
  assert(r.ok === true && r.summary.includes('No text'), 'Empty/null text: gate returns ok=true, summary contains "No text"');
}

// 47: Fiction text without refs
{
  const text = 'She ran through the forest, her heart pounding. The trees loomed tall and dark.';
  const r = runReferenceIntegrityGate(text, { genre: 'fiction' });
  assert(r.ok === true && r.sections.length === 0, 'Fiction text without refs: gate returns ok=true, sections.length === 0');
}

// 48: Text with fabricated ref
{
  const text = `The data shows clear trends (Doe, 2020).

## References

Doe, John. "Fabricated Study." Journal of Things, 14(2), 2020, pp. 55-60.`;
  const r = runReferenceIntegrityGate(text);
  assert(r.ok === false && r.blockingIssues.length > 0, 'Text with fabricated ref: gate returns ok=false, blockingIssues > 0');
}

// 49: Gate summary includes counts
{
  const text = `The study was conclusive (Brown, 2021).

## References

Brown, Alice. Critical Analysis. Boston: Harvard Press, 2021.`;
  const r = runReferenceIntegrityGate(text);
  assert(
    r.summary.includes('Reference sections:') && (r.summary.includes('Gate: PASS') || r.summary.includes('Gate: FAIL')),
    'Gate summary includes "Reference sections:" and "Gate: PASS" or "Gate: FAIL"'
  );
}

// 50: Gate aggregates from all sources
{
  const text = `About 78 percent of users prefer this. Currently, the trend is upward. Federal law requires compliance.

## References

Williams, James. Understanding Economics. Boston: Academic Press.
Author, Name. Title. [TK SOURCE]. 2021.`;
  const r = runReferenceIntegrityGate(text);
  assert(
    r.blockingIssues.length > 0 && r.warnings.length > 0,
    'Gate aggregates from all sources: blockingIssues + warnings both populated'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Safety regression
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 9: Safety regression');

// 51: Gate never mutates input text
{
  const original = `The study found results (Smith, 2020).

## References

Smith, Robert. The Study. New York: Oxford University Press, 2020.`;
  const copy = original.slice();
  runReferenceIntegrityGate(original);
  assert(original === copy, 'Gate never mutates input text');
}

// 52: Gate never invents citations
{
  const text = `The cat sat on the mat.

## References

Smith, Robert. The Study. New York: Oxford University Press, 2020.`;
  const r = runReferenceIntegrityGate(text);
  // The text has no inline citations, so citations array should be empty (or only contain what's in text)
  const allCitationTexts = r.citations.map(c => c.text);
  const allInText = allCitationTexts.every(ct => text.includes(ct));
  assert(allInText, 'Gate never invents citations — all citation.text values found in original text');
}

// 53: Gate never fabricates reference entries
{
  const text = `Some claim here (Jones, 2022).

## References

Jones, Mary. Real Work. Chicago: University Press, 2022.`;
  const r = runReferenceIntegrityGate(text);
  const allEntriesInText = r.entries.every(e => text.includes(e.author) || text.includes(e.raw.slice(0, 20)));
  assert(allEntriesInText, 'Gate never fabricates reference entries');
}

// 54: Gate returns consistent results on repeated calls
{
  const text = `Evidence shows (Clark, 2019) a strong relationship.

## References

Clark, David. The Evidence Base. London: Routledge, 2019.`;
  const r1 = runReferenceIntegrityGate(text);
  const r2 = runReferenceIntegrityGate(text);
  assert(
    r1.ok === r2.ok &&
    r1.blockingIssues.length === r2.blockingIssues.length &&
    r1.warnings.length === r2.warnings.length &&
    r1.summary === r2.summary,
    'Gate returns consistent results on repeated calls'
  );
}

// 55: Null project parameter doesn't crash
{
  let crashed = false;
  try {
    runReferenceIntegrityGate('Some text.', null);
  } catch (e) {
    crashed = true;
  }
  assert(!crashed, 'Null project parameter does not crash');
}

// 56: Undefined project parameter doesn't crash
{
  let crashed = false;
  try {
    runReferenceIntegrityGate('Some text.', undefined);
  } catch (e) {
    crashed = true;
  }
  assert(!crashed, 'Undefined project parameter does not crash');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\nREFERENCE INTEGRITY PRODUCTION WIRING: ${passed} passed, ${failed} failed out of ${passed + failed}`);
process.exit(failed > 0 ? 1 : 0);
