// TEMPORAL-1 acceptance battery — relative-time claims ("nearly two years
// later") checked against the research timeline's own order and gap.
// Precision over recall: only a sentence naming exactly two unambiguous,
// dated ledger events is checkable; everything else is counted but skipped.
// nfContentGuard.js has zero dependencies, so it is imported directly.
import fs from 'node:fs';
import { buildFactLedger, parseLedgerDate, checkTemporalViolations, stripFactLedgerViolations, buildFactLedgerPromptBlock } from '../src/lib/nfContentGuard.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── 1-4. parseLedgerDate at three precisions + bad input ──
check('1. day precision', JSON.stringify(parseLedgerDate('June 19, 1865')) === JSON.stringify({ y: 1865, m: 6, d: 19, precision: 'day' }));
check('2. month precision', JSON.stringify(parseLedgerDate('March 1919')) === JSON.stringify({ y: 1919, m: 3, d: null, precision: 'month' }));
check('3. year precision', JSON.stringify(parseLedgerDate('1915')) === JSON.stringify({ y: 1915, m: null, d: null, precision: 'year' }));
check('4. unparseable date returns null', parseLedgerDate('sometime last spring') === null);

function makeProject(timeline) {
  return {
    research_data: JSON.stringify({
      timeline,
      key_figures: [{ name: 'Dr. Hale', role: 'investigator', documented_actions: 'led the excavation and cataloguing effort at the historic site for many long years' }],
    }),
  };
}

const TWO_EVENT_TIMELINE = [
  { date: 'January 1, 1863', event: 'the arrival at the courthouse in the small river town' },
  { date: 'June 19, 1865', event: 'the announcement at the harbor after the long journey south' },
];
const LEDGER = buildFactLedger(makeProject(TWO_EVENT_TIMELINE));
check('5. ledger builds a checkable events list', LEDGER.ok && LEDGER.events.length === 2, JSON.stringify(LEDGER.events));

// ── 6. gap within tolerance passes (real flagship gap: ~2y5.5mo, claim "two years") ──
{
  const text = 'Nearly two years after the arrival at the courthouse in the small river town, word finally reached the announcement at the harbor after the long journey south.';
  const v = checkTemporalViolations(text, LEDGER);
  check('6. gap within tolerance is not a contradiction', v.length === 0 && v.stats.R === 1 && v.stats.C === 1, JSON.stringify({ v, stats: v.stats }));
}

// ── 7. wrong order flagged ──
{
  const text = 'Nearly two years before the arrival at the courthouse in the small river town, everyone celebrated the announcement at the harbor after the long journey south.';
  const v = checkTemporalViolations(text, LEDGER);
  check('7. wrong order is flagged', v.length === 1 && v[0].reason === 'wrong-order', JSON.stringify(v));
}

// ── 8. gap 3x flagged ──
{
  const text = 'Nearly ten years after the arrival at the courthouse in the small river town, they finally reached the announcement at the harbor after the long journey south.';
  const v = checkTemporalViolations(text, LEDGER);
  check('8. a gap ~4x too large is flagged (gap-mismatch)', v.length === 1 && v[0].reason === 'gap-mismatch', JSON.stringify(v));
}

// ── 9. ambiguous event name skipped-but-counted ──
{
  const ambigProject = makeProject([
    { date: '1900', event: 'the founding of the harbor settlement district' },
    { date: '1950', event: 'the founding of the harbor settlement district' },
    { date: '1966', event: 'the closure of the harbor settlement district' },
  ]);
  const ambigLedger = buildFactLedger(ambigProject);
  const text = '16 years after the founding of the harbor settlement district, the closure of the harbor settlement district finally arrived.';
  const v = checkTemporalViolations(text, ambigLedger);
  check('9. ambiguous event name is found (R) but not checkable (C=0), 0 contradictions', v.length === 0 && v.stats.R === 1 && v.stats.C === 0, JSON.stringify(v.stats));
}

// ── 9b. "several" (no exact magnitude) is found but not checkable ──
{
  const text = 'Several years after the arrival at the courthouse in the small river town, they reached the announcement at the harbor after the long journey south.';
  const v = checkTemporalViolations(text, LEDGER);
  check('9b. "several" is counted (R) but not checkable (C=0)', v.stats.R === 1 && v.stats.C === 0, JSON.stringify(v.stats));
}

// ── 10. strip removes only the offending sentence ──
{
  const paragraph = 'The morning was quiet and unremarkable. Nearly ten years after the arrival at the courthouse in the small river town, they finally reached the announcement at the harbor after the long journey south. The evening passed without further incident.';
  const { text, removed } = stripFactLedgerViolations(paragraph, LEDGER);
  check('10a. strip removes exactly the flagged sentence', removed.length === 1 && removed[0].startsWith('Nearly ten years'), JSON.stringify(removed));
  check('10b. the surrounding sentences survive', text.includes('The morning was quiet') && text.includes('The evening passed without further incident'), text);
}

// ── 11. gate hard entry names the sentence (source-shape: exportSafetyGate.js wiring) ──
{
  const GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
  check('11a. imports checkTemporalViolations from nfContentGuard.js', GATE.includes('checkTemporalViolations'));
  check('11b. hard entry uses REJECT_REGENERATE and names the sentence', GATE.includes("recommendedAction: 'REJECT_REGENERATE'") && /\[TEMPORAL-1\] \$\{v\.reason\}.*\$\{v\.snippet/.test(GATE));
}

// ── 12. zero line ──
{
  const lines = [];
  const origLog = console.log;
  console.log = (...args) => { lines.push(args.join(' ')); };
  let v;
  try {
    v = checkTemporalViolations('Nothing relative-time-shaped happens in this sentence at all.', LEDGER);
  } finally {
    console.log = origLog;
  }
  check('12. zero-relative-claims stats are all zero', v.stats.R === 0 && v.stats.C === 0 && v.stats.K === 0);
  const GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
  check('12b. gate logs the zero-friendly R/C/K line', GATE.includes('[TEMPORAL-1] Ch.${ch?.chapter_number}: ${stats.R} relative-time claim(s), ${stats.C} checkable, ${stats.K} contradiction(s)'));
}

// ── 13. buildFactLedgerPromptBlock lists dated events ──
{
  const block = buildFactLedgerPromptBlock(LEDGER);
  check('13. prompt block lists dated events', block.includes('DATED EVENTS') && block.includes('1863-01-01') && block.includes('1865-06-19'), block);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
