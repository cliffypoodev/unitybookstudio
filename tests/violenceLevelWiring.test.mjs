import { strict as assert } from 'node:assert';
import {
  VIOLENCE_LEVELS,
  GENRE_DEFAULTS,
  createInitialProjectSettings,
  applyGenreDefaults,
  buildProjectContextHeader,
  buildViolenceBeatInstructions,
} from '../src/lib/autonovel.js';
import { buildSetupConstraints } from '../src/lib/setupConstraints.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

console.log('\n═══ VIOLENCE LEVEL WIRING TESTS ═══\n');

// 1. VIOLENCE_LEVELS exists with 6 levels
test('VIOLENCE_LEVELS has 6 levels (0-5)', () => {
  assert.ok(VIOLENCE_LEVELS);
  assert.equal(Object.keys(VIOLENCE_LEVELS).length, 6);
  assert.ok(VIOLENCE_LEVELS[0].label);
  assert.ok(VIOLENCE_LEVELS[5].label);
});

// 2. Each level has label and desc
test('Each level has label and desc', () => {
  for (const [key, val] of Object.entries(VIOLENCE_LEVELS)) {
    assert.ok(val.label, `Level ${key} missing label`);
    assert.ok(val.desc, `Level ${key} missing desc`);
  }
});

// 3. createInitialProjectSettings includes violence_level: 0 for fiction
test('createInitialProjectSettings fiction has violence_level: 0', () => {
  const settings = createInitialProjectSettings('fiction');
  assert.strictEqual(settings.violence_level, 0);
});

// 4. createInitialProjectSettings includes violence_level: 0 for nonfiction
test('createInitialProjectSettings nonfiction has violence_level: 0', () => {
  const settings = createInitialProjectSettings('nonfiction');
  assert.strictEqual(settings.violence_level, 0);
});

// 5. createInitialProjectSettings includes violence_level: 0 for anthology
test('createInitialProjectSettings anthology has violence_level: 0', () => {
  const settings = createInitialProjectSettings('anthology');
  assert.strictEqual(settings.violence_level, 0);
});

// 6. GENRE_DEFAULTS all have violence field
test('All GENRE_DEFAULTS have violence field', () => {
  for (const [genre, defaults] of Object.entries(GENRE_DEFAULTS)) {
    assert.ok(defaults.violence !== undefined, `${genre} missing violence default`);
  }
});

// 7. Genre-specific violence defaults are correct
test('Horror defaults to violence 3', () => {
  assert.strictEqual(GENRE_DEFAULTS.Horror.violence, 3);
});

test('Romance defaults to violence 0', () => {
  assert.strictEqual(GENRE_DEFAULTS.Romance.violence, 0);
});

test('Industrial Horror defaults to violence 4', () => {
  assert.strictEqual(GENRE_DEFAULTS['Industrial Horror'].violence, 4);
});

test('Thriller defaults to violence 2', () => {
  assert.strictEqual(GENRE_DEFAULTS.Thriller.violence, 2);
});

test('Crime defaults to violence 3', () => {
  assert.strictEqual(GENRE_DEFAULTS.Crime.violence, 3);
});

// 8. applyGenreDefaults sets violence from genre
test('applyGenreDefaults sets violence for Horror', () => {
  const result = applyGenreDefaults({ book_type: 'fiction' }, 'Horror');
  assert.strictEqual(result.violence_level, 3);
});

test('applyGenreDefaults sets violence 0 for Romance', () => {
  const result = applyGenreDefaults({ book_type: 'fiction' }, 'Romance');
  assert.strictEqual(result.violence_level, 0);
});

// 9. buildProjectContextHeader includes VIOLENCE when >= 1
test('buildProjectContextHeader includes VIOLENCE when level >= 1', () => {
  const header = buildProjectContextHeader({ genre: 'Horror', violence_level: 3, chapter_target: 20 });
  assert.ok(header.includes('VIOLENCE: 3/5'), 'Should include VIOLENCE: 3/5');
});

test('buildProjectContextHeader omits VIOLENCE when level 0', () => {
  const header = buildProjectContextHeader({ genre: 'Romance', violence_level: 0, chapter_target: 20 });
  assert.ok(!header.includes('VIOLENCE'), 'Should not include VIOLENCE for level 0');
});

// 10. buildSetupConstraints includes violence
test('buildSetupConstraints includes VIOLENCE LEVEL for level >= 1', () => {
  const constraints = buildSetupConstraints({ genre: 'Horror', violence_level: 3, chapter_target: 20 });
  assert.ok(constraints.includes('VIOLENCE LEVEL: 3/5'));
});

test('buildSetupConstraints omits violence for level 0', () => {
  const constraints = buildSetupConstraints({ genre: 'Romance', violence_level: 0, chapter_target: 20 });
  assert.ok(!constraints.includes('VIOLENCE LEVEL'));
});

// 11. buildViolenceBeatInstructions
test('buildViolenceBeatInstructions returns empty for level 0', () => {
  assert.strictEqual(buildViolenceBeatInstructions({ violence_level: 0 }), '');
});

test('buildViolenceBeatInstructions returns instructions for level 3', () => {
  const result = buildViolenceBeatInstructions({ violence_level: 3 });
  assert.ok(result.includes('Intense'));
  assert.ok(result.includes('VIOLENCE BEAT REQUIREMENTS'));
  assert.ok(result.includes('NEVER override prohibited content rules'));
});

test('buildViolenceBeatInstructions level 5 includes safety warning', () => {
  const result = buildViolenceBeatInstructions({ violence_level: 5 });
  assert.ok(result.includes('Extreme'));
  assert.ok(result.includes('PROHIBITED'));
});

test('buildViolenceBeatInstructions nonfiction mode differs', () => {
  const fiction = buildViolenceBeatInstructions({ violence_level: 3, book_type: 'fiction' });
  const nonfiction = buildViolenceBeatInstructions({ violence_level: 3, book_type: 'nonfiction' });
  assert.notStrictEqual(fiction, nonfiction, 'Fiction and nonfiction should have different instructions');
});

// 12. Nonfiction genres have correct violence defaults
test('Self-Help has violence 0', () => {
  assert.strictEqual(GENRE_DEFAULTS['Self-Help'].violence, 0);
});

test('True Crime has violence 2', () => {
  assert.strictEqual(GENRE_DEFAULTS['True Crime'].violence, 2);
});

console.log(`\n══════════════════════════════════════`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
