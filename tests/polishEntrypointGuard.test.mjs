// tests/polishEntrypointGuard.test.mjs — Static wiring guard
// Ensures the legacy fixEntireManuscript is never reachable from UI controls,
// all ManuscriptDashboard render sites pass a routed polish handler, and
// the model override for non-ghostwriter agents is blocked.
//
// Run: node tests/polishEntrypointGuard.test.mjs

import { readFileSync } from 'fs';
import { resolve } from 'path';

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ❌ FAIL: ${label}`);
  }
}

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (rel) => readFileSync(resolve(root, rel), 'utf-8');

// ═══════════════════════════════════════════════════════════════════════════
// 1. ManuscriptDashboard must NOT import or invoke fixEntireManuscript
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 1: ManuscriptDashboard — no legacy fixer ──');
const dashboard = read('src/components/review/ManuscriptDashboard.jsx');

assert(
  '1a. No import of fixEntireManuscript',
  !dashboard.includes("import { fixEntireManuscript }") &&
  !dashboard.includes("import fixEntireManuscript") &&
  !dashboard.includes("from '@/lib/manuscriptFixer'")
);

assert(
  '1b. No invocation of fixEntireManuscript in handler chain',
  // The old fallback: polishHandler = ... || fixEntireManuscript
  !dashboard.match(/polishHandler[\s\S]{0,200}fixEntireManuscript/)
);

assert(
  '1c. No identity check against fixEntireManuscript',
  !dashboard.includes('polishHandler !== fixEntireManuscript') &&
  !dashboard.includes('polishHandler === fixEntireManuscript')
);

// ═══════════════════════════════════════════════════════════════════════════
// 2. Every JSX file rendering ManuscriptDashboard passes a polish handler
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 2: ManuscriptDashboard render sites pass polish handler ──');
const studio = read('src/pages/ProjectStudio.jsx');

// Find all <ManuscriptDashboard occurrences in ProjectStudio
const dashboardRenders = studio.match(/<ManuscriptDashboard[^/>]*\/?>/g) || [];
assert('2a. At least one ManuscriptDashboard render found', dashboardRenders.length >= 1);

for (let i = 0; i < dashboardRenders.length; i++) {
  const render = dashboardRenders[i];
  const hasHandler =
    render.includes('onFixEntireManuscript=') ||
    render.includes('onManuscriptPolish=') ||
    render.includes('onPolish=');
  assert(`2b-${i + 1}. Render site ${i + 1} passes a polish handler prop`, hasHandler);
}

// The passed handler must be handlePolishRouted (not the legacy fixer)
assert(
  '2c. Handler is handlePolishRouted (not fixEntireManuscript)',
  dashboardRenders.some(r => r.includes('handlePolishRouted'))
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. integrationRetry blocks ghostwriter override for non-ghostwriter agents
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 3: Model override guard ──');
const retry = read('src/lib/integrationRetry.js');

assert(
  '3a. integrationRetry imports resolveAgent',
  retry.includes('resolveAgent') && retry.includes("from '@/lib/localLLM'")
);

assert(
  '3b. integrationRetry checks ghostwriter model against agent model',
  retry.includes('AGENT_MODELS.ghostwriter') && retry.includes('agentModel')
);

assert(
  '3c. integrationRetry drops explicit model when agent differs',
  retry.includes('resolvedModel = null') || retry.includes('resolvedModel=null')
);

// ═══════════════════════════════════════════════════════════════════════════
// 4. writingModel.js does not log ghostwriter for non-writing tasks
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 4: writingModel log guard ──');
const writingModel = read('src/lib/writingModel.js');

assert(
  '4a. logWritingModelUsage gates on isWritingTask',
  writingModel.includes('isWritingTask(context)') || writingModel.includes('isWritingTask(taskType)')
);

assert(
  '4b. isWritingTask does NOT include critique/polish/research',
  !writingModel.match(/isWritingTask[^}]*critique/) &&
  !writingModel.match(/isWritingTask[^}]*polish/)
);

// ═══════════════════════════════════════════════════════════════════════════
// 5. manuscriptFixer.js exports fixEntireManuscript with @deprecated
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 5: Legacy fixer deprecated ──');
const fixer = read('src/lib/manuscriptFixer.js');

assert(
  '5a. fixEntireManuscript still exported (for programmatic use)',
  fixer.includes('export async function fixEntireManuscript') ||
  fixer.includes('export default fixEntireManuscript')
);

assert(
  '5b. fixEntireManuscript has @deprecated tag',
  fixer.includes('@deprecated')
);

// ═══════════════════════════════════════════════════════════════════════════
// 6. handlePolishRouted routes through unified pipeline
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 6: handlePolishRouted uses unified pipeline ──');

assert(
  '6a. ProjectStudio has handlePolishRouted',
  studio.includes('handlePolishRouted')
);

assert(
  '6b. handlePolishRouted calls handleManuscriptPolishNonfiction or handleManuscriptPolish',
  studio.includes('handleManuscriptPolishNonfiction') &&
  studio.includes('handleManuscriptPolish')
);

assert(
  '6c. ProjectStudio calls runManuscriptPolishPipeline',
  studio.includes('runManuscriptPolishPipeline(')
);

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`POLISH ENTRYPOINT GUARD: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(60));

if (failed > 0) {
  console.error(`\n❌ ${failed} GUARD FAILURE(S):`);
  for (const f of failures) console.error(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} polish entrypoint guards passed`);
  process.exit(0);
}
