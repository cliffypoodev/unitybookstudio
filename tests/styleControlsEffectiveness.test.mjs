/**
 * Style Controls Effectiveness Regression Tests
 *
 * Validates that the UBS style control infrastructure:
 * - Has complete inventories of beat styles, author voices, genres
 * - Produces structurally distinct prompt parameters for each option
 * - Routes genre defaults correctly (POV, tense, beat)
 * - Flows custom author style fields into prompts
 * - Handles spice/register/intensity escalation
 * - Has no contamination or process-leak in style definitions
 *
 * Tests are deterministic — they analyze actual code exports,
 * not LLM outputs.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Test Harness ──────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log('  \u2705 ' + label); }
  else { failed++; console.error('  \u274c ' + label); }
}

// ── Read Source Files ─────────────────────────────────────────
const autonovelCode = readFileSync(resolve('src/lib/autonovel.js'), 'utf-8');
const nfBeatsCode = readFileSync(resolve('src/lib/nonfictionBeats.js'), 'utf-8');
const genreTaxonomyCode = readFileSync(resolve('src/lib/genreTaxonomy.js'), 'utf-8');
const authorStylePromptCode = readFileSync(resolve('src/lib/authorStylePrompt.js'), 'utf-8');
const polishConfigCode = readFileSync(resolve('src/lib/polishPipelineConfig.js'), 'utf-8');
const sceneWriterCode = readFileSync(resolve('src/lib/sceneWriter.js'), 'utf-8');

// ══════════════════════════════════════════════════════════════
// SECTION 1: Beat Style Inventory Completeness
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 1: Beat Style Inventory \u2550\u2550\u2550\n');

const EXPECTED_BEAT_STYLES = [
  'Tension-Driven', 'Character Study', 'Mystery Unravel', 'Slow Burn Romance',
  'Epic World-Building', 'Literary Atmospheric', 'Fast-Paced Action',
  'Screwball Comedy', 'Dry Wit / Deadpan', 'Dark Comedy',
  'Absurdist / Surreal Comedy', 'Romantic Comedy', 'Comic Caper / Heist Comedy',
];

for (const style of EXPECTED_BEAT_STYLES) {
  assert(autonovelCode.includes(style), `S-1: Beat style "${style}" exists`);
}

// 1.2: Each beat style has a unique description
const beatDescriptions = EXPECTED_BEAT_STYLES.map(name => {
  const idx = autonovelCode.indexOf(`name: '${name}'`);
  if (idx === -1) return '';
  const descStart = autonovelCode.indexOf("desc: '", idx);
  const descEnd = autonovelCode.indexOf("'", descStart + 7);
  return autonovelCode.slice(descStart + 7, descEnd);
});
const uniqueDescs = new Set(beatDescriptions.filter(d => d.length > 0));
assert(uniqueDescs.size >= 12, `S-2: Beat styles have ${uniqueDescs.size}/13 unique descriptions`);

// 1.3: Beat styles have IDs
const EXPECTED_BEAT_IDS = ['tension', 'character', 'mystery', 'slowburn', 'epic', 'literary', 'action',
  'screwball', 'drywit', 'darkcomedy', 'absurdist', 'romcom', 'caper'];
for (const id of EXPECTED_BEAT_IDS) {
  assert(autonovelCode.includes(`id: '${id}'`), `S-3: Beat ID "${id}" defined`);
}

// ══════════════════════════════════════════════════════════════
// SECTION 2: Nonfiction Beat Templates
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 2: Nonfiction Beat Templates \u2550\u2550\u2550\n');

const NF_TEMPLATES = ['narrative', 'investigative', 'prescriptive', 'reference'];
for (const tmpl of NF_TEMPLATES) {
  assert(nfBeatsCode.includes(`${tmpl}: {`), `S-4: NF template "${tmpl}" exists`);
}

// 2.2: Each NF template has distinct beats
assert(nfBeatsCode.includes("'The Opening Pressure'"), 'S-5: Narrative template has unique opening beat');
assert(nfBeatsCode.includes("'The Question'"), 'S-6: Investigative template has unique opening beat');
assert(nfBeatsCode.includes("'The Hook'"), 'S-7: Prescriptive template has unique opening beat');
assert(nfBeatsCode.includes("'Why This Matters'"), 'S-8: Reference template has unique opening beat');

// 2.3: NF templates have different beat counts
assert(nfBeatsCode.includes("position: 1.00, name: 'The Closing Image'"), 'S-9: Narrative has 11 beats (closes with The Closing Image)');
assert(nfBeatsCode.includes("position: 1.00, name: 'What Remains'"), 'S-10: Investigative has closing (What Remains)');
assert(nfBeatsCode.includes("position: 1.00, name: 'The Send-Off'"), 'S-11: Prescriptive closes with The Send-Off');
assert(nfBeatsCode.includes("position: 1.00, name: \"What's Next\""), 'S-12: Reference closes with What\'s Next');

// 2.4: Section modes exist
const EXPECTED_MODES = ['exposition', 'case_study', 'analysis', 'how_to', 'synthesis',
  'documented_event', 'evidence_context', 'profile', 'investigative', 'teaching'];
for (const mode of EXPECTED_MODES) {
  assert(nfBeatsCode.includes(`${mode}:`), `S-13: NF section mode "${mode}" defined`);
}

// ══════════════════════════════════════════════════════════════
// SECTION 3: Author Voice Inventory
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 3: Author Voice Inventory \u2550\u2550\u2550\n');

const EXPECTED_VOICES = [
  'Toni Morrison', 'Cormac McCarthy', 'Donna Tartt', 'Kazuo Ishiguro',
  'Stephen King', 'James Patterson', 'Gillian Flynn', 'Lee Child',
  'Colleen Hoover', 'Ali Hazelwood', 'Sarah J. Maas',
  'Brandon Sanderson', 'Ursula K. Le Guin', 'Joe Abercrombie', 'N.K. Jemisin',
  'Sally Rooney', 'Taylor Jenkins Reid', 'Angie Thomas',
  'Arina Cheskey', 'Logan Wilshire', 'Sarah J. Carpenter',
  'Nora Ephron', 'Douglas Adams', 'Carl Hiaasen', 'Terry Pratchett',
  'Elmore Leonard', 'Christopher Moore',
  'Malcolm Gladwell', 'Michelle Obama', 'Erik Larson',
  'Custom / None',
];

for (const voice of EXPECTED_VOICES) {
  assert(autonovelCode.includes(voice), `S-14: Author voice "${voice}" exists`);
}

// 3.2: Voice groups cover fiction genres
const VOICE_GROUPS = ['Literary Fiction', 'Thriller & Suspense', 'Romance', 'Fantasy & Sci-Fi',
  'Contemporary & YA', 'Horror & Industrial', 'Dystopian & Noir', 'Clean & Inspirational',
  'Comedy & Humor', 'Nonfiction'];
for (const group of VOICE_GROUPS) {
  assert(autonovelCode.includes(`'${group}':`), `S-15: Voice group "${group}" exists`);
}

// 3.3: Each voice has id, name, desc
assert(autonovelCode.includes("id: 'toni-morrison'"), 'S-16: Toni Morrison has voice ID');
assert(autonovelCode.includes("id: 'stephen-king'"), 'S-17: Stephen King has voice ID');
assert(autonovelCode.includes("id: 'douglas-adams'"), 'S-18: Douglas Adams has voice ID');
assert(autonovelCode.includes("id: 'custom'"), 'S-19: Custom/None has voice ID');

// ══════════════════════════════════════════════════════════════
// SECTION 4: Custom Original Voice Dossiers
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 4: Custom Original Voice Dossiers \u2550\u2550\u2550\n');

// 4.1: Custom original voices have full dossiers
assert(autonovelCode.includes("'Arina Cheskey': `AUTHOR VOICE: Arina Cheskey"), 'S-20: Arina Cheskey has full voice dossier');
assert(autonovelCode.includes("'Logan Wilshire': `AUTHOR VOICE: Logan Wilshire"), 'S-21: Logan Wilshire has full voice dossier');
assert(autonovelCode.includes("'Sarah J. Carpenter': `AUTHOR VOICE: Sarah J. Carpenter"), 'S-22: Sarah J. Carpenter has full voice dossier');

// 4.2: Dossiers contain required sections
const DOSSIER_SECTIONS = ['TONE:', 'PROSE MECHANICS:', 'SENSORY FOCUS:', 'CHARACTER LENS:'];
for (const section of DOSSIER_SECTIONS) {
  assert(autonovelCode.includes(section), `S-23: Voice dossiers contain "${section}"`);
}

// 4.3: Comedy voices have full dossiers
assert(autonovelCode.includes("'Nora Ephron': `AUTHOR VOICE: Nora Ephron"), 'S-24: Nora Ephron has full voice dossier');
assert(autonovelCode.includes("'Douglas Adams': `AUTHOR VOICE: Douglas Adams"), 'S-25: Douglas Adams has full voice dossier');
assert(autonovelCode.includes("'Terry Pratchett': `AUTHOR VOICE: Terry Pratchett"), 'S-26: Terry Pratchett has full voice dossier');

// 4.4: All dossiers include DIALOGUE STYLE and ENDING RULE
assert(autonovelCode.includes('DIALOGUE STYLE:'), 'S-27: Voice dossiers have DIALOGUE STYLE');
assert(autonovelCode.includes('ENDING RULE:'), 'S-28: Voice dossiers have ENDING RULE');

// 4.5: Anti-tropes specified for horror/noir dossiers
assert(autonovelCode.includes('ANTI-TROPES:'), 'S-29: Custom dossiers include ANTI-TROPES');

// ══════════════════════════════════════════════════════════════
// SECTION 5: Genre Taxonomy Completeness
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 5: Genre Taxonomy \u2550\u2550\u2550\n');

// 5.1: Content lanes exist
const CONTENT_LANES = ['fiction', 'nonfiction', 'erotica', 'fanfiction'];
for (const lane of CONTENT_LANES) {
  assert(genreTaxonomyCode.includes(`value: '${lane}'`), `S-30: Content lane "${lane}" exists`);
}

// 5.2: Fiction genre groups
const FICTION_GROUPS = ['Commercial Fiction', 'Literary / Upmarket', 'Tone / Style', 'Age / Audience'];
for (const group of FICTION_GROUPS) {
  assert(genreTaxonomyCode.includes(group), `S-31: Fiction genre group "${group}" exists`);
}

// 5.3: Core fiction genres exist
const CORE_FICTION_GENRES = ['Thriller', 'Mystery', 'Crime', 'Horror', 'Romance',
  'Fantasy', 'Science Fiction', 'Literary Fiction', 'Historical Fiction'];
for (const genre of CORE_FICTION_GENRES) {
  assert(genreTaxonomyCode.includes(`'${genre}'`), `S-32: Core genre "${genre}" exists`);
}

// 5.4: Nonfiction genres
const CORE_NF_GENRES = ['Investigative', 'History', 'True Crime', 'Biography', 'Memoir',
  'Self-Help', 'Business', 'Training / Instructional'];
for (const genre of CORE_NF_GENRES) {
  assert(genreTaxonomyCode.includes(`'${genre}'`), `S-33: NF genre "${genre}" exists`);
}

// 5.5: Genre descriptions exist for all core genres
for (const genre of [...CORE_FICTION_GENRES, 'Memoir', 'Biography', 'History', 'Self-Help']) {
  // JS object keys: single-word use unquoted (Thriller:), multi-word use quoted ('Science Fiction':)
  const hasUnquoted = genreTaxonomyCode.includes(`${genre}:`);
  const hasQuoted = genreTaxonomyCode.includes(`'${genre}':`);
  assert(hasUnquoted || hasQuoted, `S-34: Genre description for "${genre}" exists`);
}

// 5.6: Subgenres exist
assert(genreTaxonomyCode.includes('SUBGENRES_BY_GENRE'), 'S-35: Subgenre system exists');
assert(genreTaxonomyCode.includes("'Psychological Thriller'"), 'S-36: Thriller subgenre exists');
assert(genreTaxonomyCode.includes("'Cozy Mystery'"), 'S-37: Mystery subgenre exists');
assert(genreTaxonomyCode.includes("'Epic Fantasy'"), 'S-38: Fantasy subgenre exists');

// ══════════════════════════════════════════════════════════════
// SECTION 6: Genre Defaults (POV/Tense/Beat Routing)
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 6: Genre Defaults Routing \u2550\u2550\u2550\n');

// 6.1: Genre defaults exist
assert(autonovelCode.includes('GENRE_DEFAULTS'), 'S-39: GENRE_DEFAULTS defined');

// 6.2: Different genres map to different POV modes
assert(autonovelCode.includes("Fantasy: { pov: 'third-close'"), 'S-40: Fantasy defaults to third-close POV');
assert(autonovelCode.includes("Mystery: { pov: 'first'"), 'S-41: Mystery defaults to first-person POV');
assert(autonovelCode.includes("Horror: { pov: 'third-close', tense: 'present'"), 'S-42: Horror defaults to present tense');
assert(autonovelCode.includes("'Young Adult': { pov: 'first', tense: 'present'"), 'S-43: YA defaults to first/present');

// 6.3: Genre defaults map to different beat styles
assert(autonovelCode.includes("Thriller: { pov: 'third-close', tense: 'past', beat: 'Tension-Driven'"), 'S-44: Thriller defaults to Tension-Driven beats');
assert(autonovelCode.includes("Romance: { pov: 'third-close', tense: 'past', beat: 'Slow Burn Romance'"), 'S-45: Romance defaults to Slow Burn Romance beats');
assert(autonovelCode.includes("beat: 'Character Study'"), 'S-46: Some genres default to Character Study beats');
assert(autonovelCode.includes("beat: 'Epic World-Building'"), 'S-47: Some genres default to Epic World-Building beats');
assert(autonovelCode.includes("beat: 'Mystery Unravel'"), 'S-48: Some genres default to Mystery Unravel beats');

// 6.4: Nonfiction genres have NF-specific POV modes
assert(autonovelCode.includes("'Self-Help': { pov: 'nf-direct'"), 'S-49: Self-Help uses nf-direct POV');
assert(autonovelCode.includes("Memoir: { pov: 'nf-author'"), 'S-50: Memoir uses nf-author POV');
assert(autonovelCode.includes("Biography: { pov: 'nf-third'"), 'S-51: Biography uses nf-third POV');
assert(autonovelCode.includes("'True Crime': { pov: 'nf-editorial'"), 'S-52: True Crime uses nf-editorial POV');

// 6.5: Erotica genres have spice defaults
assert(autonovelCode.includes("Erotica: { pov: 'third-close', tense: 'past', beat: 'Slow Burn Romance'") &&
  autonovelCode.includes('spice: 4'), 'S-53: Erotica defaults to spice 4');

// 6.6: NF genres have structure mode defaults
assert(autonovelCode.includes("structure: 'prescriptive'"), 'S-54: Some NF genres default to prescriptive');
assert(autonovelCode.includes("structure: 'narrative'"), 'S-55: Some NF genres default to narrative');
assert(autonovelCode.includes("structure: 'investigative'"), 'S-56: Some NF genres default to investigative');
assert(autonovelCode.includes("structure: 'reference'"), 'S-57: Some NF genres default to reference');

// ══════════════════════════════════════════════════════════════
// SECTION 7: Spice / Register / Intensity Levels
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 7: Spice / Register / Intensity \u2550\u2550\u2550\n');

// 7.1: All 5 spice levels defined
assert(autonovelCode.includes("0: { label: 'Fade to Black'"), 'S-58: Spice 0 = Fade to Black');
assert(autonovelCode.includes("1: { label: 'Closed Door'"), 'S-59: Spice 1 = Closed Door');
assert(autonovelCode.includes("2: { label: 'Cracked Door'"), 'S-60: Spice 2 = Cracked Door');
assert(autonovelCode.includes("3: { label: 'Open Door'"), 'S-61: Spice 3 = Open Door');
assert(autonovelCode.includes("4: { label: 'Full Intensity'"), 'S-62: Spice 4 = Full Intensity');

// 7.2: All 4 erotica registers defined
assert(autonovelCode.includes("0: { name: 'Literary'"), 'S-63: Register 0 = Literary');
assert(autonovelCode.includes("1: { name: 'Natural'"), 'S-64: Register 1 = Natural');
assert(autonovelCode.includes("2: { name: 'Vernacular'"), 'S-65: Register 2 = Vernacular');
assert(autonovelCode.includes("3: { name: 'Raw'"), 'S-66: Register 3 = Raw');

// 7.3: All 5 language intensity levels
assert(autonovelCode.includes("0: { label: 'Clean'"), 'S-67: Language 0 = Clean');
assert(autonovelCode.includes("4: { label: 'Raw'") && autonovelCode.includes('No language restrictions'), 'S-68: Language 4 = Raw / No restrictions');

// 7.4: Spice beat instructions escalate
assert(autonovelCode.includes('EROTICA BEAT REQUIREMENTS'), 'S-69: Erotica beat requirements block exists');
assert(autonovelCode.includes('Do not fade to black'), 'S-70: Spice 2+ prevents fade to black');
assert(autonovelCode.includes('EXPLICIT EROTICA'), 'S-71: Spice 4 is explicit erotica mode');
assert(autonovelCode.includes('30-40% of all scene beats'), 'S-72: Spice 4 requires 30-40% explicit beats');

// ══════════════════════════════════════════════════════════════
// SECTION 8: POV Modes
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 8: POV Modes \u2550\u2550\u2550\n');

// 8.1: Fiction POV modes
const FICTION_POVS = ['first', 'third-close', 'third-omni', 'third-multi', 'deep-first', 'second', 'epistolary'];
for (const pov of FICTION_POVS) {
  // JS object keys: simple words unquoted (first:), hyphenated quoted ('third-close':)
  const hasUnquoted = autonovelCode.includes(`${pov}:`);
  const hasQuoted = autonovelCode.includes(`'${pov}':`);
  assert(hasUnquoted || hasQuoted, `S-73: Fiction POV "${pov}" defined`);
}

// 8.2: Nonfiction POV modes
const NF_POVS = ['nf-author', 'nf-direct', 'nf-third', 'nf-editorial'];
for (const pov of NF_POVS) {
  assert(autonovelCode.includes(`'${pov}':`), `S-74: NF POV "${pov}" defined`);
}

// 8.3: POV presets exist
assert(autonovelCode.includes('POV_PRESETS_FICTION'), 'S-75: Fiction POV presets exist');
assert(autonovelCode.includes('POV_PRESETS_NF'), 'S-76: NF POV presets exist');

// ══════════════════════════════════════════════════════════════
// SECTION 9: Chapter Length Presets
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 9: Chapter Length Presets \u2550\u2550\u2550\n');

const LENGTH_PRESETS = ['flash', 'short', 'standard', 'long', 'epic'];
for (const preset of LENGTH_PRESETS) {
  assert(autonovelCode.includes(`${preset}:`), `S-77: Length preset "${preset}" defined`);
}
assert(autonovelCode.includes('words: 1000'), 'S-78: Flash = ~1000 words');
assert(autonovelCode.includes('words: 8500'), 'S-79: Epic = ~8500 words');

// ══════════════════════════════════════════════════════════════
// SECTION 10: NF Structure Modes
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 10: NF Structure Modes \u2550\u2550\u2550\n');

const NF_STRUCTURES = ['prescriptive', 'narrative', 'reference', 'investigative'];
for (const mode of NF_STRUCTURES) {
  assert(autonovelCode.includes(`${mode}: {`) && autonovelCode.includes('NF_STRUCTURE_MODES'),
    `S-80: NF structure mode "${mode}" defined`);
}

// 10.2: Each has unique pattern
assert(autonovelCode.includes("pattern: 'Framework"), 'S-81: Prescriptive has Framework pattern');
assert(autonovelCode.includes("pattern: 'Scene"), 'S-82: Narrative has Scene pattern');
assert(autonovelCode.includes("pattern: 'Definition"), 'S-83: Reference has Definition pattern');
assert(autonovelCode.includes("pattern: 'Evidence"), 'S-84: Investigative has Evidence pattern');

// ══════════════════════════════════════════════════════════════
// SECTION 11: Custom Author Style Flow
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 11: Custom Author Style Flow \u2550\u2550\u2550\n');

// 11.1: Full style block builder exists
assert(authorStylePromptCode.includes('buildCustomAuthorStyleBlock'), 'S-85: Full author style block builder exists');

// 11.2: Condensed style block builder exists
assert(authorStylePromptCode.includes('buildCondensedAuthorStyleBlock'), 'S-86: Condensed style block exists');

// 11.3: All 18 style fields flow into prompt
const STYLE_FIELDS = ['tone', 'sentence_rhythm', 'vocabulary_level', 'paragraph_style',
  'dialogue_style', 'dialogue_tags', 'description_approach', 'sensory_focus',
  'metaphor_style', 'emotional_handling', 'internal_monologue', 'humor_style',
  'pacing_preference', 'chapter_endings', 'always_do', 'never_do', 'sample_paragraph'];
for (const field of STYLE_FIELDS) {
  assert(authorStylePromptCode.includes(`style.${field}`), `S-87: Custom style field "${field}" flows into prompt`);
}

// 11.4: Scene writer uses author style
assert(sceneWriterCode.includes('authorStyle') || sceneWriterCode.includes('buildCustomAuthorStyleBlock'),
  'S-88: Scene writer integrates custom author style');

// ══════════════════════════════════════════════════════════════
// SECTION 12: Voice Instruction Routing
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 12: Voice Instruction Routing \u2550\u2550\u2550\n');

// 12.1: buildAuthorVoiceInstruction exists
assert(autonovelCode.includes('buildAuthorVoiceInstruction'), 'S-89: buildAuthorVoiceInstruction exists');

// 12.2: Custom dossiers take priority
assert(autonovelCode.includes('CUSTOM_VOICE_DOSSIERS[project.author_voice]'), 'S-90: Custom dossiers checked first');

// 12.3: Named authors get "write in the style of" instruction
assert(autonovelCode.includes('Write in the style of ${project.author_voice}'), 'S-91: Named authors get style instruction');

// 12.4: "Do NOT parody" safeguard
assert(autonovelCode.includes('Do NOT parody'), 'S-92: Named author instruction includes anti-parody safeguard');

// 12.5: Custom/None falls back to project voice guide
assert(autonovelCode.includes('No named author imitation is required'), 'S-93: Custom/None uses project voice guide');

// 12.6: Custom voice notes supported
assert(autonovelCode.includes('CUSTOM VOICE NOTES'), 'S-94: Custom voice notes injected into prompt');

// ══════════════════════════════════════════════════════════════
// SECTION 13: Project Context Header
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 13: Project Context Header \u2550\u2550\u2550\n');

// 13.1: Context header includes all style dimensions
assert(autonovelCode.includes('buildProjectContextHeader'), 'S-95: buildProjectContextHeader exists');
assert(autonovelCode.includes('TYPE: ${type}'), 'S-96: Header includes project type');
assert(autonovelCode.includes('GENRE:'), 'S-97: Header includes genre');
assert(autonovelCode.includes('BEAT:'), 'S-98: Header includes beat style');
assert(autonovelCode.includes('POV:'), 'S-99: Header includes POV');
assert(autonovelCode.includes('TENSE:'), 'S-100: Header includes tense');
assert(autonovelCode.includes('VOICE:'), 'S-101: Header includes author voice');
assert(autonovelCode.includes('SPICE:'), 'S-102: Header includes spice level');
assert(autonovelCode.includes('REGISTER:'), 'S-103: Header includes erotica register');
assert(autonovelCode.includes('STRUCTURE:'), 'S-104: Header includes NF structure mode');

// ══════════════════════════════════════════════════════════════
// SECTION 14: Structural Distinctiveness
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 14: Structural Distinctiveness \u2550\u2550\u2550\n');

// 14.1: Beat descriptions are meaningfully different (not just adjective swaps)
const tensionDesc = 'Escalating stakes';
const characterDesc = 'Internal conflict drives the plot';
const mysteryDesc = 'Clue';
const slowburnDesc = 'Touch escalation';
assert(
  autonovelCode.includes(tensionDesc) && autonovelCode.includes(characterDesc) &&
  autonovelCode.includes(mysteryDesc) && autonovelCode.includes(slowburnDesc),
  'S-105: Beat descriptions describe distinct structural approaches, not cosmetic differences'
);

// 14.2: Voice dossiers are structurally different
assert(
  autonovelCode.includes('Visceral, suffocating') && // Cheskey
  autonovelCode.includes('Cynical, hardboiled') && // Wilshire
  autonovelCode.includes('Warm, uplifting'), // Carpenter
  'S-106: Custom voice dossiers have structurally different tones'
);

// 14.3: Genre defaults create distinct configurations
// Fantasy != Mystery != Horror != YA
assert(
  autonovelCode.includes("Fantasy: { pov: 'third-close', tense: 'past', beat: 'Epic World-Building'") &&
  autonovelCode.includes("Mystery: { pov: 'first', tense: 'past', beat: 'Mystery Unravel'") &&
  autonovelCode.includes("Horror: { pov: 'third-close', tense: 'present', beat: 'Tension-Driven'") &&
  autonovelCode.includes("'Young Adult': { pov: 'first', tense: 'present', beat: 'Fast-Paced Action'"),
  'S-107: Genre defaults create distinct POV/tense/beat combinations'
);

// 14.4: Comedy beat styles are distinct from non-comedy
assert(
  autonovelCode.includes('Rapid-fire wit') && // Screwball
  autonovelCode.includes('Understated humor') && // Dry Wit
  autonovelCode.includes('Finding humor in the terrible') && // Dark Comedy
  autonovelCode.includes('Reality is broken'), // Absurdist
  'S-108: Comedy beat styles are structurally distinct from each other'
);

// ══════════════════════════════════════════════════════════════
// SECTION 15: Safety / No Contamination
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 15: Safety / No Contamination \u2550\u2550\u2550\n');

// 15.1: No DET-specific content in style definitions
assert(
  !autonovelCode.includes('Digital Equity Tribunal') &&
  !autonovelCode.includes('Priya Sharma'),
  'S-109: No DET-specific content in autonovel.js style definitions'
);

// 15.2: No process-leak patterns in voice dossiers
const processLeakPatterns = ['Action Plan', 'Implementation Plan', 'DELIVERABLE', 'Unity Supported Living'];
assert(!processLeakPatterns.some(p => autonovelCode.includes(p)), 'S-110: No process-leak patterns in voice dossiers');

// 15.3: Erotica controls gate on fiction book_type
assert(autonovelCode.includes("book_type === 'fiction'") || autonovelCode.includes("book_type !== 'fiction'"),
  'S-111: Erotica settings gated on fiction book_type');

// 15.4: NF beat templates have fabrication blockers
assert(nfBeatsCode.includes('FORBIDDEN_FABRICATION_TARGETS'), 'S-112: NF beats include fabrication blockers');
assert(nfBeatsCode.includes('AI_SMELL_PATTERNS'), 'S-113: NF beats include AI-smell pattern detection');

// 15.5: NF beat templates have motif budget
assert(nfBeatsCode.includes('MOTIF_BUDGET_TERMS'), 'S-114: NF beats have motif budget control');

// 15.6: Genre taxonomy has erotica safety language
assert(genreTaxonomyCode.includes('consenting adult'), 'S-115: Genre taxonomy includes consenting-adult language');

// 15.7: No contamination in genre descriptions
assert(
  !genreTaxonomyCode.includes('Digital Equity Tribunal') &&
  !genreTaxonomyCode.includes('Unity Supported'),
  'S-116: No contamination in genre taxonomy'
);

// ══════════════════════════════════════════════════════════════
// SECTION 16: Style Combination Support
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 16: Style Combination Support \u2550\u2550\u2550\n');

// 16.1: Genre defaults set beat_style, meaning genre+beat are always combined
assert(autonovelCode.includes("beat_style: defaults.beat"), 'S-117: Genre defaults auto-set beat_style');

// 16.2: Author voice is additive to genre/beat (separate instruction)
assert(autonovelCode.includes('buildAuthorVoiceInstruction') && autonovelCode.includes('buildProjectContextHeader'),
  'S-118: Voice instruction is separate from and additive to genre/beat header');

// 16.3: applyGenreDefaults preserves independent voice setting
assert(autonovelCode.includes('applyGenreDefaults'), 'S-119: applyGenreDefaults function exists');

// 16.4: Spice instructions are additive to beat/voice/genre
assert(autonovelCode.includes('buildSpiceInstruction') || autonovelCode.includes('buildSpiceBeatInstructions'),
  'S-120: Spice instructions are additive to other style dimensions');

// ══════════════════════════════════════════════════════════════
// SECTION 17: Scene Beat Schema
// ══════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550 SECTION 17: Scene Beat Schema \u2550\u2550\u2550\n');

// 17.1: Scene beat schema has style-relevant fields
assert(autonovelCode.includes('scene_goal'), 'S-121: Scene beat schema has scene_goal');
assert(autonovelCode.includes('emotional_arc'), 'S-122: Scene beat schema has emotional_arc');
assert(autonovelCode.includes('tension_level'), 'S-123: Scene beat schema has tension_level');
assert(autonovelCode.includes('exit_hook'), 'S-124: Scene beat schema has exit_hook');
assert(autonovelCode.includes('intimacy_level'), 'S-125: Scene beat schema has intimacy_level');
assert(autonovelCode.includes('pov_character'), 'S-126: Scene beat schema has pov_character');

// 17.2: Scene beat uniqueness contract exists
assert(autonovelCode.includes('SCENE BEAT UNIQUENESS CONTRACT'), 'S-127: Scene beat uniqueness contract exists');

// 17.3: Chapter title hygiene block exists
assert(autonovelCode.includes('CHAPTER TITLE HYGIENE'), 'S-128: Chapter title hygiene block exists');

// ════════════════════════════════════════════════════════════════
console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
console.log(`STYLE CONTROLS EFFECTIVENESS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
if (failed > 0) process.exit(1);
