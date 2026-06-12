// tests/critiquePipeline.test.mjs — Deep critique pipeline tests
// Validates contract validation, dashboard computation, and fix list building.

import assert from 'node:assert';
import { runDeepCritique, validateCritiqueContract, normalizeForMatch, computeDashboard, buildPriorityFixList } from '../src/lib/critiquePipeline.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * CHAPTER FIXTURE
 * ═════════════════════════════════════════════════════════════════════════ */

const CH1_TEXT = `The ship crept into harbor as dawn broke over the eastern hills. Marcus stood at the bow, his hands gripping the salt-worn railing. Behind him, Elena checked the manifest for the third time, her pen scratching against damp paper.

"We should have arrived yesterday," she muttered without looking up.

"The current was against us," Marcus replied. He watched the harbor master emerge from a squat stone building, lantern in hand despite the growing light.

The dock was empty except for a pair of fishing boats. Their nets hung like gray curtains from wooden frames. The smell of old fish and tar mixed with the salt breeze.

Captain Aldric appeared on deck, his coat buttoned to the throat. He surveyed the harbor with narrowed eyes. Whatever he saw seemed to satisfy him because he gave a single nod to the helmsman.

"Bring her alongside the eastern pier," Aldric ordered. His voice carried no emotion, but Marcus noticed the captain's left hand was clenched into a fist inside his pocket.

The crew moved with quiet efficiency. No one spoke above a whisper. Marcus had served on enough vessels to know that silence before docking meant the crew was nervous. They had reason to be.`;

/* ═══════════════════════════════════════════════════════════════════════════
 * MOCK LLMs
 * ═════════════════════════════════════════════════════════════════════════ */

const validMockLLM = async (prompt) => {
  if (prompt.includes('threadWatch') || prompt.includes('SYNTHESIS') || prompt.includes('synthesis')) {
    return JSON.stringify({
      threadWatch: ['The cargo secret is introduced but not resolved'],
      marketability: 'This opening chapter shows commercial potential with its mystery hook.',
    });
  }
  return JSON.stringify({
    scores: { plot: 7, pacing: 6, character: 7, prose: 8, immersion: 7 },
    strengths: [
      { description: 'Effective sensory detail grounds the reader', quote: 'The smell of old fish and tar mixed with the salt breeze' },
      { description: 'Character tension conveyed through physical action', quote: "the captain's left hand was clenched into a fist inside his pocket" },
    ],
    weaknesses: [
      { description: 'Opening line uses passive construction', quote: 'The ship crept into harbor as dawn broke over the eastern hills', paragraphHint: 'The ship crept', severity: 'B', fixType: 'prose' },
      { description: "Elena's introduction is purely functional", quote: 'Elena checked the manifest for the third time', paragraphHint: 'Marcus stood at', severity: 'B', fixType: 'prose' },
      { description: "The crew's nervousness is told rather than shown", quote: 'Marcus had served on enough vessels to know that silence before docking meant the crew was nervous', paragraphHint: 'The crew moved', severity: 'A', fixType: 'prose' },
    ],
    putDownMoments: ["The exposition about Marcus's experience breaks immersion"],
  });
};

let vacuousCallCount = 0;
const vacuousMockLLM = async (prompt) => {
  if (prompt.includes('threadWatch') || prompt.includes('SYNTHESIS') || prompt.includes('synthesis')) {
    return JSON.stringify({ threadWatch: [], marketability: 'Good.' });
  }
  vacuousCallCount++;
  return JSON.stringify({
    scores: { plot: 8, pacing: 8, character: 8, prose: 8, immersion: 8 },
    strengths: [{ description: 'Overall this is strong and compelling read', quote: '' }],
    weaknesses: [],
    putDownMoments: [],
  });
};

const fabricatedMockLLM = async (prompt) => {
  if (prompt.includes('threadWatch') || prompt.includes('SYNTHESIS') || prompt.includes('synthesis')) {
    return JSON.stringify({ threadWatch: [], marketability: 'Decent.' });
  }
  return JSON.stringify({
    scores: { plot: 6, pacing: 6, character: 6, prose: 6, immersion: 6 },
    strengths: [{ description: 'Nice setting', quote: 'The harbor glowed with morning light' }],
    weaknesses: [
      { description: 'Issue 1', quote: 'This quote does not exist in the text at all', severity: 'A', fixType: 'prose' },
      { description: 'Issue 2', quote: 'Neither does this fabricated quote', severity: 'B', fixType: 'prose' },
      { description: 'Issue 3', quote: 'Completely made up text passage here', severity: 'C', fixType: 'manual' },
    ],
    putDownMoments: [],
  });
};

/* ═══════════════════════════════════════════════════════════════════════════
 * SHARED FIXTURES
 * ═════════════════════════════════════════════════════════════════════════ */

const loaded = [
  { chapter: { chapter_number: 1, title: 'The Arrival' }, content: CH1_TEXT },
];

const mockEvidence = {
  chapters: [{ chapterNumber: 1, words: 200, slop: { score: 5, total: 3 }, dialogueRatio: 0.15, forensicTicCounts: {} }],
  manuscript: { totalWords: 200, chapterCount: 1 },
};

const mockPlanReport = {
  planAvailable: false,
  coverageTable: [],
  characterCoverage: [],
  beatDelivery: null,
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
 * RUN TESTS
 * ═════════════════════════════════════════════════════════════════════════ */

(async () => {
  console.log('\n=== CRITIQUE PIPELINE TESTS ===\n');

  // ── Valid critique scenario ──
  const result = await runDeepCritique({
    loaded, project: {}, evidence: mockEvidence, planReport: mockPlanReport, _llmOverride: validMockLLM,
  });

  test('1. Valid critique flows through', () => {
    assert.strictEqual(result.chapterCritiques.length, 1);
    assert.strictEqual(result.chapterCritiques[0].contractPassed, true, 'Contract should pass with valid quotes');
  });

  test('2. Scores are present', () => {
    const scores = result.chapterCritiques[0].scores;
    for (const area of ['plot', 'pacing', 'character', 'prose', 'immersion']) {
      assert(typeof scores[area] === 'number' && scores[area] >= 1 && scores[area] <= 10,
        `${area} score should be 1-10, got ${scores[area]}`);
    }
  });

  test('3. Strengths have verbatim quotes', () => {
    const strengths = result.chapterCritiques[0].strengths;
    for (const s of strengths) {
      const normalized = normalizeForMatch(s.quote);
      assert(normalizeForMatch(CH1_TEXT).includes(normalized),
        'Strength quote should be found in chapter: ' + s.quote.slice(0, 40));
    }
  });

  test('4. Weaknesses have >= 3 entries', () => {
    assert(result.chapterCritiques[0].weaknesses.length >= 3,
      'Should have at least 3 weaknesses, got ' + result.chapterCritiques[0].weaknesses.length);
  });

  test('5. All weakness quotes are verbatim', () => {
    const normalizedChapter = normalizeForMatch(CH1_TEXT);
    for (const w of result.chapterCritiques[0].weaknesses) {
      if (w.quote) {
        assert(normalizedChapter.includes(normalizeForMatch(w.quote)),
          'Weakness quote not found: ' + w.quote.slice(0, 40));
      }
    }
  });

  test('6. Dashboard has 5 areas', () => {
    assert.strictEqual(result.synthesis.dashboard.length, 5);
  });

  test('7. Dashboard prose score matches', () => {
    const prose = result.synthesis.dashboard.find(d => d.area === 'Prose');
    assert(prose, 'Dashboard should have Prose area');
    assert.strictEqual(prose.score, 8, 'Prose score should be 8.0');
  });

  test('8. Priority fix list sorted by severity', () => {
    const list = result.synthesis.priorityFixList;
    assert(list.length >= 3, 'Should have >= 3 fixes');
    // Find first A and first B
    const firstA = list.findIndex(f => f.severity === 'A');
    const firstB = list.findIndex(f => f.severity === 'B');
    if (firstA >= 0 && firstB >= 0) {
      assert(firstA < firstB, 'A-severity fixes should come before B-severity');
    }
  });

  // ── Vacuous review scenario ──
  vacuousCallCount = 0;
  const vacuousResult = await runDeepCritique({
    loaded, project: {}, evidence: mockEvidence, planReport: mockPlanReport, _llmOverride: vacuousMockLLM,
  });

  test('9. Vacuous review triggers retry then contractFailed', () => {
    assert.strictEqual(vacuousResult.chapterCritiques[0].contractPassed, false,
      'Contract should fail for vacuous review');
    assert(vacuousCallCount >= 2, 'Should have retried at least once, calls: ' + vacuousCallCount);
  });

  // ── Fabricated quotes scenario ──
  const fabricatedResult = await runDeepCritique({
    loaded, project: {}, evidence: mockEvidence, planReport: mockPlanReport, _llmOverride: fabricatedMockLLM,
  });

  test('10. Fabricated quotes fail validation', () => {
    assert.strictEqual(fabricatedResult.chapterCritiques[0].contractPassed, false,
      'Contract should fail for fabricated quotes');
    const violations = fabricatedResult.chapterCritiques[0].contractViolations;
    assert(violations.some(v => v.includes('not found')),
      'Should have "not found" violation');
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * SUMMARY
   * ═════════════════════════════════════════════════════════════════════════ */

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`CRITIQUE PIPELINE: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`${'═'.repeat(60)}`);
  if (failed > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  ❌ ${f}`);
    process.exit(1);
  } else {
    console.log('All critique pipeline tests passed! ✅');
  }
})();
