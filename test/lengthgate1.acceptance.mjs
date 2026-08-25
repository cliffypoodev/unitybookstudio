// LENGTHGATE-1 acceptance — Chapter length becomes a gated contract: scene floor at draft time, hard block at export
import { readFileSync } from 'fs';
import vm from 'node:vm';

let pass = 0, failures = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { failures++; console.log('FAIL ' + name); }
}

const swPath = new URL('../src/lib/sceneWriter.js', import.meta.url).pathname;
const swCode = readFileSync(swPath, 'utf-8').replace(/\/\/[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
const swExec = swCode.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
check('sceneWriter uses sceneWordFloor logic', swExec.includes('Math.max(150, Math.round(targetWords * 0.6))'));
check('sceneWriter old absolute floor is removed', !swExec.includes('words.length < targetWords * 0.5 && words.length < 300'));

const sgPath = new URL('../src/lib/exportSafetyGate.js', import.meta.url).pathname;
const sgCodeRaw = readFileSync(sgPath, 'utf-8');
const sgCode = sgCodeRaw.replace(/\/\/[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
const sgExec = sgCode.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
const gateHits = (sgExec.match(/\[LENGTHGATE-1B\]/g) || []).length;
check('exportSafetyGate contains LENGTHGATE-1B markers', gateHits >= 2);
check('exportSafetyGate uses 0.75 floor', sgExec.includes('explicitChapterTarget * 0.75'));
check('exportSafetyGate ignores chapter_target', !sgExec.includes('project?.chapter_target '));

// Extract the source and run in VM to avoid ESM import issues with @/lib
const warnings = [];
const errors = [];
const gcCtx = {
  console: { 
    log: (...a) => warnings.push(a.join(' ')), 
    warn: (...a) => warnings.push(a.join(' ')), 
    error: (...a) => errors.push(a.join(' ')) 
  },
  runManuscriptSafetyGate: () => ({ 
    ok: true, 
    blocked: false, 
    hardFailures: [], 
    warnings: [],
    reasons: [],
    recommendedAction: '',
    processLeaks: { matches: [] },
    contamination: { matches: [] },
    malformed: { matches: [] }
  }),
  runReferenceIntegrityGate: () => ({ blocked: false, blockingIssues: [], advisoryIssues: [], warnings: [] }),
  ensureResearchEvidence: async (p) => p, // RESEARCHQUALITY-2C: lane hydration is a pass-through in this harness
  checkStructuralIntegrity: () => [],
  checkBookIntegrity: () => ({ shortChapters: [] }),
  isBackMatter: () => false, // LENGTHGATE-1C: this battery's fixtures are all body chapters
  __e: {},
};
vm.createContext(gcCtx);

const vmSrc = sgCodeRaw
  .replace(/^import .*$/gm, '')
  .replace(/^export (async )?function/gm, '$1function')
  .replace(/^export (const|class|let)/gm, '$1')
  + '\n__e = { runPreExportSafetyGate };';

vm.runInContext(vmSrc, gcCtx);
const { runPreExportSafetyGate } = gcCtx.__e;

// We need varied filler text so dedupe logic in runManuscriptSafetyGate doesn't trigger and clutter the output.
function makeFiller(words) {
  let text = '';
  for (let i = 0; i < words; i++) {
    text += `word${i} `;
  }
  return text.trim();
}

(async () => {
  const projTarget4k = { target_chapter_words: 4000 };
  const projNoTarget = {};

  const text1800 = makeFiller(1800);
  const ch1800 = { chapter_number: 1, title: 'Short Chapter', content_md: text1800 };

  const res1 = await runPreExportSafetyGate([ch1800], { project: projTarget4k });
  check('1800 words vs 4000 target -> blocked by LENGTHGATE-1B', res1.blocked === true && res1.hardFailures.some(f => f.reasons && f.reasons[0] && f.reasons[0].includes('[LENGTHGATE-1B]')));

  const text3900 = makeFiller(3900);
  const ch3900 = { chapter_number: 2, title: 'Good Chapter', content_md: text3900 };
  const res2 = await runPreExportSafetyGate([ch3900], { project: projTarget4k });
  check('3900 words vs 4000 target -> NOT blocked by LENGTHGATE-1B', !(res2.blocked === true && res2.hardFailures.some(f => f.reasons && f.reasons[0] && f.reasons[0].includes('[LENGTHGATE-1B]'))));

  const text900 = makeFiller(900);
  const ch900 = { chapter_number: 3, title: 'No Target Chapter', content_md: text900 };
  const res3 = await runPreExportSafetyGate([ch900], { project: projNoTarget });
  check('900 words vs NO target -> NOT blocked by LENGTHGATE-1B', !(res3.blocked === true && res3.hardFailures.some(f => f.reasons && f.reasons[0] && f.reasons[0].includes('[LENGTHGATE-1B]'))));

  const text3000 = makeFiller(3000); // 4000 * 0.75 = 3000
  const ch3000 = { chapter_number: 4, title: 'Boundary Chapter', content_md: text3000 };
  const res4 = await runPreExportSafetyGate([ch3000], { project: projTarget4k });
  check('3000 words vs 4000 target (equal to floor) -> NOT blocked by LENGTHGATE-1B', !(res4.blocked === true && res4.hardFailures.some(f => f.reasons && f.reasons[0] && f.reasons[0].includes('[LENGTHGATE-1B]'))));

  console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(err => {
  console.error("Test framework caught error:", err);
  process.exit(1);
});
