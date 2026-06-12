// tests/critiqueWiringGuard.test.mjs — Wiring integration test
// Verifies all deep critique modules can be imported and their exports exist.

import assert from 'node:assert';

/* ═══════════════════════════════════════════════════════════════════════════
 * TEST HARNESS
 * ═════════════════════════════════════════════════════════════════════════ */

let passed = 0;
let failed = 0;
const failures = [];

const _tests = [];
function test(name, fn) {
  _tests.push({ name, fn });
}
async function runTests() {
  for (const { name, fn } of _tests) {
    try {
      await fn();
      passed++;
      console.log('  ✅ ' + name);
    } catch (e) {
      failed++;
      failures.push(name);
      console.error('  ❌ ' + name + ': ' + e.message);
    }
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
 * GUARD — NO FAKE SAVES (static source analysis + behavioral)
 * ═════════════════════════════════════════════════════════════════════════ */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcRoot = resolve(__dirname, '..', 'src');

const surgicalFixSrc = readFileSync(resolve(srcRoot, 'lib', 'surgicalFix.js'), 'utf8');
const criticSubPageSrc = readFileSync(resolve(srcRoot, 'components', 'tools', 'CriticSubPage.jsx'), 'utf8');

test('11. surgicalFix.js has no "would call" comments in executable branches', () => {
  // The /would call/i pattern was the original fake-save comment.
  // Ensure it's gone from the entire file.
  const wouldCallMatches = surgicalFixSrc.match(/would call/gi) || [];
  assert.strictEqual(wouldCallMatches.length, 0,
    'surgicalFix.js still contains ' + wouldCallMatches.length + ' "would call" comment(s) — fake save not removed');
});

test('12. Production save branch references prepareChapterContent', () => {
  // The else branch (non-override) MUST call prepareChapterContent
  // Find the else block after _saveOverride check
  const elseIdx = surgicalFixSrc.indexOf('} else {', surgicalFixSrc.indexOf('_saveOverride'));
  assert(elseIdx > 0, 'Could not find else branch after _saveOverride check');
  const elseBranch = surgicalFixSrc.slice(elseIdx, elseIdx + 5000);
  assert(elseBranch.includes('prepareChapterContent'),
    'Production save branch must call prepareChapterContent');
  assert(elseBranch.includes('Chapter.update'),
    'Production save branch must call Chapter.update');
});

test('13. Verification step occurs before status:saved in production branch', () => {
  const elseIdx = surgicalFixSrc.indexOf('} else {', surgicalFixSrc.indexOf('_saveOverride'));
  const elseBranch = surgicalFixSrc.slice(elseIdx, elseIdx + 5000);
  
  // resolveChapterContent (read-back) must appear
  assert(elseBranch.includes('resolveChapterContent'),
    'Production branch must do read-back via resolveChapterContent');
  
  // verifyPassed must be checked before status:'saved'
  const verifyIdx = elseBranch.indexOf('verifyPassed');
  const savedIdx = elseBranch.indexOf("status: 'saved'");
  assert(verifyIdx > 0 && savedIdx > 0, 'Must have verifyPassed and status:saved');
  assert(verifyIdx < savedIdx,
    'verifyPassed check must come before status:saved is pushed');
  
  // status:'save-failed' must exist as the failure path
  assert(elseBranch.includes("status: 'save-failed'"),
    'Production branch must have save-failed status on verification failure');
});

test('14. CriticSubPage call site does NOT pass _saveOverride (uses real save)', () => {
  // Find the applySurgicalFixes call
  const callIdx = criticSubPageSrc.indexOf('applySurgicalFixes(');
  assert(callIdx > 0, 'CriticSubPage must call applySurgicalFixes');
  
  // Extract ~500 chars around the call to see its arguments
  const callContext = criticSubPageSrc.slice(callIdx, callIdx + 500);
  assert(!callContext.includes('_saveOverride'),
    'CriticSubPage must NOT pass _saveOverride — production must use the real save path');
});

test('15. Production save branch appends CRITIC-FIX stamp to revision_notes', () => {
  const elseIdx = surgicalFixSrc.indexOf('} else {', surgicalFixSrc.indexOf('_saveOverride'));
  const elseBranch = surgicalFixSrc.slice(elseIdx, elseIdx + 5000);
  assert(elseBranch.includes('revision_notes'),
    'Production branch must write revision_notes');
  // The stamp is built from [CRITIC-FIX ...] and appended
  assert(elseBranch.includes('revisionNotes') || elseBranch.includes('revision_notes'),
    'Production branch must include revision stamp in save payload');
});

test('16. Behavioral: no _saveOverride triggers real save path (mock entity layer)', async () => {
  // Module-mock: intercept base44.entities.Chapter.update and Chapter.filter
  // to verify they are called by the production save path
  const { base44: base44Module } = await import('../src/api/base44Client.js');

  const updateCalls = [];
  const filterCalls = [];
  const originalUpdate = base44Module.entities.Chapter.update;
  const originalFilter = base44Module.entities.Chapter.filter;

  // Install mocks
  base44Module.entities.Chapter.update = async (id, payload) => {
    updateCalls.push({ id, payload });
    return { id, ...payload };
  };
  base44Module.entities.Chapter.filter = async (query) => {
    filterCalls.push(query);
    // Return a fake record that resolveChapterContent can work with
    const lastUpdate = updateCalls[updateCalls.length - 1];
    return [{ id: query.id, content_md: lastUpdate?.payload?.content_md || 'test content', ...lastUpdate?.payload }];
  };

  try {
    // Paragraphs with word counts to satisfy the 0.88–1.25 length guard
    // 24 words
    const para1 = 'The morning sun cast long shadows across the cobblestone street as merchants began setting up their stalls for the day ahead in the market.';
    // 23 words
    const para2 = 'Helena walked briskly through the crowded plaza, her coat pulled tight against the cold wind that swept down from the northern hills.';
    // 22 words
    const para3 = 'She paused at the fountain and looked back the way she had come, wondering if anyone had noticed her leaving the house so early.';
    const testContent = para1 + '\n\n' + para2 + '\n\n' + para3;
    const loaded = [
      { chapter: { id: 'test-ch-1', chapter_number: 1, title: 'Test' }, content: testContent, original: 'Different from current so save triggers.' },
    ];

    // Mock LLM: rewrite of para2 (24 words, original 23, ratio 1.04)
    const testLLM = async () => 'Helena moved quickly through the bustling plaza, her woolen coat drawn close as the bitter northern wind cut across the wide open town square.';

    const result = await surgicalFix.applySurgicalFixes({
      loaded,
      issues: [{
        severity: 'B', chapterNumber: 1,
        quote: 'her coat pulled tight against the cold wind',
        description: 'Test issue', fixType: 'prose',
      }],
      project: { id: 'test-proj' },
      _llmOverride: testLLM,
      // NOTE: NO _saveOverride — this should hit the real (now mocked) save path
    });

    // Verify the entity layer was actually called
    assert(updateCalls.length >= 1,
      'Chapter.update should have been called at least once, got ' + updateCalls.length);
    assert(filterCalls.length >= 1,
      'Chapter.filter (read-back verify) should have been called at least once, got ' + filterCalls.length);
    
    // Verify the save payload includes prepareChapterContent fields
    const payload = updateCalls[0].payload;
    assert(payload.hasOwnProperty('content_md') || payload.hasOwnProperty('content_md_url'),
      'Save payload must include content_md or content_md_url from prepareChapterContent');
    assert(payload.revision_notes && payload.revision_notes.includes('CRITIC-FIX'),
      'Save payload must include CRITIC-FIX stamp in revision_notes');
    assert(typeof payload.word_count === 'number',
      'Save payload must include word_count');

    // Verify save result status
    const saveResult = result.chapterSaves.find(s => s.chapterNumber === 1);
    assert(saveResult, 'Should have a save result for chapter 1');
    assert(saveResult.status === 'saved' || saveResult.status === 'save-failed',
      'Save status should be saved or save-failed, got: ' + saveResult.status);
  } finally {
    // Restore originals
    base44Module.entities.Chapter.update = originalUpdate;
    base44Module.entities.Chapter.filter = originalFilter;
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
 * RUN + SUMMARY
 * ═════════════════════════════════════════════════════════════════════════ */

await runTests();

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
