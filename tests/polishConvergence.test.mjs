/**
 * polishConvergence.test.mjs — Triple-pass idempotency test
 *
 * Verified property: running polish a second time changes nothing.
 * pass 2 output === pass 1 output, pass 3 output === pass 2 output.
 *
 * Tests both fiction and nonfiction modes with:
 *   1. Short staccato fragments (triggers triplet fragment merger)
 *   2. Dense nonfiction with forensic tics (triggers NF pipeline)
 *   3. Mixed content (dialogue + narration)
 */
import { runManuscriptPolishPipeline } from '../src/lib/manuscriptPolishRunner.js';

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
    console.log(`  ❌ ${label}`);
  }
}

async function runPasses(fixture, mode, passCount = 3) {
  const results = [];
  let text = fixture;
  for (let pass = 1; pass <= passCount; pass++) {
    const loaded = [{
      chapter: { chapter_number: 1, title: 'Ch 1' },
      content: text,
      original: text,
    }];
    await runManuscriptPolishPipeline({
      loaded,
      project: { title: 'Convergence Test', genre: mode, book_type: mode },
      allowLLM: false,
      mode,
    });
    results.push(loaded[0].content);
    text = loaded[0].content;
  }
  return results;
}

// ── TEST 1: Staccato fragments (nonfiction) — triggers triplet merger ──
console.log('\n── Test 1: Staccato fragments (nonfiction) — triplet merger convergence ──');
{
  const fixture = 'The fire began. The smoke rose. The alarm sounded. The guards ran. The doors opened. The crowd fled. The walls cracked. The roof fell. The flames spread. The heat was unbearable. The record suggests officials knew. The evidence points to negligence. The investigation stalled. The witnesses vanished. The case closed. The truth was buried. The families mourned. The system failed.';
  const [p1, p2, p3] = await runPasses(fixture, 'nonfiction');

  assert('1a. Pass 1 changed original', p1 !== fixture);
  assert('1b. Pass 2 === Pass 1 (convergent)', p2 === p1);
  assert('1c. Pass 3 === Pass 2 (stable)', p3 === p2);
  // Verify semicolons were used (not em-dashes that the reducer would undo)
  assert('1d. Contains semicolon joins', p1.includes(';'));
}

// ── TEST 2: Dense nonfiction with forensic tics ──
console.log('\n── Test 2: Dense nonfiction with forensic tics ──');
{
  const fixture = 'The investigation began in the winter of 1943. The record suggests the fire started at dawn. The available accounts indicate the guards were asleep. The evidence points to a pattern of neglect. The surviving record shows a history of complaints. The witnesses described smoke rising from the east wing. The record suggests officials knew about the structural problems. The available accounts indicate that inspections had been skipped for months. The fire department was notified too late. The surviving record shows that the alarm system had been disabled. The witnesses were not interviewed until three weeks later. The investigation revealed systematic corruption at every level. The evidence points to deliberate obstruction by the facility management. The record suggests the death toll was higher than reported. The available accounts indicate families were never properly notified.';
  const [p1, p2, p3] = await runPasses(fixture, 'nonfiction');

  assert('2a. Pass 1 changed original', p1 !== fixture);
  assert('2b. Pass 2 === Pass 1 (convergent)', p2 === p1);
  assert('2c. Pass 3 === Pass 2 (stable)', p3 === p2);
}

// ── TEST 3: Fiction mode convergence ──
console.log('\n── Test 3: Fiction staccato convergence ──');
{
  const fixture = 'The door opened. The wind blew. The candle flickered. She stepped inside. The room was dark. The floor creaked. He waited. The clock ticked. The silence stretched. The moment passed. She spoke first. The words were careful. He listened. The fire crackled. The shadows danced.';
  const [p1, p2, p3] = await runPasses(fixture, 'fiction');

  assert('3a. Pass 1 changed original', p1 !== fixture);
  assert('3b. Pass 2 === Pass 1 (convergent)', p2 === p1);
  assert('3c. Pass 3 === Pass 2 (stable)', p3 === p2);
}

// ── TEST 4: Mixed dialogue + narration convergence ──
console.log('\n── Test 4: Dialogue + narration convergence (nonfiction) ──');
{
  const fixture = `"The guards were asleep," said the clerk. The record suggests no inspection followed. The surviving record shows a pattern of negligence. "Nobody checked the exits," he added. The investigation stalled. The witnesses vanished. The case went cold. The truth emerged years later.`;
  const [p1, p2, p3] = await runPasses(fixture, 'nonfiction');

  assert('4a. Pass 1 changed original', p1 !== fixture);
  assert('4b. Pass 2 === Pass 1 (convergent)', p2 === p1);
  assert('4c. Pass 3 === Pass 2 (stable)', p3 === p2);
  // Verify dialogue is preserved
  assert('4d. Opening dialogue quote preserved', p1.includes('\u201cThe guards were asleep'));
}

// ── TEST 5: Already-polished text should not be re-mutated ──
console.log('\n── Test 5: Pre-polished text stability ──');
{
  // This is text that already has semicolon joins (simulating output from a previous polish)
  const prePolished = 'The fire began; the smoke rose. The alarm sounded. The guards ran; the doors opened. The crowd fled. The walls cracked; the roof fell.';
  const [p1, p2] = await runPasses(prePolished, 'nonfiction', 2);

  assert('5a. Pass 1 did not add new joins', !p1.includes(' — '));
  assert('5b. Pass 2 === Pass 1 (stable)', p2 === p1);
}

// ── SUMMARY ──
console.log(`\n${'═'.repeat(60)}`);
console.log(`CONVERGENCE: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('All convergence tests passed! ✅');
}
