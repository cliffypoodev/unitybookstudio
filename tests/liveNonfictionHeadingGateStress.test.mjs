/**
 * liveNonfictionHeadingGateStress.test.mjs
 *
 * Tests that the heading preservation gate correctly blocks recasts
 * that lose headings in nonfiction, and correctly passes recasts
 * that preserve headings.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateHeadingPreservation,
  detectMarkdownHeadings,
  detectSectionHeadings,
  chooseRecastModel,
} from '../src/lib/recastModelRouting.js';

const nonfiction = { genre: 'nonfiction', book_type: 'nonfiction' };
const business = { genre: 'nonfiction', book_type: 'nonfiction', project_type: 'business_guide' };
const training = { book_type: 'training_manual' };
const fiction = { genre: 'thriller', book_type: 'fiction' };

// ── Samples ──
const ORIGINAL_WITH_HEADINGS = `## Introduction

The water crisis in American cities has reached a critical point. Municipal systems installed between 1920 and 1960 are failing at accelerating rates. Maintenance budgets have been cut repeatedly over the past three decades.

## Root Causes

Three factors drive the crisis. First, deferred maintenance has created a backlog estimated at $434 billion (ASCE, 2021). Second, the workforce is aging out. Third, regulatory costs consume operational budgets.

## Proposed Solutions

Consolidation of small water systems into regional authorities could reduce per-household costs by 18 to 34 percent while improving compliance rates (Kearney & Liu, 2023). Federal investment must increase substantially.`;

const RECAST_PRESERVED = `## Introduction

American cities face a water infrastructure crisis that demands immediate attention. Municipal systems dating from the 1920–1960 era now fail at accelerating rates. Three decades of maintenance budget cuts have compounded the deterioration.

## Root Causes

The crisis stems from three converging pressures. Deferred maintenance has generated a $434 billion backlog (ASCE, 2021). The utility workforce is aging past replacement capacity. Regulatory compliance absorbs an outsized share of operational budgets.

## Proposed Solutions

Regional consolidation of small water systems could cut per-household costs by 18–34 percent and strengthen compliance (Kearney & Liu, 2023). A substantial increase in federal investment is essential.`;

const RECAST_LOST_HEADING = `## Introduction

American cities face a water infrastructure crisis. Municipal systems dating from the 1920–1960 era now fail at accelerating rates.

Root Causes

The crisis stems from three converging pressures. Deferred maintenance has generated a $434 billion backlog (ASCE, 2021).

## Proposed Solutions

Regional consolidation could cut costs by 18–34 percent (Kearney & Liu, 2023).`;

const RECAST_ALL_HEADINGS_LOST = `The water crisis in American cities has reached a critical point. Municipal systems installed between 1920 and 1960 are failing. Maintenance budgets have been cut repeatedly. Three factors drive the crisis. Consolidation could reduce costs.`;

describe('Live Nonfiction Heading Gate Stress — Heading Detection', () => {
  it('1. detects 3 markdown headings in original', () => {
    assert.equal(detectMarkdownHeadings(ORIGINAL_WITH_HEADINGS), 3);
  });

  it('2. detects 3 markdown headings in preserved recast', () => {
    assert.equal(detectMarkdownHeadings(RECAST_PRESERVED), 3);
  });

  it('3. detects 2 markdown headings in lost-heading recast', () => {
    assert.equal(detectMarkdownHeadings(RECAST_LOST_HEADING), 2);
  });

  it('4. detects 0 markdown headings in all-headings-lost recast', () => {
    assert.equal(detectMarkdownHeadings(RECAST_ALL_HEADINGS_LOST), 0);
  });
});

describe('Live Nonfiction Heading Gate Stress — Nonfiction Blocking', () => {
  it('5. nonfiction: preserved headings → ok', () => {
    const result = validateHeadingPreservation(ORIGINAL_WITH_HEADINGS, RECAST_PRESERVED, nonfiction);
    assert.equal(result.ok, true);
    assert.equal(result.originalCount, 3);
    assert.equal(result.recastCount, 3);
  });

  it('6. nonfiction: lost 1 heading → rejected', () => {
    const result = validateHeadingPreservation(ORIGINAL_WITH_HEADINGS, RECAST_LOST_HEADING, nonfiction);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('Heading loss'));
  });

  it('7. nonfiction: lost ALL headings → rejected', () => {
    const result = validateHeadingPreservation(ORIGINAL_WITH_HEADINGS, RECAST_ALL_HEADINGS_LOST, nonfiction);
    assert.equal(result.ok, false);
    assert.equal(result.recastCount, 0);
  });

  it('8. business_guide: lost 1 heading → rejected', () => {
    const result = validateHeadingPreservation(ORIGINAL_WITH_HEADINGS, RECAST_LOST_HEADING, business);
    assert.equal(result.ok, false);
  });

  it('9. training_manual: lost 1 heading → rejected', () => {
    const result = validateHeadingPreservation(ORIGINAL_WITH_HEADINGS, RECAST_LOST_HEADING, training);
    assert.equal(result.ok, false);
  });
});

describe('Live Nonfiction Heading Gate Stress — Fiction Bypass', () => {
  it('10. fiction: lost heading → ok (fiction bypasses gate)', () => {
    const result = validateHeadingPreservation(ORIGINAL_WITH_HEADINGS, RECAST_LOST_HEADING, fiction);
    assert.equal(result.ok, true);
  });

  it('11. fiction: lost ALL headings → ok', () => {
    const result = validateHeadingPreservation(ORIGINAL_WITH_HEADINGS, RECAST_ALL_HEADINGS_LOST, fiction);
    assert.equal(result.ok, true);
  });
});

describe('Live Nonfiction Heading Gate Stress — Edge Cases', () => {
  it('12. nonfiction: gained heading → ok', () => {
    const original = '## Section A\n\nText.';
    const recast = '## Section A\n\nText.\n\n## Section B\n\nMore text.';
    const result = validateHeadingPreservation(original, recast, nonfiction);
    assert.equal(result.ok, true);
    assert.ok(result.recastCount > result.originalCount);
  });

  it('13. nonfiction: both zero headings → ok', () => {
    const original = 'Just plain text without headings.';
    const recast = 'Rewritten plain text without headings.';
    const result = validateHeadingPreservation(original, recast, nonfiction);
    assert.equal(result.ok, true);
  });

  it('14. error message includes heading counts', () => {
    const result = validateHeadingPreservation(ORIGINAL_WITH_HEADINGS, RECAST_LOST_HEADING, nonfiction);
    assert.ok(result.error.includes('3'), `Error should mention original count 3: ${result.error}`);
  });

  it('15. routing selects prose-recast-polisher for nonfiction with headings', () => {
    const chunk = { text: ORIGINAL_WITH_HEADINGS };
    const metrics = { compositeScore: 65, filterVerbDensity: 5, symmetryScore: 20, concreteRatio: 50, openingVerbStrength: 'strong', endingPunch: true, thesisStatementDensity: 0, genericEmotionDensity: 1 };
    const result = chooseRecastModel(nonfiction, chunk, metrics);
    assert.equal(result.model, 'prose-recast-polisher');
    assert.ok(result.reason.includes('nonfiction'));
  });
});
