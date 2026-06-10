/**
 * appRecentWorkflowUIWiring.test.mjs — App-level wiring audit tests
 *
 * Reads the real CoverArtGenerator.jsx source and verifies that all
 * expected interactive controls are properly wired with real handlers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  scanComponentForButtons,
  identifyPotentialNoopHandlers,
  buildUIWiringChecklist,
} from '../src/lib/uiWiringAudit.js';

const COVER_SOURCE = readFileSync(
  resolve('src/components/cover/CoverArtGenerator.jsx'),
  'utf-8'
);

describe('CoverArtGenerator — App-Level UI Wiring Audit', () => {
  // 1. CoverArtGenerator has at least 15 interactive controls
  it('has at least 15 interactive controls', () => {
    const controls = scanComponentForButtons(COVER_SOURCE);
    assert.ok(
      controls.length >= 15,
      `Expected >= 15 controls, found ${controls.length}`
    );
  });

  // 2. CoverArtGenerator has 0 no-op handlers
  it('has 0 no-op handlers', () => {
    const noops = identifyPotentialNoopHandlers(COVER_SOURCE);
    assert.equal(
      noops.length,
      0,
      `Expected 0 no-op handlers, found ${noops.length}: ${JSON.stringify(noops)}`
    );
  });

  // 3. 'generate-with-comfyui' button is wired
  it('has generate-with-comfyui button wired', () => {
    const controls = scanComponentForButtons(COVER_SOURCE);
    const btn = controls.find((c) => c.id === 'generate-with-comfyui');
    assert.ok(btn, 'should find generate-with-comfyui control');
    assert.ok(btn.handler.length > 0, 'handler should not be empty');
  });

  // 4. 'test-comfy-connection' button is wired
  it('has test-comfy-connection button wired', () => {
    const controls = scanComponentForButtons(COVER_SOURCE);
    const btn = controls.find((c) => c.id === 'test-comfy-connection');
    assert.ok(btn, 'should find test-comfy-connection control');
    assert.ok(btn.handler.length > 0, 'handler should not be empty');
  });

  // 5. 'auto-build-prompt' button is wired
  it('has auto-build-prompt button wired', () => {
    const controls = scanComponentForButtons(COVER_SOURCE);
    const btn = controls.find((c) => c.id === 'auto-build-prompt');
    assert.ok(btn, 'should find auto-build-prompt control');
    assert.ok(btn.handler.length > 0, 'handler should not be empty');
  });

  // 6. 'model-pipeline-selector' select is wired
  it('has model-pipeline-selector select wired', () => {
    const controls = scanComponentForButtons(COVER_SOURCE);
    const sel = controls.find((c) => c.id === 'model-pipeline-selector');
    assert.ok(sel, 'should find model-pipeline-selector control');
    assert.ok(sel.handler.length > 0, 'handler should not be empty');
  });

  // 7. wiredPercentage is >= 95
  it('wiredPercentage is >= 95', () => {
    const checklist = buildUIWiringChecklist('CoverArtGenerator', COVER_SOURCE);
    assert.ok(
      checklist.wiredPercentage >= 95,
      `Expected wiredPercentage >= 95, got ${checklist.wiredPercentage}%`
    );
  });

  // 8. Checklist component name is 'CoverArtGenerator'
  it('checklist component name is CoverArtGenerator', () => {
    const checklist = buildUIWiringChecklist('CoverArtGenerator', COVER_SOURCE);
    assert.equal(checklist.componentName, 'CoverArtGenerator');
  });
});
