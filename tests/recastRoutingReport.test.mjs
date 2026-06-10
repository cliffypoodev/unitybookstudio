import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildRecastModelRoutingReport } from '../src/lib/recastModelRouting.js';

// ── Tests ─────────────────────────────────────────────────────────────────

describe('buildRecastModelRoutingReport', () => {
  it('empty array → totalChunks: 0, routedChunks: 0', () => {
    const result = buildRecastModelRoutingReport([]);
    assert.equal(result.totalChunks, 0);
    assert.equal(result.routedChunks, 0);
  });

  it('2 chunks using prose-recast-polisher → correct modelDistribution', () => {
    const reports = [
      { selectedModel: 'prose-recast-polisher', weaknessTypes: ['filter_verb_heavy'] },
      { selectedModel: 'prose-recast-polisher', weaknessTypes: ['weak_opening'] },
    ];
    const result = buildRecastModelRoutingReport(reports);
    assert.deepEqual(result.modelDistribution, { 'prose-recast-polisher': 2 });
  });

  it('mixed models → correct distribution', () => {
    const reports = [
      { selectedModel: 'prose-recast-polisher', weaknessTypes: [] },
      { selectedModel: 'prose-polisher', weaknessTypes: [] },
      { selectedModel: 'prose-recast-polisher', weaknessTypes: [] },
    ];
    const result = buildRecastModelRoutingReport(reports);
    assert.equal(result.modelDistribution['prose-recast-polisher'], 2);
    assert.equal(result.modelDistribution['prose-polisher'], 1);
  });

  it('counts weakness types across all chunks', () => {
    const reports = [
      { selectedModel: 'prose-recast-polisher', weaknessTypes: ['filter_verb_heavy', 'weak_opening'] },
      { selectedModel: 'prose-polisher', weaknessTypes: ['weak_opening', 'soft_ending'] },
    ];
    const result = buildRecastModelRoutingReport(reports);
    assert.equal(result.weaknessDistribution['filter_verb_heavy'], 1);
    assert.equal(result.weaknessDistribution['weak_opening'], 2);
    assert.equal(result.weaknessDistribution['soft_ending'], 1);
  });

  it('ignores chunks with no selectedModel', () => {
    const reports = [
      { selectedModel: 'prose-recast-polisher', weaknessTypes: ['filter_verb_heavy'] },
      { weaknessTypes: ['weak_opening'] },   // no selectedModel
      { selectedModel: undefined, weaknessTypes: [] },
    ];
    const result = buildRecastModelRoutingReport(reports);
    assert.equal(result.routedChunks, 1);
    assert.equal(result.totalChunks, 3);
  });

  it('report includes totalChunks field', () => {
    const reports = [
      { selectedModel: 'prose-recast-polisher', weaknessTypes: [] },
      { selectedModel: 'prose-polisher', weaknessTypes: [] },
    ];
    const result = buildRecastModelRoutingReport(reports);
    assert.equal(result.totalChunks, 2);
  });

  it('report includes routedChunks field', () => {
    const reports = [
      { selectedModel: 'prose-recast-polisher', weaknessTypes: [] },
      { selectedModel: 'prose-polisher', weaknessTypes: [] },
    ];
    const result = buildRecastModelRoutingReport(reports);
    assert.equal(result.routedChunks, 2);
  });

  it('modelDistribution is an object', () => {
    const result = buildRecastModelRoutingReport([]);
    assert.ok(typeof result.modelDistribution === 'object');
    assert.ok(!Array.isArray(result.modelDistribution));
  });

  it('weaknessDistribution is an object', () => {
    const result = buildRecastModelRoutingReport([]);
    assert.ok(typeof result.weaknessDistribution === 'object');
    assert.ok(!Array.isArray(result.weaknessDistribution));
  });

  it('null/undefined entries do not crash', () => {
    const reports = [null, undefined, { selectedModel: 'prose-recast-polisher', weaknessTypes: [] }];
    const result = buildRecastModelRoutingReport(reports);
    assert.equal(result.totalChunks, 3);
    assert.equal(result.routedChunks, 1);
  });
});
