// WAVE4 acceptance battery — offload-aware reads + spinner lock + cover wiring.
//
//   WAVE4-OFFLOADREAD   StudioOverview/StoryBibleReport see offloaded bibles + real target field
//   WAVE4-HOMEDASH      spinner can't lock; chapter bodies not re-downloaded per refetch
//   WAVE4-OFFLOADWRITE  SeriesSection routes foundation writes through the offload layer
//   WAVE4-BARCODE       real EAN-13 lands on the wrap and in the export
//   WAVE4-COVERWIRING   TemplatesPicker is a real picker; logo uploader gets its project prop
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

// ── WAVE4-OFFLOADREAD ────────────────────────────────────────────────────────
const so = read('src/components/novel/StudioOverview.jsx');
check('1. StudioOverview reads total_word_target (target_word_count is gone)',
  /total_word_target/.test(so) && !/target_word_count/.test(so));
check('1b. StudioOverview word count uses the Wave-2 rollup with chapter fallback',
  /project\?\.total_word_count/.test(so));
check('1c. StudioOverview counts offloaded (*_url) foundation docs as done',
  /\$\{field\}_url/.test(so));

const sbr = read('src/components/notebook/StoryBibleReport.jsx');
check('2. StoryBibleReport resolves foundation fields through the offload layer',
  /resolveAllFoundationFields/.test(sbr) && /resolvedBible\.world_md \|\| project\.world_md/.test(sbr));
check('2b. StoryBibleReport resolves the seed concept too',
  /resolveSeedConcept/.test(sbr));

// ── WAVE4-HOMEDASH ───────────────────────────────────────────────────────────
const hd = read('src/components/novel/HomeDashboard.jsx');
check('3. every early return clears the loading spinner',
  (() => {
    const effect = hd.slice(hd.indexOf('async function loadDashboard'), hd.indexOf('loadDashboard();'));
    const earlyReturns = effect.split('setStats(null);').length - 1;
    const clears = effect.split('setLoading(false);').length - 1;
    return earlyReturns >= 1 && clears >= earlyReturns;
  })());
check('3b. effect depends on a content signature, not array identity',
  /draftedSignature/.test(hd) && /\[project\?\.id, draftedSignature\]/.test(hd) &&
  !/\}, \[project\?\.id, safeChapters\]\)/.test(hd));

// ── WAVE4-OFFLOADWRITE ───────────────────────────────────────────────────────
const ss = read('src/components/notebook/SeriesSection.jsx');
check('4. SeriesSection routes its foundation write through prepareFoundationPayload',
  /prepareFoundationPayload\(seriesUpdate, project\.id\)/.test(ss) &&
  /NovelProject\.update\(project\.id, safeSeriesUpdate\)/.test(ss));

// ── WAVE4-BARCODE ────────────────────────────────────────────────────────────
const fwc = read('src/components/cover/FullWrapComposite.jsx');
check('5. the generated EAN-13 is captured, not discarded',
  /setBarcodeDataUrl\(dataUrl\)/.test(fwc) &&
  !/uses the fixed barcode placeholder for export/.test(fwc));
check('5b. the export draws the real barcode when present (placeholder only as fallback)',
  /await drawImageStretch\(\s*ctx,\s*barcodeDataUrl/.test(fwc) && /BARCODE \/ ISBN/.test(fwc));
check('5c. the on-screen wrap shows the real barcode image when present',
  /<img src=\{barcodeDataUrl\}/.test(fwc));
check('5d. exportAsCanvas re-renders when the barcode changes (dependency present)',
  /barcodeDataUrl,\s*\n\s*dims,/.test(fwc));

// ── WAVE4-COVERWIRING ────────────────────────────────────────────────────────
const tp = read('src/components/cover/TemplatesPicker.jsx');
check('6. TemplatesPicker is a real picker again (lists TEMPLATES, calls onApply)',
  /export default function TemplatesPicker\(\{ onApply \}\)/.test(tp) &&
  /TEMPLATES\.map/.test(tp) && !/PublisherLogoUpload/.test(tp.replace(/\/\*[\s\S]*?\*\//g, '')));
const plu = read('src/components/cover/PublisherLogoUpload.jsx');
check('6b. PublisherLogoUpload.jsx holds the real uploader (stub is gone)',
  /publisher_logo_url/.test(plu) && !/return null;\s*}\s*$/.test(plu.trim()));
const fe = read('src/components/cover/FabricEditor.jsx');
// WAVE11 note: this pinned the exact single-line JSX. WAVE11-LOGO added an
// onLogoChange handler, so the element is now multi-line — the assertion tested
// the formatting, not the contract. Rewritten to check what it meant: that the
// uploader is rendered and receives `project`.
check('6c. FabricEditor renders BOTH, and the uploader finally gets project',
  /<TemplatesPicker onApply=\{handleApplyTemplate\} \/>/.test(fe) &&
  /<PublisherLogoUpload[\s\S]{0,200}?project=\{project\}/.test(fe));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
