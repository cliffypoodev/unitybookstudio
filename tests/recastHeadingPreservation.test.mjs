import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectMarkdownHeadings,
  detectSectionHeadings,
  validateHeadingPreservation,
} from '../src/lib/recastModelRouting.js';

// ── Profile objects ──────────────────────────────────────────────────────

const nonfiction = { genre: 'nonfiction', book_type: 'nonfiction' };
const thriller = { genre: 'thriller', book_type: 'fiction' };
const fiction = { genre: 'fiction', book_type: 'fiction' };
const businessGuide = { project_type: 'business_guide' };

// ── detectMarkdownHeadings tests ─────────────────────────────────────────

describe('detectMarkdownHeadings', () => {
  it('returns 1 for a single # heading', () => {
    assert.equal(detectMarkdownHeadings('# Title'), 1);
  });

  it('returns 2 for two markdown headings at different levels', () => {
    const text = '## Subtitle\n\nSome body text here.\n\n### Sub-sub heading';
    assert.equal(detectMarkdownHeadings(text), 2);
  });

  it('returns 0 for text without headings', () => {
    assert.equal(detectMarkdownHeadings('No headings here, just plain paragraph text.'), 0);
  });
});

// ── detectSectionHeadings tests ──────────────────────────────────────────

describe('detectSectionHeadings', () => {
  it('returns 1 for an ALL-CAPS line', () => {
    const text = 'ALL CAPS HEADING\n\nNormal text follows here.';
    assert.equal(detectSectionHeadings(text), 1);
  });

  it('returns 1 for a bold heading **Bold Heading**', () => {
    const text = '**Bold Heading**\n\nSome regular text.';
    assert.equal(detectSectionHeadings(text), 1);
  });

  it('returns 0 for text without special headings', () => {
    assert.equal(detectSectionHeadings('No special headings in this paragraph at all.'), 0);
  });
});

// ── validateHeadingPreservation tests ────────────────────────────────────

describe('validateHeadingPreservation', () => {
  it('nonfiction: heading loss → ok: false', () => {
    const original = '## Chapter One\n\nParagraph.\n\n## Chapter Two\n\nMore text.';
    const recast = '## Chapter One\n\nParagraph. More text combined.';
    const result = validateHeadingPreservation(original, recast, nonfiction);
    assert.equal(result.ok, false);
    assert.equal(result.originalCount, 2);
    assert.equal(result.recastCount, 1);
  });

  it('nonfiction: both have same heading count → ok: true', () => {
    const original = '## Section A\n\nText.\n\n## Section B\n\nText.';
    const recast = '## Section A\n\nRevised text.\n\n## Section B\n\nRevised text.';
    const result = validateHeadingPreservation(original, recast, nonfiction);
    assert.equal(result.ok, true);
  });

  it('nonfiction: recast has MORE headings → ok: true', () => {
    const original = '## Section A\n\nText about things.';
    const recast = '## Section A\n\nText.\n\n## Section B\n\nMore text.';
    const result = validateHeadingPreservation(original, recast, nonfiction);
    assert.equal(result.ok, true);
    assert.ok(result.recastCount >= result.originalCount);
  });

  it('fiction: heading loss → ok: true (fiction does not gate)', () => {
    const original = '## Chapter One\n\nText.\n\n## Chapter Two\n\nText.';
    const recast = '## Chapter One\n\nAll text combined.';
    const result = validateHeadingPreservation(original, recast, fiction);
    assert.equal(result.ok, true);
  });

  it('thriller: heading loss → ok: true (thriller does not gate)', () => {
    const original = '## Scene 1\n\nAction.\n\n## Scene 2\n\nMore action.';
    const recast = '## Scene 1\n\nAll action combined.';
    const result = validateHeadingPreservation(original, recast, thriller);
    assert.equal(result.ok, true);
  });

  it('both have 0 headings → ok: true', () => {
    const original = 'Just a paragraph with no headings at all.';
    const recast = 'A revised paragraph with no headings at all.';
    const result = validateHeadingPreservation(original, recast, nonfiction);
    assert.equal(result.ok, true);
    assert.equal(result.originalCount, 0);
    assert.equal(result.recastCount, 0);
  });

  it('result includes originalCount and recastCount', () => {
    const original = '# Title\n\nBody text.';
    const recast = '# Title\n\nRevised body text.';
    const result = validateHeadingPreservation(original, recast, nonfiction);
    assert.ok('originalCount' in result, 'result should have originalCount');
    assert.ok('recastCount' in result, 'result should have recastCount');
    assert.ok(typeof result.originalCount === 'number');
    assert.ok(typeof result.recastCount === 'number');
  });

  it('error message mentions heading count for nonfiction rejection', () => {
    const original = '## A\n\nText.\n\n## B\n\nText.\n\n## C\n\nText.';
    const recast = '## A\n\nCombined text.';
    const result = validateHeadingPreservation(original, recast, nonfiction);
    assert.equal(result.ok, false);
    assert.ok(result.error !== null);
    assert.ok(result.error.includes('Heading'), `error should mention 'Heading', got: ${result.error}`);
    assert.ok(result.error.includes('3'), `error should mention original count 3, got: ${result.error}`);
    assert.ok(result.error.includes('1'), `error should mention recast count 1, got: ${result.error}`);
  });

  it('business_guide: heading loss → ok: false', () => {
    const original = '## Strategy\n\nDetails.\n\n## Execution\n\nMore details.';
    const recast = '## Strategy\n\nAll combined.';
    const result = validateHeadingPreservation(original, recast, businessGuide);
    assert.equal(result.ok, false);
  });
});
