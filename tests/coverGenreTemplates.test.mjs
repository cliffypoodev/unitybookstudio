/**
 * coverGenreTemplates.test.mjs — Tests for coverGenreTemplates.js
 *
 * Covers:
 *   - getAllGenreCoverTemplates (count, required fields)
 *   - findTemplateById for specific templates
 *   - getGenreCoverTemplate genre → template routing
 *   - Template content assertions (lighting, palette, style, negativeAdditions)
 *   - getRecommendedPipeline routing
 *   - TEMPLATE_REQUIRED_FIELDS constant
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getGenreCoverTemplate,
  getAllGenreCoverTemplates,
  findTemplateById,
  getRecommendedPipeline,
  TEMPLATE_REQUIRED_FIELDS,
} from '../src/lib/coverGenreTemplates.js';

describe('coverGenreTemplates', () => {
  // ── getAllGenreCoverTemplates ───────────────────────────────────
  it('getAllGenreCoverTemplates returns array of 10 templates', () => {
    const all = getAllGenreCoverTemplates();
    assert.ok(Array.isArray(all));
    assert.equal(all.length, 10);
  });

  it('each template has all TEMPLATE_REQUIRED_FIELDS', () => {
    const all = getAllGenreCoverTemplates();
    for (const template of all) {
      for (const field of TEMPLATE_REQUIRED_FIELDS) {
        assert.ok(
          template[field] !== undefined,
          `Template "${template.id}" is missing required field "${field}"`,
        );
      }
    }
  });

  // ── findTemplateById ───────────────────────────────────────────
  it('findTemplateById("psychological_thriller") returns correct template', () => {
    const t = findTemplateById('psychological_thriller');
    assert.equal(t.id, 'psychological_thriller');
    assert.equal(t.label, 'Psychological Thriller');
  });

  it('findTemplateById("dark_fantasy") returns correct template', () => {
    const t = findTemplateById('dark_fantasy');
    assert.equal(t.id, 'dark_fantasy');
    assert.equal(t.label, 'Dark Fantasy');
  });

  // ── getGenreCoverTemplate ──────────────────────────────────────
  it('getGenreCoverTemplate("thriller") returns psychological_thriller template', () => {
    const t = getGenreCoverTemplate('thriller');
    assert.equal(t.id, 'psychological_thriller');
  });

  it('getGenreCoverTemplate("supernatural horror") returns horror_supernatural template', () => {
    const t = getGenreCoverTemplate('supernatural horror');
    assert.equal(t.id, 'horror_supernatural');
  });

  it('getGenreCoverTemplate("romance") returns contemporary_romance template', () => {
    const t = getGenreCoverTemplate('romance');
    assert.equal(t.id, 'contemporary_romance');
  });

  it('getGenreCoverTemplate("business") returns business_self_help template', () => {
    const t = getGenreCoverTemplate('business');
    assert.equal(t.id, 'business_self_help');
  });

  it('getGenreCoverTemplate("children") returns children_middle_grade template', () => {
    const t = getGenreCoverTemplate('children');
    assert.equal(t.id, 'children_middle_grade');
  });

  // ── Template Content Assertions ────────────────────────────────
  it('Thriller template lighting includes "fluorescent"', () => {
    const t = findTemplateById('psychological_thriller');
    assert.ok(t.lighting.toLowerCase().includes('fluorescent'));
  });

  it('Horror template palette includes "charcoal" or "black"', () => {
    const t = findTemplateById('horror_supernatural');
    const pal = t.palette.toLowerCase();
    assert.ok(pal.includes('charcoal') || pal.includes('black'));
  });

  it('Business template stylePreset includes "Minimalist"', () => {
    const t = findTemplateById('business_self_help');
    assert.ok(t.stylePreset.includes('Minimalist'));
  });

  it('Children template negativeAdditions includes "horror" or "violence"', () => {
    const t = findTemplateById('children_middle_grade');
    const neg = t.negativeAdditions.toLowerCase();
    assert.ok(neg.includes('horror') || neg.includes('violence'));
  });

  // ── getRecommendedPipeline ─────────────────────────────────────
  it('getRecommendedPipeline("romance") returns "flux"', () => {
    assert.equal(getRecommendedPipeline('romance'), 'flux');
  });

  it('getRecommendedPipeline("horror") returns "ponyxl"', () => {
    assert.equal(getRecommendedPipeline('horror'), 'ponyxl');
  });
});
