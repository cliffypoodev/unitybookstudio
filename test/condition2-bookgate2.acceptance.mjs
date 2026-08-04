// CONDITION-2 + BOOKGATE-2 acceptance.
//
// CONDITION-2 runs the REAL exported function. Its headline fixture is the exact
// ch.3 → ch.4 defect from Brass Meridian TEST: a hand amputated in one chapter and
// gripping a wall in the next.
//
// BOOKGATE-2 is the export wiring. runPreExportSafetyGate needs a browser-shaped
// world to execute, so the wiring is asserted against the REAL source by anchor —
// the same technique the ROUTERHEAL-2 and EXITSTATE-1 batteries use.
import fs from 'fs';
import { checkConditionRestoration, extractLimbFacts } from '../src/lib/sceneContractGate.js';

let failures = 0;
const check = (label, ok) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label);
  if (!ok) failures += 1;
};

const CAST = ['Lena Ortiz', 'Marcus Reed', 'Dr. Nolan Vale'];
const LOST_HAND = { 'Marcus Reed': ['left hand stump'] };

// ── the live defect ──
{
  const ch4 = 'Marcus stumbled ahead, his left hand—wrapped in thick, blood-stiffened gauze—clutching the wall for balance.';
  const iss = checkConditionRestoration({ prose: ch4, cast: CAST, ledgerConditions: LOST_HAND });
  check('the live ch.3→ch.4 restored hand is caught',
    iss.length === 1 && iss[0].code === 'CONDITION_RESTORATION');
  check('the violation quotes the offending sentence',
    /clutching the wall/.test(iss[0].excerpt));
  check('the violation names the recorded condition',
    iss[0].condition === 'left hand stump');
}

// ── the ledger really does record the loss from ch.3 prose ──
{
  const ch3 = 'Marcus did not flinch as she pressed the cloth against the stump of his left hand.';
  const facts = extractLimbFacts(ch3);
  check('ch.3-style prose produces a limb LOSS fact',
    facts.length > 0 && /stump|loss/.test(facts[0].kind) && facts[0].side === 'left');
}

// ── it must stay quiet when it should ──
{
  const other = 'Marcus reached out with his right hand and gripped the rail.';
  check('using the OTHER side is not a violation',
    checkConditionRestoration({ prose: other, cast: CAST, ledgerConditions: LOST_HAND }).length === 0);

  const describing = 'Marcus lifted the stump of his left hand and let it fall.';
  check('a sentence describing the loss itself is not a violation',
    checkConditionRestoration({ prose: describing, cast: CAST, ledgerConditions: LOST_HAND }).length === 0);

  const pronoun = 'He gripped the rail with his left hand.';
  check('an unnamed pronoun subject never accuses anyone',
    checkConditionRestoration({ prose: pronoun, cast: CAST, ledgerConditions: LOST_HAND }).length === 0);

  const passive = 'Marcus glanced at his left hand.';
  check('mentioning the limb without using it is not a violation',
    checkConditionRestoration({ prose: passive, cast: CAST, ledgerConditions: LOST_HAND }).length === 0);

  const noSide = 'Marcus gripped the rail hard.';
  check('a limb action with no side named is not a violation',
    checkConditionRestoration({ prose: noSide, cast: CAST, ledgerConditions: LOST_HAND }).length === 0);

  check('a character with no recorded loss is never checked',
    checkConditionRestoration({
      prose: 'Lena gripped the rail with her left hand.', cast: CAST, ledgerConditions: LOST_HAND,
    }).length === 0);

  check('a non-loss condition does not trigger the check',
    checkConditionRestoration({
      prose: 'Marcus gripped the rail with his left hand.',
      cast: CAST,
      ledgerConditions: { 'Marcus Reed': ['left hand bruised'] },
    }).length === 0);
}

// ── short-name resolution ──
{
  const iss = checkConditionRestoration({
    prose: 'Marcus curled the fingers of his left hand around the pipe.',
    cast: CAST,
    ledgerConditions: { marcus: ['left hand amputated/severed'] },
  });
  check('a ledger keyed by a short name still resolves', iss.length === 1);
}

// ── robustness ──
{
  check('empty and malformed input never throws',
    checkConditionRestoration({}).length === 0
    && checkConditionRestoration({ prose: '', cast: null, ledgerConditions: null }).length === 0
    && checkConditionRestoration({ prose: 'x', ledgerConditions: { A: null } }).length === 0);
}

// ── one report per condition, not one per sentence ──
{
  const many = 'Marcus gripped the bar with his left hand. '
    + 'Marcus pulled the lever with his left hand. '
    + 'Marcus pressed his left hand to the glass.';
  check('a repeated violation reports once, not once per sentence',
    checkConditionRestoration({ prose: many, cast: CAST, ledgerConditions: LOST_HAND }).length === 1);
}

// ── BOOKGATE-2: the export gate actually calls the structural check ──
{
  const SRC = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
  check('exportSafetyGate imports the structural checks',
    /import \{[^}]*checkStructuralIntegrity[^}]*\} from '\.\/pipelineValidator\.js'/.test(SRC));
  check('the export gate calls checkStructuralIntegrity per chapter',
    /const structural = checkStructuralIntegrity\(content, entry\.chapterNumber\)/.test(SRC));
  check('unclosed dialogue sets ok=false and REJECT_MANUAL_REVIEW',
    /if \(!structural\.quoteBalance\.pass\) \{[\s\S]{0,200}entry\.ok = false;[\s\S]{0,120}REJECT_MANUAL_REVIEW/.test(SRC));
  check('glued words hard-block export',
    /if \(!structural\.gluedWords\.pass\)[\s\S]{0,200}entry\.ok = false/.test(SRC));
  check('unterminated paragraphs hard-block export',
    /if \(!structural\.unterminatedParagraphs\.pass\)[\s\S]{0,200}entry\.ok = false/.test(SRC));
  check('a structural check that THROWS blocks export rather than passing it',
    /BOOKGATE-2 structural check failed to execute/.test(SRC)
    && /blocking export rather than passing unchecked/.test(SRC));
  check('cross-chapter integrity runs and is ADVISORY, not a hard block',
    /checkBookIntegrity\(chapters\.map/.test(SRC)
    && /advisory, not blocking/.test(SRC)
    && !/bookReport[\s\S]{0,300}hardFailures\.push/.test(SRC));
  check('the cross-chapter report is exposed for inspection',
    /window\.__UBS_LAST_BOOK_INTEGRITY = bookReport/.test(SRC));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
