/**
 * weakNonfictionHeadingCitationStress.test.mjs
 *
 * Unit tests for weak nonfiction with headings, citations, filter verbs,
 * and essay-bot transitions. Verifies that the routing module and pipeline
 * handle nonfiction structure correctly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  chooseRecastModel,
  detectRecastWeaknessTypes,
  detectMarkdownHeadings,
  detectSectionHeadings,
  validateHeadingPreservation,
  RECAST_MODELS,
} from '../src/lib/recastModelRouting.js';

import {
  analyzeProseTexture,
  getAntiChatbotRulesForProject,
} from '../src/lib/antiChatbotProse.js';

import {
  shouldRecastChunk,
  detectProtections,
  PROTECTION_TYPE,
} from '../src/lib/antiChatbotRecastPipeline.js';

// ── Weak nonfiction sample ──
const WEAK_NF = `## The Quiet Crisis of Municipal Water Infrastructure

It felt like the kind of problem that could wait. For decades, municipal water systems across the American Midwest seemed to function well enough, delivering clean water to millions of households without attracting much public attention. Moreover, the systems appeared to be holding up despite their age. City officials noticed that maintenance costs were rising, but they realized that confronting the full scope of the problem would require political will that simply did not exist.

Furthermore, the scale of underinvestment was staggering. According to the American Society of Civil Engineers' 2021 Infrastructure Report Card, the nation's drinking water infrastructure received a grade of C-minus, with an estimated funding gap of $434 billion over the next twenty years (ASCE, 2021). It is important to note that this figure represents only federal and state-level estimates.

## The Human Cost of Deferred Maintenance

The consequences of this neglect were deeply felt across communities. Residents in Flint, Michigan watched their tap water turn brown and wondered whether the crisis would ever be resolved. They seemed to understand, on some fundamental level, that the system had failed them. The emotional toll was significant. Additionally, the health impacts were severe. Blood lead levels in children under six rose by 2.4 percentage points (Hanna-Attisha et al., 2016).

## Structural Barriers to Reform

The fundamental challenge felt almost insurmountable. Municipal water utilities operate within a web of regulatory, financial, and political constraints that make comprehensive reform difficult. Furthermore, the fragmented nature of water governance — with over 50,000 community water systems — means that no single policy intervention can address the problem.

A recent analysis found that consolidation could reduce per-household costs by 18 to 34 percent (Kearney & Liu, 2023). However, political resistance remained fierce. Local officials seemed to view consolidation as a loss of autonomy. Additionally, the workforce pipeline was drying up.`;

const nonfictionProfile = { genre: 'nonfiction', book_type: 'nonfiction', project_type: 'nonfiction' };

describe('Weak Nonfiction Heading/Citation Stress — Structure Detection', () => {
  it('1. detects markdown headings in weak nonfiction', () => {
    const count = detectMarkdownHeadings(WEAK_NF);
    assert.ok(count >= 3, `Expected ≥3 markdown headings, got ${count}`);
  });

  it('2. detects citations in weak nonfiction', () => {
    const citationPattern = /\([^)]*\d{4}[^)]*\)/g;
    const citations = (WEAK_NF.match(citationPattern) || []).length;
    assert.ok(citations >= 2, `Expected ≥2 citations, got ${citations}`);
  });

  it('3. detects filter verbs in weak nonfiction', () => {
    const FILTER_VERBS_RE = /\b(?:felt|realized|noticed|watched|seemed|wondered|understood)\b/gi;
    const matches = (WEAK_NF.match(FILTER_VERBS_RE) || []).length;
    assert.ok(matches >= 3, `Expected ≥3 filter verbs, got ${matches}`);
  });

  it('4. detects essay-bot transitions in weak nonfiction', () => {
    const ESSAY_BOT = /\b(?:Moreover|Furthermore|Additionally|It is important to note)\b/g;
    const matches = (WEAK_NF.match(ESSAY_BOT) || []).length;
    assert.ok(matches >= 3, `Expected ≥3 essay-bot transitions, got ${matches}`);
  });
});

describe('Weak Nonfiction Heading/Citation Stress — Routing', () => {
  it('5. routes weak nonfiction to prose-recast-polisher', () => {
    const chunk = { text: WEAK_NF };
    const metrics = analyzeProseTexture(WEAK_NF);
    const result = chooseRecastModel(nonfictionProfile, chunk, metrics);
    assert.equal(result.model, 'prose-recast-polisher');
  });

  it('6. routing reason includes nonfiction_authority', () => {
    const chunk = { text: WEAK_NF };
    const metrics = analyzeProseTexture(WEAK_NF);
    const result = chooseRecastModel(nonfictionProfile, chunk, metrics);
    assert.ok(result.reason.includes('nonfiction_authority'), `Expected nonfiction_authority, got ${result.reason}`);
  });

  it('7. detects citation_bearing weakness type', () => {
    const chunk = { text: WEAK_NF };
    const metrics = analyzeProseTexture(WEAK_NF);
    const weakness = detectRecastWeaknessTypes(chunk, metrics, nonfictionProfile);
    assert.ok(weakness.hasCitations, 'Should detect citations');
    assert.ok(weakness.types.includes('citation_bearing'), `Should include citation_bearing, got: ${weakness.types}`);
  });

  it('8. detects heading_bearing weakness type for nonfiction', () => {
    const chunk = { text: WEAK_NF };
    const metrics = analyzeProseTexture(WEAK_NF);
    const weakness = detectRecastWeaknessTypes(chunk, metrics, nonfictionProfile);
    assert.ok(weakness.hasHeadings, 'Should detect headings');
    assert.ok(weakness.types.includes('heading_bearing'), `Should include heading_bearing, got: ${weakness.types}`);
  });

  it('9. structureRisk is high for citation/heading-bearing nonfiction', () => {
    const chunk = { text: WEAK_NF };
    const metrics = analyzeProseTexture(WEAK_NF);
    const weakness = detectRecastWeaknessTypes(chunk, metrics, nonfictionProfile);
    assert.equal(weakness.structureRisk, 'high');
  });

  it('10. detects essay_bot_transitions for nonfiction', () => {
    const chunk = { text: WEAK_NF };
    const metrics = analyzeProseTexture(WEAK_NF);
    const weakness = detectRecastWeaknessTypes(chunk, metrics, nonfictionProfile);
    assert.ok(weakness.types.includes('essay_bot_transitions'), `Expected essay_bot_transitions, got: ${weakness.types}`);
  });
});

describe('Weak Nonfiction Heading/Citation Stress — Protection & Eligibility', () => {
  it('11. citation-bearing chunks are detected as protected', () => {
    // Use text with a simple author-year citation that matches hasCitations() regex
    const citText = `The consequences of this neglect were deeply felt across communities. Blood lead levels in children under six rose by 2.4 percentage points between 2013 and 2015 in the most affected zip codes (Smith, 2016). It is important to note that this was not an isolated case. Municipal water systems serving communities with populations under 50,000 face disproportionate challenges across the country.`;
    const metrics = analyzeProseTexture(citText);
    const protection = detectProtections(citText, metrics.compositeScore, 95);
    assert.ok(protection.protected, 'Citation-bearing chunk should be protected');
    assert.ok(protection.reasons.includes('citation'), `Should include citation reason, got: ${protection.reasons}`);
  });

  it('12. nonfiction profile has recastEligible = true', () => {
    const rules = getAntiChatbotRulesForProject(nonfictionProfile);
    assert.ok(rules.recastEligible !== false, 'Nonfiction should be recast-eligible');
  });

  it('13. profile resolves to nonfiction profileKey', () => {
    const rules = getAntiChatbotRulesForProject(nonfictionProfile);
    assert.equal(rules.profileKey, 'nonfiction');
  });
});

describe('Weak Nonfiction Heading/Citation Stress — Heading Preservation', () => {
  it('14. heading preservation rejects heading loss in nonfiction', () => {
    const original = '## Section A\n\nParagraph.\n\n## Section B\n\nParagraph.';
    const recast = 'Section A\n\nParagraph.\n\n## Section B\n\nParagraph.';
    const result = validateHeadingPreservation(original, recast, nonfictionProfile);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('Heading loss'));
  });

  it('15. heading preservation accepts same heading count in nonfiction', () => {
    const original = '## Section A\n\nParagraph.\n\n## Section B\n\nParagraph.';
    const recast = '## Section A\n\nRewritten.\n\n## Section B\n\nRewritten.';
    const result = validateHeadingPreservation(original, recast, nonfictionProfile);
    assert.equal(result.ok, true);
  });

  it('16. heading preservation counts correctly for weak nonfiction sample', () => {
    const result = validateHeadingPreservation(WEAK_NF, WEAK_NF, nonfictionProfile);
    assert.equal(result.ok, true);
    assert.ok(result.originalCount >= 3, `Expected ≥3 headings, got ${result.originalCount}`);
    assert.equal(result.originalCount, result.recastCount);
  });

  it('17. heading preservation rejects recast that drops 1 heading', () => {
    const reduced = WEAK_NF.replace('## Structural Barriers to Reform', 'Structural Barriers to Reform');
    const result = validateHeadingPreservation(WEAK_NF, reduced, nonfictionProfile);
    assert.equal(result.ok, false);
  });
});
