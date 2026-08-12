// RESEARCHQUALITY-2D acceptance battery — deterministic fate enrichment.
//
// The defect it exists for: 17 of 31 flagship figures carry no fate attestation
// even with the full brief in evidence, so the ARCH-1C fate gate correctly
// forbids the redraft from stating their fates. Enrichment must add fate
// EVIDENCE by copying corpus sentences — never by inventing claims. Every
// fixture here is generic; no book-specific strings.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { figureSurname, splitEnrichSentences, selectFateSentences, formatFateNotes, figuresNeedingFates } from '../src/lib/fateEnrichment.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
const check = (name, pass) => {
  console.log((pass ? 'PASS ' : 'FAIL ') + name);
  if (!pass) failures += 1;
};

const pages = [
  { url: 'https://example.com/a', content: 'The mill opened in 1901. Rescuers later confirmed that Edwin Coats perished beneath the timbers. The docket recorded the report.' },
  { url: 'https://example.com/b', content: 'County records list the harvest totals. Rescuers later confirmed that Edwin Coats perished beneath the timbers. Another line follows here.' },
  { url: 'https://example.com/c', content: 'Ada Pruitt organized the station house that morning and filed the paperwork before noon arrived.' },
];

// 1 — same-sentence surname+fate selection, verbatim copy
const n1 = selectFateSentences({ pages, figureName: 'Edwin Coats' });
check('1. selects the surname+fate sentence', n1.length === 1 && n1[0].sentence.includes('Coats perished'));
check('1. sentence is a verbatim (whitespace-collapsed) copy of source text', pages.some((p) => p.content.replace(/\s+/g, ' ').includes(n1[0].sentence)));
check('1. carries the source page URL', n1[0].url === 'https://example.com/a');

// 2 — cross-page source count: the same sentence on two pages counts 2
check('2. cross-page source count = 2', n1[0].sources === 2);

// 3 — no fate word in any sentence naming the figure -> nothing selected
check('3. figure without fate sentences yields []', selectFateSentences({ pages, figureName: 'Ada Pruitt' }).length === 0);

// 4 — surname required in the SAME sentence, not just the same page
const pages4 = [{ url: 'https://example.com/d', content: 'Edwin Coats managed the yard for a decade. Hundreds perished in the flood that year.' }];
check('4. fate word in a different sentence does not attach to the figure', selectFateSentences({ pages: pages4, figureName: 'Edwin Coats' }).length === 0);

// 5 — dedupe + cap
const many = { url: 'https://example.com/e', content: Array.from({ length: 6 }, (_, i) => `Witness ${i} said Coats drowned near the bend that evening in testimony ${i}.`).join(' ') };
const n5 = selectFateSentences({ pages: [many], figureName: 'Edwin Coats' });
check('5. cap of 3 sentences enforced', n5.length === 3);
const dup = { url: 'https://example.com/f', content: 'Coats drowned near the bend. Coats drowned near the bend.' };
check('5. identical sentences dedupe to one', selectFateSentences({ pages: [dup], figureName: 'Edwin Coats' }).length === 1);

// 6 — title-stripped names resolve to the surname
check('6. titled figure name resolves ("Governor Edwin Coats")', selectFateSentences({ pages, figureName: 'Governor Edwin Coats' }).length === 1);
check('6. figureSurname strips titles', figureSurname('Major General Edwin Coats') === 'Coats');

// 7 — hard-wrapped corpus text (newlines inside the sentence) still matches, output collapsed
const wrapped = { url: 'https://example.com/g', content: 'The clerk finished the ledger.\nRescuers later confirmed that Edwin\nCoats perished beneath the\ntimbers before the crews arrived that night.' };
const n7 = selectFateSentences({ pages: [wrapped], figureName: 'Edwin Coats' });
check('7. hard-wrapped sentence matches and is whitespace-collapsed', n7.length === 1 && !/\n/.test(n7[0].sentence) && n7[0].sentence.includes('Coats perished beneath the timbers'));

// 8 — era vocabulary is part of enrichment; "executed"/"Executive" are not
const era = { url: 'https://example.com/h', content: 'Newspapers reported that Coats was assassinated outside the courthouse that spring. The clerk executed the order of the Executive without delay near Coats.' };
const n8 = selectFateSentences({ pages: [era], figureName: 'Edwin Coats' });
check('8. era word (assassinated) is selectable evidence', n8.length === 1 && n8[0].sentence.includes('assassinated'));
check('8. "executed"/"Executive" alone select nothing', selectFateSentences({ pages: [{ url: 'x', content: 'The clerk executed the order of the Executive without delay near Coats and filed it.' }], figureName: 'Edwin Coats' }).length === 0);

// 9 — formatFateNotes carries sentence, URL, and visible source count
const fmt = formatFateNotes(n1);
check('9. formatted note carries quote + URL + source count', fmt.includes('"Rescuers later confirmed') && fmt.includes('[https://example.com/a]') && fmt.includes('(sources: 2)'));
check('9. empty notes format to empty string', formatFateNotes([]) === '');

// 10 — figuresNeedingFates: own-entry semantics, JSON-string tolerant
const rd = JSON.stringify({ key_figures: [
  { name: 'Edwin Coats', documented_actions: 'Managed the yard.' },
  { name: 'Nora Voss', documented_actions: 'Nora Voss was killed when the wall came down.' },
  { name: 'Ada Pruitt', documented_actions: 'Filed the paperwork.', fate_notes: '"Pruitt survived the flood." [https://example.com/c] (sources: 1)' },
] });
const need = figuresNeedingFates(rd);
check('10. figure without fate evidence is listed', need.includes('Edwin Coats'));
check('10. own-entry fate word excludes a figure', !need.includes('Nora Voss'));
check('10. existing fate_notes excludes a figure', !need.includes('Ada Pruitt'));
check('10. corrupt JSON yields [] (fail-open)', figuresNeedingFates('{not json').length === 0);

// 11 — sentence splitter keeps the v-dot protection
check('11. v-dot protection in enrichment splitter', splitEnrichSentences('The case of Dorr v. United States settled it. Coats drowned near the bend.').length === 2);

// 12 — wiring
const ps = fs.readFileSync(path.join(ROOT, 'src/pages/ProjectStudio.jsx'), 'utf8');
check('12. research pipeline runs the enrichment pass over fetched pages', ps.includes('selectFateSentences({ pages: richPages, figureName: fig.name })'));
check('12. existing fate_notes are never overwritten', ps.includes('if (!fig || fig.fate_notes) continue;'));
check('12. targeted fate research handler exists and appends', ps.includes('const handleFateResearch = async () => {') && ps.includes('figuresNeedingFates(project.research_data)'));
check('12. both FoundationTab call sites pass onFateResearch', (ps.match(/onFateResearch=\{handleFateResearch\}/g) || []).length === 2);
const ft = fs.readFileSync(path.join(ROOT, 'src/components/notebook/FoundationTab.jsx'), 'utf8');
check('12. FoundationTab forwards onFateResearch', ft.includes('onFateResearch={onFateResearch}'));
const rsx = fs.readFileSync(path.join(ROOT, 'src/components/notebook/ResearchSection.jsx'), 'utf8');
check('12. ResearchSection renders the fate research button', rsx.includes('onClick={onFateResearch}') && rsx.includes('Research Figure Fates'));

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
