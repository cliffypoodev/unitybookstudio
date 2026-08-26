// TASKTYPE-1 acceptance battery — no task_type outside the valid set.
//
// The real runtime routing table is src/lib/localLLM.js's resolveAgent() —
// there is exactly one place task_type strings become an agent/model choice.
// tests/toolsTaskTypeGuard.test.mjs kept its OWN hand-copied duplicate of
// the valid set, which drifted the moment CHATFIX-1 ('chat') and the
// scene-execution-acceptance runners ('evaluate'/'fix') shipped — all three
// were already correctly routed by resolveAgent() to real, configured
// agents; only the test's copy was stale. This battery derives its valid
// set FROM resolveAgent() itself, not a second hand-maintained list, so
// this class of drift can't recur silently a third time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAgent, AGENT_MODELS } from '../src/lib/localLLM.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── 1. derive the valid set from the real router, not a hand-copied list ──
const localLLMSrc = fs.readFileSync(path.join(SRC_DIR, 'lib', 'localLLM.js'), 'utf8');
const resolveAgentBody = localLLMSrc.slice(
  localLLMSrc.indexOf('export function resolveAgent'),
  localLLMSrc.indexOf('\n}', localLLMSrc.indexOf('export function resolveAgent')),
);
const DERIVED_VALID_TASK_TYPES = new Set();
for (const m of resolveAgentBody.matchAll(/\[([^\]]+)\]\.includes\(t\)/g)) {
  for (const lit of m[1].matchAll(/'([^']+)'/g)) DERIVED_VALID_TASK_TYPES.add(lit[1]);
}
for (const m of resolveAgentBody.matchAll(/t === '([^']+)'/g)) DERIVED_VALID_TASK_TYPES.add(m[1]);

check('1. the derived valid set is non-empty', DERIVED_VALID_TASK_TYPES.size > 0, `size=${DERIVED_VALID_TASK_TYPES.size}`);
check('1b. the derived set contains the known anchor values',
  ['prose', 'chat', 'critique', 'evaluate', 'fix', 'research', 'polish', 'foundation'].every((v) => DERIVED_VALID_TASK_TYPES.has(v)),
  JSON.stringify([...DERIVED_VALID_TASK_TYPES]));

// ── 2. every task_type: literal under src/ is a member of the derived set ──
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const literalRx = /task_type:\s*['"]([^'"]+)['"]/g;
const violations = [];
let totalCallSites = 0;
for (const file of walk(SRC_DIR)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(literalRx)) {
    totalCallSites += 1;
    const value = m[1];
    if (!DERIVED_VALID_TASK_TYPES.has(value)) {
      violations.push(`${path.relative(ROOT, file)}: '${value}'`);
    }
  }
}

check('2. every static task_type literal under src/ resolves through the real router',
  violations.length === 0, violations.join('; '));

// ── 3. the scan itself is non-trivial (guards against a silently-broken regex) ──
check('3. the scan found a real, non-zero number of call sites', totalCallSites > 0, `totalCallSites=${totalCallSites}`);

// ── 4. the three values this ticket concerns resolve to real, configured agents ──
check('4. resolveAgent("chat") routes to ideas_chat with a real configured model',
  resolveAgent('chat') === 'ideas_chat' && typeof AGENT_MODELS.ideas_chat === 'string' && AGENT_MODELS.ideas_chat.length > 0,
  `resolveAgent=${resolveAgent('chat')} model=${AGENT_MODELS.ideas_chat}`);
check('4b. resolveAgent("evaluate") routes to critic with a real configured model',
  resolveAgent('evaluate') === 'critic' && typeof AGENT_MODELS.critic === 'string' && AGENT_MODELS.critic.length > 0,
  `resolveAgent=${resolveAgent('evaluate')} model=${AGENT_MODELS.critic}`);
check('4c. resolveAgent("fix") routes to polisher with a real configured model',
  resolveAgent('fix') === 'polisher' && typeof AGENT_MODELS.polisher === 'string' && AGENT_MODELS.polisher.length > 0,
  `resolveAgent=${resolveAgent('fix')} model=${AGENT_MODELS.polisher}`);

// ── 5. regression pin: the four call sites this ticket concerns still carry the known-good value ──
const pinnedSites = [
  ['components/FloatingBrainstorm.jsx', "task_type: 'chat'"],
  ['components/notebook/IdeasChatbot.jsx', "task_type: 'chat'"],
  ['lib/sceneExecutionAcceptanceRunners.js', "task_type: 'evaluate'"],
  ['lib/sceneExecutionAcceptanceRunners.js', "task_type: 'fix'"],
];
for (const [file, literal] of pinnedSites) {
  const text = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
  check(`5. ${file} still contains ${literal}`, text.includes(literal));
}

// ── 6. tests/toolsTaskTypeGuard.test.mjs's own valid set is a superset of the derived one ──
// (it's allowed to be broader — 'transform'/'publishing' etc. exist for future call
// sites — but it must never be MISSING a value the real router actually routes for
// a value already in live use, which check 2 already proves; this just confirms the
// legacy test's own list didn't silently shrink back to the stale 10-entry version.)
const legacyTestSrc = fs.readFileSync(path.join(ROOT, 'tests', 'toolsTaskTypeGuard.test.mjs'), 'utf8');
check('6. tests/toolsTaskTypeGuard.test.mjs\'s VALID_TASK_TYPES includes chat/evaluate/fix',
  ["'chat'", "'evaluate'", "'fix'"].every((lit) => legacyTestSrc.includes(lit)));

// ── 7. that legacy test is now classified 'run', not 'regression' ──
const runLegacySrc = fs.readFileSync(path.join(ROOT, 'tests', 'run-legacy.mjs'), 'utf8');
check('7. toolsTaskTypeGuard.test.mjs is reclassified from regression to run',
  /'toolsTaskTypeGuard\.test\.mjs':\s*\{\s*class:\s*'run'\s*\}/.test(runLegacySrc));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
