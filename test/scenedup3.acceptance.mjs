// SCENEDUP-3 acceptance battery — the live scene-duplicate sweep becomes a
// library module (finding 67): src/lib/sceneDuplicateSweep.js is now the
// live implementation (moved verbatim from the ProjectStudio.jsx inline
// fork, ORCH-1 discipline: import/export lines only, no logic change), the
// page imports it, and scripts/ubs-run.mjs's polish command injects it so
// headless polish gets parity with in-app polish.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runSceneDuplicateSweep, applyStrandedAlternateDraftQuarantine } from '../src/lib/sceneDuplicateSweep.js';
import { runPolishCommand } from '../scripts/ubs-run.mjs';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STUDIO_PATH = path.join(ROOT, 'src/pages/ProjectStudio.jsx');
const LIB_PATH = path.join(ROOT, 'src/lib/sceneDuplicateSweep.js');
const RUNNER_PATH = path.join(ROOT, 'scripts/ubs-run.mjs');
const POLISH_RUNNER_PATH = path.join(ROOT, 'src/lib/manuscriptPolishRunner.js');
const studioSrc = fs.readFileSync(STUDIO_PATH, 'utf8');
const libSrc = fs.readFileSync(LIB_PATH, 'utf8');
const runnerSrc = fs.readFileSync(RUNNER_PATH, 'utf8');
const polishRunnerSrc = fs.readFileSync(POLISH_RUNNER_PATH, 'utf8');

// ── 1. the page no longer defines runSceneDuplicateSweep; it imports the
//      library instead ──
check('1. ProjectStudio.jsx no longer defines runSceneDuplicateSweep locally',
  !/const\s+runSceneDuplicateSweep\s*=/.test(studioSrc) && !/\bfunction\s+runSceneDuplicateSweep\s*\(/.test(studioSrc));
check('1b. ProjectStudio.jsx imports runSceneDuplicateSweep from @/lib/sceneDuplicateSweep',
  /import\s*\{\s*runSceneDuplicateSweep\s*\}\s*from\s*['"]@\/lib\/sceneDuplicateSweep['"]/.test(studioSrc));

// ── 2. the library exports both functions ──
check('2. src/lib/sceneDuplicateSweep.js exports runSceneDuplicateSweep as a function', typeof runSceneDuplicateSweep === 'function');
check('2b. src/lib/sceneDuplicateSweep.js exports applyStrandedAlternateDraftQuarantine as a function', typeof applyStrandedAlternateDraftQuarantine === 'function');
check('2c. the library no longer carries the WAVE5 dead-stamp header', !/WAVE5-DEADSTAMP/.test(libSrc));

// ── 3. normalized-diff proof: inverse-transforming the current library body
//      reproduces the b66adaf3 ProjectStudio.jsx inline-fork body
//      byte-for-byte (hash-checked, not re-typed) — MOVE, not rewrite. ──
const BASELINE_BODY_SHA256 = '54370f7ce2ce1c3f4a174e33640ccfe73739c4c02508134f34028700cd058a86';
const BASELINE_BODY_LENGTH = 39637;

function extractLibBody(src) {
  const jsdocStart = src.indexOf('/**\n * Scene Duplicate / Alternate Draft Sweep v2');
  const attachLine = 'runSceneDuplicateSweep.applyStrandedAlternateDraftQuarantine = applyStrandedAlternateDraftQuarantine;';
  const attachIdx = src.indexOf(attachLine);
  if (jsdocStart === -1 || attachIdx === -1) return null;
  return src.slice(jsdocStart, attachIdx + attachLine.length);
}

function inverseTransformToOriginal(text) {
  let out = text;
  // (a) the one necessitated-by-the-move fix: the IIFE body closed over the
  // page's own top-level structureUtils import; the library needs its own.
  out = out.replace("import { countParagraphs, countRangeRemovals, sumQuarantineRemovals } from './structureUtils.js';\n", '');
  // (b) the two export-line additions that turn the IIFE's inner functions
  // into the module's named exports.
  out = out.replace("export function applyStrandedAlternateDraftQuarantine(text = '') {", "function applyStrandedAlternateDraftQuarantine(text = '') {");
  out = out.replace("export function runSceneDuplicateSweep(loaded, onProgress = null, rawOptions = {}) {", "function runSceneDuplicateSweep(loaded, onProgress = null, rawOptions = {}) {");
  return out;
}

{
  const currentBody = extractLibBody(libSrc);
  check('3. sweep body extracted from src/lib/sceneDuplicateSweep.js', typeof currentBody === 'string' && currentBody.length > 0);
  const reconstructed = currentBody ? inverseTransformToOriginal(currentBody) : '';
  const reconstructedHash = crypto.createHash('sha256').update(reconstructed).digest('hex');
  check('3b. inverse-transformed body length matches the b66adaf3 baseline', reconstructed.length === BASELINE_BODY_LENGTH,
    `got ${reconstructed.length}, want ${BASELINE_BODY_LENGTH}`);
  check('3c. inverse-transformed body sha256 matches the b66adaf3 baseline (empty normalized diff)',
    reconstructedHash === BASELINE_BODY_SHA256, `got ${reconstructedHash}`);
}

// ── 4. a fixture with a duplicated scene block gets the same
//      { blocksRemoved, wordsRemoved, reportedOnly, skippedUnsafe } from the
//      library as the page produced at b66adaf3 — same code (proven in 3c
//      above), so the current module's output on this fixture IS that
//      value; embedded here so a future regression is caught even without
//      re-deriving it. Fixture uses invented generic names (Mara/Dov/Ilse,
//      matching test/orch1.acceptance.mjs and test/scenedup1.acceptance.mjs). ──
const FIXTURE_PARAGRAPHS = [
  "Mara stood at the edge of the rooftop that morning, watching the city wake up slowly below her in the grey light, thinking about everything that had happened since they arrived.",
  "Mara sprinted down the narrow alley, breath ragged, boots slapping against wet stone as the guards' shouts echoed behind her in the dark rain-soaked night air. She could hear their pursuit gaining fast, boots pounding the same street she had just crossed only moments before, and she knew the window of escape was closing quickly now.",
  "Dov waited by the fire escape at the back of the crumbling building, waving her toward the rusted stairs bolted loosely to the brick wall above the alley. Two guards rounded the corner behind them, batons drawn, shouting for them to stop running immediately or face the harsh consequences of resisting arrest tonight in the district.",
  "Ilse had already climbed halfway up when Mara finally reached the stairs, her hands slick with cold sweat against the rusted metal railing beneath her trembling fingers. The alley behind them filled with the sound of running boots, and somewhere above a window slammed shut hard against the noise of the chase outside the walls.",
  "They reached the flat rooftop just as the first guard emerged into the alley below them, and Dov pulled the heavy fire door shut behind them tight. He wedged a broken length of pipe through the door handle to slow the guards down, and every single one of them knew it would not hold for long.",
  "Later that night, the three of them sat together in a quiet kitchen sharing a pot of tea and saying almost nothing at all to each other.",
  "Ilse mentioned she still had family across town somewhere, and Mara wondered aloud whether any of them would ever go back home again someday.",
  "Mara sprinted down the narrow alley, breath ragged, boots slapping against wet stone as the guards' shouts echoed behind her in the dark rain-soaked night air. She could hear their pursuit gaining fast, boots pounding the same street she had just crossed only moments before, and she knew the window of escape was closing quickly now.",
  "Dov waited by the fire escape at the back of the crumbling building, waving her toward the rusted stairs bolted loosely to the brick wall above the alley. Two guards rounded the corner behind them, batons drawn, shouting for them to stop running immediately or face the harsh consequences of resisting arrest tonight in the district.",
  "Ilse had already climbed halfway up when Mara finally reached the stairs, her hands slick with cold sweat against the rusted metal railing beneath her trembling fingers. The alley behind them filled with the sound of running boots, and somewhere above a window slammed shut hard against the noise of the chase outside the walls.",
  "They reached the flat rooftop just as the first guard emerged into the alley below them, and Dov pulled the heavy fire door shut behind them tight. He wedged a broken length of pipe through the door handle to slow the guards down, and every single one of them knew it would not hold for long.",
  "Morning came grey and quiet over the harbor, and none of them spoke of the alley or the guards again for the rest of that week.",
  "By the following spring the whole district had changed hands twice over, and none of the three of them ever went back to that block.",
  "Dov kept the broken pipe as a small memento for years afterward, though he never once explained to anyone why it mattered so much to him."
];
const EXPECTED_FIXTURE_REPORT = { blocksRemoved: 1, wordsRemoved: 249, reportedOnly: 0, skippedUnsafe: 0 };

{
  const content = FIXTURE_PARAGRAPHS.join('\n\n');
  const loaded = [{ chapter: { chapter_number: 1, id: 'ch-1', title: 'Rooftop' }, content, original: content }];
  // maxRemovalRatioPerChapter relaxed from the 0.10 default so a short
  // battery fixture (not a 2000+-word chapter) can clear the 10% cap —
  // legitimate use of the function's own options parameter, not a change to
  // its logic or defaults.
  const report = runSceneDuplicateSweep(loaded, null, { maxRemovalRatioPerChapter: 0.5 });
  const actual = { blocksRemoved: report.blocksRemoved, wordsRemoved: report.wordsRemoved, reportedOnly: report.reportedOnly, skippedUnsafe: report.skippedUnsafe };
  check('4. fixture duplicate-scene report matches the embedded b66adaf3-parity object',
    JSON.stringify(actual) === JSON.stringify(EXPECTED_FIXTURE_REPORT), `got ${JSON.stringify(actual)}`);
  const sceneAOccurrences = loaded[0].content.split(FIXTURE_PARAGRAPHS[1]).length - 1;
  check('4b. the duplicated scene block is actually gone from the saved content',
    sceneAOccurrences === 1, `scene paragraph now appears ${sceneAOccurrences} time(s), want 1`);
}

// ── 5. scripts/ubs-run.mjs polish injects the live sweep, same as the page ──
check('5. ubs-run.mjs wires sceneDuplicateSweep into the pipeline call options (source-shape)',
  /sceneDuplicateSweep,\s*\n\s*\}\)/.test(runnerSrc) || /mode,\s*sceneDuplicateSweep\s*\}/.test(runnerSrc));
check('5b. ubs-run.mjs dynamically imports the live library module (source-shape)',
  /await import\(['"]\.\.\/src\/lib\/sceneDuplicateSweep\.js['"]\)/.test(runnerSrc));

{
  const capturedOptions = [];
  const mockPipeline = async (options) => { capturedOptions.push(options); return { changes: [] }; };
  const fakeStore = {
    NovelProject: { get: async () => ({ id: 'proj-1' }) },
    Chapter: {
      filter: async () => [{ id: 'c1', chapter_number: 1, content_md: 'Some unpolished chapter text.' }],
      update: async () => {},
    },
  };
  const result = await runPolishCommand({ projectId: 'proj-1', store: fakeStore, runPipeline: mockPipeline, mode: 'fiction' });
  check('5c. runPolishCommand completes with a mocked pipeline', result && Array.isArray(result.changes));
  check('5d. the mocked pipeline call received a sceneDuplicateSweep function', typeof capturedOptions[0]?.sceneDuplicateSweep === 'function');
  check('5e. it is the library\'s own runSceneDuplicateSweep, not a stand-in', capturedOptions[0]?.sceneDuplicateSweep === runSceneDuplicateSweep);
}

// ── 6. nonfiction still skips the sweep — the pre-existing mode gate in
//      manuscriptPolishRunner.js is untouched by this ticket (its own
//      mode==='nonfiction' string test is a pre-existing POLISHSAFE-6-class
//      item, named here per the ticket's own instruction, not fixed here) ──
check('6. manuscriptPolishRunner.js still gates the sweep on mode !== \'nonfiction\' (untouched)',
  polishRunnerSrc.includes("mode !== 'nonfiction' && sceneDuplicateSweep"));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
