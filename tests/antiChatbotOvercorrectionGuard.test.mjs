/**
 * antiChatbotOvercorrectionGuard.test.mjs — Tests for overcorrection risks
 *
 * Validates that the anti-chatbot prose rules and analyzer
 * do NOT penalize legitimate literary techniques:
 *   - Intentional fragments
 *   - Varied dialogue styles
 *   - Lyrical/poetic prose
 *   - Nonfiction clarity
 *   - Genre-appropriate conventions
 */

import assert from 'node:assert/strict';
import { join } from 'node:path';

const modulePath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const { analyzeProseTexture, countChatbotPatterns, SIGNATURE_VOICE_BLOCK } = await import(modulePath);

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
section('1. INTENTIONAL FRAGMENTS NOT PENALIZED');
// ════════════════════════════════════════════════════════════════════════════

const FRAGMENT_PROSE = `The door. Locked. Three deadbolts and a chain that looked new, the brass still bright against the old wood. Marcus pressed his ear to the surface and listened.

Nothing at first. Then — a creak. Weight on floorboards. Someone inside, moving carefully, the way you move when you know someone's listening. The sound came from deep in the apartment, past the kitchen, maybe the back bedroom.

He knocked. No answer. Knocked again, harder.

"Mr. Castellano? It's Detective Rivera. We spoke on the phone."

Silence. Then footsteps, closer now. The chain rattled. The door opened exactly four inches — the width the chain allowed — and a slice of face appeared in the gap. One eye. Part of a jaw covered in three days of stubble.

"Show me a badge."

Marcus held it up. The eye studied it. The door closed, the chain slid, and the door opened wide. The apartment behind Castellano smelled like cold coffee and newsprint.`;

test('Fragment-heavy prose scores COMPETENT or better', () => {
  const result = analyzeProseTexture(FRAGMENT_PROSE);
  assert.ok(result.compositeScore >= 55, `Expected ≥55, got ${result.compositeScore} (${result.grade})`);
});

test('Fragment-heavy prose has good sentence variance', () => {
  const result = analyzeProseTexture(FRAGMENT_PROSE);
  assert.ok(result.sentenceLengthVariance >= 5, `Expected ≥5, got ${result.sentenceLengthVariance}`);
});

// ════════════════════════════════════════════════════════════════════════════
section('2. LYRICAL PROSE NOT PENALIZED');
// ════════════════════════════════════════════════════════════════════════════

const LYRICAL_PROSE = `The orchard held its breath in the hour before dawn. Frost had crystallized on the branches overnight, turning each apple into a glass ornament suspended against the pewter sky, and the grass beneath her boots cracked with each step like the spine of a small, dry book.

Anna stopped at the stone wall and set down the bucket. Her hands were already red from the cold, the knuckles swollen, the nails bitten to the quick — a habit she'd carried from the refugee camp, where fingernails were the only thing left to chew. She pressed her palms flat against the top stones. They were rough and cold and ancient, older than the farmhouse, older than the village records, set here by hands that had no word for the country she now called home.

The rooster crowed from the barn. She didn't turn. She watched the eastern horizon where the sun would come, a thin line of copper bleeding upward through the gray, and she thought about the letter in her pocket. Three sentences. A forwarding address in Malmö. No signature. But she recognized the handwriting — small, left-slanting, the loops on the g's pulled tight — and she stood there with her red hands on the old stones and let the cold do what the letter could not.`;

test('Lyrical prose scores GOOD or better', () => {
  const result = analyzeProseTexture(LYRICAL_PROSE);
  assert.ok(result.compositeScore >= 70, `Expected ≥70, got ${result.compositeScore} (${result.grade})`);
});

test('Lyrical prose is not flagged as chatbot', () => {
  const result = analyzeProseTexture(LYRICAL_PROSE);
  assert.ok(!['CHATBOT_ADJACENT', 'CHATBOT_SLOP'].includes(result.grade),
    `Should not be chatbot-grade, got ${result.grade}`);
});

// ════════════════════════════════════════════════════════════════════════════
section('3. CLEAR NONFICTION NOT PENALIZED');
// ════════════════════════════════════════════════════════════════════════════

const CLEAR_NONFICTION = `In 2019, the city of Milwaukee processed 347,000 job applications through a centralized screening platform. The platform used a proprietary algorithm to rank candidates by "predicted success probability." The algorithm's source code was never audited.

The ranking function weighted twelve variables. Seven were standard: education level, years of experience, skills match, certification status, employment continuity, referral source, and interview scheduling compliance. Five were not.

The non-standard variables included credit score (weighted 0.22, higher than education at 0.12), residential zip code mapped to a "community stability index" (0.19), social media activity frequency (0.14), commute distance estimate (0.08), and a field labeled "behavioral pattern delta" (0.06) that cross-referenced public social media posts against an undocumented behavioral model.

When the consulting firm zeroed out the non-standard variables and re-ranked the 347,000 applicants, the results diverged sharply for nine zip codes south of Interstate 94. Applicants from those zip codes — all majority-Black or majority-Latino neighborhoods — had scored, on average, 23 percentile points lower than applicants with identical education and experience from the North Shore suburbs.`;

test('Clear nonfiction scores COMPETENT or better', () => {
  const result = analyzeProseTexture(CLEAR_NONFICTION);
  assert.ok(result.compositeScore >= 55, `Expected ≥55, got ${result.compositeScore} (${result.grade})`);
});

test('Clear nonfiction has zero chatbot thesis statements', () => {
  const result = analyzeProseTexture(CLEAR_NONFICTION);
  assert.equal(result.thesisStatementDensity, 0, 'Should not falsely detect thesis statements in factual writing');
});

// ════════════════════════════════════════════════════════════════════════════
section('4. DIALOGUE-HEAVY PROSE NOT PENALIZED');
// ════════════════════════════════════════════════════════════════════════════

const DIALOGUE_HEAVY = `"You can't just walk in here." The receptionist didn't look up from her screen.

"I have an appointment."

"With who."

"Dr. Almeida." Marcus set his card on the counter. The receptionist picked it up between two fingers, held it at arm's length, and read it the way you'd read a parking ticket.

"Detective." She set the card down. "Dr. Almeida is in surgery until four."

"It's four-thirty."

She typed something. The keyboard was loud in the empty lobby — each keystroke like a small, deliberate insult. After thirty seconds she said, "She'll be down in ten." And then, without looking at him: "Don't sit on the leather chairs. They're for patients."

Marcus sat on a plastic chair by the window. The leather chairs were nicer. He pulled out his phone and scrolled through nothing, the way people do when they want to look busy but are really just waiting and trying not to think about the fact that they're waiting.`;

test('Dialogue-heavy prose scores COMPETENT or better', () => {
  const result = analyzeProseTexture(DIALOGUE_HEAVY);
  assert.ok(result.compositeScore >= 55, `Expected ≥55, got ${result.compositeScore} (${result.grade})`);
});

test('Dialogue-heavy prose has low chatbot pattern count', () => {
  const patterns = countChatbotPatterns(DIALOGUE_HEAVY);
  assert.ok(patterns.density < 30, `Expected <30/1K density, got ${patterns.density}`);
});

// ════════════════════════════════════════════════════════════════════════════
section('5. LEGITIMATE "WAS" USAGE NOT OVER-FLAGGED');
// ════════════════════════════════════════════════════════════════════════════

test('Single "was" in opening does not tank score', () => {
  const prose = `The apartment was on the third floor of a brownstone on West 112th Street, the kind of building where the hallway smelled like garlic and the mailboxes had been broken into so many times the super stopped replacing them.

  Marcus climbed the stairs two at a time. His knees protested. He ignored them the way he'd been ignoring them for six years, the way his doctor told him to stop ignoring them, the way people in his line of work always ignored the body's early warnings because the work didn't stop for cartilage.

  The door to 3C hung open. Not all the way — just enough to catch the light from the hallway and throw a thin yellow wedge across the entryway floor. He drew his weapon.`;

  const result = analyzeProseTexture(prose);
  assert.ok(result.compositeScore >= 50, `Expected ≥50 even with 'was' opening, got ${result.compositeScore}`);
});

// ════════════════════════════════════════════════════════════════════════════
section('6. OVERCORRECTION PATTERNS');
// ════════════════════════════════════════════════════════════════════════════

const OVERCORRECTED = `Crunch. Gravel. Door. Marcus slammed through the threshold like a freight train meeting a paper wall. Dust exploded. Glass shattered. His boots — steel-toed, scuffed, military-grade, blood-stained — crunched across the shattered ceramic tiles.

Breath. Pulse. Target.

The room reeked — copper and cordite and the sweet-sick stench of something that had been alive forty minutes ago and wasn't anymore. His jaw locked. His fists clenched. His spine went rigid as rebar.

Coffee. Cold. Three days old. The mug sat on the counter like a small ceramic accusation. Beside it: a knife. The blade — seven inches, serrated, the kind you'd use to saw through rope or tendon — had been wiped but not washed.

Every surface screamed. Every shadow held a fist.`;

test('Overcorrected "forced grit" prose does not score EXCELLENT', () => {
  const result = analyzeProseTexture(OVERCORRECTED);
  // Over-fragmented prose should still score reasonably (fragments are allowed)
  // but the lack of varied sentence structure may show
  assert.ok(result.compositeScore < 90, `Overcorrected prose should not score ≥90, got ${result.compositeScore}`);
});

test('SIGNATURE_VOICE_BLOCK warns against forced fragments', () => {
  // The block should say fragments should be "deliberate" not constant
  assert.ok(SIGNATURE_VOICE_BLOCK.toLowerCase().includes('deliberate') ||
            SIGNATURE_VOICE_BLOCK.toLowerCase().includes('fragment'),
    'Should mention deliberate fragment usage');
});

// ════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(64)}`);
console.log(`OVERCORRECTION GUARD TESTS: ${passed} passed, ${failed} failed`);

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
