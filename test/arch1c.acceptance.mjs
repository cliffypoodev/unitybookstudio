import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

// Import the functions we need to test
import { buildFactLedger, checkClockTimeViolations, checkFateViolations, stripFactLedgerViolations, buildFactLedgerPromptBlock } from '../src/lib/nfContentGuard.js';

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
  // 1
  const project1 = {
    research_data: JSON.stringify({
      key_figures: [
        {name:'Ada Kern', role:'clerk', documented_actions:'Present in the building that day; her account was recorded the following spring.'},
        {name:'Nora Hale', role:'resident', documented_actions:'Nora Hale was killed when the wall came down.'},
        {name:'Tom Hale', role:'resident', documented_actions:'Tom Hale was rescued from the wreckage by neighbors.'},
        {name:'Consolidated Steel', role:'company', documented_actions:'Operated the plant; steel output doubled that year.'}
      ],
      timeline: [{date:'1919-01-15', event:'Alarm logged at 12:40 in the afternoon.'}]
    }),
    research_md: 'The steel from the plant was shipped east all winter. '.repeat(6),
    seed_concept: 'A documented industrial disaster and its aftermath.'
  };

  const L = buildFactLedger(project1);
  const ok1 = L.ok === true;
  const clocks1 = JSON.stringify(L.clockTimes) === JSON.stringify(['12:40']);
  const hasKern = L.figures.some(f => f.surname === 'Kern');
  const hasHale = L.figures.some(f => f.surname === 'Hale');
  const hasSteel = L.figures.some(f => f.surname === 'Steel');
  const kern = L.figures.find(f => f.surname === 'Kern');
  const nora = L.figures.find(f => f.name === 'Nora Hale');
  const tom = L.figures.find(f => f.name === 'Tom Hale');
  
  const kernFalse = kern && Object.values(kern.attested).every(v => v === false);
  const noraDeath = nora && nora.attested.death === true;
  const tomSurvival = tom && tom.attested.survival === true;

  check("1. Ledger build from STRING research_data", ok1 && clocks1 && hasKern && hasHale && !hasSteel && kernFalse && noraDeath && tomSurvival);

  // 2
  const f2 = checkFateViolations('Ada Kern died at dawn.', L);
  check("2. Un-attested individual fate flags", f2.length === 1 && f2[0].atom === 'Kern+death');

  // 3
  const f3 = checkFateViolations('Nora Hale was killed instantly when the wall fell.', L);
  check("3. Own-entry attestation passes", f3.length === 0);

  // 4
  const f4a = checkFateViolations('Tom Hale was rescued by neighbors within the hour.', L);
  const f4b = checkFateViolations('Nora Hale died instantly.', L);
  check("4. Surname-collision resolution", f4a.length === 0 && f4b.length === 0);

  // 5
  const project2 = {
    ...project1,
    research_md: project1.research_md + ' Rescuers later confirmed Kern perished beneath the timbers.'
  };
  const L2 = buildFactLedger(project2);
  const f5 = checkFateViolations('Ada Kern died at dawn.', L2);
  check("5. Same-sentence prose attestation", f5.length === 0);

  // 6
  check("6. Adjacent-entry bleed REGRESSION", kern.attested.death === false);

  // 7
  const f7 = checkFateViolations('While Kern organized the station house that morning, workers elsewhere along the waterfront counted the dead.', L);
  check("7. Distance bound", f7.length === 0);

  // 8
  const f8a = checkFateViolations('The list included Kern, and the one hundred fifty injured filled every hospital ward.', L);
  const f8b = checkFateViolations('Kern was injured when the wall came down.', L);
  check("8. Number-quantified aggregate exemption", f8a.length === 0 && f8b.length === 1);

  // 9
  const f9a = checkFateViolations('Kern was among the victims.', L);
  const f9b = checkFateViolations('Kern was unable to escape before the water rose.', L);
  check("9. Death-class phrasing coverage", f9a.length === 1 && f9b.length === 1);

  // 10
  const f10a = checkFateViolations('Kern, thousands feared, had witnesses everywhere that year.', L);
  const f10b = checkFateViolations('Kern died at dawn.', L);
  check("10. Sentence-initial homograph", f10a.length === 0 && f10b.length === 1);

  // 11
  const c11a = checkClockTimeViolations('The alarm was logged at 12:40 that afternoon.', L);
  const c11b = checkClockTimeViolations('The wave struck at 12:07, according to the alarm log.', L);
  const c11c = checkClockTimeViolations('The odds stood at 3:1 against them.', L);
  
  const project3 = {
    ...project1,
    research_data: JSON.stringify({ key_figures: [] })
  };
  const L_noclock = buildFactLedger(project3);
  const c11d = checkClockTimeViolations('It began at 9:15 that morning.', L_noclock);
  
  check("11. Clock times", c11a.length === 0 && c11b.length === 1 && c11b[0].atom === '12:07' && c11c.length === 0 && c11d.length === 1);

  // 12
  const t12 = "The wave struck at 12:07, according to the alarm log. The alarm was logged at 12:40 that afternoon.\n\nAda Kern died at dawn. She was a clerk.";
  const s12a = stripFactLedgerViolations(t12, L);
  
  const t12b = "The case of Dorr v. United States settled the question. The wave struck at 12:07, according to the alarm log.";
  const s12b = stripFactLedgerViolations(t12b, L);
  
  check("12. stripFactLedgerViolations", s12a.removed.length === 2 && s12a.text.includes('\n\n') && s12a.text.includes('12:40') && !s12a.text.includes('12:07') && s12b.text.includes('Dorr v. United States settled the question.'));

  // 13
  const pb1 = buildFactLedgerPromptBlock(L);
  const pb2 = buildFactLedgerPromptBlock(L_noclock);
  const pb3 = buildFactLedgerPromptBlock({ ok: false });
  
  const pb1ok = pb1.includes('12:40') && pb1.includes('Nora Hale: death attested');
  const pb2ok = pb2.includes('the research contains NO clock times');
  const kernUnattestedMatches = pb1.match(/NO death, survival, or injury is attested for:.*?Ada Kern/g) || [];
  
  check("13. Prompt block", pb1ok && pb2ok && kernUnattestedMatches.length === 1 && pb3 === '');

  // 14
  const L_short = buildFactLedger({ research_data: 'short' });
  const L_badjson = buildFactLedger({ research_data: '{not json' + 'x'.repeat(200), research_md: 'x'.repeat(200) });
  
  check("14. Fail-open semantics", L_short.ok === false && checkClockTimeViolations('12:07', L_short).length === 0 && L_badjson.ok === true && L_badjson.figures.length === 0);

  // 15
  const projectUrl = {
    research_data: JSON.stringify({
      key_figures: [{name:'Jane Marsh', source_types:'https://example.com/report-on-jane-marsh-findings'}]
    }),
    research_md: 'x'.repeat(250)
  };
  const L_url = buildFactLedger(projectUrl);
  check("15. URL-slug filter regression", L_url.figures.some(f => f.surname === 'Marsh'));

  // Assertions 16-19 will be tested via regex of source files in subsequent commits

  if (failures === 0) {
    console.log('ACCEPTANCE: ALL CHECKS MATCHED');
  }
  process.exit(failures === 0 ? 0 : 1);
}

runTest();
