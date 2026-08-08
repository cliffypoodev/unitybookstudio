// ARCH-1C + BOOKGATE-3B acceptance battery — written exactly per the doc spec,
// to prove the spec's cases pass against the doc's code before Antigravity runs it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildFactLedger, checkClockTimeViolations, checkFateViolations, stripFactLedgerViolations, buildFactLedgerPromptBlock } from '../src/lib/nfContentGuard.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
function check(name, pass) {
  if (pass) console.log(`PASS ${name}`);
  else { console.log(`FAIL ${name}`); failures++; }
}

// Case-1 fixture (generic names only)
const project1 = {
  research_data: JSON.stringify({
    key_figures: [
      { name: 'Ada Kern', role: 'clerk', documented_actions: 'Present in the building that day; her account was recorded the following spring.' },
      { name: 'Nora Hale', role: 'resident', documented_actions: 'Nora Hale was killed when the wall came down.' },
      { name: 'Tom Hale', role: 'resident', documented_actions: 'Tom Hale was rescued from the wreckage by neighbors.' },
      { name: 'Consolidated Steel', role: 'company', documented_actions: 'Operated the plant; steel output doubled that year.' },
    ],
    timeline: [{ date: '1919-01-15', event: 'Alarm logged at 12:40 in the afternoon.' }],
  }),
  research_md: 'The steel from the plant was shipped east all winter. '.repeat(6),
  seed_concept: 'A documented industrial disaster and its aftermath.',
};
const L = buildFactLedger(project1);

// 1
check('1. ledger ok from string research_data', L.ok === true);
check('1. clock times = [12:40]', L.clockTimes.length === 1 && L.clockTimes[0] === '12:40');
check('1. figures include Kern and Hale', L.figures.some((f) => f.surname === 'Kern') && L.figures.some((f) => f.surname === 'Hale'));
check('1. common-noun surname Steel filtered', !L.figures.some((f) => f.surname === 'Steel'));
const kern = L.figures.find((f) => f.surname === 'Kern');
const nora = L.figures.find((f) => f.name === 'Nora Hale');
const tom = L.figures.find((f) => f.name === 'Tom Hale');
check('1. Kern nothing attested', kern && !kern.attested.death && !kern.attested.survival && !kern.attested.injury);
check('1. Nora Hale death attested', nora && nora.attested.death === true);
check('1. Tom Hale survival attested', tom && tom.attested.survival === true);

// 2
const v2 = checkFateViolations('Ada Kern died at dawn.', L);
check('2. un-attested fate flags with atom', v2.length === 1 && v2[0].atom === 'Kern+death');

// 3
check('3. own-entry attestation passes', checkFateViolations('Nora Hale was killed instantly when the wall fell.', L).length === 0);

// 4
check('4. collision: Tom full-name rescue passes', checkFateViolations('Tom Hale was rescued by neighbors within the hour.', L).length === 0);
check('4. collision: Nora full-name death passes', checkFateViolations('Nora Hale died instantly.', L).length === 0);

// 5
const project5 = {
  ...project1,
  research_md: 'Rescuers later confirmed Kern perished beneath the timbers. ' + 'The docket recorded the receipt of the report the same week. '.repeat(4),
};
const L5 = buildFactLedger(project5);
check('5. same-sentence prose attestation passes claim', checkFateViolations('Ada Kern died at dawn.', L5).length === 0);

// 6
check('6. REGRESSION adjacent-entry bleed: Kern.death false', kern && kern.attested.death === false);

// 7
check('7. distance >7 aggregate no-pair', checkFateViolations('While Kern organized the station house that morning, workers elsewhere along the waterfront counted the dead.', L).length === 0);

// 8
check('8. number-quantified aggregate exempt', checkFateViolations('The list included Kern, and the one hundred fifty injured filled every hospital ward.', L).length === 0);
check('8. individual injury claim still flags', checkFateViolations('Kern was injured when the wall came down.', L).length === 1);

// 9
check('9. "victims" phrasing flags', checkFateViolations('Kern was among the victims.', L).length === 1);
check('9. polarity-agnostic "unable to escape" flags', checkFateViolations('Kern was unable to escape before the water rose.', L).length === 1);

// 10
check('10. sentence-initial "Name," skipped', checkFateViolations('Kern, thousands feared, had witnesses everywhere that year.', L).length === 0);
check('10. sentence-initial name w/o comma flags', checkFateViolations('Kern died at dawn.', L).length === 1);

// 11
check('11. evidenced clock passes', checkClockTimeViolations('The alarm was logged at 12:40 that afternoon.', L).length === 0);
const v11 = checkClockTimeViolations('The wave struck at 12:07, according to the alarm log.', L);
check('11. un-evidenced clock flags with atom', v11.length === 1 && v11[0].atom === '12:07');
check('11. ratio 3:1 not a clock', checkClockTimeViolations('The odds stood at 3:1 against them.', L).length === 0);
const noClockLedger = buildFactLedger({ ...project1, research_data: JSON.stringify({ key_figures: [{ name: 'Ada Kern', documented_actions: 'Present in the building.' }] }) });
check('11. no-clock evidence: any clock flags', checkClockTimeViolations('It began at 9:15 that morning.', noClockLedger).length === 1);

// 12
const para12 = 'The station kept its routine. Kern died at dawn. The wave struck at 12:07, according to the alarm log. The alarm was logged at 12:40 that afternoon.\n\nA second paragraph survives untouched.';
const s12 = stripFactLedgerViolations(para12, L);
check('12. strip removes exactly 2 sentences', s12.removed.length === 2);
check('12. strip keeps valid neighbors', s12.text.includes('kept its routine') && s12.text.includes('logged at 12:40'));
check('12. strip preserves paragraph break', s12.text.includes('\n\n') && s12.text.includes('second paragraph survives'));
const s12b = stripFactLedgerViolations('The case of Dorr v. United States settled the question. Kern was rescued after four hours.', L);
check('12. v-dot protection intact', s12b.text.includes('Dorr v. United States') && !s12b.text.includes('rescued'));

// 13
const pb = buildFactLedgerPromptBlock(L);
check('13. clock line for evidence-with-times', pb.includes('ONLY these clock times: 12:40'));
check('13. NO-clock line for evidence-without', buildFactLedgerPromptBlock(noClockLedger).includes('the research contains NO clock times'));
check('13. attested figure line', pb.includes('Nora Hale: death attested'));
check('13. exactly one grouped unattested line incl. Ada Kern', (pb.match(/NO death, survival, or injury is attested for:/g) || []).length === 1 && /NO death, survival, or injury is attested for:[^\n]*Ada Kern/.test(pb));
check('13. empty when ledger not ok', buildFactLedgerPromptBlock({ ok: false, clockTimes: [], figures: [] }) === '');

// 14
const tiny = buildFactLedger({ research_data: 'short' });
check('14. tiny evidence → ok false', tiny.ok === false);
check('14. ok:false checkers return []', checkFateViolations('Ada Kern died at dawn.', tiny).length === 0 && checkClockTimeViolations('At 12:07 it began.', tiny).length === 0);
const corrupt = buildFactLedger({ research_data: '{not json' + 'x'.repeat(300), research_md: 'A real corpus of prose long enough to clear the evidence floor for the ledger build. '.repeat(5) });
check('14. corrupt JSON → ok true, zero figures', corrupt.ok === true && corrupt.figures.length === 0);

// 15
const urlLedger = buildFactLedger({
  research_data: JSON.stringify({ key_figures: [{ name: 'Jane Marsh', role: 'inspector', documented_actions: 'Filed the report.', source_types: 'https://example.com/report-on-jane-marsh-findings' }] }),
  research_md: 'The inspector filed the report the same week, and the office recorded its receipt in the docket. '.repeat(4),
});
check('15. URL-slug lowercase does not drop surname', urlLedger.figures.some((f) => f.surname === 'Marsh'));

// 16-18: source assertions (wiring)
const sw = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
check('16. sceneWriter prompt injection wired', sw.includes('buildFactLedgerPromptBlock(buildFactLedger(project))'));
check('16. sceneWriter strip wired', sw.includes('stripFactLedgerViolations(prose, flLedger)'));
check('16. sceneWriter blocker wired', sw.includes('Clock times not present in the research'));
const mpr = fs.readFileSync(path.join(ROOT, 'src/lib/manuscriptPolishRunner.js'), 'utf8');
check('17. polish heal wired', mpr.includes('ARCH-1C stripped') && mpr.includes('stripFactLedgerViolations'));
const esg = fs.readFileSync(path.join(ROOT, 'src/lib/exportSafetyGate.js'), 'utf8');
check('18. export hard gate wired', esg.includes('[ARCH-1C] ${v.type} not in evidence') && esg.includes("from './nfContentGuard.js'; // ARCH-1C"));

// 19: BOOKGATE-3B
check('19. BOOKGATE-3B: dead field read gone', !esg.includes("String(ch?.content || '')"));
check('19. BOOKGATE-3B: content_md read present', esg.includes("String(ch?.content_md || ch?.content || '')"));

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
