// NFEXPORT-BIB-1 acceptance battery — a nonfiction book without a real
// Sources section is not done. A title test alone is not enough (the
// flagship's chapter titled "Bibliography & Sources" holds another book's
// fiction) — the SHAPE of the back-matter chapter's body is what matters.
// exportSafetyGate.js has @/-aliased dependencies (bibliographyGenerator.js
// among them) and can only be exercised through the Vite alias loader, so
// its wiring is verified via source-shape reads here, the way malformedsent1
// checks exportSafetyGate.js. The entry-shape logic itself
// (bibliographyEntryShape.js) has no dependencies and is tested directly.
import fs from 'node:fs';
import { BIBLIOGRAPHY_ENTRY_SHAPE_VERSION, BIB_ENTRY_RX, countBibliographyEntries } from '../src/lib/bibliographyEntryShape.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── 1. version ──
check('1. BIBLIOGRAPHY_ENTRY_SHAPE_VERSION', BIBLIOGRAPHY_ENTRY_SHAPE_VERSION === 'bibliography-entry-shape-v1');

// ── 2. a dressing-room-scene-style chapter (real prose, no citation shape) is NOT a Sources section ──
{
  const dressingRoom = [
    'Lena stood at the mirror and said, "I do not know if I am ready."',
    'Marcus watched her from the doorway, arms crossed, saying nothing for a long moment before he finally spoke.',
    'She turned, the dress catching the light, and for a second neither of them said anything at all.',
    'Outside, the stage manager called places, and the moment broke like glass on a tile floor.',
  ].join('\n\n');
  const n = countBibliographyEntries(dressingRoom);
  check('2. a contaminated back-matter chapter counts 0 entries (below the floor of 4)', n < 4, `entries=${n}`);
}

// ── 3. a real bibliography (bullets, numbered items, URL+year citations) counts >= 4 ──
{
  const realBib = [
    'Missouri State Archives. "Warden\'s Ledger, 1954." 1954. https://example.org/a.',
    'Jefferson City Tribune. Documentation of the riot (1954). https://example.org/b.',
    '- A third entry as a bullet, no URL needed here.',
    '4. A fourth entry, numbered, still counts as an explicit list item.',
  ].join('\n\n');
  const n = countBibliographyEntries(realBib);
  check('3. a real bibliography counts >= 4 entries', n >= 4, `entries=${n}`);
}

// ── 4. a single citation signal alone (just a year, or just a quote) does not count ──
{
  const oneSignalOnly = 'The year was 1954, and nothing else about this sentence resembles a citation at all.';
  check('4. one citation signal alone is not an entry', countBibliographyEntries(oneSignalOnly) === 0);
}

// ── 5. a bulleted/numbered line counts even with no URL/year (single-signal exemption for explicit list markers) ──
{
  check('5. a bullet line alone is an entry', countBibliographyEntries('- Just a bulleted line with no other signal.') === 1);
  check('6. a numbered line alone is an entry', countBibliographyEntries('1. Just a numbered line with no other signal.') === 1);
}

// ── 7. BIB_ENTRY_RX exported and matches a bullet ──
check('7. BIB_ENTRY_RX matches a leading bullet', BIB_ENTRY_RX.test('* An entry.'));

// ── 8-14. source-shape wiring in exportSafetyGate.js ──
{
  const GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
  check('8. imports isNonfictionProject', GATE.includes("isNonfictionProject } from './projectType.js'") || GATE.includes('isNonfictionProject'));
  check('9. imports isBackMatter + NF_BIBLIOGRAPHY_HARD_BLOCK from bibliographyGenerator.js', GATE.includes("from './bibliographyGenerator.js'") && GATE.includes('isBackMatter') && GATE.includes('NF_BIBLIOGRAPHY_HARD_BLOCK'));
  check('10. imports countBibliographyEntries from bibliographyEntryShape.js', GATE.includes("from './bibliographyEntryShape.js'") && GATE.includes('countBibliographyEntries'));
  check('11. zero-telemetry line present', GATE.includes('[NFEXPORT-BIB-1] Gate scan: sources='));
  check('12. no-Sources warning names the reason', GATE.includes('NFEXPORT-BIB-1: no Sources section'));
  check('13. titled-but-empty back matter is named by title + entry count', GATE.includes('is titled as Sources but has') && GATE.includes('entries'));
  check('14. NF_BIBLIOGRAPHY_HARD_BLOCK gates hardFailures vs warnings with REJECT_MANUAL_REVIEW', GATE.includes('if (NF_BIBLIOGRAPHY_HARD_BLOCK)') && GATE.includes("recommendedAction: 'REJECT_MANUAL_REVIEW'") && /hardFailures\.push\(entry\)/.test(GATE) && /warnings\.push\(entry\)/.test(GATE));
  const blockStart = GATE.indexOf('NFEXPORT-BIB-1: a nonfiction book without a Sources section');
  const blockEnd = GATE.indexOf('Series Contract Gate', blockStart);
  const block = blockStart >= 0 && blockEnd > blockStart ? GATE.slice(blockStart, blockEnd) : '';
  check('15. the whole block is gated on isNonfictionProject(project) — fiction untouched', block.includes('if (isNonfictionProject(project))'), block.slice(0, 200));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
