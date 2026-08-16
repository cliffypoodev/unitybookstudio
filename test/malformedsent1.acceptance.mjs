// MALFORMEDSENT-1 acceptance battery — deterministic detector for the malformed-
// sentence shapes the pipeline's own mutating passes produced (root-cause trace
// 2026-08-15). Detection only, warning at export, never a mutation.
import fs from 'node:fs';
import { scanMalformedSentences, MALFORMEDSENT_VERSION } from '../src/lib/malformedSentence.js';

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
check('19. export gate calls it and pushes a MALFORMEDSENT-1 WARNING, not a hard block',
  GATE.includes('scanMalformedSentences(body, msCast)') &&
  GATE.includes('MALFORMEDSENT-1:') &&
  !/createExportHardBlockError\([^)]*MALFORMEDSENT/s.test(GATE) &&
  !/hardFailures\.push\([^)]*MALFORMEDSENT/s.test(GATE));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
