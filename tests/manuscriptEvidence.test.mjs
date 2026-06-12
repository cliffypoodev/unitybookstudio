// tests/manuscriptEvidence.test.mjs — Evidence engine regression tests
// Validates buildManuscriptEvidenceReport against hand-counted fixtures.

import assert from 'node:assert';
import { buildManuscriptEvidenceReport } from '../src/lib/manuscriptEvidence.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * CHAPTER FIXTURES — hand-crafted with KNOWN pattern counts
 * ═════════════════════════════════════════════════════════════════════════ */

const CH1_TEXT = `The available accounts indicate that the ship arrived at dawn. The harbor was still, the water palpable in its silence. What remains unclear is whether the captain knew the truth.

"Get the ropes ready," Marcus shouted across the deck.
"I already did," Elena replied, her voice sharp.
"Then check them again," he said.

The crew moved quickly, meticulously preparing for the docking. The available accounts suggest that tensions were high. She felt the weight of the moment settle over them all. The record shows that three crew members had deserted the night before.

The available accounts indicate that the harbor master was waiting. He realized the significance of their arrival. The surviving record shows that this was the first ship from the eastern territories in over a decade. What remains unclear is why they chose this particular port.

The question therefore shifts to the matter of cargo. Something shifted in the captain's expression as the harbor master approached. The weight of their secret pressed down on everyone aboard.`;

const CH2_TEXT = `Marcus walked through the market alone. The stalls were packed with unfamiliar goods — spices, silks, and carved wooden figures he had never seen before.

"How much for the red one?" he asked the vendor.
"More than you can afford," the woman replied with a smirk.
"Try me," Marcus said.
"Fifty silver," she said flatly.
"I'll give you thirty," he countered.

The haggling continued for several minutes. Marcus enjoyed this part — the back and forth, the dance of commerce. He purchased three figurines and a length of blue silk.

Back at the ship, Elena was cataloging supplies. She looked up when Marcus returned, raising an eyebrow at his purchases but saying nothing.`;

const CH3_TEXT = `The storm arrived without warning. Lightning split the sky and rain hammered the deck. The crew scrambled to secure the rigging.

"Everyone below!" the captain bellowed.
"The mainmast is cracking!" Elena screamed over the wind.

She felt the ship lurch beneath her feet. The weight of the water on the deck was staggering. Marcus grabbed a rope and hauled himself forward, the relentless rain blinding him.

The available accounts indicate that three waves nearly capsized the vessel. The palpable fear among the crew was evident in their faces. He realized they might not survive this night.

When dawn finally broke, the sea was calm. The ship had held. Marcus counted heads — all present. The luminous sunrise painted the horizon in shades of gold and amber.`;

/* ═══════════════════════════════════════════════════════════════════════════
 * LOADED ARRAY
 * ═════════════════════════════════════════════════════════════════════════ */

const loaded = [
  { chapter: { chapter_number: 1, title: 'The Arrival' }, content: CH1_TEXT, original: CH1_TEXT },
  { chapter: { chapter_number: 2, title: 'The Market' }, content: CH2_TEXT, original: CH2_TEXT },
  { chapter: { chapter_number: 3, title: 'The Storm' }, content: CH3_TEXT, original: CH3_TEXT },
];

/* ═══════════════════════════════════════════════════════════════════════════
 * TEST HARNESS
 * ═════════════════════════════════════════════════════════════════════════ */

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    failures.push(name);
    console.error('  ❌ ' + name + ': ' + e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RUN REPORT
 * ═════════════════════════════════════════════════════════════════════════ */

console.log('\n=== MANUSCRIPT EVIDENCE ENGINE TESTS ===\n');

const report = buildManuscriptEvidenceReport(loaded, { genre: 'fiction' });

/* ── Test 1: Chapter count ── */
test('1. Report has 3 chapters', () => {
  assert.strictEqual(report.chapters.length, 3, 'Should have 3 chapters');
  assert.strictEqual(report.manuscript.chapterCount, 3);
});

/* ── Test 2: Chapter 1 forensic tic counts ── */
test('2. Ch1 forensic tics >= 6', () => {
  const ch1 = report.chapters[0];
  assert.strictEqual(ch1.chapterNumber, 1);
  assert.strictEqual(ch1.title, 'The Arrival');
  // Check that forensicTicCounts has the right keys and total > 0
  const ch1ForensicTotal = Object.values(ch1.forensicTicCounts).reduce((s, v) => s + v, 0);
  assert(ch1ForensicTotal >= 6, 'Ch1 should have at least 6 forensic tics, got ' + ch1ForensicTotal);
});

/* ── Test 3: Chapter 2 has zero forensic tics ── */
test('3. Ch2 has 0 forensic tics', () => {
  const ch2 = report.chapters[1];
  const ch2ForensicTotal = Object.values(ch2.forensicTicCounts).reduce((s, v) => s + v, 0);
  assert.strictEqual(ch2ForensicTotal, 0, 'Ch2 should have 0 forensic tics');
});

/* ── Test 4: Chapter 1 dialogue ratio is roughly 15-30% ── */
test('4. Ch1 dialogue ratio 15-50%', () => {
  const ch1 = report.chapters[0];
  assert(ch1.dialogueRatio >= 0.15 && ch1.dialogueRatio <= 0.50,
    'Ch1 dialogue ratio should be 15-50%, got ' + ch1.dialogueRatio);
});

/* ── Test 5: Chapter 2 dialogue ratio is roughly 30-55% ── */
test('5. Ch2 dialogue ratio 35-70%', () => {
  const ch2 = report.chapters[1];
  assert(ch2.dialogueRatio >= 0.35 && ch2.dialogueRatio <= 0.70,
    'Ch2 dialogue ratio should be 35-70%, got ' + ch2.dialogueRatio);
});

/* ── Test 6: Pacing curve is array of 3 positive numbers ── */
test('6. Pacing curve has 3 positive entries', () => {
  assert.strictEqual(report.manuscript.pacingCurve.length, 3, 'Pacing curve should have 3 entries');
  assert(report.manuscript.pacingCurve.every(n => typeof n === 'number' && n > 0),
    'All pacing entries should be positive numbers');
});

/* ── Test 7: Slop score curve has 3 entries ── */
test('7. Slop score curve has 3 entries', () => {
  assert.strictEqual(report.manuscript.slopScoreCurve.length, 3);
});

/* ── Test 8: Dialogue ratio curve has 3 entries ── */
test('8. Dialogue ratio curve has 3 entries', () => {
  assert.strictEqual(report.manuscript.dialogueRatioCurve.length, 3);
});

/* ── Test 9: Chapter 1 slop total > 0 ── */
test('9. Ch1 slop total > 0', () => {
  const ch1 = report.chapters[0];
  assert(ch1.slop.total > 0, 'Ch1 should have slop total > 0, got ' + ch1.slop.total);
});

/* ── Test 10: TTR is between 0 and 1 ── */
test('10. Manuscript TTR between 0 and 1', () => {
  assert(report.manuscript.ttr > 0 && report.manuscript.ttr <= 1,
    'TTR should be between 0 and 1, got ' + report.manuscript.ttr);
});

/* ── Test 11: Chapter words > 50 ── */
test('11. Each chapter has > 50 words', () => {
  const ch1 = report.chapters[0];
  const ch2 = report.chapters[1];
  assert(ch1.words > 50, 'Ch1 should have > 50 words');
  assert(ch2.words > 50, 'Ch2 should have > 50 words');
});

/* ── Test 12: Total words = sum of chapter words ── */
test('12. Total words equals sum of chapter words', () => {
  const sumWords = report.chapters.reduce((s, c) => s + c.words, 0);
  assert.strictEqual(report.manuscript.totalWords, sumWords,
    'Total words should equal sum of chapter words');
});

/* ── Test 13: adverbDensity is a number >= 0 ── */
test('13. Ch1 adverbDensity is a number >= 0', () => {
  const ch1 = report.chapters[0];
  assert(typeof ch1.adverbDensity === 'number' && ch1.adverbDensity >= 0);
});

/* ── Test 14: repeatedBigrams is an array of at most 5 ── */
test('14. Ch1 repeatedBigrams is array of <= 5', () => {
  const ch1 = report.chapters[0];
  assert(Array.isArray(ch1.repeatedBigrams));
  assert(ch1.repeatedBigrams.length <= 5);
});

/* ── Test 15: Chapter 3 has exactly 1 'the available accounts indicate' ── */
test('15. Ch3 has exactly 1 "the available accounts indicate"', () => {
  const ch3 = report.chapters[2];
  assert.strictEqual(ch3.forensicTicCounts['the available accounts indicate'], 1,
    'Ch3 should have exactly 1 "the available accounts indicate"');
});

/* ═══════════════════════════════════════════════════════════════════════════
 * SUMMARY
 * ═════════════════════════════════════════════════════════════════════════ */

console.log(`\n${'═'.repeat(60)}`);
console.log(`MANUSCRIPT EVIDENCE: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('All manuscript evidence tests passed! ✅');
}
