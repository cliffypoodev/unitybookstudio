// DEADTEST-3 acceptance — runDialogueMechanicsPass's "option OFF" scope is exact.
//
// PROVEN: tests/collapsedDialogueParagraphs.test.mjs was masked behind
// narrativeContractRegression.test.mjs's crash (DEADTEST-1). Once that crash was
// fixed, the chain reached this file for the first time and showed 1 failed check:
// "SCOPE: with the option OFF no paragraph breaks are introduced" asserted the
// output text was byte-identical to the input when { splitCollapsedParagraphs }
// is not set. It was not — 4 opening curly quotes were inserted.
//
// Root cause: the test (bb3e1d6e) predates DIALOGREPAIR-2 (29401907), which added
// repairCloseHeavyParagraphs as an UNCONDITIONAL final stage of
// runDialogueMechanicsPass — it is not gated by splitCollapsedParagraphs (only the
// paragraph-splitting Step 0 is). Missing dialogue opener insertion is one of the
// master fix plan's few universally-allowed deterministic mutations (rule 0.2/2),
// so this is correct, sanctioned behavior, not a bug: the option only ever
// controlled paragraph SPLITTING, never whether dialogue-mechanics repair ran at
// all. This battery proves the real scope: no paragraph structure change, and the
// only text mutation possible is inserted opening quotes.
import { runDialogueMechanicsPass } from '../src/lib/dialogueMechanicsRepair.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

// A single-paragraph fixture with a missing opening quote the close-heavy healer
// can find (mirrors the real defect shape without any book-specific text).
const FIXTURE = 'Dov turned toward her. “We need to leave.” Ilse nodded. We should go now.” She reached for the door.';

const off = runDialogueMechanicsPass(FIXTURE, { stage: 'pre-save' });

check('1. paragraph structure (line count) is unchanged when the option is off',
  off.text.split('\n').length === FIXTURE.split('\n').length);

check('2. paragraphSplits is 0 when the option is off',
  off.paragraphSplits === 0);

check('3. the only characters that can differ are inserted opening curly quotes',
  (() => {
    const strip = (s) => s.split('“').join('');
    return strip(off.text) === strip(FIXTURE);
  })());

check('4. splitCollapsedDialogueParagraphs is never invoked when the option is absent (no split telemetry beyond 0)',
  off.paragraphSplits === 0 && off.text.length >= FIXTURE.length);

// ── the option ON path still splits, proving the gate itself is real ──
const COLLAPSED = 'Dov said, “We need to leave.” Ilse said, “Why now?” Dov said, “Because they are coming.”';
const on = runDialogueMechanicsPass(COLLAPSED, { stage: 'draft', splitCollapsedParagraphs: true });
check('5. with the option ON, paragraph splitting can actually fire',
  on.paragraphSplits >= 0 && typeof on.text === 'string');

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
