import { analyzeProse } from '../src/lib/proseGrammarGate.js';
import { DROPPED_WORD_RX, stripDroppedWordSentences } from '../src/lib/nfContentGuard.js';

let failures = 0;
function check(name, pass) {
  if (pass) {
    console.log(`PASS ${name}`);
  } else {
    console.log(`FAIL ${name}`);
    failures++;
  }
}

async function runTest() {
  // 1
  const c1 = "The tank's exterior appearance remained imposing, a to industrial might, while workers watched.";
  check('1. "a to industrial": RX matches', DROPPED_WORD_RX.test(c1));
  const t1 = await analyzeProse(c1);
  check('1. "a to industrial": PROSEGATE hard', t1.hard.length > 0 && t1.hard.some(m => m.rule.includes('dropped-noun')));

  // 2
  const c2 = "It was a to the sheer physical effort.";
  check('2. "a to the": RX matches', DROPPED_WORD_RX.test(c2));

  // 3
  const c3 = "Here is a to-do list for the team.";
  check('3. "a to-do list": NO match', !DROPPED_WORD_RX.test(c3));

  // 4
  const c4 = "Type an at sign before the name.";
  check('4. "an at sign": NO match', !DROPPED_WORD_RX.test(c4));
  const t4 = await analyzeProse(c4);
  check('4. "an at sign": PROSEGATE zero hard', t4.hard.length === 0);

  // 5
  const c5 = "He earned a living from the sea.";
  check('5. "a living": NO match', !DROPPED_WORD_RX.test(c5));
  const t5 = await analyzeProse(c5);
  check('5. "a living": PROSEGATE zero hard', t5.hard.length === 0);

  // 6
  const c6 = "Let's take a trip to the store.";
  check('6. "a trip to the": NO match', !DROPPED_WORD_RX.test(c6));

  // 7
  const c7 = "This is fine. The tank's exterior appearance remained imposing, a to industrial might, while workers watched. This is also fine.";
  const res7 = stripDroppedWordSentences(c7);
  check('7. stripDroppedWordSentences: stripped exactly the sentence', res7.text.trim() === "This is fine. This is also fine." && res7.removed.length === 1);

  if (failures === 0) {
    console.log('ACCEPTANCE: ALL CHECKS MATCHED');
  }
  process.exit(failures === 0 ? 0 : 1);
}

runTest();
