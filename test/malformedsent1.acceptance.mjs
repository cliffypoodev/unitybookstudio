// MALFORMEDSENT-1 acceptance battery — deterministic detector for the malformed-
// sentence shapes the pipeline's own mutating passes produced (root-cause trace
// 2026-08-15). Detection only, warning at export, never a mutation.
import fs from 'node:fs';
import vm from 'node:vm';
import { scanMalformedSentences, MALFORMEDSENT_VERSION, clauseHasPluralCommonNoun } from '../src/lib/malformedSentence.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };
const CAST = ['Zin', 'Zinnia', 'Nolan', 'JB', 'Rodge', 'Lark', 'Sadie', 'Missy', 'Thompson'];
const kinds = (t) => scanMalformedSentences(t, CAST).map((f) => f.kind);
const has = (t, k) => kinds(t).includes(k);

// ── must FLAG (real corruptions) ──
check('1. singular + were is flagged (agreement): "Zin were ridiculous."', has('Zin were ridiculous.', 'agreement'));
check('2. "Nolan were empty" is flagged (agreement)', has('Nolan were empty, but his fingers twitched.', 'agreement'));
check('3. dropped subject "Were a ragtag collection…" is flagged', has('Were a ragtag collection of scavengers, each covered in grime.', 'dropped-subject'));
check('4. dropped subject "Was wearing a duster coat…" is flagged', has('Was wearing a duster coat, and his hat was pulled low.', 'dropped-subject'));
check('5. dropped subject "Looked at Rodge." is flagged', has('Looked at Rodge.', 'dropped-subject'));
check('6. bare-verb "A strange sense of relief wash over her." is flagged', has('A strange sense of relief wash over her.', 'bare-verb'));
check('7. bare-verb "The weight in her chest lighten." is flagged', has('The weight in her chest lighten.', 'bare-verb'));
check('8. name-echo "JB looked at JB." is flagged', has('JB looked at JB.', 'name-echo'));

// ── must NOT flag (clean prose) ──
check('9. plural "They were a ragtag collection." is clean', kinds('They were a ragtag collection of scavengers.').length === 0);
check('10. compound "Sadie and Lark were arguing." is clean', kinds('Sadie and Lark were arguing softly near the cargo bay.').length === 0);
check('11. inverted question "Was that clever?" is clean', kinds('Was that clever?').length === 0);
check('12. "She felt a strange sense of relief wash over her." is clean', kinds('She felt a strange sense of relief wash over her.').length === 0);
check('13. "Zin looked at Rodge, then at the door." is clean (different name)', kinds('Zin looked at Rodge, then at the door.').length === 0);
check('14. "Nolan was wearing a duster coat, and his hat was pulled low." is clean', kinds('Nolan was wearing a duster coat, and his hat was pulled low.').length === 0);
check('15. ordinary prose is clean', kinds('The wind howled across the plain. Zin gripped the wrench and looked up at the sky.').length === 0);

// ── counts + version ──
check('16. a paragraph of mixed corruptions returns all of them', (() => {
  const t = 'Zin were ridiculous. Were a ragtag collection of scavengers. A strange sense of relief wash over her. JB looked at JB.';
  const ks = kinds(t).sort();
  return ks.length === 4 && ks.join(',') === 'agreement,bare-verb,dropped-subject,name-echo';
})());
check('17. version', MALFORMEDSENT_VERSION === 'malformed-sentence-v1');

// ── export-gate wiring: imported, called, WARNING (never a hard block) ──
const GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
check('18. export gate imports the detector', GATE.includes("from './malformedSentence.js'") && GATE.includes('scanMalformedSentences'));
// 19. RETIRED (unconditional) by GATEPROMOTE-1-CONTINUITY-BREAKS-BLOCK-EXPORT:
// MALFORMEDSENT-1 CAN become a hard block, gated by MALFORMEDSENT_HARD_BLOCK
// (malformedSentence.js), which stays false until two consecutive books
// export with "[MALFORMEDSENT] Gate scan: 0" — read the constant, not an
// absolute absence of hardFailures.push. Behavior proven live in
// test/gatepromote1.acceptance.mjs checks 3–4.
check('19. export gate calls it, stays a WARNING unless MALFORMEDSENT_HARD_BLOCK is true',
  GATE.includes('scanMalformedSentences(body, msCast)') &&
  GATE.includes('MALFORMEDSENT-1:') &&
  GATE.includes("import { scanMalformedSentences, MALFORMEDSENT_HARD_BLOCK } from './malformedSentence.js'") &&
  GATE.includes('isFictionProject(project) && MALFORMEDSENT_HARD_BLOCK') &&
  !/createExportHardBlockError\([^)]*MALFORMEDSENT/s.test(GATE));
const MS_SRC = fs.readFileSync(new URL('../src/lib/malformedSentence.js', import.meta.url), 'utf8');
check('20. MALFORMEDSENT_HARD_BLOCK defaults to false', /export const MALFORMEDSENT_HARD_BLOCK = false;/.test(MS_SRC));

// ── MALFORMEDSENT-2 (finding 44): a plural common noun earlier in the same
// clause is the TRUE subject — "were" agrees with IT, not the nearby proper
// noun the regex would otherwise flag. Fixture names only (Port Ellis /
// Dr. Vance), never a real book's cast or place. ──
const NF_CAST = ['Port Ellis', 'Dr. Vance', 'Zin'];
const nfKinds = (t) => scanMalformedSentences(t, NF_CAST).map((f) => f.kind);
check(
  '21. plural subject before a proper noun ("investigators ... Port Ellis were") is clean',
  nfKinds('The few investigators that did attempt to operate near Port Ellis were reassigned before the season ended.').length === 0
);
check(
  '22. a second live shape (plural "reports" before a proper noun) is clean',
  nfKinds('The reports that shaped the inquiry into Port Ellis were widespread across the region.').length === 0
);
check(
  '23. a true singular-subject case (no preceding plural noun) still fires',
  nfKinds('Dr. Vance were reassigned before the season ended.').includes('agreement')
);
check(
  '24. a plural noun in an EARLIER clause does not mask a genuine agreement error in a later clause',
  nfKinds('The investigators filed their reports, but Dr. Vance were reassigned regardless.').includes('agreement')
);

// ── MALFORMEDSENT-3 (finding 50): manuscriptSafetyGate.js's "Singular
// proper noun + were" canary now shares malformedSentence.js's clause-scoped
// plural-subject guard (clauseHasPluralCommonNoun) instead of a second,
// narrower hardcoded plural-noun list — one classifier decides for both
// entry points. manuscriptSafetyGate.js has a transitive @/-aliased
// dependency (generationContext.js -> projectType.js), so it is run in a VM
// sandbox — same technique as gatepromote1/lengthgate1/exportscrub2 — with
// the REAL clauseHasPluralCommonNoun (dependency-free) provided, not a mock.
{
  const MSG_SRC = fs.readFileSync(new URL('../src/lib/manuscriptSafetyGate.js', import.meta.url), 'utf8');
  check('25. manuscriptSafetyGate.js imports the shared guard from malformedSentence.js', MSG_SRC.includes("clauseHasPluralCommonNoun } from './malformedSentence.js'") && MSG_SRC.includes('clauseHasPluralCommonNoun(before)'));

  const msgCtx = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    detectModelControlTokens: () => ({ found: false, matches: [] }),
    findNarrativeMetaLeaks: () => [],
    clauseHasPluralCommonNoun,
    __e: {},
  };
  vm.createContext(msgCtx);
  const msgVmSrc = MSG_SRC
    .replace(/^import .*$/gm, '')
    .replace(/^export (async )?function/gm, '$1function')
    .replace(/^export (const|class|let)/gm, '$1')
    + '\n__e = { detectMalformedGrammar };';
  vm.runInContext(msgVmSrc, msgCtx);
  const { detectMalformedGrammar } = msgCtx.__e;
  const gateAgreementHits = (t) => detectMalformedGrammar(t).matches.filter((m) => m.phrase === 'Singular proper noun + were').length;

  const ch2Shape = 'The few investigators that did attempt to operate near Port Ellis were reassigned before the season ended.';
  const ch11Shape = 'The reports that shaped the inquiry into Port Ellis were widespread across the region.';
  const trueSingular = 'Port Ellis were free by the season end.';

  check('26. Ch.2-shaped fixture: zero agreement hits from scanMalformedSentences', !nfKinds(ch2Shape).includes('agreement'));
  check('27. Ch.2-shaped fixture: zero agreement hits from the safety gate', gateAgreementHits(ch2Shape) === 0);
  check('28. Ch.11-shaped fixture: zero agreement hits from scanMalformedSentences', !nfKinds(ch11Shape).includes('agreement'));
  check('29. Ch.11-shaped fixture: zero agreement hits from the safety gate', gateAgreementHits(ch11Shape) === 0);
  check('30. a true singular subject (no preceding plural noun) still fires in scanMalformedSentences', nfKinds(trueSingular).includes('agreement'));
  check('31. a true singular subject (no preceding plural noun) still fires in the safety gate', gateAgreementHits(trueSingular) === 1);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
