/**
 * liveRecastChunkSafetyReport.test.mjs
 *
 * Validates chunk-level safety and protection in the live recast bakeoff.
 * Tests the actual generated outputs and recast reports, not hand-crafted samples.
 *
 * NOTE: These tests validate the RESULTS FILES from the live recast bakeoff,
 * not the generation itself. The bakeoff must be run first.
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
const SLUGS = ['thriller', 'literary', 'nonfiction'];

// Load all data upfront (guarded by existence tests below)
let bakeoff, recastReports, chunkAnalyses;

// ════════════════════════════════════════════════════════════════════════════
section('1. RECAST REPORTS EXIST');
// ════════════════════════════════════════════════════════════════════════════

for (const slug of SLUGS) {
  test(`${slug}-recast-report.json exists`, () => {
    assert.ok(existsSync(join(RESULTS_DIR, `${slug}-recast-report.json`)),
      `${slug}-recast-report.json should exist`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('2. CHUNK ANALYSIS FILES EXIST');
// ════════════════════════════════════════════════════════════════════════════

for (const slug of SLUGS) {
  test(`${slug}-chunk-analysis.json exists`, () => {
    assert.ok(existsSync(join(RESULTS_DIR, `${slug}-chunk-analysis.json`)),
      `${slug}-chunk-analysis.json should exist`);
  });
}

// Load data now that existence is confirmed
bakeoff = JSON.parse(readFileSync(resultsPath, 'utf8'));
recastReports = {};
chunkAnalyses = {};
for (const slug of SLUGS) {
  recastReports[slug] = JSON.parse(readFileSync(join(RESULTS_DIR, `${slug}-recast-report.json`), 'utf8'));
  chunkAnalyses[slug] = JSON.parse(readFileSync(join(RESULTS_DIR, `${slug}-chunk-analysis.json`), 'utf8'));
}

// ════════════════════════════════════════════════════════════════════════════
section('3. SAFETY BLOCKS JUSTIFIED');
// ════════════════════════════════════════════════════════════════════════════

for (const slug of SLUGS) {
  const report = recastReports[slug];
  const label = slug.charAt(0).toUpperCase() + slug.slice(1);

  if (report.chunksFailed > 0) {
    test(`${label}: chunksFailed > 0 implies safetyBlocks > 0`, () => {
      assert.ok(report.safetyBlocks > 0,
        `${label} has ${report.chunksFailed} failed chunks but ${report.safetyBlocks} safety blocks`);
    });

    test(`${label}: failed chunk reasons are specific`, () => {
      const failedChunks = report.chunkDetails.filter(c => c.action === 'failed');
      for (const chunk of failedChunks) {
        const hasSpecificReason =
          chunk.reason.includes('cut too much') ||
          chunk.reason.includes('expanded too much') ||
          chunk.reason.includes('proper nouns') ||
          chunk.reason.includes('Recast scored lower');
        assert.ok(hasSpecificReason,
          `Failed chunk ${chunk.index} reason "${chunk.reason}" is not specific enough`);
      }
    });

    test(`${label}: no overcorrection warnings`, () => {
      assert.equal(report.overcorrectionWarnings.length, 0,
        `Expected 0 overcorrection warnings, got ${report.overcorrectionWarnings.length}`);
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
section('4. PROTECTION CORRECTLY APPLIED');
// ════════════════════════════════════════════════════════════════════════════

for (const slug of SLUGS) {
  const chunks = chunkAnalyses[slug];
  const label = slug.charAt(0).toUpperCase() + slug.slice(1);

  // High-score chunks (score >= 80) should be marked ineligible with high_score or Score reason
  const highScoreChunks = chunks.filter(c => c.score >= 80);
  if (highScoreChunks.length > 0) {
    test(`${label}: high-score chunks (≥80) marked not eligible`, () => {
      for (const chunk of highScoreChunks) {
        assert.equal(chunk.eligible, false,
          `Chunk ${chunk.index} (score ${chunk.score}) should not be eligible`);
        const hasScoreReason =
          chunk.reason.includes('high_score') ||
          chunk.reason.includes('Score');
        assert.ok(hasScoreReason,
          `Chunk ${chunk.index} reason "${chunk.reason}" should mention high_score or Score`);
      }
    });
  }

  // Low-score chunks (score < 70) should be marked eligible (unless protected)
  const lowScoreChunks = chunks.filter(c => c.score < 70);
  if (lowScoreChunks.length > 0) {
    test(`${label}: low-score chunks (<70) marked eligible unless protected`, () => {
      for (const chunk of lowScoreChunks) {
        if (chunk.reason.includes('Protected')) {
          // Protected chunks may be ineligible even with low score
          assert.equal(chunk.eligible, false,
            `Protected chunk ${chunk.index} should not be eligible`);
        } else {
          assert.equal(chunk.eligible, true,
            `Chunk ${chunk.index} (score ${chunk.score}) should be eligible`);
        }
      }
    });
  }

  // Protected chunks should have specific protection reasons
  const protectedChunks = chunks.filter(c => c.reason.includes('Protected'));
  if (protectedChunks.length > 0) {
    test(`${label}: protected chunks have specific protection reasons`, () => {
      for (const chunk of protectedChunks) {
        // Reason should specify why (e.g., dialogue_heavy, high_score)
        const afterProtected = chunk.reason.replace('Protected: ', '');
        assert.ok(afterProtected.length > 0,
          `Protected chunk ${chunk.index} has no specific reason after "Protected:"`);
      }
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
section('5. RECAST QUALITY');
// ════════════════════════════════════════════════════════════════════════════

// Thriller: chunk 2 was recast
const thrillerReport = recastReports.thriller;
const thrillerChunk2 = thrillerReport.chunkDetails.find(c => c.index === 2);

test('Thriller: chunk 2 was recast', () => {
  assert.ok(thrillerChunk2, 'Thriller chunkDetails should include chunk 2');
  assert.equal(thrillerChunk2.action, 'recast',
    `Thriller chunk 2 action should be "recast", got "${thrillerChunk2.action}"`);
});

test('Thriller: chunk 2 beforeScore < 70', () => {
  assert.ok(thrillerChunk2.beforeScore < 70,
    `Thriller chunk 2 beforeScore ${thrillerChunk2.beforeScore} should be < 70`);
});

test('Thriller: chunk 2 afterScore > beforeScore (improvement)', () => {
  assert.ok(thrillerChunk2.afterScore > thrillerChunk2.beforeScore,
    `Thriller chunk 2 afterScore ${thrillerChunk2.afterScore} should be > beforeScore ${thrillerChunk2.beforeScore}`);
});

// Nonfiction: chunk 1 was recast
const nonfictionReport = recastReports.nonfiction;
const nonfictionChunk1 = nonfictionReport.chunkDetails.find(c => c.index === 1);

test('Nonfiction: chunk 1 was recast', () => {
  assert.ok(nonfictionChunk1, 'Nonfiction chunkDetails should include chunk 1');
  assert.equal(nonfictionChunk1.action, 'recast',
    `Nonfiction chunk 1 action should be "recast", got "${nonfictionChunk1.action}"`);
});

test('Nonfiction: chunk 1 beforeScore < 70', () => {
  assert.ok(nonfictionChunk1.beforeScore < 70,
    `Nonfiction chunk 1 beforeScore ${nonfictionChunk1.beforeScore} should be < 70`);
});

test('Nonfiction: chunk 1 afterScore > beforeScore (improvement)', () => {
  assert.ok(nonfictionChunk1.afterScore > nonfictionChunk1.beforeScore,
    `Nonfiction chunk 1 afterScore ${nonfictionChunk1.afterScore} should be > beforeScore ${nonfictionChunk1.beforeScore}`);
});

// ════════════════════════════════════════════════════════════════════════════
section('6. WORD COUNT SAFETY');
// ════════════════════════════════════════════════════════════════════════════

for (const slug of SLUGS) {
  const result = bakeoff.results.find(r => r.slug === slug);
  const label = slug.charAt(0).toUpperCase() + slug.slice(1);

  test(`${label}: word count B within 15% of A`, () => {
    const ratio = Math.abs(result.wordCountB - result.wordCountA) / result.wordCountA;
    assert.ok(ratio < 0.15,
      `${label} word count drift ${(ratio * 100).toFixed(1)}% exceeds 15% ` +
      `(A=${result.wordCountA}, B=${result.wordCountB})`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('7. CHUNK ACCOUNTING');
// ════════════════════════════════════════════════════════════════════════════

for (const slug of SLUGS) {
  const report = recastReports[slug];
  const label = slug.charAt(0).toUpperCase() + slug.slice(1);

  test(`${label}: chunksSkipped + chunksRecast + chunksFailed == chunksAnalyzed`, () => {
    const sum = report.chunksSkipped + report.chunksRecast + report.chunksFailed;
    assert.equal(sum, report.chunksAnalyzed,
      `${label}: ${report.chunksSkipped} skipped + ${report.chunksRecast} recast + ` +
      `${report.chunksFailed} failed = ${sum}, expected ${report.chunksAnalyzed}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(64)}`);
console.log(`LIVE RECAST CHUNK SAFETY TESTS: ${passed} passed, ${failed} failed`);

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
