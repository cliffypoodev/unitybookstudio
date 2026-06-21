#!/bin/bash
set -e

echo "=== researchStorage ==="
node tests/researchStorage.test.mjs

echo "=== polishPipelineLiveExecution ==="
node --loader ./tests/helpers/aliasLoader.mjs tests/polishPipelineLiveExecution.test.mjs 2>&1 | tail -3

echo "=== polishConvergence ==="
node --loader ./tests/helpers/aliasLoader.mjs tests/polishConvergence.test.mjs 2>&1 | tail -3

echo "=== contentLossGuards ==="
node tests/contentLossGuards.test.mjs 2>&1 | tail -3

echo "=== serverStore ==="
node tests/serverStore.test.mjs 2>&1 | tail -3

echo "=== critiqueWiringGuard ==="
node --loader ./tests/helpers/aliasLoader.mjs tests/critiqueWiringGuard.test.mjs 2>&1 | tail -3

echo "=== productionWiringGuard ==="
node tests/productionWiringGuard.test.mjs 2>&1 | tail -3

echo "=== vitest suite ==="
npx vitest run tests/beatJsonReliability.test.js tests/draftIntegrityReport.test.js tests/verifiedChapterSave.test.js 2>&1 | tail -5

echo "=== vite build ==="
npx vite build 2>&1 | tail -3

echo "ALL GREEN"
