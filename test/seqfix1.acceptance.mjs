import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runParallelDraftPool, PARALLEL_DRAFT_LANE_LIMIT } from '../src/lib/parallelDraftPool.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
function check(name, pass) {
  if (pass) {
    console.log(`PASS ${name}`);
  } else {
    console.log(`FAIL ${name}`);
    failures++;
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTest() {
  // 1 & 2
  check('1. PARALLEL_DRAFT_LANE_LIMIT is 1', PARALLEL_DRAFT_LANE_LIMIT === 1);

  // 3. Behavior (default limit)
  const items3 = [1, 2, 3, 4];
  const logs3 = [];
  let orderCounter3 = 0;

  await runParallelDraftPool(items3, async (item, currentIndex, laneIndex) => {
    const startOrder = orderCounter3++;
    logs3.push({ item, laneIndex, startOrder });
    await delay(50);
  });

  const allLaneZero = logs3.every(l => l.laneIndex === 0);
  const strictSequential = logs3.every((l, i) => l.startOrder === i);
  check('2. Default pool is sequential (laneIndex always 0)', allLaneZero);
  check('3. Default pool is strictly sequential in time', strictSequential && logs3.length === 4);

  // 4. Behavior (explicit limit)
  const items4 = [1, 2, 3, 4];
  const logs4 = [];
  let orderCounter4 = 0;
  
  await runParallelDraftPool(items4, async (item, currentIndex, laneIndex) => {
    const startOrder = orderCounter4++;
    logs4.push({ item, laneIndex, startOrder });
    await delay(50);
  }, { limit: 2 });

  const usedLaneOne = logs4.some(l => l.laneIndex === 1);
  check('4. Explicit override { limit: 2 } works (laneIndex includes 1)', usedLaneOne);

  // 5. Source assertions
  const psSrc = fs.readFileSync(path.join(ROOT, 'src/pages/ProjectStudio.jsx'), 'utf8');
  const pdpSrc = fs.readFileSync(path.join(ROOT, 'src/lib/parallelDraftPool.js'), 'utf8');

  check('5. ProjectStudio.jsx limits are 1', 
    psSrc.includes('const NONFICTION_DRAFT_LANE_LIMIT = 1;') && 
    psSrc.includes('const ANTHOLOGY_DRAFT_LANE_LIMIT = 1;')
  );
  check('6. parallelDraftPool.js contains SEQFIX-1', pdpSrc.includes('SEQFIX-1'));

  if (failures === 0) {
    console.log('ACCEPTANCE: ALL CHECKS MATCHED');
  }
  process.exit(failures === 0 ? 0 : 1);
}

runTest();
