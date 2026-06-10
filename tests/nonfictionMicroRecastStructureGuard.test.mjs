import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  preserveNonfictionStructure,
  runNonfictionDeterministicCleanup,
  splitNonfictionIntoMicroRecastUnits,
} from '../src/lib/nonfictionAntiChatbotCleanup.js';

import { VERSION } from '../src/lib/antiChatbotRecastPipeline.js';

import { detectMarkdownHeadings } from '../src/lib/recastModelRouting.js';

const NONFICTION_PROFILE = { genre: 'nonfiction', book_type: 'nonfiction' };

const STRUCTURE_SAMPLE = `## The Crisis of Infrastructure

Moreover, the systems appeared to be holding up despite their age. It felt like the kind of problem that could wait. City officials noticed that maintenance costs were rising.

Furthermore, the scale of underinvestment was staggering. According to the ASCE 2021 Report Card, the gap was $434 billion (ASCE, 2021). It is important to note that this figure represents only federal estimates.

## The Human Cost

Additionally, the health impacts were severe. This shows that the system failed communities. The consequences were not just financial, but deeply personal.

References

ASCE. (2021). Infrastructure Report Card.
Smith, J. (2020). Water Policy Review.

- Budget shortfall reported
- Workforce pipeline declining
- Consolidation efforts stalled
- Political resistance strong`;

// ─── VERSION ─────────────────────────────────────────────────────────────

describe('Pipeline version', () => {
  it('1. VERSION is v5.0', () => {
    assert.ok(VERSION.includes('v5.0'), `VERSION should include "v5.0", got: "${VERSION}"`);
  });
});

// ─── preserveNonfictionStructure ─────────────────────────────────────────

describe('preserveNonfictionStructure', () => {
  it('2. returns ok when headings match', () => {
    const original = '## One\n\nText.\n\n## Two\n\nMore text.';
    const revised = '## One\n\nRevised text.\n\n## Two\n\nMore revised text.';
    const result = preserveNonfictionStructure(original, revised);
    assert.equal(result.ok, true);
    assert.equal(result.headingsPreserved, true);
  });

  it('3. returns ok when citations match', () => {
    const original = 'Study found X (Smith, 2020). Also Y (Jones, 2021).';
    const revised = 'Study found X (Smith, 2020). Also Y (Jones, 2021).';
    const result = preserveNonfictionStructure(original, revised);
    assert.equal(result.ok, true);
    assert.equal(result.citationsPreserved, true);
  });

  it('4. fails when heading lost', () => {
    const original = '## One\n\nText.\n\n## Two\n\nMore text.';
    const revised = '## One\n\nAll text merged here.';
    const result = preserveNonfictionStructure(original, revised);
    assert.equal(result.headingsPreserved, false);
    assert.equal(result.ok, false);
  });

  it('5. fails when citation lost', () => {
    const original = 'Data showed this (ASCE, 2021). Also that (Smith, 2020).';
    const revised = 'Data showed this. Also that.';
    const result = preserveNonfictionStructure(original, revised);
    assert.equal(result.citationsPreserved, false);
    assert.equal(result.ok, false);
  });

  it('6. ok is false when both headings and citations lost', () => {
    const original = '## Section\n\nData (ASCE, 2021).';
    const revised = 'Data merged.';
    const result = preserveNonfictionStructure(original, revised);
    assert.equal(result.ok, false);
    assert.equal(result.headingsPreserved, false);
    assert.equal(result.citationsPreserved, false);
  });
});

// ─── Deterministic cleanup structure preservation ────────────────────────

describe('Deterministic cleanup structure preservation', () => {
  it('7. preserves 2 headings in sample', () => {
    const result = runNonfictionDeterministicCleanup(STRUCTURE_SAMPLE, NONFICTION_PROFILE);
    const headingCount = detectMarkdownHeadings(result.text);
    assert.equal(headingCount, 2, `should preserve 2 headings, found ${headingCount}`);
  });

  it('8. preserves 1 citation in sample', () => {
    const result = runNonfictionDeterministicCleanup(STRUCTURE_SAMPLE, NONFICTION_PROFILE);
    const citCount = (result.text.match(/\([^)]*\d{4}[^)]*\)/g) || []).length;
    assert.ok(citCount >= 1, `should preserve at least 1 citation, found ${citCount}`);
  });

  it('9. bibliography sections untouched by cleanup', () => {
    const result = runNonfictionDeterministicCleanup(STRUCTURE_SAMPLE, NONFICTION_PROFILE);
    assert.ok(result.text.includes('ASCE. (2021). Infrastructure Report Card.'), 'bibliography entry should be preserved');
    assert.ok(result.text.includes('Smith, J. (2020). Water Policy Review.'), 'bibliography entry should be preserved');
  });

  it('10. list structure untouched by cleanup', () => {
    const result = runNonfictionDeterministicCleanup(STRUCTURE_SAMPLE, NONFICTION_PROFILE);
    assert.ok(result.text.includes('- Budget shortfall reported'), 'list item 1 should be preserved');
    assert.ok(result.text.includes('- Workforce pipeline declining'), 'list item 2 should be preserved');
    assert.ok(result.text.includes('- Consolidation efforts stalled'), 'list item 3 should be preserved');
    assert.ok(result.text.includes('- Political resistance strong'), 'list item 4 should be preserved');
  });

  it('11. no heading alteration in cleanup output', () => {
    const result = runNonfictionDeterministicCleanup(STRUCTURE_SAMPLE, NONFICTION_PROFILE);
    assert.ok(result.text.includes('## The Crisis of Infrastructure'), 'heading 1 should be unchanged');
    assert.ok(result.text.includes('## The Human Cost'), 'heading 2 should be unchanged');
  });

  it('12. no citation alteration in cleanup output', () => {
    const result = runNonfictionDeterministicCleanup(STRUCTURE_SAMPLE, NONFICTION_PROFILE);
    assert.ok(result.text.includes('(ASCE, 2021)'), 'citation should be exactly preserved');
  });
});

// ─── Split units protection ──────────────────────────────────────────────

describe('Split units protection', () => {
  it('13. protects headings from recast', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(STRUCTURE_SAMPLE);
    const headingUnits = units.filter(u => u.type === 'heading');
    assert.ok(headingUnits.length >= 2, `should have at least 2 heading units, found ${headingUnits.length}`);
    for (const u of headingUnits) {
      assert.equal(u.protected, true, `heading "${u.text}" should be protected`);
    }
  });

  it('14. protects bibliography from recast', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(STRUCTURE_SAMPLE);
    const bibUnit = units.find(u => u.type === 'bibliography');
    assert.ok(bibUnit, 'should find bibliography unit');
    assert.equal(bibUnit.protected, true, 'bibliography should be protected');
  });

  it('15. protects lists from recast', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(STRUCTURE_SAMPLE);
    const listUnit = units.find(u => u.type === 'list');
    assert.ok(listUnit, 'should find list unit');
    assert.equal(listUnit.protected, true, 'list should be protected');
  });
});
