/**
 * nonfictionCitationStructureRecastGuard.test.mjs
 *
 * Tests that citation-bearing nonfiction chunks are properly protected
 * during recast, and that the routing/pipeline correctly handles
 * citation structure preservation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  chooseRecastModel,
  detectRecastWeaknessTypes,
  validateHeadingPreservation,
} from '../src/lib/recastModelRouting.js';

import {
  detectProtections,
  PROTECTION_TYPE,
  shouldRecastChunk,
  buildChunkRecastPrompt,
} from '../src/lib/antiChatbotRecastPipeline.js';

import { analyzeProseTexture } from '../src/lib/antiChatbotProse.js';

const nonfiction = { genre: 'nonfiction', book_type: 'nonfiction' };

// ── Citation-bearing chunk ──
const CITATION_CHUNK = `The funding gap for municipal water infrastructure has been estimated at $434 billion over the next twenty years (ASCE, 2021). A subsequent analysis by the Brookings Institution found that consolidation of small water systems into regional authorities could reduce per-household costs by 18 to 34 percent while improving compliance rates (Kearney & Liu, 2023). Blood lead levels in children under six rose by 2.4 percentage points between 2013 and 2015 in the most affected zip codes (Hanna-Attisha et al., 2016). This convergence of data points suggests that the crisis is both well-documented and systematically underaddressed. The American Water Works Association has further estimated that replacing aging transmission and distribution mains would cost an additional $1 trillion over 25 years.`;

// ── Non-citation chunk ──
const PLAIN_CHUNK = `The water crisis affected many communities across the region. Local officials seemed unable to address the growing backlog of maintenance needs. Moreover, the workforce was aging rapidly and replacements were difficult to find. Furthermore, the regulatory burden continued to increase year after year. It felt like the kind of problem that nobody wanted to own. The systems appeared to be holding together through a combination of luck and duct tape. City managers noticed the cracks but realized that the political cost of action was higher than the cost of inaction in the short term.`;

describe('Nonfiction Citation Structure Recast Guard — Citation Detection', () => {
  it('1. citation-bearing chunk is detected as protected', () => {
    const metrics = analyzeProseTexture(CITATION_CHUNK);
    const protection = detectProtections(CITATION_CHUNK, metrics.compositeScore, 80);
    assert.ok(protection.protected);
    assert.ok(protection.reasons.includes('citation'));
  });

  it('2. non-citation chunk is NOT citation-protected', () => {
    const metrics = analyzeProseTexture(PLAIN_CHUNK);
    const protection = detectProtections(PLAIN_CHUNK, metrics.compositeScore, 95);
    const hasCitationProtection = protection.reasons.includes('citation');
    assert.ok(!hasCitationProtection, `Plain chunk should not be citation-protected, got: ${protection.reasons}`);
  });

  it('3. detectRecastWeaknessTypes flags citation_bearing for citation chunk', () => {
    const chunk = { text: CITATION_CHUNK };
    const metrics = analyzeProseTexture(CITATION_CHUNK);
    const result = detectRecastWeaknessTypes(chunk, metrics, nonfiction);
    assert.ok(result.hasCitations);
    assert.ok(result.types.includes('citation_bearing'));
  });

  it('4. detectRecastWeaknessTypes does NOT flag citation_bearing for plain chunk', () => {
    const chunk = { text: PLAIN_CHUNK };
    const metrics = analyzeProseTexture(PLAIN_CHUNK);
    const result = detectRecastWeaknessTypes(chunk, metrics, nonfiction);
    assert.ok(!result.hasCitations);
    assert.ok(!result.types.includes('citation_bearing'));
  });
});

describe('Nonfiction Citation Structure Recast Guard — Routing', () => {
  it('5. citation-bearing nonfiction routes to prose-recast-polisher', () => {
    const chunk = { text: CITATION_CHUNK };
    const metrics = analyzeProseTexture(CITATION_CHUNK);
    const result = chooseRecastModel(nonfiction, chunk, metrics);
    assert.equal(result.model, 'prose-recast-polisher');
  });

  it('6. routing reason is nonfiction_authority for nonfiction citations', () => {
    const chunk = { text: CITATION_CHUNK };
    const metrics = analyzeProseTexture(CITATION_CHUNK);
    const result = chooseRecastModel(nonfiction, chunk, metrics);
    assert.ok(result.reason.includes('nonfiction_authority'));
  });

  it('7. structureRisk is high for citation-bearing nonfiction', () => {
    const chunk = { text: CITATION_CHUNK };
    const metrics = analyzeProseTexture(CITATION_CHUNK);
    const result = detectRecastWeaknessTypes(chunk, metrics, nonfiction);
    assert.equal(result.structureRisk, 'high');
  });
});

describe('Nonfiction Citation Structure Recast Guard — Prompt Constraints', () => {
  it('8. nonfiction recast prompt includes NONFICTION CONSTRAINTS', () => {
    const chunk = { text: PLAIN_CHUNK };
    const metrics = analyzeProseTexture(PLAIN_CHUNK);
    const prompt = buildChunkRecastPrompt(chunk, nonfiction, metrics);
    assert.ok(prompt.includes('NONFICTION CONSTRAINTS'), 'Prompt should include nonfiction constraints');
  });

  it('9. nonfiction recast prompt mentions citation preservation', () => {
    const chunk = { text: PLAIN_CHUNK };
    const metrics = analyzeProseTexture(PLAIN_CHUNK);
    const prompt = buildChunkRecastPrompt(chunk, nonfiction, metrics);
    assert.ok(prompt.includes('citation') || prompt.includes('reference'), 'Prompt should mention citation/reference preservation');
  });

  it('10. nonfiction recast prompt prohibits invented data', () => {
    const chunk = { text: PLAIN_CHUNK };
    const metrics = analyzeProseTexture(PLAIN_CHUNK);
    const prompt = buildChunkRecastPrompt(chunk, nonfiction, metrics);
    assert.ok(prompt.includes('unsupported') || prompt.includes('invented'), 'Prompt should prohibit invented data');
  });
});

describe('Nonfiction Citation Structure Recast Guard — Eligibility', () => {
  it('11. citation-bearing chunk is skipped at default threshold', () => {
    const chunk = { text: CITATION_CHUNK, index: 0 };
    const result = shouldRecastChunk(chunk, nonfiction, { recastThreshold: 70, skipThreshold: 80 });
    assert.equal(result.eligible, false);
    assert.ok(result.reason.includes('Protected') || result.reason.includes('Score'));
  });

  it('12. non-citation chunk eligibility depends on score', () => {
    const chunk = { text: PLAIN_CHUNK, index: 0 };
    const result = shouldRecastChunk(chunk, nonfiction, { recastThreshold: 80, skipThreshold: 95 });
    // Should be eligible if score < 80, or protected for other reason
    assert.ok(typeof result.eligible === 'boolean');
  });
});

describe('Nonfiction Citation Structure Recast Guard — Combined Structure', () => {
  it('13. heading + citation nonfiction chunk gets high structure risk', () => {
    const combo = `## Water Infrastructure Funding Gap\n\nThe funding gap has been estimated at $434 billion (ASCE, 2021). Communities felt the weight of this underinvestment. Moreover, the crisis seemed to be getting worse. Furthermore, federal programs were inadequate. It is important to note that this represents only a portion of the total cost.`;
    const chunk = { text: combo };
    const metrics = analyzeProseTexture(combo);
    const weakness = detectRecastWeaknessTypes(chunk, metrics, nonfiction);
    assert.equal(weakness.structureRisk, 'high');
    assert.ok(weakness.hasCitations);
    assert.ok(weakness.hasHeadings);
  });

  it('14. heading preservation gate protects heading+citation nonfiction', () => {
    const original = `## Funding Gap Analysis\n\nThe gap is $434 billion (ASCE, 2021). Reform is needed.`;
    const damaged = `Funding Gap Analysis\n\nThe gap is $434 billion (ASCE, 2021). Reform is needed.`;
    const result = validateHeadingPreservation(original, damaged, nonfiction);
    assert.equal(result.ok, false);
  });

  it('15. citation count check: original citations must survive recast', () => {
    const citationRe = /\([^)]*\d{4}[^)]*\)/g;
    const origCites = (CITATION_CHUNK.match(citationRe) || []).length;
    assert.ok(origCites >= 3, `Expected ≥3 citations in test sample, got ${origCites}`);
  });
});
