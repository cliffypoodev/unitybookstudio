import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECAST_MODELS,
  chooseRecastModel,
  detectRecastWeaknessTypes,
  DEFAULT_RECAST_MODEL,
} from '../src/lib/recastModelRouting.js';
import { analyzeProseTexture } from '../src/lib/antiChatbotProse.js';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Generate a mock prose chunk of at least 120 words. */
function makeChunk(extra = '') {
  const base = `The rain hammered the windshield as Marcus turned off the highway onto a gravel road
that led nowhere good. His headlights carved a narrow tunnel through the darkness, illuminating
fence posts and scrub brush bent sideways by the wind. The GPS had died twenty minutes ago.
He pulled to the shoulder, killed the engine, and sat listening to the ticking of hot metal.
Somewhere beyond the tree line a dog barked twice and stopped. The silence after was worse
than the barking. He checked his phone: no signal. The envelope on the passenger seat was
still sealed. He had driven four hundred miles to deliver it and now he could not find the
address. The irony did not escape him but he was too tired to appreciate it. He stepped out
into the rain and walked toward the only light he could see. ${extra}`;
  return { text: base };
}

/** Build mock metrics that look like analyzeProseTexture output. */
function mockMetrics(overrides = {}) {
  return {
    sentenceLengthVariance: 8.5,
    symmetryScore: 25,
    filterVerbDensity: 3.0,
    concreteRatio: 60,
    openingVerbStrength: 'strong',
    endingPunch: true,
    tripleConstructionDensity: 2.0,
    thesisStatementDensity: 0,
    notJustDensity: 0,
    balancedReflectionCount: 0,
    genericEmotionDensity: 1.0,
    compositeScore: 65,
    grade: 'COMPETENT',
    diagnostics: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('RECAST_MODELS registry', () => {
  it('has prose-recast-polisher entry', () => {
    assert.ok(RECAST_MODELS['prose-recast-polisher'], 'missing prose-recast-polisher');
    assert.equal(RECAST_MODELS['prose-recast-polisher'].name, 'prose-recast-polisher');
  });

  it('has prose-polisher entry', () => {
    assert.ok(RECAST_MODELS['prose-polisher'], 'missing prose-polisher');
    assert.equal(RECAST_MODELS['prose-polisher'].name, 'prose-polisher');
  });

  it('prose-recast-polisher temperature is 0.4', () => {
    assert.equal(RECAST_MODELS['prose-recast-polisher'].temperature, 0.4);
  });

  it('prose-polisher temperature is 0.55', () => {
    assert.equal(RECAST_MODELS['prose-polisher'].temperature, 0.55);
  });
});

describe('chooseRecastModel — profile routing', () => {
  const chunk = makeChunk();
  const metrics = mockMetrics();

  it('nonfiction → prose-recast-polisher with nonfiction reason', () => {
    const result = chooseRecastModel({ genre: 'nonfiction', book_type: 'nonfiction' }, chunk, metrics);
    assert.equal(result.model, 'prose-recast-polisher');
    assert.ok(result.reason.includes('nonfiction'), `reason should mention nonfiction, got: ${result.reason}`);
  });

  it('training_manual → prose-recast-polisher', () => {
    const result = chooseRecastModel({ book_type: 'training_manual' }, chunk, metrics);
    assert.equal(result.model, 'prose-recast-polisher');
  });

  it('business_guide → prose-recast-polisher', () => {
    const result = chooseRecastModel({ project_type: 'business_guide' }, chunk, metrics);
    assert.equal(result.model, 'prose-recast-polisher');
  });

  it('literary → prose-polisher with literary reason', () => {
    const result = chooseRecastModel({ genre: 'fiction', subgenre: 'literary', book_type: 'fiction' }, chunk, metrics);
    assert.equal(result.model, 'prose-polisher');
    assert.ok(result.reason.includes('literary'), `reason should mention literary, got: ${result.reason}`);
  });

  it('memoir → prose-polisher', () => {
    const result = chooseRecastModel({ genre: 'memoir' }, chunk, metrics);
    assert.equal(result.model, 'prose-polisher');
  });

  it('thriller → prose-recast-polisher with general reason', () => {
    const result = chooseRecastModel({ genre: 'thriller', book_type: 'fiction' }, chunk, metrics);
    assert.equal(result.model, 'prose-recast-polisher');
    assert.ok(result.reason.includes('general'), `reason should mention general, got: ${result.reason}`);
  });

  it('fiction → prose-recast-polisher', () => {
    const result = chooseRecastModel({ genre: 'fiction', book_type: 'fiction' }, chunk, metrics);
    assert.equal(result.model, 'prose-recast-polisher');
  });
});

describe('chooseRecastModel — overrides and weakness routing', () => {
  const chunk = makeChunk();

  it('forceModel overrides nonfiction routing', () => {
    const metrics = mockMetrics();
    const result = chooseRecastModel(
      { genre: 'nonfiction', book_type: 'nonfiction' },
      chunk,
      metrics,
      { forceModel: 'prose-polisher' },
    );
    assert.equal(result.model, 'prose-polisher');
  });

  it('fiction with filterVerbDensity > 10 → prose-recast-polisher with filter_verb reason', () => {
    const metrics = mockMetrics({ filterVerbDensity: 12.0 });
    const result = chooseRecastModel({ genre: 'fiction', book_type: 'fiction' }, chunk, metrics);
    assert.equal(result.model, 'prose-recast-polisher');
    assert.ok(result.reason.includes('filter_verb'), `reason should mention filter_verb, got: ${result.reason}`);
  });

  it('literary with citations → prose-recast-polisher with citation reason', () => {
    const citationChunk = makeChunk('According to the study (Hernandez, 2026), the results were clear.');
    const metrics = mockMetrics();
    const result = chooseRecastModel(
      { genre: 'fiction', subgenre: 'literary', book_type: 'fiction' },
      citationChunk,
      metrics,
    );
    assert.equal(result.model, 'prose-recast-polisher');
    assert.ok(result.reason.includes('citation'), `reason should mention citation, got: ${result.reason}`);
  });
});

describe('detectRecastWeaknessTypes', () => {
  it('detects filter_verb_heavy when filterVerbDensity > 8', () => {
    const chunk = makeChunk();
    const metrics = mockMetrics({ filterVerbDensity: 9.5 });
    const result = detectRecastWeaknessTypes(chunk, metrics, { genre: 'fiction', book_type: 'fiction' });
    assert.ok(result.types.includes('filter_verb_heavy'), `should detect filter_verb_heavy, got: ${result.types}`);
  });

  it('detects thesis_statements when thesisStatementDensity > 0', () => {
    const chunk = makeChunk();
    const metrics = mockMetrics({ thesisStatementDensity: 1.5 });
    const result = detectRecastWeaknessTypes(chunk, metrics, { genre: 'fiction', book_type: 'fiction' });
    assert.ok(result.types.includes('thesis_statements'), `should detect thesis_statements, got: ${result.types}`);
  });

  it('detects weak_opening', () => {
    const chunk = makeChunk();
    const metrics = mockMetrics({ openingVerbStrength: 'weak' });
    const result = detectRecastWeaknessTypes(chunk, metrics, { genre: 'fiction', book_type: 'fiction' });
    assert.ok(result.types.includes('weak_opening'), `should detect weak_opening, got: ${result.types}`);
  });

  it('returns structureRisk = high when citations present', () => {
    const citationChunk = makeChunk('This was confirmed by the evidence (Hernandez, 2026).');
    const metrics = mockMetrics();
    const result = detectRecastWeaknessTypes(citationChunk, metrics, { genre: 'fiction', book_type: 'fiction' });
    assert.equal(result.structureRisk, 'high');
    assert.equal(result.hasCitations, true);
  });

  it('returns voiceRisk = high for literary', () => {
    const chunk = makeChunk();
    const metrics = mockMetrics();
    const result = detectRecastWeaknessTypes(chunk, metrics, { genre: 'fiction', subgenre: 'literary', book_type: 'fiction' });
    assert.equal(result.voiceRisk, 'high');
  });
});

describe('chooseRecastModel — result shape', () => {
  it('result includes all required fields', () => {
    const chunk = makeChunk();
    const metrics = mockMetrics();
    const result = chooseRecastModel({ genre: 'fiction', book_type: 'fiction' }, chunk, metrics);

    assert.ok(typeof result.model === 'string', 'model should be a string');
    assert.ok(typeof result.temperature === 'number', 'temperature should be a number');
    assert.ok(typeof result.reason === 'string', 'reason should be a string');
    assert.ok(Array.isArray(result.weaknesses), 'weaknesses should be an array');
    assert.ok(typeof result.profileKey === 'string', 'profileKey should be a string');
    assert.ok(typeof result.structureRisk === 'string', 'structureRisk should be a string');
    assert.ok(typeof result.voiceRisk === 'string', 'voiceRisk should be a string');
  });
});
