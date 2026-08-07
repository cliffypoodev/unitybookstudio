import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const src = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');

// Extract quickSceneEval
const match = src.match(/(function quickSceneEval[\s\S]*?\n})/);
if (!match) {
  console.error("Could not find quickSceneEval in sceneWriter.js");
  process.exit(1);
}

const quickSceneEvalCode = match[1];

const sandbox = {
  extractTextFromLLMResult: (s) => String(s),
  findNarrativeMetaLeaks: () => [],
  isNonfictionProject: () => false,
  isNonfictionAnthology: () => false,
  isNonfictionProjectAuthority: () => false,
};
vm.createContext(sandbox);
vm.runInContext(quickSceneEvalCode, sandbox);
const quickSceneEval = sandbox.quickSceneEval;

// Fixture generator (~150 words)
const makeFixture = (insert) => {
  const base = "Word ".repeat(150);
  return base + insert + " It ends here.";
};

// 1. "a to the" blocks
const f1 = makeFixture("The pier was a to the dangers of expansion.");
const res1 = quickSceneEval(f1, {}, 100, {});
check('1. "a to the" blocks with dropped word issue', res1.hasBlockingIssue && res1.issues.some(i => i.includes('dropped word')));

// 2. "a monument to the" does NOT block
const f2 = makeFixture("The pier was a monument to the dangers of expansion.");
const res2 = quickSceneEval(f2, {}, 100, {});
check('2. "a monument to the" does NOT block', !res2.issues.some(i => i.includes('dropped word')));

// 3. "an of the" blocks, hyphenated does not block
const f3 = makeFixture("It was an of the worst events.");
const res3 = quickSceneEval(f3, {}, 100, {});
check('3. "an of the" blocks', res3.hasBlockingIssue && res3.issues.some(i => i.includes('dropped word')));

const f4 = makeFixture("It was a to-the-point reply.");
const res4 = quickSceneEval(f4, {}, 100, {});
check('3. hyphenated "a to-the-point" does NOT block', !res4.issues.some(i => i.includes('dropped word')));

// 4. Trailing-strip regex tests
const stripRe = /([.!?…”])[ \t]*[*_]+[ \t]*(?=\n|$)/g;
const strip = (s) => s.replace(stripRe, '$1');

check('4. trailing strip: "It broke. *\\n"', strip("It broke. *\n") === "It broke.\n");
check('4. trailing strip: end of string', strip("It broke. *") === "It broke.");
check('4. trailing strip: mid-sentence untouched', strip("It was rated 5* on the form.") === "It was rated 5* on the form.");
check('4. trailing strip: own line untouched', strip("* * *") === "* * *");

// 5. Source assertions
const cleanSrc = src.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
check('5. regex literal present in quickSceneEval', cleanSrc.includes('(?:a|an)\\s+(?:to|of|in|on|for|with|from|by|at)\\s+the'));
check('5. trailing strip replace present in source', cleanSrc.includes('/([.!?…”])[ \\t]*[*_]+[ \\t]*(?=\\n|$)/g, \'$1\''));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
