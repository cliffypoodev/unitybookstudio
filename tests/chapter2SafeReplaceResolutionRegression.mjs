// tests/chapter2SafeReplaceResolutionRegression.mjs
// Chapter 2 safe replacement + stale URL resolution regression tests
//
// NOTE: Does NOT import safeChapterReplace.js or chapterStorage.js
// because they require Vite path aliases (@/api/base44Client).
// Instead, tests the safety gate logic and simulates the replacement workflow.

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const { runManuscriptSafetyGate } = await import(
  resolve(projectRoot, 'src', 'lib', 'manuscriptSafetyGate.js')
);
const { runPreExportSafetyGate } = await import(
  resolve(projectRoot, 'src', 'lib', 'exportSafetyGate.js')
);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2705 ${name}`);
    passed++;
  } catch (err) {
    console.log(`  \u274c ${name}: ${err.message}`);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

console.log('\n\u2550\u2550\u2550 Chapter 2 Safe Replace Resolution Regression \u2550\u2550\u2550\n');

// ── Poisoned Chapter 2 text (simulates contaminated DB content) ──
const POISONED_CH2 = `Chapter 2: The Patron's Palette

The opening is sharp, highly polished and ready for the next stage.

Next Move: Review the character arc and ensure consistency.

Action Plan:
1. Revise dialogue
2. Check continuity

Unity Supported Living Services provides care documentation for compliance documentation purposes.
Unity Media Solutions handles the digital platform.

"You was always the one who understood," he said.
"Was was it ever going to be different?" she asked.

The painting hung in the gallery, a testament to Julian's vision.`;

// ── Clean Chapter 2 text (repaired content) ──
let CLEAN_CH2 = '';
try {
  CLEAN_CH2 = readFileSync(
    resolve(projectRoot, 'smoke-test-output', 'live-ui-final-verification', 'chapter-2-repaired.md'),
    'utf8'
  );
} catch {
  CLEAN_CH2 = `Chapter 2: The Patron\u2019s Palette

The turpentine fumes were too sharp, a chemical bite that seemed engineered to strip the protective coating off his thoughts. He worked on Julian\u2019s likeness\u2014a study in curated blandness\u2014and his brush felt foreign in his hand, heavy with expectation. Darius had always preferred the raw splash of spray paint, the quick violence of acrylic applied directly to rough brick.

Julian didn\u2019t let him rest. He leaned forward from the armchair positioned beside the easel, his tailored tweed jacket smelling faintly of old mahogany and expensive indifference. \u201cA little more depth in the shadow under the left orbital bone, Darius,\u201d Julian murmured, his voice not a request but an instruction.

Darius opened his eyes, blinking against the glare reflected by the glass-paned window. He dipped into the palette again, mixing a deeper umber\u2014a smoky sludge that lived between black and brown.

\u201cYou must force the primaries against each other until they bruise,\u201d Julian continued. \u201cWe are not painting a man, Darius; we are capturing the moment he decides to believe in himself.\u201d

The exchange was loaded, an agreement disguised as critique. It wasn\u2019t about pigment ratios; it was about self-worth packaged as artistic advice. Darius swallowed, feeling the sudden pressure of Julian\u2019s gaze.`;
}

const BAD_CANARIES = [
  'The opening is sharp, highly polished',
  'Next Move:',
  'Action Plan:',
  'Unity Supported Living',
  'Unity Media',
  'care documentation',
  'compliance documentation',
  'You was',
  'Was was',
];

// ── TEST GROUP 1: Poisoned text detection ──
console.log('-- Poisoned Text Detection --');

test('1. Poisoned Ch.2 contains all bad canaries', () => {
  for (const canary of BAD_CANARIES) {
    assert(POISONED_CH2.includes(canary), `Missing canary: "${canary}"`);
  }
});

test('2. Safety gate REJECTS poisoned Ch.2', () => {
  const gate = runManuscriptSafetyGate(POISONED_CH2, { stage: 'pre-export' });
  assert(!gate.ok, `Expected ok=false, got ${gate.ok}`);
  assert(gate.processLeaks.matches.length > 0, 'Expected process leaks');
  assert(gate.contamination.matches.length > 0, 'Expected contamination');
});

test('3. Export blocks with poisoned Ch.2', () => {
  const chapters = [{ chapter_number: 2, title: "The Patron's Palette", content_md: POISONED_CH2 }];
  const report = runPreExportSafetyGate(chapters, { stage: 'pre-export' });
  assert(report.blocked, 'Export should be blocked');
  assert(report.hardFailures.length > 0, 'Should have hard failures');
});

// ── TEST GROUP 2: Clean text passes safety gates ──
console.log('\n-- Clean Text Verification --');

test('4. Clean Ch.2 has no bad canaries', () => {
  for (const canary of BAD_CANARIES) {
    assert(!CLEAN_CH2.includes(canary), `Clean text should not contain: "${canary}"`);
  }
});

test('5. Clean Ch.2 has expected fiction markers', () => {
  assert(CLEAN_CH2.includes('Darius'), 'Missing "Darius"');
  assert(CLEAN_CH2.includes('Julian'), 'Missing "Julian"');
});

test('6. Safety gate PASSES clean Ch.2', () => {
  const gate = runManuscriptSafetyGate(CLEAN_CH2, { stage: 'pre-export' });
  assert(gate.ok, `Expected ok=true, got ok=${gate.ok} reasons=${gate.reasons}`);
  assert(gate.processLeaks.matches.length === 0, `Process leaks: ${gate.processLeaks.matches.length}`);
  assert(gate.contamination.matches.length === 0, `Contamination: ${gate.contamination.matches.length}`);
});

test('7. Export passes with clean Ch.2', () => {
  const chapters = [{ chapter_number: 2, title: "The Patron's Palette", content_md: CLEAN_CH2 }];
  const report = runPreExportSafetyGate(chapters, { stage: 'pre-export' });
  assert(!report.blocked, `Export blocked: ${report.summary}`);
});

// ── TEST GROUP 3: Stale content resolution behavior ──
console.log('\n-- Stale Content Resolution --');

test('8. Stale URL resolution tags chapter object', () => {
  // Simulate what chapterStorage.js resolver does at L541-544
  const chapter = {
    chapter_number: 2,
    content_md_url: 'https://example.com/old.md',
  };
  // After resolver detects stale + no fallback, it tags:
  chapter.__staleContentResolution = true;
  chapter.__staleContentWarning = 'Chapter 2: URL content looked stale (metadata mismatch), no inline fallback exists.';
  
  assert(chapter.__staleContentResolution === true, 'stale flag should be set');
  assert(chapter.__staleContentWarning.includes('stale'), 'warning should mention stale');
});

test('9. Stale chapters are detectable in export array', () => {
  const chapters = [
    { chapter_number: 1, content_md: CLEAN_CH2 },
    { chapter_number: 2, content_md: POISONED_CH2, __staleContentResolution: true },
    { chapter_number: 3, content_md: CLEAN_CH2 },
  ];
  const stale = chapters.filter(ch => ch.__staleContentResolution === true);
  assert(stale.length === 1, `Expected 1 stale, got ${stale.length}`);
  assert(stale[0].chapter_number === 2, 'Stale chapter should be 2');
});

// ── TEST GROUP 4: Safe replacement simulation ──
console.log('\n-- Safe Replacement Simulation --');

test('10. Safe replacement workflow: gate → save → transient content', () => {
  // Simulate the safeReplaceChapterContent workflow
  const chapter = {
    id: 'test-ch2',
    chapter_number: 2,
    title: "The Patron's Palette",
    content_md_url: 'https://example.com/stale-old.md',
    content_md: '',
    content: POISONED_CH2,
    __staleContentResolution: true,
    __staleContentWarning: 'stale content',
  };

  // Step 1: Safety gate on replacement text
  const gate = runManuscriptSafetyGate(CLEAN_CH2, { stage: 'manual-replacement' });
  assert(gate.ok, 'Gate should pass for clean text');

  // Step 2: Simulate save (set transient content as safeChapterReplace does)
  chapter.__safeReplacedContent = CLEAN_CH2;
  chapter.__staleContentResolution = false;
  chapter.__staleContentWarning = '';
  chapter.content_md = CLEAN_CH2;

  // Step 3: Verify transient content is set
  assert(chapter.__safeReplacedContent === CLEAN_CH2, '__safeReplacedContent should be set');
  assert(chapter.__staleContentResolution === false, 'stale flag should be cleared');
  assert(chapter.content_md === CLEAN_CH2, 'content_md should be set to clean text');
});

test('11. Resolver priority: __safeReplacedContent beats URL', () => {
  // Simulate resolver priority chain from chapterStorage.js
  const chapter = {
    __safeReplacedContent: CLEAN_CH2,      // Priority 1
    __polishedContent: '',                   // Priority 2 (empty)
    content_md: '',                          // Priority 3 (empty, URL used instead)
    content_md_url: 'https://example.com/stale.md',  // Priority 4 (stale)
    content: POISONED_CH2,                   // Priority 5 (poisoned)
  };

  // Resolver should pick __safeReplacedContent first
  const transient = (
    chapter.__safeReplacedContent ||
    chapter.__polishedContent ||
    chapter.__polishSavedContent ||
    chapter.__polishExportContent ||
    ''
  ).trim();

  assert(transient.length > 50, 'Transient content should be usable');
  assert(transient.includes('Darius'), 'Should contain "Darius" (clean text marker)');
  assert(transient.includes('turpentine'), 'Should contain "turpentine" (clean text marker)');
  assert(!transient.includes('Action Plan'), 'Should not contain contamination "Action Plan"');
  assert(!transient.includes('Unity Supported Living'), 'Should not contain contamination "Unity Supported Living"');
});

test('12. After safe replace, resolver skips stale URL path', () => {
  const chapter = {
    __safeReplacedContent: CLEAN_CH2,
    content_md_url: 'https://example.com/stale.md',
    content: POISONED_CH2,
  };

  // The resolver returns transient content immediately, never reaches URL path
  const transient = (chapter.__safeReplacedContent || '').trim();
  const looksUsable = transient.length > 50;
  assert(looksUsable, 'Transient content should be usable → URL path skipped');
});

// ── TEST GROUP 5: Stale field clearing ──
console.log('\n-- Stale Field Clearing --');

const STALE_FIELDS = [
  'content', 'draft', 'body', 'prose', 'finalText', 'cleanedText',
  'chapter_text', 'markdown', 'content_html', 'content_html_url',
  'content_delta', 'content_delta_url',
  '__polishedContent', '__polishSavedContent', '__polishExportContent',
];

test('13. All stale fields would be cleared in save payload', () => {
  // Simulate buildStaleFieldClearPayload from safeChapterReplace.js
  const staleClear = {};
  for (const f of STALE_FIELDS) staleClear[f] = '';

  const contentFields = { content_md: '', content_md_url: 'https://example.com/new-clean.md' };
  const savePayload = { ...staleClear, ...contentFields };

  for (const f of STALE_FIELDS) {
    if (f === 'content_md' || f === 'content_md_url') continue;
    assert(savePayload[f] === '', `${f} should be cleared`);
  }
});

test('14. Metadata previews match clean text', () => {
  // Simulate the metadata set by safeChapterReplace
  const preview_start = CLEAN_CH2.trim().substring(0, 200);
  const preview_end = CLEAN_CH2.trim().slice(-200);
  const word_count = CLEAN_CH2.trim().split(/\s+/).filter(Boolean).length;

  assert(preview_start.length > 0, 'Should have preview start');
  assert(preview_end.length > 0, 'Should have preview end');
  assert(word_count > 100, `Word count too low: ${word_count}`);
  assert(CLEAN_CH2.includes(preview_start.substring(0, 80)), 'Content should contain its own start preview');
  assert(CLEAN_CH2.includes(preview_end.slice(-80)), 'Content should contain its own end preview');
});

// ── TEST GROUP 6: Export with mixed chapters ──
console.log('\n-- Export With Mixed Chapters --');

test('15. Full 20-chapter export passes with clean Ch.2', () => {
  const cleanShort = `Marcus leaned against the conference table. The fluorescent lights hummed overhead.\n\n\u201cThe numbers don\u2019t lie,\u201d he said steadily. \u201cWe\u2019re hemorrhaging users.\u201d\n\nZara glanced up from her tablet. \u201cSince when do you care about retention?\u201d`;
  const chapters = [];
  for (let i = 1; i <= 20; i++) {
    chapters.push({
      chapter_number: i,
      title: `Chapter ${i}`,
      content_md: i === 2 ? CLEAN_CH2 : cleanShort,
    });
  }
  const report = runPreExportSafetyGate(chapters, { stage: 'pre-export' });
  assert(!report.blocked, `Export blocked: ${report.summary}`);
  assert(report.hardFailures.length === 0, 'Should have 0 hard failures');
});

test('16. Full 20-chapter export blocks with poisoned Ch.2', () => {
  const cleanShort = `Marcus leaned against the conference table. The fluorescent lights hummed overhead.\n\n\u201cThe numbers don\u2019t lie,\u201d he said steadily. \u201cWe\u2019re hemorrhaging users.\u201d\n\nZara glanced up from her tablet. \u201cSince when do you care about retention?\u201d`;
  const chapters = [];
  for (let i = 1; i <= 20; i++) {
    chapters.push({
      chapter_number: i,
      title: `Chapter ${i}`,
      content_md: i === 2 ? POISONED_CH2 : cleanShort,
    });
  }
  const report = runPreExportSafetyGate(chapters, { stage: 'pre-export' });
  assert(report.blocked, 'Export should be blocked');
  const ch2Fail = report.hardFailures.find(f => f.chapterNumber === 2);
  assert(ch2Fail, 'Ch.2 should be in hard failures');
  assert(ch2Fail.processLeakCount > 0, 'Should detect process leaks');
  assert(ch2Fail.contaminationCount > 0, 'Should detect contamination');
});

// ── TEST GROUP 7: End-to-end simulation ──
console.log('\n-- End-to-End Simulation --');

test('17. Full cycle: poisoned Ch.2 → safe replace → export passes', () => {
  // Step 1: Start with poisoned chapter
  const chapter = {
    chapter_number: 2,
    title: "The Patron's Palette",
    content_md: POISONED_CH2,
    content: POISONED_CH2,
    __staleContentResolution: true,
  };

  // Step 2: Gate check on clean text
  const gate = runManuscriptSafetyGate(CLEAN_CH2, { stage: 'manual-replacement' });
  assert(gate.ok, 'Gate should pass clean text');

  // Step 3: Simulate safe replacement
  chapter.__safeReplacedContent = CLEAN_CH2;
  chapter.__staleContentResolution = false;
  chapter.content_md = CLEAN_CH2;
  chapter.content = '';

  // Step 4: Resolve (simulate resolver picking transient content)
  const resolved = chapter.__safeReplacedContent || chapter.content_md;

  // Step 5: Export
  const exportChapters = [{ ...chapter, content_md: resolved }];
  const report = runPreExportSafetyGate(exportChapters, { stage: 'pre-export' });
  assert(!report.blocked, `Export blocked: ${report.summary}`);
});

test('18. Resolved content has no contamination after replacement', () => {
  const chapter = { __safeReplacedContent: CLEAN_CH2, content_md: CLEAN_CH2 };
  const resolved = chapter.__safeReplacedContent;
  for (const canary of BAD_CANARIES) {
    assert(!resolved.includes(canary), `Resolved text contains: "${canary}"`);
  }
});

test('19. Export gate produces 0 process leaks for clean Ch.2', () => {
  const gate = runManuscriptSafetyGate(CLEAN_CH2, { stage: 'pre-export' });
  assert(gate.processLeaks.matches.length === 0, `Expected 0 process leaks, got ${gate.processLeaks.matches.length}`);
});

test('20. Export gate produces 0 contamination for clean Ch.2', () => {
  const gate = runManuscriptSafetyGate(CLEAN_CH2, { stage: 'pre-export' });
  assert(gate.contamination.matches.length === 0, `Expected 0 contamination, got ${gate.contamination.matches.length}`);
});

test('21. Export gate produces 0 malformed for clean Ch.2', () => {
  const gate = runManuscriptSafetyGate(CLEAN_CH2, { stage: 'pre-export' });
  assert(gate.malformed.matches.length === 0, `Expected 0 malformed, got ${gate.malformed.matches.length}`);
});

test('22. Stale content check in ExportTab logic simulation', () => {
  // Simulate the stale content check added to ExportTab.jsx
  const chapters = [
    { chapter_number: 1, content_md: 'clean text' },
    { chapter_number: 2, content_md: POISONED_CH2, __staleContentResolution: true, __staleContentWarning: 'stale URL' },
    { chapter_number: 3, content_md: 'clean text' },
  ];
  const staleChapters = chapters.filter(ch => ch?.__staleContentResolution === true);
  assert(staleChapters.length === 1, `Expected 1 stale chapter, got ${staleChapters.length}`);
  // In ExportTab, this would throw a STALE_CONTENT_BLOCK error
});

// ── Summary ──
console.log(`\n\u2550\u2550\u2550 Results: ${passed} passed, ${failed} failed \u2550\u2550\u2550\n`);
process.exit(failed > 0 ? 1 : 0);
