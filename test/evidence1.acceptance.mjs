// EVIDENCE-1 acceptance — The closed-world check verifies against the RESEARCH, not the AI-generated bible
import { readFileSync } from 'fs';
import vm from 'node:vm';

let pass = 0, failures = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { failures++; console.log('FAIL ' + name); }
}

const swPath = new URL('../src/lib/sceneWriter.js', import.meta.url).pathname;
const swCodeRaw = readFileSync(swPath, 'utf-8');
const swCode = swCodeRaw.replace(/\/\/[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
const swExec = swCode.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');

const cwMatch = swExec.match(/const EV = [^;]+;/);
const cwLine = cwMatch ? cwMatch[0] : '';

check('EV construction includes project.research_md', cwLine.includes('project.research_md'));
check('EV construction includes NONE of the bible fields', 
  !cwLine.includes('world_md') && !cwLine.includes('characters_md') && 
  !cwLine.includes('canon_md') && !cwLine.includes('mystery_md') && 
  !cwLine.includes('outline_md') && !cwLine.includes('voice_md')
);

const fsPath = new URL('../src/lib/foundationStorage.js', import.meta.url).pathname;
const fsCode = readFileSync(fsPath, 'utf-8');
check('foundationStorage.js lists research_md in offloaded/hydrated fields', fsCode.includes(`'research_md',`));

const warnings = [];
const errors = [];
const gcCtx = {
  console: { 
    log: (...a) => warnings.push(a.join(' ')), 
    warn: (...a) => warnings.push(a.join(' ')), 
    error: (...a) => errors.push(a.join(' ')) 
  },
  splitSentencesSafe: (text) => text.split(/(?<=\.)\s+/).filter(Boolean),
  __e: {},
};
vm.createContext(gcCtx);

// Extract just closedWorldCheck function
const cwFuncMatch = swCodeRaw.match(/function closedWorldCheck\(prose, project\) \{[\s\S]*?\n\}/);
if (!cwFuncMatch) {
  console.error("Could not find closedWorldCheck function in sceneWriter.js");
  process.exit(1);
}
const vmSrc = cwFuncMatch[0] + '\n__e = { closedWorldCheck };';

vm.runInContext(vmSrc, gcCtx);
const { closedWorldCheck } = gcCtx.__e;

const project = {
  research_data: "Alderman Vexley oversaw the Harborline inquiry of 1921 into the viaduct failure that killed fourteen workers and injured forty more residents of the district.",
  research_md:  "The Copperfield Viaduct report of 1921 recorded the structural findings in full detail for the inquiry board and the city council.",
  seed_concept: "A city viaduct failure and the public inquiry that followed it.",
  canon_md:     "The Northgate Bombing shaped public fear across the city.",
  world_md: "", characters_md: "", mystery_md: "", outline_md: "", voice_md: ""
};

const sent1 = "Witnesses recalled the Northgate Bombing when the noise reached them.";
const res1 = closedWorldCheck(sent1, project);
check('Prose sentence containing a canon-only atom mid-sentence -> FLAGGED', res1.length > 0 && res1[0].snippet === sent1);

const sent2 = "Alderman Vexley opened the inquiry that morning.";
const res2 = closedWorldCheck(sent2, project);
check('Alderman Vexley opened the inquiry that morning -> CLEAN', res2.length === 0);

const sent3 = "The board cited the Copperfield Viaduct report in its findings.";
const res3 = closedWorldCheck(sent3, project);
check('The board cited the Copperfield Viaduct report in its findings -> CLEAN', res3.length === 0);

const sent4 = "Payments moved through the Zephyr Consortium ledger that spring.";
const res4 = closedWorldCheck(sent4, project);
check('Payments moved through the Zephyr Consortium ledger that spring -> FLAGGED', res4.length > 0 && res4[0].snippet === sent4);

check('EV corpus floor skip is not triggered', !warnings.some(w => w.includes('[CLOSED-WORLD] evidence corpus is')));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
