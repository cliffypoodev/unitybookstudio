// EXPORTSCRUB-1 acceptance — the export path may not carry one book's names,
// and may not decide a book's TYPE by reading its prose.
//
// The export stage is the last thing between a manuscript and a published file, and it
// had accumulated cleanup rules written for individual books, each guarded by a
// detector that sniffed the project's own narration. Sandbox-proven against the live
// files before this fix:
//
//   isLikelyNonfictionExportProject({...}, [ch]) === true
//     for a NOVEL whose chapter contains "She had no guide, no map, and no way out."
//     -> ran a sweep replacing four named people with the phrase "one unnamed inmate"
//        in the exported DOCX.
//
//   isSongbirdExportProject === true for any premise containing the word "Songbird"
//     -> renamed every Arthur to Langston and every Cora to Clara.
//
//   looksLikeChapterOne === true for EVERY book (`no === 1 ||`)
//     -> tested a truncating regex written for one book against every book's ch.1.
//
//   "“You kept the letters safe. Thank you.”"
//     -> "“You kept the letters safe. “Thank you.”"  (2 open / 1 close)
//        and applyFinalExportCleanup runs BEFORE the safety gate, so the gate then
//        hard-blocked the book for damage the export path had just done to it.
//
// This battery reads the source rather than executing the React module: ExportTab.jsx
// is a 3,800-line component with a deep import graph, and what needs proving is a
// property of the code — that these decisions are declared, not inferred.
import fs from 'fs';
import { exportRuleEnabled, LEGACY_EXPORT_RULE_KEYS } from '../src/lib/exportRuleScope.js';
import { isNonfictionProject } from '../src/lib/projectType.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};
const quiet = (fn) => {
  const w = console.warn; const l = console.log;
  console.warn = () => {}; console.log = () => {};
  try { return fn(); } finally { console.warn = w; console.log = l; }
};

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url).pathname, 'utf8');
// Strip comments before asserting on code: this battery's own explanations and the
// fixes' rationales both quote the patterns being removed.
const executable = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');

const EXPORT = read('src/components/publishing/ExportTab.jsx');
const HEALTH = read('src/components/publishing/ManuscriptHealthCheck.jsx');
const GATE = read('src/lib/exportSafetyGate.js');
const XE = executable(EXPORT);
const XH = executable(HEALTH);
const XG = executable(GATE);

// ── the opt-in mechanism ──
{
  check('no rules run for a project that asks for none',
    LEGACY_EXPORT_RULE_KEYS.every((k) => quiet(() => exportRuleEnabled({ id: 'p1' }, k)) === false));
  check('null/undefined project does not throw',
    quiet(() => exportRuleEnabled(null, 'songbird')) === false
    && quiet(() => exportRuleEnabled(undefined, 'songbird')) === false);
  check('an array opt-in works',
    quiet(() => exportRuleEnabled({ id: 'p2', legacy_export_rules: ['songbird'] }, 'songbird')) === true);
  check('a comma-separated string opt-in works',
    quiet(() => exportRuleEnabled({ id: 'p3', legacy_export_rules: 'glitch, songbird' }, 'glitch')) === true);
  check('opting into one rule does not enable another',
    quiet(() => exportRuleEnabled({ id: 'p4', legacy_export_rules: ['songbird'] }, 'glitch')) === false);
  check('an unknown key is not enabled by a wildcard',
    quiet(() => exportRuleEnabled({ id: 'p5', legacy_export_rules: ['*'] }, 'songbird')) === false);
  check('the key list is frozen', Object.isFrozen(LEGACY_EXPORT_RULE_KEYS));
}

// ── project type is declared, never sniffed ──
{
  const novel = { book_type: 'fiction', genre: 'Historical Fiction', title: 'The House of Cornelius' };
  check('the authority calls a declared novel fiction', isNonfictionProject(novel) === false);

  check('the export nonfiction detector delegates to the authority',
    /function isLikelyNonfictionExportProject\(project = \{\}\) \{[\s\S]{0,900}?return isNonfictionProjectAuthority\(project\);/.test(EXPORT),
    'it still has a body of its own');
  check('…and no longer takes chapters at all',
    !/isLikelyNonfictionExportProject\(project = \{\}, chapters/.test(EXPORT));
  check('the health-check nonfiction detector delegates to the authority',
    /function isLikelyNonfictionProject\(project = \{\}\) \{[\s\S]{0,900}?return isNonfictionProjectAuthority\(project\);/.test(HEALTH));

  // The specific construction that misclassified eight novels: a haystack containing
  // the TITLE, tested for the word "historical".
  for (const [name, src] of [['ExportTab.jsx', XE], ['ManuscriptHealthCheck.jsx', XH]]) {
    check(`${name}: no nonfiction test reads the project title`,
      !/(project\?\.title[\s\S]{0,400}?)\b(nonfiction|historical)\b/i.test(src));
    check(`${name}: no nonfiction word-list regex with "historical" survives`,
      !/nonfiction\|history\|historical/.test(src));
  }
  check('ExportTab: no nonfiction test reads chapter prose',
    !/nonfiction\|history\|investigative\|true\\s\+crime/.test(XE));
}

// ── book-specific rules are behind the opt-in ──
{
  check('the Songbird detector no longer reads prose',
    !/function isSongbirdExportProject\(project = \{\}, chapters/.test(EXPORT));
  check('…and is now a declaration',
    /function isSongbirdExportProject\(project = \{\}\) \{[\s\S]{0,800}?exportRuleEnabled\(project, 'songbird'\)/.test(EXPORT));
  check('the Iris/Pauline/HIDA world-sniff is gone',
    !/HIDA\|Harlem Institute\|Port Chicago/.test(XE));

  check('the chapter-1 hard cut requires an explicit opt-in',
    /exportRuleEnabled\(project, 'glitch'\) && looksLikeChapterOne\(chapter, index\)/.test(XE));
  check('the persona sweep requires BOTH a nonfiction verdict and an opt-in',
    /isLikelyNonfictionExportProject\(project\)\s*\n?\s*&& exportRuleEnabled\(project, 'prisonHistorySources'\)/.test(XE));
  check('the named-cast style repairs are behind an opt-in',
    /exportRuleEnabled\(project, 'styleTicRepairs'\)/.test(XE));

  // Every remaining occurrence of a book's cast must sit inside an opt-in block.
  for (const name of ['Zonk', 'Blaze’s', 'griffon']) {
    const idx = XE.indexOf(name);
    if (idx < 0) { check(`"${name}" is gone from executable code`, true); continue; }
    const before = XE.slice(0, idx);
    const guarded = /exportRuleEnabled\(project, '(?:styleTicRepairs|songbird|glitch|prisonHistorySources)'\)/
      .test(before.slice(-4000));
    check(`"${name}" only appears inside an opt-in block`, guarded,
      `nearest preceding guard not found within 4000 chars of index ${idx}`);
  }

  // "one unnamed inmate" lives inside runNonfictionFinalExportScarTissueSweep, so the
  // guard is at the CALL SITE, not lexically above it. Proximity is the wrong test for
  // that shape — assert reachability instead: every call to that function is guarded.
  {
    const calls = XE.split('\n')
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => /runNonfictionFinalExportScarTissueSweep\(/.test(line)
        && !/^function |^\s*function /.test(line));
    check('the persona sweep is called exactly once', calls.length === 1,
      calls.map(([n, l]) => `${n}: ${l.trim()}`).join(' | '));
    if (calls.length === 1) {
      const [lineNo] = calls[0];
      const preceding = XE.split('\n').slice(Math.max(0, lineNo - 6), lineNo).join('\n');
      check('…and its only call site is behind the opt-in',
        /exportRuleEnabled\(project, 'prisonHistorySources'\)/.test(preceding), preceding.trim());
    }
    check('"one unnamed inmate" appears only inside that sweep',
      (XE.match(/one unnamed inmate/g) || []).length === 1);
  }

  check('the "generic" tic thinner no longer names three characters',
    !/his\|her\|His\|Her\|Zonk/.test(XE));
}

// ── the export path may not create the damage the gate blocks on ──
{
  for (const phrase of ['missing opener: Thank you', 'missing opener: Aren’t you',
    'missing opener: I doubt that', 'missing opener: I’m not uncomfortable']) {
    check(`the quote-inserting rule "${phrase}" is deleted`, !XE.includes(phrase));
  }
  // Behavioural: whatever rules remain must not be able to unbalance a correct line.
  const line = '“You kept the letters safe. Thank you.”';
  const opens = (line.match(/“/g) || []).length;
  const closes = (line.match(/”/g) || []).length;
  check('the sample line this used to break is balanced to begin with', opens === closes);
  check('no surviving rule inserts a bare opening curly quote before a fixed phrase',
    !/'\$1“[A-Z]/.test(XE), 'a $1“Phrase replacement is back');
}

// ── the safety gate counts honestly ──
{
  check('a chapter too short to scan is no longer recorded as passed',
    /skipped\.push\(\{/.test(GATE) && !/passed\.push\(\{[\s\S]{0,200}?Too short to scan/.test(GATE));
  check('the gate reports a skipped bucket', /\n    skipped,\n/.test(GATE));
  check('the clear message no longer claims "All N passed"',
    !/EXPORT CLEAR: All \$\{passed\.length\}/.test(GATE));
  check('the clear message names the chapters it did not scan',
    /chapter\(s\) were NOT scanned/.test(GATE));
  check('the typography verdict is acted on, not just logged',
    /if \(structural\.typography && !structural\.typography\.pass\)/.test(XG));
  check('…and it uses the field names checkStructuralIntegrity actually returns',
    /structural\.typography\.straightQuotes/.test(XG) && /structural\.typography\.curlyOpen/.test(XG));
}

// ── one rule for what counts as chapter content ──
{
  check('Health Check no longer counts beat_summary as manuscript prose',
    !/content_md \|\| chapter\?\.beat_summary/.test(XH));
  check('…and ExportTab still states the rule it now shares',
    EXPORT.includes('beat_summary is planning metadata and must never make Export look ready.'));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
