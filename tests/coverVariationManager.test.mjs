/**
 * coverVariationManager.test.mjs — Tests for coverVariationManager.js
 *
 * Covers:
 *   - createCoverVariation: shape, UUID, default/custom naming
 *   - duplicateCoverVariation: new ID, preserved metadata, Copy suffix
 *   - updateCoverVariation: merge + immutable ID
 *   - buildCoverVariationMetadata: field extraction
 *   - selectActiveCoverVariation / deleteCoverVariation (with mock localStorage)
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createCoverVariation,
  duplicateCoverVariation,
  updateCoverVariation,
  buildCoverVariationMetadata,
  selectActiveCoverVariation,
  deleteCoverVariation,
  saveProjectVariations,
  getProjectVariations,
  VARIATION_STORAGE_KEY,
} from '../src/lib/coverVariationManager.js';

// ── Minimal localStorage shim for Node ──────────────────────────
const store = {};
globalThis.localStorage = {
  getItem(key) { return store[key] ?? null; },
  setItem(key, val) { store[key] = String(val); },
  removeItem(key) { delete store[key]; },
  clear() { for (const k of Object.keys(store)) delete store[k]; },
};

/** UUID v4 regex */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sampleMeta = {
  prompt: 'dark fantasy castle',
  negativePrompt: 'blurry',
  modelPipeline: 'flux',
  checkpoint: 'dreamshaper_8',
  seed: 42,
  sizePreset: '6x9',
  width: 1024,
  height: 1536,
  genreTemplate: 'fantasy',
};

describe('coverVariationManager', () => {
  // ── createCoverVariation ──────────────────────────────────────
  describe('createCoverVariation', () => {
    it('returns object with id, name, imageUrl, metadata, createdAt, isActive', () => {
      const v = createCoverVariation({ imageUrl: 'data:image/png;base64,abc', metadata: sampleMeta });
      assert.ok(v.id);
      assert.ok(v.name);
      assert.equal(v.imageUrl, 'data:image/png;base64,abc');
      assert.ok(v.metadata);
      assert.ok(v.createdAt);
      assert.equal(v.isActive, false);
    });

    it('id is a valid UUID string', () => {
      const v = createCoverVariation({ imageUrl: 'https://img.test/1.png', metadata: sampleMeta });
      assert.match(v.id, UUID_RE);
    });

    it('default name follows "Variation N" pattern', () => {
      const v = createCoverVariation({ imageUrl: 'x', metadata: sampleMeta });
      assert.match(v.name, /^Variation \d+$/);
    });

    it('custom name is preserved', () => {
      const v = createCoverVariation({ imageUrl: 'x', metadata: sampleMeta, name: 'Dark Theme' });
      assert.equal(v.name, 'Dark Theme');
    });
  });

  // ── duplicateCoverVariation ───────────────────────────────────
  describe('duplicateCoverVariation', () => {
    it('returns a new id', () => {
      const original = createCoverVariation({ imageUrl: 'x', metadata: sampleMeta, name: 'Original' });
      const copy = duplicateCoverVariation(original);
      assert.notEqual(copy.id, original.id);
      assert.match(copy.id, UUID_RE);
    });

    it('preserves metadata', () => {
      const original = createCoverVariation({ imageUrl: 'x', metadata: sampleMeta });
      const copy = duplicateCoverVariation(original);
      assert.deepStrictEqual(copy.metadata, original.metadata);
    });

    it('name has "(Copy)" suffix', () => {
      const original = createCoverVariation({ imageUrl: 'x', metadata: sampleMeta, name: 'Original' });
      const copy = duplicateCoverVariation(original);
      assert.equal(copy.name, 'Original (Copy)');
    });
  });

  // ── updateCoverVariation ──────────────────────────────────────
  describe('updateCoverVariation', () => {
    it('merges updates into variation', () => {
      const v = createCoverVariation({ imageUrl: 'x', metadata: sampleMeta, name: 'V1' });
      const updated = updateCoverVariation(v, { name: 'Renamed', imageUrl: 'y' });
      assert.equal(updated.name, 'Renamed');
      assert.equal(updated.imageUrl, 'y');
    });

    it('does not change id', () => {
      const v = createCoverVariation({ imageUrl: 'x', metadata: sampleMeta });
      const updated = updateCoverVariation(v, { id: 'HACKED', name: 'New' });
      assert.equal(updated.id, v.id);
    });
  });

  // ── buildCoverVariationMetadata ───────────────────────────────
  describe('buildCoverVariationMetadata', () => {
    it('includes prompt, modelPipeline, seed, width, height', () => {
      const project = { genre: 'fantasy', title: 'The Dark Tower' };
      const settings = {
        prompt: 'epic castle',
        modelPipeline: 'flux',
        seed: 99,
        width: 512,
        height: 768,
      };
      const meta = buildCoverVariationMetadata(project, settings);
      assert.equal(meta.prompt, 'epic castle');
      assert.equal(meta.modelPipeline, 'flux');
      assert.equal(meta.seed, 99);
      assert.equal(meta.width, 512);
      assert.equal(meta.height, 768);
      assert.equal(meta.projectGenre, 'fantasy');
      assert.equal(meta.projectTitle, 'The Dark Tower');
    });
  });

  // ── localStorage-backed functions ─────────────────────────────
  describe('localStorage operations', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('deleteCoverVariation with active variation returns remaining', () => {
      const v1 = createCoverVariation({ imageUrl: 'a', metadata: sampleMeta, name: 'A' });
      const v2 = createCoverVariation({ imageUrl: 'b', metadata: sampleMeta, name: 'B' });
      v1.isActive = true;
      saveProjectVariations('proj1', [v1, v2]);

      const remaining = deleteCoverVariation('proj1', v1.id);
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].id, v2.id);
    });

    it('selectActiveCoverVariation sets isActive true on target, false on others', () => {
      const v1 = createCoverVariation({ imageUrl: 'a', metadata: sampleMeta, name: 'A' });
      const v2 = createCoverVariation({ imageUrl: 'b', metadata: sampleMeta, name: 'B' });
      const v3 = createCoverVariation({ imageUrl: 'c', metadata: sampleMeta, name: 'C' });
      saveProjectVariations('proj2', [v1, v2, v3]);

      const updated = selectActiveCoverVariation('proj2', v2.id);
      const active = updated.filter((v) => v.isActive);
      assert.equal(active.length, 1);
      assert.equal(active[0].id, v2.id);

      const inactive = updated.filter((v) => !v.isActive);
      assert.equal(inactive.length, 2);
    });
  });
});
