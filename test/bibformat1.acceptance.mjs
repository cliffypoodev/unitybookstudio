// BIBFORMAT-1 acceptance battery — the app's own bibliography generators must
// not emit section headings the app's own export gate hard-blocks (finding 52:
// plain heading lines like "Primary Sources and Archival Records" fail the
// BACKMATTER-1 unterminated-paragraph check; markdown `##` headings are exempt
// and ExportTab's DOCX writer renders them as real headings).
// closedWorldBibliography.js, pipelineValidator.js, and bibliographyEntryShape.js
// have no @/-aliased imports and are exercised directly. bibliographyGenerator.js
// is @/-aliased and can only run under the Vite alias loader, so its fallback
// builder is verified via source-shape reads (the way nfexportbib1 checks
// exportSafetyGate.js) plus a replica assembled from the heading literals read
// out of the source. All fixtures are invented — no real book titles or names.
import fs from 'node:fs';
import { buildClosedWorldBibliography } from '../src/lib/closedWorldBibliography.js';
import { checkStructuralIntegrity } from '../src/lib/pipelineValidator.js';
import { countBibliographyEntries } from '../src/lib/bibliographyEntryShape.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── fixture: invented closed-world research (every URL exists in research_data) ──
const researchData = {
  key_documents: [
    { name: 'Municipal Charter of Bellhaven', issuer: 'Bellhaven Town Council', date: '1902', source: 'https://example.org/records/bellhaven-charter' },
  ],
  key_figures: [
    { name: 'Adelia Winslow', sources: 'https://example.org/testimony/winslow-recollections' },
  ],
  key_events: [
    { event: 'The Bellhaven grain exchange fire', date: '1904', sources: 'https://example.org/reports/grain-exchange-fire' },
  ],
  primary_sources: [
    { source_type: 'Oral history collection', description: 'Recorded recollections (1958) of invented Bellhaven residents held by the town historical society' },
  ],
};
const project = { research_data: JSON.stringify(researchData) };
const HEADINGS = [
  '## Primary Sources and Archival Records',
  '## Government, Institutional, and Web Sources',
  '## Source Categories Consulted',
  '## Source Integrity Note',
];

// ── 1-5. closed-world generator output: markdown headings, structurally clean ──
const result = buildClosedWorldBibliography(project);
check('1. closed-world output emits all four section headings as markdown ## lines',
  HEADINGS.every((h) => result.text.split('\n').some((l) => l.trim() === h)),
  result.text.slice(0, 300));
const structural = checkStructuralIntegrity(result.text, 'bibformat1');
check('2. closed-world output passes checkStructuralIntegrity', structural.pass === true, JSON.stringify(structural, null, 2).slice(0, 600));
check('3. closed-world output has zero unterminated paragraphs', structural.unterminatedParagraphs.count === 0,
  JSON.stringify(structural.unterminatedParagraphs.details));
check('4. fixture yields the expected 4 entries (1 document, 1 testimony, 1 event, 1 category)', result.entryCount === 4, `entryCount=${result.entryCount}`);
check('5. countBibliographyEntries equals entryCount — headings are not counted as entries',
  countBibliographyEntries(result.text) === result.entryCount,
  `counted=${countBibliographyEntries(result.text)} entryCount=${result.entryCount}`);

// ── 6. heading lines alone count zero entries ──
check('6. the four ## heading lines alone count 0 entries', countBibliographyEntries(HEADINGS.join('\n\n')) === 0,
  `counted=${countBibliographyEntries(HEADINGS.join('\n\n'))}`);

// ── 7-8. the OLD plain-line heading shape still hard-blocks — the check itself is unchanged ──
{
  const oldShape = [
    'Bibliography',
    'Primary Sources and Archival Records',
    'Bellhaven Town Council. "Municipal Charter of Bellhaven." 1902. https://example.org/records/bellhaven-charter.',
    'Government, Institutional, and Web Sources',
    'example.org. Documentation of an invented event (1904). https://example.org/reports/grain-exchange-fire.',
    'Source Categories Consulted',
    'Oral history collection. Recorded recollections (1958) of invented Bellhaven residents.',
    'Source Integrity Note',
    'Every entry above derives from invented fixture research.',
  ].join('\n\n');
  const s = checkStructuralIntegrity(oldShape, 'bibformat1-old');
  check('7. plain-line headings (the old shape) still FAIL checkStructuralIntegrity', s.pass === false);
  check('8. exactly the four plain headings are unterminated — bare "Bibliography" stays exempt, the exemption was not widened',
    s.unterminatedParagraphs.count === 4, JSON.stringify(s.unterminatedParagraphs));
}

// ── 9-12. source-shape wiring in bibliographyGenerator.js (aliased; cannot run bare) ──
const GEN = fs.readFileSync(new URL('../src/lib/bibliographyGenerator.js', import.meta.url), 'utf8');
check('9. fallback pushes all four section headings with a ## prefix',
  ["sections.push('\\n## Primary Sources and Archival Records')",
   "sections.push('\\n## Newspapers, Magazines, and Contemporary Journalism')",
   "sections.push('\\n## Books and Secondary Sources')",
   "sections.push('\\n## Government, Institutional, and Web Sources')",
  ].every((lit) => GEN.includes(lit)));
check('10. fallback title line and integrity note heading carry the ## prefix',
  GEN.includes('`\\n## Source list for ${title}`') && GEN.includes("'\\n## Source Integrity Note',"));
check('11. no plain-line section-heading push remains in the fallback',
  !/sections\.push\('\\n(?!## )[A-Z]/.test(GEN) && !/sections\.push\(`\\n(?!## )[A-Z]/.test(GEN));
check('12. isBackMatter is untouched (title-based back-matter detection still exported)',
  GEN.includes('export function isBackMatter(ch)'));

// ── 13-14. replica of the fallback layout, using the heading literals read from the source ──
{
  const pushed = [...GEN.matchAll(/sections\.push\('\\n(## [^']+)'\)/g)].map((m) => m[1]);
  const noteHeading = (GEN.match(/'\\n(## Source Integrity Note)',/) || [])[1] || '';
  const titleHeading = (GEN.match(/`\\n(## Source list for) \$\{title\}`/) || [])[1] || '';
  const sampleEntries = [
    'Bellhaven Town Council. "Municipal Charter of Bellhaven." 1902. https://example.org/records/bellhaven-charter.',
    'The Bellhaven Weekly Ledger. "Grain Exchange Fire Contained." 1904. https://example.org/ledger/fire-contained.',
    'Adelia Winslow. A Field Guide to Invented Bellhaven. Harborlight Press, 1961.',
    'Bellhaven Records Bureau. Digitized town registry of invented residents. https://example.org/registry.',
  ];
  const sections = ['Bibliography', `\n${titleHeading} An Invented Field Guide`];
  pushed.forEach((h, i) => { sections.push(`\n${h}`); sections.push(sampleEntries[i] || sampleEntries[0]); });
  const replica = `${sections.join('\n\n')}\n\n${[`\n${noteHeading}`,
    'This bibliography replica was assembled from invented fixture lanes.',
    'Do not publish placeholder citations.'].join('\n\n')}`.replace(/\n{4,}/g, '\n\n\n').trim();
  const s = checkStructuralIntegrity(replica, 'bibformat1-fallback');
  check('13. fallback-layout replica (headings taken from source) has zero unterminated paragraphs and passes',
    pushed.length === 4 && s.pass === true && s.unterminatedParagraphs.count === 0,
    `pushed=${pushed.length} ${JSON.stringify(s.unterminatedParagraphs)}`);
  check('14. countBibliographyEntries on the replica counts the 4 entries, headings excluded',
    countBibliographyEntries(replica) === 4, `counted=${countBibliographyEntries(replica)}`);
}

// ── 15. ExportTab's DOCX writer renders #/## lines as real headings (the format contract) ──
{
  const EXP = fs.readFileSync(new URL('../src/components/publishing/ExportTab.jsx', import.meta.url), 'utf8');
  check('15. ExportTab maps markdown heading lines to HeadingLevel.HEADING_2',
    EXP.includes('/^(#{1,6})\\s+(.+)$/') && EXP.includes('HeadingLevel.HEADING_2'));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
