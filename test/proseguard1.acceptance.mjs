// PROSEGUARD-1 acceptance — a general repair engine may not rewrite prose it did not break.
//
// postDraftCleanup.js is the post-draft repair stage every chapter of every book passes
// through. Two separate defects lived in it:
//
//  1. Rules that destroyed prose. Editorial-artifact patterns written as
//     `\[?\s*MARKER[^\n]*` — an OPTIONAL bracket plus an unbounded run to end of line —
//     deleted the rest of the author's paragraph whenever narration contained the
//     marker words. A "broken contraction" rule treated `can'` and `won'` as damage and
//     ate the closing quote of single-quoted dialogue. A dialogue-tag rule could not
//     tell a closing quote from an opening one. A "subject repair" invented a subject
//     by grabbing the last capitalized token in the paragraph — which was usually the
//     word it was repairing — and compounded on every pass. A sentence round-trip
//     re-joined on spaces, flattening every single-newline line break in the chapter.
//
//  2. About 150 verbatim phrases from ONE dead manuscript — its cast (Husbandman,
//     Orin, Elias, Jonah, Caspian, Ronan, Kael, Lev, Halvard), its props ("stale coffee
//     on his pause"), its own broken sentences — hardcoded across five regions, several
//     of which were word substitutions rather than repairs.
//
// This battery holds three lines at once: the destructive behaviours are gone, the
// legitimate repairs still work, and the engine no longer knows any book's data.
import fs from 'fs';
import vm from 'node:vm';
import { LEGACY_PROSE_REPAIRS } from '../src/lib/legacyProseRepairs.data.js';
import { resolveProseRepairs, EMPTY_PROSE_REPAIRS } from '../src/lib/bookScrubRules.js';

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

const SRC = new URL('../src/lib/postDraftCleanup.js', import.meta.url).pathname;
const raw = fs.readFileSync(SRC, 'utf8');

// ── load the module into a vm slice (it imports @/lib aliases node cannot resolve) ──
const EMPTY = { microCopyedit: [], hardSurvivor: [], articleRepairs: [], phraseRepairs: [] };
function load(repairs = EMPTY) {
  const code = raw
    .replace(/^import .*$/gm, '')
    .replace(/^export default .*$/gm, '')
    .replace(/^export (async )?function/gm, '$1function')
    .replace(/^export const/gm, 'const');
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    invokeLLMWithRetry: async () => { throw new Error('no llm in slice'); },
    pickModel: () => 'stub',
    pickFallbackModel: () => 'stub',
    shouldUppercaseAfterPunct: () => true,
    scrubModelLeaks: (t) => ({ text: t }),
    isNonfictionProjectAuthority: () => false,
    resolveProseRepairs: () => repairs,
    EMPTY_PROSE_REPAIRS: EMPTY,
    __out: {},
  };
  vm.createContext(ctx);
  const names = ['regexCleanup', 'deterministicSentenceRepair', 'commonNounArticleRepair',
    'runSurgicalArtifactRepair', 'runFinalHygiene', 'findEditorialArtifacts',
    'buildSurvivorWarning', 'matchesKnownBrokenPhrase', 'projectIsNonfiction',
    'runMicroCopyeditRepairs', 'runFinalHardSurvivorRepairs'];
  const tail = `\n__out = { ${names.map((n) => `${n}: typeof ${n} !== 'undefined' ? ${n} : null`).join(', ')} };`
    + `\nglobalThis.__setRepairs = (r) => { proseRepairs = r; };`;
  vm.runInContext(code + tail, ctx);
  ctx.__setRepairs(repairs);
  return ctx.__out;
}
const M = load();
const textOf = (r) => (typeof r === 'string' ? r : r?.text);

// ── 1. the destructive rules no longer destroy ──
// Every input below is ORDINARY PROSE. Every one of them was mangled by the live file
// before this fix; the recorded "was" output is what the live code actually produced.
{
  const cases = [
    ['unanchored editorial-artifact deletion',
      'The engine needs work, and the plane leaves at dawn. She grabbed the toolbox and ran for the hangar.',
      'The engine'],
    ['note-to-self deletion',
      'Note to self: never trust him again. She closed the diary and slid it under the mattress.',
      '(everything after the marker)'],
    ['delete-this in narration',
      'She would delete this later, when her hands stopped shaking. The screen glowed.',
      '(rest of paragraph)'],
    ['todo as a Spanish word',
      '“Todo el mundo lo sabe,” she said. He looked away and said nothing at all.',
      '(rest of paragraph)'],
    ['single-quoted dialogue ending in "won"',
      "He said, 'I think he won' and walked out.",
      "won't (meaning inverted, closing quote eaten)"],
    ['single-quoted dialogue ending in "can"',
      "'I will do what I can' and hung up.",
      "can't"],
    ['a quoted word that is also a dialogue verb',
      'Nobody used the word "asked" anymore.',
      'Nobody used the word," asked" anymore.'],
  ];
  for (const [label, input, was] of cases) {
    const out = textOf(M.regexCleanup(input));
    check(`prose survives: ${label}`, out === input, `was → ${was}\n      got  → ${JSON.stringify(out)}`);
  }
}

{
  // The subject-insertion block is deleted, not guarded: a guessed subject is
  // fabrication, and both of these inputs were correct English to begin with.
  const cases = [
    ['subject-auxiliary inversion', 'Had he known, he would have stayed.'],
    ['a question', 'Was that a threat?'],
    ['a deliberate fragment', 'Was shaking.'],
    ['plural inversion', 'Were the doors locked?'],
  ];
  for (const [label, input] of cases) {
    let t = input;
    for (let i = 0; i < 4; i += 1) t = M.deterministicSentenceRepair(t, `Elena leaned in close. ${t}`);
    check(`no fabricated subject, and none compounds: ${label}`, t === input, `got → ${JSON.stringify(t)}`);
  }
}

{
  const input = 'He opened the door.\nThe room was empty.\nShe was gone.';
  const out = textOf(M.runSurgicalArtifactRepair(input));
  check('single-newline line breaks survive the sentence round-trip', out === input, `got → ${JSON.stringify(out)}`);

  const multi = 'First para line one.\nFirst para line two.\n\nSecond para.';
  const outMulti = textOf(M.runSurgicalArtifactRepair(multi));
  check('blank-line paragraph structure also survives', outMulti === multi, `got → ${JSON.stringify(outMulti)}`);
}

{
  const input = 'Here is the chapter of my life I never wrote down. It started in June.';
  const out = textOf(M.runFinalHygiene(input));
  check('preface stripper does not bite into a sentence', out === input, `got → ${JSON.stringify(out)}`);
}

{
  // The em-dash branch capitalized mid-sentence; an em dash is not a sentence boundary.
  const input = 'Nothing moved. He waited by the door — nothing came. Nothing moved again.';
  const out = textOf(M.runSurgicalArtifactRepair(input));
  check('no capitalization after an em dash', !/—\s*Nothing/.test(out), `got → ${JSON.stringify(out)}`);

  // The root cause of that one: every capitalized token was forced to a count of 2,
  // so the "is this a proper name" filter could never reject anything and an ordinary
  // word that merely opened a sentence became a name. Only mid-sentence capitals count
  // now — but a real name must still be found.
  const ordinary = 'Nothing moved. Nothing came. Nothing moved again. nothing at all.';
  check('a word that only ever opens a sentence is not treated as a name',
    !/\. Nothing at all/.test(textOf(M.runSurgicalArtifactRepair(ordinary))),
    `got → ${JSON.stringify(textOf(M.runSurgicalArtifactRepair(ordinary)))}`);

  const named = 'She found Quillon by the gate. She watched Quillon for a while. quillon turned away.';
  check('a real proper name is still capitalized at a sentence start',
    /\. Quillon turned away/.test(textOf(M.runSurgicalArtifactRepair(named))),
    `got → ${JSON.stringify(textOf(M.runSurgicalArtifactRepair(named)))}`);
}

// ── 2. the legitimate repairs still fire ──
{
  const cases = [
    ['bracketed TODO', 'She ran. [TODO: describe the hallway] He followed.', /TODO/],
    ['bracketed editor note', 'She ran. [NOTE TO SELF: fix this] He followed.', /NOTE TO SELF/],
    ['an all-caps marker owning its own line', 'She ran.\n\nTODO: describe the hallway\n\nHe followed.', /TODO/],
    ['an HTML comment', 'She ran. <!-- placeholder --> He followed.', /<!--/],
    ['NEEDS REVISION owning its own line', 'She ran.\n\nNEEDS REVISION\n\nHe followed.', /NEEDS REVISION/],
  ];
  for (const [label, input, still] of cases) {
    const out = textOf(M.regexCleanup(input));
    check(`real artifact still removed: ${label}`, !still.test(out), `got → ${JSON.stringify(out)}`);
    check(`  …and the surrounding prose is intact: ${label}`,
      out.includes('She ran.') && out.includes('He followed.'), `got → ${JSON.stringify(out)}`);
  }
}

{
  const cases = [
    ['genuinely broken contraction', "He doesn' care about any of it.", "doesn't"],
    ['fused closing quote before a tag', 'It was over" said Ilka.', '," said'],
  ];
  for (const [label, input, want] of cases) {
    const out = textOf(M.regexCleanup(input));
    check(`real repair still fires: ${label}`, out.includes(want), `got → ${JSON.stringify(out)}`);
  }
}

{
  // A manuscript with no single-quote dialogue keeps the can/won repair.
  const out = textOf(M.regexCleanup("She said she can' come tomorrow."));
  check('can/won repair survives where there is no single-quote dialogue',
    out.includes("can't"), `got → ${JSON.stringify(out)}`);
}

// ── 3. the engine no longer knows any book ──
{
  const cast = ['Husbandman', 'Orin', 'Elias', 'Jonah', 'Caspian', 'Ronan', 'Kael',
    'stale coffee', 'capped it set it aside', 'gaze lifted found', 'A stupid, wet sound'];
  // Strip comments first: this battery's own explanations name the cast, and so does
  // the fix's rationale in the source. What matters is the executable text.
  const executable = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  for (const name of cast) {
    check(`postDraftCleanup.js no longer contains "${name}"`, !executable.includes(name));
  }
}

{
  check('a project with nothing declared gets NO prose repairs',
    quiet(() => resolveProseRepairs({ id: 'p1' })) === EMPTY_PROSE_REPAIRS);
  check('…and that empty set really is empty',
    EMPTY_PROSE_REPAIRS.microCopyedit.length === 0
    && EMPTY_PROSE_REPAIRS.hardSurvivor.length === 0
    && EMPTY_PROSE_REPAIRS.articleRepairs.length === 0
    && EMPTY_PROSE_REPAIRS.phraseRepairs.length === 0);
  check('null/undefined do not throw', quiet(() => resolveProseRepairs(null)) === EMPTY_PROSE_REPAIRS
    && quiet(() => resolveProseRepairs(undefined)) === EMPTY_PROSE_REPAIRS);
  check('the legacy bank is reachable ONLY by explicit opt-in',
    quiet(() => resolveProseRepairs({ id: 'p2', use_legacy_prose_repairs: true })) === LEGACY_PROSE_REPAIRS);
  check('an unparseable prose_repairs_json falls back to empty, not to legacy',
    quiet(() => resolveProseRepairs({ id: 'p3', prose_repairs_json: '{not json' })) === EMPTY_PROSE_REPAIRS);
}

{
  const R = LEGACY_PROSE_REPAIRS;
  check('the legacy prose bank is frozen', Object.isFrozen(R));
  check('the micro-copyedit rules survived the move', R.microCopyedit.length === 39, String(R.microCopyedit.length));
  check('the hard-survivor rules survived the move', R.hardSurvivor.length === 22, String(R.hardSurvivor.length));
  check('the article repairs survived the move', R.articleRepairs.length === 10, String(R.articleRepairs.length));
  check('the phrase repairs survived the move', R.phraseRepairs.length === 16, String(R.phraseRepairs.length));
  check('every micro rule is { pattern: RegExp, replacement: string }',
    R.microCopyedit.every((r) => r.pattern instanceof RegExp && typeof r.replacement === 'string'));

  // EQUIVALENCE: with the legacy bank explicitly loaded, the old behaviour returns.
  const L = load({
    microCopyedit: R.microCopyedit, hardSurvivor: R.hardSurvivor,
    articleRepairs: R.articleRepairs, phraseRepairs: R.phraseRepairs,
  });
  check('opted in, the legacy bank still repairs what it used to',
    L.commonNounArticleRepair('A stupid, wet sound.') === 'A stupid, wet sound came from him.',
    L.commonNounArticleRepair('A stupid, wet sound.'));
  check('opted out, the same input is left alone',
    M.commonNounArticleRepair('A stupid, wet sound.') === 'A stupid, wet sound.',
    M.commonNounArticleRepair('A stupid, wet sound.'));
}

{
  // The three hand-maintained "known broken phrase" lists are gone; the detector is
  // derived from the repair bank, so with no bank there is nothing to detect.
  check('with no repair bank, nothing is a known-broken phrase',
    M.matchesKnownBrokenPhrase('His pause fogged') === false);
  check('with no repair bank, the survivor scan reports nothing',
    M.buildSurvivorWarning('His pause fogged and the gaze lifted found nothing.').length === 0);
  const L = load({
    microCopyedit: LEGACY_PROSE_REPAIRS.microCopyedit, hardSurvivor: LEGACY_PROSE_REPAIRS.hardSurvivor,
    articleRepairs: LEGACY_PROSE_REPAIRS.articleRepairs, phraseRepairs: LEGACY_PROSE_REPAIRS.phraseRepairs,
  });
  check('opted in, the derived detector finds the legacy phrases',
    L.matchesKnownBrokenPhrase('His pause fogged') === true);
}

// ── 4. one authority for what an artifact is ──
{
  const executable = raw.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  const listCount = (executable.match(/EDITORIAL_ARTIFACT_PATTERNS/g) || []).length;
  check('the editorial-artifact list is declared once and used, not duplicated',
    listCount >= 3, `EDITORIAL_ARTIFACT_PATTERNS appears ${listCount} time(s)`);
  check('no second inline copy of the artifact list survives',
    !/const editorialPatterns\s*=/.test(executable));
  check('no artifact pattern runs unbounded to end of line',
    !/\\\[\?\\s\*[A-Z]/.test(executable), 'an optional-bracket pattern is back');
}

// ── 5. project type comes from the authority ──
{
  const bodyStart = raw.indexOf('function projectIsNonfiction');
  const body = raw.slice(bodyStart, bodyStart + 400);
  check('projectIsNonfiction delegates instead of testing fields itself',
    body.includes('isNonfictionProjectAuthority(project)') && !body.includes("=== 'nonfiction'"),
    body.split('\n').slice(0, 4).join(' | '));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
