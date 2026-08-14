// WAVE10 acceptance battery — the print maths that decides whether KDP takes the file.
//
//   WAVE10-SPINEMATH    spine = pages x caliper, and the calipers are Amazon's
//   WAVE10-SPINETEXT    the 100-page spine-text rule is enforced, not just computed
//   WAVE10-SAFEMARGIN   text-safe is 0.25in inside the TRIM, not the bleed edge
//   WAVE10-PRESETMATH   export presets agree with their own descriptions
//
// Everything here is executed. The reference values are derived from Amazon's
// published figures inside this file rather than read back out of the module —
// a test that imports the constant it is checking proves nothing.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KDP_SPECS, calculateCoverDimensions, estimatePageCount } from '../src/lib/kdpCover.js';
import { calculateSafeMargins, SAFE_MARGINS } from '../src/lib/coverTypographyComposer.js';
import { COVER_EXPORT_PRESETS, getCoverExportDimensions } from '../src/lib/coverExport.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

/* ── WAVE10-SPINEMATH ────────────────────────────────────────────────────── */
// Amazon KDP paperback calipers, in inches per page.
const KDP_CALIPER = { white: 0.002252, cream: 0.0025, color: 0.002347 };
const KDP_BLEED = 0.125;

check('1. the three paper calipers match Amazon exactly',
  near(KDP_SPECS.paper.white, KDP_CALIPER.white) &&
  near(KDP_SPECS.paper.cream, KDP_CALIPER.cream) &&
  near(KDP_SPECS.paper.color, KDP_CALIPER.color));

check('1b. the colour caliper is no longer the old 0.0032 (a 36% error)',
  !near(KDP_SPECS.paper.color, 0.0032));

check('1c. no additive cover-thickness term survives anywhere',
  KDP_SPECS.coverThickness === undefined &&
  !/coverThickness/.test(read('src/lib/kdpCover.js')));

// spine = pages x caliper. Nothing else.
const SPINE_CASES = [
  [300, 'cream'], [250, 'white'], [300, 'color'],
  [600, 'cream'], [120, 'white'], [24, 'cream'], [828, 'white'],
];
check('2. spine width is exactly pages x caliper for every paper and length',
  SPINE_CASES.every(([pages, paper]) =>
    near(calculateCoverDimensions(6, 9, pages, paper).spineWidth, pages * KDP_CALIPER[paper])));

// Full wrap = bleed + trim + spine + trim + bleed.
const WRAP_CASES = [
  [6, 9, 300, 'cream'], [5.5, 8.5, 250, 'white'], [8.5, 11, 600, 'cream'],
  [5, 8, 120, 'white'], [6, 9, 300, 'color'],
];
check('2b. the full wrap is bleed + trim + spine + trim + bleed',
  WRAP_CASES.every(([w, h, pages, paper]) => {
    const d = calculateCoverDimensions(w, h, pages, paper);
    return near(d.totalWidth, KDP_BLEED + w + pages * KDP_CALIPER[paper] + w + KDP_BLEED) &&
      near(d.totalHeight, KDP_BLEED + h + KDP_BLEED);
  }));

// The regression that prompted this wave, stated as the exact figure.
const sixByNine = calculateCoverDimensions(6, 9, 300, 'cream');
check('2c. a 6x9 300pp cream book is 0.750" spine / 13.000" wrap (was 0.810 / 13.060)',
  near(sixByNine.spineWidth, 0.75) && near(sixByNine.totalWidth, 13));

const colour300 = calculateCoverDimensions(6, 9, 300, 'color');
check('2d. the same book on colour stock is 0.7041" (was 0.9600" — 0.316" too wide)',
  near(colour300.spineWidth, 0.7041) && !near(colour300.spineWidth, 0.96));

check('2e. the pixel canvas follows the inches at 300 DPI',
  sixByNine.pxW === Math.round(13 * 300) && sixByNine.pxH === Math.round(9.25 * 300));

check('2f. the back/spine/front zones still tile the wrap with no gap or overlap',
  (() => {
    const z = sixByNine.zones;
    return z.backLeft === sixByNine.pxBleed &&
      z.backRight === z.spineLeft &&
      z.spineRight === z.frontLeft &&
      z.frontRight === sixByNine.pxW - sixByNine.pxBleed;
  })());

/* ── WAVE10-SPINETEXT ────────────────────────────────────────────────────── */
check('3. the spine-text threshold is Amazon\'s 100 pages, not 79',
  KDP_SPECS.minSpineTextPages === 100);
check('3b. the gate answers correctly either side of the boundary',
  calculateCoverDimensions(6, 9, 99, 'cream').canSpineText === false &&
  calculateCoverDimensions(6, 9, 100, 'cream').canSpineText === true &&
  calculateCoverDimensions(6, 9, 24, 'cream').canSpineText === false);

const wrap = read('src/components/cover/FullWrapComposite.jsx');
check('3c. canSpineText is finally consumed — the button is disabled below the limit',
  /disabled=\{!dims\.canSpineText\}/.test(wrap));
check('3d. and the action itself refuses, not just the button',
  /if \(!dims\.canSpineText\) \{/.test(wrap) &&
  /KDP will not print spine text below/.test(wrap));

/* ── WAVE10-SAFEMARGIN ───────────────────────────────────────────────────── */
check('4. the two margins are still declared as 0.125 bleed / 0.25 text-safe',
  near(SAFE_MARGINS.trimInches, 0.125) && near(SAFE_MARGINS.textSafeInches, 0.25));

const margins = calculateSafeMargins(1875, 2775, 300);
check('4b. text-safe is measured 0.25" inside the TRIM line, not the bleed edge',
  near((margins.safeRect.x - margins.trimPx) / 300, 0.25, 0.005));
check('4c. which puts it 0.375" from the canvas edge, not the old 0.25"',
  near(margins.safeRect.x / 300, 0.375, 0.005) && margins.safeRect.x !== margins.textSafePx);
check('4d. the safe rect stays centred and shrinks by twice the inset',
  margins.safeRect.width === 1875 - 2 * margins.safeRect.x &&
  margins.safeRect.height === 2775 - 2 * margins.safeRect.y);
check('4e. the inset is exposed so callers need not recompute it',
  margins.safeInsetPx === margins.trimPx + margins.textSafePx);

/* ── WAVE10-PRESETMATH ───────────────────────────────────────────────────── */
// Any preset that claims a bleed in its description must actually do that sum.
const claimed = Object.entries(COVER_EXPORT_PRESETS)
  .map(([key, p]) => {
    const m = /^(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)" at 300 DPI with 0\.125" bleed/.exec(p.description || '');
    return m ? { key, p, w: Math.round((+m[1] + 0.25) * 300), h: Math.round((+m[2] + 0.25) * 300) } : null;
  })
  .filter(Boolean);

check('5. every preset that claims a bleed actually computes one',
  claimed.length >= 2 && claimed.every(({ p, w, h }) => p.width === w && p.height === h));
check('5b. specifically 6x9 is 1875 wide (was 1890) and 5x8 is 1575x2475 (was 1563x2500)',
  COVER_EXPORT_PRESETS.paperback_6x9.width === 1875 &&
  COVER_EXPORT_PRESETS.paperback_5x8.width === 1575 &&
  COVER_EXPORT_PRESETS.paperback_5x8.height === 2475);
check('5c. the eBook preset is left alone — no bleed on a digital cover',
  COVER_EXPORT_PRESETS.ebook.width === 1600 && COVER_EXPORT_PRESETS.ebook.height === 2560);
check('6. the custom preset never returns null dimensions',
  (() => {
    const d = getCoverExportDimensions('custom');
    return Number.isFinite(d.width) && Number.isFinite(d.height) && d.usedFallback === true;
  })());
check('6b. and still honours dimensions when they are supplied',
  (() => {
    const d = getCoverExportDimensions('custom', { width: 1200, height: 1800 });
    return d.width === 1200 && d.height === 1800 && !d.usedFallback;
  })());

/* ── unchanged behaviour that must stay unchanged ────────────────────────── */
check('7. estimatePageCount still floors at KDP\'s 24-page minimum',
  estimatePageCount(0) >= 24 && estimatePageCount(100) >= 24);
check('7b. all ten trim sizes are still offered',
  KDP_SPECS.trimSizes.length === 10 &&
  KDP_SPECS.trimSizes.some((t) => t.w === 6 && t.h === 9));
check('7c. bleed and DPI were correct and are untouched',
  near(KDP_SPECS.bleed, 0.125) && KDP_SPECS.dpi === 300);
check('7d. the spine calculator reads the calipers instead of duplicating them',
  /import \{ KDP_SPECS \} from '@\/lib\/kdpCover'/.test(read('src/components/cover/SpineCalculator.jsx')) &&
  !/color: 0\.0032/.test(read('src/components/cover/SpineCalculator.jsx')));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
