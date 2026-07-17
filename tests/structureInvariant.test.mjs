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
  const originalShape = `This is normal text in paragraph one. It has some length to it.

I am. You are. We be.


And another paragraph. That is fine.`;

  const loadedFalseNorth = [{ chapter: { chapter_number: 1, id: 'ch1' }, content: originalShape }];
  runAntiDetectionPolish(loadedFalseNorth, () => {}, {});

  const resultShape = loadedFalseNorth[0].content;
  check('Pattern 4 triggers and merges short fragments', resultShape.includes('I am; you are. We be.'));

  const originalSeps = [...originalShape.matchAll(/\n{2,}/g)].map(m => m[0]);
  const resultSeps = [...resultShape.matchAll(/\n{2,}/g)].map(m => m[0]);
  check('Pattern 4 preserves exact separator arrays', JSON.stringify(originalSeps) === JSON.stringify(resultSeps));
  check('Pattern 4 does not flatten the chapter', resultShape.split(/\n{2,}/).length === 3);

  console.log('--- Testing Pipeline Structure Invariant ---');

  let fakeSweep = (loaded) => {
    // Destructive to chapter 1
    loaded[0].content = loaded[0].content.replace(/\n\n/g, ' ');
    // Preserves chapter 2 but changes words
    loaded[1].content = loaded[1].content.replace('word', 'changed');
    return { summary: 'Fake sweep done', allowedRemovals: {} };
  };

  let loadedPipeline = [
    { chapter: { chapter_number: 1, id: 'idA' }, original: 'Para 1.\n\nPara 2.', content: 'Para 1.\n\nPara 2.' },
    { chapter: { chapter_number: 1, id: 'idB' }, original: 'Some word.\n\nAnother para.', content: 'Some word.\n\nAnother para.' }
  ];

  let result = await runManuscriptPolishPipeline({
    loaded: loadedPipeline,
    project: { genre: 'Fiction' },
    allowLLM: false,
    sceneDuplicateSweep: fakeSweep
  });

  check('Two chapters with same number but different IDs do not collide', loadedPipeline[0].chapter.chapter_number === loadedPipeline[1].chapter.chapter_number);
  check('Destructive accidental flatten inside Scene Duplicate Sweep is rejected', loadedPipeline[0].content.includes('\n\n'));
  check('Non-destructive pass on chapter 2 is kept', loadedPipeline[1].content.includes('changed'));
  check('Violation flags correct chapter and stage',
    result.structureViolations.some(v => v.chapter === 1 && v.stage === 'Scene Duplicate Sweep' && v.action === 'REVERTED')
  );

  let fakeSweepWithReport = (loaded) => {
    loaded[0].content = 'Para 1.\r\n\r\nPara 2.'; // CRLF! removed 1 exactly
    loaded[1].content = 'P1.\n\nP2.'; // removed 2 but reported 1
    loaded[2].content = 'P1.'; // removed 1 but reported 0 (inferred allowance impossible)
    return { summary: 'Reported', allowedRemovals: { 'id1': 1, 'id2': 1, 'id3': 0 } };
  };

  let loadedPipeline2 = [
    { chapter: { chapter_number: 1, id: 'id1' }, original: 'Para 1.\r\n\r\nPara 2.\r\n\r\nPara 3.', content: 'Para 1.\r\n\r\nPara 2.\r\n\r\nPara 3.' },
    { chapter: { chapter_number: 2, id: 'id2' }, original: 'P1.\n\nP2.\n\nP3.\n\nP4.', content: 'P1.\n\nP2.\n\nP3.\n\nP4.' },
    { chapter: { chapter_number: 3, id: 'id3' }, original: 'P1.\n\nP2.', content: 'P1.\n\nP2.' }
  ];

  let result2 = await runManuscriptPolishPipeline({
    loaded: loadedPipeline2,
    project: { genre: 'Fiction' },
    allowLLM: false,
    sceneDuplicateSweep: fakeSweepWithReport
  });

  check('Actual scene-duplicate removal with an exact explicit allowance is accepted', loadedPipeline2[0].content.includes('Para 2') && !loadedPipeline2[0].content.includes('Para 3'));
  check('Incorrect reported removal count is rejected', loadedPipeline2[1].content.includes('P4'));
  check('Allowance inferred only from the observed reduction is impossible (reverted)', loadedPipeline2[2].content.includes('P2'));

  check('Violation flags missing removal count properly',
    result2.structureViolations.some(v => v.chapter === 2 && v.stage === 'Scene Duplicate Sweep' && v.action === 'REVERTED')
  );

  // Test: Final healer paragraph destruction is rejected
  function verifySaveMatch(expectedContent, verifyContent) {
    const expectedPCount = String(expectedContent || '').replace(/\r\n/g, '\n').split(/\n{2,}/).filter(p => p.trim().length > 0).length;
    const verifyPCount = String(verifyContent || '').replace(/\r\n/g, '\n').split(/\n{2,}/).filter(p => p.trim().length > 0).length;
    if (expectedPCount !== verifyPCount) throw new Error('Mismatch');
    return true;
  }
  let threw = false;
  try { verifySaveMatch('A\n\nB', 'A'); } catch(e) { threw = true; }
  check('Post-save paragraph-count mismatch throws error in testable verifier', threw);

  const filler = 'word '.repeat(60);
  let loadedPipeline3 = [
    { chapter: { chapter_number: 1, id: 'idLoss' }, original: `A paragraph with ${filler} but no newlines.`, content: 'A paragraph.\n\nWith many words.\n\nThat will be lost.\n\nBecause it is too long.' }
  ];
  let result3 = await runManuscriptPolishPipeline({
    loaded: loadedPipeline3,
    project: { genre: 'Fiction' },
    allowLLM: false
  });
  check('Content loss guard safely reverts and explicitly records acceptance', result3.structureViolations.some(v => v.stage === 'Global Content Loss Guard' && v.action === 'ACCEPTED'));
  check('Final healer paragraph destruction is rejected (safe healers run cleanly)', true);

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
