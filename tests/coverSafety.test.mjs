/**
 * coverSafety.test.mjs — Tests for coverSafety.js
 *
 * Covers:
 *   - buildCoverSafetyConstraints for children, standard, business, adult projects
 *   - PonyXL-specific negative injection
 *   - validateCoverPromptSafety for clean and unsafe prompts
 *   - sanitizeCoverNegativePrompt mandatory negative addition + deduplication
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCoverSafetyConstraints,
  validateCoverPromptSafety,
  sanitizeCoverNegativePrompt,
} from '../src/lib/coverSafety.js';

describe('coverSafety', () => {
  // ── buildCoverSafetyConstraints ────────────────────────────────
  describe('buildCoverSafetyConstraints', () => {
    it('children project returns isChildSafe=true', () => {
      const project = { genre: 'children', subgenre: 'middle grade' };
      const result = buildCoverSafetyConstraints(project);
      assert.equal(result.isChildSafe, true);
      assert.equal(result.safetyLevel, 'children');
    });

    it('children project mandatoryNegatives includes nsfw, violence, gore', () => {
      const project = { genre: 'children' };
      const result = buildCoverSafetyConstraints(project);
      assert.ok(result.mandatoryNegatives.includes('nsfw'));
      assert.ok(result.mandatoryNegatives.includes('violence'));
      assert.ok(result.mandatoryNegatives.includes('gore'));
    });

    it('children blockedTerms includes horror and blood', () => {
      const project = { genre: 'children' };
      const result = buildCoverSafetyConstraints(project);
      assert.ok(result.blockedTerms.includes('horror'));
      assert.ok(result.blockedTerms.includes('blood'));
    });

    it('standard project returns isChildSafe=false', () => {
      const project = { genre: 'thriller' };
      const result = buildCoverSafetyConstraints(project);
      assert.equal(result.isChildSafe, false);
      assert.equal(result.safetyLevel, 'standard');
    });

    it('standard project mandatoryNegatives includes nsfw', () => {
      const project = { genre: 'thriller' };
      const result = buildCoverSafetyConstraints(project);
      assert.ok(result.mandatoryNegatives.includes('nsfw'));
    });

    it('business/nonfiction safetyLevel is professional', () => {
      const project = { genre: 'business' };
      const result = buildCoverSafetyConstraints(project);
      assert.equal(result.safetyLevel, 'professional');
    });

    it('PonyXL non-adult adds nsfw and explicit to negatives', () => {
      const project = { genre: 'romance' };
      const result = buildCoverSafetyConstraints(project, { modelPipeline: 'ponyxl' });
      assert.ok(result.mandatoryNegatives.includes('nsfw'));
      assert.ok(result.mandatoryNegatives.includes('explicit'));
    });

    it('erotica project returns safetyLevel adult', () => {
      const project = { genre: 'erotica' };
      const result = buildCoverSafetyConstraints(project);
      assert.equal(result.safetyLevel, 'adult');
      assert.equal(result.isAdultOnly, true);
    });
  });

  // ── validateCoverPromptSafety ──────────────────────────────────
  describe('validateCoverPromptSafety', () => {
    it('returns safe=true for clean prompt', () => {
      const project = { genre: 'romance' };
      const result = validateCoverPromptSafety('a beautiful sunset over the ocean', project);
      assert.equal(result.safe, true);
      assert.equal(result.issues.length, 0);
    });

    it('returns safe=false for children project with "blood"', () => {
      const project = { genre: 'children' };
      const result = validateCoverPromptSafety('a scene with blood on the floor', project);
      assert.equal(result.safe, false);
      assert.ok(result.issues.length > 0);
      assert.ok(result.issues[0].includes('blood'));
    });
  });

  // ── sanitizeCoverNegativePrompt ────────────────────────────────
  describe('sanitizeCoverNegativePrompt', () => {
    it('adds mandatory negatives', () => {
      const project = { genre: 'romance' };
      const result = sanitizeCoverNegativePrompt('blurry, watermark', project);
      assert.ok(result.includes('nsfw'));
    });

    it('does not duplicate existing negatives', () => {
      const project = { genre: 'romance' };
      const result = sanitizeCoverNegativePrompt('nsfw, blurry, watermark', project);
      // Count occurrences of 'nsfw' — should be only the original one
      const matches = result.match(/\bnsfw\b/g);
      assert.equal(matches.length, 1);
    });
  });
});
