/**
 * recastModelfileRegressionGuard.test.mjs
 *
 * Regression guard tests for the prose-recast-polisher.Modelfile.
 * Ensures the Modelfile exists, contains the correct system prompt content,
 * and does NOT contain disallowed content (e.g. assistant identity, image prompt).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MODELFILE_PATH = resolve(
  new URL('..', import.meta.url).pathname,
  'models/prose-recast-polisher.Modelfile',
);

let modelfileContent;
try {
  modelfileContent = readFileSync(MODELFILE_PATH, 'utf8');
} catch {
  modelfileContent = null;
}

describe('Recast Modelfile Regression Guard — File Existence', () => {
  it('1. Modelfile exists at models/prose-recast-polisher.Modelfile', () => {
    assert.ok(existsSync(MODELFILE_PATH), `Modelfile should exist at ${MODELFILE_PATH}`);
    assert.ok(modelfileContent !== null, 'Modelfile should be readable');
  });
});

describe('Recast Modelfile Regression Guard — Required Content', () => {
  it('2. contains "SYSTEM" keyword', () => {
    assert.ok(modelfileContent.includes('SYSTEM'), 'Modelfile should contain SYSTEM keyword');
  });

  it('3. contains "conservative prose editor"', () => {
    assert.ok(
      modelfileContent.includes('conservative prose editor'),
      'Modelfile should identify as a conservative prose editor',
    );
  });

  it('6. contains "length preservation" (case insensitive)', () => {
    assert.ok(
      /length preservation/i.test(modelfileContent),
      'Modelfile should contain length preservation instructions',
    );
  });

  it('7. contains "filter verb" (case insensitive)', () => {
    assert.ok(
      /filter verb/i.test(modelfileContent),
      'Modelfile should contain filter verb instructions',
    );
  });

  it('8. contains "citation"', () => {
    assert.ok(
      modelfileContent.includes('citation'),
      'Modelfile should contain citation preservation instructions',
    );
  });

  it('10. contains "temperature 0.4"', () => {
    assert.ok(
      modelfileContent.includes('temperature 0.4'),
      'Modelfile should set temperature to 0.4',
    );
  });

  it('11. contains "GENRE AWARENESS"', () => {
    assert.ok(
      modelfileContent.includes('GENRE AWARENESS'),
      'Modelfile should contain GENRE AWARENESS section',
    );
  });

  it('12. contains "FICTION"', () => {
    assert.ok(
      modelfileContent.includes('FICTION'),
      'Modelfile should reference FICTION genre',
    );
  });

  it('13. contains "NONFICTION"', () => {
    assert.ok(
      modelfileContent.includes('NONFICTION'),
      'Modelfile should reference NONFICTION genre',
    );
  });

  it('14. contains "TRAINING"', () => {
    assert.ok(
      modelfileContent.includes('TRAINING'),
      'Modelfile should reference TRAINING genre',
    );
  });

  it('15. contains "When in doubt, preserve the original"', () => {
    assert.ok(
      modelfileContent.includes('When in doubt, preserve the original'),
      'Modelfile should contain the safety fallback instruction',
    );
  });
});

describe('Recast Modelfile Regression Guard — Disallowed Content', () => {
  it('4. does NOT contain "chief of staff"', () => {
    assert.ok(
      !modelfileContent.includes('chief of staff'),
      'Modelfile should NOT contain "chief of staff" identity',
    );
  });

  it('5. does NOT contain "personal AI assistant"', () => {
    assert.ok(
      !modelfileContent.includes('personal AI assistant'),
      'Modelfile should NOT contain "personal AI assistant" identity',
    );
  });

  it('9. does NOT contain image prompt terms (PonyXL, SDXL, image prompt)', () => {
    assert.ok(!modelfileContent.includes('image prompt'), 'Modelfile should NOT contain "image prompt"');
    assert.ok(!modelfileContent.includes('PonyXL'), 'Modelfile should NOT contain "PonyXL"');
    assert.ok(!modelfileContent.includes('SDXL'), 'Modelfile should NOT contain "SDXL"');
  });
});
