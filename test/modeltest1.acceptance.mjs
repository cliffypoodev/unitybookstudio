import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

function runTest() {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/modelRouting.js'), 'utf8');
  
  // Extract constant
  const nfModelMatch = src.match(/const\s+NONFICTION_INSTRUCT_MODEL\s*=\s*'([^']+)'/);
  const nfModel = nfModelMatch ? nfModelMatch[1] : null;
  
  const wmSrc = fs.readFileSync(path.join(ROOT, 'src/lib/writingModel.js'), 'utf8').catch ? 'HauhauCS/Qwen3.6-27B-Uncensored-HauhauCS-Aggressive:Q5_K_P' : fs.readFileSync(path.join(ROOT, 'src/lib/writingModel.js'), 'utf8');
  const pwmMatch = wmSrc.match(/export const PRIMARY_WRITING_MODEL\s*=\s*'([^']+)'/);
  const PRIMARY_WRITING_MODEL = pwmMatch ? pwmMatch[1] : 'HauhauCS/Qwen3.6-27B-Uncensored-HauhauCS-Aggressive:Q5_K_P';

  const pickModelBodyMatch = src.match(/export function pickModel\([^)]*\)\s*{([\s\S]*?^})/m);
  const pickModelBody = pickModelBodyMatch ? pickModelBodyMatch[1].slice(0, -1) : '';

  const sandbox = {
    isNonfictionProjectAuthority: (project) => {
      const declared = String(project?.book_type || project?.project_type || '').toLowerCase().trim();
      return declared === 'nonfiction';
    },
    PRIMARY_WRITING_MODEL
  };

  const pickModel = new Function('task', 'settings', `
    const isNonfictionProjectAuthority = this.isNonfictionProjectAuthority;
    const NONFICTION_INSTRUCT_MODEL = '${nfModel}';
    const PRIMARY_WRITING_MODEL = this.PRIMARY_WRITING_MODEL;
    ${pickModelBody}
  `).bind(sandbox);

  // 1
  const m1 = pickModel('prose', {project_type: 'nonfiction'});
  check("1. pickModel('prose', {project_type: 'nonfiction'}) -> 'ghostwriter-nf' (decided by project_type)", m1 === 'ghostwriter-nf');

  // 2
  const m2 = pickModel('prose', {project_type: 'fiction'});
  check("2. pickModel('prose', {project_type: 'fiction'}) -> PRIMARY_WRITING_MODEL", m2 === PRIMARY_WRITING_MODEL);

  // 3
  const m3 = pickModel('beats', {book_type: 'nonfiction'});
  check("3. pickModel('beats', <NF authority object via book_type>) -> 'ghostwriter-nf'", m3 === 'ghostwriter-nf');

  // 4
  const oldVal = 'HauhauCS/Qwen3.6-27B-Uncensored-HauhauCS-Aggressive:Q5_K_P';
  const rxOld = new RegExp(`const\\s+NONFICTION_INSTRUCT_MODEL\\s*=\\s*'${oldVal}'`);
  check("4. modelRouting.js does NOT contain old value for NONFICTION_INSTRUCT_MODEL", !rxOld.test(src));
  check("4. modelRouting.js contains MODELTEST-1", src.includes('MODELTEST-1'));

  if (failures === 0) {
    console.log('ACCEPTANCE: ALL CHECKS MATCHED');
  }
  process.exit(failures === 0 ? 0 : 1);
}

runTest();
