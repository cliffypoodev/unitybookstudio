// EVIDENCE-2 acceptance — Closed-world compound phrases resolve by segment — researched atoms stop false-flagging
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

// Extract just closedWorldCheck function
const cwFuncMatch = swCodeRaw.match(/function closedWorldCheck\(prose, project\) \{[\s\S]*?\n\}/);
if (!cwFuncMatch) {
  console.error("Could not find closedWorldCheck function in sceneWriter.js");
  process.exit(1);
}

const cwFuncCodeRaw = cwFuncMatch[0];
const cwFuncCode = cwFuncCodeRaw.replace(/\/\/[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
const cwFuncExec = cwFuncCode.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');

// Source-level assertions
check('The connective split regex (?:and|of|at|in|on|for|the) is present in closedWorldCheck', cwFuncExec.includes('(?:and|of|at|in|on|for|the)'));
check('The old line `if (segs.length < 2 || !segs.every((seg) => inEV(seg))) bad.push(ph);` is gone', !cwFuncExec.includes('!segs.every((seg) => inEV(seg))) bad.push(ph)'));

// Functional tests
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

const vmSrc = cwFuncMatch[0] + '\n__e = { closedWorldCheck };';
vm.runInContext(vmSrc, gcCtx);
const { closedWorldCheck } = gcCtx.__e;

const project = {
  research_data: "Anders Veldt worked as a foreman at the docks and filed the first warning. Pump Station 7 stood beside the canal gate.",
  research_md:  "The Halloran Committee heard testimony in 1922. Galvin City and Harwick supplied the labor rolls.",
  seed_concept: "A dockside structural failure and the inquiry that followed.",
  canon_md:     "The Callowmere Bombing hardened public opinion."
};

const sent1 = "Witnesses saw Foreman Anders Veldt of Pump Station 7 wave the crews back.";
const res1 = closedWorldCheck(sent1, project);
check('Descriptor + "of"-compound of researched atoms -> CLEAN', res1.length === 0);

const sent2 = "Records name Foreman Anders Veldt of the Zenith Works as the signatory.";
const res2 = closedWorldCheck(sent2, project);
check('Compound with one unresearched segment -> FLAGGED', res2.length > 0 && res2[0].snippet === sent2);

const sent3 = "Crowds recalled the Callowmere Bombing when the noise reached them.";
const res3 = closedWorldCheck(sent3, project);
check('Wholly-unresearched phrase -> FLAGGED', res3.length > 0 && res3[0].snippet === sent3);

const sent4a = "Galvin City and Harwick sent workers.";
const res4a = closedWorldCheck(sent4a, project);
check('"and"-compound behavior preserved (CLEAN case)', res4a.length === 0);

const sent4b = "Galvin City and Mordwell sent workers.";
const res4b = closedWorldCheck(sent4b, project);
check('"and"-compound behavior preserved (FLAGGED case)', res4b.length > 0 && res4b[0].snippet === sent4b);

const sent5 = "The Halloran Committee convened again.";
const res5 = closedWorldCheck(sent5, project);
check('research_md atom still resolves -> CLEAN', res5.length === 0);

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
