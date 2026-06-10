import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectNonfictionWeaknesses,
  reduceEssayBotTransitions,
  reduceNonfictionFilterVerbs,
  reduceNotJustConstructions,
  strengthenNonfictionParagraphOpenings,
  preserveNonfictionStructure,
  runNonfictionDeterministicCleanup,
} from '../src/lib/nonfictionAntiChatbotCleanup.js';

import { analyzeProseTexture } from '../src/lib/antiChatbotProse.js';

const WEAK_NONFICTION = `## The Crisis of Infrastructure

Moreover, the systems appeared to be holding up despite their age. It felt like the kind of problem that could wait. City officials noticed that maintenance costs were rising.

Furthermore, the scale of underinvestment was staggering. According to the ASCE 2021 Report Card, the gap was $434 billion (ASCE, 2021). It is important to note that this figure represents only federal estimates.

## The Human Cost

Additionally, the health impacts were severe. This shows that the system failed communities. The consequences were not just financial, but deeply personal.`;

const NONFICTION_PROFILE = { genre: 'nonfiction', book_type: 'nonfiction' };
const FICTION_PROFILE = { genre: 'thriller', book_type: 'fiction' };

// ─── reduceEssayBotTransitions ────────────────────────────────────────────

describe('reduceEssayBotTransitions', () => {
  it('1. removes "Moreover, " from sentence start', () => {
    const input = 'Moreover, the data was clear.';
    const { text } = reduceEssayBotTransitions(input);
    assert.ok(!text.startsWith('Moreover,'), `should remove "Moreover, " but got: "${text}"`);
    assert.ok(text.startsWith('The'), `should capitalize after removal but got: "${text}"`);
  });

  it('2. removes "Furthermore, " from sentence start', () => {
    const input = 'Furthermore, the evidence mounted.';
    const { text } = reduceEssayBotTransitions(input);
    assert.ok(!text.includes('Furthermore,'), `should remove "Furthermore, " but got: "${text}"`);
  });

  it('3. removes "Additionally, " from sentence start', () => {
    const input = 'Additionally, the costs increased.';
    const { text } = reduceEssayBotTransitions(input);
    assert.ok(!text.includes('Additionally,'), `should remove "Additionally, " but got: "${text}"`);
  });

  it('4. removes "It is important to note that "', () => {
    const input = 'It is important to note that this figure represents only estimates.';
    const { text } = reduceEssayBotTransitions(input);
    assert.ok(!text.includes('It is important to note that'), `should remove phrase but got: "${text}"`);
    assert.ok(text.startsWith('This'), `should capitalize remainder but got: "${text}"`);
  });

  it('5. removes "It should be understood that "', () => {
    const input = 'It should be understood that the gap has widened.';
    const { text } = reduceEssayBotTransitions(input);
    assert.ok(!text.includes('It should be understood that'), `should remove phrase but got: "${text}"`);
  });

  it('6. removes "This shows that "', () => {
    const input = 'This shows that the system failed.';
    const { text } = reduceEssayBotTransitions(input);
    assert.ok(!text.includes('This shows that'), `should remove phrase but got: "${text}"`);
    assert.ok(text.startsWith('The'), `should capitalize but got: "${text}"`);
  });

  it('7. removes "This highlights "', () => {
    const input = 'This highlights the severity of the problem.';
    const { text } = reduceEssayBotTransitions(input);
    assert.ok(!text.includes('This highlights'), `should remove phrase but got: "${text}"`);
  });

  it('8. preserves text inside citations like (ASCE, 2021)', () => {
    const input = 'The gap was $434 billion (ASCE, 2021). Moreover, costs rose.';
    const { text } = reduceEssayBotTransitions(input);
    assert.ok(text.includes('(ASCE, 2021)'), `should preserve citation but got: "${text}"`);
  });

  it('9. capitalizes after removal', () => {
    const input = 'Moreover, the results were clear.';
    const { text } = reduceEssayBotTransitions(input);
    assert.match(text, /^[A-Z]/, 'first character should be uppercase after removal');
  });
});

// ─── reduceNonfictionFilterVerbs ──────────────────────────────────────────

describe('reduceNonfictionFilterVerbs', () => {
  it('10. reduces "It felt like " at sentence start', () => {
    const input = 'It felt like the kind of problem that could wait.';
    const { text } = reduceNonfictionFilterVerbs(input);
    assert.ok(!text.includes('It felt like'), `should remove filter verb but got: "${text}"`);
    assert.ok(text.startsWith('The'), `should capitalize remainder but got: "${text}"`);
  });

  it('11. reduces "It seemed like "', () => {
    const input = 'It seemed like the crisis was inevitable.';
    const { text } = reduceNonfictionFilterVerbs(input);
    assert.ok(!text.includes('It seemed like'), `should remove filter verb but got: "${text}"`);
  });

  it('12. reduces "appeared to be" to "was"', () => {
    const input = 'The system appeared to be functioning well.';
    const { text } = reduceNonfictionFilterVerbs(input);
    assert.ok(text.includes('was'), `should replace with "was" but got: "${text}"`);
    assert.ok(!text.includes('appeared to be'), `should remove "appeared to be" but got: "${text}"`);
  });
});

// ─── reduceNotJustConstructions ──────────────────────────────────────────

describe('reduceNotJustConstructions', () => {
  it('13. handles "not just X, but Y"', () => {
    const input = 'The consequences were not just financial, but deeply personal.';
    const { text } = reduceNotJustConstructions(input);
    assert.ok(!text.includes('not just'), `should remove "not just" but got: "${text}"`);
    assert.ok(text.includes('both'), `should use "both...and" but got: "${text}"`);
  });

  it('14. handles "wasn\'t simply"', () => {
    const input = "The problem wasn't simply a matter of money.";
    const { text } = reduceNotJustConstructions(input);
    assert.ok(!text.includes("wasn't simply"), `should replace "wasn't simply" but got: "${text}"`);
    assert.ok(text.includes('was'), `should use "was" but got: "${text}"`);
  });
});

// ─── strengthenNonfictionParagraphOpenings ────────────────────────────────

describe('strengthenNonfictionParagraphOpenings', () => {
  it('15. removes "The fact is that"', () => {
    const input = 'The fact is that the infrastructure was crumbling beneath their feet and the officials knew it would take decades to repair what had been neglected for so long.';
    const { text } = strengthenNonfictionParagraphOpenings(input);
    assert.ok(!text.includes('The fact is that'), `should remove phrase but got: "${text}"`);
    assert.ok(text.startsWith('The infrastructure'), `should capitalize remainder but got: "${text}"`);
  });
});

// ─── preserveNonfictionStructure ─────────────────────────────────────────

describe('preserveNonfictionStructure', () => {
  it('16. validates heading count preserved', () => {
    const original = '## Section One\n\nSome text here.\n\n## Section Two\n\nMore text.';
    const revised = '## Section One\n\nRevised text here.\n\n## Section Two\n\nMore revised text.';
    const result = preserveNonfictionStructure(original, revised);
    assert.equal(result.headingsPreserved, true);
    assert.equal(result.ok, true);
  });

  it('17. detects heading loss', () => {
    const original = '## Section One\n\nSome text here.\n\n## Section Two\n\nMore text.';
    const revised = '## Section One\n\nRevised text with section two merged in.';
    const result = preserveNonfictionStructure(original, revised);
    assert.equal(result.headingsPreserved, false);
    assert.equal(result.ok, false);
  });

  it('18. validates citation count preserved', () => {
    const original = 'The gap was significant (ASCE, 2021). Studies confirm this (Smith, 2020).';
    const revised = 'The gap was significant (ASCE, 2021). Studies confirm this (Smith, 2020).';
    const result = preserveNonfictionStructure(original, revised);
    assert.equal(result.citationsPreserved, true);
  });

  it('19. detects citation loss', () => {
    const original = 'The gap was significant (ASCE, 2021). Studies confirm this (Smith, 2020).';
    const revised = 'The gap was significant. Studies confirm this.';
    const result = preserveNonfictionStructure(original, revised);
    assert.equal(result.citationsPreserved, false);
    assert.equal(result.ok, false);
  });
});

// ─── runNonfictionDeterministicCleanup ────────────────────────────────────

describe('runNonfictionDeterministicCleanup', () => {
  it('20. returns applied=true when changes made', () => {
    const result = runNonfictionDeterministicCleanup(WEAK_NONFICTION, NONFICTION_PROFILE);
    assert.equal(result.applied, true, 'should apply changes to weak nonfiction');
  });

  it('21. returns change log', () => {
    const result = runNonfictionDeterministicCleanup(WEAK_NONFICTION, NONFICTION_PROFILE);
    assert.ok(result.changeLog, 'should have changeLog');
    assert.ok(typeof result.changeLog.total === 'number', 'changeLog.total should be a number');
    assert.ok(result.changeLog.total > 0, 'should have at least one change');
    assert.ok(Array.isArray(result.changeLog.essayBot), 'changeLog.essayBot should be array');
    assert.ok(Array.isArray(result.changeLog.filterVerbs), 'changeLog.filterVerbs should be array');
    assert.ok(Array.isArray(result.changeLog.notJust), 'changeLog.notJust should be array');
    assert.ok(Array.isArray(result.changeLog.openings), 'changeLog.openings should be array');
  });

  it('22. preserves headings in weak sample', () => {
    const result = runNonfictionDeterministicCleanup(WEAK_NONFICTION, NONFICTION_PROFILE);
    const headingCount = (result.text.match(/^##\s+.+$/gm) || []).length;
    assert.equal(headingCount, 2, `should preserve both headings, found ${headingCount}`);
  });

  it('23. preserves citations in weak sample', () => {
    const result = runNonfictionDeterministicCleanup(WEAK_NONFICTION, NONFICTION_PROFILE);
    assert.ok(result.text.includes('(ASCE, 2021)'), 'should preserve (ASCE, 2021) citation');
  });

  it('24. skips fiction profiles (returns applied=false)', () => {
    const result = runNonfictionDeterministicCleanup(WEAK_NONFICTION, FICTION_PROFILE);
    assert.equal(result.applied, false, 'should not apply to fiction profile');
    assert.equal(result.text, WEAK_NONFICTION, 'text should be unchanged for fiction');
  });
});

// ─── detectNonfictionWeaknesses ──────────────────────────────────────────

describe('detectNonfictionWeaknesses', () => {
  it('25. counts essay-bot transitions correctly', () => {
    const result = detectNonfictionWeaknesses(WEAK_NONFICTION, NONFICTION_PROFILE);
    // Should detect: Moreover, Furthermore, Additionally, It is important to note, This shows that
    assert.ok(result.essayBotTransitions >= 5,
      `should find at least 5 essay-bot transitions, found ${result.essayBotTransitions}`);
    assert.equal(result.isNonfiction, true, 'should identify as nonfiction');
  });
});
