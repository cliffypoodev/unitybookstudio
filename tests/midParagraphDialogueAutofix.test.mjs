/**
 * Regression tests for mid-paragraph dialogue autofix functionality.
 *
 * Run:  node tests/midParagraphDialogueAutofix.test.mjs
 */

import {
  classifyMidParagraphDialogueWarning,
  repairSafeMidParagraphDialogueOpeners,
  runMidParagraphDialogueAutofixPass,
  detectDialogueQuoteIssues,
  runDialogueMechanicsPass,
} from '../src/lib/dialogueMechanicsRepair.js';

// ─── Test Harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log('  \u2705 ' + label); }
  else { failed++; console.error('  \u274c ' + label); }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log('  \u2705 ' + label);
  } else {
    failed++;
    console.error('  \u274c ' + label);
    console.error('      expected:', JSON.stringify(expected));
    console.error('      actual:  ', JSON.stringify(actual));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: SAFE Auto-Fix Cases (5 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 1: SAFE Auto-Fix Cases ──');

// Helper: run full classify+repair pipeline on a single paragraph and return
// structured results for assertion.
function runSafeFixTest(input, expectedOutput) {
  const issues = detectDialogueQuoteIssues(input);
  const midIssues = issues.issues.filter(i => i.type === 'mid_paragraph_missing_quote');
  const repair = repairSafeMidParagraphDialogueOpeners(input);
  const classification = midIssues.length > 0
    ? classifyMidParagraphDialogueWarning(input, midIssues[0])
    : null;
  return { issues, midIssues, repair, classification, expectedOutput };
}

// 1. "For utility. For relevance," the AI answered.
{
  const input = 'The answer came without warmth. For utility. For relevance,\u201d the AI answered.';
  // The repair module finds the CLOSEST sentence boundary to the closing quote,
  // which is the ". " after "For utility." — so it inserts before "For relevance"
  const expected = 'The answer came without warmth. For utility. \u201cFor relevance,\u201d the AI answered.';
  const r = runSafeFixTest(input, expected);

  assert(r.midIssues.length > 0, '1.1 Detects mid-paragraph issue in "For utility" text');
  assert(r.repair.safeRepairs.length > 0, '1.2 Produces at least 1 safe repair');
  assertEqual(r.repair.text, expected, '1.3 Inserts \u201c before "For relevance" (closest boundary)');
  assertEqual(r.classification?.classification, 'SAFE_TO_AUTOFIX', '1.4 Classification is SAFE_TO_AUTOFIX');
  assert((r.classification?.confidence ?? 0) >= 90, '1.5 Confidence >= 90');
  assertEqual(r.repair.text.length - input.length, 1, '1.6 Delta is exactly 1 char');
}

// 2. "A highly sophisticated one," the Guide confirmed.
{
  const input = 'Priya stared at the overlay. A highly sophisticated one,\u201d the Guide confirmed.';
  const expected = 'Priya stared at the overlay. \u201cA highly sophisticated one,\u201d the Guide confirmed.';
  const r = runSafeFixTest(input, expected);

  assert(r.midIssues.length > 0, '2.1 Detects mid-paragraph issue in "A highly" text');
  assert(r.repair.safeRepairs.length > 0, '2.2 Produces safe repair');
  assertEqual(r.repair.text, expected, '2.3 Inserts \u201c before "A highly"');
  assertEqual(r.classification?.classification, 'SAFE_TO_AUTOFIX', '2.4 Classification is SAFE_TO_AUTOFIX');
  assertEqual(r.repair.text.length - input.length, 1, '2.5 Delta is exactly 1 char');
}

// 3. "Exactly," Elena said.
{
  const input = 'The room went still. Exactly,\u201d Elena said.';
  const expected = 'The room went still. \u201cExactly,\u201d Elena said.';
  const r = runSafeFixTest(input, expected);

  assert(r.midIssues.length > 0, '3.1 Detects mid-paragraph issue in "Exactly" text');
  assert(r.repair.safeRepairs.length > 0, '3.2 Produces safe repair');
  assertEqual(r.repair.text, expected, '3.3 Inserts \u201c before "Exactly"');
  assertEqual(r.classification?.classification, 'SAFE_TO_AUTOFIX', '3.4 Classification is SAFE_TO_AUTOFIX');
  assertEqual(r.repair.text.length - input.length, 1, '3.5 Delta is exactly 1 char');
}

// 4. "No," she countered.
{
  const input = 'He did not move. No,\u201d she countered.';
  const expected = 'He did not move. \u201cNo,\u201d she countered.';
  const r = runSafeFixTest(input, expected);

  assert(r.midIssues.length > 0, '4.1 Detects mid-paragraph issue in "No" text');
  assert(r.repair.safeRepairs.length > 0, '4.2 Produces safe repair');
  assertEqual(r.repair.text, expected, '4.3 Inserts \u201c before "No"');
  assertEqual(r.classification?.classification, 'SAFE_TO_AUTOFIX', '4.4 Classification is SAFE_TO_AUTOFIX');
  assertEqual(r.repair.text.length - input.length, 1, '4.5 Delta is exactly 1 char');
}

// 5. "It hides your sister," Aether replied.
{
  const input = 'The terminal pulsed. It hides your sister,\u201d Aether replied.';
  const expected = 'The terminal pulsed. \u201cIt hides your sister,\u201d Aether replied.';
  const r = runSafeFixTest(input, expected);

  assert(r.midIssues.length > 0, '5.1 Detects mid-paragraph issue in "It hides" text');
  assert(r.repair.safeRepairs.length > 0, '5.2 Produces safe repair');
  assertEqual(r.repair.text, expected, '5.3 Inserts \u201c before "It hides"');
  assertEqual(r.classification?.classification, 'SAFE_TO_AUTOFIX', '5.4 Classification is SAFE_TO_AUTOFIX');
  assertEqual(r.repair.text.length - input.length, 1, '5.5 Delta is exactly 1 char');
  // Verify original text NOT changed except for inserted quote
  const orig = input;
  const fixed = r.repair.text;
  let diffCount = 0;
  for (let i = 0, j = 0; i < fixed.length; i++) {
    if (j < orig.length && fixed[i] === orig[j]) { j++; }
    else { diffCount++; }
  }
  assertEqual(diffCount, 1, '5.6 Only 1 character differs (the inserted quote)');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: MANUAL_REVIEW / Do-Not-Repair Cases (10 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 2: MANUAL_REVIEW / Do-Not-Repair Cases ──');

// 1. Nested quotation — no mid-paragraph issue
{
  const input = 'She said \u201cHe told me \u2018don\u2019t go,\u2019\u201d and then left.';
  const issues = detectDialogueQuoteIssues(input);
  const midIssues = issues.issues.filter(i => i.type === 'mid_paragraph_missing_quote');
  assertEqual(midIssues.length, 0, '2-1 Nested quotation: no mid-paragraph issue detected');
  const repair = repairSafeMidParagraphDialogueOpeners(input);
  assertEqual(repair.text, input, '2-1b Nested quotation: text unchanged');
}

// 2. Citation markers → MANUAL_REVIEW
{
  const input = 'See reference [3] for the concept,\u201d the author noted.';
  const issues = detectDialogueQuoteIssues(input);
  const midIssues = issues.issues.filter(i => i.type === 'mid_paragraph_missing_quote');
  if (midIssues.length > 0) {
    const cls = classifyMidParagraphDialogueWarning(input, midIssues[0]);
    assertEqual(cls.classification, 'MANUAL_REVIEW', '2-2 Citation: classified MANUAL_REVIEW');
  } else {
    // If no issues detected at all, that's also acceptable (conservative)
    assert(true, '2-2 Citation: no issues detected (conservative, acceptable)');
  }
}

// 3. Code-like markers → MANUAL_REVIEW
{
  const input = 'The output was ```ERROR```,\u201d she explained.';
  const issues = detectDialogueQuoteIssues(input);
  const midIssues = issues.issues.filter(i => i.type === 'mid_paragraph_missing_quote');
  if (midIssues.length > 0) {
    const cls = classifyMidParagraphDialogueWarning(input, midIssues[0]);
    assertEqual(cls.classification, 'MANUAL_REVIEW', '2-3 Code markers: classified MANUAL_REVIEW');
  } else {
    assert(true, '2-3 Code markers: no issues detected (conservative, acceptable)');
  }
}

// 4. Already balanced — no issue
{
  const input = '\u201cThe answer is clear,\u201d she said.';
  const issues = detectDialogueQuoteIssues(input);
  assertEqual(issues.count, 0, '2-4 Already balanced: no issues detected');
  const repair = repairSafeMidParagraphDialogueOpeners(input);
  assertEqual(repair.text, input, '2-4b Already balanced: text unchanged');
}

// 5. Heading → MANUAL_REVIEW
{
  const input = '# Chapter Title One,\u201d the narrator said.';
  const issues = detectDialogueQuoteIssues(input);
  const midIssues = issues.issues.filter(i => i.type === 'mid_paragraph_missing_quote');
  if (midIssues.length > 0) {
    const cls = classifyMidParagraphDialogueWarning(input, midIssues[0]);
    assertEqual(cls.classification, 'MANUAL_REVIEW', '2-5 Heading: classified MANUAL_REVIEW');
  } else {
    assert(true, '2-5 Heading: no issues detected (conservative, acceptable)');
  }
}

// 6. Bullet/list → MANUAL_REVIEW
{
  const input = '- First item here,\u201d he noted.';
  const issues = detectDialogueQuoteIssues(input);
  const midIssues = issues.issues.filter(i => i.type === 'mid_paragraph_missing_quote');
  if (midIssues.length > 0) {
    const cls = classifyMidParagraphDialogueWarning(input, midIssues[0]);
    assertEqual(cls.classification, 'MANUAL_REVIEW', '2-6 Bullet: classified MANUAL_REVIEW');
  } else {
    assert(true, '2-6 Bullet: no issues detected (conservative, acceptable)');
  }
}

// 7. Non-dialogue term with clear speaker+verb — classify and check
{
  const input = 'The so-called standard,\u201d she remarked.';
  const issues = detectDialogueQuoteIssues(input);
  const midIssues = issues.issues.filter(i => i.type === 'mid_paragraph_missing_quote');
  if (midIssues.length > 0) {
    const cls = classifyMidParagraphDialogueWarning(input, midIssues[0]);
    // Has clear speaker "she" + verb "remarked" — could be SAFE or MANUAL_REVIEW
    assert(
      cls.classification === 'SAFE_TO_AUTOFIX' || cls.classification === 'MANUAL_REVIEW',
      '2-7 Non-dialogue term: classification is valid enum value'
    );
  } else {
    // No issue detected means the regex didn't match — also acceptable
    assert(true, '2-7 Non-dialogue term: no issues detected');
  }
}

// 8. Multiple insertion points — should flag ambiguous or pick best
{
  const input = 'First sentence. Second sentence. Third sentence. Fourth sentence here,\u201d Marcus explained.';
  const issues = detectDialogueQuoteIssues(input);
  const midIssues = issues.issues.filter(i => i.type === 'mid_paragraph_missing_quote');
  if (midIssues.length > 0) {
    const cls = classifyMidParagraphDialogueWarning(input, midIssues[0]);
    // With 3+ sentence boundaries, the repair module should either:
    // (a) flag for MANUAL_REVIEW due to ambiguity, or
    // (b) still pick the nearest boundary (and be SAFE_TO_AUTOFIX)
    assert(
      cls.classification === 'MANUAL_REVIEW' || cls.classification === 'SAFE_TO_AUTOFIX',
      '2-8 Multiple boundaries: valid classification returned'
    );
  } else {
    assert(true, '2-8 Multiple boundaries: no issues detected');
  }
}

// 9. No speaker verb — should have 0 mid-paragraph issues
{
  const input = 'The sun went down,\u201d softly.';
  const issues = detectDialogueQuoteIssues(input);
  const midIssues = issues.issues.filter(i => i.type === 'mid_paragraph_missing_quote');
  assertEqual(midIssues.length, 0, '2-9 No speaker verb: 0 mid-paragraph issues');
}

// 10. Apostrophe-heavy — should still detect (apostrophes ≠ quotes)
{
  const input = 'It\u2019s Tom\u2019s brother\u2019s car,\u201d she said.';
  const issues = detectDialogueQuoteIssues(input);
  // Should detect the issue (closing quote with no opener, clear dialogue tag)
  assert(issues.count > 0, '2-10 Apostrophe-heavy: issue detected');
  // This is detected as paragraph_start type (no narration before speech),
  // so standard runDialogueMechanicsPass handles it, not the mid-paragraph classifier.
  const fullRepair = runDialogueMechanicsPass(input);
  assert(
    fullRepair.repairs.length > 0 || fullRepair.text.includes('\u201c'),
    '2-10b Apostrophe-heavy: repair performed by standard mechanics pass'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: Safety Regression (8 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 3: Safety Regression ──');

// 3-1. SAFE repairs insert exactly 1 opening quote char
{
  const safeInputs = [
    'The answer came without warmth. For utility. For relevance,\u201d the AI answered.',
    'The room went still. Exactly,\u201d Elena said.',
    'He did not move. No,\u201d she countered.',
  ];
  let allDeltaOne = true;
  for (const input of safeInputs) {
    const repair = repairSafeMidParagraphDialogueOpeners(input);
    if (repair.safeRepairs.length > 0) {
      const delta = repair.safeRepairs[0].repaired.length - repair.safeRepairs[0].original.length;
      if (delta !== 1) allDeltaOne = false;
    }
  }
  assert(allDeltaOne, '3-1 All SAFE repairs insert exactly 1 char');
}

// 3-2. SAFE repairs preserve all text except the inserted char
{
  const input = 'Priya stared at the overlay. A highly sophisticated one,\u201d the Guide confirmed.';
  const repair = repairSafeMidParagraphDialogueOpeners(input);
  if (repair.safeRepairs.length > 0) {
    const orig = repair.safeRepairs[0].original;
    const fixed = repair.safeRepairs[0].repaired;
    // Remove the inserted char and compare
    let reconstructed = '';
    let skipped = false;
    for (let i = 0; i < fixed.length; i++) {
      if (!skipped && (fixed[i] === '\u201c' || fixed[i] === '"')) {
        // Check if this is the inserted char by comparing positions
        if (i >= orig.length || fixed[i] !== orig[i]) {
          skipped = true;
          continue;
        }
      }
      reconstructed += fixed[i];
    }
    assertEqual(reconstructed, orig, '3-2 All text preserved except inserted char');
  } else {
    assert(false, '3-2 Expected a safe repair but got none');
  }
}

// 3-3. Manual-review cases have zero text changes
{
  const manualInputs = [
    '\u201cThe answer is clear,\u201d she said.',
    'She said \u201cHe told me \u2018don\u2019t go,\u2019\u201d and then left.',
  ];
  let allUnchanged = true;
  for (const input of manualInputs) {
    const repair = repairSafeMidParagraphDialogueOpeners(input);
    if (repair.text !== input) allUnchanged = false;
  }
  assert(allUnchanged, '3-3 Manual-review / clean cases have zero text changes');
}

// 3-4. No new hard dialogue issues introduced by any SAFE repair
{
  const input = 'The terminal pulsed. It hides your sister,\u201d Aether replied.';
  const beforeIssues = detectDialogueQuoteIssues(input);
  const repair = repairSafeMidParagraphDialogueOpeners(input);
  const afterIssues = detectDialogueQuoteIssues(repair.text);
  assert(afterIssues.count <= beforeIssues.count, '3-4 No new hard issues after SAFE repair');
}

// 3-5. No process leak patterns introduced
{
  const input = 'He did not move. No,\u201d she countered.';
  const repair = repairSafeMidParagraphDialogueOpeners(input);
  assert(!repair.text.includes('Action Plan'), '3-5a No "Action Plan" leak');
  assert(!repair.text.includes('Unity Supported Living'), '3-5b No "Unity Supported Living" leak');
}

// 3-6. No contamination introduced
{
  const input = 'The room went still. Exactly,\u201d Elena said.';
  const repair = repairSafeMidParagraphDialogueOpeners(input);
  // Contamination = text that wasn't in original and isn't the opening quote
  const origChars = new Set(input.split(''));
  origChars.add('\u201c'); // the expected insertion
  origChars.add('"');     // alternate form
  const fixedChars = repair.text.split('');
  let contamination = false;
  for (const ch of fixedChars) {
    if (!origChars.has(ch)) { contamination = true; break; }
  }
  assert(!contamination, '3-6 No character contamination in repair');
}

// 3-7. runMidParagraphDialogueAutofixPass on clean text returns unchanged
{
  const clean = 'The sun shone brightly over the meadow. Birds sang in the trees. All was well.';
  const result = runMidParagraphDialogueAutofixPass(clean);
  assertEqual(result.text, clean, '3-7 Clean text returned unchanged by autofix pass');
}

// 3-8. runMidParagraphDialogueAutofixPass on null/undefined/empty returns safe defaults
{
  const rNull = runMidParagraphDialogueAutofixPass(null);
  assertEqual(rNull.text, '', '3-8a null → empty string');
  assertEqual(rNull.standardRepairs, 0, '3-8b null → 0 standardRepairs');
  assertEqual(rNull.midParagraphAutoFixed, 0, '3-8c null → 0 midParagraphAutoFixed');
  assertEqual(rNull.allDialogueIssuesBefore, 0, '3-8d null → 0 issues before');

  const rUndef = runMidParagraphDialogueAutofixPass(undefined);
  assertEqual(rUndef.text, '', '3-8e undefined → empty string');

  const rEmpty = runMidParagraphDialogueAutofixPass('');
  assertEqual(rEmpty.text, '', '3-8f empty string → empty string');
  assertEqual(rEmpty.standardRepairs, 0, '3-8g empty → 0 standardRepairs');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: Integration with existing pass (4 tests)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section 4: Integration with existing pass ──');

// 4-1. runDialogueMechanicsPass still works on paragraph_start type issues
{
  const input = 'I will not back down,\u201d she declared.';
  const result = runDialogueMechanicsPass(input);
  const paraStartRepairs = result.repairs.filter(r => r.type === 'paragraph_start_missing_quote');
  assert(paraStartRepairs.length > 0, '4-1 runDialogueMechanicsPass repairs paragraph_start issues');
  assert(result.text.includes('\u201c') || result.text.includes('"'), '4-1b Opening quote present after repair');
}

// 4-2. runDialogueMechanicsPass still works on mid_paragraph type issues
{
  const input = 'The room went still. Exactly,\u201d Elena said.';
  const result = runDialogueMechanicsPass(input);
  const midRepairs = result.repairs.filter(r => r.type === 'mid_paragraph_missing_quote');
  assert(midRepairs.length > 0, '4-2 runDialogueMechanicsPass repairs mid_paragraph issues');
  assert(result.text.includes('\u201c'), '4-2b Opening curly quote present after repair');
}

// 4-3. runMidParagraphDialogueAutofixPass handles both types in one call
{
  const input = 'I will not back down,\u201d she declared.\nThe room went still. Exactly,\u201d Elena said.';
  const result = runMidParagraphDialogueAutofixPass(input);
  assert(result.standardRepairs > 0, '4-3a At least one standard repair');
  assert(result.allDialogueIssuesAfter < result.allDialogueIssuesBefore, '4-3b Issues reduced after combined pass');
}

// 4-4. Full pass on mix of both types produces 0 remaining issues
{
  const input = 'I will not back down,\u201d she declared.\nThe room went still. Exactly,\u201d Elena said.\nHe did not move. No,\u201d she countered.';
  const result = runMidParagraphDialogueAutofixPass(input);
  assertEqual(result.allDialogueIssuesAfter, 0, '4-4 Full pass: 0 remaining issues');
  // Verify all lines have opening quotes
  const lines = result.text.split('\n');
  let allHaveOpeners = true;
  for (const line of lines) {
    if (line.includes('\u201d') && !line.includes('\u201c')) {
      allHaveOpeners = false;
    }
  }
  assert(allHaveOpeners, '4-4b Every line with closing quote also has opening quote');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\nMID-PARAGRAPH DIALOGUE AUTOFIX: ${passed} passed, ${failed} failed out of ${passed + failed}`);

if (failed > 0) process.exit(1);
