// tests/planCrossCheck.test.mjs — Plan cross-check regression tests
// Validates buildPlanDeliveryReport against hand-crafted fixtures.

import assert from 'node:assert';
import { buildPlanDeliveryReport } from '../src/lib/planCrossCheck.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * FIXTURES
 * ═════════════════════════════════════════════════════════════════════════ */

const PROJECT_WITH_OUTLINE = {
  outline_md: `## Chapter 1: The Arrival
Marcus and Elena arrive at the harbor at dawn
The harbor master greets them suspiciously
The crew discusses whether to reveal the cargo

## Chapter 2: The Market
Marcus explores the local market alone
He purchases supplies and gifts
Elena catalogs the ship's inventory

## Chapter 3: The Storm
A violent storm hits the harbor
The crew fights to save the ship
Marcus counts heads after the storm passes`,
  characters_md: `## Marcus
The ship's first mate. Pragmatic and resourceful.

## Elena
The ship's quartermaster. Sharp-tongued and detail-oriented.

## Captain Aldric
The ship's captain. Carries a dangerous secret about the cargo.`,
  genre: 'fiction',
};

const CHAPTERS = [
  { chapter: { chapter_number: 1, title: 'The Arrival' }, content: 'Marcus and Elena stepped onto the dock at dawn. The harbor master, a grizzled old man named Roth, watched them with suspicion. Captain Aldric remained aboard, his expression dark.' },
  { chapter: { chapter_number: 2, title: 'The Market' }, content: 'Marcus walked through the market alone. He purchased spices and a length of blue silk. Elena stayed behind to catalog supplies.' },
  { chapter: { chapter_number: 3, title: 'The Storm' }, content: 'The storm arrived without warning. Marcus grabbed a rope. Elena screamed orders. When it passed, Marcus counted heads.' },
];

const PROJECT_NO_OUTLINE = { genre: 'fiction' };

const mockLLM = async (prompt) => {
  // Return different results based on which chapter is being analyzed
  if (prompt.includes('Chapter 1')) {
    return JSON.stringify({
      beatsDelivered: ['Marcus and Elena arrive at the harbor at dawn', 'The harbor master greets them suspiciously'],
      beatsMissing: ['The crew discusses whether to reveal the cargo'],
      beatsAltered: [],
    });
  }
  if (prompt.includes('Chapter 2')) {
    return JSON.stringify({
      beatsDelivered: ['Marcus explores the local market alone', 'Elena catalogs the ship\'s inventory'],
      beatsMissing: [],
      beatsAltered: ['He purchases supplies and gifts → He purchases spices and silk (specific items differ)'],
    });
  }
  if (prompt.includes('Chapter 3')) {
    return JSON.stringify({
      beatsDelivered: ['A violent storm hits the harbor', 'Marcus counts heads after the storm passes'],
      beatsMissing: [],
      beatsAltered: ['The crew fights to save the ship → Individual crew members react (less dramatic)'],
    });
  }
  return JSON.stringify({ beatsDelivered: [], beatsMissing: [], beatsAltered: [] });
};

/* ═══════════════════════════════════════════════════════════════════════════
 * TEST HARNESS
 * ═════════════════════════════════════════════════════════════════════════ */

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    failures.push(name);
    console.error('  ❌ ' + name + ': ' + e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RUN TESTS (async IIFE)
 * ═════════════════════════════════════════════════════════════════════════ */

(async () => {
  console.log('\n=== PLAN CROSS-CHECK TESTS ===\n');

  /* ── Build report WITH outline ── */
  const report = await buildPlanDeliveryReport({ project: PROJECT_WITH_OUTLINE, chapters: CHAPTERS, _llmOverride: mockLLM });

  /* ── Test 1: Plan available with outline ── */
  test('1. Plan available with outline', () => {
    assert.strictEqual(report.planAvailable, true, 'planAvailable should be true when outline exists');
  });

  /* ── Test 2: Coverage table has 3 entries ── */
  test('2. Coverage table has 3 entries', () => {
    assert.strictEqual(report.coverageTable.length, 3, 'Should have one entry per planned chapter');
  });

  /* ── Test 3: All chapters show as drafted ── */
  test('3. All chapters show as drafted', () => {
    assert(report.coverageTable.every(c => c.drafted),
      'Every coverage entry should be drafted');
  });

  /* ── Test 4: Coverage table titles match ── */
  test('4. Coverage table titles match', () => {
    const ch1 = report.coverageTable[0];
    assert(ch1.plannedTitle.includes('Arrival'),
      'Ch1 plannedTitle should include "Arrival", got: ' + ch1.plannedTitle);
  });

  /* ── Test 5: Character coverage finds 3 characters ── */
  test('5. Character coverage finds 3 characters', () => {
    assert.strictEqual(report.characterCoverage.length, 3,
      'Should find Marcus, Elena, and Captain Aldric');
  });

  /* ── Test 6: Marcus appears in all 3 chapters ── */
  test('6. Marcus appears in all 3 chapters', () => {
    const marcus = report.characterCoverage.find(c => c.name === 'Marcus');
    assert(marcus, 'Marcus should be in characterCoverage');
    assert.strictEqual(marcus.chaptersPresent.length, 3,
      'Marcus should appear in all 3 chapters, got ' + marcus.chaptersPresent.length);
  });

  /* ── Test 7: Beat delivery has 3 entries ── */
  test('7. Beat delivery has 3 entries', () => {
    assert.strictEqual(report.beatDelivery.length, 3,
      'Should have one beat delivery entry per chapter');
  });

  /* ── Test 8: Ch1 has 1 missing beat ── */
  test('8. Ch1 has 1 missing beat', () => {
    const ch1Beats = report.beatDelivery[0];
    assert.strictEqual(ch1Beats.beatsMissing.length, 1,
      'Ch1 should have 1 missing beat');
    assert(ch1Beats.beatsMissing[0].includes('crew discusses'),
      'Missing beat should mention crew discussing cargo');
  });

  /* ── Test 9: All beat delivery entries have source "llm" ── */
  test('9. All beat delivery entries have source "llm"', () => {
    assert(report.beatDelivery.every(b => b.source === 'llm'),
      'Every beat delivery entry should have source "llm"');
  });

  /* ── Build report WITHOUT outline ── */
  const reportNoOutline = await buildPlanDeliveryReport({ project: PROJECT_NO_OUTLINE, chapters: CHAPTERS, _llmOverride: mockLLM });

  /* ── Test 10: No outline project — planAvailable is false ── */
  test('10. No outline project — planAvailable is false', () => {
    assert.strictEqual(reportNoOutline.planAvailable, false,
      'planAvailable should be false when no outline exists');
  });

  /* ── Test 11: No outline project — beatDelivery is null ── */
  test('11. No outline project — beatDelivery is null', () => {
    assert.strictEqual(reportNoOutline.beatDelivery, null,
      'beatDelivery should be null when no outline exists');
  });

  /* ── Test 12: No outline project — characterCoverage still works (but empty) ── */
  test('12. No outline project — characterCoverage still works', () => {
    assert(Array.isArray(reportNoOutline.characterCoverage),
      'characterCoverage should still be an array');
    assert.strictEqual(reportNoOutline.characterCoverage.length, 0,
      'characterCoverage should be empty when no characters_md exists');
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * SUMMARY
   * ═════════════════════════════════════════════════════════════════════════ */

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`PLAN CROSS-CHECK: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`${'═'.repeat(60)}`);
  if (failed > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  ❌ ${f}`);
    process.exit(1);
  } else {
    console.log('All plan cross-check tests passed! ✅');
  }
})();
