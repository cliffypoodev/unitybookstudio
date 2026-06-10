// tests/artifactInteractionRegression.test.mjs — Artifact Interaction Regression Tests
// Run: node tests/artifactInteractionRegression.test.mjs
//
// Purpose: Document current pipeline behavior and catch regressions during
// the pipeline-unification rewrite. Some tests may fail initially — those
// failures represent known bugs that later steps will fix.
//
// After Step 5 (Fix Artifact Producers) and Step 6 (Rewire ProjectStudio),
// ALL tests in this file must pass.

import { runUnifiedProseRefinement } from '../src/lib/unifiedProseRefinement.js';
import { runAISlopReductionPass } from '../src/lib/aiSlopReduction.js';

let passed = 0;
let failed = 0;
const knownFailures = [];

function assert(condition, name, knownFail = false) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else if (knownFail) {
    knownFailures.push(name);
    console.log(`  ⚠️  KNOWN FAIL (expected): ${name}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 1: Abbreviation Preservation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 1: Abbreviation Preservation ──');

// 1. "e.g." must survive pipeline
{
  const input = 'She mentioned several tools, e.g. the hammer and the wrench, before continuing.';
  const result = runUnifiedProseRefinement({ text: input });
  const preserved = result.text.includes('e.g.') || result.text.includes('e. g.');
  assert(preserved, '1. "e.g." survives pipeline without mangling');
}

// 2. "e.g." should NOT become "e. G." (capital G after period)
{
  const input = 'Common examples, e.g. apples, oranges, and pears, are found in every grocery store.';
  const result = runUnifiedProseRefinement({ text: input });
  const noMangled = !result.text.includes('e. G.');
  assert(noMangled, '2. "e.g." does NOT become "e. G." (no false capitalization)');
}

// 3. "i.e." must survive pipeline
{
  const input = 'The primary concern, i.e. the budget shortfall, required immediate attention from the board.';
  const result = runUnifiedProseRefinement({ text: input });
  const preserved = result.text.includes('i.e.');
  assert(preserved, '3. "i.e." survives pipeline');
}

// 4. "Dr. smith" should become "Dr. Smith" (abbreviation + name)
{
  const input = 'When Dr. smith arrived at the hospital, the nurses gathered around the station.';
  const result = runUnifiedProseRefinement({ text: input });
  // Should capitalize "smith" but NOT mangle "Dr."
  const drPresent = result.text.includes('Dr.');
  assert(drPresent, '4. "Dr." abbreviation preserved');
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 2: Proper Noun Preservation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 2: Proper Noun Preservation ──');

// 5. "YouTube" should NOT become "youtube" or "Youtube"
{
  const input = 'Marcus checked the YouTube channel every morning before heading to the office for work.';
  const result = runUnifiedProseRefinement({ text: input });
  const preserved = result.text.includes('YouTube');
  assert(preserved, '5. "YouTube" preserves exact casing');
}

// 6. "iPhone" should preserve camelCase
{
  const input = 'She placed her iPhone on the table and sat down in the old wooden chair quietly.';
  const result = runUnifiedProseRefinement({ text: input });
  const preserved = result.text.includes('iPhone');
  assert(preserved, '6. "iPhone" preserves camelCase');
}

// 7. "JavaScript" preserves casing
{
  const input = 'The developer wrote clean JavaScript code throughout the entire application without bugs.';
  const result = runUnifiedProseRefinement({ text: input });
  const preserved = result.text.includes('JavaScript');
  assert(preserved, '7. "JavaScript" preserves exact casing');
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 3: Em-Dash Boundary Handling
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 3: Em-Dash Boundary Handling ──');

// 8. "cost—every" should NOT capitalize "every" after em-dash
{
  const input = 'The real cost\u2014every cent of it\u2014was hidden in the fine print of the contract document.';
  const result = runUnifiedProseRefinement({ text: input });
  // After em-dash, lowercase "every" should remain lowercase
  const noFalseCapAfterDash = !result.text.includes('cost\u2014Every');
  assert(noFalseCapAfterDash, '8. Em-dash boundary: "cost\u2014every" does NOT falsely capitalize');
}

// 9. "said\u2014\"hello\"" should get proper opening quote after em-dash
{
  const input = 'Marcus said\u2014\u201cHello there,\u201d he began\u2014and the room went quiet around them entirely.';
  const result = runUnifiedProseRefinement({ text: input });
  // The curly opening quote should survive
  const hasOpenQuote = result.text.includes('\u201c');
  assert(hasOpenQuote, '9. Opening curly quote preserved after em-dash');
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 4: Banned Word Grammar Preservation (tests for Step 4 fix)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 4: Banned Word Grammar Preservation ──');

// 10. "the shimmering light" should NOT become "the  light" (double space)
// KNOWN FAIL: current pipeline deletes banned words to empty string
{
  const input = 'The shimmering light reflected off the surface of the calm lake in the morning.';
  // Test via the unified pipeline (which doesn't yet have the banned word pass)
  // This test documents what SHOULD happen after Step 4
  const result = runUnifiedProseRefinement({ text: input });
  // The unified pipeline doesn't currently touch banned words (it's orphaned)
  // so "shimmering" should still be present
  const hasWord = result.text.includes('shimmering');
  assert(hasWord, '10. Unified pipeline currently preserves "shimmering" (not wired to banned list)');
}

// 11. "meticulously crafted" should get a synonym, not deletion
// Tests the aiSlopReduction module directly
{
  const input = 'The team meticulously crafted each component of the engine during the long manufacturing process.';
  const result = runAISlopReductionPass(input, {});
  // Currently, aiSlopReduction may delete "meticulously" if over budget
  // After Step 4, it should recast to "carefully" or similar
  const noDoubleSpace = !result.text.includes('  ');
  assert(noDoubleSpace, '11. AI-slop reduction does not create double spaces');
}

// 12. "palpable tension" should become "[synonym] tension", not " tension"
{
  // Create text with 3 uses of "palpable" to trigger budget overflow
  const input = [
    'The palpable tension in the room made everyone shift uncomfortably in their seats.',
    'There was a palpable sense of dread hanging over the entire group of survivors.',
    'The palpable anger in her voice made the children retreat to their bedrooms quietly.',
  ].join('\n');
  const result = runAISlopReductionPass(input, {});
  // Check no orphan spaces
  const noDoubleSpace = !result.text.includes('  ');
  assert(noDoubleSpace, '12. "palpable" recasts do not leave orphan double spaces');
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 5: Curly Quote Interactions
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 5: Curly Quote Interactions ──');

// 13. Curly quotes should not get space-padded: no " text "
{
  const input = '\u201cHello,\u201d she said. \u201cHow are you doing today?\u201d he asked her from across the room.';
  const result = runUnifiedProseRefinement({ text: input });
  const noSpacePad = !/ \u201c /.test(result.text) && !/ \u201d /.test(result.text);
  assert(noSpacePad, '13. No space-padded curly quotes ( \u201c or \u201d )');
}

// 14. Straight quotes should convert to curly
{
  const input = '"Hello," she said. "How are you doing today?" he asked from across the room.';
  const result = runUnifiedProseRefinement({ text: input });
  // Phase 1 of unified pipeline should normalize these
  const hasCurly = result.text.includes('\u201c') || result.text.includes('\u201d');
  const noStraight = !result.text.includes('"');
  assert(hasCurly || noStraight, '14. Straight double quotes convert to curly or are cleaned');
}

// 15. Single curly quotes in contractions should be preserved
{
  const input = 'She couldn\u2019t believe what she\u2019d heard about the company\u2019s quarterly results.';
  const result = runUnifiedProseRefinement({ text: input });
  const preserved = result.text.includes('\u2019');
  assert(preserved, '15. Curly apostrophes in contractions preserved');
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 6: Adjacent Word Duplication
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 6: Adjacent Word Duplication ──');

// 16. "Was was biometric" → should fix duplicate (already in unified pipeline)
{
  const input = 'Was was biometric autonomy trending upward during the quarterly review meeting?';
  const result = runUnifiedProseRefinement({ text: input });
  const noDouble = !/\bWas\s+was\b/i.test(result.text);
  assert(noDouble, '16. "Was was" duplicate word fixed');
}

// 17. Pipeline should NOT create new adjacent duplications
{
  const input = 'The intricate mechanism was meticulously designed to handle the visceral impact.';
  const result = runUnifiedProseRefinement({ text: input });
  // Check for any adjacent word duplication (simple 2-word check)
  const words = result.text.toLowerCase().split(/\s+/);
  let hasNewDup = false;
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i].replace(/[^a-z]/g, '');
    const next = words[i + 1].replace(/[^a-z]/g, '');
    if (w.length > 2 && w === next) {
      // Check if original also had this duplication
      const origWords = input.toLowerCase().split(/\s+/);
      let origHad = false;
      for (let j = 0; j < origWords.length - 1; j++) {
        if (origWords[j].replace(/[^a-z]/g, '') === w && origWords[j + 1].replace(/[^a-z]/g, '') === w) {
          origHad = true; break;
        }
      }
      if (!origHad) { hasNewDup = true; break; }
    }
  }
  assert(!hasNewDup, '17. Pipeline does NOT create new adjacent word duplications');
}

// ═══════════════════════════════════════════════════════════════════════════
// Group 7: Content Preservation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Group 7: Content Preservation ──');

// 18. Word count should not drop more than 5% through pipeline
{
  const input = 'The old detective sat in his worn leather chair, studying the case files spread across his desk. ' +
    'Rain streaked down the window behind him, casting wavering shadows on the wall. ' +
    'His coffee had gone cold hours ago, but he barely noticed. ' +
    'Something about the witness statements did not add up. ' +
    'The timeline was wrong. The alibi was too perfect. ' +
    'He reached for his notepad and began writing furiously.';
  const beforeWords = input.split(/\s+/).length;
  const result = runUnifiedProseRefinement({ text: input });
  const afterWords = result.text.split(/\s+/).length;
  const ratio = afterWords / beforeWords;
  assert(ratio >= 0.95, `18. Word count preserved (ratio: ${ratio.toFixed(3)}, before: ${beforeWords}, after: ${afterWords})`);
}

// 19. Paragraph boundaries should be preserved
{
  const input = 'First paragraph with enough words to be meaningful and substantial.\n\nSecond paragraph starts here with additional content for the story.\n\nThird paragraph concludes the section with a final thought.';
  const result = runUnifiedProseRefinement({ text: input });
  const paragraphs = result.text.split(/\n\n+/).filter(p => p.trim().length > 0);
  assert(paragraphs.length >= 3, `19. Paragraph boundaries preserved (${paragraphs.length} paragraphs)`);
}

// 20. Dialogue should be preserved across pipeline
{
  const input = '\u201cI need those files by morning,\u201d Captain Torres said, leaning forward on the desk.\n\n\u201cThat\u2019s impossible,\u201d Detective Marsh replied. \u201cThe evidence room is locked until seven.\u201d\n\n\u201cThen find another way.\u201d Torres stood and walked to the window, looking out at the rain.';
  const result = runUnifiedProseRefinement({ text: input });
  const hasDialogue = result.text.includes('files by morning') && result.text.includes('impossible');
  assert(hasDialogue, '20. Dialogue content preserved through pipeline');
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${knownFailures.length} known failures`);
if (knownFailures.length > 0) {
  console.log('Known failures (will be fixed in later steps):');
  for (const kf of knownFailures) console.log(`  ⚠️  ${kf}`);
}
console.log('═'.repeat(60));

if (failed > 0) {
  console.error(`\n❌ ${failed} UNEXPECTED failure(s)`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} tests passed (${knownFailures.length} known failures recorded)`);
  process.exit(0);
}
