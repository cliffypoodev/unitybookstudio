// PRONOUNVAR-1 acceptance battery — context-variable (genderfluid) pronouns.
//
// The external audit of REDUX v3 (75/100): "Solveig's pronouns/state still drift
// … he/his throughout that scene … elsewhere she/her … elsewhere they/them.
// If intentional, the story bible could declare Solveig pronouns = context-
// variable with a per-scene value." Cliff chose context-variable.
//
// The rule that makes that shippable: Solveig may present as a different gender in
// DIFFERENT scenes (intentional), but WITHIN one scene the pronouns must be
// uniform. This battery covers: declaration parsing, canon exclusion (a
// variable character is neither fixed-canon nor an "unresolved" warning), the
// within-scene drift detector (mix inside one scene = flag; change across
// scenes = clean), and the deterministic heal (flip the minority to the
// scene's majority, only in that character's own sentences, separators and
// everyone else untouched, a tie left alone).
import fs from 'node:fs';
import {
  parseDeclaredPronouns,
  buildPronounCanon,
  scanContextVariablePronounDrift,
  healContextVariablePronounScenes,
  PRONOUN_LOCK_VERSION,
} from '../src/lib/pronounLock.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };
const NAMES = ['Solveig', 'Ottie', 'Yusra', 'Ludo'];
const BIBLE = "### Major Characters\n\n**5. Solveig**\n\n- **Role:** The crew's disguise artist.\n- **Pronouns:** context-variable (presentation changes by scene)\n\n**6. Yusra**\n\n- **Pronouns:** she/her\n\n**7. Ludo**\n\n- **Pronouns:** he/him";

// ── 1. declaration ──
const declared = parseDeclaredPronouns(BIBLE);
check('1. "Pronouns: context-variable" parses to variable (through markdown bold)', declared.Solveig === 'variable');
check('2. a normal set still parses ("Yusra she/her", "Ludo he/him")', declared.Yusra === 'she' && declared.Ludo === 'he');
check('3. "genderfluid" is also recognized', parseDeclaredPronouns("### Solveig\n\n- Genderfluid disguise artist.").Solveig === 'variable');

// ── 2. canon exclusion ──
const canon = buildPronounCanon({ characters_md: BIBLE }, [], NAMES);
check('4. a variable character is NOT in the fixed canon', canon.canon.Solveig === undefined);
check('5. a variable character IS in the variable list', canon.variable.includes('Solveig'));
check('6. a variable character is NOT an "unresolved" warning', !canon.unresolved.some((u) => u.name === 'Solveig'));
check('7. fixed characters still get canon', canon.canon.Yusra === 'she' && canon.canon.Ludo === 'he');

// ── 3. within-scene drift ──
const mixedScene = 'Solveig adjusted the collar. Her fingers were quick. Solveig smoothed the lapels. Her posture shifted. Solveig met his own eyes in the glass.\n\n* * *\n\nSolveig stepped onto the stage. He owned it. Solveig tipped his hat.';
const drift = scanContextVariablePronounDrift(mixedScene, ['Solveig'], NAMES);
check('8. mixing he and she for a variable character WITHIN one scene is flagged', drift.length === 1 && drift[0].name === 'Solveig' && drift[0].sceneIndex === 0);
check('9. a DIFFERENT presentation in a different scene is NOT flagged', !drift.some((d) => d.sceneIndex === 1));
const cleanBothWays = 'Solveig walked in as a woman. She owned the room. Her heels clicked.\n\n* * *\n\nSolveig walked in as a man. He owned the room. His boots thudded.';
check('10. cross-scene variation with each scene internally consistent is clean', scanContextVariablePronounDrift(cleanBothWays, ['Solveig'], NAMES).length === 0);
check('11. a pronoun bound across sentences is attributed ("Solveig adjusted the wig. His hands…")', scanContextVariablePronounDrift('Solveig adjusted the wig. His hands were steady. Solveig smiled, and her reflection smiled back.', ['Solveig'], NAMES).length === 1);

// ── 4. heal ──
const h = healContextVariablePronounScenes(mixedScene, 'Solveig', NAMES);
check('12. the heal flips the minority to the scene majority (his→her; scene was she-majority)', h.text.includes('Solveig met her own eyes in the glass.') && h.healed[0].to === 'she' && h.healed[0].from === 'he');
check('13. after the heal, no within-scene drift remains', scanContextVariablePronounDrift(h.text, ['Solveig'], NAMES).length === 0);
check('14. the OTHER scene is byte-identical (cross-scene variation preserved)', h.text.split('* * *')[1].includes('Solveig stepped onto the stage. He owned it. Solveig tipped his hat.'));
check('15. scene-break separators are preserved byte-for-byte', h.text.includes('\n\n* * *\n\n'));
check('16. a tie is left alone (no guess)', (() => { const r = healContextVariablePronounScenes('Solveig checked the mirror. His jaw was set. Solveig turned, and her eyes were bright.', 'Solveig', NAMES); return r.healed.length === 0; })());
check('17. a pronoun bound to ANOTHER character is never touched', (() => {
  // Ludo (he) is the sole subject of the 2nd sentence; Solveig's scene majority is she.
  const t = 'Solveig fixed her makeup. Ludo grunted. He crossed his arms. Solveig laughed, and her smile was wide. Solveig caught his eye in the mirror.';
  const r = healContextVariablePronounScenes(t, 'Solveig', NAMES);
  return r.text.includes('Ludo grunted. He crossed his arms.'); // Ludo untouched
})());

// ── 5. wiring ──
check('18. version bumped', PRONOUN_LOCK_VERSION === 'pronoun-lock-v4');
const GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
check('19. export gate reports within-scene drift as a warning', GATE.includes('scanContextVariablePronounDrift(body, pronounCanon.variable, castNames)') && GATE.includes('PRONOUNVAR-1:') && !/hardFailures\.push\([^)]*PRONOUNVAR/s.test(GATE));
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('20. the writer prompt tells it to hold one presentation per scene', WRITER.includes('pronoun_variable: pronounVariableLine') && WRITER.includes('CONTEXT-VARIABLE PRONOUNS'));
const RUNNER = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url), 'utf8');
check('21. Fix Manuscript heals within-scene drift with a structure guard', RUNNER.includes('healContextVariablePronounScenes(String(f.content') && RUNNER.includes("verifyInvariant('Context-Variable Pronoun Heal')") && RUNNER.includes('pronounVarFlips'));

// ── 6. it/its declaration (PRONOUNLOCK-2B-IT-ITS-DECLARATION) ──
// A non-human cast member (a ship AI, a robot, an animal) declared "it/its"
// must be parsed as canon, not ignored and inferred from prose (live REDUX
// defect: a declared it/its cast member was inferred as she/her instead).
const AI_BIBLE = "### Major Characters\n\n**8. Vex**\n\n- **Role:** The ship's AI voice.\n- **Pronouns:** it/its.\n\n**9. Ilse**\n\n- **Pronouns:** she/her";
const aiDeclared = parseDeclaredPronouns(AI_BIBLE);
check('22. "Pronouns: it/its" parses to it (non-human cast member)', aiDeclared.Vex === 'it');
const aiCanon = buildPronounCanon({ characters_md: AI_BIBLE }, [], ['Vex', 'Ilse']);
check('23. an it/its declaration reaches canon as fixed "it", not inferred from prose', aiCanon.canon.Vex === 'it');

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
