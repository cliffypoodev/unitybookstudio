// tests/runnerAsyncAwaitGuard.test.mjs — Generic async-await guard
//
// Parses manuscriptPolishRunner.js imports, locates each imported function's
// declaration in its source file, and for every one declared `async function`
// asserts that every call site inside the runner is preceded by `await`.
//
// Run: node tests/runnerAsyncAwaitGuard.test.mjs

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runnerPath = resolve(root, 'src/lib/manuscriptPolishRunner.js');
const runnerSource = readFileSync(runnerPath, 'utf-8');

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; failures.push(label); console.error(`  ❌ FAIL: ${label}`); }
}

// ── Step 1: Extract all named imports from the runner and their source files ──

// Match: import { name1, name2, ... } from './file.js';  (may span multiple lines)
const importBlockRx = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
const importMap = []; // [{names: string[], sourceRelative: string, sourceAbsolute: string}]

let match;
while ((match = importBlockRx.exec(runnerSource)) !== null) {
  const namesRaw = match[1];
  const sourceRelative = match[2];

  // Resolve absolute path
  let sourceAbsolute;
  if (sourceRelative.startsWith('./') || sourceRelative.startsWith('../')) {
    sourceAbsolute = resolve(dirname(runnerPath), sourceRelative);
  } else if (sourceRelative.startsWith('@/')) {
    sourceAbsolute = resolve(root, 'src', sourceRelative.slice(2));
  } else {
    continue; // external package, skip
  }

  // Auto-append .js if needed
  if (!sourceAbsolute.endsWith('.js') && !sourceAbsolute.endsWith('.mjs')) {
    if (existsSync(sourceAbsolute + '.js')) sourceAbsolute += '.js';
    else if (existsSync(sourceAbsolute + '.mjs')) sourceAbsolute += '.mjs';
  }

  const names = namesRaw
    .split(',')
    .map(n => n.trim())
    .filter(n => n.length > 0 && !n.startsWith('//'));

  importMap.push({ names, sourceRelative, sourceAbsolute });
}

console.log(`\n── Async-await guard for manuscriptPolishRunner.js ──`);
console.log(`Found ${importMap.length} import blocks with ${importMap.reduce((s, i) => s + i.names.length, 0)} total imported names\n`);

// ── Step 2: For each imported name, check if it's declared async in its source file ──

const asyncImports = []; // names that are declared async in their source

for (const entry of importMap) {
  if (!existsSync(entry.sourceAbsolute)) {
    console.warn(`  ⚠️  Source file not found: ${entry.sourceAbsolute}`);
    continue;
  }

  const sourceContent = readFileSync(entry.sourceAbsolute, 'utf-8');

  for (const name of entry.names) {
    // Look for: export async function <name>
    // or: async function <name>
    // or: export const <name> = async
    const asyncDeclRx = new RegExp(
      `(?:export\\s+)?async\\s+function\\s+${name}\\b` +
      `|(?:export\\s+)?(?:const|let|var)\\s+${name}\\s*=\\s*async\\b`,
    );

    if (asyncDeclRx.test(sourceContent)) {
      asyncImports.push(name);
    }
  }
}

console.log(`Async-declared imports: ${asyncImports.length}`);
if (asyncImports.length > 0) {
  console.log(`  ${asyncImports.join(', ')}\n`);
}

assert('At least one async import found', asyncImports.length > 0);

// ── Step 3: For each async import, verify every call site in the runner has await ──

const runnerLines = runnerSource.split('\n');

for (const name of asyncImports) {
  // Find all lines containing `name(` in the runner source
  const callSiteRx = new RegExp(`\\b${name}\\s*\\(`);
  const importLineRx = new RegExp(`^\\s*(?:import\\s|\\s*from\\s)`);

  let allAwaited = true;
  const violations = [];

  for (let i = 0; i < runnerLines.length; i++) {
    const line = runnerLines[i];

    // Skip import lines
    if (/^\s*import\s/.test(line) || /^\s*from\s/.test(line)) continue;
    // Skip lines that are part of multi-line imports (contain 'from')
    if (/^\s*\}\s*from\s/.test(line)) continue;
    // Skip comments
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

    if (callSiteRx.test(line)) {
      // Check if preceded by 'await' on the same line
      const awaitRx = new RegExp(`await\\s+${name}\\s*\\(`);
      if (!awaitRx.test(line)) {
        allAwaited = false;
        violations.push({ lineNum: i + 1, line: line.trim() });
      }
    }
  }

  if (violations.length > 0) {
    console.log(`\n  ⚠️  Missing await for async function "${name}":`);
    for (const v of violations) {
      console.log(`     Line ${v.lineNum}: ${v.line.slice(0, 120)}`);
    }
  }

  assert(
    `All call sites of async "${name}" are awaited (${violations.length === 0 ? 'ok' : violations.length + ' violation(s)'})`,
    allAwaited,
  );
}

// ── Summary ──
console.log(`\n${'═'.repeat(60)}`);
console.log(`RUNNER ASYNC-AWAIT GUARD: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(60));

if (failed > 0) {
  console.error(`\n❌ ${failed} GUARD FAILURE(S):`);
  for (const f of failures) console.error(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} async-await guards passed`);
  process.exit(0);
}
