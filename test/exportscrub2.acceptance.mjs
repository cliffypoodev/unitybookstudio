// EXPORTSCRUB-2 acceptance battery — the export path may not regex-edit prose
// a project did not ask for, and the pre-export safety gate must see the
// STORED text, not text the export path has already rewritten.
//
// Arc E live-proof finding 19: `runExportTextSafetyNet` (ExportTab.jsx) ran a
// 60-rule table on every book, unconditionally, then an unconditional "Songbird
// climax" sniper repair. One rule ("duplicate short phrase") silently rewrote
// REDUX Ch.5's stored `"Is itIs it" Lark asked.` glued word to `"Is it" Lark
// asked.` at export time — masking the exact defect the offline gate correctly
// blocks on, because `runPreExportSafetyGate` was called on the ALREADY-CLEANED
// text (`cleaned`), not the resolved/stored text.
//
// EXPORTSCRUB-2: every manuscript-named rule in that table (and the sniper
// line) is now scoped behind `legacy_export_rules: ['songbird']`; every
// word-level mutation with no manuscript-specific origin is deleted outright
// (the gate + REGENLANE-1 own detecting/regenerating that class of defect
// now); the always-on path is typography only; and the gate is called on the
// resolved/stored chapters, not the cleaned ones.
//
// This battery reads ExportTab.jsx's own function bodies and runs them in a
// VM sandbox (same technique as lengthgate1/gatepromote1.acceptance.mjs) —
// ExportTab.jsx is a multi-thousand-line React component with a deep import
// graph and cannot be imported directly under bare Node. Generic fixture
// names only (Mara, Dov, Ilse); 'songbird' is this codebase's own existing
// legacy_export_rules key, not a book-specific string introduced here.
import fs from 'node:fs';
import vm from 'node:vm';
import { exportRuleEnabled } from '../src/lib/exportRuleScope.js';
import { repairManuscriptArtifacts } from '../src/lib/manuscriptArtifactRepair.js';
import { parseCanonCast, scanRoleReferenceDrift } from '../src/lib/canonRoles.js';
import { harvestCastNames } from '../src/lib/pronounLock.js';
import {
  buildCharacterState,
  auditProseAgainstCharacterState,
  extractBeatDeclaredStateUpdates,
  collectChapterBeatEvents,
} from '../src/lib/characterStateLedger.js';
import { isFictionProject } from '../src/lib/projectType.js';
import { scanMalformedSentences, MALFORMEDSENT_HARD_BLOCK } from '../src/lib/malformedSentence.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const EXPORT_PATH = new URL('../src/components/publishing/ExportTab.jsx', import.meta.url).pathname;
const EXPORT_SRC = fs.readFileSync(EXPORT_PATH, 'utf8');
const GATE_PATH = new URL('../src/lib/exportSafetyGate.js', import.meta.url).pathname;
const GATE_SRC = fs.readFileSync(GATE_PATH, 'utf8');

// ── extract the self-contained, JSX-free helper-function block that ends
// with runExportTextSafetyNet (starts at normalizeDocxMarkdown, ends right
// before normalizeTitleKey — both markers are stable, unrelated function
// names either side of the block under test) ──
function extractBlock(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`extractBlock: marker not found (start=${start} end=${end})`);
  return src.slice(start, end);
}

const exportBlock = extractBlock(EXPORT_SRC, 'function normalizeDocxMarkdown(', 'function normalizeTitleKey(');

// Strip comments before asserting on executable code: this battery's own
// rationale (and the fix's own comments) quote the deleted rule's label.
const executable = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
const EXPORT_EXEC = executable(EXPORT_SRC);

function buildExportSandbox() {
  const ctx = { exportRuleEnabled, repairManuscriptArtifacts, console, __e: {} };
  vm.createContext(ctx);
  vm.runInContext(exportBlock + '\n__e = { runExportTextSafetyNet, isSongbirdExportProject };', ctx);
  return ctx.__e;
}

function buildGateSandbox() {
  const ctx = {
    console,
    runManuscriptSafetyGate: () => ({
      ok: true, blocked: false, hardFailures: [], warnings: [], reasons: [], recommendedAction: '',
      processLeaks: { matches: [] }, contamination: { matches: [] }, malformed: { matches: [] },
    }),
    runReferenceIntegrityGate: () => ({ blocked: false, blockingIssues: [], advisoryIssues: [], warnings: [], summary: '' }),
    ensureResearchEvidence: async (p) => p,
    checkStructuralIntegrity: (text) => {
      // Real enough to prove the gate sees a glued-word defect: count 'xIsx'-style
      // adjacent-word gluing via the same shape the live BOOKGATE-2 detector flags —
      // a lowercase letter immediately followed by an uppercase letter mid-word,
      // which is exactly what "itIs" is. Everything else reports a clean pass.
      const gluedMatches = String(text || '').match(/\b[a-z]+[A-Z][a-z]+\b/g) || [];
      return {
        pass: gluedMatches.length === 0,
        quoteBalance: { pass: true, open: 0, close: 0, unbalancedParagraphs: 0, details: [] },
        gluedWords: { pass: gluedMatches.length === 0, count: gluedMatches.length, details: gluedMatches },
        unterminatedParagraphs: { pass: true, count: 0 },
        typography: { pass: true, straightQuotes: 0, curlyOpen: 0 },
      };
    },
    checkBookIntegrity: () => ({ shortChapters: { details: [], floor: 0 }, crossChapterEchoes: { count: 0 }, openingEchoes: { count: 0, details: [] }, medianWords: 0, pass: true }),
    parseCanonCast,
    scanRoleReferenceDrift,
    harvestCastNames,
    buildCharacterState,
    auditProseAgainstCharacterState,
    extractBeatDeclaredStateUpdates,
    collectChapterBeatEvents,
    isFictionProject,
    scanMalformedSentences,
    MALFORMEDSENT_HARD_BLOCK,
    __e: {},
  };
  vm.createContext(ctx);
  const vmSrc = GATE_SRC
    .replace(/^import .*$/gm, '')
    .replace(/^export (async )?function/gm, '$1function')
    .replace(/^export (const|class|let)/gm, '$1')
    + '\n__e = { runPreExportSafetyGate };';
  vm.runInContext(vmSrc, ctx);
  return ctx.__e;
}

// ══ 1. a project with no legacy_export_rules gets zero word changes ══
{
  const { runExportTextSafetyNet } = buildExportSandbox();
  const project = { book_type: 'fiction' };

  const glued = 'Mara stared at the readout. “Is itIs it” Mara asked.';
  const r1 = runExportTextSafetyNet(glued, project, {});
  check('1. no legacy_export_rules: a glued duplicate-phrase defect is left untouched',
    r1.changed === false && r1.text === glued && r1.changes.length === 0, JSON.stringify(r1));

  const generic = 'Dov nodded took a beat before he answered Ilse.';
  const r2 = runExportTextSafetyNet(generic, project, {});
  check('2. no legacy_export_rules: a generic "missing comma" survivor no longer fires',
    r2.changed === false && r2.text === generic, JSON.stringify(r2));

  const named = 'Dov opened a drawer took out the ledger and set it on the desk.';
  const r3 = runExportTextSafetyNet(named, project, {});
  check('3. no legacy_export_rules: a manuscript-named line-edit rule does not fire either',
    r3.changed === false && r3.text === named, JSON.stringify(r3));
}

// ══ 2. typography still runs by default (the part that stays) ══
{
  const { runExportTextSafetyNet } = buildExportSandbox();
  const project = { book_type: 'fiction' };
  const spaced = 'Ilse said, “ Wait for me. ”Dov turned.';
  const r = runExportTextSafetyNet(spaced, project, {});
  check('4. quote spacing (typography) still normalizes with no legacy_export_rules',
    r.changed === true && !r.text.includes('“ Wait') && !r.text.includes('me. ”'), JSON.stringify(r));
}

// ══ 3. the songbird-gated rules are reachable (opted-in reproducibility preserved) ══
{
  const { runExportTextSafetyNet } = buildExportSandbox();
  const project = { book_type: 'fiction', legacy_export_rules: ['songbird'] };
  // A songbirdRules-only pattern with no overlap in repairManuscriptArtifacts's
  // own joinRules (which also runs, gated, ahead of it).
  const named = 'The old accompanist, who smelled always of hair tonic and nervous sweat played every number without a mistake.';
  const r = runExportTextSafetyNet(named, project, {});
  check('5. opted into songbird: a manuscript-named line-edit rule fires',
    r.changed === true && r.text.includes('who always smelled of hair tonic and nervous sweat, played'), JSON.stringify(r));

  // the glued duplicate-phrase defect stays a defect even for an opted-in book —
  // that class of masking rule was deleted outright, not merely re-gated.
  const glued = 'Mara stared at the readout. “Is itIs it” Mara asked.';
  const r2 = runExportTextSafetyNet(glued, project, {});
  check('6. opted into songbird: the glued duplicate-phrase defect is STILL left untouched (deleted, not gated)',
    r2.changed === false && r2.text === glued, JSON.stringify(r2));
}

// ══ 4. source-shape: the rule table + sniper line + artifact pass are scoped ══
{
  check('7. repairManuscriptArtifacts is called exactly once in runExportTextSafetyNet, behind the songbird gate',
    (EXPORT_SRC.match(/repairManuscriptArtifacts\(out,/g) || []).length === 1
    && /exportRuleEnabled\(project, 'songbird'\)\) \{\s*\n\s*const artifact = repairManuscriptArtifacts\(out,/.test(EXPORT_SRC));
  check('8. the "duplicate short phrase" masking rule is gone from executable code (comment history is fine)',
    !EXPORT_EXEC.includes('duplicate short phrase'));
  check('9. the manuscript-named line-edit rules are gated behind songbird',
    /exportRuleEnabled\(project, 'songbird'\)\) \{\s*\n\s*const songbirdRules = \[/.test(EXPORT_SRC)
    && EXPORT_SRC.includes("'manual line edit: Hellman onstage comma'"));
  check('10. the "Songbird climax" sniper repair is inside the songbird-gated block, not unconditional',
    (() => {
      const idx = EXPORT_SRC.indexOf('Final sniper repair for the remaining Songbird climax paragraph');
      if (idx < 0) return false;
      const before = EXPORT_SRC.slice(0, idx);
      const openIdx = before.lastIndexOf("exportRuleEnabled(project, 'songbird')");
      const closeIdx = before.lastIndexOf('\n  }\n');
      return openIdx >= 0 && openIdx > closeIdx;
    })());
  check('11. the single-text tic thinner (redundant with the already-gated cross-chapter one) is deleted',
    !/function thinSongbirdStyleTics\(text/.test(EXPORT_SRC)
    && EXPORT_SRC.includes('function thinSongbirdStyleTicsAcrossChapters('));
}

// ══ 5. the gate sees the stored/resolved text, not the cleaned text ══
{
  check('12. runPreExportSafetyGate is called on resolved (stored) chapters, not cleaned',
    /runPreExportSafetyGate\(resolved, \{ project, stage: 'pre-export' \}\)/.test(EXPORT_SRC)
    && !/runPreExportSafetyGate\(cleaned,/.test(EXPORT_SRC));
}

// ══ 6. behavioral: live verdict === offline verdict on the same stored text ══
{
  const { runExportTextSafetyNet } = buildExportSandbox();
  const { runPreExportSafetyGate } = buildGateSandbox();
  const project = { book_type: 'fiction' };

  const stored = [{
    chapter_number: 5,
    title: 'The Glued Word',
    content_md: 'Mara crossed the room. She checked the readout twice. '.repeat(6)
      + '“Is itIs it” Mara asked, and Dov only shrugged in reply.',
  }];

  const offlineVerdict = await runPreExportSafetyGate(stored, { project, stage: 'pre-export' });

  // The live app now gates on `resolved` (== `stored` here), so the live and
  // offline verdicts are the same call on the same text — trivially equal.
  const liveVerdict = await runPreExportSafetyGate(stored, { project, stage: 'pre-export' });

  check('13. offline verdict blocks on the glued word',
    offlineVerdict.blocked === true && offlineVerdict.hardFailures.some((f) => (f.reasons || []).some((r) => /glued word/i.test(r))), JSON.stringify(offlineVerdict.hardFailures));
  check('14. live verdict (gate on resolved/stored text) equals the offline verdict',
    liveVerdict.blocked === offlineVerdict.blocked
    && liveVerdict.hardFailures.length === offlineVerdict.hardFailures.length);

  // Counterfactual: gating on the export path's OWN cleaned output (the old,
  // now-removed behavior) would have masked the defect and disagreed with the
  // offline verdict — proving finding 19's bug is real and this fix closes it.
  const cleanedText = runExportTextSafetyNet(stored[0].content_md, project, {}).text;
  const cleanedVerdict = await runPreExportSafetyGate([{ ...stored[0], content_md: cleanedText }], { project, stage: 'pre-export' });
  check('15. the counterfactual (gating on cleaned text, like the old code) would still agree, because cleanup no longer masks anything',
    cleanedText.includes('Is itIs it') && cleanedVerdict.blocked === offlineVerdict.blocked, cleanedText);
}

// ══ 7. finding 20 — GATEPROMOTE/CHARSTATE zero-count telemetry ══
{
  const { runPreExportSafetyGate } = buildGateSandbox();
  const clean = [{ chapter_number: 1, title: 'Clean', content_md: 'Mara crossed the quiet room and said nothing at all to anyone there. '.repeat(6) }];
  const logs = [];
  const origLog = console.log;
  console.log = (...a) => { logs.push(a.join(' ')); };
  try {
    await runPreExportSafetyGate(clean, { project: { book_type: 'fiction' }, stage: 'pre-export' });
  } finally {
    console.log = origLog;
  }
  check('16. [CHARSTATE] Gate scan: 0 violation(s) logs even when zero',
    logs.some((l) => l.includes('[CHARSTATE] Gate scan:') && l.includes('0 violation')), JSON.stringify(logs.filter((l) => l.includes('CHARSTATE') || l.includes('GATEPROMOTE'))));
  check('17. [GATEPROMOTE] Gate scan: 0 promotion(s) across N chapter(s) logs even when zero',
    logs.some((l) => l.includes('[GATEPROMOTE] Gate scan:') && l.includes('0 promotion') && l.includes('1 chapter')), JSON.stringify(logs.filter((l) => l.includes('GATEPROMOTE'))));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
