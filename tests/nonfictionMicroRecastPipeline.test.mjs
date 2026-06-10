import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  splitNonfictionIntoMicroRecastUnits,
  shouldMicroRecastNonfictionUnit,
  buildNonfictionMicroRecastPrompt,
} from '../src/lib/nonfictionAntiChatbotCleanup.js';

import { analyzeProseTexture } from '../src/lib/antiChatbotProse.js';

const SAMPLE_TEXT = `## Section Heading

The consequences of this neglect were deeply felt across communities. Residents watched their tap water turn brown. Moreover, the health impacts were severe. Blood lead levels in children under six rose significantly. City officials noticed that maintenance costs were rising but realized that confronting the full scope would require political will.

References

ASCE. (2021). Infrastructure Report Card.
Smith, J. (2020). Water Policy Review.

- Item one
- Item two
- Item three
- Item four

Multiple citations appeared here (Author, 2020). The data showed results (Smith, 2021). Additional findings (Jones et al., 2022). This paragraph has many (Brown, 2019).`;

const NONFICTION_PROFILE = { genre: 'nonfiction', book_type: 'nonfiction' };

// ─── splitNonfictionIntoMicroRecastUnits ──────────────────────────────────

describe('splitNonfictionIntoMicroRecastUnits', () => {
  it('1. splits paragraphs correctly', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(SAMPLE_TEXT);
    assert.ok(units.length >= 4, `should split into at least 4 units, got ${units.length}`);
  });

  it('2. tags heading paragraphs as "heading"', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(SAMPLE_TEXT);
    const headingUnit = units.find(u => u.text.startsWith('## Section'));
    assert.ok(headingUnit, 'should find a heading unit');
    assert.equal(headingUnit.type, 'heading', `heading unit should have type "heading", got "${headingUnit.type}"`);
  });

  it('3. tags short paragraphs as "short"', () => {
    const shortText = '## Title\n\nOne two three.\n\nThis is a much longer paragraph that contains enough words to be considered eligible for micro-recast processing because it exceeds the minimum word threshold of thirty words set as default.';
    const { units } = splitNonfictionIntoMicroRecastUnits(shortText);
    const shortUnit = units.find(u => u.text === 'One two three.');
    assert.ok(shortUnit, 'should find short paragraph');
    assert.equal(shortUnit.type, 'short', `short paragraph should have type "short", got "${shortUnit.type}"`);
  });

  it('4. marks headings as protected', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(SAMPLE_TEXT);
    const headingUnit = units.find(u => u.type === 'heading');
    assert.ok(headingUnit, 'should find heading unit');
    assert.equal(headingUnit.protected, true, 'heading should be protected');
  });

  it('5. marks bibliography paragraphs as "bibliography"', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(SAMPLE_TEXT);
    const bibUnit = units.find(u => u.text.startsWith('References'));
    assert.ok(bibUnit, 'should find References paragraph');
    assert.equal(bibUnit.type, 'bibliography', `bibliography unit should have type "bibliography", got "${bibUnit.type}"`);
  });

  it('6. marks list-heavy paragraphs as "list"', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(SAMPLE_TEXT);
    const listUnit = units.find(u => u.text.includes('- Item one'));
    assert.ok(listUnit, 'should find list unit');
    assert.equal(listUnit.type, 'list', `list unit should have type "list", got "${listUnit.type}"`);
  });

  it('7. marks citation-heavy paragraphs (>2 citations) as "citation_heavy"', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(SAMPLE_TEXT);
    const citUnit = units.find(u => u.text.includes('(Author, 2020)') && u.text.includes('(Brown, 2019)'));
    assert.ok(citUnit, 'should find citation-heavy unit');
    assert.equal(citUnit.type, 'citation_heavy', `citation-heavy unit should have type "citation_heavy", got "${citUnit.type}"`);
  });

  it('8. marks normal paragraphs as "eligible"', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(SAMPLE_TEXT);
    const eligibleUnit = units.find(u => u.type === 'eligible');
    assert.ok(eligibleUnit, 'should find at least one eligible unit');
  });
});

// ─── shouldMicroRecastNonfictionUnit ─────────────────────────────────────

describe('shouldMicroRecastNonfictionUnit', () => {
  it('9. rejects heading units', () => {
    const unit = { text: '## Some Heading', index: 0, type: 'heading', words: 3, protected: true };
    const result = shouldMicroRecastNonfictionUnit(unit, NONFICTION_PROFILE);
    assert.equal(result.eligible, false, 'heading should not be eligible');
    assert.ok(result.reason.includes('Protected'), `reason should mention Protected, got: "${result.reason}"`);
  });

  it('10. rejects bibliography units', () => {
    const unit = { text: 'References\n\nASCE. (2021). Report.', index: 0, type: 'bibliography', words: 5, protected: true };
    const result = shouldMicroRecastNonfictionUnit(unit, NONFICTION_PROFILE);
    assert.equal(result.eligible, false, 'bibliography should not be eligible');
  });

  it('11. rejects protected units', () => {
    const unit = { text: '- Item one\n- Item two\n- Item three\n- Item four', index: 0, type: 'list', words: 8, protected: true };
    const result = shouldMicroRecastNonfictionUnit(unit, NONFICTION_PROFILE);
    assert.equal(result.eligible, false, 'protected list should not be eligible');
  });

  it('12. accepts eligible weak paragraphs below threshold', () => {
    const weakPara = 'Moreover, the systems appeared to be holding up despite their age. It felt like the kind of problem that could wait. Furthermore, the scale of underinvestment was staggering. It is important to note that this figure represents only federal and state-level estimates. Additionally, the health impacts were severe and the consequences felt deeply across all affected communities and regions.';
    const unit = { text: weakPara, index: 0, type: 'eligible', words: weakPara.split(/\s+/).length, protected: false };
    const result = shouldMicroRecastNonfictionUnit(unit, NONFICTION_PROFILE, { microRecastThreshold: 95 });
    assert.equal(result.eligible, true, `weak paragraph should be eligible, reason: ${result.reason}`);
  });

  it('13. rejects eligible paragraphs above threshold', () => {
    const strongPara = 'The cracked water main beneath Jefferson Avenue burst at 3:17 a.m. on a Tuesday in February. Raw sewage flooded twelve basements. Three children were hospitalized with gastrointestinal infections. The repair crew arrived six hours later — understaffed, under-equipped, patching a pipe installed during the Eisenhower administration. Municipal water infrastructure across the American Midwest had reached its breaking point.';
    const unit = { text: strongPara, index: 0, type: 'eligible', words: strongPara.split(/\s+/).length, protected: false };
    const metrics = analyzeProseTexture(strongPara);
    // Use a threshold low enough that strong prose is above it
    const result = shouldMicroRecastNonfictionUnit(unit, NONFICTION_PROFILE, { microRecastThreshold: metrics.compositeScore - 1 });
    assert.equal(result.eligible, false, 'strong paragraph above threshold should not be eligible');
  });
});

// ─── buildNonfictionMicroRecastPrompt ────────────────────────────────────

describe('buildNonfictionMicroRecastPrompt', () => {
  const paraText = 'Moreover, the systems appeared to be holding up despite their age. It felt like the kind of problem that could wait. The gap was $434 billion (ASCE, 2021). Furthermore, costs continued to rise at an alarming rate across the nation.';
  const unit = { text: paraText, index: 0, type: 'eligible', words: paraText.split(/\s+/).length, protected: false };

  it('14. includes word count', () => {
    const prompt = buildNonfictionMicroRecastPrompt(unit, NONFICTION_PROFILE);
    assert.ok(prompt.includes(`${unit.words} words`), `should include word count "${unit.words} words" in prompt`);
  });

  it('15. includes min and max word bounds', () => {
    const prompt = buildNonfictionMicroRecastPrompt(unit, NONFICTION_PROFILE);
    const minWords = Math.floor(unit.words * 0.95);
    const maxWords = Math.ceil(unit.words * 1.15);
    assert.ok(prompt.includes(String(minWords)), `should include min word bound ${minWords}`);
    assert.ok(prompt.includes(String(maxWords)), `should include max word bound ${maxWords}`);
  });

  it('16. includes "Do not summarize"', () => {
    const prompt = buildNonfictionMicroRecastPrompt(unit, NONFICTION_PROFILE);
    assert.ok(prompt.includes('Do not summarize'), 'prompt should include "Do not summarize"');
  });

  it('17. includes citation preservation for cited text', () => {
    const prompt = buildNonfictionMicroRecastPrompt(unit, NONFICTION_PROFILE);
    assert.ok(prompt.includes('Preserve citations EXACTLY'), 'prompt should include citation preservation instruction');
  });

  it('18. prohibits literary imagery', () => {
    const prompt = buildNonfictionMicroRecastPrompt(unit, NONFICTION_PROFILE);
    assert.ok(prompt.includes('literary imagery'), 'prompt should prohibit literary imagery');
  });

  it('19. includes "Return ONLY the revised paragraph"', () => {
    const prompt = buildNonfictionMicroRecastPrompt(unit, NONFICTION_PROFILE);
    assert.ok(prompt.includes('Return ONLY the revised paragraph'), 'prompt should include return-only instruction');
  });

  it('20. includes essay-bot phrasing removal instruction', () => {
    const prompt = buildNonfictionMicroRecastPrompt(unit, NONFICTION_PROFILE);
    assert.ok(prompt.includes('essay-bot'), 'prompt should reference essay-bot phrasing removal');
  });
});
