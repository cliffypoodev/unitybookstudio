// ARCH-2 acceptance battery — the researcher layer is closed-world too.
// Every atom the extractor writes into research_data must substring-match
// the batch's own fetched pages, or it is dropped and logged.
// researchAtomGuard.js has zero dependencies (imports only closedWorldText.js,
// itself dependency-free) and is imported directly.
import fs from 'node:fs';
import { RESEARCH_ATOM_GUARD_VERSION, ATOM_BUCKETS, extractAtoms, verifyExtractedAtoms } from '../src/lib/researchAtomGuard.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── 1. version ──
check('1. RESEARCH_ATOM_GUARD_VERSION', RESEARCH_ATOM_GUARD_VERSION === 'research-atom-guard-v1');

const PAGES = [{
  url: 'https://example.org/port-ellis',
  title: 'Port Ellis Archive',
  content: 'Dr. Hale led the excavation at Port Ellis in 1966, cataloguing 42 artifacts from the harbor district records.',
}];

// ── 2. supported item kept ──
{
  const partial = { key_figures: [{ name: 'Dr. Hale', role: 'investigator', dates_active: '1966', documented_actions: 'led the dig at Port Ellis' }] };
  const { kept, dropped } = verifyExtractedAtoms(partial, PAGES);
  check('2. a fully-supported item is kept', kept.key_figures.length === 1 && dropped.length === 0, JSON.stringify({ kept: kept.key_figures, dropped }));
}

// ── 3. unsupported name dropped ──
{
  const partial = { key_figures: [{ name: 'Dov Rask', role: 'investigator', dates_active: '1966', documented_actions: 'appears nowhere in these sources' }] };
  const { kept, dropped } = verifyExtractedAtoms(partial, PAGES);
  check('3. an item with an unsupported name is dropped', kept.key_figures.length === 0 && dropped.some((d) => d.atom === 'Dov Rask'), JSON.stringify(dropped));
}

// ── 4. unsupported year dropped ──
{
  const partial = { timeline: [{ date: '1999', event: 'a date never mentioned anywhere in the sources' }] };
  const { kept, dropped } = verifyExtractedAtoms(partial, PAGES);
  check('4. an item with an unsupported year is dropped', kept.timeline.length === 0 && dropped.some((d) => d.atom === '1999'), JSON.stringify(dropped));
}

// ── 5. number atom (>= 2 digits) ──
{
  const atoms = extractAtoms({ event: 'the recovery of 42 artifacts from the site', date: '1966' }, 'key_events');
  check('5. a standalone number atom is extracted', atoms.includes('42'), JSON.stringify(atoms));
  const partial = { key_events: [{ event: 'the recovery of 99 artifacts never documented anywhere', date: '1966' }] };
  const { kept, dropped } = verifyExtractedAtoms(partial, PAGES);
  check('5b. an unsupported number drops the item', kept.key_events.length === 0 && dropped.some((d) => d.atom === '99'), JSON.stringify(dropped));
}

// ── 6. UNVERIFIED item still verified (kept on its real, supported atoms) ──
{
  const partial = { key_figures: [{ name: 'Dr. Hale', role: 'investigator', dates_active: 'UNVERIFIED', documented_actions: 'led the dig at Port Ellis' }] };
  const { kept, dropped } = verifyExtractedAtoms(partial, PAGES);
  check('6. UNVERIFIED contributes no atom of its own, item kept on its real atoms', kept.key_figures.length === 1 && dropped.length === 0, JSON.stringify({ kept: kept.key_figures, dropped }));
}

// ── 7. per-batch log (dropped atoms are logged individually) ──
{
  const lines = [];
  const origWarn = console.warn;
  console.warn = (...args) => { lines.push(args.join(' ')); };
  try {
    verifyExtractedAtoms({ key_figures: [{ name: 'Dov Rask', dates_active: '1966', documented_actions: 'x' }] }, PAGES);
  } finally {
    console.warn = origWarn;
  }
  check('7. each drop is logged: [ARCH-2] dropped unsupported atom: <bucket> "<atom>"', lines.some((l) => l.includes('[ARCH-2] dropped unsupported atom: key_figures "Dov Rask"')), JSON.stringify(lines));
}

// ── 8. nothing else in partial mutated ──
{
  const partial = {
    key_figures: [{ name: 'Dr. Hale', role: 'investigator', dates_active: '1966', documented_actions: 'led the dig at Port Ellis' }],
    timeline: [{ date: '1999', event: 'never mentioned anywhere' }],
  };
  const snapshot = JSON.parse(JSON.stringify(partial));
  verifyExtractedAtoms(partial, PAGES);
  check('8. verifyExtractedAtoms does not mutate its input', JSON.stringify(partial) === JSON.stringify(snapshot));
}

// ── 9. empty pages -> everything dropped and logged ──
{
  const partial = { key_figures: [{ name: 'Dr. Hale', role: 'investigator', dates_active: '1966', documented_actions: 'led 42 excavations at Port Ellis' }] };
  const { kept, dropped } = verifyExtractedAtoms(partial, []);
  check('9. empty pages drops everything with a real atom', kept.key_figures.length === 0 && dropped.length > 0, JSON.stringify({ kept: kept.key_figures, dropped }));
}

// ── 10. all seven buckets are checked ──
check('10. ATOM_BUCKETS covers all seven extraction buckets', ATOM_BUCKETS.length === 7 && ['key_figures', 'key_events', 'institutions', 'timeline', 'primary_sources', 'competing_narratives', 'key_documents'].every((b) => ATOM_BUCKETS.includes(b)));

// ── 11-12. source-shape wiring in ProjectStudio.jsx ──
{
  const PS = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');
  check('11. imports verifyExtractedAtoms from researchAtomGuard.js', PS.includes("from '@/lib/researchAtomGuard'") && PS.includes('verifyExtractedAtoms'));
  check('12. called before mergeBucket, with a per-batch summary log', PS.includes('const { kept: verifiedPartial, dropped: droppedAtoms } = verifyExtractedAtoms(partial, batch)') && /\[ARCH-2\] batch \$\{b \+ 1\}: kept \$\{keptCount\} item\(s\), dropped \$\{droppedAtoms\.length\} unsupported atom\(s\)/.test(PS) && PS.indexOf('verifyExtractedAtoms(partial, batch)') < PS.indexOf("mergeBucket('key_figures', verifiedPartial"));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
