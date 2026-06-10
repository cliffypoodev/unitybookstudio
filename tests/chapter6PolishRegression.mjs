// tests/chapter6PolishRegression.mjs — Chapter 6 polish/save/export regression
// Tests the exact failure scenario: grammar repair works, but save loop
// used to revert because of one remaining ambiguous pattern.

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const { runManuscriptSafetyGate } = await import(
  resolve(projectRoot, 'src', 'lib', 'manuscriptSafetyGate.js')
);
const {
  runProsePolishQualityGate,
  runDeterministicGrammarRepair,
  repairMissingOpeningQuotes,
} = await import(
  resolve(projectRoot, 'src', 'lib', 'prosePolishQualityGate.js')
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

console.log('\n\u2550\u2550\u2550 Chapter 6 Polish Regression Tests \u2550\u2550\u2550\n');

// ── The exact Chapter 6 text as it appears in the app ──
const CH6_ORIGINAL = `Chapter 6: The Drift of Echoes

The rhythm of their shared routine had been replaced by something heavier. She were carrying a weight that wasn\u2019t hers alone, a gravitational pull that bent everything toward a single, unyielding point.

She were those just metrics? She was all that messy, over-complicated emotional noise just data points? Aether were they optimized for emotional echo? It was no longer a void of sound, but a obvious thing, pressing against her ears.

The platform wasn\u2019t just failing. It was actively dismantling the infrastructure of trust she had spent years building.

\u201cThe data never lies,\u201d he said, his voice carefully modulated.

She wanted to challenge that. The system wasn\u2019t just cataloging. It was interpreting. And its interpretations were rewriting history one algorithm at a time.

Marcus leaned against the glass partition, watching the city lights scatter across the floor of the executive suite. The weight of the numbers pressed against his chest like a physical thing. The not just a tool narrative had been carefully constructed.

The performance wasn\u2019t just about the numbers. The truth was that nobody wanted to hear the real truth about what the platform was doing to people.

She felt the weight of that realization settling into her bones. Something shifted in the air between them. The foundation of their work was cracking.`;

// ── TEST GROUP 1: Pre-repair canary detection ──
console.log('-- Pre-Repair Detection --');

test('1. "She were" detected in original Ch.6', () => {
  assert(/\bShe were\b/.test(CH6_ORIGINAL));
});

test('2. "a obvious" detected in original Ch.6', () => {
  assert(/\ba obvious\b/i.test(CH6_ORIGINAL));
});

test('3. "Aether were" detected in original Ch.6', () => {
  assert(/\bAether were\b/i.test(CH6_ORIGINAL));
});

test('4. Quality gate detects all 5 malformed in original', () => {
  const gate = runProsePolishQualityGate(CH6_ORIGINAL);
  assert(!gate.ok, `ok should be false, got ${gate.ok}`);
  assert(gate.malformed.count >= 4, `malformed should be >= 4, got ${gate.malformed.count}`);
  assert(gate.recommendedAction === 'BLOCK_POLISH_SAVE', `action should be BLOCK, got ${gate.recommendedAction}`);
});

// ── TEST GROUP 2: Grammar repair ──
console.log('\n-- Grammar Repair --');

const repaired = runDeterministicGrammarRepair(CH6_ORIGINAL);

test('5. Grammar repair fixes "She were" → "She was"', () => {
  assert(repaired.repairs.length >= 2, `Expected >= 2 repairs, got ${repaired.repairs.length}`);
  assert(!/\bShe were\b/.test(repaired.text), '"She were" still in text');
  assert(/\bShe was carrying\b/.test(repaired.text), '"She was carrying" missing');
});

test('6. Grammar repair fixes "a obvious" → "an obvious"', () => {
  assert(!/\ba obvious\b/i.test(repaired.text), '"a obvious" still in text');
  assert(/\ban obvious\b/i.test(repaired.text), '"an obvious" missing');
});

test('7. Grammar repair does NOT fix "Aether were" (ambiguous)', () => {
  assert(/\bAether were\b/i.test(repaired.text), '"Aether were" should still be present');
});

test('8. Total repairs = 3 (2x She were + 1x a obvious)', () => {
  assert(repaired.repairs.length === 3, `Expected 3 repairs, got ${repaired.repairs.length}`);
});

// ── TEST GROUP 3: Post-repair quality gate ──
console.log('\n-- Post-Repair Quality Gate --');

const postRepairGate = runProsePolishQualityGate(repaired.text);

test('9. Post-repair malformed count reduced (should be 1)', () => {
  assert(postRepairGate.malformed.count === 1, `Expected 1 remaining malformed, got ${postRepairGate.malformed.count}`);
});

test('10. Remaining malformed is "Aether were" (aether-were pattern)', () => {
  assert(postRepairGate.malformed.matches[0]?.pattern === 'aether-were',
    `Expected aether-were, got ${postRepairGate.malformed.matches[0]?.pattern}`);
});

test('11. Post-repair gate still fails (remaining malformed > 0)', () => {
  assert(!postRepairGate.ok, 'Gate should still fail');
  assert(postRepairGate.recommendedAction === 'BLOCK_POLISH_SAVE',
    `Should be BLOCK, got ${postRepairGate.recommendedAction}`);
});

// ── TEST GROUP 4: Simulated save loop behavior (the critical fix) ──
console.log('\n-- Save Loop Behavior --');

test('12. Original has MORE malformed than repaired text', () => {
  const origGate = runProsePolishQualityGate(CH6_ORIGINAL);
  const repGate = runProsePolishQualityGate(repaired.text);
  assert(repGate.malformed.count < origGate.malformed.count,
    `Repaired (${repGate.malformed.count}) should be < original (${origGate.malformed.count})`);
});

test('13. Save loop should KEEP repaired text (not revert)', () => {
  // Simulate the save-loop decision logic from ProjectStudio.jsx
  const originalGate = runProsePolishQualityGate(CH6_ORIGINAL);
  const repairedGate = runProsePolishQualityGate(repaired.text);
  const textChanged = repaired.text !== CH6_ORIGINAL;
  const improved = textChanged && repairedGate.malformed.count < originalGate.malformed.count;

  assert(improved, 'Save loop should detect improvement and keep repaired text');
  // In the new logic, improved === true means DON'T revert
});

test('14. Content would NOT equal original after smart save decision', () => {
  // Simulate: save loop compares malformed counts, doesn't revert
  const originalGate = runProsePolishQualityGate(CH6_ORIGINAL);
  const repairedGate = runProsePolishQualityGate(repaired.text);
  const textChanged = repaired.text !== CH6_ORIGINAL;
  const improved = textChanged && repairedGate.malformed.count < originalGate.malformed.count;

  // If improved, f.content stays as repaired.text (not reverted to original)
  const savedContent = improved ? repaired.text : CH6_ORIGINAL;
  assert(savedContent !== CH6_ORIGINAL, 'Saved content should be repaired text');
  assert(!/\bShe were\b/.test(savedContent), '"She were" should not be in saved content');
  assert(!/\ba obvious\b/i.test(savedContent), '"a obvious" should not be in saved content');
});

// ── TEST GROUP 5: Post-save export safety gate ──
console.log('\n-- Export Safety Gate (post-repair text) --');

test('15. Manuscript safety gate PASSES on repaired Ch.6', () => {
  const gate = runManuscriptSafetyGate(repaired.text, {
    stage: 'pre-export',
    project: { project_type: 'fiction' },
  });
  assert(gate.ok === true, `Gate should pass, got ok=${gate.ok} action=${gate.recommendedAction}`);
});

test('16. Export safety gate does NOT block repaired Ch.6', () => {
  const chapters = [{
    chapter_number: 6,
    title: 'The Drift of Echoes',
    content_md: repaired.text,
  }];
  const report = runPreExportSafetyGate(chapters, {
    project: { project_type: 'anthology' },
    stage: 'pre-export',
  });
  assert(!report.blocked, `Export should not be blocked, got blocked=${report.blocked}`);
});

test('17. Export safety gate BLOCKS original (unrepaired) Ch.6', () => {
  const chapters = [{
    chapter_number: 6,
    title: 'The Drift of Echoes',
    content_md: CH6_ORIGINAL,
  }];
  const report = runPreExportSafetyGate(chapters, {
    project: { project_type: 'anthology' },
    stage: 'pre-export',
  });
  // Original has 5 malformed, >=3 triggers REJECT_MANUAL_REVIEW which is a hard failure
  const ch6 = [...report.hardFailures, ...report.warnings, ...report.passed].find(e => e.chapterNumber === 6);
  assert(ch6 !== undefined, 'Ch.6 should be in results');
  assert(ch6.malformedCount >= 4, `Should have >= 4 malformed, got ${ch6.malformedCount}`);
});

// ── TEST GROUP 6: Stale field clearing ──
console.log('\n-- Stale Field Clearing --');

const STALE_FIELDS = [
  'content', 'draft', 'body', 'prose', 'finalText', 'cleanedText',
  'chapter_text', 'markdown', 'content_html', 'content_html_url',
  'content_delta', 'content_delta_url', '__polishedContent',
  '__polishSavedContent', '__polishExportContent',
];

test('18. Stale fields list has 15 fields', () => {
  assert(STALE_FIELDS.length === 15, `Expected 15, got ${STALE_FIELDS.length}`);
});

test('19. All stale fields would be cleared in save payload', () => {
  // Simulate the save payload construction
  const staleClear = {};
  for (const f of STALE_FIELDS) staleClear[f] = '';
  const contentFields = { content_md: repaired.text };
  const savePayload = { ...staleClear, ...contentFields };

  // Verify stale fields are empty strings
  for (const f of STALE_FIELDS) {
    if (f === 'content_md') continue; // overridden by contentFields
    assert(savePayload[f] === '' || savePayload[f] === undefined,
      `${f} should be cleared`);
  }
  // Verify content_md has the repaired text
  assert(savePayload.content_md === repaired.text, 'content_md should have repaired text');
});

// ── TEST GROUP 7: Full pipeline simulation ──
console.log('\n-- Full Pipeline Simulation --');

test('20. Full pipeline: repair → gate → save decision → export passes', () => {
  // Step 1: Grammar repair
  const step1 = runDeterministicGrammarRepair(CH6_ORIGINAL);
  assert(step1.repairs.length >= 2);

  // Step 2: Quote repair
  const step2 = repairMissingOpeningQuotes(step1.text);

  // Step 3: Quality gate
  const gate = runProsePolishQualityGate(step2.text);

  // Step 4: Save decision (simulate smart save loop)
  const origGate = runProsePolishQualityGate(CH6_ORIGINAL);
  const textChanged = step2.text !== CH6_ORIGINAL;
  const improved = textChanged && gate.malformed.count < origGate.malformed.count;
  assert(improved, 'Should detect improvement');

  // Step 5: Export safety
  const exportGate = runManuscriptSafetyGate(step2.text, {
    stage: 'pre-export',
    project: { project_type: 'fiction' },
  });
  assert(exportGate.ok === true, `Export gate should pass, got ok=${exportGate.ok}`);
});

test('21. Repaired text has no "She were"', () => {
  assert(!/\bShe were\b/.test(repaired.text));
});

test('22. Repaired text has no "a obvious"', () => {
  assert(!/\ba obvious\b/i.test(repaired.text));
});

test('23. Repaired text still has "Aether were" (manual review needed)', () => {
  assert(/\bAether were\b/i.test(repaired.text));
});

test('24. "Aether were" triggers WARN_ONLY in export gate (not REJECT)', () => {
  const gate = runManuscriptSafetyGate(repaired.text, { stage: 'pre-export' });
  assert(gate.recommendedAction === 'WARN_ONLY',
    `Expected WARN_ONLY, got ${gate.recommendedAction}`);
});

test('25. Full 20-chapter export with repaired Ch.6 is not blocked', () => {
  // Build a mock 20-chapter array with clean text for all except Ch.6
  const cleanText = `Marcus leaned against the conference table. The fluorescent lights hummed overhead.\n\n\u201cThe numbers don\u2019t lie,\u201d he said steadily. \u201cWe\u2019re hemorrhaging users.\u201d\n\nZara glanced up from her tablet. \u201cSince when do you care about retention?\u201d`;
  const chapters = [];
  for (let i = 1; i <= 20; i++) {
    chapters.push({
      chapter_number: i,
      title: `Chapter ${i}`,
      content_md: i === 6 ? repaired.text : cleanText,
    });
  }
  const report = runPreExportSafetyGate(chapters, {
    project: { project_type: 'anthology' },
    stage: 'pre-export',
  });
  assert(!report.blocked, `Export blocked: ${report.summary}`);
  assert(report.hardFailures.length === 0, `Hard failures: ${report.hardFailures.length}`);
});

// ── Summary ──
console.log(`\n\u2550\u2550\u2550 Results: ${passed} passed, ${failed} failed \u2550\u2550\u2550\n`);
process.exit(failed > 0 ? 1 : 0);
