// PRONOUNLOCK-2 acceptance battery — scanPronounViolations gets the same
// closed-world attribution guard PRONOUNVAR-2 already applies to context-
// variable characters: a pronoun-counting span is cut at the first OTHER
// cast name or unnamed-person reference, so a third party's pronoun is
// never absorbed into a gendered-canon character's tally. Fixtures use
// invented generic names (Mara, Dov, Ilse), never a real book's cast.
import { scanPronounViolations, PRONOUN_LOCK_VERSION } from '../src/lib/pronounLock.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// 1. version
check('1. version bumped to pronoun-lock-v4', PRONOUN_LOCK_VERSION === 'pronoun-lock-v4');

// ── PRONOUNVAR-2 third-party cases produce 0 violations ──

// 2. an unnamed person introduced mid-sentence does not absorb into the named character
check('2. unnamed vendor: "He nodded" not attributed to Mara',
  scanPronounViolations('Mara spoke to the vendor. He nodded and walked away.', { Mara: 'she' }, ['Mara']).length === 0);

// 3. an appositive third party ("a man ...") breaks the chain
check('3. appositive third party breaks the chain',
  scanPronounViolations('Mara turned toward the stranger, a man with a torn coat. His upper lip twitched.', { Mara: 'she' }, ['Mara']).length === 0);

// 4. object pronoun for a NAMED other character in the same sentence is already excluded (regression, unchanged behavior)
check('4. two-name sentence stays unattributable',
  scanPronounViolations('Mara handed Dov the wrench and he smiled.', { Mara: 'she' }, ['Mara', 'Dov']).length === 0);

// 5. a person-noun in the tail also blocks the next-sentence extension
check('5. person-noun in the tail blocks next-sentence extension',
  scanPronounViolations('Mara nodded at the stranger nearby. He walked off without a word.', { Mara: 'she' }, ['Mara']).length === 0);

// ── a real within-scene flip still flags ──

// 6. opposite-gender bare pronoun in the next sentence still flags
check('6. opposite-gender pronoun after a sole-name sentence still flags',
  scanPronounViolations('Mara sealed the hatch. He pulled the lever twice.', { Mara: 'she' }, ['Mara']).length === 1);

// 7. they-canon still flags a gendered pronoun
check('7. they-canon flags a gendered pronoun',
  scanPronounViolations('Ilse checked the charts. He nodded slowly.', { Ilse: 'they' }, ['Ilse']).length === 1);

// 8. plural "they" after a gendered-canon name is still not flagged
check('8. plural they is not flagged for gendered canon',
  scanPronounViolations('Mara waved at the crew. They waved back at her.', { Mara: 'she' }, ['Mara']).length === 0);

// 9. same-sentence opposite-gender possessive still flags
check('9. same-sentence opposite-gender possessive still flags',
  scanPronounViolations('Mara gripped his own coat tighter against the wind.', { Mara: 'she' }, ['Mara']).length === 1);

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
