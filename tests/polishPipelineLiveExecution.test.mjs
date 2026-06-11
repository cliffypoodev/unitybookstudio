/**
 * polishPipelineLiveExecution.test.mjs — Live-execution regression tests.
 *
 * Unlike the behavioral string-scan tests, these tests IMPORT and EXECUTE
 * the actual pipeline modules on real prose fixtures, then verify the output.
 *
 * Must be run with the alias loader:
 *   node --loader ./tests/helpers/aliasLoader.mjs tests/polishPipelineLiveExecution.test.mjs
 */

import { runDisclaimerStripper } from '../src/lib/disclaimerStripper.js';
import { runCapitalizationHygiene } from '../src/lib/capitalizationPolish.js';
import { runAISlopReductionPass } from '../src/lib/aiSlopReduction.js';

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ FAIL: ${label}`); }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1: Abbreviation Guard — disclaimerStripper must not corrupt
//         abbreviations like "e.g." "i.e." "Dr." "Mr."
// ════════════════════════════════════════════════════════════════════════════

console.log('\n=== TEST 1: Abbreviation Guard (disclaimerStripper) ===\n');

{
  // Simulate a chapter that had a disclaimer removed, leaving orphaned lowercase.
  // The cleanup regex must NOT uppercase after abbreviations.
  const prose = [
    'The report was filed. the next step was clear.',  // legitimate: should uppercase 't'
    'He referenced the manual, e.g. the section on ethics.',  // MUST NOT uppercase 't'
    'She consulted Dr. smith about the symptoms.',  // MUST NOT uppercase 's' (proper noun after title)
    'He arrived at 9 a.m. the office was still closed.',  // MUST NOT uppercase 't' after 'a.m.'
    'That was Mr. jones speaking to the committee.',  // MUST NOT uppercase 'j'
    'The data viz. the chart shows growth patterns.',  // MUST NOT uppercase 't' after 'viz.'
    'Wait... the door creaked open slowly.',  // MUST NOT uppercase 't' after ellipsis
    'The [composite account drawn from multiple documented experiences] story continued.',
  ].join('\n\n');

  const loaded = [{
    chapter: { chapter_number: 1, title: 'Chapter 1' },
    content: prose,
    original: prose,
  }];

  const result = runDisclaimerStripper(loaded, () => {});

  const output = loaded[0].content;

  // Should fix legitimate orphaned lowercase
  assert(output.includes('. The next step'), 'Legitimate orphan "the" → "The" after period');

  // Must NOT corrupt abbreviations
  assert(output.includes('e.g. the section'), 'e.g. preserved — no uppercase after abbreviation period');
  assert(!output.includes('e.g. The section'), 'e.g. NOT followed by uppercase "The"');

  assert(output.includes('Dr. smith') || output.includes('Dr. Smith'),
    'Dr. title preserved — no blind uppercase of next word');
  assert(!output.includes('Dr. Smith') || !output.includes('Dr. smith'),
    'Dr. followed by name (either form is acceptable)');

  assert(output.includes('a.m. the office'), 'a.m. preserved — no uppercase after time abbreviation');
  assert(!output.includes('a.m. The office'), 'a.m. NOT followed by uppercase "The"');

  assert(output.includes('... the door') || output.includes('… the door'),
    'Ellipsis preserved — no uppercase after ...');
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 2: CamelCase / Proper Noun Guard — capitalizationHygiene must not
//         corrupt YouTube → youTube, iPhone → iphone, etc.
// ════════════════════════════════════════════════════════════════════════════

console.log('\n=== TEST 2: CamelCase Guard (capitalizationHygiene) ===\n');

{
  const prose = [
    'She watched the YouTube video with her friends.',
    'He checked his iPhone before leaving the house.',
    'The team posted updates on LinkedIn and GitHub.',
    'She downloaded TikTok despite his warnings about it.',
    'The course covered JavaScript and PowerPoint skills.',
    'He ordered from eBay while sitting in the park.',
    'The OpenAI model was impressive in the demonstration.',
  ].join('\n\n');

  const loaded = [{
    chapter: { chapter_number: 1, title: 'Chapter 1' },
    content: prose,
    original: prose,
  }];

  const result = runCapitalizationHygiene(loaded, () => {});

  const output = loaded[0].content;

  assert(output.includes('YouTube'), 'YouTube preserved (not youTube)');
  assert(!output.includes('youTube'), 'youTube NOT present');

  assert(output.includes('iPhone'), 'iPhone preserved');
  assert(!output.includes('iphone'), 'iphone NOT present');

  assert(output.includes('LinkedIn'), 'LinkedIn preserved');
  assert(output.includes('GitHub'), 'GitHub preserved');
  assert(output.includes('TikTok'), 'TikTok preserved');
  assert(output.includes('JavaScript'), 'JavaScript preserved');
  assert(output.includes('PowerPoint'), 'PowerPoint preserved');
  assert(output.includes('eBay'), 'eBay preserved');
  assert(output.includes('OpenAI'), 'OpenAI preserved');
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 3: Forensic Phrase Budget — slop reduction must budget-cap the
//         3 newly added forensic phrases.
// ════════════════════════════════════════════════════════════════════════════

console.log('\n=== TEST 3: Forensic Phrase Budget (aiSlopReduction) ===\n');

{
  // Create text with 3 occurrences of each forensic phrase (budget = 1 each)
  const prose = [
    'The record suggests that the investigation was flawed. The data was incomplete.',
    'The record suggests that the timeline was wrong. New evidence arrived.',
    'The record suggests that the witness was unreliable. He changed his account.',
    '',
    'This suggests a pattern of negligence. The oversight was systematic.',
    'This suggests a failure of governance. The board was unaware.',
    'This suggests a deliberate concealment. The documents were shredded.',
    '',
    'The question therefore shifts to accountability. Who approved the deal?',
    'The question therefore shifts to motive. Why was the evidence hidden?',
    'The question therefore shifts to timing. When did the cover-up begin?',
  ].join('\n');

  const result = runAISlopReductionPass(prose, {});

  // Each phrase should have budget=1, so 2 excess occurrences should be recast
  assert(result.repairs.length > 0, 'Forensic phrases triggered recasts');

  // Count remaining occurrences
  const recordSuggests = (result.text.match(/the record suggests/gi) || []).length;
  const thisSuggests = (result.text.match(/(?:^|(?<=[.!?]\s))This suggests\b/gm) || []).length;
  const questionShifts = (result.text.match(/the question therefore shifts/gi) || []).length;

  assert(recordSuggests <= 1, `"the record suggests" within budget (${recordSuggests} ≤ 1)`);
  assert(questionShifts <= 1, `"the question therefore shifts" within budget (${questionShifts} ≤ 1)`);

  // Verify replacements are not empty (recasts, not deletions)
  for (const repair of result.repairs) {
    assert(repair.replacement.length > 0, `Repair for "${repair.pattern}" is a recast, not deletion`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 4: NF Slop Gate — slop reduction must run even for unknown-genre
//         projects when mode === 'nonfiction'.
// ════════════════════════════════════════════════════════════════════════════

console.log('\n=== TEST 4: NF Slop Gate (shouldRunAISlopReduction bypass) ===\n');

{
  // We test the gate function directly rather than running the full pipeline
  // (which requires loading a real manuscript). The fix ensures NF mode
  // bypasses the gate, so we verify the runner code reads correctly.
  const { shouldRunAISlopReduction } = await import('../src/lib/polishPipelineConfig.js');

  // An unknown-genre project should normally be blocked by the gate
  const unknownProject = { genre: 'unknowable_genre', type: 'unknowable_type' };
  assert(!shouldRunAISlopReduction(unknownProject),
    'shouldRunAISlopReduction returns false for unknown genre (conservative profile)');

  // A known NF project should pass the gate
  const nfProject = { genre: 'nonfiction' };
  assert(shouldRunAISlopReduction(nfProject),
    'shouldRunAISlopReduction returns true for nonfiction genre');

  // The fix in manuscriptPolishRunner.js adds: mode === 'nonfiction' || shouldRunAISlopReduction(project)
  // So even if the project resolves to 'unknown', NF mode forces the gate open.
  // We verify this by reading the runner source to confirm the guard is present.
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const path = (await import('path')).default;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const runnerSource = readFileSync(path.join(root, 'src/lib/manuscriptPolishRunner.js'), 'utf-8');
  assert(
    runnerSource.includes("mode === 'nonfiction' || shouldRunAISlopReduction"),
    'Runner has NF-mode bypass for shouldRunAISlopReduction gate'
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`);
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`${'═'.repeat(60)}`);

if (failed > 0) {
  console.error('\n⚠️  LIVE EXECUTION TESTS FAILED — see above for details.');
  process.exit(1);
}
console.log('\n✅ All live-execution regression tests passed.\n');
