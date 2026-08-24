// DEADTEST-6 acceptance battery — "They was" was never ported into the shared
// MALFORMED_CANARIES list during SAVEFIX-1's migration (only "You was" made
// it), so prosePolisherQualityGate.test.mjs checks 4 and 11 failed for real.
//
// manuscriptSafetyGate.js imports generationContext.js, which uses the `@/`
// alias — not resolvable under bare Node. Load the source into a VM sandbox
// (same pattern as test/polishfix9.acceptance.mjs) to exercise the real
// detector instead of duplicating its regex.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const src = fs.readFileSync(path.join(ROOT, 'src/lib/manuscriptSafetyGate.js'), 'utf8');

let code = src.replace(/import\s+.*?;/g, '');
code = code.replace(/export\s+/g, '');

const sandbox = {
  detectModelControlTokens: () => [],
  findNarrativeMetaLeaks: () => [],
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const detectMalformedGrammar = sandbox.detectMalformedGrammar;

const phrases = (t) => detectMalformedGrammar(t).matches.map((m) => m.phrase);

check('1. canary present in source', src.includes("{ pattern: /\\bThey was\\b/g, name: 'They was' }"));
check('2. "They was hiding." trips the gate', phrases('They was hiding.').includes('They was'), JSON.stringify(phrases('They was hiding.')));
check('3. "You was" still trips (regression)', phrases('You was hiding.').includes('You was'), JSON.stringify(phrases('You was hiding.')));
check('4. clean prose does not trip', detectMalformedGrammar('They were hiding in the barn.').matches.length === 0, JSON.stringify(phrases('They were hiding in the barn.')));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
