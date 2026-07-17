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
