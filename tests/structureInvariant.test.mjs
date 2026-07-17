import { runManuscriptPolishPipeline } from '../src/lib/manuscriptPolishRunner.js';
import { runAntiDetectionPolish } from '../src/lib/antiDetectionPolish.js';

let failures = 0;
function check(name, condition) {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    console.error(`FAIL ${name}`);
    failures++;
  }
}

async function runTests() {
  console.log('--- Testing Anti-Detection Polish Pattern 4 ---');
  // "The original False North failure shape cannot flatten a chapter."
  // "A multi-paragraph staccato fixture triggers Pattern 4 while retaining the exact original paragraph separators."
  const originalShape = 
`This is normal text in paragraph one. It has some length to it.

I am. You are. We be.

And another paragraph. That is fine.`;

  const loadedFalseNorth = [{ chapter: { chapter_number: 1 }, content: originalShape }];
  runAntiDetectionPolish(loadedFalseNorth, () => {}, {});
  
  const resultShape = loadedFalseNorth[0].content;
  check('Pattern 4 triggers and merges short fragments', resultShape.includes('I am; you are. We be.'));
  check('Pattern 4 preserves exact paragraph separators', resultShape.includes('\n\nAnd another paragraph.'));
  check('Pattern 4 does not flatten the chapter', resultShape.split('\n\n').length === 3);

  console.log('--- Testing Pipeline Structure Invariant ---');
  
  // Test: A destructive pass affecting one chapter does not revert unaffected chapters.
  // Test: A deliberately destructive fake pass that converts blank lines to spaces is rejected and reverted.
  // Test: The returned report contains the responsible stage and chapter.
  let fakeSweep = (loaded) => {
    // Destructive to chapter 1
    loaded[0].content = loaded[0].content.replace(/\n\n/g, ' ');
    // Preserves chapter 2 but changes words
    loaded[1].content = loaded[1].content.replace('word', 'changed');
    return { summary: 'Fake sweep done' };
  };

  let loadedPipeline = [
    { chapter: { chapter_number: 1 }, original: 'Para 1.\n\nPara 2.', content: 'Para 1.\n\nPara 2.' },
    { chapter: { chapter_number: 2 }, original: 'Some word.\n\nAnother para.', content: 'Some word.\n\nAnother para.' }
  ];

  let result = await runManuscriptPolishPipeline({
    loaded: loadedPipeline,
    project: { genre: 'Fiction' },
    allowLLM: false,
    sceneDuplicateSweep: fakeSweep
  });

  check('Destructive pass on chapter 1 is reverted', loadedPipeline[0].content.includes('\n\n'));
  check('Non-destructive pass on chapter 2 is kept', loadedPipeline[1].content.includes('changed'));
  check('Report contains structureViolations', result.structureViolations && result.structureViolations.length > 0);
  check('Violation flags correct chapter and stage', 
    result.structureViolations.some(v => v.chapter === 1 && v.stage === 'Scene Duplicate Sweep' && v.action === 'REVERTED')
  );

  // Test: An explicitly reported paragraph removal is accepted only when the reported count exactly matches the reduction.
  // Test: CRLF input is counted correctly.
  let fakeSweepWithReport = (loaded) => {
    // Has 3 paragraphs, we remove 1
    loaded[0].content = 'Para 1.\r\n\r\nPara 2.'; // CRLF!
    // Has 4 paragraphs, we remove 2 but report 1
    loaded[1].content = 'P1.\n\nP2.';
    return { summary: 'Reported', allowedRemovals: { 1: 1, 2: 1 } };
  };

  let loadedPipeline2 = [
    { chapter: { chapter_number: 1 }, original: 'Para 1.\r\n\r\nPara 2.\r\n\r\nPara 3.', content: 'Para 1.\r\n\r\nPara 2.\r\n\r\nPara 3.' },
    { chapter: { chapter_number: 2 }, original: 'P1.\n\nP2.\n\nP3.\n\nP4.', content: 'P1.\n\nP2.\n\nP3.\n\nP4.' }
  ];

  let result2 = await runManuscriptPolishPipeline({
    loaded: loadedPipeline2,
    project: { genre: 'Fiction' },
    allowLLM: false,
    sceneDuplicateSweep: fakeSweepWithReport
  });

  check('CRLF input counted correctly and allowed removal accepted', loadedPipeline2[0].content.includes('Para 2') && !loadedPipeline2[0].content.includes('Para 3'));
  check('Incorrect reported removal count is rejected', loadedPipeline2[1].content.includes('P4'));
  check('Violation flags missing removal count properly', 
    result2.structureViolations.some(v => v.chapter === 2 && v.stage === 'Scene Duplicate Sweep' && v.action === 'REVERTED')
  );

  if (failures > 0) {
    console.error(`\nFAILED ${failures} tests.`);
    process.exit(1);
  } else {
    console.log('\nALL TESTS PASSED.');
    process.exit(0);
  }
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
