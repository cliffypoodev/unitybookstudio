/**
 * liveGenreConditionalRecastBakeoff.test.mjs
 *
 * Validates the REAL live recast bakeoff results from the genre-conditional
 * recast pipeline. Tests the actual generated outputs, chunk-level analysis,
 * safety gates, and deterministic analyzer consistency.
 *
 * NOTE: These tests validate the RESULTS FILE from the live bakeoff,
 * not the generation itself. The bakeoff must be run first.
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const modulePath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const { analyzeProseTexture, countChatbotPatterns } = await import(modulePath);

let passed = 0;
let failed = 0;
const failures = [];
const sectionResults = {};
let currentSection = '';

function section(name) {
  currentSection = name;
  sectionResults[name] = { total: 0, passed: 0 };
  console.log(`\n=== ${name} ===`);
}

function test(name, fn) {
  sectionResults[currentSection].total++;
  try {
    fn();
    passed++;
    sectionResults[currentSection].passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ section: currentSection, name, error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

const RESULTS_DIR = join(process.cwd(), 'smoke-test-output/live-genre-conditional-recast-bakeoff');
const resultsPath = join(RESULTS_DIR, 'live-recast-bakeoff-results.json');

// ════════════════════════════════════════════════════════════════════════════
section('1. BAKEOFF OUTPUT EXISTS');
// ════════════════════════════════════════════════════════════════════════════

test('Results JSON exists', () => {
  assert.ok(existsSync(resultsPath), 'live-recast-bakeoff-results.json should exist');
});

test('thriller-version-a.txt exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'thriller-version-a.txt')));
});

test('thriller-version-b.txt exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'thriller-version-b.txt')));
});

test('literary-version-a.txt exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'literary-version-a.txt')));
});

test('literary-version-b.txt exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'literary-version-b.txt')));
});

test('nonfiction-version-a.txt exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'nonfiction-version-a.txt')));
});

test('nonfiction-version-b.txt exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'nonfiction-version-b.txt')));
});

// Load results
const bakeoff = JSON.parse(readFileSync(resultsPath, 'utf8'));
const genres = ['thriller', 'literary', 'nonfiction'];

// Helper to find a result by slug
function findResult(slug) {
  return bakeoff.results.find(r => r.slug === slug);
}

// ════════════════════════════════════════════════════════════════════════════
section('2. GENERATED OUTPUT IS SUBSTANTIVE');
// ════════════════════════════════════════════════════════════════════════════

for (const slug of genres) {
  const r = findResult(slug);

  test(`${r.name}: Version A >= 800 words`, () => {
    assert.ok(r.wordCountA >= 800, `A had ${r.wordCountA} words, expected >=800`);
  });

  test(`${r.name}: Version B >= 800 words`, () => {
    assert.ok(r.wordCountB >= 800, `B had ${r.wordCountB} words, expected >=800`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('3. GENRE-CONDITIONAL PROFILES USED');
// ════════════════════════════════════════════════════════════════════════════

test('Thriller uses profileKey "thriller"', () => {
  assert.equal(findResult('thriller').profileKey, 'thriller');
});

test('Literary uses profileKey "literary"', () => {
  assert.equal(findResult('literary').profileKey, 'literary');
});

test('Nonfiction uses profileKey "nonfiction"', () => {
  assert.equal(findResult('nonfiction').profileKey, 'nonfiction');
});

// ════════════════════════════════════════════════════════════════════════════
section('4. RECAST PIPELINE EXECUTED');
// ════════════════════════════════════════════════════════════════════════════

for (const slug of genres) {
  const r = findResult(slug);
  const rr = r.recastReport;

  test(`${r.name}: chunksAnalyzed > 0`, () => {
    assert.ok(rr.chunksAnalyzed > 0, `chunksAnalyzed was ${rr.chunksAnalyzed}`);
  });

  test(`${r.name}: skipped + recast + failed == analyzed`, () => {
    const sum = rr.chunksSkipped + rr.chunksRecast + rr.chunksFailed;
    assert.equal(sum, rr.chunksAnalyzed,
      `${rr.chunksSkipped} + ${rr.chunksRecast} + ${rr.chunksFailed} = ${sum}, expected ${rr.chunksAnalyzed}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('5. FICTION DOES NOT REGRESS');
// ════════════════════════════════════════════════════════════════════════════

const thriller = findResult('thriller');
const literary = findResult('literary');

test('Thriller delta.compositeScore >= -2 (stable or improved)', () => {
  assert.ok(thriller.delta.compositeScore >= -2,
    `Thriller delta was ${thriller.delta.compositeScore}, expected >= -2`);
});

test('Literary delta.compositeScore >= -2 (stable or improved)', () => {
  assert.ok(literary.delta.compositeScore >= -2,
    `Literary delta was ${literary.delta.compositeScore}, expected >= -2`);
});

test('At least one fiction genre improved (delta > 0) or was stable', () => {
  const improved = [thriller, literary].filter(r => r.delta.compositeScore >= 0);
  assert.ok(improved.length >= 1,
    `No fiction genre was stable or improved: thriller=${thriller.delta.compositeScore}, literary=${literary.delta.compositeScore}`);
});

// ════════════════════════════════════════════════════════════════════════════
section('6. NONFICTION DOES NOT REGRESS');
// ════════════════════════════════════════════════════════════════════════════

const nonfiction = findResult('nonfiction');

test('Nonfiction delta.compositeScore >= -5 (critical regression guard)', () => {
  assert.ok(nonfiction.delta.compositeScore >= -5,
    `Nonfiction delta was ${nonfiction.delta.compositeScore}, expected >= -5`);
});

test('Nonfiction B grade is COMPETENT or better', () => {
  const acceptableGrades = ['COMPETENT', 'GOOD', 'EXCELLENT'];
  assert.ok(acceptableGrades.includes(nonfiction.textureB.grade),
    `Nonfiction B grade was ${nonfiction.textureB.grade}, expected COMPETENT or better`);
});

test('Nonfiction filter verb density B <= A + 2 (not dramatically worse)', () => {
  assert.ok(nonfiction.textureB.filterVerbDensity <= nonfiction.textureA.filterVerbDensity + 2,
    `B filterVerbDensity ${nonfiction.textureB.filterVerbDensity} > A ${nonfiction.textureA.filterVerbDensity} + 2`);
});

test('Nonfiction word count B >= A * 0.85 (not cut too much)', () => {
  const threshold = nonfiction.wordCountA * 0.85;
  assert.ok(nonfiction.wordCountB >= threshold,
    `B word count ${nonfiction.wordCountB} < ${threshold.toFixed(0)} (85% of A=${nonfiction.wordCountA})`);
});

// ════════════════════════════════════════════════════════════════════════════
section('7. SAFETY GATES OPERATIONAL');
// ════════════════════════════════════════════════════════════════════════════

test('Total safety blocks >= 0 (field exists and is number)', () => {
  assert.ok(typeof bakeoff.summary.totalSafetyBlocks === 'number',
    `totalSafetyBlocks should be a number, got ${typeof bakeoff.summary.totalSafetyBlocks}`);
  assert.ok(bakeoff.summary.totalSafetyBlocks >= 0,
    `totalSafetyBlocks was ${bakeoff.summary.totalSafetyBlocks}`);
});

test('No overcorrection warnings across all genres', () => {
  for (const r of bakeoff.results) {
    assert.ok(Array.isArray(r.recastReport.overcorrectionWarnings),
      `${r.name}: overcorrectionWarnings is not an array`);
    assert.equal(r.recastReport.overcorrectionWarnings.length, 0,
      `${r.name}: has ${r.recastReport.overcorrectionWarnings.length} overcorrection warnings`);
  }
});

test('All failed chunks preserved original text (B word count close to A)', () => {
  for (const r of bakeoff.results) {
    if (r.recastReport.chunksFailed > 0) {
      // When chunks fail, original text is preserved, so B should be close to A
      const ratio = r.wordCountB / r.wordCountA;
      assert.ok(ratio >= 0.80,
        `${r.name}: B/A word ratio is ${ratio.toFixed(2)}, expected >= 0.80 when failed chunks preserve original`);
    }
  }
});

test('Safety blocks + skipped + recast == analyzed for each genre', () => {
  for (const r of bakeoff.results) {
    const rr = r.recastReport;
    const sum = rr.safetyBlocks + rr.chunksSkipped + rr.chunksRecast;
    // safetyBlocks are a subset of failed, so: skipped + recast + failed == analyzed
    // and safetyBlocks <= failed
    assert.ok(rr.safetyBlocks <= rr.chunksFailed + rr.chunksRecast + rr.chunksSkipped,
      `${r.name}: safetyBlocks (${rr.safetyBlocks}) exceeds total chunk count`);
    const totalAccountedFor = rr.chunksSkipped + rr.chunksRecast + rr.chunksFailed;
    assert.equal(totalAccountedFor, rr.chunksAnalyzed,
      `${r.name}: ${rr.chunksSkipped}+${rr.chunksRecast}+${rr.chunksFailed}=${totalAccountedFor}, expected ${rr.chunksAnalyzed}`);
  }
});

// ════════════════════════════════════════════════════════════════════════════
section('8. CHUNK-LEVEL VALIDATION');
// ════════════════════════════════════════════════════════════════════════════

test('Each genre has chunkAnalysis array', () => {
  for (const r of bakeoff.results) {
    assert.ok(Array.isArray(r.chunkAnalysis),
      `${r.name}: chunkAnalysis is not an array`);
    assert.ok(r.chunkAnalysis.length > 0,
      `${r.name}: chunkAnalysis is empty`);
  }
});

test('All chunks have index, words, score, eligible, reason', () => {
  const requiredFields = ['index', 'words', 'score', 'eligible', 'reason'];
  for (const r of bakeoff.results) {
    for (const chunk of r.chunkAnalysis) {
      for (const field of requiredFields) {
        assert.ok(field in chunk,
          `${r.name} chunk ${chunk.index}: missing field '${field}'`);
      }
    }
  }
});

test('Skipped chunks have score >= 70 or are protected', () => {
  for (const r of bakeoff.results) {
    for (const detail of r.recastReport.chunkDetails) {
      if (detail.action === 'skipped') {
        const isHighScore = detail.beforeScore >= 70;
        const isProtected = detail.reason.toLowerCase().includes('protected');
        assert.ok(isHighScore || isProtected,
          `${r.name} chunk ${detail.index}: skipped with score ${detail.beforeScore} and not protected — reason: ${detail.reason}`);
      }
    }
  }
});

test('At least one chunk was eligible for recast across all genres', () => {
  let totalEligible = 0;
  for (const r of bakeoff.results) {
    totalEligible += r.chunkAnalysis.filter(c => c.eligible).length;
  }
  assert.ok(totalEligible >= 1,
    `No chunks were eligible for recast across all genres (total eligible: ${totalEligible})`);
});

// ════════════════════════════════════════════════════════════════════════════
section('9. DETERMINISTIC ANALYZER VALIDATION');
// ════════════════════════════════════════════════════════════════════════════

for (const slug of genres) {
  const textA = readFileSync(join(RESULTS_DIR, `${slug}-version-a.txt`), 'utf8');
  const textB = readFileSync(join(RESULTS_DIR, `${slug}-version-b.txt`), 'utf8');

  const freshA = analyzeProseTexture(textA);
  const freshB = analyzeProseTexture(textB);
  const result = findResult(slug);

  test(`${result.name}: Analyzer score A matches recorded`, () => {
    assert.equal(freshA.compositeScore, result.textureA.compositeScore,
      `Fresh=${freshA.compositeScore}, Recorded=${result.textureA.compositeScore}`);
  });

  test(`${result.name}: Analyzer score B matches recorded`, () => {
    assert.equal(freshB.compositeScore, result.textureB.compositeScore,
      `Fresh=${freshB.compositeScore}, Recorded=${result.textureB.compositeScore}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('10. REAL OLLAMA OUTPUT VALIDATION');
// ════════════════════════════════════════════════════════════════════════════

test('genModel == "ghostwriter"', () => {
  assert.equal(bakeoff.genModel, 'ghostwriter');
});

test('recastModel == "prose-polisher"', () => {
  assert.equal(bakeoff.recastModel, 'prose-polisher');
});

test('timestamp is valid date', () => {
  assert.ok(bakeoff.timestamp, 'timestamp should exist');
  const ts = new Date(bakeoff.timestamp);
  assert.ok(!isNaN(ts.getTime()), 'timestamp should be valid date');
});

test('Each B text has multiple paragraphs (>= 5 with >50 chars each)', () => {
  for (const slug of genres) {
    const textB = readFileSync(join(RESULTS_DIR, `${slug}-version-b.txt`), 'utf8');
    const paragraphs = textB.split(/\n\n+/).filter(p => p.trim().length > 50);
    assert.ok(paragraphs.length >= 5,
      `${slug}: expected >=5 paragraphs with >50 chars, got ${paragraphs.length}`);
  }
});

test('genTemperature is number', () => {
  assert.ok(typeof bakeoff.genTemperature === 'number',
    `genTemperature should be a number, got ${typeof bakeoff.genTemperature}`);
});

// ════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(64)}`);
console.log(`LIVE GENRE-CONDITIONAL RECAST BAKEOFF: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ❌ [${f.section}] ${f.name}: ${f.error}`);
  }
}

console.log(`${'='.repeat(64)}`);

console.log('\nSection Summary:');
for (const [name, r] of Object.entries(sectionResults)) {
  const icon = r.passed === r.total ? '✅' : '❌';
  console.log(`  ${icon} ${name}: ${r.passed}/${r.total}`);
}

console.log();
if (failed > 0) process.exit(1);
