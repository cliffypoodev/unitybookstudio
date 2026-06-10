/**
 * antiChatbotProseQuality.test.mjs — Tests for the Anti-Chatbot Prose Module
 *
 * Validates:
 * 1. SIGNATURE_VOICE_BLOCK content and structure
 * 2. analyzeProseTexture() scoring accuracy
 * 3. countChatbotPatterns() detection accuracy
 * 4. Known-good prose scores high, known-chatbot prose scores low
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Direct import of the module ──
const modulePath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const mod = await import(modulePath);

const {
  SIGNATURE_VOICE_BLOCK,
  POLISHER_ANTI_CHATBOT_RULES,
  analyzeProseTexture,
  countChatbotPatterns,
  CHATBOT_PATTERNS,
  VERSION,
} = mod;

// ── Test harness ──
let passed = 0;
let failed = 0;
const failures = [];
const sectionResults = {};
let currentSection = '';

function section(name) {
  currentSection = name;
  sectionResults[name] = { total: 0, passed: 0 };
  console.log(`\n=== ${name} ===`);
}

function test(name, fn) {
  sectionResults[currentSection].total++;
  try {
    fn();
    passed++;
    sectionResults[currentSection].passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ section: currentSection, name, error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1: SIGNATURE_VOICE_BLOCK content
// ════════════════════════════════════════════════════════════════════════════

section('1. SIGNATURE_VOICE_BLOCK CONTENT');

test('Block is non-empty', () => {
  assert.ok(SIGNATURE_VOICE_BLOCK.length > 500, 'Block should be substantial');
});

test('Contains sentence rhythm rules', () => {
  assert.ok(SIGNATURE_VOICE_BLOCK.includes('sentence length'), 'Should mention sentence length');
  assert.ok(SIGNATURE_VOICE_BLOCK.includes('fragment'), 'Should mention fragments');
});

test('Contains concrete specificity rules', () => {
  assert.ok(SIGNATURE_VOICE_BLOCK.includes('generic noun'), 'Should ban generic nouns');
  assert.ok(SIGNATURE_VOICE_BLOCK.includes('physical sensation'), 'Should require physical sensation');
});

test('Contains verb strength rules', () => {
  assert.ok(SIGNATURE_VOICE_BLOCK.includes('filter verb'), 'Should ban filter verbs');
  assert.ok(SIGNATURE_VOICE_BLOCK.includes('felt'), 'Should mention felt');
});

test('Contains anti-chatbot cadence rules', () => {
  assert.ok(SIGNATURE_VOICE_BLOCK.includes('not just'), 'Should ban "not just" patterns');
  assert.ok(SIGNATURE_VOICE_BLOCK.includes('thesis sentence'), 'Should ban thesis sentences');
  assert.ok(SIGNATURE_VOICE_BLOCK.includes('lesson-statement'), 'Should ban lesson-statement endings');
});

test('Contains subtext rules', () => {
  assert.ok(SIGNATURE_VOICE_BLOCK.toLowerCase().includes('subtext'), 'Should mention subtext');
  assert.ok(SIGNATURE_VOICE_BLOCK.toLowerCase().includes('unsaid'), 'Should mention what is unsaid');
});

test('Contains genre texture rules', () => {
  assert.ok(SIGNATURE_VOICE_BLOCK.includes('genre'), 'Should mention genre');
  assert.ok(SIGNATURE_VOICE_BLOCK.includes('shelf'), 'Should mention bookshelf');
});

test('Does not contain process language', () => {
  assert.ok(!SIGNATURE_VOICE_BLOCK.includes('Step 1'), 'Should not contain numbered steps');
  assert.ok(!SIGNATURE_VOICE_BLOCK.includes('TODO'), 'Should not contain TODO');
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2: POLISHER_ANTI_CHATBOT_RULES content
// ════════════════════════════════════════════════════════════════════════════

section('2. POLISHER_ANTI_CHATBOT_RULES');

test('Rules are non-empty', () => {
  assert.ok(POLISHER_ANTI_CHATBOT_RULES.length > 200, 'Should be substantial');
});

test('Contains filter verb replacement rule', () => {
  assert.ok(POLISHER_ANTI_CHATBOT_RULES.includes('filter verb'), 'Should mention filter verbs');
});

test('Contains thesis statement cut rule', () => {
  assert.ok(POLISHER_ANTI_CHATBOT_RULES.includes('thesis sentence'), 'Should mention thesis sentences');
});

test('Contains lesson-ending cut rule', () => {
  assert.ok(POLISHER_ANTI_CHATBOT_RULES.includes('lesson-statement'), 'Should mention lesson-statement endings');
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3: analyzeProseTexture() — known-good prose
// ════════════════════════════════════════════════════════════════════════════

section('3. GOOD PROSE SCORING');

const GOOD_PROSE = `The lock gave on the third try. Marcus shouldered through the door and the cold hit him — not the dry cold of the office, but something damp, something that had been waiting.

Broken glass on the concrete. A chair overturned. The fluorescent tube overhead buzzed and flickered, throwing shadows that swung like pendulums.

He crouched beside the desk. The bottom drawer hung open, empty except for a single brass key and a receipt from a hardware store on Ninth Street dated three weeks ago.

"Someone cleaned this out," he said.

Rivera stood in the doorway, arms crossed. She didn't answer. She was looking at the wall behind him — at the photograph pinned there with a single thumbtack. A woman standing in front of a building Marcus recognized.

He pulled the photo free. The thumbtack left a small hole in the drywall.

"That's the clinic on Archer," Rivera said. Quiet.

Marcus turned the photo over. On the back, in blue ballpoint: a phone number and two words. Call first.`;

test('Good prose scores ≥55 composite', () => {
  const result = analyzeProseTexture(GOOD_PROSE);
  assert.ok(result.compositeScore >= 55, `Expected ≥55, got ${result.compositeScore}`);
});

test('Good prose has sentence variance ≥5', () => {
  const result = analyzeProseTexture(GOOD_PROSE);
  assert.ok(result.sentenceLengthVariance >= 5, `Expected ≥5, got ${result.sentenceLengthVariance}`);
});

test('Good prose has strong opening verb', () => {
  const result = analyzeProseTexture(GOOD_PROSE);
  assert.equal(result.openingVerbStrength, 'strong');
});

test('Good prose has low filter verb density', () => {
  const result = analyzeProseTexture(GOOD_PROSE);
  assert.ok(result.filterVerbDensity < 10, `Expected <10, got ${result.filterVerbDensity}`);
});

test('Good prose has zero thesis statements', () => {
  const result = analyzeProseTexture(GOOD_PROSE);
  assert.equal(result.thesisStatementDensity, 0);
});

test('Good prose has zero "not just" patterns', () => {
  const result = analyzeProseTexture(GOOD_PROSE);
  assert.equal(result.notJustDensity, 0);
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4: analyzeProseTexture() — known-chatbot prose
// ════════════════════════════════════════════════════════════════════════════

section('4. CHATBOT PROSE SCORING');

const CHATBOT_PROSE = `Sarah felt a surge of determination as she walked into the room. She realized that the truth was more complex than she had imagined. The weight of the realization settled over her like a blanket.

The room wasn't just a room; it was a testament to years of neglect. She noticed the dust, the silence, and the emptiness that seemed to radiate from every corner. Something shifted inside her as she observed the scene before her.

Part of her wanted to turn back. Another part wanted to press forward. She felt torn between fear, doubt, and determination. The truth was that she had never been good at making decisions.

"I'm scared," she said. "I'm not sure I can do this."

He seemed to understand. He appeared to consider her words carefully. He realized that she needed reassurance.

"It's not just about courage," he said. "It's about what's right." The realization hit her like a wave. She felt a wave of emotion wash over her.

And that was when she realized that sometimes the hardest choices are the ones that matter most. In that moment, she understood that the journey wasn't just about the destination; it was about who she became along the way.`;

test('Chatbot prose scores ≤50 composite', () => {
  const result = analyzeProseTexture(CHATBOT_PROSE);
  assert.ok(result.compositeScore <= 50, `Expected ≤50, got ${result.compositeScore}`);
});

test('Chatbot prose has high filter verb density', () => {
  const result = analyzeProseTexture(CHATBOT_PROSE);
  assert.ok(result.filterVerbDensity > 5, `Expected >5, got ${result.filterVerbDensity}`);
});

test('Chatbot prose has thesis statements', () => {
  const result = analyzeProseTexture(CHATBOT_PROSE);
  assert.ok(result.thesisStatementDensity > 0, `Expected >0, got ${result.thesisStatementDensity}`);
});

test('Chatbot prose has "not just" patterns', () => {
  const result = analyzeProseTexture(CHATBOT_PROSE);
  assert.ok(result.notJustDensity > 0, `Expected >0, got ${result.notJustDensity}`);
});

test('Chatbot prose has balanced reflection', () => {
  const result = analyzeProseTexture(CHATBOT_PROSE);
  assert.ok(result.balancedReflectionCount > 0, `Expected >0, got ${result.balancedReflectionCount}`);
});

test('Chatbot prose has generic emotion nouns', () => {
  const result = analyzeProseTexture(CHATBOT_PROSE);
  assert.ok(result.genericEmotionDensity > 0, `Expected >0, got ${result.genericEmotionDensity}`);
});

test('Chatbot prose generates diagnostics', () => {
  const result = analyzeProseTexture(CHATBOT_PROSE);
  assert.ok(result.diagnostics.length >= 3, `Expected ≥3 diagnostics, got ${result.diagnostics.length}`);
});

test('Good prose scores higher than chatbot prose', () => {
  const goodResult = analyzeProseTexture(GOOD_PROSE);
  const chatbotResult = analyzeProseTexture(CHATBOT_PROSE);
  assert.ok(goodResult.compositeScore > chatbotResult.compositeScore,
    `Good (${goodResult.compositeScore}) should beat chatbot (${chatbotResult.compositeScore})`);
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5: countChatbotPatterns()
// ════════════════════════════════════════════════════════════════════════════

section('5. CHATBOT PATTERN COUNTING');

test('Counts filter verbs', () => {
  const result = countChatbotPatterns('She felt cold and strange. He seemed tired and worn out. It appeared empty and abandoned. The room was silent and dark. The floor was cold beneath her bare feet and the walls were cracked and stained.');
  assert.ok(result.counts.filter_verbs >= 3, `Expected ≥3 filter verbs, got ${result.counts.filter_verbs}`);
});

test('Counts "not just" patterns', () => {
  const result = countChatbotPatterns("It wasn't just a room; it was a statement about power and control. Not just important, but vital to their survival. The building stood tall and imposing against the gray winter sky, casting long shadows across the empty parking lot.");
  assert.ok(result.counts.not_just >= 2, `Expected ≥2, got ${result.counts.not_just}`);
});

test('Counts thesis statements', () => {
  const result = countChatbotPatterns('The truth was that nothing would ever be the same after that night. In that moment, she understood everything about the situation. The room was cold and the windows had been left open all night by someone careless and indifferent to the cold.');
  assert.ok(result.counts.thesis_statements >= 2, `Expected ≥2, got ${result.counts.thesis_statements}`);
});

test('Counts balanced reflection', () => {
  const result = countChatbotPatterns('Part of her wanted to stay and fight for what she believed was right. Part of him wanted to leave and never return to this place again. The clock on the wall ticked steadily through the silence between them both.');
  assert.ok(result.counts.balanced_reflection >= 2, `Expected ≥2, got ${result.counts.balanced_reflection}`);
});

test('Counts generic emotion nouns', () => {
  const result = countChatbotPatterns('A wave of sadness crashed over her without warning. A surge of anger rose in his chest and throat. A sense of dread filled her completely as she stood in the darkened hallway of the old abandoned hospital building.');
  assert.ok(result.counts.generic_emotion >= 3, `Expected ≥3, got ${result.counts.generic_emotion}`);
});

test('Returns total and density', () => {
  const result = countChatbotPatterns(CHATBOT_PROSE);
  assert.ok(result.total > 0, 'Total should be positive');
  assert.ok(result.density > 0, 'Density should be positive');
});

test('Clean prose has low chatbot pattern count', () => {
  const result = countChatbotPatterns(GOOD_PROSE);
  const chatbotResult = countChatbotPatterns(CHATBOT_PROSE);
  assert.ok(result.total < chatbotResult.total,
    `Clean (${result.total}) should have fewer patterns than chatbot (${chatbotResult.total})`);
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 6: Edge cases
// ════════════════════════════════════════════════════════════════════════════

section('6. EDGE CASES');

test('Empty text returns INSUFFICIENT_TEXT', () => {
  const result = analyzeProseTexture('');
  assert.equal(result.grade, 'INSUFFICIENT_TEXT');
});

test('Very short text returns INSUFFICIENT_TEXT', () => {
  const result = analyzeProseTexture('Hello world.');
  assert.equal(result.grade, 'INSUFFICIENT_TEXT');
});

test('null text handled gracefully', () => {
  const result = analyzeProseTexture(null);
  assert.equal(result.grade, 'INSUFFICIENT_TEXT');
});

test('countChatbotPatterns handles empty text', () => {
  const result = countChatbotPatterns('');
  assert.equal(result.total, 0);
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 7: Module exports stability
// ════════════════════════════════════════════════════════════════════════════

section('7. MODULE EXPORTS');

test('VERSION is defined', () => {
  assert.ok(VERSION && typeof VERSION === 'string');
});

test('CHATBOT_PATTERNS is array with entries', () => {
  assert.ok(Array.isArray(CHATBOT_PATTERNS));
  assert.ok(CHATBOT_PATTERNS.length >= 8);
});

test('Each CHATBOT_PATTERN has key, label, description', () => {
  for (const p of CHATBOT_PATTERNS) {
    assert.ok(p.key, 'Missing key');
    assert.ok(p.label, 'Missing label');
    assert.ok(p.description, 'Missing description');
  }
});

// ════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(64)}`);
console.log(`ANTI-CHATBOT PROSE QUALITY TESTS: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ❌ [${f.section}] ${f.name}: ${f.error}`);
  }
}

console.log(`${'='.repeat(64)}`);

console.log('\nSection Summary:');
for (const [name, r] of Object.entries(sectionResults)) {
  const icon = r.passed === r.total ? '✅' : '❌';
  console.log(`  ${icon} ${name}: ${r.passed}/${r.total}`);
}

console.log();

if (failed > 0) process.exit(1);
