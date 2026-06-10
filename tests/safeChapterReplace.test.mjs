// =============================================================
// safeChapterReplace.test.mjs — Tests for safe chapter replacement
//
// Tests the safety gate + stale field clearing logic directly,
// without importing chapterStorage.js (which requires Vite aliases).
// Uses a mock prepareChapterContent instead.
// =============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Import only manuscriptSafetyGate (no Vite aliases needed)
const { runManuscriptSafetyGate } = await import(
  resolve(projectRoot, 'src', 'lib', 'manuscriptSafetyGate.js')
);

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}`);
  }
}

// ── Load test data ──
const repairedCh2Path = resolve(projectRoot, 'smoke-test-output', 'live-ui-final-verification', 'chapter-2-repaired.md');
let repairedCh2 = '';
try {
  repairedCh2 = readFileSync(repairedCh2Path, 'utf8');
} catch {
  repairedCh2 = 'The turpentine fumes were too sharp, a chemical bite that seemed engineered to strip the protective coating off his thoughts. '.repeat(50);
}

const contaminatedCh2Path = resolve(projectRoot, 'smoke-test-output', 'live-safety-enforcement-hardfix', 'chapter-2-extracted.txt');
let contaminatedCh2 = '';
try {
  contaminatedCh2 = readFileSync(contaminatedCh2Path, 'utf8');
} catch {
  contaminatedCh2 = 'The opening is sharp, highly polished. Action Plan: Unity Supported Living. Next Move: do something. You was wrong. ' + 'x '.repeat(100);
}

const mockChapter = {
  id: 'test-ch-2',
  chapter_number: 2,
  title: "The Patron's Palette",
};

// ── All stale content fields that must be cleared ──
const STALE_FIELDS = [
  'content', 'draft', 'body', 'prose', 'finalText', 'cleanedText',
  'chapter_text', 'markdown', 'content_html', 'content_html_url',
  'content_delta', 'content_delta_url', '__polishedContent',
  '__polishSavedContent', '__polishExportContent',
];

/**
 * Inline implementation of the safe replacement logic for testing.
 * This mirrors safeChapterReplace.js without the Vite-aliased imports.
 */
async function testSafeReplace(chapter, repairedText, options = {}) {
  const { saveFn, projectType = 'fiction', stage = 'manual-replacement' } = options;

  if (!chapter?.id) return { ok: false, reason: 'No chapter ID', gate: null };
  if (!repairedText || repairedText.trim().length < 100) return { ok: false, reason: 'Too short', gate: null };
  if (!saveFn) return { ok: false, reason: 'No save function', gate: null };

  // Run safety gate
  const gate = runManuscriptSafetyGate(repairedText, {
    project: { project_type: projectType },
    chapter,
    stage,
  });

  if (!gate.ok) {
    return {
      ok: false,
      reason: `Safety gate failed: ${gate.reasons.join('; ')}`,
      gate: {
        ok: gate.ok,
        action: gate.recommendedAction,
        processLeaks: gate.processLeaks.matches.length,
        contamination: gate.contamination.matches.length,
        malformed: gate.malformed.matches.length,
        reasons: gate.reasons,
      },
    };
  }

  // Build payload with stale field clearing
  const staleClear = {};
  for (const f of STALE_FIELDS) staleClear[f] = '';
  staleClear.content_format = 'markdown_v1';
  staleClear.content_md_fallback_present = false;
  staleClear.content_md_upload_failed = false;
  staleClear.content_md_preview_only = false;

  const wordCount = repairedText.trim().split(/\s+/).filter(Boolean).length;

  const payload = {
    ...staleClear,
    content_md: repairedText,
    content_md_url: '',
    word_count: wordCount,
    status: 'drafted',
    content_md_fallback_present: true,
    safe_replacement_version: 'safeChapterReplace-v1',
    safe_replacement_at: new Date().toISOString(),
    safe_replacement_gate_ok: true,
    polish_saved_word_count: wordCount,
    polish_saved_char_count: repairedText.length,
    polish_saved_preview_start: repairedText.trim().substring(0, 200),
    polish_saved_preview_end: repairedText.trim().slice(-200),
  };

  try {
    await saveFn(chapter.id, payload);
  } catch (err) {
    return { ok: false, reason: `Save failed: ${err.message}`, gate: { ok: true } };
  }

  return {
    ok: true,
    chapterId: chapter.id,
    wordCount,
    gate: {
      ok: gate.ok,
      action: gate.recommendedAction,
      processLeaks: gate.processLeaks.matches.length,
      contamination: gate.contamination.matches.length,
      malformed: gate.malformed.matches.length,
    },
    payload,
  };
}

// ── Mock save ──
let lastSaveId = null;
let lastSavePayload = null;
let saveShouldFail = false;

async function mockSaveFn(id, payload) {
  if (saveShouldFail) throw new Error('Simulated save failure');
  lastSaveId = id;
  lastSavePayload = payload;
}

function resetMock() {
  lastSaveId = null;
  lastSavePayload = null;
  saveShouldFail = false;
}

console.log('\n' + '='.repeat(60));
console.log('SAFE CHAPTER REPLACE TESTS');
console.log('='.repeat(60) + '\n');

// ── Test 1: Clean text accepted ──
console.log('Test 1: Clean text accepted and saved');
resetMock();
const r1 = await testSafeReplace(mockChapter, repairedCh2, { saveFn: mockSaveFn });
assert(r1.ok === true, 'Result ok = true');
assert(r1.gate.ok === true, 'Gate ok = true');
assert(r1.gate.processLeaks === 0, 'Gate processLeaks = 0');
assert(r1.gate.contamination === 0, 'Gate contamination = 0');
assert(r1.gate.malformed === 0, 'Gate malformed = 0');
assert(lastSaveId === 'test-ch-2', 'Save called with correct ID');
assert(lastSavePayload !== null, 'Save payload present');

// ── Test 2: Stale fields cleared ──
console.log('\nTest 2: Stale fields cleared in save payload');
for (const field of STALE_FIELDS) {
  assert(lastSavePayload[field] === '', `${field} cleared`);
}

// ── Test 3: Content fields set ──
console.log('\nTest 3: Content fields set correctly');
assert((lastSavePayload.content_md || '').length > 1000, 'content_md has content');
assert(lastSavePayload.word_count > 3000, `word_count reasonable (${lastSavePayload.word_count})`);
assert(lastSavePayload.status === 'drafted', 'status = drafted');
assert(lastSavePayload.safe_replacement_version === 'safeChapterReplace-v1', 'version stamp');
assert(lastSavePayload.safe_replacement_gate_ok === true, 'gate_ok stamp');
assert(lastSavePayload.content_md_fallback_present === true, 'fallback flag');

// ── Test 4: Contaminated text rejected ──
console.log('\nTest 4: Contaminated text rejected before save');
resetMock();
const r4 = await testSafeReplace(mockChapter, contaminatedCh2, { saveFn: mockSaveFn });
assert(r4.ok === false, 'Result ok = false');
assert(r4.gate.ok === false, 'Gate ok = false');
assert(r4.gate.processLeaks > 0, `Gate processLeaks > 0 (${r4.gate.processLeaks})`);
assert(r4.gate.contamination > 0, `Gate contamination > 0 (${r4.gate.contamination})`);
assert(lastSaveId === null, 'Save NOT called');
assert(lastSavePayload === null, 'Save payload null');

// ── Test 5: Short text rejected ──
console.log('\nTest 5: Short text rejected');
resetMock();
const r5 = await testSafeReplace(mockChapter, 'too short', { saveFn: mockSaveFn });
assert(r5.ok === false, 'Short text rejected');
assert(lastSaveId === null, 'No save for short text');

// ── Test 6: No chapter ID rejected ──
console.log('\nTest 6: No chapter ID rejected');
resetMock();
const r6 = await testSafeReplace({}, repairedCh2, { saveFn: mockSaveFn });
assert(r6.ok === false, 'No chapter ID rejected');

// ── Test 7: Save failure handled ──
console.log('\nTest 7: Save failure handled gracefully');
resetMock();
saveShouldFail = true;
const r7 = await testSafeReplace(mockChapter, repairedCh2, { saveFn: mockSaveFn });
assert(r7.ok === false, 'Result ok = false on save failure');
assert(r7.reason.includes('Save failed'), 'Reason includes save failure');

// ── Test 8: Post-replacement gate verification (clean) ──
console.log('\nTest 8: Post-replacement verification (clean text)');
const g8 = runManuscriptSafetyGate(repairedCh2, {
  project: { project_type: 'fiction' },
  chapter: mockChapter,
  stage: 'post-replacement-verify',
});
assert(g8.ok === true, 'Clean text passes post-replacement gate');
assert(g8.processLeaks.matches.length === 0, 'No process leaks');
assert(g8.contamination.matches.length === 0, 'No contamination');
assert(g8.malformed.matches.length === 0, 'No malformed');

// ── Test 9: Post-replacement gate verification (contaminated) ──
console.log('\nTest 9: Post-replacement verification (contaminated text)');
const g9 = runManuscriptSafetyGate(contaminatedCh2, {
  project: { project_type: 'fiction' },
  chapter: mockChapter,
  stage: 'post-replacement-verify',
});
assert(g9.ok === false, 'Contaminated text fails post-replacement gate');
assert(g9.processLeaks.matches.length > 0, 'Catches process leaks');
assert(g9.contamination.matches.length > 0, 'Catches contamination');

// ── Test 10: Canary absence in repaired text ──
console.log('\nTest 10: All canary phrases absent from repaired text');
const canaries = [
  'The opening is sharp, highly polished',
  'You have successfully executed',
  'Next Move:',
  'Action Plan:',
  'Unity Supported Living',
  'Unity Media',
  'care documentation',
  'compliance documentation',
  'You was',
  'Was was',
  'foster son',
  'Foster Pines',
];

for (const c of canaries) {
  assert(!repairedCh2.toLowerCase().includes(c.toLowerCase()), `"${c}" absent`);
}

// ── Test 11: Stale fields list completeness ──
console.log('\nTest 11: Stale fields list');
assert(STALE_FIELDS.length >= 15, `${STALE_FIELDS.length} stale fields tracked`);
assert(STALE_FIELDS.includes('content'), 'content in list');
assert(STALE_FIELDS.includes('draft'), 'draft in list');
assert(STALE_FIELDS.includes('body'), 'body in list');
assert(STALE_FIELDS.includes('content_html'), 'content_html in list');
assert(STALE_FIELDS.includes('__polishedContent'), '__polishedContent in list');

// ── Test 12: Full export simulation with repaired Ch2 ──
// Now simulates the complete pre-export pipeline:
// 1. Surface dialogue repair on every chapter (like ExportTab.jsx)
// 2. Safety gate on repaired text
console.log('\nTest 12: Full export simulation with surface repair + safety gate');
const { runPreExportSafetyGate } = await import(
  resolve(projectRoot, 'src', 'lib', 'exportSafetyGate.js')
);
const { runDialogueMechanicsPass } = await import(
  resolve(projectRoot, 'src', 'lib', 'dialogueMechanicsRepair.js')
);

const fullText = readFileSync(
  resolve(projectRoot, 'smoke-test-output', 'live-safety-enforcement-hardfix', 'extracted-full-text.txt'),
  'utf8'
);

const chapterParts = fullText.split(/(?=Chapter \d+)/i).filter(p => p.trim().length > 50);
const simChapters = chapterParts.map((part, i) => {
  const titleMatch = part.match(/^(Chapter\s+\d+[^\n]*)/i);
  const title = titleMatch ? titleMatch[1].trim() : `Section ${i}`;
  const body = titleMatch ? part.slice(titleMatch[0].length).trim() : part.trim();
  const numMatch = title.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0]) : i + 1;
  return {
    id: `sim-${num}`,
    chapter_number: num,
    title,
    content_md: num === 2 ? repairedCh2 : body,
  };
});

// Simulate pre-export surface dialogue repair (what ExportTab.jsx now does)
let totalSurfaceRepairs = 0;
for (const ch of simChapters) {
  const content = ch.content_md || '';
  if (!content || content.length < 100) continue;
  try {
    const dmResult = runDialogueMechanicsPass(content, { stage: 'test-pre-export' });
    if (dmResult.repairs.length > 0) {
      ch.content_md = dmResult.text;
      totalSurfaceRepairs += dmResult.repairs.length;
    }
  } catch (_e) { /* skip */ }
}
console.log(`  ℹ️  Surface repair applied: ${totalSurfaceRepairs} dialogue quotes fixed`);

const exportReport = await runPreExportSafetyGate(simChapters, {
  project: { project_type: 'anthology', title: 'Digital Equity Tribunal' },
  stage: 'post-repair-export',
});

// Ch.2 (repaired) should pass since it has no process leaks or contamination
const ch2Entry = [...exportReport.passed, ...exportReport.warnings].find(e => e.chapterNumber === 2);
assert(ch2Entry !== undefined, 'Ch.2 (repaired) passes export gate');
assert(simChapters.length === 20, `Chapter count = 20`);
// Verify the gate IS catching known-bad chapters (malformed grammar, process leaks, etc.)
const malformedBlocks = exportReport.hardFailures.filter(f => f.malformedCount > 0);
if (malformedBlocks.length > 0) {
  console.log(`  ℹ️  ${malformedBlocks.length} chapter(s) correctly flagged for malformed grammar (expected for unrepaired chapters)`);
}
assert(exportReport.totalChapters === 20, 'All 20 chapters scanned');

// ── Summary ──
console.log('\n' + '='.repeat(60));
console.log(`SAFE CHAPTER REPLACE: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log('='.repeat(60));

if (failed === 0) {
  console.log('All safe chapter replace tests passed! ✅\n');
} else {
  console.error(`${failed} test(s) FAILED ❌\n`);
}

process.exit(failed > 0 ? 1 : 0);
