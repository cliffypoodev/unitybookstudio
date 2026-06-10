import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateLiteraryRecast } from '../src/lib/recastModelRouting.js';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Build a mock metrics object for validateLiteraryRecast. */
function makeMetrics(overrides = {}) {
  return {
    compositeScore: 65,
    sentenceLengthVariance: 8.5,
    concreteRatio: 60,
    endingPunch: true,
    ...overrides,
  };
}

// ── Literary profile tests ───────────────────────────────────────────────

describe('validateLiteraryRecast — literary profile', () => {
  it('flat composite (65→65) → ok: false, reason includes flat_score', () => {
    const before = makeMetrics({ compositeScore: 65 });
    const after = makeMetrics({ compositeScore: 65 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'literary' });
    assert.equal(result.ok, false);
    assert.ok(result.reason.includes('flat_score'), `reason should include flat_score, got: ${result.reason}`);
  });

  it('improved composite (65→70) → ok: true', () => {
    const before = makeMetrics({ compositeScore: 65 });
    const after = makeMetrics({ compositeScore: 70 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'literary' });
    assert.equal(result.ok, true);
  });

  it('decreased composite (65→60) → ok: false', () => {
    const before = makeMetrics({ compositeScore: 65 });
    const after = makeMetrics({ compositeScore: 60 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'literary' });
    assert.equal(result.ok, false);
  });

  it('sentenceLengthVariance drops > 1.0 (8.5→7.0) with improved composite → ok: false, reason includes variance', () => {
    const before = makeMetrics({ compositeScore: 65, sentenceLengthVariance: 8.5 });
    const after = makeMetrics({ compositeScore: 70, sentenceLengthVariance: 7.0 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'literary' });
    assert.equal(result.ok, false);
    assert.ok(result.reason.includes('variance'), `reason should include variance, got: ${result.reason}`);
  });

  it('sentenceLengthVariance drops < 1.0 (8.5→8.0) with improved composite → ok: true', () => {
    const before = makeMetrics({ compositeScore: 65, sentenceLengthVariance: 8.5 });
    const after = makeMetrics({ compositeScore: 70, sentenceLengthVariance: 8.0 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'literary' });
    assert.equal(result.ok, true);
  });

  it('concreteRatio drops > 5% (60→54) with improved composite → ok: false, reason includes concrete', () => {
    const before = makeMetrics({ compositeScore: 65, concreteRatio: 60 });
    const after = makeMetrics({ compositeScore: 70, concreteRatio: 54 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'literary' });
    assert.equal(result.ok, false);
    assert.ok(result.reason.includes('concrete'), `reason should include concrete, got: ${result.reason}`);
  });

  it('concreteRatio drops ≤5% (60→56) with improved composite → ok: true', () => {
    const before = makeMetrics({ compositeScore: 65, concreteRatio: 60 });
    const after = makeMetrics({ compositeScore: 70, concreteRatio: 56 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'literary' });
    assert.equal(result.ok, true);
  });

  it('endingPunch true→false with improved composite → ok: false, reason includes ending', () => {
    const before = makeMetrics({ compositeScore: 65, endingPunch: true });
    const after = makeMetrics({ compositeScore: 70, endingPunch: false });
    const result = validateLiteraryRecast(before, after, { profileKey: 'literary' });
    assert.equal(result.ok, false);
    assert.ok(result.reason.includes('ending'), `reason should include ending, got: ${result.reason}`);
  });

  it('endingPunch false→true with improved composite → ok: true', () => {
    const before = makeMetrics({ compositeScore: 65, endingPunch: false });
    const after = makeMetrics({ compositeScore: 70, endingPunch: true });
    const result = validateLiteraryRecast(before, after, { profileKey: 'literary' });
    assert.equal(result.ok, true);
  });
});

// ── Non-literary profiles bypass the guard ────────────────────────────────

describe('validateLiteraryRecast — non-literary profiles', () => {
  it('nonfiction: flat composite → ok: true (guard does not apply)', () => {
    const before = makeMetrics({ compositeScore: 65 });
    const after = makeMetrics({ compositeScore: 65 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'nonfiction' });
    assert.equal(result.ok, true);
  });

  it('thriller: flat composite → ok: true (guard does not apply)', () => {
    const before = makeMetrics({ compositeScore: 65 });
    const after = makeMetrics({ compositeScore: 65 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'thriller' });
    assert.equal(result.ok, true);
  });
});

// ── Memoir uses literary guard ───────────────────────────────────────────

describe('validateLiteraryRecast — memoir profile', () => {
  it('memoir: flat composite → ok: false', () => {
    const before = makeMetrics({ compositeScore: 65 });
    const after = makeMetrics({ compositeScore: 65 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'memoir' });
    assert.equal(result.ok, false);
  });

  it('memoir: improved composite → ok: true', () => {
    const before = makeMetrics({ compositeScore: 65 });
    const after = makeMetrics({ compositeScore: 72 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'memoir' });
    assert.equal(result.ok, true);
  });
});

// ── Result shape ─────────────────────────────────────────────────────────

describe('validateLiteraryRecast — result shape', () => {
  it('result includes beforeScore and afterScore', () => {
    const before = makeMetrics({ compositeScore: 65 });
    const after = makeMetrics({ compositeScore: 70 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'literary' });
    assert.equal(result.beforeScore, 65);
    assert.equal(result.afterScore, 70);
  });

  it('result includes flatteningDetails for rejections', () => {
    const before = makeMetrics({ compositeScore: 65 });
    const after = makeMetrics({ compositeScore: 65 });
    const result = validateLiteraryRecast(before, after, { profileKey: 'literary' });
    assert.equal(result.ok, false);
    assert.ok(result.flatteningDetails !== null, 'flatteningDetails should be present on rejection');
    assert.ok(typeof result.flatteningDetails === 'object');
    assert.equal(result.flatteningDetails.type, 'flat_score');
  });
});
