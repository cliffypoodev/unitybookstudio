// tests/bannedVocabRecastNotDelete.test.mjs
// Verifies the 33 banned vocabulary words are RECAST (not deleted) by recastBannedVocabulary()

import { recastBannedVocabulary } from '../src/lib/aiSlopReduction.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.error(`  ❌ FAIL: ${label}`);
  }
}

console.log('\n=== BANNED VOCABULARY RECAST (NOT DELETE) TESTS ===\n');

// Full list of 33 banned words
const BANNED_WORDS = [
  'shimmering', 'luminous', 'tapestry', 'intricate', 'meticulously',
  'insatiable', 'palpable', 'unmistakable', 'undeniable', 'relentless',
  'sprawling', 'labyrinthine', 'opulent', 'resplendent', 'ethereal',
  'visceral', 'cacophony', 'crescendo', 'juxtaposition', 'myriad',
  'plethora', 'testament', 'harbinger', 'paradigm', 'dichotomy',
  'multifaceted', 'aforementioned', 'nonetheless', 'furthermore',
  'henceforth', 'commence', 'utilize', 'endeavor', 'pertaining',
];

// ── TEST 1: Every banned word gets recast to a NON-EMPTY synonym ──
console.log('── Test 1: Every banned word recast to non-empty synonym ──');
for (const word of BANNED_WORDS) {
  const sentence = `The ${word} thing was noticed by everyone.`;
  const result = recastBannedVocabulary(sentence);

  // Should have exactly 1 recast
  const wordRecasts = result.recasts.filter(r => r.word === word);
  assert(`1. "${word}" produces a recast`, wordRecasts.length === 1);

  // Replacement must be non-empty
  if (wordRecasts.length > 0) {
    assert(`1. "${word}" replacement is non-empty`, wordRecasts[0].replacement.length > 0);
    assert(`1. "${word}" replacement differs from original`, wordRecasts[0].replacement.toLowerCase() !== word);
  }

  // The output text must not contain the banned word
  const outputLower = result.text.toLowerCase();
  assert(`1. "${word}" no longer in output`, !outputLower.includes(word));
}

// ── TEST 2: Recast preserves sentence grammar (output is valid sentence) ──
console.log('\n── Test 2: Recast preserves sentence grammar ──');
{
  const testSentences = [
    { word: 'shimmering', sentence: 'The shimmering lights danced across the water.' },
    { word: 'luminous',   sentence: 'A luminous glow filled the room.' },
    { word: 'tapestry',   sentence: 'The tapestry of life unfolded before them.' },
    { word: 'intricate',  sentence: 'She wore an intricate pattern on her dress.' },
    { word: 'meticulously', sentence: 'He meticulously checked every detail.' },
    { word: 'commence',   sentence: 'Let us commence the ceremony now.' },
    { word: 'utilize',    sentence: 'We should utilize every resource available.' },
    { word: 'endeavor',   sentence: 'This endeavor will take years to complete.' },
    { word: 'pertaining', sentence: 'Documents pertaining to the case were sealed.' },
    { word: 'palpable',   sentence: 'The tension was palpable in every corner.' },
  ];

  for (const { word, sentence } of testSentences) {
    const result = recastBannedVocabulary(sentence);
    // Output should have roughly the same word count (±2)
    const origWords = sentence.split(/\s+/).length;
    const outWords = result.text.split(/\s+/).length;
    assert(`2. "${word}" grammar preserved (word count ${origWords} → ${outWords})`, Math.abs(origWords - outWords) <= 2);

    // Output should end with proper punctuation
    const trimmed = result.text.trim();
    assert(`2. "${word}" sentence ends with punctuation`, /[.!?]$/.test(trimmed));

    // Output should start with a capital letter
    assert(`2. "${word}" sentence starts capitalised`, /^[A-Z]/.test(trimmed));
  }
}

// ── TEST 3: Multiple occurrences get VARIED synonyms (not all the same) ──
console.log('\n── Test 3: Multiple occurrences get varied synonyms ──');
{
  const wordsToTest = ['shimmering', 'luminous', 'palpable', 'intricate', 'commence', 'utilize'];

  for (const word of wordsToTest) {
    // Build text with 4 occurrences
    const text = `The ${word} thing. Another ${word} item. A third ${word} object. The fourth ${word} piece.`;
    const result = recastBannedVocabulary(text);
    const wordRecasts = result.recasts.filter(r => r.word === word);

    assert(`3. "${word}" has 4 recasts`, wordRecasts.length === 4);

    // Check that not all replacements are identical
    const uniqueReplacements = new Set(wordRecasts.map(r => r.replacement.toLowerCase()));
    assert(`3. "${word}" has varied synonyms (${uniqueReplacements.size} unique)`, uniqueReplacements.size >= 2);
  }
}

// ── TEST 4: Handles capitalised versions correctly ──
console.log('\n── Test 4: Capitalised versions handled correctly ──');
{
  // Title case (start of sentence)
  const sentence1 = 'Shimmering waves crashed on the shore.';
  const result1 = recastBannedVocabulary(sentence1);
  const recast1 = result1.recasts.find(r => r.word === 'shimmering');
  assert('4a. Title-case "Shimmering" recast found', !!recast1);
  if (recast1) {
    assert('4a. Title-case replacement starts uppercase', /^[A-Z]/.test(recast1.replacement));
    assert('4a. Title-case replacement is non-empty', recast1.replacement.length > 0);
  }

  // Lowercase
  const sentence2 = 'The shimmering glow faded away.';
  const result2 = recastBannedVocabulary(sentence2);
  const recast2 = result2.recasts.find(r => r.word === 'shimmering');
  assert('4b. Lowercase "shimmering" recast found', !!recast2);
  if (recast2) {
    assert('4b. Lowercase replacement starts lowercase', /^[a-z]/.test(recast2.replacement));
  }

  // ALL CAPS
  const sentence3 = 'The SHIMMERING light was blinding.';
  const result3 = recastBannedVocabulary(sentence3);
  const recast3 = result3.recasts.find(r => r.word === 'shimmering');
  assert('4c. ALL CAPS "SHIMMERING" recast found', !!recast3);
  if (recast3) {
    assert('4c. ALL CAPS replacement is uppercase', recast3.replacement === recast3.replacement.toUpperCase());
  }

  // Mixed case words
  const sentence4 = 'Commence the operation. We will commence soon. Commence!';
  const result4 = recastBannedVocabulary(sentence4);
  const commRecasts = result4.recasts.filter(r => r.word === 'commence');
  assert('4d. Multiple capitalised "Commence" recasts', commRecasts.length === 3);
  // First one should be title case
  assert('4d. First "Commence" is title-cased', /^[A-Z]/.test(commRecasts[0].replacement));
}

// ── TEST 5: Empty/null input handled gracefully ──
console.log('\n── Test 5: Edge cases ──');
{
  const empty = recastBannedVocabulary('');
  assert('5a. Empty string returns empty text', empty.text === '');
  assert('5a. Empty string returns no recasts', empty.recasts.length === 0);

  const noSlop = recastBannedVocabulary('The cat sat on the mat.');
  assert('5b. Clean text unchanged', noSlop.text === 'The cat sat on the mat.');
  assert('5b. Clean text has no recasts', noSlop.recasts.length === 0);
}

// ── TEST 6: Verify all 33 words are covered ──
console.log('\n── Test 6: All 33 banned words are covered ──');
{
  assert('6. All 34 banned words in list', BANNED_WORDS.length === 34);
  // Build a mega-sentence with ALL words
  const megaText = BANNED_WORDS.map(w => `The ${w} element.`).join(' ');
  const result = recastBannedVocabulary(megaText);
  assert('6. All words recast', result.recasts.length === BANNED_WORDS.length);

  // None of the banned words appear in output
  const outLower = result.text.toLowerCase();
  const leftover = BANNED_WORDS.filter(w => outLower.includes(w));
  assert('6. No banned words remain in output', leftover.length === 0);
}

// ── SUMMARY ──
console.log(`\n${'═'.repeat(60)}`);
console.log(`BANNED VOCAB RECAST: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('All banned vocabulary recast tests passed! ✅');
}
