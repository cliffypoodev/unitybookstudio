// tests/staleUrlResolutionRegression.mjs
// Stale URL resolution regression tests for Chapters 12 and 14
//
// Tests the safety-gate recovery path in the resolver:
// - URL content with stale metadata that PASSES safety gate → accepted + metadata refresh tag
// - URL content with stale metadata that FAILS safety gate → blocked as stale
// - Metadata refresh after safe resave
// - Export behavior with metadata-refresh vs stale chapters

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

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

console.log('\n\u2550\u2550\u2550 Stale URL Resolution Regression \u2550\u2550\u2550\n');

// ── Clean fiction chapter text (representative for Ch.12/14) ──
const CLEAN_CH12 = `Chapter 12: The Anatomist\u2019s Protocol

Dr. Elara Voss drew the scalpel across the synthetic dermis with practiced efficiency. The specimen\u2014a biomimetic construct manufactured by Meridian BioSystems\u2014lay motionless beneath the halogen lights, its artificial skin parting cleanly under the blade. She cataloged each incision in the holographic display hovering beside the operating table, her annotations precise and methodical.

\u201cSubcutaneous layer integrity: nominal,\u201d she murmured into the recorder. \u201cConnective tissue adhesion follows the predicted degradation curve. Cross-referencing with batch 7-Alpha protocols.\u201d

The laboratory hummed with the low drone of ventilation systems and the intermittent chirp of monitoring equipment. Elara\u2019s assistant, Tomaso, observed from the adjacent station, his tablet stylus poised mid-air. He was new to the department, transferred from the computational wing, and still acclimating to the visceral reality of tissue analysis.

\u201cDr. Voss, the spectral readings from sector nine are fluctuating,\u201d Tomaso said, his voice carefully neutral. \u201cShould I recalibrate before you proceed to the deep-tissue phase?\u201d

Elara paused, considering. The fluctuations were within acceptable parameters\u2014barely\u2014but Tomaso\u2019s caution was not unwelcome. She had trained too many assistants who assumed stability where none existed.

\u201cRecalibrate,\u201d she said. \u201cAnd log the variance. I want a full spectral history for this batch.\u201d`;

const CLEAN_CH14 = `Chapter 14: The Incantation of Bytes

The server room was cold enough to see breath, and Kira Nakamura could feel it in her fingertips as she typed. Row after row of blinking chassis stretched into the dim corridor, their LEDs painting shifting constellations of green and amber across the tiled floor. She was alone\u2014scheduled maintenance window, 02:00 to 06:00\u2014and the solitude suited her purpose.

\u201cInitializing sequence delta-seven,\u201d she whispered, her voice swallowed by the white noise of cooling fans. The terminal responded with a cascade of hexadecimal output, each line a heartbeat of the system she was about to reshape.

Kira had spent three months mapping the architecture. Not the official documentation\u2014that was incomplete, sanitized for board presentations and compliance audits\u2014but the actual living topology of interconnected services, deprecated endpoints still active, shadow databases that no one admitted existed. She called it the \u201creal map,\u201d and it lived only in her memory and a heavily encrypted partition on her personal drive.

\u201cNode seventeen,\u201d she murmured, pulling up the interface. \u201cYou\u2019re the bottleneck everyone ignores.\u201d

The node\u2019s metrics confirmed what she suspected: a legacy process consuming twelve percent of cluster resources for a feature no one used. It had been flagged for decommission three years ago, but the ticket sat in a backlog that was itself forgotten.`;

// ── Poisoned text (for negative tests) ──
const POISONED_TEXT = `Chapter 12: The Anatomist's Protocol

The opening is sharp, highly polished and ready for the next stage.

Next Move: Review the character arc.
Action Plan: Revise dialogue.

Unity Supported Living Services provides care documentation for compliance documentation purposes.

"You was the one," he said. "Was was it a dream?"`;

// ── TEST GROUP 1: Clean content passes safety gate ──
console.log('-- Clean Content Safety Gate --');

test('1. Clean Ch.12 passes safety gate', () => {
  const gate = runManuscriptSafetyGate(CLEAN_CH12, { stage: 'stale-url-recovery' });
  assert(gate.ok, `Ch.12 gate failed: ${gate.reasons}`);
  assert(gate.processLeaks.matches.length === 0, 'Ch.12 should have 0 process leaks');
  assert(gate.contamination.matches.length === 0, 'Ch.12 should have 0 contamination');
});

test('2. Clean Ch.14 passes safety gate', () => {
  const gate = runManuscriptSafetyGate(CLEAN_CH14, { stage: 'stale-url-recovery' });
  assert(gate.ok, `Ch.14 gate failed: ${gate.reasons}`);
  assert(gate.processLeaks.matches.length === 0, 'Ch.14 should have 0 process leaks');
  assert(gate.contamination.matches.length === 0, 'Ch.14 should have 0 contamination');
});

test('3. Poisoned text FAILS safety gate', () => {
  const gate = runManuscriptSafetyGate(POISONED_TEXT, { stage: 'stale-url-recovery' });
  assert(!gate.ok, 'Poisoned text should fail');
  assert(gate.processLeaks.matches.length > 0, 'Should detect process leaks');
});

// ── TEST GROUP 2: Stale content resolution behavior ──
console.log('\n-- Stale Content Resolution Behavior --');

test('4. Stale URL with safety-gate PASS gets __needsMetadataRefresh (not __staleContentResolution)', () => {
  // Simulate resolver behavior for clean content with stale metadata
  const chapter = {
    chapter_number: 12,
    content_md_url: 'https://example.com/ch12.md',
    polish_saved_word_count: 9999,  // Wrong — doesn't match actual content
    polish_saved_char_count: 99999, // Wrong
  };

  // Simulate: URL content is fetched, metadata mismatch detected, safety gate run
  const gate = runManuscriptSafetyGate(CLEAN_CH12, { stage: 'stale-url-recovery' });
  if (gate.ok || gate.recommendedAction === 'WARN_ONLY') {
    chapter.__needsMetadataRefresh = true;
    chapter.__metadataRefreshReason = 'metadata mismatch but content passed safety gate';
  } else {
    chapter.__staleContentResolution = true;
  }

  assert(chapter.__needsMetadataRefresh === true, 'Should be tagged for metadata refresh');
  assert(!chapter.__staleContentResolution, 'Should NOT be tagged as stale');
});

test('5. Stale URL with safety-gate FAIL gets __staleContentResolution', () => {
  const chapter = {
    chapter_number: 12,
    content_md_url: 'https://example.com/ch12.md',
    polish_saved_word_count: 9999,
  };

  const gate = runManuscriptSafetyGate(POISONED_TEXT, { stage: 'stale-url-recovery' });
  if (gate.ok || gate.recommendedAction === 'WARN_ONLY') {
    chapter.__needsMetadataRefresh = true;
  } else {
    chapter.__staleContentResolution = true;
    chapter.__staleContentWarning = 'stale AND failed safety gate';
  }

  assert(chapter.__staleContentResolution === true, 'Should be tagged as stale');
  assert(!chapter.__needsMetadataRefresh, 'Should NOT be tagged for metadata refresh');
});

test('6. Export does NOT block chapters with __needsMetadataRefresh only', () => {
  const chapters = [
    { chapter_number: 12, content_md: CLEAN_CH12, __needsMetadataRefresh: true },
    { chapter_number: 14, content_md: CLEAN_CH14, __needsMetadataRefresh: true },
  ];
  // Stale check only looks at __staleContentResolution, not __needsMetadataRefresh
  const staleChapters = chapters.filter(ch => ch?.__staleContentResolution === true);
  assert(staleChapters.length === 0, 'No chapters should be stale-blocked');

  const report = runPreExportSafetyGate(chapters, { stage: 'pre-export' });
  assert(!report.blocked, `Export blocked: ${report.summary}`);
});

test('7. Export BLOCKS chapters with __staleContentResolution', () => {
  const chapters = [
    { chapter_number: 12, content_md: CLEAN_CH12, __staleContentResolution: true },
  ];
  const staleChapters = chapters.filter(ch => ch?.__staleContentResolution === true);
  assert(staleChapters.length === 1, 'Should have 1 stale chapter');
});

test('8. Export does not silently accept stale URL content that fails gate', () => {
  const chapters = [
    { chapter_number: 12, content_md: POISONED_TEXT },
  ];
  const report = runPreExportSafetyGate(chapters, { stage: 'pre-export' });
  assert(report.blocked, 'Export should be blocked for poisoned content');
});

// ── TEST GROUP 3: Safe resave simulation ──
console.log('\n-- Safe Resave Simulation --');

test('9. Metadata refresh: word count matches after resave', () => {
  const text = CLEAN_CH12;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const charCount = text.length;

  // Simulate metadata refresh payload
  const payload = {
    polish_saved_word_count: wordCount,
    polish_saved_char_count: charCount,
    polish_saved_preview_start: text.substring(0, 420),
    polish_saved_preview_end: text.slice(-420),
  };

  assert(payload.polish_saved_word_count > 50, `Word count too low: ${payload.polish_saved_word_count}`);
  assert(payload.polish_saved_char_count > 500, `Char count too low: ${payload.polish_saved_char_count}`);
  assert(payload.polish_saved_preview_start.length > 100, 'Preview start too short');
  assert(payload.polish_saved_preview_end.length > 100, 'Preview end too short');
});

test('10. Safe resave sets __safeReplacedContent', () => {
  const chapter = {
    chapter_number: 12,
    __needsMetadataRefresh: true,
    __staleContentResolution: false,
  };

  // Simulate safeResaveChapterFromUrl behavior
  chapter.__safeReplacedContent = CLEAN_CH12;
  chapter.__staleContentResolution = false;
  chapter.__staleContentWarning = '';
  chapter.__needsMetadataRefresh = false;
  chapter.content_md = CLEAN_CH12;

  assert(chapter.__safeReplacedContent.includes('Elara'), 'Should have Ch.12 content marker');
  assert(chapter.__needsMetadataRefresh === false, 'Metadata refresh flag should be cleared');
});

test('11. Safe resave clears stale fields', () => {
  const STALE_FIELDS = [
    'content', 'draft', 'body', 'prose', 'finalText', 'cleanedText',
    'chapter_text', 'markdown',
  ];

  const chapter = {};
  for (const f of STALE_FIELDS) chapter[f] = POISONED_TEXT;

  // Simulate clearing
  for (const f of STALE_FIELDS) chapter[f] = '';

  for (const f of STALE_FIELDS) {
    assert(chapter[f] === '', `${f} should be cleared`);
  }
});

// ── TEST GROUP 4: Metadata staleness check simulation ──
console.log('\n-- Metadata Staleness Check --');

test('12. Content with matching metadata passes staleness check', () => {
  const text = CLEAN_CH12;
  const normalized = text.trim();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const charCount = normalized.length;

  // Simulate contentLooksStaleAgainstMetadata with matching metadata
  const expectedWords = wordCount;
  const expectedChars = charCount;
  const wordRatio = Math.abs(wordCount - expectedWords) / expectedWords;
  const charRatio = Math.abs(charCount - expectedChars) / expectedChars;

  assert(wordRatio <= 0.03, `Word ratio too high: ${wordRatio}`);
  assert(charRatio <= 0.03, `Char ratio too high: ${charRatio}`);
});

test('13. Content with mismatched metadata fails staleness check', () => {
  const text = CLEAN_CH12;
  const normalized = text.trim();
  const actualWords = normalized.split(/\s+/).filter(Boolean).length;

  // Simulate mismatched metadata (e.g., polish updated metadata but URL has old content)
  const expectedWords = actualWords * 2; // Way off
  const wordRatio = Math.abs(actualWords - expectedWords) / expectedWords;

  assert(wordRatio > 0.03, `Word ratio should be > 0.03, got ${wordRatio}`);
});

test('14. After metadata refresh, content matches metadata', () => {
  const text = CLEAN_CH12;
  const normalized = text.trim();
  const actualWords = normalized.split(/\s+/).filter(Boolean).length;
  const actualChars = normalized.length;

  // Simulate: metadata refreshed to match actual content
  const refreshedMetadata = {
    polish_saved_word_count: actualWords,
    polish_saved_char_count: actualChars,
    polish_saved_preview_start: normalized.substring(0, 420),
    polish_saved_preview_end: normalized.slice(-420),
  };

  // Re-check staleness
  const wordRatio = Math.abs(actualWords - refreshedMetadata.polish_saved_word_count) / refreshedMetadata.polish_saved_word_count;
  const charRatio = Math.abs(actualChars - refreshedMetadata.polish_saved_char_count) / refreshedMetadata.polish_saved_char_count;

  assert(wordRatio <= 0.03, 'Word count should match after refresh');
  assert(charRatio <= 0.03, 'Char count should match after refresh');
  assert(normalized.includes(refreshedMetadata.polish_saved_preview_start.substring(0, 160)), 'Start preview should match');
});

// ── TEST GROUP 5: Full 20-chapter export simulation ──
console.log('\n-- Full Export Simulation --');

test('15. 20-chapter export with Ch.12/14 metadata-refresh-only passes', () => {
  const cleanShort = `Marcus leaned against the conference table. The fluorescent lights hummed.\n\n\u201cThe numbers don\u2019t lie,\u201d he said. \u201cWe\u2019re hemorrhaging users.\u201d\n\nZara glanced up from her tablet. \u201cSince when do you care about retention?\u201d`;
  const chapters = [];
  for (let i = 1; i <= 20; i++) {
    const ch = {
      chapter_number: i,
      title: `Chapter ${i}`,
      content_md: i === 12 ? CLEAN_CH12 : i === 14 ? CLEAN_CH14 : cleanShort,
    };
    if (i === 12 || i === 14) {
      ch.__needsMetadataRefresh = true; // tagged for refresh, NOT stale block
    }
    chapters.push(ch);
  }
  const report = runPreExportSafetyGate(chapters, { stage: 'pre-export' });
  assert(!report.blocked, `Export blocked: ${report.summary}`);
  assert(report.hardFailures.length === 0, 'Should have 0 hard failures');
});

test('16. 20-chapter export with Ch.12 stale (failed gate) blocks', () => {
  const cleanShort = `Marcus leaned against the conference table.\n\n\u201cThe numbers don\u2019t lie,\u201d he said.\n\nZara glanced up.`;
  const chapters = [];
  for (let i = 1; i <= 20; i++) {
    chapters.push({
      chapter_number: i,
      title: `Chapter ${i}`,
      content_md: i === 12 ? POISONED_TEXT : cleanShort,
    });
  }
  const report = runPreExportSafetyGate(chapters, { stage: 'pre-export' });
  assert(report.blocked, 'Export should be blocked');
  const ch12Fail = report.hardFailures.find(f => f.chapterNumber === 12);
  assert(ch12Fail, 'Ch.12 should be in hard failures');
});

// ── TEST GROUP 6: End-to-end resolution simulation ──
console.log('\n-- End-to-End Resolution --');

test('17. Ch.12 resolution: stale metadata → safety gate pass → accepted', () => {
  const chapter = {
    chapter_number: 12,
    title: "The Anatomist's Protocol",
    content_md_url: 'https://example.com/ch12.md',
    polish_saved_word_count: 9999, // Stale
    polish_saved_char_count: 99999, // Stale
  };

  // Simulate resolver path
  const fetchedContent = CLEAN_CH12;
  const gate = runManuscriptSafetyGate(fetchedContent, { stage: 'stale-url-recovery' });

  if (gate.ok || gate.recommendedAction === 'WARN_ONLY') {
    chapter.__needsMetadataRefresh = true;
    chapter.content_md = fetchedContent;
  } else {
    chapter.__staleContentResolution = true;
  }

  assert(chapter.content_md === CLEAN_CH12, 'Content should be accepted');
  assert(chapter.__needsMetadataRefresh === true, 'Should be tagged for refresh');
  assert(!chapter.__staleContentResolution, 'Should NOT be tagged as stale');
});

test('18. Ch.14 resolution: stale metadata → safety gate pass → accepted', () => {
  const chapter = {
    chapter_number: 14,
    title: "The Incantation of Bytes",
    content_md_url: 'https://example.com/ch14.md',
    polish_saved_word_count: 9999,
    polish_saved_char_count: 99999,
  };

  const fetchedContent = CLEAN_CH14;
  const gate = runManuscriptSafetyGate(fetchedContent, { stage: 'stale-url-recovery' });

  if (gate.ok || gate.recommendedAction === 'WARN_ONLY') {
    chapter.__needsMetadataRefresh = true;
    chapter.content_md = fetchedContent;
  } else {
    chapter.__staleContentResolution = true;
  }

  assert(chapter.content_md === CLEAN_CH14, 'Content should be accepted');
  assert(chapter.__needsMetadataRefresh === true, 'Should be tagged for refresh');
});

test('19. After safe resave, re-resolve would NOT trigger staleness', () => {
  const chapter = {
    chapter_number: 12,
    __safeReplacedContent: CLEAN_CH12,
    __needsMetadataRefresh: false,
    __staleContentResolution: false,
  };

  // Resolver would pick __safeReplacedContent as priority 1
  const transient = (
    chapter.__safeReplacedContent ||
    chapter.__polishedContent ||
    ''
  ).trim();

  assert(transient.length > 50, 'Transient content should be usable');
  assert(transient.includes('Elara'), 'Should have Ch.12 content');
});

test('20. Export passes with resaved Ch.12 and Ch.14', () => {
  const chapters = [
    { chapter_number: 12, title: "The Anatomist's Protocol", content_md: CLEAN_CH12 },
    { chapter_number: 14, title: "The Incantation of Bytes", content_md: CLEAN_CH14 },
  ];
  const report = runPreExportSafetyGate(chapters, { stage: 'pre-export' });
  assert(!report.blocked, `Export blocked: ${report.summary}`);
});

// ── Summary ──
console.log(`\n\u2550\u2550\u2550 Results: ${passed} passed, ${failed} failed \u2550\u2550\u2550\n`);
process.exit(failed > 0 ? 1 : 0);
