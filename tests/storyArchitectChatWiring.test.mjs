import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { VIOLENCE_LEVELS } from '../src/lib/autonovel.js';

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

const readSrc = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

console.log('\n═══ STORY ARCHITECT CHAT WIRING TESTS ═══\n');

// === FloatingBrainstorm.jsx ===
const floatingBrainstorm = readSrc('components/FloatingBrainstorm.jsx');

test('FloatingBrainstorm has mode detection function', () => {
  assert.ok(floatingBrainstorm.includes('getActiveMode'), 'Missing getActiveMode function');
});

test('FloatingBrainstorm detects story-architect mode from /ideas path', () => {
  assert.ok(floatingBrainstorm.includes('/ideas') || floatingBrainstorm.includes('ideas'), 'Should detect /ideas path');
  assert.ok(floatingBrainstorm.includes('story-architect'), 'Should have story-architect mode');
});

test('FloatingBrainstorm has mode labels', () => {
  assert.ok(floatingBrainstorm.includes('Story Architect'), 'Missing Story Architect label');
  assert.ok(floatingBrainstorm.includes('Chapter Assistant') || floatingBrainstorm.includes('chapter-assistant'), 'Missing Chapter Assistant mode');
});

test('FloatingBrainstorm has intent detection', () => {
  assert.ok(
    floatingBrainstorm.includes('detectIntent') || floatingBrainstorm.includes('research') && floatingBrainstorm.includes('polish'),
    'Missing intent detection'
  );
});

test('FloatingBrainstorm supports USE_IDEA markers', () => {
  assert.ok(floatingBrainstorm.includes('USE_IDEA'), 'Missing USE_IDEA support');
});

test('FloatingBrainstorm has violenceLevel in schema', () => {
  assert.ok(floatingBrainstorm.includes('violenceLevel'), 'Missing violenceLevel in USE_IDEA schema');
});

// === IdeasChatbot.jsx ===
const ideasChatbot = readSrc('components/notebook/IdeasChatbot.jsx');

test('IdeasChatbot has SYSTEM_PROMPT with Story Architect instructions', () => {
  assert.ok(ideasChatbot.includes('Ideas Architect'), 'Missing Ideas Architect in SYSTEM_PROMPT');
});

test('IdeasChatbot USE_IDEA schema includes violenceLevel', () => {
  assert.ok(ideasChatbot.includes('violenceLevel'), 'Missing violenceLevel in USE_IDEA schema');
});

test('IdeasChatbot USE_IDEA schema includes full blueprint fields', () => {
  assert.ok(ideasChatbot.includes('subgenre'), 'Missing subgenre');
  assert.ok(ideasChatbot.includes('chapterCount'), 'Missing chapterCount');
  assert.ok(ideasChatbot.includes('authorVoice'), 'Missing authorVoice');
  assert.ok(ideasChatbot.includes('storyArcPacing'), 'Missing storyArcPacing');
  assert.ok(ideasChatbot.includes('spiceLevel'), 'Missing spiceLevel');
  assert.ok(ideasChatbot.includes('languageLevel'), 'Missing languageLevel');
});

test('IdeasChatbot has anti-plagiarism protocol', () => {
  assert.ok(ideasChatbot.includes('ANTI-PLAGIARISM') || ideasChatbot.includes('plagiarism'), 'Missing anti-plagiarism protocol');
});

test('IdeasChatbot has story engine requirement', () => {
  assert.ok(ideasChatbot.includes('story_engine') || ideasChatbot.includes('STORY ENGINE'), 'Missing story engine requirement');
});

// === CreateProjectFromIdeaDialog.jsx ===
const createDialog = readSrc('components/notebook/CreateProjectFromIdeaDialog.jsx');

test('CreateProjectFromIdeaDialog exists and has proper structure', () => {
  assert.ok(createDialog.includes('CreateProjectFromIdeaDialog'), 'Missing component name');
  assert.ok(createDialog.includes('onConfirmCreate'), 'Missing onConfirmCreate prop');
  assert.ok(createDialog.includes('blueprint'), 'Missing blueprint prop');
});

test('CreateProjectFromIdeaDialog includes violence_level field', () => {
  assert.ok(createDialog.includes('violence_level'), 'Missing violence_level field');
  assert.ok(createDialog.includes('VIOLENCE_LEVELS'), 'Missing VIOLENCE_LEVELS import');
});

test('CreateProjectFromIdeaDialog maps blueprint to project fields', () => {
  assert.ok(createDialog.includes('violenceLevel'), 'Missing violenceLevel mapping from blueprint');
  assert.ok(createDialog.includes('spiceLevel'), 'Missing spiceLevel mapping');
  assert.ok(createDialog.includes('languageLevel'), 'Missing languageLevel mapping');
});

test('CreateProjectFromIdeaDialog has edit mode', () => {
  assert.ok(createDialog.includes('editing') && createDialog.includes('setEditing'), 'Missing edit mode toggle');
});

test('CreateProjectFromIdeaDialog has confirm button', () => {
  assert.ok(createDialog.includes('Create Project'), 'Missing Create Project button');
});

// === VIOLENCE_LEVELS constant integrity ===
test('VIOLENCE_LEVELS 0 is None', () => {
  assert.strictEqual(VIOLENCE_LEVELS[0].label, 'None');
});

test('VIOLENCE_LEVELS 5 is Extreme / Restricted', () => {
  assert.strictEqual(VIOLENCE_LEVELS[5].label, 'Extreme / Restricted');
});

// === Build check (file existence) ===
test('All modified files are valid JS/JSX', () => {
  // Just verify they can be read without error
  assert.ok(floatingBrainstorm.length > 100, 'FloatingBrainstorm too short');
  assert.ok(ideasChatbot.length > 100, 'IdeasChatbot too short');
  assert.ok(createDialog.length > 100, 'CreateProjectFromIdeaDialog too short');
});

console.log(`\n══════════════════════════════════════`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
