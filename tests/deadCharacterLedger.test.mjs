// LEDGERFIX-1 proof: a pronoun must never be recorded as a dead character.
//
// Reproduces the exact failure that killed a real Chapter 2 draft on 2026-07-28:
// scene 2's prose said someone "died in the accident", the ledger recorded a
// character named "He" (Dead: 1), and the DEAD_CHARACTER_ACTION gate then built
// /\bHe\b\s+(?:said|nodded|looked|...)/i and rejected scene 3. No rewrite can
// remove the word "he" from a chapter, so the bounded repair could never clear
// it: `deterministic narrative-state violations survived repair`.
import { buildInitialLedger, extractSceneLedgerUpdates } from '@/lib/narrativeLedger';
import { auditSceneAgainstLedger } from '@/lib/sceneContractGate';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}

const dead = (prose) => extractSceneLedgerUpdates(buildInitialLedger(), prose, { required_events: [] }).deadCharacters;

// ── Pronouns and quantifiers are not names ──────────────────────────────────
check('"He died" does not create a character named He', !dead('He died in the accident, three years before she came here.').includes('He'));
check('"He was killed" does not create a character named He', !dead('He was killed when the pressure valve blew.').includes('He'));
check('"She died" does not create a character named She', !dead('She died before the rescue team arrived.').includes('She'));
check('"They died" does not create a character named They', !dead('They died down there and no one went back.').includes('They'));
check('"Everyone died" does not create a character named Everyone', !dead('Everyone died that night.').includes('Everyone'));
check('"Nobody died" does not create a character named Nobody', !dead('Nobody died, she told herself.').includes('Nobody'));
check('"Someone died" does not create a character named Someone', !dead('Someone died for that mistake.').includes('Someone'));
check('"That died" does not create a character named That', !dead('That died with him.').includes('That'));

// ── Real names still register ───────────────────────────────────────────────
check('a real name is still recorded', dead('Reed died in the accident.').includes('Reed'));
check('a real name with "was killed" is still recorded', dead('Ortiz was killed when the bulkhead gave.').includes('Ortiz'));
check('a real name with "is dead" is still recorded', dead('Marcus is dead and the log proves it.').includes('Marcus'));
check('only the real name is recorded from mixed prose',
  JSON.stringify(dead('He died in the accident. Reed died beside him.')) === JSON.stringify(['Reed']));

// ── The gate no longer rejects ordinary prose ───────────────────────────────
const poisoned = extractSceneLedgerUpdates(buildInitialLedger(), 'He died in the accident, three years before she came here.', { required_events: [] });
const ordinary = 'He said nothing. He looked at the door and turned away. Marcus nodded slowly.';
const audit = auditSceneAgainstLedger({ prose: ordinary, accumulatedProse: '', spec: { required_events: [] }, runtimeLedger: poisoned });
check('ordinary prose is not flagged as a dead character acting',
  !(audit.issues || []).some((i) => i.code === 'DEAD_CHARACTER_ACTION'));

// ── A genuinely dead character still cannot act ─────────────────────────────
const realDead = extractSceneLedgerUpdates(buildInitialLedger(), 'Reed died in the accident.', { required_events: [] });
const reedActs = auditSceneAgainstLedger({ prose: 'Reed nodded and walked to the console.', accumulatedProse: '', spec: { required_events: [] }, runtimeLedger: realDead });
check('a genuinely dead character acting IS still flagged',
  (reedActs.issues || []).some((i) => i.code === 'DEAD_CHARACTER_ACTION'));

check('multiple real deaths in one string are all recorded',
  JSON.stringify(dead('Reed died in the accident. Ortiz was killed the same night.')) === JSON.stringify(['Reed', 'Ortiz']));

console.log('\nDEAD CHARACTER LEDGER (LEDGERFIX-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
