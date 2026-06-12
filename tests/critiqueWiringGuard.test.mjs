// tests/critiqueWiringGuard.test.mjs — Wiring integration test
// Verifies all deep critique modules can be imported and their exports exist.

import assert from 'node:assert';

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

console.log('\n=== CRITIQUE WIRING GUARD TESTS ===\n');

/* ═══════════════════════════════════════════════════════════════════════════
 * MODULE IMPORT TESTS — verify all modules load without errors
 * ═════════════════════════════════════════════════════════════════════════ */

let manuscriptEvidence, planCrossCheck, critiquePipeline, surgicalFix;

try {
  manuscriptEvidence = await import('../src/lib/manuscriptEvidence.js');
  test('1. manuscriptEvidence.js imports', () => {
    assert(typeof manuscriptEvidence.buildManuscriptEvidenceReport === 'function',
      'buildManuscriptEvidenceReport should be a function');
  });
} catch (e) {
  test('1. manuscriptEvidence.js imports', () => { throw e; });
}

try {
  planCrossCheck = await import('../src/lib/planCrossCheck.js');
  test('2. planCrossCheck.js imports', () => {
    assert(typeof planCrossCheck.buildPlanDeliveryReport === 'function',
      'buildPlanDeliveryReport should be a function');
  });
} catch (e) {
  test('2. planCrossCheck.js imports', () => { throw e; });
}

try {
  critiquePipeline = await import('../src/lib/critiquePipeline.js');
  test('3. critiquePipeline.js imports', () => {
    assert(typeof critiquePipeline.runDeepCritique === 'function',
      'runDeepCritique should be a function');
    assert(typeof critiquePipeline.validateCritiqueContract === 'function',
      'validateCritiqueContract should be exported');
    assert(typeof critiquePipeline.computeDashboard === 'function',
      'computeDashboard should be exported');
    assert(typeof critiquePipeline.buildPriorityFixList === 'function',
      'buildPriorityFixList should be exported');
  });
} catch (e) {
  test('3. critiquePipeline.js imports', () => { throw e; });
}

try {
  surgicalFix = await import('../src/lib/surgicalFix.js');
  test('4. surgicalFix.js imports', () => {
    assert(typeof surgicalFix.applySurgicalFixes === 'function',
      'applySurgicalFixes should be a function');
    assert(typeof surgicalFix.findContainingParagraph === 'function',
      'findContainingParagraph should be exported');
    assert(typeof surgicalFix.spliceParagraph === 'function',
      'spliceParagraph should be exported');
  });
} catch (e) {
  test('4. surgicalFix.js imports', () => { throw e; });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CROSS-MODULE INTEGRATION — evidence → critique pipeline
 * ═════════════════════════════════════════════════════════════════════════ */

test('5. Evidence report feeds critique pipeline shape', () => {
  const loaded = [
    { chapter: { chapter_number: 1, title: 'Test' }, content: 'Test content with enough words to run.' },
  ];
  const evidence = manuscriptEvidence.buildManuscriptEvidenceReport(loaded, {});
  assert(evidence.chapters.length === 1, 'Should have 1 chapter');
  assert(typeof evidence.chapters[0].slop === 'object', 'Should have slop object');
  assert(typeof evidence.chapters[0].dialogueRatio === 'number', 'Should have dialogueRatio');
  assert(typeof evidence.chapters[0].forensicTicCounts === 'object', 'Should have forensicTicCounts');
  assert(typeof evidence.manuscript.totalWords === 'number', 'Should have totalWords');
  assert(typeof evidence.manuscript.ttr === 'number', 'Should have ttr');
});

test('6. Dashboard computation works with mock critiques', () => {
  const mockCritiques = [
    { scores: { plot: 7, pacing: 6, character: 8, prose: 7, immersion: 7 }, weaknesses: [] },
    { scores: { plot: 6, pacing: 7, character: 7, prose: 8, immersion: 6 }, weaknesses: [] },
  ];
  const dashboard = critiquePipeline.computeDashboard(mockCritiques);
  assert.strictEqual(dashboard.length, 5, 'Dashboard should have 5 areas');
  // Check prose avg = (7 + 8) / 2 = 7.5
  const prose = dashboard.find(d => d.area === 'Prose');
  assert.strictEqual(prose.score, 7.5, 'Prose avg should be 7.5');
  assert.strictEqual(prose.color, 'green', 'Prose 7.5 should be green');
});

test('7. Priority fix list sorts A before B before C', () => {
  const mockCritiques = [
    { chapterNumber: 1, weaknesses: [
      { quote: 'q1', description: 'd1', severity: 'C', fixType: 'manual' },
      { quote: 'q2', description: 'd2', severity: 'A', fixType: 'prose' },
      { quote: 'q3', description: 'd3', severity: 'B', fixType: 'prose' },
    ]},
  ];
  const fixes = critiquePipeline.buildPriorityFixList(mockCritiques);
  assert.strictEqual(fixes.length, 3);
  assert.strictEqual(fixes[0].severity, 'A');
  assert.strictEqual(fixes[1].severity, 'B');
  assert.strictEqual(fixes[2].severity, 'C');
});

test('8. Contract validator catches fabricated quotes', () => {
  const critique = {
    scores: { plot: 7, pacing: 7, character: 7, prose: 7, immersion: 7 },
    weaknesses: [
      { quote: 'this does not exist', severity: 'A', fixType: 'prose' },
      { quote: 'neither does this', severity: 'B', fixType: 'prose' },
      { quote: 'or this one', severity: 'C', fixType: 'manual' },
    ],
    strengths: [],
  };
  const result = critiquePipeline.validateCritiqueContract(critique, 'The actual chapter text is here.');
  assert.strictEqual(result.passed, false, 'Should fail for fabricated quotes');
  assert(result.violations.length >= 3, 'Should have at least 3 violations');
});

test('9. Contract validator passes for verbatim quotes', () => {
  const chapter = 'The ship crept into harbor. Marcus stood at the bow.';
  const critique = {
    scores: { plot: 7, pacing: 7, character: 7, prose: 7, immersion: 7 },
    weaknesses: [
      { quote: 'The ship crept into harbor', severity: 'B', fixType: 'prose' },
      { quote: 'Marcus stood at the bow', severity: 'B', fixType: 'prose' },
      { quote: 'crept into harbor', severity: 'C', fixType: 'prose' },
    ],
    strengths: [{ description: 'test', quote: 'Marcus stood at the bow' }],
  };
  const result = critiquePipeline.validateCritiqueContract(critique, chapter);
  assert.strictEqual(result.passed, true, 'Should pass for verbatim quotes');
});

test('10. Surgical fix paragraph finder + splicer round-trips', () => {
  const text = 'Para one here.\n\nPara two here.\n\nPara three here.';
  const found = surgicalFix.findContainingParagraph(text, 'Para two');
  assert(found, 'Should find paragraph');
  const spliced = surgicalFix.spliceParagraph(text, found.paragraph, 'REPLACED.');
  assert(spliced.includes('REPLACED.'), 'Should contain replacement');
  assert(!spliced.includes('Para two'), 'Should not contain original');
  assert(spliced.includes('Para one'), 'Should still contain other paragraphs');
});

/* ═══════════════════════════════════════════════════════════════════════════
 * SUMMARY
 * ═════════════════════════════════════════════════════════════════════════ */

console.log(`\n${'═'.repeat(60)}`);
console.log(`CRITIQUE WIRING GUARD: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('All critique wiring guard tests passed! ✅');
}
