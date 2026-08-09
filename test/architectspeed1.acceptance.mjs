
// ARCHITECTSPEED-1 acceptance battery.
//
// The defect (measured live 2026-08-09 building a fiction anthology): anthology outline
// generation (anthologyBatchOutline.js) routes to the ARCHITECT agent, which was
// deepseek-r1-32b — a 32B reasoning model. On the single-slot local rig (llama-swap,
// models-max 1) the 32B (~20GB Q4) cold-loads on every swap from the prose model, and
// its long "thinking" before emitting the 5-story JSON batch blew past the 300s per-batch
// cap. Every batch timed out; the run correctly refused to save placeholder junk and
// produced nothing. Fix: route the architect to deepseek-r1-14b (the proven fast R1
// reasoning alias, already the researcher/critic model), which loads and generates fast
// enough to fit the cap. Source-level assertions (localLLM.js imports browser modules).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

const src = fs.readFileSync(path.join(ROOT, 'src/lib/localLLM.js'), 'utf8');

// Extract the AGENT_MODELS block and each agent's model string.
const blockMatch = src.match(/export const AGENT_MODELS = \{([\s\S]*?)\n\};/);
check('1. AGENT_MODELS block present', !!blockMatch);
const block = blockMatch ? blockMatch[1] : '';
const modelOf = (agent) => {
  const m = block.match(new RegExp('\\n\\s*' + agent + ':\\s*\'([^\']+)\''));
  return m ? m[1] : null;
};

// The fix: architect is now the 14B, not the 32B.
check('2. architect routes to deepseek-r1-14b', modelOf('architect') === 'deepseek-r1-14b');
check('3. architect is NOT the slow 32B any more', modelOf('architect') !== 'deepseek-r1-32b');
check('4. no agent VALUE routes to deepseek-r1-32b (comment mentions are fine)', !/:\s*'deepseek-r1-32b'/.test(block));

// Regression guard: the other agents are unchanged.
check('5. ghostwriter unchanged (fiction prose 35B)', modelOf('ghostwriter') === 'qwen3.6-35b-uncensored');
check('6. researcher unchanged (r1-14b)', modelOf('researcher') === 'deepseek-r1-14b');
check('7. critic unchanged (r1-14b)', modelOf('critic') === 'deepseek-r1-14b');
check('8. nonfiction_writer unchanged (27B)', modelOf('nonfiction_writer') === 'HauhauCS/Qwen3.6-27B-Uncensored-HauhauCS-Aggressive:Q5_K_P');

// The change is documented with its rationale.
check('9. ARCHITECTSPEED-1 rationale documented in code', src.includes('ARCHITECTSPEED-1'));

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
