// tests/agentRoutingMatrix.test.mjs — Verify all LLM call sites have task_type
// Run: node tests/agentRoutingMatrix.test.mjs

import { readFileSync } from 'fs';

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ FAIL: ${name}`); }
}

const root = new URL('..', import.meta.url).pathname;

// ── 1. integrationRetry.js forwards model ──
console.log('\n── 1: integrationRetry forwards model ──');
const retryCode = readFileSync(root + 'src/lib/integrationRetry.js', 'utf-8');
assert(retryCode.includes('model: resolvedModel'), 'integrationRetry passes model to callAgent');
assert(retryCode.includes('payload.model'), 'integrationRetry reads payload.model');

// ── 2. All call sites have task_type ──
console.log('\n── 2: All call sites have task_type ──');

const callSites = [
  { file: 'src/lib/chapterRepair.js', taskType: 'prose' },
  { file: 'src/lib/manuscriptFixer.js', taskType: 'prose' },
  { file: 'src/lib/forensicAnalytics.js', taskType: 'research' },
  { file: 'src/lib/chapterMetadataRepair.js', taskType: 'foundation' },
  { file: 'src/lib/bibliographyGenerator.js', taskType: 'research' },
  { file: 'src/lib/seriesBible.js', taskType: 'foundation' },
  { file: 'src/lib/chapterCohesion.js', taskType: 'prose' },
  { file: 'src/lib/parallelBibleGenerator.js', taskType: 'foundation' },
  { file: 'src/lib/postDraftCleanup.js', taskType: 'polish' },
  { file: 'src/lib/volumeBible.js', taskType: 'foundation' },
  { file: 'src/lib/proofreader.js', taskType: 'polish' },
  { file: 'src/lib/subjectRestoration.js', taskType: 'prose' },
  { file: 'src/lib/finalProofread.js', taskType: 'polish' },
];

for (const { file, taskType } of callSites) {
  const code = readFileSync(root + file, 'utf-8');
  const hasTaskType = code.includes(`task_type: '${taskType}'`);
  assert(hasTaskType, `${file.split('/').pop()} has task_type: '${taskType}'`);
}

// ── 3. UI component call sites have task_type ──
console.log('\n── 3: UI component call sites have task_type ──');

const uiCallSites = [
  { file: 'src/pages/ProjectStudio.jsx', taskType: 'foundation', label: 'ProjectStudio foundation calls' },
  { file: 'src/pages/ProjectStudio.jsx', taskType: 'outline', label: 'ProjectStudio outline calls' },
  { file: 'src/pages/ProjectStudio.jsx', taskType: 'prose', label: 'ProjectStudio prose calls' },
  { file: 'src/pages/ProjectStudio.jsx', taskType: 'critique', label: 'ProjectStudio critique calls' },
  { file: 'src/components/tools/CriticSubPage.jsx', taskType: 'critique', label: 'CriticSubPage critique call' },
  { file: 'src/components/tools/CompareSubPage.jsx', taskType: 'critique', label: 'CompareSubPage critique calls' },
];

for (const { file, taskType, label } of uiCallSites) {
  const code = readFileSync(root + file, 'utf-8');
  const hasTaskType = code.includes(`task_type: '${taskType}'`);
  assert(hasTaskType, `${label} has task_type: '${taskType}'`);
}

// ── Summary ──
console.log(`\n${'═'.repeat(60)}`);
console.log(`AGENT ROUTING: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(60));

if (failed > 0) { console.error(`\n❌ ${failed} UNEXPECTED failure(s)`); process.exit(1); }
else { console.log(`\n✅ All ${passed} agent routing tests passed`); process.exit(0); }
