// PRONOUNVAR-2 acceptance battery — closed-world attribution for context-
// variable pronouns, built from the REAL prose the PRONOUNVAR-1 heal would have
// corrupted (external audit of REDUX v3).
//
// PRONOUNVAR-1 counted EVERY pronoun after a name toward that name and chained
// bound follow-ons loosely. On real scenes that absorbed THIRD PARTIES into the
// context-variable character (Solveig) and the heal flipped them:
//   Ch8  "He lowered his price by half"        → the vendor, not Solveig
//   Ch8  "Solveig handed him the bird / watched him go" → the boy (object pronoun)
//   Ch8  "He knelt beside Solveig, his large hands"     → Solveig is the OBJECT here
//   Ch13 "the man agreed. He leaned … his elbows"    → the man at the counter
//   Ch15 "… Solveig salvaged," he said, his voice …"    → another speaker
//
// The dry run wanted 30 flips across Ch8/13/15 — every one wrong. PRONOUNVAR-2
// attributes a pronoun to a character ONLY as a POSSESSIVE/REFLEXIVE bound to
// that character as SUBJECT, within a span that stops at the first new human
// referent (another name, a person-common-noun, or an object pronoun). Bare
// subjective he/she and object him/her are never counted or flipped. Genuine
// within-scene drift (both genders bound to the character as subject) still
// flags and heals; cross-scene variation is never touched.
import fs from 'node:fs';
import {
  scanContextVariablePronounDrift,
  healContextVariablePronounScenes,
  PRONOUN_LOCK_VERSION,
} from '../src/lib/pronounLock.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };
const CAST = ['Solveig', 'Ottie', 'Yusra', 'Ludo', 'Idris', 'JB'];
const flips = (r) => r.healed.reduce((s, h) => s + h.count, 0);

// ── real REDUX fixtures the old heal corrupted ──
const F_VENDOR = 'Solveig nodded and drifted toward the vendor, a man with a mustache so thick it looked like a caterpillar was nesting on his upper lip. She said something to the vendor. The man laughed and shook his head. Solveig pointed at the wrench, then at her own boot. The vendor’s eyes narrowed. He lowered his price by half. Solveig raised an eyebrow, tapped her wrist.';
const F_BOY = 'He held out a mechanical toy. He tapped the bird’s chest. He knelt beside Solveig, his large hands cupping the metal. Solveig handed him the bird. He looked up at Solveig, his eyes shining. Solveig watched him go.';
const F_MAN = '“Layers,” the man agreed. He leaned on the counter, his elbows pressing into the wood. Solveig adjusted the collar of her flannel shirt. He reached out and poked Solveig’s arm. He frowned.';
const F_TAG = '“The big one is inside the toaster part Solveig salvaged,” he said, his voice high and thin. “Kick it,” Solveig suggested from her perch.';

// 1–2. vendor scene: Solveig is she-only (her boot, her wrist); every "his" is the vendor
const vh = healContextVariablePronounScenes(F_VENDOR, 'Solveig', CAST);
check('1. vendor scene: heal makes ZERO flips (vendor pronouns never touched)', flips(vh) === 0 && vh.text === F_VENDOR);
check('2. vendor scene: scanner reports no Solveig drift', scanContextVariablePronounDrift(F_VENDOR, ['Solveig'], CAST).length === 0);

// 3–4. boy scene: object "him" + boy possessives inside Solveig-naming sentences
const bh = healContextVariablePronounScenes(F_BOY, 'Solveig', CAST);
check('3. boy scene: heal ZERO flips; object "him" and the boy’s "his" untouched', flips(bh) === 0 && bh.text === F_BOY);
check('4. boy scene: "Solveig handed him the bird" and "his large hands" survive verbatim', bh.text.includes('Solveig handed him the bird.') && bh.text.includes('his large hands cupping'));
check('5. boy scene: scanner reports no Solveig drift', scanContextVariablePronounDrift(F_BOY, ['Solveig'], CAST).length === 0);

// 6–7. man at the counter (person-noun breaks the chain) + Solveig object
const mh = healContextVariablePronounScenes(F_MAN, 'Solveig', CAST);
check('6. counter scene: heal ZERO flips; "He leaned … his elbows" is the man, untouched', flips(mh) === 0 && mh.text.includes('He leaned on the counter, his elbows'));
check('7. counter scene: Solveig’s own "her flannel shirt" is present and scanner sees no drift', mh.text.includes('her flannel shirt') && scanContextVariablePronounDrift(F_MAN, ['Solveig'], CAST).length === 0);

// 8. dialogue tag for another speaker (Solveig only inside a relative clause)
const th = healContextVariablePronounScenes(F_TAG, 'Solveig', CAST);
check('8. dialogue-tag scene: heal ZERO flips; "he said, his voice high and thin" untouched', flips(th) === 0 && th.text.includes('he said, his voice high and thin'));

// 9. object pronoun introduces a referent a possessive binds to
const ADV = 'Solveig fixed her hair. Her collar gleamed. Solveig grabbed him by his collar and shoved.';
const ah = healContextVariablePronounScenes(ADV, 'Solveig', CAST);
check('9. "grabbed him by his collar": object cutoff → ZERO flips, text unchanged', flips(ah) === 0 && ah.text === ADV);

// 10. name-as-object sentence alone is never attributed
const OBJONLY = 'He knelt beside Solveig, his large hands steady.';
check('10. name-in-object-position sentence: no drift, no attribution', scanContextVariablePronounDrift(OBJONLY, ['Solveig'], CAST).length === 0 && healContextVariablePronounScenes(OBJONLY, 'Solveig', CAST).text === OBJONLY);

// 11. subjective-initial follow-on breaks the chain (does NOT bind to Solveig)
const SUBJFOLLOW = 'Solveig stepped onto the stage. He owned the crowd. Solveig tipped her hat.';
check('11. subjective-initial "He owned the crowd" is NOT counted as Solveig', scanContextVariablePronounDrift(SUBJFOLLOW, ['Solveig'], CAST).length === 0 && flips(healContextVariablePronounScenes(SUBJFOLLOW, 'Solveig', CAST)) === 0);

// 12. person-noun cutoff inside a name-subject sentence
const PNCUT = 'Solveig met the vendor, his face grim, and paid her tab.';
check('12. person-noun cutoff: "his face" (the vendor’s) not counted; Solveig she-only', scanContextVariablePronounDrift(PNCUT, ['Solveig'], CAST).length === 0);

// ── genuine drift STILL detected and healed (no over-correction into inaction) ──
const REAL = 'Solveig adjusted the collar. Her fingers were quick. Solveig smoothed the lapels. Her posture shifted. Solveig met his own eyes in the glass.';
const rd = scanContextVariablePronounDrift(REAL, ['Solveig'], CAST);
check('13. GENUINE within-scene drift (her ×2, his own eyes) is still flagged', rd.length === 1 && rd[0].name === 'Solveig');
const rh = healContextVariablePronounScenes(REAL, 'Solveig', CAST);
check('14. GENUINE drift heals minority→majority: "Solveig met her own eyes"', rh.text.includes('Solveig met her own eyes in the glass.') && flips(rh) === 1 && rh.healed[0].from === 'he' && rh.healed[0].to === 'she');

// 15. possessive-initial bound follow-on IS attributed
const POSSFOLLOW = 'Solveig adjusted the wig. His hands were steady. Solveig smiled, and her reflection smiled back.';
check('15. possessive-initial "His hands were steady" binds to Solveig (drift flagged)', scanContextVariablePronounDrift(POSSFOLLOW, ['Solveig'], CAST).length === 1);

// 16–17. cross-scene variation is intentional — never flagged, never healed
const CROSS = 'Solveig walked in as a woman. Her heels clicked.\n\n* * *\n\nSolveig walked in as a man. His boots thudded.';
check('16. cross-scene he↔she (each scene internally consistent) is clean', scanContextVariablePronounDrift(CROSS, ['Solveig'], CAST).length === 0);
check('17. cross-scene text is left byte-identical by the heal', healContextVariablePronounScenes(CROSS, 'Solveig', CAST).text === CROSS);

// 18. a real heal never touches another character in the same scene
const MIXED = 'Solveig fixed her makeup. Her collar gleamed. Solveig met his own reflection. Ludo scowled. His fists clenched.';
const mx = healContextVariablePronounScenes(MIXED, 'Solveig', CAST);
check('18. heal flips Solveig’s "his own reflection"→"her" but leaves Ludo’s "His fists" alone',
  mx.text.includes('Solveig met her own reflection.') && mx.text.includes('Ludo scowled. His fists clenched.'));

// 19. version bumped
check('19. version is pronoun-lock-v4 (bumped by PRONOUNLOCK-2)', PRONOUN_LOCK_VERSION === 'pronoun-lock-v4');

// 20. export-gate wiring intact (scanner still feeds a within-scene WARNING, never a hard block)
const GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
check('20. export gate still calls the scanner as a warning', GATE.includes('scanContextVariablePronounDrift(body, pronounCanon.variable, castNames)') && GATE.includes('PRONOUNVAR-1:') && !/hardFailures\.push\([^)]*PRONOUNVAR/s.test(GATE));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
