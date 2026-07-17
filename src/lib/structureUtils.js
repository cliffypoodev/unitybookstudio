export function countParagraphs(text) {
  return String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/).filter(p => p.trim().length > 0).length;
}

export function verifySaveParagraphMatch(expectedContent, verifyContent) {
  const expectedPCount = countParagraphs(expectedContent);
  const verifyPCount = countParagraphs(verifyContent);

  if (expectedPCount !== verifyPCount) {
    return {
      ok: false,
      expected: expectedPCount,
      actual: verifyPCount
    };
  }

  return { ok: true, expected: expectedPCount, actual: verifyPCount };
}

export function countRangeRemovals(ranges) {
  return (ranges || []).reduce((sum, r) => {
    if (r && typeof r.start === 'number' && typeof r.end === 'number') {
      return sum + Math.max(0, r.end - r.start);
    }
    return sum;
  }, 0);
}

export function sumQuarantineRemovals(changes) {
  return (changes || []).reduce((sum, ch) => sum + (ch.paragraphsRemoved || 0), 0);
}
