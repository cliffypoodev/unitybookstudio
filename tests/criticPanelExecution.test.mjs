import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runReviewerPanelSequential } from '../src/lib/criticPanel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log('--- TEST: criticPanelExecution ---');
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error('❌ FAIL:', message);
      failures++;
    } else {
      console.log('✅ PASS:', message);
    }
  }

  // 1. Test runReviewerPanelSequential behavior
  const dummyPanel = [
    { outlet: 'Rev 1', delay: 50 },
    { outlet: 'Rev 2', delay: 10 }, // slow reviewer simulates delay
    { outlet: 'Rev 3', delay: 30 },
  ];
  // simulate 10 reviewers
  for (let i = 4; i <= 10; i++) {
    dummyPanel.push({ outlet: `Rev ${i}`, delay: 5 });
  }

  let concurrentCount = 0;
  let maxConcurrentCount = 0;
  const progressCalls = [];
  const partialCalls = [];
  const startTimes = [];
  const endTimes = [];

  const runReviewer = async (reviewer) => {
    concurrentCount++;
    if (concurrentCount > maxConcurrentCount) maxConcurrentCount = concurrentCount;
    startTimes.push(Date.now());
    
    await new Promise(resolve => setTimeout(resolve, reviewer.delay));
    
    endTimes.push(Date.now());
    concurrentCount--;
    return { name: reviewer.outlet, score: 90 };
  };

  const onProgress = (reviewer, index, total) => {
    progressCalls.push({ index, total, outlet: reviewer.outlet });
  };

  const onPartial = (partialResults) => {
    partialCalls.push(partialResults.length);
  };

  const results = await runReviewerPanelSequential(dummyPanel, runReviewer, onProgress, onPartial);

  assert(results.length === 10, 'all ten reviewers run');
  
  let orderMatches = true;
  for (let i = 0; i < 10; i++) {
    if (results[i].name !== dummyPanel[i].outlet) orderMatches = false;
  }
  assert(orderMatches, 'result order matches reviewer order');
  
  assert(maxConcurrentCount === 1, 'maximum concurrent reviewer count is exactly 1');
  
  let progressCorrect = progressCalls.length === 10;
  for (let i = 0; i < 10; i++) {
    if (progressCalls[i].index !== i + 1 || progressCalls[i].total !== 10) progressCorrect = false;
  }
  assert(progressCorrect, 'progress fires ten times with correct indexes');
  
  let partialsGrow = partialCalls.length === 10;
  for (let i = 0; i < 10; i++) {
    if (partialCalls[i] !== i + 1) partialsGrow = false;
  }
  assert(partialsGrow, 'partial-result callbacks grow from 1 through 10');

  let overlap = false;
  for (let i = 1; i < 10; i++) {
    if (startTimes[i] < endTimes[i - 1]) overlap = true;
  }
  assert(!overlap, 'a simulated slow reviewer cannot cause the next reviewer to start early');

  // 2. Static analysis of production files
  const subPagePath = path.join(__dirname, '../src/components/tools/CriticSubPage.jsx');
  const subPageCode = fs.readFileSync(subPagePath, 'utf8');

  assert(!subPageCode.includes('Promise.all(panel.map'), 'production source no longer contains Promise.all(panel.map');
  assert(subPageCode.includes('runReviewerPanelSequential('), 'production source calls the sequential helper');
  assert(subPageCode.includes("task_type: 'critique'") && subPageCode.includes("max_tokens: 3000"), "production request specifies task_type: 'critique' and max_tokens: 3000");

  const tryIndex = subPageCode.indexOf('try {');
  const loadIndex = subPageCode.indexOf('const normalizedChapters = await loadManuscriptChapters');
  const finallyIndex = subPageCode.indexOf('finally {');
  
  const isInsideBoundary = loadIndex > tryIndex && loadIndex < finallyIndex;
  assert(isInsideBoundary, 'manuscript loading is inside the Reviewer Panel try/finally boundary');

  if (failures > 0) {
    console.error(`\n❌ ${failures} assertions failed.`);
    process.exit(1);
  } else {
    console.log('\n✅ ALL ASSERTS PASSED');
  }
}

runTests();
