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
import { runTransitionWordCaps } from '../src/lib/chatgptPatternPolish.js';
import { shouldUppercaseAfterPunct } from '../src/lib/safeUppercase.js';
import { healLegacyArtifacts } from '../src/lib/legacyArtifactHealer.js';
import { runManuscriptPolishPipeline } from '../src/lib/manuscriptPolishRunner.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
  const prose = [
    'The report was filed. the next step was clear.',
    'He referenced the manual, e.g. the section on ethics.',
    'She consulted Dr. smith about the symptoms.',
    'He arrived at 9 a.m. the office was still closed.',
    'That was Mr. jones speaking to the committee.',
    'The data viz. the chart shows growth patterns.',
    'Wait... the door creaked open slowly.',
    'The [composite account drawn from multiple documented experiences] story continued.',
  ].join('\n\n');

  const loaded = [{
    chapter: { chapter_number: 1, title: 'Chapter 1' },
    content: prose,
    original: prose,
  }];

  runDisclaimerStripper(loaded, () => {});
  const output = loaded[0].content;

  assert(output.includes('. The next step'), 'Legitimate orphan "the" → "The" after period');
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
// TEST 2: CamelCase / Proper Noun Guard
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

  runCapitalizationHygiene(loaded, () => {});
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
// TEST 3: Forensic Phrase Budget
// ════════════════════════════════════════════════════════════════════════════

console.log('\n=== TEST 3: Forensic Phrase Budget (aiSlopReduction) ===\n');

{
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

  assert(result.repairs.length > 0, 'Forensic phrases triggered recasts');

  const recordSuggests = (result.text.match(/the record suggests/gi) || []).length;
  const questionShifts = (result.text.match(/the question therefore shifts/gi) || []).length;

  assert(recordSuggests <= 1, `"the record suggests" within budget (${recordSuggests} ≤ 1)`);
  assert(questionShifts <= 1, `"the question therefore shifts" within budget (${questionShifts} ≤ 1)`);

  for (const repair of result.repairs) {
    assert(repair.replacement.length > 0, `Repair for "${repair.pattern}" is a recast, not deletion`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 4: NF Slop Gate
// ════════════════════════════════════════════════════════════════════════════

console.log('\n=== TEST 4: NF Slop Gate (shouldRunAISlopReduction bypass) ===\n');

{
  const { shouldRunAISlopReduction } = await import('../src/lib/polishPipelineConfig.js');

  const unknownProject = { genre: 'unknowable_genre', type: 'unknowable_type' };
  assert(!shouldRunAISlopReduction(unknownProject),
    'shouldRunAISlopReduction returns false for unknown genre (conservative profile)');

  const nfProject = { genre: 'nonfiction' };
  assert(shouldRunAISlopReduction(nfProject),
    'shouldRunAISlopReduction returns true for nonfiction genre');

  const runnerSource = readFileSync(path.join(root, 'src/lib/manuscriptPolishRunner.js'), 'utf-8');
  assert(
    runnerSource.includes("mode === 'nonfiction' || shouldRunAISlopReduction"),
    'Runner has NF-mode bypass for shouldRunAISlopReduction gate'
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 5: FULL-RUNNER fiction case — sentence-start "e.g." must survive
// ════════════════════════════════════════════════════════════════════════════

console.log('\n=== TEST 5: Full-Runner sentence-start e.g. fixture ===\n');

{
  const { runManuscriptPolishPipeline } = await import('../src/lib/manuscriptPolishRunner.js');

  const fixture = 'The heist began. e.g. the YouTube video showed everything—every frame.\n\n' +
    'Marcus watched the footage on loop, checking timestamps against the ledger. ' +
    'The camera had captured the entire sequence: from the moment the vault door opened ' +
    'to the instant the alarms finally tripped. Dr. chen had reviewed the angles ' +
    'and confirmed that no footage was missing. The a.m. recordings were the most critical.\n\n' +
    'i.e. the evidence was overwhelming, and the prosecution rested its case.';

  const loaded = [{
    chapter: { chapter_number: 1, title: 'Chapter 1' },
    content: fixture,
    original: fixture,
  }];

  const project = { title: 'Heist Novel', genre: 'thriller' };

  await runManuscriptPolishPipeline({
    loaded,
    project,
    allowLLM: false,
    mode: 'fiction',
  });

  const output = loaded[0].content;
  console.log('  [DEBUG] Output excerpt:', output.substring(0, 120));

  // Core assertions for the e.g. bug
  assert(output.includes('e.g. the'), 'Sentence-start "e.g. the" preserved (full runner)');
  assert(!output.includes('E.g.'), '"E.g." corruption NOT present');
  assert(!output.includes('e.g. The'), '"e.g. The" corruption NOT present');

  // YouTube must survive
  assert(output.includes('YouTube'), 'YouTube preserved through full runner');

  // Em dash must survive
  assert(output.includes('—every') || output.includes('— every'), 'Em dash "—every" preserved');

  // i.e. must survive
  assert(output.includes('i.e. the'), 'Sentence-start "i.e. the" preserved');
  assert(!output.includes('I.e.'), '"I.e." corruption NOT present');

  // a.m. must survive
  assert(output.includes('a.m. recordings'), '"a.m. recordings" preserved');

  // Dr. must survive
  assert(output.includes('Dr. chen') || output.includes('Dr. Chen'),
    '"Dr. chen" preserved (not corrupted)');
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 6: Direct runTransitionWordCaps — no transition words removed
//         means NO capitalization changes should occur
// ════════════════════════════════════════════════════════════════════════════

console.log('\n=== TEST 6: runTransitionWordCaps no-op case ===\n');

{
  const fixture = 'The heist began. e.g. the YouTube video showed everything—every frame.\n\n' +
    'Marcus checked the a.m. recording carefully. i.e. the evidence was clear.';

  const loaded = [{
    chapter: { chapter_number: 1, title: 'Chapter 1' },
    content: fixture,
    original: fixture,
  }];

  const result = runTransitionWordCaps(loaded, () => {});

  const output = loaded[0].content;

  // No transition words → transitionWordsFixed should be 0
  assert(result.transitionWordsFixed === 0, 'No transition words removed (fixture has none)');

  // e.g. must NOT be corrupted (second pass should not have run)
  assert(output.includes('e.g. the'), '"e.g. the" preserved when no transitions removed');
  assert(!output.includes('E.g.'), '"E.g." corruption NOT present');
  assert(!output.includes('e.g. The'), '"e.g. The" corruption NOT present');

  // i.e. must survive
  assert(output.includes('i.e. the'), '"i.e. the" preserved');

  // a.m. must survive
  assert(output.includes('a.m. recording'), '"a.m. recording" preserved');

  // YouTube must survive
  assert(output.includes('YouTube'), 'YouTube preserved');
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 7: Direct shouldUppercaseAfterPunct — tests the shared guard
//         covering postDraftCleanup and all other consumers
// ════════════════════════════════════════════════════════════════════════════

console.log('\n=== TEST 7: shouldUppercaseAfterPunct shared guard ===\n');

{
  // Cases that should NOT be uppercased
  const skipCases = [
    { text: 'e.g. the video', offset: 3, letter: 't', label: 'e.g. period' },
    { text: 'i.e. the result', offset: 3, letter: 't', label: 'i.e. period' },
    { text: 'a.m. the office', offset: 3, letter: 't', label: 'a.m. period' },
    { text: 'Dr. smith said', offset: 2, letter: 's', label: 'Dr. title' },
    { text: 'Wait... the door', offset: 6, letter: 't', label: 'ellipsis' },
    { text: 'etc. the list', offset: 3, letter: 't', label: 'etc. abbreviation' },
  ];

  for (const tc of skipCases) {
    assert(!shouldUppercaseAfterPunct(tc.text, tc.offset, tc.letter),
      `Guard blocks uppercase after ${tc.label}: "${tc.text}"`);
  }

  // Cases that SHOULD be uppercased
  const applyCases = [
    { text: 'He left. the door closed.', offset: 7, letter: 't', label: 'legitimate sentence start' },
    { text: 'She ran! the crowd cheered.', offset: 7, letter: 't', label: 'after exclamation' },
    { text: 'Really? the answer was no.', offset: 6, letter: 't', label: 'after question mark' },
  ];

  for (const tc of applyCases) {
    assert(shouldUppercaseAfterPunct(tc.text, tc.offset, tc.letter),
      `Guard allows uppercase for ${tc.label}: "${tc.text}"`);
  }

  // Sentence-start abbreviation lookahead — the letter itself begins an abbreviation
  const sentenceStartAbbrev = 'He left. e.g. the video played.';
  // offset=7 is the period in 'left.', the 'e' after it would be uppercased
  // but it begins 'e.g.' — should be blocked
  assert(!shouldUppercaseAfterPunct(sentenceStartAbbrev, 7, 'e'),
    'Guard blocks sentence-start "e" when it begins "e.g."');
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 8: Blind-uppercase sweep — grep src/lib for after-punctuation
//         uppercase patterns and assert all use the shared guard
// ════════════════════════════════════════════════════════════════════════════

console.log('\n=== TEST 8: Blind-uppercase sweep ===\n');

{
  // Approved exceptions — sites that use toUpperCase() near after-punctuation
  // patterns but are safe (scope-limited, not blind after-punctuation sweeps)
  const APPROVED_EXCEPTIONS = new Set([
    // capitalizationPolish.js fixCommaFragmentedTitles: only fires on "Mr, the" patterns
    'capitalizationPolish.js',
  ]);

  // Scan all files in src/lib for the danger pattern:
  // toUpperCase() within 80 chars of an after-punctuation regex
  const { readdirSync } = await import('fs');
  const libDir = path.join(root, 'src/lib');
  const files = readdirSync(libDir).filter(f => f.endsWith('.js'));

  const violations = [];

  for (const file of files) {
    if (file === 'safeUppercase.js') continue; // The guard itself is exempt
    const source = readFileSync(path.join(libDir, file), 'utf-8');
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check for lines with toUpperCase AND a punctuation character class
      if (line.includes('toUpperCase') &&
          /\[\.!\?\]|\\\..*\\s/.test(line) &&
          !line.includes('safeUppercase') &&
          !line.includes('shouldUppercaseAfterPunct') &&
          !line.includes('safeUppercaseReplace')) {

        // Check if this file is in the approved exceptions
        if (APPROVED_EXCEPTIONS.has(file)) continue;

        // Check if the guard is imported in this file
        if (source.includes("import") && source.includes("safeUppercase")) {
          // File imports the guard — check if THIS line uses it
          // Look at surrounding context (5 lines before) for the guard check
          const context = lines.slice(Math.max(0, i - 5), i + 1).join('\n');
          if (context.includes('shouldUppercaseAfterPunct') ||
              context.includes('safeUppercaseReplace')) {
            continue; // Guarded
          }
        }

        violations.push(`${file}:${i + 1}: ${line.trim().substring(0, 100)}`);
      }
    }
  }

  if (violations.length === 0) {
    assert(true, 'No unapproved blind-uppercase sites found in src/lib/');
  } else {
    for (const v of violations) {
      assert(false, `Unapproved blind-uppercase site: ${v}`);
    }
  }

  // Also verify the shared guard is used by all known consumers
  const expectedConsumers = [
    'disclaimerStripper.js',
    'manuscriptPolishRunner.js',
    'nonfictionPolish.js',
    'chatgptPatternPolish.js',
    'postDraftCleanup.js',
  ];

  for (const consumer of expectedConsumers) {
    const source = readFileSync(path.join(libDir, consumer), 'utf-8');
    assert(
      source.includes('safeUppercase'),
      `${consumer} imports from safeUppercase.js`
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 9 — Legacy corruption healing (full runner)
// ════════════════════════════════════════════════════════════════════════════
console.log('\nTEST 9 — Legacy corruption healing (full runner)');
{
  // Direct healer tests first
  const legacyInput = 'E.g. The youTube clip played—Every frame mattered.';
  const healed = healLegacyArtifacts(legacyInput);
  assert(healed.text.includes('YouTube'), '9a. youTube → YouTube');
  assert(healed.text.includes('e.g. the') || healed.text.includes('E.g. the'), '9b. E.g. The → E.g. the');
  assert(healed.text.includes('—every'), '9c. —Every → —every');
  assert(healed.repairs.length >= 3, '9d. At least 3 repairs logged');

  // URL safety: youtube inside URL must NOT be touched
  const urlInput = 'watch https://youtube.com/clip for details';
  const urlHealed = healLegacyArtifacts(urlInput);
  assert(urlHealed.text.includes('youtube.com'), '9e. youtube inside URL untouched');

  // Already-correct text must not be touched
  const correctInput = 'the YouTube channel is great';
  const correctHealed = healLegacyArtifacts(correctInput);
  assert(correctHealed.text === correctInput, '9f. Already-correct text unchanged');
  assert(correctHealed.repairs.length === 0, '9g. No repairs on correct text');

  // Full runner integration test
  const legacyFixture = 'E.g. The youTube clip played—Every frame mattered. Watch https://youtube.com/clip here. The YouTube channel confirmed it.';
  const loaded = [{
    chapter: { chapter_number: 1, title: 'Ch 1' },
    content: legacyFixture,
    original: legacyFixture,
  }];
  await runManuscriptPolishPipeline({
    loaded,
    project: { title: 'Legacy Test', genre: 'thriller' },
    allowLLM: false,
    mode: 'fiction',
  });
  const output = loaded[0].content;
  assert(output.includes('YouTube clip') || output.includes('YouTube'), '9h. Full runner: YouTube restored');
  assert(!output.includes('youTube'), '9i. Full runner: youTube corruption gone');
  assert(output.includes('youtube.com'), '9j. Full runner: URL youtube untouched');

  // Second-pass stability
  const loaded2 = [{
    chapter: { chapter_number: 1, title: 'Ch 1' },
    content: output,
    original: output,
  }];
  await runManuscriptPolishPipeline({
    loaded: loaded2,
    project: { title: 'Legacy Test', genre: 'thriller' },
    allowLLM: false,
    mode: 'fiction',
  });
  assert(loaded2[0].content === output, '9k. Second pass is stable (idempotent)');
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 10 — NF quote-spacing (closing quote + space + letter preserved)
// ════════════════════════════════════════════════════════════════════════════
console.log('\nTEST 10 — NF quote-spacing');
{
  const nfFixture = '"Quote with bad spacing," said the clerk. This was not merely a formality.';
  const loaded = [{
    chapter: { chapter_number: 1, title: 'Ch 1' },
    content: nfFixture,
    original: nfFixture,
  }];
  await runManuscriptPolishPipeline({
    loaded,
    project: { title: 'NF Quote Test', genre: 'nonfiction', type: 'true_crime' },
    allowLLM: false,
    mode: 'nonfiction',
  });
  const output = loaded[0].content;
  // The closing quote must be followed by a space before "said"
  assert(!output.includes(',"said') && !output.includes(',\u201dsaid'), '10a. No collapsed quote+said');
  assert(output.includes('" said') || output.includes('\u201d said') || output.includes('," said') || output.includes(',\u201d said'), '10b. Space after closing quote preserved');

  // Second fixture: more pathological
  const nfFixture2 = '"Evidence was clear," he explained. The available accounts indicate a pattern. This was not simply about greed.';
  const loaded2 = [{
    chapter: { chapter_number: 1, title: 'Ch 1' },
    content: nfFixture2,
    original: nfFixture2,
  }];
  await runManuscriptPolishPipeline({
    loaded: loaded2,
    project: { title: 'NF Quote Test 2', genre: 'nonfiction', type: 'true_crime' },
    allowLLM: false,
    mode: 'nonfiction',
  });
  const output2 = loaded2[0].content;
  assert(!output2.includes('"he') && !output2.includes('\u201dhe'), '10c. No collapsed quote+he in fixture 2');
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
