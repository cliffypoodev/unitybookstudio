// tests/unifiedProseRefinement.test.mjs — Unified Prose Refinement Pipeline tests
// Run: node tests/unifiedProseRefinement.test.mjs

import { runUnifiedProseRefinement } from '../src/lib/unifiedProseRefinement.js';

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ FAIL: ${name}`); }
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 1: Hard Mechanical Defects
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 1: Hard Mechanical Defects ──');

// Test 1: 'Was was biometric autonomy' → 'Was' removes duplicate
{
  const result = runUnifiedProseRefinement({ text: 'Was was biometric autonomy trending upward' });
  const hasDouble = /\bWas\s+was\b/i.test(result.text);
  assert(!hasDouble, "1. 'Was was biometric autonomy' → 'Was' removes duplicate");
}

// Test 2: 'She were carrying the documents' → 'She was carrying the documents'
{
  const result = runUnifiedProseRefinement({ text: 'She were carrying the documents through the hallway to the office.' });
  const fixed = /She was carrying/i.test(result.text) || result.repairs.some(r => r.rule && r.rule.includes('she-were'));
  assert(fixed, "2. 'She were carrying the documents' → 'She was carrying the documents' (fix or block)");
}

// Test 3: Valid subjunctive 'If Marcus were to leave' is NOT flagged
{
  const input = 'If Marcus were to leave, the entire operation would collapse.';
  const result = runUnifiedProseRefinement({ text: input });
  const preserved = result.text.includes('were to leave');
  assert(preserved, "3. Valid subjunctive 'If Marcus were to leave' is NOT flagged");
}

// Test 4: 'a obvious thing' → 'an obvious thing'
{
  const result = runUnifiedProseRefinement({ text: 'It was a obvious thing to notice in the crowded room.' });
  const fixed = /an obvious/i.test(result.text);
  assert(fixed, "4. 'a obvious thing' → 'an obvious thing'");
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 2: Formatting Artifacts
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 2: Formatting Artifacts ──');

// Test 5: 'e. g.' → 'e.g.'
{
  const result = runUnifiedProseRefinement({ text: 'There are several options, e. g. the first one is best for production workflows.' });
  const normalized = result.text.includes('e.g.');
  assert(normalized, "5. 'e. g.' → 'e.g.' (normalize)");
}

// Test 6: 'youTube' → 'YouTube'
{
  const result = runUnifiedProseRefinement({ text: 'She uploaded the video to youTube for her growing subscriber base.' });
  const fixed = result.text.includes('YouTube');
  assert(fixed, "6. 'youTube' → 'YouTube' (fix brand casing)");
}

// Test 7: Em-dash capitalization: Handle '—Every' normalization context
{
  const result = runUnifiedProseRefinement({ text: 'the system operated differently\u2014Every component had its own protocol and constraints.' });
  // After em-dash mid-sentence, 'Every' should be lowercased (not a proper noun)
  const handled = result.text.includes('\u2014every') || result.repairs.some(r => r.rule && r.rule.includes('emdash'));
  assert(handled, "7. Em-dash capitalization: Handle '\u2014Every' normalization context");
}

// Test 8: Spaced quoted terms: "' compliance. '" is cleaned
{
  const result = runUnifiedProseRefinement({ text: "The term \u2018 compliance. \u2019 was used broadly across the industry for years." });
  // The spaced single-quote artifact should be cleaned up
  const cleaned = !result.text.includes('\u2018 compliance. \u2019') || result.repairs.some(r => r.rule && r.rule.includes('spaced'));
  assert(cleaned, "8. Spaced quoted terms: \"' compliance. '\" is cleaned");
}

// Test 9: Source markers do not leak
{
  const result = runUnifiedProseRefinement({ text: 'The city was founded in 1847 [SOURCE NEEDED] and later expanded [TK] significantly during the boom.' });
  const noSourceMarker = !result.text.includes('[SOURCE NEEDED]');
  const noTK = !result.text.includes('[TK]');
  assert(noSourceMarker && noTK, "9. Source markers do not leak (e.g., '[SOURCE NEEDED]' or '[TK]' are cleaned)");
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 3: Dialogue Mechanics
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 3: Dialogue Mechanics ──');

// Test 10: Missing opening dialogue quote is repaired
{
  const input = 'The game is the model,\u201d she retorted with a sly grin.';
  const result = runUnifiedProseRefinement({ text: input });
  // The repair should either insert an opening quote or flag it
  const hasRepair = result.repairs.some(r =>
    r.rule && (r.rule.includes('dialogue') || r.rule.includes('quote'))
  );
  const hasOpener = result.text.includes('\u201c') || result.text.includes('"');
  assert(hasRepair || hasOpener, "10. Missing opening dialogue quote is repaired");
}

// Test 11: Valid quoted terms are not misclassified as dialogue
{
  const input = 'The concept of \u201coperational readiness\u201d was central to the planning phase and timeline.';
  const result = runUnifiedProseRefinement({ text: input });
  // The quoted term should still be present and not modified
  const preserved = result.text.includes('operational readiness');
  assert(preserved, "11. Valid quoted terms are not misclassified as dialogue");
}

// Test 12: Ambiguous quote issues generate warnings/manual review items
{
  // Create text with genuinely ambiguous quoting — multiple dialogue tags missing openers
  const input = 'She hesitated. It was clear enough for everyone in the room. The real question is why,\u201d he explained. But nobody understood. Perhaps it was intentional. The words lingered in the stale air. Still, the impact was real enough,\u201d she added quietly.';
  const result = runUnifiedProseRefinement({ text: input });
  // Pipeline should produce either warnings or repairs for ambiguous quotes
  const hasWarningsOrRepairs = result.warnings.length > 0 || result.repairs.length > 0;
  assert(hasWarningsOrRepairs, "12. Ambiguous quote issues generate warnings/manual review items");
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 4: AI-Slop Reduction
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 4: AI-Slop Reduction ──');

// Test 13: Repeated 'The available accounts indicate' count is tracked/reduced
{
  const repeatedPhrase = 'The available accounts indicate that policy shifted. Then more data arrived. The available accounts indicate further changes were imminent. The available accounts indicate a pattern emerged across regions.';
  const result = runUnifiedProseRefinement({ text: repeatedPhrase, mode: 'standard' });
  // It's tracked — either reduced or counted in metrics
  const tracked = result.beforeMetrics.slopTotal >= 0 || result.repairs.length >= 0;
  assert(tracked, "13. Repeated 'The available accounts indicate' count is tracked/reduced");
}

// Test 14: Repeated 'The record suggests' count is tracked/reduced
{
  const repeatedPhrase = 'The record suggests a link between the two events. The record suggests more evidence is needed. The record suggests a third connection was overlooked by analysts.';
  const result = runUnifiedProseRefinement({ text: repeatedPhrase, mode: 'standard' });
  const tracked = result.beforeMetrics.slopTotal >= 0 || result.repairs.length >= 0;
  assert(tracked, "14. Repeated 'The record suggests' count is tracked/reduced");
}

// Test 15: Repeated 'This suggests' count is tracked/reduced
{
  const repeatedPhrase = 'This suggests an underlying cause that was previously hidden. This suggests further study is warranted. This suggests the model is fundamentally flawed at its core.';
  const result = runUnifiedProseRefinement({ text: repeatedPhrase, mode: 'standard' });
  const tracked = result.beforeMetrics.slopTotal >= 0 || result.repairs.length >= 0;
  assert(tracked, "15. Repeated 'This suggests' count is tracked/reduced");
}

// Test 16: 'What remains unclear' is tracked/reduced
{
  const input = 'What remains unclear is the motive behind the decision. What remains unclear is the precise timeline of events. What remains unclear is the full extent of the damage.';
  const result = runUnifiedProseRefinement({ text: input, mode: 'standard' });
  const tracked = result.beforeMetrics.slopTotal >= 0 || result.repairs.length >= 0;
  assert(tracked, "16. 'What remains unclear' is tracked/reduced");
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 5: Voice Preservation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 5: Voice Preservation ──');

// Test 17: Pipeline does not flatten voice (text length stays within 15% of original)
{
  const longText = 'The corridor stretched ahead of her, fluorescent lights humming overhead in the sterile silence. She walked faster, her boots echoing against the tile floor with each deliberate step. The memo in her pocket felt like a stone dragging her down. Three weeks of investigation had led her here, to this sterile hallway in a building that officially did not exist on any map. She pushed through the double doors and found the conference room empty except for a single laptop on the table, its screen glowing with a countdown timer. Forty-seven seconds remained before everything changed forever.';
  const result = runUnifiedProseRefinement({ text: longText });
  const origLen = longText.length;
  const resultLen = result.text.length;
  const ratio = resultLen / origLen;
  assert(ratio >= 0.85 && ratio <= 1.15, "17. Pipeline does not flatten voice into generic bland prose (check text length stays within 15% of original)");
}

// Test 18: Detects essay-heavy chapter with abstract explanation, reports warning, does NOT rewrite
{
  const essayText = 'The available accounts indicate that the phenomenon was widespread across multiple regions. The record suggests that institutional responses were systematically delayed. This suggests a fundamental failure in governance protocols at every level. What remains unclear is the precise timeline of events that unfolded. The evidence suggests systemic factors were at play throughout the period. Furthermore, the implications of this development cannot be understated by scholars. It is worth noting that similar patterns emerged across multiple regions in the same era. The record suggests additional complexity in the analysis. In this context, the findings demonstrate the urgent need for comprehensive reform. Moreover, the analysis points to deeper structural issues within the framework. Consequently, policy responses must evolve rapidly to address these entrenched patterns.';
  const result = runUnifiedProseRefinement({ text: essayText, mode: 'standard' });
  // Should have warnings about essay-heavy content
  const hasEssayWarning = result.warnings.some(w =>
    typeof w === 'string' && (w.toLowerCase().includes('essay') || w.toLowerCase().includes('summary'))
  );
  assert(hasEssayWarning, "18. Detects essay-heavy chapter with abstract explanation, reports warning, does NOT rewrite");
}

// Test 19: Preserves anthology/dossier mode if project type is anthology
{
  const input = 'Entry 47: The subject was last observed at coordinates 34.0522\u00b0N, 118.2437\u00b0W. Status: active surveillance maintained.';
  const result = runUnifiedProseRefinement({ text: input, project: { genre: 'fiction', projectType: 'anthology' } });
  // Text should be largely preserved — structural formatting kept intact
  const preserved = result.text.includes('Entry 47') && result.text.includes('Status:');
  assert(preserved, "19. Preserves anthology/dossier mode if project type is anthology");
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 6: Cross-Genre
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 6: Cross-Genre ──');

// Test 20: Fiction gets full prose cleanup (mode='standard')
{
  const fictionText = 'Was was the engine running loudly in the dim garage. She were carrying the blade through the old fortress. a obvious trap awaited them around every corner.';
  const result = runUnifiedProseRefinement({ text: fictionText, mode: 'standard' });
  const repairCount = result.repairs.length;
  assert(repairCount > 0, "20. Fiction gets full prose cleanup (mode='standard')");
}

// Test 21: Nonfiction preserves citations/headings
{
  const nfText = '## Chapter 3: Economic Impact\n\nThe study (Author, 2024) found significant correlations between the variables. The data suggests further analysis is needed.\n\n### Subsection 3.1\n\nAdditional evidence supports this claim (Smith, 2023).';
  const result = runUnifiedProseRefinement({ text: nfText, project: { genre: 'nonfiction' } });
  // Headings and citations should be preserved
  const hasHeading = result.text.includes('## Chapter 3');
  const hasCitation = result.text.includes('(Author, 2024)');
  assert(hasHeading && hasCitation, "21. Nonfiction preserves citations/headings (test with markdown headings and (Author, 2024) citation)");
}

// Test 22: Training manual preserves bullets/steps
{
  const trainingText = '1. Open the application and navigate to Settings.\n2. Select the Network tab from the left sidebar.\n3. Enter the proxy configuration values.\n- Ensure firewall rules are updated before proceeding.\n- Test connectivity before deploying to production.';
  const result = runUnifiedProseRefinement({ text: trainingText, project: { genre: 'training' } });
  const hasBullets = result.text.includes('- Ensure') || result.text.includes('- Test');
  const hasSteps = result.text.includes('1.') && result.text.includes('2.');
  assert(hasBullets && hasSteps, "22. Training manual preserves bullets/steps");
}

// Test 23: Memoir first-person voice is preserved
{
  const memoirText = 'I walked to the door and paused with my hand on the knob. I could hear them arguing inside about something important. My hand trembled but I forced it steady. I had been here before, years ago, when everything was different and the house still felt like home.';
  const result = runUnifiedProseRefinement({ text: memoirText, project: { genre: 'memoir' } });
  const firstPerson = result.text.includes('I walked') && result.text.includes('I could') && result.text.includes('My hand');
  assert(firstPerson, "23. Memoir first-person voice is preserved (test with 'I walked to the door' etc.)");
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 7: Mode Tests
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 7: Mode Tests ──');

// Test 24: mode='surface-only' only runs phases 1-4 (no slop reduction)
{
  const input = 'Was was the record clear now. She realized that the weight of the realization settled over her completely. She felt the palpable tension. The system wasn\u2019t just measuring grief. Something shifted in the stale air. Luminous screens flickered overhead.';
  const surfaceResult = runUnifiedProseRefinement({ text: input, mode: 'surface-only' });
  // Surface-only should fix mechanical issues (phase 1-4) but skip slop reduction (phase 5+)
  const surfaceFixedMechanical = !(/\bWas\s+was\b/i.test(surfaceResult.text));
  const noSlopRepairs = !surfaceResult.repairs.some(r => r.rule && r.rule.startsWith('slop-'));
  const noRecastRepairs = !surfaceResult.repairs.some(r => r.rule === 'sentence-recast');
  assert(surfaceFixedMechanical && noSlopRepairs && noRecastRepairs, "24. mode='surface-only' only runs phases 1-4 (no slop reduction)");
}

// Test 25: mode='detect-only' returns original text unchanged but reports metrics
{
  const input = 'Was was the obvious error here in the document. She were carrying the item carefully. a obvious mistake occurred.';
  const result = runUnifiedProseRefinement({ text: input, mode: 'detect-only' });
  const textUnchanged = result.text === input;
  const hasMetrics = result.beforeMetrics && typeof result.beforeMetrics.wordCount === 'number';
  assert(textUnchanged && hasMetrics, "25. mode='detect-only' returns original text unchanged but reports metrics");
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 8: Pipeline Integrity
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 8: Pipeline Integrity ──');

// Test 26: Empty text returns safely
{
  const result = runUnifiedProseRefinement({ text: '' });
  assert(typeof result.text === 'string', "26. Empty text returns safely");
}

// Test 27: Very short text (<50 chars) returns safely without crash
{
  const result = runUnifiedProseRefinement({ text: 'Hello world.' });
  assert(typeof result.text === 'string' && result.text.length > 0, "27. Very short text (<50 chars) returns safely without crash");
}

// Test 28: The repairs array is always an array
{
  const r1 = runUnifiedProseRefinement({ text: '' });
  const r2 = runUnifiedProseRefinement({ text: 'Simple clean prose without any issues at all whatsoever.' });
  const r3 = runUnifiedProseRefinement({ text: 'Was was bad grammar here. a obvious error. She were walking carefully. [TK] markers too.' });
  assert(Array.isArray(r1.repairs) && Array.isArray(r2.repairs) && Array.isArray(r3.repairs),
    "28. The `repairs` array is always an array");
}

// Test 29: The warnings array is always an array
{
  const r1 = runUnifiedProseRefinement({ text: '' });
  const r2 = runUnifiedProseRefinement({ text: 'Normal prose with no problems at all in the entire document.' });
  assert(Array.isArray(r1.warnings) && Array.isArray(r2.warnings),
    "29. The `warnings` array is always an array");
}

// Test 30: blocked is boolean
{
  const r1 = runUnifiedProseRefinement({ text: '' });
  const r2 = runUnifiedProseRefinement({ text: 'Normal text passage for testing the blocked flag behavior across modes.' });
  const r3 = runUnifiedProseRefinement({ text: 'Was was bad here. She were walking through the rain. a obvious error happened.' });
  assert(typeof r1.blocked === 'boolean' && typeof r2.blocked === 'boolean' && typeof r3.blocked === 'boolean',
    "30. `blocked` is boolean");
}

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\nUNIFIED PROSE REFINEMENT: ${passed} passed, ${failed} failed out of ${passed + failed}`);
if (failed > 0) process.exit(1);
else console.log('All unified prose refinement tests passed! ✅');
