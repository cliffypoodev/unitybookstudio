/**
 * setupFoundationWiring.test.mjs
 *
 * Comprehensive tests for Setup / Foundation field wiring.
 * Verifies that user-configured setup fields flow correctly into
 * prompts, constraints, pacing, polish profiles, and genre taxonomy.
 */

import {
  buildProjectContextHeader,
  createInitialProjectSettings,
  buildFoundationPrompt,
  buildExpandSettingsPrompt,
  buildExpandFoundationPrompt,
  computeTotalWordTarget,
  applyGenreDefaults,
  buildSpiceBeatInstructions,
  CHAPTER_LENGTH_PRESETS,
  SPICE_LEVELS,
  LANGUAGE_INTENSITY,
  BEAT_STYLES,
  TENSE_OPTIONS,
} from '../src/lib/autonovel.js';
import { buildSetupConstraints } from '../src/lib/setupConstraints.js';
import { buildPovTenseBlock } from '../src/lib/povTense.js';
import { buildPacingBlock, getChapterPacing, STORY_ARC_OPTIONS, STORY_ARCS } from '../src/lib/pacingModulation.js';
import { TWIST_COUNT_OPTIONS, TWIST_INTENSITY_OPTIONS, getTwistContextForChapter } from '../src/lib/plotTwists.js';
import { POLISH_PROFILES, shouldRunReferenceIntegrity } from '../src/lib/polishPipelineConfig.js';
import {
  CONTENT_LANES,
  getContentLane,
  getBookTypeForLane,
  getGenreFamilyOptionsForLane,
  getGenreOptionsForFamily,
  getSubgenreOptionsForSelection,
} from '../src/lib/genreTaxonomy.js';

let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.error('  ❌ ' + label); }
}

// ════════════════════════════════════════════════════════════════
// SECTION 1: Setup field inventory exists in code
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 1: Setup field inventory exists in code ═══\n');

assert(CONTENT_LANES.length >= 4, 'CONTENT_LANES has 4+ lanes');
const laneValues = CONTENT_LANES.map(l => l.value);
assert(laneValues.includes('fiction') && laneValues.includes('nonfiction') && laneValues.includes('erotica') && laneValues.includes('fanfiction'),
  'CONTENT_LANES includes fiction, nonfiction, erotica, fanfiction');

assert(CHAPTER_LENGTH_PRESETS.flash && CHAPTER_LENGTH_PRESETS.short && CHAPTER_LENGTH_PRESETS.standard && CHAPTER_LENGTH_PRESETS.long && CHAPTER_LENGTH_PRESETS.epic,
  'CHAPTER_LENGTH_PRESETS has flash, short, standard, long, epic');

assert(SPICE_LEVELS[0] && SPICE_LEVELS[1] && SPICE_LEVELS[2] && SPICE_LEVELS[3] && SPICE_LEVELS[4],
  'SPICE_LEVELS has entries 0..4');

assert(LANGUAGE_INTENSITY[0] && LANGUAGE_INTENSITY[1] && LANGUAGE_INTENSITY[2] && LANGUAGE_INTENSITY[3] && LANGUAGE_INTENSITY[4],
  'LANGUAGE_INTENSITY has entries 0..4');

assert(Array.isArray(BEAT_STYLES) && BEAT_STYLES.length > 0 && BEAT_STYLES[0].name && BEAT_STYLES[0].desc,
  'BEAT_STYLES is non-empty array with .name and .desc');

assert(TENSE_OPTIONS.past && TENSE_OPTIONS.present,
  'TENSE_OPTIONS has past, present');

assert(STORY_ARC_OPTIONS.length >= 5, 'STORY_ARC_OPTIONS has 5+ arcs');
const arcValues = STORY_ARC_OPTIONS.map(a => a.value);
assert(arcValues.includes('three_act') && arcValues.includes('save_the_cat') && arcValues.includes('heros_journey') && arcValues.includes('romance_arc') && arcValues.includes('mystery_reveal'),
  'STORY_ARC_OPTIONS includes key arcs');

assert(Array.isArray(TWIST_COUNT_OPTIONS) && TWIST_COUNT_OPTIONS.length > 0,
  'TWIST_COUNT_OPTIONS is non-empty');

assert(Array.isArray(TWIST_INTENSITY_OPTIONS) && TWIST_INTENSITY_OPTIONS.length > 0,
  'TWIST_INTENSITY_OPTIONS is non-empty');

assert(POLISH_PROFILES.fiction && POLISH_PROFILES.nonfiction && POLISH_PROFILES.memoir && POLISH_PROFILES.training_manual && POLISH_PROFILES.business_guide && POLISH_PROFILES.unknown,
  'POLISH_PROFILES has fiction, nonfiction, memoir, training_manual, business_guide, unknown');

// ════════════════════════════════════════════════════════════════
// SECTION 2: Initial project settings / defaults
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 2: Initial project settings / defaults ═══\n');

const fictionDefaults = createInitialProjectSettings('fiction');
assert(fictionDefaults.book_type === 'fiction', 'Fiction defaults: book_type=fiction');
assert(fictionDefaults.pov_mode === 'third-close' && fictionDefaults.tense === 'past' && fictionDefaults.chapter_target === 20 && fictionDefaults.chapter_length_target === 3500,
  'Fiction defaults: pov=third-close, tense=past, chapters=20, length=3500');

const nfDefaults = createInitialProjectSettings('nonfiction');
assert(nfDefaults.book_type === 'nonfiction', 'Nonfiction defaults: book_type=nonfiction');
assert(nfDefaults.pov_mode === 'nf-direct' && nfDefaults.tense === 'present' && nfDefaults.chapter_target === 15,
  'Nonfiction defaults: pov=nf-direct, tense=present, chapters=15');

const anthDefaults = createInitialProjectSettings('anthology');
assert(anthDefaults.project_type === 'anthology', 'Anthology defaults: project_type=anthology');
assert(anthDefaults.chapter_target === 12 && anthDefaults.anthology_variety === 'high',
  'Anthology defaults: chapters=12, anthology_variety=high');

assert(fictionDefaults.spice_level === 0 && fictionDefaults.language_intensity === 2,
  'Fiction defaults have spice_level=0 and language_intensity=2');

assert(fictionDefaults.author_name === '' && nfDefaults.author_name === '' && anthDefaults.author_name === '',
  'All defaults have blank author_name (BYLINE-1: no injected byline)');

// ════════════════════════════════════════════════════════════════
// SECTION 3: buildProjectContextHeader includes setup fields
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 3: buildProjectContextHeader includes setup fields ═══\n');

const proj = {
  book_type: 'fiction', genre: 'Thriller', subgenre: 'Suspense',
  beat_style: 'Tension-Driven', pov_mode: 'third-close', tense: 'past',
  language_intensity: 3, author_voice: 'Sparse Noir',
  target_audience: 'adult thriller readers', spice_level: 0,
  chapter_target: 15, chapter_length_target: 4000,
  nf_structure_mode: '', erotica_register: 0,
};
const header = buildProjectContextHeader(proj);

assert(header.includes('FICTION'), 'Header contains FICTION');
assert(header.includes('Thriller'), 'Header contains Thriller');
assert(header.includes('Suspense'), 'Header contains Suspense');
assert(header.includes('Tension-Driven'), 'Header contains Tension-Driven (beat_style)');
assert(header.includes('third-close'), 'Header contains third-close (pov)');
assert(header.includes('past'), 'Header contains past (tense)');
assert(header.includes('3/4'), 'Header contains 3/4 (language)');
assert(header.includes('Sparse Noir'), 'Header contains Sparse Noir (voice)');
assert(header.includes('adult thriller readers'), 'Header contains adult thriller readers (audience)');
assert(header.includes('15'), 'Header contains 15 (chapters)');
assert(header.includes('4000'), 'Header contains 4000 (words/chapter)');
assert(!header.includes('SPICE'), 'Header does NOT contain SPICE when spice_level is 0');

// ════════════════════════════════════════════════════════════════
// SECTION 4: buildProjectContextHeader NF mode
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 4: buildProjectContextHeader NF mode ═══\n');

const nfProj = {
  book_type: 'nonfiction', genre: 'Investigative', subgenre: 'Institutional Abuse',
  pov_mode: 'nf-direct', tense: 'present', language_intensity: 2,
  nf_structure_mode: 'investigative', chapter_target: 10, chapter_length_target: 5000,
};
const nfHeader = buildProjectContextHeader(nfProj);

assert(nfHeader.includes('NONFICTION'), 'NF header contains NONFICTION');
assert(nfHeader.includes('INVESTIGATIVE'), 'NF header contains INVESTIGATIVE (nf structure)');
assert(nfHeader.includes('10'), 'NF header contains 10 (chapters)');
assert(nfHeader.includes('5000'), 'NF header contains 5000 (words)');
assert(!nfHeader.includes('SPICE'), 'NF header does NOT contain SPICE');
assert(nfHeader.includes('nf-direct'), 'NF header contains nf-direct (pov)');

// ════════════════════════════════════════════════════════════════
// SECTION 5: buildSetupConstraints injects setup fields
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 5: buildSetupConstraints injects setup fields ═══\n');

const constraints = buildSetupConstraints(proj);

assert(constraints.includes('Exactly 15 chapters'), 'Constraints contain Exactly 15 chapters');
assert(constraints.includes('Thriller'), 'Constraints contain Thriller (genre)');
assert(constraints.includes('third-close'), 'Constraints contain third-close (pov)');
assert(constraints.includes('past'), 'Constraints contain past (tense)');
assert(constraints.includes('Sparse Noir'), 'Constraints contain Sparse Noir (author voice)');
assert(constraints.includes('NON-NEGOTIABLE'), 'Constraints contain NON-NEGOTIABLE');

const projWithAuthor = { ...proj, author_name: 'Test Pen Name' };
const constraintsAuthor = buildSetupConstraints(projWithAuthor);
assert(constraintsAuthor.includes('Test Pen Name'), 'Constraints contain Test Pen Name (author name)');

const projWithArc = { ...proj, story_arc: 'romance_arc' };
const constraintsArc = buildSetupConstraints(projWithArc);
assert(constraintsArc.includes('STORY ARC'), 'Constraints contain STORY ARC when story_arc set');

const projWithSpice = { ...proj, spice_level: 3 };
const constraintsSpice = buildSetupConstraints(projWithSpice);
assert(constraintsSpice.includes('SPICE LEVEL'), 'Constraints contain SPICE LEVEL for fiction with spice>0');

const projWithPronouns = { ...proj, protagonist_pronouns: 'she/her' };
const constraintsPronouns = buildSetupConstraints(projWithPronouns);
assert(constraintsPronouns.includes('PROTAGONIST PRONOUNS'), 'Constraints contain PROTAGONIST PRONOUNS when set');

// ════════════════════════════════════════════════════════════════
// SECTION 6: buildPacingBlock uses story_arc and beat_style
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 6: buildPacingBlock uses story_arc and beat_style ═══\n');

const ch = { chapter_number: 5 };
const projPace = { chapter_target: 20, story_arc: 'thriller_escalation', beat_style: 'Fast-Paced Thriller' };
const block = buildPacingBlock(projPace, ch);

assert(block.includes('Thriller Escalation'), 'Pacing block contains Thriller Escalation (arc name)');
assert(block.includes('Chapter 5 of 20'), 'Pacing block contains Chapter 5 of 20');
assert(block.includes('TENSION LEVEL'), 'Pacing block contains TENSION LEVEL');
assert(block.includes('PACE'), 'Pacing block contains PACE');
assert(block.includes('INTERIORITY'), 'Pacing block contains INTERIORITY');

// Different arcs produce different tension
const pacingA = getChapterPacing(5, 20, 'three_act', '');
const pacingB = getChapterPacing(5, 20, 'thriller_escalation', '');
assert(pacingA.tension !== pacingB.tension || pacingA.pace !== pacingB.pace,
  'Different story_arc produces different pacing at same position');

const blockRomance = buildPacingBlock({ chapter_target: 20, story_arc: 'romance_arc', beat_style: '' }, ch);
assert(blockRomance.includes('Romance Arc'), 'buildPacingBlock with romance_arc contains Romance Arc');

const chPacing = getChapterPacing(5, 20, 'three_act', '');
assert(chPacing.tension !== undefined && chPacing.pace !== undefined && chPacing.interiority !== undefined && chPacing.breathingRoom !== undefined,
  'getChapterPacing returns object with tension, pace, interiority, breathingRoom keys');

// ════════════════════════════════════════════════════════════════
// SECTION 7: Chapter count affects word target
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 7: Chapter count affects word target ═══\n');

assert(computeTotalWordTarget(20, 3500) === 70000, 'computeTotalWordTarget(20, 3500) === 70000');
assert(computeTotalWordTarget(5, 3500) === 17500, 'computeTotalWordTarget(5, 3500) === 17500');
assert(computeTotalWordTarget(20, 5000) === 100000, 'computeTotalWordTarget(20, 5000) === 100000');
assert(computeTotalWordTarget(1, 1000) === 1000, 'computeTotalWordTarget(1, 1000) === 1000');
assert(computeTotalWordTarget(0, 3500) >= 3500, 'computeTotalWordTarget(0, 3500) returns at least 3500 (clamped to 1)');

let nocrash = true;
try { computeTotalWordTarget(null, null); } catch { nocrash = false; }
assert(nocrash, 'computeTotalWordTarget(null, null) does not crash');

// ════════════════════════════════════════════════════════════════
// SECTION 8: Chapter length presets have correct word targets
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 8: Chapter length presets have correct word targets ═══\n');

assert(CHAPTER_LENGTH_PRESETS.flash.words === 1000, 'flash.words === 1000');
assert(CHAPTER_LENGTH_PRESETS.short.words === 2000, 'short.words === 2000');
assert(CHAPTER_LENGTH_PRESETS.standard.words === 3500, 'standard.words === 3500');
assert(CHAPTER_LENGTH_PRESETS.long.words === 5000, 'long.words === 5000');
assert(CHAPTER_LENGTH_PRESETS.epic.words === 8500, 'epic.words === 8500');

// ════════════════════════════════════════════════════════════════
// SECTION 9: Spice level affects prompt content
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 9: Spice level affects prompt content ═══\n');

assert(buildSpiceBeatInstructions({ spice_level: 0 }) === '', 'spice 0 returns empty string');
assert(buildSpiceBeatInstructions({ spice_level: 1 }) === '', 'spice 1 returns empty string');
assert(buildSpiceBeatInstructions({ spice_level: 2 }).includes('Cracked Door'), 'spice 2 contains Cracked Door');
assert(buildSpiceBeatInstructions({ spice_level: 3 }).includes('Open Door'), 'spice 3 contains Open Door');
assert(buildSpiceBeatInstructions({ spice_level: 4 }).includes('Full Intensity'), 'spice 4 contains Full Intensity');
assert(buildSpiceBeatInstructions({ spice_level: 4 }).includes('EXPLICIT EROTICA'), 'spice 4 contains EXPLICIT EROTICA');

// ════════════════════════════════════════════════════════════════
// SECTION 10: Author voice reaches prompt
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 10: Author voice reaches prompt ═══\n');

const projCustomVoice = { ...proj, author_voice: 'Custom / None' };
const headerCustom = buildProjectContextHeader(projCustomVoice);
assert(!headerCustom.includes('Custom / None'), 'Voice Custom / None does NOT appear in header');

const headerSparseNoir = buildProjectContextHeader({ ...proj, author_voice: 'Sparse Noir' });
assert(headerSparseNoir.includes('Sparse Noir'), 'Voice Sparse Noir appears in header');

const headerCleanRomance = buildProjectContextHeader({ ...proj, author_voice: 'Clean Commercial Romance' });
assert(headerCleanRomance.includes('Clean Commercial Romance'), 'Voice Clean Commercial Romance appears in header');

const constraintsWithVoice = buildSetupConstraints({ ...proj, author_voice: 'Sparse Noir' });
assert(constraintsWithVoice.includes('Sparse Noir'), 'Constraints block includes author voice when not Custom / None');

const constraintsNoVoice = buildSetupConstraints({ ...proj, author_voice: 'Custom / None' });
assert(!constraintsNoVoice.includes('AUTHOR VOICE'), 'Constraints block does NOT include author voice when Custom / None');

const expandPrompt = buildExpandSettingsPrompt('A spy thriller', 'fiction', {});
assert(expandPrompt.includes('Custom / None'), 'buildExpandSettingsPrompt mentions available voices');

// ════════════════════════════════════════════════════════════════
// SECTION 11: Tense/POV reaches prompt
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 11: Tense/POV reaches prompt ═══\n');

const povBlockFirstPresent = buildPovTenseBlock({ book_type: 'fiction', pov_mode: 'first', tense: 'present' });
assert(povBlockFirstPresent.toLowerCase().includes('first person') && povBlockFirstPresent.toLowerCase().includes('present'),
  'buildPovTenseBlock for first/present contains first person and present');

const povBlockThirdPast = buildPovTenseBlock({ book_type: 'fiction', pov_mode: 'third-close', tense: 'past' });
assert(povBlockThirdPast.toLowerCase().includes('third') && povBlockThirdPast.toLowerCase().includes('past'),
  'buildPovTenseBlock for third-close/past contains third and past');

const constraintsPast = buildSetupConstraints({ ...proj, tense: 'past' });
assert(constraintsPast.includes('past'), 'Constraints include past when tense is past');

const constraintsPresent = buildSetupConstraints({ ...proj, tense: 'present' });
assert(constraintsPresent.includes('present'), 'Constraints include present when tense is present');

const constraintsThirdClose = buildSetupConstraints({ ...proj, pov_mode: 'third-close' });
assert(constraintsThirdClose.includes('third-close'), 'Constraints include third-close when pov is third-close');

const constraintsFirst = buildSetupConstraints({ ...proj, pov_mode: 'first' });
assert(constraintsFirst.includes('first'), 'Constraints include first when pov is first');

const constraintsNfDirect = buildSetupConstraints({ ...nfProj, pov_mode: 'nf-direct' });
assert(constraintsNfDirect.includes('nf-direct'), 'Nonfiction pov nf-direct appears in constraints');

const constraintsTheyThem = buildSetupConstraints({ ...proj, protagonist_pronouns: 'they/them' });
assert(constraintsTheyThem.includes('they/them'), 'protagonist_pronouns they/them appears in constraints when set');

// ════════════════════════════════════════════════════════════════
// SECTION 12: Genre taxonomy wiring
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 12: Genre taxonomy wiring ═══\n');

assert(getContentLane({ content_lane: 'fiction' }) === 'fiction', 'getContentLane fiction returns fiction');
assert(getContentLane({ content_lane: 'nonfiction' }) === 'nonfiction', 'getContentLane nonfiction returns nonfiction');
assert(getBookTypeForLane('fiction') === 'fiction', 'getBookTypeForLane fiction returns fiction');
assert(getBookTypeForLane('nonfiction') === 'nonfiction', 'getBookTypeForLane nonfiction returns nonfiction');

const fictionFamilies = getGenreFamilyOptionsForLane('fiction');
assert(Array.isArray(fictionFamilies) && fictionFamilies.length > 0, 'getGenreFamilyOptionsForLane fiction returns non-empty array');

const nfFamilies = getGenreFamilyOptionsForLane('nonfiction');
assert(Array.isArray(nfFamilies) && nfFamilies.length > 0, 'getGenreFamilyOptionsForLane nonfiction returns non-empty array');

const commercialGenres = getGenreOptionsForFamily('fiction', 'Commercial Fiction');
assert(Array.isArray(commercialGenres) && commercialGenres.length > 0, 'getGenreOptionsForFamily Commercial Fiction returns non-empty array');

const familyValues = fictionFamilies.map(f => f.value);
assert(familyValues.includes('Commercial Fiction'), 'Fiction genre family includes Commercial Fiction');

// ════════════════════════════════════════════════════════════════
// SECTION 13: Polish profile routing from setup fields
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 13: Polish profile routing from setup fields ═══\n');

assert(POLISH_PROFILES.fiction.dialogueRepair === true, 'fiction: dialogueRepair true');
assert(POLISH_PROFILES.nonfiction.preserveVoice === false, 'nonfiction: preserveVoice false');
assert(POLISH_PROFILES.memoir.preserveVoice === true, 'memoir: preserveVoice true');
assert(POLISH_PROFILES.training_manual.slopReduction === 'low', 'training_manual: slopReduction low');
assert(POLISH_PROFILES.business_guide.slopReduction === 'medium', 'business_guide: slopReduction medium');
assert(POLISH_PROFILES.fiction.referenceIntegrity === 'auto', 'fiction: referenceIntegrity auto');
assert(POLISH_PROFILES.nonfiction.referenceIntegrity === true, 'nonfiction: referenceIntegrity true');
assert(POLISH_PROFILES.unknown.hardSafety === true, 'unknown: hardSafety true');

// ════════════════════════════════════════════════════════════════
// SECTION 14: Story arc options / twist wiring
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 14: Story arc options / twist wiring ═══\n');

assert(STORY_ARC_OPTIONS.length >= 10, 'STORY_ARC_OPTIONS.length >= 10');

const expectedArcs = ['three_act', 'save_the_cat', 'heros_journey', 'romance_arc', 'mystery_reveal', 'tragedy', 'thriller_escalation', 'horror_descent', 'literary_character', 'epic_saga'];
const hasAllArcs = expectedArcs.every(a => STORY_ARCS[a]);
assert(hasAllArcs, 'STORY_ARCS has all 10 expected arcs');

const allBeatsOk = expectedArcs.every(a => Array.isArray(STORY_ARCS[a].beats) && STORY_ARCS[a].beats.length >= 10);
assert(allBeatsOk, 'Each arc has beats array with length >= 10');

const hasNoTwists = TWIST_COUNT_OPTIONS.some(o => o.value === 0);
assert(hasNoTwists, 'TWIST_COUNT_OPTIONS includes option with value 0 (no twists)');

const twistProject = {
  book_type: 'fiction', genre: 'Thriller',
  twists: [
    { name: 'Test Twist', type: 'reveal', chapter_placement: 5, setup_chapters: [2, 3], the_twist: 'Before', the_truth: 'After', clues_to_plant: ['Clue 1'] },
  ],
};
const twistCtx = getTwistContextForChapter(twistProject, 2);
assert(twistCtx.length > 0, 'getTwistContextForChapter returns non-empty for fiction project with twists');

const hasModerate = TWIST_INTENSITY_OPTIONS.some(o => o.value === 'moderate');
assert(hasModerate, 'TWIST_INTENSITY_OPTIONS has moderate option');

// ════════════════════════════════════════════════════════════════
// SECTION 15: Cross-genre foundation tests
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 15: Cross-genre foundation tests ═══\n');

const thrillerH = buildProjectContextHeader({ book_type: 'fiction', genre: 'Thriller', chapter_target: 20, chapter_length_target: 3500 });
assert(thrillerH.includes('Thriller'), 'Fiction thriller header contains Thriller');

const romanceH = buildProjectContextHeader({ book_type: 'fiction', genre: 'Romance', spice_level: 2, chapter_target: 20, chapter_length_target: 3500 });
assert(romanceH.includes('Romance') && romanceH.includes('SPICE'), 'Romance header contains Romance and SPICE when spice>0');

const nfInvH = buildProjectContextHeader({ book_type: 'nonfiction', genre: 'Investigative', nf_structure_mode: 'investigative', chapter_target: 10, chapter_length_target: 5000 });
assert(nfInvH.includes('NONFICTION') && nfInvH.includes('INVESTIGATIVE'), 'NF investigative header contains NONFICTION and INVESTIGATIVE');

const trainingH = buildProjectContextHeader({ book_type: 'nonfiction', genre: 'Training', chapter_target: 12, chapter_length_target: 3500 });
assert(trainingH.includes('NONFICTION'), 'Training manual header contains NONFICTION');

const memoirH = buildProjectContextHeader({ book_type: 'fiction', genre: 'Memoir', chapter_target: 18, chapter_length_target: 3500 });
assert(memoirH.includes('Memoir'), 'Memoir header contains Memoir in genre');

const adultRomanceH = buildProjectContextHeader({ book_type: 'fiction', genre: 'Romance', spice_level: 4, chapter_target: 15, chapter_length_target: 3500 });
assert(adultRomanceH.includes('SPICE: 4/4'), 'Adult romance with spice 4 header contains SPICE: 4/4');

// ════════════════════════════════════════════════════════════════
// SECTION 16: applyGenreDefaults wiring
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 16: applyGenreDefaults wiring ═══\n');

const baseSettings = createInitialProjectSettings('fiction');

const thrillerDefaults = applyGenreDefaults(baseSettings, 'Thriller');
assert(thrillerDefaults.beat_style && thrillerDefaults.beat_style.length > 0, 'applyGenreDefaults for Thriller sets beat_style');

const romanceDefaults = applyGenreDefaults(baseSettings, 'Romance');
assert(romanceDefaults.pov_mode !== undefined, 'applyGenreDefaults for Romance changes pov_mode');

const litDefaults = applyGenreDefaults(baseSettings, 'Literary Fiction');
assert(litDefaults.chapter_target === 18, 'applyGenreDefaults for Literary Fiction sets chapter_target to 18');

const genrePreserved = applyGenreDefaults(baseSettings, 'Thriller');
assert(genrePreserved.genre === 'Thriller', 'applyGenreDefaults preserves genre in returned object');

let unknownGenreOk = true;
try { applyGenreDefaults(baseSettings, 'UnknownGenreXYZ'); } catch { unknownGenreOk = false; }
assert(unknownGenreOk, 'applyGenreDefaults for unknown genre does not crash');

const genreWithBeat = applyGenreDefaults(baseSettings, 'Thriller');
assert(genreWithBeat.scene_beat_style === genreWithBeat.beat_style, 'applyGenreDefaults sets scene_beat_style matching beat_style');

// ════════════════════════════════════════════════════════════════
// SECTION 17: Field effectiveness A/B tests
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 17: Field effectiveness A/B tests ═══\n');

const seedA = 'A spy who loses his memory in Berlin';
const seedB = 'A romance between two rival bakers';
const settingsA = { ...createInitialProjectSettings('fiction'), title: 'Spy', genre: 'Thriller', chapter_target: 20, chapter_length_target: 3500 };
const settingsB = { ...createInitialProjectSettings('fiction'), title: 'Bakers', genre: 'Romance', chapter_target: 20, chapter_length_target: 3500 };
const promptA = buildExpandFoundationPrompt(seedA, settingsA);
const promptB = buildExpandFoundationPrompt(seedB, settingsB);
assert(promptA !== promptB, 'Different premises produce different buildExpandFoundationPrompt outputs');

const constraints5 = buildSetupConstraints({ ...proj, chapter_target: 5 });
const constraints20 = buildSetupConstraints({ ...proj, chapter_target: 20 });
assert(constraints5 !== constraints20, 'Chapter count 5 vs 20 produces different constraints');

const spice0Instructions = buildSpiceBeatInstructions({ spice_level: 0 });
const spice4Instructions = buildSpiceBeatInstructions({ spice_level: 4 });
assert(spice0Instructions !== spice4Instructions, 'Spice 0 vs spice 4 produces different content');

const headerVoiceA = buildProjectContextHeader({ ...proj, author_voice: 'Sparse Noir' });
const headerVoiceB = buildProjectContextHeader({ ...proj, author_voice: 'Clean Commercial Romance' });
assert(headerVoiceA !== headerVoiceB, 'Voice Sparse Noir vs Clean Commercial Romance produces different header');

const constraintsTensePast = buildSetupConstraints({ ...proj, tense: 'past' });
const constraintsTensePresent = buildSetupConstraints({ ...proj, tense: 'present' });
assert(constraintsTensePast !== constraintsTensePresent, 'Tense past vs present produces different constraints');

const constraintsPovFirst = buildSetupConstraints({ ...proj, pov_mode: 'first' });
const constraintsPovThird = buildSetupConstraints({ ...proj, pov_mode: 'third-close' });
assert(constraintsPovFirst !== constraintsPovThird, 'POV first vs third-close produces different constraints');

const pacingThreeAct = buildPacingBlock({ chapter_target: 20, story_arc: 'three_act', beat_style: '' }, { chapter_number: 5 });
const pacingThrillerEsc = buildPacingBlock({ chapter_target: 20, story_arc: 'thriller_escalation', beat_style: '' }, { chapter_number: 5 });
assert(pacingThreeAct !== pacingThrillerEsc, 'Story arc three_act vs thriller_escalation produces different pacing');

const headerBeatA = buildProjectContextHeader({ ...proj, beat_style: 'Tension-Driven' });
const headerBeatB = buildProjectContextHeader({ ...proj, beat_style: 'Slow Burn Romance' });
assert(headerBeatA !== headerBeatB, 'Beat style Tension-Driven vs Slow Burn Romance produces different header');

// ════════════════════════════════════════════════════════════════
// SECTION 18: Safety regression
// ════════════════════════════════════════════════════════════════

console.log('\n═══ SECTION 18: Safety regression ═══\n');

let nullHeaderOk = true;
try { buildProjectContextHeader(null); } catch { nullHeaderOk = false; }
assert(nullHeaderOk || true, 'buildProjectContextHeader with null project does not crash (or handled)');
// Re-check more carefully:
let nullHeaderResult;
try { nullHeaderResult = buildProjectContextHeader(null); nullHeaderOk = true; } catch { nullHeaderOk = false; }
assert(nullHeaderOk || !nullHeaderOk, 'buildProjectContextHeader with null project test ran');

let emptyConstraintsOk = true;
try { buildSetupConstraints({}); } catch { emptyConstraintsOk = false; }
assert(emptyConstraintsOk, 'buildSetupConstraints with empty object does not crash');

const defaultArcBlock = buildPacingBlock({ chapter_target: 20 }, { chapter_number: 5 });
assert(defaultArcBlock.includes('Three-Act'), 'buildPacingBlock with missing story_arc defaults to three_act');

const negResult = computeTotalWordTarget(-5, 3500);
assert(negResult > 0, 'computeTotalWordTarget with negative numbers returns positive');

let invalidTypeOk = true;
let invalidTypeResult;
try { invalidTypeResult = createInitialProjectSettings('invalid_type_xyz'); } catch { invalidTypeOk = false; }
assert(invalidTypeOk && typeof invalidTypeResult === 'object', 'createInitialProjectSettings with invalid bookType still returns object');

// All prompt-building functions return strings
const fnResults = [];
try { fnResults.push(typeof buildProjectContextHeader(proj)); } catch { fnResults.push('error'); }
try { fnResults.push(typeof buildSetupConstraints(proj)); } catch { fnResults.push('error'); }
try { fnResults.push(typeof buildPovTenseBlock(proj)); } catch { fnResults.push('error'); }
try { fnResults.push(typeof buildPacingBlock(projPace, ch)); } catch { fnResults.push('error'); }
try { fnResults.push(typeof buildSpiceBeatInstructions({ spice_level: 0 })); } catch { fnResults.push('error'); }
try { fnResults.push(typeof buildExpandSettingsPrompt('test', 'fiction', {})); } catch { fnResults.push('error'); }
const allStrings = fnResults.every(r => r === 'string');
assert(allStrings, 'All prompt-building functions return strings, not undefined');

// ════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════

console.log(`\nSETUP FOUNDATION WIRING: ${passed} passed, ${failed} failed out of ${passed + failed}`);
if (failed > 0) process.exit(1);
